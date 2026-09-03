import { useCallback, useEffect, useState } from "react";
import { Badge } from "../../components/Badge";
import { Button } from "../../components/Button";
import { useEventSession } from "../../hooks/useEventSession";
import { supabase } from "../../lib/supabase";

interface QueueRow {
  match_id: string;
  viewer_participant_id: string;
  viewer_matching_number: string;
  viewer_nickname: string;
}

/**
 * 문서01 §6: "검색은 MATCHING NUMBER·복구 코드만 기본 검색"에 맞춰 코드 기준 검색만 둔다.
 * 지금 실제로 백엔드가 있는 대기열은 "팔로우 확인"뿐이다(admin_list_cheatkey_queue).
 * 코드 복구·신고·재배정은 아직 스키마 자체가 없어 대기열에 넣지 않는다.
 */
export function QueuePanel() {
  const { eventId } = useEventSession();
  const [rows, setRows] = useState<QueueRow[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [approving, setApproving] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!supabase || !eventId) return;
    const { data } = await supabase.rpc("admin_list_cheatkey_queue", { p_event_id: eventId });
    if (data) setRows(data as QueueRow[]);
    setLoading(false);
  }, [eventId]);

  useEffect(() => {
    load();
    const id = window.setInterval(load, 15000);
    return () => window.clearInterval(id);
  }, [load]);

  const approve = async (row: QueueRow) => {
    if (!supabase || !eventId) return;
    setApproving(row.match_id);
    await supabase.rpc("admin_unlock_cheatkey", {
      p_event_id: eventId,
      p_match_id: row.match_id,
      p_viewer_participant_id: row.viewer_participant_id,
    });
    await load();
    setApproving(null);
  };

  const filtered = rows.filter(
    (row) => query.trim() === "" || row.viewer_matching_number.toLowerCase().includes(query.trim().toLowerCase()),
  );

  return (
    <section className="admin__queue queue-panel">
      <div className="admin__section-head">
        <h2>운영 대기열 — 팔로우 확인</h2>
        <span className="admin__section-hint">MATCHING NUMBER로 검색</span>
      </div>

      <div className="queue-panel__controls">
        <input
          className="queue-panel__search"
          type="text"
          placeholder="예: M-027"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <table>
        <thead>
          <tr>
            <th>코드</th>
            <th>닉네임</th>
            <th>상태</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((row) => (
            <tr key={row.match_id}>
              <td>{row.viewer_matching_number}</td>
              <td>{row.viewer_nickname}</td>
              <td>
                <Badge tone="amber">확인 대기</Badge>
              </td>
              <td>
                <Button variant="ghost" loading={approving === row.match_id} onClick={() => approve(row)}>
                  승인
                </Button>
              </td>
            </tr>
          ))}
          {!loading && filtered.length === 0 ? (
            <tr>
              <td colSpan={4} className="queue-panel__empty">
                조건에 맞는 항목이 없어요.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </section>
  );
}
