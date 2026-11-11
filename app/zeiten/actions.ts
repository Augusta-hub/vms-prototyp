'use server'

/**
 * Server-Handlungen der Zeitenseite (SPEC 3.8, 4.4).
 *
 * Jede Handlung liest die Testidentität, ruft den Fachdienst und kehrt mit
 * dessen Meldung zurück. **Keine** Handlung prüft selbst Rechte: das tut der
 * Dienst über `checkPermission` (2.2, 2.3), und keine entscheidet selbst, ob
 * ein Übergang zulässig ist: das tut das Statusmodell (4.4).
 */
import { redirect } from 'next/navigation'
import { currentIdentity } from '../identity'
import type { ActionResult } from '../../lib/services/common'
import {
  addTimeEntry,
  createTimesheet,
  decideStage,
  openBillingPeriod,
  removeTimeEntry,
  reworkTimesheet,
  submitTimesheet,
} from '../../lib/services/timesheets'

const PATH = '/zeiten'

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

/** Eine Uhrzeit als Minuten seit Mitternacht (3.8) — leer heißt Tagessumme. */
function minuteOfDay(formData: FormData, field: string): number | null {
  const value = text(formData, field).trim()
  if (value === '') return null
  const treffer = /^(\d{1,2}):(\d{2})$/.exec(value)
  if (treffer === null) return null
  const stunde = Number(treffer[1])
  const minute = Number(treffer[2])
  if (!Number.isFinite(stunde) || !Number.isFinite(minute)) return null
  return stunde * 60 + minute
}

function decimal(formData: FormData, field: string): number | null {
  const value = text(formData, field).replace(',', '.').trim()
  if (value === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function integer(formData: FormData, field: string): number | null {
  const value = decimal(formData, field)
  return value === null ? null : Math.round(value)
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

export async function createTimesheetAction(formData: FormData): Promise<void> {
  const { identity, hint } = await currentIdentity()
  if (identity === null) back({ ok: false, error: hint ?? 'Keine Identität.' })
  back(
    await createTimesheet(identity, {
      assignmentId: text(formData, 'assignmentId'),
      billingPeriodId: text(formData, 'billingPeriodId'),
    }),
  )
}

/**
 * Legt eine Zeitposition an. Beginn und Ende **beide oder keines** — daraus
 * folgt die Erfassungsform (3.8, Invariante 1); der Dienst rechnet bei einem
 * Abschnitt die Menge selbst.
 */
export async function addTimeEntryAction(formData: FormData): Promise<void> {
  const { identity, hint } = await currentIdentity()
  if (identity === null) back({ ok: false, error: hint ?? 'Keine Identität.' })

  const premiumTypeId = optionalText(formData, 'premiumTypeId')
  const premiumHours = decimal(formData, 'premiumHours')
  back(
    await addTimeEntry(identity, {
      timesheetId: text(formData, 'timesheetId'),
      workDate: date(formData, 'workDate') ?? new Date(),
      startMinute: minuteOfDay(formData, 'startTime'),
      endMinute: minuteOfDay(formData, 'endTime'),
      breakMinutes: integer(formData, 'breakMinutes'),
      hours: decimal(formData, 'hours'),
      note: optionalText(formData, 'note'),
      declaredPremiums:
        premiumTypeId === null || premiumHours === null || premiumHours <= 0
          ? []
          : [{ premiumTypeId, hours: premiumHours }],
    }),
  )
}

export async function removeTimeEntryAction(formData: FormData): Promise<void> {
  const { identity, hint } = await currentIdentity()
  if (identity === null) back({ ok: false, error: hint ?? 'Keine Identität.' })
  back(await removeTimeEntry(identity, { timeEntryId: text(formData, 'timeEntryId') }))
}

export async function submitTimesheetAction(formData: FormData): Promise<void> {
  const { identity, hint } = await currentIdentity()
  if (identity === null) back({ ok: false, error: hint ?? 'Keine Identität.' })
  back(await submitTimesheet(identity, { timesheetId: text(formData, 'timesheetId') }))
}

export async function reworkTimesheetAction(formData: FormData): Promise<void> {
  const { identity, hint } = await currentIdentity()
  if (identity === null) back({ ok: false, error: hint ?? 'Keine Identität.' })
  back(await reworkTimesheet(identity, { timesheetId: text(formData, 'timesheetId') }))
}

/**
 * Entscheidet die offene Stufe. Welcher Übergang daraus wird — `approveStage`,
 * `approve` oder `reject` —, entscheidet der Dienst anhand der Lage und nicht
 * diese Handlung (4.4).
 */
export async function decideStageAction(formData: FormData): Promise<void> {
  const { identity, hint } = await currentIdentity()
  if (identity === null) back({ ok: false, error: hint ?? 'Keine Identität.' })
  back(
    await decideStage(identity, {
      timesheetId: text(formData, 'timesheetId'),
      decision: text(formData, 'decision') === 'rejected' ? 'rejected' : 'approved',
      rejectionReason: optionalText(formData, 'rejectionReason'),
      comment: optionalText(formData, 'comment'),
    }),
  )
}
