const FUNNEL_STAGES = [
  { key: "landing_view", label: "시작", count: 112 },
  { key: "submit_success", label: "제출 성공", count: 84 },
  { key: "waiting", label: "대기", count: 45 },
  { key: "matched", label: "매칭", count: 39 },
  { key: "result_view", label: "결과 열람", count: 35 },
  { key: "cheatkey_unlocked", label: "치트키 해제", count: 21 },
];

/** 문서01 §6 접수 퍼널 6단계. 문서05 §4 핵심 퍼널 지표를 참가자 수 기준 막대로 단순화했다. */
export function FunnelPanel() {
  const first = FUNNEL_STAGES[0].count;

  return (
    <section className="funnel">
      <div className="admin__section-head">
        <h2>접수 퍼널</h2>
        <span className="admin__section-hint">시작 대비 비율 · 이전 단계 대비 전환율</span>
      </div>

      <div className="funnel__bars">
        {FUNNEL_STAGES.map((stage, i) => {
          const prev = i > 0 ? FUNNEL_STAGES[i - 1].count : null;
          const ofFirst = Math.round((stage.count / first) * 100);
          const stepRate = prev ? Math.round((stage.count / prev) * 100) : null;

          return (
            <div key={stage.key} className="funnel__row">
              <span className="funnel__label">{stage.label}</span>
              <div className="funnel__track">
                <div className="funnel__fill" style={{ width: `${ofFirst}%` }} />
              </div>
              <span className="funnel__count tabular-nums">{stage.count}</span>
              <span className="funnel__rate tabular-nums">{stepRate !== null ? `${stepRate}%` : "—"}</span>
            </div>
          );
        })}
      </div>

      <p className="funnel__note">제출 실패율, 단계별 이탈은 GA4 Realtime과 함께 확인하세요(문서05 §7).</p>
    </section>
  );
}
