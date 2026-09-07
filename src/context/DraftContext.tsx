import { createContext, useCallback, useContext, useState, type ReactNode } from "react";

export interface DraftState {
  realName: string;
  nickname: string;
  department: string;
  grade: number | null;
  gender: string;
  traits: string[];
  mbti: string;
  oneLiner: string;
  interests: string[];
  food: string[];
  music: string[];
  seekingGender: string;
  desiredTraits: string[];
  activities: string[];
  contactStyle: string;
  instagramHandle: string;
  phoneNumber: string;
  analyticsConsent: boolean;
}

export const INITIAL_DRAFT: DraftState = {
  realName: "",
  nickname: "",
  department: "",
  grade: null,
  gender: "",
  traits: [],
  mbti: "",
  oneLiner: "",
  interests: [],
  food: [],
  music: [],
  seekingGender: "",
  desiredTraits: [],
  activities: [],
  contactStyle: "",
  instagramHandle: "",
  phoneNumber: "",
  analyticsConsent: false,
};

const STORAGE_KEY = "mecam_survey_draft";

/** 모바일은 탭을 백그라운드로 보내면 브라우저가 페이지를 통째로 새로고침하는 경우가 흔해서,
 * 메모리에만 있던 입력값이 그대로 사라진다. sessionStorage에 매 입력마다 반영해 그 경우를 버틴다. */
function loadPersistedDraft(): Partial<DraftState> {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function clearPersistedDraft(): void {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // 무시 — 어차피 다음 세션엔 새로 시작한다.
  }
}

interface DraftContextValue {
  draft: DraftState;
  updateDraft: (patch: Partial<DraftState>) => void;
}

const DraftContext = createContext<DraftContextValue | null>(null);

/**
 * 참가자 입력값을 단계 간에 실제로 들고 다니기 위한 컨텍스트.
 * 실제 구현에서는 각 변경분이 PUT /me/draft로 자동저장된다(문서03 §4). 지금은 sessionStorage로 대체한다.
 */
export function DraftProvider({ children, initial }: { children: ReactNode; initial?: Partial<DraftState> }) {
  const [draft, setDraft] = useState<DraftState>(() => ({ ...INITIAL_DRAFT, ...loadPersistedDraft(), ...initial }));

  const updateDraft = useCallback((patch: Partial<DraftState>) => {
    setDraft((prev) => {
      const next = { ...prev, ...patch };
      try {
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        // 프라이빗 모드 등으로 저장이 안 되면 메모리 상태만으로 진행한다.
      }
      return next;
    });
  }, []);

  return <DraftContext.Provider value={{ draft, updateDraft }}>{children}</DraftContext.Provider>;
}

export function useDraft() {
  const ctx = useContext(DraftContext);
  if (!ctx) throw new Error("useDraft must be used within DraftProvider");
  return ctx;
}
