import { isIOS, isStandalone } from "../push";
import "./AddToHomeScreenBanner.css";

/**
 * iOS Safari는 홈 화면에 추가된 PWA(standalone)에서만 Web Push를 받을 수 있다.
 * iOS는 beforeinstallprompt가 없어 안내만 가능 — 공유 버튼 경로를 텍스트로 설명한다.
 */
export function AddToHomeScreenBanner() {
  if (!isIOS() || isStandalone()) return null;

  return (
    <div className="add-to-home">
      <span className="add-to-home__icon" aria-hidden="true">
        ⎋
      </span>
      <p>
        매칭 알림을 받으려면 하단 공유 버튼 <strong>⎋</strong> → <strong>홈 화면에 추가</strong>를 눌러주세요.
      </p>
    </div>
  );
}
