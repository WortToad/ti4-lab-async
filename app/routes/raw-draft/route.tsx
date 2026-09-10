import { redirect } from "react-router";

// The former local-only setup now uses the same persistent lobby as every mode.
export const loader = () => redirect("/draft/raw/new");
export default function LegacyRawDraft() {
  return null;
}
