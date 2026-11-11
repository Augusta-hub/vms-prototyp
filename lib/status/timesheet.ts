/**
 * Statusmodell des Stundenzettels — SPEC **4.4**, Objekte `timesheet` und
 * `timesheetApproval` (3.8).
 *
 * Zustände: `recorded` → `submitted` → `inApproval` → `approved`, dazu
 * `rejected` (zurück nach `recorded`) und `corrected` als Endzustand.
 *
 * **Die Stufenzahl steht in den Daten, nicht in diesem Modell.** Das ist die
 * tragende Entscheidung aus 4.4 und sie ist älter als die Antwort auf
 * *Frage 5*: die Zustände und Übergänge unten gelten für eine wie für fünf
 * Stufen. Deshalb gibt es **zwei** Übergänge aus `inApproval` heraus, die
 * dasselbe tun — `approveStage` bleibt in `inApproval`, `approve` führt nach
 * `approved` —, und nicht einen mit einer Verzweigung im Dienst. Welcher von
 * beiden greift, entscheidet die Tatsache `remainingOpenStages`, und das
 * Typsystem trägt beide als eigene Zeile.
 *
 * **Die Freigabestufen sind Konfiguration je Kunde** (`timesheetApprovalConfig`,
 * 3.1; Entscheidung zu *Frage 5*). Vorbelegung sind zwei Stufen: zuerst die
 * Kundenseite, die bestätigt, dass die Zeiten erbracht wurden — das weiß nur
 * sie —, dann der Betreiber, der sie gegen Einsatz, Preisposition und Periode
 * prüft (4.5).
 *
 * **Die Betreiberstufe tritt hinzu, sie ersetzt nichts.** 2.1 und 2.4 Regel 3
 * verbieten, die Kundenentscheidung zu **ersetzen**, nicht, ihr eine zweite
 * Prüfung **hinzuzufügen**. Daraus folgen drei Vorbedingungen, die hier stehen
 * und nicht im Dienst: jede Stufenfolge enthält mindestens eine Kundenstufe
 * (`customerStagePresent`), eine offene Stufe wird nur von der Rolle
 * entschieden, der sie zugewiesen ist (`openStageRoleCode`), und wer den Zettel
 * erfasst oder eingereicht hat, entscheidet keine Stufe (2.4, Regel 5).
 *
 * Nicht vorhanden — und damit nicht ausdrückbar:
 *
 *  - **`recorded` → `approved`.** Einreichen und Genehmigen sind getrennt.
 *  - **Genehmigung durch die erfassende Seite.** Das trifft `LD` und `AN`
 *    immer und den Betreiber dann, wenn er im Namen des Leiharbeitnehmers
 *    erfasst hat ([27]) — die Vorbedingung prüft die Person, nicht die Rolle.
 *  - **Ein Übergang durch Fristablauf.** Ein nicht genehmigter Zettel wird mit
 *    `closingDate` eskaliert und bleibt in `inApproval`; er gilt **nicht** als
 *    genehmigt (2.4, Regel 1; 4.0, Regel 4). Er kann dadurch die Abrechnung
 *    blockieren — das ist beabsichtigt.
 *  - **`approved` → `recorded` und `approved` → `rejected`.** Nachträgliche
 *    Änderungen laufen ausschließlich über eine Korrekturfassung ([28]).
 *  - **Ein Weg aus `corrected`.** Der ersetzte Zettel bleibt als Beleg der
 *    Historie stehen (4.0, Regel 9).
 *
 * **Endzustände:** `corrected`. `approved` ist ein Ruhezustand — endgültig,
 * solange keine Korrekturfassung genehmigt wird.
 */
import type { RoleCode } from '../authz/roles'
import type { Precondition, StatusModel, TransitionDefinition } from './machine'

export type TimesheetState =
  | 'recorded'
  | 'submitted'
  | 'inApproval'
  | 'approved'
  | 'rejected'
  | 'corrected'

export const TIMESHEET_STATE_LABELS: { readonly [S in TimesheetState]: string } = {
  recorded: 'erfasst',
  submitted: 'eingereicht',
  inApproval: 'in Prüfung',
  approved: 'genehmigt',
  rejected: 'abgelehnt',
  corrected: 'korrigiert',
}

/**
 * Die Tatsachen, die die Vorbedingungen aus 4.4 brauchen. Erhoben werden sie
 * vom Aufrufer (`lib/services/timesheets.ts`); dieses Modul rechnet nicht und
 * liest nicht.
 *
 * **Eine Angabe ist ein Ergebnis des Regelwerks aus Kapitel 5:**
 * `comparableWageUsable` ist P4 (5.2.1) und trägt die **Sperre** aus Q36. P1
 * ist nach 5.5.5 ausdrücklich **keine** Sperre an diesem Übergang und steht
 * deshalb nicht als Vorbedingung, sondern als Warnung im Ergebnis des Dienstes.
 */
export interface TimesheetFacts {
  // — Anlage (4.4, — → recorded) —
  /** Zustand des Einsatzes (4.3). */
  readonly assignmentStatus: 'planned' | 'active' | 'interrupted' | 'completed' | 'terminatedEarly'
  /** Zustand der Abrechnungsperiode (3.9, 4.5). */
  readonly billingPeriodStatus: 'open' | 'closed'
  /** Gibt es zu Einsatz und Periode schon einen **gültigen** Zettel? (3.13) */
  readonly timesheetExistsForPeriod: boolean

  // — Einreichen (4.4, recorded → submitted) —
  readonly entryCount: number
  /** Alle Positionen liegen in `periodFrom` bis `periodTo` des Zettels. */
  readonly entriesWithinPeriod: boolean
  /** Keine Position fällt in eine laufende Unterbrechung des Einsatzes (4.3). */
  readonly entriesOutsideInterruption: boolean
  /** Alle Positionen erfüllen die vier Invarianten aus 3.8. */
  readonly entriesValid: boolean

  // — Freigabe (4.4, inApproval) —
  /** Zahl der erzeugten Freigabeschritte. */
  readonly approvalCount: number
  /** Rolle der **offenen** Stufe, oder `null`, wenn keine offen ist. */
  readonly openStageRoleCode: RoleCode | null
  /** Rollen, in deren Funktion die handelnde Person auftreten kann (2.2, 2.4). */
  readonly actingRoleCodes: readonly RoleCode[]
  /** Offene Stufen **nach** der gerade entschiedenen. */
  readonly remainingOpenStages: number
  /** Trägt mindestens eine Stufe eine Kundenrolle? (2.1, 2.4 Regel 3) */
  readonly customerStagePresent: boolean
  /** Hat eine Stufe abgelehnt? Dann ist der Zettel `rejected` (4.4). */
  readonly anyStageRejected: boolean

  // — Vier-Augen-Prinzip (2.4, Regel 5) —
  readonly actingUserId: string
  readonly recordedById: string
  readonly submittedById: string | null

  /** Pflicht bei Ablehnung (4.4). */
  readonly rejectionReason: string | null

  /** P4: verwendbares Vergleichsentgelt für den Zeitraum (5.2.1, Q36). */
  readonly comparableWageUsable: boolean

  /** Eine Korrekturfassung dieses Zettels ist `approved` (4.4). */
  readonly correctionApproved: boolean

  /** Stichtag: Prüfzeitraum ist `periodFrom` bis `periodTo` des Zettels (5.0). */
  readonly evaluationDate: Date
}

type TimesheetPrecondition = Precondition<TimesheetFacts>
type TimesheetTransition = TransitionDefinition<TimesheetState, TimesheetFacts>

/* ------------------------------------------------------------------ */
/* Vorbedingungen, die mehrere Übergänge teilen                        */
/* ------------------------------------------------------------------ */

/**
 * Die Periode ist offen. Steht beim Anlegen **und** beim Nacharbeiten: 4.4
 * nennt sie in beiden Zeilen, und in einer geschlossenen Periode darf auch
 * keine Korrektur mehr entstehen (4.5).
 */
const periodOpen: TimesheetPrecondition = {
  description: 'Die Abrechnungsperiode ist offen (3.9, 4.5).',
  specReference: 'SPEC 4.4; 3.9',
  isSatisfied: (facts) => facts.billingPeriodStatus === 'open',
}

/**
 * Die offene Stufe ist der handelnden Person zugewiesen.
 *
 * Das prüft auch Fußnote [29] an der Matrixzeile — bewusst zweimal: [29] prüft
 * die **Rolle der Entscheidung** (`grant.roleCode`), diese Vorbedingung prüft,
 * ob die Person diese Rolle überhaupt trägt. Fällt eine der beiden Schichten
 * aus, hält die andere.
 */
const openStageIsAssignedToActor: TimesheetPrecondition = {
  description:
    'Die offene Stufe ist der Rolle zugewiesen, in deren Funktion gehandelt wird ' +
    '(3.1, 4.4).',
  specReference: 'SPEC 4.4, inApproval; 2.2, Fußnote [29]',
  isSatisfied: (facts) =>
    facts.openStageRoleCode !== null && facts.actingRoleCodes.includes(facts.openStageRoleCode),
}

/**
 * Vier-Augen-Prinzip (2.4, Regel 5): wer erfasst oder eingereicht hat,
 * entscheidet keine Stufe — auch nicht in Vertretung.
 *
 * Geprüft wird die **Person**, nicht die Rolle. Das ist der Grund, warum die
 * Regel auch den Betreiber trifft: hat `MD` im Namen des Leiharbeitnehmers
 * erfasst ([27]), fällt die Betreiberstufe an eine andere Person.
 */
const fourEyes: TimesheetPrecondition = {
  description:
    'Die entscheidende Person hat den Zettel weder erfasst noch eingereicht — ' +
    'Vier-Augen-Prinzip (2.4, Regel 5).',
  specReference: 'SPEC 4.4, Ausgeschlossen; 2.4, Regel 5',
  isSatisfied: (facts) =>
    facts.actingUserId !== facts.recordedById &&
    (facts.submittedById === null || facts.actingUserId !== facts.submittedById),
}

/**
 * Eine abgelehnte Stufe lässt sich nicht übergehen. 4.4 sagt: lehnt eine Stufe
 * ab, ist der Zettel `rejected` und die noch offenen Stufen entfallen — eine
 * folgende Stufe kann die Ablehnung **nicht** aufheben.
 */
const noStageRejected: TimesheetPrecondition = {
  description: 'Keine Stufe hat abgelehnt — eine Ablehnung ist nicht durch eine Stufe aufhebbar.',
  specReference: 'SPEC 4.4, inApproval → rejected',
  isSatisfied: (facts) => !facts.anyStageRejected,
}

/* ------------------------------------------------------------------ */
/* Übergänge                                                           */
/* ------------------------------------------------------------------ */

const TRANSITIONS = {
  /**
   * `— → recorded` (4.4). Die Anlage ist in 2.2 die Operation `A`: `AN`
   * *(offene Frage 4)*, `LD` und `MD` im Namen des Leiharbeitnehmers ([27]).
   */
  create: {
    from: [],
    to: 'recorded',
    label: 'erfassen',
    roles: ['temporaryWorker', 'supplierCoordinator', 'operatorCoordinator', 'operatorAdmin'],
    specReference: 'SPEC 4.4, — → recorded',
    preconditions: [
      periodOpen,
      {
        description:
          'Der Einsatz läuft oder ist beendet — in `planned` gibt es noch keine Zeiten (4.3).',
        specReference: 'SPEC 4.4, — → recorded; 4.3',
        isSatisfied: (facts) =>
          facts.assignmentStatus === 'active' ||
          facts.assignmentStatus === 'interrupted' ||
          facts.assignmentStatus === 'completed' ||
          facts.assignmentStatus === 'terminatedEarly',
      },
      {
        description:
          'Zu Einsatz und Periode gibt es noch keinen gültigen Zettel — genau einer je ' +
          'Einsatz und Periode (3.13).',
        specReference: 'SPEC 4.4, — → recorded; 3.13',
        isSatisfied: (facts) => !facts.timesheetExistsForPeriod,
      },
    ],
  },

  /** `recorded` → `submitted` (4.4). */
  submit: {
    from: ['recorded'],
    to: 'submitted',
    label: 'einreichen',
    roles: ['temporaryWorker', 'supplierCoordinator', 'operatorCoordinator', 'operatorAdmin'],
    specReference: 'SPEC 4.4, recorded → submitted',
    preconditions: [
      {
        description: 'Mindestens eine Zeitposition (4.4).',
        specReference: 'SPEC 4.4, recorded → submitted',
        isSatisfied: (facts) => facts.entryCount > 0,
      },
      {
        description:
          'Alle Zeitpositionen liegen im Zeitraum des Zettels (`periodFrom` bis `periodTo`).',
        specReference: 'SPEC 4.4, recorded → submitted',
        isSatisfied: (facts) => facts.entriesWithinPeriod,
      },
      {
        description:
          'Keine Zeitposition fällt in eine Unterbrechung des Einsatzes (4.3) — in ihr wird ' +
          'keine Arbeitsleistung erbracht.',
        specReference: 'SPEC 4.4, recorded → submitted; 4.3',
        isSatisfied: (facts) => facts.entriesOutsideInterruption,
      },
      {
        description: 'Jede Zeitposition erfüllt die vier Invarianten aus 3.8.',
        specReference: 'SPEC 4.4, recorded → submitted; 3.8',
        isSatisfied: (facts) => facts.entriesValid,
      },
    ],
  },

  /**
   * `submitted` → `inApproval` (4.4). **Systemübergang** (4.0, Regel 10): das
   * Öffnen der ersten Stufe ist keine Benutzerhandlung, sondern die Folge der
   * Einreichung.
   */
  openApproval: {
    from: ['submitted'],
    to: 'inApproval',
    label: 'Freigabeschritte eröffnen',
    roles: [],
    specReference: 'SPEC 4.4, submitted → inApproval',
    preconditions: [
      {
        description: 'Mindestens ein Freigabeschritt ist vorhanden (3.1, 4.4).',
        specReference: 'SPEC 4.4, submitted → inApproval',
        isSatisfied: (facts) => facts.approvalCount > 0,
      },
      {
        description:
          'Die Stufenfolge enthält mindestens eine Kundenstufe — der Betreiber ersetzt die ' +
          'Kundenentscheidung nicht (2.1, 2.4 Regel 3).',
        specReference: 'SPEC 4.4, Ausgeschlossen; 2.1',
        isSatisfied: (facts) => facts.customerStagePresent,
      },
    ],
  },

  /**
   * `inApproval` → `inApproval` (4.4): eine Stufe hat zugestimmt, weitere sind
   * offen. **Kein** Statuswechsel — die nächste Stufe wird geöffnet.
   */
  approveStage: {
    from: ['inApproval'],
    to: 'inApproval',
    label: 'Stufe genehmigen',
    roles: ['demandOwner', 'approver', 'operatorCoordinator', 'operatorAdmin'],
    specReference: 'SPEC 4.4, inApproval → inApproval',
    preconditions: [
      noStageRejected,
      openStageIsAssignedToActor,
      fourEyes,
      {
        description: 'Nach dieser Stufe ist mindestens eine weitere offen (4.4).',
        specReference: 'SPEC 4.4, inApproval → inApproval',
        isSatisfied: (facts) => facts.remainingOpenStages > 0,
      },
    ],
  },

  /** `inApproval` → `approved` (4.4): die **letzte** Stufe hat zugestimmt. */
  approve: {
    from: ['inApproval'],
    to: 'approved',
    label: 'genehmigen',
    roles: ['demandOwner', 'approver', 'operatorCoordinator', 'operatorAdmin'],
    specReference: 'SPEC 4.4, inApproval → approved',
    preconditions: [
      noStageRejected,
      openStageIsAssignedToActor,
      fourEyes,
      {
        description: 'Dies ist die letzte offene Stufe (4.4).',
        specReference: 'SPEC 4.4, inApproval → approved',
        isSatisfied: (facts) => facts.remainingOpenStages === 0,
      },
      {
        description:
          'Die Stufenfolge enthielt mindestens eine Kundenstufe (2.1, 2.4 Regel 3).',
        specReference: 'SPEC 4.4, Ausgeschlossen; 2.1',
        isSatisfied: (facts) => facts.customerStagePresent,
      },
      {
        // Q36 in 4.7: **Sperre**. P1 ist an diesem Übergang ausdrücklich
        // **keine** Sperre (5.5.5, Q35) — erbrachte Zeiten werden genehmigt,
        // auch wenn sie nach dem Fristende liegen; sie erzeugen eine Warnung
        // mit Pflicht-Eskalation.
        ruleRef: 'P4',
        description:
          'P4: für den Zeitraum liegt ein verwendbares Vergleichsentgelt vor (5.2.1) — ' +
          'Q36 trägt hier eine Sperre.',
        specReference: 'SPEC 4.4, inApproval → approved; 5.2.1; 4.7 Q36',
        isSatisfied: (facts) => facts.comparableWageUsable,
      },
    ],
  },

  /** `inApproval` → `rejected` (4.4). Noch offene Stufen entfallen. */
  reject: {
    from: ['inApproval'],
    to: 'rejected',
    label: 'ablehnen',
    roles: ['demandOwner', 'approver', 'operatorCoordinator', 'operatorAdmin'],
    specReference: 'SPEC 4.4, inApproval → rejected',
    preconditions: [
      openStageIsAssignedToActor,
      fourEyes,
      {
        description: 'Der Ablehnungsgrund ist Pflicht (4.4).',
        specReference: 'SPEC 4.4, inApproval → rejected',
        isSatisfied: (facts) =>
          facts.rejectionReason !== null && facts.rejectionReason.trim() !== '',
      },
    ],
  },

  /** `rejected` → `recorded` (4.4): nacharbeiten. */
  rework: {
    from: ['rejected'],
    to: 'recorded',
    label: 'nacharbeiten',
    roles: ['temporaryWorker', 'supplierCoordinator', 'operatorCoordinator', 'operatorAdmin'],
    specReference: 'SPEC 4.4, rejected → recorded',
    preconditions: [periodOpen],
  },

  /**
   * `approved` → `corrected` (4.4). **Systemübergang**: die Folge davon, dass
   * eine Korrekturfassung genehmigt wurde — nicht eine eigene Handlung.
   */
  markCorrected: {
    from: ['approved'],
    to: 'corrected',
    label: 'durch Korrekturfassung ersetzen',
    roles: [],
    specReference: 'SPEC 4.4, approved → corrected',
    preconditions: [
      {
        description:
          'Eine Korrekturfassung mit `correctionOf` auf diesen Zettel ist genehmigt (4.4).',
        specReference: 'SPEC 4.4, approved → corrected',
        isSatisfied: (facts) => facts.correctionApproved,
      },
    ],
  },
} as const satisfies Readonly<Record<string, TimesheetTransition>>

export type TimesheetTransitionName = keyof typeof TRANSITIONS

export const TIMESHEET_MODEL: StatusModel<
  TimesheetState,
  TimesheetFacts,
  typeof TRANSITIONS
> = {
  object: 'Stundenzettel (3.8)',
  specReference: 'SPEC 4.4',
  states: ['recorded', 'submitted', 'inApproval', 'approved', 'rejected', 'corrected'],
  // `approved` ist **kein** Endzustand: aus ihm führt `markCorrected` nach
  // `corrected` (4.4, „Ruhezustand").
  terminalStates: ['corrected'],
  transitions: TRANSITIONS,
}
