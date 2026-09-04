-- 관리자용 내보내기 2종.
-- 1) admin_export_matches: 총학 전달용 매칭결과 — 설문 응답 값은 빼고 신원 확인 정보만.
-- 2) admin_export_participants: 매칭 실패(알고리즘/서버 장애) 대비 수기 매칭용 전체 참가자 원본 데이터(연락처 포함).

set search_path = private, public, extensions;

create or replace function public.admin_export_matches(p_event_id uuid)
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
      'match_id', m.id,
      'a_matching_number', pa.matching_number,
      'a_nickname', pra.nickname,
      'a_department', pra.department,
      'a_grade', pra.grade,
      'b_matching_number', pb.matching_number,
      'b_nickname', prb.nickname,
      'b_department', prb.department,
      'b_grade', prb.grade
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

grant execute on function public.admin_export_matches(uuid) to authenticated;

create or replace function public.admin_export_participants(p_event_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = private, public
as $$
begin
  -- 연락처가 포함된 민감 데이터라 admin 역할만 허용한다(matcher/operator는 불가).
  if not private.is_operator(p_event_id, 'admin') then
    raise exception 'FORBIDDEN';
  end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'matching_number', p.matching_number,
      'status', p.status,
      'submitted_at', p.submitted_at,
      'nickname', pr.nickname,
      'department', pr.department,
      'grade', pr.grade,
      'gender_code', pr.gender_code,
      'mbti', pr.mbti,
      'one_liner', pr.one_liner,
      'seeking_gender_codes', pf.seeking_gender_codes,
      'preferred_grades', pf.preferred_grades,
      'self_traits', pf.self_traits,
      'desired_traits', pf.desired_traits,
      'interests', pf.interests,
      'activities', pf.activities,
      'food_tags', pf.food_tags,
      'music_tags', pf.music_tags,
      'conversation_style', pf.conversation_style,
      'instagram_handle', c.instagram_handle,
      'phone_number', c.phone_number
    ) order by p.matching_number)
    from private.participants p
    join private.profiles pr on pr.participant_id = p.id
    left join private.preferences pf on pf.participant_id = p.id
    left join private.private_contacts c on c.participant_id = p.id and c.deleted_at is null
    where p.event_id = p_event_id and not p.excluded
  ), '[]'::jsonb);
end;
$$;

grant execute on function public.admin_export_participants(uuid) to authenticated;
