/**
 * Der nächtliche Lauf gegen eine echte Datenbank — SPEC **5.5.1 c** und
 * **3.14**.
 *
 * Was hier geprüft wird und **nirgends sonst**:
 *
 *  - dass der Lauf **wiederholbar** ist: zweimal am selben Tag erzeugt nichts
 *    doppelt (3.14, Eindeutigkeit),
 *  - dass er **nichts ändert**: kein Status wechselt, kein Feld wird
 *    fortgeschrieben (4.0, Regeln 4 und 10),
 *  - dass die Benachrichtigung die **Rolle in ihrer Organisation** erreicht —
 *    `LD` den Lieferanten, `KE` den Kunden —, und [47] jede andere Sicht
 *    verweigert,
 *  - dass die Einträge des Laufs ein **Systemkennzeichen** tragen (3.12),
 *  - dass nur der Betreiberadministrator ihn anstoßen darf (2.3).
 *
 * Die Rechenwege selbst sind in `lib/nightly/befunde.test.ts` ohne Datenbank
 * geprüft. Alle Daten sind synthetisch (CLAUDE.md, Regel 3).
 */

import { beforeEach, describe, expect, it } from 'vitest'
import { loadIdentity, type LoadedIdentity } from '../../lib/identity/loadSubject'
import { prisma } from '../../lib/prisma'
import {
  loadNightlyRuns,
  loadNotifications,
  mayRunNightly,
  runNightly,
} from '../../lib/services/nightly'
import {
  baueWelt,
  legeAbrechnungsperiodeAn,
  legeEinsatzAn,
  legeGenehmigtenZettelAn,
  leereDatenbank,
  tag,
  type Welt,
} from './fixture'

const HEUTE = tag('2026-11-12')

let welt: Welt
let administrator: LoadedIdentity
let disponent: LoadedIdentity
let einkauf: LoadedIdentity
let lieferantDisponent: LoadedIdentity
let lieferantAdmin: LoadedIdentity
let einsatz: string

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
  einkauf = await identitaet(welt.einkauf)
  lieferantDisponent = await identitaet(welt.lieferantDisponent)
  lieferantAdmin = await identitaet(welt.lieferantAdmin)
  einsatz = await legeEinsatzAn(welt, {
    nummer: 'E-2026-0001',
    status: 'active',
    plannedStartDate: tag('2026-01-01'),
    actualStartDate: tag('2026-01-01'),
    vergleichsentgelt: '18.5000',
  })
})

describe('Wer den Lauf anstoßen darf (2.3, 3.14)', () => {
  it('der Betreiberadministrator darf', async () => {
    expect(await mayRunNightly(administrator)).toBe(true)
    ok(await runNightly(administrator, HEUTE))
  })

  it('der Disponent nicht — [47] gibt ihm nur die eigenen Nachrichten', async () => {
    // Wer nur die eigenen Nachrichten sieht, kann keinen Lauf verantworten,
    // der fremde erzeugt.
    expect(await mayRunNightly(disponent)).toBe(false)
    const ergebnis = await runNightly(disponent, HEUTE)
    expect(ergebnis.ok).toBe(false)
    expect(await prisma.nightlyRuleRun.count()).toBe(0)
  })

  it('der Lieferant nicht', async () => {
    const ergebnis = await runNightly(lieferantAdmin, HEUTE)
    expect(ergebnis.ok).toBe(false)
    expect(await prisma.notification.count()).toBe(0)
  })
})

describe('N2 — Höchstüberlassungsdauer (5.1.6)', () => {
  beforeEach(async () => {
    await prisma.assignment.update({
      where: { id: einsatz },
      data: { maxDurationEndDate: tag('2026-12-01') },
    })
  })

  it('erzeugt eine Warnung an `MD`, `MA` und `KB` — jede in ihrer Organisation', async () => {
    ok(await runNightly(administrator, HEUTE))
    const nachrichten = await prisma.notification.findMany({
      where: { trigger: 'maxDurationThreshold' },
      orderBy: { escalationLevel: 'asc' },
    })
    expect(nachrichten.map((n) => n.recipientRoleCode)).toEqual([
      'operatorCoordinator',
      'operatorAdmin',
      'demandOwner',
    ])
    expect(nachrichten.map((n) => n.escalationLevel)).toEqual([1, 2, 3])
    expect(nachrichten[0]?.recipientTenantId).toBe(welt.betreiberMandant)
    // `KB` ist eine Kundenrolle: die Nachricht geht in den Kundenmandanten.
    expect(nachrichten[2]?.recipientTenantId).toBe(welt.kundenMandant)
    expect(nachrichten.every((n) => n.kind === 'warning')).toBe(true)
    expect(nachrichten.every((n) => n.ruleRef === 'P1')).toBe(true)
  })

  it('ändert den Einsatz nicht (4.0, Regeln 4 und 10)', async () => {
    const vorher = await prisma.assignment.findUniqueOrThrow({ where: { id: einsatz } })
    ok(await runNightly(administrator, HEUTE))
    const nachher = await prisma.assignment.findUniqueOrThrow({ where: { id: einsatz } })
    expect(nachher.status).toBe(vorher.status)
    expect(nachher.maxDurationEndDate).toEqual(vorher.maxDurationEndDate)
    expect(nachher.updatedAt).toEqual(vorher.updatedAt)
  })

  it('erzeugt beim zweiten Lauf am selben Tag nichts doppelt (3.14)', async () => {
    ok(await runNightly(administrator, HEUTE))
    const nachErstem = await prisma.notification.count()
    const meldung = ok(await runNightly(administrator, HEUTE))
    expect(await prisma.notification.count()).toBe(nachErstem)
    expect(meldung).toContain('0 Benachrichtigung(en)')
    // Und **ein** Lauf je Tag, nicht zwei.
    expect(await prisma.nightlyRuleRun.count()).toBe(1)
  })

  it('erzeugt am nächsten Tag erneut — die Lage besteht fort', async () => {
    ok(await runNightly(administrator, HEUTE))
    const nachErstem = await prisma.notification.count()
    ok(await runNightly(administrator, tag('2026-11-13')))
    expect(await prisma.notification.count()).toBeGreaterThan(nachErstem)
    expect(await prisma.nightlyRuleRun.count()).toBe(2)
  })
})

describe('N3 — Equal-Pay-Fälligkeit (5.0)', () => {
  it('meldet nur, wenn das Vergleichsentgelt fehlt', async () => {
    await prisma.assignment.update({
      where: { id: einsatz },
      data: { equalPayDueDate: tag('2026-11-25') },
    })
    ok(await runNightly(administrator, HEUTE))
    expect(await prisma.notification.count({ where: { trigger: 'equalPayThreshold' } })).toBe(0)

    await prisma.assignment.update({
      where: { id: einsatz },
      data: { comparableWage: null },
    })
    ok(await runNightly(administrator, tag('2026-11-13')))
    const nachrichten = await prisma.notification.findMany({
      where: { trigger: 'equalPayThreshold' },
    })
    expect(nachrichten.length).toBeGreaterThan(0)
    // 5.0: die Warnung geht an `MD`, `MA` und `KE` — der Entleiher pflegt den
    // Eintrag (5.2.4).
    expect(nachrichten.map((n) => n.recipientRoleCode).sort()).toEqual([
      'operatorAdmin',
      'operatorCoordinator',
      'procurementController',
    ])
  })
})

describe('Prozessfristen aus 2.4', () => {
  it('meldet einen nicht eingereichten Stundenzettel an `LD`', async () => {
    const periode = await legeAbrechnungsperiodeAn(welt, {
      nummer: '2026-10',
      von: tag('2026-10-01'),
      bis: tag('2026-10-31'),
      schlusstermin: tag('2026-11-10'),
    })
    await legeGenehmigtenZettelAn(welt, {
      nummer: 'SZ-1',
      einsatz,
      periode,
      von: tag('2026-10-01'),
      bis: tag('2026-10-31'),
      positionen: [{ tag: tag('2026-10-05'), stunden: '8.0000' }],
      status: 'recorded',
    })
    ok(await runNightly(administrator, HEUTE))
    const nachricht = await prisma.notification.findFirstOrThrow({
      where: { trigger: 'timesheetNotSubmitted' },
    })
    expect(nachricht.recipientRoleCode).toBe('supplierCoordinator')
    expect(nachricht.recipientTenantId).toBe(welt.lieferantMandant)
    // Eine Prozessfrist trägt keine Prüfung aus Kapitel 5.
    expect(nachricht.ruleRef).toBeNull()
  })

  it('meldet einen nicht genehmigten Zettel an die Rolle der offenen Stufe', async () => {
    const periode = await legeAbrechnungsperiodeAn(welt, {
      nummer: '2026-10',
      von: tag('2026-10-01'),
      bis: tag('2026-10-31'),
      schlusstermin: tag('2026-11-10'),
    })
    await legeGenehmigtenZettelAn(welt, {
      nummer: 'SZ-2',
      einsatz,
      periode,
      von: tag('2026-10-01'),
      bis: tag('2026-10-31'),
      positionen: [{ tag: tag('2026-10-05'), stunden: '8.0000' }],
      status: 'inApproval',
    })
    ok(await runNightly(administrator, HEUTE))
    const nachricht = await prisma.notification.findFirstOrThrow({
      where: { trigger: 'timesheetNotApproved' },
    })
    // Die Vorbelegung aus 4.4: zuerst die Kundenseite (`KB`).
    expect(nachricht.recipientRoleCode).toBe('demandOwner')
    expect(nachricht.recipientTenantId).toBe(welt.kundenMandant)
    expect(nachricht.message).toContain('Genehmigungsfiktion')
  })

  it('genehmigt den Zettel **nicht** — Fristablauf wechselt keinen Status (2.4, Regel 1)', async () => {
    const periode = await legeAbrechnungsperiodeAn(welt, {
      nummer: '2026-10',
      von: tag('2026-10-01'),
      bis: tag('2026-10-31'),
      schlusstermin: tag('2026-11-10'),
    })
    const zettel = await legeGenehmigtenZettelAn(welt, {
      nummer: 'SZ-3',
      einsatz,
      periode,
      von: tag('2026-10-01'),
      bis: tag('2026-10-31'),
      positionen: [{ tag: tag('2026-10-05'), stunden: '8.0000' }],
      status: 'inApproval',
    })
    ok(await runNightly(administrator, HEUTE))
    expect((await prisma.timesheet.findUniqueOrThrow({ where: { id: zettel } })).status).toBe(
      'inApproval',
    )
  })
})

describe('Sichtbarkeit der Nachrichten (3.14, Fußnote [47])', () => {
  beforeEach(async () => {
    await prisma.assignment.update({
      where: { id: einsatz },
      data: { maxDurationEndDate: tag('2026-12-01') },
    })
    ok(await runNightly(administrator, HEUTE))
  })

  it('der Betreiberadministrator sieht alle — seine Zelle trägt keine Fußnote', async () => {
    const sichtbar = await loadNotifications(administrator)
    expect(sichtbar.length).toBe(await prisma.notification.count())
  })

  it('der Disponent sieht nur die an `MD` gerichteten', async () => {
    const sichtbar = await loadNotifications(disponent)
    expect(sichtbar.length).toBeGreaterThan(0)
    expect(sichtbar.every((n) => n.recipientRoleCode === 'operatorCoordinator')).toBe(true)
  })

  it('der Einkauf des Kunden sieht die an `MD` gerichteten nicht', async () => {
    const sichtbar = await loadNotifications(einkauf)
    expect(sichtbar.every((n) => n.recipientRoleCode === 'procurementController')).toBe(true)
  })

  it('der Lieferant sieht keine Nachricht über die Frist eines Einsatzes an `MD`', async () => {
    const sichtbar = await loadNotifications(lieferantDisponent)
    expect(sichtbar.every((n) => n.recipientRoleCode === 'supplierCoordinator')).toBe(true)
  })

  it('zeigt einem **anderen** Lieferanten die Nachricht an `LD` nicht ([47], 2.3)', async () => {
    // Die Rolle allein genügt nicht: `LD` gibt es bei jedem Lieferanten.
    // [47] prüft Rolle **und** Mandant — sonst läse der zweite Lieferant die
    // Fristen des ersten, und das ist genau die Trennung, die 2.3 Regel 4
    // verlangt.
    const periode = await legeAbrechnungsperiodeAn(welt, {
      nummer: '2026-10',
      von: tag('2026-10-01'),
      bis: tag('2026-10-31'),
      schlusstermin: tag('2026-11-10'),
    })
    await legeGenehmigtenZettelAn(welt, {
      nummer: 'SZ-LD',
      einsatz,
      periode,
      von: tag('2026-10-01'),
      bis: tag('2026-10-31'),
      positionen: [{ tag: tag('2026-10-05'), stunden: '8.0000' }],
      status: 'recorded',
    })
    ok(await runNightly(administrator, tag('2026-11-13')))

    const eigene = await loadNotifications(lieferantDisponent)
    expect(eigene.some((n) => n.trigger === 'timesheetNotSubmitted')).toBe(true)

    const fremder = await identitaet(welt.zweiterLieferantDisponent)
    expect(await loadNotifications(fremder)).toEqual([])
  })

  it('zeigt die Läufe nur dem, der sie anstoßen darf', async () => {
    expect((await loadNightlyRuns(administrator)).length).toBe(1)
    expect(await loadNightlyRuns(disponent)).toEqual([])
    expect(await loadNightlyRuns(lieferantDisponent)).toEqual([])
  })
})

describe('Protokoll des Laufs (3.12, 5.5.2 Nr. 1)', () => {
  it('trägt jeden Befund mit Systemkennzeichen und Regelbezug ein', async () => {
    await prisma.assignment.update({
      where: { id: einsatz },
      data: { maxDurationEndDate: tag('2026-12-01') },
    })
    ok(await runNightly(administrator, HEUTE))
    const eintraege = await prisma.auditEntry.findMany({
      where: { objectType: 'notification' },
    })
    expect(eintraege.length).toBeGreaterThan(0)
    // Den Lauf löst kein Benutzer aus, auch wenn ein Mensch ihn anstößt
    // (4.0, Regel 10).
    expect(eintraege.every((eintrag) => eintrag.systemActor === 'systemlauf')).toBe(true)
    expect(eintraege.every((eintrag) => eintrag.actorUserId === null)).toBe(true)
    expect(eintraege.some((eintrag) => eintrag.ruleRef === 'P1')).toBe(true)
  })

  it('hält den Lauf fest, auch wenn er nichts findet (5.5.1)', async () => {
    // Ohne diese Zeile wäre „nichts gemeldet" nicht von „nicht gelaufen" zu
    // unterscheiden — bei einem Verfahren, das Fristen überwacht, ist das der
    // wichtigere der beiden Fälle.
    const meldung = ok(await runNightly(administrator, HEUTE))
    expect(meldung).toContain('0 Befund')
    const lauf = await prisma.nightlyRuleRun.findFirstOrThrow()
    expect(lauf.notifications).toBe(0)
    expect(lauf.checked).toBeGreaterThan(0)
  })
})
