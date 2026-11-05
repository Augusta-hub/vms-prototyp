/**
 * Tests für die **Auswertung** einer Zusicherung gegen die Befunde — den Teil
 * des Runners, der entscheidet, ob eine Zusicherung erfüllt, verletzt oder
 * ausstehend ist.
 *
 * Warum es diese Tests gibt: cucumber **überspringt** die Schritte nach einem
 * ausstehenden Schritt. Eine Zusicherung, die der Runner falsch auswertet,
 * bleibt dadurch unsichtbar, bis ein früherer Schritt grün wird — und wird dann
 * plötzlich rot, an einer Stelle, die niemand angefasst hat. Alle Fälle hier
 * sind so aufgefallen: beim Durchrechnen **aller** Zusicherungen ohne das
 * Überspringen.
 *
 * Die Sätze sind wörtlich aus `tests/aueg/*.feature`.
 */

import { describe, expect, it } from 'vitest'

import { werteAus } from './auswertung'
import { erfasseErwartung } from './erwartung'
import type { Befund } from './pruefwerk'

function befund(teile: Partial<Befund> = {}): Befund {
  return {
    pruefung: 'P3',
    ergebnisart: 'information',
    uebergangVollzogen: true,
    werte: {},
    adressaten: [],
    meldung: 'Befund für den Test.',
    ...teile,
  }
}

const werte = (eintraege: Record<string, string | number | null>, teile: Partial<Befund> = {}) =>
  [befund({ werte: eintraege, ...teile })]

function auswerten(satz: string, befunde: readonly Befund[]) {
  return werteAus(erfasseErwartung(satz), befunde)
}

describe('Fristen in Monaten (SPEC 5.1.2, 5.2.2)', () => {
  // Der Lauf verglich lange nur Tageszahlen und Datumsangaben. "gilt die
  // gesetzliche Regelfrist von 9 Monaten" blieb deshalb ausstehend, obwohl die
  // Fachlogik 9 rechnete — eine ungeprüfte Zusicherung.
  it('vergleicht eine genannte Monatsfrist mit dem Befund', () => {
    expect(
      auswerten('gilt die gesetzliche Regelfrist von 9 Monaten', werte({ fristMonate: 9 }))
        .ergebnis,
    ).toBe('erfuellt')
  })

  it('schlägt an, wenn der Befund eine andere Frist führt', () => {
    expect(
      auswerten('gilt die Frist von 6 Monaten', werte({ fristMonate: 9 })).ergebnis,
    ).toBe('verletzt')
  })

  it('bleibt ausstehend, wenn kein Befund eine Frist in Monaten führt', () => {
    expect(
      auswerten('gilt die Frist von 6 Monaten', werte({ tagebudget: 181 })).ergebnis,
    ).toBe('ausstehend')
  })

  it('vergleicht nur die Fristschlüssel, nicht jeden Wert des Befundes', () => {
    // Eine 9 irgendwo im Befund ist keine Frist von 9 Monaten.
    expect(
      auswerten('gilt die Frist von 9 Monaten', werte({ fristMonate: 6, lueckentage: 9 }))
        .ergebnis,
    ).toBe('verletzt')
  })

  it('liest die Verneinung: „es wird nicht mit 9 Monaten gerechnet"', () => {
    // SPEC 5.2.2 Fall 1: ohne Verleihertarif gilt Equal Pay ab dem ersten Tag —
    // **nicht** die Regelfrist. Der Befund führt 0.
    const satz =
      'es wird nicht mit 9 Monaten gerechnet, weil die Abweichung den Tarifvertrag voraussetzt'
    expect(auswerten(satz, werte({ fristMonate: 0 })).ergebnis).toBe('erfuellt')
    expect(auswerten(satz, werte({ fristMonate: 9 })).ergebnis).toBe('verletzt')
  })

  it('fängt „wird mit höchstens 15 Monaten gerechnet" (Fall 6)', () => {
    expect(
      auswerten('wird mit höchstens 15 Monaten gerechnet', werte({ fristMonate: 15 })).ergebnis,
    ).toBe('erfuellt')
  })

  it('fängt „beträgt die Frist 0 Monate" (Fall 1)', () => {
    expect(
      auswerten('beträgt die Frist 0 Monate', werte({ fristMonate: 0 })).ergebnis,
    ).toBe('erfuellt')
  })
})

describe('Die Überlassungskette ist kein Vorgang', () => {
  // „es entsteht keine Überlassungskette bei diesem Kunden" sagt nichts über den
  // Statusübergang: der Übergang nach `terminatedEarly` findet statt, nur
  // entsteht kein Überlassungstag (SPEC 5.1.5). Die Signatur `entsteht kein`
  // der Art `vorgangsstatus` meint eine Einladung oder einen Einsatz, der nicht
  // entsteht — eine Kette ist keiner von beiden.
  const satz = 'es entsteht keine Überlassungskette bei diesem Kunden'

  it('ist erfüllt, wenn der Befund keinen Kettenbeginn führt', () => {
    expect(
      auswerten(satz, werte({ kettenbeginn: null, angerechneteDauer: 0 })).ergebnis,
    ).toBe('erfuellt')
  })

  it('ist verletzt, wenn der Befund einen Kettenbeginn nennt', () => {
    expect(auswerten(satz, werte({ kettenbeginn: '2026-03-01' })).ergebnis).toBe('verletzt')
  })

  it('verlangt nicht, dass der Übergang unterbleibt', () => {
    // Der vollzogene Übergang darf die Zusicherung nicht verletzen.
    expect(
      auswerten(satz, werte({ kettenbeginn: null }, { uebergangVollzogen: true })).ergebnis,
    ).toBe('erfuellt')
  })

  it('bleibt ausstehend, wenn kein Befund den Kettenbeginn führt', () => {
    expect(auswerten(satz, werte({ tagebudget: 546 })).ergebnis).toBe('ausstehend')
  })
})

describe('Ergebnisart mit Verneinung', () => {
  it('liest „eine Warnung statt einer Sperre" als Warnung (SPEC 5.2.4, Q36)', () => {
    // Eine Schätzung lässt den Übergang zu. Ohne die Ausnahme verlangte der Lauf
    // hier eine Sperre.
    expect(
      auswerten(
        'das Ergebnis der Prüfung P4 ist eine Warnung statt einer Sperre',
        [befund({ pruefung: 'P4', ergebnisart: 'warnung' })],
      ).ergebnis,
    ).toBe('erfuellt')
  })

  it('verlangt die Sperre weiter, wo der Satz sie ohne Einschränkung nennt', () => {
    expect(
      auswerten('ist das Ergebnis der Prüfung P4 eine Sperre', [
        befund({ pruefung: 'P4', ergebnisart: 'warnung' }),
      ]).ergebnis,
    ).toBe('verletzt')
  })
})
