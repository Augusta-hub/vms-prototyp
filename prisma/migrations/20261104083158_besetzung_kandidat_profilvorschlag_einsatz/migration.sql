-- CreateEnum
CREATE TYPE "EmploymentStatusWithSupplier" AS ENUM ('employed', 'applicant');

-- CreateEnum
CREATE TYPE "CandidateStatus" AS ENUM ('active', 'inactive');

-- CreateEnum
CREATE TYPE "DisclosureLevel" AS ENUM ('pseudonymized', 'identified');

-- CreateEnum
CREATE TYPE "CandidateSubmissionStatus" AS ENUM ('draft', 'submitted', 'reviewed', 'releasedToCustomer', 'interviewScheduled', 'accepted', 'rejected', 'withdrawn');

-- CreateEnum
CREATE TYPE "SubmissionDecision" AS ENUM ('accepted', 'rejected');

-- CreateEnum
CREATE TYPE "IdentityLinkStatus" AS ENUM ('proposed', 'confirmed', 'detached');

-- CreateEnum
CREATE TYPE "IdentityMergeAction" AS ENUM ('proposed', 'confirmed', 'detached');

-- CreateEnum
CREATE TYPE "AssignmentStatus" AS ENUM ('planned', 'active', 'interrupted', 'completed', 'terminatedEarly');

-- CreateEnum
CREATE TYPE "AssignmentExtensionStatus" AS ENUM ('requested', 'approved', 'rejected', 'effective', 'withdrawn');

-- CreateEnum
CREATE TYPE "RuleCheckResult" AS ENUM ('information', 'warning', 'block');

-- CreateTable
CREATE TABLE "Candidate" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "candidateNumber" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "givenName" TEXT NOT NULL,
    "familyName" TEXT NOT NULL,
    "dateOfBirth" TIMESTAMP(3) NOT NULL,
    "placeOfBirth" TEXT,
    "contactEmail" TEXT,
    "contactPhone" TEXT,
    "pseudonym" TEXT NOT NULL,
    "employmentStatusWithSupplier" "EmploymentStatusWithSupplier" NOT NULL,
    "employedSince" TIMESTAMP(3),
    "workPermitRequired" BOOLEAN NOT NULL,
    "previousEmploymentDeclaredAt" TIMESTAMP(3),
    "previousEmploymentExisted" BOOLEAN,
    "previousEmploymentEndedOn" TIMESTAMP(3),
    "previousEmploymentEmployer" TEXT,
    "workerIdentityId" TEXT,
    "status" "CandidateStatus" NOT NULL,
    "externalReference" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT,
    "updatedAt" TIMESTAMP(3),
    "updatedById" TEXT,
    "deactivatedAt" TIMESTAMP(3),
    "deactivatedById" TEXT,

    CONSTRAINT "Candidate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CandidateQualification" (
    "id" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "qualification" TEXT NOT NULL,
    "documentRef" TEXT,
    "externalReference" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT,
    "updatedAt" TIMESTAMP(3),
    "updatedById" TEXT,
    "deactivatedAt" TIMESTAMP(3),
    "deactivatedById" TEXT,

    CONSTRAINT "CandidateQualification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CandidateSubmission" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "submissionNumber" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "supplierOfferId" TEXT NOT NULL,
    "demandRequestId" TEXT NOT NULL,
    "submittedAt" TIMESTAMP(3),
    "availableFrom" TIMESTAMP(3) NOT NULL,
    "offeredHourlyRate" DECIMAL(12,4),
    "currency" TEXT,
    "disclosureLevel" "DisclosureLevel" NOT NULL,
    "releasedToCustomerAt" TIMESTAMP(3),
    "interviewScheduledAt" TIMESTAMP(3),
    "decision" "SubmissionDecision",
    "decisionReason" TEXT,
    "decidedAt" TIMESTAMP(3),
    "decidedById" TEXT,
    "withdrawnAt" TIMESTAMP(3),
    "status" "CandidateSubmissionStatus" NOT NULL,
    "externalReference" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT,
    "updatedAt" TIMESTAMP(3),
    "updatedById" TEXT,
    "deactivatedAt" TIMESTAMP(3),
    "deactivatedById" TEXT,

    CONSTRAINT "CandidateSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkerIdentity" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "identityNumber" TEXT NOT NULL,
    "matchGivenName" TEXT NOT NULL,
    "matchFamilyName" TEXT NOT NULL,
    "matchDateOfBirth" TIMESTAMP(3) NOT NULL,
    "matchPlaceOfBirth" TEXT,
    "confirmedAt" TIMESTAMP(3),
    "confirmedById" TEXT,
    "externalReference" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT,
    "updatedAt" TIMESTAMP(3),
    "updatedById" TEXT,
    "deactivatedAt" TIMESTAMP(3),
    "deactivatedById" TEXT,

    CONSTRAINT "WorkerIdentity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkerIdentityLink" (
    "id" TEXT NOT NULL,
    "workerIdentityId" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "linkStatus" "IdentityLinkStatus" NOT NULL,
    "proposalBasis" TEXT NOT NULL,
    "proposedAt" TIMESTAMP(3) NOT NULL,
    "confirmedAt" TIMESTAMP(3),
    "confirmedById" TEXT,
    "detachedAt" TIMESTAMP(3),
    "detachedById" TEXT,
    "reason" TEXT,
    "externalReference" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT,
    "updatedAt" TIMESTAMP(3),
    "updatedById" TEXT,
    "deactivatedAt" TIMESTAMP(3),
    "deactivatedById" TEXT,

    CONSTRAINT "WorkerIdentityLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkerIdentityMergeEntry" (
    "id" TEXT NOT NULL,
    "workerIdentityId" TEXT NOT NULL,
    "candidateId" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "action" "IdentityMergeAction" NOT NULL,
    "reason" TEXT NOT NULL,
    "actedById" TEXT,
    "externalReference" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT,
    "updatedAt" TIMESTAMP(3),
    "updatedById" TEXT,

    CONSTRAINT "WorkerIdentityMergeEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Assignment" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "assignmentNumber" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "costCenterId" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "workerIdentityId" TEXT,
    "demandRequestId" TEXT,
    "candidateSubmissionId" TEXT,
    "activityDescription" TEXT NOT NULL,
    "plannedStartDate" TIMESTAMP(3) NOT NULL,
    "plannedEndDate" TIMESTAMP(3),
    "actualStartDate" TIMESTAMP(3),
    "actualEndDate" TIMESTAMP(3),
    "weeklyHours" DECIMAL(5,2) NOT NULL,
    "shiftModel" TEXT,
    "agreedRateCardItemId" TEXT NOT NULL,
    "agreedHourlyRate" DECIMAL(12,4),
    "currency" TEXT,
    "rateDeviationReason" TEXT,
    "customerRateCardItemId" TEXT NOT NULL,
    "comparableWage" DECIMAL(12,4),
    "comparableWageCurrency" TEXT,
    "comparableWageDeviationReason" TEXT,
    "equalPayDueDate" TIMESTAMP(3),
    "maxDurationEndDate" TIMESTAMP(3),
    "countedDurationDays" INTEGER,
    "terminationReason" TEXT,
    "terminationRequestedById" TEXT,
    "terminationRequestedAt" TIMESTAMP(3),
    "terminationApprovedAt" TIMESTAMP(3),
    "terminationApprovedById" TEXT,
    "status" "AssignmentStatus" NOT NULL,
    "externalReference" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT,
    "updatedAt" TIMESTAMP(3),
    "updatedById" TEXT,
    "deactivatedAt" TIMESTAMP(3),
    "deactivatedById" TEXT,

    CONSTRAINT "Assignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssignmentExtension" (
    "id" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "newEndDate" TIMESTAMP(3) NOT NULL,
    "reason" TEXT NOT NULL,
    "requestedAt" TIMESTAMP(3) NOT NULL,
    "requestedById" TEXT NOT NULL,
    "approvedAt" TIMESTAMP(3),
    "approvedById" TEXT,
    "effectiveAt" TIMESTAMP(3),
    "effectiveById" TEXT,
    "rejectionReason" TEXT,
    "withdrawnAt" TIMESTAMP(3),
    "ruleCheckResult" "RuleCheckResult",
    "status" "AssignmentExtensionStatus" NOT NULL,
    "externalReference" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT,
    "updatedAt" TIMESTAMP(3),
    "updatedById" TEXT,
    "deactivatedAt" TIMESTAMP(3),
    "deactivatedById" TEXT,

    CONSTRAINT "AssignmentExtension_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssignmentInterruption" (
    "id" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "interruptionFrom" TIMESTAMP(3) NOT NULL,
    "interruptionTo" TIMESTAMP(3),
    "reasonCategory" TEXT NOT NULL,
    "reasonText" TEXT,
    "countsAsReset" BOOLEAN,
    "externalReference" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT,
    "updatedAt" TIMESTAMP(3),
    "updatedById" TEXT,
    "deactivatedAt" TIMESTAMP(3),
    "deactivatedById" TEXT,

    CONSTRAINT "AssignmentInterruption_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Candidate_tenantId_idx" ON "Candidate"("tenantId");

-- CreateIndex
CREATE INDEX "Candidate_workerIdentityId_idx" ON "Candidate"("workerIdentityId");

-- CreateIndex
CREATE INDEX "Candidate_familyName_dateOfBirth_idx" ON "Candidate"("familyName", "dateOfBirth");

-- CreateIndex
CREATE UNIQUE INDEX "Candidate_supplierId_candidateNumber_key" ON "Candidate"("supplierId", "candidateNumber");

-- CreateIndex
CREATE INDEX "CandidateQualification_candidateId_idx" ON "CandidateQualification"("candidateId");

-- CreateIndex
CREATE INDEX "CandidateSubmission_candidateId_idx" ON "CandidateSubmission"("candidateId");

-- CreateIndex
CREATE INDEX "CandidateSubmission_supplierOfferId_idx" ON "CandidateSubmission"("supplierOfferId");

-- CreateIndex
CREATE INDEX "CandidateSubmission_demandRequestId_idx" ON "CandidateSubmission"("demandRequestId");

-- CreateIndex
CREATE INDEX "CandidateSubmission_status_idx" ON "CandidateSubmission"("status");

-- CreateIndex
CREATE UNIQUE INDEX "CandidateSubmission_tenantId_submissionNumber_key" ON "CandidateSubmission"("tenantId", "submissionNumber");

-- CreateIndex
CREATE UNIQUE INDEX "WorkerIdentity_identityNumber_key" ON "WorkerIdentity"("identityNumber");

-- CreateIndex
CREATE INDEX "WorkerIdentity_tenantId_idx" ON "WorkerIdentity"("tenantId");

-- CreateIndex
CREATE INDEX "WorkerIdentity_matchFamilyName_matchDateOfBirth_idx" ON "WorkerIdentity"("matchFamilyName", "matchDateOfBirth");

-- CreateIndex
CREATE INDEX "WorkerIdentityLink_candidateId_idx" ON "WorkerIdentityLink"("candidateId");

-- CreateIndex
CREATE INDEX "WorkerIdentityLink_linkStatus_idx" ON "WorkerIdentityLink"("linkStatus");

-- CreateIndex
CREATE UNIQUE INDEX "WorkerIdentityLink_workerIdentityId_candidateId_key" ON "WorkerIdentityLink"("workerIdentityId", "candidateId");

-- CreateIndex
CREATE INDEX "WorkerIdentityMergeEntry_workerIdentityId_idx" ON "WorkerIdentityMergeEntry"("workerIdentityId");

-- CreateIndex
CREATE INDEX "WorkerIdentityMergeEntry_candidateId_idx" ON "WorkerIdentityMergeEntry"("candidateId");

-- CreateIndex
CREATE UNIQUE INDEX "Assignment_assignmentNumber_key" ON "Assignment"("assignmentNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Assignment_candidateSubmissionId_key" ON "Assignment"("candidateSubmissionId");

-- CreateIndex
CREATE INDEX "Assignment_tenantId_idx" ON "Assignment"("tenantId");

-- CreateIndex
CREATE INDEX "Assignment_customerId_idx" ON "Assignment"("customerId");

-- CreateIndex
CREATE INDEX "Assignment_candidateId_idx" ON "Assignment"("candidateId");

-- CreateIndex
CREATE INDEX "Assignment_workerIdentityId_idx" ON "Assignment"("workerIdentityId");

-- CreateIndex
CREATE INDEX "Assignment_supplierId_idx" ON "Assignment"("supplierId");

-- CreateIndex
CREATE INDEX "Assignment_status_idx" ON "Assignment"("status");

-- CreateIndex
CREATE INDEX "AssignmentExtension_assignmentId_idx" ON "AssignmentExtension"("assignmentId");

-- CreateIndex
CREATE INDEX "AssignmentExtension_status_idx" ON "AssignmentExtension"("status");

-- CreateIndex
CREATE INDEX "AssignmentInterruption_assignmentId_idx" ON "AssignmentInterruption"("assignmentId");

-- AddForeignKey
ALTER TABLE "Candidate" ADD CONSTRAINT "Candidate_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Candidate" ADD CONSTRAINT "Candidate_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Candidate" ADD CONSTRAINT "Candidate_workerIdentityId_fkey" FOREIGN KEY ("workerIdentityId") REFERENCES "WorkerIdentity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Candidate" ADD CONSTRAINT "Candidate_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Candidate" ADD CONSTRAINT "Candidate_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Candidate" ADD CONSTRAINT "Candidate_deactivatedById_fkey" FOREIGN KEY ("deactivatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CandidateQualification" ADD CONSTRAINT "CandidateQualification_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CandidateQualification" ADD CONSTRAINT "CandidateQualification_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CandidateQualification" ADD CONSTRAINT "CandidateQualification_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CandidateQualification" ADD CONSTRAINT "CandidateQualification_deactivatedById_fkey" FOREIGN KEY ("deactivatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CandidateSubmission" ADD CONSTRAINT "CandidateSubmission_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CandidateSubmission" ADD CONSTRAINT "CandidateSubmission_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CandidateSubmission" ADD CONSTRAINT "CandidateSubmission_supplierOfferId_fkey" FOREIGN KEY ("supplierOfferId") REFERENCES "SupplierOffer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CandidateSubmission" ADD CONSTRAINT "CandidateSubmission_demandRequestId_fkey" FOREIGN KEY ("demandRequestId") REFERENCES "DemandRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CandidateSubmission" ADD CONSTRAINT "CandidateSubmission_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CandidateSubmission" ADD CONSTRAINT "CandidateSubmission_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CandidateSubmission" ADD CONSTRAINT "CandidateSubmission_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CandidateSubmission" ADD CONSTRAINT "CandidateSubmission_deactivatedById_fkey" FOREIGN KEY ("deactivatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkerIdentity" ADD CONSTRAINT "WorkerIdentity_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkerIdentity" ADD CONSTRAINT "WorkerIdentity_confirmedById_fkey" FOREIGN KEY ("confirmedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkerIdentity" ADD CONSTRAINT "WorkerIdentity_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkerIdentity" ADD CONSTRAINT "WorkerIdentity_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkerIdentity" ADD CONSTRAINT "WorkerIdentity_deactivatedById_fkey" FOREIGN KEY ("deactivatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkerIdentityLink" ADD CONSTRAINT "WorkerIdentityLink_workerIdentityId_fkey" FOREIGN KEY ("workerIdentityId") REFERENCES "WorkerIdentity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkerIdentityLink" ADD CONSTRAINT "WorkerIdentityLink_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkerIdentityLink" ADD CONSTRAINT "WorkerIdentityLink_confirmedById_fkey" FOREIGN KEY ("confirmedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkerIdentityLink" ADD CONSTRAINT "WorkerIdentityLink_detachedById_fkey" FOREIGN KEY ("detachedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkerIdentityLink" ADD CONSTRAINT "WorkerIdentityLink_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkerIdentityLink" ADD CONSTRAINT "WorkerIdentityLink_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkerIdentityLink" ADD CONSTRAINT "WorkerIdentityLink_deactivatedById_fkey" FOREIGN KEY ("deactivatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkerIdentityMergeEntry" ADD CONSTRAINT "WorkerIdentityMergeEntry_workerIdentityId_fkey" FOREIGN KEY ("workerIdentityId") REFERENCES "WorkerIdentity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkerIdentityMergeEntry" ADD CONSTRAINT "WorkerIdentityMergeEntry_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkerIdentityMergeEntry" ADD CONSTRAINT "WorkerIdentityMergeEntry_actedById_fkey" FOREIGN KEY ("actedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkerIdentityMergeEntry" ADD CONSTRAINT "WorkerIdentityMergeEntry_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkerIdentityMergeEntry" ADD CONSTRAINT "WorkerIdentityMergeEntry_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_costCenterId_fkey" FOREIGN KEY ("costCenterId") REFERENCES "CostCenter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_workerIdentityId_fkey" FOREIGN KEY ("workerIdentityId") REFERENCES "WorkerIdentity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_demandRequestId_fkey" FOREIGN KEY ("demandRequestId") REFERENCES "DemandRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_candidateSubmissionId_fkey" FOREIGN KEY ("candidateSubmissionId") REFERENCES "CandidateSubmission"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_agreedRateCardItemId_fkey" FOREIGN KEY ("agreedRateCardItemId") REFERENCES "RateCardItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_customerRateCardItemId_fkey" FOREIGN KEY ("customerRateCardItemId") REFERENCES "RateCardItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_terminationRequestedById_fkey" FOREIGN KEY ("terminationRequestedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_terminationApprovedById_fkey" FOREIGN KEY ("terminationApprovedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_deactivatedById_fkey" FOREIGN KEY ("deactivatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssignmentExtension" ADD CONSTRAINT "AssignmentExtension_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "Assignment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssignmentExtension" ADD CONSTRAINT "AssignmentExtension_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssignmentExtension" ADD CONSTRAINT "AssignmentExtension_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssignmentExtension" ADD CONSTRAINT "AssignmentExtension_effectiveById_fkey" FOREIGN KEY ("effectiveById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssignmentExtension" ADD CONSTRAINT "AssignmentExtension_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssignmentExtension" ADD CONSTRAINT "AssignmentExtension_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssignmentExtension" ADD CONSTRAINT "AssignmentExtension_deactivatedById_fkey" FOREIGN KEY ("deactivatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssignmentInterruption" ADD CONSTRAINT "AssignmentInterruption_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "Assignment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssignmentInterruption" ADD CONSTRAINT "AssignmentInterruption_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssignmentInterruption" ADD CONSTRAINT "AssignmentInterruption_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssignmentInterruption" ADD CONSTRAINT "AssignmentInterruption_deactivatedById_fkey" FOREIGN KEY ("deactivatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
