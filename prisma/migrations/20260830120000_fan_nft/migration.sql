-- AlterTable
ALTER TABLE "User" ADD COLUMN     "fanNftTier" INTEGER,
ADD COLUMN     "fanNftTokenId" INTEGER,
ADD COLUMN     "fanNftTxHash" TEXT,
ADD COLUMN     "fanNftSyncPending" BOOLEAN NOT NULL DEFAULT false;
