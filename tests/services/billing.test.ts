/**
 * Die Abrechnung gegen eine echte Datenbank — SPEC **3.9** und **4.5**.
 *
 * Was hier geprüft wird und **nirgends sonst**:
 *
 *  - dass die Belegpositionen aus genehmigten Zetteln **entstehen** und keine
 *    Eingabe sind — Menge aus dem Zettel, Preis aus der Preisliste **derselben
 *    Seite**, und die Marge zwischen den Seiten bleibt sichtbar,
 *  - dass **beide Seiten denselben Zettel** abrechnen, dieselbe Seite aber
 *    nicht zweimal,
 *  - dass die **Belegnummer lückenlos** ist und ein gesperrter Versuch keine
 *    Nummer verbraucht (3.9),
 *  - dass der **Storno** einen Gegenbeleg erzeugt und die Zettel wieder
 *    abrechenbar macht,
 *  - dass die **Prüffrist** die Beanstandung begrenzt und ihr Ablauf **keinen**
 *    Übergang erzeugt (2.4, Regel 1),
 *  - dass der **Periodenschluss** an einem hängenden Zettel und an einem nicht
 *    abgegebenen Beleg scheitert (4.5.1, offene Frage 24),
 *  - dass eine Sperre **nichts schreibt** (4.0, Regel 5) und jeder Schreibweg
 *    seinen Audit-Eintrag trägt (3.12).
 *
 * Die Übergangsmengen selbst sind in `lib/status/billingDocument.test.ts` und
 * `lib/status/billingPeriod.test.ts` ohne Datenbank geprüft, die Bepreisung in
 * `lib/billing/items.test.ts`. Alle Daten sind synthetisch (CLAUDE.md,
 * Regel 3).
 */

import { beforeEach, describe, expect, it } from 'vitest'
import { loadIdentity, type LoadedIdentity } from '../../lib/identity/loadSubject'
import { prisma } from '../../lib/prisma'
import {
  cancelBillingDocument,
  closeBillingPeriod,
  createBillingDocument,
  loadBillingDocuments,
  loadBillingOptions,
  loadBillingPeriods,
  openBillingPeriod,
  transitionBillingDocument,
} from '../../lib/services/billing'
import {
  baueWelt,
  legeAbrechnungsperiodeAn,
  legeEinsatzAn,
  legeGenehmigtenZettelAn,
  legeZuschlagsartAn,
  legeZuschlagssatzAn,
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
let einkauf: LoadedIdentity
let bedarfstraeger: LoadedIdentity
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

beforeEach(async () => {
  await leereDatenbank()
  welt = await baueWelt()
  administrator = await identitaet(welt.administrator)
  disponent = await identitaet(welt.disponent)
  zweiterDisponent = await identitaet(welt.zweiterDisponent)
  einkauf = await identitaet(welt.einkauf)
  bedarfstraeger = await identitaet(welt.bedarfstraeger)
  lieferantDisponent = await identitaet(welt.lieferantDisponent)
  zweiterLieferantDisponent = await identitaet(welt.zweiterLieferantDisponent)

  periode = await legeAbrechnungsperiodeAn(welt, {
    nummer: '2026-10',
    von: PERIODE_VON,
    bis: PERIODE_BIS,
  })
  einsatz = await legeEinsatzAn(welt, {
    nummer: 'E-2026-0001',
    status: 'active',
    plannedStartDate: tag('2026-09-01'),
    actualStartDate: tag('2026-09-01'),
    vergleichsentgelt: '18.5000',
  })
})

/** Ein genehmigter Zettel über 100 Stunden, ohne Zuschlag. */
async function zettel(nummer = 'SZ-1'): Promise<string> {
  return legeGenehmigtenZettelAn(welt, {
    nummer,
    einsatz,
    periode,
    von: PERIODE_VON,
    bis: PERIODE_BIS,
    positionen: [{ tag: tag('2026-10-05'), stunden: '100.0000' }],
  })
}

async function verkaufsbeleg(taxRate = 19): Promise<string> {
  ok(
    await createBillingDocument(
      administrator,
      {
        billingPeriodId: periode,
        direction: 'sales',
        customerId: welt.kunde,
        supplierId: null,
        taxRate,
      },
      HEUTE,
    ),
  )
  const beleg = await prisma.billingDocument.findFirstOrThrow({
    where: { direction: 'sales' },
    orderBy: { documentNumber: 'desc' },
  })
  return beleg.id
}

describe('Beleg erstellen (4.5.2, — → created)', () => {
  it('leitet Grundleistung und Summen aus dem Zettel ab', async () => {
    await zettel()
    const meldung = ok(
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
    expect(meldung).toContain('RE-000001')
    const beleg = await prisma.billingDocument.findFirstOrThrow({ include: { items: true } })
    expect(beleg.documentType).toBe('customerInvoice')
    expect(beleg.status).toBe('created')
    // 100 Stunden zur Kundenpreisposition (33,90) = 3.390,00 netto.
    expect(Number(beleg.netAmount)).toBeCloseTo(3390, 4)
    expect(Number(beleg.taxAmount)).toBeCloseTo(644.1, 4)
    expect(Number(beleg.grossAmount)).toBeCloseTo(4034.1, 4)
    expect(beleg.items).toHaveLength(1)
    expect(beleg.items[0]?.premiumTypeId).toBeNull()
    expect(Number(beleg.items[0]?.quantity)).toBeCloseTo(100, 4)
    // Die Kostenstelle ist auf der Verkaufsseite Pflicht (3.9).
    expect(beleg.items[0]?.costCenterId).toBe(welt.kostenstelle)
  })

  it('rechnet die Einkaufsseite mit dem **anderen** Satz — die Differenz ist die Marge', async () => {
    await zettel()
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
    const beleg = await prisma.billingDocument.findFirstOrThrow({
      where: { direction: 'purchase' },
      include: { items: true },
    })
    expect(beleg.documentType).toBe('supplierCreditNote')
    // 100 Stunden zur Einkaufsposition (24,50) = 2.450,00 netto.
    expect(Number(beleg.netAmount)).toBeCloseTo(2450, 4)
    // Auf der Einkaufsseite trägt die Position **keine** Kostenstelle: für den
    // Lieferanten ist sie nicht sichtbar ([14], 3.7).
    expect(beleg.items[0]?.costCenterId).toBeNull()
  })

  it('bepreist einen Zuschlag aus der Preisliste **derselben** Seite (3.3)', async () => {
    const art = await legeZuschlagsartAn(welt, {
      code: 'NACHT',
      grundlage: 'timeOfDay',
      anlass: 'night',
      vonMinute: 23 * 60,
      bisMinute: 6 * 60,
    })
    await legeZuschlagssatzAn(welt, { artId: art, seite: 'sales', wert: '25.0000' })
    await legeZuschlagssatzAn(welt, { artId: art, seite: 'purchase', wert: '20.0000' })
    await legeGenehmigtenZettelAn(welt, {
      nummer: 'SZ-N',
      einsatz,
      periode,
      von: PERIODE_VON,
      bis: PERIODE_BIS,
      positionen: [
        { tag: tag('2026-10-05'), stunden: '100.0000', zuschlaege: [{ artId: art, stunden: '10.0000' }] },
      ],
    })

    await verkaufsbeleg()
    const verkauf = await prisma.billingDocument.findFirstOrThrow({
      where: { direction: 'sales' },
      include: { items: { where: { premiumTypeId: { not: null } } } },
    })
    // 25 % von 33,90 = 8,475 je Stunde.
    expect(Number(verkauf.items[0]?.unitPrice)).toBeCloseTo(8.475, 4)

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
    const einkaufBeleg = await prisma.billingDocument.findFirstOrThrow({
      where: { direction: 'purchase' },
      include: { items: { where: { premiumTypeId: { not: null } } } },
    })
    // 20 % von 24,50 = 4,90 je Stunde — der Satz der Einkaufsseite.
    expect(Number(einkaufBeleg.items[0]?.unitPrice)).toBeCloseTo(4.9, 4)
  })

  it('verweigert den Beleg, wenn die Preisliste der Seite den Zuschlagssatz nicht führt', async () => {
    // 4.5.2: „Preisposition der jeweiligen Seite vorhanden". Der
    // Vorbelegungswert der Zuschlagsart tritt nicht ein — er ist keine
    // Vereinbarung zwischen den Parteien.
    const art = await legeZuschlagsartAn(welt, { code: 'ERSCH', grundlage: 'manual' })
    await legeGenehmigtenZettelAn(welt, {
      nummer: 'SZ-E',
      einsatz,
      periode,
      von: PERIODE_VON,
      bis: PERIODE_BIS,
      positionen: [
        { tag: tag('2026-10-05'), stunden: '80.0000', zuschlaege: [{ artId: art, stunden: '4.0000' }] },
      ],
    })
    const ergebnis = await createBillingDocument(
      administrator,
      {
        billingPeriodId: periode,
        direction: 'sales',
        customerId: welt.kunde,
        supplierId: null,
        taxRate: 19,
      },
      HEUTE,
    )
    expect(ergebnis.ok).toBe(false)
    if (!ergebnis.ok) expect(ergebnis.error).toContain('ERSCH')
    expect(await prisma.billingDocument.count()).toBe(0)
  })

  it('verweigert ihn ohne genehmigten Zettel und schreibt nichts (4.0, Regel 5)', async () => {
    await legeGenehmigtenZettelAn(welt, {
      nummer: 'SZ-OFFEN',
      einsatz,
      periode,
      von: PERIODE_VON,
      bis: PERIODE_BIS,
      positionen: [{ tag: tag('2026-10-05'), stunden: '10.0000' }],
      status: 'inApproval',
    })
    const ergebnis = await createBillingDocument(
      administrator,
      {
        billingPeriodId: periode,
        direction: 'sales',
        customerId: welt.kunde,
        supplierId: null,
        taxRate: 19,
      },
      HEUTE,
    )
    expect(ergebnis.ok).toBe(false)
    expect(await prisma.billingDocument.count()).toBe(0)
    // Der gesperrte Versuch verbraucht **keine** Belegnummer (3.9).
    const kreis = await prisma.billingNumberRange.findUnique({
      where: { documentType: 'customerInvoice' },
    })
    expect(kreis?.lastNumber ?? 0).toBe(0)
    // Und er steht im Protokoll (3.12).
    expect(
      await prisma.auditEntry.count({ where: { objectType: 'billingDocument', result: 'denied' } }),
    ).toBeGreaterThan(0)
  })

  it('verweigert ihn in einer geschlossenen Periode (4.5.1)', async () => {
    const geschlossen = await legeAbrechnungsperiodeAn(welt, {
      nummer: '2026-09',
      von: tag('2026-09-01'),
      bis: tag('2026-09-30'),
      status: 'closed',
    })
    await legeGenehmigtenZettelAn(welt, {
      nummer: 'SZ-SEP',
      einsatz,
      periode: geschlossen,
      von: tag('2026-09-01'),
      bis: tag('2026-09-30'),
      positionen: [{ tag: tag('2026-09-10'), stunden: '20.0000' }],
    })
    const ergebnis = await createBillingDocument(
      administrator,
      {
        billingPeriodId: geschlossen,
        direction: 'sales',
        customerId: welt.kunde,
        supplierId: null,
        taxRate: 19,
      },
      HEUTE,
    )
    expect(ergebnis.ok).toBe(false)
  })

  it('verweigert ihn ohne Steuersatz und nennt offene Frage 52', async () => {
    await zettel()
    const ergebnis = await createBillingDocument(
      administrator,
      {
        billingPeriodId: periode,
        direction: 'sales',
        customerId: welt.kunde,
        supplierId: null,
        taxRate: null,
      },
      HEUTE,
    )
    expect(ergebnis.ok).toBe(false)
    if (!ergebnis.ok) expect(ergebnis.error).toContain('Frage 52')
  })

  it('verweigert ihn dem Lieferanten — im Gutschriftverfahren legt er keinen Beleg an ([32])', async () => {
    await zettel()
    const ergebnis = await createBillingDocument(
      lieferantDisponent,
      {
        billingPeriodId: periode,
        direction: 'purchase',
        customerId: null,
        supplierId: welt.lieferant,
        taxRate: 19,
      },
      HEUTE,
    )
    expect(ergebnis.ok).toBe(false)
    expect(await prisma.billingDocument.count()).toBe(0)
  })

  it('verweigert ihn der Kundenseite — `KE` trägt nur `L[2] S[31]`', async () => {
    await zettel()
    const ergebnis = await createBillingDocument(
      einkauf,
      {
        billingPeriodId: periode,
        direction: 'sales',
        customerId: welt.kunde,
        supplierId: null,
        taxRate: 19,
      },
      HEUTE,
    )
    expect(ergebnis.ok).toBe(false)
  })

  it('vergibt lückenlose Nummern je Nummernkreis (3.9)', async () => {
    await zettel('SZ-1')
    await verkaufsbeleg()
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
    const nummern = (
      await prisma.billingDocument.findMany({ orderBy: { documentNumber: 'asc' } })
    ).map((beleg) => beleg.documentNumber)
    // Zwei Kreise, jeder bei eins beginnend (3.9: „Nummernkreise je Belegart").
    expect(nummern).toEqual(['GS-000001', 'RE-000001'])
  })
})

describe('Derselbe Zettel, zwei Seiten (3.9, 3.3)', () => {
  it('rechnet denselben Zettel auf beiden Seiten ab, dieselbe Seite aber nicht zweimal', async () => {
    await zettel()
    await verkaufsbeleg()
    // Dieselbe Seite: es bleibt kein Zettel übrig, und ohne Zettel entsteht
    // kein Beleg (3.9 verlangt mindestens einen).
    const zweiter = await createBillingDocument(
      administrator,
      {
        billingPeriodId: periode,
        direction: 'sales',
        customerId: welt.kunde,
        supplierId: null,
        taxRate: 19,
      },
      HEUTE,
    )
    expect(zweiter.ok).toBe(false)

    // Die andere Seite rechnet ihn sehr wohl noch ab.
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
    expect(await prisma.billingDocument.count()).toBe(2)
  })

  it('zählt in den Optionen, was noch abzurechnen ist', async () => {
    await zettel()
    const vorher = await loadBillingOptions(administrator)
    expect(vorher.billable).toHaveLength(2)
    expect(vorher.billable.every((zeile) => zeile.timesheetCount === 1)).toBe(true)

    await verkaufsbeleg()
    const nachher = await loadBillingOptions(administrator)
    expect(nachher.billable.map((zeile) => zeile.direction)).toEqual(['purchase'])
  })
})

describe('Prüfen, freigeben, bestätigen (4.5.2)', () => {
  it('führt den Beleg von `created` über `inReview` nach `released`', async () => {
    await zettel()
    const beleg = await verkaufsbeleg()
    ok(
      await transitionBillingDocument(
        disponent,
        { billingDocumentId: beleg, transition: 'review' },
        HEUTE,
      ),
    )
    ok(
      await transitionBillingDocument(
        disponent,
        { billingDocumentId: beleg, transition: 'release' },
        HEUTE,
      ),
    )
    const stand = await prisma.billingDocument.findUniqueOrThrow({ where: { id: beleg } })
    expect(stand.status).toBe('released')
    expect(stand.releasedById).toBe(welt.disponent)
  })

  it('verweigert die Freigabe durch den Ersteller — Vier-Augen-Prinzip ([30])', async () => {
    await zettel()
    const beleg = await verkaufsbeleg()
    ok(
      await transitionBillingDocument(
        disponent,
        { billingDocumentId: beleg, transition: 'review' },
        HEUTE,
      ),
    )
    const ergebnis = await transitionBillingDocument(
      administrator,
      { billingDocumentId: beleg, transition: 'release' },
      HEUTE,
    )
    expect(ergebnis.ok).toBe(false)
    expect((await prisma.billingDocument.findUniqueOrThrow({ where: { id: beleg } })).status).toBe(
      'inReview',
    )
  })

  it('verweigert die Prüfung, wenn die Zeiten sich nach der Erstellung geändert haben', async () => {
    // Der Abgleich aus 4.5.2 läuft gegen den **heutigen** Stand der Zettel.
    // Ein Beleg, der nur mit sich selbst stimmig ist, ist nicht abgeglichen.
    const zettelId = await zettel()
    const beleg = await verkaufsbeleg()
    await prisma.timeEntry.updateMany({
      where: { timesheetId: zettelId },
      data: { hours: '90.0000' },
    })
    const ergebnis = await transitionBillingDocument(
      disponent,
      { billingDocumentId: beleg, transition: 'review' },
      HEUTE,
    )
    expect(ergebnis.ok).toBe(false)
  })

  it('der Lieferant bestätigt die Gutschrift ([32]) — der Kunde kann das nicht', async () => {
    await zettel()
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
    const beleg = (await prisma.billingDocument.findFirstOrThrow()).id
    ok(
      await transitionBillingDocument(
        disponent,
        { billingDocumentId: beleg, transition: 'review' },
        HEUTE,
      ),
    )
    ok(
      await transitionBillingDocument(
        disponent,
        { billingDocumentId: beleg, transition: 'release' },
        HEUTE,
      ),
    )
    const durchDenKunden = await transitionBillingDocument(
      einkauf,
      { billingDocumentId: beleg, transition: 'confirm' },
      HEUTE,
    )
    expect(durchDenKunden.ok).toBe(false)

    ok(
      await transitionBillingDocument(
        lieferantDisponent,
        { billingDocumentId: beleg, transition: 'confirm' },
        HEUTE,
      ),
    )
    const stand = await prisma.billingDocument.findUniqueOrThrow({ where: { id: beleg } })
    expect(stand.status).toBe('confirmed')
    expect(stand.confirmedById).toBe(welt.lieferantDisponent)
  })

  it('verweigert die Bestätigung eines Verkaufsbelegs — die Verkaufsseite kennt sie nicht', async () => {
    await zettel()
    const beleg = await verkaufsbeleg()
    ok(
      await transitionBillingDocument(
        disponent,
        { billingDocumentId: beleg, transition: 'review' },
        HEUTE,
      ),
    )
    ok(
      await transitionBillingDocument(
        disponent,
        { billingDocumentId: beleg, transition: 'release' },
        HEUTE,
      ),
    )
    const ergebnis = await transitionBillingDocument(
      lieferantDisponent,
      { billingDocumentId: beleg, transition: 'confirm' },
      HEUTE,
    )
    expect(ergebnis.ok).toBe(false)
  })
})

describe('Beanstanden und klären (4.5.2)', () => {
  async function freigegeben(): Promise<string> {
    await zettel()
    const beleg = await verkaufsbeleg()
    ok(
      await transitionBillingDocument(
        disponent,
        { billingDocumentId: beleg, transition: 'review' },
        HEUTE,
      ),
    )
    ok(
      await transitionBillingDocument(
        disponent,
        { billingDocumentId: beleg, transition: 'release' },
        HEUTE,
      ),
    )
    return beleg
  }

  it('die Kundenseite beanstandet mit Grund ([31])', async () => {
    const beleg = await freigegeben()
    ok(
      await transitionBillingDocument(
        einkauf,
        {
          billingDocumentId: beleg,
          transition: 'disputeBySales',
          disputeReason: 'Die Stunden am 5.10. sind nicht erbracht.',
        },
        HEUTE,
      ),
    )
    const stand = await prisma.billingDocument.findUniqueOrThrow({ where: { id: beleg } })
    expect(stand.status).toBe('disputed')
    expect(stand.disputedById).toBe(welt.einkauf)
  })

  it('verweigert die Beanstandung ohne Grund (3.9)', async () => {
    const beleg = await freigegeben()
    const ergebnis = await transitionBillingDocument(
      einkauf,
      { billingDocumentId: beleg, transition: 'disputeBySales', disputeReason: null },
      HEUTE,
    )
    expect(ergebnis.ok).toBe(false)
  })

  it('verweigert sie nach Ablauf der Prüffrist — der Beleg bleibt freigegeben (2.4, Regel 1)', async () => {
    const beleg = await freigegeben()
    // 14 Kalendertage ab `released` (4.0); der 20.11. liegt danach.
    const ergebnis = await transitionBillingDocument(
      einkauf,
      { billingDocumentId: beleg, transition: 'disputeBySales', disputeReason: 'zu spät' },
      tag('2026-11-25'),
    )
    expect(ergebnis.ok).toBe(false)
    expect((await prisma.billingDocument.findUniqueOrThrow({ where: { id: beleg } })).status).toBe(
      'released',
    )
  })

  it('achtet die Prüffrist des Kunden aus `processDeadlineConfig` (3.1, 4.0)', async () => {
    await prisma.customer.update({
      where: { id: welt.kunde },
      data: { processDeadlineConfig: { billingReviewDeadlineDays: 30 } },
    })
    const beleg = await freigegeben()
    // Mit 30 Tagen ist der 25.11. noch in der Frist — mit der Vorbelegung
    // von 14 Tagen wäre er es nicht.
    ok(
      await transitionBillingDocument(
        einkauf,
        { billingDocumentId: beleg, transition: 'disputeBySales', disputeReason: 'noch in Frist' },
        tag('2026-11-25'),
      ),
    )
  })

  it('verweigert sie dem Lieferanten — er beanstandet keinen Verkaufsbeleg', async () => {
    const beleg = await freigegeben()
    const ergebnis = await transitionBillingDocument(
      lieferantDisponent,
      { billingDocumentId: beleg, transition: 'disputeByPurchase', disputeReason: 'Grund' },
      HEUTE,
    )
    expect(ergebnis.ok).toBe(false)
  })

  it('führt die Klärung zurück in die Prüfung und verlangt erneute Freigabe', async () => {
    const beleg = await freigegeben()
    ok(
      await transitionBillingDocument(
        einkauf,
        { billingDocumentId: beleg, transition: 'disputeBySales', disputeReason: 'Stunden' },
        HEUTE,
      ),
    )
    ok(
      await transitionBillingDocument(
        disponent,
        {
          billingDocumentId: beleg,
          transition: 'clarify',
          disputeResolutionNote: 'Stunden geprüft, Zettel unverändert.',
        },
        HEUTE,
      ),
    )
    const stand = await prisma.billingDocument.findUniqueOrThrow({ where: { id: beleg } })
    expect(stand.status).toBe('inReview')
    expect(stand.disputeResolutionNote).toContain('geprüft')
    // Erneut freigeben darf der Ersteller weiterhin nicht ([30]).
    const durchDenErsteller = await transitionBillingDocument(
      administrator,
      { billingDocumentId: beleg, transition: 'release' },
      HEUTE,
    )
    expect(durchDenErsteller.ok).toBe(false)
    ok(
      await transitionBillingDocument(
        disponent,
        { billingDocumentId: beleg, transition: 'release' },
        HEUTE,
      ),
    )
  })

  it('verweigert die Klärung ohne Dokumentation (4.5.2)', async () => {
    const beleg = await freigegeben()
    ok(
      await transitionBillingDocument(
        einkauf,
        { billingDocumentId: beleg, transition: 'disputeBySales', disputeReason: 'Stunden' },
        HEUTE,
      ),
    )
    const ergebnis = await transitionBillingDocument(
      disponent,
      { billingDocumentId: beleg, transition: 'clarify', disputeResolutionNote: null },
      HEUTE,
    )
    expect(ergebnis.ok).toBe(false)
  })
})

describe('Stornieren (4.5.2, 3.9)', () => {
  it('erzeugt einen Stornobeleg mit Gegenbuchung und lückenloser Nummer', async () => {
    await zettel()
    const beleg = await verkaufsbeleg()
    const meldung = ok(
      await cancelBillingDocument(
        administrator,
        { billingDocumentId: beleg, cancellationReason: 'Falscher Kunde.' },
        HEUTE,
      ),
    )
    expect(meldung).toContain('RE-000002')

    const original = await prisma.billingDocument.findUniqueOrThrow({ where: { id: beleg } })
    expect(original.status).toBe('cancelled')
    expect(original.cancellationReason).toBe('Falscher Kunde.')

    const storno = await prisma.billingDocument.findFirstOrThrow({
      where: { cancellationOfId: beleg },
      include: { items: true },
    })
    expect(storno.status).toBe('cancelled')
    expect(Number(storno.netAmount)).toBeCloseTo(-Number(original.netAmount), 4)
    expect(Number(storno.items[0]?.quantity)).toBeCloseTo(-100, 4)
    // Die Summe beider Belege ist null — das ist der Zweck des Stornos.
    expect(Number(original.netAmount) + Number(storno.netAmount)).toBeCloseTo(0, 4)
  })

  it('macht die Stundenzettel wieder abrechenbar', async () => {
    await zettel()
    const beleg = await verkaufsbeleg()
    ok(
      await cancelBillingDocument(
        administrator,
        { billingDocumentId: beleg, cancellationReason: 'Falscher Satz.' },
        HEUTE,
      ),
    )
    // Der Nachbeleg entsteht als **neuer** Beleg (3.9).
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
    const lebende = await prisma.billingDocument.count({
      where: { direction: 'sales', status: { not: 'cancelled' } },
    })
    expect(lebende).toBe(1)
  })

  it('verweigert den Storno ohne Begründung und ändert nichts', async () => {
    await zettel()
    const beleg = await verkaufsbeleg()
    const ergebnis = await cancelBillingDocument(
      administrator,
      { billingDocumentId: beleg, cancellationReason: null },
      HEUTE,
    )
    expect(ergebnis.ok).toBe(false)
    expect((await prisma.billingDocument.findUniqueOrThrow({ where: { id: beleg } })).status).toBe(
      'created',
    )
    expect(await prisma.billingDocument.count()).toBe(1)
  })

  it('verweigert ihn der Kundenseite — [31] gibt `KE` nur die Beanstandung', async () => {
    await zettel()
    const beleg = await verkaufsbeleg()
    const ergebnis = await cancelBillingDocument(
      einkauf,
      { billingDocumentId: beleg, cancellationReason: 'Grund' },
      HEUTE,
    )
    expect(ergebnis.ok).toBe(false)
  })
})

describe('Sichtbarkeit (2.2, 2.3)', () => {
  it('der Betreiber sieht beide Seiten', async () => {
    await zettel()
    await verkaufsbeleg()
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
    expect(await loadBillingDocuments(administrator, HEUTE)).toHaveLength(2)
  })

  it('der Kunde sieht nur seinen Verkaufsbeleg, nicht die Gutschrift', async () => {
    await zettel()
    await verkaufsbeleg()
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
    const sichtbar = await loadBillingDocuments(einkauf, HEUTE)
    expect(sichtbar).toHaveLength(1)
    expect(sichtbar[0]?.direction).toBe('sales')
    expect(sichtbar[0]?.crossTenant).toBe(true)
  })

  it('der Lieferant sieht nur seine Gutschrift', async () => {
    await zettel()
    await verkaufsbeleg()
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
    const sichtbar = await loadBillingDocuments(lieferantDisponent, HEUTE)
    expect(sichtbar).toHaveLength(1)
    expect(sichtbar[0]?.direction).toBe('purchase')
  })

  it('der Bedarfsträger sieht keinen Beleg — `KB` fehlt in der Zeile vollständig', async () => {
    await zettel()
    await verkaufsbeleg()
    expect(await loadBillingDocuments(bedarfstraeger, HEUTE)).toEqual([])
  })

  it('ein anderer Lieferant sieht die Gutschrift nicht (2.3)', async () => {
    await zettel()
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
    expect(await loadBillingDocuments(zweiterLieferantDisponent, HEUTE)).toEqual([])
  })
})

describe('Befunde aus Kapitel 5 am Beleg (4.7, Q38 bis Q40)', () => {
  it('trägt Q39 und Q40 auf der Verkaufsseite, Q38 nur auf der Einkaufsseite', async () => {
    await zettel()
    await verkaufsbeleg()
    const verkauf = (await loadBillingDocuments(administrator, HEUTE))[0]
    expect(verkauf?.findings.map((befund) => befund.row)).toEqual(['Q39', 'Q40'])

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
    const belege = await loadBillingDocuments(administrator, HEUTE)
    const einkaufBeleg = belege.find((beleg) => beleg.direction === 'purchase')
    expect(einkaufBeleg?.findings.map((befund) => befund.row)).toEqual(['Q38', 'Q39', 'Q40'])
  })

  it('trägt am Beleg **keine** Sperre — die Leistung ist erbracht (5.5.5)', async () => {
    await zettel()
    await verkaufsbeleg()
    const belege = await loadBillingDocuments(administrator, HEUTE)
    for (const befund of belege[0]?.findings ?? []) {
      expect(befund.effect).not.toBe('Sperre')
    }
  })

  it('warnt bei fehlendem Vergleichsentgelt nach der Fälligkeit, sperrt aber nicht (Q39)', async () => {
    await prisma.assignment.update({
      where: { id: einsatz },
      data: { equalPayDueDate: tag('2026-10-10'), comparableWage: null },
    })
    await zettel()
    // Die Erstellung gelingt — anders als am Zettel (Q36) ist P4 hier nur eine
    // Warnung.
    await verkaufsbeleg()
    const belege = await loadBillingDocuments(administrator, HEUTE)
    const q39 = belege[0]?.findings.find((befund) => befund.row === 'Q39')
    expect(q39?.satisfied).toBe(false)
    expect(q39?.effect).toBe('Warnung')
  })
})

describe('Abrechnungsperiode öffnen und schließen (4.5.1)', () => {
  it('öffnet eine Periode und protokolliert sie', async () => {
    ok(
      await openBillingPeriod(
        administrator,
        {
          periodNumber: '2026-12',
          customerId: null,
          periodFrom: tag('2026-12-01'),
          periodTo: tag('2026-12-31'),
          closingDate: tag('2027-01-10'),
        },
        HEUTE,
      ),
    )
    const neue = await prisma.billingPeriod.findFirstOrThrow({
      where: { periodNumber: '2026-12' },
    })
    expect(neue.status).toBe('open')
    expect(neue.openedById).toBe(welt.administrator)
    expect(
      await prisma.auditEntry.count({ where: { objectType: 'billingPeriod' } }),
    ).toBeGreaterThan(0)
  })

  it('öffnet sie auch durch den Disponenten — [33] nennt das Öffnen ausdrücklich', async () => {
    // Die Matrixzeile gibt `MD` **kein** `A`, aber ein `S[33]`. Wäre das
    // Öffnen eine Anlage, wäre es ihm verwehrt — 4.5.1 nennt ihn aber.
    ok(
      await openBillingPeriod(
        disponent,
        {
          periodNumber: '2026-12',
          customerId: null,
          periodFrom: tag('2026-12-01'),
          periodTo: tag('2026-12-31'),
          closingDate: tag('2027-01-10'),
        },
        HEUTE,
      ),
    )
  })

  it('verweigert sie dem Lieferanten — die Zeile gibt ihm nur `L[7]`', async () => {
    const ergebnis = await openBillingPeriod(
      lieferantDisponent,
      {
        periodNumber: '2026-12',
        customerId: null,
        periodFrom: tag('2026-12-01'),
        periodTo: tag('2026-12-31'),
        closingDate: tag('2027-01-10'),
      },
      HEUTE,
    )
    expect(ergebnis.ok).toBe(false)
    expect(await prisma.billingPeriod.count({ where: { periodNumber: '2026-12' } })).toBe(0)
  })

  it('verweigert ein Ende vor dem Beginn', async () => {
    const ergebnis = await openBillingPeriod(
      administrator,
      {
        periodNumber: '2026-13',
        customerId: null,
        periodFrom: tag('2026-12-31'),
        periodTo: tag('2026-12-01'),
        closingDate: tag('2027-01-10'),
      },
      HEUTE,
    )
    expect(ergebnis.ok).toBe(false)
  })

  it('verweigert eine überlappende offene Periode desselben Kunden (4.5.1)', async () => {
    const ergebnis = await openBillingPeriod(
      administrator,
      {
        periodNumber: '2026-10b',
        customerId: null,
        periodFrom: tag('2026-10-15'),
        periodTo: tag('2026-11-15'),
        closingDate: tag('2026-12-10'),
      },
      HEUTE,
    )
    expect(ergebnis.ok).toBe(false)
  })

  it('schließt eine Periode ohne offene Zettel und ohne offene Belege', async () => {
    ok(await closeBillingPeriod(administrator, { billingPeriodId: periode }, HEUTE))
    const stand = await prisma.billingPeriod.findUniqueOrThrow({ where: { id: periode } })
    expect(stand.status).toBe('closed')
    expect(stand.closedById).toBe(welt.administrator)
  })

  it('verweigert den Schluss bei einem hängenden Zettel — offene Frage 24', async () => {
    await legeGenehmigtenZettelAn(welt, {
      nummer: 'SZ-HAENGT',
      einsatz,
      periode,
      von: PERIODE_VON,
      bis: PERIODE_BIS,
      positionen: [{ tag: tag('2026-10-05'), stunden: '8.0000' }],
      status: 'inApproval',
    })
    const ergebnis = await closeBillingPeriod(administrator, { billingPeriodId: periode }, HEUTE)
    expect(ergebnis.ok).toBe(false)
    if (!ergebnis.ok) expect(ergebnis.error).toContain('offene Frage 24')
    expect((await prisma.billingPeriod.findUniqueOrThrow({ where: { id: periode } })).status).toBe(
      'open',
    )
  })

  it('verweigert ihn bei einem nicht abgegebenen Beleg (4.5.1)', async () => {
    await zettel()
    await verkaufsbeleg()
    const ergebnis = await closeBillingPeriod(administrator, { billingPeriodId: periode }, HEUTE)
    expect(ergebnis.ok).toBe(false)
  })

  it('lässt ihn zu, sobald der Beleg freigegeben ist', async () => {
    await zettel()
    const beleg = await verkaufsbeleg()
    ok(
      await transitionBillingDocument(
        disponent,
        { billingDocumentId: beleg, transition: 'review' },
        HEUTE,
      ),
    )
    ok(
      await transitionBillingDocument(
        disponent,
        { billingDocumentId: beleg, transition: 'release' },
        HEUTE,
      ),
    )
    ok(await closeBillingPeriod(administrator, { billingPeriodId: periode }, HEUTE))
  })

  it('lässt ihn auch bei einem **stornierten** Beleg zu (4.5.1)', async () => {
    await zettel()
    const beleg = await verkaufsbeleg()
    ok(
      await cancelBillingDocument(
        administrator,
        { billingDocumentId: beleg, cancellationReason: 'Grund' },
        HEUTE,
      ),
    )
    ok(await closeBillingPeriod(administrator, { billingPeriodId: periode }, HEUTE))
  })

  it('schließt eine geschlossene Periode nicht erneut — `closed` ist Endzustand', async () => {
    ok(await closeBillingPeriod(administrator, { billingPeriodId: periode }, HEUTE))
    const erneut = await closeBillingPeriod(administrator, { billingPeriodId: periode }, HEUTE)
    expect(erneut.ok).toBe(false)
  })

  it('nennt in der Übersicht, was dem Schluss entgegensteht', async () => {
    await zettel()
    await verkaufsbeleg()
    const perioden = await loadBillingPeriods(administrator)
    const stand = perioden.find((zeile) => zeile.id === periode)
    expect(stand?.mayClose).toBe(false)
    expect(stand?.unfinishedDocuments).toBe(1)
    expect(stand?.closeObstacle).not.toBeNull()
  })

  it('zeigt dem Lieferanten **keine** Periode — [7] trägt an dieser Zeile nicht (Frage 55)', async () => {
    // 2.2 gibt `LD` an der Zeile „Abrechnungsperiode (3.9)" ein `L[7]`, und
    // [7] lautet „nur die eigene Lieferantenorganisation". Die Periode gehört
    // aber dem Betreiber und **nennt keinen Lieferanten**: mehrere liefern in
    // dieselbe Periode. Damit ist [7] an dieser Zeile nicht erfüllbar, und die
    // Prüffunktion verweigert — obwohl der Schlusstermin der Periode nach 2.4
    // gerade die Frist des Lieferanten ist. Der Widerspruch steht als
    // *offene Frage 55* in Kapitel 7 und wird hier nicht stillschweigend
    // aufgelöst.
    expect(await loadBillingPeriods(lieferantDisponent)).toEqual([])
  })

  it('zeigt dem Einkauf des Kunden seine kundenbezogene Periode ([2])', async () => {
    // Die Kundenseite trägt `L[2]`, und [2] ist erfüllbar: eine Periode kann
    // einen Kunden nennen (3.9). Eine betreiberweite Periode sieht sie nicht —
    // sie gehört keinem Kunden.
    expect(await loadBillingPeriods(einkauf)).toEqual([])
    const eigene = await legeAbrechnungsperiodeAn(welt, {
      nummer: '2026-11',
      von: tag('2026-11-01'),
      bis: tag('2026-11-30'),
      kunde: welt.kunde,
    })
    const sichtbar = await loadBillingPeriods(einkauf)
    expect(sichtbar.map((zeile) => zeile.id)).toEqual([eigene])
  })
})

describe('Protokoll (3.12)', () => {
  it('trägt jeden Schreibweg mit Statuswechsel ein', async () => {
    await zettel()
    const beleg = await verkaufsbeleg()
    ok(
      await transitionBillingDocument(
        disponent,
        { billingDocumentId: beleg, transition: 'review' },
        HEUTE,
      ),
    )
    ok(
      await transitionBillingDocument(
        disponent,
        { billingDocumentId: beleg, transition: 'release' },
        HEUTE,
      ),
    )
    const eintraege = await prisma.auditEntry.findMany({
      where: { objectType: 'billingDocument' },
      orderBy: { entryNumber: 'asc' },
    })
    expect(eintraege.map((eintrag) => eintrag.statusTo)).toEqual([
      'created',
      'inReview',
      'released',
    ])
    expect(eintraege.every((eintrag) => eintrag.result === 'success')).toBe(true)
    expect(eintraege.every((eintrag) => eintrag.actorUserId !== null)).toBe(true)
  })

  it('trägt den Storno und den **neuen** Stornobeleg ein', async () => {
    await zettel()
    const beleg = await verkaufsbeleg()
    ok(
      await cancelBillingDocument(
        administrator,
        { billingDocumentId: beleg, cancellationReason: 'Grund' },
        HEUTE,
      ),
    )
    const eintraege = await prisma.auditEntry.findMany({
      where: { objectType: 'billingDocument' },
      orderBy: { entryNumber: 'asc' },
    })
    // Anlage, Storno des alten, Anlage des Stornobelegs.
    expect(eintraege).toHaveLength(3)
    expect(eintraege[1]?.statusTo).toBe('cancelled')
    expect(eintraege[2]?.operation).toBe('create')
  })

  it('trägt einen abgelehnten Zugriff ein, ohne etwas zu schreiben (3.12)', async () => {
    await zettel()
    const ergebnis = await createBillingDocument(
      einkauf,
      {
        billingPeriodId: periode,
        direction: 'sales',
        customerId: welt.kunde,
        supplierId: null,
        taxRate: 19,
      },
      HEUTE,
    )
    expect(ergebnis.ok).toBe(false)
    expect(await prisma.billingDocument.count()).toBe(0)
    const eintrag = await prisma.auditEntry.findFirstOrThrow({
      where: { objectType: 'billingDocument' },
    })
    expect(eintrag.result).toBe('denied')
  })
})
