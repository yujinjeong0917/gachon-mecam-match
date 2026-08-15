import { useState } from "react";
import { EventControlPanel } from "./admin/EventControlPanel";
import { FunnelPanel } from "./admin/FunnelPanel";
import { MatchingRunPanel } from "./admin/MatchingRunPanel";
import { OverviewPanel } from "./admin/OverviewPanel";
import { QueuePanel } from "./admin/QueuePanel";
import "./AdminDashboard.css";

const TABS = ["개요", "접수 퍼널", "매칭 실행", "운영 대기열", "행사 제어"] as const;
type Tab = (typeof TABS)[number];

/** 문서01 §6 필수 위젯을 탭으로 분리. 결정·화려한 효과는 배제하고 운영 판단에 필요한 정보 밀도를 우선한다. */
export function AdminDashboard() {
  const [tab, setTab] = useState<Tab>("개요");

  return (
    <div className="admin">
      <aside className="admin__sidebar">
        {TABS.map((item) => (
          <button key={item} type="button" className={`admin__nav-item${tab === item ? " is-active" : ""}`} onClick={() => setTab(item)}>
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
          <span className="admin__next-run">오늘 매칭 실행 16:00</span>
        </header>

        {tab === "개요" ? <OverviewPanel /> : null}
        {tab === "접수 퍼널" ? <FunnelPanel /> : null}
        {tab === "매칭 실행" ? <MatchingRunPanel /> : null}
        {tab === "운영 대기열" ? <QueuePanel /> : null}
        {tab === "행사 제어" ? <EventControlPanel /> : null}
      </main>
    </div>
  );
}
