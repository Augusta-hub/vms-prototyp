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
  ladeLaufstand,
  loadNightlyRuns,
  loadNotifications,
  mayRunNightly,
  runNightly,
  runNightlyScheduled,
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

describe('Zustellung aus dem Lauf (3.14)', () => {
  // Ohne Mailweg geht nichts hinaus; die `.env` des Entwicklers darf das
  // Ergebnis nicht verschieben.
  beforeEach(async () => {
    delete process.env.MAIL_FROM
    delete process.env.MAIL_RELAY_URL
    delete process.env.MAIL_OUTBOX_DIR
    await prisma.assignment.update({
      where: { id: einsatz },
      data: { maxDurationEndDate: tag('2026-12-01') },
    })
  })

  it('legt zu jeder Nachricht des Laufs Zustellaufträge an', async () => {
    ok(await runNightly(administrator, HEUTE))
    const nachrichten = await prisma.notification.count()
    expect(nachrichten).toBeGreaterThan(0)
    const auftraege = await prisma.notificationDelivery.count()
    expect(auftraege).toBeGreaterThan(0)
    expect(await prisma.notificationDelivery.count({ where: { status: 'pending' } })).toBe(
      auftraege,
    )
  })

  it('meldet, dass nichts versandt wurde — „nichts zugestellt" sieht nicht wie „alles zugestellt" aus', async () => {
    const meldung = ok(await runNightly(administrator, HEUTE))
    expect(meldung).toContain('Zustellung: nichts versandt')
    expect(meldung).toContain('MAIL_FROM')
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

/* ------------------------------------------------------------------ */
/* 5.5.1 Zeitplan des Laufs                                            */
/* ------------------------------------------------------------------ */

describe('Zeitplan des Laufs (5.5.1)', () => {
  it('nimmt den Kalendertag der Betreiberzeitzone als Stichtag, nicht den nach Weltzeit', async () => {
    // 23:30 Weltzeit ist in Europe/Berlin schon der 13.; der Lauf gehört
    // deshalb zum Stichtag 2026-11-13.
    ok(await runNightly(administrator, new Date('2026-11-12T23:30:00.000Z')))
    const laeufe = await prisma.nightlyRuleRun.findMany()
    expect(laeufe).toHaveLength(1)
    expect(laeufe[0]?.runDate.toISOString().slice(0, 10)).toBe('2026-11-13')
  })

  it('läuft über den Planer, wenn der Stichtag aussteht — ohne Benutzer', async () => {
    const ergebnis = await runNightlyScheduled(new Date('2026-11-12T08:00:00.000Z'))
    expect(ergebnis.ok).toBe(true)
    const lauf = await prisma.nightlyRuleRun.findFirstOrThrow()
    expect(lauf.runDate.toISOString().slice(0, 10)).toBe('2026-11-12')
    // 4.0 Regel 10: den Lauf löst keine fachliche Entscheidung aus. Ein
    // erfundener Benutzer würde eine vortäuschen, die niemand getroffen hat.
    expect(lauf.startedById).toBe(null)
  })

  it('läuft über den Planer nicht zweimal zum selben Stichtag', async () => {
    ok(await runNightlyScheduled(new Date('2026-11-12T08:00:00.000Z')))
    const zweiter = await runNightlyScheduled(new Date('2026-11-12T09:00:00.000Z'))
    expect(ok(zweiter)).toContain('Kein Lauf fällig')
    expect(await prisma.nightlyRuleRun.count()).toBe(1)
  })

  it('läuft über den Planer vor der Fälligkeitszeit gar nicht', async () => {
    // 01:00 Weltzeit = 02:00 Berliner Zeit, also vor 03:00. Der Lauf wird
    // **nicht** zum Lauf von gestern: „Stichtag ist der Tag des Laufs" (5.5.1).
    const ergebnis = await runNightlyScheduled(new Date('2026-11-12T01:00:00.000Z'))
    expect(ok(ergebnis)).toContain('wird erst am')
    expect(await prisma.nightlyRuleRun.count()).toBe(0)
  })

  it('weist ausgefallene Tage aus, statt sie nachzuholen', async () => {
    ok(await runNightly(administrator, tag('2026-11-09')))
    const stand = await ladeLaufstand(new Date('2026-11-12T08:00:00.000Z'))
    expect(stand.stichtag.toISOString().slice(0, 10)).toBe('2026-11-12')
    expect(stand.offen).toBe(true)
    expect(stand.ausgefallen.map((wert) => wert.toISOString().slice(0, 10))).toEqual([
      '2026-11-10',
      '2026-11-11',
    ])

    // Der Lauf von heute erzeugt **einen** Lauf — nicht drei.
    ok(await runNightlyScheduled(new Date('2026-11-12T08:00:00.000Z')))
    const laeufe = await prisma.nightlyRuleRun.findMany({ orderBy: { runDate: 'asc' } })
    expect(laeufe.map((zeile) => zeile.runDate.toISOString().slice(0, 10))).toEqual([
      '2026-11-09',
      '2026-11-12',
    ])
    // Die Lücke bleibt sichtbar: sie ist der Unterschied zwischen „nichts
    // gemeldet" und „nicht gelaufen".
    const danach = await ladeLaufstand(new Date('2026-11-12T09:00:00.000Z'))
    expect(danach.offen).toBe(false)
    expect(danach.ausgefalleneTage).toBe(0)
  })

  it('nennt ohne verzeichneten Lauf keine Lücke', async () => {
    const stand = await ladeLaufstand(new Date('2026-11-12T08:00:00.000Z'))
    expect(stand.ausgefalleneTage).toBe(0)
    expect(stand.offen).toBe(true)
  })
})

describe('Der ausgebliebene Lauf wird gemeldet (5.5.1)', () => {
  /** Ein verzeichneter Lauf ohne Befunde — nur, damit es einen gibt. */
  async function laufAm(stichtag: string): Promise<void> {
    await prisma.nightlyRuleRun.create({
      data: {
        runDate: tag(stichtag),
        startedAt: new Date(`${stichtag}T02:00:00.000Z`),
        checked: 0,
        informations: 0,
        warnings: 0,
        escalations: 0,
        notifications: 0,
      },
    })
  }

  async function ausfallmeldungen() {
    return prisma.notification.findMany({
      where: { trigger: 'nightlyRunMissed' },
      orderBy: { recipientRoleCode: 'asc' },
    })
  }

  it('meldet nichts, wenn kein Tag ausgefallen ist', async () => {
    await laufAm('2026-11-11')
    ok(await runNightlyScheduled(new Date('2026-11-12T08:00:00.000Z')))
    expect(await ausfallmeldungen()).toHaveLength(0)
  })

  it('meldet eine ausgefallene Nacht als Information an MD', async () => {
    await laufAm('2026-11-10')
    ok(await runNightlyScheduled(new Date('2026-11-12T08:00:00.000Z')))
    const gemeldet = await ausfallmeldungen()
    expect(gemeldet).toHaveLength(1)
    expect(gemeldet[0]?.kind).toBe('information')
    expect(gemeldet[0]?.recipientRoleCode).toBe('operatorCoordinator')
    expect(gemeldet[0]?.recipientTenantId).toBe(welt.betreiberMandant)
    expect(gemeldet[0]?.objectType).toBe('nightlyRuleRun')
    // Die Nachricht gehört dem Lauf, nicht einem Übergang: sie trägt einen
    // Lauftag und keinen Statuswechsel (3.14).
    expect(gemeldet[0]?.runDate?.toISOString().slice(0, 10)).toBe('2026-11-12')
    expect(gemeldet[0]?.statusTo).toBe(null)
    expect(gemeldet[0]?.message).toContain('2026-11-11')
  })

  it('meldet drei ausgefallene Nächte als Warnung mit Eskalation an MA', async () => {
    await laufAm('2026-11-08')
    ok(await runNightlyScheduled(new Date('2026-11-12T08:00:00.000Z')))
    const gemeldet = await ausfallmeldungen()
    expect(gemeldet.map((zeile) => zeile.recipientRoleCode)).toEqual([
      'operatorAdmin',
      'operatorCoordinator',
    ])
    expect(gemeldet.every((zeile) => zeile.kind === 'warning')).toBe(true)
    // 2.4, Regel 2: die Stufe ist die Stellung in der kumulativen Liste.
    const eskalation = gemeldet.find((zeile) => zeile.recipientRoleCode === 'operatorAdmin')
    expect(eskalation?.escalationLevel).toBe(2)
  })

  it('meldet die Lücke auch beim Lauf von Hand', async () => {
    await laufAm('2026-11-08')
    ok(await runNightly(administrator, new Date('2026-11-12T08:00:00.000Z')))
    expect((await ausfallmeldungen()).length).toBeGreaterThan(0)
  })

  it('verdoppelt die Meldung nicht, wenn derselbe Tag zweimal läuft', async () => {
    await laufAm('2026-11-10')
    ok(await runNightly(administrator, new Date('2026-11-12T08:00:00.000Z')))
    ok(await runNightly(administrator, new Date('2026-11-12T09:00:00.000Z')))
    expect(await ausfallmeldungen()).toHaveLength(1)
  })

  it('protokolliert die Feststellung als Systemlauf (3.12, 5.5.2 Nr. 1)', async () => {
    await laufAm('2026-11-10')
    ok(await runNightlyScheduled(new Date('2026-11-12T08:00:00.000Z')))
    const eintrag = await prisma.auditEntry.findFirst({
      where: { objectType: 'notification', objectRef: '2026-11-12' },
    })
    expect(eintrag).not.toBe(null)
    // 3.12: genau eines von beiden ist gesetzt. Beim Lauf ist es das
    // Systemkennzeichen (4.0, Regel 10).
    expect(eintrag?.actorUserId).toBe(null)
    expect(eintrag?.systemActor).not.toBe(null)
  })
})
