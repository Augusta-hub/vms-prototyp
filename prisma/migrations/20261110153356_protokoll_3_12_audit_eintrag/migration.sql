-- CreateEnum
CREATE TYPE "AuditOperation" AS ENUM ('create', 'read', 'update', 'transition', 'delete');

-- CreateEnum
CREATE TYPE "AuditResult" AS ENUM ('success', 'denied', 'blocked');

-- CreateTable
CREATE TABLE "AuditEntry" (
    "id" TEXT NOT NULL,
    "entryNumber" INTEGER NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "actorUserId" TEXT,
    "systemActor" TEXT,
    "actingAsRoleAssignmentId" TEXT,
    "delegationId" TEXT,
    "tenantId" TEXT NOT NULL,
    "objectType" TEXT NOT NULL,
    "objectRef" TEXT NOT NULL,
    "operation" "AuditOperation" NOT NULL,
    "statusFrom" TEXT,
    "statusTo" TEXT,
    "changedFields" JSONB,
    "reason" TEXT,
    "ruleRef" TEXT,
    "result" "AuditResult" NOT NULL,
    "crossTenant" BOOLEAN NOT NULL DEFAULT false,
    "clientContext" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditSequence" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "lastEntryNumber" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "AuditSequence_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AuditEntry_entryNumber_key" ON "AuditEntry"("entryNumber");

-- CreateIndex
CREATE INDEX "AuditEntry_tenantId_idx" ON "AuditEntry"("tenantId");

-- CreateIndex
CREATE INDEX "AuditEntry_objectType_objectRef_idx" ON "AuditEntry"("objectType", "objectRef");

-- CreateIndex
CREATE INDEX "AuditEntry_actorUserId_idx" ON "AuditEntry"("actorUserId");

-- CreateIndex
CREATE INDEX "AuditEntry_occurredAt_idx" ON "AuditEntry"("occurredAt");

-- AddForeignKey
ALTER TABLE "AuditEntry" ADD CONSTRAINT "AuditEntry_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEntry" ADD CONSTRAINT "AuditEntry_actingAsRoleAssignmentId_fkey" FOREIGN KEY ("actingAsRoleAssignmentId") REFERENCES "RoleAssignment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEntry" ADD CONSTRAINT "AuditEntry_delegationId_fkey" FOREIGN KEY ("delegationId") REFERENCES "Delegation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEntry" ADD CONSTRAINT "AuditEntry_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ───────────────────────────────────────────────────────────────────────────
-- Unveränderlichkeit des Protokolls (SPEC 3.12)
--
-- „Audit-Einträge entstehen ausschließlich durch das System und sind für jede
-- Rolle unveränderlich — deshalb kein `Ä` und kein `X` in 2.2 ([39]). Eine
-- Korrektur erzeugt einen neuen Eintrag; der alte bleibt stehen."
--
-- Die Matrix verweigert Ändern und Löschen schon in der Anwendung. Der Trigger
-- ist die zweite, unabhängige Schicht: er greift auch dann, wenn ein Dienst
-- die Prüfung umgeht oder jemand unmittelbar auf der Datenbank arbeitet. Ohne
-- ihn wäre die Unveränderlichkeit eine Zusage der Anwendung über sich selbst.
-- ───────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION "auditEntryIsImmutable"() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION
    'SPEC 3.12: Audit-Eintraege sind unveraenderlich; % ist nicht zulaessig. Eine Korrektur erzeugt einen neuen Eintrag.',
    TG_OP;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "auditEntryNoUpdate"
  BEFORE UPDATE ON "AuditEntry"
  FOR EACH ROW EXECUTE FUNCTION "auditEntryIsImmutable"();

CREATE TRIGGER "auditEntryNoDelete"
  BEFORE DELETE ON "AuditEntry"
  FOR EACH ROW EXECUTE FUNCTION "auditEntryIsImmutable"();

-- Der Zähler aus 3.12 („fortlaufend, lückenlos"): genau eine Zeile, die jeder
-- schreibende Vorgang sperrt. Sie entsteht mit der Migration, damit kein
-- Vorgang sie anlegen muss.
INSERT INTO "AuditSequence" ("id", "lastEntryNumber") VALUES (1, 0) ON CONFLICT ("id") DO NOTHING;
