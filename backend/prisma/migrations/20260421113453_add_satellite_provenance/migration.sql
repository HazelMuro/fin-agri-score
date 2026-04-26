/*
  Warnings:

  - Added the required column `updatedAt` to the `SatelliteData` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "SatelliteData" ADD COLUMN     "confirmedAt" TIMESTAMP(3),
ADD COLUMN     "confirmedBy" TEXT,
ADD COLUMN     "provenance" JSONB,
ADD COLUMN     "sourceKind" TEXT,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- CreateIndex
CREATE INDEX "SatelliteData_createdAt_idx" ON "SatelliteData"("createdAt");
