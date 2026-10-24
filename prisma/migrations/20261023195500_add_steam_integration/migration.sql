-- CreateTable
CREATE TABLE "steam_accounts" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "steam_id" TEXT NOT NULL,
    "persona_name" TEXT NOT NULL,
    "avatar_url" TEXT,
    "last_synced_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "steam_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "steam_games" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "steam_app_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "playtime_minutes" INTEGER NOT NULL DEFAULT 0,
    "game_id" UUID,
    "imported_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "steam_games_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "steam_accounts_user_id_key" ON "steam_accounts"("user_id");
CREATE UNIQUE INDEX "steam_accounts_steam_id_key" ON "steam_accounts"("steam_id");
CREATE INDEX "steam_games_game_id_idx" ON "steam_games"("game_id");
CREATE UNIQUE INDEX "steam_games_user_id_steam_app_id_key" ON "steam_games"("user_id", "steam_app_id");

-- AddForeignKey
ALTER TABLE "steam_accounts" ADD CONSTRAINT "steam_accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "steam_games" ADD CONSTRAINT "steam_games_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "steam_games" ADD CONSTRAINT "steam_games_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "games"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddCheckConstraint
ALTER TABLE "steam_games" ADD CONSTRAINT "steam_games_playtime_minutes_check" CHECK ("playtime_minutes" >= 0);
