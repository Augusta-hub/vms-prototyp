/**
 * Die Anbindung an Q04 und Q06: der Wert, den die Statusmodelle als
 * `hasAcceptedValidPermit` erwarten, wird gerechnet und nicht gesetzt.
 */
import { describe, expect, it } from 'vitest'
import { hatAnerkannteGueltigeErlaubnis, hatErlaubnisAmStichtag } from './anbindung'
import type { Erlaubnissatz } from './regeln/p9Erlaubnis'

function satz(abweichung: Partial<Erlaubnissatz> = {}): Erlaubnissatz {
  return {
    id: 'EP-1',
    art: 'fixedTerm',
    gueltigVon: '2026-01-01',
    gueltigBis: '2026-12-31',
    anerkennung: 'accepted',
    urkunde: true,
    datei: true,
    vorgaenger: null,
    ...abweichung,
  }
}

describe('hasAcceptedValidPermit für Q04 und Q06 (SPEC 4.7, 5.4.1)', () => {
  it('ist wahr, wenn die Erlaubnis den ganzen Zeitraum deckt', () => {
    expect(
      hatAnerkannteGueltigeErlaubnis([satz()], { von: '2026-03-01', bis: '2026-03-31' }),
    ).toBe(true)
  })

  it('ist falsch, wenn die Erlaubnis vor dem Ende der Angebotsfrist abläuft', () => {
    // Q06: Prüfzeitraum ist der Tag des Übergangs bis zur Angebotsfrist (5.0).
    // Der Stichtag allein würde die Einladung durchlassen.
    expect(hatErlaubnisAmStichtag([satz()], '2026-12-15')).toBe(true)
    expect(
      hatAnerkannteGueltigeErlaubnis([satz()], { von: '2026-12-15', bis: '2027-01-31' }),
    ).toBe(false)
  })

  it('ist falsch bei ausstehender Anerkennung (5.4.1, Schritt 4)', () => {
    expect(hatErlaubnisAmStichtag([satz({ anerkennung: 'submitted' })], '2026-03-01')).toBe(false)
  })

  it('ist falsch ohne hinterlegte Urkunde (5.4.5)', () => {
    expect(hatErlaubnisAmStichtag([satz({ urkunde: false })], '2026-03-01')).toBe(false)
  })

  it('ist falsch ohne jeden Erlaubnissatz (5.4.6)', () => {
    expect(hatErlaubnisAmStichtag([], '2026-03-01')).toBe(false)
  })

  it('ist falsch bei einer Lücke mitten im Zeitraum (5.4.1, Schritt 3)', () => {
    const saetze = [
      satz({ gueltigBis: '2026-06-30' }),
      satz({ id: 'EP-2', gueltigVon: '2026-07-02', gueltigBis: '2026-12-31' }),
    ]
    expect(hatAnerkannteGueltigeErlaubnis(saetze, { von: '2026-06-01', bis: '2026-07-31' })).toBe(
      false,
    )
  })

  it('ist wahr bei unbefristeter Erlaubnis ab dem Beginn (5.4.1, Schritt 6)', () => {
    const unbefristet = satz({ art: 'unlimited', gueltigVon: '2024-07-01', gueltigBis: null })
    expect(
      hatAnerkannteGueltigeErlaubnis([unbefristet], { von: '2027-01-01', bis: '2027-12-31' }),
    ).toBe(true)
  })
})
