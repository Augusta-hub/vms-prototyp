/**
 * Tests für das **Lesen der Werte** aus einem Gherkin-Satz.
 *
 * Die Einheit entscheidet darüber, ob eine Zahl im Satz mit dem Befund
 * verglichen wird. „die 91 Lückentage" wurde als einheitenlos gelesen, weil die
 * Einheit im zusammengesetzten Wort steckt — der Satz galt deshalb als
 * unvergleichbar und das Szenario blieb ausstehend, obwohl die Fachlogik
 * rechnete. Diese Tests nageln die Lesart fest.
 */

import { describe, expect, it } from 'vitest'

import { leseWerte } from './werte'

const mengen = (satz: string) => leseWerte(satz).mengen

describe('Einheit einer Menge', () => {
  it('liest „546 Tage" als Tage', () => {
    expect(mengen('das Tagebudget von 546 Tagen')).toContainEqual({ wert: 546, einheit: 'tage' })
  })

  it('liest die Einheit aus der Zusammensetzung „91 Lückentage"', () => {
    expect(mengen('die 91 Lückentage verbrauchen Kalenderzeit, aber kein Fristbudget')).toContainEqual({
      wert: 91,
      einheit: 'tage',
    })
  })

  it('liest „18 Monate" als Monate', () => {
    expect(mengen('gilt die Grenze von 18 Monaten')).toContainEqual({ wert: 18, einheit: 'monate' })
  })

  it('liest „21,40 EUR" als Betrag', () => {
    expect(mengen('der Satz beträgt 21,40 EUR')).toContainEqual({ wert: 21.4, einheit: 'eur' })
  })

  it('hält Datumsbestandteile aus den Mengen heraus', () => {
    // 30.06.2026 darf nicht als drei Mengen erscheinen.
    expect(mengen('das Fristende ist der 30.06.2026')).toEqual([])
  })
})

describe('Datumsangaben', () => {
  it('liest ein deutsches Datum als ISO', () => {
    expect(leseWerte('das Fristende ist der 30.06.2026').datumsangaben).toContain('2026-06-30')
  })

  it('liest mehrere Daten in Reihenfolge des Auftretens', () => {
    expect(leseWerte('die Unterbrechung läuft vom 01.04.2026 bis zum 30.06.2026').datumsangaben).toEqual([
      '2026-04-01',
      '2026-06-30',
    ])
  })
})

describe('Genannte Prüfungen', () => {
  it('liest eine einzelne Prüfung', () => {
    expect(leseWerte('ist das Ergebnis der Prüfung P6 eine Warnung').pruefungen).toEqual(['P6'])
  })

  it('liest zwei genannte Prüfungen, ohne Doppelung', () => {
    expect(leseWerte('ist das Ergebnis der Prüfungen P9 und P10 eine Information').pruefungen).toEqual([
      'P9',
      'P10',
    ])
  })
})
