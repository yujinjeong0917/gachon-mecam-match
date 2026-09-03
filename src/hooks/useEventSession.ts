import { useEffect, useState } from "react";
import { isSupabaseConfigured, supabase } from "../lib/supabase";

interface EventSessionState {
  ready: boolean;
  eventId: string | null;
  error: string | null;
}

let cachedEventId: string | null = null;

/**
 * 참가자 익명 세션(auth.uid())을 보장하고, 현재 활성 이벤트의 id를 가져온다.
 * VITE_EVENT_SLUG가 지정돼 있으면 그 슬러그로, 없으면 가장 최근 이벤트로 찾는다.
 * 이벤트 id는 세션 동안 바뀌지 않으므로 모듈 스코프에 캐시해 페이지 이동마다 다시 조회하지 않는다.
 */
export function useEventSession(): EventSessionState {
  const [state, setState] = useState<EventSessionState>({
    ready: cachedEventId !== null,
    eventId: cachedEventId,
    error: null,
  });

  useEffect(() => {
    if (cachedEventId) return;
    if (!isSupabaseConfigured || !supabase) {
      setState({ ready: true, eventId: null, error: "SUPABASE_NOT_CONFIGURED" });
      return;
    }

    let cancelled = false;

    async function bootstrap() {
      if (!supabase) return;
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        const { error: signInError } = await supabase.auth.signInAnonymously();
        if (signInError) {
          if (!cancelled) setState({ ready: true, eventId: null, error: signInError.message });
          return;
        }
      }

      const slug = import.meta.env.VITE_EVENT_SLUG;
      const query = supabase.from("events").select("id").order("starts_at", { ascending: false }).limit(1);
      const { data, error: queryError } = await (slug ? query.eq("slug", slug) : query).maybeSingle();
      if (cancelled) return;
      if (queryError || !data) {
        setState({ ready: true, eventId: null, error: queryError?.message ?? "EVENT_NOT_FOUND" });
        return;
      }
      cachedEventId = data.id as string;
      setState({ ready: true, eventId: cachedEventId, error: null });
    }

    bootstrap();
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
