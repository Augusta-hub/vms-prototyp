-- Abrechnung (SPEC 3.9) und das Statusmodell 4.5: Abrechnungsbeleg,
-- Belegposition, Nummernkreis je Belegart. Die Abrechnungsperiode steht seit
-- der Zeiterfassung; ihr **Schluss** (4.5.1) braucht kein neues Feld.

-- CreateEnum
CREATE TYPE "BillingDocumentType" AS ENUM ('customerInvoice', 'supplierCreditNote', 'supplierInvoice');

-- CreateEnum
CREATE TYPE "BillingDirection" AS ENUM ('sales', 'purchase');

-- CreateEnum
CREATE TYPE "BillingDocumentStatus" AS ENUM ('created', 'inReview', 'released', 'disputed', 'confirmed', 'cancelled');

-- CreateEnum
CREATE TYPE "BillingItemUnit" AS ENUM ('hour');

-- AlterTable
--
-- SPEC 3.3 fuehrt die Zuschlagsart der Preisposition als **Verweis** (3.8).
-- Bis zum Katalog aus 3.8 stand dort ein benannter Skalar; mit dem Katalog
-- wird daraus der Fremdschluessel, den 3.3 immer gemeint hat. Die vorhandenen
-- Werte werden **ueber den Namen aufgeloest** und nicht verworfen: ein
-- stillschweigender Verlust der Zuordnung waere ein Preisfehler.
ALTER TABLE "RateCardItem" ADD COLUMN     "premiumTypeId" TEXT;

UPDATE "RateCardItem" AS i
SET "premiumTypeId" = t."id"
FROM "PremiumType" AS t
WHERE i."premiumTypeRef" IS NOT NULL
  AND (t."name" = i."premiumTypeRef" OR t."code" = i."premiumTypeRef");

ALTER TABLE "RateCardItem" DROP COLUMN "premiumTypeRef";

-- CreateTable
CREATE TABLE "BillingNumberRange" (
    "documentType" "BillingDocumentType" NOT NULL,
    "lastNumber" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3),

    CONSTRAINT "BillingNumberRange_pkey" PRIMARY KEY ("documentType")
);

-- CreateTable
CREATE TABLE "BillingDocument" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "documentNumber" TEXT NOT NULL,
    "documentType" "BillingDocumentType" NOT NULL,
    "direction" "BillingDirection" NOT NULL,
    "customerId" TEXT,
    "supplierId" TEXT,
    "billingPeriodId" TEXT NOT NULL,
    "issueDate" TIMESTAMP(3) NOT NULL,
    "netAmount" DECIMAL(14,4) NOT NULL,
    "taxAmount" DECIMAL(14,4) NOT NULL,
    "grossAmount" DECIMAL(14,4) NOT NULL,
    "taxRate" DECIMAL(6,4) NOT NULL,
    "currency" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "releasedAt" TIMESTAMP(3),
    "releasedById" TEXT,
    "disputeReason" TEXT,
    "disputedAt" TIMESTAMP(3),
    "disputedById" TEXT,
    "disputeResolutionNote" TEXT,
    "confirmedAt" TIMESTAMP(3),
    "confirmedById" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "cancelledById" TEXT,
    "cancellationReason" TEXT,
    "cancellationOfId" TEXT,
    "status" "BillingDocumentStatus" NOT NULL,
    "externalReference" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),
    "updatedById" TEXT,
    "deactivatedAt" TIMESTAMP(3),
    "deactivatedById" TEXT,

    CONSTRAINT "BillingDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BillingDocumentItem" (
    "id" TEXT NOT NULL,
    "billingDocumentId" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "timesheetId" TEXT NOT NULL,
    "premiumTypeId" TEXT,
    "quantity" DECIMAL(10,4) NOT NULL,
    "unit" "BillingItemUnit" NOT NULL,
    "unitPrice" DECIMAL(12,4) NOT NULL,
    "amount" DECIMAL(14,4) NOT NULL,
    "rateCardItemId" TEXT,
    "costCenterId" TEXT,
    "externalReference" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT,
    "updatedAt" TIMESTAMP(3),

    CONSTRAINT "BillingDocumentItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_BillingDocumentTimesheets" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_BillingDocumentTimesheets_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "BillingDocument_documentNumber_key" ON "BillingDocument"("documentNumber");

-- CreateIndex
CREATE UNIQUE INDEX "BillingDocument_cancellationOfId_key" ON "BillingDocument"("cancellationOfId");

-- CreateIndex
CREATE INDEX "BillingDocument_tenantId_idx" ON "BillingDocument"("tenantId");

-- CreateIndex
CREATE INDEX "BillingDocument_billingPeriodId_idx" ON "BillingDocument"("billingPeriodId");

-- CreateIndex
CREATE INDEX "BillingDocument_customerId_idx" ON "BillingDocument"("customerId");

-- CreateIndex
CREATE INDEX "BillingDocument_supplierId_idx" ON "BillingDocument"("supplierId");

-- CreateIndex
CREATE INDEX "BillingDocument_status_idx" ON "BillingDocument"("status");

-- CreateIndex
CREATE INDEX "BillingDocumentItem_billingDocumentId_idx" ON "BillingDocumentItem"("billingDocumentId");

-- CreateIndex
CREATE INDEX "BillingDocumentItem_timesheetId_idx" ON "BillingDocumentItem"("timesheetId");

-- CreateIndex
CREATE INDEX "BillingDocumentItem_assignmentId_idx" ON "BillingDocumentItem"("assignmentId");

-- CreateIndex
CREATE UNIQUE INDEX "BillingDocumentItem_billingDocumentId_timesheetId_premiumTy_key" ON "BillingDocumentItem"("billingDocumentId", "timesheetId", "premiumTypeId");

-- CreateIndex
CREATE INDEX "_BillingDocumentTimesheets_B_index" ON "_BillingDocumentTimesheets"("B");

-- AddForeignKey
ALTER TABLE "RateCardItem" ADD CONSTRAINT "RateCardItem_premiumTypeId_fkey" FOREIGN KEY ("premiumTypeId") REFERENCES "PremiumType"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingDocument" ADD CONSTRAINT "BillingDocument_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingDocument" ADD CONSTRAINT "BillingDocument_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingDocument" ADD CONSTRAINT "BillingDocument_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingDocument" ADD CONSTRAINT "BillingDocument_billingPeriodId_fkey" FOREIGN KEY ("billingPeriodId") REFERENCES "BillingPeriod"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingDocument" ADD CONSTRAINT "BillingDocument_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingDocument" ADD CONSTRAINT "BillingDocument_releasedById_fkey" FOREIGN KEY ("releasedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingDocument" ADD CONSTRAINT "BillingDocument_disputedById_fkey" FOREIGN KEY ("disputedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingDocument" ADD CONSTRAINT "BillingDocument_confirmedById_fkey" FOREIGN KEY ("confirmedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingDocument" ADD CONSTRAINT "BillingDocument_cancelledById_fkey" FOREIGN KEY ("cancelledById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingDocument" ADD CONSTRAINT "BillingDocument_cancellationOfId_fkey" FOREIGN KEY ("cancellationOfId") REFERENCES "BillingDocument"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingDocument" ADD CONSTRAINT "BillingDocument_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingDocument" ADD CONSTRAINT "BillingDocument_deactivatedById_fkey" FOREIGN KEY ("deactivatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingDocumentItem" ADD CONSTRAINT "BillingDocumentItem_billingDocumentId_fkey" FOREIGN KEY ("billingDocumentId") REFERENCES "BillingDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingDocumentItem" ADD CONSTRAINT "BillingDocumentItem_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "Assignment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingDocumentItem" ADD CONSTRAINT "BillingDocumentItem_timesheetId_fkey" FOREIGN KEY ("timesheetId") REFERENCES "Timesheet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingDocumentItem" ADD CONSTRAINT "BillingDocumentItem_premiumTypeId_fkey" FOREIGN KEY ("premiumTypeId") REFERENCES "PremiumType"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingDocumentItem" ADD CONSTRAINT "BillingDocumentItem_rateCardItemId_fkey" FOREIGN KEY ("rateCardItemId") REFERENCES "RateCardItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingDocumentItem" ADD CONSTRAINT "BillingDocumentItem_costCenterId_fkey" FOREIGN KEY ("costCenterId") REFERENCES "CostCenter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingDocumentItem" ADD CONSTRAINT "BillingDocumentItem_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_BillingDocumentTimesheets" ADD CONSTRAINT "_BillingDocumentTimesheets_A_fkey" FOREIGN KEY ("A") REFERENCES "BillingDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_BillingDocumentTimesheets" ADD CONSTRAINT "_BillingDocumentTimesheets_B_fkey" FOREIGN KEY ("B") REFERENCES "Timesheet"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Je Beleg und Zettel **eine** Grundleistungsposition.
--
-- Der Index aus dem Datenmodell deckt nur die Zuschlagspositionen: in SQL sind
-- zwei `NULL` verschieden, zwei Grundleistungspositionen zum selben Zettel
-- also erlaubt. Genau das soll nicht sein — eine doppelte Grundleistung ist
-- eine doppelte Abrechnung derselben Stunden (3.9). Ein **partieller** Index
-- schliesst die Luecke; Prisma kann ihn nicht ausdruecken.
CREATE UNIQUE INDEX "BillingDocumentItem_grundleistung_key"
  ON "BillingDocumentItem" ("billingDocumentId", "timesheetId")
  WHERE "premiumTypeId" IS NULL;

-- Die Nummernkreise (3.9: „Nummernkreise je Belegart"). Sie entstehen hier und
-- nicht beim ersten Beleg, damit die Zeile vorhanden ist, wenn sie gesperrt
-- wird; der Dienst legt sie zusaetzlich an, falls eine fehlt.
INSERT INTO "BillingNumberRange" ("documentType", "lastNumber")
VALUES ('customerInvoice', 0), ('supplierCreditNote', 0), ('supplierInvoice', 0)
ON CONFLICT ("documentType") DO NOTHING;
