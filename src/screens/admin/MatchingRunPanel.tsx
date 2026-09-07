import { useCallback, useEffect, useState } from "react";
import { Button } from "../../components/Button";
import { useEventSession } from "../../hooks/useEventSession";
import { downloadCsv, toCsv } from "../../lib/csvExport";
import { supabase } from "../../lib/supabase";

interface WaitingParticipant {
  participant_id: string;
  matching_number: string;
  nickname: string;
  department: string;
  grade: number;
  gender_code: "male" | "female" | "other";
  active_match_count: number;
}

interface PreviewResult {
  run_id: string;
  status: string;
  input_count: number;
  proposed_match_count: number;
  unmatched_count: number;
  score_distribution: Record<string, number>;
}

interface CommitResult {
  run_id: string;
  committed_count: number;
  fallback_ran: boolean;
  fallback?: { committed_count: number };
  rescue?: { proposed_match_count: number; committed?: { committed_count: number } };
}

interface MatchExportRow {
  match_id: string;
  a_matching_number: string;
  a_name: string;
  a_gender: "male" | "female" | "other";
  a_department: string;
  a_phone: string | null;
  b_matching_number: string;
  b_name: string;
  b_gender: "male" | "female" | "other";
  b_department: string;
  b_phone: string | null;
}

interface ParticipantExportRow {
  matching_number: string;
  status: string;
  submitted_at: string;
  nickname: string;
  department: string;
  grade: number;
  gender_code: string;
  mbti: string | null;
  one_liner: string | null;
  seeking_gender_codes: string[];
  preferred_grades: number[];
  self_traits: string[];
  desired_traits: string[];
  interests: string[];
  activities: string[];
  food_tags: string[];
  music_tags: string[];
  conversation_style: string | null;
  instagram_handle: string | null;
  phone_number: string | null;
}

interface ActiveMatch {
  match_id: string;
  score: number;
  a_matching_number: string;
  a_nickname: string;
  b_matching_number: string;
  b_nickname: string;
}

type Phase = "idle" | "previewing" | "previewed" | "committing" | "committed" | "error";

const GENDER_LABEL: Record<string, string> = { male: "남성", female: "여성", other: "기타" };

function friendlyMatchingError(message?: string): string {
  if (!message) return "요청에 실패했어요.";
  if (message.includes("ACTIVE_PREVIEW_EXISTS")) {
    return "아직 확정하지 않은 이전 미리보기가 남아있어요. 아래 '초기화하고 다시 계산'을 눌러주세요.";
  }
  return message;
}

async function sendMatchNotification(eventId: string): Promise<{ ok: boolean; error?: string }> {
  if (!supabase) return { ok: false, error: "서버에 연결할 수 없어요." };
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return { ok: false, error: "로그인 세션이 만료됐어요. 다시 로그인해주세요." };
  try {
    const res = await fetch("/api/send-push", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({
        event_id: eventId,
        title: "매칭 결과가 도착했어요",
        body: "지금 앱을 열어 결과를 확인해 보세요",
        url: "/result",
      }),
    });
    if (!res.ok) {
      const detail = await res.json().catch(() => null);
      return { ok: false, error: detail?.error ?? `요청 실패 (${res.status})` };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "알 수 없는 오류" };
  }
}

/** 문서03 §5 POST /admin/matching-runs/preview·commit 실제 연동. */
export function MatchingRunPanel() {
  const { eventId } = useEventSession();
  const [phase, setPhase] = useState<Phase>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [previewResult, setPreviewResult] = useState<PreviewResult | null>(null);
  const [commitResult, setCommitResult] = useState<CommitResult | null>(null);
  const [waiting, setWaiting] = useState<WaitingParticipant[]>([]);
  const [pendingPick, setPendingPick] = useState<string | null>(null);
  const [manualMatching, setManualMatching] = useState(false);
  const [notificationSent, setNotificationSent] = useState(false);
  const [notifying, setNotifying] = useState(false);
  const [notifyError, setNotifyError] = useState<string | null>(null);
  const [testNotifying, setTestNotifying] = useState(false);
  const [testNotifyResult, setTestNotifyResult] = useState<string | null>(null);
  const [exportingMatches, setExportingMatches] = useState(false);
  const [exportingParticipants, setExportingParticipants] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [quickRunning, setQuickRunning] = useState(false);
  const [discardingPreview, setDiscardingPreview] = useState(false);
  const [activeMatches, setActiveMatches] = useState<ActiveMatch[]>([]);
  const [unmatchingId, setUnmatchingId] = useState<string | null>(null);

  const loadWaiting = useCallback(async () => {
    if (!supabase || !eventId) return;
    const { data } = await supabase.rpc("admin_list_waiting_participants", { p_event_id: eventId });
    if (data) setWaiting((data as WaitingParticipant[]).filter((p) => p.active_match_count === 0));
  }, [eventId]);

  const loadActiveMatches = useCallback(async () => {
    if (!supabase || !eventId) return;
    const { data } = await supabase.rpc("admin_list_active_matches", { p_event_id: eventId });
    if (data) setActiveMatches(data as ActiveMatch[]);
  }, [eventId]);

  useEffect(() => {
    loadWaiting();
    loadActiveMatches();
  }, [loadWaiting, loadActiveMatches]);

  const genderBreakdown = ["male", "female", "other"]
    .map((code) => ({ code, label: GENDER_LABEL[code], count: waiting.filter((p) => p.gender_code === code).length }))
    .filter((g) => g.count > 0);
  const genderTotal = waiting.length;

  const notifyAfterCommit = async () => {
    if (!eventId) return;
    setNotifying(true);
    setNotifyError(null);
    const result = await sendMatchNotification(eventId);
    setNotifying(false);
    if (result.ok) {
      setNotificationSent(true);
    } else {
      setNotifyError(result.error ?? "알 수 없는 오류");
    }
  };

  const runPreview = async () => {
    if (!supabase || !eventId) return;
    setPhase("previewing");
    setErrorMessage(null);
    const { data, error } = await supabase.rpc("admin_run_matching_preview", { p_event_id: eventId });
    if (error || !data) {
      setErrorMessage(error?.message ?? "미리보기 계산에 실패했어요.");
      setPhase("error");
      return;
    }
    setPreviewResult(data as PreviewResult);
    setPhase("previewed");
  };

  const commit = async () => {
    if (!supabase || !previewResult) return;
    setPhase("committing");
    setErrorMessage(null);
    const { data, error } = await supabase.rpc("admin_commit_matching_run_with_fallback", { p_run_id: previewResult.run_id });
    if (error || !data) {
      setErrorMessage(error?.message ?? "확정에 실패했어요.");
      setPhase("error");
      return;
    }
    setCommitResult(data as CommitResult);
    setPhase("committed");
    setNotificationSent(false);
    loadWaiting();
    loadActiveMatches();
    if (eventId) void notifyAfterCommit();
  };

  /** "지금 바로 매칭 실행" — 미리보기 검토 없이 미리보기+확정을 한 번에 처리한다. */
  const runQuickMatch = async () => {
    if (!supabase || !eventId) return;
    setQuickRunning(true);
    setErrorMessage(null);
    setPhase("previewing");
    const { data: preview, error: previewError } = await supabase.rpc("admin_run_matching_preview", { p_event_id: eventId });
    if (previewError || !preview) {
      setErrorMessage(previewError?.message ?? "미리보기 계산에 실패했어요.");
      setPhase("error");
      setQuickRunning(false);
      return;
    }
    const previewData = preview as PreviewResult;
    setPreviewResult(previewData);
    setPhase("committing");
    const { data: committed, error: commitError } = await supabase.rpc("admin_commit_matching_run_with_fallback", {
      p_run_id: previewData.run_id,
    });
    setQuickRunning(false);
    if (commitError || !committed) {
      setErrorMessage(commitError?.message ?? "확정에 실패했어요.");
      setPhase("error");
      return;
    }
    setCommitResult(committed as CommitResult);
    setPhase("committed");
    setNotificationSent(false);
    loadWaiting();
    loadActiveMatches();
    void notifyAfterCommit();
  };

  const reset = () => {
    setPhase("idle");
    setPreviewResult(null);
    setCommitResult(null);
    setErrorMessage(null);
  };

  /** ACTIVE_PREVIEW_EXISTS 복구용 — 확정도 폐기도 안 된 이전 미리보기를 정리하고 다시 계산한다. */
  const discardAndRetry = async () => {
    if (!supabase || !eventId) return;
    setDiscardingPreview(true);
    const { error } = await supabase.rpc("admin_discard_active_preview", { p_event_id: eventId });
    setDiscardingPreview(false);
    if (error) {
      setErrorMessage(error.message);
      return;
    }
    await runPreview();
  };

  const pickForManualMatch = async (id: string) => {
    if (pendingPick === null) {
      setPendingPick(id);
      return;
    }
    if (pendingPick === id) {
      setPendingPick(null);
      return;
    }
    if (!supabase || !eventId) return;
    setManualMatching(true);
    const { error } = await supabase.rpc("admin_manual_match", { p_event_id: eventId, p_participant_a: pendingPick, p_participant_b: id });
    setPendingPick(null);
    setManualMatching(false);
    if (!error) {
      await loadWaiting();
      await loadActiveMatches();
    }
  };

  const unmatch = async (matchId: string) => {
    if (!supabase || !eventId) return;
    setUnmatchingId(matchId);
    const { error } = await supabase.rpc("admin_unmatch", { p_event_id: eventId, p_match_id: matchId });
    setUnmatchingId(null);
    if (!error) {
      await loadWaiting();
      await loadActiveMatches();
    }
  };

  const sendTestNotification = async () => {
    if (!eventId || !supabase) return;
    setTestNotifying(true);
    setTestNotifyResult(null);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) throw new Error("로그인 세션이 만료됐어요. 다시 로그인해주세요.");
      const res = await fetch("/api/send-push", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({
          event_id: eventId,
          title: "[테스트] 알림 점검",
          body: "이 알림이 보이면 푸시 알림이 정상 작동하는 거예요.",
          url: "/waiting",
        }),
      });
      const detail = await res.json().catch(() => null);
      if (!res.ok) throw new Error(detail?.error ?? `요청 실패 (${res.status})`);
      setTestNotifyResult(`발송 완료 — 대상 ${detail?.total ?? 0}건 중 성공 ${detail?.sent ?? 0}건`);
    } catch (err) {
      setTestNotifyResult(`실패: ${err instanceof Error ? err.message : "알 수 없는 오류"}`);
    } finally {
      setTestNotifying(false);
    }
  };

  const exportMatches = async () => {
    if (!supabase || !eventId) return;
    setExportingMatches(true);
    setExportError(null);
    const { data, error } = await supabase.rpc("admin_export_matches", { p_event_id: eventId });
    setExportingMatches(false);
    if (error) {
      setExportError(error.message ?? "매칭 결과를 내보내지 못했어요.");
      return;
    }
    const rows = (data ?? []) as MatchExportRow[];
    const csv = toCsv(
      rows.map((r) => ({ ...r, a_gender: GENDER_LABEL[r.a_gender] ?? r.a_gender, b_gender: GENDER_LABEL[r.b_gender] ?? r.b_gender })),
      [
        { key: "a_matching_number", label: "매칭번호(A)" },
        { key: "a_name", label: "이름(A)" },
        { key: "a_gender", label: "성별(A)" },
        { key: "a_department", label: "학과(A)" },
        { key: "a_phone", label: "전화번호(A)" },
        { key: "b_matching_number", label: "매칭번호(B)" },
        { key: "b_name", label: "이름(B)" },
        { key: "b_gender", label: "성별(B)" },
        { key: "b_department", label: "학과(B)" },
        { key: "b_phone", label: "전화번호(B)" },
      ],
    );
    downloadCsv(`매칭결과_${new Date().toISOString().slice(0, 10)}.csv`, csv);
  };

  const exportParticipants = async () => {
    if (!supabase || !eventId) return;
    setExportingParticipants(true);
    setExportError(null);
    const { data, error } = await supabase.rpc("admin_export_participants", { p_event_id: eventId });
    setExportingParticipants(false);
    if (error) {
      setExportError(error.message ?? "참가자 명단을 내보내지 못했어요.");
      return;
    }
    const rows = (data ?? []) as ParticipantExportRow[];
    const csv = toCsv(rows, [
      { key: "matching_number", label: "매칭번호" },
      { key: "status", label: "상태" },
      { key: "nickname", label: "닉네임" },
      { key: "department", label: "학과" },
      { key: "grade", label: "학년" },
      { key: "gender_code", label: "성별" },
      { key: "mbti", label: "MBTI" },
      { key: "one_liner", label: "한마디" },
      { key: "seeking_gender_codes", label: "희망성별" },
      { key: "self_traits", label: "성격태그" },
      { key: "desired_traits", label: "선호성격" },
      { key: "interests", label: "관심사" },
      { key: "activities", label: "희망활동" },
      { key: "food_tags", label: "음식" },
      { key: "music_tags", label: "음악" },
      { key: "conversation_style", label: "연락스타일" },
      { key: "instagram_handle", label: "인스타그램ID" },
      { key: "phone_number", label: "전화번호" },
      { key: "submitted_at", label: "제출시각" },
    ]);
    downloadCsv(`전체참가자_${new Date().toISOString().slice(0, 10)}.csv`, csv);
  };

  const maxBucket = previewResult ? Math.max(1, ...Object.values(previewResult.score_distribution)) : 1;
  const fallbackCommitted = commitResult?.fallback?.committed_count ?? 0;
  const rescueCommitted = commitResult?.rescue?.committed?.committed_count ?? 0;

  return (
    <section className="matching-run">
      <div className="admin__section-head">
        <h2>매칭 실행</h2>
        <span className="admin__section-hint">algorithm mutual-v1.0.0 · 대기 {waiting.length}명</span>
      </div>

      <div className="matching-run__export" data-tutorial="export-buttons">
        <Button variant="ghost" loading={exportingParticipants} onClick={exportParticipants}>
          전체 참가자 내보내기(CSV) — 매칭 실패 대비
        </Button>
        <Button variant="ghost" loading={exportingMatches} onClick={exportMatches}>
          매칭 결과 내보내기(CSV) — 총학 전달용
        </Button>
        <Button variant="ghost" loading={testNotifying} onClick={sendTestNotification}>
          테스트 알림 보내기
        </Button>
      </div>
      {exportError ? <p className="matching-run__notify-error">{exportError}</p> : null}
      {testNotifyResult ? <p className="admin__section-hint">{testNotifyResult}</p> : null}

      {genderTotal > 0 ? (
        <div className="matching-run__gender">
          <span className="matching-run__gender-title">대기 중 성별 구성</span>
          <div className="matching-run__gender-bar">
            {genderBreakdown.map((g) => (
              <div key={g.code} className="matching-run__gender-seg" style={{ width: `${(g.count / genderTotal) * 100}%` }} title={g.label} />
            ))}
          </div>
          <div className="matching-run__gender-legend">
            {genderBreakdown.map((g) => (
              <span key={g.code}>
                {g.label} {g.count}명
              </span>
            ))}
          </div>
        </div>
      ) : (
        <p className="admin__section-hint">지금 대기 중인 참가자가 없어요.</p>
      )}

      {errorMessage ? (
        <div className="matching-run__idle">
          <p className="matching-run__notify-error">{friendlyMatchingError(errorMessage)}</p>
          {errorMessage.includes("ACTIVE_PREVIEW_EXISTS") ? (
            <Button variant="ghost" loading={discardingPreview} onClick={discardAndRetry}>
              초기화하고 다시 계산
            </Button>
          ) : null}
        </div>
      ) : null}

      {phase === "idle" || phase === "previewing" ? (
        <div className="matching-run__idle">
          <p>대기 중인 참가자 전체를 다시 계산해서 후보 매치를 미리 보여줘요. 아직 DB에는 아무것도 쓰지 않아요.</p>
          <div className="matching-run__actions">
            <Button
              variant="primary"
              loading={phase === "previewing" && !quickRunning}
              disabled={waiting.length < 2}
              onClick={runPreview}
              data-tutorial="preview-button"
            >
              미리보기 계산하기
            </Button>
            <Button variant="ghost" loading={quickRunning} disabled={waiting.length < 2} onClick={runQuickMatch}>
              지금 바로 매칭 실행(검토 없이 즉시 확정)
            </Button>
          </div>
        </div>
      ) : null}

      {previewResult && phase !== "idle" ? (
        <div className="matching-run__result">
          <div className="admin__stats matching-run__stats">
            <div className="admin__stat-card">
              <span className="admin__stat-value tabular-nums">{previewResult.input_count}</span>
              <span className="admin__stat-label">입력 인원</span>
            </div>
            <div className="admin__stat-card">
              <span className="admin__stat-value tabular-nums">{previewResult.proposed_match_count}</span>
              <span className="admin__stat-label">제안된 매치</span>
            </div>
            <div className="admin__stat-card">
              <span className="admin__stat-value tabular-nums">{previewResult.unmatched_count}</span>
              <span className="admin__stat-label">미매칭(1차)</span>
            </div>
          </div>

          <h3 className="matching-run__subtitle">점수 분포</h3>
          <div className="matching-run__distribution">
            {Object.entries(previewResult.score_distribution).map(([bucket, count]) => (
              <div key={bucket} className="matching-run__dist-col">
                <div className="matching-run__dist-bar" style={{ height: `${(count / maxBucket) * 100}%` }} />
                <span className="matching-run__dist-count tabular-nums">{count}</span>
                <span className="matching-run__dist-label">{bucket}</span>
              </div>
            ))}
          </div>

          {phase === "previewed" ? (
            <div className="matching-run__actions">
              <Button variant="ghost" onClick={reset}>
                다시 계산
              </Button>
              <Button variant="primary" onClick={commit}>
                이 결과로 확정하기(fallback·구제 자동 포함)
              </Button>
            </div>
          ) : null}

          {phase === "committing" ? (
            <div className="matching-run__committed">
              <p>확정하는 중이에요… (임계값 완화 2차, 복수매칭 3차까지 서버에서 자동으로 이어서 실행돼요)</p>
            </div>
          ) : null}

          {phase === "committed" && commitResult ? (
            <div className="matching-run__committed">
              <span className="matching-run__committed-badge">1차 확정 · {commitResult.committed_count}쌍</span>
              {commitResult.fallback_ran ? (
                <p>2차(임계값 완화)에서 {fallbackCommitted}쌍 추가로 확정됐어요.</p>
              ) : (
                <p>2차 패스는 실행되지 않았어요(남은 인원 부족).</p>
              )}
              {rescueCommitted > 0 ? <p>3차(복수매칭 구제)에서 {rescueCommitted}명이 추가로 구제됐어요.</p> : null}
              <Button variant="ghost" onClick={reset}>
                새로 계산하기
              </Button>
            </div>
          ) : null}

          {phase === "committed" && waiting.length > 0 ? (
            <div className="matching-run__manual">
              <h3 className="matching-run__subtitle">수동 매칭 — 아직 짝을 못 찾은 {waiting.length}명</h3>
              <p className="matching-run__manual-hint">
                두 명을 골라 직접 짝을 지어주세요. {pendingPick ? "상대를 한 명 더 선택하세요." : "먼저 한 명을 선택하세요."}
              </p>
              <ul className="matching-run__manual-list">
                {waiting.map((p) => (
                  <li key={p.participant_id}>
                    <button
                      type="button"
                      disabled={manualMatching}
                      className={`matching-run__manual-row${pendingPick === p.participant_id ? " is-picked" : ""}`}
                      onClick={() => pickForManualMatch(p.participant_id)}
                    >
                      <span className="matching-run__manual-name">
                        {p.matching_number} · {p.nickname}
                      </span>
                      <span className="matching-run__manual-meta">
                        {p.department} · {p.grade}학년 · {GENDER_LABEL[p.gender_code]}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {phase === "committed" ? (
            <div className="matching-run__notify">
              <h3 className="matching-run__subtitle">일괄 알림</h3>
              {notifying ? (
                <p>확정된 매칭 참가자에게 알림을 보내는 중이에요…</p>
              ) : notificationSent ? (
                <p>매칭 확정과 함께 일괄 알림을 보냈어요.</p>
              ) : (
                <>
                  {notifyError ? <p className="matching-run__notify-error">발송 실패: {notifyError}</p> : null}
                  <Button variant="primary" loading={notifying} onClick={notifyAfterCommit}>
                    지금 다시 알림 보내기
                  </Button>
                </>
              )}
            </div>
          ) : null}
        </div>
      ) : null}

      {activeMatches.length > 0 ? (
        <div className="matching-run__unmatch">
          <h3 className="matching-run__subtitle">지금 확정된 매칭 — {activeMatches.length}쌍</h3>
          <p className="matching-run__manual-hint">잘못 매칭된 경우 여기서 해제할 수 있어요. 해제하면 두 사람 모두 다시 대기 상태가 돼요.</p>
          <ul className="matching-run__manual-list">
            {activeMatches.map((m) => (
              <li key={m.match_id}>
                <div className="matching-run__unmatch-row">
                  <span className="matching-run__manual-name">
                    {m.a_matching_number} {m.a_nickname} ↔ {m.b_matching_number} {m.b_nickname}
                  </span>
                  <Button variant="danger-ghost" loading={unmatchingId === m.match_id} onClick={() => unmatch(m.match_id)}>
                    매칭 해제
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
