import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import { BottomSheet } from "../components/BottomSheet";
import { Button } from "../components/Button";
import { DURATION, EASE_OUT } from "../motion";
import "./CheatkeySheet.css";

type Status = "locked" | "waiting_for_operator" | "unlocked";

interface Props {
  open: boolean;
  onClose: () => void;
  officialInstagramUrl: string;
  unlockedHandle: string;
  unlockedPhone: string;
  contactPreference: string;
  /** 실제 앱에서는 get_my_result().cheatkey.status를 그대로 넘긴다. 생략하면(GuidePage 데모용) 내부 데모 타이머로 대체한다. */
  status?: Status;
  /** 실제 앱: 팔로우 버튼 클릭 시 request_my_cheatkey_unlock RPC를 호출한다. 생략하면 데모 타이머로 대체한다. */
  onRequestFollow?: () => void;
  /** status가 'unlocked'일 때 실제 값. 제공되면 unlockedHandle/unlockedPhone/contactPreference 대신 이 값을 보여준다. */
  contact?: { handle: string; phone: string; preference: string } | null;
}

const STEPS = [
  { key: "follow", label: "공식 계정 팔로우" },
  { key: "operator", label: "운영진 확인" },
  { key: "reveal", label: "연락 정보 공개" },
] as const;

const MISSIONS = [
  { key: "intro", label: "서로의 첫인상을 말해주세요" },
  { key: "common_ground", label: "상대방과의 공통점 3가지를 찾아주세요" },
  { key: "photo", label: "학과교류주점에 방문해 함께 사진을 찍고, 상품을 받으세요!" },
] as const;

/** 문서01 §5, 문서02 §4.7: 운영자 확인 전에는 상대 Instagram·전화번호를 응답에 포함하지 않는다는 원칙을 status로 표현. */
export function CheatkeySheet({
  open,
  onClose,
  officialInstagramUrl,
  unlockedHandle,
  unlockedPhone,
  contactPreference,
  status: statusProp,
  onRequestFollow,
  contact,
}: Props) {
  const [demoStatus, setDemoStatus] = useState<Status>("locked");
  const status = statusProp ?? demoStatus;
  const [copiedField, setCopiedField] = useState<"handle" | "phone" | null>(null);
  const [completedMissions, setCompletedMissions] = useState<string[]>([]);

  const activeIndex = status === "locked" ? 0 : status === "waiting_for_operator" ? 1 : 2;

  const toggleMission = (key: string) => {
    setCompletedMissions((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  };

  useEffect(() => {
    if (statusProp !== undefined) return; // 실사용: 서버 폴링 결과를 그대로 쓰므로 데모 타이머 불필요
    if (!open) {
      setDemoStatus("locked");
      return;
    }
    if (demoStatus !== "waiting_for_operator") return;
    const timer = window.setTimeout(() => setDemoStatus("unlocked"), 1800);
    return () => window.clearTimeout(timer);
  }, [open, demoStatus, statusProp]);

  const handleRequestFollow = () => {
    window.open(officialInstagramUrl, "_blank", "noopener,noreferrer");
    if (onRequestFollow) {
      onRequestFollow();
    } else {
      setDemoStatus("waiting_for_operator");
    }
  };

  const handle = contact?.handle ?? unlockedHandle;
  const phone = contact?.phone ?? unlockedPhone;
  const preference = contact?.preference ?? contactPreference;

  const handleCopy = async (field: "handle" | "phone", value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedField(field);
      window.setTimeout(() => setCopiedField(null), 1500);
    } catch {
      setCopiedField(null);
    }
  };

  return (
    <BottomSheet open={open} title="치트키" onClose={onClose}>
      <ol className="cheatkey__steps">
        {STEPS.map((step, i) => (
          <li key={step.key} className={i <= activeIndex ? "is-done" : ""}>
            <span className="cheatkey__step-index">{i + 1}</span>
            {step.label}
          </li>
        ))}
      </ol>

      <AnimatePresence mode="wait">
        {status === "locked" ? (
          <motion.div
            key="locked"
            className="cheatkey__body"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: DURATION.fast, ease: EASE_OUT }}
          >
            <p className="cheatkey__hint">팔로우를 확인하면, 상대가 공개에 동의한 정보를 볼 수 있어요</p>
            <Button variant="primary" onClick={handleRequestFollow}>
              공식 계정 팔로우하러 가기
            </Button>
          </motion.div>
        ) : null}

        {status === "waiting_for_operator" ? (
          <motion.div
            key="waiting"
            className="cheatkey__body"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: DURATION.fast, ease: EASE_OUT }}
          >
            <p className="cheatkey__hint">현장 운영진이 화면을 확인하고 있어요. 대기열에 등록됐어요.</p>
          </motion.div>
        ) : null}

        {status === "unlocked" ? (
          <motion.div
            key="unlocked"
            className="cheatkey__body"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: DURATION.fast, ease: EASE_OUT }}
          >
            <div className="cheatkey__handle-row">
              <span className="cheatkey__handle">{handle}</span>
              <button type="button" className="cheatkey__copy" onClick={() => handleCopy("handle", handle)}>
                {copiedField === "handle" ? "복사됨" : "ID 복사"}
              </button>
            </div>
            <div className="cheatkey__handle-row">
              <span className="cheatkey__handle">{phone}</span>
              <button type="button" className="cheatkey__copy" onClick={() => handleCopy("phone", phone)}>
                {copiedField === "phone" ? "복사됨" : "번호 복사"}
              </button>
            </div>
            {preference ? <p className="cheatkey__preference">상대는 “{preference}”를 선호해요</p> : null}

            <div className="cheatkey__missions">
              <div className="cheatkey__missions-head">
                <h3>마지막 미션</h3>
                <span className="cheatkey__missions-count">
                  {completedMissions.length}/{MISSIONS.length}
                </span>
              </div>
              <p className="cheatkey__hint">직접 만나서 아래 미션을 함께 완료해 보세요</p>
              <ul className="cheatkey__mission-list">
                {MISSIONS.map((mission, i) => {
                  const done = completedMissions.includes(mission.key);
                  return (
                    <li key={mission.key}>
                      <label className={`cheatkey__mission-row${done ? " is-done" : ""}`}>
                        <input type="checkbox" checked={done} onChange={() => toggleMission(mission.key)} />
                        <span className="cheatkey__mission-index">{i + 1}</span>
                        <span className="cheatkey__mission-label">{mission.label}</span>
                      </label>
                    </li>
                  );
                })}
              </ul>
              {completedMissions.length === MISSIONS.length ? (
                <p className="cheatkey__missions-done">미션 완료! 즐거운 시간 보내세요</p>
              ) : null}
              <p className="cheatkey__mission-verify">
                완료한 미션은 가천대 메디컬캠퍼스 인스타그램으로 DM을 보내 인증해주세요! ♥
              </p>
              <Button variant="ghost" onClick={() => window.open(officialInstagramUrl, "_blank", "noopener,noreferrer")}>
                인스타그램 DM으로 인증하기
              </Button>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </BottomSheet>
  );
}
