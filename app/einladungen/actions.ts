'use server'

/**
 * Server-Handlungen der Einladungsseite: absagen (4.2.1, Fußnote [46]) und
 * anbieten (4.2.2, `create` und `submit`, dazu der Folgeübergang an der
 * Einladung).
 */
import { redirect } from 'next/navigation'
import type { ActionResult } from '../../lib/services/common'
import { declineInvitation, submitOffer } from '../../lib/services/demand'
import { currentIdentity } from '../identity'

const PATH = '/einladungen'

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

export async function declineInvitationAction(formData: FormData): Promise<void> {
  const { identity, hint } = await currentIdentity()
  if (identity === null) back({ ok: false, error: hint ?? 'Keine Identität.' })
  back(
    await declineInvitation(identity, {
      invitationId: text(formData, 'invitationId'),
      declineReason: text(formData, 'declineReason'),
    }),
  )
}

export async function submitOfferAction(formData: FormData): Promise<void> {
  const { identity, hint } = await currentIdentity()
  if (identity === null) back({ ok: false, error: hint ?? 'Keine Identität.' })
  const availableFrom = date(formData, 'availableFrom')
  if (availableFrom === null) {
    back({ ok: false, error: '„Verfügbar ab" ist Pflicht (3.5).' })
  }
  back(
    await submitOffer(identity, {
      invitationId: text(formData, 'invitationId'),
      availableFrom,
      offeredHeadcount: decimal(formData, 'offeredHeadcount') ?? 1,
      qualificationLevel: text(formData, 'qualificationLevel'),
      itemHeadcount: decimal(formData, 'itemHeadcount') ?? 1,
      hourlyRate: decimal(formData, 'hourlyRate') ?? 0,
      offerValidUntil: moment(formData, 'offerValidUntil'),
      note: optionalText(formData, 'note'),
    }),
  )
}
