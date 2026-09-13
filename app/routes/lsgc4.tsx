import { MetaFunction, Outlet } from "react-router";
import { useState } from "react";
import { MainAppShell } from "~/components/MainAppShell";

export type DraftOrderContext = {
  adminMode: boolean;
  pickForAnyone: boolean;
  originalArt: boolean;
  setAdminMode: (value: boolean) => void;
  setPickForAnyone: (value: boolean) => void;
  setOriginalArt: (value: boolean) => void;
};

export default function LSGC4Index() {
  const [originalArt, setOriginalArt] = useState(true);
  const [adminMode, setAdminMode] = useState(false);
  const [pickForAnyone, setPickForAnyone] = useState(false);

  return (
    <MainAppShell>
      <Outlet
        context={{
          adminMode,
          pickForAnyone,
          originalArt,
          setAdminMode,
          setPickForAnyone,
          setOriginalArt,
        }}
      />
    </MainAppShell>
  );
}

export const meta: MetaFunction = () => {
  return [
    { title: "Lone Star Galactic Council Tournament" },
    {
      name: "description",
      content:
        "Draft tool for Lone Star Galactic Council Tournament. Create and manage tournament drafts and maps.",
    },
  ];
};
