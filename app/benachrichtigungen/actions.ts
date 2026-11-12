'use server'

/**
 * Server-Handlung der Benachrichtigungsseite (SPEC 3.14, 5.5.1).
 *
 * Eine einzige: den nächtlichen Lauf anstoßen. Es gibt keine Handlung, die
 * eine Benachrichtigung ändert oder löscht — die Zeile in 2.2 trägt nur `L`,
 * und das ist kein Versehen: eine Benachrichtigung ist eine Feststellung, und
 * Feststellungen werden nicht bearbeitet (3.14).
 */
import { redirect } from 'next/navigation'
import { currentIdentity } from '../identity'
import type { ActionResult } from '../../lib/services/common'
import { runNightly } from '../../lib/services/nightly'

const PATH = '/benachrichtigungen'

function back(result: ActionResult): never {
  if (result.ok) redirect(`${PATH}?ok=${encodeURIComponent(result.message)}`)
  const text =
    result.specReference === undefined
      ? result.error
      : `${result.error} (${result.specReference})`
  redirect(`${PATH}?fehler=${encodeURIComponent(text)}`)
}

/**
 * Stößt den nächtlichen Lauf an (5.5.1 c).
 *
 * Im Betrieb liefe er aus einem Zeitplan; hier gibt es einen Knopf, damit der
 * Lauf **sichtbar** ist. Am Verfahren ändert das nichts: der Stichtag ist der
 * Tag des Laufs, und die Protokolleinträge tragen ein Systemkennzeichen, auch
 * wenn ein Mensch den Knopf drückt (4.0, Regel 10).
 */
export async function runNightlyAction(): Promise<void> {
  const { identity, hint } = await currentIdentity()
  if (identity === null) back({ ok: false, error: hint ?? 'Keine Identität.' })
  back(await runNightly(identity))
}
