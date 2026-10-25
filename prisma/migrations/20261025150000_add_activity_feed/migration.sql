-- CreateEnum
CREATE TYPE "activity_type" AS ENUM ('LIBRARY_ADDED', 'GAME_COMPLETED', 'REVIEWED');

-- CreateTable
CREATE TABLE "activities" (
    "id" UUID NOT NULL,
    "actor_id" UUID NOT NULL,
    "game_id" UUID NOT NULL,
    "type" "activity_type" NOT NULL,
    "rating" SMALLINT,
    "review_body" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activities_pkey" PRIMARY KEY ("id")
);

-- Backfill the latest meaningful activity for existing library entries.
INSERT INTO "activities" ("id", "actor_id", "game_id", "type", "created_at")
SELECT gen_random_uuid(), "user_id", "game_id",
       CASE WHEN "status" = 'COMPLETED' THEN 'GAME_COMPLETED'::"activity_type"
            ELSE 'LIBRARY_ADDED'::"activity_type" END,
       "created_at"
FROM "game_library";

-- Backfill the latest rating/review for existing users.
INSERT INTO "activities" ("id", "actor_id", "game_id", "type", "rating", "review_body", "created_at")
SELECT gen_random_uuid(), "user_id", "game_id", 'REVIEWED'::"activity_type", "rating", "body", "updated_at"
FROM "reviews";

-- CreateIndex
CREATE INDEX "activities_actor_id_created_at_idx" ON "activities"("actor_id", "created_at");
CREATE INDEX "activities_created_at_idx" ON "activities"("created_at");

-- AddForeignKey
ALTER TABLE "activities" ADD CONSTRAINT "activities_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "activities" ADD CONSTRAINT "activities_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "games"("id") ON DELETE CASCADE ON UPDATE CASCADE;
