import { useNavigate } from "react-router-dom";
import { useDraft } from "../context/DraftContext";
import { useEventSession } from "../hooks/useEventSession";
import { supabase } from "../lib/supabase";
import { normalizePhoneNumber, validateInstagramHandle, validateNickname, validatePhoneNumber } from "../lib/validation";
import { ReviewScreen, type SubmitResult } from "../screens/ReviewScreen";

const GENDER_CODE: Record<string, string> = {
  남성: "male",
  여성: "female",
  "기타·응답하지 않음": "other",
};

const SEEKING_GENDER_CODE: Record<string, string> = {
  남성: "male",
  여성: "female",
  "성별 무관": "any",
};

const CONSENT_POLICY_VERSION = "2026-09-01";

export function ReviewPage() {
  const navigate = useNavigate();
  const { draft } = useDraft();
  const { eventId } = useEventSession();

  const handleSubmit = async (): Promise<SubmitResult> => {
    if (!supabase || !eventId) {
      throw new Error("지금은 서버에 연결할 수 없어요. 잠시 후 다시 시도해주세요.");
    }

    const validationError = validateNickname(draft.nickname) ?? validateInstagramHandle(draft.instagramHandle) ?? validatePhoneNumber(draft.phoneNumber);
    if (validationError) {
      throw new Error(validationError);
    }

    const { data, error } = await supabase.rpc("submit_my_entry", {
      p_event_id: eventId,
      p_age_18_plus: true,
      p_nickname: draft.nickname,
      p_department: draft.department,
      p_grade: draft.grade,
      p_gender_code: GENDER_CODE[draft.gender] ?? "other",
      p_mbti: draft.mbti || null,
      p_one_liner: draft.oneLiner || null,
      p_self_traits: draft.traits,
      p_seeking_gender_codes: draft.seekingGender ? [SEEKING_GENDER_CODE[draft.seekingGender] ?? "any"] : ["any"],
      p_desired_traits: draft.desiredTraits,
      p_interests: draft.interests,
      p_activities: draft.activities,
      p_food_tags: draft.food,
      p_music_tags: draft.music,
      p_conversation_style: draft.contactStyle || null,
      p_instagram_handle: draft.instagramHandle.trim(),
      p_phone_number: normalizePhoneNumber(draft.phoneNumber),
      p_policy_version: CONSENT_POLICY_VERSION,
      p_participation: true,
      p_profile_share: true,
      p_instagram_share_if_matched: true,
      p_analytics: draft.analyticsConsent,
    });

    if (error) {
      throw new Error(mapSubmitError(error.message));
    }

    const result = data as { status: string; matching_number: string; recovery_code?: string };
    return {
      status: result.status === "already_submitted" ? "already_submitted" : "ok",
      matchingNumber: result.matching_number,
      recoveryCode: result.recovery_code,
    };
  };

  return (
    <ReviewScreen
      onSubmit={handleSubmit}
      onSubmitted={(result) => navigate("/waiting", { state: result ? { recoveryCode: result.recoveryCode } : undefined })}
    />
  );
}

function mapSubmitError(message: string): string {
  if (message.includes("REGISTRATION_CLOSED")) return "지금은 접수 기간이 아니에요.";
  if (message.includes("REQUIRED_CONSENT_MISSING")) return "필수 동의 항목을 다시 확인해주세요.";
  if (message.includes("MISSING_REQUIRED_FIELD")) return "닉네임·학과를 다시 확인해주세요.";
  if (message.includes("INVALID_NICKNAME")) return "닉네임을 다시 확인해주세요.";
  if (message.includes("INVALID_INSTAGRAM_HANDLE")) return "Instagram ID 형식을 다시 확인해주세요.";
  if (message.includes("INVALID_PHONE_NUMBER")) return "전화번호 형식을 다시 확인해주세요.";
  return "제출에 실패했어요. 잠시 후 다시 시도해주세요.";
}
