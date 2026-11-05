/**
 * Die Lage lesen, gegen die P8 rechnet (SPEC 5.3.3).
 *
 * **Lesarten, die hier festgelegt sind:**
 *
 *  1. **Die Grundlage ist eine vollständige, rechtmäßige Lage; ein Szenario
 *     nennt die Abweichung.** Die Gherkin-Grundlage sagt es selbst: „die
 *     Angaben dieser Grundlage gelten, soweit ein Szenario nichts anderes
 *     sagt". Und ein Szenariogrundriss, der genau **ein** nicht erfülltes
 *     Kriterium nennt, behauptet damit, dass die anderen erfüllt sind. Dieser
 *     Leser setzt die Kriterien deshalb als erfüllt an, bis ein Satz sie
 *     wegnimmt.
 *
 *     Das ist **keine** Abweichung vom Grundsatz aus 5.0 („eine fehlende
 *     Angabe wirkt wie ein Treffer"). Der Grundsatz gilt für **Daten**, und
 *     daran hält sich `p8Konkretisierung.ts` ohne Ausnahme: ein `null` in der
 *     Lage ist dort ein Treffer. Dieser Leser liest keine Daten, sondern eine
 *     **erzählte** Lage — und eine Erzählung, die ein Feld nicht erwähnt,
 *     bestreitet es nicht. Gegen echte Daten läuft dieselbe Regel in
 *     `lib/services/staffing.ts`, und dort gibt es keine Vorbelegung.
 *  2. **Die Identität von Tätigkeit und Titel ist eine Tatsache des Vorgangs.**
 *     Wo das Szenario beide Texte nennt, vergleicht dieser Leser sie; wo es
 *     „identisch" oder „eigenständig" sagt, nimmt er die Feststellung. Der
 *     Rechenweg bekommt das Ergebnis als Eingangsdatum — er vergleicht keine
 *     Sätze über Sätze.
 *  3. **Der Tag der Anlage ist der Tag des Übergangs nach `planned`** (K5,
 *     3.12). Nennt ihn kein Satz, bleibt er `null` — und dann ist K5 **nicht
 *     prüfbar**. Hier wird nichts vorbelegt: K5 ist das Kriterium, dessen
 *     Verletzung nach dem ersten Überlassungstag nicht mehr heilbar ist, und
 *     eine Vorbelegung wäre genau an der schärfsten Stelle eine Annahme.
 */

import { istTag, type Tag } from '../kalender'
import {
  zeileFuerUebergang,
  type Objektart,
  type Querschnittzeile,
} from '../querschnitt'
import type {
  Konkretisierungslage,
  Pruefstufe,
  Rahmenvertrag,
} from '../regeln/p8Konkretisierung'
import type { Ausloeser, Sachverhalt } from '../typen'
import {
  alsObjektart,
  DATUM,
  einTag,
  lieferantAusSatz,
  leseVorgangslage,
  neuerZeitraum,
  personAusSatz,
  type Anlass,
  type Uebersteuerungslage,
} from './vorgangslage'

/**
 * Was ein Szenario über die Tätigkeitsbeschreibung sagt, wenn es keinen Text
 * nennt. Der Wert steht in der Lage und nicht im Rechenweg: er ist eine
 * Angabe des Vorgangs, kein Vorbehalt der Regel (Lesart 1).
 */
const EIGENSTAENDIG = '(eigenständig geführt; der Text ist nicht Gegenstand des Szenarios)'

export interface Konkretisierungsprueflage {
  readonly anlass: Anlass
  readonly zeile: Querschnittzeile | null
  readonly objektart: Objektart
  readonly vonStatus: string | null
  readonly nachStatus: string | null
  readonly stichtag: Tag | null
  readonly uebersteuerung: Uebersteuerungslage
  readonly stufe: Pruefstufe
  readonly person: string | null
  readonly lage: Konkretisierungslage
}

/** Liest die Lage für P8 (SPEC 5.3.3). */
export function leseKonkretisierungslage(
  sachverhalte: readonly Sachverhalt[],
  ausloeser: Ausloeser,
): Konkretisierungsprueflage {
  const vorgang = leseVorgangslage(sachverhalte, ausloeser)

  // Lesart 1: die Grundlage trägt die Vorbesetzung, das Szenario die Abweichung.
  let vertrag: Rahmenvertrag | null = null
  let preisposition: string | null = null
  let kandidat: string | null = null
  let person: string | null = null
  let lieferant: string | null = null
  let titel: string | null = null
  let taetigkeit: string | null = EIGENSTAENDIG
  let wieTitel = false
  let mitAnfrage = true
  let qualifikation: boolean | null = null
  let standort: string | null = null
  let beginnGesetzt = true
  let beginn: Tag | null = null
  let ende: Tag | null = null
  let anlagetag: Tag | null = null
  let erstertag: Tag | null = null

  for (const { satz } of vorgang.saetze) {
    const gelesenePerson = personAusSatz(satz)
    if (gelesenePerson !== null) {
      person = gelesenePerson
      if (/\bKandidat\b|für "|Einsatz von "/.test(satz)) kandidat = gelesenePerson
    }

    const gelesenerLieferant = lieferantAusSatz(satz)
    if (gelesenerLieferant !== null) lieferant = gelesenerLieferant

    const gelesenerVertrag = leseRahmenvertrag(satz, vertrag)
    if (gelesenerVertrag !== undefined) vertrag = gelesenerVertrag

    const gelesenePosition = lesePreisposition(satz)
    if (gelesenePosition !== undefined) preisposition = gelesenePosition

    // `candidateRef` ausdrücklich nicht gesetzt (K2).
    if (/kein Kandidat gesetzt/.test(satz)) kandidat = null

    const gelesenerStandort = leseStandort(satz)
    if (gelesenerStandort !== undefined) standort = gelesenerStandort

    const gelesenerTitel = leseTitel(satz)
    if (gelesenerTitel !== null) titel = gelesenerTitel

    // Lesart 2.
    if (/\bidentisch\b|lauten beide/.test(satz)) {
      wieTitel = true
      if (gelesenerTitel !== null) taetigkeit = gelesenerTitel
    } else if (/eigenständig/.test(satz)) {
      wieTitel = false
      taetigkeit = EIGENSTAENDIG
    }
    if (/keine Tätigkeitsbeschreibung (?:gesetzt|erfasst)/.test(satz)) taetigkeit = null

    if (/ohne Bezug zu einer Bedarfsanfrage/.test(satz)) mitAnfrage = false
    if (/Qualifikationsanforderung/.test(satz)) {
      qualifikation = !/keine Qualifikationsanforderung/.test(satz)
    }

    // `plannedStartDate` ausdrücklich nicht gesetzt (K4).
    if (/kein(?:en)? (?:geplanter |geplanten )?Beginn gesetzt/.test(satz)) beginnGesetzt = false

    const zeiten = leseZeiten(satz)
    if (zeiten.beginn !== null) beginn = zeiten.beginn
    if (zeiten.ende !== null) ende = zeiten.ende
    if (zeiten.anlage !== null) anlagetag = zeiten.anlage
    if (zeiten.erstertag !== null) erstertag = zeiten.erstertag
  }

  const uebersteuert =
    vorgang.anlass === 'uebersteuerung' || vorgang.anlass === 'uebersteuerungsversuch'
  const gelesene = alsObjektart(ausloeser.objektart)
  const objektart: Objektart = uebersteuert
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

  const zeile = zeileFuerUebergang('P8', objektart, vonStatus, nachStatus)
  // Die Überlassung hat begonnen, sobald `actualStartDate` gesetzt ist — es
  // wird beim Übergang `planned` → `active` gesetzt (4.3.1). Der Status allein
  // genügt nicht: „ein Einsatz läuft seit dem 01.09.2026 im Status »active«"
  // nennt den Zustand in einer Wendung, die der Statusleser nicht liest.
  const stufe = bestimmeStufe(objektart, vonStatus, nachStatus, erstertag !== null)

  return {
    anlass: vorgang.anlass,
    zeile,
    objektart,
    vonStatus: vonStatus ?? zeile?.von ?? null,
    nachStatus: nachStatus ?? zeile?.nach ?? null,
    stichtag: istTag(ausloeser.stichtag) ? ausloeser.stichtag : (erstertag ?? beginn),
    uebersteuerung: vorgang.uebersteuerung,
    stufe,
    person,
    lage: {
      preisposition,
      rahmenvertrag: vertrag,
      lieferant,
      kandidat,
      taetigkeit,
      titelDerAnfrage: titel,
      taetigkeitWieTitel: wieTitel,
      mitAnfrage,
      qualifikationsanforderung: qualifikation,
      standort,
      beginnGesetzt,
      geplanterBeginn: beginn,
      geplantesEnde: ende,
      anlagetag,
      ersterUeberlassungstag: erstertag ?? beginn,
    },
  }
}

/* ------------------------------------------------------------------ */

/**
 * Die Prüfstufe (5.3.3, Nr. 1 bis 3). Sie hängt am Objekt und am Status, nicht
 * am Tag: die Bedarfsanfrage ist kein Überlassungsvertrag, das Anlegen prüft
 * K1 bis K4, der Start zusätzlich K5.
 *
 * Maßgeblich ist **auch der Ausgangsstatus**: an einem Einsatz, der schon
 * `active` ist, hat die Überlassung begonnen. Eine Berichtigung an ihm (5.5.1 b,
 * 5.3.3 Grenzfall „Rückwirkende Korrektur") stellt damit dieselbe Frage wie der
 * Start — lag die Konkretisierung vor dem ersten Überlassungstag vor? Sie ist
 * dort regelmäßig **nicht prüfbar**, und genau das soll sichtbar werden: der
 * Verstoß wird festgestellt und eskaliert, nicht rückwirkend gesperrt.
 */
function bestimmeStufe(
  objektart: Objektart,
  vonStatus: string | null,
  nachStatus: string | null,
  begonnen: boolean,
): Pruefstufe {
  if (objektart === 'bedarfsanfrage') return 'anfrage'
  if (nachStatus === 'active' || vonStatus === 'active' || begonnen) return 'start'
  return 'anlage'
}

/**
 * Der Rahmenvertrag der Lieferantenseite (K1). `undefined` heißt: der Satz sagt
 * nichts. Ein Satz, der nur den Status oder nur das Ende nennt, **ändert** den
 * bereits gelesenen Vertrag — er ersetzt ihn nicht (Lesart 1).
 */
function leseRahmenvertrag(
  satz: string,
  bisher: Rahmenvertrag | null,
): Rahmenvertrag | undefined {
  if (!/Rahmenvertrag/.test(satz)) return undefined

  const bezeichnung = /Rahmenvertrag "([^"]+)"/.exec(satz)?.[1] ?? bisher?.bezeichnung ?? null
  const laufzeit = neuerZeitraum(
    satz,
    new RegExp(`Laufzeit vom ${DATUM} bis (?:zum )?${DATUM}`),
  )
  const endet = einTag(satz, new RegExp(`endet am ${DATUM}`))
  // „steht nicht mehr im Status »active«" und „steht im Status »terminated«"
  // sagen dasselbe auf zwei Weisen. Der zweite nennt den Wert, der erste
  // verneint ihn — beides nimmt K1 die Grundlage.
  // „besteht der Rahmenvertrag … im Status »active«" und „steht im Status
  // »terminated«" nennen beide den Status; nur das Verb wechselt. Das Muster
  // greift deshalb am „im Status", nicht am Verb.
  const genannterStatus = /im Status "([^"]+)"/.exec(satz)?.[1]
  const verneint = /nicht mehr im Status/.test(satz)
  const status =
    genannterStatus === undefined
      ? /gekündigt/.test(satz)
        ? 'terminated'
        : /aktiven Rahmenvertrag/.test(satz)
          ? 'active'
          : (bisher?.status ?? null)
      : verneint
        ? 'terminated'
        : genannterStatus

  // „zwischen Betreiber und »X«" nennt die Gegenpartei der Lieferantenseite.
  const gegenpartei = lieferantAusSatz(satz) ?? bisher?.gegenpartei ?? null

  return {
    bezeichnung,
    // 3.3: ein Rahmenvertrag „zwischen Betreiber und einem Lieferanten" ist ein
    // `supplierAgreement`. Die Szenarien schreiben „der Lieferantenseite".
    art: /Lieferantenseite|zwischen Betreiber und/.test(satz)
      ? 'supplierAgreement'
      : (bisher?.art ?? null),
    status,
    gegenpartei,
    laufzeitVon: laufzeit?.von ?? bisher?.laufzeitVon ?? null,
    laufzeitBis: endet ?? laufzeit?.bis ?? bisher?.laufzeitBis ?? null,
  }
}

/** `agreedRateCardItemRef` (3.7). `null` heißt: ausdrücklich nicht gesetzt. */
function lesePreisposition(satz: string): string | null | undefined {
  if (!/Preisposition/.test(satz)) return undefined
  if (/keine vereinbarte Preisposition|keine Preisposition/.test(satz)) return null
  return /Preisposition "([^"]+)"/.exec(satz)?.[1] ?? undefined
}

/** `siteRef` (3.7). `null` heißt: ausdrücklich nicht gesetzt. */
function leseStandort(satz: string): string | null | undefined {
  if (/kein Standort gesetzt/.test(satz)) return null
  if (!/Standort/.test(satz)) return undefined
  return (
    /Standort(?:s|es)?\s+"([^"]+)"/.exec(satz)?.[1] ??
    /"(Werk [^"]+)"/.exec(satz)?.[1] ??
    undefined
  )
}

/** `demandRequest.title` (3.4). */
function leseTitel(satz: string): string | null {
  return (
    /[Ii]hr Titel ist "([^"]+)"/.exec(satz)?.[1] ??
    /lauten beide "([^"]+)"/.exec(satz)?.[1] ??
    /Titel "([^"]+)"/.exec(satz)?.[1] ??
    null
  )
}

interface Zeiten {
  readonly beginn: Tag | null
  readonly ende: Tag | null
  readonly anlage: Tag | null
  readonly erstertag: Tag | null
}

/**
 * Die Tage, die P8 braucht: geplanter Beginn und geplantes Ende (K4 und die
 * Deckung des Prüfzeitraums durch K1), der Tag des Übergangs nach `planned`
 * und der erste Überlassungstag (K5).
 */
function leseZeiten(satz: string): Zeiten {
  const spanne = neuerZeitraum(
    satz,
    new RegExp(`Einsatz vom ${DATUM} bis (?:zum )?${DATUM}`),
  )
  return {
    beginn:
      spanne?.von ??
      einTag(satz, new RegExp(`geplantem Beginn ${DATUM}`)) ??
      einTag(satz, new RegExp(`geplanten Beginn ${DATUM}`)) ??
      null,
    ende:
      spanne?.bis ??
      einTag(satz, new RegExp(`geplantem Ende ${DATUM}`)) ??
      null,
    // Lesart 3: nur ein Satz, der den Übergang nach `planned` datiert, setzt ihn.
    anlage: einTag(satz, new RegExp(`am ${DATUM} in den Status "planned" überführt`)),
    erstertag:
      einTag(satz, new RegExp(`tatsächliche(?:r)? Beginn ist der ${DATUM}`)) ??
      einTag(satz, new RegExp(`tatsächlichem Beginn ${DATUM}`)) ??
      einTag(satz, new RegExp(`läuft seit dem ${DATUM}`)) ??
      null,
  }
}
