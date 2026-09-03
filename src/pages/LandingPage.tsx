import { useNavigate } from "react-router-dom";
import { useEventSession } from "../hooks/useEventSession";
import { useMyStatus } from "../hooks/useMyStatus";
import { LandingScreen } from "../screens/LandingScreen";

export function LandingPage() {
  const navigate = useNavigate();
  const { eventId, ready } = useEventSession();
  const { status, loading } = useMyStatus(eventId);

  if (!ready || loading) {
    return null;
  }

  const alreadyJoined = status?.participant_status === "waiting" || status?.participant_status === "matched";

  return (
    <LandingScreen
      registrationOpen
      alreadyJoined={alreadyJoined}
      onStart={() => navigate("/consent")}
      onGoToMyPage={() => navigate("/waiting")}
    />
  );
}
