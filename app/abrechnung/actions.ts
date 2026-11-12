'use server'

/**
 * Server-Handlungen der Abrechnungsseite (SPEC 3.9, 4.5).
 *
 * Jede Handlung liest die Testidentität, ruft den Fachdienst und kehrt mit
 * dessen Meldung zurück. **Keine** Handlung prüft selbst Rechte: das tut der
 * Dienst über `checkPermission` (2.2, 2.3), und keine entscheidet selbst, ob
 * ein Übergang zulässig ist: das tut das Statusmodell (4.5).
 */
import { redirect } from 'next/navigation'
import { currentIdentity } from '../identity'
import type { ActionResult } from '../../lib/services/common'
import {
  cancelBillingDocument,
  closeBillingPeriod,
  createBillingDocument,
  openBillingPeriod,
  transitionBillingDocument,
} from '../../lib/services/billing'
import type { BillingDocumentTransitionName } from '../../lib/status/billingDocument'

const PATH = '/abrechnung'

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

export async function openPeriodAction(formData: FormData): Promise<void> {
  const { identity, hint } = await currentIdentity()
  if (identity === null) back({ ok: false, error: hint ?? 'Keine Identität.' })
  back(
    await openBillingPeriod(identity, {
      periodNumber: text(formData, 'periodNumber'),
      customerId: optionalText(formData, 'customerId'),
      periodFrom: date(formData, 'periodFrom') ?? new Date(),
      periodTo: date(formData, 'periodTo') ?? new Date(),
      closingDate: date(formData, 'closingDate') ?? new Date(),
    }),
  )
}

export async function closePeriodAction(formData: FormData): Promise<void> {
  const { identity, hint } = await currentIdentity()
  if (identity === null) back({ ok: false, error: hint ?? 'Keine Identität.' })
  back(
    await closeBillingPeriod(identity, {
      billingPeriodId: text(formData, 'billingPeriodId'),
    }),
  )
}

/**
 * Erstellt einen Beleg (4.5.2). Die **Seite** entscheidet, welche Gegenseite
 * gemeint ist — die Oberfläche schickt beide Felder, und der Dienst nimmt das
 * Feld, das zur Seite gehört (3.9).
 */
export async function createDocumentAction(formData: FormData): Promise<void> {
  const { identity, hint } = await currentIdentity()
  if (identity === null) back({ ok: false, error: hint ?? 'Keine Identität.' })
  const direction = text(formData, 'direction') === 'purchase' ? 'purchase' : 'sales'
  back(
    await createBillingDocument(identity, {
      billingPeriodId: text(formData, 'billingPeriodId'),
      direction,
      customerId: direction === 'sales' ? optionalText(formData, 'customerId') : null,
      supplierId: direction === 'purchase' ? optionalText(formData, 'supplierId') : null,
      taxRate: decimal(formData, 'taxRate'),
    }),
  )
}

const TRANSITIONS: readonly BillingDocumentTransitionName[] = [
  'review',
  'release',
  'disputeBySales',
  'disputeByPurchase',
  'confirm',
  'clarify',
]

export async function transitionDocumentAction(formData: FormData): Promise<void> {
  const { identity, hint } = await currentIdentity()
  if (identity === null) back({ ok: false, error: hint ?? 'Keine Identität.' })
  const gewaehlt = text(formData, 'transition')
  const transition = TRANSITIONS.find((name) => name === gewaehlt)
  if (transition === undefined) {
    back({ ok: false, error: `Unbekannter Übergang „${gewaehlt}" (4.5.2).` })
  }
  back(
    await transitionBillingDocument(identity, {
      billingDocumentId: text(formData, 'billingDocumentId'),
      transition,
      disputeReason: optionalText(formData, 'disputeReason'),
      disputeResolutionNote: optionalText(formData, 'disputeResolutionNote'),
    }),
  )
}

export async function cancelDocumentAction(formData: FormData): Promise<void> {
  const { identity, hint } = await currentIdentity()
  if (identity === null) back({ ok: false, error: hint ?? 'Keine Identität.' })
  back(
    await cancelBillingDocument(identity, {
      billingDocumentId: text(formData, 'billingDocumentId'),
      cancellationReason: optionalText(formData, 'cancellationReason'),
    }),
  )
}
