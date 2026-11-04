/**
 * Statusmodell des Profilvorschlags — SPEC 4.2.3, Objekt `candidateSubmission`
 * (3.6).
 *
 * Zustände: `draft` → `submitted` → `reviewed` → `releasedToCustomer` →
 * `interviewScheduled` → `accepted`, dazu `rejected` und `withdrawn`.
 * Endzustände sind `accepted`, `rejected` und `withdrawn`.
 *
 * Die Tabelle unten ist die Übergangstabelle aus 4.2.3, Zeile für Zeile. Nicht
 * vorhanden sind — und damit nicht ausdrückbar:
 *
 *  - `accepted` → `rejected`: wird die Zusage hinfällig, ist das die
 *    vorzeitige Beendigung des Einsatzes (4.3).
 *  - eine **Zusage durch den Betreiber**: die fachliche Auswahl ist eine
 *    Kundenentscheidung ([24], 2.4 Regel 3). `MD` führt nur den Status
 *    gegenüber dem Lieferanten; deshalb trägt `accept` ausschließlich `KB`.
 *  - `releasedToCustomer` **ohne** Pseudonymisierung: der Übergang *ist* die
 *    Umsetzung der Datenminimierung (6.4). Eine Vorlage mit Klardaten ist kein
 *    Sonderfall, sondern unzulässig — deshalb eine Vorbedingung, keine Option.
 *  - ein zeitgesteuerter Übergang nach `rejected`: eine ausbleibende
 *    Rückmeldung des Kunden wird eskaliert (2.4), nicht entschieden. Der
 *    Profilvorschlag hat **keinen** Zustand `expired`.
 *  - ein Übergang, der einem Lieferanten einen Doppelvorschlag desselben
 *    Kandidaten offenbart (2.3, Regel 4): der Konflikt wird nur beim Betreiber
 *    sichtbar und ist deshalb keine Vorbedingung dieses Modells.
 *
 * **Die Ablehnung steht als zwei Übergänge.** 4.2.3 führt sie in einer Zeile,
 * weist sie aber rollenabhängig zu: `MD` ([17]) bei Vorgängen, die den Kunden
 * nicht erreicht haben, `KB` ([24]) danach. Die Zustandsmengen sind damit
 * verschieden (`submitted`, `reviewed` gegen `releasedToCustomer`,
 * `interviewScheduled`), und das Zustandsdiagramm in 4.2.3 trennt sie ebenso.
 * Zwei Namen sind die einzige Form, in der eine geschlossene Übergangsmenge das
 * ausdrücken kann: eine Vorbedingung sieht die auslösende Rolle nicht.
 */
import type { Precondition, StatusModel, TransitionDefinition } from './machine'

export type CandidateSubmissionState =
  | 'draft'
  | 'submitted'
  | 'reviewed'
  | 'releasedToCustomer'
  | 'interviewScheduled'
  | 'accepted'
  | 'rejected'
  | 'withdrawn'

/** Offenlegungsstufe (3.6) — die technische Umsetzung von 6.4. */
export type DisclosureLevel = 'pseudonymized' | 'identified'

/**
 * Die Tatsachen, die die Vorbedingungen aus 4.2.3 brauchen. Sie werden vom
 * Aufrufer erhoben (lib/services/staffing.ts), nicht hier gelesen: dieses Modul
 * ist rein und ohne Datenbank prüfbar.
 *
 * **Vier Angaben sind Ergebnisse des Regelwerks aus Kapitel 5** und werden dort
 * gerechnet, nicht hier: `hasBlockingRuleCheck` (jede Sperre, 5.5),
 * `maxDurationExceeded` (P1, 5.1), `hasPreviousEmploymentDeclaration` (P6,
 * 5.3.1 — die **fehlende** Erklärung sperrt, nicht die Drehtür selbst) und
 * `mandatoryDocumentsChecked` (P10, 5.4). Sie sind hier benannt, damit die
 * Übergänge vollständig sind; angebunden werden sie mit P1, P6 und P11 in
 * `lib/aueg/` — genau wie `hasAcceptedValidPermit` in 4.1 und 4.2.1 vor P9.
 */
export interface CandidateSubmissionFacts {
  /** Status des eigenen Angebots (4.2.2). */
  readonly offerStatus: 'draft' | 'submitted' | 'reviewed' | 'accepted' | 'rejected' | 'withdrawn' | 'expired'
  /** Kandidat vorhanden (3.6) — ein Vorschlag ohne Kandidat ist keiner. */
  readonly candidatePresent: boolean
  /** Anzeigeform für das pseudonymisierte Profil (3.6, Pflicht). */
  readonly pseudonym: string | null
  readonly availableFrom: Date | null
  readonly disclosureLevel: DisclosureLevel
  readonly decision: 'accepted' | 'rejected' | null
  readonly decidedAt: Date | null
  readonly decidedById: string | null
  /** Pflicht bei `rejected`, **ohne** Bezug auf ein fremdes Angebot (2.3, Regel 3). */
  readonly decisionReason: string | null
  /** Irgendeine AÜG-Prüfung liefert eine Sperre (5.5) — aus Kapitel 5. */
  readonly hasBlockingRuleCheck: boolean
  /** P1: bisher angerechnete Dauer dieser Person bei diesem Kunden überschritten (5.1). */
  readonly maxDurationExceeded: boolean
  /** P6: Erklärung zur Vorbeschäftigung liegt vor (5.3.1); ihr Fehlen sperrt. */
  readonly hasPreviousEmploymentDeclaration: boolean
  /** P10: Pflichtnachweise im Umfang von 5.4 geprüft. */
  readonly mandatoryDocumentsChecked: boolean
  /** Stichtag der Prüfung; nie „heute" im Rechenweg (5.0). */
  readonly evaluationDate: Date
}

type SubmissionPrecondition = Precondition<CandidateSubmissionFacts>
type SubmissionTransition = TransitionDefinition<CandidateSubmissionState, CandidateSubmissionFacts>

const reasonGiven: SubmissionPrecondition = {
  description:
    'Entscheidungsgrund ist Pflicht und **ohne** Bezug auf ein fremdes Angebot (2.3, Regel 3).',
  specReference: 'SPEC 4.2.3, → rejected; 2.3, Regel 3',
  isSatisfied: (facts) => facts.decisionReason !== null && facts.decisionReason.trim() !== '',
}

const stillPseudonymized: SubmissionPrecondition = {
  description: 'Offenlegungsstufe ist `pseudonymized` — Klardaten erst nach Zusage (6.4).',
  specReference: 'SPEC 4.2.3, draft → submitted und reviewed → releasedToCustomer; 6.4',
  isSatisfied: (facts) => facts.disclosureLevel === 'pseudonymized',
}

const TRANSITIONS = {
  /**
   * | — | `draft` | `LD` (anlegen) | Eigenes Angebot in `draft`, `submitted`
   * oder `reviewed`; Kandidat vorhanden (3.6); `pseudonym` gesetzt |
   */
  create: {
    from: [],
    to: 'draft',
    label: 'Profilvorschlag anlegen',
    roles: ['supplierCoordinator'],
    specReference: 'SPEC 4.2.3, — → draft',
    preconditions: [
      {
        description: 'Eigenes Angebot steht in `draft`, `submitted` oder `reviewed` (4.2.2).',
        specReference: 'SPEC 4.2.3, — → draft; 4.2.2',
        isSatisfied: (facts) =>
          facts.offerStatus === 'draft' ||
          facts.offerStatus === 'submitted' ||
          facts.offerStatus === 'reviewed',
      },
      {
        description: 'Kandidat vorhanden und `pseudonym` gesetzt (3.6).',
        specReference: 'SPEC 4.2.3, — → draft; 3.6',
        isSatisfied: (facts) =>
          facts.candidatePresent && facts.pseudonym !== null && facts.pseudonym.trim() !== '',
      },
    ],
  },

  /** | `draft` | `submitted` | `LD` ([20]) | `availableFrom` gesetzt; Offenlegungsstufe `pseudonymized` | */
  submit: {
    from: ['draft'],
    to: 'submitted',
    label: 'vorlegen',
    roles: ['supplierCoordinator'],
    specReference: 'SPEC 4.2.3, draft → submitted',
    preconditions: [
      {
        description: '`availableFrom` ist gesetzt (3.6).',
        specReference: 'SPEC 4.2.3, draft → submitted; 3.6',
        isSatisfied: (facts) => facts.availableFrom !== null,
      },
      stillPseudonymized,
    ],
  },

  /**
   * | `submitted` | `reviewed` | `MD` ([17]), `MA` | — |
   *
   * Die AÜG-Prüfungen P1, P6, P10 und P11 sind **Nebenwirkung** dieses
   * Übergangs (4.2.3), keine Vorbedingung: sie liefern hier Information oder
   * Warnung, keine Sperre (5.5.5). Der Doppelvorschlag desselben Kandidaten
   * wird dabei **nur** beim Betreiber sichtbar (2.3, Regel 4).
   */
  review: {
    from: ['submitted'],
    to: 'reviewed',
    label: 'sichten und prüfen',
    roles: ['operatorCoordinator', 'operatorAdmin'],
    specReference: 'SPEC 4.2.3, submitted → reviewed',
    preconditions: [],
  },

  /**
   * | `reviewed` | `releasedToCustomer` | `MD` ([22]) | Offenlegungsstufe
   * `pseudonymized`; Prüfergebnisse ohne Sperre; Pflichtnachweise im Umfang
   * von 5.4 geprüft |
   */
  releaseToCustomer: {
    from: ['reviewed'],
    to: 'releasedToCustomer',
    label: 'pseudonymisiert dem Kunden vorlegen',
    roles: ['operatorCoordinator'],
    specReference: 'SPEC 4.2.3, reviewed → releasedToCustomer',
    preconditions: [
      stillPseudonymized,
      {
        description: 'Kein Prüfergebnis mit Sperrwirkung (5.5).',
        specReference: 'SPEC 4.2.3, reviewed → releasedToCustomer; 5.5',
        isSatisfied: (facts) => !facts.hasBlockingRuleCheck,
      },
      {
        description: 'Pflichtnachweise im Umfang von 5.4 geprüft (P10).',
        specReference: 'SPEC 4.2.3, reviewed → releasedToCustomer; 5.4',
        isSatisfied: (facts) => facts.mandatoryDocumentsChecked,
      },
    ],
  },

  /** | `releasedToCustomer` | `interviewScheduled` | `KB` ([24]) | — | */
  scheduleInterview: {
    from: ['releasedToCustomer'],
    to: 'interviewScheduled',
    label: 'Interview vereinbaren',
    roles: ['demandOwner'],
    specReference: 'SPEC 4.2.3, releasedToCustomer → interviewScheduled',
    // Klardaten bleiben verdeckt, bis die Zusage erfolgt (6.4) — das ist eine
    // Nebenwirkung der Offenlegungsstufe, keine Vorbedingung.
    preconditions: [],
  },

  /**
   * | `releasedToCustomer`, `interviewScheduled` | `accepted` | `KB`
   * entscheidet ([24]) | `decision`, `decidedAt`, `decidedBy` gesetzt; P1 ohne
   * Sperre; P6 als Warnung, aber **Sperre** bei fehlender Erklärung zur
   * Vorbeschäftigung; P11 als Warnung |
   *
   * Wirksam gegenüber dem Lieferanten wird die Zusage durch `MD` ([17]) — das
   * ist Statusführung und Benachrichtigung, kein zweiter Übergang: 4.2.3 nennt
   * keinen, und „keine Zusage durch den Betreiber" schließt ihn ausdrücklich
   * aus.
   */
  accept: {
    from: ['releasedToCustomer', 'interviewScheduled'],
    to: 'accepted',
    label: 'zusagen',
    roles: ['demandOwner'],
    specReference: 'SPEC 4.2.3, releasedToCustomer|interviewScheduled → accepted',
    preconditions: [
      {
        description: '`decision`, `decidedAt` und `decidedBy` sind gesetzt (3.6).',
        specReference: 'SPEC 4.2.3, → accepted; 3.6',
        isSatisfied: (facts) =>
          facts.decision === 'accepted' && facts.decidedAt !== null && facts.decidedById !== null,
      },
      {
        description: 'P1: Höchstüberlassungsdauer nicht überschritten — sonst Sperre (5.1, 5.5.5).',
        specReference: 'SPEC 4.2.3, → accepted; 5.1',
        isSatisfied: (facts) => !facts.maxDurationExceeded,
      },
      {
        description:
          'P6: Erklärung zur Vorbeschäftigung liegt vor. Gesperrt wird nicht die Drehtür, ' +
          'sondern die fehlende Tatsachengrundlage (5.3.1, „Wenn Daten fehlen").',
        specReference: 'SPEC 4.2.3, → accepted; 5.3.1, 5.5.5',
        isSatisfied: (facts) => facts.hasPreviousEmploymentDeclaration,
      },
    ],
  },

  /**
   * | `submitted`, `reviewed` | `rejected` | `MD` ([17]) bzw. `MA` |
   * `decisionReason` Pflicht, ohne Fremdbezug |
   *
   * Der Vorgang hat den Kunden nicht erreicht; die Ablehnung ist deshalb keine
   * Auswahlentscheidung. Hierher gehört auch der Abschluss offener Vorschläge,
   * wenn die Bedarfsanfrage `filled`, `cancelled` oder `expired` erreicht
   * (4.2.3, „Abschluss offener Vorschläge") — ein Übergang mit Auslöser, kein
   * Zeitablauf.
   */
  rejectByOperator: {
    from: ['submitted', 'reviewed'],
    to: 'rejected',
    label: 'ablehnen (vor Vorlage beim Kunden)',
    roles: ['operatorCoordinator', 'operatorAdmin'],
    specReference: 'SPEC 4.2.3, submitted|reviewed → rejected',
    preconditions: [reasonGiven],
  },

  /**
   * | `releasedToCustomer`, `interviewScheduled` | `rejected` | `KB`
   * entscheidet ([24]) | `decisionReason` Pflicht, ohne Fremdbezug |
   */
  rejectByCustomer: {
    from: ['releasedToCustomer', 'interviewScheduled'],
    to: 'rejected',
    label: 'absagen',
    roles: ['demandOwner'],
    specReference: 'SPEC 4.2.3, releasedToCustomer|interviewScheduled → rejected',
    preconditions: [
      reasonGiven,
      {
        description: '`decision`, `decidedAt` und `decidedBy` sind gesetzt (3.6).',
        specReference: 'SPEC 4.2.3, → rejected; 3.6',
        isSatisfied: (facts) =>
          facts.decision === 'rejected' && facts.decidedAt !== null && facts.decidedById !== null,
      },
    ],
  },

  /**
   * | `draft`, `submitted`, `reviewed`, `releasedToCustomer`,
   * `interviewScheduled` | `withdrawn` | `LD` ([20]) | Vorschlag noch nicht
   * `accepted` |
   *
   * „Noch nicht `accepted`" ist durch die Spalte „Von" erfüllt: aus `accepted`
   * führt kein Übergang (4.0, Regel 9).
   */
  withdraw: {
    from: ['draft', 'submitted', 'reviewed', 'releasedToCustomer', 'interviewScheduled'],
    to: 'withdrawn',
    label: 'zurückziehen',
    roles: ['supplierCoordinator'],
    specReference: 'SPEC 4.2.3, → withdrawn',
    preconditions: [],
  },
} as const satisfies Readonly<Record<string, SubmissionTransition>>

export const CANDIDATE_SUBMISSION_MODEL: StatusModel<
  CandidateSubmissionState,
  CandidateSubmissionFacts,
  typeof TRANSITIONS
> = {
  object: 'Profilvorschlag (3.6)',
  specReference: 'SPEC 4.2.3',
  states: [
    'draft',
    'submitted',
    'reviewed',
    'releasedToCustomer',
    'interviewScheduled',
    'accepted',
    'rejected',
    'withdrawn',
  ],
  terminalStates: ['accepted', 'rejected', 'withdrawn'],
  transitions: TRANSITIONS,
}

export type CandidateSubmissionTransitionName = keyof typeof TRANSITIONS & string

/** Deutsche Bezeichnung der Zustände (4.2.3), für die Oberfläche. */
export const CANDIDATE_SUBMISSION_STATE_LABELS: {
  readonly [S in CandidateSubmissionState]: string
} = {
  draft: 'Entwurf',
  submitted: 'eingereicht',
  reviewed: 'gesichtet',
  releasedToCustomer: 'dem Kunden vorgelegt',
  interviewScheduled: 'Interview vereinbart',
  accepted: 'zugesagt',
  rejected: 'abgelehnt',
  withdrawn: 'zurückgezogen',
}
