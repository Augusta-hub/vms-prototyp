'use server'

/**
 * Server-Handlungen der Bedarfsseite.
 *
 * Jede Handlung ruft den Fachdienst; **welcher Übergang wann zulässig ist**,
 * entscheidet das Statusmodell aus Kapitel 4 (lib/status/), und ob die Rolle
 * ihn auslösen darf, die Matrix 2.2 (lib/authz/). Hier steht nur die
 * Umsetzung des Formulars in einen Aufruf.
 */
import { redirect } from 'next/navigation'
import type { ActionResult } from '../../lib/services/common'
import {
  createDemandRequest,
  publishTender,
  runSystemDeadlineRun,
  transitionDemandRequest,
  transitionOffer,
} from '../../lib/services/demand'
import type { DemandRequestTransitionName } from '../../lib/status/demandRequest'
import type { SupplierOfferTransitionName } from '../../lib/status/supplierOffer'
import { currentIdentity } from '../identity'

const PATH = '/bedarf'

function back(result: ActionResult): never {
  if (result.ok) redirect(`${PATH}?ok=${encodeURIComponent(result.message)}`)
  const text =
    result.specReference === undefined ? result.error : `${result.error} (${result.specReference})`
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

function moment(formData: FormData, field: string): Date | null {
  const value = text(formData, field)
  if (value === '') return null
  const parsed = new Date(`${value}:00.000Z`)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function decimal(formData: FormData, field: string): number | null {
  const value = text(formData, field).replace(',', '.').trim()
  if (value === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

export async function createDemandRequestAction(formData: FormData): Promise<void> {
  const { identity, hint } = await currentIdentity()
  if (identity === null) back({ ok: false, error: hint ?? 'Keine Identität.' })

  // Der Bedarfsträger ist bei einer Kundenrolle die handelnde Person selbst;
  // legt der Betreiber im Auftrag an, benennt das Formular den Auftraggeber
  // (Fußnote [10], 3.4).
  const requestedById =
    identity.tenant.tenantType === 'operator'
      ? text(formData, 'requestedById')
      : identity.user.id

  back(
    await createDemandRequest(identity, {
      requestNumber: text(formData, 'requestNumber'),
      siteId: text(formData, 'siteId'),
      costCenterId: text(formData, 'costCenterId'),
      title: text(formData, 'title'),
      activityDescription: text(formData, 'activityDescription'),
      qualification: text(formData, 'qualification'),
      headcount: decimal(formData, 'headcount') ?? 1,
      startDate: date(formData, 'startDate') ?? new Date(),
      endDate: date(formData, 'endDate'),
      weeklyHours: decimal(formData, 'weeklyHours') ?? 0,
      maxHourlyRate: decimal(formData, 'maxHourlyRate'),
      internalNote: optionalText(formData, 'internalNote'),
      requestedById,
    }),
  )
}

export async function transitionDemandRequestAction(formData: FormData): Promise<void> {
  const { identity, hint } = await currentIdentity()
  if (identity === null) back({ ok: false, error: hint ?? 'Keine Identität.' })
  back(
    await transitionDemandRequest(identity, {
      demandRequestId: text(formData, 'demandRequestId'),
      transition: text(formData, 'transition') as DemandRequestTransitionName,
      reason: optionalText(formData, 'reason'),
    }),
  )
}

export async function publishTenderAction(formData: FormData): Promise<void> {
  const { identity, hint } = await currentIdentity()
  if (identity === null) back({ ok: false, error: hint ?? 'Keine Identität.' })
  const supplierIds = formData
    .getAll('supplierIds')
    .filter((value): value is string => typeof value === 'string' && value !== '')
  const deadline = moment(formData, 'offerDeadline')
  if (deadline === null) {
    back({ ok: false, error: 'Die Angebotsfrist ist Pflicht (3.4, 4.1).' })
  }
  back(
    await publishTender(identity, {
      demandRequestId: text(formData, 'demandRequestId'),
      supplierIds,
      offerDeadline: deadline,
      distributionMode: text(formData, 'distributionMode') === 'staged' ? 'staged' : 'simultaneous',
    }),
  )
}

export async function transitionOfferAction(formData: FormData): Promise<void> {
  const { identity, hint } = await currentIdentity()
  if (identity === null) back({ ok: false, error: hint ?? 'Keine Identität.' })
  back(
    await transitionOffer(identity, {
      offerId: text(formData, 'offerId'),
      transition: text(formData, 'transition') as SupplierOfferTransitionName,
      rejectionReason: optionalText(formData, 'reason'),
    }),
  )
}

/**
 * Startet den Lauf der zeitgesteuerten Übergänge (4.0, Regel 4 und 10). Der
 * Lauf handelt als **System**: er stellt Fristen fest und entzieht, er gewährt
 * nichts.
 */
export async function runSystemDeadlinesAction(): Promise<void> {
  const { identity, hint } = await currentIdentity()
  if (identity === null) back({ ok: false, error: hint ?? 'Keine Identität.' })
  if (identity.tenant.tenantType !== 'operator') {
    back({
      ok: false,
      error: 'Den Fristenlauf überblickt der Betreiber; er ist keine Handlung der Gegenseite.',
      specReference: 'SPEC 4.0, Regel 10',
    })
  }
  const log = await runSystemDeadlineRun()
  back({ ok: true, message: `Systemlauf: ${log.join(' · ')}` })
}
