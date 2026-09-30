-- AlterTable
ALTER TABLE "users" DROP COLUMN "password_hash",
ADD COLUMN     "avatar_url" TEXT,
ADD COLUMN     "display_name" TEXT,
ADD COLUMN     "google_id" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "users_google_id_key" ON "users"("google_id");
