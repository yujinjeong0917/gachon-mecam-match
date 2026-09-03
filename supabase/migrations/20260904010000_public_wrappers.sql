-- P0 갭 메우기: 참가자 제출/상태조회/결과공개게이팅 + 관리자 게이팅 래퍼 + 수기 매칭.
-- 문서03 §4·§5에서 요구한 public 진입점 중 지금까지 비어 있던 것들을 채운다.
-- 참가자 신원은 auth.uid()로 식별한다(익명 로그인 포함) — private.participants.auth_user_id 그대로 사용.

set search_path = private, public, extensions;

-- =========================================================
-- 1. 참가자 제출 (POST /me/submissions 대응)
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
  p_analytics boolean default false
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

  -- 이미 참여한 경우: 새로 만들지 않고 기존 참가번호를 그대로 알려준다 (중복 참여 방지).
  select id, matching_number into v_participant_id, v_existing_number
    from private.participants where event_id = p_event_id and auth_user_id = v_uid;
  if v_participant_id is not null then
    return jsonb_build_object('status', 'already_submitted', 'matching_number', v_existing_number);
  end if;

  -- 이벤트 단위 advisory lock: matching_number 동시 발급 충돌 방지.
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

  insert into private.private_contacts (participant_id, event_id, instagram_handle, phone_number, contact_preference)
  values (v_participant_id, p_event_id, coalesce(nullif(trim(p_instagram_handle), ''), 'unknown'), p_phone_number, p_conversation_style);

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
  uuid, boolean, text, text, int, text, text, text, text[], text[], int[], text[], text[], text[], text[], text[], text, text, text, text, boolean, boolean, boolean, boolean
) to anon, authenticated;

-- =========================================================
-- 2. 매칭 결과 공개 게이팅 — event_features.result_reveal_enabled를 존중하도록 재정의.
--    운영자가 EventControlPanel에서 공개를 내리면, 이미 매칭된 사람도 대기 화면을 본다.
-- =========================================================

create or replace function public.get_my_result(p_event_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = private, public
as $$
declare
  v_me uuid;
  v_features public.event_features%rowtype;
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

  select * into v_features from public.event_features where event_id = p_event_id;
  if v_features.event_id is not null and not v_features.result_reveal_enabled then
    return jsonb_build_object('status', 'pending_reveal', 'message', coalesce(v_features.message, '매칭 결과 공개를 준비하고 있어요. 잠시만 기다려주세요.'));
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
      'activities', v_pref.activities,
      'one_liner', v_profile.one_liner
    ),
    'cheatkey', jsonb_build_object('status', coalesce(v_access.status, 'locked'))
  );
end;
$$;

grant execute on function public.get_my_result(uuid) to anon, authenticated;

-- =========================================================
-- 2-1. 치트키(연락처 공개) 흐름 — CheatkeySheet가 지금까지 unlockedHandle/unlockedPhone을
--      항상 props로 통째로 받아 UI로만 가려왔다(실제로는 잠금 여부와 무관하게 클라이언트에 이미 와 있었다).
--      운영자 확인 전에는 서버가 아예 값을 내려주지 않도록 한다.
-- =========================================================

create or replace function public.request_my_cheatkey_unlock(p_event_id uuid, p_match_id uuid)
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

  update private.match_access
    set status = 'waiting_for_operator'
    where match_id = p_match_id and viewer_participant_id = v_me and status = 'locked';

  return jsonb_build_object('status', 'ok');
end;
$$;

grant execute on function public.request_my_cheatkey_unlock(uuid, uuid) to anon, authenticated;

create or replace function public.get_my_unlocked_contact(p_event_id uuid, p_match_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = private, public
as $$
declare
  v_me uuid;
  v_partner_id uuid;
  v_access private.match_access%rowtype;
  v_contact private.private_contacts%rowtype;
begin
  select id into v_me from private.participants where event_id = p_event_id and auth_user_id = auth.uid();
  if v_me is null then
    return jsonb_build_object('status', 'not_found');
  end if;

  select * into v_access from private.match_access where match_id = p_match_id and viewer_participant_id = v_me;
  if v_access.match_id is null then
    return jsonb_build_object('status', 'forbidden');
  end if;
  if v_access.status <> 'unlocked' then
    return jsonb_build_object('status', v_access.status);
  end if;

  select participant_id into v_partner_id from private.match_members
    where match_id = p_match_id and participant_id <> v_me and ended_at is null;

  select * into v_contact from private.private_contacts where participant_id = v_partner_id and deleted_at is null;

  return jsonb_build_object(
    'status', 'unlocked',
    'instagram_handle', v_contact.instagram_handle,
    'phone_number', v_contact.phone_number,
    'contact_preference', v_contact.contact_preference
  );
end;
$$;

grant execute on function public.get_my_unlocked_contact(uuid, uuid) to anon, authenticated;

-- =========================================================
-- 3. 관리자 권한 확인 (프런트 라우트 가드용)
-- =========================================================

create or replace function public.am_i_operator(p_event_id uuid, p_min_role text default 'operator')
returns boolean
language sql
security definer
set search_path = private, public
stable
as $$
  select private.is_operator(p_event_id, p_min_role);
$$;

grant execute on function public.am_i_operator(uuid, text) to authenticated;

-- =========================================================
-- 4. 관리자 개요·대기열 조회
-- =========================================================

create or replace function public.admin_overview(p_event_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = private, public
as $$
declare
  v_total int;
  v_waiting int;
  v_matched int;
  v_features public.event_features%rowtype;
begin
  if not private.is_operator(p_event_id) then
    raise exception 'FORBIDDEN';
  end if;

  select count(*) into v_total from private.participants where event_id = p_event_id;
  select count(*) into v_waiting from private.participants where event_id = p_event_id and status = 'waiting';
  select count(*) into v_matched from private.participants where event_id = p_event_id and status = 'matched';
  select * into v_features from public.event_features where event_id = p_event_id;

  return jsonb_build_object(
    'total_participants', v_total,
    'waiting', v_waiting,
    'matched', v_matched,
    'registration_open', coalesce(v_features.registration_open, false),
    'result_reveal_enabled', coalesce(v_features.result_reveal_enabled, false),
    'fallback_mode', coalesce(v_features.fallback_mode, false)
  );
end;
$$;

grant execute on function public.admin_overview(uuid) to authenticated;

create or replace function public.admin_list_waiting_participants(p_event_id uuid)
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
      'active_match_count', (select count(*) from private.match_members mm where mm.participant_id = p.id and mm.ended_at is null),
      'submitted_at', p.submitted_at
    ) order by p.submitted_at)
    from private.participants p
    join private.profiles pr on pr.participant_id = p.id
    where p.event_id = p_event_id and not p.excluded and p.status in ('waiting', 'matched')
  ), '[]'::jsonb);
end;
$$;

grant execute on function public.admin_list_waiting_participants(uuid) to authenticated;

-- =========================================================
-- 5. 관리자 게이팅 매칭 실행 래퍼 (private 알고리즘은 그대로, 여기서만 권한 확인)
-- =========================================================

create or replace function public.admin_run_matching_preview(
  p_event_id uuid,
  p_min_score int default 50,
  p_wait_bonus_max int default 5,
  p_seed text default null
)
returns jsonb
language plpgsql
security definer
set search_path = private, public, extensions
as $$
begin
  if not private.is_operator(p_event_id, 'matcher') then
    raise exception 'FORBIDDEN';
  end if;
  return private.run_matching_preview(p_event_id, p_min_score, p_wait_bonus_max, p_seed);
end;
$$;

grant execute on function public.admin_run_matching_preview(uuid, int, int, text) to authenticated;

create or replace function public.admin_commit_matching_run_with_fallback(
  p_run_id uuid,
  p_fallback_min_score int default 35,
  p_rescue_min_score int default 30
)
returns jsonb
language plpgsql
security definer
set search_path = private, public, extensions
as $$
declare
  v_event_id uuid;
begin
  select event_id into v_event_id from private.matching_runs where id = p_run_id;
  if v_event_id is null then
    raise exception 'RUN_NOT_FOUND';
  end if;
  if not private.is_operator(v_event_id, 'matcher') then
    raise exception 'FORBIDDEN';
  end if;
  return private.commit_matching_run_with_fallback(p_run_id, p_fallback_min_score, p_rescue_min_score);
end;
$$;

grant execute on function public.admin_commit_matching_run_with_fallback(uuid, int, int) to authenticated;

create or replace function public.admin_rollback_matching_run(p_run_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = private, public, extensions
as $$
declare
  v_event_id uuid;
begin
  select event_id into v_event_id from private.matching_runs where id = p_run_id;
  if v_event_id is null then
    raise exception 'RUN_NOT_FOUND';
  end if;
  if not private.is_operator(v_event_id, 'matcher') then
    raise exception 'FORBIDDEN';
  end if;
  return private.rollback_matching_run(p_run_id);
end;
$$;

grant execute on function public.admin_rollback_matching_run(uuid) to authenticated;

-- =========================================================
-- 6. 수기 매칭 (온라인 매칭 오류 시 백업 경로) — 지금까지 존재하지 않았다.
--    알고리즘을 거치지 않고 운영자가 직접 두 참가자를 확정한다. 상한(2명)·중복매칭 방지는 그대로 지킨다.
-- =========================================================

create or replace function private.manual_match_participants(
  p_event_id uuid,
  p_participant_a uuid,
  p_participant_b uuid,
  p_note text default null
)
returns jsonb
language plpgsql
as $$
declare
  v_run_id uuid;
  v_match_id uuid;
  v_a_count int;
  v_b_count int;
  v_actor uuid := auth.uid();
begin
  if p_participant_a = p_participant_b then
    raise exception 'SAME_PARTICIPANT';
  end if;
  if not exists (select 1 from private.participants where id = p_participant_a and event_id = p_event_id and not excluded) then
    raise exception 'PARTICIPANT_A_NOT_FOUND';
  end if;
  if not exists (select 1 from private.participants where id = p_participant_b and event_id = p_event_id and not excluded) then
    raise exception 'PARTICIPANT_B_NOT_FOUND';
  end if;

  perform pg_advisory_xact_lock(hashtext(p_event_id::text || ':manual_match'));

  select count(*) into v_a_count from private.match_members where participant_id = p_participant_a and ended_at is null;
  select count(*) into v_b_count from private.match_members where participant_id = p_participant_b and ended_at is null;
  if v_a_count >= 2 or v_b_count >= 2 then
    raise exception 'CAPACITY_EXCEEDED';
  end if;

  if exists (
    select 1 from private.match_members mm1
    join private.match_members mm2 on mm1.match_id = mm2.match_id
    where mm1.participant_id = p_participant_a and mm2.participant_id = p_participant_b
      and mm1.ended_at is null and mm2.ended_at is null
  ) then
    raise exception 'ALREADY_MATCHED';
  end if;

  -- 수기 매칭 전용 matching_run을 이벤트당 하나만 만들어 재사용한다(matches.run_id NOT NULL FK를 만족시키기 위함).
  select id into v_run_id from private.matching_runs
    where event_id = p_event_id and algorithm_version = 'manual-v1.0.0'
    limit 1;
  if v_run_id is null then
    insert into private.matching_runs (
      event_id, status, algorithm_version, min_score, wait_bonus_max, seed, snapshot_hash, input_count, proposed_match_count, committed_at
    ) values (
      p_event_id, 'committed', 'manual-v1.0.0', 0, 0, 'manual', 'manual', 0, 0, now()
    ) returning id into v_run_id;
  end if;

  insert into private.matches (event_id, run_id, score) values (p_event_id, v_run_id, 100)
    returning id into v_match_id;
  insert into private.match_members (event_id, match_id, participant_id) values
    (p_event_id, v_match_id, p_participant_a),
    (p_event_id, v_match_id, p_participant_b);
  insert into private.match_access (match_id, viewer_participant_id, partner_participant_id) values
    (v_match_id, p_participant_a, p_participant_b),
    (v_match_id, p_participant_b, p_participant_a);

  update private.participants set status = 'matched' where id in (p_participant_a, p_participant_b);

  insert into private.audit_events (event_id, actor_type, actor_id, action, entity_type, entity_id, metadata)
  values (p_event_id, 'operator', v_actor::text, 'manual_match_created', 'match', v_match_id,
    jsonb_build_object('participant_a', p_participant_a, 'participant_b', p_participant_b, 'note', p_note));

  return jsonb_build_object('status', 'ok', 'match_id', v_match_id, 'run_id', v_run_id);
end;
$$;

create or replace function public.admin_manual_match(
  p_event_id uuid,
  p_participant_a uuid,
  p_participant_b uuid,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = private, public
as $$
begin
  if not private.is_operator(p_event_id, 'matcher') then
    raise exception 'FORBIDDEN';
  end if;
  return private.manual_match_participants(p_event_id, p_participant_a, p_participant_b, p_note);
end;
$$;

grant execute on function public.admin_manual_match(uuid, uuid, uuid, text) to authenticated;

-- =========================================================
-- 6-1. 치트키 운영자 확인 — 팔로우 확인 큐(QueuePanel)에서 승인 버튼이 호출할 함수.
-- =========================================================

create or replace function public.admin_unlock_cheatkey(p_event_id uuid, p_match_id uuid, p_viewer_participant_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = private, public
as $$
begin
  if not private.is_operator(p_event_id) then
    raise exception 'FORBIDDEN';
  end if;

  update private.match_access
    set status = 'unlocked', unlocked_by = auth.uid(), unlocked_at = now()
    where match_id = p_match_id and viewer_participant_id = p_viewer_participant_id;

  insert into private.audit_events (event_id, actor_type, actor_id, action, entity_type, entity_id)
  values (p_event_id, 'operator', auth.uid()::text, 'cheatkey_unlocked', 'match_access', p_match_id);

  return jsonb_build_object('status', 'ok');
end;
$$;

grant execute on function public.admin_unlock_cheatkey(uuid, uuid, uuid) to authenticated;

create or replace function public.admin_list_cheatkey_queue(p_event_id uuid)
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
      'match_id', ma.match_id,
      'viewer_participant_id', ma.viewer_participant_id,
      'viewer_matching_number', p.matching_number,
      'viewer_nickname', pr.nickname
    ) order by p.matching_number)
    from private.match_access ma
    join private.matches m on m.id = ma.match_id
    join private.participants p on p.id = ma.viewer_participant_id
    join private.profiles pr on pr.participant_id = p.id
    where m.event_id = p_event_id and ma.status = 'waiting_for_operator'
  ), '[]'::jsonb);
end;
$$;

grant execute on function public.admin_list_cheatkey_queue(uuid) to authenticated;

-- =========================================================
-- 7. 긴급 운영: 매칭 해제, 결과 공개 on/off, 참가자 제외
-- =========================================================

create or replace function public.admin_unmatch(p_event_id uuid, p_match_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = private, public
as $$
declare
  v_reverted int;
begin
  if not private.is_operator(p_event_id, 'matcher') then
    raise exception 'FORBIDDEN';
  end if;

  with targets as (
    select mm.participant_id from private.match_members mm
    join private.matches m on m.id = mm.match_id
    where mm.match_id = p_match_id and m.event_id = p_event_id and mm.ended_at is null
  ),
  ended as (
    update private.match_members set ended_at = now()
    where match_id = p_match_id and ended_at is null
    returning participant_id
  )
  select count(*) into v_reverted from ended;

  update private.matches set status = 'cancelled', cancelled_at = now() where id = p_match_id and event_id = p_event_id;

  update private.participants p set status = 'waiting'
  where p.id in (select participant_id from private.match_members where match_id = p_match_id)
    and not exists (select 1 from private.match_members mm2 where mm2.participant_id = p.id and mm2.ended_at is null);

  insert into private.audit_events (event_id, actor_type, actor_id, action, entity_type, entity_id, metadata)
  values (p_event_id, 'operator', auth.uid()::text, 'match_unmatched', 'match', p_match_id, jsonb_build_object('reverted', v_reverted));

  return jsonb_build_object('status', 'ok', 'reverted_participants', v_reverted);
end;
$$;

grant execute on function public.admin_unmatch(uuid, uuid) to authenticated;

create or replace function public.admin_set_result_reveal(p_event_id uuid, p_enabled boolean, p_message text default null)
returns jsonb
language plpgsql
security definer
set search_path = private, public
as $$
begin
  if not private.is_operator(p_event_id, 'admin') then
    raise exception 'FORBIDDEN';
  end if;

  update public.event_features
    set result_reveal_enabled = p_enabled,
        message = coalesce(p_message, message)
    where event_id = p_event_id;

  insert into private.audit_events (event_id, actor_type, actor_id, action, entity_type, metadata)
  values (p_event_id, 'operator', auth.uid()::text, 'result_reveal_toggled', 'event_features', jsonb_build_object('enabled', p_enabled));

  return jsonb_build_object('status', 'ok', 'result_reveal_enabled', p_enabled);
end;
$$;

grant execute on function public.admin_set_result_reveal(uuid, boolean, text) to authenticated;
