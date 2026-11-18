/**
 * Zugang für den **Planer außerhalb des Systems** zum Postausgang — SPEC 3.14
 * („Zustellweg", „Zustellung").
 *
 * Der nächtliche Lauf stellt zu, was er erzeugt (5.5.1). Die Nachrichten aus
 * den **Übergängen** entstehen aber über den Tag verteilt, und auf die nächste
 * Nacht zu warten hieße, eine Warnung aus 4.7 um bis zu einem Tag zu
 * verzögern. Deshalb gibt es diese Adresse: derselbe Planer ruft sie in
 * kürzerem Abstand.
 *
 * **Der Aufruf sendet nur, was offen ist.** Ein Planer, der zu oft ruft, löst
 * nichts Doppeltes aus — ein zugestellter Auftrag ist `sent` und wird nicht
 * erneut betrachtet (3.14, Eindeutigkeit). Ohne konfigurierten Mailweg wird
 * nichts angefasst; die Antwort sagt dann, warum.
 *
 * Der Status bleibt 200, auch wenn kein Weg besteht: die Anwendung antwortet,
 * die Umgebung ist unvollständig. Das Urteil steht im Inhalt, nicht im
 * Statuscode — wie beim Lauf.
 */
import { NextResponse } from 'next/server'
import { planerGeprueft } from '../../../lib/api/planer'
import { ladePostausgangsstand, postausgangAbarbeiten } from '../../../lib/services/zustellung'

export const dynamic = 'force-dynamic'

function abgewiesen(): NextResponse {
  return NextResponse.json({ ok: false, error: 'Nicht berechtigt.' }, { status: 401 })
}

/** Arbeitet den Postausgang ab. */
export async function POST(request: Request): Promise<NextResponse> {
  if (!planerGeprueft(request)) return abgewiesen()
  const ergebnis = await postausgangAbarbeiten()
  return NextResponse.json({
    ok: true,
    weg: ergebnis.grund === '' ? 'konfiguriert' : null,
    grund: ergebnis.grund === '' ? null : ergebnis.grund,
    betrachtet: ergebnis.betrachtet,
    zugestellt: ergebnis.zugestellt,
    unterblieben: ergebnis.unterblieben,
    gescheitert: ergebnis.gescheitert,
    offen: ergebnis.offen,
  })
}

/**
 * Der Stand ohne Versand — für eine Überwachung außerhalb des Systems.
 *
 * Sie soll sehen können, dass Aufträge liegen bleiben, **ohne** einen Versand
 * auszulösen: ein Postausgang, der wächst, ist derselbe Befund wie ein
 * ausgebliebener Lauf (5.5.1), nur an anderer Stelle.
 */
export async function GET(request: Request): Promise<NextResponse> {
  if (!planerGeprueft(request)) return abgewiesen()
  const stand = await ladePostausgangsstand()
  return NextResponse.json({
    ok: true,
    weg: stand.weg,
    grund: stand.grund === '' ? null : stand.grund,
    offen: stand.offen,
    zugestellt: stand.zugestellt,
    unterblieben: stand.unterblieben,
    gescheitert: stand.gescheitert,
  })
}
