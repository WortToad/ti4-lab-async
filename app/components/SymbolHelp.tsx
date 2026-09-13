import { Popover, Text } from "@mantine/core";
import { useEffect, useState, type ReactNode } from "react";
import classes from "./SymbolHelp.module.css";

export function SymbolHelp({
  label,
  description = label,
  children,
  disabled = false,
}: {
  label: string;
  description?: string;
  children: ReactNode;
  disabled?: boolean;
}) {
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [pinned, setPinned] = useState(false);
  const opened = hovered || focused || pinned;
  const close = () => {
    setHovered(false);
    setFocused(false);
    setPinned(false);
  };

  useEffect(() => {
    if (!opened || disabled) return;
    const dismiss = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.stopPropagation();
      setHovered(false);
      setFocused(false);
      setPinned(false);
    };
    document.addEventListener("keydown", dismiss, true);
    return () => document.removeEventListener("keydown", dismiss, true);
  }, [opened, disabled]);

  if (disabled) return <>{children}</>;

  return (
    <Popover
      opened={opened}
      onDismiss={close}
      position="top"
      width="max-content"
      withArrow
      withinPortal
      zIndex={400}
    >
      <Popover.Target>
        <span
          role="button"
          tabIndex={0}
          aria-label={label}
          data-mantine-stop-propagation={opened || undefined}
          className={classes.target}
          onPointerEnter={(event) => {
            if (event.pointerType === "mouse") setHovered(true);
          }}
          onPointerLeave={() => setHovered(false)}
          onPointerDown={(event) => event.stopPropagation()}
          onFocus={(event) =>
            setFocused(event.currentTarget.matches(":focus-visible"))
          }
          onBlur={close}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            event.currentTarget.focus({ preventScroll: true });
            if (pinned) close();
            else setPinned(true);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              event.stopPropagation();
              if (pinned) close();
              else setPinned(true);
            }
          }}
        >
          {children}
        </span>
      </Popover.Target>
      <Popover.Dropdown className={classes.description}>
        <Text size="sm">{description}</Text>
      </Popover.Dropdown>
    </Popover>
  );
}
