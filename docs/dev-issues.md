# 72시간 메캠팅 — 개발 현황 정리

최종 갱신: 2026-09-04
참고: `docs/user-flow.html` (참가자/예외·분기/관리자 유저플로우 다이어그램)

git 커밋 3개로 반영됨 (`ba85210`, `b85b944`, `3d0f419`) — 아직 원격(GitHub 등)에는 push 안 됨, 로컬 브랜치에만 있음.

## 한 줄 요약

**참가자 플로우 + 관리자 패널 5개 전부 로컬 Supabase 기준으로 실제 동작 확인 완료.** 남은 건 코드가 아니라 **배포 인프라**(호스팅 Supabase 프로젝트, Vercel 환경변수, 실제 운영자 계정) — 전부 개발자가 아니라 계정 권한이 있는 사람만 할 수 있는 일임.

---

## A. 완료 — 리브랜딩·디자인

- 페이지1 문구, 날짜(2026.09.21~09.22)·시간·장소를 공식 포스터 기준으로 반영 (`eventConfig.ts`)
- 학과에 **의예과 추가 + '직접입력'** 반영 (`SurveyBasicInfoScreen.tsx`)
- 미션3 텍스트를 포스터 기준("학과교류주점에 방문해 함께 사진을 찍고, 상품을 받으세요!")으로 수정 + 인스타 DM 인증 안내 문구 추가 (`CheatkeySheet.tsx`)
- 공식 자산(포스터/미션카드/마스코트)에서 색상·마스코트 이미지를 추출해 전체 리테마 (`tokens.css`) — 관리자 화면까지 자동으로 브랜드 색이 적용됨
- 관리자 페이지에 미션 인증 기능은 넣지 않음 (인스타 DM으로 운영진이 직접 확인하는 방식 유지)

## B. 완료 — 백엔드 연동 (참가자 플로우)

브라우저에서 랜딩→동의→설문→제출→대기→(운영자 수기매칭)→결과→치트키까지 전 구간을 직접 클릭해서 확인함.

- **참가자 제출**: `submit_my_entry` RPC. 참가자/프로필/선호/동의/연락처가 실제 DB에 저장, 매칭번호·복구코드 응답. 중복 제출 시 `already_submitted` 반환.
- **매칭 대기**: `get_my_status`를 15초 간격 폴링. 운영자가 수기 매칭을 확정하면 "매칭이 완료됐어요" 배너가 폴링만으로 실시간으로 뜨는 것 확인.
- **매칭 결과 공개**: `get_my_result`가 `event_features.result_reveal_enabled`를 존중 — 운영자가 결과 공개를 끄면 매칭된 사람도 대기 취급(`pending_reveal`).
- **라우트 가드**: 랜딩(이미 참여 시 "이미 참여하셨습니다"), 대기(미제출 시 리다이렉트), 결과(미매칭 시 대기로 리다이렉트) 전부 실제 상태 기반.
- **수기 매칭(온라인 매칭 오류 백업 경로)**: 지금까지 DB에 없던 것을 신규 구현 (`admin_manual_match`). 상한(2명)·중복매칭 방지 적용.
- **푸시 구독 저장**: `save_my_push_subscription` 연결.
- **치트키(연락처 공개) 흐름**: 팔로우 버튼 클릭 → 실제 인스타그램 오픈 + 서버에 "확인 대기" 기록 → 운영자 승인 → 그제서야 상대 연락처가 화면에 나타나는 것까지 확인.

## C. 완료 — 관리자 패널 5개 전부 실데이터 연동

| 패널 | 연동 내용 |
|---|---|
| 개요 | `admin_overview`/`admin_list_cheatkey_queue`로 참가자 수·대기·매칭완료·확인대기 표시(20초 자동 새로고침) |
| 매칭 실행 | `admin_run_matching_preview`/`admin_commit_matching_run_with_fallback`/`admin_rollback_matching_run` — curl로 실제 매칭 확인(14명 입력 → 7쌍 성사) |
| 운영 대기열 | 실제 팔로우 확인 대기열 + "승인" 버튼(`admin_unlock_cheatkey`) |
| 행사 제어 | 5개 스위치(`registration_open` 등) 전부 `admin_get/set_event_feature`로 실제 DB 반영. "지금 접수 잠그기" → 참가자 랜딩 화면이 실시간으로 바뀌는 것까지 확인 |
| 접수 퍼널 | 6단계(시작/제출성공/대기/매칭/결과열람/치트키해제) 전부 연동. "시작"·"결과 열람"은 기존에 없던 페이지뷰라 `private.funnel_events` 테이블 신규 추가(익명 세션당 1회, 개인 식별 정보 없음) |

`/admin/login` 이메일·비밀번호 로그인 + `is_operator()` 권한 가드도 함께 추가됨.

## D. 연동하다가 발견해서 고친 버그 3가지

감사(코드만 읽음)로는 안 보이고, 실제로 연결해서 호출해봐야만 드러나는 것들이었습니다.

1. **`public.events`/`public.event_features`에 RLS 정책은 있었지만 테이블 단위 SELECT grant가 없었습니다.** RLS는 grant가 있어야 그 위에서 행을 걸러줄 뿐 grant 자체를 대신해주지 않습니다 — 참가자 웹이 이벤트 정보를 아예 못 읽는 상태였습니다(`permission denied for table events`로 재현). `20260904020000_grant_public_tables.sql`에서 수정.
2. **`CheatkeySheet`가 상대의 Instagram ID·전화번호를 잠금 여부와 무관하게 항상 props로 통째로 받고 있었습니다.** 화면엔 조건부 렌더링으로 가려져 있었지만, 운영자 확인 전에도 이미 브라우저에 데이터가 와 있었습니다. `get_my_unlocked_contact` RPC가 `match_access.status = 'unlocked'`일 때만 값을 내려주도록 수정.
3. **`supabase-js`의 쿼리 빌더(`.from()`/`.rpc()`)는 lazy thenable입니다 — `.then()`/`await` 없이 fire-and-forget으로 호출하면 에러도 없이 실제 HTTP 요청이 안 나갑니다.** 접수 퍼널 로그 호출에서 이 함정에 걸려 조용히 실패하는 걸 직접 재현해서 원인을 좁혔고 수정했습니다. **앞으로 결과가 필요 없는 `supabase.rpc(...)` 호출도 항상 `.then()`이나 `await`을 붙여야 합니다.**

---

## E. 아직 남은 것

### 배포 전 반드시 확인 (개발자/운영진만 할 수 있음)
- **호스팅된 Supabase 프로젝트 생성** — 아직 없음. 지금까지 전부 로컬(`supabase start`)로만 개발·검증함.
- 호스팅 프로젝트에서 **Auth → Providers → Anonymous 활성화** 필수. 꺼져 있으면 참가자 신원 체계(로그인 없이 `auth.uid()`로 식별) 전체가 작동하지 않습니다. 로컬 `supabase/config.toml`의 설정은 로컬 전용이라 호스팅 프로젝트엔 영향 없음.
- Vercel에 `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` 환경변수 추가 (`vercel env ls` 확인 결과 아직 없음). service role 키는 절대 `VITE_` 접두어 금지.
- 실제 운영자 계정 생성 + `private.operator_roles`에 role 부여
- 로컬 브랜치를 원격 저장소로 push

### 기능적으로 아직 안 됨
- **복구 코드로 다른 기기에서 재접속** — `recovery_code_hash` 컬럼은 있지만 그 코드로 세션을 다시 연결해주는 RPC가 없음. 지금은 같은 브라우저(로컬스토리지)를 벗어나면 복구 불가.
- 운영 대기열은 지금 "팔로우 확인"만 다룸. 코드 복구·신고·재배정은 스키마 자체가 없어서 안 넣었음 — 필요하면 별도 설계 필요.
- 미션 체크리스트(치트키 안쪽 1·2·3 체크)는 로컬 상태일 뿐 서버 미기록 — 의도된 것. 실제 미션 인증은 인스타그램 DM으로 운영진이 직접 확인하는 방식이라 앱 안의 체크는 개인용 체크리스트 이상의 의미가 없음.

---

## F. 참고 — 로컬 개발 환경

- `supabase start` (Docker/colima 필요) → `supabase db reset`으로 마이그레이션 12개 + `seed.sql` 적용
- `.env`에 로컬 Supabase URL/anon key 이미 설정됨 (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`)
- 로컬 관리자 테스트 계정: `operator-test@example.com` — 로컬 DB 리셋 시 사라지므로 이어받는 사람은 재생성 필요
