'use server'

/**
 * Server-Handlungen der Besetzungsseite: Kandidat anlegen (3.6),
 * Profilvorschlag einreichen und die Übergänge aus 4.2.3.
 */
import { redirect } from 'next/navigation'
import type { ActionResult } from '../../lib/services/common'
import {
  createCandidate,
  submitCandidate,
  transitionSubmission,
} from '../../lib/services/staffing'
import type { CandidateSubmissionTransitionName } from '../../lib/status/candidateSubmission'
import { currentIdentity } from '../identity'

const PATH = '/besetzung'

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

export async function createCandidateAction(formData: FormData): Promise<void> {
  const { identity, hint } = await currentIdentity()
  if (identity === null) back({ ok: false, error: hint ?? 'Keine Identität.' })
  const dateOfBirth = date(formData, 'dateOfBirth')
  if (dateOfBirth === null) {
    back({ ok: false, error: 'Das Geburtsdatum ist Pflicht (3.6); es trägt den Abgleich.' })
  }
  const declaredAt = date(formData, 'previousEmploymentDeclaredAt')
  const existedRaw = text(formData, 'previousEmploymentExisted')
  back(
    await createCandidate(identity, {
      givenName: text(formData, 'givenName'),
      familyName: text(formData, 'familyName'),
      dateOfBirth,
      placeOfBirth: optionalText(formData, 'placeOfBirth'),
      pseudonym: text(formData, 'pseudonym'),
      qualification: optionalText(formData, 'qualification'),
      employmentStatusWithSupplier:
        text(formData, 'employmentStatusWithSupplier') === 'employed' ? 'employed' : 'applicant',
      employedSince: date(formData, 'employedSince'),
      workPermitRequired: text(formData, 'workPermitRequired') === 'ja',
      previousEmploymentDeclaredAt: declaredAt,
      previousEmploymentExisted:
        declaredAt === null || existedRaw === '' ? null : existedRaw === 'ja',
      previousEmploymentEndedOn: date(formData, 'previousEmploymentEndedOn'),
      previousEmploymentEmployer: optionalText(formData, 'previousEmploymentEmployer'),
    }),
  )
}

export async function submitCandidateAction(formData: FormData): Promise<void> {
  const { identity, hint } = await currentIdentity()
  if (identity === null) back({ ok: false, error: hint ?? 'Keine Identität.' })
  const availableFrom = date(formData, 'availableFrom')
  if (availableFrom === null) {
    back({ ok: false, error: '„Verfügbar ab" ist Pflicht (3.6).' })
  }
  back(
    await submitCandidate(identity, {
      offerId: text(formData, 'offerId'),
      candidateId: text(formData, 'candidateId'),
      availableFrom,
      offeredHourlyRate: decimal(formData, 'offeredHourlyRate'),
    }),
  )
}

export async function transitionSubmissionAction(formData: FormData): Promise<void> {
  const { identity, hint } = await currentIdentity()
  if (identity === null) back({ ok: false, error: hint ?? 'Keine Identität.' })
  back(
    await transitionSubmission(identity, {
      submissionId: text(formData, 'submissionId'),
      transition: text(formData, 'transition') as CandidateSubmissionTransitionName,
      decisionReason: optionalText(formData, 'decisionReason'),
      interviewAt: moment(formData, 'interviewAt'),
    }),
  )
}
