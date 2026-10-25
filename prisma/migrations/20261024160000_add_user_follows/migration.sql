-- CreateTable
CREATE TABLE "user_follows" (
    "follower_id" UUID NOT NULL,
    "following_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_follows_pkey" PRIMARY KEY ("follower_id", "following_id"),
    CONSTRAINT "user_follows_not_self_check" CHECK ("follower_id" <> "following_id")
);

-- CreateIndex
CREATE INDEX "user_follows_follower_id_created_at_idx" ON "user_follows"("follower_id", "created_at");
CREATE INDEX "user_follows_following_id_created_at_idx" ON "user_follows"("following_id", "created_at");

-- AddForeignKey
ALTER TABLE "user_follows" ADD CONSTRAINT "user_follows_follower_id_fkey" FOREIGN KEY ("follower_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "user_follows" ADD CONSTRAINT "user_follows_following_id_fkey" FOREIGN KEY ("following_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
