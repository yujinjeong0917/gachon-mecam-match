import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import { AddToHomeScreenBanner } from "../components/AddToHomeScreenBanner";
import { isPushSupported, subscribeToPush, type PushSubscriptionPayload } from "../push";
import "./WaitingScreen.css";

interface Props {
  matchingNumber: string;
  /** 제출 직후 한 번만 서버가 내려준다. 재방문 시에는 다시 못 받으므로 undefined일 수 있다. */
  recoveryCode?: string;
  nextMatchingAt: string;
  onViewResult?: () => void;
  /** 실제 앱에서는 GET /me/status 폴링 결과를 그대로 넘긴다. 생략하면(GuidePage 데모용) 내부 데모 타이머로 대체한다. */
  matchFound?: boolean;
  /** 구독 정보를 서버에 저장하고 성공 여부를 반환한다. 생략하면(GuidePage 데모용) 브라우저 구독까지만 확인한다. */
  onSubscribed?: (payload: PushSubscriptionPayload) => Promise<boolean>;
}

type PushState = "idle" | "subscribing" | "subscribed" | "denied" | "unsupported";

/**
 * 문서02 §4.5. Liquid Glass는 기본 미사용이므로(문서02 §2 "굴절·블러 효과는 Safari 대응 비용이 커서
 * 참가자 핵심 화면에 쓰지 않는다") backdrop-filter 없는 솔리드 surface + shadow-result로 대체하고,
 * 대신 스프링 이징으로 "튀어오르는" 진입감을 낸다.
 */
export function WaitingScreen({ matchingNumber, recoveryCode, nextMatchingAt, onViewResult, matchFound: matchFoundProp, onSubscribed }: Props) {
  const [demoMatchFound, setDemoMatchFound] = useState(false);
  const matchFound = matchFoundProp ?? demoMatchFound;
  const [pushState, setPushState] = useState<PushState>(isPushSupported() ? "idle" : "unsupported");

  useEffect(() => {
    if (matchFoundProp !== undefined) return; // 실사용: 폴링 결과를 그대로 쓰므로 데모 타이머 불필요
    const timer = window.setTimeout(() => setDemoMatchFound(true), 2600);
    return () => window.clearTimeout(timer);
  }, [matchFoundProp]);

  const requestPush = async () => {
    setPushState("subscribing");
    const vapidPublicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;
    const subscription = vapidPublicKey ? await subscribeToPush(vapidPublicKey) : null;
    if (!subscription) {
      setPushState("denied");
      return;
    }
    const saved = onSubscribed ? await onSubscribed(subscription) : true;
    setPushState(saved ? "subscribed" : "denied");
  };

  return (
    <section className="waiting">
      <p className="waiting__lead">신청했어요. 다음 매칭까지 잠시만 기다려 주세요</p>

      <div className="waiting__ticket">
        <span className="waiting__ticket-label">MATCHING NUMBER</span>
        <span className="waiting__ticket-number tabular-nums">{matchingNumber}</span>
        {recoveryCode ? (
          <>
            <div className="waiting__ticket-divider" aria-hidden="true" />
            <span className="waiting__ticket-label">복구 코드</span>
            <span className="waiting__ticket-code tabular-nums">{recoveryCode}</span>
          </>
        ) : null}
      </div>

      {recoveryCode ? (
        <p className="waiting__capture-hint">이 화면을 캡처해 주세요</p>
      ) : (
        <p className="waiting__capture-hint">복구 코드는 신청 직후 한 번만 보여드려요</p>
      )}

      <div className="waiting__status">
        <span className="waiting__pulse" aria-hidden="true" />
        <span>오늘 {nextMatchingAt}에 한 번에 매칭을 진행해요</span>
      </div>

      <p className="waiting__empty-note">매칭 시각이 되면 이 화면에서 바로 결과를 알려드릴게요.</p>
      <p className="waiting__empty-note">성비가 맞지 않는 경우, 한 분이 최대 2명과 매칭될 수 있어요.</p>

      {pushState !== "unsupported" ? (
        <div className="waiting__push">
          {pushState === "subscribed" ? (
            <p className="waiting__empty-note">매칭되면 알림으로 알려드릴게요.</p>
          ) : (
            <button type="button" className="waiting__push-button" onClick={requestPush} disabled={pushState === "subscribing"}>
              {pushState === "subscribing" ? "알림 설정 중…" : pushState === "denied" ? "알림을 받지 못했어요, 다시 시도" : "매칭 알림 받기"}
            </button>
          )}
          <AddToHomeScreenBanner />
        </div>
      ) : null}

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
