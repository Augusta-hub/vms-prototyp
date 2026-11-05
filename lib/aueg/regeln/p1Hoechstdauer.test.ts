/**
 * Die Rechenwege aus SPEC 5.1 — Tagebudget, Kette, Reset und Schwellen.
 *
 * Geprüft werden die Beispiele, die die Spezifikation selbst rechnet (5.1.3
 * Schritt 4, 5.1.4 mit seinen drei Beispielzeilen), die Grenzfälle aus 5.1.5
 * und das Verhalten bei fehlenden Daten aus 5.1.8. Die Gherkin-Suite in
 * `tests/aueg/` prüft dasselbe fachlich; diese Tests prüfen die Rechnung
 * unmittelbar und sagen bei einem Fehler, **welcher Schritt** schiefging.
 */

import { describe, expect, it } from 'vitest'
import {
  bewerteLuecke,
  pruefeHoechstdauer,
  type Einsatzsatz,
  type Kettenlage,
} from './p1Hoechstdauer'

function einsatz(teile: Partial<Einsatzsatz> = {}): Einsatzsatz {
  return {
    id: 'E-1',
    kunde: 'Nordwerk Metall GmbH',
    lieferant: 'Rheinpersonal GmbH',
    beginn: '2026-01-15',
    ende: null,
    tatsaechlich: true,
    nieBegonnen: false,
    unterbrechungen: [],
    ...teile,
  }
}

function lage(teile: Partial<Kettenlage> = {}): Kettenlage {
  return {
    person: 'Jana Behrens',
    kunde: 'Nordwerk Metall GmbH',
    einsaetze: [einsatz()],
    stichtag: '2026-01-15',
    zeitraum: null,
    zeitpositionen: null,
    grenzeMonate: 18,
    grenzeHerkunft: 'standort',
    grenzeGesenkt: false,
    gesetztesFristende: null,
    gesetzteDauer: null,
    gesetzteDauerStand: null,
    gesetztesRestbudget: null,
    zaehlgrundlage: 'bestaetigt',
    luecke: null,
    wiederaufnahmetag: null,
    fehlendeFelder: [],
    ...teile,
  }
}

describe('Tagebudget und Fristende einer lückenlosen Kette (SPEC 5.1.3)', () => {
  it('rechnet das Beispiel aus Schritt 4: 15.01.2026, 18 Monate → 546 Tage, Fristende 14.07.2027', () => {
    const ergebnis = pruefeHoechstdauer(lage())
    expect(ergebnis.kettenbeginn).toBe('2026-01-15')
    expect(ergebnis.tagebudget).toBe(546)
    expect(ergebnis.fristende).toBe('2027-07-14')
    expect(ergebnis.ueberschritten).toBe(false)
  })

  it('zählt die angerechnete Dauer bis zum Stichtag einschließlich', () => {
    const ergebnis = pruefeHoechstdauer(lage({ stichtag: '2026-01-20' }))
    expect(ergebnis.angerechneteDauer).toBe(6)
    expect(ergebnis.restbudget).toBe(540)
  })

  it('zählt einen Tag mit zwei laufenden Einsätzen einmal (Entscheidung zu Frage 19)', () => {
    const ergebnis = pruefeHoechstdauer(
      lage({
        stichtag: '2026-05-14',
        einsaetze: [
          einsatz({ id: 'E-1', beginn: '2026-01-15', ende: '2026-04-14' }),
          einsatz({ id: 'E-2', beginn: '2026-02-15', ende: '2026-05-14' }),
        ],
      }),
    )
    expect(ergebnis.angerechneteDauer).toBe(120)
    expect(ergebnis.kettenbeginn).toBe('2026-01-15')
  })

  it('schreibt die Kette über einen Lieferantenwechsel fort (§ 1 Abs. 1b Satz 2)', () => {
    const ergebnis = pruefeHoechstdauer(
      lage({
        stichtag: '2026-06-01',
        einsaetze: [
          einsatz({ id: 'alt', beginn: '2026-01-15', ende: '2026-05-31' }),
          einsatz({ id: 'neu', lieferant: 'Elbe Zeitarbeit GmbH', beginn: '2026-06-01' }),
        ],
      }),
    )
    expect(ergebnis.kettenbeginn).toBe('2026-01-15')
    expect(ergebnis.angerechneteDauer).toBe(138)
    expect(ergebnis.fristende).toBe('2027-07-14')
  })

  it('rechnet je Kunde eine eigene Kette, auch im Konzern (5.1.5)', () => {
    const ergebnis = pruefeHoechstdauer(
      lage({
        kunde: 'Nordwerk Service GmbH',
        stichtag: '2026-03-01',
        einsaetze: [
          einsatz({ id: 'anderer Kunde', beginn: '2026-01-15' }),
          einsatz({ id: 'dieser Kunde', kunde: 'Nordwerk Service GmbH', beginn: '2026-03-01' }),
        ],
      }),
    )
    expect(ergebnis.kettenbeginn).toBe('2026-03-01')
    expect(ergebnis.angerechneteDauer).toBe(1)
  })

  it('erzeugt für einen Einsatz, der nie begonnen hat, keinen Überlassungstag (5.1.5)', () => {
    const ergebnis = pruefeHoechstdauer(
      lage({
        stichtag: null,
        einsaetze: [
          einsatz({ beginn: '2026-03-01', ende: '2026-08-31', nieBegonnen: true, tatsaechlich: false }),
        ],
      }),
    )
    expect(ergebnis.kettenbeginn).toBeNull()
    expect(ergebnis.angerechneteDauer).toBe(0)
    expect(ergebnis.ueberschritten).toBe(false)
  })
})

describe('Unterbrechung und Zurücksetzen (SPEC 5.1.4)', () => {
  it('setzt bei exakt drei Monaten **nicht** zurück — die häufigste Fehlrechnung', () => {
    const bewertung = bewerteLuecke({ von: '2026-04-01', bis: '2026-06-30' }, null, '2026-07-01')
    expect(bewertung.dreimonatsende).toBe('2026-06-30')
    expect(bewertung.zaehlwirksam).toBe(false)
    expect(bewertung.lueckentage).toBe(91)
    expect(bewertung.neueKetteAb).toBeNull()
  })

  it('setzt einen Tag später zurück', () => {
    const bewertung = bewerteLuecke({ von: '2026-04-01', bis: '2026-07-01' }, null, '2026-07-02')
    expect(bewertung.zaehlwirksam).toBe(true)
    expect(bewertung.neueKetteAb).toBe('2026-07-02')
  })

  it('erkennt die durchgehende Überlassung: Lückenende vor Lückenbeginn', () => {
    const bewertung = bewerteLuecke({ von: '2026-04-01', bis: '2026-03-31' }, null, '2026-04-01')
    expect(bewertung.keineLuecke).toBe(true)
    expect(bewertung.zaehlwirksam).toBe(false)
    expect(bewertung.lueckentage).toBe(0)
  })

  it('nimmt bei offenem Ende den Stichtag und bleibt vorläufig (5.1.4 b, 5.1.8)', () => {
    const bewertung = bewerteLuecke({ von: '2026-04-01', bis: null }, '2026-04-01', null)
    expect(bewertung.lueckenende).toBe('2026-04-01')
    expect(bewertung.vorlaeufig).toBe(true)
    expect(bewertung.zaehlwirksam).toBe(false)
  })

  it('wird mit dem nächtlichen Lauf zählwirksam, wenn die Schwelle überschritten ist (N6)', () => {
    const bewertung = bewerteLuecke({ von: '2026-04-01', bis: null }, '2026-07-02', null)
    expect(bewertung.zaehlwirksam).toBe(true)
    expect(bewertung.vorlaeufig).toBe(true)
  })

  it('verschiebt mit Lückentagen das Fristende, ohne das Budget zu verbrauchen (offene Frage 26)', () => {
    const ergebnis = pruefeHoechstdauer(
      lage({
        stichtag: '2026-07-01',
        luecke: { von: '2026-04-01', bis: '2026-06-30' },
        einsaetze: [
          einsatz({
            beginn: '2025-10-01',
            unterbrechungen: [{ von: '2026-04-01', bis: '2026-06-30' }],
          }),
        ],
      }),
    )
    expect(ergebnis.tagebudget).toBe(547)
    expect(ergebnis.lueckentage).toBe(91)
    expect(ergebnis.fristende).toBe('2027-06-30')
    expect(ergebnis.kettenbeginn).toBe('2025-10-01')
  })

  it('beginnt nach einem Reset eine neue Kette und schreibt die alte Dauer nicht fort', () => {
    const ergebnis = pruefeHoechstdauer(
      lage({
        stichtag: '2026-07-02',
        gesetzteDauer: 182,
        gesetzteDauerStand: '2026-03-31',
        einsaetze: [
          einsatz({
            beginn: '2025-10-01',
            unterbrechungen: [{ von: '2026-04-01', bis: '2026-07-01' }],
          }),
        ],
      }),
    )
    expect(ergebnis.kettenbeginn).toBe('2026-07-02')
    expect(ergebnis.angerechneteDauer).toBe(1)
    expect(ergebnis.fristende).toBe('2028-01-01')
  })

  it('schreibt eine genannte Dauer fort, solange ihr Stand zur Kette gehört', () => {
    const ergebnis = pruefeHoechstdauer(
      lage({
        stichtag: '2026-07-01',
        gesetzteDauer: 182,
        gesetzteDauerStand: '2026-03-31',
        einsaetze: [
          einsatz({
            beginn: '2025-10-01',
            unterbrechungen: [{ von: '2026-04-01', bis: '2026-06-30' }],
          }),
        ],
      }),
    )
    expect(ergebnis.angerechneteDauer).toBe(182)
    expect(ergebnis.restbudget).toBe(365)
  })
})

describe('Schwellen und Überschreitung (SPEC 5.1.6, 5.1.3 Schritt 7)', () => {
  const ohneKette = (teile: Partial<Kettenlage>): Kettenlage =>
    lage({ einsaetze: [], gesetztesFristende: '2027-07-14', ...teile })

  it('warnt unterhalb von 30 Tagen Restbudget und weist unterhalb von 90 hin', () => {
    expect(pruefeHoechstdauer(ohneKette({ stichtag: '2027-06-14' })).schwelle).toBe('warnung')
    expect(pruefeHoechstdauer(ohneKette({ stichtag: '2027-04-15' })).schwelle).toBe('hinweis')
    expect(pruefeHoechstdauer(ohneKette({ stichtag: '2027-01-01' })).schwelle).toBe('keine')
  })

  it('nennt das Fristende als letzten zulässigen Überlassungstag (5.1.5)', () => {
    const amFristende = pruefeHoechstdauer(ohneKette({ stichtag: '2027-07-14' }))
    expect(amFristende.ueberschritten).toBe(false)
    expect(amFristende.schwelle).toBe('erreicht')

    const amFolgetag = pruefeHoechstdauer(ohneKette({ stichtag: '2027-07-15' }))
    expect(amFolgetag.ueberschritten).toBe(true)
    expect(amFolgetag.stichtagUeberschritten).toBe(true)
  })

  it('vergleicht den letzten Tag des Prüfzeitraums mit dem Fristende (Vorschau)', () => {
    const innerhalb = pruefeHoechstdauer(
      ohneKette({ stichtag: '2027-03-01', zeitraum: { von: '2027-03-01', bis: '2027-06-30' } }),
    )
    expect(innerhalb.ueberschritten).toBe(false)
    expect(innerhalb.schwelle).toBe('keine')

    const darueber = pruefeHoechstdauer(
      ohneKette({ stichtag: '2027-06-01', zeitraum: { von: '2027-06-01', bis: '2027-12-31' } }),
    )
    expect(darueber.ueberschritten).toBe(true)
    expect(darueber.stichtagUeberschritten).toBe(false)
    expect(darueber.bezugstag).toBe('2027-12-31')
  })

  it('nimmt am Stundenzettel die Zeitpositionen als letzten Tag (4.7, Q33 und Q35)', () => {
    const ergebnis = pruefeHoechstdauer(
      ohneKette({
        zeitraum: { von: '2027-07-01', bis: '2027-07-31' },
        zeitpositionen: { von: '2027-07-01', bis: '2027-07-14' },
      }),
    )
    expect(ergebnis.bezugstag).toBe('2027-07-14')
    expect(ergebnis.ueberschritten).toBe(false)
  })

  it('rechnet das Restbudget aus dem Vorgang, wo er es führt (Q07)', () => {
    const ergebnis = pruefeHoechstdauer(
      lage({ einsaetze: [], gesetzteDauer: 516, gesetztesRestbudget: 30, stichtag: '2027-06-14' }),
    )
    expect(ergebnis.restbudget).toBe(30)
    expect(ergebnis.schwelle).toBe('warnung')
  })
})

describe('Fehlende und widersprüchliche Daten (SPEC 5.1.8, 5.0)', () => {
  it('wirkt bei fehlendem plannedStartDate wie ein Treffer und nennt das Feld', () => {
    const ergebnis = pruefeHoechstdauer(lage({ einsaetze: [einsatz({ beginn: null })] }))
    expect(ergebnis.ueberschritten).toBe(true)
    expect(ergebnis.mangel).toBe('laufzeitFehlt')
    expect(ergebnis.fehlendeFelder).toContain('plannedStartDate')
  })

  it('wirkt bei Ende vor Beginn wie ein Treffer und nennt beide Felder', () => {
    const ergebnis = pruefeHoechstdauer(
      lage({ einsaetze: [einsatz({ beginn: '2027-06-01', ende: '2027-03-01' })] }),
    )
    expect(ergebnis.mangel).toBe('widerspruch')
    expect(ergebnis.fehlendeFelder).toEqual(['plannedStartDate', 'plannedEndDate'])
  })

  it('lässt die angerechnete Dauer offen, wenn kein Stichtag den Schnitt setzt', () => {
    const ergebnis = pruefeHoechstdauer(lage({ stichtag: null }))
    expect(ergebnis.angerechneteDauer).toBeNull()
    expect(ergebnis.schwelle).toBe('keine')
  })

  it('zählt einen unbestätigten Identitätsvorschlag nicht (5.1.5, Frage 18)', () => {
    const ergebnis = pruefeHoechstdauer(
      lage({ zaehlgrundlage: 'unbestaetigterVorschlag', stichtag: '2027-01-01' }),
    )
    expect(ergebnis.kettenbeginn).toBeNull()
    expect(ergebnis.vermerke.join(' ')).toMatch(/unbestätigter Identitätsvorschlag/)
  })

  it('vermerkt die auf einen Lieferanten begrenzte Zählgrundlage (5.1.5)', () => {
    const ergebnis = pruefeHoechstdauer(lage({ zaehlgrundlage: 'einLieferant' }))
    expect(ergebnis.vermerke).toContain('Zählgrundlage auf einen Lieferanten begrenzt')
    expect(ergebnis.adressaten).toContain('MD')
  })

  it('vermerkt die gesetzliche Regelgrenze und adressiert den MSP-Administrator (5.1.2)', () => {
    const ergebnis = pruefeHoechstdauer(lage({ grenzeHerkunft: 'regelgrenze' }))
    expect(ergebnis.vermerke.join(' ')).toMatch(/gesetzlichen Regelgrenze von 18 Monaten/)
    expect(ergebnis.adressaten).toContain('MA')
  })
})

describe('Senkung der Grenze in laufender Kette (SPEC 5.1.2, offene Frage 27)', () => {
  it('setzt das Fristende auf den Stichtag und stellt die Vergangenheit fest', () => {
    const ergebnis = pruefeHoechstdauer(
      lage({ grenzeMonate: 12, grenzeGesenkt: true, stichtag: '2027-04-01' }),
    )
    expect(ergebnis.tagebudget).toBe(365)
    expect(ergebnis.senkungWirktNachVorn).toBe(true)
    expect(ergebnis.fristende).toBe('2027-04-01')
    expect(ergebnis.meldung).toMatch(/nicht rückwirkend untersagt/)
  })

  it('wirkt nicht nach vorn, solange das neu berechnete Fristende in der Zukunft liegt', () => {
    const ergebnis = pruefeHoechstdauer(
      lage({ grenzeMonate: 12, grenzeGesenkt: true, stichtag: '2026-06-01' }),
    )
    expect(ergebnis.senkungWirktNachVorn).toBe(false)
    expect(ergebnis.fristende).toBe('2027-01-14')
  })
})
