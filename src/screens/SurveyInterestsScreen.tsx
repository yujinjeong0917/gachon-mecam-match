import { useState } from "react";
import { Button } from "../components/Button";
import { Chip } from "../components/Chip";
import { ProgressSteps } from "../components/ProgressSteps";
import "./SurveyScreen.css";

const INTEREST_TAGS = ["카페", "여행", "공연", "운동", "독서", "게임", "사진", "봉사활동", "스터디", "드라이브"];
const FOOD_TAGS = ["매운 음식", "디저트", "고기", "분식", "카페 투어"];

const MAX_INTERESTS = 5;
const MAX_FOOD = 3;

/** 문서02 §4.3: 한 화면에 3~5문항, Chip 최대선택수 라벨 노출, 자동저장은 조용히 헤더에만. */
export function SurveyInterestsScreen({ onNext, onBack }: { onNext: () => void; onBack: () => void }) {
  const [interests, setInterests] = useState<string[]>([]);
  const [food, setFood] = useState<string[]>([]);
  const [saved, setSaved] = useState(true);

  const toggle = (list: string[], setList: (v: string[]) => void, max: number, tag: string) => {
    setSaved(false);
    if (list.includes(tag)) {
      setList(list.filter((t) => t !== tag));
    } else if (list.length < max) {
      setList([...list, tag]);
    }
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
              selected={interests.includes(tag)}
              onToggle={() => toggle(interests, setInterests, MAX_INTERESTS, tag)}
              disabled={!interests.includes(tag) && interests.length >= MAX_INTERESTS}
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
              selected={food.includes(tag)}
              onToggle={() => toggle(food, setFood, MAX_FOOD, tag)}
              disabled={!food.includes(tag) && food.length >= MAX_FOOD}
            />
          ))}
        </div>
      </div>

      <div className="survey__footer">
        <Button variant="ghost" onClick={onBack}>
          이전
        </Button>
        <Button variant="primary" disabled={interests.length === 0} onClick={onNext}>
          다음
        </Button>
      </div>
    </section>
  );
}
