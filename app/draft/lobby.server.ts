import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

export function validRecoveryToken(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^(?:[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}|[a-f0-9]{64})$/i.test(
      value,
    )
  );
}

export function playerName(value: unknown): string {
  if (typeof value !== "string" || !value.trim() || value.trim().length > 60)
    throw new Error("Enter a name between 1 and 60 characters.");
  return value.trim();
}

export const newBackupSecret = () => randomBytes(32).toString("hex");
type BackupMode = "bag" | "mantis" | "raw" | "base";

// The key stays in the database, never in a host credential or downloaded file.
// A host can restore a save without learning anyone's unrevealed cards.
export function sealBackup(
  mode: BackupMode,
  roomId: string,
  secret: string,
  state: unknown,
): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", Buffer.from(secret, "hex"), iv);
  cipher.setAAD(Buffer.from(`ti4-lobby:1:${mode}:${roomId}`));
  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(state), "utf8"),
    cipher.final(),
  ]);
  return JSON.stringify({
    format: "ti4-lobby-save",
    version: 1,
    mode,
    roomId,
    iv: iv.toString("base64"),
    tag: cipher.getAuthTag().toString("base64"),
    data: encrypted.toString("base64"),
  });
}

export function openBackup<T>(
  mode: BackupMode,
  roomId: string,
  secret: string,
  serialized: string,
): T {
  if (typeof serialized !== "string" || serialized.length > 8 * 1024 * 1024)
    throw new Error("Choose a TI4 Lab save file smaller than 8 MB.");
  try {
    const saved = JSON.parse(serialized);
    if (
      saved.format !== "ti4-lobby-save" ||
      saved.version !== 1 ||
      saved.mode !== mode ||
      saved.roomId !== roomId
    )
      throw new Error("Wrong room");
    const iv = Buffer.from(saved.iv, "base64");
    const tag = Buffer.from(saved.tag, "base64");
    if (iv.length !== 12 || tag.length !== 16) throw new Error("Invalid save");
    const decipher = createDecipheriv(
      "aes-256-gcm",
      Buffer.from(secret, "hex"),
      iv,
    );
    decipher.setAAD(Buffer.from(`ti4-lobby:1:${mode}:${roomId}`));
    decipher.setAuthTag(tag);
    return JSON.parse(
      Buffer.concat([
        decipher.update(Buffer.from(saved.data, "base64")),
        decipher.final(),
      ]).toString("utf8"),
    ) as T;
  } catch {
    throw new Error(
      "This save is damaged or belongs to another lobby. Import an unedited save exported from this lobby.",
    );
  }
}
