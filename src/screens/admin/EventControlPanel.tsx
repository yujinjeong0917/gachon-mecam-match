import { useEffect, useState } from "react";
import { Button } from "../../components/Button";
import { useEventSession } from "../../hooks/useEventSession";
import { supabase } from "../../lib/supabase";

interface FeatureFlag {
  key: "registration_open" | "matching_enabled" | "result_reveal_enabled" | "cheat_unlock_enabled" | "fallback_mode";
  label: string;
}

const FLAGS: FeatureFlag[] = [
  { key: "registration_open", label: "신규 접수 허용" },
  { key: "matching_enabled", label: "매칭 실행 허용" },
  { key: "result_reveal_enabled", label: "결과 조회 허용" },
  { key: "cheat_unlock_enabled", label: "연락처 해제 허용" },
  { key: "fallback_mode", label: "비상 로컬 저장 모드" },
];

type FlagState = Record<FeatureFlag["key"], boolean>;

/** 문서01 §7 "장애 발생 5분 플레이북" 2번: 접수 손실 가능성이 있으면 registration_open부터 잠근다. */
export function EventControlPanel() {
  const { eventId } = useEventSession();
  const [flags, setFlags] = useState<FlagState | null>(null);
  const [pending, setPending] = useState<string | null>(null);

  useEffect(() => {
    if (!supabase || !eventId) return;
    supabase.rpc("admin_get_event_features", { p_event_id: eventId }).then(({ data }) => {
      if (data && (data as { status: string }).status === "ok") {
        const d = data as FlagState & { status: string };
        setFlags({
          registration_open: d.registration_open,
          matching_enabled: d.matching_enabled,
          result_reveal_enabled: d.result_reveal_enabled,
          cheat_unlock_enabled: d.cheat_unlock_enabled,
          fallback_mode: d.fallback_mode,
        });
      }
    });
  }, [eventId]);

  const toggle = async (key: FeatureFlag["key"]) => {
    if (!supabase || !eventId || !flags) return;
    const next = !flags[key];
    setPending(key);
    const { error } = await supabase.rpc("admin_set_event_feature", { p_event_id: eventId, p_flag: key, p_enabled: next });
    if (!error) setFlags({ ...flags, [key]: next });
    setPending(null);
  };

  if (!flags) {
    return <p className="admin__section-hint">불러오는 중…</p>;
  }

  const registrationOpen = flags.registration_open;

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
        <Button
          variant={registrationOpen ? "danger-ghost" : "ghost"}
          disabled={!registrationOpen || pending === "registration_open"}
          onClick={() => toggle("registration_open")}
        >
          {registrationOpen ? "지금 접수 잠그기" : "잠김"}
        </Button>
      </div>

      <div className="admin__flag-grid">
        {FLAGS.map((flag) => (
          <label key={flag.key} className="admin__flag">
            <input type="checkbox" checked={flags[flag.key]} disabled={pending === flag.key} onChange={() => toggle(flag.key)} />
            {flag.label}
          </label>
        ))}
      </div>
    </section>
  );
}
