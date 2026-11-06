/**
 * Fachdienst Stammdaten — SPEC 3.1 (Kunde, Standort, Kostenstelle), 3.2
 * (Lieferant, AÜG-Erlaubnis) und 3.3 (Rahmenvertrag, Preisliste,
 * Tarifzuordnung, Vergleichsentgelt).
 *
 * Zwei Regeln bestimmen den Aufbau jeder Funktion hier:
 *
 *  1. **Jeder** Zugriff läuft über `checkPermission` (2.2, 2.3). Es gibt in
 *     diesem Modul keine eigene Rechtelogik und keine Abkürzung „der Betreiber
 *     darf ja ohnehin".
 *  2. **Jede Liste** unterliegt derselben Grenze wie die Detailansicht (2.3,
 *     Grundsatz). Gelistet wird deshalb, was die Prüffunktion für diese
 *     Identität erlaubt — und in der Fassung, die lib/visibility/projections.ts
 *     daraus macht.
 */
import { checkPermission, type ResourceRef, type Subject } from '../authz/check'
import type { LoadedIdentity } from '../identity/loadSubject'
import { pruefeErlaubnis } from '../masterdata/invariants'
import { prisma } from '../prisma'
import { concealedFields, project } from '../visibility/projections'
import {
  asFailure,
  collectiveAgreementRef,
  comparableWageRef,
  costCenterRef,
  customerRef,
  failure,
  loadEngagements,
  masterAgreementRef,
  PermissionDenied,
  rateCardRef,
  siteRef,
  success,
  supplierPermitRef,
  supplierRef,
  type ActionResult,
  type Engagements,
} from './common'

/** Eine Zeile einer Liste in der sichtbaren Fassung (2.3). */
export interface VisibleRow<T> {
  readonly id: string
  readonly fields: Partial<T>
  /** Felder, die eine Fußnote dieser Rolle nicht zeigt — benannt, nicht verschwiegen. */
  readonly concealed: readonly string[]
}

export interface CustomerFields {
  readonly customerNumber: string
  readonly legalName: string
  readonly addressCity: string
  readonly industrySector: string | null
  readonly corporateGroup: string | null
  readonly contacts: string
  readonly validFrom: string
  readonly validTo: string | null
}

export interface SiteFields {
  readonly siteNumber: string
  readonly name: string
  readonly customer: string
  readonly addressCity: string
  readonly standardWeeklyHours: string | null
  readonly safetyBriefingRequired: string
  readonly validFrom: string
}

export interface CostCenterFields {
  readonly costCenterNumber: string
  readonly name: string
  readonly customer: string
  readonly site: string | null
  readonly budgetAmount: string | null
  readonly validFrom: string
}

export interface SupplierFields {
  readonly supplierNumber: string
  readonly legalName: string
  readonly addressCity: string
  readonly status: string
  readonly collectiveAgreement: string | null
  readonly contacts: string
  readonly validFrom: string
}

export interface PermitFields {
  readonly supplier: string
  readonly permitNumber: string
  readonly issuingAuthority: string
  readonly permitType: string
  readonly issuedOn: string
  readonly validFrom: string
  readonly validTo: string | null
  readonly restrictions: string | null
  readonly certificateDocumentRef: string | null
  readonly verificationStatus: string
}

export interface AgreementFields {
  readonly agreementNumber: string
  readonly agreementType: string
  readonly counterparty: string
  readonly validFrom: string
  readonly validTo: string | null
  readonly paymentTermsDays: string | null
  readonly status: string
}

export interface RateCardItemFields {
  readonly itemType: string
  readonly qualificationLevel: string | null
  readonly hourlyRate: string | null
  readonly premiumValue: string | null
  readonly minimumHours: string | null
}

export interface RateCardFields {
  readonly rateCardNumber: string
  readonly rateCardScope: string
  readonly counterparty: string
  readonly currency: string
  readonly status: string
  readonly validFrom: string
}

export interface CollectiveAgreementFields {
  readonly collectiveAgreement: string
  readonly appliesToType: string
  readonly target: string
  readonly maxAssignmentDurationMonths: string | null
  readonly equalPayDeadlineMonths: string | null
  readonly industryPremiumScheme: string | null
  readonly validFrom: string
}

export interface ComparableWageFields {
  readonly site: string
  readonly activityKey: string
  readonly comparableWage: string
  readonly currency: string
  readonly wageSource: string
  readonly validFrom: string
  readonly reportedAt: string
}

export interface MasterDataView {
  readonly customers: readonly VisibleRow<CustomerFields>[]
  readonly sites: readonly VisibleRow<SiteFields>[]
  readonly costCenters: readonly VisibleRow<CostCenterFields>[]
  readonly suppliers: readonly VisibleRow<SupplierFields>[]
  readonly permits: readonly VisibleRow<PermitFields>[]
  readonly agreements: readonly VisibleRow<AgreementFields>[]
  readonly rateCards: readonly (VisibleRow<RateCardFields> & {
    readonly items: readonly VisibleRow<RateCardItemFields>[]
  })[]
  readonly collectiveAgreements: readonly VisibleRow<CollectiveAgreementFields>[]
  readonly comparableWages: readonly VisibleRow<ComparableWageFields>[]
}

/** Auswahllisten für die Anlegeformulare, auf das Sichtbare begrenzt. */
export interface MasterDataOptions {
  readonly customers: readonly { readonly id: string; readonly label: string }[]
  readonly sites: readonly {
    readonly id: string
    readonly label: string
    readonly customerId: string
  }[]
  readonly suppliers: readonly { readonly id: string; readonly label: string }[]
  readonly collectiveAgreements: readonly { readonly id: string; readonly label: string }[]
  /**
   * Darf diese Identität ein solches Objekt **anlegen** (Operation `A` in
   * 2.2)? Entschieden hier und nicht in der Oberfläche: die Seite stellt dar,
   * sie entscheidet nicht. Ein Formular, das trotzdem abgeschickt wird,
   * scheitert ein zweites Mal am Dienst.
   */
  readonly mayCreate: {
    readonly customer: boolean
    readonly site: boolean
    readonly costCenter: boolean
    readonly supplier: boolean
    readonly supplierPermit: boolean
    readonly comparableWageEntry: boolean
  }
}

const DATE = (value: Date | null): string | null =>
  value === null ? null : value.toISOString().slice(0, 10)

const REQUIRED_DATE = (value: Date): string => value.toISOString().slice(0, 10)

export async function loadMasterData(identity: LoadedIdentity): Promise<MasterDataView> {
  const engagements = await loadEngagements()
  const subject = identity.subject

  const customers = await prisma.customer.findMany({
    include: { contacts: true, customerCollectiveAgreement: true },
    orderBy: { customerNumber: 'asc' },
  })
  const sites = await prisma.site.findMany({
    include: { customer: true },
    orderBy: [{ customer: { customerNumber: 'asc' } }, { siteNumber: 'asc' }],
  })
  const costCenters = await prisma.costCenter.findMany({
    include: { customer: true, site: true },
    orderBy: [{ customer: { customerNumber: 'asc' } }, { costCenterNumber: 'asc' }],
  })
  const suppliers = await prisma.supplier.findMany({
    include: { contacts: true, supplierCollectiveAgreement: true },
    orderBy: { supplierNumber: 'asc' },
  })
  const permits = await prisma.supplierPermit.findMany({
    include: { supplier: true },
    orderBy: [{ supplier: { supplierNumber: 'asc' } }, { validFrom: 'asc' }],
  })
  const agreements = await prisma.masterAgreement.findMany({
    include: { customer: true, supplier: true },
    orderBy: { agreementNumber: 'asc' },
  })
  const rateCards = await prisma.rateCard.findMany({
    include: {
      items: { orderBy: { itemType: 'asc' } },
      masterAgreement: { include: { customer: true, supplier: true } },
    },
    orderBy: { rateCardNumber: 'asc' },
  })
  const collectiveAgreements = await prisma.collectiveAgreementAssignment.findMany({
    include: { customerTarget: true, supplierTarget: true, siteTarget: true },
    orderBy: { validFrom: 'asc' },
  })
  const comparableWages = await prisma.comparableWageEntry.findMany({
    include: { site: true },
    orderBy: [{ activityKey: 'asc' }, { validFrom: 'asc' }],
  })

  return {
    customers: visible(subject, customers, (customer) => ({
      id: customer.id,
      ref: customerRef(customer, engagements),
      fields: {
        customerNumber: customer.customerNumber,
        legalName: customer.legalName,
        addressCity: customer.addressCity,
        industrySector: customer.industrySector,
        corporateGroup: customer.corporateGroup,
        contacts: customer.contacts.map((contact) => contact.name).join(', '),
        validFrom: REQUIRED_DATE(customer.validFrom),
        validTo: DATE(customer.validTo),
      },
    })),

    sites: visible(subject, sites, (site) => ({
      id: site.id,
      ref: siteRef(site, engagements),
      fields: {
        siteNumber: site.siteNumber,
        name: site.name,
        customer: site.customer.legalName,
        addressCity: site.addressCity,
        standardWeeklyHours: site.standardWeeklyHours?.toString() ?? null,
        safetyBriefingRequired: site.safetyBriefingRequired ? 'ja' : 'nein',
        validFrom: REQUIRED_DATE(site.validFrom),
      },
    })),

    costCenters: visible(subject, costCenters, (costCenter) => ({
      id: costCenter.id,
      ref: costCenterRef(costCenter),
      fields: {
        costCenterNumber: costCenter.costCenterNumber,
        name: costCenter.name,
        customer: costCenter.customer.legalName,
        site: costCenter.site?.name ?? null,
        budgetAmount: costCenter.budgetAmount?.toString() ?? null,
        validFrom: REQUIRED_DATE(costCenter.validFrom),
      },
    })),

    suppliers: visible(subject, suppliers, (supplier) => ({
      id: supplier.id,
      ref: supplierRef(supplier, engagements),
      fields: {
        supplierNumber: supplier.supplierNumber,
        legalName: supplier.legalName,
        addressCity: supplier.addressCity,
        status: supplier.status,
        collectiveAgreement: supplier.supplierCollectiveAgreement?.collectiveAgreement ?? null,
        contacts: supplier.contacts.map((contact) => contact.name).join(', '),
        validFrom: REQUIRED_DATE(supplier.validFrom),
      },
    })),

    permits: visible(subject, permits, (permit) => ({
      id: permit.id,
      ref: supplierPermitRef(permit, engagements),
      fields: {
        supplier: permit.supplier.legalName,
        permitNumber: permit.permitNumber,
        issuingAuthority: permit.issuingAuthority,
        permitType: permit.permitType,
        issuedOn: REQUIRED_DATE(permit.issuedOn),
        validFrom: REQUIRED_DATE(permit.validFrom),
        validTo: DATE(permit.validTo),
        restrictions: permit.restrictions,
        certificateDocumentRef: permit.certificateDocumentRef,
        verificationStatus: permit.verificationStatus,
      },
    })),

    agreements: visible(subject, agreements, (agreement) => ({
      id: agreement.id,
      ref: masterAgreementRef({
        tenantId: agreement.tenantId,
        status: agreement.status,
        customerTenant: agreement.customer?.tenantId ?? null,
        supplierTenant: agreement.supplier?.tenantId ?? null,
      }),
      fields: {
        agreementNumber: agreement.agreementNumber,
        agreementType: agreement.agreementType,
        counterparty: agreement.customer?.legalName ?? agreement.supplier?.legalName ?? '—',
        validFrom: REQUIRED_DATE(agreement.validFrom),
        validTo: DATE(agreement.validTo),
        paymentTermsDays: agreement.paymentTermsDays?.toString() ?? null,
        status: agreement.status,
      },
    })),

    rateCards: rateCards.flatMap((rateCard) => {
      const ref = rateCardRef({
        tenantId: rateCard.tenantId,
        status: rateCard.status,
        rateCardScope: rateCard.rateCardScope,
        customerTenant: rateCard.masterAgreement.customer?.tenantId ?? null,
        supplierTenant: rateCard.masterAgreement.supplier?.tenantId ?? null,
      })
      const decision = checkPermission(subject, 'read', ref)
      if (!decision.allowed) return []
      const fields: RateCardFields = {
        rateCardNumber: rateCard.rateCardNumber,
        rateCardScope: rateCard.rateCardScope,
        counterparty:
          rateCard.masterAgreement.customer?.legalName ??
          rateCard.masterAgreement.supplier?.legalName ??
          '—',
        currency: rateCard.currency,
        status: rateCard.status,
        validFrom: REQUIRED_DATE(rateCard.validFrom),
      }
      return [
        {
          id: rateCard.id,
          fields: project(fields, decision) ?? {},
          concealed: concealedFields(decision),
          items: rateCard.items.map((item) => {
            const itemFields: RateCardItemFields = {
              itemType: item.itemType,
              qualificationLevel: item.qualificationLevel,
              hourlyRate: item.hourlyRate?.toString() ?? null,
              premiumValue: item.premiumValue?.toString() ?? null,
              minimumHours: item.minimumHours?.toString() ?? null,
            }
            return {
              id: item.id,
              fields: project(itemFields, decision) ?? {},
              concealed: concealedFields(decision),
            }
          }),
        },
      ]
    }),

    collectiveAgreements: visible(subject, collectiveAgreements, (assignment) => ({
      id: assignment.id,
      ref: collectiveAgreementRef({
        tenantId: assignment.tenantId,
        customerTenant:
          assignment.customerTarget?.tenantId ?? assignment.siteTarget?.tenantId ?? null,
        supplierTenant: assignment.supplierTarget?.tenantId ?? null,
      }),
      fields: {
        collectiveAgreement: assignment.collectiveAgreement,
        appliesToType: assignment.appliesToType,
        target:
          assignment.supplierTarget?.legalName ??
          assignment.customerTarget?.legalName ??
          assignment.siteTarget?.name ??
          '—',
        maxAssignmentDurationMonths: assignment.maxAssignmentDurationMonths?.toString() ?? null,
        equalPayDeadlineMonths: assignment.equalPayDeadlineMonths?.toString() ?? null,
        industryPremiumScheme: assignment.industryPremiumScheme,
        validFrom: REQUIRED_DATE(assignment.validFrom),
      },
    })),

    comparableWages: visible(subject, comparableWages, (entry) => ({
      id: entry.id,
      ref: comparableWageRef(entry),
      fields: {
        site: entry.site.name,
        activityKey: entry.activityKey,
        comparableWage: entry.comparableWage.toString(),
        currency: entry.currency,
        wageSource: entry.wageSource,
        validFrom: REQUIRED_DATE(entry.validFrom),
        reportedAt: REQUIRED_DATE(entry.reportedAt),
      },
    })),
  }
}

/**
 * Listet, was diese Identität lesen darf, in der sichtbaren Fassung. Ein
 * verweigerter Zugriff erscheint **nicht** als leere Zeile: er erscheint nicht
 * (2.3, Grundsatz).
 */
function visible<TRow, TFields extends object>(
  subject: Subject,
  rows: readonly TRow[],
  describe: (row: TRow) => { id: string; ref: ResourceRef; fields: TFields },
): readonly VisibleRow<TFields>[] {
  return rows.flatMap((row) => {
    const described = describe(row)
    const decision = checkPermission(subject, 'read', described.ref)
    const fields = project(described.fields, decision)
    if (fields === null) return []
    return [{ id: described.id, fields, concealed: concealedFields(decision) }]
  })
}

/** Auswahllisten der Formulare — dieselbe Grenze wie die Listen. */
export async function loadMasterDataOptions(
  identity: LoadedIdentity,
): Promise<MasterDataOptions> {
  const engagements = await loadEngagements()
  const subject = identity.subject

  const customers = await prisma.customer.findMany({ orderBy: { customerNumber: 'asc' } })
  const sites = await prisma.site.findMany({
    include: { customer: true },
    orderBy: { siteNumber: 'asc' },
  })
  const suppliers = await prisma.supplier.findMany({ orderBy: { supplierNumber: 'asc' } })
  const collectiveAgreements = await prisma.collectiveAgreementAssignment.findMany({
    include: { customerTarget: true, supplierTarget: true, siteTarget: true },
  })

  const visibleCustomers = customers.filter(
    (customer) => checkPermission(subject, 'read', customerRef(customer, engagements)).allowed,
  )
  const visibleSites = sites.filter(
    (site) => checkPermission(subject, 'read', siteRef(site, engagements)).allowed,
  )
  const visibleSuppliers = suppliers.filter(
    (supplier) => checkPermission(subject, 'read', supplierRef(supplier, engagements)).allowed,
  )

  // Kunde und Lieferant entstehen **mit** ihrem Mandanten (3.1, 3.2). Geprüft
  // wird deshalb gegen einen Mandanten, den es noch nicht gibt — genau die
  // Lage beim Anlegen. Den wirklichen Mandanten prüft der Dienst später
  // nochmals, in der Transaktion.
  const mayCreate = {
    customer: checkPermission(subject, 'create', {
      type: 'customer',
      tenantId: 'neuer-kundenmandant',
      tenantType: 'customer',
      customerTenantId: 'neuer-kundenmandant',
    }).allowed,
    supplier: checkPermission(subject, 'create', {
      type: 'supplier',
      tenantId: 'neuer-lieferantenmandant',
      tenantType: 'supplier',
      supplierTenantId: 'neuer-lieferantenmandant',
    }).allowed,
    site: visibleCustomers.some(
      (customer) =>
        checkPermission(subject, 'create', {
          ...siteRef({ id: 'neu', tenantId: customer.tenantId }, engagements),
          siteId: undefined,
        }).allowed,
    ),
    costCenter: visibleCustomers.some(
      (customer) =>
        checkPermission(
          subject,
          'create',
          costCenterRef({ id: 'neu', tenantId: customer.tenantId, siteId: null }),
        ).allowed,
    ),
    supplierPermit: visibleSuppliers.some(
      (supplier) =>
        checkPermission(
          subject,
          'create',
          supplierPermitRef({ tenantId: supplier.tenantId, verificationStatus: 'submitted' }, engagements),
        ).allowed,
    ),
    comparableWageEntry: visibleSites.some(
      (site) =>
        checkPermission(
          subject,
          'create',
          comparableWageRef({ tenantId: site.tenantId, siteId: site.id }),
        ).allowed,
    ),
  }

  return {
    mayCreate,
    customers: visibleCustomers.map((customer) => ({
      id: customer.id,
      label: `${customer.customerNumber} — ${customer.legalName}`,
    })),
    sites: visibleSites.map((site) => ({
      id: site.id,
      customerId: site.customerId,
      label: `${site.siteNumber} — ${site.name} (${site.customer.legalName})`,
    })),
    suppliers: visibleSuppliers.map((supplier) => ({
      id: supplier.id,
      label: `${supplier.supplierNumber} — ${supplier.legalName}`,
    })),
    collectiveAgreements: collectiveAgreements
      .filter(
        (assignment) =>
          checkPermission(
            subject,
            'read',
            collectiveAgreementRef({
              tenantId: assignment.tenantId,
              customerTenant:
                assignment.customerTarget?.tenantId ?? assignment.siteTarget?.tenantId ?? null,
              supplierTenant: assignment.supplierTarget?.tenantId ?? null,
            }),
          ).allowed,
      )
      .map((assignment) => ({
        id: assignment.id,
        label: `${assignment.collectiveAgreement} (${assignment.appliesToType})`,
      })),
  }
}

// ── Anlegen ────────────────────────────────────────────────────────────────

export interface NewCustomerInput {
  readonly customerNumber: string
  readonly legalName: string
  readonly addressStreet: string
  readonly addressPostalCode: string
  readonly addressCity: string
  readonly industrySector: string | null
  readonly contactName: string
  readonly validFrom: Date
}

/**
 * Legt Kunde **und** Mandant an (3.1: „Der Kunde ist ein Mandant").
 *
 * Die Rechteprüfung läuft in der Transaktion, **nachdem** der Mandant
 * existiert: nur dann kann sie auf dem wirklichen Mandanten des neuen Objekts
 * prüfen und nicht auf einer Vermutung. Ein verweigerter Zugriff rollt die
 * Transaktion zurück.
 */
export async function createCustomer(
  identity: LoadedIdentity,
  input: NewCustomerInput,
): Promise<ActionResult> {
  if (input.customerNumber.trim() === '' || input.legalName.trim() === '') {
    return failure('Kundennummer und Firmenname sind Pflicht (3.1).')
  }
  if (input.contactName.trim() === '') {
    return failure('Mindestens ein Ansprechpartner ist Pflicht (3.1).')
  }
  const engagements = await loadEngagements()
  try {
    await prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: {
          tenantNumber: `M-${input.customerNumber}`,
          tenantType: 'customer',
          displayName: input.legalName,
          createdById: identity.user.id,
        },
      })
      const decision = checkPermission(
        identity.subject,
        'create',
        customerRef({ tenantId: tenant.id }, engagements),
      )
      if (!decision.allowed) {
        throw new PermissionDenied(decision.denial.reason, decision.denial.specReference)
      }
      const customer = await tx.customer.create({
        data: {
          tenantId: tenant.id,
          customerNumber: input.customerNumber.trim(),
          legalName: input.legalName.trim(),
          addressStreet: input.addressStreet.trim(),
          addressPostalCode: input.addressPostalCode.trim(),
          addressCity: input.addressCity.trim(),
          addressCountry: 'DE',
          industrySector: input.industrySector,
          validFrom: input.validFrom,
          createdById: identity.user.id,
          contacts: {
            create: [{ name: input.contactName.trim(), createdById: identity.user.id }],
          },
        },
      })
      // 3.11: `organizationRef` ist Pflicht außer beim Betreiber.
      await tx.tenant.update({
        where: { id: tenant.id },
        data: { organizationId: customer.id },
      })
    })
  } catch (error) {
    return asFailure(error, 'Kunde konnte nicht angelegt werden')
  }
  return success(`Kunde ${input.customerNumber} angelegt, mit eigenem Mandanten (3.1, 3.11).`)
}

export interface NewSiteInput {
  readonly customerId: string
  readonly siteNumber: string
  readonly name: string
  readonly addressStreet: string
  readonly addressPostalCode: string
  readonly addressCity: string
  readonly standardWeeklyHours: number | null
  readonly safetyBriefingRequired: boolean
  readonly validFrom: Date
}

export async function createSite(
  identity: LoadedIdentity,
  input: NewSiteInput,
): Promise<ActionResult> {
  const customer = await prisma.customer.findUnique({ where: { id: input.customerId } })
  if (customer === null) return failure('Unbekannter Kunde.')
  if (input.siteNumber.trim() === '' || input.name.trim() === '') {
    return failure('Standortnummer und Bezeichnung sind Pflicht (3.1).')
  }

  const engagements = await loadEngagements()
  const decision = checkPermission(identity.subject, 'create', {
    ...siteRef({ id: 'neu', tenantId: customer.tenantId }, engagements),
    // Die Zuständigkeit (3.11) kann einen Standort erst einschränken, wenn er
    // existiert; die Anlage prüft deshalb ohne `siteId`.
    siteId: undefined,
  })
  if (!decision.allowed) {
    return failure(decision.denial.reason, decision.denial.specReference)
  }

  try {
    await prisma.site.create({
      data: {
        tenantId: customer.tenantId,
        customerId: customer.id,
        siteNumber: input.siteNumber.trim(),
        name: input.name.trim(),
        addressStreet: input.addressStreet.trim(),
        addressPostalCode: input.addressPostalCode.trim(),
        addressCity: input.addressCity.trim(),
        addressCountry: 'DE',
        standardWeeklyHours: input.standardWeeklyHours,
        safetyBriefingRequired: input.safetyBriefingRequired,
        validFrom: input.validFrom,
        createdById: identity.user.id,
      },
    })
  } catch (error) {
    return asFailure(error, 'Standort konnte nicht angelegt werden')
  }
  return success(`Standort ${input.siteNumber} angelegt.`)
}

export interface NewCostCenterInput {
  readonly customerId: string
  readonly costCenterNumber: string
  readonly name: string
  readonly siteId: string | null
  readonly validFrom: Date
}

export async function createCostCenter(
  identity: LoadedIdentity,
  input: NewCostCenterInput,
): Promise<ActionResult> {
  const customer = await prisma.customer.findUnique({ where: { id: input.customerId } })
  if (customer === null) return failure('Unbekannter Kunde.')
  if (input.costCenterNumber.trim() === '' || input.name.trim() === '') {
    return failure('Kostenstellennummer und Bezeichnung sind Pflicht (3.1).')
  }

  const decision = checkPermission(
    identity.subject,
    'create',
    costCenterRef({ id: 'neu', tenantId: customer.tenantId, siteId: input.siteId }),
  )
  if (!decision.allowed) return failure(decision.denial.reason, decision.denial.specReference)

  try {
    await prisma.costCenter.create({
      data: {
        tenantId: customer.tenantId,
        customerId: customer.id,
        costCenterNumber: input.costCenterNumber.trim(),
        name: input.name.trim(),
        siteId: input.siteId,
        validFrom: input.validFrom,
        createdById: identity.user.id,
      },
    })
  } catch (error) {
    return asFailure(error, 'Kostenstelle konnte nicht angelegt werden')
  }
  return success(`Kostenstelle ${input.costCenterNumber} angelegt.`)
}

export interface NewSupplierInput {
  readonly supplierNumber: string
  readonly legalName: string
  readonly addressStreet: string
  readonly addressPostalCode: string
  readonly addressCity: string
  readonly contactName: string
  readonly validFrom: Date
}

/**
 * Legt Lieferant **und** Mandant an (3.2). Der Lieferant entsteht in
 * `onboarding` — das ist der Anfangszustand aus 4.6, kein Vorgriff: 4.6 nennt
 * `— → onboarding` ausdrücklich als Anlage durch `MA`.
 */
export async function createSupplier(
  identity: LoadedIdentity,
  input: NewSupplierInput,
): Promise<ActionResult> {
  if (input.supplierNumber.trim() === '' || input.legalName.trim() === '') {
    return failure('Lieferantennummer und Firmenname sind Pflicht (3.2).')
  }
  if (input.contactName.trim() === '') {
    return failure('Mindestens ein Ansprechpartner ist Pflicht (3.2, 4.6).')
  }
  const engagements = await loadEngagements()
  try {
    await prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: {
          tenantNumber: `M-${input.supplierNumber}`,
          tenantType: 'supplier',
          displayName: input.legalName,
          createdById: identity.user.id,
        },
      })
      const decision = checkPermission(
        identity.subject,
        'create',
        supplierRef({ tenantId: tenant.id, status: 'onboarding' }, engagements),
      )
      if (!decision.allowed) {
        throw new PermissionDenied(decision.denial.reason, decision.denial.specReference)
      }
      const supplier = await tx.supplier.create({
        data: {
          tenantId: tenant.id,
          supplierNumber: input.supplierNumber.trim(),
          legalName: input.legalName.trim(),
          addressStreet: input.addressStreet.trim(),
          addressPostalCode: input.addressPostalCode.trim(),
          addressCity: input.addressCity.trim(),
          addressCountry: 'DE',
          status: 'onboarding',
          validFrom: input.validFrom,
          createdById: identity.user.id,
          contacts: {
            create: [{ name: input.contactName.trim(), createdById: identity.user.id }],
          },
        },
      })
      await tx.tenant.update({
        where: { id: tenant.id },
        data: { organizationId: supplier.id },
      })
    })
  } catch (error) {
    return asFailure(error, 'Lieferant konnte nicht angelegt werden')
  }
  return success(
    `Lieferant ${input.supplierNumber} angelegt, Status onboarding (4.6), mit eigenem Mandanten.`,
  )
}

export interface NewPermitInput {
  readonly supplierId: string
  readonly permitNumber: string
  readonly issuingAuthority: string
  readonly permitType: 'fixedTerm' | 'unlimited'
  readonly issuedOn: Date
  readonly validFrom: Date
  readonly validTo: Date | null
  readonly certificateDocumentRef: string | null
}

export async function createSupplierPermit(
  identity: LoadedIdentity,
  input: NewPermitInput,
): Promise<ActionResult> {
  const supplier = await prisma.supplier.findUnique({ where: { id: input.supplierId } })
  if (supplier === null) return failure('Unbekannter Lieferant.')
  if (input.permitNumber.trim() === '' || input.issuingAuthority.trim() === '') {
    return failure('Erlaubnisnummer und Erlaubnisbehörde sind Pflicht (3.2).')
  }
  // Die Invarianten aus 3.2 stehen in lib/masterdata/invariants.ts — dort, wohin
  // das Schema an `validTo` verweist, und nicht zweimal.
  const verletzungen = pruefeErlaubnis({
    permitType: input.permitType,
    validFrom: input.validFrom,
    validTo: input.validTo,
    verificationStatus: 'submitted',
    verifiedAt: null,
    verifiedById: null,
    rejectionReason: null,
  })
  const erste = verletzungen[0]
  if (erste !== undefined) return failure(`${erste.feld}: ${erste.grund}`, erste.specReference)

  const engagements = await loadEngagements()
  const decision = checkPermission(
    identity.subject,
    'create',
    supplierPermitRef({ tenantId: supplier.tenantId, verificationStatus: 'submitted' }, engagements),
  )
  if (!decision.allowed) return failure(decision.denial.reason, decision.denial.specReference)

  try {
    await prisma.supplierPermit.create({
      data: {
        tenantId: supplier.tenantId,
        supplierId: supplier.id,
        permitNumber: input.permitNumber.trim(),
        issuingAuthority: input.issuingAuthority.trim(),
        permitType: input.permitType,
        issuedOn: input.issuedOn,
        validFrom: input.validFrom,
        validTo: input.validTo,
        certificateDocumentRef: input.certificateDocumentRef,
        // Der Nachweis entsteht als eingereicht; die Anerkennung ist die
        // Handlung des MD (Fußnote [34], Nachweisfluss 5.4.3).
        verificationStatus: 'submitted',
        createdById: identity.user.id,
      },
    })
  } catch (error) {
    return asFailure(error, 'Erlaubnis konnte nicht angelegt werden')
  }
  return success(`Erlaubnis ${input.permitNumber} eingereicht (Anerkennung durch MD, 5.4.3).`)
}

export interface NewComparableWageInput {
  readonly siteId: string
  readonly activityKey: string
  readonly comparableWage: number
  readonly wageSource: 'collectiveAgreement' | 'companyAgreement' | 'individualContract' | 'estimate'
  readonly validFrom: Date
}

export async function createComparableWageEntry(
  identity: LoadedIdentity,
  input: NewComparableWageInput,
): Promise<ActionResult> {
  const site = await prisma.site.findUnique({ where: { id: input.siteId } })
  if (site === null) return failure('Unbekannter Standort.')
  if (input.activityKey.trim() === '') return failure('Die Tätigkeit ist Pflicht (3.3).')
  if (!Number.isFinite(input.comparableWage) || input.comparableWage <= 0) {
    return failure('Das Vergleichsentgelt ist ein Betrag je Stunde größer null (3.3).')
  }

  const decision = checkPermission(
    identity.subject,
    'create',
    comparableWageRef({ tenantId: site.tenantId, siteId: site.id }),
  )
  if (!decision.allowed) return failure(decision.denial.reason, decision.denial.specReference)

  try {
    await prisma.comparableWageEntry.create({
      data: {
        tenantId: site.tenantId,
        siteId: site.id,
        activityKey: input.activityKey.trim(),
        comparableWage: input.comparableWage,
        currency: 'EUR',
        validFrom: input.validFrom,
        wageSource: input.wageSource,
        reportedAt: new Date(),
        reportedById: identity.user.id,
        createdById: identity.user.id,
      },
    })
  } catch (error) {
    return asFailure(error, 'Vergleichsentgelt konnte nicht angelegt werden')
  }
  return success(`Vergleichsentgelt für „${input.activityKey}" gemeldet (3.3, Grundlage 5.2).`)
}
