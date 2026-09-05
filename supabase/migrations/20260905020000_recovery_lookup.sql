-- 다른 기기/브라우저에서 매칭번호 + 복구 코드로 내 상태를 다시 확인하는 경로.
-- (푸시 알림을 못 본 참가자에게 운영진이 문자로 링크를 보내는 경우, 신청했던 기기가 아닐 수 있어서 필요.)
-- 세션을 재발급하거나 auth_user_id를 옮기지 않는, 읽기 전용 조회다.

set search_path = private, public, extensions;

create or replace function public.lookup_by_recovery_code(p_event_id uuid, p_matching_number text, p_recovery_code text)
returns jsonb
language plpgsql
security definer
set search_path = private, public, extensions
as $$
declare
  v_participant private.participants%rowtype;
  v_features public.event_features%rowtype;
  v_match record;
  v_partner_id uuid;
  v_profile private.profiles%rowtype;
  v_pref private.preferences%rowtype;
begin
  select * into v_participant
    from private.participants
    where event_id = p_event_id and matching_number = upper(trim(p_matching_number)) and not excluded;

  if v_participant.id is null or v_participant.recovery_code_hash <> crypt(trim(p_recovery_code), v_participant.recovery_code_hash) then
    return jsonb_build_object('status', 'not_found');
  end if;

  if v_participant.status not in ('waiting', 'matched') then
    return jsonb_build_object('status', 'not_found');
  end if;

  select m.id as match_id, m.score into v_match
    from private.matches m
    join private.match_members mm on mm.match_id = m.id and mm.participant_id = v_participant.id and mm.ended_at is null
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
    where match_id = v_match.match_id and participant_id <> v_participant.id and ended_at is null;

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

grant execute on function public.lookup_by_recovery_code(uuid, text, text) to anon, authenticated;
