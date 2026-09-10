import { appPath } from "~/utils/appUrl";
type Props = {
  size?: number;
};

export function LegendaryIcon({ size = 20 }: Props) {
  return <img src={appPath("/legendary.webp")} style={{ width: size }} alt="Legendary" />;
}
