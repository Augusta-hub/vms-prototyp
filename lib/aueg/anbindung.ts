/**
 * Anbindung von P9 an die Übergänge, die 4.7 ihr zuordnet.
 *
 * Die Statusmodelle in `lib/status/` führen die Vorbedingung aus 5.4 schon als
 * **Tatsache**: `TenderInvitationFacts.hasAcceptedValidPermit` (Q06) und
 * `InvitedSupplierFact.hasAcceptedValidPermit` (Q04) tragen den Kommentar
 * „Erlaubnis anerkannt **und** am Stichtag gültig (5.4, Prüfung P9)". Wer
 * diesen Wert setzt, war bisher offen — ein Boolescher Wert, den irgendwer von
 * Hand füllt, ist genau die stille Lücke, die 5.0 verbietet („kein stilles
 * Durchlassen").
 *
 * Dieses Modul schließt sie: der Wert wird aus den Erlaubnissätzen (3.2)
 * **gerechnet**, mit demselben Rechenweg, den die Gherkin-Suite prüft. Der
 * Aufrufer, der die Tatsachen für einen Übergang zusammenstellt, nimmt ihn von
 * hier und nicht aus einem Feld.
 *
 * **Angebunden sind:**
 *
 *  - **P9** an Q04 und Q06 (4.1 Bedarfsanfrage, 4.2.1 Einladung) sowie an Q16,
 *    Q20 und Q31 (Einsatz und Verlängerung),
 *  - **P1** an die Zeilen am Profilvorschlag, am Einsatz und an der
 *    Verlängerung (Q07, Q11, Q14, Q23, Q26, Q28, Q30) samt den abgeleiteten
 *    Feldern `maxDurationEndDate` und `countedDurationDays` (3.7),
 *  - **P4** an Q36 (Stundenzettel, **Sperre**) und Q39 (Beleg, Warnung) — mit
 *    **einer** Lesart für beide Stellen,
 *  - **P5** an Q40 (Beleg) — die Zuordnung des Branchenzuschlagsschemas und
 *    die Plausibilität der abgerechneten Zuschlagsarten,
 *  - **P3** an die Zeilen am Einsatz und an der Verlängerung samt dem
 *    abgeleiteten Feld `equalPayDueDate` (3.7) und der Tatsache
 *    `equalPayDueFromFirstDay`, die zusammen mit `comparableWagePresent` die
 *    Sperre aus Q48 bildet,
 *  - **P6** an Q08, Q12 und Q15 — die Rechtsfolge `equalPayDueFromFirstDay`
 *    und die Tatsachengrundlage `hasPreviousEmploymentDeclaration`,
 *  - **P8** an Q45 und Q46 — die Tatsache `concretizationComplete` aus den
 *    Kriterien K1 bis K5 (5.3.3),
 *  - **P10** an Q10 und Q21 — die Pflichtnachweise aus dem Katalog in 5.4.4,
 *  - **P11** an Q09, Q13, Q17 und Q47.
 *
 * **Nicht angebunden** ist allein P2: die Unterbrechung wirkt über
 * `maxDurationEndDate` am Einsatz, und das Feld wird dort fortgeschrieben
 * (5.1.4).
 *
 * **P7 ist nicht angebunden, und zwar nicht aus Zeitmangel.** 5.3.2 hält fest,
 * dass Kapitel 3 für die Arbeitskampfanzeige **kein Feld** am Standort und für
 * die Zusicherung nach § 11 Abs. 5 Satz 2 AÜG **kein Objekt** führt; beides ist
 * behelfsweise ein `document` mit `documentCategory = other`. Die SPEC sagt
 * dazu selbst: „damit ist die Regel prüfbar, aber **nicht auswertbar**". Ein
 * Feld dafür zu erfinden wäre eine Entscheidung über *offene Frage 30*, und die
 * steht nicht hier. Der Rechenweg läuft deshalb gegen die Gherkin-Suite, und
 * `noIndustrialActionAtSite` bleibt in `lib/services/staffing.ts` der benannte,
 * **nicht sperrende** Wert — mit dieser Begründung, nicht als Lücke.
 *
 * **Dieses Modul rechnet, es lädt nicht.** Jede Funktion nimmt die Zeilen, die
 * der Aufrufer geladen hat, und gibt die Tatsache zurück, die das Statusmodell
 * verlangt. Damit bleibt die Fachlogik ohne Datenbank prüfbar — die
 * Einheitentests dazu kommen ohne Prisma aus.
 */

import { folgetag, istVorOderGleich, type Tag } from './kalender'
import {
  pruefeHoechstdauer,
  type Einsatzsatz,
  type Grenzherkunft,
} from './regeln/p1Hoechstdauer'
import { pruefeEqualPayFrist, type Fristfall } from './regeln/p3EqualPayFrist'
import {
  pruefeVergleichsentgelt,
  type Entgeltquelle,
} from './regeln/p4Vergleichsentgelt'
import { pruefeBranchenzuschlag } from './regeln/p5Branchenzuschlag'
import { pruefeDrehtuer } from './regeln/p6Drehtuer'
import { pruefeKonkretisierung, type Pruefstufe } from './regeln/p8Konkretisierung'
import { pruefeArbeitsverhaeltnis } from './regeln/p11Arbeitsverhaeltnis'
import {
  pruefeErlaubnis,
  type Anerkennung,
  type Erlaubnissatz,
  type Zeitraum,
} from './regeln/p9Erlaubnis'
import { pruefeNachweise } from './regeln/p10Nachweise'
import { REGELWERK, type Nachweisart } from './regelwerk'
import type { Ergebnisart } from './typen'

/**
 * Deckt die AÜG-Erlaubnis des Lieferanten den ganzen Zeitraum — anerkannt, mit
 * hinterlegter Urkunde, an **jedem** Tag (5.4.1, Schritte 2 bis 4)?
 *
 * Das ist der Wert für `hasAcceptedValidPermit` an Q04 und Q06. Für Q06 ist der
 * Zeitraum nach 5.0 der Tag des Übergangs bis zur Angebotsfrist — nicht nur der
 * Stichtag: eine Einladung, deren Erlaubnis vor dem Ende der Angebotsfrist
 * abläuft, ist nach 4.7 Q04 gesperrt.
 */
export function hatAnerkannteGueltigeErlaubnis(
  saetze: readonly Erlaubnissatz[],
  zeitraum: Zeitraum,
  lieferant = '(Lieferant)',
): boolean {
  return pruefeErlaubnis({ lieferant, saetze, zeitraum, unterbrechungen: [] }).gedeckt
}

/**
 * Derselbe Wert für einen einzelnen Stichtag — die Kurzform für die Übergänge,
 * denen 5.0 einen Stichtag und keinen Prüfzeitraum zuordnet.
 */
export function hatErlaubnisAmStichtag(
  saetze: readonly Erlaubnissatz[],
  stichtag: Tag,
  lieferant = '(Lieferant)',
): boolean {
  return hatAnerkannteGueltigeErlaubnis(saetze, { von: stichtag, bis: stichtag }, lieferant)
}

/* ------------------------------------------------------------------ */
/* P1, P6 und P11 an den Statusmodellen 4.2.3 und 4.3                  */
/* ------------------------------------------------------------------ */

/**
 * Ein Einsatz, wie das Datenmodell ihn führt (SPEC 3.7). Dieselben Felder, die
 * 5.1.3 als Eingangsdaten E3 bis E5 nennt — der Aufrufer gibt die Zeilen weiter,
 * die er geladen hat, und rechnet selbst nichts.
 */
export interface Einsatzzeile {
  readonly id: string
  readonly status: 'planned' | 'active' | 'interrupted' | 'completed' | 'terminatedEarly'
  readonly plannedStartDate: Date
  readonly plannedEndDate: Date | null
  readonly actualStartDate: Date | null
  readonly actualEndDate: Date | null
  readonly interruptions: readonly {
    readonly interruptionFrom: Date
    readonly interruptionTo: Date | null
  }[]
}

/** Eine Tarifzuordnung, wie 5.1.2 sie liest (SPEC 3.3). */
export interface Tarifzeile {
  readonly appliesToType: string
  readonly validFrom: Date
  readonly validTo: Date | null
  readonly maxAssignmentDurationMonths: number | null
}

/** Der Fristenstand der Höchstüberlassungsdauer (SPEC 5.1, abgeleitete Felder 3.7). */
export interface Hoechstdauerstand {
  /** Die Tatsache, die 4.2.3 und 4.3 als Vorbedingung nennen. */
  readonly maxDurationExceeded: boolean
  readonly maxDurationEndDate: Date | null
  readonly countedDurationDays: number | null
  readonly chainStartDate: Date | null
  /**
   * Die Einsätze der maßgeblichen Kette. `maxDurationEndDate` und
   * `countedDurationDays` werden an **jedem** von ihnen fortgeschrieben, nicht
   * nur am geprüften — sonst zeigt ein älterer Einsatz einen überholten Stand
   * (5.1.3, „Ergebnisfelder").
   */
  readonly chainAssignmentIds: readonly string[]
  readonly maxAssignmentDurationMonths: number
  readonly grenzeHerkunft: Grenzherkunft
  /** Wurde mit der gesetzlichen Regelgrenze gerechnet (5.1.2)? */
  readonly mitRegelgrenze: boolean
  readonly meldung: string
}

/**
 * Rechnet den Fristenstand nach SPEC 5.1 für einen Vorgang, dessen
 * Überlassungskette geladen ist.
 *
 * `einsaetze` ist die **vollständige** Kette: alle Einsätze derselben
 * bestätigten Personenidentität bei demselben Kunden (5.0, Überlassungskette).
 * Wer weniger übergibt, rechnet eine zu kurze Kette — `countedDurationDays`
 * kann dadurch nur zu **niedrig** sein, nie zu hoch (5.1.5), und das Ergebnis
 * trägt den Vermerk aus dem Rechenweg.
 *
 * `zeitraum` ist der Prüfzeitraum aus 5.0, `stichtag` der Stichtag; welcher von
 * beiden gilt, sagt die Zeile in 5.0 und nicht diese Funktion.
 */
export function hoechstdauerstand(eingabe: {
  readonly einsaetze: readonly Einsatzzeile[]
  readonly kunde: string
  readonly tarifzuordnungen: readonly Tarifzeile[]
  readonly stichtag: Date | null
  readonly zeitraum: { readonly von: Date; readonly bis: Date | null } | null
  readonly identitaetBestaetigt?: boolean
}): Hoechstdauerstand {
  const grenze = grenzeAusZuordnungen(eingabe.tarifzuordnungen, eingabe.stichtag)
  const zeitraum =
    eingabe.zeitraum === null
      ? null
      : { von: alsTag(eingabe.zeitraum.von), bis: alsTag(eingabe.zeitraum.bis ?? eingabe.zeitraum.von) }

  const ergebnis = pruefeHoechstdauer({
    person: '(Personenidentität)',
    kunde: eingabe.kunde,
    einsaetze: eingabe.einsaetze.map((zeile) => alsEinsatzsatz(zeile, eingabe.kunde)),
    stichtag: eingabe.stichtag === null ? null : alsTag(eingabe.stichtag),
    zeitraum,
    zeitpositionen: null,
    grenzeMonate: grenze.monate,
    grenzeHerkunft: grenze.herkunft,
    grenzeGesenkt: grenze.gesenkt,
    gesetztesFristende: null,
    gesetzteDauer: null,
    gesetzteDauerStand: null,
    gesetztesRestbudget: null,
    zaehlgrundlage: eingabe.identitaetBestaetigt === false ? 'einLieferant' : 'bestaetigt',
    luecke: null,
    wiederaufnahmetag: null,
    fehlendeFelder: [],
  })

  return {
    maxDurationExceeded: ergebnis.ueberschritten,
    maxDurationEndDate: alsDatum(ergebnis.fristende),
    countedDurationDays: ergebnis.angerechneteDauer,
    chainStartDate: alsDatum(ergebnis.kettenbeginn),
    chainAssignmentIds: einsaetzeDerKette(eingabe.einsaetze, ergebnis.kettenbeginn, ergebnis.kettenende),
    maxAssignmentDurationMonths: grenze.monate,
    grenzeHerkunft: grenze.herkunft,
    mitRegelgrenze: grenze.herkunft === 'regelgrenze',
    meldung: ergebnis.meldung,
  }
}

/** Der Fristenstand für eine Verlängerung: `newEndDate` gegen das Fristende (Q28, Q30). */
export function haeltVerlaengerungDieFrist(eingabe: {
  readonly einsaetze: readonly Einsatzzeile[]
  readonly kunde: string
  readonly tarifzuordnungen: readonly Tarifzeile[]
  readonly bisherigesEnde: Date | null
  readonly neuesEnde: Date
}): Hoechstdauerstand {
  // 5.0, Zeile „Verlängerung": Prüfzeitraum ist das bisherige `plannedEndDate`
  // + 1 Tag bis `newEndDate`.
  const von =
    eingabe.bisherigesEnde === null
      ? eingabe.neuesEnde
      : alsDatum(folgetag(alsTag(eingabe.bisherigesEnde))) ?? eingabe.neuesEnde
  return hoechstdauerstand({
    einsaetze: eingabe.einsaetze,
    kunde: eingabe.kunde,
    tarifzuordnungen: eingabe.tarifzuordnungen,
    stichtag: null,
    zeitraum: { von, bis: eingabe.neuesEnde },
  })
}

/**
 * Eine Tarifzuordnung der **Verleiherseite**, wie 5.2.2 sie liest (SPEC 3.3).
 * Sie ist ein anderes Objekt als `Tarifzeile`: 5.1.2 liest die Einsatzbranche,
 * 5.2.2 den Zeitarbeitstarifvertrag. Beide stehen in derselben Tabelle und
 * dürfen trotzdem nicht verwechselt werden.
 */
export interface Verleiherzeile {
  readonly appliesToType: string
  readonly validFrom: Date
  readonly validTo: Date | null
  readonly equalPayDeadlineMonths: number | null
  readonly industryPremiumScheme: string | null
}

/** Der Fristenstand des Equal Pay (SPEC 5.2, abgeleitetes Feld 3.7). */
export interface EqualPaystand {
  /** `equalPayDueDate` — der erste Tag mit Equal-Pay-Pflicht (5.2.3). */
  readonly equalPayDueDate: Date | null
  readonly equalPayDeadlineMonths: number
  readonly fristfall: Fristfall
  readonly chainStartDate: Date | null
  /** Wie bei 5.1.3: der Stand wird an **jedem** Einsatz der Kette geführt. */
  readonly chainAssignmentIds: readonly string[]
  /**
   * Die Tatsache, die 4.2.3 und 4.3 als Vorbedingung nennen: Equal Pay ist am
   * oder vor dem ersten Überlassungstag geschuldet. Zusammen mit
   * `comparableWagePresent` ist das die Sperre aus Q48 (5.5.5).
   */
  readonly equalPayDueFromFirstDay: boolean
  /** Die Fristkonfiguration ist zu beanstanden (5.2.2, Fälle 1, 5 und 6). */
  readonly konfigurationsmangel: boolean
  readonly meldung: string
}

/**
 * Rechnet `equalPayDueDate` nach SPEC 5.2.3 für einen Vorgang, dessen
 * Überlassungskette geladen ist — auf **derselben** Kette wie 5.1 (5.2.1).
 *
 * `verleiherzuordnungen` sind die Zuordnungen des **Lieferanten** (3.3). Ist am
 * Stichtag keine gültig, gilt Fall 1 aus 5.2.2: Equal Pay ab dem ersten
 * Überlassungstag, **nicht** die Regelfrist — die Abweichung setzt den
 * Tarifvertrag voraus. Wer hier eine leere Liste übergibt, weil er die
 * Zuordnungen nicht geladen hat, bekommt deshalb die strengste Folge und keine
 * stille Lücke.
 */
export function equalPaystand(eingabe: {
  readonly einsaetze: readonly Einsatzzeile[]
  readonly kunde: string
  readonly verleiherzuordnungen: readonly Verleiherzeile[]
  readonly stichtag: Date | null
  readonly zeitraum: { readonly von: Date; readonly bis: Date | null } | null
  readonly ersterUeberlassungstag: Date | null
  readonly vergleichsentgeltGesetzt: boolean
  readonly identitaetBestaetigt?: boolean
}): EqualPaystand {
  const zuordnung = verleiherzuordnungAmStichtag(eingabe.verleiherzuordnungen, eingabe.stichtag)
  const zeitraum =
    eingabe.zeitraum === null
      ? null
      : {
          von: alsTag(eingabe.zeitraum.von),
          bis: alsTag(eingabe.zeitraum.bis ?? eingabe.zeitraum.von),
        }

  const ergebnis = pruefeEqualPayFrist({
    kette: {
      person: '(Personenidentität)',
      kunde: eingabe.kunde,
      einsaetze: eingabe.einsaetze.map((zeile) => alsEinsatzsatz(zeile, eingabe.kunde)),
      stichtag: eingabe.stichtag === null ? null : alsTag(eingabe.stichtag),
      zeitraum,
      zeitpositionen: null,
      // Die Grenze aus 5.1 spielt für die Equal-Pay-Frist keine Rolle; sie steht
      // hier nur, weil die Kettenlage sie trägt.
      grenzeMonate: REGELWERK.dauer.regelgrenzeMonate,
      grenzeHerkunft: 'regelgrenze',
      grenzeGesenkt: false,
      gesetztesFristende: null,
      gesetzteDauer: null,
      gesetzteDauerStand: null,
      gesetztesRestbudget: null,
      zaehlgrundlage: eingabe.identitaetBestaetigt === false ? 'einLieferant' : 'bestaetigt',
      luecke: null,
      wiederaufnahmetag: null,
      fehlendeFelder: [],
    },
    verleihertarifVorhanden: zuordnung !== null,
    fristMonateAngegeben: zuordnung?.equalPayDeadlineMonths ?? null,
    zuschlagsschema: zuordnung?.industryPremiumScheme ?? null,
    vergleichsentgeltGesetzt: eingabe.vergleichsentgeltGesetzt,
    gesetzteFaelligkeit: null,
  })

  const ersterTag =
    eingabe.ersterUeberlassungstag === null ? null : alsTag(eingabe.ersterUeberlassungstag)
  const amOderVorErstemTag =
    ergebnis.faelligkeit !== null &&
    ersterTag !== null &&
    istVorOderGleich(ergebnis.faelligkeit, ersterTag)

  return {
    equalPayDueDate: alsDatum(ergebnis.faelligkeit),
    equalPayDeadlineMonths: ergebnis.fristMonate,
    fristfall: ergebnis.fristfall,
    chainStartDate: alsDatum(ergebnis.kettenbeginn),
    chainAssignmentIds: einsaetzeDerKette(
      eingabe.einsaetze,
      ergebnis.kettenbeginn,
      null,
    ),
    equalPayDueFromFirstDay: amOderVorErstemTag,
    konfigurationsmangel: ergebnis.konfigurationsmangel,
    meldung: ergebnis.meldung,
  }
}

/**
 * 5.2.2: maßgeblich ist die am **Stichtag** gültige Zuordnung der
 * Verleiherseite. Ohne Stichtag zählt jede vorhandene — sonst wäre eine
 * Vorschau ohne Stichtag automatisch Fall 1 und damit strenger als die
 * Rechtslage.
 */
function verleiherzuordnungAmStichtag(
  zuordnungen: readonly Verleiherzeile[],
  stichtag: Date | null,
): Verleiherzeile | null {
  const einschlaegig = zuordnungen.filter((zuordnung) => {
    if (zuordnung.appliesToType !== 'supplier') return false
    if (stichtag === null) return true
    const tag = alsTag(stichtag)
    if (!istVorOderGleich(alsTag(zuordnung.validFrom), tag)) return false
    if (zuordnung.validTo !== null && !istVorOderGleich(tag, alsTag(zuordnung.validTo))) {
      return false
    }
    return true
  })
  // Mehrere gültige Zuordnungen: die **spätere** gilt, wie in 5.1.2 für
  // dieselbe Ebene.
  return (
    [...einschlaegig].sort((a, b) => b.validFrom.getTime() - a.validFrom.getTime())[0] ?? null
  )
}

/* ------------------------------------------------------------------ */
/* P4 und P5 — Vergleichsentgelt und Branchenzuschlag (SPEC 5.2)       */
/* ------------------------------------------------------------------ */

/** Ein Vergleichsentgelt-Eintrag, wie 3.3 ihn führt. */
export interface Vergleichsentgeltzeile {
  readonly activityKey: string
  readonly comparableWage: number
  readonly wageSource: string
  readonly validFrom: Date
  readonly validTo: Date | null
  readonly deactivatedAt: Date | null
}

/** Das Ergebnis von P4 für die Tatsachen aus 4.4 und 4.5 (SPEC 5.2.4). */
export interface Entgeltstand {
  /**
   * `comparableWageUsable` — die Tatsache, die 4.4 als Vorbedingung führt und
   * die die **Sperre aus Q36** trägt.
   *
   * Sie ist genau die Bedingung, die 4.7 schreibt: „Fälligkeit erreicht,
   * **kein verwendbarer** Vergleichsentgelt-Eintrag" (5.5.5, Tabelle
   * „Bestätigt mit Präzisierung"). Zwei Teile, beide notwendig — vor der
   * Fälligkeit ist Equal Pay nicht geschuldet (5.2.2), und eine **Schätzung**
   * ist verwendbar (3.3).
   */
  readonly comparableWageUsable: boolean
  /** Die Fälligkeit ist am Stichtag oder im Prüfzeitraum erreicht (5.2.6). */
  readonly faelligkeitErreicht: boolean
  /** Ein Eintrag liegt vor und ist eindeutig (5.2.4, Schritt 2). */
  readonly verwendbar: boolean
  /** Der Eintrag ist ein **Nachweis** — keine Schätzung (3.3). */
  readonly nachweis: boolean
  readonly schaetzung: boolean
  /** Ein Treffer im Sinne von 5.2.4 — unabhängig von der Ergebnisart. */
  readonly treffer: boolean
  /** Der Treffer ist auf eine Warnung begrenzt (Schätzung, 5.2.4). */
  readonly nurWarnung: boolean
  readonly mangel: string | null
  readonly meldung: string
}

/**
 * P4 für einen Vorgang (SPEC 5.2.4).
 *
 * **Eine** Lesart für beide Stellen, an denen P4 hängt: die Genehmigung des
 * Stundenzettels (Q36, **Sperre**) und die Belegerstellung (Q39, Warnung).
 * Zwei Lesarten derselben Prüfung in einem Programm wären eine zu viel — und
 * genau sie waren der Fehler, den die Abrechnung aufgedeckt hat: der
 * Zettelgenehmigung genügte bisher der Wert **am Einsatz**, während 4.7 und
 * 5.2.4 vom **Eintrag des Standorts** sprechen.
 *
 * **Der Prüfzeitraum ist nicht der Tag des Aufrufs** (5.0): am Zettel sein
 * Zeitraum, am Beleg „frühester `periodFrom` bis spätester `periodTo` der
 * zugrunde liegenden Zettel".
 */
export function entgeltstand(eingabe: {
  readonly standort: string
  /** `assignment.activityDescription` (3.7) — wählt den Eintrag (Schritt 1). */
  readonly taetigkeit: string | null
  readonly eintraege: readonly Vergleichsentgeltzeile[]
  /** `assignment.comparableWage` (3.7). */
  readonly einsatzwert: number | null
  readonly abweichungBegruendet: boolean
  /** `assignment.equalPayDueDate` (3.7, Ergebnis aus 5.2.3). */
  readonly faelligkeit: Date | null
  readonly stichtag: Date | null
  readonly zeitraum: { readonly von: Date; readonly bis: Date | null } | null
}): Entgeltstand {
  const zeitraum = alsPruefzeitraum(eingabe.stichtag, eingabe.zeitraum)
  // Der letzte Tag des Prüfzeitraums entscheidet über die Gültigkeit des
  // Eintrags: ein Eintrag, der im Zeitraum beginnt, gilt für ihn (5.5.3).
  const bezugstag =
    zeitraum === null ? null : new Date(`${zeitraum.bis}T00:00:00.000Z`)
  const gueltige =
    eingabe.taetigkeit === null
      ? []
      : eingabe.eintraege.filter(
          (eintrag) =>
            eintrag.deactivatedAt === null &&
            eintrag.activityKey === eingabe.taetigkeit &&
            (bezugstag === null || eintrag.validFrom <= bezugstag) &&
            (eintrag.validTo === null || bezugstag === null || eintrag.validTo >= bezugstag),
        )
  // Mehrere gültige Einträge sind nach 5.2.4 **kein** Eintrag; ausgewählt wird
  // keiner. Der Betrag des einzigen dient dem Vergleich mit dem Einsatzwert.
  const einziger = gueltige.length === 1 ? gueltige[0] : undefined

  const ergebnis = pruefeVergleichsentgelt({
    standort: eingabe.standort,
    taetigkeit: eingabe.taetigkeit,
    taetigkeitFehlt: eingabe.taetigkeit === null || eingabe.taetigkeit.trim() === '',
    anzahlEintraege: gueltige.length,
    eintragsbetrag: einziger?.comparableWage ?? null,
    quelle: alsEntgeltquelle(einziger?.wageSource ?? null),
    einsatzwert: eingabe.einsatzwert,
    einsatzwertGesetzt: eingabe.einsatzwert !== null,
    abweichungBegruendet: eingabe.abweichungBegruendet,
    stichtag: eingabe.stichtag === null ? null : alsTag(eingabe.stichtag),
    zeitraum,
    faelligkeit: eingabe.faelligkeit === null ? null : alsTag(eingabe.faelligkeit),
  })

  return {
    // Die Bedingung aus Q36, Wort für Wort: erreicht **und** nicht verwendbar.
    comparableWageUsable: !ergebnis.faelligkeitErreicht || ergebnis.verwendbar,
    faelligkeitErreicht: ergebnis.faelligkeitErreicht,
    verwendbar: ergebnis.verwendbar,
    nachweis: ergebnis.nachweis,
    schaetzung: ergebnis.schaetzung,
    treffer: ergebnis.treffer,
    nurWarnung: ergebnis.nurWarnung,
    mangel: ergebnis.mangel,
    meldung: ergebnis.meldung,
  }
}

function alsEntgeltquelle(wert: string | null): Entgeltquelle | null {
  if (wert === null) return null
  return wert === 'collectiveAgreement' ||
    wert === 'companyAgreement' ||
    wert === 'individualContract' ||
    wert === 'estimate'
    ? wert
    : null
}

/** Das Ergebnis von P5 für die Zeilen Q19 und Q40 (SPEC 5.2.5). */
export interface Zuschlagsstand {
  readonly schema: string | null
  readonly anwendbar: boolean
  readonly brancheBestimmbar: boolean
  /** Die ermittelte Stufe — **nicht** der Betrag (5.2.5, Schritt 3). */
  readonly stufe: string | null
  readonly positionenAbweichend: boolean
  readonly treffer: boolean
  readonly mangel: string | null
  readonly meldung: string
}

/**
 * P5 für einen Vorgang (SPEC 5.2.5) — am Beleg die Zeile **Q40**.
 *
 * Geprüft wird die **Zuordnung**, nicht die Höhe: „das Schema wirkt auf
 * Zuschlagsstufen, nicht auf die Zulässigkeit der Überlassung" (5.5.5). Die
 * Stufenfolge erreicht die Regel als Konfiguration am Schema (3.3); ist keine
 * hinterlegt, bleibt die Stufe offen — und zwar sichtbar. Eine erfundene
 * Stufenfolge wäre ein Tarifwert im Code (CLAUDE.md).
 *
 * `positionenAbweichend` ist die Frage, die **nur am Beleg** gestellt werden
 * kann: passen die abgerechneten Zuschlagsarten zur ermittelten Stufe
 * (5.2.5, Schritt 4)? Ohne bestimmbare Stufe lässt sie sich nicht beantworten;
 * der Aufrufer gibt dann `false` und die Meldung sagt, warum.
 */
export function zuschlagsstand(eingabe: {
  readonly verleiherzuordnungen: readonly Verleiherzeile[]
  readonly stichtag: Date | null
  readonly brancheBestimmbar: boolean | null
  readonly ueberlassungstage: number | null
  readonly positionenAbweichend: boolean
  readonly stufenfolge?: readonly { readonly abTagen: number; readonly bezeichnung: string }[]
}): Zuschlagsstand {
  const zuordnung = verleiherzuordnungAmStichtag(eingabe.verleiherzuordnungen, eingabe.stichtag)
  const ergebnis = pruefeBranchenzuschlag({
    schema: zuordnung?.industryPremiumScheme ?? null,
    schemaAusdruecklichOhne: zuordnung !== null && zuordnung.industryPremiumScheme === null,
    brancheBestimmbar: eingabe.brancheBestimmbar,
    ueberlassungstage: eingabe.ueberlassungstage,
    positionenAbweichend: eingabe.positionenAbweichend,
    ...(eingabe.stufenfolge !== undefined ? { stufenfolge: eingabe.stufenfolge } : {}),
  })
  return {
    schema: ergebnis.schema,
    anwendbar: ergebnis.anwendbar,
    brancheBestimmbar: ergebnis.brancheBestimmbar,
    stufe: ergebnis.stufe,
    positionenAbweichend: ergebnis.positionenAbweichend,
    treffer: ergebnis.treffer,
    mangel: ergebnis.mangel,
    meldung: ergebnis.meldung,
  }
}

/** Das Ergebnis der Drehtürklausel für die Tatsachen aus 4.2.3 und 4.3 (SPEC 5.3.1). */
export interface Drehtuerstand {
  /** `equalPayDueFromFirstDay`: Rechtsfolge eines Treffers (5.3.1, Schritt 5). */
  readonly equalPayDueFromFirstDay: boolean
  /** `hasPreviousEmploymentDeclaration`: die Tatsachengrundlage (4.2.3, 4.3.1). */
  readonly hasPreviousEmploymentDeclaration: boolean
  readonly rueckschauVon: Date | null
  readonly rueckschauBis: Date | null
  readonly meldung: string
}

/**
 * P6 für einen Vorgang (SPEC 5.3.1). `konzernunternehmen` sind die Namen der
 * Kunden, die denselben `corporateGroup`-Wert tragen wie der Entleiher — das
 * System führt keine Stammbelegschaft und keinen Unternehmensregister-Abgleich
 * (5.3.1, „Keine Gegenprüfung beim Entleiher").
 */
export function drehtuerstand(eingabe: {
  readonly kandidat: {
    readonly previousEmploymentDeclaredAt: Date | null
    readonly previousEmploymentExisted: boolean | null
    readonly previousEmploymentEndedOn: Date | null
    readonly previousEmploymentEmployer: string | null
  }
  readonly entleiher: { readonly name: string; readonly corporateGroup: string | null }
  readonly konzernunternehmen: readonly string[]
  readonly ersterUeberlassungstag: Date | null
}): Drehtuerstand {
  const erklaert = eingabe.kandidat.previousEmploymentDeclaredAt
  const bestand = eingabe.kandidat.previousEmploymentExisted
  const liegtVor = erklaert !== null && bestand !== null

  const ergebnis = pruefeDrehtuer({
    person: '(Kandidat)',
    entleiher: eingabe.entleiher.name,
    konzern: eingabe.entleiher.corporateGroup,
    konzernunternehmen: eingabe.konzernunternehmen,
    ueberlassungsbeginn:
      eingabe.ersterUeberlassungstag === null ? null : alsTag(eingabe.ersterUeberlassungstag),
    erklaerung: liegtVor
      ? {
          bestand,
          ende: eingabe.kandidat.previousEmploymentEndedOn === null
            ? null
            : alsTag(eingabe.kandidat.previousEmploymentEndedOn),
          arbeitgeber: eingabe.kandidat.previousEmploymentEmployer,
          erklaert: erklaert === null ? null : alsTag(erklaert),
          lieferant: null,
        }
      : null,
    lieferant: null,
  })

  return {
    equalPayDueFromFirstDay: ergebnis.equalPayAbErstemTag,
    hasPreviousEmploymentDeclaration: liegtVor,
    rueckschauVon: alsDatum(ergebnis.fensterVon),
    rueckschauBis: alsDatum(ergebnis.fensterBis),
    meldung: ergebnis.meldung,
  }
}

/**
 * P11 für einen Vorgang (SPEC 5.3.4): besteht das Arbeitsverhältnis beim
 * Verleiher am ersten Überlassungstag? Das ist die Tatsache
 * `employmentRelationshipOnFirstDay` aus 4.3.
 */
export function bestehtArbeitsverhaeltnisAmErstenTag(eingabe: {
  readonly kandidat: {
    readonly employmentStatusWithSupplier: string
    readonly employedSince: Date | null
  }
  readonly ersterUeberlassungstag: Date
  readonly amEinsatzstart: boolean
}): { readonly employmentRelationshipOnFirstDay: boolean; readonly meldung: string } {
  const status = eingabe.kandidat.employmentStatusWithSupplier
  const ergebnis = pruefeArbeitsverhaeltnis({
    person: '(Kandidat)',
    lieferant: null,
    status:
      status === 'employed' || status === 'applicant' || status === 'inactive' ? status : null,
    beschaeftigtSeit:
      eingabe.kandidat.employedSince === null ? null : alsTag(eingabe.kandidat.employedSince),
    ersterUeberlassungstag: alsTag(eingabe.ersterUeberlassungstag),
    amEinsatzstart: eingabe.amEinsatzstart,
  })
  return {
    employmentRelationshipOnFirstDay: ergebnis.bestehtAmErstenTag,
    meldung: ergebnis.meldung,
  }
}

/** Der Rahmenvertrag der Lieferantenseite, wie K1 ihn braucht (SPEC 3.3). */
export interface Rahmenvertragszeile {
  readonly agreementNumber: string
  readonly agreementType: string
  readonly status: string
  readonly supplierId: string | null
  readonly validFrom: Date
  readonly validTo: Date | null
}

/** Das Ergebnis der Konkretisierungsprüfung für die Tatsachen aus 4.3 (5.3.3). */
export interface Konkretisierungsstand {
  /** `concretizationComplete`: die Tatsache, die 4.3.1 als Vorbedingung führt. */
  readonly concretizationComplete: boolean
  /** Die Kriterien, die nicht tragen — für die Meldung am Vorgang. */
  readonly offeneKriterien: readonly string[]
  /** Kriterien, die aus Datenmangel nicht prüfbar sind (5.0). */
  readonly nichtPruefbareKriterien: readonly string[]
  /** Laufzeitende des Rahmenvertrags, wenn es vor dem Einsatzende liegt. */
  readonly rahmenvertragEndetAm: Date | null
  readonly meldung: string
}

/**
 * P8 für einen Einsatz (SPEC 5.3.3).
 *
 * **Der Tag der Anlage ist `createdAt`.** 4.3.1 führt genau einen Weg nach
 * `planned` — „— → `planned`" —, der Einsatz **entsteht** also in diesem
 * Zustand. Der Übergang nach `planned`, den K5 datiert, ist damit die Anlage
 * der Zeile. Das ist keine Annäherung: 3.12 würde denselben Tag protokollieren,
 * nur führt das Datenmodell den Audit-Eintrag noch nicht als Tabelle.
 *
 * **Hier wird nichts vorbelegt.** Anders als der Gherkin-Leser, der eine
 * erzählte Lage liest, bekommt diese Funktion echte Daten: ein fehlendes Feld
 * ist ein Treffer (5.0).
 */
export function konkretisierungsstand(eingabe: {
  readonly einsatz: {
    readonly candidateId: string | null
    readonly activityDescription: string
    readonly siteId: string | null
    readonly supplierId: string
    readonly agreedRateCardItemId: string | null
    readonly plannedStartDate: Date | null
    readonly plannedEndDate: Date | null
    readonly actualStartDate: Date | null
    readonly createdAt: Date | null
  }
  /** Über `agreedRateCardItemRef` → `rateCard.masterAgreementRef` (3.3). */
  readonly rahmenvertrag: Rahmenvertragszeile | null
  /** `demandRequest.title`; `null`, wenn der Einsatz ohne Anfrage entstand. */
  readonly titelDerAnfrage: string | null
  /** `start`, sobald die Überlassung begonnen hat — dann gilt auch K5. */
  readonly stufe: Pruefstufe
}): Konkretisierungsstand {
  const einsatz = eingabe.einsatz
  const titel = eingabe.titelDerAnfrage
  const beschreibung = einsatz.activityDescription.trim()

  const ergebnis = pruefeKonkretisierung(
    {
      preisposition: einsatz.agreedRateCardItemId,
      rahmenvertrag:
        eingabe.rahmenvertrag === null
          ? null
          : {
              bezeichnung: eingabe.rahmenvertrag.agreementNumber,
              art: eingabe.rahmenvertrag.agreementType,
              status: eingabe.rahmenvertrag.status,
              gegenpartei: eingabe.rahmenvertrag.supplierId,
              laufzeitVon: alsTag(eingabe.rahmenvertrag.validFrom),
              laufzeitBis:
                eingabe.rahmenvertrag.validTo === null
                  ? null
                  : alsTag(eingabe.rahmenvertrag.validTo),
            },
      lieferant: einsatz.supplierId,
      kandidat: einsatz.candidateId,
      taetigkeit: einsatz.activityDescription,
      titelDerAnfrage: titel,
      taetigkeitWieTitel: titel !== null && beschreibung === titel.trim(),
      mitAnfrage: titel !== null,
      qualifikationsanforderung: null,
      standort: einsatz.siteId,
      beginnGesetzt: einsatz.plannedStartDate !== null,
      geplanterBeginn:
        einsatz.plannedStartDate === null ? null : alsTag(einsatz.plannedStartDate),
      geplantesEnde: einsatz.plannedEndDate === null ? null : alsTag(einsatz.plannedEndDate),
      anlagetag: einsatz.createdAt === null ? null : alsTag(einsatz.createdAt),
      ersterUeberlassungstag:
        einsatz.actualStartDate === null
          ? einsatz.plannedStartDate === null
            ? null
            : alsTag(einsatz.plannedStartDate)
          : alsTag(einsatz.actualStartDate),
    },
    eingabe.stufe,
  )

  return {
    // Die **Vorbedingung** des Übergangs ist erfüllt, solange kein Kriterium
    // offen ist. Die Laufzeitwarnung aus dem Grenzfall ist ein Befund, keine
    // Sperre (5.3.3) — sie darf den Übergang nicht verhindern.
    concretizationComplete: ergebnis.offen.length === 0,
    offeneKriterien: ergebnis.offen,
    nichtPruefbareKriterien: ergebnis.nichtPruefbar,
    rahmenvertragEndetAm: alsDatum(ergebnis.laufzeitendeImEinsatz),
    meldung: ergebnis.meldung,
  }
}

/* ------------------------------------------------------------------ */
/* P9 und P10 — Erlaubnis und Pflichtnachweise (SPEC 5.4)              */
/* ------------------------------------------------------------------ */

/** Ein Erlaubnissatz, wie 3.2 ihn führt. */
export interface Erlaubniszeile {
  readonly id: string
  readonly permitNumber: string
  readonly permitType: string
  readonly validFrom: Date
  readonly validTo: Date | null
  readonly verificationStatus: string
  /** `certificateDocumentRef` (3.2) — der Verweis auf die Urkunde (3.10). */
  readonly certificateDocumentRef: string | null
  readonly supersedesId: string | null
}

/** Ein Dokument, wie 3.10 es führt. */
export interface Nachweiszeile {
  readonly id: string
  readonly documentCategory: string
  readonly validFrom: Date | null
  readonly validTo: Date | null
  readonly verificationStatus: string
  readonly fileRef: string
  /** Das Bezugsobjekt (`subjectRef`, 3.10) — der Verweis, der gesetzt ist. */
  readonly subjectRef: string | null
}

/** Das Ergebnis von P9 für die Tatsachen aus 4.1, 4.2 und 4.3. */
export interface Erlaubnisstand {
  /** `hasAcceptedValidPermit` — die Tatsache, die die Statusmodelle führen. */
  readonly hasAcceptedValidPermit: boolean
  readonly ersterUngedeckterTag: Date | null
  readonly tageUngedeckt: number
  readonly mangel: string | null
  readonly meldung: string
}

/**
 * P9 für einen Vorgang (SPEC 5.4.1).
 *
 * **Der Prüfzeitraum ist nicht der Tag des Aufrufs.** 5.0 ordnet jedem
 * Übergang seinen Stichtag oder Zeitraum zu: beim Anlegen des Einsatzes der
 * **geplante** Zeitraum (Q16), am Einsatzstart der `actualStartDate` (Q20),
 * bei der Verlängerung der **verlängerte** Zeitraum (Q31). Wer stattdessen
 * „heute" prüft, lässt einen Einsatz zu, dessen Erlaubnis im Verlauf abläuft.
 *
 * **Die Urkunde ist Pflicht, und zwar die Datei.** 3.2 verlangt den Verweis,
 * 3.10 die hinterlegte Datei; 5.4.5 nennt beides als Datenfehler, wenn es
 * fehlt. Deshalb nimmt diese Funktion die Dokumente mit und löst den Verweis
 * wirklich auf, statt sein Vorhandensein für den Nachweis zu halten.
 */
export function erlaubnisstand(eingabe: {
  readonly lieferant: string
  readonly erlaubnisse: readonly Erlaubniszeile[]
  /** Die Dokumente des Lieferanten — gebraucht wird die Urkunde (3.10). */
  readonly urkunden: readonly Nachweiszeile[]
  readonly stichtag: Date | null
  readonly zeitraum: { readonly von: Date; readonly bis: Date | null } | null
  readonly unterbrechungen: readonly {
    readonly interruptionFrom: Date
    readonly interruptionTo: Date | null
  }[]
}): Erlaubnisstand {
  const dateien = new Map(
    eingabe.urkunden.map((zeile) => [zeile.id, zeile.fileRef.trim() !== '']),
  )

  const saetze: Erlaubnissatz[] = eingabe.erlaubnisse.map((zeile) => ({
    id: zeile.permitNumber,
    art: zeile.permitType === 'unlimited' ? 'unlimited' : 'fixedTerm',
    gueltigVon: alsTag(zeile.validFrom),
    gueltigBis: zeile.validTo === null ? null : alsTag(zeile.validTo),
    anerkennung: alsAnerkennung(zeile.verificationStatus),
    urkunde: zeile.certificateDocumentRef !== null,
    // Der Verweis allein ist kein Nachweis: zeigt er auf nichts oder auf ein
    // Dokument ohne Ablage, fehlt die Datei (5.4.5).
    datei:
      zeile.certificateDocumentRef !== null &&
      dateien.get(zeile.certificateDocumentRef) === true,
    vorgaenger: zeile.supersedesId,
  }))

  const zeitraum = alsPruefzeitraum(eingabe.stichtag, eingabe.zeitraum)
  const ergebnis = pruefeErlaubnis({
    lieferant: eingabe.lieferant,
    saetze,
    zeitraum,
    unterbrechungen: eingabe.unterbrechungen
      .map((pause) => ({
        von: alsTag(pause.interruptionFrom),
        bis: pause.interruptionTo === null ? null : alsTag(pause.interruptionTo),
      }))
      // Eine laufende Unterbrechung ohne Ende begrenzt den Prüfzeitraum nicht:
      // sie sagt nichts darüber, ab wann wieder überlassen wird (5.4.5).
      .filter((pause): pause is Zeitraum => pause.bis !== null),
  })

  return {
    hasAcceptedValidPermit: ergebnis.gedeckt,
    ersterUngedeckterTag: alsDatum(ergebnis.ersterUngedeckterTag),
    tageUngedeckt: ergebnis.ungedeckteTage.length,
    mangel: ergebnis.mangel,
    meldung: ergebnis.meldung,
  }
}

/** Das Ergebnis von P10 für die Tatsachen aus 4.2.3 und 4.3. */
export interface Nachweisstand {
  /** `mandatoryDocumentsPresent` — die Tatsache, die 4.3.1 führt. */
  readonly mandatoryDocumentsPresent: boolean
  /** Das strengste Einzelergebnis (5.4.4); eine Warnung sperrt nicht. */
  readonly ergebnisart: Ergebnisart
  readonly fehlendeArten: readonly string[]
  readonly meldung: string
}

/**
 * P10 für einen Vorgang (SPEC 5.4.4).
 *
 * **Der Pflichtkatalog entscheidet, nicht das Dokument.** 3.10 führt
 * `mandatory` und `blocking` als *abgeleitete* Felder — welche Art an welchem
 * Übergang Pflicht ist und ob sie sperrt, steht im Katalog in 5.4.4. Deshalb
 * bekommt diese Funktion die Zeile aus 4.7 (`qZeile`) und nicht ein Flag am
 * Dokument.
 *
 * **Ein Nachweis deckt nur sein eigenes Bezugsobjekt.** 5.4.5: „der Nachweis
 * gehört dem Verleiher, der ihn eingestellt hat". Die Zeilen tragen deshalb
 * ihren `subjectRef` mit, und `bezugsobjekt` sagt, gegen welches geprüft wird.
 */
export function nachweisstand(eingabe: {
  readonly nachweise: readonly Nachweiszeile[]
  /** Die Zeile aus 4.7: `Q10`, `Q21`, `Q37`, `Q42` oder `N5` (5.5.1). */
  readonly qZeile: string
  readonly bezugsobjekt: string | null
  readonly stichtag: Date | null
  readonly zeitraum: { readonly von: Date; readonly bis: Date | null } | null
  /** `candidate.workPermitRequired` (3.6); `null` = nicht gesetzt (5.4.6). */
  readonly arbeitserlaubnisErforderlich: boolean | null
  /** `site.safetyBriefingRequired` (3.1); `null` = nicht gesetzt (5.4.6). */
  readonly unterweisungVerlangt: boolean | null
  /**
   * Nur diese Nachweisarten prüfen — für den Anlass **Speicherung** (5.5.1 b),
   * wo ein einzelnes Dokument geändert wurde und nur dessen abgeleitete Felder
   * neu zu rechnen sind. An einem Übergang bleibt die Angabe leer: dort prüft
   * P10 alle Arten des Prüfzeitpunkts (5.4.4).
   */
  readonly nurArten?: readonly Nachweisart[]
}): Nachweisstand {
  const ergebnis = pruefeNachweise(
    {
      zeitraum: alsPruefzeitraum(eingabe.stichtag, eingabe.zeitraum),
      nachweise: eingabe.nachweise.flatMap((zeile) => {
        const art = alsNachweisart(zeile.documentCategory)
        return art === null
          ? []
          : [
              {
                art,
                anerkennung: alsAnerkennung(zeile.verificationStatus),
                gueltigVon: zeile.validFrom === null ? null : alsTag(zeile.validFrom),
                gueltigBis: zeile.validTo === null ? null : alsTag(zeile.validTo),
                datei: zeile.fileRef.trim() !== '',
                gehoertZu: zeile.subjectRef,
              },
            ]
      }),
      arbeitserlaubnisErforderlich: eingabe.arbeitserlaubnisErforderlich,
      unterweisungVerlangt: eingabe.unterweisungVerlangt,
      // Aus echten Daten lässt sich „ausdrücklich nicht erfasst" nicht lesen:
      // eine Art, die nie Pflicht ist und nicht vorliegt, ist in der Datenbank
      // schlicht abwesend. Diese Lesart gehört zum Gherkin-Vorgang, der sie
      // aussprechen kann (5.4.4, Spalte „Pflicht, wenn" = „nie").
      ausdruecklichAbwesend: [],
      bezugsobjekt: eingabe.bezugsobjekt,
    },
    eingabe.qZeile,
    undefined,
    eingabe.nurArten,
  )

  return {
    // Die **Vorbedingung** des Übergangs scheitert nur an einer Sperre. Eine
    // Warnung aus dem Katalog (etwa ein fehlender Qualifikationsnachweis) ist
    // ein Befund, der den Übergang zulässt (5.4.4, 5.5.2).
    mandatoryDocumentsPresent: ergebnis.ergebnisart !== 'sperre',
    ergebnisart: ergebnis.ergebnisart,
    fehlendeArten: ergebnis.maengel.map((befund) => befund.art),
    meldung: ergebnis.meldung,
  }
}

/**
 * Ein Dokument aus 3.10 als Zeile für das Regelwerk.
 *
 * `subjectRef` ist der **eine** gesetzte Verweis: 3.10 lässt genau einen zu,
 * und `lib/masterdata/invariants.ts` prüft das. Welcher es ist, sagt
 * `subjectType`; für die Regel zählt nur, **wem** der Nachweis gehört — ein
 * Nachweis eines anderen Kandidatensatzes deckt nicht mit (5.4.5).
 */
export function alsNachweiszeile(dokument: {
  readonly id: string
  readonly documentCategory: string
  readonly validFrom: Date | null
  readonly validTo: Date | null
  readonly verificationStatus: string
  readonly fileRef: string
  readonly supplierId: string | null
  readonly customerId: string | null
  readonly candidateId: string | null
  readonly assignmentId: string | null
  readonly siteId: string | null
  readonly masterAgreementId: string | null
}): Nachweiszeile {
  return {
    id: dokument.id,
    documentCategory: dokument.documentCategory,
    validFrom: dokument.validFrom,
    validTo: dokument.validTo,
    verificationStatus: dokument.verificationStatus,
    fileRef: dokument.fileRef,
    subjectRef:
      dokument.supplierId ??
      dokument.customerId ??
      dokument.candidateId ??
      dokument.assignmentId ??
      dokument.siteId ??
      dokument.masterAgreementId,
  }
}

/**
 * Stichtag oder Zeitraum als Prüfzeitraum (5.0). Ein Zeitraum ohne Ende wird
 * **nicht** geraten: er bleibt bei seinem Beginn, und mehr behauptet die
 * Rechnung dann auch nicht.
 */
function alsPruefzeitraum(
  stichtag: Date | null,
  zeitraum: { readonly von: Date; readonly bis: Date | null } | null,
): Zeitraum | null {
  if (zeitraum !== null) {
    const von = alsTag(zeitraum.von)
    if (zeitraum.bis === null) return { von, bis: von }
    const bis = alsTag(zeitraum.bis)
    // Ein **rückwärts** laufender Zeitraum enthält keinen Tag — und ein
    // Zeitraum ohne Tage gilt als gedeckt, weil es nichts zu decken gibt. Das
    // ist die mildeste denkbare Antwort auf eine unsinnige Eingabe. Er entsteht
    // dort, wo das Ende aus einer Frist kommt, die schon verstrichen ist (Q04:
    // „bis zur Angebotsfrist"); dann ist der Tag des Übergangs maßgeblich.
    return { von, bis: istVorOderGleich(von, bis) ? bis : von }
  }
  if (stichtag === null) return null
  const tag = alsTag(stichtag)
  return { von: tag, bis: tag }
}

function alsAnerkennung(wert: string): Anerkennung {
  return wert === 'accepted' || wert === 'rejected' ? wert : 'submitted'
}

const NACHWEISARTEN: readonly Nachweisart[] = [
  'permitCertificate',
  'workPermit',
  'safetyBriefing',
  'qualificationCertificate',
  'clearanceCertificate',
  'agreementDocument',
  'other',
]

function alsNachweisart(wert: string): Nachweisart | null {
  return NACHWEISARTEN.find((art) => art === wert) ?? null
}

/* ------------------------------------------------------------------ */
/* Umrechnung zwischen Datenmodell und Regelwerk                       */
/* ------------------------------------------------------------------ */

/**
 * `Date` zu Kalendertag. Das Datenmodell führt `DateTime`, das Regelwerk
 * rechnet mit Kalendertagen (5.0, „Tagesgrenze"): abgebildet wird auf den
 * UTC-Tag, mit dem Prisma die reinen Datumsfelder speichert.
 */
function alsTag(wert: Date): Tag {
  return wert.toISOString().slice(0, 10)
}

function alsDatum(wert: Tag | null): Date | null {
  return wert === null ? null : new Date(`${wert}T00:00:00.000Z`)
}

/**
 * Ein Einsatz als Eingangsdatum der Regel (5.1.3, E4): tatsächliche Daten haben
 * Vorrang vor geplanten. Ein Einsatz ohne `actualStartDate`, der vorzeitig
 * beendet wurde, hat **nie begonnen** und erzeugt keinen Überlassungstag
 * (5.1.5).
 */
function alsEinsatzsatz(zeile: Einsatzzeile, kunde: string): Einsatzsatz {
  const nieBegonnen = zeile.status === 'terminatedEarly' && zeile.actualStartDate === null
  const tatsaechlich = zeile.actualStartDate !== null
  return {
    id: zeile.id,
    kunde,
    lieferant: null,
    beginn: alsTag(zeile.actualStartDate ?? zeile.plannedStartDate),
    ende:
      zeile.actualEndDate !== null
        ? alsTag(zeile.actualEndDate)
        : tatsaechlich
          ? null
          : zeile.plannedEndDate === null
            ? null
            : alsTag(zeile.plannedEndDate),
    tatsaechlich,
    nieBegonnen,
    unterbrechungen: zeile.interruptions.map((pause) => ({
      von: alsTag(pause.interruptionFrom),
      bis: pause.interruptionTo === null ? null : alsTag(pause.interruptionTo),
    })),
  }
}

/**
 * Welche Einsätze gehören zur maßgeblichen Kette? Die, deren wirksamer Zeitraum
 * das Fenster der Kette berührt. Nur an ihnen werden die abgeleiteten Felder
 * fortgeschrieben (5.1.3, „Ergebnisfelder").
 */
function einsaetzeDerKette(
  einsaetze: readonly Einsatzzeile[],
  kettenbeginn: Tag | null,
  kettenende: Tag | null,
): readonly string[] {
  if (kettenbeginn === null || kettenende === null) return []
  return einsaetze
    .filter((zeile) => {
      if (zeile.status === 'terminatedEarly' && zeile.actualStartDate === null) return false
      const beginn = alsTag(zeile.actualStartDate ?? zeile.plannedStartDate)
      const ende =
        zeile.actualEndDate !== null
          ? alsTag(zeile.actualEndDate)
          : zeile.plannedEndDate !== null
            ? alsTag(zeile.plannedEndDate)
            : kettenende
      return istVorOderGleich(beginn, kettenende) && istVorOderGleich(kettenbeginn, ende)
    })
    .map((zeile) => zeile.id)
}

/**
 * Die Grenze nach der Rangfolge aus 5.1.2: Standort vor Kunde, die
 * Verleiherseite **nie**. Deckt keine Zuordnung den Stichtag ab, gilt die
 * gesetzliche Regelgrenze — nicht „keine Grenze" und nicht „Prüfung entfällt"
 * (5.0, Grundsatz 4).
 */
function grenzeAusZuordnungen(
  zuordnungen: readonly Tarifzeile[],
  stichtag: Date | null,
): { monate: number; herkunft: Grenzherkunft; gesenkt: boolean } {
  const regelgrenze = REGELWERK.dauer.regelgrenzeMonate
  const prueftag = stichtag === null ? null : alsTag(stichtag)
  const gueltig = zuordnungen.filter((zeile) => {
    if (zeile.maxAssignmentDurationMonths === null) return false
    if (zeile.appliesToType !== 'site' && zeile.appliesToType !== 'customer') return false
    if (prueftag === null) return true
    if (!istVorOderGleich(alsTag(zeile.validFrom), prueftag)) return false
    return zeile.validTo === null || istVorOderGleich(prueftag, alsTag(zeile.validTo))
  })

  const nachEbene = (ebene: string): Tarifzeile[] =>
    gueltig
      .filter((zeile) => zeile.appliesToType === ebene)
      .sort((a, b) => a.validFrom.getTime() - b.validFrom.getTime())
  const standort = nachEbene('site')
  const kunde = nachEbene('customer')
  const gewaehlt = standort[standort.length - 1] ?? kunde[kunde.length - 1] ?? null

  if (gewaehlt?.maxAssignmentDurationMonths == null) {
    return { monate: regelgrenze, herkunft: 'regelgrenze', gesenkt: false }
  }
  const reihe = gewaehlt.appliesToType === 'site' ? standort : kunde
  const gesenkt = reihe.some(
    (zeile) =>
      zeile !== gewaehlt &&
      zeile.maxAssignmentDurationMonths !== null &&
      zeile.maxAssignmentDurationMonths > (gewaehlt.maxAssignmentDurationMonths ?? 0),
  )
  return {
    monate: gewaehlt.maxAssignmentDurationMonths,
    herkunft: gewaehlt.appliesToType === 'site' ? 'standort' : 'kunde',
    gesenkt,
  }
}
