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
 *  - **Ein Vorgang, zu dem eine Prüfung ohne Rechenweg gehört, bleibt ganz
 *    unbeurteilt.** Das Ergebnis eines Übergangs ist das **strengste** seiner
 *    Einzelergebnisse (5.5.2 Nr. 2); solange ein Einzelergebnis fehlt, ist das
 *    strengste nicht bestimmbar. Deshalb liefert `pruefe()` **keinen** Befund,
 *    wenn der Vorgang eine Prüfung ohne Rechenweg erwartet, und `pruefeP1`
 *    keinen, wenn die Zeile in 4.7 eine solche mitnennt (Q27: „P1, **P3**";
 *    `Querschnittzeile.weiterePruefungen`). Das ist **keine Lücke**, sondern
 *    dieselbe Haltung wie oben: ein halb beurteilter Übergang sieht aus wie ein
 *    zulässiger, und das ist gefährlicher als ein ausstehender. Sobald der
 *    fehlende Rechenweg vorliegt, fällt die Bremse von selbst weg — sie darf
 *    nicht „repariert" werden, indem man den Vorgang halb beurteilt.
 *  - **Die Ergebnisart kommt aus 4.7**, nicht aus dem Rechenweg (5.5.1 a). Der
 *    Rechenweg sagt, *ob* ein Treffer vorliegt; `querschnitt.ts` sagt, *was er
 *    bewirkt*.
 *  - **Das Prüfwerk schreibt nichts.** Es vollzieht keinen Statusübergang und
 *    speichert nichts; es stellt fest. Ob der Übergang stattfindet, sagt der
 *    Befund (`uebergangVollzogen`), vollziehen muss ihn der Aufrufer über die
 *    Übergangsmenge in `lib/status/` (4.0, Regel 1).
 *
 * **Stand:** alle **elf** Prüfungen aus 4.7 haben einen Rechenweg — **P1**
 * (Höchstüberlassungsdauer, SPEC 5.1) mit dem nächtlichen Lauf N2, **P2**
 * (Unterbrechung, 5.1.4) mit N6, **P3** (Equal-Pay-Fälligkeit, 5.2.3), **P4**
 * (Vergleichsentgelt, 5.2.4) und **P5** (Branchenzuschlag, 5.2.5) — P3 und P4
 * zusammen mit N3 —, **P6** (Drehtürklausel, 5.3.1), **P7** (Arbeitskampf,
 * 5.3.2) mit N4, **P8** (Kennzeichnung und Konkretisierung, 5.3.3), **P9**
 * (AÜG-Erlaubnis, 5.4.1) mit N1, **P10** (Pflichtnachweise, 5.4.4) mit N5 und
 * **P11** (Arbeitsverhältnis beim Verleiher, 5.3.4). Übersteuerbar nach 5.5.4
 * sind P1, P2, P9, P10 und P11; P4, P6, P7 und P8 sind es nicht (5.5.4,
 * 5.3.6), P3 und P5 sperren nicht.
 *
 * Die Bremse oben — „ein Vorgang mit einer Prüfung ohne Rechenweg bleibt ganz
 * unbeurteilt" — greift damit nirgends mehr. Sie bleibt stehen: sie ist die
 * Haltung, nicht eine Übergangslösung, und die nächste Prüfung, die
 * hinzukommt, braucht sie wieder.
 */

import {
  leseArbeitskampflage,
  type Arbeitskampfprueflage,
} from './lesen/arbeitskampflage'
import { leseEntgeltlage, type Entgeltprueflage } from './lesen/entgeltlage'
import { leseErlaubnislage, type Prueflage } from './lesen/erlaubnislage'
import {
  leseKonkretisierungslage,
  type Konkretisierungsprueflage,
} from './lesen/konkretisierungslage'
import { leseKettenlage, type Kettenprueflage } from './lesen/kettenlage'
import {
  leseBeschaeftigungslage,
  leseDrehtuerlage,
  type Arbeitsverhaeltnisprueflage,
  type Drehtuerprueflage,
} from './lesen/kandidatenlage'
import { leseNachweislage, type Nachweisprueflage } from './lesen/nachweislage'
import { pruefeDrehtuer, type Drehtuerergebnis } from './regeln/p6Drehtuer'
import {
  pruefeArbeitsverhaeltnis,
  type Arbeitsverhaeltnisergebnis,
} from './regeln/p11Arbeitsverhaeltnis'
import {
  bewerteLuecke,
  pruefeHoechstdauer,
  type Dauerergebnis,
  type Lueckenbewertung,
} from './regeln/p1Hoechstdauer'
import {
  pruefeNachweise,
  pruefeNachweisVorlauf,
  type Nachweisergebnis,
} from './regeln/p10Nachweise'
import { pruefeEqualPayFrist, type EqualPayergebnis } from './regeln/p3EqualPayFrist'
import { pruefeArbeitskampf, type Arbeitskampfergebnis } from './regeln/p7Arbeitskampf'
import {
  pruefeKonkretisierung,
  type Konkretisierungsergebnis,
} from './regeln/p8Konkretisierung'
import {
  pruefeVergleichsentgelt,
  type Entgeltergebnis,
} from './regeln/p4Vergleichsentgelt'
import {
  pruefeBranchenzuschlag,
  type Zuschlagsergebnis,
} from './regeln/p5Branchenzuschlag'
import { QUERSCHNITT, type Querschnittzeile } from './querschnitt'
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
  P1: pruefeP1,
  P2: pruefeP2,
  P3: pruefeP3,
  P4: pruefeP4,
  P5: pruefeP5,
  P6: pruefeP6,
  P7: pruefeP7,
  P8: pruefeP8,
  P9: pruefeP9,
  P10: pruefeP10,
  P11: pruefeP11,
}

/**
 * Prüft einen Vorgang gegen die Prüfungen, die 4.7 ihm zuordnet. Gibt je
 * Feststellung einen Befund zurück; das strengste Ergebnis gewinnt, geführt
 * werden alle einzeln (5.5.2 Nr. 2).
 */
export function pruefe(auftrag: Pruefauftrag): readonly Befund[] {
  // Erwartet der Vorgang eine Prüfung, für die es keinen Rechenweg gibt, ist er
  // **nicht beurteilt** — und zwar gar nicht. 5.5.2 Nr. 2 bildet das Ergebnis
  // eines Übergangs aus dem **strengsten** Einzelergebnis; das lässt sich nicht
  // bestimmen, solange ein Einzelergebnis fehlt. Nur die vorhandenen Prüfungen
  // zu melden wäre die gefährlichere Hälfte: ein halb beurteilter Übergang sieht
  // aus wie ein zulässiger (5.0, „kein stilles Durchlassen").
  if (pruefungenOhneRechenweg(auftrag.erwartetePruefungen).length > 0) return []

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

/**
 * Die erwarteten Prüfungen, zu denen `REGELN` keinen Rechenweg führt — die
 * Bremse aus `pruefe()` als eigene Aussage.
 *
 * Sie ist **exportiert**, weil sie seit P7 und P8 über `pruefe()` nicht mehr
 * erreichbar ist: alle elf Prüfungen haben einen Rechenweg. Eine Bedingung, die
 * niemand mehr prüfen kann, verfällt — und sie ist zu wichtig, um zu verfallen.
 * Sie entscheidet, ob ein halb beurteilter Übergang wie ein zulässiger
 * aussieht (5.5.2 Nr. 2).
 */
export function pruefungenOhneRechenweg(
  erwartetePruefungen: readonly Pruefung[],
): readonly Pruefung[] {
  // `== null` und nicht `=== null`: eine Prüfung, die `REGELN` überhaupt nicht
  // führt, hat erst recht keinen Rechenweg. Das Typsystem schließt den Fall
  // aus, die Eingangsseite dieses Moduls ist aber absichtlich weit getypt
  // (`typen.ts`) — und ein Vorgang, dessen Prüfung niemand kennt, darf nicht
  // als beurteilt gelten.
  return erwartetePruefungen.filter((pruefung) => REGELN[pruefung] == null)
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

/* ------------------------------------------------------------------ */
/* P1 und P2 — Höchstüberlassungsdauer und Unterbrechung (SPEC 5.1)    */
/* ------------------------------------------------------------------ */

/** P1 — Höchstüberlassungsdauer je Person und Entleiher (SPEC 5.1). */
function pruefeP1(auftrag: Pruefauftrag): readonly Befund[] {
  const lage = leseKettenlage(auftrag.sachverhalte, auftrag.ausloeser, 'P1')
  if (lage.uebersteuerung.beantragt) return dauerUebersteuerung(lage, auftrag.ausloeser.rolle)
  if (!vollstaendigBeurteilbar(lage.zeile)) return []
  return [dauerbefund(lage, pruefeHoechstdauer(lage.lage))]
}

/**
 * Nennt die Zeile in 4.7 mehrere Prüfungen (Q27: „P1, P3"), beurteilen sie den
 * Übergang **zusammen**; das Ergebnis ist das strengste der Einzelergebnisse
 * (5.5.2 Nr. 2). Fehlt einer von ihnen der Rechenweg, lässt sich das nicht
 * bestimmen — dann ist der Übergang nicht beurteilt. Dieselbe Begründung wie in
 * `pruefe()`, nur aus der Zeile statt aus dem Vorgang gelesen: welche Prüfung an
 * welchem Übergang läuft, steht ausschließlich in 4.7 (5.5.1 a).
 */
function vollstaendigBeurteilbar(zeile: Querschnittzeile | null): boolean {
  if (zeile === null) return true
  return (zeile.weiterePruefungen ?? []).every((pruefung) => REGELN[pruefung] !== null)
}

/** P2 — Unterbrechung und Zurücksetzen der Zählung (SPEC 5.1.4). */
function pruefeP2(auftrag: Pruefauftrag): readonly Befund[] {
  const lage = leseKettenlage(auftrag.sachverhalte, auftrag.ausloeser, 'P2')
  const bewertung = bewerteLuecke(lage.lage.luecke, lage.stichtag, lage.lage.wiederaufnahmetag)
  // 5.1.4: P2 setzt `countsAsReset` und löst die **Neuberechnung** von P1 aus
  // (Schritte 2 bis 5). Der Befund führt beides, weil beides am Vorgang
  // vermerkt wird — die Wirkung auf die Zählung ist der Zweck der Prüfung.
  const ergebnis = pruefeHoechstdauer(lage.lage)
  return [lueckenbefund(lage, bewertung, ergebnis)]
}

/**
 * Die Ergebnisart eines P1-Befundes. Sie kommt aus der Zeile in 4.7 — der
 * Rechenweg sagt nur, *ob* ein Treffer vorliegt (5.5.1 a).
 */
function dauerbefund(lage: Kettenprueflage, ergebnis: Dauerergebnis): Befund {
  const zeile = lage.zeile
  const ueberschritten = ergebnis.ueberschritten || lage.ueberschreitungFestgestellt
  const trefferart: Ergebnisart =
    ergebnis.stichtagUeberschritten && zeile?.trefferartStichtagErreicht !== undefined
      ? zeile.trefferartStichtagErreicht
      : (zeile?.trefferart ?? 'warnung')

  // Eine Zeile, die feststellt statt vorauszusehen, kennt die Vorlaufschwellen
  // aus 5.1.6 nicht (Q27, Q33, Q35; siehe `rueckschau` in querschnitt.ts).
  const rueckschau = zeile?.rueckschau === true
  const vorschau: Ergebnisart =
    ergebnis.schwelle === 'erreicht' || ergebnis.schwelle === 'warnung' ? 'warnung' : 'information'
  const roh: Ergebnisart = ueberschritten ? trefferart : rueckschau ? 'information' : vorschau

  // 5.1.2 und 5.5.3 R3: wirkt eine Senkung der Grenze nach vorn oder legt eine
  // Berichtigung einen Verstoß in der Vergangenheit offen, ist das Ergebnis eine
  // Warnung mit Pflicht-Eskalation an `MA` — nie eine Sperre, es gibt nichts
  // mehr zu sperren. Der nächtliche Lauf sperrt ohnehin nie (5.5.1 c).
  const feststellung =
    ergebnis.senkungWirktNachVorn ||
    lage.anlass === 'nachtlauf' ||
    (lage.anlass === 'berichtigung' && ueberschritten)
  const ergebnisart: Ergebnisart = feststellung && roh === 'sperre' ? 'warnung' : roh

  const kennStatuswechsel = lage.anlass === 'uebergang' || lage.anlass === 'uebergangsversuch'
  const vollzogen = kennStatuswechsel && ergebnisart !== 'sperre'
  const adressaten = feststellung
    ? [...new Set([...ergebnis.adressaten, ...REGELWERK.adressatenRueckwirkenderBefund])]
    : ergebnis.adressaten

  return kettenbefund(lage, 'P1', ergebnisart, vollzogen, {
    ergaenzung: dauerwerte(ergebnis),
    adressaten,
    meldung: feststellung
      ? `${ergebnis.meldung} Der Verstoß liegt in der Vergangenheit; er wird festgestellt und an ` +
        'den MSP-Administrator eskaliert, nicht gesperrt (SPEC 5.5.3, R3). Bereits vollzogene ' +
        'Übergänge, genehmigte Stundenzettel und freigegebene Belege bleiben wirksam (R4).'
      : ergebnis.meldung,
  })
}

/** Der P2-Befund: die bewertete Lücke und die Neuberechnung der Kette. */
function lueckenbefund(
  lage: Kettenprueflage,
  bewertung: Lueckenbewertung,
  ergebnis: Dauerergebnis,
): Befund {
  // 4.7, Q24, Q25 und N6: P2 ist in jedem Fall eine **Information**. Die
  // Unterbrechung wird erfasst und bewertet; sie entzieht nichts (5.5.5).
  const ergebnisart: Ergebnisart = lage.zeile?.trefferart ?? 'information'
  const kennStatuswechsel = lage.anlass === 'uebergang' || lage.anlass === 'uebergangsversuch'

  return kettenbefund(lage, 'P2', ergebnisart, kennStatuswechsel, {
    ergaenzung: {
      ...dauerwerte(ergebnis),
      lueckenbeginn: bewertung.lueckenbeginn,
      lueckenende: bewertung.lueckenende,
      dreimonatsende: bewertung.dreimonatsende,
      lueckentage: bewertung.lueckentage,
      keineLuecke: bewertung.keineLuecke ? 'ja' : 'nein',
      zaehlwirksam: bewertung.zaehlwirksam ? 'ja' : 'nein',
      countsAsReset: bewertung.zaehlwirksam ? 'ja' : 'nein',
      vorlaeufig: bewertung.vorlaeufig ? 'ja' : 'nein',
      neueKetteAb: bewertung.neueKetteAb,
    },
    adressaten: REGELWERK.adressatenDauerHinweis,
    meldung: `${bewertung.meldung} ${ergebnis.meldung}`,
  })
}

/**
 * Übersteuerung einer Sperre aus P1 (SPEC 5.5.4). P1 ist übersteuerbar — der
 * Fall, für den die Übersteuerung gedacht ist, ist eine falsch verknüpfte
 * Personenidentität oder eine nicht erfasste Unterbrechung. Zulässig ist sie
 * nur, wenn **alle drei** Bedingungen erfüllt sind und der MSP-Administrator
 * selbst handelt: sie ist **nicht vertretbar** (2.4, Regel 8).
 */
function dauerUebersteuerung(lage: Kettenprueflage, rolle: string | null): readonly Befund[] {
  const { angabeUnrichtig, berichtigungNichtMoeglich, datenlageZulaessig } = lage.uebersteuerung
  const durchBefugten = rolle === 'MSP-Administrator'
  const zulaessig =
    angabeUnrichtig && berichtigungNichtMoeglich && datenlageZulaessig && durchBefugten

  if (!zulaessig) {
    return [
      kettenbefund(lage, 'P1', 'sperre', false, {
        ergaenzung: {
          uebersteuerung: 'zurückgewiesen',
          bedingungA: angabeUnrichtig ? 'ja' : 'nein',
          bedingungB: berichtigungNichtMoeglich ? 'ja' : 'nein',
          bedingungC: datenlageZulaessig ? 'ja' : 'nein',
          handelndeRolle: rolle,
        },
        adressaten: REGELWERK.adressatenRueckwirkenderBefund,
        meldung:
          'P1: Die Übersteuerung wird zurückgewiesen. ' +
          (!durchBefugten
            ? 'Nur der MSP-Administrator selbst darf übersteuern; die Übersteuerung ist nicht ' +
              'vertretbar (SPEC 2.4, Regel 8; 5.5.4). Der Vorgang kann an ihn eskaliert werden.'
            : datenlageZulaessig
              ? 'Die Bedingungen (a) und (b) aus SPEC 5.5.4 sind nicht beide erfüllt.'
              : 'Die Überlassung wäre auch nach richtiger Datenlage unzulässig — Bedingung (c) ' +
                'aus SPEC 5.5.4 fehlt. Der zulässige Weg ist eine tarifliche Öffnung als ' +
                'Konfiguration, ein anderer Entleiher oder das Ende der Überlassung.'),
      }),
    ]
  }

  // Invariante 5: zwei Protokolleinträge — der abgelehnte Übergang mit
  // `blocked` und der vollzogene mit `success`, `ruleRef` und `reason`.
  return [
    kettenbefund(lage, 'P1', 'sperre', false, {
      ergaenzung: { uebersteuerung: 'übersteuert' },
      adressaten: REGELWERK.adressatenDauerErreicht,
      meldung:
        'P1: Die Sperre bestand und wird protokolliert; die Spur zeigt, dass eine Sperre bestand — ' +
        'nicht nur, dass ein Übergang geschah (SPEC 5.5.4, Invariante 5).',
    }),
    kettenbefund(lage, 'P1', 'warnung', true, {
      ergaenzung: { uebersteuerung: 'vollzogen' },
      adressaten: REGELWERK.adressatenRueckwirkenderBefund,
      meldung:
        'P1: Der Übergang wurde mit Pflichtbegründung übersteuert; er gilt für genau diesen einen ' +
        'Übergang dieses Vorgangs. Die Übersteuerung berichtigt eine falsche Datenlage, sie heilt ' +
        'die Rechtslage nicht und wird in der Übersteuerungsübersicht des Betreibers geführt ' +
        '(SPEC 5.5.4, Invarianten 1, 4 und 6).',
    }),
  ]
}

function dauerwerte(ergebnis: Dauerergebnis): Record<string, string | number | null> {
  return {
    kunde: ergebnis.kunde,
    kettenbeginn: ergebnis.kettenbeginn,
    chainStartDate: ergebnis.kettenbeginn,
    tagebudget: ergebnis.tagebudget,
    maxDurationDays: ergebnis.tagebudget,
    angerechneteDauer: ergebnis.angerechneteDauer,
    countedDurationDays: ergebnis.angerechneteDauer,
    restbudget: ergebnis.restbudget,
    fristende: ergebnis.fristende,
    maxDurationEndDate: ergebnis.fristende,
    bezugstag: ergebnis.bezugstag,
    letzterTagDesPruefzeitraums: ergebnis.bezugstag,
    grenzeMonate: ergebnis.grenzeMonate,
    grenzeHerkunft: ergebnis.grenzeHerkunft,
    lueckentage: ergebnis.lueckentage,
    einsaetzeDerKette: ergebnis.einsaetzeDerKette,
    angefragteTage: ergebnis.angefragteTage,
    ueberschritten: ergebnis.ueberschritten ? 'ja' : 'nein',
    schwelle: ergebnis.schwelle,
    mangel: ergebnis.mangel,
    fehlendeFelder: ergebnis.fehlendeFelder.join(','),
    vermerke: ergebnis.vermerke.join(' | '),
  }
}

function kettenbefund(
  lage: Kettenprueflage,
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
      result: ergebnisart === 'sperre' ? 'blocked' : 'success',
      qZeile: lage.zeile?.nummer ?? null,
      anlass: lage.anlass,
      objektart: lage.objektart,
      statusVorher: lage.vonStatus,
      statusNachher: uebergangVollzogen ? lage.nachStatus : lage.vonStatus,
      stichtag: lage.stichtag,
      pruefzeitraumVon: lage.lage.zeitraum?.von ?? null,
      pruefzeitraumBis: lage.lage.zeitraum?.bis ?? null,
      specReference: lage.zeile?.specReference ?? 'SPEC 5.1',
      ...zusatz.ergaenzung,
    },
    adressaten: zusatz.adressaten,
    meldung: zusatz.meldung,
  }
}

/* ------------------------------------------------------------------ */
/* P3, P4 und P5 — Equal Pay (SPEC 5.2)                                */
/* ------------------------------------------------------------------ */

/** P3 — Equal-Pay-Fälligkeit (SPEC 5.2.3). */
function pruefeP3(auftrag: Pruefauftrag): readonly Befund[] {
  const lage = leseEntgeltlage(auftrag.sachverhalte, auftrag.ausloeser, 'P3')
  if (!vollstaendigBeurteilbar(lage.zeile)) return []

  const ergebnis = pruefeEqualPayFrist(lage.equalPay)
  const zeile = lage.zeile

  // Die Ergebnisart kommt aus 4.7 (5.5.1 a). Ohne Treffer ist sie eine
  // Information — **außer** die Fristkonfiguration selbst ist zu beanstanden:
  // 5.2.2 führt für die Fälle 1, 5 und 6 ausdrücklich eine Warnung, unabhängig
  // vom Vergleichsentgelt, weil das Fehlen eine unmittelbare Entgeltfolge hat.
  // Die Vorlaufschwellen aus 5.0 (`equalPayNoticeDays`, `equalPayWarningDays`)
  // gehören dem **nächtlichen Lauf** (Zeile N3): sie beschreiben, wie früh das
  // System auf eine kommende Fälligkeit hinweist. An einem Übergang entscheidet
  // allein 5.2.3, Schritt 4 — ob die Fälligkeit in den Prüfzeitraum fällt oder
  // vor ihm liegt. Eine Fälligkeit, die 15 Tage **nach** dem Prüfzeitraum
  // liegt, ist dort eine Information, keine Warnung (Q29, Q34).
  const vorlaufwarnung = lage.ketten.anlass === 'nachtlauf' && ergebnis.warnungErreicht
  const roh: Ergebnisart = ergebnis.treffer
    ? (zeile?.trefferart ?? 'warnung')
    : ergebnis.konfigurationsmangel || vorlaufwarnung || ergebnis.mindestensWarnung
      ? 'warnung'
      : 'information'
  // 5.2.6: bei begrenzter Zählgrundlage und fehlendem Vergleichsentgelt ist das
  // Ergebnis **mindestens** eine Warnung — auch dort, wo die Zeile in 4.7 eine
  // Information vorsieht.
  const angehoben: Ergebnisart =
    ergebnis.mindestensWarnung && roh === 'information' ? 'warnung' : roh

  // 5.2.2 und 5.5.3: rückt die Fälligkeit durch einen Tarifwechsel oder eine
  // Berichtigung in die Vergangenheit, ist das Ergebnis eine Warnung mit
  // Pflicht-Eskalation — **keine rückwirkende Sperre**. Der nächtliche Lauf
  // sperrt ohnehin nie (5.5.1 c).
  const feststellung =
    lage.ketten.anlass === 'nachtlauf' ||
    lage.ketten.anlass === 'berichtigung' ||
    ergebnis.faelligkeitVergangen
  const ergebnisart: Ergebnisart =
    feststellung && angehoben === 'sperre' ? 'warnung' : angehoben

  const kennStatuswechsel =
    lage.ketten.anlass === 'uebergang' || lage.ketten.anlass === 'uebergangsversuch'
  const adressaten =
    feststellung && ergebnis.treffer
      ? [...new Set([...ergebnis.adressaten, ...REGELWERK.adressatenRueckwirkenderBefund])]
      : ergebnis.adressaten

  return [
    entgeltbefund(lage, 'P3', ergebnisart, kennStatuswechsel && ergebnisart !== 'sperre', {
      ergaenzung: equalPaywerte(ergebnis),
      adressaten,
      meldung: ergebnis.meldung,
    }),
  ]
}

/** P4 — Vergleichsentgelt (SPEC 5.2.4). */
function pruefeP4(auftrag: Pruefauftrag): readonly Befund[] {
  const lage = leseEntgeltlage(auftrag.sachverhalte, auftrag.ausloeser, 'P4')
  if (!vollstaendigBeurteilbar(lage.zeile)) return []

  // 5.5.4: P4 ist **nicht** übersteuerbar. Der Weg ist die Ergänzung des Werts
  // durch den Entleiher (3.3) — eine Sperre mit offenem Weg wird nicht
  // übersteuert, sondern aufgelöst.
  if (lage.uebersteuerungBeantragt) {
    return [
      entgeltbefund(lage, 'P4', 'sperre', false, {
        ergaenzung: { uebersteuerung: 'zurückgewiesen', uebersteuerbar: 'nein' },
        adressaten: REGELWERK.adressatenVergleichsentgeltFehlt,
        meldung:
          'P4: Die Übersteuerung wird zurückgewiesen, weil die Prüfung P4 nicht übersteuerbar ' +
          'ist (SPEC 5.5.4). Der offene Weg ist die Ergänzung des Vergleichsentgelts durch den ' +
          'Entleiher — das ist seine Pflicht aus 3.3, und eine Sperre mit offenem Weg wird ' +
          'aufgelöst, nicht übersteuert. Der Versuch wird protokolliert.',
      }),
    ]
  }

  // E13: die Fälligkeit kommt aus 5.2.3. Führt der Vorgang sie als Datenstand,
  // gilt dieser Wert; sonst wird sie gerechnet.
  const frist = pruefeEqualPayFrist(lage.equalPay)
  const ergebnis = pruefeVergleichsentgelt({
    ...lage.entgelt,
    faelligkeit: lage.entgelt.faelligkeit ?? frist.faelligkeit,
  })
  const zeile = lage.zeile

  const roh: Ergebnisart = ergebnis.treffer ? (zeile?.trefferart ?? 'warnung') : 'information'
  // Eine Schätzung ist verwendbar und begrenzt die Sperre auf eine Warnung
  // (3.3, 5.2.4; 5.5.5 zu Q36). Dasselbe gilt für die Abweichung nach unten:
  // sie ist mit Begründung zulässig und wird eskaliert, nicht gesperrt.
  const begrenzt = ergebnis.nurWarnung && roh === 'sperre' ? 'warnung' : roh
  // Der nächtliche Lauf sperrt nie (5.5.1 c); ein Befund in der Vergangenheit
  // wird festgestellt, nicht gesperrt (5.5.3, R3).
  const feststellung =
    lage.ketten.anlass === 'nachtlauf' || lage.ketten.anlass === 'berichtigung'
  const ergebnisart: Ergebnisart = feststellung && begrenzt === 'sperre' ? 'warnung' : begrenzt

  const kennStatuswechsel =
    lage.ketten.anlass === 'uebergang' || lage.ketten.anlass === 'uebergangsversuch'
  const adressaten =
    feststellung && ergebnis.treffer
      ? [...new Set([...ergebnis.adressaten, ...REGELWERK.adressatenRueckwirkenderBefund])]
      : ergebnis.adressaten

  return [
    entgeltbefund(lage, 'P4', ergebnisart, kennStatuswechsel && ergebnisart !== 'sperre', {
      ergaenzung: { ...entgeltwerte(ergebnis), equalPayDueDate: ergebnis.faelligkeit },
      adressaten,
      meldung: ergebnis.meldung,
    }),
  ]
}

/** P5 — Branchenzuschlag (SPEC 5.2.5). */
function pruefeP5(auftrag: Pruefauftrag): readonly Befund[] {
  const lage = leseEntgeltlage(auftrag.sachverhalte, auftrag.ausloeser, 'P5')
  if (!vollstaendigBeurteilbar(lage.zeile)) return []

  // Schritt 3: Eingangsgröße der Stufe sind die Überlassungstage der **Kette**
  // nach 5.1.3. Nennt der Vorgang sie selbst, gilt seine Angabe.
  const frist = pruefeEqualPayFrist(lage.equalPay)
  const ergebnis = pruefeBranchenzuschlag({
    ...lage.zuschlag,
    ueberlassungstage: lage.zuschlag.ueberlassungstage ?? frist.angerechneteDauer,
  })

  const roh: Ergebnisart = ergebnis.treffer
    ? ergebnis.mangel === 'brancheFehlt'
      ? // 5.2.5, Schritt 2 und 5.2.7: die Stufe wirkt auf das geschuldete
        // Entgelt, deshalb Warnung statt Information — auch dort, wo 4.7 der
        // Zeile eine Information zuordnet.
        'warnung'
      : (lage.zeile?.trefferart ?? 'information')
    : 'information'
  const kennStatuswechsel =
    lage.ketten.anlass === 'uebergang' || lage.ketten.anlass === 'uebergangsversuch'

  return [
    entgeltbefund(lage, 'P5', roh, kennStatuswechsel && roh !== 'sperre', {
      ergaenzung: zuschlagswerte(ergebnis),
      adressaten: ergebnis.adressaten,
      meldung: ergebnis.meldung,
    }),
  ]
}

function equalPaywerte(ergebnis: EqualPayergebnis): Record<string, string | number | null> {
  return {
    kunde: ergebnis.kunde,
    kettenbeginn: ergebnis.kettenbeginn,
    chainStartDate: ergebnis.kettenbeginn,
    fristMonate: ergebnis.fristMonate,
    equalPayDeadlineMonths: ergebnis.fristMonate,
    fristfall: ergebnis.fristfall,
    fristbudget: ergebnis.fristbudget,
    equalPayDeadlineDays: ergebnis.fristbudget,
    budgetende: ergebnis.budgetende,
    faelligkeit: ergebnis.faelligkeit,
    equalPayDueDate: ergebnis.faelligkeit,
    angerechneteDauer: ergebnis.angerechneteDauer,
    countedDurationDays: ergebnis.angerechneteDauer,
    lueckentage: ergebnis.lueckentage,
    bezugstag: ergebnis.bezugstag,
    letzterTagDesPruefzeitraums: ergebnis.bezugstag,
    restTage: ergebnis.restTage,
    faelligkeitImZeitraum: ergebnis.faelligkeitImZeitraum ? 'ja' : 'nein',
    faelligkeitVergangen: ergebnis.faelligkeitVergangen ? 'ja' : 'nein',
    treffer: ergebnis.treffer ? 'ja' : 'nein',
    mangel: ergebnis.mangel,
    vermerke: ergebnis.vermerke.join(' | '),
  }
}

function entgeltwerte(ergebnis: Entgeltergebnis): Record<string, string | number | null> {
  return {
    taetigkeit: ergebnis.taetigkeit,
    activityDescription: ergebnis.taetigkeit,
    anzahlEintraege: ergebnis.anzahlEintraege,
    eintragsbetrag: ergebnis.eintragsbetrag,
    einsatzwert: ergebnis.einsatzwert,
    comparableWage: ergebnis.einsatzwert,
    wageSource: ergebnis.quelle,
    verwendbar: ergebnis.verwendbar ? 'ja' : 'nein',
    nachweis: ergebnis.nachweis ? 'ja' : 'nein',
    schaetzung: ergebnis.schaetzung ? 'ja' : 'nein',
    faelligkeitErreicht: ergebnis.faelligkeitErreicht ? 'ja' : 'nein',
    abweichungNachUnten: ergebnis.abweichungNachUnten ? 'ja' : 'nein',
    abweichungNachOben: ergebnis.abweichungNachOben ? 'ja' : 'nein',
    treffer: ergebnis.treffer ? 'ja' : 'nein',
    mangel: ergebnis.mangel,
  }
}

function zuschlagswerte(ergebnis: Zuschlagsergebnis): Record<string, string | number | null> {
  return {
    schema: ergebnis.schema,
    industryPremiumScheme: ergebnis.schema,
    anwendbar: ergebnis.anwendbar ? 'ja' : 'nein',
    brancheBestimmbar: ergebnis.brancheBestimmbar ? 'ja' : 'nein',
    ueberlassungstage: ergebnis.ueberlassungstage,
    countedDurationDays: ergebnis.ueberlassungstage,
    zuschlagsstufe: ergebnis.stufe,
    stufeBestimmbar: ergebnis.stufeBestimmbar ? 'ja' : 'nein',
    pruefbar: ergebnis.brancheBestimmbar ? 'ja' : 'nein',
    positionenAbweichend: ergebnis.positionenAbweichend ? 'ja' : 'nein',
    treffer: ergebnis.treffer ? 'ja' : 'nein',
    mangel: ergebnis.mangel,
    vermerke: ergebnis.vermerke.join(' | '),
  }
}

function entgeltbefund(
  lage: Entgeltprueflage,
  pruefung: Pruefung,
  ergebnisart: Ergebnisart,
  uebergangVollzogen: boolean,
  zusatz: Befundzusatz,
): Befund {
  const ketten = lage.ketten
  return {
    pruefung,
    ergebnisart,
    uebergangVollzogen,
    werte: {
      ruleRef: REGELBEZEICHNER[pruefung],
      result: ergebnisart === 'sperre' ? 'blocked' : 'success',
      qZeile: lage.zeile?.nummer ?? null,
      anlass: ketten.anlass,
      objektart: ketten.objektart,
      statusVorher: ketten.vonStatus,
      statusNachher: uebergangVollzogen ? ketten.nachStatus : ketten.vonStatus,
      stichtag: ketten.stichtag,
      pruefzeitraumVon: ketten.lage.zeitraum?.von ?? null,
      pruefzeitraumBis: ketten.lage.zeitraum?.bis ?? null,
      specReference: lage.zeile?.specReference ?? 'SPEC 5.2',
      ...zusatz.ergaenzung,
    },
    adressaten: zusatz.adressaten,
    meldung: zusatz.meldung,
  }
}

/* ------------------------------------------------------------------ */
/* P6 und P11 — Drehtür und Arbeitsverhältnis (SPEC 5.3)               */
/* ------------------------------------------------------------------ */

/** P6 — Drehtürklausel (SPEC 5.3.1). */
function pruefeP6(auftrag: Pruefauftrag): readonly Befund[] {
  const lage = leseDrehtuerlage(auftrag.sachverhalte, auftrag.ausloeser)
  // 5.3.6: die Sperre aus P6 ist **nicht übersteuerbar**. Sie entsteht aus der
  // fehlenden Erklärung und wird durch Beibringen der Erklärung aufgelöst, nicht
  // durch eine Abweichung von der Regel. Der Treffer selbst ist keine Sperre.
  if (lage.uebersteuerung.beantragt) {
    return [
      drehtuerbefund(lage, 'sperre', false, {
        ergaenzung: { uebersteuerung: 'zurückgewiesen', uebersteuerbar: 'nein' },
        adressaten: REGELWERK.adressatenErklaerungFehlt,
        meldung:
          'P6: Die Übersteuerung wird zurückgewiesen, weil die Prüfung P6 nicht übersteuerbar ist ' +
          '(SPEC 5.3.6). Der Treffer der Drehtürklausel ist keine Sperre, sondern setzt Equal Pay ' +
          'ab dem ersten Überlassungstag; die Sperre bei fehlender Erklärung wird durch Beibringen ' +
          'der Erklärung aufgelöst.',
      }),
    ]
  }

  const ergebnis = pruefeDrehtuer(lage.lage)
  const zeile = lage.zeile
  // Die Ergebnisart kommt aus 4.7: Warnung bei Treffer, Sperre nur bei
  // fehlender Tatsachengrundlage (5.5.5, Q12 und Q15).
  const trefferart: Ergebnisart = ergebnis.pruefbar
    ? (zeile?.trefferart ?? 'warnung')
    : (zeile?.trefferartOhneGrundlage ?? zeile?.trefferart ?? 'warnung')
  const angesprochen = ergebnis.treffer || !ergebnis.pruefbar
  const roh: Ergebnisart = angesprochen ? trefferart : 'information'

  // 5.3.1, Grenzfall „Rückwirkende Korrektur": greift die Drehtür durch ein
  // berichtigtes Austrittsdatum, rückt `equalPayDueDate` auf den Kettenbeginn —
  // Warnung mit Pflicht-Eskalation an `MA` und `KE`, keine Sperre und keine
  // Entwertung abgerechneter Zeiten (5.5.3).
  const rueckwirkend = lage.anlass === 'berichtigung' && angesprochen
  const ergebnisart: Ergebnisart = rueckwirkend && roh === 'sperre' ? 'warnung' : roh
  const kennStatuswechsel = lage.anlass === 'uebergang' || lage.anlass === 'uebergangsversuch'

  return [
    drehtuerbefund(lage, ergebnisart, kennStatuswechsel && ergebnisart !== 'sperre', {
      ergaenzung: drehtuerwerte(ergebnis),
      adressaten: rueckwirkend
        ? [...new Set([...ergebnis.adressaten, 'MA', 'KE'])]
        : ergebnis.adressaten,
      meldung: rueckwirkend
        ? `${ergebnis.meldung} Die Berichtigung legt die Drehtür nachträglich offen: die ` +
          'Equal-Pay-Fälligkeit rückt auf den Kettenbeginn. Der Befund wird festgestellt und an ' +
          'den MSP-Administrator und an Einkauf und Controlling eskaliert — keine Sperre, keine ' +
          'Entwertung abgerechneter Zeiten (SPEC 5.5.3, R3 und R4).'
        : ergebnis.meldung,
    }),
  ]
}

/** P11 — Arbeitsverhältnis beim Verleiher (SPEC 5.3.4). */
function pruefeP11(auftrag: Pruefauftrag): readonly Befund[] {
  const lage = leseBeschaeftigungslage(auftrag.sachverhalte, auftrag.ausloeser)
  if (lage.uebersteuerung.beantragt) return arbeitsverhaeltnisUebersteuerung(lage)

  const ergebnis = pruefeArbeitsverhaeltnis(lage.lage)
  const trefferart: Ergebnisart = lage.zeile?.trefferart ?? 'warnung'
  const roh: Ergebnisart = ergebnis.bestehtAmErstenTag ? 'information' : trefferart

  // 5.3.4, Grenzfall „Rückwirkende Korrektur": wird `employedSince` nach hinten
  // korrigiert, ist der Befund § 1 Abs. 1 AÜG und damit potenziell §§ 9, 10 —
  // festgestellt und an `MA` eskaliert, nicht gesperrt (5.5.3).
  const rueckwirkend = lage.anlass === 'berichtigung' && !ergebnis.bestehtAmErstenTag
  const ergebnisart: Ergebnisart = rueckwirkend && roh === 'sperre' ? 'warnung' : roh
  const kennStatuswechsel = lage.anlass === 'uebergang' || lage.anlass === 'uebergangsversuch'

  return [
    arbeitsverhaeltnisbefund(
      lage,
      ergebnisart,
      kennStatuswechsel && ergebnisart !== 'sperre',
      {
        ergaenzung: arbeitsverhaeltniswerte(ergebnis),
        adressaten: rueckwirkend
          ? [...new Set([...ergebnis.adressaten, ...REGELWERK.adressatenRueckwirkenderBefund])]
          : ergebnis.adressaten,
        meldung: rueckwirkend
          ? `${ergebnis.meldung} Der Befund ist § 1 Abs. 1 Satz 1 AÜG und damit potenziell ` +
            '§ 9 Abs. 1 Nr. 1 und § 10 Abs. 1 AÜG. Er liegt in der Vergangenheit und wird ' +
            'festgestellt und an den MSP-Administrator eskaliert, nicht gesperrt (SPEC 5.3.4, ' +
            '5.5.3 R3). Abgerechnete Zeiträume werden nicht entwertet (R4).'
          : ergebnis.meldung,
      },
    ),
  ]
}

/**
 * Übersteuerung einer Sperre aus P11 (SPEC 5.5.4, 5.3.6): denkbar, wenn der
 * Arbeitsvertrag **nachweislich besteht**, im System aber nicht erfasst ist.
 * Besteht tatsächlich kein Arbeitsverhältnis, fehlt Bedingung (c) — dann ist
 * die Sperre nicht übersteuerbar.
 */
function arbeitsverhaeltnisUebersteuerung(
  lage: Arbeitsverhaeltnisprueflage,
): readonly Befund[] {
  const { angabeUnrichtig, berichtigungNichtMoeglich, datenlageZulaessig } = lage.uebersteuerung
  const zulaessig = angabeUnrichtig && berichtigungNichtMoeglich && datenlageZulaessig

  if (!zulaessig) {
    return [
      arbeitsverhaeltnisbefund(lage, 'sperre', false, {
        ergaenzung: {
          uebersteuerung: 'zurückgewiesen',
          bedingungA: angabeUnrichtig ? 'ja' : 'nein',
          bedingungB: berichtigungNichtMoeglich ? 'ja' : 'nein',
          bedingungC: datenlageZulaessig ? 'ja' : 'nein',
        },
        adressaten: REGELWERK.adressatenRueckwirkenderBefund,
        meldung:
          'P11: Die Übersteuerung wird zurückgewiesen. ' +
          (datenlageZulaessig
            ? 'Die Bedingungen (a) und (b) aus SPEC 5.5.4 sind nicht beide erfüllt.'
            : 'Besteht tatsächlich kein Arbeitsverhältnis beim Verleiher, wäre die Überlassung ' +
              'auch nach richtiger Datenlage unzulässig — Bedingung (c) aus SPEC 5.5.4 fehlt, ' +
              'und ohne Arbeitsverhältnis gibt es keine Arbeitnehmerüberlassung ' +
              '(§ 1 Abs. 1 Satz 1 AÜG).'),
      }),
    ]
  }

  return [
    arbeitsverhaeltnisbefund(lage, 'sperre', false, {
      ergaenzung: { uebersteuerung: 'übersteuert' },
      adressaten: REGELWERK.adressatenArbeitsverhaeltnis,
      meldung:
        'P11: Die Sperre bestand und wird protokolliert (SPEC 5.5.4, Invariante 5).',
    }),
    arbeitsverhaeltnisbefund(lage, 'warnung', true, {
      ergaenzung: { uebersteuerung: 'vollzogen' },
      adressaten: REGELWERK.adressatenRueckwirkenderBefund,
      meldung:
        'P11: Der Übergang wurde mit Pflichtbegründung übersteuert; die Begründung nennt die ' +
        'Prüfung "employmentRelationshipCheck" und die Tatsache, die stattdessen gilt — der ' +
        'nachweislich bestehende, im System nicht erfasste Arbeitsvertrag. Sie gilt für genau ' +
        'diesen einen Übergang und heilt die Rechtslage nicht (SPEC 5.5.4, Invarianten 1, 4 ' +
        'und 6).',
    }),
  ]
}

function drehtuerwerte(ergebnis: Drehtuerergebnis): Record<string, string | number | null> {
  return {
    treffer: ergebnis.treffer ? 'ja' : 'nein',
    pruefbar: ergebnis.pruefbar ? 'ja' : 'nein',
    rueckschauVon: ergebnis.fensterVon,
    rueckschauBis: ergebnis.fensterBis,
    austrittsdatum: ergebnis.austritt,
    frueherArbeitgeber: ergebnis.arbeitgeber,
    bezug: ergebnis.bezug,
    konzernGeprueft: ergebnis.konzernGeprueft ? 'ja' : 'nein',
    equalPayAbErstemTag: ergebnis.equalPayAbErstemTag ? 'ja' : 'nein',
    equalPayDeadlineMonths: ergebnis.equalPayAbErstemTag ? 'nicht anwendbar' : null,
    mangel: ergebnis.mangel,
    fehlendeFelder: ergebnis.fehlendeFelder.join(','),
    vermerke: ergebnis.vermerke.join(' | '),
  }
}

function arbeitsverhaeltniswerte(
  ergebnis: Arbeitsverhaeltnisergebnis,
): Record<string, string | number | null> {
  return {
    bestehtAmErstenTag: ergebnis.bestehtAmErstenTag ? 'ja' : 'nein',
    employmentStatusWithSupplier: ergebnis.status,
    employedSince: ergebnis.beschaeftigtSeit,
    ersterUeberlassungstag: ergebnis.ersterUeberlassungstag,
    lieferant: ergebnis.lieferant,
    mangel: ergebnis.mangel,
    fehlendeFelder: ergebnis.fehlendeFelder.join(','),
    vermerke: ergebnis.vermerke.join(' | '),
  }
}

function drehtuerbefund(
  lage: Drehtuerprueflage,
  ergebnisart: Ergebnisart,
  uebergangVollzogen: boolean,
  zusatz: Befundzusatz,
): Befund {
  return rahmenbefund('P6', lage, ergebnisart, uebergangVollzogen, zusatz, 'SPEC 5.3.1')
}

function arbeitsverhaeltnisbefund(
  lage: Arbeitsverhaeltnisprueflage,
  ergebnisart: Ergebnisart,
  uebergangVollzogen: boolean,
  zusatz: Befundzusatz,
): Befund {
  return rahmenbefund('P11', lage, ergebnisart, uebergangVollzogen, zusatz, 'SPEC 5.3.4')
}

interface Befundrahmen {
  readonly zeile: Querschnittzeile | null
  readonly anlass: string
  readonly objektart: string
  readonly vonStatus: string | null
  readonly nachStatus: string | null
  readonly stichtag: string | null
}

function rahmenbefund(
  pruefung: Pruefung,
  lage: Befundrahmen,
  ergebnisart: Ergebnisart,
  uebergangVollzogen: boolean,
  zusatz: Befundzusatz,
  fundstelle: string,
): Befund {
  return {
    pruefung,
    ergebnisart,
    uebergangVollzogen,
    werte: {
      ruleRef: REGELBEZEICHNER[pruefung],
      result: ergebnisart === 'sperre' ? 'blocked' : 'success',
      qZeile: lage.zeile?.nummer ?? null,
      anlass: lage.anlass,
      objektart: lage.objektart,
      statusVorher: lage.vonStatus,
      statusNachher: uebergangVollzogen ? lage.nachStatus : lage.vonStatus,
      stichtag: lage.stichtag,
      specReference: lage.zeile?.specReference ?? fundstelle,
      ...zusatz.ergaenzung,
    },
    adressaten: zusatz.adressaten,
    meldung: zusatz.meldung,
  }
}

/* ------------------------------------------------------------------ */
/* P7 und P8 — Arbeitskampf und Kennzeichnung (SPEC 5.3.2, 5.3.3)      */
/* ------------------------------------------------------------------ */

/** P7 — Einsatzverbot bei Arbeitskampf (SPEC 5.3.2). */
function pruefeP7(auftrag: Pruefauftrag): readonly Befund[] {
  const lage = leseArbeitskampflage(auftrag.sachverhalte, auftrag.ausloeser)

  // 5.3.6: die Sperre aus P7 ist **nicht übersteuerbar**. Die gesetzliche
  // Ausnahme ist allein die Zusicherung nach § 11 Abs. 5 Satz 2 AÜG — ein
  // eigener, dokumentierter Sachverhalt, keine Abweichung von der Regel. Eine
  // Übersteuerung wäre eine dokumentierte Rechtsverletzung.
  if (lage.uebersteuerung.beantragt) {
    return [
      arbeitskampfbefund(lage, 'sperre', false, {
        ergaenzung: { uebersteuerung: 'zurückgewiesen', uebersteuerbar: 'nein' },
        adressaten: REGELWERK.adressatenArbeitskampf,
        meldung:
          'P7: Die Übersteuerung wird zurückgewiesen, weil die Prüfung P7 nicht übersteuerbar ' +
          'ist (SPEC 5.3.6, 5.5.4). Die gesetzliche Ausnahme ist allein die Zusicherung nach ' +
          '§ 11 Abs. 5 Satz 2 AÜG, dass der Leiharbeitnehmer keine Tätigkeiten der ' +
          'Arbeitskampfbetroffenen übernimmt — oder ein späterer Start. Eine Übersteuerung ' +
          'wäre eine dokumentierte Rechtsverletzung.',
      }),
    ]
  }

  const ergebnis = pruefeArbeitskampf(lage.lage)
  const zeile = lage.zeile
  const roh: Ergebnisart = !ergebnis.treffer
    ? 'information'
    : ergebnis.milderung !== null
      ? // 5.3.2 Schritt 3 und Grenzfall „Nur ein Teil des Betriebs betroffen":
        // „Warnung **statt** Treffer". Die Milderung schlägt die Ergebnisart aus
        // 4.7 — und nur nach unten.
        'warnung'
      : (zeile?.trefferart ?? 'warnung')

  // 5.3.2, Grenzfall „Rückwirkende Anzeige": wird ein Arbeitskampf nachträglich
  // für einen vergangenen Zeitraum angezeigt, in dem ein Einsatz lief, ist das
  // Ergebnis eine Warnung mit Pflicht-Eskalation an `MA`. Eine Sperre greift
  // nicht mehr; genehmigte Zeiten werden nicht entwertet (5.5.3).
  const rueckwirkend =
    (lage.anlass === 'erfassung' || lage.anlass === 'berichtigung') && ergebnis.treffer
  const ergebnisart: Ergebnisart = rueckwirkend && roh === 'sperre' ? 'warnung' : roh
  const kennStatuswechsel = lage.anlass === 'uebergang' || lage.anlass === 'uebergangsversuch'

  const adressaten =
    lage.anlass === 'nachtlauf' && ergebnis.treffer
      ? REGELWERK.adressatenArbeitskampfNachtlauf
      : rueckwirkend
        ? [...new Set([...ergebnis.adressaten, ...REGELWERK.adressatenRueckwirkenderBefund])]
        : ergebnis.adressaten

  return [
    arbeitskampfbefund(lage, ergebnisart, kennStatuswechsel && ergebnisart !== 'sperre', {
      ergaenzung: {
        // Bei → `tendered` ist der **Zeitraum** der Prüfgegenstand, nicht ein
        // Stichtag (5.3.2 Schritt 1); er gehört deshalb in den Befund.
        pruefzeitraumVon: lage.lage.zeitraum?.von ?? null,
        pruefzeitraumBis: lage.lage.zeitraum?.bis ?? null,
        standort: lage.lage.standort,
        taetigkeit: lage.lage.taetigkeit,
        ...arbeitskampfwerte(ergebnis),
      },
      adressaten,
      meldung: `${ergebnis.meldung}${nachsatzP7(lage.anlass, rueckwirkend, ergebnis)}`,
    }),
  ]
}

/**
 * Was der nächtliche Lauf und die nachgetragene Anzeige dem Befund hinzufügen
 * (SPEC 5.5.1 Zeile N4 und 5.3.2, Grenzfall „Rückwirkende Anzeige").
 */
function nachsatzP7(
  anlass: string,
  rueckwirkend: boolean,
  ergebnis: Arbeitskampfergebnis,
): string {
  if (!ergebnis.treffer) return ''
  if (anlass === 'nachtlauf') {
    return (
      ' Der nächtliche Lauf führt den Befund als Warnung mit Pflicht-Eskalation an den ' +
      'MSP-Disponenten und den MSP-Administrator und **schlägt die Unterbrechung vor**. Das ' +
      'System unterbricht den Einsatz nicht selbst: ein Systemstatuswechsel am laufenden ' +
      'Einsatz hätte arbeits- und vertragsrechtliche Folgen, und 4.0 Regel 4 lässt ' +
      'zeitgesteuerte Übergänge nur dort zu, wo sie entziehen. Der Übergang `active` → ' +
      '`interrupted` liegt in 4.3.1 bereit und wird von `MD` ausgelöst (SPEC 5.3.2, 5.5.1 N4).'
    )
  }
  if (rueckwirkend) {
    return (
      ' Die Anzeige ist nachgetragen und betrifft einen Zeitraum, in dem der Einsatz lief. Das ' +
      'Ergebnis ist eine Warnung mit Pflicht-Eskalation an den MSP-Administrator; eine Sperre ' +
      'greift nicht mehr, und genehmigte Zeiten werden nicht entwertet (SPEC 5.3.2, 5.5.3 R3 ' +
      'und R4).'
    )
  }
  return ''
}

/** P8 — Kennzeichnungs- und Konkretisierungspflicht (SPEC 5.3.3). */
function pruefeP8(auftrag: Pruefauftrag): readonly Befund[] {
  const lage = leseKonkretisierungslage(auftrag.sachverhalte, auftrag.ausloeser)

  // 5.3.6: **keine** Übersteuerung. Die Konkretisierung wird nachgetragen, nicht
  // übersteuert — und nach dem ersten Überlassungstag hilft auch keine
  // Übersteuerung mehr (§ 1 Abs. 1 Sätze 5, 6; § 9 Abs. 1 Nr. 1a AÜG).
  if (lage.uebersteuerung.beantragt) {
    return [
      konkretisierungsbefund(lage, 'sperre', false, {
        ergaenzung: { uebersteuerung: 'zurückgewiesen', uebersteuerbar: 'nein' },
        adressaten: REGELWERK.adressatenKonkretisierung,
        meldung:
          'P8: Die Übersteuerung wird zurückgewiesen, weil die Prüfung P8 nicht übersteuerbar ' +
          'ist (SPEC 5.3.6, 5.5.4). Die Konkretisierung wird nachgetragen, nicht übersteuert; ' +
          'nach dem ersten Überlassungstag ist der Verstoß nicht mehr heilbar.',
      }),
    ]
  }

  const ergebnis = pruefeKonkretisierung(lage.lage, lage.stufe)
  const zeile = lage.zeile
  const roh: Ergebnisart = !ergebnis.treffer
    ? 'information'
    : ergebnis.nurWarnung
      ? // 5.3.3, Grenzfall „Rahmenvertrag läuft im Einsatzzeitraum ab": Warnung
        // mit Nennung des Enddatums, nicht Sperre — die Kennzeichnung lag bei
        // Beginn vor, und der Vertrag kann verlängert werden.
        'warnung'
      : (zeile?.trefferart ?? 'warnung')

  // 5.3.3, Grenzfall „Rückwirkende Korrektur": ein in der Vergangenheit
  // erfüllter Verstoß wird festgestellt und eskaliert, nicht rückwirkend
  // gesperrt (5.5.3 R3, R4).
  const rueckwirkend = lage.anlass === 'berichtigung' && ergebnis.treffer
  const ergebnisart: Ergebnisart = rueckwirkend && roh === 'sperre' ? 'warnung' : roh
  const kennStatuswechsel = lage.anlass === 'uebergang' || lage.anlass === 'uebergangsversuch'

  return [
    konkretisierungsbefund(lage, ergebnisart, kennStatuswechsel && ergebnisart !== 'sperre', {
      ergaenzung: konkretisierungswerte(ergebnis),
      adressaten: rueckwirkend
        ? [...new Set([...ergebnis.adressaten, ...REGELWERK.adressatenRueckwirkenderBefund])]
        : ergebnis.adressaten,
      meldung: rueckwirkend
        ? `${ergebnis.meldung} Die Änderung legt den Mangel nachträglich offen. Der Befund wird ` +
          'festgestellt und eskaliert, nicht rückwirkend gesperrt; abgerechnete Zeiträume ' +
          'werden nicht entwertet (SPEC 5.3.3, 5.5.3 R3 und R4). P4 läuft ebenfalls erneut: die ' +
          'Tätigkeit bestimmt das Vergleichsentgelt (5.2.4).'
        : ergebnis.meldung,
    }),
  ]
}

function arbeitskampfwerte(
  ergebnis: Arbeitskampfergebnis,
): Record<string, string | number | null> {
  return {
    treffer: ergebnis.treffer ? 'ja' : 'nein',
    anzeigeVorhanden: ergebnis.anzeigeVorhanden ? 'ja' : 'nein',
    betroffen: ergebnis.betroffen ? 'ja' : 'nein',
    betroffeneTage: ergebnis.betroffeneTage.join(','),
    anzahlBetroffeneTage: ergebnis.betroffeneTage.length,
    anzeigeVon: ergebnis.anzeigeVon,
    anzeigeBis: ergebnis.anzeigeBis,
    anzeigeOffen: ergebnis.offenesEnde ? 'ja' : 'nein',
    milderung: ergebnis.milderung,
    zusicherung: ergebnis.milderung === 'zusicherung' ? 'ja' : 'nein',
    vermerke: ergebnis.vermerke.join(' | '),
  }
}

function konkretisierungswerte(
  ergebnis: Konkretisierungsergebnis,
): Record<string, string | number | null> {
  return {
    treffer: ergebnis.treffer ? 'ja' : 'nein',
    stufe: ergebnis.stufe,
    kriterienGeprueft: ergebnis.kriterien.map((befund) => befund.kriterium).join(','),
    kriterienErfuellt: ergebnis.kriterien
      .filter((befund) => befund.erfuellt === true)
      .map((befund) => befund.kriterium)
      .join(','),
    kriterienOffen: ergebnis.offen.join(','),
    kriterienNichtPruefbar: ergebnis.nichtPruefbar.join(','),
    pruefbar: ergebnis.nichtPruefbar.length === 0 ? 'ja' : 'nein',
    mangel: ergebnis.offen.length === 0 ? null : ergebnis.offen.join(','),
    laufzeitende: ergebnis.laufzeitendeImEinsatz,
    fehlendeFelder: ergebnis.fehlendeFelder.join(','),
    vermerke: ergebnis.vermerke.join(' | '),
  }
}

function arbeitskampfbefund(
  lage: Arbeitskampfprueflage,
  ergebnisart: Ergebnisart,
  uebergangVollzogen: boolean,
  zusatz: Befundzusatz,
): Befund {
  return rahmenbefund('P7', lage, ergebnisart, uebergangVollzogen, zusatz, 'SPEC 5.3.2')
}

function konkretisierungsbefund(
  lage: Konkretisierungsprueflage,
  ergebnisart: Ergebnisart,
  uebergangVollzogen: boolean,
  zusatz: Befundzusatz,
): Befund {
  return rahmenbefund('P8', lage, ergebnisart, uebergangVollzogen, zusatz, 'SPEC 5.3.3')
}
