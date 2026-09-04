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

const RECOVERY_CODE_STORAGE_KEY = "mecam_recovery_code";

function readStoredRecoveryCode(): string | undefined {
  try {
    return sessionStorage.getItem(RECOVERY_CODE_STORAGE_KEY) ?? undefined;
  } catch {
    return undefined;
  }
}

/** GET /me/status를 15초 간격으로 폴링한다 — 실제 매칭 완료 시점에 배너가 뜬다(문서03 §4). */
export function WaitingPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { eventId, ready: eventReady, error: eventError } = useEventSession();
  const { status, loading } = useMyStatus(eventId, 15000);
  // 제출 직후 화면 전환 사이에 탭이 재로드되면 location.state가 사라질 수 있어 sessionStorage로 보강한다.
  const recoveryCode = (location.state as LocationState | null)?.recoveryCode ?? readStoredRecoveryCode();

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
