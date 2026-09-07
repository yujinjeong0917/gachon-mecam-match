import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useDraft } from "../context/DraftContext";
import { firstIncompleteStepBefore } from "../lib/surveyProgress";
import { SurveyContactScreen } from "../screens/SurveyContactScreen";

export function SurveyContactPage() {
  const navigate = useNavigate();
  const { draft } = useDraft();

  useEffect(() => {
    const missingStep = firstIncompleteStepBefore(draft, "/survey/contact");
    if (missingStep) navigate(missingStep, { replace: true });
  }, [draft, navigate]);

  return <SurveyContactScreen onNext={() => navigate("/review")} onBack={() => navigate("/survey/preference")} />;
}
