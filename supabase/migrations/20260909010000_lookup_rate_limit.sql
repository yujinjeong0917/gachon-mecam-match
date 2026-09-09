-- 보안 리뷰에서 발견: lookup_by_recovery_code / lookup_by_nickname_phone는 anon 권한으로
-- 완전히 열려있고 rate limit이 전혀 없었다.
-- - lookup_by_recovery_code: 매칭번호(M-001부터 순차, 추측 가능) + 6자리 코드(100만 경우의 수)
-- - lookup_by_nickname_phone: 닉네임(상대에게 이미 노출되는 정보) + 전화번호 뒷 4자리(1만 경우의 수)
-- 둘 다 맞히면 그 사람의 매칭 상태 + 상대방 프로필(닉네임·학과·학년·MBTI·성격·한마디)을 그대로 돌려준다.
-- 스크립트 하나로 몇 시간 안에 전수조사가 가능한 구조라, PostgREST가 넘겨주는 클라이언트 IP 기준으로
-- 이벤트당·IP당 10분에 10회로 제한한다. 정상 사용자가 코드/닉네임을 몇 번 잘못 입력하는 정도는
-- 여유 있게 통과하고, 스크립트로 수천~수만 번 시도하는 경우만 막는 것이 목적이다.

set search_path = private, public, extensions;

create table private.lookup_attempts (
  id bigserial primary key,
  event_id uuid not null references public.events(id) on delete cascade,
  ip text not null,
  created_at timestamptz not null default now()
);

create index lookup_attempts_event_ip_created_idx on private.lookup_attempts (event_id, ip, created_at);

revoke all on private.lookup_attempts from anon, authenticated;

-- true = 이번 시도를 진행해도 됨(기록도 남김). false = 이번 윈도우에서 한도 초과.
create or replace function private.check_and_record_lookup_attempt(
  p_event_id uuid,
  p_limit int default 10,
  p_window interval default interval '10 minutes'
)
returns boolean
language plpgsql
as $$
declare
  v_ip text;
  v_count int;
begin
  v_ip := coalesce(
    nullif(split_part(coalesce(current_setting('request.headers', true), '{}')::json ->> 'x-forwarded-for', ',', 1), ''),
    'unknown'
  );

  -- 이 event+ip 조합의 오래된 기록만 지운다(전체 테이블 스캔 방지, 그리고 무제한으로 안 쌓이게).
  delete from private.lookup_attempts
    where event_id = p_event_id and ip = v_ip and created_at < now() - p_window;

  select count(*) into v_count
    from private.lookup_attempts
    where event_id = p_event_id and ip = v_ip and created_at >= now() - p_window;

  if v_count >= p_limit then
    return false;
  end if;

  insert into private.lookup_attempts (event_id, ip) values (p_event_id, v_ip);
  return true;
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
  if not private.check_and_record_lookup_attempt(p_event_id) then
    return jsonb_build_object('status', 'rate_limited');
  end if;

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
  if not private.check_and_record_lookup_attempt(p_event_id) then
    return jsonb_build_object('status', 'rate_limited');
  end if;

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
