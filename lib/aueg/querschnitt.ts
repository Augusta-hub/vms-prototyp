/**
 * Die Querschnittstabelle aus SPEC 4.7 als Daten.
 *
 * SPEC 5.5.1 a): „Welche Prüfung an welchem Übergang läuft, steht
 * **ausschließlich** in der Querschnittstabelle 4.7 — nicht in diesem Kapitel
 * und nicht im Code." Dieses Modul ist die Abschrift dieser Tabelle, nicht eine
 * zweite Quelle: jede Zeile trägt ihre Nummer und ihren Kapitelverweis, und die
 * Rechenwege in `regeln/` greifen auf sie zu, statt eine Ergebnisart selbst zu
 * wählen. Weicht eine Zeile von 4.7 ab, ist das ein Fehler in dieser Datei.
 *
 * **Abgeschrieben sind bisher die Zeilen zu P9 und P10** (SPEC 5.4, bestätigt
 * in 5.5.5) und die Zeilen N1 und N5 des nächtlichen Laufs (5.5.1). Die Zeilen
 * der übrigen Prüfungen kommen mit ihrem Rechenweg; eine Zeile ohne Rechenweg
 * wäre eine Zusicherung, die nichts einlöst.
 *
 * **Eine Besonderheit bei P10:** 4.7 ordnet Q21, Q42, Q43 und Q44 eine Sperre
 * zu, der Pflichtkatalog in 5.4.4 gibt der einzelnen Nachweisart aber teils
 * eine mildere Wirkung. Die Zeilen tragen deshalb `ergebnisartAusKatalog`: die
 * Rechnung folgt dem Katalog, nicht dem Wert hier (*offene Frage 31*, dort
 * ausdrücklich so festgehalten). Der Wert bleibt stehen, weil er zeigt, was
 * 4.7 vorschlägt.
 */

import type { Ergebnisart, Pruefung } from './typen'

/** Eine Zeile der Querschnittstabelle 4.7 oder des nächtlichen Laufs 5.5.1. */
export interface Querschnittzeile {
  /** Nummer in 4.7 (`Q04` …) oder im nächtlichen Lauf (`N1` …). */
  readonly nummer: string
  /** Objektart, wie der Vorgang sie benennt. */
  readonly objekt: Objektart
  /** Ausgangsstatus; `null` für die Anlage („—" in 4.7). */
  readonly von: string | null
  /** Zielstatus; `null` beim nächtlichen Lauf, der keinen Übergang kennt. */
  readonly nach: string | null
  readonly pruefung: Pruefung
  /** Prüfgegenstand im Wortlaut von 4.7. */
  readonly gegenstand: string
  /**
   * Ergebnisart **im Trefferfall**. Ohne Treffer ist das Ergebnis eine
   * Information (5.5.2 Nr. 1: jedes Ergebnis wird vermerkt).
   */
  readonly trefferart: Ergebnisart
  /**
   * Die Prüfung wirkt je nachgeordnetem Objekt, nicht auf den Vorgang selbst
   * (5.4.1: „Sperre je Einladung, nicht je Ausschreibung").
   */
  readonly jeEinladung?: true
  /**
   * Die Ergebnisart kommt für diese Zeile aus dem Pflichtkatalog in 5.4.4, nicht
   * aus `trefferart` (*offene Frage 31*).
   */
  readonly ergebnisartAusKatalog?: true
  readonly specReference: string
}

/** Objektarten, soweit die Zeilen zu P9 sie ansprechen (SPEC Kapitel 3). */
export type Objektart =
  | 'bedarfsanfrage'
  | 'einladung'
  | 'profilvorschlag'
  | 'einsatz'
  | 'verlaengerung'
  | 'stundenzettel'
  | 'beleg'
  | 'lieferant'
  | 'nachweis'
  | 'unbekannt'

export const QUERSCHNITT: readonly Querschnittzeile[] = [
  {
    nummer: 'Q04',
    objekt: 'bedarfsanfrage',
    von: 'approved',
    nach: 'tendered',
    pruefung: 'P9',
    gegenstand:
      'je eingeladenem Lieferanten: Erlaubnis anerkannt und über die Angebotsfrist hinaus gültig',
    trefferart: 'sperre',
    jeEinladung: true,
    specReference: 'SPEC 4.7 Q04; 5.4.1',
  },
  {
    nummer: 'Q06',
    objekt: 'einladung',
    von: null,
    nach: 'invited',
    pruefung: 'P9',
    gegenstand: 'Lieferant `active` und Erlaubnis gültig',
    trefferart: 'sperre',
    specReference: 'SPEC 4.7 Q06',
  },
  {
    nummer: 'Q16',
    objekt: 'einsatz',
    von: null,
    nach: 'planned',
    pruefung: 'P9',
    gegenstand: 'Erlaubnis für den geplanten Zeitraum gültig',
    trefferart: 'sperre',
    specReference: 'SPEC 4.7 Q16',
  },
  {
    nummer: 'Q20',
    objekt: 'einsatz',
    von: 'planned',
    nach: 'active',
    pruefung: 'P9',
    gegenstand: 'Erlaubnis am Starttag gültig und anerkannt',
    trefferart: 'sperre',
    specReference: 'SPEC 4.7 Q20',
  },
  {
    nummer: 'Q31',
    objekt: 'verlaengerung',
    von: 'approved',
    nach: 'effective',
    pruefung: 'P9',
    gegenstand: 'Erlaubnis für den verlängerten Zeitraum gültig',
    trefferart: 'sperre',
    specReference: 'SPEC 4.7 Q31',
  },
  {
    nummer: 'Q38',
    objekt: 'beleg',
    von: null,
    nach: 'created',
    pruefung: 'P9',
    gegenstand: 'Erlaubnis im gesamten Leistungszeitraum gültig',
    // Erbrachte Leistung wird abgerechnet; der Befund wird dokumentiert, die
    // Abrechnung nicht blockiert (5.5.5, Bestätigung zu Q38).
    trefferart: 'warnung',
    specReference: 'SPEC 4.7 Q38; 5.4.2 b)',
  },
  {
    nummer: 'Q41',
    objekt: 'lieferant',
    von: 'onboarding',
    nach: 'active',
    pruefung: 'P9',
    gegenstand: 'Erlaubnis anerkannt und gültig',
    trefferart: 'sperre',
    specReference: 'SPEC 4.7 Q41',
  },
  {
    nummer: 'Q43',
    objekt: 'lieferant',
    von: 'blocked',
    nach: 'active',
    pruefung: 'P9',
    gegenstand: 'Sperrgrund behoben, Nachweise gültig',
    trefferart: 'sperre',
    specReference: 'SPEC 4.7 Q43',
  },
  {
    nummer: 'Q44',
    objekt: 'lieferant',
    von: 'inactive',
    nach: 'active',
    pruefung: 'P9',
    gegenstand: 'wie beim erstmaligen Freischalten',
    trefferart: 'sperre',
    specReference: 'SPEC 4.7 Q44',
  },
  {
    nummer: 'N1',
    objekt: 'lieferant',
    von: null,
    nach: null,
    pruefung: 'P9',
    gegenstand: 'Erlaubnis abgelaufen oder innerhalb des Vorlaufs',
    // Der nächtliche Lauf erzeugt keine Sperre — eine Sperre braucht einen
    // Übergang, den sie verhindert (5.5.1 c).
    trefferart: 'warnung',
    specReference: 'SPEC 5.5.1, Zeile N1; 5.4.4',
  },
  {
    nummer: 'Q10',
    objekt: 'profilvorschlag',
    von: 'submitted',
    nach: 'reviewed',
    pruefung: 'P10',
    gegenstand: 'Pflichtnachweise des Kandidaten (Arbeitserlaubnis, Qualifikation)',
    trefferart: 'information',
    ergebnisartAusKatalog: true,
    specReference: 'SPEC 4.7 Q10; 5.4.4',
  },
  {
    nummer: 'Q21',
    objekt: 'einsatz',
    von: 'planned',
    nach: 'active',
    pruefung: 'P10',
    gegenstand: 'Pflichtnachweise zum Einsatz, insbesondere Unterweisung am Standort',
    trefferart: 'sperre',
    ergebnisartAusKatalog: true,
    specReference: 'SPEC 4.7 Q21; 5.4.4',
  },
  {
    nummer: 'Q37',
    objekt: 'stundenzettel',
    von: 'inApproval',
    nach: 'approved',
    pruefung: 'P10',
    gegenstand: 'Unterweisungsnachweis für den Standort gültig',
    trefferart: 'warnung',
    ergebnisartAusKatalog: true,
    specReference: 'SPEC 4.7 Q37; 5.4.4',
  },
  {
    nummer: 'Q42',
    objekt: 'lieferant',
    von: 'onboarding',
    nach: 'active',
    pruefung: 'P10',
    gegenstand: 'Pflichtnachweise vollständig',
    trefferart: 'sperre',
    ergebnisartAusKatalog: true,
    specReference: 'SPEC 4.7 Q42; 5.4.4',
  },
  {
    nummer: 'Q43',
    objekt: 'lieferant',
    von: 'blocked',
    nach: 'active',
    pruefung: 'P10',
    gegenstand: 'Sperrgrund behoben, Nachweise gültig',
    trefferart: 'sperre',
    ergebnisartAusKatalog: true,
    specReference: 'SPEC 4.7 Q43; 5.4.4',
  },
  {
    nummer: 'Q44',
    objekt: 'lieferant',
    von: 'inactive',
    nach: 'active',
    pruefung: 'P10',
    gegenstand: 'wie beim erstmaligen Freischalten',
    trefferart: 'sperre',
    ergebnisartAusKatalog: true,
    specReference: 'SPEC 4.7 Q44; 5.4.4',
  },
  {
    nummer: 'N5',
    objekt: 'einsatz',
    von: null,
    nach: null,
    pruefung: 'P10',
    gegenstand: 'Nachweise mit `validTo`, deren Bezugsobjekt aktiv ist: Ablauf oder Vorlauf erreicht',
    trefferart: 'warnung',
    ergebnisartAusKatalog: true,
    specReference: 'SPEC 5.5.1, Zeile N5; 5.4.4',
  },
]

/**
 * Die Zeile zu einem Übergang. `von` wird nur verglichen, wenn die Zeile einen
 * Ausgangsstatus nennt **und** der Vorgang einen kennt — die Szenarien nennen
 * ihn nicht überall, und ein unbekannter Ausgangsstatus darf die Zeile nicht
 * verfehlen.
 */
export function zeileFuerUebergang(
  pruefung: Pruefung,
  objekt: Objektart,
  von: string | null,
  nach: string | null,
): Querschnittzeile | null {
  const kandidaten = QUERSCHNITT.filter(
    (zeile) =>
      zeile.pruefung === pruefung && zeile.objekt === objekt && zeile.nach === nach,
  )
  if (kandidaten.length === 0) return null
  const genau = kandidaten.find((zeile) => zeile.von === von)
  if (genau !== undefined) return genau
  if (von === null) {
    // Ohne Ausgangsstatus bleibt nur eine Zeile eindeutig. Mehrere Zeilen
    // unterscheiden sich gerade durch ihn (Q41/Q43/Q44).
    return kandidaten.length === 1 ? (kandidaten[0] ?? null) : null
  }
  return null
}

/** Die Zeile des nächtlichen Laufs zu einer Prüfung und einem Objekt. */
export function zeileFuerNachtlauf(
  pruefung: Pruefung,
  objekt: Objektart,
): Querschnittzeile | null {
  return (
    QUERSCHNITT.find(
      (zeile) =>
        zeile.pruefung === pruefung &&
        zeile.objekt === objekt &&
        zeile.nach === null &&
        zeile.nummer.startsWith('N'),
    ) ?? null
  )
}
