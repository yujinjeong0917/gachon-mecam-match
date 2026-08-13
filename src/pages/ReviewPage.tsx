import { useNavigate } from "react-router-dom";
import { ReviewScreen } from "../screens/ReviewScreen";

export function ReviewPage() {
  const navigate = useNavigate();
  return <ReviewScreen onSubmitted={() => navigate("/waiting")} />;
}
