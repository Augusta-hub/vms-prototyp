/**
 * Die Benachrichtigungen aus den Übergängen gegen eine echte Datenbank —
 * SPEC **3.14** und **4.0 Regel 8**.
 *
 * Was hier geprüft wird und **nirgends sonst**:
 *
 *  - dass die Nachricht in **derselben Transaktion** wie der Übergang entsteht:
 *    ein gesperrter oder verweigerter Übergang hinterlässt keine,
 *  - dass sie die **Rolle in ihrer Organisation** erreicht — `KG` beim Kunden,
 *    `LD` beim Lieferanten — und die Mandantengrenze nicht überschreitet ([47]),
 *  - dass die relativen Adressaten aus Kapitel 4 am echten Vorgang aufgelöst
 *    werden: die offene Freigabestufe, die erfassende Seite, die Gegenseite
 *    des Belegs, der Antragsteller, der Einsteller,
 *  - dass **dieselbe** Nachricht zweimal entsteht, wenn der Übergang sich
 *    wiederholt — anders als beim nächtlichen Lauf (3.14, Eindeutigkeit),
 *  - dass die Sperre des Lieferanten eine **zweite Stufe** erzeugt und sie
 *    protokolliert wird (2.4, Regel 4),
 *  - dass eine Warnung aus 4.7 ihre **eigene** Nachricht mit `ruleRef` erzeugt.
 *
 * Der Katalog selbst ist in `lib/notifications/uebergaenge.test.ts` ohne
 * Datenbank geprüft. Alle Daten sind synthetisch (CLAUDE.md, Regel 3).
 */

import { beforeEach, describe, expect, it } from 'vitest'
import { loadIdentity, type LoadedIdentity } from '../../lib/identity/loadSubject'
import { prisma } from '../../lib/prisma'
import {
  cancelBillingDocument,
  closeBillingPeriod,
  createBillingDocument,
  openBillingPeriod,
  transitionBillingDocument,
} from '../../lib/services/billing'
import { createDemandRequest, transitionDemandRequest } from '../../lib/services/demand'
import { acceptDocument, rejectDocument, submitDocument } from '../../lib/services/documents'
import { loadNotifications } from '../../lib/services/nightly'
import { transitionSupplier } from '../../lib/services/supplierStatus'
import {
  requestExtension,
  transitionAssignment,
  transitionExtension,
} from '../../lib/services/staffing'
import { decideStage, submitTimesheet } from '../../lib/services/timesheets'
import {
  baueWelt,
  legeAbrechnungsperiodeAn,
  legeEinsatzAn,
  legeGenehmigtenZettelAn,
  leereDatenbank,
  tag,
  type Welt,
} from './fixture'

const PERIODE_VON = tag('2026-10-01')
const PERIODE_BIS = tag('2026-10-31')
const HEUTE = tag('2026-11-05')

let welt: Welt
let administrator: LoadedIdentity
let disponent: LoadedIdentity
let zweiterDisponent: LoadedIdentity
let bedarfstraeger: LoadedIdentity
let genehmiger: LoadedIdentity
let einkauf: LoadedIdentity
let lieferantAdmin: LoadedIdentity
let lieferantDisponent: LoadedIdentity
let zweiterLieferantDisponent: LoadedIdentity
let einsatz: string
let periode: string

async function identitaet(userId: string): Promise<LoadedIdentity> {
  const geladen = await loadIdentity(userId)
  if (geladen === null) throw new Error('Die Testidentität ließ sich nicht laden.')
  return geladen
}

function ok(ergebnis: { ok: boolean; message?: string; error?: string; specReference?: string }) {
  if (!ergebnis.ok) {
    throw new Error(`${ergebnis.error} (${ergebnis.specReference ?? '-'})`)
  }
  return ergebnis.message ?? ''
}

/** Die Nachrichten zu einem Vorgang, in der Reihenfolge ihrer Entstehung. */
async function nachrichten(objectRef?: string) {
  return prisma.notification.findMany({
    where: {
      trigger: 'statusTransition',
      ...(objectRef === undefined ? {} : { objectRef }),
    },
    orderBy: [{ raisedAt: 'asc' }, { escalationLevel: 'asc' }, { recipientRoleCode: 'asc' }],
  })
}

beforeEach(async () => {
  await leereDatenbank()
  welt = await baueWelt()
  administrator = await identitaet(welt.administrator)
  disponent = await identitaet(welt.disponent)
  zweiterDisponent = await identitaet(welt.zweiterDisponent)
  bedarfstraeger = await identitaet(welt.bedarfstraeger)
  genehmiger = await identitaet(welt.genehmiger)
  einkauf = await identitaet(welt.einkauf)
  lieferantAdmin = await identitaet(welt.lieferantAdmin)
  lieferantDisponent = await identitaet(welt.lieferantDisponent)
  zweiterLieferantDisponent = await identitaet(welt.zweiterLieferantDisponent)
})

/* ------------------------------------------------------------------ */
/* 4.1 Bedarfsanfrage                                                  */
/* ------------------------------------------------------------------ */

async function anfrage(nummer = 'BA-2026-0001'): Promise<string> {
  ok(
    await createDemandRequest(
      bedarfstraeger,
      {
        requestNumber: nummer,
        siteId: welt.standort,
        costCenterId: welt.kostenstelle,
        title: 'Montage Linie 2',
        activityDescription: 'Montage von Baugruppen an der Linie 2, Werk Süd',
        qualification: 'Montageerfahrung',
        headcount: 1,
        startDate: tag('2026-12-01'),
        endDate: null,
        weeklyHours: 35,
        maxHourlyRate: null,
        internalNote: null,
        requestedById: welt.bedarfstraeger,
      },
      HEUTE,
    ),
  )
  const zeile = await prisma.demandRequest.findFirstOrThrow({ where: { requestNumber: nummer } })
  return zeile.id
}

describe('Bedarfsanfrage (4.1)', () => {
  it('erzeugt bei der Anlage keine Nachricht', async () => {
    await anfrage()
    expect(await nachrichten()).toEqual([])
  })

  it('schickt die Einreichung an KG beim Kunden', async () => {
    const id = await anfrage()
    ok(await transitionDemandRequest(bedarfstraeger, { demandRequestId: id, transition: 'submit', reason: null }, HEUTE))

    const liste = await nachrichten(id)
    expect(liste).toHaveLength(1)
    const nachricht = liste[0]
    expect(nachricht?.recipientRoleCode).toBe('approver')
    expect(nachricht?.recipientTenantId).toBe(welt.kundenMandant)
    expect(nachricht?.escalationLevel).toBe(1)
    expect(nachricht?.kind).toBe('information')
    // Der Statuswechsel steht in der Nachricht — derselbe Zuschnitt wie im
    // Audit-Eintrag (3.12, 3.14).
    expect(nachricht?.statusFrom).toBe('draft')
    expect(nachricht?.statusTo).toBe('submitted')
    expect(nachricht?.runDate).toBe(null)
    expect(nachricht?.message).toContain('BA-2026-0001')
    expect(nachricht?.message).toContain('Freigabe')
  })

  it('schickt die Genehmigung an KB und MD', async () => {
    const id = await anfrage()
    ok(await transitionDemandRequest(bedarfstraeger, { demandRequestId: id, transition: 'submit', reason: null }, HEUTE))
    ok(await transitionDemandRequest(genehmiger, { demandRequestId: id, transition: 'approve', reason: null }, HEUTE))

    const liste = await nachrichten(id)
    expect(liste.map((zeile) => zeile.recipientRoleCode).sort()).toEqual([
      'approver',
      'demandOwner',
      'operatorCoordinator',
    ])
    const anKb = liste.find((zeile) => zeile.recipientRoleCode === 'demandOwner')
    expect(anKb?.recipientTenantId).toBe(welt.kundenMandant)
    const anMd = liste.find((zeile) => zeile.recipientRoleCode === 'operatorCoordinator')
    expect(anMd?.recipientTenantId).toBe(welt.betreiberMandant)
  })

  it('hinterlässt bei einem verweigerten Übergang keine Nachricht (4.0, Regel 2)', async () => {
    const id = await anfrage()
    // Der Bedarfsträger genehmigt nicht — die Matrix gibt ihm kein `S` auf
    // diesem Übergang. Rollt der Übergang zurück, darf keine Nachricht
    // zurückbleiben: sie ist nach 3.14 nicht zurücknehmbar.
    const ergebnis = await transitionDemandRequest(
      bedarfstraeger,
      { demandRequestId: id, transition: 'approve', reason: null },
      HEUTE,
    )
    expect(ergebnis.ok).toBe(false)
    expect(await nachrichten()).toEqual([])
  })
})

/* ------------------------------------------------------------------ */
/* 4.6 Lieferantenstatus                                               */
/* ------------------------------------------------------------------ */

describe('Lieferantenstatus (4.6)', () => {
  it('schickt die Sperre an LA und eskaliert an MA', async () => {
    ok(
      await transitionSupplier(
        administrator,
        {
          supplierId: welt.lieferant,
          transition: 'block',
          blockReason: 'Nachweis der Berufsgenossenschaft fehlt seit zwei Monaten.',
          unblockReason: null,
          reactivationReason: null,
          validTo: null,
        },
        HEUTE,
      ),
    )

    const liste = await nachrichten(welt.lieferant)
    expect(liste).toHaveLength(2)
    const anLa = liste.find((zeile) => zeile.recipientRoleCode === 'supplierAdmin')
    expect(anLa?.escalationLevel).toBe(1)
    expect(anLa?.kind).toBe('information')
    expect(anLa?.recipientTenantId).toBe(welt.lieferantMandant)

    const anMa = liste.find((zeile) => zeile.recipientRoleCode === 'operatorAdmin')
    expect(anMa?.escalationLevel).toBe(2)
    expect(anMa?.kind).toBe('escalation')
    expect(anMa?.recipientTenantId).toBe(welt.betreiberMandant)

    // 2.4, Regel 4: jede Eskalationsstufe wird protokolliert, mit Anlass,
    // Adressat und Zeitpunkt. Die **Information** an `LA` nicht — sie ist nach
    // 3.14 ihre eigene Spur, und der Übergang selbst ist ohnehin protokolliert.
    const eintraege = await prisma.auditEntry.findMany({
      where: { objectType: 'notification' },
    })
    expect(eintraege).toHaveLength(1)
    expect(eintraege[0]?.reason).toContain('Eskalation Stufe 2 an MA')
    expect(eintraege[0]?.systemActor).not.toBe(null)
  })

  it('zeigt dem Lieferantenadministrator nur seine eigene Nachricht ([47])', async () => {
    ok(
      await transitionSupplier(
        administrator,
        {
          supplierId: welt.lieferant,
          transition: 'block',
          blockReason: 'Nachweis fehlt.',
          unblockReason: null,
          reactivationReason: null,
          validTo: null,
        },
        HEUTE,
      ),
    )

    const sicht = await loadNotifications(lieferantAdmin)
    expect(sicht).toHaveLength(1)
    expect(sicht[0]?.recipientRoleCode).toBe('supplierAdmin')

    // Der Disponent desselben Lieferanten ist **nicht** adressiert: 4.6 nennt
    // bei der Sperre nur `LA`.
    expect(await loadNotifications(lieferantDisponent)).toEqual([])
    // Und der zweite Lieferant sieht nichts (2.3).
    expect(await loadNotifications(zweiterLieferantDisponent)).toEqual([])
  })
})

/* ------------------------------------------------------------------ */
/* 4.5 Abrechnung                                                      */
/* ------------------------------------------------------------------ */

describe('Abrechnung (4.5)', () => {
  beforeEach(async () => {
    periode = await legeAbrechnungsperiodeAn(welt, {
      nummer: '2026-10',
      von: PERIODE_VON,
      bis: PERIODE_BIS,
      kunde: welt.kunde,
    })
    einsatz = await legeEinsatzAn(welt, {
      nummer: 'E-2026-0001',
      status: 'active',
      plannedStartDate: tag('2026-09-01'),
      actualStartDate: tag('2026-09-01'),
      vergleichsentgelt: '18.5000',
    })
  })

  it('schickt die geöffnete Periode an LD jedes beteiligten Lieferanten', async () => {
    ok(
      await openBillingPeriod(
        administrator,
        {
          periodNumber: '2026-11',
          customerId: welt.kunde,
          periodFrom: tag('2026-11-01'),
          periodTo: tag('2026-11-30'),
          closingDate: tag('2026-12-05'),
        },
        HEUTE,
      ),
    )
    const neue = await prisma.billingPeriod.findFirstOrThrow({ where: { periodNumber: '2026-11' } })
    const liste = await nachrichten(neue.id)
    // Ein Einsatz, ein Lieferant — und **eine** Nachricht, nicht eine
    // gemeinsame an alle (2.3, Regel 2).
    expect(liste).toHaveLength(1)
    expect(liste[0]?.recipientRoleCode).toBe('supplierCoordinator')
    expect(liste[0]?.recipientTenantId).toBe(welt.lieferantMandant)
  })

  it('schickt den Periodenschluss an KE und LD', async () => {
    ok(await closeBillingPeriod(administrator, { billingPeriodId: periode }, HEUTE))
    const liste = await nachrichten(periode)
    expect(liste.map((zeile) => zeile.recipientRoleCode).sort()).toEqual([
      'procurementController',
      'supplierCoordinator',
    ])
  })

  it('schickt die Freigabe des Verkaufsbelegs an KE und die Beanstandung an MD', async () => {
    await legeGenehmigtenZettelAn(welt, {
      nummer: 'SZ-1',
      einsatz,
      periode,
      von: PERIODE_VON,
      bis: PERIODE_BIS,
      positionen: [{ tag: tag('2026-10-05'), stunden: '100.0000' }],
    })
    ok(
      await createBillingDocument(
        administrator,
        {
          billingPeriodId: periode,
          direction: 'sales',
          customerId: welt.kunde,
          supplierId: null,
          taxRate: 19,
        },
        HEUTE,
      ),
    )
    const beleg = await prisma.billingDocument.findFirstOrThrow({ where: { direction: 'sales' } })
    // Die Erstellung nennt keine Nachricht (4.5.2, nur Einkauf B).
    expect(await nachrichten(beleg.id)).toEqual([])

    ok(await transitionBillingDocument(administrator, { billingDocumentId: beleg.id, transition: 'review' }, HEUTE))
    expect(await nachrichten(beleg.id)).toEqual([])

    ok(
      await transitionBillingDocument(
        zweiterDisponent,
        { billingDocumentId: beleg.id, transition: 'release' },
        HEUTE,
      ),
    )
    const nachFreigabe = await nachrichten(beleg.id)
    expect(nachFreigabe).toHaveLength(1)
    expect(nachFreigabe[0]?.recipientRoleCode).toBe('procurementController')
    expect(nachFreigabe[0]?.recipientTenantId).toBe(welt.kundenMandant)

    ok(
      await transitionBillingDocument(
        einkauf,
        {
          billingDocumentId: beleg.id,
          transition: 'disputeBySales',
          disputeReason: 'Zwei Stunden sind nicht geleistet.',
        },
        HEUTE,
      ),
    )
    const nachBeanstandung = await nachrichten(beleg.id)
    expect(nachBeanstandung).toHaveLength(2)
    const anMd = nachBeanstandung.find((zeile) => zeile.statusTo === 'disputed')
    expect(anMd?.recipientRoleCode).toBe('operatorCoordinator')
    expect(anMd?.recipientTenantId).toBe(welt.betreiberMandant)
    // Der Beanstandungsgrund steht **nicht** in der Nachricht: 4.5.2 schreibt
    // ihn nicht hinein.
    expect(anMd?.message).not.toContain('nicht geleistet')

    ok(
      await transitionBillingDocument(
        administrator,
        {
          billingDocumentId: beleg.id,
          transition: 'clarify',
          disputeResolutionNote: 'Die Zeiten wurden geprüft und sind korrekt.',
        },
        HEUTE,
      ),
    )
    const nachKlaerung = await nachrichten(beleg.id)
    expect(nachKlaerung).toHaveLength(3)
    const geklaert = nachKlaerung.find((zeile) => zeile.statusFrom === 'disputed')
    expect(geklaert?.recipientRoleCode).toBe('procurementController')
  })

  it('schickt die Freigabe der Gutschrift an LD — die Einkaufsseite (4.5.2)', async () => {
    await legeGenehmigtenZettelAn(welt, {
      nummer: 'SZ-1',
      einsatz,
      periode,
      von: PERIODE_VON,
      bis: PERIODE_BIS,
      positionen: [{ tag: tag('2026-10-05'), stunden: '100.0000' }],
    })
    ok(
      await createBillingDocument(
        administrator,
        {
          billingPeriodId: periode,
          direction: 'purchase',
          customerId: null,
          supplierId: welt.lieferant,
          taxRate: 19,
        },
        HEUTE,
      ),
    )
    const beleg = await prisma.billingDocument.findFirstOrThrow({ where: { direction: 'purchase' } })
    ok(await transitionBillingDocument(administrator, { billingDocumentId: beleg.id, transition: 'review' }, HEUTE))
    ok(
      await transitionBillingDocument(
        zweiterDisponent,
        { billingDocumentId: beleg.id, transition: 'release' },
        HEUTE,
      ),
    )
    const liste = await nachrichten(beleg.id)
    // „`KE` bzw. `LD`": auf der Einkaufsseite der Lieferant, und zwar in
    // **seinem** Mandanten (4.5.2, 2.3).
    expect(liste).toHaveLength(1)
    expect(liste[0]?.recipientRoleCode).toBe('supplierCoordinator')
    expect(liste[0]?.recipientTenantId).toBe(welt.lieferantMandant)
  })

  it('erzeugt denselben Übergang zweimal, wenn er zweimal stattfindet (3.14)', async () => {
    await legeGenehmigtenZettelAn(welt, {
      nummer: 'SZ-1',
      einsatz,
      periode,
      von: PERIODE_VON,
      bis: PERIODE_BIS,
      positionen: [{ tag: tag('2026-10-05'), stunden: '100.0000' }],
    })
    ok(
      await createBillingDocument(
        administrator,
        {
          billingPeriodId: periode,
          direction: 'sales',
          customerId: welt.kunde,
          supplierId: null,
          taxRate: 19,
        },
        HEUTE,
      ),
    )
    const beleg = await prisma.billingDocument.findFirstOrThrow({ where: { direction: 'sales' } })
    ok(await transitionBillingDocument(administrator, { billingDocumentId: beleg.id, transition: 'review' }, HEUTE))

    for (const runde of [0, 1]) {
      ok(
        await transitionBillingDocument(
          zweiterDisponent,
          { billingDocumentId: beleg.id, transition: 'release' },
          HEUTE,
        ),
      )
      ok(
        await transitionBillingDocument(
          einkauf,
          {
            billingDocumentId: beleg.id,
            transition: 'disputeBySales',
            disputeReason: `Runde ${runde}: Rückfrage.`,
          },
          HEUTE,
        ),
      )
      ok(
        await transitionBillingDocument(
          administrator,
          {
            billingDocumentId: beleg.id,
            transition: 'clarify',
            disputeResolutionNote: `Runde ${runde}: geklärt.`,
          },
          HEUTE,
        ),
      )
    }

    // Zwei Freigaben, zwei Beanstandungen, zwei Klärungen — sechs Nachrichten.
    // Eine Eindeutigkeitsbedingung ohne Lauftag hätte die zweite Runde
    // verschluckt, und das ist die, auf die jemand wartet.
    const liste = await nachrichten(beleg.id)
    expect(liste).toHaveLength(6)
    expect(liste.filter((zeile) => zeile.statusTo === 'disputed')).toHaveLength(2)
  })

  it('schickt den Storno an die Gegenseite und nennt den stornierten Beleg', async () => {
    await legeGenehmigtenZettelAn(welt, {
      nummer: 'SZ-1',
      einsatz,
      periode,
      von: PERIODE_VON,
      bis: PERIODE_BIS,
      positionen: [{ tag: tag('2026-10-05'), stunden: '100.0000' }],
    })
    ok(
      await createBillingDocument(
        administrator,
        {
          billingPeriodId: periode,
          direction: 'sales',
          customerId: welt.kunde,
          supplierId: null,
          taxRate: 19,
        },
        HEUTE,
      ),
    )
    const beleg = await prisma.billingDocument.findFirstOrThrow({ where: { direction: 'sales' } })
    ok(
      await cancelBillingDocument(
        administrator,
        { billingDocumentId: beleg.id, cancellationReason: 'Falsche Kostenstelle.' },
        HEUTE,
      ),
    )
    const liste = await nachrichten(beleg.id)
    expect(liste).toHaveLength(1)
    expect(liste[0]?.recipientRoleCode).toBe('procurementController')
    expect(liste[0]?.message).toContain(beleg.documentNumber)
  })
})

/* ------------------------------------------------------------------ */
/* 4.4 Stundenzettel                                                   */
/* ------------------------------------------------------------------ */

describe('Stundenzettel (4.4)', () => {
  beforeEach(async () => {
    periode = await legeAbrechnungsperiodeAn(welt, {
      nummer: '2026-10',
      von: PERIODE_VON,
      bis: PERIODE_BIS,
      kunde: welt.kunde,
    })
    einsatz = await legeEinsatzAn(welt, {
      nummer: 'E-2026-0001',
      status: 'active',
      plannedStartDate: tag('2026-09-01'),
      actualStartDate: tag('2026-09-01'),
      vergleichsentgelt: '18.5000',
    })
  })

  async function erfassterZettel(): Promise<string> {
    return legeGenehmigtenZettelAn(welt, {
      nummer: 'SZ-1',
      einsatz,
      periode,
      von: PERIODE_VON,
      bis: PERIODE_BIS,
      positionen: [{ tag: tag('2026-10-05'), stunden: '8.0000' }],
      status: 'recorded',
    })
  }

  it('schickt die Einreichung an die Rolle der ersten Stufe', async () => {
    const id = await erfassterZettel()
    ok(await submitTimesheet(lieferantDisponent, { timesheetId: id }, HEUTE))

    const liste = await nachrichten(id)
    expect(liste).toHaveLength(1)
    const stufen = await prisma.timesheetApproval.findMany({
      where: { timesheetId: id },
      orderBy: { level: 'asc' },
    })
    // Adressiert wird das **kopierte** Rollenkürzel der ersten Stufe (3.1).
    expect(liste[0]?.recipientRoleCode).toBe(stufen[0]?.assignedRoleCode)
  })

  it('schickt die Ablehnung an die erfassende Seite — mit Begründung', async () => {
    const id = await erfassterZettel()
    ok(await submitTimesheet(lieferantDisponent, { timesheetId: id }, HEUTE))
    const stufen = await prisma.timesheetApproval.findMany({ where: { timesheetId: id } })
    const erste = stufen[0]
    if (erste === undefined) throw new Error('Ohne Freigabestufe ist der Test sinnlos.')
    const entscheider = erste.assignedRoleCode === 'demandOwner' ? bedarfstraeger : genehmiger

    ok(
      await decideStage(
        entscheider,
        {
          timesheetId: id,
          decision: 'rejected',
          rejectionReason: 'Der 6. Oktober fehlt.',
          comment: null,
        },
        HEUTE,
      ),
    )

    const liste = await nachrichten(id)
    const ablehnung = liste[liste.length - 1]
    expect(ablehnung?.statusTo).toBe('rejected')
    // Der Zettel wurde von `LD` eingereicht — die erfassende Seite ist der
    // Lieferant (4.4).
    expect(ablehnung?.recipientRoleCode).toBe('supplierCoordinator')
    expect(ablehnung?.recipientTenantId).toBe(welt.lieferantMandant)
    expect(ablehnung?.message).toContain('Der 6. Oktober fehlt.')
  })

  it('öffnet die nächste Stufe und genehmigt am Ende an MD und LD', async () => {
    const id = await erfassterZettel()
    ok(await submitTimesheet(lieferantDisponent, { timesheetId: id }, HEUTE))
    // Vorbelegte Folge aus 4.4: erst die Kundenseite (`KB`), dann `MD`.
    ok(
      await decideStage(
        bedarfstraeger,
        { timesheetId: id, decision: 'approved', rejectionReason: null, comment: null },
        HEUTE,
      ),
    )
    const nachStufe = await nachrichten(id)
    const zweite = nachStufe.find((zeile) => zeile.statusTo === 'inApproval' && zeile.statusFrom === 'inApproval')
    expect(zweite?.recipientRoleCode).toBe('operatorCoordinator')

    ok(
      await decideStage(
        disponent,
        { timesheetId: id, decision: 'approved', rejectionReason: null, comment: null },
        HEUTE,
      ),
    )
    const genehmigt = (await nachrichten(id)).filter((zeile) => zeile.statusTo === 'approved')
    expect(genehmigt.map((zeile) => zeile.recipientRoleCode).sort()).toEqual([
      'operatorCoordinator',
      'supplierCoordinator',
    ])
  })

  it('erzeugt zur Warnung aus 4.7 eine eigene Nachricht mit Prüfung (Q35, P1)', async () => {
    // Das Fristende der Höchstüberlassungsdauer liegt **vor** dem erfassten
    // Tag: P1 trägt bei der Genehmigung nach 5.5.5 eine Warnung mit
    // Pflicht-Eskalation, keine Sperre — die Zeiten sind erbracht.
    await prisma.assignment.update({
      where: { id: einsatz },
      data: { maxDurationEndDate: tag('2026-10-01') },
    })
    const id = await erfassterZettel()
    ok(await submitTimesheet(lieferantDisponent, { timesheetId: id }, HEUTE))
    ok(
      await decideStage(
        bedarfstraeger,
        { timesheetId: id, decision: 'approved', rejectionReason: null, comment: null },
        HEUTE,
      ),
    )
    ok(
      await decideStage(
        disponent,
        { timesheetId: id, decision: 'approved', rejectionReason: null, comment: null },
        HEUTE,
      ),
    )

    const warnungen = await prisma.notification.findMany({ where: { trigger: 'ruleWarning' } })
    // Zwei Übergänge, zwei Warnungen: 4.7 ordnet P1 **beiden** zu — Q33 beim
    // Einreichen und Q35 bei der Genehmigung. Jede nennt ihren Statuswechsel.
    expect(new Set(warnungen.map((zeile) => zeile.statusTo))).toEqual(
      new Set(['submitted', 'approved']),
    )
    const beiGenehmigung = warnungen.filter((zeile) => zeile.statusTo === 'approved')
    // Adressaten aus 5.1.6, Zeile 3: `MD`, `MA`, `KB` und `LD` — jeder in
    // seiner Organisation.
    expect(beiGenehmigung.map((zeile) => zeile.recipientRoleCode).sort()).toEqual([
      'demandOwner',
      'operatorAdmin',
      'operatorCoordinator',
      'supplierCoordinator',
    ])
    for (const warnung of warnungen) {
      expect(warnung.kind).toBe('warning')
      expect(warnung.ruleRef).toBe('P1')
      expect(warnung.message).toContain('P1')
    }
    // 5.5.2 Nr. 1: das Ergebnis wird protokolliert — der Eintrag des Übergangs
    // trägt nur **eine** `ruleRef`.
    const eintrag = await prisma.auditEntry.findFirst({
      where: { objectType: 'notification', ruleRef: 'P1' },
    })
    expect(eintrag).not.toBe(null)
  })
})

/* ------------------------------------------------------------------ */
/* 4.3 Einsatz und Verlängerung                                        */
/* ------------------------------------------------------------------ */

describe('Einsatz und Verlängerung (4.3)', () => {
  beforeEach(async () => {
    einsatz = await legeEinsatzAn(welt, {
      nummer: 'E-2026-0001',
      status: 'planned',
      plannedStartDate: tag('2026-11-01'),
      plannedEndDate: tag('2026-12-31'),
      vergleichsentgelt: '18.5000',
    })
  })

  it('schickt den Beginn an KB und LD, die Unterbrechung an beide Seiten', async () => {
    ok(
      await transitionAssignment(
        disponent,
        {
          assignmentId: einsatz,
          transition: 'start',
          actualStartDate: tag('2026-11-02'),
          actualEndDate: null,
          interruptionFrom: null,
          interruptionReason: null,
          interruptionTo: null,
        },
        HEUTE,
      ),
    )
    const nachStart = await nachrichten(einsatz)
    expect(nachStart.map((zeile) => zeile.recipientRoleCode).sort()).toEqual([
      'demandOwner',
      'supplierCoordinator',
    ])
    expect(nachStart[0]?.statusFrom).toBe('planned')
    expect(nachStart[0]?.statusTo).toBe('active')

    ok(
      await transitionAssignment(
        disponent,
        {
          assignmentId: einsatz,
          transition: 'interrupt',
          actualStartDate: null,
          actualEndDate: null,
          interruptionFrom: tag('2026-11-10'),
          interruptionReason: 'Krankheit',
          interruptionTo: null,
        },
        HEUTE,
      ),
    )
    const unterbrochen = (await nachrichten(einsatz)).filter(
      (zeile) => zeile.statusTo === 'interrupted',
    )
    // „An beide Seiten" (4.3): `KB` beim Kunden, `LD` beim Lieferanten.
    expect(unterbrochen.map((zeile) => zeile.recipientRoleCode).sort()).toEqual([
      'demandOwner',
      'supplierCoordinator',
    ])
    expect(unterbrochen.map((zeile) => zeile.recipientTenantId).sort()).toEqual(
      [welt.kundenMandant, welt.lieferantMandant].sort(),
    )
  })

  it('schickt den Verlängerungsantrag an KG und die Ablehnung an den Antragsteller', async () => {
    ok(
      await requestExtension(disponent, {
        assignmentId: einsatz,
        newEndDate: tag('2027-03-31'),
        reason: 'Projekt läuft länger.',
      }),
    )
    const verlaengerung = await prisma.assignmentExtension.findFirstOrThrow()
    const beantragt = await nachrichten(verlaengerung.id)
    expect(beantragt).toHaveLength(1)
    expect(beantragt[0]?.recipientRoleCode).toBe('approver')
    expect(beantragt[0]?.recipientTenantId).toBe(welt.kundenMandant)

    ok(
      await transitionExtension(genehmiger, {
        extensionId: verlaengerung.id,
        transition: 'reject',
        rejectionReason: 'Budget reicht nicht.',
      }),
    )
    const abgelehnt = (await nachrichten(verlaengerung.id)).filter(
      (zeile) => zeile.statusTo === 'rejected',
    )
    // Beantragt hat `MD` (der Betreiber hält den Antrag, 4.3.2): die Ablehnung
    // geht an ihn zurück.
    expect(abgelehnt).toHaveLength(1)
    expect(abgelehnt[0]?.recipientRoleCode).toBe('operatorCoordinator')
  })
})

/* ------------------------------------------------------------------ */
/* 5.4 Nachweis                                                        */
/* ------------------------------------------------------------------ */

describe('Nachweis (5.4.3)', () => {
  async function eingestellterNachweis(): Promise<string> {
    ok(
      await submitDocument(lieferantAdmin, {
        documentCategory: 'clearanceCertificate',
        subjectType: 'supplier',
        subjectId: welt.lieferant,
        issuer: 'Finanzamt (synthetisch)',
        issuedOn: tag('2026-01-02'),
        validFrom: tag('2026-01-01'),
        validTo: tag('2026-12-31'),
        fileName: 'nachweis.pdf',
        mimeType: 'application/pdf',
        confidentiality: 'operatorOnly',
      }),
    )
    const zeile = await prisma.document.findFirstOrThrow({
      where: { documentCategory: 'clearanceCertificate' },
      orderBy: { createdAt: 'desc' },
    })
    return zeile.id
  }

  it('schickt die Einstellung an MD', async () => {
    const id = await eingestellterNachweis()
    const liste = await nachrichten(id)
    expect(liste).toHaveLength(1)
    expect(liste[0]?.recipientRoleCode).toBe('operatorCoordinator')
    expect(liste[0]?.recipientTenantId).toBe(welt.betreiberMandant)
  })

  it('schickt die Zurückweisung an den Einsteller — mit Begründung', async () => {
    const id = await eingestellterNachweis()
    ok(
      await rejectDocument(disponent, {
        documentId: id,
        rejectionReason: 'Die Urkunde ist unlesbar.',
      }),
    )
    const liste = await nachrichten(id)
    const zurueck = liste[liste.length - 1]
    // Eingestellt hat `LA` — die Nachricht geht an die Rolle, in der die
    // Person im Mandanten des Nachweises gehandelt hat (*offene Frage 58*).
    expect(zurueck?.recipientRoleCode).toBe('supplierAdmin')
    expect(zurueck?.recipientTenantId).toBe(welt.lieferantMandant)
    expect(zurueck?.message).toContain('Die Urkunde ist unlesbar.')
  })

  it('schickt die Anerkennung an den Einsteller — ohne Begründung', async () => {
    const id = await eingestellterNachweis()
    ok(
      await acceptDocument(disponent, { documentId: id, rejectionReason: null }),
    )
    const liste = await nachrichten(id)
    const anerkannt = liste[liste.length - 1]
    expect(anerkannt?.recipientRoleCode).toBe('supplierAdmin')
    expect(anerkannt?.message).not.toContain('Begründung')
  })
})
