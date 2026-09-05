import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";
import webpush from "web-push";

/**
 * 17:00 일괄 알림 발송. 어드민 대시보드의 "지금 일괄 알림 보내기" 버튼이 이 엔드포인트를 호출한다.
 * 호출자의 Authorization 헤더(운영자 로그인 세션의 access token)로 private.is_operator()를 검증한다.
 * (예전엔 VITE_ 접두사가 붙은 공유 비밀키로만 막아뒀는데, 그 값이 그대로 공개 JS 번들에 평문으로
 * 들어가 있어 누구나 꺼내 쓸 수 있었다 — 이제 실제 운영자 로그인이 붙었으니 그 방식으로 교체한다.)
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "method_not_allowed" });
    return;
  }

  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) {
    res.status(401).json({ error: "unauthorized" });
    return;
  }

  const { event_id, title, body, url } = req.body ?? {};
  if (!event_id || !title) {
    res.status(400).json({ error: "event_id and title are required" });
    return;
  }

  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY || !process.env.VITE_SUPABASE_ANON_KEY) {
    res.status(500).json({ error: "Supabase env vars not configured" });
    return;
  }
  if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
    res.status(500).json({ error: "VAPID keys not configured" });
    return;
  }

  const callerClient = createClient(process.env.SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: isOperator, error: operatorCheckError } = await callerClient.rpc("am_i_operator", { p_event_id: event_id });
  if (operatorCheckError || isOperator !== true) {
    res.status(403).json({ error: "forbidden" });
    return;
  }

  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

  const { data: subs, error } = await supabase.rpc("list_push_subscriptions_for_notify", { p_event_id: event_id });

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || "mailto:admin@example.com",
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );

  const payload = JSON.stringify({ title, body: body ?? "", url: url ?? "/" });
  const staleIds: string[] = [];

  const results = await Promise.allSettled(
    (subs ?? []).map((sub: { id: string; endpoint: string; p256dh: string; auth: string }) =>
      webpush
        .sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, payload)
        .catch((err) => {
          // 만료/취소된 구독은 다음 발송 전에 정리한다.
          if (err?.statusCode === 404 || err?.statusCode === 410) staleIds.push(sub.id);
          throw err;
        })
    )
  );

  if (staleIds.length > 0) {
    await supabase.rpc("delete_push_subscriptions", { p_ids: staleIds });
  }

  const sent = results.filter((r) => r.status === "fulfilled").length;
  const failed = results.length - sent;

  res.status(200).json({ total: results.length, sent, failed, removed_stale: staleIds.length });
}
