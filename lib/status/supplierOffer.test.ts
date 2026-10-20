/**
 * Tests des Statusmodells des Lieferantenangebots gegen SPEC 4.2.2.
 *
 * Diese Tests prüfen Anwendungscode und sind **nicht** die AÜG-Regeln; die
 * stehen als Gherkin in tests/aueg/ und werden hier nicht berührt.
 */
import { describe, expect, it } from 'vitest'
import type { ResourceRef } from '../authz/check'
import {
  CUSTOMER_TENANT,
  DAY,
  OTHER_SUPPLIER_TENANT,
  subject,
  SUPPLIER_TENANT,
} from '../testing/fixtures'
import { attemptTransition, isTerminal, transitionsFrom } from './machine'
import { SUPPLIER_OFFER_MODEL, type SupplierOfferFacts } from './supplierOffer'

const TODAY = DAY('2026-03-02')

/** Das Angebot gehört dem Lieferanten und ist dem Kunden im Umfang von [18] zugänglich. */
function offerRef(options: Partial<ResourceRef> = {}): ResourceRef {
  return {
    type: 'supplierOffer',
    tenantId: SUPPLIER_TENANT,
    tenantType: 'supplier',
    supplierTenantId: SUPPLIER_TENANT,
    customerTenantId: CUSTOMER_TENANT,
    status: 'draft',
    disclosedToTenantIds: [CUSTOMER_TENANT],
    ...options,
  }
}

function facts(overrides: Partial<SupplierOfferFacts> = {}): SupplierOfferFacts {
  return {
    invitationStatus: 'viewed',
    offerDeadline: DAY('2026-03-20'),
    itemCount: 1,
    availableFrom: DAY('2026-04-01'),
    offeredHeadcount: 2,
    reviewedAt: null,
    rejectionReason: null,
    offerValidUntil: DAY('2026-03-31'),
    acceptedSubmissionCount: 0,
    evaluationDate: TODAY,
    ...overrides,
  }
}

describe('4.2.2 — zulässige Übergänge', () => {
  it('LD legt zur eigenen Einladung ein Angebot an (— → draft)', () => {
    const outcome = attemptTransition(SUPPLIER_OFFER_MODEL, 'create', {
      currentStatus: null,
      subject: subject('supplierCoordinator'),
      resource: offerRef(),
      facts: facts(),
    })
    expect(outcome).toMatchObject({ applied: true, to: 'draft' })
  })

  it('LD reicht ein (draft → submitted)', () => {
    const outcome = attemptTransition(SUPPLIER_OFFER_MODEL, 'submit', {
      currentStatus: 'draft',
      subject: subject('supplierCoordinator'),
      resource: offerRef(),
      facts: facts(),
    })
    expect(outcome).toMatchObject({ applied: true, to: 'submitted' })
  })

  it('LD ändert, solange nicht gesichtet (submitted → submitted, Fußnote [19])', () => {
    const outcome = attemptTransition(SUPPLIER_OFFER_MODEL, 'amend', {
      currentStatus: 'submitted',
      subject: subject('supplierCoordinator'),
      resource: offerRef({ status: 'submitted' }),
      facts: facts(),
    })
    expect(outcome).toMatchObject({ applied: true, from: 'submitted', to: 'submitted' })
  })

  it('MD sichtet (submitted → reviewed)', () => {
    const outcome = attemptTransition(SUPPLIER_OFFER_MODEL, 'review', {
      currentStatus: 'submitted',
      subject: subject('operatorCoordinator'),
      resource: offerRef({ status: 'submitted' }),
      facts: facts(),
    })
    expect(outcome).toMatchObject({ applied: true, to: 'reviewed' })
  })

  it('MD lehnt mit Begründung ab (submitted → rejected)', () => {
    const outcome = attemptTransition(SUPPLIER_OFFER_MODEL, 'reject', {
      currentStatus: 'submitted',
      subject: subject('operatorCoordinator'),
      resource: offerRef({ status: 'submitted' }),
      facts: facts({ rejectionReason: 'Verfügbarkeit passt nicht zum Bedarfsbeginn' }),
    })
    expect(outcome).toMatchObject({ applied: true, to: 'rejected' })
  })

  it('LD zieht zurück (submitted → withdrawn)', () => {
    const outcome = attemptTransition(SUPPLIER_OFFER_MODEL, 'withdraw', {
      currentStatus: 'submitted',
      subject: subject('supplierCoordinator'),
      resource: offerRef({ status: 'submitted' }),
      facts: facts(),
    })
    expect(outcome).toMatchObject({ applied: true, to: 'withdrawn' })
  })
})

describe('4.2.2 — abgelehnte Übergänge', () => {
  it('kein draft → reviewed: ein nicht eingereichtes Angebot sieht der Betreiber nicht', () => {
    const outcome = attemptTransition(SUPPLIER_OFFER_MODEL, 'review', {
      currentStatus: 'draft',
      subject: subject('operatorCoordinator'),
      resource: offerRef(),
      facts: facts(),
    })
    expect(outcome).toMatchObject({ applied: false, rejection: { kind: 'statusMismatch' } })
  })

  it('aus accepted führt kein Übergang (4.0, Regel 9)', () => {
    expect(transitionsFrom(SUPPLIER_OFFER_MODEL, 'accepted')).toEqual([])
    const outcome = attemptTransition(SUPPLIER_OFFER_MODEL, 'reject', {
      currentStatus: 'accepted',
      subject: subject('operatorCoordinator'),
      resource: offerRef({ status: 'accepted' }),
      facts: facts({ rejectionReason: 'doch nicht' }),
    })
    expect(outcome).toMatchObject({ applied: false, rejection: { kind: 'statusMismatch' } })
  })

  it('Ändern nach der Sichtung scheitert (Fußnote [19])', () => {
    const outcome = attemptTransition(SUPPLIER_OFFER_MODEL, 'amend', {
      currentStatus: 'submitted',
      subject: subject('supplierCoordinator'),
      resource: offerRef({ status: 'submitted' }),
      facts: facts({ reviewedAt: TODAY }),
    })
    expect(outcome).toMatchObject({ applied: false, rejection: { kind: 'precondition' } })
  })

  it('Einreichen ohne Angebotsposition scheitert', () => {
    const outcome = attemptTransition(SUPPLIER_OFFER_MODEL, 'submit', {
      currentStatus: 'draft',
      subject: subject('supplierCoordinator'),
      resource: offerRef(),
      facts: facts({ itemCount: 0 }),
    })
    expect(outcome).toMatchObject({ applied: false, rejection: { kind: 'precondition' } })
  })

  it('Einreichen nach Ablauf der Angebotsfrist scheitert', () => {
    const outcome = attemptTransition(SUPPLIER_OFFER_MODEL, 'submit', {
      currentStatus: 'draft',
      subject: subject('supplierCoordinator'),
      resource: offerRef(),
      facts: facts({ offerDeadline: DAY('2026-03-01') }),
    })
    expect(outcome).toMatchObject({ applied: false, rejection: { kind: 'precondition' } })
  })

  it('Ablehnen ohne Begründung scheitert (2.3, Regel 3)', () => {
    const outcome = attemptTransition(SUPPLIER_OFFER_MODEL, 'reject', {
      currentStatus: 'reviewed',
      subject: subject('operatorCoordinator'),
      resource: offerRef({ status: 'reviewed' }),
      facts: facts({ rejectionReason: null }),
    })
    expect(outcome).toMatchObject({ applied: false, rejection: { kind: 'precondition' } })
  })

  it('der Zuschlag setzt einen zugesagten Profilvorschlag voraus (3.6, noch offen)', () => {
    const outcome = attemptTransition(SUPPLIER_OFFER_MODEL, 'accept', {
      currentStatus: 'reviewed',
      subject: subject('operatorCoordinator'),
      resource: offerRef({ status: 'reviewed' }),
      facts: facts({ acceptedSubmissionCount: 0 }),
    })
    expect(outcome).toMatchObject({ applied: false, rejection: { kind: 'precondition' } })
  })
})

describe('4.2.2 — die auslösende Rolle', () => {
  it('der Betreiber ändert ein Angebot nicht inhaltlich (2.1)', () => {
    const outcome = attemptTransition(SUPPLIER_OFFER_MODEL, 'amend', {
      currentStatus: 'submitted',
      subject: subject('operatorAdmin'),
      resource: offerRef({ status: 'submitted' }),
      facts: facts(),
    })
    expect(outcome).toMatchObject({ applied: false, rejection: { kind: 'roleNotTriggering' } })
  })

  it('MA erteilt keinen Zuschlag — 4.2.2 nennt dafür nur MD', () => {
    const outcome = attemptTransition(SUPPLIER_OFFER_MODEL, 'accept', {
      currentStatus: 'reviewed',
      subject: subject('operatorAdmin'),
      resource: offerRef({ status: 'reviewed' }),
      facts: facts({ acceptedSubmissionCount: 1 }),
    })
    expect(outcome).toMatchObject({ applied: false, rejection: { kind: 'roleNotTriggering' } })
  })

  it('der Lieferantenadministrator reicht nicht ein ([7] trägt nur L)', () => {
    const outcome = attemptTransition(SUPPLIER_OFFER_MODEL, 'submit', {
      currentStatus: 'draft',
      subject: subject('supplierAdmin'),
      resource: offerRef(),
      facts: facts(),
    })
    expect(outcome).toMatchObject({ applied: false, rejection: { kind: 'roleNotTriggering' } })
  })

  it('der Bedarfsträger des Kunden wechselt am Angebot keinen Status ([18] trägt nur L)', () => {
    const outcome = attemptTransition(SUPPLIER_OFFER_MODEL, 'review', {
      currentStatus: 'submitted',
      subject: subject('demandOwner'),
      resource: offerRef({ status: 'submitted' }),
      facts: facts(),
    })
    expect(outcome).toMatchObject({ applied: false, rejection: { kind: 'roleNotTriggering' } })
  })
})

describe('4.2.2 — Mandantengrenze (2.3)', () => {
  it('ein anderer Lieferant reicht das fremde Angebot nicht ein ([20], [7])', () => {
    const outcome = attemptTransition(SUPPLIER_OFFER_MODEL, 'submit', {
      currentStatus: 'draft',
      subject: subject('supplierCoordinator', { tenantId: OTHER_SUPPLIER_TENANT }),
      resource: offerRef(),
      facts: facts(),
    })
    expect(outcome).toMatchObject({ applied: false, rejection: { kind: 'notPermitted' } })
  })

  it('der MSP-Disponent ohne Betreuungszuordnung für diesen Kunden sichtet nicht (2.3)', () => {
    const outcome = attemptTransition(SUPPLIER_OFFER_MODEL, 'review', {
      currentStatus: 'submitted',
      subject: subject('operatorCoordinator', {
        accountAssignmentCustomerTenantIds: ['tenant-customer-2'],
      }),
      resource: offerRef({ status: 'submitted' }),
      facts: facts(),
    })
    expect(outcome).toMatchObject({ applied: false, rejection: { kind: 'notPermitted' } })
    if (!outcome.applied) expect(outcome.rejection.reason).toContain('Teilmenge der Kunden')
  })

  it('alle vier Endzustände aus 4.2.2 sind endgültig', () => {
    expect(SUPPLIER_OFFER_MODEL.terminalStates).toEqual([
      'accepted',
      'rejected',
      'withdrawn',
      'expired',
    ])
    for (const state of SUPPLIER_OFFER_MODEL.terminalStates) {
      expect(isTerminal(SUPPLIER_OFFER_MODEL, state)).toBe(true)
      expect(transitionsFrom(SUPPLIER_OFFER_MODEL, state)).toEqual([])
    }
  })
})
