/**
 * Der Rechenweg aus SPEC 5.3.2 — Anzeige, Betroffenheit, Zusicherung.
 *
 * Der wichtigste Test steht zuerst: **ohne Anzeige kein Treffer.** Das ist die
 * einzige Stelle im ganzen Kapitel 5, an der eine fehlende Angabe *nicht* wie
 * ein Treffer wirkt (5.0 gegen 5.3.2). Wer sie „richtigstellt", sperrt jeden
 * Einsatzstart — und wer sie vergisst, lässt jeden Arbeitskampf durch. Deshalb
 * ist sie hier doppelt festgehalten: im Normalfall und in dem Fall, in dem
 * tatsächlich ein Arbeitskampf läuft, den niemand gemeldet hat.
 */

import { describe, expect, it } from 'vitest'
import { pruefeArbeitskampf, type Arbeitskampflage } from './p7Arbeitskampf'

function lage(teile: Partial<Arbeitskampflage> = {}): Arbeitskampflage {
  return {
    standort: 'Werk Süd',
    taetigkeit: 'Instandhaltung Stufe 3',
    anzeige: {
      standort: 'Werk Süd',
      zeitraum: { von: '2026-09-10', bis: '2026-09-20' },
      bereiche: [],
      bereicheDeckenTaetigkeit: null,
    },
    zusicherung: null,
    stichtag: '2026-09-15',
    zeitraum: null,
    ...teile,
  }
}

describe('Ohne Anzeige kein Treffer (SPEC 5.3.2, Grenzfall „Fehlende Angaben")', () => {
  it('ist eine Information, kein Treffer', () => {
    const ergebnis = pruefeArbeitskampf(lage({ anzeige: null }))
    expect(ergebnis.anzeigeVorhanden).toBe(false)
    expect(ergebnis.treffer).toBe(false)
    expect(ergebnis.adressaten).toEqual([])
  })

  it('nennt die Grenze der Regel in der Meldung', () => {
    // Die Regel ist nur so gut wie die Meldedisziplin des Entleihers (5.5.1).
    // Das gehört in den Befund, nicht nur in die Spezifikation: wer das Ergebnis
    // liest, muss wissen, was es **nicht** sagt.
    const ergebnis = pruefeArbeitskampf(lage({ anzeige: null }))
    expect(ergebnis.meldung).toMatch(/Meldedisziplin/)
    expect(ergebnis.meldung).toMatch(/einzige Ausnahme/)
  })
})

describe('Betroffenheit des Stichtags (SPEC 5.3.2, Schritt 2)', () => {
  it('trifft, wenn der Stichtag im Zeitraum der Anzeige liegt', () => {
    const ergebnis = pruefeArbeitskampf(lage())
    expect(ergebnis.betroffen).toBe(true)
    expect(ergebnis.betroffeneTage).toEqual(['2026-09-15'])
    expect(ergebnis.treffer).toBe(true)
    expect(ergebnis.milderung).toBeNull()
  })

  it('rechnet den **letzten** Tag der Anzeige mit', () => {
    // 5.3.2, Grenzfall „Tag genau auf der Grenze": der erste und der letzte Tag
    // sind betroffen.
    expect(pruefeArbeitskampf(lage({ stichtag: '2026-09-20' })).treffer).toBe(true)
    expect(pruefeArbeitskampf(lage({ stichtag: '2026-09-10' })).treffer).toBe(true)
  })

  it('trifft am Tag nach dem Ende der Anzeige nicht mehr', () => {
    const ergebnis = pruefeArbeitskampf(lage({ stichtag: '2026-09-21' }))
    expect(ergebnis.anzeigeVorhanden).toBe(true)
    expect(ergebnis.betroffen).toBe(false)
    expect(ergebnis.treffer).toBe(false)
  })

  it('behandelt eine Anzeige ohne Bis-Datum als bis auf Weiteres betroffen', () => {
    const ergebnis = pruefeArbeitskampf(
      lage({
        stichtag: '2027-03-01',
        anzeige: {
          standort: 'Werk Süd',
          zeitraum: { von: '2026-09-10', bis: null },
          bereiche: [],
          bereicheDeckenTaetigkeit: null,
        },
      }),
    )
    expect(ergebnis.offenesEnde).toBe(true)
    expect(ergebnis.treffer).toBe(true)
    expect(ergebnis.vermerke.join(' ')).toMatch(/nachzutragen/)
  })

  it('prüft bei einem Zeitraum jeden Tag, nicht nur die Ränder', () => {
    // Bei → `tendered` ist der Prüfzeitraum maßgeblich (5.3.2 Schritt 1). Die
    // Anzeige liegt **innen**: ohne tagesgenaue Prüfung bliebe sie unentdeckt.
    const ergebnis = pruefeArbeitskampf(
      lage({
        stichtag: null,
        zeitraum: { von: '2026-08-10', bis: '2026-08-20' },
        anzeige: {
          standort: 'Werk Süd',
          zeitraum: { von: '2026-08-12', bis: '2026-08-18' },
          bereiche: [],
          bereicheDeckenTaetigkeit: null,
        },
      }),
    )
    expect(ergebnis.treffer).toBe(true)
    expect(ergebnis.betroffeneTage).toHaveLength(7)
    expect(ergebnis.betroffeneTage[0]).toBe('2026-08-12')
  })
})

describe('Die Zusicherung nach § 11 Abs. 5 Satz 2 AÜG (SPEC 5.3.2, Schritt 3)', () => {
  it('macht aus dem Treffer eine Warnung', () => {
    const ergebnis = pruefeArbeitskampf(
      lage({ zusicherung: { datum: '2026-09-12', person: 'KE', decktStichtag: true } }),
    )
    expect(ergebnis.treffer).toBe(true)
    expect(ergebnis.milderung).toBe('zusicherung')
    expect(ergebnis.meldung).toMatch(/§ 11 Abs. 5 Satz 2/)
  })

  it('wirkt nicht, wenn sie den Stichtag nicht deckt', () => {
    const ergebnis = pruefeArbeitskampf(
      lage({ zusicherung: { datum: '2026-09-12', person: null, decktStichtag: false } }),
    )
    expect(ergebnis.milderung).toBeNull()
    expect(ergebnis.vermerke.join(' ')).toMatch(/deckt den Stichtag aber nicht/)
  })

  it('nennt im Treffer ohne Zusicherung die offenen Wege', () => {
    const ergebnis = pruefeArbeitskampf(lage())
    expect(ergebnis.meldung).toMatch(/Zusicherung des Entleihers oder ein späterer Start/)
    // Wer die Zusicherung abgeben darf, ist offene Frage 30 — das wird genannt
    // und nicht geraten (CLAUDE.md, Regel 5).
    expect(ergebnis.meldung).toMatch(/offene Frage 30/)
  })
})

describe('Nur ein Teil des Betriebs betroffen (SPEC 5.3.2, Grenzfall)', () => {
  it('mildert den Treffer zur Warnung, wenn die Bereiche die Tätigkeit nicht abdecken', () => {
    const ergebnis = pruefeArbeitskampf(
      lage({
        anzeige: {
          standort: 'Werk Süd',
          zeitraum: { von: '2026-09-10', bis: '2026-09-20' },
          bereiche: ['Montage'],
          bereicheDeckenTaetigkeit: false,
        },
      }),
    )
    expect(ergebnis.treffer).toBe(true)
    expect(ergebnis.milderung).toBe('teilbetroffen')
    expect(ergebnis.meldung).toMatch(/entscheidet der Entleiher/)
  })

  it('lässt die Zusicherung vorgehen — sie steht im Gesetz', () => {
    const ergebnis = pruefeArbeitskampf(
      lage({
        zusicherung: { datum: null, person: null, decktStichtag: true },
        anzeige: {
          standort: 'Werk Süd',
          zeitraum: { von: '2026-09-10', bis: '2026-09-20' },
          bereiche: ['Montage'],
          bereicheDeckenTaetigkeit: false,
        },
      }),
    )
    expect(ergebnis.milderung).toBe('zusicherung')
  })

  it('trifft voll, wenn die Anzeige keine Bereiche nennt', () => {
    // Ohne Bereichsangabe ist der Betrieb als Ganzes betroffen. Hier **nicht**
    // zu mildern ist der Unterschied zwischen einer Sperre und einem Einsatz im
    // bestreikten Betrieb.
    expect(pruefeArbeitskampf(lage()).milderung).toBeNull()
  })
})

describe('Ohne Stichtag und ohne Zeitraum wird nichts behauptet', () => {
  it('findet keinen betroffenen Tag und damit keinen Treffer', () => {
    const ergebnis = pruefeArbeitskampf(lage({ stichtag: null, zeitraum: null }))
    expect(ergebnis.anzeigeVorhanden).toBe(true)
    expect(ergebnis.betroffeneTage).toEqual([])
    expect(ergebnis.treffer).toBe(false)
  })
})
