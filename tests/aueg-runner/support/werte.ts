/**
 * Werte aus einem Szenariosatz lesen.
 *
 * Die Saetze in tests/aueg/ sind fachlich formuliert, nicht maschinell
 * entworfen. Statt je Satz ein eigenes Muster zu pflegen, liest dieses Modul
 * die *Daten* heraus, die ein Satz traegt: Datumsangaben, Betraege, Fristwerte,
 * Statuswerte, Feldnamen, Pruefungs- und Kriterienverweise. Was ein Satz
 * fachlich *bedeutet*, entscheidet erst die Fachlogik aus SPEC Kapitel 5 — die
 * gibt es noch nicht (Meilenstein M4).
 */

/** Deutsches Datum im Satz: TT.MM.JJJJ. */
const DATUM = /\b(\d{2})\.(\d{2})\.(\d{4})\b/g

/** Zitierte Bezeichner: "Nordwerk Metall GmbH", "PV-2026-031", "active". */
const ZITAT = /"([^"]+)"/g

/** Statuswerte des Datenmodells (SPEC Kapitel 4) sind englisch und klein. */
const STATUSWERT = /^[a-z][A-Za-z]*$/

/** Verweis auf eine AUEG-Pruefung: P1 bis P11 (SPEC 5.1 bis 5.4). */
const PRUEFUNG = /\bP(\d{1,2})\b/g

/** Verweis auf ein Kriterium der Konkretisierungspflicht: K1 bis K5 (SPEC 5.3.3). */
const KRITERIUM = /\bK(\d)\b/g

/** Feldname eines Objekts aus Kapitel 3, im Satz zitiert und in Englisch. */
const FELDNAME = /^[a-z][A-Za-z]+(Ref|Date|Months|Id)?$/

export interface GeleseneWerte {
  /** Datumsangaben in Reihenfolge des Auftretens, ISO (JJJJ-MM-TT). */
  datumsangaben: string[]
  /** Zitierte Bezeichner in Reihenfolge des Auftretens. */
  zitate: string[]
  /** Zitate, die wie ein Statuswert des Datenmodells aussehen. */
  statuswerte: string[]
  /** Zahlen mit erkannter Einheit. */
  mengen: Menge[]
  /** Genannte Prueungen, z. B. ["P1"]. */
  pruefungen: string[]
  /** Genannte Kriterien, z. B. ["K1", "K4"]. */
  kriterien: string[]
}

export interface Menge {
  wert: number
  einheit: 'tage' | 'monate' | 'eur' | 'ohne'
}

/** TT.MM.JJJJ zu JJJJ-MM-TT. Ohne Kalenderpruefung — die Szenarien sind gepflegt. */
export function zuIso(tag: string, monat: string, jahr: string): string {
  return `${jahr}-${monat}-${tag}`
}

/** Deutsche Dezimalzahl ("21,40") zu number. */
export function zuZahl(text: string): number {
  return Number(text.replace(/\./g, '').replace(',', '.'))
}

/** Liest alle Werte, die ein Satz traegt. */
export function leseWerte(satz: string): GeleseneWerte {
  const datumsangaben: string[] = []
  for (const treffer of satz.matchAll(DATUM)) {
    const [, tag, monat, jahr] = treffer
    if (tag && monat && jahr) datumsangaben.push(zuIso(tag, monat, jahr))
  }

  const zitate: string[] = []
  for (const treffer of satz.matchAll(ZITAT)) {
    const wert = treffer[1]
    if (wert !== undefined) zitate.push(wert)
  }

  const pruefungen: string[] = []
  for (const treffer of satz.matchAll(PRUEFUNG)) {
    const nummer = Number(treffer[1])
    if (nummer >= 1 && nummer <= 11) pruefungen.push(`P${nummer}`)
  }

  const kriterien: string[] = []
  for (const treffer of satz.matchAll(KRITERIUM)) {
    const nummer = Number(treffer[1])
    if (nummer >= 1 && nummer <= 5) kriterien.push(`K${nummer}`)
  }

  return {
    datumsangaben,
    zitate,
    statuswerte: zitate.filter((wert) => STATUSWERT.test(wert)),
    mengen: leseMengen(satz),
    pruefungen: [...new Set(pruefungen)],
    kriterien: [...new Set(kriterien)],
  }
}

/** Zahlen mit Einheit: "546 Tage", "18 Monate", "21,40 EUR". */
function leseMengen(satz: string): Menge[] {
  const mengen: Menge[] = []
  // Zusammensetzungen gehoeren dazu: "die 91 Lueckentage" nennt Tage, auch wenn
  // die Einheit im Wort steckt. Ohne das las der Lauf die Einheit als "ohne" und
  // hielt den Satz fuer unvergleichbar.
  const muster = /(\d+(?:,\d+)?)\s*((?:[A-Za-zÄÖÜäöüß]*[Tt]age?)|Monaten|Monate|Monat|EUR)?/g
  for (const treffer of satz.matchAll(muster)) {
    const rohwert = treffer[1]
    if (rohwert === undefined) continue
    // Datumsbestandteile sind keine Mengen.
    const vorher = satz.slice(Math.max(0, treffer.index - 1), treffer.index)
    const nachher = satz.slice(treffer.index + rohwert.length, treffer.index + rohwert.length + 1)
    if (vorher === '.' || nachher === '.') continue
    mengen.push({ wert: zuZahl(rohwert), einheit: einheitVon(treffer[2]) })
  }
  return mengen
}

function einheitVon(roh: string | undefined): Menge['einheit'] {
  if (roh === undefined) return 'ohne'
  if (roh === 'EUR') return 'eur'
  if (/[Tt]age?$/.test(roh)) return 'tage'
  return 'monate'
}

/** Sieht das Zitat wie ein Feldname aus Kapitel 3 aus? */
export function istFeldname(zitat: string): boolean {
  return FELDNAME.test(zitat) && /[A-Z]/.test(zitat)
}
