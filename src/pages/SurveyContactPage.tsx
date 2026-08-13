import { useNavigate } from "react-router-dom";
import { SurveyContactScreen } from "../screens/SurveyContactScreen";

export function SurveyContactPage() {
  const navigate = useNavigate();
  return <SurveyContactScreen onNext={() => navigate("/review")} onBack={() => navigate("/survey/preference")} />;
}
