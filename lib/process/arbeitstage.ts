/**
 * Arbeitstage und Feiertage der Prozessfristen — SPEC **4.0**, „Was ein
 * Arbeitstag ist".
 *
 * Ein Arbeitstag ist Montag bis Freitag ohne gesetzlichen Feiertag des
 * maßgeblichen **Bundeslands**. Maßgeblich ist das Land des **Standorts des
 * Vorgangs** (3.1): der Vorgang hat einen Einsatzort, und der ist für alle
 * Beteiligten derselbe — nicht der Sitz des Lieferanten und nicht der des
 * Betreibers. Fehlt das Bundesland, gelten **nur** die bundeseinheitlichen
 * Feiertage.
 *
 * **Abgrenzung zu `lib/aueg/kalender.ts`.** Dort wird in **Kalendertagen**
 * gerechnet, und das ausdrücklich: 5.0 schreibt „keine Arbeitstage" für die
 * AÜG-Fristen. Arbeitstage gibt es nur bei den Prozessfristen aus 4.0, und
 * deshalb stehen sie hier. Die Tagesarithmetik selbst kommt aus dem
 * AÜG-Kalender — ein zweiter Begriff von „Tag" wäre eine zweite Fehlerquelle.
 *
 * **Ostersonntag wird gerechnet**, nicht gepflegt: eine Tabelle müsste jedes
 * Jahr erweitert werden, und ein fehlendes Jahr wäre ein stillschweigend
 * falscher Kalender.
 */
import { istVorOderGleich, tag, tagVersetzt, type Tag } from '../aueg/kalender'

/** Die 16 Länder in den Kürzeln aus 4.0. */
export type Bundesland =
  | 'BW'
  | 'BY'
  | 'BE'
  | 'BB'
  | 'HB'
  | 'HH'
  | 'HE'
  | 'MV'
  | 'NI'
  | 'NW'
  | 'RP'
  | 'SL'
  | 'SN'
  | 'ST'
  | 'SH'
  | 'TH'

/**
 * Ostersonntag des Jahres nach der gregorianischen Osterformel (Gauß, in der
 * Fassung von Lichtenberg).
 *
 * Die Zahlen sind die Formel und keine Magie: `a` bis `d` bestimmen den
 * Frühlingsvollmond, der Rest verschiebt auf den folgenden Sonntag. Geprüft
 * wird sie an bekannten Jahren in `arbeitstage.test.ts` — eine Formel ohne
 * Stützpunkte wäre eine Behauptung.
 */
export function ostersonntag(jahr: number): Tag {
  const a = jahr % 19
  const b = Math.floor(jahr / 100)
  const c = jahr % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const monat = Math.floor((h + l - 7 * m + 114) / 31)
  const tagImMonat = ((h + l - 7 * m + 114) % 31) + 1
  return tag(
    `${jahr}-${String(monat).padStart(2, '0')}-${String(tagImMonat).padStart(2, '0')}`,
  )
}

/** Ein Feiertag: fester Tag im Jahr oder Abstand zum Ostersonntag. */
interface Feiertagsregel {
  readonly name: string
  /** `MM-TT` für einen festen Tag. */
  readonly datum?: string
  /** Tage nach Ostersonntag; negativ für davor. */
  readonly ostern?: number
  /** Buß- und Bettag: Mittwoch vor dem 23. November. */
  readonly bussUndBettag?: true
  /** Leer = bundeseinheitlich. */
  readonly laender?: readonly Bundesland[]
}

/**
 * Die Tabelle aus 4.0, Zeile für Zeile.
 *
 * Gemeindegebundene Feiertage fehlen und zwar absichtlich: das Augsburger
 * Friedensfest, Mariä Himmelfahrt in Teilen Bayerns und Fronleichnam in
 * einzelnen Gemeinden Sachsens und Thüringens hängen an einer Gemeinde, nicht
 * an einem Land (*offene Frage 59*). Eine Frist endet dort einen Arbeitstag
 * früher als vor Ort.
 */
const FEIERTAGE: readonly Feiertagsregel[] = [
  { name: 'Neujahr', datum: '01-01' },
  { name: 'Karfreitag', ostern: -2 },
  { name: 'Ostermontag', ostern: 1 },
  { name: 'Tag der Arbeit', datum: '05-01' },
  { name: 'Christi Himmelfahrt', ostern: 39 },
  { name: 'Pfingstmontag', ostern: 50 },
  { name: 'Tag der Deutschen Einheit', datum: '10-03' },
  { name: '1. Weihnachtstag', datum: '12-25' },
  { name: '2. Weihnachtstag', datum: '12-26' },
  { name: 'Heilige Drei Könige', datum: '01-06', laender: ['BW', 'BY', 'ST'] },
  { name: 'Internationaler Frauentag', datum: '03-08', laender: ['BE', 'MV'] },
  { name: 'Fronleichnam', ostern: 60, laender: ['BW', 'BY', 'HE', 'NW', 'RP', 'SL'] },
  { name: 'Mariä Himmelfahrt', datum: '08-15', laender: ['SL'] },
  { name: 'Weltkindertag', datum: '09-20', laender: ['TH'] },
  {
    name: 'Reformationstag',
    datum: '10-31',
    laender: ['BB', 'HB', 'HH', 'MV', 'NI', 'SH', 'SN', 'ST', 'TH'],
  },
  { name: 'Allerheiligen', datum: '11-01', laender: ['BW', 'BY', 'NW', 'RP', 'SL'] },
  { name: 'Buß- und Bettag', bussUndBettag: true, laender: ['SN'] },
]

function jahrVon(wert: Tag): number {
  return Number(wert.slice(0, 4))
}

/** Wochentag: 0 = Sonntag, 6 = Samstag. */
function wochentag(wert: Tag): number {
  return new Date(`${wert}T00:00:00.000Z`).getUTCDay()
}

/** Mittwoch vor dem 23. November — der Buß- und Bettag (4.0). */
function bussUndBettag(jahr: number): Tag {
  let kandidat = tag(`${jahr}-11-22`)
  while (wochentag(kandidat) !== 3) {
    kandidat = tagVersetzt(kandidat, -1)
  }
  return kandidat
}

function tagDerRegel(regel: Feiertagsregel, jahr: number): Tag {
  if (regel.bussUndBettag === true) return bussUndBettag(jahr)
  if (regel.ostern !== undefined) return tagVersetzt(ostersonntag(jahr), regel.ostern)
  return tag(`${jahr}-${regel.datum}`)
}

/**
 * Die Feiertage eines Jahres im angegebenen Land — ohne Land nur die
 * bundeseinheitlichen (4.0).
 */
export function feiertage(
  jahr: number,
  land: Bundesland | null = null,
): ReadonlyMap<Tag, string> {
  const treffer = new Map<Tag, string>()
  for (const regel of FEIERTAGE) {
    if (regel.laender !== undefined && (land === null || !regel.laender.includes(land))) continue
    treffer.set(tagDerRegel(regel, jahr), regel.name)
  }
  return treffer
}

/** Ist dieser Tag im angegebenen Land ein Feiertag (4.0)? */
export function istFeiertag(wert: Tag, land: Bundesland | null = null): boolean {
  return feiertage(jahrVon(wert), land).has(wert)
}

/** Montag bis Freitag und kein Feiertag des Landes (4.0). */
export function istArbeitstag(wert: Tag, land: Bundesland | null = null): boolean {
  const woche = wochentag(wert)
  if (woche === 0 || woche === 6) return false
  return !istFeiertag(wert, land)
}

/**
 * Der Tag, der `anzahl` Arbeitstage nach `ausgang` liegt (4.0).
 *
 * Gezählt werden **Arbeitstage nach** dem Ausgangstag; ob der Ausgangstag
 * selbst einer ist, spielt keine Rolle — eine Frist „3 Arbeitstage ab
 * `submitted`" läuft ab dem Tag der Einreichung, und der zählt nicht mit
 * (§ 187 Abs. 1 BGB, dieselbe Zählung wie bei den Kalendertagen in 5.0).
 *
 * `anzahl` null oder negativ gibt den Ausgangstag zurück: eine Frist ohne Tage
 * ist am Ausgangstag abgelaufen.
 */
export function arbeitstageSpaeter(
  ausgang: Tag,
  anzahl: number,
  land: Bundesland | null = null,
): Tag {
  let gezaehlt = 0
  let aktuell = ausgang
  const ziel = Math.floor(anzahl)
  while (gezaehlt < ziel) {
    aktuell = tagVersetzt(aktuell, 1)
    if (istArbeitstag(aktuell, land)) gezaehlt += 1
  }
  return aktuell
}

/**
 * Die Zahl der Arbeitstage **nach** `von` bis einschließlich `bis` — und damit
 * der Abstand, den 2.4 Regel 6 für die Stufe braucht.
 *
 * Liegt `bis` nicht nach `von`, ist das Ergebnis null: eine Stufe steigt nicht
 * rückwärts.
 */
export function arbeitstageZwischen(
  von: Tag,
  bis: Tag,
  land: Bundesland | null = null,
): number {
  if (istVorOderGleich(bis, von)) return 0
  let gezaehlt = 0
  let aktuell = von
  while (!istVorOderGleich(bis, aktuell)) {
    aktuell = tagVersetzt(aktuell, 1)
    if (istArbeitstag(aktuell, land)) gezaehlt += 1
  }
  return gezaehlt
}
