/**
 * Tests für die **Einordnung** einer Zusicherung — den Teil des Runners, der
 * entscheidet, ob ein „Dann"-Satz maschinell geprüft wird und wogegen.
 *
 * Warum es diese Tests gibt: zwei Fehleinordnungen sind nur aufgefallen, weil
 * eine parallel arbeitende Session alle Zusicherungen ohne das Überspringen von
 * cucumber durchgerechnet hat. Eine falsche Signatur macht aus richtiger
 * Fachlogik ein rotes Szenario — oder, schlimmer, aus einer ungeprüften
 * Aussage eine grüne. Beides ist hier festgenagelt.
 *
 * Die Sätze sind **wörtlich** aus `tests/aueg/*.feature` entnommen. Ändert sich
 * dort ein Satz, darf dieser Test rot werden; er ist die Gegenprobe zur
 * Signaturtabelle, nicht ihre Kopie.
 */

import { describe, expect, it } from 'vitest'

import { erfasseErwartung, istAuswertbar } from './erwartung'

describe('Einordnung der Ergebnisart', () => {
  // SPEC 5.5.5: für P6 und P11 ist bei der Zusage eine **Warnung** entschieden,
  // keine Sperre. Ohne die Verneinung las der Lauf "keine Sperre" als Sperre
  // und machte die richtige Fachlogik rot.
  it('liest „eine Warnung, keine Sperre" als Warnung', () => {
    expect(erfasseErwartung('ist das Ergebnis der Prüfung P6 eine Warnung, keine Sperre').ergebnisart).toBe('warnung')
    expect(erfasseErwartung('ist das Ergebnis der Prüfung P11 eine Warnung, keine Sperre').ergebnisart).toBe('warnung')
  })

  it('liest eine genannte Sperre weiter als Sperre', () => {
    expect(erfasseErwartung('ist das Ergebnis eine Sperre').ergebnisart).toBe('sperre')
  })

  it('liest „keine Warnung" nicht als Warnung', () => {
    expect(erfasseErwartung('ist das Ergebnis eine Information, keine Warnung').ergebnisart).toBe('information')
  })

  it('liest „kein Treffer" nicht als Treffer', () => {
    expect(erfasseErwartung('ist das Ergebnis kein Treffer').ergebnisart).not.toBe('treffer')
  })
})

describe('Signatur der zurückgewiesenen Übersteuerung', () => {
  // Die Zurückweisung verlangt, dass **kein** Befund den Übergang vollzieht.
  // Jeder andere Satz über eine Übersteuerung darf deshalb nicht hier landen —
  // sonst widerspricht die Auswertung der wirksamen Übersteuerung aus
  // SPEC 5.5.4, Invariante 5.
  it.each([
    'wird die Übersteuerung zurückgewiesen, weil die Prüfung P6 nicht übersteuerbar ist',
    'wird die Übersteuerung zurückgewiesen',
    'wird der Übergang wegen des Vier-Augen-Prinzips zurückgewiesen',
  ])('ordnet die Zurückweisung ein: %s', (satz) => {
    expect(erfasseErwartung(satz).art).toBe('uebersteuerung_zurueckgewiesen')
  })

  it.each([
    // Q11: die wirksame Übersteuerung wird geführt, nicht zurückgewiesen.
    'die Übersteuerung wird in der Übersteuerungsübersicht des Betreibers geführt',
    // Ein Auslöser, keine Zurückweisung.
    'der Übergang wird am 15.12.2026 ausgelöst',
  ])('ordnet keine Zurückweisung ein: %s', (satz) => {
    expect(erfasseErwartung(satz).art).not.toBe('uebersteuerung_zurueckgewiesen')
  })
})

describe('Signatur des berechneten Werts', () => {
  it.each([
    'die Unterbrechung ist zählwirksam',
    'die Unterbrechung ist nicht zählwirksam',
    // Grossgeschrieben und substantiviert — die Signatur muss beides fangen.
    'die Zählwirksamkeit trägt den Vermerk "vorläufig"',
    'das Ergebnis der Bewertung ist "Reset"',
    'das Ergebnis der Bewertung ist "keine Lücke"',
  ])('ordnet als berechneten Wert ein: %s', (satz) => {
    const erwartung = erfasseErwartung(satz)
    expect(erwartung.art).toBe('berechneter_wert')
    expect(istAuswertbar(erwartung.art)).toBe(true)
  })
})

describe('Signatur der Prüfbarkeit', () => {
  it.each([
    'ist die Prüfung P6 nicht prüfbar',
    'ist die Überlassungskette nicht bildbar',
    'ist die Zuschlagsstufe nicht bestimmbar',
    'wird die fehlende Angabe wie "ja" gerechnet',
  ])('ordnet als Prüfbarkeit ein: %s', (satz) => {
    expect(erfasseErwartung(satz).art).toBe('pruefbarkeit')
  })
})

describe('Prosa bleibt Prosa', () => {
  // Diese Sätze dürfen **nicht** maschinell geprüft werden: der Befund trägt
  // nichts, was ihnen entspricht. Würde eine Signatur sie fangen, wäre das
  // Szenario stillschweigend grün.
  it.each([
    'die Übersteuerung heilt die Rechtslage nicht',
    'die Zeiterfassung für den Unterbrechungszeitraum ist gesperrt',
    'der Vermerk wird bei der Wiederaufnahme endgültig',
  ])('lässt unausgewertet: %s', (satz) => {
    expect(istAuswertbar(erfasseErwartung(satz).art)).toBe(false)
  })
})
