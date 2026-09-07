import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useDraft } from "../context/DraftContext";
import { firstIncompleteStepBefore } from "../lib/surveyProgress";
import { SurveyInterestsScreen } from "../screens/SurveyInterestsScreen";

export function SurveyInterestsPage() {
  const navigate = useNavigate();
  const { draft } = useDraft();

  useEffect(() => {
    const missingStep = firstIncompleteStepBefore(draft, "/survey/interests");
    if (missingStep) navigate(missingStep, { replace: true });
  }, [draft, navigate]);

  return <SurveyInterestsScreen onNext={() => navigate("/survey/preference")} onBack={() => navigate("/survey/basic-info")} />;
}
