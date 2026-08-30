-- AlterEnum
ALTER TYPE "Plan" ADD VALUE IF NOT EXISTS 'SCHEDULE_EARLY';
ALTER TYPE "Plan" ADD VALUE IF NOT EXISTS 'SCHEDULE_VIP';
ALTER TYPE "Plan" ADD VALUE IF NOT EXISTS 'VIP_ALL_IN_ONE';
ALTER TYPE "Plan" ADD VALUE IF NOT EXISTS 'LAWYER_STATE_PRO';
ALTER TYPE "Plan" ADD VALUE IF NOT EXISTS 'LAWYER_INTL_UNLIMITED';

-- CreateTable
CREATE TABLE "ProblemHold" (
    "id" TEXT NOT NULL,
    "problemId" TEXT NOT NULL,
    "lawyerId" TEXT NOT NULL,
    "lawyerProfileId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "connectedAt" TIMESTAMP(3),
    CONSTRAINT "ProblemHold_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayoutAccount" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kycStatus" TEXT NOT NULL DEFAULT 'NOT_STARTED',
    "providerStatus" TEXT NOT NULL DEFAULT 'NOT_STARTED',
    "availableBalance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "pendingBalance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalEarnings" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "razorpayContactId" TEXT,
    "razorpayFundAccountId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PayoutAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Complaint" (
    "id" TEXT NOT NULL,
    "reporterId" TEXT NOT NULL,
    "lawyerId" TEXT NOT NULL,
    "bookingId" TEXT,
    "matterId" TEXT,
    "category" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "evidenceUrl" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "decision" TEXT,
    "decidedBy" TEXT,
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Complaint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ComplaintAppeal" (
    "id" TEXT NOT NULL,
    "complaintId" TEXT NOT NULL,
    "lawyerId" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ComplaintAppeal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "targetId" TEXT,
    "targetType" TEXT,
    "meta" JSONB,
    "ip" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProblemHold_problemId_lawyerId_key" ON "ProblemHold"("problemId", "lawyerId");
CREATE INDEX "ProblemHold_problemId_idx" ON "ProblemHold"("problemId");
CREATE INDEX "ProblemHold_lawyerId_idx" ON "ProblemHold"("lawyerId");
CREATE INDEX "ProblemHold_status_idx" ON "ProblemHold"("status");
CREATE INDEX "ProblemHold_expiresAt_idx" ON "ProblemHold"("expiresAt");
CREATE UNIQUE INDEX "PayoutAccount_userId_key" ON "PayoutAccount"("userId");
CREATE INDEX "Complaint_reporterId_idx" ON "Complaint"("reporterId");
CREATE INDEX "Complaint_lawyerId_idx" ON "Complaint"("lawyerId");
CREATE INDEX "Complaint_status_idx" ON "Complaint"("status");
CREATE INDEX "ComplaintAppeal_complaintId_idx" ON "ComplaintAppeal"("complaintId");
CREATE INDEX "ComplaintAppeal_lawyerId_idx" ON "ComplaintAppeal"("lawyerId");
CREATE INDEX "AuditLog_actorId_idx" ON "AuditLog"("actorId");
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");

-- AddForeignKey
ALTER TABLE "ProblemHold" ADD CONSTRAINT "ProblemHold_problemId_fkey" FOREIGN KEY ("problemId") REFERENCES "LegalProblem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProblemHold" ADD CONSTRAINT "ProblemHold_lawyerId_fkey" FOREIGN KEY ("lawyerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProblemHold" ADD CONSTRAINT "ProblemHold_lawyerProfileId_fkey" FOREIGN KEY ("lawyerProfileId") REFERENCES "LawyerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PayoutAccount" ADD CONSTRAINT "PayoutAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Complaint" ADD CONSTRAINT "Complaint_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Complaint" ADD CONSTRAINT "Complaint_lawyerId_fkey" FOREIGN KEY ("lawyerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Complaint" ADD CONSTRAINT "Complaint_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Complaint" ADD CONSTRAINT "Complaint_matterId_fkey" FOREIGN KEY ("matterId") REFERENCES "Matter"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ComplaintAppeal" ADD CONSTRAINT "ComplaintAppeal_complaintId_fkey" FOREIGN KEY ("complaintId") REFERENCES "Complaint"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ComplaintAppeal" ADD CONSTRAINT "ComplaintAppeal_lawyerId_fkey" FOREIGN KEY ("lawyerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
