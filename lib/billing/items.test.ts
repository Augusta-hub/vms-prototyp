/**
 * Tests der Belegableitung gegen SPEC 3.9 und 3.3.
 *
 * Geprüft wird, was dieses Modul entscheidet: die Gliederung in
 * Grundleistungs- und Zuschlagspositionen, die Bepreisung aus der Preisliste
 * **derselben** Seite, der prozentuale und der absolute Zuschlag, der fehlende
 * Satz als **Mangel** und die Summen. Dazu die Zusicherung, die der Abgleich
 * in 4.5.2 einlöst: `summenStimmen` prüft nicht nur sich selbst, sondern die
 * Mengen gegen die Zettel.
 *
 * Diese Tests prüfen Anwendungscode und sind **nicht** die AÜG-Regeln; die
 * stehen als Gherkin in tests/aueg/ und werden hier nicht berührt.
 */
import { describe, expect, it } from 'vitest'
import { DAY } from '../testing/fixtures'
import {
  belegpositionen,
  belegsummen,
  summenStimmen,
  type Abrechnungszeile,
  type Preisposition,
  type Zuschlagsart,
} from './items'

const STICHTAG = DAY('2026-11-12')
const KUNDENLISTE = 'preisliste-kunde'
const EINKAUFSLISTE = 'preisliste-einkauf'

const NACHT: Zuschlagsart = { id: 'art-nacht', code: 'NACHT', calculationBase: 'percentage' }
const ERSCH: Zuschlagsart = { id: 'art-ersch', code: 'ERSCH', calculationBase: 'absolute' }
const ARTEN: readonly Zuschlagsart[] = [NACHT, ERSCH]

function preisposition(overrides: Partial<Preisposition> = {}): Preisposition {
  return {
    id: 'pos-1',
    rateCardId: KUNDENLISTE,
    itemType: 'premiumRate',
    premiumTypeId: NACHT.id,
    hourlyRate: null,
    premiumValue: 25,
    validFrom: null,
    validTo: null,
    ...overrides,
  }
}

function zeile(overrides: Partial<Abrechnungszeile> = {}): Abrechnungszeile {
  return {
    timesheetId: 'zettel-1',
    timesheetNumber: 'SZ-2026-10-0001',
    assignmentId: 'einsatz-1',
    assignmentNumber: 'EI-0001',
    costCenterId: 'kst-1',
    baseHours: 160,
    premiumHours: [],
    basePrice: 30,
    basePriceItemId: 'pos-grund',
    rateCardId: KUNDENLISTE,
    ...overrides,
  }
}

describe('Grundleistung (3.9)', () => {
  it('erzeugt je Zettel eine Position ohne Zuschlagsart', () => {
    const ergebnis = belegpositionen({
      zeilen: [zeile()],
      preispositionen: [],
      zuschlagsarten: ARTEN,
      stichtag: STICHTAG,
    })
    expect(ergebnis.maengel).toEqual([])
    expect(ergebnis.positionen).toHaveLength(1)
    expect(ergebnis.positionen[0]).toMatchObject({
      premiumTypeId: null,
      quantity: 160,
      unitPrice: 30,
      amount: 4800,
      rateCardItemId: 'pos-grund',
      costCenterId: 'kst-1',
    })
  })

  it('erzeugt keine Position über null Stunden', () => {
    const ergebnis = belegpositionen({
      zeilen: [zeile({ baseHours: 0 })],
      preispositionen: [],
      zuschlagsarten: ARTEN,
      stichtag: STICHTAG,
    })
    expect(ergebnis.positionen).toEqual([])
  })

  it('meldet einen Mangel, wenn der Einsatz für diese Seite keinen Satz nennt (3.7)', () => {
    const ergebnis = belegpositionen({
      zeilen: [zeile({ basePrice: null })],
      preispositionen: [],
      zuschlagsarten: ARTEN,
      stichtag: STICHTAG,
    })
    expect(ergebnis.positionen).toEqual([])
    expect(ergebnis.maengel).toHaveLength(1)
    expect(ergebnis.maengel[0]?.premiumCode).toBeNull()
  })

  it('trägt die Preisposition nicht, wenn ein abweichender Satz gilt (offene Frage 17)', () => {
    const ergebnis = belegpositionen({
      zeilen: [zeile({ basePrice: 28.5, basePriceItemId: null })],
      preispositionen: [],
      zuschlagsarten: ARTEN,
      stichtag: STICHTAG,
    })
    expect(ergebnis.positionen[0]?.rateCardItemId).toBeNull()
    expect(ergebnis.positionen[0]?.unitPrice).toBe(28.5)
  })
})

describe('Zuschläge (3.3, 3.8)', () => {
  it('rechnet einen prozentualen Zuschlag auf den Grundsatz', () => {
    const ergebnis = belegpositionen({
      zeilen: [zeile({ premiumHours: [{ premiumTypeId: NACHT.id, hours: 7 }] })],
      preispositionen: [preisposition({ premiumValue: 25 })],
      zuschlagsarten: ARTEN,
      stichtag: STICHTAG,
    })
    expect(ergebnis.maengel).toEqual([])
    const zuschlag = ergebnis.positionen.find((position) => position.premiumTypeId === NACHT.id)
    // 25 % von 30,00 = 7,50 je Stunde, sieben Stunden = 52,50.
    expect(zuschlag?.unitPrice).toBeCloseTo(7.5, 10)
    expect(zuschlag?.amount).toBeCloseTo(52.5, 10)
  })

  it('rechnet einen absoluten Zuschlag als Betrag je Stunde', () => {
    const ergebnis = belegpositionen({
      zeilen: [zeile({ premiumHours: [{ premiumTypeId: ERSCH.id, hours: 10 }] })],
      preispositionen: [preisposition({ id: 'pos-ersch', premiumTypeId: ERSCH.id, premiumValue: 1.5 })],
      zuschlagsarten: ARTEN,
      stichtag: STICHTAG,
    })
    const zuschlag = ergebnis.positionen.find((position) => position.premiumTypeId === ERSCH.id)
    expect(zuschlag?.unitPrice).toBe(1.5)
    expect(zuschlag?.amount).toBe(15)
  })

  it('nimmt den Satz der eigenen Seite und nicht den der anderen ([41], [42])', () => {
    // Die Differenz der beiden ist die Marge des Betreibers. Eine Suche über
    // beide Preislisten würde sie zufällig vermischen.
    //
    // Der Satz der **anderen** Seite steht hier zuerst in der Liste und
    // beginnt **später**: fiele die Begrenzung auf die eigene Preisliste weg,
    // gewänne er über beide Wege, über die Reihenfolge wie über die Regel
    // „der später beginnende gilt". Ohne diese Anordnung bestünde der Test
    // auch dann, wenn die Begrenzung fehlte.
    const ergebnis = belegpositionen({
      zeilen: [zeile({ premiumHours: [{ premiumTypeId: NACHT.id, hours: 4 }] })],
      preispositionen: [
        preisposition({
          id: 'pos-einkauf',
          rateCardId: EINKAUFSLISTE,
          premiumValue: 20,
          validFrom: DAY('2026-07-01'),
        }),
        preisposition({
          id: 'pos-kunde',
          rateCardId: KUNDENLISTE,
          premiumValue: 25,
          validFrom: DAY('2026-01-01'),
        }),
      ],
      zuschlagsarten: ARTEN,
      stichtag: STICHTAG,
    })
    const zuschlag = ergebnis.positionen.find((position) => position.premiumTypeId === NACHT.id)
    expect(zuschlag?.rateCardItemId).toBe('pos-kunde')
    // 25 % von 30,00 — nicht 20 %.
    expect(zuschlag?.unitPrice).toBeCloseTo(7.5, 10)
  })

  it('meldet einen Mangel, wenn die Preisliste keinen Satz für die Art führt (4.5.2)', () => {
    // Der `defaultValue` der Zuschlagsart tritt **nicht** ein: er ist die
    // Vorbelegung für das Anlegen einer Preisposition, keine Vereinbarung
    // zwischen den Parteien.
    const ergebnis = belegpositionen({
      zeilen: [zeile({ premiumHours: [{ premiumTypeId: NACHT.id, hours: 7 }] })],
      preispositionen: [],
      zuschlagsarten: ARTEN,
      stichtag: STICHTAG,
    })
    expect(ergebnis.positionen).toHaveLength(1)
    expect(ergebnis.positionen[0]?.premiumTypeId).toBeNull()
    expect(ergebnis.maengel).toHaveLength(1)
    expect(ergebnis.maengel[0]?.premiumCode).toBe('NACHT')
  })

  it('meldet einen Mangel, wenn die Zuschlagsart nicht im Katalog steht (3.8)', () => {
    const ergebnis = belegpositionen({
      zeilen: [zeile({ premiumHours: [{ premiumTypeId: 'art-unbekannt', hours: 2 }] })],
      preispositionen: [preisposition({ premiumTypeId: 'art-unbekannt' })],
      zuschlagsarten: ARTEN,
      stichtag: STICHTAG,
    })
    expect(ergebnis.maengel).toHaveLength(1)
    expect(ergebnis.maengel[0]?.reason).toContain('Katalog')
  })

  it('übergeht einen Satz, der am Stichtag nicht gilt (3.3)', () => {
    const ergebnis = belegpositionen({
      zeilen: [zeile({ premiumHours: [{ premiumTypeId: NACHT.id, hours: 3 }] })],
      preispositionen: [
        preisposition({ validTo: DAY('2026-09-30') }),
      ],
      zuschlagsarten: ARTEN,
      stichtag: STICHTAG,
    })
    expect(ergebnis.maengel).toHaveLength(1)
  })

  it('nimmt bei mehreren gültigen Sätzen den später beginnenden (3.3, wie 5.1.2)', () => {
    const ergebnis = belegpositionen({
      zeilen: [zeile({ premiumHours: [{ premiumTypeId: NACHT.id, hours: 1 }] })],
      preispositionen: [
        preisposition({ id: 'pos-alt', premiumValue: 20, validFrom: DAY('2026-01-01') }),
        preisposition({ id: 'pos-neu', premiumValue: 25, validFrom: DAY('2026-07-01') }),
      ],
      zuschlagsarten: ARTEN,
      stichtag: STICHTAG,
    })
    const zuschlag = ergebnis.positionen.find((position) => position.premiumTypeId === NACHT.id)
    expect(zuschlag?.rateCardItemId).toBe('pos-neu')
  })

  it('erzeugt keine Zuschlagsposition über null Stunden', () => {
    const ergebnis = belegpositionen({
      zeilen: [zeile({ premiumHours: [{ premiumTypeId: NACHT.id, hours: 0 }] })],
      preispositionen: [preisposition()],
      zuschlagsarten: ARTEN,
      stichtag: STICHTAG,
    })
    expect(ergebnis.positionen).toHaveLength(1)
    expect(ergebnis.maengel).toEqual([])
  })

  it('gliedert je Zettel in Grundleistung und je Zuschlagsart eine Position (3.9)', () => {
    const ergebnis = belegpositionen({
      zeilen: [
        zeile({
          premiumHours: [
            { premiumTypeId: NACHT.id, hours: 7 },
            { premiumTypeId: ERSCH.id, hours: 2 },
          ],
        }),
      ],
      preispositionen: [
        preisposition(),
        preisposition({ id: 'pos-ersch', premiumTypeId: ERSCH.id, premiumValue: 1.5 }),
      ],
      zuschlagsarten: ARTEN,
      stichtag: STICHTAG,
    })
    expect(ergebnis.positionen.map((position) => position.premiumTypeId)).toEqual([
      null,
      NACHT.id,
      ERSCH.id,
    ])
  })
})

describe('Summen (3.9, offene Fragen 52 und 53)', () => {
  it('rechnet Netto, Steuer und Brutto aus den Positionen', () => {
    const summen = belegsummen(
      [
        {
          timesheetId: 'z1',
          assignmentId: 'e1',
          premiumTypeId: null,
          quantity: 100,
          unitPrice: 30,
          amount: 3000,
          rateCardItemId: null,
          costCenterId: null,
        },
      ],
      19,
    )
    expect(summen.netAmount).toBe(3000)
    expect(summen.taxAmount).toBeCloseTo(570, 10)
    expect(summen.grossAmount).toBeCloseTo(3570, 10)
  })

  it('rundet nicht — die Differenz bleibt sichtbar (offene Frage 53)', () => {
    const summen = belegsummen(
      [
        {
          timesheetId: 'z1',
          assignmentId: 'e1',
          premiumTypeId: null,
          quantity: 7.3333,
          unitPrice: 30,
          amount: 7.3333 * 30,
          rateCardItemId: null,
          costCenterId: null,
        },
      ],
      19,
    )
    expect(summen.netAmount).toBeCloseTo(219.999, 3)
    // Kein auf zwei Stellen gerundeter Wert: die vierte Nachkommastelle bleibt.
    expect(Number(summen.netAmount.toFixed(2))).not.toBe(summen.netAmount)
  })

  it('ergibt bei 0 % Steuersatz Brutto gleich Netto', () => {
    const summen = belegsummen([], 0)
    expect(summen).toEqual({ netAmount: 0, taxAmount: 0, grossAmount: 0 })
  })
})

describe('Abgleich der Summen (4.5.2, created → inReview)', () => {
  const positionen = [
    {
      timesheetId: 'zettel-1',
      assignmentId: 'einsatz-1',
      premiumTypeId: null,
      quantity: 160,
      unitPrice: 30,
      amount: 4800,
      rateCardItemId: null,
      costCenterId: null,
    },
    {
      timesheetId: 'zettel-1',
      assignmentId: 'einsatz-1',
      premiumTypeId: NACHT.id,
      quantity: 7,
      unitPrice: 7.5,
      amount: 52.5,
      rateCardItemId: null,
      costCenterId: null,
    },
  ]
  const zeilen = [zeile({ premiumHours: [{ premiumTypeId: NACHT.id, hours: 7 }] })]
  const summen = belegsummen(positionen, 19)

  it('stimmt, wenn Summen und Mengen zusammenpassen', () => {
    expect(
      summenStimmen({ positionen, ...summen, taxRate: 19, zeilen }),
    ).toBe(true)
  })

  it('stimmt nicht, wenn das Netto nicht zu den Positionen passt', () => {
    expect(
      summenStimmen({ positionen, ...summen, netAmount: 5000, taxRate: 19, zeilen }),
    ).toBe(false)
  })

  it('stimmt nicht, wenn die Steuer nicht zum Satz passt', () => {
    expect(
      summenStimmen({ positionen, ...summen, taxAmount: 0, taxRate: 19, zeilen }),
    ).toBe(false)
  })

  it('stimmt nicht, wenn die Menge nicht zum Stundenzettel passt', () => {
    // Das ist der zweite Teil der Zusicherung: ein in sich stimmiger Beleg
    // über **fremde** Stunden wäre sonst „abgeglichen".
    const geaendert = [zeile({ baseHours: 150, premiumHours: [{ premiumTypeId: NACHT.id, hours: 7 }] })]
    expect(
      summenStimmen({ positionen, ...summen, taxRate: 19, zeilen: geaendert }),
    ).toBe(false)
  })

  it('stimmt nicht, wenn eine Zuschlagsmenge am Zettel fehlt', () => {
    const geaendert = [zeile({ premiumHours: [{ premiumTypeId: NACHT.id, hours: 9 }] })]
    expect(
      summenStimmen({ positionen, ...summen, taxRate: 19, zeilen: geaendert }),
    ).toBe(false)
  })

  it('stimmt nicht, wenn der Zettel eine Zuschlagsart führt, die der Beleg nicht hat', () => {
    const geaendert = [
      zeile({
        premiumHours: [
          { premiumTypeId: NACHT.id, hours: 7 },
          { premiumTypeId: ERSCH.id, hours: 2 },
        ],
      }),
    ]
    expect(
      summenStimmen({ positionen, ...summen, taxRate: 19, zeilen: geaendert }),
    ).toBe(false)
  })
})
