/**
 * P10 — Pflichtnachweise (`mandatoryDocumentCheck`), SPEC 5.4.4.
 *
 * **Die Regel in Worten.** Der Pflichtkatalog ist **fest** und nicht je Kunde
 * konfigurierbar (Entscheidung zu Frage 20, 3.10). Er sagt je Nachweisart, wann
 * sie Pflicht ist, an welchem Übergang sie geprüft wird und was ihr Fehlen oder
 * ihr Ablauf bewirkt. P10 ist eine **Sammelprüfung**: an einem Übergang prüft
 * sie alle Nachweisarten, die für die beteiligten Objekte Pflicht sind. Das
 * Ergebnis ist das **strengste Einzelergebnis**, und jede Einzelfeststellung
 * wird eigens vermerkt (5.4.4, 5.5.2 Nr. 2).
 *
 * **Geprüft wird die Anerkennung, nicht die Gültigkeit des Status** (5.4.3):
 * `submitted` und `rejected` decken keinen Pflichtnachweis; ein abgelaufener
 * Nachweis bleibt `accepted` und ist nur für Tage außerhalb seines Zeitraums
 * unbrauchbar.
 *
 * **Die Ergebnisart kommt aus dem Katalog**, nicht aus der Zeile in 4.7. Wo
 * beide auseinandergehen — Q21 trägt in 4.7 eine Sperre, während
 * `qualificationCertificate` „nie Sperre" trägt; Q42 bis Q44 ebenso für
 * `clearanceCertificate` —, folgt die Rechnung dem Katalog. Das ist
 * ***offene Frage 31***, und sie hält dort ausdrücklich fest, dass die
 * Szenarien in `tests/aueg/` nach dem Katalog rechnen und die Abweichung
 * benennen. Geraten wird hier nichts.
 *
 * **Fehlende Angaben zur Pflicht wirken wie „ja"** (5.4.6): ist
 * `candidate.workPermitRequired` oder `site.safetyBriefingRequired` nicht
 * gesetzt, wird die strengere Annahme gerechnet — die mildere würde eine
 * Sperre umgehen.
 *
 * **Die AÜG-Erlaubnis prüft P10 nicht.** Sie läuft über P9 (Q20) „und wird von
 * P10 nicht doppelt geprüft" (5.4.4).
 */

import { istVorOderGleich, tagesdifferenz, tageDesZeitraums, type Tag } from '../kalender'
import {
  REGELWERK,
  type Bezugsobjekt,
  type Nachweisart,
  type Regelwerkkonfiguration,
} from '../regelwerk'
import { strengstes, type Ergebnisart, type Rollenkuerzel } from '../typen'
import type { Zeitraum } from './p9Erlaubnis'

/** Anerkennungsstatus eines Nachweises (SPEC 3.10, Nachweisfluss 5.4.3). */
export type Anerkennung = 'submitted' | 'accepted' | 'rejected'

/** Ein Nachweis, wie P10 ihn braucht (SPEC 3.10). */
export interface Nachweis {
  readonly art: Nachweisart
  readonly anerkennung: Anerkennung
  readonly gueltigVon: Tag | null
  /** `validTo`; leer heißt unbefristet und läuft nicht ab (5.4.4). */
  readonly gueltigBis: Tag | null
  /** `fileRef` gesetzt — Pflicht nach 3.10. */
  readonly datei: boolean
  /**
   * Das Bezugsobjekt, dem der Nachweis gehört (`subjectRef`, 3.10). Ein
   * Nachweis eines **anderen** Kandidatensatzes deckt nicht mit: „der Nachweis
   * gehört dem Verleiher, der ihn eingestellt hat" (5.4.5).
   */
  readonly gehoertZu: string | null
}

export interface Nachweislage {
  /** Prüfzeitraum oder Stichtag aus 5.0; `null`, wenn der Vorgang keinen nennt. */
  readonly zeitraum: Zeitraum | null
  readonly nachweise: readonly Nachweis[]
  /** `candidate.workPermitRequired` (3.6); `null` = nicht gesetzt (5.4.6). */
  readonly arbeitserlaubnisErforderlich: boolean | null
  /** `site.safetyBriefingRequired` (3.1); `null` = nicht gesetzt (5.4.6). */
  readonly unterweisungVerlangt: boolean | null
  /**
   * Arten, die der Vorgang ausdrücklich als **nicht erfasst** benennt. Nur so
   * wird das Fehlen einer nie verpflichtenden Art zum Befund — sonst wäre jede
   * nicht erwähnte Art eine Warnung (5.4.4, Spalte „Pflicht, wenn" = „nie").
   */
  readonly ausdruecklichAbwesend: readonly Nachweisart[]
  /** Das Bezugsobjekt, gegen das geprüft wird (Kandidatensatz, Einsatz, Lieferant). */
  readonly bezugsobjekt: string | null
}

/** Warum eine Nachweisart nicht erfüllt ist. */
export type Nachweismangel =
  /** Kein Nachweis der Art erfasst (5.4.6). */
  | 'fehlt'
  /** `submitted` oder `rejected` — deckt nichts (5.4.3). */
  | 'nichtAnerkannt'
  /** Am Stichtag abgelaufen (5.4.4). */
  | 'abgelaufen'
  /** Der Zeitraum beginnt vor `validFrom`. */
  | 'nochNichtGueltig'
  /** `fileRef` fehlt — Datenfehler (3.10, 5.4.5). */
  | 'dateiFehlt'
  /** Nur ein Nachweis eines anderen Bezugsobjekts liegt vor (5.4.5). */
  | 'fremdesBezugsobjekt'

export interface Einzelbefund {
  readonly art: Nachweisart
  readonly ergebnisart: Ergebnisart
  /** `null`, wenn die Art erfüllt ist. */
  readonly mangel: Nachweismangel | null
  /** War die Art für diesen Vorgang Pflicht (`mandatory`, 3.10 abgeleitet)? */
  readonly pflicht: boolean
  /** Sperrt diese Art nach dem Katalog (`blocking`, 3.10 abgeleitet)? */
  readonly sperrend: boolean
  readonly bezugsobjekt: string
  readonly adressaten: readonly Rollenkuerzel[]
  readonly meldung: string
}

export interface Nachweisergebnis {
  readonly erfuellt: boolean
  /** Das strengste Einzelergebnis (5.4.4). */
  readonly ergebnisart: Ergebnisart
  readonly einzelbefunde: readonly Einzelbefund[]
  /** Nur die Feststellungen — die erfüllten Arten sind hier nicht enthalten. */
  readonly maengel: readonly Einzelbefund[]
  readonly adressaten: readonly Rollenkuerzel[]
  readonly meldung: string
  /**
   * Wurde die Gültigkeit überhaupt geprüft? Ohne Stichtag prüft P10 nur
   * Vorliegen und Anerkennung — 5.4.4 führt beides in getrennten Spalten, und
   * ohne Tag gibt es keinen Tag, für den ein Nachweis unbrauchbar wäre (5.4.3).
   */
  readonly gueltigkeitGeprueft: boolean
  /** Wie die Pflichtangaben gelesen wurden, auch wo sie fehlten (5.4.6). */
  readonly pflichtangaben: Readonly<Record<string, string>>
}

/**
 * Prüft die Pflichtnachweise eines Vorgangs — die Sammelprüfung aus 5.4.4.
 *
 * `qZeile` ist die Nummer aus 4.7 (`Q21`, `Q37`, …) oder `N5` für den
 * nächtlichen Lauf. Sie entscheidet, **welche** Arten geprüft werden: eine Art
 * ohne Eintrag für diese Zeile wird nicht geprüft.
 */
export function pruefeNachweise(
  lage: Nachweislage,
  qZeile: string,
  konfiguration: Regelwerkkonfiguration = REGELWERK,
  /**
   * Nur diese Nachweisarten prüfen. Gedacht für den Anlass **Speicherung**
   * (5.5.1 b): dort wird ein einzelnes Dokument geändert, und neu abzuleiten
   * sind `mandatory` und `blocking` **dieses** Nachweises — nicht der ganze
   * Katalog. Ohne Angabe prüft die Sammelprüfung wie an einem Übergang alle
   * Arten, die für diese Zeile einen Prüfzeitpunkt tragen (5.4.4).
   */
  nurArten?: readonly Nachweisart[],
): Nachweisergebnis {
  const arten = (Object.keys(konfiguration.katalog) as Nachweisart[]).filter(
    (art) =>
      konfiguration.katalog[art].wirkung[qZeile] !== undefined &&
      (nurArten === undefined || nurArten.includes(art)),
  )

  const einzelbefunde = arten.map((art) => bewerteArt(art, lage, qZeile, konfiguration))
  const maengel = einzelbefunde.filter((befund) => befund.mangel !== null)
  const ergebnisart = strengstes(maengel.map((befund) => befund.ergebnisart))

  return {
    erfuellt: maengel.length === 0,
    ergebnisart,
    einzelbefunde,
    maengel,
    adressaten: eindeutig(maengel.flatMap((befund) => [...befund.adressaten])),
    meldung: sammelmeldung(maengel, arten, qZeile),
    gueltigkeitGeprueft: lage.zeitraum !== null,
    pflichtangaben: {
      workPermitRequired: alsAngabe(lage.arbeitserlaubnisErforderlich),
      safetyBriefingRequired: alsAngabe(lage.unterweisungVerlangt),
    },
  }
}

/**
 * Die gestufte Ablaufbehandlung vor dem Ende eines Nachweises (SPEC 5.4.4,
 * nächtlicher Lauf N5 in 5.5.1). Maßgeblich ist der Nachweis, dessen Ende am
 * nächsten liegt: er bestimmt die Stufe.
 */
export type Vorlaufstufe = 'keine' | 'information' | 'warnung' | 'eskalation' | 'abgelaufen'

export interface Nachweisvorlauf {
  readonly stufe: Vorlaufstufe
  readonly art: Nachweisart | null
  readonly restzeitTage: number | null
  readonly endeBis: Tag | null
  readonly adressaten: readonly Rollenkuerzel[]
  readonly meldung: string
}

export function pruefeNachweisVorlauf(
  lage: Nachweislage,
  stichtag: Tag,
  konfiguration: Regelwerkkonfiguration = REGELWERK,
): Nachweisvorlauf {
  // N5: „Nachweise mit `validTo`, deren Bezugsobjekt aktiv ist."
  const mitEnde = lage.nachweise.filter(
    (nachweis) => nachweis.anerkennung === 'accepted' && nachweis.gueltigBis !== null,
  )
  if (mitEnde.length === 0) {
    return {
      stufe: 'keine',
      art: null,
      restzeitTage: null,
      endeBis: null,
      adressaten: [],
      meldung:
        'P10: Kein anerkannter Nachweis mit Enddatum; ein Nachweis ohne Enddatum gilt ' +
        'unbefristet und läuft nicht ab (SPEC 5.4.4).',
    }
  }

  const naechster = mitEnde.reduce((frueheste, nachweis) =>
    istVorOderGleich(nachweis.gueltigBis as Tag, frueheste.gueltigBis as Tag) ? nachweis : frueheste,
  )
  const endeBis = naechster.gueltigBis as Tag
  const restzeitTage = tagesdifferenz(stichtag, endeBis)
  const vorlauf = konfiguration.vorlauf[naechster.art]
  const stufen = konfiguration.stufenadressaten[naechster.art]

  let stufe: Vorlaufstufe = 'keine'
  if (restzeitTage < 0) stufe = 'abgelaufen'
  else if (vorlauf.eskalation !== null && restzeitTage <= vorlauf.eskalation) stufe = 'eskalation'
  else if (vorlauf.warnung !== null && restzeitTage <= vorlauf.warnung) stufe = 'warnung'
  else if (vorlauf.information !== null && restzeitTage <= vorlauf.information) {
    stufe = 'information'
  }

  const adressaten =
    stufe === 'abgelaufen'
      ? stufen.abgelaufen
      : stufe === 'eskalation'
        ? stufen.eskalation
        : stufe === 'warnung'
          ? stufen.warnung
          : stufe === 'information'
            ? stufen.information
            : []

  return {
    stufe,
    art: naechster.art,
    restzeitTage,
    endeBis,
    adressaten,
    meldung:
      stufe === 'abgelaufen'
        ? `P10: Der Nachweis „${naechster.art}" ist am ${endeBis} abgelaufen. Für einen neuen ` +
          'Vorgang greift die Sperre; der laufende Einsatz wird nicht beendet (SPEC 5.4.4).'
        : `P10: Der Nachweis „${naechster.art}" läuft am ${endeBis} ab — ${restzeitTage} Tage ` +
          'Restzeit (SPEC 5.4.4).',
  }
}

/* ------------------------------------------------------------------ */
/* Die abgeleiteten Felder `mandatory` und `blocking` (3.10)            */
/* ------------------------------------------------------------------ */

/**
 * `mandatory` und `blocking` eines Nachweises — **abgeleitet** aus dem
 * Pflichtkatalog (3.10: „nicht frei setzbar", 5.4.4).
 *
 * Diese Funktion ist der Grund, warum das Datenmodell die beiden Felder nicht
 * als Spalten führt: sie sind eine Rechnung über den Katalog und die Lage des
 * Bezugsobjekts, keine Eingabe. Wer sie anzeigen will — die Oberfläche, der
 * Dienst —, rechnet sie hier und schreibt sie nirgends hin.
 */
export interface Katalogwirkung {
  readonly pflicht: boolean
  readonly sperrend: boolean
  readonly bezugsobjekt: Bezugsobjekt
  /** Die Prüfzeitpunkte, an denen die Art überhaupt geprüft wird (5.4.4). */
  readonly prueft: readonly string[]
  readonly begruendung: string
}

export function katalogwirkung(
  art: Nachweisart,
  lage: {
    readonly arbeitserlaubnisErforderlich: boolean | null
    readonly unterweisungVerlangt: boolean | null
  },
  konfiguration: Regelwerkkonfiguration = REGELWERK,
): Katalogwirkung {
  const zeile = konfiguration.katalog[art]
  const pflicht = istPflicht(zeile.pflicht, {
    arbeitserlaubnisErforderlich: lage.arbeitserlaubnisErforderlich,
    unterweisungVerlangt: lage.unterweisungVerlangt,
  })
  const prueft = Object.keys(zeile.wirkung)
  // Die Erlaubnisurkunde ist der eine Fall, in dem die **Sperre** nicht in
  // dieser Tabelle steht: 5.4.4 führt für sie „Sperre (P9)", und der Rechenweg
  // liegt in p9Erlaubnis.ts („wird von P10 nicht doppelt geprüft"). Ihre
  // Sperrwirkung ist deshalb hier festgehalten und nicht aus `wirkung`
  // gelesen — sonst wäre das abgeleitete Feld `blocking` für genau den
  // strengsten Nachweis des Katalogs „nein".
  const sperrend =
    art === 'permitCertificate'
      ? true
      : Object.values(zeile.wirkung).includes('sperre')
  return {
    pflicht,
    sperrend,
    bezugsobjekt: zeile.bezugsobjekt,
    prueft,
    begruendung:
      art === 'permitCertificate'
        ? 'Pflicht immer, Sperre über P9 (SPEC 5.4.4, 5.4.1).'
        : `${pflichtwortlaut(zeile.pflicht, pflicht)} ${
            sperrend ? 'Sperre' : 'Warnung oder Information'
          } nach dem Katalog (SPEC 5.4.4).`,
  }
}

/**
 * Passt die Nachweisart zum Bezugsobjekt? Die Vorbedingung des Anerkennens aus
 * 5.4.3 („Nachweisart und Bezugsobjekt passen zum Katalog") — gelesen aus dem
 * Katalog, nicht hier aufgezählt.
 */
export function passtZumBezugsobjekt(art: Nachweisart, subjectType: string): boolean {
  const erwartet = REGELWERK.katalog[art].bezugsobjekt
  if (erwartet === 'beliebig') return true
  return BEZUGSOBJEKT_ZU_SUBJECT_TYPE[erwartet] === subjectType
}

/** Bezugsobjekt des Katalogs (5.4.4) → `subjectType` des Dokuments (3.10). */
const BEZUGSOBJEKT_ZU_SUBJECT_TYPE: Readonly<Record<Exclude<Bezugsobjekt, 'beliebig'>, string>> = {
  lieferant: 'supplier',
  kandidat: 'candidate',
  einsatz: 'assignment',
  rahmenvertrag: 'masterAgreement',
}

function pflichtwortlaut(bedingung: string, pflicht: boolean): string {
  switch (bedingung) {
    case 'immer':
      return 'Pflicht immer.'
    case 'wennArbeitserlaubnisErforderlich':
      return pflicht
        ? 'Pflicht, weil der Kandidat eine Arbeitserlaubnis braucht (3.6).'
        : 'Keine Pflicht: der Kandidat braucht keine Arbeitserlaubnis (3.6).'
    case 'wennStandortVerlangt':
      return pflicht
        ? 'Pflicht, weil der Standort eine Unterweisung verlangt (3.1).'
        : 'Keine Pflicht: der Standort verlangt keine Unterweisung (3.1).'
    default:
      return 'Nie Pflicht.'
  }
}

function bewerteArt(
  art: Nachweisart,
  lage: Nachweislage,
  qZeile: string,
  konfiguration: Regelwerkkonfiguration,
): Einzelbefund {
  const zeile = konfiguration.katalog[art]
  const wirkung = zeile.wirkung[qZeile] ?? 'information'
  const stufen = konfiguration.stufenadressaten[art]
  const pflicht = istPflicht(zeile.pflicht, lage)
  const sperrend = wirkung === 'sperre'

  // 5.4.5: Ein Nachweis eines anderen Kandidatensatzes derselben Person deckt
  // nicht mit. Gehört er einem benannten anderen Objekt, zählt er nicht.
  const eigene = lage.nachweise.filter(
    (nachweis) =>
      nachweis.art === art &&
      (nachweis.gehoertZu === null ||
        lage.bezugsobjekt === null ||
        nachweis.gehoertZu === lage.bezugsobjekt),
  )
  const fremde = lage.nachweise.filter(
    (nachweis) =>
      nachweis.art === art &&
      nachweis.gehoertZu !== null &&
      lage.bezugsobjekt !== null &&
      nachweis.gehoertZu !== lage.bezugsobjekt,
  )

  const befund = (mangel: Nachweismangel | null, grund: string): Einzelbefund => ({
    art,
    ergebnisart: mangel === null ? 'information' : wirkung,
    mangel,
    pflicht,
    sperrend,
    bezugsobjekt: zeile.bezugsobjekt,
    adressaten:
      mangel === null ? [] : mangel === 'abgelaufen' ? stufen.abgelaufen : stufen.warnung,
    meldung:
      mangel === null
        ? `P10: Der Nachweis „${art}" zum Bezugsobjekt ${zeile.bezugsobjekt} liegt vor und ist gültig.`
        : `P10: ${grund} Nachweisart „${art}", Bezugsobjekt ${zeile.bezugsobjekt} (SPEC 5.4.4).`,
  })

  if (eigene.length === 0) {
    if (fremde.length > 0) {
      return befund(
        'fremdesBezugsobjekt',
        'Nur ein Nachweis eines anderen Bezugsobjekts liegt vor; er deckt nicht mit.',
      )
    }
    // Eine Art, die nach dem Katalog nie Pflicht ist, wird nur dann zum Befund,
    // wenn der Vorgang ihr Fehlen ausdrücklich feststellt.
    if (!pflicht && !lage.ausdruecklichAbwesend.includes(art)) {
      return befund(null, '')
    }
    return befund('fehlt', 'Der Nachweis fehlt vollständig.')
  }

  const anerkannt = eigene.filter((nachweis) => nachweis.anerkennung === 'accepted')
  if (anerkannt.length === 0) {
    return befund(
      'nichtAnerkannt',
      'Der Nachweis ist eingestellt, aber nicht anerkannt; er deckt nichts.',
    )
  }

  const mitDatei = anerkannt.filter((nachweis) => nachweis.datei)
  if (mitDatei.length === 0) {
    return befund('dateiFehlt', 'Am anerkannten Nachweis fehlt die Datei (`fileRef`).')
  }

  // Ohne Stichtag gibt es keinen Tag, für den der Nachweis unbrauchbar wäre
  // (5.4.3). Vorliegen und Anerkennung sind damit geprüft, die Gültigkeit nicht.
  if (lage.zeitraum === null) return befund(null, '')

  const tage = tageDesZeitraums(lage.zeitraum.von, lage.zeitraum.bis)
  const ungedeckt = tage.filter(
    (prueftag) => !mitDatei.some((nachweis) => deckt(nachweis, prueftag)),
  )
  if (ungedeckt.length === 0) return befund(null, '')

  const ersterUngedeckt = ungedeckt[0] as Tag
  const zuSpaet = mitDatei.some(
    (nachweis) => nachweis.gueltigBis !== null && !istVorOderGleich(ersterUngedeckt, nachweis.gueltigBis),
  )
  return zuSpaet
    ? befund('abgelaufen', `Der Nachweis ist am ${ersterUngedeckt} abgelaufen.`)
    : befund('nochNichtGueltig', `Der Nachweis gilt am ${ersterUngedeckt} noch nicht.`)
}

function deckt(nachweis: Nachweis, prueftag: Tag): boolean {
  if (nachweis.gueltigVon !== null && !istVorOderGleich(nachweis.gueltigVon, prueftag)) {
    return false
  }
  // 5.4.4: ein anerkannter Nachweis ohne Enddatum gilt unbefristet.
  return nachweis.gueltigBis === null || istVorOderGleich(prueftag, nachweis.gueltigBis)
}

/** `mandatory` wird aus dem Katalog **abgeleitet**, nicht gesetzt (3.10). */
function istPflicht(
  bedingung: string,
  lage: Pick<Nachweislage, 'arbeitserlaubnisErforderlich' | 'unterweisungVerlangt'>,
): boolean {
  switch (bedingung) {
    case 'immer':
      return true
    // 5.4.6: fehlt die Angabe, wird wie „ja" gerechnet — die strengere Annahme.
    case 'wennArbeitserlaubnisErforderlich':
      return lage.arbeitserlaubnisErforderlich ?? true
    case 'wennStandortVerlangt':
      return lage.unterweisungVerlangt ?? true
    default:
      return false
  }
}

function sammelmeldung(
  maengel: readonly Einzelbefund[],
  geprueft: readonly Nachweisart[],
  qZeile: string,
): string {
  if (maengel.length === 0) {
    return (
      `P10: Alle an ${qZeile} geprüften Pflichtnachweise liegen vor und sind gültig ` +
      `(${geprueft.join(', ')}; SPEC 5.4.4).`
    )
  }
  // 5.5.2 Nr. 2: jede Feststellung nennt ihre Nachweisart und ihr Bezugsobjekt —
  // nicht „Nachweise unvollständig" (5.4.6). Die Einzelmeldungen tragen das
  // Kennzeichen „P10" schon; ein zweites davor wäre nur Rauschen.
  return maengel.map((befund) => befund.meldung).join(' ')
}

function alsAngabe(wert: boolean | null): string {
  if (wert === null) return 'nicht gesetzt — wie „ja" gerechnet (SPEC 5.4.6)'
  return wert ? 'ja' : 'nein'
}

function eindeutig<T>(werte: readonly T[]): T[] {
  return [...new Set(werte)]
}
