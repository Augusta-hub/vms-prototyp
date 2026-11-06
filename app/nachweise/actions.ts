'use server'

/**
 * Server-Handlungen zu den Nachweisen (SPEC 3.10, Fluss 5.4.3): einstellen,
 * anerkennen, zurückweisen.
 *
 * Die Handlungen entscheiden nichts — jede ruft den Dienst, und der prüft
 * Rechte (2.2), Invarianten (3.10) und den Übergang (5.4.3).
 */
import { redirect } from 'next/navigation'
import type { ActionResult } from '../../lib/services/common'
import {
  acceptDocument,
  rejectDocument,
  submitDocument,
  type NewDocumentInput,
} from '../../lib/services/documents'
import { currentIdentity } from '../identity'

const PATH = '/nachweise'

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

function day(formData: FormData, field: string): Date | null {
  const value = optionalText(formData, field)
  return value === null ? null : new Date(`${value}T00:00:00.000Z`)
}

export async function submitDocumentAction(formData: FormData): Promise<void> {
  const { identity, hint } = await currentIdentity()
  if (identity === null) back({ ok: false, error: hint ?? 'Keine Identität.' })

  // Das Bezugsobjekt kommt als „Art:Kennung" aus **einer** Auswahlliste: 3.10
  // lässt genau einen Verweis zu, und zwei getrennte Felder könnten zwei
  // tragen.
  const [subjectType, subjectId] = text(formData, 'subject').split(':')
  back(
    await submitDocument(identity, {
      documentCategory: text(formData, 'documentCategory') as NewDocumentInput['documentCategory'],
      subjectType: (subjectType ?? '') as NewDocumentInput['subjectType'],
      subjectId: subjectId ?? '',
      fileName: text(formData, 'fileName'),
      mimeType: text(formData, 'mimeType'),
      issuer: optionalText(formData, 'issuer'),
      issuedOn: day(formData, 'issuedOn'),
      validFrom: day(formData, 'validFrom'),
      validTo: day(formData, 'validTo'),
      confidentiality: text(formData, 'confidentiality') as NewDocumentInput['confidentiality'],
    }),
  )
}

export async function acceptDocumentAction(formData: FormData): Promise<void> {
  const { identity, hint } = await currentIdentity()
  if (identity === null) back({ ok: false, error: hint ?? 'Keine Identität.' })
  back(
    await acceptDocument(identity, {
      documentId: text(formData, 'documentId'),
      rejectionReason: null,
      validToDeliberatelyOpen: formData.get('validToDeliberatelyOpen') === 'ja',
    }),
  )
}

export async function rejectDocumentAction(formData: FormData): Promise<void> {
  const { identity, hint } = await currentIdentity()
  if (identity === null) back({ ok: false, error: hint ?? 'Keine Identität.' })
  back(
    await rejectDocument(identity, {
      documentId: text(formData, 'documentId'),
      rejectionReason: text(formData, 'rejectionReason'),
    }),
  )
}
