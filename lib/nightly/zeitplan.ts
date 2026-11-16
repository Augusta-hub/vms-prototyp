/**
 * Der Zeitplan des nächtlichen Laufs — SPEC **5.5.1**, „Zeitplan des Laufs".
 *
 * Hier wird nur **gerechnet**: wann der Lauf eines Kalendertages fällig wird,
 * welcher Stichtag jetzt an der Reihe ist und welche Tage ausgefallen sind.
 * Nichts davon berührt die Datenbank, und nichts davon liest die Uhr selbst —
 * `jetzt` kommt immer von außen. Ein Zeitplan, der sich nicht auf einen
 * Zeitpunkt festlegen lässt, ist nicht nachrechenbar.
 *
 * **Gerechnet wird in der Zeitzone des Betreibers**, nicht nach Weltzeit
 * (5.5.1). Die Kalendertage dieses Verfahrens sind deutsche Geschäftstage; ein
 * Lauf nach Weltzeit läge an zwei Tagen des Jahres auf dem falschen Tag.
 * Stichtage werden wie überall im System als **UTC-Mitternacht** des
 * Kalendertages geführt (3.7) — das ist eine Darstellung, keine Zeitzone.
 */

import type { Laufkonfiguration } from '../aueg/regelwerk'

/**
 * Der Teil des Zeitplans, aus dem sich Fälligkeit und Stichtag ergeben. Die
 * Warnschwelle gehört nicht dazu: sie beurteilt den Ausfall, sie rechnet keine
 * Zeit. Jede Funktion nimmt, was sie braucht.
 */
export type Zeitangabe = Pick<Laufkonfiguration, 'uhrzeit' | 'zeitzone'>

/** Der Stand des Laufs zu einem Zeitpunkt (5.5.1). */
export interface Laufstand {
  /**
   * Der Stichtag eines Laufs, der **jetzt** stattfände: der heutige
   * Kalendertag in der Zeitzone des Laufs (UTC-Mitternacht).
   *
   * 5.5.1 lässt hier keine Wahl — „Stichtag ist der Tag des Laufs". Ein Lauf
   * von heute trägt deshalb nie den Stichtag von gestern, auch wenn der Lauf
   * von gestern ausgefallen ist.
   */
  readonly stichtag: Date
  /** Zeitpunkt, zu dem der Lauf dieses Stichtags fällig wird. */
  readonly faelligSeit: Date
  /** Ist die Fälligkeitszeit dieses Stichtags erreicht? */
  readonly faellig: boolean
  /** Der nächste Zeitpunkt, zu dem ein Lauf fällig wird. */
  readonly naechsteFaelligkeit: Date
  /**
   * Ist der Lauf fällig und noch nicht gelaufen? Nur dann hat ein Planer
   * etwas zu tun.
   */
  readonly offen: boolean
  /**
   * Fällige Stichtage **vor** dem heutigen, zu denen kein Lauf stattgefunden
   * hat (`missedRun`, 5.5.1). Sie werden nicht nachgeholt, sondern
   * ausgewiesen: ohne sie wäre „nichts gemeldet" nicht von „nicht gelaufen"
   * zu unterscheiden.
   */
  readonly ausgefallen: readonly Date[]
  /**
   * Zahl der ausgefallenen Tage insgesamt — `ausgefallen` ist auf
   * `hoechstens` gekürzt, damit eine lange Pause keine endlose Liste erzeugt.
   */
  readonly ausgefalleneTage: number
}

const TAG_IN_MS = 86_400_000

/** Vorbelegung für `hoechstens`: so viele ausgefallene Tage werden benannt. */
export const HOECHSTENS_AUSGEFALLEN = 30

/**
 * Der Kalendertag eines Zeitpunkts in der Zeitzone des Laufs, als
 * UTC-Mitternacht.
 *
 * `en-CA` liefert `YYYY-MM-DD` und ist damit die kürzeste verlässliche Form;
 * die Sprache wählt hier das Format, nicht die Sprache der Oberfläche.
 */
export function stichtagAm(zeitpunkt: Date, zeitplan: Zeitangabe): Date {
  const datum = new Intl.DateTimeFormat('en-CA', {
    timeZone: zeitplan.zeitzone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(zeitpunkt)
  return new Date(`${datum}T00:00:00.000Z`)
}

/**
 * Der Versatz der Zone gegenüber der Weltzeit zu diesem Zeitpunkt, in
 * Millisekunden. Gelesen wird die **Wanduhr** der Zone und mit der Weltzeit
 * verglichen — so braucht es keine Tabelle der Sommerzeitregeln.
 */
function zonenversatz(zeitpunkt: Date, zeitzone: string): number {
  const teile = new Intl.DateTimeFormat('en-US', {
    timeZone: zeitzone,
    // **`hourCycle`, nicht `hour12: false`.** Letzteres liefert für Mitternacht
    // je nach Umgebung „24" und verschöbe den Versatz um einen Tag; `h23` ist
    // auf 00 bis 23 festgelegt. Ein Sonderfall, den man abfangen müsste, ist
    // besser ein Sonderfall, den es nicht gibt.
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(zeitpunkt)
  const wert = (art: string): number => Number(teile.find((teil) => teil.type === art)?.value ?? '0')
  const wanduhr = Date.UTC(
    wert('year'),
    wert('month') - 1,
    wert('day'),
    wert('hour'),
    wert('minute'),
    wert('second'),
  )
  return wanduhr - zeitpunkt.getTime()
}

/** `HH:MM` als Minuten seit Mitternacht; unleserliche Werte gelten als 00:00. */
function minutenDerUhrzeit(uhrzeit: string): number {
  const treffer = /^(\d{1,2}):(\d{2})$/.exec(uhrzeit.trim())
  if (treffer === null) return 0
  const stunden = Number(treffer[1])
  const minuten = Number(treffer[2])
  if (stunden > 23 || minuten > 59) return 0
  return stunden * 60 + minuten
}

/**
 * Der Zeitpunkt, zu dem der Lauf dieses Stichtags fällig wird.
 *
 * Gesucht ist die Weltzeit zu einer **Wanduhrzeit** in der Zone. Der Versatz
 * hängt vom Ergebnis ab (Sommerzeit), deshalb wird er zweimal gelesen: einmal
 * geschätzt, einmal am gefundenen Zeitpunkt bestätigt. Mehr braucht es nicht —
 * die Zeitzonen der Welt springen um höchstens eine Stunde.
 */
export function faelligkeitDes(stichtag: Date, zeitplan: Zeitangabe): Date {
  const wanduhr = stichtag.getTime() + minutenDerUhrzeit(zeitplan.uhrzeit) * 60_000
  const erste = new Date(wanduhr - zonenversatz(new Date(wanduhr), zeitplan.zeitzone))
  return new Date(wanduhr - zonenversatz(erste, zeitplan.zeitzone))
}

/**
 * Der Stand des Laufs (5.5.1).
 *
 * `letzterStichtag` ist der Stichtag des jüngsten verzeichneten Laufs, oder
 * `null`, wenn es keinen gibt. Ohne ihn lässt sich **keine** Lücke benennen:
 * seit wann das System laufen sollte, weiß es nicht, und eine geratene Lücke
 * wäre schlimmer als keine.
 */
export function laufstand(args: {
  readonly jetzt: Date
  readonly letzterStichtag: Date | null
  readonly zeitplan: Zeitangabe
  readonly hoechstens?: number
}): Laufstand {
  const { jetzt, letzterStichtag, zeitplan } = args
  const hoechstens = args.hoechstens ?? HOECHSTENS_AUSGEFALLEN
  // **Ein** Stichtag, an einer Stelle gerechnet: der heutige Kalendertag der
  // Zone. Würde der Stand ihn anders bestimmen als der Lauf selbst, trüge ein
  // Lauf den Stichtag eines anderen Tages — der Fehler, den 5.5.1 mit „Stichtag
  // ist der Tag des Laufs" ausschließt.
  const stichtag = stichtagAm(jetzt, zeitplan)
  const faelligSeit = faelligkeitDes(stichtag, zeitplan)
  const faellig = faelligSeit.getTime() <= jetzt.getTime()
  const naechsteFaelligkeit = faellig
    ? faelligkeitDes(new Date(stichtag.getTime() + TAG_IN_MS), zeitplan)
    : faelligSeit

  const ausgefallen: Date[] = []
  let ausgefalleneTage = 0
  if (letzterStichtag !== null) {
    for (
      let tag = letzterStichtag.getTime() + TAG_IN_MS;
      tag < stichtag.getTime();
      tag += TAG_IN_MS
    ) {
      ausgefalleneTage += 1
      if (ausgefallen.length < hoechstens) ausgefallen.push(new Date(tag))
    }
  }

  return {
    stichtag,
    faelligSeit,
    faellig,
    naechsteFaelligkeit,
    // Der heutige Stichtag steht aus, solange seine Zeit erreicht ist und kein
    // Lauf ihn trägt. Er ist **nicht** ausgefallen: er kann noch stattfinden.
    offen:
      faellig && (letzterStichtag === null || letzterStichtag.getTime() < stichtag.getTime()),
    ausgefallen,
    ausgefalleneTage,
  }
}

/**
 * Die Stufe eines Ausfalls (5.5.1, Tabelle „Der ausgebliebene Lauf wird
 * gemeldet").
 *
 * Gestuft wird nach der Zahl der ausgefallenen Tage: keiner ist kein Befund,
 * wenige sind eine Information, ab der Warnschwelle ist es eine Warnung mit
 * Eskalation. Die Schwelle kommt aus dem Regelwerk und steht nicht hier.
 */
export type Ausfallstufe = 'keine' | 'information' | 'warnung'

export function ausfallstufe(
  ausgefalleneTage: number,
  zeitplan: Pick<Laufkonfiguration, 'ausfallWarnungTage'>,
): Ausfallstufe {
  if (ausgefalleneTage <= 0) return 'keine'
  return ausgefalleneTage >= zeitplan.ausfallWarnungTage ? 'warnung' : 'information'
}
