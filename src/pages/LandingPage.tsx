import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useEventSession } from "../hooks/useEventSession";
import { useMyStatus } from "../hooks/useMyStatus";
import { supabase } from "../lib/supabase";
import { LandingScreen } from "../screens/LandingScreen";

export function LandingPage() {
  const navigate = useNavigate();
  const { eventId, ready } = useEventSession();
  const { status, loading } = useMyStatus(eventId);
  const [registrationOpen, setRegistrationOpen] = useState(true);

  useEffect(() => {
    if (!supabase || !eventId) return;
    supabase
      .from("event_features")
      .select("registration_open")
      .eq("event_id", eventId)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setRegistrationOpen(data.registration_open);
      });
  }, [eventId]);

  useEffect(() => {
    if (!supabase || !eventId) return;
    // supabase-js의 쿼리 빌더는 lazy thenable이라 .then()을 붙이지 않으면 요청 자체가 안 나간다.
    supabase.rpc("log_my_funnel_event", { p_event_id: eventId, p_stage: "landing_view" }).then(() => {});
  }, [eventId]);

  if (!ready || loading) {
    return null;
  }

  const alreadyJoined = status?.participant_status === "waiting" || status?.participant_status === "matched";

  return (
    <LandingScreen
      registrationOpen={registrationOpen}
      alreadyJoined={alreadyJoined}
      onStart={() => navigate("/consent")}
      onGoToMyPage={() => navigate("/waiting")}
    />
  );
}
