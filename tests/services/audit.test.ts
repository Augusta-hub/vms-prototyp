/**
 * Das Protokoll gegen eine echte Datenbank — SPEC **3.12**.
 *
 * Was hier geprüft wird und **nirgends sonst**:
 *
 *  - die **Lückenlosigkeit** der Eintragsnummern, auch wenn ein Vorgang
 *    zurückrollt (3.12: „Lücken sind ein Befund, kein Betriebszustand"),
 *  - die **Unveränderlichkeit** — `UPDATE` und `DELETE` scheitern an der
 *    Datenbank, nicht nur an der Matrix ([39]),
 *  - dass ein **abgelehnter** Versuch einen Eintrag hinterlässt, obwohl die
 *    Handlung zurückrollt,
 *  - dass die Sperre aus Kapitel 5 als `blocked` mit `ruleRef` erscheint und
 *    die Verweigerung nach Kapitel 2 als `denied` (4.0, Regel 5),
 *  - der **Vertretungsvermerk** (2.4, Regel 6),
 *  - die Sichtbarkeit nach [39] je Rolle,
 *  - die Protokollierung der **Klardaten**-Offenlegung (3.12, Nummer 3; 6.4).
 *
 * Die Entwürfe selbst sind in `lib/audit/entry.test.ts` ohne Datenbank
 * geprüft. Alle Daten sind synthetisch (CLAUDE.md, Regel 3).
 */

import { beforeEach, describe, expect, it } from 'vitest'
import { loadIdentity, type LoadedIdentity } from '../../lib/identity/loadSubject'
import { prisma } from '../../lib/prisma'
import { schreibEintrag } from '../../lib/audit/entry'
import { protokolliere } from '../../lib/audit/record'
import { loadAuditEntries, pruefeLueckenlosigkeit } from '../../lib/services/audit'
import { acceptDocument, submitDocument } from '../../lib/services/documents'
import { createCustomer, createSupplier } from '../../lib/services/masterData'
import { loadSubmissions, transitionSubmission } from '../../lib/services/staffing'
import { transitionSupplier } from '../../lib/services/supplierStatus'
import { baueWelt, leereDatenbank, tag, type Welt } from './fixture'

const HEUTE = tag('2026-11-10')

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

/** Alle Einträge, ohne Sichtbarkeitsprüfung — für die Prüfung des Bestands. */
async function alleEintraege() {
  return prisma.auditEntry.findMany({ orderBy: { entryNumber: 'asc' } })
}

async function setzeStatus(status: 'active' | 'blocked', weiteres: Record<string, unknown> = {}) {
  await prisma.supplier.update({ where: { id: welt.lieferant }, data: { status, ...weiteres } })
}

describe('Lückenlosigkeit der Eintragsnummern (3.12)', () => {
  it('beginnt bei 1 und zählt ohne Lücke weiter', async () => {
    await setzeStatus('active')
    const erste = await transitionSupplier(
      disponent,
      eingabe({ transition: 'block', blockReason: 'Erste Sperre' }),
      HEUTE,
    )
    expect(erste.ok).toBe(true)

    await setzeStatus('active', { blockedById: null, blockReason: null })
    const zweite = await transitionSupplier(
      disponent,
      eingabe({ transition: 'block', blockReason: 'Zweite Sperre' }),
      HEUTE,
    )
    expect(zweite.ok).toBe(true)

    const nummern = (await alleEintraege()).map((eintrag) => eintrag.entryNumber)
    expect(nummern).toEqual([1, 2])
  })

  it('rollt der Eintrag mit seinem Vorgang zurück, bleibt die Nummer frei', async () => {
    // Der Fall, den eine Datenbanksequenz nicht trägt: der Eintrag ist
    // geschrieben, und **danach** scheitert der Vorgang. Hier von Hand
    // hergestellt, weil die Fachdienste den Eintrag als letzte Anweisung
    // schreiben — die Zusicherung aus 3.12 soll trotzdem geprüft sein.
    await expect(
      prisma.$transaction(async (tx) => {
        await protokolliere(
          tx,
          schreibEintrag({
            decision: null,
            operation: 'create',
            bezug: {
              objectType: 'supplier',
              objectRef: 'L-ROLLBACK',
              tenantId: welt.lieferantMandant,
            },
            userId: welt.administrator,
            occurredAt: HEUTE,
          }),
        )
        throw new Error('Der Vorgang scheitert nach dem Eintrag.')
      }),
    ).rejects.toThrow(/scheitert nach dem Eintrag/)

    expect(await alleEintraege()).toEqual([])

    // Der nächste Eintrag bekommt die **freigewordene** Nummer 1: eine
    // Datenbanksequenz hätte hier 2 vergeben und die 1 als Lücke gelassen.
    await setzeStatus('active')
    await transitionSupplier(
      disponent,
      eingabe({ transition: 'block', blockReason: 'Sperrgrund' }),
      HEUTE,
    )
    expect((await alleEintraege()).map((eintrag) => eintrag.entryNumber)).toEqual([1])
    expect((await pruefeLueckenlosigkeit()).missing).toEqual([])
  })

  it('eine gescheiterte Anlage hinterlässt keinen Eintrag und keine Lücke', async () => {
    // Derselbe Lieferant zweimal: die zweite Anlage scheitert am
    // Eindeutigkeitsindex, **nachdem** der Übergang erlaubt war. Die
    // Transaktion rollt zurück, und mit ihr der Eintrag.
    const ersteAnlage = await createSupplier(administrator, neuerLieferant('L-9001'))
    expect(ersteAnlage.ok).toBe(true)
    const zweiteAnlage = await createSupplier(administrator, neuerLieferant('L-9001'))
    expect(zweiteAnlage.ok).toBe(false)

    const dritteAnlage = await createSupplier(administrator, neuerLieferant('L-9002'))
    expect(dritteAnlage.ok).toBe(true)

    const nummern = (await alleEintraege()).map((eintrag) => eintrag.entryNumber)
    // Zwei Einträge, Nummern 1 und 2: die gescheiterte Anlage hat **keine**
    // Nummer verbraucht. Eine Datenbanksequenz hätte hier 1 und 3 ergeben.
    expect(nummern).toEqual([1, 2])
    const stand = await pruefeLueckenlosigkeit()
    expect(stand.missing).toEqual([])
  })

  it('meldet eine Lücke als Befund, wenn eine entsteht', async () => {
    await setzeStatus('active')
    await transitionSupplier(
      disponent,
      eingabe({ transition: 'block', blockReason: 'Erste Sperre' }),
      HEUTE,
    )
    // Den Zähler vorrücken, wie es nur ein Eingriff außerhalb der Anwendung
    // könnte. Danach fehlen die Nummern zwischen 1 und der nächsten.
    await prisma.$executeRawUnsafe('UPDATE "AuditSequence" SET "lastEntryNumber" = 5')
    await setzeStatus('active', { blockedById: null, blockReason: null })
    await transitionSupplier(
      disponent,
      eingabe({ transition: 'block', blockReason: 'Zweite Sperre' }),
      HEUTE,
    )

    const stand = await pruefeLueckenlosigkeit()
    expect(stand.lowest).toBe(1)
    expect(stand.highest).toBe(6)
    expect(stand.missing).toEqual([2, 3, 4, 5])
  })
})

describe('Unveränderlichkeit (3.12, [39])', () => {
  it('die Datenbank verweigert jede Änderung an einem Eintrag', async () => {
    await setzeStatus('active')
    await transitionSupplier(
      disponent,
      eingabe({ transition: 'block', blockReason: 'Sperrgrund' }),
      HEUTE,
    )
    const [eintrag] = await alleEintraege()
    expect(eintrag).toBeDefined()

    await expect(
      prisma.auditEntry.update({
        where: { id: eintrag?.id ?? '' },
        data: { reason: 'nachträglich geändert' },
      }),
    ).rejects.toThrow(/unveraenderlich/i)
  })

  it('und jede Löschung', async () => {
    await setzeStatus('active')
    await transitionSupplier(
      disponent,
      eingabe({ transition: 'block', blockReason: 'Sperrgrund' }),
      HEUTE,
    )
    const [eintrag] = await alleEintraege()
    await expect(
      prisma.auditEntry.delete({ where: { id: eintrag?.id ?? '' } }),
    ).rejects.toThrow(/unveraenderlich/i)
  })

  it('die Matrix nennt für das Protokoll keine schreibende Operation', async () => {
    const { PERMISSION_MATRIX } = await import('../../lib/authz/matrix')
    const zeile = PERMISSION_MATRIX.auditEntry ?? {}
    for (const zelle of Object.values(zeile)) {
      expect(Object.keys(zelle ?? {})).toEqual(['read'])
    }
  })
})

describe('Was protokolliert wird (3.12, Nummer 1)', () => {
  it('der Statuswechsel trägt beide Zustände, die Funktion und die Pflichtbegründung', async () => {
    await setzeStatus('active')
    const ergebnis = await transitionSupplier(
      disponent,
      eingabe({ transition: 'block', blockReason: 'Unbedenklichkeitsbescheinigung abgelaufen' }),
      HEUTE,
    )
    expect(ergebnis.ok).toBe(true)

    const [eintrag] = await alleEintraege()
    expect(eintrag).toMatchObject({
      objectType: 'supplier',
      objectRef: welt.lieferant,
      operation: 'transition',
      statusFrom: 'active',
      statusTo: 'blocked',
      result: 'success',
      reason: 'Unbedenklichkeitsbescheinigung abgelaufen',
      actorUserId: welt.disponent,
      systemActor: null,
    })
    // Der Mandant des **Objekts**, nicht der des Handelnden (3.12).
    expect(eintrag?.tenantId).toBe(welt.lieferantMandant)
    expect(eintrag?.actingAsRoleAssignmentId).not.toBeNull()
  })

  it('die Anlage trägt `create` und nur den Zielstatus', async () => {
    const ergebnis = await createSupplier(administrator, neuerLieferant('L-9003'))
    expect(ergebnis.ok).toBe(true)
    const [eintrag] = await alleEintraege()
    expect(eintrag).toMatchObject({
      objectType: 'supplier',
      operation: 'create',
      statusFrom: null,
      statusTo: 'onboarding',
      result: 'success',
    })
  })

  it('das Einstellen und das Anerkennen eines Nachweises ergeben zwei Einträge (5.4.3)', async () => {
    const eingestellt = await submitDocument(lieferantAdmin, {
      subjectType: 'supplier',
      subjectId: welt.lieferant,
      documentCategory: 'clearanceCertificate',
      fileName: 'ubb.pdf',
      mimeType: 'application/pdf',
      issuer: 'Finanzamt (synthetisch)',
      issuedOn: tag('2026-10-01'),
      validFrom: tag('2026-10-01'),
      validTo: tag('2027-10-01'),
      confidentiality: 'operatorAndOwner',
    })
    expect(eingestellt.ok).toBe(true)

    const dokument = await prisma.document.findFirstOrThrow({
      where: { documentCategory: 'clearanceCertificate' },
    })
    const anerkannt = await acceptDocument(disponent, {
      documentId: dokument.id,
      rejectionReason: null,
    })
    expect(anerkannt.ok).toBe(true)

    const eintraege = await alleEintraege()
    expect(eintraege.map((eintrag) => [eintrag.operation, eintrag.statusTo])).toEqual([
      ['create', 'submitted'],
      ['transition', 'accepted'],
    ])
    expect(eintraege[0]?.objectType).toBe('document')
    expect(eintraege[0]?.actorUserId).toBe(welt.lieferantAdmin)
    expect(eintraege[1]?.actorUserId).toBe(welt.disponent)
  })
})

describe('Abgelehnte Versuche (3.12: „abgelehnte Zugriffe werden ebenfalls protokolliert")', () => {
  it('eine Sperre aus Kapitel 5 steht als `blocked` mit ihrer Regel im Protokoll', async () => {
    // Die Erlaubnisurkunde zurück auf „eingereicht": P9 trägt dann nicht
    // (5.4.1), und 4.7 Q41 macht daraus eine Sperre.
    await prisma.supplierPermit.updateMany({
      where: { supplierId: welt.lieferant },
      data: { verificationStatus: 'submitted', verifiedAt: null, verifiedById: null },
    })
    await setzeStatus('active')
    await prisma.supplier.update({ where: { id: welt.lieferant }, data: { status: 'onboarding' } })

    // `activate` löst nach 4.6 nur `MA` aus — mit `MD` wäre die Ablehnung
    // eine Verweigerung nach Kapitel 2 und keine Sperre aus Kapitel 5.
    const ergebnis = await transitionSupplier(
      administrator,
      eingabe({ transition: 'activate' }),
      HEUTE,
    )
    expect(ergebnis.ok).toBe(false)

    // Der Lieferant steht unverändert — und der Eintrag ist trotzdem da.
    const lieferant = await prisma.supplier.findUniqueOrThrow({ where: { id: welt.lieferant } })
    expect(lieferant.status).toBe('onboarding')

    const [eintrag] = await alleEintraege()
    expect(eintrag).toMatchObject({
      objectType: 'supplier',
      operation: 'transition',
      statusFrom: 'onboarding',
      statusTo: 'active',
      result: 'blocked',
      ruleRef: 'P9',
      // Der Betreiber greift über die Mandantengrenze zu — auch beim
      // gesperrten Versuch (2.3, Bedingung 3).
      crossTenant: true,
    })
    expect(eintrag?.reason).toContain('P9')
    // Der Zugriff war erlaubt; die Funktion bleibt im Eintrag (Frage 44).
    expect(eintrag?.actingAsRoleAssignmentId).not.toBeNull()
  })

  it('eine Verweigerung nach Kapitel 2 steht als `denied`, ohne Rollenzuweisung', async () => {
    const ergebnis = await createCustomer(lieferantAdmin, {
      customerNumber: 'KD-9001',
      legalName: 'Versuchte Kundenanlage GmbH',
      addressStreet: 'Teststraße 1',
      addressPostalCode: '86150',
      addressCity: 'Augsburg',
      industrySector: null,
      contactName: 'A. Beispiel',
      validFrom: HEUTE,
    })
    expect(ergebnis.ok).toBe(false)

    const [eintrag] = await alleEintraege()
    expect(eintrag).toMatchObject({
      objectType: 'customer',
      // Kein Objekt: die fachliche Kennung tritt ein (Frage 44).
      objectRef: 'KD-9001',
      operation: 'create',
      result: 'denied',
      actorUserId: welt.lieferantAdmin,
      actingAsRoleAssignmentId: null,
    })
    // Kein Mandant des Objekts: der des Handelnden tritt ein (Frage 44).
    expect(eintrag?.tenantId).toBe(welt.lieferantMandant)
    expect(eintrag?.reason).toContain('SPEC 2')
    // Und kein Kunde ist entstanden.
    expect(await prisma.customer.count({ where: { customerNumber: 'KD-9001' } })).toBe(0)
  })
})

describe('Vertretungsvermerk (2.4, Regel 6; 3.12)', () => {
  it('eine Handlung in Vertretung nennt die Vertretung im Eintrag', async () => {
    // `unblock` löst nach 4.6 nur `MA` aus ([5]). Der Disponent bekommt die
    // Zuweisung des Administrators vertretungsweise — damit handelt er in
    // einer Funktion, die er selbst nicht trägt.
    const zuweisungMA = await prisma.roleAssignment.findFirstOrThrow({
      where: { userId: welt.administrator, roleCode: 'operatorAdmin' },
    })
    const vertretung = await prisma.delegation.create({
      data: {
        delegatedRoleAssignmentId: zuweisungMA.id,
        delegateUserId: welt.disponent,
        tenantId: welt.betreiberMandant,
        periodFrom: tag('2026-11-01'),
        periodTo: tag('2026-12-31'),
        reason: 'Urlaubsvertretung (synthetisch)',
      },
    })

    // Gesperrt hat der Administrator — sonst stünde das Vier-Augen-Prinzip
    // der Aufhebung durch den Vertreter entgegen (4.6, [5]).
    await setzeStatus('blocked', {
      blockReason: 'Sperrgrund',
      blockedAt: tag('2026-11-05'),
      blockedById: welt.administrator,
    })

    const vertreter = await identitaet(welt.disponent)
    const ergebnis = await transitionSupplier(
      vertreter,
      eingabe({ transition: 'unblock', unblockReason: 'Sperrgrund behoben und dokumentiert' }),
      HEUTE,
    )
    expect(ergebnis.ok).toBe(true)

    const [eintrag] = await alleEintraege()
    expect(eintrag).toMatchObject({
      actorUserId: welt.disponent,
      actingAsRoleAssignmentId: zuweisungMA.id,
      delegationId: vertretung.id,
      statusTo: 'active',
      reason: 'Sperrgrund behoben und dokumentiert',
    })
  })
})

describe('Sichtbarkeit des Protokolls ([39])', () => {
  beforeEach(async () => {
    await setzeStatus('active')
    await transitionSupplier(
      disponent,
      eingabe({ transition: 'block', blockReason: 'Sperrgrund' }),
      HEUTE,
    )
  })

  it('`MA` sieht den Eintrag zum Lieferanten — seine Zelle trägt `L` ohne Fußnote', async () => {
    const sichtbar = await loadAuditEntries(administrator)
    expect(sichtbar.map((eintrag) => eintrag.objectType)).toEqual(['supplier'])
  })

  it('`MD` sieht ihn **nicht**, obwohl er ihn ausgelöst hat (offene Frage 46)', async () => {
    const sichtbar = await loadAuditEntries(disponent)
    expect(sichtbar).toEqual([])
  })

  it('`LA` sieht ihn — es ist ein Eintrag zur eigenen Organisation', async () => {
    const sichtbar = await loadAuditEntries(lieferantAdmin)
    expect(sichtbar.map((eintrag) => eintrag.objectRef)).toEqual([welt.lieferant])
  })

  it('`KE` sieht ihn nicht — er gehört einem anderen Mandanten', async () => {
    const sichtbar = await loadAuditEntries(einkauf)
    expect(sichtbar).toEqual([])
  })

  it('der sichtbare Eintrag nennt Funktion, Objektzeile und Ergebnis in Worten', async () => {
    const [sichtbar] = await loadAuditEntries(administrator)
    expect(sichtbar).toMatchObject({
      objectLabel: 'Lieferant / Verleiher (3.2)',
      actingAs: 'operatorCoordinator',
      result: 'success',
      operation: 'transition',
    })
  })
})

describe('Klardaten des Kandidaten (3.12, Nummer 3; 6.4)', () => {
  /** Ein vorgelegter Profilvorschlag — Ausgangslage für die Zusage aus 4.2.3. */
  async function zugesagterVorschlag(): Promise<void> {
    // Ohne Erklärung zur Vorbeschäftigung sperrt P6 die Zusage (5.3.1) — die
    // Tatsachengrundlage fehlt dann, nicht die Drehtür.
    await prisma.candidate.update({
      where: { id: welt.kandidat },
      data: {
        previousEmploymentDeclaredAt: tag('2026-11-01'),
        previousEmploymentExisted: false,
      },
    })
    const anfrage = await prisma.demandRequest.create({
      data: {
        tenantId: welt.kundenMandant,
        requestNumber: 'BA-9001',
        customerId: welt.kunde,
        siteId: welt.standort,
        costCenterId: welt.kostenstelle,
        title: 'Montage Linie 3',
        activityDescription: 'Montage von Baugruppen, Werk Süd (synthetisch)',
        startDate: tag('2026-12-01'),
        weeklyHours: '35.00',
        headcount: 1,
        status: 'inSelection',
        requestedById: welt.bedarfstraeger,
      },
    })
    const ausschreibung = await prisma.tender.create({
      data: {
        tenantId: welt.betreiberMandant,
        tenderNumber: 'BA-9001-R1',
        demandRequestId: anfrage.id,
        tenderRound: 1,
        distributionMode: 'simultaneous',
        publishedAt: tag('2026-11-01'),
        publishedById: welt.administrator,
        offerDeadline: tag('2026-11-20'),
      },
    })
    const einladung = await prisma.tenderInvitation.create({
      data: {
        tenantId: welt.betreiberMandant,
        tenderId: ausschreibung.id,
        supplierId: welt.lieferant,
        invitedAt: tag('2026-11-01'),
        invitationStatus: 'offerSubmitted',
      },
    })
    const angebot = await prisma.supplierOffer.create({
      data: {
        tenantId: welt.lieferantMandant,
        offerNumber: 'A-9001',
        tenderInvitationId: einladung.id,
        supplierId: welt.lieferant,
        availableFrom: tag('2026-12-01'),
        offeredHeadcount: 1,
        submittedAt: tag('2026-11-05'),
        status: 'submitted',
      },
    })
    await prisma.candidateSubmission.create({
      data: {
        tenantId: welt.lieferantMandant,
        submissionNumber: 'PV-9001',
        candidateId: welt.kandidat,
        supplierOfferId: angebot.id,
        demandRequestId: anfrage.id,
        availableFrom: tag('2026-12-01'),
        disclosureLevel: 'pseudonymized',
        releasedToCustomerAt: tag('2026-11-06'),
        submittedAt: tag('2026-11-05'),
        status: 'releasedToCustomer',
      },
    })
  }

  it('die Zusage protokolliert den Wechsel der Offenlegungsstufe mit geänderten Feldern', async () => {
    await zugesagterVorschlag()
    const vorschlag = await prisma.candidateSubmission.findFirstOrThrow({
      where: { submissionNumber: 'PV-9001' },
    })
    const ergebnis = await transitionSubmission(
      bedarfstraeger,
      {
        submissionId: vorschlag.id,
        transition: 'accept',
        decisionReason: null,
        interviewAt: null,
      },
      HEUTE,
    )
    if (!ergebnis.ok) throw new Error(`${ergebnis.error} (${ergebnis.specReference ?? '-'})`)

    const eintraege = await alleEintraege()
    const wechsel = eintraege.find((eintrag) => eintrag.operation === 'update')
    expect(wechsel?.changedFields).toEqual([
      { field: 'disclosureLevel', from: 'pseudonymized', to: 'identified' },
    ])
    expect(wechsel?.reason).toContain('6.4')
  })

  it('der Lesezugriff der Kundenseite auf die Klardaten wird protokolliert', async () => {
    await zugesagterVorschlag()
    const vorschlag = await prisma.candidateSubmission.findFirstOrThrow({
      where: { submissionNumber: 'PV-9001' },
    })
    await prisma.candidateSubmission.update({
      where: { id: vorschlag.id },
      data: {
        status: 'accepted',
        decision: 'accepted',
        decidedAt: HEUTE,
        decidedById: welt.bedarfstraeger,
        disclosureLevel: 'identified',
      },
    })

    await loadSubmissions(bedarfstraeger, HEUTE)
    const lesezugriffe = (await alleEintraege()).filter(
      (eintrag) => eintrag.operation === 'read',
    )
    expect(lesezugriffe).toHaveLength(1)
    expect(lesezugriffe[0]).toMatchObject({
      objectType: 'candidate',
      objectRef: welt.kandidat,
      result: 'success',
      actorUserId: welt.bedarfstraeger,
    })
    expect(lesezugriffe[0]?.reason).toContain('Klardaten')
  })

  it('solange die Stufe `pseudonymized` ist, wird nichts protokolliert', async () => {
    await zugesagterVorschlag()
    await loadSubmissions(bedarfstraeger, HEUTE)
    expect((await alleEintraege()).filter((eintrag) => eintrag.operation === 'read')).toEqual([])
  })

  it('der Betreiber löst keine Offenlegung aus — bei ihm waren die Daten nie verdeckt', async () => {
    await zugesagterVorschlag()
    await prisma.candidateSubmission.updateMany({
      where: { submissionNumber: 'PV-9001' },
      data: { disclosureLevel: 'identified', status: 'accepted' },
    })
    await loadSubmissions(disponent, HEUTE)
    expect((await alleEintraege()).filter((eintrag) => eintrag.operation === 'read')).toEqual([])
  })
})

/* ------------------------------------------------------------------ */
/* Hilfen                                                             */
/* ------------------------------------------------------------------ */

function eingabe(teile: {
  readonly transition: 'activate' | 'block' | 'unblock' | 'deactivate' | 'reactivate'
  readonly blockReason?: string | null
  readonly unblockReason?: string | null
  readonly reactivationReason?: string | null
}) {
  return {
    supplierId: welt.lieferant,
    transition: teile.transition,
    blockReason: teile.blockReason ?? null,
    unblockReason: teile.unblockReason ?? null,
    reactivationReason: teile.reactivationReason ?? null,
    validTo: null,
  }
}

function neuerLieferant(nummer: string) {
  return {
    supplierNumber: nummer,
    legalName: `Verleiher ${nummer} GmbH`,
    addressStreet: 'Industriestraße 7',
    addressPostalCode: '86153',
    addressCity: 'Augsburg',
    contactName: 'B. Beispiel',
    validFrom: HEUTE,
  }
}
