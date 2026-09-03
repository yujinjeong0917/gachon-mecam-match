-- 접수 퍼널(FunnelPanel) 6단계 중 4개(제출성공/대기/매칭/치트키해제)는 기존 테이블에서 바로 계산되지만,
-- "시작"(랜딩 조회)과 "결과 열람"은 지금까지 아무 데도 기록되지 않는 페이지뷰 이벤트라 새로 저장소가 필요하다.
-- 개인정보가 아니라 익명 세션(auth.uid())당 1회 방문 여부만 세므로 consents.analytics 동의와는 별개로 둔다
-- (GA4 대체가 아니라 운영 대시보드용 최소 집계 — 문서05 §7에서 GA4를 언급한 것과는 다른 용도).

set search_path = private, public;

create table private.funnel_events (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  auth_user_id uuid not null,
  stage text not null check (stage in ('landing_view', 'result_view')),
  created_at timestamptz not null default now(),
  unique (event_id, auth_user_id, stage)
);

create index funnel_events_event_stage_idx on private.funnel_events (event_id, stage);

create or replace function public.log_my_funnel_event(p_event_id uuid, p_stage text)
returns jsonb
language plpgsql
security definer
set search_path = private, public
as $$
begin
  if auth.uid() is null then
    return jsonb_build_object('status', 'skipped');
  end if;
  if p_stage not in ('landing_view', 'result_view') then
    raise exception 'invalid stage';
  end if;

  insert into private.funnel_events (event_id, auth_user_id, stage)
  values (p_event_id, auth.uid(), p_stage)
  on conflict (event_id, auth_user_id, stage) do nothing;

  return jsonb_build_object('status', 'ok');
end;
$$;

grant execute on function public.log_my_funnel_event(uuid, text) to anon, authenticated;

create or replace function public.admin_get_funnel(p_event_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = private, public
as $$
declare
  v_landing int;
  v_submitted int;
  v_waiting int;
  v_matched int;
  v_result_view int;
  v_cheatkey_unlocked int;
begin
  if not private.is_operator(p_event_id) then
    raise exception 'FORBIDDEN';
  end if;

  select count(*) into v_landing from private.funnel_events where event_id = p_event_id and stage = 'landing_view';
  select count(*) into v_submitted from private.participants where event_id = p_event_id;
  select count(*) into v_waiting from private.participants where event_id = p_event_id and status = 'waiting';
  select count(*) into v_matched from private.participants where event_id = p_event_id and status = 'matched';
  select count(*) into v_result_view from private.funnel_events where event_id = p_event_id and stage = 'result_view';
  select count(distinct ma.viewer_participant_id) into v_cheatkey_unlocked
    from private.match_access ma
    join private.matches m on m.id = ma.match_id
    where m.event_id = p_event_id and ma.status = 'unlocked';

  return jsonb_build_object(
    'landing_view', greatest(v_landing, v_submitted),
    'submit_success', v_submitted,
    'waiting', v_waiting,
    'matched', v_matched,
    'result_view', v_result_view,
    'cheatkey_unlocked', v_cheatkey_unlocked
  );
end;
$$;

grant execute on function public.admin_get_funnel(uuid) to authenticated;
