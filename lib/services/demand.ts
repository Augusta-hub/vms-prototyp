/**
 * Fachdienst Bedarfsanfrage, Ausschreibung, Einladung und Angebot —
 * SPEC 3.4 und 3.5 mit den Statusmodellen 4.1, 4.2.1 und 4.2.2.
 *
 * Die Arbeitsteilung ist strikt:
 *
 *  - **Was erlaubt ist**, entscheidet `checkPermission` (lib/authz).
 *  - **Welcher Übergang wann**, entscheidet das Statusmodell (lib/status).
 *  - **Welche Felder sichtbar sind**, entscheidet die Projektion
 *    (lib/visibility).
 *  - Dieses Modul erhebt die Tatsachen, führt die Reihenfolge und schreibt.
 *
 * Die Nebenwirkungen aus Kapitel 4, die der Prototyp noch nicht hat
 * (Benachrichtigungen, Fristenlauf, Audit-Eintrag aus 3.12), sind an ihrer
 * Stelle als Kommentar benannt — nicht stillschweigend weggelassen.
 */
import {
  alsNachweiszeile,
  erlaubnisstand,
  type Erlaubniszeile,
} from '../aueg/anbindung'
import { schreibEintrag, SYSTEM_ACTOR, type Protokollbezug } from '../audit/entry'
import { protokolliere, protokolliereGetrennt } from '../audit/record'
import { ablehnungsEintrag, uebergangsEintrag } from '../audit/transitions'
import { checkPermission, type Subject } from '../authz/check'
import type { LoadedIdentity } from '../identity/loadSubject'
import { prisma } from '../prisma'
import {
  attemptTransition,
  isTerminal,
  transitionsFrom,
  type TransitionOutcome,
} from '../status/machine'
import {
  DEMAND_REQUEST_MODEL,
  type DemandRequestFacts,
  type DemandRequestState,
  type DemandRequestTransitionName,
  type InvitedSupplierFact,
} from '../status/demandRequest'
import {
  SUPPLIER_OFFER_MODEL,
  type SupplierOfferFacts,
  type SupplierOfferState,
  type SupplierOfferTransitionName,
} from '../status/supplierOffer'
import {
  TENDER_INVITATION_MODEL,
  type TenderInvitationFacts,
  type TenderInvitationState,
  type TenderInvitationTransitionName,
} from '../status/tenderInvitation'
import { concealedFields, project } from '../visibility/projections'
import {
  asFailure,
  costCenterRef,
  demandRequestRef,
  failure,
  loadEngagements,
  protokollbezug,
  siteRef,
  success,
  supplierOfferRef,
  tenderInvitationRef,
  tenderRef,
  type ActionResult,
} from './common'

export interface DemandRequestFields {
  readonly requestNumber: string
  readonly title: string
  readonly customer: string
  readonly site: string
  readonly costCenterNumber: string
  readonly activityDescription: string
  readonly qualifications: string
  readonly headcount: string
  readonly startDate: string
  readonly endDate: string | null
  readonly weeklyHours: string
  readonly offerDeadline: string | null
  readonly maxHourlyRate: string | null
  readonly internalNote: string | null
  readonly requestedBy: string
  readonly approvedBy: string | null
  readonly rejectionReason: string | null
  readonly cancellationReason: string | null
}

export interface DemandRequestListEntry {
  readonly id: string
  readonly status: DemandRequestState
  readonly fields: Partial<DemandRequestFields>
  readonly concealed: readonly string[]
  /** Übergänge, die aus diesem Zustand führen und die diese Identität auslösen darf. */
  readonly availableTransitions: readonly {
    readonly name: DemandRequestTransitionName
    readonly label: string
  }[]
  readonly terminal: boolean
  readonly tenders: readonly TenderSummary[]
}

export interface TenderSummary {
  readonly id: string
  readonly tenderNumber: string
  readonly tenderRound: number
  readonly offerDeadline: string
  readonly closedAt: string | null
  readonly invitations: readonly InvitationSummary[]
}

export interface InvitationFields {
  readonly supplier: string
  readonly invitationStatus: string
  readonly invitedAt: string
  readonly viewedAt: string | null
  readonly respondedAt: string | null
  readonly declineReason: string | null
}

export interface InvitationSummary {
  readonly id: string
  readonly status: TenderInvitationState
  readonly fields: Partial<InvitationFields>
  readonly concealed: readonly string[]
  readonly offer: OfferSummary | null
}

export interface OfferFields {
  readonly offerNumber: string
  readonly supplier: string
  readonly availableFrom: string
  readonly offeredHeadcount: string
  readonly offerValidUntil: string | null
  readonly note: string | null
  readonly rejectionReason: string | null
}

export interface OfferItemFields {
  readonly qualificationLevel: string
  readonly headcount: string
  readonly hourlyRate: string | null
  readonly rateDeviationReason: string | null
}

export interface OfferSummary {
  readonly id: string
  readonly status: SupplierOfferState
  readonly fields: Partial<OfferFields>
  readonly concealed: readonly string[]
  readonly items: readonly Partial<OfferItemFields>[]
  readonly availableTransitions: readonly {
    readonly name: SupplierOfferTransitionName
    readonly label: string
  }[]
}

const DAY = (value: Date | null): string | null =>
  value === null ? null : value.toISOString().slice(0, 10)
const REQUIRED_DAY = (value: Date): string => value.toISOString().slice(0, 10)
const MINUTE = (value: Date | null): string | null =>
  value === null ? null : value.toISOString().slice(0, 16).replace('T', ' ')

/** Alles, was zu einer Anfrage gelesen wird — einmal geladen, mehrfach geprüft. */
const DEMAND_REQUEST_INCLUDE = {
  customer: true,
  site: true,
  costCenter: true,
  requestedBy: true,
  approvedBy: true,
  qualificationRequirements: true,
  // Seit 3.6 und 3.7: die Zählungen, die 4.1 in seinen Vorbedingungen nennt.
  candidateSubmissions: true,
  assignments: true,
  tenders: {
    include: {
      invitations: {
        include: {
          supplier: true,
          offer: { include: { items: true, submissions: true } },
        },
      },
    },
  },
} as const

type LoadedDemandRequest = Awaited<
  ReturnType<typeof prisma.demandRequest.findMany<{ include: typeof DEMAND_REQUEST_INCLUDE }>>
>[number]

/**
 * Die Anfragen, die diese Identität sehen darf — in der sichtbaren Fassung und
 * mit den Übergängen, die sie auslösen kann.
 */
export async function loadDemandRequests(
  identity: LoadedIdentity,
  evaluationDate: Date = new Date(),
): Promise<readonly DemandRequestListEntry[]> {
  const requests = await prisma.demandRequest.findMany({
    include: DEMAND_REQUEST_INCLUDE,
    orderBy: [{ customerId: 'asc' }, { requestNumber: 'asc' }],
  })

  return requests.flatMap((request) => {
    const status = request.status as DemandRequestState
    const invitedTenants = invitedSupplierTenantIds(request)
    const ref = demandRequestRef(request, invitedTenants)
    const decision = checkPermission(identity.subject, 'read', ref)
    const fields = project(describeDemandRequest(request), decision)
    if (fields === null) return []

    const facts = factsFromRequest(request, identity, evaluationDate)
    const availableTransitions = transitionsFrom(DEMAND_REQUEST_MODEL, status)
      .flatMap((name) => {
        const outcome = attemptTransition(DEMAND_REQUEST_MODEL, name, {
          currentStatus: status,
          subject: identity.subject,
          resource: ref,
          facts,
        })
        // Angezeigt wird, was die Rolle überhaupt auslösen darf. Eine
        // unerfüllte Vorbedingung bleibt sichtbar — sie ist der Grund, warum
        // die Handlung noch nicht möglich ist, und wird beim Versuch benannt.
        if (!outcome.applied && outcome.rejection.kind !== 'precondition') return []
        return [{ name, label: DEMAND_REQUEST_MODEL.transitions[name].label }]
      })

    return [
      {
        id: request.id,
        status,
        fields,
        concealed: concealedFields(decision),
        availableTransitions,
        terminal: isTerminal(DEMAND_REQUEST_MODEL, status),
        tenders: visibleTenders(request, identity, evaluationDate),
      },
    ]
  })
}

function describeDemandRequest(request: LoadedDemandRequest): DemandRequestFields {
  return {
    requestNumber: request.requestNumber,
    title: request.title,
    customer: request.customer.legalName,
    site: request.site.name,
    costCenterNumber: request.costCenter.costCenterNumber,
    activityDescription: request.activityDescription,
    qualifications: request.qualificationRequirements
      .map(
        (requirement) =>
          `${requirement.qualification} (${requirement.requirementKind === 'mandatory' ? 'Pflicht' : 'Wunsch'})`,
      )
      .join(', '),
    headcount: String(request.headcount),
    startDate: REQUIRED_DAY(request.startDate),
    endDate: DAY(request.endDate),
    weeklyHours: request.weeklyHours.toString(),
    offerDeadline: MINUTE(request.offerDeadline),
    maxHourlyRate: request.maxHourlyRate?.toString() ?? null,
    internalNote: request.internalNote,
    requestedBy: `${request.requestedBy.givenName} ${request.requestedBy.familyName}`,
    approvedBy:
      request.approvedBy === null
        ? null
        : `${request.approvedBy.givenName} ${request.approvedBy.familyName}`,
    rejectionReason: request.rejectionReason,
    cancellationReason: request.cancellationReason,
  }
}

function invitedSupplierTenantIds(request: LoadedDemandRequest): readonly string[] {
  const tenants = new Set<string>()
  for (const tender of request.tenders) {
    for (const invitation of tender.invitations) tenants.add(invitation.supplier.tenantId)
  }
  return [...tenants]
}

/**
 * Ausschreibungen und Einladungen in der Fassung, die diese Identität sehen
 * darf. Der Lieferant sieht **nur** die eigene Einladung ([16]) — nie die
 * Teilnehmerliste, nie die Zahl der Eingeladenen (2.3).
 */
function visibleTenders(
  request: LoadedDemandRequest,
  identity: LoadedIdentity,
  evaluationDate: Date,
): readonly TenderSummary[] {
  return request.tenders.flatMap((tender) => {
    const tenderDecision = checkPermission(
      identity.subject,
      'read',
      tenderRef({ tenantId: tender.tenantId, customerTenantId: request.tenantId }),
    )

    const invitations = tender.invitations.flatMap((invitation) => {
      const ref = tenderInvitationRef({
        tenantId: invitation.tenantId,
        customerTenantId: request.tenantId,
        supplierTenantId: invitation.supplier.tenantId,
        invitationStatus: invitation.invitationStatus,
      })
      const decision = checkPermission(identity.subject, 'read', ref)
      const fields = project(
        {
          supplier: invitation.supplier.legalName,
          invitationStatus: invitation.invitationStatus,
          invitedAt: REQUIRED_DAY(invitation.invitedAt),
          viewedAt: DAY(invitation.viewedAt),
          respondedAt: DAY(invitation.respondedAt),
          declineReason: invitation.declineReason,
        } satisfies InvitationFields,
        decision,
      )
      if (fields === null) return []
      return [
        {
          id: invitation.id,
          status: invitation.invitationStatus as TenderInvitationState,
          fields,
          concealed: concealedFields(decision),
          offer: visibleOffer(
            invitation,
            request.tenantId,
            identity,
            evaluationDate,
            tender.offerDeadline,
          ),
        },
      ]
    })

    // Ohne Recht an der Ausschreibung bleibt höchstens die eigene Einladung
    // sichtbar — das ist genau der Fall des Lieferanten.
    if (!tenderDecision.allowed) {
      if (invitations.length === 0) return []
      return [
        {
          id: tender.id,
          tenderNumber: '(nicht sichtbar)',
          tenderRound: tender.tenderRound,
          offerDeadline: MINUTE(tender.offerDeadline) ?? '',
          closedAt: null,
          invitations,
        },
      ]
    }

    return [
      {
        id: tender.id,
        tenderNumber: tender.tenderNumber,
        tenderRound: tender.tenderRound,
        offerDeadline: MINUTE(tender.offerDeadline) ?? '',
        closedAt: MINUTE(tender.closedAt),
        invitations,
      },
    ]
  })
}

type LoadedInvitation = LoadedDemandRequest['tenders'][number]['invitations'][number]

function visibleOffer(
  invitation: LoadedInvitation,
  customerTenantId: string,
  identity: LoadedIdentity,
  evaluationDate: Date,
  /** Angebotsfrist der Ausschreibung (3.5) — Vorbedingung in 4.2.2. */
  offerDeadline: Date | null,
): OfferSummary | null {
  const offer = invitation.offer
  if (offer === null) return null
  const ref = supplierOfferRef({
    tenantId: offer.tenantId,
    customerTenantId,
    status: offer.status,
  })
  const decision = checkPermission(identity.subject, 'read', ref)
  const fields = project(
    {
      offerNumber: offer.offerNumber,
      supplier: invitation.supplier.legalName,
      availableFrom: REQUIRED_DAY(offer.availableFrom),
      offeredHeadcount: String(offer.offeredHeadcount),
      offerValidUntil: DAY(offer.offerValidUntil),
      note: offer.note,
      rejectionReason: offer.rejectionReason,
    } satisfies OfferFields,
    decision,
  )
  if (fields === null) return null

  const status = offer.status as SupplierOfferState
  const facts: SupplierOfferFacts = {
    invitationStatus: invitation.invitationStatus as TenderInvitationState,
    offerDeadline,
    itemCount: offer.items.length,
    availableFrom: offer.availableFrom,
    offeredHeadcount: offer.offeredHeadcount,
    reviewedAt: offer.reviewedAt,
    rejectionReason: offer.rejectionReason,
    offerValidUntil: offer.offerValidUntil,
    // Seit 3.6 ein echter Wert: 4.2.2 lässt den Zuschlag nur, wenn mindestens
    // ein Profilvorschlag dieses Angebots zugesagt ist. Die Zusage trifft der
    // Kunde (4.2.3), den Zuschlag erteilt `MD` — zwei Handlungen, zwei Rollen.
    acceptedSubmissionCount: offer.submissions.filter(
      (submission) => submission.status === 'accepted',
    ).length,
    evaluationDate,
  }

  return {
    id: offer.id,
    status,
    fields,
    concealed: concealedFields(decision),
    items: offer.items.flatMap((item) => {
      const itemFields = project(
        {
          qualificationLevel: item.qualificationLevel,
          headcount: String(item.headcount),
          hourlyRate: `${item.hourlyRate.toString()} ${item.currency}`,
          rateDeviationReason: item.rateDeviationReason,
        } satisfies OfferItemFields,
        decision,
      )
      return itemFields === null ? [] : [itemFields]
    }),
    availableTransitions: transitionsFrom(SUPPLIER_OFFER_MODEL, status).flatMap((name) => {
      const outcome = attemptTransition(SUPPLIER_OFFER_MODEL, name, {
        currentStatus: status,
        subject: identity.subject,
        resource: ref,
        facts,
      })
      if (!outcome.applied && outcome.rejection.kind !== 'precondition') return []
      return [{ name, label: SUPPLIER_OFFER_MODEL.transitions[name].label }]
    }),
  }
}

function factsFromRequest(
  request: LoadedDemandRequest,
  identity: LoadedIdentity,
  evaluationDate: Date,
  overrides: Partial<DemandRequestFacts> = {},
): DemandRequestFacts {
  return {
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
    previousTenderClosed: request.tenders.every((tender) => tender.closedAt !== null),
    ...submissionAndAssignmentCounts(request),
    evaluationDate,
    ...overrides,
  }
}

/**
 * Die drei Zählungen, die 4.1 aus 3.6 und 3.7 braucht — seit dieser
 * Arbeitseinheit echte Werte statt `0`.
 *
 * `effectiveAssignmentCount` zählt `planned`, `active` **und** `interrupted`.
 * 4.1 schreibt bei `inSelection` → `filled` „in `planned` oder `active`"; ein
 * unterbrochener Einsatz ist aber ein laufender Einsatz, in dem nur keine
 * Arbeitsleistung erbracht wird (4.3.1). Zählte er nicht mit, ließe sich eine
 * Anfrage mit laufendem Einsatz noch stornieren („kein wirksamer Einsatz",
 * 4.1 → `cancelled`) — und das wäre das Gegenteil dessen, was die Vorbedingung
 * schützt.
 */
function submissionAndAssignmentCounts(request: LoadedDemandRequest): {
  readonly releasedSubmissionCount: number
  readonly openSubmissionCount: number
  readonly effectiveAssignmentCount: number
} {
  return {
    releasedSubmissionCount: request.candidateSubmissions.filter(
      (submission) => submission.status === 'releasedToCustomer',
    ).length,
    // „Offen" heißt: noch nicht abgelehnt und nicht zurückgezogen (4.1,
    // `inSelection` → `tendered`). Ein zugesagter Vorschlag ist damit auch
    // nicht „offen" — aber er verhindert den Rückfall, weil er zählt.
    openSubmissionCount: request.candidateSubmissions.filter(
      (submission) => submission.status !== 'rejected' && submission.status !== 'withdrawn',
    ).length,
    effectiveAssignmentCount: request.assignments.filter(
      (assignment) =>
        assignment.status === 'planned' ||
        assignment.status === 'active' ||
        assignment.status === 'interrupted',
    ).length,
  }
}

// ── Bedarfsanfrage anlegen und wechseln ────────────────────────────────────

export interface NewDemandRequestInput {
  readonly requestNumber: string
  readonly siteId: string
  readonly costCenterId: string
  readonly title: string
  readonly activityDescription: string
  readonly qualification: string
  readonly headcount: number
  readonly startDate: Date
  readonly endDate: Date | null
  readonly weeklyHours: number
  readonly maxHourlyRate: number | null
  readonly internalNote: string | null
  /** Bedarfsträger; bei Anlage durch `MD` der Auftraggeber ([10]). */
  readonly requestedById: string
}

export async function createDemandRequest(
  identity: LoadedIdentity,
  input: NewDemandRequestInput,
  evaluationDate: Date = new Date(),
): Promise<ActionResult> {
  const site = await prisma.site.findUnique({ where: { id: input.siteId } })
  const costCenter = await prisma.costCenter.findUnique({ where: { id: input.costCenterId } })
  if (site === null || costCenter === null) return failure('Standort oder Kostenstelle unbekannt.')
  if (costCenter.customerId !== site.customerId) {
    return failure('Standort und Kostenstelle gehören zu verschiedenen Kunden (3.4).')
  }
  if (input.requestNumber.trim() === '' || input.title.trim() === '') {
    return failure('Anfragenummer und Titel sind Pflicht (3.4).')
  }

  const requester = await prisma.user.findUnique({ where: { id: input.requestedById } })
  if (requester === null || requester.tenantId !== site.tenantId) {
    return failure('Der Bedarfsträger gehört nicht zum Kunden dieses Standorts (3.4).')
  }

  const ref = demandRequestRef(
    {
      tenantId: site.tenantId,
      siteId: site.id,
      costCenterId: costCenter.id,
      requestedById: input.requestedById,
      status: 'draft',
    },
    [],
  )

  const outcome = attemptTransition(DEMAND_REQUEST_MODEL, 'create', {
    currentStatus: null,
    subject: identity.subject,
    resource: ref,
    facts: {
      requestedById: input.requestedById,
      actingUserId: identity.user.id,
      activityDescription: input.activityDescription,
      qualificationRequirementCount: input.qualification.trim() === '' ? 0 : 1,
      siteId: site.id,
      costCenterId: costCenter.id,
      startDate: input.startDate,
      weeklyHours: input.weeklyHours,
      headcount: input.headcount,
      offerDeadline: null,
      cancellationReason: null,
      rejectionReason: null,
      invitedSuppliers: [],
      previousTenderClosed: true,
      // Eine neue Anfrage hat noch keinen Profilvorschlag und keinen Einsatz —
      // hier ist die Null die Tatsache, nicht eine offene Stelle.
      releasedSubmissionCount: 0,
      openSubmissionCount: 0,
      effectiveAssignmentCount: 0,
      evaluationDate,
    },
  })
  if (!outcome.applied) {
    return rejection(outcome, {
      // Noch kein Vorgang: die Anfragenummer tritt ein (*offene Frage 44*).
      bezug: protokollbezug('demandRequest', input.requestNumber, site.tenantId),
      userId: identity.user.id,
      statusTo: 'draft',
      operation: 'create',
    })
  }

  // Die Rechteprüfung zur Anlage steckt im Übergang `create`: 4.1 nennt
  // „— → draft", und das Modell prüft dafür die Operation `A` aus 2.2 — für
  // `MD` also `A[10]`, die Anlage im Auftrag mit Kennzeichnung.
  const onBehalf =
    identity.tenant.tenantType === 'operator' ? { createdOnBehalfOfId: input.requestedById } : {}

  try {
    await prisma.$transaction(async (tx) => {
      const angelegt = await tx.demandRequest.create({
        data: {
          tenantId: site.tenantId,
          requestNumber: input.requestNumber.trim(),
          customerId: site.customerId,
          siteId: site.id,
          costCenterId: costCenter.id,
          requestedById: input.requestedById,
          ...onBehalf,
          title: input.title.trim(),
          activityDescription: input.activityDescription.trim(),
          headcount: input.headcount,
          startDate: input.startDate,
          endDate: input.endDate,
          weeklyHours: input.weeklyHours,
          maxHourlyRate: input.maxHourlyRate,
          currency: input.maxHourlyRate === null ? null : 'EUR',
          internalNote: input.internalNote,
          status: 'draft',
          createdById: identity.user.id,
          qualificationRequirements:
            input.qualification.trim() === ''
              ? undefined
              : {
                  create: [
                    {
                      qualification: input.qualification.trim(),
                      requirementKind: 'mandatory',
                      createdById: identity.user.id,
                    },
                  ],
                },
        },
      })
      await protokolliere(
        tx,
        uebergangsEintrag({
          outcome,
          bezug: protokollbezug('demandRequest', angelegt.id, angelegt.tenantId),
          userId: identity.user.id,
          occurredAt: evaluationDate,
        }),
      )
    })
  } catch (error) {
    return asFailure(error, 'Bedarfsanfrage konnte nicht angelegt werden')
  }
  return success(`Bedarfsanfrage ${input.requestNumber} im Entwurf angelegt (4.1).`)
}

export interface DemandTransitionInput {
  readonly demandRequestId: string
  readonly transition: DemandRequestTransitionName
  /** Begründung für Rückweisung oder Storno, je nach Übergang Pflicht (4.1). */
  readonly reason: string | null
}

/**
 * Vollzieht einen Übergang der Bedarfsanfrage nach 4.1. Die Pflichtbegründung
 * wird **vor** dem Übergang in die Tatsachen gelegt, damit die Vorbedingung sie
 * sieht — und erst mit dem Übergang gespeichert.
 */
export async function transitionDemandRequest(
  identity: LoadedIdentity,
  input: DemandTransitionInput,
  evaluationDate: Date = new Date(),
): Promise<ActionResult> {
  const request = await prisma.demandRequest.findUnique({
    where: { id: input.demandRequestId },
    include: DEMAND_REQUEST_INCLUDE,
  })
  if (request === null) return failure('Unbekannte Bedarfsanfrage.')

  const reason = input.reason?.trim() === '' ? null : (input.reason ?? null)
  const facts = factsFromRequest(request, identity, evaluationDate, {
    ...(input.transition === 'returnToDraft' ? { rejectionReason: reason } : {}),
    ...(input.transition === 'cancel' ? { cancellationReason: reason } : {}),
  })

  const status = request.status as DemandRequestState
  const outcome = attemptTransition(DEMAND_REQUEST_MODEL, input.transition, {
    currentStatus: status,
    subject: identity.subject,
    resource: demandRequestRef(request, invitedSupplierTenantIds(request)),
    facts,
  })
  if (!outcome.applied) {
    return rejection(outcome, {
      bezug: protokollbezug('demandRequest', request.id, request.tenantId),
      userId: identity.user.id,
      statusFrom: status,
      statusTo: DEMAND_REQUEST_MODEL.transitions[input.transition].to,
    })
  }

  const data: Record<string, unknown> = { status: outcome.to, updatedById: identity.user.id }
  if (input.transition === 'approve') {
    // 4.1: `approvedAt` / `approvedBy` werden gesetzt.
    data.approvedAt = evaluationDate
    data.approvedById = identity.user.id
    data.rejectionReason = null
  }
  if (input.transition === 'returnToDraft') data.rejectionReason = reason
  if (input.transition === 'cancel') data.cancellationReason = reason

  try {
    await prisma.$transaction(async (tx) => {
      await tx.demandRequest.update({ where: { id: request.id }, data })
      await protokolliere(
        tx,
        uebergangsEintrag({
          outcome,
          bezug: protokollbezug('demandRequest', request.id, request.tenantId),
          userId: identity.user.id,
          occurredAt: evaluationDate,
          // 4.1 macht die Begründung beim Zurückgeben und beim Stornieren zur
          // Pflicht; 3.12 legt sie in den Eintrag.
          reason: reason,
        }),
      )
    })
  } catch (error) {
    return asFailure(error, 'Statuswechsel konnte nicht gespeichert werden')
  }
  // Offen: Benachrichtigungen und Fristenlauf aus 4.1 — der
  // Benachrichtigungsweg ist nicht umgesetzt.
  return success(
    `${outcome.label}: ${request.requestNumber} steht jetzt auf „${outcome.to}" (${outcome.specReference}).`,
  )
}

// ── Ausschreiben ───────────────────────────────────────────────────────────

export interface PublishTenderInput {
  readonly demandRequestId: string
  readonly supplierIds: readonly string[]
  readonly offerDeadline: Date
  readonly distributionMode: 'simultaneous' | 'staged'
}

/**
 * Veröffentlicht eine Ausschreibung mit ihren Einladungen und wechselt die
 * Anfrage nach `tendered` (4.1, `approved` → `tendered`).
 *
 * Beide Modelle werden befragt: 4.1 für die Anfrage, 4.2.1 für **jede**
 * Einladung. Erst wenn alle Übergänge zulässig sind, wird geschrieben — eine
 * halb veröffentlichte Ausschreibung gibt es nicht.
 *
 * Eine Wiederholung ist eine **neue** Ausschreibung mit erhöhter Rundennummer
 * (3.5): derselbe Weg, Übergang `openNextRound`.
 */
export async function publishTender(
  identity: LoadedIdentity,
  input: PublishTenderInput,
  evaluationDate: Date = new Date(),
): Promise<ActionResult> {
  const request = await prisma.demandRequest.findUnique({
    where: { id: input.demandRequestId },
    include: DEMAND_REQUEST_INCLUDE,
  })
  if (request === null) return failure('Unbekannte Bedarfsanfrage.')
  if (input.supplierIds.length === 0) {
    return failure('Eine Ausschreibung braucht mindestens eine Einladung (3.5, 4.1).')
  }

  const suppliers = await prisma.supplier.findMany({
    where: { id: { in: [...input.supplierIds] } },
    include: { permits: true, documents: true },
  })
  if (suppliers.length !== input.supplierIds.length) {
    return failure('Unbekannter Lieferant in der Einladungsliste.')
  }

  const eligibility = suppliers.map(
    (supplier): InvitedSupplierFact => ({
      supplierId: supplier.id,
      supplierStatus: supplier.status,
      hasAcceptedValidPermit: erlaubnisGedeckt(supplier, {
        von: evaluationDate,
        bis: input.offerDeadline,
      }),
    }),
  )

  const status = request.status as DemandRequestState
  const transition: DemandRequestTransitionName =
    status === 'tendered' ? 'openNextRound' : 'publishTender'
  const requestOutcome = attemptTransition(DEMAND_REQUEST_MODEL, transition, {
    currentStatus: status,
    subject: identity.subject,
    resource: demandRequestRef(request, invitedSupplierTenantIds(request)),
    facts: factsFromRequest(request, identity, evaluationDate, {
      invitedSuppliers: eligibility,
      offerDeadline: input.offerDeadline,
    }),
  })
  if (!requestOutcome.applied) {
    return rejection(requestOutcome, {
      bezug: protokollbezug('demandRequest', request.id, request.tenantId),
      userId: identity.user.id,
      statusFrom: status,
      statusTo: DEMAND_REQUEST_MODEL.transitions[transition].to,
    })
  }

  const operatorTenant = await prisma.tenant.findFirst({ where: { tenantType: 'operator' } })
  if (operatorTenant === null) return failure('Kein Betreibermandant vorhanden (3.11).')

  // Jede Einladung einzeln nach 4.2.1 — der Lieferantenstatus und die
  // Erlaubnis sind Vorbedingung, nicht Nebenbedingung.
  //
  // Die vollzogenen Übergänge werden **gemerkt**, nicht später nachgebaut: der
  // Audit-Eintrag soll den Übergang nennen, den das Modell wirklich erlaubt
  // hat (3.12, 4.0 Regel 3).
  const einladungsUebergaenge = new Map<
    string,
    Extract<TransitionOutcome<TenderInvitationState>, { applied: true }>
  >()
  for (const supplier of suppliers) {
    const fact = eligibility.find((entry) => entry.supplierId === supplier.id)
    const invitationOutcome = attemptTransition(TENDER_INVITATION_MODEL, 'invite', {
      currentStatus: null,
      subject: identity.subject,
      resource: tenderInvitationRef({
        tenantId: operatorTenant.id,
        customerTenantId: request.tenantId,
        supplierTenantId: supplier.tenantId,
        invitationStatus: 'invited',
      }),
      facts: {
        tenderPublished: true,
        tenderClosed: false,
        supplierStatus: supplier.status,
        hasAcceptedValidPermit: fact?.hasAcceptedValidPermit === true,
        readBySupplierUser: false,
        offerStatus: null,
        declineReason: null,
        offerDeadline: input.offerDeadline,
        evaluationDate,
      },
    })
    if (!invitationOutcome.applied) {
      await protokolliereGetrennt(
        ablehnungsEintrag({
          rejection: invitationOutcome.rejection,
          bezug: protokollbezug('tenderInvitation', supplier.supplierNumber, operatorTenant.id),
          userId: identity.user.id,
          occurredAt: evaluationDate,
          statusTo: 'invited',
          operation: 'create',
        }),
      )
      return failure(
        `${supplier.legalName}: ${invitationOutcome.rejection.reason}`,
        invitationOutcome.rejection.specReference,
      )
    }
    einladungsUebergaenge.set(supplier.id, invitationOutcome)
  }

  const round = request.tenders.length + 1
  try {
    await prisma.$transaction(async (tx) => {
      const tender = await tx.tender.create({
        data: {
          tenantId: operatorTenant.id,
          tenderNumber: `${request.requestNumber}-R${round}`,
          demandRequestId: request.id,
          tenderRound: round,
          distributionMode: input.distributionMode,
          publishedAt: evaluationDate,
          publishedById: identity.user.id,
          offerDeadline: input.offerDeadline,
          createdById: identity.user.id,
        },
      })
      // Die Ausschreibung selbst hat kein Statusmodell (4.2): sie ist die
      // Runde. Ihr Eintrag ist deshalb eine Anlage, kein Übergang.
      await protokolliere(
        tx,
        schreibEintrag({
          decision: requestOutcome.decision,
          operation: 'create',
          bezug: protokollbezug('tender', tender.id, tender.tenantId),
          userId: identity.user.id,
          occurredAt: evaluationDate,
        }),
      )
      for (const supplier of suppliers) {
        const einladung = await tx.tenderInvitation.create({
          data: {
            tenantId: operatorTenant.id,
            tenderId: tender.id,
            supplierId: supplier.id,
            invitedAt: evaluationDate,
            invitationStatus: 'invited',
            createdById: identity.user.id,
          },
        })
        // Je Einladung ein eigener Eintrag: 4.2.1 führt sie als eigenen
        // Vorgang, und 2.3 Regel 2 verbietet, mehrere Lieferanten in einem
        // Vorgang zu bündeln.
        const einladungsUebergang = einladungsUebergaenge.get(supplier.id)
        if (einladungsUebergang === undefined) {
          throw new Error('Übergang zur Einladung fehlt — das Protokoll wäre unvollständig (3.12).')
        }
        await protokolliere(
          tx,
          uebergangsEintrag({
            outcome: einladungsUebergang,
            bezug: protokollbezug('tenderInvitation', einladung.id, einladung.tenantId),
            userId: identity.user.id,
            occurredAt: evaluationDate,
          }),
        )
      }
      await tx.demandRequest.update({
        where: { id: request.id },
        data: {
          status: requestOutcome.to,
          offerDeadline: input.offerDeadline,
          updatedById: identity.user.id,
        },
      })
      await protokolliere(
        tx,
        uebergangsEintrag({
          outcome: requestOutcome,
          bezug: protokollbezug('demandRequest', request.id, request.tenantId),
          userId: identity.user.id,
          occurredAt: evaluationDate,
        }),
      )
    })
  } catch (error) {
    return asFailure(error, 'Ausschreibung konnte nicht veröffentlicht werden')
  }

  // Offen: je Lieferant **eine einzeln adressierte** Benachrichtigung (2.3,
  // Regel 2) — der Benachrichtigungsweg ist noch nicht umgesetzt.
  return success(
    `Runde ${round} veröffentlicht: ${suppliers.length} Einladung(en), Anfrage auf „${requestOutcome.to}".`,
  )
}

/**
 * Deckt die AÜG-Erlaubnis des Lieferanten den Zeitraum (P9, SPEC 5.4.1)?
 *
 * **Hier stand bis zu dieser Arbeitseinheit eine zweite Fassung der Regel** —
 * drei Zeilen, die Anerkennung und Gültigkeit an **einem** Tag prüften. Sie war
 * milder als 5.4.1: ohne Urkunde (3.2, E25), ohne hinterlegte Datei (5.4.5),
 * ohne tagesgenaue Deckung des Prüfzeitraums und ohne Nachfolgesätze. Das
 * Gesetz gehört an **eine** Stelle; zwei Fassungen laufen auseinander, und die
 * mildere entscheidet dann den Übergang.
 *
 * Der Zeitraum ist der aus 5.0: für Q04 und Q06 der Tag des Übergangs bis zur
 * **Angebotsfrist**, nicht nur der Stichtag — eine Einladung, deren Erlaubnis
 * vor dem Ende der Frist abläuft, ist nach 4.7 gesperrt.
 */
function erlaubnisGedeckt(
  supplier: {
    readonly legalName: string
    readonly permits: readonly Erlaubniszeile[]
    readonly documents: readonly Parameters<typeof alsNachweiszeile>[0][]
  },
  zeitraum: { readonly von: Date; readonly bis: Date | null },
): boolean {
  return erlaubnisstand({
    lieferant: supplier.legalName,
    erlaubnisse: supplier.permits,
    urkunden: supplier.documents.map(alsNachweiszeile),
    stichtag: null,
    zeitraum,
    unterbrechungen: [],
  }).hasAcceptedValidPermit
}

// ── Einladungen ────────────────────────────────────────────────────────────

export interface InvitationListEntry {
  readonly id: string
  readonly status: TenderInvitationState
  readonly fields: Partial<InvitationFields>
  readonly concealed: readonly string[]
  /** Die Anfrage im Umfang von [14] — ohne Kostenstelle und interne Vermerke. */
  readonly request: Partial<DemandRequestFields>
  readonly requestConcealed: readonly string[]
  readonly offerDeadline: string
  readonly offer: OfferSummary | null
  readonly availableTransitions: readonly {
    readonly name: TenderInvitationTransitionName
    readonly label: string
  }[]
}

/**
 * Die Einladungen, die diese Identität sehen darf.
 *
 * Für den Lieferantendisponenten ist der Aufruf **selbst** der erste lesende
 * Zugriff: die Einladung wechselt dabei nach `viewed` (4.2.1, Systemübergang).
 * Der Übergang ist kein Rechtsgeschäft und keine Zusage.
 */
export async function loadInvitations(
  identity: LoadedIdentity,
  evaluationDate: Date = new Date(),
): Promise<readonly InvitationListEntry[]> {
  const invitations = await prisma.tenderInvitation.findMany({
    include: {
      supplier: true,
      offer: { include: { items: true, submissions: true } },
      tender: { include: { demandRequest: { include: DEMAND_REQUEST_INCLUDE } } },
    },
    orderBy: { invitedAt: 'asc' },
  })

  const entries: InvitationListEntry[] = []
  for (const invitation of invitations) {
    const request = invitation.tender.demandRequest
    const ref = tenderInvitationRef({
      tenantId: invitation.tenantId,
      customerTenantId: request.tenantId,
      supplierTenantId: invitation.supplier.tenantId,
      invitationStatus: invitation.invitationStatus,
    })
    const decision = checkPermission(identity.subject, 'read', ref)
    if (!decision.allowed) continue

    let status = invitation.invitationStatus as TenderInvitationState
    const ownSupplier = identity.tenant.id === invitation.supplier.tenantId
    if (ownSupplier && status === 'invited') {
      const viewed = await markInvitationViewed(invitation.id, invitation, evaluationDate)
      if (viewed) status = 'viewed'
    }

    const invitationFields = project(
      {
        supplier: invitation.supplier.legalName,
        invitationStatus: status,
        invitedAt: REQUIRED_DAY(invitation.invitedAt),
        viewedAt: DAY(ownSupplier && status === 'viewed' ? evaluationDate : invitation.viewedAt),
        respondedAt: DAY(invitation.respondedAt),
        declineReason: invitation.declineReason,
      } satisfies InvitationFields,
      decision,
    )
    if (invitationFields === null) continue

    const requestDecision = checkPermission(
      identity.subject,
      'read',
      demandRequestRef(request, invitedSupplierTenantIds(request)),
    )
    const requestFields = project(describeDemandRequest(request), requestDecision)

    const facts: TenderInvitationFacts = {
      tenderPublished: true,
      tenderClosed: invitation.tender.closedAt !== null,
      supplierStatus: invitation.supplier.status,
      hasAcceptedValidPermit: true,
      readBySupplierUser: ownSupplier,
      offerStatus: invitation.offer?.status ?? null,
      declineReason: invitation.declineReason,
      offerDeadline: invitation.tender.offerDeadline,
      evaluationDate,
    }

    entries.push({
      id: invitation.id,
      status,
      fields: invitationFields,
      concealed: concealedFields(decision),
      request: requestFields ?? {},
      requestConcealed: concealedFields(requestDecision),
      offerDeadline: MINUTE(invitation.tender.offerDeadline) ?? '',
      offer: visibleOffer(
        invitation,
        request.tenantId,
        identity,
        evaluationDate,
        invitation.tender.offerDeadline,
      ),
      availableTransitions: transitionsFrom(TENDER_INVITATION_MODEL, status).flatMap((name) => {
        const outcome = attemptTransition(TENDER_INVITATION_MODEL, name, {
          currentStatus: status,
          subject: identity.subject,
          resource: ref,
          facts,
        })
        if (!outcome.applied && outcome.rejection.kind !== 'precondition') return []
        return [{ name, label: TENDER_INVITATION_MODEL.transitions[name].label }]
      }),
    })
  }
  return entries
}

/**
 * `invited` → `viewed` (4.2.1). **Systemübergang**: er wird ohne Subjekt
 * angefordert, weil keine Benutzerhandlung ihn auslöst — der erste lesende
 * Zugriff tut es.
 */
async function markInvitationViewed(
  invitationId: string,
  invitation: {
    readonly tenantId: string
    readonly invitationStatus: string
    readonly declineReason: string | null
    readonly supplier: { readonly status: string }
    readonly offer: { readonly status: string } | null
    readonly tender: { readonly closedAt: Date | null; readonly offerDeadline: Date }
  },
  evaluationDate: Date,
): Promise<boolean> {
  const outcome = attemptTransition(TENDER_INVITATION_MODEL, 'markViewed', {
    currentStatus: invitation.invitationStatus as TenderInvitationState,
    resource: {
      type: 'tender',
      tenantId: 'system',
      tenantType: 'operator',
    },
    facts: {
      tenderPublished: true,
      tenderClosed: invitation.tender.closedAt !== null,
      supplierStatus: invitation.supplier.status as 'onboarding' | 'active' | 'blocked' | 'inactive',
      hasAcceptedValidPermit: true,
      readBySupplierUser: true,
      offerStatus: invitation.offer?.status ?? null,
      declineReason: invitation.declineReason,
      offerDeadline: invitation.tender.offerDeadline,
      evaluationDate,
    },
  })
  if (!outcome.applied) return false
  await prisma.$transaction(async (tx) => {
    await tx.tenderInvitation.update({
      where: { id: invitationId },
      data: { invitationStatus: 'viewed', viewedAt: evaluationDate },
    })
    // Schreibender Vorgang, also protokollpflichtig (3.12, Nummer 1) — und
    // zwar als Systemübergang: ausgelöst hat ihn der erste Lesezugriff, nicht
    // eine Benutzerhandlung (4.2.1, 4.0 Regel 10).
    await protokolliere(
      tx,
      uebergangsEintrag({
        outcome,
        bezug: protokollbezug('tenderInvitation', invitationId, invitation.tenantId),
        userId: SYSTEM_ACTOR,
        occurredAt: evaluationDate,
      }),
    )
  })
  return true
}

export async function declineInvitation(
  identity: LoadedIdentity,
  input: { readonly invitationId: string; readonly declineReason: string },
  evaluationDate: Date = new Date(),
): Promise<ActionResult> {
  const invitation = await prisma.tenderInvitation.findUnique({
    where: { id: input.invitationId },
    include: {
      supplier: true,
      offer: true,
      tender: { include: { demandRequest: true } },
    },
  })
  if (invitation === null) return failure('Unbekannte Einladung.')

  const outcome = attemptTransition(TENDER_INVITATION_MODEL, 'decline', {
    currentStatus: invitation.invitationStatus as TenderInvitationState,
    subject: identity.subject,
    resource: tenderInvitationRef({
      tenantId: invitation.tenantId,
      customerTenantId: invitation.tender.demandRequest.tenantId,
      supplierTenantId: invitation.supplier.tenantId,
      invitationStatus: invitation.invitationStatus,
    }),
    facts: {
      tenderPublished: true,
      tenderClosed: invitation.tender.closedAt !== null,
      supplierStatus: invitation.supplier.status,
      hasAcceptedValidPermit: true,
      readBySupplierUser: true,
      offerStatus: invitation.offer?.status ?? null,
      declineReason: input.declineReason,
      offerDeadline: invitation.tender.offerDeadline,
      evaluationDate,
    },
  })
  if (!outcome.applied) {
    return rejection(outcome, {
      bezug: protokollbezug('tenderInvitation', invitation.id, invitation.tenantId),
      userId: identity.user.id,
      statusFrom: invitation.invitationStatus,
      statusTo: 'declined',
    })
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.tenderInvitation.update({
        where: { id: invitation.id },
        data: {
          invitationStatus: 'declined',
          declineReason: input.declineReason.trim(),
          respondedAt: evaluationDate,
          updatedById: identity.user.id,
        },
      })
      await protokolliere(
        tx,
        uebergangsEintrag({
          outcome,
          bezug: protokollbezug('tenderInvitation', invitation.id, invitation.tenantId),
          userId: identity.user.id,
          occurredAt: evaluationDate,
          // 4.2.1 macht den Absagegrund zur Pflicht.
          reason: input.declineReason.trim(),
        }),
      )
    })
  } catch (error) {
    return asFailure(error, 'Absage konnte nicht gespeichert werden')
  }
  // Offen: Benachrichtigung an `MD` (4.2.1) — ohne Bezug auf andere Lieferanten.
  return success('Einladung abgesagt (4.2.1, Fußnote [46]).')
}

// ── Angebot ────────────────────────────────────────────────────────────────

export interface NewOfferInput {
  readonly invitationId: string
  readonly availableFrom: Date
  readonly offeredHeadcount: number
  readonly qualificationLevel: string
  readonly itemHeadcount: number
  readonly hourlyRate: number
  readonly offerValidUntil: Date | null
  readonly note: string | null
}

/**
 * Legt ein Angebot an und reicht es ein — zwei Übergänge aus 4.2.2 (`create`,
 * `submit`) und, als Folge des zweiten, der Systemübergang `offerSubmitted` an
 * der Einladung (4.2.1). Die Reihenfolge ist die der Spezifikation; keiner der
 * drei wird übersprungen.
 */
export async function submitOffer(
  identity: LoadedIdentity,
  input: NewOfferInput,
  evaluationDate: Date = new Date(),
): Promise<ActionResult> {
  const invitation = await prisma.tenderInvitation.findUnique({
    where: { id: input.invitationId },
    include: {
      supplier: true,
      offer: true,
      tender: { include: { demandRequest: true } },
    },
  })
  if (invitation === null) return failure('Unbekannte Einladung.')
  if (invitation.offer !== null) {
    return failure('Je Einladung gibt es höchstens ein Angebot (3.13).')
  }
  if (input.qualificationLevel.trim() === '') {
    return failure('Die Qualifikationsstufe der Angebotsposition ist Pflicht (3.5).')
  }

  const customerTenantId = invitation.tender.demandRequest.tenantId
  const offerRef = supplierOfferRef({
    tenantId: invitation.supplier.tenantId,
    customerTenantId,
    status: 'draft',
  })

  const baseFacts: SupplierOfferFacts = {
    invitationStatus: invitation.invitationStatus as TenderInvitationState,
    offerDeadline: invitation.tender.offerDeadline,
    itemCount: 1,
    availableFrom: input.availableFrom,
    offeredHeadcount: input.offeredHeadcount,
    reviewedAt: null,
    rejectionReason: null,
    offerValidUntil: input.offerValidUntil,
    acceptedSubmissionCount: 0,
    evaluationDate,
  }

  const created = attemptTransition(SUPPLIER_OFFER_MODEL, 'create', {
    currentStatus: null,
    subject: identity.subject,
    resource: offerRef,
    facts: baseFacts,
  })
  if (!created.applied) {
    return rejection(created, {
      bezug: protokollbezug(
        'supplierOffer',
        `Angebot zu Einladung ${invitation.id}`,
        invitation.supplier.tenantId,
      ),
      userId: identity.user.id,
      statusTo: 'draft',
      operation: 'create',
    })
  }

  const submitted = attemptTransition(SUPPLIER_OFFER_MODEL, 'submit', {
    currentStatus: 'draft',
    subject: identity.subject,
    resource: offerRef,
    facts: baseFacts,
  })
  if (!submitted.applied) {
    return rejection(submitted, {
      bezug: protokollbezug(
        'supplierOffer',
        `Angebot zu Einladung ${invitation.id}`,
        invitation.supplier.tenantId,
      ),
      userId: identity.user.id,
      statusFrom: 'draft',
      statusTo: 'submitted',
    })
  }

  // Folgeübergang an der Einladung (4.2.1): System, nicht der Lieferant.
  const invitationOutcome = attemptTransition(TENDER_INVITATION_MODEL, 'recordOfferSubmitted', {
    currentStatus: invitation.invitationStatus as TenderInvitationState,
    resource: { type: 'tender', tenantId: 'system', tenantType: 'operator' },
    facts: {
      tenderPublished: true,
      tenderClosed: invitation.tender.closedAt !== null,
      supplierStatus: invitation.supplier.status,
      hasAcceptedValidPermit: true,
      readBySupplierUser: true,
      offerStatus: 'submitted',
      declineReason: null,
      offerDeadline: invitation.tender.offerDeadline,
      evaluationDate,
    },
  })
  if (!invitationOutcome.applied) {
    return rejection(invitationOutcome, {
      bezug: protokollbezug('tenderInvitation', invitation.id, invitation.tenantId),
      userId: identity.user.id,
      statusFrom: invitation.invitationStatus,
      statusTo: 'offerSubmitted',
    })
  }

  const offerCount = await prisma.supplierOffer.count({
    where: { supplierId: invitation.supplierId },
  })
  try {
    await prisma.$transaction(async (tx) => {
      const angebot = await tx.supplierOffer.create({
        data: {
          tenantId: invitation.supplier.tenantId,
          offerNumber: `A-${invitation.supplier.supplierNumber}-${offerCount + 1}`,
          tenderInvitationId: invitation.id,
          supplierId: invitation.supplierId,
          availableFrom: input.availableFrom,
          offeredHeadcount: input.offeredHeadcount,
          offerValidUntil: input.offerValidUntil,
          note: input.note,
          submittedAt: evaluationDate,
          status: 'submitted',
          createdById: identity.user.id,
          items: {
            create: [
              {
                qualificationLevel: input.qualificationLevel.trim(),
                headcount: input.itemHeadcount,
                hourlyRate: input.hourlyRate,
                currency: 'EUR',
                createdById: identity.user.id,
              },
            ],
          },
        },
      })
      // Zwei Übergänge, zwei Einträge (4.2.2: `create` und `submit`): das
      // Protokoll zeigt die Schritte, die 4.2.2 nennt, nicht ihre Summe.
      await protokolliere(
        tx,
        uebergangsEintrag({
          outcome: created,
          bezug: protokollbezug('supplierOffer', angebot.id, angebot.tenantId),
          userId: identity.user.id,
          occurredAt: evaluationDate,
        }),
      )
      await protokolliere(
        tx,
        uebergangsEintrag({
          outcome: submitted,
          bezug: protokollbezug('supplierOffer', angebot.id, angebot.tenantId),
          userId: identity.user.id,
          occurredAt: evaluationDate,
        }),
      )
      await tx.tenderInvitation.update({
        where: { id: invitation.id },
        data: {
          invitationStatus: 'offerSubmitted',
          respondedAt: evaluationDate,
          updatedById: identity.user.id,
        },
      })
      // Der Folgeübergang an der Einladung ist ein **Systemübergang** (4.2.1):
      // der Eintrag trägt deshalb das Systemkennzeichen statt des Lieferanten
      // (3.12, 4.0 Regel 10).
      await protokolliere(
        tx,
        uebergangsEintrag({
          outcome: invitationOutcome,
          bezug: protokollbezug('tenderInvitation', invitation.id, invitation.tenantId),
          userId: identity.user.id,
          occurredAt: evaluationDate,
        }),
      )
    })
  } catch (error) {
    return asFailure(error, 'Angebot konnte nicht eingereicht werden')
  }
  return success('Angebot eingereicht; Einladung steht auf „offerSubmitted" (4.2.1, 4.2.2).')
}

export async function transitionOffer(
  identity: LoadedIdentity,
  input: {
    readonly offerId: string
    readonly transition: SupplierOfferTransitionName
    readonly rejectionReason: string | null
  },
  evaluationDate: Date = new Date(),
): Promise<ActionResult> {
  const offer = await prisma.supplierOffer.findUnique({
    where: { id: input.offerId },
    include: {
      items: true,
      submissions: true,
      tenderInvitation: { include: { tender: { include: { demandRequest: true } } } },
    },
  })
  if (offer === null) return failure('Unbekanntes Angebot.')

  const reason = input.rejectionReason?.trim() === '' ? null : (input.rejectionReason ?? null)
  const status = offer.status as SupplierOfferState
  const outcome = attemptTransition(SUPPLIER_OFFER_MODEL, input.transition, {
    currentStatus: status,
    subject: identity.subject,
    resource: supplierOfferRef({
      tenantId: offer.tenantId,
      customerTenantId: offer.tenderInvitation.tender.demandRequest.tenantId,
      status: offer.status,
    }),
    facts: {
      invitationStatus: offer.tenderInvitation.invitationStatus as TenderInvitationState,
      offerDeadline: offer.tenderInvitation.tender.offerDeadline,
      itemCount: offer.items.length,
      availableFrom: offer.availableFrom,
      offeredHeadcount: offer.offeredHeadcount,
      reviewedAt: offer.reviewedAt,
      rejectionReason: reason,
      offerValidUntil: offer.offerValidUntil,
      // 4.2.2: der Zuschlag setzt einen zugesagten Profilvorschlag voraus
      // (4.2.3). Seit 3.6 ein echter Wert.
      acceptedSubmissionCount: offer.submissions.filter(
        (submission) => submission.status === 'accepted',
      ).length,
      evaluationDate,
    },
  })
  if (!outcome.applied) {
    return rejection(outcome, {
      bezug: protokollbezug('supplierOffer', offer.id, offer.tenantId),
      userId: identity.user.id,
      statusFrom: offer.status,
      statusTo: SUPPLIER_OFFER_MODEL.transitions[input.transition].to,
    })
  }

  const data: Record<string, unknown> = { status: outcome.to, updatedById: identity.user.id }
  if (input.transition === 'review') data.reviewedAt = evaluationDate
  if (input.transition === 'reject') data.rejectionReason = reason
  if (input.transition === 'withdraw') data.withdrawnAt = evaluationDate

  try {
    await prisma.$transaction(async (tx) => {
      await tx.supplierOffer.update({ where: { id: offer.id }, data })
      await protokolliere(
        tx,
        uebergangsEintrag({
          outcome,
          bezug: protokollbezug('supplierOffer', offer.id, offer.tenantId),
          userId: identity.user.id,
          occurredAt: evaluationDate,
          reason,
        }),
      )
    })
  } catch (error) {
    return asFailure(error, 'Statuswechsel am Angebot konnte nicht gespeichert werden')
  }
  return success(`${outcome.label}: Angebot steht jetzt auf „${outcome.to}" (${outcome.specReference}).`)
}

/**
 * Eine abgelehnte Handlung: Ergebnis **und** Audit-Eintrag (3.12, „abgelehnte
 * Zugriffe werden ebenfalls protokolliert"). Beides an einer Stelle, damit kein
 * Weg aus diesem Modul eine Ablehnung zurückgibt, ohne sie zu protokollieren.
 */
async function rejection(
  outcome: TransitionOutcome<string>,
  protokoll: {
    readonly bezug: Protokollbezug
    readonly userId: string
    readonly statusFrom?: string | null
    readonly statusTo: string
    readonly operation?: 'create' | 'transition'
  },
): Promise<ActionResult> {
  if (outcome.applied) return success('')
  await protokolliereGetrennt(
    ablehnungsEintrag({
      rejection: outcome.rejection,
      bezug: protokoll.bezug,
      userId: protokoll.userId,
      occurredAt: new Date(),
      statusFrom: protokoll.statusFrom ?? null,
      statusTo: protokoll.statusTo,
      ...(protokoll.operation !== undefined ? { operation: protokoll.operation } : {}),
    }),
  )
  return failure(outcome.rejection.reason, outcome.rejection.specReference)
}

// ── Systemlauf (zeitgesteuerte Übergänge) ──────────────────────────────────

/**
 * Führt die zeitgesteuerten Übergänge aus 4.1 und 4.2 aus — die Übergänge, die
 * **entziehen**: `expired` bei Bedarfsanfrage, Einladung und Angebot (4.0,
 * Regel 4). Sie werden ohne Subjekt angefordert, weil kein Benutzer sie
 * auslöst; der Audit-Eintrag trüge ein Systemkennzeichen (4.0, Regel 10).
 *
 * Im Betrieb wäre das der nächtliche Lauf aus 5.5.1. Im Prototyp startet ihn
 * eine Schaltfläche, damit der Ablauf vorführbar ist — gestartet wird der Lauf,
 * nicht der einzelne Übergang.
 */
export async function runSystemDeadlineRun(
  evaluationDate: Date = new Date(),
): Promise<readonly string[]> {
  const log: string[] = []
  const systemResource = {
    type: 'tender' as const,
    tenantId: 'system',
    tenantType: 'operator' as const,
  }

  const invitations = await prisma.tenderInvitation.findMany({
    where: { invitationStatus: { in: ['invited', 'viewed'] } },
    include: { offer: true, supplier: true, tender: true },
  })
  for (const invitation of invitations) {
    const outcome = attemptTransition(TENDER_INVITATION_MODEL, 'expire', {
      currentStatus: invitation.invitationStatus as TenderInvitationState,
      resource: systemResource,
      facts: {
        tenderPublished: true,
        tenderClosed: invitation.tender.closedAt !== null,
        supplierStatus: invitation.supplier.status,
        hasAcceptedValidPermit: true,
        readBySupplierUser: false,
        offerStatus: invitation.offer?.status ?? null,
        declineReason: invitation.declineReason,
        offerDeadline: invitation.tender.offerDeadline,
        evaluationDate,
      },
    })
    if (!outcome.applied) continue
    await prisma.$transaction(async (tx) => {
      await tx.tenderInvitation.update({
        where: { id: invitation.id },
        data: { invitationStatus: 'expired' },
      })
      await protokolliere(
        tx,
        uebergangsEintrag({
          outcome,
          bezug: protokollbezug('tenderInvitation', invitation.id, invitation.tenantId),
          // Systemlauf: `outcome.decision` ist `null`, der Eintrag trägt
          // deshalb das Systemkennzeichen und keinen Benutzer (3.12, 4.0
          // Regel 10). Die Kennung wird mitgegeben, aber nicht verwendet.
          userId: SYSTEM_ACTOR,
          occurredAt: evaluationDate,
        }),
      )
    })
    log.push(`Einladung ${invitation.id}: ${outcome.label} (4.2.1)`)
  }

  const offers = await prisma.supplierOffer.findMany({
    where: { status: { in: ['submitted', 'reviewed'] } },
    include: { items: true, tenderInvitation: { include: { tender: true } } },
  })
  for (const offer of offers) {
    const outcome = attemptTransition(SUPPLIER_OFFER_MODEL, 'expire', {
      currentStatus: offer.status as SupplierOfferState,
      resource: { ...systemResource, type: 'supplierOffer' },
      facts: {
        invitationStatus: offer.tenderInvitation.invitationStatus as TenderInvitationState,
        offerDeadline: offer.tenderInvitation.tender.offerDeadline,
        itemCount: offer.items.length,
        availableFrom: offer.availableFrom,
        offeredHeadcount: offer.offeredHeadcount,
        reviewedAt: offer.reviewedAt,
        rejectionReason: offer.rejectionReason,
        offerValidUntil: offer.offerValidUntil,
        acceptedSubmissionCount: 0,
        evaluationDate,
      },
    })
    if (!outcome.applied) continue
    await prisma.$transaction(async (tx) => {
      await tx.supplierOffer.update({ where: { id: offer.id }, data: { status: 'expired' } })
      await protokolliere(
        tx,
        uebergangsEintrag({
          outcome,
          bezug: protokollbezug('supplierOffer', offer.id, offer.tenantId),
          userId: SYSTEM_ACTOR,
          occurredAt: evaluationDate,
        }),
      )
    })
    log.push(`Angebot ${offer.offerNumber}: ${outcome.label} (4.2.2)`)
  }

  const requests = await prisma.demandRequest.findMany({
    where: { status: { in: ['approved', 'tendered', 'inSelection'] } },
    include: DEMAND_REQUEST_INCLUDE,
  })
  for (const request of requests) {
    const outcome = attemptTransition(DEMAND_REQUEST_MODEL, 'expire', {
      currentStatus: request.status as DemandRequestState,
      resource: { ...systemResource, type: 'demandRequest' },
      facts: {
        requestedById: request.requestedById,
        actingUserId: null,
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
        ...submissionAndAssignmentCounts(request),
        evaluationDate,
      },
    })
    if (!outcome.applied) continue
    await prisma.$transaction(async (tx) => {
      await tx.demandRequest.update({ where: { id: request.id }, data: { status: 'expired' } })
      await protokolliere(
        tx,
        uebergangsEintrag({
          outcome,
          bezug: protokollbezug('demandRequest', request.id, request.tenantId),
          userId: SYSTEM_ACTOR,
          occurredAt: evaluationDate,
        }),
      )
    })
    log.push(`Bedarfsanfrage ${request.requestNumber}: ${outcome.label} (4.1)`)
  }

  return log.length === 0 ? ['Keine Frist abgelaufen — kein Übergang.'] : log
}

/** Lieferanten, die zu einer Ausschreibung eingeladen werden können. */
export async function loadInvitableSuppliers(
  identity: LoadedIdentity,
  evaluationDate: Date = new Date(),
): Promise<readonly { readonly id: string; readonly label: string; readonly eligible: boolean }[]> {
  const engagements = await loadEngagements()
  void engagements
  const suppliers = await prisma.supplier.findMany({
    include: { permits: true, documents: true },
    orderBy: { supplierNumber: 'asc' },
  })
  return suppliers
    .filter((supplier) =>
      checkPermission(identity.subject, 'read', {
        type: 'supplier',
        tenantId: supplier.tenantId,
        tenantType: 'supplier',
        supplierTenantId: supplier.tenantId,
        status: supplier.status,
      }).allowed,
    )
    .map((supplier) => {
      const eligible =
        supplier.status === 'active' &&
        erlaubnisGedeckt(supplier, { von: evaluationDate, bis: evaluationDate })
      return {
        id: supplier.id,
        eligible,
        label: `${supplier.supplierNumber} — ${supplier.legalName}${eligible ? '' : ' (nicht einladbar: 4.6 / 5.4)'}`,
      }
    })
}

/** Auswahllisten und Rechte für die Formulare der Bedarfsseite. */
export interface DemandFormOptions {
  readonly sites: readonly { readonly id: string; readonly label: string }[]
  readonly costCenters: readonly { readonly id: string; readonly label: string }[]
  /** Bedarfsträger zur Anlage im Auftrag des Kunden ([10]); nur für den Betreiber. */
  readonly demandOwners: readonly { readonly id: string; readonly label: string }[]
  readonly suppliers: readonly { readonly id: string; readonly label: string }[]
  readonly mayCreate: boolean
  /** Darf diese Identität den Systemlauf starten (4.0, Regel 10; 5.5.1)? */
  readonly mayRunSystemDeadlines: boolean
}

export async function loadDemandFormOptions(
  identity: LoadedIdentity,
  evaluationDate: Date = new Date(),
): Promise<DemandFormOptions> {
  const engagements = await loadEngagements()
  const subject = identity.subject

  const sites = await prisma.site.findMany({
    include: { customer: true },
    orderBy: [{ customer: { customerNumber: 'asc' } }, { siteNumber: 'asc' }],
  })
  const visibleSites = sites.filter(
    (site) => checkPermission(subject, 'read', siteRef(site, engagements)).allowed,
  )

  const costCenters = await prisma.costCenter.findMany({
    include: { customer: true },
    orderBy: [{ customer: { customerNumber: 'asc' } }, { costCenterNumber: 'asc' }],
  })
  const visibleCostCenters = costCenters.filter(
    (costCenter) => checkPermission(subject, 'read', costCenterRef(costCenter)).allowed,
  )

  // Anlegen: geprüft gegen einen der sichtbaren Standorte — die Zelle `A` der
  // Zeile „Bedarfsanfrage (3.4)" für diese Rolle.
  const mayCreate = visibleSites.some(
    (site) =>
      checkPermission(
        subject,
        'create',
        demandRequestRef(
          {
            tenantId: site.tenantId,
            siteId: site.id,
            costCenterId: 'neu',
            // Bei Anlage durch den Betreiber ist der Auftraggeber Pflicht
            // ([10]); hier steht ein Platzhalter, der ihn benennt.
            requestedById:
              identity.tenant.tenantType === 'operator' ? 'auftraggeber' : identity.user.id,
            status: 'draft',
          },
          [],
        ),
      ).allowed,
  )

  const demandOwners =
    identity.tenant.tenantType === 'operator'
      ? (
          await prisma.user.findMany({
            where: { roleAssignments: { some: { roleCode: 'demandOwner' } } },
            include: { tenant: true },
            orderBy: { userNumber: 'asc' },
          })
        )
          .filter(
            (user) =>
              checkPermission(subject, 'read', {
                type: 'demandRequest',
                tenantId: user.tenantId,
                tenantType: 'customer',
                customerTenantId: user.tenantId,
              }).allowed,
          )
          .map((user) => ({
            id: user.id,
            label: `${user.givenName} ${user.familyName} (${user.tenant.displayName})`,
          }))
      : []

  return {
    sites: visibleSites.map((site) => ({
      id: site.id,
      label: `${site.customer.legalName} · ${site.siteNumber} ${site.name}`,
    })),
    costCenters: visibleCostCenters.map((costCenter) => ({
      id: costCenter.id,
      label: `${costCenter.customer.legalName} · ${costCenter.costCenterNumber} ${costCenter.name}`,
    })),
    demandOwners,
    suppliers: (await loadInvitableSuppliers(identity, evaluationDate)).map((supplier) => ({
      id: supplier.id,
      label: supplier.label,
    })),
    mayCreate,
    // Den Lauf startet, wer die zeitgesteuerten Übergänge überhaupt überblickt:
    // der Betreiber. Der Lauf selbst handelt als System, nicht als dieser
    // Benutzer (4.0, Regel 10).
    mayRunSystemDeadlines: identity.tenant.tenantType === 'operator',
  }
}

/** Benutzer eines Kunden, die als Bedarfsträger in Frage kommen (3.4). */
export async function loadDemandOwners(
  subject: Subject,
  customerTenantId: string,
): Promise<readonly { readonly id: string; readonly label: string }[]> {
  void subject
  const users = await prisma.user.findMany({
    where: {
      tenantId: customerTenantId,
      roleAssignments: { some: { roleCode: 'demandOwner' } },
    },
    orderBy: { userNumber: 'asc' },
  })
  return users.map((user) => ({
    id: user.id,
    label: `${user.givenName} ${user.familyName}`,
  }))
}
