/**
 * Der Zugang für den Planer außerhalb des Systems — SPEC **5.5.1**, „Wer den
 * Lauf auslöst", und **3.14**, „Zustellweg".
 *
 * Zwei Adressen, **ein** Geheimnis: es ist derselbe Anrufer, der den Lauf
 * anstößt und den Postausgang abarbeiten lässt (`lib/api/planer.ts`). Deshalb
 * steht beides hier.
 *
 * Was hier geprüft wird und **nirgends sonst**:
 *
 *  - dass der Zugang **zu** ist, solange kein Geheimnis gesetzt ist: ein
 *    offener Auslöser wäre im Prototyp so wenig vertretbar wie im Betrieb,
 *  - dass ein falsches Geheimnis nichts auslöst,
 *  - dass der Aufruf eine **Nachfrage** ist und kein Befehl: ob gelaufen wird,
 *    entscheidet der Zeitplan und nicht der Anrufer.
 *
 * Alle Daten sind synthetisch (CLAUDE.md, Regel 3); das Geheimnis dieses
 * Tests ist ein Wert ohne Bedeutung außerhalb dieser Datei (Regel 2).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { prisma } from '../../lib/prisma'
import { GET, POST } from '../../app/api/naechtlicher-lauf/route'
import {
  GET as ZUSTELLUNG_GET,
  POST as ZUSTELLUNG_POST,
} from '../../app/api/zustellung/route'
import { baueWelt, leereDatenbank } from './fixture'

const GEHEIMNIS = 'test-token-ohne-bedeutung'

function anfrage(token?: string, pfad = 'naechtlicher-lauf'): Request {
  return new Request(`http://localhost/api/${pfad}`, {
    method: 'POST',
    headers: token === undefined ? {} : { authorization: `Bearer ${token}` },
  })
}

beforeEach(async () => {
  await leereDatenbank()
  await baueWelt()
  process.env.NIGHTLY_RUN_TOKEN = GEHEIMNIS
  // Der Zugang nimmt **keinen** Zeitpunkt entgegen: wann gelaufen wird,
  // entscheidet der Zeitplan und nicht der Anrufer (5.5.1). Für den Test wird
  // deshalb die Uhr gestellt — sonst hinge er daran, wann die Suite läuft,
  // und zwischen 00:00 und 03:00 Berliner Zeit wäre er rot.
  vi.useFakeTimers({ shouldAdvanceTime: true })
  vi.setSystemTime(new Date('2026-11-12T08:00:00.000Z'))
})

afterEach(() => {
  vi.useRealTimers()
  delete process.env.NIGHTLY_RUN_TOKEN
})

describe('Zugang zum Lauf (5.5.1)', () => {
  it('weist ohne gesetztes Geheimnis ab — der Zugang ist dann zu', async () => {
    delete process.env.NIGHTLY_RUN_TOKEN
    const antwort = await POST(anfrage(GEHEIMNIS))
    expect(antwort.status).toBe(401)
    expect(await prisma.nightlyRuleRun.count()).toBe(0)
  })

  it('weist ohne Kopfzeile ab', async () => {
    const antwort = await POST(anfrage())
    expect(antwort.status).toBe(401)
    expect(await prisma.nightlyRuleRun.count()).toBe(0)
  })

  it('weist ein falsches Geheimnis ab — auch ein längeres', async () => {
    expect((await POST(anfrage('falsch'))).status).toBe(401)
    expect((await POST(anfrage(`${GEHEIMNIS}x`))).status).toBe(401)
    expect(await prisma.nightlyRuleRun.count()).toBe(0)
  })

  it('löst mit dem richtigen Geheimnis den fälligen Lauf aus — ohne Benutzer', async () => {
    const antwort = await POST(anfrage(GEHEIMNIS))
    expect(antwort.status).toBe(200)
    const lauf = await prisma.nightlyRuleRun.findFirstOrThrow()
    expect(lauf.startedById).toBe(null)
  })

  it('läuft beim zweiten Aufruf desselben Tages nicht noch einmal', async () => {
    await POST(anfrage(GEHEIMNIS))
    const zweite = await POST(anfrage(GEHEIMNIS))
    expect(zweite.status).toBe(200)
    expect((await zweite.json()).message).toContain('Kein Lauf fällig')
    expect(await prisma.nightlyRuleRun.count()).toBe(1)
  })

  it('löst vor der Fälligkeitszeit nichts aus', async () => {
    // 01:00 Weltzeit = 02:00 Berliner Zeit, also vor 03:00.
    vi.setSystemTime(new Date('2026-11-12T01:00:00.000Z'))
    const antwort = await POST(anfrage(GEHEIMNIS))
    expect(antwort.status).toBe(200)
    expect((await antwort.json()).message).toContain('wird erst am')
    expect(await prisma.nightlyRuleRun.count()).toBe(0)
  })

  it('gibt den Stand aus, ohne etwas auszulösen', async () => {
    const antwort = await GET(anfrage(GEHEIMNIS))
    expect(antwort.status).toBe(200)
    const stand = await antwort.json()
    expect(stand.ok).toBe(true)
    expect(stand.stichtag).toBe('2026-11-12')
    expect(stand.faellig).toBe(true)
    expect(stand.offen).toBe(true)
    expect(await prisma.nightlyRuleRun.count()).toBe(0)
  })

  it('gibt der Überwachung die Stufe und nicht nur die Zahl der Tage (5.5.1)', async () => {
    // Eine Überwachung außerhalb des Systems soll die Schwelle aus 5.5.1 nicht
    // nachbauen müssen — sie bekommt das Urteil.
    await prisma.nightlyRuleRun.create({
      data: {
        runDate: new Date('2026-11-08T00:00:00.000Z'),
        startedAt: new Date('2026-11-08T02:00:00.000Z'),
        checked: 0,
        informations: 0,
        warnings: 0,
        escalations: 0,
        notifications: 0,
      },
    })
    const stand = await (await GET(anfrage(GEHEIMNIS))).json()
    expect(stand.ausgefalleneTage).toBe(3)
    expect(stand.ausfallstufe).toBe('warnung')
    // Der Status bleibt 200: die Anwendung antwortet, der Planer ist das
    // Problem. Das Urteil steht im Inhalt, nicht im Statuscode.
    expect((await GET(anfrage(GEHEIMNIS))).status).toBe(200)
  })

  it('gibt den Stand nicht ohne Geheimnis aus', async () => {
    expect((await GET(anfrage('falsch'))).status).toBe(401)
  })
})

describe('Zugang zum Postausgang (3.14)', () => {
  // Diese Tests prüfen den **geschlossenen** Zustand: kein Mailweg, also geht
  // nichts hinaus. Sie dürfen deshalb nicht an der `.env` des Entwicklers
  // hängen — eine gesetzte Absenderadresse würde sie sonst rot machen.
  beforeEach(() => {
    delete process.env.MAIL_FROM
    delete process.env.MAIL_RELAY_URL
    delete process.env.MAIL_OUTBOX_DIR
  })

  it('weist ohne gesetztes Geheimnis ab — derselbe Zugang wie beim Lauf', async () => {
    delete process.env.NIGHTLY_RUN_TOKEN
    expect((await ZUSTELLUNG_POST(anfrage(GEHEIMNIS, 'zustellung'))).status).toBe(401)
    expect((await ZUSTELLUNG_GET(anfrage(GEHEIMNIS, 'zustellung'))).status).toBe(401)
  })

  it('weist ein falsches Geheimnis ab', async () => {
    expect((await ZUSTELLUNG_POST(anfrage('falsch', 'zustellung'))).status).toBe(401)
  })

  it('antwortet mit dem Grund, solange kein Mailweg besteht — und mit 200', async () => {
    // Ohne MAIL_FROM geht nichts hinaus (3.14). Der Status bleibt 200: die
    // Anwendung antwortet, die Umgebung ist unvollständig.
    const antwort = await ZUSTELLUNG_POST(anfrage(GEHEIMNIS, 'zustellung'))
    expect(antwort.status).toBe(200)
    const ergebnis = await antwort.json()
    expect(ergebnis.ok).toBe(true)
    expect(ergebnis.weg).toBe(null)
    expect(ergebnis.grund).toContain('MAIL_FROM')
    expect(ergebnis.zugestellt).toBe(0)
  })

  it('gibt den Stand aus, ohne etwas zu versenden', async () => {
    const stand = await (await ZUSTELLUNG_GET(anfrage(GEHEIMNIS, 'zustellung'))).json()
    expect(stand.ok).toBe(true)
    expect(stand.offen).toBe(0)
    expect(stand.zugestellt).toBe(0)
    expect(stand.grund).toContain('MAIL_FROM')
  })
})
