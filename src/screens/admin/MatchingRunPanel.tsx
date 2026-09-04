import { useCallback, useEffect, useState } from "react";
import { Button } from "../../components/Button";
import { useEventSession } from "../../hooks/useEventSession";
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

type Phase = "idle" | "previewing" | "previewed" | "committing" | "committed" | "error";

const GENDER_LABEL: Record<string, string> = { male: "남성", female: "여성", other: "기타" };

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

  const loadWaiting = useCallback(async () => {
    if (!supabase || !eventId) return;
    const { data } = await supabase.rpc("admin_list_waiting_participants", { p_event_id: eventId });
    if (data) setWaiting((data as WaitingParticipant[]).filter((p) => p.active_match_count === 0));
  }, [eventId]);

  useEffect(() => {
    loadWaiting();
  }, [loadWaiting]);

  const genderBreakdown = ["male", "female", "other"]
    .map((code) => ({ code, label: GENDER_LABEL[code], count: waiting.filter((p) => p.gender_code === code).length }))
    .filter((g) => g.count > 0);
  const genderTotal = waiting.length;

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
    loadWaiting();
  };

  const reset = () => {
    setPhase("idle");
    setPreviewResult(null);
    setCommitResult(null);
    setErrorMessage(null);
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
    if (!error) await loadWaiting();
  };

  const sendBulkNotification = async () => {
    if (!eventId) return;
    setNotifying(true);
    setNotifyError(null);
    try {
      const res = await fetch("/api/send-push", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-token": import.meta.env.VITE_ADMIN_NOTIFY_SECRET as string,
        },
        body: JSON.stringify({
          event_id: eventId,
          title: "매칭 결과가 도착했어요",
          body: "지금 앱을 열어 결과를 확인해 보세요",
          url: "/result",
        }),
      });
      if (!res.ok) {
        const detail = await res.json().catch(() => null);
        throw new Error(detail?.error ?? `요청 실패 (${res.status})`);
      }
      setNotificationSent(true);
    } catch (err) {
      setNotifyError(err instanceof Error ? err.message : "알 수 없는 오류");
    } finally {
      setNotifying(false);
    }
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

      {errorMessage ? <p className="matching-run__notify-error">{errorMessage}</p> : null}

      {phase === "idle" || phase === "previewing" ? (
        <div className="matching-run__idle">
          <p>대기 중인 참가자 전체를 다시 계산해서 후보 매치를 미리 보여줘요. 아직 DB에는 아무것도 쓰지 않아요.</p>
          <Button variant="primary" loading={phase === "previewing"} disabled={waiting.length < 2} onClick={runPreview}>
            미리보기 계산하기
          </Button>
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
              {notificationSent ? (
                <p>일괄 알림을 보냈어요.</p>
              ) : (
                <>
                  <p>매칭 결과를 확인한 참가자에게 일괄로 알려요(Web Push).</p>
                  {notifyError ? <p className="matching-run__notify-error">발송 실패: {notifyError}</p> : null}
                  <Button variant="primary" loading={notifying} onClick={sendBulkNotification}>
                    지금 일괄 알림 보내기
                  </Button>
                </>
              )}
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
