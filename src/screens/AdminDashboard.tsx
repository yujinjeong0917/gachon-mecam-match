import { Badge } from "../components/Badge";
import "./AdminDashboard.css";

const NAV_ITEMS = ["개요", "접수 퍼널", "매칭 실행", "운영 대기열", "행사 제어"];

const STATS = [
  { label: "총 제출", value: 84 },
  { label: "대기 중", value: 22 },
  { label: "매칭 완료", value: 39 },
  { label: "제출 성공률", value: "99.2%" },
];

const QUEUE_ROWS = [
  { code: "M-027", stage: "팔로우 확인 대기", status: "주의" as const },
  { code: "M-014", stage: "매칭 완료", status: "정상" as const },
  { code: "M-051", stage: "복구 코드 요청", status: "정상" as const },
  { code: "M-009", stage: "신고 접수", status: "비상" as const },
  { code: "M-033", stage: "재배정 요청", status: "주의" as const },
];

const FEATURE_FLAGS: Array<{ key: string; label: string; on: boolean }> = [
  { key: "registration_open", label: "신규 접수 허용", on: true },
  { key: "matching_enabled", label: "매칭 실행 허용", on: true },
  { key: "result_reveal_enabled", label: "결과 조회 허용", on: true },
  { key: "cheat_unlock_enabled", label: "연락처 해제 허용", on: true },
  { key: "fallback_mode", label: "비상 로컬 저장 모드", on: false },
];

const STATUS_TONE: Record<string, "neutral" | "amber" | "warning"> = {
  정상: "neutral",
  주의: "amber",
  비상: "warning",
};

/** 문서01 §6 필수 위젯 스켈레톤. 결정·화려한 효과는 배제하고 운영 판단에 필요한 정보 밀도를 우선한다. */
export function AdminDashboard() {
  return (
    <div className="admin">
      <aside className="admin__sidebar">
        {NAV_ITEMS.map((item, i) => (
          <button key={item} type="button" className={`admin__nav-item${i === 0 ? " is-active" : ""}`}>
            {item}
          </button>
        ))}
      </aside>

      <main className="admin__main">
        <header className="admin__topbar">
          <div className="admin__health">
            <span className="admin__health-dot admin__health-dot--ok" /> 웹
            <span className="admin__health-dot admin__health-dot--ok" /> API
            <span className="admin__health-dot admin__health-dot--ok" /> DB
            <span className="admin__health-dot admin__health-dot--warn" /> Sheets
            <span className="admin__health-dot admin__health-dot--ok" /> Sentry
          </div>
          <span className="admin__next-run">다음 매칭 실행 09:45</span>
        </header>

        <section className="admin__stats">
          {STATS.map((stat) => (
            <div key={stat.label} className="admin__stat-card">
              <span className="admin__stat-value tabular-nums">{stat.value}</span>
              <span className="admin__stat-label">{stat.label}</span>
            </div>
          ))}
        </section>

        <section className="admin__queue">
          <h2>운영 대기열</h2>
          <table>
            <thead>
              <tr>
                <th>코드</th>
                <th>단계</th>
                <th>상태</th>
              </tr>
            </thead>
            <tbody>
              {QUEUE_ROWS.map((row) => (
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

        <section className="admin__flags">
          <h2>행사 제어</h2>
          <div className="admin__flag-grid">
            {FEATURE_FLAGS.map((flag) => (
              <label key={flag.key} className="admin__flag">
                <input type="checkbox" defaultChecked={flag.on} />
                {flag.label}
              </label>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
