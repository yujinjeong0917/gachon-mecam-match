import { useState } from "react";
import { Button } from "../components/Button";
import { Field } from "../components/Field";
import { ProgressSteps } from "../components/ProgressSteps";
import { useDraft } from "../context/DraftContext";
import { validateInstagramHandle, validatePhoneNumber } from "../lib/validation";
import "./SurveyScreen.css";

/** 문서01 §3 화면별 흐름 6번 "비공개 연락 정보". instagram_handle·phone_number 모두 private 필드로 분리(문서03 §4). */
export function SurveyContactScreen({ onNext, onBack }: { onNext: () => void; onBack: () => void }) {
  const { draft, updateDraft } = useDraft();
  const [touched, setTouched] = useState<{ instagram: boolean; phone: boolean }>({ instagram: false, phone: false });

  const instagramError = validateInstagramHandle(draft.instagramHandle);
  const phoneError = validatePhoneNumber(draft.phoneNumber);
  const canProceed = !instagramError && !phoneError;

  return (
    <section className="survey">
      <header className="survey__header">
        <ProgressSteps current={4} total={4} label="비공개 연락 정보" />
      </header>

      <div className="survey__field-group">
        <Field
          label="Instagram ID"
          placeholder="@ 없이 아이디만 입력"
          value={draft.instagramHandle}
          onChange={(e) => updateDraft({ instagramHandle: e.target.value.replace(/^@/, "") })}
          onBlur={() => setTouched((t) => ({ ...t, instagram: true }))}
          error={touched.instagram ? (instagramError ?? undefined) : undefined}
          helper="매칭이 성사되고 상대가 팔로우 인증을 완료해야만, 동의한 범위 안에서 공개돼요."
        />
      </div>

      <div className="survey__field-group">
        <Field
          label="전화번호"
          type="tel"
          placeholder="010-1234-5678"
          value={draft.phoneNumber}
          onChange={(e) => updateDraft({ phoneNumber: e.target.value })}
          onBlur={() => setTouched((t) => ({ ...t, phone: true }))}
          error={touched.phone ? (phoneError ?? undefined) : undefined}
          helper="운영진 확인 후에만 매칭 상대 1명에게 공개돼요. 행사 종료 후 7일 이내 삭제해요."
        />
      </div>

      <div className="survey__footer">
        <Button variant="ghost" onClick={onBack}>
          이전
        </Button>
        <Button variant="primary" disabled={!canProceed} onClick={onNext}>
          다음
        </Button>
      </div>
    </section>
  );
}
