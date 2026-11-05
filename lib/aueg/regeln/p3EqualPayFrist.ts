/**
 * P3 — Equal-Pay-Fälligkeit (`equalPayDeadlineCheck`), SPEC 5.2.
 *
 * **Die Regel in Worten.** Der Verleiher hat dem Leiharbeitnehmer die
 * wesentlichen Arbeitsbedingungen einschließlich des Arbeitsentgelts zu
 * gewähren, die im Betrieb des Entleihers für einen vergleichbaren
 * Arbeitnehmer gelten (§ 8 Abs. 1 AÜG). Ein Tarifvertrag der Zeitarbeitsbranche
 * kann abweichen (§ 8 Abs. 2), aber nicht beliebig lange: nach **neun Monaten**
 * gilt Equal Pay zwingend (§ 8 Abs. 4 Satz 1). Sieht ein
 * Branchenzuschlagstarifvertrag eine stufenweise Annäherung vor, kann die
 * Abweichung längstens bis zum **15. Monat** fortbestehen (Satz 2).
 * Vorhergehende Überlassungszeiten an denselben Entleiher werden angerechnet,
 * wenn die Unterbrechung nicht mehr als drei Monate beträgt (Satz 4).
 *
 * **Dieselbe Kette, andere Frist** (5.2.1). Die Anrechnungsregel des § 8 Abs. 4
 * Satz 4 ist die des § 1 Abs. 1b Satz 2. P3 rechnet deshalb auf der Kette, die
 * `p1Hoechstdauer.ts` bildet — importiert, nicht nachgebaut. Unterschieden
 * werden nur der Fristwert und das Ergebnisfeld.
 *
 * **Woher die Frist kommt** (5.2.2): aus der Tarifzuordnung der
 * **Verleiherseite**, am Stichtag — anders als in 5.1, wo die Einsatzbranche
 * maßgeblich ist. Die Abweichung vom Gleichstellungsgrundsatz ist eine
 * Regelung des Zeitarbeitstarifvertrags; **ohne ihn gibt es keine Abweichung**,
 * und Equal Pay gilt ab dem ersten Überlassungstag. Das ist die strengste Folge
 * einer fehlenden Angabe in diesem Kapitel — und die rechtlich einzig mögliche.
 *
 * **Grenze der Prüfbarkeit** (5.2.1): das System führt kein Entgelt des
 * Leiharbeitnehmers (1.4, 3.0). P3 stellt fest, **wann** Equal Pay geschuldet
 * ist, nie **ob** es gezahlt wurde. Die Einhaltung bleibt Pflicht des
 * Verleihers.
 *
 * Dieses Modul ist **rein**: es liest eine Lage und gibt ein Ergebnis zurück.
 * Die Ergebnisart wählt `pruefwerk.ts` anhand der Querschnittstabelle 4.7
 * (5.5.1 a) — dieser Rechenweg sagt nur, *ob* ein Treffer vorliegt.
 */

import {
  istVorOderGleich,
  liegtImZeitraum,
  monatsfristEnde,
  tageDesZeitraums,
  tagesdifferenz,
  type Tag,
} from '../kalender'
import { REGELWERK, type Regelwerkkonfiguration } from '../regelwerk'
import type { Rollenkuerzel } from '../typen'
import {
  bezugstagVon,
  bildeKette,
  tagFuerBudget,
  zaehleDauer,
  type Kettenlage,
} from './p1Hoechstdauer'

/**
 * Welcher der sechs Fälle aus 5.2.2 die Frist bestimmt. Der Fall gehört zum
 * Ergebnis: er sagt, **warum** mit diesem Wert gerechnet wird, und zwei der
 * Fälle sind für sich schon ein Befund.
 */
export type Fristfall =
  /** Fall 1 — keine gültige Zuordnung der Verleiherseite: 0 Monate, Warnung. */
  | 'ohneVerleihertarif'
  /** Fall 2 — Zuordnung vorhanden, Frist leer: gesetzliche Regelfrist. */
  | 'regelfrist'
  /** Fälle 3 und 4 — der angegebene Wert gilt. */
  | 'tariflich'
  /** Fall 5 — über der Regelfrist ohne Zuschlagsschema: nicht verwendbar. */
  | 'ohneSchemaAufRegelfrist'
  /** Fall 6 — über der gesetzlichen Obergrenze: auf sie begrenzt. */
  | 'begrenztAufObergrenze'

/** Warum die Rechnung nicht durchgeht (5.2.7, 5.1.8). */
export type EqualPaymangel =
  /** Die Kette ist nicht bildbar — kein Kettenbeginn (5.1.8). */
  | 'kettenbeginnFehlt'
  /** Die Fälligkeit ist erreicht und `comparableWage` fehlt (5.2.3, Schritt 4). */
  | 'entgeltFehltNachFaelligkeit'
  /** Die Fälligkeit liegt vor dem Prüfzeitraum — längst erreicht. */
  | 'faelligkeitVergangen'

/** Die Lage, gegen die P3 rechnet (SPEC 5.2.3, Eingangsdaten E1 bis E9). */
export interface EqualPaylage {
  /** E1 bis E5 und E7 — die Kette, unverändert aus 5.1.3. */
  readonly kette: Kettenlage
  /**
   * Ist am Stichtag eine Zuordnung mit `appliesToType = supplier` gültig
   * (3.3)? `false` ist Fall 1 aus 5.2.2 und **nicht** dasselbe wie eine
   * Zuordnung ohne Fristangabe (Fall 2).
   */
  readonly verleihertarifVorhanden: boolean
  /** E8 — `equalPayDeadlineMonths`; `null` heißt: nicht angegeben. */
  readonly fristMonateAngegeben: number | null
  /** E9 — `industryPremiumScheme`; `null` heißt: keines zugeordnet. */
  readonly zuschlagsschema: string | null
  /** `assignment.comparableWage` ist gesetzt (3.7). */
  readonly vergleichsentgeltGesetzt: boolean
  /** `assignment.equalPayDueDate` als gepflegtes abgeleitetes Feld (3.7). */
  readonly gesetzteFaelligkeit: Tag | null
}

export interface EqualPayergebnis {
  readonly kunde: string
  readonly kettenbeginn: Tag | null
  readonly fristMonate: number
  readonly fristfall: Fristfall
  /** `equalPayDeadlineDays` (5.2.3, Schritt 2). */
  readonly fristbudget: number | null
  /**
   * Letzter Kalendertag der Monatsfrist ab `kettenbeginn` — der letzte Tag
   * **ohne** Equal-Pay-Pflicht. Er begrenzt das Fristbudget (Schritt 2) und ist
   * der Vortag der Fälligkeit bei lückenloser Kette.
   */
  readonly budgetende: Tag | null
  /** `equalPayDueDate` — der **erste** Tag mit Equal-Pay-Pflicht (Schritt 3). */
  readonly faelligkeit: Tag | null
  readonly angerechneteDauer: number | null
  /** Kalendertage der bewerteten Lücke — sie verschieben die Fälligkeit. */
  readonly lueckentage: number | null
  /** Letzter Tag, über den die Prüfung entscheidet. */
  readonly bezugstag: Tag | null
  /** Die Fälligkeit liegt im Prüfzeitraum. */
  readonly faelligkeitImZeitraum: boolean
  /** Die Fälligkeit liegt **vor** dem Prüfzeitraum (Schritt 4, vierter Fall). */
  readonly faelligkeitVergangen: boolean
  /** Restzeit bis zur Fälligkeit in Tagen; negativ heißt: überschritten. */
  readonly restTage: number | null
  /**
   * Ein Treffer im Sinne von 5.2.3, Schritt 4: die Fälligkeit ist erreicht und
   * `comparableWage` fehlt. Ob daraus eine Warnung oder eine Sperre wird, sagt
   * 4.7 (5.5.1 a).
   */
  readonly treffer: boolean
  /**
   * Die Fristkonfiguration selbst ist zu beanstanden (Fälle 1, 5 und 6). Das
   * ist **unabhängig** vom Vergleichsentgelt ein Befund: 5.2.2 führt für diese
   * Fälle ausdrücklich eine Warnung, nicht eine Information.
   */
  readonly konfigurationsmangel: boolean
  /**
   * 5.2.6, Grenzfall „Fehlende Personenidentität": ist die Zählgrundlage auf
   * **einen** Lieferanten begrenzt, kann die Fälligkeit nur zu spät berechnet
   * werden, nie zu früh — und das Ergebnis ist „bei fehlendem `comparableWage`
   * **mindestens eine Warnung**". Die Begrenzung ist kein Rechenfehler, sie
   * macht das Ergebnis aber unzuverlässig; eine Information wäre dann zu
   * freundlich.
   */
  readonly mindestensWarnung: boolean
  /** Die Fälligkeit liegt innerhalb von `equalPayNoticeDays` (5.0). */
  readonly vorlaufErreicht: boolean
  /**
   * Die Fälligkeit liegt innerhalb von `equalPayWarningDays` **und**
   * `comparableWage` fehlt (5.0, Festwerte): der Eskalationsanlass
   * „Equal-Pay-Frist erreicht, Vergleichsentgelt fehlt" aus 2.4.
   */
  readonly warnungErreicht: boolean
  readonly mangel: EqualPaymangel | null
  readonly vermerke: readonly string[]
  readonly adressaten: readonly Rollenkuerzel[]
  readonly meldung: string
}

/** P3 — die Equal-Pay-Fälligkeit rechnen (SPEC 5.2.3). */
export function pruefeEqualPayFrist(
  lage: EqualPaylage,
  konfiguration: Regelwerkkonfiguration = REGELWERK,
): EqualPayergebnis {
  const kettenlage = lage.kette
  const frist = bestimmeFrist(lage, konfiguration)

  // Schritt 1: Kette bilden — Schritte 1 und 2 aus 5.1.3, unverändert.
  const bezugstag = bezugstagVon(kettenlage)
  const kette = bildeKette(kettenlage, bezugstag, konfiguration)
  const angerechneteDauer = zaehleDauer(kettenlage, kette)

  // Schritt 2: Fristbudget. Bei 0 Monaten ist das Budget 0 — Equal Pay gilt ab
  // dem ersten Überlassungstag und es ist nichts abzuzählen.
  const fristbudget =
    kette.beginn === null
      ? null
      : frist.monate === 0
        ? 0
        : tageDesZeitraums(kette.beginn, monatsfristEnde(kette.beginn, frist.monate)).length

  // Schritt 3: Fälligkeit. `equalPayDueDate` ist der (Budget + 1)-te
  // Überlassungstag der Kette — der **erste** Tag, für den Equal Pay geschuldet
  // ist, nicht der letzte ohne (5.2.6). Lückentage verbrauchen Kalenderzeit,
  // aber kein Fristbudget: `tagFuerBudget` zählt Überlassungstage ab, nicht
  // Kalendertage (*offene Frage 26*).
  const budgetende =
    kette.beginn === null || frist.monate === 0
      ? null
      : monatsfristEnde(kette.beginn, frist.monate)

  const gerechnet =
    kette.beginn === null || fristbudget === null
      ? null
      : fristbudget === 0
        ? kette.beginn
        : tagFuerBudget(kette.tage, fristbudget + 1)
  const faelligkeit = gerechnet ?? lage.gesetzteFaelligkeit

  const zeitraum = kettenlage.zeitraum
  const faelligkeitImZeitraum =
    faelligkeit !== null &&
    zeitraum !== null &&
    liegtImZeitraum(faelligkeit, zeitraum.von, zeitraum.bis)
  const faelligkeitVergangen =
    faelligkeit !== null &&
    ((zeitraum !== null && !istVorOderGleich(zeitraum.von, faelligkeit)) ||
      (zeitraum === null &&
        kettenlage.stichtag !== null &&
        !istVorOderGleich(kettenlage.stichtag, faelligkeit) &&
        faelligkeit !== kettenlage.stichtag))

  // Schritt 4: Ergebnis. Der Treffer setzt beides voraus — erreichte Fälligkeit
  // **und** fehlendes Vergleichsentgelt. Ist der Wert gesetzt, ist das Ergebnis
  // eine Information, auch wenn die Fälligkeit längst erreicht ist.
  const erreicht = faelligkeitImZeitraum || faelligkeitVergangen || amStichtagErreicht(
    faelligkeit,
    kettenlage.stichtag,
  )
  const treffer = erreicht && !lage.vergleichsentgeltGesetzt

  const restTage =
    faelligkeit === null || bezugstag === null ? null : tagesdifferenz(bezugstag, faelligkeit)
  const vorlaufErreicht =
    restTage !== null && restTage >= 0 && restTage <= konfiguration.equalPay.hinweisTage
  const warnungErreicht =
    !lage.vergleichsentgeltGesetzt &&
    restTage !== null &&
    restTage >= 0 &&
    restTage <= konfiguration.equalPay.warnungTage

  const mangel: EqualPaymangel | null =
    kette.beginn === null && faelligkeit === null
      ? 'kettenbeginnFehlt'
      : treffer && faelligkeitVergangen
        ? 'faelligkeitVergangen'
        : treffer
          ? 'entgeltFehltNachFaelligkeit'
          : null

  const vermerke = sammleVermerke(kettenlage, frist)
  // Nur die **fehlende** Personenidentität hebt das Ergebnis an. Der
  // unbestätigte maschinelle Vorschlag steht in 5.2.6 in einer eigenen Zeile und
  // trägt dort allein „Zählt nicht (3.6)" — sein Ergebnis ist eine Information.
  // Das ist kein Widerspruch: die begrenzte Kette **rechnet** mit zu wenigen
  // Tagen, der unbestätigte Vorschlag wird gar nicht erst angerechnet.
  const mindestensWarnung =
    !lage.vergleichsentgeltGesetzt && kettenlage.zaehlgrundlage === 'einLieferant'
  const ergebnis = {
    kunde: kettenlage.kunde,
    kettenbeginn: kette.beginn,
    fristMonate: frist.monate,
    fristfall: frist.fall,
    fristbudget,
    budgetende,
    faelligkeit,
    angerechneteDauer,
    lueckentage: lueckentageVon(kettenlage),
    bezugstag,
    faelligkeitImZeitraum,
    faelligkeitVergangen,
    restTage,
    treffer,
    konfigurationsmangel: frist.mangel,
    mindestensWarnung,
    vorlaufErreicht,
    warnungErreicht,
    mangel,
    vermerke,
  }

  return {
    ...ergebnis,
    adressaten: adressaten(ergebnis, konfiguration),
    meldung: meldung(ergebnis, konfiguration),
  }
}

/* ------------------------------------------------------------------ */
/* Welche Frist gilt (SPEC 5.2.2, Fälle 1 bis 6)                       */
/* ------------------------------------------------------------------ */

interface Fristbestimmung {
  readonly monate: number
  readonly fall: Fristfall
  /** Die Konfiguration ist zu beanstanden (Fälle 1, 5 und 6). */
  readonly mangel: boolean
}

/**
 * Die Rangfolge der sechs Fälle aus 5.2.2. Die Reihenfolge ist **nicht**
 * beliebig: ohne Zuschlagsschema ist die Verlängerung über die Regelfrist
 * überhaupt nicht eröffnet (§ 8 Abs. 4 Satz 2), deshalb wird Fall 5 **vor**
 * Fall 6 geprüft. Ein Wert von 18 Monaten ohne Schema ergibt 9 Monate, nicht
 * 15 — die Obergrenze gilt der stufenweisen Annäherung, die hier fehlt.
 */
function bestimmeFrist(
  lage: EqualPaylage,
  konfiguration: Regelwerkkonfiguration,
): Fristbestimmung {
  const { regelfristMonate, obergrenzeMonate } = konfiguration.equalPay

  // Fall 1: keine gültige Zuordnung der Verleiherseite. **Nicht** die
  // Regelfrist — die Abweichung setzt den Tarifvertrag voraus (5.2.7).
  if (!lage.verleihertarifVorhanden) {
    return { monate: 0, fall: 'ohneVerleihertarif', mangel: true }
  }

  // Fall 2: Zuordnung vorhanden, Frist leer.
  const angegeben = lage.fristMonateAngegeben
  if (angegeben === null) {
    return { monate: regelfristMonate, fall: 'regelfrist', mangel: false }
  }

  // Fall 3: bis zur Regelfrist gilt der angegebene Wert.
  if (angegeben <= regelfristMonate) {
    return { monate: angegeben, fall: 'tariflich', mangel: false }
  }

  // Fall 5: über der Regelfrist ohne Schema — der Wert ist nicht verwendbar.
  if (lage.zuschlagsschema === null) {
    return { monate: regelfristMonate, fall: 'ohneSchemaAufRegelfrist', mangel: true }
  }

  // Fall 6: über der gesetzlichen Obergrenze.
  if (angegeben > obergrenzeMonate) {
    return { monate: obergrenzeMonate, fall: 'begrenztAufObergrenze', mangel: true }
  }

  // Fall 4: über der Regelfrist, mit Schema, innerhalb der Obergrenze.
  return { monate: angegeben, fall: 'tariflich', mangel: false }
}

/* ------------------------------------------------------------------ */
/* Schritte und Hilfsrechnungen                                        */
/* ------------------------------------------------------------------ */

/**
 * Die Fälligkeit ist am Stichtag erreicht, wenn sie auf ihn oder vor ihn fällt.
 * Der Tag der Fälligkeit zählt mit — er ist der erste Tag mit Pflicht (5.2.6).
 */
function amStichtagErreicht(faelligkeit: Tag | null, stichtag: Tag | null): boolean {
  if (faelligkeit === null || stichtag === null) return false
  return istVorOderGleich(faelligkeit, stichtag)
}

function lueckentageVon(lage: Kettenlage): number | null {
  const luecke = lage.luecke
  if (luecke === null) return null
  const bis = luecke.bis ?? lage.stichtag
  if (bis === null) return null
  if (!istVorOderGleich(luecke.von, bis)) return 0
  return tagesdifferenz(luecke.von, bis) + 1
}

/**
 * Die Vermerke aus 5.2.6: eine begrenzte Zählgrundlage kann die Fälligkeit nur
 * **zu spät** ergeben, nie zu früh. Das gehört ins Ergebnis, weil es seine
 * Belastbarkeit beschreibt.
 */
function sammleVermerke(lage: Kettenlage, frist: Fristbestimmung): readonly string[] {
  const vermerke: string[] = []
  if (lage.zaehlgrundlage === 'einLieferant') {
    vermerke.push('Zählgrundlage auf einen Lieferanten begrenzt')
  }
  if (lage.zaehlgrundlage === 'unbestaetigterVorschlag') {
    vermerke.push('unbestätigter Identitätsvorschlag liegt vor')
  }
  if (frist.fall === 'ohneVerleihertarif') {
    vermerke.push('keine Tarifzuordnung der Verleiherseite am Stichtag')
  }
  if (frist.fall === 'ohneSchemaAufRegelfrist') {
    vermerke.push('Frist über der Regelfrist ohne Branchenzuschlagsschema')
  }
  if (frist.fall === 'begrenztAufObergrenze') {
    vermerke.push('Frist auf die gesetzliche Obergrenze begrenzt')
  }
  return vermerke
}

type Zwischenergebnis = Omit<EqualPayergebnis, 'adressaten' | 'meldung'>

function adressaten(
  ergebnis: Zwischenergebnis,
  konfiguration: Regelwerkkonfiguration,
): readonly Rollenkuerzel[] {
  const empfaenger = new Set<Rollenkuerzel>()

  if (ergebnis.fristfall === 'ohneVerleihertarif') {
    for (const rolle of konfiguration.adressatenVerleihertarifFehlt) empfaenger.add(rolle)
  }
  if (
    ergebnis.fristfall === 'ohneSchemaAufRegelfrist' ||
    ergebnis.fristfall === 'begrenztAufObergrenze'
  ) {
    for (const rolle of konfiguration.adressatenFristkonfiguration) empfaenger.add(rolle)
  }
  if (ergebnis.treffer || ergebnis.warnungErreicht) {
    for (const rolle of konfiguration.adressatenEqualPayWarnung) empfaenger.add(rolle)
  } else if (ergebnis.vorlaufErreicht) {
    for (const rolle of konfiguration.adressatenEqualPayHinweis) empfaenger.add(rolle)
  }
  if (ergebnis.vermerke.some((vermerk) => vermerk.startsWith('Zählgrundlage'))) {
    for (const rolle of konfiguration.adressatenZaehlgrundlage) empfaenger.add(rolle)
  }
  return [...empfaenger]
}

function meldung(
  ergebnis: Zwischenergebnis,
  konfiguration: Regelwerkkonfiguration,
): string {
  const teile: string[] = []
  const { regelfristMonate, obergrenzeMonate } = konfiguration.equalPay

  switch (ergebnis.fristfall) {
    case 'ohneVerleihertarif':
      teile.push(
        'P3: Am Stichtag ist keine Tarifzuordnung der Verleiherseite gültig. Damit gibt es ' +
          'keine Abweichung vom Gleichstellungsgrundsatz: Equal Pay ist ab dem **ersten** ' +
          `Überlassungstag geschuldet, nicht erst nach ${regelfristMonate} Monaten — die Frist ` +
          'setzt den Tarifvertrag voraus (§ 8 Abs. 1, Abs. 2 AÜG; SPEC 5.2.2, Fall 1).',
      )
      break
    case 'regelfrist':
      teile.push(
        `P3: Die Tarifzuordnung nennt keine abweichende Frist; es gilt die gesetzliche ` +
          `Regelfrist von ${regelfristMonate} Monaten (§ 8 Abs. 4 Satz 1 AÜG; SPEC 5.2.2, ` +
          'Fall 2).',
      )
      break
    case 'ohneSchemaAufRegelfrist':
      teile.push(
        `P3: Die Tarifzuordnung nennt eine Frist über ${regelfristMonate} Monaten, aber kein ` +
          'Branchenzuschlagsschema. Der angegebene Wert ist nicht verwendbar — die Verlängerung ' +
          'über die Regelfrist setzt die stufenweise Annäherung voraus (§ 8 Abs. 4 Satz 2 AÜG). ' +
          `Gerechnet wird mit ${regelfristMonate} Monaten (SPEC 5.2.2, Fall 5).`,
      )
      break
    case 'begrenztAufObergrenze':
      teile.push(
        `P3: Die angegebene Frist liegt über der gesetzlichen Obergrenze; gerechnet wird mit ` +
          `höchstens ${obergrenzeMonate} Monaten (§ 8 Abs. 4 Satz 2 AÜG; SPEC 5.2.2, Fall 6).`,
      )
      break
    case 'tariflich':
      teile.push(
        `P3: Es gilt die tarifliche Frist von ${ergebnis.fristMonate} Monaten (SPEC 5.2.2).`,
      )
      break
  }

  if (ergebnis.kettenbeginn !== null && ergebnis.fristbudget !== null) {
    teile.push(
      `Die Kette beginnt am ${ergebnis.kettenbeginn}; das Fristbudget beträgt ` +
        `${ergebnis.fristbudget} Kalendertage` +
        `${ergebnis.budgetende === null ? '' : ` bis zum ${ergebnis.budgetende}`}.`,
    )
  }
  if (ergebnis.faelligkeit !== null) {
    teile.push(
      `Equal Pay ist ab dem ${ergebnis.faelligkeit} geschuldet — das ist der erste Tag mit ` +
        'Pflicht, nicht der letzte ohne (SPEC 5.2.6).',
    )
  } else {
    teile.push(
      'Die Fälligkeit ist nicht bestimmbar: die Überlassungskette ist nicht bildbar ' +
        '(SPEC 5.1.8, 5.2.3).',
    )
  }

  if (ergebnis.lueckentage !== null && ergebnis.lueckentage > 0) {
    teile.push(
      `Die ${ergebnis.lueckentage} Lückentage verbrauchen Kalenderzeit, aber kein Fristbudget; ` +
        'die Fälligkeit verschiebt sich um sie nach hinten (*offene Frage 26*).',
    )
  }

  if (ergebnis.treffer && ergebnis.faelligkeitVergangen) {
    teile.push(
      'Die Fälligkeit liegt vor dem Prüfzeitraum und das Vergleichsentgelt fehlt: das Ergebnis ' +
        'ist eine Warnung mit Pflicht-Eskalation, keine rückwirkende Sperre (SPEC 5.2.3, ' +
        'Schritt 4; 5.5.3).',
    )
  } else if (ergebnis.treffer) {
    teile.push(
      'Die Fälligkeit ist im Prüfzeitraum erreicht und `comparableWage` fehlt; der Entleiher ' +
        'trägt den Wert nach (SPEC 3.3, 3.7).',
    )
  } else if (ergebnis.warnungErreicht) {
    teile.push(
      `Die Fälligkeit liegt in ${ergebnis.restTage} Tagen und \`comparableWage\` fehlt: der ` +
        'Eskalationsanlass „Equal-Pay-Frist erreicht, Vergleichsentgelt fehlt" wird erzeugt ' +
        `(SPEC 5.0, \`equalPayWarningDays\` = ${konfiguration.equalPay.warnungTage} Tage; 2.4). ` +
        'Die Warnung verfällt nicht und wird im nächsten Lauf erneut festgestellt.',
    )
  } else if (ergebnis.vorlaufErreicht) {
    teile.push(
      `Die Fälligkeit liegt in ${ergebnis.restTage} Tagen und damit innerhalb des Vorlaufs von ` +
        `${konfiguration.equalPay.hinweisTage} Tagen (SPEC 5.0, \`equalPayNoticeDays\`).`,
    )
  }

  if (ergebnis.mindestensWarnung) {
    teile.push(
      'Die Zählgrundlage ist begrenzt und `comparableWage` fehlt: die Fälligkeit kann dadurch ' +
        'nur **zu spät** berechnet werden, nie zu früh. Das Ergebnis ist deshalb mindestens ' +
        'eine Warnung (SPEC 5.2.6).',
    )
  }

  if (ergebnis.vermerke.length > 0) {
    teile.push(`Vermerke: ${ergebnis.vermerke.join('; ')}.`)
  }

  teile.push(
    'P3 stellt fest, **wann** Equal Pay geschuldet ist, nicht ob es gezahlt wurde — das System ' +
      'führt kein Entgelt des Leiharbeitnehmers (SPEC 5.2.1).',
  )
  return teile.join(' ')
}
