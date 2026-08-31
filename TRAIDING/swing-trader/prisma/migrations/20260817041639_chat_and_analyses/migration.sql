-- AlterTable
ALTER TABLE "ScannerResult" ADD COLUMN "distanceFromMa150" REAL;
ALTER TABLE "ScannerResult" ADD COLUMN "grade" TEXT;

-- CreateTable
CREATE TABLE "Conversation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Message" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "conversationId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Message_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TradeAnalysis" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "imagePath" TEXT NOT NULL,
    "symbol" TEXT,
    "grade" TEXT,
    "score" INTEGER,
    "setup" TEXT,
    "reasoning" TEXT,
    "criteria" TEXT,
    "entry" REAL,
    "stop" REAL,
    "target" REAL,
    "rr" REAL,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "Message_conversationId_idx" ON "Message"("conversationId");

-- CreateIndex
CREATE INDEX "TradeAnalysis_createdAt_idx" ON "TradeAnalysis"("createdAt");

-- CreateIndex
CREATE INDEX "TradeAnalysis_grade_idx" ON "TradeAnalysis"("grade");
