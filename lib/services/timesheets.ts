/**
 * Fachdienst Zeiterfassung — SPEC **3.8** (Objekte) und **4.4** (Statusmodell),
 * dazu die Abrechnungsperiode aus 3.9, soweit 4.4 sie braucht.
 *
 * Hier laufen die fünf Querschnittszeilen zusammen, die 4.7 dem Stundenzettel
 * zuordnet: **Q33** (P1 beim Einreichen), **Q34** (P3 beim Eröffnen der
 * Freigabe), **Q35** (P1 bei der Genehmigung, Warnung mit Pflicht-Eskalation),
 * **Q36** (P4 bei der Genehmigung, **Sperre**) und **Q37** (P10
 * Unterweisungsnachweis, Warnung).
 *
 * **Der Prüfzeitraum ist `periodFrom` bis `periodTo` des Zettels** — 5.0 führt
 * dafür eine eigene Zeile („Stundenzettel (alle Übergänge)"). Nicht der Tag des
 * Aufrufs: ein Zettel für den Oktober wird im November genehmigt, und geprüft
 * wird der Oktober.
 *
 * **P1 und P3 werden nicht neu gerechnet, sondern gelesen.** `maxDurationEndDate`
 * und `equalPayDueDate` stehen nach 5.1.3 und 5.2.3 am Einsatz und werden dort
 * an jedem Übergang fortgeschrieben. Sie hier ein zweites Mal aus der
 * Überlassungskette zu rechnen wäre eine zweite Fassung derselben Regel — und
 * eine der beiden wäre falsch. Gerechnet wird hier nur, was der Zettel selbst
 * hergibt: ob Positionen **nach** dem Fristende liegen und ob die
 * Equal-Pay-Fälligkeit **in** den Zettelzeitraum fällt.
 *
 * **Jede Freigabestufe kommt aus der Konfiguration des Kunden** (3.1,
 * Entscheidung zu *Frage 5*). Fehlt sie, gilt die Vorbelegung aus 4.4:
 * Kundenseite (`KB`), dann Betreiber (`MD`). Das Rollenkürzel wird beim
 * Einreichen in den Freigabeschritt **kopiert** — eine spätere Änderung der
 * Konfiguration darf einen laufenden Zettel nicht umhängen (3.8).
 */
import { alsNachweiszeile, nachweisstand } from '../aueg/anbindung'
import { schreibEintrag } from '../audit/entry'
import { protokolliere, protokolliereGetrennt } from '../audit/record'
import { ablehnungsEintrag, uebergangsEintrag } from '../audit/transitions'
import { checkPermission } from '../authz/check'
import type { RoleCode } from '../authz/roles'
import type { LoadedIdentity } from '../identity/loadSubject'
import {
  abschnittsdauerInMinuten,
  erfassungsform,
  pruefeZeitposition,
  pruefeZeitpositionen,
  type Erfassungsform,
} from '../masterdata/invariants'
import { prisma } from '../prisma'
import { attemptTransition, type TransitionOutcome } from '../status/machine'
import {
  TIMESHEET_MODEL,
  TIMESHEET_STATE_LABELS,
  type TimesheetFacts,
  type TimesheetState,
  type TimesheetTransitionName,
} from '../status/timesheet'
import { zuschlaegeDerPosition, type Zuschlagsart } from '../timetracking/premiums'
import {
  asFailure,
  billingPeriodRef,
  failure,
  protokollbezug,
  success,
  timeEntryRef,
  timesheetRef,
  verweigere,
  type ActionResult,
} from './common'

/* ------------------------------------------------------------------ */
/* Die Vorbelegung der Stufenfolge (4.4)                               */
/* ------------------------------------------------------------------ */

/**
 * Vorbelegung der Freigabestufen, wenn der Kunde keine eigene Folge pflegt
 * (3.1, 4.4): zuerst die **Kundenseite**, dann der **Betreiber**.
 *
 * Welche Kundenrolle die erste Stufe trägt, ist *offene Frage 47*. Hier steht
 * `demandOwner` (`KB`), weil die erste Stufe die **Leistung** bestätigt und
 * nicht das Budget — er hat die Person angefordert und führt sie fachlich. Die
 * zweite Stufe trägt `operatorCoordinator` (`MD`): die kaufmännische Prüfung
 * vor der Belegerstellung (4.5).
 */
export const VORBELEGTE_STUFENFOLGE: readonly RoleCode[] = ['demandOwner', 'operatorCoordinator']

/** Gehört diese Rolle der Kundenseite? Grundlage der Mindest-Kundenstufe (4.4). */
function istKundenrolle(roleCode: RoleCode): boolean {
  return roleCode === 'demandOwner' || roleCode === 'approver' || roleCode === 'procurementController'
}

/* ------------------------------------------------------------------ */
/* Laden                                                              */
/* ------------------------------------------------------------------ */

const TIMESHEET_INCLUDE = {
  assignment: {
    include: {
      customer: { select: { tenantId: true, id: true, legalName: true } },
      supplier: { select: { tenantId: true, legalName: true } },
      site: { select: { id: true, name: true, safetyBriefingRequired: true } },
      candidate: { select: { pseudonym: true } },
      interruptions: true,
      documents: true,
    },
  },
  billingPeriod: true,
  entries: { include: { premiums: true }, orderBy: { workDate: 'asc' } },
  approvals: { orderBy: { level: 'asc' } },
  recordedBy: { select: { givenName: true, familyName: true } },
} as const

type LoadedTimesheet = Awaited<
  ReturnType<typeof prisma.timesheet.findMany<{ include: typeof TIMESHEET_INCLUDE }>>
>[number]

/** Ein Befund aus Kapitel 5 zu diesem Zettel, in Worten (4.7). */
export interface TimesheetFinding {
  readonly check: 'P1' | 'P3' | 'P4' | 'P10'
  readonly row: 'Q33' | 'Q34' | 'Q35' | 'Q36' | 'Q37'
  readonly satisfied: boolean
  /** `Sperre`, `Warnung` oder `Information` (5.5). */
  readonly effect: 'Sperre' | 'Warnung' | 'Information'
  readonly message: string
}

export interface TimeEntryView {
  readonly id: string
  readonly workDate: string
  readonly form: Erfassungsform
  readonly startTime: string | null
  readonly endTime: string | null
  readonly breakMinutes: number | null
  readonly hours: number
  readonly premiums: readonly {
    readonly code: string
    readonly hours: number
    readonly origin: 'derived' | 'declared'
  }[]
  readonly note: string | null
  /** Beanstandungen der Invarianten aus 3.8, in Worten. */
  readonly violations: readonly string[]
}

export interface ApprovalView {
  readonly level: number
  readonly roleCode: RoleCode
  readonly side: 'customer' | 'operator'
  readonly decision: 'approved' | 'rejected' | null
  readonly decidedAt: string | null
  readonly comment: string | null
}

export interface TimesheetView {
  readonly id: string
  readonly timesheetNumber: string
  readonly status: TimesheetState
  readonly statusLabel: string
  readonly assignmentNumber: string
  readonly candidate: string
  readonly customer: string
  readonly supplier: string
  readonly period: string
  readonly periodNumber: string
  readonly periodStatus: 'open' | 'closed'
  readonly recordedBy: string
  readonly totalHours: number
  readonly totalPremiumHours: readonly { readonly code: string; readonly hours: number }[]
  readonly entries: readonly TimeEntryView[]
  readonly approvals: readonly ApprovalView[]
  readonly findings: readonly TimesheetFinding[]
  readonly availableTransitions: readonly { readonly name: TimesheetTransitionName; readonly label: string }[]
  readonly crossTenant: boolean
  readonly isCorrectionOf: string | null
}

/** Die Zuschlagsarten des Katalogs, in der Fassung, die die Ableitung braucht. */
async function katalog(evaluationDate: Date): Promise<readonly Zuschlagsart[]> {
  const arten = await prisma.premiumType.findMany({
    where: {
      deactivatedAt: null,
      validFrom: { lte: evaluationDate },
      OR: [{ validTo: null }, { validTo: { gte: evaluationDate } }],
    },
    orderBy: { code: 'asc' },
  })
  return arten.map((art) => ({
    id: art.id,
    code: art.code,
    derivationBasis: art.derivationBasis,
    fromMinute: art.fromMinute,
    toMinute: art.toMinute,
    weekdays: art.weekdays,
  }))
}

/**
 * Die Stundenzettel in der sichtbaren Fassung.
 *
 * Geladen werden alle und danach einzeln geprüft — dieselbe Begründung wie bei
 * den Nachweisen (3.10): die Grenze hängt an Mandant, Beauftragung und
 * Stufenzuweisung, und das steht in der Prüffunktion, nicht in einer
 * `where`-Klausel.
 */
export async function loadTimesheets(
  identity: LoadedIdentity,
  evaluationDate: Date = new Date(),
): Promise<readonly TimesheetView[]> {
  const rows = await prisma.timesheet.findMany({
    include: TIMESHEET_INCLUDE,
    orderBy: { timesheetNumber: 'asc' },
  })
  const arten = await katalog(evaluationDate)

  const views: TimesheetView[] = []
  for (const row of rows) {
    const decision = checkPermission(identity.subject, 'read', refFor(row))
    if (!decision.allowed) continue
    // Die Befunde der **Zeile**, die als Nächstes greift (4.7): beim erfassten
    // Zettel Q33, beim Zettel in Prüfung Q35 samt Q36 und Q37. So sagt die
    // Liste, was eine Genehmigung sperren würde, bevor jemand es versucht
    // (5.4.6).
    const zeile = row.status === 'inApproval' ? 'Q35' : row.status === 'recorded' ? 'Q33' : null
    const findings = zeile === null ? [] : await befunde(row, zeile)
    views.push(asView(row, identity, arten, decision.crossTenant, findings))
  }
  return views
}

function offeneStufe(row: LoadedTimesheet): { level: number; roleCode: RoleCode } | null {
  const offen = row.approvals.find((approval) => approval.decision === null)
  return offen === undefined ? null : { level: offen.level, roleCode: offen.assignedRoleCode }
}

function refFor(row: LoadedTimesheet) {
  const stufe = offeneStufe(row)
  return timesheetRef({
    tenantId: row.tenantId,
    customerTenantId: row.assignment.customer.tenantId,
    supplierTenantId: row.assignment.supplier.tenantId,
    status: row.status,
    recordedById: row.recordedById,
    submittedById: row.submittedById,
    openApprovalRoleCode: stufe?.roleCode ?? null,
    siteId: row.assignment.siteId,
    costCenterId: row.assignment.costCenterId,
  })
}

function asView(
  row: LoadedTimesheet,
  identity: LoadedIdentity,
  arten: readonly Zuschlagsart[],
  crossTenant: boolean,
  findings: readonly TimesheetFinding[],
): TimesheetView {
  const status = row.status as TimesheetState
  const entries = row.entries.map((entry) => entryView(entry, arten))
  const zuschlagssummen = new Map<string, number>()
  for (const entry of entries) {
    for (const premium of entry.premiums) {
      zuschlagssummen.set(premium.code, (zuschlagssummen.get(premium.code) ?? 0) + premium.hours)
    }
  }

  return {
    id: row.id,
    timesheetNumber: row.timesheetNumber,
    status,
    statusLabel: TIMESHEET_STATE_LABELS[status],
    assignmentNumber: row.assignment.assignmentNumber,
    candidate: row.assignment.candidate.pseudonym,
    customer: row.assignment.customer.legalName,
    supplier: row.assignment.supplier.legalName,
    period: `${tag(row.periodFrom)} bis ${tag(row.periodTo)}`,
    periodNumber: row.billingPeriod.periodNumber,
    periodStatus: row.billingPeriod.status,
    recordedBy: `${row.recordedBy.givenName} ${row.recordedBy.familyName}`,
    totalHours: entries.reduce((summe, entry) => summe + entry.hours, 0),
    totalPremiumHours: [...zuschlagssummen.entries()]
      .map(([code, hours]) => ({ code, hours }))
      .sort((a, b) => a.code.localeCompare(b.code)),
    entries,
    approvals: row.approvals.map((approval) => ({
      level: approval.level,
      roleCode: approval.assignedRoleCode,
      side: istKundenrolle(approval.assignedRoleCode) ? 'customer' : 'operator',
      decision: approval.decision,
      decidedAt: approval.decidedAt === null ? null : tag(approval.decidedAt),
      comment: approval.comment,
    })),
    findings,
    availableTransitions: offeneUebergaenge(row, identity),
    crossTenant,
    isCorrectionOf: row.correctionOfId,
  }
}

function entryView(
  entry: LoadedTimesheet['entries'][number],
  arten: readonly Zuschlagsart[],
): TimeEntryView {
  const position = {
    workDate: entry.workDate,
    startMinute: entry.startMinute,
    endMinute: entry.endMinute,
    breakMinutes: entry.breakMinutes,
    hours: Number(entry.hours),
  }
  // Gespeicherte Zuschläge **und** die Herkunft, die ihre Art hergibt: die
  // Liste zeigt, was gerechnet und was angegeben wurde (3.8).
  const gespeichert = entry.premiums.map((premium) => ({
    premiumTypeId: premium.premiumTypeId,
    hours: Number(premium.hours),
    origin: premium.origin,
  }))
  const nachCode = new Map(arten.map((art) => [art.id, art.code]))
  return {
    id: entry.id,
    workDate: tag(entry.workDate),
    form: erfassungsform(position),
    startTime: entry.startMinute === null ? null : uhrzeit(entry.startMinute),
    endTime: entry.endMinute === null ? null : uhrzeit(entry.endMinute),
    breakMinutes: entry.breakMinutes,
    hours: position.hours,
    premiums: gespeichert.map((premium) => ({
      code: nachCode.get(premium.premiumTypeId) ?? premium.premiumTypeId,
      hours: premium.hours,
      origin: premium.origin,
    })),
    note: entry.note,
    violations: pruefeZeitposition(position).map(
      (verletzung) => `${verletzung.feld}: ${verletzung.grund}`,
    ),
  }
}

/**
 * Die Übergänge, die die Oberfläche anbietet.
 *
 * Gefiltert wird nach Zustand, Rolle und **Recht** — nicht nach
 * Vorbedingungen: eine fehlende Vorbedingung ist behebbar, und die Seite soll
 * sagen, was fehlt, statt den Weg zu verstecken (5.4.6). Systemübergänge
 * (`openApproval`, `markCorrected`) stehen nicht in der Liste: sie haben keine
 * auslösende Rolle (4.0, Regel 10).
 *
 * **Zwei Vorbedingungen filtern trotzdem mit**, weil keine Eingabe sie heilt —
 * dieselbe Überlegung wie beim Lieferantenstatus (4.6): die offene Stufe muss
 * der handelnden Person zugewiesen sein, und wer erfasst oder eingereicht hat,
 * entscheidet keine Stufe (2.4, Regel 5). Für `KB` und `KG` prüft das schon
 * Fußnote [29]; die Zelle des `MD` trägt in 2.2 dagegen ein `S` **ohne**
 * Fußnote — dort hinge der Filter sonst allein an der Vorbedingung, und die
 * Seite würde einen Knopf anbieten, der nie trägt.
 */
function offeneUebergaenge(
  row: LoadedTimesheet,
  identity: LoadedIdentity,
): readonly { readonly name: TimesheetTransitionName; readonly label: string }[] {
  const status = row.status as TimesheetState
  const ref = refFor(row)
  const angeboten: { name: TimesheetTransitionName; label: string }[] = []

  const stufe = offeneStufe(row)
  const eigeneRollen = identity.subject.grants.map((zuweisung) => zuweisung.roleCode)
  const entscheidetStufe =
    stufe !== null &&
    eigeneRollen.includes(stufe.roleCode) &&
    identity.user.id !== row.recordedById &&
    identity.user.id !== row.submittedById

  for (const [name, definition] of Object.entries(TIMESHEET_MODEL.transitions)) {
    if (definition.roles.length === 0) continue
    const ausZustaenden: readonly string[] = definition.from
    if (!ausZustaenden.includes(status)) continue
    const traegt = identity.subject.grants.some((zuweisung) =>
      (definition.roles as readonly RoleCode[]).includes(zuweisung.roleCode),
    )
    if (!traegt) continue
    const stufenentscheidung =
      name === 'approve' || name === 'approveStage' || name === 'reject'
    if (stufenentscheidung && !entscheidetStufe) continue
    const entscheidung = checkPermission(identity.subject, 'transition', {
      ...ref,
      targetStatus: definition.to,
    })
    if (!entscheidung.allowed) continue
    angeboten.push({ name: name as TimesheetTransitionName, label: definition.label })
  }
  return angeboten
}

function tag(wert: Date): string {
  return wert.toISOString().slice(0, 10)
}

function uhrzeit(minuten: number): string {
  const stunde = Math.floor(minuten / 60)
  const minute = minuten % 60
  return `${String(stunde).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
}

/* ------------------------------------------------------------------ */
/* Die Befunde aus Kapitel 5 (4.7, Q33 bis Q37)                        */
/* ------------------------------------------------------------------ */

/**
 * Die Prüfungen, die 4.7 dem jeweiligen Übergang zuordnet.
 *
 * **Der Prüfzeitraum ist der Zettelzeitraum** (5.0). Gerechnet wird gegen die
 * **Ergebnisfelder** am Einsatz (`maxDurationEndDate`, `equalPayDueDate`): sie
 * stehen dort nach 5.1.3 und 5.2.3 und werden an den Übergängen des Einsatzes
 * fortgeschrieben. Eine zweite Rechnung aus der Überlassungskette wäre eine
 * zweite Fassung derselben Regel.
 */
async function befunde(
  row: LoadedTimesheet,
  qZeile: 'Q33' | 'Q34' | 'Q35',
): Promise<readonly TimesheetFinding[]> {
  const liste: TimesheetFinding[] = []
  const einsatz = row.assignment

  // ── P1 (Q33 beim Einreichen, Q35 bei der Genehmigung) ──────────────────
  if (qZeile === 'Q33' || qZeile === 'Q35') {
    const fristende = einsatz.maxDurationEndDate
    const danach =
      fristende === null
        ? []
        : row.entries.filter((entry) => entry.workDate > fristende).map((entry) => tag(entry.workDate))
    liste.push({
      check: 'P1',
      row: qZeile,
      satisfied: danach.length === 0,
      // Q35 ist nach 5.5.5 **geändert**: eine Warnung mit Pflicht-Eskalation,
      // keine Sperre. Erbrachte Zeiten werden genehmigt — gesperrt wird eine
      // Handlung, nicht eine Feststellung.
      effect: 'Warnung',
      message:
        fristende === null
          ? 'P1: am Einsatz steht kein Fristende der Höchstüberlassungsdauer (5.1.3) — ' +
            'nichts zu prüfen.'
          : danach.length === 0
            ? `P1: alle Zeiten liegen vor dem Fristende ${tag(fristende)} (5.1).`
            : `P1: ${danach.length} Zeitposition(en) liegen **nach** dem Fristende ` +
              `${tag(fristende)} (${danach.join(', ')}). ` +
              (qZeile === 'Q35'
                ? 'Die Genehmigung ist dadurch nicht gesperrt (5.5.5, Q35): die Zeiten sind ' +
                  'erbracht. Pflicht-Eskalation an MA.'
                : 'Q33 trägt hier eine Warnung.'),
    })
  }

  // ── P3 (Q34 beim Eröffnen der Freigabe) ───────────────────────────────
  if (qZeile === 'Q34') {
    const faelligkeit = einsatz.equalPayDueDate
    const imZeitraum =
      faelligkeit !== null && faelligkeit >= row.periodFrom && faelligkeit <= row.periodTo
    liste.push({
      check: 'P3',
      row: 'Q34',
      satisfied: !imZeitraum,
      effect: 'Warnung',
      message:
        faelligkeit === null
          ? 'P3: am Einsatz steht keine Equal-Pay-Fälligkeit (5.2.3) — nichts zu prüfen.'
          : imZeitraum
            ? `P3: die Equal-Pay-Fälligkeit ${tag(faelligkeit)} fällt in diesen Zettelzeitraum ` +
              '(5.2). Ab ihr ist das Entgelt des Entleihers geschuldet.'
            : `P3: die Equal-Pay-Fälligkeit ${tag(faelligkeit)} liegt außerhalb dieses ` +
              'Zettelzeitraums (5.2).',
    })
  }

  // ── P4 und P10 (Q36 und Q37 bei der Genehmigung) ──────────────────────
  if (qZeile === 'Q35') {
    const stand = await vergleichsentgeltstand(row)
    liste.push({
      check: 'P4',
      row: 'Q36',
      satisfied: stand.usable,
      // Die **einzige** Sperre an diesem Übergang (4.7, Q36).
      effect: 'Sperre',
      message: stand.message,
    })

    const unterweisung = nachweisstand({
      nachweise: einsatz.documents.map(alsNachweiszeile),
      qZeile: 'Q37',
      bezugsobjekt: einsatz.id,
      stichtag: null,
      zeitraum: { von: row.periodFrom, bis: row.periodTo },
      arbeitserlaubnisErforderlich: null,
      unterweisungVerlangt: einsatz.site.safetyBriefingRequired,
    })
    liste.push({
      check: 'P10',
      row: 'Q37',
      satisfied: unterweisung.mandatoryDocumentsPresent,
      effect: 'Warnung',
      message: unterweisung.meldung,
    })
  }

  return liste
}

/**
 * P4 für den Zettelzeitraum (5.2.1, 5.2.4).
 *
 * **Verwendbar** heißt: am Einsatz steht ein Vergleichsentgelt. Dieselbe
 * Quelle wie in `lib/services/staffing.ts` (`comparableWage !== null`) — zwei
 * Lesarten derselben Prüfung in einem Programm wären eine zu viel. 5.2.4
 * Schritt 2 spricht vom **Eintrag** am Standort; der wird zusätzlich gelesen,
 * aber nur für die Herkunft: `wageSource = estimate` ist nach 5.2.4
 * verwendbar und erzeugt eine **Warnung**, keine Sperre.
 *
 * Gesperrt wird nur, wenn die Fälligkeit im Zeitraum erreicht ist **und** kein
 * Wert vorliegt. Vor der Fälligkeit ist Equal Pay nicht geschuldet — dann gibt
 * es nichts zu sperren (5.2.2).
 */
async function vergleichsentgeltstand(
  row: LoadedTimesheet,
): Promise<{ readonly usable: boolean; readonly message: string }> {
  const faelligkeit = row.assignment.equalPayDueDate
  const erreicht = faelligkeit !== null && faelligkeit <= row.periodTo
  if (!erreicht) {
    return {
      usable: true,
      message:
        faelligkeit === null
          ? 'P4: die Equal-Pay-Fälligkeit steht noch nicht fest (5.2.3) — kein Vergleichsentgelt ' +
            'geschuldet, keine Sperre.'
          : `P4: die Equal-Pay-Fälligkeit ${tag(faelligkeit)} liegt nach diesem Zeitraum (5.2.2) ` +
            '— noch nichts geschuldet.',
    }
  }
  if (row.assignment.comparableWage === null) {
    return {
      usable: false,
      message:
        `P4: die Equal-Pay-Fälligkeit ${tag(faelligkeit)} ist erreicht, am Einsatz steht aber ` +
        'kein Vergleichsentgelt (5.2.1). Q36 trägt dafür eine **Sperre**; der Entleiher pflegt ' +
        'den Eintrag am Standort (3.3), Meldung an KE.',
    }
  }

  const eintrag = await prisma.comparableWageEntry.findFirst({
    where: {
      siteId: row.assignment.siteId,
      activityKey: row.assignment.activityDescription,
      validFrom: { lte: row.periodTo },
      deactivatedAt: null,
    },
    orderBy: { validFrom: 'desc' },
  })
  if (eintrag !== null && eintrag.wageSource === 'estimate') {
    return {
      usable: true,
      message:
        'P4: das Vergleichsentgelt beruht auf einer Schätzung (`estimate`). Verwendbar, aber ' +
        'kein Nachweis — Warnung statt Sperre (3.3, 5.2.4).',
    }
  }
  return {
    usable: true,
    message:
      `P4: für den Zeitraum liegt ein verwendbares Vergleichsentgelt vor (5.2.1)` +
      (eintrag === null
        ? ' — der Wert ist am Einsatz geerbt; ein eigener Eintrag zur Tätigkeit am Standort ' +
          'wurde nicht gefunden (3.3).'
        : ` (${eintrag.wageSource}).`),
  }
}

/* ------------------------------------------------------------------ */
/* Tatsachen erheben (4.4)                                             */
/* ------------------------------------------------------------------ */

async function factsFor(
  row: LoadedTimesheet,
  identity: LoadedIdentity,
  evaluationDate: Date,
  teile: {
    readonly rejectionReason?: string | null
    readonly entscheideStufe?: number | null
  } = {},
): Promise<TimesheetFacts> {
  const stufen = row.approvals
  const offen = stufen.filter((approval) => approval.decision === null)
  const stufe = teile.entscheideStufe ?? offen[0]?.level ?? null
  const positionen = row.entries.map((entry) => ({
    workDate: entry.workDate,
    startMinute: entry.startMinute,
    endMinute: entry.endMinute,
    breakMinutes: entry.breakMinutes,
    hours: Number(entry.hours),
  }))
  const invariantenVerletzt =
    positionen.some((position) => pruefeZeitposition(position).length > 0) ||
    pruefeZeitpositionen(positionen).length > 0

  const stand = await vergleichsentgeltstand(row)

  return {
    assignmentStatus: row.assignment.status as TimesheetFacts['assignmentStatus'],
    billingPeriodStatus: row.billingPeriod.status,
    // Beim Anlegen geprüft, nicht danach: hier liegt der Zettel schon vor.
    timesheetExistsForPeriod: false,
    entryCount: row.entries.length,
    entriesWithinPeriod: row.entries.every(
      (entry) => entry.workDate >= row.periodFrom && entry.workDate <= row.periodTo,
    ),
    entriesOutsideInterruption: row.entries.every(
      (entry) =>
        !row.assignment.interruptions.some(
          (unterbrechung) =>
            entry.workDate >= unterbrechung.interruptionFrom &&
            (unterbrechung.interruptionTo === null ||
              entry.workDate <= unterbrechung.interruptionTo),
        ),
    ),
    entriesValid: !invariantenVerletzt,
    approvalCount: stufen.length,
    openStageRoleCode:
      stufe === null
        ? null
        : (stufen.find((approval) => approval.level === stufe)?.assignedRoleCode ?? null),
    actingRoleCodes: identity.subject.grants.map((zuweisung) => zuweisung.roleCode),
    remainingOpenStages: offen.filter((approval) => approval.level !== stufe).length,
    customerStagePresent: stufen.some((approval) => istKundenrolle(approval.assignedRoleCode)),
    anyStageRejected: stufen.some((approval) => approval.decision === 'rejected'),
    actingUserId: identity.user.id,
    recordedById: row.recordedById,
    submittedById: row.submittedById,
    rejectionReason: teile.rejectionReason ?? null,
    comparableWageUsable: stand.usable,
    correctionApproved: false,
    evaluationDate,
  }
}

/* ------------------------------------------------------------------ */
/* Abrechnungsperiode (3.9, Fußnote [33])                              */
/* ------------------------------------------------------------------ */

export interface NewBillingPeriodInput {
  readonly periodNumber: string
  readonly customerId: string | null
  readonly periodFrom: Date
  readonly periodTo: Date
  readonly closingDate: Date
}

/**
 * Öffnet eine Abrechnungsperiode (3.9, [33]).
 *
 * Sie entsteht **offen**: 3.9 macht `openedAt` / `openedBy` zur Pflicht „beim
 * jeweiligen Vorgang", und eine Periode, die noch nicht offen ist, trägt
 * keinen Stundenzettel. Das **Schließen** gehört in das vollständige
 * Statusmodell aus 4.5 und zu *offener Frage 24* — der Prototyp bietet es
 * nicht an; die Prüfung auf `open` in 4.4 greift trotzdem.
 */
export async function openBillingPeriod(
  identity: LoadedIdentity,
  input: NewBillingPeriodInput,
  evaluationDate: Date = new Date(),
): Promise<ActionResult> {
  if (input.periodNumber.trim() === '') return failure('Die Periodennummer ist Pflicht (3.9).')
  if (input.periodTo < input.periodFrom) {
    return failure('Das Ende der Periode liegt vor ihrem Beginn (3.9).')
  }
  const operatorTenant = await prisma.tenant.findFirst({ where: { tenantType: 'operator' } })
  if (operatorTenant === null) return failure('Kein Betreibermandant vorhanden (3.11).')
  const kunde =
    input.customerId === null
      ? null
      : await prisma.customer.findUnique({ where: { id: input.customerId } })
  if (input.customerId !== null && kunde === null) return failure('Unbekannter Kunde.')

  const decision = checkPermission(identity.subject, 'create', {
    ...billingPeriodRef({
      tenantId: operatorTenant.id,
      customerTenantId: kunde?.tenantId ?? null,
      status: 'open',
    }),
    targetStatus: 'open',
  })
  if (!decision.allowed) {
    return verweigere(
      identity,
      decision,
      'create',
      'billingPeriod',
      input.periodNumber,
      operatorTenant.id,
    )
  }

  try {
    await prisma.$transaction(async (tx) => {
      const periode = await tx.billingPeriod.create({
        data: {
          tenantId: operatorTenant.id,
          periodNumber: input.periodNumber.trim(),
          customerId: input.customerId,
          periodFrom: input.periodFrom,
          periodTo: input.periodTo,
          closingDate: input.closingDate,
          status: 'open',
          openedAt: evaluationDate,
          openedById: identity.user.id,
          createdById: identity.user.id,
        },
      })
      await protokolliere(
        tx,
        schreibEintrag({
          decision,
          operation: 'create',
          bezug: protokollbezug('billingPeriod', periode.id, periode.tenantId),
          userId: identity.user.id,
          occurredAt: evaluationDate,
        }),
      )
    })
  } catch (error) {
    return asFailure(error, 'Abrechnungsperiode konnte nicht geöffnet werden')
  }
  return success(
    `Abrechnungsperiode ${input.periodNumber} geöffnet (3.9). Das Schließen gehört zu 4.5 und ` +
      'ist nicht umgesetzt (offene Frage 24).',
  )
}

/* ------------------------------------------------------------------ */
/* Stundenzettel anlegen (4.4, — → recorded)                           */
/* ------------------------------------------------------------------ */

export interface NewTimesheetInput {
  readonly assignmentId: string
  readonly billingPeriodId: string
}

export async function createTimesheet(
  identity: LoadedIdentity,
  input: NewTimesheetInput,
  evaluationDate: Date = new Date(),
): Promise<ActionResult> {
  const einsatz = await prisma.assignment.findUnique({
    where: { id: input.assignmentId },
    include: {
      customer: { select: { tenantId: true } },
      supplier: { select: { tenantId: true } },
    },
  })
  if (einsatz === null) return failure('Unbekannter Einsatz.')
  const periode = await prisma.billingPeriod.findUnique({ where: { id: input.billingPeriodId } })
  if (periode === null) return failure('Unbekannte Abrechnungsperiode.')

  // Der Zeitraum des Zettels ist der **Schnitt** aus Periode und Einsatz: ein
  // Einsatz, der mitten in der Periode beginnt, trägt keine Zeiten davor.
  const periodFrom = einsatz.actualStartDate ?? einsatz.plannedStartDate
  const von = periodFrom > periode.periodFrom ? periodFrom : periode.periodFrom
  const einsatzende = einsatz.actualEndDate ?? einsatz.plannedEndDate
  const bis =
    einsatzende !== null && einsatzende < periode.periodTo ? einsatzende : periode.periodTo
  if (bis < von) {
    return failure(
      'Der Einsatz fällt nicht in diese Abrechnungsperiode — es gibt keinen Zeitraum, für den ' +
        'Zeiten zu erfassen wären (3.8).',
    )
  }

  const vorhanden = await prisma.timesheet.count({
    where: {
      assignmentId: einsatz.id,
      billingPeriodId: periode.id,
      // Eine Korrekturfassung ist der **neue** gültige Zettel; der ersetzte
      // steht auf `corrected` und hält die Regel aus 3.13 nicht auf.
      status: { not: 'corrected' },
    },
  })

  const nummer = await naechsteZettelnummer(periode.periodNumber)
  const ref = timesheetRef({
    tenantId: einsatz.tenantId,
    customerTenantId: einsatz.customer.tenantId,
    supplierTenantId: einsatz.supplier.tenantId,
    status: 'recorded',
    recordedById: identity.user.id,
    submittedById: null,
    siteId: einsatz.siteId,
    costCenterId: einsatz.costCenterId,
  })

  const outcome = attemptTransition(TIMESHEET_MODEL, 'create', {
    currentStatus: null,
    subject: identity.subject,
    resource: ref,
    facts: {
      ...LEERE_ZETTELTATSACHEN,
      assignmentStatus: einsatz.status as TimesheetFacts['assignmentStatus'],
      billingPeriodStatus: periode.status,
      timesheetExistsForPeriod: vorhanden > 0,
      actingUserId: identity.user.id,
      recordedById: identity.user.id,
      evaluationDate,
    },
  })
  if (!outcome.applied) {
    await protokolliereGetrennt(
      ablehnungsEintrag({
        rejection: outcome.rejection,
        bezug: protokollbezug('timesheet', nummer, einsatz.tenantId),
        userId: identity.user.id,
        occurredAt: evaluationDate,
        statusTo: 'recorded',
        operation: 'create',
      }),
    )
    return failure(outcome.rejection.reason, outcome.rejection.specReference)
  }

  try {
    await prisma.$transaction(async (tx) => {
      const zettel = await tx.timesheet.create({
        data: {
          tenantId: einsatz.tenantId,
          timesheetNumber: nummer,
          assignmentId: einsatz.id,
          billingPeriodId: periode.id,
          periodFrom: von,
          periodTo: bis,
          recordedById: identity.user.id,
          status: 'recorded',
          createdById: identity.user.id,
        },
      })
      await protokolliere(
        tx,
        uebergangsEintrag({
          outcome,
          bezug: protokollbezug('timesheet', zettel.id, zettel.tenantId),
          userId: identity.user.id,
          occurredAt: evaluationDate,
        }),
      )
    })
  } catch (error) {
    return asFailure(error, 'Stundenzettel konnte nicht angelegt werden')
  }
  return success(
    `${outcome.label}: Stundenzettel ${nummer} für ${tag(von)} bis ${tag(bis)} angelegt ` +
      `(${outcome.specReference}).`,
  )
}

/** Leere Tatsachen — damit jede Aufrufstelle nur setzt, was sie kennt. */
const LEERE_ZETTELTATSACHEN: TimesheetFacts = {
  assignmentStatus: 'active',
  billingPeriodStatus: 'open',
  timesheetExistsForPeriod: false,
  entryCount: 0,
  entriesWithinPeriod: true,
  entriesOutsideInterruption: true,
  entriesValid: true,
  approvalCount: 0,
  openStageRoleCode: null,
  actingRoleCodes: [],
  remainingOpenStages: 0,
  customerStagePresent: false,
  anyStageRejected: false,
  actingUserId: '',
  recordedById: '',
  submittedById: null,
  rejectionReason: null,
  comparableWageUsable: true,
  correctionApproved: false,
  evaluationDate: new Date(0),
}

async function naechsteZettelnummer(periodNumber: string): Promise<string> {
  const anzahl = await prisma.timesheet.count()
  return `SZ-${periodNumber}-${String(anzahl + 1).padStart(4, '0')}`
}

/* ------------------------------------------------------------------ */
/* Zeitpositionen (3.8)                                                */
/* ------------------------------------------------------------------ */

export interface NewTimeEntryInput {
  readonly timesheetId: string
  readonly workDate: Date
  /** Beide oder keines — die Erfassungsform folgt daraus (3.8, Invariante 1). */
  readonly startMinute: number | null
  readonly endMinute: number | null
  readonly breakMinutes: number | null
  /** Bei einer Tagessumme die Menge; bei einem Abschnitt wird sie gerechnet. */
  readonly hours: number | null
  readonly note: string | null
  /** Von Hand angegebene Zuschläge (`declared`, 3.8). */
  readonly declaredPremiums: readonly { readonly premiumTypeId: string; readonly hours: number }[]
}

/**
 * Legt eine Zeitposition an und leitet ihre Zuschläge ab (3.8).
 *
 * **Die Menge wird bei einem Abschnitt gerechnet, nicht übernommen.** Invariante
 * 3 verlangt, dass `hours` die Dauer ist; sie vom Aufrufer zu nehmen und dann
 * zu beanstanden wäre eine Fehlermeldung über eine Eingabe, die das Programm
 * selbst besser weiß. Bei einer **Tagessumme** ist die Menge die Eingabe — dort
 * gibt es keine Dauer.
 */
export async function addTimeEntry(
  identity: LoadedIdentity,
  input: NewTimeEntryInput,
  evaluationDate: Date = new Date(),
): Promise<ActionResult> {
  const row = await prisma.timesheet.findUnique({
    where: { id: input.timesheetId },
    include: TIMESHEET_INCLUDE,
  })
  if (row === null) return failure('Unbekannter Stundenzettel.')

  const ref = timeEntryRef({
    tenantId: row.tenantId,
    customerTenantId: row.assignment.customer.tenantId,
    supplierTenantId: row.assignment.supplier.tenantId,
    timesheetStatus: row.status,
    recordedById: row.recordedById,
    siteId: row.assignment.siteId,
    costCenterId: row.assignment.costCenterId,
  })
  const decision = checkPermission(identity.subject, 'create', ref)
  if (!decision.allowed) {
    return verweigere(identity, decision, 'create', 'timeEntry', row.timesheetNumber, row.tenantId)
  }

  // Eine Position entsteht nur, solange der Zettel erfasst wird (4.4,
  // „der **einzige** Zustand, in dem Zeitpositionen frei angelegt … werden").
  if (row.status !== 'recorded') {
    return failure(
      `Zeitpositionen werden nur im Zustand „erfasst" angelegt; der Zettel steht auf ` +
        `„${TIMESHEET_STATE_LABELS[row.status as TimesheetState]}" (4.4).`,
      'SPEC 4.4, Zustand recorded',
    )
  }

  const abschnitt = input.startMinute !== null && input.endMinute !== null
  const stunden = abschnitt
    ? abschnittsdauerInMinuten({
        startMinute: input.startMinute ?? 0,
        endMinute: input.endMinute ?? 0,
        breakMinutes: input.breakMinutes,
      }) / 60
    : (input.hours ?? 0)

  const position = {
    workDate: input.workDate,
    startMinute: input.startMinute,
    endMinute: input.endMinute,
    breakMinutes: abschnitt ? input.breakMinutes : null,
    hours: stunden,
  }

  const verletzungen = [
    ...pruefeZeitposition(position),
    // Invariante 4 gegen die **vorhandenen** Positionen: eine Überlappung
    // entsteht erst im Zusammenspiel.
    ...pruefeZeitpositionen([
      ...row.entries.map((entry) => ({
        workDate: entry.workDate,
        startMinute: entry.startMinute,
        endMinute: entry.endMinute,
        breakMinutes: entry.breakMinutes,
        hours: Number(entry.hours),
      })),
      position,
    ]),
  ]
  const erste = verletzungen[0]
  if (erste !== undefined) return failure(`${erste.feld}: ${erste.grund}`, erste.specReference)

  const arten = await katalog(evaluationDate)
  const zuschlaege = zuschlaegeDerPosition(position, arten, input.declaredPremiums)

  try {
    await prisma.$transaction(async (tx) => {
      const angelegt = await tx.timeEntry.create({
        data: {
          timesheetId: row.id,
          workDate: input.workDate,
          startMinute: input.startMinute,
          endMinute: input.endMinute,
          breakMinutes: position.breakMinutes,
          hours: stunden,
          note: input.note,
          createdById: identity.user.id,
          premiums: {
            create: zuschlaege.map((zuschlag) => ({
              premiumTypeId: zuschlag.premiumTypeId,
              hours: zuschlag.hours,
              origin: zuschlag.origin,
              createdById: identity.user.id,
            })),
          },
        },
      })
      await protokolliere(
        tx,
        schreibEintrag({
          decision,
          operation: 'create',
          bezug: protokollbezug('timeEntry', angelegt.id, row.tenantId),
          userId: identity.user.id,
          occurredAt: evaluationDate,
        }),
      )
    })
  } catch (error) {
    return asFailure(error, 'Zeitposition konnte nicht angelegt werden')
  }

  const abgeleitet = zuschlaege.filter((zuschlag) => zuschlag.origin === 'derived').length
  const angegeben = zuschlaege.filter((zuschlag) => zuschlag.origin === 'declared').length
  return success(
    `Zeitposition ${tag(input.workDate)} über ${stunden.toFixed(2)} Stunden angelegt ` +
      `(${abschnitt ? 'Abschnitt' : 'Tagessumme'}, 3.8). Zuschläge: ${abgeleitet} abgeleitet, ` +
      `${angegeben} angegeben.` +
      (abschnitt
        ? ''
        : ' Aus einer Tagessumme folgt kein Zuschlag nach Uhrzeit — er wäre anzugeben (3.8).'),
  )
}

/** Entfernt eine Zeitposition — nur vor der Einreichung ([44], 4.4). */
export async function removeTimeEntry(
  identity: LoadedIdentity,
  input: { readonly timeEntryId: string },
  evaluationDate: Date = new Date(),
): Promise<ActionResult> {
  const entry = await prisma.timeEntry.findUnique({
    where: { id: input.timeEntryId },
    include: { timesheet: { include: TIMESHEET_INCLUDE } },
  })
  if (entry === null) return failure('Unbekannte Zeitposition.')
  const row = entry.timesheet

  const ref = timeEntryRef({
    tenantId: row.tenantId,
    customerTenantId: row.assignment.customer.tenantId,
    supplierTenantId: row.assignment.supplier.tenantId,
    timesheetStatus: row.status,
    recordedById: row.recordedById,
    siteId: row.assignment.siteId,
    costCenterId: row.assignment.costCenterId,
  })
  const decision = checkPermission(identity.subject, 'delete', ref)
  if (!decision.allowed) {
    return verweigere(identity, decision, 'delete', 'timeEntry', entry.id, row.tenantId)
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.timeEntry.delete({ where: { id: entry.id } })
      await protokolliere(
        tx,
        schreibEintrag({
          decision,
          operation: 'delete',
          bezug: protokollbezug('timeEntry', entry.id, row.tenantId),
          userId: identity.user.id,
          occurredAt: evaluationDate,
        }),
      )
    })
  } catch (error) {
    return asFailure(error, 'Zeitposition konnte nicht entfernt werden')
  }
  return success(`Zeitposition ${tag(entry.workDate)} entfernt (3.8, Fußnote [44]).`)
}

/* ------------------------------------------------------------------ */
/* Einreichen (4.4, recorded → submitted → inApproval)                 */
/* ------------------------------------------------------------------ */

/**
 * Die Stufenfolge eines Kunden (3.1), oder die Vorbelegung aus 4.4.
 *
 * Gelesen wird sie **einmal**, beim Einreichen, und in die Freigabeschritte
 * **kopiert**: ein laufender Zettel soll nicht umhängen, wenn jemand die
 * Konfiguration ändert (3.8).
 */
async function stufenfolge(customerId: string): Promise<readonly RoleCode[]> {
  const stufen = await prisma.customerTimesheetApprovalStage.findMany({
    where: { customerId },
    orderBy: { level: 'asc' },
  })
  return stufen.length === 0 ? VORBELEGTE_STUFENFOLGE : stufen.map((stufe) => stufe.roleCode)
}

/**
 * Reicht den Zettel ein und eröffnet die Freigabe — **zwei** Übergänge aus 4.4
 * (`submit` und der Systemübergang `openApproval`), in dieser Reihenfolge und
 * in einer Transaktion.
 *
 * Getrennt gehalten, weil 4.4 sie getrennt führt: das Einreichen ist die
 * Handlung der erfassenden Seite, das Eröffnen die Folge daraus (4.0, Regel
 * 10). Scheitert das Eröffnen — etwa weil die Stufenfolge keine Kundenstufe
 * trägt —, bleibt der Zettel **nicht** eingereicht stehen: beides rollt
 * zurück, und die Begründung nennt den Grund.
 */
export async function submitTimesheet(
  identity: LoadedIdentity,
  input: { readonly timesheetId: string },
  evaluationDate: Date = new Date(),
): Promise<ActionResult> {
  const row = await prisma.timesheet.findUnique({
    where: { id: input.timesheetId },
    include: TIMESHEET_INCLUDE,
  })
  if (row === null) return failure('Unbekannter Stundenzettel.')

  const facts = await factsFor(row, identity, evaluationDate)
  const eingereicht = attemptTransition(TIMESHEET_MODEL, 'submit', {
    currentStatus: row.status as TimesheetState,
    subject: identity.subject,
    resource: refFor(row),
    facts,
  })
  if (!eingereicht.applied) {
    await protokolliereGetrennt(
      ablehnungsEintrag({
        rejection: eingereicht.rejection,
        bezug: protokollbezug('timesheet', row.id, row.tenantId),
        userId: identity.user.id,
        occurredAt: evaluationDate,
        statusFrom: row.status,
        statusTo: 'submitted',
      }),
    )
    return failure(eingereicht.rejection.reason, eingereicht.rejection.specReference)
  }

  const folge = await stufenfolge(row.assignment.customer.id)
  const eroeffnet = attemptTransition(TIMESHEET_MODEL, 'openApproval', {
    currentStatus: 'submitted',
    resource: refFor(row),
    facts: {
      ...facts,
      approvalCount: folge.length,
      customerStagePresent: folge.some((rolle) => istKundenrolle(rolle)),
    },
  })
  if (!eroeffnet.applied) {
    await protokolliereGetrennt(
      ablehnungsEintrag({
        rejection: eroeffnet.rejection,
        bezug: protokollbezug('timesheet', row.id, row.tenantId),
        userId: identity.user.id,
        occurredAt: evaluationDate,
        statusFrom: 'submitted',
        statusTo: 'inApproval',
      }),
    )
    return failure(eroeffnet.rejection.reason, eroeffnet.rejection.specReference)
  }

  const q33 = await befunde(row, 'Q33')

  try {
    await prisma.$transaction(async (tx) => {
      await tx.timesheet.update({
        where: { id: row.id },
        data: {
          status: 'inApproval',
          submittedAt: evaluationDate,
          submittedById: identity.user.id,
          updatedById: identity.user.id,
          // Eine frühere Ablehnung ist mit der neuen Einreichung erledigt;
          // die alten Stufen werden verworfen und neu erzeugt (4.4).
          rejectionReason: null,
        },
      })
      await tx.timesheetApproval.deleteMany({ where: { timesheetId: row.id } })
      for (const [index, roleCode] of folge.entries()) {
        await tx.timesheetApproval.create({
          data: {
            timesheetId: row.id,
            level: index + 1,
            assignedRoleCode: roleCode,
            createdById: identity.user.id,
          },
        })
      }
      for (const outcome of [eingereicht, eroeffnet]) {
        await protokolliere(
          tx,
          uebergangsEintrag({
            outcome,
            bezug: protokollbezug('timesheet', row.id, row.tenantId),
            userId: outcome === eroeffnet ? SYSTEMKENNZEICHEN : identity.user.id,
            occurredAt: evaluationDate,
          }),
        )
      }
    })
  } catch (error) {
    return asFailure(error, 'Der Stundenzettel konnte nicht eingereicht werden')
  }

  const q34 = await befunde(row, 'Q34')
  return success(
    `${eingereicht.label}: ${row.timesheetNumber} steht jetzt auf ` +
      `„${TIMESHEET_STATE_LABELS.inApproval}" mit ${folge.length} Stufe(n) — ` +
      `${folge.join(', ')} (4.4). ${[...q33, ...q34].map((befund) => befund.message).join(' ')}`,
  )
}

/** Systemkennzeichen für den Eintrag zum Systemübergang (3.12, 4.0 Regel 10). */
const SYSTEMKENNZEICHEN = 'systemlauf'

/* ------------------------------------------------------------------ */
/* Freigabe entscheiden (4.4, inApproval)                              */
/* ------------------------------------------------------------------ */

export interface StageDecisionInput {
  readonly timesheetId: string
  readonly decision: 'approved' | 'rejected'
  /** Pflicht bei Ablehnung (4.4). */
  readonly rejectionReason: string | null
  readonly comment: string | null
}

/**
 * Entscheidet die **offene** Stufe (4.4).
 *
 * Welcher Übergang greift, entscheidet die Lage und nicht der Aufrufer:
 * `reject` bei Ablehnung, `approve`, wenn dies die letzte offene Stufe ist,
 * sonst `approveStage`. Deshalb gibt es diese drei als eigene Zeilen im Modell
 * — und nicht einen Übergang mit einer Verzweigung hier.
 */
export async function decideStage(
  identity: LoadedIdentity,
  input: StageDecisionInput,
  evaluationDate: Date = new Date(),
): Promise<ActionResult> {
  const row = await prisma.timesheet.findUnique({
    where: { id: input.timesheetId },
    include: TIMESHEET_INCLUDE,
  })
  if (row === null) return failure('Unbekannter Stundenzettel.')

  const stufe = offeneStufe(row)
  if (stufe === null) {
    return failure(
      'An diesem Zettel ist keine Stufe offen (4.4).',
      'SPEC 4.4, inApproval',
    )
  }

  const facts = await factsFor(row, identity, evaluationDate, {
    rejectionReason: input.rejectionReason,
    entscheideStufe: stufe.level,
  })
  const name: TimesheetTransitionName =
    input.decision === 'rejected'
      ? 'reject'
      : facts.remainingOpenStages === 0
        ? 'approve'
        : 'approveStage'

  const outcome = attemptTransition(TIMESHEET_MODEL, name, {
    currentStatus: row.status as TimesheetState,
    subject: identity.subject,
    resource: refFor(row),
    facts,
  })
  if (!outcome.applied) {
    await protokolliereGetrennt(
      ablehnungsEintrag({
        rejection: outcome.rejection,
        bezug: protokollbezug('timesheet', row.id, row.tenantId),
        userId: identity.user.id,
        occurredAt: evaluationDate,
        statusFrom: row.status,
        statusTo: TIMESHEET_MODEL.transitions[name].to,
      }),
    )
    return failure(outcome.rejection.reason, outcome.rejection.specReference)
  }

  const q35 = name === 'approve' ? await befunde(row, 'Q35') : []

  try {
    await prisma.$transaction(async (tx) => {
      await tx.timesheetApproval.update({
        where: { timesheetId_level: { timesheetId: row.id, level: stufe.level } },
        data: {
          decision: input.decision,
          decidedAt: evaluationDate,
          decidedById: identity.user.id,
          comment: input.comment,
          // Vertretungsvermerk (2.4, Regel 6): die Entscheidung der
          // Prüffunktion weiß, ob in Vertretung gehandelt wurde.
          delegationId:
            outcome.decision?.allowed === true
              ? (outcome.decision.delegationNote?.delegationId ?? null)
              : null,
          updatedById: identity.user.id,
        },
      })
      await tx.timesheet.update({
        where: { id: row.id },
        data: {
          status: outcome.to,
          updatedById: identity.user.id,
          ...(name === 'approve'
            ? { approvedAt: evaluationDate, approvedById: identity.user.id }
            : {}),
          ...(name === 'reject' ? { rejectionReason: input.rejectionReason } : {}),
        },
      })
      await protokolliere(
        tx,
        uebergangsEintrag({
          outcome,
          bezug: protokollbezug('timesheet', row.id, row.tenantId),
          userId: identity.user.id,
          occurredAt: evaluationDate,
          reason: name === 'reject' ? input.rejectionReason : input.comment,
        }),
      )
    })
  } catch (error) {
    return asFailure(error, 'Die Entscheidung über den Stundenzettel konnte nicht gespeichert werden')
  }

  const warnungen = q35
    .filter((befund) => !befund.satisfied)
    .map((befund) => befund.message)
    .join(' ')
  return success(
    `${outcome.label} (Stufe ${stufe.level}, ${stufe.roleCode}): ${row.timesheetNumber} steht ` +
      `jetzt auf „${TIMESHEET_STATE_LABELS[outcome.to]}" (${outcome.specReference}).` +
      (warnungen === '' ? '' : ` ${warnungen}`),
  )
}

/** `rejected` → `recorded` (4.4): nacharbeiten. */
export async function reworkTimesheet(
  identity: LoadedIdentity,
  input: { readonly timesheetId: string },
  evaluationDate: Date = new Date(),
): Promise<ActionResult> {
  const row = await prisma.timesheet.findUnique({
    where: { id: input.timesheetId },
    include: TIMESHEET_INCLUDE,
  })
  if (row === null) return failure('Unbekannter Stundenzettel.')

  const facts = await factsFor(row, identity, evaluationDate)
  const outcome = attemptTransition(TIMESHEET_MODEL, 'rework', {
    currentStatus: row.status as TimesheetState,
    subject: identity.subject,
    resource: refFor(row),
    facts,
  })
  if (!outcome.applied) {
    await protokolliereGetrennt(
      ablehnungsEintrag({
        rejection: outcome.rejection,
        bezug: protokollbezug('timesheet', row.id, row.tenantId),
        userId: identity.user.id,
        occurredAt: evaluationDate,
        statusFrom: row.status,
        statusTo: 'recorded',
      }),
    )
    return failure(outcome.rejection.reason, outcome.rejection.specReference)
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.timesheet.update({
        where: { id: row.id },
        data: { status: 'recorded', updatedById: identity.user.id },
      })
      // Die Stufen werden **verworfen** und bei der nächsten Einreichung neu
      // erzeugt (4.4): eine Entscheidung über eine alte Fassung des Zettels
      // trägt die neue nicht.
      await tx.timesheetApproval.deleteMany({ where: { timesheetId: row.id } })
      await protokolliere(
        tx,
        uebergangsEintrag({
          outcome,
          bezug: protokollbezug('timesheet', row.id, row.tenantId),
          userId: identity.user.id,
          occurredAt: evaluationDate,
        }),
      )
    })
  } catch (error) {
    return asFailure(error, 'Der Stundenzettel konnte nicht zur Nacharbeit freigegeben werden')
  }
  return success(
    `${outcome.label}: ${row.timesheetNumber} steht wieder auf ` +
      `„${TIMESHEET_STATE_LABELS.recorded}"; die Freigabeschritte sind verworfen (4.4).`,
  )
}

/* ------------------------------------------------------------------ */
/* Auswahl für die Oberfläche                                          */
/* ------------------------------------------------------------------ */

export interface TimesheetOptions {
  /** Einsätze, zu denen diese Identität einen Zettel anlegen darf (2.2, `A`). */
  readonly assignments: readonly { readonly id: string; readonly label: string }[]
  readonly periods: readonly { readonly id: string; readonly label: string }[]
  readonly premiumTypes: readonly {
    readonly id: string
    readonly code: string
    readonly name: string
    readonly derivationBasis: string
  }[]
  readonly mayCreate: boolean
  readonly mayOpenPeriod: boolean
}

export async function loadTimesheetOptions(
  identity: LoadedIdentity,
  evaluationDate: Date = new Date(),
): Promise<TimesheetOptions> {
  const operatorTenant = await prisma.tenant.findFirst({ where: { tenantType: 'operator' } })
  const einsaetze = await prisma.assignment.findMany({
    where: { status: { in: ['active', 'interrupted', 'completed', 'terminatedEarly'] } },
    include: {
      customer: { select: { tenantId: true, legalName: true } },
      supplier: { select: { tenantId: true } },
      candidate: { select: { pseudonym: true } },
    },
    orderBy: { assignmentNumber: 'asc' },
  })

  const erlaubt: { id: string; label: string }[] = []
  for (const einsatz of einsaetze) {
    const decision = checkPermission(
      identity.subject,
      'create',
      timesheetRef({
        tenantId: einsatz.tenantId,
        customerTenantId: einsatz.customer.tenantId,
        supplierTenantId: einsatz.supplier.tenantId,
        status: 'recorded',
        recordedById: identity.user.id,
        submittedById: null,
        siteId: einsatz.siteId,
        costCenterId: einsatz.costCenterId,
      }),
    )
    if (!decision.allowed) continue
    erlaubt.push({
      id: einsatz.id,
      label: `${einsatz.assignmentNumber} — ${einsatz.candidate.pseudonym} bei ${einsatz.customer.legalName}`,
    })
  }

  const perioden = await prisma.billingPeriod.findMany({
    where: { status: 'open' },
    orderBy: { periodNumber: 'asc' },
  })
  const arten = await prisma.premiumType.findMany({
    where: {
      deactivatedAt: null,
      validFrom: { lte: evaluationDate },
      OR: [{ validTo: null }, { validTo: { gte: evaluationDate } }],
    },
    orderBy: { code: 'asc' },
  })

  const periodenRecht =
    operatorTenant === null
      ? false
      : checkPermission(identity.subject, 'create', {
          ...billingPeriodRef({
            tenantId: operatorTenant.id,
            customerTenantId: null,
            status: 'open',
          }),
          targetStatus: 'open',
        }).allowed

  return {
    assignments: erlaubt,
    periods: perioden.map((periode) => ({
      id: periode.id,
      label: `${periode.periodNumber} (${tag(periode.periodFrom)} bis ${tag(periode.periodTo)})`,
    })),
    premiumTypes: arten.map((art) => ({
      id: art.id,
      code: art.code,
      name: art.name,
      derivationBasis: art.derivationBasis,
    })),
    mayCreate: erlaubt.length > 0,
    mayOpenPeriod: periodenRecht,
  }
}
