/**
 * Tests des Statusmodells der Bedarfsanfrage gegen SPEC 4.1.
 *
 * Geprüft wird je Übergang: ein zulässiger Fall, ein an der Vorbedingung
 * scheiternder, ein an der Rolle scheiternder — und dass ein Übergang, den 4.1
 * **nicht** nennt, abgelehnt wird. Dazu die Mandantengrenze aus 2.3.
 *
 * Diese Tests prüfen Anwendungscode und sind **nicht** die AÜG-Regeln; die
 * stehen als Gherkin in tests/aueg/ und werden hier nicht berührt.
 */
import { describe, expect, it } from 'vitest'
import type { ResourceRef } from '../authz/check'
import {
  CUSTOMER_TENANT,
  DAY,
  OTHER_CUSTOMER_TENANT,
  subject,
  SUPPLIER_TENANT,
} from '../testing/fixtures'
import {
  DEMAND_REQUEST_MODEL,
  type DemandRequestFacts,
  type DemandRequestState,
} from './demandRequest'
import { attemptTransition, isTerminal, transitionsFrom } from './machine'

const TODAY = DAY('2026-03-02')
const DEMAND_OWNER = 'user-demandOwner'

function requestRef(options: Partial<ResourceRef> = {}): ResourceRef {
  return {
    type: 'demandRequest',
    tenantId: CUSTOMER_TENANT,
    tenantType: 'customer',
    customerTenantId: CUSTOMER_TENANT,
    siteId: 'site-1',
    costCenterId: 'cc-1',
    requestedById: DEMAND_OWNER,
    status: 'draft',
    ...options,
  }
}

function facts(overrides: Partial<DemandRequestFacts> = {}): DemandRequestFacts {
  return {
    requestedById: DEMAND_OWNER,
    actingUserId: DEMAND_OWNER,
    activityDescription: 'Kommissionierung im Wareneingang, Halle 2',
    qualificationRequirementCount: 1,
    siteId: 'site-1',
    costCenterId: 'cc-1',
    startDate: DAY('2026-04-01'),
    weeklyHours: 38.5,
    headcount: 2,
    offerDeadline: DAY('2026-03-20'),
    cancellationReason: null,
    rejectionReason: null,
    invitedSuppliers: [
      { supplierId: 'supplier-1', supplierStatus: 'active', hasAcceptedValidPermit: true },
    ],
    previousTenderClosed: true,
    releasedSubmissionCount: 0,
    openSubmissionCount: 0,
    effectiveAssignmentCount: 0,
    evaluationDate: TODAY,
    ...overrides,
  }
}

describe('4.1 — zulässige Übergänge', () => {
  it('KB reicht den eigenen Entwurf zur Freigabe ein (draft → submitted)', () => {
    const outcome = attemptTransition(DEMAND_REQUEST_MODEL, 'submit', {
      currentStatus: 'draft',
      subject: subject('demandOwner', { userId: DEMAND_OWNER }),
      resource: requestRef(),
      facts: facts(),
    })
    expect(outcome).toMatchObject({ applied: true, from: 'draft', to: 'submitted' })
  })

  it('KG gibt frei (submitted → approved), wenn er nicht der Bedarfsträger ist', () => {
    const outcome = attemptTransition(DEMAND_REQUEST_MODEL, 'approve', {
      currentStatus: 'submitted',
      subject: subject('approver', { userId: 'user-approver' }),
      resource: requestRef({ status: 'submitted' }),
      facts: facts({ actingUserId: 'user-approver' }),
    })
    expect(outcome).toMatchObject({ applied: true, to: 'approved' })
  })

  it('KG weist mit Begründung zurück (submitted → draft)', () => {
    const outcome = attemptTransition(DEMAND_REQUEST_MODEL, 'returnToDraft', {
      currentStatus: 'submitted',
      subject: subject('approver', { userId: 'user-approver' }),
      resource: requestRef({ status: 'submitted' }),
      facts: facts({ actingUserId: 'user-approver', rejectionReason: 'Kostenstelle falsch' }),
    })
    expect(outcome).toMatchObject({ applied: true, to: 'draft' })
  })

  it('MD schreibt aus (approved → tendered)', () => {
    const outcome = attemptTransition(DEMAND_REQUEST_MODEL, 'publishTender', {
      currentStatus: 'approved',
      subject: subject('operatorCoordinator'),
      resource: requestRef({ status: 'approved' }),
      facts: facts({ actingUserId: 'user-operatorCoordinator' }),
    })
    expect(outcome).toMatchObject({ applied: true, to: 'tendered' })
  })

  it('KB storniert mit Grund (draft → cancelled)', () => {
    const outcome = attemptTransition(DEMAND_REQUEST_MODEL, 'cancel', {
      currentStatus: 'draft',
      subject: subject('demandOwner', { userId: DEMAND_OWNER }),
      resource: requestRef(),
      facts: facts({ cancellationReason: 'Bedarf entfallen' }),
    })
    expect(outcome).toMatchObject({ applied: true, to: 'cancelled' })
  })

  it('der Ablauf ist ein Systemübergang und braucht kein Subjekt', () => {
    const outcome = attemptTransition(DEMAND_REQUEST_MODEL, 'expire', {
      currentStatus: 'tendered',
      resource: requestRef({ status: 'tendered' }),
      facts: facts({ actingUserId: null, startDate: DAY('2026-03-01') }),
    })
    expect(outcome).toMatchObject({ applied: true, to: 'expired' })
  })
})

describe('4.1 — abgelehnte Übergänge', () => {
  it('ein Übergang, den 4.1 nicht nennt, hat keinen Namen und wird abgelehnt', () => {
    // `draft` → `approved` gibt es nicht: Einreichen und Freigeben sind
    // getrennte Handlungen zweier Rollen.
    const outcome = attemptTransition(
      DEMAND_REQUEST_MODEL,
      // @ts-expect-error — genau das ist die Zusicherung: der Name existiert nicht.
      'approveDirectly',
      {
        currentStatus: 'draft',
        subject: subject('approver'),
        resource: requestRef(),
        facts: facts(),
      },
    )
    expect(outcome).toMatchObject({ applied: false, rejection: { kind: 'unknownTransition' } })
  })

  it('kein draft → approved: der Übergang führt nur aus submitted', () => {
    const outcome = attemptTransition(DEMAND_REQUEST_MODEL, 'approve', {
      currentStatus: 'draft',
      subject: subject('approver', { userId: 'user-approver' }),
      resource: requestRef(),
      facts: facts({ actingUserId: 'user-approver' }),
    })
    expect(outcome).toMatchObject({ applied: false, rejection: { kind: 'statusMismatch' } })
  })

  it('aus einem Endzustand führt kein Übergang zurück (4.0, Regel 9)', () => {
    const outcome = attemptTransition(DEMAND_REQUEST_MODEL, 'cancel', {
      currentStatus: 'filled',
      subject: subject('operatorCoordinator'),
      resource: requestRef({ status: 'filled' }),
      facts: facts({ cancellationReason: 'doch nicht' }),
    })
    expect(outcome).toMatchObject({ applied: false, rejection: { kind: 'statusMismatch' } })
    expect(outcome.applied).toBe(false)
    if (!outcome.applied) expect(outcome.rejection.reason).toContain('Endzustand')
  })

  it('wer beantragt, genehmigt nicht (2.4, Regel 5)', () => {
    const outcome = attemptTransition(DEMAND_REQUEST_MODEL, 'approve', {
      currentStatus: 'submitted',
      // Dieselbe Person trägt die Rolle des Genehmigers und ist Bedarfsträger.
      subject: subject('approver', { userId: DEMAND_OWNER }),
      resource: requestRef({ status: 'submitted' }),
      facts: facts({ actingUserId: DEMAND_OWNER }),
    })
    expect(outcome).toMatchObject({ applied: false, rejection: { kind: 'precondition' } })
  })

  it('Einreichen ohne Pflichtfelder scheitert an der Vorbedingung', () => {
    const outcome = attemptTransition(DEMAND_REQUEST_MODEL, 'submit', {
      currentStatus: 'draft',
      subject: subject('demandOwner', { userId: DEMAND_OWNER }),
      resource: requestRef(),
      facts: facts({ qualificationRequirementCount: 0 }),
    })
    expect(outcome).toMatchObject({ applied: false, rejection: { kind: 'precondition' } })
  })

  it('Rückweisung ohne Begründung scheitert', () => {
    const outcome = attemptTransition(DEMAND_REQUEST_MODEL, 'returnToDraft', {
      currentStatus: 'submitted',
      subject: subject('approver', { userId: 'user-approver' }),
      resource: requestRef({ status: 'submitted' }),
      facts: facts({ actingUserId: 'user-approver', rejectionReason: '   ' }),
    })
    expect(outcome).toMatchObject({ applied: false, rejection: { kind: 'precondition' } })
  })

  it('Ausschreiben scheitert, wenn ein eingeladener Lieferant nicht aktiv ist (4.6)', () => {
    const outcome = attemptTransition(DEMAND_REQUEST_MODEL, 'publishTender', {
      currentStatus: 'approved',
      subject: subject('operatorCoordinator'),
      resource: requestRef({ status: 'approved' }),
      facts: facts({
        invitedSuppliers: [
          { supplierId: 'supplier-1', supplierStatus: 'blocked', hasAcceptedValidPermit: true },
        ],
      }),
    })
    expect(outcome).toMatchObject({ applied: false, rejection: { kind: 'precondition' } })
  })

  it('Ausschreiben scheitert ohne anerkannte, gültige Erlaubnis (5.4, P9)', () => {
    const outcome = attemptTransition(DEMAND_REQUEST_MODEL, 'publishTender', {
      currentStatus: 'approved',
      subject: subject('operatorCoordinator'),
      resource: requestRef({ status: 'approved' }),
      facts: facts({
        invitedSuppliers: [
          { supplierId: 'supplier-1', supplierStatus: 'active', hasAcceptedValidPermit: false },
        ],
      }),
    })
    expect(outcome).toMatchObject({ applied: false, rejection: { kind: 'precondition' } })
  })

  it('ein Systemübergang wird nicht durch eine Benutzerhandlung ausgelöst (4.0, Regel 10)', () => {
    const outcome = attemptTransition(DEMAND_REQUEST_MODEL, 'expire', {
      currentStatus: 'tendered',
      subject: subject('operatorAdmin'),
      resource: requestRef({ status: 'tendered' }),
      facts: facts({ startDate: DAY('2026-03-01') }),
    })
    expect(outcome).toMatchObject({ applied: false, rejection: { kind: 'systemTransition' } })
  })
})

describe('4.1 — die auslösende Rolle', () => {
  it('die Freigabe ist keine Handlung des Betreibers (4.0, Regel 7)', () => {
    for (const role of ['operatorAdmin', 'operatorCoordinator'] as const) {
      const outcome = attemptTransition(DEMAND_REQUEST_MODEL, 'approve', {
        currentStatus: 'submitted',
        subject: subject(role),
        resource: requestRef({ status: 'submitted' }),
        facts: facts({ actingUserId: `user-${role}` }),
      })
      expect(outcome).toMatchObject({
        applied: false,
        rejection: { kind: 'roleNotTriggering' },
      })
    }
  })

  it('KE löst keinen Übergang der Bedarfsanfrage aus — die Matrix nennt kein S', () => {
    const outcome = attemptTransition(DEMAND_REQUEST_MODEL, 'submit', {
      currentStatus: 'draft',
      subject: subject('procurementController'),
      resource: requestRef(),
      facts: facts(),
    })
    expect(outcome).toMatchObject({ applied: false, rejection: { kind: 'roleNotTriggering' } })
  })

  it('KB schreibt nicht aus: Verteilung an Lieferanten ist Sache des Betreibers', () => {
    const outcome = attemptTransition(DEMAND_REQUEST_MODEL, 'publishTender', {
      currentStatus: 'approved',
      subject: subject('demandOwner', { userId: DEMAND_OWNER }),
      resource: requestRef({ status: 'approved' }),
      facts: facts(),
    })
    expect(outcome).toMatchObject({ applied: false, rejection: { kind: 'roleNotTriggering' } })
  })

  it('KG darf nur freigeben und zurückweisen, nicht stornieren (Fußnote [13])', () => {
    const outcome = attemptTransition(DEMAND_REQUEST_MODEL, 'cancel', {
      currentStatus: 'submitted',
      subject: subject('approver', { userId: 'user-approver' }),
      resource: requestRef({ status: 'submitted' }),
      facts: facts({ actingUserId: 'user-approver', cancellationReason: 'Bedarf entfallen' }),
    })
    expect(outcome).toMatchObject({ applied: false, rejection: { kind: 'roleNotTriggering' } })
  })

  it('bei Mehrfachrolle zählt die Rolle, die 4.1 nennt (2.1: keine Vererbung)', () => {
    // Derselbe Benutzer trägt beide Kundenrollen und ist Bedarfsträger seiner
    // Anfrage. Einreichen trägt die Rolle `KB`; die Freigabe scheitert
    // trotz der Rolle `KG` am Vier-Augen-Prinzip (2.4, Regel 5) — die zweite
    // Rolle verschafft kein Recht, das die erste ausschließt.
    const both = subject('demandOwner', {
      userId: DEMAND_OWNER,
      grants: [
        {
          roleAssignmentId: 'ra-1',
          roleCode: 'demandOwner',
          tenantId: CUSTOMER_TENANT,
          responsibilityScopes: [],
        },
        {
          roleAssignmentId: 'ra-2',
          roleCode: 'approver',
          tenantId: CUSTOMER_TENANT,
          responsibilityScopes: [],
        },
      ],
    })

    expect(
      attemptTransition(DEMAND_REQUEST_MODEL, 'submit', {
        currentStatus: 'draft',
        subject: both,
        resource: requestRef(),
        facts: facts(),
      }).applied,
    ).toBe(true)

    expect(
      attemptTransition(DEMAND_REQUEST_MODEL, 'approve', {
        currentStatus: 'submitted',
        subject: both,
        resource: requestRef({ status: 'submitted' }),
        facts: facts({ actingUserId: DEMAND_OWNER }),
      }),
    ).toMatchObject({ applied: false, rejection: { kind: 'precondition' } })
  })
})

describe('4.1 — Mandantengrenze (2.3)', () => {
  it('der Bedarfsträger eines anderen Kunden kommt nicht an die Anfrage', () => {
    const outcome = attemptTransition(DEMAND_REQUEST_MODEL, 'submit', {
      currentStatus: 'draft',
      subject: subject('demandOwner', {
        userId: 'user-fremd',
        tenantId: OTHER_CUSTOMER_TENANT,
      }),
      resource: requestRef(),
      facts: facts({ actingUserId: 'user-fremd', requestedById: 'user-fremd' }),
    })
    expect(outcome).toMatchObject({
      applied: false,
      rejection: { kind: 'notPermitted' },
    })
    if (!outcome.applied) expect(outcome.rejection.reason).toContain('anderen Mandanten')
  })

  it('ein Lieferant wechselt keinen Status an der Bedarfsanfrage — die Zeile trägt nur L[14]', () => {
    const outcome = attemptTransition(DEMAND_REQUEST_MODEL, 'cancel', {
      currentStatus: 'tendered',
      subject: subject('supplierCoordinator', { tenantId: SUPPLIER_TENANT }),
      resource: requestRef({ status: 'tendered', disclosedToTenantIds: [SUPPLIER_TENANT] }),
      facts: facts({ cancellationReason: 'kein Personal' }),
    })
    expect(outcome).toMatchObject({ applied: false, rejection: { kind: 'roleNotTriggering' } })
  })

  it('der MSP-Disponent ohne Betreuungszuordnung für diesen Kunden kommt nicht heran (2.3)', () => {
    const outcome = attemptTransition(DEMAND_REQUEST_MODEL, 'publishTender', {
      currentStatus: 'approved',
      subject: subject('operatorCoordinator', {
        accountAssignmentCustomerTenantIds: [OTHER_CUSTOMER_TENANT],
      }),
      resource: requestRef({ status: 'approved' }),
      facts: facts(),
    })
    expect(outcome).toMatchObject({ applied: false, rejection: { kind: 'notPermitted' } })
    if (!outcome.applied) expect(outcome.rejection.reason).toContain('Teilmenge der Kunden')
  })
})

describe('4.1 — Aufbau des Modells', () => {
  it('die Endzustände sind filled, cancelled und expired', () => {
    expect(DEMAND_REQUEST_MODEL.terminalStates).toEqual(['filled', 'cancelled', 'expired'])
  })

  it('aus keinem Endzustand führt ein Übergang heraus', () => {
    for (const state of DEMAND_REQUEST_MODEL.terminalStates) {
      expect(transitionsFrom(DEMAND_REQUEST_MODEL, state)).toEqual([])
      expect(isTerminal(DEMAND_REQUEST_MODEL, state)).toBe(true)
    }
  })

  it('jeder Zustand aus 4.1 ist geführt', () => {
    const states: readonly DemandRequestState[] = [
      'draft',
      'submitted',
      'approved',
      'tendered',
      'inSelection',
      'filled',
      'cancelled',
      'expired',
    ]
    expect(DEMAND_REQUEST_MODEL.states).toEqual(states)
  })

  it('es gibt keinen Übergang submitted → tendered (ohne Freigabe keine Ausschreibung)', () => {
    const fromSubmitted = transitionsFrom(DEMAND_REQUEST_MODEL, 'submitted').map(
      (name) => DEMAND_REQUEST_MODEL.transitions[name].to,
    )
    expect(fromSubmitted).not.toContain('tendered')
    expect(new Set(fromSubmitted)).toEqual(new Set(['approved', 'draft', 'cancelled']))
  })
})
