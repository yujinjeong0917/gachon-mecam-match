-- "ACTIVE_PREVIEW_EXISTS" 에러 발생 시(이전 미리보기를 확정도 폐기도 안 한 채 남겨둔 경우)
-- 운영자가 직접 SQL 없이 초기화할 수 있게 하는 RPC.

create or replace function public.admin_discard_active_preview(p_event_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = private, public
as $$
declare
  v_count int;
begin
  if not private.is_operator(p_event_id, 'matcher') then
    raise exception 'FORBIDDEN';
  end if;

  update private.matching_runs
    set status = 'rolled_back'
    where event_id = p_event_id and status = 'previewed';
  get diagnostics v_count = row_count;

  return jsonb_build_object('status', 'ok', 'discarded_count', v_count);
end;
$$;

grant execute on function public.admin_discard_active_preview(uuid) to authenticated;
