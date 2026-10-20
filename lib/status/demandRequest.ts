/**
 * Statusmodell der Bedarfsanfrage — SPEC 4.1, Objekt `demandRequest` (3.4).
 *
 * Zustände: `draft` → `submitted` → `approved` → `tendered` → `inSelection` →
 * `filled`, dazu `cancelled` und `expired`. Endzustände sind `filled`,
 * `cancelled` und `expired`.
 *
 * Die Tabelle unten ist die Übergangstabelle aus 4.1, Zeile für Zeile. Nicht
 * vorhanden sind — und damit nicht ausdrückbar:
 *
 *  - `draft` → `approved`: Einreichen und Freigeben sind getrennte Handlungen
 *    zweier Rollen (Vier-Augen-Prinzip).
 *  - eine Freigabe durch `MA` oder `MD`: die Freigabe ist eine
 *    Kundenentscheidung; eine liegengebliebene Freigabe wird eskaliert, nicht
 *    übernommen (2.4, Regel 3).
 *  - `submitted` → `tendered`: ohne Freigabe keine Ausschreibung.
 *  - ein zeitgesteuerter Übergang nach `approved`, `tendered`, `inSelection`
 *    oder `filled`: Fristablauf gewährt nichts (4.0, Regel 4).
 *  - ein Rückweg aus `filled`, `cancelled` oder `expired`: eine Nachbesetzung
 *    ist eine **neue** Bedarfsanfrage.
 *  - `filled` → `cancelled`: ein besetzter Bedarf wird über den Einsatz
 *    beendet (4.3).
 */
import type { Precondition, StatusModel, TransitionDefinition } from './machine'

export type DemandRequestState =
  | 'draft'
  | 'submitted'
  | 'approved'
  | 'tendered'
  | 'inSelection'
  | 'filled'
  | 'cancelled'
  | 'expired'

/** Ein Lieferant, der zur neuen Ausschreibung eingeladen werden soll (4.1, 4.2.1). */
export interface InvitedSupplierFact {
  readonly supplierId: string
  readonly supplierStatus: 'onboarding' | 'active' | 'blocked' | 'inactive'
  /** Erlaubnis anerkannt **und** am Stichtag gültig (5.4, Prüfung P9). */
  readonly hasAcceptedValidPermit: boolean
}

/**
 * Die Tatsachen, die die Vorbedingungen aus 4.1 brauchen. Sie werden vom
 * Aufrufer erhoben (lib/services/), nicht hier gelesen: dieses Modul ist rein
 * und ohne Datenbank prüfbar.
 *
 * Drei Angaben stammen aus Objekten, die noch nicht modelliert sind — der
 * Profilvorschlag (3.6) und der Einsatz (3.7). Sie sind benannt, damit die
 * Übergänge vollständig bleiben; bis 3.6 und 3.7 kommen, liefert der Aufrufer
 * `0`, und die betroffenen Übergänge scheitern an ihrer Vorbedingung statt
 * stillschweigend zu fehlen.
 */
export interface DemandRequestFacts {
  /** Bedarfsträger (`requestedBy`, 3.4). */
  readonly requestedById: string
  /** Handelnde Person; `null` beim Systemübergang. */
  readonly actingUserId: string | null
  readonly activityDescription: string
  readonly qualificationRequirementCount: number
  readonly siteId: string | null
  readonly costCenterId: string | null
  readonly startDate: Date | null
  readonly weeklyHours: number | null
  readonly headcount: number
  /** Angebotsfrist der Anfrage bzw. der Ausschreibung (3.4, 3.5). */
  readonly offerDeadline: Date | null
  readonly cancellationReason: string | null
  readonly rejectionReason: string | null
  /** Einladungen der zu veröffentlichenden Ausschreibung (mindestens eine). */
  readonly invitedSuppliers: readonly InvitedSupplierFact[]
  /** Vorherige Ausschreibung geschlossen (`closedAt`, 3.5) — für die neue Runde. */
  readonly previousTenderClosed: boolean
  /** Profilvorschläge in `releasedToCustomer` (4.2.3) — aus 3.6, noch nicht modelliert. */
  readonly releasedSubmissionCount: number
  /** Noch offene Profilvorschläge (4.2.3) — aus 3.6, noch nicht modelliert. */
  readonly openSubmissionCount: number
  /** Einsätze in `planned` oder `active` (4.3) — aus 3.7, noch nicht modelliert. */
  readonly effectiveAssignmentCount: number
  /** Stichtag der Prüfung; nie „heute" im Rechenweg (5.0). */
  readonly evaluationDate: Date
}

type DemandRequestPrecondition = Precondition<DemandRequestFacts>
type DemandRequestTransition = TransitionDefinition<DemandRequestState, DemandRequestFacts>

const mandatoryFieldsComplete: DemandRequestPrecondition = {
  description:
    'Pflichtfelder vollständig: Tätigkeitsbeschreibung, mindestens eine Anforderung, Standort, ' +
    'Beginn, Wochenstunden, Anzahl.',
  specReference: 'SPEC 4.1, draft → submitted',
  isSatisfied: (facts) =>
    facts.activityDescription.trim() !== '' &&
    facts.qualificationRequirementCount >= 1 &&
    facts.siteId !== null &&
    facts.startDate !== null &&
    facts.weeklyHours !== null &&
    facts.weeklyHours > 0 &&
    facts.headcount >= 1,
}

const notTheRequester: DemandRequestPrecondition = {
  description:
    'Auslöser ist nicht der Bedarfsträger: wer beantragt, genehmigt nicht — auch nicht in ' +
    'Vertretung.',
  specReference: 'SPEC 4.1, submitted → approved; 2.4, Regel 5',
  isSatisfied: (facts) =>
    facts.actingUserId !== null && facts.actingUserId !== facts.requestedById,
}

const noEffectiveAssignment: DemandRequestPrecondition = {
  description: 'Kein wirksamer Einsatz aus dieser Anfrage (sonst läuft die Beendigung über 4.3).',
  specReference: 'SPEC 4.1, → cancelled',
  isSatisfied: (facts) => facts.effectiveAssignmentCount === 0,
}

const everyInvitedSupplierEligible: DemandRequestPrecondition = {
  description:
    'Je eingeladenem Lieferanten: Status `active` (4.6) und anerkannte, gültige AÜG-Erlaubnis ' +
    '(5.4, Prüfung P9).',
  specReference: 'SPEC 4.1, approved → tendered; 4.6; 5.4',
  isSatisfied: (facts) =>
    facts.invitedSuppliers.every(
      (supplier) => supplier.supplierStatus === 'active' && supplier.hasAcceptedValidPermit,
    ),
}

const atLeastOneInvitation: DemandRequestPrecondition = {
  description: 'Ausschreibung mit mindestens einer Einladung.',
  specReference: 'SPEC 4.1, approved → tendered; 3.5',
  isSatisfied: (facts) => facts.invitedSuppliers.length >= 1,
}

const offerDeadlineSet: DemandRequestPrecondition = {
  description: 'Angebotsfrist gesetzt.',
  specReference: 'SPEC 4.1, approved → tendered; 3.4',
  isSatisfied: (facts) => facts.offerDeadline !== null,
}

const TRANSITIONS = {
  /** | — | `draft` | `KB` (anlegen), `MD` im Auftrag ([10]) | */
  create: {
    from: [],
    to: 'draft',
    label: 'anlegen',
    roles: ['demandOwner', 'operatorCoordinator'],
    specReference: 'SPEC 4.1, — → draft',
    preconditions: [
      {
        description: 'Kunde, Standort und Kostenstelle sind gesetzt.',
        specReference: 'SPEC 4.1, — → draft; 3.4',
        isSatisfied: (facts) => facts.siteId !== null && facts.costCenterId !== null,
      },
    ],
  },

  /** | `draft` | `submitted` | `KB` ([12]), `MD` | */
  submit: {
    from: ['draft'],
    to: 'submitted',
    label: 'zur Freigabe einreichen',
    roles: ['demandOwner', 'operatorCoordinator'],
    specReference: 'SPEC 4.1, draft → submitted',
    preconditions: [mandatoryFieldsComplete],
  },

  /** | `submitted` | `approved` | `KG` ([13]) | */
  approve: {
    from: ['submitted'],
    to: 'approved',
    label: 'freigeben',
    // Nur der Genehmiger des Kunden. Der Betreiber ersetzt keine
    // Kundenentscheidung (4.0, Regel 7; 2.4, Regel 3).
    roles: ['approver'],
    specReference: 'SPEC 4.1, submitted → approved',
    preconditions: [notTheRequester],
  },

  /** | `submitted` | `draft` | `KG` ([13]) — Rückweisung zur Überarbeitung | */
  returnToDraft: {
    from: ['submitted'],
    to: 'draft',
    label: 'zurückweisen',
    roles: ['approver'],
    specReference: 'SPEC 4.1, submitted → draft',
    preconditions: [
      {
        description:
          'Rückweisungsgrund ist Pflicht, damit der Bedarfsträger weiß, was zu ändern ist ' +
          '(`rejectionReason`, 3.4).',
        specReference: 'SPEC 4.1, submitted → draft',
        isSatisfied: (facts) =>
          facts.rejectionReason !== null && facts.rejectionReason.trim() !== '',
      },
    ],
  },

  /** | `approved` | `tendered` | `MD`, `MA` | */
  publishTender: {
    from: ['approved'],
    to: 'tendered',
    label: 'ausschreiben',
    roles: ['operatorCoordinator', 'operatorAdmin'],
    specReference: 'SPEC 4.1, approved → tendered',
    preconditions: [atLeastOneInvitation, offerDeadlineSet, everyInvitedSupplierEligible],
  },

  /**
   * | `tendered` | `tendered` | `MD`, `MA` | neue Runde |
   *
   * **Kein** Statuswechsel, aber ein Protokolleintrag am neuen
   * Ausschreibungsobjekt; die alten Einladungen bleiben in ihrem Endzustand.
   */
  openNextRound: {
    from: ['tendered'],
    to: 'tendered',
    label: 'neue Ausschreibungsrunde eröffnen',
    roles: ['operatorCoordinator', 'operatorAdmin'],
    specReference: 'SPEC 4.1, tendered → tendered',
    preconditions: [
      {
        description: 'Vorherige Ausschreibung ist geschlossen (`closedAt`).',
        specReference: 'SPEC 4.1, tendered → tendered; 3.5',
        isSatisfied: (facts) => facts.previousTenderClosed,
      },
      atLeastOneInvitation,
      offerDeadlineSet,
      everyInvitedSupplierEligible,
    ],
  },

  /** | `tendered` | `inSelection` | `MD` ([17]) | */
  releaseToSelection: {
    from: ['tendered'],
    to: 'inSelection',
    label: 'Profilvorschlag vorgelegt',
    roles: ['operatorCoordinator'],
    specReference: 'SPEC 4.1, tendered → inSelection',
    preconditions: [
      {
        description: 'Mindestens ein Profilvorschlag steht in `releasedToCustomer` (4.2.3).',
        specReference: 'SPEC 4.1, tendered → inSelection; 4.2.3',
        isSatisfied: (facts) => facts.releasedSubmissionCount >= 1,
      },
    ],
  },

  /** | `inSelection` | `tendered` | `MD` | alle Vorschläge abgelehnt | */
  returnToTender: {
    from: ['inSelection'],
    to: 'tendered',
    label: 'in die Ausschreibung zurückfallen',
    roles: ['operatorCoordinator'],
    specReference: 'SPEC 4.1, inSelection → tendered',
    preconditions: [
      {
        description: 'Alle vorgelegten Vorschläge sind abgelehnt oder zurückgezogen.',
        specReference: 'SPEC 4.1, inSelection → tendered',
        isSatisfied: (facts) => facts.openSubmissionCount === 0,
      },
      {
        description:
          'Die Angebotsfrist läuft noch oder eine neue Runde ist eröffnet.',
        specReference: 'SPEC 4.1, inSelection → tendered',
        isSatisfied: (facts) =>
          facts.offerDeadline !== null &&
          facts.offerDeadline.getTime() >= facts.evaluationDate.getTime(),
      },
      {
        description:
          'Kein Rückfall, wenn bereits ein Einsatz aus der Anfrage besteht.',
        specReference: 'SPEC 4.1, inSelection → tendered',
        isSatisfied: (facts) => facts.effectiveAssignmentCount === 0,
      },
    ],
  },

  /** | `inSelection` | `filled` | `MD` | */
  fill: {
    from: ['inSelection'],
    to: 'filled',
    label: 'als besetzt führen',
    roles: ['operatorCoordinator'],
    specReference: 'SPEC 4.1, inSelection → filled',
    preconditions: [
      {
        description:
          'So viele Einsätze in `planned` oder `active` wie `headcount` verlangt (4.3). ' +
          'Teilbesetzung ist kein eigener Zustand.',
        specReference: 'SPEC 4.1, inSelection → filled; 4.3',
        isSatisfied: (facts) =>
          facts.headcount >= 1 && facts.effectiveAssignmentCount === facts.headcount,
      },
      // Die Sperren aus 5.1, 5.3 und 5.4 je Einsatz gehören zum Einsatz (4.3)
      // und kommen mit dem AÜG-Regelwerk; hier ist die Stelle benannt.
    ],
  },

  /** | `draft`, `submitted`, `approved`, `tendered`, `inSelection` | `cancelled` | `KB` ([12]), `MD`, `MA` | */
  cancel: {
    from: ['draft', 'submitted', 'approved', 'tendered', 'inSelection'],
    to: 'cancelled',
    label: 'stornieren',
    roles: ['demandOwner', 'operatorCoordinator', 'operatorAdmin'],
    specReference: 'SPEC 4.1, → cancelled',
    preconditions: [
      {
        description: 'Stornogrund ist Pflicht (`cancellationReason`, 3.4).',
        specReference: 'SPEC 4.1, → cancelled',
        isSatisfied: (facts) =>
          facts.cancellationReason !== null && facts.cancellationReason.trim() !== '',
      },
      noEffectiveAssignment,
    ],
  },

  /**
   * | `approved`, `tendered`, `inSelection` | `expired` | System |
   *
   * Der einzige zeitgesteuerte Übergang dieses Modells, und er **entzieht**
   * nur — er genehmigt nichts (4.0, Regel 4).
   */
  expire: {
    from: ['approved', 'tendered', 'inSelection'],
    to: 'expired',
    label: 'ablaufen (Bedarfsbeginn erreicht)',
    roles: [],
    specReference: 'SPEC 4.1, → expired',
    preconditions: [
      {
        description: 'Bedarfsbeginn ist erreicht.',
        specReference: 'SPEC 4.1, → expired',
        isSatisfied: (facts) =>
          facts.startDate !== null &&
          facts.startDate.getTime() <= facts.evaluationDate.getTime(),
      },
      {
        description: 'Kein Einsatz zu dieser Anfrage vorhanden.',
        specReference: 'SPEC 4.1, → expired',
        isSatisfied: (facts) => facts.effectiveAssignmentCount === 0,
      },
    ],
  },
} as const satisfies Readonly<Record<string, DemandRequestTransition>>

export const DEMAND_REQUEST_MODEL: StatusModel<
  DemandRequestState,
  DemandRequestFacts,
  typeof TRANSITIONS
> = {
  object: 'Bedarfsanfrage (3.4)',
  specReference: 'SPEC 4.1',
  states: [
    'draft',
    'submitted',
    'approved',
    'tendered',
    'inSelection',
    'filled',
    'cancelled',
    'expired',
  ],
  terminalStates: ['filled', 'cancelled', 'expired'],
  transitions: TRANSITIONS,
}

export type DemandRequestTransitionName = keyof typeof TRANSITIONS & string

/** Deutsche Bezeichnung der Zustände (4.1), für die Oberfläche. */
export const DEMAND_REQUEST_STATE_LABELS: {
  readonly [S in DemandRequestState]: string
} = {
  draft: 'Entwurf',
  submitted: 'zur Freigabe eingereicht',
  approved: 'freigegeben',
  tendered: 'ausgeschrieben',
  inSelection: 'in Auswahl',
  filled: 'besetzt',
  cancelled: 'storniert',
  expired: 'abgelaufen',
}
