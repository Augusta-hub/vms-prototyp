/**
 * Zustellung und Lesevermerk gegen eine echte Datenbank — SPEC **3.14**,
 * entschieden mit *Frage 56*.
 *
 * Was hier geprüft wird und **nirgends sonst**:
 *
 *  - dass mit jeder Nachricht **je Empfänger** ein Zustellauftrag entsteht —
 *    und dass eine Rolle, die niemand trägt, keinen bekommt,
 *  - dass die **Vertretung** einen eigenen Auftrag erhält (2.4, Regel 2): wäre
 *    der Rolleninhaber abwesend und sie nicht adressiert, erreichte die
 *    Nachricht niemanden, der handeln kann,
 *  - dass **ohne Mailweg nichts angefasst** wird: kein Versuch, kein Zustand,
 *    keine Zusage über eine E-Mail, die niemand gesendet hat,
 *  - dass **zweimal abarbeiten nichts doppelt sendet**,
 *  - dass die **zweite Prüfung** greift: wer die Rollenzuweisung zwischen
 *    Anlegen und Versand verliert, erhält nichts mehr — der Auftrag ist
 *    *unterblieben*, nicht *gescheitert* (2.3),
 *  - dass ein Fehler **gezählt** wird und erst nach den Versuchen des
 *    Regelwerks endgültig ist,
 *  - dass der **Lesevermerk** je Person entsteht, die Nachricht nicht ändert
 *    und nur für sich selbst gesetzt werden kann ([47]).
 *
 * Brief und Mailweg sind ohne Datenbank geprüft (`lib/notifications/`). Alle
 * Daten sind synthetisch (CLAUDE.md, Regel 3).
 */

import { beforeEach, describe, expect, it } from 'vitest'
import { REGELWERK } from '../../lib/aueg/regelwerk'
import { loadIdentity, type LoadedIdentity } from '../../lib/identity/loadSubject'
import type { Brief } from '../../lib/notifications/brief'
import type { Mailversand } from '../../lib/notifications/versand'
import { prisma } from '../../lib/prisma'
import { loadNotifications } from '../../lib/services/nightly'
import { transitionSupplier } from '../../lib/services/supplierStatus'
import {
  alsGelesenMarkieren,
  darfPostausgangAbarbeiten,
  empfaenger,
  ladeEigenenStand,
  ladeUngelesen,
  postausgangAbarbeiten,
} from '../../lib/services/zustellung'
import { baueWelt, leereDatenbank, tag, type Welt } from './fixture'

const HEUTE = tag('2026-11-05')

let welt: Welt
let administrator: LoadedIdentity
let lieferantAdmin: LoadedIdentity
let lieferantDisponent: LoadedIdentity
let zweiterLieferantDisponent: LoadedIdentity

async function identitaet(userId: string): Promise<LoadedIdentity> {
  const geladen = await loadIdentity(userId)
  if (geladen === null) throw new Error('Die Testidentität ließ sich nicht laden.')
  return geladen
}

function ok(ergebnis: { ok: boolean; message?: string; error?: string; specReference?: string }) {
  if (!ergebnis.ok) throw new Error(`${ergebnis.error} (${ergebnis.specReference ?? '-'})`)
  return ergebnis.message ?? ''
}

/** Ein Mailweg, der mitschreibt statt zu senden. */
function mitschrift(): { versand: Mailversand; briefe: Brief[] } {
  const briefe: Brief[] = []
  return {
    briefe,
    versand: {
      absender: 'vms@test.invalid',
      beschreibung: 'Mitschrift (Test)',
      sende: async (brief) => {
        briefe.push(brief)
      },
    },
  }
}

/** Ein Mailweg, der immer scheitert — für die Zählung der Versuche. */
function scheitert(meldung = 'Relay antwortet 500'): Mailversand {
  return {
    absender: 'vms@test.invalid',
    beschreibung: 'Fehlweg (Test)',
    sende: async () => {
      throw new Error(meldung)
    },
  }
}

/** Die Sperre des Lieferanten erzeugt zwei Nachrichten: an `LA` und an `MA` (4.6). */
async function sperreLieferant(): Promise<void> {
  ok(
    await transitionSupplier(
      administrator,
      {
        supplierId: welt.lieferant,
        transition: 'block',
        blockReason: 'Nachweis der Berufsgenossenschaft fehlt (synthetisch).',
        unblockReason: null,
        reactivationReason: null,
        validTo: null,
      },
      HEUTE,
    ),
  )
}

async function auftraege() {
  return prisma.notificationDelivery.findMany({
    include: { notification: { select: { recipientRoleCode: true } } },
    orderBy: { createdAt: 'asc' },
  })
}

beforeEach(async () => {
  await leereDatenbank()
  welt = await baueWelt()
  administrator = await identitaet(welt.administrator)
  lieferantAdmin = await identitaet(welt.lieferantAdmin)
  lieferantDisponent = await identitaet(welt.lieferantDisponent)
  zweiterLieferantDisponent = await identitaet(welt.zweiterLieferantDisponent)
})

describe('Zustellaufträge entstehen mit der Nachricht (3.14)', () => {
  it('legt je Nachricht und Träger der adressierten Rolle einen Auftrag an', async () => {
    await sperreLieferant()

    const liste = await auftraege()
    expect(liste).toHaveLength(2)
    const anLa = liste.find((zeile) => zeile.notification.recipientRoleCode === 'supplierAdmin')
    expect(anLa?.recipientUserId).toBe(welt.lieferantAdmin)
    expect(anLa?.status).toBe('pending')
    expect(anLa?.attempts).toBe(0)
    expect(anLa?.sentAt).toBe(null)

    const anMa = liste.find((zeile) => zeile.notification.recipientRoleCode === 'operatorAdmin')
    expect(anMa?.recipientUserId).toBe(welt.administrator)
  })

  it('legt keinen Auftrag an, wo niemand die Rolle trägt — die Nachricht bleibt', async () => {
    // `LA` wird niedergelegt: die Nachricht an die Rolle entsteht weiter, aber
    // es gibt keine Person, die sie erreicht (2.3).
    await prisma.roleAssignment.updateMany({
      where: { userId: welt.lieferantAdmin, roleCode: 'supplierAdmin' },
      data: { deactivatedAt: HEUTE },
    })

    await sperreLieferant()

    const liste = await auftraege()
    expect(liste).toHaveLength(1)
    expect(liste[0]?.notification.recipientRoleCode).toBe('operatorAdmin')
    expect(
      await prisma.notification.count({ where: { recipientRoleCode: 'supplierAdmin' } }),
    ).toBe(1)
  })

  it('gibt der Vertretung einen eigenen Auftrag (2.4, Regel 2)', async () => {
    const zuweisung = await prisma.roleAssignment.findFirstOrThrow({
      where: { userId: welt.lieferantAdmin, roleCode: 'supplierAdmin' },
    })
    await prisma.delegation.create({
      data: {
        delegatedRoleAssignmentId: zuweisung.id,
        delegateUserId: welt.lieferantDisponent,
        tenantId: welt.lieferantMandant,
        periodFrom: tag('2026-11-01'),
        periodTo: tag('2026-12-31'),
        reason: 'Urlaubsvertretung (synthetisch)',
      },
    })

    await sperreLieferant()

    const anLa = (await auftraege()).filter(
      (zeile) => zeile.notification.recipientRoleCode === 'supplierAdmin',
    )
    expect(anLa.map((zeile) => zeile.recipientUserId).sort()).toEqual(
      [welt.lieferantAdmin, welt.lieferantDisponent].sort(),
    )
  })

  it('zählt eine abgelaufene Vertretung nicht mit', async () => {
    const zuweisung = await prisma.roleAssignment.findFirstOrThrow({
      where: { userId: welt.lieferantAdmin, roleCode: 'supplierAdmin' },
    })
    await prisma.delegation.create({
      data: {
        delegatedRoleAssignmentId: zuweisung.id,
        delegateUserId: welt.lieferantDisponent,
        tenantId: welt.lieferantMandant,
        periodFrom: tag('2026-09-01'),
        periodTo: tag('2026-09-30'),
        reason: 'Vergangene Vertretung (synthetisch)',
      },
    })

    const ids = await empfaenger(
      prisma,
      { recipientRoleCode: 'supplierAdmin', recipientTenantId: welt.lieferantMandant },
      HEUTE,
    )
    expect(ids).toEqual([welt.lieferantAdmin])
  })
})

describe('Postausgang (3.14)', () => {
  it('fasst ohne Mailweg nichts an und nennt den Grund', async () => {
    await sperreLieferant()
    const ergebnis = await postausgangAbarbeiten({
      versand: null,
      grund: 'Kein Absender: MAIL_FROM ist nicht gesetzt.',
    })
    expect(ergebnis.betrachtet).toBe(0)
    expect(ergebnis.offen).toBe(2)
    expect(ergebnis.grund).toContain('MAIL_FROM')
    expect(await prisma.notificationDelivery.count({ where: { status: 'pending' } })).toBe(2)
    expect(await prisma.notificationDelivery.count({ where: { attempts: { gt: 0 } } })).toBe(0)
  })

  it('stellt zu, was offen ist, mit der Anmeldekennung als Adresse (3.11)', async () => {
    await sperreLieferant()
    const weg = mitschrift()
    const jetzt = new Date('2026-11-05T09:00:00.000Z')
    const ergebnis = await postausgangAbarbeiten({ versand: weg.versand, jetzt })

    expect(ergebnis.zugestellt).toBe(2)
    expect(ergebnis.offen).toBe(0)
    expect(weg.briefe.map((brief) => brief.empfaenger).sort()).toEqual(
      ['la@test.invalid', 'ma@test.invalid'].sort(),
    )
    const anLa = weg.briefe.find((brief) => brief.empfaenger === 'la@test.invalid')
    expect(anLa?.betreff).toContain('[VMS]')
    expect(anLa?.text).toContain('gesperrt')

    const zeilen = await prisma.notificationDelivery.findMany()
    expect(zeilen.every((zeile) => zeile.status === 'sent')).toBe(true)
    expect(zeilen.every((zeile) => zeile.attempts === 1)).toBe(true)
    expect(zeilen.every((zeile) => zeile.sentAt?.getTime() === jetzt.getTime())).toBe(true)
  })

  it('nennt den Vorgang im Betreff lesbar und nicht als Kennung (3.14)', async () => {
    await sperreLieferant()
    const weg = mitschrift()
    await postausgangAbarbeiten({ versand: weg.versand })

    const anLa = weg.briefe.find((brief) => brief.empfaenger === 'la@test.invalid')
    expect(anLa?.betreff).toContain('Lieferant')
    // Die technische Kennung steht im Text als Verweis, nicht im Betreff.
    expect(anLa?.betreff).not.toContain(welt.lieferant)
    expect(anLa?.text).toContain(welt.lieferant)

    const nachricht = await prisma.notification.findFirstOrThrow({
      where: { recipientRoleCode: 'supplierAdmin' },
    })
    expect(nachricht.objectLabel).toContain('Lieferant')
  })

  it('sendet beim zweiten Abarbeiten nichts doppelt', async () => {
    await sperreLieferant()
    const weg = mitschrift()
    await postausgangAbarbeiten({ versand: weg.versand })
    const zweite = await postausgangAbarbeiten({ versand: weg.versand })
    expect(zweite.betrachtet).toBe(0)
    expect(weg.briefe).toHaveLength(2)
  })

  it('unterlässt die Zustellung, wenn der Empfänger die Rolle verloren hat (2.3)', async () => {
    await sperreLieferant()
    // Zwischen Anlegen und Versand endet die Zuweisung — die zweite Prüfung
    // muss sie bemerken, sonst überholt die wartende E-Mail die Rechtelage.
    await prisma.roleAssignment.updateMany({
      where: { userId: welt.lieferantAdmin, roleCode: 'supplierAdmin' },
      data: { deactivatedAt: tag('2026-11-06') },
    })

    const weg = mitschrift()
    const ergebnis = await postausgangAbarbeiten({
      versand: weg.versand,
      jetzt: new Date('2026-11-07T09:00:00.000Z'),
    })

    expect(ergebnis.zugestellt).toBe(1)
    expect(ergebnis.unterblieben).toBe(1)
    expect(weg.briefe.map((brief) => brief.empfaenger)).toEqual(['ma@test.invalid'])

    const unterblieben = await prisma.notificationDelivery.findFirstOrThrow({
      where: { status: 'suppressed' },
    })
    expect(unterblieben.recipientUserId).toBe(welt.lieferantAdmin)
    expect(unterblieben.statusReason).toContain('nicht mehr')
    expect(unterblieben.sentAt).toBe(null)
  })

  it('zählt einen Fehlversuch und bleibt offen — endgültig erst nach den Versuchen des Regelwerks', async () => {
    await sperreLieferant()
    const fehlweg = scheitert()

    for (let lauf = 1; lauf < REGELWERK.zustellung.versuche; lauf += 1) {
      const ergebnis = await postausgangAbarbeiten({ versand: fehlweg })
      expect(ergebnis.offen).toBe(2)
      expect(ergebnis.gescheitert).toBe(0)
      const zeilen = await prisma.notificationDelivery.findMany()
      expect(zeilen.every((zeile) => zeile.status === 'pending')).toBe(true)
      expect(zeilen.every((zeile) => zeile.attempts === lauf)).toBe(true)
      expect(zeilen.every((zeile) => zeile.statusReason?.includes('Relay antwortet 500'))).toBe(
        true,
      )
    }

    const letzter = await postausgangAbarbeiten({ versand: fehlweg })
    expect(letzter.gescheitert).toBe(2)
    expect(letzter.offen).toBe(0)
    const zeilen = await prisma.notificationDelivery.findMany()
    expect(zeilen.every((zeile) => zeile.status === 'failed')).toBe(true)
    expect(zeilen.every((zeile) => zeile.attempts === REGELWERK.zustellung.versuche)).toBe(true)

    // Ein gescheiterter Auftrag wird nicht wieder aufgenommen.
    expect((await postausgangAbarbeiten({ versand: fehlweg })).betrachtet).toBe(0)
  })

  it('lässt einen Fehler bei einem Auftrag die anderen nicht aufhalten', async () => {
    await sperreLieferant()
    let ersterVersuch = true
    const launisch: Mailversand = {
      absender: 'vms@test.invalid',
      beschreibung: 'Launischer Weg (Test)',
      sende: async () => {
        if (ersterVersuch) {
          ersterVersuch = false
          throw new Error('Relay antwortet 500')
        }
      },
    }
    const ergebnis = await postausgangAbarbeiten({ versand: launisch })
    expect(ergebnis.zugestellt).toBe(1)
    expect(ergebnis.offen).toBe(1)
  })
})

describe('Lesevermerk (3.14)', () => {
  it('entsteht je Person und lässt die Nachricht unverändert', async () => {
    await sperreLieferant()
    const nachricht = await prisma.notification.findFirstOrThrow({
      where: { recipientRoleCode: 'supplierAdmin' },
    })

    ok(await alsGelesenMarkieren(lieferantAdmin, nachricht.id, new Date('2026-11-06T08:00:00Z')))

    const vermerk = await prisma.notificationRead.findFirstOrThrow()
    expect(vermerk.userId).toBe(welt.lieferantAdmin)
    expect(vermerk.notificationId).toBe(nachricht.id)

    const danach = await prisma.notification.findUniqueOrThrow({ where: { id: nachricht.id } })
    expect(danach.message).toBe(nachricht.message)
    expect(danach.kind).toBe(nachricht.kind)
    expect(danach.escalationLevel).toBe(nachricht.escalationLevel)
  })

  it('bleibt beim ersten Zeitpunkt, wenn er zweimal gesetzt wird', async () => {
    await sperreLieferant()
    const nachricht = await prisma.notification.findFirstOrThrow({
      where: { recipientRoleCode: 'supplierAdmin' },
    })
    const zuerst = new Date('2026-11-06T08:00:00.000Z')
    ok(await alsGelesenMarkieren(lieferantAdmin, nachricht.id, zuerst))
    ok(await alsGelesenMarkieren(lieferantAdmin, nachricht.id, new Date('2026-11-07T08:00:00Z')))

    const vermerke = await prisma.notificationRead.findMany()
    expect(vermerke).toHaveLength(1)
    expect(vermerke[0]?.readAt.getTime()).toBe(zuerst.getTime())
  })

  it('verweigert den Vermerk zu einer fremden Nachricht ([47])', async () => {
    await sperreLieferant()
    const nachricht = await prisma.notification.findFirstOrThrow({
      where: { recipientRoleCode: 'supplierAdmin' },
    })

    const ergebnis = await alsGelesenMarkieren(zweiterLieferantDisponent, nachricht.id)
    expect(ergebnis.ok).toBe(false)
    expect(await prisma.notificationRead.count()).toBe(0)
  })

  it('meldet eine Nachricht, die es nicht gibt', async () => {
    const ergebnis = await alsGelesenMarkieren(lieferantAdmin, 'gibt-es-nicht')
    expect(ergebnis.ok).toBe(false)
  })

  it('zählt die ungelesenen Nachrichten der Identität', async () => {
    await sperreLieferant()
    expect(await ladeUngelesen(lieferantAdmin)).toBe(1)
    // Der Disponent des Lieferanten ist nicht adressiert: `LD` trägt keine
    // Nachricht aus 4.6.
    expect(await ladeUngelesen(lieferantDisponent)).toBe(0)

    const nachricht = await prisma.notification.findFirstOrThrow({
      where: { recipientRoleCode: 'supplierAdmin' },
    })
    ok(await alsGelesenMarkieren(lieferantAdmin, nachricht.id))
    expect(await ladeUngelesen(lieferantAdmin)).toBe(0)
  })
})

describe('Eigener Stand (3.14)', () => {
  it('nennt die eigene Zustellung und keine fremde', async () => {
    await sperreLieferant()
    await postausgangAbarbeiten({ versand: mitschrift().versand })

    const sichtbar = await loadNotifications(administrator)
    const stand = await ladeEigenenStand(
      administrator,
      sichtbar.map((nachricht) => nachricht.id),
    )

    const anMa = sichtbar.find((nachricht) => nachricht.recipientRoleCode === 'operatorAdmin')
    expect(stand.get(anMa?.id ?? '')?.zustellung).toBe('sent')

    // Die Nachricht an `LA` sieht der Betreiberadministrator kraft Aufsicht
    // ([47]) — eine **eigene** Zustellung hat er zu ihr nicht.
    const anLa = sichtbar.find((nachricht) => nachricht.recipientRoleCode === 'supplierAdmin')
    expect(stand.get(anLa?.id ?? '')?.zustellung).toBe(null)
    expect(stand.get(anLa?.id ?? '')?.gelesen).toBe(false)
  })

  it('gibt für eine leere Liste eine leere Antwort', async () => {
    expect((await ladeEigenenStand(administrator, [])).size).toBe(0)
  })
})

describe('Wer den Postausgang von Hand abarbeiten darf (2.3)', () => {
  it('ist der Betreiberadministrator', () => {
    expect(darfPostausgangAbarbeiten(administrator)).toBe(true)
  })

  it('ist nicht der Lieferantenadministrator — er versendet nicht über Mandanten hinweg', () => {
    expect(darfPostausgangAbarbeiten(lieferantAdmin)).toBe(false)
  })
})
