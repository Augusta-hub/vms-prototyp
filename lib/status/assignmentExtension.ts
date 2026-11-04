/**
 * Statusmodell der Verlängerung — SPEC 4.3.2, Objekt `assignmentExtension`
 * (3.7).
 *
 * Zustände: `requested` → `approved` → `effective`, dazu `rejected` und
 * `withdrawn`. Endzustände sind `effective`, `rejected` und `withdrawn`.
 *
 * Die Verlängerung ist ein **eigener Vorgang**, keine stille Änderung von
 * `plannedEndDate` (3.7). Erst `approved` → `effective` verschiebt das Ende des
 * Einsatzes; der Einsatz selbst bleibt dabei in `planned` bzw. `active`
 * (4.3.1).
 *
 * Nicht vorhanden sind — und damit nicht ausdrückbar:
 *
 *  - `requested` → `effective`: ohne kundenseitige Genehmigung wird keine
 *    Verlängerung wirksam. Der Betreiber ersetzt die Entscheidung nicht (2.4,
 *    Regel 3) — und die Verlängerung ist **immer** genehmigungspflichtig,
 *    unabhängig davon, wer sie beantragt (4.3.1, Zuweisung der Genehmigung).
 *  - `approved` → `rejected`: eine genehmigte, aber nicht gewollte Verlängerung
 *    wird nicht wirksam gesetzt und läuft über die Frist aus; der Vorgang
 *    bleibt in `approved` und ist dokumentiert.
 *  - ein zeitgesteuerter Übergang nach `approved` oder `effective`: Fristablauf
 *    verlängert nichts (2.4, Regel 1).
 *  - eine Rückgängigmachung von `effective`: das verkürzte Ende ist eine
 *    vorzeitige Beendigung des Einsatzes (4.3.1).
 */
import type { Precondition, StatusModel, TransitionDefinition } from './machine'

export type AssignmentExtensionState =
  | 'requested'
  | 'approved'
  | 'rejected'
  | 'effective'
  | 'withdrawn'

/**
 * Die Tatsachen, die die Vorbedingungen aus 4.3.2 brauchen. Erhoben vom
 * Aufrufer (lib/services/staffing.ts).
 *
 * `maxDurationEndDate` und `hasAcceptedValidPermitForNewPeriod` sind Ergebnisse
 * aus Kapitel 5 (P1 und P9); P1 steht noch aus und wird mit `lib/aueg/`
 * angebunden. P3 (Equal-Pay-Fälligkeit) ist am Übergang `requested` →
 * `approved` eine **Vorschau** ohne Sperrwirkung und deshalb keine
 * Vorbedingung, sondern `ruleCheckResult` am Vorgang (3.7).
 */
export interface AssignmentExtensionFacts {
  /** Status des Einsatzes (4.3.1). */
  readonly assignmentStatus: 'planned' | 'active' | 'interrupted' | 'completed' | 'terminatedEarly'
  /** Bisheriges Ende des Einsatzes (`plannedEndDate`, 3.7). */
  readonly currentEndDate: Date | null
  readonly newEndDate: Date | null
  readonly reason: string | null
  readonly requestedById: string | null
  /** Handelnde Person; `null` beim Systemübergang. */
  readonly actingUserId: string | null
  readonly approvedById: string | null
  readonly rejectionReason: string | null
  /**
   * P1: `newEndDate` liegt innerhalb von `maxDurationEndDate` (5.1). Eine
   * Verlängerung darüber hinaus ist **gesperrt**, solange keine dokumentierte
   * Übersteuerung nach 5.5.4 vorliegt (*offene Frage 10*).
   */
  readonly newEndWithinMaxDuration: boolean
  /** P9: Erlaubnis für den verlängerten Zeitraum gültig (5.4.1). */
  readonly hasAcceptedValidPermitForNewPeriod: boolean
  /** Stichtag der Prüfung; nie „heute" im Rechenweg (5.0). */
  readonly evaluationDate: Date
}

type ExtensionPrecondition = Precondition<AssignmentExtensionFacts>
type ExtensionTransition = TransitionDefinition<AssignmentExtensionState, AssignmentExtensionFacts>

const notTheRequester: ExtensionPrecondition = {
  description:
    'Auslöser ist nicht der Antragsteller: wer beantragt, genehmigt nicht — auch nicht in ' +
    'Vertretung (2.4, Regel 5).',
  specReference: 'SPEC 4.3.2, requested → approved; 2.4, Regel 5',
  isSatisfied: (facts) =>
    facts.actingUserId !== null && facts.actingUserId !== facts.requestedById,
}

const TRANSITIONS = {
  /**
   * | — | `requested` | `KB` ([25]), `LD` ([25]), `MD` | Einsatz in `planned`,
   * `active` oder `interrupted`; `newEndDate` nach dem bisherigen Ende;
   * Begründung Pflicht |
   */
  request: {
    from: [],
    to: 'requested',
    label: 'Verlängerung beantragen',
    roles: ['demandOwner', 'supplierCoordinator', 'operatorCoordinator'],
    // 2.2 gibt `KB` und `LD` an dieser Zeile `S[25]` und **kein** `A`: der
    // Antrag ist die Statusführung des Vorgangs, nicht das Anlegen eines
    // Einsatzes. Deshalb `transition` statt der Vorbelegung `create`.
    operation: 'transition',
    specReference: 'SPEC 4.3.2, — → requested',
    preconditions: [
      {
        description: 'Einsatz steht in `planned`, `active` oder `interrupted` (4.3.1).',
        specReference: 'SPEC 4.3.2, — → requested; 4.3.1',
        isSatisfied: (facts) =>
          facts.assignmentStatus === 'planned' ||
          facts.assignmentStatus === 'active' ||
          facts.assignmentStatus === 'interrupted',
      },
      {
        description:
          '`newEndDate` liegt nach dem bisherigen Ende (3.7). Hat der Einsatz kein geplantes ' +
          'Ende, gibt es nichts zu verschieben.',
        specReference: 'SPEC 4.3.2, — → requested; 3.7',
        isSatisfied: (facts) =>
          facts.newEndDate !== null &&
          facts.currentEndDate !== null &&
          facts.newEndDate.getTime() > facts.currentEndDate.getTime(),
      },
      {
        description: 'Begründung ist Pflicht (3.7).',
        specReference: 'SPEC 4.3.2, — → requested; 3.7',
        isSatisfied: (facts) => facts.reason !== null && facts.reason.trim() !== '',
      },
    ],
  },

  /** | `requested` | `approved` | `KG` ([26]) | Auslöser ist nicht `requestedBy` | */
  approve: {
    from: ['requested'],
    to: 'approved',
    label: 'genehmigen',
    roles: ['approver'],
    specReference: 'SPEC 4.3.2, requested → approved',
    preconditions: [notTheRequester],
  },

  /** | `requested` | `rejected` | `KG` ([26]) | Begründung Pflicht | */
  reject: {
    from: ['requested'],
    to: 'rejected',
    label: 'ablehnen',
    roles: ['approver'],
    specReference: 'SPEC 4.3.2, requested → rejected',
    preconditions: [
      {
        description: 'Begründung ist Pflicht; der Einsatz endet zum unveränderten `plannedEndDate`.',
        specReference: 'SPEC 4.3.2, requested → rejected',
        isSatisfied: (facts) =>
          facts.rejectionReason !== null && facts.rejectionReason.trim() !== '',
      },
    ],
  },

  /**
   * | `requested` | `withdrawn` | Antragsteller (`KB`, `LD` oder `MD`) | Noch
   * nicht genehmigt |
   *
   * „Noch nicht genehmigt" ist durch die Spalte „Von" erfüllt: aus `approved`
   * führt nur `effective`.
   */
  withdraw: {
    from: ['requested'],
    to: 'withdrawn',
    label: 'zurückziehen',
    roles: ['demandOwner', 'supplierCoordinator', 'operatorCoordinator'],
    specReference: 'SPEC 4.3.2, requested → withdrawn',
    preconditions: [
      {
        description: 'Zurückziehen darf nur der Antragsteller selbst (4.3.2).',
        specReference: 'SPEC 4.3.2, requested → withdrawn',
        isSatisfied: (facts) =>
          facts.actingUserId !== null && facts.actingUserId === facts.requestedById,
      },
    ],
  },

  /**
   * | `approved` | `effective` | `MD` | P1 `newEndDate` innerhalb von
   * `maxDurationEndDate` — sonst **Sperre**; P9 Erlaubnis für den verlängerten
   * Zeitraum gültig; P3 Equal-Pay-Fälligkeit geprüft |
   */
  makeEffective: {
    from: ['approved'],
    to: 'effective',
    label: 'wirksam setzen',
    roles: ['operatorCoordinator'],
    specReference: 'SPEC 4.3.2, approved → effective',
    preconditions: [
      {
        description:
          'P1: `newEndDate` liegt innerhalb von `maxDurationEndDate` — sonst Sperre (5.1, 5.5). ' +
          'Eine Verlängerung darüber hinaus braucht eine dokumentierte Übersteuerung nach 5.5.4 ' +
          '(*offene Frage 10*).',
        specReference: 'SPEC 4.3.2, approved → effective; 5.1, 5.5',
        isSatisfied: (facts) => facts.newEndWithinMaxDuration,
      },
      {
        description: 'P9: Erlaubnis für den verlängerten Zeitraum gültig (5.4.1).',
        specReference: 'SPEC 4.3.2, approved → effective; 5.4.1',
        isSatisfied: (facts) => facts.hasAcceptedValidPermitForNewPeriod,
      },
    ],
  },
} as const satisfies Readonly<Record<string, ExtensionTransition>>

export const ASSIGNMENT_EXTENSION_MODEL: StatusModel<
  AssignmentExtensionState,
  AssignmentExtensionFacts,
  typeof TRANSITIONS
> = {
  object: 'Verlängerung (3.7)',
  specReference: 'SPEC 4.3.2',
  states: ['requested', 'approved', 'rejected', 'effective', 'withdrawn'],
  terminalStates: ['effective', 'rejected', 'withdrawn'],
  transitions: TRANSITIONS,
}

export type AssignmentExtensionTransitionName = keyof typeof TRANSITIONS & string

/** Deutsche Bezeichnung der Zustände (4.3.2), für die Oberfläche. */
export const ASSIGNMENT_EXTENSION_STATE_LABELS: {
  readonly [S in AssignmentExtensionState]: string
} = {
  requested: 'beantragt',
  approved: 'genehmigt',
  rejected: 'abgelehnt',
  effective: 'wirksam',
  withdrawn: 'zurückgezogen',
}
