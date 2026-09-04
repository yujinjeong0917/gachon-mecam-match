-- 실제 행사 데이터(테스트 참가자 아님). seed.sql은 로컬 검증용 가짜 참가자까지 같이 들어있어
-- 호스팅 DB에는 적용하지 않았는데, 그 안에 있던 이 이벤트 행 자체까지 같이 빠뜨렸다 — 이벤트가
-- 없으면 참가자 웹이 event_id를 찾지 못해 아무것도 제출할 수 없다. 이름은 리브랜딩 이후 기준으로.

insert into public.events (id, slug, name, starts_at, ends_at, status)
values ('11111111-1111-1111-1111-111111111111', 'gachon-medical-fall-2026', '72시간 메캠팅', '2026-09-21 12:00+09', '2026-09-22 17:00+09', 'registration_open')
on conflict (id) do update set name = excluded.name, starts_at = excluded.starts_at, ends_at = excluded.ends_at;

insert into public.event_features (event_id) values ('11111111-1111-1111-1111-111111111111')
on conflict (event_id) do nothing;
