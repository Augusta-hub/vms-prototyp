/**
 * Fußnoten der Berechtigungsmatrix (SPEC 2.2).
 *
 * Eine Fußnote ist eine **Einschränkung einer Zelle**, keine eigene Regel: sie
 * kann ein in der Matrix genanntes Recht nur verkleinern, nie vergrößern. Jede
 * Fußnote trägt deshalb ihren Wortlaut aus 2.2 und ein Prädikat, das gegen den
 * konkreten Vorgang auswertet. Schlägt eine Fußnote fehl, ist der Zugriff
 * verweigert — auch wenn die Zelle die Operation nennt.
 *
 * Hinterlegt sind die Fußnoten, die die belegten Zeilen dieser Arbeitseinheit
 * brauchen ([2], [7], [38], [45]). Die übrigen 42 Fußnoten kommen mit ihren
 * Zeilen hinzu; die Struktur trägt sie unverändert.
 */
import type { Operation } from './operations'
import type { RoleCode, TenantType } from './roles'
import type { ResourceType } from './resources'

/** Was eine Fußnote zur Auswertung braucht. */
export interface ConstraintContext {
  readonly operation: Operation
  readonly subject: {
    readonly userId: string
    readonly tenantId: string
    readonly tenantType: TenantType
  }
  readonly grant: {
    readonly roleAssignmentId: string
    readonly roleCode: RoleCode
    readonly tenantId: string
    /** Gesetzt, wenn das Recht aus einer Vertretung stammt (2.4). */
    readonly viaDelegation?: { readonly delegationId: string }
  }
  readonly resource: {
    readonly type: ResourceType
    readonly tenantId: string
    readonly tenantType: TenantType
    /** Ersteller des Vorgangs — für die Vier-Augen-Fußnoten [5] und [30]. */
    readonly createdById?: string
    /** Betroffene Person — für die eigenen Daten des Leiharbeitnehmers [4]. */
    readonly subjectUserId?: string
    /** Vertretene Rollenzuweisung — Zeile Vertretung, Fußnote [45]. */
    readonly delegatedRoleAssignmentId?: string
  }
}

export interface Footnote {
  readonly number: number
  /** Wortlaut aus SPEC 2.2, gekürzt auf die prüfbare Aussage. */
  readonly text: string
  /** true = Einschränkung erfüllt, false = Zugriff verweigert. */
  readonly isSatisfied: (ctx: ConstraintContext) => boolean
}

export const FOOTNOTES = {
  2: {
    number: 2,
    text: 'Nur die eigene Organisation bzw. der eigene Kunde (Mandantengrenze, Kapitel 2.3).',
    isSatisfied: (ctx) => ctx.resource.tenantId === ctx.subject.tenantId,
  },
  7: {
    number: 7,
    text: 'Nur die eigene Lieferantenorganisation.',
    isSatisfied: (ctx) =>
      ctx.subject.tenantType === 'supplier' && ctx.resource.tenantId === ctx.subject.tenantId,
  },
  38: {
    number: 38,
    text:
      'Nur lesend, zur Zuordnung von Vorgängen; die Rollenvergabe bleibt bei MA bzw. LA. ' +
      'Die kundenseitige Benutzerverwaltung liegt derzeit beim Betreiber — offene Frage 12.',
    isSatisfied: (ctx) => ctx.operation === 'read',
  },
  45: {
    number: 45,
    text:
      'Nur die eigene Vertretung für eine eigene Rollenzuweisung bei geplanter Abwesenheit ' +
      '(2.4, Regel 7). Keine Rechteerweiterung, keine Ketten.',
    isSatisfied: (ctx) => {
      // Keine Vertretungsketten: wer selbst in Vertretung handelt, bestimmt
      // keinen Untervertreter (2.4, Regel 4). Die Regel betrifft das
      // Einrichten; die eigene Vertretung lesen und beenden darf der Vertreter
      // im Rahmen der vertretenen Rollenzuweisung.
      if (ctx.operation === 'create' && ctx.grant.viaDelegation !== undefined) return false
      // Nur zur eigenen Rollenzuweisung. Ohne Angabe der vertretenen Zuweisung
      // ist die Einschränkung nicht erfüllbar — positiv festgelegt (2.3).
      return ctx.resource.delegatedRoleAssignmentId === ctx.grant.roleAssignmentId
    },
  },
} as const satisfies Record<number, Footnote>

export type FootnoteNumber = keyof typeof FOOTNOTES

export function footnoteText(number: FootnoteNumber): string {
  return FOOTNOTES[number].text
}
