-- 버그: 적격 후보 쌍이 하나도 없을 때(성비가 심하게 치우쳤거나 조건 맞는 상대가 없을 때)
-- jsonb_object_agg가 빈 집합에 대해 '{}'가 아니라 NULL을 반환한다.
-- 프론트엔드(MatchingRunPanel)는 score_distribution을 항상 객체로 가정하고
-- Object.values/Object.entries를 바로 호출하므로, NULL이 내려오면
-- "Cannot convert undefined or null to object"로 컴포넌트 전체가 크래시하고
-- 미리보기 결과 화면이 통째로 사라진다(운영자에게는 "미리보기에서 매칭결과가 안나와"로 보임).
-- coalesce로 빈 경우 '{}'::jsonb를 내려주도록 수정.

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
    'score_distribution', coalesce((
      select jsonb_object_agg(bucket, cnt) from (
        select
          -- 10점 단위로 동적 생성 (fallback pass는 min_score가 50 미만일 수 있어 50~90 고정 구간으로는 부족했다)
          case
            when score >= 90 then '90_100'
            else (floor(score / 10.0) * 10)::int::text || '_' || ((floor(score / 10.0) * 10)::int + 9)::text
          end as bucket,
          count(*) as cnt
        from tmp_candidates
        group by 1
      ) s
    ), '{}'::jsonb)
  );
end;
$$;
