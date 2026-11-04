/**
 * Der Leser der Erlaubnislage: Vorbedingungen und Auslöser werden zu
 * Erlaubnissätzen (SPEC 3.2) und einem Prüfzeitraum (SPEC 5.0).
 *
 * Diese Tests sichern die Stichtagslogik aus der Tabelle in 5.0 — je Prüfanlass
 * ein eigener Zeitraum — und die vier Lesarten, die der Leser festlegt. Sie
 * arbeiten mit denselben Sätzen, die in `tests/aueg/permit-and-deadlines.feature`
 * stehen, aber ohne Runner: hier wird geprüft, **was gelesen** wird, nicht was
 * daraus folgt.
 */
import { describe, expect, it } from 'vitest'
import { leseErlaubnislage } from './erlaubnislage'
import type { Ausloeser, Sachverhalt } from '../typen'

const LEERE_WERTE = {
  datumsangaben: [],
  zitate: [],
  statuswerte: [],
  mengen: [],
  pruefungen: [],
  kriterien: [],
}

/** Eine Vorbedingung, wie der Runner sie übergibt. */
function vorbedingung(satz: string, art = 'sonstiges'): Sachverhalt {
  return { art, satz, werte: LEERE_WERTE }
}

/** Die Grundlage der Feature-Datei, gekürzt auf das, was P9 liest. */
const GRUNDLAGE: readonly Sachverhalt[] = [
  vorbedingung(
    'der Lieferant "Rheinpersonal GmbH" steht im Status "active" und hat den Erlaubnissatz "EP-1" als befristete Erlaubnis vom 01.01.2026 bis 31.12.2026, anerkannt, mit hinterlegter Urkunde',
    'erlaubnissatz',
  ),
  vorbedingung(
    'der Lieferant "Elbe Zeitarbeit GmbH" steht im Status "active" und hat den Erlaubnissatz "EP-9" als unbefristete Erlaubnis ab dem 01.07.2024 ohne Enddatum, anerkannt, mit hinterlegter Urkunde',
    'erlaubnissatz',
  ),
  vorbedingung(
    'der Lieferant "Saale Personal GmbH" steht im Status "onboarding" und hat den Erlaubnissatz "EP-5" mit dem Anerkennungsstatus "submitted"',
    'erlaubnissatz',
  ),
  vorbedingung(
    'der Kandidat "Miriam Falk" bei "Rheinpersonal GmbH" benötigt eine Arbeitserlaubnis, die als Nachweis anerkannt und bis zum 31.12.2026 gültig ist',
    'nachweis',
  ),
  vorbedingung(
    'außer der jeweils geprüften Regel liefert keine andere AÜG-Prüfung einen Befund',
    'rahmenaussage',
  ),
  vorbedingung('die Angaben dieser Grundlage gelten, soweit ein Szenario nichts anderes sagt', 'rahmenaussage'),
]

function ausloeser(satz: string, abweichung: Partial<Ausloeser> = {}): Ausloeser {
  return {
    art: 'statusuebergang',
    satz,
    rolle: 'MSP-Disponent',
    objektart: 'unbekannt',
    zielstatus: null,
    stichtag: null,
    werte: LEERE_WERTE,
    ...abweichung,
  }
}

function lies(eigene: readonly string[], anlass: Ausloeser) {
  return leseErlaubnislage([...GRUNDLAGE, ...eigene.map((satz) => vorbedingung(satz))], anlass)
}

describe('Die Grundlage setzt den Ausgangszustand (SPEC 3.2)', () => {
  it('liest den befristeten Satz mit Laufzeit, Anerkennung und Urkunde', () => {
    const lage = lies(
      ['für "Rheinpersonal GmbH" soll der Zeitraum vom 01.11.2026 bis 31.12.2026 geprüft werden'],
      ausloeser('der Betreiber die Erlaubnis prüft', { art: 'berechnung' }),
    )
    const [satz] = lage.gegenstand.lage.saetze
    expect(lage.gegenstand.name).toBe('Rheinpersonal GmbH')
    expect(satz).toMatchObject({
      id: 'EP-1',
      art: 'fixedTerm',
      gueltigVon: '2026-01-01',
      gueltigBis: '2026-12-31',
      anerkennung: 'accepted',
      urkunde: true,
      datei: true,
    })
  })

  it('liest die unbefristete Erlaubnis ohne Enddatum', () => {
    const lage = lies(
      ['"Elbe Zeitarbeit GmbH" hat den unbefristeten Erlaubnissatz "EP-9" ab dem 01.07.2024 ohne Enddatum'],
      ausloeser('der Betreiber den Zeitraum vom 01.01.2027 bis 31.12.2027 prüft', {
        art: 'berechnung',
      }),
    )
    expect(lage.gegenstand.name).toBe('Elbe Zeitarbeit GmbH')
    expect(lage.gegenstand.lage.saetze[0]).toMatchObject({
      art: 'unlimited',
      gueltigVon: '2024-07-01',
      gueltigBis: null,
    })
    expect(lage.gegenstand.lage.zeitraum).toEqual({ von: '2027-01-01', bis: '2027-12-31' })
  })

  it('hält die Arbeitserlaubnis des Kandidaten aus P9 heraus (5.4.4: das ist P10)', () => {
    const lage = lies([], ausloeser('der Betreiber die Erlaubnis prüft', { art: 'berechnung' }))
    // Der Kandidatensatz darf keinen Erlaubnissatz erzeugen oder ändern.
    const rheinpersonal = lage.einladungen.find((l) => l.name === 'Rheinpersonal GmbH')
    expect(rheinpersonal).toBeUndefined()
    expect(lage.gegenstand.lage.saetze.every((satz) => satz.id.startsWith('EP-'))).toBe(true)
  })

  it('merkt den Lieferantenstatus nach 4.6', () => {
    const lage = lies(
      ['"Saale Personal GmbH" steht im Status "onboarding"'],
      ausloeser('der MSP-Administrator den Lieferanten am 21.02.2026 in den Status "active" überführt', {
        objektart: 'lieferant',
        zielstatus: 'active',
        stichtag: '2026-02-21',
      }),
    )
    expect(lage.vonStatus).toBe('onboarding')
    expect(lage.zeile?.nummer).toBe('Q41')
  })
})

describe('Das Szenario überschreibt die Grundlage', () => {
  it('zieht das Enddatum eines Satzes vor und legt den Nachfolgesatz an', () => {
    const lage = lies(
      [
        'für "Rheinpersonal GmbH" ist der Erlaubnissatz "EP-1" bis zum 30.06.2026 gültig',
        'der Nachfolgesatz "EP-2" ist ab dem 02.07.2026 gültig und anerkannt und verweist auf "EP-1" als Vorgänger',
      ],
      ausloeser('der Betreiber den Zeitraum vom 01.06.2026 bis 31.07.2026 prüft', {
        art: 'berechnung',
      }),
    )
    const saetze = lage.gegenstand.lage.saetze
    expect(saetze).toHaveLength(2)
    expect(saetze[0]).toMatchObject({ id: 'EP-1', gueltigBis: '2026-06-30' })
    expect(saetze[1]).toMatchObject({ id: 'EP-2', gueltigVon: '2026-07-02', vorgaenger: 'EP-1' })
  })

  it('macht aus „keine Urkunde hinterlegt" einen Datenfehler', () => {
    const lage = lies(
      ['für "Rheinpersonal GmbH" ist am Erlaubnissatz "EP-1" keine Urkunde hinterlegt'],
      ausloeser('der Betreiber den Zeitraum vom 01.03.2026 bis 31.03.2026 prüft', {
        art: 'berechnung',
      }),
    )
    expect(lage.gegenstand.lage.saetze[0]).toMatchObject({ urkunde: false, datei: false })
  })

  it('löscht das Enddatum, wenn das Szenario „kein Enddatum" sagt', () => {
    const lage = lies(
      ['für "Rheinpersonal GmbH" trägt der Erlaubnissatz "EP-1" die Erlaubnisart "fixedTerm" und kein Enddatum'],
      ausloeser('der Betreiber den Zeitraum vom 01.03.2026 bis 31.03.2026 prüft', {
        art: 'berechnung',
      }),
    )
    expect(lage.gegenstand.lage.saetze[0]).toMatchObject({ art: 'fixedTerm', gueltigBis: null })
  })

  it('liest „nicht anerkannt" als ausstehende Anerkennung, nicht als Zurückweisung', () => {
    const lage = lies(
      ['die Erlaubnis von "Saale Personal GmbH" ist nicht anerkannt'],
      ausloeser('der Betreiber die Erlaubnis prüft', { art: 'berechnung' }),
    )
    expect(lage.gegenstand.lage.saetze[0]?.anerkennung).toBe('submitted')
  })

  it('wendet einen Satz ohne Kennung auf alle Sätze des Lieferanten an', () => {
    const lage = lies(
      [
        '"Elbe Zeitarbeit GmbH" steht im Status "inactive"',
        'der Erlaubnissatz des Lieferanten trägt den Anerkennungsstatus "rejected"',
      ],
      ausloeser('der MSP-Administrator den Lieferanten in den Status "active" überführen will', {
        art: 'statusuebergangsversuch',
        objektart: 'lieferant',
        zielstatus: 'active',
      }),
    )
    expect(lage.gegenstand.name).toBe('Elbe Zeitarbeit GmbH')
    expect(lage.gegenstand.lage.saetze[0]?.anerkennung).toBe('rejected')
    expect(lage.zeile?.nummer).toBe('Q44')
  })
})

describe('Prüfzeitraum je Prüfanlass (SPEC 5.0)', () => {
  it('Q04/Q06: Tag des Übergangs bis zur Angebotsfrist', () => {
    const lage = lies(
      [
        'die Ausschreibung hat die Angebotsfrist 31.01.2027',
        'der Übergang wird am 15.12.2026 ausgelöst',
        '"Rheinpersonal GmbH" hat nur den Erlaubnissatz "EP-1" bis zum 31.12.2026 und keinen Nachfolgesatz',
      ],
      ausloeser('der MSP-Disponent die Einladung erzeugen will', {
        art: 'statusuebergangsversuch',
        objektart: 'einladung',
      }),
    )
    expect(lage.zeile?.nummer).toBe('Q06')
    expect(lage.nachStatus).toBe('invited')
    expect(lage.gegenstand.lage.zeitraum).toEqual({ von: '2026-12-15', bis: '2027-01-31' })
  })

  it('Q04/Q06: ohne genannten Übergangstag wird der Zeitraum nicht geraten (Lesart 3)', () => {
    const lage = lies(
      ['die Ausschreibung zur Bedarfsanfrage "BA-2026-030" hat die Angebotsfrist 31.03.2026'],
      ausloeser('der MSP-Disponent die Einladung erzeugt', { objektart: 'einladung' }),
    )
    expect(lage.gegenstand.lage.zeitraum).toEqual({ von: '2026-03-31', bis: '2026-03-31' })
  })

  it('Q16: plannedStartDate bis plannedEndDate', () => {
    const lage = lies(
      ['für "Miriam Falk" soll ein Einsatz über "Rheinpersonal GmbH" vom 01.11.2026 bis 31.03.2027 angelegt werden'],
      ausloeser('der MSP-Disponent den Einsatz in den Status "planned" überführen will', {
        art: 'statusuebergangsversuch',
        objektart: 'einsatz',
        zielstatus: 'planned',
      }),
    )
    expect(lage.zeile?.nummer).toBe('Q16')
    expect(lage.gegenstand.lage.zeitraum).toEqual({ von: '2026-11-01', bis: '2027-03-31' })
  })

  it('Q20: Stichtag ist der tatsächliche Beginn', () => {
    const lage = lies(
      ['ein Einsatz von "Miriam Falk" über "Rheinpersonal GmbH" steht im Status "planned" mit tatsächlichem Beginn 31.12.2026'],
      ausloeser('der MSP-Disponent den Einsatz in den Status "active" überführt', {
        objektart: 'einsatz',
        zielstatus: 'active',
      }),
    )
    expect(lage.zeile?.nummer).toBe('Q20')
    expect(lage.vonStatus).toBe('planned')
    expect(lage.gegenstand.lage.zeitraum).toEqual({ von: '2026-12-31', bis: '2026-12-31' })
  })

  it('Q31: bisheriges Ende + 1 Tag bis zum neuen Ende', () => {
    const lage = lies(
      [
        'ein Einsatz über "Rheinpersonal GmbH" läuft bis zum 30.09.2026',
        'die Verlängerung "VL-2026-020" mit neuem Ende 30.11.2026 steht im Status "approved"',
      ],
      ausloeser('der MSP-Disponent die Verlängerung in den Status "effective" überführt', {
        objektart: 'verlaengerung',
        zielstatus: 'effective',
      }),
    )
    expect(lage.zeile?.nummer).toBe('Q31')
    expect(lage.gegenstand.lage.zeitraum).toEqual({ von: '2026-10-01', bis: '2026-11-30' })
  })

  it('Q38: der Leistungszeitraum des Belegs', () => {
    const lage = lies(
      [
        'der Einkaufsbeleg zur Periode März 2026 beruht auf genehmigten Stundenzetteln zu Einsätzen über "Rheinpersonal GmbH"',
        'der Leistungszeitraum ist der 01.03.2026 bis 31.03.2026',
      ],
      ausloeser('der MSP-Disponent den Beleg in den Status "created" überführt', {
        objektart: 'beleg',
        zielstatus: 'created',
      }),
    )
    expect(lage.zeile?.nummer).toBe('Q38')
    expect(lage.zeile?.trefferart).toBe('warnung')
    expect(lage.gegenstand.lage.zeitraum).toEqual({ von: '2026-03-01', bis: '2026-03-31' })
  })

  it('N1: der nächtliche Lauf prüft die Lieferanten zum Tag des Laufs', () => {
    const lage = lies(
      ['"Rheinpersonal GmbH" steht im Status "active" und der Erlaubnissatz "EP-1" ist bis zum 31.12.2026 gültig'],
      ausloeser('der nächtliche Lauf am 17.12.2026 läuft', {
        art: 'nachtlauf',
        stichtag: '2026-12-17',
      }),
    )
    expect(lage.zeile?.nummer).toBe('N1')
    expect(lage.objektart).toBe('lieferant')
    expect(lage.vonStatus).toBe('active')
    expect(lage.stichtag).toBe('2026-12-17')
  })

  it('liest die Unterbrechung als Verkürzung des Prüfzeitraums (5.4.5)', () => {
    const lage = lies(
      ['ein Einsatz über "Rheinpersonal GmbH" ist vom 01.04.2026 bis 30.06.2026 unterbrochen'],
      ausloeser('der Betreiber die Erlaubnis für den Einsatzzeitraum prüft', { art: 'berechnung' }),
    )
    expect(lage.gegenstand.lage.unterbrechungen).toEqual([
      { von: '2026-04-01', bis: '2026-06-30' },
    ])
  })
})

describe('Einladungen und Übersteuerung', () => {
  it('liest die eingeladenen Lieferanten je Einladung (Q04, 5.4.1)', () => {
    const lage = lies(
      [
        'die Bedarfsanfrage "BA-2026-031" steht im Status "approved"',
        'die Ausschreibung lädt "Rheinpersonal GmbH", "Elbe Zeitarbeit GmbH" und "Saale Personal GmbH" ein und die Angebotsfrist endet am 31.03.2026',
      ],
      ausloeser('der MSP-Disponent die Bedarfsanfrage in den Status "tendered" überführt', {
        objektart: 'bedarfsanfrage',
        zielstatus: 'tendered',
      }),
    )
    expect(lage.zeile?.nummer).toBe('Q04')
    expect(lage.einladungen.map((l) => l.name)).toEqual([
      'Rheinpersonal GmbH',
      'Elbe Zeitarbeit GmbH',
      'Saale Personal GmbH',
    ])
  })

  it('bestimmt den gesperrten Übergang aus dem Sperrvorzustand (5.5.4, Invariante 1)', () => {
    const lage = lies(
      [
        'die Wirksamkeit der Verlängerung "VL-2026-021" ist durch die Prüfung P9 gesperrt',
        'die behördliche Verlängerung der Erlaubnis bis zum 31.12.2027 liegt nachweislich vor und ist im System nicht erfasst',
        'das Erfassen ist vor dem Ablauf des bisherigen Endes nicht möglich',
        'nach richtiger Datenlage wäre die Verlängerung zulässig',
      ],
      ausloeser('der MSP-Administrator den Übergang mit Pflichtbegründung übersteuert', {
        art: 'uebersteuerung',
      }),
    )
    expect(lage.objektart).toBe('verlaengerung')
    expect(lage.nachStatus).toBe('effective')
    expect(lage.uebersteuerung).toEqual({
      beantragt: true,
      angabeUnrichtig: true,
      berichtigungNichtMoeglich: true,
      datenlageZulaessig: true,
    })
  })

  it('ändert keine Daten durch einen Satz über die Welt außerhalb (Lesart 4)', () => {
    const lage = lies(
      [
        'die Wirksamkeit der Verlängerung "VL-2026-021" ist durch die Prüfung P9 gesperrt',
        'die behördliche Verlängerung der Erlaubnis bis zum 31.12.2027 liegt nachweislich vor und ist im System nicht erfasst',
      ],
      ausloeser('der MSP-Administrator den Übergang mit Pflichtbegründung übersteuert', {
        art: 'uebersteuerung',
      }),
    )
    // Die behördliche Verlängerung liegt nur in der Wirklichkeit vor; sie darf
    // das Enddatum des Erlaubnissatzes nicht verschieben, sonst bräuchte es
    // keine Übersteuerung.
    const rheinpersonal = lage.gegenstand.lage.saetze.find((satz) => satz.id === 'EP-1')
    expect(rheinpersonal?.gueltigBis).not.toBe('2027-12-31')
  })

  it('verweigert Bedingung (c), wenn die Erlaubnis tatsächlich nicht besteht', () => {
    const lage = lies(
      [
        'das Freischalten von "Saale Personal GmbH" ist durch die Prüfung P9 gesperrt',
        'eine Erlaubnis besteht tatsächlich nicht',
      ],
      ausloeser('der MSP-Administrator die Sperre zu übersteuern versucht', {
        art: 'uebersteuerungsversuch',
      }),
    )
    expect(lage.objektart).toBe('lieferant')
    expect(lage.uebersteuerung.datenlageZulaessig).toBe(false)
  })
})
