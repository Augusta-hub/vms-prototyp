/**
 * Der Leser der Konkretisierungslage.
 *
 * Hier wird die Lesart festgehalten, die am meisten erklärt werden muss: die
 * **Grundlage ist eine vollständige, rechtmäßige Lage; das Szenario nennt die
 * Abweichung.** Ein Szenariogrundriss, der genau ein nicht erfülltes Kriterium
 * benennt, behauptet damit, dass die anderen erfüllt sind. Dieser Leser setzt
 * sie deshalb als erfüllt an, bis ein Satz sie wegnimmt — und genau das wird
 * unten geprüft, in beide Richtungen.
 *
 * Für **echte** Daten gilt das nicht: dort ist ein fehlendes Feld nach 5.0 ein
 * Treffer, und `p8Konkretisierung.ts` hält sich daran ohne Ausnahme.
 */

import { describe, expect, it } from 'vitest'
import { leseKonkretisierungslage } from './konkretisierungslage'
import type { Ausloeser, Sachverhalt } from '../typen'

const LEERE_WERTE = {
  datumsangaben: [],
  zitate: [],
  statuswerte: [],
  mengen: [],
  pruefungen: [],
  kriterien: [],
}

function vorbedingung(satz: string, art = 'sonstiges'): Sachverhalt {
  return { art, satz, werte: LEERE_WERTE }
}

/** Die Grundlage der Feature-Datei, gekürzt auf das, was P8 liest. */
const GRUNDLAGE: readonly Sachverhalt[] = [
  vorbedingung(
    'der Entleiher "Nordwerk Metall GmbH" gehört zum Konzernverbund "Nordwerk Gruppe" und führt den Standort "Werk Süd"',
    'entleiher',
  ),
  vorbedingung(
    'zwischen Betreiber und "Rheinpersonal GmbH" besteht der Rahmenvertrag "RV-L-2026-004" im Status "active" mit Laufzeit vom 01.01.2026 bis 31.12.2027',
    'rahmenvertrag',
  ),
  vorbedingung('zu diesem Rahmenvertrag ist die Preisposition "PP-14" vereinbart', 'rahmenvertrag'),
  vorbedingung(
    'der Kandidat "Miriam Falk" bei "Rheinpersonal GmbH" ist beschäftigt seit dem 01.08.2026',
    'kandidat',
  ),
  vorbedingung('die Angaben dieser Grundlage gelten', 'rahmenaussage'),
]

function ausloeser(satz: string, abweichung: Partial<Ausloeser> = {}): Ausloeser {
  return {
    art: 'statusuebergang',
    satz,
    rolle: 'MSP-Disponent',
    objektart: 'einsatz',
    zielstatus: 'planned',
    stichtag: null,
    werte: LEERE_WERTE,
    ...abweichung,
  }
}

const ANLEGEN = ausloeser('der MSP-Disponent den Einsatz in den Status "planned" überführt')
const STARTEN = ausloeser('der MSP-Disponent den Einsatz in den Status "active" überführt', {
  zielstatus: 'active',
})

function lese(saetze: readonly string[], anlass: Ausloeser = ANLEGEN) {
  return leseKonkretisierungslage(
    [...GRUNDLAGE, ...saetze.map((satz) => vorbedingung(satz))],
    anlass,
  )
}

describe('Die Grundlage trägt die Vorbesetzung (Lesart 1)', () => {
  it('liest Rahmenvertrag, Preisposition, Kandidat und Standort aus ihr', () => {
    const gelesen = lese([
      'für "Miriam Falk" soll ein Einsatz mit geplantem Beginn 01.09.2026 und geplantem Ende 31.12.2026 angelegt werden',
    ])
    expect(gelesen.lage.rahmenvertrag).toEqual({
      bezeichnung: 'RV-L-2026-004',
      art: 'supplierAgreement',
      status: 'active',
      gegenpartei: 'Rheinpersonal GmbH',
      laufzeitVon: '2026-01-01',
      laufzeitBis: '2027-12-31',
    })
    expect(gelesen.lage.preisposition).toBe('PP-14')
    expect(gelesen.lage.kandidat).toBe('Miriam Falk')
    expect(gelesen.lage.standort).toBe('Werk Süd')
    expect(gelesen.lage.geplanterBeginn).toBe('2026-09-01')
    expect(gelesen.lage.geplantesEnde).toBe('2026-12-31')
  })

  it('setzt die Tätigkeitsbeschreibung und den Beginn als gesetzt an, bis ein Satz sie wegnimmt', () => {
    const gelesen = lese(['für "Miriam Falk" soll ein Einsatz angelegt werden'])
    expect(gelesen.lage.taetigkeit).not.toBeNull()
    expect(gelesen.lage.taetigkeitWieTitel).toBe(false)
    expect(gelesen.lage.beginnGesetzt).toBe(true)
  })
})

describe('Das Szenario nennt die Abweichung (Lesart 1, Gegenprobe)', () => {
  it('nimmt den Rahmenvertrag weg: „steht im Status »terminated«"', () => {
    const gelesen = lese([
      'für "Miriam Falk" soll ein Einsatz mit geplantem Beginn 01.09.2026 angelegt werden',
      'das Kriterium "K1 Kennzeichnung" ist nicht erfüllt, weil der Rahmenvertrag der Lieferantenseite steht im Status "terminated"',
    ])
    expect(gelesen.lage.rahmenvertrag?.status).toBe('terminated')
  })

  it('liest „steht nicht mehr im Status »active«" als beendet', () => {
    // Zwei Wendungen für dieselbe Tatsache: die eine nennt den Wert, die andere
    // verneint ihn. Beide nehmen K1 die Grundlage.
    const gelesen = lese(
      [
        'ein Einsatz von "Miriam Falk" steht im Status "planned" mit tatsächlichem Beginn 01.09.2026',
        'der Rahmenvertrag "RV-L-2026-004" der Lieferantenseite wurde am 20.08.2026 gekündigt und steht nicht mehr im Status "active"',
      ],
      STARTEN,
    )
    expect(gelesen.lage.rahmenvertrag?.status).not.toBe('active')
  })

  it('nimmt den Kandidaten weg', () => {
    const gelesen = lese([
      'für "Miriam Falk" soll ein Einsatz mit geplantem Beginn 01.09.2026 angelegt werden',
      'das Kriterium "K2 Person" ist nicht erfüllt, weil am Einsatz ist kein Kandidat gesetzt',
    ])
    expect(gelesen.lage.kandidat).toBeNull()
  })

  it('nimmt den Standort weg', () => {
    const gelesen = lese([
      'für "Miriam Falk" soll ein Einsatz mit geplantem Beginn 01.09.2026 angelegt werden',
      'das Kriterium "K4 Ort und Zeit" ist nicht erfüllt, weil am Einsatz ist kein Standort gesetzt',
    ])
    expect(gelesen.lage.standort).toBeNull()
  })

  it('nimmt die Preisposition weg', () => {
    const gelesen = lese([
      'für "Miriam Falk" soll ein Einsatz mit geplantem Beginn 01.09.2026 angelegt werden',
      'am Einsatz ist keine vereinbarte Preisposition der Einkaufsseite gesetzt',
    ])
    expect(gelesen.lage.preisposition).toBeNull()
  })

  it('verkürzt die Laufzeit des Rahmenvertrags', () => {
    const gelesen = lese([
      'für "Miriam Falk" soll ein Einsatz vom 01.09.2026 bis 30.06.2028 angelegt werden',
      'der Rahmenvertrag "RV-L-2026-004" der Lieferantenseite endet am 31.12.2027',
    ])
    expect(gelesen.lage.rahmenvertrag?.status).toBe('active')
    expect(gelesen.lage.rahmenvertrag?.laufzeitBis).toBe('2027-12-31')
    expect(gelesen.lage.geplantesEnde).toBe('2028-06-30')
  })
})

describe('Tätigkeit und Titel (Lesart 2)', () => {
  it('nimmt „lauten beide" als Identität', () => {
    const gelesen = lese(
      [
        'die Bedarfsanfrage "BA-2026-021" steht im Status "draft"',
        'ihr Titel und ihre Tätigkeitsbeschreibung lauten beide "Zerspanung Werk Süd"',
      ],
      ausloeser('der Bedarfsträger die Bedarfsanfrage in den Status "submitted" überführt', {
        objektart: 'bedarfsanfrage',
        zielstatus: 'submitted',
        rolle: 'Bedarfsträger',
      }),
    )
    expect(gelesen.lage.taetigkeitWieTitel).toBe(true)
    expect(gelesen.lage.titelDerAnfrage).toBe('Zerspanung Werk Süd')
    expect(gelesen.stufe).toBe('anfrage')
    expect(gelesen.zeile?.nummer).toBe('Q01')
  })

  it('nimmt „eigenständig" als Verschiedenheit', () => {
    const gelesen = lese([
      'für "Miriam Falk" soll ein Einsatz mit geplantem Beginn 01.09.2026 angelegt werden',
      'der Einsatz nennt den Kandidaten, eine eigenständige Tätigkeitsbeschreibung, den Standort "Werk Süd" und den geplanten Beginn',
    ])
    expect(gelesen.lage.taetigkeitWieTitel).toBe(false)
  })

  it('merkt sich, dass es keine Bedarfsanfrage gibt', () => {
    const gelesen = lese([
      'für "Miriam Falk" soll ein Einsatz ohne Bezug zu einer Bedarfsanfrage angelegt werden',
      'der Einsatz nennt eine eigenständige Tätigkeitsbeschreibung, Kandidat, Standort, Beginn und die Preisposition "PP-14"',
    ])
    expect(gelesen.lage.mitAnfrage).toBe(false)
  })

  it('liest die Qualifikationsanforderung nur, wo der Vorgang sie nennt', () => {
    expect(lese(['die Bedarfsanfrage "BA-2026-020" steht im Status "draft"']).lage
      .qualifikationsanforderung).toBeNull()
    expect(
      lese(['sie nennt mindestens eine Qualifikationsanforderung']).lage
        .qualifikationsanforderung,
    ).toBe(true)
  })
})

describe('Der Tag der Anlage wird nicht vorbelegt (Lesart 3)', () => {
  it('liest ihn, wo der Vorgang ihn datiert', () => {
    const gelesen = lese(
      [
        'ein Einsatz von "Miriam Falk" wurde am 25.08.2026 in den Status "planned" überführt',
        'der tatsächliche Beginn ist der 01.09.2026',
      ],
      STARTEN,
    )
    expect(gelesen.lage.anlagetag).toBe('2026-08-25')
    expect(gelesen.lage.ersterUeberlassungstag).toBe('2026-09-01')
    expect(gelesen.stufe).toBe('start')
    expect(gelesen.zeile?.nummer).toBe('Q46')
  })

  it('lässt ihn offen, wo kein Satz ihn nennt — K5 ist dann nicht prüfbar', () => {
    const gelesen = lese(
      ['ein Einsatz von "Miriam Falk" steht im Status "planned" mit tatsächlichem Beginn 01.09.2026'],
      STARTEN,
    )
    expect(gelesen.lage.anlagetag).toBeNull()
  })
})

describe('Die Prüfstufe (SPEC 5.3.3, Nr. 1 bis 3)', () => {
  it('ist „anlage" beim Anlegen und „start" am Einsatzstart', () => {
    expect(lese(['für "Miriam Falk" soll ein Einsatz angelegt werden']).stufe).toBe('anlage')
    expect(lese(['ein Einsatz steht im Status "planned"'], STARTEN).stufe).toBe('start')
  })

  it('ist „start", wenn die Überlassung schon begonnen hat', () => {
    // Eine Berichtigung an einem laufenden Einsatz (5.5.1 b) stellt dieselbe
    // Frage wie der Start: lag die Konkretisierung vor dem ersten
    // Überlassungstag vor? `actualStartDate` ist gesetzt, also ja — begonnen.
    const gelesen = lese(
      [
        'ein Einsatz von "Miriam Falk" läuft seit dem 01.09.2026 im Status "active"',
        'die Tätigkeitsbeschreibung wird am 15.10.2026 geändert',
      ],
      ausloeser('der MSP-Disponent die Änderung mit Begründung speichert', {
        art: 'berichtigung',
        objektart: 'unbekannt',
        zielstatus: null,
      }),
    )
    expect(gelesen.anlass).toBe('berichtigung')
    expect(gelesen.stufe).toBe('start')
  })

  it('findet Q45 beim Anlegen und den gesperrten Übergang bei der Übersteuerung', () => {
    expect(lese(['für "Miriam Falk" soll ein Einsatz angelegt werden']).zeile?.nummer).toBe('Q45')
    const uebersteuert = lese(
      ['das Anlegen des Einsatzes ist durch die Prüfung P8 gesperrt'],
      ausloeser('der MSP-Administrator die Sperre zu übersteuern versucht', {
        art: 'uebersteuerungsversuch',
        rolle: 'MSP-Administrator',
        objektart: 'unbekannt',
        zielstatus: null,
      }),
    )
    expect(uebersteuert.uebersteuerung.beantragt).toBe(true)
    expect(uebersteuert.zeile?.nummer).toBe('Q45')
  })
})
