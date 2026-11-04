/**
 * Tests des Statusmodells der Verlängerung gegen SPEC 4.3.2.
 *
 * Je Übergang: ein erlaubter Fall, ein abgelehnter aus dem falschen Zustand,
 * einer, der an der Rolle scheitert, und die Mandantengrenze aus 2.3. Dazu die
 * zwei Festlegungen, die 4.3.2 ausdrücklich trifft: ohne kundenseitige
 * Genehmigung wird nichts wirksam, und eine genehmigte Verlängerung wird nicht
 * mehr abgelehnt.
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
  OTHER_CUSTOMER_TENANT,
  OTHER_SUPPLIER_TENANT,
  subject,
  SUPPLIER_TENANT,
} from '../testing/fixtures'
import {
  ASSIGNMENT_EXTENSION_MODEL,
  type AssignmentExtensionFacts,
} from './assignmentExtension'
import { attemptTransition, isTerminal, transitionsFrom } from './machine'

const TODAY = DAY('2026-11-04')

/** Die Verlängerung teilt die Matrixzeile und den Mandanten des Einsatzes (3.7). */
function extensionRef(options: Partial<ResourceRef> = {}): ResourceRef {
  return {
    type: 'assignment',
    tenantId: OPERATOR_TENANT,
    tenantType: 'operator',
    customerTenantId: CUSTOMER_TENANT,
    supplierTenantId: SUPPLIER_TENANT,
    siteId: 'site-1',
    costCenterId: 'cc-1',
    status: 'requested',
    disclosedToTenantIds: [CUSTOMER_TENANT, SUPPLIER_TENANT],
    ...options,
  }
}

function facts(overrides: Partial<AssignmentExtensionFacts> = {}): AssignmentExtensionFacts {
  return {
    assignmentStatus: 'active',
    currentEndDate: DAY('2027-05-31'),
    newEndDate: DAY('2027-09-30'),
    reason: 'Montagelinie läuft länger als geplant',
    requestedById: 'user-demandOwner',
    actingUserId: 'user-approver',
    approvedById: null,
    rejectionReason: null,
    newEndWithinMaxDuration: true,
    hasAcceptedValidPermitForNewPeriod: true,
    evaluationDate: TODAY,
    ...overrides,
  }
}

describe('4.3.2 — zulässige Übergänge', () => {
  it('KB beantragt (— → requested)', () => {
    const outcome = attemptTransition(ASSIGNMENT_EXTENSION_MODEL, 'request', {
      currentStatus: null,
      subject: subject('demandOwner'),
      resource: extensionRef(),
      facts: facts({ actingUserId: 'user-demandOwner' }),
    })
    expect(outcome).toMatchObject({ applied: true, to: 'requested' })
  })

  it('LD beantragt ebenfalls ([25])', () => {
    const outcome = attemptTransition(ASSIGNMENT_EXTENSION_MODEL, 'request', {
      currentStatus: null,
      subject: subject('supplierCoordinator'),
      resource: extensionRef(),
      facts: facts({
        requestedById: 'user-supplierCoordinator',
        actingUserId: 'user-supplierCoordinator',
      }),
    })
    expect(outcome).toMatchObject({ applied: true, to: 'requested' })
  })

  it('KG genehmigt (requested → approved)', () => {
    const outcome = attemptTransition(ASSIGNMENT_EXTENSION_MODEL, 'approve', {
      currentStatus: 'requested',
      subject: subject('approver'),
      resource: extensionRef(),
      facts: facts(),
    })
    expect(outcome).toMatchObject({ applied: true, to: 'approved' })
  })

  it('KG lehnt mit Begründung ab (requested → rejected)', () => {
    const outcome = attemptTransition(ASSIGNMENT_EXTENSION_MODEL, 'reject', {
      currentStatus: 'requested',
      subject: subject('approver'),
      resource: extensionRef(),
      facts: facts({ rejectionReason: 'Laufzeit über die Linienumstellung hinaus' }),
    })
    expect(outcome).toMatchObject({ applied: true, to: 'rejected' })
  })

  it('der Antragsteller zieht zurück (requested → withdrawn)', () => {
    const outcome = attemptTransition(ASSIGNMENT_EXTENSION_MODEL, 'withdraw', {
      currentStatus: 'requested',
      subject: subject('demandOwner'),
      resource: extensionRef(),
      facts: facts({ actingUserId: 'user-demandOwner' }),
    })
    expect(outcome).toMatchObject({ applied: true, to: 'withdrawn' })
  })

  it('MD setzt wirksam (approved → effective)', () => {
    const outcome = attemptTransition(ASSIGNMENT_EXTENSION_MODEL, 'makeEffective', {
      currentStatus: 'approved',
      subject: subject('operatorCoordinator'),
      resource: extensionRef({ status: 'approved' }),
      facts: facts({ approvedById: 'user-approver', actingUserId: 'user-operatorCoordinator' }),
    })
    expect(outcome).toMatchObject({ applied: true, to: 'effective' })
  })
})

describe('4.3.2 — ausgeschlossene Übergänge', () => {
  it('kein requested → effective: ohne kundenseitige Genehmigung wird nichts wirksam', () => {
    const outcome = attemptTransition(ASSIGNMENT_EXTENSION_MODEL, 'makeEffective', {
      currentStatus: 'requested',
      subject: subject('operatorCoordinator'),
      resource: extensionRef(),
      facts: facts({ actingUserId: 'user-operatorCoordinator' }),
    })
    expect(outcome).toMatchObject({ applied: false, rejection: { kind: 'statusMismatch' } })
  })

  it('kein approved → rejected: der Vorgang bleibt in `approved` und ist dokumentiert', () => {
    const outcome = attemptTransition(ASSIGNMENT_EXTENSION_MODEL, 'reject', {
      currentStatus: 'approved',
      subject: subject('approver'),
      resource: extensionRef({ status: 'approved' }),
      facts: facts({ rejectionReason: 'doch nicht' }),
    })
    expect(outcome).toMatchObject({ applied: false, rejection: { kind: 'statusMismatch' } })
  })

  it('keine Rückgängigmachung einer wirksamen Verlängerung (effective ist Endzustand)', () => {
    expect(transitionsFrom(ASSIGNMENT_EXTENSION_MODEL, 'effective')).toEqual([])
  })

  it('kein zeitgesteuerter Übergang: jeder Übergang nennt eine auslösende Rolle', () => {
    for (const transition of Object.values(ASSIGNMENT_EXTENSION_MODEL.transitions)) {
      expect(transition.roles.length).toBeGreaterThan(0)
    }
  })
})

describe('4.3.2 — Übergänge, die an der Rolle scheitern', () => {
  it('der Betreiber genehmigt nicht: die Genehmigung ist Sache der Kundenseite ([26])', () => {
    const outcome = attemptTransition(ASSIGNMENT_EXTENSION_MODEL, 'approve', {
      currentStatus: 'requested',
      subject: subject('operatorCoordinator'),
      resource: extensionRef(),
      facts: facts({ actingUserId: 'user-operatorCoordinator' }),
    })
    expect(outcome).toMatchObject({ applied: false, rejection: { kind: 'roleNotTriggering' } })
  })

  it('der Bedarfsträger setzt nicht wirksam: das ist der Übergang des MD', () => {
    const outcome = attemptTransition(ASSIGNMENT_EXTENSION_MODEL, 'makeEffective', {
      currentStatus: 'approved',
      subject: subject('demandOwner'),
      resource: extensionRef({ status: 'approved' }),
      facts: facts({ approvedById: 'user-approver', actingUserId: 'user-demandOwner' }),
    })
    expect(outcome).toMatchObject({ applied: false, rejection: { kind: 'roleNotTriggering' } })
  })

  it('wer beantragt, genehmigt nicht (2.4, Regel 5)', () => {
    const outcome = attemptTransition(ASSIGNMENT_EXTENSION_MODEL, 'approve', {
      currentStatus: 'requested',
      subject: subject('approver'),
      resource: extensionRef(),
      facts: facts({ requestedById: 'user-approver', actingUserId: 'user-approver' }),
    })
    expect(outcome).toMatchObject({ applied: false, rejection: { kind: 'precondition' } })
  })

  it('nur der Antragsteller zieht seinen Antrag zurück', () => {
    const outcome = attemptTransition(ASSIGNMENT_EXTENSION_MODEL, 'withdraw', {
      currentStatus: 'requested',
      subject: subject('supplierCoordinator'),
      resource: extensionRef(),
      facts: facts({
        requestedById: 'user-demandOwner',
        actingUserId: 'user-supplierCoordinator',
      }),
    })
    expect(outcome).toMatchObject({ applied: false, rejection: { kind: 'precondition' } })
  })
})

describe('2.3 — die Mandantengrenze geht dem Rollenrecht vor', () => {
  it('ein fremder Kunde genehmigt die Verlängerung nicht', () => {
    const outcome = attemptTransition(ASSIGNMENT_EXTENSION_MODEL, 'approve', {
      currentStatus: 'requested',
      subject: subject('approver', { tenantId: OTHER_CUSTOMER_TENANT }),
      resource: extensionRef(),
      facts: facts({ actingUserId: 'user-approver' }),
    })
    expect(outcome).toMatchObject({
      applied: false,
      rejection: { kind: 'notPermitted', specReference: 'SPEC 2.3, Grundsatz' },
    })
  })

  it('ein fremder Lieferant beantragt an diesem Einsatz nichts', () => {
    const outcome = attemptTransition(ASSIGNMENT_EXTENSION_MODEL, 'request', {
      currentStatus: null,
      subject: subject('supplierCoordinator', { tenantId: OTHER_SUPPLIER_TENANT }),
      resource: extensionRef(),
      facts: facts({
        requestedById: 'user-supplierCoordinator',
        actingUserId: 'user-supplierCoordinator',
      }),
    })
    expect(outcome).toMatchObject({ applied: false, rejection: { kind: 'notPermitted' } })
  })
})

describe('4.3.2 — Vorbedingungen', () => {
  it('kein Antrag ohne späteres Ende (3.7)', () => {
    const outcome = attemptTransition(ASSIGNMENT_EXTENSION_MODEL, 'request', {
      currentStatus: null,
      subject: subject('demandOwner'),
      resource: extensionRef(),
      facts: facts({
        actingUserId: 'user-demandOwner',
        newEndDate: DAY('2027-01-31'),
      }),
    })
    expect(outcome).toMatchObject({ applied: false, rejection: { kind: 'precondition' } })
  })

  it('kein Antrag ohne Begründung (3.7)', () => {
    const outcome = attemptTransition(ASSIGNMENT_EXTENSION_MODEL, 'request', {
      currentStatus: null,
      subject: subject('demandOwner'),
      resource: extensionRef(),
      facts: facts({ actingUserId: 'user-demandOwner', reason: '  ' }),
    })
    expect(outcome).toMatchObject({ applied: false, rejection: { kind: 'precondition' } })
  })

  it('kein Antrag zu einem beendeten Einsatz (4.3.1)', () => {
    const outcome = attemptTransition(ASSIGNMENT_EXTENSION_MODEL, 'request', {
      currentStatus: null,
      subject: subject('demandOwner'),
      resource: extensionRef(),
      facts: facts({ actingUserId: 'user-demandOwner', assignmentStatus: 'completed' }),
    })
    expect(outcome).toMatchObject({ applied: false, rejection: { kind: 'precondition' } })
  })

  it('keine Wirksamkeit über `maxDurationEndDate` hinaus — P1 sperrt (5.1, 5.5)', () => {
    const outcome = attemptTransition(ASSIGNMENT_EXTENSION_MODEL, 'makeEffective', {
      currentStatus: 'approved',
      subject: subject('operatorCoordinator'),
      resource: extensionRef({ status: 'approved' }),
      facts: facts({
        approvedById: 'user-approver',
        actingUserId: 'user-operatorCoordinator',
        newEndWithinMaxDuration: false,
      }),
    })
    expect(outcome).toMatchObject({ applied: false, rejection: { kind: 'precondition' } })
  })

  it('keine Wirksamkeit ohne gültige Erlaubnis für den verlängerten Zeitraum (P9, 5.4.1)', () => {
    const outcome = attemptTransition(ASSIGNMENT_EXTENSION_MODEL, 'makeEffective', {
      currentStatus: 'approved',
      subject: subject('operatorCoordinator'),
      resource: extensionRef({ status: 'approved' }),
      facts: facts({
        approvedById: 'user-approver',
        actingUserId: 'user-operatorCoordinator',
        hasAcceptedValidPermitForNewPeriod: false,
      }),
    })
    expect(outcome).toMatchObject({ applied: false, rejection: { kind: 'precondition' } })
  })
})

describe('4.3.2 — Form des Modells', () => {
  it('die drei Endzustände tragen keinen Ausgang (4.0, Regel 9)', () => {
    for (const state of ['effective', 'rejected', 'withdrawn'] as const) {
      expect(isTerminal(ASSIGNMENT_EXTENSION_MODEL, state)).toBe(true)
      expect(transitionsFrom(ASSIGNMENT_EXTENSION_MODEL, state)).toEqual([])
    }
  })
})
