import { appPath } from "~/utils/appUrl";
import { SymbolHelp } from "~/components/SymbolHelp";
import { spaceStationDescription } from "~/data/spaceStations";
type Props = {
  size?: number;
  showHelp?: boolean;
};

export function SpaceStationIcon({ size = 20, showHelp = true }: Props) {
  return (
    <SymbolHelp
      label="Space station"
      description={spaceStationDescription}
      disabled={!showHelp}
    >
      <img
        src={appPath("/symbols/space-station.png")}
        width={size}
        height={size}
        style={{ objectFit: "contain" }}
        alt="Space station"
      />
    </SymbolHelp>
  );
}
