/**
 * Die Lage lesen, gegen die P10 rechnet (SPEC 5.4.4).
 *
 * Wie `erlaubnislage.ts` für P9: aus den Vorbedingungen und dem Auslöser werden
 * Nachweise (3.10), die Pflichtangaben (`workPermitRequired` aus 3.6,
 * `safetyBriefingRequired` aus 3.1) und der Prüfzeitraum (5.0). Den gemeinsamen
 * Teil liest `vorgangslage.ts`.
 *
 * **Lesarten, die hier festgelegt sind:**
 *
 *  1. Ein genannter Nachweis gilt als anerkannt mit hinterlegter Datei, solange
 *     der Vorgang nichts anderes sagt — wie bei P9.
 *  2. „Ist anerkannt und gültig" **ohne** Enddatum heißt unbefristet; 5.4.4
 *     lässt das ausdrücklich zu („ein anerkannter Nachweis ohne Enddatum gilt
 *     unbefristet und läuft nicht ab").
 *  3. „Kein X erfasst" ist eine **Feststellung über das Fehlen** und wird als
 *     solche vermerkt. Das zählt: eine Art, die nach dem Katalog nie Pflicht
 *     ist, wird nur dadurch zum Befund.
 *  4. „Nicht erfasst, ob …" lässt die Pflichtangabe leer — und leer wird nach
 *     5.4.6 wie „ja" gerechnet. Der Unterschied zwischen „nein" und „nicht
 *     gesetzt" darf beim Lesen nicht verloren gehen.
 */

import type { Tag } from '../kalender'
import {
  QUERSCHNITT,
  zeileFuerNachtlauf,
  zeileFuerUebergang,
  type Objektart,
  type Querschnittzeile,
} from '../querschnitt'
import type { Nachweis, Nachweislage } from '../regeln/p10Nachweise'
import type { Zeitraum } from '../regeln/p9Erlaubnis'
import type { Nachweisart } from '../regelwerk'
import type { Ausloeser, Sachverhalt } from '../typen'
import {
  alsObjektart,
  DATUM,
  einTag,
  firmennamen,
  leseVorgangslage,
  letztes,
  neuerZeitraum,
  type Anlass,
  type Uebersteuerungslage,
  type Zeitangaben,
} from './vorgangslage'

export interface Nachweisprueflage {
  readonly anlass: Anlass
  readonly zeile: Querschnittzeile | null
  readonly objektart: Objektart
  readonly vonStatus: string | null
  readonly nachStatus: string | null
  readonly stichtag: Tag | null
  readonly lage: Nachweislage
  readonly uebersteuerung: Uebersteuerungslage
}

/** Wie die Szenarien die Nachweisarten aus 3.10 benennen. */
const ARTEN: ReadonlyArray<readonly [RegExp, Nachweisart]> = [
  [/Arbeitserlaubnis/, 'workPermit'],
  [/Unterweisung/, 'safetyBriefing'],
  [/Qualifikationsnachweis/, 'qualificationCertificate'],
  [/Unbedenklichkeitsbescheinigung/, 'clearanceCertificate'],
  [/Erlaubnisurkunde/, 'permitCertificate'],
]

/** Liest die Lage aus den Vorbedingungen und dem Auslöser eines Vorgangs. */
export function leseNachweislage(
  sachverhalte: readonly Sachverhalt[],
  ausloeser: Ausloeser,
): Nachweisprueflage {
  const vorgang = leseVorgangslage(sachverhalte, ausloeser)
  const nachweise = new Map<Nachweisart, Nachweis>()
  const abwesend = new Set<Nachweisart>()
  let arbeitserlaubnisErforderlich: boolean | null = null
  let bezugsobjekt: string | null = null

  for (const { satz } of vorgang.saetze) {
    const erforderlich = leseErforderlichkeit(satz)
    if (erforderlich !== undefined) arbeitserlaubnisErforderlich = erforderlich

    const fremd = leseFremdesBezugsobjekt(satz)
    if (fremd !== null) bezugsobjekt = fremd

    for (const [muster, art] of ARTEN) {
      if (!muster.test(satz)) continue
      if (nenntFehlen(satz)) {
        abwesend.add(art)
        nachweise.delete(art)
        continue
      }
      const gelesen = leseNachweis(satz, art, nachweise.get(art))
      if (gelesen !== null) {
        nachweise.set(art, gelesen)
        abwesend.delete(art)
      }
    }
  }

  const uebersteuert =
    vorgang.anlass === 'uebersteuerung' || vorgang.anlass === 'uebersteuerungsversuch'

  // N5 prüft die Nachweise zu laufenden Einsätzen (5.5.1); der Satz „der
  // nächtliche Lauf läuft" nennt kein Objekt.
  const objektart =
    vorgang.anlass === 'nachtlauf'
      ? 'einsatz'
      : uebersteuert
        ? (vorgang.gesperrterVorgang?.objektart ?? alsObjektart(ausloeser.objektart))
        : alsObjektart(ausloeser.objektart)
  const nachStatus = uebersteuert
    ? (vorgang.gesperrterVorgang?.nachStatus ?? ausloeser.zielstatus)
    : (ausloeser.zielstatus ?? impliziterZielstatus(objektart))

  const lieferant =
    vorgang.lieferantImSzenario ?? letztes(vorgang.lieferanten) ?? null
  const vonStatus =
    objektart === 'lieferant'
      ? (lieferant === null ? null : (vorgang.lieferantenstatus.get(lieferant) ?? null))
      : vorgang.vorgangsstatus

  const zeile =
    vorgang.anlass === 'nachtlauf'
      ? zeileFuerNachtlauf('P10', 'einsatz')
      : zeileFuerUebergang('P10', objektart, vonStatus, nachStatus)

  // `site.safetyBriefingRequired` gilt je Standort (3.1). Nennt der Vorgang
  // keinen Standort, bleibt die Angabe leer — und leer wirkt wie „ja" (5.4.6).
  const unterweisungVerlangt =
    vorgang.standortImSzenario === null
      ? null
      : (vorgang.standorte.get(vorgang.standortImSzenario) ?? null)

  return {
    anlass: vorgang.anlass,
    zeile,
    objektart,
    vonStatus: vonStatus ?? zeile?.von ?? null,
    nachStatus,
    stichtag: vorgang.stichtag,
    uebersteuerung: vorgang.uebersteuerung,
    lage: {
      zeitraum: bestimmePruefzeitraum(zeile, vorgang.zeit, vorgang.stichtag),
      nachweise: [...nachweise.values()],
      arbeitserlaubnisErforderlich,
      unterweisungVerlangt: unterweisungVerlangt === false ? false : unterweisungVerlangt,
      ausdruecklichAbwesend: [...abwesend],
      bezugsobjekt,
    },
  }
}

/**
 * `candidate.workPermitRequired` (3.6). `undefined` heißt: der Satz sagt nichts
 * dazu; `null` heißt: er sagt ausdrücklich, dass die Angabe fehlt (Lesart 4).
 */
function leseErforderlichkeit(satz: string): boolean | null | undefined {
  if (/nicht erfasst, ob eine Arbeitserlaubnis erforderlich/.test(satz)) return null
  if (/benötigt eine Arbeitserlaubnis|ist eine Arbeitserlaubnis erforderlich/.test(satz)) {
    return true
  }
  if (/keine Arbeitserlaubnis erforderlich/.test(satz)) return false
  return undefined
}

/**
 * „Die Arbeitserlaubnis ist nur am Kandidatensatz bei »X« eingestellt" — der
 * Nachweis gehört einem anderen Bezugsobjekt (5.4.5). Geprüft wird dann gegen
 * das Objekt, um das es geht.
 */
function leseFremdesBezugsobjekt(satz: string): string | null {
  if (!/für einen Einsatz über|prüft die Pflichtnachweise für/.test(satz)) return null
  return firmennamen(satz)[0] ?? null
}

/** Nennt der Satz, dass ein Nachweis **nicht** erfasst ist (Lesart 3)? */
function nenntFehlen(satz: string): boolean {
  return /kein(?:e|en|er)?\s+(?:\w+\s+)?(?:Nachweis|Unterweisungsnachweis|Qualifikationsnachweis|Unbedenklichkeitsbescheinigung|Arbeitserlaubnis)[^.]*(?:erfasst|liegt vor|vorhanden)|nicht erfasst\b|ist kein Nachweis/.test(
    satz,
  )
}

function leseNachweis(satz: string, art: Nachweisart, bisher?: Nachweis): Nachweis | null {
  const zeitraum = neuerZeitraum(satz, new RegExp(`vom ${DATUM} bis (?:zum )?${DATUM}`))
  const bis = einTag(satz, new RegExp(`bis zum ${DATUM}`))
  const am = einTag(satz, new RegExp(`\\bam ${DATUM} durchgeführt`))

  const anerkannt = /\banerkannt\b/.test(satz) && !/nicht anerkannt/.test(satz)
  const ohneEnde = /ohne Enddatum/.test(satz)
  const gueltig = /\bgültig\b/.test(satz)

  // Der Satz muss überhaupt etwas über den Nachweis sagen, sonst ist er nur
  // eine Erwähnung (z. B. „an dem eine Unterweisung verlangt wird").
  if (!anerkannt && !gueltig && zeitraum === null && bis === null && am === null && !ohneEnde) {
    return bisher ?? null
  }

  return {
    art,
    anerkennung: /nicht anerkannt/.test(satz)
      ? 'submitted'
      : (bisher?.anerkennung ?? (anerkannt || gueltig ? 'accepted' : 'submitted')),
    gueltigVon: zeitraum?.von ?? am ?? bisher?.gueltigVon ?? null,
    // Lesart 2: „anerkannt und gültig" ohne Enddatum gilt unbefristet (5.4.4).
    gueltigBis: ohneEnde ? null : (zeitraum?.bis ?? bis ?? bisher?.gueltigBis ?? null),
    datei: bisher?.datei ?? true,
    gehoertZu: null,
  }
}

function impliziterZielstatus(objektart: Objektart): string | null {
  const zeilen = QUERSCHNITT.filter(
    (zeile) => zeile.pruefung === 'P10' && zeile.objekt === objektart && zeile.nach !== null,
  )
  return zeilen.length === 1 ? (zeilen[0]?.nach ?? null) : null
}

/** Der Prüfzeitraum nach der Tabelle in SPEC 5.0. */
function bestimmePruefzeitraum(
  zeile: Querschnittzeile | null,
  zeit: Zeitangaben,
  stichtag: Tag | null,
): Zeitraum | null {
  switch (zeile?.nummer) {
    // „Profilvorschlag submitted → reviewed: availableFrom bis endDate der
    //  Bedarfsanfrage." Nennt der Vorgang beides nicht, bleibt der Zeitraum leer.
    case 'Q10':
      return zeit.zeitraum
    // „Einsatz planned → active: Stichtag actualStartDate."
    case 'Q21': {
      const start = zeit.tatsaechlicherBeginn ?? stichtag
      return start === null ? zeit.zeitraum : { von: start, bis: start }
    }
    // „Stundenzettel (alle Übergänge): periodFrom bis periodTo des Zettels."
    case 'Q37':
      return zeit.zettel ?? zeit.periode ?? zeit.zeitraum
    // „Lieferant onboarding / blocked / inactive → active: Tag des Übergangs."
    case 'Q42':
    case 'Q43':
    case 'Q44':
      return stichtag === null ? zeit.zeitraum : { von: stichtag, bis: stichtag }
    case 'N5':
      return stichtag === null ? null : { von: stichtag, bis: stichtag }
    default:
      return zeit.zeitraum
  }
}
