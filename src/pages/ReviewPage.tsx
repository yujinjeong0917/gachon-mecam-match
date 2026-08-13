import { useNavigate } from "react-router-dom";
import { MOCK_DRAFT } from "../mockData";
import { ReviewScreen } from "../screens/ReviewScreen";

export function ReviewPage() {
  const navigate = useNavigate();
  return <ReviewScreen draft={MOCK_DRAFT} onSubmitted={() => navigate("/waiting")} />;
}
