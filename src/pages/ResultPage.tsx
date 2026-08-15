import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { EVENT_CONFIG } from "../config/eventConfig";
import { MOCK_PARTNER } from "../mockData";
import { CheatkeySheet } from "../screens/CheatkeySheet";
import { ResultScreen } from "../screens/ResultScreen";

export function ResultPage() {
  const navigate = useNavigate();
  const [cheatkeyOpen, setCheatkeyOpen] = useState(false);

  return (
    <>
      <ResultScreen partner={MOCK_PARTNER} onOpenCheatkey={() => setCheatkeyOpen(true)} onWithdraw={() => navigate("/")} />
      <CheatkeySheet
        open={cheatkeyOpen}
        onClose={() => setCheatkeyOpen(false)}
        officialInstagramUrl={EVENT_CONFIG.officialInstagram.url}
        unlockedHandle="partner_id"
        unlockedPhone="010-1234-5678"
        contactPreference="먼저 연락받는 걸 선호해요"
      />
    </>
  );
}
