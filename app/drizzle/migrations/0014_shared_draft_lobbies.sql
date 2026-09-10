CREATE TABLE `baseDraftLobbies` (
  `id` text PRIMARY KEY NOT NULL REFERENCES `drafts`(`id`) ON DELETE CASCADE,
  `data` text NOT NULL,
  `revision` integer DEFAULT 0 NOT NULL
);
