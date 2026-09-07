-- CreateEnum
CREATE TYPE "BattleStatus" AS ENUM ('OPEN', 'LOCKED', 'RESOLVED', 'VOIDED');

-- AlterTable
ALTER TABLE "User" ADD COLUMN "battlesWon" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "Battle" (
    "id" TEXT NOT NULL,
    "marketRowId" TEXT NOT NULL,
    "status" "BattleStatus" NOT NULL DEFAULT 'OPEN',
    "locksAt" TIMESTAMP(3) NOT NULL,
    "winningDirection" "Direction",
    "voidReason" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Battle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BattleEntry" (
    "id" TEXT NOT NULL,
    "battleId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "predictionId" TEXT NOT NULL,
    "placement" INTEGER,
    "energyPaid" DECIMAL(18,8) NOT NULL DEFAULT 0,
    "multiplier" DECIMAL(8,4) NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BattleEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BattleRatingEvent" (
    "id" TEXT NOT NULL,
    "battleId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "ratingBefore" INTEGER NOT NULL,
    "ratingAfter" INTEGER NOT NULL,
    "input" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BattleRatingEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Battle_marketRowId_key" ON "Battle"("marketRowId");

-- CreateIndex
CREATE INDEX "Battle_status_idx" ON "Battle"("status");

-- CreateIndex
CREATE INDEX "Battle_locksAt_idx" ON "Battle"("locksAt");

-- CreateIndex
CREATE UNIQUE INDEX "BattleEntry_predictionId_key" ON "BattleEntry"("predictionId");

-- CreateIndex
CREATE INDEX "BattleEntry_battleId_idx" ON "BattleEntry"("battleId");

-- CreateIndex
CREATE UNIQUE INDEX "BattleEntry_battleId_userId_key" ON "BattleEntry"("battleId", "userId");

-- CreateIndex
CREATE INDEX "BattleRatingEvent_battleId_idx" ON "BattleRatingEvent"("battleId");

-- CreateIndex
CREATE INDEX "BattleRatingEvent_userId_idx" ON "BattleRatingEvent"("userId");

-- AddForeignKey
ALTER TABLE "Battle" ADD CONSTRAINT "Battle_marketRowId_fkey" FOREIGN KEY ("marketRowId") REFERENCES "Market"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BattleEntry" ADD CONSTRAINT "BattleEntry_battleId_fkey" FOREIGN KEY ("battleId") REFERENCES "Battle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BattleEntry" ADD CONSTRAINT "BattleEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BattleEntry" ADD CONSTRAINT "BattleEntry_predictionId_fkey" FOREIGN KEY ("predictionId") REFERENCES "Prediction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BattleRatingEvent" ADD CONSTRAINT "BattleRatingEvent_battleId_fkey" FOREIGN KEY ("battleId") REFERENCES "Battle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "Prediction" ADD COLUMN "battleId" TEXT;

-- CreateIndex
CREATE INDEX "Prediction_battleId_idx" ON "Prediction"("battleId");

-- AddForeignKey
ALTER TABLE "Prediction" ADD CONSTRAINT "Prediction_battleId_fkey" FOREIGN KEY ("battleId") REFERENCES "Battle"("id") ON DELETE SET NULL ON UPDATE CASCADE;
