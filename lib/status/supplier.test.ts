/**
 * Tests des Lieferantenstatus gegen SPEC 4.6.
 *
 * Geprüft wird je Übergang: ein erlaubter Fall, die Spalte „Von", die
 * auslösende Rolle und jede Vorbedingung einzeln. Dazu die Fälle, die 4.6
 * ausdrücklich **ausschließt** — die Entsperrung durch `MD`, der Umweg über
 * `blocked` im Onboarding, die Beendigung bei laufendem Einsatz — und das
 * Vier-Augen-Prinzip aus 2.4, Regel 5.
 *
 * Diese Tests prüfen Anwendungscode und sind **nicht** die AÜG-Regeln; die
 * stehen als Gherkin in tests/aueg/ und werden hier nicht berührt.
 */
import { describe, expect, it } from 'vitest'
import type { ResourceRef } from '../authz/check'
import { CUSTOMER_TENANT, DAY, subject, SUPPLIER_TENANT } from '../testing/fixtures'
import { attemptTransition, isTerminal, transitionsFrom } from './machine'
import { SUPPLIER_MODEL, type SupplierFacts, type SupplierState } from './supplier'

const TODAY = DAY('2026-11-10')
const SPERRENDE_PERSON = 'user-operatorCoordinator'

function supplierResource(status: SupplierState, options: Partial<ResourceRef> = {}): ResourceRef {
  return {
    type: 'supplier',
    tenantId: SUPPLIER_TENANT,
    tenantType: 'supplier',
    supplierTenantId: SUPPLIER_TENANT,
    status,
    engagementTenantIds: [CUSTOMER_TENANT],
    disclosedToTenantIds: [CUSTOMER_TENANT],
    ...options,
  }
}

function facts(overrides: Partial<SupplierFacts> = {}): SupplierFacts {
  return {
    supplierNumber: 'L-1',
    legalName: 'Rheinpersonal GmbH (synthetisch)',
    addressComplete: true,
    contactCount: 1,
    hasActiveMasterAgreement: true,
    hasCollectiveAgreement: true,
    hasAcceptedValidPermit: true,
    mandatoryDocumentsPresent: true,
    blockReason: null,
    blockedById: SPERRENDE_PERSON,
    actingUserId: 'user-operatorAdmin',
    unblockReason: null,
    reactivationReason: null,
    validTo: null,
    runningAssignments: 0,
    evaluationDate: TODAY,
    ...overrides,
  }
}

describe('Anlegen (— → onboarding, SPEC 4.6)', () => {
  it('nimmt den Lieferanten mit Nummer, Namen, Anschrift und Ansprechpartner an', () => {
    const outcome = attemptTransition(SUPPLIER_MODEL, 'create', {
      currentStatus: null,
      subject: subject('operatorAdmin'),
      resource: supplierResource('onboarding'),
      facts: facts(),
    })
    expect(outcome.applied).toBe(true)
    if (outcome.applied) expect(outcome.to).toBe('onboarding')
  })

  it('verweigert ihn ohne Ansprechpartner (3.2)', () => {
    const outcome = attemptTransition(SUPPLIER_MODEL, 'create', {
      currentStatus: null,
      subject: subject('operatorAdmin'),
      resource: supplierResource('onboarding'),
      facts: facts({ contactCount: 0 }),
    })
    expect(outcome.applied).toBe(false)
    if (!outcome.applied) expect(outcome.rejection.kind).toBe('precondition')
  })

  it('verweigert ihn ohne vollständige Anschrift (3.2)', () => {
    const outcome = attemptTransition(SUPPLIER_MODEL, 'create', {
      currentStatus: null,
      subject: subject('operatorAdmin'),
      resource: supplierResource('onboarding'),
      facts: facts({ addressComplete: false }),
    })
    expect(outcome.applied).toBe(false)
  })

  it('löst ihn nicht durch den Disponenten aus — 4.6 nennt nur `MA`', () => {
    const outcome = attemptTransition(SUPPLIER_MODEL, 'create', {
      currentStatus: null,
      subject: subject('operatorCoordinator'),
      resource: supplierResource('onboarding'),
      facts: facts(),
    })
    expect(outcome.applied).toBe(false)
    if (!outcome.applied) expect(outcome.rejection.kind).toBe('roleNotTriggering')
  })
})

describe('Freischalten (onboarding → active, SPEC 4.6; 4.7 Q41 und Q42)', () => {
  const freischalten = (overrides: Partial<SupplierFacts> = {}) =>
    attemptTransition(SUPPLIER_MODEL, 'activate', {
      currentStatus: 'onboarding',
      subject: subject('operatorAdmin'),
      resource: supplierResource('onboarding'),
      facts: facts(overrides),
    })

  it('nimmt das Freischalten an, wenn alle vier Voraussetzungen tragen', () => {
    const outcome = freischalten()
    expect(outcome.applied).toBe(true)
    if (outcome.applied) expect(outcome.to).toBe('active')
  })

  it('verweigert es ohne aktiven Rahmenvertrag (3.3)', () => {
    const outcome = freischalten({ hasActiveMasterAgreement: false })
    expect(outcome.applied).toBe(false)
    if (!outcome.applied) expect(outcome.rejection.reason).toMatch(/Rahmenvertrag/)
  })

  it('verweigert es ohne Tarifbindung des Verleihers (3.2)', () => {
    const outcome = freischalten({ hasCollectiveAgreement: false })
    expect(outcome.applied).toBe(false)
    if (!outcome.applied) expect(outcome.rejection.reason).toMatch(/supplierCollectiveAgreement/)
  })

  it('verweigert es ohne anerkannte, gültige Erlaubnis — P9, Q41 (5.4.1)', () => {
    const outcome = freischalten({ hasAcceptedValidPermit: false })
    expect(outcome.applied).toBe(false)
    if (!outcome.applied) {
      expect(outcome.rejection.reason).toMatch(/P9/)
      expect(outcome.rejection.specReference).toMatch(/Q41/)
    }
  })

  it('verweigert es ohne Pflichtnachweise — P10, Q42 (5.4.4)', () => {
    const outcome = freischalten({ mandatoryDocumentsPresent: false })
    expect(outcome.applied).toBe(false)
    if (!outcome.applied) {
      expect(outcome.rejection.reason).toMatch(/P10/)
      expect(outcome.rejection.specReference).toMatch(/Q42/)
    }
  })

  it('löst es nicht durch den Disponenten aus — [5] gibt ihm nur die Sperre', () => {
    const outcome = attemptTransition(SUPPLIER_MODEL, 'activate', {
      currentStatus: 'onboarding',
      subject: subject('operatorCoordinator'),
      resource: supplierResource('onboarding'),
      facts: facts(),
    })
    expect(outcome.applied).toBe(false)
    if (!outcome.applied) expect(outcome.rejection.kind).toBe('roleNotTriggering')
  })
})

describe('Sperren (active → blocked, SPEC 4.6)', () => {
  it('nimmt die Sperre durch den Disponenten mit Sperrgrund an ([5])', () => {
    const outcome = attemptTransition(SUPPLIER_MODEL, 'block', {
      currentStatus: 'active',
      subject: subject('operatorCoordinator'),
      resource: supplierResource('active'),
      facts: facts({ blockReason: 'Erlaubnis widerrufen (synthetisch)' }),
    })
    expect(outcome.applied).toBe(true)
  })

  it('verweigert sie ohne Sperrgrund (3.2)', () => {
    const outcome = attemptTransition(SUPPLIER_MODEL, 'block', {
      currentStatus: 'active',
      subject: subject('operatorAdmin'),
      resource: supplierResource('active'),
      facts: facts({ blockReason: '   ' }),
    })
    expect(outcome.applied).toBe(false)
    if (!outcome.applied) expect(outcome.rejection.kind).toBe('precondition')
  })

  it('führt nicht aus `onboarding` — kein Umweg um die Voraussetzungen (4.6)', () => {
    const outcome = attemptTransition(SUPPLIER_MODEL, 'block', {
      currentStatus: 'onboarding',
      subject: subject('operatorAdmin'),
      resource: supplierResource('onboarding'),
      facts: facts({ blockReason: 'Nachweise fehlen' }),
    })
    expect(outcome.applied).toBe(false)
    if (!outcome.applied) expect(outcome.rejection.kind).toBe('statusMismatch')
  })
})

describe('Entsperren (blocked → active, SPEC 4.6; 4.7 Q43)', () => {
  const entsperren = (overrides: Partial<SupplierFacts> = {}) =>
    attemptTransition(SUPPLIER_MODEL, 'unblock', {
      currentStatus: 'blocked',
      subject: subject('operatorAdmin'),
      resource: supplierResource('blocked'),
      facts: facts({ unblockReason: 'Erlaubnis neu erteilt', ...overrides }),
    })

  it('nimmt die Entsperrung durch `MA` mit Aufhebungsgrund an', () => {
    expect(entsperren().applied).toBe(true)
  })

  it('verweigert sie ohne Aufhebungsgrund — „behoben **und dokumentiert**"', () => {
    expect(entsperren({ unblockReason: null }).applied).toBe(false)
  })

  it('verweigert sie durch die sperrende Person (Vier-Augen, 2.4 Regel 5)', () => {
    const outcome = attemptTransition(SUPPLIER_MODEL, 'unblock', {
      currentStatus: 'blocked',
      subject: subject('operatorAdmin', { userId: SPERRENDE_PERSON }),
      resource: supplierResource('blocked'),
      facts: facts({ unblockReason: 'Grund behoben', actingUserId: SPERRENDE_PERSON }),
    })
    expect(outcome.applied).toBe(false)
    if (!outcome.applied) expect(outcome.rejection.reason).toMatch(/Vier-Augen/)
  })

  it('verweigert sie ohne gültige Erlaubnis — P9, Q43', () => {
    expect(entsperren({ hasAcceptedValidPermit: false }).applied).toBe(false)
  })

  it('löst sie **nicht** durch `MD` aus — [5]: sperren ja, entsperren nein', () => {
    const outcome = attemptTransition(SUPPLIER_MODEL, 'unblock', {
      currentStatus: 'blocked',
      subject: subject('operatorCoordinator'),
      resource: supplierResource('blocked'),
      facts: facts({ unblockReason: 'Grund behoben' }),
    })
    expect(outcome.applied).toBe(false)
    if (!outcome.applied) expect(outcome.rejection.kind).toBe('roleNotTriggering')
  })

  it('verlangt **keinen** Rahmenvertrag — 4.6 nennt bei der Entsperrung nur die Erlaubnis', () => {
    // Die Entsperrung hebt eine Sperre auf; sie ist nicht das erstmalige
    // Freischalten. 4.6 nennt dort ausdrücklich nur „Erlaubnis gültig und
    // anerkannt" — ein Rahmenvertrag, der zwischenzeitlich ausgelaufen ist,
    // wird über P9 und die Prüfungen am Vorgang wirksam, nicht hier.
    expect(entsperren({ hasActiveMasterAgreement: false }).applied).toBe(true)
  })
})

describe('Beauftragung beenden (→ inactive, SPEC 4.6)', () => {
  const beenden = (from: SupplierState, overrides: Partial<SupplierFacts> = {}) =>
    attemptTransition(SUPPLIER_MODEL, 'deactivate', {
      currentStatus: from,
      subject: subject('operatorAdmin'),
      resource: supplierResource(from),
      facts: facts({ validTo: DAY('2026-12-31'), ...overrides }),
    })

  it('führt aus `onboarding`, `active` und `blocked`', () => {
    expect(beenden('onboarding').applied).toBe(true)
    expect(beenden('active').applied).toBe(true)
    expect(beenden('blocked').applied).toBe(true)
  })

  it('verweigert sie ohne `validTo` (3.2)', () => {
    expect(beenden('active', { validTo: null }).applied).toBe(false)
  })

  it('verweigert sie bei laufendem Einsatz (4.3)', () => {
    const outcome = beenden('active', { runningAssignments: 1 })
    expect(outcome.applied).toBe(false)
    if (!outcome.applied) expect(outcome.rejection.reason).toMatch(/Einsatz/)
  })
})

describe('Reaktivieren (inactive → active, SPEC 4.6; 4.7 Q44)', () => {
  const reaktivieren = (overrides: Partial<SupplierFacts> = {}) =>
    attemptTransition(SUPPLIER_MODEL, 'reactivate', {
      currentStatus: 'inactive',
      subject: subject('operatorAdmin'),
      resource: supplierResource('inactive'),
      facts: facts({ reactivationReason: 'Neue Beauftragung', ...overrides }),
    })

  it('nimmt die Reaktivierung durch `MA` mit Begründung an', () => {
    expect(reaktivieren().applied).toBe(true)
  })

  it('verweigert sie ohne Begründung (4.6)', () => {
    expect(reaktivieren({ reactivationReason: '  ' }).applied).toBe(false)
  })

  it('verlangt wie beim Freischalten Rahmenvertrag, Tarif, P9 und P10', () => {
    expect(reaktivieren({ hasActiveMasterAgreement: false }).applied).toBe(false)
    expect(reaktivieren({ hasCollectiveAgreement: false }).applied).toBe(false)
    expect(reaktivieren({ hasAcceptedValidPermit: false }).applied).toBe(false)
    expect(reaktivieren({ mandatoryDocumentsPresent: false }).applied).toBe(false)
  })

  it('löst sie nicht durch `MD` aus ([5])', () => {
    const outcome = attemptTransition(SUPPLIER_MODEL, 'reactivate', {
      currentStatus: 'inactive',
      subject: subject('operatorCoordinator'),
      resource: supplierResource('inactive'),
      facts: facts({ reactivationReason: 'Neue Beauftragung' }),
    })
    expect(outcome.applied).toBe(false)
  })
})

describe('Was 4.6 über die Menge der Übergänge sagt', () => {
  it('führt **keinen** Endzustand — `inactive` ist der Ruhezustand', () => {
    expect(SUPPLIER_MODEL.terminalStates).toEqual([])
    expect(isTerminal(SUPPLIER_MODEL, 'inactive')).toBe(false)
    expect(transitionsFrom(SUPPLIER_MODEL, 'inactive')).toEqual(['reactivate'])
  })

  it('kennt genau die sechs Zeilen aus 4.6', () => {
    expect(Object.keys(SUPPLIER_MODEL.transitions)).toEqual([
      'create',
      'activate',
      'block',
      'unblock',
      'deactivate',
      'reactivate',
    ])
  })

  it('führt aus `active` nur Sperre und Beendigung', () => {
    expect(transitionsFrom(SUPPLIER_MODEL, 'active')).toEqual(['block', 'deactivate'])
  })

  it('kennt keinen zeitgesteuerten Übergang (5.4.2 a)', () => {
    // Jeder Übergang trägt mindestens eine auslösende Rolle; ein
    // Systemübergang hätte eine leere Rollenliste (4.0, Regel 10).
    for (const definition of Object.values(SUPPLIER_MODEL.transitions)) {
      expect(definition.roles.length).toBeGreaterThan(0)
    }
  })
})
