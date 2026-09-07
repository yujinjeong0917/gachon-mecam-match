-- 총학생회 요청사항 반영:
-- 1) 실명(real_name) 필드 추가 — 총학 전달용 명단에 필요. 기존 제출자는 값이 없으므로 조회 시 닉네임으로 대체한다.
-- 2) 총학 전달용 매칭결과를 A/B 페어(이름/성별/학과/전화번호) 형식으로 개편, 연락처 포함이라 admin 역할만 허용.
-- 3) 참가자 삭제(하드 삭제) RPC.
-- 4) 매칭 해제 목록 조회(unmatch 버튼용 UI 데이터).

set search_path = private, public, extensions;

alter table private.private_contacts add column if not exists real_name text;

-- =========================================================
-- 1. 실명 필드를 받도록 제출 RPC 갱신
-- =========================================================

create or replace function public.submit_my_entry(
  p_event_id uuid,
  p_age_18_plus boolean,
  p_nickname text,
  p_department text,
  p_grade int,
  p_gender_code text,
  p_mbti text default null,
  p_one_liner text default null,
  p_self_traits text[] default '{}',
  p_seeking_gender_codes text[] default '{}',
  p_preferred_grades int[] default '{1,2,3,4,5,6}',
  p_desired_traits text[] default '{}',
  p_interests text[] default '{}',
  p_activities text[] default '{}',
  p_food_tags text[] default '{}',
  p_music_tags text[] default '{}',
  p_conversation_style text default null,
  p_instagram_handle text default null,
  p_phone_number text default null,
  p_policy_version text default 'unknown',
  p_participation boolean default false,
  p_profile_share boolean default false,
  p_instagram_share_if_matched boolean default false,
  p_analytics boolean default false,
  p_real_name text default null
)
returns jsonb
language plpgsql
security definer
set search_path = private, public, extensions
as $$
declare
  v_uid uuid := auth.uid();
  v_event public.events%rowtype;
  v_participant_id uuid;
  v_existing_number text;
  v_matching_number text;
  v_recovery_code text;
begin
  if v_uid is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  select * into v_event from public.events where id = p_event_id;
  if v_event.id is null then
    raise exception 'EVENT_NOT_FOUND';
  end if;
  if v_event.status <> 'registration_open' then
    raise exception 'REGISTRATION_CLOSED';
  end if;
  if not p_participation or not p_profile_share or not p_instagram_share_if_matched then
    raise exception 'REQUIRED_CONSENT_MISSING';
  end if;
  if not p_age_18_plus then
    raise exception 'AGE_REQUIREMENT_NOT_MET';
  end if;
  if coalesce(trim(p_nickname), '') = '' or coalesce(trim(p_department), '') = '' then
    raise exception 'MISSING_REQUIRED_FIELD';
  end if;

  select id, matching_number into v_participant_id, v_existing_number
    from private.participants where event_id = p_event_id and auth_user_id = v_uid;
  if v_participant_id is not null then
    return jsonb_build_object('status', 'already_submitted', 'matching_number', v_existing_number);
  end if;

  perform pg_advisory_xact_lock(hashtext(p_event_id::text || ':submit'));

  v_matching_number := 'M-' || lpad((
    select count(*) + 1 from private.participants where event_id = p_event_id
  )::text, 3, '0');
  v_recovery_code := lpad(floor(random() * 1000000)::text, 6, '0');

  insert into private.participants (event_id, auth_user_id, matching_number, recovery_code_hash, status, age_18_plus)
  values (p_event_id, v_uid, v_matching_number, crypt(v_recovery_code, gen_salt('bf')), 'waiting', p_age_18_plus)
  returning id into v_participant_id;

  insert into private.profiles (participant_id, nickname, department, grade, gender_code, mbti, one_liner)
  values (v_participant_id, trim(p_nickname), trim(p_department), p_grade, p_gender_code, nullif(trim(coalesce(p_mbti, '')), ''), p_one_liner);

  insert into private.preferences (
    participant_id, seeking_gender_codes, preferred_grades, self_traits, desired_traits,
    interests, activities, food_tags, music_tags, conversation_style
  ) values (
    v_participant_id, p_seeking_gender_codes, p_preferred_grades, p_self_traits, p_desired_traits,
    p_interests, p_activities, p_food_tags, p_music_tags, p_conversation_style
  );

  insert into private.consents (
    participant_id, policy_version, age_18_plus, participation, profile_share, instagram_share_if_matched, analytics
  ) values (
    v_participant_id, p_policy_version, p_age_18_plus, p_participation, p_profile_share, p_instagram_share_if_matched, p_analytics
  );

  insert into private.private_contacts (participant_id, event_id, instagram_handle, phone_number, contact_preference, real_name)
  values (v_participant_id, p_event_id, coalesce(nullif(trim(p_instagram_handle), ''), 'unknown'), p_phone_number, p_conversation_style, nullif(trim(coalesce(p_real_name, '')), ''));

  insert into private.audit_events (event_id, actor_type, actor_id, action, entity_type, entity_id)
  values (p_event_id, 'participant', v_uid::text, 'submitted_entry', 'participant', v_participant_id);

  return jsonb_build_object(
    'status', 'ok',
    'participant_id', v_participant_id,
    'matching_number', v_matching_number,
    'recovery_code', v_recovery_code
  );
end;
$$;

grant execute on function public.submit_my_entry(
  uuid, boolean, text, text, int, text, text, text, text[], text[], int[], text[], text[], text[], text[], text[], text, text, text, text, boolean, boolean, boolean, boolean, text
) to anon, authenticated;

-- =========================================================
-- 2. 총학 전달용 매칭결과 — A/B 페어(이름·성별·학과·전화번호). 연락처 포함이라 admin만.
-- =========================================================

create or replace function public.admin_export_matches(p_event_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = private, public
as $$
begin
  if not private.is_operator(p_event_id, 'admin') then
    raise exception 'FORBIDDEN';
  end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'match_id', m.id,
      'a_matching_number', pa.matching_number,
      'a_name', coalesce(ca.real_name, pra.nickname),
      'a_gender', pra.gender_code,
      'a_department', pra.department,
      'a_phone', ca.phone_number,
      'b_matching_number', pb.matching_number,
      'b_name', coalesce(cb.real_name, prb.nickname),
      'b_gender', prb.gender_code,
      'b_department', prb.department,
      'b_phone', cb.phone_number
    ) order by pa.matching_number)
    from private.matches m
    join private.match_members mma on mma.match_id = m.id and mma.ended_at is null
    join private.participants pa on pa.id = mma.participant_id
    join private.profiles pra on pra.participant_id = pa.id
    left join private.private_contacts ca on ca.participant_id = pa.id
    join private.match_members mmb on mmb.match_id = m.id and mmb.ended_at is null and mmb.participant_id <> mma.participant_id
    join private.participants pb on pb.id = mmb.participant_id
    join private.profiles prb on prb.participant_id = pb.id
    left join private.private_contacts cb on cb.participant_id = pb.id
    where m.event_id = p_event_id and m.status = 'active'
      and pa.matching_number < pb.matching_number
  ), '[]'::jsonb);
end;
$$;

grant execute on function public.admin_export_matches(uuid) to authenticated;

-- =========================================================
-- 3. 참가자 삭제 (하드 삭제, 되돌릴 수 없음)
-- =========================================================

create or replace function public.admin_delete_participant(p_event_id uuid, p_participant_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = private, public
as $$
declare
  v_matching_number text;
begin
  if not private.is_operator(p_event_id, 'admin') then
    raise exception 'FORBIDDEN';
  end if;

  select matching_number into v_matching_number from private.participants where id = p_participant_id and event_id = p_event_id;
  if v_matching_number is null then
    raise exception 'PARTICIPANT_NOT_FOUND';
  end if;

  insert into private.audit_events (event_id, actor_type, actor_id, action, entity_type, entity_id, metadata)
  values (p_event_id, 'operator', auth.uid()::text, 'participant_deleted', 'participant', p_participant_id, jsonb_build_object('matching_number', v_matching_number));

  delete from private.participants where id = p_participant_id and event_id = p_event_id;

  return jsonb_build_object('status', 'ok', 'matching_number', v_matching_number);
end;
$$;

grant execute on function public.admin_delete_participant(uuid, uuid) to authenticated;

-- =========================================================
-- 4. 참가자 전체 목록(관리자용 검색 화면) — 대기/매칭 상태 무관하게 전부 보여준다.
-- =========================================================

create or replace function public.admin_list_all_participants(p_event_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = private, public
as $$
begin
  if not private.is_operator(p_event_id) then
    raise exception 'FORBIDDEN';
  end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'participant_id', p.id,
      'matching_number', p.matching_number,
      'nickname', pr.nickname,
      'department', pr.department,
      'grade', pr.grade,
      'gender_code', pr.gender_code,
      'status', p.status,
      'submitted_at', p.submitted_at,
      'active_match_count', (select count(*) from private.match_members mm where mm.participant_id = p.id and mm.ended_at is null)
    ) order by p.matching_number)
    from private.participants p
    join private.profiles pr on pr.participant_id = p.id
    where p.event_id = p_event_id and not p.excluded
  ), '[]'::jsonb);
end;
$$;

grant execute on function public.admin_list_all_participants(uuid) to authenticated;

-- =========================================================
-- 5. 매칭 해제용 — 지금 활성화된 매칭 목록
-- =========================================================

create or replace function public.admin_list_active_matches(p_event_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = private, public
as $$
begin
  if not private.is_operator(p_event_id, 'matcher') then
    raise exception 'FORBIDDEN';
  end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'match_id', m.id,
      'score', m.score,
      'a_matching_number', pa.matching_number,
      'a_nickname', pra.nickname,
      'b_matching_number', pb.matching_number,
      'b_nickname', prb.nickname
    ) order by pa.matching_number)
    from private.matches m
    join private.match_members mma on mma.match_id = m.id and mma.ended_at is null
    join private.participants pa on pa.id = mma.participant_id
    join private.profiles pra on pra.participant_id = pa.id
    join private.match_members mmb on mmb.match_id = m.id and mmb.ended_at is null and mmb.participant_id <> mma.participant_id
    join private.participants pb on pb.id = mmb.participant_id
    join private.profiles prb on prb.participant_id = pb.id
    where m.event_id = p_event_id and m.status = 'active'
      and pa.matching_number < pb.matching_number
  ), '[]'::jsonb);
end;
$$;

grant execute on function public.admin_list_active_matches(uuid) to authenticated;
