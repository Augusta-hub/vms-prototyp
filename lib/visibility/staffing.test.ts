/**
 * Tests der Sichtbarkeit in der Besetzung — SPEC 2.3, die Fußnoten [7], [23]
 * und [43] aus 2.2 und die Datenminimierung aus 6.4.
 *
 * Zwei Fragen je Fall, wie in projections.test.ts: **darf** die Rolle den
 * Vorgang sehen, und **welche Felder** sieht sie dann? Für den Profilvorschlag
 * ist die zweite Frage die eigentliche: der Kunde sieht ein pseudonymisiertes
 * Profil und die Klardaten **erst nach der Zusage**.
 *
 * Diese Tests prüfen Anwendungscode und sind **nicht** die AÜG-Regeln; die
 * stehen als Gherkin in tests/aueg/ und werden hier nicht berührt.
 */
import { describe, expect, it } from 'vitest'
import { checkPermission, type ResourceRef } from '../authz/check'
import {
  CUSTOMER_TENANT,
  OPERATOR_TENANT,
  OTHER_CUSTOMER_TENANT,
  OTHER_SUPPLIER_TENANT,
  subject,
  SUPPLIER_TENANT,
} from '../testing/fixtures'
import { concealedFields, project, shows } from './projections'

/** Ein Profilvorschlag, wie ihn der Dienst beschreibt (lib/services/staffing.ts). */
const SUBMISSION = {
  submissionNumber: 'PV-2026-0004',
  pseudonym: 'Profil M.D. (Montage)',
  givenName: 'Marek',
  familyName: 'Dvořák',
  dateOfBirth: '1989-04-12',
  placeOfBirth: 'Pilsen',
  contactEmail: 'm.dvorak@rheinpersonal.example',
  contactPhone: '+49 000 000000',
  qualifications: 'Erfahrung Metallmontage',
  supplier: 'Rheinpersonal GmbH',
  candidateNumber: 'K-L-2001-1',
  availableFrom: '2027-02-15',
  disclosureLevel: 'pseudonymized',
  workerIdentityId: 'PI-0001',
  previousEmploymentExisted: 'nein',
}

const ASSIGNMENT = {
  assignmentNumber: 'E-2026-0001',
  customer: 'Südharz Logistik GmbH',
  site: 'Zentrallager Herzberg',
  costCenterNumber: 'KST-9100',
  supplier: 'Elbe Zeitarbeit GmbH',
  candidate: 'Ruth Delfs',
  activityDescription: 'Innerbetrieblicher Transport mit Frontstapler',
  agreedHourlyRate: '21.4000 EUR',
  customerHourlyRate: '27.4000 EUR',
  comparableWage: '17.8500 EUR',
  workerIdentityId: 'PI-0004',
}

function submissionRef(options: Partial<ResourceRef> = {}): ResourceRef {
  return {
    type: 'candidate',
    tenantId: SUPPLIER_TENANT,
    tenantType: 'supplier',
    supplierTenantId: SUPPLIER_TENANT,
    customerTenantId: CUSTOMER_TENANT,
    status: 'releasedToCustomer',
    disclosureLevel: 'pseudonymized',
    disclosedToTenantIds: [CUSTOMER_TENANT],
    ...options,
  }
}

function assignmentRef(options: Partial<ResourceRef> = {}): ResourceRef {
  return {
    type: 'assignment',
    tenantId: OPERATOR_TENANT,
    tenantType: 'operator',
    customerTenantId: CUSTOMER_TENANT,
    supplierTenantId: SUPPLIER_TENANT,
    siteId: 'site-1',
    costCenterId: 'cc-1',
    status: 'active',
    disclosedToTenantIds: [CUSTOMER_TENANT, SUPPLIER_TENANT],
    ...options,
  }
}

function identityRef(options: Partial<ResourceRef> = {}): ResourceRef {
  return {
    type: 'workerIdentity',
    tenantId: OPERATOR_TENANT,
    tenantType: 'operator',
    // **Keine** Offenlegung: Kunden und Lieferanten sehen das Objekt und seine
    // Existenz nicht ([43], 2.3 Regel 4).
    ...options,
  }
}

describe('6.4 — der Kunde sieht ein pseudonymisiertes Profil ([23])', () => {
  const decision = checkPermission(subject('demandOwner'), 'read', submissionRef())

  it('darf den vorgelegten Vorschlag lesen', () => {
    expect(decision.allowed).toBe(true)
  })

  it('sieht das Pseudonym, die Verfügbarkeit und die Qualifikationen', () => {
    const visible = project(SUBMISSION, decision)
    expect(visible?.pseudonym).toBe('Profil M.D. (Montage)')
    expect(visible?.availableFrom).toBe('2027-02-15')
    expect(visible?.qualifications).toBe('Erfahrung Metallmontage')
  })

  it('sieht **keine** Klardaten: Name, Geburtsdatum, Geburtsort, Kontaktdaten', () => {
    const visible = project(SUBMISSION, decision)
    if (visible === null) throw new Error('Der vorgelegte Vorschlag muss lesbar sein.')
    for (const field of [
      'givenName',
      'familyName',
      'dateOfBirth',
      'placeOfBirth',
      'contactEmail',
      'contactPhone',
    ]) {
      expect(shows(visible, field)).toBe(false)
    }
  })

  it('sieht die Personenidentität nicht — und erfährt nicht, dass es sie gibt ([43])', () => {
    const visible = project(SUBMISSION, decision)
    if (visible === null) throw new Error('Der vorgelegte Vorschlag muss lesbar sein.')
    expect(shows(visible, 'workerIdentityId')).toBe(false)
  })

  it('sieht die Lieferantenidentität nicht, solange Frage 11 offen ist', () => {
    const visible = project(SUBMISSION, decision)
    if (visible === null) throw new Error('Der vorgelegte Vorschlag muss lesbar sein.')
    expect(shows(visible, 'supplier')).toBe(false)
    expect(shows(visible, 'candidateNumber')).toBe(false)
  })

  it('die verdeckten Felder sind ausdrücklich benannt, nicht stillschweigend leer', () => {
    expect(concealedFields(decision)).toContain('familyName')
    expect(concealedFields(decision)).toContain('contactEmail')
  })
})

describe('6.4 — nach der Zusage sieht der Kunde die Klardaten', () => {
  const decision = checkPermission(
    subject('demandOwner'),
    'read',
    submissionRef({ status: 'accepted', disclosureLevel: 'identified' }),
  )

  it('darf den zugesagten Vorschlag lesen', () => {
    expect(decision.allowed).toBe(true)
  })

  it('sieht Name, Geburtsdatum und Kontaktdaten', () => {
    const visible = project(SUBMISSION, decision)
    expect(visible?.familyName).toBe('Dvořák')
    expect(visible?.dateOfBirth).toBe('1989-04-12')
    expect(visible?.contactEmail).toBe('m.dvorak@rheinpersonal.example')
  })

  it('sieht die Personenidentität **weiterhin** nicht: sie hängt nicht an der Zusage ([43])', () => {
    const visible = project(SUBMISSION, decision)
    if (visible === null) throw new Error('Der zugesagte Vorschlag muss lesbar sein.')
    expect(shows(visible, 'workerIdentityId')).toBe(false)
  })

  it('ohne Angabe der Offenlegungsstufe gilt die strengere Stufe', () => {
    const withoutLevel = checkPermission(subject('demandOwner'), 'read', {
      ...submissionRef(),
      disclosureLevel: undefined,
    })
    const visible = project(SUBMISSION, withoutLevel)
    if (visible === null) throw new Error('Der Vorschlag muss lesbar sein.')
    expect(shows(visible, 'familyName')).toBe(false)
  })
})

describe('2.3 — zwischen Lieferanten und zwischen Kunden', () => {
  it('der eigene Lieferant sieht seinen Vorschlag mit allen Angaben ([7])', () => {
    const decision = checkPermission(subject('supplierCoordinator'), 'read', submissionRef())
    const visible = project(SUBMISSION, decision)
    expect(visible?.familyName).toBe('Dvořák')
    expect(visible?.pseudonym).toBe('Profil M.D. (Montage)')
  })

  it('ein fremder Lieferant sieht den Vorschlag **nicht** — auch nicht pseudonymisiert', () => {
    const decision = checkPermission(
      subject('supplierCoordinator', { tenantId: OTHER_SUPPLIER_TENANT }),
      'read',
      submissionRef(),
    )
    expect(decision.allowed).toBe(false)
    expect(project(SUBMISSION, decision)).toBeNull()
  })

  it('ein fremder Kunde sieht den Vorschlag nicht', () => {
    const decision = checkPermission(
      subject('demandOwner', { tenantId: OTHER_CUSTOMER_TENANT }),
      'read',
      submissionRef(),
    )
    expect(decision.allowed).toBe(false)
  })

  it('der eigene Kunde sieht den Vorschlag erst, wenn er ihm vorgelegt wurde (4.2.3)', () => {
    const decision = checkPermission(
      subject('demandOwner'),
      'read',
      submissionRef({ status: 'submitted', disclosedToTenantIds: [] }),
    )
    expect(decision.allowed).toBe(false)
    if (!decision.allowed) {
      expect(decision.denial.specReference).toBe('SPEC 2.3, Grundsatz')
    }
  })

  it('der Genehmiger sieht Personendaten überhaupt nicht: 2.2 trägt für KG keine Zelle', () => {
    const decision = checkPermission(subject('approver'), 'read', submissionRef())
    expect(decision.allowed).toBe(false)
  })
})

describe('3.6 — die Personenidentität ist ausschließlich beim Betreiber ([43])', () => {
  it('der Betreiber liest sie', () => {
    expect(checkPermission(subject('operatorCoordinator'), 'read', identityRef()).allowed).toBe(
      true,
    )
  })

  it('der Betreiber verknüpft und trennt (Ä mit [43])', () => {
    expect(checkPermission(subject('operatorCoordinator'), 'update', identityRef()).allowed).toBe(
      true,
    )
  })

  it('der Kunde sieht sie nicht — die Mandantengrenze greift vor der Matrix', () => {
    const decision = checkPermission(subject('demandOwner'), 'read', identityRef())
    expect(decision).toMatchObject({
      allowed: false,
      denial: { kind: 'tenantBoundary', specReference: 'SPEC 2.3, Grundsatz' },
    })
  })

  it('der Lieferant sieht sie nicht', () => {
    const decision = checkPermission(subject('supplierCoordinator'), 'read', identityRef())
    expect(decision).toMatchObject({ allowed: false, denial: { kind: 'tenantBoundary' } })
  })

  it('sie hat kein Statusmodell: die Zeile trägt kein `S` (3.6)', () => {
    const decision = checkPermission(subject('operatorAdmin'), 'transition', identityRef())
    expect(decision).toMatchObject({ allowed: false, denial: { kind: 'noRolePermission' } })
  })
})

describe('3.7 — der Einsatz ist beiden Seiten zugänglich, jedem im eigenen Umfang', () => {
  it('der Kunde liest den Einsatz zu seinem eigenen Standort ([2])', () => {
    const decision = checkPermission(subject('demandOwner'), 'read', assignmentRef())
    expect(decision.allowed).toBe(true)
    expect(project(ASSIGNMENT, decision)?.activityDescription).toBe(
      'Innerbetrieblicher Transport mit Frontstapler',
    )
  })

  it('der Lieferant liest den eigenen Einsatz ([7])', () => {
    const decision = checkPermission(subject('supplierCoordinator'), 'read', assignmentRef())
    expect(decision.allowed).toBe(true)
    expect(project(ASSIGNMENT, decision)?.candidate).toBe('Ruth Delfs')
  })

  it('der Lieferant sieht **nicht** die Kostenstelle und nicht die Verkaufsseite (3.7, [42])', () => {
    const decision = checkPermission(subject('supplierCoordinator'), 'read', assignmentRef())
    const visible = project(ASSIGNMENT, decision)
    if (visible === null) throw new Error('Der eigene Einsatz muss lesbar sein.')
    expect(shows(visible, 'costCenterNumber')).toBe(false)
    expect(shows(visible, 'customerHourlyRate')).toBe(false)
    // Den eigenen Verrechnungssatz sieht er dagegen.
    expect(visible.agreedHourlyRate).toBe('21.4000 EUR')
  })

  it('der Kunde sieht **nicht** die Einkaufsseite ([41], 3.3) und nicht den Lieferanten (Frage 11)', () => {
    const decision = checkPermission(subject('demandOwner'), 'read', assignmentRef())
    const visible = project(ASSIGNMENT, decision)
    if (visible === null) throw new Error('Der eigene Einsatz muss lesbar sein.')
    expect(shows(visible, 'agreedHourlyRate')).toBe(false)
    expect(shows(visible, 'supplier')).toBe(false)
    // Die Kundenseite und die Kostenstelle sind seine eigenen Angaben.
    expect(visible.customerHourlyRate).toBe('27.4000 EUR')
    expect(visible.costCenterNumber).toBe('KST-9100')
  })

  it('keine Seite sieht die Personenidentität am Einsatz ([43])', () => {
    for (const role of ['demandOwner', 'supplierCoordinator'] as const) {
      const decision = checkPermission(subject(role), 'read', assignmentRef())
      const visible = project(ASSIGNMENT, decision)
      if (visible === null) throw new Error('Der Einsatz muss lesbar sein.')
      expect(shows(visible, 'workerIdentityId')).toBe(false)
    }
    // Der Betreiber sieht sie — sie ist seine Grundlage für 5.1.
    const operator = checkPermission(subject('operatorCoordinator'), 'read', assignmentRef())
    expect(project(ASSIGNMENT, operator)?.workerIdentityId).toBe('PI-0004')
  })

  it('ein fremder Kunde sieht ihn nicht', () => {
    const decision = checkPermission(
      subject('demandOwner', { tenantId: OTHER_CUSTOMER_TENANT }),
      'read',
      assignmentRef(),
    )
    expect(decision).toMatchObject({ allowed: false, denial: { kind: 'tenantBoundary' } })
  })

  it('ein fremder Lieferant sieht ihn nicht', () => {
    const decision = checkPermission(
      subject('supplierCoordinator', { tenantId: OTHER_SUPPLIER_TENANT }),
      'read',
      assignmentRef(),
    )
    expect(decision).toMatchObject({ allowed: false, denial: { kind: 'tenantBoundary' } })
  })

  it('der Lieferant ändert den Einsatz nicht: die Zeile gibt ihm nur `L` und `S[25]`', () => {
    const decision = checkPermission(subject('supplierCoordinator'), 'update', assignmentRef())
    expect(decision).toMatchObject({ allowed: false, denial: { kind: 'noRolePermission' } })
  })

  it('der Kunde ändert den Einsatz nicht — auch nicht, um eine Beendigung zu beantragen', () => {
    // Das ist die Lücke, die 4.3.2 am Ende benennt: der Antrag hat keinen
    // Zustand und die Zeile kein `Ä`. Siehe *offene Frage 39*.
    const decision = checkPermission(subject('demandOwner'), 'update', assignmentRef())
    expect(decision).toMatchObject({ allowed: false, denial: { kind: 'noRolePermission' } })
  })
})
