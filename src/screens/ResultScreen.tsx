import { motion } from "framer-motion";
import { Button } from "../components/Button";
import { revealVariants } from "../motion";
import "./ResultScreen.css";

interface Partner {
  nickname: string;
  department: string;
  grade: number;
  matchScore: number;
  sharedInterests: string[];
  activity: string;
  oneLiner: string;
}

interface Props {
  partner: Partner;
  onOpenCheatkey: () => void;
  onWithdraw: () => void;
}

/**
 * 문서02 §4.6: reveal 모션은 350~500ms 1회만. 무한이 마스코트는 공식 도안을 나중에 합성할
 * 자리만 남겨둔다(AI로 캐릭터를 새로 그리지 않는다 — 문서02 §1).
 * MotionConfig reducedMotion="user"(App.tsx)가 prefers-reduced-motion에서 이 모션을 자동으로 끈다.
 */
export function ResultScreen({ partner, onOpenCheatkey, onWithdraw }: Props) {
  return (
    <section className="result">
      <p className="result__lead">두 분은 이런 취향이 잘 맞았어요</p>

      <motion.div className="result__card" variants={revealVariants} initial="initial" animate="animate">
        <div className="result__stamp-slot" aria-hidden="true" />

        <span className="result__score-label">설문 취향 일치도</span>
        <span className="result__score tabular-nums">{partner.matchScore}</span>

        <div className="result__partner">
          <span className="result__partner-name">{partner.nickname}</span>
          <span className="result__partner-meta">
            {partner.department} · {partner.grade}학년
          </span>
        </div>

        <div className="result__tags">
          {partner.sharedInterests.slice(0, 3).map((tag) => (
            <span key={tag} className="result__tag">
              {tag}
            </span>
          ))}
        </div>

        <p className="result__activity">함께 하고 싶은 활동: {partner.activity}</p>
        <p className="result__one-liner">“{partner.oneLiner}”</p>
      </motion.div>

      <Button variant="primary" onClick={onOpenCheatkey}>
        치트키 열어보기
      </Button>
      <Button variant="ghost" onClick={onWithdraw}>
        이번 매칭 그만두기
      </Button>
    </section>
  );
}
