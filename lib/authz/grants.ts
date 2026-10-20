/**
 * Wirksame Rechte eines Benutzers zu einem Stichtag — eigene Rollenzuweisungen
 * und Vertretungen (SPEC 2.4, 3.11).
 *
 * Diese Datei ist die **einzige** Stelle, die aus Daten `Grant`s baut. Dass
 * eine Vertretung keine Rechte erweitern kann (2.4, Regel 2), ist deshalb eine
 * Eigenschaft der Konstruktion und nicht eine Prüfung, die man vergessen kann:
 * ein Vertretungs-`Grant` übernimmt Rolle, Mandant und Zuständigkeiten
 * **unverändert** aus der vertretenen Rollenzuweisung.
 *
 * Geprüft werden hier die Bedingungen, die über mehrere Sätze hinweg gelten
 * und die die Datenbank nicht erzwingen kann:
 *
 *  - befristet und personenbezogen (2.4, Regel 1)
 *  - nur innerhalb einer Organisation (Regel 3)
 *  - keine Ketten (Regel 4) — ein Vertretungsrecht ist nie Grundlage einer
 *    weiteren Vertretung; zusätzlich verweigert Fußnote [45] das Einrichten
 *    einer Vertretung in Vertretung
 *  - nicht vertretbare Rollen (Regel 8)
 *  - Ende mit Ablauf des Zeitraums oder mit `revokedAt` (Regel 9)
 */
import type { Grant, ScopeRef, Subject } from './check'
import { NON_DELEGABLE_ROLES, type RoleCode, type TenantType } from './roles'

export interface UserRecord {
  readonly id: string
  readonly tenantId: string
  readonly deactivatedAt: Date | null
}

export interface TenantRecord {
  readonly id: string
  readonly tenantType: TenantType
  readonly deactivatedAt: Date | null
}

export interface RoleAssignmentRecord {
  readonly id: string
  readonly userId: string
  readonly roleCode: RoleCode
  readonly tenantId: string
  readonly validFrom: Date
  readonly validTo: Date | null
  readonly deactivatedAt: Date | null
  readonly responsibilityScopes: readonly ScopeRef[]
}

export interface DelegationRecord {
  readonly id: string
  readonly delegatedRoleAssignmentId: string
  readonly delegateUserId: string
  readonly tenantId: string
  readonly periodFrom: Date
  readonly periodTo: Date
  readonly revokedAt: Date | null
  readonly deactivatedAt: Date | null
}

export interface AccountAssignmentRecord {
  readonly userId: string
  readonly customerTenantId: string
  readonly validFrom: Date
  readonly validTo: Date | null
  readonly deactivatedAt: Date | null
}

export interface GrantInput {
  readonly user: UserRecord
  readonly tenant: TenantRecord
  /** Alle Rollenzuweisungen des Benutzers. */
  readonly ownRoleAssignments: readonly RoleAssignmentRecord[]
  /** Vertretungen, in denen dieser Benutzer der Vertreter ist. */
  readonly delegationsAsDelegate: readonly DelegationRecord[]
  /** Die vertretenen Rollenzuweisungen, in beliebiger Reihenfolge. */
  readonly delegatedRoleAssignments: readonly RoleAssignmentRecord[]
  readonly accountAssignments: readonly AccountAssignmentRecord[]
  /** Stichtag der Prüfung. Nie „heute" im Rechenweg, immer übergeben (5.0). */
  readonly evaluationDate: Date
}

/**
 * Baut den handelnden Benutzer samt seiner wirksamen Rechte.
 *
 * Ein deaktivierter Benutzer und ein deaktivierter Mandant haben keine Rechte:
 * „Deaktivierung sperrt alle Zugänge des Mandanten" (3.11).
 */
export function buildSubject(input: GrantInput): Subject {
  const blocked =
    isDeactivated(input.user.deactivatedAt, input.evaluationDate) ||
    isDeactivated(input.tenant.deactivatedAt, input.evaluationDate)

  return {
    userId: input.user.id,
    tenantId: input.user.tenantId,
    tenantType: input.tenant.tenantType,
    grants: blocked ? [] : effectiveGrants(input),
    accountAssignmentCustomerTenantIds: blocked
      ? []
      : input.accountAssignments
          .filter(
            (assignment) =>
              assignment.userId === input.user.id &&
              !isDeactivated(assignment.deactivatedAt, input.evaluationDate) &&
              isWithinPeriod(assignment.validFrom, assignment.validTo, input.evaluationDate),
          )
          .map((assignment) => assignment.customerTenantId),
  }
}

/** Eigene Rollenzuweisungen und Vertretungen zum Stichtag. */
export function effectiveGrants(input: GrantInput): readonly Grant[] {
  const own = input.ownRoleAssignments
    .filter(
      (assignment) =>
        assignment.userId === input.user.id &&
        assignment.tenantId === input.user.tenantId &&
        isActiveAssignment(assignment, input.evaluationDate),
    )
    .map(toGrant)

  const delegated = input.delegationsAsDelegate
    .filter((delegation) => isEffectiveDelegation(delegation, input))
    .flatMap((delegation) => {
      const assignment = input.delegatedRoleAssignments.find(
        (candidate) => candidate.id === delegation.delegatedRoleAssignmentId,
      )
      if (assignment === undefined) return []
      // Die vertretene Zuweisung muss selbst wirksam sein: eine Vertretung
      // kann ein abgelaufenes Recht nicht wiederbeleben (2.4, Regel 2).
      if (!isActiveAssignment(assignment, input.evaluationDate)) return []
      // Nur innerhalb einer Organisation (2.4, Regel 3).
      if (assignment.tenantId !== input.user.tenantId) return []
      if (delegation.tenantId !== input.user.tenantId) return []
      // Nicht vertretbare Rollen (2.4, Regel 8).
      if (NON_DELEGABLE_ROLES.includes(assignment.roleCode)) return []
      // Keine Rechteerweiterung: Rolle, Mandant und Zuständigkeiten kommen
      // unverändert aus der vertretenen Zuweisung (2.4, Regel 2).
      const grant: Grant = {
        ...toGrant(assignment),
        viaDelegation: {
          delegationId: delegation.id,
          delegatedUserId: assignment.userId,
        },
      }
      return [grant]
    })

  return [...own, ...delegated]
}

/**
 * Darf dieser Benutzer eine Vertretung für diese Rollenzuweisung einrichten?
 *
 * Deckt die Bedingungen ab, die vor dem Anlegen zu prüfen sind und die die
 * Prüffunktion aus der Matrix allein nicht sieht (2.4, Regeln 1 bis 4 und 8).
 * Die Rechtefrage selbst beantwortet `checkPermission` über die Zeile
 * „Vertretung" und die Fußnoten [45] bzw. [7].
 */
export function delegationViolations(candidate: {
  readonly delegatedRoleAssignment: RoleAssignmentRecord
  readonly delegateUser: UserRecord
  readonly periodFrom: Date | null
  readonly periodTo: Date | null
  /** Vertretungen, in denen der Vertreter selbst vertreten wird. */
  readonly delegateHeldDelegations?: readonly DelegationRecord[]
  readonly evaluationDate: Date
}): readonly string[] {
  const violations: string[] = []

  if (candidate.periodFrom === null || candidate.periodTo === null) {
    violations.push('Unbefristete Vertretungen gibt es nicht (2.4, Regel 1).')
  } else if (candidate.periodTo.getTime() < candidate.periodFrom.getTime()) {
    violations.push('Das Ende der Vertretung liegt vor ihrem Beginn (2.4, Regel 1).')
  }

  if (candidate.delegateUser.id === candidate.delegatedRoleAssignment.userId) {
    violations.push('Eine Rollenzuweisung wird nicht durch ihren eigenen Inhaber vertreten.')
  }

  if (candidate.delegateUser.tenantId !== candidate.delegatedRoleAssignment.tenantId) {
    violations.push(
      'Kein Vertreter über Kunden-, Lieferanten- oder Organisationsgrenzen hinweg (2.4, Regel 3).',
    )
  }

  if (NON_DELEGABLE_ROLES.includes(candidate.delegatedRoleAssignment.roleCode)) {
    violations.push('Diese Rolle ist nicht vertretbar (2.4, Regel 8).')
  }

  const chains = (candidate.delegateHeldDelegations ?? []).filter(
    (delegation) =>
      delegation.delegateUserId === candidate.delegateUser.id &&
      delegation.revokedAt === null &&
      delegation.deactivatedAt === null,
  )
  if (chains.length > 0) {
    violations.push('Ein Vertreter kann keinen Untervertreter bestimmen (2.4, Regel 4).')
  }

  return violations
}

function toGrant(assignment: RoleAssignmentRecord): Grant {
  return {
    roleAssignmentId: assignment.id,
    roleCode: assignment.roleCode,
    tenantId: assignment.tenantId,
    responsibilityScopes: assignment.responsibilityScopes,
  }
}

function isEffectiveDelegation(delegation: DelegationRecord, input: GrantInput): boolean {
  if (delegation.delegateUserId !== input.user.id) return false
  if (isDeactivated(delegation.deactivatedAt, input.evaluationDate)) return false
  // Vorzeitiges Ende: ab `revokedAt` wirkt die Vertretung nicht mehr (3.11).
  if (delegation.revokedAt !== null && delegation.revokedAt.getTime() <= input.evaluationDate.getTime()) {
    return false
  }
  // Befristet, mit Beginn und Ende; mit Ablauf enden die Rechte sofort
  // (2.4, Regeln 1 und 9).
  return isWithinPeriod(delegation.periodFrom, delegation.periodTo, input.evaluationDate)
}

function isActiveAssignment(assignment: RoleAssignmentRecord, evaluationDate: Date): boolean {
  if (isDeactivated(assignment.deactivatedAt, evaluationDate)) return false
  return isWithinPeriod(assignment.validFrom, assignment.validTo, evaluationDate)
}

function isWithinPeriod(from: Date, to: Date | null, evaluationDate: Date): boolean {
  if (from.getTime() > evaluationDate.getTime()) return false
  if (to !== null && to.getTime() < evaluationDate.getTime()) return false
  return true
}

function isDeactivated(deactivatedAt: Date | null, evaluationDate: Date): boolean {
  return deactivatedAt !== null && deactivatedAt.getTime() <= evaluationDate.getTime()
}
