/**
 * Der Fortschrittsmesser fuer die Meilensteine M4 und M5.
 *
 * Liest den Nachrichtenstrom des letzten Laufs (reports/aueg-messages.ndjson)
 * und zeigt, wie weit das Regelwerk aus SPEC Kapitel 5 umgesetzt ist:
 * wie viele Szenarien laufen, wie viele sind rot, wie viele ausstehend —
 * aufgeschluesselt nach den Pruefungen P1 bis P11.
 *
 * Zweite Dimension: wie weit der Runner die Szenarien strukturiert liest.
 * Das ist nicht derselbe Fortschritt. Ein strukturiert gelesener Sachverhalt
 * sagt nichts darueber, ob eine Regel stimmt — er sagt nur, dass die
 * Fachlogik die Daten vorfindet, mit denen sie rechnen soll.
 *
 * Aufruf: npm run test:aueg:report
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { erfasseAusloeser } from './support/ausloeser'
import { erfasseErwartung, istAuswertbar } from './support/erwartung'
import { erfasseSachverhalt } from './support/sachverhalt'
import { ALLE_PRUEFUNGEN, PRUEFUNGSNAMEN, pruefungenAusTags, type Pruefung } from './support/pruefwerk'

const STROM = 'reports/aueg-messages.ndjson'
const AUSGABE = 'reports/aueg-bericht.md'

/** Ergebniszustaende eines Szenarios, streng vor milde. */
const RANG = ['FAILED', 'AMBIGUOUS', 'UNDEFINED', 'PENDING', 'SKIPPED', 'PASSED', 'UNKNOWN'] as const
type Zustand = (typeof RANG)[number]

const DEUTSCH: Readonly<Record<Zustand, string>> = {
  PASSED: 'grün',
  FAILED: 'rot',
  PENDING: 'ausstehend',
  UNDEFINED: 'ohne Definition',
  AMBIGUOUS: 'mehrdeutig',
  SKIPPED: 'übersprungen',
  UNKNOWN: 'unbekannt',
}

interface Schritt {
  id: string
  text: string
  typ: 'Context' | 'Action' | 'Outcome' | 'Unknown'
}

interface Szenario {
  name: string
  datei: string
  tags: string[]
  schritte: Schritt[]
}

interface Lauf {
  szenarien: Map<string, Szenario>
  /** testCaseId -> pickleId */
  faelle: Map<string, string>
  /** testCaseStartedId -> testCaseId */
  laeufe: Map<string, string>
  /** testCaseStartedId -> Zustaende der Schritte */
  schrittzustaende: Map<string, Zustand[]>
}

function leseStrom(pfad: string): Lauf {
  const lauf: Lauf = {
    szenarien: new Map(),
    faelle: new Map(),
    laeufe: new Map(),
    schrittzustaende: new Map(),
  }

  for (const zeile of readFileSync(pfad, 'utf8').split('\n')) {
    if (zeile.trim() === '') continue
    const nachricht = JSON.parse(zeile) as Record<string, unknown>

    const pickle = nachricht['pickle'] as
      | { id: string; name: string; uri: string; tags: Array<{ name: string }>; steps: Array<{ id: string; text: string; type?: string }> }
      | undefined
    if (pickle) {
      lauf.szenarien.set(pickle.id, {
        name: pickle.name,
        datei: pickle.uri,
        tags: pickle.tags.map((tag) => tag.name),
        schritte: pickle.steps.map((schritt) => ({
          id: schritt.id,
          text: schritt.text,
          typ: (schritt.type ?? 'Unknown') as Schritt['typ'],
        })),
      })
      continue
    }

    const testCase = nachricht['testCase'] as { id: string; pickleId: string } | undefined
    if (testCase) {
      lauf.faelle.set(testCase.id, testCase.pickleId)
      continue
    }

    const gestartet = nachricht['testCaseStarted'] as { id: string; testCaseId: string } | undefined
    if (gestartet) {
      lauf.laeufe.set(gestartet.id, gestartet.testCaseId)
      lauf.schrittzustaende.set(gestartet.id, [])
      continue
    }

    const schrittFertig = nachricht['testStepFinished'] as
      | { testCaseStartedId: string; testStepResult: { status: string } }
      | undefined
    if (schrittFertig) {
      const zustaende = lauf.schrittzustaende.get(schrittFertig.testCaseStartedId)
      if (zustaende) zustaende.push(schrittFertig.testStepResult.status as Zustand)
    }
  }

  return lauf
}

function schlechtester(zustaende: readonly Zustand[]): Zustand {
  for (const zustand of RANG) if (zustaende.includes(zustand)) return zustand
  return 'UNKNOWN'
}

type Zaehler = Partial<Record<Zustand, number>> & { gesamt: number }

function zaehle(): Zaehler {
  return { gesamt: 0 }
}

function addiere(zaehler: Zaehler, zustand: Zustand): void {
  zaehler.gesamt += 1
  zaehler[zustand] = (zaehler[zustand] ?? 0) + 1
}

function spalte(zaehler: Zaehler, zustand: Zustand): string {
  return String(zaehler[zustand] ?? 0)
}

interface Auswertung {
  gesamt: Zaehler
  jePruefung: Map<string, Zaehler>
  jeDatei: Map<string, Zaehler>
  ohnePruefung: Zaehler
  schrittzahlen: { kontext: number; ausloeser: number; zusicherung: number }
  sachverhalte: Map<string, number>
  ausloeserarten: Map<string, number>
  erwartungsarten: Map<string, number>
  auswertbareZusicherungen: number
}

function hochzaehlen(karte: Map<string, number>, schluessel: string): void {
  karte.set(schluessel, (karte.get(schluessel) ?? 0) + 1)
}

function auswerten(lauf: Lauf): Auswertung {
  const a: Auswertung = {
    gesamt: zaehle(),
    jePruefung: new Map(ALLE_PRUEFUNGEN.map((p) => [p, zaehle()])),
    jeDatei: new Map(),
    ohnePruefung: zaehle(),
    schrittzahlen: { kontext: 0, ausloeser: 0, zusicherung: 0 },
    sachverhalte: new Map(),
    ausloeserarten: new Map(),
    erwartungsarten: new Map(),
    auswertbareZusicherungen: 0,
  }

  for (const [laufId, testCaseId] of lauf.laeufe) {
    const pickleId = lauf.faelle.get(testCaseId)
    const szenario = pickleId === undefined ? undefined : lauf.szenarien.get(pickleId)
    if (!szenario) continue

    const zustand = schlechtester(lauf.schrittzustaende.get(laufId) ?? [])
    addiere(a.gesamt, zustand)

    const pruefungen = pruefungenAusTags(szenario.tags)
    if (pruefungen.length === 0) addiere(a.ohnePruefung, zustand)
    for (const pruefung of pruefungen) {
      const zaehler = a.jePruefung.get(pruefung)
      if (zaehler) addiere(zaehler, zustand)
    }

    const datei = szenario.datei.replace(/^tests\/aueg\//, '')
    let jeDatei = a.jeDatei.get(datei)
    if (!jeDatei) {
      jeDatei = zaehle()
      a.jeDatei.set(datei, jeDatei)
    }
    addiere(jeDatei, zustand)

    for (const schritt of szenario.schritte) {
      switch (schritt.typ) {
        case 'Context':
          a.schrittzahlen.kontext += 1
          hochzaehlen(a.sachverhalte, erfasseSachverhalt(schritt.text).art)
          break
        case 'Action':
          a.schrittzahlen.ausloeser += 1
          hochzaehlen(a.ausloeserarten, erfasseAusloeser(schritt.text).art)
          break
        case 'Outcome': {
          a.schrittzahlen.zusicherung += 1
          const erwartung = erfasseErwartung(schritt.text)
          hochzaehlen(a.erwartungsarten, erwartung.art)
          if (istAuswertbar(erwartung.art)) a.auswertbareZusicherungen += 1
          break
        }
        default:
          break
      }
    }
  }

  return a
}

function sortiert(karte: Map<string, number>): Array<[string, number]> {
  return [...karte.entries()].sort((links, rechts) => rechts[1] - links[1])
}

function schreibeBericht(a: Auswertung): string {
  const zeilen: string[] = []
  const anteil = (teil: number, ganzes: number): string =>
    ganzes === 0 ? '—' : `${Math.round((teil / ganzes) * 100)} %`

  zeilen.push('# AÜG-Suite: Stand des Regelwerks')
  zeilen.push('')
  zeilen.push(
    'Erzeugt aus dem letzten Lauf von `npm run test:aueg`. Grundlage sind die vier',
    'Feature-Dateien in `tests/aueg/` — die ausführbare Fassung von SPEC Kapitel 5.',
  )
  zeilen.push('')

  zeilen.push('## Szenarien')
  zeilen.push('')
  zeilen.push('| Zustand | Szenarien | Anteil |')
  zeilen.push('|---|---:|---:|')
  for (const zustand of RANG) {
    const anzahl = a.gesamt[zustand] ?? 0
    if (anzahl === 0) continue
    zeilen.push(`| ${DEUTSCH[zustand]} | ${anzahl} | ${anteil(anzahl, a.gesamt.gesamt)} |`)
  }
  zeilen.push(`| **gesamt** | **${a.gesamt.gesamt}** | |`)
  zeilen.push('')

  zeilen.push('## Je Prüfung')
  zeilen.push('')
  zeilen.push(
    'Ein Szenario mit mehreren `@pN`-Tags zählt in jeder genannten Prüfung;',
    'die Spaltensummen sind deshalb größer als die Zahl der Szenarien.',
  )
  zeilen.push('')
  zeilen.push('| Prüfung | Regel | Szenarien | grün | rot | ausstehend |')
  zeilen.push('|---|---|---:|---:|---:|---:|')
  for (const pruefung of ALLE_PRUEFUNGEN) {
    const zaehler = a.jePruefung.get(pruefung) ?? zaehle()
    zeilen.push(
      `| ${pruefung} | ${PRUEFUNGSNAMEN[pruefung]} | ${zaehler.gesamt} | ` +
        `${spalte(zaehler, 'PASSED')} | ${spalte(zaehler, 'FAILED')} | ${spalte(zaehler, 'PENDING')} |`,
    )
  }
  zeilen.push(
    `| — | ohne Prüfungszuordnung (Fristen, Protokoll, Nachweisfluss) | ${a.ohnePruefung.gesamt} | ` +
      `${spalte(a.ohnePruefung, 'PASSED')} | ${spalte(a.ohnePruefung, 'FAILED')} | ${spalte(a.ohnePruefung, 'PENDING')} |`,
  )
  zeilen.push('')

  zeilen.push('## Je Feature-Datei')
  zeilen.push('')
  zeilen.push('| Datei | Szenarien | grün | rot | ausstehend |')
  zeilen.push('|---|---:|---:|---:|---:|')
  for (const [datei, zaehler] of [...a.jeDatei.entries()].sort()) {
    zeilen.push(
      `| \`${datei}\` | ${zaehler.gesamt} | ${spalte(zaehler, 'PASSED')} | ` +
        `${spalte(zaehler, 'FAILED')} | ${spalte(zaehler, 'PENDING')} |`,
    )
  }
  zeilen.push('')

  zeilen.push('## Wie weit der Runner die Szenarien strukturiert liest')
  zeilen.push('')
  zeilen.push(
    'Das ist **nicht** der Stand des Regelwerks. Es sagt nur, wie viele Sätze der',
    'Runner als Sachverhalt, Auslöser oder auswertbare Zusicherung erkennt — also',
    'wie viel Vorarbeit die Fachlogik vorfindet.',
  )
  zeilen.push('')
  const sonstige = a.sachverhalte.get('sonstiges') ?? 0
  const erkannt = a.schrittzahlen.kontext - sonstige
  zeilen.push(
    `- Vorbedingungen: ${a.schrittzahlen.kontext}, davon ${erkannt} einer Sachverhaltsart ` +
      `zugeordnet (${anteil(erkannt, a.schrittzahlen.kontext)}), ${sonstige} als \`sonstiges\``,
  )
  zeilen.push(
    `- Auslöser: ${a.schrittzahlen.ausloeser}, alle strukturiert gelesen ` +
      '(Art, Rolle, Objektart, Zielstatus, Stichtag)',
  )
  zeilen.push(
    `- Zusicherungen: ${a.schrittzahlen.zusicherung}, davon ${a.auswertbareZusicherungen} ` +
      `maschinell auswertbar (${anteil(a.auswertbareZusicherungen, a.schrittzahlen.zusicherung)}), ` +
      'der Rest sind fachliche Feststellungen in Prosa',
  )
  zeilen.push('')

  zeilen.push('### Vorbedingungen nach Sachverhaltsart')
  zeilen.push('')
  zeilen.push('| Art | Sätze |')
  zeilen.push('|---|---:|')
  for (const [art, anzahl] of sortiert(a.sachverhalte)) zeilen.push(`| ${art} | ${anzahl} |`)
  zeilen.push('')

  zeilen.push('### Auslöser nach Art')
  zeilen.push('')
  zeilen.push('| Art | Sätze |')
  zeilen.push('|---|---:|')
  for (const [art, anzahl] of sortiert(a.ausloeserarten)) zeilen.push(`| ${art} | ${anzahl} |`)
  zeilen.push('')

  zeilen.push('### Zusicherungen nach Art')
  zeilen.push('')
  zeilen.push('| Art | Sätze | auswertbar |')
  zeilen.push('|---|---:|---|')
  for (const [art, anzahl] of sortiert(a.erwartungsarten)) {
    zeilen.push(`| ${art} | ${anzahl} | ${istAuswertbar(art as never) ? 'ja' : 'nein'} |`)
  }
  zeilen.push('')

  return zeilen.join('\n')
}

function kurzfassung(a: Auswertung): string {
  const zeilen: string[] = []
  zeilen.push('')
  zeilen.push('AÜG-Suite — Stand des Regelwerks (SPEC Kapitel 5)')
  zeilen.push('─'.repeat(64))
  const teile = RANG.filter((zustand) => (a.gesamt[zustand] ?? 0) > 0).map(
    (zustand) => `${a.gesamt[zustand]} ${DEUTSCH[zustand]}`,
  )
  zeilen.push(`${a.gesamt.gesamt} Szenarien: ${teile.join(', ')}`)
  zeilen.push('')
  zeilen.push('Prüfung  grün   rot  ausstehend  Szenarien  Regel')
  for (const pruefung of ALLE_PRUEFUNGEN) {
    const z = a.jePruefung.get(pruefung) ?? zaehle()
    zeilen.push(
      `${pruefung.padEnd(7)} ${spalte(z, 'PASSED').padStart(4)} ${spalte(z, 'FAILED').padStart(5)} ` +
        `${spalte(z, 'PENDING').padStart(11)} ${String(z.gesamt).padStart(10)}  ${PRUEFUNGSNAMEN[pruefung]}`,
    )
  }
  const o = a.ohnePruefung
  zeilen.push(
    `${'—'.padEnd(7)} ${spalte(o, 'PASSED').padStart(4)} ${spalte(o, 'FAILED').padStart(5)} ` +
      `${spalte(o, 'PENDING').padStart(11)} ${String(o.gesamt).padStart(10)}  ohne Prüfungszuordnung`,
  )
  zeilen.push('')
  zeilen.push(`Ausführlich: ${AUSGABE}`)
  zeilen.push('')
  return zeilen.join('\n')
}

function main(): void {
  const pfad = resolve(process.cwd(), STROM)
  if (!existsSync(pfad)) {
    console.error(
      `Kein Nachrichtenstrom unter ${STROM}. Erst "npm run test:aueg" laufen lassen.`,
    )
    process.exitCode = 1
    return
  }

  const auswertung = auswerten(leseStrom(pfad))
  const ziel = resolve(process.cwd(), AUSGABE)
  mkdirSync(dirname(ziel), { recursive: true })
  writeFileSync(ziel, `${schreibeBericht(auswertung)}\n`, 'utf8')
  process.stdout.write(kurzfassung(auswertung))
}

main()
