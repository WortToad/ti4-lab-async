import { useContext, useState } from "react";
import { LobbyIdentityContext } from "~/draft/LobbyIdentity";
import { notifications } from "@mantine/notifications";
import { useDraft } from "~/draftStore";
import { useSafeOutletContext } from "~/useSafeOutletContext";

export function useAdminControls() {
  const lobbyIdentity = useContext(LobbyIdentityContext);
  const adminPassword = useDraft((state) => state.draft.settings.adminPassword);
  const { adminMode, setAdminMode, pickForAnyone, setPickForAnyone } =
    useSafeOutletContext();
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);

  const hasAdminPassword = adminPassword !== undefined;
  const showPickForAnyoneControl =
    !lobbyIdentity?.managed && (!hasAdminPassword || adminMode);
  const showUndoLastSelection =
    !lobbyIdentity?.managed && (!hasAdminPassword || adminMode);

  const handleAdminPasswordSubmit = (password: string) => {
    if (password === adminPassword) {
      setAdminMode(true);
    } else {
      notifications.show({
        title: "Incorrect password",
        message: "Please try again",
        color: "red",
      });
    }
    setPasswordModalOpen(false);
  };

  const handleAdminToggle = () => {
    if (lobbyIdentity?.managed) return;
    if (adminMode) {
      setAdminMode(false);
      return;
    }
    if (hasAdminPassword) {
      setPasswordModalOpen(true);
    } else {
      setAdminMode(true);
    }
  };

  return {
    adminMode,
    pickForAnyone,
    setPickForAnyone,
    showPickForAnyoneControl,
    showUndoLastSelection,
    passwordModalOpen,
    setPasswordModalOpen,
    handleAdminPasswordSubmit,
    handleAdminToggle,
  };
}
