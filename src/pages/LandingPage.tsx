import { useNavigate } from "react-router-dom";
import { LandingScreen } from "../screens/LandingScreen";

export function LandingPage() {
  const navigate = useNavigate();
  return <LandingScreen registrationOpen onStart={() => navigate("/consent")} />;
}
