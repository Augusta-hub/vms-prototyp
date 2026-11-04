/**
 * Konfiguration des Regelwerks — die Werte, mit denen gerechnet wird.
 *
 * SPEC 5.0, Abschnitt „Festwerte dieses Kapitels": Vorlauf- und Schwellenwerte
 * sind **Regelwerk**, keine Nutzerdaten und keine Tarifwerte. Sie beschreiben,
 * wie früh das System warnt, nicht was rechtlich gilt. Sie stehen deshalb an
 * **einer** Stelle und nicht als Zahl im Rechenweg — eine Änderung ist eine
 * Änderung des Kapitels, kein Eingriff in die Regel (CLAUDE.md: Fristen sind
 * Konfiguration, keine Konstanten im Code).
 *
 * Jede Funktion, die einen dieser Werte braucht, nimmt die Konfiguration als
 * Parameter mit `REGELWERK` als Vorbesetzung. So lässt sich eine Stufenfolge im
 * Test setzen, ohne ein Modul zu verbiegen.
 */

import type { Ergebnisart, Rollenkuerzel } from './typen'

/** Nachweisarten des Pflichtkatalogs (SPEC 3.10, ergänzt in 5.4.4). */
export type Nachweisart =
  | 'permitCertificate'
  | 'workPermit'
  | 'safetyBriefing'
  | 'qualificationCertificate'
  | 'clearanceCertificate'
  | 'agreementDocument'
  | 'other'

/**
 * Die Stufenfolge vor dem Ablauf eines Nachweises (SPEC 5.4.4, Spalte
 * „Vorlauf"). `null` heißt: diese Stufe gibt es für die Nachweisart nicht.
 */
export interface Vorlauf {
  /** Restzeit in Tagen, ab der informiert wird. */
  readonly information: number | null
  /** Restzeit in Tagen, ab der gewarnt wird. */
  readonly warnung: number | null
  /** Restzeit in Tagen, ab der zusätzlich eskaliert wird. */
  readonly eskalation: number | null
}

/**
 * Adressaten je Stufe (SPEC 5.4.4, Abschnitt „Fristen vor Ablauf", und der
 * Eskalationsanlass „AÜG-Erlaubnis läuft ab oder Nachweis fehlt" aus 2.4:
 * `LA` → `LD` → `MD` → `MA`). Die Stufen sind **kumulativ**: die Warnung geht
 * zusätzlich an `LD`, nicht statt an `LA`.
 */
export interface Stufenadressaten {
  readonly information: readonly Rollenkuerzel[]
  readonly warnung: readonly Rollenkuerzel[]
  readonly eskalation: readonly Rollenkuerzel[]
  /** Nach Ablauf von `validTo`. */
  readonly abgelaufen: readonly Rollenkuerzel[]
}

/** Bezugsobjekt einer Nachweisart (SPEC 5.4.4, Spalte „Bezugsobjekt"). */
export type Bezugsobjekt = 'lieferant' | 'kandidat' | 'einsatz' | 'rahmenvertrag' | 'beliebig'

/**
 * Wann eine Nachweisart Pflicht ist (SPEC 5.4.4, Spalte „Pflicht, wenn").
 * `nie` heißt: ihr Fehlen ist kein Befund, solange der Vorgang nichts über sie
 * sagt — die Art sperrt nach dem Katalog nie.
 */
export type Pflichtbedingung =
  | 'immer'
  | 'wennArbeitserlaubnisErforderlich'
  | 'wennStandortVerlangt'
  | 'nie'

/** Eine Zeile des Pflichtkatalogs (SPEC 5.4.4, Entscheidung zu Frage 20). */
export interface Katalogzeile {
  readonly bezugsobjekt: Bezugsobjekt
  readonly pflicht: Pflichtbedingung
  /**
   * Ergebnisart je Prüfzeitpunkt — die Spalte „Prüfzeitpunkt" aus 5.4.4, nach
   * den Zeilennummern aus 4.7 aufgeschlüsselt. Eine Nachweisart wird an einem
   * Übergang **nur** geprüft, wenn sie hier eine Zeile hat.
   *
   * Diese Werte sind maßgeblich, nicht die Ergebnisart der Zeile in 4.7: wo
   * beide auseinandergehen, folgt die Rechnung dem Katalog
   * (*offene Frage 31*, dort ausdrücklich so festgehalten).
   *
   * Der Schlüssel `Speicherung` steht für den zweiten Anlass aus 5.5.1 b — eine
   * Änderung an einer Rechengrundlage. Dort ist das Ergebnis „Information oder
   * Warnung, nie `block`": gesperrt werden Handlungen, nicht Feststellungen.
   */
  readonly wirkung: Readonly<Partial<Record<string, Ergebnisart>>>
}

export interface Regelwerkkonfiguration {
  readonly vorlauf: Readonly<Record<Nachweisart, Vorlauf>>
  readonly stufenadressaten: Readonly<Record<Nachweisart, Stufenadressaten>>
  /** Wer erfährt von einem Datenfehler am Erlaubnissatz (5.4.6). */
  readonly adressatenDatenfehlerErlaubnis: readonly Rollenkuerzel[]
  /** Wer erfährt, dass die Anerkennung noch aussteht (5.4.6). */
  readonly adressatenAnerkennungAussteht: readonly Rollenkuerzel[]
  /** Wer erfährt von einer fehlenden oder nicht deckenden Erlaubnis (5.0 Nr. 3). */
  readonly adressatenErlaubnisFehlt: readonly Rollenkuerzel[]
  /** Wer erfährt von einem Verstoß, der in der Vergangenheit liegt (5.5.3, R3). */
  readonly adressatenRueckwirkenderBefund: readonly Rollenkuerzel[]
  /** Der Pflichtkatalog aus 5.4.4 — fest, nicht je Kunde konfigurierbar. */
  readonly katalog: Readonly<Record<Nachweisart, Katalogzeile>>
}

const GESTUFT_LA_LD_MD_MA: Stufenadressaten = {
  information: ['LA'],
  warnung: ['LA', 'LD'],
  eskalation: ['LA', 'LD', 'MD'],
  abgelaufen: ['LA', 'LD', 'MD', 'MA'],
}

const OHNE_STUFEN: Stufenadressaten = {
  information: [],
  warnung: [],
  eskalation: [],
  abgelaufen: [],
}

const OHNE_VORLAUF: Vorlauf = { information: null, warnung: null, eskalation: null }

export const REGELWERK: Regelwerkkonfiguration = {
  // SPEC 5.4.4, Spalte „Vorlauf (Information / Warnung / Eskalation)".
  vorlauf: {
    permitCertificate: { information: 90, warnung: 30, eskalation: 14 },
    workPermit: { information: 60, warnung: 30, eskalation: 7 },
    safetyBriefing: { information: 30, warnung: 14, eskalation: null },
    qualificationCertificate: { information: 60, warnung: 30, eskalation: null },
    clearanceCertificate: { information: 90, warnung: 30, eskalation: null },
    agreementDocument: OHNE_VORLAUF,
    other: OHNE_VORLAUF,
  },
  stufenadressaten: {
    permitCertificate: GESTUFT_LA_LD_MD_MA,
    workPermit: {
      information: ['LA'],
      warnung: ['LA', 'LD'],
      eskalation: ['LA', 'LD', 'MD'],
      abgelaufen: ['LA', 'LD', 'MD', 'MA'],
    },
    // Die Unterweisung ist einsatzbezogen; sie beginnt beim Bedarfsträger (5.4.4).
    safetyBriefing: {
      information: ['KB'],
      warnung: ['KB', 'LD'],
      eskalation: ['KB', 'LD', 'MD'],
      abgelaufen: ['KB', 'LD', 'MD', 'MA'],
    },
    qualificationCertificate: {
      information: ['LA'],
      warnung: ['LA', 'LD'],
      eskalation: [],
      abgelaufen: ['LA', 'LD', 'MD'],
    },
    clearanceCertificate: {
      information: ['LA'],
      warnung: ['LA', 'LD'],
      eskalation: [],
      abgelaufen: ['LA', 'LD', 'MD'],
    },
    agreementDocument: OHNE_STUFEN,
    other: OHNE_STUFEN,
  },
  adressatenDatenfehlerErlaubnis: ['LA', 'MD'],
  adressatenAnerkennungAussteht: ['MD'],
  adressatenErlaubnisFehlt: ['LA', 'LD'],
  adressatenRueckwirkenderBefund: ['MA'],
  // SPEC 5.4.4, der Katalog aus 3.10 (Entscheidung zu Frage 20), ergänzt um
  // Prüfzeitpunkt und Wirkung. Die AÜG-Erlaubnis fehlt hier mit Absicht: sie
  // „läuft über P9 (Q20) und wird von P10 nicht doppelt geprüft" (5.4.4).
  katalog: {
    permitCertificate: { bezugsobjekt: 'lieferant', pflicht: 'immer', wirkung: {} },
    workPermit: {
      bezugsobjekt: 'kandidat',
      pflicht: 'wennArbeitserlaubnisErforderlich',
      wirkung: { Q10: 'information', Q21: 'sperre', N5: 'warnung', Speicherung: 'warnung' },
    },
    safetyBriefing: {
      bezugsobjekt: 'einsatz',
      pflicht: 'wennStandortVerlangt',
      wirkung: { Q21: 'sperre', Q37: 'warnung', N5: 'warnung', Speicherung: 'warnung' },
    },
    qualificationCertificate: {
      bezugsobjekt: 'kandidat',
      pflicht: 'nie',
      wirkung: { Q10: 'warnung', Q21: 'warnung', N5: 'warnung', Speicherung: 'warnung' },
    },
    clearanceCertificate: {
      bezugsobjekt: 'lieferant',
      pflicht: 'nie',
      wirkung: { Q42: 'warnung', Q43: 'warnung', Q44: 'warnung', N5: 'warnung', Speicherung: 'warnung' },
    },
    agreementDocument: {
      bezugsobjekt: 'rahmenvertrag',
      pflicht: 'nie',
      wirkung: { N5: 'information', Speicherung: 'information' },
    },
    other: { bezugsobjekt: 'beliebig', pflicht: 'nie', wirkung: {} },
  },
}
