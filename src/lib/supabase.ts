import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

/** false면 백엔드 미설정 상태 — 화면은 뜨지만 실제 제출/조회는 못한다. 개발 중 빈 .env로도 앱이 죽지 않게 하기 위함. */
export const isSupabaseConfigured = Boolean(url && anonKey);

/**
 * 참가자 신원은 로그인 없이 Supabase 익명 인증(auth.uid())으로 식별한다.
 * private.participants.auth_user_id가 이 uid를 그대로 참조한다(supabase/migrations 참고).
 * 운영자(관리자)는 이 클라이언트로 별도 이메일·비밀번호 로그인을 한다 — 세션은 한 브라우저에 하나뿐이라
 * 참가자 세션과 관리자 세션을 같은 기기에서 동시에 쓰려면 다른 프로필/시크릿 창을 써야 한다.
 */
export const supabase = url && anonKey ? createClient(url, anonKey, { auth: { persistSession: true, autoRefreshToken: true } }) : null;
