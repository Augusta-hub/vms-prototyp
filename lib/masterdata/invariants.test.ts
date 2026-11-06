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
  pruefeDokument,
  pruefeDokumentOderWirf,
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
