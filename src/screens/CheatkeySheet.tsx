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
}

const STEPS = [
  { key: "follow", label: "공식 계정 팔로우" },
  { key: "operator", label: "운영진 확인" },
  { key: "reveal", label: "연락 정보 공개" },
] as const;

const MISSIONS = [
  { key: "intro", label: "서로의 첫인상을 말해주세요" },
  { key: "common_ground", label: "상대방과 공통점 3가지를 찾아주세요" },
  { key: "photo", label: "축제에서 함께 사진을 찍어주세요" },
] as const;

/** 문서01 §5, 문서02 §4.7: 운영자 확인 전에는 상대 Instagram·전화번호를 응답에 포함하지 않는다는 원칙을 status로 표현. */
export function CheatkeySheet({ open, onClose, officialInstagramUrl, unlockedHandle, unlockedPhone, contactPreference }: Props) {
  const [status, setStatus] = useState<Status>("locked");
  const [copiedField, setCopiedField] = useState<"handle" | "phone" | null>(null);
  const [completedMissions, setCompletedMissions] = useState<string[]>([]);

  const activeIndex = status === "locked" ? 0 : status === "waiting_for_operator" ? 1 : 2;

  // 실제로는 완료 시점마다 public.mark_my_match_mission() RPC로 기록한다.
  const toggleMission = (key: string) => {
    setCompletedMissions((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  };

  useEffect(() => {
    if (!open) {
      setStatus("locked");
      return;
    }
    if (status !== "waiting_for_operator") return;
    // 실제로는 GET /me/cheatkey 폴링으로 운영자의 POST /admin/cheat-unlocks 확정을 기다린다(문서03 §4·§5).
    const timer = window.setTimeout(() => setStatus("unlocked"), 1800);
    return () => window.clearTimeout(timer);
  }, [open, status]);

  const handleRequestFollow = () => {
    window.open(officialInstagramUrl, "_blank", "noopener,noreferrer");
    setStatus("waiting_for_operator");
  };

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
              <span className="cheatkey__handle">{unlockedHandle}</span>
              <button type="button" className="cheatkey__copy" onClick={() => handleCopy("handle", unlockedHandle)}>
                {copiedField === "handle" ? "복사됨" : "ID 복사"}
              </button>
            </div>
            <div className="cheatkey__handle-row">
              <span className="cheatkey__handle">{unlockedPhone}</span>
              <button type="button" className="cheatkey__copy" onClick={() => handleCopy("phone", unlockedPhone)}>
                {copiedField === "phone" ? "복사됨" : "번호 복사"}
              </button>
            </div>
            <p className="cheatkey__preference">상대는 “{contactPreference}”를 선호해요</p>

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
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </BottomSheet>
  );
}
