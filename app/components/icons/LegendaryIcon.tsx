import { appPath } from "~/utils/appUrl";
import { SymbolHelp } from "~/components/SymbolHelp";
type Props = {
  size?: number;
  showHelp?: boolean;
};

export function LegendaryIcon({ size = 20, showHelp = true }: Props) {
  return (
    <SymbolHelp
      label="Legendary planet"
      description="Legendary planet: has a legendary planet ability."
      disabled={!showHelp}
    >
      <img
        src={appPath("/legendary.webp")}
        style={{ width: size }}
        alt="Legendary"
      />
    </SymbolHelp>
  );
}
