-- 복구 코드를 기억 못하는 경우를 위한 2차 fallback: 닉네임 + 전화번호 뒷 4자리로 조회.
-- 닉네임은 유니크하지 않을 수 있으므로 두 값이 정확히 함께 일치하는 경우만 허용하고,
-- 0건이든 2건 이상(모호)이든 전부 not_found로 처리해 정보 유출을 막는다.
--
-- lookup_by_recovery_code와 매칭 상태 조회 로직이 겹쳐서 private 헬퍼로 분리한다.

set search_path = private, public, extensions;

create or replace function private.describe_participant_match_status(p_event_id uuid, p_participant_id uuid)
returns jsonb
language plpgsql
as $$
declare
  v_participant private.participants%rowtype;
  v_features public.event_features%rowtype;
  v_match record;
  v_partner_id uuid;
  v_profile private.profiles%rowtype;
  v_pref private.preferences%rowtype;
begin
  select * into v_participant from private.participants where id = p_participant_id;
  if v_participant.id is null or v_participant.status not in ('waiting', 'matched') then
    return jsonb_build_object('status', 'not_found');
  end if;

  select m.id as match_id, m.score into v_match
    from private.matches m
    join private.match_members mm on mm.match_id = m.id and mm.participant_id = p_participant_id and mm.ended_at is null
    where m.status = 'active'
    limit 1;

  if v_match.match_id is null then
    return jsonb_build_object('status', 'waiting', 'matching_number', v_participant.matching_number);
  end if;

  select * into v_features from public.event_features where event_id = p_event_id;
  if v_features.event_id is not null and not v_features.result_reveal_enabled then
    return jsonb_build_object(
      'status', 'pending_reveal',
      'matching_number', v_participant.matching_number,
      'message', coalesce(v_features.message, '매칭 결과 공개를 준비하고 있어요. 잠시만 기다려주세요.')
    );
  end if;

  select participant_id into v_partner_id from private.match_members
    where match_id = v_match.match_id and participant_id <> p_participant_id and ended_at is null;

  select * into v_profile from private.profiles where participant_id = v_partner_id;
  select * into v_pref from private.preferences where participant_id = v_partner_id;

  return jsonb_build_object(
    'status', 'matched',
    'matching_number', v_participant.matching_number,
    'match_score', v_match.score,
    'partner', jsonb_build_object(
      'nickname', v_profile.nickname,
      'department', v_profile.department,
      'grade', v_profile.grade,
      'mbti', v_profile.mbti,
      'traits', v_pref.self_traits,
      'activities', v_pref.activities,
      'one_liner', v_profile.one_liner
    )
  );
end;
$$;

create or replace function public.lookup_by_recovery_code(p_event_id uuid, p_matching_number text, p_recovery_code text)
returns jsonb
language plpgsql
security definer
set search_path = private, public, extensions
as $$
declare
  v_participant private.participants%rowtype;
begin
  select * into v_participant
    from private.participants
    where event_id = p_event_id and matching_number = upper(trim(p_matching_number)) and not excluded;

  if v_participant.id is null or v_participant.recovery_code_hash <> crypt(trim(p_recovery_code), v_participant.recovery_code_hash) then
    return jsonb_build_object('status', 'not_found');
  end if;

  return private.describe_participant_match_status(p_event_id, v_participant.id);
end;
$$;

grant execute on function public.lookup_by_recovery_code(uuid, text, text) to anon, authenticated;

create or replace function public.lookup_by_nickname_phone(p_event_id uuid, p_nickname text, p_phone_last4 text)
returns jsonb
language plpgsql
security definer
set search_path = private, public, extensions
as $$
declare
  v_participant_id uuid;
  v_match_count int;
begin
  select count(*), (array_agg(p.id))[1] into v_match_count, v_participant_id
    from private.participants p
    join private.profiles pr on pr.participant_id = p.id
    join private.private_contacts c on c.participant_id = p.id
    where p.event_id = p_event_id
      and not p.excluded
      and p.status in ('waiting', 'matched')
      and lower(trim(pr.nickname)) = lower(trim(p_nickname))
      and right(regexp_replace(coalesce(c.phone_number, ''), '\D', '', 'g'), 4) = trim(p_phone_last4);

  if v_match_count <> 1 then
    return jsonb_build_object('status', 'not_found');
  end if;

  return private.describe_participant_match_status(p_event_id, v_participant_id);
end;
$$;

grant execute on function public.lookup_by_nickname_phone(uuid, text, text) to anon, authenticated;
