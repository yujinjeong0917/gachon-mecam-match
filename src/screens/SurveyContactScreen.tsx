import { Button } from "../components/Button";
import { Field } from "../components/Field";
import { ProgressSteps } from "../components/ProgressSteps";
import { useDraft } from "../context/DraftContext";
import "./SurveyScreen.css";

/** 문서01 §3 화면별 흐름 6번 "비공개 연락 정보". 문서02 §4.3 4/4 단계. instagram_handle은 private 필드로 분리(문서03 §4). */
export function SurveyContactScreen({ onNext, onBack }: { onNext: () => void; onBack: () => void }) {
  const { draft, updateDraft } = useDraft();

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
          helper="매칭이 성사되고 상대가 팔로우 인증을 완료해야만, 동의한 범위 안에서 공개돼요."
        />
      </div>

      <div className="survey__footer">
        <Button variant="ghost" onClick={onBack}>
          이전
        </Button>
        <Button variant="primary" disabled={draft.instagramHandle.trim().length === 0} onClick={onNext}>
          다음
        </Button>
      </div>
    </section>
  );
}
