import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { isSupabaseConfigured, supabase } from "../lib/supabase";
import "./AdminLoginPage.css";

export function AdminLoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!supabase) {
      setError("서버 설정이 없어 로그인할 수 없어요.");
      return;
    }
    setSubmitting(true);
    setError(null);
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    setSubmitting(false);
    if (signInError) {
      setError("이메일 또는 비밀번호가 올바르지 않아요.");
      return;
    }
    navigate("/admin");
  };

  return (
    <div className="admin-login">
      <form className="admin-login__card" onSubmit={handleSubmit}>
        <h1>운영자 로그인</h1>
        {!isSupabaseConfigured ? <p className="admin-login__warning">서버가 아직 설정되지 않았어요.</p> : null}
        <label>
          이메일
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="username" />
        </label>
        <label>
          비밀번호
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" />
        </label>
        {error ? <p className="admin-login__error">{error}</p> : null}
        <button type="submit" disabled={submitting}>
          {submitting ? "로그인 중…" : "로그인"}
        </button>
      </form>
    </div>
  );
}
