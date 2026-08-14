import { Badge } from "../../components/Badge";

const STATS = [
  { label: "총 제출", value: 84 },
  { label: "대기 중", value: 22 },
  { label: "매칭 완료", value: 39 },
  { label: "제출 성공률", value: "99.2%" },
];

const RECENT_QUEUE = [
  { code: "M-027", stage: "팔로우 확인 대기", status: "주의" as const },
  { code: "M-009", stage: "신고 접수", status: "비상" as const },
  { code: "M-033", stage: "재배정 요청", status: "주의" as const },
];

const STATUS_TONE: Record<string, "neutral" | "amber" | "warning"> = {
  정상: "neutral",
  주의: "amber",
  비상: "warning",
};

/** 문서01 §6 "서비스 상태" + 핵심 숫자를 한눈에. 상세 대기열·퍼널·매칭은 각자 탭으로 분리했다. */
export function OverviewPanel() {
  return (
    <>
      <section className="admin__stats">
        {STATS.map((stat) => (
          <div key={stat.label} className="admin__stat-card">
            <span className="admin__stat-value tabular-nums">{stat.value}</span>
            <span className="admin__stat-label">{stat.label}</span>
          </div>
        ))}
      </section>

      <section className="admin__queue">
        <div className="admin__section-head">
          <h2>지금 확인이 필요해요</h2>
          <span className="admin__section-hint">운영 대기열 탭에서 전체 보기</span>
        </div>
        <table>
          <thead>
            <tr>
              <th>코드</th>
              <th>단계</th>
              <th>상태</th>
            </tr>
          </thead>
          <tbody>
            {RECENT_QUEUE.map((row) => (
              <tr key={row.code}>
                <td>{row.code}</td>
                <td>{row.stage}</td>
                <td>
                  <Badge tone={STATUS_TONE[row.status]}>{row.status}</Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  );
}
