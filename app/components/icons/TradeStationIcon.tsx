import { appPath } from "~/utils/appUrl";
type Props = {
  size?: number;
};

export function TradeStationIcon({ size = 20 }: Props) {
  return <img src={appPath("/trade_station.webp")} style={{ width: size }} alt="Trade Station" />;
}
