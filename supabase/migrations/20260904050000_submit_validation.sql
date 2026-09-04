-- submit_my_entry에 형식 검증 추가 — 프론트(src/lib/validation.ts)가 막아도 우회해서 직접 RPC를
-- 호출하면 통과되던 부분(닉네임 길이, Instagram ID 형식, 전화번호 형식)을 서버에서도 한 번 더 막는다.

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
  v_instagram_handle text := trim(coalesce(p_instagram_handle, ''));
  v_phone_number text := trim(coalesce(p_phone_number, ''));
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
  if length(trim(p_nickname)) > 20 then
    raise exception 'INVALID_NICKNAME';
  end if;
  if v_instagram_handle !~ '^[a-zA-Z0-9._]{1,30}$' or v_instagram_handle like '%..%' or v_instagram_handle like '.%' or v_instagram_handle like '%.' then
    raise exception 'INVALID_INSTAGRAM_HANDLE';
  end if;
  if v_phone_number !~ '^01[016789]-?[0-9]{3,4}-?[0-9]{4}$' then
    raise exception 'INVALID_PHONE_NUMBER';
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
  values (v_participant_id, p_event_id, v_instagram_handle, v_phone_number, p_conversation_style);

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
