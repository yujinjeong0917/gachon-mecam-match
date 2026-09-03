import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { EVENT_CONFIG } from "../config/eventConfig";
import { useEventSession } from "../hooks/useEventSession";
import { useMyResult } from "../hooks/useMyResult";
import { supabase } from "../lib/supabase";
import { CheatkeySheet } from "../screens/CheatkeySheet";
import { ResultScreen } from "../screens/ResultScreen";

interface UnlockedContact {
  handle: string;
  phone: string;
  preference: string;
}

/** GET /me/result를 10초 간격으로 폴링한다 — matched 이후에도 cheatkey.status는 계속 바뀔 수 있다. */
export function ResultPage() {
  const navigate = useNavigate();
  const { eventId } = useEventSession();
  const { result, loading, refresh } = useMyResult(eventId, 10000);
  const [cheatkeyOpen, setCheatkeyOpen] = useState(false);
  const [contact, setContact] = useState<UnlockedContact | null>(null);

  const redirectTarget = !loading && result && (result.status === "not_found" || result.status === "waiting") ? (result.status === "waiting" ? "/waiting" : "/") : null;

  useEffect(() => {
    if (redirectTarget) navigate(redirectTarget, { replace: true });
  }, [redirectTarget, navigate]);

  const cheatkeyStatus = result?.status === "matched" ? result.cheatkey.status : "locked";

  useEffect(() => {
    if (!supabase || !eventId || result?.status !== "matched" || cheatkeyStatus !== "unlocked" || contact) return;
    supabase
      .rpc("get_my_unlocked_contact", { p_event_id: eventId, p_match_id: result.match_id })
      .then(({ data }) => {
        const d = data as { status: string; instagram_handle?: string; phone_number?: string; contact_preference?: string };
        if (d?.status === "unlocked") {
          setContact({ handle: d.instagram_handle ?? "-", phone: d.phone_number ?? "-", preference: d.contact_preference ?? "" });
        }
      });
  }, [eventId, result, cheatkeyStatus, contact]);

  const handleRequestFollow = () => {
    if (!supabase || !eventId || result?.status !== "matched") return;
    supabase.rpc("request_my_cheatkey_unlock", { p_event_id: eventId, p_match_id: result.match_id }).then(() => refresh());
  };

  if (!eventId || loading || redirectTarget) {
    return null;
  }

  if (!result || result.status === "not_found" || result.status === "waiting") {
    return null; // 리다이렉트 처리 중
  }

  if (result.status === "pending_reveal") {
    return (
      <section style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, padding: 24, textAlign: "center" }}>
        <p style={{ fontWeight: 700 }}>매칭은 됐어요!</p>
        <p style={{ color: "var(--color-text-muted)", fontSize: 14 }}>{result.message}</p>
      </section>
    );
  }

  const partner = result.partner;

  return (
    <>
      <ResultScreen
        partner={{
          nickname: partner.nickname,
          department: partner.department,
          grade: partner.grade,
          matchScore: result.match_score,
          sharedInterests: partner.shared_interests ?? [],
          activity: partner.activities?.[0] ?? "",
          oneLiner: partner.one_liner ?? "",
        }}
        onOpenCheatkey={() => setCheatkeyOpen(true)}
        onWithdraw={() => navigate("/")}
      />
      <CheatkeySheet
        open={cheatkeyOpen}
        onClose={() => setCheatkeyOpen(false)}
        officialInstagramUrl={EVENT_CONFIG.officialInstagram.url}
        unlockedHandle="-"
        unlockedPhone="-"
        contactPreference=""
        status={cheatkeyStatus}
        onRequestFollow={handleRequestFollow}
        contact={contact}
      />
    </>
  );
}
