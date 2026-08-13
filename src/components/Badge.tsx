import type { ReactNode } from "react";
import "./Badge.css";

interface Props {
  tone?: "neutral" | "brass" | "warning";
  children: ReactNode;
}

export function Badge({ tone = "neutral", children }: Props) {
  return <span className={`app-badge app-badge--${tone}`}>{children}</span>;
}
