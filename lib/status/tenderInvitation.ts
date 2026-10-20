/**
 * Statusmodell der Einladung — SPEC 4.2.1, Objekt `tenderInvitation` (3.5).
 *
 * Zustände: `invited` → `viewed` → `offerSubmitted`, dazu `declined` und
 * `expired`. Endzustände sind `declined` und `expired`; `offerSubmitted` ist
 * das Ende des **eigenen** Lebenszyklus — der Vorgang läuft am Angebot weiter
 * (4.2.2).
 *
 * Die Absage setzt der **Lieferantendisponent selbst** (Fußnote [46],
 * Entscheidung zu vormals offener Frage 23): ein eng begrenztes Statusrecht auf
 * den eigenen Vorgang. Annahme, Fristverlängerung und der Fortschritt der
 * Ausschreibung bleiben beim Betreiber.
 *
 * Nicht vorhanden sind — und damit nicht ausdrückbar:
 *
 *  - ein Rückweg von `declined` oder `expired`: eine zweite Chance ist eine
 *    neue Ausschreibungsrunde mit neuer Einladung (3.5).
 *  - `offerSubmitted` → `viewed`: zieht der Lieferant sein Angebot zurück,
 *    bleibt die Einladung auf `offerSubmitted` — sie **war** beantwortet, und
 *    der Rückzug ist am Angebot dokumentiert.
 *  - jeder Übergang, der erkennbar macht, wie viele Lieferanten eingeladen
 *    wurden oder geantwortet haben (2.3, „Zwischen Lieferanten").
 */
import type { Precondition, StatusModel, TransitionDefinition } from './machine'

export type TenderInvitationState =
  | 'invited'
  | 'viewed'
  | 'offerSubmitted'
  | 'declined'
  | 'expired'

/**
 * Die Tatsachen, die die Vorbedingungen aus 4.2.1 brauchen. Erhoben vom
 * Aufrufer, nicht hier gelesen.
 */
export interface TenderInvitationFacts {
  /** Ausschreibung veröffentlicht (`publishedAt`, 3.5). */
  readonly tenderPublished: boolean
  /** Ausschreibung geschlossen (`closedAt`, 3.5). */
  readonly tenderClosed: boolean
  readonly supplierStatus: 'onboarding' | 'active' | 'blocked' | 'inactive'
  /** Erlaubnis anerkannt **und** am Stichtag gültig (5.4, Prüfung P9). */
  readonly hasAcceptedValidPermit: boolean
  /** Erster lesender Zugriff eines Benutzers des Lieferanten (4.2.1). */
  readonly readBySupplierUser: boolean
  /** Status des Angebots zu dieser Einladung, oder `null` ohne Angebot. */
  readonly offerStatus: string | null
  readonly declineReason: string | null
  readonly offerDeadline: Date | null
  /** Stichtag der Prüfung; nie „heute" im Rechenweg (5.0). */
  readonly evaluationDate: Date
}

type InvitationPrecondition = Precondition<TenderInvitationFacts>
type InvitationTransition = TransitionDefinition<TenderInvitationState, TenderInvitationFacts>

const noOfferYet: InvitationPrecondition = {
  description: 'Kein Angebot zu dieser Einladung vorhanden.',
  specReference: 'SPEC 4.2.1, → expired',
  isSatisfied: (facts) => facts.offerStatus === null,
}

const TRANSITIONS = {
  /** | — | `invited` | `MD`, `MA` | */
  invite: {
    from: [],
    to: 'invited',
    label: 'einladen',
    roles: ['operatorCoordinator', 'operatorAdmin'],
    specReference: 'SPEC 4.2.1, — → invited',
    preconditions: [
      {
        description: 'Ausschreibung ist veröffentlicht (4.1).',
        specReference: 'SPEC 4.2.1, — → invited; 4.1',
        isSatisfied: (facts) => facts.tenderPublished,
      },
      {
        description:
          'Lieferant ist `active` (4.6) mit anerkannter, gültiger AÜG-Erlaubnis (5.4, P9).',
        specReference: 'SPEC 4.2.1, — → invited; 4.6; 5.4',
        isSatisfied: (facts) =>
          facts.supplierStatus === 'active' && facts.hasAcceptedValidPermit,
      },
    ],
  },

  /**
   * | `invited` | `viewed` | System |
   *
   * **Kein** Rechtsgeschäft und keine Zusage: der Übergang hält nur fest, dass
   * der Lieferant die Anfrage im Umfang von [14] gesehen hat, und beendet die
   * Erinnerungsfrist.
   */
  markViewed: {
    from: ['invited'],
    to: 'viewed',
    label: 'zur Kenntnis genommen',
    roles: [],
    specReference: 'SPEC 4.2.1, invited → viewed',
    preconditions: [
      {
        description: 'Erster lesender Zugriff eines Benutzers des Lieferanten.',
        specReference: 'SPEC 4.2.1, invited → viewed',
        isSatisfied: (facts) => facts.readBySupplierUser,
      },
    ],
  },

  /**
   * | `invited`, `viewed` | `offerSubmitted` | System |
   *
   * Folge des Übergangs `draft` → `submitted` am Angebot (4.2.2) — die
   * Einladung wechselt nicht aus eigenem Antrieb.
   */
  recordOfferSubmitted: {
    from: ['invited', 'viewed'],
    to: 'offerSubmitted',
    label: 'Angebot abgegeben',
    roles: [],
    specReference: 'SPEC 4.2.1, invited|viewed → offerSubmitted',
    preconditions: [
      {
        description: 'Angebot zu dieser Einladung steht in `submitted` (4.2.2).',
        specReference: 'SPEC 4.2.1, → offerSubmitted; 4.2.2',
        isSatisfied: (facts) => facts.offerStatus === 'submitted',
      },
    ],
  },

  /** | `invited`, `viewed` | `declined` | `LD` ([46]) | */
  decline: {
    from: ['invited', 'viewed'],
    to: 'declined',
    label: 'absagen',
    roles: ['supplierCoordinator'],
    specReference: 'SPEC 4.2.1, invited|viewed → declined',
    preconditions: [
      {
        description:
          'Absagegrund ist Pflicht (`declineReason`, 3.5); die Absage enthält keinen Bezug auf ' +
          'andere Lieferanten (2.3).',
        specReference: 'SPEC 4.2.1, → declined',
        isSatisfied: (facts) =>
          facts.declineReason !== null && facts.declineReason.trim() !== '',
      },
    ],
  },

  /**
   * | `invited`, `viewed` | `expired` | System |
   *
   * Entzieht nur: Fristablauf gewährt nichts (4.0, Regel 4). Eskalationsanlass
   * „Ausschreibung ohne Angebot" (2.4).
   */
  expire: {
    from: ['invited', 'viewed'],
    to: 'expired',
    label: 'ablaufen (Angebotsfrist verstrichen)',
    roles: [],
    specReference: 'SPEC 4.2.1, → expired',
    preconditions: [
      {
        description:
          'Angebotsfrist der Ausschreibung verstrichen **oder** Ausschreibung geschlossen.',
        specReference: 'SPEC 4.2.1, → expired; 3.5',
        isSatisfied: (facts) =>
          facts.tenderClosed ||
          (facts.offerDeadline !== null &&
            facts.offerDeadline.getTime() < facts.evaluationDate.getTime()),
      },
      noOfferYet,
    ],
  },
} as const satisfies Readonly<Record<string, InvitationTransition>>

export const TENDER_INVITATION_MODEL: StatusModel<
  TenderInvitationState,
  TenderInvitationFacts,
  typeof TRANSITIONS
> = {
  object: 'Einladung (3.5)',
  specReference: 'SPEC 4.2.1',
  states: ['invited', 'viewed', 'offerSubmitted', 'declined', 'expired'],
  // `offerSubmitted` ist kein Endzustand im Sinne von 4.0, Regel 9, sondern das
  // Ende des eigenen Lebenszyklus: der Vorgang läuft am Angebot weiter. Dass
  // aus ihm kein Übergang führt, ergibt sich aus der Übergangstabelle.
  terminalStates: ['declined', 'expired'],
  transitions: TRANSITIONS,
}

export type TenderInvitationTransitionName = keyof typeof TRANSITIONS & string

/** Deutsche Bezeichnung der Zustände (4.2.1), für die Oberfläche. */
export const TENDER_INVITATION_STATE_LABELS: {
  readonly [S in TenderInvitationState]: string
} = {
  invited: 'eingeladen',
  viewed: 'zur Kenntnis genommen',
  offerSubmitted: 'Angebot abgegeben',
  declined: 'abgesagt',
  expired: 'abgelaufen',
}
