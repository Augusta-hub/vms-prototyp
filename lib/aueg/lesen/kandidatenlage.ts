/**
 * Die Lage lesen, gegen die P6 und P11 rechnen (SPEC 5.3.1 und 5.3.4).
 *
 * Beide Prüfungen lesen denselben Gegenstand: den **Kandidatensatz beim
 * Verleiher** (3.6). P6 die Erklärung zur Vorbeschäftigung, P11 das
 * Beschäftigungsverhältnis — und beide den vorgesehenen ersten
 * Überlassungstag. Deshalb stehen sie in einem Leser.
 *
 * **Lesarten, die hier festgelegt sind:**
 *
 *  1. **Beide Angaben gehören zu einem Kandidatensatz, nicht zu einer Person.**
 *     Sie werden je Verleiher geführt. Bei einem Lieferantenwechsel prüft die
 *     Regel den Satz des **neuen** Verleihers; die Erklärung des alten gilt
 *     nicht (5.3.1 und 5.3.4, Grenzfall „Lieferantenwechsel").
 *  2. **Der erste Überlassungstag ist der Stichtag beider Prüfungen.** Er kommt
 *     aus `actualStartDate`, ersatzweise `plannedStartDate`, am Profilvorschlag
 *     aus `availableFrom` (5.3.1 E17, 5.3.4 E20). Wird ein Starttermin
 *     verschoben, gilt der **neue**: das Rückschaufenster hängt am
 *     Überlassungsbeginn.
 *  3. **Ein Satz über eine Tatsache außerhalb des Systems ändert keine
 *     Daten.** „Der Arbeitsvertrag besteht nachweislich seit dem 25.08.2026 und
 *     ist im System nicht erfasst" ist die Grundlage einer Übersteuerung
 *     (5.5.4 a), kein Beschäftigungsdatum.
 *  4. **„nein" und „nicht erfasst" sind verschieden.** Eine Erklärung, die ein
 *     früheres Arbeitsverhältnis verneint, ist eine Tatsachengrundlage; eine
 *     fehlende Erklärung ist keine und sperrt nach 4.7 die Zeilen Q12 und Q15.
 */

import { istTag, type Tag } from '../kalender'
import {
  zeileFuerUebergang,
  type Objektart,
  type Querschnittzeile,
} from '../querschnitt'
import type { Drehtuerlage, Vorbeschaeftigung } from '../regeln/p6Drehtuer'
import type {
  Beschaeftigungslage,
  Beschaeftigungsstatus,
} from '../regeln/p11Arbeitsverhaeltnis'
import type { Ausloeser, Sachverhalt } from '../typen'
import {
  alsObjektart,
  DATUM,
  einTag,
  kundeAusSatz,
  leseVorgangslage,
  lieferantAusSatz,
  personAusSatz,
  type Anlass,
  type Uebersteuerungslage,
} from './vorgangslage'

/** Der gemeinsame Rahmen beider Prüfungen. */
interface Rahmen {
  readonly anlass: Anlass
  readonly zeile: Querschnittzeile | null
  readonly objektart: Objektart
  readonly vonStatus: string | null
  readonly nachStatus: string | null
  readonly stichtag: Tag | null
  readonly uebersteuerung: Uebersteuerungslage
}

export interface Drehtuerprueflage extends Rahmen {
  readonly lage: Drehtuerlage
}

export interface Arbeitsverhaeltnisprueflage extends Rahmen {
  readonly lage: Beschaeftigungslage
}

interface Gelesen {
  readonly rahmen: Rahmen
  readonly person: string
  readonly entleiher: string
  readonly konzern: string | null
  readonly konzernunternehmen: readonly string[]
  readonly lieferant: string | null
  readonly beginn: Tag | null
  readonly erklaerung: Vorbeschaeftigung | null
  readonly status: Beschaeftigungsstatus | null
  readonly beschaeftigtSeit: Tag | null
  readonly amEinsatzstart: boolean
}

/** Liest die Lage für P6 (SPEC 5.3.1). */
export function leseDrehtuerlage(
  sachverhalte: readonly Sachverhalt[],
  ausloeser: Ausloeser,
): Drehtuerprueflage {
  const gelesen = lese(sachverhalte, ausloeser, 'P6')
  return {
    ...gelesen.rahmen,
    lage: {
      person: gelesen.person,
      entleiher: gelesen.entleiher,
      konzern: gelesen.konzern,
      konzernunternehmen: gelesen.konzernunternehmen,
      ueberlassungsbeginn: gelesen.beginn,
      erklaerung: gelesen.erklaerung,
      lieferant: gelesen.lieferant,
    },
  }
}

/** Liest die Lage für P11 (SPEC 5.3.4). */
export function leseBeschaeftigungslage(
  sachverhalte: readonly Sachverhalt[],
  ausloeser: Ausloeser,
): Arbeitsverhaeltnisprueflage {
  const gelesen = lese(sachverhalte, ausloeser, 'P11')
  return {
    ...gelesen.rahmen,
    lage: {
      person: gelesen.person,
      lieferant: gelesen.lieferant,
      status: gelesen.status,
      beschaeftigtSeit: gelesen.beschaeftigtSeit,
      ersterUeberlassungstag: gelesen.beginn,
      amEinsatzstart: gelesen.amEinsatzstart,
    },
  }
}

/* ------------------------------------------------------------------ */

/** Ein Beschäftigungsverhältnis je Kandidatensatz (Lesart 1). */
interface Kandidatensatz {
  status: Beschaeftigungsstatus | null
  seit: Tag | null
  /** Ob der Vorgang die Angabe ausdrücklich als **nicht erfasst** nennt. */
  ausdruecklichOhneStatus: boolean
}

function lese(
  sachverhalte: readonly Sachverhalt[],
  ausloeser: Ausloeser,
  pruefung: 'P6' | 'P11',
): Gelesen {
  const vorgang = leseVorgangslage(sachverhalte, ausloeser)
  const konzerne = new Map<string, string | null>()
  const saetze = new Map<string, Kandidatensatz>()

  let person: string | null = null
  let entleiher: string | null = vorgang.entleiher[0] ?? null
  let lieferant: string | null = null
  let beginn: Tag | null = null
  let erklaerung: Vorbeschaeftigung | null = null
  let erklaerungErfasst = true

  for (const { satz, ausSzenario } of vorgang.saetze) {
    const gelesenePerson = personAusSatz(satz)
    if (gelesenePerson !== null) person = gelesenePerson

    const kunde = kundeAusSatz(satz)
    if (kunde !== null && (entleiher === null || ausSzenario)) entleiher = kunde

    const verleiher = lieferantAusSatz(satz)
    if (verleiher !== null) lieferant = verleiher

    for (const [firma, verbund] of leseKonzern(satz)) konzerne.set(firma, verbund)

    const gelesenerBeginn = leseBeginn(satz)
    if (gelesenerBeginn !== null) beginn = gelesenerBeginn

    const gelesen = leseErklaerung(satz, verleiher ?? lieferant)
    if (gelesen !== undefined) {
      erklaerung = gelesen
      erklaerungErfasst = gelesen !== null
    }

    leseKandidatensatz(satz, verleiher ?? lieferant, saetze)
  }

  const ausloeserBeginn = leseBeginn(ausloeser.satz)
  if (ausloeserBeginn !== null) beginn = ausloeserBeginn

  const uebersteuert =
    vorgang.anlass === 'uebersteuerung' || vorgang.anlass === 'uebersteuerungsversuch'
  const gelesene = alsObjektart(ausloeser.objektart)
  const objektart = uebersteuert
    ? (vorgang.gesperrterVorgang?.objektart ?? gelesene)
    : gelesene !== 'unbekannt'
      ? gelesene
      : (vorgang.vorgangsart ?? 'unbekannt')
  const nachStatus = uebersteuert
    ? (vorgang.gesperrterVorgang?.nachStatus ?? ausloeser.zielstatus)
    : ausloeser.zielstatus
  const vonStatus = uebersteuert
    ? (vorgang.vorgangsstatus ?? vorgang.gesperrterVorgang?.vonStatus ?? null)
    : vorgang.vorgangsstatus
  const zeile = zeileFuerUebergang(pruefung, objektart, vonStatus, nachStatus)

  const konzernDesEntleihers = entleiher === null ? null : (konzerne.get(entleiher) ?? null)
  const konzernunternehmen =
    konzernDesEntleihers === null
      ? []
      : [...konzerne.entries()]
          .filter(([firma, verbund]) => verbund === konzernDesEntleihers && firma !== entleiher)
          .map(([firma]) => firma)

  const satz = lieferant === null ? undefined : saetze.get(lieferant)
  const einziger = saetze.size === 1 ? [...saetze.values()][0] : undefined
  const massgeblich = satz ?? einziger

  return {
    rahmen: {
      anlass: vorgang.anlass,
      zeile,
      objektart,
      vonStatus: vonStatus ?? zeile?.von ?? null,
      nachStatus: nachStatus ?? zeile?.nach ?? null,
      stichtag: istTag(ausloeser.stichtag) ? ausloeser.stichtag : beginn,
      uebersteuerung: vorgang.uebersteuerung,
    },
    person: person ?? '(ohne Personenangabe)',
    entleiher: entleiher ?? '(ohne Kundenangabe)',
    konzern: konzernDesEntleihers,
    konzernunternehmen,
    lieferant,
    beginn,
    erklaerung: erklaerungErfasst ? erklaerung : null,
    status: massgeblich?.status ?? null,
    beschaeftigtSeit: massgeblich?.seit ?? null,
    amEinsatzstart: zeile?.nummer === 'Q47' || /Einsatzstart/.test(ausloeser.satz),
  }
}

/** `customer.corporateGroup` (SPEC 3.1). `null` heißt: nicht gepflegt. */
function leseKonzern(satz: string): ReadonlyArray<readonly [string, string | null]> {
  if (!/Konzern/.test(satz)) return []
  const kunde = kundeAusSatz(satz)
  if (/kein Konzernverbund gepflegt/.test(satz)) {
    return kunde === null ? [] : [[kunde, null]]
  }
  const verbund = /Konzernverbund "([^"]+)"/.exec(satz)?.[1]
  if (verbund === undefined) return []
  // „»Nordwerk Service GmbH« gehört zum Konzernverbund »Nordwerk Gruppe«" nennt
  // die Firma vor dem Verbund, nicht als „bei X".
  const firma = kunde ?? /^"([^"]+)"/.exec(satz)?.[1] ?? null
  return firma === null ? [] : [[firma, verbund]]
}

/**
 * Der vorgesehene erste Überlassungstag (Lesart 2). Die Reihenfolge ist
 * bedeutsam: ein verschobener Starttermin steht im selben Satz wie der alte,
 * und maßgeblich ist der **neue**.
 */
function leseBeginn(satz: string): Tag | null {
  const verschoben = einTag(
    satz,
    new RegExp(`vom \\d{2}\\.\\d{2}\\.\\d{4} auf den ${DATUM} verschoben`),
  )
  if (verschoben !== null) return verschoben
  return (
    einTag(satz, new RegExp(`Überlassungsbeginn (?:am|ist der) ${DATUM}`)) ??
    einTag(satz, new RegExp(`vorgesehene Beginn ist der ${DATUM}`)) ??
    einTag(satz, new RegExp(`verfügbar ab den ${DATUM}`)) ??
    einTag(satz, new RegExp(`tatsächlichem Beginn ${DATUM}`)) ??
    einTag(satz, new RegExp(`geplantem Beginn ${DATUM}`)) ??
    einTag(satz, new RegExp(`Einsatzstart ${DATUM}`)) ??
    einTag(satz, new RegExp(`soll am ${DATUM} beginnen`)) ??
    einTag(satz, new RegExp(`läuft seit dem ${DATUM}`))
  )
}

/**
 * Die Erklärung zur Vorbeschäftigung (SPEC 3.6, Inhalt in 5.3.1).
 * `undefined` heißt: der Satz sagt nichts über sie; `null`: sie ist
 * ausdrücklich **nicht** erfasst (Lesart 4).
 */
function leseErklaerung(
  satz: string,
  lieferant: string | null,
): Vorbeschaeftigung | null | undefined {
  if (!/Vorbeschäftigung|Austrittsdatum/.test(satz)) return undefined
  if (/keine Erklärung zur Vorbeschäftigung erfasst/.test(satz)) return null

  const erklaert = einTag(satz, new RegExp(`Erklärung zur Vorbeschäftigung vom ${DATUM}`))

  // Berichtigung: „… von 31.01.2026 auf 30.04.2026 berichtigt" — maßgeblich ist
  // der berichtigte Wert (5.5.3).
  const berichtigt = einTag(satz, new RegExp(`auf (?:den )?${DATUM} berichtigt`))
  if (berichtigt !== null) {
    return {
      bestand: true,
      ende: berichtigt,
      arbeitgeber: null,
      erklaert,
      lieferant,
    }
  }

  if (/verneint/.test(satz)) {
    return { bestand: false, ende: null, arbeitgeber: null, erklaert, lieferant }
  }

  const genannt = new RegExp(
    `Arbeitsverhältnis bei "([^"]+)", beendet am ${DATUM}`,
  ).exec(satz)
  if (genannt?.[1] !== undefined && genannt[2] !== undefined) {
    const [tag, monat, jahr] = genannt[2].split('.')
    return {
      bestand: true,
      ende: `${jahr}-${monat}-${tag}`,
      arbeitgeber: genannt[1],
      erklaert,
      lieferant,
    }
  }

  if (/bejaht ein früheres Arbeitsverhältnis/.test(satz)) {
    return { bestand: true, ende: null, arbeitgeber: null, erklaert, lieferant }
  }

  // „Für den Kandidatensatz bei »X« liegt eine Erklärung vor" sagt, **dass**
  // eine vorliegt, nicht was sie enthält — und zu welchem Satz sie gehört.
  const fuerSatz = /Kandidatensatz bei "([^"]+)" liegt eine Erklärung/.exec(satz)?.[1]
  if (fuerSatz !== undefined) {
    return { bestand: null, ende: null, arbeitgeber: null, erklaert, lieferant: fuerSatz }
  }
  if (/Erklärung zur Vorbeschäftigung liegt vor/.test(satz)) {
    return { bestand: null, ende: null, arbeitgeber: null, erklaert, lieferant }
  }
  return undefined
}

/** `employmentStatusWithSupplier` und `employedSince` je Kandidatensatz (3.6). */
function leseKandidatensatz(
  satz: string,
  lieferant: string | null,
  saetze: Map<string, Kandidatensatz>,
): void {
  const fuer = lieferant ?? '(ohne Lieferantenangabe)'
  const eintrag =
    saetze.get(fuer) ?? { status: null, seit: null, ausdruecklichOhneStatus: false }

  let beruehrt = false

  if (/kein Beschäftigungsverhältnis beim Lieferanten erfasst/.test(satz)) {
    eintrag.status = null
    eintrag.seit = null
    eintrag.ausdruecklichOhneStatus = true
    beruehrt = true
  } else {
    const genannt =
      /Beschäftigungsverhältnis(?: beim Lieferanten)?(?: ist| trägt)?(?: am \d{2}\.\d{2}\.\d{4})?(?: weiter)? "([^"]+)"/.exec(
        satz,
      )?.[1] ??
      /trägt das Beschäftigungsverhältnis "([^"]+)"/.exec(satz)?.[1] ??
      (/steht beim Lieferanten im Status "inactive"/.test(satz) ? 'inactive' : undefined)
    if (genannt !== undefined && istStatus(genannt)) {
      eintrag.status = genannt
      beruehrt = true
    }

    // Lesart 3: eine Tatsache außerhalb des Systems ändert keine Daten.
    const ausserhalb = /nachweislich|nicht erfasst|besteht tatsächlich/.test(satz)
    const seit =
      einTag(satz, new RegExp(`beschäftigt seit dem ${DATUM}`)) ??
      // „Das Beschäftigungsdatum wird … auf 15.09.2026 berichtigt" (5.5.3).
      // Nur hier, nicht bei einer Berichtigung des Austrittsdatums — die
      // gehört zu P6.
      (/Beschäftigungsdatum/.test(satz)
        ? einTag(satz, new RegExp(`auf (?:den )?${DATUM} berichtigt`))
        : null)
    if (seit !== null && !ausserhalb) {
      eintrag.seit = seit
      if (eintrag.status === null && !eintrag.ausdruecklichOhneStatus) eintrag.status = 'employed'
      beruehrt = true
    }
  }

  if (beruehrt) saetze.set(fuer, eintrag)
}

function istStatus(wert: string): wert is Beschaeftigungsstatus {
  return wert === 'employed' || wert === 'applicant' || wert === 'inactive'
}
