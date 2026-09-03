import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

export interface MyResultPartner {
  nickname: string;
  department: string;
  grade: number;
  mbti: string | null;
  traits: string[];
  shared_interests: string[] | null;
  activities: string[] | null;
  one_liner: string | null;
}

export type MyResult =
  | { status: "not_found" }
  | { status: "waiting" }
  | { status: "pending_reveal"; message: string }
  | {
      status: "matched";
      match_id: string;
      match_score: number;
      score_label: string;
      partner: MyResultPartner;
      cheatkey: { status: "locked" | "waiting_for_operator" | "unlocked" };
    };

interface UseMyResultResult {
  result: MyResult | null;
  loading: boolean;
  refresh: () => Promise<void>;
}

/** public.get_my_result(event_id) 래핑. pollMs를 주면 waiting/pending_reveal 상태에서만 계속 다시 확인한다. */
export function useMyResult(eventId: string | null, pollMs?: number): UseMyResultResult {
  const [result, setResult] = useState<MyResult | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!supabase || !eventId) {
      setLoading(false);
      return;
    }
    const { data, error } = await supabase.rpc("get_my_result", { p_event_id: eventId });
    if (!error && data) {
      setResult(data as MyResult);
    }
    setLoading(false);
  }, [eventId]);

  useEffect(() => {
    refresh();
    if (!pollMs) return;
    // matched 이후에도 cheatkey.status(locked → waiting_for_operator → unlocked)가 계속 바뀔 수 있어 계속 폴링한다.
    const id = window.setInterval(refresh, pollMs);
    return () => window.clearInterval(id);
  }, [refresh, pollMs]);

  return { result, loading, refresh };
}
