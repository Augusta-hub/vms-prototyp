/**
 * Zugang für den **Planer außerhalb des Systems** — SPEC 5.5.1 („Wer den Lauf
 * auslöst") und 3.14 („Zustellweg").
 *
 * Zwei Adressen werden von außen gerufen: der nächtliche Lauf und der
 * Postausgang. Beide haben keinen Benutzer — im Protokoll ist der Handelnde
 * der Systemlauf (4.0, Regel 10) —, deshalb gibt es hier keine Rollenprüfung,
 * sondern ein geteiltes Geheimnis aus der Umgebung.
 *
 * **Ein Geheimnis für beide.** Es ist derselbe Anrufer: wer den Lauf anstoßen
 * darf, darf auch das versenden lassen, was er erzeugt. Ein zweites Geheimnis
 * wäre eine zweite Stelle, an der es ablaufen oder fehlen kann, ohne einen
 * zusätzlichen Fall zu trennen.
 *
 * **Ohne gesetztes Geheimnis ist der Zugang zu.** Ein offener Auslöser wäre im
 * Prototyp so wenig vertretbar wie im Betrieb.
 */
import { timingSafeEqual } from 'node:crypto'

/** Vergleicht ohne Laufzeitunterschied; ungleich lange Werte sind ungleich. */
function gleich(a: string, b: string): boolean {
  const links = Buffer.from(a)
  const rechts = Buffer.from(b)
  return links.length === rechts.length && timingSafeEqual(links, rechts)
}

export function planerGeprueft(
  request: Request,
  umgebung: Readonly<Record<string, string | undefined>> = process.env,
): boolean {
  const geheimnis = umgebung.NIGHTLY_RUN_TOKEN
  if (geheimnis === undefined || geheimnis === '') return false
  const kopf = request.headers.get('authorization') ?? ''
  const vorgelegt = kopf.startsWith('Bearer ') ? kopf.slice('Bearer '.length) : ''
  return vorgelegt !== '' && gleich(vorgelegt, geheimnis)
}
