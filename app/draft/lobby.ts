export type LobbyView = {
  started: boolean;
  paused: boolean;
  slots: { id: number; name: string; claimed: boolean; uuid?: string }[];
  ownUuid?: string;
  adminUuid?: string;
  discordPlayers?: { id: number; name: string }[];
  checkpoints?: { id: string; label: string; createdAt: string }[];
};
