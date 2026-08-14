-- 문서01 §4.1/§4.4, 문서03 §5 배치 실행 흐름.
-- run_matching_preview: DB에 매치를 만들지 않고 후보만 계산 (POST /admin/matching-runs/preview)
-- commit_matching_run: 미리보기를 원자적으로 확정 (POST /admin/matching-runs/{id}/commit)
-- rollback_matching_run: 확정된 run을 취소하고 양쪽을 waiting으로 되돌림

set search_path = private, public;

create or replace function private.run_matching_preview(
  p_event_id uuid,
  p_min_score int default 50,
  p_wait_bonus_max int default 5,
  p_seed text default null
)
returns jsonb
language plpgsql
as $$
declare
  v_seed text := coalesce(p_seed, p_event_id::text || '-' || extract(epoch from now())::text);
  v_run_id uuid;
  v_snapshot_hash text;
  v_input_count int;
  v_proposed int := 0;
  v_used uuid[] := '{}';
  v_row record;
  v_score jsonb;
  v_wait_bonus numeric;
  v_sort_key numeric;
  v_ids uuid[];
begin
  -- 문서04 §5: 한 이벤트에는 active matching run이 1개.
  if exists (select 1 from private.matching_runs where event_id = p_event_id and status = 'previewed') then
    raise exception 'ACTIVE_PREVIEW_EXISTS';
  end if;

  select array_agg(id order by id) into v_ids
  from private.participants
  where event_id = p_event_id and status = 'waiting' and not excluded;

  v_input_count := coalesce(array_length(v_ids, 1), 0);
  v_snapshot_hash := encode(digest(coalesce(array_to_string(v_ids, ','), ''), 'sha256'), 'hex');

  insert into private.matching_runs (event_id, status, min_score, wait_bonus_max, seed, snapshot_hash, input_count)
  values (p_event_id, 'previewed', p_min_score, p_wait_bonus_max, v_seed, v_snapshot_hash, v_input_count)
  returning id into v_run_id;

  -- 모든 적격 쌍을 점수와 함께 임시로 쌓는다 (전체 그래프를 봐야 개인별 탐욕 문제를 피할 수 있다).
  create temporary table tmp_candidates (
    a uuid, b uuid, score int, breakdown jsonb, sort_key numeric
  ) on commit drop;

  for v_row in
    select p1.id as a, p2.id as b
    from unnest(v_ids) p1(id)
    join unnest(v_ids) p2(id) on p1.id < p2.id
  loop
    if private.are_mutually_eligible(v_row.a, v_row.b, p_event_id) then
      v_score := private.calculate_match_score(v_row.a, v_row.b);
      if (v_score->>'total')::int >= p_min_score then
        v_wait_bonus := least(
          p_wait_bonus_max,
          greatest(
            extract(epoch from (now() - (select submitted_at from private.participants where id = v_row.a))) / 60.0,
            extract(epoch from (now() - (select submitted_at from private.participants where id = v_row.b))) / 60.0
          ) / 12.0 -- 대략 1시간 대기당 5점 만점에 수렴
        );
        v_sort_key := (v_score->>'total')::numeric + v_wait_bonus
          + ('x' || substr(md5(v_seed || v_row.a::text || v_row.b::text), 1, 6))::bit(24)::int / 100000000.0; -- 결정론적 동점 처리
        insert into tmp_candidates values (v_row.a, v_row.b, (v_score->>'total')::int, v_score, v_sort_key);
      end if;
    end if;
  end loop;

  insert into private.match_candidates (run_id, participant_a_id, participant_b_id, score, breakdown, accepted)
  select v_run_id, a, b, score, breakdown, false from tmp_candidates;

  -- 전역 엣지를 점수 내림차순으로 훑으며 충돌 없는 쌍만 그리디로 채택한다.
  -- (개인별 "내 1순위부터" 탐욕이 아니라 그래프 전체 기준 탐욕 — 문서01 §4.3의 요구사항.)
  for v_row in select a, b from tmp_candidates order by sort_key desc
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
        unmatched_count = v_input_count - v_proposed * 2
    where id = v_run_id;

  insert into private.audit_events (event_id, actor_type, action, entity_type, entity_id, metadata)
  values (p_event_id, 'operator', 'matching_run_previewed', 'matching_run', v_run_id,
    jsonb_build_object('input_count', v_input_count, 'proposed_match_count', v_proposed));

  return jsonb_build_object(
    'run_id', v_run_id,
    'status', 'previewed',
    'snapshot_hash', v_snapshot_hash,
    'input_count', v_input_count,
    'proposed_match_count', v_proposed,
    'unmatched_count', v_input_count - v_proposed * 2,
    'score_distribution', (
      select jsonb_object_agg(bucket, cnt) from (
        select
          case
            when score < 60 then '50_59' when score < 70 then '60_69' when score < 80 then '70_79'
            when score < 90 then '80_89' else '90_100'
          end as bucket,
          count(*) as cnt
        from tmp_candidates
        group by 1
      ) s
    )
  );
end;
$$;

create or replace function private.commit_matching_run(p_run_id uuid)
returns jsonb
language plpgsql
as $$
declare
  v_run private.matching_runs%rowtype;
  v_pair record;
  v_match_id uuid;
  v_committed_count int := 0;
begin
  select * into v_run from private.matching_runs where id = p_run_id for update;
  if v_run.id is null then
    raise exception 'RUN_NOT_FOUND';
  end if;
  if v_run.status <> 'previewed' then
    raise exception 'RUN_NOT_PREVIEWED';
  end if;

  -- 행사 단위 advisory lock: 동시에 두 run이 같은 이벤트를 확정하지 못하게.
  perform pg_advisory_xact_lock(hashtext(v_run.event_id::text));

  for v_pair in
    select participant_a_id, participant_b_id, score
    from private.match_candidates
    where run_id = p_run_id and accepted = true
  loop
    -- 문서04 §5 unique index가 실제 안전장치. 여기서도 한 번 더 확인.
    if exists (select 1 from private.match_members where participant_id in (v_pair.participant_a_id, v_pair.participant_b_id) and ended_at is null) then
      continue; -- 미리보기 이후 다른 경로로 이미 매칭된 경우 건너뜀
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
  update private.participants set status = 'waiting'
    where id in (select mm.participant_id from private.match_members mm join private.matches m on m.id = mm.match_id where m.run_id = p_run_id);
  update private.matching_runs set status = 'rolled_back' where id = p_run_id;

  insert into private.audit_events (event_id, actor_type, action, entity_type, entity_id, metadata)
  values (v_run.event_id, 'operator', 'matching_run_rolled_back', 'matching_run', p_run_id, jsonb_build_object('reverted_participants', v_reverted));

  return jsonb_build_object('run_id', p_run_id, 'status', 'rolled_back', 'reverted_participants', v_reverted);
end;
$$;
