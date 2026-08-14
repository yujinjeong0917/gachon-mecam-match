import { useState } from "react";
import { Button } from "../../components/Button";

type RunStatus = "idle" | "previewing" | "previewed" | "committing" | "committed";

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

/** 문서03 §5 POST /admin/matching-runs/preview·commit 응답 형태를 그대로 따른 모의 플로우. */
export function MatchingRunPanel() {
  const [status, setStatus] = useState<RunStatus>("idle");
  const maxBucket = Math.max(...SCORE_DISTRIBUTION.map(([, count]) => count));

  const runPreview = () => {
    setStatus("previewing");
    window.setTimeout(() => setStatus("previewed"), 700);
  };

  const commit = () => {
    setStatus("committing");
    window.setTimeout(() => setStatus("committed"), 700);
  };

  return (
    <section className="matching-run">
      <div className="admin__section-head">
        <h2>매칭 실행</h2>
        <span className="admin__section-hint">5분 rolling batch · algorithm mutual-v1.0.0</span>
      </div>

      {status === "idle" || status === "previewing" ? (
        <div className="matching-run__idle">
          <p>대기 중인 참가자 전체를 다시 계산해서 후보 매치를 미리 보여줘요. 아직 DB에는 아무것도 쓰지 않아요.</p>
          <Button variant="primary" loading={status === "previewing"} onClick={runPreview}>
            미리보기 계산하기
          </Button>
        </div>
      ) : null}

      {status === "previewed" || status === "committing" || status === "committed" ? (
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
              <span className="admin__stat-label">미매칭</span>
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

          {status === "committed" ? (
            <div className="matching-run__committed">
              <span className="matching-run__committed-badge">확정 완료</span>
              <p>참가자 상태와 Sheets outbox가 하나의 트랜잭션으로 반영됐어요.</p>
              <Button variant="ghost" onClick={() => setStatus("idle")}>
                되돌리기
              </Button>
            </div>
          ) : (
            <div className="matching-run__actions">
              <Button variant="ghost" onClick={() => setStatus("idle")}>
                다시 계산
              </Button>
              <Button variant="primary" loading={status === "committing"} onClick={commit}>
                이 결과로 확정하기
              </Button>
            </div>
          )}
        </div>
      ) : null}
    </section>
  );
}
