/**
 * Der Leser der Kettenlage. Hier entscheidet sich, was die Rechnung aus 5.1
 * überhaupt zu sehen bekommt — und die vier Verwechslungen, die sie verfälschen
 * würden:
 *
 *  - Entleiher gegen Verleiher („bei X" gegen „über X"),
 *  - Tarifzuordnung des Standorts gegen die der Verleiherseite (5.1.2),
 *  - Ende einer Unterbrechung gegen Ende eines Einsatzes (5.1.4 a gegen b),
 *  - genannte abgeleitete Felder gegen gerechnete (3.7).
 */

import { describe, expect, it } from 'vitest'
import { leseKettenlage } from './kettenlage'
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
    'der Entleiher "Nordwerk Metall GmbH" führt den Standort "Werk Süd" mit der Kostenstelle "KST-4711"',
    'entleiher',
  ),
  vorbedingung(
    'der Lieferant "Rheinpersonal GmbH" ist aktiv und hat eine anerkannte, unbefristete AÜG-Erlaubnis',
    'lieferant',
  ),
  vorbedingung(
    'für den Standort "Werk Süd" ist die Tarifzuordnung "Beispieltarif E1" mit maxAssignmentDurationMonths = 18 vom 01.01.2025 bis 31.12.2028 gültig',
    'tarifzuordnung',
  ),
  vorbedingung(
    'die Personenidentität "PI-1001" ist für den Kandidaten "Jana Behrens" bei "Rheinpersonal GmbH" bestätigt',
    'personenidentitaet',
  ),
  vorbedingung('die Angaben dieser Grundlage gelten', 'rahmenaussage'),
]

function ausloeser(satz: string, abweichung: Partial<Ausloeser> = {}): Ausloeser {
  return {
    art: 'berechnung',
    satz,
    rolle: 'Betreiber',
    objektart: 'unbekannt',
    zielstatus: null,
    stichtag: null,
    werte: LEERE_WERTE,
    ...abweichung,
  }
}

function lies(
  eigene: readonly string[],
  anlass = ausloeser('der Betreiber die Höchstüberlassungsdauer rechnet'),
) {
  return leseKettenlage([...GRUNDLAGE, ...eigene.map((satz) => vorbedingung(satz))], anlass, 'P1')
}

describe('Entleiher und Verleiher auseinanderhalten (Lesart 1)', () => {
  it('liest „bei X" als Entleiher und „über X" als Verleiher', () => {
    const gelesen = lies([
      '"Jana Behrens" ist über "Rheinpersonal GmbH" vom 15.01.2026 bis 31.05.2026 überlassen und dieser Einsatz wird zum 31.05.2026 vorzeitig beendet',
    ])
    expect(gelesen.lage.kunde).toBe('Nordwerk Metall GmbH')
    expect(gelesen.lage.einsaetze[0]?.lieferant).toBe('Rheinpersonal GmbH')
    expect(gelesen.lage.einsaetze[0]?.beginn).toBe('2026-01-15')
    expect(gelesen.lage.einsaetze[0]?.ende).toBe('2026-05-31')
  })

  it('liest „bei X" beim Kandidatensatz als Verleiher, nicht als Entleiher', () => {
    const gelesen = lies([
      'dieselbe Person ist als Kandidat "Jana Behrens" bei "Elbe Zeitarbeit GmbH" geführt und mit der Personenidentität "PI-1001" bestätigt verknüpft',
    ])
    expect(gelesen.lage.kunde).toBe('Nordwerk Metall GmbH')
  })

  it('wechselt den Kunden, wenn das Szenario einen anderen nennt', () => {
    const gelesen = lies([
      '"Jana Behrens" ist bei "Nordwerk Metall GmbH" seit dem 15.01.2026 lückenlos überlassen',
      'für "Nordwerk Service GmbH" ist eine Überlassung derselben Person ab dem 01.03.2026 geplant',
    ])
    expect(gelesen.lage.kunde).toBe('Nordwerk Service GmbH')
    expect(gelesen.lage.einsaetze.map((einsatz) => einsatz.kunde)).toEqual([
      'Nordwerk Metall GmbH',
      'Nordwerk Service GmbH',
    ])
  })
})

describe('Die Grenze nach der Rangfolge aus 5.1.2', () => {
  it('nimmt die Zuordnung des Standorts vor der des Kunden', () => {
    const gelesen = lies([
      'für den Kunden "Nordwerk Metall GmbH" ist die Tarifzuordnung "Beispieltarif E2" mit maxAssignmentDurationMonths = 24 gültig',
    ])
    expect(gelesen.lage.grenzeMonate).toBe(18)
    expect(gelesen.lage.grenzeHerkunft).toBe('standort')
  })

  it('liest die Zuordnung der Verleiherseite nicht', () => {
    const gelesen = lies([
      'für den Lieferanten "Rheinpersonal GmbH" ist die Tarifzuordnung "Beispieltarif Z1" mit maxAssignmentDurationMonths = 36 gültig',
    ])
    expect(gelesen.lage.grenzeMonate).toBe(18)
  })

  it('rechnet mit der Regelgrenze, wenn keine Zuordnung den Stichtag abdeckt', () => {
    const gelesen = lies([
      'die Tarifzuordnung "Beispieltarif E1" für den Standort "Werk Süd" ist nur bis zum 31.12.2025 gültig',
      'für den Stichtag deckt keine Tarifzuordnung den Standort und den Kunden ab',
    ])
    expect(gelesen.lage.grenzeMonate).toBe(18)
    expect(gelesen.lage.grenzeHerkunft).toBe('regelgrenze')
  })

  it('erkennt eine Senkung innerhalb der laufenden Kette', () => {
    const gelesen = lies(
      [
        '"Jana Behrens" ist bei "Nordwerk Metall GmbH" seit dem 15.01.2026 lückenlos überlassen',
        'für den Standort "Werk Süd" gilt ab dem 01.04.2027 die Tarifzuordnung "Beispieltarif E3" mit maxAssignmentDurationMonths = 12',
      ],
      ausloeser('der Betreiber die Höchstüberlassungsdauer zum Stichtag 01.04.2027 rechnet', {
        stichtag: '2027-04-01',
      }),
    )
    expect(gelesen.lage.grenzeMonate).toBe(12)
    expect(gelesen.lage.grenzeGesenkt).toBe(true)
  })
})

describe('Unterbrechung, Lücke und Wiederaufnahme (SPEC 5.1.4)', () => {
  it('liest eine Unterbrechung mit Beginn und Ende', () => {
    const gelesen = lies([
      'eine Unterbrechung mit Beginn 01.04.2026, Ende 30.06.2026 und Grund ist angelegt',
    ])
    expect(gelesen.lage.luecke).toEqual({ von: '2026-04-01', bis: '2026-06-30' })
  })

  it('liest eine Unterbrechung ohne Ende als offene Lücke', () => {
    const gelesen = lies([
      'eine Unterbrechung mit Beginn 01.04.2026, ohne Ende und mit Grund ist angelegt',
    ])
    expect(gelesen.lage.luecke).toEqual({ von: '2026-04-01', bis: null })
  })

  it('bildet die Lücke zwischen zwei Einsätzen aus Ende und Fortsetzung (5.1.4 a)', () => {
    const gelesen = lies([
      'ein Einsatz von "Tobias Krohn" bei "Nordwerk Metall GmbH" endet am 31.03.2026',
      'die Überlassung wird am 01.07.2026 fortgesetzt',
    ])
    expect(gelesen.lage.luecke).toEqual({ von: '2026-04-01', bis: '2026-06-30' })
    expect(gelesen.lage.wiederaufnahmetag).toBe('2026-07-01')
  })

  it('erzeugt aus einem Satz, der nur ein Ende nennt, keinen Einsatz ohne Beginn (Lesart 2)', () => {
    const gelesen = lies([
      'ein Einsatz von "Tobias Krohn" bei "Nordwerk Metall GmbH" endet am 31.03.2026',
    ])
    expect(gelesen.lage.einsaetze).toHaveLength(0)
  })

  it('verwechselt das Ende einer Unterbrechung nicht mit dem Ende eines Einsatzes', () => {
    const gelesen = lies([
      'die Unterbrechung endet am 30.06.2027, der erste Wiederaufnahmetag ist der 01.07.2027',
    ])
    expect(gelesen.lage.luecke).toBeNull()
    expect(gelesen.lage.wiederaufnahmetag).toBe('2027-07-01')
  })
})

describe('Genannte abgeleitete Felder und der Stichtag (Lesart 4, SPEC 5.0)', () => {
  it('liest Fristende, angerechnete Dauer und Restbudget mit ihrem Stand', () => {
    const gelesen = lies([
      'das Fristende der Höchstüberlassungsdauer ist nach der Neuberechnung der 30.06.2027',
      'die angerechnete Dauer der Kette beträgt zum Stichtag 01.06.2026 138 Tage, das Restbudget 408 Tage',
    ])
    expect(gelesen.lage.gesetztesFristende).toBe('2027-06-30')
    expect(gelesen.lage.gesetzteDauer).toBe(138)
    expect(gelesen.lage.gesetzteDauerStand).toBe('2026-06-01')
    expect(gelesen.lage.gesetztesRestbudget).toBe(408)
  })

  it('nimmt am Einsatzstart den tatsächlichen Beginn als Stichtag (5.0)', () => {
    const gelesen = leseKettenlage(
      [
        ...GRUNDLAGE,
        vorbedingung('ein Einsatz von "Jana Behrens" bei "Nordwerk Metall GmbH" steht im Status "planned"'),
        vorbedingung('der tatsächliche Beginn ist der 01.06.2027'),
      ],
      ausloeser('der MSP-Disponent den Einsatz in den Status "active" überführt', {
        art: 'statusuebergang',
        objektart: 'einsatz',
        zielstatus: 'active',
        rolle: 'MSP-Disponent',
      }),
      'P1',
    )
    expect(gelesen.zeile?.nummer).toBe('Q23')
    expect(gelesen.stichtag).toBe('2027-06-01')
    expect(gelesen.vonStatus).toBe('planned')
  })

  it('bildet bei der Verlängerung den Prüfzeitraum aus bisherigem und neuem Ende (5.0)', () => {
    const gelesen = leseKettenlage(
      [
        ...GRUNDLAGE,
        vorbedingung('ein Einsatz von "Jana Behrens" bei "Nordwerk Metall GmbH" läuft bis zum 31.03.2027'),
        vorbedingung('die Verlängerung "VL-2027-008" mit neuem Ende 30.09.2027 steht im Status "requested"'),
      ],
      ausloeser('der Genehmiger die Verlängerung in den Status "approved" überführt', {
        art: 'statusuebergang',
        objektart: 'verlaengerung',
        zielstatus: 'approved',
        rolle: 'Genehmiger',
      }),
      'P1',
    )
    expect(gelesen.zeile?.nummer).toBe('Q28')
    expect(gelesen.lage.zeitraum).toEqual({ von: '2027-04-01', bis: '2027-09-30' })
  })

  it('liest den fehlenden Beginn als Datenfehler, nicht als fehlenden Satz (5.1.8)', () => {
    const gelesen = lies([
      'für "Jana Behrens" soll ein Einsatz bei "Nordwerk Metall GmbH" angelegt werden',
      'der Einsatz trägt kein geplantes Beginndatum',
    ])
    expect(gelesen.lage.einsaetze.some((einsatz) => einsatz.beginn === null)).toBe(true)
  })

  it('merkt sich eine festgestellte Überschreitung als Datenstand (Lesart 5)', () => {
    const gelesen = lies([
      'am zweiten Einsatz wird das tatsächliche Ende am 10.08.2027 von 31.05.2026 auf 31.07.2026 berichtigt',
      'dadurch wird eine Überschreitung des Fristendes in der Vergangenheit sichtbar',
    ])
    expect(gelesen.ueberschreitungFestgestellt).toBe(true)
  })
})

describe('Zählgrundlage (SPEC 5.1.5, Entscheidung zu Frage 18)', () => {
  it('erkennt die bestätigte Personenidentität aus der Grundlage', () => {
    expect(lies([]).lage.zaehlgrundlage).toBe('bestaetigt')
  })

  it('erkennt die fehlende Bestätigung und begrenzt die Zählgrundlage', () => {
    const gelesen = lies(['für diesen Kandidaten ist keine bestätigte Personenidentität geführt'])
    expect(gelesen.lage.zaehlgrundlage).toBe('einLieferant')
  })

  it('erkennt den maschinellen, nicht bestätigten Vorschlag', () => {
    const gelesen = lies([
      'das System hat diesen Kandidatensatz maschinell mit der Personenidentität "PI-1002" verknüpft, die Verknüpfung ist nicht bestätigt',
      'über die Kandidatensätze der Personenidentität "PI-1002" sind 500 Überlassungstage bei "Nordwerk Metall GmbH" bekannt',
    ])
    expect(gelesen.lage.zaehlgrundlage).toBe('unbestaetigterVorschlag')
  })
})
