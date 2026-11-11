/**
 * Zuschlagsableitung gegen SPEC 3.8 (Entscheidung zu *Frage 16*).
 *
 * Der Kern: **welcher Zuschlag lässt sich aus welcher Erfassungsform
 * rechnen?** Geprüft wird je Ableitungsgrundlage, dass sie an der passenden
 * Form rechnet und an der unpassenden **nichts** liefert — denn eine Null aus
 * Unkenntnis ist dasselbe wie „nicht ableitbar", und die Herkunft `declared`
 * ist die ehrliche Antwort darauf.
 *
 * Dazu die drei Fälle, an denen eine naive Rechnung scheitert: ein Fenster
 * über Mitternacht, ein Abschnitt über Mitternacht, und beides zugleich.
 */
import { describe, expect, it } from 'vitest'
import { DAY } from '../testing/fixtures'
import {
  abgeleiteteStunden,
  istAbleitbar,
  zuschlaegeDerPosition,
  type Zeitposition,
  type Zuschlagsart,
} from './premiums'

/** 23:00 bis 06:00 — das Fenster läuft über Mitternacht. */
const NACHT: Zuschlagsart = {
  id: 'pt-nacht',
  code: 'NACHT',
  derivationBasis: 'timeOfDay',
  fromMinute: 23 * 60,
  toMinute: 6 * 60,
}

/** 20:00 bis 22:00 — ein Fenster innerhalb eines Tages. */
const ABEND: Zuschlagsart = {
  id: 'pt-abend',
  code: 'ABEND',
  derivationBasis: 'timeOfDay',
  fromMinute: 20 * 60,
  toMinute: 22 * 60,
}

const SONNTAG: Zuschlagsart = {
  id: 'pt-sonntag',
  code: 'SONNTAG',
  derivationBasis: 'calendarDay',
  fromMinute: null,
  toMinute: null,
  weekdays: [0],
}

const FEIERTAG: Zuschlagsart = {
  id: 'pt-feiertag',
  code: 'FEIERTAG',
  derivationBasis: 'calendarDay',
  fromMinute: null,
  toMinute: null,
  // Kein Kalender in Kapitel 3 (*offene Frage 51*): ohne Wochentage bleibt
  // der Feiertagszuschlag nicht ableitbar.
  weekdays: [],
}

const UEBERSTUNDE: Zuschlagsart = {
  id: 'pt-ueberstunde',
  code: 'UEBER',
  derivationBasis: 'weeklyTotal',
  fromMinute: null,
  toMinute: null,
}

const ERSCHWERNIS: Zuschlagsart = {
  id: 'pt-erschwernis',
  code: 'ERSCH',
  derivationBasis: 'manual',
  fromMinute: null,
  toMinute: null,
}

/** Ein Mittwoch (2026-11-11). */
const MITTWOCH = DAY('2026-11-11')
/** Ein Sonntag (2026-11-15). */
const SONNTAGSTAG = DAY('2026-11-15')

function abschnitt(
  vonStunde: number,
  bisStunde: number,
  teile: Partial<Zeitposition> = {},
): Zeitposition {
  const von = Math.round(vonStunde * 60)
  const bis = Math.round(bisStunde * 60)
  const brutto = bis > von ? bis - von : 24 * 60 - von + bis
  return {
    workDate: MITTWOCH,
    startMinute: von,
    endMinute: bis,
    breakMinutes: null,
    hours: brutto / 60,
    ...teile,
  }
}

function tagessumme(stunden: number, teile: Partial<Zeitposition> = {}): Zeitposition {
  return {
    workDate: MITTWOCH,
    startMinute: null,
    endMinute: null,
    breakMinutes: null,
    hours: stunden,
    ...teile,
  }
}

describe('Ableitbarkeit je Erfassungsform (3.8, Frage 16)', () => {
  it('ein Zuschlag nach Uhrzeit braucht einen Abschnitt', () => {
    expect(istAbleitbar(NACHT, abschnitt(22, 6))).toBe(true)
    expect(istAbleitbar(NACHT, tagessumme(8))).toBe(false)
  })

  it('aus einer Tagessumme folgt deshalb **kein** Nachtzuschlag — das ist der Kern', () => {
    expect(abgeleiteteStunden(NACHT, tagessumme(8))).toBe(0)
  })

  it('ein Zuschlag nach Kalendertag ist aus beiden Formen ableitbar', () => {
    expect(istAbleitbar(SONNTAG, tagessumme(8))).toBe(true)
    expect(istAbleitbar(SONNTAG, abschnitt(8, 16))).toBe(true)
  })

  it('ein Zuschlag nach Wochensumme ist aus **einer** Position nie ableitbar', () => {
    expect(istAbleitbar(UEBERSTUNDE, abschnitt(8, 16))).toBe(false)
    expect(abgeleiteteStunden(UEBERSTUNDE, abschnitt(8, 16))).toBe(0)
  })

  it('ein Zuschlag ohne Grundlage ist nie ableitbar — der Anlass steht nicht in den Daten', () => {
    expect(istAbleitbar(ERSCHWERNIS, abschnitt(8, 16))).toBe(false)
  })

  it('ein Zuschlag nach Uhrzeit ohne Fenster ist nicht ableitbar', () => {
    const ohneFenster: Zuschlagsart = { ...NACHT, fromMinute: null, toMinute: null }
    expect(istAbleitbar(ohneFenster, abschnitt(22, 6))).toBe(false)
  })
})

describe('Überdeckung mit einem Zeitfenster (3.8)', () => {
  it('rechnet ein Fenster innerhalb des Tages', () => {
    // 18:00–23:00 trifft 20:00–22:00 → zwei Stunden.
    expect(abgeleiteteStunden(ABEND, abschnitt(18, 23))).toBeCloseTo(2, 6)
  })

  it('rechnet ein Fenster über Mitternacht gegen einen Abschnitt am Abend', () => {
    // 22:00–24:00 trifft 23:00–06:00 → eine Stunde.
    expect(abgeleiteteStunden(NACHT, abschnitt(22, 24))).toBeCloseTo(1, 6)
  })

  it('rechnet einen Abschnitt über Mitternacht gegen dasselbe Fenster', () => {
    // 22:00–06:30 trifft 23:00–06:00 → sieben Stunden.
    expect(abgeleiteteStunden(NACHT, abschnitt(22, 6.5))).toBeCloseTo(7, 6)
  })

  it('rechnet einen Abschnitt, der ganz im Fenster liegt', () => {
    // 00:00–05:00 liegt vollständig in 23:00–06:00.
    expect(abgeleiteteStunden(NACHT, abschnitt(0, 5))).toBeCloseTo(5, 6)
  })

  it('ergibt null, wenn Abschnitt und Fenster sich nicht berühren', () => {
    expect(abgeleiteteStunden(NACHT, abschnitt(8, 16))).toBe(0)
    expect(abgeleiteteStunden(ABEND, abschnitt(8, 16))).toBe(0)
  })

  it('ergibt null bei einer Berührung ohne Überdeckung — das Fenster ist halb offen', () => {
    // 16:00–20:00 endet genau, wenn 20:00–22:00 beginnt.
    expect(abgeleiteteStunden(ABEND, abschnitt(16, 20))).toBe(0)
  })

  it('begrenzt die Zuschlagsstunden auf die bezahlten Stunden (offene Frage 50)', () => {
    // 22:00–06:00 mit zwei Stunden Pause: die Überdeckung mit 23:00–06:00
    // wäre brutto sieben Stunden, bezahlt werden aber nur sechs. Wo die Pause
    // lag, weiß die Position nicht — mehr Zuschlag als Arbeit wäre falsch.
    const mitPause = abschnitt(22, 6, { breakMinutes: 120, hours: 6 })
    expect(abgeleiteteStunden(NACHT, mitPause)).toBeCloseTo(6, 6)
  })
})

describe('Überdeckung mit einem Kalendertag (3.8)', () => {
  it('gibt die ganzen Stunden der Position, wenn der Wochentag passt', () => {
    const sonntagsschicht = abschnitt(8, 16, { workDate: SONNTAGSTAG })
    expect(abgeleiteteStunden(SONNTAG, sonntagsschicht)).toBeCloseTo(8, 6)
  })

  it('gibt null an einem anderen Wochentag', () => {
    expect(abgeleiteteStunden(SONNTAG, abschnitt(8, 16))).toBe(0)
  })

  it('bleibt beim Feiertag ohne Kalender bei null (offene Frage 51)', () => {
    expect(abgeleiteteStunden(FEIERTAG, abschnitt(8, 16))).toBe(0)
    expect(abgeleiteteStunden(FEIERTAG, tagessumme(8))).toBe(0)
  })
})

describe('Zuschläge einer Position: abgeleitet und angegeben (3.8)', () => {
  const katalog = [NACHT, SONNTAG, UEBERSTUNDE, ERSCHWERNIS]

  it('leitet ab, was ableitbar ist, und nennt die Herkunft', () => {
    const zuschlaege = zuschlaegeDerPosition(abschnitt(22, 6), katalog)
    expect(zuschlaege).toEqual([
      { premiumTypeId: 'pt-nacht', hours: 7, origin: 'derived' },
    ])
  })

  it('übernimmt eine Angabe und markiert sie als `declared`', () => {
    const zuschlaege = zuschlaegeDerPosition(tagessumme(8), katalog, [
      { premiumTypeId: 'pt-nacht', hours: 5 },
    ])
    expect(zuschlaege).toEqual([{ premiumTypeId: 'pt-nacht', hours: 5, origin: 'declared' }])
  })

  it('lässt die Angabe stehen, auch wenn dieselbe Art ableitbar wäre', () => {
    // Die Angabe einer Person geht der Rechnung vor; die freigebende Stufe
    // entscheidet über sie (4.4). Stillschweigend überschrieben wäre sie
    // nirgends mehr sichtbar.
    const zuschlaege = zuschlaegeDerPosition(abschnitt(22, 6), katalog, [
      { premiumTypeId: 'pt-nacht', hours: 4 },
    ])
    expect(zuschlaege).toEqual([{ premiumTypeId: 'pt-nacht', hours: 4, origin: 'declared' }])
  })

  it('behält eine Angabe zu einer Art, die der Katalog nicht mehr führt', () => {
    const zuschlaege = zuschlaegeDerPosition(tagessumme(8), [NACHT], [
      { premiumTypeId: 'pt-alt', hours: 2 },
    ])
    expect(zuschlaege).toEqual([{ premiumTypeId: 'pt-alt', hours: 2, origin: 'declared' }])
  })

  it('führt eine Angabe von null nicht als Zuschlag', () => {
    expect(
      zuschlaegeDerPosition(tagessumme(8), katalog, [{ premiumTypeId: 'pt-nacht', hours: 0 }]),
    ).toEqual([])
  })

  it('liefert für eine gewöhnliche Tagschicht am Mittwoch keinen Zuschlag', () => {
    expect(zuschlaegeDerPosition(abschnitt(8, 16), katalog)).toEqual([])
  })
})
