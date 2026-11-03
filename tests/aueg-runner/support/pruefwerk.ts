/**
 * Die Schnittstelle zur AUEG-Fachlogik — und ihr Fehlen.
 *
 * Stand dieser Arbeitseinheit: die Fachlogik aus SPEC Kapitel 5 ist nicht
 * gebaut (Meilenstein M4). Dieses Modul beschreibt, was der Runner von ihr
 * erwartet, und sucht sie zur Laufzeit. Findet er sie nicht, meldet jeder
 * Ausloeser den Schritt als ausstehend (`pending`) — mit Nennung der
 * Pruefungen, die fehlen. Kein Szenario kann gruen werden, solange hier nichts
 * liegt; das ist Absicht.
 *
 * Sobald `lib/aueg/pruefwerk.ts` ein `pruefe` nach dem Vertrag unten
 * exportiert, laeuft die Suite ohne weitere Aenderung dagegen.
 */

import { createRequire } from 'node:module'
import type { Ausloeser } from './ausloeser'
import type { Sachverhalt } from './sachverhalt'

/** Die elf Pruefungen aus SPEC 5.1 bis 5.4. */
export type Pruefung =
  | 'P1'
  | 'P2'
  | 'P3'
  | 'P4'
  | 'P5'
  | 'P6'
  | 'P7'
  | 'P8'
  | 'P9'
  | 'P10'
  | 'P11'

export const ALLE_PRUEFUNGEN: readonly Pruefung[] = [
  'P1',
  'P2',
  'P3',
  'P4',
  'P5',
  'P6',
  'P7',
  'P8',
  'P9',
  'P10',
  'P11',
]

/** Namen der Pruefungen nach SPEC 5.1 bis 5.4, fuer den Bericht. */
export const PRUEFUNGSNAMEN: Readonly<Record<Pruefung, string>> = {
  P1: 'Höchstüberlassungsdauer (SPEC 5.1)',
  P2: 'Unterbrechung und Drei-Monats-Regel (SPEC 5.1)',
  P3: 'Equal-Pay-Fälligkeit (SPEC 5.2)',
  P4: 'Vergleichsentgelt (SPEC 5.2)',
  P5: 'Branchenzuschlagsschema (SPEC 5.2)',
  P6: 'Drehtürklausel (SPEC 5.3)',
  P7: 'Einsatzverbot bei Arbeitskampf (SPEC 5.3)',
  P8: 'Kennzeichnung und Konkretisierung (SPEC 5.3)',
  P9: 'AÜG-Erlaubnis (SPEC 5.4)',
  P10: 'Pflichtnachweise (SPEC 5.4)',
  P11: 'Arbeitsverhältnis beim Verleiher (SPEC 5.3)',
}

/** Ergebnisart einer Pruefung (SPEC 5.5.2). */
export type Ergebnisart = 'information' | 'warnung' | 'sperre'

/** Was der Runner der Fachlogik uebergibt. */
export interface Pruefauftrag {
  /** Der Ausloeser, strukturiert gelesen. */
  ausloeser: Ausloeser
  /** Die Vorbedingungen des Szenarios in Reihenfolge. */
  sachverhalte: readonly Sachverhalt[]
  /** Die Pruefungen, die das Szenario laut seinen Tags erwartet. */
  erwartetePruefungen: readonly Pruefung[]
  /** Name und Tags des Szenarios, zur Nachvollziehbarkeit im Protokoll. */
  szenario: { name: string; tags: readonly string[] }
}

/** Was die Fachlogik zurueckgibt. */
export interface Befund {
  pruefung: Pruefung
  ergebnisart: Ergebnisart
  /** Ob der Uebergang stattgefunden hat. Bei `sperre` immer false. */
  uebergangVollzogen: boolean
  /** Gerechnete Werte, Schluessel wie die abgeleiteten Felder in SPEC 5.1/5.2. */
  werte: Readonly<Record<string, string | number | null>>
  /** Adressaten der Meldung (SPEC 5.5.2 Nummer 6). */
  adressaten: readonly string[]
  /** Begruendung in Worten, fuer die Meldung am Vorgang. */
  meldung: string
}

/** Der Vertrag, den `lib/aueg/pruefwerk.ts` erfuellen muss. */
export interface Pruefwerk {
  pruefe(auftrag: Pruefauftrag): readonly Befund[]
}

/** Pfad des erwarteten Moduls, relativ zur Projektwurzel. */
export const PRUEFWERK_MODUL = 'lib/aueg/pruefwerk'

const erfordere = createRequire(__filename)

let gesucht = false
let gefunden: Pruefwerk | null = null

/**
 * Sucht die Fachlogik. Gibt `null` zurueck, solange sie fehlt — das ist der
 * Normalzustand bis Meilenstein M4.
 */
export function ladePruefwerk(): Pruefwerk | null {
  if (gesucht) return gefunden
  gesucht = true
  try {
    const modul: unknown = erfordere(`../../../${PRUEFWERK_MODUL}`)
    if (
      typeof modul === 'object' &&
      modul !== null &&
      typeof (modul as { pruefe?: unknown }).pruefe === 'function'
    ) {
      gefunden = modul as Pruefwerk
    }
  } catch {
    gefunden = null
  }
  return gefunden
}

/**
 * Die Meldung, mit der ein Ausloeser als ausstehend gilt. Sie benennt die
 * Pruefungen, die das Szenario erwartet, damit der Bericht und der Lauf
 * zeigen, welche Fachlogik der naechste Schritt ist.
 */
export function meldungFehlendeFachlogik(
  ausloeser: Ausloeser,
  erwartetePruefungen: readonly Pruefung[],
): string {
  const pruefungen =
    erwartetePruefungen.length > 0
      ? erwartetePruefungen.join(', ')
      : 'keine Prüfung über Tags zugeordnet'
  return [
    `AÜG-Fachlogik fehlt: ${PRUEFWERK_MODUL} exportiert kein pruefe().`,
    `Auslöser: ${ausloeser.art}${ausloeser.zielstatus ? ` nach "${ausloeser.zielstatus}"` : ''}`,
    `erwartete Prüfungen: ${pruefungen}`,
    'Das Szenario bleibt ausstehend, bis SPEC Kapitel 5 umgesetzt ist (M4).',
  ].join(' — ')
}

/** Liest die Pruefungen, die ein Szenario laut seinen Tags erwartet. */
export function pruefungenAusTags(tags: readonly string[]): Pruefung[] {
  const treffer: Pruefung[] = []
  for (const tag of tags) {
    const muster = /^@p(\d{1,2})$/.exec(tag)
    if (!muster) continue
    const name = `P${Number(muster[1])}` as Pruefung
    if (ALLE_PRUEFUNGEN.includes(name)) treffer.push(name)
  }
  return treffer
}
