-- 문서04 "DB·보안 설계" §2~§5 기준 스키마.
-- 데모/로컬 검증 범위로 축소: 암호화(pgcrypto)와 Google Sheets outbox는 다음 단계로 남겨둔다.

create schema if not exists private;

-- =========================================================
-- 1. 행사·참가자
-- =========================================================

create table public.events (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status text not null default 'registration_open'
    check (status in ('draft','registration_open','registration_closed','matching','result_open','closed','archived')),
  created_at timestamptz not null default now()
);

create table public.event_features (
  event_id uuid primary key references public.events(id) on delete cascade,
  registration_open boolean not null default true,
  matching_enabled boolean not null default true,
  result_reveal_enabled boolean not null default true,
  cheat_unlock_enabled boolean not null default true,
  fallback_mode boolean not null default false,
  message text
);

create table private.participants (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  auth_user_id uuid, -- Supabase auth.users.id. 로컬 데모에서는 nullable.
  matching_number text not null,
  recovery_code_hash text not null,
  status text not null default 'waiting'
    check (status in ('draft','waiting','matched','withdrawn','cancelled')),
  age_18_plus boolean not null default false,
  excluded boolean not null default false, -- 운영자 제외/차단 처리
  submitted_at timestamptz not null default now(),
  unique (event_id, matching_number)
);

create unique index participants_event_user_uq
  on private.participants (event_id, auth_user_id)
  where auth_user_id is not null;

create index participants_waiting_idx
  on private.participants (event_id, submitted_at)
  where status = 'waiting';

create table private.profiles (
  participant_id uuid primary key references private.participants(id) on delete cascade,
  nickname text not null,
  department text not null,
  grade int not null check (grade between 1 and 6),
  gender_code text not null check (gender_code in ('male','female','other')),
  mbti text,
  one_liner text
);

create table private.preferences (
  participant_id uuid primary key references private.participants(id) on delete cascade,
  seeking_gender_codes text[] not null default '{}', -- 'male'|'female'|'any'
  preferred_grades int[] not null default '{1,2,3,4,5,6}',
  self_traits text[] not null default '{}',
  desired_traits text[] not null default '{}',
  interests text[] not null default '{}',
  activities text[] not null default '{}',
  food_tags text[] not null default '{}',
  music_tags text[] not null default '{}',
  conversation_style text
);

create table private.consents (
  participant_id uuid primary key references private.participants(id) on delete cascade,
  policy_version text not null,
  age_18_plus boolean not null default false,
  participation boolean not null default false,
  profile_share boolean not null default false,
  instagram_share_if_matched boolean not null default false,
  analytics boolean not null default false,
  consented_at timestamptz not null default now()
);

create table private.private_contacts (
  participant_id uuid primary key references private.participants(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  -- TODO(운영 전 필수): app-level AES-GCM 암호화. 지금은 로컬 검증용 평문.
  instagram_handle text not null,
  contact_preference text,
  deleted_at timestamptz
);

create unique index private_contacts_event_handle_uq
  on private.private_contacts (event_id, lower(instagram_handle))
  where deleted_at is null;

-- =========================================================
-- 2. 매칭
-- =========================================================

create table private.matching_runs (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  status text not null default 'previewed'
    check (status in ('previewed','committed','rolled_back')),
  algorithm_version text not null default 'mutual-v1.0.0',
  min_score int not null default 50,
  wait_bonus_max int not null default 5,
  seed text not null,
  snapshot_hash text not null,
  input_count int not null default 0,
  proposed_match_count int not null default 0,
  unmatched_count int not null default 0,
  started_at timestamptz not null default now(),
  committed_at timestamptz
);

create unique index matching_runs_one_active_uq
  on private.matching_runs (event_id)
  where status = 'previewed';

create table private.match_candidates (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references private.matching_runs(id) on delete cascade,
  participant_a_id uuid not null references private.participants(id),
  participant_b_id uuid not null references private.participants(id),
  score int not null check (score between 0 and 100),
  breakdown jsonb not null,
  accepted boolean not null default false, -- 이 run에서 최종 선택된 간선인지
  check (participant_a_id < participant_b_id)
);

create index match_candidates_run_idx on private.match_candidates (run_id);

create table private.matches (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  run_id uuid not null references private.matching_runs(id),
  score int not null check (score between 0 and 100),
  status text not null default 'active' check (status in ('active','cancelled')),
  created_at timestamptz not null default now(),
  cancelled_at timestamptz
);

create table private.match_members (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  match_id uuid not null references private.matches(id) on delete cascade,
  participant_id uuid not null references private.participants(id),
  joined_at timestamptz not null default now(),
  ended_at timestamptz
);

-- 문서04 §5 개정: 원칙은 참가자 한 명당 활성 매치 1개. 단 성비 불균형으로 미매칭이 남을 때
-- 구제(capacity rescue) 패스에서만 최대 2개까지 허용한다(참가자에게 사전 공지, 최대 2인 상한).
-- 정확히 N개까지만 허용해야 하므로 unique index가 아니라 트리거로 카운트를 검사한다.
create or replace function private.check_active_match_capacity()
returns trigger
language plpgsql
as $$
declare
  v_active_count int;
  v_max_matches constant int := 2;
begin
  if new.ended_at is not null then
    return new;
  end if;
  select count(*) into v_active_count
  from private.match_members
  where participant_id = new.participant_id and ended_at is null;
  if v_active_count >= v_max_matches then
    raise exception 'ACTIVE_MATCH_CAPACITY_EXCEEDED';
  end if;
  return new;
end;
$$;

create trigger match_members_capacity_trg
  before insert on private.match_members
  for each row execute function private.check_active_match_capacity();

create table private.match_access (
  match_id uuid not null references private.matches(id) on delete cascade,
  viewer_participant_id uuid not null references private.participants(id),
  partner_participant_id uuid not null references private.participants(id),
  status text not null default 'locked' check (status in ('locked','waiting_for_operator','unlocked')),
  unlocked_by uuid,
  unlocked_at timestamptz,
  primary key (match_id, viewer_participant_id)
);

-- =========================================================
-- 3. 운영·감사
-- =========================================================

create table private.audit_events (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references public.events(id),
  actor_type text not null,
  actor_id text,
  action text not null,
  entity_type text,
  entity_id uuid,
  metadata jsonb,
  created_at timestamptz not null default now()
);
