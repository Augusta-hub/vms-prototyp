/**
 * Die Lage lesen, gegen die P9 rechnet.
 *
 * SPEC 5.0, Festlegung 4: „Jede Berechnungsvorschrift nennt ihre Eingangsdaten
 * mit Objekt und Feld aus Kapitel 3." Dieses Modul stellt genau diese
 * Eingangsdaten her: aus den Vorbedingungen und dem Auslöser eines Vorgangs
 * werden Erlaubnissätze (3.2) und ein Prüfzeitraum (5.0). Den Teil, den jede
 * Prüfung braucht — Anlass, Stichtag, Status, Zeitangaben, Übersteuerung —
 * liest `vorgangslage.ts`.
 *
 * **Warum es diese Schicht gibt.** Der Rechenweg in `regeln/p9Erlaubnis.ts`
 * kennt nur Erlaubnissätze und Tage. Woher sie kommen — aus der Datenbank, aus
 * einem Formular oder aus einem Szenariosatz der Gherkin-Suite — ist seine
 * Sache nicht. Diese Schicht ist der Übersetzer; sie enthält **keine** Regel.
 *
 * **Lesarten, die hier festgelegt sind** (und nicht in SPEC Kapitel 5 stehen,
 * weil sie den Vorgang betreffen, nicht die Rechtslage):
 *
 *  1. Ein neu genannter Erlaubnissatz gilt als anerkannt und mit hinterlegter
 *     Urkunde, solange der Vorgang nichts anderes sagt. Abweichungen werden
 *     ausdrücklich erfasst (`submitted`, `rejected`, „keine Urkunde").
 *  2. Nennt der Vorgang keine Erlaubnisart, folgt sie dem Enddatum: mit
 *     Enddatum `fixedTerm`, ohne `unlimited` (3.2: `validTo` Pflicht bei
 *     `fixedTerm`, leer bei `unlimited`).
 *  3. Nennt der Vorgang den Tag eines Übergangs nicht, wird der Prüfzeitraum
 *     **nicht geraten**: geprüft wird der Endtag, den er nennt. Lässt sich
 *     kein Tag bestimmen, bleibt der Zeitraum leer — und eine fehlende
 *     Rechengrundlage wirkt wie ein Treffer (5.0).
 *  4. Ein Satz, der eine Tatsache *außerhalb* des Systems feststellt
 *     („besteht nachweislich", „ist nicht erfasst"), ändert keine Daten. Er ist
 *     die Grundlage einer Übersteuerung (5.5.4, Bedingung a), kein
 *     Erlaubnissatz — sonst würde die Übersteuerung die Lücke schließen, die
 *     sie überbrücken soll.
 */

import { folgetag, type Tag } from '../kalender'
import {
  QUERSCHNITT,
  zeileFuerNachtlauf,
  zeileFuerUebergang,
  type Objektart,
  type Querschnittzeile,
} from '../querschnitt'
import type {
  Anerkennung,
  Erlaubnisart,
  Erlaubnislage,
  Erlaubnissatz,
  Zeitraum,
} from '../regeln/p9Erlaubnis'
import type { Ausloeser, Sachverhalt } from '../typen'
import {
  alsObjektart,
  alsTag,
  DATUM,
  einTag,
  firmennamen,
  leseVorgangslage,
  neuerZeitraum,
  type Anlass,
  type Uebersteuerungslage,
  type Zeitangaben,
} from './vorgangslage'

export type { Anlass, Uebersteuerungslage } from './vorgangslage'

export interface Lieferantenlage {
  readonly name: string
  /** Lieferantenstatus nach 4.6; `null`, wenn der Vorgang ihn nicht nennt. */
  readonly status: string | null
  readonly lage: Erlaubnislage
}

export interface Prueflage {
  readonly anlass: Anlass
  readonly zeile: Querschnittzeile | null
  readonly objektart: Objektart
  readonly vonStatus: string | null
  readonly nachStatus: string | null
  readonly stichtag: Tag | null
  /** Der Lieferant, um dessen Erlaubnis es geht. */
  readonly gegenstand: Lieferantenlage
  /** Bei Q04 je eingeladenem Lieferanten eine eigene Feststellung (5.4.1). */
  readonly einladungen: readonly Lieferantenlage[]
  readonly uebersteuerung: Uebersteuerungslage
}

/** Nachweisarten, die P10 bedient — sie sind keine AÜG-Erlaubnis (SPEC 5.4.4). */
const NACHWEISE_VON_P10 =
  /Arbeitserlaubnis|Unterweisung|Qualifikationsnachweis|Unbedenklichkeitsbescheinigung/

/** Sätze, die eine Tatsache außerhalb des Systems feststellen (Lesart 4). */
const AUSSERHALB_DES_SYSTEMS =
  /nachweislich|tatsächlich (?:nicht|keine|kein)\b|besteht tatsächlich|nicht eingestellt|nicht erfasst|nicht vollzogen|hat tatsächlich nicht/

/** Verweis auf einen Erlaubnissatz mit Kennung. */
const SATZVERWEIS = /(?:Erlaubnissatz(?:es)?|Nachfolgesatz)\s+"([^"]+)"/g

interface Satzentwurf {
  id: string
  art: Erlaubnisart | null
  gueltigVon: Tag | null
  gueltigBis: Tag | null
  anerkennung: Anerkennung
  urkunde: boolean
  datei: boolean
  vorgaenger: string | null
}

interface Satzfakten {
  art?: Erlaubnisart
  gueltigVon?: Tag
  gueltigBis?: Tag | null
  anerkennung?: Anerkennung
  urkunde?: boolean
  datei?: boolean
  vorgaenger?: string
}

/** Liest die Lage aus den Vorbedingungen und dem Auslöser eines Vorgangs. */
export function leseErlaubnislage(
  sachverhalte: readonly Sachverhalt[],
  ausloeser: Ausloeser,
): Prueflage {
  const vorgang = leseVorgangslage(sachverhalte, ausloeser)
  const saetze = new Map<string, Map<string, Satzentwurf>>()

  let lieferantImSatz: string | null = null
  for (const { satz, ausSzenario } of vorgang.saetze) {
    const genannt = firmennamen(satz)
    if (genannt.length > 0 && (ausSzenario || lieferantImSatz === null)) {
      lieferantImSatz = genannt[genannt.length - 1] ?? lieferantImSatz
    }
    leseErlaubnissaetze(satz, saetze, vorgang.lieferantImSzenario ?? lieferantImSatz)
  }

  const uebersteuert =
    vorgang.anlass === 'uebersteuerung' || vorgang.anlass === 'uebersteuerungsversuch'

  // Der nächtliche Lauf prüft nach 5.5.1, Zeile N1 die **Lieferanten**; der
  // Satz „der nächtliche Lauf läuft" nennt kein Objekt.
  const objektart =
    vorgang.anlass === 'nachtlauf'
      ? 'lieferant'
      : uebersteuert
        ? (vorgang.gesperrterVorgang?.objektart ?? alsObjektart(ausloeser.objektart))
        : alsObjektart(ausloeser.objektart)
  const nachStatus = uebersteuert
    ? (vorgang.gesperrterVorgang?.nachStatus ?? ausloeser.zielstatus)
    : (ausloeser.zielstatus ?? impliziterZielstatus(objektart))

  const gegenstandName = pruefgegenstand(vorgang.lieferantImSzenario, vorgang.lieferanten, saetze)
  const gelesenerVonStatus =
    objektart === 'lieferant'
      ? (vorgang.lieferantenstatus.get(gegenstandName) ?? null)
      : vorgang.vorgangsstatus

  const zeile =
    vorgang.anlass === 'nachtlauf'
      ? zeileFuerNachtlauf('P9', 'lieferant')
      : zeileFuerUebergang('P9', objektart, gelesenerVonStatus, nachStatus)

  const pruefzeitraum = bestimmePruefzeitraum(zeile, vorgang.zeit, vorgang.stichtag)

  const lage = (name: string): Lieferantenlage => ({
    name,
    status: vorgang.lieferantenstatus.get(name) ?? null,
    lage: {
      lieferant: name,
      saetze: [...(saetze.get(name)?.values() ?? [])].map(fertigerSatz),
      zeitraum: pruefzeitraum,
      unterbrechungen: vorgang.zeit.unterbrechungen,
    },
  })

  return {
    anlass: vorgang.anlass,
    zeile,
    objektart,
    vonStatus: gelesenerVonStatus ?? zeile?.von ?? null,
    nachStatus,
    stichtag: vorgang.stichtag,
    gegenstand: lage(gegenstandName),
    einladungen: vorgang.eingeladen.map(lage),
    uebersteuerung: vorgang.uebersteuerung,
  }
}

/**
 * Welcher Lieferant ist der Prüfgegenstand? Nennt das Szenario einen, ist es
 * dieser. Nennt es keinen, kommt nur ein Lieferant mit Erlaubnissätzen in
 * Betracht — und nur, wenn es genau einer ist. Sonst sagt der Vorgang nicht,
 * wessen Erlaubnis gemeint ist; dann wird **nicht geraten**, und die fehlende
 * Angabe wirkt wie ein Treffer (5.0).
 */
function pruefgegenstand(
  imSzenario: string | null,
  lieferanten: readonly string[],
  saetze: Map<string, Map<string, Satzentwurf>>,
): string {
  if (imSzenario !== null) return imSzenario
  const mitSaetzen = lieferanten.filter((name) => (saetze.get(name)?.size ?? 0) > 0)
  if (mitSaetzen.length === 1) return mitSaetzen[0] as string
  return '(ohne Lieferantenangabe)'
}

function fertigerSatz(entwurf: Satzentwurf): Erlaubnissatz {
  return {
    id: entwurf.id,
    // Lesart 2: ohne ausdrückliche Erlaubnisart folgt sie dem Enddatum (3.2).
    art: entwurf.art ?? (entwurf.gueltigBis === null ? 'unlimited' : 'fixedTerm'),
    gueltigVon: entwurf.gueltigVon,
    gueltigBis: entwurf.gueltigBis,
    anerkennung: entwurf.anerkennung,
    urkunde: entwurf.urkunde,
    datei: entwurf.datei,
    vorgaenger: entwurf.vorgaenger,
  }
}

/**
 * „Der MSP-Disponent erzeugt die Einladung" nennt keinen Zielstatus. Hat die
 * Objektart in 4.7 genau eine Zeile zu P9, ist ihr Zielstatus gemeint.
 */
function impliziterZielstatus(objektart: Objektart): string | null {
  const zeilen = QUERSCHNITT.filter(
    (zeile) => zeile.pruefung === 'P9' && zeile.objekt === objektart && zeile.nach !== null,
  )
  return zeilen.length === 1 ? (zeilen[0]?.nach ?? null) : null
}

/**
 * Der Prüfzeitraum nach der Tabelle in SPEC 5.0, Abschnitt „Stichtag und
 * Prüfzeitraum" — je Prüfanlass eine eigene Zeile. Die Zeilennummern aus 4.7
 * sind der Schlüssel; eine Zeile ohne Eintrag bekommt den ausdrücklich
 * genannten Zeitraum und sonst keinen (Lesart 3).
 */
function bestimmePruefzeitraum(
  zeile: Querschnittzeile | null,
  zeit: Zeitangaben,
  stichtag: Tag | null,
): Zeitraum | null {
  switch (zeile?.nummer) {
    // „Bedarfsanfrage approved → tendered, Einladung → invited: Prüfzeitraum
    //  Tag des Übergangs bis offerDeadline der Ausschreibung."
    case 'Q04':
    case 'Q06': {
      const bis = zeit.angebotsfrist
      if (bis === null) return zeit.zeitraum
      return { von: zeit.uebergangstag ?? stichtag ?? bis, bis }
    }
    // „Einsatz → planned: plannedStartDate bis plannedEndDate."
    case 'Q16':
      return zeit.geplant ?? zeit.zeitraum
    // „Einsatz planned → active: Stichtag actualStartDate."
    case 'Q20': {
      const start = zeit.tatsaechlicherBeginn ?? stichtag
      return start === null ? zeit.zeitraum : { von: start, bis: start }
    }
    // „Verlängerung approved → effective: bisheriges plannedEndDate + 1 Tag
    //  bis newEndDate."
    case 'Q31': {
      if (zeit.bisherigesEnde === null || zeit.neuesEnde === null) return zeit.zeitraum
      return { von: folgetag(zeit.bisherigesEnde), bis: zeit.neuesEnde }
    }
    // „Abrechnungsbeleg → created: frühester periodFrom bis spätester periodTo."
    case 'Q38':
      return zeit.leistung ?? zeit.periode ?? zeit.zeitraum
    // „Lieferant onboarding / blocked / inactive → active: Tag des Übergangs."
    case 'Q41':
    case 'Q43':
    case 'Q44':
      return stichtag === null ? zeit.zeitraum : { von: stichtag, bis: stichtag }
    // „Nächtlicher Lauf: Stichtag ist der Tag des Laufs."
    case 'N1':
      return stichtag === null ? null : { von: stichtag, bis: stichtag }
    default:
      return zeit.zeitraum
  }
}

function leseErlaubnissaetze(
  satz: string,
  saetze: Map<string, Map<string, Satzentwurf>>,
  standardLieferant: string | null,
): void {
  // „Der Nachfolgesatz »EP-2« ist ab dem 02.07.2026 gültig" nennt das Wort
  // Erlaubnis nicht und ist doch ein Erlaubnissatz (3.2, `supersedesRef`).
  if (!/Erlaubnis|Nachfolgesatz/.test(satz)) return
  if (NACHWEISE_VON_P10.test(satz)) return
  if (AUSSERHALB_DES_SYSTEMS.test(satz)) return
  if (/\bKandidat/.test(satz)) return

  const verweise = [...satz.matchAll(SATZVERWEIS)]
  const abschnitte: { id: string | null; text: string }[] = []

  if (verweise.length === 0) {
    abschnitte.push({ id: null, text: satz })
  } else {
    for (const [stelle, verweis] of verweise.entries()) {
      const ende = verweise[stelle + 1]?.index ?? satz.length
      abschnitte.push({ id: verweis[1] ?? null, text: satz.slice(verweis.index, ende) })
    }
  }

  for (const abschnitt of abschnitte) {
    const fakten = leseSatzfakten(abschnitt.text)
    if (Object.keys(fakten).length === 0) continue
    const lieferant = firmennamen(abschnitt.text)[0] ?? firmennamen(satz)[0] ?? standardLieferant
    if (lieferant === null) continue
    uebernehmen(saetze, lieferant, abschnitt.id, fakten)
  }
}

function leseSatzfakten(text: string): Satzfakten {
  const fakten: Satzfakten = {}

  if (/unbefristet|"unlimited"/.test(text)) fakten.art = 'unlimited'
  else if (/befristet|"fixedTerm"/.test(text)) fakten.art = 'fixedTerm'

  const zeitraum = neuerZeitraum(text, new RegExp(`vom ${DATUM} bis (?:zum )?${DATUM}`))
  if (zeitraum !== null) {
    fakten.gueltigVon = zeitraum.von
    fakten.gueltigBis = zeitraum.bis
  } else {
    const ab = einTag(text, new RegExp(`(?:ab dem|mit Beginn) ${DATUM}`))
    if (ab !== null) fakten.gueltigVon = ab
    // Eine Berichtigung nennt das alte und das neue Ende: „von … auf …" (5.4.5,
    // „Rückwirkende Korrektur von validTo").
    const berichtigt = new RegExp(`von ${DATUM} auf ${DATUM}`).exec(text)?.[2]
    if (berichtigt !== undefined) {
      fakten.gueltigBis = alsTag(berichtigt)
    } else {
      const bis =
        einTag(text, new RegExp(`bis zum ${DATUM}`)) ??
        einTag(text, new RegExp(`Enddatum ${DATUM}`)) ??
        einTag(text, new RegExp(`bis ${DATUM} gültig`))
      if (bis !== null) fakten.gueltigBis = bis
    }
  }

  if (/ohne Enddatum|kein(?:em|en)? Enddatum/.test(text)) fakten.gueltigBis = null

  const anerkennungsstatus = /Anerkennungsstatus "([^"]+)"/.exec(text)?.[1]
  if (anerkennungsstatus !== undefined && istAnerkennung(anerkennungsstatus)) {
    fakten.anerkennung = anerkennungsstatus
  } else if (/nicht anerkannt/.test(text)) {
    // „Nicht anerkannt" heißt: die Anerkennung steht aus (5.4.3) — sie ist
    // nicht zurückgewiesen, solange der Vorgang das nicht sagt.
    fakten.anerkennung = 'submitted'
  } else if (/\banerkannt\b/.test(text)) {
    fakten.anerkennung = 'accepted'
  }

  if (/keine Urkunde hinterlegt|ohne (?:hinterlegte )?Urkunde/.test(text)) fakten.urkunde = false
  else if (/hinterlegter Urkunde|Urkunde hinterlegt/.test(text)) fakten.urkunde = true

  if (/ohne (?:hinterlegte )?Datei/.test(text)) fakten.datei = false

  const vorgaenger = /verweist auf "([^"]+)" als Vorgänger/.exec(text)?.[1]
  if (vorgaenger !== undefined) fakten.vorgaenger = vorgaenger

  return fakten
}

function uebernehmen(
  saetze: Map<string, Map<string, Satzentwurf>>,
  lieferant: string,
  id: string | null,
  fakten: Satzfakten,
): void {
  let eigene = saetze.get(lieferant)
  if (eigene === undefined) {
    eigene = new Map<string, Satzentwurf>()
    saetze.set(lieferant, eigene)
  }

  const ziele = id === null ? [...eigene.values()] : [eigene.get(id) ?? neuerEntwurf(id, eigene)]
  if (ziele.length === 0) {
    // Ein Satz ohne Kennung und ohne vorhandenen Erlaubnissatz legt einen an.
    ziele.push(neuerEntwurf('(ohne Kennung)', eigene))
  }

  for (const ziel of ziele) {
    if (fakten.art !== undefined) ziel.art = fakten.art
    if (fakten.gueltigVon !== undefined) ziel.gueltigVon = fakten.gueltigVon
    if (fakten.gueltigBis !== undefined) ziel.gueltigBis = fakten.gueltigBis
    if (fakten.anerkennung !== undefined) ziel.anerkennung = fakten.anerkennung
    if (fakten.urkunde !== undefined) {
      ziel.urkunde = fakten.urkunde
      if (!fakten.urkunde) ziel.datei = false
    }
    if (fakten.datei !== undefined) ziel.datei = fakten.datei
    if (fakten.vorgaenger !== undefined) ziel.vorgaenger = fakten.vorgaenger
  }
}

/** Lesart 1: anerkannt und mit hinterlegter Urkunde, bis der Vorgang widerspricht. */
function neuerEntwurf(id: string, eigene: Map<string, Satzentwurf>): Satzentwurf {
  const entwurf: Satzentwurf = {
    id,
    art: null,
    gueltigVon: null,
    gueltigBis: null,
    anerkennung: 'accepted',
    urkunde: true,
    datei: true,
    vorgaenger: null,
  }
  eigene.set(id, entwurf)
  return entwurf
}

function istAnerkennung(wert: string): wert is Anerkennung {
  return wert === 'submitted' || wert === 'accepted' || wert === 'rejected'
}
