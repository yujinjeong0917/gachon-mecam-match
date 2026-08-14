-- 문서04 §6 RLS·권한 정책.
-- private 스키마는 브라우저 role(anon/authenticated)에서 직접 SELECT 불가 — 반드시 SECURITY DEFINER 함수를 통과해야 한다.

revoke all on schema private from anon, authenticated;
revoke all on all tables in schema private from anon, authenticated;
revoke all on all functions in schema private from anon, authenticated;

alter table public.events enable row level security;
alter table public.event_features enable row level security;

create policy "read visible events" on public.events
  for select using (status <> 'draft');

create policy "read event features of visible events" on public.event_features
  for select using (
    exists (select 1 from public.events e where e.id = event_features.event_id and e.status <> 'draft')
  );

-- 운영자 권한 테이블 (문서04 §4.4)
create table private.operator_roles (
  auth_user_id uuid not null,
  event_id uuid not null references public.events(id) on delete cascade,
  role text not null check (role in ('operator', 'matcher', 'admin')),
  active boolean not null default true,
  granted_by uuid,
  primary key (auth_user_id, event_id, role)
);

create or replace function private.is_operator(p_event_id uuid, p_min_role text default 'operator')
returns boolean
language sql
security definer
set search_path = private, public
stable
as $$
  select exists (
    select 1 from private.operator_roles
    where auth_user_id = auth.uid()
      and event_id = p_event_id
      and active
      and (
        p_min_role = 'operator'
        or (p_min_role = 'matcher' and role in ('matcher', 'admin'))
        or (p_min_role = 'admin' and role = 'admin')
      )
  );
$$;

-- 참가자 본인 상태 조회 (문서03 §4 GET /me/status 대응).
create or replace function public.get_my_status(p_event_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = private, public
as $$
declare
  v_p private.participants%rowtype;
begin
  select * into v_p from private.participants
    where event_id = p_event_id and auth_user_id = auth.uid();
  if v_p.id is null then
    return jsonb_build_object('participant_status', 'not_found');
  end if;
  return jsonb_build_object(
    'participant_status', v_p.status,
    'matching_number', v_p.matching_number,
    'result_available', v_p.status = 'matched'
  );
end;
$$;

-- 참가자 본인 결과 조회 (문서03 §4 GET /me/result). match membership과 공개 flag를 함수 안에서 확인 — 잠긴 Instagram은 절대 포함하지 않는다.
create or replace function public.get_my_result(p_event_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = private, public
as $$
declare
  v_me uuid;
  v_match record;
  v_partner_id uuid;
  v_profile private.profiles%rowtype;
  v_pref private.preferences%rowtype;
  v_access private.match_access%rowtype;
begin
  select id into v_me from private.participants where event_id = p_event_id and auth_user_id = auth.uid();
  if v_me is null then
    return jsonb_build_object('status', 'not_found');
  end if;

  select m.id as match_id, m.score into v_match
    from private.matches m
    join private.match_members mm on mm.match_id = m.id and mm.participant_id = v_me and mm.ended_at is null
    where m.status = 'active'
    limit 1;

  if v_match.match_id is null then
    return jsonb_build_object('status', 'waiting');
  end if;

  select participant_id into v_partner_id from private.match_members
    where match_id = v_match.match_id and participant_id <> v_me and ended_at is null;

  select * into v_profile from private.profiles where participant_id = v_partner_id;
  select * into v_pref from private.preferences where participant_id = v_partner_id;
  select * into v_access from private.match_access where match_id = v_match.match_id and viewer_participant_id = v_me;

  return jsonb_build_object(
    'status', 'matched',
    'match_id', v_match.match_id,
    'match_score', v_match.score,
    'score_label', '설문 취향 일치도',
    'partner', jsonb_build_object(
      'nickname', v_profile.nickname,
      'department', v_profile.department,
      'grade', v_profile.grade,
      'mbti', v_profile.mbti,
      'traits', v_pref.self_traits,
      'shared_interests', (select array_agg(x) from (select unnest(v_pref.interests) intersect select unnest((select interests from private.preferences where participant_id = v_me))) t(x)),
      'one_liner', v_profile.one_liner
    ),
    'cheatkey', jsonb_build_object('status', coalesce(v_access.status, 'locked'))
  );
end;
$$;

grant execute on function public.get_my_status(uuid) to anon, authenticated;
grant execute on function public.get_my_result(uuid) to anon, authenticated;
