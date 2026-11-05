/**
 * P5 — Branchenzuschlag (`industryPremiumCheck`), SPEC 5.2.5.
 *
 * **Was P5 prüft.** Ob ein **Branchenzuschlagsschema** zugeordnet ist, ob die
 * Einsatzbranche bestimmbar ist und — am Abrechnungsbeleg — ob die abgerechneten
 * Zuschlagsarten zur ermittelten Stufe passen. Geprüft wird die **Zuordnung**,
 * nicht die Höhe: die Höhe steht in der Preisposition (3.3) und ist
 * kaufmännisch vereinbart.
 *
 * **Keine Zahl aus einem Tarifvertrag.** 5.2.5 sagt es ausdrücklich: „P5 nennt
 * keine Prozentsätze, keine Stufengrenzen und keine Branchenzuordnung. Sie alle
 * sind Konfiguration (3.3, Entscheidung zu Frage 3)." Dieses Modul hält sich
 * daran. Die Stufenfolge erreicht es als **Eingangsdatum** am Schema; ist keine
 * hinterlegt, bleibt die Stufe `null` — und zwar sichtbar, mit Vermerk. Eine
 * erfundene Stufenfolge wäre ein Tarifwert im Code (CLAUDE.md).
 *
 * **Warum eine fehlende Branche warnt, ein fehlendes Schema aber nicht.** Ohne
 * Schema gibt es keinen Branchenzuschlag — das ist ein Ergebnis, kein Mangel
 * (Information, Q19 und Q40). Ist das Schema zugeordnet, die **Branche** aber
 * nicht bestimmbar, wirkt die Lücke auf das geschuldete Entgelt: die Stufe
 * steuert den Zuschlag. Deshalb Warnung mit Nennung des fehlenden Feldes
 * (5.2.5, Schritt 2; 5.2.7).
 *
 * Dieses Modul ist **rein**. Die Ergebnisart wählt `pruefwerk.ts` anhand der
 * Querschnittstabelle 4.7 (5.5.1 a).
 */

import { REGELWERK, type Regelwerkkonfiguration } from '../regelwerk'
import type { Rollenkuerzel } from '../typen'

/**
 * Eine Stufe der Stufenfolge — **Konfiguration am Schema** (3.3), kein Wert
 * dieses Moduls. `abTagen` ist die Zahl der Überlassungstage der Kette, ab der
 * die Stufe gilt; `bezeichnung` ist ihr Name im Tarifwerk.
 */
export interface Zuschlagsstufe {
  readonly abTagen: number
  readonly bezeichnung: string
}

/** Warum P5 anschlägt (SPEC 5.2.5, 5.2.7). */
export type Zuschlagsmangel =
  /** Einsatzbranche und damit die Stufe nicht bestimmbar (Schritt 2). */
  | 'brancheFehlt'
  /** Die abgerechneten Zuschlagsarten passen nicht zur Stufe (Schritt 4). */
  | 'positionenAbweichend'

/** Die Lage, gegen die P5 rechnet (SPEC 5.2.5, E9 und Kettendauer). */
export interface Zuschlagslage {
  /** E9 — `industryPremiumScheme` der Verleiherzuordnung; `null`: keines. */
  readonly schema: string | null
  /** Der Vorgang sagt ausdrücklich, dass kein Schema zugeordnet ist. */
  readonly schemaAusdruecklichOhne: boolean
  /**
   * Ist die Einsatzbranche bestimmbar (Schritt 2)? `null` heißt: der Vorgang
   * sagt nichts dazu. Dann wird sie als bestimmbar gelesen — die Grundlage
   * führt einen Standort, und 5.2.5 liest sie aus seiner Tarifzuordnung,
   * ersatzweise aus `customer.industrySector` (3.1). Ein Vorgang, der die
   * Lücke meint, sagt sie ausdrücklich.
   */
  readonly brancheBestimmbar: boolean | null
  /** Überlassungstage der Kette nach 5.1.3 — Eingangsgröße der Stufe. */
  readonly ueberlassungstage: number | null
  /** Am Beleg: die abgerechneten Zuschlagsarten weichen von der Stufe ab. */
  readonly positionenAbweichend: boolean
  /** Die Stufenfolge des Schemas (3.3). Fehlt sie, bleibt die Stufe offen. */
  readonly stufenfolge?: readonly Zuschlagsstufe[]
}

export interface Zuschlagsergebnis {
  readonly schema: string | null
  /** Ein Branchenzuschlag ist überhaupt anwendbar (Schritt 1). */
  readonly anwendbar: boolean
  readonly brancheBestimmbar: boolean
  readonly ueberlassungstage: number | null
  /** Die ermittelte Stufe — **nicht** der Betrag (Schritt 3). */
  readonly stufe: string | null
  /** Die Stufe ließ sich bestimmen. */
  readonly stufeBestimmbar: boolean
  readonly positionenAbweichend: boolean
  readonly treffer: boolean
  readonly mangel: Zuschlagsmangel | null
  readonly vermerke: readonly string[]
  readonly adressaten: readonly Rollenkuerzel[]
  readonly meldung: string
}

/** P5 — den Branchenzuschlag prüfen (SPEC 5.2.5). */
export function pruefeBranchenzuschlag(
  lage: Zuschlagslage,
  konfiguration: Regelwerkkonfiguration = REGELWERK,
): Zuschlagsergebnis {
  // Schritt 1: Schema bestimmen. Fehlt es, ist kein Branchenzuschlag anwendbar.
  const anwendbar = lage.schema !== null
  // Schritt 2: Einsatzbranche bestimmen.
  const brancheBestimmbar = lage.brancheBestimmbar ?? true
  // Schritt 3: Stufe bestimmen. Die Stufenfolge ist Konfiguration am Schema.
  const stufe = bestimmeStufe(lage, anwendbar, brancheBestimmbar)

  const vermerke: string[] = []
  if (anwendbar && brancheBestimmbar && lage.stufenfolge === undefined) {
    vermerke.push(
      'Stufenfolge des Schemas nicht hinterlegt — die Stufe ist Konfiguration am ' +
        '`industryPremiumScheme` (SPEC 3.3, 5.2.5)',
    )
  }

  const mangel: Zuschlagsmangel | null =
    anwendbar && !brancheBestimmbar
      ? 'brancheFehlt'
      : lage.positionenAbweichend
        ? 'positionenAbweichend'
        : null

  const ergebnis = {
    schema: lage.schema,
    anwendbar,
    brancheBestimmbar,
    ueberlassungstage: lage.ueberlassungstage,
    stufe,
    stufeBestimmbar: stufe !== null,
    positionenAbweichend: lage.positionenAbweichend,
    treffer: mangel !== null,
    mangel,
    vermerke,
  }

  return {
    ...ergebnis,
    adressaten: adressaten(ergebnis, konfiguration),
    meldung: meldung(ergebnis),
  }
}

/* ------------------------------------------------------------------ */
/* Schritte                                                            */
/* ------------------------------------------------------------------ */

/**
 * Schritt 3: die Stufe aus der Zahl der Überlassungstage der **Kette** — mit
 * derselben Anrechnungs- und Reset-Regel wie 5.1.3. Das Ergebnis ist die
 * Stufe, nicht der Betrag.
 *
 * Ohne hinterlegte Stufenfolge bleibt die Stufe offen. Das ist Absicht: eine
 * Stufengrenze zu erfinden hieße, einen Tarifwert in den Code zu schreiben.
 */
function bestimmeStufe(
  lage: Zuschlagslage,
  anwendbar: boolean,
  brancheBestimmbar: boolean,
): string | null {
  if (!anwendbar || !brancheBestimmbar) return null
  const folge = lage.stufenfolge
  if (folge === undefined || folge.length === 0) return null
  const tage = lage.ueberlassungstage
  if (tage === null) return null
  const erreicht = [...folge]
    .filter((stufe) => tage >= stufe.abTagen)
    .sort((a, b) => a.abTagen - b.abTagen)
  return erreicht[erreicht.length - 1]?.bezeichnung ?? null
}

type Zwischenergebnis = Omit<Zuschlagsergebnis, 'adressaten' | 'meldung'>

function adressaten(
  ergebnis: Zwischenergebnis,
  konfiguration: Regelwerkkonfiguration,
): readonly Rollenkuerzel[] {
  if (ergebnis.mangel === 'brancheFehlt') return konfiguration.adressatenZuschlagsstufe
  if (ergebnis.mangel === 'positionenAbweichend') {
    return konfiguration.adressatenZuschlagsstufe
  }
  return []
}

function meldung(ergebnis: Zwischenergebnis): string {
  const teile: string[] = []

  if (!ergebnis.anwendbar) {
    teile.push(
      'P5: Die am Stichtag gültige Zuordnung der Verleiherseite nennt kein ' +
        'Branchenzuschlagsschema; ein Branchenzuschlag ist nicht anwendbar (SPEC 5.2.5, ' +
        'Schritt 1).',
    )
    return teile.join(' ')
  }

  teile.push(`P5: Das Branchenzuschlagsschema „${ergebnis.schema ?? ''}" ist zugeordnet.`)

  if (!ergebnis.brancheBestimmbar) {
    teile.push(
      'Die Einsatzbranche ist nicht bestimmbar: am Standort ist keine Tarifzuordnung gültig ' +
        'und `customer.industrySector` ist nicht gepflegt (SPEC 3.1). Damit ist die ' +
        'Zuschlagsstufe nicht bestimmbar — und die Stufe wirkt auf das geschuldete Entgelt ' +
        '(5.2.5, Schritt 2; 5.2.7).',
    )
    return teile.join(' ')
  }

  if (ergebnis.ueberlassungstage !== null) {
    teile.push(
      `Eingangsgröße der Stufe sind die ${ergebnis.ueberlassungstage} Überlassungstage der ` +
        'Kette, mit derselben Anrechnungs- und Reset-Regel wie in SPEC 5.1.3.',
    )
  }

  teile.push(
    ergebnis.stufe === null
      ? 'Die Stufe selbst ist Konfiguration am Schema (SPEC 3.3) und hier nicht hinterlegt; ' +
          'genannt wird die Eingangsgröße, nicht ein erfundener Stufenwert.'
      : `Die ermittelte Zuschlagsstufe ist „${ergebnis.stufe}" — die Stufe, nicht der Betrag.`,
  )

  if (ergebnis.positionenAbweichend) {
    teile.push(
      'Am Beleg passen abgerechnete Zuschlagsarten nicht zur ermittelten Stufe. Geprüft wird ' +
        'die **Zuordnung** der Zuschlagsart, nicht die Höhe des Betrags: die Höhe steht in der ' +
        'Preisposition und ist kaufmännisch vereinbart (SPEC 5.2.5, Schritt 4).',
    )
  }

  if (ergebnis.vermerke.length > 0) {
    teile.push(`Vermerke: ${ergebnis.vermerke.join('; ')}.`)
  }
  return teile.join(' ')
}
