/**
 * Der Mailweg aus der Umgebung — SPEC **3.14** („Zustellweg") und **6.8**.
 *
 * Was hier geprüft wird und **nirgends sonst**:
 *
 *  - dass **ohne Absender kein Weg** besteht: eine E-Mail ohne Absender ist
 *    keine,
 *  - dass eine **unverschlüsselte** Relay-Adresse nicht genutzt wird — mit dem
 *    Inhalt verlässt ein mittelbar personenbezogener Text das System (6.8);
 *    die einzige Ausnahme ist der eigene Rechner,
 *  - dass das **Relay vor dem Dateiausgang** gilt: ein konfiguriertes Relay ist
 *    die Absicht, der Dateiausgang nur die Werkbank,
 *  - dass der Grund **in Worten** zurückkommt, wenn kein Weg besteht: „es geht
 *    nichts hinaus" ist eine Lage, die man sehen muss.
 *
 * Alle Werte sind synthetisch (CLAUDE.md, Regel 3); `MAIL_RELAY_TOKEN` steht in
 * keinem Test, weil er ein Geheimnis wäre (Regel 2).
 */
import { mkdtemp, readdir, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import type { Brief } from './brief'
import { basisadresseAusUmgebung, mailwegAusUmgebung } from './versand'

const BRIEF: Brief = {
  empfaenger: 'md@test.invalid',
  betreff: '[VMS] Information: Statuswechsel (Kapitel 4) — EI-2026-0001',
  text: 'Einsatz EI-2026-0001 ist aktiv.',
}

describe('Mailweg aus der Umgebung (3.14)', () => {
  it('besteht ohne MAIL_FROM nicht', () => {
    const stand = mailwegAusUmgebung({ MAIL_RELAY_URL: 'https://mail.test.invalid/send' })
    expect(stand.versand).toBe(null)
    expect(stand.grund).toContain('MAIL_FROM')
  })

  it('besteht ohne Weg nicht — der Absender allein genügt nicht', () => {
    const stand = mailwegAusUmgebung({ MAIL_FROM: 'vms@test.invalid' })
    expect(stand.versand).toBe(null)
    expect(stand.grund).toContain('Kein Zustellweg')
  })

  it('lehnt eine unverschlüsselte Relay-Adresse ab (6.8)', () => {
    const stand = mailwegAusUmgebung({
      MAIL_FROM: 'vms@test.invalid',
      MAIL_RELAY_URL: 'http://mail.test.invalid/send',
    })
    expect(stand.versand).toBe(null)
    expect(stand.grund).toContain('unverschlüsselt')
  })

  it('lässt den eigenen Rechner unverschlüsselt zu — dort ist der Weg nicht das Netz', () => {
    const stand = mailwegAusUmgebung({
      MAIL_FROM: 'vms@test.invalid',
      MAIL_RELAY_URL: 'http://localhost:2525/send',
    })
    expect(stand.versand).not.toBe(null)
    expect(stand.versand?.beschreibung).toContain('localhost')
  })

  it('lehnt eine Adresse ab, die keine ist', () => {
    const stand = mailwegAusUmgebung({ MAIL_FROM: 'vms@test.invalid', MAIL_RELAY_URL: 'kein-url' })
    expect(stand.versand).toBe(null)
    expect(stand.grund).toContain('keine Adresse')
  })

  it('nimmt ein verschlüsseltes Relay und nennt nur seinen Ursprung', () => {
    const stand = mailwegAusUmgebung({
      MAIL_FROM: 'vms@test.invalid',
      MAIL_RELAY_URL: 'https://mail.test.invalid/send/v1',
    })
    expect(stand.grund).toBe('')
    expect(stand.versand?.absender).toBe('vms@test.invalid')
    // Nur der Ursprung: der Pfad könnte einen Schlüssel tragen (CLAUDE.md, Regel 2).
    expect(stand.versand?.beschreibung).toBe('Relay https://mail.test.invalid')
  })

  it('gibt dem Relay den Vorrang vor dem Dateiausgang', () => {
    const stand = mailwegAusUmgebung({
      MAIL_FROM: 'vms@test.invalid',
      MAIL_RELAY_URL: 'https://mail.test.invalid/send',
      MAIL_OUTBOX_DIR: '/tmp/unbenutzt',
    })
    expect(stand.versand?.beschreibung.startsWith('Relay')).toBe(true)
  })

  it('schreibt im Dateiausgang Absender, Empfänger, Betreff und Text', async () => {
    const verzeichnis = await mkdtemp(join(tmpdir(), 'vms-postausgang-'))
    const stand = mailwegAusUmgebung({
      MAIL_FROM: 'vms@test.invalid',
      MAIL_OUTBOX_DIR: verzeichnis,
    })
    expect(stand.grund).toBe('')
    await stand.versand?.sende(BRIEF)
    const dateien = await readdir(verzeichnis)
    expect(dateien.length).toBe(1)
    const inhalt = await readFile(join(verzeichnis, dateien[0] as string), 'utf8')
    expect(inhalt).toContain('From: vms@test.invalid')
    expect(inhalt).toContain('To: md@test.invalid')
    expect(inhalt).toContain('Subject: [VMS] Information:')
    expect(inhalt).toContain('Einsatz EI-2026-0001 ist aktiv.')
  })
})

describe('Basisadresse (3.14)', () => {
  it('ist leer, solange keine gesetzt ist — kein geratener Link', () => {
    expect(basisadresseAusUmgebung({})).toBe(null)
    expect(basisadresseAusUmgebung({ APP_BASE_URL: '  ' })).toBe(null)
  })

  it('gibt die gesetzte Adresse zurück', () => {
    expect(basisadresseAusUmgebung({ APP_BASE_URL: 'https://vms.test.invalid' })).toBe(
      'https://vms.test.invalid',
    )
  })
})
