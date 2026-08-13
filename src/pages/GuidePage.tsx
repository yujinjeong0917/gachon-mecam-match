import { useState } from "react";
import { Link } from "react-router-dom";
import { MobileFrame } from "../components/MobileFrame";
import { DraftProvider } from "../context/DraftContext";
import { EVENT_CONFIG } from "../config/eventConfig";
import { MOCK_DRAFT, MOCK_PARTNER, MOCK_WAITING } from "../mockData";
import { AdminDashboard } from "../screens/AdminDashboard";
import { CheatkeySheet } from "../screens/CheatkeySheet";
import { ConsentScreen } from "../screens/ConsentScreen";
import { LandingScreen } from "../screens/LandingScreen";
import { ResultScreen } from "../screens/ResultScreen";
import { ReviewScreen } from "../screens/ReviewScreen";
import { SurveyBasicInfoScreen } from "../screens/SurveyBasicInfoScreen";
import { SurveyContactScreen } from "../screens/SurveyContactScreen";
import { SurveyInterestsScreen } from "../screens/SurveyInterestsScreen";
import { SurveyPreferenceScreen } from "../screens/SurveyPreferenceScreen";
import { WaitingScreen } from "../screens/WaitingScreen";
import "./GuidePage.css";

type Step = "landing" | "consent" | "basicInfo" | "interests" | "preference" | "contact" | "review" | "waiting" | "result" | "admin";

const STEP_LABELS: Record<Step, string> = {
  landing: "랜딩",
  consent: "동의",
  basicInfo: "설문(나를 소개)",
  interests: "설문(취향)",
  preference: "설문(상대 선호)",
  contact: "설문(연락정보)",
  review: "검토·제출",
  waiting: "대기",
  result: "결과",
  admin: "관리자 태블릿",
};

/**
 * 실제 참가자 플로우(/)와 분리된 스타일가이드 화면 갤러리.
 * 실서비스 라우팅에는 관여하지 않고, 화면 상태를 하나씩 훑어보기 위한 내부용 프리뷰다.
 * DraftContext는 실제 앱과 별개 인스턴스로 목업 값을 미리 채워서 시작한다.
 */
export function GuidePage() {
  const [step, setStep] = useState<Step>("landing");
  const [cheatkeyOpen, setCheatkeyOpen] = useState(false);

  return (
    <div className="guide-page">
      <nav className="guide-page__nav">
        <Link to="/" className="guide-page__home-link">
          ← 실제 앱으로
        </Link>
        {(Object.keys(STEP_LABELS) as Step[]).map((key) => (
          <button key={key} className={step === key ? "is-active" : ""} onClick={() => setStep(key)}>
            {STEP_LABELS[key]}
          </button>
        ))}
      </nav>

      <div className="guide-page__stage">
        {step === "admin" ? (
          <AdminDashboard />
        ) : (
          <DraftProvider initial={MOCK_DRAFT}>
            <MobileFrame>
              {step === "landing" ? <LandingScreen registrationOpen onStart={() => setStep("consent")} /> : null}
              {step === "consent" ? <ConsentScreen onSubmit={() => setStep("basicInfo")} /> : null}
              {step === "basicInfo" ? (
                <SurveyBasicInfoScreen onNext={() => setStep("interests")} onBack={() => setStep("consent")} />
              ) : null}
              {step === "interests" ? (
                <SurveyInterestsScreen onNext={() => setStep("preference")} onBack={() => setStep("basicInfo")} />
              ) : null}
              {step === "preference" ? (
                <SurveyPreferenceScreen onNext={() => setStep("contact")} onBack={() => setStep("interests")} />
              ) : null}
              {step === "contact" ? <SurveyContactScreen onNext={() => setStep("review")} onBack={() => setStep("preference")} /> : null}
              {step === "review" ? <ReviewScreen onSubmitted={() => setStep("waiting")} /> : null}
              {step === "waiting" ? (
                <WaitingScreen
                  matchingNumber={MOCK_WAITING.matchingNumber}
                  recoveryCode={MOCK_WAITING.recoveryCode}
                  nextMatchingAt={MOCK_WAITING.nextMatchingAt}
                  onViewResult={() => setStep("result")}
                />
              ) : null}
              {step === "result" ? (
                <>
                  <ResultScreen partner={MOCK_PARTNER} onOpenCheatkey={() => setCheatkeyOpen(true)} onWithdraw={() => setStep("landing")} />
                  <CheatkeySheet
                    open={cheatkeyOpen}
                    onClose={() => setCheatkeyOpen(false)}
                    officialInstagramUrl={EVENT_CONFIG.officialInstagram.url}
                    unlockedHandle="partner_id"
                    contactPreference="먼저 연락받는 걸 선호해요"
                  />
                </>
              ) : null}
            </MobileFrame>
          </DraftProvider>
        )}
      </div>
    </div>
  );
}
