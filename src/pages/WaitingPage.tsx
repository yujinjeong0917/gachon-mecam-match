import { useNavigate } from "react-router-dom";
import { MOCK_WAITING } from "../mockData";
import { WaitingScreen } from "../screens/WaitingScreen";

/** 실제 구현에서는 GET /me/status를 15~30초 폴링하다가 matched가 되면 /result로 이동한다(문서03 §4). */
export function WaitingPage() {
  const navigate = useNavigate();
  return (
    <WaitingScreen
      matchingNumber={MOCK_WAITING.matchingNumber}
      recoveryCode={MOCK_WAITING.recoveryCode}
      nextMatchingAt={MOCK_WAITING.nextMatchingAt}
      onViewResult={() => navigate("/result")}
    />
  );
}
