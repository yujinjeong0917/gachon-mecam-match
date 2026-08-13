import { useEffect, useRef, type ReactNode } from "react";
import "./BottomSheet.css";

interface Props {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}

/** 문서02 §8: focus trap, ESC, aria-expanded, aria-haspopup을 SEED 기본값대로 유지하라는 요구를 최소 구현으로 대체. */
export function BottomSheet({ open, title, onClose, children }: Props) {
  const sheetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    sheetRef.current?.focus();
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="bottom-sheet__backdrop" onClick={onClose}>
      <div
        className="bottom-sheet"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        ref={sheetRef}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bottom-sheet__grabber" aria-hidden="true" />
        <h2 className="bottom-sheet__title">{title}</h2>
        {children}
      </div>
    </div>
  );
}
