/** 참가자 입력값 검증. 프론트에서 막아도 서버(submit_my_entry RPC)에서 한 번 더 확인한다 — 우회 방지용 이중 검증. */

export function validateNickname(value: string): string | null {
  const v = value.trim();
  if (!v) return "닉네임을 입력해주세요.";
  if (v.length > 20) return "닉네임은 최대 20자까지 입력할 수 있어요.";
  return null;
}

export function validateRealName(value: string): string | null {
  const v = value.trim();
  if (!v) return "실명을 입력해주세요.";
  if (v.length > 20) return "이름은 최대 20자까지 입력할 수 있어요.";
  return null;
}

const INSTAGRAM_HANDLE_REGEX = /^[a-zA-Z0-9._]{1,30}$/;

export function validateInstagramHandle(value: string): string | null {
  const v = value.trim();
  if (!v) return "Instagram ID를 입력해주세요.";
  if (v.startsWith("@")) return "@ 없이 아이디만 입력해주세요.";
  if (!INSTAGRAM_HANDLE_REGEX.test(v)) return "영문, 숫자, 밑줄(_), 마침표(.)만 사용할 수 있어요.";
  if (v.includes("..")) return "마침표(.)를 연속으로 사용할 수 없어요.";
  if (v.startsWith(".") || v.endsWith(".")) return "마침표(.)로 시작하거나 끝날 수 없어요.";
  return null;
}

const PHONE_REGEX = /^01[016789]-?\d{3,4}-?\d{4}$/;

export function validatePhoneNumber(value: string): string | null {
  const v = value.trim();
  if (!v) return "전화번호를 입력해주세요.";
  if (!PHONE_REGEX.test(v)) return "올바른 휴대폰 번호 형식이 아니에요. 예: 010-1234-5678";
  return null;
}

/** 제출 직전 숫자만 남겨 010-1234-5678 형태로 통일한다. */
export function normalizePhoneNumber(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (digits.length === 11) return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
  if (digits.length === 10) return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  return value.trim();
}

export function validateOneLiner(value: string): string | null {
  if (value.length > 40) return "한마디는 최대 40자까지 입력할 수 있어요.";
  return null;
}
