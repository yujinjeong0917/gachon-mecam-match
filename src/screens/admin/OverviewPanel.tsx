import { useEffect, useState } from "react";
import { Badge } from "../../components/Badge";
import { useEventSession } from "../../hooks/useEventSession";
import { supabase } from "../../lib/supabase";

interface Overview {
  total_participants: number;
  waiting: number;
  matched: number;
  registration_open: boolean;
  result_reveal_enabled: boolean;
  fallback_mode: boolean;
}

interface QueueRow {
  match_id: string;
  viewer_matching_number: string;
  viewer_nickname: string;
}

/** 문서01 §6 "서비스 상태" + 핵심 숫자를 한눈에. admin_overview / admin_list_cheatkey_queue RPC로 실데이터를 가져온다. */
export function OverviewPanel() {
  const { eventId } = useEventSession();
  const [overview, setOverview] = useState<Overview | null>(null);
  const [queue, setQueue] = useState<QueueRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!supabase || !eventId) return;
    let cancelled = false;

    async function load() {
      if (!supabase || !eventId) return;
      const [{ data: overviewData }, { data: queueData }] = await Promise.all([
        supabase.rpc("admin_overview", { p_event_id: eventId }),
        supabase.rpc("admin_list_cheatkey_queue", { p_event_id: eventId }),
      ]);
      if (cancelled) return;
      if (overviewData) setOverview(overviewData as Overview);
      if (queueData) setQueue(queueData as QueueRow[]);
      setLoading(false);
    }

    load();
    const id = window.setInterval(load, 20000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [eventId]);

  if (loading || !overview) {
    return <p className="admin__section-hint">불러오는 중…</p>;
  }

  const stats = [
    { label: "총 제출", value: overview.total_participants },
    { label: "대기 중", value: overview.waiting },
    { label: "매칭 완료", value: overview.matched },
    { label: "확인 대기", value: queue.length },
  ];

  return (
    <>
      <section className="admin__stats">
        {stats.map((stat) => (
          <div key={stat.label} className="admin__stat-card">
            <span className="admin__stat-value tabular-nums">{stat.value}</span>
            <span className="admin__stat-label">{stat.label}</span>
          </div>
        ))}
      </section>

      <section className="admin__queue">
        <div className="admin__section-head">
          <h2>지금 확인이 필요해요</h2>
          <span className="admin__section-hint">운영 대기열 탭에서 승인 처리</span>
        </div>
        <table>
          <thead>
            <tr>
              <th>코드</th>
              <th>닉네임</th>
              <th>상태</th>
            </tr>
          </thead>
          <tbody>
            {queue.map((row) => (
              <tr key={row.match_id}>
                <td>{row.viewer_matching_number}</td>
                <td>{row.viewer_nickname}</td>
                <td>
                  <Badge tone="amber">팔로우 확인 대기</Badge>
                </td>
              </tr>
            ))}
            {queue.length === 0 ? (
              <tr>
                <td colSpan={3} className="queue-panel__empty">
                  지금은 확인할 게 없어요.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>
    </>
  );
}
