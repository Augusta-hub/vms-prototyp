/**
 * Der Rechenweg aus SPEC 5.2.3 und die Fristwahl aus 5.2.2.
 *
 * Geprüft werden die sechs Fälle der Fristwahl, das Beispiel, das die
 * Spezifikation selbst rechnet (5.2.3 Schritt 3: 15.01.2026, 9 Monate → 273
 * Tage, Fälligkeit 15.10.2026) und die Grenzfälle aus 5.2.6. Die Gherkin-Suite
 * prüft dasselbe fachlich; diese Tests sagen bei einem Fehler, **welcher
 * Schritt** schiefging.
 */

import { describe, expect, it } from 'vitest'
import type { Einsatzsatz, Kettenlage } from './p1Hoechstdauer'
import { pruefeEqualPayFrist, type EqualPaylage } from './p3EqualPayFrist'

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

function kette(teile: Partial<Kettenlage> = {}): Kettenlage {
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

function lage(teile: Partial<EqualPaylage> = {}): EqualPaylage {
  return {
    kette: kette(),
    verleihertarifVorhanden: true,
    fristMonateAngegeben: null,
    zuschlagsschema: null,
    vergleichsentgeltGesetzt: false,
    gesetzteFaelligkeit: null,
    ...teile,
  }
}

describe('Welche Frist gilt (SPEC 5.2.2, Fälle 1 bis 6)', () => {
  it('Fall 1 — ohne Verleihertarif gilt Equal Pay ab dem ersten Tag, nicht die Regelfrist', () => {
    const ergebnis = pruefeEqualPayFrist(lage({ verleihertarifVorhanden: false }))
    expect(ergebnis.fristMonate).toBe(0)
    expect(ergebnis.fristfall).toBe('ohneVerleihertarif')
    expect(ergebnis.fristbudget).toBe(0)
    // Der erste Überlassungstag selbst ist der erste Tag mit Pflicht.
    expect(ergebnis.faelligkeit).toBe('2026-01-15')
    // Die Abweichung setzt den Tarifvertrag voraus — das Fehlen ist ein
    // Datenfehler mit unmittelbarer Entgeltfolge.
    expect(ergebnis.konfigurationsmangel).toBe(true)
    expect(ergebnis.adressaten).toContain('MA')
  })

  it('Fall 2 — ohne Fristangabe gilt die gesetzliche Regelfrist von 9 Monaten', () => {
    const ergebnis = pruefeEqualPayFrist(lage())
    expect(ergebnis.fristMonate).toBe(9)
    expect(ergebnis.fristfall).toBe('regelfrist')
    expect(ergebnis.konfigurationsmangel).toBe(false)
  })

  it('Fall 3 — eine Frist unterhalb der Regelfrist gilt, wie sie angegeben ist', () => {
    const ergebnis = pruefeEqualPayFrist(lage({ fristMonateAngegeben: 6 }))
    expect(ergebnis.fristMonate).toBe(6)
    expect(ergebnis.fristfall).toBe('tariflich')
    expect(ergebnis.fristbudget).toBe(181)
    expect(ergebnis.budgetende).toBe('2026-07-14')
    expect(ergebnis.faelligkeit).toBe('2026-07-15')
  })

  it('Fall 4 — über der Regelfrist mit Zuschlagsschema gilt der angegebene Wert', () => {
    const ergebnis = pruefeEqualPayFrist(
      lage({ fristMonateAngegeben: 12, zuschlagsschema: 'Beispielschema B1' }),
    )
    expect(ergebnis.fristMonate).toBe(12)
    expect(ergebnis.fristfall).toBe('tariflich')
    expect(ergebnis.faelligkeit).toBe('2027-01-15')
    expect(ergebnis.konfigurationsmangel).toBe(false)
  })

  it('Fall 5 — über der Regelfrist ohne Schema ist der Wert nicht verwendbar', () => {
    // § 8 Abs. 4 Satz 2: die Verlängerung setzt die stufenweise Annäherung
    // voraus. Ohne Schema sind es 9 Monate, nicht 12.
    const ergebnis = pruefeEqualPayFrist(lage({ fristMonateAngegeben: 12 }))
    expect(ergebnis.fristMonate).toBe(9)
    expect(ergebnis.fristfall).toBe('ohneSchemaAufRegelfrist')
    expect(ergebnis.faelligkeit).toBe('2026-10-15')
    expect(ergebnis.konfigurationsmangel).toBe(true)
    expect(ergebnis.adressaten).toContain('MA')
  })

  it('Fall 6 — über der gesetzlichen Obergrenze wird auf 15 Monate begrenzt', () => {
    const ergebnis = pruefeEqualPayFrist(
      lage({ fristMonateAngegeben: 18, zuschlagsschema: 'Beispielschema B1' }),
    )
    expect(ergebnis.fristMonate).toBe(15)
    expect(ergebnis.fristfall).toBe('begrenztAufObergrenze')
    expect(ergebnis.fristbudget).toBe(455)
    expect(ergebnis.budgetende).toBe('2027-04-14')
    expect(ergebnis.faelligkeit).toBe('2027-04-15')
    expect(ergebnis.konfigurationsmangel).toBe(true)
  })

  it('prüft Fall 5 vor Fall 6: 18 Monate ohne Schema ergeben 9, nicht 15', () => {
    // Die Obergrenze gilt der stufenweisen Annäherung. Fehlt sie, ist die
    // Verlängerung über die Regelfrist überhaupt nicht eröffnet.
    const ergebnis = pruefeEqualPayFrist(lage({ fristMonateAngegeben: 18 }))
    expect(ergebnis.fristMonate).toBe(9)
    expect(ergebnis.fristfall).toBe('ohneSchemaAufRegelfrist')
  })
})

describe('Fristbudget und Fälligkeit (SPEC 5.2.3, Schritte 2 und 3)', () => {
  it('rechnet das Beispiel aus Schritt 3: 15.01.2026, 9 Monate → 273 Tage, Fälligkeit 15.10.2026', () => {
    const ergebnis = pruefeEqualPayFrist(lage())
    expect(ergebnis.kettenbeginn).toBe('2026-01-15')
    expect(ergebnis.fristbudget).toBe(273)
    expect(ergebnis.budgetende).toBe('2026-10-14')
    expect(ergebnis.faelligkeit).toBe('2026-10-15')
  })

  it('macht die Fälligkeit zum ersten Tag mit Pflicht, nicht zum letzten ohne (5.2.6)', () => {
    const ergebnis = pruefeEqualPayFrist(lage())
    // Der 14.10. ist der letzte Tag ohne Pflicht, der 15.10. der erste mit.
    expect(ergebnis.budgetende).toBe('2026-10-14')
    expect(ergebnis.faelligkeit).not.toBe(ergebnis.budgetende)
  })
})

describe('Unterbrechungen auf derselben Kette wie 5.1 (SPEC 5.2.1, 5.2.6)', () => {
  it('verschiebt die Fälligkeit um die Lückentage nach hinten', () => {
    // 01.10.2025 bis 31.03.2026 = 182 Überlassungstage, Lücke 01.04. bis
    // 30.06.2026 = 91 Tage (exakt drei Monate, **kein** Reset), Fortsetzung ab
    // 01.07.2026. Ohne Lücke wäre die Fälligkeit der 01.07.2026; die 91
    // Lückentage verbrauchen Kalenderzeit, aber kein Fristbudget.
    const ergebnis = pruefeEqualPayFrist(
      lage({
        kette: kette({
          einsaetze: [
            einsatz({ id: 'E-1', beginn: '2025-10-01', ende: '2026-03-31' }),
            einsatz({ id: 'E-2', beginn: '2026-07-01', ende: '2026-12-31' }),
          ],
          stichtag: '2026-07-01',
          luecke: { von: '2026-04-01', bis: '2026-06-30' },
          wiederaufnahmetag: '2026-07-01',
        }),
      }),
    )
    expect(ergebnis.kettenbeginn).toBe('2025-10-01')
    expect(ergebnis.fristbudget).toBe(273)
    expect(ergebnis.lueckentage).toBe(91)
    expect(ergebnis.faelligkeit).toBe('2026-09-30')
  })

  it('setzt die Frist nach einer Lücke über drei Monaten neu an', () => {
    // Lücke 01.04. bis 01.07.2026 = 92 Tage: zählwirksam. Die neue Kette
    // beginnt am 02.07.2026, und die Frist beginnt neu — auch wenn Equal Pay
    // vor der Unterbrechung schon fällig war (5.2.6).
    const ergebnis = pruefeEqualPayFrist(
      lage({
        kette: kette({
          einsaetze: [
            einsatz({ id: 'E-1', beginn: '2025-06-01', ende: '2026-03-31' }),
            einsatz({ id: 'E-2', beginn: '2026-07-02', ende: '2027-06-30' }),
          ],
          stichtag: '2026-07-02',
          luecke: { von: '2026-04-01', bis: '2026-07-01' },
          wiederaufnahmetag: '2026-07-02',
        }),
      }),
    )
    expect(ergebnis.kettenbeginn).toBe('2026-07-02')
    expect(ergebnis.faelligkeit).toBe('2027-04-02')
  })
})

describe('Ergebnis und Vermerke (SPEC 5.2.3 Schritt 4, 5.2.6)', () => {
  it('ist kein Treffer, solange der Prüfzeitraum vor der Fälligkeit endet', () => {
    const ergebnis = pruefeEqualPayFrist(
      lage({ kette: kette({ zeitraum: { von: '2026-09-01', bis: '2026-09-30' } }) }),
    )
    expect(ergebnis.faelligkeit).toBe('2026-10-15')
    expect(ergebnis.faelligkeitImZeitraum).toBe(false)
    expect(ergebnis.treffer).toBe(false)
  })

  it('ist ein Treffer, wenn die Fälligkeit im Prüfzeitraum liegt und das Entgelt fehlt', () => {
    const ergebnis = pruefeEqualPayFrist(
      lage({ kette: kette({ zeitraum: { von: '2026-10-01', bis: '2026-10-31' } }) }),
    )
    expect(ergebnis.faelligkeitImZeitraum).toBe(true)
    expect(ergebnis.treffer).toBe(true)
    expect(ergebnis.mangel).toBe('entgeltFehltNachFaelligkeit')
  })

  it('ist kein Treffer, wenn das Vergleichsentgelt gesetzt ist', () => {
    const ergebnis = pruefeEqualPayFrist(
      lage({
        vergleichsentgeltGesetzt: true,
        kette: kette({ zeitraum: { von: '2026-10-01', bis: '2026-10-31' } }),
      }),
    )
    expect(ergebnis.treffer).toBe(false)
  })

  it('erkennt eine Fälligkeit vor dem Prüfzeitraum als vergangen', () => {
    const ergebnis = pruefeEqualPayFrist(
      lage({ kette: kette({ zeitraum: { von: '2026-11-01', bis: '2026-11-30' } }) }),
    )
    expect(ergebnis.faelligkeitVergangen).toBe(true)
    expect(ergebnis.mangel).toBe('faelligkeitVergangen')
  })

  it('hebt das Ergebnis bei begrenzter Zählgrundlage an und trägt den Vermerk (5.2.6)', () => {
    const ergebnis = pruefeEqualPayFrist(
      lage({ kette: kette({ zaehlgrundlage: 'einLieferant' }) }),
    )
    expect(ergebnis.mindestensWarnung).toBe(true)
    expect(ergebnis.vermerke).toContain('Zählgrundlage auf einen Lieferanten begrenzt')
  })

  it('hebt das Ergebnis bei einem unbestätigten Vorschlag **nicht** an (5.2.6)', () => {
    // Der unbestätigte maschinelle Treffer zählt gar nicht — anders als die
    // begrenzte Kette, die mit zu wenigen Tagen rechnet. Sein Ergebnis ist eine
    // Information.
    const ergebnis = pruefeEqualPayFrist(
      lage({ kette: kette({ zaehlgrundlage: 'unbestaetigterVorschlag' }) }),
    )
    expect(ergebnis.mindestensWarnung).toBe(false)
  })

  it('warnt innerhalb des Vorlaufs nur, wenn das Vergleichsentgelt fehlt (5.0)', () => {
    // 60 Tage vor dem 15.10.2026 ist der 16.08.2026; 30 Tage davor der 15.09.
    const hinweis = pruefeEqualPayFrist(lage({ kette: kette({ stichtag: '2026-08-16' }) }))
    expect(hinweis.vorlaufErreicht).toBe(true)
    expect(hinweis.warnungErreicht).toBe(false)

    const warnung = pruefeEqualPayFrist(lage({ kette: kette({ stichtag: '2026-09-15' }) }))
    expect(warnung.warnungErreicht).toBe(true)

    const mitWert = pruefeEqualPayFrist(
      lage({ vergleichsentgeltGesetzt: true, kette: kette({ stichtag: '2026-09-15' }) }),
    )
    expect(mitWert.warnungErreicht).toBe(false)
  })
})
