import { MotionConfig } from "framer-motion";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { DraftProvider } from "./context/DraftContext";
import { ParticipantLayout } from "./layouts/ParticipantLayout";
import { AdminPage } from "./pages/AdminPage";
import { ConsentPage } from "./pages/ConsentPage";
import { GuidePage } from "./pages/GuidePage";
import { LandingPage } from "./pages/LandingPage";
import { ResultPage } from "./pages/ResultPage";
import { ReviewPage } from "./pages/ReviewPage";
import { SurveyBasicInfoPage } from "./pages/SurveyBasicInfoPage";
import { SurveyContactPage } from "./pages/SurveyContactPage";
import { SurveyInterestsPage } from "./pages/SurveyInterestsPage";
import { SurveyPreferencePage } from "./pages/SurveyPreferencePage";
import { WaitingPage } from "./pages/WaitingPage";

/** reducedMotion="user"는 prefers-reduced-motion 사용자에게 모든 framer-motion 애니메이션을 자동으로 걷어낸다. */
export default function App() {
  return (
    <MotionConfig reducedMotion="user">
      <BrowserRouter>
        <DraftProvider>
          <Routes>
            <Route element={<ParticipantLayout />}>
              <Route path="/" element={<LandingPage />} />
              <Route path="/consent" element={<ConsentPage />} />
              <Route path="/survey/basic-info" element={<SurveyBasicInfoPage />} />
              <Route path="/survey/interests" element={<SurveyInterestsPage />} />
              <Route path="/survey/preference" element={<SurveyPreferencePage />} />
              <Route path="/survey/contact" element={<SurveyContactPage />} />
              <Route path="/review" element={<ReviewPage />} />
              <Route path="/waiting" element={<WaitingPage />} />
              <Route path="/result" element={<ResultPage />} />
            </Route>
            <Route path="/admin" element={<AdminPage />} />
            <Route path="/guide" element={<GuidePage />} />
          </Routes>
        </DraftProvider>
      </BrowserRouter>
    </MotionConfig>
  );
}
