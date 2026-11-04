/**
 * Das Prüfwerk — die **eine** Stelle, an der ein Vorgang gegen das AÜG-Regelwerk
 * geprüft wird (SPEC Kapitel 5).
 *
 * Aufbau und Begründung:
 *
 *  - **Eine Eingangsstelle.** `pruefe()` nimmt einen Prüfauftrag und gibt
 *    Befunde zurück. Es gibt keinen zweiten Weg in das Regelwerk; wer prüfen
 *    will, ruft diese Funktion. Damit ist auch gesichert, dass jedes Ergebnis
 *    protokolliert werden kann (5.5.2 Nr. 1).
 *  - **Eine Zeile je Prüfung.** `REGELN` ordnet jeder der elf Prüfungen aus 4.7
 *    ihren Rechenweg zu. Was nicht eingetragen ist, liefert **keinen** Befund —
 *    und damit bleibt das Szenario, das die Prüfung erwartet, ausstehend. Eine
 *    nicht umgesetzte Prüfung darf nicht wie eine erfüllte aussehen.
 *  - **Die Ergebnisart kommt aus 4.7**, nicht aus dem Rechenweg (5.5.1 a). Der
 *    Rechenweg sagt, *ob* ein Treffer vorliegt; `querschnitt.ts` sagt, *was er
 *    bewirkt*.
 *  - **Das Prüfwerk schreibt nichts.** Es vollzieht keinen Statusübergang und
 *    speichert nichts; es stellt fest. Ob der Übergang stattfindet, sagt der
 *    Befund (`uebergangVollzogen`), vollziehen muss ihn der Aufrufer über die
 *    Übergangsmenge in `lib/status/` (4.0, Regel 1).
 *
 * **Stand:** umgesetzt sind **P9** (AÜG-Erlaubnis, SPEC 5.4.1) mit dem
 * nächtlichen Lauf N1 und **P10** (Pflichtnachweise, SPEC 5.4.4) mit N5, beide
 * mit der Übersteuerung nach 5.5.4. P1 bis P8 und P11 sind eingetragen, aber
 * ohne Rechenweg — sie melden nichts.
 */

import { leseErlaubnislage, type Prueflage } from './lesen/erlaubnislage'
import { leseNachweislage, type Nachweisprueflage } from './lesen/nachweislage'
import {
  pruefeNachweise,
  pruefeNachweisVorlauf,
  type Nachweisergebnis,
} from './regeln/p10Nachweise'
import { QUERSCHNITT } from './querschnitt'
import {
  pruefeErlaubnis,
  pruefeVorlauf,
  type Erlaubnisergebnis,
  type Vorlaufergebnis,
} from './regeln/p9Erlaubnis'
import { REGELWERK } from './regelwerk'
import type { Befund, Ergebnisart, Pruefauftrag, Pruefung } from './typen'

export type {
  Befund,
  Ergebnisart,
  GeleseneWerte,
  Pruefauftrag,
  Pruefung,
  Sachverhalt,
  Ausloeser,
} from './typen'

/** Bezeichner der Prüfung im Protokoll (`ruleRef`, SPEC 3.12 und 4.7). */
const REGELBEZEICHNER: Readonly<Record<Pruefung, string>> = {
  P1: 'maxDurationCheck',
  P2: 'interruptionResetCheck',
  P3: 'equalPayDeadlineCheck',
  P4: 'comparableWageCheck',
  P5: 'industryPremiumCheck',
  P6: 'revolvingDoorCheck',
  P7: 'industrialActionCheck',
  P8: 'concretizationCheck',
  P9: 'permitValidityCheck',
  P10: 'mandatoryDocumentCheck',
  P11: 'employmentRelationshipCheck',
}

type Rechenweg = (auftrag: Pruefauftrag) => readonly Befund[]

/**
 * Die elf Prüfungen aus 4.7. `null` heißt: der Rechenweg ist noch nicht gebaut.
 * Die Zeile steht trotzdem hier, damit sichtbar ist, was fehlt — und damit
 * niemand sie versehentlich als „läuft" liest.
 */
const REGELN: Readonly<Record<Pruefung, Rechenweg | null>> = {
  P1: null,
  P2: null,
  P3: null,
  P4: null,
  P5: null,
  P6: null,
  P7: null,
  P8: null,
  P9: pruefeP9,
  P10: pruefeP10,
  P11: null,
}

/**
 * Prüft einen Vorgang gegen die Prüfungen, die 4.7 ihm zuordnet. Gibt je
 * Feststellung einen Befund zurück; das strengste Ergebnis gewinnt, geführt
 * werden alle einzeln (5.5.2 Nr. 2).
 */
export function pruefe(auftrag: Pruefauftrag): readonly Befund[] {
  const befunde: Befund[] = []
  for (const pruefung of auftrag.erwartetePruefungen) {
    const rechenweg = REGELN[pruefung]
    if (rechenweg === null) continue
    try {
      befunde.push(...rechenweg(auftrag))
    } catch (fehler) {
      throw new Error(
        `${pruefung} (${REGELBEZEICHNER[pruefung]}) konnte den Vorgang „${auftrag.szenario.name}" ` +
          `nicht rechnen: ${fehler instanceof Error ? fehler.message : String(fehler)}`,
        { cause: fehler },
      )
    }
  }
  return befunde
}

/** Die Prüfungen, für die ein Rechenweg vorliegt. */
export function umgesetztePruefungen(): readonly Pruefung[] {
  return (Object.keys(REGELN) as Pruefung[]).filter((pruefung) => REGELN[pruefung] !== null)
}

/** Zielstatus einer Einladung nach 4.7, Zeile Q06 (3.5, 4.2.1). */
const EINLADUNG_ZIELSTATUS =
  QUERSCHNITT.find((zeile) => zeile.objekt === 'einladung' && zeile.pruefung === 'P9')?.nach ??
  'invited'

/** P9 — AÜG-Erlaubnis des Lieferanten (SPEC 5.4.1). */
function pruefeP9(auftrag: Pruefauftrag): readonly Befund[] {
  const lage = leseErlaubnislage(auftrag.sachverhalte, auftrag.ausloeser)

  if (lage.anlass === 'nachtlauf') return [nachtlaufBefund(lage)]
  if (lage.uebersteuerung.beantragt) return uebersteuerungsbefunde(lage)
  if (lage.zeile?.jeEinladung === true) return einladungsbefunde(lage)

  const ergebnis = pruefeErlaubnis(lage.gegenstand.lage)
  return [vorgangsbefund(lage, ergebnis)]
}

/**
 * N1 (SPEC 5.5.1): der nächtliche Lauf stellt den Ablauf fest, erzeugt die
 * gestufte Warnung aus 5.4.4 und **keinen** Statuswechsel (5.4.2 a).
 */
function nachtlaufBefund(lage: Prueflage): Befund {
  const stichtag = lage.stichtag
  if (stichtag === null) {
    return befund(lage, 'P9', 'warnung', false, {
      ergaenzung: {
        mangel: 'zeitraumNichtBestimmbar',
        vorlaufstufe: null,
        restzeitTage: null,
      },
      adressaten: REGELWERK.stufenadressaten.permitCertificate.abgelaufen,
      meldung:
        'P9: Der nächtliche Lauf nennt keinen Stichtag; ohne Stichtag ist die Erlaubnis nicht ' +
        'prüfbar (SPEC 5.0, 5.5.1 c).',
    })
  }

  const vorlauf: Vorlaufergebnis = pruefeVorlauf(lage.gegenstand.lage, stichtag)
  // Die Stufe entscheidet die Ergebnisart: Information im Vorlauf, Warnung ab
  // der Warnstufe, Warnung mit Eskalation darüber (5.4.4). Eine Sperre erzeugt
  // der nächtliche Lauf nicht — sie bräuchte einen Übergang (5.5.1 c).
  const art: Ergebnisart = vorlauf.stufe === 'information' || vorlauf.stufe === 'keine'
    ? 'information'
    : 'warnung'

  return befund(lage, 'P9', art, false, {
    ergaenzung: {
      vorlaufstufe: vorlauf.stufe,
      restzeitTage: vorlauf.restzeitTage,
      erlaubnisEndeBis: vorlauf.endeBis,
      eskalation: vorlauf.stufe === 'eskalation' || vorlauf.stufe === 'abgelaufen' ? 'ja' : 'nein',
    },
    adressaten: vorlauf.adressaten,
    meldung: vorlauf.meldung,
  })
}

/**
 * Q04 (SPEC 5.4.1, „Sperre je Einladung, nicht je Ausschreibung"): P9 wird je
 * eingeladenem Lieferanten geprüft. Ein gesperrter Lieferant wird nicht
 * eingeladen; der Übergang der Bedarfsanfrage findet trotzdem statt, solange
 * mindestens eine zulässige Einladung bleibt.
 */
function einladungsbefunde(lage: Prueflage): readonly Befund[] {
  const geprueft = lage.einladungen.length > 0 ? lage.einladungen : [lage.gegenstand]
  const trefferart = lage.zeile?.trefferart ?? 'sperre'
  const ergebnisse = geprueft.map((lieferant) => pruefeErlaubnis(lieferant.lage))

  const befunde: Befund[] = ergebnisse.map((ergebnis) => {
    const art: Ergebnisart = ergebnis.gedeckt ? 'information' : trefferart
    return befund(lage, 'P9', art, ergebnis.gedeckt, {
      ergaenzung: {
        ...erlaubniswerte(ergebnis),
        gegenstand: 'Einladung',
        statusNachher: ergebnis.gedeckt ? EINLADUNG_ZIELSTATUS : null,
        statusVorher: null,
      },
      adressaten: ergebnis.adressaten,
      meldung: ergebnis.meldung,
    })
  })

  const zulaessige = ergebnisse.filter((ergebnis) => ergebnis.gedeckt).length
  const bleibtEineZulaessig = zulaessige > 0
  befunde.push(
    befund(lage, 'P9', bleibtEineZulaessig ? 'information' : trefferart, bleibtEineZulaessig, {
      ergaenzung: {
        gegenstand: 'Ausschreibung',
        einladungenGeprueft: geprueft.length,
        einladungenZulaessig: zulaessige,
      },
      adressaten: bleibtEineZulaessig ? [] : REGELWERK.adressatenErlaubnisFehlt,
      meldung: bleibtEineZulaessig
        ? 'P9: Mindestens eine Einladung ist zulässig; der Übergang der Bedarfsanfrage findet statt ' +
          '(SPEC 5.4.1, „Sperre je Einladung, nicht je Ausschreibung").'
        : 'P9: Kein eingeladener Lieferant hat eine anerkannte und gültige Erlaubnis; der Übergang ' +
          'der Bedarfsanfrage ist gesperrt (SPEC 5.4.1).',
    }),
  )
  return befunde
}

/**
 * Übersteuerung einer Sperre (SPEC 5.5.4). Zulässig nur, wenn **alle drei**
 * Bedingungen erfüllt sind. Fehlt (c) — die Überlassung wäre auch nach
 * richtiger Datenlage unzulässig —, ist die Sperre nicht übersteuerbar; dann
 * ist der Vorgang zu unterlassen. Eine Übersteuerung korrigiert eine falsche
 * Datenlage, sie erlaubt keine rechtswidrige Überlassung.
 */
function uebersteuerungsbefunde(lage: Prueflage): readonly Befund[] {
  const { angabeUnrichtig, berichtigungNichtMoeglich, datenlageZulaessig } = lage.uebersteuerung
  const zulaessig = angabeUnrichtig && berichtigungNichtMoeglich && datenlageZulaessig

  if (!zulaessig) {
    return [
      befund(lage, 'P9', 'sperre', false, {
        ergaenzung: {
          uebersteuerung: 'zurückgewiesen',
          bedingungA: angabeUnrichtig ? 'ja' : 'nein',
          bedingungB: berichtigungNichtMoeglich ? 'ja' : 'nein',
          bedingungC: datenlageZulaessig ? 'ja' : 'nein',
        },
        adressaten: REGELWERK.adressatenRueckwirkenderBefund,
        meldung:
          'P9: Die Übersteuerung wird zurückgewiesen. ' +
          (datenlageZulaessig
            ? 'Die Bedingungen (a) und (b) aus SPEC 5.5.4 sind nicht beide erfüllt.'
            : 'Die Überlassung wäre auch nach richtiger Datenlage unzulässig — Bedingung (c) aus ' +
              'SPEC 5.5.4 fehlt, und dann ist die Sperre nicht übersteuerbar.'),
      }),
    ]
  }

  // Invariante 5: zwei Protokolleinträge — der abgelehnte Übergang mit
  // `blocked` und der vollzogene mit `success`, `ruleRef` und `reason`.
  return [
    befund(lage, 'P9', 'sperre', false, {
      ergaenzung: { uebersteuerung: 'übersteuert' },
      adressaten: REGELWERK.adressatenErlaubnisFehlt,
      meldung:
        'P9: Die Sperre bestand und wird protokolliert; die Spur zeigt, dass eine Sperre bestand — ' +
        'nicht nur, dass ein Übergang geschah (SPEC 5.5.4, Invariante 5).',
    }),
    befund(lage, 'P9', 'warnung', true, {
      ergaenzung: { uebersteuerung: 'vollzogen' },
      adressaten: REGELWERK.adressatenRueckwirkenderBefund,
      meldung:
        'P9: Der Übergang wurde mit Pflichtbegründung übersteuert; er gilt für genau diesen einen ' +
        'Übergang. Die Übersteuerung ersetzt keine Erlaubnis und heilt die Rechtslage nicht ' +
        '(SPEC 5.5.4, Invarianten 1, 4 und 6).',
    }),
  ]
}

/** Ein Übergang, eine Berichtigung oder eine angestoßene Berechnung. */
function vorgangsbefund(lage: Prueflage, ergebnis: Erlaubnisergebnis): Befund {
  // Ohne Zeile in 4.7 gibt es keinen Übergang, den eine Sperre verhindern
  // könnte; dann ist der Treffer eine Feststellung (5.5.2 Nr. 4 und 5).
  const trefferart: Ergebnisart = lage.zeile?.trefferart ?? 'warnung'
  const art: Ergebnisart = ergebnis.gedeckt ? 'information' : trefferart
  const kennStatuswechsel = lage.anlass === 'uebergang' || lage.anlass === 'uebergangsversuch'
  const vollzogen = kennStatuswechsel && art !== 'sperre'

  // 5.5.3, R3: legt eine rückwirkende Änderung einen Verstoß in der
  // Vergangenheit offen, ist das Ergebnis eine Warnung mit Pflicht-Eskalation
  // an MA — nie eine Sperre, es gibt nichts mehr zu sperren.
  const rueckwirkend = lage.anlass === 'berichtigung' && !ergebnis.gedeckt

  return befund(lage, 'P9', rueckwirkend ? 'warnung' : art, vollzogen, {
    ergaenzung: erlaubniswerte(ergebnis),
    adressaten: rueckwirkend
      ? REGELWERK.adressatenRueckwirkenderBefund
      : ergebnis.adressaten,
    meldung: rueckwirkend
      ? `${ergebnis.meldung} Der Verstoß liegt in der Vergangenheit; er wird festgestellt und ` +
        'eskaliert, nicht gesperrt (SPEC 5.5.3, R3). Abgerechnete Zeiträume werden nicht ' +
        'entwertet (R4).'
      : ergebnis.meldung,
  })
}

function erlaubniswerte(ergebnis: Erlaubnisergebnis): Record<string, string | number | null> {
  return {
    lieferant: ergebnis.lieferant,
    gedeckt: ergebnis.gedeckt ? 'ja' : 'nein',
    pruefzeitraumVon: ergebnis.zeitraum?.von ?? null,
    pruefzeitraumBis: ergebnis.zeitraum?.bis ?? null,
    tageGesamt: ergebnis.tageGesamt,
    tageGedeckt: ergebnis.tageGedeckt,
    tageUngedeckt: ergebnis.ungedeckteTage.length,
    ersterUngedeckterTag: ergebnis.ersterUngedeckterTag,
    letzterUngedeckterTag: ergebnis.ungedeckteTage[ergebnis.ungedeckteTage.length - 1] ?? null,
    ungedeckteTage: ergebnis.ungedeckteTage.join(','),
    mangel: ergebnis.mangel,
    maengel: ergebnis.maengel.join(','),
    fehlendeFelder: ergebnis.fehlendeFelder.join(','),
  }
}

interface Befundzusatz {
  readonly ergaenzung: Record<string, string | number | null>
  readonly adressaten: readonly string[]
  readonly meldung: string
}

function befund(
  lage: Prueflage,
  pruefung: Pruefung,
  ergebnisart: Ergebnisart,
  uebergangVollzogen: boolean,
  zusatz: Befundzusatz,
): Befund {
  return {
    pruefung,
    ergebnisart,
    uebergangVollzogen,
    werte: {
      ruleRef: REGELBEZEICHNER[pruefung],
      // 3.12: der abgelehnte Übergang trägt `blocked`, der vollzogene `success`.
      result: ergebnisart === 'sperre' ? 'blocked' : 'success',
      qZeile: lage.zeile?.nummer ?? null,
      anlass: lage.anlass,
      objektart: lage.objektart,
      statusVorher: lage.vonStatus,
      statusNachher: uebergangVollzogen ? lage.nachStatus : lage.vonStatus,
      stichtag: lage.stichtag,
      specReference: lage.zeile?.specReference ?? 'SPEC 5.4.1',
      ...zusatz.ergaenzung,
    },
    adressaten: zusatz.adressaten,
    meldung: zusatz.meldung,
  }
}

/** P10 — Pflichtnachweise (SPEC 5.4.4). */
function pruefeP10(auftrag: Pruefauftrag): readonly Befund[] {
  const lage = leseNachweislage(auftrag.sachverhalte, auftrag.ausloeser)

  if (lage.anlass === 'nachtlauf') return [nachweisNachtlauf(lage)]
  if (lage.uebersteuerung.beantragt) return nachweisUebersteuerung(lage)

  // Zweiter Anlass aus 5.5.1 b: wird ein Datum geändert, das Rechengrundlage
  // ist, wird neu gerechnet — und das Ergebnis ist „Information oder Warnung,
  // nie `block`". Eine Stammdatenänderung am Standort macht die Unterweisung
  // für laufende Einsätze zum Pflichtnachweis, unterbricht sie aber nicht
  // (5.4.5, Zeile „Standort verlangt Unterweisung nachträglich").
  const speicherung = lage.anlass === 'erfassung' || lage.anlass === 'berichtigung'

  // Ohne Zeile in 4.7 und ohne Speicherung prüft P10 an diesem Übergang nicht
  // (5.5.1 a: welche Prüfung wo läuft, steht ausschließlich in 4.7).
  const nummer = speicherung ? 'Speicherung' : lage.zeile?.nummer
  if (nummer === undefined) return []

  const ergebnis = pruefeNachweise(lage.lage, nummer)
  const kennStatuswechsel = lage.anlass === 'uebergang' || lage.anlass === 'uebergangsversuch'
  const vollzogen = kennStatuswechsel && ergebnis.ergebnisart !== 'sperre'

  // 5.4.4: jede Einzelfeststellung wird eigens vermerkt, das Sammelergebnis ist
  // das strengste. Deshalb ein Befund je Feststellung und einer für die Summe —
  // ein Sammelergebnis „drei Befunde" wäre nicht abarbeitbar (5.5.2 Nr. 2).
  const befunde: Befund[] = ergebnis.maengel.map((einzeln) =>
    nachweisbefund(lage, einzeln.ergebnisart, vollzogen && einzeln.ergebnisart !== 'sperre', {
      ergaenzung: {
        gegenstand: `Nachweisart ${einzeln.art}`,
        nachweisart: einzeln.art,
        bezugsobjekt: einzeln.bezugsobjekt,
        mangel: einzeln.mangel,
        pflicht: einzeln.pflicht ? 'ja' : 'nein',
        sperrend: einzeln.sperrend ? 'ja' : 'nein',
      },
      adressaten: einzeln.adressaten,
      meldung: einzeln.meldung,
    }),
  )

  befunde.push(
    nachweisbefund(lage, ergebnis.ergebnisart, vollzogen, {
      ergaenzung: nachweiswerte(ergebnis),
      adressaten: ergebnis.adressaten,
      meldung: ergebnis.meldung,
    }),
  )
  return befunde
}

/** N5 (SPEC 5.5.1): gestufter Vorlauf vor dem Ablauf eines Nachweises. */
function nachweisNachtlauf(lage: Nachweisprueflage): Befund {
  const stichtag = lage.stichtag
  if (stichtag === null) {
    return nachweisbefund(lage, 'warnung', false, {
      ergaenzung: { vorlaufstufe: null, restzeitTage: null },
      adressaten: REGELWERK.stufenadressaten.workPermit.abgelaufen,
      meldung:
        'P10: Der nächtliche Lauf nennt keinen Stichtag; ohne Stichtag ist der Ablauf eines ' +
        'Nachweises nicht feststellbar (SPEC 5.0, 5.5.1 c).',
    })
  }

  const vorlauf = pruefeNachweisVorlauf(lage.lage, stichtag)
  const art: Ergebnisart =
    vorlauf.stufe === 'information' || vorlauf.stufe === 'keine' ? 'information' : 'warnung'

  return nachweisbefund(lage, art, false, {
    ergaenzung: {
      vorlaufstufe: vorlauf.stufe,
      restzeitTage: vorlauf.restzeitTage,
      nachweisart: vorlauf.art,
      nachweisEndeBis: vorlauf.endeBis,
      eskalation: vorlauf.stufe === 'eskalation' || vorlauf.stufe === 'abgelaufen' ? 'ja' : 'nein',
    },
    adressaten: vorlauf.adressaten,
    meldung: vorlauf.meldung,
  })
}

/**
 * Übersteuerung einer Sperre aus P10 (SPEC 5.5.4): zulässig nur **eng** — der
 * Nachweis liegt vor, ist aber nicht erfasst. Bei tatsächlich fehlendem
 * Nachweis greift Bedingung (c) nicht.
 */
function nachweisUebersteuerung(lage: Nachweisprueflage): readonly Befund[] {
  const { angabeUnrichtig, berichtigungNichtMoeglich, datenlageZulaessig } = lage.uebersteuerung
  const zulaessig = angabeUnrichtig && berichtigungNichtMoeglich && datenlageZulaessig

  if (!zulaessig) {
    return [
      nachweisbefund(lage, 'sperre', false, {
        ergaenzung: {
          uebersteuerung: 'zurückgewiesen',
          bedingungA: angabeUnrichtig ? 'ja' : 'nein',
          bedingungB: berichtigungNichtMoeglich ? 'ja' : 'nein',
          bedingungC: datenlageZulaessig ? 'ja' : 'nein',
        },
        adressaten: REGELWERK.adressatenRueckwirkenderBefund,
        meldung:
          'P10: Die Übersteuerung wird zurückgewiesen. ' +
          (datenlageZulaessig
            ? 'Die Bedingungen (a) und (b) aus SPEC 5.5.4 sind nicht beide erfüllt.'
            : 'Bei tatsächlich fehlendem Nachweis greift Bedingung (c) aus SPEC 5.5.4 nicht — ' +
              'dann ist die Sperre nicht übersteuerbar.'),
      }),
    ]
  }

  return [
    nachweisbefund(lage, 'sperre', false, {
      ergaenzung: { uebersteuerung: 'übersteuert' },
      adressaten: REGELWERK.adressatenErlaubnisFehlt,
      meldung:
        'P10: Die Sperre bestand und wird protokolliert (SPEC 5.5.4, Invariante 5).',
    }),
    nachweisbefund(lage, 'warnung', true, {
      ergaenzung: { uebersteuerung: 'vollzogen' },
      adressaten: REGELWERK.adressatenRueckwirkenderBefund,
      meldung:
        'P10: Der Übergang wurde mit Pflichtbegründung übersteuert; er gilt für genau diesen ' +
        'einen Übergang und ersetzt keinen Nachweis (SPEC 5.5.4, Invarianten 1 und 6).',
    }),
  ]
}

function nachweiswerte(ergebnis: Nachweisergebnis): Record<string, string | number | null> {
  return {
    gegenstand: 'Sammelergebnis',
    erfuellt: ergebnis.erfuellt ? 'ja' : 'nein',
    geprueftArten: ergebnis.einzelbefunde.map((befund) => befund.art).join(','),
    maengel: ergebnis.maengel.map((befund) => `${befund.art}:${befund.mangel}`).join(','),
    anzahlMaengel: ergebnis.maengel.length,
    gueltigkeitGeprueft: ergebnis.gueltigkeitGeprueft ? 'ja' : 'nein',
    workPermitRequired: ergebnis.pflichtangaben['workPermitRequired'] ?? null,
    safetyBriefingRequired: ergebnis.pflichtangaben['safetyBriefingRequired'] ?? null,
  }
}

function nachweisbefund(
  lage: Nachweisprueflage,
  ergebnisart: Ergebnisart,
  uebergangVollzogen: boolean,
  zusatz: Befundzusatz,
): Befund {
  return {
    pruefung: 'P10',
    ergebnisart,
    uebergangVollzogen,
    werte: {
      ruleRef: REGELBEZEICHNER.P10,
      result: ergebnisart === 'sperre' ? 'blocked' : 'success',
      qZeile: lage.zeile?.nummer ?? null,
      anlass: lage.anlass,
      objektart: lage.objektart,
      statusVorher: lage.vonStatus,
      statusNachher: uebergangVollzogen ? lage.nachStatus : lage.vonStatus,
      stichtag: lage.stichtag,
      pruefzeitraumVon: lage.lage.zeitraum?.von ?? null,
      pruefzeitraumBis: lage.lage.zeitraum?.bis ?? null,
      specReference: lage.zeile?.specReference ?? 'SPEC 5.4.4',
      ...zusatz.ergaenzung,
    },
    adressaten: zusatz.adressaten,
    meldung: zusatz.meldung,
  }
}
