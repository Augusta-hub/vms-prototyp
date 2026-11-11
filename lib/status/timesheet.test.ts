/**
 * Tests des Stundenzettelstatus gegen SPEC 4.4.
 *
 * Geprüft wird je Übergang: ein erlaubter Fall, die Spalte „Von", die
 * auslösende Rolle und jede Vorbedingung einzeln. Dazu die Fälle, die 4.4
 * ausdrücklich **ausschließt** — Genehmigung durch die erfassende Seite,
 * `recorded` → `approved`, ein Weg aus `corrected` — und die drei Grenzen, die
 * aus der Entscheidung zu *Frage 5* folgen: mindestens eine Kundenstufe, nur
 * die zugewiesene Rolle entscheidet ihre Stufe, und eine Ablehnung der
 * Kundenseite ist nicht durch eine Betreiberstufe aufhebbar.
 *
 * Diese Tests prüfen Anwendungscode und sind **nicht** die AÜG-Regeln; die
 * stehen als Gherkin in tests/aueg/ und werden hier nicht berührt.
 */
import { describe, expect, it } from 'vitest'
import type { ResourceRef } from '../authz/check'
import type { RoleCode } from '../authz/roles'
import {
  CUSTOMER_TENANT,
  DAY,
  grant,
  OPERATOR_TENANT,
  subject,
  SUPPLIER_TENANT,
} from '../testing/fixtures'
import {
  attemptTransition,
  isTerminal,
  transitionsFrom,
  type TransitionDefinition,
} from './machine'
import {
  TIMESHEET_MODEL,
  type TimesheetFacts,
  type TimesheetState,
  type TimesheetTransitionName,
} from './timesheet'

type TimesheetTransition = TransitionDefinition<TimesheetState, TimesheetFacts>

const TODAY = DAY('2026-11-10')

/** Wer erfasst hat — nach 2.4 Regel 5 von jeder Stufe ausgeschlossen. */
const ERFASSER = 'user-supplierCoordinator'
/** Wer einreicht — ebenfalls ausgeschlossen. */
const EINREICHER = 'user-supplierCoordinator'

/**
 * Der Zettel gehört dem **Betreibermandanten** (3.8): er verbindet beide
 * Seiten und ist Grundlage beider Belegseiten.
 *
 * Deshalb trägt er `disclosedToTenantIds`: 2.2 gibt dem Lieferanten `A[27]
 * L[7] Ä[28] S[20]` und der Kundenseite `L[2] S[29]` an einem Vorgang, der
 * **nicht** ihr Mandant ist. Das ist die ausdrückliche Ausnahme von der
 * Mandantengrenze aus 2.3 — dieselbe Lage wie bei Einladung und Angebot (3.5).
 */
function timesheetResource(
  status: TimesheetState,
  options: Partial<ResourceRef> = {},
): ResourceRef {
  return {
    type: 'timesheet',
    tenantId: OPERATOR_TENANT,
    tenantType: 'operator',
    customerTenantId: CUSTOMER_TENANT,
    supplierTenantId: SUPPLIER_TENANT,
    disclosedToTenantIds: [CUSTOMER_TENANT, SUPPLIER_TENANT],
    status,
    createdById: ERFASSER,
    submittedById: EINREICHER,
    ...options,
  }
}

function facts(overrides: Partial<TimesheetFacts> = {}): TimesheetFacts {
  return {
    assignmentStatus: 'active',
    billingPeriodStatus: 'open',
    timesheetExistsForPeriod: false,
    entryCount: 3,
    entriesWithinPeriod: true,
    entriesOutsideInterruption: true,
    entriesValid: true,
    approvalCount: 2,
    openStageRoleCode: 'demandOwner',
    actingRoleCodes: ['demandOwner'],
    remainingOpenStages: 1,
    customerStagePresent: true,
    anyStageRejected: false,
    actingUserId: 'user-demandOwner',
    recordedById: ERFASSER,
    submittedById: EINREICHER,
    rejectionReason: null,
    comparableWageUsable: true,
    correctionApproved: false,
    evaluationDate: TODAY,
    ...overrides,
  }
}

/** Ein Versuch durch die Rolle, der die offene Stufe zugewiesen ist. */
function stufenversuch(
  transition: TimesheetTransitionName,
  rolle: RoleCode,
  teile: Partial<TimesheetFacts> = {},
  ref: Partial<ResourceRef> = {},
) {
  return attemptTransition(TIMESHEET_MODEL, transition, {
    currentStatus: 'inApproval',
    subject: subject(rolle, { grants: [grant(rolle)] }),
    resource: timesheetResource('inApproval', { openApprovalRoleCode: rolle, ...ref }),
    facts: facts({
      openStageRoleCode: rolle,
      actingRoleCodes: [rolle],
      actingUserId: `user-${rolle}`,
      ...teile,
    }),
  })
}

describe('Zustände und Übergangsmenge (SPEC 4.4)', () => {
  it('führt genau die sechs Zustände aus 4.4', () => {
    expect(TIMESHEET_MODEL.states).toEqual([
      'recorded',
      'submitted',
      'inApproval',
      'approved',
      'rejected',
      'corrected',
    ])
  })

  it('kennt keinen Übergang aus `corrected` — der ersetzte Zettel bleibt stehen', () => {
    expect(transitionsFrom(TIMESHEET_MODEL, 'corrected')).toEqual([])
    expect(isTerminal(TIMESHEET_MODEL, 'corrected')).toBe(true)
  })

  it('`approved` ist ein Ruhezustand, kein Endzustand: `markCorrected` führt hinaus', () => {
    expect(isTerminal(TIMESHEET_MODEL, 'approved')).toBe(false)
    expect(transitionsFrom(TIMESHEET_MODEL, 'approved')).toEqual(['markCorrected'])
  })

  it('kennt keinen Übergang `recorded` → `approved` — Einreichen und Genehmigen sind getrennt', () => {
    expect(transitionsFrom(TIMESHEET_MODEL, 'recorded')).toEqual(['submit'])
  })

  it('kennt keinen Weg von `approved` zurück nach `recorded` oder `rejected`', () => {
    const zurueck = attemptTransition(TIMESHEET_MODEL, 'rework', {
      currentStatus: 'approved',
      subject: subject('operatorCoordinator'),
      resource: timesheetResource('approved'),
      facts: facts(),
    })
    expect(zurueck).toMatchObject({ applied: false, rejection: { kind: 'statusMismatch' } })
  })
})

describe('Erfassen (— → recorded, SPEC 4.4)', () => {
  const anlage = (teile: Partial<TimesheetFacts> = {}, rolle: RoleCode = 'supplierCoordinator') =>
    attemptTransition(TIMESHEET_MODEL, 'create', {
      currentStatus: null,
      subject: subject(rolle, { grants: [grant(rolle)] }),
      resource: timesheetResource('recorded'),
      facts: facts(teile),
    })

  it('nimmt den Zettel an, wenn Einsatz und Periode ihn tragen', () => {
    expect(anlage().applied).toBe(true)
  })

  it('wird vom Betreiber im Namen des Leiharbeitnehmers angelegt ([27])', () => {
    expect(anlage({}, 'operatorCoordinator').applied).toBe(true)
  })

  it('verweigert die Anlage in einer geschlossenen Periode (3.9, 4.5)', () => {
    const outcome = anlage({ billingPeriodStatus: 'closed' })
    expect(outcome).toMatchObject({ applied: false, rejection: { kind: 'precondition' } })
    if (!outcome.applied) expect(outcome.rejection.reason).toContain('Abrechnungsperiode')
  })

  it('verweigert sie, solange der Einsatz nur `planned` ist — da gibt es keine Zeiten', () => {
    const outcome = anlage({ assignmentStatus: 'planned' })
    expect(outcome).toMatchObject({ applied: false, rejection: { kind: 'precondition' } })
  })

  it('nimmt sie nach Ende des Einsatzes an: die letzte Periode wird noch erfasst', () => {
    expect(anlage({ assignmentStatus: 'completed' }).applied).toBe(true)
    expect(anlage({ assignmentStatus: 'terminatedEarly' }).applied).toBe(true)
  })

  it('verweigert den zweiten Zettel zu Einsatz und Periode (3.13)', () => {
    const outcome = anlage({ timesheetExistsForPeriod: true })
    expect(outcome).toMatchObject({ applied: false, rejection: { kind: 'precondition' } })
    if (!outcome.applied) expect(outcome.rejection.reason).toContain('genau einer')
  })

  it('löst keine Kundenrolle aus — erfasst wird auf der Arbeitnehmerseite', () => {
    const outcome = anlage({}, 'demandOwner')
    expect(outcome).toMatchObject({ applied: false, rejection: { kind: 'roleNotTriggering' } })
  })
})

describe('Einreichen (recorded → submitted, SPEC 4.4)', () => {
  const einreichen = (teile: Partial<TimesheetFacts> = {}) =>
    attemptTransition(TIMESHEET_MODEL, 'submit', {
      currentStatus: 'recorded',
      subject: subject('supplierCoordinator', { grants: [grant('supplierCoordinator')] }),
      resource: timesheetResource('recorded'),
      facts: facts(teile),
    })

  it('reicht einen Zettel mit Positionen ein', () => {
    expect(einreichen().applied).toBe(true)
  })

  it('verweigert einen leeren Zettel', () => {
    const outcome = einreichen({ entryCount: 0 })
    expect(outcome).toMatchObject({ applied: false, rejection: { kind: 'precondition' } })
    if (!outcome.applied) expect(outcome.rejection.reason).toContain('Mindestens eine')
  })

  it('verweigert Positionen außerhalb des Zettelzeitraums', () => {
    const outcome = einreichen({ entriesWithinPeriod: false })
    expect(outcome).toMatchObject({ applied: false, rejection: { kind: 'precondition' } })
    if (!outcome.applied) expect(outcome.rejection.reason).toContain('Zeitraum des Zettels')
  })

  it('verweigert Zeiten in einer Unterbrechung des Einsatzes (4.3)', () => {
    const outcome = einreichen({ entriesOutsideInterruption: false })
    expect(outcome).toMatchObject({ applied: false, rejection: { kind: 'precondition' } })
    if (!outcome.applied) expect(outcome.rejection.reason).toContain('Unterbrechung')
  })

  it('verweigert eine Position, die die Invarianten aus 3.8 verletzt', () => {
    const outcome = einreichen({ entriesValid: false })
    expect(outcome).toMatchObject({ applied: false, rejection: { kind: 'precondition' } })
    if (!outcome.applied) expect(outcome.rejection.reason).toContain('Invarianten')
  })
})

describe('Freigabeschritte eröffnen (submitted → inApproval, SPEC 4.4)', () => {
  const eroeffnen = (teile: Partial<TimesheetFacts> = {}) =>
    attemptTransition(TIMESHEET_MODEL, 'openApproval', {
      currentStatus: 'submitted',
      resource: timesheetResource('submitted'),
      facts: facts(teile),
    })

  it('ist ein Systemübergang: ohne Subjekt angefordert (4.0, Regel 10)', () => {
    expect(eroeffnen().applied).toBe(true)
  })

  it('lässt sich nicht von einem Benutzer auslösen', () => {
    const outcome = attemptTransition(TIMESHEET_MODEL, 'openApproval', {
      currentStatus: 'submitted',
      subject: subject('operatorAdmin'),
      resource: timesheetResource('submitted'),
      facts: facts(),
    })
    expect(outcome).toMatchObject({ applied: false, rejection: { kind: 'systemTransition' } })
  })

  it('verweigert die Eröffnung ohne Freigabeschritt', () => {
    const outcome = eroeffnen({ approvalCount: 0 })
    expect(outcome).toMatchObject({ applied: false, rejection: { kind: 'precondition' } })
  })

  it('verweigert eine Stufenfolge **ohne** Kundenstufe (2.1, 2.4 Regel 3)', () => {
    const outcome = eroeffnen({ customerStagePresent: false })
    expect(outcome).toMatchObject({ applied: false, rejection: { kind: 'precondition' } })
    if (!outcome.applied) expect(outcome.rejection.reason).toContain('Kundenstufe')
  })
})

describe('Stufe genehmigen (inApproval → inApproval, SPEC 4.4)', () => {
  it('genehmigt eine Stufe, solange eine weitere offen ist — ohne Statuswechsel', () => {
    const outcome = stufenversuch('approveStage', 'demandOwner')
    expect(outcome).toMatchObject({ applied: true, from: 'inApproval', to: 'inApproval' })
  })

  it('verweigert sie, wenn keine weitere Stufe offen ist — dann ist es `approve`', () => {
    const outcome = stufenversuch('approveStage', 'demandOwner', { remainingOpenStages: 0 })
    expect(outcome).toMatchObject({ applied: false, rejection: { kind: 'precondition' } })
  })

  it('wird auch von der Betreiberstufe entschieden (Entscheidung zu Frage 5)', () => {
    const outcome = stufenversuch('approveStage', 'operatorCoordinator')
    expect(outcome.applied).toBe(true)
  })

  it('verweigert die Entscheidung einer Stufe, die einer **anderen** Rolle zugewiesen ist', () => {
    const outcome = attemptTransition(TIMESHEET_MODEL, 'approveStage', {
      currentStatus: 'inApproval',
      subject: subject('approver', { grants: [grant('approver')] }),
      resource: timesheetResource('inApproval', { openApprovalRoleCode: 'demandOwner' }),
      facts: facts({
        openStageRoleCode: 'demandOwner',
        actingRoleCodes: ['approver'],
        actingUserId: 'user-approver',
      }),
    })
    // Die Fußnote [29] greift zuerst: sie prüft die Rolle der Entscheidung.
    expect(outcome).toMatchObject({ applied: false, rejection: { kind: 'notPermitted' } })
  })
})

describe('Genehmigen (inApproval → approved, SPEC 4.4)', () => {
  it('genehmigt, wenn dies die letzte offene Stufe ist', () => {
    const outcome = stufenversuch('approve', 'operatorCoordinator', { remainingOpenStages: 0 })
    expect(outcome).toMatchObject({ applied: true, to: 'approved' })
  })

  it('verweigert die Genehmigung, solange eine Stufe offen ist', () => {
    const outcome = stufenversuch('approve', 'operatorCoordinator', { remainingOpenStages: 1 })
    expect(outcome).toMatchObject({ applied: false, rejection: { kind: 'precondition' } })
    if (!outcome.applied) expect(outcome.rejection.reason).toContain('letzte offene Stufe')
  })

  it('sperrt bei fehlendem Vergleichsentgelt — P4, Q36 trägt dort eine Sperre', () => {
    const outcome = stufenversuch('approve', 'operatorCoordinator', {
      remainingOpenStages: 0,
      comparableWageUsable: false,
    })
    expect(outcome).toMatchObject({
      applied: false,
      rejection: { kind: 'precondition', ruleRef: 'P4' },
    })
  })

  it('verweigert sie, wenn die Stufenfolge keine Kundenstufe enthielt', () => {
    const outcome = stufenversuch('approve', 'operatorCoordinator', {
      remainingOpenStages: 0,
      customerStagePresent: false,
    })
    expect(outcome).toMatchObject({ applied: false, rejection: { kind: 'precondition' } })
    if (!outcome.applied) expect(outcome.rejection.reason).toContain('Kundenstufe')
  })

  it('verweigert sie, wenn eine Stufe schon abgelehnt hat — eine Ablehnung ist endgültig', () => {
    const outcome = stufenversuch('approve', 'operatorCoordinator', {
      remainingOpenStages: 0,
      anyStageRejected: true,
    })
    expect(outcome).toMatchObject({ applied: false, rejection: { kind: 'precondition' } })
    if (!outcome.applied) expect(outcome.rejection.reason).toContain('abgelehnt')
  })
})

describe('Vier-Augen-Prinzip an der Freigabe (2.4, Regel 5)', () => {
  it('verweigert die Stufe der Person, die den Zettel erfasst hat', () => {
    const outcome = attemptTransition(TIMESHEET_MODEL, 'approve', {
      currentStatus: 'inApproval',
      subject: subject('operatorCoordinator', {
        userId: ERFASSER,
        grants: [grant('operatorCoordinator')],
      }),
      resource: timesheetResource('inApproval', {
        openApprovalRoleCode: 'operatorCoordinator',
        createdById: ERFASSER,
        submittedById: null as unknown as string,
      }),
      facts: facts({
        openStageRoleCode: 'operatorCoordinator',
        actingRoleCodes: ['operatorCoordinator'],
        actingUserId: ERFASSER,
        recordedById: ERFASSER,
        submittedById: null,
        remainingOpenStages: 0,
      }),
    })
    expect(outcome.applied).toBe(false)
  })

  it('verweigert sie auch der Person, die ihn **eingereicht** hat', () => {
    const outcome = stufenversuch('approve', 'operatorCoordinator', {
      remainingOpenStages: 0,
      recordedById: 'user-anderer',
      submittedById: 'user-operatorCoordinator',
    })
    expect(outcome).toMatchObject({ applied: false, rejection: { kind: 'precondition' } })
    if (!outcome.applied) expect(outcome.rejection.reason).toContain('Vier-Augen')
  })

  it('erlaubt sie einer anderen Person derselben Rolle', () => {
    const outcome = stufenversuch('approve', 'operatorCoordinator', {
      remainingOpenStages: 0,
      recordedById: 'user-anderer',
      submittedById: 'user-noch-anderer',
    })
    expect(outcome.applied).toBe(true)
  })
})

describe('Ablehnen (inApproval → rejected, SPEC 4.4)', () => {
  it('lehnt mit Begründung ab', () => {
    const outcome = stufenversuch('reject', 'demandOwner', {
      rejectionReason: 'Freitag fehlt, bitte nacharbeiten',
    })
    expect(outcome).toMatchObject({ applied: true, to: 'rejected' })
  })

  it('verweigert die Ablehnung ohne Begründung', () => {
    const outcome = stufenversuch('reject', 'demandOwner', { rejectionReason: '   ' })
    expect(outcome).toMatchObject({ applied: false, rejection: { kind: 'precondition' } })
    if (!outcome.applied) expect(outcome.rejection.reason).toContain('Ablehnungsgrund')
  })

  it('lehnt auch dann ab, wenn weitere Stufen offen sind — sie entfallen', () => {
    const outcome = stufenversuch('reject', 'demandOwner', {
      remainingOpenStages: 3,
      rejectionReason: 'Stunden stimmen nicht',
    })
    expect(outcome.applied).toBe(true)
  })
})

describe('Nacharbeiten (rejected → recorded, SPEC 4.4)', () => {
  const nacharbeiten = (rolle: RoleCode, teile: Partial<TimesheetFacts> = {}) =>
    attemptTransition(TIMESHEET_MODEL, 'rework', {
      currentStatus: 'rejected',
      subject: subject(rolle, { grants: [grant(rolle)] }),
      resource: timesheetResource('rejected'),
      facts: facts(teile),
    })

  it('gibt den Zettel durch den Betreiber zur Nacharbeit frei', () => {
    expect(nacharbeiten('operatorCoordinator')).toMatchObject({ applied: true, to: 'recorded' })
  })

  it('verweigert die Nacharbeit in einer geschlossenen Periode', () => {
    const outcome = nacharbeiten('operatorCoordinator', { billingPeriodStatus: 'closed' })
    expect(outcome).toMatchObject({ applied: false, rejection: { kind: 'precondition' } })
  })

  it('verweigert sie dem Lieferanten — Fußnote [20] deckt sie nicht (offene Frage 49)', () => {
    // 4.4 nennt `LD` in dieser Zeile, die Zelle in 2.2 gibt ihm aber nur
    // `S[20]`: „Einreichen und Zurückziehen des eigenen Vorgangs". Das
    // Nacharbeiten ist keines von beiden. Der Übergang nennt die Rolle wie
    // 4.4, und die Prüffunktion verweigert mit Fundstelle — der Widerspruch
    // bleibt sichtbar, statt still entschieden zu werden.
    const outcome = nacharbeiten('supplierCoordinator')
    expect(outcome).toMatchObject({ applied: false, rejection: { kind: 'notPermitted' } })
    if (!outcome.applied) expect(outcome.rejection.specReference).toContain('Fußnote [20]')
  })

  it('erlaubt dem Lieferanten dagegen das Einreichen — dafür trägt [20] den Zielstatus', () => {
    const outcome = attemptTransition(TIMESHEET_MODEL, 'submit', {
      currentStatus: 'recorded',
      subject: subject('supplierCoordinator', { grants: [grant('supplierCoordinator')] }),
      resource: timesheetResource('recorded'),
      facts: facts(),
    })
    expect(outcome.applied).toBe(true)
  })
})

describe('Durch Korrekturfassung ersetzen (approved → corrected, SPEC 4.4)', () => {
  it('ist ein Systemübergang und setzt eine genehmigte Korrekturfassung voraus', () => {
    const outcome = attemptTransition(TIMESHEET_MODEL, 'markCorrected', {
      currentStatus: 'approved',
      resource: timesheetResource('approved'),
      facts: facts({ correctionApproved: true }),
    })
    expect(outcome).toMatchObject({ applied: true, to: 'corrected' })
  })

  it('verweigert ihn, solange keine Korrekturfassung genehmigt ist', () => {
    const outcome = attemptTransition(TIMESHEET_MODEL, 'markCorrected', {
      currentStatus: 'approved',
      resource: timesheetResource('approved'),
      facts: facts({ correctionApproved: false }),
    })
    expect(outcome).toMatchObject({ applied: false, rejection: { kind: 'precondition' } })
  })

  it('lässt sich nicht von einem Benutzer auslösen', () => {
    const outcome = attemptTransition(TIMESHEET_MODEL, 'markCorrected', {
      currentStatus: 'approved',
      subject: subject('operatorAdmin'),
      resource: timesheetResource('approved'),
      facts: facts({ correctionApproved: true }),
    })
    expect(outcome).toMatchObject({ applied: false, rejection: { kind: 'systemTransition' } })
  })
})

describe('Jede Vorbedingung nennt ihre Fundstelle', () => {
  it('trägt zu jedem Übergang eine Fundstelle und für Kapitel-5-Prüfungen eine Regel', () => {
    const uebergaenge: readonly (readonly [string, TimesheetTransition])[] = Object.entries(
      TIMESHEET_MODEL.transitions,
    )
    for (const [name, definition] of uebergaenge) {
      expect(definition.specReference, name).toMatch(/^SPEC 4\.4/)
      for (const precondition of definition.preconditions) {
        expect(precondition.specReference, `${name}: ${precondition.description}`).toContain('SPEC')
        // Nur Vorbedingungen, die eine Prüfung aus Kapitel 5 nennen, tragen
        // eine `ruleRef` — daran erkennt das Protokoll eine **Sperre** (3.12).
        const nenntPruefung = /\bP\d+:/.test(precondition.description)
        expect(precondition.ruleRef !== undefined, precondition.description).toBe(nenntPruefung)
      }
    }
  })
})
