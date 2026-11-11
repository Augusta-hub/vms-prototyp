-- CreateEnum
CREATE TYPE "BillingPeriodStatus" AS ENUM ('open', 'closed');

-- CreateEnum
CREATE TYPE "TimesheetStatus" AS ENUM ('recorded', 'submitted', 'inApproval', 'approved', 'rejected', 'corrected');

-- CreateEnum
CREATE TYPE "ApprovalDecision" AS ENUM ('approved', 'rejected');

-- CreateEnum
CREATE TYPE "PremiumOrigin" AS ENUM ('derived', 'declared');

-- CreateEnum
CREATE TYPE "PremiumCalculationBase" AS ENUM ('percentage', 'absolute');

-- CreateEnum
CREATE TYPE "PremiumAppliesTo" AS ENUM ('night', 'sunday', 'publicHoliday', 'overtime', 'hardship', 'other');

-- CreateEnum
CREATE TYPE "PremiumDerivationBasis" AS ENUM ('timeOfDay', 'calendarDay', 'weeklyTotal', 'manual');

-- CreateEnum
CREATE TYPE "PremiumLegalBasis" AS ENUM ('statutory', 'collectiveAgreement', 'contractual');

-- CreateTable
CREATE TABLE "CustomerTimesheetApprovalStage" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "level" INTEGER NOT NULL,
    "roleCode" "RoleCode" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT,
    "updatedAt" TIMESTAMP(3),

    CONSTRAINT "CustomerTimesheetApprovalStage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BillingPeriod" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "periodNumber" TEXT NOT NULL,
    "customerId" TEXT,
    "periodFrom" TIMESTAMP(3) NOT NULL,
    "periodTo" TIMESTAMP(3) NOT NULL,
    "closingDate" TIMESTAMP(3) NOT NULL,
    "status" "BillingPeriodStatus" NOT NULL,
    "openedAt" TIMESTAMP(3) NOT NULL,
    "openedById" TEXT NOT NULL,
    "closedAt" TIMESTAMP(3),
    "closedById" TEXT,
    "externalReference" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT,
    "updatedAt" TIMESTAMP(3),
    "updatedById" TEXT,
    "deactivatedAt" TIMESTAMP(3),
    "deactivatedById" TEXT,

    CONSTRAINT "BillingPeriod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Timesheet" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "timesheetNumber" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "billingPeriodId" TEXT NOT NULL,
    "periodFrom" TIMESTAMP(3) NOT NULL,
    "periodTo" TIMESTAMP(3) NOT NULL,
    "recordedById" TEXT NOT NULL,
    "submittedAt" TIMESTAMP(3),
    "submittedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "approvedById" TEXT,
    "rejectionReason" TEXT,
    "correctionOfId" TEXT,
    "status" "TimesheetStatus" NOT NULL,
    "externalReference" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT,
    "updatedAt" TIMESTAMP(3),
    "updatedById" TEXT,
    "deactivatedAt" TIMESTAMP(3),
    "deactivatedById" TEXT,

    CONSTRAINT "Timesheet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TimesheetApproval" (
    "id" TEXT NOT NULL,
    "timesheetId" TEXT NOT NULL,
    "level" INTEGER NOT NULL,
    "assignedRoleCode" "RoleCode" NOT NULL,
    "decision" "ApprovalDecision",
    "decidedAt" TIMESTAMP(3),
    "decidedById" TEXT,
    "delegationId" TEXT,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT,
    "updatedAt" TIMESTAMP(3),
    "updatedById" TEXT,

    CONSTRAINT "TimesheetApproval_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TimeEntry" (
    "id" TEXT NOT NULL,
    "timesheetId" TEXT NOT NULL,
    "workDate" TIMESTAMP(3) NOT NULL,
    "startMinute" INTEGER,
    "endMinute" INTEGER,
    "breakMinutes" INTEGER,
    "hours" DECIMAL(8,4) NOT NULL,
    "costCenterId" TEXT,
    "note" TEXT,
    "correctedFromId" TEXT,
    "correctionReason" TEXT,
    "externalReference" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT,
    "updatedAt" TIMESTAMP(3),
    "updatedById" TEXT,

    CONSTRAINT "TimeEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TimeEntryPremium" (
    "id" TEXT NOT NULL,
    "timeEntryId" TEXT NOT NULL,
    "premiumTypeId" TEXT NOT NULL,
    "hours" DECIMAL(8,4) NOT NULL,
    "origin" "PremiumOrigin" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT,
    "updatedAt" TIMESTAMP(3),

    CONSTRAINT "TimeEntryPremium_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PremiumType" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "calculationBase" "PremiumCalculationBase" NOT NULL,
    "defaultValue" DECIMAL(12,4),
    "appliesTo" "PremiumAppliesTo" NOT NULL,
    "derivationBasis" "PremiumDerivationBasis" NOT NULL,
    "legalBasis" "PremiumLegalBasis" NOT NULL,
    "fromMinute" INTEGER,
    "toMinute" INTEGER,
    "validFrom" TIMESTAMP(3) NOT NULL,
    "validTo" TIMESTAMP(3),
    "externalReference" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT,
    "updatedAt" TIMESTAMP(3),
    "updatedById" TEXT,
    "deactivatedAt" TIMESTAMP(3),
    "deactivatedById" TEXT,

    CONSTRAINT "PremiumType_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CustomerTimesheetApprovalStage_customerId_idx" ON "CustomerTimesheetApprovalStage"("customerId");

-- CreateIndex
CREATE UNIQUE INDEX "CustomerTimesheetApprovalStage_customerId_level_key" ON "CustomerTimesheetApprovalStage"("customerId", "level");

-- CreateIndex
CREATE UNIQUE INDEX "BillingPeriod_periodNumber_key" ON "BillingPeriod"("periodNumber");

-- CreateIndex
CREATE INDEX "BillingPeriod_tenantId_idx" ON "BillingPeriod"("tenantId");

-- CreateIndex
CREATE INDEX "BillingPeriod_customerId_idx" ON "BillingPeriod"("customerId");

-- CreateIndex
CREATE INDEX "BillingPeriod_status_idx" ON "BillingPeriod"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Timesheet_timesheetNumber_key" ON "Timesheet"("timesheetNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Timesheet_correctionOfId_key" ON "Timesheet"("correctionOfId");

-- CreateIndex
CREATE INDEX "Timesheet_tenantId_idx" ON "Timesheet"("tenantId");

-- CreateIndex
CREATE INDEX "Timesheet_assignmentId_idx" ON "Timesheet"("assignmentId");

-- CreateIndex
CREATE INDEX "Timesheet_billingPeriodId_idx" ON "Timesheet"("billingPeriodId");

-- CreateIndex
CREATE INDEX "Timesheet_status_idx" ON "Timesheet"("status");

-- CreateIndex
CREATE INDEX "TimesheetApproval_timesheetId_idx" ON "TimesheetApproval"("timesheetId");

-- CreateIndex
CREATE UNIQUE INDEX "TimesheetApproval_timesheetId_level_key" ON "TimesheetApproval"("timesheetId", "level");

-- CreateIndex
CREATE UNIQUE INDEX "TimeEntry_correctedFromId_key" ON "TimeEntry"("correctedFromId");

-- CreateIndex
CREATE INDEX "TimeEntry_timesheetId_idx" ON "TimeEntry"("timesheetId");

-- CreateIndex
CREATE INDEX "TimeEntry_workDate_idx" ON "TimeEntry"("workDate");

-- CreateIndex
CREATE INDEX "TimeEntryPremium_timeEntryId_idx" ON "TimeEntryPremium"("timeEntryId");

-- CreateIndex
CREATE UNIQUE INDEX "TimeEntryPremium_timeEntryId_premiumTypeId_key" ON "TimeEntryPremium"("timeEntryId", "premiumTypeId");

-- CreateIndex
CREATE UNIQUE INDEX "PremiumType_code_key" ON "PremiumType"("code");

-- CreateIndex
CREATE INDEX "PremiumType_tenantId_idx" ON "PremiumType"("tenantId");

-- CreateIndex
CREATE INDEX "PremiumType_appliesTo_idx" ON "PremiumType"("appliesTo");

-- AddForeignKey
ALTER TABLE "CustomerTimesheetApprovalStage" ADD CONSTRAINT "CustomerTimesheetApprovalStage_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerTimesheetApprovalStage" ADD CONSTRAINT "CustomerTimesheetApprovalStage_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingPeriod" ADD CONSTRAINT "BillingPeriod_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingPeriod" ADD CONSTRAINT "BillingPeriod_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingPeriod" ADD CONSTRAINT "BillingPeriod_openedById_fkey" FOREIGN KEY ("openedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingPeriod" ADD CONSTRAINT "BillingPeriod_closedById_fkey" FOREIGN KEY ("closedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingPeriod" ADD CONSTRAINT "BillingPeriod_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingPeriod" ADD CONSTRAINT "BillingPeriod_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingPeriod" ADD CONSTRAINT "BillingPeriod_deactivatedById_fkey" FOREIGN KEY ("deactivatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Timesheet" ADD CONSTRAINT "Timesheet_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Timesheet" ADD CONSTRAINT "Timesheet_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "Assignment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Timesheet" ADD CONSTRAINT "Timesheet_billingPeriodId_fkey" FOREIGN KEY ("billingPeriodId") REFERENCES "BillingPeriod"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Timesheet" ADD CONSTRAINT "Timesheet_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Timesheet" ADD CONSTRAINT "Timesheet_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Timesheet" ADD CONSTRAINT "Timesheet_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Timesheet" ADD CONSTRAINT "Timesheet_correctionOfId_fkey" FOREIGN KEY ("correctionOfId") REFERENCES "Timesheet"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Timesheet" ADD CONSTRAINT "Timesheet_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Timesheet" ADD CONSTRAINT "Timesheet_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Timesheet" ADD CONSTRAINT "Timesheet_deactivatedById_fkey" FOREIGN KEY ("deactivatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimesheetApproval" ADD CONSTRAINT "TimesheetApproval_timesheetId_fkey" FOREIGN KEY ("timesheetId") REFERENCES "Timesheet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimesheetApproval" ADD CONSTRAINT "TimesheetApproval_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimesheetApproval" ADD CONSTRAINT "TimesheetApproval_delegationId_fkey" FOREIGN KEY ("delegationId") REFERENCES "Delegation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimesheetApproval" ADD CONSTRAINT "TimesheetApproval_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimesheetApproval" ADD CONSTRAINT "TimesheetApproval_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimeEntry" ADD CONSTRAINT "TimeEntry_timesheetId_fkey" FOREIGN KEY ("timesheetId") REFERENCES "Timesheet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimeEntry" ADD CONSTRAINT "TimeEntry_costCenterId_fkey" FOREIGN KEY ("costCenterId") REFERENCES "CostCenter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimeEntry" ADD CONSTRAINT "TimeEntry_correctedFromId_fkey" FOREIGN KEY ("correctedFromId") REFERENCES "TimeEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimeEntry" ADD CONSTRAINT "TimeEntry_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimeEntry" ADD CONSTRAINT "TimeEntry_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimeEntryPremium" ADD CONSTRAINT "TimeEntryPremium_timeEntryId_fkey" FOREIGN KEY ("timeEntryId") REFERENCES "TimeEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimeEntryPremium" ADD CONSTRAINT "TimeEntryPremium_premiumTypeId_fkey" FOREIGN KEY ("premiumTypeId") REFERENCES "PremiumType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimeEntryPremium" ADD CONSTRAINT "TimeEntryPremium_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PremiumType" ADD CONSTRAINT "PremiumType_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PremiumType" ADD CONSTRAINT "PremiumType_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PremiumType" ADD CONSTRAINT "PremiumType_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PremiumType" ADD CONSTRAINT "PremiumType_deactivatedById_fkey" FOREIGN KEY ("deactivatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
