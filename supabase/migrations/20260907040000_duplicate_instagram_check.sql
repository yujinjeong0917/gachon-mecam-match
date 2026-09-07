-- 실전 버그: 여러 명이 같은 Instagram ID(예: 공유된 예시 계정)로 제출하면
-- private_contacts_event_handle_uq 유니크 제약이 원본 Postgres 에러 그대로 튀어나가서
-- 프런트에서 "제출에 실패했어요"라는 의미 없는 메시지로만 보였다.
-- insert 전에 미리 확인해서 이름 붙은 예외로 바꾼다.

set search_path = private, public, extensions;

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
  v_instagram_handle text;
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

  v_instagram_handle := coalesce(nullif(trim(p_instagram_handle), ''), 'unknown');
  if exists (
    select 1 from private.private_contacts
    where event_id = p_event_id and lower(instagram_handle) = lower(v_instagram_handle) and deleted_at is null
  ) then
    raise exception 'DUPLICATE_INSTAGRAM_HANDLE';
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

  -- 위에서 이미 중복을 확인했지만, 동시에 같은 아이디로 제출하는 극단적 타이밍 경합까지 대비해
  -- on conflict do nothing으로 한 번 더 방어한다. 이 경우에도 세션 실패로 처리한다.
  insert into private.private_contacts (participant_id, event_id, instagram_handle, phone_number, contact_preference, real_name)
  values (v_participant_id, p_event_id, v_instagram_handle, p_phone_number, p_conversation_style, nullif(trim(coalesce(p_real_name, '')), ''))
  on conflict do nothing;

  if not found then
    raise exception 'DUPLICATE_INSTAGRAM_HANDLE';
  end if;

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
