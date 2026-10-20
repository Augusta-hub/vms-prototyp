/**
 * Tests der Sichtbarkeit gegen SPEC 2.3 und die Fußnoten aus 2.2.
 *
 * Zwei Fragen je Fall: **darf** die Rolle den Vorgang sehen (Prüffunktion),
 * und **welche Felder** sieht sie dann (Projektion)? Beides zusammen ist die
 * Sichtbarkeitsregel; eine erlaubte Leseoperation ist noch keine vollständige
 * Fassung.
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

const DEMAND_REQUEST = {
  requestNumber: 'BA-2026-0001',
  title: 'Kommissionierung Wareneingang',
  activityDescription: 'Kommissionierung im Wareneingang, Halle 2',
  site: 'Werk Nord',
  costCenterNumber: 'KST-4711',
  internalNote: 'Budget steht nur bis Q3 bereit',
  maxHourlyRate: '24.5000',
  requestedBy: 'Sonja Hellwig',
}

const OFFER_ITEM = {
  qualificationLevel: 'Fachkraft Lager',
  headcount: '2',
  hourlyRate: '21.4000 EUR',
  rateDeviationReason: null,
}

const PERMIT = {
  permitNumber: 'AZ-2024-0815',
  issuingAuthority: 'Agentur für Arbeit Düsseldorf',
  permitType: 'unlimited',
  issuedOn: '2024-02-01',
  validFrom: '2024-02-01',
  validTo: null,
  restrictions: null,
  certificateDocumentRef: 'doc-urkunde-1',
  verificationStatus: 'accepted',
}

function demandRequestRef(options: Partial<ResourceRef> = {}): ResourceRef {
  return {
    type: 'demandRequest',
    tenantId: CUSTOMER_TENANT,
    tenantType: 'customer',
    customerTenantId: CUSTOMER_TENANT,
    siteId: 'site-1',
    costCenterId: 'cc-1',
    requestedById: 'user-demandOwner',
    status: 'tendered',
    engagementTenantIds: [SUPPLIER_TENANT],
    disclosedToTenantIds: [SUPPLIER_TENANT],
    ...options,
  }
}

function offerRef(options: Partial<ResourceRef> = {}): ResourceRef {
  return {
    type: 'supplierOffer',
    tenantId: SUPPLIER_TENANT,
    tenantType: 'supplier',
    supplierTenantId: SUPPLIER_TENANT,
    customerTenantId: CUSTOMER_TENANT,
    status: 'submitted',
    disclosedToTenantIds: [CUSTOMER_TENANT],
    ...options,
  }
}

function permitRef(options: Partial<ResourceRef> = {}): ResourceRef {
  return {
    type: 'supplierPermit',
    tenantId: SUPPLIER_TENANT,
    tenantType: 'supplier',
    supplierTenantId: SUPPLIER_TENANT,
    status: 'accepted',
    engagementTenantIds: [CUSTOMER_TENANT],
    disclosedToTenantIds: [CUSTOMER_TENANT],
    ...options,
  }
}

function rateCardRef(options: Partial<ResourceRef> = {}): ResourceRef {
  return {
    type: 'rateCard',
    tenantId: OPERATOR_TENANT,
    tenantType: 'operator',
    rateCardScope: 'supplierRateCard',
    supplierTenantId: SUPPLIER_TENANT,
    disclosedToTenantIds: [SUPPLIER_TENANT],
    ...options,
  }
}

describe('Der Lieferant sieht die Anfrage nur im Umfang von [14]', () => {
  const decision = checkPermission(subject('supplierCoordinator'), 'read', demandRequestRef())

  it('darf die eingeladene Anfrage lesen', () => {
    expect(decision.allowed).toBe(true)
  })

  it('sieht Tätigkeit und Standort', () => {
    const visible = project(DEMAND_REQUEST, decision)
    expect(visible?.activityDescription).toBe(DEMAND_REQUEST.activityDescription)
    expect(visible?.site).toBe('Werk Nord')
  })

  it('sieht weder Kostenstelle noch internen Vermerk noch Kostenrahmen', () => {
    const visible = project(DEMAND_REQUEST, decision)
    expect(visible).not.toBeNull()
    if (visible === null) return
    expect(shows(visible, 'costCenterNumber')).toBe(false)
    expect(shows(visible, 'internalNote')).toBe(false)
    expect(shows(visible, 'maxHourlyRate')).toBe(false)
    expect(concealedFields(decision)).toContain('costCenterNumber')
  })

  it('sieht keine Anfrage ohne eigene Einladung (2.3, Grundsatz)', () => {
    const withoutInvitation = checkPermission(
      subject('supplierCoordinator'),
      'read',
      demandRequestRef({ engagementTenantIds: [], disclosedToTenantIds: [] }),
    )
    expect(withoutInvitation.allowed).toBe(false)
    expect(project(DEMAND_REQUEST, withoutInvitation)).toBeNull()
  })

  it('sieht die Anfrage eines anderen Kunden nicht, auch mit Einladung bei Kunde 1', () => {
    const other = checkPermission(
      subject('supplierCoordinator'),
      'read',
      demandRequestRef({
        tenantId: OTHER_CUSTOMER_TENANT,
        customerTenantId: OTHER_CUSTOMER_TENANT,
        engagementTenantIds: [OTHER_SUPPLIER_TENANT],
        disclosedToTenantIds: [OTHER_SUPPLIER_TENANT],
      }),
    )
    expect(other.allowed).toBe(false)
  })
})

describe('Zwischen Lieferanten gibt es keinen Einblick (2.3)', () => {
  it('ein Lieferant liest das Angebot eines anderen Lieferanten nicht', () => {
    const decision = checkPermission(
      subject('supplierCoordinator', { tenantId: OTHER_SUPPLIER_TENANT }),
      'read',
      offerRef(),
    )
    expect(decision.allowed).toBe(false)
    expect(project(OFFER_ITEM, decision)).toBeNull()
  })

  it('ein Lieferant liest die Einkaufspreisliste eines anderen Lieferanten nicht ([9], [42])', () => {
    const decision = checkPermission(
      subject('supplierCoordinator', { tenantId: OTHER_SUPPLIER_TENANT }),
      'read',
      rateCardRef(),
    )
    expect(decision.allowed).toBe(false)
  })

  it('der eigene Lieferant liest die eigene Einkaufspreisliste', () => {
    const decision = checkPermission(subject('supplierCoordinator'), 'read', rateCardRef())
    expect(decision.allowed).toBe(true)
  })

  it('ein Lieferant liest die Kundenpreisliste nie ([42])', () => {
    const decision = checkPermission(
      subject('supplierCoordinator'),
      'read',
      rateCardRef({
        rateCardScope: 'customerRateCard',
        customerTenantId: CUSTOMER_TENANT,
        disclosedToTenantIds: [CUSTOMER_TENANT, SUPPLIER_TENANT],
      }),
    )
    expect(decision.allowed).toBe(false)
  })
})

describe('Der Kunde sieht keine Einkaufskonditionen (3.3, [18], [41])', () => {
  it('KB liest die fachlichen Inhalte des Angebots, aber nicht den Verrechnungssatz', () => {
    const decision = checkPermission(subject('demandOwner'), 'read', offerRef())
    expect(decision.allowed).toBe(true)
    const visible = project(OFFER_ITEM, decision)
    expect(visible).not.toBeNull()
    if (visible === null) return
    expect(visible.qualificationLevel).toBe('Fachkraft Lager')
    expect(shows(visible, 'hourlyRate')).toBe(false)
    expect(shows(visible, 'rateDeviationReason')).toBe(false)
  })

  it('KE liest die Einkaufspreisliste nicht ([41] verlangt die Kundenseite)', () => {
    const decision = checkPermission(subject('procurementController'), 'read', rateCardRef())
    expect(decision.allowed).toBe(false)
  })

  it('KE liest die Kundenpreisliste des eigenen Kunden', () => {
    const decision = checkPermission(
      subject('procurementController'),
      'read',
      rateCardRef({
        rateCardScope: 'customerRateCard',
        customerTenantId: CUSTOMER_TENANT,
        supplierTenantId: undefined,
        disclosedToTenantIds: [CUSTOMER_TENANT],
      }),
    )
    expect(decision.allowed).toBe(true)
  })

  it('KE liest die Kundenpreisliste eines anderen Kunden nicht', () => {
    const decision = checkPermission(
      subject('procurementController'),
      'read',
      rateCardRef({
        rateCardScope: 'customerRateCard',
        customerTenantId: OTHER_CUSTOMER_TENANT,
        supplierTenantId: undefined,
        disclosedToTenantIds: [OTHER_CUSTOMER_TENANT],
      }),
    )
    expect(decision.allowed).toBe(false)
  })
})

describe('Die AÜG-Erlaubnis gegenüber dem Kunden ([36], 3.2)', () => {
  it('KE sieht nur Gültigkeitsstatus und Ablaufdatum, nicht die Urkunde', () => {
    const decision = checkPermission(subject('procurementController'), 'read', permitRef())
    expect(decision.allowed).toBe(true)
    const visible = project(PERMIT, decision)
    expect(visible).not.toBeNull()
    if (visible === null) return
    expect(visible.verificationStatus).toBe('accepted')
    expect(shows(visible, 'validTo')).toBe(true)
    expect(shows(visible, 'certificateDocumentRef')).toBe(false)
    expect(shows(visible, 'permitNumber')).toBe(false)
    expect(shows(visible, 'issuingAuthority')).toBe(false)
  })

  it('KE sieht die Erlaubnis eines nicht beauftragten Lieferanten nicht', () => {
    const decision = checkPermission(
      subject('procurementController'),
      'read',
      permitRef({ engagementTenantIds: [], disclosedToTenantIds: [] }),
    )
    expect(decision.allowed).toBe(false)
  })

  it('der Bedarfsträger sieht die Erlaubnis nicht — die Zeile trägt für KB kein Recht', () => {
    const decision = checkPermission(subject('demandOwner'), 'read', permitRef())
    expect(decision.allowed).toBe(false)
  })

  it('der eigene Lieferantenadministrator sieht die Urkunde', () => {
    const decision = checkPermission(subject('supplierAdmin'), 'read', permitRef())
    expect(decision.allowed).toBe(true)
    const visible = project(PERMIT, decision)
    expect(visible?.certificateDocumentRef).toBe('doc-urkunde-1')
  })
})

describe('Mandantengrenze vor Rollenrecht (2.3, Grundsatz)', () => {
  it('der Bedarfsträger eines anderen Kunden sieht die Anfrage nicht', () => {
    const decision = checkPermission(
      subject('demandOwner', { tenantId: OTHER_CUSTOMER_TENANT }),
      'read',
      demandRequestRef(),
    )
    expect(decision.allowed).toBe(false)
    expect(project(DEMAND_REQUEST, decision)).toBeNull()
  })

  it('der Betreiber sieht die Anfrage vollständig und mandantenübergreifend', () => {
    const decision = checkPermission(subject('operatorCoordinator'), 'read', demandRequestRef())
    expect(decision).toMatchObject({ allowed: true, crossTenant: true })
    const visible = project(DEMAND_REQUEST, decision)
    expect(visible).toEqual(DEMAND_REQUEST)
    expect(concealedFields(decision)).toEqual([])
  })

  it('die Betreuungszuordnung schränkt die Querschnittssicht ein (2.3, Bedingung 2)', () => {
    const decision = checkPermission(
      subject('operatorCoordinator', {
        accountAssignmentCustomerTenantIds: [OTHER_CUSTOMER_TENANT],
      }),
      'read',
      demandRequestRef(),
    )
    expect(decision.allowed).toBe(false)
  })

  it('auch am Betreiberobjekt wirkt die Betreuungszuordnung über den betroffenen Kunden', () => {
    const decision = checkPermission(
      subject('operatorCoordinator', {
        accountAssignmentCustomerTenantIds: [OTHER_CUSTOMER_TENANT],
      }),
      'read',
      { type: 'tender', tenantId: OPERATOR_TENANT, tenantType: 'operator', customerTenantId: CUSTOMER_TENANT },
    )
    expect(decision.allowed).toBe(false)
  })
})
