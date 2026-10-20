/**
 * Tests des Statusmodells der Einladung gegen SPEC 4.2.1.
 *
 * Schwerpunkte: die Absage durch den Lieferantendisponenten selbst
 * (Fußnote [46]), die Systemübergänge `viewed`, `offerSubmitted` und `expired`
 * — und die Trennung zwischen Lieferanten (2.3).
 *
 * Diese Tests prüfen Anwendungscode und sind **nicht** die AÜG-Regeln; die
 * stehen als Gherkin in tests/aueg/ und werden hier nicht berührt.
 */
import { describe, expect, it } from 'vitest'
import type { ResourceRef } from '../authz/check'
import {
  CUSTOMER_TENANT,
  DAY,
  OPERATOR_TENANT,
  OTHER_SUPPLIER_TENANT,
  subject,
  SUPPLIER_TENANT,
} from '../testing/fixtures'
import { attemptTransition, isTerminal, transitionsFrom } from './machine'
import {
  TENDER_INVITATION_MODEL,
  type TenderInvitationFacts,
  type TenderInvitationState,
} from './tenderInvitation'

const TODAY = DAY('2026-03-02')

/** Die Einladung gehört dem Betreiber, ist aber dem Lieferanten zugänglich (3.5). */
function invitationRef(options: Partial<ResourceRef> = {}): ResourceRef {
  return {
    type: 'tender',
    tenantId: OPERATOR_TENANT,
    tenantType: 'operator',
    customerTenantId: CUSTOMER_TENANT,
    supplierTenantId: SUPPLIER_TENANT,
    status: 'invited',
    disclosedToTenantIds: [CUSTOMER_TENANT, SUPPLIER_TENANT],
    ...options,
  }
}

function facts(overrides: Partial<TenderInvitationFacts> = {}): TenderInvitationFacts {
  return {
    tenderPublished: true,
    tenderClosed: false,
    supplierStatus: 'active',
    hasAcceptedValidPermit: true,
    readBySupplierUser: false,
    offerStatus: null,
    declineReason: null,
    offerDeadline: DAY('2026-03-20'),
    evaluationDate: TODAY,
    ...overrides,
  }
}

describe('4.2.1 — zulässige Übergänge', () => {
  it('MD lädt ein (— → invited)', () => {
    const outcome = attemptTransition(TENDER_INVITATION_MODEL, 'invite', {
      currentStatus: null,
      subject: subject('operatorCoordinator'),
      resource: invitationRef(),
      facts: facts(),
    })
    expect(outcome).toMatchObject({ applied: true, to: 'invited' })
  })

  it('LD sagt die eigene Einladung mit Grund ab (invited → declined, Fußnote [46])', () => {
    const outcome = attemptTransition(TENDER_INVITATION_MODEL, 'decline', {
      currentStatus: 'invited',
      subject: subject('supplierCoordinator'),
      resource: invitationRef(),
      facts: facts({ declineReason: 'keine Kapazität im Zeitraum' }),
    })
    expect(outcome).toMatchObject({ applied: true, to: 'declined' })
  })

  it('der erste lesende Zugriff setzt viewed — Systemübergang ohne Subjekt', () => {
    const outcome = attemptTransition(TENDER_INVITATION_MODEL, 'markViewed', {
      currentStatus: 'invited',
      resource: invitationRef(),
      facts: facts({ readBySupplierUser: true }),
    })
    expect(outcome).toMatchObject({ applied: true, to: 'viewed' })
  })

  it('das eingereichte Angebot setzt offerSubmitted — Folge aus 4.2.2', () => {
    const outcome = attemptTransition(TENDER_INVITATION_MODEL, 'recordOfferSubmitted', {
      currentStatus: 'viewed',
      resource: invitationRef({ status: 'viewed' }),
      facts: facts({ offerStatus: 'submitted' }),
    })
    expect(outcome).toMatchObject({ applied: true, to: 'offerSubmitted' })
  })

  it('die verstrichene Angebotsfrist lässt die Einladung ablaufen', () => {
    const outcome = attemptTransition(TENDER_INVITATION_MODEL, 'expire', {
      currentStatus: 'invited',
      resource: invitationRef(),
      facts: facts({ offerDeadline: DAY('2026-03-01') }),
    })
    expect(outcome).toMatchObject({ applied: true, to: 'expired' })
  })
})

describe('4.2.1 — abgelehnte Übergänge', () => {
  it('ein Übergang, den 4.2.1 nicht nennt, hat keinen Namen', () => {
    const outcome = attemptTransition(
      TENDER_INVITATION_MODEL,
      // @ts-expect-error — `offerSubmitted` → `viewed` gibt es nicht (4.2.1).
      'reopen',
      {
        currentStatus: 'offerSubmitted',
        resource: invitationRef({ status: 'offerSubmitted' }),
        facts: facts(),
      },
    )
    expect(outcome).toMatchObject({ applied: false, rejection: { kind: 'unknownTransition' } })
  })

  it('kein Rückweg aus declined (4.2.1: eine zweite Chance ist eine neue Runde)', () => {
    const outcome = attemptTransition(TENDER_INVITATION_MODEL, 'recordOfferSubmitted', {
      currentStatus: 'declined',
      resource: invitationRef({ status: 'declined' }),
      facts: facts({ offerStatus: 'submitted' }),
    })
    expect(outcome).toMatchObject({ applied: false, rejection: { kind: 'statusMismatch' } })
  })

  it('aus offerSubmitted führt kein Übergang zurück nach viewed', () => {
    expect(transitionsFrom(TENDER_INVITATION_MODEL, 'offerSubmitted')).toEqual([])
  })

  it('Absage ohne Grund scheitert an der Vorbedingung', () => {
    const outcome = attemptTransition(TENDER_INVITATION_MODEL, 'decline', {
      currentStatus: 'invited',
      subject: subject('supplierCoordinator'),
      resource: invitationRef(),
      facts: facts({ declineReason: '' }),
    })
    expect(outcome).toMatchObject({ applied: false, rejection: { kind: 'precondition' } })
  })

  it('Einladen eines gesperrten Lieferanten scheitert (4.6)', () => {
    const outcome = attemptTransition(TENDER_INVITATION_MODEL, 'invite', {
      currentStatus: null,
      subject: subject('operatorCoordinator'),
      resource: invitationRef(),
      facts: facts({ supplierStatus: 'blocked' }),
    })
    expect(outcome).toMatchObject({ applied: false, rejection: { kind: 'precondition' } })
  })

  it('die Frist läuft nicht ab, solange ein Angebot vorliegt', () => {
    const outcome = attemptTransition(TENDER_INVITATION_MODEL, 'expire', {
      currentStatus: 'viewed',
      resource: invitationRef({ status: 'viewed' }),
      facts: facts({ offerDeadline: DAY('2026-03-01'), offerStatus: 'submitted' }),
    })
    expect(outcome).toMatchObject({ applied: false, rejection: { kind: 'precondition' } })
  })
})

describe('4.2.1 — die auslösende Rolle', () => {
  it('der Lieferantenadministrator sagt nicht ab — die Zeile trägt für LA kein Recht', () => {
    const outcome = attemptTransition(TENDER_INVITATION_MODEL, 'decline', {
      currentStatus: 'invited',
      subject: subject('supplierAdmin'),
      resource: invitationRef(),
      facts: facts({ declineReason: 'keine Kapazität' }),
    })
    expect(outcome).toMatchObject({ applied: false, rejection: { kind: 'roleNotTriggering' } })
  })

  it('der MSP-Disponent sagt die Einladung des Lieferanten nicht ab ([46])', () => {
    const outcome = attemptTransition(TENDER_INVITATION_MODEL, 'decline', {
      currentStatus: 'invited',
      subject: subject('operatorCoordinator'),
      resource: invitationRef(),
      facts: facts({ declineReason: 'keine Kapazität' }),
    })
    expect(outcome).toMatchObject({ applied: false, rejection: { kind: 'roleNotTriggering' } })
  })

  it('der Lieferant lädt nicht selbst ein', () => {
    const outcome = attemptTransition(TENDER_INVITATION_MODEL, 'invite', {
      currentStatus: null,
      subject: subject('supplierCoordinator'),
      resource: invitationRef(),
      facts: facts(),
    })
    expect(outcome).toMatchObject({ applied: false, rejection: { kind: 'roleNotTriggering' } })
  })

  it('ein Systemübergang wird nicht durch eine Benutzerhandlung ausgelöst', () => {
    const outcome = attemptTransition(TENDER_INVITATION_MODEL, 'markViewed', {
      currentStatus: 'invited',
      subject: subject('supplierCoordinator'),
      resource: invitationRef(),
      facts: facts({ readBySupplierUser: true }),
    })
    expect(outcome).toMatchObject({ applied: false, rejection: { kind: 'systemTransition' } })
  })
})

describe('4.2.1 — Mandantengrenze und Trennung zwischen Lieferanten (2.3)', () => {
  it('ein anderer Lieferant sagt die fremde Einladung nicht ab (Fußnote [46], [7])', () => {
    const outcome = attemptTransition(TENDER_INVITATION_MODEL, 'decline', {
      currentStatus: 'invited',
      subject: subject('supplierCoordinator', { tenantId: OTHER_SUPPLIER_TENANT }),
      resource: invitationRef(),
      facts: facts({ declineReason: 'kein Personal' }),
    })
    expect(outcome).toMatchObject({ applied: false, rejection: { kind: 'notPermitted' } })
  })

  it('ohne ausdrückliche Zugänglichkeit greift die Mandantengrenze (2.3)', () => {
    const outcome = attemptTransition(TENDER_INVITATION_MODEL, 'decline', {
      currentStatus: 'invited',
      subject: subject('supplierCoordinator'),
      // Dieselbe Einladung, aber nicht als zugänglich gekennzeichnet: der
      // Vorgang gehört dem Betreiber.
      resource: invitationRef({ disclosedToTenantIds: [] }),
      facts: facts({ declineReason: 'keine Kapazität' }),
    })
    expect(outcome).toMatchObject({ applied: false, rejection: { kind: 'notPermitted' } })
    if (!outcome.applied) expect(outcome.rejection.reason).toContain('anderen Mandanten')
  })

  it('die Endzustände sind declined und expired', () => {
    expect(TENDER_INVITATION_MODEL.terminalStates).toEqual(['declined', 'expired'])
    for (const state of TENDER_INVITATION_MODEL.terminalStates) {
      expect(isTerminal(TENDER_INVITATION_MODEL, state)).toBe(true)
      expect(transitionsFrom(TENDER_INVITATION_MODEL, state)).toEqual([])
    }
  })

  it('jeder Zustand aus 4.2.1 ist geführt', () => {
    const states: readonly TenderInvitationState[] = [
      'invited',
      'viewed',
      'offerSubmitted',
      'declined',
      'expired',
    ]
    expect(TENDER_INVITATION_MODEL.states).toEqual(states)
  })
})
