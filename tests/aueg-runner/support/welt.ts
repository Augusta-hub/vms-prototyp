/**
 * Die Welt eines Szenarios: ein Fixture im Arbeitsspeicher.
 *
 * Warum keine Datenbank (Entscheidung dieser Arbeitseinheit):
 * Die Regeln aus SPEC Kapitel 5 rechnen auf einem Sachverhalt — Stichtag,
 * Ueberlassungskette, Fristwerte, Nachweislage — und schreiben nichts. Sie
 * brauchen keine Persistenz, keine Transaktion und kein SQL. Ein eigenes
 * Postgres-Schema je Lauf wuerde die Suite an die Migrationen binden, den Lauf
 * serialisieren und nichts beweisen, was ein Fixture nicht auch beweist.
 *
 * Die Entwicklungsdatenbank `vms_prototyp` wird dabei nicht beruehrt: dieser
 * Runner laedt keinen Prisma-Client, und `schritte.ts` entfernt vor dem ersten
 * Szenario die DATABASE_URL aus der Prozessumgebung — ein versehentlicher
 * Import kaeme damit nicht an die Datenbank (CLAUDE.md Regel 3).
 */

import { World, type IWorldOptions } from '@cucumber/cucumber'
import { erfasseAusloeser, type Ausloeser } from './ausloeser'
import { erfasseErwartung, type Erwartung } from './erwartung'
import { erfasseSachverhalt, type Sachverhalt } from './sachverhalt'
import {
  ladePruefwerk,
  meldungFehlendeFachlogik,
  pruefungenAusTags,
  type Befund,
  type Pruefung,
} from './pruefwerk'

export type Schrittart = 'Context' | 'Action' | 'Outcome' | 'Unknown'

export interface Szenariokopf {
  name: string
  tags: readonly string[]
  datei: string
}

export class AuegWelt extends World {
  szenario: Szenariokopf = { name: '', tags: [], datei: '' }
  /** Art des Schritts, den cucumber gerade ausfuehrt (aus BeforeStep). */
  schrittart: Schrittart = 'Unknown'
  /** Die Vorbedingungen des Szenarios, in Reihenfolge erfasst. */
  sachverhalte: Sachverhalt[] = []
  /** Der Ausloeser, sobald der "Wenn"-Schritt gelesen ist. */
  ausloeser: Ausloeser | null = null
  /** Die Erwartungen, soweit ausgefuehrt. */
  erwartungen: Erwartung[] = []
  /** Befunde der Fachlogik — leer, solange sie fehlt. */
  befunde: readonly Befund[] = []

  constructor(optionen: IWorldOptions) {
    super(optionen)
  }

  /** Die Pruefungen, die dieses Szenario laut Tags erwartet. */
  get erwartetePruefungen(): Pruefung[] {
    return pruefungenAusTags(this.szenario.tags)
  }

  /**
   * Ein Schritt. Die Art entscheidet, was er tun darf:
   * Vorbedingung erfassen, Ausloeser ausfuehren, Zusicherung pruefen.
   */
  schritt(satz: string): void | 'pending' {
    switch (this.schrittart) {
      case 'Context':
        this.sachverhalte.push(erfasseSachverhalt(satz))
        return
      case 'Action':
        return this.ausloeserAusfuehren(satz)
      case 'Outcome':
        return this.zusicherungPruefen(satz)
      default:
        throw new Error(
          `Schrittart nicht bestimmbar: "${satz}". ` +
            'Der Runner unterscheidet Vorbedingung, Auslöser und Zusicherung ' +
            'nach dem Gherkin-Schlüsselwort; hier fehlt es.',
        )
    }
  }

  /**
   * Den Ausloeser ausfuehren heisst: die Fachlogik rechnen lassen. Fehlt sie,
   * ist der Schritt ausstehend — nicht erfuellt.
   */
  private ausloeserAusfuehren(satz: string): void | 'pending' {
    const ausloeser = erfasseAusloeser(satz)
    this.ausloeser = ausloeser

    const pruefwerk = ladePruefwerk()
    if (pruefwerk === null) {
      this.attach(meldungFehlendeFachlogik(ausloeser, this.erwartetePruefungen), 'text/plain')
      return 'pending'
    }

    this.befunde = pruefwerk.pruefe({
      ausloeser,
      sachverhalte: this.sachverhalte,
      erwartetePruefungen: this.erwartetePruefungen,
      szenario: { name: this.szenario.name, tags: this.szenario.tags },
    })
  }

  /**
   * Eine Zusicherung pruefen. Ohne Befund gibt es nichts zu pruefen; mit
   * Befund wertet der Runner die Arten aus, die SPEC 5.5.2 strukturiert
   * vorgibt, und meldet die fachlichen Feststellungen in Prosa als ausstehend.
   */
  private zusicherungPruefen(satz: string): void | 'pending' {
    const erwartung = erfasseErwartung(satz)
    this.erwartungen.push(erwartung)

    if (this.befunde.length === 0) {
      this.attach(
        `Zusicherung nicht auswertbar, es liegt kein Befund vor: "${satz}"`,
        'text/plain',
      )
      return 'pending'
    }

    if (erwartung.art === 'ergebnisart' && erwartung.ergebnisart !== null) {
      return this.ergebnisartPruefen(erwartung)
    }

    // Die uebrigen Arten setzen Befundfelder voraus, die erst mit der
    // Fachlogik entstehen. Sie werden gemeldet, nicht geschluckt.
    this.attach(
      `Zusicherungsart "${erwartung.art}" ist noch nicht ausgewertet: "${satz}"`,
      'text/plain',
    )
    return 'pending'
  }

  private ergebnisartPruefen(erwartung: Erwartung): void | 'pending' {
    const erwartet = erwartung.ergebnisart
    if (erwartet === 'treffer') {
      // Ein "Treffer" ist je Pruefung eine Warnung oder eine Sperre (SPEC 5.5.2).
      const treffer = this.befunde.some((befund) => befund.ergebnisart !== 'information')
      if (!treffer) {
        throw new Error(
          `Erwartet war ein Treffer, die Befunde sind: ${this.befundeAlsText()} — "${erwartung.satz}"`,
        )
      }
      return
    }

    const passend = this.befunde.some((befund) => befund.ergebnisart === erwartet)
    if (!passend) {
      throw new Error(
        `Erwartete Ergebnisart "${erwartet}" kommt in den Befunden nicht vor: ` +
          `${this.befundeAlsText()} — "${erwartung.satz}"`,
      )
    }
  }

  private befundeAlsText(): string {
    return this.befunde.map((befund) => `${befund.pruefung}=${befund.ergebnisart}`).join(', ')
  }
}
