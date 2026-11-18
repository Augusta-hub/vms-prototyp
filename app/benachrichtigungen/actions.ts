'use server'

/**
 * Server-Handlungen der Benachrichtigungsseite (SPEC 3.14, 5.5.1).
 *
 * Drei — und keine ändert eine Benachrichtigung. Die Zeile in 2.2 trägt nur
 * `L`, und das ist kein Versehen: eine Benachrichtigung ist eine Feststellung,
 * und Feststellungen werden nicht bearbeitet (3.14). Der **Lesevermerk** ist
 * deshalb ein eigenes Objekt neben ihr, der **Postausgang** arbeitet
 * Zustellaufträge ab, und der **nächtliche Lauf** erzeugt Nachrichten.
 */
import { redirect } from 'next/navigation'
import { currentIdentity } from '../identity'
import type { ActionResult } from '../../lib/services/common'
import { runNightly } from '../../lib/services/nightly'
import {
  alsGelesenMarkieren,
  darfPostausgangAbarbeiten,
  postausgangAbarbeiten,
} from '../../lib/services/zustellung'

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

/**
 * Setzt den eigenen Lesevermerk (3.14).
 *
 * Der Leser ist immer der Handelnde: die Handlung nimmt keine Benutzerkennung
 * an, nur die Nachricht. Ein fremder Lesevermerk ist damit nicht ausdrückbar.
 */
export async function alsGelesenAction(formData: FormData): Promise<void> {
  const { identity, hint } = await currentIdentity()
  if (identity === null) back({ ok: false, error: hint ?? 'Keine Identität.' })
  const id = formData.get('id')
  if (typeof id !== 'string' || id === '') back({ ok: false, error: 'Keine Nachricht angegeben.' })
  back(await alsGelesenMarkieren(identity, id))
}

/**
 * Arbeitet den Postausgang ab (3.14).
 *
 * Im Betrieb ruft der Planer `POST /api/zustellung`; hier gibt es einen Knopf,
 * damit der Versand **sichtbar** ist — wie beim Lauf. Am Verfahren ändert das
 * nichts: zugestellt wird, was offen ist, und ohne konfigurierten Mailweg
 * nichts.
 */
export async function postausgangAction(): Promise<void> {
  const { identity, hint } = await currentIdentity()
  if (identity === null) back({ ok: false, error: hint ?? 'Keine Identität.' })
  if (!darfPostausgangAbarbeiten(identity)) {
    back({
      ok: false,
      error:
        'Den Postausgang abzuarbeiten ist dem Betreiberadministrator vorbehalten: er versendet ' +
        'Nachrichten über alle Mandanten hinweg (2.3, 3.14).',
      specReference: 'SPEC 2.3; 3.14',
    })
  }
  const ergebnis = await postausgangAbarbeiten()
  if (ergebnis.grund !== '') {
    back({
      ok: false,
      error: `Es ging nichts hinaus — ${ergebnis.grund} ${ergebnis.offen} Auftrag/Aufträge bleiben offen (3.14).`,
      specReference: 'SPEC 3.14, 6.8',
    })
  }
  back({
    ok: true,
    message:
      `Postausgang: ${ergebnis.zugestellt} zugestellt, ${ergebnis.unterblieben} unterblieben (2.3), ` +
      `${ergebnis.gescheitert} gescheitert, ${ergebnis.offen} weiter offen (3.14).`,
  })
}
