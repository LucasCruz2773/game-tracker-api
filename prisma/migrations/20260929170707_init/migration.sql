-- CreateEnum
CREATE TYPE "library_status" AS ENUM ('BACKLOG', 'PLAYING', 'COMPLETED', 'DROPPED');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "games" (
    "id" UUID NOT NULL,
    "rawg_id" INTEGER NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "cover_url" TEXT,
    "release_date" DATE,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "games_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "genres" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,

    CONSTRAINT "genres_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platforms" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,

    CONSTRAINT "platforms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "game_library" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "game_id" UUID NOT NULL,
    "status" "library_status" NOT NULL DEFAULT 'BACKLOG',
    "hours_played" INTEGER NOT NULL DEFAULT 0,
    "started_at" DATE,
    "completed_at" DATE,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "game_library_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reviews" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "game_id" UUID NOT NULL,
    "rating" SMALLINT NOT NULL,
    "body" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_GameToGenre" (
    "A" UUID NOT NULL,
    "B" INTEGER NOT NULL,

    CONSTRAINT "_GameToGenre_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_GameToPlatform" (
    "A" UUID NOT NULL,
    "B" INTEGER NOT NULL,

    CONSTRAINT "_GameToPlatform_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "games_rawg_id_key" ON "games"("rawg_id");

-- CreateIndex
CREATE UNIQUE INDEX "games_slug_key" ON "games"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "genres_name_key" ON "genres"("name");

-- CreateIndex
CREATE UNIQUE INDEX "genres_slug_key" ON "genres"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "platforms_name_key" ON "platforms"("name");

-- CreateIndex
CREATE UNIQUE INDEX "platforms_slug_key" ON "platforms"("slug");

-- CreateIndex
CREATE INDEX "game_library_user_id_status_idx" ON "game_library"("user_id", "status");

-- CreateIndex
CREATE INDEX "game_library_game_id_idx" ON "game_library"("game_id");

-- CreateIndex
CREATE UNIQUE INDEX "game_library_user_id_game_id_key" ON "game_library"("user_id", "game_id");

-- CreateIndex
CREATE INDEX "reviews_game_id_created_at_idx" ON "reviews"("game_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "reviews_user_id_game_id_key" ON "reviews"("user_id", "game_id");

-- CreateIndex
CREATE INDEX "_GameToGenre_B_index" ON "_GameToGenre"("B");

-- CreateIndex
CREATE INDEX "_GameToPlatform_B_index" ON "_GameToPlatform"("B");

-- AddForeignKey
ALTER TABLE "game_library" ADD CONSTRAINT "game_library_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "game_library" ADD CONSTRAINT "game_library_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "games"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "games"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_GameToGenre" ADD CONSTRAINT "_GameToGenre_A_fkey" FOREIGN KEY ("A") REFERENCES "games"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_GameToGenre" ADD CONSTRAINT "_GameToGenre_B_fkey" FOREIGN KEY ("B") REFERENCES "genres"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_GameToPlatform" ADD CONSTRAINT "_GameToPlatform_A_fkey" FOREIGN KEY ("A") REFERENCES "games"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_GameToPlatform" ADD CONSTRAINT "_GameToPlatform_B_fkey" FOREIGN KEY ("B") REFERENCES "platforms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddCheckConstraint
ALTER TABLE "game_library" ADD CONSTRAINT "game_library_hours_played_check" CHECK ("hours_played" >= 0);

-- AddCheckConstraint
ALTER TABLE "game_library" ADD CONSTRAINT "game_library_completed_after_started_check" CHECK ("completed_at" IS NULL OR "started_at" IS NULL OR "completed_at" >= "started_at");

-- AddCheckConstraint
ALTER TABLE "game_library" ADD CONSTRAINT "game_library_completed_at_status_check" CHECK ("completed_at" IS NULL OR "status" = 'COMPLETED');

-- AddCheckConstraint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_rating_check" CHECK ("rating" BETWEEN 1 AND 10);