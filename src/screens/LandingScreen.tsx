import { Badge } from "../components/Badge";
import { Button } from "../components/Button";
import { EVENT_CONFIG } from "../config/eventConfig";
import "./LandingScreen.css";

interface Props {
  registrationOpen: boolean;
  onStart: () => void;
}

/** 문서02 §4.1 카피 그대로. registrationOpen=false면 CTA를 비활성화하지 않고 상태 화면으로 전환한다. */
export function LandingScreen({ registrationOpen, onStart }: Props) {
  if (!registrationOpen) {
    return (
      <section className="landing landing--closed">
        <Badge tone="warning">가을축제</Badge>
        <h1 className="landing__closed-title">지금은 접수가 끝났어요</h1>
        <p className="landing__closed-desc">다음 배치 접수가 열리면 이 화면이 자동으로 바뀌어요.</p>
      </section>
    );
  }

  return (
    <section className="landing">
      <div className="landing__top">
        <span className="landing__logo" aria-hidden="true">
          {EVENT_CONFIG.programName}
        </span>
        <Badge>가을축제</Badge>
      </div>

      <div className="landing__hero">
        <h1 className="landing__title">취향이 닿는 한 사람을 찾아봐요</h1>
        <p className="landing__desc">2~3분 설문을 바탕으로 서로의 조건이 잘 맞는 사람을 찾아드려요.</p>
      </div>

      <p className="landing__trust">연락 정보는 동의한 경우에만, 팔로우 인증 후 공개해요.</p>

      <Button variant="primary" onClick={onStart}>
        매칭 시작하기
      </Button>
    </section>
  );
}
