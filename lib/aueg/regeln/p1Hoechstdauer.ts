/**
 * P1 — Höchstüberlassungsdauer (`maxDurationCheck`), SPEC 5.1, und P2 —
 * Unterbrechung und Zurücksetzen (`interruptionResetCheck`), SPEC 5.1.4.
 *
 * **Die Regel in Worten.** Derselbe Leiharbeitnehmer darf demselben Entleiher
 * nicht länger als 18 aufeinander folgende Monate überlassen werden
 * (§ 1 Abs. 1b Satz 1 AÜG). Zeiten vorheriger Überlassungen an denselben
 * Entleiher sind vollständig anzurechnen — auch die durch einen **anderen**
 * Verleiher —, wenn zwischen den Einsätzen jeweils nicht mehr als drei Monate
 * liegen (Satz 2). Ein Tarifvertrag der Einsatzbranche kann abweichen
 * (Sätze 3 bis 6); dieser Wert ist Konfiguration an der Tarifzuordnung (3.3)
 * und erreicht die Regel als Eingangsdatum.
 *
 * Die Grenze ist **personen- und entleiherbezogen**: nicht standortbezogen,
 * nicht kostenstellenbezogen, nicht lieferantenbezogen. Ein Lieferantenwechsel
 * verlängert sie nicht (5.0, Überlassungskette).
 *
 * **Der Rechenweg** (5.1.3, Schritte 1 bis 7):
 *
 *  1. Überlassungstage bilden: je Einsatz die Kalendertage vom wirksamen
 *     Beginn bis zum wirksamen Ende, Unterbrechungstage heraus, alle Mengen
 *     **vereinigt** — ein Tag mit zwei laufenden Einsätzen ist ein Tag
 *     (Entscheidung zu Frage 19).
 *  2. Kette schneiden, wo eine Lücke von **mehr als drei Monaten** liegt
 *     (5.1.4). Maßgeblich ist die Kette, die den Stichtag enthält oder ihm
 *     unmittelbar vorausgeht.
 *  3. `countedDurationDays` = **tatsächliche** Überlassungstage der Kette bis
 *     zum Stichtag einschließlich. Vorgesehene Tage zählen hier nicht.
 *  4. `maxDurationDays` = Kalendertage von `chainStartDate` bis zum Ende einer
 *     Frist von `E6` Monaten ab diesem Tag (§§ 187 Abs. 2, 188 Abs. 2 BGB).
 *  5. `maxDurationEndDate` = der Kalendertag, auf den der `maxDurationDays`-te
 *     Überlassungstag der Kette fällt — Lückentage verbrauchen Kalenderzeit,
 *     aber kein Budget (*offene Frage 26*).
 *  6. Vorschau: dieselbe Rechnung mit tatsächlichen **und** vorgesehenen Tagen
 *     bis zum Ende des Prüfzeitraums.
 *  7. Ergebnis: letzter Tag des Prüfzeitraums gegen `maxDurationEndDate`, dazu
 *     die Schwellen aus 5.1.6.
 *
 * Dazu die Grenzfälle aus 5.1.5 und das Verhalten bei fehlenden Daten aus
 * 5.1.8 — und der Grundsatz aus 5.0: **eine fehlende Rechengrundlage wirkt wie
 * ein Treffer, nicht wie ein Freibrief.**
 *
 * Was P1 **nicht** tut: die Rechtsfolge nach §§ 9, 10 AÜG abbilden. Die
 * Festhaltenserklärung und das entstehende Arbeitsverhältnis beim Entleiher
 * sind Rechtsanwendung außerhalb des Systems (5.1.7, 5.0).
 *
 * Dieses Modul ist **rein**: es liest eine Lage und gibt ein Ergebnis zurück.
 * Es kennt keinen Statusübergang und keine Datenbank; die Ergebnisart wählt
 * `pruefwerk.ts` anhand der Querschnittstabelle 4.7 (5.5.1 a).
 */

import {
  folgetag,
  istVorOderGleich,
  liegtImZeitraum,
  monatsfristEnde,
  tageDesZeitraums,
  tagesdifferenz,
  tagVersetzt,
  type Tag,
} from '../kalender'
import { REGELWERK, type Regelwerkkonfiguration } from '../regelwerk'
import type { Rollenkuerzel } from '../typen'
import type { Zeitraum } from './p9Erlaubnis'

/** Eine Unterbrechung oder eine Lücke zwischen zwei Einsätzen (SPEC 5.1.4). */
export interface Unterbrechung {
  /** `interruptionFrom` bzw. wirksames Ende des früheren Einsatzes + 1 Tag. */
  readonly von: Tag
  /** `interruptionTo` bzw. wirksamer Beginn des späteren Einsatzes − 1 Tag. */
  readonly bis: Tag | null
}

/**
 * Ein Einsatz, wie P1 ihn braucht (SPEC 3.7, Eingangsdaten E3 bis E5).
 * `tatsaechlich` unterscheidet `realizedAssignmentDay` von
 * `plannedAssignmentDay` (5.0, Überlassungskette).
 */
export interface Einsatzsatz {
  readonly id: string
  /** `customerRef` — Bezugspunkt der Kette (5.0). */
  readonly kunde: string | null
  /** `supplierRef` — für die Meldung; die Kette läuft über Lieferanten hinweg. */
  readonly lieferant: string | null
  /** Wirksamer Beginn: `actualStartDate`, ersatzweise `plannedStartDate`. */
  readonly beginn: Tag | null
  /** Wirksames Ende; `null` heißt: läuft noch oder unbefristeter Bedarf. */
  readonly ende: Tag | null
  /** Die Tage sind tatsächliche Überlassungstage, nicht nur vorgesehene. */
  readonly tatsaechlich: boolean
  /**
   * Der Einsatz hat nie begonnen: `planned` → `terminatedEarly` ohne
   * `actualStartDate`. Er erzeugt **keinen** Überlassungstag und lässt die
   * Kette unberührt (5.1.5).
   */
  readonly nieBegonnen: boolean
  readonly unterbrechungen: readonly Unterbrechung[]
}

/** Woher die Grenze kommt (SPEC 5.1.2, Rangfolge). */
export type Grenzherkunft = 'standort' | 'kunde' | 'regelgrenze'

/** Auf welcher Grundlage gezählt wird (SPEC 5.1.5, 5.0). */
export type Zaehlgrundlage =
  /** Bestätigte Personenidentität — die Kette läuft über alle Lieferanten. */
  | 'bestaetigt'
  /** Keine bestätigte Identität: Kette auf einen Lieferanten begrenzt (5.1.5). */
  | 'einLieferant'
  /** Maschineller, nicht bestätigter Treffer — zählt **nicht** (Frage 18). */
  | 'unbestaetigterVorschlag'
  /** Vorschau ohne Person (Q03): es gibt keine Kette. */
  | 'ohnePerson'

export interface Kettenlage {
  readonly person: string
  readonly kunde: string
  readonly einsaetze: readonly Einsatzsatz[]
  /** Stichtag aus 5.0; `null`, wenn der Vorgang keinen nennt. */
  readonly stichtag: Tag | null
  /** Prüfzeitraum aus 5.0. */
  readonly zeitraum: Zeitraum | null
  /** Zeitpositionen eines Stundenzettels (3.8) — maßgeblich bei Q33 und Q35. */
  readonly zeitpositionen: Zeitraum | null
  /** `maxAssignmentDurationMonths` nach der Rangfolge aus 5.1.2 (E6). */
  readonly grenzeMonate: number
  readonly grenzeHerkunft: Grenzherkunft
  /** Die Grenze ist innerhalb der laufenden Kette **gesenkt** worden (5.1.2). */
  readonly grenzeGesenkt: boolean
  /** `maxDurationEndDate` als gepflegtes abgeleitetes Feld (3.7). */
  readonly gesetztesFristende: Tag | null
  /** `countedDurationDays` als gepflegtes abgeleitetes Feld (3.7). */
  readonly gesetzteDauer: number | null
  /**
   * Der Tag, auf den sich `gesetzteDauer` bezieht. Gehört er nicht zur
   * maßgeblichen Kette, gehört der Wert zu einer **früheren** Kette und wird
   * nicht fortgeschrieben — das ist die Wirkung des Resets (5.1.4).
   */
  readonly gesetzteDauerStand: Tag | null
  /** Restbudget, soweit der Vorgang es selbst führt. */
  readonly gesetztesRestbudget: number | null
  readonly zaehlgrundlage: Zaehlgrundlage
  /** Die Lücke, die P2 bewertet (5.1.4 a oder b). */
  readonly luecke: Unterbrechung | null
  /** Erster Wiederaufnahmetag — Stichtag bei `interrupted` → `active` (5.0). */
  readonly wiederaufnahmetag: Tag | null
  readonly fehlendeFelder: readonly string[]
}

/** Warum die Rechnung nicht durchgeht (SPEC 5.1.8). */
export type Dauermangel =
  /** `plannedStartDate` fehlt — die Kette ist nicht bildbar (5.1.8). */
  | 'laufzeitFehlt'
  /** Ende vor Beginn — Datenfehler (5.1.8). */
  | 'widerspruch'
  /** Der Prüfzeitraum reicht über `maxDurationEndDate` hinaus. */
  | 'ueberschreitung'
  /** Das Fristende ist am Stichtag bereits überschritten. */
  | 'fristendeErreicht'

/** Die Schwellen aus SPEC 5.1.6. */
export type Schwelle = 'keine' | 'hinweis' | 'warnung' | 'erreicht'

export interface Dauerergebnis {
  readonly kunde: string
  readonly kettenbeginn: Tag | null
  /** Letzter Überlassungstag der maßgeblichen Kette (5.1.3, Schritt 2). */
  readonly kettenende: Tag | null
  readonly tagebudget: number | null
  readonly angerechneteDauer: number | null
  readonly restbudget: number | null
  readonly fristende: Tag | null
  /** Der letzte Tag, über den die Prüfung entscheidet (5.1.3, Schritt 7). */
  readonly bezugstag: Tag | null
  readonly grenzeMonate: number
  readonly grenzeHerkunft: Grenzherkunft
  /** Kalendertage der bewerteten Lücke (5.1.4). */
  readonly lueckentage: number | null
  /** Zahl der Einsätze, über die die Kette läuft. */
  readonly einsaetzeDerKette: number
  /** Angefragte Dauer in Tagen — die Vorschau ohne Person (Q03). */
  readonly angefragteTage: number | null
  readonly ueberschritten: boolean
  /** Das Fristende lag schon am Stichtag hinter uns (Q23, Q26). */
  readonly stichtagUeberschritten: boolean
  /** Eine Senkung der Grenze wirkt nach vorn (5.1.2, *offene Frage 27*). */
  readonly senkungWirktNachVorn: boolean
  readonly schwelle: Schwelle
  readonly mangel: Dauermangel | null
  readonly fehlendeFelder: readonly string[]
  readonly vermerke: readonly string[]
  readonly adressaten: readonly Rollenkuerzel[]
  readonly meldung: string
}

/** P1 — die Höchstüberlassungsdauer rechnen (SPEC 5.1.3). */
export function pruefeHoechstdauer(
  lage: Kettenlage,
  konfiguration: Regelwerkkonfiguration = REGELWERK,
): Dauerergebnis {
  const datenfehler = pruefeDaten(lage)
  if (datenfehler !== null) return datenfehler

  const bezugstag = bezugstagVon(lage)
  const kette = bildeKette(lage, bezugstag, konfiguration)
  const angerechneteDauer = zaehleDauer(lage, kette)
  const tagebudget =
    kette.beginn === null
      ? null
      : tageDesZeitraums(
          kette.beginn,
          monatsfristEnde(kette.beginn, lage.grenzeMonate),
        ).length
  const gerechnetesFristende =
    kette.beginn === null || tagebudget === null
      ? lage.gesetztesFristende
      : tagFuerBudget(kette.tage, tagebudget)
  const fristende = gerechnetesFristende ?? lage.gesetztesFristende

  const stichtagUeberschritten =
    lage.stichtag !== null && fristende !== null && !istVorOderGleich(lage.stichtag, fristende)
  const bezugUeberschritten =
    bezugstag !== null && fristende !== null && !istVorOderGleich(bezugstag, fristende)
  const ueberschritten = stichtagUeberschritten || bezugUeberschritten

  // 5.1.2: liegt die mit der gesenkten Grenze neu berechnete Frist schon in der
  // Vergangenheit, wird `maxDurationEndDate` auf den Stichtag gesetzt — die
  // vergangene Überlassung wird festgestellt, nicht rückwirkend untersagt.
  const senkungWirktNachVorn =
    lage.grenzeGesenkt && stichtagUeberschritten && lage.stichtag !== null
  const gefuehrtesFristende = senkungWirktNachVorn ? lage.stichtag : fristende

  const restbudget = berechneRestbudget(lage, tagebudget, angerechneteDauer, fristende)
  const schwelle = bestimmeSchwelle(
    ueberschritten,
    restbudget,
    bezugstag,
    fristende,
    konfiguration,
  )

  const vermerke = sammleVermerke(lage)
  const mangel: Dauermangel | null = ueberschritten
    ? stichtagUeberschritten
      ? 'fristendeErreicht'
      : 'ueberschreitung'
    : null

  return {
    kunde: lage.kunde,
    kettenbeginn: kette.beginn,
    kettenende: kette.tage[kette.tage.length - 1] ?? null,
    tagebudget,
    angerechneteDauer,
    restbudget,
    fristende: gefuehrtesFristende,
    bezugstag,
    grenzeMonate: lage.grenzeMonate,
    grenzeHerkunft: lage.grenzeHerkunft,
    lueckentage: lueckentageVon(lage),
    einsaetzeDerKette: kette.einsaetze,
    angefragteTage: angefragteTageVon(lage),
    ueberschritten,
    stichtagUeberschritten,
    senkungWirktNachVorn,
    schwelle,
    mangel,
    fehlendeFelder: lage.fehlendeFelder,
    vermerke,
    adressaten: adressaten(ueberschritten, schwelle, vermerke, lage, konfiguration),
    meldung: meldung({
      lage,
      kettenbeginn: kette.beginn,
      tagebudget,
      angerechneteDauer,
      restbudget,
      fristende: gefuehrtesFristende,
      bezugstag,
      ueberschritten,
      stichtagUeberschritten,
      senkungWirktNachVorn,
      schwelle,
      vermerke,
    }),
  }
}

/** Bewertung einer Lücke nach der Drei-Monats-Regel (SPEC 5.1.4). */
export interface Lueckenbewertung {
  readonly lueckenbeginn: Tag | null
  readonly lueckenende: Tag | null
  /** Ende der Frist von drei Monaten ab `lueckenbeginn`. */
  readonly dreimonatsende: Tag | null
  /** `gapTo` liegt vor `gapFrom`: durchgehende Überlassung, keine Lücke. */
  readonly keineLuecke: boolean
  /** `countsAsReset` (3.7, abgeleitet). */
  readonly zaehlwirksam: boolean
  /** `interruptionTo` fehlt: das Ergebnis ist vorläufig (5.1.4 b, 5.1.8). */
  readonly vorlaeufig: boolean
  readonly lueckentage: number | null
  /** Erster Tag der neuen Kette, wenn die Lücke zählwirksam ist. */
  readonly neueKetteAb: Tag | null
  readonly meldung: string
}

/**
 * P2 — die Lücke bewerten (SPEC 5.1.4).
 *
 * ```
 * dreiMonatsEnde = gapFrom + 3 Monate − 1 Tag      (§§ 187 Abs. 2, 188 Abs. 2 BGB)
 * countsAsReset  = gapTo > dreiMonatsEnde
 * ```
 *
 * Das Gesetz sagt „nicht mehr als drei Monate": **exakt** drei Monate liegen
 * innerhalb der Anrechnung und setzen die Zählung **nicht** zurück. Das ist der
 * Grenzfall, der am häufigsten falsch gerechnet wird.
 */
export function bewerteLuecke(
  luecke: Unterbrechung | null,
  stichtag: Tag | null,
  wiederaufnahmetag: Tag | null,
  konfiguration: Regelwerkkonfiguration = REGELWERK,
): Lueckenbewertung {
  if (luecke === null) {
    return {
      lueckenbeginn: null,
      lueckenende: null,
      dreimonatsende: null,
      keineLuecke: true,
      zaehlwirksam: false,
      vorlaeufig: false,
      lueckentage: null,
      neueKetteAb: null,
      meldung:
        'P2: Der Vorgang nennt keine Unterbrechung und keine Lücke; es ist nichts zu bewerten ' +
        '(SPEC 5.1.4).',
    }
  }

  const von = luecke.von
  // 5.1.4 b): ist `interruptionTo` leer, ist `gapTo` der Stichtag und das
  // Ergebnis **vorläufig** — es wird bei `interrupted` → `active` endgültig.
  const vorlaeufig = luecke.bis === null
  const bis = luecke.bis ?? stichtag
  const dreimonatsende = monatsfristEnde(von, konfiguration.dauer.unterbrechungMonate)

  if (bis === null) {
    return {
      lueckenbeginn: von,
      lueckenende: null,
      dreimonatsende,
      keineLuecke: false,
      zaehlwirksam: false,
      vorlaeufig: true,
      lueckentage: null,
      neueKetteAb: null,
      meldung:
        `P2: Die Unterbrechung beginnt am ${von} und hat kein Ende; ohne Stichtag ist das ` +
        'Lückenende nicht bestimmbar und die Zählwirksamkeit bleibt offen (SPEC 5.1.4 b, 5.1.8).',
    }
  }

  // „Ende 31.03., Wiederaufnahme 01.04.": `gapTo` liegt vor `gapFrom` — keine
  // Lücke, durchgehende Überlassung (5.1.4, dritte Beispielzeile).
  const keineLuecke = !istVorOderGleich(von, bis)
  const zaehlwirksam = !keineLuecke && !istVorOderGleich(bis, dreimonatsende)
  const lueckentage = keineLuecke ? 0 : tagesdifferenz(von, bis) + 1
  const neueKetteAb = zaehlwirksam ? (wiederaufnahmetag ?? folgetag(bis)) : null

  return {
    lueckenbeginn: von,
    lueckenende: bis,
    dreimonatsende,
    keineLuecke,
    zaehlwirksam,
    vorlaeufig,
    lueckentage,
    neueKetteAb,
    meldung: meldungLuecke({
      von,
      bis,
      dreimonatsende,
      keineLuecke,
      zaehlwirksam,
      vorlaeufig,
      lueckentage,
      neueKetteAb,
    }),
  }
}

/* ------------------------------------------------------------------ */
/* Schritte der Berechnung                                            */
/* ------------------------------------------------------------------ */

/**
 * 5.1.8: fehlt `plannedStartDate` oder liegt das Ende vor dem Beginn, ist die
 * Kette nicht bildbar. Das Ergebnis ist **wie ein Treffer** — bei einem
 * Übergang, dem 4.7 eine Sperre zuordnet, also eine Sperre.
 */
function pruefeDaten(lage: Kettenlage): Dauerergebnis | null {
  const ohneBeginn = lage.einsaetze.filter(
    (einsatz) => !einsatz.nieBegonnen && einsatz.beginn === null,
  )
  const widersprechend = lage.einsaetze.filter(
    (einsatz) =>
      einsatz.beginn !== null &&
      einsatz.ende !== null &&
      !istVorOderGleich(einsatz.beginn, einsatz.ende),
  )
  if (ohneBeginn.length === 0 && widersprechend.length === 0) return null

  const widerspruch = widersprechend.length > 0
  const fehlendeFelder = widerspruch
    ? ['plannedStartDate', 'plannedEndDate']
    : ['plannedStartDate']

  return {
    kunde: lage.kunde,
    kettenbeginn: null,
    kettenende: null,
    tagebudget: null,
    angerechneteDauer: null,
    restbudget: null,
    fristende: null,
    bezugstag: bezugstagVon(lage),
    grenzeMonate: lage.grenzeMonate,
    grenzeHerkunft: lage.grenzeHerkunft,
    lueckentage: null,
    einsaetzeDerKette: 0,
    angefragteTage: null,
    ueberschritten: true,
    stichtagUeberschritten: false,
    senkungWirktNachVorn: false,
    schwelle: 'erreicht',
    mangel: widerspruch ? 'widerspruch' : 'laufzeitFehlt',
    fehlendeFelder: [...new Set([...lage.fehlendeFelder, ...fehlendeFelder])],
    vermerke: [],
    adressaten: ['MD'],
    meldung: widerspruch
      ? 'P1: Das Ende des Einsatzes liegt vor seinem Beginn — die widersprüchlichen Felder sind ' +
        '"plannedStartDate" und "plannedEndDate". Ein Datenfehler wirkt wie ein Treffer, nicht wie ' +
        'ein Freibrief (SPEC 5.1.8, 5.0).'
      : 'P1: Das fehlende Feld "plannedStartDate" am Einsatz macht die Überlassungskette nicht ' +
        'bildbar. Eine fehlende Rechengrundlage wirkt wie ein Treffer (SPEC 5.1.8, 5.0); ' +
        '`plannedStartDate` ist in 3.7 Pflicht, der Fall ist ein Datenfehler.',
  }
}

/**
 * Der letzte Tag, über den die Prüfung entscheidet (5.1.3, Schritt 7). Am
 * Stundenzettel sind es die Zeitpositionen (4.7, Q33 und Q35: „Zeitpositionen
 * nach `maxDurationEndDate` enthalten"), sonst der letzte Tag des
 * Prüfzeitraums, sonst der Stichtag.
 */
export function bezugstagVon(lage: Kettenlage): Tag | null {
  return lage.zeitpositionen?.bis ?? lage.zeitraum?.bis ?? lage.stichtag ?? null
}

/**
 * Die maßgebliche Überlassungskette. **Auch 5.2 rechnet auf ihr** — „dieselbe
 * Kette, andere Frist" (5.2.1): die Anrechnungsregel des § 8 Abs. 4 Satz 4 ist
 * die des § 1 Abs. 1b Satz 2. Deshalb ist dieser Typ exportiert und P3 bildet
 * die Kette nicht ein zweites Mal; zwei Fassungen derselben Rechnung würden
 * auseinanderlaufen.
 */
export interface Kette {
  readonly beginn: Tag | null
  /** Die Überlassungstage der maßgeblichen Kette, chronologisch. */
  readonly tage: readonly Tag[]
  /** Welche dieser Tage tatsächliche Überlassungstage sind (5.0). */
  readonly tatsaechlich: ReadonlySet<Tag>
  readonly einsaetze: number
}

/**
 * Schritte 1 und 2: Überlassungstage bilden, vereinigen und die Kette dort
 * schneiden, wo eine Lücke von mehr als drei Monaten liegt (5.1.4).
 */
export function bildeKette(
  lage: Kettenlage,
  bezugstag: Tag | null,
  konfiguration: Regelwerkkonfiguration,
): Kette {
  // Ein unbestätigter maschineller Treffer zählt nicht (5.1.5, Frage 18), und
  // ohne Person gibt es keine Kette (Q03).
  if (lage.zaehlgrundlage === 'ohnePerson' || lage.zaehlgrundlage === 'unbestaetigterVorschlag') {
    return { beginn: null, tage: [], tatsaechlich: new Set(), einsaetze: 0 }
  }

  const tatsaechlich = new Set<Tag>()
  const alle = new Set<Tag>()
  let beteiligte = 0

  for (const einsatz of lage.einsaetze) {
    if (einsatz.nieBegonnen || einsatz.beginn === null) continue
    if (einsatz.kunde !== null && einsatz.kunde !== lage.kunde) continue
    // Ohne wirksames Ende läuft der Einsatz weiter; begrenzt wird er vom
    // letzten Tag, über den die Prüfung entscheidet. Alles danach schreibt
    // Schritt 5 kalendarisch fort.
    const obergrenze =
      einsatz.ende ?? spaetesterVon([bezugstag, lage.stichtag, einsatz.beginn])
    if (obergrenze === null) continue
    if (!istVorOderGleich(einsatz.beginn, obergrenze)) continue

    beteiligte += 1
    for (const kalendertag of tageDesZeitraums(einsatz.beginn, obergrenze)) {
      if (inUnterbrechung(kalendertag, einsatz.unterbrechungen, lage.stichtag)) continue
      alle.add(kalendertag)
      if (einsatz.tatsaechlich && (lage.stichtag === null || istVorOderGleich(kalendertag, lage.stichtag))) {
        tatsaechlich.add(kalendertag)
      }
    }
  }

  const geordnet = [...alle].sort()
  if (geordnet.length === 0) {
    return { beginn: null, tage: [], tatsaechlich, einsaetze: beteiligte }
  }

  const ketten = schneide(geordnet, konfiguration)
  const massgeblich = waehleKette(ketten, lage.stichtag ?? bezugstag)
  return {
    beginn: massgeblich[0] ?? null,
    tage: massgeblich,
    tatsaechlich,
    einsaetze: beteiligte,
  }
}

/** Schneidet die Tagesfolge, wo eine Lücke zählwirksam ist (5.1.4). */
function schneide(tage: readonly Tag[], konfiguration: Regelwerkkonfiguration): Tag[][] {
  const ketten: Tag[][] = []
  let laufend: Tag[] = []
  for (const kalendertag of tage) {
    const vorheriger = laufend[laufend.length - 1]
    if (vorheriger !== undefined && tagesdifferenz(vorheriger, kalendertag) > 1) {
      const bewertung = bewerteLuecke(
        { von: folgetag(vorheriger), bis: tagVersetzt(kalendertag, -1) },
        null,
        kalendertag,
        konfiguration,
      )
      if (bewertung.zaehlwirksam) {
        ketten.push(laufend)
        laufend = []
      }
    }
    laufend.push(kalendertag)
  }
  if (laufend.length > 0) ketten.push(laufend)
  return ketten
}

/**
 * „Die Kette, die den Stichtag enthält oder ihm unmittelbar vorausgeht, ist die
 * maßgebliche" (5.1.3, Schritt 2).
 */
function waehleKette(ketten: readonly Tag[][], bezug: Tag | null): readonly Tag[] {
  if (ketten.length === 0) return []
  if (bezug === null) return ketten[ketten.length - 1] ?? []
  const enthaltend = ketten.find(
    (kette) =>
      kette.length > 0 &&
      istVorOderGleich(kette[0] as Tag, bezug) &&
      istVorOderGleich(bezug, kette[kette.length - 1] as Tag),
  )
  if (enthaltend !== undefined) return enthaltend
  const vorausgehend = [...ketten]
    .reverse()
    .find((kette) => kette.length > 0 && istVorOderGleich(kette[0] as Tag, bezug))
  return vorausgehend ?? ketten[0] ?? []
}

/**
 * Schritt 3: `countedDurationDays`. Ohne Stichtag ist der Schnitt unbekannt —
 * dann ist die angerechnete Dauer **nicht bestimmbar** und keine Schwelle wird
 * gerechnet. Gibt es gar keinen tatsächlichen Überlassungstag, sind es 0 Tage;
 * das ist ein Ergebnis, keine Lücke in den Daten (5.1.5, „Einsatz, der nie
 * begonnen hat").
 */
export function zaehleDauer(lage: Kettenlage, kette: Kette): number | null {
  if (lage.gesetzteDauer !== null && gehoertZurKette(lage.gesetzteDauerStand, kette)) {
    return lage.gesetzteDauer
  }
  const hatTatsaechliche = lage.einsaetze.some(
    (einsatz) => einsatz.tatsaechlich && !einsatz.nieBegonnen && einsatz.beginn !== null,
  )
  if (!hatTatsaechliche) return 0
  if (lage.stichtag === null) return null
  return kette.tage.filter((kalendertag) => kette.tatsaechlich.has(kalendertag)).length
}

/**
 * Schritt 5: der Kalendertag, auf den der `budget`-te Überlassungstag der Kette
 * fällt. Sind weniger Tage bekannt, wird ab dem letzten bekannten Tag
 * kalendarisch fortgeschrieben — jeder Folgetag gilt als Überlassungstag.
 */
export function tagFuerBudget(tage: readonly Tag[], budget: number): Tag | null {
  if (budget <= 0) return tage[0] ?? null
  if (tage.length >= budget) return tage[budget - 1] ?? null
  const letzter = tage[tage.length - 1]
  if (letzter === undefined) return null
  return tagVersetzt(letzter, budget - tage.length)
}

/**
 * Restbudget. Vorrang hat der Wert, den der Vorgang selbst führt; sonst
 * `maxDurationDays` − `countedDurationDays` (5.1.3, Schritt 5); sonst die
 * Kalendertage vom Stichtag bis zum Fristende — das ist bei einer lückenlosen
 * Kette dasselbe und die einzige Rechnung, die ohne Kettendaten trägt.
 */
function berechneRestbudget(
  lage: Kettenlage,
  tagebudget: number | null,
  angerechneteDauer: number | null,
  fristende: Tag | null,
): number | null {
  if (lage.gesetztesRestbudget !== null) return lage.gesetztesRestbudget
  if (tagebudget !== null && angerechneteDauer !== null) return tagebudget - angerechneteDauer
  if (fristende !== null && lage.stichtag !== null) {
    return tagesdifferenz(lage.stichtag, fristende)
  }
  return null
}

/**
 * Die Schwellen aus 5.1.6. Zusätzlich gilt: fällt der letzte Tag, über den die
 * Prüfung entscheidet, **genau** auf das Fristende, ist das Budget mit diesem
 * Tag ausgeschöpft — der Tag selbst ist zulässig (5.1.5), der Folgetag nicht.
 */
function bestimmeSchwelle(
  ueberschritten: boolean,
  restbudget: number | null,
  bezugstag: Tag | null,
  fristende: Tag | null,
  konfiguration: Regelwerkkonfiguration,
): Schwelle {
  if (ueberschritten) return 'erreicht'
  if (bezugstag !== null && fristende !== null && bezugstag === fristende) return 'erreicht'
  if (restbudget === null) return 'keine'
  if (restbudget <= 0) return 'erreicht'
  if (restbudget <= konfiguration.dauer.warnungTage) return 'warnung'
  if (restbudget <= konfiguration.dauer.hinweisTage) return 'hinweis'
  return 'keine'
}

function sammleVermerke(lage: Kettenlage): string[] {
  const vermerke: string[] = []
  if (lage.grenzeHerkunft === 'regelgrenze') {
    vermerke.push(
      `mit der gesetzlichen Regelgrenze von ${lage.grenzeMonate} Monaten gerechnet, weil keine ` +
        'Tarifzuordnung den Stichtag abdeckt (SPEC 5.1.2)',
    )
  }
  if (lage.zaehlgrundlage === 'einLieferant') {
    vermerke.push('Zählgrundlage auf einen Lieferanten begrenzt')
  }
  if (lage.zaehlgrundlage === 'unbestaetigterVorschlag') {
    vermerke.push(
      'ein unbestätigter Identitätsvorschlag liegt vor; seine Überlassungstage zählen nicht ' +
        '(SPEC 5.1.5, Entscheidung zu Frage 18)',
    )
  }
  if (lage.zaehlgrundlage === 'ohnePerson') {
    vermerke.push('Vorschau ohne Personenbezug')
  }
  return vermerke
}

function adressaten(
  ueberschritten: boolean,
  schwelle: Schwelle,
  vermerke: readonly string[],
  lage: Kettenlage,
  konfiguration: Regelwerkkonfiguration,
): readonly Rollenkuerzel[] {
  const gesammelt = new Set<Rollenkuerzel>()
  if (ueberschritten || schwelle === 'erreicht') {
    for (const rolle of konfiguration.adressatenDauerErreicht) gesammelt.add(rolle)
  } else if (schwelle === 'warnung') {
    for (const rolle of konfiguration.adressatenDauerWarnung) gesammelt.add(rolle)
  } else if (schwelle === 'hinweis') {
    for (const rolle of konfiguration.adressatenDauerHinweis) gesammelt.add(rolle)
  }
  if (lage.grenzeHerkunft === 'regelgrenze') {
    for (const rolle of konfiguration.adressatenRegelgrenze) gesammelt.add(rolle)
  }
  if (vermerke.length > 0 && lage.zaehlgrundlage !== 'bestaetigt') {
    for (const rolle of konfiguration.adressatenZaehlgrundlage) gesammelt.add(rolle)
  }
  if (gesammelt.size === 0) gesammelt.add('MD')
  return [...gesammelt]
}

interface Meldungsdaten {
  readonly lage: Kettenlage
  readonly kettenbeginn: Tag | null
  readonly tagebudget: number | null
  readonly angerechneteDauer: number | null
  readonly restbudget: number | null
  readonly fristende: Tag | null
  readonly bezugstag: Tag | null
  readonly ueberschritten: boolean
  readonly stichtagUeberschritten: boolean
  readonly senkungWirktNachVorn: boolean
  readonly schwelle: Schwelle
  readonly vermerke: readonly string[]
}

function meldung(daten: Meldungsdaten): string {
  const teile: string[] = []
  if (daten.senkungWirktNachVorn) {
    teile.push(
      `P1: Die Grenze ist auf ${daten.lage.grenzeMonate} Monate gesenkt; gerechnet wird mit dem ` +
        `Wert, der am Stichtag ${daten.lage.stichtag} gilt. Das neu berechnete Fristende liegt in ` +
        `der Vergangenheit, deshalb wird es auf den Stichtag ${daten.lage.stichtag} gesetzt. Die ` +
        'vergangene Überlassung wird festgestellt, nicht rückwirkend untersagt (SPEC 5.1.2, 5.5.3).',
    )
  } else if (daten.ueberschritten) {
    teile.push(
      daten.stichtagUeberschritten
        ? `P1: Das Fristende der Höchstüberlassungsdauer ${daten.fristende} ist am Stichtag ` +
          `${daten.lage.stichtag} bereits überschritten (SPEC 5.1.3, Schritt 7).`
        : `P1: Der letzte Tag ${daten.bezugstag} liegt nach dem Fristende der ` +
          `Höchstüberlassungsdauer ${daten.fristende} (SPEC 5.1.3, Schritt 7).`,
    )
  } else if (daten.schwelle === 'erreicht') {
    teile.push(
      `P1: Das Budget ist mit dem ${daten.bezugstag ?? daten.fristende} ausgeschöpft; das ` +
        `Fristende ${daten.fristende} ist der letzte zulässige Überlassungstag (SPEC 5.1.5).`,
    )
  } else if (daten.schwelle === 'warnung') {
    teile.push(
      `P1: Die Warnschwelle der Höchstüberlassungsdauer ist erreicht — Restbudget ` +
        `${daten.restbudget} Tage bis zum Fristende ${daten.fristende} (SPEC 5.1.6).`,
    )
  } else if (daten.schwelle === 'hinweis') {
    teile.push(
      `P1: Hinweis auf das Restbudget von ${daten.restbudget} Tagen bis zum Fristende ` +
        `${daten.fristende} (SPEC 5.1.6).`,
    )
  } else {
    teile.push(
      `P1: Die Höchstüberlassungsdauer ist eingehalten; das Fristende ist ` +
        `${daten.fristende ?? 'nicht bestimmbar'} (SPEC 5.1.3).`,
    )
  }

  if (daten.kettenbeginn !== null) {
    teile.push(
      `Kette bei "${daten.lage.kunde}" ab ${daten.kettenbeginn}, Tagebudget ` +
        `${daten.tagebudget ?? '—'} Tage aus ${daten.lage.grenzeMonate} Monaten, angerechnet ` +
        `${daten.angerechneteDauer ?? '—'} Tage.`,
    )
  }
  for (const vermerk of daten.vermerke) teile.push(`Vermerk: ${vermerk}.`)
  return teile.join(' ')
}

interface Lueckenmeldung {
  readonly von: Tag
  readonly bis: Tag
  readonly dreimonatsende: Tag
  readonly keineLuecke: boolean
  readonly zaehlwirksam: boolean
  readonly vorlaeufig: boolean
  readonly lueckentage: number
  readonly neueKetteAb: Tag | null
}

function meldungLuecke(daten: Lueckenmeldung): string {
  if (daten.keineLuecke) {
    return (
      `P2: Das Lückenende ${daten.bis} liegt vor dem Lückenbeginn ${daten.von} — es gibt keine ` +
      'Lücke, die Überlassung ist durchgehend (SPEC 5.1.4).'
    )
  }
  const grundlage =
    `Lückenbeginn ${daten.von}, Lückenende ${daten.bis}, ${daten.lueckentage} Lückentage; die ` +
    `Frist von drei Monaten ab dem Lückenbeginn endet am ${daten.dreimonatsende}.`
  const vorlaeufig = daten.vorlaeufig
    ? ' Das Lückenende ist der Stichtag, die Zählwirksamkeit deshalb vorläufig; sie wird bei der ' +
      'Wiederaufnahme endgültig (SPEC 5.1.4 b, 5.1.8).'
    : ''
  if (daten.zaehlwirksam) {
    return (
      `P2: Die Unterbrechung ist zählwirksam — das Lückenende liegt nach dem ` +
      `${daten.dreimonatsende}, die Zählung wird mit der Wiederaufnahme zurückgesetzt und eine ` +
      `neue Kette beginnt am ${daten.neueKetteAb ?? '—'}. ${grundlage}${vorlaeufig}`
    )
  }
  return (
    `P2: Die Unterbrechung ist nicht zählwirksam — das Lückenende liegt nicht nach dem ` +
    `${daten.dreimonatsende}. Exakt drei Monate liegen innerhalb der Anrechnung und setzen die ` +
    `Zählung nicht zurück; die Kette läuft weiter. ${grundlage}${vorlaeufig}`
  )
}

/* ------------------------------------------------------------------ */
/* Hilfsrechnungen                                                     */
/* ------------------------------------------------------------------ */

function inUnterbrechung(
  kalendertag: Tag,
  unterbrechungen: readonly Unterbrechung[],
  stichtag: Tag | null,
): boolean {
  return unterbrechungen.some((pause) => {
    // 5.1.3, Schritt 1: bei leerem `interruptionTo` bis zum Stichtag. Nennt der
    // Vorgang auch keinen Stichtag, läuft die Unterbrechung offen weiter — dann
    // ist kein Tag ab ihrem Beginn ein Überlassungstag.
    const bis = pause.bis ?? stichtag
    if (bis === null) return istVorOderGleich(pause.von, kalendertag)
    return liegtImZeitraum(kalendertag, pause.von, bis)
  })
}

/**
 * Gehört der Stand einer genannten angerechneten Dauer zur maßgeblichen Kette?
 * Ohne Kette und ohne genannten Stand gilt der Wert; liegt der Stand außerhalb
 * der Kette, gehört er zu einer früheren und wird nicht fortgeschrieben.
 */
function gehoertZurKette(stand: Tag | null, kette: Kette): boolean {
  if (kette.tage.length === 0) return true
  if (stand === null) return true
  const erster = kette.tage[0] as Tag
  const letzter = kette.tage[kette.tage.length - 1] as Tag
  return liegtImZeitraum(stand, erster, letzter)
}

function spaetesterVon(tage: readonly (Tag | null)[]): Tag | null {
  const bekannt = tage.filter((kalendertag): kalendertag is Tag => kalendertag !== null)
  if (bekannt.length === 0) return null
  return bekannt.reduce((bisher, kalendertag) =>
    istVorOderGleich(bisher, kalendertag) ? kalendertag : bisher,
  )
}

function lueckentageVon(lage: Kettenlage): number | null {
  if (lage.luecke === null) return null
  const bis = lage.luecke.bis ?? lage.stichtag
  if (bis === null) return null
  if (!istVorOderGleich(lage.luecke.von, bis)) return 0
  return tagesdifferenz(lage.luecke.von, bis) + 1
}

/**
 * Q03 — die Vorschau ohne Person: die angefragte Dauer in Kalendertagen. Sie
 * ist eine Rechnung über den angefragten Zeitraum, keine Feststellung über eine
 * Überlassung (5.5.5, Bestätigung zu Q03).
 */
function angefragteTageVon(lage: Kettenlage): number | null {
  if (lage.zeitraum === null) return null
  if (!istVorOderGleich(lage.zeitraum.von, lage.zeitraum.bis)) return null
  return tagesdifferenz(lage.zeitraum.von, lage.zeitraum.bis) + 1
}
