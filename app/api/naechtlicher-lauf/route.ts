/**
 * Zugang für den **Planer außerhalb des Systems** (SPEC 5.5.1, „Wer den Lauf
 * auslöst").
 *
 * Das System führt keine eigene Uhr: ein Anwendungsprozess ist kein Planer,
 * und ein zweiter Prozess, der wartet, wäre eine zweite Quelle der Wahrheit
 * über die Zeit. Stattdessen gibt es diese eine Adresse, die ein beliebiger
 * Planer zur Fälligkeitszeit aufruft — welcher, hängt vom Hoster ab
 * (*offene Frage 2*) und steht nicht im Anwendungscode.
 *
 * **Der Aufruf ist kein Befehl, sondern eine Nachfrage.** Ob gelaufen wird,
 * entscheidet der Zeitplan (5.5.1) und nicht der Anrufer: ein Planer, der zu
 * früh oder zweimal ruft, löst nichts aus. Deshalb genügt hier ein geteiltes
 * Geheimnis aus der Umgebung; eine Rollenprüfung gibt es nicht, weil es keinen
 * Benutzer gibt — im Protokoll ist der Handelnde der Systemlauf (4.0,
 * Regel 10).
 *
 * Ohne gesetztes Geheimnis ist der Zugang **zu**. Ein offener Auslöser wäre
 * im Prototyp so wenig vertretbar wie im Betrieb.
 */

import { timingSafeEqual } from 'node:crypto'
import { NextResponse } from 'next/server'
import {
  ladeLaufstand,
  laufAusfallstufe,
  runNightlyScheduled,
} from '../../../lib/services/nightly'

export const dynamic = 'force-dynamic'

/** Vergleicht ohne Laufzeitunterschied; ungleich lange Werte sind ungleich. */
function gleich(a: string, b: string): boolean {
  const links = Buffer.from(a)
  const rechts = Buffer.from(b)
  return links.length === rechts.length && timingSafeEqual(links, rechts)
}

function abgewiesen(): NextResponse {
  return NextResponse.json({ ok: false, error: 'Nicht berechtigt.' }, { status: 401 })
}

function geprueft(request: Request): boolean {
  const geheimnis = process.env.NIGHTLY_RUN_TOKEN
  if (geheimnis === undefined || geheimnis === '') return false
  const kopf = request.headers.get('authorization') ?? ''
  const vorgelegt = kopf.startsWith('Bearer ') ? kopf.slice('Bearer '.length) : ''
  return vorgelegt !== '' && gleich(vorgelegt, geheimnis)
}

/** Der Lauf selbst — ausgeführt wird nur, was nach 5.5.1 fällig ist. */
export async function POST(request: Request): Promise<NextResponse> {
  if (!geprueft(request)) return abgewiesen()
  const ergebnis = await runNightlyScheduled()
  return NextResponse.json(
    { ok: ergebnis.ok, message: ergebnis.ok ? ergebnis.message : ergebnis.error },
    { status: ergebnis.ok ? 200 : 500 },
  )
}

/**
 * Der Stand ohne Lauf — damit ein Planer (oder eine Überwachung) nachsehen
 * kann, ob etwas aussteht, ohne etwas auszulösen.
 *
 * **Für die Überwachung außerhalb des Systems** (5.5.1): die Nachricht über
 * einen ausgebliebenen Lauf entsteht im Lauf, und bleibt er weg, bleibt auch
 * sie weg. Wer den Ausfall **während** des Ausfalls bemerken will, fragt hier.
 * Mitgegeben wird deshalb auch die **Stufe** und nicht nur die Zahl der Tage:
 * eine Überwachung soll die Schwelle aus 5.5.1 nicht nachbauen müssen.
 *
 * Der Status bleibt 200, auch wenn Läufe fehlen: die Anwendung antwortet, der
 * Planer ist das Problem. Das Urteil steht im Inhalt, nicht im Statuscode.
 */
export async function GET(request: Request): Promise<NextResponse> {
  if (!geprueft(request)) return abgewiesen()
  const stand = await ladeLaufstand()
  return NextResponse.json({
    ok: true,
    stichtag: stand.stichtag.toISOString().slice(0, 10),
    faelligSeit: stand.faelligSeit.toISOString(),
    naechsteFaelligkeit: stand.naechsteFaelligkeit.toISOString(),
    faellig: stand.faellig,
    offen: stand.offen,
    ausfallstufe: laufAusfallstufe(stand),
    ausgefalleneTage: stand.ausgefalleneTage,
    ausgefallen: stand.ausgefallen.map((tag) => tag.toISOString().slice(0, 10)),
  })
}
