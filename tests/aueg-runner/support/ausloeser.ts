/**
 * Den Ausloeser eines Szenarios erfassen — den "Wenn"-Schritt.
 *
 * Der Ausloeser ist die Schnittstelle zur Fachlogik: SPEC 4.7 ordnet jedem
 * Uebergang die Pruefungen zu, die er ausloest, und SPEC 5.5.2 die Ergebnisart.
 * Alle 254 "Wenn"-Schritte der vier Feature-Dateien fallen in zehn Arten; die
 * werden hier vollstaendig strukturiert gelesen, weil der Prueefauftrag an die
 * Fachlogik daraus entsteht.
 */

import { leseWerte, type GeleseneWerte } from './werte'

export type AusloeserArt =
  /** Ein Statusuebergang wird vollzogen ("überführt", "setzt"). */
  | 'statusuebergang'
  /** Ein Statusuebergang wird versucht ("überführen will", "setzen will"). */
  | 'statusuebergangsversuch'
  /** Eine Sperre wird mit Pflichtbegruendung uebersteuert (SPEC 5.5.4). */
  | 'uebersteuerung'
  /** Eine Uebersteuerung wird versucht ("zu übersteuern versucht"). */
  | 'uebersteuerungsversuch'
  /** Eine Pruefung oder Berechnung wird angestossen ("rechnet", "prüft"). */
  | 'berechnung'
  /** Der naechtliche Lauf (SPEC 5.5.1). */
  | 'nachtlauf'
  /** Eine Berichtigung wird gespeichert (SPEC 5.5.3). */
  | 'berichtigung'
  /** Eine Frist ist verstrichen (SPEC 2.4). */
  | 'fristablauf'
  /** Stamm- oder Bewegungsdaten werden erfasst. */
  | 'erfassung'
  /** Eine Benachrichtigung geht heraus (SPEC 5.5.2 Nummer 6). */
  | 'benachrichtigung'

/** Objektarten aus SPEC Kapitel 3, soweit die Szenarien sie ansprechen. */
export type Objektart =
  | 'bedarfsanfrage'
  | 'einladung'
  | 'profilvorschlag'
  | 'einsatz'
  | 'verlaengerung'
  | 'stundenzettel'
  | 'beleg'
  | 'lieferant'
  | 'nachweis'
  | 'unbekannt'

export interface Ausloeser {
  art: AusloeserArt
  satz: string
  /** Handelnde Rolle, wie der Satz sie nennt (SPEC 2.1). */
  rolle: string | null
  /** Betroffene Objektart, soweit der Satz sie nennt. */
  objektart: Objektart
  /** Zielstatus eines Uebergangs, englisch wie im Datenmodell. */
  zielstatus: string | null
  /** Stichtag des Ausloesers, ISO — soweit der Satz ihn nennt (SPEC 5.0). */
  stichtag: string | null
  werte: GeleseneWerte
}

const ROLLEN: ReadonlyArray<readonly [RegExp, string]> = [
  [/MSP-Administrator, der nicht die sperrende Person ist/, 'MSP-Administrator (Vier-Augen-Prinzip)'],
  [/in Vertretung des MSP-Administrators/, 'Vertretung des MSP-Administrators'],
  [/dieselbe Person/, 'sperrende Person'],
  [/derselbe Lieferantenadministrator/, 'einstellender Lieferantenadministrator'],
  [/Rolle der letzten Freigabestufe/, 'letzte Freigabestufe'],
  [/MSP-Administrator/, 'MSP-Administrator'],
  [/MSP-Disponent/, 'MSP-Disponent'],
  [/Lieferantendisponent/, 'Lieferantendisponent'],
  [/Lieferantenadministrator/, 'Lieferantenadministrator'],
  [/Bedarfsträger/, 'Bedarfsträger'],
  [/Genehmiger/, 'Genehmiger'],
  [/Betreiber/, 'Betreiber'],
  [/Entleiher/, 'Entleiher'],
  [/das System/, 'System'],
]

const OBJEKTARTEN: ReadonlyArray<readonly [RegExp, Objektart]> = [
  [/Bedarfsanfrage/, 'bedarfsanfrage'],
  [/Einladung/, 'einladung'],
  [/Profilvorschlag/, 'profilvorschlag'],
  [/Verlängerung/, 'verlaengerung'],
  [/Stundenzettel/, 'stundenzettel'],
  [/\bBeleg\b/, 'beleg'],
  [/Lieferanten\b/, 'lieferant'],
  [/\bNachweis\b/, 'nachweis'],
  [/\bEinsatz(?:es|start)?\b/, 'einsatz'],
]

/** "überführen will", "setzen will", "erzeugen will" — ein Versuch, kein Vollzug. */
const VERSUCH = /\b(?:überführen|setzen|erzeugen|anerkennen|beibringen)\s+will\b/

/** Erfasst den "Wenn"-Schritt als Ausloeser. */
export function erfasseAusloeser(satz: string): Ausloeser {
  const werte = leseWerte(satz)
  return {
    art: bestimmeArt(satz),
    satz,
    rolle: bestimmeRolle(satz),
    objektart: bestimmeObjektart(satz),
    zielstatus: bestimmeZielstatus(satz),
    stichtag: bestimmeStichtag(satz, werte),
    werte,
  }
}

function bestimmeArt(satz: string): AusloeserArt {
  if (/nächtliche Lauf/.test(satz)) return 'nachtlauf'
  if (/zu übersteuern versucht/.test(satz)) return 'uebersteuerungsversuch'
  if (/übersteuert\b/.test(satz)) return 'uebersteuerung'
  if (/verstrichen ist/.test(satz)) return 'fristablauf'
  if (/(?:Berichtigung|Änderung|Nachtragung).*speichert/.test(satz)) return 'berichtigung'
  if (/(?:Anzeige erfasst|einstellt, dass|Nachweis beibringen will)/.test(satz)) return 'erfassung'
  if (/(?:Warnung aus der Prüfung|Warnschwelle .* erreicht wird)/.test(satz)) return 'benachrichtigung'
  if (VERSUCH.test(satz)) return 'statusuebergangsversuch'
  if (/(?:überführt|setzt|erzeugt)\b/.test(satz)) return 'statusuebergang'
  if (/(?:rechnet|prüft|bewertet|auswertet|läuft)\b/.test(satz)) return 'berechnung'
  return 'berechnung'
}

function bestimmeRolle(satz: string): string | null {
  for (const [muster, rolle] of ROLLEN) if (muster.test(satz)) return rolle
  return null
}

function bestimmeObjektart(satz: string): Objektart {
  for (const [muster, art] of OBJEKTARTEN) if (muster.test(satz)) return art
  return 'unbekannt'
}

function bestimmeZielstatus(satz: string): string | null {
  const treffer =
    /in den Status "([^"]+)"/.exec(satz) ??
    /den Status "([^"]+)" setz/.exec(satz) ??
    /(?:Nachweis|ihn) (?:mit Begründung )?auf "([^"]+)" setz/.exec(satz)
  return treffer?.[1] ?? null
}

function bestimmeStichtag(satz: string, werte: GeleseneWerte): string | null {
  // "zum Stichtag 15.01.2026", "am 14.06.2027", "am Einsatzstart 01.09.2026".
  if (/(?:zum Stichtag|\bam|zum ersten Wiederaufnahmetag|Einsatzstart)\s/.test(satz)) {
    return werte.datumsangaben[0] ?? null
  }
  return null
}
