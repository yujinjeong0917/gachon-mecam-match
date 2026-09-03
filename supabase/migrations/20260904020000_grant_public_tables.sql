-- rls.sql가 public.events/event_features에 RLS 정책은 만들었지만 테이블 단위 SELECT grant를
-- anon/authenticated에 내준 적이 없었다 — RLS는 grant가 있어야 그 위에서 행을 걸러줄 뿐,
-- grant 자체를 대신해주지 않는다. 그 결과 참가자 웹이 이벤트 정보를 아예 읽을 수 없었다(로컬에서 직접 확인).

grant select on public.events to anon, authenticated;
grant select on public.event_features to anon, authenticated;
