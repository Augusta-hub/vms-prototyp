/**
 * Der Leser der Arbeitskampflage. Hier entscheidet sich, **ob** eine Anzeige
 * vorliegt — und das ist bei P7 die ganze Frage: ohne Anzeige kein Treffer
 * (SPEC 5.3.2).
 *
 * Der wichtigste Test ist deshalb der, in dem tatsächlich ein Arbeitskampf
 * läuft, den niemand gemeldet hat. Wer ihn als Anzeige liest, baut eine Regel,
 * die etwas weiß, was im System nicht steht.
 */

import { describe, expect, it } from 'vitest'
import { leseArbeitskampflage } from './arbeitskampflage'
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
    'der Entleiher "Nordwerk Metall GmbH" gehört zum Konzernverbund "Nordwerk Gruppe" und führt den Standort "Werk Süd"',
    'entleiher',
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

const EINSATZSTART = ausloeser('der MSP-Disponent den Einsatz in den Status "active" überführt')

function lese(saetze: readonly string[], anlass: Ausloeser = EINSATZSTART) {
  return leseArbeitskampflage([...GRUNDLAGE, ...saetze.map((satz) => vorbedingung(satz))], anlass)
}

describe('Nur eine erfasste Anzeige ist eine Anzeige (Lesart 1)', () => {
  it('liest einen gemeldeten Arbeitskampf als Anzeige', () => {
    const gelesen = lese([
      'ein Einsatz von "Miriam Falk" am Standort "Werk Süd" steht im Status "planned" mit tatsächlichem Beginn 15.09.2026',
      'für den Standort ist eine Arbeitskampfanzeige vom 10.09.2026 bis 20.09.2026 erfasst',
    ])
    expect(gelesen.lage.anzeige?.zeitraum).toEqual({ von: '2026-09-10', bis: '2026-09-20' })
    expect(gelesen.lage.stichtag).toBe('2026-09-15')
  })

  it('liest „keine Arbeitskampfanzeige" als keine', () => {
    const gelesen = lese([
      'ein Einsatz von "Miriam Falk" am Standort "Werk Süd" steht im Status "planned" mit tatsächlichem Beginn 01.09.2026',
      'für den Standort liegt keine Arbeitskampfanzeige vor',
    ])
    expect(gelesen.lage.anzeige).toBeNull()
  })

  it('liest einen Arbeitskampf, den niemand gemeldet hat, **nicht** als Anzeige', () => {
    // 5.3.2, Grenzfall „Fehlende Angaben": die Regel ist nur so gut wie die
    // Meldedisziplin des Entleihers. Eine Anzeige, die niemand einstellt,
    // erzeugt keinen Befund.
    const gelesen = lese([
      'für den Standort "Werk Süd" ist keine Arbeitskampfanzeige erfasst',
      'tatsächlich läuft an diesem Standort ein Arbeitskampf, den niemand gemeldet hat',
    ])
    expect(gelesen.lage.anzeige).toBeNull()
  })
})

describe('Zeitraum der Anzeige (Lesart 3)', () => {
  it('liest „ab dem … ohne Enddatum" als offenen Zeitraum', () => {
    const gelesen = lese(
      ['für den Standort "Werk Süd" ist eine Arbeitskampfanzeige ab dem 10.09.2026 ohne Enddatum erfasst'],
      ausloeser('der nächtliche Lauf am 25.09.2026 läuft', {
        art: 'nachtlauf',
        stichtag: '2026-09-25',
        zielstatus: null,
      }),
    )
    expect(gelesen.lage.anzeige?.zeitraum).toEqual({ von: '2026-09-10', bis: null })
    expect(gelesen.lage.stichtag).toBe('2026-09-25')
  })

  it('liest „ab dem …" ohne „bis" ebenfalls als offen', () => {
    const gelesen = lese(
      ['für den Standort ist eine Arbeitskampfanzeige ab dem 10.09.2026 erfasst'],
      ausloeser('der nächtliche Lauf am 10.09.2026 läuft', {
        art: 'nachtlauf',
        stichtag: '2026-09-10',
        zielstatus: null,
      }),
    )
    expect(gelesen.lage.anzeige?.zeitraum.bis).toBeNull()
  })

  it('liest eine nachgetragene Anzeige und prüft sie gegen den Einsatzzeitraum', () => {
    const gelesen = lese(
      [
        'ein Einsatz von "Miriam Falk" lief vom 01.09.2026 bis 30.09.2026',
        'am 10.10.2026 wird eine Arbeitskampfanzeige für den Zeitraum vom 10.09.2026 bis 20.09.2026 nachgetragen',
      ],
      ausloeser('der Entleiher die Anzeige erfasst', {
        art: 'erfassung',
        rolle: 'Entleiher',
        objektart: 'unbekannt',
        zielstatus: null,
      }),
    )
    expect(gelesen.anlass).toBe('erfassung')
    expect(gelesen.lage.anzeige?.zeitraum).toEqual({ von: '2026-09-10', bis: '2026-09-20' })
    // Der Prüfzeitraum ist der des Einsatzes, nicht der der Anzeige.
    expect(gelesen.lage.zeitraum).toEqual({ von: '2026-09-01', bis: '2026-09-30' })
  })
})

describe('Prüfzeitraum bei → tendered (Lesart 5)', () => {
  it('reicht vom Tag des Übergangs bis zur Angebotsfrist', () => {
    // 5.3.2 Schritt 1: zum Zeitpunkt der Ausschreibung steht nicht fest, ob der
    // Arbeitskampf beim Einsatzstart noch läuft — geprüft wird der Zeitraum.
    const gelesen = lese(
      [
        'die Bedarfsanfrage "BA-2026-011" für den Standort "Werk Süd" steht im Status "approved"',
        'der Übergang wird am 10.08.2026 ausgelöst und die Angebotsfrist endet am 20.08.2026',
        'für den Standort "Werk Süd" ist eine Arbeitskampfanzeige vom 12.08.2026 bis 18.08.2026 erfasst',
      ],
      ausloeser('der MSP-Disponent die Bedarfsanfrage in den Status "tendered" überführt', {
        objektart: 'bedarfsanfrage',
        zielstatus: 'tendered',
      }),
    )
    expect(gelesen.zeile?.nummer).toBe('Q05')
    expect(gelesen.lage.stichtag).toBeNull()
    expect(gelesen.lage.zeitraum).toEqual({ von: '2026-08-10', bis: '2026-08-20' })
  })
})

describe('Bereiche und Tätigkeit (SPEC 5.3.2, Grenzfall „Nur ein Teil des Betriebs")', () => {
  it('liest die genannten Bereiche und stellt fest, dass sie die Tätigkeit nicht decken', () => {
    const gelesen = lese([
      'ein Einsatz von "Miriam Falk" mit der Tätigkeit "Instandhaltung Stufe 3" steht im Status "planned" mit tatsächlichem Beginn 15.09.2026',
      'die Arbeitskampfanzeige vom 10.09.2026 bis 20.09.2026 nennt nur den Bereich "Montage"',
    ])
    expect(gelesen.lage.taetigkeit).toBe('Instandhaltung Stufe 3')
    expect(gelesen.lage.anzeige?.bereiche).toEqual(['Montage'])
    expect(gelesen.lage.anzeige?.bereicheDeckenTaetigkeit).toBe(false)
  })

  it('nimmt die ausdrückliche Aussage an, dass die Bereiche die Tätigkeit umfassen', () => {
    const gelesen = lese([
      'ein Einsatz von "Miriam Falk" am Standort "Werk Süd" steht im Status "planned" mit tatsächlichem Beginn 15.09.2026',
      'für den Standort ist eine Arbeitskampfanzeige vom 10.09.2026 bis 20.09.2026 mit den betroffenen Bereichen erfasst, die die Tätigkeit des Einsatzes umfassen',
    ])
    expect(gelesen.lage.anzeige?.bereicheDeckenTaetigkeit).toBe(true)
  })

  it('lässt die Frage offen, wenn die Anzeige keine Bereiche nennt', () => {
    // Ohne Bereichsangabe ist der Betrieb als Ganzes betroffen — `null` ist
    // hier „keine Einschränkung", nicht „unbekannt".
    const gelesen = lese([
      'ein Einsatz von "Miriam Falk" am Standort "Werk Süd" steht im Status "planned" mit tatsächlichem Beginn 15.09.2026',
      'für den Standort ist eine Arbeitskampfanzeige vom 10.09.2026 bis 20.09.2026 erfasst',
    ])
    expect(gelesen.lage.anzeige?.bereicheDeckenTaetigkeit).toBeNull()
  })
})

describe('Zusicherung nach § 11 Abs. 5 Satz 2 AÜG (Lesart 4)', () => {
  it('liest sie als den Stichtag deckend, wenn der Vorgang den Tag nennt', () => {
    const gelesen = lese([
      'ein Einsatz von "Miriam Falk" am Standort "Werk Süd" steht im Status "planned" mit tatsächlichem Beginn 15.09.2026',
      'für den Standort ist eine Arbeitskampfanzeige vom 10.09.2026 bis 20.09.2026 erfasst',
      'für diesen Einsatz liegt eine Zusicherung nach § 11 Abs. 5 Satz 2 AÜG mit Datum und erklärender Person vor, die den 15.09.2026 abdeckt',
    ])
    expect(gelesen.lage.zusicherung?.decktStichtag).toBe(true)
  })

  it('liest „keine Zusicherung" als keine', () => {
    const gelesen = lese([
      'ein Einsatz von "Miriam Falk" am Standort "Werk Süd" steht im Status "planned" mit tatsächlichem Beginn 15.09.2026',
      'für den Standort ist eine Arbeitskampfanzeige vom 10.09.2026 bis 20.09.2026 erfasst und keine Zusicherung vorhanden',
    ])
    expect(gelesen.lage.zusicherung).toBeNull()
  })
})

describe('Die Zeile aus 4.7', () => {
  it('findet Q22 am Einsatzstart und N4 im nächtlichen Lauf', () => {
    expect(
      lese([
        'ein Einsatz von "Miriam Falk" am Standort "Werk Süd" steht im Status "planned" mit tatsächlichem Beginn 15.09.2026',
      ]).zeile?.nummer,
    ).toBe('Q22')
    expect(
      lese(
        ['ein Einsatz von "Miriam Falk" am Standort "Werk Süd" steht im Status "active"'],
        ausloeser('der nächtliche Lauf am 10.09.2026 läuft', {
          art: 'nachtlauf',
          stichtag: '2026-09-10',
          zielstatus: null,
        }),
      ).zeile?.nummer,
    ).toBe('N4')
  })

  it('findet den gesperrten Übergang bei einem Übersteuerungsversuch', () => {
    const gelesen = lese(
      ['der Einsatzstart am 15.09.2026 ist durch die Prüfung P7 gesperrt'],
      ausloeser('der MSP-Administrator die Sperre zu übersteuern versucht', {
        art: 'uebersteuerungsversuch',
        rolle: 'MSP-Administrator',
        objektart: 'unbekannt',
        zielstatus: null,
      }),
    )
    expect(gelesen.uebersteuerung.beantragt).toBe(true)
    expect(gelesen.zeile?.nummer).toBe('Q22')
    expect(gelesen.vonStatus).toBe('planned')
    expect(gelesen.nachStatus).toBe('active')
  })
})
