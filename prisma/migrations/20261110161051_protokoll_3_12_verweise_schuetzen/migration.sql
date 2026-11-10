-- DropForeignKey
ALTER TABLE "AuditEntry" DROP CONSTRAINT "AuditEntry_actingAsRoleAssignmentId_fkey";

-- DropForeignKey
ALTER TABLE "AuditEntry" DROP CONSTRAINT "AuditEntry_actorUserId_fkey";

-- DropForeignKey
ALTER TABLE "AuditEntry" DROP CONSTRAINT "AuditEntry_delegationId_fkey";

-- AddForeignKey
ALTER TABLE "AuditEntry" ADD CONSTRAINT "AuditEntry_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEntry" ADD CONSTRAINT "AuditEntry_actingAsRoleAssignmentId_fkey" FOREIGN KEY ("actingAsRoleAssignmentId") REFERENCES "RoleAssignment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEntry" ADD CONSTRAINT "AuditEntry_delegationId_fkey" FOREIGN KEY ("delegationId") REFERENCES "Delegation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
