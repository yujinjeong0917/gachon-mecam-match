import { useState } from "react";
import { Button } from "../../components/Button";

interface FeatureFlag {
  key: string;
  label: string;
  on: boolean;
}

const INITIAL_FLAGS: FeatureFlag[] = [
  { key: "registration_open", label: "신규 접수 허용", on: true },
  { key: "matching_enabled", label: "매칭 실행 허용", on: true },
  { key: "result_reveal_enabled", label: "결과 조회 허용", on: true },
  { key: "cheat_unlock_enabled", label: "연락처 해제 허용", on: true },
  { key: "fallback_mode", label: "비상 로컬 저장 모드", on: false },
];

/** 문서01 §7 "장애 발생 5분 플레이북" 2번: 접수 손실 가능성이 있으면 registration_open부터 잠근다. */
export function EventControlPanel() {
  const [flags, setFlags] = useState(INITIAL_FLAGS);

  const registrationOpen = flags.find((f) => f.key === "registration_open")?.on ?? false;

  const toggle = (key: string) => {
    setFlags((prev) => prev.map((f) => (f.key === key ? { ...f, on: !f.on } : f)));
  };

  const lockRegistration = () => {
    setFlags((prev) => prev.map((f) => (f.key === "registration_open" ? { ...f, on: false } : f)));
  };

  return (
    <section className="admin__flags event-control">
      <div className="admin__section-head">
        <h2>행사 제어</h2>
        <span className="admin__section-hint">모든 변경은 audit_events에 남아요</span>
      </div>

      <div className={`event-control__lock${!registrationOpen ? " is-locked" : ""}`}>
        <div>
          <strong>{registrationOpen ? "지금 접수를 받고 있어요" : "접수가 잠겨 있어요"}</strong>
          <p>장애 의심 시 가장 먼저 눌러야 하는 버튼이에요. 결과·치트키는 이후 단계에서 별도로 멈춰요.</p>
        </div>
        <Button variant={registrationOpen ? "danger-ghost" : "ghost"} disabled={!registrationOpen} onClick={lockRegistration}>
          {registrationOpen ? "지금 접수 잠그기" : "잠김"}
        </Button>
      </div>

      <div className="admin__flag-grid">
        {flags.map((flag) => (
          <label key={flag.key} className="admin__flag">
            <input type="checkbox" checked={flag.on} onChange={() => toggle(flag.key)} />
            {flag.label}
          </label>
        ))}
      </div>
    </section>
  );
}
