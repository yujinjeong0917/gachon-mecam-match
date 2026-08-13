import type { ButtonHTMLAttributes } from "react";
import "./Button.css";

type Variant = "primary" | "ghost" | "danger-ghost";

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  loading?: boolean;
}

/** 문서02 §2.3: 상호작용·상태는 SEED가 소유. 여기서는 SEED ActionButton을 붙이기 전까지 쓸 임시 컴포넌트. */
export function Button({ variant = "primary", loading = false, disabled, children, ...rest }: Props) {
  return (
    <button
      className={`app-button app-button--${variant}${loading ? " is-loading" : ""}`}
      disabled={disabled || loading}
      aria-busy={loading}
      {...rest}
    >
      {loading ? <span className="app-button__spinner" aria-hidden="true" /> : null}
      <span>{children}</span>
    </button>
  );
}
