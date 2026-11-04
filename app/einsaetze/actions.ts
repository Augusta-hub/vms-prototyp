'use server'

/**
 * Server-Handlungen der Einsatzseite: Einsatz anlegen (4.3.1), die Übergänge
 * aus 4.3.1, der Antrag auf vorzeitige Beendigung (3.7, ohne eigenen Zustand)
 * und die Verlängerung mit ihren Übergängen aus 4.3.2.
 */
import { redirect } from 'next/navigation'
import type { ActionResult } from '../../lib/services/common'
import {
  createAssignment,
  recordTerminationRequest,
  requestExtension,
  transitionAssignment,
  transitionExtension,
} from '../../lib/services/staffing'
import type { AssignmentTransitionName } from '../../lib/status/assignment'
import type { AssignmentExtensionTransitionName } from '../../lib/status/assignmentExtension'
import { currentIdentity } from '../identity'

const PATH = '/einsaetze'

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

function decimal(formData: FormData, field: string): number | null {
  const value = text(formData, field).replace(',', '.').trim()
  if (value === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

export async function createAssignmentAction(formData: FormData): Promise<void> {
  const { identity, hint } = await currentIdentity()
  if (identity === null) back({ ok: false, error: hint ?? 'Keine Identität.' })
  const plannedStartDate = date(formData, 'plannedStartDate')
  if (plannedStartDate === null) {
    back({ ok: false, error: 'Der geplante Beginn ist Pflicht (3.7).' })
  }
  back(
    await createAssignment(identity, {
      submissionId: text(formData, 'submissionId'),
      costCenterId: text(formData, 'costCenterId'),
      activityDescription: text(formData, 'activityDescription'),
      plannedStartDate,
      plannedEndDate: date(formData, 'plannedEndDate'),
      weeklyHours: decimal(formData, 'weeklyHours') ?? 0,
      shiftModel: optionalText(formData, 'shiftModel'),
      agreedRateCardItemId: text(formData, 'agreedRateCardItemId'),
      customerRateCardItemId: text(formData, 'customerRateCardItemId'),
      comparableWage: decimal(formData, 'comparableWage'),
    }),
  )
}

export async function transitionAssignmentAction(formData: FormData): Promise<void> {
  const { identity, hint } = await currentIdentity()
  if (identity === null) back({ ok: false, error: hint ?? 'Keine Identität.' })
  back(
    await transitionAssignment(identity, {
      assignmentId: text(formData, 'assignmentId'),
      transition: text(formData, 'transition') as AssignmentTransitionName,
      actualStartDate: date(formData, 'actualStartDate'),
      actualEndDate: date(formData, 'actualEndDate'),
      interruptionFrom: date(formData, 'interruptionFrom'),
      interruptionReason: optionalText(formData, 'interruptionReason'),
      interruptionTo: date(formData, 'interruptionTo'),
    }),
  )
}

export async function recordTerminationRequestAction(formData: FormData): Promise<void> {
  const { identity, hint } = await currentIdentity()
  if (identity === null) back({ ok: false, error: hint ?? 'Keine Identität.' })
  back(
    await recordTerminationRequest(identity, {
      assignmentId: text(formData, 'assignmentId'),
      requestedByUserId: text(formData, 'requestedByUserId'),
      reason: text(formData, 'reason'),
      approvedByUserId: optionalText(formData, 'approvedByUserId'),
    }),
  )
}

export async function requestExtensionAction(formData: FormData): Promise<void> {
  const { identity, hint } = await currentIdentity()
  if (identity === null) back({ ok: false, error: hint ?? 'Keine Identität.' })
  const newEndDate = date(formData, 'newEndDate')
  if (newEndDate === null) {
    back({ ok: false, error: 'Das neue Ende ist Pflicht (3.7).' })
  }
  back(
    await requestExtension(identity, {
      assignmentId: text(formData, 'assignmentId'),
      newEndDate,
      reason: text(formData, 'reason'),
    }),
  )
}

export async function transitionExtensionAction(formData: FormData): Promise<void> {
  const { identity, hint } = await currentIdentity()
  if (identity === null) back({ ok: false, error: hint ?? 'Keine Identität.' })
  back(
    await transitionExtension(identity, {
      extensionId: text(formData, 'extensionId'),
      transition: text(formData, 'transition') as AssignmentExtensionTransitionName,
      rejectionReason: optionalText(formData, 'rejectionReason'),
    }),
  )
}
