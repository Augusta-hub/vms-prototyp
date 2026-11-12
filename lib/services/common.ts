/**
 * Gemeinsame Teile der Fachdienste: Ergebnis einer Handlung, Beauftragung und
 * die Übersetzung eines Datensatzes in einen `ResourceRef` der Prüffunktion.
 *
 * **Jeder** Zugriff der Dienste läuft über `checkPermission`
 * (lib/authz/check.ts). Diese Datei baut nur die Angaben zusammen, die die
 * Prüffunktion und die Fußnoten aus 2.2 brauchen — sie entscheidet nichts.
 */
import {
  verweigerungsEintrag,
  type AuditOperation,
  type Protokollbezug,
} from '../audit/entry'
import { protokolliereGetrennt } from '../audit/record'
import type { Decision, ResourceRef } from '../authz/check'
import type { ModelName } from '../authz/resources'
import type { RoleCode, TenantType } from '../authz/roles'
import type { LoadedIdentity } from '../identity/loadSubject'
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
 * Wird in einer Transaktion geworfen, wenn ein **Übergang** aus Kapitel 4
 * abgelehnt wurde — eine Vorbedingung, eine nicht auslösende Rolle, ein
 * Zustand, aus dem der Übergang nicht führt.
 *
 * Getrennt von `PermissionDenied`, weil die beiden fachlich verschieden sind:
 * ein verweigerter **Zugriff** ist eine Aussage über Rechte (2.2, 2.3), eine
 * abgelehnte **Handlung** eine über den Vorgang (4.0). Beide müssen aus einer
 * Transaktion heraus zurückrollen, deshalb sind beide Fehler.
 */
export class TransitionRejected extends Error {
  constructor(
    reason: string,
    readonly specReference: string,
  ) {
    super(reason)
    this.name = 'TransitionRejected'
  }
}

/**
 * Ein Fehler beim Schreiben als Ergebnis — ein verweigerter Zugriff und eine
 * abgelehnte Handlung behalten ihre Begründung samt Fundstelle.
 */
export function asFailure(error: unknown, prefix: string): ActionResult {
  if (error instanceof PermissionDenied || error instanceof TransitionRejected) {
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
 * Prototyp leitet die Beauftragung deshalb aus zwei Quellen ab: aus den
 * **Einladungen** (ein Lieferant, der zu einer Anfrage eines Kunden eingeladen
 * ist, gilt für diesen Kunden als beauftragt) und — seit 3.7 — aus den
 * **Einsätzen**, der stärkeren Grundlage: wer eine Person an einen Standort
 * überlässt, ist dort beauftragt, auch wenn die Einladung längst abgelaufen
 * ist.
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

  // Zweite Quelle seit 3.7: der Einsatz. Er benennt Kunde, Standort und
  // Lieferant unmittelbar und überdauert die Ausschreibung.
  const assignments = await prisma.assignment.findMany({
    select: {
      siteId: true,
      customer: { select: { tenantId: true } },
      supplier: { select: { tenantId: true } },
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
  for (const assignment of assignments) {
    const customerTenantId = assignment.customer.tenantId
    const supplierTenantId = assignment.supplier.tenantId
    addOnce(byCustomer, customerTenantId, supplierTenantId)
    addOnce(bySupplier, supplierTenantId, customerTenantId)
    addOnce(bySite, assignment.siteId, supplierTenantId)
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

// ── 3.6 und 3.7: Kandidat, Profilvorschlag, Personenidentität, Einsatz ─────

/**
 * Kandidat (3.6). Mandant ist der **Lieferant**; der Kunde sieht den
 * Kandidaten nie unmittelbar, sondern nur über den Profilvorschlag im Umfang
 * der Datenminimierung ([23], 6.4) — deshalb steht hier **kein**
 * Kundenmandant in `disclosedToTenantIds`.
 */
export function candidateRef(candidate: {
  readonly tenantId: string
  readonly status: string
}): ResourceRef {
  return {
    type: 'candidate',
    tenantId: candidate.tenantId,
    tenantType: 'supplier',
    supplierTenantId: candidate.tenantId,
    status: candidate.status,
  }
}

/**
 * Profilvorschlag (3.6). Er teilt die Matrixzeile des Kandidaten (2.2) und
 * gehört dem Lieferantenmandanten.
 *
 * **Dem Kunden zugänglich erst nach der Vorlage.** 4.2.3 ist dazu eindeutig:
 * mit `draft` → `submitted` wird der Vorschlag „für den Betreiber sichtbar, für
 * den Kunden **nicht**"; erst `reviewed` → `releasedToCustomer` macht ihn dem
 * Bedarfsträger zugänglich. Maßgeblich ist deshalb `releasedToCustomerAt` und
 * nicht der Status allein — so bleibt ein später abgelehnter oder
 * zurückgezogener Vorschlag für den Kunden sichtbar, den er entschieden hat.
 *
 * `disclosureLevel` trägt die Datenminimierung aus 6.4 in die Fußnote [23].
 */
export function candidateSubmissionRef(submission: {
  readonly tenantId: string
  readonly customerTenantId: string
  readonly status: string
  readonly disclosureLevel: 'pseudonymized' | 'identified'
  readonly releasedToCustomerAt: Date | null
}): ResourceRef {
  return {
    type: 'candidate',
    tenantId: submission.tenantId,
    tenantType: 'supplier',
    supplierTenantId: submission.tenantId,
    customerTenantId: submission.customerTenantId,
    status: submission.status,
    disclosureLevel: submission.disclosureLevel,
    disclosedToTenantIds:
      submission.releasedToCustomerAt === null ? [] : [submission.customerTenantId],
  }
}

/**
 * Personenidentität (3.6). **Keine** Offenlegung an andere Mandanten: Kunden
 * und Lieferanten sehen das Objekt und seine Existenz nicht ([43], 2.3
 * Regel 4). `disclosedToTenantIds` bleibt deshalb leer — und die
 * Mandantengrenze verweigert jeden Zugriff von außerhalb des Betreibers, noch
 * vor der Matrix.
 */
export function workerIdentityRef(identity: { readonly tenantId: string }): ResourceRef {
  return {
    type: 'workerIdentity',
    tenantId: identity.tenantId,
    tenantType: 'operator',
  }
}

/**
 * Einsatz (3.7). Mandant ist der **Betreiber**; der Vorgang ist gleichzeitig
 * dem Kunden und dem Lieferanten zugänglich, jedem nur im eigenen Umfang
 * ([2], [7]).
 */
export function assignmentRef(assignment: {
  readonly tenantId: string
  readonly customerTenantId: string
  readonly supplierTenantId: string
  readonly siteId: string
  readonly costCenterId: string
  readonly status: string
}): ResourceRef {
  return {
    type: 'assignment',
    tenantId: assignment.tenantId,
    tenantType: 'operator',
    customerTenantId: assignment.customerTenantId,
    supplierTenantId: assignment.supplierTenantId,
    siteId: assignment.siteId,
    costCenterId: assignment.costCenterId,
    status: assignment.status,
    disclosedToTenantIds: [assignment.customerTenantId, assignment.supplierTenantId],
  }
}

/**
 * Verlängerung und Unterbrechung (3.7) teilen die Matrixzeile des Einsatzes
 * (2.2, Lesart) und dessen Mandanten. `status` ist der Status **des
 * Unterobjekts**, damit die Fußnoten [25] und [26] den Zielstatus des
 * Verlängerungsvorgangs sehen und nicht den des Einsatzes.
 */
export function assignmentSubObjectRef(
  assignment: {
    readonly tenantId: string
    readonly customerTenantId: string
    readonly supplierTenantId: string
    readonly siteId: string
    readonly costCenterId: string
  },
  status: string,
): ResourceRef {
  return { ...assignmentRef({ ...assignment, status }), status }
}

// ── 3.10: Dokument / Nachweis ──────────────────────────────────────────────

/**
 * Dokument (3.10). Der Mandant **folgt dem Bezugsobjekt** — die Urkunde gehört
 * dem Lieferanten, die Unterweisung dem Einsatz (und damit dem Betreiber), die
 * Vertragsunterlage dem Rahmenvertrag (ebenfalls Betreiber).
 *
 * **Die Offenlegung folgt der Sichtbarkeitsklasse** (`confidentiality`, 3.10).
 * Sie ist nach 3.10 die Umsetzung von [35] und [36] und entscheidet hier, wen
 * die Mandantengrenze überhaupt an den Vorgang heranlässt:
 *
 *  - `operatorOnly`: niemand außerhalb des Mandanten des Dokuments.
 *  - `operatorAndOwner`: zusätzlich der **Einsteller** (3.10: „Eigentümer ist,
 *    wer das Dokument eingestellt hat") — nötig, weil ein Nachweis am Einsatz
 *    dem Betreiber gehört, eingestellt aber vom Lieferanten wurde.
 *  - `assignmentParties`: zusätzlich Kunde und Lieferant des Einsatzes.
 *
 * Die Grenze lässt damit heran, die Fußnote entscheidet danach: [35] verlangt
 * für `KB` zusätzlich, dass es keine Vertragsunterlage des Lieferanten ist,
 * [36] für `KE`, dass es die AÜG-Erlaubnis ist und eine Beauftragung besteht.
 * `status` ist der **Anerkennungsstatus** — der Status, auf den [37] und der
 * Fluss aus 5.4.3 sich beziehen.
 */
export function documentRef(
  document: {
    readonly tenantId: string
    readonly tenantType: TenantType
    readonly documentCategory: string
    readonly confidentiality: 'operatorOnly' | 'operatorAndOwner' | 'assignmentParties'
    readonly verificationStatus: string
    /**
     * Mandant des Einstellers (3.10, Eigentümer). **Nur bei einem bestehenden
     * Dokument** anzugeben: beim Einstellen wäre es der Handelnde selbst, und
     * eine Offenlegung, die sich der Zugreifende selbst erteilt, ist keine.
     */
    readonly ownerTenantId: string | null
    /**
     * Die Kundenmandanten, zu denen dieser Nachweis **einsatzbezogen** ist —
     * die Grundlage von [35] („zum eigenen Kunden") und von [36] („der
     * beauftragten Lieferanten"). Je Bezugsobjekt verschieden eng: beim
     * Einsatz dessen Kunde, beim Kandidaten die Kunden seiner Einsätze, beim
     * Standort der eigene Kunde. Dass Kapitel 3 für die „Beauftragung" kein
     * Objekt führt, ist *offene Frage 36*; diese Ableitung ist die engste, die
     * der Wortlaut zulässt.
     */
    readonly customerTenantIds: readonly string[]
    readonly supplierTenantId: string | null
    readonly siteId: string | null
    readonly uploadedById: string | null
  },
  engagements: Engagements,
): ResourceRef {
  // Die Beauftragung für [36] bemisst sich am **Lieferanten** des Nachweises:
  // „die AÜG-Erlaubnis der beauftragten Lieferanten".
  const engaged = new Set<string>(document.customerTenantIds)
  if (document.supplierTenantId !== null) {
    for (const tenantId of engagedCustomers(engagements, document.supplierTenantId)) {
      engaged.add(tenantId)
    }
  }

  const disclosed = new Set<string>()
  if (document.confidentiality !== 'operatorOnly' && document.ownerTenantId !== null) {
    disclosed.add(document.ownerTenantId)
  }
  if (document.confidentiality === 'assignmentParties') {
    for (const tenantId of document.customerTenantIds) disclosed.add(tenantId)
    if (document.supplierTenantId !== null) disclosed.add(document.supplierTenantId)
  }
  // Die **Erlaubnisurkunde** ist der eine Nachweis, den der Kunde unabhängig
  // von der Sichtbarkeitsklasse erreicht: 2.2 gibt `KE` ausdrücklich `L[36]`,
  // und 3.10 sagt denselben Satz — „beim Lieferanten nur den Gültigkeitsstatus
  // der AÜG-Erlaubnis ohne Urkundeninhalte". Die Grenze lässt ihn deshalb
  // heran; **was** er sieht, beschneidet die Fußnote auf Anerkennungsstatus und
  // Ablaufdatum.
  if (document.documentCategory === 'permitCertificate') {
    for (const tenantId of engaged) disclosed.add(tenantId)
  }
  disclosed.delete(document.tenantId)

  return {
    type: 'document',
    tenantId: document.tenantId,
    tenantType: document.tenantType,
    documentCategory: document.documentCategory,
    confidentiality: document.confidentiality,
    status: document.verificationStatus,
    ...(document.supplierTenantId !== null
      ? { supplierTenantId: document.supplierTenantId }
      : {}),
    ...(document.siteId !== null ? { siteId: document.siteId } : {}),
    ...(document.uploadedById !== null ? { createdById: document.uploadedById } : {}),
    engagementTenantIds: [...engaged],
    disclosedToTenantIds: [...disclosed],
  }
}

/**
 * Stundenzettel (3.8) als Vorgang der Prüffunktion.
 *
 * Der Zettel gehört dem **Betreibermandanten** — er verbindet beide Seiten und
 * ist Grundlage beider Belegseiten (3.8, 3.9). Trotzdem geben ihm 2.2 die
 * Kundenseite (`L[2] S[29]`) und die Lieferantenseite (`A[27] L[7] Ä[28]
 * S[20]`) frei: das ist die ausdrückliche Ausnahme von der Mandantengrenze aus
 * 2.3, dieselbe Lage wie bei Einladung und Angebot (3.5). Deshalb trägt er
 * `disclosedToTenantIds`.
 *
 * `openApprovalRoleCode` ist die Rolle der **offenen** Freigabestufe und
 * Grundlage von [29]: nur sie entscheidet ihre Stufe (4.4).
 */
export function timesheetRef(timesheet: {
  readonly tenantId: string
  readonly customerTenantId: string
  readonly supplierTenantId: string
  readonly status: string
  readonly recordedById: string
  readonly submittedById: string | null
  readonly openApprovalRoleCode?: RoleCode | null
  readonly siteId?: string | null
  readonly costCenterId?: string | null
}): ResourceRef {
  return {
    type: 'timesheet',
    tenantId: timesheet.tenantId,
    tenantType: 'operator',
    customerTenantId: timesheet.customerTenantId,
    supplierTenantId: timesheet.supplierTenantId,
    status: timesheet.status,
    // Erfasser und Einreicher tragen das Vier-Augen-Prinzip in [29] (2.4,
    // Regel 5). `createdById` ist dort der **Erfasser** (`recordedBy`, 3.8).
    createdById: timesheet.recordedById,
    ...(timesheet.submittedById !== null ? { submittedById: timesheet.submittedById } : {}),
    ...(timesheet.openApprovalRoleCode !== null && timesheet.openApprovalRoleCode !== undefined
      ? { openApprovalRoleCode: timesheet.openApprovalRoleCode }
      : {}),
    ...(timesheet.siteId !== null && timesheet.siteId !== undefined
      ? { siteId: timesheet.siteId }
      : {}),
    ...(timesheet.costCenterId !== null && timesheet.costCenterId !== undefined
      ? { costCenterId: timesheet.costCenterId }
      : {}),
    disclosedToTenantIds: [timesheet.customerTenantId, timesheet.supplierTenantId],
  }
}

/**
 * Zeitposition (3.8) als Vorgang.
 *
 * `status` trägt den Zustand des **Stundenzettels**: die Position hat keinen
 * eigenen ([44], 3.8). Darauf beruhen [28] (keine Änderung nach der
 * Genehmigung) und [44] (Entfernen nur vor der Einreichung).
 */
export function timeEntryRef(entry: {
  readonly tenantId: string
  readonly customerTenantId: string
  readonly supplierTenantId: string
  readonly timesheetStatus: string
  readonly recordedById: string
  readonly siteId?: string | null
  readonly costCenterId?: string | null
}): ResourceRef {
  return {
    type: 'timeEntry',
    tenantId: entry.tenantId,
    tenantType: 'operator',
    customerTenantId: entry.customerTenantId,
    supplierTenantId: entry.supplierTenantId,
    status: entry.timesheetStatus,
    createdById: entry.recordedById,
    ...(entry.siteId !== null && entry.siteId !== undefined ? { siteId: entry.siteId } : {}),
    ...(entry.costCenterId !== null && entry.costCenterId !== undefined
      ? { costCenterId: entry.costCenterId }
      : {}),
    disclosedToTenantIds: [entry.customerTenantId, entry.supplierTenantId],
  }
}

/**
 * Abrechnungsperiode (3.9) als Vorgang. Betreibermandant; `MD` öffnet und
 * schließt ([33]).
 */
export function billingPeriodRef(period: {
  readonly tenantId: string
  readonly customerTenantId: string | null
  readonly status: string
  readonly engagedSupplierTenantIds?: readonly string[]
}): ResourceRef {
  const offengelegt = [
    ...(period.customerTenantId !== null ? [period.customerTenantId] : []),
    ...(period.engagedSupplierTenantIds ?? []),
  ]
  return {
    type: 'billingPeriod',
    tenantId: period.tenantId,
    tenantType: 'operator',
    ...(period.customerTenantId !== null ? { customerTenantId: period.customerTenantId } : {}),
    status: period.status,
    disclosedToTenantIds: offengelegt,
  }
}

/**
 * Abrechnungsbeleg (3.9) als Vorgang.
 *
 * **Betreibermandant, beide Seiten** — und genau **eine** Gegenseite je Beleg:
 * ein Verkaufsbeleg nennt seinen Kunden, ein Einkaufsbeleg seinen Lieferanten
 * (3.9). Daran hängt mehr als eine Anzeige: `disclosedToTenantIds` öffnet die
 * Mandantengrenze nur für diese eine Gegenseite (2.3), und die Fußnoten [31]
 * und [32] prüfen sie erneut. Ein `KE` an einer Gutschrift fällt damit schon
 * an der Grenze heraus, weil die Gutschrift keinen Kunden nennt.
 *
 * **Kein Standort und keine Kostenstelle.** Der Beleg fasst die Leistung
 * mehrerer Einsätze zusammen; eine einzelne Kostenstelle am Beleg wäre falsch,
 * und die Zuständigkeit (3.11) greift deshalb nur über seine **Positionen**.
 * Ob eine kostenstellenbezogene Zuständigkeit einen Beleg teilweise sichtbar
 * machen soll, ist Teil von *offener Frage 14* und hier nicht entschieden.
 */
export function billingDocumentRef(document: {
  readonly tenantId: string
  readonly direction: 'sales' | 'purchase'
  readonly customerTenantId: string | null
  readonly supplierTenantId: string | null
  readonly status: string
  readonly createdById: string
}): ResourceRef {
  const gegenseite =
    document.direction === 'sales' ? document.customerTenantId : document.supplierTenantId
  return {
    type: 'billingDocument',
    tenantId: document.tenantId,
    tenantType: 'operator',
    ...(document.direction === 'sales' && document.customerTenantId !== null
      ? { customerTenantId: document.customerTenantId }
      : {}),
    ...(document.direction === 'purchase' && document.supplierTenantId !== null
      ? { supplierTenantId: document.supplierTenantId }
      : {}),
    status: document.status,
    // Grundlage des Vier-Augen-Prinzips in [30] (2.4, Regel 5).
    createdById: document.createdById,
    disclosedToTenantIds: gegenseite === null ? [] : [gegenseite],
  }
}

/**
 * Benachrichtigung (3.14) als Vorgang.
 *
 * Der Mandant ist der des **betroffenen Objekts** — wie beim Audit-Eintrag
 * (3.12). Die Mandantengrenze allein trägt hier aber nicht: eine
 * Benachrichtigung an den Lieferanten über einen Einsatz gehört dem
 * Betreibermandanten, und der Lieferant muss sie lesen können. Die Kante steht
 * deshalb ausdrücklich in `disclosedToTenantIds` — und [47] prüft danach
 * erneut, ob die Nachricht an **seine** Rollenzuweisung gerichtet ist.
 */
export function notificationRef(notification: {
  readonly tenantId: string
  readonly tenantType: TenantType
  readonly recipientRoleCode: RoleCode
  readonly recipientTenantId: string
}): ResourceRef {
  return {
    type: 'notification',
    tenantId: notification.tenantId,
    tenantType: notification.tenantType,
    ...(notification.tenantType === 'customer' ? { customerTenantId: notification.tenantId } : {}),
    recipientRoleCode: notification.recipientRoleCode,
    recipientTenantId: notification.recipientTenantId,
    disclosedToTenantIds: [notification.recipientTenantId],
  }
}

/** Zuschlagsart (3.8) als Vorgang — ein Katalog im Betreibermandanten. */
export function premiumTypeRef(
  premiumType: { readonly tenantId: string },
  offengelegt: readonly string[] = [],
): ResourceRef {
  return {
    type: 'premiumType',
    tenantId: premiumType.tenantId,
    tenantType: 'operator',
    disclosedToTenantIds: offengelegt,
  }
}

/**
 * Audit-Eintrag (3.12) als Vorgang der Prüffunktion.
 *
 * Maßgeblich ist der Mandant des **betroffenen Objekts**, nicht der des
 * Handelnden: „Der Eintrag gehört technisch dem Betreiber, wird aber dem
 * Mandanten des betroffenen Objekts zugeordnet" (3.12). Darauf beruht [39].
 *
 * `customerTenantId` wird nur bei Objekten eines Kundenmandanten gesetzt —
 * dort greift die Betreuungszuordnung des Betreibers (2.3, Bedingung 2). Eine
 * `disclosedToTenantIds`-Kante gibt es **nicht**: die Matrix macht das
 * Protokoll keinem anderen Mandanten zugänglich.
 */
export function auditEntryRef(entry: {
  readonly tenantId: string
  readonly tenantType: TenantType
}): ResourceRef {
  return {
    type: 'auditEntry',
    tenantId: entry.tenantId,
    tenantType: entry.tenantType,
    ...(entry.tenantType === 'customer' ? { customerTenantId: entry.tenantId } : {}),
  }
}

/** Mandantentyp eines Mandanten, für die Bauer oben. */
export function tenantTypeOf(tenantType: string): TenantType {
  return tenantType as TenantType
}

/* ------------------------------------------------------------------ */
/* Protokoll (3.12)                                                    */
/* ------------------------------------------------------------------ */

/**
 * Protokolliert einen **verweigerten** Zugriff (3.12: „abgelehnte Zugriffe
 * werden ebenfalls protokolliert") und gibt die Verweigerung als Ergebnis
 * zurück, damit die Aufrufstelle eine Zeile bleibt.
 *
 * Der Eintrag läuft in einer **eigenen** Transaktion: die Handlung findet nicht
 * statt, und ein Eintrag in ihrer Transaktion wäre mit dem Rollback weg.
 *
 * `tenantId` ist der Mandant des betroffenen Objekts. Fehlt er — bei einer
 * abgelehnten **Anlage** gibt es noch kein Objekt —, tritt der Mandant des
 * Handelnden ein (*offene Frage 44*).
 */
export async function verweigere(
  identity: LoadedIdentity,
  decision: Decision,
  operation: AuditOperation,
  objectType: ModelName,
  objectRef: string,
  tenantId?: string,
): Promise<ActionResult> {
  await protokolliereGetrennt(
    verweigerungsEintrag({
      decision,
      operation,
      bezug: { objectType, objectRef, tenantId: tenantId ?? identity.tenant.id },
      userId: identity.user.id,
      occurredAt: new Date(),
    }),
  )
  if (decision.allowed) {
    throw new Error('verweigere() wurde mit einer erlaubten Entscheidung aufgerufen.')
  }
  return failure(decision.denial.reason, decision.denial.specReference)
}

/** Bezug eines Eintrags zu einem bestehenden Objekt (3.12). */
export function protokollbezug(
  objectType: ModelName,
  objectRef: string,
  tenantId: string,
): Protokollbezug {
  return { objectType, objectRef, tenantId }
}
