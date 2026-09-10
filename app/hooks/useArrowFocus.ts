import { useEffect, useRef } from "react";

export function useArrowFocus<T>(
  data: T[],
  onSelectItem: (idx: number) => void,
  enabled = true,
) {
  const itemRefs = useRef<HTMLElement[]>([]);

  useEffect(() => {
    if (!enabled) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      // Only handle keys from the search field or its current results. A
      // mounted, closed picker must never capture keys elsewhere in the app.
      const selectedIdx = itemRefs.current
        .slice(0, data.length + 1)
        .findIndex((element) => element === event.target);
      if (
        selectedIdx < 0 ||
        event.isComposing ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey
      )
        return;
      if (event.key === "ArrowUp" || event.key === "ArrowDown") {
        event.preventDefault();
        const next = Math.max(
          0,
          Math.min(
            data.length,
            selectedIdx + (event.key === "ArrowDown" ? 1 : -1),
          ),
        );
        itemRefs.current[next]?.focus();
      } else if (
        event.key === "Enter" &&
        selectedIdx === 0 &&
        data.length > 0
      ) {
        event.preventDefault();
        onSelectItem(1);
      }
      // Result buttons use their native Enter/Space activation.
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [data.length, enabled, onSelectItem]);

  const resetFocus = () => {
    if (itemRefs.current[0]) itemRefs.current[0].focus();
  };

  return {
    itemRefs,
    resetFocus,
  };
}
