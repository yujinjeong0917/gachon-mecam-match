-- 문서01 §4 매칭 규칙 v1을 SQL 함수로 구현.
-- calculate_match_score: 점수 계산 (§4.3)
-- are_mutually_eligible: 필수 조건 (§4.2)
-- run_matching_preview / commit_matching_run: 배치 실행 (§4.1, §4.4)

set search_path = private, public;

create or replace function private.jaccard(a text[], b text[])
returns numeric
language sql
immutable
as $$
  select case
    when coalesce(array_length(a, 1), 0) = 0 and coalesce(array_length(b, 1), 0) = 0 then 0
    else (
      select count(*)::numeric from (select unnest(a) intersect select unnest(b)) i
    ) / greatest(1, (
      select count(*) from (select unnest(a) union select unnest(b)) u
    ))
  end;
$$;

-- 문서01 §4.2 필수 조건: 하나라도 충족하지 않으면 후보 간선 자체를 만들지 않는다.
create or replace function private.are_mutually_eligible(p_a uuid, p_b uuid, p_event_id uuid)
returns boolean
language plpgsql
stable
as $$
declare
  a private.participants%rowtype;
  b private.participants%rowtype;
  a_pref private.preferences%rowtype;
  b_pref private.preferences%rowtype;
  a_profile private.profiles%rowtype;
  b_profile private.profiles%rowtype;
  a_consent private.consents%rowtype;
  b_consent private.consents%rowtype;
  a_gender_ok boolean;
  b_gender_ok boolean;
  a_has_active_match boolean;
  b_has_active_match boolean;
begin
  if p_a = p_b then
    return false;
  end if;

  select * into a from private.participants where id = p_a and event_id = p_event_id;
  select * into b from private.participants where id = p_b and event_id = p_event_id;
  if a.id is null or b.id is null then
    return false;
  end if;
  if a.status <> 'waiting' or b.status <> 'waiting' then
    return false;
  end if;
  if a.excluded or b.excluded then
    return false;
  end if;
  if not a.age_18_plus or not b.age_18_plus then
    return false;
  end if;

  select * into a_consent from private.consents where participant_id = p_a;
  select * into b_consent from private.consents where participant_id = p_b;
  if coalesce(a_consent.participation, false) is not true or coalesce(a_consent.profile_share, false) is not true then
    return false;
  end if;
  if coalesce(b_consent.participation, false) is not true or coalesce(b_consent.profile_share, false) is not true then
    return false;
  end if;

  select * into a_profile from private.profiles where participant_id = p_a;
  select * into b_profile from private.profiles where participant_id = p_b;
  select * into a_pref from private.preferences where participant_id = p_a;
  select * into b_pref from private.preferences where participant_id = p_b;

  a_gender_ok := b_profile.gender_code = any(a_pref.seeking_gender_codes) or 'any' = any(a_pref.seeking_gender_codes);
  b_gender_ok := a_profile.gender_code = any(b_pref.seeking_gender_codes) or 'any' = any(b_pref.seeking_gender_codes);
  if not a_gender_ok or not b_gender_ok then
    return false;
  end if;

  select exists(
    select 1 from private.match_members where participant_id = p_a and ended_at is null
  ) into a_has_active_match;
  select exists(
    select 1 from private.match_members where participant_id = p_b and ended_at is null
  ) into b_has_active_match;
  if a_has_active_match or b_has_active_match then
    return false;
  end if;

  return true;
end;
$$;

-- 문서01 §4.3 점수 구성표 그대로.
create or replace function private.calculate_match_score(p_a uuid, p_b uuid)
returns jsonb
language plpgsql
stable
as $$
declare
  a_profile private.profiles%rowtype;
  b_profile private.profiles%rowtype;
  a_pref private.preferences%rowtype;
  b_pref private.preferences%rowtype;
  traits_a_to_b numeric;
  traits_b_to_a numeric;
  traits_score numeric;
  interests_score numeric;
  activities_score numeric;
  conversation_score numeric;
  grade_score numeric;
  food_music_score numeric;
  mbti_score numeric;
  total numeric;
begin
  select * into a_profile from private.profiles where participant_id = p_a;
  select * into b_profile from private.profiles where participant_id = p_b;
  select * into a_pref from private.preferences where participant_id = p_a;
  select * into b_pref from private.preferences where participant_id = p_b;

  -- 1. 서로가 원하는 성격 특성 (30 = A→B 15 + B→A 15)
  traits_a_to_b := least(15, 15.0 * coalesce(array_length(
    (select array_agg(x) from (select unnest(a_pref.desired_traits) intersect select unnest(b_pref.self_traits)) t(x)), 1
  ), 0) / greatest(1, coalesce(array_length(a_pref.desired_traits, 1), 1)));
  traits_b_to_a := least(15, 15.0 * coalesce(array_length(
    (select array_agg(x) from (select unnest(b_pref.desired_traits) intersect select unnest(a_pref.self_traits)) t(x)), 1
  ), 0) / greatest(1, coalesce(array_length(b_pref.desired_traits, 1), 1)));
  traits_score := traits_a_to_b + traits_b_to_a;

  -- 2. 취미·관심사 공통점 (20, 가중 Jaccard)
  interests_score := private.jaccard(a_pref.interests, b_pref.interests) * 20;

  -- 3. 함께 하고 싶은 활동 (15, 교집합 비율)
  activities_score := private.jaccard(a_pref.activities, b_pref.activities) * 15;

  -- 4. 대화·연락 스타일 (15). 정확히 같으면 만점, 다르면 절반만.
  conversation_score := case
    when a_pref.conversation_style is null or b_pref.conversation_style is null then 0
    when a_pref.conversation_style = b_pref.conversation_style then 15
    else 5
  end;

  -- 5. 선호 학년 상호 충족 (10 = A→B 5 + B→A 5)
  grade_score := case when b_profile.grade = any(a_pref.preferred_grades) then 5 else 0 end
               + case when a_profile.grade = any(b_pref.preferred_grades) then 5 else 0 end;

  -- 6. 음식·음악 공통점 (5)
  food_music_score := private.jaccard(
    a_pref.food_tags || a_pref.music_tags,
    b_pref.food_tags || b_pref.music_tags
  ) * 5;

  -- 7. MBTI 대화 성향 (5, 재미 요소·동점 처리용)
  mbti_score := case
    when a_profile.mbti is null or b_profile.mbti is null then 0
    else (
      select count(*)::numeric / 4 * 5
      from unnest(regexp_split_to_array(a_profile.mbti, '')) with ordinality as x(ch, i)
      join unnest(regexp_split_to_array(b_profile.mbti, '')) with ordinality as y(ch, j) on x.i = y.j and x.ch = y.ch
    )
  end;

  total := round(traits_score + interests_score + activities_score + conversation_score + grade_score + food_music_score + mbti_score);

  return jsonb_build_object(
    'total', least(100, greatest(0, total)),
    'traits', round(traits_score),
    'interests', round(interests_score),
    'activities', round(activities_score),
    'conversation', conversation_score,
    'grade', grade_score,
    'food_music', round(food_music_score),
    'mbti', round(mbti_score)
  );
end;
$$;
