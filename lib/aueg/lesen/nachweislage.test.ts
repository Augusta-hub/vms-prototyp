/**
 * Der Leser der Nachweislage. Entscheidend ist der Unterschied zwischen
 * „nein" und „nicht gesetzt": nach SPEC 5.4.6 wird eine **fehlende** Angabe
 * wie „ja" gerechnet, eine mit „nein" gefüllte nicht. Geht der Unterschied
 * beim Lesen verloren, umgeht der Vorgang eine Sperre.
 */
import { describe, expect, it } from 'vitest'
import { leseNachweislage } from './nachweislage'
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

const GRUNDLAGE: readonly Sachverhalt[] = [
  vorbedingung(
    'der Entleiher "Nordwerk Metall GmbH" führt den Standort "Werk Süd", an dem eine Unterweisung verlangt wird',
    'entleiher',
  ),
  vorbedingung(
    'der Kandidat "Miriam Falk" bei "Rheinpersonal GmbH" benötigt eine Arbeitserlaubnis, die als Nachweis anerkannt und bis zum 31.12.2026 gültig ist',
    'nachweis',
  ),
  vorbedingung('die Angaben dieser Grundlage gelten', 'rahmenaussage'),
]

function ausloeser(satz: string, abweichung: Partial<Ausloeser> = {}): Ausloeser {
  return {
    art: 'statusuebergang',
    satz,
    rolle: 'MSP-Disponent',
    objektart: 'einsatz',
    zielstatus: 'active',
    stichtag: null,
    werte: LEERE_WERTE,
    ...abweichung,
  }
}

function lies(eigene: readonly string[], anlass = ausloeser('der MSP-Disponent den Einsatz in den Status "active" überführt')) {
  return leseNachweislage([...GRUNDLAGE, ...eigene.map((satz) => vorbedingung(satz))], anlass)
}

describe('Die Grundlage setzt die Pflichtangaben (SPEC 3.1, 3.6)', () => {
  it('liest die Arbeitserlaubnis des Kandidaten mit Gültigkeit', () => {
    const gelesen = lies([
      'ein Einsatz von "Miriam Falk" am Standort "Werk Süd" steht im Status "planned" mit tatsächlichem Beginn 01.03.2026',
      'die Unterweisung am Standort ist anerkannt und bis zum 31.08.2027 gültig',
    ])
    expect(gelesen.zeile?.nummer).toBe('Q21')
    expect(gelesen.lage.arbeitserlaubnisErforderlich).toBe(true)
    expect(gelesen.lage.unterweisungVerlangt).toBe(true)
    expect(gelesen.lage.zeitraum).toEqual({ von: '2026-03-01', bis: '2026-03-01' })
    expect(gelesen.lage.nachweise).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          art: 'workPermit',
          anerkennung: 'accepted',
          gueltigBis: '2026-12-31',
        }),
        expect.objectContaining({ art: 'safetyBriefing', gueltigBis: '2027-08-31' }),
      ]),
    )
  })
})

describe('„nicht gesetzt" bleibt „nicht gesetzt" (SPEC 5.4.6)', () => {
  it('lässt die Erforderlichkeit leer, wenn der Vorgang sie nicht führt', () => {
    const gelesen = lies([
      'ein Einsatz des Kandidaten "Lennart Voß" steht im Status "planned" mit tatsächlichem Beginn 01.03.2026',
      'am Kandidaten ist nicht erfasst, ob eine Arbeitserlaubnis erforderlich ist',
      'kein Nachweis der Art "workPermit" ist erfasst',
    ])
    expect(gelesen.lage.arbeitserlaubnisErforderlich).toBeNull()
  })

  it('lässt die Unterweisungspflicht eines nicht beschriebenen Standorts leer', () => {
    const gelesen = lies([
      'ein Einsatz von "Miriam Falk" am Standort "Werk Nord" steht im Status "planned" mit tatsächlichem Beginn 01.03.2026',
      'am Standort ist nicht erfasst, ob eine Unterweisung verlangt wird, und kein Unterweisungsnachweis liegt vor',
    ])
    expect(gelesen.lage.unterweisungVerlangt).toBeNull()
    expect(gelesen.lage.ausdruecklichAbwesend).toContain('safetyBriefing')
  })

  it('unterscheidet „keine Unterweisung verlangt" von „nicht erfasst"', () => {
    const gelesen = lies([
      'am Standort "Werk Nord" war keine Unterweisung verlangt',
      'ein Einsatz von "Miriam Falk" an diesem Standort steht im Status "active"',
    ])
    expect(gelesen.lage.unterweisungVerlangt).toBe(false)
  })
})

describe('Das Fehlen eines Nachweises wird ausdrücklich vermerkt (Lesart 3)', () => {
  it('merkt sich einen ausdrücklich nicht erfassten Qualifikationsnachweis', () => {
    const gelesen = lies([
      'ein Einsatz von "Miriam Falk" steht im Status "planned" mit tatsächlichem Beginn 01.03.2026',
      'Arbeitserlaubnis und Unterweisung sind anerkannt und gültig',
      'für den Kandidaten ist kein Qualifikationsnachweis erfasst',
    ])
    expect(gelesen.lage.ausdruecklichAbwesend).toContain('qualificationCertificate')
    expect(gelesen.lage.nachweise.map((nachweis) => nachweis.art)).not.toContain(
      'qualificationCertificate',
    )
  })

  it('liest „anerkannt und gültig" ohne Enddatum als unbefristet (5.4.4)', () => {
    const gelesen = lies([
      'ein Einsatz von "Miriam Falk" steht im Status "planned" mit tatsächlichem Beginn 01.03.2026',
      'die Unterweisung am Standort ist anerkannt und gültig',
    ])
    const unterweisung = gelesen.lage.nachweise.find(
      (nachweis) => nachweis.art === 'safetyBriefing',
    )
    expect(unterweisung).toMatchObject({ anerkennung: 'accepted', gueltigBis: null })
  })

  it('merkt sich eine ausdrücklich fehlende Unbedenklichkeitsbescheinigung', () => {
    const gelesen = lies(
      [
        '"Saale Personal GmbH" steht im Status "onboarding"',
        'die Erlaubnisurkunde ist anerkannt und hinterlegt',
        'keine Unbedenklichkeitsbescheinigung ist erfasst',
      ],
      ausloeser('der MSP-Administrator den Lieferanten in den Status "active" überführt', {
        objektart: 'lieferant',
        zielstatus: 'active',
      }),
    )
    expect(gelesen.zeile?.nummer).toBe('Q42')
    expect(gelesen.lage.ausdruecklichAbwesend).toContain('clearanceCertificate')
  })
})

describe('Prüfzeitraum und Anlass', () => {
  it('nimmt am Stundenzettel seinen Zeitraum (Q37, SPEC 5.0)', () => {
    const gelesen = lies(
      [
        'der Stundenzettel "SZ-2027-09-001" steht im Status "inApproval" und alle Freigabeschritte sind zugestimmt',
        'sein Zeitraum ist der 01.09.2027 bis 30.09.2027',
        'die Unterweisung am Standort war bis zum 31.08.2027 gültig',
      ],
      ausloeser('die Rolle der letzten Freigabestufe den Stundenzettel in den Status "approved" überführt', {
        objektart: 'stundenzettel',
        zielstatus: 'approved',
      }),
    )
    expect(gelesen.zeile?.nummer).toBe('Q37')
    expect(gelesen.lage.zeitraum).toEqual({ von: '2027-09-01', bis: '2027-09-30' })
  })

  it('prüft im nächtlichen Lauf die Nachweise zum Einsatz (N5)', () => {
    const gelesen = lies(
      [
        'die Arbeitserlaubnis von "Miriam Falk" ist anerkannt und bis zum 31.12.2026 gültig',
        'ein Einsatz dieses Kandidaten steht im Status "active"',
      ],
      ausloeser('der nächtliche Lauf am 24.12.2026 läuft', {
        art: 'nachtlauf',
        objektart: 'unbekannt',
        zielstatus: null,
        stichtag: '2026-12-24',
      }),
    )
    expect(gelesen.zeile?.nummer).toBe('N5')
    expect(gelesen.objektart).toBe('einsatz')
    expect(gelesen.vonStatus).toBe('active')
  })

  it('liest den gesperrten Übergang auch aus einer P10-Sperre (5.5.4)', () => {
    const gelesen = lies(
      [
        'der Einsatzstart ist durch die Prüfung P10 gesperrt',
        'die Unterweisung am Standort hat tatsächlich nicht stattgefunden',
      ],
      ausloeser('der MSP-Administrator die Sperre zu übersteuern versucht', {
        art: 'uebersteuerungsversuch',
        objektart: 'unbekannt',
        zielstatus: null,
      }),
    )
    expect(gelesen.objektart).toBe('einsatz')
    expect(gelesen.nachStatus).toBe('active')
    expect(gelesen.uebersteuerung.datenlageZulaessig).toBe(false)
  })
})
