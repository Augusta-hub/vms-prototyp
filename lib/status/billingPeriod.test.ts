/**
 * Tests der Abrechnungsperiode gegen SPEC 4.5.1.
 *
 * Geprüft wird je Übergang: ein erlaubter Fall, die Spalte „Von", die
 * auslösende Rolle und jede Vorbedingung einzeln. Dazu die beiden Fälle, die
 * 4.5.1 ausdrücklich **ausschließt** — das Wiederöffnen und der Schluss durch
 * Fristablauf — und die Besonderheit dieser Zeile: das **Öffnen** ist ein
 * Übergang und keine Anlage, weil Fußnote [33] es so benennt.
 *
 * Diese Tests prüfen Anwendungscode und sind **nicht** die AÜG-Regeln; die
 * stehen als Gherkin in tests/aueg/ und werden hier nicht berührt.
 */
import { describe, expect, it } from 'vitest'
import type { ResourceRef } from '../authz/check'
import { CUSTOMER_TENANT, DAY, OPERATOR_TENANT, subject } from '../testing/fixtures'
import {
  BILLING_PERIOD_MODEL,
  type BillingPeriodFacts,
  type BillingPeriodState,
} from './billingPeriod'
import { attemptTransition, isTerminal, transitionsFrom } from './machine'

const TODAY = DAY('2026-11-12')

function periodResource(
  status: BillingPeriodState,
  options: Partial<ResourceRef> = {},
): ResourceRef {
  return {
    type: 'billingPeriod',
    tenantId: OPERATOR_TENANT,
    tenantType: 'operator',
    customerTenantId: CUSTOMER_TENANT,
    status,
    disclosedToTenantIds: [CUSTOMER_TENANT],
    ...options,
  }
}

function facts(overrides: Partial<BillingPeriodFacts> = {}): BillingPeriodFacts {
  return {
    datesComplete: true,
    rangeOrdered: true,
    noOverlappingOpenPeriod: true,
    undecidedTimesheets: 0,
    unfinishedDocuments: 0,
    evaluationDate: TODAY,
    ...overrides,
  }
}

describe('Öffnen (— → open, SPEC 4.5.1)', () => {
  it('öffnet die Periode mit Zeitraum und Schlusstermin', () => {
    const outcome = attemptTransition(BILLING_PERIOD_MODEL, 'open', {
      currentStatus: null,
      subject: subject('operatorAdmin'),
      resource: periodResource('open'),
      facts: facts(),
    })
    expect(outcome.applied).toBe(true)
    if (outcome.applied) expect(outcome.to).toBe('open')
  })

  it('löst der Disponent sie aus — [33] nennt „Öffnen und Schließen" ausdrücklich', () => {
    // Das ist der Grund, warum der Übergang `operation: 'transition'` trägt:
    // die Matrixzeile gibt `MD` **kein** `A`, aber ein `S[33]`. Mit `create`
    // wäre er hier verweigert, obwohl 4.5.1 ihn nennt.
    const outcome = attemptTransition(BILLING_PERIOD_MODEL, 'open', {
      currentStatus: null,
      subject: subject('operatorCoordinator'),
      resource: periodResource('open'),
      facts: facts(),
    })
    expect(outcome.applied).toBe(true)
  })

  it('verweigert sie dem Lieferanten — die Zeile gibt ihm nur `L[7]`', () => {
    const outcome = attemptTransition(BILLING_PERIOD_MODEL, 'open', {
      currentStatus: null,
      subject: subject('supplierCoordinator'),
      resource: periodResource('open'),
      facts: facts(),
    })
    expect(outcome.applied).toBe(false)
    if (!outcome.applied) expect(outcome.rejection.kind).toBe('roleNotTriggering')
  })

  it('verweigert sie der Kundenseite — die Zeile gibt `KE` nur `L[2]`', () => {
    const outcome = attemptTransition(BILLING_PERIOD_MODEL, 'open', {
      currentStatus: null,
      subject: subject('procurementController'),
      resource: periodResource('open'),
      facts: facts(),
    })
    expect(outcome.applied).toBe(false)
  })

  it('verweigert sie ohne vollständige Termine (3.9)', () => {
    const outcome = attemptTransition(BILLING_PERIOD_MODEL, 'open', {
      currentStatus: null,
      subject: subject('operatorAdmin'),
      resource: periodResource('open'),
      facts: facts({ datesComplete: false }),
    })
    expect(outcome.applied).toBe(false)
    if (!outcome.applied) expect(outcome.rejection.kind).toBe('precondition')
  })

  it('verweigert ein Ende vor dem Beginn', () => {
    const outcome = attemptTransition(BILLING_PERIOD_MODEL, 'open', {
      currentStatus: null,
      subject: subject('operatorAdmin'),
      resource: periodResource('open'),
      facts: facts({ rangeOrdered: false }),
    })
    expect(outcome.applied).toBe(false)
  })

  it('verweigert eine überlappende offene Periode desselben Kunden (4.5.1)', () => {
    // Zwei offene Perioden über denselben Tag machen nicht entscheidbar, in
    // welche ein Zettel gehört (3.13).
    const outcome = attemptTransition(BILLING_PERIOD_MODEL, 'open', {
      currentStatus: null,
      subject: subject('operatorAdmin'),
      resource: periodResource('open'),
      facts: facts({ noOverlappingOpenPeriod: false }),
    })
    expect(outcome.applied).toBe(false)
  })

  it('ist die Anlage und nicht auf eine bestehende Periode anwendbar', () => {
    const outcome = attemptTransition(BILLING_PERIOD_MODEL, 'open', {
      currentStatus: 'open',
      subject: subject('operatorAdmin'),
      resource: periodResource('open'),
      facts: facts(),
    })
    expect(outcome.applied).toBe(false)
    if (!outcome.applied) expect(outcome.rejection.kind).toBe('statusMismatch')
  })
})

describe('Schließen (open → closed, SPEC 4.5.1)', () => {
  it('schließt die Periode, wenn jeder Zettel entschieden und jeder Beleg abgegeben ist', () => {
    const outcome = attemptTransition(BILLING_PERIOD_MODEL, 'close', {
      currentStatus: 'open',
      subject: subject('operatorCoordinator'),
      resource: periodResource('open'),
      facts: facts(),
    })
    expect(outcome.applied).toBe(true)
    if (outcome.applied) expect(outcome.to).toBe('closed')
  })

  it('schließt sie auch durch den Betreiberadministrator (4.5.1 nennt `MD`, `MA`)', () => {
    const outcome = attemptTransition(BILLING_PERIOD_MODEL, 'close', {
      currentStatus: 'open',
      subject: subject('operatorAdmin'),
      resource: periodResource('open'),
      facts: facts(),
    })
    expect(outcome.applied).toBe(true)
  })

  it('verweigert den Schluss bei einem nicht entschiedenen Zettel — offene Frage 24', () => {
    // Die strenge Folge aus 2.4 Regel 1: keine Genehmigungsfiktion zum
    // Periodenschluss. Der Preis steht in 4.5.1 — ein hängender Zettel hält
    // die ganze Periode auf.
    const outcome = attemptTransition(BILLING_PERIOD_MODEL, 'close', {
      currentStatus: 'open',
      subject: subject('operatorCoordinator'),
      resource: periodResource('open'),
      facts: facts({ undecidedTimesheets: 1 }),
    })
    expect(outcome.applied).toBe(false)
    if (!outcome.applied) {
      expect(outcome.rejection.kind).toBe('precondition')
      expect(outcome.rejection.reason).toContain('offene Frage 24')
    }
  })

  it('verweigert den Schluss bei einem nicht abgegebenen Beleg (4.5.2)', () => {
    const outcome = attemptTransition(BILLING_PERIOD_MODEL, 'close', {
      currentStatus: 'open',
      subject: subject('operatorCoordinator'),
      resource: periodResource('open'),
      facts: facts({ unfinishedDocuments: 1 }),
    })
    expect(outcome.applied).toBe(false)
  })

  it('verweigert ihn der Kundenseite und dem Lieferanten', () => {
    for (const rolle of ['procurementController', 'supplierCoordinator', 'demandOwner'] as const) {
      const outcome = attemptTransition(BILLING_PERIOD_MODEL, 'close', {
        currentStatus: 'open',
        subject: subject(rolle),
        resource: periodResource('open'),
        facts: facts(),
      })
      expect(outcome.applied).toBe(false)
    }
  })
})

describe('Ausgeschlossene Übergänge (SPEC 4.5.1)', () => {
  it('`closed` ist ein Endzustand — kein Wiederöffnen', () => {
    expect(isTerminal(BILLING_PERIOD_MODEL, 'closed')).toBe(true)
    expect(transitionsFrom(BILLING_PERIOD_MODEL, 'closed')).toEqual([])
  })

  it('aus `closed` führt auch das Schließen nicht zurück', () => {
    const outcome = attemptTransition(BILLING_PERIOD_MODEL, 'close', {
      currentStatus: 'closed',
      subject: subject('operatorAdmin'),
      resource: periodResource('closed'),
      facts: facts(),
    })
    expect(outcome.applied).toBe(false)
    if (!outcome.applied) {
      expect(outcome.rejection.kind).toBe('statusMismatch')
      expect(outcome.rejection.specReference).toContain('4.0, Regel 9')
    }
  })

  it('kennt keinen Übergang, den 4.5.1 nicht nennt', () => {
    // Die Zusicherung von 4.0, Regel 1 als Eigenschaft des Modells: genau
    // zwei Übergänge, und das Wiederöffnen ist keiner davon.
    expect(Object.keys(BILLING_PERIOD_MODEL.transitions).sort()).toEqual(['close', 'open'])
  })

  it('kennt keinen Schluss durch Fristablauf — er braucht eine auslösende Rolle', () => {
    // Ohne Subjekt ist `close` kein Systemübergang, sondern eine Handlung ohne
    // Handelnden (4.0, Regel 4 und 10).
    const outcome = attemptTransition(BILLING_PERIOD_MODEL, 'close', {
      currentStatus: 'open',
      resource: periodResource('open'),
      facts: facts(),
    })
    expect(outcome.applied).toBe(false)
    if (!outcome.applied) expect(outcome.rejection.kind).toBe('roleNotTriggering')
  })
})
