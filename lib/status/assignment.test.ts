/**
 * Tests des Statusmodells des Einsatzes gegen SPEC 4.3.1.
 *
 * Je Übergang: ein erlaubter Fall, ein abgelehnter aus dem falschen Zustand,
 * einer, der an der Rolle scheitert, und die Mandantengrenze aus 2.3. Dazu die
 * drei Festlegungen, die 4.3.1 ausdrücklich trifft: „verlängert" ist kein
 * Zustand, der Antrag auf Beendigung ist kein Zustand, und die Rücknahme vor
 * Beginn ist `terminatedEarly`.
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
import { ASSIGNMENT_MODEL, type AssignmentFacts } from './assignment'
import { attemptTransition, isTerminal, transitionsFrom } from './machine'

const TODAY = DAY('2026-11-04')

/** Der Einsatz gehört dem Betreiber und ist beiden Seiten zugänglich ([2], [7]). */
function assignmentRef(options: Partial<ResourceRef> = {}): ResourceRef {
  return {
    type: 'assignment',
    tenantId: OPERATOR_TENANT,
    tenantType: 'operator',
    customerTenantId: CUSTOMER_TENANT,
    supplierTenantId: SUPPLIER_TENANT,
    siteId: 'site-1',
    costCenterId: 'cc-1',
    status: 'planned',
    disclosedToTenantIds: [CUSTOMER_TENANT, SUPPLIER_TENANT],
    ...options,
  }
}

function facts(overrides: Partial<AssignmentFacts> = {}): AssignmentFacts {
  return {
    submissionStatus: 'accepted',
    supplierStatus: 'active',
    activityDescription: 'Vormontage von Baugruppen an Station 7, Halle 2',
    agreedRateCardItemPresent: true,
    customerRateCardItemPresent: true,
    workerIdentityConfirmed: true,
    plannedStartDate: DAY('2026-12-01'),
    plannedEndDate: DAY('2027-05-31'),
    actualStartDate: null,
    actualEndDate: null,
    hasRunningInterruption: false,
    interruptionFrom: null,
    interruptionReason: null,
    interruptionTo: null,
    terminationReason: null,
    terminationRequestedById: null,
    terminationRequestedBySide: null,
    terminationApprovedById: null,
    hasAcceptedValidPermit: true,
    mandatoryDocumentsPresent: true,
    noIndustrialActionAtSite: true,
    maxDurationExceeded: false,
    concretizationComplete: true,
    hasPreviousEmploymentDeclaration: true,
    employmentRelationshipOnFirstDay: true,
    equalPayDueFromFirstDay: false,
    comparableWagePresent: true,
    evaluationDate: TODAY,
    ...overrides,
  }
}

describe('4.3.1 — zulässige Übergänge', () => {
  it('MD legt aus dem zugesagten Profilvorschlag an (— → planned)', () => {
    const outcome = attemptTransition(ASSIGNMENT_MODEL, 'create', {
      currentStatus: null,
      subject: subject('operatorCoordinator'),
      resource: assignmentRef(),
      facts: facts(),
    })
    expect(outcome).toMatchObject({ applied: true, to: 'planned' })
  })

  it('MD legt auch ohne vorangegangene Anfrage an (3.7)', () => {
    const outcome = attemptTransition(ASSIGNMENT_MODEL, 'create', {
      currentStatus: null,
      subject: subject('operatorCoordinator'),
      resource: assignmentRef(),
      facts: facts({ submissionStatus: null }),
    })
    expect(outcome).toMatchObject({ applied: true, to: 'planned' })
  })

  it('MD bestätigt den Beginn (planned → active)', () => {
    const outcome = attemptTransition(ASSIGNMENT_MODEL, 'start', {
      currentStatus: 'planned',
      subject: subject('operatorCoordinator'),
      resource: assignmentRef(),
      facts: facts({ actualStartDate: DAY('2026-12-01') }),
    })
    expect(outcome).toMatchObject({ applied: true, to: 'active' })
  })

  it('MD unterbricht (active → interrupted)', () => {
    const outcome = attemptTransition(ASSIGNMENT_MODEL, 'interrupt', {
      currentStatus: 'active',
      subject: subject('operatorCoordinator'),
      resource: assignmentRef({ status: 'active' }),
      facts: facts({
        actualStartDate: DAY('2026-12-01'),
        interruptionFrom: DAY('2027-01-02'),
        interruptionReason: 'Betriebsruhe beim Entleiher',
      }),
    })
    expect(outcome).toMatchObject({ applied: true, to: 'interrupted' })
  })

  it('MD setzt fort (interrupted → active)', () => {
    const outcome = attemptTransition(ASSIGNMENT_MODEL, 'resume', {
      currentStatus: 'interrupted',
      subject: subject('operatorCoordinator'),
      resource: assignmentRef({ status: 'interrupted' }),
      facts: facts({ interruptionTo: DAY('2027-01-20') }),
    })
    expect(outcome).toMatchObject({ applied: true, to: 'active' })
  })

  it('MD beendet regulär (active → completed)', () => {
    const outcome = attemptTransition(ASSIGNMENT_MODEL, 'complete', {
      currentStatus: 'active',
      subject: subject('operatorCoordinator'),
      resource: assignmentRef({ status: 'active' }),
      facts: facts({
        plannedEndDate: DAY('2026-10-31'),
        actualEndDate: DAY('2026-10-31'),
      }),
    })
    expect(outcome).toMatchObject({ applied: true, to: 'completed' })
  })

  it('MD beendet vorzeitig auf Antrag des Lieferanten — ohne Genehmigung der Kundenseite', () => {
    const outcome = attemptTransition(ASSIGNMENT_MODEL, 'terminateEarly', {
      currentStatus: 'active',
      subject: subject('operatorCoordinator'),
      resource: assignmentRef({ status: 'active' }),
      facts: facts({
        terminationReason: 'Arbeitsverhältnis beim Verleiher endet',
        terminationRequestedById: 'user-supplierCoordinator',
        terminationRequestedBySide: 'supplier',
        actualEndDate: DAY('2026-11-30'),
      }),
    })
    expect(outcome).toMatchObject({ applied: true, to: 'terminatedEarly' })
  })

  it('die Rücknahme vor Beginn ist `terminatedEarly` (planned → terminatedEarly)', () => {
    const outcome = attemptTransition(ASSIGNMENT_MODEL, 'terminateEarly', {
      currentStatus: 'planned',
      subject: subject('operatorCoordinator'),
      resource: assignmentRef(),
      facts: facts({
        terminationReason: 'Bedarf vor Beginn entfallen',
        terminationRequestedById: 'user-demandOwner',
        terminationRequestedBySide: 'customer',
        terminationApprovedById: 'user-approver',
        actualEndDate: DAY('2026-11-30'),
      }),
    })
    expect(outcome).toMatchObject({ applied: true, to: 'terminatedEarly' })
  })
})

describe('4.3.1 — ausgeschlossene Übergänge', () => {
  it('kein planned → completed: ein Einsatz ohne Arbeitsleistung wird `terminatedEarly`', () => {
    const outcome = attemptTransition(ASSIGNMENT_MODEL, 'complete', {
      currentStatus: 'planned',
      subject: subject('operatorCoordinator'),
      resource: assignmentRef(),
      facts: facts({ plannedEndDate: DAY('2026-10-31'), actualEndDate: DAY('2026-10-31') }),
    })
    expect(outcome).toMatchObject({ applied: false, rejection: { kind: 'statusMismatch' } })
  })

  it('kein completed → active: eine erneute Überlassung ist ein **neuer** Einsatz', () => {
    const outcome = attemptTransition(ASSIGNMENT_MODEL, 'start', {
      currentStatus: 'completed',
      subject: subject('operatorCoordinator'),
      resource: assignmentRef({ status: 'completed' }),
      facts: facts({ actualStartDate: DAY('2026-12-01') }),
    })
    expect(outcome).toMatchObject({
      applied: false,
      rejection: { kind: 'statusMismatch', specReference: 'SPEC 4.3.1; 4.0, Regel 9' },
    })
  })

  it('kein interrupted → completed ohne Wiederaufnahme', () => {
    const outcome = attemptTransition(ASSIGNMENT_MODEL, 'complete', {
      currentStatus: 'interrupted',
      subject: subject('operatorCoordinator'),
      resource: assignmentRef({ status: 'interrupted' }),
      facts: facts({ plannedEndDate: DAY('2026-10-31'), actualEndDate: DAY('2026-10-31') }),
    })
    expect(outcome).toMatchObject({ applied: false, rejection: { kind: 'statusMismatch' } })
  })

  it('„verlängert" ist kein Zustand des Einsatzes (4.3.1)', () => {
    expect(ASSIGNMENT_MODEL.states).not.toContain('extended')
    // Es gibt auch keinen Übergang mit diesem Ziel: die Verlängerung hat ihren
    // eigenen Lebenszyklus (4.3.2).
    for (const transition of Object.values(ASSIGNMENT_MODEL.transitions)) {
      expect(ASSIGNMENT_MODEL.states).toContain(transition.to)
    }
  })

  it('kein Zustand `blocked`: eine AÜG-Sperre verhindert den Übergang (4.0, Regel 5)', () => {
    expect(ASSIGNMENT_MODEL.states).not.toContain('blocked')
  })

  it('kein zeitgesteuerter Übergang: jeder Übergang nennt eine auslösende Rolle', () => {
    for (const transition of Object.values(ASSIGNMENT_MODEL.transitions)) {
      expect(transition.roles.length).toBeGreaterThan(0)
    }
  })

  it('ein in 4.3.1 nicht genannter Übergang hat keinen Namen', () => {
    // @ts-expect-error — „extend" ist kein Übergang des Einsatzes: eine
    // wirksame Verlängerung verschiebt `plannedEndDate` (4.3.2).
    const outcome = attemptTransition(ASSIGNMENT_MODEL, 'extend', {
      currentStatus: 'active',
      subject: subject('operatorCoordinator'),
      resource: assignmentRef({ status: 'active' }),
      facts: facts(),
    })
    expect(outcome).toMatchObject({ applied: false, rejection: { kind: 'unknownTransition' } })
  })
})

describe('4.3.1 — Übergänge, die an der Rolle scheitern', () => {
  it('der Kunde beendet nicht selbst: er beantragt ([25]), wirksam setzt MD', () => {
    const outcome = attemptTransition(ASSIGNMENT_MODEL, 'terminateEarly', {
      currentStatus: 'active',
      subject: subject('demandOwner'),
      resource: assignmentRef({ status: 'active' }),
      facts: facts({
        terminationReason: 'Bedarf entfallen',
        terminationRequestedById: 'user-demandOwner',
        terminationRequestedBySide: 'customer',
        terminationApprovedById: 'user-approver',
        actualEndDate: DAY('2026-11-30'),
      }),
    })
    expect(outcome).toMatchObject({ applied: false, rejection: { kind: 'roleNotTriggering' } })
  })

  it('der Lieferant bestätigt nicht den Beginn (planned → active ist MD)', () => {
    const outcome = attemptTransition(ASSIGNMENT_MODEL, 'start', {
      currentStatus: 'planned',
      subject: subject('supplierCoordinator'),
      resource: assignmentRef(),
      facts: facts({ actualStartDate: DAY('2026-12-01') }),
    })
    expect(outcome).toMatchObject({ applied: false, rejection: { kind: 'roleNotTriggering' } })
  })

  it('der Betreiberadministrator legt an, bestätigt aber keinen Beginn (4.3.1 nennt dort nur MD)', () => {
    const created = attemptTransition(ASSIGNMENT_MODEL, 'create', {
      currentStatus: null,
      subject: subject('operatorAdmin'),
      resource: assignmentRef(),
      facts: facts(),
    })
    expect(created).toMatchObject({ applied: true })

    const started = attemptTransition(ASSIGNMENT_MODEL, 'start', {
      currentStatus: 'planned',
      subject: subject('operatorAdmin'),
      resource: assignmentRef(),
      facts: facts({ actualStartDate: DAY('2026-12-01') }),
    })
    expect(started).toMatchObject({ applied: false, rejection: { kind: 'roleNotTriggering' } })
  })
})

describe('2.3 — die Mandantengrenze geht dem Rollenrecht vor', () => {
  it('ein MSP-Benutzer ohne Betreuungszuordnung für diesen Kunden legt nicht an', () => {
    const outcome = attemptTransition(ASSIGNMENT_MODEL, 'create', {
      currentStatus: null,
      subject: subject('operatorCoordinator', {
        accountAssignmentCustomerTenantIds: [OTHER_CUSTOMER_TENANT],
      }),
      resource: assignmentRef(),
      facts: facts(),
    })
    expect(outcome).toMatchObject({
      applied: false,
      rejection: {
        kind: 'notPermitted',
        specReference: 'SPEC 2.3, Betreiber: Querschnittssicht, Bedingung 2',
      },
    })
  })

  it('ein fremder Lieferant hat an diesem Einsatz keinen Zugriff', () => {
    const outcome = attemptTransition(ASSIGNMENT_MODEL, 'interrupt', {
      currentStatus: 'active',
      subject: subject('supplierCoordinator', { tenantId: OTHER_SUPPLIER_TENANT }),
      resource: assignmentRef({ status: 'active' }),
      facts: facts({
        interruptionFrom: DAY('2027-01-02'),
        interruptionReason: 'Betriebsruhe',
      }),
    })
    expect(outcome).toMatchObject({ applied: false, rejection: { kind: 'roleNotTriggering' } })
  })
})

describe('4.3.1 — Vorbedingungen', () => {
  it('kein Einsatz ohne bestätigte Personenidentität (3.7, Pflicht ab `planned`)', () => {
    const outcome = attemptTransition(ASSIGNMENT_MODEL, 'create', {
      currentStatus: null,
      subject: subject('operatorCoordinator'),
      resource: assignmentRef(),
      facts: facts({ workerIdentityConfirmed: false }),
    })
    expect(outcome).toMatchObject({ applied: false, rejection: { kind: 'precondition' } })
    if (!outcome.applied) {
      expect(outcome.rejection.reason).toContain('Personenidentität')
    }
  })

  it('kein Einsatz, solange der Profilvorschlag nicht zugesagt ist (4.2.3)', () => {
    const outcome = attemptTransition(ASSIGNMENT_MODEL, 'create', {
      currentStatus: null,
      subject: subject('operatorCoordinator'),
      resource: assignmentRef(),
      facts: facts({ submissionStatus: 'releasedToCustomer' }),
    })
    expect(outcome).toMatchObject({ applied: false, rejection: { kind: 'precondition' } })
  })

  it('kein Einsatz bei gesperrtem Lieferanten (4.6)', () => {
    const outcome = attemptTransition(ASSIGNMENT_MODEL, 'create', {
      currentStatus: null,
      subject: subject('operatorCoordinator'),
      resource: assignmentRef(),
      facts: facts({ supplierStatus: 'blocked' }),
    })
    expect(outcome).toMatchObject({ applied: false, rejection: { kind: 'precondition' } })
  })

  it('kein Beginn ohne `actualStartDate` — der Beginn wird bestätigt, nicht unterstellt', () => {
    const outcome = attemptTransition(ASSIGNMENT_MODEL, 'start', {
      currentStatus: 'planned',
      subject: subject('operatorCoordinator'),
      resource: assignmentRef(),
      facts: facts({ actualStartDate: null }),
    })
    expect(outcome).toMatchObject({ applied: false, rejection: { kind: 'precondition' } })
  })

  it('kein Beginn ohne Vergleichsentgelt, wenn Equal Pay ab dem ersten Tag geschuldet ist (5.2)', () => {
    const outcome = attemptTransition(ASSIGNMENT_MODEL, 'start', {
      currentStatus: 'planned',
      subject: subject('operatorCoordinator'),
      resource: assignmentRef(),
      facts: facts({
        actualStartDate: DAY('2026-12-01'),
        equalPayDueFromFirstDay: true,
        comparableWagePresent: false,
      }),
    })
    expect(outcome).toMatchObject({ applied: false, rejection: { kind: 'precondition' } })
  })

  it('keine Fortsetzung, wenn das Fristende am Wiederaufnahmetag erreicht ist (5.1, Q26)', () => {
    const outcome = attemptTransition(ASSIGNMENT_MODEL, 'resume', {
      currentStatus: 'interrupted',
      subject: subject('operatorCoordinator'),
      resource: assignmentRef({ status: 'interrupted' }),
      facts: facts({ interruptionTo: DAY('2027-01-20'), maxDurationExceeded: true }),
    })
    expect(outcome).toMatchObject({ applied: false, rejection: { kind: 'precondition' } })
  })

  it('keine Unterbrechung ohne Beginn und Grund (3.7)', () => {
    const outcome = attemptTransition(ASSIGNMENT_MODEL, 'interrupt', {
      currentStatus: 'active',
      subject: subject('operatorCoordinator'),
      resource: assignmentRef({ status: 'active' }),
      facts: facts({ interruptionFrom: DAY('2027-01-02'), interruptionReason: '  ' }),
    })
    expect(outcome).toMatchObject({ applied: false, rejection: { kind: 'precondition' } })
  })

  it('keine vorzeitige Beendigung auf Kundenantrag ohne Genehmigung des Genehmigers ([26])', () => {
    const outcome = attemptTransition(ASSIGNMENT_MODEL, 'terminateEarly', {
      currentStatus: 'active',
      subject: subject('operatorCoordinator'),
      resource: assignmentRef({ status: 'active' }),
      facts: facts({
        terminationReason: 'Bedarf entfallen',
        terminationRequestedById: 'user-demandOwner',
        terminationRequestedBySide: 'customer',
        terminationApprovedById: null,
        actualEndDate: DAY('2026-11-30'),
      }),
    })
    expect(outcome).toMatchObject({ applied: false, rejection: { kind: 'precondition' } })
  })

  it('keine vorzeitige Beendigung ohne Begründung und Antragsteller (3.7)', () => {
    const outcome = attemptTransition(ASSIGNMENT_MODEL, 'terminateEarly', {
      currentStatus: 'active',
      subject: subject('operatorCoordinator'),
      resource: assignmentRef({ status: 'active' }),
      facts: facts({ actualEndDate: DAY('2026-11-30') }),
    })
    expect(outcome).toMatchObject({ applied: false, rejection: { kind: 'precondition' } })
  })

  it('kein reguläres Ende vor dem geplanten Ende', () => {
    const outcome = attemptTransition(ASSIGNMENT_MODEL, 'complete', {
      currentStatus: 'active',
      subject: subject('operatorCoordinator'),
      resource: assignmentRef({ status: 'active' }),
      facts: facts({ plannedEndDate: DAY('2027-05-31'), actualEndDate: DAY('2027-05-31') }),
    })
    expect(outcome).toMatchObject({ applied: false, rejection: { kind: 'precondition' } })
  })
})

describe('4.3.1 — Form des Modells', () => {
  it('die beiden Endzustände tragen keinen Ausgang (4.0, Regel 9)', () => {
    for (const state of ['completed', 'terminatedEarly'] as const) {
      expect(isTerminal(ASSIGNMENT_MODEL, state)).toBe(true)
      expect(transitionsFrom(ASSIGNMENT_MODEL, state)).toEqual([])
    }
  })
})
