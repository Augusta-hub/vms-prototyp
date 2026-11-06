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
  erlaubnisstand,
  nachweisstand,
  type Einsatzzeile,
  type Erlaubniszeile,
  type Nachweiszeile,
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

describe('erlaubnisstand: die Urkunde wird wirklich aufgelöst (SPEC 3.2 E25, 5.4.5)', () => {
  const TAG = (iso: string) => new Date(`${iso}T00:00:00.000Z`)

  function erlaubnis(abweichung: Partial<Erlaubniszeile> = {}): Erlaubniszeile {
    return {
      id: 'P-1',
      permitNumber: 'AZ-1',
      permitType: 'unlimited',
      validFrom: TAG('2025-01-01'),
      validTo: null,
      verificationStatus: 'accepted',
      certificateDocumentRef: 'DOK-1',
      supersedesId: null,
      ...abweichung,
    }
  }

  function urkunde(abweichung: Partial<Nachweiszeile> = {}): Nachweiszeile {
    return {
      id: 'DOK-1',
      documentCategory: 'permitCertificate',
      validFrom: null,
      validTo: null,
      verificationStatus: 'accepted',
      fileRef: 'ablage://synthetisch/1',
      subjectRef: 'LI-1',
      ...abweichung,
    }
  }

  const stand = (
    erlaubnisse: readonly Erlaubniszeile[],
    urkunden: readonly Nachweiszeile[],
    zeitraum: { von: Date; bis: Date | null } | null = {
      von: TAG('2026-03-01'),
      bis: TAG('2026-03-31'),
    },
  ) =>
    erlaubnisstand({
      lieferant: 'Rheinpersonal GmbH',
      erlaubnisse,
      urkunden,
      stichtag: null,
      zeitraum,
      unterbrechungen: [],
    })

  it('deckt den Zeitraum mit anerkannter Erlaubnis und hinterlegter Urkunde', () => {
    expect(stand([erlaubnis()], [urkunde()]).hasAcceptedValidPermit).toBe(true)
  })

  it('deckt nicht, wenn der Verweis auf **nichts** zeigt', () => {
    // Der Verweis allein ist kein Nachweis. Zeigt er ins Leere, fehlt die
    // Datei — und ohne Datei ist der Satz nicht deckungsfähig (5.4.5).
    expect(stand([erlaubnis()], []).hasAcceptedValidPermit).toBe(false)
  })

  it('deckt nicht, wenn die Urkunde keine Ablage trägt', () => {
    expect(stand([erlaubnis()], [urkunde({ fileRef: '  ' })]).hasAcceptedValidPermit).toBe(false)
  })

  it('deckt nicht ohne Urkundenverweis', () => {
    expect(
      stand([erlaubnis({ certificateDocumentRef: null })], [urkunde()]).hasAcceptedValidPermit,
    ).toBe(false)
  })

  it('nennt den ersten ungedeckten Tag', () => {
    const ergebnis = stand(
      [erlaubnis({ permitType: 'fixedTerm', validTo: TAG('2026-03-15') })],
      [urkunde()],
    )
    expect(ergebnis.hasAcceptedValidPermit).toBe(false)
    expect(ergebnis.ersterUngedeckterTag?.toISOString().slice(0, 10)).toBe('2026-03-16')
    expect(ergebnis.tageUngedeckt).toBe(16)
  })

  it('lässt eine laufende Unterbrechung ohne Ende den Zeitraum nicht verkürzen', () => {
    // Eine Unterbrechung ohne `interruptionTo` sagt nicht, ab wann wieder
    // überlassen wird. Sie als „bis ans Ende" zu lesen hieße, eine Erlaubnislücke
    // wegzurechnen, die niemand belegt hat (5.4.5).
    const ergebnis = erlaubnisstand({
      lieferant: 'Rheinpersonal GmbH',
      erlaubnisse: [erlaubnis({ permitType: 'fixedTerm', validTo: TAG('2026-03-15') })],
      urkunden: [urkunde()],
      stichtag: null,
      zeitraum: { von: TAG('2026-03-01'), bis: TAG('2026-03-31') },
      unterbrechungen: [{ interruptionFrom: TAG('2026-03-10'), interruptionTo: null }],
    })
    expect(ergebnis.hasAcceptedValidPermit).toBe(false)
  })

  it('macht aus einem rückwärts laufenden Zeitraum den Tag des Übergangs', () => {
    // Ein Zeitraum ohne Tage gälte als gedeckt — die mildeste Antwort auf eine
    // unsinnige Eingabe. Er entsteht, wo das Ende aus einer verstrichenen Frist
    // kommt (Q04, „bis zur Angebotsfrist").
    const ergebnis = stand([erlaubnis({ permitType: 'fixedTerm', validTo: TAG('2026-01-31') })], [urkunde()], {
      von: TAG('2026-03-01'),
      bis: TAG('2026-02-01'),
    })
    expect(ergebnis.hasAcceptedValidPermit).toBe(false)
  })
})

describe('nachweisstand: der Pflichtkatalog entscheidet (SPEC 5.4.4)', () => {
  const TAG = (iso: string) => new Date(`${iso}T00:00:00.000Z`)

  function nachweis(abweichung: Partial<Nachweiszeile> = {}): Nachweiszeile {
    return {
      id: 'DOK-UW',
      documentCategory: 'safetyBriefing',
      validFrom: TAG('2026-01-01'),
      validTo: TAG('2026-12-31'),
      verificationStatus: 'accepted',
      fileRef: 'ablage://synthetisch/uw',
      subjectRef: 'E-1',
      ...abweichung,
    }
  }

  const stand = (
    nachweise: readonly Nachweiszeile[],
    teile: { unterweisungVerlangt?: boolean | null; arbeitserlaubnis?: boolean | null } = {},
  ) =>
    nachweisstand({
      nachweise,
      qZeile: 'Q21',
      bezugsobjekt: null,
      stichtag: TAG('2026-03-01'),
      zeitraum: null,
      arbeitserlaubnisErforderlich: teile.arbeitserlaubnis ?? false,
      unterweisungVerlangt: teile.unterweisungVerlangt ?? true,
    })

  it('ist erfüllt, wenn die verlangte Unterweisung anerkannt und gültig vorliegt', () => {
    const ergebnis = stand([nachweis()])
    expect(ergebnis.mandatoryDocumentsPresent).toBe(true)
    expect(ergebnis.ergebnisart).toBe('information')
  })

  it('sperrt, wenn der Standort eine Unterweisung verlangt und keine vorliegt', () => {
    const ergebnis = stand([])
    expect(ergebnis.mandatoryDocumentsPresent).toBe(false)
    expect(ergebnis.ergebnisart).toBe('sperre')
    expect(ergebnis.fehlendeArten).toContain('safetyBriefing')
  })

  it('sperrt nicht, wo der Standort keine verlangt', () => {
    expect(stand([], { unterweisungVerlangt: false }).mandatoryDocumentsPresent).toBe(true)
  })

  it('rechnet eine fehlende Angabe wie „ja" (5.4.6)', () => {
    // `null` ist keine Verneinung: eine nicht gepflegte Unterweisungspflicht
    // wird nach 5.4.6 wie „verlangt" gerechnet — die strengere Lesart.
    expect(stand([], { unterweisungVerlangt: null }).mandatoryDocumentsPresent).toBe(false)
  })

  it('sperrt bei abgelaufener Unterweisung', () => {
    expect(
      stand([nachweis({ validTo: TAG('2026-02-01') })]).mandatoryDocumentsPresent,
    ).toBe(false)
  })

  it('sperrt, solange die Unterweisung nur eingereicht ist (5.4.3)', () => {
    expect(
      stand([nachweis({ verificationStatus: 'submitted' })]).mandatoryDocumentsPresent,
    ).toBe(false)
  })

  it('lässt eine Warnung aus dem Katalog den Übergang zu (5.4.4, 5.5.2)', () => {
    // Der Qualifikationsnachweis ist nie Pflicht; sein Fehlen warnt und sperrt
    // nicht. Die Vorbedingung des Übergangs scheitert nur an einer **Sperre**.
    const ergebnis = stand([nachweis(), nachweis({ documentCategory: 'qualificationCertificate', verificationStatus: 'rejected', id: 'DOK-Q' })])
    expect(ergebnis.ergebnisart).toBe('warnung')
    expect(ergebnis.mandatoryDocumentsPresent).toBe(true)
  })
})
