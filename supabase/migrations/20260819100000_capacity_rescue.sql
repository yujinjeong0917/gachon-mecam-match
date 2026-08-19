-- 복수매칭(최대 2인) 구제 패스.
-- 정책: 16:00 1차 배치와 임계값을 낮추는 2차(fallback) 배치는 여전히 엄격한 1:1을 유지한다
-- (private.are_mutually_eligible/run_matching_preview는 이 마이그레이션에서 건드리지 않는다 —
-- 후보 선정 로직 자체는 그대로 두고, 상한만 패스별로 다르게 받을 수 있도록 commit_matching_run만 확장한다).
-- 성비 불균형으로 그래도 남는 미매칭자만, 이미 1명과 매칭된 사람을 상대로 최대 2인까지
-- 추가 매칭을 시도하는 3차(capacity rescue) 패스를 별도 함수로 추가한다.

set search_path = private, public;

-- are_mutually_eligible과 달리: "둘 다 waiting"이 아니라 "적어도 한쪽은 활성 매치 0개"를 요구한다.
-- 이미 둘 다 매치가 있는 사람끼리는 구제 대상이 아니다(누군가 20명과 매칭되는 상황을 막는 것이 목적).
create or replace function private.are_capacity_eligible(p_a uuid, p_b uuid, p_event_id uuid)
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
  a_active_count int;
  b_active_count int;
  already_matched boolean;
begin
  if p_a = p_b then
    return false;
  end if;

  select * into a from private.participants where id = p_a and event_id = p_event_id;
  select * into b from private.participants where id = p_b and event_id = p_event_id;
  if a.id is null or b.id is null then
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

  select count(*) into a_active_count from private.match_members where participant_id = p_a and ended_at is null;
  select count(*) into b_active_count from private.match_members where participant_id = p_b and ended_at is null;

  if a_active_count >= 2 or b_active_count >= 2 then
    return false;
  end if;
  if a_active_count > 0 and b_active_count > 0 then
    return false; -- 둘 다 이미 매치가 있으면 구제 대상이 아니다
  end if;

  select exists (
    select 1
    from private.match_members mm1
    join private.match_members mm2 on mm1.match_id = mm2.match_id
    where mm1.participant_id = p_a and mm2.participant_id = p_b
      and mm1.ended_at is null and mm2.ended_at is null
  ) into already_matched;
  if already_matched then
    return false;
  end if;

  return true;
end;
$$;

-- commit_matching_run 확장: "이미 활성 매치가 있으면 무조건 건너뛴다"는 원래 안전장치가
-- 정확히는 "1개 이상이면 건너뛴다"였다 — 구제 패스에서는 "2개 이상이면 건너뛴다"여야 한다.
-- 인자를 추가하므로(기본값 1 = 기존과 동일 동작) 기존 1-인자 시그니처를 먼저 지운다.
drop function if exists private.commit_matching_run(uuid);

create or replace function private.commit_matching_run(p_run_id uuid, p_max_active_matches int default 1)
returns jsonb
language plpgsql
as $$
declare
  v_run private.matching_runs%rowtype;
  v_pair record;
  v_match_id uuid;
  v_committed_count int := 0;
  v_a_count int;
  v_b_count int;
begin
  select * into v_run from private.matching_runs where id = p_run_id for update;
  if v_run.id is null then
    raise exception 'RUN_NOT_FOUND';
  end if;
  if v_run.status <> 'previewed' then
    raise exception 'RUN_NOT_PREVIEWED';
  end if;

  perform pg_advisory_xact_lock(hashtext(v_run.event_id::text));

  for v_pair in
    select participant_a_id, participant_b_id, score
    from private.match_candidates
    where run_id = p_run_id and accepted = true
  loop
    select count(*) into v_a_count from private.match_members where participant_id = v_pair.participant_a_id and ended_at is null;
    select count(*) into v_b_count from private.match_members where participant_id = v_pair.participant_b_id and ended_at is null;
    if v_a_count >= p_max_active_matches or v_b_count >= p_max_active_matches then
      continue; -- 미리보기 이후 다른 경로로 이미 상한을 채운 경우 건너뜀
    end if;

    insert into private.matches (event_id, run_id, score) values (v_run.event_id, p_run_id, v_pair.score)
      returning id into v_match_id;
    insert into private.match_members (event_id, match_id, participant_id) values
      (v_run.event_id, v_match_id, v_pair.participant_a_id),
      (v_run.event_id, v_match_id, v_pair.participant_b_id);
    insert into private.match_access (match_id, viewer_participant_id, partner_participant_id) values
      (v_match_id, v_pair.participant_a_id, v_pair.participant_b_id),
      (v_match_id, v_pair.participant_b_id, v_pair.participant_a_id);

    update private.participants set status = 'matched'
      where id in (v_pair.participant_a_id, v_pair.participant_b_id);

    v_committed_count := v_committed_count + 1;
  end loop;

  update private.matching_runs set status = 'committed', committed_at = now() where id = p_run_id;

  insert into private.audit_events (event_id, actor_type, action, entity_type, entity_id, metadata)
  values (v_run.event_id, 'operator', 'matching_run_committed', 'matching_run', p_run_id,
    jsonb_build_object('committed_count', v_committed_count));

  return jsonb_build_object('run_id', p_run_id, 'status', 'committed', 'committed_count', v_committed_count);
end;
$$;

-- 1차·2차(fallback) 이후에도 남는 미매칭자를 대상으로, 이미 1명과 매칭된 사람의 남은 여유(최대 2명)를
-- 활용해 한 번 더 매칭을 시도한다. run_matching_preview와 달리 preview 승인 없이 바로 확정까지 한 번에 한다
-- (fallback 패스와 동일하게, 이미 확정된 1차 위에서 자동으로 도는 마지막 구제 단계이기 때문).
create or replace function private.run_capacity_rescue(
  p_event_id uuid,
  p_min_score int default 30,
  p_seed text default null
)
returns jsonb
language plpgsql
as $$
declare
  v_seed text := coalesce(p_seed, 'rescue-' || p_event_id::text || '-' || extract(epoch from now())::text);
  v_run_id uuid;
  v_snapshot_hash text;
  v_stuck_count int;
  v_proposed int := 0;
  v_used uuid[] := '{}';
  v_row record;
  v_score jsonb;
  v_sort_key numeric;
  v_ids uuid[];
  v_committed jsonb;
begin
  if exists (select 1 from private.matching_runs where event_id = p_event_id and status = 'previewed') then
    raise exception 'ACTIVE_PREVIEW_EXISTS';
  end if;

  -- 후보 풀: 활성 매치가 2개 미만인 전원(아직 0개인 사람 + 이미 1개뿐인 사람 모두 포함).
  select array_agg(p.id order by p.id) into v_ids
  from private.participants p
  left join (
    select participant_id, count(*) as active_count
    from private.match_members where ended_at is null group by participant_id
  ) cnt on cnt.participant_id = p.id
  where p.event_id = p_event_id and not p.excluded
    and coalesce(cnt.active_count, 0) < 2;

  select count(*) into v_stuck_count
  from private.participants p
  left join (
    select participant_id, count(*) as active_count
    from private.match_members where ended_at is null group by participant_id
  ) cnt on cnt.participant_id = p.id
  where p.event_id = p_event_id and not p.excluded and coalesce(cnt.active_count, 0) = 0;

  v_snapshot_hash := encode(digest(coalesce(array_to_string(v_ids, ','), ''), 'sha256'), 'hex');

  insert into private.matching_runs (event_id, status, algorithm_version, min_score, wait_bonus_max, seed, snapshot_hash, input_count)
  values (p_event_id, 'previewed', 'capacity-rescue-v1.0.0', p_min_score, 0, v_seed, v_snapshot_hash, v_stuck_count)
  returning id into v_run_id;

  create temporary table tmp_rescue_candidates (
    a uuid, b uuid, score int, breakdown jsonb, sort_key numeric
  ) on commit drop;

  for v_row in
    select p1.id as a, p2.id as b
    from unnest(v_ids) p1(id)
    join unnest(v_ids) p2(id) on p1.id < p2.id
  loop
    if private.are_capacity_eligible(v_row.a, v_row.b, p_event_id) then
      v_score := private.calculate_match_score(v_row.a, v_row.b);
      if (v_score->>'total')::int >= p_min_score then
        v_sort_key := (v_score->>'total')::numeric
          + ('x' || substr(md5(v_seed || v_row.a::text || v_row.b::text), 1, 6))::bit(24)::int / 100000000.0;
        insert into tmp_rescue_candidates values (v_row.a, v_row.b, (v_score->>'total')::int, v_score, v_sort_key);
      end if;
    end if;
  end loop;

  insert into private.match_candidates (run_id, participant_a_id, participant_b_id, score, breakdown, accepted)
  select v_run_id, a, b, score, breakdown, false from tmp_rescue_candidates;

  -- 한 패스 안에서는 이미 매치가 있던 쪽도 딱 1개만 더 받는다(2개 상한 보장).
  for v_row in select a, b from tmp_rescue_candidates order by sort_key desc
  loop
    if not (v_row.a = any(v_used)) and not (v_row.b = any(v_used)) then
      update private.match_candidates
        set accepted = true
        where run_id = v_run_id and participant_a_id = v_row.a and participant_b_id = v_row.b;
      v_used := v_used || v_row.a || v_row.b;
      v_proposed := v_proposed + 1;
    end if;
  end loop;

  update private.matching_runs
    set proposed_match_count = v_proposed,
        unmatched_count = greatest(0, v_stuck_count - v_proposed)
    where id = v_run_id;

  v_committed := private.commit_matching_run(v_run_id, 2);

  insert into private.audit_events (event_id, actor_type, action, entity_type, entity_id, metadata)
  values (p_event_id, 'system', 'capacity_rescue_completed', 'matching_run', v_run_id,
    jsonb_build_object('stuck_before', v_stuck_count, 'proposed_match_count', v_proposed, 'min_score', p_min_score));

  return jsonb_build_object(
    'run_id', v_run_id,
    'stuck_before', v_stuck_count,
    'proposed_match_count', v_proposed,
    'committed', v_committed
  );
end;
$$;

-- rollback_matching_run 수정: 복수매칭 도입 후에는 이 run의 매치가 끝나도 참가자에게 다른 활성 매치가
-- 남아 있을 수 있다. 그런 경우 'waiting'으로 되돌리면 안 된다 — 남은 매치가 진짜 없는 사람만 되돌린다.
create or replace function private.rollback_matching_run(p_run_id uuid)
returns jsonb
language plpgsql
as $$
declare
  v_run private.matching_runs%rowtype;
  v_reverted int;
begin
  select * into v_run from private.matching_runs where id = p_run_id for update;
  if v_run.id is null or v_run.status <> 'committed' then
    raise exception 'RUN_NOT_COMMITTED';
  end if;

  with targets as (
    select mm.participant_id, m.id as match_id
    from private.matches m
    join private.match_members mm on mm.match_id = m.id and mm.ended_at is null
    where m.run_id = p_run_id and m.status = 'active'
  ),
  ended as (
    update private.match_members set ended_at = now()
    where match_id in (select match_id from targets)
    returning participant_id
  )
  select count(*) into v_reverted from ended;

  update private.matches set status = 'cancelled', cancelled_at = now() where run_id = p_run_id and status = 'active';

  update private.participants p
  set status = 'waiting'
  where p.id in (select mm.participant_id from private.match_members mm join private.matches m on m.id = mm.match_id where m.run_id = p_run_id)
    and not exists (
      select 1 from private.match_members mm2 where mm2.participant_id = p.id and mm2.ended_at is null
    );

  update private.matching_runs set status = 'rolled_back' where id = p_run_id;

  insert into private.audit_events (event_id, actor_type, action, entity_type, entity_id, metadata)
  values (v_run.event_id, 'operator', 'matching_run_rolled_back', 'matching_run', p_run_id, jsonb_build_object('reverted_participants', v_reverted));

  return jsonb_build_object('run_id', p_run_id, 'status', 'rolled_back', 'reverted_participants', v_reverted);
end;
$$;

-- commit_matching_run_with_fallback 확장: 임계값 완화 2차 패스 이후에도 남는 미매칭자가 있으면
-- 마지막으로 capacity rescue 패스를 자동 실행한다.
-- 매개변수를 하나 추가하므로 create or replace가 아니라 기존 2-인자 시그니처를 먼저 지워야 한다
-- (그렇지 않으면 오버로드로 남아 인자 1개짜리 호출이 모호해진다).
drop function if exists private.commit_matching_run_with_fallback(uuid, int);

create or replace function private.commit_matching_run_with_fallback(
  p_run_id uuid,
  p_fallback_min_score int default 35,
  p_rescue_min_score int default 30
)
returns jsonb
language plpgsql
as $$
declare
  v_first jsonb;
  v_event_id uuid;
  v_remaining int;
  v_second_preview jsonb;
  v_second_commit jsonb;
  v_second_run_id uuid;
  v_rescue jsonb;
begin
  v_first := private.commit_matching_run(p_run_id);
  select event_id into v_event_id from private.matching_runs where id = p_run_id;

  select count(*) into v_remaining
  from private.participants
  where event_id = v_event_id and status = 'waiting' and not excluded;

  if v_remaining < 2 then
    -- 일반 2차 패스는 둘 이상 남아야 의미가 있지만, 성비 불균형이면 1명만 남을 수도 있다.
    -- 그 1명을 구제하는 것이 capacity rescue의 존재 이유이므로 이건 그대로 시도한다.
    v_rescue := private.run_capacity_rescue(v_event_id, p_rescue_min_score);
    return v_first || jsonb_build_object('fallback_ran', false, 'fallback_reason', 'not_enough_remaining', 'rescue', v_rescue);
  end if;

  v_second_preview := private.run_matching_preview(v_event_id, p_fallback_min_score, 0, 'fallback-' || p_run_id::text);
  v_second_run_id := (v_second_preview->>'run_id')::uuid;
  v_second_commit := private.commit_matching_run(v_second_run_id);

  insert into private.audit_events (event_id, actor_type, action, entity_type, entity_id, metadata)
  values (v_event_id, 'system', 'fallback_pass_completed', 'matching_run', v_second_run_id,
    jsonb_build_object('primary_run_id', p_run_id, 'fallback_min_score', p_fallback_min_score, 'remaining_before', v_remaining));

  v_rescue := private.run_capacity_rescue(v_event_id, p_rescue_min_score);

  return jsonb_build_object(
    'primary', v_first,
    'fallback_ran', true,
    'fallback_min_score', p_fallback_min_score,
    'fallback', v_second_commit,
    'fallback_preview', v_second_preview,
    'rescue', v_rescue
  );
end;
$$;
