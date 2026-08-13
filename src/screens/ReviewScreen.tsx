import { useState } from "react";
import { Button } from "../components/Button";
import "./ReviewScreen.css";

interface DraftSummary {
  nickname: string;
  department: string;
  grade: number;
  traits: string[];
  interests: string[];
  instagramHandle: string;
}

interface Props {
  draft: DraftSummary;
  onSubmitted: () => void;
}

/** Instagram ID를 yu***n처럼 마스킹. 문서02 §4.4 규칙. */
function maskHandle(handle: string) {
  if (handle.length <= 3) return `${handle[0] ?? ""}**`;
  return `${handle.slice(0, 2)}${"*".repeat(Math.max(1, handle.length - 3))}${handle.slice(-1)}`;
}

/** 문서02 §4.4: 제출 중 버튼 잠금 + ProgressCircle. 네트워크 재시도는 같은 idempotency key를 사용한다(실제 API 연동 시). */
export function ReviewScreen({ draft, onSubmitted }: Props) {
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = () => {
    setSubmitting(true);
    // TODO: POST /me/submissions, Idempotency-Key: client_submission_uuid (문서03 §4)
    window.setTimeout(() => {
      setSubmitting(false);
      onSubmitted();
    }, 900);
  };

  return (
    <section className="review">
      <h1 className="review__title">이렇게 신청할게요</h1>

      <div className="review__card">
        <h2 className="review__card-title">상대에게 이렇게 보여요</h2>
        <dl className="review__list">
          <div>
            <dt>닉네임</dt>
            <dd>{draft.nickname}</dd>
          </div>
          <div>
            <dt>학과·학년</dt>
            <dd>
              {draft.department} · {draft.grade}학년
            </dd>
          </div>
          <div>
            <dt>성격 태그</dt>
            <dd>{draft.traits.join(", ")}</dd>
          </div>
          <div>
            <dt>관심사</dt>
            <dd>{draft.interests.join(", ")}</dd>
          </div>
        </dl>
      </div>

      <div className="review__card review__card--muted">
        <h2 className="review__card-title">운영진만 보는 정보</h2>
        <dl className="review__list">
          <div>
            <dt>Instagram ID</dt>
            <dd>{maskHandle(draft.instagramHandle)}</dd>
          </div>
        </dl>
        <p className="review__note">
          팔로우 인증이 완료되고 운영진이 확인한 뒤에만 상대 1명에게 원문 ID가 공개돼요.
        </p>
      </div>

      <Button variant="primary" loading={submitting} onClick={handleSubmit}>
        이 내용으로 매칭 신청하기
      </Button>
    </section>
  );
}
