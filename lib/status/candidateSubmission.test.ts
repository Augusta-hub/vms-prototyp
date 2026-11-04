/**
 * Tests des Statusmodells des Profilvorschlags gegen SPEC 4.2.3.
 *
 * Geprüft wird je Übergang: ein **erlaubter** Fall, ein **abgelehnter** (die
 * Spalte „Von" trägt den Zustand nicht), einer, der an der **Rolle** scheitert,
 * und die **Mandantengrenze** aus 2.3. Dazu die Datenminimierung aus 6.4, weil
 * sie in 4.2.3 eine Vorbedingung ist und keine Option.
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
  OTHER_SUPPLIER_TENANT,
  subject,
  SUPPLIER_TENANT,
} from '../testing/fixtures'
import {
  CANDIDATE_SUBMISSION_MODEL,
  type CandidateSubmissionFacts,
} from './candidateSubmission'
import { attemptTransition, isTerminal, transitionsFrom } from './machine'

const TODAY = DAY('2026-11-04')

/**
 * Der Profilvorschlag gehört dem Lieferanten (3.6) und ist dem Kunden erst
 * zugänglich, wenn er ihm vorgelegt wurde (4.2.3).
 */
function submissionRef(options: Partial<ResourceRef> = {}): ResourceRef {
  return {
    type: 'candidate',
    tenantId: SUPPLIER_TENANT,
    tenantType: 'supplier',
    supplierTenantId: SUPPLIER_TENANT,
    customerTenantId: CUSTOMER_TENANT,
    status: 'draft',
    disclosureLevel: 'pseudonymized',
    disclosedToTenantIds: [CUSTOMER_TENANT],
    ...options,
  }
}

function facts(overrides: Partial<CandidateSubmissionFacts> = {}): CandidateSubmissionFacts {
  return {
    offerStatus: 'submitted',
    candidatePresent: true,
    pseudonym: 'Profil M.D. (Montage)',
    availableFrom: DAY('2027-02-15'),
    disclosureLevel: 'pseudonymized',
    decision: null,
    decidedAt: null,
    decidedById: null,
    decisionReason: null,
    hasBlockingRuleCheck: false,
    maxDurationExceeded: false,
    hasPreviousEmploymentDeclaration: true,
    mandatoryDocumentsChecked: true,
    evaluationDate: TODAY,
    ...overrides,
  }
}

const decided = (
  decision: 'accepted' | 'rejected',
): Partial<CandidateSubmissionFacts> => ({
  decision,
  decidedAt: TODAY,
  decidedById: 'user-demandOwner',
})

describe('4.2.3 — zulässige Übergänge', () => {
  it('LD legt zum eigenen Angebot einen Vorschlag an (— → draft)', () => {
    const outcome = attemptTransition(CANDIDATE_SUBMISSION_MODEL, 'create', {
      currentStatus: null,
      subject: subject('supplierCoordinator'),
      resource: submissionRef(),
      facts: facts(),
    })
    expect(outcome).toMatchObject({ applied: true, to: 'draft' })
  })

  it('LD legt vor (draft → submitted)', () => {
    const outcome = attemptTransition(CANDIDATE_SUBMISSION_MODEL, 'submit', {
      currentStatus: 'draft',
      subject: subject('supplierCoordinator'),
      resource: submissionRef(),
      facts: facts(),
    })
    expect(outcome).toMatchObject({ applied: true, to: 'submitted' })
  })

  it('MD sichtet (submitted → reviewed)', () => {
    const outcome = attemptTransition(CANDIDATE_SUBMISSION_MODEL, 'review', {
      currentStatus: 'submitted',
      subject: subject('operatorCoordinator'),
      resource: submissionRef({ status: 'submitted' }),
      facts: facts(),
    })
    expect(outcome).toMatchObject({ applied: true, to: 'reviewed' })
  })

  it('MD legt pseudonymisiert dem Kunden vor (reviewed → releasedToCustomer)', () => {
    const outcome = attemptTransition(CANDIDATE_SUBMISSION_MODEL, 'releaseToCustomer', {
      currentStatus: 'reviewed',
      subject: subject('operatorCoordinator'),
      resource: submissionRef({ status: 'reviewed' }),
      facts: facts(),
    })
    expect(outcome).toMatchObject({ applied: true, to: 'releasedToCustomer' })
  })

  it('KB vereinbart ein Interview (releasedToCustomer → interviewScheduled)', () => {
    const outcome = attemptTransition(CANDIDATE_SUBMISSION_MODEL, 'scheduleInterview', {
      currentStatus: 'releasedToCustomer',
      subject: subject('demandOwner'),
      resource: submissionRef({ status: 'releasedToCustomer' }),
      facts: facts(),
    })
    expect(outcome).toMatchObject({ applied: true, to: 'interviewScheduled' })
  })

  it('KB sagt zu (interviewScheduled → accepted)', () => {
    const outcome = attemptTransition(CANDIDATE_SUBMISSION_MODEL, 'accept', {
      currentStatus: 'interviewScheduled',
      subject: subject('demandOwner'),
      resource: submissionRef({ status: 'interviewScheduled' }),
      facts: facts(decided('accepted')),
    })
    expect(outcome).toMatchObject({ applied: true, to: 'accepted' })
  })

  it('MD lehnt vor der Vorlage ab (submitted → rejected)', () => {
    const outcome = attemptTransition(CANDIDATE_SUBMISSION_MODEL, 'rejectByOperator', {
      currentStatus: 'submitted',
      subject: subject('operatorCoordinator'),
      resource: submissionRef({ status: 'submitted' }),
      facts: facts({ decisionReason: 'Qualifikation passt nicht zur Anfrage' }),
    })
    expect(outcome).toMatchObject({ applied: true, to: 'rejected' })
  })

  it('KB sagt ab (releasedToCustomer → rejected)', () => {
    const outcome = attemptTransition(CANDIDATE_SUBMISSION_MODEL, 'rejectByCustomer', {
      currentStatus: 'releasedToCustomer',
      subject: subject('demandOwner'),
      resource: submissionRef({ status: 'releasedToCustomer' }),
      facts: facts({ ...decided('rejected'), decisionReason: 'Profil passt fachlich nicht' }),
    })
    expect(outcome).toMatchObject({ applied: true, to: 'rejected' })
  })

  it('LD zieht zurück (interviewScheduled → withdrawn)', () => {
    const outcome = attemptTransition(CANDIDATE_SUBMISSION_MODEL, 'withdraw', {
      currentStatus: 'interviewScheduled',
      subject: subject('supplierCoordinator'),
      resource: submissionRef({ status: 'interviewScheduled' }),
      facts: facts(),
    })
    expect(outcome).toMatchObject({ applied: true, to: 'withdrawn' })
  })
})

describe('4.2.3 — abgelehnte Übergänge aus dem falschen Zustand', () => {
  it('kein accepted → rejected: eine hinfällige Zusage ist die Beendigung des Einsatzes (4.3)', () => {
    const outcome = attemptTransition(CANDIDATE_SUBMISSION_MODEL, 'rejectByCustomer', {
      currentStatus: 'accepted',
      subject: subject('demandOwner'),
      resource: submissionRef({ status: 'accepted' }),
      facts: facts({ ...decided('rejected'), decisionReason: 'doch nicht' }),
    })
    expect(outcome).toMatchObject({
      applied: false,
      rejection: { kind: 'statusMismatch', specReference: 'SPEC 4.2.3; 4.0, Regel 9' },
    })
  })

  it('kein withdrawn → submitted: aus einem Endzustand führt kein Übergang zurück', () => {
    const outcome = attemptTransition(CANDIDATE_SUBMISSION_MODEL, 'submit', {
      currentStatus: 'withdrawn',
      subject: subject('supplierCoordinator'),
      resource: submissionRef({ status: 'withdrawn' }),
      facts: facts(),
    })
    expect(outcome).toMatchObject({ applied: false, rejection: { kind: 'statusMismatch' } })
  })

  it('kein draft → releasedToCustomer: die Sichtung des Betreibers liegt dazwischen', () => {
    const outcome = attemptTransition(CANDIDATE_SUBMISSION_MODEL, 'releaseToCustomer', {
      currentStatus: 'draft',
      subject: subject('operatorCoordinator'),
      resource: submissionRef(),
      facts: facts(),
    })
    expect(outcome).toMatchObject({ applied: false, rejection: { kind: 'statusMismatch' } })
  })

  it('ein in 4.2.3 nicht genannter Übergang hat keinen Namen', () => {
    // @ts-expect-error — „reopen" steht nicht in der Übergangstabelle und ist
    // damit nicht ausdrückbar (4.0, Regel 1).
    const outcome = attemptTransition(CANDIDATE_SUBMISSION_MODEL, 'reopen', {
      currentStatus: 'rejected',
      subject: subject('operatorCoordinator'),
      resource: submissionRef({ status: 'rejected' }),
      facts: facts(),
    })
    expect(outcome).toMatchObject({ applied: false, rejection: { kind: 'unknownTransition' } })
  })
})

describe('4.2.3 — Übergänge, die an der Rolle scheitern', () => {
  it('der Betreiber sagt nicht zu: die Auswahl ist eine Kundenentscheidung ([24], 2.4 Regel 3)', () => {
    const outcome = attemptTransition(CANDIDATE_SUBMISSION_MODEL, 'accept', {
      currentStatus: 'releasedToCustomer',
      subject: subject('operatorCoordinator'),
      resource: submissionRef({ status: 'releasedToCustomer' }),
      facts: facts(decided('accepted')),
    })
    expect(outcome).toMatchObject({ applied: false, rejection: { kind: 'roleNotTriggering' } })
  })

  it('der Lieferant legt nicht selbst beim Kunden vor: das ist die Freigabe des MD ([22])', () => {
    const outcome = attemptTransition(CANDIDATE_SUBMISSION_MODEL, 'releaseToCustomer', {
      currentStatus: 'reviewed',
      subject: subject('supplierCoordinator'),
      resource: submissionRef({ status: 'reviewed' }),
      facts: facts(),
    })
    expect(outcome).toMatchObject({ applied: false, rejection: { kind: 'roleNotTriggering' } })
  })

  it('der Genehmiger hat an dieser Zeile kein Recht: 2.2 trägt für KG keine Zelle', () => {
    const outcome = attemptTransition(CANDIDATE_SUBMISSION_MODEL, 'accept', {
      currentStatus: 'releasedToCustomer',
      subject: subject('approver'),
      resource: submissionRef({ status: 'releasedToCustomer' }),
      facts: facts(decided('accepted')),
    })
    expect(outcome).toMatchObject({ applied: false, rejection: { kind: 'roleNotTriggering' } })
  })
})

describe('2.3 — die Mandantengrenze geht dem Rollenrecht vor', () => {
  it('ein fremder Lieferant zieht den Vorschlag nicht zurück', () => {
    const outcome = attemptTransition(CANDIDATE_SUBMISSION_MODEL, 'withdraw', {
      currentStatus: 'submitted',
      subject: subject('supplierCoordinator', { tenantId: OTHER_SUPPLIER_TENANT }),
      resource: submissionRef({ status: 'submitted' }),
      facts: facts(),
    })
    expect(outcome).toMatchObject({
      applied: false,
      rejection: { kind: 'notPermitted', specReference: 'SPEC 2.3, Grundsatz' },
    })
  })

  it('ein fremder Kunde sagt nicht zu — auch nicht zu einem vorgelegten Vorschlag', () => {
    const outcome = attemptTransition(CANDIDATE_SUBMISSION_MODEL, 'accept', {
      currentStatus: 'releasedToCustomer',
      subject: subject('demandOwner', { tenantId: OTHER_CUSTOMER_TENANT }),
      resource: submissionRef({ status: 'releasedToCustomer' }),
      facts: facts(decided('accepted')),
    })
    expect(outcome).toMatchObject({ applied: false, rejection: { kind: 'notPermitted' } })
  })

  it('der Kunde entscheidet nur über seinen eigenen Vorschlag ([24])', () => {
    const outcome = attemptTransition(CANDIDATE_SUBMISSION_MODEL, 'accept', {
      currentStatus: 'releasedToCustomer',
      subject: subject('demandOwner'),
      resource: submissionRef({
        status: 'releasedToCustomer',
        customerTenantId: OTHER_CUSTOMER_TENANT,
        disclosedToTenantIds: [OTHER_CUSTOMER_TENANT],
      }),
      facts: facts(decided('accepted')),
    })
    expect(outcome).toMatchObject({ applied: false, rejection: { kind: 'notPermitted' } })
  })
})

describe('4.2.3 — Vorbedingungen, die 6.4 und Kapitel 5 tragen', () => {
  it('keine Vorlage mit Klardaten: der Übergang **ist** die Datenminimierung (6.4)', () => {
    const outcome = attemptTransition(CANDIDATE_SUBMISSION_MODEL, 'releaseToCustomer', {
      currentStatus: 'reviewed',
      subject: subject('operatorCoordinator'),
      resource: submissionRef({ status: 'reviewed', disclosureLevel: 'identified' }),
      facts: facts({ disclosureLevel: 'identified' }),
    })
    expect(outcome).toMatchObject({ applied: false, rejection: { kind: 'precondition' } })
    if (!outcome.applied) {
      expect(outcome.rejection.reason).toContain('pseudonymized')
    }
  })

  it('keine Vorlage, solange ein Prüfergebnis sperrt (5.5)', () => {
    const outcome = attemptTransition(CANDIDATE_SUBMISSION_MODEL, 'releaseToCustomer', {
      currentStatus: 'reviewed',
      subject: subject('operatorCoordinator'),
      resource: submissionRef({ status: 'reviewed' }),
      facts: facts({ hasBlockingRuleCheck: true }),
    })
    expect(outcome).toMatchObject({ applied: false, rejection: { kind: 'precondition' } })
  })

  it('keine Zusage ohne Erklärung zur Vorbeschäftigung — P6 sperrt die fehlende Grundlage (5.3.1)', () => {
    const outcome = attemptTransition(CANDIDATE_SUBMISSION_MODEL, 'accept', {
      currentStatus: 'releasedToCustomer',
      subject: subject('demandOwner'),
      resource: submissionRef({ status: 'releasedToCustomer' }),
      facts: facts({ ...decided('accepted'), hasPreviousEmploymentDeclaration: false }),
    })
    expect(outcome).toMatchObject({ applied: false, rejection: { kind: 'precondition' } })
  })

  it('keine Zusage bei überschrittener Höchstüberlassungsdauer — P1 sperrt (5.1)', () => {
    const outcome = attemptTransition(CANDIDATE_SUBMISSION_MODEL, 'accept', {
      currentStatus: 'releasedToCustomer',
      subject: subject('demandOwner'),
      resource: submissionRef({ status: 'releasedToCustomer' }),
      facts: facts({ ...decided('accepted'), maxDurationExceeded: true }),
    })
    expect(outcome).toMatchObject({ applied: false, rejection: { kind: 'precondition' } })
  })

  it('keine Ablehnung ohne Begründung (2.3, Regel 3)', () => {
    const outcome = attemptTransition(CANDIDATE_SUBMISSION_MODEL, 'rejectByOperator', {
      currentStatus: 'reviewed',
      subject: subject('operatorCoordinator'),
      resource: submissionRef({ status: 'reviewed' }),
      facts: facts({ decisionReason: '   ' }),
    })
    expect(outcome).toMatchObject({ applied: false, rejection: { kind: 'precondition' } })
  })

  it('kein Vorschlag ohne Pseudonym: es ist die Anzeigeform des Profils (3.6)', () => {
    const outcome = attemptTransition(CANDIDATE_SUBMISSION_MODEL, 'create', {
      currentStatus: null,
      subject: subject('supplierCoordinator'),
      resource: submissionRef(),
      facts: facts({ pseudonym: null }),
    })
    expect(outcome).toMatchObject({ applied: false, rejection: { kind: 'precondition' } })
  })
})

describe('4.2.3 — Form des Modells', () => {
  it('die drei Endzustände tragen keinen Ausgang (4.0, Regel 9)', () => {
    for (const state of ['accepted', 'rejected', 'withdrawn'] as const) {
      expect(isTerminal(CANDIDATE_SUBMISSION_MODEL, state)).toBe(true)
      expect(transitionsFrom(CANDIDATE_SUBMISSION_MODEL, state)).toEqual([])
    }
  })

  it('der Profilvorschlag hat **keinen** Zustand `expired` (4.2.3)', () => {
    expect(CANDIDATE_SUBMISSION_MODEL.states).not.toContain('expired')
  })

  it('kein Systemübergang: jeder Übergang nennt eine auslösende Rolle', () => {
    for (const transition of Object.values(CANDIDATE_SUBMISSION_MODEL.transitions)) {
      expect(transition.roles.length).toBeGreaterThan(0)
    }
  })
})
