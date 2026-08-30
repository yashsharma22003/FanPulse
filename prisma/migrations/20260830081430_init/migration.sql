-- CreateEnum
CREATE TYPE "Direction" AS ENUM ('UP', 'DOWN');

-- CreateEnum
CREATE TYPE "PredictionStatus" AS ENUM ('PENDING', 'OPEN', 'LOCKED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "ChallengeStatus" AS ENUM ('LOCKED', 'RESOLVED', 'VOIDED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "AiStatus" AS ENUM ('IDLE', 'PENDING', 'READY', 'FAILED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "wallet" TEXT NOT NULL,
    "challengeEnergy" DECIMAL(18,8) NOT NULL DEFAULT 0,
    "challengeRating" INTEGER NOT NULL DEFAULT 1000,
    "wins" INTEGER NOT NULL DEFAULT 0,
    "losses" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Market" (
    "id" TEXT NOT NULL,
    "marketId" TEXT NOT NULL,
    "asset" TEXT NOT NULL,
    "intervalSec" INTEGER NOT NULL,
    "tradingStart" TIMESTAMP(3),
    "expiry" TIMESTAMP(3) NOT NULL,
    "pool" TEXT,
    "venueId" TEXT,
    "upSymbol" TEXT,
    "downSymbol" TEXT,
    "onchainStatus" INTEGER NOT NULL DEFAULT 1,
    "aiProbability" INTEGER,
    "aiRequestId" TEXT,
    "aiStatus" "AiStatus" NOT NULL DEFAULT 'IDLE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Market_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Prediction" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "marketRowId" TEXT NOT NULL,
    "direction" "Direction" NOT NULL,
    "confidence" DECIMAL(5,4) NOT NULL,
    "quantity" DECIMAL(28,8) NOT NULL,
    "quantityFilled" DECIMAL(28,8) NOT NULL DEFAULT 0,
    "orderId" TEXT,
    "txHash" TEXT,
    "yesId" TEXT,
    "noId" TEXT,
    "status" "PredictionStatus" NOT NULL DEFAULT 'PENDING',
    "challengeExpiresAt" TIMESTAMP(3),
    "challengingOfId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Prediction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Challenge" (
    "id" TEXT NOT NULL,
    "originalPredictionId" TEXT NOT NULL,
    "challengerPredictionId" TEXT NOT NULL,
    "status" "ChallengeStatus" NOT NULL DEFAULT 'LOCKED',
    "winnerUserId" TEXT,
    "multiplier" DECIMAL(8,4) NOT NULL DEFAULT 1,
    "energyPaid" DECIMAL(18,8) NOT NULL DEFAULT 0,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Challenge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RatingEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "challengeId" TEXT NOT NULL,
    "input" JSONB NOT NULL,
    "ratingBefore" INTEGER NOT NULL,
    "ratingAfter" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RatingEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuthNonce" (
    "id" TEXT NOT NULL,
    "nonce" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AuthNonce_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_wallet_key" ON "User"("wallet");

-- CreateIndex
CREATE UNIQUE INDEX "Market_marketId_key" ON "Market"("marketId");

-- CreateIndex
CREATE INDEX "Prediction_status_challengeExpiresAt_idx" ON "Prediction"("status", "challengeExpiresAt");

-- CreateIndex
CREATE INDEX "Prediction_marketRowId_status_idx" ON "Prediction"("marketRowId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Challenge_originalPredictionId_key" ON "Challenge"("originalPredictionId");

-- CreateIndex
CREATE UNIQUE INDEX "Challenge_challengerPredictionId_key" ON "Challenge"("challengerPredictionId");

-- CreateIndex
CREATE INDEX "Challenge_status_idx" ON "Challenge"("status");

-- CreateIndex
CREATE UNIQUE INDEX "AuthNonce_nonce_key" ON "AuthNonce"("nonce");

-- CreateIndex
CREATE INDEX "AuthNonce_expiresAt_idx" ON "AuthNonce"("expiresAt");

-- AddForeignKey
ALTER TABLE "Prediction" ADD CONSTRAINT "Prediction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Prediction" ADD CONSTRAINT "Prediction_marketRowId_fkey" FOREIGN KEY ("marketRowId") REFERENCES "Market"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Prediction" ADD CONSTRAINT "Prediction_challengingOfId_fkey" FOREIGN KEY ("challengingOfId") REFERENCES "Prediction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Challenge" ADD CONSTRAINT "Challenge_originalPredictionId_fkey" FOREIGN KEY ("originalPredictionId") REFERENCES "Prediction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Challenge" ADD CONSTRAINT "Challenge_challengerPredictionId_fkey" FOREIGN KEY ("challengerPredictionId") REFERENCES "Prediction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Challenge" ADD CONSTRAINT "Challenge_winnerUserId_fkey" FOREIGN KEY ("winnerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RatingEvent" ADD CONSTRAINT "RatingEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RatingEvent" ADD CONSTRAINT "RatingEvent_challengeId_fkey" FOREIGN KEY ("challengeId") REFERENCES "Challenge"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
