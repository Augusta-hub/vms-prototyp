/**
 * Zuschläge an einer Zeitposition — SPEC **3.8**, Entscheidung zu *Frage 16*.
 *
 * Die Entscheidung lautet: **beide** Erfassungsformen. Daraus folgt die Frage,
 * die dieses Modul beantwortet — **welcher Zuschlag lässt sich aus welcher
 * Position rechnen?** Aus einer Tagessumme folgt kein Nachtzuschlag: sie trägt
 * keine Uhrzeit. Deshalb trägt jede Zuschlagsart ihre
 * **Ableitungsgrundlage** (`derivationBasis`) und jeder Zuschlag an einer
 * Position seine **Herkunft** (`derived` oder `declared`).
 *
 * **Dieses Modul rechnet, es liest nicht.** Keine Datenbank, keine Rechte —
 * dieselbe Linie wie `lib/aueg/`: eine Lage hinein, ein Ergebnis heraus.
 *
 * **Was es nicht entscheidet.** Wie gerundet wird, ist *offene Frage 48* —
 * gerechnet wird ungerundet. Und wie eine **Pause** auf die Zuschlagsfenster
 * verteilt wird, ist *offene Frage 50*: wo im Abschnitt sie lag, weiß die
 * Position nicht. Bis zur Antwort wird die Überdeckung **brutto** gerechnet
 * und auf die bezahlten Stunden **begrenzt** — ein Zuschlag für mehr Stunden,
 * als gearbeitet wurden, wäre in jedem Fall falsch.
 */
import { MINUTEN_JE_TAG, erfassungsform } from '../masterdata/invariants'

/** Woraus sich die Stunden einer Zuschlagsart rechnen lassen (3.8). */
export type Ableitungsgrundlage = 'timeOfDay' | 'calendarDay' | 'weeklyTotal' | 'manual'

/** Herkunft eines Zuschlags an einer Position (3.8). */
export type Zuschlagsherkunft = 'derived' | 'declared'

/** Eine Zuschlagsart, soweit die Ableitung sie braucht (3.8). */
export interface Zuschlagsart {
  readonly id: string
  readonly code: string
  readonly derivationBasis: Ableitungsgrundlage
  /** Nur bei `timeOfDay`: das Fenster als Minuten seit Mitternacht. */
  readonly fromMinute: number | null
  readonly toMinute: number | null
  /** Nur bei `calendarDay`: die Wochentage, an denen der Zuschlag anfällt. */
  readonly weekdays?: readonly number[]
}

/** Eine Zeitposition, soweit die Ableitung sie braucht (3.8). */
export interface Zeitposition {
  readonly workDate: Date
  readonly startMinute: number | null
  readonly endMinute: number | null
  readonly breakMinutes: number | null
  readonly hours: number
}

export interface AbgeleiteterZuschlag {
  readonly premiumTypeId: string
  readonly hours: number
  readonly origin: Zuschlagsherkunft
}

/**
 * Lässt sich diese Zuschlagsart aus dieser Position **rechnen**?
 *
 * Das ist die Kernfrage der Entscheidung zu *Frage 16*, und sie hat vier
 * Antworten:
 *
 *  - `timeOfDay` braucht einen **Abschnitt** und ein Fenster. An einer
 *    Tagessumme ist sie nicht ableitbar.
 *  - `calendarDay` braucht nur den Tag — beide Formen tragen ihn.
 *  - `weeklyTotal` braucht die Summe der **Woche** und damit mehr als eine
 *    Position. Aus einer einzelnen Position folgt sie nie.
 *  - `manual` ist nie ableitbar; der Anlass steht nicht in den Daten
 *    (Erschwernis).
 */
export function istAbleitbar(art: Zuschlagsart, position: Zeitposition): boolean {
  switch (art.derivationBasis) {
    case 'timeOfDay':
      return (
        erfassungsform(position) === 'interval' &&
        art.fromMinute !== null &&
        art.toMinute !== null
      )
    case 'calendarDay':
      return true
    case 'weeklyTotal':
    case 'manual':
      return false
  }
}

/**
 * Die Stunden, die eine ableitbare Zuschlagsart an dieser Position ergibt.
 *
 * `timeOfDay`: die Überdeckung des Abschnitts mit dem Fenster. Beide dürfen
 * über Mitternacht laufen — der Nachtzuschlag von 23:00 bis 06:00 und die
 * Nachtschicht von 22:00 bis 06:30 sind der Regelfall, nicht die Ausnahme.
 * Gerechnet wird auf einer Achse von 48 Stunden, damit kein Fall eine eigene
 * Verzweigung braucht.
 *
 * `calendarDay`: die **ganzen** Stunden der Position, wenn der Wochentag
 * passt. Ein Sonntagszuschlag gilt für den Tag, nicht für ein Fenster.
 */
export function abgeleiteteStunden(art: Zuschlagsart, position: Zeitposition): number {
  if (!istAbleitbar(art, position)) return 0

  if (art.derivationBasis === 'calendarDay') {
    const tage = art.weekdays
    if (tage === undefined || tage.length === 0) return 0
    return tage.includes(position.workDate.getUTCDay()) ? position.hours : 0
  }

  const start = position.startMinute ?? 0
  const ende = position.endMinute ?? 0
  const abschnittVon = start
  const abschnittBis = ende > start ? ende : ende + MINUTEN_JE_TAG

  const fensterVon = art.fromMinute ?? 0
  const fensterBis = art.toMinute ?? 0
  // Das Fenster zweimal auf die Achse legen — einmal für den Beginntag, einmal
  // für den Folgetag. Ein Fenster über Mitternacht wird dabei aufgeteilt.
  const fenster: readonly (readonly [number, number])[] =
    fensterBis > fensterVon
      ? [
          [fensterVon, fensterBis],
          [fensterVon + MINUTEN_JE_TAG, fensterBis + MINUTEN_JE_TAG],
        ]
      : [
          [0, fensterBis],
          [fensterVon, fensterBis + MINUTEN_JE_TAG],
          [fensterVon + MINUTEN_JE_TAG, fensterBis + 2 * MINUTEN_JE_TAG],
        ]

  let minuten = 0
  for (const [von, bis] of fenster) {
    minuten += Math.max(0, Math.min(abschnittBis, bis) - Math.max(abschnittVon, von))
  }

  // Begrenzt auf die bezahlten Stunden: wo im Abschnitt die Pause lag, weiß
  // die Position nicht (*offene Frage 50*) — mehr Zuschlagsstunden als
  // Arbeitsstunden wären aber in jedem Fall falsch.
  return Math.min(minuten / 60, position.hours)
}

/**
 * Die Zuschläge einer Position: abgeleitete und angegebene zusammen.
 *
 * `angegeben` sind die von Hand eingetragenen Zuschläge. Sie werden
 * **nicht** überschrieben, wenn dieselbe Art auch ableitbar wäre: die Angabe
 * einer Person geht der Rechnung vor, und ihre Herkunft bleibt `declared`, bis
 * jemand sie entfernt. Welche von beiden eine freigebende Stufe sieht,
 * entscheidet dann sie (4.4).
 */
export function zuschlaegeDerPosition(
  position: Zeitposition,
  arten: readonly Zuschlagsart[],
  angegeben: readonly { readonly premiumTypeId: string; readonly hours: number }[] = [],
): readonly AbgeleiteterZuschlag[] {
  const vonHand = new Map(angegeben.map((eintrag) => [eintrag.premiumTypeId, eintrag.hours]))
  const ergebnis: AbgeleiteterZuschlag[] = []

  for (const art of arten) {
    const angabe = vonHand.get(art.id)
    if (angabe !== undefined) {
      if (angabe > 0) {
        ergebnis.push({ premiumTypeId: art.id, hours: angabe, origin: 'declared' })
      }
      continue
    }
    const stunden = abgeleiteteStunden(art, position)
    if (stunden > 0) {
      ergebnis.push({ premiumTypeId: art.id, hours: stunden, origin: 'derived' })
    }
  }

  // Angegebene Zuschläge zu Arten, die hier nicht im Katalog stehen, bleiben
  // erhalten: der Katalog kann sich ändern, eine getroffene Angabe nicht.
  for (const [premiumTypeId, hours] of vonHand) {
    if (arten.some((art) => art.id === premiumTypeId)) continue
    if (hours > 0) ergebnis.push({ premiumTypeId, hours, origin: 'declared' })
  }

  return ergebnis
}
