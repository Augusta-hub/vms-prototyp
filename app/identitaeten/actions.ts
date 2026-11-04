'use server'

/**
 * Server-Handlungen zur Personenidentität (SPEC 3.6): Abgleich laufen lassen,
 * Verknüpfung bestätigen, Verknüpfung trennen, Identität für einen einzelnen
 * Kandidatensatz anlegen.
 */
import { redirect } from 'next/navigation'
import type { ActionResult } from '../../lib/services/common'
import {
  confirmLink,
  createIdentityForCandidate,
  detachLink,
  proposeLinks,
} from '../../lib/services/workerIdentity'
import { currentIdentity } from '../identity'

const PATH = '/identitaeten'

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

export async function proposeLinksAction(): Promise<void> {
  const { identity, hint } = await currentIdentity()
  if (identity === null) back({ ok: false, error: hint ?? 'Keine Identität.' })
  back(await proposeLinks(identity))
}

export async function confirmLinkAction(formData: FormData): Promise<void> {
  const { identity, hint } = await currentIdentity()
  if (identity === null) back({ ok: false, error: hint ?? 'Keine Identität.' })
  back(
    await confirmLink(identity, {
      linkId: text(formData, 'linkId'),
      reason: text(formData, 'reason'),
    }),
  )
}

export async function detachLinkAction(formData: FormData): Promise<void> {
  const { identity, hint } = await currentIdentity()
  if (identity === null) back({ ok: false, error: hint ?? 'Keine Identität.' })
  back(
    await detachLink(identity, {
      linkId: text(formData, 'linkId'),
      reason: text(formData, 'reason'),
    }),
  )
}

export async function createIdentityAction(formData: FormData): Promise<void> {
  const { identity, hint } = await currentIdentity()
  if (identity === null) back({ ok: false, error: hint ?? 'Keine Identität.' })
  back(
    await createIdentityForCandidate(identity, {
      candidateId: text(formData, 'candidateId'),
      reason: text(formData, 'reason'),
    }),
  )
}
