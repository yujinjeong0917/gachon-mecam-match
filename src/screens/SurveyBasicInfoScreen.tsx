import { useState } from "react";
import { Button } from "../components/Button";
import { Chip } from "../components/Chip";
import { Field } from "../components/Field";
import { ProgressSteps } from "../components/ProgressSteps";
import { RadioGroup } from "../components/RadioGroup";
import { useDraft } from "../context/DraftContext";
import "./SurveyScreen.css";

const GRADE_OPTIONS = ["1학년", "2학년", "3학년", "4학년"];
const GENDER_OPTIONS = ["남성", "여성", "기타·응답하지 않음"];
const TRAIT_TAGS = ["차분함", "다정함", "활발함", "유쾌함", "섬세함", "리더십 있음", "장난기 많음", "조용함"];
const MAX_TRAITS = 3;

/** 문서01 §3 화면별 흐름 3번 "나를 소개": 닉네임·학과·학년·성별·성격 태그. 문서02 §4.3 1/4 단계. */
export function SurveyBasicInfoScreen({ onNext, onBack }: { onNext: () => void; onBack: () => void }) {
  const { draft, updateDraft } = useDraft();
  const [saved, setSaved] = useState(true);

  const patch = (fields: Partial<typeof draft>) => {
    updateDraft(fields);
    setSaved(false);
    window.setTimeout(() => setSaved(true), 400);
  };

  const toggleTrait = (tag: string) => {
    const has = draft.traits.includes(tag);
    if (has) {
      patch({ traits: draft.traits.filter((t) => t !== tag) });
    } else if (draft.traits.length < MAX_TRAITS) {
      patch({ traits: [...draft.traits, tag] });
    }
  };

  const canProceed = draft.nickname.trim().length > 0 && draft.department.trim().length > 0 && draft.gender !== "" && draft.grade !== null;

  return (
    <section className="survey">
      <header className="survey__header">
        <ProgressSteps current={1} total={4} label="나를 소개" />
        <span className="survey__saved" aria-live="polite">
          {saved ? "저장됨" : "저장 중…"}
        </span>
      </header>

      <div className="survey__field-group">
        <Field
          label="닉네임"
          placeholder="상대에게 보여질 이름"
          maxLength={20}
          value={draft.nickname}
          onChange={(e) => patch({ nickname: e.target.value })}
          helper="최대 20자"
        />
      </div>

      <div className="survey__field-group">
        <Field
          label="학과"
          placeholder="예: 간호학과"
          maxLength={30}
          value={draft.department}
          onChange={(e) => patch({ department: e.target.value })}
        />
      </div>

      <div className="survey__field-group">
        <RadioGroup
          label="학년"
          name="grade"
          options={GRADE_OPTIONS}
          value={draft.grade ? `${draft.grade}학년` : ""}
          onChange={(value) => patch({ grade: Number(value.replace("학년", "")) })}
        />
      </div>

      <div className="survey__field-group">
        <RadioGroup label="나의 성별" name="gender" options={GENDER_OPTIONS} value={draft.gender} onChange={(value) => patch({ gender: value })} />
      </div>

      <div className="survey__field-group">
        <div className="survey__field-heading">
          <h2>나를 표현하는 성격은요?</h2>
          <span className="survey__max-label">최대 {MAX_TRAITS}개</span>
        </div>
        <div className="survey__chip-row">
          {TRAIT_TAGS.map((tag) => (
            <Chip
              key={tag}
              label={tag}
              selected={draft.traits.includes(tag)}
              onToggle={() => toggleTrait(tag)}
              disabled={!draft.traits.includes(tag) && draft.traits.length >= MAX_TRAITS}
            />
          ))}
        </div>
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
