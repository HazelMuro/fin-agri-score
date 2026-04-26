-- CreateTable
CREATE TABLE "Farmer" (
    "id" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "gender" TEXT,
    "age" INTEGER,
    "province" TEXT,
    "district" TEXT,
    "ward" TEXT,
    "farmSizeHa" DOUBLE PRECISION,
    "phone" TEXT,
    "nationalId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Farmer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoanApplication" (
    "id" TEXT NOT NULL,
    "farmerId" TEXT NOT NULL,
    "amountRequested" DOUBLE PRECISION NOT NULL,
    "purpose" TEXT NOT NULL,
    "season" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LoanApplication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreditScore" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "predictedLabel" TEXT NOT NULL,
    "classProbabilities" JSONB NOT NULL,
    "repaymentProbability" DOUBLE PRECISION NOT NULL,
    "finAgriScore" INTEGER NOT NULL,
    "riskBand" TEXT NOT NULL,
    "recommendation" TEXT NOT NULL,
    "topFactors" JSONB,
    "modelName" TEXT,
    "modelVersion" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CreditScore_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FarmActivity" (
    "id" TEXT NOT NULL,
    "farmerId" TEXT NOT NULL,
    "cropType" TEXT,
    "estimatedYield" DOUBLE PRECISION,
    "irrigation" TEXT,
    "season" TEXT,
    "inputUsage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FarmActivity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Asset" (
    "id" TEXT NOT NULL,
    "farmerId" TEXT NOT NULL,
    "assetType" TEXT NOT NULL,
    "assetName" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION,
    "estimatedValue" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Asset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SocialCapital" (
    "id" TEXT NOT NULL,
    "farmerId" TEXT NOT NULL,
    "groupMembership" BOOLEAN NOT NULL DEFAULT false,
    "groupName" TEXT,
    "yearsInGroup" INTEGER,
    "leadershipRole" TEXT,
    "guarantorAvailable" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SocialCapital_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SatelliteData" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "rainfall30dMm" DOUBLE PRECISION,
    "rainfall90dMm" DOUBLE PRECISION,
    "rainfallAnomaly" DOUBLE PRECISION,
    "ndvi90dMean" DOUBLE PRECISION,
    "ndvi90dStd" DOUBLE PRECISION,
    "environmentScore" DOUBLE PRECISION,
    "environmentRisk" TEXT,
    "observationDate" TIMESTAMP(3),
    "source" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SatelliteData_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'LOAN_OFFICER',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Farmer_fullName_idx" ON "Farmer"("fullName");

-- CreateIndex
CREATE INDEX "Farmer_district_idx" ON "Farmer"("district");

-- CreateIndex
CREATE INDEX "LoanApplication_farmerId_idx" ON "LoanApplication"("farmerId");

-- CreateIndex
CREATE INDEX "LoanApplication_status_idx" ON "LoanApplication"("status");

-- CreateIndex
CREATE INDEX "LoanApplication_createdAt_idx" ON "LoanApplication"("createdAt");

-- CreateIndex
CREATE INDEX "CreditScore_applicationId_idx" ON "CreditScore"("applicationId");

-- CreateIndex
CREATE INDEX "CreditScore_createdAt_idx" ON "CreditScore"("createdAt");

-- CreateIndex
CREATE INDEX "CreditScore_riskBand_idx" ON "CreditScore"("riskBand");

-- CreateIndex
CREATE INDEX "FarmActivity_farmerId_idx" ON "FarmActivity"("farmerId");

-- CreateIndex
CREATE INDEX "Asset_farmerId_idx" ON "Asset"("farmerId");

-- CreateIndex
CREATE INDEX "SocialCapital_farmerId_idx" ON "SocialCapital"("farmerId");

-- CreateIndex
CREATE INDEX "SatelliteData_applicationId_idx" ON "SatelliteData"("applicationId");

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "AuditLog_applicationId_idx" ON "AuditLog"("applicationId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- AddForeignKey
ALTER TABLE "LoanApplication" ADD CONSTRAINT "LoanApplication_farmerId_fkey" FOREIGN KEY ("farmerId") REFERENCES "Farmer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditScore" ADD CONSTRAINT "CreditScore_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "LoanApplication"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FarmActivity" ADD CONSTRAINT "FarmActivity_farmerId_fkey" FOREIGN KEY ("farmerId") REFERENCES "Farmer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_farmerId_fkey" FOREIGN KEY ("farmerId") REFERENCES "Farmer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SocialCapital" ADD CONSTRAINT "SocialCapital_farmerId_fkey" FOREIGN KEY ("farmerId") REFERENCES "Farmer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SatelliteData" ADD CONSTRAINT "SatelliteData_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "LoanApplication"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "LoanApplication"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
