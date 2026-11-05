/**
 * P11 — Arbeitsverhältnis beim Verleiher (`employmentRelationshipCheck`),
 * SPEC 5.3.4.
 *
 * **Die Regel in Worten.** Arbeitnehmerüberlassung setzt voraus, dass der
 * Verleiher **Arbeitgeber** des überlassenen Arbeitnehmers ist
 * (§ 1 Abs. 1 Satz 1 AÜG). Ohne Arbeitsverhältnis beim Verleiher gibt es keine
 * Überlassung, sondern eine Arbeitsvermittlung oder einen anderen Sachverhalt.
 *
 * **Der Prüfzeitpunkt ist der erste Überlassungstag, nicht früher.** Das ist
 * der Grund, aus dem 5.5.5 die Ergebnisarten der Zeilen Q13 und Q17 von Sperre
 * auf Warnung ändert und die Sperre in der neuen Zeile Q47 an den Einsatzstart
 * setzt: ein Kandidat in `applicant` darf vorgeschlagen und zugesagt werden —
 * der Arbeitsvertrag wird in der Branche regelmäßig **für** den Einsatz
 * geschlossen. Eine Sperre bei der Zusage oder bei der Einsatzplanung würde den
 * Regelfall unmöglich machen, ohne eine einzige unzulässige Überlassung zu
 * verhindern.
 *
 * **Der Rechenweg** (5.3.4):
 *
 *  1. Vorprüfung (Q09, Q13, Q17): `employed` mit `employedSince` ≤ erster
 *     Überlassungstag → Information; `employed` mit späterem Beginn →
 *     Warnung; `applicant` → Warnung mit Nennung der Folge.
 *  2. Am Einsatzstart (Q47), Stichtag `actualStartDate`: `employed` mit
 *     `employedSince` ≤ Stichtag → Information, sonst **Sperre**.
 *
 * Grenzfälle: `employedSince` = erster Überlassungstag genügt — das
 * Arbeitsverhältnis muss am ersten Tag **bestehen**, nicht vorher begonnen
 * haben. Ein Kandidat in `inactive` wird wie ein Bewerber behandelt. Bei einem
 * Lieferantenwechsel prüft P11 den Kandidatensatz des **neuen** Verleihers.
 * Die Personenidentität ist ohne Belang: P11 ist eine Eigenschaft des
 * Kandidatensatzes, nicht der Person über Lieferanten hinweg. Fehlt eine
 * Angabe, wirkt das wie ein Treffer (5.0).
 *
 * Dieses Modul ist **rein**; die Ergebnisart wählt `pruefwerk.ts` anhand von
 * 4.7 (5.5.1 a).
 */

import { istVorOderGleich, type Tag } from '../kalender'
import { REGELWERK, type Regelwerkkonfiguration } from '../regelwerk'
import type { Rollenkuerzel } from '../typen'

/** `candidate.employmentStatusWithSupplier` (SPEC 3.6, E18) und 3.6 `inactive`. */
export type Beschaeftigungsstatus = 'employed' | 'applicant' | 'inactive'

export interface Beschaeftigungslage {
  readonly person: string
  /** Der Verleiher, dessen Kandidatensatz geprüft wird (3.6). */
  readonly lieferant: string | null
  /** `employmentStatusWithSupplier`; `null` heißt: nicht erfasst. */
  readonly status: Beschaeftigungsstatus | null
  /** `employedSince` (E19, Pflicht bei `employed`). */
  readonly beschaeftigtSeit: Tag | null
  /** Erster Überlassungstag: `actualStartDate`, ersatzweise `plannedStartDate` (E20). */
  readonly ersterUeberlassungstag: Tag | null
  /**
   * Ob am **Einsatzstart** geprüft wird (Q47) oder in der Vorprüfung
   * (Q09, Q13, Q17). Der Unterschied entscheidet nicht über den Treffer,
   * sondern über seine Wirkung — und die steht in 4.7.
   */
  readonly amEinsatzstart: boolean
}

/** Warum P11 anspricht (SPEC 5.3.4). */
export type Arbeitsverhaeltnismangel =
  /** `employmentStatusWithSupplier` ist nicht erfasst — wirkt wie ein Treffer (5.0). */
  | 'statusFehlt'
  /** `employed`, aber `employedSince` fehlt — Pflicht nach 3.6. */
  | 'beschaeftigungsdatumFehlt'
  /** `applicant`: noch kein Arbeitsverhältnis. */
  | 'nurBewerber'
  /** `inactive`: darf nicht überlassen werden, behandelt wie `applicant`. */
  | 'inaktiv'
  /** Das Arbeitsverhältnis beginnt nach dem ersten Überlassungstag. */
  | 'beginntZuSpaet'

export interface Arbeitsverhaeltnisergebnis {
  readonly bestehtAmErstenTag: boolean
  readonly status: Beschaeftigungsstatus | null
  readonly beschaeftigtSeit: Tag | null
  readonly ersterUeberlassungstag: Tag | null
  readonly lieferant: string | null
  readonly mangel: Arbeitsverhaeltnismangel | null
  readonly fehlendeFelder: readonly string[]
  readonly vermerke: readonly string[]
  readonly adressaten: readonly Rollenkuerzel[]
  readonly meldung: string
}

/** P11 — das Arbeitsverhältnis beim Verleiher prüfen (SPEC 5.3.4). */
export function pruefeArbeitsverhaeltnis(
  lage: Beschaeftigungslage,
  konfiguration: Regelwerkkonfiguration = REGELWERK,
): Arbeitsverhaeltnisergebnis {
  const mangel = bestimmeMangel(lage)
  const vermerke: string[] = []

  if (lage.status === 'inactive') {
    vermerke.push(
      'der Kandidat steht beim Lieferanten in `inactive` und wird wie ein Bewerber behandelt ' +
        '(SPEC 5.3.4, Grenzfall)',
    )
  }
  if (!lage.amEinsatzstart && mangel !== null) {
    vermerke.push(
      'bis zum Einsatzstart ist ein Arbeitsverhältnis nachzuweisen, sonst greift die Sperre aus ' +
        'Zeile Q47 (SPEC 5.3.4, 5.5.5)',
    )
  }

  return {
    bestehtAmErstenTag: mangel === null,
    status: lage.status,
    beschaeftigtSeit: lage.beschaeftigtSeit,
    ersterUeberlassungstag: lage.ersterUeberlassungstag,
    lieferant: lage.lieferant,
    mangel,
    fehlendeFelder: fehlendeFelderVon(mangel),
    vermerke,
    adressaten:
      mangel === null ? ['MD'] : konfiguration.adressatenArbeitsverhaeltnis,
    meldung: meldung(mangel, lage),
  }
}

/* ------------------------------------------------------------------ */

function bestimmeMangel(lage: Beschaeftigungslage): Arbeitsverhaeltnismangel | null {
  // 5.3.4, „Fehlende Angaben": `employmentStatusWithSupplier` ist in 3.6
  // Pflicht. Fehlt sie, wirkt das wie ein Treffer (5.0) — kein Freibrief.
  if (lage.status === null) return 'statusFehlt'
  if (lage.status === 'applicant') return 'nurBewerber'
  if (lage.status === 'inactive') return 'inaktiv'
  if (lage.beschaeftigtSeit === null) return 'beschaeftigungsdatumFehlt'
  // Ohne ersten Überlassungstag ist der Vergleich nicht möglich; das
  // Arbeitsverhältnis besteht aber und ist erfasst. Dann ist nichts zu
  // beanstanden — der Prüfzeitpunkt kommt mit dem Einsatz (5.3.4).
  if (lage.ersterUeberlassungstag === null) return null
  // „`employedSince` = `actualStartDate` genügt": das Arbeitsverhältnis muss am
  // ersten Überlassungstag bestehen, nicht vorher begonnen haben (5.3.4).
  return istVorOderGleich(lage.beschaeftigtSeit, lage.ersterUeberlassungstag)
    ? null
    : 'beginntZuSpaet'
}

function fehlendeFelderVon(mangel: Arbeitsverhaeltnismangel | null): readonly string[] {
  switch (mangel) {
    case 'statusFehlt':
      return ['employmentStatusWithSupplier']
    case 'beschaeftigungsdatumFehlt':
      return ['employedSince']
    default:
      return []
  }
}

function meldung(mangel: Arbeitsverhaeltnismangel | null, lage: Beschaeftigungslage): string {
  const beim = lage.lieferant === null ? 'beim Verleiher' : `bei "${lage.lieferant}"`
  const tag = lage.ersterUeberlassungstag ?? 'nicht genannt'

  if (mangel === null) {
    return (
      `P11: Das Arbeitsverhältnis ${beim} besteht am ersten Überlassungstag — beschäftigt seit ` +
      `${lage.beschaeftigtSeit ?? '—'}, erster Überlassungstag ${tag} ` +
      '(§ 1 Abs. 1 Satz 1 AÜG, SPEC 5.3.4).'
    )
  }

  const folge = lage.amEinsatzstart
    ? 'Ohne Arbeitsverhältnis am ersten Überlassungstag gibt es keine Überlassung; der Übergang ' +
      'ist gesperrt (SPEC 5.3.4, Zeile Q47). Der offene Weg ist der Nachweis des ' +
      'Arbeitsvertrags.'
    : 'Bis zum Einsatzstart ist ein Arbeitsverhältnis nachzuweisen, sonst greift die Sperre aus ' +
      'Zeile Q47. Vorschlag und Zusage sind zulässig — der Arbeitsvertrag wird in der Branche ' +
      'regelmäßig für den Einsatz geschlossen (SPEC 5.3.4, 5.5.5).'

  switch (mangel) {
    case 'statusFehlt':
      return (
        `P11: Am Kandidaten ist kein Beschäftigungsverhältnis ${beim} erfasst; das fehlende Feld ` +
        `ist "employmentStatusWithSupplier". Eine fehlende Angabe wirkt wie ein Treffer, nicht ` +
        `wie ein Freibrief (SPEC 5.0, 5.3.4). ${folge}`
      )
    case 'beschaeftigungsdatumFehlt':
      return (
        `P11: Der Kandidat ist ${beim} als beschäftigt geführt, aber "employedSince" fehlt — in ` +
        `3.6 Pflicht bei \`employed\`. Die fehlende Angabe wirkt wie ein Treffer (SPEC 5.0). ` +
        `${folge}`
      )
    case 'nurBewerber':
      return (
        `P11: Der Kandidat ist ${beim} Bewerber (\`applicant\`) und noch nicht beschäftigt; am ` +
        `ersten Überlassungstag ${tag} besteht damit kein Arbeitsverhältnis. ${folge}`
      )
    case 'inaktiv':
      return (
        `P11: Der Kandidat steht ${beim} in \`inactive\` und darf nicht überlassen werden; er ` +
        `wird wie ein Bewerber behandelt (SPEC 5.3.4, Grenzfall). ${folge}`
      )
    default:
      return (
        `P11: Das Arbeitsverhältnis ${beim} beginnt am ${lage.beschaeftigtSeit ?? '—'} und damit ` +
        `**nach** dem vorgesehenen Überlassungsbeginn ${tag} (§ 1 Abs. 1 Satz 1 AÜG). ${folge}`
      )
  }
}
