import { useNavigate } from "react-router-dom";
import { SurveyBasicInfoScreen } from "../screens/SurveyBasicInfoScreen";

export function SurveyBasicInfoPage() {
  const navigate = useNavigate();
  return <SurveyBasicInfoScreen onNext={() => navigate("/survey/interests")} onBack={() => navigate("/consent")} />;
}
