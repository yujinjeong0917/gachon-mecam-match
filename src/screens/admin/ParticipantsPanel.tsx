import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge } from "../../components/Badge";
import { Button } from "../../components/Button";
import { useEventSession } from "../../hooks/useEventSession";
import { supabase } from "../../lib/supabase";

interface ParticipantRow {
  participant_id: string;
  matching_number: string;
  nickname: string;
  department: string;
  grade: number;
  gender_code: "male" | "female" | "other";
  status: string;
  submitted_at: string;
  active_match_count: number;
}

const GENDER_LABEL: Record<string, string> = { male: "남성", female: "여성", other: "기타" };
const STATUS_LABEL: Record<string, string> = { waiting: "대기", matched: "매칭완료", withdrawn: "탈퇴", cancelled: "취소", draft: "임시" };

/** 총학·운영진 요청: 참가자를 검색하고, 필요하면 정보를 완전히 삭제할 수 있는 화면. */
export function ParticipantsPanel() {
  const { eventId } = useEventSession();
  const [rows, setRows] = useState<ParticipantRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!supabase || !eventId) return;
    const { data, error: rpcError } = await supabase.rpc("admin_list_all_participants", { p_event_id: eventId });
    if (rpcError) {
      setError(rpcError.message);
    } else {
      setRows((data ?? []) as ParticipantRow[]);
      setError(null);
    }
    setLoading(false);
  }, [eventId]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => r.matching_number.toLowerCase().includes(q) || r.nickname.toLowerCase().includes(q));
  }, [rows, query]);

  const deleteParticipant = async (participantId: string) => {
    if (!supabase || !eventId) return;
    setDeletingId(participantId);
    const { error: rpcError } = await supabase.rpc("admin_delete_participant", { p_event_id: eventId, p_participant_id: participantId });
    setDeletingId(null);
    setConfirmingId(null);
    if (rpcError) {
      setError(rpcError.message);
      return;
    }
    await load();
  };

  return (
    <section className="admin__queue participants-panel">
      <div className="admin__section-head">
        <h2>참가자 관리</h2>
        <span className="admin__section-hint">총 {rows.length}명</span>
      </div>

      <input
        className="queue-panel__search"
        placeholder="매칭번호 또는 닉네임으로 검색"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      {error ? <p className="matching-run__notify-error">{error}</p> : null}

      {loading ? (
        <p className="admin__section-hint">불러오는 중…</p>
      ) : (
        <div className="participants-panel__table-wrap">
          <table>
            <thead>
              <tr>
                <th>매칭번호</th>
                <th>닉네임</th>
                <th>학과</th>
                <th>학년</th>
                <th>성별</th>
                <th>상태</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => (
                <tr key={row.participant_id}>
                  <td>{row.matching_number}</td>
                  <td>{row.nickname}</td>
                  <td>{row.department}</td>
                  <td>{row.grade}학년</td>
                  <td>{GENDER_LABEL[row.gender_code]}</td>
                  <td>
                    <Badge tone={row.status === "matched" ? "neutral" : "amber"}>{STATUS_LABEL[row.status] ?? row.status}</Badge>
                  </td>
                  <td>
                    {confirmingId === row.participant_id ? (
                      <span className="participants-panel__confirm">
                        <span>정말 삭제할까요?</span>
                        <Button variant="ghost" onClick={() => setConfirmingId(null)}>
                          취소
                        </Button>
                        <Button
                          variant="danger-ghost"
                          loading={deletingId === row.participant_id}
                          onClick={() => deleteParticipant(row.participant_id)}
                        >
                          삭제
                        </Button>
                      </span>
                    ) : (
                      <Button variant="danger-ghost" onClick={() => setConfirmingId(row.participant_id)}>
                        삭제
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="queue-panel__empty">
                    검색 결과가 없어요.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
