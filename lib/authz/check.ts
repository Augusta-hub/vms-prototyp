/**
 * Die Prüffunktion: darf dieser Benutzer diese Operation an diesem Objekt
 * ausführen?
 *
 * Reihenfolge der Prüfung — sie ist der Kern von SPEC 2.3 und nicht
 * vertauschbar:
 *
 *  1. **Mandantengrenze** (2.3). Sie geht dem Rollenrecht **vor**. Nur der
 *     Betreibermandant sieht über die Grenze, und auch er nur im Rahmen seiner
 *     Betreuungszuordnungen.
 *  2. **Rollenrecht** aus der Matrix 2.2. Was die Matrix nicht ausdrücklich
 *     nennt, ist verweigert.
 *  3. **Fußnoten** der Zelle. Sie verkleinern das Recht, nie umgekehrt.
 *  4. **Zuständigkeit** innerhalb des Mandanten (3.11).
 *
 * Das wirksame Recht ist damit die Schnittmenge aus Rolle, Mandantenzuordnung
 * und Zuständigkeit (Kapitel 2). Fehlt eine der drei, besteht kein Zugriff.
 *
 * Die Funktion entscheidet **nicht** über Statusübergänge: `transition` sagt
 * nur, dass die Rolle überhaupt Status wechseln darf. Welchen Übergang wann,
 * steht in Kapitel 4 und gehört in das jeweilige Statusmodell.
 */
import { FOOTNOTES, type ConstraintContext, type FootnoteNumber } from './footnotes'
import { grantedFootnotes } from './matrix'
import type { Operation } from './operations'
import type { ResourceType } from './resources'
import { NON_DELEGABLE_ROLES, ROLE_CATALOG, type RoleCode, type TenantType } from './roles'

/** Eine Zuständigkeit im Sinne von 3.11. */
export interface ScopeRef {
  readonly scopeType: 'site' | 'costCenter'
  readonly scopeRef: string
}

/**
 * Ein wirksames Recht eines Benutzers: eine Rollenzuweisung, entweder eigen
 * oder aus einer Vertretung (2.4). Gebaut wird die Liste ausschließlich in
 * lib/authz/grants.ts — nie hier, damit eine Vertretung nichts erweitern kann.
 */
export interface Grant {
  readonly roleAssignmentId: string
  readonly roleCode: RoleCode
  /** Mandant der Rollenzuweisung; muss dem Mandanten des Benutzers entsprechen (3.11). */
  readonly tenantId: string
  /** Leer = die Zuweisung wirkt auf den ganzen Mandanten (3.11). */
  readonly responsibilityScopes: readonly ScopeRef[]
  /** Gesetzt, wenn das Recht aus einer Vertretung stammt (Vertretungsvermerk, 2.4 Regel 6). */
  readonly viaDelegation?: {
    readonly delegationId: string
    /** Benutzer, dessen Rollenzuweisung vertreten wird. */
    readonly delegatedUserId: string
  }
}

/** Der handelnde Benutzer mit seinen wirksamen Rechten. */
export interface Subject {
  readonly userId: string
  readonly tenantId: string
  readonly tenantType: TenantType
  readonly grants: readonly Grant[]
  /**
   * Betreuungszuordnungen eines MSP-Benutzers: die Mandanten der betreuten
   * Kunden (3.11). Leere Liste heißt **keine Einschränkung** — eine bewusste
   * Entscheidung des `MA` und Gegenstand des Berechtigungsreviews (2.3).
   */
  readonly accountAssignmentCustomerTenantIds: readonly string[]
}

/** Der Vorgang, auf den zugegriffen wird. */
export interface ResourceRef {
  readonly type: ResourceType
  /** Mandant des Objekts — trägt die Mandantengrenze (3.0, 2.3). */
  readonly tenantId: string
  readonly tenantType: TenantType
  readonly siteId?: string
  readonly costCenterId?: string
  /** Ersteller, für die Vier-Augen-Fußnoten [5] und [30]. */
  readonly createdById?: string
  /** Betroffene Person, für die eigenen Daten des Leiharbeitnehmers [4]. */
  readonly subjectUserId?: string
  /** Vertretene Rollenzuweisung, für die Zeile Vertretung und Fußnote [45]. */
  readonly delegatedRoleAssignmentId?: string
}

export type DenialKind =
  | 'tenantBoundary'
  | 'accountAssignment'
  | 'noGrant'
  | 'noRolePermission'
  | 'footnote'
  | 'responsibilityScope'
  | 'roleTenantTypeMismatch'
  | 'roleNotDelegable'

export interface Denial {
  readonly kind: DenialKind
  /** Begründung in der Sprache der Spezifikation, für Oberfläche und Protokoll. */
  readonly reason: string
  readonly footnote?: FootnoteNumber
  readonly specReference: string
}

export type Decision =
  | {
      readonly allowed: true
      /** Das Recht, auf dem die Entscheidung beruht. */
      readonly grant: Grant
      readonly footnotes: readonly FootnoteNumber[]
      /**
       * Lesender oder schreibender Zugriff über die Mandantengrenze hinweg.
       * Er ist nach 2.3 als Audit-Eintrag zu erfassen (3.12, noch nicht
       * umgesetzt) — die Entscheidung sagt es deshalb ausdrücklich.
       */
      readonly crossTenant: boolean
      /** Vertretungsvermerk (2.4, Regel 6), wenn in Vertretung gehandelt wird. */
      readonly delegationNote?: { readonly delegationId: string; readonly delegatedUserId: string }
    }
  | { readonly allowed: false; readonly denial: Denial }

const DENIAL_RANK: { readonly [K in DenialKind]: number } = {
  tenantBoundary: 0,
  accountAssignment: 0,
  noGrant: 1,
  noRolePermission: 2,
  roleTenantTypeMismatch: 3,
  roleNotDelegable: 4,
  footnote: 5,
  responsibilityScope: 6,
}

/**
 * Prüft einen Zugriff. Verweigert, was nicht positiv erlaubt ist (2.3).
 */
export function checkPermission(
  subject: Subject,
  operation: Operation,
  resource: ResourceRef,
): Decision {
  // ── 1. Mandantengrenze, vor jedem Rollenrecht (2.3) ───────────────────────
  const crossTenant = resource.tenantId !== subject.tenantId
  if (crossTenant) {
    if (subject.tenantType !== 'operator') {
      return deny({
        kind: 'tenantBoundary',
        reason:
          'Der Vorgang gehört zu einem anderen Mandanten. Ein Recht aus 2.2 wirkt nur auf ' +
          'Objekte der eigenen Organisation; nur der Betreiber sieht über die Grenze.',
        specReference: 'SPEC 2.3, Grundsatz',
      })
    }
    // Querschnittssicht des Betreibers, eingeschränkt durch die
    // Betreuungszuordnung (2.3, Bedingung 2). Sie ist in 3.11 für Kunden
    // geführt; Lieferantenmandanten schränkt sie nicht ein — offene Frage 34.
    if (
      resource.tenantType === 'customer' &&
      subject.accountAssignmentCustomerTenantIds.length > 0 &&
      !subject.accountAssignmentCustomerTenantIds.includes(resource.tenantId)
    ) {
      return deny({
        kind: 'accountAssignment',
        reason:
          'Der MSP-Benutzer ist auf eine Teilmenge der Kunden eingeschränkt; dieser Kunde ' +
          'gehört nicht dazu.',
        specReference: 'SPEC 2.3, Betreiber: Querschnittssicht, Bedingung 2',
      })
    }
  }

  if (subject.grants.length === 0) {
    return deny({
      kind: 'noGrant',
      reason: 'Der Benutzer hat keine wirksame Rollenzuweisung.',
      specReference: 'SPEC 2, wirksames Recht als Schnittmenge',
    })
  }

  // ── 2. bis 4. Rollenrecht, Fußnoten, Zuständigkeit ───────────────────────
  let bestDenial: Denial | undefined
  const record = (denial: Denial): void => {
    if (bestDenial === undefined || DENIAL_RANK[denial.kind] > DENIAL_RANK[bestDenial.kind]) {
      bestDenial = denial
    }
  }

  for (const grant of subject.grants) {
    // Eine nicht vertretbare Rolle wirkt auch dann nicht, wenn eine Vertretung
    // sie zu übertragen versucht (2.4, Regel 8). Vor der Matrix geprüft, damit
    // die Begründung die Vertretungsregel nennt und nicht die fehlende Zelle.
    if (grant.viaDelegation !== undefined && NON_DELEGABLE_ROLES.includes(grant.roleCode)) {
      record({
        kind: 'roleNotDelegable',
        reason: `Die Rolle ${ROLE_CATALOG[grant.roleCode].abbreviation} ist nicht vertretbar.`,
        specReference: 'SPEC 2.4, Regel 8',
      })
      continue
    }

    const footnotes = grantedFootnotes(resource.type, grant.roleCode, operation)
    if (footnotes === undefined) {
      record({
        kind: 'noRolePermission',
        reason: `Die Matrix nennt für ${ROLE_CATALOG[grant.roleCode].abbreviation} an diesem Objekt keine Operation „${operation}".`,
        specReference: 'SPEC 2.2',
      })
      continue
    }

    // Datenprüfung: eine Rolle gilt nur für ihren Mandantentyp, und die
    // Rollenzuweisung nur im Mandanten des Benutzers (Kapitel 2, 3.11).
    if (ROLE_CATALOG[grant.roleCode].appliesToTenantType !== subject.tenantType) {
      record({
        kind: 'roleTenantTypeMismatch',
        reason: `Die Rolle ${ROLE_CATALOG[grant.roleCode].abbreviation} gilt nicht für einen Mandanten vom Typ „${subject.tenantType}".`,
        specReference: 'SPEC 2.1, 3.11 (appliesToTenantType)',
      })
      continue
    }
    if (grant.tenantId !== subject.tenantId) {
      record({
        kind: 'roleTenantTypeMismatch',
        reason: 'Die Rollenzuweisung gehört nicht zum Mandanten des Benutzers.',
        specReference: 'SPEC 3.11, Rollenzuweisung',
      })
      continue
    }
    const ctx: ConstraintContext = {
      operation,
      subject: {
        userId: subject.userId,
        tenantId: subject.tenantId,
        tenantType: subject.tenantType,
      },
      grant: {
        roleAssignmentId: grant.roleAssignmentId,
        roleCode: grant.roleCode,
        tenantId: grant.tenantId,
        ...(grant.viaDelegation !== undefined
          ? { viaDelegation: { delegationId: grant.viaDelegation.delegationId } }
          : {}),
      },
      resource: {
        type: resource.type,
        tenantId: resource.tenantId,
        tenantType: resource.tenantType,
        ...(resource.createdById !== undefined ? { createdById: resource.createdById } : {}),
        ...(resource.subjectUserId !== undefined ? { subjectUserId: resource.subjectUserId } : {}),
        ...(resource.delegatedRoleAssignmentId !== undefined
          ? { delegatedRoleAssignmentId: resource.delegatedRoleAssignmentId }
          : {}),
      },
    }

    const failed = footnotes.find((number) => !FOOTNOTES[number].isSatisfied(ctx))
    if (failed !== undefined) {
      record({
        kind: 'footnote',
        reason: `Fußnote [${failed}] zu dieser Zelle ist nicht erfüllt: ${FOOTNOTES[failed].text}`,
        footnote: failed,
        specReference: `SPEC 2.2, Fußnote [${failed}]`,
      })
      continue
    }

    if (!scopeAllows(grant.responsibilityScopes, resource)) {
      record({
        kind: 'responsibilityScope',
        reason:
          'Die Rollenzuweisung ist auf bestimmte Standorte bzw. Kostenstellen eingeschränkt; ' +
          'der Vorgang gehört zu keiner davon.',
        specReference: 'SPEC 3.11, Zuständigkeit (offene Frage 14)',
      })
      continue
    }

    return {
      allowed: true,
      grant,
      footnotes,
      crossTenant,
      ...(grant.viaDelegation !== undefined
        ? {
            delegationNote: {
              delegationId: grant.viaDelegation.delegationId,
              delegatedUserId: grant.viaDelegation.delegatedUserId,
            },
          }
        : {}),
    }
  }

  return deny(
    bestDenial ?? {
      kind: 'noRolePermission',
      reason: 'Keine Rollenzuweisung des Benutzers erlaubt diesen Zugriff.',
      specReference: 'SPEC 2.2',
    },
  )
}

/**
 * Zuständigkeit (3.11): ohne Zuständigkeit wirkt die Zuweisung auf den ganzen
 * Mandanten. Trägt der Vorgang eine der eingeschränkten Dimensionen, muss sie
 * zu einer Zuständigkeit passen.
 *
 * Vorläufige Auslegung: eine Zuständigkeit schränkt nur Objekte ein, die
 * Standort oder Kostenstelle überhaupt tragen — ein Benutzer oder eine
 * Vertretung trägt keine, der eingeschränkte Bedarfsträger kann sie also
 * weiter bearbeiten. Ob das so gewollt ist, ist **offene Frage 35**.
 */
function scopeAllows(scopes: readonly ScopeRef[], resource: ResourceRef): boolean {
  if (scopes.length === 0) return true

  const siteScopes = scopes.filter((scope) => scope.scopeType === 'site')
  const costCenterScopes = scopes.filter((scope) => scope.scopeType === 'costCenter')

  if (resource.siteId !== undefined && siteScopes.length > 0) {
    if (!siteScopes.some((scope) => scope.scopeRef === resource.siteId)) return false
  }
  if (resource.costCenterId !== undefined && costCenterScopes.length > 0) {
    if (!costCenterScopes.some((scope) => scope.scopeRef === resource.costCenterId)) return false
  }
  return true
}

function deny(denial: Denial): Decision {
  return { allowed: false, denial }
}

/** Kurzform für Aufrufstellen, die nur „ja" oder „nein" brauchen. */
export function isPermitted(
  subject: Subject,
  operation: Operation,
  resource: ResourceRef,
): boolean {
  return checkPermission(subject, operation, resource).allowed
}
