/**
 * Zusicherungen der Szenarien erfassen — die "Dann"-Schritte.
 *
 * Ein Teil der Zusicherungen ist maschinell auswertbar, sobald es einen Befund
 * gibt: die Ergebnisart (SPEC 5.5.2), der Status des Vorgangs (Kapitel 4), der
 * Protokolleintrag (5.4.7) und die gerechneten Werte (5.1, 5.2). Ein anderer
 * Teil sind fachliche Feststellungen in Prosa ("die Übersteuerung heilt die
 * Rechtslage nicht"). Die sind Spezifikation, nicht Zusicherung an ein
 * Rechenergebnis — sie bleiben als `fachaussage` erfasst und werden nicht
 * stillschweigend als erfuellt gemeldet.
 */

import { leseWerte, type GeleseneWerte } from './werte'

export type Erwartungsart =
  /** Ergebnisart einer Pruefung: Information, Warnung, Sperre (SPEC 5.5.2). */
  | 'ergebnisart'
  /** Status eines Vorgangs nach dem Uebergang (SPEC Kapitel 4). */
  | 'vorgangsstatus'
  /** Protokolleintrag mit Pruefung und Ergebnis (SPEC 5.4.7). */
  | 'protokolleintrag'
  /** Ein gerechneter Wert: Fristende, Tagebudget, angerechnete Dauer, Faelligkeit. */
  | 'berechneter_wert'
  /** Tagesgenaue Deckung eines Pruefzeitraums (SPEC 5.4.1). */
  | 'deckung'
  /** Kriterium der Konkretisierungspflicht K1 bis K5 (SPEC 5.3.3). */
  | 'kriterium'
  /** Pruefbarkeit: fehlende Daten wirken wie ein Treffer (SPEC 5.0). */
  | 'pruefbarkeit'
  /** Adressat, Benachrichtigung, Eskalationsstufe (SPEC 5.5.2 Nummer 6). */
  | 'adressierung'
  /** Eine Uebersteuerung wird zurueckgewiesen (SPEC 5.5.4). */
  | 'uebersteuerung_zurueckgewiesen'
  /** Datentrennung: was eine Meldung nicht enthalten darf (SPEC 2.3). */
  | 'sichtbarkeit'
  /** Rechtsfolge eines Treffers, z. B. Equal Pay ab dem ersten Tag. */
  | 'rechtsfolge'
  /** Fachliche Feststellung in Prosa, kein Rechenergebnis. */
  | 'fachaussage'

export interface Erwartung {
  art: Erwartungsart
  satz: string
  /** Ergebnisart, wo der Satz sie nennt. */
  ergebnisart: 'information' | 'warnung' | 'sperre' | 'treffer' | null
  werte: GeleseneWerte
}

const SIGNATUREN: ReadonlyArray<readonly [Erwartungsart, RegExp]> = [
  // Nur die **Zurückweisung**, nicht jeder Satz über eine Übersteuerung: das
  // frühere `Übersteuerung (?:wird|…)` fing auch „die Übersteuerung **wird** in
  // der Übersteuerungsübersicht des Betreibers geführt" (Q11) und verlangte
  // dann, dass kein Befund den Übergang vollzieht — das Gegenteil einer
  // wirksamen Übersteuerung (5.5.4, Invariante 5). Ebenso muss „Übergang" das
  // Wort „zurückgewiesen" tragen; „der Übergang wird am 15.12.2026 ausgelöst"
  // ist ein Auslöser, keine Zurückweisung.
  [
    'uebersteuerung_zurueckgewiesen',
    /Übersteuerung (?:wird )?zurückgewiesen|Übergang (?:wird|wegen) [^.]*zurückgewiesen/,
  ],
  ['protokolleintrag', /Protokolleintrag|Protokolleinträge|wird protokolliert|protokolliert\b|Prüfhistorie/],
  ['ergebnisart', /Ergebnis(?:se)? (?:der Prüfung|der Prüfungen|der Bewertung|des Prüfung)?.*(?:Information|Warnung|Sperre|Treffer)|ist eine (?:Information|Warnung|Sperre)|ist ein Treffer|ist (?:eine|das) Sperre|Einzelergebnis|Sammelergebnis|Ergebnis ist "/],
  ['kriterium', /Kriterium|Kriterien K\d/],
  ['pruefbarkeit', /nicht prüfbar|nicht ausführbar|wirkt (?:hier )?(?:nicht )?wie ein Treffer|nicht bildbar|nicht bestimmbar|wie "ja" gerechnet|wie "kein Eintrag" behandelt/],
  ['deckung', /gedeckt|deckt (?:keinen|nichts|den|mit)|umschließt/],
  ['berechneter_wert', /Kettenbeginn|Tagebudget|Fristbudget|angerechnete Dauer|Restbudget|Fristende|Fälligkeit|Rückschaufenster|Lückenbeginn|Lückenende|Prüfzeitraum|Dreimonatsfrist|beträgt \d+|zählt (?:jeder|einmal)|Zählgrundlage|zählwirksam|Zählwirksamkeit|Ergebnis der Bewertung ist "|Frist von \d+ Monaten|beträgt die Frist \d+|gilt die (?:Frist|Grenze|gesetzliche)|mit (?:höchstens )?\d+ Monaten gerechnet|Regelgrenze von \d+ Monaten|neue Kette beginnt|Zählung (?:nicht )?zurück|entsteht keine Überlassungskette/],
  ['vorgangsstatus', /Status (?:des|der) .* ist|entsteht kein|Status .* bleibt|Status .* unverändert|entstehen im Status|steht im Status|findet (?:der Übergang|nicht) statt|Übergang statt|erscheint im Einladungskreis/],
  ['adressierung', /adressiert|Adressat|erhält (?:eine|zusätzlich)|wird eskaliert|Eskalation|eskaliert|benachrichtigt|angezeigt|erreicht den|geht an|nennt der Kundenseite|wird dem MSP-Administrator angezeigt/],
  ['sichtbarkeit', /nennt (?:sie )?(?:den Katalog|die Einsätze|nicht)|unsichtbar|nicht offengelegt|keine Fremddaten|ohne Angaben zu fremden|nennt den Katalog des Standorts nicht/],
  ['rechtsfolge', /Equal Pay ab dem ersten|heilt (?:die Rechtslage|die Lücke) nicht|Rechtsfolge|nicht übersteuerbar|keine Genehmigungsfiktion|nicht mehr heilbar|letzte zulässige Überlassungstag|erster Tag mit Equal-Pay-Pflicht|offene(?:n|r)? Weg/],
]

/** Erfasst einen "Dann"-Schritt als Erwartung. */
export function erfasseErwartung(satz: string): Erwartung {
  const werte = leseWerte(satz)
  const art = SIGNATUREN.find(([, signatur]) => signatur.test(satz))?.[0] ?? 'fachaussage'
  return { art, satz, ergebnisart: leseErgebnisart(satz), werte }
}

function leseErgebnisart(satz: string): Erwartung['ergebnisart'] {
  // Die Verneinung gehoert dazu. "eine Warnung, keine Sperre" ist der Satz, mit
  // dem 5.5.5 fuer P6 und P11 entschieden hat, dass die Zusage warnt und nicht
  // sperrt — ohne die Ausnahme las der Lauf ihn als "Sperre" und machte aus der
  // richtigen Fachlogik ein rotes Szenario.
  // "statt einer Sperre" gehoert zur Verneinung wie "keine Sperre": SPEC 5.2.4
  // laesst eine Schaetzung den Uebergang zu und erzeugt "eine Warnung statt
  // einer Sperre" (Q36 in 5.5.5). Ohne die Ausnahme verlangte der Lauf dort
  // eine Sperre und machte aus der richtigen Fachlogik ein rotes Szenario.
  if (/\bSperre\b/.test(satz) && !/keine Sperre|statt einer Sperre/.test(satz)) return 'sperre'
  if (/\bWarnung\b/.test(satz) && !/keine Warnung/.test(satz)) return 'warnung'
  if (/\bTreffer\b/.test(satz) && !/kein Treffer|ohne Treffer/.test(satz)) return 'treffer'
  if (/\bInformation(?:en)?\b/.test(satz)) return 'information'
  return null
}

/** Gilt die Zusicherung als maschinell auswertbar, sobald ein Befund vorliegt? */
export function istAuswertbar(art: Erwartungsart): boolean {
  return (
    art === 'ergebnisart' ||
    art === 'vorgangsstatus' ||
    art === 'protokolleintrag' ||
    art === 'berechneter_wert' ||
    art === 'deckung' ||
    art === 'kriterium' ||
    art === 'uebersteuerung_zurueckgewiesen'
  )
}
