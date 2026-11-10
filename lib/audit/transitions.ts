/**
 * Audit-Einträge zu Statusübergängen und Anlagen (SPEC **3.12**, 4.0 Regel 3).
 *
 * „Jeder Übergang wird protokolliert. Ein Übergang erzeugt einen Audit-Eintrag
 * mit `operation = transition` und `statusFrom` / `statusTo` (3.12). Handlungen
 * in Vertretung tragen zusätzlich den Vertretungsvermerk" (4.0, Regel 3).
 *
 * Diese Datei ist die **eine** Stelle, an der aus einem `TransitionOutcome`
 * ein Eintrag wird. Jeder Fachdienst ruft sie auf, statt die Felder selbst
 * zusammenzusetzen: sonst wären Rollenzuweisung, Vertretungsvermerk und
 * Statuswerte in einem Dutzend Diensten je einzeln zu treffen — und einer
 * davon wäre falsch.
 *
 * **Die Anlage ist kein Übergang.** 4.0 nennt „— → draft" das Anlegen des
 * Vorgangs; in 2.2 ist das die Operation `A`. Der Eintrag trägt deshalb
 * `operation = create` und nur `statusTo` (3.12).
 */
import type { Rejection, TransitionOutcome } from '../status/machine'
import {
  handelnder,
  versuchOhneZuweisung,
  type AuditDraft,
  type AuditResult,
  type Protokollbezug,
} from './entry'

/**
 * Der Eintrag zu einem **vollzogenen** Übergang oder einer Anlage.
 *
 * `reason` ist dort zu setzen, wo Kapitel 4 eine Pflichtbegründung verlangt
 * (Sperrgrund, Aufhebungsgrund, Korrektur — [28], 4.6). Die Spalte
 * „Nebenwirkungen" nennt den Protokolleintrag nur dort gesondert, wo er über
 * den Pflichtumfang hinausgeht (4.0, Regel 3) — und das ist genau diese
 * Begründung.
 */
export function uebergangsEintrag(args: {
  readonly outcome: Extract<TransitionOutcome<string>, { applied: true }>
  readonly bezug: Protokollbezug
  readonly userId: string
  readonly occurredAt: Date
  readonly reason?: string | null
  readonly ruleRef?: string | null
}): AuditDraft {
  const { outcome, bezug } = args
  const anlage = outcome.from === null
  return {
    occurredAt: args.occurredAt,
    actor: handelnder(args.userId, outcome.decision),
    tenantId: bezug.tenantId,
    objectType: bezug.objectType,
    objectRef: bezug.objectRef,
    operation: anlage ? 'create' : 'transition',
    result: 'success',
    statusFrom: outcome.from,
    statusTo: outcome.to,
    reason: args.reason ?? null,
    ruleRef: args.ruleRef ?? null,
    crossTenant: outcome.decision?.allowed === true ? outcome.decision.crossTenant : false,
  }
}

/**
 * Der Eintrag zu einem **abgelehnten** Versuch (3.12: „abgelehnte Zugriffe
 * werden ebenfalls protokolliert").
 *
 * Er wird in einer **eigenen** Transaktion geschrieben, weil die Handlung
 * zurückrollt — siehe `protokolliereGetrennt` in lib/audit/record.ts.
 */
export function ablehnungsEintrag(args: {
  readonly rejection: Rejection
  readonly bezug: Protokollbezug
  readonly userId: string
  readonly occurredAt: Date
  /** Zustand, in dem der Vorgang stehen bleibt (4.0, Regel 5). */
  readonly statusFrom?: string | null
  /** Zielstatus des versuchten Übergangs, soweit bekannt. */
  readonly statusTo?: string | null
  /**
   * Die Operation der Matrix, die versucht wurde. Vorbelegung `transition`;
   * bei einer abgelehnten **Anlage** ist es `create`, weil 2.2 die Anlage als
   * `A` führt und nicht als `S`.
   */
  readonly operation?: 'create' | 'transition'
}): AuditDraft {
  const { rejection, bezug } = args
  return {
    occurredAt: args.occurredAt,
    actor:
      rejection.decision === undefined
        ? versuchOhneZuweisung(args.userId)
        : handelnder(args.userId, rejection.decision),
    tenantId: bezug.tenantId,
    objectType: bezug.objectType,
    objectRef: bezug.objectRef,
    // Protokolliert wird der **Versuch**, auch wenn er nicht stattgefunden
    // hat: sonst wäre im Protokoll nicht zu sehen, dass jemand es versucht
    // hat. `statusFrom` bleibt der Zustand, in dem der Vorgang stehen
    // geblieben ist (4.0, Regel 5).
    operation: args.operation ?? 'transition',
    result: ergebnisDerAblehnung(rejection),
    statusFrom: args.statusFrom ?? null,
    statusTo: args.statusTo ?? null,
    reason: rejection.reason,
    ruleRef: rejection.ruleRef ?? null,
    // Auch ein **abgelehnter** Zugriff kann über die Mandantengrenze gehen
    // (2.3, Bedingung 3) — soweit die Prüfung schon so weit gekommen war.
    crossTenant: rejection.decision?.allowed === true ? rejection.decision.crossTenant : false,
  }
}

/**
 * Verweigerung oder Sperre?
 *
 * 4.0 Regel 5 unterscheidet beides: ein Prüfergebnis „Sperre" aus Kapitel 5
 * verhindert einen Übergang, den die Rolle **durfte**. Eine Verweigerung nach
 * Kapitel 2 ist eine Aussage über Rechte. Im Protokoll sind das `blocked` und
 * `denied` (3.12).
 *
 * Erkennbar ist die Sperre an der `ruleRef`: nur eine Vorbedingung, die auf
 * eine Prüfung aus Kapitel 5 zeigt, ist eine Sperre im Sinne von 5.5. Eine
 * Vorbedingung des Vorgangs selbst — eine fehlende Pflichtangabe, das
 * Vier-Augen-Prinzip — ist keine.
 */
export function ergebnisDerAblehnung(rejection: Rejection): AuditResult {
  return rejection.kind === 'precondition' && rejection.ruleRef !== undefined
    ? 'blocked'
    : 'denied'
}
