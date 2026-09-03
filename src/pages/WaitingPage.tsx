import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { EVENT_CONFIG } from "../config/eventConfig";
import { useEventSession } from "../hooks/useEventSession";
import { useMyStatus } from "../hooks/useMyStatus";
import { supabase } from "../lib/supabase";
import type { PushSubscriptionPayload } from "../push";
import { WaitingScreen } from "../screens/WaitingScreen";

interface LocationState {
  recoveryCode?: string;
}

/** GET /me/status를 15초 간격으로 폴링한다 — 실제 매칭 완료 시점에 배너가 뜬다(문서03 §4). */
export function WaitingPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { eventId, ready: eventReady, error: eventError } = useEventSession();
  const { status, loading } = useMyStatus(eventId, 15000);
  const recoveryCode = (location.state as LocationState | null)?.recoveryCode;

  const notSubmittedYet = !loading && status?.participant_status && !["waiting", "matched"].includes(status.participant_status);

  useEffect(() => {
    if (notSubmittedYet) {
      navigate("/", { replace: true });
    }
  }, [notSubmittedYet, navigate]);

  if (!eventReady || loading || notSubmittedYet) {
    return null;
  }

  if (eventError || !status) {
    return (
      <section style={{ padding: 24, textAlign: "center" }}>
        <p>지금은 상태를 불러올 수 없어요. 화면을 새로고침해주세요.</p>
      </section>
    );
  }

  const handleSubscribed = async (payload: PushSubscriptionPayload): Promise<boolean> => {
    if (!supabase || !eventId) return false;
    const { data, error } = await supabase.rpc("save_my_push_subscription", {
      p_event_id: eventId,
      p_endpoint: payload.endpoint,
      p_p256dh: payload.p256dh,
      p_auth: payload.auth,
    });
    if (error) return false;
    return (data as { status: string })?.status === "ok";
  };

  return (
    <WaitingScreen
      matchingNumber={status.matching_number ?? "-"}
      recoveryCode={recoveryCode}
      nextMatchingAt={EVENT_CONFIG.matchReleaseTime}
      matchFound={status.participant_status === "matched"}
      onViewResult={() => navigate("/result")}
      onSubscribed={handleSubscribed}
    />
  );
}
