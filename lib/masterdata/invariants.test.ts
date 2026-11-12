/**
 * Die Invarianten des Dokuments (SPEC 3.10).
 *
 * Der Kern ist die erste Gruppe: **genau ein** Bezugsobjekt. Der Mandant eines
 * Dokuments folgt nach 3.10 seinem Bezugsobjekt — zwei Bezüge heißen zwei
 * Mandanten, und damit keine bestimmbare Sichtbarkeit (2.3). Das ist keine
 * Formalie, sondern die Datentrennung.
 */

import { describe, expect, it } from 'vitest'
import {
  DokumentInvarianteError,
  pruefeAbrechnungsbeleg,
  pruefeAnsprechpartner,
  pruefeDokument,
  pruefeDokumentOderWirf,
  pruefeErlaubnis,
  pruefeLieferant,
  pruefePreisposition,
  pruefeRahmenvertrag,
  pruefeZeitposition,
  pruefeZeitpositionen,
  pruefeZeitpositionOderWirf,
  StammdatenInvarianteError,
  wirfBeiVerletzung,
  type Dokumentfelder,
} from './invariants'

function felder(teile: Partial<Dokumentfelder> = {}): Dokumentfelder {
  return {
    documentCategory: 'workPermit',
    subjectType: 'candidate',
    supplierId: null,
    customerId: null,
    candidateId: 'KA-1',
    assignmentId: null,
    siteId: null,
    masterAgreementId: null,
    fileRef: 'ablage://synthetisch/ae-1',
    fileName: 'arbeitserlaubnis.pdf',
    mimeType: 'application/pdf',
    verificationStatus: 'accepted',
    verifiedAt: new Date('2026-01-10T00:00:00.000Z'),
    verifiedById: 'U-MD',
    rejectionReason: null,
    validFrom: new Date('2026-01-01T00:00:00.000Z'),
    validTo: new Date('2026-12-31T00:00:00.000Z'),
    confidentiality: 'operatorAndOwner',
    ...teile,
  }
}

const felderVon = (teile: Partial<Dokumentfelder>) =>
  pruefeDokument(felder(teile)).map((v) => v.feld)

describe('Genau ein Bezugsobjekt (SPEC 3.10)', () => {
  it('nimmt ein Dokument mit passendem Verweis an', () => {
    expect(pruefeDokument(felder())).toEqual([])
  })

  it('beanstandet den fehlenden Verweis zur genannten Art', () => {
    expect(felderVon({ candidateId: null })).toContain('candidateId')
  })

  it('beanstandet einen zweiten Verweis', () => {
    // Der Mandant folgt dem Bezugsobjekt; zwei Bezüge ergeben zwei Mandanten.
    expect(felderVon({ assignmentId: 'E-1' })).toContain('assignmentId')
  })

  it('beanstandet einen Verweis, der zur Art nicht passt', () => {
    const verletzungen = pruefeDokument(
      felder({ subjectType: 'assignment', candidateId: 'KA-1', assignmentId: null }),
    )
    expect(verletzungen.map((v) => v.feld)).toEqual(['assignmentId', 'candidateId'])
  })
})

describe('Ablageangaben sind Pflicht (SPEC 3.10, 5.4.5)', () => {
  it('beanstandet eine fehlende Ablage', () => {
    // 5.4.5: ein Nachweis ohne hinterlegte Datei ist ein Datenfehler, und P9
    // wie P10 rechnen ihn als solchen. Deshalb darf er gar nicht entstehen.
    expect(felderVon({ fileRef: '  ' })).toEqual(['fileRef'])
    expect(felderVon({ fileName: '' })).toEqual(['fileName'])
    expect(felderVon({ mimeType: '' })).toEqual(['mimeType'])
  })
})

describe('Die Anerkennung trägt ihre Belege (SPEC 3.10, 5.4.3)', () => {
  it('verlangt Zeitpunkt und Person bei `accepted`', () => {
    expect(felderVon({ verifiedAt: null })).toEqual(['verifiedAt, verifiedBy'])
    expect(felderVon({ verifiedById: null })).toEqual(['verifiedAt, verifiedBy'])
  })

  it('verlangt sie bei `submitted` nicht', () => {
    expect(
      pruefeDokument(
        felder({ verificationStatus: 'submitted', verifiedAt: null, verifiedById: null }),
      ),
    ).toEqual([])
  })

  it('verlangt den Zurückweisungsgrund bei `rejected`', () => {
    expect(
      felderVon({ verificationStatus: 'rejected', verifiedAt: null, verifiedById: null }),
    ).toEqual(['rejectionReason'])
  })
})

describe('Gültigkeit und Katalog', () => {
  it('beanstandet einen rückwärts laufenden Zeitraum', () => {
    expect(
      felderVon({
        validFrom: new Date('2026-12-31T00:00:00.000Z'),
        validTo: new Date('2026-01-01T00:00:00.000Z'),
      }),
    ).toEqual(['validTo'])
  })

  it('lässt ein unbefristetes Dokument zu', () => {
    expect(pruefeDokument(felder({ validTo: null }))).toEqual([])
  })

  it('bindet die Erlaubnisurkunde an den Lieferanten (3.2, 3.10)', () => {
    expect(
      felderVon({ documentCategory: 'permitCertificate' }),
    ).toContain('subjectType')
    expect(
      pruefeDokument(
        felder({
          documentCategory: 'permitCertificate',
          subjectType: 'supplier',
          candidateId: null,
          supplierId: 'LI-1',
        }),
      ),
    ).toEqual([])
  })
})

describe('Sichtbarkeitsklasse (SPEC 3.10, Fußnote [35])', () => {
  it('lässt die Unterweisung einsatzbezogen sein', () => {
    expect(
      felderVon({
        documentCategory: 'safetyBriefing',
        subjectType: 'assignment',
        candidateId: null,
        assignmentId: 'E-1',
        confidentiality: 'assignmentParties',
      }),
    ).toEqual([])
  })

  it('verweigert die einsatzbezogene Sicht auf die Erlaubnisurkunde', () => {
    // 3.10 führt das Feld mit dem Satz ein, der Kunde sehe „nicht die
    // Vertragsunterlagen des Lieferanten". `assignmentParties` an der Urkunde
    // widerspricht genau diesem Satz.
    expect(
      felderVon({
        documentCategory: 'permitCertificate',
        subjectType: 'supplier',
        candidateId: null,
        supplierId: 'LI-1',
        confidentiality: 'assignmentParties',
      }),
    ).toEqual(['confidentiality'])
  })

  it('verweigert sie auch an der Unbedenklichkeitsbescheinigung', () => {
    expect(
      felderVon({
        documentCategory: 'clearanceCertificate',
        subjectType: 'supplier',
        candidateId: null,
        supplierId: 'LI-1',
        confidentiality: 'assignmentParties',
      }),
    ).toEqual(['confidentiality'])
  })

  it('lässt die Urkunde als `operatorAndOwner` zu', () => {
    expect(
      felderVon({
        documentCategory: 'permitCertificate',
        subjectType: 'supplier',
        candidateId: null,
        supplierId: 'LI-1',
        confidentiality: 'operatorAndOwner',
      }),
    ).toEqual([])
  })
})

describe('Alle Verletzungen auf einmal', () => {
  it('meldet nicht nur die erste', () => {
    // Wer Daten einstellt, soll sie in einem Durchgang berichtigen können.
    const verletzungen = pruefeDokument(
      felder({ candidateId: null, fileRef: '', verifiedAt: null }),
    )
    expect(verletzungen.length).toBe(3)
  })

  it('wirft mit Bezeichnung und Fundstelle', () => {
    expect(() => pruefeDokumentOderWirf(felder({ fileRef: '' }), 'DOK-1')).toThrow(
      DokumentInvarianteError,
    )
    expect(() => pruefeDokumentOderWirf(felder({ fileRef: '' }), 'DOK-1')).toThrow(/SPEC 3.10/)
  })

  it('wirft nicht, wenn alles trägt', () => {
    expect(() => pruefeDokumentOderWirf(felder(), 'DOK-1')).not.toThrow()
  })
})

/**
 * Die vier Invarianten, auf die das Schema seit 3.1 bis 3.3 zeigt und deren
 * Prüfung bis zur Arbeitseinheit zu 5.4.3 teils inline und teils nirgends
 * stand.
 */
describe('Ansprechpartner (SPEC 3.1, 3.2)', () => {
  it('nimmt genau einen Eigentümer an', () => {
    expect(
      pruefeAnsprechpartner({ customerId: 'KU-1', siteId: null, supplierId: null }),
    ).toEqual([])
    expect(
      pruefeAnsprechpartner({ customerId: null, siteId: 'ST-1', supplierId: null }),
    ).toEqual([])
  })

  it('verweigert keinen und mehrere', () => {
    expect(
      pruefeAnsprechpartner({ customerId: null, siteId: null, supplierId: null }).length,
    ).toBe(1)
    expect(
      pruefeAnsprechpartner({ customerId: 'KU-1', siteId: null, supplierId: 'LI-1' }).length,
    ).toBe(1)
  })
})

describe('Lieferant (SPEC 3.2, Tarifbindung ab `active`)', () => {
  it('lässt den Lieferanten in `onboarding` ohne Tarifbindung zu', () => {
    expect(
      pruefeLieferant({ status: 'onboarding', supplierCollectiveAgreementId: null }),
    ).toEqual([])
  })

  it('verlangt sie ab `active`', () => {
    expect(
      pruefeLieferant({ status: 'active', supplierCollectiveAgreementId: null }).map(
        (v) => v.feld,
      ),
    ).toEqual(['supplierCollectiveAgreementId'])
    expect(
      pruefeLieferant({ status: 'active', supplierCollectiveAgreementId: 'TZ-1' }),
    ).toEqual([])
  })
})

describe('AÜG-Erlaubnis (SPEC 3.2)', () => {
  const erlaubnis = (teile: Partial<Parameters<typeof pruefeErlaubnis>[0]> = {}) =>
    pruefeErlaubnis({
      permitType: 'fixedTerm',
      validFrom: new Date('2026-01-01T00:00:00.000Z'),
      validTo: new Date('2029-12-31T00:00:00.000Z'),
      verificationStatus: 'accepted',
      verifiedAt: new Date('2026-01-05T00:00:00.000Z'),
      verifiedById: 'U-MD',
      rejectionReason: null,
      ...teile,
    }).map((v) => v.feld)

  it('nimmt den befristeten Satz mit Ende an', () => {
    expect(erlaubnis()).toEqual([])
  })

  it('verweigert den befristeten Satz ohne Ende — nach 5.4.6 ein Datenfehler', () => {
    expect(erlaubnis({ validTo: null })).toEqual(['validTo'])
  })

  it('verweigert den unbefristeten Satz mit Ende', () => {
    expect(erlaubnis({ permitType: 'unlimited' })).toEqual(['validTo'])
  })

  it('verweigert einen rückwärts laufenden Zeitraum', () => {
    expect(erlaubnis({ validTo: new Date('2025-01-01T00:00:00.000Z') })).toEqual(['validTo'])
  })

  it('verlangt die Belege der Anerkennung', () => {
    expect(erlaubnis({ verifiedAt: null })).toEqual(['verifiedAt, verifiedBy'])
    expect(
      erlaubnis({ verificationStatus: 'rejected', verifiedAt: null, verifiedById: null }),
    ).toEqual(['rejectionReason'])
  })
})

describe('Rahmenvertrag (SPEC 3.3)', () => {
  it('nimmt den Kundenvertrag mit Kunden an', () => {
    expect(
      pruefeRahmenvertrag({
        agreementType: 'customerAgreement',
        customerId: 'KU-1',
        supplierId: null,
      }),
    ).toEqual([])
  })

  it('verlangt die zur Vertragsart passende Gegenpartei', () => {
    expect(
      pruefeRahmenvertrag({
        agreementType: 'supplierAgreement',
        customerId: 'KU-1',
        supplierId: null,
      }).map((v) => v.feld),
    ).toEqual(['supplierId', 'customerId'])
  })

  it('verweigert den Direktvertrag, den 3.3 nicht vorsieht', () => {
    expect(
      pruefeRahmenvertrag({
        agreementType: 'customerAgreement',
        customerId: 'KU-1',
        supplierId: 'LI-1',
      }).map((v) => v.feld),
    ).toEqual(['supplierId'])
  })
})

describe('Preisposition (SPEC 3.3)', () => {
  it('verlangt beim Grundsatz Qualifikationsstufe und Verrechnungssatz', () => {
    expect(
      pruefePreisposition({
        itemType: 'baseRate',
        qualificationLevel: null,
        hourlyRate: null,
        premiumTypeId: null,
        premiumValue: null,
      }).map((v) => v.feld),
    ).toEqual(['qualificationLevel', 'hourlyRate'])
  })

  it('verlangt beim Zuschlagssatz Zuschlagsart und Zuschlagswert', () => {
    expect(
      pruefePreisposition({
        itemType: 'premiumRate',
        qualificationLevel: null,
        hourlyRate: null,
        premiumTypeId: null,
        premiumValue: null,
      }).map((v) => v.feld),
    ).toEqual(['premiumTypeId', 'premiumValue'])
  })

  it('nimmt die vollständigen Positionen an', () => {
    expect(
      pruefePreisposition({
        itemType: 'baseRate',
        qualificationLevel: 'Fachkraft',
        hourlyRate: '24.50',
        premiumTypeId: null,
        premiumValue: null,
      }),
    ).toEqual([])
    expect(
      pruefePreisposition({
        itemType: 'premiumRate',
        qualificationLevel: null,
        hourlyRate: null,
        premiumTypeId: 'ZA-1',
        premiumValue: '25.00',
      }),
    ).toEqual([])
  })
})

describe('Werfen mit Fundstelle', () => {
  it('wirft bei einer Verletzung und nennt die Fundstelle', () => {
    expect(() =>
      wirfBeiVerletzung(
        pruefeLieferant({ status: 'active', supplierCollectiveAgreementId: null }),
        'Lieferant L-1',
      ),
    ).toThrow(StammdatenInvarianteError)
    expect(() =>
      wirfBeiVerletzung(
        pruefeLieferant({ status: 'active', supplierCollectiveAgreementId: null }),
        'Lieferant L-1',
      ),
    ).toThrow(/SPEC 3.2/)
  })

  it('wirft nicht, wenn nichts verletzt ist', () => {
    expect(() => wirfBeiVerletzung([], 'Lieferant L-1')).not.toThrow()
  })
})

describe('Zeitposition: die vier Invarianten (SPEC 3.8)', () => {
  const TAG = new Date('2026-11-11T00:00:00.000Z')

  const tagessumme = (teile: Partial<Parameters<typeof pruefeZeitposition>[0]> = {}) => ({
    workDate: TAG,
    startMinute: null,
    endMinute: null,
    breakMinutes: null,
    hours: 8,
    ...teile,
  })

  const abschnitt = (teile: Partial<Parameters<typeof pruefeZeitposition>[0]> = {}) => ({
    workDate: TAG,
    startMinute: 8 * 60,
    endMinute: 16 * 60,
    breakMinutes: 30,
    hours: 7.5,
    ...teile,
  })

  it('nimmt eine Tagessumme an', () => {
    expect(pruefeZeitposition(tagessumme())).toEqual([])
  })

  it('nimmt einen Abschnitt an, dessen Menge der Dauer entspricht', () => {
    expect(pruefeZeitposition(abschnitt())).toEqual([])
  })

  it('nimmt einen Abschnitt über Mitternacht an — die Nachtschicht ist der Regelfall', () => {
    // 22:00 bis 06:00, 30 Minuten Pause → 7,5 Stunden.
    expect(
      pruefeZeitposition(
        abschnitt({ startMinute: 22 * 60, endMinute: 6 * 60, breakMinutes: 30, hours: 7.5 }),
      ),
    ).toEqual([])
  })

  // ── Invariante 1 ────────────────────────────────────────────────────────
  it('beanstandet eine halbe Uhrzeit — das ist keine Erfassungsform', () => {
    const verletzungen = pruefeZeitposition(tagessumme({ startMinute: 8 * 60 }))
    expect(verletzungen.map((eintrag) => eintrag.feld)).toContain('startTime/endTime')
  })

  it('beanstandet eine Uhrzeit außerhalb des Tages', () => {
    const verletzungen = pruefeZeitposition(
      abschnitt({ startMinute: 24 * 60, endMinute: 2 * 60, hours: 2 }),
    )
    expect(verletzungen.map((eintrag) => eintrag.feld)).toContain('startTime')
  })

  // ── Invariante 2 ────────────────────────────────────────────────────────
  it('beanstandet eine Pause an einer Tagessumme — dort wäre sie doppelt abgezogen', () => {
    const verletzungen = pruefeZeitposition(tagessumme({ breakMinutes: 30 }))
    expect(verletzungen.map((eintrag) => eintrag.feld)).toContain('breakMinutes')
  })

  it('beanstandet eine negative Pause', () => {
    const verletzungen = pruefeZeitposition(abschnitt({ breakMinutes: -30, hours: 8.5 }))
    expect(verletzungen.map((eintrag) => eintrag.feld)).toContain('breakMinutes')
  })

  // ── Invariante 3 ────────────────────────────────────────────────────────
  it('beanstandet eine Menge, die nicht der Dauer entspricht', () => {
    const verletzungen = pruefeZeitposition(abschnitt({ hours: 8 }))
    expect(verletzungen).toHaveLength(1)
    expect(verletzungen[0]?.grund).toContain('die Menge die Dauer')
  })

  it('duldet eine Abweichung von einer Sekunde — Dezimalstunden sind nicht exakt', () => {
    expect(pruefeZeitposition(abschnitt({ hours: 7.5 - 1 / 3600 / 2 }))).toEqual([])
  })

  it('beanstandet eine Pause, die den Abschnitt aufzehrt', () => {
    const verletzungen = pruefeZeitposition(
      abschnitt({ startMinute: 8 * 60, endMinute: 9 * 60, breakMinutes: 60, hours: 1 }),
    )
    expect(verletzungen.map((eintrag) => eintrag.grund)).toContain(
      'Die Pause ist so lang wie der Abschnitt oder länger — es bleibt keine Arbeitszeit.',
    )
  })

  // ── Nur produktive Zeiten (Entscheidung zu Frage 21) ────────────────────
  it('beanstandet eine Position ohne Stunden — eine Abwesenheit wird nicht erfasst', () => {
    const verletzungen = pruefeZeitposition(tagessumme({ hours: 0 }))
    expect(verletzungen.map((eintrag) => eintrag.grund.slice(0, 40))).toContain(
      'Erfasst werden ausschließlich produktive',
    )
  })

  it('beanstandet negative Stunden', () => {
    expect(pruefeZeitposition(tagessumme({ hours: -1 })).length).toBeGreaterThan(0)
  })

  // ── Invariante 4 ────────────────────────────────────────────────────────
  it('nimmt zwei Abschnitte desselben Tages an, die sich nicht überlappen', () => {
    expect(
      pruefeZeitpositionen([
        abschnitt({ startMinute: 6 * 60, endMinute: 10 * 60, breakMinutes: null, hours: 4 }),
        abschnitt({ startMinute: 14 * 60, endMinute: 18 * 60, breakMinutes: null, hours: 4 }),
      ]),
    ).toEqual([])
  })

  it('beanstandet zwei überlappende Abschnitte — dieselbe Stunde zweimal', () => {
    const verletzungen = pruefeZeitpositionen([
      abschnitt({ startMinute: 6 * 60, endMinute: 12 * 60, breakMinutes: null, hours: 6 }),
      abschnitt({ startMinute: 10 * 60, endMinute: 14 * 60, breakMinutes: null, hours: 4 }),
    ])
    expect(verletzungen).toHaveLength(1)
    expect(verletzungen[0]?.grund).toContain('überlappen')
  })

  it('beanstandet eine Überlappung über Mitternacht hinweg', () => {
    const verletzungen = pruefeZeitpositionen([
      abschnitt({ startMinute: 22 * 60, endMinute: 2 * 60, breakMinutes: null, hours: 4 }),
      abschnitt({ startMinute: 23 * 60, endMinute: 1 * 60, breakMinutes: null, hours: 2 }),
    ])
    expect(verletzungen).toHaveLength(1)
  })

  it('lässt Abschnitte verschiedener Tage unberührt', () => {
    expect(
      pruefeZeitpositionen([
        abschnitt({ startMinute: 8 * 60, endMinute: 16 * 60, breakMinutes: null, hours: 8 }),
        abschnitt({
          workDate: new Date('2026-11-12T00:00:00.000Z'),
          startMinute: 8 * 60,
          endMinute: 16 * 60,
          breakMinutes: null,
          hours: 8,
        }),
      ]),
    ).toEqual([])
  })

  it('prüft Tagessummen nicht auf Überlappung — sie tragen keine Uhrzeit', () => {
    expect(pruefeZeitpositionen([tagessumme(), tagessumme({ hours: 4 })])).toEqual([])
  })

  it('wirft mit Fundstelle', () => {
    expect(() => pruefeZeitpositionOderWirf(tagessumme({ hours: 0 }), 'ZP-1')).toThrow(/SPEC 3\.8/)
    expect(() => pruefeZeitpositionOderWirf(tagessumme(), 'ZP-1')).not.toThrow()
  })
})

describe('Abrechnungsbeleg (SPEC 3.9)', () => {
  const beleg = {
    documentType: 'customerInvoice',
    direction: 'sales',
    customerId: 'kunde-1',
    supplierId: null,
    taxRate: 19,
  }

  it('nimmt einen Verkaufsbeleg mit Kunde und Steuersatz an', () => {
    expect(pruefeAbrechnungsbeleg(beleg)).toEqual([])
  })

  it('nimmt eine Gutschrift mit Lieferant an', () => {
    expect(
      pruefeAbrechnungsbeleg({
        documentType: 'supplierCreditNote',
        direction: 'purchase',
        customerId: null,
        supplierId: 'lieferant-1',
        taxRate: 19,
      }),
    ).toEqual([])
  })

  it('beanstandet eine Seite, die nicht zur Belegart passt', () => {
    // Daran hängt mehr als eine Anzeige: die Sichtbarkeit (2.3) und die
    // Fußnoten [31] und [32] richten sich nach der Seite.
    expect(
      pruefeAbrechnungsbeleg({ ...beleg, documentType: 'supplierCreditNote' }).map((v) => v.feld),
    ).toEqual(['direction'])
  })

  it('beanstandet einen Verkaufsbeleg ohne Kunden', () => {
    expect(pruefeAbrechnungsbeleg({ ...beleg, customerId: null }).map((v) => v.feld)).toEqual([
      'customerId',
    ])
  })

  it('beanstandet einen Verkaufsbeleg **mit** Lieferanten — ein Beleg hat eine Gegenpartei', () => {
    expect(
      pruefeAbrechnungsbeleg({ ...beleg, supplierId: 'lieferant-1' }).map((v) => v.feld),
    ).toEqual(['supplierId'])
  })

  it('beanstandet eine Gutschrift ohne Lieferanten und mit Kunden', () => {
    expect(
      pruefeAbrechnungsbeleg({
        documentType: 'supplierCreditNote',
        direction: 'purchase',
        customerId: 'kunde-1',
        supplierId: null,
        taxRate: 19,
      }).map((v) => v.feld),
    ).toEqual(['supplierId', 'customerId'])
  })

  it('beanstandet einen fehlenden Steuersatz und nennt offene Frage 52', () => {
    const verletzungen = pruefeAbrechnungsbeleg({ ...beleg, taxRate: null })
    expect(verletzungen.map((v) => v.feld)).toEqual(['taxRate'])
    expect(verletzungen[0]?.grund).toContain('offene Frage 52')
  })

  it('nimmt 0 % an — ein Satz von null ist eine Angabe, kein fehlender Wert', () => {
    expect(pruefeAbrechnungsbeleg({ ...beleg, taxRate: 0 })).toEqual([])
  })
})
