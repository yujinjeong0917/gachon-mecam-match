import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useDraft } from "../context/DraftContext";
import { firstIncompleteStepBefore } from "../lib/surveyProgress";
import { SurveyPreferenceScreen } from "../screens/SurveyPreferenceScreen";

export function SurveyPreferencePage() {
  const navigate = useNavigate();
  const { draft } = useDraft();

  useEffect(() => {
    const missingStep = firstIncompleteStepBefore(draft, "/survey/preference");
    if (missingStep) navigate(missingStep, { replace: true });
  }, [draft, navigate]);

  return <SurveyPreferenceScreen onNext={() => navigate("/survey/contact")} onBack={() => navigate("/survey/interests")} />;
}
