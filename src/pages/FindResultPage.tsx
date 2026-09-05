import { useState } from "react";
import { Button } from "../components/Button";
import { Field } from "../components/Field";
import { useEventSession } from "../hooks/useEventSession";
import { supabase } from "../lib/supabase";
import "./FindResultPage.css";

interface Partner {
  nickname: string;
  department: string;
  grade: number;
  mbti: string | null;
  traits: string[];
  activities: string[];
  one_liner: string | null;
}

interface LookupResult {
  status: "not_found" | "waiting" | "pending_reveal" | "matched";
  matching_number?: string;
  match_score?: number;
  message?: string;
  partner?: Partner;
}

/** 신청했던 기기가 아닌 곳(문자로 받은 링크 등)에서, 매칭번호+복구코드로 내 상태를 다시 확인하는 화면. */
export function FindResultPage() {
  const { eventId } = useEventSession();
  const [matchingNumber, setMatchingNumber] = useState("");
  const [recoveryCode, setRecoveryCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<LookupResult | null>(null);

  const canSubmit = matchingNumber.trim().length > 0 && recoveryCode.trim().length > 0 && !!eventId;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase || !eventId) return;
    setLoading(true);
    setError(null);
    setResult(null);
    const { data, error: rpcError } = await supabase.rpc("lookup_by_recovery_code", {
      p_event_id: eventId,
      p_matching_number: matchingNumber.trim(),
      p_recovery_code: recoveryCode.trim(),
    });
    setLoading(false);
    if (rpcError) {
      setError("조회에 실패했어요. 잠시 후 다시 시도해주세요.");
      return;
    }
    setResult(data as LookupResult);
  };

  return (
    <section className="find-result">
      <h1>내 결과 다시 찾기</h1>
      <p className="find-result__lead">
        신청했던 기기가 아니어도, 신청 직후 받았던 매칭번호와 복구 코드로 상태를 확인할 수 있어요.
      </p>

      <form onSubmit={handleSubmit} className="find-result__form">
        <Field label="매칭번호" placeholder="예: M-012" value={matchingNumber} onChange={(e) => setMatchingNumber(e.target.value)} />
        <Field
          label="복구 코드"
          placeholder="6자리 숫자"
          inputMode="numeric"
          maxLength={6}
          value={recoveryCode}
          onChange={(e) => setRecoveryCode(e.target.value)}
        />
        <Button type="submit" variant="primary" loading={loading} disabled={!canSubmit}>
          조회하기
        </Button>
      </form>

      {error ? <p className="find-result__error">{error}</p> : null}

      {result?.status === "not_found" ? <p className="find-result__error">매칭번호 또는 복구 코드가 일치하지 않아요.</p> : null}

      {result?.status === "waiting" ? (
        <div className="find-result__card">
          <p>
            <strong>{result.matching_number}</strong>님, 아직 매칭 대기 중이에요.
          </p>
          <p className="find-result__hint">매칭 발표 시각에 다시 확인해주세요.</p>
        </div>
      ) : null}

      {result?.status === "pending_reveal" ? (
        <div className="find-result__card">
          <p>
            <strong>{result.matching_number}</strong>님, 매칭은 완료됐어요.
          </p>
          <p className="find-result__hint">{result.message}</p>
        </div>
      ) : null}

      {result?.status === "matched" && result.partner ? (
        <div className="find-result__card">
          <span className="find-result__score-label">설문 취향 일치도</span>
          <span className="find-result__score">{result.match_score}</span>
          <div className="find-result__partner">
            <span className="find-result__partner-name">{result.partner.nickname}</span>
            <span className="find-result__partner-meta">
              {result.partner.department} · {result.partner.grade}학년{result.partner.mbti ? ` · ${result.partner.mbti}` : ""}
            </span>
          </div>
          {result.partner.traits.length > 0 ? (
            <div className="find-result__tags">
              {result.partner.traits.map((tag) => (
                <span key={tag} className="find-result__tag">
                  {tag}
                </span>
              ))}
            </div>
          ) : null}
          {result.partner.one_liner ? <p className="find-result__one-liner">“{result.partner.one_liner}”</p> : null}
          <p className="find-result__hint">연락처 공개(팔로우 인증)는 원래 신청했던 기기에서 진행해주세요. 안 되면 운영진에게 문의해주세요.</p>
        </div>
      ) : null}
    </section>
  );
}
