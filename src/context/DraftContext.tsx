import { createContext, useCallback, useContext, useState, type ReactNode } from "react";

export interface DraftState {
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

interface DraftContextValue {
  draft: DraftState;
  updateDraft: (patch: Partial<DraftState>) => void;
}

const DraftContext = createContext<DraftContextValue | null>(null);

/**
 * 참가자 입력값을 단계 간에 실제로 들고 다니기 위한 컨텍스트.
 * 실제 구현에서는 각 변경분이 PUT /me/draft로 자동저장된다(문서03 §4). 지금은 프런트 상태로만 보존한다.
 */
export function DraftProvider({ children, initial }: { children: ReactNode; initial?: Partial<DraftState> }) {
  const [draft, setDraft] = useState<DraftState>({ ...INITIAL_DRAFT, ...initial });

  const updateDraft = useCallback((patch: Partial<DraftState>) => {
    setDraft((prev) => ({ ...prev, ...patch }));
  }, []);

  return <DraftContext.Provider value={{ draft, updateDraft }}>{children}</DraftContext.Provider>;
}

export function useDraft() {
  const ctx = useContext(DraftContext);
  if (!ctx) throw new Error("useDraft must be used within DraftProvider");
  return ctx;
}
