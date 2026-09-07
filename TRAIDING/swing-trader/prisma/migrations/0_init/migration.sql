-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "TradeAnalysis" (
    "id" TEXT NOT NULL,
    "imagePath" TEXT NOT NULL,
    "symbol" TEXT,
    "grade" TEXT,
    "score" INTEGER,
    "setup" TEXT,
    "reasoning" TEXT,
    "criteria" TEXT,
    "entry" DOUBLE PRECISION,
    "stop" DOUBLE PRECISION,
    "target" DOUBLE PRECISION,
    "rr" DOUBLE PRECISION,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TradeAnalysis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScannerProfile" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "config" TEXT NOT NULL,
    "universe" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScannerProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScannerRun" (
    "id" TEXT NOT NULL,
    "scanType" TEXT NOT NULL,
    "profileName" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "totalScanned" INTEGER NOT NULL DEFAULT 0,
    "totalMatches" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'running',
    "errorMessage" TEXT,

    CONSTRAINT "ScannerRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScannerResult" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "runAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "scanType" TEXT NOT NULL,
    "profileName" TEXT,
    "symbol" TEXT NOT NULL,
    "price" DOUBLE PRECISION,
    "changePercent" DOUBLE PRECISION,
    "volume" DOUBLE PRECISION,
    "avgVolume" DOUBLE PRECISION,
    "volumeRatio" DOUBLE PRECISION,
    "marketCap" DOUBLE PRECISION,
    "atr" DOUBLE PRECISION,
    "rsi" DOUBLE PRECISION,
    "distanceFromHigh" DOUBLE PRECISION,
    "distanceFromMa150" DOUBLE PRECISION,
    "matchedSetups" TEXT,
    "signals" TEXT,
    "verdict" TEXT,
    "score" DOUBLE PRECISION,
    "grade" TEXT,
    "notes" TEXT,
    "price5d" DOUBLE PRECISION,
    "price10d" DOUBLE PRECISION,
    "price20d" DOUBLE PRECISION,
    "return5d" DOUBLE PRECISION,
    "return10d" DOUBLE PRECISION,
    "return20d" DOUBLE PRECISION,
    "maxReturn20d" DOUBLE PRECISION,
    "minReturn20d" DOUBLE PRECISION,
    "backtestedAt" TIMESTAMP(3),

    CONSTRAINT "ScannerResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WatchlistFolder" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WatchlistFolder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Watchlist" (
    "id" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "folderId" TEXT,
    "notes" TEXT,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Watchlist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Trade" (
    "id" TEXT NOT NULL,
    "ticker" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "buyPrice" DOUBLE PRECISION NOT NULL,
    "buyAmount" DOUBLE PRECISION NOT NULL,
    "buyDate" TIMESTAMP(3) NOT NULL,
    "sellPrice" DOUBLE PRECISION,
    "sellAmount" DOUBLE PRECISION,
    "sellDate" TIMESTAMP(3),
    "commission" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "usdIlsRate" DOUBLE PRECISION,
    "stopPrice" DOUBLE PRECISION,
    "setup" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Trade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PushSubscription" (
    "id" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "label" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PushSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Setting" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,

    CONSTRAINT "Setting_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE INDEX "TradeAnalysis_createdAt_idx" ON "TradeAnalysis"("createdAt");

-- CreateIndex
CREATE INDEX "TradeAnalysis_grade_idx" ON "TradeAnalysis"("grade");

-- CreateIndex
CREATE UNIQUE INDEX "ScannerProfile_name_key" ON "ScannerProfile"("name");

-- CreateIndex
CREATE INDEX "ScannerResult_runId_idx" ON "ScannerResult"("runId");

-- CreateIndex
CREATE INDEX "ScannerResult_symbol_idx" ON "ScannerResult"("symbol");

-- CreateIndex
CREATE INDEX "ScannerResult_runAt_idx" ON "ScannerResult"("runAt");

-- CreateIndex
CREATE UNIQUE INDEX "WatchlistFolder_name_key" ON "WatchlistFolder"("name");

-- CreateIndex
CREATE INDEX "Watchlist_folderId_idx" ON "Watchlist"("folderId");

-- CreateIndex
CREATE UNIQUE INDEX "Watchlist_symbol_folderId_key" ON "Watchlist"("symbol", "folderId");

-- CreateIndex
CREATE INDEX "Trade_ticker_idx" ON "Trade"("ticker");

-- CreateIndex
CREATE INDEX "Trade_buyDate_idx" ON "Trade"("buyDate");

-- CreateIndex
CREATE INDEX "Trade_sellDate_idx" ON "Trade"("sellDate");

-- CreateIndex
CREATE UNIQUE INDEX "PushSubscription_endpoint_key" ON "PushSubscription"("endpoint");

-- AddForeignKey
ALTER TABLE "Watchlist" ADD CONSTRAINT "Watchlist_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "WatchlistFolder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

