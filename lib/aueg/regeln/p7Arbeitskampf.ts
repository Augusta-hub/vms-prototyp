/**
 * P7 — Einsatzverbot bei Arbeitskampf (SPEC 5.3.2, § 11 Abs. 5 AÜG).
 *
 * **Die Regel.** Der Entleiher darf Leiharbeitnehmer nicht tätig werden lassen,
 * wenn sein Betrieb unmittelbar von einem Arbeitskampf betroffen ist (Satz 1).
 * Das gilt nicht, wenn er sicherstellt, dass der Leiharbeitnehmer keine
 * Tätigkeiten der Arbeitskampfbetroffenen übernimmt (Satz 2).
 *
 * **Diese Regel kehrt den Grundsatz aus 5.0 um — und zwar als einzige.** Sonst
 * wirkt eine fehlende Angabe wie ein Treffer. Hier nicht: *ohne* Anzeige gibt
 * es **keinen** Treffer. 5.3.2 begründet das ausdrücklich — eine fehlende
 * Anzeige bedeutet im Regelfall, dass kein Arbeitskampf läuft, und der
 * Grundsatz würde jeden Einsatzstart sperren. Der Preis steht in 5.5.1: die
 * Regel ist nur so gut wie die Meldedisziplin des Entleihers. Das ist eine
 * Grenze der Regel, keine Lücke im Rechenweg — wer sie hier „repariert",
 * sperrt den Normalfall.
 *
 * **Was dieser Rechenweg nicht tut.** Er vergleicht keine Texte. Ob die
 * Tätigkeit des Einsatzes zu den bestreikten Bereichen gehört, ist eine
 * Entscheidung des Entleihers (5.3.2, Grenzfall „Nur ein Teil des Betriebs
 * betroffen"). Nennt die Anzeige Bereiche, die die Tätigkeit nicht abdecken,
 * ist das Ergebnis deshalb eine **Warnung statt eines Treffers** — nicht
 * „kein Treffer" und nicht eine Sperre.
 *
 * **Die Datenlücke.** Kapitel 3 führt für die Arbeitskampfanzeige kein Feld am
 * Standort und für die Zusicherung kein Objekt (5.3.2, *offene Frage 30*).
 * Dieses Modul erfindet beides nicht: es nimmt die Angaben als Eingangsdaten
 * und beschreibt in `Arbeitskampflage`, was die Regel braucht.
 */

import {
  istVorOderGleich,
  liegtImZeitraum,
  tageDesZeitraums,
  type Tag,
} from '../kalender'
import { REGELWERK, type Regelwerkkonfiguration } from '../regelwerk'
import type { Rollenkuerzel } from '../typen'

/** Ein Zeitraum mit eingeschlossenen Randtagen; `bis === null` heißt „offen". */
export interface Anzeigezeitraum {
  readonly von: Tag
  readonly bis: Tag | null
}

/**
 * Die Arbeitskampfanzeige des Entleihers (SPEC 5.3.2, Tabelle „Erforderliche
 * Angaben"). `bereicheDeckenTaetigkeit`:
 *
 *  - `null` — die Anzeige nennt keine Bereiche, der Betrieb ist als Ganzes
 *    betroffen;
 *  - `true` — die genannten Bereiche umfassen die Tätigkeit des Einsatzes;
 *  - `false` — sie umfassen sie **nicht**. Dann warnt die Regel, statt zu
 *    treffen (Grenzfall „Nur ein Teil des Betriebs betroffen").
 */
export interface Arbeitskampfanzeige {
  readonly standort: string | null
  readonly zeitraum: Anzeigezeitraum
  readonly bereiche: readonly string[]
  readonly bereicheDeckenTaetigkeit: boolean | null
}

/**
 * Die Zusicherung nach § 11 Abs. 5 Satz 2 AÜG — je Einsatz, mit Datum und
 * erklärender Person (5.3.2). `decktStichtag` ist die Angabe des Vorgangs,
 * nicht eine Rechnung: die Zusicherung ist ein Dokument, kein Zeitraumfeld
 * (*offene Frage 30*).
 */
export interface Zusicherung {
  readonly datum: Tag | null
  readonly person: string | null
  readonly decktStichtag: boolean
}

export interface Arbeitskampflage {
  /** Standort des Einsatzes bzw. der Bedarfsanfrage (`siteRef`, 3.1). */
  readonly standort: string | null
  /** Tätigkeit des Einsatzes — nur zur Nennung in der Meldung. */
  readonly taetigkeit: string | null
  readonly anzeige: Arbeitskampfanzeige | null
  readonly zusicherung: Zusicherung | null
  /** Stichtag nach 5.0; bei → `tendered` steht stattdessen der Zeitraum. */
  readonly stichtag: Tag | null
  readonly zeitraum: { readonly von: Tag | null; readonly bis: Tag | null } | null
}

/** Warum ein Treffer zur Warnung wird (5.3.2, Schritt 3 und Grenzfälle). */
export type Milderung = 'zusicherung' | 'teilbetroffen'

export interface Arbeitskampfergebnis {
  readonly anzeigeVorhanden: boolean
  /** Ob die Anzeige den Stichtag oder einen Tag des Prüfzeitraums enthält. */
  readonly betroffen: boolean
  /** Die betroffenen Tage, die geprüft wurden — tagesgenau wie in 5.4.1. */
  readonly betroffeneTage: readonly Tag[]
  /** Anzeige ohne Bis-Datum: der Zeitraum ist bis auf Weiteres betroffen. */
  readonly offenesEnde: boolean
  readonly treffer: boolean
  readonly milderung: Milderung | null
  readonly anzeigeVon: Tag | null
  readonly anzeigeBis: Tag | null
  readonly adressaten: readonly Rollenkuerzel[]
  readonly meldung: string
  readonly vermerke: readonly string[]
}

/**
 * Rechnet P7 nach SPEC 5.3.2. Die **Ergebnisart** bestimmt dieses Modul nicht
 * — sie kommt aus 4.7 (Q05 Warnung, Q22 Sperre, N4 Warnung), gesetzt in
 * `pruefwerk.ts` (5.5.1 a).
 */
export function pruefeArbeitskampf(
  lage: Arbeitskampflage,
  konfiguration: Regelwerkkonfiguration = REGELWERK,
): Arbeitskampfergebnis {
  const vermerke: string[] = []

  // Schritt 2: Anzeige suchen. Keine Anzeige → kein Treffer. Die einzige
  // Ausnahme vom Grundsatz aus 5.0, und sie ist in 5.3.2 begründet.
  if (lage.anzeige === null) {
    return {
      anzeigeVorhanden: false,
      betroffen: false,
      betroffeneTage: [],
      offenesEnde: false,
      treffer: false,
      milderung: null,
      anzeigeVon: null,
      anzeigeBis: null,
      adressaten: [],
      meldung:
        'P7: Für den Standort ' +
        (lage.standort === null ? '' : `„${lage.standort}" `) +
        'liegt keine Arbeitskampfanzeige vor — kein Treffer. Das ist die einzige Ausnahme vom ' +
        'Grundsatz aus SPEC 5.0: eine fehlende Anzeige bedeutet im Regelfall, dass kein ' +
        'Arbeitskampf läuft, und der Grundsatz würde jeden Einsatzstart sperren. Die Regel ist ' +
        'damit nur so gut wie die Meldedisziplin des Entleihers (SPEC 5.3.2, 5.5.1).',
      vermerke: [
        'Ohne Anzeige kein Treffer (SPEC 5.3.2, Grenzfall „Fehlende Angaben").',
      ],
    }
  }

  const anzeige = lage.anzeige
  const offenesEnde = anzeige.zeitraum.bis === null
  if (offenesEnde) {
    vermerke.push(
      'Die Anzeige führt kein Bis-Datum: der Prüfzeitraum ist bis auf Weiteres betroffen, ' +
        'das Ende ist vom Entleiher nachzutragen (SPEC 5.3.2, Grenzfall „Anzeige ohne ' +
        'Bis-Datum").',
    )
  }

  // Schritt 2 (Fortsetzung): deckt die Anzeige den Stichtag oder einen Tag des
  // Prüfzeitraums? Der erste und der letzte Tag der Anzeige sind betroffen
  // (Grenzfall „Tag genau auf der Grenze").
  const betroffeneTage = pruefTage(lage).filter((tag) => deckt(anzeige.zeitraum, tag))
  const betroffen = betroffeneTage.length > 0

  if (!betroffen) {
    return {
      anzeigeVorhanden: true,
      betroffen: false,
      betroffeneTage: [],
      offenesEnde,
      treffer: false,
      milderung: null,
      anzeigeVon: anzeige.zeitraum.von,
      anzeigeBis: anzeige.zeitraum.bis,
      adressaten: [],
      meldung:
        `P7: Die Arbeitskampfanzeige läuft ${zeitraumtext(anzeige.zeitraum)} und enthält ` +
        `${stichtagtext(lage)} nicht. Der Einsatz ist nicht betroffen — kein Treffer ` +
        '(SPEC 5.3.2, Schritt 2).',
      vermerke,
    }
  }

  // Schritt 3: Zusicherung nach § 11 Abs. 5 Satz 2. Liegt sie vor und deckt sie
  // den Stichtag, ist der Einsatz zulässig — Warnung statt Treffer. Der
  // Sachverhalt bleibt sichtbar, solange der Arbeitskampf läuft.
  const zusichert = lage.zusicherung !== null && lage.zusicherung.decktStichtag
  if (lage.zusicherung !== null && !lage.zusicherung.decktStichtag) {
    vermerke.push(
      'Eine Zusicherung liegt vor, deckt den Stichtag aber nicht — sie wirkt nur für den ' +
        'Zeitraum, den sie benennt (SPEC 5.3.2, Schritt 3).',
    )
  }

  // Grenzfall „Nur ein Teil des Betriebs betroffen": die Beurteilung der
  // unmittelbaren Betroffenheit ist eine Entscheidung des Entleihers, keine
  // Textvergleichsoperation des Systems.
  const teilbetroffen = anzeige.bereicheDeckenTaetigkeit === false
  if (teilbetroffen) {
    vermerke.push(
      'Die Anzeige nennt Bereiche, die die Tätigkeit des Einsatzes nicht abdecken. Die ' +
        'Beurteilung der unmittelbaren Betroffenheit bleibt eine Entscheidung des Entleihers; ' +
        'das System vergleicht keine Texte (SPEC 5.3.2).',
    )
  }

  // Die Zusicherung ist die gesetzliche Ausnahme und geht der Teilbetroffenheit
  // vor: sie steht im Gesetz, die andere ist eine Beurteilung des Entleihers.
  const milderung: Milderung | null = zusichert
    ? 'zusicherung'
    : teilbetroffen
      ? 'teilbetroffen'
      : null

  return {
    anzeigeVorhanden: true,
    betroffen: true,
    betroffeneTage,
    offenesEnde,
    treffer: true,
    milderung,
    anzeigeVon: anzeige.zeitraum.von,
    anzeigeBis: anzeige.zeitraum.bis,
    adressaten: adressaten(milderung, konfiguration),
    meldung: meldungZu(lage, anzeige, betroffeneTage, milderung),
    vermerke,
  }
}

/* ------------------------------------------------------------------ */

/**
 * Die Tage, gegen die geprüft wird (SPEC 5.0 und 5.3.2 Schritt 1): der
 * Stichtag, oder — bei → `tendered` — jeder Tag des Prüfzeitraums bis zur
 * Angebotsfrist. Ein Zeitraum ohne Anfang oder Ende liefert die Tage, die er
 * nennt; geraten wird nichts.
 */
function pruefTage(lage: Arbeitskampflage): readonly Tag[] {
  if (lage.stichtag !== null) return [lage.stichtag]
  const zeitraum = lage.zeitraum
  if (zeitraum === null) return []
  if (zeitraum.von === null) return zeitraum.bis === null ? [] : [zeitraum.bis]
  if (zeitraum.bis === null) return [zeitraum.von]
  if (!istVorOderGleich(zeitraum.von, zeitraum.bis)) return []
  return tageDesZeitraums(zeitraum.von, zeitraum.bis)
}

/** Deckt die Anzeige diesen Tag? Beide Randtage sind betroffen (5.3.2). */
function deckt(zeitraum: Anzeigezeitraum, prueftag: Tag): boolean {
  if (zeitraum.bis === null) return istVorOderGleich(zeitraum.von, prueftag)
  return liegtImZeitraum(prueftag, zeitraum.von, zeitraum.bis)
}

function adressaten(
  milderung: Milderung | null,
  konfiguration: Regelwerkkonfiguration,
): readonly Rollenkuerzel[] {
  return milderung === null
    ? konfiguration.adressatenArbeitskampf
    : konfiguration.adressatenArbeitskampfZulaessig
}

function zeitraumtext(zeitraum: Anzeigezeitraum): string {
  return zeitraum.bis === null
    ? `ab dem ${zeitraum.von} ohne Enddatum`
    : `vom ${zeitraum.von} bis ${zeitraum.bis}`
}

function stichtagtext(lage: Arbeitskampflage): string {
  if (lage.stichtag !== null) return `den Stichtag ${lage.stichtag}`
  const zeitraum = lage.zeitraum
  if (zeitraum === null) return 'den Stichtag (nicht genannt)'
  return `den Prüfzeitraum ${zeitraum.von ?? '(offen)'} bis ${zeitraum.bis ?? '(offen)'}`
}

/**
 * Datum und erklärende Person der Zusicherung (5.3.2, Tabelle „Erforderliche
 * Angaben"). Fehlt beides, bleibt die Klammer weg — eine leere Klammer wäre
 * eine Angabe, die niemand gemacht hat.
 */
function herkunft(zusicherung: Zusicherung | null): string {
  if (zusicherung === null) return ''
  const teile = [
    zusicherung.datum === null ? null : `vom ${zusicherung.datum}`,
    zusicherung.person === null ? null : `erklärt durch ${zusicherung.person}`,
  ].filter((teil): teil is string => teil !== null)
  return teile.length === 0 ? '' : ` (${teile.join(', ')})`
}

function meldungZu(
  lage: Arbeitskampflage,
  anzeige: Arbeitskampfanzeige,
  betroffeneTage: readonly Tag[],
  milderung: Milderung | null,
): string {
  const kopf =
    `P7: Für den Standort ${lage.standort === null ? '(ohne Standortangabe)' : `„${lage.standort}"`} ` +
    `ist ein Arbeitskampf ${zeitraumtext(anzeige.zeitraum)} angezeigt. ` +
    `Betroffen ${betroffeneTage.length === 1 ? 'ist der Tag' : 'sind die Tage'} ` +
    `${betroffeneTage.join(', ')}.`

  if (milderung === 'zusicherung') {
    return (
      `${kopf} Es liegt eine Zusicherung nach § 11 Abs. 5 Satz 2 AÜG vor` +
      `${herkunft(lage.zusicherung)}: der Leiharbeitnehmer übernimmt keine Tätigkeiten der ` +
      'Arbeitskampfbetroffenen. Der Einsatz ist zulässig — Warnung statt Treffer. Der ' +
      'Sachverhalt bleibt sichtbar und wird eskaliert, solange der Arbeitskampf läuft ' +
      '(SPEC 5.3.2, Schritt 3).'
    )
  }

  if (milderung === 'teilbetroffen') {
    return (
      `${kopf} Die Anzeige nennt nur ${anzeige.bereiche.map((bereich) => `„${bereich}"`).join(', ')} ` +
      `und damit nicht die Tätigkeit ${lage.taetigkeit === null ? 'des Einsatzes' : `„${lage.taetigkeit}"`}. ` +
      'Ob der Betrieb unmittelbar betroffen ist, entscheidet der Entleiher — das System ' +
      'vergleicht keine Texte. Warnung statt Treffer (SPEC 5.3.2).'
    )
  }

  return (
    `${kopf} Eine Zusicherung nach § 11 Abs. 5 Satz 2 AÜG liegt nicht vor. Offene Wege sind die ` +
    'Zusicherung des Entleihers oder ein späterer Start (SPEC 5.3.2, Schritt 3). Wer die ' +
    'Zusicherung abgeben darf, ist *offene Frage 30*.'
  )
}
