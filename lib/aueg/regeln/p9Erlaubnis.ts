/**
 * P9 — AÜG-Erlaubnis des Lieferanten (`permitValidityCheck`), SPEC 5.4.1.
 *
 * **Die Regel in Worten.** Wer Arbeitnehmer zur Arbeitsleistung überlassen
 * will, bedarf der Erlaubnis (§ 1 Abs. 1 AÜG). Sie wird zunächst befristet auf
 * ein Jahr erteilt und kann nach dreijähriger ununterbrochener Erteilung
 * unbefristet erteilt werden (§ 2 Abs. 4, 5 AÜG). Überlassung ohne Erlaubnis
 * führt nach § 9 Abs. 1 Nr. 1, § 10 Abs. 1 AÜG zur Unwirksamkeit des
 * Arbeitsvertrags und zu einem Arbeitsverhältnis beim Entleiher.
 *
 * **Der Rechenweg** (5.4.1, Schritte 1 bis 6):
 *
 *  1. Prüfzeitraum bilden. P9 prüft nie einen einzelnen Tag, außer wo 5.0 einen
 *     Stichtag nennt.
 *  2. Ein Tag ist gedeckt, wenn **mindestens ein** Erlaubnissatz existiert mit
 *     `verificationStatus = accepted`, `validFrom` ≤ Tag, `validTo` ≥ Tag oder
 *     `permitType = unlimited` mit leerem `validTo`, und gesetztem
 *     `documentRef`.
 *  3. **Lücken sind Treffer.** Ein einziger nicht gedeckter Tag genügt.
 *  4. `submitted` und `rejected` decken keinen Tag — die Anerkennung ist die
 *     Handlung, mit der der Betreiber die Prüfung übernimmt.
 *  5. Die Ergebnisart je Übergang steht in 4.7 (hier: `querschnitt.ts`).
 *  6. Ein `validTo` an einem Satz mit `unlimited` ist ein Datenfehler und wirkt
 *     wie ein befristeter Satz — es wird mit dem strengeren Wert gerechnet.
 *
 * Dazu die Grenzfälle aus 5.4.5 und das Verhalten bei fehlenden Daten aus
 * 5.4.6, und der Grundsatz aus 5.0: **eine fehlende Rechengrundlage wirkt wie
 * ein Treffer, nicht wie ein Freibrief.**
 *
 * Was P9 **nicht** tut: gegen ein Register prüfen. Geprüft wird der vom
 * Lieferanten eingestellte, vom Betreiber anerkannte Nachweis (5.0, „Was dieses
 * Kapitel nicht tut"; offene Frage 7).
 *
 * Dieses Modul ist **rein**: es liest eine Lage und gibt ein Ergebnis zurück.
 * Es kennt keinen Statusübergang, keinen Sachverhaltssatz und keine
 * Datenbank — die Ergebnisart wählt `pruefwerk.ts` anhand von 4.7.
 */

import {
  istVorOderGleich,
  liegtImZeitraum,
  tageDesZeitraums,
  tagesdifferenz,
  type Tag,
} from '../kalender'
import { REGELWERK, type Regelwerkkonfiguration } from '../regelwerk'
import type { Rollenkuerzel } from '../typen'

/** `supplierPermit.permitType` (SPEC 3.2, E22). */
export type Erlaubnisart = 'fixedTerm' | 'unlimited'

/** `supplierPermit.verificationStatus` (SPEC 3.2, E24; Nachweisfluss 5.4.3). */
export type Anerkennung = 'submitted' | 'accepted' | 'rejected'

/** Ein Erlaubnissatz, wie P9 ihn braucht (SPEC 3.2, Eingangsdaten E21–E25). */
export interface Erlaubnissatz {
  /** Aktenzeichen oder Kennung des Satzes, für die Meldung. */
  readonly id: string
  readonly art: Erlaubnisart
  /** `validFrom`; Pflicht nach 3.2. */
  readonly gueltigVon: Tag | null
  /** `validTo`; Pflicht bei `fixedTerm`, leer bei `unlimited` (3.2). */
  readonly gueltigBis: Tag | null
  readonly anerkennung: Anerkennung
  /** `documentRef` gesetzt — Pflicht nach 3.2 (E25). */
  readonly urkunde: boolean
  /** `fileRef` am Dokument gesetzt — Pflicht nach 3.10 (5.4.5). */
  readonly datei: boolean
  /** `supersedesRef`; heilt eine Lücke **nicht** (5.4.5). */
  readonly vorgaenger: string | null
}

export interface Zeitraum {
  readonly von: Tag
  readonly bis: Tag
}

export interface Erlaubnislage {
  /** Firmenname des Lieferanten, für die Meldung. */
  readonly lieferant: string
  readonly saetze: readonly Erlaubnissatz[]
  /**
   * Der Prüfzeitraum aus 5.0. `null` heißt: aus dem Vorgang nicht bestimmbar —
   * eine fehlende Rechengrundlage, die wie ein Treffer wirkt (5.0).
   */
  readonly zeitraum: Zeitraum | null
  /**
   * Dokumentierte Unterbrechungen. Ihre Tage fallen aus dem Prüfzeitraum, weil
   * an ihnen keine Überlassung stattfindet (5.4.5).
   */
  readonly unterbrechungen: readonly Zeitraum[]
}

/** Warum ein Satz oder ein Zeitraum nicht deckt. */
export type Mangel =
  /** Kein Erlaubnissatz erfasst (5.4.6, Zeile 1). */
  | 'keinErlaubnissatz'
  /** `verificationStatus = submitted` (5.4.6, Zeile 2). */
  | 'anerkennungAussteht'
  /** `verificationStatus = rejected` (5.4.3: Endzustand, deckt nichts). */
  | 'anerkennungZurueckgewiesen'
  /** `validTo` fehlt bei `fixedTerm` — Datenfehler (5.4.6, Zeile 3). */
  | 'enddatumFehlt'
  /** `validFrom` fehlt — Pflicht nach 3.2. */
  | 'beginnFehlt'
  /** `documentRef` fehlt am Erlaubnissatz — Datenfehler (5.4.6, Zeile 4). */
  | 'urkundeFehlt'
  /** `fileRef` fehlt am Dokument — Datenfehler (5.4.5). */
  | 'dateiFehlt'
  /** `validTo` an einem Satz mit `unlimited` — Datenfehler (5.4.1, Schritt 6). */
  | 'enddatumBeiUnbefristet'
  /** Lücke zwischen zwei Erlaubnissätzen (5.4.5). */
  | 'luecke'
  /** Der Prüfzeitraum reicht über das Ende der Erlaubnis hinaus. */
  | 'abgelaufen'
  /** Der Prüfzeitraum beginnt vor dem Beginn der Erlaubnis. */
  | 'nochNichtGueltig'
  /** Der Prüfzeitraum ließ sich aus dem Vorgang nicht bilden (5.0). */
  | 'zeitraumNichtBestimmbar'

/** Feldname aus Kapitel 3, dessen Fehlen den Mangel ausmacht (5.0 Nr. 2). */
const FELD_JE_MANGEL: Readonly<Partial<Record<Mangel, string>>> = {
  enddatumFehlt: 'validTo',
  beginnFehlt: 'validFrom',
  urkundeFehlt: 'documentRef',
  dateiFehlt: 'fileRef',
  enddatumBeiUnbefristet: 'validTo',
}

export interface Satzbefund {
  readonly satz: Erlaubnissatz
  /** Kann der Satz überhaupt einen Tag decken (5.4.1, Schritt 2)? */
  readonly deckungsfaehig: boolean
  /** Letzter gedeckter Tag; `null` bei unbefristeter Deckung. */
  readonly deckelBis: Tag | null
  readonly maengel: readonly Mangel[]
}

export interface Erlaubnisergebnis {
  readonly lieferant: string
  readonly gedeckt: boolean
  readonly zeitraum: Zeitraum | null
  readonly tageGesamt: number
  readonly tageGedeckt: number
  readonly ungedeckteTage: readonly Tag[]
  readonly ersterUngedeckterTag: Tag | null
  /** Der führende Mangel, der den Treffer erklärt; `null`, wenn gedeckt. */
  readonly mangel: Mangel | null
  /**
   * Wurde die Deckung überhaupt an Tagen geprüft? `false`, wenn der Vorgang
   * keinen Prüfzeitraum hergab — dann sind nur Anerkennung, Urkunde und
   * Datenstand geprüft (siehe `pruefeErlaubnis`).
   */
  readonly deckungGeprueft: boolean
  /** Alle festgestellten Mängel, damit jede Feststellung einzeln steht (5.5.2). */
  readonly maengel: readonly Mangel[]
  readonly satzbefunde: readonly Satzbefund[]
  /** Fehlende Felder mit Objektbezug, für die Meldung (5.0 Nr. 2). */
  readonly fehlendeFelder: readonly string[]
  /** Zuständige Rollen (5.0 Nr. 3, 5.4.6). */
  readonly adressaten: readonly Rollenkuerzel[]
  readonly meldung: string
}

/**
 * Prüft die Deckung eines Zeitraums durch die Erlaubnissätze eines
 * Lieferanten — der Rechenweg aus 5.4.1.
 */
export function pruefeErlaubnis(
  lage: Erlaubnislage,
  konfiguration: Regelwerkkonfiguration = REGELWERK,
): Erlaubnisergebnis {
  const satzbefunde = lage.saetze.map(bewerteSatz)
  const deckende = satzbefunde.filter((befund) => befund.deckungsfaehig)
  const satzmaengel = eindeutig(satzbefunde.flatMap((befund) => befund.maengel))

  // Schritt 2 vorgezogen: ohne deckungsfähigen Satz entscheidet der Satzmangel,
  // nicht der Zeitraum. Das ist der Unterschied zwischen „Anerkennung steht
  // aus" und „Nachweis fehlt", auf den 5.4.6 ausdrücklich Wert legt.
  if (deckende.length === 0) {
    const mangel = fuehrenderSatzmangel(satzbefunde)
    return ergebnis({
      lage,
      gedeckt: false,
      tageGesamt: 0,
      tageGedeckt: 0,
      ungedeckteTage: lage.zeitraum === null ? [] : pruefbareTage(lage),
      mangel,
      maengel: satzmaengel.length > 0 ? satzmaengel : [mangel],
      satzbefunde,
      konfiguration,
    })
  }

  // Schritt 1: ohne Prüfzeitraum gibt es keinen Tag, gegen den die Deckung
  // scheitern könnte.
  //
  // Das ist **kein** Fall des Grundsatzes aus 5.0 („eine fehlende
  // Rechengrundlage wirkt wie ein Treffer"). Dieser Grundsatz gilt den
  // Eingangsdaten der Regel — dem Erlaubnissatz, seiner Anerkennung, seiner
  // Urkunde —, und die sind hier vollständig: ein deckungsfähiger Satz liegt
  // vor. Was fehlt, ist der **Stichtag des Vorgangs**, und den führt 5.4.6
  // nicht unter den fehlenden Daten. Im Betrieb trägt jeder Übergang seinen Tag
  // (5.0, Tabelle „Stichtag und Prüfzeitraum"); nennt ein Vorgang ihn nicht,
  // sind Anerkennung und Datenstand geprüft und die Gültigkeit nicht — so wie
  // P10 es für den Nachweis hält (5.4.3: ohne Tag gibt es keinen Tag, für den
  // ein Nachweis unbrauchbar wäre). Der Befund führt das als
  // `deckungGeprueft = false` mit.
  if (lage.zeitraum === null) {
    return ergebnis({
      lage,
      gedeckt: true,
      deckungGeprueft: false,
      tageGesamt: 0,
      tageGedeckt: 0,
      ungedeckteTage: [],
      mangel: null,
      maengel: satzmaengel,
      satzbefunde,
      konfiguration,
    })
  }

  // Schritte 2 und 3: Deckung tagesgenau, ein ungedeckter Tag ist ein Treffer.
  const tage = pruefbareTage(lage)
  const ungedeckteTage = tage.filter((prueftag) => !deckt(deckende, prueftag))
  const gedeckt = ungedeckteTage.length === 0

  return ergebnis({
    lage,
    gedeckt,
    tageGesamt: tage.length,
    tageGedeckt: tage.length - ungedeckteTage.length,
    ungedeckteTage,
    mangel: gedeckt ? null : lueckenart(deckende, ungedeckteTage[0] as Tag),
    maengel: gedeckt
      ? satzmaengel
      : eindeutig([...satzmaengel, lueckenart(deckende, ungedeckteTage[0] as Tag)]),
    satzbefunde,
    konfiguration,
  })
}

/** Stufe der Ablaufbehandlung im nächtlichen Lauf (SPEC 5.4.4, 5.5.1 N1). */
export type Vorlaufstufe = 'keine' | 'information' | 'warnung' | 'eskalation' | 'abgelaufen'

export interface Vorlaufergebnis {
  readonly lieferant: string
  readonly stufe: Vorlaufstufe
  /** Tage bis `validTo` einschließlich; negativ, wenn verstrichen. */
  readonly restzeitTage: number | null
  /** Das maßgebliche Ende; `null` bei unbefristeter Deckung. */
  readonly endeBis: Tag | null
  readonly adressaten: readonly Rollenkuerzel[]
  readonly meldung: string
}

/**
 * Die gestufte Ablaufbehandlung vor dem Ende der Erlaubnis (SPEC 5.4.4,
 * Abschnitt „Fristen vor Ablauf"; nächtlicher Lauf N1 in 5.5.1).
 *
 * Maßgeblich ist das **späteste** Ende der deckungsfähigen Sätze: ein
 * anerkannter Nachfolgesatz verschiebt den Ablauf nach hinten. Deckt ein Satz
 * unbefristet, läuft nichts ab und es gibt keine Stufe.
 */
export function pruefeVorlauf(
  lage: Erlaubnislage,
  stichtag: Tag,
  konfiguration: Regelwerkkonfiguration = REGELWERK,
): Vorlaufergebnis {
  const stufen = konfiguration.stufenadressaten.permitCertificate
  const vorlauf = konfiguration.vorlauf.permitCertificate
  const deckende = lage.saetze.map(bewerteSatz).filter((befund) => befund.deckungsfaehig)

  if (deckende.length === 0) {
    return {
      lieferant: lage.lieferant,
      stufe: 'abgelaufen',
      restzeitTage: null,
      endeBis: null,
      adressaten: stufen.abgelaufen,
      meldung:
        `P9: ${lage.lieferant} hat am ${stichtag} keinen anerkannten Erlaubnissatz mit ` +
        'hinterlegter Urkunde (SPEC 5.4.1, Schritte 2 und 4).',
    }
  }

  if (deckende.some((befund) => befund.deckelBis === null)) {
    return {
      lieferant: lage.lieferant,
      stufe: 'keine',
      restzeitTage: null,
      endeBis: null,
      adressaten: [],
      meldung: `P9: ${lage.lieferant} hat eine unbefristete Erlaubnis; es läuft keine Frist ab (SPEC 5.4.1, Schritt 6).`,
    }
  }

  const endeBis = deckende.reduce<Tag>((spaetestes, befund) => {
    const ende = befund.deckelBis as Tag
    return istVorOderGleich(spaetestes, ende) ? ende : spaetestes
  }, deckende[0]?.deckelBis as Tag)

  const restzeitTage = tagesdifferenz(stichtag, endeBis)
  const stufe = stufeFuerRestzeit(restzeitTage, vorlauf)

  return {
    lieferant: lage.lieferant,
    stufe,
    restzeitTage,
    endeBis,
    adressaten: adressatenFuerStufe(stufe, stufen),
    meldung: meldungVorlauf(lage.lieferant, stufe, restzeitTage, endeBis),
  }
}

function stufeFuerRestzeit(
  restzeitTage: number,
  vorlauf: { information: number | null; warnung: number | null; eskalation: number | null },
): Vorlaufstufe {
  if (restzeitTage < 0) return 'abgelaufen'
  if (vorlauf.eskalation !== null && restzeitTage <= vorlauf.eskalation) return 'eskalation'
  if (vorlauf.warnung !== null && restzeitTage <= vorlauf.warnung) return 'warnung'
  if (vorlauf.information !== null && restzeitTage <= vorlauf.information) return 'information'
  return 'keine'
}

function adressatenFuerStufe(
  stufe: Vorlaufstufe,
  stufen: {
    information: readonly Rollenkuerzel[]
    warnung: readonly Rollenkuerzel[]
    eskalation: readonly Rollenkuerzel[]
    abgelaufen: readonly Rollenkuerzel[]
  },
): readonly Rollenkuerzel[] {
  switch (stufe) {
    case 'information':
      return stufen.information
    case 'warnung':
      return stufen.warnung
    case 'eskalation':
      return stufen.eskalation
    case 'abgelaufen':
      return stufen.abgelaufen
    case 'keine':
      return []
  }
}

function meldungVorlauf(
  lieferant: string,
  stufe: Vorlaufstufe,
  restzeitTage: number,
  endeBis: Tag,
): string {
  if (stufe === 'abgelaufen') {
    return (
      `P9: Die AÜG-Erlaubnis von ${lieferant} ist am ${endeBis} abgelaufen. ` +
      'Vorschlag: den Lieferanten sperren — der Übergang nach „blocked" bleibt einem ' +
      'Menschen mit Pflichtbegründung vorbehalten (SPEC 5.4.2 a).'
    )
  }
  if (stufe === 'keine') {
    return `P9: Die AÜG-Erlaubnis von ${lieferant} läuft am ${endeBis} ab; der Vorlauf ist noch nicht erreicht (SPEC 5.4.4).`
  }
  return `P9: Die AÜG-Erlaubnis von ${lieferant} läuft am ${endeBis} ab — ${restzeitTage} Tage Restzeit (SPEC 5.4.4).`
}

function bewerteSatz(satz: Erlaubnissatz): Satzbefund {
  const maengel: Mangel[] = []

  if (satz.anerkennung === 'submitted') maengel.push('anerkennungAussteht')
  if (satz.anerkennung === 'rejected') maengel.push('anerkennungZurueckgewiesen')
  if (!satz.urkunde) maengel.push('urkundeFehlt')
  if (satz.urkunde && !satz.datei) maengel.push('dateiFehlt')
  if (satz.gueltigVon === null) maengel.push('beginnFehlt')
  if (satz.art === 'fixedTerm' && satz.gueltigBis === null) maengel.push('enddatumFehlt')
  // Schritt 6: ein Enddatum an einem unbefristeten Satz ist ein Datenfehler.
  // Gerechnet wird mit dem strengeren Wert — der Satz wirkt wie ein
  // befristeter, deckt also nur bis zu diesem Tag.
  if (satz.art === 'unlimited' && satz.gueltigBis !== null) {
    maengel.push('enddatumBeiUnbefristet')
  }

  const deckungsfaehig =
    satz.anerkennung === 'accepted' &&
    satz.urkunde &&
    satz.datei &&
    satz.gueltigVon !== null &&
    !(satz.art === 'fixedTerm' && satz.gueltigBis === null)

  return {
    satz,
    deckungsfaehig,
    deckelBis: satz.gueltigBis,
    maengel,
  }
}

function deckt(deckende: readonly Satzbefund[], prueftag: Tag): boolean {
  return deckende.some((befund) => {
    const von = befund.satz.gueltigVon
    if (von === null || !istVorOderGleich(von, prueftag)) return false
    const bis = befund.deckelBis
    return bis === null || istVorOderGleich(prueftag, bis)
  })
}

/**
 * Die Tage, die wirklich geprüft werden: der Prüfzeitraum ohne die Tage einer
 * dokumentierten Unterbrechung (5.4.5: „Eine Unterbrechung verkürzt nur den
 * Prüfzeitraum um ihre Tage, weil an ihnen keine Überlassung stattfindet").
 */
function pruefbareTage(lage: Erlaubnislage): Tag[] {
  if (lage.zeitraum === null) return []
  const alle = tageDesZeitraums(lage.zeitraum.von, lage.zeitraum.bis)
  if (lage.unterbrechungen.length === 0) return alle
  return alle.filter(
    (prueftag) =>
      !lage.unterbrechungen.some((pause) =>
        liegtImZeitraum(prueftag, pause.von, pause.bis),
      ),
  )
}

/**
 * Welcher Mangel erklärt den ersten ungedeckten Tag? Eine Lücke zwischen zwei
 * Sätzen, ein Zeitraum nach dem Ende oder einer vor dem Beginn (5.4.5).
 */
function lueckenart(deckende: readonly Satzbefund[], ersterTag: Tag): Mangel {
  const endetVorher = deckende.some(
    (befund) => befund.deckelBis !== null && !istVorOderGleich(ersterTag, befund.deckelBis),
  )
  const beginntSpaeter = deckende.some(
    (befund) =>
      befund.satz.gueltigVon !== null && !istVorOderGleich(befund.satz.gueltigVon, ersterTag),
  )
  if (endetVorher && beginntSpaeter) return 'luecke'
  if (endetVorher) return 'abgelaufen'
  return 'nochNichtGueltig'
}

function fuehrenderSatzmangel(satzbefunde: readonly Satzbefund[]): Mangel {
  if (satzbefunde.length === 0) return 'keinErlaubnissatz'
  // Reihenfolge nach 5.4.6: der Datenfehler wiegt schwerer als die ausstehende
  // Anerkennung, weil er eine andere Rolle angeht.
  const rang: readonly Mangel[] = [
    'urkundeFehlt',
    'dateiFehlt',
    'enddatumFehlt',
    'beginnFehlt',
    'anerkennungZurueckgewiesen',
    'anerkennungAussteht',
  ]
  const alle = satzbefunde.flatMap((befund) => befund.maengel)
  return rang.find((mangel) => alle.includes(mangel)) ?? 'keinErlaubnissatz'
}

function adressatenFuerMangel(
  mangel: Mangel | null,
  konfiguration: Regelwerkkonfiguration,
): readonly Rollenkuerzel[] {
  switch (mangel) {
    case null:
      return []
    case 'urkundeFehlt':
    case 'dateiFehlt':
    case 'enddatumFehlt':
    case 'beginnFehlt':
    case 'enddatumBeiUnbefristet':
      return konfiguration.adressatenDatenfehlerErlaubnis
    case 'anerkennungAussteht':
      return konfiguration.adressatenAnerkennungAussteht
    default:
      return konfiguration.adressatenErlaubnisFehlt
  }
}

interface Ergebnisrohdaten {
  readonly lage: Erlaubnislage
  readonly gedeckt: boolean
  readonly deckungGeprueft?: boolean
  readonly tageGesamt: number
  readonly tageGedeckt: number
  readonly ungedeckteTage: readonly Tag[]
  readonly mangel: Mangel | null
  readonly maengel: readonly Mangel[]
  readonly satzbefunde: readonly Satzbefund[]
  readonly konfiguration: Regelwerkkonfiguration
}

function ergebnis(rohdaten: Ergebnisrohdaten): Erlaubnisergebnis {
  const { lage, mangel, maengel } = rohdaten
  const fehlendeFelder = eindeutig(
    maengel.map((einzeln) => FELD_JE_MANGEL[einzeln]).filter((feld): feld is string => feld !== undefined),
  )
  return {
    lieferant: lage.lieferant,
    gedeckt: rohdaten.gedeckt,
    zeitraum: lage.zeitraum,
    tageGesamt: rohdaten.tageGesamt,
    tageGedeckt: rohdaten.tageGedeckt,
    ungedeckteTage: rohdaten.ungedeckteTage,
    ersterUngedeckterTag: rohdaten.ungedeckteTage[0] ?? null,
    mangel,
    maengel,
    deckungGeprueft: rohdaten.deckungGeprueft ?? true,
    satzbefunde: rohdaten.satzbefunde,
    fehlendeFelder,
    adressaten: adressatenFuerMangel(mangel, rohdaten.konfiguration),
    meldung: meldung(lage, rohdaten, fehlendeFelder),
  }
}

function meldung(
  lage: Erlaubnislage,
  rohdaten: Ergebnisrohdaten,
  fehlendeFelder: readonly string[],
): string {
  if (rohdaten.gedeckt) {
    if (lage.zeitraum === null) {
      return (
        `P9: ${lage.lieferant} hat einen anerkannten Erlaubnissatz mit hinterlegter Urkunde. ` +
        'Der Vorgang nennt keinen Stichtag; die Gültigkeit an einem Tag ist damit nicht geprüft ' +
        '(SPEC 5.0, 5.4.3).'
      )
    }
    return (
      `P9: Die AÜG-Erlaubnis von ${lage.lieferant} deckt den Zeitraum ${lage.zeitraum.von} bis ` +
      `${lage.zeitraum.bis} an jedem Tag (SPEC 5.4.1).`
    )
  }

  const feldhinweis = fehlendeFelder.length > 0 ? ` Fehlendes Feld: ${fehlendeFelder.join(', ')}.` : ''
  const satzhinweis = benannterSatz(rohdaten.satzbefunde)

  switch (rohdaten.mangel) {
    case 'keinErlaubnissatz':
      return `P9: Für ${lage.lieferant} ist kein Erlaubnissatz (supplierPermit) erfasst (SPEC 5.4.6).`
    case 'anerkennungAussteht':
      return (
        `P9: Die Anerkennung des Erlaubnissatzes ${satzhinweis} von ${lage.lieferant} steht noch aus ` +
        '(verificationStatus = submitted). Der Nachweis fehlt nicht — die Anerkennung ist die ' +
        'Prüfhandlung des Betreibers (SPEC 5.4.1 Schritt 4, 5.4.6).'
      )
    case 'anerkennungZurueckgewiesen':
      return `P9: Der Erlaubnissatz ${satzhinweis} von ${lage.lieferant} ist zurückgewiesen und deckt nichts (SPEC 5.4.3).`
    case 'urkundeFehlt':
    case 'dateiFehlt':
    case 'enddatumFehlt':
    case 'beginnFehlt':
    case 'enddatumBeiUnbefristet':
      return `P9: Der Erlaubnissatz ${satzhinweis} von ${lage.lieferant} ist ein Datenfehler und deckt keinen Tag (SPEC 5.4.5, 5.4.6).${feldhinweis}`
    case 'zeitraumNichtBestimmbar':
      return (
        `P9: Der Prüfzeitraum ließ sich aus dem Vorgang nicht bilden; die Erlaubnis von ` +
        `${lage.lieferant} ist deshalb nicht prüfbar. Eine fehlende Rechengrundlage wirkt wie ein ` +
        'Treffer (SPEC 5.0).'
      )
    case 'luecke':
      return `P9: Lücke in der AÜG-Erlaubnis von ${lage.lieferant}; erster nicht gedeckter Tag: ${rohdaten.ungedeckteTage[0]}. Ein Nachfolgesatz mit supersedesRef heilt die Lücke nicht (SPEC 5.4.5).`
    case 'abgelaufen':
      return `P9: Die AÜG-Erlaubnis von ${lage.lieferant} deckt den Prüfzeitraum nicht bis zum Ende; erster nicht gedeckter Tag: ${rohdaten.ungedeckteTage[0]} (SPEC 5.4.1, Schritt 3).`
    case 'nochNichtGueltig':
      return `P9: Die AÜG-Erlaubnis von ${lage.lieferant} beginnt erst nach dem Anfang des Prüfzeitraums; erster nicht gedeckter Tag: ${rohdaten.ungedeckteTage[0]} (SPEC 5.4.1, Schritt 3).`
    case null:
      return `P9: Die AÜG-Erlaubnis von ${lage.lieferant} ist nicht gedeckt (SPEC 5.4.1).`
  }
}

function benannterSatz(satzbefunde: readonly Satzbefund[]): string {
  const namen = satzbefunde
    .filter((befund) => !befund.deckungsfaehig)
    .map((befund) => `„${befund.satz.id}"`)
  return namen.length > 0 ? namen.join(', ') : '(ohne Kennung)'
}

function eindeutig<T>(werte: readonly T[]): T[] {
  return [...new Set(werte)]
}
