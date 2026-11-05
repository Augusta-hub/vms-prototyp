/**
 * Die Teile eines Vorgangs, die **jede** Prüfung braucht.
 *
 * P9 (Erlaubnis) und P10 (Pflichtnachweise) lesen dieselbe Grundlage: wer
 * handelt, welches Objekt, welcher Status, welcher Stichtag, welche
 * Zeiträume — und, bei einer Übersteuerung, welcher Übergang gesperrt ist und
 * ob die drei Bedingungen aus 5.5.4 erfüllt sind. Das steht hier **einmal**;
 * die prüfungseigenen Leser (`erlaubnislage.ts`, `nachweislage.ts`) setzen nur
 * noch ihre eigenen Objekte darauf.
 *
 * Dieses Modul entscheidet **nichts** fachlich. Es liest.
 */

import { istTag, tagVersetzt, type Tag } from '../kalender'
import type { Objektart } from '../querschnitt'
import type { Zeitraum } from '../regeln/p9Erlaubnis'
import type { Ausloeser, Sachverhalt } from '../typen'

/** Der Anlass der Prüfung (SPEC 5.5.1 und 5.5.4). */
export type Anlass =
  | 'uebergang'
  | 'uebergangsversuch'
  | 'uebersteuerung'
  | 'uebersteuerungsversuch'
  | 'nachtlauf'
  | 'berechnung'
  | 'berichtigung'
  /** Stamm- oder Bewegungsdaten werden erfasst — die Speicherung aus 5.5.1 b. */
  | 'erfassung'

/** Die Voraussetzungen einer Übersteuerung (SPEC 5.5.4, Bedingungen a bis c). */
export interface Uebersteuerungslage {
  readonly beantragt: boolean
  /** (a) Die Angabe im System ist nachweislich unrichtig oder unvollständig. */
  readonly angabeUnrichtig: boolean
  /** (b) Die Berichtigung ist nicht rechtzeitig möglich. */
  readonly berichtigungNichtMoeglich: boolean
  /** (c) Die Überlassung wäre nach richtiger Datenlage zulässig. */
  readonly datenlageZulaessig: boolean
}

/** Ein durch eine Prüfung gesperrter Übergang (SPEC 5.5.4). */
export interface Gesperrter {
  readonly objektart: Objektart
  readonly nachStatus: string
  /** Zustand, in dem der Vorgang bleibt (4.0, Regel 5); `null`, wo unbekannt. */
  readonly vonStatus: string | null
}

export interface Zeitangaben {
  zeitraum: Zeitraum | null
  geplant: Zeitraum | null
  leistung: Zeitraum | null
  /** Abrechnungsperiode als Monat (3.9), wenn kein Leistungszeitraum genannt ist. */
  periode: Zeitraum | null
  /** Zeitraum eines Stundenzettels (`periodFrom` / `periodTo`, 3.8). */
  zettel: Zeitraum | null
  angebotsfrist: Tag | null
  uebergangstag: Tag | null
  tatsaechlicherBeginn: Tag | null
  bisherigesEnde: Tag | null
  neuesEnde: Tag | null
  unterbrechungen: Zeitraum[]
}

/** Der gelesene Vorgang, ohne die Objekte einer einzelnen Prüfung. */
export interface Vorgangslage {
  readonly anlass: Anlass
  readonly stichtag: Tag | null
  readonly zeit: Zeitangaben
  /** Status des Vorgangs, um den es geht; `null`, wenn er nicht genannt ist. */
  readonly vorgangsstatus: string | null
  /**
   * Objektart des Vorgangs, dessen Status der Vorgang nennt. Der Auslöser nennt
   * sie nicht immer: „der Bedarfsträger zusagt und der MSP-Disponent den Status
   * »accepted« setzen will" nennt keinen Profilvorschlag. Dann steht sie hier,
   * aus dem Satz, der den Status trägt.
   */
  readonly vorgangsart: Objektart | null
  /** Lieferantenstatus nach 4.6, je Firmenname. */
  readonly lieferantenstatus: ReadonlyMap<string, string>
  /** Lieferantennamen in der Reihenfolge ihres Auftretens (ohne Entleiher). */
  readonly lieferanten: readonly string[]
  /** Entleiher (3.1) — dieselbe Schreibweise, anderes Objekt. */
  readonly entleiher: readonly string[]
  /** Der Lieferant, den das Szenario selbst nennt (nicht die Grundlage). */
  readonly lieferantImSzenario: string | null
  /** Eingeladene Lieferanten einer Ausschreibung (3.5). */
  readonly eingeladen: readonly string[]
  /** Standorte, deren Unterweisungspflicht genannt ist (3.1). */
  readonly standorte: ReadonlyMap<string, boolean>
  /** Der zuletzt genannte Standort — das Bezugsobjekt der Unterweisung. */
  readonly standortImSzenario: string | null
  /** Der durch eine Prüfung gesperrte Übergang (5.5.4, Invariante 1). */
  readonly gesperrterVorgang: Gesperrter | null
  readonly uebersteuerung: Uebersteuerungslage
  /** Alle Sätze in Reihenfolge, Auslöser zuletzt — für prüfungseigene Leser. */
  readonly saetze: readonly { satz: string; art: string; ausSzenario: boolean }[]
}

export const DATUM = String.raw`(\d{2}\.\d{2}\.\d{4})`
const FIRMA = /\b(?:GmbH|AG|KG|mbH|SE|UG|OHG|GbR)\b/
const ZITAT_ALLE = /"([^"]+)"/g
const STANDORT = /Standort(?:s|es)?\s+"([^"]+)"|"(Werk [^"]+)"/g

/** Objektarten, die einen Vorgang mit Status bezeichnen (SPEC Kapitel 4). */
const VORGANGSWORT =
  /Bedarfsanfrage|Ausschreibung|Einladung|Profilvorschlag|Einsatz|Einsätze|Verlängerung|Stundenzettel|Beleg/

/** Liest die Teile des Vorgangs, die jede Prüfung braucht. */
export function leseVorgangslage(
  sachverhalte: readonly Sachverhalt[],
  ausloeser: Ausloeser,
): Vorgangslage {
  const zeit: Zeitangaben = {
    zeitraum: null,
    geplant: null,
    leistung: null,
    periode: null,
    zettel: null,
    angebotsfrist: null,
    uebergangstag: null,
    tatsaechlicherBeginn: null,
    bisherigesEnde: null,
    neuesEnde: null,
    unterbrechungen: [],
  }
  const lieferantenstatus = new Map<string, string>()
  const standorte = new Map<string, boolean>()
  const lieferanten: string[] = []
  const entleiher: string[] = []
  const saetze: { satz: string; art: string; ausSzenario: boolean }[] = []

  let vorgangsstatus: string | null = null
  let vorgangsart: Objektart | null = null
  let eingeladen: readonly string[] = []
  let gesperrterVorgang: Gesperrter | null = null
  let lieferantImSzenario: string | null = null
  let standortImSzenario: string | null = null
  let nachGrundlage = false

  const alle: { satz: string; art: string }[] = [
    ...sachverhalte.map((sachverhalt) => ({ satz: sachverhalt.satz, art: sachverhalt.art })),
    { satz: ausloeser.satz, art: 'ausloeser' },
  ]

  for (const { satz, art } of alle) {
    // Die Grundlage (Background) endet mit ihren Rahmenaussagen. Danach stehen
    // die Sätze des Szenarios, und nur sie bestimmen den Prüfgegenstand.
    if (art === 'rahmenaussage') {
      nachGrundlage = true
      continue
    }
    const ausSzenario = nachGrundlage || art === 'ausloeser'
    saetze.push({ satz, art, ausSzenario })

    // Ein Entleiher trägt dieselbe Firmenbezeichnung wie ein Lieferant und ist
    // ein anderes Objekt (3.1 gegen 3.2). Wer ihn mitzählt, prüft am Ende die
    // Erlaubnis des Kunden.
    const istEntleihersatz = /\bEntleiher\b|\bbeim Kunden\b|\bdesselben Kunden\b/.test(satz)
    for (const name of firmennamen(satz)) {
      if (istEntleihersatz) {
        if (!entleiher.includes(name)) entleiher.push(name)
        continue
      }
      if (!lieferanten.includes(name)) lieferanten.push(name)
      if (ausSzenario) lieferantImSzenario = name
    }
    const genannteStandorte = standortnamen(satz)
    const verlangt = unterweisungVerlangt(satz)
    for (const name of genannteStandorte) {
      if (ausSzenario || standortImSzenario === null) standortImSzenario = name
      // Nur eintragen, was der Vorgang wirklich sagt. Ein Standort, über dessen
      // Unterweisungspflicht nichts gesagt ist, bleibt **ungesetzt** — und
      // ungesetzt wird nach 5.4.6 wie „ja" gerechnet. Ihn hier mit „nein"
      // vorzubelegen wäre die mildere Annahme und würde eine Sperre umgehen.
      if (verlangt !== null) standorte.set(name, verlangt)
    }
    // „Am Standort wird eine Unterweisung verlangt" und „der Entleiher stellt
    // ein, dass eine Unterweisung verlangt wird" nennen den Standort nicht
    // beim Namen. Sie gelten dem Standort, um den es gerade geht (3.1).
    if (genannteStandorte.length === 0 && verlangt !== null && standortImSzenario !== null) {
      standorte.set(standortImSzenario, verlangt)
    }

    const status = leseLieferantenstatus(satz)
    if (status !== null) lieferantenstatus.set(status.name, status.status)

    const gelesen = leseVorgangsstatus(satz)
    if (gelesen !== null) {
      vorgangsstatus = gelesen
      vorgangsart = objektartAusSatz(satz) ?? vorgangsart
    }

    leseZeitangaben(satz, zeit)

    const geladen = leseEinladungen(satz)
    if (geladen !== null) eingeladen = geladen

    const gesperrt = leseGesperrtenVorgang(satz)
    if (gesperrt !== null) gesperrterVorgang = gesperrt
  }

  const anlass = anlassVon(ausloeser)
  return {
    anlass,
    stichtag: istTag(ausloeser.stichtag) ? ausloeser.stichtag : null,
    zeit,
    vorgangsstatus,
    vorgangsart,
    lieferantenstatus,
    lieferanten,
    entleiher,
    lieferantImSzenario,
    eingeladen,
    standorte,
    standortImSzenario,
    gesperrterVorgang,
    uebersteuerung: leseUebersteuerung(
      alle.map((eintrag) => eintrag.satz),
      anlass === 'uebersteuerung' || anlass === 'uebersteuerungsversuch',
    ),
    saetze,
  }
}

export function anlassVon(ausloeser: Ausloeser): Anlass {
  switch (ausloeser.art) {
    case 'nachtlauf':
      return 'nachtlauf'
    case 'uebersteuerung':
      return 'uebersteuerung'
    case 'uebersteuerungsversuch':
      return 'uebersteuerungsversuch'
    case 'berichtigung':
      return 'berichtigung'
    case 'erfassung':
      return 'erfassung'
    case 'statusuebergang':
      return 'uebergang'
    case 'statusuebergangsversuch':
      return 'uebergangsversuch'
    default:
      return 'berechnung'
  }
}

/** Die Objektart, die ein Satz benennt (SPEC Kapitel 3 und 4). */
export function objektartAusSatz(satz: string): Objektart | null {
  const zuordnung: ReadonlyArray<readonly [RegExp, Objektart]> = [
    [/Bedarfsanfrage/, 'bedarfsanfrage'],
    [/Einladung/, 'einladung'],
    [/Profilvorschlag/, 'profilvorschlag'],
    [/Verlängerung/, 'verlaengerung'],
    [/Stundenzettel/, 'stundenzettel'],
    [/\bBeleg\b/, 'beleg'],
    [/\bEinsatz\b|\bEinsätze\b/, 'einsatz'],
    [/\bLieferant\b|\bLieferanten\b/, 'lieferant'],
    [/\bNachweis\b/, 'nachweis'],
  ]
  return zuordnung.find(([muster]) => muster.test(satz))?.[1] ?? null
}

export function alsObjektart(wert: string): Objektart {
  const bekannt: readonly Objektart[] = [
    'bedarfsanfrage',
    'einladung',
    'profilvorschlag',
    'einsatz',
    'verlaengerung',
    'stundenzettel',
    'beleg',
    'lieferant',
    'nachweis',
  ]
  return bekannt.find((art) => art === wert) ?? 'unbekannt'
}

export function firmennamen(satz: string): string[] {
  const namen: string[] = []
  for (const treffer of satz.matchAll(ZITAT_ALLE)) {
    const wert = treffer[1]
    if (wert !== undefined && FIRMA.test(wert)) namen.push(wert)
  }
  return namen
}

function standortnamen(satz: string): string[] {
  const namen: string[] = []
  for (const treffer of satz.matchAll(STANDORT)) {
    const wert = treffer[1] ?? treffer[2]
    if (wert !== undefined && !namen.includes(wert)) namen.push(wert)
  }
  return namen
}

/**
 * `site.safetyBriefingRequired` (3.1): `true`, `false` oder `null`, wenn der
 * Vorgang die Angabe ausdrücklich **nicht** führt. Der Unterschied zählt:
 * fehlt sie, wird nach 5.4.6 wie „ja" gerechnet.
 */
function unterweisungVerlangt(satz: string): boolean | null {
  if (!/Unterweisung/.test(satz)) return null
  if (/nicht erfasst, ob eine Unterweisung/.test(satz)) return null
  if (/keine Unterweisung verlangt|war keine Unterweisung/.test(satz)) return false
  if (/Unterweisung verlangt wird|eine Unterweisung verlangt|verlangt eine Unterweisung/.test(satz)) {
    return true
  }
  return null
}

/**
 * Der Lieferantenstatus nach 4.6. Erkannt wird nur, wo der **Lieferant** das
 * Subjekt des Satzes ist: „Ein Einsatz über »X« steht im Status »active«" sagt
 * etwas über den Einsatz, nicht über X.
 */
function leseLieferantenstatus(satz: string): { name: string; status: string } | null {
  const treffer =
    /^(?:der |die )?(?:Lieferant|Lieferanten)\s+"([^"]+)" steht (?:im|auf) Status "([^"]+)"/.exec(
      satz,
    ) ?? /^"([^"]+)" steht (?:im|auf) Status "([^"]+)"/.exec(satz)
  const name = treffer?.[1]
  const status = treffer?.[2]
  if (name === undefined || status === undefined || !FIRMA.test(name)) {
    const gesperrt = /^"([^"]+)" wurde von (?:einem|dem) MSP-Administrator gesperrt/.exec(satz)
    const gesperrterName = gesperrt?.[1]
    if (gesperrterName !== undefined && FIRMA.test(gesperrterName)) {
      // 4.6: `blocked` wird mit Pflichtbegründung gesetzt.
      return { name: gesperrterName, status: 'blocked' }
    }
    return null
  }
  return { name, status }
}

/** Der Status des Vorgangs, um den es geht (SPEC Kapitel 4). */
function leseVorgangsstatus(satz: string): string | null {
  if (!VORGANGSWORT.test(satz)) return null
  let gefunden: string | null = null
  for (const treffer of satz.matchAll(/steht (?:im|auf) Status "([^"]+)"/g)) {
    if (treffer[1] !== undefined) gefunden = treffer[1]
  }
  return gefunden
}

function leseEinladungen(satz: string): readonly string[] | null {
  if (!/lädt\b.*\bein\b/.test(satz)) return null
  const namen = firmennamen(satz)
  return namen.length > 0 ? namen : null
}

/**
 * Welcher Übergang ist durch eine Prüfung gesperrt? Die Wendungen, mit denen
 * die Vorgänge einen Sperrvorzustand benennen (SPEC 5.5.4, Invariante 1: eine
 * Übersteuerung gilt für genau einen Übergang eines benannten Objekts).
 *
 * `vonStatus` ist der Zustand, in dem der Vorgang **bleibt**, solange die
 * Sperre besteht (4.0, Regel 5). Er ist hier die Abschrift der Statusmodelle
 * aus Kapitel 4 — nicht aus 4.7, die diese Übergänge als „→ accepted" und
 * „→ planned" ohne Ausgangszustand führt. Nennt Kapitel 4 mehrere
 * Ausgangszustände (4.2.3: `releasedToCustomer`, `interviewScheduled` →
 * `accepted`), steht hier der **erste** — der Regelweg; der zweite ist der
 * Umweg über das Vorstellungsgespräch. Wo Kapitel 4 keinen eindeutigen nennt,
 * bleibt der Wert `null` und wird nicht geraten (5.0, Nummer 4).
 */
function leseGesperrtenVorgang(satz: string): Gesperrter | null {
  if (!/durch die Prüfung P\d{1,2} gesperrt/.test(satz)) return null
  if (/Einladung/.test(satz)) {
    return { objektart: 'einladung', nachStatus: 'invited', vonStatus: null }
  }
  if (/Zusage zum Profilvorschlag/.test(satz)) {
    return { objektart: 'profilvorschlag', nachStatus: 'accepted', vonStatus: 'releasedToCustomer' }
  }
  if (/Anlegen des Einsatzes/.test(satz)) {
    return { objektart: 'einsatz', nachStatus: 'planned', vonStatus: null }
  }
  if (/Einsatzstart/.test(satz)) {
    return { objektart: 'einsatz', nachStatus: 'active', vonStatus: 'planned' }
  }
  if (/Wiederaufnahme/.test(satz)) {
    return { objektart: 'einsatz', nachStatus: 'active', vonStatus: 'interrupted' }
  }
  // Q36: „die Genehmigung des Stundenzettels »SZ-2026-10-001« ist durch die
  // Prüfung P4 gesperrt". Der Zettel bleibt in `inApproval` (4.0, Regel 5).
  if (/Genehmigung des Stundenzettels/.test(satz)) {
    return { objektart: 'stundenzettel', nachStatus: 'approved', vonStatus: 'inApproval' }
  }
  if (/Wirksamkeit der Verlängerung/.test(satz)) {
    return { objektart: 'verlaengerung', nachStatus: 'effective', vonStatus: 'approved' }
  }
  if (/Freischalten/.test(satz)) {
    return { objektart: 'lieferant', nachStatus: 'active', vonStatus: 'onboarding' }
  }
  return null
}

function leseUebersteuerung(
  saetze: readonly string[],
  beantragt: boolean,
): Uebersteuerungslage {
  const text = saetze.join(' | ')
  // (c) ist die entscheidende Bedingung: fehlt sie, ist die Sperre nicht
  // übersteuerbar (5.5.4). Eine Tatsache, die sie widerlegt, wiegt schwerer als
  // eine Behauptung, die sie stützt.
  const widerlegt =
    /besteht tatsächlich (?:nicht|keine)|tatsächlich keine Erlaubnis|hat tatsächlich nicht stattgefunden/.test(
      text,
    )
  const gestuetzt = /nach richtiger Datenlage wäre .*zulässig/.test(text)
  return {
    beantragt,
    angabeUnrichtig: /nachweislich|nicht eingestellt|nicht erfasst|nicht vollzogen/.test(text),
    berichtigungNichtMoeglich: /nicht möglich/.test(text),
    datenlageZulaessig: gestuetzt && !widerlegt,
  }
}

function leseZeitangaben(satz: string, zeit: Zeitangaben): void {
  if (/unterbroch/.test(satz)) {
    const pause = neuerZeitraum(satz, new RegExp(`vom ${DATUM} bis (?:zum )?${DATUM}`))
    if (pause !== null) {
      zeit.unterbrechungen.push(pause)
      return
    }
  }

  const ausdruecklich = neuerZeitraum(
    satz,
    new RegExp(`Zeitraum (?:vom|von) ${DATUM} bis (?:zum )?${DATUM}`),
  )
  if (ausdruecklich !== null) zeit.zeitraum = ausdruecklich

  const leistung =
    neuerZeitraum(satz, new RegExp(`Leistungszeitraum ist der ${DATUM} bis (?:zum )?${DATUM}`)) ??
    neuerZeitraum(satz, new RegExp(`Leistungen vom ${DATUM} bis (?:zum )?${DATUM}`))
  if (leistung !== null) zeit.leistung = leistung

  // „Sein Zeitraum ist der 01.09.2027 bis 30.09.2027" am Stundenzettel (3.8).
  const zettel = neuerZeitraum(
    satz,
    new RegExp(`(?:sein|ihr) Zeitraum ist der ${DATUM} bis (?:zum )?${DATUM}`),
  )
  if (zettel !== null) zeit.zettel = zettel

  // „Der Einkaufsbeleg zur Periode Juli 2026" nennt die Abrechnungsperiode
  // (3.9) statt der Tage. Sie ist ein Kalendermonat; 5.0 verlangt für Q38 den
  // Zeitraum vom frühesten `periodFrom` bis zum spätesten `periodTo`.
  const periode = /Periode (\p{Lu}\p{Ll}+) (\d{4})\b/u.exec(satz)
  if (periode?.[1] !== undefined && periode[2] !== undefined) {
    const monat = monatszeitraum(periode[1], periode[2])
    if (monat !== null) zeit.periode = monat
  }

  if (/\bEinsatz\b|\bEinsätze\b/.test(satz) && !/Erlaubnissatz|Nachfolgesatz/.test(satz)) {
    const geplant = neuerZeitraum(satz, new RegExp(`vom ${DATUM} bis (?:zum )?${DATUM}`))
    if (geplant !== null) zeit.geplant = geplant
    const laufzeit = einTag(satz, new RegExp(`läuft bis zum ${DATUM}`))
    if (laufzeit !== null) zeit.bisherigesEnde = laufzeit
  }

  const frist = einTag(satz, new RegExp(`Angebotsfrist (?:endet am )?${DATUM}`))
  if (frist !== null) zeit.angebotsfrist = frist

  const uebergang = einTag(satz, new RegExp(`Übergang wird am ${DATUM} ausgelöst`))
  if (uebergang !== null) zeit.uebergangstag = uebergang

  const beginn = einTag(satz, new RegExp(`tatsächlichem Beginn ${DATUM}`))
  if (beginn !== null) zeit.tatsaechlicherBeginn = beginn

  const neues = einTag(satz, new RegExp(`neuem Ende ${DATUM}`))
  if (neues !== null) zeit.neuesEnde = neues
}

const MONATE: readonly string[] = [
  'Januar',
  'Februar',
  'März',
  'April',
  'Mai',
  'Juni',
  'Juli',
  'August',
  'September',
  'Oktober',
  'November',
  'Dezember',
]

/** Ein Kalendermonat als Zeitraum, beide Randtage eingeschlossen (SPEC 5.0). */
function monatszeitraum(monatsname: string, jahr: string): Zeitraum | null {
  const index = MONATE.indexOf(monatsname)
  if (index < 0) return null
  const zweistellig = (zahl: number): string => String(zahl).padStart(2, '0')
  const von = `${jahr}-${zweistellig(index + 1)}-01`
  const folgemonat =
    index === 11 ? `${Number(jahr) + 1}-01-01` : `${jahr}-${zweistellig(index + 2)}-01`
  return { von, bis: tagVersetzt(folgemonat, -1) }
}

export function neuerZeitraum(text: string, muster: RegExp): Zeitraum | null {
  const treffer = muster.exec(text)
  const von = treffer?.[1]
  const bis = treffer?.[2]
  if (von === undefined || bis === undefined) return null
  return { von: alsTag(von), bis: alsTag(bis) }
}

export function einTag(text: string, muster: RegExp): Tag | null {
  const treffer = muster.exec(text)?.[1]
  return treffer === undefined ? null : alsTag(treffer)
}

/** `TT.MM.JJJJ` zu `JJJJ-MM-TT`. Die Szenarien schreiben deutsche Datumsangaben. */
export function alsTag(deutsch: string): Tag {
  const [monatstag, monat, jahr] = deutsch.split('.')
  return `${jahr}-${monat}-${monatstag}`
}

/* ------------------------------------------------------------------ */
/* Firmen und Personen in einem Satz — die Rollen auseinanderhalten    */
/* ------------------------------------------------------------------ */

const PERSONENNAME = /"((?:\p{Lu}\p{Ll}+)(?: \p{Lu}\p{Ll}+)+)"/u

/** Ein zitierter Personenname, der keine Firmenbezeichnung trägt (SPEC 3.6). */
export function personAusSatz(satz: string): string | null {
  const treffer = PERSONENNAME.exec(satz)?.[1]
  if (treffer === undefined || FIRMA.test(treffer)) return null
  return treffer
}

/**
 * Der Entleiher (3.1). „bei X", „beim Kunden X" und „für X ist/gilt" nennen
 * ihn — **außer** der Satz handelt von einem Kandidatensatz, denn der gehört
 * zum Verleiher: „als Kandidat »Jana Behrens« bei »Elbe Zeitarbeit GmbH«
 * geführt" nennt keinen Kunden. Beide tragen eine Firmenbezeichnung und sind
 * verschiedene Objekte; wer sie verwechselt, prüft am Ende das falsche.
 */
export function kundeAusSatz(satz: string): string | null {
  const kandidatensatz = /Kandidat(?:en|ensatz|ensätze)?\s+"[^"]+"\s+bei\s+"([^"]+)"/.exec(satz)
  const verleiher = kandidatensatz?.[1] ?? null

  const kandidaten: string[] = []
  for (const muster of [
    /\bEntleiher\s+"([^"]+)"/g,
    /\bbeim Kunden\s+"([^"]+)"/g,
    /\bbei\s+"([^"]+)"/g,
    /\bfür\s+(?:den Kunden\s+)?"([^"]+)"\s+(?:ist|gilt)/g,
  ]) {
    for (const treffer of satz.matchAll(muster)) {
      const name = treffer[1]
      if (name !== undefined && FIRMA.test(name) && name !== verleiher) kandidaten.push(name)
    }
  }
  // „für den Standort" und „für den Lieferanten" nennen keinen Kunden.
  if (/für den (?:Standort|Lieferanten)/.test(satz) && kandidaten.length === 0) return null
  return kandidaten[0] ?? null
}

/** Der Verleiher (3.2): „über X", „Lieferant X", „Kandidat »…« bei X". */
export function lieferantAusSatz(satz: string): string | null {
  // Kein `\b` vor „über": in JavaScript zählt „ü" nicht als Wortzeichen, die
  // Stelle zwischen Leerzeichen und „ü" ist deshalb **keine** Wortgrenze — das
  // Muster würde nie treffen.
  const treffer =
    /(?:^|\s)über\s+"([^"]+)"/.exec(satz) ??
    /Kandidat(?:en|ensatz)?\s+"[^"]+"\s+bei\s+"([^"]+)"/.exec(satz) ??
    /Lieferant(?:en)?\s+"([^"]+)"/.exec(satz) ??
    /zwischen Betreiber und "([^"]+)"/.exec(satz)
  const name = treffer?.[1]
  return name !== undefined && FIRMA.test(name) ? name : null
}

export function letztes(werte: readonly string[]): string | null {
  return werte.length === 0 ? null : (werte[werte.length - 1] ?? null)
}
