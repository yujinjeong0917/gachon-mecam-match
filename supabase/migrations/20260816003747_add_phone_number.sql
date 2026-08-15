-- 전화번호도 Instagram과 같은 방식(운영자 확인 후에만 공개)으로 다룬다.
-- TODO(운영 전 필수): instagram_handle과 마찬가지로 app-level 암호화 필요. 지금은 로컬 검증용 평문.

alter table private.private_contacts
  add column phone_number text;
