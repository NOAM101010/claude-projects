-- AlterTable
ALTER TABLE "ScannerResult" ADD COLUMN "backtestedAt" DATETIME;
ALTER TABLE "ScannerResult" ADD COLUMN "maxReturn20d" REAL;
ALTER TABLE "ScannerResult" ADD COLUMN "minReturn20d" REAL;
ALTER TABLE "ScannerResult" ADD COLUMN "price10d" REAL;
ALTER TABLE "ScannerResult" ADD COLUMN "price20d" REAL;
ALTER TABLE "ScannerResult" ADD COLUMN "price5d" REAL;
ALTER TABLE "ScannerResult" ADD COLUMN "profileName" TEXT;
ALTER TABLE "ScannerResult" ADD COLUMN "return10d" REAL;
ALTER TABLE "ScannerResult" ADD COLUMN "return20d" REAL;
ALTER TABLE "ScannerResult" ADD COLUMN "return5d" REAL;

-- AlterTable
ALTER TABLE "ScannerRun" ADD COLUMN "profileName" TEXT;

-- CreateTable
CREATE TABLE "ScannerProfile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "config" TEXT NOT NULL,
    "universe" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "ScannerProfile_name_key" ON "ScannerProfile"("name");
