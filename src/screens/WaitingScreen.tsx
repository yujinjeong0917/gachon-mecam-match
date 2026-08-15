import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import "./WaitingScreen.css";

interface Props {
  matchingNumber: string;
  recoveryCode: string;
  nextMatchingAt: string;
  onViewResult?: () => void;
}

/**
 * 문서02 §4.5. Liquid Glass는 기본 미사용이므로(문서02 §2 "굴절·블러 효과는 Safari 대응 비용이 커서
 * 참가자 핵심 화면에 쓰지 않는다") backdrop-filter 없는 솔리드 surface + shadow-result로 대체하고,
 * 대신 스프링 이징으로 "튀어오르는" 진입감을 낸다.
 * 실제 구현에서는 GET /me/status 폴링이 matched를 반환하는 시점에 이 배너가 뜬다(문서03 §4).
 */
export function WaitingScreen({ matchingNumber, recoveryCode, nextMatchingAt, onViewResult }: Props) {
  const [matchFound, setMatchFound] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setMatchFound(true), 2600);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <section className="waiting">
      <p className="waiting__lead">신청했어요. 다음 매칭까지 잠시만 기다려 주세요</p>

      <div className="waiting__ticket">
        <span className="waiting__ticket-label">MATCHING NUMBER</span>
        <span className="waiting__ticket-number tabular-nums">{matchingNumber}</span>
        <div className="waiting__ticket-divider" aria-hidden="true" />
        <span className="waiting__ticket-label">복구 코드</span>
        <span className="waiting__ticket-code tabular-nums">{recoveryCode}</span>
      </div>

      <p className="waiting__capture-hint">이 화면을 캡처해 주세요</p>

      <div className="waiting__status">
        <span className="waiting__pulse" aria-hidden="true" />
        <span>오늘 {nextMatchingAt}에 한 번에 매칭을 진행해요</span>
      </div>

      <p className="waiting__empty-note">매칭 시각이 되면 이 화면에서 바로 결과를 알려드릴게요.</p>

      <AnimatePresence>
        {matchFound ? (
          <motion.button
            type="button"
            className="waiting__found-banner"
            onClick={onViewResult}
            initial={{ y: 90, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 90, opacity: 0, transition: { duration: 0.2 } }}
            transition={{ type: "spring", stiffness: 340, damping: 18 }}
          >
            <span className="waiting__found-dot" aria-hidden="true" />
            <span className="waiting__found-text">
              <strong>매칭이 완료됐어요</strong>
              <span>지금 결과를 확인해보세요</span>
            </span>
            <span className="waiting__found-cta">결과 보기</span>
          </motion.button>
        ) : null}
      </AnimatePresence>
    </section>
  );
}
