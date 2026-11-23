/**
 * Arbeitstage und Feiertage — SPEC **4.0**, „Was ein Arbeitstag ist".
 *
 * Was hier geprüft wird und **nirgends sonst**:
 *
 *  - dass die **Osterformel** stimmt: sie trägt sechs der siebzehn Feiertage,
 *    und eine Formel ohne Stützpunkte wäre eine Behauptung,
 *  - dass ein Feiertag **nur im richtigen Land** zählt — und dass ohne
 *    Bundesland nur die bundeseinheitlichen gelten (3.1, 4.0),
 *  - dass der **Buß- und Bettag** der Mittwoch vor dem 23. November ist, auch
 *    wenn der 23. selbst ein Mittwoch ist,
 *  - dass eine Frist über ein Wochenende und über Feiertage **hinwegzählt**,
 *  - dass der **Ausgangstag nicht mitzählt** (§ 187 Abs. 1 BGB).
 *
 * Alle Daten sind synthetisch (CLAUDE.md, Regel 3).
 */
import { describe, expect, it } from 'vitest'
import { tag } from '../aueg/kalender'
import {
  arbeitstageSpaeter,
  arbeitstageZwischen,
  feiertage,
  istArbeitstag,
  istFeiertag,
  ostersonntag,
} from './arbeitstage'

describe('Ostersonntag (gregorianische Osterformel)', () => {
  it('trifft bekannte Jahre', () => {
    expect(ostersonntag(2024)).toBe('2024-03-31')
    expect(ostersonntag(2025)).toBe('2025-04-20')
    expect(ostersonntag(2026)).toBe('2026-04-05')
    expect(ostersonntag(2027)).toBe('2027-03-28')
    expect(ostersonntag(2030)).toBe('2030-04-21')
    expect(ostersonntag(2038)).toBe('2038-04-25')
  })

  it('fällt immer auf einen Sonntag', () => {
    for (let jahr = 2024; jahr <= 2060; jahr += 1) {
      const datum = new Date(`${ostersonntag(jahr)}T00:00:00.000Z`)
      expect(datum.getUTCDay()).toBe(0)
    }
  })
})

describe('Feiertage je Land (4.0)', () => {
  it('rechnet die bewegten Feiertage 2026 aus Ostern', () => {
    // Ostersonntag 2026 ist der 5. April.
    const bundesweit = feiertage(2026)
    expect(bundesweit.get(tag('2026-04-03'))).toBe('Karfreitag')
    expect(bundesweit.get(tag('2026-04-06'))).toBe('Ostermontag')
    expect(bundesweit.get(tag('2026-05-14'))).toBe('Christi Himmelfahrt')
    expect(bundesweit.get(tag('2026-05-25'))).toBe('Pfingstmontag')
  })

  it('zählt ohne Bundesland nur die bundeseinheitlichen — es sind neun', () => {
    expect(feiertage(2026).size).toBe(9)
    expect(istFeiertag(tag('2026-11-01'))).toBe(false)
    expect(istFeiertag(tag('2026-10-03'))).toBe(true)
  })

  it('zählt Allerheiligen in Bayern und nicht in Berlin', () => {
    expect(istFeiertag(tag('2026-11-01'), 'BY')).toBe(true)
    expect(istFeiertag(tag('2026-11-01'), 'BE')).toBe(false)
  })

  it('zählt Fronleichnam im Westen und nicht im Norden', () => {
    // Ostersonntag 2026 + 60 Tage = 4. Juni.
    expect(istFeiertag(tag('2026-06-04'), 'NW')).toBe(true)
    expect(istFeiertag(tag('2026-06-04'), 'SH')).toBe(false)
  })

  it('zählt den Reformationstag im Norden und Osten', () => {
    expect(istFeiertag(tag('2026-10-31'), 'SN')).toBe(true)
    expect(istFeiertag(tag('2026-10-31'), 'HH')).toBe(true)
    expect(istFeiertag(tag('2026-10-31'), 'BY')).toBe(false)
  })

  it('zählt den Frauentag in Berlin und Mecklenburg-Vorpommern', () => {
    expect(istFeiertag(tag('2026-03-08'), 'BE')).toBe(true)
    expect(istFeiertag(tag('2026-03-08'), 'MV')).toBe(true)
    expect(istFeiertag(tag('2026-03-08'), 'BW')).toBe(false)
  })

  it('legt den Buß- und Bettag auf den Mittwoch vor dem 23. November', () => {
    // 2026: der 23. November ist ein Montag, der Mittwoch davor der 18.
    expect(istFeiertag(tag('2026-11-18'), 'SN')).toBe(true)
    // 2033: der 23. November ist selbst ein Mittwoch — dann gilt der 16.
    expect(istFeiertag(tag('2033-11-16'), 'SN')).toBe(true)
    expect(istFeiertag(tag('2033-11-23'), 'SN')).toBe(false)
    // Und nur in Sachsen.
    expect(istFeiertag(tag('2026-11-18'), 'TH')).toBe(false)
  })

  it('zählt Mariä Himmelfahrt im Saarland — in Bayern bleibt es offene Frage 59', () => {
    expect(istFeiertag(tag('2026-08-15'), 'SL')).toBe(true)
    expect(istFeiertag(tag('2026-08-15'), 'BY')).toBe(false)
  })
})

describe('Arbeitstag (4.0)', () => {
  it('schließt Samstag und Sonntag aus', () => {
    // 2026-11-21 ist ein Samstag, der 22. ein Sonntag.
    expect(istArbeitstag(tag('2026-11-21'))).toBe(false)
    expect(istArbeitstag(tag('2026-11-22'))).toBe(false)
    expect(istArbeitstag(tag('2026-11-23'))).toBe(true)
  })

  it('schließt den Feiertag des Landes aus, nicht den des Nachbarn', () => {
    expect(istArbeitstag(tag('2026-11-18'), 'SN')).toBe(false)
    expect(istArbeitstag(tag('2026-11-18'), 'TH')).toBe(true)
  })
})

describe('Fristen in Arbeitstagen (4.0)', () => {
  it('zählt den Ausgangstag nicht mit (§ 187 Abs. 1 BGB)', () => {
    // Montag + 1 Arbeitstag = Dienstag.
    expect(arbeitstageSpaeter(tag('2026-11-23'), 1)).toBe('2026-11-24')
  })

  it('zählt über das Wochenende hinweg', () => {
    // Freitag, 2026-11-20, + 1 Arbeitstag = Montag, 2026-11-23.
    expect(arbeitstageSpaeter(tag('2026-11-20'), 1)).toBe('2026-11-23')
    // Donnerstag + 3 Arbeitstage = Dienstag der Folgewoche.
    expect(arbeitstageSpaeter(tag('2026-11-19'), 3)).toBe('2026-11-24')
  })

  it('zählt über einen Landesfeiertag hinweg — und nur dort', () => {
    // Dienstag, 2026-11-17, + 2 Arbeitstage: in Sachsen fällt der Mittwoch
    // (Buß- und Bettag) aus, in Thüringen nicht.
    expect(arbeitstageSpaeter(tag('2026-11-17'), 2, 'SN')).toBe('2026-11-20')
    expect(arbeitstageSpaeter(tag('2026-11-17'), 2, 'TH')).toBe('2026-11-19')
  })

  it('gibt bei null oder negativen Tagen den Ausgangstag zurück', () => {
    expect(arbeitstageSpaeter(tag('2026-11-23'), 0)).toBe('2026-11-23')
    expect(arbeitstageSpaeter(tag('2026-11-23'), -3)).toBe('2026-11-23')
  })

  it('zählt den Abstand zwischen zwei Tagen in Arbeitstagen', () => {
    expect(arbeitstageZwischen(tag('2026-11-23'), tag('2026-11-24'))).toBe(1)
    // Freitag bis Montag ist **ein** Arbeitstag.
    expect(arbeitstageZwischen(tag('2026-11-20'), tag('2026-11-23'))).toBe(1)
    // Dienstag bis Freitag in Sachsen: Mittwoch ist Feiertag.
    expect(arbeitstageZwischen(tag('2026-11-17'), tag('2026-11-20'), 'SN')).toBe(2)
    expect(arbeitstageZwischen(tag('2026-11-17'), tag('2026-11-20'), 'TH')).toBe(3)
  })

  it('zählt rückwärts nicht — eine Stufe steigt nicht in die Vergangenheit', () => {
    expect(arbeitstageZwischen(tag('2026-11-24'), tag('2026-11-23'))).toBe(0)
    expect(arbeitstageZwischen(tag('2026-11-23'), tag('2026-11-23'))).toBe(0)
  })
})
