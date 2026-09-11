import { ReactNode } from "react";
import { ConfigSection } from "./ConfigSection";

type Props = { title: string; icon: ReactNode; children: ReactNode };
export function SettingsSection(props: Props) {
  return <ConfigSection {...props} />;
}
