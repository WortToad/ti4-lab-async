import { AnomalyImage } from "~/components/features/AnomalyImage";
import { GravityRift } from "~/components/features/GravityRift";
import { SymbolHelp } from "~/components/SymbolHelp";
import { anomalyDetails } from "~/data/anomalies";
import type { Anomaly } from "~/types";

export function AnomalyIcon({
  anomaly,
  size = 32,
  showHelp = true,
}: {
  anomaly: Anomaly;
  size?: number;
  showHelp?: boolean;
}) {
  const { label, description } = anomalyDetails[anomaly];
  return (
    <SymbolHelp
      label={label}
      description={`${label}: ${description}`}
      disabled={!showHelp}
    >
      <span
        role="img"
        aria-label={label}
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: size,
          height: size,
          flexShrink: 0,
        }}
      >
        {anomaly === "GRAVITY_RIFT" ? (
          <GravityRift size={size * 0.65} />
        ) : (
          <svg
            width={size}
            height={size}
            viewBox="-20 -20 40 40"
            aria-hidden="true"
          >
            <AnomalyImage anomaly={anomaly} radius={20} />
          </svg>
        )}
      </span>
    </SymbolHelp>
  );
}
