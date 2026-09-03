-- EventControlPanel의 5개 스위치(registration_open/matching_enabled/result_reveal_enabled/
-- cheat_unlock_enabled/fallback_mode)를 실제로 event_features에 반영하는 게이팅 함수.
-- 컬럼명을 클라이언트가 직접 넘기게 하지 않고 고정된 화이트리스트로만 받는다.

set search_path = private, public;

create or replace function public.admin_set_event_feature(p_event_id uuid, p_flag text, p_enabled boolean)
returns jsonb
language plpgsql
security definer
set search_path = private, public
as $$
begin
  if not private.is_operator(p_event_id, 'admin') then
    raise exception 'FORBIDDEN';
  end if;

  if p_flag not in ('registration_open', 'matching_enabled', 'result_reveal_enabled', 'cheat_unlock_enabled', 'fallback_mode') then
    raise exception 'INVALID_FLAG';
  end if;

  update public.event_features set
    registration_open = case when p_flag = 'registration_open' then p_enabled else registration_open end,
    matching_enabled = case when p_flag = 'matching_enabled' then p_enabled else matching_enabled end,
    result_reveal_enabled = case when p_flag = 'result_reveal_enabled' then p_enabled else result_reveal_enabled end,
    cheat_unlock_enabled = case when p_flag = 'cheat_unlock_enabled' then p_enabled else cheat_unlock_enabled end,
    fallback_mode = case when p_flag = 'fallback_mode' then p_enabled else fallback_mode end
  where event_id = p_event_id;

  insert into private.audit_events (event_id, actor_type, actor_id, action, entity_type, metadata)
  values (p_event_id, 'operator', auth.uid()::text, 'event_feature_toggled', 'event_features', jsonb_build_object('flag', p_flag, 'enabled', p_enabled));

  return jsonb_build_object('status', 'ok', 'flag', p_flag, 'enabled', p_enabled);
end;
$$;

grant execute on function public.admin_set_event_feature(uuid, text, boolean) to authenticated;

-- EventControlPanel/OverviewPanel이 현재 플래그 상태를 그대로 읽을 수 있도록.
create or replace function public.admin_get_event_features(p_event_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = private, public
as $$
declare
  v_features public.event_features%rowtype;
begin
  if not private.is_operator(p_event_id) then
    raise exception 'FORBIDDEN';
  end if;

  select * into v_features from public.event_features where event_id = p_event_id;
  if v_features.event_id is null then
    return jsonb_build_object('status', 'not_found');
  end if;

  return jsonb_build_object(
    'status', 'ok',
    'registration_open', v_features.registration_open,
    'matching_enabled', v_features.matching_enabled,
    'result_reveal_enabled', v_features.result_reveal_enabled,
    'cheat_unlock_enabled', v_features.cheat_unlock_enabled,
    'fallback_mode', v_features.fallback_mode
  );
end;
$$;

grant execute on function public.admin_get_event_features(uuid) to authenticated;
