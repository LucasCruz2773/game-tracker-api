-- A review can place a game in the library before the player chooses a
-- progress status.
ALTER TYPE "library_status" ADD VALUE 'UNSET' BEFORE 'BACKLOG';

-- Make reviews created before this migration visible in their authors'
-- libraries as well. A review id is safe to reuse as the id of a different
-- table and keeps this migration independent of database UUID extensions.
INSERT INTO "game_library" (
  "id",
  "user_id",
  "game_id",
  "status",
  "hours_played",
  "started_at",
  "completed_at",
  "created_at",
  "updated_at"
)
SELECT
  r."id",
  r."user_id",
  r."game_id",
  'UNSET'::"library_status",
  0,
  NULL,
  NULL,
  r."created_at",
  r."updated_at"
FROM "reviews" r
WHERE NOT EXISTS (
  SELECT 1
  FROM "game_library" gl
  WHERE gl."user_id" = r."user_id"
    AND gl."game_id" = r."game_id"
);
