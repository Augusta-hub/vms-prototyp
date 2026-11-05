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

/**
 * Die Werte der Höchstüberlassungsdauer (SPEC 5.1) und der Drehtürklausel
 * (5.3.1). `regelgrenzeMonate`, `unterbrechungMonate` und `rueckschauMonate`
 * sind **gesetzliche** Werte (§ 1 Abs. 1b Sätze 1 und 2, § 8 Abs. 3 AÜG) und
 * stehen hier, weil 5.0 Nummer 2 sie ausdrücklich zulässt („Zahlen nur, wo sie
 * gesetzliche Werte sind: 18 Monate, 9 Monate, 15 Monate, 6 Monate, 3 Monate").
 * Eine **tarifliche** Abweichung ist Konfiguration an der Tarifzuordnung (3.3)
 * und erreicht die Regel als Eingangsdatum, nicht über dieses Modul.
 *
 * `hinweisTage` und `warnungTage` sind `maxDurationNoticeDays` und
 * `maxDurationWarningDays` aus 5.0, Abschnitt „Festwerte dieses Kapitels".
 */
export interface Dauerkonfiguration {
  readonly regelgrenzeMonate: number
  readonly unterbrechungMonate: number
  readonly rueckschauMonate: number
  readonly hinweisTage: number
  readonly warnungTage: number
}

/**
 * Die Werte des Equal Pay (SPEC 5.2). `regelfristMonate` und
 * `obergrenzeMonate` sind **gesetzliche** Werte (§ 8 Abs. 4 Sätze 1 und 2
 * AÜG) und stehen deshalb hier — 5.2.2 sagt es ausdrücklich: „Die Werte 9 und
 * 15 sind gesetzliche Werte und stehen deshalb in diesem Kapitel; die
 * Stufenfolge eines konkreten Branchenzuschlagstarifs steht als Konfiguration
 * am `industryPremiumScheme` (3.3) und nirgends hier."
 *
 * `hinweisTage` und `warnungTage` sind `equalPayNoticeDays` und
 * `equalPayWarningDays` aus 5.0, Abschnitt „Festwerte dieses Kapitels".
 */
export interface EqualPaykonfiguration {
  /** § 8 Abs. 4 Satz 1 AÜG: nach neun Monaten gilt Equal Pay zwingend. */
  readonly regelfristMonate: number
  /** § 8 Abs. 4 Satz 2 AÜG: längstens bis zum 15. Monat, mit Zuschlagsschema. */
  readonly obergrenzeMonate: number
  /** `equalPayNoticeDays` — 60 Tage vor `equalPayDueDate`. */
  readonly hinweisTage: number
  /** `equalPayWarningDays` — 30 Tage vor `equalPayDueDate` ohne Entgeltangabe. */
  readonly warnungTage: number
}

export interface Regelwerkkonfiguration {
  readonly dauer: Dauerkonfiguration
  readonly equalPay: EqualPaykonfiguration
  /** Fehlende Tarifzuordnung der Verleiherseite (5.2.2, Fall 1). */
  readonly adressatenVerleihertarifFehlt: readonly Rollenkuerzel[]
  /** Unzulässige Fristkonfiguration (5.2.2, Fälle 5 und 6). */
  readonly adressatenFristkonfiguration: readonly Rollenkuerzel[]
  /** `equalPayNoticeDays` erreicht (5.0, Festwerte). */
  readonly adressatenEqualPayHinweis: readonly Rollenkuerzel[]
  /** Fälligkeit erreicht und `comparableWage` fehlt (5.0, 5.2.3 Schritt 4). */
  readonly adressatenEqualPayWarnung: readonly Rollenkuerzel[]
  /** Kein verwendbarer Vergleichsentgelt-Eintrag (5.2.4, Schritt 2). */
  readonly adressatenVergleichsentgeltFehlt: readonly Rollenkuerzel[]
  /** Abweichung des Einsatzwerts **nach unten** (5.2.4, Schritt 3). */
  readonly adressatenEntgeltabweichung: readonly Rollenkuerzel[]
  /** Einsatzbranche und damit die Zuschlagsstufe nicht bestimmbar (5.2.5). */
  readonly adressatenZuschlagsstufe: readonly Rollenkuerzel[]
  /** Restbudget ≤ `hinweisTage` (5.1.6, Zeile 1). */
  readonly adressatenDauerHinweis: readonly Rollenkuerzel[]
  /** Restbudget ≤ `warnungTage` (5.1.6, Zeile 2): `MD` → `MA`, Information an `KB`. */
  readonly adressatenDauerWarnung: readonly Rollenkuerzel[]
  /** Fristende erreicht, Einsatz läuft weiter (5.1.6, Zeile 3). */
  readonly adressatenDauerErreicht: readonly Rollenkuerzel[]
  /** Fehlende Tarifzuordnung — gerechnet wird mit der Regelgrenze (5.1.2). */
  readonly adressatenRegelgrenze: readonly Rollenkuerzel[]
  /** Fehlende oder unbestätigte Personenidentität (5.0 Nr. 3, 5.1.5). */
  readonly adressatenZaehlgrundlage: readonly Rollenkuerzel[]
  /** Treffer der Drehtürklausel: Equal Pay ab dem ersten Tag (5.3.1, Schritt 5). */
  readonly adressatenDrehtuer: readonly Rollenkuerzel[]
  /** Fehlende Erklärung zur Vorbeschäftigung (5.3.1, „Wenn Daten fehlen"). */
  readonly adressatenErklaerungFehlt: readonly Rollenkuerzel[]
  /** Konzernzugehörigkeit nicht gepflegt (5.3.1, Schritt 4). */
  readonly adressatenKonzernUnbekannt: readonly Rollenkuerzel[]
  /** Arbeitsverhältnis beim Verleiher fehlt oder beginnt zu spät (5.3.4). */
  readonly adressatenArbeitsverhaeltnis: readonly Rollenkuerzel[]
  /**
   * Arbeitskampf am Einsatzort, **ohne** Zusicherung (5.3.2, Schritt 3). 5.3.2
   * nennt für diesen Fall keine Adressaten; 2.4 führt für den Anlass
   * „AÜG-Sperre blockiert einen Vorgang" `MD` mit Eskalation an `MA`.
   *
   * **Nicht** eingetragen ist die Kundenseite. Die Zusicherung nach § 11 Abs. 5
   * Satz 2 ist der offene Weg, und wer sie abgeben darf — `KE` oder `KB` —, ist
   * *offene Frage 30*. Eine Rolle zu raten hieße, die Frage im Code zu
   * entscheiden (CLAUDE.md, Regel 5).
   */
  readonly adressatenArbeitskampf: readonly Rollenkuerzel[]
  /**
   * Arbeitskampf, aber der Einsatz ist zulässig: Zusicherung vorhanden oder nur
   * ein anderer Betriebsteil betroffen. „Der Sachverhalt bleibt sichtbar und
   * wird eskaliert, solange der Arbeitskampf läuft" (5.3.2, Schritt 3).
   */
  readonly adressatenArbeitskampfZulaessig: readonly Rollenkuerzel[]
  /** Zeile N4: „Warnung mit Pflicht-Eskalation an `MD` und `MA`" (5.3.2). */
  readonly adressatenArbeitskampfNachtlauf: readonly Rollenkuerzel[]
  /** Kriterium K1 bis K5 am Einsatz nicht erfüllt (5.3.3; 2.4 für die Stufen). */
  readonly adressatenKonkretisierung: readonly Rollenkuerzel[]
  /**
   * Vorläufer von K3 an der Bedarfsanfrage nicht erfüllt (5.3.3 Nr. 1).
   * Zusätzlich `KB`: 4.1 macht die Anfrage zur Sache des Bedarfsträgers, und
   * das Feld, das nicht trägt, ist eines, das er pflegt.
   */
  readonly adressatenKonkretisierungAnfrage: readonly Rollenkuerzel[]
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
  dauer: {
    // § 1 Abs. 1b Satz 1 AÜG, SPEC 5.1.2 Rang 3.
    regelgrenzeMonate: 18,
    // § 1 Abs. 1b Satz 2 AÜG, SPEC 5.1.4.
    unterbrechungMonate: 3,
    // § 8 Abs. 3 AÜG, SPEC 5.3.1 Schritt 2.
    rueckschauMonate: 6,
    // SPEC 5.0: `maxDurationNoticeDays`, `maxDurationWarningDays`.
    hinweisTage: 90,
    warnungTage: 30,
  },
  equalPay: {
    // § 8 Abs. 4 Satz 1 AÜG, SPEC 5.2.2 Fall 2.
    regelfristMonate: 9,
    // § 8 Abs. 4 Satz 2 AÜG, SPEC 5.2.2 Fall 4 und 6.
    obergrenzeMonate: 15,
    // SPEC 5.0: `equalPayNoticeDays`, `equalPayWarningDays`.
    hinweisTage: 60,
    warnungTage: 30,
  },
  // 5.2.2 Fall 1: `supplierCollectiveAgreement` ist ab `active` Pflicht (3.2);
  // das Fehlen ist ein Datenfehler mit unmittelbarer Entgeltfolge.
  adressatenVerleihertarifFehlt: ['MA'],
  adressatenFristkonfiguration: ['MA'],
  // 5.0, Festwerte: „Information an `MD` und `KE`".
  adressatenEqualPayHinweis: ['MD', 'KE'],
  adressatenEqualPayWarnung: ['MD', 'MA', 'KE'],
  // 5.2.4: „Der Entleiher pflegt den Eintrag (3.3); die Meldung geht an `KE`."
  adressatenVergleichsentgeltFehlt: ['KE'],
  adressatenEntgeltabweichung: ['KE'],
  adressatenZuschlagsstufe: ['KE', 'MD'],
  adressatenDauerHinweis: ['MD'],
  adressatenDauerWarnung: ['MD', 'MA', 'KB'],
  adressatenDauerErreicht: ['MD', 'MA', 'KB', 'LD'],
  adressatenRegelgrenze: ['MA'],
  adressatenZaehlgrundlage: ['MD'],
  adressatenDrehtuer: ['MD', 'LD'],
  adressatenErklaerungFehlt: ['MD', 'LD'],
  adressatenKonzernUnbekannt: ['MA'],
  adressatenArbeitsverhaeltnis: ['MD', 'LD'],
  // 2.4, Anlass „AÜG-Sperre blockiert einen Vorgang": `MD`, Eskalation `MA`.
  adressatenArbeitskampf: ['MD', 'MA'],
  adressatenArbeitskampfZulaessig: ['MD'],
  // 5.3.2: „eine Warnung mit Pflicht-Eskalation an `MD` und `MA`".
  adressatenArbeitskampfNachtlauf: ['MD', 'MA'],
  adressatenKonkretisierung: ['MD', 'MA'],
  adressatenKonkretisierungAnfrage: ['KB', 'MD'],
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
