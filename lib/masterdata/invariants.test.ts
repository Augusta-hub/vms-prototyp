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
  pruefeAnsprechpartner,
  pruefeDokument,
  pruefeDokumentOderWirf,
  pruefeErlaubnis,
  pruefeLieferant,
  pruefePreisposition,
  pruefeRahmenvertrag,
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
        premiumTypeRef: null,
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
        premiumTypeRef: null,
        premiumValue: null,
      }).map((v) => v.feld),
    ).toEqual(['premiumTypeRef', 'premiumValue'])
  })

  it('nimmt die vollständigen Positionen an', () => {
    expect(
      pruefePreisposition({
        itemType: 'baseRate',
        qualificationLevel: 'Fachkraft',
        hourlyRate: '24.50',
        premiumTypeRef: null,
        premiumValue: null,
      }),
    ).toEqual([])
    expect(
      pruefePreisposition({
        itemType: 'premiumRate',
        qualificationLevel: null,
        hourlyRate: null,
        premiumTypeRef: 'ZA-1',
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
