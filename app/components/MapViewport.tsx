import { ActionIcon, Box, Button, Text } from "@mantine/core";
import { IconMinus, IconPlus } from "@tabler/icons-react";
import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { useDimensions } from "~/hooks/useDimensions";
import { useWindowDimensions } from "~/hooks/useWindowDimensions";
import classes from "./MapViewport.module.css";

export function MapViewport({ children }: { children: ReactNode }) {
  const { ref, width } = useDimensions<HTMLDivElement>();
  const viewport = useRef<HTMLDivElement>(null);
  const previousZoom = useRef(1);
  const [zoom, setZoom] = useState(1);
  const { height: windowHeight } = useWindowDimensions();
  const height = Math.min(width * (800 / 740), windowHeight * 0.75, 950);

  useLayoutEffect(() => {
    const element = viewport.current;
    if (!element) return;
    const ratio = zoom / previousZoom.current;
    // Keep the same part of the galaxy centered when changing magnification.
    element.scrollLeft =
      zoom === 1
        ? 0
        : (element.scrollLeft + element.clientWidth / 2) * ratio -
          element.clientWidth / 2;
    element.scrollTop =
      zoom === 1
        ? 0
        : (element.scrollTop + element.clientHeight / 2) * ratio -
          element.clientHeight / 2;
    previousZoom.current = zoom;
  }, [zoom]);

  return (
    <div ref={ref}>
      <div className={classes.controls}>
        <Text size="sm" c="dimmed">
          {zoom === 1
            ? "Select a space to edit. Zoom in for details."
            : "Scroll to explore. Select a space to edit."}
        </Text>
        <div
          className={classes.zoomControls}
          role="group"
          aria-label="Map zoom"
        >
          <ActionIcon
            variant="default"
            aria-label="Zoom out on map"
            disabled={zoom <= 1}
            onClick={() => setZoom((value) => Math.max(1, value - 0.5))}
          >
            <IconMinus size={20} aria-hidden="true" />
          </ActionIcon>
          <Button variant="default" onClick={() => setZoom(1)}>
            Fit map
          </Button>
          <ActionIcon
            variant="default"
            aria-label="Zoom in on map"
            disabled={zoom >= 3}
            onClick={() => setZoom((value) => Math.min(3, value + 0.5))}
          >
            <IconPlus size={20} aria-hidden="true" />
          </ActionIcon>
        </div>
      </div>
      <Box
        ref={viewport}
        className={classes.viewport}
        role="region"
        aria-label="Galaxy map"
        tabIndex={0}
        style={{ height }}
      >
        <div
          className={classes.canvas}
          style={{ width: width * zoom, height: height * zoom }}
        >
          {children}
        </div>
      </Box>
    </div>
  );
}
