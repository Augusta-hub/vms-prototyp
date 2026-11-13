/**
 * Der Zugang für den Planer außerhalb des Systems — SPEC **5.5.1**, „Wer den
 * Lauf auslöst".
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
import { baueWelt, leereDatenbank } from './fixture'

const GEHEIMNIS = 'test-token-ohne-bedeutung'

function anfrage(token?: string): Request {
  return new Request('http://localhost/api/naechtlicher-lauf', {
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
    expect(stand.offen).toBe(true)
    expect(await prisma.nightlyRuleRun.count()).toBe(0)
  })

  it('gibt den Stand nicht ohne Geheimnis aus', async () => {
    expect((await GET(anfrage('falsch'))).status).toBe(401)
  })
})
