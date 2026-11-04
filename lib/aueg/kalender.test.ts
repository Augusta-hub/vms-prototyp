/**
 * Die Fristenarithmetik aus SPEC 5.0 — die Festlegungen, auf die P9 sich
 * verlässt. Besonders „Grenztage zählen mit": ein Zeitraum von–bis umfasst
 * beide Randtage.
 */
import { describe, expect, it } from 'vitest'
import {
  folgetag,
  istTag,
  istVorOderGleich,
  liegtImZeitraum,
  tag,
  tageDesZeitraums,
  tagesdifferenz,
  tagVersetzt,
} from './kalender'

describe('Kalendertage (SPEC 5.0)', () => {
  it('nimmt nur Tage in der Form JJJJ-MM-TT an', () => {
    expect(istTag('2026-01-15')).toBe(true)
    expect(istTag('15.01.2026')).toBe(false)
    expect(istTag('2026-1-15')).toBe(false)
    expect(istTag(null)).toBe(false)
  })

  it('weist einen Tag zurück, den der Kalender nicht hat', () => {
    expect(istTag('2026-02-30')).toBe(false)
    expect(istTag('2026-13-01')).toBe(false)
    expect(() => tag('2026-02-30')).toThrow(/kein Kalendertag/)
  })

  it('kennt den 29. Februar nur im Schaltjahr', () => {
    expect(istTag('2028-02-29')).toBe(true)
    expect(istTag('2026-02-29')).toBe(false)
  })
})

describe('Tagesdifferenz (SPEC 5.0: Kalendertage, keine Rundung)', () => {
  it('zählt in Kalendertagen', () => {
    expect(tagesdifferenz('2026-01-01', '2026-01-31')).toBe(30)
    expect(tagesdifferenz('2026-12-31', '2026-12-31')).toBe(0)
  })

  it('wird negativ, wenn das Ende vor dem Beginn liegt', () => {
    expect(tagesdifferenz('2027-01-01', '2026-12-31')).toBe(-1)
  })

  it('rechnet über die Sommerzeitgrenze ohne Versatz', () => {
    // Letzter Sonntag im März 2026: 29.03. Ein Tag bleibt ein Tag.
    expect(tagesdifferenz('2026-03-28', '2026-03-30')).toBe(2)
    expect(folgetag('2026-03-28')).toBe('2026-03-29')
  })

  it('trägt die Vorlaufwerte aus 5.4.4 zum 31.12.2026', () => {
    // Die Stufen des nächtlichen Laufs N1: 90 / 30 / 14 Tage Restzeit.
    expect(tagesdifferenz('2026-10-02', '2026-12-31')).toBe(90)
    expect(tagesdifferenz('2026-12-01', '2026-12-31')).toBe(30)
    expect(tagesdifferenz('2026-12-17', '2026-12-31')).toBe(14)
    expect(tagesdifferenz('2027-01-01', '2026-12-31')).toBe(-1)
  })
})

describe('Tage eines Zeitraums', () => {
  it('schließt beide Randtage ein', () => {
    expect(tageDesZeitraums('2026-06-29', '2026-07-01')).toEqual([
      '2026-06-29',
      '2026-06-30',
      '2026-07-01',
    ])
  })

  it('ist leer, wenn das Ende vor dem Beginn liegt', () => {
    expect(tageDesZeitraums('2026-07-01', '2026-06-30')).toEqual([])
  })

  it('zählt einen einzelnen Tag als einen Tag', () => {
    expect(tageDesZeitraums('2026-03-01', '2026-03-01')).toEqual(['2026-03-01'])
  })

  it('geht über Monats- und Jahresgrenzen', () => {
    expect(tageDesZeitraums('2026-12-31', '2027-01-01')).toEqual(['2026-12-31', '2027-01-01'])
    expect(tagVersetzt('2026-12-31', 1)).toBe('2027-01-01')
    expect(tagVersetzt('2027-01-01', -1)).toBe('2026-12-31')
  })
})

describe('Lage eines Tages im Zeitraum', () => {
  it('schließt die Grenzen ein', () => {
    expect(liegtImZeitraum('2026-04-01', '2026-04-01', '2026-06-30')).toBe(true)
    expect(liegtImZeitraum('2026-06-30', '2026-04-01', '2026-06-30')).toBe(true)
    expect(liegtImZeitraum('2026-07-01', '2026-04-01', '2026-06-30')).toBe(false)
  })

  it('ordnet Tage nach dem Kalender, nicht nach dem Text', () => {
    expect(istVorOderGleich('2026-09-30', '2026-10-01')).toBe(true)
    expect(istVorOderGleich('2026-10-01', '2026-09-30')).toBe(false)
  })
})
