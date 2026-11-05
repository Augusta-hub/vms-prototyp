/**
 * P6 — Drehtürklausel (`revolvingDoorCheck`), SPEC 5.3.1.
 *
 * **Die Regel in Worten.** Die tarifliche Abweichung vom
 * Gleichstellungsgrundsatz (§ 8 Abs. 2 AÜG) gilt **nicht** für einen
 * Leiharbeitnehmer, der in den letzten sechs Monaten vor der Überlassung aus
 * einem Arbeitsverhältnis beim **Entleiher** oder bei einem Arbeitgeber
 * **desselben Konzerns** (§ 18 AktG) ausgeschieden ist (§ 8 Abs. 3 AÜG).
 *
 * **Die Rechtsfolge ist Equal Pay, nicht ein Einsatzverbot.** Das ist der
 * wichtigste Punkt dieser Regel: § 8 Abs. 3 untersagt die Überlassung nicht —
 * er nimmt dem Verleiher die Möglichkeit, tariflich nach unten abzuweichen.
 * Wer die Drehtür als Sperre modelliert, verhindert einen zulässigen Einsatz
 * und verschweigt gleichzeitig die Entgeltfolge, auf die es ankommt. Deshalb
 * ändert 5.5.5 die Ergebnisarten der Zeilen Q12 und Q15: Warnung bei Treffer,
 * Sperre **nur** bei fehlender Erklärung.
 *
 * **Der Rechenweg** (5.3.1, Schritte 1 bis 5):
 *
 *  1. Stichtag ist der vorgesehene erste Überlassungstag.
 *  2. Rückschaufenster: `fensterVon` = Stichtag − 6 Monate
 *     (§§ 187 Abs. 2, 188 Abs. 2 BGB) bis `fensterBis` = Stichtag − 1 Tag.
 *  3. Erklärung auswerten: fehlt sie → **nicht prüfbar**; „nein" → kein
 *     Treffer; „ja" mit Ende im Fenster → Treffer; „ja" mit Ende **vor**
 *     `fensterVon` → kein Treffer, aber Information mit Austrittsdatum, weil
 *     eine Verschiebung des Starttermins es wieder in das Fenster holen kann;
 *     „ja" ohne Datum → nicht prüfbar.
 *  4. Konzernbezug: der Treffer gilt auch für ein Unternehmen desselben
 *     Konzerns. Ist `corporateGroup` leer, wird nur der Entleiher selbst
 *     geprüft, mit Information an `MA`.
 *  5. Rechtsfolge: `equalPayDeadlineMonths` ist nicht anwendbar,
 *     `equalPayDueDate` = `chainStartDate` — Equal Pay ab dem ersten
 *     Überlassungstag, `comparableWage` ab dem ersten Tag Pflicht.
 *
 * **Grundlage ist die Erklärung des Kandidaten**
 * (`candidate.previousEmploymentDeclaration`, 3.6), nicht die Einsatzhistorie.
 * Eine Gegenprüfung gegen Personaldaten des Entleihers findet **nicht** statt:
 * der Entleiher kennt seine ehemaligen Beschäftigten, das VMS nicht. Die
 * Verantwortung für die Richtigkeit der Erklärung liegt beim Verleiher
 * (5.3.1). Die Personenidentität ist ohne Belang.
 *
 * Dieses Modul ist **rein**; die Ergebnisart wählt `pruefwerk.ts` anhand von
 * 4.7 (5.5.1 a).
 */

import { liegtImZeitraum, monatsversatz, tagVersetzt, type Tag } from '../kalender'
import { REGELWERK, type Regelwerkkonfiguration } from '../regelwerk'
import type { Rollenkuerzel } from '../typen'

/**
 * `candidate.previousEmploymentDeclaration` (SPEC 3.6, Inhalt abschließend in
 * 5.3.1): Bestand, Ende, Arbeitgeber, Datum der Erklärung.
 */
export interface Vorbeschaeftigung {
  /** Ob in den letzten sechs Monaten ein Arbeitsverhältnis bestand; `null` = Angabe fehlt. */
  readonly bestand: boolean | null
  /** Ende dieses Arbeitsverhältnisses. */
  readonly ende: Tag | null
  /** Der Arbeitgeber, bezogen auf den Entleiher oder dessen Konzern. */
  readonly arbeitgeber: string | null
  readonly erklaert: Tag | null
  /** Der Kandidatensatz, zu dem die Erklärung gehört (3.6). */
  readonly lieferant: string | null
}

export interface Drehtuerlage {
  readonly person: string
  /** `assignment.customerRef` bzw. `demandRequest.customerRef` (E15). */
  readonly entleiher: string
  /** `customer.corporateGroup` (E16); `null` heißt: nicht gepflegt. */
  readonly konzern: string | null
  /** Unternehmen, deren Zugehörigkeit zu diesem Konzern der Vorgang nennt. */
  readonly konzernunternehmen: readonly string[]
  /** Vorgesehener Überlassungsbeginn (E17) — der Stichtag. */
  readonly ueberlassungsbeginn: Tag | null
  /** Die Erklärung; `null` heißt: nicht erfasst. */
  readonly erklaerung: Vorbeschaeftigung | null
  /** Der Verleiher des geprüften Vorgangs — die Erklärung gilt je Kandidatensatz. */
  readonly lieferant: string | null
}

/** Warum P6 nicht prüfbar ist (SPEC 5.3.1, „Wenn Daten fehlen"). */
export type Drehtuermangel =
  /** `previousEmploymentDeclaration` fehlt. */
  | 'erklaerungFehlt'
  /** Erklärung „ja" ohne Ende — unvollständig. */
  | 'endeFehlt'
  /** Die vorliegende Erklärung gehört zum Kandidatensatz eines anderen Verleihers. */
  | 'erklaerungAnderenVerleihers'

export interface Drehtuerergebnis {
  readonly stichtag: Tag | null
  readonly fensterVon: Tag | null
  readonly fensterBis: Tag | null
  readonly treffer: boolean
  readonly pruefbar: boolean
  readonly austritt: Tag | null
  readonly arbeitgeber: string | null
  /** Ob der frühere Arbeitgeber der Entleiher, ein Konzernunternehmen oder ein Dritter ist. */
  readonly bezug: 'entleiher' | 'konzern' | 'dritter' | 'unbekannt' | 'keiner'
  readonly konzernGeprueft: boolean
  readonly mangel: Drehtuermangel | null
  readonly fehlendeFelder: readonly string[]
  /** Equal Pay ab dem ersten Überlassungstag (Schritt 5) — nur bei Treffer. */
  readonly equalPayAbErstemTag: boolean
  readonly vermerke: readonly string[]
  readonly adressaten: readonly Rollenkuerzel[]
  readonly meldung: string
}

/** P6 — die Drehtürklausel rechnen (SPEC 5.3.1). */
export function pruefeDrehtuer(
  lage: Drehtuerlage,
  konfiguration: Regelwerkkonfiguration = REGELWERK,
): Drehtuerergebnis {
  const stichtag = lage.ueberlassungsbeginn
  const fensterVon =
    stichtag === null ? null : monatsversatz(stichtag, -konfiguration.dauer.rueckschauMonate)
  const fensterBis = stichtag === null ? null : tagVersetzt(stichtag, -1)

  const vermerke: string[] = []
  const konzernGeprueft = lage.konzern !== null
  if (!konzernGeprueft) {
    vermerke.push(
      'die Konzernbetrachtung war nicht möglich: beim Entleiher ist kein Konzernverbund ' +
        'gepflegt, geprüft wurde nur der Entleiher selbst (SPEC 5.3.1, Schritt 4)',
    )
  }

  const mangel = pruefeErklaerung(lage)
  if (mangel !== null) {
    return {
      stichtag,
      fensterVon,
      fensterBis,
      treffer: false,
      pruefbar: false,
      austritt: lage.erklaerung?.ende ?? null,
      arbeitgeber: lage.erklaerung?.arbeitgeber ?? null,
      bezug: 'unbekannt',
      konzernGeprueft,
      mangel,
      fehlendeFelder: ['previousEmploymentDeclaration'],
      equalPayAbErstemTag: false,
      vermerke: [
        ...vermerke,
        // 5.3.1: `equalPayDueDate` wird **nicht** vorgezogen, solange die
        // Erklärung fehlt. Eine Entgeltfolge ohne Tatsachengrundlage zu setzen
        // wäre eine Annahme, und Annahmen trifft dieses Kapitel nicht.
        'die Equal-Pay-Fälligkeit wird nicht vorgezogen, solange die Erklärung fehlt',
      ],
      adressaten: konfiguration.adressatenErklaerungFehlt,
      meldung: meldungOhneGrundlage(mangel, lage),
    }
  }

  const erklaerung = lage.erklaerung as Vorbeschaeftigung
  const bezug = bezugVon(erklaerung, lage)
  const imFenster =
    erklaerung.ende !== null &&
    fensterVon !== null &&
    fensterBis !== null &&
    liegtImZeitraum(erklaerung.ende, fensterVon, fensterBis)
  const treffer =
    erklaerung.bestand === true && imFenster && bezug !== 'dritter' && bezug !== 'keiner'

  if (erklaerung.bestand === true && !imFenster && erklaerung.ende !== null) {
    // Die Angabe bleibt sichtbar: eine Verschiebung des Starttermins kann sie
    // wieder in das Fenster holen (5.3.1, Schritt 3).
    vermerke.push(
      `das Austrittsdatum ${erklaerung.ende} liegt außerhalb des Rückschaufensters; eine ` +
        'Verschiebung des Starttermins kann es wieder in das Fenster holen',
    )
  }
  if (treffer && bezug === 'konzern') {
    vermerke.push(
      `der frühere Arbeitgeber "${erklaerung.arbeitgeber ?? '—'}" gehört zum Konzern des ` +
        'Entleihers (§ 18 AktG)',
    )
  }

  return {
    stichtag,
    fensterVon,
    fensterBis,
    treffer,
    pruefbar: true,
    austritt: erklaerung.ende,
    arbeitgeber: erklaerung.arbeitgeber,
    bezug,
    konzernGeprueft,
    mangel: null,
    fehlendeFelder: [],
    equalPayAbErstemTag: treffer,
    vermerke,
    adressaten: treffer
      ? konfiguration.adressatenDrehtuer
      : konzernGeprueft
        ? ['MD']
        : [...new Set<Rollenkuerzel>([...konfiguration.adressatenKonzernUnbekannt, 'MD'])],
    meldung: meldung(treffer, erklaerung, lage, fensterVon, fensterBis, bezug),
  }
}

/* ------------------------------------------------------------------ */

function pruefeErklaerung(lage: Drehtuerlage): Drehtuermangel | null {
  const erklaerung = lage.erklaerung
  if (erklaerung === null) return 'erklaerungFehlt'
  // 5.3.1, Grenzfall „Lieferantenwechsel": die Erklärung ist eine Angabe des
  // Kandidaten gegenüber **seinem** Arbeitgeber, keine Eigenschaft der Person
  // im System. Für den neuen Kandidatensatz ist sie erneut einzuholen.
  if (
    erklaerung.lieferant !== null &&
    lage.lieferant !== null &&
    erklaerung.lieferant !== lage.lieferant
  ) {
    return 'erklaerungAnderenVerleihers'
  }
  if (erklaerung.bestand === null) return 'erklaerungFehlt'
  if (erklaerung.bestand && erklaerung.ende === null) return 'endeFehlt'
  return null
}

function bezugVon(
  erklaerung: Vorbeschaeftigung,
  lage: Drehtuerlage,
): Drehtuerergebnis['bezug'] {
  if (erklaerung.bestand !== true) return 'keiner'
  const arbeitgeber = erklaerung.arbeitgeber
  if (arbeitgeber === null) return 'unbekannt'
  if (arbeitgeber === lage.entleiher) return 'entleiher'
  if (lage.konzern !== null && lage.konzernunternehmen.includes(arbeitgeber)) return 'konzern'
  return 'dritter'
}

function meldungOhneGrundlage(mangel: Drehtuermangel, lage: Drehtuerlage): string {
  const grund =
    mangel === 'endeFehlt'
      ? 'Die Erklärung bejaht ein früheres Arbeitsverhältnis, nennt aber kein Ende — sie ist ' +
        'unvollständig.'
      : mangel === 'erklaerungAnderenVerleihers'
        ? `Die vorliegende Erklärung gehört zum Kandidatensatz bei ` +
          `"${lage.erklaerung?.lieferant ?? '—'}"; für den Kandidatensatz bei ` +
          `"${lage.lieferant ?? '—'}" ist eine eigene erforderlich (SPEC 5.3.1, Grenzfall ` +
          'Lieferantenwechsel).'
        : 'Für den Kandidaten ist keine Erklärung zur Vorbeschäftigung erfasst.'
  return (
    `P6: Die Drehtürklausel ist nicht prüfbar. ${grund} Das fehlende Feld ist ` +
    '"previousEmploymentDeclaration" am Kandidaten. Der Grund ist nicht die Drehtür, sondern die ' +
    'fehlende Tatsachengrundlage; der offene Weg ist, dass der Verleiher die Erklärung einholt ' +
    '(SPEC 5.3.1, „Wenn Daten fehlen"). Die Equal-Pay-Fälligkeit wird nicht vorgezogen.'
  )
}

function meldung(
  treffer: boolean,
  erklaerung: Vorbeschaeftigung,
  lage: Drehtuerlage,
  fensterVon: Tag | null,
  fensterBis: Tag | null,
  bezug: Drehtuerergebnis['bezug'],
): string {
  const fenster =
    fensterVon === null || fensterBis === null
      ? 'Das Rückschaufenster ist ohne vorgesehenen Überlassungsbeginn nicht bestimmbar.'
      : `Das Rückschaufenster reicht vom ${fensterVon} bis zum ${fensterBis} (sechs Monate vor ` +
        `dem Stichtag ${lage.ueberlassungsbeginn}).`

  if (treffer) {
    return (
      `P6: Die Drehtürklausel greift — das Arbeitsverhältnis bei ` +
      `"${erklaerung.arbeitgeber ?? '—'}" endete am ${erklaerung.ende} und liegt damit im ` +
      `Rückschaufenster${bezug === 'konzern' ? ' (Konzernunternehmen des Entleihers)' : ''}. ` +
      `${fenster} Rechtsfolge: die tarifliche Equal-Pay-Frist ist für diese Überlassung nicht ` +
      'anwendbar, die Equal-Pay-Fälligkeit rückt auf den Kettenbeginn — Equal Pay ab dem ersten ' +
      'Überlassungstag, und das Vergleichsentgelt ist ab dem ersten Tag Pflicht (SPEC 5.3.1, ' +
      'Schritt 5; § 8 Abs. 3 AÜG). Die Überlassung selbst ist zulässig; § 8 Abs. 3 untersagt sie ' +
      'nicht.'
    )
  }
  if (erklaerung.bestand === true) {
    return (
      `P6: Die Drehtürklausel greift nicht. ` +
      (bezug === 'dritter'
        ? `Der frühere Arbeitgeber "${erklaerung.arbeitgeber ?? '—'}" ist weder der Entleiher ` +
          'noch ein Unternehmen seines Konzerns. '
        : `Das Arbeitsverhältnis endete am ${erklaerung.ende} und damit vor dem ` +
          'Rückschaufenster. ') +
      `${fenster} Das Austrittsdatum bleibt sichtbar, weil eine Verschiebung des Starttermins es ` +
      'wieder in das Fenster holen kann (SPEC 5.3.1, Schritt 3).'
    )
  }
  return (
    `P6: Die Erklärung zur Vorbeschäftigung verneint ein Arbeitsverhältnis beim Entleiher und im ` +
    `Konzern — kein Treffer. ${fenster} Grundlage ist die Erklärung des Kandidaten; ein Abgleich ` +
    'gegen Personaldaten des Entleihers findet nicht statt (SPEC 5.3.1).'
  )
}
