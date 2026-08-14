import { useMemo, useState } from "react";
import { Badge } from "../../components/Badge";

const QUEUE_TYPES = ["전체", "팔로우 확인", "코드 복구", "신고", "재배정"] as const;

const QUEUE_ROWS = [
  { code: "M-027", type: "팔로우 확인", stage: "운영자 확인 대기", status: "주의" as const, waitedMin: 4 },
  { code: "M-014", type: "재배정", stage: "매칭 완료", status: "정상" as const, waitedMin: 0 },
  { code: "M-051", type: "코드 복구", stage: "복구 코드 요청", status: "정상" as const, waitedMin: 2 },
  { code: "M-009", type: "신고", stage: "신고 접수", status: "비상" as const, waitedMin: 11 },
  { code: "M-033", type: "재배정", stage: "재배정 요청", status: "주의" as const, waitedMin: 6 },
  { code: "M-041", type: "팔로우 확인", stage: "운영자 확인 대기", status: "주의" as const, waitedMin: 1 },
];

const STATUS_TONE: Record<string, "neutral" | "amber" | "warning"> = {
  정상: "neutral",
  주의: "amber",
  비상: "warning",
};

/** 문서01 §6: "검색은 MATCHING NUMBER·복구 코드만 기본 검색"에 맞춰 코드 기준 검색만 둔다. */
export function QueuePanel() {
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<(typeof QUEUE_TYPES)[number]>("전체");

  const rows = useMemo(() => {
    return QUEUE_ROWS.filter((row) => {
      const matchesType = typeFilter === "전체" || row.type === typeFilter;
      const matchesQuery = query.trim() === "" || row.code.toLowerCase().includes(query.trim().toLowerCase());
      return matchesType && matchesQuery;
    });
  }, [query, typeFilter]);

  return (
    <section className="admin__queue queue-panel">
      <div className="admin__section-head">
        <h2>운영 대기열</h2>
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
        <div className="queue-panel__type-row">
          {QUEUE_TYPES.map((type) => (
            <button
              key={type}
              type="button"
              className={`queue-panel__type-chip${typeFilter === type ? " is-active" : ""}`}
              onClick={() => setTypeFilter(type)}
            >
              {type}
            </button>
          ))}
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th>코드</th>
            <th>유형</th>
            <th>단계</th>
            <th>대기</th>
            <th>상태</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.code}>
              <td>{row.code}</td>
              <td>{row.type}</td>
              <td>{row.stage}</td>
              <td className="tabular-nums">{row.waitedMin > 0 ? `${row.waitedMin}분` : "-"}</td>
              <td>
                <Badge tone={STATUS_TONE[row.status]}>{row.status}</Badge>
              </td>
            </tr>
          ))}
          {rows.length === 0 ? (
            <tr>
              <td colSpan={5} className="queue-panel__empty">
                조건에 맞는 항목이 없어요.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </section>
  );
}
