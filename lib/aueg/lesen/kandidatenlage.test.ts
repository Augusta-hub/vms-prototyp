/**
 * Der Leser des Kandidatensatzes. Hier entscheidet sich, ob P6 und P11 den
 * **richtigen** Satz prüfen: beide Angaben gehören je Verleiher zum
 * Kandidatensatz, nicht zur Person — und ein Satz über eine Tatsache außerhalb
 * des Systems darf kein Datum setzen.
 */

import { describe, expect, it } from 'vitest'
import { leseBeschaeftigungslage, leseDrehtuerlage } from './kandidatenlage'
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
  vorbedingung(
    'der Lieferant "Rheinpersonal GmbH" ist aktiv und hat eine anerkannte, unbefristete AÜG-Erlaubnis',
    'lieferant',
  ),
  vorbedingung(
    'der Kandidat "Miriam Falk" bei "Rheinpersonal GmbH" ist beschäftigt seit dem 01.08.2026',
    'kandidat',
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

function drehtuer(
  eigene: readonly string[],
  anlass = ausloeser('der Betreiber die Drehtürklausel prüft'),
) {
  return leseDrehtuerlage([...GRUNDLAGE, ...eigene.map((satz) => vorbedingung(satz))], anlass)
}

function beschaeftigung(
  eigene: readonly string[],
  anlass = ausloeser('der Betreiber die Prüfung P11 am Einsatzstart 01.09.2026 rechnet'),
) {
  return leseBeschaeftigungslage(
    [...GRUNDLAGE, ...eigene.map((satz) => vorbedingung(satz))],
    anlass,
  )
}

describe('Der erste Überlassungstag als Stichtag beider Prüfungen (Lesart 2)', () => {
  it('liest den vorgesehenen Überlassungsbeginn', () => {
    const gelesen = drehtuer(['für "Miriam Falk" ist ein Überlassungsbeginn am 01.09.2026 vorgesehen'])
    expect(gelesen.lage.ueberlassungsbeginn).toBe('2026-09-01')
  })

  it('liest `availableFrom` am Profilvorschlag', () => {
    const gelesen = drehtuer([
      'der Profilvorschlag "PV-2026-030" für "Miriam Falk" steht im Status "submitted" und nennt als verfügbar ab den 01.09.2026',
    ])
    expect(gelesen.lage.ueberlassungsbeginn).toBe('2026-09-01')
  })

  it('nimmt bei einem verschobenen Starttermin den neuen Tag', () => {
    const gelesen = drehtuer([
      'der geplante Beginn des Einsatzes wird vom 01.09.2026 auf den 01.12.2026 verschoben',
    ])
    expect(gelesen.lage.ueberlassungsbeginn).toBe('2026-12-01')
  })

  it('liest den tatsächlichen Beginn am Einsatzstart', () => {
    const gelesen = beschaeftigung(
      ['ein Einsatz von "Miriam Falk" steht im Status "planned" mit tatsächlichem Beginn 01.09.2026'],
      ausloeser('der MSP-Disponent den Einsatz in den Status "active" überführt', {
        art: 'statusuebergang',
        objektart: 'einsatz',
        zielstatus: 'active',
      }),
    )
    expect(gelesen.zeile?.nummer).toBe('Q47')
    expect(gelesen.lage.ersterUeberlassungstag).toBe('2026-09-01')
    expect(gelesen.lage.amEinsatzstart).toBe(true)
  })
})

describe('Die Erklärung zur Vorbeschäftigung (SPEC 3.6, 5.3.1)', () => {
  it('liest „verneint" als Tatsachengrundlage, nicht als fehlende Angabe (Lesart 4)', () => {
    const gelesen = drehtuer([
      'die Erklärung zur Vorbeschäftigung vom 10.08.2026 verneint ein Arbeitsverhältnis beim Entleiher und im Konzern',
    ])
    expect(gelesen.lage.erklaerung?.bestand).toBe(false)
    expect(gelesen.lage.erklaerung?.erklaert).toBe('2026-08-10')
  })

  it('liest Arbeitgeber und Ende', () => {
    const gelesen = drehtuer([
      'die Erklärung zur Vorbeschäftigung nennt ein Arbeitsverhältnis bei "Nordwerk Metall GmbH", beendet am 30.04.2026',
    ])
    expect(gelesen.lage.erklaerung?.bestand).toBe(true)
    expect(gelesen.lage.erklaerung?.ende).toBe('2026-04-30')
    expect(gelesen.lage.erklaerung?.arbeitgeber).toBe('Nordwerk Metall GmbH')
  })

  it('liest die fehlende Erklärung als `null`', () => {
    const gelesen = drehtuer(['für den Kandidaten ist keine Erklärung zur Vorbeschäftigung erfasst'])
    expect(gelesen.lage.erklaerung).toBeNull()
  })

  it('liest „ja ohne Ende" als unvollständige Erklärung', () => {
    const gelesen = drehtuer([
      'die Erklärung zur Vorbeschäftigung bejaht ein früheres Arbeitsverhältnis, nennt aber kein Ende',
    ])
    expect(gelesen.lage.erklaerung?.bestand).toBe(true)
    expect(gelesen.lage.erklaerung?.ende).toBeNull()
  })

  it('merkt sich, zu welchem Kandidatensatz die Erklärung gehört (Lesart 1)', () => {
    const gelesen = drehtuer([
      '"Miriam Falk" war über "Rheinpersonal GmbH" bei "Nordwerk Metall GmbH" überlassen und dieser Einsatz endet am 31.10.2026',
      'für den Kandidatensatz bei "Rheinpersonal GmbH" liegt eine Erklärung zur Vorbeschäftigung vor',
      'ein neuer Einsatz über "Elbe Zeitarbeit GmbH" soll am 01.11.2026 beginnen',
    ])
    expect(gelesen.lage.lieferant).toBe('Elbe Zeitarbeit GmbH')
    expect(gelesen.lage.erklaerung?.lieferant).toBe('Rheinpersonal GmbH')
    expect(gelesen.lage.ueberlassungsbeginn).toBe('2026-11-01')
  })

  it('nimmt bei einer Berichtigung den berichtigten Wert (SPEC 5.5.3)', () => {
    const gelesen = drehtuer([
      'das Austrittsdatum in der Erklärung zur Vorbeschäftigung wird am 15.11.2026 von 31.01.2026 auf 30.04.2026 berichtigt',
    ])
    expect(gelesen.lage.erklaerung?.ende).toBe('2026-04-30')
  })
})

describe('Konzernzugehörigkeit (SPEC 3.1, 5.3.1 Schritt 4)', () => {
  it('liest den Konzern des Entleihers aus der Grundlage', () => {
    expect(drehtuer([]).lage.konzern).toBe('Nordwerk Gruppe')
  })

  it('liest ein weiteres Unternehmen desselben Konzerns', () => {
    const gelesen = drehtuer(['"Nordwerk Service GmbH" gehört zum Konzernverbund "Nordwerk Gruppe"'])
    expect(gelesen.lage.konzernunternehmen).toEqual(['Nordwerk Service GmbH'])
  })

  it('liest „kein Konzernverbund gepflegt" als fehlende Angabe', () => {
    const gelesen = drehtuer(['beim Kunden "Nordwerk Metall GmbH" ist kein Konzernverbund gepflegt'])
    expect(gelesen.lage.konzern).toBeNull()
    expect(gelesen.lage.konzernunternehmen).toEqual([])
  })
})

describe('Beschäftigungsverhältnis je Kandidatensatz (SPEC 3.6, 5.3.4)', () => {
  it('liest `employed` und `employedSince` aus der Grundlage', () => {
    const gelesen = beschaeftigung([])
    expect(gelesen.lage.status).toBe('employed')
    expect(gelesen.lage.beschaeftigtSeit).toBe('2026-08-01')
  })

  it('liest `applicant`', () => {
    const gelesen = beschaeftigung(['das Beschäftigungsverhältnis beim Lieferanten ist "applicant"'])
    expect(gelesen.lage.status).toBe('applicant')
  })

  it('liest `inactive` aus dem Kandidatenstatus', () => {
    const gelesen = beschaeftigung(['der Kandidat steht beim Lieferanten im Status "inactive"'])
    expect(gelesen.lage.status).toBe('inactive')
  })

  it('liest die ausdrücklich fehlende Angabe als `null`', () => {
    const gelesen = beschaeftigung([
      'am Kandidaten ist kein Beschäftigungsverhältnis beim Lieferanten erfasst',
    ])
    expect(gelesen.lage.status).toBeNull()
  })

  it('prüft beim Lieferantenwechsel den Satz des neuen Verleihers (Lesart 1)', () => {
    const gelesen = beschaeftigung([
      '"Miriam Falk" war über "Rheinpersonal GmbH" überlassen und ist dort beschäftigt seit dem 01.08.2026',
      'ein neuer Einsatz über "Elbe Zeitarbeit GmbH" steht im Status "planned" mit tatsächlichem Beginn 01.11.2026',
      'der Kandidatensatz bei "Elbe Zeitarbeit GmbH" trägt das Beschäftigungsverhältnis "applicant"',
    ])
    expect(gelesen.lage.lieferant).toBe('Elbe Zeitarbeit GmbH')
    expect(gelesen.lage.status).toBe('applicant')
  })

  it('setzt aus einer Tatsache außerhalb des Systems kein Beschäftigungsdatum (Lesart 3)', () => {
    const gelesen = beschaeftigung([
      'der Einsatzstart ist durch die Prüfung P11 gesperrt',
      'der Arbeitsvertrag zwischen "Rheinpersonal GmbH" und "Miriam Falk" besteht nachweislich seit dem 25.08.2026 und ist im System nicht erfasst',
    ])
    expect(gelesen.lage.beschaeftigtSeit).toBe('2026-08-01')
  })

  it('nimmt bei einer Berichtigung den berichtigten Wert (SPEC 5.5.3)', () => {
    const gelesen = beschaeftigung([
      'ein Einsatz von "Miriam Falk" läuft seit dem 01.09.2026 im Status "active"',
      'das Beschäftigungsdatum wird am 20.10.2026 von 01.08.2026 auf 15.09.2026 berichtigt',
    ])
    expect(gelesen.lage.beschaeftigtSeit).toBe('2026-09-15')
    expect(gelesen.lage.ersterUeberlassungstag).toBe('2026-09-01')
  })
})

describe('Die Zeile aus 4.7 zum Übergang (SPEC 5.5.1 a)', () => {
  it('findet Q12 für die Zusage, obwohl der Auslöser den Profilvorschlag nicht nennt', () => {
    const gelesen = drehtuer(
      [
        'der Profilvorschlag "PV-2026-032" für "Miriam Falk" steht im Status "releasedToCustomer"',
        'für den Kandidaten ist keine Erklärung zur Vorbeschäftigung erfasst',
      ],
      ausloeser('der Bedarfsträger zusagt und der MSP-Disponent den Status "accepted" setzen will', {
        art: 'statusuebergangsversuch',
        objektart: 'unbekannt',
        zielstatus: 'accepted',
        rolle: 'MSP-Disponent',
      }),
    )
    expect(gelesen.objektart).toBe('profilvorschlag')
    expect(gelesen.zeile?.nummer).toBe('Q12')
    expect(gelesen.zeile?.trefferartOhneGrundlage).toBe('sperre')
  })

  it('findet Q09 am Profilvorschlag und Q17 beim Anlegen des Einsatzes', () => {
    const amVorschlag = beschaeftigung(
      ['der Profilvorschlag "PV-2026-041" für "Lennart Voß" steht im Status "submitted"'],
      ausloeser('der MSP-Disponent den Profilvorschlag in den Status "reviewed" überführt', {
        art: 'statusuebergang',
        objektart: 'profilvorschlag',
        zielstatus: 'reviewed',
      }),
    )
    expect(amVorschlag.zeile?.nummer).toBe('Q09')
    expect(amVorschlag.lage.amEinsatzstart).toBe(false)

    const amEinsatz = beschaeftigung(
      ['für "Lennart Voß" soll ein Einsatz mit geplantem Beginn 01.09.2026 angelegt werden'],
      ausloeser('der MSP-Disponent den Einsatz in den Status "planned" überführt', {
        art: 'statusuebergang',
        objektart: 'einsatz',
        zielstatus: 'planned',
      }),
    )
    expect(amEinsatz.zeile?.nummer).toBe('Q17')
  })
})
