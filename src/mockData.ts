/** 백엔드 연동 전까지 쓰는 목업 데이터. 문서03 §4 응답 예시 값을 그대로 사용. */
export const MOCK_DRAFT = {
  nickname: "가을밤",
  department: "간호학과",
  grade: 2,
  traits: ["차분함", "다정함"],
  interests: ["카페", "여행", "공연"],
  instagramHandle: "example_id",
};

export const MOCK_WAITING = {
  matchingNumber: "M-027",
  recoveryCode: "482731",
  nextMatchingAt: "10:00",
};

export const MOCK_PARTNER = {
  nickname: "달빛",
  department: "물리치료학과",
  grade: 3,
  matchScore: 91,
  sharedInterests: ["카페", "여행", "음악"],
  activity: "같이 사진 찍으러 가기",
  oneLiner: "같이 맛있는 거 먹으러 가고 싶어요!",
};
