import { useNavigate } from "react-router-dom";
import { useDraft } from "../context/DraftContext";
import { ConsentScreen } from "../screens/ConsentScreen";

export function ConsentPage() {
  const navigate = useNavigate();
  const { updateDraft } = useDraft();
  return (
    <ConsentScreen
      onSubmit={(consents) => {
        updateDraft({ analyticsConsent: consents.analytics });
        navigate("/survey/basic-info");
      }}
    />
  );
}
