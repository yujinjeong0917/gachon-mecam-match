import type { DraftState } from "../context/DraftContext";
import { validateInstagramHandle, validateNickname, validatePhoneNumber, validateRealName } from "./validation";

const STEP_ORDER = ["/survey/basic-info", "/survey/interests", "/survey/preference", "/survey/contact"] as const;
type StepPath = (typeof STEP_ORDER)[number];

function isBasicInfoComplete(draft: DraftState): boolean {
  return (
    !validateNickname(draft.nickname) &&
    draft.department.trim().length > 0 &&
    draft.gender !== "" &&
    draft.grade !== null &&
    draft.traits.length > 0
  );
}

function isInterestsComplete(draft: DraftState): boolean {
  return draft.interests.length > 0 && draft.food.length > 0;
}

function isPreferenceComplete(draft: DraftState): boolean {
  return draft.seekingGender !== "" && draft.contactStyle !== "" && draft.desiredTraits.length > 0 && draft.activities.length > 0;
}

function isContactComplete(draft: DraftState): boolean {
  return !validateRealName(draft.realName) && !validateInstagramHandle(draft.instagramHandle) && !validatePhoneNumber(draft.phoneNumber);
}

const STEP_CHECKS: Record<StepPath, (draft: DraftState) => boolean> = {
  "/survey/basic-info": isBasicInfoComplete,
  "/survey/interests": isInterestsComplete,
  "/survey/preference": isPreferenceComplete,
  "/survey/contact": isContactComplete,
};

/**
 * 모바일에서 탭이 백그라운드로 갔다 오면서 브라우저가 페이지를 통째로 새로고침하면
 * DraftContext가 초기화된다(sessionStorage로 웬만하면 버티지만, 프라이빗 모드 등 예외 대비).
 * 지금 있는 단계보다 앞선 단계 중 아직 안 채워진 게 있으면 그 단계로 돌려보낸다.
 */
export function firstIncompleteStepBefore(draft: DraftState, currentPath: string): string | null {
  const currentIndex = STEP_ORDER.indexOf(currentPath as StepPath);
  const upTo = currentIndex === -1 ? STEP_ORDER.length : currentIndex;
  for (let i = 0; i < upTo; i += 1) {
    const path = STEP_ORDER[i];
    if (!STEP_CHECKS[path](draft)) return path;
  }
  return null;
}

/** 검토(Review) 화면 진입 전, 4단계 전체가 채워졌는지 확인한다. */
export function firstIncompleteStep(draft: DraftState): string | null {
  return firstIncompleteStepBefore(draft, "/review");
}
