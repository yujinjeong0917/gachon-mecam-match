# 72시간 메캠팅 — 개발 현황 정리

작성일: 2026-09-04 (2026-09-03 작성본 전면 갱신 — 그날 나열한 P0/P1 이슈 대부분을 오늘 실제로 고쳤습니다)
참고: `docs/user-flow.html` (참가자/예외·분기/관리자 유저플로우 다이어그램)

⚠️ **아직 아무것도 git commit되지 않았습니다.** 아래 모든 변경은 워킹 트리에만 있는 상태입니다.

---

## A. 유저플로우/디자인 반영 — 완료

- 페이지1 문구, 날짜(2026.09.21~09.22)·시간·장소를 공식 포스터 기준으로 반영 (`eventConfig.ts`)
- 학과에 **의예과 추가 + '직접입력'** 반영, 실제 동작 확인 (`SurveyBasicInfoScreen.tsx`)
- 미션3 텍스트를 포스터 기준("학과교류주점에 방문해 함께 사진을 찍고, 상품을 받으세요!")으로 수정 + 인스타 DM 인증 안내 문구 추가 (`CheatkeySheet.tsx`)
- 공식 자산(포스터/미션카드/마스코트)에서 색상·마스코트 이미지를 추출해 전체 리테마 (`tokens.css`) — 관리자 화면까지 자동으로 브랜드 색이 적용됨
- 관리자 페이지에 미션 인증 기능은 넣지 않음 (인스타 DM으로 운영진이 직접 확인하는 방식 유지)

---

## B. 오늘 실제로 백엔드에 연결한 것 — 완료, 로컬에서 실제 동작 확인함

지난 감사에서 "화면은 있는데 Supabase 호출이 하나도 없다"고 지적했던 부분을 실제로 연결했습니다. curl로 RPC만 테스트한 게 아니라 **브라우저에서 랜딩→동의→설문→제출→대기→(운영자 수기매칭)→결과→치트키까지 전 구간을 직접 클릭해서 확인**했습니다.

- **참가자 제출**: `submit_my_entry` RPC 신규 작성. 실제 DB에 참가자/프로필/선호/동의/연락처가 저장되고, 매칭번호·복구코드가 응답으로 옴. 중복 제출 시 `already_submitted` 반환 확인.
- **매칭 대기**: `WaitingPage`가 `get_my_status`를 15초 간격으로 실제 폴링. 관리자가 수기 매칭을 확정하자 대기 화면에 "매칭이 완료됐어요" 배너가 **폴링만으로 실시간으로 떴습니다.**
- **매칭 결과 공개**: `get_my_result`가 `event_features.result_reveal_enabled`를 존중하도록 수정 — 운영자가 결과 공개를 끄면 매칭된 사람도 대기 화면 취급을 받음(`pending_reveal`).
- **라우트 가드**: 랜딩(이미 참여 시 "이미 참여하셨습니다" 분기), 대기(제출 안 한 사람 리다이렉트), 결과(미매칭 시 대기로 리다이렉트) 전부 실제 상태 기반으로 동작.
- **수기 매칭(온라인 매칭 오류 백업 경로)**: DB에 아예 없던 것을 신규 구현 (`admin_manual_match` → `private.manual_match_participants`). 상한(2명)·중복매칭 방지 그대로 적용됨.
- **관리자 인증**: `/admin/login` 이메일·비밀번호 로그인 신규 추가, `/admin`은 로그인 + `is_operator()` 확인 후에만 진입 가능하도록 가드.
- **관리자 매칭 실행**: preview/commit(fallback+구제 자동 포함)/rollback을 `is_operator()`로 게이팅하는 public 래퍼 신규 작성, curl로 실제 매칭 실행 확인(입력 14명 → 7쌍 성사).
- **푸시 구독 저장**: `WaitingScreen`의 TODO를 실제 `save_my_push_subscription` 호출로 연결.
- **치트키(연락처 공개) 흐름**: 참가자가 팔로우 버튼을 누르면 실제로 인스타그램이 열리고 서버에 "확인 대기" 상태가 기록되며, 관리자가 승인하면 그제서야 상대 연락처가 화면에 나타나는 것까지 확인.

---

## C. 오늘 연결하면서 발견한 숨은 버그 2가지

감사(코드만 읽음)로는 안 보이고, 실제로 연결해서 호출해봐야만 드러나는 것들이었습니다.

1. **`public.events` / `public.event_features`에 RLS 정책은 있었지만 테이블 단위 SELECT grant가 없었습니다.** RLS는 grant가 있어야 그 위에서 행을 걸러줄 뿐 grant 자체를 대신해주지 않습니다 — 그 결과 참가자 웹이 이벤트 정보를 아예 못 읽는 상태였습니다(로컬에서 `permission denied for table events`로 직접 재현). `supabase/migrations/20260904020000_grant_public_tables.sql`에서 수정.
2. **`CheatkeySheet`가 상대의 Instagram ID·전화번호를 잠금 여부와 무관하게 항상 props로 통째로 받고 있었습니다.** 화면에는 조건부 렌더링으로 가려져 있었지만, 운영자 확인 전에도 이미 브라우저에 데이터가 와 있는 상태였습니다. 이제 `get_my_unlocked_contact` RPC가 `match_access.status = 'unlocked'`일 때만 값을 내려주도록 바꿔서, 잠긴 상태에서는 서버가 애초에 값을 안 보냅니다.

---

## D. 아직 남은 것

### 배포 전 반드시 확인 (개발자/운영진만 할 수 있음)
- **호스팅된 Supabase 프로젝트 생성** — 아직 없음. 로컬(`supabase start`)로만 개발·검증했습니다.
- 호스팅 프로젝트에서 **Auth → Providers → Anonymous 활성화** 필수. 이게 꺼져 있으면 참가자 신원 체계 전체(로그인 없이 `auth.uid()`로 식별)가 작동하지 않습니다. 로컬은 `supabase/config.toml`의 `enable_anonymous_sign_ins = true`로 이미 켜져 있지만 이 파일은 로컬 전용이라 호스팅 프로젝트엔 영향 없습니다.
- Vercel에 `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` 환경변수 추가 (`vercel env ls` 확인 결과 아직 없음). service role 키는 절대 `VITE_` 접두어를 붙이면 안 됩니다.
- 실제 운영자 계정 생성 + `private.operator_roles`에 role 부여

### 기능적으로 아직 안 됨
- **복구 코드로 다른 기기에서 재접속하는 기능** — `recovery_code_hash` 컬럼은 있지만, 그 코드로 세션을 다시 연결해주는 RPC는 아직 없습니다. 지금은 같은 브라우저(로컬스토리지)를 벗어나면 복구가 안 됩니다.
- 미션 체크리스트(치트키 안쪽 1·2·3 체크박스)는 여전히 로컬 상태일 뿐 서버에 기록되지 않습니다 — 다만 이건 의도된 것입니다. 실제 미션 인증은 참가자가 인스타그램 DM으로 보내고 운영진이 직접 확인하는 방식이라, 앱 안의 체크는 개인용 체크리스트 이상의 의미가 없습니다.
- 운영 대기열은 지금 "팔로우 확인"만 다룹니다. 코드 복구·신고·재배정은 스키마 자체가 없어서 대기열에 안 넣었습니다 — 필요하면 별도로 설계해야 합니다.

### 2026-09-04 추가로 연결 완료 (관리자 패널 나머지 3개)
- **`OverviewPanel`** — `admin_overview`/`admin_list_cheatkey_queue` RPC로 실제 참가자 수·대기·매칭완료·확인대기 현황 표시. 20초 간격 자동 새로고침.
- **`QueuePanel`** — 실제 팔로우 확인 대기열 표시 + "승인" 버튼으로 `admin_unlock_cheatkey` 즉시 호출.
- **`EventControlPanel`** — 5개 스위치(`registration_open`/`matching_enabled`/`result_reveal_enabled`/`cheat_unlock_enabled`/`fallback_mode`) 전부 `admin_get_event_features`/`admin_set_event_feature`(신규 RPC, `20260904030000_admin_feature_flags.sql`)로 실제 DB에 반영. 랜딩 페이지도 `registration_open`을 실제로 읽어서 접수 마감 화면을 보여주도록 연결 — "지금 접수 잠그기"를 누르면 참가자 화면이 실시간으로 바뀌는 것까지 브라우저에서 확인함.

이제 관리자 패널 5개(개요/접수퍼널 제외/매칭실행/운영대기열/행사제어) 중 **접수 퍼널만 mock으로 남아있습니다.** (참가자 유입 단계별 이탈률 같은 분석용 패널이라 우선순위가 낮다고 판단해 이번엔 손대지 않았습니다.)

---

## E. 참고 — 로컬 개발 환경

- `supabase start` (Docker/colima 필요) → `supabase db reset`으로 마이그레이션 9개 + `seed.sql` 적용
- `.env`에 로컬 Supabase URL/anon key 이미 설정돼 있음 (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`)
- 로컬 관리자 테스트 계정: `operator-test@example.com` — 다른 사람이 이어받을 경우 재생성 필요 (로컬 DB 리셋 시 사라짐)
