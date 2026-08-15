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

/** 문서01 §5, 문서02 §4.7: 운영자 확인 전에는 상대 Instagram·전화번호를 응답에 포함하지 않는다는 원칙을 status로 표현. */
export function CheatkeySheet({ open, onClose, officialInstagramUrl, unlockedHandle, unlockedPhone, contactPreference }: Props) {
  const [status, setStatus] = useState<Status>("locked");
  const [copiedField, setCopiedField] = useState<"handle" | "phone" | null>(null);

  const activeIndex = status === "locked" ? 0 : status === "waiting_for_operator" ? 1 : 2;

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
          </motion.div>
        ) : null}
      </AnimatePresence>
    </BottomSheet>
  );
}
