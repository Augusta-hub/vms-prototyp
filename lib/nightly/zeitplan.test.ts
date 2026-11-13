/**
 * Der Zeitplan des nächtlichen Laufs (SPEC 5.5.1, „Zeitplan des Laufs").
 *
 * Geprüft wird die Rechnung ohne Datenbank: Fälligkeit in der Zeitzone des
 * Betreibers, der Stichtag als Kalendertag **dieser** Zone und die Lücke
 * zwischen zwei Läufen. Die Sommerzeit steht dabei im Mittelpunkt — sie ist
 * der Fall, an dem eine Zeitrechnung scheitert, und sie trifft in Deutschland
 * jedes Jahr zwei Nächte.
 */

import { describe, expect, it } from 'vitest'
import { REGELWERK } from '../aueg/regelwerk'
import { faelligkeitDes, laufstand, stichtagAm } from './zeitplan'

const PLAN = REGELWERK.lauf
const tag = (wert: string): Date => new Date(`${wert}T00:00:00.000Z`)

describe('Festwerte (5.5.1)', () => {
  it('nimmt die Werte aus dem Regelwerk und nicht aus dem Dienst', () => {
    expect(PLAN.uhrzeit).toBe('03:00')
    expect(PLAN.zeitzone).toBe('Europe/Berlin')
  })
})

describe('Stichtag als Kalendertag der Zone (5.5.1)', () => {
  it('liest den Tag in Europe/Berlin, nicht nach Weltzeit', () => {
    // 23:30 Weltzeit ist in Berlin schon der nächste Tag (Winterzeit, +1).
    expect(stichtagAm(new Date('2026-11-12T23:30:00.000Z'), PLAN)).toEqual(tag('2026-11-13'))
    // Und 22:30 Weltzeit im Sommer (+2) ebenso.
    expect(stichtagAm(new Date('2026-07-12T22:30:00.000Z'), PLAN)).toEqual(tag('2026-07-13'))
  })

  it('liest 00:30 Weltzeit noch als denselben Tag', () => {
    expect(stichtagAm(new Date('2026-11-13T00:30:00.000Z'), PLAN)).toEqual(tag('2026-11-13'))
  })
})

describe('Fälligkeit (5.5.1)', () => {
  it('ist 03:00 Berliner Zeit — im Winter 02:00 Weltzeit', () => {
    expect(faelligkeitDes(tag('2026-11-13'), PLAN).toISOString()).toBe('2026-11-13T02:00:00.000Z')
  })

  it('ist im Sommer 01:00 Weltzeit — dieselbe Wanduhrzeit, anderer Versatz', () => {
    expect(faelligkeitDes(tag('2026-07-13'), PLAN).toISOString()).toBe('2026-07-13T01:00:00.000Z')
  })

  it('trägt über die Umstellung auf Sommerzeit', () => {
    // In der Nacht zum 2026-03-29 springt die Uhr von 02:00 auf 03:00. 03:00
    // Berliner Zeit gibt es an diesem Tag, und zwar als 01:00 Weltzeit.
    expect(faelligkeitDes(tag('2026-03-29'), PLAN).toISOString()).toBe('2026-03-29T01:00:00.000Z')
    // Am Tag davor gilt noch die Winterzeit.
    expect(faelligkeitDes(tag('2026-03-28'), PLAN).toISOString()).toBe('2026-03-28T02:00:00.000Z')
  })

  it('trägt über die Umstellung auf Winterzeit', () => {
    // In der Nacht zum 2026-10-25 springt die Uhr von 03:00 auf 02:00 zurück.
    expect(faelligkeitDes(tag('2026-10-25'), PLAN).toISOString()).toBe('2026-10-25T02:00:00.000Z')
    expect(faelligkeitDes(tag('2026-10-24'), PLAN).toISOString()).toBe('2026-10-24T01:00:00.000Z')
  })

  it('legt eine Uhrzeit, die es in der Umstellungsnacht nicht gibt, hinter den Sprung', () => {
    // In der Nacht zum 2026-03-29 springt die Uhr von 02:00 auf 03:00: 02:30
    // gibt es an diesem Tag nicht. Der Lauf fällt dann **hinter** den Sprung
    // (03:30), nicht davor — er ist lieber eine Stunde später als eine Stunde
    // früher als beabsichtigt. Der Versatz wird dafür zweimal gelesen: einmal
    // geschätzt, einmal am gefundenen Zeitpunkt bestätigt.
    const plan = { uhrzeit: '02:30', zeitzone: 'Europe/Berlin' }
    expect(faelligkeitDes(tag('2026-03-29'), plan).toISOString()).toBe('2026-03-29T01:30:00.000Z')
    // Eine halbe Stunde davor liegt noch in der Winterzeit und ist unberührt.
    expect(
      faelligkeitDes(tag('2026-03-29'), { ...plan, uhrzeit: '01:30' }).toISOString(),
    ).toBe('2026-03-29T00:30:00.000Z')
  })

  it('nimmt eine andere Uhrzeit aus der Konfiguration an', () => {
    const plan = { uhrzeit: '23:15', zeitzone: 'Europe/Berlin' }
    expect(faelligkeitDes(tag('2026-11-13'), plan).toISOString()).toBe('2026-11-13T22:15:00.000Z')
  })

  it('behandelt eine unleserliche Uhrzeit als Mitternacht', () => {
    // Keine Ausnahme: der Lauf fällt nicht aus, weil ein Wert krumm ist — er
    // wird früher fällig, und das ist die mildere Folge.
    const plan = { uhrzeit: 'morgens', zeitzone: 'Europe/Berlin' }
    expect(faelligkeitDes(tag('2026-11-13'), plan).toISOString()).toBe('2026-11-12T23:00:00.000Z')
  })
})

describe('Fälligkeit des heutigen Stichtags (5.5.1)', () => {
  // „Stichtag ist der Tag des Laufs": der Stichtag ist **immer** der heutige
  // Kalendertag der Zone. Vor der Fälligkeitszeit ist sein Lauf nur noch nicht
  // dran — er wird nicht zum Lauf von gestern.
  it('ist vor der Fälligkeitszeit nicht fällig, der Stichtag aber schon heute', () => {
    // 01:00 Weltzeit = 02:00 Berliner Zeit, also vor 03:00.
    const stand = laufstand({
      jetzt: new Date('2026-11-13T01:00:00.000Z'),
      letzterStichtag: tag('2026-11-12'),
      zeitplan: PLAN,
    })
    expect(stand.stichtag).toEqual(tag('2026-11-13'))
    expect(stand.faellig).toBe(false)
    expect(stand.offen).toBe(false)
    // Solange er nicht fällig ist, ist seine eigene Fälligkeit die nächste.
    expect(stand.naechsteFaelligkeit.toISOString()).toBe('2026-11-13T02:00:00.000Z')
  })

  it('ist ab der Fälligkeitszeit fällig und offen', () => {
    const stand = laufstand({
      jetzt: new Date('2026-11-13T02:00:00.000Z'),
      letzterStichtag: tag('2026-11-12'),
      zeitplan: PLAN,
    })
    expect(stand.stichtag).toEqual(tag('2026-11-13'))
    expect(stand.faellig).toBe(true)
    expect(stand.offen).toBe(true)
  })
})

describe('Lücke zwischen zwei Läufen (5.5.1, `missedRun`)', () => {
  const jetzt = new Date('2026-11-13T08:00:00.000Z')

  it('nennt die Tage zwischen dem letzten Lauf und heute', () => {
    const stand = laufstand({ jetzt, letzterStichtag: tag('2026-11-09'), zeitplan: PLAN })
    expect(stand.stichtag).toEqual(tag('2026-11-13'))
    expect(stand.ausgefallen).toEqual([
      tag('2026-11-10'),
      tag('2026-11-11'),
      tag('2026-11-12'),
    ])
    expect(stand.ausgefalleneTage).toBe(3)
    expect(stand.offen).toBe(true)
  })

  it('zählt den heutigen Stichtag nicht zu den ausgefallenen — er ist offen', () => {
    const stand = laufstand({ jetzt, letzterStichtag: tag('2026-11-12'), zeitplan: PLAN })
    expect(stand.ausgefallen).toEqual([])
    expect(stand.ausgefalleneTage).toBe(0)
    expect(stand.offen).toBe(true)
  })

  it('meldet nach dem heutigen Lauf nichts Offenes', () => {
    const stand = laufstand({ jetzt, letzterStichtag: tag('2026-11-13'), zeitplan: PLAN })
    expect(stand.offen).toBe(false)
    expect(stand.ausgefalleneTage).toBe(0)
    expect(stand.naechsteFaelligkeit.toISOString()).toBe('2026-11-14T02:00:00.000Z')
  })

  it('nennt ohne verzeichneten Lauf keine Lücke', () => {
    // Seit wann das System laufen sollte, weiß es nicht. Eine geratene Lücke
    // wäre schlimmer als keine.
    const stand = laufstand({ jetzt, letzterStichtag: null, zeitplan: PLAN })
    expect(stand.ausgefallen).toEqual([])
    expect(stand.ausgefalleneTage).toBe(0)
    expect(stand.offen).toBe(true)
  })

  it('kürzt eine lange Pause, zählt sie aber vollständig', () => {
    const stand = laufstand({
      jetzt,
      letzterStichtag: tag('2026-01-01'),
      zeitplan: PLAN,
      hoechstens: 5,
    })
    expect(stand.ausgefallen).toHaveLength(5)
    expect(stand.ausgefallen[0]).toEqual(tag('2026-01-02'))
    expect(stand.ausgefalleneTage).toBe(315)
  })

  it('zählt die Lücke über die Sommerzeitumstellung richtig', () => {
    // Vom 2026-03-27 bis zum 2026-03-30 liegen drei Tage dazwischen — die
    // kurze Nacht ändert daran nichts, weil in Kalendertagen gezählt wird.
    const stand = laufstand({
      jetzt: new Date('2026-03-30T08:00:00.000Z'),
      letzterStichtag: tag('2026-03-26'),
      zeitplan: PLAN,
    })
    expect(stand.stichtag).toEqual(tag('2026-03-30'))
    expect(stand.ausgefallen).toEqual([tag('2026-03-27'), tag('2026-03-28'), tag('2026-03-29')])
  })
})
