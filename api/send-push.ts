import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";
import webpush from "web-push";

/**
 * 17:00 일괄 알림 발송. 어드민 대시보드의 "지금 일괄 알림 보내기" 버튼이 이 엔드포인트를 호출한다.
 * 참가자 인증이 아직 프런트에 안 붙어 있어(문서03 §4 대응 전) x-admin-token 공유 비밀키로만 막아둔다 —
 * 실제 운영자 로그인이 붙으면 이 토큰 체크를 private.is_operator() 기반 검증으로 교체해야 한다.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "method_not_allowed" });
    return;
  }

  const adminToken = req.headers["x-admin-token"];
  if (!process.env.ADMIN_NOTIFY_SECRET || adminToken !== process.env.ADMIN_NOTIFY_SECRET) {
    res.status(401).json({ error: "unauthorized" });
    return;
  }

  const { event_id, title, body, url } = req.body ?? {};
  if (!event_id || !title) {
    res.status(400).json({ error: "event_id and title are required" });
    return;
  }

  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    res.status(500).json({ error: "SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not configured" });
    return;
  }
  if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
    res.status(500).json({ error: "VAPID keys not configured" });
    return;
  }

  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    db: { schema: "private" },
  });

  const { data: subs, error } = await supabase
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("event_id", event_id);

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
    (subs ?? []).map((sub) =>
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
    await supabase.from("push_subscriptions").delete().in("id", staleIds);
  }

  const sent = results.filter((r) => r.status === "fulfilled").length;
  const failed = results.length - sent;

  res.status(200).json({ total: results.length, sent, failed, removed_stale: staleIds.length });
}
