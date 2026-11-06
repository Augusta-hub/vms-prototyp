/**
 * Tests des Nachweisflusses gegen SPEC **5.4.3**.
 *
 * Geprüft wird je Übergang: ein erlaubter Fall, die **Rolle**, die ihn nach
 * 5.4.3 auslöst, die Vorbedingungen aus der Spalte „Vorbedingungen" und die
 * drei ausdrücklich **ausgeschlossenen** Wege — zurück nach `submitted`, der
 * Statuswechsel durch Zeitablauf und die Anerkennung durch den Einsteller.
 *
 * Dazu die beiden Fußnoten, an denen der Fluss hängt: [34] (anerkennen oder
 * zurückweisen) und [37] (ändern nur bis zur Anerkennung).
 *
 * Diese Tests prüfen Anwendungscode und sind **nicht** die AÜG-Regeln; die
 * stehen als Gherkin in tests/aueg/ und werden hier nicht berührt.
 */
import { describe, expect, it } from 'vitest'
import type { ResourceRef } from '../authz/check'
import { checkPermission } from '../authz/check'
import {
  CUSTOMER_TENANT,
  DAY,
  OPERATOR_TENANT,
  OTHER_SUPPLIER_TENANT,
  subject,
  SUPPLIER_TENANT,
} from '../testing/fixtures'
import { DOCUMENT_MODEL, type DocumentFacts } from './document'
import { attemptTransition, isTerminal, transitionsFrom } from './machine'

const TODAY = DAY('2026-11-06')
const EINSTELLER = 'user-supplierAdmin'

/** Die Erlaubnisurkunde: Mandant des Lieferanten, dem Kunden nicht offengelegt. */
function urkundeRef(options: Partial<ResourceRef> = {}): ResourceRef {
  return {
    type: 'document',
    tenantId: SUPPLIER_TENANT,
    tenantType: 'supplier',
    supplierTenantId: SUPPLIER_TENANT,
    documentCategory: 'permitCertificate',
    confidentiality: 'operatorAndOwner',
    status: 'submitted',
    disclosedToTenantIds: [],
    ...options,
  }
}

/**
 * Die Unterweisung am Einsatz: Mandant des Betreibers, beiden Seiten offen.
 *
 * `engagementTenantIds` trägt den **Einsatzbezug** — die Kunden, zu denen der
 * Nachweis gehört. Fußnote [35] liest ihn dort und nicht aus einem einzelnen
 * `customerTenantId`: ein Kandidatennachweis kann mehrere Kunden betreffen
 * (siehe `documentRef`).
 */
function unterweisungRef(options: Partial<ResourceRef> = {}): ResourceRef {
  return {
    type: 'document',
    tenantId: OPERATOR_TENANT,
    tenantType: 'operator',
    supplierTenantId: SUPPLIER_TENANT,
    documentCategory: 'safetyBriefing',
    confidentiality: 'assignmentParties',
    status: 'submitted',
    engagementTenantIds: [CUSTOMER_TENANT],
    disclosedToTenantIds: [CUSTOMER_TENANT, SUPPLIER_TENANT],
    ...options,
  }
}

function facts(overrides: Partial<DocumentFacts> = {}): DocumentFacts {
  return {
    documentCategory: 'permitCertificate',
    subjectType: 'supplier',
    subjectRef: 'LI-1',
    fileRef: 'ablage://synthetisch/urkunde-1',
    fileName: 'urkunde.pdf',
    mimeType: 'application/pdf',
    categoryFitsSubject: true,
    uploadedById: EINSTELLER,
    actingUserId: 'user-operatorCoordinator',
    verifiedAt: TODAY,
    verifiedById: 'user-operatorCoordinator',
    rejectionReason: null,
    validTo: DAY('2028-06-30'),
    validToDeliberatelyOpen: false,
    ...overrides,
  }
}

describe('Einstellen (— → submitted, SPEC 5.4.3)', () => {
  it('nimmt den Nachweis des Lieferantenadministrators an', () => {
    const outcome = attemptTransition(DOCUMENT_MODEL, 'submit', {
      currentStatus: null,
      subject: subject('supplierAdmin'),
      resource: urkundeRef(),
      facts: facts({ actingUserId: EINSTELLER, uploadedById: null }),
    })
    expect(outcome.applied).toBe(true)
  })

  it('verweigert den Nachweis ohne Bezugsobjekt (3.10)', () => {
    const outcome = attemptTransition(DOCUMENT_MODEL, 'submit', {
      currentStatus: null,
      subject: subject('supplierAdmin'),
      resource: urkundeRef(),
      facts: facts({ subjectRef: null, actingUserId: EINSTELLER, uploadedById: null }),
    })
    expect(outcome.applied).toBe(false)
    if (!outcome.applied) expect(outcome.rejection.kind).toBe('precondition')
  })

  it('verweigert den Nachweis ohne Ablageangaben (3.10, 5.4.5)', () => {
    const outcome = attemptTransition(DOCUMENT_MODEL, 'submit', {
      currentStatus: null,
      subject: subject('supplierAdmin'),
      resource: urkundeRef(),
      facts: facts({ fileRef: '  ', actingUserId: EINSTELLER, uploadedById: null }),
    })
    expect(outcome.applied).toBe(false)
  })

  it('lässt den Lieferanten eines anderen Mandanten nicht an den Vorgang (2.3)', () => {
    const outcome = attemptTransition(DOCUMENT_MODEL, 'submit', {
      currentStatus: null,
      subject: subject('supplierAdmin', { tenantId: OTHER_SUPPLIER_TENANT }),
      resource: urkundeRef(),
      facts: facts({ actingUserId: EINSTELLER, uploadedById: null }),
    })
    expect(outcome.applied).toBe(false)
    // Die Übergangsschicht gibt jede Verweigerung der Prüffunktion als
    // `notPermitted` zurück; die **Begründung** bleibt die der Grenze (2.3).
    if (!outcome.applied) {
      expect(outcome.rejection.kind).toBe('notPermitted')
      expect(outcome.rejection.specReference).toBe('SPEC 2.3, Grundsatz')
    }
  })

  it('verweigert dem Bedarfsträger das Einstellen — 2.2 gibt ihm kein `A` (offene Frage 42)', () => {
    // 5.4.3 nennt `KB` unter den auslösenden Rollen, die Zeile in 2.2 trägt für
    // ihn nur `L[35]`. Der Übergang nennt die Rolle deshalb, und die Matrix
    // verweigert sie — mit Fundstelle, nicht stillschweigend.
    const outcome = attemptTransition(DOCUMENT_MODEL, 'submit', {
      currentStatus: null,
      subject: subject('demandOwner'),
      resource: unterweisungRef(),
      facts: facts({
        documentCategory: 'safetyBriefing',
        subjectType: 'assignment',
        subjectRef: 'E-1',
        actingUserId: 'user-demandOwner',
        uploadedById: null,
      }),
    })
    expect(outcome.applied).toBe(false)
    if (!outcome.applied) {
      expect(outcome.rejection.kind).toBe('notPermitted')
      expect(outcome.rejection.specReference).toBe('SPEC 2.2')
    }
  })
})

describe('Anerkennen (submitted → accepted, SPEC 5.4.3)', () => {
  it('nimmt die Anerkennung durch den Betreiberdisponenten an ([34])', () => {
    const outcome = attemptTransition(DOCUMENT_MODEL, 'accept', {
      currentStatus: 'submitted',
      subject: subject('operatorCoordinator'),
      resource: urkundeRef(),
      facts: facts(),
    })
    expect(outcome.applied).toBe(true)
    if (outcome.applied) expect(outcome.to).toBe('accepted')
  })

  it('verweigert die Anerkennung durch den Einsteller selbst (Vier-Augen, 5.4.3)', () => {
    const outcome = attemptTransition(DOCUMENT_MODEL, 'accept', {
      currentStatus: 'submitted',
      subject: subject('operatorAdmin', { userId: EINSTELLER }),
      resource: urkundeRef(),
      facts: facts({ actingUserId: EINSTELLER, verifiedById: EINSTELLER }),
    })
    expect(outcome.applied).toBe(false)
    if (!outcome.applied) {
      expect(outcome.rejection.kind).toBe('precondition')
      expect(outcome.rejection.reason).toContain('Vier-Augen')
    }
  })

  it('verweigert sie, wenn die Nachweisart nicht zum Bezugsobjekt passt (5.4.4)', () => {
    const outcome = attemptTransition(DOCUMENT_MODEL, 'accept', {
      currentStatus: 'submitted',
      subject: subject('operatorCoordinator'),
      resource: urkundeRef(),
      facts: facts({ categoryFitsSubject: false }),
    })
    expect(outcome.applied).toBe(false)
  })

  it('verweigert sie ohne `verifiedAt` und `verifiedBy` (3.10)', () => {
    const outcome = attemptTransition(DOCUMENT_MODEL, 'accept', {
      currentStatus: 'submitted',
      subject: subject('operatorCoordinator'),
      resource: urkundeRef(),
      facts: facts({ verifiedAt: null, verifiedById: null }),
    })
    expect(outcome.applied).toBe(false)
  })

  it('verweigert sie bei leerem `validTo` ohne ausdrückliche Entscheidung (5.4.3)', () => {
    const outcome = attemptTransition(DOCUMENT_MODEL, 'accept', {
      currentStatus: 'submitted',
      subject: subject('operatorCoordinator'),
      resource: urkundeRef(),
      facts: facts({ validTo: null, validToDeliberatelyOpen: false }),
    })
    expect(outcome.applied).toBe(false)
  })

  it('lässt den unbefristeten Nachweis zu, wenn die Unbefristetheit erklärt ist (5.4.4)', () => {
    const outcome = attemptTransition(DOCUMENT_MODEL, 'accept', {
      currentStatus: 'submitted',
      subject: subject('operatorCoordinator'),
      resource: urkundeRef(),
      facts: facts({ validTo: null, validToDeliberatelyOpen: true }),
    })
    expect(outcome.applied).toBe(true)
  })

  it('löst sie nicht durch den Lieferanten aus (5.4.3, keine Anerkennung durch den Einsteller)', () => {
    const outcome = attemptTransition(DOCUMENT_MODEL, 'accept', {
      currentStatus: 'submitted',
      subject: subject('supplierAdmin'),
      resource: urkundeRef(),
      facts: facts({ actingUserId: 'user-supplierAdmin-2' }),
    })
    expect(outcome.applied).toBe(false)
    if (!outcome.applied) expect(outcome.rejection.kind).toBe('roleNotTriggering')
  })
})

describe('Zurückweisen (submitted → rejected, SPEC 5.4.3)', () => {
  it('nimmt die Zurückweisung mit Begründung an', () => {
    const outcome = attemptTransition(DOCUMENT_MODEL, 'reject', {
      currentStatus: 'submitted',
      subject: subject('operatorCoordinator'),
      resource: urkundeRef(),
      facts: facts({ rejectionReason: 'Urkunde unlesbar' }),
    })
    expect(outcome.applied).toBe(true)
  })

  it('verweigert sie ohne Begründung (3.10)', () => {
    const outcome = attemptTransition(DOCUMENT_MODEL, 'reject', {
      currentStatus: 'submitted',
      subject: subject('operatorCoordinator'),
      resource: urkundeRef(),
      facts: facts({ rejectionReason: '   ' }),
    })
    expect(outcome.applied).toBe(false)
    if (!outcome.applied) expect(outcome.rejection.kind).toBe('precondition')
  })
})

describe('Was 5.4.3 ausschließt', () => {
  it('kennt keinen Weg zurück nach `submitted`', () => {
    expect(transitionsFrom(DOCUMENT_MODEL, 'accepted')).toEqual([])
    expect(transitionsFrom(DOCUMENT_MODEL, 'rejected')).toEqual([])
  })

  it('führt `rejected` als Endzustand', () => {
    expect(isTerminal(DOCUMENT_MODEL, 'rejected')).toBe(true)
  })

  it('kennt keinen Übergang, den Zeitablauf auslöst', () => {
    // Ein abgelaufener Nachweis bleibt `accepted` (5.4.3). Ein Zustand
    // `expired` ist nicht ausdrückbar, weil es ihn nicht gibt.
    expect(DOCUMENT_MODEL.states).toEqual(['submitted', 'accepted', 'rejected'])
    expect(Object.keys(DOCUMENT_MODEL.transitions)).toEqual(['submit', 'accept', 'reject'])
  })
})

describe('Die Fußnoten der Zeile „Dokument / Nachweis" (SPEC 2.2)', () => {
  it('[34]: `MD` wechselt den Status nur nach `accepted` oder `rejected`', () => {
    const erlaubt = checkPermission(
      subject('operatorCoordinator'),
      'transition',
      urkundeRef({ targetStatus: 'accepted' }),
    )
    const verweigert = checkPermission(
      subject('operatorCoordinator'),
      'transition',
      urkundeRef({ targetStatus: 'submitted' }),
    )
    expect(erlaubt.allowed).toBe(true)
    expect(verweigert.allowed).toBe(false)
  })

  it('[37]: der Lieferant ändert den Nachweis nur bis zur Anerkennung', () => {
    const vorher = checkPermission(subject('supplierAdmin'), 'update', urkundeRef())
    const nachher = checkPermission(
      subject('supplierAdmin'),
      'update',
      urkundeRef({ status: 'accepted' }),
    )
    expect(vorher.allowed).toBe(true)
    expect(nachher.allowed).toBe(false)
  })

  it('[35]: der Bedarfsträger sieht den einsatzbezogenen Nachweis seines Kunden', () => {
    const decision = checkPermission(subject('demandOwner'), 'read', unterweisungRef())
    expect(decision.allowed).toBe(true)
  })

  it('[35]: er sieht die Vertragsunterlagen des Lieferanten nicht', () => {
    // Auch dann nicht, wenn jemand die Sichtbarkeitsklasse falsch setzt: die
    // Nachweisart entscheidet mit (2.2, [35]; die Invariante dazu steht in
    // lib/masterdata/invariants.ts).
    const decision = checkPermission(
      subject('demandOwner'),
      'read',
      unterweisungRef({
        documentCategory: 'permitCertificate',
        confidentiality: 'assignmentParties',
      }),
    )
    expect(decision.allowed).toBe(false)
  })

  it('[35]: er sieht den einsatzbezogenen Nachweis eines anderen Kunden nicht', () => {
    const decision = checkPermission(
      subject('demandOwner'),
      'read',
      unterweisungRef({
        engagementTenantIds: ['tenant-customer-2'],
        disclosedToTenantIds: ['tenant-customer-2'],
      }),
    )
    expect(decision.allowed).toBe(false)
  })

  it('[36]: Einkauf/Controlling sieht die Urkunde nur ohne Inhalte', () => {
    const decision = checkPermission(
      subject('procurementController'),
      'read',
      urkundeRef({
        engagementTenantIds: [CUSTOMER_TENANT],
        disclosedToTenantIds: [CUSTOMER_TENANT],
      }),
    )
    expect(decision.allowed).toBe(true)
    if (decision.allowed) {
      expect(decision.concealedFields).toContain('fileRef')
      expect(decision.concealedFields).toContain('issuer')
      expect(decision.concealedFields).not.toContain('verificationStatus')
      expect(decision.concealedFields).not.toContain('validTo')
    }
  })

  it('[36]: und keinen anderen Nachweis des Lieferanten', () => {
    const decision = checkPermission(
      subject('procurementController'),
      'read',
      urkundeRef({
        documentCategory: 'clearanceCertificate',
        engagementTenantIds: [CUSTOMER_TENANT],
        disclosedToTenantIds: [CUSTOMER_TENANT],
      }),
    )
    expect(decision.allowed).toBe(false)
  })

  it('[36]: und nicht die Urkunde eines Lieferanten ohne Beauftragung', () => {
    const decision = checkPermission(
      subject('procurementController'),
      'read',
      urkundeRef({ engagementTenantIds: [], disclosedToTenantIds: [CUSTOMER_TENANT] }),
    )
    expect(decision.allowed).toBe(false)
  })
})
