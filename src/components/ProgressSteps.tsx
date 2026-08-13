import "./ProgressSteps.css";

interface Props {
  current: number;
  total: number;
  label: string;
}

/** 문서02 §4.3: "Progress bar가 없다면 얇은 custom indicator를 SEED 토큰으로 만든다." */
export function ProgressSteps({ current, total, label }: Props) {
  return (
    <div className="progress-steps">
      <div className="progress-steps__row">
        <span className="progress-steps__count">
          {current}/{total}
        </span>
        <span className="progress-steps__label">{label}</span>
      </div>
      <div className="progress-steps__track" role="progressbar" aria-valuenow={current} aria-valuemin={1} aria-valuemax={total}>
        <div className="progress-steps__fill" style={{ width: `${(current / total) * 100}%` }} />
      </div>
    </div>
  );
}
