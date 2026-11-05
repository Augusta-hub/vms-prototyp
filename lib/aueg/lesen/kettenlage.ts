/**
 * Die Lage lesen, gegen die P1 und P2 rechnen (SPEC 5.1).
 *
 * Wie `erlaubnislage.ts` für P9 und `nachweislage.ts` für P10: aus den
 * Vorbedingungen und dem Auslöser werden die Einsätze (3.7), die
 * Tarifzuordnungen (3.3), die Personenidentität (3.6), der Prüfzeitraum und der
 * Stichtag (5.0). Den gemeinsamen Teil liest `vorgangslage.ts`.
 *
 * **Lesarten, die hier festgelegt sind:**
 *
 *  1. **„bei X" ist der Entleiher, „über X" der Verleiher.** Beide tragen eine
 *     Firmenbezeichnung und sind verschiedene Objekte (3.1 gegen 3.2). Nennt
 *     der Satz einen Kandidatensatz („als Kandidat »…« bei »X« geführt"), ist
 *     „bei X" der **Verleiher** — der Kandidatensatz gehört zum Lieferanten.
 *  2. **Ein Einsatz entsteht nur mit wirksamem Beginn.** Ein Satz, der nur ein
 *     Ende nennt („ein Einsatz endet am …"), trägt zur Lückenbewertung bei und
 *     erzeugt **keinen** Einsatz ohne Beginn — sonst wäre jede Lückenbewertung
 *     ein Datenfehler nach 5.1.8. Fehlt ein Beginndatum wirklich, sagt der
 *     Vorgang es ausdrücklich („trägt kein geplantes Beginndatum").
 *  3. **Die Verleiherseite wird für die Grenze nicht gelesen.** Eine
 *     Tarifzuordnung mit `appliesToType = supplier` bleibt unbeachtet; die
 *     Öffnungsklausel des § 1 Abs. 1b ist eine Regelung der Einsatzbranche
 *     (5.1.2).
 *  4. **Abgeleitete Felder, die der Vorgang nennt, sind Datenstand.**
 *     `maxDurationEndDate`, `countedDurationDays` und das Restbudget sind in
 *     3.7 abgeleitete, aber **gepflegte** Felder. Nennt ein Szenario sie, ist
 *     das eine Aussage über den Datenstand und keine Zusicherung — die Regel
 *     rechnet mit ihnen, wo sie die Kette nicht selbst bilden kann.
 *  5. **Eine festgestellte Überschreitung ist eine Tatsache, kein Ergebnis.**
 *     Sagt ein Vorgang, eine Berichtigung mache eine Überschreitung sichtbar,
 *     ohne die berichtigten Einzeldaten auszuschreiben, wird das als Datenstand
 *     gelesen (5.5.3, R3). Die Regel erfindet die Einzeldaten nicht.
 */

import { folgetag, istTag, istVorOderGleich, tagVersetzt, type Tag } from '../kalender'
import {
  zeileFuerNachtlauf,
  zeileFuerUebergang,
  type Objektart,
  type Querschnittzeile,
} from '../querschnitt'
import type {
  Einsatzsatz,
  Grenzherkunft,
  Kettenlage,
  Unterbrechung,
  Zaehlgrundlage,
} from '../regeln/p1Hoechstdauer'
import type { Zeitraum } from '../regeln/p9Erlaubnis'
import { REGELWERK } from '../regelwerk'
import type { Ausloeser, Pruefung, Sachverhalt } from '../typen'
import {
  alsObjektart,
  alsTag,
  DATUM,
  einTag,
  kundeAusSatz,
  leseVorgangslage,
  lieferantAusSatz,
  neuerZeitraum,
  personAusSatz,
  type Anlass,
  type Uebersteuerungslage,
} from './vorgangslage'

export interface Kettenprueflage {
  readonly anlass: Anlass
  readonly zeile: Querschnittzeile | null
  readonly objektart: Objektart
  readonly vonStatus: string | null
  readonly nachStatus: string | null
  readonly stichtag: Tag | null
  readonly lage: Kettenlage
  readonly uebersteuerung: Uebersteuerungslage
  /** Eine Überschreitung ist als Datenstand festgestellt (Lesart 5). */
  readonly ueberschreitungFestgestellt: boolean
}

/** Eine Tarifzuordnung, soweit 5.1.2 sie liest (SPEC 3.3). */
interface Tarifzuordnung {
  readonly name: string
  readonly ebene: 'standort' | 'kunde' | 'lieferant'
  readonly monate: number | null
  von: Tag | null
  bis: Tag | null
}

/** Liest die Lage aus den Vorbedingungen und dem Auslöser eines Vorgangs. */
export function leseKettenlage(
  sachverhalte: readonly Sachverhalt[],
  ausloeser: Ausloeser,
  pruefung: Pruefung,
): Kettenprueflage {
  const vorgang = leseVorgangslage(sachverhalte, ausloeser)

  const einsaetze: Einsatzsatz[] = []
  const unterbrechungen: Unterbrechung[] = []
  const zuordnungen = new Map<string, Tarifzuordnung>()

  let kunde: string | null = vorgang.entleiher[0] ?? null
  let person: string | null = null
  let zaehlgrundlage: Zaehlgrundlage = 'bestaetigt'
  let grenzeAusSatz: number | null = null
  let keineZuordnung = false
  let gesetztesFristende: Tag | null = null
  let gesetzteDauer: number | null = null
  let gesetztesRestbudget: number | null = null
  let zeitraum: Zeitraum | null = null
  let zeitpositionen: Zeitraum | null = null
  let tatsaechlicherBeginn: Tag | null = null
  let tatsaechlichesEnde: Tag | null = null
  let wiederaufnahmetag: Tag | null = null
  let luecke: Unterbrechung | null = null
  let laufzeitFehlt = false
  let ueberschreitungFestgestellt = false
  let nieBegonnen = false
  let einsatzende: Tag | null = null
  let gesetzteDauerStand: Tag | null = null

  for (const { satz, ausSzenario } of vorgang.saetze) {
    const gelesenePerson = personAusSatz(satz)
    if (gelesenePerson !== null) person = gelesenePerson

    const gelesenerKunde = kundeAusSatz(satz)
    if (gelesenerKunde !== null && ausSzenario) kunde = gelesenerKunde
    else if (gelesenerKunde !== null && kunde === null) kunde = gelesenerKunde

    for (const zuordnung of leseTarifzuordnungen(satz)) {
      const bekannt = zuordnungen.get(zuordnung.name)
      if (bekannt === undefined) {
        zuordnungen.set(zuordnung.name, zuordnung)
      } else {
        // „… ist nur bis zum 31.12.2025 gültig" berichtigt die Zuordnung der
        // Grundlage, es ist keine zweite.
        if (zuordnung.bis !== null) bekannt.bis = zuordnung.bis
        if (zuordnung.von !== null) bekannt.von = zuordnung.von
      }
    }
    if (/deckt keine Tarifzuordnung/.test(satz)) keineZuordnung = true
    const grenze = leseGrenze(satz)
    if (grenze !== null) grenzeAusSatz = grenze

    const grundlage = leseZaehlgrundlage(satz)
    if (grundlage !== null) zaehlgrundlage = grundlage

    const fristende = einTag(satz, new RegExp(`Fristende\\D{0,80}${DATUM}`))
    if (fristende !== null) gesetztesFristende = fristende

    const dauer = leseDauer(satz)
    if (dauer !== null) {
      gesetzteDauer = dauer
      // Der Tag, auf den sich die genannte angerechnete Dauer bezieht. Er
      // entscheidet, ob der Wert zur maßgeblichen Kette gehört: nach einem
      // Reset gehört er zur **alten** Kette und wird nicht fortgeschrieben
      // (5.1.4).
      gesetzteDauerStand =
        einTag(satz, new RegExp(`zum Stichtag ${DATUM}`)) ??
        einTag(satz, new RegExp(`bis zum ${DATUM}`))
    }
    const rest = leseRestbudget(satz)
    if (rest !== null) gesetztesRestbudget = rest

    const gelesenerZeitraum = lesePruefzeitraum(satz)
    if (gelesenerZeitraum !== null) zeitraum = gelesenerZeitraum

    const positionen = leseZeitpositionen(satz)
    if (positionen !== null) zeitpositionen = positionen

    const beginn = einTag(satz, new RegExp(`tatsächliche(?:r)? Beginn ist der ${DATUM}`))
    if (beginn !== null) tatsaechlicherBeginn = beginn
    const ende = einTag(satz, new RegExp(`tatsächliche(?:s)? Ende ist der ${DATUM}`))
    if (ende !== null) tatsaechlichesEnde = ende

    const wiederaufnahme = einTag(
      satz,
      new RegExp(`(?:erste(?:r)? )?Wiederaufnahmetag ist der ${DATUM}`),
    )
    if (wiederaufnahme !== null) wiederaufnahmetag = wiederaufnahme
    const fortgesetzt = einTag(satz, new RegExp(`wird am ${DATUM} fortgesetzt`))
    if (fortgesetzt !== null) wiederaufnahmetag = fortgesetzt

    const gelesenerEinsatz = leseEinsatz(satz, kunde)
    if (gelesenerEinsatz !== null) einsaetze.push(gelesenerEinsatz)

    const pause = leseUnterbrechung(satz)
    if (pause !== null) {
      unterbrechungen.push(pause)
      luecke = pause
    }
    const endeDerPause = einTag(satz, new RegExp(`Unterbrechung endet am ${DATUM}`))
    if (endeDerPause !== null) {
      // Q26 nennt nur das Ende der Unterbrechung; der Lückenbeginn bleibt
      // unbekannt und wird nicht geraten (5.0, Nummer 4). Der erste
      // Wiederaufnahmetag ist der Folgetag (5.0, Zeile `interrupted` → `active`).
      wiederaufnahmetag = wiederaufnahmetag ?? folgetag(endeDerPause)
    }
    const gelesenesEnde = leseEinsatzende(satz)
    if (gelesenesEnde !== null) einsatzende = gelesenesEnde

    if (/kein geplantes Beginndatum|trägt kein Beginndatum/.test(satz)) laufzeitFehlt = true
    if (/kein tatsächliches Beginndatum/.test(satz)) nieBegonnen = true
    if (/wird eine Überschreitung des Fristendes .* sichtbar/.test(satz)) {
      ueberschreitungFestgestellt = true
    }
    const widerspruch = leseWidersprechendeLaufzeit(satz, kunde)
    if (widerspruch !== null) einsaetze.push(widerspruch)
  }

  const uebersteuert =
    vorgang.anlass === 'uebersteuerung' || vorgang.anlass === 'uebersteuerungsversuch'
  const gelesene = alsObjektart(ausloeser.objektart)
  const objektart =
    vorgang.anlass === 'nachtlauf'
      ? 'einsatz'
      : uebersteuert
        ? (vorgang.gesperrterVorgang?.objektart ?? gelesene)
        : gelesene !== 'unbekannt'
          ? gelesene
          : (vorgang.vorgangsart ?? 'unbekannt')
  const nachStatus = uebersteuert
    ? (vorgang.gesperrterVorgang?.nachStatus ?? ausloeser.zielstatus)
    : ausloeser.zielstatus
  // Bei einer Übersteuerung nennt der Vorgang den Status oft nicht; dann ist es
  // der Zustand, in dem der gesperrte Übergang stehen bleibt (4.0, Regel 5).
  const vonStatus = uebersteuert
    ? (vorgang.vorgangsstatus ?? vorgang.gesperrterVorgang?.vonStatus ?? null)
    : vorgang.vorgangsstatus
  const zeile =
    vorgang.anlass === 'nachtlauf'
      ? zeileFuerNachtlauf(pruefung, 'einsatz')
      : zeileFuerUebergang(pruefung, objektart, vonStatus, nachStatus)

  // Verlängerung: Prüfzeitraum ist „bisheriges `plannedEndDate` + 1 Tag bis
  // `newEndDate`" (5.0). Fehlt das bisherige Ende, bleibt das neue Ende als
  // einziger Tag — mehr sagt der Vorgang nicht.
  if (zeitraum === null && vorgang.zeit.neuesEnde !== null) {
    const von =
      vorgang.zeit.bisherigesEnde !== null
        ? folgetag(vorgang.zeit.bisherigesEnde)
        : vorgang.zeit.neuesEnde
    zeitraum = { von, bis: vorgang.zeit.neuesEnde }
  }
  if (zeitraum === null && objektart === 'stundenzettel' && vorgang.zeit.zettel !== null) {
    zeitraum = vorgang.zeit.zettel
  }

  const stichtag = bestimmeStichtag({
    ausloeser,
    zeile,
    tatsaechlicherBeginn,
    tatsaechlichesEnde,
    wiederaufnahmetag,
    luecke,
  })

  if (laufzeitFehlt) {
    einsaetze.push({
      id: 'Einsatz ohne plannedStartDate',
      kunde,
      lieferant: null,
      beginn: null,
      ende: null,
      tatsaechlich: false,
      nieBegonnen: false,
      unterbrechungen: [],
    })
  }

  // Lücke zwischen zwei Einsätzen (5.1.4 a): `gapFrom` = wirksames Ende des
  // früheren Einsatzes + 1 Tag, `gapTo` = wirksamer Beginn des späteren − 1 Tag.
  // Die beiden Tatsachen stehen in getrennten Sätzen, deshalb erst hier.
  if (luecke === null && einsatzende !== null) {
    luecke = {
      von: folgetag(einsatzende),
      bis: wiederaufnahmetag === null ? null : tagVersetzt(wiederaufnahmetag, -1),
    }
  }

  const grenze = waehleGrenze(zuordnungen, grenzeAusSatz, keineZuordnung, stichtag)

  const lage: Kettenlage = {
    person: person ?? '(ohne Personenangabe)',
    kunde: kunde ?? '(ohne Kundenangabe)',
    einsaetze: einsaetze.map((einsatz) => ({
      ...einsatz,
      nieBegonnen: einsatz.nieBegonnen || nieBegonnen,
      // Eine im Vorgang genannte Unterbrechung gilt dem Einsatz, von dem der
      // Vorgang handelt; die Szenarien führen je Vorgang einen (3.7).
      unterbrechungen: [...einsatz.unterbrechungen, ...unterbrechungen],
    })),
    stichtag,
    zeitraum,
    zeitpositionen,
    grenzeMonate: grenze.monate,
    grenzeHerkunft: grenze.herkunft,
    grenzeGesenkt: grenze.gesenkt,
    gesetztesFristende,
    gesetzteDauer,
    gesetzteDauerStand,
    gesetztesRestbudget,
    zaehlgrundlage: objektart === 'bedarfsanfrage' && einsaetze.length === 0
      ? 'ohnePerson'
      : zaehlgrundlage,
    luecke,
    wiederaufnahmetag,
    fehlendeFelder: [],
  }

  return {
    anlass: vorgang.anlass,
    zeile,
    objektart,
    vonStatus: vonStatus ?? zeile?.von ?? null,
    nachStatus: nachStatus ?? zeile?.nach ?? null,
    stichtag,
    lage,
    uebersteuerung: vorgang.uebersteuerung,
    ueberschreitungFestgestellt,
  }
}

/* ------------------------------------------------------------------ */
/* Einzelne Lesarten                                                   */
/* ------------------------------------------------------------------ */

/**
 * Ein Einsatz aus einem Vorbedingungssatz (SPEC 3.7). Nur Sätze mit wirksamem
 * Beginn erzeugen einen Einsatz (Lesart 2).
 */
function leseEinsatz(satz: string, kunde: string | null): Einsatzsatz | null {
  if (!/überlassen|Überlassung|\bEinsatz\b|\bEinsätze\b|\bKette\b/.test(satz)) return null
  if (/durch die Prüfung P\d+ gesperrt/.test(satz)) return null

  const lieferant = lieferantAusSatz(satz)
  const geplant = /\bgeplant\b|Status "planned"|geplantem Beginn/.test(satz)

  // „vom 15.01.2026 bis 14.04.2026 überlassen", „ein Einsatz vom … bis … im
  // Status »planned« angelegt".
  const zeitraum =
    neuerZeitraum(satz, new RegExp(`vom ${DATUM} bis (?:zum )?${DATUM}`)) ??
    neuerZeitraum(satz, new RegExp(`geplantem Beginn ${DATUM} und geplantem Ende ${DATUM}`))
  if (zeitraum !== null && !/unterbroch/.test(satz)) {
    return einsatz(satz, kunde, lieferant, zeitraum.von, zeitraum.bis, !geplant)
  }

  const beginn =
    einTag(satz, new RegExp(`seit dem ${DATUM}`)) ??
    einTag(satz, new RegExp(`(?:hat|ist) am ${DATUM} begonnen`)) ??
    einTag(satz, new RegExp(`beginnt am ${DATUM}`)) ??
    einTag(satz, new RegExp(`ab dem ${DATUM}`)) ??
    einTag(satz, new RegExp(`läuft seit dem ${DATUM}`)) ??
    einTag(satz, new RegExp(`geplantem Beginn ${DATUM}`))
  if (beginn === null) return null
  return einsatz(satz, kunde, lieferant, beginn, null, !geplant)
}

function einsatz(
  satz: string,
  kunde: string | null,
  lieferant: string | null,
  beginn: Tag | null,
  ende: Tag | null,
  tatsaechlich: boolean,
): Einsatzsatz {
  return {
    id: satz.slice(0, 60),
    kunde,
    lieferant,
    beginn,
    ende,
    tatsaechlich,
    nieBegonnen: false,
    unterbrechungen: [],
  }
}

/** „Der Einsatz nennt den geplanten Beginn … und das geplante Ende …" (5.1.8). */
function leseWidersprechendeLaufzeit(satz: string, kunde: string | null): Einsatzsatz | null {
  const zeitraum = neuerZeitraum(
    satz,
    new RegExp(`geplanten Beginn ${DATUM} und das geplante Ende ${DATUM}`),
  )
  if (zeitraum === null) return null
  if (istVorOderGleich(zeitraum.von, zeitraum.bis)) {
    return einsatz(satz, kunde, null, zeitraum.von, zeitraum.bis, false)
  }
  return einsatz(satz, kunde, null, zeitraum.von, zeitraum.bis, false)
}

/** Eine Unterbrechung oder eine Lücke (SPEC 5.1.4 a und b). */
function leseUnterbrechung(satz: string): Unterbrechung | null {
  const mitEnde =
    neuerZeitraum(
      satz,
      new RegExp(`Unterbrechung mit Beginn ${DATUM}, Ende ${DATUM}`),
    ) ??
    neuerZeitraum(satz, new RegExp(`Unterbrechung läuft vom ${DATUM} bis zum ${DATUM}`)) ??
    neuerZeitraum(satz, new RegExp(`(?:ist|war) vom ${DATUM} bis (?:zum )?${DATUM} unterbrochen`)) ??
    neuerZeitraum(satz, new RegExp(`unterbrochen, diese Unterbrechung`)) ??
    neuerZeitraum(satz, new RegExp(`war nachweislich vom ${DATUM} bis ${DATUM} unterbrochen`))
  if (mitEnde !== null) return mitEnde

  const ohneEnde =
    einTag(satz, new RegExp(`Unterbrechung mit Beginn ${DATUM}, ohne Ende`)) ??
    einTag(satz, new RegExp(`Unterbrechung hat am ${DATUM} begonnen und hat kein Ende`))
  if (ohneEnde !== null) return { von: ohneEnde, bis: null }

  return null
}

/**
 * Das wirksame Ende eines Einsatzes, aus dem sich eine **Lücke zwischen zwei
 * Einsätzen** ergibt (5.1.4 a). „Die Unterbrechung endet am …" ist das Ende
 * einer Unterbrechung und kein Einsatzende.
 */
function leseEinsatzende(satz: string): Tag | null {
  if (/Unterbrechung endet/.test(satz)) return null
  if (!/\bEinsatz\b|Überlassung/.test(satz)) return null
  return einTag(satz, new RegExp(`endet am ${DATUM}`))
}

function leseTarifzuordnungen(satz: string): Tarifzuordnung[] {
  if (!/Tarifzuordnung/.test(satz)) return []
  const name = /Tarifzuordnung "([^"]+)"/.exec(satz)?.[1]
  if (name === undefined) return []
  const monate = /maxAssignmentDurationMonths\s*=\s*(\d+)/.exec(satz)?.[1]
  const ebene: Tarifzuordnung['ebene'] = /für den Standort|des Standorts/.test(satz)
    ? 'standort'
    : /für den Lieferanten/.test(satz)
      ? 'lieferant'
      : 'kunde'
  const gueltig = neuerZeitraum(satz, new RegExp(`vom ${DATUM} bis ${DATUM} gültig`))
  const ab = einTag(satz, new RegExp(`gilt ab dem ${DATUM}`))
  const bis = einTag(satz, new RegExp(`nur bis zum ${DATUM} gültig`))
  return [
    {
      name,
      ebene,
      monate: monate === undefined ? null : Number(monate),
      von: gueltig?.von ?? ab ?? null,
      bis: gueltig?.bis ?? bis ?? null,
    },
  ]
}

/** „Die Grenze beträgt 18 Monate", „es gilt die Grenze von 18 Monaten". */
function leseGrenze(satz: string): number | null {
  if (/für den Lieferanten/.test(satz)) return null
  const treffer =
    /Grenze (?:beträgt|von) (\d+) Monaten?/.exec(satz) ??
    /Regelgrenze von (\d+) Monaten/.exec(satz)
  const wert = treffer?.[1]
  return wert === undefined ? null : Number(wert)
}

interface Grenzwahl {
  readonly monate: number
  readonly herkunft: Grenzherkunft
  readonly gesenkt: boolean
}

/**
 * 5.1.2: Rang 1 die Zuordnung des Standorts, Rang 2 die des Kunden, Rang 3 die
 * gesetzliche Regelgrenze. Die Verleiherseite wird nicht gelesen. Deckt keine
 * Zuordnung den Stichtag ab, gilt die Regelgrenze **mit** Information — nicht
 * „keine Grenze" und nicht „Prüfung entfällt".
 */
function waehleGrenze(
  zuordnungen: ReadonlyMap<string, Tarifzuordnung>,
  grenzeAusSatz: number | null,
  keineZuordnung: boolean,
  stichtag: Tag | null,
): Grenzwahl {
  const regelgrenze = REGELWERK.dauer.regelgrenzeMonate
  if (keineZuordnung) return { monate: regelgrenze, herkunft: 'regelgrenze', gesenkt: false }

  const einschlaegig = [...zuordnungen.values()].filter(
    (zuordnung) =>
      zuordnung.ebene !== 'lieferant' &&
      zuordnung.monate !== null &&
      deckt(zuordnung, stichtag),
  )
  const nachEbene = (ebene: Tarifzuordnung['ebene']): Tarifzuordnung[] =>
    einschlaegig
      .filter((zuordnung) => zuordnung.ebene === ebene)
      .sort((a, b) => (a.von ?? '').localeCompare(b.von ?? ''))

  const standort = nachEbene('standort')
  const fuerKunde = nachEbene('kunde')
  const gewaehlt = standort[standort.length - 1] ?? fuerKunde[fuerKunde.length - 1] ?? null

  if (gewaehlt === null || gewaehlt.monate === null) {
    return {
      monate: grenzeAusSatz ?? regelgrenze,
      herkunft: grenzeAusSatz === null ? 'regelgrenze' : 'standort',
      gesenkt: false,
    }
  }

  // Eine Senkung innerhalb der laufenden Kette: eine frühere Zuordnung derselben
  // Ebene trägt einen höheren Wert (5.1.2, *offene Frage 27*).
  const reihe = gewaehlt.ebene === 'standort' ? standort : fuerKunde
  const gesenkt = reihe.some(
    (zuordnung) =>
      zuordnung !== gewaehlt &&
      zuordnung.monate !== null &&
      gewaehlt.monate !== null &&
      zuordnung.monate > gewaehlt.monate,
  )
  // Die Verleiherseite ist oben herausgefiltert (5.1.2).
  const herkunft: Grenzherkunft = gewaehlt.ebene === 'kunde' ? 'kunde' : 'standort'
  return { monate: gewaehlt.monate, herkunft, gesenkt }
}

function deckt(zuordnung: Tarifzuordnung, stichtag: Tag | null): boolean {
  if (stichtag === null) return true
  if (zuordnung.von !== null && !istVorOderGleich(zuordnung.von, stichtag)) return false
  if (zuordnung.bis !== null && !istVorOderGleich(stichtag, zuordnung.bis)) return false
  return true
}

function leseZaehlgrundlage(satz: string): Zaehlgrundlage | null {
  if (/Verknüpfung ist nicht bestätigt|maschinell .* verknüpft, die Verknüpfung ist nicht/.test(satz)) {
    return 'unbestaetigterVorschlag'
  }
  if (/keine bestätigte Personenidentität/.test(satz)) return 'einLieferant'
  if (/Personenidentität "[^"]+" ist .* bestätigt|bestätigt verknüpft/.test(satz)) {
    return 'bestaetigt'
  }
  return null
}

/** `countedDurationDays` als gepflegtes Feld (Lesart 4). */
function leseDauer(satz: string): number | null {
  const treffer =
    /angerechnete Dauer .*?beträgt (?:zum Stichtag \d{2}\.\d{2}\.\d{4} )?(\d+) Tage/.exec(satz) ??
    /angerechnete Dauer bis zum \d{2}\.\d{2}\.\d{4} beträgt (\d+) Tage/.exec(satz) ??
    /sind (\d+) Überlassungstage .* bekannt/.exec(satz)
  const wert = treffer?.[1]
  if (wert === undefined) return null
  // Die Tage eines unbestätigten Vorschlags zählen nicht (5.1.5, Frage 18).
  if (/nicht bestätigt/.test(satz)) return null
  return Number(wert)
}

function leseRestbudget(satz: string): number | null {
  const treffer = /Restbudget (?:von )?(\d+) Tage/.exec(satz)
  const wert = treffer?.[1]
  return wert === undefined ? null : Number(wert)
}

/** Der Prüfzeitraum aus 5.0, soweit der Vorgang ihn nennt. */
function lesePruefzeitraum(satz: string): Zeitraum | null {
  const angefragt = neuerZeitraum(
    satz,
    new RegExp(`fragt den Zeitraum vom ${DATUM} bis ${DATUM} an`),
  )
  if (angefragt !== null) return angefragt

  const vorschlag = neuerZeitraum(
    satz,
    new RegExp(`verfügbar ab den ${DATUM}, die Bedarfsanfrage endet am ${DATUM}`),
  )
  if (vorschlag !== null) return vorschlag

  const geplanterEinsatz = neuerZeitraum(
    satz,
    new RegExp(`geplantem Beginn ${DATUM} und geplantem Ende ${DATUM}`),
  )
  if (geplanterEinsatz !== null) return geplanterEinsatz

  // „mit geplantem Beginn 01.03.2027 und ohne geplantes Ende": der Prüfzeitraum
  // besteht nur aus dem Beginn, mit Information nach 5.1 (5.0, Zeile „Einsatz
  // → planned").
  const ohneEnde = einTag(
    satz,
    new RegExp(`geplantem Beginn ${DATUM} und ohne geplantes Ende`),
  )
  if (ohneEnde !== null) return { von: ohneEnde, bis: ohneEnde }

  const nurBeginn = einTag(satz, new RegExp(`nennt den Beginn ${DATUM} und kein Enddatum`))
  if (nurBeginn !== null) return { von: nurBeginn, bis: nurBeginn }

  // Q26: „das geplante Ende des Einsatzes ist der 31.08.2027" — der geplante
  // Restzeitraum, über den 5.5.5 bei der Wiederaufnahme entscheidet.
  const geplantesEnde = einTag(satz, new RegExp(`geplante Ende des Einsatzes ist der ${DATUM}`))
  if (geplantesEnde !== null) return { von: geplantesEnde, bis: geplantesEnde }

  return null
}

function leseZeitpositionen(satz: string): Zeitraum | null {
  return (
    neuerZeitraum(
      satz,
      new RegExp(`Zeitpositionen liegen zwischen dem ${DATUM} und dem ${DATUM}`),
    ) ??
    neuerZeitraum(satz, new RegExp(`Zeitpositionen vom ${DATUM} bis ${DATUM}`))
  )
}

interface Stichtagsdaten {
  readonly ausloeser: Ausloeser
  readonly zeile: Querschnittzeile | null
  readonly tatsaechlicherBeginn: Tag | null
  readonly tatsaechlichesEnde: Tag | null
  readonly wiederaufnahmetag: Tag | null
  readonly luecke: Unterbrechung | null
}

/** Der Stichtag nach der Tabelle in SPEC 5.0. */
function bestimmeStichtag(daten: Stichtagsdaten): Tag | null {
  if (istTag(daten.ausloeser.stichtag)) return daten.ausloeser.stichtag
  const nach = daten.zeile?.nach ?? daten.ausloeser.zielstatus
  const von = daten.zeile?.von
  if (nach === 'active' && von === 'planned') return daten.tatsaechlicherBeginn
  if (nach === 'active' && von === 'interrupted') return daten.wiederaufnahmetag
  if (nach === 'interrupted') return daten.luecke?.von ?? null
  if (nach === 'completed' || nach === 'terminatedEarly') return daten.tatsaechlichesEnde
  return daten.tatsaechlicherBeginn ?? daten.wiederaufnahmetag ?? null
}

export { alsTag }
