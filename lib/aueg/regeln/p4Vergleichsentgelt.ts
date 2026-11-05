/**
 * P4 — Vergleichsentgelt (`comparableWageCheck`), SPEC 5.2.4.
 *
 * **Was P4 prüft.** Nicht, ob Equal Pay gezahlt wurde — das System führt kein
 * Entgelt des Leiharbeitnehmers (5.2.1). P4 prüft, ob das **Vergleichsentgelt**
 * vorliegt und verwendbar ist: der Eintrag des Standorts zur Tätigkeit des
 * Einsatzes (3.3) und der Wert am Einsatz selbst (3.7). Ohne diesen Wert kann
 * der Verleiher seine Pflicht aus § 8 Abs. 1 AÜG nicht erfüllen, und niemand
 * kann sie nachrechnen.
 *
 * **Zwei verschiedene Mängel**, die 5.2.4 bewusst trennt:
 *
 *  - **Der Eintrag des Standorts fehlt** (Schritt 2). Das ist ein Mangel der
 *    Stammdaten und besteht **unabhängig** davon, ob die Fälligkeit erreicht
 *    ist: der Entleiher pflegt den Eintrag (3.3), und ohne ihn ist am Tag der
 *    Fälligkeit nichts da. Die Meldung geht an `KE`.
 *  - **Der Wert am Einsatz fehlt** (Schritt 3). Das ist erst ab
 *    `equalPayDueDate` ein Mangel — vorher ist er nicht Pflicht (3.7).
 *
 * **Mehr als ein gültiger Eintrag ist kein Eintrag.** Die Eindeutigkeit aus 3.3
 * ist verletzt; es wird **nicht** einer ausgewählt (Schritt 2). Das ist keine
 * Härte, sondern die einzige vertretbare Lesart: wer einen von zwei
 * widersprechenden Entgeltwerten wählt, trifft eine Entgeltentscheidung.
 *
 * **`wageSource = estimate` ist verwendbar, aber kein Nachweis** (3.3, 5.2.4).
 * Eine Schätzung lässt den Übergang zu und bleibt sichtbar, statt ihn zu
 * blockieren — auch dort, wo das Fehlen eine Sperre wäre (Q36, Q48). Diese
 * Entscheidung steht in 3.3; hier wird sie nur ausgerechnet.
 *
 * **Sichtbarkeit** (Schritt 4): der Lieferant erhält den Wert für den konkreten
 * Einsatz, **nie** den Katalog des Standorts. Dieses Modul gibt deshalb den
 * Einsatzwert in die Meldung und den Standortwert nur an die Kundenseite.
 *
 * Dieses Modul ist **rein**. Die Ergebnisart wählt `pruefwerk.ts` anhand der
 * Querschnittstabelle 4.7 (5.5.1 a); P4 sagt nur, *ob* ein Treffer vorliegt und
 * ob er wegen einer Schätzung auf eine Warnung begrenzt ist.
 */

import { istVorOderGleich, type Tag } from '../kalender'
import { REGELWERK, type Regelwerkkonfiguration } from '../regelwerk'
import type { Rollenkuerzel } from '../typen'
import type { Zeitraum } from './p9Erlaubnis'

/** `wageSource` eines Vergleichsentgelt-Eintrags (SPEC 3.3). */
export type Entgeltquelle =
  | 'collectiveAgreement'
  | 'companyAgreement'
  | 'individualContract'
  /** Schätzung: verwendbar, aber **kein** Nachweis (3.3). */
  | 'estimate'

/** Warum P4 anschlägt (SPEC 5.2.4, 5.2.7). */
export type Entgeltmangel =
  /** `activityDescription` fehlt — P4 nicht ausführbar, wirkt wie ein Treffer. */
  | 'taetigkeitFehlt'
  /** Kein gültiger Eintrag am Standort zur Tätigkeit. */
  | 'keinEintrag'
  /** Mehr als ein gültiger Eintrag — Eindeutigkeit aus 3.3 verletzt. */
  | 'mehrdeutig'
  /** Fälligkeit erreicht, `comparableWage` leer. */
  | 'wertFehltNachFaelligkeit'
  /** Der Einsatzwert liegt **unter** dem Eintrag des Standorts. */
  | 'abweichungNachUnten'

/** Die Lage, gegen die P4 rechnet (SPEC 5.2.4, E10 bis E13). */
export interface Entgeltlage {
  /** Standort bzw. Entleiher — für die Meldung (3.1). */
  readonly standort: string
  /** E10 — `assignment.activityDescription`; wählt den Eintrag (Schritt 1). */
  readonly taetigkeit: string | null
  /** Die Tätigkeitsbeschreibung fehlt ganz (5.2.7, letzte Zeile). */
  readonly taetigkeitFehlt: boolean
  /** Zahl der am Stichtag gültigen Einträge: 0, 1 oder mehr (Schritt 2). */
  readonly anzahlEintraege: number
  /** Betrag des Standorteintrags, soweit genannt. */
  readonly eintragsbetrag: number | null
  /** E11 — `wageSource` des Eintrags. */
  readonly quelle: Entgeltquelle | null
  /** E12 — `assignment.comparableWage`. */
  readonly einsatzwert: number | null
  readonly einsatzwertGesetzt: boolean
  /** Eine Abweichung nach unten ist nach 3.7 nur mit Begründung zulässig. */
  readonly abweichungBegruendet: boolean
  readonly stichtag: Tag | null
  readonly zeitraum: Zeitraum | null
  /** E13 — `equalPayDueDate` aus 5.2.3. */
  readonly faelligkeit: Tag | null
  /**
   * Der Vorgang sagt ausdrücklich, dass die Fälligkeit **im** Prüfzeitraum
   * liegt, ohne den Zeitraum auszuschreiben (Beleg → `created`, wo die Tabelle
   * in 5.0 ihn aus den zugrunde liegenden Zetteln bildet).
   */
  readonly faelligkeitImZeitraumGenannt?: boolean
}

export interface Entgeltergebnis {
  readonly taetigkeit: string | null
  readonly anzahlEintraege: number
  readonly eintragsbetrag: number | null
  readonly einsatzwert: number | null
  readonly quelle: Entgeltquelle | null
  /** Ein Eintrag liegt vor und ist eindeutig (Schritt 2). */
  readonly verwendbar: boolean
  /** Der Eintrag ist ein **Nachweis** — keine Schätzung (3.3). */
  readonly nachweis: boolean
  /** Der Eintrag trägt `wageSource = estimate`. */
  readonly schaetzung: boolean
  readonly faelligkeit: Tag | null
  /** Die Fälligkeit ist am Stichtag oder im Prüfzeitraum erreicht (5.2.6). */
  readonly faelligkeitErreicht: boolean
  /** Der Einsatzwert weicht **nach unten** ab (Schritt 3). */
  readonly abweichungNachUnten: boolean
  /** Der Einsatzwert liegt **über** dem Eintrag — zulässig (Schritt 3). */
  readonly abweichungNachOben: boolean
  /**
   * Ein Treffer im Sinne von 5.2.4. Ob daraus eine Warnung oder eine Sperre
   * wird, sagt 4.7 (5.5.1 a).
   */
  readonly treffer: boolean
  /**
   * Der Treffer ist auf eine **Warnung** begrenzt, auch wo 4.7 eine Sperre
   * vorsieht: eine Schätzung ist verwendbar (3.3, 5.2.4; Q36 in 5.5.5).
   */
  readonly nurWarnung: boolean
  readonly mangel: Entgeltmangel | null
  readonly adressaten: readonly Rollenkuerzel[]
  readonly meldung: string
}

/** P4 — das Vergleichsentgelt prüfen (SPEC 5.2.4). */
export function pruefeVergleichsentgelt(
  lage: Entgeltlage,
  konfiguration: Regelwerkkonfiguration = REGELWERK,
): Entgeltergebnis {
  const faelligkeitErreicht = erreicht(lage)

  // Schritt 2: Verwendbarkeit. Null Einträge und mehr als einer werden gleich
  // behandelt — mit unterschiedlicher Meldung, weil der Weg zur Behebung ein
  // anderer ist.
  const verwendbar = !lage.taetigkeitFehlt && lage.anzahlEintraege === 1
  const schaetzung = verwendbar && lage.quelle === 'estimate'
  const nachweis = verwendbar && !schaetzung && lage.quelle !== null

  // Schritt 3: Wert am Einsatz.
  const wertFehlt = !lage.einsatzwertGesetzt && faelligkeitErreicht
  const vergleichbar =
    lage.einsatzwertGesetzt && lage.einsatzwert !== null && lage.eintragsbetrag !== null
  const abweichungNachUnten = vergleichbar && (lage.einsatzwert ?? 0) < (lage.eintragsbetrag ?? 0)
  const abweichungNachOben = vergleichbar && (lage.einsatzwert ?? 0) > (lage.eintragsbetrag ?? 0)

  const mangel: Entgeltmangel | null = lage.taetigkeitFehlt
    ? 'taetigkeitFehlt'
    : lage.anzahlEintraege > 1
      ? 'mehrdeutig'
      : lage.anzahlEintraege === 0
        ? 'keinEintrag'
        : wertFehlt
          ? 'wertFehltNachFaelligkeit'
          : abweichungNachUnten
            ? 'abweichungNachUnten'
            : null

  const treffer = mangel !== null
  // Eine Schätzung begrenzt den Treffer auf eine Warnung. Sie tut das **nicht**
  // für einen Mangel, der nichts mit ihr zu tun hat: fehlt die Tätigkeit, ist
  // auch die Schätzung nicht zuzuordnen.
  const nurWarnung =
    (schaetzung && mangel !== 'taetigkeitFehlt') || mangel === 'abweichungNachUnten'

  const ergebnis = {
    taetigkeit: lage.taetigkeit,
    anzahlEintraege: lage.anzahlEintraege,
    eintragsbetrag: lage.eintragsbetrag,
    einsatzwert: lage.einsatzwert,
    quelle: lage.quelle,
    verwendbar,
    nachweis,
    schaetzung,
    faelligkeit: lage.faelligkeit,
    faelligkeitErreicht,
    abweichungNachUnten,
    abweichungNachOben,
    treffer: treffer || schaetzung,
    nurWarnung,
    mangel,
  }

  return {
    ...ergebnis,
    adressaten: adressaten(ergebnis, konfiguration),
    meldung: meldung(ergebnis, lage),
  }
}

/* ------------------------------------------------------------------ */
/* Schritte und Hilfsrechnungen                                        */
/* ------------------------------------------------------------------ */

/**
 * Ist die Fälligkeit erreicht? Der **Tag** der Fälligkeit zählt mit — er ist
 * der erste Tag mit Equal-Pay-Pflicht, nicht der letzte ohne (5.2.6). Ein
 * Prüfzeitraum, der an ihm beginnt, braucht den Wert.
 */
function erreicht(lage: Entgeltlage): boolean {
  const faelligkeit = lage.faelligkeit
  if (faelligkeit === null) return false
  if (lage.faelligkeitImZeitraumGenannt === true) return true
  if (lage.zeitraum !== null && istVorOderGleich(faelligkeit, lage.zeitraum.bis)) return true
  if (lage.stichtag !== null && istVorOderGleich(faelligkeit, lage.stichtag)) return true
  return false
}

type Zwischenergebnis = Omit<Entgeltergebnis, 'adressaten' | 'meldung'>

function adressaten(
  ergebnis: Zwischenergebnis,
  konfiguration: Regelwerkkonfiguration,
): readonly Rollenkuerzel[] {
  const empfaenger = new Set<Rollenkuerzel>()
  // 5.2.4 und 5.2.7: „Der Entleiher pflegt den Eintrag (3.3); die Meldung geht
  // an `KE` mit Standort und Tätigkeit."
  if (
    ergebnis.mangel === 'keinEintrag' ||
    ergebnis.mangel === 'mehrdeutig' ||
    ergebnis.mangel === 'wertFehltNachFaelligkeit' ||
    ergebnis.mangel === 'taetigkeitFehlt' ||
    ergebnis.schaetzung
  ) {
    for (const rolle of konfiguration.adressatenVergleichsentgeltFehlt) empfaenger.add(rolle)
  }
  if (ergebnis.abweichungNachUnten) {
    for (const rolle of konfiguration.adressatenEntgeltabweichung) empfaenger.add(rolle)
  }
  return [...empfaenger]
}

function meldung(ergebnis: Zwischenergebnis, lage: Entgeltlage): string {
  const teile: string[] = []
  const wo = `Standort „${lage.standort}"${
    lage.taetigkeit === null ? '' : `, Tätigkeit „${lage.taetigkeit}"`
  }`

  switch (ergebnis.mangel) {
    case 'taetigkeitFehlt':
      teile.push(
        'P4: Am Einsatz ist keine Tätigkeitsbeschreibung erfasst. Damit ist der ' +
          'Vergleichsentgelt-Eintrag nicht zuzuordnen und die Prüfung nicht ausführbar; das ' +
          'wirkt wie ein Treffer (SPEC 5.2.7). `activityDescription` ist Pflichtfeld nach 3.7, ' +
          'und die Konkretisierungspflicht aus 5.3.3 greift zusätzlich über P8.',
      )
      break
    case 'keinEintrag':
      teile.push(
        `P4: Für ${wo} ist am Stichtag kein Vergleichsentgelt-Eintrag gültig. Der Entleiher ` +
          'pflegt den Eintrag (SPEC 3.3); ohne ihn ist das geschuldete Entgelt nicht ' +
          'bestimmbar (5.2.4, Schritt 2).',
      )
      break
    case 'mehrdeutig':
      teile.push(
        `P4: Für ${wo} sind ${ergebnis.anzahlEintraege} Einträge gleichzeitig gültig. Die ` +
          'Eindeutigkeit aus SPEC 3.3 ist verletzt; die Lage wird wie „kein Eintrag" behandelt ' +
          'und es wird **keiner** der Einträge ausgewählt (5.2.4, Schritt 2). Zu bereinigen ' +
          'sind die konkurrierenden Einträge selbst.',
      )
      break
    case 'wertFehltNachFaelligkeit':
      teile.push(
        `P4: Die Equal-Pay-Fälligkeit ${ergebnis.faelligkeit ?? ''} ist erreicht und ` +
          '`comparableWage` ist am Einsatz nicht gesetzt. Der Wert ist ab der Fälligkeit ' +
          'Pflicht (SPEC 3.7); der offene Weg ist, dass der Entleiher ihn nachträgt (5.2.4, ' +
          'Schritt 3).',
      )
      break
    case 'abweichungNachUnten':
      teile.push(
        `P4: Der Wert am Einsatz (${ergebnis.einsatzwert ?? '—'}) liegt **unter** dem Eintrag ` +
          `des Standorts (${ergebnis.eintragsbetrag ?? '—'}). Eine Abweichung nach unten ` +
          'verkleinert das geschuldete Entgelt und ist nach SPEC 3.7 nur mit Begründung ' +
          'zulässig; sie wird protokolliert und an Einkauf und Controlling des Kunden ' +
          `eskaliert${lage.abweichungBegruendet ? ' — eine Begründung liegt vor' : ''} ` +
          '(5.2.4, Schritt 3).',
      )
      break
    case null:
      if (ergebnis.abweichungNachOben) {
        teile.push(
          'P4: Der Wert am Einsatz liegt über dem Eintrag des Standorts. Mehr als das ' +
            'Vergleichsentgelt zu gewähren ist zulässig (SPEC 5.2.4, Schritt 3).',
        )
      } else if (!ergebnis.faelligkeitErreicht) {
        teile.push(
          'P4: Der Stichtag liegt vor der Equal-Pay-Fälligkeit' +
            `${ergebnis.faelligkeit === null ? '' : ` (${ergebnis.faelligkeit})`}; ` +
            '`comparableWage` ist noch nicht Pflicht (SPEC 5.2.4, Schritt 3).',
        )
      } else {
        teile.push(
          'P4: Ein eindeutiger Vergleichsentgelt-Eintrag liegt vor und der Wert am Einsatz ist ' +
            'gesetzt (SPEC 5.2.4).',
        )
      }
      break
  }

  if (ergebnis.schaetzung) {
    teile.push(
      'Der Eintrag trägt `wageSource = estimate`: er ist **verwendbar, aber kein Nachweis** ' +
        '(SPEC 3.3). Der Übergang wird zugelassen und das Ergebnis bleibt als Warnung am ' +
        'Vorgang, bis ein Nachweis vorliegt — eine Schätzung blockiert nicht (5.2.4; 5.5.5 ' +
        'zu Q36).',
    )
  }

  teile.push(
    'Dem Lieferanten wird nur der Wert dieses Einsatzes genannt, nie der Katalog des Standorts ' +
      '(SPEC 5.2.4, Schritt 4).',
  )
  return teile.join(' ')
}
