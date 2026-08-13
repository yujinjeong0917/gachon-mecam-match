import type { Transition } from "framer-motion";

/**
 * Apple 스타일 모션: 리니어가 아니라 강한 가속/감속 커브를 쓴다.
 * - EASE_INOUT: 시작·끝 모두 강하게 눌러주는 대칭 커브. 화면 전환(교체)에 사용.
 * - EASE_OUT: 빠르게 튀어나와 부드럽게 안착. 진입(reveal)에 사용.
 * - EASE_IN: 부드럽게 시작해 빠르게 사라짐. 퇴장에 사용.
 */
export const EASE_INOUT: NonNullable<Transition["ease"]> = [0.83, 0, 0.17, 1];
export const EASE_OUT: NonNullable<Transition["ease"]> = [0.16, 1, 0.3, 1];
export const EASE_IN: NonNullable<Transition["ease"]> = [0.7, 0, 0.84, 0];

export const DURATION = {
  fast: 0.22,
  base: 0.38,
  slow: 0.55,
} as const;

export const pageTransition: Transition = { duration: DURATION.base, ease: EASE_INOUT };
export const revealTransition: Transition = { duration: DURATION.slow, ease: EASE_OUT };

export const pageVariants = {
  initial: { opacity: 0, x: 16 },
  animate: { opacity: 1, x: 0, transition: pageTransition },
  exit: { opacity: 0, x: -16, transition: { duration: DURATION.fast, ease: EASE_IN } },
};

export const revealVariants = {
  initial: { opacity: 0, y: 14, scale: 0.98 },
  animate: { opacity: 1, y: 0, scale: 1, transition: revealTransition },
};
