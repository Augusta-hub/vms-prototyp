/**
 * Statusmodell des Lieferantenangebots — SPEC 4.2.2, Objekt `supplierOffer`
 * (3.5).
 *
 * Dieses Modell gehört zu dieser Arbeitseinheit, weil 4.2.1 es braucht: die
 * Einladung wechselt nach `offerSubmitted` ausschließlich **als Folge** des
 * Übergangs `draft` → `submitted` am Angebot. Ohne das Angebot wäre 4.2.1 nur
 * halb umgesetzt.
 *
 * Zustände: `draft` → `submitted` → `reviewed` → `accepted`, dazu `rejected`,
 * `withdrawn` und `expired`. Endzustände sind `accepted`, `rejected`,
 * `withdrawn` und `expired`.
 *
 * Nicht vorhanden sind — und damit nicht ausdrückbar:
 *
 *  - jeder Übergang aus `accepted`: ein Widerruf des Zuschlags ist die
 *    vorzeitige Beendigung des entstandenen Einsatzes (4.3).
 *  - eine inhaltliche Änderung durch den Betreiber: `MA` darf sperren oder
 *    stornieren, aber nicht ändern (2.1).
 *  - `draft` → `reviewed`: ein nicht eingereichtes Angebot ist für den
 *    Betreiber nicht sichtbar.
 *  - jeder Übergang, der dem Lieferanten die eigene Platzierung verrät — auch
 *    nicht in der Ablehnungsbegründung (2.3, „Zwischen Lieferanten").
 *
 * `reviewed` → `accepted` setzt einen zugesagten Profilvorschlag voraus (3.6,
 * 4.2.3). Das Objekt ist noch nicht modelliert; der Übergang ist deshalb
 * genannt und scheitert an seiner Vorbedingung, statt stillschweigend zu
 * fehlen.
 */
import type { Precondition, StatusModel, TransitionDefinition } from './machine'

export type SupplierOfferState =
  | 'draft'
  | 'submitted'
  | 'reviewed'
  | 'accepted'
  | 'rejected'
  | 'withdrawn'
  | 'expired'

/** Die Tatsachen, die die Vorbedingungen aus 4.2.2 brauchen. */
export interface SupplierOfferFacts {
  /** Status der eigenen Einladung (4.2.1). */
  readonly invitationStatus: 'invited' | 'viewed' | 'offerSubmitted' | 'declined' | 'expired'
  /** Angebotsfrist der Ausschreibung (3.5). */
  readonly offerDeadline: Date | null
  readonly itemCount: number
  readonly availableFrom: Date | null
  readonly offeredHeadcount: number
  readonly reviewedAt: Date | null
  readonly rejectionReason: string | null
  /** Bindefrist des Angebots (`offerValidUntil`, 3.5). */
  readonly offerValidUntil: Date | null
  /** Profilvorschläge dieses Angebots in `accepted` (4.2.3) — aus 3.6. */
  readonly acceptedSubmissionCount: number
  /** Stichtag der Prüfung; nie „heute" im Rechenweg (5.0). */
  readonly evaluationDate: Date
}

type OfferPrecondition = Precondition<SupplierOfferFacts>
type OfferTransition = TransitionDefinition<SupplierOfferState, SupplierOfferFacts>

const offerDeadlineNotPassed: OfferPrecondition = {
  description: 'Angebotsfrist ist nicht verstrichen.',
  specReference: 'SPEC 4.2.2, — → draft, draft → submitted',
  isSatisfied: (facts) =>
    facts.offerDeadline === null ||
    facts.offerDeadline.getTime() >= facts.evaluationDate.getTime(),
}

const TRANSITIONS = {
  /** | — | `draft` | `LD` (anlegen) | */
  create: {
    from: [],
    to: 'draft',
    label: 'Angebot anlegen',
    roles: ['supplierCoordinator'],
    specReference: 'SPEC 4.2.2, — → draft',
    preconditions: [
      {
        description: 'Eigene Einladung steht in `invited` oder `viewed` (4.2.1).',
        specReference: 'SPEC 4.2.2, — → draft; 4.2.1',
        isSatisfied: (facts) =>
          facts.invitationStatus === 'invited' || facts.invitationStatus === 'viewed',
      },
      offerDeadlineNotPassed,
    ],
  },

  /** | `draft` | `submitted` | `LD` ([20]) | */
  submit: {
    from: ['draft'],
    to: 'submitted',
    label: 'Angebot einreichen',
    roles: ['supplierCoordinator'],
    specReference: 'SPEC 4.2.2, draft → submitted',
    preconditions: [
      {
        description:
          'Mindestens eine Angebotsposition; `availableFrom` und `offeredHeadcount` gesetzt.',
        specReference: 'SPEC 4.2.2, draft → submitted; 3.5',
        isSatisfied: (facts) =>
          facts.itemCount >= 1 && facts.availableFrom !== null && facts.offeredHeadcount >= 1,
      },
      offerDeadlineNotPassed,
    ],
  },

  /**
   * | `submitted` | `submitted` | `LD` ([19]) |
   *
   * Inhaltliche Änderung, **kein** Statuswechsel — zulässig nur, solange das
   * Angebot nicht gesichtet ist.
   */
  amend: {
    from: ['submitted'],
    to: 'submitted',
    label: 'Angebot ändern',
    roles: ['supplierCoordinator'],
    specReference: 'SPEC 4.2.2, submitted → submitted',
    preconditions: [
      {
        description: 'Angebot ist noch nicht gesichtet (`reviewedAt` leer).',
        specReference: 'SPEC 4.2.2, submitted → submitted; Fußnote [19]',
        isSatisfied: (facts) => facts.reviewedAt === null,
      },
    ],
  },

  /** | `submitted` | `reviewed` | `MD` ([17]), `MA` | */
  review: {
    from: ['submitted'],
    to: 'reviewed',
    label: 'sichten',
    roles: ['operatorCoordinator', 'operatorAdmin'],
    specReference: 'SPEC 4.2.2, submitted → reviewed',
    preconditions: [],
  },

  /** | `reviewed` | `accepted` | `MD` ([17]) | */
  accept: {
    from: ['reviewed'],
    to: 'accepted',
    label: 'Zuschlag erteilen',
    roles: ['operatorCoordinator'],
    specReference: 'SPEC 4.2.2, reviewed → accepted',
    preconditions: [
      {
        description:
          'Mindestens ein Profilvorschlag dieses Angebots steht in `accepted` (4.2.3). Der ' +
          'Profilvorschlag ist Teil von 3.6 und noch nicht modelliert.',
        specReference: 'SPEC 4.2.2, reviewed → accepted; 4.2.3',
        isSatisfied: (facts) => facts.acceptedSubmissionCount >= 1,
      },
    ],
  },

  /** | `submitted`, `reviewed` | `rejected` | `MD` ([17]), `MA` | */
  reject: {
    from: ['submitted', 'reviewed'],
    to: 'rejected',
    label: 'ablehnen',
    roles: ['operatorCoordinator', 'operatorAdmin'],
    specReference: 'SPEC 4.2.2, submitted|reviewed → rejected',
    preconditions: [
      {
        description:
          'Begründung ist Pflicht und **ohne** Bezug auf ein fremdes Angebot (2.3, Regel 3).',
        specReference: 'SPEC 4.2.2, → rejected; 2.3, Regel 3',
        isSatisfied: (facts) =>
          facts.rejectionReason !== null && facts.rejectionReason.trim() !== '',
      },
    ],
  },

  /** | `draft`, `submitted`, `reviewed` | `withdrawn` | `LD` ([20]) | */
  withdraw: {
    from: ['draft', 'submitted', 'reviewed'],
    to: 'withdrawn',
    label: 'zurückziehen',
    roles: ['supplierCoordinator'],
    specReference: 'SPEC 4.2.2, → withdrawn',
    // „Angebot noch nicht `accepted`" ist durch die Spalte „Von" erfüllt: aus
    // `accepted` führt kein Übergang (4.0, Regel 9).
    preconditions: [],
  },

  /**
   * | `submitted`, `reviewed` | `expired` | System |
   *
   * Entzieht nur (4.0, Regel 4).
   */
  expire: {
    from: ['submitted', 'reviewed'],
    to: 'expired',
    label: 'ablaufen (Bindefrist verstrichen)',
    roles: [],
    specReference: 'SPEC 4.2.2, → expired',
    preconditions: [
      {
        description: 'Bindefrist `offerValidUntil` ist verstrichen.',
        specReference: 'SPEC 4.2.2, → expired; 3.5',
        isSatisfied: (facts) =>
          facts.offerValidUntil !== null &&
          facts.offerValidUntil.getTime() < facts.evaluationDate.getTime(),
      },
    ],
  },
} as const satisfies Readonly<Record<string, OfferTransition>>

export const SUPPLIER_OFFER_MODEL: StatusModel<
  SupplierOfferState,
  SupplierOfferFacts,
  typeof TRANSITIONS
> = {
  object: 'Lieferantenangebot (3.5)',
  specReference: 'SPEC 4.2.2',
  states: ['draft', 'submitted', 'reviewed', 'accepted', 'rejected', 'withdrawn', 'expired'],
  terminalStates: ['accepted', 'rejected', 'withdrawn', 'expired'],
  transitions: TRANSITIONS,
}

export type SupplierOfferTransitionName = keyof typeof TRANSITIONS & string

/** Deutsche Bezeichnung der Zustände (4.2.2), für die Oberfläche. */
export const SUPPLIER_OFFER_STATE_LABELS: { readonly [S in SupplierOfferState]: string } = {
  draft: 'Entwurf',
  submitted: 'eingereicht',
  reviewed: 'gesichtet',
  accepted: 'zugesagt',
  rejected: 'abgelehnt',
  withdrawn: 'zurückgezogen',
  expired: 'abgelaufen',
}
