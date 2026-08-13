/**
 * 문서01 §10 "아직 필요한 값" 중 확정된 항목.
 * 실제 구현 시 이 값들은 하드코딩하지 않고 GET /events/{slug}/public-config(문서03 §3)로 서버에서 받아온다.
 * 지금은 프런트 목업 단계라 상수로 고정해 둔다.
 */
export const EVENT_CONFIG = {
  programName: "72시간 소개팅",
  officialInstagram: {
    handle: "gachon__medical",
    url: "https://www.instagram.com/gachon__medical/",
  },
  /** 문서01 §10 권장 권한 배정: 공용 계정 대신 각자 계정으로 로그인해 승인·취소 이력을 남긴다. */
  operatorAccountPolicy: "individual" as const,
} as const;
