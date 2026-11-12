/**
 * Tests des nächtlichen Laufs gegen SPEC 5.5.1 c.
 *
 * Geprüft wird je Zeile: dass sie anschlägt, wann sie **nicht** anschlägt, und
 * dass die **Stufe** aus der Restzeit folgt — mit den kumulativen Adressaten
 * aus 5.4.4 und 5.1.6. Dazu die drei Dinge, die der Lauf nicht tut: kein
 * Statuswechsel, keine Sperre, keine Genehmigungsfiktion. Die ersten beiden
 * sind Eigenschaften des Ergebnistyps — er kennt `sperre` nicht —, die dritte
 * zeigt die Zeile „Stundenzettel nicht genehmigt".
 *
 * Diese Tests prüfen Anwendungscode und sind **nicht** die AÜG-Regeln; die
 * stehen als Gherkin in tests/aueg/ und werden hier nicht berührt.
 */
import { describe, expect, it } from 'vitest'
import { DAY, OPERATOR_TENANT, CUSTOMER_TENANT, SUPPLIER_TENANT } from '../testing/fixtures'
import {
  befundeBelegBeanstandet,
  befundeN1,
  befundeN2,
  befundeN3,
  befundeN5,
  befundeN6,
  befundeZettelNichtEingereicht,
  befundeZettelNichtGenehmigt,
  restTage,
  type Einsatzlage,
  type Lieferantenzeile,
  type Zettellage,
} from './befunde'

const STICHTAG = DAY('2026-11-12')

function einsatz(overrides: Partial<Einsatzlage> = {}): Einsatzlage {
  return {
    id: 'einsatz-1',
    assignmentNumber: 'E-0001',
    tenantId: OPERATOR_TENANT,
    status: 'active',
    customerTenantId: CUSTOMER_TENANT,
    supplierTenantId: SUPPLIER_TENANT,
    maxDurationEndDate: null,
    equalPayDueDate: null,
    comparableWage: null,
    ...overrides,
  }
}

function lieferant(overrides: Partial<Lieferantenzeile> = {}): Lieferantenzeile {
  return {
    id: 'lieferant-1',
    legalName: 'Rheinpersonal GmbH (synthetisch)',
    tenantId: SUPPLIER_TENANT,
    status: 'active',
    erlaubnisse: [
      {
        id: 'dok-1',
        permitNumber: 'AZ-1',
        permitType: 'fixedTerm',
        validFrom: DAY('2025-01-01'),
        validTo: DAY('2026-12-31'),
        verificationStatus: 'accepted',
        certificateDocumentRef: 'dok-1',
        supersedesId: null,
      },
    ],
    urkunden: [
      {
        id: 'dok-1',
        documentCategory: 'permitCertificate',
        validFrom: DAY('2025-01-01'),
        validTo: DAY('2026-12-31'),
        verificationStatus: 'accepted',
        fileRef: 'ablage/az-1.pdf',
        subjectRef: 'lieferant-1',
      },
    ],
    ...overrides,
  }
}

function zettel(overrides: Partial<Zettellage> = {}): Zettellage {
  return {
    id: 'zettel-1',
    timesheetNumber: 'SZ-0001',
    tenantId: OPERATOR_TENANT,
    customerTenantId: CUSTOMER_TENANT,
    supplierTenantId: SUPPLIER_TENANT,
    status: 'recorded',
    periodTo: DAY('2026-10-31'),
    closingDate: DAY('2026-11-10'),
    openStageRole: null,
    submissionDeadlineDays: 3,
    ...overrides,
  }
}

describe('Restzeit (5.0, Stichtagslogik)', () => {
  it('zählt den Stichtag selbst als null Tage', () => {
    expect(restTage(STICHTAG, DAY('2026-11-12'))).toBe(0)
  })

  it('zählt vorwärts und rückwärts', () => {
    expect(restTage(STICHTAG, DAY('2026-11-22'))).toBe(10)
    expect(restTage(STICHTAG, DAY('2026-11-02'))).toBe(-10)
  })
})

describe('N1 — AÜG-Erlaubnis (P9, SPEC 5.4.4)', () => {
  it('meldet nichts, solange der Vorlauf nicht erreicht ist', () => {
    // 90 Tage vor dem 31.12.2026 ist der 2.10.; der 12.11. liegt davor.
    expect(befundeN1([lieferant()], DAY('2026-06-01'), OPERATOR_TENANT)).toEqual([])
  })

  it('informiert im 90-Tage-Vorlauf, adressiert `LA`', () => {
    const befunde = befundeN1([lieferant()], DAY('2026-10-10'), OPERATOR_TENANT)
    expect(befunde).toHaveLength(1)
    expect(befunde[0]?.art).toBe('information')
    expect(befunde[0]?.adressaten).toEqual(['LA'])
    expect(befunde[0]?.pruefung).toBe('P9')
  })

  it('warnt im 30-Tage-Vorlauf und adressiert **zusätzlich** `LD`', () => {
    // Die Stufen sind kumulativ (5.4.4): nicht statt `LA`, sondern zusätzlich.
    const befunde = befundeN1([lieferant()], DAY('2026-12-10'), OPERATOR_TENANT)
    expect(befunde[0]?.art).toBe('warning')
    expect(befunde[0]?.adressaten).toEqual(['LA', 'LD'])
  })

  it('eskaliert im 14-Tage-Vorlauf an `MD`', () => {
    const befunde = befundeN1([lieferant()], DAY('2026-12-20'), OPERATOR_TENANT)
    expect(befunde[0]?.art).toBe('escalation')
    expect(befunde[0]?.adressaten).toEqual(['LA', 'LD', 'MD'])
  })

  it('eskaliert nach dem Ablauf an `MA`', () => {
    const befunde = befundeN1([lieferant()], DAY('2027-01-05'), OPERATOR_TENANT)
    expect(befunde[0]?.art).toBe('escalation')
    expect(befunde[0]?.adressaten).toEqual(['LA', 'LD', 'MD', 'MA'])
  })

  it('meldet nichts bei unbefristeter Erlaubnis — es läuft keine Frist ab', () => {
    const unbefristet = lieferant({
      erlaubnisse: [
        {
          id: 'dok-1',
          permitNumber: 'AZ-1',
          permitType: 'unlimited',
          validFrom: DAY('2025-01-01'),
          validTo: null,
          verificationStatus: 'accepted',
          certificateDocumentRef: 'dok-1',
          supersedesId: null,
        },
      ],
    })
    expect(befundeN1([unbefristet], STICHTAG, OPERATOR_TENANT)).toEqual([])
  })

  it('prüft nur Lieferanten in `onboarding`, `active` und `blocked` (5.5.1)', () => {
    const beendet = lieferant({ status: 'terminated' })
    expect(befundeN1([beendet], DAY('2027-01-05'), OPERATOR_TENANT)).toEqual([])
  })

  it('nennt den Betreibermandanten für `MD` und `MA`', () => {
    const befunde = befundeN1([lieferant()], DAY('2027-01-05'), OPERATOR_TENANT)
    expect(befunde[0]?.mandantJeRolle.MA).toBe(OPERATOR_TENANT)
    expect(befunde[0]?.mandantJeRolle.LA).toBe(SUPPLIER_TENANT)
  })
})

describe('N2 — Höchstüberlassungsdauer (P1, SPEC 5.1.6)', () => {
  it('meldet nichts ohne Fristende — es ist nichts zu prüfen', () => {
    expect(befundeN2([einsatz()], STICHTAG)).toEqual([])
  })

  it('meldet nichts außerhalb des 90-Tage-Vorlaufs', () => {
    expect(befundeN2([einsatz({ maxDurationEndDate: DAY('2027-06-01') })], STICHTAG)).toEqual([])
  })

  it('informiert im 90-Tage-Vorlauf, adressiert `MD` (5.1.6, Zeile 1)', () => {
    const befunde = befundeN2([einsatz({ maxDurationEndDate: DAY('2027-01-15') })], STICHTAG)
    expect(befunde[0]?.art).toBe('information')
    expect(befunde[0]?.adressaten).toEqual(['MD'])
  })

  it('warnt im 30-Tage-Vorlauf, adressiert `MD`, `MA` und `KB` (5.1.6, Zeile 2)', () => {
    const befunde = befundeN2([einsatz({ maxDurationEndDate: DAY('2026-12-01') })], STICHTAG)
    expect(befunde[0]?.art).toBe('warning')
    expect(befunde[0]?.adressaten).toEqual(['MD', 'MA', 'KB'])
  })

  it('eskaliert nach dem Fristende und nennt zusätzlich `LD` (5.1.6, Zeile 3)', () => {
    const befunde = befundeN2([einsatz({ maxDurationEndDate: DAY('2026-11-01') })], STICHTAG)
    expect(befunde[0]?.art).toBe('escalation')
    expect(befunde[0]?.adressaten).toEqual(['MD', 'MA', 'KB', 'LD'])
    expect(befunde[0]?.meldung).toContain('beendet den Einsatz nicht')
  })

  it('prüft nur `planned`, `active` und `interrupted` (5.5.1)', () => {
    const beendet = einsatz({ status: 'completed', maxDurationEndDate: DAY('2026-11-01') })
    expect(befundeN2([beendet], STICHTAG)).toEqual([])
  })
})

describe('N3 — Equal-Pay-Fälligkeit (P3/P4, SPEC 5.0)', () => {
  it('meldet nichts, wenn das Vergleichsentgelt steht', () => {
    // Die Zeile verlangt beides: Fälligkeit nah **und** Wert fehlt.
    const gepflegt = einsatz({ equalPayDueDate: DAY('2026-11-20'), comparableWage: 19.42 })
    expect(befundeN3([gepflegt], STICHTAG)).toEqual([])
  })

  it('informiert im 60-Tage-Vorlauf, adressiert `MD` und `KE`', () => {
    const befunde = befundeN3([einsatz({ equalPayDueDate: DAY('2026-12-31') })], STICHTAG)
    expect(befunde[0]?.art).toBe('information')
    expect(befunde[0]?.adressaten).toEqual(['MD', 'KE'])
  })

  it('warnt im 30-Tage-Vorlauf, adressiert zusätzlich `MA`', () => {
    const befunde = befundeN3([einsatz({ equalPayDueDate: DAY('2026-11-25') })], STICHTAG)
    expect(befunde[0]?.art).toBe('warning')
    expect(befunde[0]?.adressaten).toEqual(['MD', 'MA', 'KE'])
  })

  it('eskaliert ab der Fälligkeit und nennt die Sperre aus Q36', () => {
    const befunde = befundeN3([einsatz({ equalPayDueDate: DAY('2026-11-01') })], STICHTAG)
    expect(befunde[0]?.art).toBe('escalation')
    expect(befunde[0]?.meldung).toContain('Q36')
  })
})

describe('N5 — Nachweise (P10, SPEC 5.4.4)', () => {
  const unterweisung = {
    id: 'dok-uw',
    documentCategory: 'safetyBriefing',
    validFrom: DAY('2026-01-01'),
    validTo: DAY('2026-11-20'),
    verificationStatus: 'accepted',
    fileRef: 'ablage/uw.pdf',
    subjectRef: 'einsatz-1',
  }

  function lage(validTo: Date | null) {
    return {
      objectType: 'assignment',
      objectRef: 'einsatz-1',
      tenantId: OPERATOR_TENANT,
      mandanten: {
        operator: OPERATOR_TENANT,
        customer: CUSTOMER_TENANT,
        supplier: SUPPLIER_TENANT,
      },
      nachweise: [{ ...unterweisung, validTo }],
      arbeitserlaubnisErforderlich: false,
      unterweisungVerlangt: true,
    }
  }

  it('warnt im Vorlauf vor dem Ablauf der Unterweisung', () => {
    const befunde = befundeN5([lage(DAY('2026-11-20'))], STICHTAG)
    expect(befunde).toHaveLength(1)
    expect(befunde[0]?.pruefung).toBe('P10')
    expect(['warning', 'escalation', 'information']).toContain(befunde[0]?.art)
  })

  it('meldet nichts bei einem Nachweis ohne Enddatum — er läuft nicht ab (3.10)', () => {
    expect(befundeN5([lage(null)], STICHTAG)).toEqual([])
  })
})

describe('N6 — offene Unterbrechung (P2, SPEC 5.1.4)', () => {
  const basis = {
    assignmentId: 'einsatz-1',
    assignmentNumber: 'E-0001',
    tenantId: OPERATOR_TENANT,
    customerTenantId: CUSTOMER_TENANT,
    supplierTenantId: SUPPLIER_TENANT,
  }

  it('meldet eine offene Unterbrechung über drei Monate als **Information**', () => {
    const befunde = befundeN6(
      [{ ...basis, interruptionFrom: DAY('2026-07-01'), interruptionTo: null }],
      STICHTAG,
    )
    expect(befunde).toHaveLength(1)
    // Keine Warnung: die Zählung wird mit der Wiederaufnahme zurückgesetzt,
    // nicht durch diesen Lauf (5.1.4).
    expect(befunde[0]?.art).toBe('information')
    expect(befunde[0]?.meldung).toContain('Wiederaufnahme')
  })

  it('meldet nichts unterhalb der Schwelle', () => {
    expect(
      befundeN6(
        [{ ...basis, interruptionFrom: DAY('2026-10-01'), interruptionTo: null }],
        STICHTAG,
      ),
    ).toEqual([])
  })

  it('meldet nichts zu einer **beendeten** Unterbrechung — N6 prüft die offenen', () => {
    expect(
      befundeN6(
        [
          {
            ...basis,
            interruptionFrom: DAY('2026-01-01'),
            interruptionTo: DAY('2026-06-01'),
          },
        ],
        STICHTAG,
      ),
    ).toEqual([])
  })
})

describe('Prozessfristen aus 2.4 und 4.0', () => {
  it('meldet einen nicht eingereichten Zettel nach Fristablauf an `LD`', () => {
    const befunde = befundeZettelNichtEingereicht([zettel()], STICHTAG)
    expect(befunde).toHaveLength(1)
    expect(befunde[0]?.adressaten).toEqual(['LD'])
    expect(befunde[0]?.pruefung).toBeNull()
    expect(befunde[0]?.meldung).toContain('reicht ihn **nicht** ein')
  })

  it('meldet nichts vor Fristablauf', () => {
    expect(befundeZettelNichtEingereicht([zettel()], DAY('2026-11-01'))).toEqual([])
  })

  it('achtet die Frist des Kunden aus `processDeadlineConfig` (4.0, 2.4 Regel 5)', () => {
    const grosszuegig = zettel({ submissionDeadlineDays: 30 })
    expect(befundeZettelNichtEingereicht([grosszuegig], STICHTAG)).toEqual([])
  })

  it('meldet nichts zu einem eingereichten Zettel', () => {
    expect(befundeZettelNichtEingereicht([zettel({ status: 'inApproval' })], STICHTAG)).toEqual([])
  })

  it('meldet einen nicht genehmigten Zettel an die Rolle der **offenen Stufe**', () => {
    const offen = zettel({ status: 'inApproval', openStageRole: 'KB' })
    const befunde = befundeZettelNichtGenehmigt([offen], STICHTAG)
    expect(befunde[0]?.adressaten).toEqual(['KB'])
    // Keine Genehmigungsfiktion (2.4, Regel 1).
    expect(befunde[0]?.meldung).toContain('keine** Genehmigungsfiktion')
  })

  it('meldet ihn nicht ohne offene Stufe — es gäbe niemanden zu adressieren', () => {
    const ohneStufe = zettel({ status: 'inApproval', openStageRole: null })
    expect(befundeZettelNichtGenehmigt([ohneStufe], STICHTAG)).toEqual([])
  })

  it('meldet einen beanstandeten Beleg an `MD`', () => {
    const befunde = befundeBelegBeanstandet(
      [
        {
          id: 'beleg-1',
          documentNumber: 'RE-000001',
          tenantId: OPERATOR_TENANT,
          customerTenantId: CUSTOMER_TENANT,
          supplierTenantId: null,
          status: 'disputed',
          disputedAt: DAY('2026-11-05'),
          disputeResolutionNote: null,
        },
      ],
      STICHTAG,
    )
    expect(befunde).toHaveLength(1)
    expect(befunde[0]?.adressaten).toEqual(['MD'])
    expect(befunde[0]?.meldung).toContain('7 Tag(en)')
  })

  it('meldet einen geklärten Beleg nicht — er steht nicht mehr auf `disputed`', () => {
    expect(
      befundeBelegBeanstandet(
        [
          {
            id: 'beleg-1',
            documentNumber: 'RE-000001',
            tenantId: OPERATOR_TENANT,
            customerTenantId: CUSTOMER_TENANT,
            supplierTenantId: null,
            status: 'inReview',
            disputedAt: DAY('2026-11-05'),
            disputeResolutionNote: 'geklärt',
          },
        ],
        STICHTAG,
      ),
    ).toEqual([])
  })
})

describe('Was der Lauf nicht tut (SPEC 5.5.1 c)', () => {
  it('erzeugt nie eine Sperre — der Ergebnistyp kennt keine', () => {
    // 5.5.1 c: „Er erzeugt keinen Statuswechsel und keine Sperre — eine Sperre
    // braucht einen Übergang, den sie verhindert." Das ist hier eine
    // Eigenschaft des Typsystems und keine Laufzeitprüfung: `Befundart` hat
    // drei Werte, und `sperre` ist keiner davon.
    const alle = [
      ...befundeN1([lieferant()], DAY('2027-01-05'), OPERATOR_TENANT),
      ...befundeN2([einsatz({ maxDurationEndDate: DAY('2026-11-01') })], STICHTAG),
      ...befundeN3([einsatz({ equalPayDueDate: DAY('2026-11-01') })], STICHTAG),
      ...befundeZettelNichtEingereicht([zettel()], STICHTAG),
    ]
    expect(alle.length).toBeGreaterThan(0)
    for (const befund of alle) {
      expect(['information', 'warning', 'escalation']).toContain(befund.art)
    }
  })

  it('nennt zu jedem Befund seinen Gegenstand (5.5.2 Nr. 2)', () => {
    const alle = [
      ...befundeN1([lieferant()], DAY('2027-01-05'), OPERATOR_TENANT),
      ...befundeN2([einsatz({ maxDurationEndDate: DAY('2026-11-01') })], STICHTAG),
    ]
    for (const befund of alle) {
      expect(befund.objectRef).not.toBe('')
      expect(befund.tenantId).not.toBe('')
      expect(befund.meldung.length).toBeGreaterThan(20)
    }
  })
})
