import { useState } from "react";
import { Button } from "../components/Button";
import { Chip } from "../components/Chip";
import { ProgressSteps } from "../components/ProgressSteps";
import { useDraft } from "../context/DraftContext";
import "./SurveyScreen.css";

const INTEREST_TAGS = ["카페", "여행", "공연", "운동", "독서", "게임", "사진", "봉사활동", "스터디", "드라이브"];
const FOOD_TAGS = ["매운 음식", "디저트", "고기", "분식", "카페 투어"];
const MUSIC_TAGS = ["팝", "인디", "힙합", "발라드", "재즈", "클래식"];

const MAX_INTERESTS = 5;
const MAX_FOOD = 3;
const MAX_MUSIC = 3;

/** 문서02 §4.3: 한 화면에 3~5문항, Chip 최대선택수 라벨 노출, 자동저장은 조용히 헤더에만. */
export function SurveyInterestsScreen({ onNext, onBack }: { onNext: () => void; onBack: () => void }) {
  const { draft, updateDraft } = useDraft();
  const [saved, setSaved] = useState(true);

  const toggle = (key: "interests" | "food" | "music", max: number, tag: string) => {
    const list = draft[key];
    const next = list.includes(tag) ? list.filter((t) => t !== tag) : list.length < max ? [...list, tag] : list;
    updateDraft({ [key]: next });
    setSaved(false);
    window.setTimeout(() => setSaved(true), 400);
  };

  return (
    <section className="survey">
      <header className="survey__header">
        <ProgressSteps current={2} total={4} label="취향" />
        <span className="survey__saved" aria-live="polite">
          {saved ? "저장됨" : "저장 중…"}
        </span>
      </header>

      <div className="survey__field-group">
        <div className="survey__field-heading">
          <h2>어떤 걸 좋아해요?</h2>
          <span className="survey__max-label">최대 {MAX_INTERESTS}개</span>
        </div>
        <div className="survey__chip-row">
          {INTEREST_TAGS.map((tag) => (
            <Chip
              key={tag}
              label={tag}
              selected={draft.interests.includes(tag)}
              onToggle={() => toggle("interests", MAX_INTERESTS, tag)}
              disabled={!draft.interests.includes(tag) && draft.interests.length >= MAX_INTERESTS}
            />
          ))}
        </div>
      </div>

      <div className="survey__field-group">
        <div className="survey__field-heading">
          <h2>좋아하는 음식은요?</h2>
          <span className="survey__max-label">최대 {MAX_FOOD}개</span>
        </div>
        <div className="survey__chip-row">
          {FOOD_TAGS.map((tag) => (
            <Chip
              key={tag}
              label={tag}
              selected={draft.food.includes(tag)}
              onToggle={() => toggle("food", MAX_FOOD, tag)}
              disabled={!draft.food.includes(tag) && draft.food.length >= MAX_FOOD}
            />
          ))}
        </div>
      </div>

      <div className="survey__field-group">
        <div className="survey__field-heading">
          <h2>좋아하는 음악은요?</h2>
          <span className="survey__max-label">최대 {MAX_MUSIC}개 · 선택</span>
        </div>
        <div className="survey__chip-row">
          {MUSIC_TAGS.map((tag) => (
            <Chip
              key={tag}
              label={tag}
              selected={draft.music.includes(tag)}
              onToggle={() => toggle("music", MAX_MUSIC, tag)}
              disabled={!draft.music.includes(tag) && draft.music.length >= MAX_MUSIC}
            />
          ))}
        </div>
      </div>

      <div className="survey__footer">
        <Button variant="ghost" onClick={onBack}>
          이전
        </Button>
        <Button variant="primary" disabled={draft.interests.length === 0} onClick={onNext}>
          다음
        </Button>
      </div>
    </section>
  );
}
