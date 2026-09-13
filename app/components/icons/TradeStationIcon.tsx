import { appPath } from "~/utils/appUrl";
import { SymbolHelp } from "~/components/SymbolHelp";
type Props = {
  size?: number;
  showHelp?: boolean;
};

export function TradeStationIcon({ size = 20, showHelp = true }: Props) {
  return (
    <SymbolHelp label="Trade station" disabled={!showHelp}>
      <img
        src={appPath("/trade_station.webp")}
        style={{ width: size }}
        alt="Trade Station"
      />
    </SymbolHelp>
  );
}
