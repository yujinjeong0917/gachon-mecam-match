-- 16:00 일괄 매칭 정책 변경: 5분 rolling batch였던 원래 설계 대신 하루 1회만 돈다.
-- 그래서 "다음 배치에서 다시 찾아볼게요"가 더 이상 성립하지 않는다.
-- 대신 1차 확정 후 그 자리에서 임계값을 낮춰 미매칭자만 대상으로 2차 매칭을 자동으로 한 번 더 돈다.

set search_path = private, public;

create or replace function private.commit_matching_run_with_fallback(
  p_run_id uuid,
  p_fallback_min_score int default 35
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
begin
  v_first := private.commit_matching_run(p_run_id);
  select event_id into v_event_id from private.matching_runs where id = p_run_id;

  select count(*) into v_remaining
  from private.participants
  where event_id = v_event_id and status = 'waiting' and not excluded;

  if v_remaining < 2 then
    return v_first || jsonb_build_object('fallback_ran', false, 'fallback_reason', 'not_enough_remaining');
  end if;

  -- 문서01 §4.4 원칙 유지: 임계값을 "무단으로" 낮추지 않는다 — 운영자가 설정한 값보다 낮출 순 없고
  -- 사전에 합의한 구제 임계값(fallback_min_score)까지만, 그리고 딱 한 번만 더 돈다.
  v_second_preview := private.run_matching_preview(v_event_id, p_fallback_min_score, 0, 'fallback-' || p_run_id::text);
  v_second_run_id := (v_second_preview->>'run_id')::uuid;
  v_second_commit := private.commit_matching_run(v_second_run_id);

  insert into private.audit_events (event_id, actor_type, action, entity_type, entity_id, metadata)
  values (v_event_id, 'system', 'fallback_pass_completed', 'matching_run', v_second_run_id,
    jsonb_build_object('primary_run_id', p_run_id, 'fallback_min_score', p_fallback_min_score, 'remaining_before', v_remaining));

  return jsonb_build_object(
    'primary', v_first,
    'fallback_ran', true,
    'fallback_min_score', p_fallback_min_score,
    'fallback', v_second_commit,
    'fallback_preview', v_second_preview
  );
end;
$$;
