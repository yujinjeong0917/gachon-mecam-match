import { useNavigate } from "react-router-dom";
import { SurveyPreferenceScreen } from "../screens/SurveyPreferenceScreen";

export function SurveyPreferencePage() {
  const navigate = useNavigate();
  return <SurveyPreferenceScreen onNext={() => navigate("/survey/contact")} onBack={() => navigate("/survey/interests")} />;
}
