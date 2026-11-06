/**
 * Der Nachweisdienst gegen eine echte Datenbank — SPEC 3.10 und **5.4.3**.
 *
 * Was hier geprüft wird und **nirgends sonst**: dass der Mandant eines
 * Nachweises wirklich dem Bezugsobjekt folgt (3.10), dass die Sichtbarkeit der
 * Fußnoten [35], [36] und [37] an echten Zeilen trägt, dass die drei Übergänge
 * aus 5.4.3 schreiben, was sie sollen, und dass P10 nach der Entscheidung neu
 * gerechnet wird, **ohne** zu sperren (5.5.1 b).
 *
 * Die Rechnung selbst steht ohne Datenbank in `lib/aueg/` und der Fluss in
 * `lib/status/document.test.ts`. Hier geht es um die Naht.
 *
 * Alle Daten sind synthetisch (CLAUDE.md, Regel 3), und die Tests laufen gegen
 * eine **eigene** Datenbank (`tests/services/umgebung.ts`).
 */

import { beforeEach, describe, expect, it } from 'vitest'
import { loadIdentity, type LoadedIdentity } from '../../lib/identity/loadSubject'
import { prisma } from '../../lib/prisma'
import {
  acceptDocument,
  loadDocument,
  loadDocuments,
  rejectDocument,
  submitDocument,
} from '../../lib/services/documents'
import { baueWelt, legeEinsatzAn, legeNachweisAn, leereDatenbank, tag, type Welt } from './fixture'

let welt: Welt
let administrator: LoadedIdentity
let disponent: LoadedIdentity
let lieferantAdmin: LoadedIdentity
let bedarfstraeger: LoadedIdentity
let einkauf: LoadedIdentity

async function identitaet(userId: string): Promise<LoadedIdentity> {
  const geladen = await loadIdentity(userId)
  if (geladen === null) throw new Error('Die Testidentität ließ sich nicht laden.')
  return geladen
}

beforeEach(async () => {
  await leereDatenbank()
  welt = await baueWelt()
  administrator = await identitaet(welt.administrator)
  disponent = await identitaet(welt.disponent)
  lieferantAdmin = await identitaet(welt.lieferantAdmin)
  bedarfstraeger = await identitaet(welt.bedarfstraeger)
  einkauf = await identitaet(welt.einkauf)
})

/** Ein Nachweis zum eigenen Kandidaten, eingestellt durch `LA` (5.4.3). */
async function stelleQualifikationEin(): Promise<string> {
  const ergebnis = await submitDocument(lieferantAdmin, {
    documentCategory: 'qualificationCertificate',
    subjectType: 'candidate',
    subjectId: welt.kandidat,
    fileName: 'schweisspass.pdf',
    mimeType: 'application/pdf',
    issuer: 'Bildungswerk (synthetisch)',
    issuedOn: tag('2026-03-01'),
    validFrom: tag('2026-03-01'),
    validTo: tag('2029-02-28'),
    confidentiality: 'assignmentParties',
  })
  expect(ergebnis.ok).toBe(true)
  const zeile = await prisma.document.findFirstOrThrow({
    where: { candidateId: welt.kandidat, documentCategory: 'qualificationCertificate' },
  })
  return zeile.id
}

describe('Einstellen (— → submitted, SPEC 5.4.3)', () => {
  it('legt den Nachweis im Mandanten des **Bezugsobjekts** an (3.10)', async () => {
    const id = await stelleQualifikationEin()
    const zeile = await prisma.document.findUniqueOrThrow({ where: { id } })
    // Der Kandidat gehört dem Lieferanten — nicht dem Betreiber, in dessen
    // Mandanten die Vorgänge sonst liegen.
    expect(zeile.tenantId).toBe(welt.lieferantMandant)
    expect(zeile.verificationStatus).toBe('submitted')
    expect(zeile.verifiedAt).toBeNull()
    expect(zeile.uploadedById).toBe(welt.lieferantAdmin)
    expect(zeile.documentNumber).toMatch(/^DOK-\d{4}-\d{4}$/)
  })

  it('verweigert den Nachweis zum Kandidaten eines **anderen** Lieferanten (2.3)', async () => {
    const ergebnis = await submitDocument(lieferantAdmin, {
      documentCategory: 'qualificationCertificate',
      subjectType: 'candidate',
      subjectId: welt.kandidatZweiterLieferant,
      fileName: 'fremd.pdf',
      mimeType: 'application/pdf',
      issuer: null,
      issuedOn: null,
      validFrom: null,
      validTo: null,
      confidentiality: 'assignmentParties',
    })
    expect(ergebnis.ok).toBe(false)
    if (!ergebnis.ok) expect(ergebnis.specReference).toBe('SPEC 2.3, Grundsatz')
    expect(await prisma.document.count({ where: { fileName: 'fremd.pdf' } })).toBe(0)
  })

  it('verweigert dem Bedarfsträger das Einstellen — 2.2 gibt ihm kein `A` (offene Frage 42)', async () => {
    const einsatz = await legeEinsatzAn(welt, {
      nummer: 'E-1',
      status: 'planned',
      plannedStartDate: tag('2027-01-04'),
      plannedEndDate: tag('2027-06-30'),
    })
    const ergebnis = await submitDocument(bedarfstraeger, {
      documentCategory: 'safetyBriefing',
      subjectType: 'assignment',
      subjectId: einsatz,
      fileName: 'unterweisung.pdf',
      mimeType: 'application/pdf',
      issuer: null,
      issuedOn: null,
      validFrom: tag('2027-01-04'),
      validTo: tag('2027-12-31'),
      confidentiality: 'assignmentParties',
    })
    expect(ergebnis.ok).toBe(false)
    if (!ergebnis.ok) expect(ergebnis.specReference).toBe('SPEC 2.2')
  })

  it('verweigert die Erlaubnisurkunde an einem anderen Bezugsobjekt (3.10, Invariante)', async () => {
    const ergebnis = await submitDocument(lieferantAdmin, {
      documentCategory: 'permitCertificate',
      subjectType: 'candidate',
      subjectId: welt.kandidat,
      fileName: 'urkunde.pdf',
      mimeType: 'application/pdf',
      issuer: null,
      issuedOn: null,
      validFrom: null,
      validTo: null,
      confidentiality: 'operatorAndOwner',
    })
    expect(ergebnis.ok).toBe(false)
    if (!ergebnis.ok) expect(ergebnis.specReference).toMatch(/3\.10/)
  })

  it('verweigert die einsatzbezogene Sicht auf eine Vertragsunterlage (3.10, [35])', async () => {
    const ergebnis = await submitDocument(lieferantAdmin, {
      documentCategory: 'clearanceCertificate',
      subjectType: 'supplier',
      subjectId: welt.lieferant,
      fileName: 'unbedenklichkeit.pdf',
      mimeType: 'application/pdf',
      issuer: null,
      issuedOn: null,
      validFrom: null,
      validTo: null,
      confidentiality: 'assignmentParties',
    })
    expect(ergebnis.ok).toBe(false)
    if (!ergebnis.ok) expect(ergebnis.error).toMatch(/confidentiality|Vertragsunterlage/)
  })
})

describe('Anerkennen (submitted → accepted, SPEC 5.4.3)', () => {
  it('setzt Status, Zeitpunkt und Person und rechnet P10 neu', async () => {
    const id = await stelleQualifikationEin()
    const ergebnis = await acceptDocument(disponent, { documentId: id, rejectionReason: null })
    expect(ergebnis.ok).toBe(true)
    if (ergebnis.ok) {
      expect(ergebnis.message).toMatch(/anerkannt/)
      expect(ergebnis.message).toMatch(/P10 neu gerechnet/)
    }
    const zeile = await prisma.document.findUniqueOrThrow({ where: { id } })
    expect(zeile.verificationStatus).toBe('accepted')
    expect(zeile.verifiedById).toBe(welt.disponent)
    expect(zeile.verifiedAt).not.toBeNull()
  })

  it('verweigert die Anerkennung durch den Einsteller — auch beim Betreiber (5.4.3)', async () => {
    // Der Betreiberadministrator darf nach 2.2 beides. 5.4.3 schließt aus, dass
    // er **dasselbe** Dokument einstellt und anerkennt.
    const eingestellt = await submitDocument(administrator, {
      documentCategory: 'agreementDocument',
      subjectType: 'supplier',
      subjectId: welt.lieferant,
      fileName: 'vertragsunterlage.pdf',
      mimeType: 'application/pdf',
      issuer: null,
      issuedOn: null,
      validFrom: null,
      validTo: null,
      confidentiality: 'operatorAndOwner',
    })
    expect(eingestellt.ok).toBe(true)
    const zeile = await prisma.document.findFirstOrThrow({
      where: { documentCategory: 'agreementDocument' },
    })
    const ergebnis = await acceptDocument(administrator, {
      documentId: zeile.id,
      rejectionReason: null,
    })
    expect(ergebnis.ok).toBe(false)
    if (!ergebnis.ok) {
      expect(ergebnis.error).toMatch(/Vier-Augen/)
      expect(ergebnis.specReference).toMatch(/5\.4\.3/)
    }
    const unverändert = await prisma.document.findUniqueOrThrow({ where: { id: zeile.id } })
    expect(unverändert.verificationStatus).toBe('submitted')
  })

  it('verlangt bei leerem `validTo` die ausdrückliche Entscheidung (5.4.3)', async () => {
    const eingestellt = await submitDocument(lieferantAdmin, {
      documentCategory: 'workPermit',
      subjectType: 'candidate',
      subjectId: welt.kandidat,
      fileName: 'arbeitserlaubnis.pdf',
      mimeType: 'application/pdf',
      issuer: null,
      issuedOn: null,
      validFrom: tag('2026-01-01'),
      validTo: null,
      confidentiality: 'operatorAndOwner',
    })
    expect(eingestellt.ok).toBe(true)
    const zeile = await prisma.document.findFirstOrThrow({
      where: { documentCategory: 'workPermit' },
    })

    const ohne = await acceptDocument(disponent, { documentId: zeile.id, rejectionReason: null })
    expect(ohne.ok).toBe(false)

    // Mit der Entscheidung ist es zulässig — und trägt eine **Information** an
    // MD, keine Sperre (5.4.4, „Nachweis ohne validTo").
    const mit = await acceptDocument(disponent, {
      documentId: zeile.id,
      rejectionReason: null,
      validToDeliberatelyOpen: true,
    })
    expect(mit.ok).toBe(true)
    if (mit.ok) expect(mit.message).toMatch(/Information an MD/)
  })

  it('sperrt das Anerkennen nicht, wenn P10 danach einen Mangel findet (5.5.1 b)', async () => {
    // Ein Nachweis, der am Tag der Anerkennung schon abgelaufen ist: P10 stellt
    // das fest, und die Anerkennung geht trotzdem durch. „Gesperrt werden
    // Handlungen, nicht Feststellungen" — und die Anerkennung bezieht sich auf
    // das Schriftstück, nicht auf den Zeitraum (5.4.3).
    const eingestellt = await submitDocument(lieferantAdmin, {
      documentCategory: 'qualificationCertificate',
      subjectType: 'candidate',
      subjectId: welt.kandidat,
      fileName: 'abgelaufen.pdf',
      mimeType: 'application/pdf',
      issuer: null,
      issuedOn: null,
      validFrom: tag('2023-01-01'),
      validTo: tag('2023-12-31'),
      confidentiality: 'assignmentParties',
    })
    expect(eingestellt.ok).toBe(true)
    const zeile = await prisma.document.findFirstOrThrow({ where: { fileName: 'abgelaufen.pdf' } })
    const ergebnis = await acceptDocument(disponent, {
      documentId: zeile.id,
      rejectionReason: null,
    })
    expect(ergebnis.ok).toBe(true)
    if (ergebnis.ok) expect(ergebnis.message).toMatch(/abgelaufen/)
    expect(
      (await prisma.document.findUniqueOrThrow({ where: { id: zeile.id } })).verificationStatus,
    ).toBe('accepted')
  })

  it('rechnet beim Anerkennen nur die geänderte Nachweisart neu (5.5.1 b)', async () => {
    // Die Sammelprüfung über alle Pflichtarten gehört zum **Übergang** (Q21).
    // Bei der Speicherung würde sie Mängel melden, die mit diesem Nachweis
    // nichts zu tun haben — etwa eine fehlende Unterweisung, während eine
    // Qualifikation anerkannt wird.
    await prisma.candidate.update({
      where: { id: welt.kandidat },
      data: { workPermitRequired: true },
    })
    const id = await stelleQualifikationEin()
    const ergebnis = await acceptDocument(disponent, { documentId: id, rejectionReason: null })
    expect(ergebnis.ok).toBe(true)
    if (ergebnis.ok) {
      expect(ergebnis.message).toMatch(/qualificationCertificate/)
      expect(ergebnis.message).not.toMatch(/workPermit/)
      expect(ergebnis.message).not.toMatch(/safetyBriefing/)
    }
  })
})

describe('Zurückweisen (submitted → rejected, SPEC 5.4.3)', () => {
  it('verlangt den Zurückweisungsgrund (3.10)', async () => {
    const id = await stelleQualifikationEin()
    const ergebnis = await rejectDocument(disponent, { documentId: id, rejectionReason: '   ' })
    expect(ergebnis.ok).toBe(false)
    const zeile = await prisma.document.findUniqueOrThrow({ where: { id } })
    expect(zeile.verificationStatus).toBe('submitted')
  })

  it('schreibt Grund und Status und sagt, dass der Pflichtnachweis offen bleibt', async () => {
    const id = await stelleQualifikationEin()
    const ergebnis = await rejectDocument(disponent, {
      documentId: id,
      rejectionReason: 'Nachweis unlesbar (synthetisch)',
    })
    expect(ergebnis.ok).toBe(true)
    if (ergebnis.ok) expect(ergebnis.message).toMatch(/Pflichtnachweis bleibt offen/)
    const zeile = await prisma.document.findUniqueOrThrow({ where: { id } })
    expect(zeile.verificationStatus).toBe('rejected')
    expect(zeile.rejectionReason).toBe('Nachweis unlesbar (synthetisch)')
  })
})

describe('Was 5.4.3 ausschließt', () => {
  it('kennt keinen Weg aus `accepted` zurück', async () => {
    const id = await stelleQualifikationEin()
    expect((await acceptDocument(disponent, { documentId: id, rejectionReason: null })).ok).toBe(
      true,
    )
    const nochmal = await rejectDocument(disponent, {
      documentId: id,
      rejectionReason: 'zu spät gemerkt',
    })
    expect(nochmal.ok).toBe(false)
    const zeile = await prisma.document.findUniqueOrThrow({ where: { id } })
    expect(zeile.verificationStatus).toBe('accepted')
  })

  it('führt `rejected` als Endzustand', async () => {
    const id = await stelleQualifikationEin()
    await rejectDocument(disponent, { documentId: id, rejectionReason: 'synthetisch' })
    const ergebnis = await acceptDocument(disponent, { documentId: id, rejectionReason: null })
    expect(ergebnis.ok).toBe(false)
    if (!ergebnis.ok) expect(ergebnis.error).toMatch(/Endzustand/)
  })

  it('wechselt den Status nicht durch Ablauf der Gültigkeit', async () => {
    // Der Nachweis ist lange abgelaufen und bleibt **anerkannt**: „die
    // Anerkennung bezieht sich auf das Schriftstück, nicht auf den Zeitraum."
    const id = await legeNachweisAn(welt, {
      nummer: 'ABGELAUFEN-1',
      art: 'qualificationCertificate',
      bezug: { art: 'candidate', id: welt.kandidat },
      gueltigVon: tag('2024-01-01'),
      gueltigBis: tag('2024-12-31'),
      anerkennung: 'accepted',
    })
    const ansicht = await loadDocument(disponent, id)
    expect(ansicht?.state).toBe('accepted')
    expect(ansicht?.availableTransitions).toEqual([])
  })
})

describe('Sichtbarkeit der Nachweise (SPEC 2.3, Fußnoten [35], [36], [7])', () => {
  beforeEach(async () => {
    // Die Welt bringt für **beide** Lieferanten eine Erlaubnisurkunde mit
    // (3.2, E25). Dazu ein Nachweis des eigenen Kandidaten und ein Einsatz mit
    // Unterweisung — die drei Lagen, die die Fußnoten trennen.
    await legeNachweisAn(welt, {
      nummer: 'QUAL-1',
      art: 'qualificationCertificate',
      bezug: { art: 'candidate', id: welt.kandidat },
      gueltigVon: tag('2026-01-01'),
      einsteller: welt.lieferantAdmin,
    })
    await legeEinsatzAn(welt, {
      nummer: 'E-SICHT',
      status: 'active',
      plannedStartDate: tag('2026-01-05'),
      plannedEndDate: tag('2026-12-31'),
      actualStartDate: tag('2026-01-05'),
    })
  })

  it('zeigt dem Betreiber alle Nachweise', async () => {
    const liste = await loadDocuments(disponent)
    expect(liste.map((zeile) => zeile.fields.documentCategory).sort()).toEqual([
      'permitCertificate',
      'permitCertificate',
      'qualificationCertificate',
      'safetyBriefing',
    ])
  })

  it('zeigt dem Bedarfsträger nur die einsatzbezogenen Nachweise seines Kunden ([35])', async () => {
    const liste = await loadDocuments(bedarfstraeger)
    expect(liste.map((zeile) => zeile.fields.documentCategory)).toEqual([
      'qualificationCertificate',
      'safetyBriefing',
    ])
  })

  it('zeigt Einkauf/Controlling nur die Urkunde — ohne ihre Inhalte ([36])', async () => {
    const liste = await loadDocuments(einkauf)
    // Nur die Urkunde des Lieferanten mit Beauftragung — der zweite Lieferant
    // hat zu diesem Kunden keine, und [36] verweigert ihn deshalb.
    expect(liste.length).toBe(1)
    const zeile = liste[0]
    expect(zeile?.fields.documentCategory).toBe('permitCertificate')
    expect(zeile?.fields.verificationStatus).toBe('accepted')
    // „Ohne Urkundeninhalte": die Datei und ihre Herkunft bleiben verdeckt.
    expect(zeile?.fields.fileRef).toBeUndefined()
    expect(zeile?.concealed).toContain('fileRef')
    expect(zeile?.concealed).toContain('issuer')
  })

  it('zeigt dem Lieferanten die eigenen Nachweise und keine fremden ([7])', async () => {
    const liste = await loadDocuments(lieferantAdmin)
    const bezuege = liste.map((zeile) => zeile.fields.subjectLabel)
    expect(bezuege).toContain('Lieferant Rheinpersonal GmbH')
    expect(bezuege).not.toContain('Lieferant Elbe Zeitarbeit GmbH')
    expect(liste.some((zeile) => zeile.fields.documentNumber === 'DOK-QUAL-1')).toBe(true)
  })

  it('rechnet `mandatory` und `blocking`, statt sie zu lesen (3.10, 5.4.4)', async () => {
    const liste = await loadDocuments(disponent)
    const urkunde = liste.find((zeile) => zeile.fields.documentCategory === 'permitCertificate')
    expect(urkunde).toBeDefined()
    const qualifikation = liste.find(
      (zeile) => zeile.fields.documentCategory === 'qualificationCertificate',
    )
    expect(urkunde?.mandatory).toBe(true)
    expect(urkunde?.blocking).toBe(true)
    expect(qualifikation?.mandatory).toBe(false)
    expect(qualifikation?.blocking).toBe(false)
    // Die Spalten gibt es nicht — es sind Rechenergebnisse (3.10).
    const spalten = await prisma.$queryRaw<{ column_name: string }[]>`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'Document' AND column_name IN ('mandatory', 'blocking')
    `
    expect(spalten).toEqual([])
  })
})

describe('Welche Handlung die Oberfläche anbietet (SPEC 2.2, 5.4.3)', () => {
  it('bietet dem Betreiberdisponenten Anerkennen und Zurückweisen an ([34])', async () => {
    const id = await stelleQualifikationEin()
    const ansicht = await loadDocument(disponent, id)
    expect(ansicht?.availableTransitions).toEqual(['accept', 'reject'])
  })

  it('bietet dem Lieferanten **keine** Entscheidung an — er sieht den Nachweis nur ([7])', async () => {
    const id = await stelleQualifikationEin()
    const ansicht = await loadDocument(lieferantAdmin, id)
    expect(ansicht).not.toBeNull()
    expect(ansicht?.availableTransitions).toEqual([])
  })

  it('bietet dem Einsteller keine an, auch wenn seine Rolle sie trüge (5.4.3)', async () => {
    // Der Betreiberadministrator darf nach 2.2 anerkennen. An **seinem
    // eigenen** Nachweis zeigt die Oberfläche den Knopf trotzdem nicht: das
    // Vier-Augen-Prinzip würde ihn sicher scheitern lassen.
    const eingestellt = await submitDocument(administrator, {
      documentCategory: 'agreementDocument',
      subjectType: 'supplier',
      subjectId: welt.lieferant,
      fileName: 'vertragsunterlage.pdf',
      mimeType: 'application/pdf',
      issuer: null,
      issuedOn: null,
      validFrom: null,
      validTo: null,
      confidentiality: 'operatorAndOwner',
    })
    expect(eingestellt.ok).toBe(true)
    const zeile = await prisma.document.findFirstOrThrow({
      where: { documentCategory: 'agreementDocument' },
    })
    expect((await loadDocument(administrator, zeile.id))?.availableTransitions).toEqual([])
    // Für den Disponenten, der ihn nicht eingestellt hat, bleibt sie offen.
    expect((await loadDocument(disponent, zeile.id))?.availableTransitions).toEqual([
      'accept',
      'reject',
    ])
  })
})
