-- CreateEnum
CREATE TYPE "LegalProblemStatus" AS ENUM ('OPEN', 'CLOSED');

-- CreateTable
CREATE TABLE "LegalProblem" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "location" TEXT,
    "status" "LegalProblemStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "LegalProblem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LawyerResponse" (
    "id" TEXT NOT NULL,
    "problemId" TEXT NOT NULL,
    "lawyerId" TEXT NOT NULL,
    "lawyerProfileId" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LawyerResponse_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LegalProblem_ownerId_idx" ON "LegalProblem"("ownerId");
CREATE INDEX "LegalProblem_status_idx" ON "LegalProblem"("status");
CREATE INDEX "LegalProblem_category_idx" ON "LegalProblem"("category");
CREATE INDEX "LegalProblem_location_idx" ON "LegalProblem"("location");
CREATE UNIQUE INDEX "LawyerResponse_problemId_lawyerId_key" ON "LawyerResponse"("problemId", "lawyerId");
CREATE INDEX "LawyerResponse_problemId_idx" ON "LawyerResponse"("problemId");
CREATE INDEX "LawyerResponse_lawyerId_idx" ON "LawyerResponse"("lawyerId");
CREATE INDEX "LawyerResponse_lawyerProfileId_idx" ON "LawyerResponse"("lawyerProfileId");

-- AddForeignKey
ALTER TABLE "LegalProblem" ADD CONSTRAINT "LegalProblem_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LawyerResponse" ADD CONSTRAINT "LawyerResponse_problemId_fkey" FOREIGN KEY ("problemId") REFERENCES "LegalProblem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LawyerResponse" ADD CONSTRAINT "LawyerResponse_lawyerId_fkey" FOREIGN KEY ("lawyerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LawyerResponse" ADD CONSTRAINT "LawyerResponse_lawyerProfileId_fkey" FOREIGN KEY ("lawyerProfileId") REFERENCES "LawyerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
