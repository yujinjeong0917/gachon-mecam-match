-- 17:00 일괄 알림용 Web Push 구독 저장. 참가자 1명이 여러 기기/브라우저에서 구독할 수 있으므로
-- endpoint 단위로 저장한다(참가자당 1개가 아니라 endpoint당 1행).

set search_path = private, public;

create table private.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  participant_id uuid not null references private.participants(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now(),
  unique (participant_id, endpoint)
);

create index push_subscriptions_event_idx on private.push_subscriptions (event_id);

-- 참가자 본인 구독 저장/갱신 (문서03 §4 스타일: POST /me/push-subscription 대응).
create or replace function public.save_my_push_subscription(p_event_id uuid, p_endpoint text, p_p256dh text, p_auth text)
returns jsonb
language plpgsql
security definer
set search_path = private, public
as $$
declare
  v_me uuid;
begin
  select id into v_me from private.participants where event_id = p_event_id and auth_user_id = auth.uid();
  if v_me is null then
    return jsonb_build_object('status', 'not_found');
  end if;

  insert into private.push_subscriptions (participant_id, event_id, endpoint, p256dh, auth)
  values (v_me, p_event_id, p_endpoint, p_p256dh, p_auth)
  on conflict (participant_id, endpoint) do update set p256dh = excluded.p256dh, auth = excluded.auth;

  return jsonb_build_object('status', 'ok');
end;
$$;

grant execute on function public.save_my_push_subscription(uuid, text, text, text) to anon, authenticated;
