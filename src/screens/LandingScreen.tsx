import mascotBadge from "../assets/mascot-badge.png";
import { Badge } from "../components/Badge";
import { Button } from "../components/Button";
import { EVENT_CONFIG } from "../config/eventConfig";
import "./LandingScreen.css";

interface Props {
  registrationOpen: boolean;
  /** 이미 참여를 완료한 사람이 다시 접근한 경우. 실제로는 GET /me/status로 서버가 판정한다(문서03 §4). */
  alreadyJoined?: boolean;
  onStart: () => void;
  onGoToMyPage?: () => void;
}

/** 참여 정보 입력 페이지1. 공식 포스터 카피 그대로. registrationOpen=false면 CTA를 비활성화하지 않고 상태 화면으로 전환한다. */
export function LandingScreen({ registrationOpen, alreadyJoined = false, onStart, onGoToMyPage }: Props) {
  if (!registrationOpen) {
    return (
      <section className="landing landing--closed">
        <Badge tone="warning">가을축제</Badge>
        <h1 className="landing__closed-title">지금은 접수가 끝났어요</h1>
        <p className="landing__closed-desc">다음 배치 접수가 열리면 이 화면이 자동으로 바뀌어요.</p>
      </section>
    );
  }

  if (alreadyJoined) {
    return (
      <section className="landing landing--closed">
        <img src={mascotBadge} alt="" className="landing__mascot landing__mascot--closed" aria-hidden="true" />
        <h1 className="landing__closed-title">이미 참여하셨습니다</h1>
        <p className="landing__closed-desc">마이페이지에서 매칭 대기 상태를 확인할 수 있어요.</p>
        <Button variant="primary" onClick={onGoToMyPage}>
          마이페이지로 이동
        </Button>
      </section>
    );
  }

  return (
    <section className="landing">
      <div className="landing__top">
        <span className="landing__logo font-accent" aria-hidden="true">
          {EVENT_CONFIG.programName}
        </span>
        <Badge>가을축제</Badge>
      </div>

      <div className="landing__hero">
        <img src={mascotBadge} alt={EVENT_CONFIG.programName} className="landing__mascot" />
        <h1 className="landing__title font-accent">{EVENT_CONFIG.programName}</h1>
        <p className="landing__desc">{EVENT_CONFIG.tagline}</p>
      </div>

      <p className="landing__meta">
        {EVENT_CONFIG.eventPeriod} · {EVENT_CONFIG.eventHours}
        <br />
        {EVENT_CONFIG.venue}
      </p>

      <p className="landing__trust">연락 정보는 동의한 경우에만, 팔로우 인증 후 공개해요.</p>

      <Button variant="primary" onClick={onStart}>
        참여하기
      </Button>
    </section>
  );
}
