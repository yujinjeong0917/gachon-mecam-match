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
  status: "not_found" | "waiting" | "pending_reveal" | "matched" | "rate_limited";
  matching_number?: string;
  match_score?: number;
  message?: string;
  partner?: Partner;
}

type Mode = "code" | "nickname";

/** 신청했던 기기가 아닌 곳(문자로 받은 링크 등)에서 내 상태를 다시 확인하는 화면. */
export function FindResultPage() {
  const { eventId } = useEventSession();
  const [mode, setMode] = useState<Mode>("code");
  const [matchingNumber, setMatchingNumber] = useState("");
  const [recoveryCode, setRecoveryCode] = useState("");
  const [nickname, setNickname] = useState("");
  const [phoneLast4, setPhoneLast4] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<LookupResult | null>(null);

  const canSubmit =
    !!eventId &&
    (mode === "code"
      ? matchingNumber.trim().length > 0 && recoveryCode.trim().length > 0
      : nickname.trim().length > 0 && phoneLast4.trim().length === 4);

  const switchMode = (next: Mode) => {
    setMode(next);
    setResult(null);
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase || !eventId) return;
    setLoading(true);
    setError(null);
    setResult(null);
    const { data, error: rpcError } =
      mode === "code"
        ? await supabase.rpc("lookup_by_recovery_code", {
            p_event_id: eventId,
            p_matching_number: matchingNumber.trim(),
            p_recovery_code: recoveryCode.trim(),
          })
        : await supabase.rpc("lookup_by_nickname_phone", {
            p_event_id: eventId,
            p_nickname: nickname.trim(),
            p_phone_last4: phoneLast4.trim(),
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
      <p className="find-result__lead">신청했던 기기가 아니어도, 아래 정보로 지금 상태를 확인할 수 있어요.</p>

      <div className="find-result__tabs">
        <button type="button" className={`find-result__tab${mode === "code" ? " is-active" : ""}`} onClick={() => switchMode("code")}>
          매칭번호 + 복구코드
        </button>
        <button type="button" className={`find-result__tab${mode === "nickname" ? " is-active" : ""}`} onClick={() => switchMode("nickname")}>
          복구코드를 몰라요
        </button>
      </div>

      <form onSubmit={handleSubmit} className="find-result__form">
        {mode === "code" ? (
          <>
            <Field label="매칭번호" placeholder="예: M-012" value={matchingNumber} onChange={(e) => setMatchingNumber(e.target.value)} />
            <Field
              label="복구 코드"
              placeholder="6자리 숫자"
              inputMode="numeric"
              maxLength={6}
              value={recoveryCode}
              onChange={(e) => setRecoveryCode(e.target.value)}
            />
          </>
        ) : (
          <>
            <Field
              label="신청할 때 쓴 닉네임"
              placeholder="예: 가을밤"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              helper="설문에 적었던 닉네임 그대로 입력해주세요."
            />
            <Field
              label="전화번호 뒷자리 4자리"
              placeholder="예: 5678"
              inputMode="numeric"
              maxLength={4}
              value={phoneLast4}
              onChange={(e) => setPhoneLast4(e.target.value.replace(/\D/g, ""))}
            />
          </>
        )}
        <Button type="submit" variant="primary" loading={loading} disabled={!canSubmit}>
          조회하기
        </Button>
      </form>

      {error ? <p className="find-result__error">{error}</p> : null}

      {result?.status === "rate_limited" ? (
        <p className="find-result__error">너무 여러 번 시도했어요. 10분 후 다시 시도해주세요.</p>
      ) : null}

      {result?.status === "not_found" ? (
        <p className="find-result__error">
          {mode === "code" ? "매칭번호 또는 복구 코드가 일치하지 않아요." : "입력하신 정보와 일치하는 신청 내역을 찾을 수 없어요."}
        </p>
      ) : null}

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
