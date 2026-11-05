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
  /**
   * Weitere Prüfungen, die **dieselbe** Zeile in 4.7 nennt. Q27 führt „P1, P3",
   * Q43 und Q44 führen „P9, P10": der Übergang wird von beiden Prüfungen
   * zugleich beurteilt, und sein Ergebnis ist das strengste der beiden
   * (5.5.2 Nr. 2). Fehlt einer von ihnen der Rechenweg, ist der Übergang nicht
   * beurteilt — nicht halb beurteilt.
   */
  readonly weiterePruefungen?: readonly Pruefung[]
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
  /**
   * Zeile Q26 trägt **zwei** Werte (4.7, geändert in 5.5.5): „Sperre, wenn das
   * Fristende am Wiederaufnahmetag bereits erreicht ist; Warnung, wenn es im
   * geplanten Restzeitraum liegt, aber noch nicht erreicht ist." Dieser Wert
   * gilt, wenn der **Stichtag** hinter dem Fristende liegt; `trefferart` gilt
   * für den anderen Fall.
   */
  readonly trefferartStichtagErreicht?: Ergebnisart
  /**
   * Ergebnisart, wenn der Prüfung die **Tatsachengrundlage** fehlt. 4.7 führt
   * Q12 und Q15 mit „Warnung bei Treffer, **Sperre** bei fehlender Erklärung"
   * (geändert in 5.5.5): der Treffer der Drehtürklausel ist keine Sperre — die
   * Rechtsfolge ist Equal Pay ab dem ersten Tag —, die fehlende Erklärung
   * schon, weil dann die Tatsachengrundlage fehlt und ein zumutbarer Weg
   * offensteht (5.5.2 Nr. 5). Ohne diesen Wert gilt `trefferart`.
   */
  readonly trefferartOhneGrundlage?: Ergebnisart
  /**
   * Die Sperre dieser Zeile ist **nicht übersteuerbar** (5.3.6, Tabelle
   * „Dokumentierte Ausnahme"): bei P6, P7 und P8 wird der Mangel nachgetragen,
   * nicht übersteuert. Die Szenarien dazu erwarten den **zurückgewiesenen**
   * Versuch (4.7, Ableitungsmuster, Regel 1).
   */
  readonly nichtUebersteuerbar?: true
  /**
   * Die Zeile stellt **fest**, sie sieht nicht voraus: die Zeiten sind erbracht
   * oder der Vorgang wird abgeschlossen (5.5.5 zu Q27, Q33 und Q35:
   * „Abschlussstand, Dokumentationszweck", „Die Zeiten sind **erbracht**").
   * Die Vorlaufschwellen aus 5.1.6 greifen hier nicht — sie warnen vor einer
   * Überlassung, die noch kommt, und davor ist hier nichts mehr.
   */
  readonly rueckschau?: true
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
    nummer: 'Q03',
    objekt: 'bedarfsanfrage',
    von: 'submitted',
    nach: 'approved',
    pruefung: 'P1',
    gegenstand:
      'angefragter Zeitraum länger als die Höchstüberlassungsdauer (ohne Person)',
    // „Ohne Person gibt es keine Kette; die Aussage ist eine Rechnung über den
    // angefragten Zeitraum, keine Feststellung über eine Überlassung" (5.5.5).
    trefferart: 'information',
    specReference: 'SPEC 4.7 Q03; 5.1.3',
  },
  {
    nummer: 'Q07',
    objekt: 'profilvorschlag',
    von: 'submitted',
    nach: 'reviewed',
    pruefung: 'P1',
    gegenstand:
      'bisher angerechnete Dauer dieser Person bei diesem Kunden; Warnschwelle aus 5.1',
    trefferart: 'warnung',
    specReference: 'SPEC 4.7 Q07; 5.1.6',
  },
  {
    nummer: 'Q11',
    objekt: 'profilvorschlag',
    von: null,
    nach: 'accepted',
    pruefung: 'P1',
    gegenstand: 'Höchstüberlassungsdauer würde im angefragten Zeitraum überschritten',
    trefferart: 'sperre',
    specReference: 'SPEC 4.7 Q11',
  },
  {
    nummer: 'Q14',
    objekt: 'einsatz',
    von: null,
    nach: 'planned',
    pruefung: 'P1',
    gegenstand: '`maxDurationEndDate` liegt vor dem geplanten Ende',
    trefferart: 'sperre',
    specReference: 'SPEC 4.7 Q14',
  },
  {
    nummer: 'Q23',
    objekt: 'einsatz',
    von: 'planned',
    nach: 'active',
    pruefung: 'P1',
    gegenstand: 'Fristende bereits erreicht',
    trefferart: 'sperre',
    specReference: 'SPEC 4.7 Q23',
  },
  {
    nummer: 'Q24',
    objekt: 'einsatz',
    von: 'active',
    nach: 'interrupted',
    pruefung: 'P2',
    gegenstand: 'Unterbrechung wird mit Beginn und Grund erfasst',
    trefferart: 'information',
    specReference: 'SPEC 4.7 Q24; 5.1.4',
  },
  {
    nummer: 'Q25',
    objekt: 'einsatz',
    von: 'interrupted',
    nach: 'active',
    pruefung: 'P2',
    gegenstand:
      'Unterbrechungsdauer über der Schwelle aus 5.1 — Zählung wird zurückgesetzt',
    trefferart: 'information',
    specReference: 'SPEC 4.7 Q25; 5.1.4',
  },
  {
    nummer: 'Q26',
    objekt: 'einsatz',
    von: 'interrupted',
    nach: 'active',
    pruefung: 'P1',
    gegenstand: 'Neuberechnung von `maxDurationEndDate` nach der Unterbrechung',
    // „Warnung, wenn das Fristende im geplanten Restzeitraum liegt, aber noch
    // nicht erreicht ist" (4.7, geändert in 5.5.5).
    trefferart: 'warnung',
    // „Sperre, wenn das Fristende am ersten Wiederaufnahmetag bereits erreicht
    // ist": `interrupted` → `active` ist ein Überlassungsbeginn wie
    // `planned` → `active`, und dort sperrt Q23.
    trefferartStichtagErreicht: 'sperre',
    specReference: 'SPEC 4.7 Q26; 5.5.5, Tabelle „Geändert"',
  },
  {
    nummer: 'Q27',
    objekt: 'einsatz',
    von: null,
    nach: 'completed',
    pruefung: 'P1',
    // 4.7 führt Q27 mit „P1, P3": der Abschlussstand **beider** Fristen wird
    // festgeschrieben.
    weiterePruefungen: ['P3'],
    gegenstand: 'Abschlussstand der Fristen wird festgeschrieben',
    trefferart: 'information',
    rueckschau: true,
    specReference: 'SPEC 4.7 Q27; 5.5.5',
  },
  {
    nummer: 'Q27',
    objekt: 'einsatz',
    von: null,
    nach: 'terminatedEarly',
    pruefung: 'P1',
    // 4.7 führt Q27 mit „P1, P3": der Abschlussstand **beider** Fristen wird
    // festgeschrieben.
    weiterePruefungen: ['P3'],
    gegenstand: 'Abschlussstand der Fristen wird festgeschrieben',
    trefferart: 'information',
    rueckschau: true,
    specReference: 'SPEC 4.7 Q27; 5.5.5',
  },
  {
    nummer: 'Q28',
    objekt: 'verlaengerung',
    von: 'requested',
    nach: 'approved',
    pruefung: 'P1',
    gegenstand: 'Fristwirkung des neuen Endes für die Kundenseite sichtbar',
    trefferart: 'warnung',
    specReference: 'SPEC 4.7 Q28',
  },
  {
    nummer: 'Q30',
    objekt: 'verlaengerung',
    von: 'approved',
    nach: 'effective',
    pruefung: 'P1',
    gegenstand: '`newEndDate` nach `maxDurationEndDate`',
    trefferart: 'sperre',
    specReference: 'SPEC 4.7 Q30; 4.3.2',
  },
  {
    nummer: 'Q33',
    objekt: 'stundenzettel',
    von: 'recorded',
    nach: 'submitted',
    pruefung: 'P1',
    gegenstand: 'Zeitpositionen nach `maxDurationEndDate` enthalten',
    trefferart: 'warnung',
    rueckschau: true,
    specReference: 'SPEC 4.7 Q33; 5.5.5',
  },
  {
    nummer: 'Q35',
    objekt: 'stundenzettel',
    von: 'inApproval',
    nach: 'approved',
    pruefung: 'P1',
    gegenstand: 'Zeiten nach Fristende sollen genehmigt werden',
    // „Warnung mit Pflicht-Eskalation an `MA`" (4.7, geändert in 5.5.5): die
    // Zeiten sind erbracht, eine Sperre verhindert keine Überlassung mehr.
    trefferart: 'warnung',
    rueckschau: true,
    specReference: 'SPEC 4.7 Q35; 5.5.5, Tabelle „Geändert"',
  },
  {
    nummer: 'N2',
    objekt: 'einsatz',
    von: null,
    nach: null,
    pruefung: 'P1',
    gegenstand: '`maxDurationEndDate` innerhalb des Vorlaufs oder erreicht',
    // Der nächtliche Lauf erzeugt keine Sperre (5.5.1 c).
    trefferart: 'warnung',
    specReference: 'SPEC 5.5.1, Zeile N2; 5.1.6',
  },
  {
    nummer: 'N6',
    objekt: 'einsatz',
    von: null,
    nach: null,
    pruefung: 'P2',
    gegenstand: 'Unterbrechung überschreitet die Drei-Monats-Schwelle',
    trefferart: 'information',
    specReference: 'SPEC 5.5.1, Zeile N6; 5.1.4',
  },
  {
    nummer: 'Q08',
    objekt: 'profilvorschlag',
    von: 'submitted',
    nach: 'reviewed',
    pruefung: 'P6',
    gegenstand:
      'Vorbeschäftigung beim Entleiher oder im Konzern innerhalb der Frist aus 5.3',
    trefferart: 'warnung',
    // 5.3.1, „Wenn Daten fehlen": am Profilvorschlag → `reviewed` ist die
    // fehlende Erklärung eine **Warnung** mit Nennung des fehlenden Feldes.
    trefferartOhneGrundlage: 'warnung',
    nichtUebersteuerbar: true,
    specReference: 'SPEC 4.7 Q08; 5.3.1',
  },
  {
    nummer: 'Q09',
    objekt: 'profilvorschlag',
    von: 'submitted',
    nach: 'reviewed',
    pruefung: 'P11',
    gegenstand: '`employmentStatusWithSupplier = employed` oder Zusage dazu',
    trefferart: 'warnung',
    specReference: 'SPEC 4.7 Q09; 5.3.4',
  },
  {
    nummer: 'Q12',
    objekt: 'profilvorschlag',
    von: null,
    nach: 'accepted',
    pruefung: 'P6',
    gegenstand:
      'Drehtürklausel greift (Rechtsfolge: Equal Pay ab dem ersten Überlassungstag, 5.3.1)',
    trefferart: 'warnung',
    trefferartOhneGrundlage: 'sperre',
    nichtUebersteuerbar: true,
    specReference: 'SPEC 4.7 Q12; 5.5.5, Tabelle „Geändert"',
  },
  {
    nummer: 'Q13',
    objekt: 'profilvorschlag',
    von: null,
    nach: 'accepted',
    pruefung: 'P11',
    gegenstand:
      'kein Arbeitsverhältnis beim Verleiher; Prüfzeitpunkt ist der erste Überlassungstag (5.3.4)',
    // Geändert in 5.5.5: die Sperre steht in Q47.
    trefferart: 'warnung',
    specReference: 'SPEC 4.7 Q13; 5.5.5, Tabelle „Geändert"',
  },
  {
    nummer: 'Q15',
    objekt: 'einsatz',
    von: null,
    nach: 'planned',
    pruefung: 'P6',
    gegenstand:
      'Drehtürklausel greift (Rechtsfolge: Equal Pay ab dem ersten Überlassungstag, 5.3.1)',
    trefferart: 'warnung',
    trefferartOhneGrundlage: 'sperre',
    nichtUebersteuerbar: true,
    specReference: 'SPEC 4.7 Q15; 5.5.5, Tabelle „Geändert"',
  },
  {
    nummer: 'Q17',
    objekt: 'einsatz',
    von: null,
    nach: 'planned',
    pruefung: 'P11',
    gegenstand:
      'Arbeitsverhältnis beim Verleiher besteht; Prüfzeitpunkt ist der erste Überlassungstag (5.3.4)',
    trefferart: 'warnung',
    specReference: 'SPEC 4.7 Q17; 5.5.5, Tabelle „Geändert"',
  },
  {
    nummer: 'Q47',
    objekt: 'einsatz',
    von: 'planned',
    nach: 'active',
    pruefung: 'P11',
    gegenstand:
      '`employmentStatusWithSupplier = employed` und `employedSince` ≤ erster Überlassungstag',
    // Neu in 5.5.5: trägt die Sperre, die aus Q13 und Q17 entfernt wurde, an
    // den richtigen Zeitpunkt.
    trefferart: 'sperre',
    specReference: 'SPEC 4.7 Q47; 5.5.5, Tabelle „Neu"',
  },
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
  // Eine Zeile ohne Ausgangsstatus schreibt 4.7 als „→ accepted" oder
  // „→ planned": sie gilt dem Übergang **unabhängig** vom Ausgangsstatus
  // (Q11, Q14, Q16, Q27). Nennt der Vorgang einen Ausgangsstatus, zu dem es
  // keine eigene Zeile gibt, ist das diese Zeile — nicht „keine".
  const ohneAusgangsstatus = kandidaten.filter((zeile) => zeile.von === null)
  return ohneAusgangsstatus.length === 1 ? (ohneAusgangsstatus[0] ?? null) : null
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
