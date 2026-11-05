/**
 * Fachdienst Besetzung — SPEC 3.6 und 3.7 mit den Statusmodellen 4.2.3 und
 * 4.3.
 *
 * Arbeitsteilung wie in lib/services/demand.ts:
 *
 *  - **Was erlaubt ist**, entscheidet `checkPermission` (lib/authz).
 *  - **Welcher Übergang wann**, entscheidet das Statusmodell (lib/status).
 *  - **Welche Felder sichtbar sind**, entscheidet die Projektion
 *    (lib/visibility) — einschließlich der Datenminimierung aus 6.4, die an
 *    Fußnote [23] hängt.
 *  - Dieses Modul erhebt die Tatsachen, führt die Reihenfolge und schreibt.
 *
 * **Die AÜG-Prüfungen rechnet dieses Modul nicht.** Die Statusmodelle 4.2.3
 * und 4.3 nennen in ihren Vorbedingungen die Ergebnisse von P1, P4, P6 bis P11;
 * gerechnet werden sie in `lib/aueg/`, geladen hier. `RULE_CHECKS_PENDING`
 * unten ist die **eine** Stelle, an der die noch nicht gerechneten Ergebnisse
 * herkommen, und sie ist als solche benannt. Zwei Tatsachen sind davon
 * ausgenommen, weil sie reine Feldabfragen aus 3.6 sind und keine Regel: das
 * Vorliegen der Erklärung zur Vorbeschäftigung und das Bestehen des
 * Arbeitsverhältnisses am ersten Überlassungstag.
 *
 * **`equalPayDueFromFirstDay` hat zwei Quellen** (5.5.2 Nr. 2, strengstes
 * Ergebnis): den Treffer der Drehtürklausel (P6, 5.3.1 Schritt 5) und eine
 * Equal-Pay-Fälligkeit am oder vor dem ersten Überlassungstag (P3, 5.2.2
 * Fall 1). Zusammen mit `comparableWagePresent` bildet das die Sperre aus Q48.
 * Was P4 darüber hinaus prüft — den Eintrag des Standorts zu Tätigkeit und
 * Zeitraum (5.2.4, E10) —, ist an diesen Übergängen **nicht** geladen; die
 * Warnung aus Q18 und die Sperre aus Q36 hängen daran und fehlen deshalb noch.
 * P5 braucht die Stufenfolge des Schemas (3.3) und ist ebenfalls nicht
 * angebunden.
 *
 * **`concretizationComplete` ist P8** (5.3.3) und wird aus den Kriterien K1 bis
 * K5 gerechnet. K1 führt über `agreedRateCardItemRef` →
 * `rateCard.masterAgreementRef` zum Rahmenvertrag der Lieferantenseite, K5
 * vergleicht den Tag der Anlage mit dem ersten Überlassungstag — 4.3.1 kennt
 * genau einen Weg nach `planned`, der Einsatz entsteht dort, und `createdAt`
 * ist deshalb der Tag dieses Übergangs. `noIndustrialActionAtSite` (P7) bleibt
 * dagegen ein benannter Wert: dafür fehlt in Kapitel 3 das Feld, siehe die
 * Begründung an `RULE_CHECKS_PENDING`.
 *
 * Die Nebenwirkungen aus Kapitel 4, die der Prototyp noch nicht hat
 * (Benachrichtigungen, Fristenlauf, Audit-Eintrag aus 3.12), sind an ihrer
 * Stelle als Kommentar benannt — nicht stillschweigend weggelassen.
 */
import {
  bestehtArbeitsverhaeltnisAmErstenTag,
  drehtuerstand,
  equalPaystand,
  haeltVerlaengerungDieFrist,
  hoechstdauerstand,
  konkretisierungsstand,
  type Einsatzzeile,
  type EqualPaystand,
  type Hoechstdauerstand,
  type Konkretisierungsstand,
  type Rahmenvertragszeile,
  type Tarifzeile,
  type Verleiherzeile,
} from '../aueg/anbindung'
import { checkPermission, type Subject } from '../authz/check'
import type { LoadedIdentity } from '../identity/loadSubject'
import { prisma } from '../prisma'
import {
  ASSIGNMENT_MODEL,
  type AssignmentFacts,
  type AssignmentState,
  type AssignmentTransitionName,
  type TerminationRequestSide,
} from '../status/assignment'
import {
  ASSIGNMENT_EXTENSION_MODEL,
  type AssignmentExtensionFacts,
  type AssignmentExtensionState,
  type AssignmentExtensionTransitionName,
} from '../status/assignmentExtension'
import {
  CANDIDATE_SUBMISSION_MODEL,
  type CandidateSubmissionFacts,
  type CandidateSubmissionState,
  type CandidateSubmissionTransitionName,
} from '../status/candidateSubmission'
import { DEMAND_REQUEST_MODEL } from '../status/demandRequest'
import { attemptTransition, isTerminal, transitionsFrom, type TransitionOutcome } from '../status/machine'
import { concealedFields, project } from '../visibility/projections'
import {
  asFailure,
  assignmentRef,
  assignmentSubObjectRef,
  candidateRef,
  candidateSubmissionRef,
  demandRequestRef,
  failure,
  success,
  type ActionResult,
} from './common'

/**
 * Die Ergebnisse aus Kapitel 5, die **noch nicht gerechnet** sind.
 *
 * **Gerechnet** werden inzwischen P1 (Höchstüberlassungsdauer, 5.1), P6
 * (Drehtürklausel, 5.3.1) und P11 (Arbeitsverhältnis beim Verleiher, 5.3.4) —
 * über `lib/aueg/anbindung.ts`, siehe `Regelstand` unten. Hier stehen nur noch
 * die Tatsachen, für die es keinen Rechenweg gibt (P7 Arbeitskampf, P8
 * Kennzeichnung) oder deren Eingangsdaten an diesen Übergängen nicht geladen
 * sind (P9 Erlaubnis, P10 Pflichtnachweise — am Einsatz und an der
 * Verlängerung; an der Bedarfsanfrage und der Einladung rechnet P9 schon).
 *
 * Gewählt ist der **nicht sperrende** Wert, wie bei `hasAcceptedValidPermit` in
 * 4.1 und 4.2.1 vor P9: eine Vorbedingung, deren Tatsache niemand erhebt, darf
 * den Vorgang nicht scheinbar begründet verhindern. Dass sie noch nicht
 * gerechnet ist, steht hier und im PROGRESS-Eintrag — nicht in einer stillen
 * Vorbelegung irgendwo im Aufruf.
 */
const RULE_CHECKS_PENDING = {
  hasBlockingRuleCheck: false,
  mandatoryDocumentsChecked: true,
  mandatoryDocumentsPresent: true,
  /**
   * P7 (5.3.2). Dieser Wert bleibt hier, und zwar **nicht** aus Zeitmangel: für
   * die Arbeitskampfanzeige führt 3.1 kein Feld und für die Zusicherung nach
   * § 11 Abs. 5 Satz 2 AÜG kein Objekt. 5.3.2 sagt dazu selbst, die Regel sei
   * damit „prüfbar, aber **nicht auswertbar**", und verweist auf *offene Frage
   * 30*. Der Rechenweg steht in `lib/aueg/regeln/p7Arbeitskampf.ts` und läuft
   * gegen die Gherkin-Suite; angebunden wird er, sobald das Feld entschieden
   * ist. Bis dahin sperrt dieser Wert nichts — die Lücke ist benannt, nicht
   * geschlossen.
   */
  noIndustrialActionAtSite: true,
  hasAcceptedValidPermit: true,
  hasAcceptedValidPermitForNewPeriod: true,
} as const

/**
 * Die Ergebnisse aus Kapitel 5, die für **diesen** Vorgang gerechnet sind
 * (SPEC 5.1, 5.3.1, 5.3.4).
 *
 * Gerechnet wird in `lib/aueg/`, geladen hier: die Regel bekommt die Zeilen,
 * der Dienst holt sie. `hoechstdauer` trägt zusätzlich die abgeleiteten Felder
 * aus 3.7 — `maxDurationEndDate`, `countedDurationDays` und die Einsätze der
 * Kette, an denen beide fortzuschreiben sind (5.1.3, „Ergebnisfelder").
 */
interface Regelstand {
  readonly maxDurationExceeded: boolean
  readonly equalPayDueFromFirstDay: boolean
  readonly newEndWithinMaxDuration: boolean
  readonly hoechstdauer: Hoechstdauerstand | null
  /** P3 (5.2.3): `equalPayDueDate` und die Fälligkeit am ersten Tag. */
  readonly equalPay: EqualPaystand | null
}

/**
 * Der Stand, solange die Rechengrundlage fehlt: ohne Kette gibt es keine
 * Überschreitung, und ohne Erklärung wird die Equal-Pay-Fälligkeit **nicht**
 * vorgezogen (5.3.1, „Wenn Daten fehlen").
 */
const OHNE_REGELSTAND: Regelstand = {
  maxDurationExceeded: false,
  equalPayDueFromFirstDay: false,
  newEndWithinMaxDuration: true,
  hoechstdauer: null,
  equalPay: null,
}

/** Die Eingangsdaten, die P1 und P6 aus der Datenbank brauchen. */
interface Regelgrundlage {
  /** Die Überlassungskette: alle Einsätze derselben Person bei diesem Kunden. */
  readonly kette: readonly Einsatzzeile[]
  readonly tarifzuordnungen: readonly Tarifzeile[]
  /**
   * Die Zuordnungen der **Verleiherseite** (3.3). 5.2.2 liest die Equal-Pay-
   * Frist aus ihnen — anders als 5.1.2, wo die Einsatzbranche maßgeblich ist.
   * Deshalb werden sie getrennt geführt und nicht mit `tarifzuordnungen`
   * vermischt.
   */
  readonly verleiherzuordnungen: readonly Verleiherzeile[]
  /** Namen der Kunden mit demselben `corporateGroup` (§ 18 AktG, 5.3.1). */
  readonly konzernunternehmen: readonly string[]
  readonly identitaetBestaetigt: boolean
}

/**
 * Lädt die Überlassungskette (5.0), die Tarifzuordnungen (3.3) und den
 * Konzernverbund (3.1).
 *
 * **Schlüssel der Kette ist die bestätigte Personenidentität** — am Einsatz ist
 * `workerIdentityId` nur bei bestätigter Verknüpfung gesetzt (3.6, 4.2).
 * Fehlt sie, bleibt die Kette auf den Kandidatensatz **eines** Lieferanten
 * begrenzt; `countedDurationDays` kann dadurch nur zu niedrig sein, nie zu hoch
 * (5.1.5), und der Rechenweg führt den Vermerk mit.
 */
async function grundlageLaden(bezug: {
  readonly customerId: string
  readonly siteId: string
  readonly supplierId: string | null
  readonly workerIdentityId: string | null
  readonly candidateId: string
  readonly corporateGroup: string | null
}): Promise<Regelgrundlage> {
  const [kette, tarifzuordnungen, verleiherzuordnungen, konzern] = await Promise.all([
    prisma.assignment.findMany({
      where: {
        customerId: bezug.customerId,
        ...(bezug.workerIdentityId !== null
          ? { workerIdentityId: bezug.workerIdentityId }
          : { candidateId: bezug.candidateId }),
      },
      include: { interruptions: true },
      orderBy: [{ plannedStartDate: 'asc' }],
    }),
    // 5.1.2: Rang 1 der Standort, Rang 2 der Kunde. Die Verleiherseite wird
    // für die **Grenze** nicht gelesen und deshalb hier nicht geladen.
    prisma.collectiveAgreementAssignment.findMany({
      where: { OR: [{ siteId: bezug.siteId }, { customerId: bezug.customerId }] },
    }),
    // 5.2.2: die Equal-Pay-**Frist** kommt dagegen von der Verleiherseite. Ohne
    // Lieferanten gibt es keine Zuordnung — und damit Fall 1: Equal Pay ab dem
    // ersten Überlassungstag (das ist die strengste Folge, nicht die mildeste).
    bezug.supplierId === null
      ? Promise.resolve([])
      : prisma.collectiveAgreementAssignment.findMany({
          where: { appliesToType: 'supplier', supplierId: bezug.supplierId },
        }),
    bezug.corporateGroup === null
      ? Promise.resolve([])
      : prisma.customer.findMany({
          where: { corporateGroup: bezug.corporateGroup },
          select: { legalName: true },
        }),
  ])

  return {
    kette: kette.map((zeile) => ({
      id: zeile.id,
      status: zeile.status,
      plannedStartDate: zeile.plannedStartDate,
      plannedEndDate: zeile.plannedEndDate,
      actualStartDate: zeile.actualStartDate,
      actualEndDate: zeile.actualEndDate,
      interruptions: zeile.interruptions.map((pause) => ({
        interruptionFrom: pause.interruptionFrom,
        interruptionTo: pause.interruptionTo,
      })),
    })),
    tarifzuordnungen,
    verleiherzuordnungen,
    konzernunternehmen: konzern.map((eintrag) => eintrag.legalName),
    identitaetBestaetigt: bezug.workerIdentityId !== null,
  }
}

/**
 * Der Prüfzeitraum bzw. Stichtag eines Einsatzes nach der Tabelle in SPEC 5.0.
 * Er hängt am **Zustand** des Einsatzes, nicht am Tag des Aufrufs: ein geplanter
 * Einsatz wird über seinen geplanten Zeitraum beurteilt, ein laufender über
 * seinen tatsächlichen Beginn.
 */
function dauerbezug(einsatz: {
  readonly status: string
  readonly plannedStartDate: Date
  readonly plannedEndDate: Date | null
  readonly actualStartDate: Date | null
  readonly actualEndDate: Date | null
}): { stichtag: Date | null; zeitraum: { von: Date; bis: Date | null } | null } {
  if (einsatz.status === 'planned') {
    return {
      stichtag: null,
      zeitraum: { von: einsatz.plannedStartDate, bis: einsatz.plannedEndDate },
    }
  }
  if (einsatz.status === 'completed' || einsatz.status === 'terminatedEarly') {
    return { stichtag: einsatz.actualEndDate ?? einsatz.actualStartDate, zeitraum: null }
  }
  return { stichtag: einsatz.actualStartDate, zeitraum: null }
}

/** Ein geladener Einsatz als Zeile für das Regelwerk (SPEC 3.7). */
function alsEinsatzzeile(assignment: {
  readonly id: string
  readonly status: string
  readonly plannedStartDate: Date
  readonly plannedEndDate: Date | null
  readonly actualStartDate: Date | null
  readonly actualEndDate: Date | null
  readonly interruptions: readonly {
    readonly interruptionFrom: Date
    readonly interruptionTo: Date | null
  }[]
}): Einsatzzeile {
  return {
    id: assignment.id,
    status: assignment.status as Einsatzzeile['status'],
    plannedStartDate: assignment.plannedStartDate,
    plannedEndDate: assignment.plannedEndDate,
    actualStartDate: assignment.actualStartDate,
    actualEndDate: assignment.actualEndDate,
    interruptions: assignment.interruptions.map((pause) => ({
      interruptionFrom: pause.interruptionFrom,
      interruptionTo: pause.interruptionTo,
    })),
  }
}

/**
 * Der erste Wiederaufnahmetag: `interruptionTo` + 1 Tag (SPEC 5.0, Zeile
 * `interrupted` → `active`). Die Datumsfelder sind UTC-Mitternacht, deshalb ist
 * das reine Arithmetik und keine Zeitzonenumrechnung.
 */
function folgetagVon(wert: Date | null): Date | null {
  return wert === null ? null : new Date(wert.getTime() + 86_400_000)
}

/** Die Zeile des Vorgangs selbst — sie ersetzt in der Kette die geladene. */
function mitVorgang(
  kette: readonly Einsatzzeile[],
  zeile: Einsatzzeile,
): readonly Einsatzzeile[] {
  return [...kette.filter((eintrag) => eintrag.id !== zeile.id), zeile]
}

/**
 * Der Regelstand eines Einsatzes (P1 und P6). `bezug` ist der Stichtag bzw.
 * Prüfzeitraum des **Übergangs**, der geprüft wird (5.0); ohne Angabe gilt der
 * Zustand des Einsatzes.
 */
async function regelstandFuerEinsatz(
  zeile: Einsatzzeile,
  bezug: { stichtag: Date | null; zeitraum: { von: Date; bis: Date | null } | null },
  objekt: {
    readonly customerId: string
    readonly siteId: string
    /** Für 5.2.2: die Equal-Pay-Frist kommt von der Verleiherseite. */
    readonly supplierId: string
    /** `assignment.comparableWage` (3.7) — E12 aus 5.2.4. */
    readonly comparableWage: unknown
    readonly workerIdentityId: string | null
    readonly candidateId: string
    readonly customer: { readonly legalName: string; readonly corporateGroup: string | null }
    readonly candidate: {
      readonly previousEmploymentDeclaredAt: Date | null
      readonly previousEmploymentExisted: boolean | null
      readonly previousEmploymentEndedOn: Date | null
      readonly previousEmploymentEmployer: string | null
    }
  },
): Promise<Regelstand> {
  const grundlage = await grundlageLaden({
    customerId: objekt.customerId,
    siteId: objekt.siteId,
    supplierId: objekt.supplierId,
    workerIdentityId: objekt.workerIdentityId,
    candidateId: objekt.candidateId,
    corporateGroup: objekt.customer.corporateGroup,
  })

  const dauer = hoechstdauerstand({
    einsaetze: mitVorgang(grundlage.kette, zeile),
    kunde: objekt.customer.legalName,
    tarifzuordnungen: grundlage.tarifzuordnungen,
    stichtag: bezug.stichtag,
    zeitraum: bezug.zeitraum,
    identitaetBestaetigt: grundlage.identitaetBestaetigt,
  })

  const drehtuer = drehtuerstand({
    kandidat: objekt.candidate,
    entleiher: {
      name: objekt.customer.legalName,
      corporateGroup: objekt.customer.corporateGroup,
    },
    konzernunternehmen: grundlage.konzernunternehmen,
    ersterUeberlassungstag: zeile.actualStartDate ?? zeile.plannedStartDate,
  })

  const equalPay = equalPaystand({
    einsaetze: mitVorgang(grundlage.kette, zeile),
    kunde: objekt.customer.legalName,
    verleiherzuordnungen: grundlage.verleiherzuordnungen,
    stichtag: bezug.stichtag,
    zeitraum: bezug.zeitraum,
    ersterUeberlassungstag: zeile.actualStartDate ?? zeile.plannedStartDate,
    vergleichsentgeltGesetzt: objekt.comparableWage !== null,
    identitaetBestaetigt: grundlage.identitaetBestaetigt,
  })

  return {
    maxDurationExceeded: dauer.maxDurationExceeded,
    // Zwei Wege führen zu Equal Pay ab dem ersten Tag: der Treffer der
    // Drehtürklausel (5.3.1, Schritt 5) und eine Fälligkeit, die am oder vor
    // dem ersten Überlassungstag liegt (5.2.2 Fall 1). Zusammen mit
    // `comparableWagePresent` ist das die Sperre aus Q48.
    equalPayDueFromFirstDay:
      drehtuer.equalPayDueFromFirstDay || equalPay.equalPayDueFromFirstDay,
    newEndWithinMaxDuration: !dauer.maxDurationExceeded,
    hoechstdauer: dauer,
    equalPay,
  }
}

/** Dieselbe Rechnung für eine Verlängerung: `newEndDate` gegen das Fristende (Q28, Q30). */
async function regelstandFuerVerlaengerung(
  assignment: LoadedAssignment,
  neuesEnde: Date,
): Promise<Regelstand> {
  const grundlage = await grundlageLaden({
    customerId: assignment.customerId,
    siteId: assignment.siteId,
    supplierId: assignment.supplierId,
    workerIdentityId: assignment.workerIdentityId,
    candidateId: assignment.candidateId,
    corporateGroup: assignment.customer.corporateGroup,
  })
  const dauer = haeltVerlaengerungDieFrist({
    einsaetze: grundlage.kette,
    kunde: assignment.customer.legalName,
    tarifzuordnungen: grundlage.tarifzuordnungen,
    bisherigesEnde: assignment.plannedEndDate,
    neuesEnde,
  })
  // 5.0, Zeile „Verlängerung": Prüfzeitraum ist das bisherige `plannedEndDate`
  // + 1 Tag bis `newEndDate`. Dieselbe Rechnung für die Equal-Pay-Fälligkeit —
  // sie kann im verlängerten Zeitraum erst entstehen (Q29, Q32).
  const equalPay = equalPaystand({
    einsaetze: grundlage.kette,
    kunde: assignment.customer.legalName,
    verleiherzuordnungen: grundlage.verleiherzuordnungen,
    stichtag: null,
    zeitraum: {
      von: assignment.plannedEndDate ?? neuesEnde,
      bis: neuesEnde,
    },
    ersterUeberlassungstag: assignment.actualStartDate ?? assignment.plannedStartDate,
    vergleichsentgeltGesetzt: assignment.comparableWage !== null,
    identitaetBestaetigt: grundlage.identitaetBestaetigt,
  })
  return {
    maxDurationExceeded: dauer.maxDurationExceeded,
    equalPayDueFromFirstDay: false,
    newEndWithinMaxDuration: !dauer.maxDurationExceeded,
    hoechstdauer: dauer,
    equalPay,
  }
}

/**
 * Der Regelstand eines Profilvorschlags (P1 an Q07 und Q11). Prüfzeitraum nach
 * 5.0: `availableFrom` des Vorschlags bis `endDate` der Bedarfsanfrage, bei
 * leerem `endDate` bis `startDate`.
 */
async function regelstandFuerVorschlag(vorschlag: {
  readonly availableFrom: Date
  readonly candidate: { readonly id: string; readonly workerIdentityId: string | null }
  readonly demandRequest: {
    readonly customerId: string
    readonly siteId: string
    readonly startDate: Date
    readonly endDate: Date | null
  }
}): Promise<Regelstand> {
  const kunde = await prisma.customer.findUnique({
    where: { id: vorschlag.demandRequest.customerId },
    select: { legalName: true, corporateGroup: true },
  })
  if (kunde === null) return OHNE_REGELSTAND

  const grundlage = await grundlageLaden({
    customerId: vorschlag.demandRequest.customerId,
    siteId: vorschlag.demandRequest.siteId,
    // 4.7 nennt P3 am Profilvorschlag nicht (Q07 und Q11 führen nur P1); die
    // Verleiherzuordnung wird hier deshalb nicht geladen.
    supplierId: null,
    workerIdentityId: vorschlag.candidate.workerIdentityId,
    candidateId: vorschlag.candidate.id,
    corporateGroup: null,
  })
  const dauer = hoechstdauerstand({
    einsaetze: grundlage.kette,
    kunde: kunde.legalName,
    tarifzuordnungen: grundlage.tarifzuordnungen,
    stichtag: vorschlag.availableFrom,
    zeitraum: {
      von: vorschlag.availableFrom,
      bis: vorschlag.demandRequest.endDate ?? vorschlag.demandRequest.startDate,
    },
    identitaetBestaetigt: grundlage.identitaetBestaetigt,
  })
  return {
    maxDurationExceeded: dauer.maxDurationExceeded,
    equalPayDueFromFirstDay: false,
    newEndWithinMaxDuration: !dauer.maxDurationExceeded,
    hoechstdauer: dauer,
    equalPay: null,
  }
}

/**
 * Schreibt `maxDurationEndDate` und `countedDurationDays` an **jedem** Einsatz
 * der Kette fort (SPEC 5.1.3, „Ergebnisfelder"): sonst zeigt ein älterer
 * Einsatz einen überholten Stand. Läuft in derselben Transaktion wie der
 * Übergang, der die Rechengrundlage geändert hat (5.5.1 b).
 */
async function schreibeFristenstand(
  tx: Pick<typeof prisma, 'assignment'>,
  stand: Hoechstdauerstand | null,
  equalPay: EqualPaystand | null = null,
): Promise<void> {
  if (stand === null || stand.chainAssignmentIds.length === 0) return
  await tx.assignment.updateMany({
    where: { id: { in: [...stand.chainAssignmentIds] } },
    data: {
      maxDurationEndDate: stand.maxDurationEndDate,
      countedDurationDays: stand.countedDurationDays,
      // `equalPayDueDate` gehört zur **gleichen** Kette und wird mit ihr
      // fortgeschrieben (5.2.3, „Ergebnisfeld"). Fehlt der Stand, bleibt das
      // Feld unberührt — ein `null` würde einen gerechneten Wert löschen.
      ...(equalPay === null ? {} : { equalPayDueDate: equalPay.equalPayDueDate }),
    },
  })
}

const DAY = (value: Date | null): string | null =>
  value === null ? null : value.toISOString().slice(0, 10)
const MINUTE = (value: Date | null): string | null =>
  value === null ? null : value.toISOString().slice(0, 16).replace('T', ' ')
const AMOUNT = (value: { toString: () => string } | null, currency: string | null): string | null =>
  value === null ? null : `${value.toString()} ${currency ?? 'EUR'}`

// ── Kandidat (3.6) ─────────────────────────────────────────────────────────

export interface CandidateFields {
  readonly candidateNumber: string
  readonly supplier: string
  readonly pseudonym: string
  readonly givenName: string
  readonly familyName: string
  readonly dateOfBirth: string
  readonly placeOfBirth: string | null
  readonly contactEmail: string | null
  readonly contactPhone: string | null
  readonly qualifications: string
  readonly employmentStatusWithSupplier: string
  readonly employedSince: string | null
  readonly workPermitRequired: string
  readonly previousEmploymentDeclaredAt: string | null
  readonly previousEmploymentExisted: string | null
  readonly previousEmploymentEndedOn: string | null
  readonly previousEmploymentEmployer: string | null
  readonly workerIdentityId: string | null
}

export interface CandidateListEntry {
  readonly id: string
  readonly status: string
  readonly fields: Partial<CandidateFields>
  readonly concealed: readonly string[]
  /** Nur für den Betreiber: bestätigte Identität ja/nein ([43]). */
  readonly identityNote: string | null
}

const CANDIDATE_INCLUDE = {
  supplier: true,
  qualifications: true,
  workerIdentity: true,
} as const

type LoadedCandidate = Awaited<
  ReturnType<typeof prisma.candidate.findMany<{ include: typeof CANDIDATE_INCLUDE }>>
>[number]

function describeCandidate(candidate: LoadedCandidate): CandidateFields {
  return {
    candidateNumber: candidate.candidateNumber,
    supplier: candidate.supplier.legalName,
    pseudonym: candidate.pseudonym,
    givenName: candidate.givenName,
    familyName: candidate.familyName,
    dateOfBirth: DAY(candidate.dateOfBirth) ?? '',
    placeOfBirth: candidate.placeOfBirth,
    contactEmail: candidate.contactEmail,
    contactPhone: candidate.contactPhone,
    qualifications: candidate.qualifications.map((entry) => entry.qualification).join(', '),
    employmentStatusWithSupplier: candidate.employmentStatusWithSupplier,
    employedSince: DAY(candidate.employedSince),
    workPermitRequired: candidate.workPermitRequired ? 'ja' : 'nein',
    previousEmploymentDeclaredAt: DAY(candidate.previousEmploymentDeclaredAt),
    previousEmploymentExisted:
      candidate.previousEmploymentExisted === null
        ? null
        : candidate.previousEmploymentExisted
          ? 'ja'
          : 'nein',
    previousEmploymentEndedOn: DAY(candidate.previousEmploymentEndedOn),
    previousEmploymentEmployer: candidate.previousEmploymentEmployer,
    workerIdentityId: candidate.workerIdentity?.identityNumber ?? null,
  }
}

/** Die Kandidaten, die diese Identität sehen darf (2.2, Zeile 3.6). */
export async function loadCandidates(
  identity: LoadedIdentity,
): Promise<readonly CandidateListEntry[]> {
  const candidates = await prisma.candidate.findMany({
    include: CANDIDATE_INCLUDE,
    orderBy: [{ supplierId: 'asc' }, { candidateNumber: 'asc' }],
  })

  return candidates.flatMap((candidate) => {
    const ref = candidateRef(candidate)
    const decision = checkPermission(identity.subject, 'read', ref)
    const fields = project(describeCandidate(candidate), decision)
    if (fields === null) return []
    return [
      {
        id: candidate.id,
        status: candidate.status,
        fields,
        concealed: concealedFields(decision),
        // Die Personenidentität ist ausschließlich beim Betreiber geführt
        // ([43]); für jede andere Rolle bleibt dieser Hinweis leer — sie
        // erfährt nicht einmal, dass das Objekt existiert (2.3, Regel 4).
        identityNote:
          identity.tenant.tenantType === 'operator'
            ? candidate.workerIdentityId === null
              ? 'keine bestätigte Personenidentität'
              : `bestätigt: ${candidate.workerIdentity?.identityNumber ?? ''}`
            : null,
      },
    ]
  })
}

export interface NewCandidateInput {
  readonly givenName: string
  readonly familyName: string
  readonly dateOfBirth: Date
  readonly placeOfBirth: string | null
  readonly pseudonym: string
  readonly qualification: string | null
  readonly employmentStatusWithSupplier: 'employed' | 'applicant'
  readonly employedSince: Date | null
  readonly workPermitRequired: boolean
  readonly previousEmploymentDeclaredAt: Date | null
  readonly previousEmploymentExisted: boolean | null
  readonly previousEmploymentEndedOn: Date | null
  readonly previousEmploymentEmployer: string | null
}

/**
 * Legt einen Kandidaten an (3.6). Die Zeile in 2.2 gibt das `A`
 * ausschließlich dem `LD`; der Betreiber darf die fachlichen Angaben des
 * Lieferanten nicht anlegen und nicht ändern ([22]).
 *
 * Der Kandidat hat **kein** Statusmodell in Kapitel 4 (3.6) — deshalb läuft
 * das Anlegen über `checkPermission` und nicht über ein Statusmodell.
 */
export async function createCandidate(
  identity: LoadedIdentity,
  input: NewCandidateInput,
): Promise<ActionResult> {
  const supplier = await prisma.supplier.findUnique({
    where: { tenantId: identity.tenant.id },
  })
  if (supplier === null) {
    return failure(
      'Kandidaten führt der Lieferant; die gewählte Identität gehört zu keinem Lieferanten (3.6).',
      'SPEC 3.6, Mandant und Eigentümer',
    )
  }
  if (input.givenName.trim() === '' || input.familyName.trim() === '') {
    return failure('Vorname und Name sind Pflicht (3.6).')
  }
  if (input.pseudonym.trim() === '') {
    return failure(
      'Das Pseudonym ist Pflicht: es ist die Anzeigeform für das pseudonymisierte Profil (3.6, 6.4).',
      'SPEC 3.6, candidate.pseudonym',
    )
  }
  if (input.employmentStatusWithSupplier === 'employed' && input.employedSince === null) {
    return failure('„Beschäftigt seit" ist bei `employed` Pflicht (3.6).', 'SPEC 3.6')
  }

  const decision = checkPermission(
    identity.subject,
    'create',
    candidateRef({ tenantId: identity.tenant.id, status: 'active' }),
  )
  if (!decision.allowed) {
    return failure(decision.denial.reason, decision.denial.specReference)
  }

  const count = await prisma.candidate.count({ where: { supplierId: supplier.id } })
  try {
    await prisma.candidate.create({
      data: {
        tenantId: identity.tenant.id,
        candidateNumber: `K-${supplier.supplierNumber}-${count + 1}`,
        supplierId: supplier.id,
        givenName: input.givenName.trim(),
        familyName: input.familyName.trim(),
        dateOfBirth: input.dateOfBirth,
        placeOfBirth: input.placeOfBirth,
        pseudonym: input.pseudonym.trim(),
        employmentStatusWithSupplier: input.employmentStatusWithSupplier,
        employedSince: input.employedSince,
        workPermitRequired: input.workPermitRequired,
        previousEmploymentDeclaredAt: input.previousEmploymentDeclaredAt,
        previousEmploymentExisted: input.previousEmploymentExisted,
        previousEmploymentEndedOn: input.previousEmploymentEndedOn,
        previousEmploymentEmployer: input.previousEmploymentEmployer,
        status: 'active',
        createdById: identity.user.id,
        ...(input.qualification === null || input.qualification.trim() === ''
          ? {}
          : {
              qualifications: {
                create: [
                  { qualification: input.qualification.trim(), createdById: identity.user.id },
                ],
              },
            }),
      },
    })
  } catch (error) {
    return asFailure(error, 'Kandidat konnte nicht angelegt werden')
  }
  // Nebenwirkung aus 3.6, die der Prototyp noch nicht hat: der Abgleich der
  // Personenidentität läuft hier **nicht** automatisch mit. Er schlägt vor, und
  // der Vorschlag wird beim Betreiber bestätigt — siehe
  // lib/services/workerIdentity.ts.
  return success('Kandidat angelegt (3.6).')
}

// ── Profilvorschlag (3.6, Statusmodell 4.2.3) ──────────────────────────────

export interface SubmissionFields {
  readonly submissionNumber: string
  /** Anzeigeform, solange pseudonymisiert (6.4). */
  readonly pseudonym: string
  readonly givenName: string
  readonly familyName: string
  readonly dateOfBirth: string
  readonly contactEmail: string | null
  readonly contactPhone: string | null
  readonly qualifications: string
  readonly supplier: string
  readonly candidateNumber: string
  readonly availableFrom: string
  readonly offeredHourlyRate: string | null
  readonly disclosureLevel: string
  readonly submittedAt: string | null
  readonly releasedToCustomerAt: string | null
  readonly interviewScheduledAt: string | null
  readonly decision: string | null
  readonly decisionReason: string | null
  readonly withdrawnAt: string | null
  readonly previousEmploymentExisted: string | null
  readonly previousEmploymentEndedOn: string | null
}

export interface SubmissionListEntry {
  readonly id: string
  readonly status: CandidateSubmissionState
  readonly requestNumber: string
  readonly requestTitle: string
  readonly fields: Partial<SubmissionFields>
  readonly concealed: readonly string[]
  readonly availableTransitions: readonly {
    readonly name: CandidateSubmissionTransitionName
    readonly label: string
  }[]
  readonly terminal: boolean
  /** Hat dieser Vorschlag schon einen Einsatz (3.7)? */
  readonly assignmentNumber: string | null
}

const SUBMISSION_INCLUDE = {
  candidate: { include: { supplier: true, qualifications: true } },
  supplierOffer: true,
  demandRequest: true,
  assignment: true,
} as const

type LoadedSubmission = Awaited<
  ReturnType<typeof prisma.candidateSubmission.findMany<{ include: typeof SUBMISSION_INCLUDE }>>
>[number]

function describeSubmission(submission: LoadedSubmission): SubmissionFields {
  const candidate = submission.candidate
  return {
    submissionNumber: submission.submissionNumber,
    pseudonym: candidate.pseudonym,
    givenName: candidate.givenName,
    familyName: candidate.familyName,
    dateOfBirth: DAY(candidate.dateOfBirth) ?? '',
    contactEmail: candidate.contactEmail,
    contactPhone: candidate.contactPhone,
    qualifications: candidate.qualifications.map((entry) => entry.qualification).join(', '),
    supplier: candidate.supplier.legalName,
    candidateNumber: candidate.candidateNumber,
    availableFrom: DAY(submission.availableFrom) ?? '',
    offeredHourlyRate: AMOUNT(submission.offeredHourlyRate, submission.currency),
    disclosureLevel: submission.disclosureLevel,
    submittedAt: MINUTE(submission.submittedAt),
    releasedToCustomerAt: MINUTE(submission.releasedToCustomerAt),
    interviewScheduledAt: MINUTE(submission.interviewScheduledAt),
    decision: submission.decision,
    decisionReason: submission.decisionReason,
    withdrawnAt: MINUTE(submission.withdrawnAt),
    previousEmploymentExisted:
      candidate.previousEmploymentExisted === null
        ? null
        : candidate.previousEmploymentExisted
          ? 'ja'
          : 'nein',
    previousEmploymentEndedOn: DAY(candidate.previousEmploymentEndedOn),
  }
}

/**
 * Erklärung zur Vorbeschäftigung vorhanden (3.6, Form abschließend in 5.3.1)?
 *
 * Das ist **keine** Drehtürprüfung: P6 rechnet mit Fenster, Konzernbezug und
 * Entgeltfolge (5.3.1) und steht aus. Hier wird nur abgefragt, ob die
 * Tatsachengrundlage überhaupt vorliegt — genau das, was 4.2.3 und 4.3.1 als
 * Vorbedingung nennen.
 */
function hasPreviousEmploymentDeclaration(candidate: {
  readonly previousEmploymentDeclaredAt: Date | null
  readonly previousEmploymentExisted: boolean | null
}): boolean {
  return (
    candidate.previousEmploymentDeclaredAt !== null && candidate.previousEmploymentExisted !== null
  )
}

function submissionFacts(
  submission: LoadedSubmission,
  regelstand: Regelstand,
  evaluationDate: Date,
  overrides: Partial<CandidateSubmissionFacts> = {},
): CandidateSubmissionFacts {
  return {
    offerStatus: submission.supplierOffer.status,
    candidatePresent: true,
    pseudonym: submission.candidate.pseudonym,
    availableFrom: submission.availableFrom,
    disclosureLevel: submission.disclosureLevel,
    decision: submission.decision,
    decidedAt: submission.decidedAt,
    decidedById: submission.decidedById,
    decisionReason: submission.decisionReason,
    hasBlockingRuleCheck: RULE_CHECKS_PENDING.hasBlockingRuleCheck,
    // P1 (5.1): gerechnet über die Überlassungskette, siehe `Regelstand`.
    maxDurationExceeded: regelstand.maxDurationExceeded,
    hasPreviousEmploymentDeclaration: hasPreviousEmploymentDeclaration(submission.candidate),
    mandatoryDocumentsChecked: RULE_CHECKS_PENDING.mandatoryDocumentsChecked,
    evaluationDate,
    ...overrides,
  }
}

function submissionResource(submission: LoadedSubmission) {
  return candidateSubmissionRef({
    tenantId: submission.tenantId,
    customerTenantId: submission.demandRequest.tenantId,
    status: submission.status,
    disclosureLevel: submission.disclosureLevel,
    releasedToCustomerAt: submission.releasedToCustomerAt,
  })
}

/**
 * Die Profilvorschläge, die diese Identität sehen darf — in der sichtbaren
 * Fassung (6.4) und mit den Übergängen, die sie auslösen kann.
 */
export async function loadSubmissions(
  identity: LoadedIdentity,
  evaluationDate: Date = new Date(),
): Promise<readonly SubmissionListEntry[]> {
  const submissions = await prisma.candidateSubmission.findMany({
    include: SUBMISSION_INCLUDE,
    orderBy: [{ submissionNumber: 'asc' }],
  })

  // Der Regelstand je Vorschlag wird **vor** der Projektion gerechnet: er
  // braucht die Datenbank, die Projektion nicht.
  const regelstaende = new Map(
    await Promise.all(
      submissions.map(
        async (submission) =>
          [submission.id, await regelstandFuerVorschlag(submission)] as const,
      ),
    ),
  )

  return submissions.flatMap((submission) => {
    const status = submission.status as CandidateSubmissionState
    const ref = submissionResource(submission)
    const decision = checkPermission(identity.subject, 'read', ref)
    const fields = project(describeSubmission(submission), decision)
    if (fields === null) return []

    const facts = submissionFacts(
      submission,
      regelstaende.get(submission.id) ?? OHNE_REGELSTAND,
      evaluationDate,
    )
    const availableTransitions = transitionsFrom(CANDIDATE_SUBMISSION_MODEL, status).flatMap(
      (name) => {
        const outcome = attemptTransition(CANDIDATE_SUBMISSION_MODEL, name, {
          currentStatus: status,
          subject: identity.subject,
          resource: ref,
          facts,
        })
        // Angezeigt wird, was die Rolle überhaupt auslösen darf; eine
        // unerfüllte Vorbedingung bleibt sichtbar und wird beim Versuch
        // benannt (wie in lib/services/demand.ts).
        if (!outcome.applied && outcome.rejection.kind !== 'precondition') return []
        return [{ name, label: CANDIDATE_SUBMISSION_MODEL.transitions[name].label }]
      },
    )

    return [
      {
        id: submission.id,
        status,
        requestNumber: submission.demandRequest.requestNumber,
        requestTitle: submission.demandRequest.title,
        fields,
        concealed: concealedFields(decision),
        availableTransitions,
        terminal: isTerminal(CANDIDATE_SUBMISSION_MODEL, status),
        assignmentNumber: submission.assignment?.assignmentNumber ?? null,
      },
    ]
  })
}

export interface NewSubmissionInput {
  readonly offerId: string
  readonly candidateId: string
  readonly availableFrom: Date
  readonly offeredHourlyRate: number | null
}

/**
 * Legt einen Profilvorschlag an und reicht ihn ein — zwei Übergänge aus 4.2.3
 * (`create`, `submit`). Die Reihenfolge ist die der Spezifikation; keiner wird
 * übersprungen.
 *
 * Die Offenlegungsstufe ist beim Anlegen `pseudonymized` — nicht als
 * Vorbelegung, sondern weil 4.2.3 den Übergang nach `submitted` daran bindet
 * (6.4).
 */
export async function submitCandidate(
  identity: LoadedIdentity,
  input: NewSubmissionInput,
  evaluationDate: Date = new Date(),
): Promise<ActionResult> {
  const offer = await prisma.supplierOffer.findUnique({
    where: { id: input.offerId },
    include: { tenderInvitation: { include: { tender: { include: { demandRequest: true } } } } },
  })
  if (offer === null) return failure('Unbekanntes Angebot.')
  const candidate = await prisma.candidate.findUnique({ where: { id: input.candidateId } })
  if (candidate === null) return failure('Unbekannter Kandidat.')
  if (candidate.supplierId !== offer.supplierId) {
    return failure(
      'Ein Lieferant schlägt nur eigene Kandidaten vor (2.3, Zwischen Lieferanten).',
      'SPEC 2.3',
    )
  }

  const demandRequest = offer.tenderInvitation.tender.demandRequest
  const ref = candidateSubmissionRef({
    tenantId: candidate.tenantId,
    customerTenantId: demandRequest.tenantId,
    status: 'draft',
    disclosureLevel: 'pseudonymized',
    releasedToCustomerAt: null,
  })

  const facts: CandidateSubmissionFacts = {
    offerStatus: offer.status,
    candidatePresent: true,
    pseudonym: candidate.pseudonym,
    availableFrom: input.availableFrom,
    disclosureLevel: 'pseudonymized',
    decision: null,
    decidedAt: null,
    decidedById: null,
    decisionReason: null,
    hasBlockingRuleCheck: RULE_CHECKS_PENDING.hasBlockingRuleCheck,
    // P1 (5.1) über die Kette des Kandidaten beim Kunden der Anfrage.
    maxDurationExceeded: (
      await regelstandFuerVorschlag({
        availableFrom: input.availableFrom,
        candidate,
        demandRequest,
      })
    ).maxDurationExceeded,
    hasPreviousEmploymentDeclaration: hasPreviousEmploymentDeclaration(candidate),
    mandatoryDocumentsChecked: RULE_CHECKS_PENDING.mandatoryDocumentsChecked,
    evaluationDate,
  }

  const created = attemptTransition(CANDIDATE_SUBMISSION_MODEL, 'create', {
    currentStatus: null,
    subject: identity.subject,
    resource: ref,
    facts,
  })
  if (!created.applied) return rejection(created)

  const submitted = attemptTransition(CANDIDATE_SUBMISSION_MODEL, 'submit', {
    currentStatus: 'draft',
    subject: identity.subject,
    resource: ref,
    facts,
  })
  if (!submitted.applied) return rejection(submitted)

  const count = await prisma.candidateSubmission.count({ where: { tenantId: candidate.tenantId } })
  try {
    await prisma.candidateSubmission.create({
      data: {
        tenantId: candidate.tenantId,
        submissionNumber: `PV-${candidate.candidateNumber}-${count + 1}`,
        candidateId: candidate.id,
        supplierOfferId: offer.id,
        demandRequestId: demandRequest.id,
        availableFrom: input.availableFrom,
        offeredHourlyRate: input.offeredHourlyRate,
        currency: input.offeredHourlyRate === null ? null : 'EUR',
        disclosureLevel: 'pseudonymized',
        submittedAt: evaluationDate,
        status: 'submitted',
        createdById: identity.user.id,
      },
    })
  } catch (error) {
    return asFailure(error, 'Profilvorschlag konnte nicht eingereicht werden')
  }
  // Nebenwirkung aus 4.2.3: Benachrichtigung an `MD`. Für den Kunden ist der
  // Vorschlag **nicht** sichtbar — das trägt `candidateSubmissionRef` über
  // `releasedToCustomerAt`, nicht die Oberfläche.
  return success('Profilvorschlag eingereicht; für den Kunden noch nicht sichtbar (4.2.3).')
}

export interface SubmissionTransitionInput {
  readonly submissionId: string
  readonly transition: CandidateSubmissionTransitionName
  readonly decisionReason: string | null
  readonly interviewAt: Date | null
}

/**
 * Vollzieht einen Übergang am Profilvorschlag (4.2.3) samt seinen
 * Nebenwirkungen auf dieselben Daten:
 *
 *  - `releaseToCustomer` setzt `releasedToCustomerAt` und bringt die
 *    Bedarfsanfrage auf `inSelection` (4.1) — das ist ein eigener Übergang und
 *    läuft über das Statusmodell der Anfrage, nicht über ein Feldupdate.
 *  - `accept` wechselt die Offenlegungsstufe auf `identified` (6.4). Jeder
 *    Zugriff auf Klardaten ist danach zu protokollieren (3.12) — der
 *    Audit-Eintrag fehlt dem Prototyp noch.
 *  - Das **Angebot** auf `accepted` zu setzen (4.2.2) ist der Übergang des
 *    Betreibers und wird hier **nicht** mitvollzogen: die Zusage trifft der
 *    Kunde, den Zuschlag erteilt `MD`. Nach diesem Übergang ist die
 *    Vorbedingung `acceptedSubmissionCount >= 1` erfüllt und der Zuschlag
 *    möglich.
 */
export async function transitionSubmission(
  identity: LoadedIdentity,
  input: SubmissionTransitionInput,
  evaluationDate: Date = new Date(),
): Promise<ActionResult> {
  const submission = await prisma.candidateSubmission.findUnique({
    where: { id: input.submissionId },
    include: SUBMISSION_INCLUDE,
  })
  if (submission === null) return failure('Unbekannter Profilvorschlag.')

  const status = submission.status as CandidateSubmissionState
  const reason = input.decisionReason?.trim() === '' ? null : (input.decisionReason ?? null)
  const decides = input.transition === 'accept' || input.transition === 'rejectByCustomer'
  const overrides: Partial<CandidateSubmissionFacts> = {
    decisionReason: reason,
    ...(decides
      ? {
          decision: input.transition === 'accept' ? ('accepted' as const) : ('rejected' as const),
          decidedAt: evaluationDate,
          decidedById: identity.user.id,
        }
      : {}),
    ...(input.transition === 'rejectByOperator' ? { decisionReason: reason } : {}),
  }

  const outcome = attemptTransition(CANDIDATE_SUBMISSION_MODEL, input.transition, {
    currentStatus: status,
    subject: identity.subject,
    resource: submissionResource(submission),
    facts: submissionFacts(
      submission,
      await regelstandFuerVorschlag(submission),
      evaluationDate,
      overrides,
    ),
  })
  if (!outcome.applied) return rejection(outcome)

  const data: Record<string, unknown> = { status: outcome.to, updatedById: identity.user.id }
  if (input.transition === 'releaseToCustomer') data.releasedToCustomerAt = evaluationDate
  if (input.transition === 'scheduleInterview') {
    data.interviewScheduledAt = input.interviewAt ?? evaluationDate
  }
  if (input.transition === 'accept') {
    data.decision = 'accepted'
    data.decidedAt = evaluationDate
    data.decidedById = identity.user.id
    // 4.2.3: „Offenlegungsstufe wechselt auf `identified`" — die Zusage ist der
    // Zeitpunkt, an dem der Kunde die Klardaten sehen darf (6.4).
    data.disclosureLevel = 'identified'
  }
  if (input.transition === 'rejectByCustomer') {
    data.decision = 'rejected'
    data.decidedAt = evaluationDate
    data.decidedById = identity.user.id
    data.decisionReason = reason
  }
  if (input.transition === 'rejectByOperator') data.decisionReason = reason
  if (input.transition === 'withdraw') data.withdrawnAt = evaluationDate

  try {
    await prisma.candidateSubmission.update({ where: { id: submission.id }, data })
  } catch (error) {
    return asFailure(error, 'Statuswechsel am Profilvorschlag konnte nicht gespeichert werden')
  }

  let note = ''
  if (input.transition === 'releaseToCustomer') {
    note = await moveRequestToSelection(identity, submission.demandRequestId, evaluationDate)
  }
  return success(
    `${outcome.label}: Profilvorschlag steht jetzt auf „${outcome.to}" (${outcome.specReference}).${note}`,
  )
}

/**
 * Nebenwirkung aus 4.2.3: mit der Vorlage beim Kunden geht die Bedarfsanfrage
 * auf `inSelection` (4.1). Der Übergang läuft über das Statusmodell der
 * Anfrage; scheitert er, bleibt die Anfrage stehen und der Vorschlag ist
 * trotzdem vorgelegt — die Anfrage kann bereits in `inSelection` sein.
 */
async function moveRequestToSelection(
  identity: LoadedIdentity,
  demandRequestId: string,
  evaluationDate: Date,
): Promise<string> {
  const request = await prisma.demandRequest.findUnique({
    where: { id: demandRequestId },
    include: { qualificationRequirements: true },
  })
  if (request === null || request.status !== 'tendered') return ''

  const released = await prisma.candidateSubmission.count({
    where: { demandRequestId, status: 'releasedToCustomer' },
  })
  const outcome = attemptTransition(DEMAND_REQUEST_MODEL, 'releaseToSelection', {
    currentStatus: 'tendered',
    subject: identity.subject,
    resource: demandRequestRef(request, []),
    facts: {
      requestedById: request.requestedById,
      actingUserId: identity.user.id,
      activityDescription: request.activityDescription,
      qualificationRequirementCount: request.qualificationRequirements.length,
      siteId: request.siteId,
      costCenterId: request.costCenterId,
      startDate: request.startDate,
      weeklyHours: Number(request.weeklyHours),
      headcount: request.headcount,
      offerDeadline: request.offerDeadline,
      cancellationReason: request.cancellationReason,
      rejectionReason: request.rejectionReason,
      invitedSuppliers: [],
      previousTenderClosed: true,
      releasedSubmissionCount: released,
      openSubmissionCount: released,
      effectiveAssignmentCount: 0,
      evaluationDate,
    },
  })
  if (!outcome.applied) return ''
  await prisma.demandRequest.update({
    where: { id: demandRequestId },
    data: { status: 'inSelection', updatedById: identity.user.id },
  })
  return ' Die Bedarfsanfrage steht jetzt auf „inSelection" (4.1).'
}

// ── Einsatz (3.7, Statusmodell 4.3) ────────────────────────────────────────

export interface AssignmentFields {
  readonly assignmentNumber: string
  readonly customer: string
  readonly site: string
  readonly costCenterNumber: string
  readonly supplier: string
  readonly candidate: string
  readonly pseudonym: string
  readonly activityDescription: string
  readonly plannedStartDate: string
  readonly plannedEndDate: string | null
  readonly actualStartDate: string | null
  readonly actualEndDate: string | null
  readonly weeklyHours: string
  readonly shiftModel: string | null
  readonly agreedHourlyRate: string | null
  readonly customerHourlyRate: string | null
  readonly comparableWage: string | null
  readonly equalPayDueDate: string | null
  readonly maxDurationEndDate: string | null
  readonly countedDurationDays: string | null
  readonly terminationReason: string | null
  readonly workerIdentityId: string | null
}

export interface ExtensionSummary {
  readonly id: string
  readonly status: AssignmentExtensionState
  readonly newEndDate: string
  readonly reason: string
  readonly approvedAt: string | null
  readonly effectiveAt: string | null
  readonly rejectionReason: string | null
  readonly availableTransitions: readonly {
    readonly name: AssignmentExtensionTransitionName
    readonly label: string
  }[]
}

export interface InterruptionSummary {
  readonly id: string
  readonly from: string
  readonly to: string | null
  readonly reason: string
  readonly countsAsReset: string | null
}

export interface AssignmentListEntry {
  readonly id: string
  readonly status: AssignmentState
  readonly fields: Partial<AssignmentFields>
  readonly concealed: readonly string[]
  readonly availableTransitions: readonly {
    readonly name: AssignmentTransitionName
    readonly label: string
  }[]
  readonly terminal: boolean
  readonly extensions: readonly ExtensionSummary[]
  readonly interruptions: readonly InterruptionSummary[]
  /** Offener Antrag auf vorzeitige Beendigung (3.7) — ohne eigenen Zustand. */
  readonly openTerminationRequest: string | null
}

const ASSIGNMENT_INCLUDE = {
  customer: true,
  site: true,
  costCenter: true,
  supplier: true,
  candidate: true,
  workerIdentity: true,
  candidateSubmission: true,
  // K1 aus 5.3.3 führt über `agreedRateCardItemRef` → `rateCard.masterAgreementRef`
  // zum Rahmenvertrag der Lieferantenseite (3.3). Ohne diesen Weg ist die
  // Kennzeichnung nicht prüfbar.
  agreedRateCardItem: { include: { rateCard: { include: { masterAgreement: true } } } },
  customerRateCardItem: true,
  // K3 vergleicht die Tätigkeitsbeschreibung mit dem Titel der Anfrage (5.3.3).
  demandRequest: true,
  // Der Mandant des Antragstellers entscheidet, ob die Genehmigung der
  // Kundenseite nötig ist ([26], 4.3.1).
  terminationRequestedBy: { include: { tenant: true } },
  extensions: { include: { requestedBy: true } },
  interruptions: true,
} as const

type LoadedAssignment = Awaited<
  ReturnType<typeof prisma.assignment.findMany<{ include: typeof ASSIGNMENT_INCLUDE }>>
>[number]

function describeAssignment(assignment: LoadedAssignment): AssignmentFields {
  return {
    assignmentNumber: assignment.assignmentNumber,
    customer: assignment.customer.legalName,
    site: assignment.site.name,
    costCenterNumber: assignment.costCenter.costCenterNumber,
    supplier: assignment.supplier.legalName,
    candidate: `${assignment.candidate.givenName} ${assignment.candidate.familyName}`,
    pseudonym: assignment.candidate.pseudonym,
    activityDescription: assignment.activityDescription,
    plannedStartDate: DAY(assignment.plannedStartDate) ?? '',
    plannedEndDate: DAY(assignment.plannedEndDate),
    actualStartDate: DAY(assignment.actualStartDate),
    actualEndDate: DAY(assignment.actualEndDate),
    weeklyHours: assignment.weeklyHours.toString(),
    shiftModel: assignment.shiftModel,
    agreedHourlyRate: AMOUNT(
      assignment.agreedHourlyRate ?? assignment.agreedRateCardItem.hourlyRate,
      assignment.currency,
    ),
    customerHourlyRate: AMOUNT(assignment.customerRateCardItem.hourlyRate, assignment.currency),
    comparableWage: AMOUNT(assignment.comparableWage, assignment.comparableWageCurrency),
    equalPayDueDate: DAY(assignment.equalPayDueDate),
    maxDurationEndDate: DAY(assignment.maxDurationEndDate),
    countedDurationDays:
      assignment.countedDurationDays === null ? null : String(assignment.countedDurationDays),
    terminationReason: assignment.terminationReason,
    workerIdentityId: assignment.workerIdentity?.identityNumber ?? null,
  }
}

/**
 * Für Lieferanten **nie** sichtbar: Kostenstelle und Kundenpreisposition (3.7,
 * [14] und [42]). Fußnote [7] trägt dafür keine Feldliste — die Zeile zu 3.7
 * ist in 2.2 die einzige, die beide Seiten zugleich zugänglich macht. Verdeckt
 * werden die Felder deshalb an [7] und [2], je Mandantentyp.
 */
function assignmentFacts(
  assignment: LoadedAssignment,
  regelstand: Regelstand,
  evaluationDate: Date,
  overrides: Partial<AssignmentFacts> = {},
): AssignmentFacts {
  const running = assignment.interruptions.find((entry) => entry.interruptionTo === null)
  return {
    submissionStatus: assignment.candidateSubmission?.status ?? null,
    supplierStatus: assignment.supplier.status,
    activityDescription: assignment.activityDescription,
    agreedRateCardItemPresent: true,
    customerRateCardItemPresent: true,
    workerIdentityConfirmed: assignment.workerIdentityId !== null,
    plannedStartDate: assignment.plannedStartDate,
    plannedEndDate: assignment.plannedEndDate,
    actualStartDate: assignment.actualStartDate,
    actualEndDate: assignment.actualEndDate,
    hasRunningInterruption: running !== undefined,
    interruptionFrom: running?.interruptionFrom ?? null,
    interruptionReason: running?.reasonCategory ?? null,
    interruptionTo: null,
    terminationReason: assignment.terminationReason,
    terminationRequestedById: assignment.terminationRequestedById,
    terminationRequestedBySide: terminationSide(assignment),
    terminationApprovedById: assignment.terminationApprovedById,
    hasAcceptedValidPermit: RULE_CHECKS_PENDING.hasAcceptedValidPermit,
    mandatoryDocumentsPresent: RULE_CHECKS_PENDING.mandatoryDocumentsPresent,
    noIndustrialActionAtSite: RULE_CHECKS_PENDING.noIndustrialActionAtSite,
    // P1 (5.1) und P6 (5.3.1): gerechnet, siehe `Regelstand`.
    maxDurationExceeded: regelstand.maxDurationExceeded,
    // P8 (5.3.3): gerechnet aus den Kriterien K1 bis K5.
    concretizationComplete: konkretisierungFuerEinsatz(assignment, overrides.actualStartDate)
      .concretizationComplete,
    hasPreviousEmploymentDeclaration: hasPreviousEmploymentDeclaration(assignment.candidate),
    employmentRelationshipOnFirstDay: employmentOnFirstDay(assignment),
    equalPayDueFromFirstDay: regelstand.equalPayDueFromFirstDay,
    comparableWagePresent: assignment.comparableWage !== null,
    evaluationDate,
    ...overrides,
  }
}

/**
 * P8 für einen geladenen Einsatz (SPEC 5.3.3).
 *
 * **Die Prüfstufe hängt am Zustand, nicht am Aufruf.** Ein Einsatz in `planned`
 * steht vor dem Übergang nach `active`, und das ist der Zeitpunkt, an dem K5
 * gilt (Q46). Ein Einsatz, der noch angelegt wird, kennt K5 nicht (Q45) — der
 * Fall steht in `createAssignment`.
 *
 * `uebergebenerStart` ist der `actualStartDate`, den der Übergang **mitbringt**:
 * er ist zur Prüfzeit noch nicht gespeichert, gilt aber schon (5.0).
 */
function konkretisierungFuerEinsatz(
  assignment: LoadedAssignment,
  uebergebenerStart: Date | null | undefined,
): Konkretisierungsstand {
  const start = uebergebenerStart ?? assignment.actualStartDate
  return konkretisierungsstand({
    einsatz: {
      candidateId: assignment.candidateId,
      activityDescription: assignment.activityDescription,
      siteId: assignment.siteId,
      supplierId: assignment.supplierId,
      agreedRateCardItemId: assignment.agreedRateCardItemId,
      plannedStartDate: assignment.plannedStartDate,
      plannedEndDate: assignment.plannedEndDate,
      actualStartDate: start,
      // 4.3.1 kennt genau einen Weg nach `planned` — „— → `planned`". Der
      // Einsatz entsteht dort, also ist seine Anlage der Übergang, den K5
      // datiert.
      createdAt: assignment.createdAt,
    },
    rahmenvertrag: alsRahmenvertragszeile(assignment.agreedRateCardItem),
    titelDerAnfrage: assignment.demandRequest?.title ?? null,
    stufe: assignment.status === 'planned' || start !== null ? 'start' : 'anlage',
  })
}

/** Der Rahmenvertrag hinter der Preisposition (3.3) — der Weg aus K1. */
function alsRahmenvertragszeile(position: {
  readonly rateCard: {
    readonly masterAgreement: {
      readonly agreementNumber: string
      readonly agreementType: string
      readonly status: string
      readonly supplierId: string | null
      readonly validFrom: Date
      readonly validTo: Date | null
    }
  }
} | null): Rahmenvertragszeile | null {
  if (position === null) return null
  const vertrag = position.rateCard.masterAgreement
  return {
    agreementNumber: vertrag.agreementNumber,
    agreementType: vertrag.agreementType,
    status: vertrag.status,
    supplierId: vertrag.supplierId,
    validFrom: vertrag.validFrom,
    validTo: vertrag.validTo,
  }
}

/**
 * Besteht am ersten Überlassungstag ein Arbeitsverhältnis beim Verleiher
 * (3.6, `employmentStatusWithSupplier` und `employedSince`)?
 *
 * Das ist **P11** aus SPEC 5.3.4 und wird dort gerechnet, nicht hier: diese
 * Funktion reicht die Felder an `lib/aueg/anbindung.ts` weiter. Vorher stand die
 * Regel ein zweites Mal in diesem Modul — das Gesetz gehört an **eine** Stelle,
 * sonst laufen die beiden Fassungen auseinander.
 */
function employmentOnFirstDay(assignment: {
  readonly candidate: {
    readonly employmentStatusWithSupplier: string
    readonly employedSince: Date | null
  }
  readonly actualStartDate: Date | null
  readonly plannedStartDate: Date
}): boolean {
  return bestehtArbeitsverhaeltnisAmErstenTag({
    kandidat: assignment.candidate,
    ersterUeberlassungstag: assignment.actualStartDate ?? assignment.plannedStartDate,
    // Die Vorprüfung (Q09, Q13, Q17) und der Einsatzstart (Q47) unterscheiden
    // sich in der **Ergebnisart** aus 4.7, nicht im Treffer; die Tatsache, die
    // 4.3 hier verlangt, ist dieselbe.
    amEinsatzstart: assignment.actualStartDate !== null,
  }).employmentRelationshipOnFirstDay
}

/**
 * Welche Seite hat die vorzeitige Beendigung beantragt (4.3.1, [26])?
 *
 * **Abgeleitet, nicht gespeichert.** 3.7 führt mit `terminationRequestedBy`
 * einen Verweis auf den Benutzer; welcher Seite der Antrag zuzurechnen ist,
 * sagt dessen Mandant (3.11). Ein zweites Feld dafür wäre eine Angabe, die sich
 * mit der ersten widersprechen könnte.
 */
function terminationSide(assignment: {
  readonly terminationRequestedBy: { readonly tenant: { readonly tenantType: string } } | null
}): TerminationRequestSide | null {
  const tenantType = assignment.terminationRequestedBy?.tenant.tenantType
  if (tenantType === 'customer' || tenantType === 'supplier' || tenantType === 'operator') {
    return tenantType
  }
  return null
}

function assignmentResource(assignment: LoadedAssignment) {
  return assignmentRef({
    tenantId: assignment.tenantId,
    customerTenantId: assignment.customer.tenantId,
    supplierTenantId: assignment.supplier.tenantId,
    siteId: assignment.siteId,
    costCenterId: assignment.costCenterId,
    status: assignment.status,
  })
}

export async function loadAssignments(
  identity: LoadedIdentity,
  evaluationDate: Date = new Date(),
): Promise<readonly AssignmentListEntry[]> {
  const assignments = await prisma.assignment.findMany({
    include: ASSIGNMENT_INCLUDE,
    orderBy: [{ assignmentNumber: 'asc' }],
  })

  // Der Regelstand je Einsatz und je Verlängerung wird **vor** der Projektion
  // gerechnet: er braucht die Datenbank, die Projektion nicht.
  const staende = new Map(
    await Promise.all(
      assignments.map(
        async (assignment) =>
          [
            assignment.id,
            await regelstandFuerEinsatz(
              alsEinsatzzeile(assignment),
              dauerbezug(assignment),
              assignment,
            ),
          ] as const,
      ),
    ),
  )
  const verlaengerungsstaende = new Map(
    await Promise.all(
      assignments.flatMap((assignment) =>
        assignment.extensions.map(
          async (extension) =>
            [
              extension.id,
              await regelstandFuerVerlaengerung(assignment, extension.newEndDate),
            ] as const,
        ),
      ),
    ),
  )

  return assignments.flatMap((assignment) => {
    const status = assignment.status as AssignmentState
    const ref = assignmentResource(assignment)
    const decision = checkPermission(identity.subject, 'read', ref)
    const fields = project(describeAssignment(assignment), decision)
    if (fields === null) return []

    const facts = assignmentFacts(
      assignment,
      staende.get(assignment.id) ?? OHNE_REGELSTAND,
      evaluationDate,
    )
    const availableTransitions = transitionsFrom(ASSIGNMENT_MODEL, status).flatMap((name) => {
      const outcome = attemptTransition(ASSIGNMENT_MODEL, name, {
        currentStatus: status,
        subject: identity.subject,
        resource: ref,
        facts,
      })
      if (!outcome.applied && outcome.rejection.kind !== 'precondition') return []
      return [{ name, label: ASSIGNMENT_MODEL.transitions[name].label }]
    })

    return [
      {
        id: assignment.id,
        status,
        fields,
        concealed: concealedFields(decision),
        availableTransitions,
        terminal: isTerminal(ASSIGNMENT_MODEL, status),
        extensions: assignment.extensions.map((extension) =>
          describeExtension(
            assignment,
            extension,
            verlaengerungsstaende.get(extension.id) ?? OHNE_REGELSTAND,
            identity,
            evaluationDate,
          ),
        ),
        interruptions: assignment.interruptions.map((entry) => ({
          id: entry.id,
          from: DAY(entry.interruptionFrom) ?? '',
          to: DAY(entry.interruptionTo),
          reason: entry.reasonText === null ? entry.reasonCategory : `${entry.reasonCategory}: ${entry.reasonText}`,
          countsAsReset:
            entry.countsAsReset === null ? null : entry.countsAsReset ? 'ja' : 'nein',
        })),
        openTerminationRequest:
          assignment.terminationRequestedById === null ||
          status === 'terminatedEarly' ||
          status === 'completed'
            ? null
            : `beantragt von ${terminationSide(assignment) ?? 'unbekannt'}${
                assignment.terminationApprovedById === null
                  ? ''
                  : ', von der Kundenseite genehmigt'
              }`,
      },
    ]
  })
}

function describeExtension(
  assignment: LoadedAssignment,
  extension: LoadedAssignment['extensions'][number],
  regelstand: Regelstand,
  identity: LoadedIdentity,
  evaluationDate: Date,
): ExtensionSummary {
  const status = extension.status as AssignmentExtensionState
  const ref = assignmentSubObjectRef(
    {
      tenantId: assignment.tenantId,
      customerTenantId: assignment.customer.tenantId,
      supplierTenantId: assignment.supplier.tenantId,
      siteId: assignment.siteId,
      costCenterId: assignment.costCenterId,
    },
    status,
  )
  const facts = extensionFacts(assignment, regelstand, extension, identity.user.id, evaluationDate)
  return {
    id: extension.id,
    status,
    newEndDate: DAY(extension.newEndDate) ?? '',
    reason: extension.reason,
    approvedAt: MINUTE(extension.approvedAt),
    effectiveAt: MINUTE(extension.effectiveAt),
    rejectionReason: extension.rejectionReason,
    availableTransitions: transitionsFrom(ASSIGNMENT_EXTENSION_MODEL, status).flatMap((name) => {
      const outcome = attemptTransition(ASSIGNMENT_EXTENSION_MODEL, name, {
        currentStatus: status,
        subject: identity.subject,
        resource: ref,
        facts,
      })
      if (!outcome.applied && outcome.rejection.kind !== 'precondition') return []
      return [{ name, label: ASSIGNMENT_EXTENSION_MODEL.transitions[name].label }]
    }),
  }
}

function extensionFacts(
  assignment: Pick<LoadedAssignment, 'status' | 'plannedEndDate'>,
  regelstand: Regelstand,
  extension: {
    readonly newEndDate: Date
    readonly reason: string
    readonly requestedById: string
    readonly approvedById: string | null
    readonly rejectionReason: string | null
  },
  actingUserId: string | null,
  evaluationDate: Date,
  overrides: Partial<AssignmentExtensionFacts> = {},
): AssignmentExtensionFacts {
  return {
    assignmentStatus: assignment.status as AssignmentState,
    currentEndDate: assignment.plannedEndDate,
    newEndDate: extension.newEndDate,
    reason: extension.reason,
    requestedById: extension.requestedById,
    actingUserId,
    approvedById: extension.approvedById,
    rejectionReason: extension.rejectionReason,
    // P1 an der Verlängerung (Q28, Q30): `newEndDate` gegen das Fristende.
    newEndWithinMaxDuration: regelstand.newEndWithinMaxDuration,
    hasAcceptedValidPermitForNewPeriod: RULE_CHECKS_PENDING.hasAcceptedValidPermitForNewPeriod,
    evaluationDate,
    ...overrides,
  }
}

export interface NewAssignmentInput {
  readonly submissionId: string
  readonly costCenterId: string
  readonly activityDescription: string
  readonly plannedStartDate: Date
  readonly plannedEndDate: Date | null
  readonly weeklyHours: number
  readonly shiftModel: string | null
  readonly agreedRateCardItemId: string
  readonly customerRateCardItemId: string
  readonly comparableWage: number | null
}

/**
 * Legt einen Einsatz aus einem zugesagten Profilvorschlag an (4.3.1, — →
 * `planned`).
 *
 * Das Vergleichsentgelt **erbt** beim Anlegen aus dem Vergleichsentgelt des
 * Standorts zur Tätigkeit (3.3, 3.7); eine Abweichung ist mit Begründung
 * möglich. Geerbt wird hier, eine Abweichung trägt der Aufrufer.
 */
export async function createAssignment(
  identity: LoadedIdentity,
  input: NewAssignmentInput,
  evaluationDate: Date = new Date(),
): Promise<ActionResult> {
  const submission = await prisma.candidateSubmission.findUnique({
    where: { id: input.submissionId },
    include: {
      candidate: { include: { supplier: true } },
      demandRequest: { include: { customer: true, site: true } },
      assignment: true,
    },
  })
  if (submission === null) return failure('Unbekannter Profilvorschlag.')
  if (submission.assignment !== null) {
    return failure('Zu einem Profilvorschlag gehört höchstens ein Einsatz (3.7).')
  }
  if (input.activityDescription.trim() === '') {
    return failure(
      'Die Tätigkeitsbeschreibung des Einsatzes ist Pflicht und **nicht** nur ein Verweis auf die ' +
        'Anfrage (3.7, Konkretisierungspflicht 5.3.3).',
      'SPEC 3.7, assignment.activityDescription',
    )
  }

  const operatorTenant = await prisma.tenant.findFirst({ where: { tenantType: 'operator' } })
  if (operatorTenant === null) return failure('Kein Betreibermandant vorhanden (3.11).')

  const customerTenantId = submission.demandRequest.tenantId
  const supplierTenantId = submission.candidate.tenantId
  const ref = assignmentRef({
    tenantId: operatorTenant.id,
    customerTenantId,
    supplierTenantId,
    siteId: submission.demandRequest.siteId,
    costCenterId: input.costCenterId,
    status: 'planned',
  })

  // Vergleichsentgelt des Standorts zur Tätigkeit (3.3) — der Einsatz erbt den
  // Wert; fehlt er, bleibt das Feld leer und P4 greift am Übergang nach
  // `active` (5.2).
  const wageEntry =
    input.comparableWage === null
      ? await prisma.comparableWageEntry.findFirst({
          where: { siteId: submission.demandRequest.siteId },
          orderBy: { validFrom: 'desc' },
        })
      : null
  const comparableWage: number | string | null =
    input.comparableWage ?? wageEntry?.comparableWage.toString() ?? null

  // K1 aus 5.3.3: der Weg von der Preisposition zum Rahmenvertrag der
  // Lieferantenseite (3.3). Fehlt die Preisposition, ist K1 **nicht prüfbar**
  // und wirkt wie ein Treffer (5.0) — geraten wird nichts.
  const preisposition =
    input.agreedRateCardItemId === ''
      ? null
      : await prisma.rateCardItem.findUnique({
          where: { id: input.agreedRateCardItemId },
          include: { rateCard: { include: { masterAgreement: true } } },
        })

  // P1 und P6 für den Einsatz, der **noch nicht** gespeichert ist: seine
  // vorgesehenen Tage gehen als eigene Zeile in die Kette (5.1.3, Schritt 6).
  const neueZeile: Einsatzzeile = {
    id: '(neuer Einsatz)',
    status: 'planned',
    plannedStartDate: input.plannedStartDate,
    plannedEndDate: input.plannedEndDate,
    actualStartDate: null,
    actualEndDate: null,
    interruptions: [],
  }
  const regelstand = await regelstandFuerEinsatz(neueZeile, dauerbezug(neueZeile), {
    customerId: submission.demandRequest.customerId,
    siteId: submission.demandRequest.siteId,
    supplierId: submission.candidate.supplierId,
    // Der Wert, den der Einsatz **erben** wird: entweder die Eingabe oder der
    // Eintrag des Standorts (3.3, 5.2.4). Er zählt schon für diese Prüfung,
    // weil er mit dem Einsatz gespeichert wird.
    comparableWage,
    workerIdentityId: submission.candidate.workerIdentityId,
    candidateId: submission.candidate.id,
    customer: submission.demandRequest.customer,
    candidate: submission.candidate,
  })

  const facts: AssignmentFacts = {
    submissionStatus: submission.status,
    supplierStatus: submission.candidate.supplier.status,
    activityDescription: input.activityDescription,
    agreedRateCardItemPresent: input.agreedRateCardItemId !== '',
    customerRateCardItemPresent: input.customerRateCardItemId !== '',
    workerIdentityConfirmed: submission.candidate.workerIdentityId !== null,
    plannedStartDate: input.plannedStartDate,
    plannedEndDate: input.plannedEndDate,
    actualStartDate: null,
    actualEndDate: null,
    hasRunningInterruption: false,
    interruptionFrom: null,
    interruptionReason: null,
    interruptionTo: null,
    terminationReason: null,
    terminationRequestedById: null,
    terminationRequestedBySide: null,
    terminationApprovedById: null,
    hasAcceptedValidPermit: RULE_CHECKS_PENDING.hasAcceptedValidPermit,
    mandatoryDocumentsPresent: RULE_CHECKS_PENDING.mandatoryDocumentsPresent,
    noIndustrialActionAtSite: RULE_CHECKS_PENDING.noIndustrialActionAtSite,
    maxDurationExceeded: regelstand.maxDurationExceeded,
    // P8 (5.3.3) am Anlegen: K1 bis K4, nicht K5 — der Einsatz entsteht erst.
    concretizationComplete: konkretisierungsstand({
      einsatz: {
        candidateId: submission.candidateId,
        activityDescription: input.activityDescription,
        siteId: submission.demandRequest.siteId,
        supplierId: submission.candidate.supplierId,
        agreedRateCardItemId:
          input.agreedRateCardItemId === '' ? null : input.agreedRateCardItemId,
        plannedStartDate: input.plannedStartDate,
        plannedEndDate: input.plannedEndDate,
        actualStartDate: null,
        createdAt: evaluationDate,
      },
      rahmenvertrag: alsRahmenvertragszeile(preisposition),
      titelDerAnfrage: submission.demandRequest.title,
      stufe: 'anlage',
    }).concretizationComplete,
    hasPreviousEmploymentDeclaration: hasPreviousEmploymentDeclaration(submission.candidate),
    employmentRelationshipOnFirstDay: employmentOnFirstDay({
      candidate: submission.candidate,
      actualStartDate: null,
      plannedStartDate: input.plannedStartDate,
    }),
    equalPayDueFromFirstDay: regelstand.equalPayDueFromFirstDay,
    comparableWagePresent: comparableWage !== null,
    evaluationDate,
  }

  const outcome = attemptTransition(ASSIGNMENT_MODEL, 'create', {
    currentStatus: null,
    subject: identity.subject,
    resource: ref,
    facts,
  })
  if (!outcome.applied) return rejection(outcome)

  const count = await prisma.assignment.count()
  try {
    await prisma.assignment.create({
      data: {
        tenantId: operatorTenant.id,
        assignmentNumber: `E-2026-${String(count + 1).padStart(4, '0')}`,
        customerId: submission.demandRequest.customerId,
        siteId: submission.demandRequest.siteId,
        costCenterId: input.costCenterId,
        supplierId: submission.candidate.supplierId,
        candidateId: submission.candidateId,
        workerIdentityId: submission.candidate.workerIdentityId,
        demandRequestId: submission.demandRequestId,
        candidateSubmissionId: submission.id,
        activityDescription: input.activityDescription.trim(),
        plannedStartDate: input.plannedStartDate,
        plannedEndDate: input.plannedEndDate,
        weeklyHours: input.weeklyHours,
        shiftModel: input.shiftModel,
        agreedRateCardItemId: input.agreedRateCardItemId,
        customerRateCardItemId: input.customerRateCardItemId,
        currency: 'EUR',
        comparableWage,
        comparableWageCurrency: comparableWage === null ? null : 'EUR',
        status: 'planned',
        createdById: identity.user.id,
        // 5.1.3, „Ergebnisfelder": der Einsatz trägt den Fristenstand seiner
        // Kette von Anfang an — gerechnet mit seinen eigenen vorgesehenen
        // Tagen (Schritt 6), nicht erst beim Start.
        maxDurationEndDate: regelstand.hoechstdauer?.maxDurationEndDate ?? null,
        countedDurationDays: regelstand.hoechstdauer?.countedDurationDays ?? null,
      },
    })
    // Dieselben Werte an den **übrigen** Einsätzen der Kette; der neue trägt
    // sie schon. Die Kennung des neuen Einsatzes stand beim Rechnen noch nicht
    // fest und ist deshalb kein Ziel.
    if (regelstand.hoechstdauer !== null) {
      const ohneNeuen = (kennungen: readonly string[]) =>
        kennungen.filter((kennung) => kennung !== '(neuer Einsatz)')
      await schreibeFristenstand(
        prisma,
        {
          ...regelstand.hoechstdauer,
          chainAssignmentIds: ohneNeuen(regelstand.hoechstdauer.chainAssignmentIds),
        },
        regelstand.equalPay === null
          ? null
          : {
              ...regelstand.equalPay,
              chainAssignmentIds: ohneNeuen(regelstand.equalPay.chainAssignmentIds),
            },
      )
    }
  } catch (error) {
    return asFailure(error, 'Einsatz konnte nicht angelegt werden')
  }
  // Nebenwirkungen aus 4.3.1, die der Prototyp noch nicht hat:
  // Benachrichtigung an `KB`, `KE` und `LD`. `equalPayDueDate` rechnet P3
  // (5.2) und wird mit dem Übergang fortgeschrieben. Die Bedarfsanfrage auf `filled` zu setzen
  // ist ein eigener Übergang (4.1) und bleibt beim Betreiber.
  return success('Einsatz angelegt; Status „planned" (4.3.1).')
}

export interface AssignmentTransitionInput {
  readonly assignmentId: string
  readonly transition: AssignmentTransitionName
  readonly actualStartDate: Date | null
  readonly actualEndDate: Date | null
  readonly interruptionFrom: Date | null
  readonly interruptionReason: string | null
  readonly interruptionTo: Date | null
}

/**
 * Vollzieht einen Übergang am Einsatz (4.3.1) samt der Daten, die er verlangt:
 * `actualStartDate` beim Beginn, die Unterbrechung beim Unterbrechen, ihr Ende
 * beim Fortsetzen, `actualEndDate` beim Beenden.
 *
 * **Die Unterbrechung ist ein eigenes Objekt** (3.7) und entsteht mit dem
 * Übergang, nicht davor: ohne sie gibt es keinen Zeitraum, und 4.3.1 macht sie
 * zur Vorbedingung.
 */
export async function transitionAssignment(
  identity: LoadedIdentity,
  input: AssignmentTransitionInput,
  evaluationDate: Date = new Date(),
): Promise<ActionResult> {
  const assignment = await prisma.assignment.findUnique({
    where: { id: input.assignmentId },
    include: ASSIGNMENT_INCLUDE,
  })
  if (assignment === null) return failure('Unbekannter Einsatz.')

  const status = assignment.status as AssignmentState
  const running = assignment.interruptions.find((entry) => entry.interruptionTo === null)
  const overrides: Partial<AssignmentFacts> = {
    ...(input.actualStartDate !== null ? { actualStartDate: input.actualStartDate } : {}),
    ...(input.actualEndDate !== null ? { actualEndDate: input.actualEndDate } : {}),
    ...(input.transition === 'interrupt'
      ? {
          interruptionFrom: input.interruptionFrom,
          interruptionReason: input.interruptionReason,
        }
      : {}),
    ...(input.transition === 'resume' ? { interruptionTo: input.interruptionTo } : {}),
  }

  // Der Stichtag des Übergangs nach der Tabelle in SPEC 5.0 — nicht der Tag des
  // Aufrufs. Die Zeile des Vorgangs trägt die Daten, die der Übergang mitbringt.
  const zeile: Einsatzzeile = {
    ...alsEinsatzzeile(assignment),
    actualStartDate: input.actualStartDate ?? assignment.actualStartDate,
    actualEndDate: input.actualEndDate ?? assignment.actualEndDate,
  }
  const bezug =
    input.transition === 'start'
      ? { stichtag: input.actualStartDate, zeitraum: null }
      : input.transition === 'interrupt'
        ? { stichtag: input.interruptionFrom, zeitraum: null }
        : input.transition === 'resume'
          ? { stichtag: folgetagVon(input.interruptionTo), zeitraum: null }
          : input.transition === 'complete' || input.transition === 'terminateEarly'
            ? { stichtag: input.actualEndDate, zeitraum: null }
            : dauerbezug(zeile)
  const regelstand = await regelstandFuerEinsatz(zeile, bezug, assignment)

  const outcome = attemptTransition(ASSIGNMENT_MODEL, input.transition, {
    currentStatus: status,
    subject: identity.subject,
    resource: assignmentResource(assignment),
    facts: assignmentFacts(assignment, regelstand, evaluationDate, overrides),
  })
  if (!outcome.applied) return rejection(outcome)

  const data: Record<string, unknown> = { status: outcome.to, updatedById: identity.user.id }
  if (input.transition === 'start') data.actualStartDate = input.actualStartDate
  if (input.transition === 'complete' || input.transition === 'terminateEarly') {
    data.actualEndDate = input.actualEndDate
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.assignment.update({ where: { id: assignment.id }, data })
      if (input.transition === 'interrupt' && input.interruptionFrom !== null) {
        await tx.assignmentInterruption.create({
          data: {
            assignmentId: assignment.id,
            interruptionFrom: input.interruptionFrom,
            reasonCategory: input.interruptionReason ?? '',
            createdById: identity.user.id,
          },
        })
      }
      if (input.transition === 'resume' && running !== undefined) {
        await tx.assignmentInterruption.update({
          where: { id: running.id },
          data: { interruptionTo: input.interruptionTo, updatedById: identity.user.id },
        })
      }
      // 5.1.3, „Ergebnisfelder": `maxDurationEndDate` und
      // `countedDurationDays` werden an **jedem** Einsatz der Kette
      // fortgeschrieben — in derselben Transaktion wie der Übergang, der die
      // Rechengrundlage geändert hat (5.5.1 b).
      await schreibeFristenstand(tx, regelstand.hoechstdauer, regelstand.equalPay)
    })
  } catch (error) {
    return asFailure(error, 'Statuswechsel am Einsatz konnte nicht gespeichert werden')
  }
  // Nebenwirkungen aus 4.3.1: beim Beginn beginnt der Fristenlauf (5.1, 5.2),
  // beim Unterbrechen bewertet P2 die Wirkung auf die Zählung
  // (`countsAsReset`), beim Fortsetzen werden P1 und P2 neu gerechnet. Alle
  // drei stehen aus und sind in Kapitel 5 zu rechnen.
  return success(
    `${outcome.label}: Einsatz steht jetzt auf „${outcome.to}" (${outcome.specReference}).`,
  )
}

export interface TerminationRequestInput {
  readonly assignmentId: string
  /**
   * Der Benutzer, der die Beendigung beantragt — `KB`, `LD` oder `MD` ([25]).
   * Seine Organisation entscheidet, ob eine Genehmigung der Kundenseite nötig
   * ist (4.3.1).
   */
  readonly requestedByUserId: string
  readonly reason: string
  /**
   * Der Genehmiger der Kundenseite ([26]) — **nur** bei Antrag der
   * Kundenseite. 3.7 führt für diese Genehmigung **kein** Feld; das Schema
   * trägt sie als `terminationApprovedAt` / `terminationApprovedById` nach,
   * weil 4.3.1 sie zur Vorbedingung macht. Siehe *offene Frage 39*.
   */
  readonly approvedByUserId: string | null
}

/**
 * Hält den **Antrag** auf vorzeitige Beendigung am Einsatz fest (3.7).
 *
 * Er hat nach 4.3.1 **keinen eigenen Zustand**: der Einsatz läuft weiter, und
 * erst die Wirksamkeit führt nach `terminatedEarly`. Festgehalten wird er
 * deshalb als Feldsatz — und zwar durch den Betreiber: die Matrix gibt `KB` und
 * `LD` auf dieser Zeile `L` und `S[25]`, aber **kein** `Ä`, und 4.3.1 kennt für
 * den Antrag keinen Übergang. Dass damit kein Weg bleibt, auf dem die
 * beantragende Seite ihren Antrag selbst erfasst, ist die Lücke, die 4.3.2 am
 * Ende benennt; sie steht als *offene Frage 39* in SPEC Kapitel 7. Der Prototyp
 * lässt den Antrag deshalb über den Betreiber laufen und hält die beantragende
 * Seite ausdrücklich fest.
 */
export async function recordTerminationRequest(
  identity: LoadedIdentity,
  input: TerminationRequestInput,
): Promise<ActionResult> {
  const assignment = await prisma.assignment.findUnique({
    where: { id: input.assignmentId },
    include: ASSIGNMENT_INCLUDE,
  })
  if (assignment === null) return failure('Unbekannter Einsatz.')
  if (input.reason.trim() === '') {
    return failure('Der Beendigungsgrund ist Pflicht (3.7).', 'SPEC 3.7')
  }

  const requester = await prisma.user.findUnique({
    where: { id: input.requestedByUserId },
    include: { tenant: true, roleAssignments: true },
  })
  if (requester === null) return failure('Unbekannter Antragsteller.')
  const side = terminationSide({ terminationRequestedBy: requester })
  if (side === null) return failure('Der Antragsteller gehört zu keiner der drei Organisationen.')

  const decision = checkPermission(identity.subject, 'update', assignmentResource(assignment))
  if (!decision.allowed) {
    return failure(decision.denial.reason, decision.denial.specReference)
  }
  if (side === 'customer' && input.approvedByUserId === null) {
    return failure(
      'Ein Antrag der Kundenseite ist genehmigungspflichtig durch `KG` ([26], 4.3.1); ohne ' +
        'Genehmigung wird die Beendigung nicht wirksam.',
      'SPEC 4.3.1, Zuweisung der Genehmigung',
    )
  }

  try {
    await prisma.assignment.update({
      where: { id: assignment.id },
      data: {
        terminationReason: input.reason.trim(),
        terminationRequestedById: requester.id,
        terminationRequestedAt: new Date(),
        ...(side === 'customer' && input.approvedByUserId !== null
          ? { terminationApprovedAt: new Date(), terminationApprovedById: input.approvedByUserId }
          : {}),
        updatedById: identity.user.id,
      },
    })
  } catch (error) {
    return asFailure(error, 'Antrag auf vorzeitige Beendigung konnte nicht gespeichert werden')
  }
  return success(
    `Antrag auf vorzeitige Beendigung festgehalten (Antragsteller: ${side}). Der Einsatz läuft ` +
      'unverändert weiter — ein unentschiedener Vorgang bewirkt nichts (4.3.1).',
  )
}

// ── Verlängerung (3.7, Statusmodell 4.3.2) ─────────────────────────────────

export interface NewExtensionInput {
  readonly assignmentId: string
  readonly newEndDate: Date
  readonly reason: string
}

export async function requestExtension(
  identity: LoadedIdentity,
  input: NewExtensionInput,
  evaluationDate: Date = new Date(),
): Promise<ActionResult> {
  const assignment = await prisma.assignment.findUnique({
    where: { id: input.assignmentId },
    include: ASSIGNMENT_INCLUDE,
  })
  if (assignment === null) return failure('Unbekannter Einsatz.')

  const ref = assignmentSubObjectRef(
    {
      tenantId: assignment.tenantId,
      customerTenantId: assignment.customer.tenantId,
      supplierTenantId: assignment.supplier.tenantId,
      siteId: assignment.siteId,
      costCenterId: assignment.costCenterId,
    },
    'requested',
  )
  const outcome = attemptTransition(ASSIGNMENT_EXTENSION_MODEL, 'request', {
    currentStatus: null,
    subject: identity.subject,
    resource: ref,
    facts: extensionFacts(
      assignment,
      await regelstandFuerVerlaengerung(assignment, input.newEndDate),
      {
        newEndDate: input.newEndDate,
        reason: input.reason,
        requestedById: identity.user.id,
        approvedById: null,
        rejectionReason: null,
      },
      identity.user.id,
      evaluationDate,
    ),
  })
  if (!outcome.applied) return rejection(outcome)

  try {
    await prisma.assignmentExtension.create({
      data: {
        assignmentId: assignment.id,
        newEndDate: input.newEndDate,
        reason: input.reason.trim(),
        requestedAt: evaluationDate,
        requestedById: identity.user.id,
        status: 'requested',
        createdById: identity.user.id,
      },
    })
  } catch (error) {
    return asFailure(error, 'Verlängerung konnte nicht beantragt werden')
  }
  // Nebenwirkungen aus 4.3.2: Benachrichtigung an `KG`,
  // `extensionApprovalDeadlineDays` beginnt, und P1 und P3 stehen als
  // `ruleCheckResult` am Vorgang — beide rechnet Kapitel 5.
  return success('Verlängerung beantragt; sie wird von der Kundenseite genehmigt (4.3.2).')
}

export interface ExtensionTransitionInput {
  readonly extensionId: string
  readonly transition: AssignmentExtensionTransitionName
  readonly rejectionReason: string | null
}

/**
 * Vollzieht einen Übergang an der Verlängerung (4.3.2). `makeEffective`
 * verschiebt `plannedEndDate` des Einsatzes — **in derselben Transaktion**,
 * weil 4.3.2 beides als einen Vorgang führt und eine stille Verschiebung ohne
 * wirksamen Vorgang unzulässig wäre (3.7).
 */
export async function transitionExtension(
  identity: LoadedIdentity,
  input: ExtensionTransitionInput,
  evaluationDate: Date = new Date(),
): Promise<ActionResult> {
  const extension = await prisma.assignmentExtension.findUnique({
    where: { id: input.extensionId },
    include: { assignment: { include: ASSIGNMENT_INCLUDE } },
  })
  if (extension === null) return failure('Unbekannte Verlängerung.')

  const assignment = extension.assignment
  const status = extension.status as AssignmentExtensionState
  const reason = input.rejectionReason?.trim() === '' ? null : (input.rejectionReason ?? null)
  const ref = assignmentSubObjectRef(
    {
      tenantId: assignment.tenantId,
      customerTenantId: assignment.customer.tenantId,
      supplierTenantId: assignment.supplier.tenantId,
      siteId: assignment.siteId,
      costCenterId: assignment.costCenterId,
    },
    status,
  )

  const outcome = attemptTransition(ASSIGNMENT_EXTENSION_MODEL, input.transition, {
    currentStatus: status,
    subject: identity.subject,
    resource: ref,
    facts: extensionFacts(
      assignment,
      await regelstandFuerVerlaengerung(assignment, extension.newEndDate),
      {
        newEndDate: extension.newEndDate,
        reason: extension.reason,
        requestedById: extension.requestedById,
        approvedById: extension.approvedById,
        rejectionReason: reason,
      },
      identity.user.id,
      evaluationDate,
    ),
  })
  if (!outcome.applied) return rejection(outcome)

  const data: Record<string, unknown> = { status: outcome.to, updatedById: identity.user.id }
  if (input.transition === 'approve') {
    data.approvedAt = evaluationDate
    data.approvedById = identity.user.id
  }
  if (input.transition === 'reject') data.rejectionReason = reason
  if (input.transition === 'withdraw') data.withdrawnAt = evaluationDate
  if (input.transition === 'makeEffective') {
    data.effectiveAt = evaluationDate
    data.effectiveById = identity.user.id
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.assignmentExtension.update({ where: { id: extension.id }, data })
      if (input.transition === 'makeEffective') {
        // 4.3.2: `plannedEndDate` wird verschoben; der Einsatz bleibt in
        // seinem Zustand — „verlängert" ist **kein** Zustand (4.3.1).
        await tx.assignment.update({
          where: { id: assignment.id },
          data: { plannedEndDate: extension.newEndDate, updatedById: identity.user.id },
        })
        // Das neue Ende ist Rechengrundlage: `maxDurationEndDate` und
        // `countedDurationDays` werden mit ihm neu abgeleitet (5.1, 5.5.1 b).
        // `equalPayDueDate` folgt mit P3 (5.2) und bleibt bis dahin leer.
        const nachVerlaengerung = await regelstandFuerEinsatz(
          { ...alsEinsatzzeile(assignment), plannedEndDate: extension.newEndDate },
          dauerbezug({ ...assignment, plannedEndDate: extension.newEndDate }),
          assignment,
        )
        await schreibeFristenstand(tx, nachVerlaengerung.hoechstdauer, nachVerlaengerung.equalPay)
      }
    })
  } catch (error) {
    return asFailure(error, 'Statuswechsel an der Verlängerung konnte nicht gespeichert werden')
  }
  return success(
    `${outcome.label}: Verlängerung steht jetzt auf „${outcome.to}" (${outcome.specReference}).` +
      (input.transition === 'makeEffective'
        ? ' Das geplante Ende des Einsatzes ist verschoben; der Einsatz bleibt in seinem Zustand (4.3.1).'
        : ''),
  )
}

// ── Auswahllisten für die Oberfläche ───────────────────────────────────────

export interface StaffingFormOptions {
  readonly ownOffers: readonly { readonly id: string; readonly label: string }[]
  readonly ownCandidates: readonly { readonly id: string; readonly label: string }[]
  /**
   * Mögliche Antragsteller einer vorzeitigen Beendigung: `KB`, `LD` oder `MD`
   * ([25]). Der Betreiber hält den Antrag fest und benennt dabei die Person,
   * die ihn gestellt hat — siehe `recordTerminationRequest` und *offene
   * Frage 39*.
   */
  readonly terminationRequesters: readonly { readonly id: string; readonly label: string }[]
  /** Genehmiger der Kundenseite (`KG`, [26]). */
  readonly approvers: readonly { readonly id: string; readonly label: string }[]
  readonly acceptedSubmissions: readonly {
    readonly id: string
    readonly label: string
    readonly costCenters: readonly { readonly id: string; readonly label: string }[]
    readonly supplierRateCardItems: readonly { readonly id: string; readonly label: string }[]
    readonly customerRateCardItems: readonly { readonly id: string; readonly label: string }[]
  }[]
}

/**
 * Die Auswahlmöglichkeiten der Formulare — jede aus der Sicht der Identität:
 * ein Lieferant sieht nur eigene Angebote und Kandidaten (2.3), der Betreiber
 * die zugesagten Vorschläge mit den Preispositionen beider Seiten.
 */
export async function loadStaffingFormOptions(
  identity: LoadedIdentity,
): Promise<StaffingFormOptions> {
  const isSupplier = identity.tenant.tenantType === 'supplier'
  const isOperator = identity.tenant.tenantType === 'operator'

  const ownOffers = isSupplier
    ? (
        await prisma.supplierOffer.findMany({
          where: { tenantId: identity.tenant.id, status: { in: ['submitted', 'reviewed'] } },
          include: { tenderInvitation: { include: { tender: { include: { demandRequest: true } } } } },
          orderBy: { offerNumber: 'asc' },
        })
      ).map((offer) => ({
        id: offer.id,
        label: `${offer.offerNumber} — ${offer.tenderInvitation.tender.demandRequest.requestNumber} ${offer.tenderInvitation.tender.demandRequest.title}`,
      }))
    : []

  const ownCandidates = isSupplier
    ? (
        await prisma.candidate.findMany({
          where: { tenantId: identity.tenant.id, status: 'active' },
          orderBy: { candidateNumber: 'asc' },
        })
      ).map((candidate) => ({
        id: candidate.id,
        label: `${candidate.candidateNumber} — ${candidate.givenName} ${candidate.familyName} (${candidate.pseudonym})`,
      }))
    : []

  const acceptedSubmissions = isOperator
    ? await Promise.all(
        (
          await prisma.candidateSubmission.findMany({
            where: { status: 'accepted', assignment: null },
            include: {
              candidate: { include: { supplier: true } },
              demandRequest: { include: { customer: true, site: true } },
            },
            orderBy: { submissionNumber: 'asc' },
          })
        ).map(async (submission) => {
          const costCenters = await prisma.costCenter.findMany({
            where: { customerId: submission.demandRequest.customerId },
            orderBy: { costCenterNumber: 'asc' },
          })
          // Die Preisliste hängt am Rahmenvertrag (3.3), und erst der benennt
          // Kunde oder Lieferant — deshalb der Weg über `masterAgreement`.
          const supplierItems = await prisma.rateCardItem.findMany({
            where: {
              rateCard: {
                rateCardScope: 'supplierRateCard',
                masterAgreement: { supplierId: submission.candidate.supplierId },
              },
            },
          })
          const customerItems = await prisma.rateCardItem.findMany({
            where: {
              rateCard: {
                rateCardScope: 'customerRateCard',
                masterAgreement: { customerId: submission.demandRequest.customerId },
              },
            },
          })
          return {
            id: submission.id,
            label: `${submission.submissionNumber} — ${submission.candidate.pseudonym} für ${submission.demandRequest.requestNumber} (${submission.demandRequest.customer.legalName}, ${submission.demandRequest.site.name})`,
            costCenters: costCenters.map((costCenter) => ({
              id: costCenter.id,
              label: `${costCenter.costCenterNumber} ${costCenter.name}`,
            })),
            supplierRateCardItems: supplierItems.map((item) => ({
              id: item.id,
              label: `${item.qualificationLevel ?? item.itemType} ${item.hourlyRate?.toString() ?? ''} (Einkauf)`,
            })),
            customerRateCardItems: customerItems.map((item) => ({
              id: item.id,
              label: `${item.qualificationLevel ?? item.itemType} ${item.hourlyRate?.toString() ?? ''} (Verkauf)`,
            })),
          }
        }),
      )
    : []

  const describeUser = (user: {
    readonly id: string
    readonly givenName: string
    readonly familyName: string
    readonly tenant: { readonly displayName: string }
    readonly roleAssignments: readonly { readonly roleCode: string }[]
  }): { readonly id: string; readonly label: string } => ({
    id: user.id,
    label: `${user.givenName} ${user.familyName} — ${user.tenant.displayName} (${user.roleAssignments
      .map((assignment) => assignment.roleCode)
      .join(', ')})`,
  })

  const terminationRequesters = isOperator
    ? (
        await prisma.user.findMany({
          where: {
            roleAssignments: {
              some: {
                roleCode: { in: ['demandOwner', 'supplierCoordinator', 'operatorCoordinator'] },
              },
            },
          },
          include: { tenant: true, roleAssignments: true },
          orderBy: { userNumber: 'asc' },
        })
      ).map(describeUser)
    : []

  const approvers = isOperator
    ? (
        await prisma.user.findMany({
          where: { roleAssignments: { some: { roleCode: 'approver' } } },
          include: { tenant: true, roleAssignments: true },
          orderBy: { userNumber: 'asc' },
        })
      ).map(describeUser)
    : []

  return { ownOffers, ownCandidates, terminationRequesters, approvers, acceptedSubmissions }
}

function rejection(outcome: TransitionOutcome<string>): ActionResult {
  if (outcome.applied) return success('')
  return failure(outcome.rejection.reason, outcome.rejection.specReference)
}

/**
 * Die Nahtstelle zu Kapitel 5, ausdrücklich lesbar: welche Prüfergebnisse
 * dieses Modul **nicht** rechnet. Für Tests und für die Arbeitseinheit, die P1,
 * P6 und P11 anbindet.
 */
export const PENDING_RULE_CHECKS = RULE_CHECKS_PENDING
