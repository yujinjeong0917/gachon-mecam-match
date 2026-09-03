import { useEffect, useState } from "react";
import { useEventSession } from "../../hooks/useEventSession";
import { supabase } from "../../lib/supabase";

const STAGE_LABELS: { key: keyof Funnel; label: string }[] = [
  { key: "landing_view", label: "시작" },
  { key: "submit_success", label: "제출 성공" },
  { key: "waiting", label: "대기" },
  { key: "matched", label: "매칭" },
  { key: "result_view", label: "결과 열람" },
  { key: "cheatkey_unlocked", label: "치트키 해제" },
];

interface Funnel {
  landing_view: number;
  submit_success: number;
  waiting: number;
  matched: number;
  result_view: number;
  cheatkey_unlocked: number;
}

/** 문서01 §6 접수 퍼널 6단계. admin_get_funnel RPC로 실제 방문·제출·매칭·열람 수를 집계한다. */
export function FunnelPanel() {
  const { eventId } = useEventSession();
  const [funnel, setFunnel] = useState<Funnel | null>(null);

  useEffect(() => {
    if (!supabase || !eventId) return;
    let cancelled = false;
    const load = () => {
      supabase!.rpc("admin_get_funnel", { p_event_id: eventId }).then(({ data }) => {
        if (!cancelled && data) setFunnel(data as Funnel);
      });
    };
    load();
    const id = window.setInterval(load, 20000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [eventId]);

  if (!funnel) {
    return <p className="admin__section-hint">불러오는 중…</p>;
  }

  const first = Math.max(1, funnel.landing_view);

  return (
    <section className="funnel">
      <div className="admin__section-head">
        <h2>접수 퍼널</h2>
        <span className="admin__section-hint">시작 대비 비율 · 이전 단계 대비 전환율</span>
      </div>

      <div className="funnel__bars">
        {STAGE_LABELS.map((stage, i) => {
          const count = funnel[stage.key];
          const prevCount = i > 0 ? funnel[STAGE_LABELS[i - 1].key] : null;
          const ofFirst = Math.round((count / first) * 100);
          const stepRate = prevCount ? Math.round((count / prevCount) * 100) : null;

          return (
            <div key={stage.key} className="funnel__row">
              <span className="funnel__label">{stage.label}</span>
              <div className="funnel__track">
                <div className="funnel__fill" style={{ width: `${ofFirst}%` }} />
              </div>
              <span className="funnel__count tabular-nums">{count}</span>
              <span className="funnel__rate tabular-nums">{stepRate !== null ? `${stepRate}%` : "—"}</span>
            </div>
          );
        })}
      </div>

      <p className="funnel__note">"시작"·"결과 열람"은 익명 방문 수(중복 제거)만 세며, 개인 식별 정보는 저장하지 않습니다.</p>
    </section>
  );
}
