import { Button } from "../components/Button";
import { Chip } from "../components/Chip";
import { ProgressSteps } from "../components/ProgressSteps";
import { RadioGroup } from "../components/RadioGroup";
import { useDraft } from "../context/DraftContext";
import "./SurveyScreen.css";

const SEEKING_GENDER_OPTIONS = ["남성", "여성", "성별 무관"];
const DESIRED_TRAIT_TAGS = ["차분함", "다정함", "활발함", "유쾌함", "섬세함", "리더십 있음"];
const ACTIVITY_TAGS = ["카페 투어", "전시·공연 관람", "산책·러닝", "보드게임", "사진 촬영", "맛집 탐방"];
const CONTACT_STYLE_OPTIONS = ["먼저 연락받는 걸 선호해요", "제가 먼저 연락할게요", "편한 대로 해요"];

const MAX_DESIRED_TRAITS = 3;
const MAX_ACTIVITIES = 2;

/** 문서01 §3 화면별 흐름 5번 "상대 선호". 문서02 §4.3 3/4 단계. */
export function SurveyPreferenceScreen({ onNext, onBack }: { onNext: () => void; onBack: () => void }) {
  const { draft, updateDraft } = useDraft();

  const toggle = (key: "desiredTraits" | "activities", max: number, tag: string) => {
    const list = draft[key];
    const next = list.includes(tag) ? list.filter((t) => t !== tag) : list.length < max ? [...list, tag] : list;
    updateDraft({ [key]: next });
  };

  const canProceed = draft.seekingGender !== "" && draft.contactStyle !== "";

  return (
    <section className="survey">
      <header className="survey__header">
        <ProgressSteps current={3} total={4} label="상대 선호" />
      </header>

      <div className="survey__field-group">
        <RadioGroup
          label="매칭받고 싶은 상대"
          name="seekingGender"
          options={SEEKING_GENDER_OPTIONS}
          value={draft.seekingGender}
          onChange={(value) => updateDraft({ seekingGender: value })}
        />
      </div>

      <div className="survey__field-group">
        <div className="survey__field-heading">
          <h2>이런 성격이면 좋아요</h2>
          <span className="survey__max-label">최대 {MAX_DESIRED_TRAITS}개</span>
        </div>
        <div className="survey__chip-row">
          {DESIRED_TRAIT_TAGS.map((tag) => (
            <Chip
              key={tag}
              label={tag}
              selected={draft.desiredTraits.includes(tag)}
              onToggle={() => toggle("desiredTraits", MAX_DESIRED_TRAITS, tag)}
              disabled={!draft.desiredTraits.includes(tag) && draft.desiredTraits.length >= MAX_DESIRED_TRAITS}
            />
          ))}
        </div>
      </div>

      <div className="survey__field-group">
        <div className="survey__field-heading">
          <h2>함께 하고 싶은 활동</h2>
          <span className="survey__max-label">최대 {MAX_ACTIVITIES}개</span>
        </div>
        <div className="survey__chip-row">
          {ACTIVITY_TAGS.map((tag) => (
            <Chip
              key={tag}
              label={tag}
              selected={draft.activities.includes(tag)}
              onToggle={() => toggle("activities", MAX_ACTIVITIES, tag)}
              disabled={!draft.activities.includes(tag) && draft.activities.length >= MAX_ACTIVITIES}
            />
          ))}
        </div>
      </div>

      <div className="survey__field-group">
        <RadioGroup
          label="연락 스타일"
          name="contactStyle"
          options={CONTACT_STYLE_OPTIONS}
          value={draft.contactStyle}
          onChange={(value) => updateDraft({ contactStyle: value })}
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
