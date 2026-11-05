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
 *  - **P9** an Q04 und Q06 (4.1 Bedarfsanfrage, 4.2.1 Einladung),
 *  - **P1** an die Zeilen am Profilvorschlag, am Einsatz und an der
 *    Verlängerung (Q07, Q11, Q14, Q23, Q26, Q28, Q30) samt den abgeleiteten
 *    Feldern `maxDurationEndDate` und `countedDurationDays` (3.7),
 *  - **P3** an die Zeilen am Einsatz und an der Verlängerung samt dem
 *    abgeleiteten Feld `equalPayDueDate` (3.7) und der Tatsache
 *    `equalPayDueFromFirstDay`, die zusammen mit `comparableWagePresent` die
 *    Sperre aus Q48 bildet,
 *  - **P6** an Q08, Q12 und Q15 — die Rechtsfolge `equalPayDueFromFirstDay`
 *    und die Tatsachengrundlage `hasPreviousEmploymentDeclaration`,
 *  - **P8** an Q45 und Q46 — die Tatsache `concretizationComplete` aus den
 *    Kriterien K1 bis K5 (5.3.3),
 *  - **P11** an Q09, Q13, Q17 und Q47.
 *
 * **Nicht angebunden** sind P9 und P10 an den Zeilen am Einsatz, an der
 * Verlängerung, am Beleg und am Lieferantenstatus (Q16, Q20, Q21, Q31, Q37,
 * Q38, Q41 bis Q44): ihre Eingangsdaten — Erlaubnissätze und Nachweise — sind
 * an diesen Übergängen nicht geladen, und das Laden ist ein eigener Schritt.
 * Das Prüfwerk rechnet diese Zeilen bereits, nur hängt dort noch kein Übergang
 * daran.
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
import { pruefeDrehtuer } from './regeln/p6Drehtuer'
import { pruefeKonkretisierung, type Pruefstufe } from './regeln/p8Konkretisierung'
import { pruefeArbeitsverhaeltnis } from './regeln/p11Arbeitsverhaeltnis'
import { pruefeErlaubnis, type Erlaubnissatz, type Zeitraum } from './regeln/p9Erlaubnis'
import { REGELWERK } from './regelwerk'

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
