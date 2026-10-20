/**
 * Lädt den handelnden Benutzer aus der Datenbank und baut daraus das Subjekt
 * der Prüffunktion (SPEC 2, 2.4, 3.11).
 *
 * Alles, was über Rechte entscheidet, läuft über `buildSubject` in
 * lib/authz/grants.ts — diese Datei liest nur Daten.
 */
import { buildSubject, type RoleAssignmentRecord } from '../authz/grants'
import type { Subject } from '../authz/check'
import type { RoleCode, TenantType } from '../authz/roles'
import { prisma } from '../prisma'

export interface LoadedIdentity {
  readonly subject: Subject
  readonly user: {
    readonly id: string
    readonly userNumber: string
    readonly givenName: string
    readonly familyName: string
    readonly loginIdentifier: string
  }
  readonly tenant: {
    readonly id: string
    readonly displayName: string
    readonly tenantType: TenantType
  }
}

export async function loadIdentity(
  userId: string,
  evaluationDate: Date = new Date(),
): Promise<LoadedIdentity | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      tenant: true,
      roleAssignments: { include: { responsibilityScopes: true } },
      accountAssignments: true,
      delegationsAsDelegate: {
        include: { delegatedRoleAssignment: { include: { responsibilityScopes: true } } },
      },
    },
  })
  if (user === null) return null

  const toRecord = (assignment: {
    id: string
    userId: string
    roleCode: string
    tenantId: string
    validFrom: Date
    validTo: Date | null
    deactivatedAt: Date | null
    responsibilityScopes: { scopeType: string; scopeRef: string }[]
  }): RoleAssignmentRecord => ({
    id: assignment.id,
    userId: assignment.userId,
    roleCode: assignment.roleCode as RoleCode,
    tenantId: assignment.tenantId,
    validFrom: assignment.validFrom,
    validTo: assignment.validTo,
    deactivatedAt: assignment.deactivatedAt,
    responsibilityScopes: assignment.responsibilityScopes.map((scope) => ({
      scopeType: scope.scopeType as 'site' | 'costCenter',
      scopeRef: scope.scopeRef,
    })),
  })

  const subject = buildSubject({
    user: { id: user.id, tenantId: user.tenantId, deactivatedAt: user.deactivatedAt },
    tenant: {
      id: user.tenant.id,
      tenantType: user.tenant.tenantType as TenantType,
      deactivatedAt: user.tenant.deactivatedAt,
    },
    ownRoleAssignments: user.roleAssignments.map(toRecord),
    delegationsAsDelegate: user.delegationsAsDelegate.map((delegation) => ({
      id: delegation.id,
      delegatedRoleAssignmentId: delegation.delegatedRoleAssignmentId,
      delegateUserId: delegation.delegateUserId,
      tenantId: delegation.tenantId,
      periodFrom: delegation.periodFrom,
      periodTo: delegation.periodTo,
      revokedAt: delegation.revokedAt,
      deactivatedAt: delegation.deactivatedAt,
    })),
    delegatedRoleAssignments: user.delegationsAsDelegate.map((delegation) =>
      toRecord(delegation.delegatedRoleAssignment),
    ),
    accountAssignments: user.accountAssignments.map((assignment) => ({
      userId: assignment.userId,
      customerTenantId: assignment.customerTenantId,
      validFrom: assignment.validFrom,
      validTo: assignment.validTo,
      deactivatedAt: assignment.deactivatedAt,
    })),
    evaluationDate,
  })

  return {
    subject,
    user: {
      id: user.id,
      userNumber: user.userNumber,
      givenName: user.givenName,
      familyName: user.familyName,
      loginIdentifier: user.loginIdentifier,
    },
    tenant: {
      id: user.tenant.id,
      displayName: user.tenant.displayName,
      tenantType: user.tenant.tenantType as TenantType,
    },
  }
}
