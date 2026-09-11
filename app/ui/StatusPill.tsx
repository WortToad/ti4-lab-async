import type { ReactNode } from "react";
import classes from "./StatusPill.module.css";

/** Non-interactive state information, visually distinct from action buttons. */
export function StatusPill({
  children,
  tone = "neutral",
  icon,
  prominent = false,
}: {
  children: ReactNode;
  tone?: "neutral" | "info" | "success" | "warning";
  icon?: ReactNode;
  prominent?: boolean;
}) {
  return (
    <span
      className={classes.pill}
      data-tone={tone}
      data-prominent={prominent || undefined}
    >
      <span className={icon ? classes.icon : classes.dot} aria-hidden="true">
        {icon}
      </span>
      <span>{children}</span>
    </span>
  );
}
