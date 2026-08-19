import { useEffect, useState } from "react";
import { Button } from "../../components/Button";

type RunStatus =
  | "idle"
  | "previewing"
  | "previewed"
  | "committing"
  | "committed_primary"
  | "running_fallback"
  | "running_rescue"
  | "done";

const SCORE_DISTRIBUTION: Array<[string, number]> = [
  ["50-59", 8],
  ["60-69", 12],
  ["70-79", 11],
  ["80-89", 6],
  ["90-100", 2],
];

const PREVIEW_RESULT = {
  inputCount: 84,
  proposedMatchCount: 39,
  unmatchedCount: 6,
};

// 대기 중 참가자의 성별·희망 성별 구성. 한쪽으로 쏠려 있으면 임계값을 낮춰도 못 맞는 사람이 남는다.
const GENDER_BREAKDOWN = [
  { label: "남성 희망", count: 19 },
  { label: "여성 희망", count: 23 },
  { label: "성별 무관", count: 3 },
];

const FALLBACK_MIN_SCORE = 35;
const FALLBACK_MATCHED_PAIRS = 2; // 6명 미매칭 중 2쌍(4명)은 구제

const RESCUE_MIN_SCORE = 30;
const RESCUE_MATCHED_COUNT = 1; // 성비 불균형으로 혼자 남은 1명은 이미 매칭된 사람과 복수매칭(최대 2인)으로 구제

// 그래도 끝내 조건이 맞는 상대가 없어 수동 매칭이 필요한 사람들.
const MOCK_STILL_UNMATCHED = [
  { id: "p-041", nickname: "차가운달", department: "약학과", grade: 3, seekingGender: "여성" },
  { id: "p-067", nickname: "늦은오후", department: "치위생학과", grade: 2, seekingGender: "남성" },
];

/** 문서03 §5 POST /admin/matching-runs/preview·commit 응답 형태를 그대로 따른 모의 플로우. */
export function MatchingRunPanel() {
  const [status, setStatus] = useState<RunStatus>("idle");
  const [manuallyMatched, setManuallyMatched] = useState<string[]>([]);
  const [pendingPick, setPendingPick] = useState<string | null>(null);
  const [notificationSent, setNotificationSent] = useState(false);
  const maxBucket = Math.max(...SCORE_DISTRIBUTION.map(([, count]) => count));
  const genderTotal = GENDER_BREAKDOWN.reduce((sum, g) => sum + g.count, 0);

  const runPreview = () => {
    setStatus("previewing");
    window.setTimeout(() => setStatus("previewed"), 700);
  };

  const commit = () => {
    setStatus("committing");
    window.setTimeout(() => setStatus("committed_primary"), 700);
  };

  useEffect(() => {
    if (status !== "committed_primary") return;
    if (PREVIEW_RESULT.unmatchedCount === 0) {
      setStatus("done");
      return;
    }
    // 문서 정책: 임계값을 낮춰서 미매칭자만 대상으로 자동 2차 매칭을 한 번 더 돈다.
    const t1 = window.setTimeout(() => setStatus("running_fallback"), 500);
    return () => window.clearTimeout(t1);
  }, [status]);

  useEffect(() => {
    if (status !== "running_fallback") return;
    const t = window.setTimeout(() => setStatus("running_rescue"), 900);
    return () => window.clearTimeout(t);
  }, [status]);

  useEffect(() => {
    if (status !== "running_rescue") return;
    const t = window.setTimeout(() => setStatus("done"), 900);
    return () => window.clearTimeout(t);
  }, [status]);

  const afterFallback = PREVIEW_RESULT.unmatchedCount - FALLBACK_MATCHED_PAIRS * 2;
  const stillUnmatched = afterFallback - RESCUE_MATCHED_COUNT;
  const remainingForManualMatch = MOCK_STILL_UNMATCHED.filter((p) => !manuallyMatched.includes(p.id));

  const pickForManualMatch = (id: string) => {
    if (pendingPick === null) {
      setPendingPick(id);
      return;
    }
    if (pendingPick === id) {
      setPendingPick(null);
      return;
    }
    setManuallyMatched((prev) => [...prev, pendingPick, id]);
    setPendingPick(null);
  };

  return (
    <section className="matching-run">
      <div className="admin__section-head">
        <h2>매칭 실행</h2>
        <span className="admin__section-hint">3일간 접수 · 3일차 16:00 일괄 실행 · algorithm mutual-v1.0.0</span>
      </div>

      <div className="matching-run__gender">
        <span className="matching-run__gender-title">대기 중 희망 성별 비율</span>
        <div className="matching-run__gender-bar">
          {GENDER_BREAKDOWN.map((g) => (
            <div key={g.label} className="matching-run__gender-seg" style={{ width: `${(g.count / genderTotal) * 100}%` }} title={g.label} />
          ))}
        </div>
        <div className="matching-run__gender-legend">
          {GENDER_BREAKDOWN.map((g) => (
            <span key={g.label}>
              {g.label} {g.count}명
            </span>
          ))}
        </div>
      </div>

      {status === "idle" || status === "previewing" ? (
        <div className="matching-run__idle">
          <p>대기 중인 참가자 전체를 다시 계산해서 후보 매치를 미리 보여줘요. 아직 DB에는 아무것도 쓰지 않아요.</p>
          <Button variant="primary" loading={status === "previewing"} onClick={runPreview}>
            미리보기 계산하기
          </Button>
        </div>
      ) : null}

      {status !== "idle" && status !== "previewing" ? (
        <div className="matching-run__result">
          <div className="admin__stats matching-run__stats">
            <div className="admin__stat-card">
              <span className="admin__stat-value tabular-nums">{PREVIEW_RESULT.inputCount}</span>
              <span className="admin__stat-label">입력 인원</span>
            </div>
            <div className="admin__stat-card">
              <span className="admin__stat-value tabular-nums">{PREVIEW_RESULT.proposedMatchCount}</span>
              <span className="admin__stat-label">제안된 매치</span>
            </div>
            <div className="admin__stat-card">
              <span className="admin__stat-value tabular-nums">{PREVIEW_RESULT.unmatchedCount}</span>
              <span className="admin__stat-label">미매칭(1차)</span>
            </div>
          </div>

          <h3 className="matching-run__subtitle">점수 분포</h3>
          <div className="matching-run__distribution">
            {SCORE_DISTRIBUTION.map(([bucket, count]) => (
              <div key={bucket} className="matching-run__dist-col">
                <div className="matching-run__dist-bar" style={{ height: `${(count / maxBucket) * 100}%` }} />
                <span className="matching-run__dist-count tabular-nums">{count}</span>
                <span className="matching-run__dist-label">{bucket}</span>
              </div>
            ))}
          </div>

          {status === "previewed" ? (
            <div className="matching-run__actions">
              <Button variant="ghost" onClick={() => setStatus("idle")}>
                다시 계산
              </Button>
              <Button variant="primary" onClick={commit}>
                이 결과로 확정하기
              </Button>
            </div>
          ) : null}

          {status === "committing" ? (
            <div className="matching-run__committed">
              <p>확정하는 중이에요…</p>
            </div>
          ) : null}

          {status === "committed_primary" || status === "running_fallback" || status === "done" ? (
            <div className="matching-run__committed">
              <span className="matching-run__committed-badge">1차 확정 완료 · {PREVIEW_RESULT.proposedMatchCount}쌍</span>
              {PREVIEW_RESULT.unmatchedCount > 0 ? (
                <p>
                  미매칭 {PREVIEW_RESULT.unmatchedCount}명을 대상으로 임계값을 {FALLBACK_MIN_SCORE}점까지 낮춰 자동으로 한 번 더
                  돌려요. 이미 확정된 매치는 건드리지 않아요.
                </p>
              ) : null}
            </div>
          ) : null}

          {status === "running_fallback" ? (
            <div className="matching-run__committed matching-run__fallback">
              <p>2차(임계값 완화) 매칭 계산 중…</p>
            </div>
          ) : null}

          {status === "running_rescue" || status === "done" ? (
            <div className="matching-run__committed matching-run__fallback">
              <span className="matching-run__committed-badge">2차 확정 완료 · {FALLBACK_MATCHED_PAIRS}쌍 추가</span>
              <p>
                그래도 {afterFallback}명이 남으면, 성비 불균형으로 못 맞은 인원만 대상으로 임계값을 {RESCUE_MIN_SCORE}점까지
                낮춰 이미 매칭된 사람과 최대 2인까지 매칭하는 복수매칭 구제를 한 번 더 시도해요.
              </p>
            </div>
          ) : null}

          {status === "running_rescue" ? (
            <div className="matching-run__committed matching-run__fallback">
              <p>3차(복수매칭 구제) 매칭 계산 중…</p>
            </div>
          ) : null}

          {status === "done" ? (
            <div className="matching-run__committed matching-run__fallback">
              <span className="matching-run__committed-badge">3차(복수매칭 구제) 확정 완료 · {RESCUE_MATCHED_COUNT}명 구제</span>
              {stillUnmatched > 0 ? (
                <p>그래도 {stillUnmatched}명은 끝내 조건이 맞는 상대가 없었어요. 아래에서 직접 짝을 지어주세요.</p>
              ) : (
                <p>대기 중이던 전원이 매칭됐어요.</p>
              )}
              <Button variant="ghost" onClick={() => setStatus("idle")}>
                되돌리기
              </Button>
            </div>
          ) : null}

          {status === "done" && remainingForManualMatch.length > 0 ? (
            <div className="matching-run__manual">
              <h3 className="matching-run__subtitle">수동 매칭</h3>
              <p className="matching-run__manual-hint">
                두 명을 골라 직접 짝을 지어주세요. {pendingPick ? "상대를 한 명 더 선택하세요." : "먼저 한 명을 선택하세요."}
              </p>
              <ul className="matching-run__manual-list">
                {remainingForManualMatch.map((p) => (
                  <li key={p.id}>
                    <button
                      type="button"
                      className={`matching-run__manual-row${pendingPick === p.id ? " is-picked" : ""}`}
                      onClick={() => pickForManualMatch(p.id)}
                    >
                      <span className="matching-run__manual-name">{p.nickname}</span>
                      <span className="matching-run__manual-meta">
                        {p.department} · {p.grade}학년 · {p.seekingGender} 희망
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {status === "done" ? (
            <div className="matching-run__notify">
              <h3 className="matching-run__subtitle">일괄 알림</h3>
              {notificationSent ? (
                <p>17:00 일괄 알림을 보냈어요.</p>
              ) : (
                <>
                  <p>매칭 결과를 확인한 참가자에게 17:00에 일괄로 알려요.</p>
                  <Button variant="primary" onClick={() => setNotificationSent(true)}>
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
