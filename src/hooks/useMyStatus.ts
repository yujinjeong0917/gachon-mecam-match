import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

export interface MyStatus {
  participant_status: "not_found" | "draft" | "waiting" | "matched" | "withdrawn" | "cancelled";
  matching_number?: string;
  result_available?: boolean;
}

interface UseMyStatusResult {
  status: MyStatus | null;
  loading: boolean;
  refresh: () => Promise<void>;
}

/** public.get_my_status(event_id) 래핑. pollMs를 주면 그 간격으로 다시 조회한다(매칭 대기 화면용). */
export function useMyStatus(eventId: string | null, pollMs?: number): UseMyStatusResult {
  const [status, setStatus] = useState<MyStatus | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!supabase || !eventId) {
      setLoading(false);
      return;
    }
    const { data, error } = await supabase.rpc("get_my_status", { p_event_id: eventId });
    if (!error && data) {
      setStatus(data as MyStatus);
    }
    setLoading(false);
  }, [eventId]);

  useEffect(() => {
    refresh();
    if (!pollMs) return;
    const id = window.setInterval(refresh, pollMs);
    return () => window.clearInterval(id);
  }, [refresh, pollMs]);

  return { status, loading, refresh };
}
