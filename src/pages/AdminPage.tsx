import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useEventSession } from "../hooks/useEventSession";
import { supabase } from "../lib/supabase";
import { AdminDashboard } from "../screens/AdminDashboard";
import "./AdminPage.css";

type Guard = "checking" | "signed_out" | "not_operator" | "ok";

/** /admin 라우트 가드. 관리자용 RPC는 이미 서버에서 is_operator()로 게이팅되지만, 로그인 안 된 화면이 뜨는 건 그 자체로 UX 문제라 별도로 막는다. */
export function AdminPage() {
  const navigate = useNavigate();
  const { eventId, ready } = useEventSession();
  const [guard, setGuard] = useState<Guard>("checking");

  useEffect(() => {
    if (!ready || !eventId || !supabase) return;
    let cancelled = false;

    async function check() {
      if (!supabase) return;
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session || session.user.is_anonymous) {
        if (!cancelled) setGuard("signed_out");
        return;
      }
      const { data, error } = await supabase.rpc("am_i_operator", { p_event_id: eventId });
      if (cancelled) return;
      setGuard(!error && data === true ? "ok" : "not_operator");
    }

    check();
    return () => {
      cancelled = true;
    };
  }, [ready, eventId]);

  useEffect(() => {
    if (guard === "signed_out") navigate("/admin/login", { replace: true });
  }, [guard, navigate]);

  if (guard === "checking" || guard === "signed_out") {
    return null;
  }

  if (guard === "not_operator") {
    return (
      <div className="admin-page">
        <p>이 계정은 운영자 권한이 없어요. 다른 계정으로 로그인해주세요.</p>
      </div>
    );
  }

  return (
    <div className="admin-page">
      <AdminDashboard />
    </div>
  );
}
