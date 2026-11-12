/**
 * Fachdienst Abrechnung — SPEC **3.9** (Objekte) und **4.5** (Statusmodelle der
 * Abrechnungsperiode und des Abrechnungsbelegs).
 *
 * Hier laufen die drei Querschnittszeilen zusammen, die 4.7 dem Beleg
 * zuordnet: **Q38** (P9, Erlaubnis im ganzen Leistungszeitraum), **Q39** (P4,
 * Vergleichsentgelt) und **Q40** (P5, Branchenzuschlagsstufe). Alle drei sind
 * **Warnung oder Information** — keine Sperre. Das ist die tragende
 * Entscheidung dieses Kapitels und sie steht in 5.5.5: die Leistung ist
 * **erbracht**, und eine Sperre der Abrechnung verhindert keine Überlassung
 * mehr; sie würde dem Leiharbeitnehmer und dem Lieferanten das Entgelt für
 * einen Fehler vorenthalten, der vorher entstanden ist. Gesperrt wird eine
 * Handlung, nicht eine Feststellung.
 *
 * **Der Prüfzeitraum ist nicht der Tag des Aufrufs.** 5.0 führt für den Beleg
 * eine eigene Zeile: „frühester `periodFrom` bis spätester `periodTo` der
 * zugrunde liegenden Zettel". Ein Beleg über den Oktober wird im November
 * erstellt, und geprüft wird der Oktober.
 *
 * **Die Mengen kommen aus den Zetteln, die Preise aus den Preislisten.** Keine
 * Menge dieses Dienstes ist eine Eingabe: die Grundleistung ist die Summe der
 * Zeitpositionen, die Zuschlagsstunden sind die Summen je Zuschlagsart (3.8),
 * und der Satz steht am Einsatz (Grundsatz) bzw. in der Preisliste derselben
 * Seite (Zuschlagssatz). Gerechnet wird in `lib/billing/items.ts`, ohne
 * Datenbank.
 *
 * **Ein Zettel wird nicht zweimal abgerechnet.** Die Auswahl der Zettel
 * schließt die aus, die schon auf einem nicht stornierten Beleg **derselben
 * Seite** stehen. Das sagt 3.9 nicht ausdrücklich, aber es folgt zwingend aus
 * ihm: dieselben Stunden zweimal zu berechnen wäre keine zweite Abrechnung,
 * sondern eine falsche. Ein **Storno** gibt die Zettel wieder frei — genau
 * dafür ist er da (4.5.2).
 */
import { entgeltstand, erlaubnisstand, zuschlagsstand } from '../aueg/anbindung'
import { schreibEintrag } from '../audit/entry'
import { protokolliere, protokolliereGetrennt, type Transaktion } from '../audit/record'
import { ablehnungsEintrag, uebergangsEintrag } from '../audit/transitions'
import { checkPermission } from '../authz/check'
import type { RoleCode } from '../authz/roles'
import {
  belegpositionen,
  belegsummen,
  summenStimmen,
  type Abrechnungszeile,
  type Belegposition,
  type Preisposition,
  type Zuschlagsart,
} from '../billing/items'
import type { LoadedIdentity } from '../identity/loadSubject'
import { pruefeAbrechnungsbeleg } from '../masterdata/invariants'
import { prisma } from '../prisma'
import { benachrichtigeUebergang, rolleDesHandelnden } from './notifications'
import {
  BILLING_DOCUMENT_MODEL,
  BILLING_DOCUMENT_STATE_LABELS,
  type BillingDirection,
  type BillingDocumentFacts,
  type BillingDocumentState,
  type BillingDocumentTransitionName,
} from '../status/billingDocument'
import {
  BILLING_PERIOD_MODEL,
  BILLING_PERIOD_STATE_LABELS,
  type BillingPeriodFacts,
  type BillingPeriodState,
} from '../status/billingPeriod'
import { attemptTransition } from '../status/machine'
import {
  asFailure,
  billingDocumentRef,
  billingPeriodRef,
  failure,
  protokollbezug,
  success,
  verweigere,
  type ActionResult,
} from './common'

/* ------------------------------------------------------------------ */
/* Festwerte und Konfiguration                                         */
/* ------------------------------------------------------------------ */

/**
 * Belegart je Seite (3.9). Im Prototyp **eine** je Seite: das
 * Gutschriftverfahren (Entscheidung zu *Frage 6*). `supplierInvoice` bleibt im
 * Katalog und ist hier bewusst nicht erreichbar — 4.5.2 führt die Variante B
 * als dokumentiert, nicht umgesetzt.
 */
const DOCUMENT_TYPE_BY_DIRECTION = {
  sales: 'customerInvoice',
  purchase: 'supplierCreditNote',
} as const

/** Nummernkreis je Belegart (3.9: „Nummernkreise je Belegart"). */
const NUMBER_PREFIX = {
  customerInvoice: 'RE',
  supplierCreditNote: 'GS',
  supplierInvoice: 'ER',
} as const

/**
 * Vorbelegung der Prüffrist eines Belegs: **14 Kalendertage ab `released`**
 * (4.0, Tabelle „Prozessfristen"). Je Kunde über `processDeadlineConfig` (3.1)
 * überschreibbar — ein Fristwert ist Konfiguration, kein Festwert im Code.
 *
 * Nur diese eine Zeile der Tabelle steht hier, weil nur sie gebraucht wird.
 * Die übrigen kommen mit ihrer Verwendung; eine abgeschriebene Zeile ohne
 * Verwendung wäre eine Zusicherung, die nichts einlöst.
 */
const BILLING_REVIEW_DEADLINE_DAYS = 14
const BILLING_REVIEW_DEADLINE_KEY = 'billingReviewDeadlineDays'

/* ------------------------------------------------------------------ */
/* Laden                                                              */
/* ------------------------------------------------------------------ */

const DOCUMENT_INCLUDE = {
  customer: { select: { id: true, tenantId: true, legalName: true, processDeadlineConfig: true } },
  supplier: { select: { id: true, tenantId: true, legalName: true } },
  billingPeriod: true,
  createdBy: { select: { givenName: true, familyName: true } },
  items: {
    include: {
      premiumType: { select: { code: true, name: true, calculationBase: true } },
      assignment: { select: { assignmentNumber: true } },
      timesheet: { select: { timesheetNumber: true, status: true } },
      costCenter: { select: { costCenterNumber: true } },
    },
    orderBy: { timesheetId: 'asc' },
  },
  basedOnTimesheets: {
    select: { id: true, timesheetNumber: true, status: true, correction: { select: { status: true } } },
  },
  cancellationOf: { select: { documentNumber: true } },
  cancellation: { select: { documentNumber: true } },
} as const

type LoadedDocument = Awaited<
  ReturnType<typeof prisma.billingDocument.findMany<{ include: typeof DOCUMENT_INCLUDE }>>
>[number]

/** Ein Befund aus Kapitel 5 zu diesem Beleg, in Worten (4.7). */
export interface BillingFinding {
  readonly check: 'P9' | 'P4' | 'P5'
  readonly row: 'Q38' | 'Q39' | 'Q40'
  readonly satisfied: boolean
  /** An diesem Objekt nie `Sperre` — siehe Kopfkommentar (5.5.5). */
  readonly effect: 'Warnung' | 'Information'
  readonly message: string
}

export interface BillingItemView {
  readonly timesheetNumber: string
  readonly assignmentNumber: string
  readonly premium: string | null
  readonly quantity: number
  readonly unitPrice: number
  readonly amount: number
  readonly costCenter: string | null
  /** Der Einzelpreis kommt aus einer Preisposition — oder aus einem abweichenden Satz. */
  readonly fromRateCard: boolean
}

export interface BillingDocumentView {
  readonly id: string
  readonly documentNumber: string
  readonly documentType: string
  readonly direction: BillingDirection
  readonly status: BillingDocumentState
  readonly statusLabel: string
  readonly counterparty: string
  readonly periodNumber: string
  readonly periodStatus: BillingPeriodState
  readonly issueDate: string
  readonly netAmount: number
  readonly taxAmount: number
  readonly grossAmount: number
  readonly taxRate: number
  readonly currency: string
  readonly createdBy: string
  readonly releasedAt: string | null
  readonly disputeReason: string | null
  readonly disputeResolutionNote: string | null
  readonly cancellationReason: string | null
  readonly cancellationOf: string | null
  readonly cancelledBy: string | null
  readonly reviewDeadline: string | null
  readonly withinReviewDeadline: boolean
  readonly timesheetNumbers: readonly string[]
  readonly replacedTimesheets: readonly string[]
  readonly items: readonly BillingItemView[]
  readonly findings: readonly BillingFinding[]
  readonly availableTransitions: readonly {
    readonly name: BillingDocumentTransitionName
    readonly label: string
  }[]
  readonly crossTenant: boolean
}

export interface BillingPeriodView {
  readonly id: string
  readonly periodNumber: string
  readonly customer: string | null
  readonly period: string
  readonly closingDate: string
  readonly status: BillingPeriodState
  readonly statusLabel: string
  readonly undecidedTimesheets: number
  readonly unfinishedDocuments: number
  readonly mayClose: boolean
  readonly closeObstacle: string | null
}

/**
 * Die Belege in der sichtbaren Fassung.
 *
 * Geladen werden alle und danach einzeln geprüft — dieselbe Begründung wie bei
 * Nachweisen (3.10) und Zetteln (3.8): die Grenze hängt an Mandant,
 * Belegseite und Betreuungszuordnung, und das steht in der Prüffunktion, nicht
 * in einer `where`-Klausel.
 */
export async function loadBillingDocuments(
  identity: LoadedIdentity,
  evaluationDate: Date = new Date(),
): Promise<readonly BillingDocumentView[]> {
  const rows = await prisma.billingDocument.findMany({
    include: DOCUMENT_INCLUDE,
    orderBy: { documentNumber: 'asc' },
  })
  const views: BillingDocumentView[] = []
  for (const row of rows) {
    const decision = checkPermission(identity.subject, 'read', refFor(row))
    if (!decision.allowed) continue
    // Die Befunde der Zeile, die der Beleg schon hinter sich hat: 4.7 ordnet
    // alle drei der **Anlage** zu, und sie bleiben am Beleg sichtbar, solange
    // er lebt (5.5.2 Nr. 1: jedes Ergebnis wird vermerkt).
    const findings = await befunde(row)
    views.push(asView(row, identity, decision.crossTenant, findings, evaluationDate))
  }
  return views
}

/** Die Abrechnungsperioden in der sichtbaren Fassung (3.9, 4.5.1). */
export async function loadBillingPeriods(
  identity: LoadedIdentity,
): Promise<readonly BillingPeriodView[]> {
  const rows = await prisma.billingPeriod.findMany({
    include: { customer: { select: { tenantId: true, legalName: true } } },
    orderBy: { periodNumber: 'asc' },
  })
  const views: BillingPeriodView[] = []
  for (const row of rows) {
    const ref = billingPeriodRef({
      tenantId: row.tenantId,
      customerTenantId: row.customer?.tenantId ?? null,
      status: row.status,
    })
    if (!checkPermission(identity.subject, 'read', ref).allowed) continue
    const stand = await periodenstand(row.id)
    const outcome = attemptTransition(BILLING_PERIOD_MODEL, 'close', {
      currentStatus: row.status,
      subject: identity.subject,
      resource: ref,
      facts: periodenTatsachen(stand, new Date()),
    })
    views.push({
      id: row.id,
      periodNumber: row.periodNumber,
      customer: row.customer?.legalName ?? null,
      period: `${tag(row.periodFrom)} bis ${tag(row.periodTo)}`,
      closingDate: tag(row.closingDate),
      status: row.status,
      statusLabel: BILLING_PERIOD_STATE_LABELS[row.status],
      undecidedTimesheets: stand.undecidedTimesheets,
      unfinishedDocuments: stand.unfinishedDocuments,
      mayClose: outcome.applied,
      closeObstacle: outcome.applied ? null : outcome.rejection.reason,
    })
  }
  return views
}

function refFor(row: LoadedDocument) {
  return billingDocumentRef({
    tenantId: row.tenantId,
    direction: row.direction,
    customerTenantId: row.customer?.tenantId ?? null,
    supplierTenantId: row.supplier?.tenantId ?? null,
    status: row.status,
    createdById: row.createdById,
  })
}

function asView(
  row: LoadedDocument,
  identity: LoadedIdentity,
  crossTenant: boolean,
  findings: readonly BillingFinding[],
  evaluationDate: Date,
): BillingDocumentView {
  const frist = pruefFrist(row)
  return {
    id: row.id,
    documentNumber: row.documentNumber,
    documentType: row.documentType,
    direction: row.direction,
    status: row.status,
    statusLabel: BILLING_DOCUMENT_STATE_LABELS[row.status],
    counterparty: row.customer?.legalName ?? row.supplier?.legalName ?? '(ohne Gegenseite)',
    periodNumber: row.billingPeriod.periodNumber,
    periodStatus: row.billingPeriod.status,
    issueDate: tag(row.issueDate),
    netAmount: Number(row.netAmount),
    taxAmount: Number(row.taxAmount),
    grossAmount: Number(row.grossAmount),
    taxRate: Number(row.taxRate),
    currency: row.currency,
    createdBy: `${row.createdBy.givenName} ${row.createdBy.familyName}`,
    releasedAt: row.releasedAt === null ? null : tag(row.releasedAt),
    disputeReason: row.disputeReason,
    disputeResolutionNote: row.disputeResolutionNote,
    cancellationReason: row.cancellationReason,
    cancellationOf: row.cancellationOf?.documentNumber ?? null,
    cancelledBy: row.cancellation?.documentNumber ?? null,
    reviewDeadline: frist === null ? null : tag(frist),
    withinReviewDeadline: frist === null || frist >= evaluationDate,
    timesheetNumbers: row.basedOnTimesheets.map((zettel) => zettel.timesheetNumber),
    replacedTimesheets: row.basedOnTimesheets
      .filter((zettel) => zettel.status !== 'approved')
      .map((zettel) => zettel.timesheetNumber),
    items: row.items.map((item) => ({
      timesheetNumber: item.timesheet.timesheetNumber,
      assignmentNumber: item.assignment.assignmentNumber,
      premium: item.premiumType?.code ?? null,
      quantity: Number(item.quantity),
      unitPrice: Number(item.unitPrice),
      amount: Number(item.amount),
      costCenter: item.costCenter?.costCenterNumber ?? null,
      fromRateCard: item.rateCardItemId !== null,
    })),
    findings,
    availableTransitions: offeneUebergaenge(row, identity),
    crossTenant,
  }
}

/**
 * Die Übergänge, die die Oberfläche anbietet.
 *
 * Gefiltert wird nach Zustand, Rolle und **Recht** — nicht nach
 * Vorbedingungen: eine fehlende Vorbedingung ist behebbar, und die Seite soll
 * sagen, was fehlt, statt den Weg zu verstecken (5.4.6).
 *
 * **Zwei Dinge filtern trotzdem mit**, weil keine Eingabe sie heilt — dieselbe
 * Überlegung wie am Lieferantenstatus (4.6) und am Stundenzettel (4.4): die
 * **Belegseite** (eine Kundenseite beanstandet keinen Einkaufsbeleg) und das
 * **Vier-Augen-Prinzip** der Freigabe. Für `MD` prüft das Letztere schon
 * Fußnote [30]; `MA` trägt in 2.2 keine Fußnote, und dort hinge der Filter
 * sonst allein an der Vorbedingung — die Seite würde dem Ersteller einen Knopf
 * anbieten, der nie trägt.
 */
function offeneUebergaenge(
  row: LoadedDocument,
  identity: LoadedIdentity,
): readonly { readonly name: BillingDocumentTransitionName; readonly label: string }[] {
  const ref = refFor(row)
  const angeboten: { name: BillingDocumentTransitionName; label: string }[] = []

  for (const [name, definition] of Object.entries(BILLING_DOCUMENT_MODEL.transitions) as readonly (readonly [
    BillingDocumentTransitionName,
    (typeof BILLING_DOCUMENT_MODEL.transitions)[BillingDocumentTransitionName],
  ])[]) {
    // Keine Prüfung auf Systemübergänge: 4.5.2 führt keinen — jeder Übergang
    // am Beleg ist eine Handlung mit auslösender Rolle. Das ist der
    // Unterschied zu 4.4, wo das Eröffnen der Freigabe und die Ersetzung durch
    // eine Korrekturfassung Folgen sind und keine Handlungen (4.0, Regel 10).
    const ausZustaenden: readonly string[] = definition.from
    if (!ausZustaenden.includes(row.status)) continue
    if (
      !identity.subject.grants.some((zuweisung) =>
        (definition.roles as readonly RoleCode[]).includes(zuweisung.roleCode),
      )
    ) {
      continue
    }
    if (name === 'disputeBySales' && row.direction !== 'sales') continue
    if ((name === 'disputeByPurchase' || name === 'confirm') && row.direction !== 'purchase') {
      continue
    }
    if (name === 'release' && identity.user.id === row.createdById) continue
    const entscheidung = checkPermission(identity.subject, 'transition', {
      ...ref,
      targetStatus: definition.to,
    })
    if (!entscheidung.allowed) continue
    angeboten.push({ name, label: definition.label })
  }
  return angeboten
}

function tag(wert: Date): string {
  return wert.toISOString().slice(0, 10)
}

/**
 * Die Prüffrist des Belegs: `releasedAt` plus `billingReviewDeadlineDays`
 * (4.0). Ohne Freigabe gibt es keine Frist — sie beginnt mit ihr (4.5.2).
 *
 * Der Wert kommt aus `processDeadlineConfig` des Kunden (3.1), sonst aus der
 * Vorbelegung. Auf der **Einkaufsseite** gibt es keinen Kunden; dort gilt die
 * Vorbelegung, weil die Frist zwischen Betreiber und Lieferant läuft und 3.1
 * für den Lieferanten keinen Konfigurationssatz führt.
 */
function pruefFrist(row: {
  readonly releasedAt: Date | null
  readonly customer: { readonly processDeadlineConfig: unknown } | null
}): Date | null {
  if (row.releasedAt === null) return null
  const tage = fristTage(row.customer?.processDeadlineConfig)
  const ende = new Date(row.releasedAt)
  ende.setUTCDate(ende.getUTCDate() + tage)
  return ende
}

function fristTage(config: unknown): number {
  if (config === null || typeof config !== 'object') return BILLING_REVIEW_DEADLINE_DAYS
  const wert = (config as Record<string, unknown>)[BILLING_REVIEW_DEADLINE_KEY]
  return typeof wert === 'number' && Number.isFinite(wert) && wert > 0
    ? wert
    : BILLING_REVIEW_DEADLINE_DAYS
}

/* ------------------------------------------------------------------ */
/* Die Befunde aus Kapitel 5 (4.7, Q38 bis Q40)                        */
/* ------------------------------------------------------------------ */

/**
 * Die Prüfungen, die 4.7 der Belegerstellung zuordnet.
 *
 * **Q38 nur auf der Einkaufsseite** — so steht es in 4.7 („→ `created`
 * (Einkauf)"): die Erlaubnis ist die des Lieferanten, und auf der
 * Verkaufsseite rechnet der Betreiber mit dem Kunden ab. Q39 und Q40 gelten
 * beiden Seiten.
 *
 * Der **Prüfzeitraum** ist der Leistungszeitraum des Belegs: frühester
 * `periodFrom` bis spätester `periodTo` der zugrunde liegenden Zettel (5.0).
 */
async function befunde(row: LoadedDocument): Promise<readonly BillingFinding[]> {
  const liste: BillingFinding[] = []
  const zeitraum = await leistungszeitraum(row.id)
  if (zeitraum === null) return liste

  // ── Q38: P9, Erlaubnis im ganzen Leistungszeitraum (Einkaufsseite) ──────
  if (row.direction === 'purchase' && row.supplier !== null) {
    const erlaubnisse = await prisma.supplierPermit.findMany({
      where: { supplierId: row.supplier.id },
    })
    const urkunden = await prisma.document.findMany({
      where: { supplierId: row.supplier.id },
    })
    const stand = erlaubnisstand({
      lieferant: row.supplier.legalName,
      erlaubnisse: erlaubnisse.map((erlaubnis) => ({
        id: erlaubnis.id,
        permitNumber: erlaubnis.permitNumber,
        permitType: erlaubnis.permitType,
        validFrom: erlaubnis.validFrom,
        validTo: erlaubnis.validTo,
        verificationStatus: erlaubnis.verificationStatus,
        certificateDocumentRef: erlaubnis.certificateDocumentRef,
        supersedesId: erlaubnis.supersedesId,
      })),
      urkunden: urkunden.map((dokument) => ({
        id: dokument.id,
        documentCategory: dokument.documentCategory,
        validFrom: dokument.validFrom,
        validTo: dokument.validTo,
        verificationStatus: dokument.verificationStatus,
        fileRef: dokument.fileRef,
        subjectRef: dokument.supplierId,
      })),
      stichtag: null,
      zeitraum: { von: zeitraum.von, bis: zeitraum.bis },
      unterbrechungen: [],
    })
    liste.push({
      check: 'P9',
      row: 'Q38',
      satisfied: stand.hasAcceptedValidPermit,
      // „Erbrachte Leistung wird abgerechnet; der Befund wird dokumentiert,
      // die Abrechnung nicht blockiert" (5.4.2 b, bestätigt in 5.5.5).
      effect: 'Warnung',
      message: stand.meldung,
    })
  }

  // ── Q39: P4, Vergleichsentgelt für Zeiträume nach der Fälligkeit ────────
  const zeilen = await abgerechneteEinsaetze(row.id)
  const entgeltbefunde: string[] = []
  let entgeltErfuellt = true
  for (const einsatz of zeilen) {
    const eintraege = await prisma.comparableWageEntry.findMany({
      where: { siteId: einsatz.siteId },
    })
    const stand = entgeltstand({
      standort: einsatz.siteName,
      taetigkeit: einsatz.activityDescription,
      eintraege: eintraege.map((eintrag) => ({
        activityKey: eintrag.activityKey,
        comparableWage: Number(eintrag.comparableWage),
        wageSource: eintrag.wageSource,
        validFrom: eintrag.validFrom,
        validTo: eintrag.validTo,
        deactivatedAt: eintrag.deactivatedAt,
      })),
      einsatzwert: einsatz.comparableWage,
      abweichungBegruendet: einsatz.deviationReason !== null,
      faelligkeit: einsatz.equalPayDueDate,
      stichtag: null,
      zeitraum: { von: zeitraum.von, bis: zeitraum.bis },
    })
    if (stand.treffer) {
      entgeltErfuellt = false
      entgeltbefunde.push(`${einsatz.assignmentNumber}: ${stand.meldung}`)
    }
  }
  liste.push({
    check: 'P4',
    row: 'Q39',
    satisfied: entgeltErfuellt,
    effect: 'Warnung',
    message:
      entgeltbefunde.length === 0
        ? 'P4: zu jedem abgerechneten Einsatz liegt das Vergleichsentgelt vor, soweit es im ' +
          'Leistungszeitraum geschuldet ist (5.2.4).'
        : entgeltbefunde.join(' | '),
  })

  // ── Q40: P5, Plausibilität der Zuschlagsstufe ───────────────────────────
  const lieferantId = zeilen[0]?.supplierId ?? null
  const zuordnungen =
    lieferantId === null
      ? []
      : await prisma.collectiveAgreementAssignment.findMany({
          where: { supplierId: lieferantId },
        })
  const zuschlag = zuschlagsstand({
    verleiherzuordnungen: zuordnungen.map((zuordnung) => ({
      appliesToType: zuordnung.appliesToType,
      validFrom: zuordnung.validFrom,
      validTo: zuordnung.validTo,
      equalPayDeadlineMonths: zuordnung.equalPayDeadlineMonths,
      industryPremiumScheme: zuordnung.industryPremiumScheme,
    })),
    stichtag: zeitraum.bis,
    brancheBestimmbar: null,
    ueberlassungstage: zeilen[0]?.countedDurationDays ?? null,
    // Die Abweichung der Positionen von der Stufe ist erst beantwortbar, wenn
    // die Stufe bestimmbar ist — und die Stufenfolge ist Konfiguration am
    // Schema (3.3), die Kapitel 3 heute nicht führt. Ohne Stufe gibt es keine
    // Abweichung, nur eine fehlende Grundlage; die Meldung sagt das.
    positionenAbweichend: false,
  })
  liste.push({
    check: 'P5',
    row: 'Q40',
    satisfied: !zuschlag.treffer,
    // „Plausibilität der Stufe, nicht der Höhe" (5.5.5) — eine Information.
    effect: 'Information',
    message: zuschlag.meldung,
  })

  return liste
}

/** Der Leistungszeitraum des Belegs (5.0): über alle zugrunde liegenden Zettel. */
async function leistungszeitraum(
  billingDocumentId: string,
): Promise<{ readonly von: Date; readonly bis: Date } | null> {
  const zettel = await prisma.timesheet.findMany({
    where: { billingDocuments: { some: { id: billingDocumentId } } },
    select: { periodFrom: true, periodTo: true },
  })
  const erster = zettel[0]
  if (erster === undefined) return null
  return zettel.reduce(
    (zeitraum, zeile) => ({
      von: zeile.periodFrom < zeitraum.von ? zeile.periodFrom : zeitraum.von,
      bis: zeile.periodTo > zeitraum.bis ? zeile.periodTo : zeitraum.bis,
    }),
    { von: erster.periodFrom, bis: erster.periodTo },
  )
}

/** Die Einsätze, die dieser Beleg abrechnet — Grundlage von Q39 und Q40. */
async function abgerechneteEinsaetze(billingDocumentId: string): Promise<
  readonly {
    readonly assignmentNumber: string
    readonly siteId: string
    readonly siteName: string
    readonly supplierId: string
    readonly activityDescription: string
    readonly comparableWage: number | null
    readonly deviationReason: string | null
    readonly equalPayDueDate: Date | null
    readonly countedDurationDays: number | null
  }[]
> {
  const einsaetze = await prisma.assignment.findMany({
    where: { billingDocumentItems: { some: { billingDocumentId } } },
    include: { site: { select: { name: true } } },
    orderBy: { assignmentNumber: 'asc' },
  })
  return einsaetze.map((einsatz) => ({
    assignmentNumber: einsatz.assignmentNumber,
    siteId: einsatz.siteId,
    siteName: einsatz.site.name,
    supplierId: einsatz.supplierId,
    activityDescription: einsatz.activityDescription,
    comparableWage: einsatz.comparableWage === null ? null : Number(einsatz.comparableWage),
    deviationReason: einsatz.comparableWageDeviationReason,
    equalPayDueDate: einsatz.equalPayDueDate,
    countedDurationDays: einsatz.countedDurationDays,
  }))
}

/* ------------------------------------------------------------------ */
/* Abrechnungsperiode (3.9, 4.5.1)                                     */
/* ------------------------------------------------------------------ */

export interface NewBillingPeriodInput {
  readonly periodNumber: string
  readonly customerId: string | null
  readonly periodFrom: Date
  readonly periodTo: Date
  readonly closingDate: Date
}

/**
 * Öffnet eine Abrechnungsperiode (4.5.1, `— → open`).
 *
 * Die Periode entsteht **offen**; einen Entwurfszustand führt 4.5.1 nicht. Zur
 * Frage, warum das ein Übergang und keine Anlage ist, steht alles in
 * `lib/status/billingPeriod.ts` — kurz: Fußnote [33] nennt das Öffnen
 * ausdrücklich als Statusvorgang des `MD`, und die Matrix gibt ihm auf dieser
 * Zeile kein `A`.
 */
/**
 * Die **beteiligten Lieferanten** einer Periode (4.5.1): wer in ihrem Zeitraum
 * einen Einsatz bei diesem Kunden hat, dessen `LD` erwartet Zeiterfassung und
 * Abrechnung — und wird adressiert.
 *
 * Jeder erhält seine **eigene** Nachricht (2.3, Regel 2); eine gemeinsame
 * würde den Lieferanten verraten, wer sonst beim Kunden arbeitet.
 */
async function beteiligteLieferanten(periode: {
  readonly customerId: string | null
  readonly periodFrom: Date
  readonly periodTo: Date
}): Promise<readonly string[]> {
  const einsaetze = await prisma.assignment.findMany({
    where: {
      ...(periode.customerId === null ? {} : { customerId: periode.customerId }),
      plannedStartDate: { lte: periode.periodTo },
      OR: [
        { plannedEndDate: null },
        { plannedEndDate: { gte: periode.periodFrom } },
        { actualEndDate: { gte: periode.periodFrom } },
      ],
    },
    select: { supplier: { select: { tenantId: true } } },
  })
  return [...new Set(einsaetze.map((einsatz) => einsatz.supplier.tenantId))]
}

export async function openBillingPeriod(
  identity: LoadedIdentity,
  input: NewBillingPeriodInput,
  evaluationDate: Date = new Date(),
): Promise<ActionResult> {
  if (input.periodNumber.trim() === '') return failure('Die Periodennummer ist Pflicht (3.9).')
  const operatorTenant = await prisma.tenant.findFirst({ where: { tenantType: 'operator' } })
  if (operatorTenant === null) return failure('Kein Betreibermandant vorhanden (3.11).')
  const kunde =
    input.customerId === null
      ? null
      : await prisma.customer.findUnique({ where: { id: input.customerId } })
  if (input.customerId !== null && kunde === null) return failure('Unbekannter Kunde.')

  const ueberlappend = await prisma.billingPeriod.count({
    where: {
      status: 'open',
      customerId: input.customerId,
      periodFrom: { lte: input.periodTo },
      periodTo: { gte: input.periodFrom },
    },
  })

  const ref = billingPeriodRef({
    tenantId: operatorTenant.id,
    customerTenantId: kunde?.tenantId ?? null,
    status: 'open',
  })
  const outcome = attemptTransition(BILLING_PERIOD_MODEL, 'open', {
    currentStatus: null,
    subject: identity.subject,
    resource: ref,
    facts: {
      datesComplete: true,
      rangeOrdered: input.periodTo >= input.periodFrom,
      noOverlappingOpenPeriod: ueberlappend === 0,
      undecidedTimesheets: 0,
      unfinishedDocuments: 0,
      evaluationDate,
    },
  })
  if (!outcome.applied) {
    await protokolliereGetrennt(
      ablehnungsEintrag({
        rejection: outcome.rejection,
        bezug: protokollbezug('billingPeriod', input.periodNumber, operatorTenant.id),
        userId: identity.user.id,
        occurredAt: evaluationDate,
        statusTo: 'open',
        operation: 'create',
      }),
    )
    return failure(outcome.rejection.reason, outcome.rejection.specReference)
  }

  const lieferanten = await beteiligteLieferanten({
    customerId: input.customerId,
    periodFrom: input.periodFrom,
    periodTo: input.periodTo,
  })

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
        uebergangsEintrag({
          outcome,
          bezug: protokollbezug('billingPeriod', periode.id, periode.tenantId),
          userId: identity.user.id,
          occurredAt: evaluationDate,
        }),
      )
      // 4.5.1: „Benachrichtigung an `LD` der beteiligten Lieferanten" (3.14).
      await benachrichtigeUebergang(tx, {
        objectType: 'billingPeriod',
        objectRef: periode.id,
        tenantId: periode.tenantId,
        uebergang: 'open',
        statusFrom: outcome.from,
        statusTo: outcome.to,
        bezeichnung: `Abrechnungsperiode ${periode.periodNumber}`,
        lage: { operator: operatorTenant.id, supplier: lieferanten },
        raisedAt: evaluationDate,
      })
    })
  } catch (error) {
    return asFailure(error, 'Abrechnungsperiode konnte nicht geöffnet werden')
  }
  return success(
    `${outcome.label}: ${input.periodNumber} ist offen (${outcome.specReference}). Zeiten und ` +
      'Belege dürfen jetzt entstehen (4.4, 4.5.2).',
  )
}

/** Der Stand einer Periode, soweit ihr Schluss ihn braucht (4.5.1). */
async function periodenstand(billingPeriodId: string): Promise<{
  readonly undecidedTimesheets: number
  readonly unfinishedDocuments: number
}> {
  const undecidedTimesheets = await prisma.timesheet.count({
    where: { billingPeriodId, status: { in: ['recorded', 'submitted', 'inApproval'] } },
  })
  const unfinishedDocuments = await prisma.billingDocument.count({
    where: { billingPeriodId, status: { in: ['created', 'inReview', 'disputed'] } },
  })
  return { undecidedTimesheets, unfinishedDocuments }
}

function periodenTatsachen(
  stand: { readonly undecidedTimesheets: number; readonly unfinishedDocuments: number },
  evaluationDate: Date,
): BillingPeriodFacts {
  return {
    datesComplete: true,
    rangeOrdered: true,
    noOverlappingOpenPeriod: true,
    undecidedTimesheets: stand.undecidedTimesheets,
    unfinishedDocuments: stand.unfinishedDocuments,
    evaluationDate,
  }
}

/**
 * Schließt eine Abrechnungsperiode (4.5.1, `open` → `closed`).
 *
 * **Endzustand**: es gibt keinen Weg zurück. Nachträgliche Zeiten laufen über
 * eine Korrekturfassung in der nächsten offenen Periode, nachträgliche Beträge
 * über Storno und Nachbeleg (4.5.1, Ausgeschlossen).
 */
export async function closeBillingPeriod(
  identity: LoadedIdentity,
  input: { readonly billingPeriodId: string },
  evaluationDate: Date = new Date(),
): Promise<ActionResult> {
  const periode = await prisma.billingPeriod.findUnique({
    where: { id: input.billingPeriodId },
    include: { customer: { select: { tenantId: true } } },
  })
  if (periode === null) return failure('Unbekannte Abrechnungsperiode.')

  const stand = await periodenstand(periode.id)
  const lieferanten = await beteiligteLieferanten(periode)
  const outcome = attemptTransition(BILLING_PERIOD_MODEL, 'close', {
    currentStatus: periode.status,
    subject: identity.subject,
    resource: billingPeriodRef({
      tenantId: periode.tenantId,
      customerTenantId: periode.customer?.tenantId ?? null,
      status: periode.status,
    }),
    facts: periodenTatsachen(stand, evaluationDate),
  })
  if (!outcome.applied) {
    await protokolliereGetrennt(
      ablehnungsEintrag({
        rejection: outcome.rejection,
        bezug: protokollbezug('billingPeriod', periode.id, periode.tenantId),
        userId: identity.user.id,
        occurredAt: evaluationDate,
        statusFrom: periode.status,
        statusTo: 'closed',
      }),
    )
    return failure(outcome.rejection.reason, outcome.rejection.specReference)
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.billingPeriod.update({
        where: { id: periode.id },
        data: {
          status: 'closed',
          closedAt: evaluationDate,
          closedById: identity.user.id,
          updatedById: identity.user.id,
        },
      })
      await protokolliere(
        tx,
        uebergangsEintrag({
          outcome,
          bezug: protokollbezug('billingPeriod', periode.id, periode.tenantId),
          userId: identity.user.id,
          occurredAt: evaluationDate,
        }),
      )
      // 4.5.1: „Benachrichtigung an `KE` und `LD`" (3.14). `KE` beim Kunden,
      // `LD` je beteiligtem Lieferanten — jeder einzeln (2.3, Regel 2).
      await benachrichtigeUebergang(tx, {
        objectType: 'billingPeriod',
        objectRef: periode.id,
        tenantId: periode.tenantId,
        uebergang: 'close',
        statusFrom: outcome.from,
        statusTo: outcome.to,
        bezeichnung: `Abrechnungsperiode ${periode.periodNumber}`,
        lage: {
          operator: periode.tenantId,
          customer: periode.customer?.tenantId ?? null,
          supplier: lieferanten,
        },
        raisedAt: evaluationDate,
      })
    })
  } catch (error) {
    return asFailure(error, 'Abrechnungsperiode konnte nicht geschlossen werden')
  }
  return success(
    `${outcome.label}: ${periode.periodNumber} steht auf ` +
      `„${BILLING_PERIOD_STATE_LABELS.closed}" (${outcome.specReference}). Zu dieser Periode ` +
      'entstehen keine Zettel und keine Belege mehr.',
  )
}

/* ------------------------------------------------------------------ */
/* Beleg erstellen (4.5.2, — → created)                                */
/* ------------------------------------------------------------------ */

export interface NewBillingDocumentInput {
  readonly billingPeriodId: string
  readonly direction: BillingDirection
  /** Pflicht bei `sales` (3.9). */
  readonly customerId: string | null
  /** Pflicht bei `purchase` (3.9). */
  readonly supplierId: string | null
  /** Steuersatz in Prozent — eine Angabe am Beleg (*offene Frage 52*). */
  readonly taxRate: number | null
}

/**
 * Erstellt einen Abrechnungsbeleg aus den genehmigten Zetteln der Periode
 * (4.5.2, `— → created`).
 *
 * Die Reihenfolge ist die von 4.5.2: erst die Zettel sammeln, dann die
 * Positionen **ableiten**, dann den Übergang prüfen, dann schreiben. Die
 * Positionen entstehen vor der Prüfung, weil zwei Vorbedingungen sie brauchen
 * — „Preisposition der jeweiligen Seite vorhanden" und „mindestens eine
 * Position": eine Vorbedingung über ein Ergebnis, das noch nicht gerechnet
 * ist, wäre nicht prüfbar.
 */
export async function createBillingDocument(
  identity: LoadedIdentity,
  input: NewBillingDocumentInput,
  evaluationDate: Date = new Date(),
): Promise<ActionResult> {
  const periode = await prisma.billingPeriod.findUnique({
    where: { id: input.billingPeriodId },
  })
  if (periode === null) return failure('Unbekannte Abrechnungsperiode.')
  const taxRate = input.taxRate
  if (taxRate === null || taxRate < 0) {
    return failure(
      'Der Steuersatz ist Pflicht (3.9). Woher er kommt, ist offene Frage 52 — bis zur Antwort ' +
        'ist er eine Angabe am Beleg und kein Festwert im Programm.',
      'SPEC 3.9',
    )
  }
  const operatorTenant = await prisma.tenant.findFirst({ where: { tenantType: 'operator' } })
  if (operatorTenant === null) return failure('Kein Betreibermandant vorhanden (3.11).')

  const kunde =
    input.direction === 'sales' && input.customerId !== null
      ? await prisma.customer.findUnique({ where: { id: input.customerId } })
      : null
  const lieferant =
    input.direction === 'purchase' && input.supplierId !== null
      ? await prisma.supplier.findUnique({ where: { id: input.supplierId } })
      : null
  if (input.direction === 'sales' && kunde === null) {
    return failure('Ein Verkaufsbeleg nennt seinen Kunden (3.9).')
  }
  if (input.direction === 'purchase' && lieferant === null) {
    return failure('Ein Einkaufsbeleg nennt seinen Lieferanten (3.9).')
  }

  const documentType = DOCUMENT_TYPE_BY_DIRECTION[input.direction]
  // Die Invarianten aus 3.9, die **zwei** Spalten betreffen und die Prisma
  // deshalb nicht erzwingt: Seite zur Belegart, genau eine Gegenpartei,
  // Steuersatz vorhanden.
  const verletzungen = pruefeAbrechnungsbeleg({
    documentType,
    direction: input.direction,
    customerId: kunde?.id ?? null,
    supplierId: lieferant?.id ?? null,
    taxRate,
  })
  const erste = verletzungen[0]
  if (erste !== undefined) return failure(`${erste.feld}: ${erste.grund}`, erste.specReference)
  const ref = billingDocumentRef({
    tenantId: operatorTenant.id,
    direction: input.direction,
    customerTenantId: kunde?.tenantId ?? null,
    supplierTenantId: lieferant?.tenantId ?? null,
    status: 'created',
    createdById: identity.user.id,
  })

  // Das Recht **vor** der Transaktion: ein verweigerter Versuch schreibt
  // seinen Eintrag in einer eigenen Transaktion (3.12), und die dürfte nicht
  // mit der Handlung zurückrollen.
  const decision = checkPermission(identity.subject, 'create', { ...ref, targetStatus: 'created' })
  if (!decision.allowed) {
    return verweigere(
      identity,
      decision,
      'create',
      'billingDocument',
      `${NUMBER_PREFIX[documentType]} (neu)`,
      operatorTenant.id,
    )
  }

  const auswahl = await abrechenbareZettel({
    billingPeriodId: periode.id,
    direction: input.direction,
    customerId: kunde?.id ?? null,
    supplierId: lieferant?.id ?? null,
  })
  const ableitung = belegpositionen({
    zeilen: auswahl.zeilen,
    preispositionen: auswahl.preispositionen,
    zuschlagsarten: auswahl.zuschlagsarten,
    stichtag: evaluationDate,
  })
  const summen = belegsummen(ableitung.positionen, taxRate)

  const outcome = attemptTransition(BILLING_DOCUMENT_MODEL, 'create', {
    currentStatus: null,
    subject: identity.subject,
    resource: ref,
    facts: {
      ...LEERE_BELEGTATSACHEN,
      direction: input.direction,
      typeMatchesDirection: true,
      timesheetCount: auswahl.zeilen.length,
      allTimesheetsApproved: auswahl.alleGenehmigt,
      billingPeriodStatus: periode.status,
      ratesPresent: ableitung.maengel.length === 0,
      itemCount: ableitung.positionen.length,
      actingUserId: identity.user.id,
      createdById: identity.user.id,
      evaluationDate,
    },
  })
  if (!outcome.applied) {
    await protokolliereGetrennt(
      ablehnungsEintrag({
        rejection: outcome.rejection,
        bezug: protokollbezug(
          'billingDocument',
          `${NUMBER_PREFIX[documentType]} (neu)`,
          operatorTenant.id,
        ),
        userId: identity.user.id,
        occurredAt: evaluationDate,
        statusTo: 'created',
        operation: 'create',
      }),
    )
    return failure(
      `${outcome.rejection.reason}${maengelText(ableitung.maengel)}`,
      outcome.rejection.specReference,
    )
  }

  let nummer = ''
  try {
    await prisma.$transaction(async (tx) => {
      nummer = await naechsteBelegnummer(tx, documentType)
      const beleg = await tx.billingDocument.create({
        data: {
          tenantId: operatorTenant.id,
          documentNumber: nummer,
          documentType,
          direction: input.direction,
          customerId: kunde?.id ?? null,
          supplierId: lieferant?.id ?? null,
          billingPeriodId: periode.id,
          issueDate: evaluationDate,
          netAmount: summen.netAmount,
          taxAmount: summen.taxAmount,
          grossAmount: summen.grossAmount,
          taxRate,
          currency: auswahl.currency,
          createdById: identity.user.id,
          status: 'created',
          basedOnTimesheets: {
            connect: auswahl.zeilen.map((zeile) => ({ id: zeile.timesheetId })),
          },
        },
      })
      for (const position of ableitung.positionen) {
        await tx.billingDocumentItem.create({
          data: {
            billingDocumentId: beleg.id,
            assignmentId: position.assignmentId,
            timesheetId: position.timesheetId,
            premiumTypeId: position.premiumTypeId,
            quantity: position.quantity,
            unit: 'hour',
            unitPrice: position.unitPrice,
            amount: position.amount,
            rateCardItemId: position.rateCardItemId,
            // Pflicht bei `sales` (3.9); auf der Einkaufsseite ist die
            // Kostenstelle für den Lieferanten nicht sichtbar ([14], 3.7).
            costCenterId: input.direction === 'sales' ? position.costCenterId : null,
            createdById: identity.user.id,
          },
        })
      }
      await protokolliere(
        tx,
        uebergangsEintrag({
          outcome,
          bezug: protokollbezug('billingDocument', beleg.id, beleg.tenantId),
          userId: identity.user.id,
          occurredAt: evaluationDate,
        }),
      )
    })
  } catch (error) {
    return asFailure(error, 'Der Abrechnungsbeleg konnte nicht erstellt werden')
  }

  return success(
    `${outcome.label}: ${nummer} über ${summen.netAmount.toFixed(2)} ${auswahl.currency} netto ` +
      `aus ${auswahl.zeilen.length} Stundenzettel(n), ${ableitung.positionen.length} Position(en) ` +
      `(${outcome.specReference}). Die Prüfungen P9, P4 und P5 stehen am Beleg (4.7, Q38 bis Q40).`,
  )
}

function maengelText(maengel: readonly { readonly premiumCode: string | null; readonly timesheetNumber: string; readonly reason: string }[]): string {
  if (maengel.length === 0) return ''
  return (
    ' Fehlende Sätze: ' +
    maengel
      .map(
        (mangel) =>
          `${mangel.timesheetNumber}${mangel.premiumCode === null ? ' (Grundleistung)' : ` (${mangel.premiumCode})`}: ${mangel.reason}`,
      )
      .join(' ')
  )
}

/** Leere Tatsachen — damit jede Aufrufstelle nur setzt, was sie kennt. */
const LEERE_BELEGTATSACHEN: BillingDocumentFacts = {
  direction: 'sales',
  typeMatchesDirection: true,
  timesheetCount: 0,
  allTimesheetsApproved: true,
  billingPeriodStatus: 'open',
  ratesPresent: true,
  itemCount: 0,
  amountsMatchTimesheets: true,
  actingUserId: '',
  createdById: '',
  disputeReason: null,
  withinReviewDeadline: true,
  openDispute: false,
  disputeResolutionNote: null,
  timesheetsChanged: false,
  correctionsApproved: true,
  cancellationReason: null,
  evaluationDate: new Date(0),
}

/**
 * Die nächste Belegnummer aus dem Nummernkreis der Belegart (3.9).
 *
 * Dieselbe Mechanik wie bei der Protokollnummer (3.12) und aus demselben
 * Grund: eine Datenbanksequenz zählt bei einem Rollback weiter und reißt eine
 * Lücke, die sich nicht mehr schließen lässt. Die Zeile wird gesperrt, bis die
 * Transaktion endet — gleichzeitige Belege warten aufeinander.
 */
async function naechsteBelegnummer(
  tx: Transaktion,
  documentType: keyof typeof NUMBER_PREFIX,
): Promise<string> {
  await tx.$executeRawUnsafe(
    `INSERT INTO "BillingNumberRange" ("documentType", "lastNumber")
     VALUES ($1::"BillingDocumentType", 0) ON CONFLICT ("documentType") DO NOTHING`,
    documentType,
  )
  const zeilen = await tx.$queryRawUnsafe<{ lastNumber: number }[]>(
    `SELECT "lastNumber" FROM "BillingNumberRange"
     WHERE "documentType" = $1::"BillingDocumentType" FOR UPDATE`,
    documentType,
  )
  const stand = zeilen[0]
  if (stand === undefined) {
    throw new Error(`SPEC 3.9: Der Nummernkreis ${documentType} fehlt.`)
  }
  const naechste = stand.lastNumber + 1
  await tx.$executeRawUnsafe(
    `UPDATE "BillingNumberRange" SET "lastNumber" = $2
     WHERE "documentType" = $1::"BillingDocumentType"`,
    documentType,
    naechste,
  )
  return `${NUMBER_PREFIX[documentType]}-${String(naechste).padStart(6, '0')}`
}

/**
 * Die Zettel, die auf diesen Beleg gehören — und die Sätze, mit denen sie
 * bepreist werden.
 *
 * **Genehmigt, zur Periode, zur Gegenseite, noch nicht abgerechnet.** Die
 * ersten drei stehen in 3.9 und 4.5.2. Die vierte folgt aus ihnen: ein Zettel,
 * der schon auf einem nicht stornierten Beleg **derselben Seite** steht, ist
 * abgerechnet; ihn erneut zu berechnen wäre keine zweite Abrechnung, sondern
 * eine falsche. Die andere Seite rechnet denselben Zettel sehr wohl noch
 * einmal ab — Kundenrechnung und Lieferantengutschrift beruhen auf denselben
 * Stunden zu verschiedenen Preisen (3.3).
 */
async function abrechenbareZettel(eingabe: {
  readonly billingPeriodId: string
  readonly direction: BillingDirection
  readonly customerId: string | null
  readonly supplierId: string | null
}): Promise<{
  readonly zeilen: readonly Abrechnungszeile[]
  readonly preispositionen: readonly Preisposition[]
  readonly zuschlagsarten: readonly Zuschlagsart[]
  readonly alleGenehmigt: boolean
  readonly currency: string
}> {
  const zettel = await prisma.timesheet.findMany({
    where: {
      billingPeriodId: eingabe.billingPeriodId,
      status: 'approved',
      assignment:
        eingabe.direction === 'sales'
          ? { customerId: eingabe.customerId ?? undefined }
          : { supplierId: eingabe.supplierId ?? undefined },
      // Noch nicht auf einem lebenden Beleg derselben Seite.
      billingDocuments: {
        none: { direction: eingabe.direction, status: { not: 'cancelled' } },
      },
    },
    include: {
      assignment: {
        include: {
          agreedRateCardItem: { include: { rateCard: { select: { id: true, currency: true } } } },
          customerRateCardItem: { include: { rateCard: { select: { id: true, currency: true } } } },
        },
      },
      entries: { include: { premiums: true } },
    },
    orderBy: { timesheetNumber: 'asc' },
  })

  const zeilen: Abrechnungszeile[] = []
  const preislistenIds = new Set<string>()
  let currency = 'EUR'

  for (const zeile of zettel) {
    const einsatz = zeile.assignment
    // Die Seite entscheidet, welcher Satz gilt — und ein abweichender Satz am
    // Einsatz geht der Preisposition vor (3.7, *offene Frage 17*). Er gilt nur
    // auf der **Einkaufsseite**: 3.7 führt `agreedHourlyRate` dort und für die
    // Kundenseite kein Gegenstück.
    const position =
      eingabe.direction === 'sales' ? einsatz.customerRateCardItem : einsatz.agreedRateCardItem
    const abweichend =
      eingabe.direction === 'purchase' && einsatz.agreedHourlyRate !== null
        ? Number(einsatz.agreedHourlyRate)
        : null
    const satz = abweichend ?? (position.hourlyRate === null ? null : Number(position.hourlyRate))
    preislistenIds.add(position.rateCard.id)
    currency = position.rateCard.currency

    const zuschlagsstunden = new Map<string, number>()
    let grundstunden = 0
    for (const eintrag of zeile.entries) {
      grundstunden += Number(eintrag.hours)
      for (const zuschlag of eintrag.premiums) {
        zuschlagsstunden.set(
          zuschlag.premiumTypeId,
          (zuschlagsstunden.get(zuschlag.premiumTypeId) ?? 0) + Number(zuschlag.hours),
        )
      }
    }

    zeilen.push({
      timesheetId: zeile.id,
      timesheetNumber: zeile.timesheetNumber,
      assignmentId: einsatz.id,
      assignmentNumber: einsatz.assignmentNumber,
      costCenterId: einsatz.costCenterId,
      baseHours: grundstunden,
      premiumHours: [...zuschlagsstunden.entries()].map(([premiumTypeId, hours]) => ({
        premiumTypeId,
        hours,
      })),
      basePrice: satz,
      // Bei einem abweichenden Satz nennt die Position keine Preisposition:
      // der Betrag kommt dann nicht aus der Preisliste (3.9).
      basePriceItemId: abweichend === null ? position.id : null,
      rateCardId: position.rateCard.id,
    })
  }

  const preispositionen = await prisma.rateCardItem.findMany({
    where: { rateCardId: { in: [...preislistenIds] }, deactivatedAt: null },
  })
  const arten = await prisma.premiumType.findMany({ where: { deactivatedAt: null } })

  return {
    zeilen,
    preispositionen: preispositionen.map((eintrag) => ({
      id: eintrag.id,
      rateCardId: eintrag.rateCardId,
      itemType: eintrag.itemType,
      premiumTypeId: eintrag.premiumTypeId,
      hourlyRate: eintrag.hourlyRate === null ? null : Number(eintrag.hourlyRate),
      premiumValue: eintrag.premiumValue === null ? null : Number(eintrag.premiumValue),
      validFrom: eintrag.validFrom,
      validTo: eintrag.validTo,
    })),
    zuschlagsarten: arten.map((art) => ({
      id: art.id,
      code: art.code,
      calculationBase: art.calculationBase,
    })),
    // Alle geladenen Zettel sind `approved` — die Tatsache steht trotzdem in
    // den Tatsachen, weil die Vorbedingung aus 4.5.2 sie nennt und eine
    // spätere Änderung der Auswahl sie nicht stillschweigend aufheben soll.
    alleGenehmigt: zettel.every((zeile) => zeile.status === 'approved'),
    currency,
  }
}

/* ------------------------------------------------------------------ */
/* Übergänge am Beleg (4.5.2)                                          */
/* ------------------------------------------------------------------ */

export interface BillingTransitionInput {
  readonly billingDocumentId: string
  readonly transition: BillingDocumentTransitionName
  /** Pflicht bei der Beanstandung (3.9). */
  readonly disputeReason?: string | null
  /** Pflicht bei der Klärung (4.5.2). */
  readonly disputeResolutionNote?: string | null
  /** Pflicht beim Storno (4.5.2). */
  readonly cancellationReason?: string | null
}

/**
 * Vollzieht einen Übergang am Beleg (4.5.2).
 *
 * **Ein** Eingang für sechs Übergänge, weil sie denselben Weg gehen: Tatsachen
 * erheben, Übergang prüfen, in einer Transaktion schreiben und protokollieren.
 * Welcher Übergang zulässig ist, entscheidet das Modell und nicht diese
 * Funktion — sie führt die Fallunterscheidung nur für die **Felder**, die der
 * jeweilige Übergang setzt (3.9).
 *
 * Der **Storno** ist die Ausnahme: er erzeugt zusätzlich einen neuen Beleg
 * (3.9) und steht deshalb in `cancelBillingDocument`.
 */
/**
 * Die Mandantenlage eines Belegs (3.14).
 *
 * Die **Seite** bestimmt die Gegenseite: 4.5.2 adressiert bei der Freigabe
 * „`KE` bzw. `LD`" und beim Storno „die Gegenseite" — `KE` auf der Verkaufs-,
 * `LD` auf der Einkaufsseite. Die **beanstandende** Seite ist dieselbe Rolle:
 * 4.5.2 gibt die Beanstandung im Verkauf `KE` ([31]) und im Einkauf `LD`
 * ([32]), eine dritte Möglichkeit führt die Tabelle nicht.
 */
function beleglage(row: {
  readonly direction: BillingDirection
  readonly customer: { readonly tenantId: string } | null
  readonly supplier: { readonly tenantId: string } | null
  readonly tenantId: string
}) {
  return {
    operator: row.tenantId,
    customer: row.customer?.tenantId ?? null,
    supplier: row.supplier?.tenantId ?? null,
    richtung: row.direction,
    beanstandendeSeite: row.direction === 'sales' ? ('KE' as const) : ('LD' as const),
  }
}

export async function transitionBillingDocument(
  identity: LoadedIdentity,
  input: BillingTransitionInput,
  evaluationDate: Date = new Date(),
): Promise<ActionResult> {
  const row = await prisma.billingDocument.findUnique({
    where: { id: input.billingDocumentId },
    include: DOCUMENT_INCLUDE,
  })
  if (row === null) return failure('Unbekannter Abrechnungsbeleg.')

  const facts = await belegTatsachen(row, identity, input, evaluationDate)
  const definition = BILLING_DOCUMENT_MODEL.transitions[input.transition]
  const outcome = attemptTransition(BILLING_DOCUMENT_MODEL, input.transition, {
    currentStatus: row.status,
    subject: identity.subject,
    resource: refFor(row),
    facts,
  })
  if (!outcome.applied) {
    await protokolliereGetrennt(
      ablehnungsEintrag({
        rejection: outcome.rejection,
        bezug: protokollbezug('billingDocument', row.id, row.tenantId),
        userId: identity.user.id,
        occurredAt: evaluationDate,
        statusFrom: row.status,
        statusTo: definition.to,
      }),
    )
    return failure(outcome.rejection.reason, outcome.rejection.specReference)
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.billingDocument.update({
        where: { id: row.id },
        data: {
          status: outcome.to,
          updatedById: identity.user.id,
          ...(input.transition === 'release'
            ? { releasedAt: evaluationDate, releasedById: identity.user.id }
            : {}),
          ...(input.transition === 'disputeBySales' || input.transition === 'disputeByPurchase'
            ? {
                disputeReason: input.disputeReason ?? null,
                disputedAt: evaluationDate,
                disputedById: identity.user.id,
                // Eine neue Beanstandung hebt die Klärung der vorigen auf:
                // sonst wäre die offene Beanstandung als geklärt vermerkt.
                disputeResolutionNote: null,
              }
            : {}),
          ...(input.transition === 'clarify'
            ? { disputeResolutionNote: input.disputeResolutionNote ?? null }
            : {}),
          ...(input.transition === 'confirm'
            ? { confirmedAt: evaluationDate, confirmedById: identity.user.id }
            : {}),
        },
      })
      await protokolliere(
        tx,
        uebergangsEintrag({
          outcome,
          bezug: protokollbezug('billingDocument', row.id, row.tenantId),
          userId: identity.user.id,
          occurredAt: evaluationDate,
          reason: input.disputeReason ?? input.disputeResolutionNote ?? null,
        }),
      )
      // 4.5.2, Spalte „Nebenwirkungen": Freigabe an die Gegenseite,
      // Beanstandung an `MD`, Klärung an die beanstandende Seite. Prüfung und
      // Bestätigung nennen keine Nachricht (3.14).
      await benachrichtigeUebergang(tx, {
        objectType: 'billingDocument',
        objectRef: row.id,
        tenantId: row.tenantId,
        uebergang: input.transition,
        statusFrom: outcome.from,
        statusTo: outcome.to,
        bezeichnung: `Abrechnungsbeleg ${row.documentNumber}`,
        lage: beleglage(row),
        raisedAt: evaluationDate,
      })
    })
  } catch (error) {
    return asFailure(error, 'Der Übergang am Abrechnungsbeleg konnte nicht gespeichert werden')
  }

  return success(
    `${outcome.label}: ${row.documentNumber} steht jetzt auf ` +
      `„${BILLING_DOCUMENT_STATE_LABELS[outcome.to]}" (${outcome.specReference}).` +
      (input.transition === 'release'
        ? ` Die Prüffrist läuft ${fristTage(row.customer?.processDeadlineConfig)} Kalendertage (4.0).`
        : ''),
  )
}

/**
 * Storniert einen Beleg und erzeugt den **Stornobeleg** (4.5.2, 3.9).
 *
 * „Der Storno erzeugt einen **neuen** Beleg mit `cancellationOf`; der alte
 * bleibt erhalten — Belegnummern bleiben lückenlos" (3.9, 4.5.2). Der
 * Stornobeleg trägt dieselben Positionen mit **negativen** Mengen: so bleibt
 * jede Zeile bis zur Zeitposition nachvollziehbar (3.9), und die Summe beider
 * Belege ist null.
 *
 * Er entsteht unmittelbar als `cancelled` — ein Stornobeleg wird nicht
 * geprüft, freigegeben oder beanstandet: er stellt nichts in Rechnung, er hebt
 * auf. Dass 4.5.2 für ihn keinen Lebenslauf führt, ist deshalb kein Mangel der
 * Spezifikation.
 */
export async function cancelBillingDocument(
  identity: LoadedIdentity,
  input: { readonly billingDocumentId: string; readonly cancellationReason: string | null },
  evaluationDate: Date = new Date(),
): Promise<ActionResult> {
  const row = await prisma.billingDocument.findUnique({
    where: { id: input.billingDocumentId },
    include: DOCUMENT_INCLUDE,
  })
  if (row === null) return failure('Unbekannter Abrechnungsbeleg.')

  const facts = await belegTatsachen(
    row,
    identity,
    { billingDocumentId: row.id, transition: 'cancel', cancellationReason: input.cancellationReason },
    evaluationDate,
  )
  const outcome = attemptTransition(BILLING_DOCUMENT_MODEL, 'cancel', {
    currentStatus: row.status,
    subject: identity.subject,
    resource: refFor(row),
    facts,
  })
  if (!outcome.applied) {
    await protokolliereGetrennt(
      ablehnungsEintrag({
        rejection: outcome.rejection,
        bezug: protokollbezug('billingDocument', row.id, row.tenantId),
        userId: identity.user.id,
        occurredAt: evaluationDate,
        statusFrom: row.status,
        statusTo: 'cancelled',
      }),
    )
    return failure(outcome.rejection.reason, outcome.rejection.specReference)
  }

  let stornonummer = ''
  try {
    await prisma.$transaction(async (tx) => {
      await tx.billingDocument.update({
        where: { id: row.id },
        data: {
          status: 'cancelled',
          cancelledAt: evaluationDate,
          cancelledById: identity.user.id,
          cancellationReason: input.cancellationReason,
          updatedById: identity.user.id,
        },
      })
      stornonummer = await naechsteBelegnummer(tx, row.documentType)
      const storno = await tx.billingDocument.create({
        data: {
          tenantId: row.tenantId,
          documentNumber: stornonummer,
          documentType: row.documentType,
          direction: row.direction,
          customerId: row.customerId,
          supplierId: row.supplierId,
          billingPeriodId: row.billingPeriodId,
          issueDate: evaluationDate,
          netAmount: -Number(row.netAmount),
          taxAmount: -Number(row.taxAmount),
          grossAmount: -Number(row.grossAmount),
          taxRate: row.taxRate,
          currency: row.currency,
          createdById: identity.user.id,
          status: 'cancelled',
          cancelledAt: evaluationDate,
          cancelledById: identity.user.id,
          cancellationReason: input.cancellationReason,
          cancellationOfId: row.id,
          basedOnTimesheets: {
            connect: row.basedOnTimesheets.map((zettel) => ({ id: zettel.id })),
          },
        },
      })
      for (const position of row.items) {
        await tx.billingDocumentItem.create({
          data: {
            billingDocumentId: storno.id,
            assignmentId: position.assignmentId,
            timesheetId: position.timesheetId,
            premiumTypeId: position.premiumTypeId,
            quantity: -Number(position.quantity),
            unit: position.unit,
            unitPrice: position.unitPrice,
            amount: -Number(position.amount),
            rateCardItemId: position.rateCardItemId,
            costCenterId: position.costCenterId,
            createdById: identity.user.id,
          },
        })
      }
      await protokolliere(
        tx,
        uebergangsEintrag({
          outcome,
          bezug: protokollbezug('billingDocument', row.id, row.tenantId),
          userId: identity.user.id,
          occurredAt: evaluationDate,
          reason: input.cancellationReason,
        }),
      )
      await protokolliere(
        tx,
        schreibEintrag({
          decision: outcome.decision,
          operation: 'create',
          bezug: protokollbezug('billingDocument', storno.id, storno.tenantId),
          userId: identity.user.id,
          occurredAt: evaluationDate,
          reason: input.cancellationReason,
        }),
      )
      // 4.5.2: „Benachrichtigung an die Gegenseite" (3.14). Sie nennt den
      // stornierten Beleg, nicht den Storno: der Vorgang, von dem die
      // Gegenseite weiß, ist der, den sie bekommen hat. Die Spalte verlangt
      // beim Storno **keine** Begründung in der Nachricht.
      await benachrichtigeUebergang(tx, {
        objectType: 'billingDocument',
        objectRef: row.id,
        tenantId: row.tenantId,
        uebergang: 'cancel',
        statusFrom: outcome.from,
        statusTo: outcome.to,
        bezeichnung: `Abrechnungsbeleg ${row.documentNumber}`,
        lage: beleglage(row),
        raisedAt: evaluationDate,
      })
    })
  } catch (error) {
    return asFailure(error, 'Der Beleg konnte nicht storniert werden')
  }

  return success(
    `${outcome.label}: ${row.documentNumber} ist storniert, der Stornobeleg ${stornonummer} ` +
      `trägt die Gegenbuchung (${outcome.specReference}). Die Stundenzettel sind damit wieder ` +
      'abrechenbar — ein Nachbeleg entsteht als neuer Beleg (3.9).',
  )
}

/**
 * Die Tatsachen, die 4.5.2 in der Spalte „Vorbedingungen" nennt.
 *
 * `amountsMatchTimesheets` wird **gerechnet**, nicht angenommen: die
 * Vorbedingung der Prüfung lautet „Summen abgeleitet und mit den Zetteln
 * abgeglichen", und ein Programm, das das für wahr hält, weil es die Summen
 * selbst geschrieben hat, prüft nichts. Der Abgleich läuft gegen die Zettel in
 * ihrem **heutigen** Stand — also auch gegen eine Korrekturfassung, die nach
 * der Erstellung entstanden ist.
 */
async function belegTatsachen(
  row: LoadedDocument,
  identity: LoadedIdentity,
  input: BillingTransitionInput,
  evaluationDate: Date,
): Promise<BillingDocumentFacts> {
  const zettelIds = row.basedOnTimesheets.map((zettel) => zettel.id)
  const stand = await prisma.timesheet.findMany({
    where: { id: { in: zettelIds } },
    include: {
      entries: { include: { premiums: true } },
      correction: { select: { status: true } },
      assignment: { select: { assignmentNumber: true } },
    },
  })
  const zeilen: Abrechnungszeile[] = stand.map((zettel) => {
    const zuschlagsstunden = new Map<string, number>()
    let grundstunden = 0
    for (const eintrag of zettel.entries) {
      grundstunden += Number(eintrag.hours)
      for (const zuschlag of eintrag.premiums) {
        zuschlagsstunden.set(
          zuschlag.premiumTypeId,
          (zuschlagsstunden.get(zuschlag.premiumTypeId) ?? 0) + Number(zuschlag.hours),
        )
      }
    }
    return {
      timesheetId: zettel.id,
      timesheetNumber: zettel.timesheetNumber,
      assignmentId: zettel.assignmentId,
      assignmentNumber: zettel.assignment.assignmentNumber,
      costCenterId: null,
      baseHours: grundstunden,
      premiumHours: [...zuschlagsstunden.entries()].map(([premiumTypeId, hours]) => ({
        premiumTypeId,
        hours,
      })),
      basePrice: null,
      basePriceItemId: null,
      rateCardId: null,
    }
  })

  const positionen: Belegposition[] = row.items.map((item) => ({
    timesheetId: item.timesheetId,
    assignmentId: item.assignmentId,
    premiumTypeId: item.premiumTypeId,
    quantity: Number(item.quantity),
    unitPrice: Number(item.unitPrice),
    amount: Number(item.amount),
    rateCardItemId: item.rateCardItemId,
    costCenterId: item.costCenterId,
  }))

  const geaendert = stand.filter((zettel) => zettel.status !== 'approved')
  const frist = pruefFrist(row)

  return {
    direction: row.direction,
    typeMatchesDirection:
      DOCUMENT_TYPE_BY_DIRECTION[row.direction] === row.documentType ||
      row.documentType === 'supplierInvoice',
    timesheetCount: zettelIds.length,
    allTimesheetsApproved: geaendert.length === 0,
    billingPeriodStatus: row.billingPeriod.status,
    ratesPresent: true,
    itemCount: row.items.length,
    amountsMatchTimesheets: summenStimmen({
      positionen,
      netAmount: Number(row.netAmount),
      taxAmount: Number(row.taxAmount),
      grossAmount: Number(row.grossAmount),
      taxRate: Number(row.taxRate),
      zeilen,
    }),
    actingUserId: identity.user.id,
    createdById: row.createdById,
    disputeReason: input.disputeReason ?? null,
    withinReviewDeadline: frist === null || frist >= evaluationDate,
    openDispute: row.disputedAt !== null && row.disputeResolutionNote === null,
    disputeResolutionNote: input.disputeResolutionNote ?? null,
    timesheetsChanged: geaendert.length > 0,
    correctionsApproved: geaendert.every((zettel) => zettel.correction?.status === 'approved'),
    cancellationReason: input.cancellationReason ?? null,
    evaluationDate,
  }
}

/* ------------------------------------------------------------------ */
/* Auswahl für die Oberfläche                                          */
/* ------------------------------------------------------------------ */

export interface BillingOptions {
  readonly periods: readonly { readonly id: string; readonly label: string }[]
  readonly customers: readonly { readonly id: string; readonly label: string }[]
  readonly suppliers: readonly { readonly id: string; readonly label: string }[]
  readonly mayCreate: boolean
  readonly mayOpenPeriod: boolean
  /** Was in der gewählten Periode überhaupt abzurechnen wäre (3.9). */
  readonly billable: readonly {
    readonly periodNumber: string
    readonly direction: BillingDirection
    readonly counterparty: string
    readonly counterpartyId: string
    readonly timesheetCount: number
  }[]
}

export async function loadBillingOptions(identity: LoadedIdentity): Promise<BillingOptions> {
  const operatorTenant = await prisma.tenant.findFirst({ where: { tenantType: 'operator' } })
  const perioden = await prisma.billingPeriod.findMany({
    where: { status: 'open' },
    orderBy: { periodNumber: 'asc' },
  })
  const kunden = await prisma.customer.findMany({ orderBy: { customerNumber: 'asc' } })
  const lieferanten = await prisma.supplier.findMany({ orderBy: { supplierNumber: 'asc' } })

  const anlegen =
    operatorTenant === null
      ? false
      : checkPermission(identity.subject, 'create', {
          ...billingDocumentRef({
            tenantId: operatorTenant.id,
            direction: 'sales',
            customerTenantId: kunden[0]?.tenantId ?? null,
            supplierTenantId: null,
            status: 'created',
            createdById: identity.user.id,
          }),
          targetStatus: 'created',
        }).allowed
  const periodeOeffnen =
    operatorTenant === null
      ? false
      : checkPermission(identity.subject, 'transition', {
          ...billingPeriodRef({
            tenantId: operatorTenant.id,
            customerTenantId: null,
            status: 'open',
          }),
          targetStatus: 'open',
        }).allowed

  // Was abzurechnen ist: je offener Periode und Gegenseite die Zahl der
  // genehmigten, noch nicht abgerechneten Zettel. Das ist die Antwort auf die
  // Frage, die am Anfang jeder Abrechnung steht — und sie wird gezählt, nicht
  // geschätzt.
  const offen: {
    periodNumber: string
    direction: BillingDirection
    counterparty: string
    counterpartyId: string
    timesheetCount: number
  }[] = []
  if (anlegen) {
    for (const periode of perioden) {
      for (const richtung of ['sales', 'purchase'] as const) {
        const gegenseiten = richtung === 'sales' ? kunden : lieferanten
        for (const gegenseite of gegenseiten) {
          const auswahl = await abrechenbareZettel({
            billingPeriodId: periode.id,
            direction: richtung,
            customerId: richtung === 'sales' ? gegenseite.id : null,
            supplierId: richtung === 'purchase' ? gegenseite.id : null,
          })
          if (auswahl.zeilen.length === 0) continue
          offen.push({
            periodNumber: periode.periodNumber,
            direction: richtung,
            counterparty: gegenseite.legalName,
            counterpartyId: gegenseite.id,
            timesheetCount: auswahl.zeilen.length,
          })
        }
      }
    }
  }

  return {
    periods: perioden.map((periode) => ({
      id: periode.id,
      label: `${periode.periodNumber} (${tag(periode.periodFrom)} bis ${tag(periode.periodTo)})`,
    })),
    customers: kunden.map((kunde) => ({ id: kunde.id, label: kunde.legalName })),
    suppliers: lieferanten.map((lieferant) => ({
      id: lieferant.id,
      label: lieferant.legalName,
    })),
    mayCreate: anlegen,
    mayOpenPeriod: periodeOeffnen,
    billable: offen,
  }
}
