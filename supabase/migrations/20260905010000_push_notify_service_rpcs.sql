-- /api/send-push 서버리스 함수 전용 RPC.
-- private 스키마는 PostgREST에 노출되어 있지 않아(config.toml schemas = ["public","graphql_public"]),
-- service_role 키로도 private.push_subscriptions를 직접 select/delete할 수 없었다(실제로 hosted에서
-- "Invalid schema: private" 에러로 확인됨). service_role에게만 실행 권한을 준 public 래퍼로 우회한다.

create or replace function public.list_push_subscriptions_for_notify(p_event_id uuid)
returns table (id uuid, endpoint text, p256dh text, auth text)
language sql
security definer
set search_path = private, public
stable
as $$
  select id, endpoint, p256dh, auth from private.push_subscriptions where event_id = p_event_id;
$$;

revoke all on function public.list_push_subscriptions_for_notify(uuid) from public;
grant execute on function public.list_push_subscriptions_for_notify(uuid) to service_role;

create or replace function public.delete_push_subscriptions(p_ids uuid[])
returns void
language sql
security definer
set search_path = private, public
as $$
  delete from private.push_subscriptions where id = any(p_ids);
$$;

revoke all on function public.delete_push_subscriptions(uuid[]) from public;
grant execute on function public.delete_push_subscriptions(uuid[]) to service_role;
