/**
 * Fachdienst Zustellung und Lesevermerk — SPEC **3.14** („Zustellweg",
 * „Zustellung", „Lesevermerk"), entschieden mit *Frage 56*.
 *
 * Zwei Wege, beide immer: die Nachricht steht im **Postfach** und geht als
 * **E-Mail mit der Meldung** hinaus. Das Postfach braucht kein Objekt — es ist
 * eine Sicht auf die Benachrichtigungen selbst (`loadNotifications` in
 * `nightly.ts`, geprüft nach [47]). Dieser Dienst füllt die beiden Objekte,
 * die daneben entstehen.
 *
 * **Drei Zeitpunkte, drei Zuständigkeiten.**
 *
 *  1. *Mit der Nachricht* entsteht je Empfänger ein Zustellauftrag — in
 *     **derselben Transaktion** wie der Übergang, aus demselben Grund wie die
 *     Benachrichtigung selbst: ein Auftrag zu einem zurückgerollten Übergang
 *     wäre nicht zurückzunehmen, wenn die E-Mail erst draußen ist.
 *  2. *Später* arbeitet der Postausgang die Aufträge ab. Dort und nur dort
 *     wird gesendet — außerhalb jeder Transaktion, weil ein Netzaufruf keine
 *     Datenbanksperre halten darf und ein Rollback eine gesendete E-Mail nicht
 *     zurückholt.
 *  3. *Beim Lesen* setzt die Person ihren eigenen Lesevermerk.
 *
 * **Geprüft wird zweimal** (3.14): beim Anlegen und erneut unmittelbar vor dem
 * Versand. Wer die adressierte Rollenzuweisung in der Zwischenzeit verloren
 * hat oder deaktiviert ist, erhält nichts mehr (2.3) — der Auftrag endet als
 * `suppressed`, unterblieben und nicht gescheitert.
 */
import type { Transaktion } from '../audit/record'
import { REGELWERK } from '../aueg/regelwerk'
import { checkPermission } from '../authz/check'
import type { RoleCode } from '../authz/roles'
import type { LoadedIdentity } from '../identity/loadSubject'
import { brief, type Briefdaten } from '../notifications/brief'
import {
  NOTIFICATION_KIND_LABELS,
  NOTIFICATION_TRIGGER_LABELS,
} from '../notifications/bezeichnungen'
import {
  basisadresseAusUmgebung,
  mailwegAusUmgebung,
  type Mailversand,
} from '../notifications/versand'
import { prisma } from '../prisma'
import { failure, notificationRef, success, type ActionResult } from './common'

/** Die Adressierung einer Benachrichtigung, soweit die Zustellung sie braucht. */
export interface Adressierung {
  readonly recipientRoleCode: RoleCode
  readonly recipientTenantId: string
}

/**
 * Die Personen, die eine an diese Rollenzuweisung gerichtete Nachricht
 * erhalten — **Träger und Vertretung** (3.14, „Wer die E-Mail erhält").
 *
 * Gelesen werden die Rollenzuweisungen, gültig am Stichtag, und die zu ihnen
 * laufenden Vertretungen. Die Vertretung ist hier kein Zugeständnis, sondern
 * Folge von 2.4 Regel 2: sie trägt die Rechte der vertretenen Zuweisung, und
 * wäre der Rolleninhaber abwesend und sie nicht adressiert, erreichte die
 * Nachricht niemanden, der handeln kann. Die Stufe „an deren Vertretung" aus
 * der Stufenfolge ist etwas anderes — eine eigene Erinnerung, weil nichts
 * geschehen ist.
 *
 * Deaktivierte Personen entfallen: eine E-Mail an einen abgeschalteten Zugang
 * wäre eine Offenlegung ohne Empfänger (2.3).
 */
export async function empfaenger(
  tx: Transaktion,
  adressierung: Adressierung,
  stichtag: Date,
): Promise<readonly string[]> {
  const zuweisungen = await tx.roleAssignment.findMany({
    where: {
      roleCode: adressierung.recipientRoleCode,
      tenantId: adressierung.recipientTenantId,
      deactivatedAt: null,
      validFrom: { lte: stichtag },
      OR: [{ validTo: null }, { validTo: { gte: stichtag } }],
    },
    select: {
      user: { select: { id: true, deactivatedAt: true } },
      delegations: {
        where: {
          deactivatedAt: null,
          revokedAt: null,
          periodFrom: { lte: stichtag },
          periodTo: { gte: stichtag },
        },
        select: { delegateUser: { select: { id: true, deactivatedAt: true } } },
      },
    },
  })

  const ids = new Set<string>()
  for (const zuweisung of zuweisungen) {
    if (zuweisung.user.deactivatedAt === null) ids.add(zuweisung.user.id)
    for (const vertretung of zuweisung.delegations) {
      if (vertretung.delegateUser.deactivatedAt === null) ids.add(vertretung.delegateUser.id)
    }
  }
  return [...ids]
}

/**
 * Legt die Zustellaufträge zu einer eben geschriebenen Benachrichtigung an und
 * gibt ihre Anzahl zurück.
 *
 * Null ist ein gültiges Ergebnis: eine Rolle, die in dieser Organisation
 * gerade niemand trägt, ist nicht zustellbar. Die Benachrichtigung bleibt
 * trotzdem — sie ist die Feststellung, und wer die Rolle später übernimmt,
 * findet sie im Postfach. Nachträglich zugestellt wird sie **nicht**: eine
 * E-Mail über eine Frist, die inzwischen vergangen ist, wäre keine Nachricht,
 * sondern ein Nachruf.
 */
export async function legeZustellungenAn(
  tx: Transaktion,
  notificationId: string,
  adressierung: Adressierung,
  stichtag: Date,
): Promise<number> {
  const ids = await empfaenger(tx, adressierung, stichtag)
  for (const recipientUserId of ids) {
    await tx.notificationDelivery.create({ data: { notificationId, recipientUserId } })
  }
  return ids.length
}

/** Was aus einer Zeile ein Brief macht (3.14, „Was in der E-Mail steht"). */
function briefdaten(nachricht: {
  readonly kind: string
  readonly trigger: string
  readonly message: string
  readonly objectType: string
  readonly objectRef: string
  readonly recipientRoleCode: string
  readonly escalationLevel: number
  readonly ruleRef: string | null
  readonly statusFrom: string | null
  readonly statusTo: string | null
  readonly raisedAt: Date
  readonly runDate: Date | null
}): Briefdaten {
  return {
    art: NOTIFICATION_KIND_LABELS[nachricht.kind as keyof typeof NOTIFICATION_KIND_LABELS] ??
      nachricht.kind,
    anlass: NOTIFICATION_TRIGGER_LABELS[nachricht.trigger] ?? nachricht.trigger,
    meldung: nachricht.message,
    objectType: nachricht.objectType,
    objectRef: nachricht.objectRef,
    rolle: nachricht.recipientRoleCode,
    stufe: nachricht.escalationLevel,
    pruefung: nachricht.ruleRef,
    statusFrom: nachricht.statusFrom,
    statusTo: nachricht.statusTo,
    raisedAt: nachricht.raisedAt,
    runDate: nachricht.runDate,
  }
}

export interface Postausgangsergebnis {
  /** Offene Aufträge, die betrachtet wurden. */
  readonly betrachtet: number
  readonly zugestellt: number
  readonly unterblieben: number
  readonly gescheitert: number
  /** Noch offen: ein Versuch ist misslungen, die Zahl der Versuche nicht erschöpft. */
  readonly offen: number
  /** Leer, wenn ein Weg bestand; sonst der Grund, warum nichts hinausging. */
  readonly grund: string
}

const LEERER_AUSGANG: Postausgangsergebnis = {
  betrachtet: 0,
  zugestellt: 0,
  unterblieben: 0,
  gescheitert: 0,
  offen: 0,
  grund: '',
}

/**
 * Arbeitet den Postausgang ab: für jeden offenen Auftrag eine E-Mail.
 *
 * **Ohne Mailweg wird nichts angefasst** (3.14). Kein Versuch, kein Zähler,
 * kein Zustand: die Aufträge bleiben offen, bis es einen Weg gibt. Ein Auftrag,
 * der ohne Weg als gescheitert gilt, wäre eine Zusage über eine E-Mail, die
 * niemand gesendet hat.
 *
 * **Jeder Auftrag für sich.** Ein Fehler beim einen beendet den Durchgang
 * nicht — sonst hinge die Zustellung aller am ersten unerreichbaren Empfänger.
 * Erst nach `REGELWERK.zustellung.versuche` Versuchen gilt ein Auftrag als
 * endgültig gescheitert.
 */
export async function postausgangAbarbeiten(
  optionen: {
    readonly versand?: Mailversand | null
    readonly grund?: string
    readonly basisadresse?: string | null
    readonly jetzt?: Date
    readonly grenze?: number
  } = {},
): Promise<Postausgangsergebnis> {
  const weg =
    optionen.versand === undefined
      ? mailwegAusUmgebung()
      : { versand: optionen.versand, grund: optionen.grund ?? '' }
  if (weg.versand === null) {
    const offen = await prisma.notificationDelivery.count({ where: { status: 'pending' } })
    return { ...LEERER_AUSGANG, offen, grund: weg.grund }
  }

  const jetzt = optionen.jetzt ?? new Date()
  const basisadresse =
    optionen.basisadresse === undefined ? basisadresseAusUmgebung() : optionen.basisadresse
  const auftraege = await prisma.notificationDelivery.findMany({
    where: { status: 'pending' },
    orderBy: { createdAt: 'asc' },
    take: optionen.grenze ?? 200,
    include: {
      notification: true,
      recipientUser: { select: { id: true, loginIdentifier: true, deactivatedAt: true } },
    },
  })

  let zugestellt = 0
  let unterblieben = 0
  let gescheitert = 0
  let offen = 0

  for (const auftrag of auftraege) {
    // Die zweite Prüfung (3.14): darf diese Person die Nachricht jetzt noch
    // sehen? Zwischen Anlegen und Versand liegt Zeit, und ohne diese Prüfung
    // würde eine Rechteänderung von einer wartenden E-Mail überholt (2.3).
    const berechtigte = await empfaenger(
      prisma,
      {
        recipientRoleCode: auftrag.notification.recipientRoleCode,
        recipientTenantId: auftrag.notification.recipientTenantId,
      },
      jetzt,
    )
    if (!berechtigte.includes(auftrag.recipientUserId)) {
      await prisma.notificationDelivery.update({
        where: { id: auftrag.id },
        data: {
          status: 'suppressed',
          lastAttemptAt: jetzt,
          statusReason:
            'Der Empfänger trägt die adressierte Rollenzuweisung nicht mehr; nicht zugestellt (2.3).',
        },
      })
      unterblieben += 1
      continue
    }

    const versuche = auftrag.attempts + 1
    try {
      await weg.versand.sende(
        brief(briefdaten(auftrag.notification), auftrag.recipientUser.loginIdentifier, basisadresse),
      )
      await prisma.notificationDelivery.update({
        where: { id: auftrag.id },
        data: { status: 'sent', attempts: versuche, lastAttemptAt: jetzt, sentAt: jetzt },
      })
      zugestellt += 1
    } catch (fehler) {
      const text = fehler instanceof Error ? fehler.message.split('\n')[0] : String(fehler)
      const endgueltig = versuche >= REGELWERK.zustellung.versuche
      await prisma.notificationDelivery.update({
        where: { id: auftrag.id },
        data: {
          status: endgueltig ? 'failed' : 'pending',
          attempts: versuche,
          lastAttemptAt: jetzt,
          statusReason: `Versuch ${versuche}: ${text ?? 'unbekannter Fehler'}`,
        },
      })
      if (endgueltig) gescheitert += 1
      else offen += 1
    }
  }

  return {
    betrachtet: auftraege.length,
    zugestellt,
    unterblieben,
    gescheitert,
    offen,
    grund: '',
  }
}

/** Der Postausgang in Zahlen — für die Anzeige (3.14). */
export interface Postausgangsstand {
  readonly offen: number
  readonly zugestellt: number
  readonly unterblieben: number
  readonly gescheitert: number
  /** Leer, wenn ein Mailweg besteht; sonst der Grund. */
  readonly grund: string
  /** Der Weg in Worten, soweit vorhanden. */
  readonly weg: string | null
}

export async function ladePostausgangsstand(
  umgebung: Readonly<Record<string, string | undefined>> = process.env,
): Promise<Postausgangsstand> {
  const weg = mailwegAusUmgebung(umgebung)
  const gruppen = await prisma.notificationDelivery.groupBy({
    by: ['status'],
    _count: { _all: true },
  })
  const zahl = (status: string): number =>
    gruppen.find((gruppe) => gruppe.status === status)?._count._all ?? 0
  return {
    offen: zahl('pending'),
    zugestellt: zahl('sent'),
    unterblieben: zahl('suppressed'),
    gescheitert: zahl('failed'),
    grund: weg.grund,
    weg: weg.versand === null ? null : weg.versand.beschreibung,
  }
}

/**
 * Der eigene Stand zu einer Liste von Benachrichtigungen: gelesen, und wie es
 * der eigenen Zustellung ergangen ist.
 *
 * Gefragt wird immer nach **sich selbst**. Ein fremder Lesevermerk steht
 * niemandem zu und ein fremder Zustellstand sagt nichts, was 2.3 deckt: dass
 * eine Kollegin eine Nachricht gelesen hat, ist ihre Sache.
 */
export interface EigenerStand {
  readonly gelesen: boolean
  readonly zustellung: string | null
  readonly zustellgrund: string | null
}

export async function ladeEigenenStand(
  identity: LoadedIdentity,
  notificationIds: readonly string[],
): Promise<ReadonlyMap<string, EigenerStand>> {
  const stand = new Map<string, EigenerStand>()
  if (notificationIds.length === 0) return stand
  const [vermerke, zustellungen] = await Promise.all([
    prisma.notificationRead.findMany({
      where: { userId: identity.user.id, notificationId: { in: [...notificationIds] } },
      select: { notificationId: true },
    }),
    prisma.notificationDelivery.findMany({
      where: { recipientUserId: identity.user.id, notificationId: { in: [...notificationIds] } },
      select: { notificationId: true, status: true, statusReason: true },
    }),
  ])
  const gelesen = new Set(vermerke.map((vermerk) => vermerk.notificationId))
  for (const id of notificationIds) {
    const zustellung = zustellungen.find((zeile) => zeile.notificationId === id)
    stand.set(id, {
      gelesen: gelesen.has(id),
      zustellung: zustellung?.status ?? null,
      zustellgrund: zustellung?.statusReason ?? null,
    })
  }
  return stand
}

/** Die Zahl der ungelesenen Nachrichten dieser Identität (3.14). */
export async function ladeUngelesen(identity: LoadedIdentity): Promise<number> {
  const adressiert = identity.subject.grants.map((grant) => ({
    recipientRoleCode: grant.roleCode,
    recipientTenantId: grant.tenantId,
  }))
  if (adressiert.length === 0) return 0
  return prisma.notification.count({
    where: {
      OR: adressiert,
      reads: { none: { userId: identity.user.id } },
    },
  })
}

export const ZUSTELLUNG_LABELS: Readonly<Record<string, string>> = {
  pending: 'offen',
  sent: 'zugestellt',
  failed: 'gescheitert',
  suppressed: 'unterblieben',
}

/**
 * Setzt den eigenen Lesevermerk (3.14, „Lesevermerk").
 *
 * Geprüft wird das **Leserecht an der Benachrichtigung** ([47]) — ein eigenes
 * Recht braucht der Vermerk nicht: wer die Nachricht lesen darf, darf
 * festhalten, dass er sie gelesen hat, und für niemanden sonst. Der Leser ist
 * immer der Handelnde; ein fremder Vermerk ist in dieser Schnittstelle nicht
 * ausdrückbar.
 *
 * Zweimal gesetzt bleibt der erste Zeitpunkt stehen: „gesehen" ist kein
 * Ereignis, das sich wiederholt.
 */
export async function alsGelesenMarkieren(
  identity: LoadedIdentity,
  notificationId: string,
  jetzt: Date = new Date(),
): Promise<ActionResult> {
  const nachricht = await prisma.notification.findUnique({
    where: { id: notificationId },
    include: { tenant: { select: { tenantType: true } } },
  })
  if (nachricht === null) return failure('Die Benachrichtigung gibt es nicht (3.14).')

  const entscheidung = checkPermission(
    identity.subject,
    'read',
    notificationRef({
      tenantId: nachricht.tenantId,
      tenantType: nachricht.tenant.tenantType,
      recipientRoleCode: nachricht.recipientRoleCode,
      recipientTenantId: nachricht.recipientTenantId,
    }),
  )
  if (!entscheidung.allowed) {
    return failure(
      'Diese Benachrichtigung ist nicht an eine Rollenzuweisung dieser Person gerichtet (2.3, 3.14).',
      'SPEC 3.14, Fußnote [47]',
    )
  }

  const vorhanden = await prisma.notificationRead.findUnique({
    where: { notificationId_userId: { notificationId, userId: identity.user.id } },
    select: { id: true },
  })
  if (vorhanden !== null) return success('Die Nachricht war schon als gelesen vermerkt (3.14).')

  await prisma.notificationRead.create({
    data: { notificationId, userId: identity.user.id, readAt: jetzt },
  })
  return success('Als gelesen vermerkt (3.14). Die Nachricht selbst bleibt unverändert.')
}

/** Nur der Betreiberadministrator arbeitet den Postausgang von Hand ab. */
export function darfPostausgangAbarbeiten(identity: LoadedIdentity): boolean {
  return (
    identity.tenant.tenantType === 'operator' &&
    identity.subject.grants.some((grant) => grant.roleCode === 'operatorAdmin')
  )
}
