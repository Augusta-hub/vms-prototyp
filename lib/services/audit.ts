/**
 * Fachdienst Protokoll — SPEC **3.12**, Objekt `auditEntry`.
 *
 * Dieser Dienst **liest nur**. Geschrieben wird das Protokoll ausschließlich in
 * lib/audit/record.ts, aus der Transaktion der jeweiligen Handlung heraus:
 * „Audit-Einträge entstehen ausschließlich durch das System" (3.12). Es gibt
 * hier deshalb keine Handlung, die einen Eintrag anlegt, ändert oder löscht —
 * und in 2.2 trägt die Zeile zu 3.12 nur `L`.
 *
 * Sichtbarkeit: je Eintrag über `checkPermission` am Mandanten des
 * **betroffenen Objekts** ([39], 3.12) — nicht über eine `where`-Klausel. Die
 * Begründung ist dieselbe wie bei den Nachweisen (3.10): zwei Quellen für
 * dieselbe Grenze laufen auseinander.
 */
import { checkPermission } from '../authz/check'
import { RESOURCE_LABELS, MATRIX_ROW_BY_OBJECT, type ModelName } from '../authz/resources'
import type { AuditOperation, AuditResult } from '../audit/entry'
import type { LoadedIdentity } from '../identity/loadSubject'
import { prisma } from '../prisma'
import { auditEntryRef, tenantTypeOf } from './common'

/** Ein geändertes Feld, wie es die Oberfläche zeigt (3.12). */
export interface ChangedFieldView {
  readonly field: string
  readonly from: string | null
  readonly to: string | null
}

export interface AuditEntryView {
  readonly id: string
  readonly entryNumber: number
  readonly occurredAt: Date
  /** Handelnder in Worten, oder das Systemkennzeichen (3.12, 4.0 Regel 10). */
  readonly actor: string
  /** In welcher Funktion gehandelt wurde — die Rollenzuweisung, nicht der Benutzer. */
  readonly actingAs: string | null
  /** Vertretungsvermerk (2.4, Regel 6). */
  readonly delegationNote: string | null
  readonly tenant: string
  readonly objectType: ModelName
  /** Zeilenbeschriftung aus 2.2 zum Objekt — z. B. „Lieferant / Verleiher (3.2)". */
  readonly objectLabel: string
  readonly objectRef: string
  readonly operation: AuditOperation
  readonly statusFrom: string | null
  readonly statusTo: string | null
  readonly changedFields: readonly ChangedFieldView[]
  readonly reason: string | null
  readonly ruleRef: string | null
  readonly result: AuditResult
  readonly crossTenant: boolean
}

const AUDIT_INCLUDE = {
  actorUser: { select: { givenName: true, familyName: true, loginIdentifier: true } },
  actingAsRoleAssignment: { select: { roleCode: true } },
  delegation: { select: { id: true, delegateUserId: true, delegatedRoleAssignmentId: true } },
  tenant: { select: { displayName: true, tenantType: true } },
} as const

type LoadedAuditEntry = Awaited<
  ReturnType<typeof prisma.auditEntry.findMany<{ include: typeof AUDIT_INCLUDE }>>
>[number]

/**
 * Das Protokoll in der sichtbaren Fassung, neuester Eintrag zuerst.
 *
 * `limit` begrenzt die **Anzeige**, nicht das Protokoll: der Bestand bleibt
 * vollständig, und die Aufbewahrung ist *offene Frage 22*.
 */
export async function loadAuditEntries(
  identity: LoadedIdentity,
  limit = 200,
): Promise<readonly AuditEntryView[]> {
  const rows = await prisma.auditEntry.findMany({
    include: AUDIT_INCLUDE,
    orderBy: { entryNumber: 'desc' },
    take: limit,
  })

  const views: AuditEntryView[] = []
  for (const row of rows) {
    const decision = checkPermission(
      identity.subject,
      'read',
      auditEntryRef({ tenantId: row.tenantId, tenantType: tenantTypeOf(row.tenant.tenantType) }),
    )
    if (!decision.allowed) continue
    views.push(asView(row))
  }
  return views
}

/**
 * Die Einträge zu **einem** Objekt — die Spur eines Vorgangs (3.12).
 *
 * Dieselbe Prüfung je Eintrag: dass jemand das Objekt sehen darf, heißt nicht,
 * dass er das Protokoll dazu sieht. Die Zeile zu 3.12 ist eine eigene Zeile.
 */
export async function loadAuditTrail(
  identity: LoadedIdentity,
  objectType: ModelName,
  objectRef: string,
): Promise<readonly AuditEntryView[]> {
  const rows = await prisma.auditEntry.findMany({
    where: { objectType, objectRef },
    include: AUDIT_INCLUDE,
    orderBy: { entryNumber: 'asc' },
  })

  const views: AuditEntryView[] = []
  for (const row of rows) {
    const decision = checkPermission(
      identity.subject,
      'read',
      auditEntryRef({ tenantId: row.tenantId, tenantType: tenantTypeOf(row.tenant.tenantType) }),
    )
    if (!decision.allowed) continue
    views.push(asView(row))
  }
  return views
}

/**
 * Die Lückenlosigkeit der Eintragsnummern als Befund (3.12: „Lücken sind ein
 * Befund, kein Betriebszustand").
 *
 * Die Prüfung läuft über den **ganzen** Bestand, nicht über die sichtbare
 * Teilmenge: eine Lücke, die nur deshalb erscheint, weil eine Rolle Einträge
 * nicht sehen darf, wäre kein Befund. Deshalb gibt diese Funktion auch keine
 * Inhalte zurück, sondern nur Zahlen — sie ist für jede Rolle unbedenklich.
 */
export async function pruefeLueckenlosigkeit(): Promise<{
  readonly count: number
  readonly lowest: number | null
  readonly highest: number | null
  readonly missing: readonly number[]
}> {
  const nummern = await prisma.auditEntry.findMany({
    select: { entryNumber: true },
    orderBy: { entryNumber: 'asc' },
  })
  if (nummern.length === 0) {
    return { count: 0, lowest: null, highest: null, missing: [] }
  }
  const werte = nummern.map((zeile) => zeile.entryNumber)
  const lowest = werte[0] ?? 0
  const highest = werte[werte.length - 1] ?? 0
  const vorhanden = new Set(werte)
  const missing: number[] = []
  for (let nummer = lowest; nummer <= highest; nummer += 1) {
    if (!vorhanden.has(nummer)) missing.push(nummer)
  }
  return { count: werte.length, lowest, highest, missing }
}

/* ------------------------------------------------------------------ */
/* Darstellung                                                         */
/* ------------------------------------------------------------------ */

export const AUDIT_OPERATION_LABELS: { readonly [O in AuditOperation]: string } = {
  create: 'angelegt',
  read: 'gelesen',
  update: 'geändert',
  transition: 'Status gewechselt',
  delete: 'gelöscht (deaktiviert, storniert)',
}

export const AUDIT_RESULT_LABELS: { readonly [R in AuditResult]: string } = {
  success: 'ausgeführt',
  denied: 'verweigert',
  blocked: 'gesperrt',
}

function asView(row: LoadedAuditEntry): AuditEntryView {
  const objectType = row.objectType as ModelName
  const zeile = MATRIX_ROW_BY_OBJECT[objectType]
  return {
    id: row.id,
    entryNumber: row.entryNumber,
    occurredAt: row.occurredAt,
    actor:
      row.actorUser === null
        ? (row.systemActor ?? 'unbekannt')
        : `${row.actorUser.givenName} ${row.actorUser.familyName} (${row.actorUser.loginIdentifier})`,
    actingAs: row.actingAsRoleAssignment?.roleCode ?? null,
    delegationNote:
      row.delegation === null
        ? null
        : `in Vertretung (Vertretung ${row.delegation.id}, vertretene Zuweisung ` +
          `${row.delegation.delegatedRoleAssignmentId})`,
    tenant: row.tenant.displayName,
    objectType,
    objectLabel: zeile === undefined ? objectType : RESOURCE_LABELS[zeile],
    objectRef: row.objectRef,
    operation: row.operation,
    statusFrom: row.statusFrom,
    statusTo: row.statusTo,
    changedFields: alsFelder(row.changedFields),
    reason: row.reason,
    ruleRef: row.ruleRef,
    result: row.result,
    crossTenant: row.crossTenant,
  }
}

/**
 * `changedFields` kommt als Json aus der Datenbank. Gelesen wird defensiv: ein
 * Eintrag ist unveränderlich, also kann eine ältere Fassung des Formats nicht
 * nachträglich berichtigt werden — sie muss lesbar bleiben.
 */
function alsFelder(wert: unknown): readonly ChangedFieldView[] {
  if (!Array.isArray(wert)) return []
  const felder: ChangedFieldView[] = []
  for (const eintrag of wert) {
    if (typeof eintrag !== 'object' || eintrag === null) continue
    const satz = eintrag as Record<string, unknown>
    if (typeof satz.field !== 'string') continue
    felder.push({
      field: satz.field,
      from: typeof satz.from === 'string' ? satz.from : null,
      to: typeof satz.to === 'string' ? satz.to : null,
    })
  }
  return felder
}
