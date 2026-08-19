-- 마지막 미션(포스터 기준 3개): 치트키 해금 후 현장에서 완료하는 체크리스트.
-- 매치 단위로 저장한다 — 복수매칭이 허용되면 참가자 1명이 활성 매치를 2개까지 가질 수 있어
-- 참가자 단위가 아니라 match_id 단위로 진행 상태를 관리해야 한다.

create table private.match_missions (
  match_id uuid primary key references private.matches(id) on delete cascade,
  mission_intro_done boolean not null default false,
  mission_common_ground_done boolean not null default false,
  mission_photo_done boolean not null default false,
  completed_at timestamptz
);

-- 참가자 본인이 속한 매치의 미션을 체크 (문서03 §4 스타일: POST /me/match/missions 대응).
create or replace function public.mark_my_match_mission(p_event_id uuid, p_match_id uuid, p_mission_key text)
returns jsonb
language plpgsql
security definer
set search_path = private, public
as $$
declare
  v_me uuid;
begin
  if p_mission_key not in ('intro', 'common_ground', 'photo') then
    raise exception 'invalid mission key';
  end if;

  select id into v_me from private.participants where event_id = p_event_id and auth_user_id = auth.uid();
  if v_me is null then
    return jsonb_build_object('status', 'not_found');
  end if;

  if not exists (
    select 1 from private.match_members
    where match_id = p_match_id and participant_id = v_me and ended_at is null
  ) then
    raise exception 'not a member of this match';
  end if;

  insert into private.match_missions (match_id) values (p_match_id)
  on conflict (match_id) do nothing;

  update private.match_missions
  set mission_intro_done = case when p_mission_key = 'intro' then true else mission_intro_done end,
      mission_common_ground_done = case when p_mission_key = 'common_ground' then true else mission_common_ground_done end,
      mission_photo_done = case when p_mission_key = 'photo' then true else mission_photo_done end
  where match_id = p_match_id;

  update private.match_missions
  set completed_at = now()
  where match_id = p_match_id
    and completed_at is null
    and mission_intro_done and mission_common_ground_done and mission_photo_done;

  return jsonb_build_object('status', 'ok');
end;
$$;

grant execute on function public.mark_my_match_mission(uuid, uuid, text) to anon, authenticated;
