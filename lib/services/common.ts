/**
 * Gemeinsame Teile der Fachdienste: Ergebnis einer Handlung, Beauftragung und
 * die Übersetzung eines Datensatzes in einen `ResourceRef` der Prüffunktion.
 *
 * **Jeder** Zugriff der Dienste läuft über `checkPermission`
 * (lib/authz/check.ts). Diese Datei baut nur die Angaben zusammen, die die
 * Prüffunktion und die Fußnoten aus 2.2 brauchen — sie entscheidet nichts.
 */
import type { ResourceRef } from '../authz/check'
import type { TenantType } from '../authz/roles'
import { prisma } from '../prisma'

/** Ergebnis einer schreibenden Handlung, für Oberfläche und Protokoll. */
export type ActionResult =
  | { readonly ok: true; readonly message: string }
  | { readonly ok: false; readonly error: string; readonly specReference?: string }

export function failure(error: string, specReference?: string): ActionResult {
  return specReference === undefined ? { ok: false, error } : { ok: false, error, specReference }
}

export function success(message: string): ActionResult {
  return { ok: true, message }
}

/** Wird in einer Transaktion geworfen, damit ein verweigerter Zugriff zurückrollt. */
export class PermissionDenied extends Error {
  constructor(
    reason: string,
    readonly specReference: string,
  ) {
    super(reason)
    this.name = 'PermissionDenied'
  }
}

/**
 * Ein Fehler beim Schreiben als Ergebnis — ein verweigerter Zugriff behält
 * seine Begründung aus der Prüffunktion.
 */
export function asFailure(error: unknown, prefix: string): ActionResult {
  if (error instanceof PermissionDenied) {
    return failure(error.message, error.specReference)
  }
  const detail = error instanceof Error ? error.message.split('\n')[0] : String(error)
  return failure(`${prefix}: ${detail ?? 'unbekannter Fehler'}`)
}

/**
 * Beauftragungen zwischen Kunden- und Lieferantenmandanten.
 *
 * Die Fußnoten [3], [6] und [36] in 2.2 setzen voraus, dass „eine eigene
 * Beauftragung besteht". **Ein Objekt dafür führt Kapitel 3 nicht.** Der
 * Prototyp leitet die Beauftragung deshalb aus den Einladungen ab: ein
 * Lieferant, der zu einer Anfrage eines Kunden eingeladen ist, gilt für diesen
 * Kunden als beauftragt. Mit 3.7 käme der Einsatz als zweite, stärkere
 * Grundlage hinzu.
 *
 * Woran sich die Beauftragung fachlich bemisst, ist **offene Frage 36** — die
 * Ableitung ist hier an einer Stelle gekapselt, damit eine Antwort nur diese
 * Funktion ändert.
 */
export interface Engagements {
  readonly supplierTenantIdsByCustomerTenantId: ReadonlyMap<string, readonly string[]>
  readonly customerTenantIdsBySupplierTenantId: ReadonlyMap<string, readonly string[]>
  /**
   * Beauftragung je **Standort**: Fußnote [3] spricht von „Kunden und
   * Standorte, für die eine eigene Beauftragung besteht" — ein Lieferant sieht
   * deshalb nur die Standorte, zu denen er eingeladen ist, nicht alle
   * Standorte des Kunden.
   */
  readonly supplierTenantIdsBySiteId: ReadonlyMap<string, readonly string[]>
}

export async function loadEngagements(): Promise<Engagements> {
  const invitations = await prisma.tenderInvitation.findMany({
    select: {
      supplier: { select: { tenantId: true } },
      tender: {
        select: { demandRequest: { select: { tenantId: true, siteId: true } } },
      },
    },
  })

  const byCustomer = new Map<string, string[]>()
  const bySupplier = new Map<string, string[]>()
  const bySite = new Map<string, string[]>()
  for (const invitation of invitations) {
    const customerTenantId = invitation.tender.demandRequest.tenantId
    const supplierTenantId = invitation.supplier.tenantId
    addOnce(byCustomer, customerTenantId, supplierTenantId)
    addOnce(bySupplier, supplierTenantId, customerTenantId)
    addOnce(bySite, invitation.tender.demandRequest.siteId, supplierTenantId)
  }
  return {
    supplierTenantIdsByCustomerTenantId: byCustomer,
    customerTenantIdsBySupplierTenantId: bySupplier,
    supplierTenantIdsBySiteId: bySite,
  }
}

function addOnce(map: Map<string, string[]>, key: string, value: string): void {
  const existing = map.get(key)
  if (existing === undefined) {
    map.set(key, [value])
    return
  }
  if (!existing.includes(value)) existing.push(value)
}

export function engagedSuppliers(engagements: Engagements, customerTenantId: string): readonly string[] {
  return engagements.supplierTenantIdsByCustomerTenantId.get(customerTenantId) ?? []
}

export function engagedCustomers(engagements: Engagements, supplierTenantId: string): readonly string[] {
  return engagements.customerTenantIdsBySupplierTenantId.get(supplierTenantId) ?? []
}

export function engagedSuppliersForSite(
  engagements: Engagements,
  siteId: string,
): readonly string[] {
  return engagements.supplierTenantIdsBySiteId.get(siteId) ?? []
}

// ── Objekt → ResourceRef ───────────────────────────────────────────────────
//
// Jeder Bauer nennt ausdrücklich, welchem Mandanten der Vorgang gehört, welchen
// Kunden und welchen Lieferanten er betrifft und wem er nach Kapitel 2 und 3
// ausdrücklich zugänglich ist (`disclosedToTenantIds`, siehe check.ts).

export function customerRef(
  customer: { readonly tenantId: string },
  engagements: Engagements,
): ResourceRef {
  const engaged = engagedSuppliers(engagements, customer.tenantId)
  return {
    type: 'customer',
    tenantId: customer.tenantId,
    tenantType: 'customer',
    customerTenantId: customer.tenantId,
    engagementTenantIds: engaged,
    // 2.2 gibt dem Lieferanten `L[3]` auf den Kunden seiner Beauftragung; die
    // Mandantengrenze lässt das nur, weil die Matrix es ausdrücklich erlaubt.
    disclosedToTenantIds: engaged,
  }
}

export function siteRef(
  site: { readonly id: string; readonly tenantId: string },
  engagements: Engagements,
): ResourceRef {
  // Je **Standort**, nicht je Kunde: [3] nennt „Kunden und Standorte, für die
  // eine eigene Beauftragung besteht".
  const engaged = engagedSuppliersForSite(engagements, site.id)
  return {
    type: 'site',
    tenantId: site.tenantId,
    tenantType: 'customer',
    customerTenantId: site.tenantId,
    siteId: site.id,
    engagementTenantIds: engaged,
    disclosedToTenantIds: engaged,
  }
}

export function costCenterRef(costCenter: {
  readonly id: string
  readonly tenantId: string
  readonly siteId: string | null
}): ResourceRef {
  return {
    type: 'costCenter',
    tenantId: costCenter.tenantId,
    tenantType: 'customer',
    customerTenantId: costCenter.tenantId,
    costCenterId: costCenter.id,
    ...(costCenter.siteId !== null ? { siteId: costCenter.siteId } : {}),
  }
}

export function supplierRef(
  supplier: { readonly tenantId: string; readonly status: string },
  engagements: Engagements,
): ResourceRef {
  return {
    type: 'supplier',
    tenantId: supplier.tenantId,
    tenantType: 'supplier',
    supplierTenantId: supplier.tenantId,
    status: supplier.status,
    engagementTenantIds: engagedCustomers(engagements, supplier.tenantId),
    // Der Kunde sieht den für ihn beauftragten Lieferanten ([6]); die
    // Mandantengrenze lässt das nur, weil 2.2 es ausdrücklich erlaubt.
    disclosedToTenantIds: engagedCustomers(engagements, supplier.tenantId),
  }
}

export function supplierPermitRef(
  permit: {
    readonly tenantId: string
    readonly verificationStatus: string
  },
  engagements: Engagements,
): ResourceRef {
  const engaged = engagedCustomers(engagements, permit.tenantId)
  return {
    type: 'supplierPermit',
    tenantId: permit.tenantId,
    tenantType: 'supplier',
    supplierTenantId: permit.tenantId,
    // Der Anerkennungsstatus ist der Status, auf den sich [37] bezieht.
    status: permit.verificationStatus,
    engagementTenantIds: engaged,
    disclosedToTenantIds: engaged,
  }
}

export function masterAgreementRef(agreement: {
  readonly tenantId: string
  readonly status: string
  readonly customerTenant: string | null
  readonly supplierTenant: string | null
}): ResourceRef {
  const disclosed = [agreement.customerTenant, agreement.supplierTenant].filter(
    (tenantId): tenantId is string => tenantId !== null,
  )
  return {
    type: 'masterAgreement',
    tenantId: agreement.tenantId,
    tenantType: 'operator',
    status: agreement.status,
    ...(agreement.customerTenant !== null ? { customerTenantId: agreement.customerTenant } : {}),
    ...(agreement.supplierTenant !== null ? { supplierTenantId: agreement.supplierTenant } : {}),
    disclosedToTenantIds: disclosed,
  }
}

export function rateCardRef(rateCard: {
  readonly tenantId: string
  readonly status: string
  readonly rateCardScope: 'supplierRateCard' | 'customerRateCard'
  readonly customerTenant: string | null
  readonly supplierTenant: string | null
}): ResourceRef {
  const disclosed = [rateCard.customerTenant, rateCard.supplierTenant].filter(
    (tenantId): tenantId is string => tenantId !== null,
  )
  return {
    type: 'rateCard',
    tenantId: rateCard.tenantId,
    tenantType: 'operator',
    status: rateCard.status,
    rateCardScope: rateCard.rateCardScope,
    ...(rateCard.customerTenant !== null ? { customerTenantId: rateCard.customerTenant } : {}),
    ...(rateCard.supplierTenant !== null ? { supplierTenantId: rateCard.supplierTenant } : {}),
    disclosedToTenantIds: disclosed,
  }
}

export function collectiveAgreementRef(assignment: {
  readonly tenantId: string
  readonly customerTenant: string | null
  readonly supplierTenant: string | null
}): ResourceRef {
  const disclosed = [assignment.customerTenant, assignment.supplierTenant].filter(
    (tenantId): tenantId is string => tenantId !== null,
  )
  return {
    type: 'collectiveAgreementAssignment',
    tenantId: assignment.tenantId,
    tenantType: 'operator',
    ...(assignment.customerTenant !== null
      ? { customerTenantId: assignment.customerTenant }
      : {}),
    ...(assignment.supplierTenant !== null
      ? { supplierTenantId: assignment.supplierTenant }
      : {}),
    disclosedToTenantIds: disclosed,
  }
}

export function comparableWageRef(entry: {
  readonly tenantId: string
  readonly siteId: string
}): ResourceRef {
  return {
    type: 'comparableWageEntry',
    tenantId: entry.tenantId,
    tenantType: 'customer',
    customerTenantId: entry.tenantId,
    siteId: entry.siteId,
  }
}

export function demandRequestRef(
  request: {
    readonly tenantId: string
    readonly siteId: string
    readonly costCenterId: string
    readonly requestedById: string
    readonly status: string
  },
  invitedSupplierTenantIds: readonly string[],
): ResourceRef {
  return {
    type: 'demandRequest',
    tenantId: request.tenantId,
    tenantType: 'customer',
    customerTenantId: request.tenantId,
    siteId: request.siteId,
    costCenterId: request.costCenterId,
    requestedById: request.requestedById,
    status: request.status,
    // Der eingeladene Lieferant sieht die Anfrage im Umfang von [14]; die
    // Beauftragung ist genau diese Einladung.
    engagementTenantIds: invitedSupplierTenantIds,
    disclosedToTenantIds: invitedSupplierTenantIds,
  }
}

export function tenderRef(tender: {
  readonly tenantId: string
  readonly customerTenantId: string
}): ResourceRef {
  return {
    type: 'tender',
    tenantId: tender.tenantId,
    tenantType: 'operator',
    customerTenantId: tender.customerTenantId,
    // Der Kunde sieht Stand und Fortschritt zur **eigenen** Anfrage ([15]).
    disclosedToTenantIds: [tender.customerTenantId],
  }
}

export function tenderInvitationRef(invitation: {
  readonly tenantId: string
  readonly customerTenantId: string
  readonly supplierTenantId: string
  readonly invitationStatus: string
}): ResourceRef {
  return {
    // Die Einladung teilt die Matrixzeile der Ausschreibung (2.2, Lesart).
    type: 'tender',
    tenantId: invitation.tenantId,
    tenantType: 'operator',
    customerTenantId: invitation.customerTenantId,
    supplierTenantId: invitation.supplierTenantId,
    status: invitation.invitationStatus,
    disclosedToTenantIds: [invitation.customerTenantId, invitation.supplierTenantId],
  }
}

export function supplierOfferRef(offer: {
  readonly tenantId: string
  readonly customerTenantId: string
  readonly status: string
}): ResourceRef {
  return {
    type: 'supplierOffer',
    tenantId: offer.tenantId,
    tenantType: 'supplier',
    supplierTenantId: offer.tenantId,
    customerTenantId: offer.customerTenantId,
    status: offer.status,
    // Der Kunde sieht die fachlichen Inhalte im Umfang von [18].
    disclosedToTenantIds: [offer.customerTenantId],
  }
}

/** Mandantentyp eines Mandanten, für die Bauer oben. */
export function tenantTypeOf(tenantType: string): TenantType {
  return tenantType as TenantType
}
