/**
 * Die Lage lesen, gegen die P3, P4 und P5 rechnen (SPEC 5.2).
 *
 * Wie `erlaubnislage.ts` für P9 und `nachweislage.ts` für P10. Die
 * **Überlassungskette** kommt aus `kettenlage.ts`: 5.2.1 sagt ausdrücklich
 * „dieselbe Kette, andere Frist", und zwei Fassungen derselben Kette würden
 * auseinanderlaufen. Dieser Leser ergänzt nur, was 5.2 zusätzlich braucht.
 *
 * **Lesarten, die hier festgelegt sind:**
 *
 *  1. **Die Frist kommt von der Verleiherseite** (5.2.2) — anders als die
 *     Grenze in 5.1.2, die die Einsatzbranche liest. „für den Lieferanten … ist
 *     die Tarifzuordnung … gültig" ist deshalb hier maßgeblich und in
 *     `kettenlage.ts` bewusst unbeachtet.
 *  2. **Eine Zuordnung ohne Fristangabe ist nicht dasselbe wie keine
 *     Zuordnung.** Fall 2 aus 5.2.2 rechnet mit der Regelfrist, Fall 1 mit
 *     null Monaten. Der Unterschied ist der Tarifvertrag selbst, nicht sein
 *     Inhalt — deshalb trägt die Lage beides getrennt.
 *  3. **Die Tätigkeit des Einsatzes wählt den Vergleichsentgelt-Eintrag**
 *     (5.2.4, Schritt 1), nicht die der Bedarfsanfrage (5.2.6). Ein Satz über
 *     die Bedarfsanfrage setzt die Tätigkeit deshalb **nicht**.
 *  4. **Zwei gültige Einträge sind kein Eintrag** (5.2.4, Schritt 2): es wird
 *     keiner ausgewählt. Die Lage führt die Zahl der gültigen Einträge, nicht
 *     einen gewählten Wert.
 *  5. **Abgeleitete Felder, die der Vorgang nennt, sind Datenstand.**
 *     `equalPayDueDate` ist in 3.7 abgeleitet, aber gepflegt. Nennt ein
 *     Szenario es, rechnet die Regel damit, wo sie die Kette nicht selbst
 *     bilden kann — dieselbe Lesart wie 4 in `kettenlage.ts`.
 */

import type { Tag } from '../kalender'
import { leseKettenlage, type Kettenprueflage } from './kettenlage'
import { zeileFuerNachtlauf, zeileFuerUebergang, type Querschnittzeile } from '../querschnitt'
import type { EqualPaylage } from '../regeln/p3EqualPayFrist'
import type { Entgeltlage, Entgeltquelle } from '../regeln/p4Vergleichsentgelt'
import type { Zuschlagslage } from '../regeln/p5Branchenzuschlag'
import type { Ausloeser, Pruefung, Sachverhalt } from '../typen'
import { DATUM, einTag, leseVorgangslage } from './vorgangslage'

export interface Entgeltprueflage {
  /** Die Kettenlage, gelesen für die jeweilige Prüfung (Zeile aus 4.7). */
  readonly ketten: Kettenprueflage
  readonly zeile: Querschnittzeile | null
  readonly equalPay: EqualPaylage
  readonly entgelt: Entgeltlage
  readonly zuschlag: Zuschlagslage
  /** Ein Übersteuerungsversuch liegt vor (5.5.4) — P4 ist nicht übersteuerbar. */
  readonly uebersteuerungBeantragt: boolean
}

/** Ein Vergleichsentgelt-Eintrag des Standorts, soweit 5.2.4 ihn liest (3.3). */
interface Entgelteintrag {
  readonly taetigkeit: string
  readonly betrag: number | null
  readonly quelle: Entgeltquelle
}

/** Liest die Lage aus den Vorbedingungen und dem Auslöser eines Vorgangs. */
export function leseEntgeltlage(
  sachverhalte: readonly Sachverhalt[],
  ausloeser: Ausloeser,
  pruefung: Pruefung,
): Entgeltprueflage {
  const ketten = leseKettenlage(sachverhalte, ausloeser, pruefung)
  const vorgang = leseVorgangslage(sachverhalte, ausloeser)

  // Vorbesetzung aus der Grundlage: eine Zuordnung der Verleiherseite besteht,
  // sie nennt keine abweichende Frist (Fall 2 aus 5.2.2).
  let verleihertarifVorhanden = true
  let fristMonateAngegeben: number | null = null
  let zuschlagsschema: string | null = null
  let schemaAusdruecklichOhne = false

  const eintraege = new Map<string, Entgelteintrag>()
  let eintraegeUeberschrieben: number | null = null
  let taetigkeit: string | null = null
  let taetigkeitFehlt = false
  let einsatzwert: number | null = null
  let einsatzwertGesetzt: boolean | null = null
  let mitBegruendung = false
  let quelleUeberschrieben: Entgeltquelle | null = null
  let gesetzteFaelligkeit: Tag | null = null
  let faelligkeitImZeitraumGenannt = false
  let berichtigungstag: Tag | null = null

  let brancheBestimmbar: boolean | null = null
  let stufeneingang: number | null = null
  let positionenAbweichend = false

  for (const { satz, ausSzenario } of vorgang.saetze) {
    /* --- Tarifzuordnung der Verleiherseite (5.2.2) --------------------- */

    if (keineVerleiherzuordnung(satz)) verleihertarifVorhanden = false
    const frist = /equalPayDeadlineMonths\s*=\s*(\d+)/.exec(satz)?.[1]
    if (frist !== undefined) {
      fristMonateAngegeben = Number(frist)
      verleihertarifVorhanden = true
    }
    if (/ohne Angabe von equalPayDeadlineMonths|nennt keine abweichende Equal-Pay-Frist/.test(satz)) {
      fristMonateAngegeben = null
      verleihertarifVorhanden = true
    }
    // „für den Lieferanten gilt die Regelfrist von 9 Monaten" ist Fall 2: die
    // Zuordnung besteht und nennt keine abweichende Frist. Der genannte Wert
    // ist der gesetzliche, keine tarifliche Abweichung — er wird deshalb
    // **nicht** als `equalPayDeadlineMonths` gelesen.
    if (/gilt die Regelfrist von \d+ Monaten/.test(satz)) {
      fristMonateAngegeben = null
      verleihertarifVorhanden = true
    }

    const schema = /Branchenzuschlagsschema "([^"]+)"|Schema "([^"]+)"/.exec(satz)
    if (schema !== null) zuschlagsschema = schema[1] ?? schema[2] ?? null
    if (/kein(?:es)? Branchenzuschlagsschema/.test(satz)) {
      zuschlagsschema = null
      schemaAusdruecklichOhne = true
    }

    /* --- Vergleichsentgelt-Einträge des Standorts (5.2.4) -------------- */

    const eintrag = leseEintrag(satz)
    if (eintrag !== null) eintraege.set(eintrag.taetigkeit, eintrag)
    if (zweiEintraege(satz)) eintraegeUeberschrieben = 2
    if (keinEintrag(satz)) eintraegeUeberschrieben = 0

    const quelle = leseQuelle(satz)
    if (quelle !== null && ausSzenario) quelleUeberschrieben = quelle

    /* --- Tätigkeit des Einsatzes (Lesart 3) ---------------------------- */

    const gelesen = taetigkeitAusSatz(satz)
    if (gelesen !== null) taetigkeit = gelesen
    if (/keine Tätigkeitsbeschreibung erfasst/.test(satz)) taetigkeitFehlt = true

    /* --- Wert am Einsatz (3.7) ---------------------------------------- */

    const wert = /am Einsatz ist ein Vergleichsentgelt von ([\d.,]+) EUR/.exec(satz)?.[1]
    if (wert !== undefined) {
      einsatzwert = betragVon(wert)
      einsatzwertGesetzt = true
    }
    if (/ist der Wert an den Einsatz übernommen/.test(satz)) einsatzwertGesetzt = true
    if (leerAmEinsatz(satz)) {
      einsatzwertGesetzt = false
      einsatzwert = null
    }
    if (/mit Begründung erfasst/.test(satz)) mitBegruendung = true
    if (/[Vv]ergleichsentgelt fehlt/.test(satz)) einsatzwertGesetzt = false

    // 5.5.1 b): der zweite Prüfanlass ist eine **Änderung an einer
    // Rechengrundlage**. Ihr Stichtag ist der Tag der Änderung — „am 20.11.2026
    // wird eine bisher nicht erfasste Überlassung nachgetragen". Die Tabelle in
    // 5.0 nennt ihn nicht, weil sie die Statusübergänge auflistet; ohne ihn
    // wäre eine rückwirkend fällige Equal-Pay-Pflicht nicht feststellbar.
    const nachtrag = einTag(
      satz,
      new RegExp(`am ${DATUM} wird [^.]*(?:nachgetragen|berichtigt|korrigiert)`),
    )
    if (nachtrag !== null) berichtigungstag = nachtrag

    /* --- `equalPayDueDate` als Datenstand (Lesart 5) ------------------- */

    const faelligkeit = leseFaelligkeit(satz)
    if (faelligkeit !== null) gesetzteFaelligkeit = faelligkeit
    // Der Vorgang sagt es selbst: „die Equal-Pay-Fälligkeit 15.10.2026 liegt im
    // Leistungszeitraum". Das ist eine Aussage über den Prüfzeitraum, den der
    // Vorgang nicht ausschreibt (die Tabelle in 5.0 bildet ihn beim Beleg aus
    // den zugrunde liegenden Zetteln). Sie wird als Datenstand gelesen — Lesart
    // 5 —, statt eine Periode aus einem Monatsnamen zu erfinden.
    if (/Equal-Pay-Fälligkeit[\s\S]*liegt im (?:Leistungs|Zettel|verlängerten )?[Zz]eitraum/.test(satz)) {
      faelligkeitImZeitraumGenannt = true
    }

    /* --- Branchenzuschlag (5.2.5) ------------------------------------- */

    if (/ist die Einsatzbranche über die Tarifzuordnung des Standorts bestimmt/.test(satz)) {
      brancheBestimmbar = true
    }
    if (/keine Tarifzuordnung gültig und beim Kunden ist keine Branche gepflegt/.test(satz)) {
      brancheBestimmbar = false
    }
    const tage = /folgt aus (\d+) Überlassungstagen/.exec(satz)?.[1]
    if (tage !== undefined) stufeneingang = Number(tage)
    if (/Zuschlagsart einer höheren Stufe/.test(satz)) positionenAbweichend = true
  }

  const massgeblicheTaetigkeit = taetigkeit
  const eintragDerTaetigkeit =
    massgeblicheTaetigkeit === null
      ? [...eintraege.values()][0] ?? null
      : eintraege.get(massgeblicheTaetigkeit) ?? null
  const anzahlEintraege =
    eintraegeUeberschrieben ?? (eintragDerTaetigkeit === null ? 0 : 1)

  // Der Stichtag einer Berichtigung kommt aus dem Satz, nicht aus der Tabelle
  // in 5.0 (dort stehen die Statusübergänge). Er ersetzt keinen vorhandenen.
  const kettenlage =
    ketten.lage.stichtag === null && berichtigungstag !== null
      ? { ...ketten.lage, stichtag: berichtigungstag }
      : ketten.lage

  const equalPay: EqualPaylage = {
    kette: kettenlage,
    verleihertarifVorhanden,
    fristMonateAngegeben,
    zuschlagsschema,
    vergleichsentgeltGesetzt: einsatzwertGesetzt ?? false,
    gesetzteFaelligkeit,
  }

  const entgelt: Entgeltlage = {
    standort: ketten.lage.kunde,
    taetigkeit: massgeblicheTaetigkeit,
    taetigkeitFehlt,
    anzahlEintraege,
    eintragsbetrag: eintragDerTaetigkeit?.betrag ?? null,
    quelle: quelleUeberschrieben ?? eintragDerTaetigkeit?.quelle ?? null,
    einsatzwert,
    einsatzwertGesetzt: einsatzwertGesetzt ?? false,
    abweichungBegruendet: mitBegruendung,
    stichtag: ketten.stichtag ?? berichtigungstag,
    zeitraum: ketten.lage.zeitraum,
    faelligkeit: gesetzteFaelligkeit,
    faelligkeitImZeitraumGenannt,
  }

  const zuschlag: Zuschlagslage = {
    schema: zuschlagsschema,
    schemaAusdruecklichOhne,
    brancheBestimmbar,
    ueberlassungstage: stufeneingang,
    positionenAbweichend,
  }

  return {
    ketten,
    zeile: ketten.zeile ?? zeileFuer(pruefung, ketten),
    equalPay,
    entgelt,
    zuschlag,
    uebersteuerungBeantragt: ketten.uebersteuerung.beantragt,
  }
}

/* ------------------------------------------------------------------ */
/* Satzmuster                                                          */
/* ------------------------------------------------------------------ */

/**
 * Fall 1 aus 5.2.2. Gemeint ist immer die **Verleiherseite**: die Sätze nennen
 * entweder „für den Lieferanten" oder den Lieferanten mit Namen. Eine fehlende
 * Zuordnung des **Standorts** gehört zu 5.1.2 bzw. 5.2.5 und nicht hierher —
 * sie wird deshalb ausgenommen.
 */
function keineVerleiherzuordnung(satz: string): boolean {
  if (!/keine Tarifzuordnung gültig/.test(satz)) return false
  if (/für den Standort|des Standorts/.test(satz)) return false
  return /für den Lieferanten|für "[^"]+"/.test(satz)
}

/** Der Eintrag aus der Grundlage (3.3) mit Tätigkeit, Betrag und Herkunft. */
function leseEintrag(satz: string): Entgelteintrag | null {
  if (!/Vergleichsentgelt-Eintrag/.test(satz)) return null
  const taetigkeit = /zur Tätigkeit "([^"]+)"/.exec(satz)?.[1]
  if (taetigkeit === undefined) return null
  if (/kein Vergleichsentgelt-Eintrag/.test(satz)) return null
  const betrag = /([\d.,]+) EUR/.exec(satz)?.[1]
  return {
    taetigkeit,
    betrag: betrag === undefined ? null : betragVon(betrag),
    quelle: leseQuelle(satz) ?? 'collectiveAgreement',
  }
}

/** „kein Vergleichsentgelt-Eintrag gültig" — in jeder Formulierung (5.2.7). */
function keinEintrag(satz: string): boolean {
  return /kein(?:en)? Vergleichsentgelt-Eintrag gültig|kein Eintrag am Standort gültig|ist kein Eintrag gültig/.test(
    satz,
  )
}

/** Zwei gleichzeitig gültige Einträge — Datenfehler nach 5.2.4, Schritt 2. */
function zweiEintraege(satz: string): boolean {
  return /zwei Einträge (?:mit sich überschneidender Laufzeit|gleichzeitig) gültig/.test(satz)
}

/** `wageSource` (3.3). `estimate` ist verwendbar, aber kein Nachweis. */
function leseQuelle(satz: string): Entgeltquelle | null {
  const treffer = /Herkunft "([^"]+)"/.exec(satz)?.[1]
  if (treffer === undefined) return null
  switch (treffer) {
    case 'estimate':
    case 'collectiveAgreement':
    case 'companyAgreement':
    case 'individualContract':
      return treffer
    default:
      return null
  }
}

/**
 * Die Tätigkeit des **Einsatzes** (Lesart 3). Ein Satz über die Bedarfsanfrage
 * setzt sie nicht: 5.2.6 stellt ausdrücklich klar, dass
 * `assignment.activityDescription` maßgeblich ist.
 */
function taetigkeitAusSatz(satz: string): string | null {
  if (/Bedarfsanfrage nennt die Tätigkeit/.test(satz)) return null
  if (/Vergleichsentgelt-Eintrag/.test(satz)) return null
  return (
    /(?:mit der|nennt die) Tätigkeit "([^"]+)"/.exec(satz)?.[1] ??
    /für (?:diese|die) Tätigkeit "([^"]+)"/.exec(satz)?.[1] ??
    null
  )
}

/** „am Einsatz ist kein Vergleichsentgelt erfasst", „… ist leer". */
function leerAmEinsatz(satz: string): boolean {
  return /am Einsatz ist kein Vergleichsentgelt erfasst|Vergleichsentgelt am Einsatz ist leer|am Einsatz ist kein Wert erfasst/.test(
    satz,
  )
}

/** `equalPayDueDate`, wie der Vorgang es nennt (Lesart 5). */
function leseFaelligkeit(satz: string): Tag | null {
  if (!/Equal-Pay-Fälligkeit/.test(satz)) return null
  // „die Equal-Pay-Fälligkeit ist der 15.10.2026", „… der Kette ist der …",
  // „die Equal-Pay-Fälligkeit 15.10.2026 liegt im Zettelzeitraum".
  const treffer =
    einTag(satz, new RegExp(`Equal-Pay-Fälligkeit(?: der Kette)? ist der ${DATUM}`)) ??
    einTag(satz, new RegExp(`Equal-Pay-Fälligkeit ${DATUM}`))
  return treffer
}

/** „21,40" → 21.4. Deutsche Schreibweise, wie die Szenarien sie führen. */
function betragVon(roh: string): number {
  return Number(roh.replace(/\./g, '').replace(',', '.'))
}

/**
 * Die Zeile aus 4.7 für den nächtlichen Lauf, wenn `kettenlage.ts` keine
 * gefunden hat: N3 führt **P3 und P4** zusammen (5.5.1).
 */
function zeileFuer(pruefung: Pruefung, ketten: Kettenprueflage): Querschnittzeile | null {
  if (ketten.anlass === 'nachtlauf') return zeileFuerNachtlauf(pruefung, ketten.objektart)
  return zeileFuerUebergang(pruefung, ketten.objektart, ketten.vonStatus, ketten.nachStatus)
}
