import { useNavigate } from "react-router-dom";
import { SurveyInterestsScreen } from "../screens/SurveyInterestsScreen";

export function SurveyInterestsPage() {
  const navigate = useNavigate();
  return <SurveyInterestsScreen onNext={() => navigate("/review")} onBack={() => navigate("/consent")} />;
}
