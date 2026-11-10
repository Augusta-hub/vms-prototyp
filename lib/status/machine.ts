/**
 * Statusmodelle als **geschlossene Übergangsmenge** (SPEC Kapitel 4).
 *
 * Kapitel 4.0, Regel 1 ist die Vorgabe: „Ein Status wechselt ausschließlich
 * durch einen in diesem Kapitel genannten Übergang. Was nicht aufgeführt ist,
 * ist nicht zulässig — auch nicht ‚aus Versehen' durch eine Feldänderung."
 *
 * Deshalb gibt es in dieser Umsetzung **keine** Funktion, die einen Status
 * setzt. Ein Übergang wird über seinen **Namen** angefordert; die Namen sind
 * die Schlüssel der Übergangstabelle eines Modells. Ein Übergang, den
 * Kapitel 4 nicht nennt, hat keinen Namen und ist damit nicht ausdrückbar —
 * die Regel ist eine Eigenschaft des Typsystems, keine Laufzeitprüfung, die man
 * vergessen kann (CLAUDE.md, Tech-Stack).
 *
 * Geprüft wird in dieser Reihenfolge, die 4.0 vorgibt:
 *
 *  1. **Ist der Übergang genannt** und führt er aus dem aktuellen Zustand?
 *     (Regel 1 und 9: aus einem Endzustand führt kein Übergang zurück.)
 *  2. **Löst die Rolle ihn aus?** Kapitel 4 nennt je Übergang die auslösende
 *     Rolle; ein Systemübergang hat keine (Regel 10).
 *  3. **Berechtigung, dreifach bedingt** (Regel 2): `S` in der Matrix 2.2 —
 *     bei der Anlage `A` —, die Mandantenzuordnung und die Zuständigkeit. Das
 *     entscheidet `checkPermission`; hier wird keine zweite Rechteprüfung
 *     gebaut.
 *  4. **Vorbedingungen** des Übergangs aus der Spalte „Vorbedingungen".
 *
 * Nebenwirkungen (Benachrichtigungen, Fristenlauf, Folgeübergänge) sind
 * **nicht** Teil dieser Schicht: sie gehören in den Vorgang, der den Übergang
 * vollzieht. Dazu gehört auch der Audit-Eintrag aus 4.0, Regel 3: diese
 * Schicht **schreibt nichts**, trägt aber in `TransitionOutcome` und
 * `Rejection` alles, was der Eintrag braucht (3.12). Gebaut wird er in
 * lib/audit/transitions.ts, geschrieben in der Transaktion des Vorgangs.
 */
import { checkPermission, type Decision, type ResourceRef, type Subject } from '../authz/check'
import { ROLE_CATALOG, type RoleCode } from '../authz/roles'

/** Eine Vorbedingung aus der Spalte „Vorbedingungen" in Kapitel 4. */
export interface Precondition<TFacts> {
  /** Wortlaut der Vorbedingung, für Oberfläche und Protokoll. */
  readonly description: string
  readonly specReference: string
  readonly isSatisfied: (facts: TFacts) => boolean
  /**
   * Die Prüfung aus Kapitel 5, die hinter dieser Vorbedingung steht — `P9`,
   * `P10`, `P1` … Gesetzt **nur** dort, wo 4.7 dem Übergang eine Prüfung
   * zuordnet; eine Vorbedingung des Vorgangs selbst (eine Pflichtangabe, eine
   * Vier-Augen-Bedingung) trägt keine.
   *
   * Der Unterschied ist nicht kosmetisch: er entscheidet, ob eine
   * fehlgeschlagene Vorbedingung im Protokoll als **Sperre** (`blocked`, mit
   * `ruleRef`) oder als Verweigerung erscheint (3.12, 4.0 Regel 5).
   */
  readonly ruleRef?: string
}

/** Eine Zeile der Übergangstabelle eines Statusmodells. */
export interface TransitionDefinition<TState extends string, TFacts> {
  /**
   * Zustände, aus denen der Übergang führt. **Leer** heißt Anlage — das „—"
   * in der Spalte „Von" von Kapitel 4.
   */
  readonly from: readonly TState[]
  readonly to: TState
  /** Die Handlung, wie Kapitel 4 sie benennt (deutsch). */
  readonly label: string
  /**
   * Auslösende Rollen. **Leer** heißt Systemübergang (4.0, Regel 10): kein
   * Benutzer löst ihn aus, der Audit-Eintrag trägt ein Systemkennzeichen.
   */
  readonly roles: readonly RoleCode[]
  readonly specReference: string
  readonly preconditions: readonly Precondition<TFacts>[]
  /**
   * Die Operation der Matrix 2.2, die dieser Übergang braucht.
   *
   * Vorbelegung: `create` bei der Anlage (`from: []`), sonst `transition` —
   * das ist die Lesart von 2.2 („`S` meint nur die Übergänge, die Kapitel 4
   * der Rolle zuweist") und trifft auf die Vorgänge aus 3.4 und 3.5 zu.
   *
   * **Eine Ausnahme nennt die Matrix selbst.** Bei der Verlängerung (3.7) ist
   * der Antrag in 2.2 ein `S[25]` für `KB` und `LD` und ausdrücklich **kein**
   * `A`: der Vorgang entsteht mit dem Antrag, und die Zeile gibt den beiden
   * Rollen kein Anlegerecht am Einsatz. Dort trägt der Übergang deshalb
   * `operation: 'transition'`. Die Angabe ist hier ablesbar, statt die Lücke
   * durch ein zusätzliches `A` in der Matrix zu schließen, das 2.2 nicht
   * vorsieht.
   */
  readonly operation?: 'create' | 'transition'
}

export interface StatusModel<
  TState extends string,
  TFacts,
  TTransitions extends Readonly<Record<string, TransitionDefinition<TState, TFacts>>>,
> {
  /** Objekt und Kapitelverweis, z. B. „Bedarfsanfrage (3.4)". */
  readonly object: string
  readonly specReference: string
  readonly states: readonly TState[]
  /** Endzustände (4.0, Regel 9): aus ihnen führt kein Übergang zurück. */
  readonly terminalStates: readonly TState[]
  readonly transitions: TTransitions
}

export type RejectionKind =
  | 'unknownTransition'
  | 'statusMismatch'
  | 'systemTransition'
  | 'roleNotTriggering'
  | 'notPermitted'
  | 'precondition'

export interface Rejection {
  readonly kind: RejectionKind
  readonly reason: string
  readonly specReference: string
  /** Die Prüfung aus Kapitel 5, an der es lag (nur bei `precondition`). */
  readonly ruleRef?: string
  /**
   * Die Entscheidung der Prüffunktion, soweit sie schon getroffen war.
   *
   * Bei `precondition` **war** der Zugriff erlaubt — die Handlung scheitert
   * erst an der Sache. Der Audit-Eintrag soll dann die Rollenzuweisung nennen,
   * in deren Funktion es versucht wurde (3.12); ohne dieses Feld wäre sie beim
   * Ablehnen verloren.
   */
  readonly decision?: Decision
}

export type TransitionOutcome<TState extends string> =
  | {
      readonly applied: true
      readonly from: TState | null
      readonly to: TState
      readonly label: string
      /** Entscheidung der Prüffunktion; leer beim Systemübergang. */
      readonly decision: Decision | null
      readonly specReference: string
    }
  | { readonly applied: false; readonly rejection: Rejection }

export interface TransitionRequest<TState extends string, TFacts> {
  /** Aktueller Zustand, oder `null` bei der Anlage. */
  readonly currentStatus: TState | null
  /** Handelnder Benutzer; `undefined` beim Systemübergang (4.0, Regel 10). */
  readonly subject?: Subject
  /** Der Vorgang. `targetStatus` setzt diese Schicht selbst. */
  readonly resource: Omit<ResourceRef, 'targetStatus'>
  readonly facts: TFacts
}

/**
 * Vollzieht die Prüfung eines Übergangs. Gibt die Entscheidung zurück und
 * schreibt **nichts**: das Speichern ist Sache des Aufrufers, der damit auch
 * die Nebenwirkungen aus Kapitel 4 verantwortet.
 */
export function attemptTransition<
  TState extends string,
  TFacts,
  TTransitions extends Readonly<Record<string, TransitionDefinition<TState, TFacts>>>,
>(
  model: StatusModel<TState, TFacts, TTransitions>,
  transition: keyof TTransitions & string,
  request: TransitionRequest<TState, TFacts>,
): TransitionOutcome<TState> {
  const definition: TransitionDefinition<TState, TFacts> | undefined = model.transitions[transition]
  if (definition === undefined) {
    return reject({
      kind: 'unknownTransition',
      reason: `${model.object} kennt keinen Übergang „${transition}".`,
      specReference: `${model.specReference}; 4.0, Regel 1`,
    })
  }

  // 1. Führt der Übergang aus dem aktuellen Zustand?
  if (definition.from.length === 0) {
    if (request.currentStatus !== null) {
      return reject({
        kind: 'statusMismatch',
        reason: `„${definition.label}" ist die Anlage; der Vorgang hat aber schon den Status „${request.currentStatus}".`,
        specReference: model.specReference,
      })
    }
  } else if (request.currentStatus === null) {
    return reject({
      kind: 'statusMismatch',
      reason: `„${definition.label}" setzt einen bestehenden Vorgang voraus.`,
      specReference: model.specReference,
    })
  } else if (!definition.from.includes(request.currentStatus)) {
    const terminal = model.terminalStates.includes(request.currentStatus)
    return reject({
      kind: 'statusMismatch',
      reason: terminal
        ? `„${request.currentStatus}" ist ein Endzustand; aus ihm führt kein Übergang zurück.`
        : `„${definition.label}" führt nur aus ${definition.from.join(', ')} — nicht aus „${request.currentStatus}".`,
      specReference: terminal ? `${model.specReference}; 4.0, Regel 9` : model.specReference,
    })
  }

  // 2. und 3. Auslösende Rolle und Berechtigung.
  let decision: Decision | null = null
  if (definition.roles.length === 0) {
    if (request.subject !== undefined) {
      return reject({
        kind: 'systemTransition',
        reason: `„${definition.label}" ist ein Systemübergang; eine Benutzerhandlung löst ihn nicht aus.`,
        specReference: `${model.specReference}; 4.0, Regel 10`,
      })
    }
  } else {
    if (request.subject === undefined) {
      return reject({
        kind: 'roleNotTriggering',
        reason: `„${definition.label}" braucht eine auslösende Rolle: ${abbreviations(definition.roles)}.`,
        specReference: model.specReference,
      })
    }
    // Nur die in Kapitel 4 genannten Rollen lösen den Übergang aus. Die
    // Prüffunktion bekommt deshalb ein Subjekt, dessen Rechte auf diese Rollen
    // eingeschränkt sind — ein anderes Recht derselben Person darf den Übergang
    // nicht tragen (4.0, Regel 2; 2.1: Rollen erben nicht voneinander).
    const triggeringGrants = request.subject.grants.filter((grant) =>
      definition.roles.includes(grant.roleCode),
    )
    if (triggeringGrants.length === 0) {
      return reject({
        kind: 'roleNotTriggering',
        reason: `„${definition.label}" löst nur ${abbreviations(definition.roles)} aus; der Benutzer trägt keine dieser Rollen.`,
        specReference: model.specReference,
      })
    }
    // Die Anlage ist in 2.2 die Operation `A`, nicht `S`: „— → draft" in
    // Kapitel 4 ist das Anlegen des Vorgangs, kein Statuswechsel. Alles
    // andere ist `S` (2.2, Lesart: „`S` meint nur die Übergänge, die
    // Kapitel 4 der Rolle zuweist"). Wo die Matrix es anders zuweist, sagt der
    // Übergang es selbst (`operation`, siehe `TransitionDefinition`).
    const operation =
      definition.operation ?? (definition.from.length === 0 ? 'create' : 'transition')
    decision = checkPermission({ ...request.subject, grants: triggeringGrants }, operation, {
      ...request.resource,
      targetStatus: definition.to,
    })
    if (!decision.allowed) {
      return reject({
        kind: 'notPermitted',
        reason: decision.denial.reason,
        specReference: decision.denial.specReference,
      })
    }
  }

  // 4. Vorbedingungen.
  const unmet = definition.preconditions.find(
    (precondition) => !precondition.isSatisfied(request.facts),
  )
  if (unmet !== undefined) {
    return reject({
      kind: 'precondition',
      reason: `Vorbedingung nicht erfüllt: ${unmet.description}`,
      specReference: unmet.specReference,
      ...(unmet.ruleRef !== undefined ? { ruleRef: unmet.ruleRef } : {}),
      ...(decision !== null ? { decision } : {}),
    })
  }

  return {
    applied: true,
    from: request.currentStatus,
    to: definition.to,
    label: definition.label,
    decision,
    specReference: definition.specReference,
  }
}

/**
 * Die Übergänge, die aus einem Zustand überhaupt führen — unabhängig von Rolle
 * und Vorbedingungen. Für Oberflächen, die zeigen, was als Nächstes möglich
 * ist, und für die Prüfung, dass ein Endzustand keinen Ausgang hat.
 */
export function transitionsFrom<
  TState extends string,
  TFacts,
  TTransitions extends Readonly<Record<string, TransitionDefinition<TState, TFacts>>>,
>(
  model: StatusModel<TState, TFacts, TTransitions>,
  status: TState | null,
): readonly (keyof TTransitions & string)[] {
  return (Object.keys(model.transitions) as (keyof TTransitions & string)[]).filter((name) => {
    const definition = model.transitions[name]
    if (definition === undefined) return false
    return status === null
      ? definition.from.length === 0
      : definition.from.includes(status)
  })
}

/** Ist dieser Zustand ein Endzustand (4.0, Regel 9)? */
export function isTerminal<
  TState extends string,
  TFacts,
  TTransitions extends Readonly<Record<string, TransitionDefinition<TState, TFacts>>>,
>(model: StatusModel<TState, TFacts, TTransitions>, status: TState): boolean {
  return model.terminalStates.includes(status)
}

function abbreviations(roles: readonly RoleCode[]): string {
  return roles.map((role) => ROLE_CATALOG[role].abbreviation).join(', ')
}

function reject<TState extends string>(rejection: Rejection): TransitionOutcome<TState> {
  return { applied: false, rejection }
}
