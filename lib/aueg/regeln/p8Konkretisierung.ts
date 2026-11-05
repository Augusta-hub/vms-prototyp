/**
 * P8 — Kennzeichnungs- und Konkretisierungspflicht (SPEC 5.3.3,
 * § 1 Abs. 1 Sätze 5 und 6 AÜG).
 *
 * **Die Regel.** Verleiher und Entleiher haben die Überlassung vor Beginn im
 * Vertrag ausdrücklich als Arbeitnehmerüberlassung zu bezeichnen und die Person
 * des Leiharbeitnehmers vor der Überlassung unter Bezugnahme auf diesen Vertrag
 * zu konkretisieren. Ein Verstoß macht den Arbeitsvertrag unwirksam (§ 9 Abs. 1
 * Nr. 1a) und begründet ein Arbeitsverhältnis beim Entleiher (§ 10 Abs. 1).
 *
 * **Die schärfste Rechtsfolge auf der schwächsten Datengrundlage.** Das System
 * kann die Form eines Vertrags nicht beurteilen. Deshalb ist P8 eine
 * **formale** Prüfung von fünf Kriterien, und die fachliche Beurteilung bleibt
 * beim `MD` (5.3.3). Dieses Modul sagt nie, die Konkretisierung sei inhaltlich
 * erfüllt — es sagt, **welche** Kriterien geprüft wurden und welche nicht
 * erfüllt sind (5.3.3 Nr. 4). Der Unterschied ist nicht Stil: eine Zusicherung
 * über den Inhalt eines Vertrags wäre eine Behauptung, die diese Software nicht
 * belegen kann.
 *
 * **Drei Prüfstufen, weil drei Zeitpunkte verschieden viel können** (5.3.3,
 * Berechnungsvorschrift):
 *
 *  - `anfrage` (Q01, Q02) — die Bedarfsanfrage ist **kein**
 *    Überlassungsvertrag. Geprüft werden nur die Vorläufer von K3; das Ergebnis
 *    ist Information bzw. Warnung.
 *  - `anlage` (Q45) — K1 bis K4. Fehlt eines, ist der Weg offen und zumutbar:
 *    das Feld wird nachgetragen.
 *  - `start` (Q46) — K5 **und** K1 bis K4 erneut, weil sich Rahmenvertrag und
 *    Felder zwischen Anlage und Start geändert haben können. Dies ist der
 *    letzte Zeitpunkt, an dem die Prüfung etwas verhindern kann: nach dem
 *    ersten Überlassungstag ist der Verstoß nicht mehr heilbar.
 */

import { istVorOderGleich, type Tag } from '../kalender'
import { REGELWERK, type Regelwerkkonfiguration } from '../regelwerk'
import type { Rollenkuerzel } from '../typen'

/** Der Prüfzeitpunkt (SPEC 5.3.3, Berechnungsvorschrift Nr. 1 bis 3). */
export type Pruefstufe = 'anfrage' | 'anlage' | 'start'

/** Die fünf Kriterien aus 5.3.3 mit ihrer Bezeichnung im Wortlaut der SPEC. */
export const KRITERIEN = {
  K1: 'K1 Kennzeichnung',
  K2: 'K2 Konkretisierung der Person',
  K3: 'K3 Konkretisierung der Tätigkeit',
  K4: 'K4 Konkretisierung von Ort und Zeit',
  K5: 'K5 Rechtzeitigkeit',
} as const

export type Kriterium = keyof typeof KRITERIEN

/**
 * Der Rahmenvertrag, auf den der Einsatz zurückgeführt wird (K1). Der Weg führt
 * über `assignment.agreedRateCardItemRef` → `rateCard.masterAgreementRef`
 * (3.3); dieses Modul bekommt das Ergebnis, nicht den Weg.
 */
export interface Rahmenvertrag {
  readonly bezeichnung: string | null
  /** `agreementType` (3.3) — K1 verlangt `supplierAgreement`. */
  readonly art: string | null
  /** `status` (3.3) — K1 verlangt `active`. */
  readonly status: string | null
  /** Gegenpartei; K1 verlangt `assignment.supplierRef`. */
  readonly gegenpartei: string | null
  readonly laufzeitVon: Tag | null
  readonly laufzeitBis: Tag | null
}

export interface Konkretisierungslage {
  /** `agreedRateCardItemRef` (3.7). Ohne sie ist K1 **nicht prüfbar**. */
  readonly preisposition: string | null
  readonly rahmenvertrag: Rahmenvertrag | null
  /** Der Lieferant des Einsatzes (`supplierRef`, 3.7) — Gegenpartei nach K1. */
  readonly lieferant: string | null
  /** `candidateRef` (3.7) — K2. */
  readonly kandidat: string | null
  /** `activityDescription` am Einsatz bzw. an der Anfrage (3.7) — K3. */
  readonly taetigkeit: string | null
  /** `demandRequest.title`; `null`, wenn es keine Anfrage gibt. */
  readonly titelDerAnfrage: string | null
  /**
   * Ob die Tätigkeitsbeschreibung mit dem Titel der Bedarfsanfrage **identisch**
   * ist. Eine **Tatsache** der Lage, keine Rechnung dieses Moduls: wo die Texte
   * vorliegen, vergleicht sie der Leser; wo der Vorgang die Identität
   * ausdrücklich feststellt, nimmt er die Feststellung. Beides sind Eingangsdaten
   * — wie `Vorbeschaeftigung.bestand` bei P6.
   */
  readonly taetigkeitWieTitel: boolean
  /** Ob der Einsatz auf eine Bedarfsanfrage zurückgeht (`demandRequestRef`). */
  readonly mitAnfrage: boolean
  /** Mindestens eine `qualificationRequirement` (3.4) — nur Stufe `anfrage`. */
  readonly qualifikationsanforderung: boolean | null
  /** `siteRef` (3.7) — K4. */
  readonly standort: string | null
  /**
   * Ob `plannedStartDate` **gesetzt** ist — das fragt K4. Getrennt von
   * `geplanterBeginn`, weil beides verschieden ist: K4 will wissen, **ob** Ort
   * und Zeit konkretisiert sind, K1 und K5 brauchen den **Wert**. Aus der
   * Datenbank sind beide dasselbe; ein erzählter Vorgang kann die Angabe als
   * gesetzt nennen, ohne ihren Wert zu nennen.
   */
  readonly beginnGesetzt: boolean
  /** `plannedStartDate` (3.7) — Wert für die Deckung in K1 und für K5. */
  readonly geplanterBeginn: Tag | null
  /** Geplantes Ende; K1 verlangt Deckung des Prüfzeitraums. */
  readonly geplantesEnde: Tag | null
  /** Tag des Übergangs nach `planned` (3.12) — K5. */
  readonly anlagetag: Tag | null
  /** `actualStartDate` (3.7) — der erste Überlassungstag, Bezug von K5. */
  readonly ersterUeberlassungstag: Tag | null
}

/** Ein geprüftes Kriterium. `erfuellt === null` heißt: **nicht prüfbar**. */
export interface Kriteriumsbefund {
  readonly kriterium: Kriterium
  readonly bezeichnung: string
  readonly erfuellt: boolean | null
  readonly grund: string
  /** Das Feld aus Kapitel 3, das fehlt oder nicht trägt. */
  readonly feld: string | null
}

export interface Konkretisierungsergebnis {
  readonly stufe: Pruefstufe
  readonly kriterien: readonly Kriteriumsbefund[]
  /** Kriterien, die nicht erfüllt oder nicht prüfbar sind. */
  readonly offen: readonly Kriterium[]
  readonly nichtPruefbar: readonly Kriterium[]
  readonly treffer: boolean
  /**
   * Der Rahmenvertrag endet **vor** dem geplanten Ende des Einsatzes: Warnung
   * mit Nennung des Enddatums, nicht Sperre — die Kennzeichnung lag bei Beginn
   * vor, und der Vertrag kann verlängert werden (5.3.3, Grenzfall).
   */
  readonly laufzeitendeImEinsatz: Tag | null
  /** Ob der Treffer auf eine Warnung begrenzt bleibt. */
  readonly nurWarnung: boolean
  readonly fehlendeFelder: readonly string[]
  readonly adressaten: readonly Rollenkuerzel[]
  readonly meldung: string
  readonly vermerke: readonly string[]
}

/**
 * Rechnet P8 nach SPEC 5.3.3. Die **Ergebnisart** bestimmt dieses Modul nicht
 * — sie kommt aus 4.7 (Q01 Information, Q02 Warnung, Q45 und Q46 Sperre),
 * gesetzt in `pruefwerk.ts` (5.5.1 a).
 */
export function pruefeKonkretisierung(
  lage: Konkretisierungslage,
  stufe: Pruefstufe,
  konfiguration: Regelwerkkonfiguration = REGELWERK,
): Konkretisierungsergebnis {
  const kriterien =
    stufe === 'anfrage'
      ? [pruefeVorlaeuferK3(lage)]
      : stufe === 'anlage'
        ? [pruefeK1(lage), pruefeK2(lage), pruefeK3(lage), pruefeK4(lage)]
        : [pruefeK1(lage), pruefeK2(lage), pruefeK3(lage), pruefeK4(lage), pruefeK5(lage)]

  const offen = kriterien
    .filter((befund) => befund.erfuellt !== true)
    .map((befund) => befund.kriterium)
  const nichtPruefbar = kriterien
    .filter((befund) => befund.erfuellt === null)
    .map((befund) => befund.kriterium)

  const laufzeitendeImEinsatz = laufzeitende(lage, stufe)
  const vermerke: string[] = []
  if (laufzeitendeImEinsatz !== null) {
    vermerke.push(
      `Der Rahmenvertrag endet am ${laufzeitendeImEinsatz} und damit vor dem geplanten Ende des ` +
        'Einsatzes. Das Ergebnis ist eine Warnung mit Nennung des Enddatums, keine Sperre: die ' +
        'Kennzeichnung lag bei Beginn vor, und der Vertrag kann verlängert werden (SPEC 5.3.3, ' +
        'Grenzfall „Rahmenvertrag läuft im Einsatzzeitraum ab").',
    )
  }
  if (stufe !== 'anfrage' && !lage.mitAnfrage) {
    vermerke.push(
      'Der Einsatz geht auf keine Bedarfsanfrage zurück (`demandRequestRef` ist in 3.7 ' +
        'optional). K3 prüft deshalb nur, ob die Tätigkeitsbeschreibung gesetzt und nicht leer ' +
        'ist; der Vergleich mit dem Titel entfällt (SPEC 5.3.3, Grenzfall „Einsatz ohne ' +
        'Bedarfsanfrage").',
    )
  }
  if (stufe === 'start') {
    vermerke.push(
      'K1 bis K4 werden am Einsatzstart erneut geprüft: Rahmenvertrag und Felder können sich ' +
        'zwischen Anlage und Start geändert haben (SPEC 5.3.3, Nr. 3).',
    )
  }

  const treffer = offen.length > 0 || laufzeitendeImEinsatz !== null
  // Die Laufzeitwarnung ist der einzige Trefferfall, den 5.3.3 ausdrücklich auf
  // eine Warnung begrenzt — und nur, solange kein Kriterium offen ist. Ein
  // offenes Kriterium ist die Sperre, die 4.7 vorsieht.
  const nurWarnung = offen.length === 0 && laufzeitendeImEinsatz !== null

  return {
    stufe,
    kriterien,
    offen,
    nichtPruefbar,
    treffer,
    laufzeitendeImEinsatz,
    nurWarnung,
    fehlendeFelder: kriterien
      .filter((befund) => befund.erfuellt !== true && befund.feld !== null)
      .map((befund) => befund.feld as string),
    adressaten: treffer ? adressatenZu(stufe, konfiguration) : [],
    meldung: meldungZu(stufe, kriterien, laufzeitendeImEinsatz, nurWarnung),
    vermerke,
  }
}

/* ------------------------------------------------------------------ */
/* Die Kriterien                                                       */
/* ------------------------------------------------------------------ */

/**
 * K1 — Kennzeichnung: der Einsatz ist auf einen **aktiven Rahmenvertrag der
 * Lieferantenseite** zurückzuführen, dessen Laufzeit den Prüfzeitraum deckt.
 *
 * Ohne `agreedRateCardItemRef` ist K1 **nicht prüfbar**: das Feld ist in 3.7
 * Pflicht, sein Fehlen ist ein Datenfehler und wirkt nach 5.0 wie ein Treffer
 * (5.3.3, Grenzfall „Fehlende Preisposition").
 */
function pruefeK1(lage: Konkretisierungslage): Kriteriumsbefund {
  const rahmen = { kriterium: 'K1' as const, bezeichnung: KRITERIEN.K1 }

  if (lage.preisposition === null) {
    return {
      ...rahmen,
      erfuellt: null,
      feld: 'agreedRateCardItemRef',
      grund:
        'Ohne vereinbarte Preisposition führt kein Weg zum Rahmenvertrag ' +
        '(`agreedRateCardItemRef` → `rateCard.masterAgreementRef`, SPEC 3.3). Das Feld ist in ' +
        '3.7 Pflicht: der Fall ist ein Datenfehler und wirkt wie ein Treffer (SPEC 5.0).',
    }
  }

  const vertrag = lage.rahmenvertrag
  if (vertrag === null) {
    return {
      ...rahmen,
      erfuellt: false,
      feld: 'masterAgreementRef',
      grund:
        'Zur Preisposition ist kein Rahmenvertrag der Lieferantenseite auffindbar. Ohne ihn ' +
        'fehlt die Kennzeichnung der Überlassung (§ 1 Abs. 1 Satz 5 AÜG).',
    }
  }

  if (vertrag.art !== null && vertrag.art !== 'supplierAgreement') {
    return {
      ...rahmen,
      erfuellt: false,
      feld: 'agreementType',
      grund:
        `Der Rahmenvertrag ${benennung(vertrag)} trägt die Art „${vertrag.art}". K1 verlangt ` +
        '`supplierAgreement`: gekennzeichnet wird das Verhältnis zur Lieferantenseite.',
    }
  }

  if (vertrag.status !== 'active') {
    return {
      ...rahmen,
      erfuellt: false,
      feld: 'status',
      grund:
        `Der Rahmenvertrag ${benennung(vertrag)} steht im Status ` +
        `„${vertrag.status ?? '(nicht gesetzt)'}" und nicht in „active". Nur ein aktiver ` +
        'Rahmenvertrag kennzeichnet die Überlassung (SPEC 5.3.3, K1).',
    }
  }

  if (
    lage.lieferant !== null &&
    vertrag.gegenpartei !== null &&
    vertrag.gegenpartei !== lage.lieferant
  ) {
    return {
      ...rahmen,
      erfuellt: false,
      feld: 'supplierRef',
      grund:
        `Der Rahmenvertrag ${benennung(vertrag)} ist mit „${vertrag.gegenpartei}" geschlossen, ` +
        `der Einsatz läuft über „${lage.lieferant}". K1 verlangt die Gegenpartei ` +
        '`assignment.supplierRef`; ein Lieferantenwechsel braucht einen eigenen Rahmenvertrag ' +
        '(SPEC 5.3.3, Grenzfall „Lieferantenwechsel").',
    }
  }

  // Beginn der Laufzeit: deckt der Vertrag den geplanten Beginn nicht, ist die
  // Kennzeichnung zum Prüfzeitpunkt nicht vorhanden — das ist kein Grenzfall,
  // sondern das Fehlen selbst.
  if (
    vertrag.laufzeitVon !== null &&
    lage.geplanterBeginn !== null &&
    !istVorOderGleich(vertrag.laufzeitVon, lage.geplanterBeginn)
  ) {
    return {
      ...rahmen,
      erfuellt: false,
      feld: 'validFrom',
      grund:
        `Der Rahmenvertrag ${benennung(vertrag)} beginnt erst am ${vertrag.laufzeitVon} und ` +
        `deckt den geplanten Beginn ${lage.geplanterBeginn} nicht.`,
    }
  }

  return {
    ...rahmen,
    erfuellt: true,
    feld: null,
    grund:
      `Der Einsatz verweist über die Preisposition „${lage.preisposition}" auf den aktiven ` +
      `Rahmenvertrag ${benennung(vertrag)} der Lieferantenseite.`,
  }
}

/** K2 — Konkretisierung der Person: `assignment.candidateRef` gesetzt (3.7). */
function pruefeK2(lage: Konkretisierungslage): Kriteriumsbefund {
  const gesetzt = lage.kandidat !== null && lage.kandidat.trim() !== ''
  return {
    kriterium: 'K2',
    bezeichnung: KRITERIEN.K2,
    erfuellt: gesetzt,
    feld: gesetzt ? null : 'candidateRef',
    grund: gesetzt
      ? `Der Einsatz nennt den Kandidaten „${lage.kandidat as string}".`
      : 'Am Einsatz ist kein Kandidat gesetzt. Die Person des Leiharbeitnehmers ist vor der ' +
        'Überlassung zu konkretisieren (§ 1 Abs. 1 Satz 6 AÜG).',
  }
}

/**
 * K3 — Konkretisierung der Tätigkeit: `activityDescription` gesetzt, nicht leer
 * und **nicht identisch** mit `demandRequest.title`. Ohne Bedarfsanfrage
 * entfällt der Vergleich (5.3.3, Grenzfall „Einsatz ohne Bedarfsanfrage").
 */
function pruefeK3(lage: Konkretisierungslage): Kriteriumsbefund {
  const rahmen = { kriterium: 'K3' as const, bezeichnung: KRITERIEN.K3 }
  const beschreibung = lage.taetigkeit?.trim() ?? ''

  if (beschreibung === '') {
    return {
      ...rahmen,
      erfuellt: false,
      feld: 'activityDescription',
      grund:
        'Am Einsatz ist keine Tätigkeitsbeschreibung gesetzt. Sie ist in 3.7 Pflicht und am ' +
        'Einsatz eigenständig zu führen, nicht als Verweis auf die Anfrage.',
    }
  }

  if (lage.mitAnfrage && lage.taetigkeitWieTitel) {
    return {
      ...rahmen,
      erfuellt: false,
      feld: 'activityDescription',
      grund:
        'Die Tätigkeitsbeschreibung ist mit dem Titel der Bedarfsanfrage' +
        `${lage.titelDerAnfrage === null ? '' : ` („${lage.titelDerAnfrage}")`} identisch. Damit ` +
        'ist sie ein Verweis und keine eigenständige Konkretisierung (SPEC 5.3.3, K3).',
    }
  }

  return {
    ...rahmen,
    erfuellt: true,
    feld: null,
    grund: lage.mitAnfrage
      ? 'Die Tätigkeitsbeschreibung ist gesetzt und nicht mit dem Titel der Bedarfsanfrage ' +
        'identisch. Geprüft ist, **dass** sie eigenständig geführt wird — nicht, ob sie die ' +
        'Tätigkeit zutreffend beschreibt (SPEC 5.3.3, Nr. 4).'
      : 'Die Tätigkeitsbeschreibung ist gesetzt und nicht leer. Ohne Bedarfsanfrage entfällt ' +
        'der Vergleich mit einem Titel; beurteilt wird der Inhalt auch hier nicht.',
  }
}

/** K4 — Ort und Zeit: `siteRef` und `plannedStartDate` gesetzt (3.7). */
function pruefeK4(lage: Konkretisierungslage): Kriteriumsbefund {
  const rahmen = { kriterium: 'K4' as const, bezeichnung: KRITERIEN.K4 }
  const fehlend = [
    lage.standort === null || lage.standort.trim() === '' ? 'siteRef' : null,
    lage.beginnGesetzt ? null : 'plannedStartDate',
  ].filter((feld): feld is string => feld !== null)

  if (fehlend.length > 0) {
    return {
      ...rahmen,
      erfuellt: false,
      feld: fehlend.join(', '),
      grund:
        `Am Einsatz ${fehlend.length === 1 ? 'fehlt' : 'fehlen'} ${fehlend.join(' und ')}. ` +
        'Ort und Zeit der Überlassung sind vor ihrem Beginn zu konkretisieren.',
    }
  }

  return {
    ...rahmen,
    erfuellt: true,
    feld: null,
    grund:
      `Der Einsatz nennt den Standort „${lage.standort as string}" und den geplanten Beginn` +
      `${lage.geplanterBeginn === null ? '' : ` ${lage.geplanterBeginn}`}.`,
  }
}

/**
 * K5 — Rechtzeitigkeit: K1 bis K4 sind **vor** dem ersten Überlassungstag
 * erfüllt. Geprüft wird die **Tagesreihenfolge**: ein Übergang nach `planned`
 * am ersten Überlassungstag genügt, solange er vor dem Übergang nach `active`
 * liegt — die Uhrzeit eines Vertrags kann das System nicht beurteilen (5.3.3,
 * Grenzfall „Tag genau auf der Grenze").
 */
function pruefeK5(lage: Konkretisierungslage): Kriteriumsbefund {
  const rahmen = { kriterium: 'K5' as const, bezeichnung: KRITERIEN.K5 }

  if (lage.anlagetag === null || lage.ersterUeberlassungstag === null) {
    const fehlend =
      lage.anlagetag === null ? 'der Tag des Übergangs nach `planned` (3.12)' : '`actualStartDate`'
    return {
      ...rahmen,
      erfuellt: null,
      feld: lage.anlagetag === null ? 'statusTo' : 'actualStartDate',
      grund:
        `K5 vergleicht den Tag der Anlage mit dem ersten Überlassungstag; ${fehlend} ist nicht ` +
        'bekannt. Die Rechtzeitigkeit ist damit nicht prüfbar und wirkt wie ein Treffer ' +
        '(SPEC 5.0).',
    }
  }

  const rechtzeitig = istVorOderGleich(lage.anlagetag, lage.ersterUeberlassungstag)
  return {
    ...rahmen,
    erfuellt: rechtzeitig,
    feld: rechtzeitig ? null : 'statusTo',
    grund: rechtzeitig
      ? `Der Übergang nach „planned" liegt am ${lage.anlagetag} und damit nicht nach dem ersten ` +
        `Überlassungstag ${lage.ersterUeberlassungstag}. Beurteilt wird die Tagesreihenfolge, ` +
        'nicht die Uhrzeit des Vertrags.'
      : `Der Übergang nach „planned" liegt am ${lage.anlagetag} und damit **nach** dem ersten ` +
        `Überlassungstag ${lage.ersterUeberlassungstag}. Die Konkretisierung war zu Beginn der ` +
        'Überlassung nicht vorhanden; nach dem ersten Überlassungstag ist der Verstoß nicht ' +
        'mehr heilbar (§ 1 Abs. 1 Sätze 5 und 6, § 9 Abs. 1 Nr. 1a AÜG).',
  }
}

/**
 * Die Vorläufer von K3 an der Bedarfsanfrage (5.3.3 Nr. 1):
 * `activityDescription` gesetzt, nicht identisch mit `title`, mindestens eine
 * `qualificationRequirement`. Die Anfrage ist kein Überlassungsvertrag — das
 * Ergebnis ist Information bzw. Warnung, nie eine Sperre.
 */
function pruefeVorlaeuferK3(lage: Konkretisierungslage): Kriteriumsbefund {
  const rahmen = { kriterium: 'K3' as const, bezeichnung: KRITERIEN.K3 }
  const beschreibung = lage.taetigkeit?.trim() ?? ''

  if (beschreibung === '') {
    return {
      ...rahmen,
      erfuellt: false,
      feld: 'activityDescription',
      grund:
        'Die Bedarfsanfrage führt keine Tätigkeitsbeschreibung. Sie ist in 3.4 Pflicht ab ' +
        '`submitted`.',
    }
  }

  if (lage.taetigkeitWieTitel) {
    return {
      ...rahmen,
      erfuellt: false,
      feld: 'activityDescription',
      grund:
        `Titel und Tätigkeitsbeschreibung lauten beide „${lage.titelDerAnfrage ?? beschreibung}". Geprüft ist ` +
        'dieses Kriterium — nicht, ob der Text die Tätigkeit zutreffend beschreibt ' +
        '(SPEC 5.3.3, Nr. 4). Die Bedarfsanfrage ist kein Überlassungsvertrag; die Sperre ' +
        'gehört an den Einsatz (Q45, Q46).',
    }
  }

  if (lage.qualifikationsanforderung === false) {
    return {
      ...rahmen,
      erfuellt: false,
      feld: 'qualificationRequirement',
      grund:
        'Die Bedarfsanfrage nennt keine Qualifikationsanforderung. 5.3.3 Nr. 1 zählt sie zu den ' +
        'Vorläufern der Konkretisierung.',
    }
  }

  return {
    ...rahmen,
    erfuellt: true,
    feld: null,
    grund:
      'Die Bedarfsanfrage führt eine eigenständige Tätigkeitsbeschreibung und mindestens eine ' +
      'Qualifikationsanforderung. Geprüft sind diese Kriterien, nicht der Inhalt des Textes ' +
      '(SPEC 5.3.3, Nr. 4).',
  }
}

/* ------------------------------------------------------------------ */

/**
 * Endet der Rahmenvertrag vor dem geplanten Ende des Einsatzes? Nur dann, wenn
 * K1 im Übrigen trägt — ein Vertrag, der nicht aktiv ist, braucht keine
 * Laufzeitwarnung, er ist schon die Sperre.
 */
function laufzeitende(lage: Konkretisierungslage, stufe: Pruefstufe): Tag | null {
  if (stufe === 'anfrage') return null
  const bis = lage.rahmenvertrag?.laufzeitBis ?? null
  const ende = lage.geplantesEnde
  if (bis === null || ende === null) return null
  if (lage.rahmenvertrag?.status !== 'active') return null
  return istVorOderGleich(ende, bis) ? null : bis
}

function benennung(vertrag: Rahmenvertrag): string {
  return vertrag.bezeichnung === null ? 'der Lieferantenseite' : `„${vertrag.bezeichnung}"`
}

/**
 * Adressaten. 2.4 führt für den Anlass „AÜG-Sperre blockiert einen Vorgang"
 * `MD` mit Eskalation an `MA`; 5.3.3 nennt keine eigenen. An der
 * **Bedarfsanfrage** kommt `KB` hinzu: 4.1 macht die Anfrage zur Sache des
 * Bedarfsträgers, und das nicht erfüllte Kriterium betrifft ein Feld, das er
 * pflegt. Mehr leitet dieses Modul nicht ab.
 */
function adressatenZu(
  stufe: Pruefstufe,
  konfiguration: Regelwerkkonfiguration,
): readonly Rollenkuerzel[] {
  return stufe === 'anfrage'
    ? konfiguration.adressatenKonkretisierungAnfrage
    : konfiguration.adressatenKonkretisierung
}

function meldungZu(
  stufe: Pruefstufe,
  kriterien: readonly Kriteriumsbefund[],
  laufzeitendeImEinsatz: Tag | null,
  nurWarnung: boolean,
): string {
  const geprueft = kriterien.map((befund) => befund.kriterium).join(', ')
  const offen = kriterien.filter((befund) => befund.erfuellt !== true)

  const kopf =
    stufe === 'anfrage'
      ? `P8: An der Bedarfsanfrage werden die Vorläufer von K3 geprüft (SPEC 5.3.3 Nr. 1).`
      : `P8: Geprüft ${geprueft.length > 2 ? 'sind die Kriterien' : 'ist das Kriterium'} ${geprueft} ` +
        `(SPEC 5.3.3, ${stufe === 'anlage' ? 'Nr. 2' : 'Nr. 3'}).`

  if (offen.length === 0) {
    const schluss =
      laufzeitendeImEinsatz === null
        ? ' Alle geprüften Kriterien sind erfüllt. Das Ergebnis nennt die geprüften Kriterien; ' +
          'ob die Konkretisierung inhaltlich zutrifft, beurteilt das System nicht (SPEC 5.3.3, ' +
          'Nr. 4).'
        : ` Alle geprüften Kriterien sind erfüllt, der Rahmenvertrag endet jedoch am ` +
          `${laufzeitendeImEinsatz} vor dem geplanten Ende des Einsatzes — Warnung mit Nennung ` +
          'des Enddatums, keine Sperre.'
    return kopf + schluss
  }

  const liste = offen
    .map(
      (befund) =>
        `${befund.bezeichnung}${befund.erfuellt === null ? ' (nicht prüfbar)' : ''}: ${befund.grund}`,
    )
    .join(' ')

  const weg =
    stufe === 'anfrage'
      ? ' Das Ergebnis nennt das geprüfte Kriterium, nicht eine Beurteilung des Inhalts.'
      : nurWarnung
        ? ''
        : ' Der offene Weg ist, die Angabe nachzutragen; übersteuert wird die Konkretisierung ' +
          'nicht (SPEC 5.3.6).'

  return `${kopf} Nicht erfüllt: ${liste}${weg}`
}
