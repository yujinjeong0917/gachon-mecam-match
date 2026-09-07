import { useState } from "react";
import { Button } from "../components/Button";
import { useDraft } from "../context/DraftContext";
import "./ReviewScreen.css";

export interface SubmitResult {
  status: "ok" | "already_submitted";
  matchingNumber: string;
  recoveryCode?: string;
}

interface Props {
  onSubmitted: (result?: SubmitResult) => void;
  /**
   * 실제 제출 로직은 페이지(ReviewPage)가 주입한다 — Screen은 UI에만 집중.
   * 주입하지 않으면(GuidePage 데모용) 예전처럼 900ms 후 성공한 것처럼 넘어간다.
   */
  onSubmit?: () => Promise<SubmitResult>;
}

/** Instagram ID를 yu***n처럼 마스킹. 문서02 §4.4 규칙. */
function maskHandle(handle: string) {
  if (handle.length <= 3) return `${handle[0] ?? ""}**`;
  return `${handle.slice(0, 2)}${"*".repeat(Math.max(1, handle.length - 3))}${handle.slice(-1)}`;
}

/** 전화번호는 가운데 자리만 마스킹: 010-****-5678 */
function maskPhone(phone: string) {
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 7) return phone;
  return `${digits.slice(0, 3)}-****-${digits.slice(-4)}`;
}

/** 문서02 §4.4: 제출 중 버튼 잠금 + ProgressCircle. */
export function ReviewScreen({ onSubmitted, onSubmit }: Props) {
  const { draft } = useDraft();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    setSubmitting(true);
    setError(null);

    if (!onSubmit) {
      // GuidePage 데모 경로 — 실제 백엔드 호출 없이 데모용으로만 넘어간다.
      window.setTimeout(() => {
        setSubmitting(false);
        onSubmitted();
      }, 900);
      return;
    }

    try {
      const result = await onSubmit();
      onSubmitted(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "제출에 실패했어요. 잠시 후 다시 시도해주세요.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="review">
      <h1 className="review__title">이렇게 신청할게요</h1>

      <div className="review__card">
        <h2 className="review__card-title">상대에게 이렇게 보여요</h2>
        <dl className="review__list">
          <div>
            <dt>닉네임</dt>
            <dd>{draft.nickname || "-"}</dd>
          </div>
          <div>
            <dt>학과·학년</dt>
            <dd>
              {draft.department || "-"} · {draft.grade ? `${draft.grade}학년` : "-"}
            </dd>
          </div>
          <div>
            <dt>성격 태그</dt>
            <dd>{draft.traits.length ? draft.traits.join(", ") : "-"}</dd>
          </div>
          <div>
            <dt>MBTI</dt>
            <dd>{draft.mbti || "-"}</dd>
          </div>
          <div>
            <dt>관심사</dt>
            <dd>{draft.interests.length ? draft.interests.join(", ") : "-"}</dd>
          </div>
          <div>
            <dt>좋아하는 음식·음악</dt>
            <dd>{[...draft.food, ...draft.music].length ? [...draft.food, ...draft.music].join(", ") : "-"}</dd>
          </div>
          <div>
            <dt>한마디</dt>
            <dd>{draft.oneLiner || "-"}</dd>
          </div>
        </dl>
      </div>

      <div className="review__card">
        <h2 className="review__card-title">상대에게 바라는 조건</h2>
        <dl className="review__list">
          <div>
            <dt>희망 성별</dt>
            <dd>{draft.seekingGender || "-"}</dd>
          </div>
          <div>
            <dt>연락 스타일</dt>
            <dd>{draft.contactStyle || "-"}</dd>
          </div>
        </dl>
      </div>

      <div className="review__card review__card--muted">
        <h2 className="review__card-title">운영진만 보는 정보</h2>
        <dl className="review__list">
          <div>
            <dt>실명</dt>
            <dd>{draft.realName ? maskHandle(draft.realName) : "-"}</dd>
          </div>
          <div>
            <dt>Instagram ID</dt>
            <dd>{draft.instagramHandle ? maskHandle(draft.instagramHandle) : "-"}</dd>
          </div>
          <div>
            <dt>전화번호</dt>
            <dd>{draft.phoneNumber ? maskPhone(draft.phoneNumber) : "-"}</dd>
          </div>
        </dl>
        <p className="review__note">
          팔로우 인증이 완료되고 운영진이 확인한 뒤에만 상대 1명에게 원문 정보가 공개돼요.
        </p>
      </div>

      {error ? <p className="review__error">{error}</p> : null}

      <Button variant="primary" loading={submitting} onClick={handleSubmit}>
        이 내용으로 매칭 신청하기
      </Button>
    </section>
  );
}
