import "./WaitingScreen.css";

interface Props {
  matchingNumber: string;
  recoveryCode: string;
  nextMatchingAt: string;
}

/** 문서02 §4.5. Liquid Glass는 기본 미사용이므로(문서02 §2) walnut 티켓 프레임으로 대체. */
export function WaitingScreen({ matchingNumber, recoveryCode, nextMatchingAt }: Props) {
  return (
    <section className="waiting">
      <p className="waiting__lead">신청했어요. 다음 매칭까지 잠시만 기다려 주세요</p>

      <div className="waiting__ticket">
        <span className="waiting__ticket-label">MATCHING NUMBER</span>
        <span className="waiting__ticket-number tabular-nums">{matchingNumber}</span>
        <div className="waiting__ticket-divider" aria-hidden="true" />
        <span className="waiting__ticket-label">복구 코드</span>
        <span className="waiting__ticket-code tabular-nums">{recoveryCode}</span>
      </div>

      <p className="waiting__capture-hint">이 화면을 캡처해 주세요</p>

      <div className="waiting__status">
        <span className="waiting__pulse" aria-hidden="true" />
        <span>5분마다 새 후보를 확인해요 · 다음 매칭 {nextMatchingAt}</span>
      </div>

      <p className="waiting__empty-note">아직 조건이 잘 맞는 상대를 찾지 못했어요. 다음 매칭에 다시 찾아볼게요.</p>
    </section>
  );
}
