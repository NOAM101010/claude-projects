-- CreateTable
CREATE TABLE "Trade" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "symbol" TEXT NOT NULL,
    "side" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "entryDate" DATETIME NOT NULL,
    "entryPrice" REAL NOT NULL,
    "quantity" REAL NOT NULL,
    "stopLoss" REAL,
    "target" REAL,
    "exitDate" DATETIME,
    "exitPrice" REAL,
    "setup" TEXT,
    "reasonEntry" TEXT,
    "reasonExit" TEXT,
    "emotion" TEXT,
    "tags" TEXT,
    "fees" REAL NOT NULL DEFAULT 0,
    "pnl" REAL,
    "pnlPercent" REAL,
    "rMultiple" REAL,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Screenshot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tradeId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "label" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Screenshot_tradeId_fkey" FOREIGN KEY ("tradeId") REFERENCES "Trade" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Alert" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "source" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "price" REAL,
    "triggerTime" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "raw" TEXT,
    "seen" BOOLEAN NOT NULL DEFAULT false,
    "convertedToTradeId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "ScannerResult" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "runId" TEXT NOT NULL,
    "runAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "scanType" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "price" REAL,
    "changePercent" REAL,
    "volume" REAL,
    "avgVolume" REAL,
    "volumeRatio" REAL,
    "marketCap" REAL,
    "atr" REAL,
    "rsi" REAL,
    "distanceFromHigh" REAL,
    "matchedSetups" TEXT,
    "score" REAL,
    "notes" TEXT
);

-- CreateTable
CREATE TABLE "ScannerRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "scanType" TEXT NOT NULL,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" DATETIME,
    "totalScanned" INTEGER NOT NULL DEFAULT 0,
    "totalMatches" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'running',
    "errorMessage" TEXT
);

-- CreateTable
CREATE TABLE "Watchlist" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "symbol" TEXT NOT NULL,
    "notes" TEXT,
    "addedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "PushSubscription" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "label" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Setting" (
    "key" TEXT NOT NULL PRIMARY KEY,
    "value" TEXT NOT NULL
);

-- CreateIndex
CREATE INDEX "Trade_symbol_idx" ON "Trade"("symbol");

-- CreateIndex
CREATE INDEX "Trade_entryDate_idx" ON "Trade"("entryDate");

-- CreateIndex
CREATE INDEX "Trade_status_idx" ON "Trade"("status");

-- CreateIndex
CREATE INDEX "Alert_symbol_idx" ON "Alert"("symbol");

-- CreateIndex
CREATE INDEX "Alert_triggerTime_idx" ON "Alert"("triggerTime");

-- CreateIndex
CREATE INDEX "ScannerResult_runId_idx" ON "ScannerResult"("runId");

-- CreateIndex
CREATE INDEX "ScannerResult_symbol_idx" ON "ScannerResult"("symbol");

-- CreateIndex
CREATE INDEX "ScannerResult_runAt_idx" ON "ScannerResult"("runAt");

-- CreateIndex
CREATE UNIQUE INDEX "Watchlist_symbol_key" ON "Watchlist"("symbol");

-- CreateIndex
CREATE UNIQUE INDEX "PushSubscription_endpoint_key" ON "PushSubscription"("endpoint");
