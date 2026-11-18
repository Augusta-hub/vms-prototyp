/**
 * Der Mailweg — SPEC **3.14** („Zustellweg") und **6.8**.
 *
 * Das System kennt den Weg nicht, es bekommt ihn gesagt. Welcher Betreiber den
 * Transport leistet, hängt am Hoster (*offene Frage 2*) und steht deshalb
 * nicht im Anwendungscode, sondern in der Umgebung. Eine Zeile mit einem
 * Anbieternamen wäre eine Entscheidung, die dieses Kapitel nicht trifft.
 *
 * **Ohne konfigurierten Weg geht nichts hinaus** (3.14). Die Zustellaufträge
 * bleiben dann offen, statt stillschweigend zu verfallen: ein Auftrag, der
 * ohne Weg als „erledigt" gilt, wäre eine Zusage über eine E-Mail, die niemand
 * gesendet hat.
 *
 * **Verschlüsselung ist Bedingung, nicht Empfehlung** (6.8). Eine
 * Relay-Adresse ohne `https` wird nicht genutzt — mit dem Inhalt verlässt ein
 * mittelbar personenbezogener Text das System. Die einzige Ausnahme ist der
 * eigene Rechner: dort ist der Weg nicht das Netz.
 */
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { Brief } from './brief'

export interface Mailversand {
  /** Absenderadresse, aus der Umgebung. */
  readonly absender: string
  /** Der Weg in Worten — für Anzeige und Protokoll, ohne Geheimnisse. */
  readonly beschreibung: string
  sende(brief: Brief): Promise<void>
}

/**
 * Der Stand des Mailwegs: entweder ein Versand oder der Grund, warum keiner
 * zur Verfügung steht. Beides wird angezeigt — „es geht nichts hinaus" ist
 * eine Lage, die man sehen muss, nicht ein stiller Zustand.
 */
export interface Mailwegstand {
  readonly versand: Mailversand | null
  readonly grund: string
}

function istOertlich(adresse: URL): boolean {
  return adresse.hostname === 'localhost' || adresse.hostname === '127.0.0.1'
}

/**
 * Ein Relay, das einen Brief als JSON annimmt — die Form, die
 * Transaktionsmaildienste anbieten. Der Schlüssel steht in der Umgebung und
 * wird nicht mitgeschrieben (CLAUDE.md, Regel 2).
 */
function httpVersand(ziel: URL, absender: string, schluessel: string | null): Mailversand {
  return {
    absender,
    beschreibung: `Relay ${ziel.origin}`,
    async sende(brief: Brief): Promise<void> {
      const antwort = await fetch(ziel, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(schluessel === null ? {} : { authorization: `Bearer ${schluessel}` }),
        },
        body: JSON.stringify({
          from: absender,
          to: brief.empfaenger,
          subject: brief.betreff,
          text: brief.text,
        }),
      })
      if (!antwort.ok) {
        throw new Error(`Relay antwortet ${antwort.status}`)
      }
    },
  }
}

/**
 * Ein **Dateiausgang** für die Entwicklung: jeder Brief wird als Datei
 * geschrieben, nichts verlässt den Rechner.
 *
 * Er ist ein echter Zustellweg im Sinne von 3.14 — der Auftrag gilt als
 * zugestellt —, aber ausdrücklich keiner für den Betrieb. Dass er sichtbar
 * macht, was hinausgehen würde, ist sein Zweck: so ist der Inhalt einer
 * Zustellung prüfbar, ohne einen Mailbetreiber zu haben.
 */
function dateiVersand(verzeichnis: string, absender: string): Mailversand {
  let folge = 0
  return {
    absender,
    beschreibung: `Dateiausgang ${verzeichnis}`,
    async sende(brief: Brief): Promise<void> {
      await mkdir(verzeichnis, { recursive: true })
      folge += 1
      const name = `${new Date().toISOString().replace(/[:.]/g, '-')}-${folge}.txt`
      const inhalt = [
        `From: ${absender}`,
        `To: ${brief.empfaenger}`,
        `Subject: ${brief.betreff}`,
        '',
        brief.text,
        '',
      ].join('\n')
      await writeFile(join(verzeichnis, name), inhalt, 'utf8')
    },
  }
}

/**
 * Liest den Mailweg aus der Umgebung.
 *
 * `MAIL_FROM` ist Bedingung für jeden Weg: ohne Absender gibt es keine E-Mail.
 * Dann entscheidet, was gesetzt ist — `MAIL_RELAY_URL` vor `MAIL_OUTBOX_DIR`,
 * weil ein konfiguriertes Relay die Absicht ist und der Dateiausgang nur die
 * Werkbank.
 */
export function mailwegAusUmgebung(
  umgebung: Readonly<Record<string, string | undefined>> = process.env,
): Mailwegstand {
  const absender = (umgebung.MAIL_FROM ?? '').trim()
  if (absender === '') {
    return { versand: null, grund: 'Kein Absender: MAIL_FROM ist nicht gesetzt.' }
  }

  const relay = (umgebung.MAIL_RELAY_URL ?? '').trim()
  if (relay !== '') {
    let ziel: URL
    try {
      ziel = new URL(relay)
    } catch {
      return { versand: null, grund: 'MAIL_RELAY_URL ist keine Adresse.' }
    }
    if (ziel.protocol !== 'https:' && !istOertlich(ziel)) {
      return {
        versand: null,
        grund: 'MAIL_RELAY_URL ist unverschlüsselt; der Inhalt der Nachricht geht nur über https (6.8).',
      }
    }
    const schluessel = (umgebung.MAIL_RELAY_TOKEN ?? '').trim()
    return { versand: httpVersand(ziel, absender, schluessel === '' ? null : schluessel), grund: '' }
  }

  const ausgang = (umgebung.MAIL_OUTBOX_DIR ?? '').trim()
  if (ausgang !== '') {
    return { versand: dateiVersand(ausgang, absender), grund: '' }
  }

  return {
    versand: null,
    grund: 'Kein Zustellweg: weder MAIL_RELAY_URL noch MAIL_OUTBOX_DIR ist gesetzt.',
  }
}

/** Die Basisadresse des Systems für den Hinweis im Brief; leer, wenn unbekannt. */
export function basisadresseAusUmgebung(
  umgebung: Readonly<Record<string, string | undefined>> = process.env,
): string | null {
  const wert = (umgebung.APP_BASE_URL ?? '').trim()
  return wert === '' ? null : wert
}
