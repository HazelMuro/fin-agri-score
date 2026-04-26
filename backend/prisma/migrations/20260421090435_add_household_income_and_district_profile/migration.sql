-- AlterTable
ALTER TABLE "Farmer" ADD COLUMN     "education" TEXT,
ADD COLUMN     "householdSize" INTEGER,
ADD COLUMN     "maritalStatus" TEXT;

-- CreateTable
CREATE TABLE "HouseholdIncome" (
    "id" TEXT NOT NULL,
    "farmerId" TEXT NOT NULL,
    "mainSource" TEXT,
    "mainAmount" DOUBLE PRECISION,
    "secondarySource" TEXT,
    "secondaryAmount" DOUBLE PRECISION,
    "thirdSource" TEXT,
    "thirdAmount" DOUBLE PRECISION,
    "shockExperienced" BOOLEAN NOT NULL DEFAULT false,
    "copingIndex" INTEGER,
    "dietaryDiversity" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HouseholdIncome_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DistrictProfile" (
    "id" TEXT NOT NULL,
    "province" TEXT NOT NULL,
    "district" TEXT NOT NULL,
    "centroidLat" DOUBLE PRECISION NOT NULL,
    "centroidLon" DOUBLE PRECISION NOT NULL,
    "agroEcoZone" TEXT NOT NULL,
    "rainfall90dClimMm" DOUBLE PRECISION NOT NULL,
    "rainfall30dClimMm" DOUBLE PRECISION NOT NULL,
    "ndviBaseline" DOUBLE PRECISION NOT NULL,
    "ndviVariability" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DistrictProfile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "HouseholdIncome_farmerId_key" ON "HouseholdIncome"("farmerId");

-- CreateIndex
CREATE UNIQUE INDEX "DistrictProfile_district_key" ON "DistrictProfile"("district");

-- CreateIndex
CREATE INDEX "DistrictProfile_province_idx" ON "DistrictProfile"("province");

-- AddForeignKey
ALTER TABLE "HouseholdIncome" ADD CONSTRAINT "HouseholdIncome_farmerId_fkey" FOREIGN KEY ("farmerId") REFERENCES "Farmer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
