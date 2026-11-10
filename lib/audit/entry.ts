/**
 * Der Audit-Eintrag aus SPEC **3.12** als Typ — das fachliche Protokoll.
 *
 * Diese Datei beschreibt **was** protokolliert wird; geschrieben wird in
 * lib/audit/record.ts. Die Trennung ist nicht kosmetisch: der Entwurf
 * (`AuditDraft`) entsteht im Fachdienst, der die Handlung kennt, die
 * Eintragsnummer dagegen ausschließlich in der Transaktion, die den Eintrag
 * schreibt (3.12, „fortlaufend, lückenlos").
 *
 * **Was protokolliert wird** (3.12, Festlegung aus Kapitel 2):
 *
 *  1. alle schreibenden Operationen an allen Objekten aus Kapitel 3,
 *  2. lesende Zugriffe über Mandantengrenzen hinweg,
 *  3. lesende Zugriffe auf Klardaten von Kandidaten (6.4),
 *  4. jede Handlung in Vertretung (2.4, Regel 6) und jede Eskalationsstufe,
 *  5. jede Übersteuerung einer AÜG-Sperre mit Begründung (5.5).
 *
 * Umgesetzt sind 1, der Vertretungsvermerk aus 4 und — in der Granularität
 * einzelner Objekte — 2 und 3; die Granularität der Lesezugriffe ist *offene
 * Frage 45*. Eskalationen und Übersteuerungen hat der Prototyp nicht.
 *
 * Lesende Zugriffe **innerhalb** des eigenen Mandanten auf nicht
 * personenbezogene Daten werden ausdrücklich **nicht** protokolliert (3.12).
 * Dass dieser Grundsatz eingehalten wird, ist eine Eigenschaft der
 * Aufrufstellen: es gibt keine Protokollierung in den Lesedienten außer dort,
 * wo einer der drei genannten Fälle vorliegt.
 */
import type { Decision } from '../authz/check'
import type { ModelName } from '../authz/resources'

/** Dieselben Operationen wie in 2.2 (3.12). */
export type AuditOperation = 'create' | 'read' | 'update' | 'transition' | 'delete'

/**
 * Ergebnis des protokollierten Zugriffs (3.12).
 *
 * `denied` ist die Verweigerung nach Kapitel 2 — Mandantengrenze, fehlendes
 * Rollenrecht, Fußnote, Zuständigkeit, nicht auslösende Rolle. `blocked` ist
 * das Prüfergebnis „Sperre" aus Kapitel 5 (5.5): der Vorgang **durfte**, aber
 * eine Regel verhindert ihn. Die Unterscheidung ist der Grund, warum 3.12 zwei
 * Werte führt statt eines.
 */
export type AuditResult = 'success' | 'denied' | 'blocked'

/** Ein geändertes Feld: Feld, vorher, nachher (3.12, Pflicht bei `update`). */
export interface ChangedField {
  readonly field: string
  readonly from: string | null
  readonly to: string | null
}

/**
 * Der Handelnde. Entweder ein Benutzer in einer bestimmten Funktion — das ist
 * die Rollenzuweisung, nicht der Benutzer (3.12, 3.11) — oder ein Systemlauf
 * mit Systemkennzeichen (4.0, Regel 10).
 */
export type AuditActor =
  | {
      readonly kind: 'user'
      readonly userId: string
      /**
       * In welcher Funktion gehandelt wurde. `null` **nur** bei einer
       * Verweigerung, die vor der Matrix greift — dann steht keine Zuweisung
       * fest (*offene Frage 44*).
       */
      readonly roleAssignmentId: string | null
      /** Vertretungsvermerk (2.4, Regel 6). */
      readonly delegationId: string | null
    }
  | { readonly kind: 'system'; readonly label: string }

/** Systemkennzeichen für zeitgesteuerte und abgeleitete Übergänge (4.0, Regel 10). */
export const SYSTEM_ACTOR = 'systemlauf'

/**
 * Ein Eintrag, bevor er eine Nummer hat.
 *
 * `tenantId` ist der Mandant des **Objekts**, nicht der des Handelnden: darauf
 * beruht die Sichtbarkeit nach Fußnote [39] (3.12, „Mandant und Eigentümer").
 */
export interface AuditDraft {
  readonly occurredAt: Date
  readonly actor: AuditActor
  readonly tenantId: string
  /** Objektname aus Kapitel 3 — dieselben Namen wie in der Matrixzuordnung. */
  readonly objectType: ModelName
  /**
   * Verweis auf das Objekt. Bei einer **abgelehnten Anlage** gibt es noch
   * keine technische Kennung; dann steht hier die fachliche Kennung des
   * beabsichtigten Vorgangs, weil `objectRef` in 3.12 Pflicht ist und der
   * Versuch sonst nicht zuzuordnen wäre.
   */
  readonly objectRef: string
  readonly operation: AuditOperation
  readonly result: AuditResult
  /** Pflicht bei `transition`; `statusFrom` ist bei der Anlage leer (3.12). */
  readonly statusFrom?: string | null
  readonly statusTo?: string | null
  /** Pflicht bei `update` (3.12); Umfang und Aufbewahrung nach 6.6. */
  readonly changedFields?: readonly ChangedField[]
  /** Pflicht bei Korrektur und Übersteuerung ([28], 5.5). */
  readonly reason?: string | null
  /** Ausgelöste Regel aus Kapitel 5 — bei Prüfergebnissen und Sperren (3.12). */
  readonly ruleRef?: string | null
  /** Zugriff über die Mandantengrenze (2.3, Bedingung 3). */
  readonly crossTenant?: boolean
}

/**
 * Das Objekt, auf das sich ein Eintrag bezieht.
 *
 * Die drei Angaben sind in 3.12 **Pflicht**. Bei einer abgelehnten **Anlage**
 * gibt es das Objekt noch nicht: dann steht in `objectRef` die fachliche
 * Kennung des beabsichtigten Vorgangs und in `tenantId` der Mandant des
 * Handelnden, weil es keinen Mandanten des Objekts gibt. Das ist eine
 * Auslegung, nicht der Wortlaut — *offene Frage 44*.
 */
export interface Protokollbezug {
  readonly objectType: ModelName
  readonly objectRef: string
  readonly tenantId: string
}

/**
 * Der Eintrag zu einer **ausgeführten** schreibenden Operation ohne
 * Statuswechsel: Anlage ohne Statusmodell, Änderung, Deaktivierung (3.12,
 * Nummer 1).
 *
 * Statuswechsel laufen über lib/audit/transitions.ts, weil sie `statusFrom`
 * und `statusTo` aus dem Übergang beziehen und nicht aus dem Aufrufer.
 */
export function schreibEintrag(args: {
  /** `null` bei einem Systemlauf (4.0, Regel 10). */
  readonly decision: Decision | null
  readonly operation: 'create' | 'update' | 'delete'
  readonly bezug: Protokollbezug
  readonly userId: string
  readonly occurredAt: Date
  readonly changedFields?: readonly ChangedField[]
  readonly reason?: string | null
  readonly ruleRef?: string | null
}): AuditDraft {
  return {
    occurredAt: args.occurredAt,
    actor: handelnder(args.userId, args.decision),
    tenantId: args.bezug.tenantId,
    objectType: args.bezug.objectType,
    objectRef: args.bezug.objectRef,
    operation: args.operation,
    result: 'success',
    ...(args.changedFields !== undefined ? { changedFields: args.changedFields } : {}),
    reason: args.reason ?? null,
    ruleRef: args.ruleRef ?? null,
    crossTenant: args.decision?.allowed === true ? args.decision.crossTenant : false,
  }
}

/**
 * Der Eintrag zu einem **verweigerten** Zugriff (3.12: „abgelehnte Zugriffe
 * werden ebenfalls protokolliert").
 *
 * `reason` trägt die Begründung der Prüffunktion samt Fundstelle — das ist der
 * Zweck des Eintrags: nicht dass etwas verweigert wurde, sondern **woran** es
 * lag (2.2, 2.3).
 */
export function verweigerungsEintrag(args: {
  readonly decision: Decision
  readonly operation: AuditOperation
  readonly bezug: Protokollbezug
  readonly userId: string
  readonly occurredAt: Date
}): AuditDraft {
  const grund = args.decision.allowed
    ? null
    : `${args.decision.denial.reason} (${args.decision.denial.specReference})`
  return {
    occurredAt: args.occurredAt,
    actor: handelnder(args.userId, args.decision),
    tenantId: args.bezug.tenantId,
    objectType: args.bezug.objectType,
    objectRef: args.bezug.objectRef,
    operation: args.operation,
    result: 'denied',
    reason: grund,
  }
}

/**
 * Der Eintrag zu einem **lesenden** Zugriff, der nach 3.12 zu protokollieren
 * ist: über die Mandantengrenze hinweg (Nummer 2) oder auf Klardaten eines
 * Kandidaten (Nummer 3).
 *
 * Nicht für Lesezugriffe innerhalb des eigenen Mandanten auf nicht
 * personenbezogene Daten — die protokolliert 3.12 ausdrücklich **nicht**. Die
 * Granularität ist *offene Frage 45*.
 */
export function leseEintrag(args: {
  readonly decision: Decision
  readonly bezug: Protokollbezug
  readonly userId: string
  readonly occurredAt: Date
  /** Warum dieser Lesezugriff protokolliert wird (3.12, Nummer 2 oder 3). */
  readonly reason: string
}): AuditDraft {
  return {
    occurredAt: args.occurredAt,
    actor: handelnder(args.userId, args.decision),
    tenantId: args.bezug.tenantId,
    objectType: args.bezug.objectType,
    objectRef: args.bezug.objectRef,
    operation: 'read',
    result: args.decision.allowed ? 'success' : 'denied',
    reason: args.reason,
    crossTenant: args.decision.allowed ? args.decision.crossTenant : false,
  }
}

/**
 * Der Handelnde aus der Entscheidung der Prüffunktion.
 *
 * Rollenzuweisung und Vertretungsvermerk stehen in der **Entscheidung**, nicht
 * im Benutzer: welche der mehreren Rollenzuweisungen den Zugriff getragen hat,
 * weiß nur `checkPermission` (2.2, 2.4). Deshalb wird hier abgeleitet statt
 * neben der Prüfung noch einmal gerechnet.
 *
 * `decision === null` bedeutet einen Systemübergang (4.0, Regel 10) — dort
 * gibt es keinen Benutzer.
 */
export function handelnder(userId: string, decision: Decision | null): AuditActor {
  if (decision === null) return { kind: 'system', label: SYSTEM_ACTOR }
  if (!decision.allowed) {
    // Eine Verweigerung kann gerade daran liegen, dass **keine** wirksame
    // Zuweisung besteht (*offene Frage 44*).
    return { kind: 'user', userId, roleAssignmentId: null, delegationId: null }
  }
  return {
    kind: 'user',
    userId,
    roleAssignmentId: decision.grant.roleAssignmentId,
    delegationId: decision.delegationNote?.delegationId ?? null,
  }
}

/** Ein Systemlauf (4.0, Regel 10; 5.5.1 c). */
export function systemlauf(label: string = SYSTEM_ACTOR): AuditActor {
  return { kind: 'system', label }
}

/**
 * Ein Benutzer ohne feststehende Rollenzuweisung — für Versuche, die **vor**
 * der Matrix abgewiesen wurden (Mandantengrenze, fehlende Zuweisung).
 */
export function versuchOhneZuweisung(userId: string): AuditActor {
  return { kind: 'user', userId, roleAssignmentId: null, delegationId: null }
}

/**
 * Die geänderten Felder zweier Fassungen desselben Vorgangs (3.12).
 *
 * Verglichen werden nur die **genannten** Felder: 6.6 bestimmt den Umfang des
 * Protokolls, nicht die Zufälligkeit des übergebenen Objekts. Felder ohne
 * Änderung stehen nicht im Eintrag — ein `update`, das nichts ändert, erzeugt
 * eine leere Liste und damit keinen Eintrag (siehe lib/audit/record.ts).
 */
export function geaenderteFelder(
  vorher: Readonly<Record<string, unknown>>,
  nachher: Readonly<Record<string, unknown>>,
  felder: readonly string[],
): readonly ChangedField[] {
  const liste: ChangedField[] = []
  for (const feld of felder) {
    const alt = alsText(vorher[feld])
    const neu = alsText(nachher[feld])
    if (alt !== neu) liste.push({ field: feld, from: alt, to: neu })
  }
  return liste
}

/**
 * Ein Wert als Text für das Protokoll.
 *
 * Datumswerte werden als Kalendertag geführt, nicht als Zeitstempel: die
 * Fachdaten dieses Modells sind Tage (3.0), und ein Zeitstempel würde eine
 * Genauigkeit vorspiegeln, die die Eingabe nicht hat.
 */
function alsText(wert: unknown): string | null {
  if (wert === null || wert === undefined) return null
  if (wert instanceof Date) return wert.toISOString().slice(0, 10)
  if (typeof wert === 'object') return JSON.stringify(wert)
  return String(wert)
}

/* ------------------------------------------------------------------ */
/* Invarianten des Eintrags                                           */
/* ------------------------------------------------------------------ */

/**
 * Bedingungen aus 3.12, die über mehrere Felder laufen und die Prisma deshalb
 * nicht erzwingen kann — dieselbe Lage wie bei den Stammdaten
 * (lib/masterdata/invariants.ts). Sie stehen hier und nicht dort, weil der
 * Audit-Eintrag keine Stammdaten sind.
 */
export interface AuditVerletzung {
  readonly feld: string
  readonly grund: string
  readonly specReference: string
}

export function pruefeAuditEintrag(draft: AuditDraft): readonly AuditVerletzung[] {
  const verletzungen: AuditVerletzung[] = []

  // „Handelnder Benutzer — Pflicht; bei Systemläufen ein Systemkennzeichen."
  // Genau eines von beiden: ein Eintrag ohne beides wäre nicht zuzuordnen,
  // einer mit beidem widersprüchlich.
  if (draft.actor.kind === 'user' && draft.actor.userId.trim() === '') {
    verletzungen.push({
      feld: 'actorUserRef',
      grund: 'Der handelnde Benutzer ist Pflicht.',
      specReference: 'SPEC 3.12',
    })
  }
  if (draft.actor.kind === 'system' && draft.actor.label.trim() === '') {
    verletzungen.push({
      feld: 'actorUserRef',
      grund: 'Ein Systemlauf braucht ein Systemkennzeichen.',
      specReference: 'SPEC 3.12, 4.0 Regel 10',
    })
  }

  // „Handelnde Rollenzuweisung — Pflicht" (3.12). Erfüllbar nur beim
  // erfolgreichen Zugriff; bei der Verweigerung steht keine Zelle fest
  // (*offene Frage 44*).
  if (
    draft.result === 'success' &&
    draft.actor.kind === 'user' &&
    draft.actor.roleAssignmentId === null
  ) {
    verletzungen.push({
      feld: 'actingAsRoleAssignmentRef',
      grund:
        'Bei einem erfolgreichen Zugriff ist die handelnde Rollenzuweisung Pflicht — ' +
        'sie sagt, in welcher Funktion gehandelt wurde.',
      specReference: 'SPEC 3.12 (offene Frage 44)',
    })
  }

  if (draft.tenantId.trim() === '') {
    verletzungen.push({
      feld: 'tenantRef',
      grund: 'Der Mandant des Objekts ist Pflicht — er trägt die Sichtbarkeit nach [39].',
      specReference: 'SPEC 3.12',
    })
  }
  if (draft.objectRef.trim() === '') {
    verletzungen.push({
      feld: 'objectRef',
      grund: 'Der Verweis auf das Objekt ist Pflicht.',
      specReference: 'SPEC 3.12',
    })
  }

  // „Status vorher / nachher — Pflicht bei `transition`." `statusFrom` bleibt
  // bei der Anlage leer: davor gab es den Vorgang nicht (4.0, Spalte „Von").
  if (draft.operation === 'transition' && (draft.statusTo ?? '') === '') {
    verletzungen.push({
      feld: 'statusTo',
      grund: 'Ein Übergang nennt den Zielstatus.',
      specReference: 'SPEC 3.12, 4.0 Regel 3',
    })
  }
  // Umgekehrt: ein Status gehört zu einem Übergang oder zur Anlage, nicht zu
  // einem Lesezugriff.
  if (
    (draft.statusFrom ?? null) !== null &&
    draft.operation !== 'transition' &&
    draft.operation !== 'create'
  ) {
    verletzungen.push({
      feld: 'statusFrom',
      grund: 'Ein Statuswert gehört zu einem Übergang, nicht zu dieser Operation.',
      specReference: 'SPEC 3.12',
    })
  }

  // „Geänderte Felder — Pflicht bei `update`."
  if (draft.operation === 'update' && (draft.changedFields ?? []).length === 0) {
    verletzungen.push({
      feld: 'changedFields',
      grund: 'Eine Änderung nennt die geänderten Felder.',
      specReference: 'SPEC 3.12',
    })
  }

  return verletzungen
}

export class AuditInvarianteError extends Error {}

export function pruefeAuditEintragOderWirf(draft: AuditDraft): void {
  const verletzungen = pruefeAuditEintrag(draft)
  if (verletzungen.length === 0) return
  throw new AuditInvarianteError(
    `Audit-Eintrag zu ${draft.objectType} ${draft.objectRef} verletzt SPEC 3.12:\n` +
      verletzungen
        .map((eintrag) => `  - ${eintrag.feld}: ${eintrag.grund} (${eintrag.specReference})`)
        .join('\n'),
  )
}
