import type { ReactNode } from "react";
import "./MobileFrame.css";

interface Props {
  children: ReactNode;
}

/**
 * 참가자 화면을 담는 360x800 모바일 뷰포트.
 * 문서02 §1: 나뭇결은 화면 전체가 아니라 1~2개 지점에만. 여기서는 상단 5px 라인만 walnut으로 처리한다.
 * grain은 raster 에셋이 아니라 SVG feTurbulence로 코드에서 생성한다(§7 grain 2~3% 제한).
 */
export function MobileFrame({ children }: Props) {
  return (
    <div className="mobile-frame">
      <div className="mobile-frame__walnut-edge" aria-hidden="true" />
      <svg width="0" height="0" style={{ position: "absolute" }}>
        <filter id="filmGrain">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch" result="noise" />
          <feColorMatrix in="noise" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.5 0" />
        </filter>
      </svg>
      <div className="mobile-frame__grain" style={{ filter: "url(#filmGrain)" }} aria-hidden="true" />
      <div className="mobile-frame__screen">{children}</div>
    </div>
  );
}
