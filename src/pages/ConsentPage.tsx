import { useNavigate } from "react-router-dom";
import { ConsentScreen } from "../screens/ConsentScreen";

export function ConsentPage() {
  const navigate = useNavigate();
  return <ConsentScreen onSubmit={() => navigate("/survey/interests")} />;
}
