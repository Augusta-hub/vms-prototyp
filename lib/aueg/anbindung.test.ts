/**
 * Die Anbindung an die Statusmodelle: die Werte, die 4.1, 4.2.1, 4.2.3 und 4.3
 * als Tatsachen erwarten, werden **gerechnet** und nicht gesetzt.
 *
 * Diese Tests kommen ohne Prisma aus — das ist der Zweck der Trennung: die
 * Umrechnung zwischen Datenmodell und Regelwerk ist hier prüfbar, der Dienst in
 * `lib/services/staffing.ts` lädt nur noch und reicht weiter.
 */
import { describe, expect, it } from 'vitest'
import {
  bestehtArbeitsverhaeltnisAmErstenTag,
  drehtuerstand,
  haeltVerlaengerungDieFrist,
  hatAnerkannteGueltigeErlaubnis,
  hatErlaubnisAmStichtag,
  hoechstdauerstand,
  type Einsatzzeile,
  type Tarifzeile,
} from './anbindung'
import type { Erlaubnissatz } from './regeln/p9Erlaubnis'

function satz(abweichung: Partial<Erlaubnissatz> = {}): Erlaubnissatz {
  return {
    id: 'EP-1',
    art: 'fixedTerm',
    gueltigVon: '2026-01-01',
    gueltigBis: '2026-12-31',
    anerkennung: 'accepted',
    urkunde: true,
    datei: true,
    vorgaenger: null,
    ...abweichung,
  }
}

describe('hasAcceptedValidPermit für Q04 und Q06 (SPEC 4.7, 5.4.1)', () => {
  it('ist wahr, wenn die Erlaubnis den ganzen Zeitraum deckt', () => {
    expect(
      hatAnerkannteGueltigeErlaubnis([satz()], { von: '2026-03-01', bis: '2026-03-31' }),
    ).toBe(true)
  })

  it('ist falsch, wenn die Erlaubnis vor dem Ende der Angebotsfrist abläuft', () => {
    // Q06: Prüfzeitraum ist der Tag des Übergangs bis zur Angebotsfrist (5.0).
    // Der Stichtag allein würde die Einladung durchlassen.
    expect(hatErlaubnisAmStichtag([satz()], '2026-12-15')).toBe(true)
    expect(
      hatAnerkannteGueltigeErlaubnis([satz()], { von: '2026-12-15', bis: '2027-01-31' }),
    ).toBe(false)
  })

  it('ist falsch bei ausstehender Anerkennung (5.4.1, Schritt 4)', () => {
    expect(hatErlaubnisAmStichtag([satz({ anerkennung: 'submitted' })], '2026-03-01')).toBe(false)
  })

  it('ist falsch ohne hinterlegte Urkunde (5.4.5)', () => {
    expect(hatErlaubnisAmStichtag([satz({ urkunde: false })], '2026-03-01')).toBe(false)
  })

  it('ist falsch ohne jeden Erlaubnissatz (5.4.6)', () => {
    expect(hatErlaubnisAmStichtag([], '2026-03-01')).toBe(false)
  })

  it('ist falsch bei einer Lücke mitten im Zeitraum (5.4.1, Schritt 3)', () => {
    const saetze = [
      satz({ gueltigBis: '2026-06-30' }),
      satz({ id: 'EP-2', gueltigVon: '2026-07-02', gueltigBis: '2026-12-31' }),
    ]
    expect(hatAnerkannteGueltigeErlaubnis(saetze, { von: '2026-06-01', bis: '2026-07-31' })).toBe(
      false,
    )
  })

  it('ist wahr bei unbefristeter Erlaubnis ab dem Beginn (5.4.1, Schritt 6)', () => {
    const unbefristet = satz({ art: 'unlimited', gueltigVon: '2024-07-01', gueltigBis: null })
    expect(
      hatAnerkannteGueltigeErlaubnis([unbefristet], { von: '2027-01-01', bis: '2027-12-31' }),
    ).toBe(true)
  })
})

describe('P1 am Datenmodell: Fristenstand und abgeleitete Felder (SPEC 5.1, 3.7)', () => {
  const tag = (iso: string): Date => new Date(`${iso}T00:00:00.000Z`)

  function einsatz(teile: Partial<Einsatzzeile> = {}): Einsatzzeile {
    return {
      id: 'A-1',
      status: 'active',
      plannedStartDate: tag('2026-01-15'),
      plannedEndDate: null,
      actualStartDate: tag('2026-01-15'),
      actualEndDate: null,
      interruptions: [],
      ...teile,
    }
  }

  const standorttarif: Tarifzeile = {
    appliesToType: 'site',
    validFrom: tag('2025-01-01'),
    validTo: tag('2028-12-31'),
    maxAssignmentDurationMonths: 18,
  }

  it('rechnet Kettenbeginn, Fristende und angerechnete Dauer aus den Einsatzzeilen', () => {
    const stand = hoechstdauerstand({
      einsaetze: [einsatz()],
      kunde: 'Nordwerk Metall GmbH',
      tarifzuordnungen: [standorttarif],
      stichtag: tag('2026-01-20'),
      zeitraum: null,
    })
    expect(stand.chainStartDate).toEqual(tag('2026-01-15'))
    expect(stand.maxDurationEndDate).toEqual(tag('2027-07-14'))
    expect(stand.countedDurationDays).toBe(6)
    expect(stand.maxDurationExceeded).toBe(false)
    expect(stand.maxAssignmentDurationMonths).toBe(18)
    expect(stand.grenzeHerkunft).toBe('standort')
  })

  it('nennt alle Einsätze der Kette, damit die abgeleiteten Felder fortgeschrieben werden', () => {
    const stand = hoechstdauerstand({
      einsaetze: [
        einsatz({
          id: 'alt',
          status: 'terminatedEarly',
          actualEndDate: tag('2026-05-31'),
        }),
        einsatz({ id: 'neu', actualStartDate: tag('2026-06-01'), plannedStartDate: tag('2026-06-01') }),
      ],
      kunde: 'Nordwerk Metall GmbH',
      tarifzuordnungen: [standorttarif],
      stichtag: tag('2026-06-01'),
      zeitraum: null,
    })
    expect(stand.chainAssignmentIds).toEqual(['alt', 'neu'])
    expect(stand.countedDurationDays).toBe(138)
  })

  it('lässt einen Einsatz, der nie begonnen hat, aus der Kette (5.1.5)', () => {
    const stand = hoechstdauerstand({
      einsaetze: [
        einsatz({
          id: 'nie',
          status: 'terminatedEarly',
          actualStartDate: null,
          plannedEndDate: tag('2026-08-31'),
        }),
      ],
      kunde: 'Nordwerk Metall GmbH',
      tarifzuordnungen: [standorttarif],
      stichtag: null,
      zeitraum: null,
    })
    expect(stand.chainStartDate).toBeNull()
    expect(stand.chainAssignmentIds).toEqual([])
    expect(stand.countedDurationDays).toBe(0)
  })

  it('sperrt den geplanten Zeitraum, der über das Fristende hinausreicht (Q14)', () => {
    const stand = hoechstdauerstand({
      einsaetze: [einsatz()],
      kunde: 'Nordwerk Metall GmbH',
      tarifzuordnungen: [standorttarif],
      stichtag: null,
      zeitraum: { von: tag('2027-06-01'), bis: tag('2027-08-31') },
    })
    expect(stand.maxDurationExceeded).toBe(true)
    expect(stand.maxDurationEndDate).toEqual(tag('2027-07-14'))
  })

  it('nimmt die Zuordnung des Standorts vor der des Kunden und die Verleiherseite nie (5.1.2)', () => {
    const stand = hoechstdauerstand({
      einsaetze: [einsatz()],
      kunde: 'Nordwerk Metall GmbH',
      tarifzuordnungen: [
        standorttarif,
        { appliesToType: 'customer', validFrom: tag('2025-01-01'), validTo: null, maxAssignmentDurationMonths: 24 },
        { appliesToType: 'supplier', validFrom: tag('2025-01-01'), validTo: null, maxAssignmentDurationMonths: 36 },
      ],
      stichtag: tag('2026-01-15'),
      zeitraum: null,
    })
    expect(stand.maxAssignmentDurationMonths).toBe(18)
  })

  it('rechnet ohne gültige Zuordnung mit der gesetzlichen Regelgrenze und vermerkt es (5.1.2)', () => {
    const stand = hoechstdauerstand({
      einsaetze: [einsatz()],
      kunde: 'Nordwerk Metall GmbH',
      tarifzuordnungen: [
        { ...standorttarif, validTo: tag('2025-12-31') },
      ],
      stichtag: tag('2026-01-15'),
      zeitraum: null,
    })
    expect(stand.maxAssignmentDurationMonths).toBe(18)
    expect(stand.mitRegelgrenze).toBe(true)
    expect(stand.grenzeHerkunft).toBe('regelgrenze')
  })

  it('prüft die Verlängerung gegen den Zeitraum ab dem bisherigen Ende (Q28, Q30)', () => {
    const innerhalb = haeltVerlaengerungDieFrist({
      einsaetze: [einsatz()],
      kunde: 'Nordwerk Metall GmbH',
      tarifzuordnungen: [standorttarif],
      bisherigesEnde: tag('2027-03-31'),
      neuesEnde: tag('2027-06-30'),
    })
    expect(innerhalb.maxDurationExceeded).toBe(false)

    const darueber = haeltVerlaengerungDieFrist({
      einsaetze: [einsatz()],
      kunde: 'Nordwerk Metall GmbH',
      tarifzuordnungen: [standorttarif],
      bisherigesEnde: tag('2027-03-31'),
      neuesEnde: tag('2027-09-30'),
    })
    expect(darueber.maxDurationExceeded).toBe(true)
  })
})

describe('P6 am Datenmodell: Drehtürklausel (SPEC 5.3.1)', () => {
  const tag = (iso: string): Date => new Date(`${iso}T00:00:00.000Z`)
  const entleiher = { name: 'Nordwerk Metall GmbH', corporateGroup: 'Nordwerk Gruppe' }

  it('setzt Equal Pay ab dem ersten Tag, wenn der Austritt im Fenster liegt', () => {
    const stand = drehtuerstand({
      kandidat: {
        previousEmploymentDeclaredAt: tag('2026-08-10'),
        previousEmploymentExisted: true,
        previousEmploymentEndedOn: tag('2026-04-30'),
        previousEmploymentEmployer: 'Nordwerk Metall GmbH',
      },
      entleiher,
      konzernunternehmen: [],
      ersterUeberlassungstag: tag('2026-09-01'),
    })
    expect(stand.equalPayDueFromFirstDay).toBe(true)
    expect(stand.hasPreviousEmploymentDeclaration).toBe(true)
    expect(stand.rueckschauVon).toEqual(tag('2026-03-01'))
    expect(stand.rueckschauBis).toEqual(tag('2026-08-31'))
  })

  it('zieht die Fälligkeit nicht vor, solange die Erklärung fehlt (5.3.1)', () => {
    const stand = drehtuerstand({
      kandidat: {
        previousEmploymentDeclaredAt: null,
        previousEmploymentExisted: null,
        previousEmploymentEndedOn: null,
        previousEmploymentEmployer: null,
      },
      entleiher,
      konzernunternehmen: [],
      ersterUeberlassungstag: tag('2026-09-01'),
    })
    expect(stand.hasPreviousEmploymentDeclaration).toBe(false)
    expect(stand.equalPayDueFromFirstDay).toBe(false)
  })

  it('greift auch bei einem Unternehmen desselben Konzerns', () => {
    const stand = drehtuerstand({
      kandidat: {
        previousEmploymentDeclaredAt: tag('2026-08-10'),
        previousEmploymentExisted: true,
        previousEmploymentEndedOn: tag('2026-05-31'),
        previousEmploymentEmployer: 'Nordwerk Service GmbH',
      },
      entleiher,
      konzernunternehmen: ['Nordwerk Service GmbH'],
      ersterUeberlassungstag: tag('2026-09-01'),
    })
    expect(stand.equalPayDueFromFirstDay).toBe(true)
  })

  it('greift nicht bei einem dritten Arbeitgeber und nicht außerhalb des Fensters', () => {
    const dritter = drehtuerstand({
      kandidat: {
        previousEmploymentDeclaredAt: tag('2026-08-10'),
        previousEmploymentExisted: true,
        previousEmploymentEndedOn: tag('2026-04-30'),
        previousEmploymentEmployer: 'Fremdwerk AG',
      },
      entleiher,
      konzernunternehmen: ['Nordwerk Service GmbH'],
      ersterUeberlassungstag: tag('2026-09-01'),
    })
    expect(dritter.equalPayDueFromFirstDay).toBe(false)

    const davor = drehtuerstand({
      kandidat: {
        previousEmploymentDeclaredAt: tag('2026-08-10'),
        previousEmploymentExisted: true,
        previousEmploymentEndedOn: tag('2026-02-28'),
        previousEmploymentEmployer: 'Nordwerk Metall GmbH',
      },
      entleiher,
      konzernunternehmen: [],
      ersterUeberlassungstag: tag('2026-09-01'),
    })
    expect(davor.equalPayDueFromFirstDay).toBe(false)
  })
})

describe('P11 am Datenmodell: Arbeitsverhältnis beim Verleiher (SPEC 5.3.4)', () => {
  const tag = (iso: string): Date => new Date(`${iso}T00:00:00.000Z`)

  it('genügt, wenn das Arbeitsverhältnis am ersten Überlassungstag besteht', () => {
    expect(
      bestehtArbeitsverhaeltnisAmErstenTag({
        kandidat: { employmentStatusWithSupplier: 'employed', employedSince: tag('2026-09-01') },
        ersterUeberlassungstag: tag('2026-09-01'),
        amEinsatzstart: true,
      }).employmentRelationshipOnFirstDay,
    ).toBe(true)
  })

  it('genügt nicht bei einem Bewerber, bei `inactive` und bei späterem Beginn', () => {
    for (const kandidat of [
      { employmentStatusWithSupplier: 'applicant', employedSince: null },
      { employmentStatusWithSupplier: 'inactive', employedSince: tag('2026-08-01') },
      { employmentStatusWithSupplier: 'employed', employedSince: tag('2026-09-02') },
      { employmentStatusWithSupplier: 'employed', employedSince: null },
    ]) {
      expect(
        bestehtArbeitsverhaeltnisAmErstenTag({
          kandidat,
          ersterUeberlassungstag: tag('2026-09-01'),
          amEinsatzstart: true,
        }).employmentRelationshipOnFirstDay,
      ).toBe(false)
    }
  })
})
