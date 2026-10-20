'use server'

/**
 * Server-Handlungen der Stammdatenseite.
 *
 * Jede Handlung liest die Testidentität, ruft den Fachdienst und kehrt mit
 * dessen Meldung zurück. **Keine** Handlung prüft selbst Rechte: das tut der
 * Dienst über `checkPermission` (2.2, 2.3). Scheitert eine Handlung, trägt die
 * Meldung die Begründung mit SPEC-Verweis.
 */
import { redirect } from 'next/navigation'
import { currentIdentity } from '../identity'
import type { ActionResult } from '../../lib/services/common'
import {
  createComparableWageEntry,
  createCostCenter,
  createCustomer,
  createSite,
  createSupplier,
  createSupplierPermit,
} from '../../lib/services/masterData'

const PATH = '/stammdaten'

function back(result: ActionResult): never {
  if (result.ok) redirect(`${PATH}?ok=${encodeURIComponent(result.message)}`)
  const text =
    result.specReference === undefined
      ? result.error
      : `${result.error} (${result.specReference})`
  redirect(`${PATH}?fehler=${encodeURIComponent(text)}`)
}

function text(formData: FormData, field: string): string {
  const value = formData.get(field)
  return typeof value === 'string' ? value : ''
}

function optionalText(formData: FormData, field: string): string | null {
  const value = text(formData, field).trim()
  return value === '' ? null : value
}

function date(formData: FormData, field: string): Date | null {
  const value = text(formData, field)
  if (value === '') return null
  const parsed = new Date(`${value}T00:00:00.000Z`)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function decimal(formData: FormData, field: string): number | null {
  const value = text(formData, field).replace(',', '.').trim()
  if (value === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

export async function createCustomerAction(formData: FormData): Promise<void> {
  const { identity, hint } = await currentIdentity()
  if (identity === null) back({ ok: false, error: hint ?? 'Keine Identität.' })
  back(
    await createCustomer(identity, {
      customerNumber: text(formData, 'customerNumber'),
      legalName: text(formData, 'legalName'),
      addressStreet: text(formData, 'addressStreet'),
      addressPostalCode: text(formData, 'addressPostalCode'),
      addressCity: text(formData, 'addressCity'),
      industrySector: optionalText(formData, 'industrySector'),
      contactName: text(formData, 'contactName'),
      validFrom: date(formData, 'validFrom') ?? new Date(),
    }),
  )
}

export async function createSiteAction(formData: FormData): Promise<void> {
  const { identity, hint } = await currentIdentity()
  if (identity === null) back({ ok: false, error: hint ?? 'Keine Identität.' })
  back(
    await createSite(identity, {
      customerId: text(formData, 'customerId'),
      siteNumber: text(formData, 'siteNumber'),
      name: text(formData, 'name'),
      addressStreet: text(formData, 'addressStreet'),
      addressPostalCode: text(formData, 'addressPostalCode'),
      addressCity: text(formData, 'addressCity'),
      standardWeeklyHours: decimal(formData, 'standardWeeklyHours'),
      safetyBriefingRequired: text(formData, 'safetyBriefingRequired') === 'ja',
      validFrom: date(formData, 'validFrom') ?? new Date(),
    }),
  )
}

export async function createCostCenterAction(formData: FormData): Promise<void> {
  const { identity, hint } = await currentIdentity()
  if (identity === null) back({ ok: false, error: hint ?? 'Keine Identität.' })
  back(
    await createCostCenter(identity, {
      customerId: text(formData, 'customerId'),
      costCenterNumber: text(formData, 'costCenterNumber'),
      name: text(formData, 'name'),
      siteId: optionalText(formData, 'siteId'),
      validFrom: date(formData, 'validFrom') ?? new Date(),
    }),
  )
}

export async function createSupplierAction(formData: FormData): Promise<void> {
  const { identity, hint } = await currentIdentity()
  if (identity === null) back({ ok: false, error: hint ?? 'Keine Identität.' })
  back(
    await createSupplier(identity, {
      supplierNumber: text(formData, 'supplierNumber'),
      legalName: text(formData, 'legalName'),
      addressStreet: text(formData, 'addressStreet'),
      addressPostalCode: text(formData, 'addressPostalCode'),
      addressCity: text(formData, 'addressCity'),
      contactName: text(formData, 'contactName'),
      validFrom: date(formData, 'validFrom') ?? new Date(),
    }),
  )
}

export async function createPermitAction(formData: FormData): Promise<void> {
  const { identity, hint } = await currentIdentity()
  if (identity === null) back({ ok: false, error: hint ?? 'Keine Identität.' })
  const permitType = text(formData, 'permitType') === 'fixedTerm' ? 'fixedTerm' : 'unlimited'
  back(
    await createSupplierPermit(identity, {
      supplierId: text(formData, 'supplierId'),
      permitNumber: text(formData, 'permitNumber'),
      issuingAuthority: text(formData, 'issuingAuthority'),
      permitType,
      issuedOn: date(formData, 'issuedOn') ?? new Date(),
      validFrom: date(formData, 'validFrom') ?? new Date(),
      validTo: permitType === 'fixedTerm' ? date(formData, 'validTo') : null,
      certificateDocumentRef: optionalText(formData, 'certificateDocumentRef'),
    }),
  )
}

export async function createComparableWageAction(formData: FormData): Promise<void> {
  const { identity, hint } = await currentIdentity()
  if (identity === null) back({ ok: false, error: hint ?? 'Keine Identität.' })
  const wageSource = text(formData, 'wageSource')
  back(
    await createComparableWageEntry(identity, {
      siteId: text(formData, 'siteId'),
      activityKey: text(formData, 'activityKey'),
      comparableWage: decimal(formData, 'comparableWage') ?? 0,
      wageSource:
        wageSource === 'collectiveAgreement' ||
        wageSource === 'companyAgreement' ||
        wageSource === 'individualContract' ||
        wageSource === 'estimate'
          ? wageSource
          : 'estimate',
      validFrom: date(formData, 'validFrom') ?? new Date(),
    }),
  )
}
