-- Die vier Fristanlaesse aus 2.4, die der naechtliche Lauf bisher nicht kannte,
-- und der Einreichungszeitpunkt der Bedarfsanfrage (SPEC 3.4, 4.0).

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationTrigger" ADD VALUE 'demandApprovalOverdue';
ALTER TYPE "NotificationTrigger" ADD VALUE 'tenderNoOffer';
ALTER TYPE "NotificationTrigger" ADD VALUE 'submissionFeedbackOverdue';
ALTER TYPE "NotificationTrigger" ADD VALUE 'extensionApprovalOverdue';

-- AlterTable
ALTER TABLE "DemandRequest" ADD COLUMN     "submittedAt" TIMESTAMP(3);

