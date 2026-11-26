/**
 * Der Übergangslauf gegen eine echte Datenbank — SPEC **4.0 Regel 10**,
 * **4.2.1**, **4.2.2**, **4.2.3** und **5.5.1 c**.
 *
 * Was hier geprüft wird und **nirgends sonst**:
 *
 *  - dass die Einladung ohne Angebot nach Ablauf der Angebotsfrist **abläuft**
 *    — und dass der nächtliche Prüflauf sie danach **weiter meldet**, weil die
 *    Eskalation ihre Stufen noch steigen muss (2.4, Regel 6),
 *  - dass die **Bindefrist** das Angebot ablaufen lässt und seine offenen
 *    Profilvorschläge **abgeleitet** ablehnt (4.2.2 → 4.2.3), mit
 *    Fristbegründung und **ohne** Benutzer,
 *  - dass ein Vorschlag im **Entwurf** stehen bleibt: er hat den Betreiber
 *    nie erreicht,
 *  - dass die Protokolleinträge das **Systemkennzeichen** tragen (3.12, 4.0
 *    Regel 10),
 *  - dass der **nächtliche Lauf** den Übergangslauf vor seinen Befunden
 *    ausführt (5.5.1 c).
 *
 * Alle Daten sind synthetisch (CLAUDE.md, Regel 3).
 */

import { beforeEach, describe, expect, it } from 'vitest'
import { loadIdentity, type LoadedIdentity } from '../../lib/identity/loadSubject'
import { prisma } from '../../lib/prisma'
import { runUebergangslauf } from '../../lib/services/demand'
import { runNightly } from '../../lib/services/nightly'
import { baueWelt, leereDatenbank, tag, type Welt } from './fixture'

const HEUTE = tag('2026-11-12')

let welt: Welt
let administrator: LoadedIdentity

async function identitaet(userId: string): Promise<LoadedIdentity> {
  const geladen = await loadIdentity(userId)
  if (geladen === null) throw new Error('Die Testidentität ließ sich nicht laden.')
  return geladen
}

/**
 * Eine Ausschreibung mit einer Einladung — und auf Wunsch mit Angebot und
 * Profilvorschlag. `bindefrist` und `angebotsfrist` steuern, was abläuft.
 */
async function legeAusschreibungAn(angaben: {
  readonly nummer: string
  readonly angebotsfrist: Date
  readonly mitAngebot?: { readonly bindefrist: Date | null }
  readonly vorschlagStatus?: 'draft' | 'submitted' | 'releasedToCustomer'
}): Promise<{ readonly einladung: string; readonly angebot: string | null; readonly vorschlag: string | null }> {
  const anfrage = await prisma.demandRequest.create({
    data: {
      tenantId: welt.kundenMandant,
      requestNumber: `BA-${angaben.nummer}`,
      customerId: welt.kunde,
      siteId: welt.standort,
      costCenterId: welt.kostenstelle,
      title: 'Montage Linie 7',
      activityDescription: 'Montage von Baugruppen (synthetisch)',
      startDate: tag('2027-01-04'),
      weeklyHours: '35.00',
      headcount: 1,
      status: 'tendered',
      submittedAt: tag('2026-10-01'),
      requestedById: welt.bedarfstraeger,
    },
  })
  const ausschreibung = await prisma.tender.create({
    data: {
      tenantId: welt.betreiberMandant,
      tenderNumber: `AS-${angaben.nummer}`,
      demandRequestId: anfrage.id,
      tenderRound: 1,
      distributionMode: 'simultaneous',
      publishedAt: tag('2026-10-01'),
      publishedById: welt.administrator,
      offerDeadline: angaben.angebotsfrist,
    },
  })
  const einladung = await prisma.tenderInvitation.create({
    data: {
      tenantId: welt.betreiberMandant,
      tenderId: ausschreibung.id,
      supplierId: welt.lieferant,
      invitedAt: tag('2026-10-01'),
      invitationStatus: angaben.mitAngebot === undefined ? 'viewed' : 'offerSubmitted',
      viewedAt: tag('2026-10-02'),
    },
  })
  if (angaben.mitAngebot === undefined) {
    return { einladung: einladung.id, angebot: null, vorschlag: null }
  }

  const angebot = await prisma.supplierOffer.create({
    data: {
      tenantId: welt.lieferantMandant,
      offerNumber: `A-${angaben.nummer}`,
      tenderInvitationId: einladung.id,
      supplierId: welt.lieferant,
      availableFrom: tag('2027-01-04'),
      offeredHeadcount: 1,
      submittedAt: tag('2026-10-05'),
      offerValidUntil: angaben.mitAngebot.bindefrist,
      status: 'submitted',
    },
  })
  if (angaben.vorschlagStatus === undefined) {
    return { einladung: einladung.id, angebot: angebot.id, vorschlag: null }
  }

  const vorschlag = await prisma.candidateSubmission.create({
    data: {
      tenantId: welt.lieferantMandant,
      submissionNumber: `PV-${angaben.nummer}`,
      candidateId: welt.kandidat,
      supplierOfferId: angebot.id,
      demandRequestId: anfrage.id,
      availableFrom: tag('2027-01-04'),
      disclosureLevel: 'pseudonymized',
      // Angelegt hat ihn der Disponent des Lieferanten — damit ist sichtbar,
      // dass die abgeleitete Ablehnung **keinen** Benutzer einsetzt.
      createdById: welt.lieferantDisponent,
      submittedAt: angaben.vorschlagStatus === 'draft' ? null : tag('2026-10-05'),
      releasedToCustomerAt:
        angaben.vorschlagStatus === 'releasedToCustomer' ? tag('2026-10-06') : null,
      status: angaben.vorschlagStatus,
    },
  })
  return { einladung: einladung.id, angebot: angebot.id, vorschlag: vorschlag.id }
}

beforeEach(async () => {
  await leereDatenbank()
  welt = await baueWelt()
  administrator = await identitaet(welt.administrator)
})

describe('Einladung ohne Angebot (4.2.1)', () => {
  it('läuft ab, sobald die Angebotsfrist verstrichen ist', async () => {
    const { einladung } = await legeAusschreibungAn({
      nummer: '2026-0801',
      angebotsfrist: tag('2026-11-01'),
    })

    const log = await runUebergangslauf(HEUTE)
    expect(log.join(' ')).toContain('4.2.1')
    const danach = await prisma.tenderInvitation.findUniqueOrThrow({ where: { id: einladung } })
    expect(danach.invitationStatus).toBe('expired')
  })

  it('läuft nicht ab, solange die Frist läuft', async () => {
    const { einladung } = await legeAusschreibungAn({
      nummer: '2026-0802',
      angebotsfrist: tag('2026-12-01'),
    })
    await runUebergangslauf(HEUTE)
    const danach = await prisma.tenderInvitation.findUniqueOrThrow({ where: { id: einladung } })
    expect(danach.invitationStatus).toBe('viewed')
  })

  it('trägt im Protokoll das Systemkennzeichen und keinen Benutzer (4.0, Regel 10)', async () => {
    const { einladung } = await legeAusschreibungAn({
      nummer: '2026-0803',
      angebotsfrist: tag('2026-11-01'),
    })
    await runUebergangslauf(HEUTE)
    const eintrag = await prisma.auditEntry.findFirstOrThrow({
      where: { objectType: 'tenderInvitation', objectRef: einladung, operation: 'transition' },
    })
    expect(eintrag.actorUserId).toBe(null)
    expect(eintrag.systemActor).not.toBe(null)
    expect(eintrag.statusTo).toBe('expired')
  })
})

describe('Bindefrist des Angebots (4.2.2 → 4.2.3)', () => {
  it('lässt das Angebot ablaufen und lehnt seinen offenen Vorschlag ab', async () => {
    const { angebot, vorschlag } = await legeAusschreibungAn({
      nummer: '2026-0804',
      angebotsfrist: tag('2026-10-20'),
      mitAngebot: { bindefrist: tag('2026-11-05') },
      vorschlagStatus: 'releasedToCustomer',
    })

    const log = await runUebergangslauf(HEUTE)
    expect(log.join(' ')).toContain('4.2.2')
    expect(log.join(' ')).toContain('4.2.3')

    const angebotDanach = await prisma.supplierOffer.findUniqueOrThrow({
      where: { id: angebot ?? '' },
    })
    expect(angebotDanach.status).toBe('expired')

    const vorschlagDanach = await prisma.candidateSubmission.findUniqueOrThrow({
      where: { id: vorschlag ?? '' },
    })
    expect(vorschlagDanach.status).toBe('rejected')
    expect(vorschlagDanach.decision).toBe('rejected')
    // Kein Benutzer trägt den Übergang (4.0, Regel 10).
    expect(vorschlagDanach.decidedById).toBe(null)
    // Fristbegründung ohne Bezug auf ein fremdes Angebot (4.2.3, 2.3 Regel 3).
    expect(vorschlagDanach.decisionReason).toContain('Bindefrist')
    expect(vorschlagDanach.decisionReason).not.toContain('Angebot A-')
  })

  it('benachrichtigt `LD` und `MD` über die abgeleitete Ablehnung (4.2.3)', async () => {
    const { vorschlag } = await legeAusschreibungAn({
      nummer: '2026-0805',
      angebotsfrist: tag('2026-10-20'),
      mitAngebot: { bindefrist: tag('2026-11-05') },
      vorschlagStatus: 'releasedToCustomer',
    })
    await runUebergangslauf(HEUTE)
    const nachrichten = await prisma.notification.findMany({
      where: { objectType: 'candidateSubmission', objectRef: vorschlag ?? '' },
    })
    expect(nachrichten.map((n) => n.recipientRoleCode).sort()).toEqual([
      'operatorCoordinator',
      'supplierCoordinator',
    ])
    expect(nachrichten.every((n) => n.statusTo === 'rejected')).toBe(true)
  })

  it('lässt den Entwurf stehen — er hat den Betreiber nie erreicht (4.2.3)', async () => {
    const { vorschlag } = await legeAusschreibungAn({
      nummer: '2026-0806',
      angebotsfrist: tag('2026-10-20'),
      mitAngebot: { bindefrist: tag('2026-11-05') },
      vorschlagStatus: 'draft',
    })
    await runUebergangslauf(HEUTE)
    const danach = await prisma.candidateSubmission.findUniqueOrThrow({
      where: { id: vorschlag ?? '' },
    })
    expect(danach.status).toBe('draft')
  })

  it('lässt ein Angebot ohne Bindefrist unberührt — sie ist optional (3.5)', async () => {
    const { angebot } = await legeAusschreibungAn({
      nummer: '2026-0807',
      angebotsfrist: tag('2026-10-20'),
      mitAngebot: { bindefrist: null },
      vorschlagStatus: 'submitted',
    })
    await runUebergangslauf(HEUTE)
    const danach = await prisma.supplierOffer.findUniqueOrThrow({ where: { id: angebot ?? '' } })
    expect(danach.status).toBe('submitted')
  })
})

describe('Der nächtliche Lauf führt den Übergangslauf zuerst aus (5.5.1 c)', () => {
  it('lässt die Einladung ablaufen **und** meldet sie weiter', async () => {
    const { einladung } = await legeAusschreibungAn({
      nummer: '2026-0808',
      angebotsfrist: tag('2026-11-01'),
    })

    const ergebnis = await runNightly(administrator, HEUTE)
    expect(ergebnis.ok).toBe(true)

    // Der Übergang ist vollzogen …
    const danach = await prisma.tenderInvitation.findUniqueOrThrow({ where: { id: einladung } })
    expect(danach.invitationStatus).toBe('expired')

    // … und der Prüflauf meldet den Vorgang weiter: die Eskalation
    // „Ausschreibung ohne Angebot" muss ihre Stufen noch steigen (2.4, Regel 6).
    const nachrichten = await prisma.notification.findMany({
      where: { trigger: 'tenderNoOffer', objectRef: einladung },
    })
    expect(nachrichten.length).toBeGreaterThan(0)
  })

  it('nennt den Übergangslauf in der Meldung', async () => {
    await legeAusschreibungAn({ nummer: '2026-0809', angebotsfrist: tag('2026-11-01') })
    const ergebnis = await runNightly(administrator, HEUTE)
    expect(ergebnis.ok ? ergebnis.message : '').toContain('Übergangslauf')
  })
})
