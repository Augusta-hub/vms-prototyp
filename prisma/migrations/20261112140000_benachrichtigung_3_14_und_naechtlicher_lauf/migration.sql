-- Benachrichtigung und Eskalation (SPEC 3.14) und das Protokoll des
-- naechtlichen Laufs (5.5.1 c).

-- CreateEnum
CREATE TYPE "NotificationKind" AS ENUM ('information', 'warning', 'escalation');

-- CreateEnum
CREATE TYPE "NotificationTrigger" AS ENUM ('permitExpiry', 'maxDurationThreshold', 'equalPayThreshold', 'documentExpiry', 'interruptionThreshold', 'timesheetNotSubmitted', 'timesheetNotApproved', 'billingDocumentDisputed');

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "trigger" "NotificationTrigger" NOT NULL,
    "kind" "NotificationKind" NOT NULL,
    "objectType" TEXT NOT NULL,
    "objectRef" TEXT NOT NULL,
    "recipientRoleCode" "RoleCode" NOT NULL,
    "recipientTenantId" TEXT NOT NULL,
    "escalationLevel" INTEGER NOT NULL,
    "ruleRef" TEXT,
    "message" TEXT NOT NULL,
    "raisedAt" TIMESTAMP(3) NOT NULL,
    "runDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NightlyRuleRun" (
    "id" TEXT NOT NULL,
    "runDate" TIMESTAMP(3) NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "checked" INTEGER NOT NULL,
    "informations" INTEGER NOT NULL,
    "warnings" INTEGER NOT NULL,
    "escalations" INTEGER NOT NULL,
    "notifications" INTEGER NOT NULL,
    "startedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NightlyRuleRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Notification_recipientTenantId_recipientRoleCode_idx" ON "Notification"("recipientTenantId", "recipientRoleCode");

-- CreateIndex
CREATE INDEX "Notification_tenantId_idx" ON "Notification"("tenantId");

-- CreateIndex
CREATE INDEX "Notification_runDate_idx" ON "Notification"("runDate");

-- CreateIndex
CREATE UNIQUE INDEX "Notification_trigger_objectRef_recipientRoleCode_recipientT_key" ON "Notification"("trigger", "objectRef", "recipientRoleCode", "recipientTenantId", "escalationLevel", "runDate");

-- CreateIndex
CREATE UNIQUE INDEX "NightlyRuleRun_runDate_key" ON "NightlyRuleRun"("runDate");

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_recipientTenantId_fkey" FOREIGN KEY ("recipientTenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NightlyRuleRun" ADD CONSTRAINT "NightlyRuleRun_startedById_fkey" FOREIGN KEY ("startedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Je Anlass, Vorgang, Adressat und Stufe **eine** Benachrichtigung aus einem
-- Uebergang.
--
-- Der Index aus dem Datenmodell deckt nur die Benachrichtigungen des
-- naechtlichen Laufs: in SQL sind zwei `NULL` verschieden, zwei
-- Benachrichtigungen ohne `runDate` also erlaubt. Genau das soll nicht sein —
-- dieselbe Nachricht zweimal ist keine zweite Benachrichtigung, sondern eine
-- falsche (3.14, Eindeutigkeit). Ein **partieller** Index schliesst die
-- Luecke; Prisma kann ihn nicht ausdruecken.
CREATE UNIQUE INDEX "Notification_ohne_lauf_key"
  ON "Notification" ("trigger", "objectRef", "recipientRoleCode", "recipientTenantId", "escalationLevel")
  WHERE "runDate" IS NULL;
