import { motion, type HTMLMotionProps } from "framer-motion";
import type { ReactNode } from "react";
import { DURATION, EASE_OUT } from "../motion";
import "./Button.css";

type Variant = "primary" | "ghost" | "danger-ghost";

interface Props extends Omit<HTMLMotionProps<"button">, "children"> {
  variant?: Variant;
  loading?: boolean;
  children?: ReactNode;
}

/** 문서02 §2.3: 상호작용·상태는 SEED가 소유. 여기서는 SEED ActionButton을 붙이기 전까지 쓸 임시 컴포넌트. */
export function Button({ variant = "primary", loading = false, disabled, children, ...rest }: Props) {
  return (
    <motion.button
      className={`app-button app-button--${variant}${loading ? " is-loading" : ""}`}
      disabled={disabled || loading}
      aria-busy={loading}
      whileTap={disabled || loading ? undefined : { scale: 0.96 }}
      whileHover={disabled || loading ? undefined : { y: -1 }}
      transition={{ duration: DURATION.fast, ease: EASE_OUT }}
      {...rest}
    >
      {loading ? <span className="app-button__spinner" aria-hidden="true" /> : null}
      <span>{children}</span>
    </motion.button>
  );
}
