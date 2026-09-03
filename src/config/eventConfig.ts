/**
 * 문서01 §10 "아직 필요한 값" 중 확정된 항목.
 * 실제 구현 시 이 값들은 하드코딩하지 않고 GET /events/{slug}/public-config(문서03 §3)로 서버에서 받아온다.
 * 지금은 프런트 목업 단계라 상수로 고정해 둔다.
 */
export const EVENT_CONFIG = {
  programName: "72시간 메캠팅",
  tagline: "가천대학교 메디컬캠퍼스에서의 72시간, 당신은 72시간 안에 사랑에 빠질 수 있나요?",
  eventPeriod: "2026.09.21(월) - 09.22(화)",
  eventHours: "12:00 ~ 17:00",
  venue: "메디컬캠퍼스 운동장 바람개비 부스",
  matchReleaseTime: "오후 4시",
  officialInstagram: {
    handle: "gachon__medical",
    url: "https://www.instagram.com/gachon__medical/",
  },
  /** 문서01 §10 권장 권한 배정: 공용 계정 대신 각자 계정으로 로그인해 승인·취소 이력을 남긴다. */
  operatorAccountPolicy: "individual" as const,
} as const;
