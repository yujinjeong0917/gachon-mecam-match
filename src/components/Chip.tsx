import { motion } from "framer-motion";
import { DURATION, EASE_OUT } from "../motion";
import "./Chip.css";

interface Props {
  label: string;
  selected: boolean;
  onToggle: () => void;
  disabled?: boolean;
}

/** 문서02 §3: Chip Toggle. 선택 상태는 그라데이션 tint + 체크 아이콘, 색을 지워도 구분되게 border도 함께 바뀐다. */
export function Chip({ label, selected, onToggle, disabled = false }: Props) {
  return (
    <motion.button
      type="button"
      role="checkbox"
      aria-checked={selected}
      className={`app-chip${selected ? " is-selected" : ""}`}
      onClick={onToggle}
      disabled={disabled}
      whileTap={disabled ? undefined : { scale: 0.9 }}
      transition={{ duration: DURATION.fast, ease: EASE_OUT }}
    >
      {selected ? (
        <motion.svg
          width="14"
          height="14"
          viewBox="0 0 14 14"
          aria-hidden="true"
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 500, damping: 15 }}
        >
          <path d="M2.5 7.2 5.6 10.3 11.5 3.8" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </motion.svg>
      ) : null}
      {label}
    </motion.button>
  );
}
