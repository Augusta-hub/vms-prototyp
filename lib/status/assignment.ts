/**
 * Statusmodell des Einsatzes — SPEC 4.3.1, Objekt `assignment` (3.7).
 *
 * Zustände: `planned` → `active` ⇄ `interrupted`, dazu `completed` und
 * `terminatedEarly`. Endzustände sind `completed` und `terminatedEarly`.
 *
 * **„Verlängert" ist kein Zustand** (4.3.1, ausdrücklich): eine wirksame
 * Verlängerung verschiebt `plannedEndDate` und lässt den Einsatz in seinem
 * Zustand. Der Vorgang hat seinen eigenen Lebenszyklus (4.3.2,
 * lib/status/assignmentExtension.ts) — so bleibt sichtbar, ob eine
 * Verlängerung beantragt, genehmigt oder wirksam ist, ohne den Einsatz aus
 * `active` herauszunehmen und damit Zeiterfassung und Fristenlauf zu
 * unterbrechen.
 *
 * **Der Antrag auf vorzeitige Beendigung ist kein Zustand** (4.3.1): ein
 * offener Antrag ändert am Einsatz nichts. Erst die Wirksamkeit führt nach
 * `terminatedEarly`. Antrag, Genehmigung und Begründung stehen als Felder am
 * Einsatz (3.7) und sind Vorbedingung dieses Übergangs.
 *
 * Nicht vorhanden sind — und damit nicht ausdrückbar:
 *
 *  - `completed` oder `terminatedEarly` → `active`: eine erneute Überlassung
 *    derselben Person beim selben Kunden ist ein **neuer** Einsatz und zählt
 *    nach 5.1 weiter, statt neu zu beginnen.
 *  - `planned` → `completed`: ein Einsatz, der nie begonnen hat, wird
 *    `terminatedEarly` mit Begründung — so bleibt erkennbar, dass keine
 *    Arbeitsleistung erbracht wurde. Das ist auch die Rücknahme vor Beginn.
 *  - ein Zustand `blocked`: eine AÜG-Sperre verhindert den Übergang, der
 *    Einsatz bleibt stehen (4.0, Regel 5).
 *  - ein zeitgesteuerter Übergang nach `active` oder `completed`: der Beginn
 *    wird bestätigt, nicht unterstellt, und das tatsächliche Ende wird
 *    festgestellt — `actualStartDate` und `actualEndDate` sind die Grundlage
 *    von Fristenlauf und Abrechnung.
 *  - eine **stille** Verlängerung: das Verschieben von `plannedEndDate` ohne
 *    Verlängerungsvorgang ist unzulässig (3.7).
 *  - `interrupted` → `completed`: endet der Einsatz während einer
 *    Unterbrechung, ist das `terminatedEarly`.
 */
import type { Precondition, StatusModel, TransitionDefinition } from './machine'

export type AssignmentState =
  | 'planned'
  | 'active'
  | 'interrupted'
  | 'completed'
  | 'terminatedEarly'

/** Seite, die die vorzeitige Beendigung beantragt hat (4.3.1, Zuweisung der Genehmigung). */
export type TerminationRequestSide = 'customer' | 'supplier' | 'operator'

/**
 * Die Tatsachen, die die Vorbedingungen aus 4.3.1 brauchen. Erhoben vom
 * Aufrufer (lib/services/staffing.ts), nicht hier gelesen.
 *
 * **Die Prüfergebnisse aus Kapitel 5 sind benannte Tatsachen, keine Aufrufe.**
 * Dieses Modul rechnet keine AÜG-Regel: `hasAcceptedValidPermit` (P9),
 * `mandatoryDocumentsPresent` (P10), `noIndustrialActionAtSite` (P7),
 * `maxDurationExceeded` (P1), `concretizationComplete` (P8),
 * `hasPreviousEmploymentDeclaration` (P6), `employmentRelationshipOnFirstDay`
 * (P11) und das Paar `equalPayDueFromFirstDay` / `comparableWagePresent` (P4)
 * kommen aus `lib/aueg/`. P9 und P10 rechnen dort bereits; P1, P6, P8, P11 und
 * P4 stehen aus. Bis dahin liefert der Aufrufer den nicht sperrenden Wert —
 * dieselbe Lösung, mit der 4.1 und 4.2.1 vor P9 gearbeitet haben, und die
 * einzige, die den Vorgang nicht stillschweigend durchlässt: der Name der
 * Tatsache steht im Modell und ist damit auffindbar.
 */
export interface AssignmentFacts {
  /** Status des Profilvorschlags (4.2.3); `null` bei Einsatz ohne vorangegangene Anfrage. */
  readonly submissionStatus:
    | 'draft'
    | 'submitted'
    | 'reviewed'
    | 'releasedToCustomer'
    | 'interviewScheduled'
    | 'accepted'
    | 'rejected'
    | 'withdrawn'
    | null
  /** Lieferantenstatus (4.6). */
  readonly supplierStatus: 'onboarding' | 'active' | 'blocked' | 'inactive'
  /** Eigene Tätigkeitsbeschreibung des Einsatzes (3.7, 5.3.3). */
  readonly activityDescription: string
  /** Preisposition beider Seiten vereinbart (3.7): Einkaufs- und Verkaufsseite. */
  readonly agreedRateCardItemPresent: boolean
  readonly customerRateCardItemPresent: boolean
  /**
   * Bestätigte Personenidentität vorhanden (3.7: Pflicht ab `planned`). Ein
   * nur **vorgeschlagener** Treffer genügt nicht (3.6, Entscheidung zu
   * Frage 18).
   */
  readonly workerIdentityConfirmed: boolean
  readonly plannedStartDate: Date | null
  readonly plannedEndDate: Date | null
  readonly actualStartDate: Date | null
  readonly actualEndDate: Date | null
  /** Eine Unterbrechung ohne `interruptionTo` (3.7). */
  readonly hasRunningInterruption: boolean
  /** Die zu erfassende Unterbrechung: Beginn und Grund sind Pflicht (3.7). */
  readonly interruptionFrom: Date | null
  readonly interruptionReason: string | null
  /** `interruptionTo` der Unterbrechung, die beendet wird (3.7). */
  readonly interruptionTo: Date | null
  readonly terminationReason: string | null
  readonly terminationRequestedById: string | null
  readonly terminationRequestedBySide: TerminationRequestSide | null
  /** Genehmigung durch `KG` ([26]) — **nur** bei Antrag der Kundenseite nötig. */
  readonly terminationApprovedById: string | null
  // ── Ergebnisse des Regelwerks aus Kapitel 5 ───────────────────────────────
  readonly hasAcceptedValidPermit: boolean
  readonly mandatoryDocumentsPresent: boolean
  readonly noIndustrialActionAtSite: boolean
  readonly maxDurationExceeded: boolean
  readonly concretizationComplete: boolean
  readonly hasPreviousEmploymentDeclaration: boolean
  readonly employmentRelationshipOnFirstDay: boolean
  readonly equalPayDueFromFirstDay: boolean
  readonly comparableWagePresent: boolean
  /** Stichtag der Prüfung; nie „heute" im Rechenweg (5.0). */
  readonly evaluationDate: Date
}

type AssignmentPrecondition = Precondition<AssignmentFacts>
type AssignmentTransition = TransitionDefinition<AssignmentState, AssignmentFacts>

const permitValid: AssignmentPrecondition = {
  ruleRef: 'P9',
  description: 'P9: AÜG-Erlaubnis des Lieferanten anerkannt und gültig (5.4.1).',
  specReference: 'SPEC 4.3.1; 5.4.1',
  isSatisfied: (facts) => facts.hasAcceptedValidPermit,
}

const noIndustrialAction: AssignmentPrecondition = {
  ruleRef: 'P7',
  description:
    'P7: kein Arbeitskampf am Standort oder Zusicherung nach § 11 Abs. 5 Satz 2 AÜG (5.3.2).',
  specReference: 'SPEC 4.3.1; 5.3.2',
  isSatisfied: (facts) => facts.noIndustrialActionAtSite,
}

const withinMaxDuration: AssignmentPrecondition = {
  ruleRef: 'P1',
  description: 'P1: Fristende der Höchstüberlassungsdauer nicht erreicht — sonst Sperre (5.1).',
  specReference: 'SPEC 4.3.1; 5.1, 5.5.5',
  isSatisfied: (facts) => !facts.maxDurationExceeded,
}

const terminationRequested: AssignmentPrecondition = {
  description:
    '`terminationReason` und `terminationRequestedBy` sind Pflicht; `actualEndDate` gesetzt (3.7).',
  specReference: 'SPEC 4.3.1, → terminatedEarly; 3.7',
  isSatisfied: (facts) =>
    facts.terminationReason !== null &&
    facts.terminationReason.trim() !== '' &&
    facts.terminationRequestedById !== null &&
    facts.actualEndDate !== null,
}

const customerRequestApproved: AssignmentPrecondition = {
  description:
    'Bei Antrag der **Kundenseite**: Genehmigung durch `KG` liegt vor ([26], 4.3.1). Auf Antrag ' +
    'des Lieferanten wird der Kunde unterrichtet, nicht gefragt; aus Rechtsgründen setzt `MD` ' +
    'sie mit Pflichtbegründung wirksam.',
  specReference: 'SPEC 4.3.1, Zuweisung der Genehmigung; Fußnote [26]',
  isSatisfied: (facts) =>
    facts.terminationRequestedBySide !== 'customer' || facts.terminationApprovedById !== null,
}

const TRANSITIONS = {
  /**
   * | — | `planned` | `MD`, `MA` | Profilvorschlag in `accepted` (4.2.3) oder
   * Einsatz ohne vorangegangene Anfrage; Lieferant `active` (4.6); eigene
   * `activityDescription`; vereinbarte Preisposition beider Seiten; P1, P8 und
   * P9 ohne Sperre; P6 ohne Sperre; P11 als Warnung zulässig |
   */
  create: {
    from: [],
    to: 'planned',
    label: 'Einsatz anlegen',
    roles: ['operatorCoordinator', 'operatorAdmin'],
    specReference: 'SPEC 4.3.1, — → planned',
    preconditions: [
      {
        description:
          'Profilvorschlag steht in `accepted` (4.2.3) — oder es gibt keinen, weil der Einsatz ' +
          'ohne vorangegangene Anfrage entsteht (3.7).',
        specReference: 'SPEC 4.3.1, — → planned; 4.2.3',
        isSatisfied: (facts) =>
          facts.submissionStatus === null || facts.submissionStatus === 'accepted',
      },
      {
        description: 'Lieferant steht in `active` (4.6).',
        specReference: 'SPEC 4.3.1, — → planned; 4.6',
        isSatisfied: (facts) => facts.supplierStatus === 'active',
      },
      {
        description: 'Eigene Tätigkeitsbeschreibung und geplanter Beginn (3.7).',
        specReference: 'SPEC 4.3.1, — → planned; 3.7',
        isSatisfied: (facts) =>
          facts.activityDescription.trim() !== '' && facts.plannedStartDate !== null,
      },
      {
        description: 'Vereinbarte Preisposition beider Seiten (3.7): Einkauf und Verkauf.',
        specReference: 'SPEC 4.3.1, — → planned; 3.3, 3.7',
        isSatisfied: (facts) =>
          facts.agreedRateCardItemPresent && facts.customerRateCardItemPresent,
      },
      {
        description:
          'Bestätigte Personenidentität vorhanden — `workerIdentityRef` ist ab `planned` Pflicht ' +
          '(3.7) und Grundlage der Zählung nach 5.1. Ein nur vorgeschlagener Treffer genügt ' +
          'nicht (3.6).',
        specReference: 'SPEC 3.7, assignment.workerIdentityRef; 3.6',
        isSatisfied: (facts) => facts.workerIdentityConfirmed,
      },
      withinMaxDuration,
      {
        ruleRef: 'P8',
        description: 'P8: Kennzeichnung und Konkretisierung vollständig (5.3.3).',
        specReference: 'SPEC 4.3.1, — → planned; 5.3.3',
        isSatisfied: (facts) => facts.concretizationComplete,
      },
      permitValid,
      {
        ruleRef: 'P6',
        description:
          'P6: Erklärung zur Vorbeschäftigung liegt vor — ohne sie ist die Drehtürprüfung nicht ' +
          'prüfbar und der Übergang gesperrt (5.3.1).',
        specReference: 'SPEC 4.3.1, — → planned; 5.3.1, 5.5.5',
        isSatisfied: (facts) => facts.hasPreviousEmploymentDeclaration,
      },
    ],
  },

  /**
   * | `planned` | `active` | `MD` | `actualStartDate` gesetzt; P9; P10; P7;
   * P1 Fristende nicht überschritten; P8 rechtzeitig und vollständig; P11
   * Arbeitsverhältnis am ersten Überlassungstag; P4 Vergleichsentgelt, soweit
   * Equal Pay ab dem ersten Tag geschuldet ist |
   */
  start: {
    from: ['planned'],
    to: 'active',
    label: 'Beginn bestätigen',
    roles: ['operatorCoordinator'],
    specReference: 'SPEC 4.3.1, planned → active',
    preconditions: [
      {
        description: '`actualStartDate` ist gesetzt — der Beginn wird bestätigt, nicht unterstellt.',
        specReference: 'SPEC 4.3.1, planned → active',
        isSatisfied: (facts) => facts.actualStartDate !== null,
      },
      permitValid,
      {
        ruleRef: 'P10',
        description: 'P10: Pflichtnachweise vorhanden (5.4.4).',
        specReference: 'SPEC 4.3.1, planned → active; 5.4.4',
        isSatisfied: (facts) => facts.mandatoryDocumentsPresent,
      },
      noIndustrialAction,
      withinMaxDuration,
      {
        ruleRef: 'P8',
        description: 'P8: Konkretisierung vollständig und rechtzeitig (5.3.3).',
        specReference: 'SPEC 4.3.1, planned → active; 5.3.3',
        isSatisfied: (facts) => facts.concretizationComplete,
      },
      {
        ruleRef: 'P11',
        description: 'P11: Arbeitsverhältnis beim Verleiher besteht am ersten Überlassungstag (5.3.4).',
        specReference: 'SPEC 4.3.1, planned → active; 5.3.4',
        isSatisfied: (facts) => facts.employmentRelationshipOnFirstDay,
      },
      {
        ruleRef: 'P4',
        description:
          'P4: Vergleichsentgelt vorhanden, soweit Equal Pay ab dem ersten Tag geschuldet ist ' +
          '(5.2).',
        specReference: 'SPEC 4.3.1, planned → active; 5.2',
        isSatisfied: (facts) => !facts.equalPayDueFromFirstDay || facts.comparableWagePresent,
      },
    ],
  },

  /**
   * | `active` | `interrupted` | `MD`, auf Anzeige von `LD` oder `KB` ([25]) |
   * Unterbrechung (3.7) mit `interruptionFrom` und Grund angelegt |
   */
  interrupt: {
    from: ['active'],
    to: 'interrupted',
    label: 'unterbrechen',
    roles: ['operatorCoordinator'],
    specReference: 'SPEC 4.3.1, active → interrupted',
    preconditions: [
      {
        description: 'Unterbrechung mit `interruptionFrom` und Grund angelegt (3.7).',
        specReference: 'SPEC 4.3.1, active → interrupted; 3.7',
        isSatisfied: (facts) =>
          facts.interruptionFrom !== null &&
          facts.interruptionReason !== null &&
          facts.interruptionReason.trim() !== '',
      },
    ],
  },

  /**
   * | `interrupted` | `active` | `MD` | `interruptionTo` gesetzt; P9 weiterhin
   * gültig; P7 kein Arbeitskampf; P1 Fristende am Wiederaufnahmetag nicht
   * erreicht — sonst **Sperre** (5.5.5, Q26) |
   */
  resume: {
    from: ['interrupted'],
    to: 'active',
    label: 'fortsetzen',
    roles: ['operatorCoordinator'],
    specReference: 'SPEC 4.3.1, interrupted → active',
    preconditions: [
      {
        description: '`interruptionTo` ist gesetzt (3.7).',
        specReference: 'SPEC 4.3.1, interrupted → active; 3.7',
        isSatisfied: (facts) => facts.interruptionTo !== null,
      },
      permitValid,
      noIndustrialAction,
      withinMaxDuration,
    ],
  },

  /**
   * | `active` | `completed` | `MD` | `plannedEndDate` erreicht;
   * `actualEndDate` gesetzt; keine laufende Unterbrechung |
   */
  complete: {
    from: ['active'],
    to: 'completed',
    label: 'regulär beenden',
    roles: ['operatorCoordinator'],
    specReference: 'SPEC 4.3.1, active → completed',
    preconditions: [
      {
        description: '`plannedEndDate` ist erreicht (Stichtag ≥ geplantes Ende).',
        specReference: 'SPEC 4.3.1, active → completed',
        isSatisfied: (facts) =>
          facts.plannedEndDate !== null &&
          facts.plannedEndDate.getTime() <= facts.evaluationDate.getTime(),
      },
      {
        description: '`actualEndDate` ist gesetzt — Grundlage von Abrechnung und Fristenlauf.',
        specReference: 'SPEC 4.3.1, active → completed',
        isSatisfied: (facts) => facts.actualEndDate !== null,
      },
      {
        description: 'Keine laufende Unterbrechung; sonst ist das Ende `terminatedEarly`.',
        specReference: 'SPEC 4.3.1, active → completed; Ausgeschlossen',
        isSatisfied: (facts) => !facts.hasRunningInterruption,
      },
    ],
  },

  /**
   * | `planned`, `active`, `interrupted` | `terminatedEarly` | `MD` setzt
   * wirksam; Antrag durch `KB` oder `LD` ([25]); Genehmigung durch `KG` ([26])
   * **nur** bei Antrag der Kundenseite |
   *
   * Hierher führt auch die **Rücknahme vor Beginn**: ein Einsatz, der nie
   * begonnen hat, wird `terminatedEarly` mit Begründung (4.3.1,
   * Ausgeschlossen: kein `planned` → `completed`).
   */
  terminateEarly: {
    from: ['planned', 'active', 'interrupted'],
    to: 'terminatedEarly',
    label: 'vorzeitig beenden',
    roles: ['operatorCoordinator'],
    specReference: 'SPEC 4.3.1, planned|active|interrupted → terminatedEarly',
    preconditions: [terminationRequested, customerRequestApproved],
  },
} as const satisfies Readonly<Record<string, AssignmentTransition>>

export const ASSIGNMENT_MODEL: StatusModel<AssignmentState, AssignmentFacts, typeof TRANSITIONS> = {
  object: 'Einsatz (3.7)',
  specReference: 'SPEC 4.3.1',
  states: ['planned', 'active', 'interrupted', 'completed', 'terminatedEarly'],
  terminalStates: ['completed', 'terminatedEarly'],
  transitions: TRANSITIONS,
}

export type AssignmentTransitionName = keyof typeof TRANSITIONS & string

/** Deutsche Bezeichnung der Zustände (4.3.1), für die Oberfläche. */
export const ASSIGNMENT_STATE_LABELS: { readonly [S in AssignmentState]: string } = {
  planned: 'geplant',
  active: 'aktiv',
  interrupted: 'unterbrochen',
  completed: 'beendet',
  terminatedEarly: 'vorzeitig beendet',
}
