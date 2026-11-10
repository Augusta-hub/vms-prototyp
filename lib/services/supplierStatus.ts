/**
 * Fachdienst Lieferantenstatus — SPEC **4.6**, Objekt `supplier` (3.2).
 *
 * Hier laufen die vier Querschnittszeilen zusammen, die 4.7 dem Lieferanten
 * zuordnet: **Q41** (P9 beim Freischalten), **Q42** (P10 beim Freischalten),
 * **Q43** (P9 und P10 beim Entsperren) und **Q44** (beide bei der
 * Reaktivierung). Alle vier tragen in 4.7 eine **Sperre**.
 *
 * **Der Stichtag ist der Tag des Übergangs** (5.0, Tabelle: „Lieferant
 * `onboarding` / `blocked` / `inactive` → `active`"). Nicht der Tag des
 * Aufrufs — auch wenn beides hier meist zusammenfällt, ist der Unterschied der
 * Grund, warum die Prüfung morgen dasselbe Ergebnis liefert.
 *
 * **Zeitraumbezogene Stammdaten werden mit dem Stichtag gelesen** (5.0): der
 * Rahmenvertrag gilt als `active`, wenn sein Status das sagt **und** sein
 * Zeitraum den Stichtag deckt. Der Status allein wäre die halbe Antwort — ein
 * abgelaufener Vertrag im Status `active` ist in 3.0 Festlegung 2 kein
 * gültiger Vertrag.
 *
 * Geschrieben wird nur, was 4.6 nennt: `status`, die Sperrangaben und die
 * beiden Begründungen — und der Audit-Eintrag aus 3.12, in **derselben**
 * Transaktion wie der Statuswechsel. Die Begründung steht in beiden: am Objekt,
 * weil die Vorbedingung sie liest, und im Eintrag, weil 4.6 sie dorthin legt
 * (*offene Frage 43*). Benachrichtigungen (4.6, jede Zeile) hat der Prototyp
 * nicht.
 */
import { alsNachweiszeile, erlaubnisstand, nachweisstand } from '../aueg/anbindung'
import { protokolliere, protokolliereGetrennt } from '../audit/record'
import { ablehnungsEintrag, uebergangsEintrag } from '../audit/transitions'
import { checkPermission } from '../authz/check'
import type { LoadedIdentity } from '../identity/loadSubject'
import { prisma } from '../prisma'
import { attemptTransition } from '../status/machine'
import {
  SUPPLIER_MODEL,
  SUPPLIER_STATE_LABELS,
  type SupplierFacts,
  type SupplierState,
  type SupplierTransitionName,
} from '../status/supplier'
import {
  asFailure,
  failure,
  loadEngagements,
  success,
  supplierRef,
  TransitionRejected,
  type ActionResult,
  type Engagements,
} from './common'

/* ------------------------------------------------------------------ */
/* Laden                                                               */
/* ------------------------------------------------------------------ */

/** Ein Befund aus Kapitel 5 zu diesem Lieferanten, in Worten. */
export interface SupplierFinding {
  readonly check: 'P9' | 'P10'
  readonly satisfied: boolean
  readonly message: string
}

export interface SupplierStatusView {
  readonly id: string
  readonly supplierNumber: string
  readonly legalName: string
  readonly state: SupplierState
  readonly stateLabel: string
  readonly blockReason: string | null
  readonly unblockReason: string | null
  readonly reactivationReason: string | null
  readonly validTo: string | null
  /** Die Übergänge, die diese Identität aus diesem Zustand auslösen darf. */
  readonly availableTransitions: readonly SupplierTransitionName[]
  /**
   * Warum ein Übergang nach `active` heute nicht geht — in der Sprache der
   * Spezifikation. Benannt und nicht verschwiegen: der Betreiber soll sehen,
   * welcher Nachweis fehlt, nicht nur, dass der Knopf fehlt (5.4.6).
   */
  readonly blockers: readonly string[]
  readonly findings: readonly SupplierFinding[]
  readonly runningAssignments: number
}

const SUPPLIER_INCLUDE = {
  permits: true,
  documents: true,
  masterAgreements: true,
  assignments: { select: { status: true } },
} as const

type LoadedSupplier = Awaited<
  ReturnType<typeof prisma.supplier.findMany<{ include: typeof SUPPLIER_INCLUDE }>>
>[number]

/**
 * Die Lieferanten mit ihrem Status, den möglichen Übergängen und den Befunden
 * aus Kapitel 5 — oder eine leere Liste, wenn diese Identität keinen sieht.
 *
 * Gelistet wird, was `checkPermission` erlaubt (2.3, Grundsatz). Die Befunde
 * werden **nur** für die Identitäten gerechnet, die einen Übergang auslösen
 * dürfen: ein Prüflauf beim Anzeigen einer Liste ist nach 5.5.1 ausdrücklich
 * **kein** Anlass, und die Ergebnisse hier sind deshalb Vorschau für den
 * Betreiber, nicht gespeicherte Prüfergebnisse.
 */
export async function loadSupplierStatus(
  identity: LoadedIdentity,
  evaluationDate: Date = new Date(),
): Promise<readonly SupplierStatusView[]> {
  const engagements = await loadEngagements()
  const suppliers = await prisma.supplier.findMany({
    include: SUPPLIER_INCLUDE,
    orderBy: { supplierNumber: 'asc' },
  })

  const views: SupplierStatusView[] = []
  for (const supplier of suppliers) {
    const decision = checkPermission(
      identity.subject,
      'read',
      supplierRef(supplier, engagements),
    )
    if (!decision.allowed) continue

    const state = supplier.status as SupplierState
    const erlaubnis = permitStand(supplier, evaluationDate)
    const nachweise = documentStand(supplier, 'Q42', evaluationDate)
    const running = runningAssignments(supplier)

    const facts = factsFor(supplier, identity, evaluationDate, {
      erlaubnis: erlaubnis.hasAcceptedValidPermit,
      nachweise: nachweise.mandatoryDocumentsPresent,
      running,
    })

    const available = offeredTransitions(supplier, state, identity, engagements, facts)
    // Für die **Vorschau** der offenen Vorbedingungen gelten die Begründungen
    // als gegeben: sie sind Eingaben des Übergangs und keine Lage der Welt.
    // „Der Aufhebungsgrund ist Pflicht" vor dem Ausfüllen des Feldes zu melden
    // wäre kein Befund, sondern Rauschen.
    const vorschau: SupplierFacts = {
      ...facts,
      unblockReason: '(wird beim Übergang eingegeben)',
      reactivationReason: '(wird beim Übergang eingegeben)',
    }
    views.push({
      id: supplier.id,
      supplierNumber: supplier.supplierNumber,
      legalName: supplier.legalName,
      state,
      stateLabel: SUPPLIER_STATE_LABELS[state],
      blockReason: supplier.blockReason,
      unblockReason: supplier.unblockReason,
      reactivationReason: supplier.reactivationReason,
      validTo: day(supplier.validTo),
      availableTransitions: available,
      blockers: unmetForActivation(state, vorschau),
      findings: [
        { check: 'P9', satisfied: erlaubnis.hasAcceptedValidPermit, message: erlaubnis.meldung },
        {
          check: 'P10',
          satisfied: nachweise.mandatoryDocumentsPresent,
          message: nachweise.meldung,
        },
      ],
      runningAssignments: running,
    })
  }
  return views
}

/* ------------------------------------------------------------------ */
/* Statuswechsel                                                       */
/* ------------------------------------------------------------------ */

export interface SupplierTransitionInput {
  readonly supplierId: string
  readonly transition: Exclude<SupplierTransitionName, 'create'>
  /** Pflicht bei `block` (3.2, 4.6). */
  readonly blockReason: string | null
  /** Pflicht bei `unblock` (4.6). */
  readonly unblockReason: string | null
  /** Pflicht bei `reactivate` (4.6). */
  readonly reactivationReason: string | null
  /** Pflicht bei `deactivate`, wenn das Objekt noch kein `validTo` trägt. */
  readonly validTo: Date | null
}

/**
 * Vollzieht einen Übergang aus 4.6.
 *
 * Der Stichtag ist der **Tag des Übergangs** (5.0) und wird nicht von außen
 * gesetzt — außer von den Tests, die 5.0 an einem festen Tag prüfen.
 */
export async function transitionSupplier(
  identity: LoadedIdentity,
  input: SupplierTransitionInput,
  evaluationDate: Date = new Date(),
): Promise<ActionResult> {
  const supplier = await prisma.supplier.findUnique({
    where: { id: input.supplierId },
    include: SUPPLIER_INCLUDE,
  })
  if (supplier === null) return failure('Unbekannter Lieferant.')

  const engagements = await loadEngagements()
  const state = supplier.status as SupplierState

  // Die Zeile aus 4.7, nach der P10 prüft: Q42 beim Freischalten, Q43 beim
  // Entsperren, Q44 bei der Reaktivierung. Sie entscheidet, **welche**
  // Nachweisarten der Katalog an diesem Übergang prüft (5.4.4).
  const qZeile =
    input.transition === 'activate' ? 'Q42' : input.transition === 'unblock' ? 'Q43' : 'Q44'
  const erlaubnis = permitStand(supplier, evaluationDate)
  const nachweise = documentStand(supplier, qZeile, evaluationDate)

  const facts = factsFor(supplier, identity, evaluationDate, {
    erlaubnis: erlaubnis.hasAcceptedValidPermit,
    nachweise: nachweise.mandatoryDocumentsPresent,
    running: runningAssignments(supplier),
    blockReason: input.blockReason,
    unblockReason: input.unblockReason,
    reactivationReason: input.reactivationReason,
    validTo: input.validTo ?? supplier.validTo,
  })

  const outcome = attemptTransition(SUPPLIER_MODEL, input.transition, {
    currentStatus: state,
    subject: identity.subject,
    resource: supplierRef(supplier, engagements),
    facts,
  })
  if (!outcome.applied) {
    // Der abgelehnte Versuch wird protokolliert (3.12) — in einer **eigenen**
    // Transaktion, weil die Handlung selbst nichts schreibt. Eine Sperre aus
    // Kapitel 5 steht als `blocked` mit `ruleRef` im Eintrag, eine
    // Verweigerung nach Kapitel 2 als `denied` (4.0, Regel 5).
    await protokolliereGetrennt(
      ablehnungsEintrag({
        rejection: outcome.rejection,
        bezug: protokollbezug(supplier),
        userId: identity.user.id,
        occurredAt: evaluationDate,
        statusFrom: state,
        statusTo: SUPPLIER_MODEL.transitions[input.transition]?.to ?? null,
      }),
    )
    return failure(outcome.rejection.reason, outcome.rejection.specReference)
  }

  const data: Record<string, unknown> = { status: outcome.to, updatedById: identity.user.id }
  if (input.transition === 'block') {
    data.blockReason = input.blockReason
    data.blockedAt = evaluationDate
    data.blockedById = identity.user.id
  }
  if (input.transition === 'unblock') {
    // Der Sperrvermerk bleibt stehen: er ist die Geschichte dieser
    // Organisation, nicht ihr Zustand. Nach 3.2 ist er Pflicht **bei**
    // `blocked`, nicht verboten danach — und ohne ihn wäre später nicht mehr
    // zu sehen, wer gesperrt hatte und weshalb aufgehoben wurde.
    data.unblockReason = input.unblockReason
  }
  if (input.transition === 'reactivate') {
    data.reactivationReason = input.reactivationReason
    // Die Beauftragung läuft wieder: ein Ende, das in der Vergangenheit liegt,
    // würde dem Status widersprechen (3.2, 4.6).
    data.validTo = null
  }
  if (input.transition === 'deactivate' && input.validTo !== null) {
    data.validTo = input.validTo
    data.deactivatedAt = evaluationDate
    data.deactivatedById = identity.user.id
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.supplier.update({ where: { id: supplier.id }, data })
      // Derselbe Vorgang: rollt der Statuswechsel zurück, gibt es auch keinen
      // Eintrag. Protokolliert wird, was geschehen ist (3.12).
      await protokolliere(
        tx,
        uebergangsEintrag({
          outcome,
          bezug: protokollbezug(supplier),
          userId: identity.user.id,
          occurredAt: evaluationDate,
          reason: begruendungFuer(input),
        }),
      )
    })
  } catch (error) {
    return asFailure(error, 'Der Statuswechsel am Lieferanten konnte nicht gespeichert werden')
  }

  // 4.6 nennt je Übergang Benachrichtigungen an `LA` und `LD` und eine
  // Eskalation an `MA`; der Prototyp verschickt nichts. Die Befunde aus
  // Kapitel 5 stehen im Ergebnis, damit sie nicht verloren gehen.
  const befunde =
    outcome.to === 'active' ? ` ${erlaubnis.meldung} ${nachweise.meldung}` : ''
  return success(
    `${outcome.label}: ${supplier.supplierNumber} steht jetzt auf ` +
      `„${SUPPLIER_STATE_LABELS[outcome.to]}" (${outcome.specReference}).${befunde}`,
  )
}

/* ------------------------------------------------------------------ */
/* Tatsachen erheben                                                   */
/* ------------------------------------------------------------------ */

/** P9 für den Lieferanten (5.4.1), mit dem Stichtag aus 5.0. */
function permitStand(supplier: LoadedSupplier, evaluationDate: Date) {
  return erlaubnisstand({
    lieferant: supplier.legalName,
    erlaubnisse: supplier.permits,
    urkunden: supplier.documents.map(alsNachweiszeile),
    stichtag: evaluationDate,
    zeitraum: null,
    // Unterbrechungen sind hier ohne Belang: geprüft wird ein **Tag**, nicht
    // ein Überlassungszeitraum (5.4.5, „Unterbrechung exakt drei Monate").
    unterbrechungen: [],
  })
}

/** P10 für den Lieferanten (5.4.4) — Katalogarten mit Bezug „lieferant". */
function documentStand(supplier: LoadedSupplier, qZeile: string, evaluationDate: Date) {
  return nachweisstand({
    nachweise: supplier.documents.map(alsNachweiszeile),
    qZeile,
    bezugsobjekt: supplier.id,
    stichtag: evaluationDate,
    zeitraum: null,
    // Beide Angaben betreffen Kandidat und Standort und sind am Lieferanten
    // ohne Belang; der Katalog führt für ihn nur Arten mit Bezug „lieferant".
    arbeitserlaubnisErforderlich: null,
    unterweisungVerlangt: null,
  })
}

/** Einsätze, die 4.6 der Beendigung entgegenhält (4.3). */
function runningAssignments(supplier: LoadedSupplier): number {
  return supplier.assignments.filter(
    (einsatz) =>
      einsatz.status === 'planned' ||
      einsatz.status === 'active' ||
      einsatz.status === 'interrupted',
  ).length
}

function factsFor(
  supplier: LoadedSupplier,
  identity: LoadedIdentity,
  evaluationDate: Date,
  teile: {
    readonly erlaubnis: boolean
    readonly nachweise: boolean
    readonly running: number
    readonly blockReason?: string | null
    readonly unblockReason?: string | null
    readonly reactivationReason?: string | null
    readonly validTo?: Date | null
  },
): SupplierFacts {
  return {
    supplierNumber: supplier.supplierNumber,
    legalName: supplier.legalName,
    addressComplete:
      supplier.addressStreet.trim() !== '' &&
      supplier.addressPostalCode.trim() !== '' &&
      supplier.addressCity.trim() !== '',
    // Der Ansprechpartner ist nach 3.2 Pflicht und wird mit der Anlage
    // geschrieben; für die Übergänge nach `active` zählt er nicht.
    contactCount: 1,
    hasActiveMasterAgreement: supplier.masterAgreements.some(
      (vertrag) =>
        vertrag.status === 'active' &&
        vertrag.agreementType === 'supplierAgreement' &&
        vertrag.validFrom.getTime() <= evaluationDate.getTime() &&
        (vertrag.validTo === null || vertrag.validTo.getTime() >= evaluationDate.getTime()),
    ),
    hasCollectiveAgreement: supplier.supplierCollectiveAgreementId !== null,
    hasAcceptedValidPermit: teile.erlaubnis,
    mandatoryDocumentsPresent: teile.nachweise,
    blockReason: teile.blockReason ?? supplier.blockReason,
    blockedById: supplier.blockedById,
    actingUserId: identity.user.id,
    unblockReason: teile.unblockReason ?? null,
    reactivationReason: teile.reactivationReason ?? null,
    validTo: teile.validTo ?? supplier.validTo,
    runningAssignments: teile.running,
    evaluationDate,
  }
}

/* ------------------------------------------------------------------ */
/* Was die Oberfläche anbietet                                         */
/* ------------------------------------------------------------------ */

/**
 * Welche Übergänge darf **diese** Identität aus diesem Zustand auslösen?
 *
 * Geprüft wird der Zustand (4.6), die auslösende Rolle (4.6) und das Recht
 * samt Zielstatus (2.2, Fußnote [5] liest ihn) — **nicht** die
 * Vorbedingungen. Die bleiben draußen, weil eine fehlende Vorbedingung etwas
 * anderes ist als ein fehlendes Recht: sie ist behebbar, und die Oberfläche
 * soll sagen, was fehlt, statt den Weg zu verstecken. Nur die beiden
 * Angaben, die der Vorgang selbst nicht mehr ändern kann — ein laufender
 * Einsatz und das Vier-Augen-Prinzip — filtern mit, weil kein Eingabefeld
 * sie heilt.
 */
function offeredTransitions(
  supplier: LoadedSupplier,
  state: SupplierState,
  identity: LoadedIdentity,
  engagements: Engagements,
  facts: SupplierFacts,
): readonly SupplierTransitionName[] {
  const namen: readonly Exclude<SupplierTransitionName, 'create'>[] = [
    'activate',
    'block',
    'unblock',
    'deactivate',
    'reactivate',
  ]
  return namen.filter((name) => {
    const definition = SUPPLIER_MODEL.transitions[name]
    const ausZustaenden: readonly string[] = definition.from
    if (!ausZustaenden.includes(state)) return false
    if (name === 'deactivate' && facts.runningAssignments > 0) return false
    if (name === 'unblock' && supplier.blockedById === identity.user.id) return false
    const auslösende: readonly string[] = definition.roles
    const grants = identity.subject.grants.filter((eintrag) =>
      auslösende.includes(eintrag.roleCode),
    )
    if (grants.length === 0) return false
    return checkPermission({ ...identity.subject, grants }, 'transition', {
      ...supplierRef(supplier, engagements),
      targetStatus: definition.to,
    }).allowed
  })
}

/**
 * Die Vorbedingungen, die einem Weg nach `active` heute entgegenstehen — als
 * Sätze aus der Spezifikation. Gelesen werden sie aus dem Modell, nicht hier
 * aufgezählt: so kann die Liste nicht veralten.
 */
function unmetForActivation(state: SupplierState, facts: SupplierFacts): readonly string[] {
  const name: Exclude<SupplierTransitionName, 'create'> | null =
    state === 'onboarding'
      ? 'activate'
      : state === 'blocked'
        ? 'unblock'
        : state === 'inactive'
          ? 'reactivate'
          : null
  if (name === null) return []
  return SUPPLIER_MODEL.transitions[name].preconditions
    .filter((bedingung) => !bedingung.isSatisfied(facts))
    .map((bedingung) => bedingung.description)
}

function day(value: Date | null): string | null {
  return value === null ? null : value.toISOString().slice(0, 10)
}

/**
 * Die Nahtstelle zu Kapitel 5, ausdrücklich lesbar: was dieser Dienst **nicht**
 * rechnet.
 *
 * Leer — und das ist die Aussage. 4.7 ordnet dem Lieferantenstatus genau vier
 * Zeilen zu (Q41 bis Q44), und alle vier sind gerechnet. Die Konstante bleibt
 * stehen, damit eine spätere Zeile hier auffällt und nicht in einer stillen
 * Lücke verschwindet.
 */
export const SUPPLIER_RULE_CHECKS_PENDING: readonly string[] = []

/** Die Begründung, die ein Übergang braucht — für die Oberfläche. */
export function reasonFieldFor(
  transition: Exclude<SupplierTransitionName, 'create'>,
): 'blockReason' | 'unblockReason' | 'reactivationReason' | null {
  switch (transition) {
    case 'block':
      return 'blockReason'
    case 'unblock':
      return 'unblockReason'
    case 'reactivate':
      return 'reactivationReason'
    default:
      return null
  }
}

/** Deutsche Bezeichnung der Übergänge (4.6), für die Oberfläche. */
export const SUPPLIER_TRANSITION_LABELS: {
  readonly [T in Exclude<SupplierTransitionName, 'create'>]: string
} = {
  activate: 'freischalten (MA)',
  block: 'sperren (MA, MD)',
  unblock: 'entsperren (nur MA, [5])',
  deactivate: 'Beauftragung beenden (MA)',
  reactivate: 'reaktivieren (nur MA, [5])',
}

/* ------------------------------------------------------------------ */
/* Protokoll (3.12)                                                    */
/* ------------------------------------------------------------------ */

/**
 * Das Objekt, auf das sich der Eintrag bezieht: der **Lieferant**, mit seinem
 * eigenen Mandanten. Darauf beruht die Sichtbarkeit nach [39] — und darauf,
 * dass `MD` den Eintrag nicht lesen kann, obwohl er ihn auslöst (*offene
 * Frage 46*).
 */
function protokollbezug(supplier: { readonly id: string; readonly tenantId: string }) {
  return { objectType: 'supplier' as const, objectRef: supplier.id, tenantId: supplier.tenantId }
}

/**
 * Die Begründung, die 4.6 dem Übergang abverlangt — Sperrgrund,
 * Aufhebungsgrund, Reaktivierungsgrund. Sie ist `reason` im Audit-Eintrag
 * (3.12, Pflicht bei Korrektur und Übersteuerung; 4.6 legt sie ausdrücklich in
 * den Protokolleintrag). Die Beendigung verlangt keine.
 */
function begruendungFuer(input: SupplierTransitionInput): string | null {
  if (input.transition === 'block') return input.blockReason
  if (input.transition === 'unblock') return input.unblockReason
  if (input.transition === 'reactivate') return input.reactivationReason
  return null
}
