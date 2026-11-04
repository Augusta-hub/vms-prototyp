/**
 * Die Begriffe des Regelwerks: Prüfung, Ergebnisart, Befund, Prüfauftrag.
 *
 * Diese Typen sind der **Vertrag** zwischen dem Regelwerk und dem, was es
 * aufruft. Die Gherkin-Suite in `tests/aueg/` ruft es über
 * `tests/aueg-runner/support/pruefwerk.ts` auf; die Typen dort und die hier
 * sind strukturell gleich. Sie werden hier **wiederholt** und nicht von dort
 * importiert: Anwendungscode darf nicht von einem Testverzeichnis abhängen.
 *
 * Die Eingangsseite (`Sachverhalt`, `Ausloeser`) ist absichtlich weit getypt —
 * `art` und `objektart` sind `string`, nicht die engen Vereinigungen des
 * Runners. Das Regelwerk liest aus einem Sachverhalt die **Daten**; die
 * Einordnung, die der Runner vornimmt, ist ein Hinweis, keine Vorgabe.
 */

/** Die elf Prüfungen aus SPEC 4.7, Abschnitt „Die geprüften Regeln". */
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

/** Die drei Ergebnisarten und ihre Wirkung (SPEC 4.7, bestätigt in 5.5.2). */
export type Ergebnisart = 'information' | 'warnung' | 'sperre'

/** Rangfolge der Ergebnisarten: `sperre` > `warnung` > `information` (5.5.2 Nr. 2). */
export const STRENGE: Readonly<Record<Ergebnisart, number>> = {
  information: 0,
  warnung: 1,
  sperre: 2,
}

/** Das strengste Ergebnis einer Menge von Einzelergebnissen (5.5.2 Nr. 2). */
export function strengstes(arten: readonly Ergebnisart[]): Ergebnisart {
  return arten.reduce<Ergebnisart>(
    (bisher, art) => (STRENGE[art] > STRENGE[bisher] ? art : bisher),
    'information',
  )
}

/** Werte, die ein Sachverhaltssatz trägt (gelesen vom Runner). */
export interface GeleseneWerte {
  /** Datumsangaben in Reihenfolge des Auftretens, ISO. */
  readonly datumsangaben: readonly string[]
  readonly zitate: readonly string[]
  readonly statuswerte: readonly string[]
  readonly mengen: readonly { readonly wert: number; readonly einheit: string }[]
  readonly pruefungen: readonly string[]
  readonly kriterien: readonly string[]
}

/** Eine Vorbedingung des Vorgangs, wie sie das Regelwerk erreicht. */
export interface Sachverhalt {
  readonly art: string
  readonly satz: string
  readonly werte: GeleseneWerte
}

/** Der Anlass, zu dem geprüft wird (SPEC 5.5.1). */
export interface Ausloeser {
  readonly art: string
  readonly satz: string
  readonly rolle: string | null
  readonly objektart: string
  readonly zielstatus: string | null
  readonly stichtag: string | null
  readonly werte: GeleseneWerte
}

/** Was das Regelwerk zum Prüfen bekommt. */
export interface Pruefauftrag {
  readonly ausloeser: Ausloeser
  readonly sachverhalte: readonly Sachverhalt[]
  /** Die Prüfungen, die der Vorgang erwartet. Nicht erwartete laufen nicht. */
  readonly erwartetePruefungen: readonly Pruefung[]
  readonly szenario: { readonly name: string; readonly tags: readonly string[] }
}

/**
 * Eine einzelne Feststellung. Jede nennt ihre Prüfung, ihren Gegenstand und
 * das fehlende oder verletzte Datum (5.5.2 Nr. 2) — ein Sammelergebnis „drei
 * Befunde" wäre nicht abarbeitbar.
 */
export interface Befund {
  readonly pruefung: Pruefung
  readonly ergebnisart: Ergebnisart
  /** Ob der Übergang stattgefunden hat. Bei `sperre` immer `false` (5.5.2). */
  readonly uebergangVollzogen: boolean
  /** Gerechnete Werte; Schlüssel wie die abgeleiteten Felder aus Kapitel 3. */
  readonly werte: Readonly<Record<string, string | number | null>>
  /** Adressaten als Rollenkürzel aus SPEC 2.2 (5.5.2 Nr. 6). */
  readonly adressaten: readonly string[]
  /** Begründung in Worten, für die Meldung am Vorgang. */
  readonly meldung: string
}

/** Rollenkürzel der Berechtigungsmatrix (SPEC 2.2). */
export type Rollenkuerzel = 'MA' | 'MD' | 'KB' | 'KG' | 'KE' | 'LD' | 'LA' | 'AN'
