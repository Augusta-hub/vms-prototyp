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
  createAssignment,
  requestExtension,
  transitionAssignment,
  transitionExtension,
  transitionSubmission,
} from '../../lib/services/staffing'
import { decideStage, submitTimesheet } from '../../lib/services/timesheets'
import {
  baueWelt,
  legeAbrechnungsperiodeAn,
  legeEinsatzAn,
  legeGenehmigtenZettelAn,
  legeProfilvorschlagAn,
  legeVergleichsentgeltAn,
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

it('meldet die Warnung aus Q39 — das Vergleichsentgelt fehlt für den Zeitraum', async () => {
    // Die Equal-Pay-Fälligkeit liegt im Leistungszeitraum, und der Standort
    // führt keinen Eintrag: 5.2.4 nennt dafür `KE` — „der Entleiher pflegt den
    // Eintrag".
    await prisma.assignment.update({
      where: { id: einsatz },
      data: { equalPayDueDate: tag('2026-10-10'), comparableWage: null },
    })
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
    const warnungen = await prisma.notification.findMany({ where: { trigger: 'ruleWarning' } })
    expect(warnungen.map((zeile) => zeile.recipientRoleCode)).toEqual(['procurementController'])
    expect(warnungen[0]?.ruleRef).toBe('P4')
    expect(warnungen[0]?.objectRef).toBe(beleg.id)
    // Die Warnung gehört dem Übergang „— → `created`" (4.7) und trägt ihn.
    expect(warnungen[0]?.statusFrom).toBe(null)
    expect(warnungen[0]?.statusTo).toBe('created')
    // Q40 ist eine **Information** und erzeugt keine Nachricht (5.5.2).
    expect(warnungen.some((zeile) => zeile.ruleRef === 'P5')).toBe(false)
  })

  it('meldet die Warnung aus Q38 — die Erlaubnis deckt den Leistungszeitraum nicht', async () => {
    // Die Erlaubnis des Lieferanten endet vor dem Leistungszeitraum. 5.4.2 b)
    // sagt dazu: erbrachte Leistung wird abgerechnet, der Befund dokumentiert.
    await prisma.supplierPermit.updateMany({
      where: { supplierId: welt.lieferant },
      data: { validTo: tag('2026-09-30') },
    })
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
    const warnungen = await prisma.notification.findMany({
      where: { trigger: 'ruleWarning', ruleRef: 'P9' },
    })
    expect(warnungen.length).toBeGreaterThan(0)
    expect(warnungen.every((zeile) => zeile.kind === 'warning')).toBe(true)
    expect(warnungen.every((zeile) => zeile.statusTo === 'created')).toBe(true)
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


  it('meldet die Warnung aus Q34 — die Equal-Pay-Fälligkeit fällt in den Zeitraum', async () => {
    // Fälligkeit im Zettelzeitraum, Vergleichsentgelt am Einsatz vorhanden:
    // 5.0 nennt dafür den **Hinweis** an `MD` und `KE`.
    await prisma.assignment.update({
      where: { id: einsatz },
      data: { equalPayDueDate: tag('2026-10-15') },
    })
    const id = await erfassterZettel()
    ok(await submitTimesheet(lieferantDisponent, { timesheetId: id }, HEUTE))

    const warnungen = await prisma.notification.findMany({
      where: { trigger: 'ruleWarning', ruleRef: 'P3' },
    })
    expect(warnungen.map((zeile) => zeile.recipientRoleCode).sort()).toEqual([
      'operatorCoordinator',
      'procurementController',
    ])
    // Q34 gehört dem Systemübergang `submitted` → `inApproval` (4.7).
    expect(warnungen[0]?.statusFrom).toBe('submitted')
    expect(warnungen[0]?.statusTo).toBe('inApproval')
  })

  it('weitet die Adressaten aus Q34, wenn das Vergleichsentgelt fehlt', async () => {
    // Dieselbe Lage ohne Entgelt am Einsatz: 2.4 führt dafür „Equal-Pay-Frist
    // erreicht, Vergleichsentgelt fehlt" mit `MA` zusätzlich.
    await prisma.assignment.update({
      where: { id: einsatz },
      data: { equalPayDueDate: tag('2026-10-15'), comparableWage: null },
    })
    const id = await erfassterZettel()
    ok(await submitTimesheet(lieferantDisponent, { timesheetId: id }, HEUTE))

    const warnungen = await prisma.notification.findMany({
      where: { trigger: 'ruleWarning', ruleRef: 'P3' },
    })
    expect(warnungen.map((zeile) => zeile.recipientRoleCode).sort()).toEqual([
      'operatorAdmin',
      'operatorCoordinator',
      'procurementController',
    ])
  })

  it('meldet die Warnung aus Q37 — der Unterweisungsnachweis fehlt', async () => {
    const ohneUnterweisung = await legeEinsatzAn(welt, {
      nummer: 'E-2026-0002',
      status: 'active',
      plannedStartDate: tag('2026-09-01'),
      actualStartDate: tag('2026-09-01'),
      vergleichsentgelt: '18.5000',
      mitUnterweisung: false,
    })
    const id = await legeGenehmigtenZettelAn(welt, {
      nummer: 'SZ-2',
      einsatz: ohneUnterweisung,
      periode,
      von: PERIODE_VON,
      bis: PERIODE_BIS,
      positionen: [{ tag: tag('2026-10-05'), stunden: '8.0000' }],
      status: 'recorded',
    })
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

    const warnungen = await prisma.notification.findMany({
      where: { trigger: 'ruleWarning', ruleRef: 'P10' },
    })
    // Die Adressaten kommen aus dem Pflichtkatalog in 5.4.4, Stufe
    // „abgelaufen" der Unterweisung — nicht aus dem Fachdienst.
    expect(warnungen.length).toBeGreaterThan(0)
    expect(warnungen.every((zeile) => zeile.statusTo === 'approved')).toBe(true)
    // Stufe „Warnung" der Unterweisung in 5.4.4: `KB` und `LD`, jeder in
    // seiner Organisation — der Katalog nennt sie, nicht der Fachdienst.
    expect(new Set(warnungen.map((zeile) => zeile.recipientRoleCode))).toEqual(
      new Set(['demandOwner', 'supplierCoordinator']),
    )
    expect(new Set(warnungen.map((zeile) => zeile.recipientTenantId))).toEqual(
      new Set([welt.kundenMandant, welt.lieferantMandant]),
    )
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

/* ------------------------------------------------------------------ */
/* 4.7 Warnungen an Vorschlag, Einsatz und Verlängerung                */
/* ------------------------------------------------------------------ */

/** Die Warnungen aus 4.7 zu einer Prüfung, in der Reihenfolge ihrer Entstehung. */
async function warnungen(ruleRef?: string) {
  return prisma.notification.findMany({
    where: { trigger: 'ruleWarning', ...(ruleRef === undefined ? {} : { ruleRef }) },
    orderBy: [{ raisedAt: 'asc' }, { recipientRoleCode: 'asc' }],
  })
}

describe('Warnungen am Profilvorschlag (4.7, Q07 bis Q13)', () => {
  it('meldet Q09 bei der Sichtung — kein Arbeitsverhältnis beim Verleiher', async () => {
    // 5.3.4: ein **Bewerber** ist am ersten Überlassungstag nicht beschäftigt.
    // 4.7 gibt Q09 dafür eine Warnung, keine Sperre — die steht in Q47.
    await prisma.candidate.update({
      where: { id: welt.kandidat },
      data: { employmentStatusWithSupplier: 'applicant', employedSince: null },
    })
    const vorschlag = await legeProfilvorschlagAn(welt, {
      nummer: 'PV-4701',
      status: 'submitted',
      verfuegbarAb: tag('2026-12-01'),
    })
    ok(
      await transitionSubmission(
        disponent,
        { submissionId: vorschlag, transition: 'review', decisionReason: null, interviewAt: null },
        HEUTE,
      ),
    )

    const gemeldet = await warnungen('P11')
    expect(gemeldet.length).toBeGreaterThan(0)
    // Q09 gehört dem Übergang `submitted` → `reviewed` (4.7).
    expect(gemeldet.every((zeile) => zeile.statusFrom === 'submitted')).toBe(true)
    expect(gemeldet.every((zeile) => zeile.statusTo === 'reviewed')).toBe(true)
    expect(gemeldet.every((zeile) => zeile.kind === 'warning')).toBe(true)
    // Adressaten aus der Regelwerkkonfiguration zu P11 (5.3.4) — `MD` und `LD`.
    expect(new Set(gemeldet.map((zeile) => zeile.recipientRoleCode))).toEqual(
      new Set(['operatorCoordinator', 'supplierCoordinator']),
    )
    // [47]: jede Nachricht bleibt in der Organisation ihrer Rolle.
    const lieferantenzeile = gemeldet.find(
      (zeile) => zeile.recipientRoleCode === 'supplierCoordinator',
    )
    expect(lieferantenzeile?.recipientTenantId).toBe(welt.lieferantMandant)
  })

  it('meldet Q07 bei der Sichtung — die Warnschwelle aus 5.1.6 ist erreicht', async () => {
    // Die Kette läuft seit 2025-06-01 bei diesem Kunden; die Regelgrenze von
    // 18 Monaten endet damit am 2026-11-30. Der Prüfzeitraum des Vorschlags
    // (5.0: `availableFrom` bis `endDate` der Anfrage) endet zehn Tage davor
    // — innerhalb von `maxDurationWarningDays` (5.1.6).
    await legeEinsatzAn(welt, {
      nummer: 'E-2026-0009',
      status: 'active',
      plannedStartDate: tag('2025-06-01'),
      plannedEndDate: tag('2026-11-15'),
      actualStartDate: tag('2025-06-01'),
      vergleichsentgelt: '18.5000',
    })
    const vorschlag = await legeProfilvorschlagAn(welt, {
      nummer: 'PV-4705',
      status: 'submitted',
      verfuegbarAb: tag('2026-11-16'),
      anfrageEnde: tag('2026-11-20'),
    })
    ok(
      await transitionSubmission(
        disponent,
        { submissionId: vorschlag, transition: 'review', decisionReason: null, interviewAt: null },
        HEUTE,
      ),
    )

    const gemeldet = await warnungen('P1')
    expect(gemeldet.length).toBeGreaterThan(0)
    expect(gemeldet.every((zeile) => zeile.statusTo === 'reviewed')).toBe(true)
    // Adressaten der Warnstufe aus 5.1.6, Zeile 2: `MD` → `MA`, zusätzlich
    // Information an `KB` — gestuft von der Regel, nicht vom Fachdienst.
    expect(new Set(gemeldet.map((zeile) => zeile.recipientRoleCode))).toEqual(
      new Set(['operatorCoordinator', 'operatorAdmin', 'demandOwner']),
    )
  })

  it('meldet Q09 nicht, wenn das Arbeitsverhältnis am ersten Überlassungstag besteht', async () => {
    // 5.3.4: Prüfzeitpunkt ist der **vorgesehene erste Überlassungstag**, nicht
    // der Tag der Sichtung. Der Kandidat ist am 2026-11-20 eingestellt — nach
    // der Sichtung (2026-11-05) und vor dem ersten Tag (2026-12-01).
    await prisma.candidate.update({
      where: { id: welt.kandidat },
      data: { employmentStatusWithSupplier: 'employed', employedSince: tag('2026-11-20') },
    })
    const vorschlag = await legeProfilvorschlagAn(welt, {
      nummer: 'PV-4706',
      status: 'submitted',
      verfuegbarAb: tag('2026-12-01'),
    })
    ok(
      await transitionSubmission(
        disponent,
        { submissionId: vorschlag, transition: 'review', decisionReason: null, interviewAt: null },
        HEUTE,
      ),
    )

    expect(await warnungen('P11')).toHaveLength(0)
  })

  it('meldet Q08 bei der Sichtung — Vorbeschäftigung beim Entleiher (P6)', async () => {
    await prisma.candidate.update({
      where: { id: welt.kandidat },
      data: {
        previousEmploymentDeclaredAt: tag('2026-10-01'),
        previousEmploymentExisted: true,
        // Innerhalb des Rückschaufensters aus 5.3.1, gerechnet vom
        // vorgesehenen ersten Überlassungstag.
        previousEmploymentEndedOn: tag('2026-09-01'),
        // **Nicht** der Entleiher selbst, sondern ein Unternehmen seines
        // Konzerns: 5.3.1 zieht § 18 AktG heran, und der Verbund muss dafür
        // geladen werden — sonst bliebe der Treffer aus.
        previousEmploymentEmployer: 'Nordwerk Service GmbH',
      },
    })
    const vorschlag = await legeProfilvorschlagAn(welt, {
      nummer: 'PV-4702',
      status: 'submitted',
      verfuegbarAb: tag('2026-12-01'),
    })
    ok(
      await transitionSubmission(
        disponent,
        { submissionId: vorschlag, transition: 'review', decisionReason: null, interviewAt: null },
        HEUTE,
      ),
    )

    const gemeldet = await warnungen('P6')
    expect(gemeldet.length).toBeGreaterThan(0)
    expect(gemeldet.every((zeile) => zeile.statusTo === 'reviewed')).toBe(true)
    // 5.3.1, Schritt 5: Rechtsfolge ist Equal Pay ab dem ersten Tag — die
    // Meldung nennt sie, damit die Nachricht ohne Rückfrage brauchbar ist.
    expect(gemeldet[0]?.message).toContain('P6')
  })

  it('meldet Q12 und Q13 bei der Zusage — nicht schon bei der Vorlage', async () => {
    await prisma.candidate.update({
      where: { id: welt.kandidat },
      data: {
        employmentStatusWithSupplier: 'applicant',
        employedSince: null,
        previousEmploymentDeclaredAt: tag('2026-10-01'),
        previousEmploymentExisted: false,
        previousEmploymentEndedOn: null,
        previousEmploymentEmployer: null,
      },
    })
    const vorschlag = await legeProfilvorschlagAn(welt, {
      nummer: 'PV-4703',
      status: 'releasedToCustomer',
      verfuegbarAb: tag('2026-12-01'),
    })
    ok(
      await transitionSubmission(
        bedarfstraeger,
        { submissionId: vorschlag, transition: 'accept', decisionReason: null, interviewAt: null },
        HEUTE,
      ),
    )

    const gemeldet = await warnungen('P11')
    expect(gemeldet.length).toBeGreaterThan(0)
    // Q13 gehört dem Übergang nach `accepted`; Q09 ist hier nicht gelaufen,
    // weil die Sichtung vor dem Fixture-Stand lag.
    expect(gemeldet.every((zeile) => zeile.statusTo === 'accepted')).toBe(true)
    // P6 hat **keinen** Treffer: die Erklärung sagt „keine Vorbeschäftigung".
    expect(await warnungen('P6')).toHaveLength(0)
  })

  it('meldet nichts, wenn der Übergang nicht stattfindet (4.0, Regel 2)', async () => {
    await prisma.candidate.update({
      where: { id: welt.kandidat },
      data: { employmentStatusWithSupplier: 'applicant', employedSince: null },
    })
    const vorschlag = await legeProfilvorschlagAn(welt, {
      nummer: 'PV-4704',
      status: 'releasedToCustomer',
      verfuegbarAb: tag('2026-12-01'),
    })
    // Die Zusage ist gesperrt: die Erklärung zur Vorbeschäftigung fehlt (P6).
    const ergebnis = await transitionSubmission(
      bedarfstraeger,
      { submissionId: vorschlag, transition: 'accept', decisionReason: null, interviewAt: null },
      HEUTE,
    )
    expect(ergebnis.ok).toBe(false)
    expect(await warnungen()).toHaveLength(0)
  })
})

describe('Warnungen am Einsatz und an der Verlängerung (4.7, Q15 bis Q32)', () => {
  /** Ein zugesagter Vorschlag — die Vorbedingung des Einsatzes (4.2.3, 4.3.1). */
  async function zugesagterVorschlag(nummer: string): Promise<string> {
    await prisma.candidate.update({
      where: { id: welt.kandidat },
      data: {
        previousEmploymentDeclaredAt: tag('2026-10-01'),
        previousEmploymentExisted: false,
        previousEmploymentEndedOn: null,
        previousEmploymentEmployer: null,
      },
    })
    const vorschlag = await legeProfilvorschlagAn(welt, {
      nummer,
      status: 'releasedToCustomer',
      verfuegbarAb: tag('2026-12-01'),
    })
    ok(
      await transitionSubmission(
        bedarfstraeger,
        { submissionId: vorschlag, transition: 'accept', decisionReason: null, interviewAt: null },
        HEUTE,
      ),
    )
    return vorschlag
  }

  it('meldet Q18 beim Anlegen — für diese Tätigkeit ist kein Vergleichsentgelt hinterlegt', async () => {
    const vorschlag = await zugesagterVorschlag('PV-4710')
    ok(
      await createAssignment(
        disponent,
        {
          submissionId: vorschlag,
          costCenterId: welt.kostenstelle,
          // Keine Entsprechung in den Vergleichsentgelt-Einträgen des
          // Standorts: P4 findet nichts (5.2.4, Schritt 1).
          activityDescription: 'Kommissionierung im Wareneingang, Halle 7',
          plannedStartDate: tag('2026-12-01'),
          plannedEndDate: tag('2027-03-31'),
          weeklyHours: 35,
          shiftModel: null,
          agreedRateCardItemId: welt.einkaufsposition,
          customerRateCardItemId: welt.verkaufsposition,
          comparableWage: null,
        },
        HEUTE,
      ),
    )

    const gemeldet = await warnungen('P4')
    expect(gemeldet.length).toBeGreaterThan(0)
    // Q18 gehört dem Übergang „— → `planned`" (4.7).
    expect(gemeldet.every((zeile) => zeile.statusFrom === null)).toBe(true)
    expect(gemeldet.every((zeile) => zeile.statusTo === 'planned')).toBe(true)
    expect(gemeldet[0]?.message).toContain('P4')
    // 5.5.2 Nr. 1: das Ergebnis steht auch im Protokoll.
    const eintrag = await prisma.auditEntry.findFirst({
      where: { objectType: 'notification', ruleRef: 'P4' },
    })
    expect(eintrag).not.toBe(null)
  })

  it('meldet Q18 nicht, wenn für die Tätigkeit ein Eintrag des Standorts vorliegt', async () => {
    // 5.2.4, Schritt 1: der Eintrag wird über `activityKey` **zur Tätigkeit
    // des Einsatzes** gewählt. Stimmen sie überein, ist das Vergleichsentgelt
    // hinterlegt und Q18 schweigt.
    await legeVergleichsentgeltAn(welt, { taetigkeit: 'Montage von Baugruppen an der Linie 2' })
    const vorschlag = await zugesagterVorschlag('PV-4713')
    ok(
      await createAssignment(
        disponent,
        {
          submissionId: vorschlag,
          costCenterId: welt.kostenstelle,
          activityDescription: 'Montage von Baugruppen an der Linie 2',
          plannedStartDate: tag('2026-12-01'),
          plannedEndDate: tag('2027-03-31'),
          weeklyHours: 35,
          shiftModel: null,
          agreedRateCardItemId: welt.einkaufsposition,
          customerRateCardItemId: welt.verkaufsposition,
          comparableWage: 18.5,
        },
        HEUTE,
      ),
    )

    expect(await warnungen('P4')).toHaveLength(0)
  })

  it('meldet Q15 beim Anlegen — die Drehtürklausel greift (P6)', async () => {
    const vorschlag = await zugesagterVorschlag('PV-4712')
    // Die Erklärung liegt vor — der Übergang ist also **nicht** gesperrt —,
    // aber sie nennt eine Vorbeschäftigung im Konzern des Entleihers. 4.7 gibt
    // Q15 dafür eine Warnung mit der Rechtsfolge aus 5.3.1.
    await prisma.candidate.update({
      where: { id: welt.kandidat },
      data: {
        previousEmploymentExisted: true,
        previousEmploymentEndedOn: tag('2026-09-01'),
        previousEmploymentEmployer: 'Nordwerk Service GmbH',
      },
    })
    ok(
      await createAssignment(
        disponent,
        {
          submissionId: vorschlag,
          costCenterId: welt.kostenstelle,
          activityDescription: 'Montage von Baugruppen an der Linie 2',
          plannedStartDate: tag('2026-12-01'),
          plannedEndDate: tag('2027-03-31'),
          weeklyHours: 35,
          shiftModel: null,
          agreedRateCardItemId: welt.einkaufsposition,
          customerRateCardItemId: welt.verkaufsposition,
          comparableWage: 18.5,
        },
        HEUTE,
      ),
    )

    const gemeldet = await warnungen('P6')
    expect(gemeldet.length).toBeGreaterThan(0)
    expect(gemeldet.every((zeile) => zeile.statusTo === 'planned')).toBe(true)
  })

  it('meldet Q17 beim Anlegen — kein Arbeitsverhältnis am ersten Überlassungstag', async () => {
    const vorschlag = await zugesagterVorschlag('PV-4711')
    await prisma.candidate.update({
      where: { id: welt.kandidat },
      data: { employmentStatusWithSupplier: 'applicant', employedSince: null },
    })
    ok(
      await createAssignment(
        disponent,
        {
          submissionId: vorschlag,
          costCenterId: welt.kostenstelle,
          activityDescription: 'Montage von Baugruppen an der Linie 2',
          plannedStartDate: tag('2026-12-01'),
          plannedEndDate: tag('2027-03-31'),
          weeklyHours: 35,
          shiftModel: null,
          agreedRateCardItemId: welt.einkaufsposition,
          customerRateCardItemId: welt.verkaufsposition,
          comparableWage: 18.5,
        },
        HEUTE,
      ),
    )

    const gemeldet = await warnungen('P11')
    expect(gemeldet.length).toBeGreaterThan(0)
    expect(gemeldet.every((zeile) => zeile.statusTo === 'planned')).toBe(true)
  })

  it('meldet Q29 bei der Genehmigung der Verlängerung — Fälligkeit im verlängerten Zeitraum', async () => {
    const verlaengerter = await legeEinsatzAn(welt, {
      nummer: 'E-2026-0010',
      status: 'active',
      plannedStartDate: tag('2026-06-01'),
      plannedEndDate: tag('2026-12-31'),
      actualStartDate: tag('2026-06-01'),
      vergleichsentgelt: '18.5000',
    })
    ok(
      await requestExtension(disponent, {
        assignmentId: verlaengerter,
        newEndDate: tag('2027-03-31'),
        reason: 'Projekt läuft länger.',
      }),
    )
    const verlaengerung = await prisma.assignmentExtension.findFirstOrThrow()
    ok(
      await transitionExtension(
        genehmiger,
        { extensionId: verlaengerung.id, transition: 'approve', rejectionReason: null },
        HEUTE,
      ),
    )

    const gemeldet = await warnungen('P3')
    expect(gemeldet.length).toBeGreaterThan(0)
    // Q29 gehört dem Übergang `requested` → `approved` (4.7).
    expect(gemeldet.every((zeile) => zeile.statusFrom === 'requested')).toBe(true)
    expect(gemeldet.every((zeile) => zeile.statusTo === 'approved')).toBe(true)
    // Das Vergleichsentgelt liegt am Einsatz: 5.0 nennt dafür den **Hinweis**
    // an `MD` und `KE`, nicht die weitere Liste mit `MA`.
    expect(new Set(gemeldet.map((zeile) => zeile.recipientRoleCode))).toEqual(
      new Set(['operatorCoordinator', 'procurementController']),
    )
    expect(gemeldet[0]?.message).toContain('verlängerten Zeitraum')
  })

  it('meldet Q28 bei der Genehmigung — das neue Ende liegt nach dem Fristende', async () => {
    // Die Kette beginnt am 2025-06-01; die Regelgrenze von 18 Monaten endet am
    // 2026-11-30. Das beantragte neue Ende liegt danach. 4.7 gibt Q28 eine
    // **Warnung** — als Vorschau für die Kundenseite; die Sperre steht in Q30,
    // an der Wirksamkeit.
    const langer = await legeEinsatzAn(welt, {
      nummer: 'E-2026-0012',
      status: 'active',
      plannedStartDate: tag('2025-06-01'),
      plannedEndDate: tag('2026-11-30'),
      actualStartDate: tag('2025-06-01'),
      vergleichsentgelt: '18.5000',
    })
    ok(
      await requestExtension(disponent, {
        assignmentId: langer,
        newEndDate: tag('2027-06-30'),
        reason: 'Projekt läuft länger.',
      }),
    )
    const verlaengerung = await prisma.assignmentExtension.findFirstOrThrow()
    ok(
      await transitionExtension(
        genehmiger,
        { extensionId: verlaengerung.id, transition: 'approve', rejectionReason: null },
        HEUTE,
      ),
    )

    const gemeldet = await warnungen('P1')
    expect(gemeldet.length).toBeGreaterThan(0)
    expect(gemeldet.every((zeile) => zeile.statusTo === 'approved')).toBe(true)
    expect(gemeldet[0]?.message).toContain('P1')
  })

  it('meldet Q32 erst bei der Wirksamkeit, nicht schon bei der Genehmigung', async () => {
    const verlaengerter = await legeEinsatzAn(welt, {
      nummer: 'E-2026-0011',
      status: 'active',
      plannedStartDate: tag('2026-06-01'),
      plannedEndDate: tag('2026-12-31'),
      actualStartDate: tag('2026-06-01'),
      vergleichsentgelt: '18.5000',
    })
    ok(
      await requestExtension(disponent, {
        assignmentId: verlaengerter,
        newEndDate: tag('2027-03-31'),
        reason: 'Projekt läuft länger.',
      }),
    )
    const verlaengerung = await prisma.assignmentExtension.findFirstOrThrow()
    ok(
      await transitionExtension(
        genehmiger,
        { extensionId: verlaengerung.id, transition: 'approve', rejectionReason: null },
        HEUTE,
      ),
    )
    expect(await warnungen('P4')).toHaveLength(0)

    ok(
      await transitionExtension(
        disponent,
        { extensionId: verlaengerung.id, transition: 'makeEffective', rejectionReason: null },
        HEUTE,
      ),
    )
    const gemeldet = await warnungen('P4')
    expect(gemeldet.length).toBeGreaterThan(0)
    expect(gemeldet.every((zeile) => zeile.statusFrom === 'approved')).toBe(true)
    expect(gemeldet.every((zeile) => zeile.statusTo === 'effective')).toBe(true)
  })
})
