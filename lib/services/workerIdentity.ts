/**
 * Fachdienst Personenidentität — SPEC 3.6, Entscheidung zu vormals offener
 * Frage 18.
 *
 * Das Objekt ist **ausschließlich** beim Betreiber geführt; Kunden und
 * Lieferanten sehen es und seine Existenz nicht ([43], 2.3 Regel 4). Dieser
 * Dienst erzwingt das nicht selbst, sondern über `checkPermission`: die Zeile
 * „Personenidentität (3.6)" in 2.2 trägt für Kunden- und Lieferantenrollen
 * **keine** Zelle, und die Mandantengrenze verweigert den Zugriff schon davor
 * (`workerIdentityRef` legt keine Offenlegung an).
 *
 * Das Verfahren ist das aus 3.6, in drei getrennten Handlungen:
 *
 *  1. **Vorschlagen** (`proposeLinks`): der Abgleich über den abschließenden
 *     Merkmalssatz legt Verknüpfungen in `proposed` an — ohne jede Wirkung.
 *  2. **Bestätigen** (`confirmLink`): eine Person beim Betreiber macht den
 *     Vorschlag zur Identität; erst jetzt zählt 5.1 über Lieferanten hinweg.
 *  3. **Trennen** (`detachLink`): eine falsche Verknüpfung ist rückholbar, und
 *     die Historie bleibt (`mergeHistory`).
 *
 * Jede der drei schreibt einen Satz in die Verknüpfungshistorie. Das ist nicht
 * das Audit-Protokoll aus 3.12 — es ist die Historie, die 3.6 ausdrücklich am
 * Objekt verlangt.
 */
import { schreibEintrag } from '../audit/entry'
import { protokolliere, protokolliereGetrennt } from '../audit/record'
import { checkPermission } from '../authz/check'
import type { LoadedIdentity } from '../identity/loadSubject'
import { prisma } from '../prisma'
import { allProposals, type CandidateForMatching } from '../workerIdentity/matching'
import {
  asFailure,
  failure,
  protokollbezug,
  success,
  verweigere,
  workerIdentityRef,
  type ActionResult,
} from './common'

const DAY = (value: Date | null): string | null =>
  value === null ? null : value.toISOString().slice(0, 10)

export interface IdentityLinkView {
  readonly id: string
  readonly candidateId: string
  readonly candidateLabel: string
  readonly supplierLabel: string
  readonly linkStatus: string
  readonly proposalBasis: string
  readonly confirmedAt: string | null
  readonly detachedAt: string | null
  readonly reason: string | null
}

export interface IdentityView {
  readonly id: string
  readonly identityNumber: string
  readonly matchLabel: string
  readonly confirmedAt: string | null
  readonly links: readonly IdentityLinkView[]
  readonly mergeHistory: readonly {
    readonly occurredAt: string
    readonly action: string
    readonly reason: string
  }[]
  /**
   * Zählt diese Identität für 5.1 über Lieferanten hinweg? Nur, wenn
   * **mindestens zwei** Kandidatensätze bestätigt verknüpft sind — ein nur
   * vorgeschlagener Treffer zählt nicht (4.2.3).
   */
  readonly countsAcrossSuppliers: boolean
}

/**
 * Die Personenidentitäten — oder `null`, wenn diese Identität sie nicht sehen
 * darf. `null` ist hier wichtig und nicht die leere Liste: eine Rolle, die das
 * Objekt nicht sehen darf, erfährt nicht, **dass** es welche gibt ([43]).
 */
export async function loadIdentities(
  identity: LoadedIdentity,
): Promise<readonly IdentityView[] | null> {
  const operatorTenant = await prisma.tenant.findFirst({ where: { tenantType: 'operator' } })
  if (operatorTenant === null) return null
  const decision = checkPermission(
    identity.subject,
    'read',
    workerIdentityRef({ tenantId: operatorTenant.id }),
  )
  if (!decision.allowed) return null

  const identities = await prisma.workerIdentity.findMany({
    include: {
      links: { include: { candidate: { include: { supplier: true } } } },
      mergeHistory: { orderBy: { occurredAt: 'asc' } },
    },
    orderBy: { identityNumber: 'asc' },
  })

  return identities.map((record) => ({
    id: record.id,
    identityNumber: record.identityNumber,
    matchLabel: `${record.matchGivenName} ${record.matchFamilyName}, geboren am ${
      DAY(record.matchDateOfBirth) ?? ''
    }${record.matchPlaceOfBirth === null ? '' : ` in ${record.matchPlaceOfBirth}`}`,
    confirmedAt: DAY(record.confirmedAt),
    links: record.links.map((link) => ({
      id: link.id,
      candidateId: link.candidateId,
      candidateLabel: `${link.candidate.candidateNumber} — ${link.candidate.givenName} ${link.candidate.familyName}`,
      supplierLabel: link.candidate.supplier.legalName,
      linkStatus: link.linkStatus,
      proposalBasis: link.proposalBasis,
      confirmedAt: DAY(link.confirmedAt),
      detachedAt: DAY(link.detachedAt),
      reason: link.reason,
    })),
    mergeHistory: record.mergeHistory.map((entry) => ({
      occurredAt: DAY(entry.occurredAt) ?? '',
      action: entry.action,
      reason: entry.reason,
    })),
    countsAcrossSuppliers:
      new Set(
        record.links
          .filter((link) => link.linkStatus === 'confirmed')
          .map((link) => link.candidate.supplierId),
      ).size >= 2,
  }))
}

/**
 * Führt den Abgleich über alle Kandidatensätze und legt die Treffer als
 * **Vorschläge** an (3.6, Punkt 1 der Entscheidung).
 *
 * Er verknüpft nichts: jeder Satz entsteht mit `linkStatus = proposed`, ohne
 * `confirmedAt`, und `candidate.workerIdentityId` bleibt unberührt. Bis zur
 * Bestätigung zählt jeder Kandidatensatz als eigene Person (4.2.3).
 *
 * Der Lauf ist eine **Systemhandlung** (4.0, Regel 10): die Historie führt für
 * den Vorschlag deshalb keinen Benutzer. Ausgelöst wird er hier vom Betreiber,
 * weil der Prototyp keinen nächtlichen Lauf hat.
 */
export async function proposeLinks(identity: LoadedIdentity): Promise<ActionResult> {
  const operatorTenant = await prisma.tenant.findFirst({ where: { tenantType: 'operator' } })
  if (operatorTenant === null) return failure('Kein Betreibermandant vorhanden (3.11).')
  const decision = checkPermission(
    identity.subject,
    'create',
    workerIdentityRef({ tenantId: operatorTenant.id }),
  )
  if (!decision.allowed) {
    return verweigere(
      identity,
      decision,
      'create',
      'workerIdentity',
      'Abgleichlauf',
      operatorTenant.id,
    )
  }

  const candidates = await prisma.candidate.findMany({
    where: { status: 'active' },
    orderBy: { candidateNumber: 'asc' },
  })
  const forMatching: CandidateForMatching[] = candidates.map((candidate) => ({
    candidateId: candidate.id,
    supplierId: candidate.supplierId,
    givenName: candidate.givenName,
    familyName: candidate.familyName,
    dateOfBirth: candidate.dateOfBirth,
    placeOfBirth: candidate.placeOfBirth,
    workerIdentityId: candidate.workerIdentityId,
  }))
  const byId = new Map(forMatching.map((candidate) => [candidate.candidateId, candidate]))

  const proposals = allProposals(forMatching)
  let created = 0
  let skipped = 0

  for (const proposal of proposals) {
    const left = byId.get(proposal.candidateId)
    const right = byId.get(proposal.otherCandidateId)
    if (left === undefined || right === undefined) continue

    // Bestehende Identität eines der beiden Sätze weiterverwenden — sonst eine
    // neue anlegen. Eine Zusammenführung **zweier** bestehender Identitäten
    // schlägt dieser Lauf nicht vor: sie wäre ein Zusammenführen bestätigter
    // Identitäten und gehört in die Hand einer Person beim Betreiber.
    const existing = left.workerIdentityId ?? right.workerIdentityId
    if (
      left.workerIdentityId !== null &&
      right.workerIdentityId !== null &&
      left.workerIdentityId !== right.workerIdentityId
    ) {
      skipped += 1
      continue
    }

    const identityId =
      existing ??
      (
        await prisma.workerIdentity.create({
          data: {
            tenantId: operatorTenant.id,
            identityNumber: await nextIdentityNumber(),
            matchGivenName: left.givenName,
            matchFamilyName: left.familyName,
            matchDateOfBirth: left.dateOfBirth,
            matchPlaceOfBirth: left.placeOfBirth ?? right.placeOfBirth,
            createdById: identity.user.id,
          },
        })
      ).id

    for (const candidateId of [proposal.candidateId, proposal.otherCandidateId]) {
      const present = await prisma.workerIdentityLink.findUnique({
        where: { workerIdentityId_candidateId: { workerIdentityId: identityId, candidateId } },
      })
      if (present !== null) continue
      const neueVerknuepfung = await prisma.workerIdentityLink.create({
        data: {
          workerIdentityId: identityId,
          candidateId,
          linkStatus: 'proposed',
          proposalBasis: proposal.basis,
          proposedAt: new Date(),
          createdById: identity.user.id,
        },
      })
      await prisma.workerIdentityMergeEntry.create({
        data: {
          workerIdentityId: identityId,
          candidateId,
          occurredAt: new Date(),
          action: 'proposed',
          reason: proposal.basis,
          // Kein Benutzer: der Abgleich ist eine Systemhandlung (4.0, Regel 10).
          createdById: identity.user.id,
        },
      })
      // Der Audit-Eintrag nennt dagegen den **Benutzer**, nicht das System:
      // 3.6 lässt den Vorschlag ohne Benutzer, weil der Treffer maschinell
      // entsteht — geschrieben hat ihn aber, solange der Prototyp keinen
      // nächtlichen Lauf hat, die Person, die den Abgleich angestoßen hat.
      // Protokolliert wird, wer geschrieben hat (3.12).
      await protokolliereGetrennt(
        schreibEintrag({
          decision,
          operation: 'create',
          bezug: protokollbezug('workerIdentityLink', neueVerknuepfung.id, operatorTenant.id),
          userId: identity.user.id,
          occurredAt: new Date(),
          reason: `Abgleichlauf (3.6): ${proposal.basis}`,
        }),
      )
      created += 1
    }
  }

  return success(
    `Abgleich gelaufen: ${created} Verknüpfung(en) **vorgeschlagen**, ${skipped} Treffer ` +
      'übersprungen (beide Sätze gehören schon zu verschiedenen bestätigten Identitäten — das ' +
      'Zusammenführen entscheidet eine Person). Ein Vorschlag ist keine Identität: bis zur ' +
      'Bestätigung zählt jeder Kandidatensatz als eigene Person (3.6, 4.2.3).',
  )
}

async function nextIdentityNumber(): Promise<string> {
  const count = await prisma.workerIdentity.count()
  return `PI-${String(count + 1).padStart(4, '0')}`
}

/**
 * Bestätigt eine vorgeschlagene Verknüpfung (3.6, Punkt 1 und 2).
 *
 * Erst hier entsteht die Identität im fachlichen Sinn: `candidate.workerIdentityId`
 * wird gesetzt, und ab jetzt zählen 5.1, 5.2 und 5.3 die Sätze zusammen. Die
 * Bestätigung trägt Zeitpunkt und Person (`confirmedAt`, `confirmedBy`) — ein
 * maschineller Treffer allein löst keine AÜG-Prüfung aus.
 */
export async function confirmLink(
  identity: LoadedIdentity,
  input: { readonly linkId: string; readonly reason: string },
): Promise<ActionResult> {
  const link = await prisma.workerIdentityLink.findUnique({
    where: { id: input.linkId },
    include: { workerIdentity: true, candidate: true },
  })
  if (link === null) return failure('Unbekannte Verknüpfung.')
  if (link.linkStatus === 'confirmed') return failure('Die Verknüpfung ist schon bestätigt.')
  if (input.reason.trim() === '') {
    return failure(
      'Die Begründung ist Pflicht: Zusammenführen und Trennen bleiben nachvollziehbar (3.6).',
      'SPEC 3.6, mergeHistory',
    )
  }

  const decision = checkPermission(
    identity.subject,
    'update',
    workerIdentityRef({ tenantId: link.workerIdentity.tenantId }),
  )
  if (!decision.allowed) {
    return verweigere(
      identity,
      decision,
      'update',
      'workerIdentityLink',
      link.id,
      link.workerIdentity.tenantId,
    )
  }

  const now = new Date()
  try {
    await prisma.$transaction(async (tx) => {
      await tx.workerIdentityLink.update({
        where: { id: link.id },
        data: {
          linkStatus: 'confirmed',
          confirmedAt: now,
          confirmedById: identity.user.id,
          reason: input.reason.trim(),
          updatedById: identity.user.id,
        },
      })
      await tx.candidate.update({
        where: { id: link.candidateId },
        data: { workerIdentityId: link.workerIdentityId, updatedById: identity.user.id },
      })
      if (link.workerIdentity.confirmedAt === null) {
        await tx.workerIdentity.update({
          where: { id: link.workerIdentityId },
          data: { confirmedAt: now, confirmedById: identity.user.id, updatedById: identity.user.id },
        })
      }
      await tx.workerIdentityMergeEntry.create({
        data: {
          workerIdentityId: link.workerIdentityId,
          candidateId: link.candidateId,
          occurredAt: now,
          action: 'confirmed',
          reason: input.reason.trim(),
          actedById: identity.user.id,
          createdById: identity.user.id,
        },
      })
      // Die Verknüpfungshistorie aus 3.6 und das Protokoll aus 3.12 sind
      // **nicht** dasselbe: die Historie ist ein Fachobjekt mit Begründung und
      // Rückholbarkeit, der Audit-Eintrag der Nachweis, wer sie geschrieben
      // hat. Deshalb beides, in einer Transaktion.
      await protokolliere(
        tx,
        schreibEintrag({
          decision,
          operation: 'update',
          bezug: protokollbezug(
            'workerIdentityLink',
            link.id,
            link.workerIdentity.tenantId,
          ),
          userId: identity.user.id,
          occurredAt: now,
          changedFields: [{ field: 'linkStatus', from: link.linkStatus, to: 'confirmed' }],
          reason: input.reason.trim(),
        }),
      )
    })
  } catch (error) {
    return asFailure(error, 'Verknüpfung konnte nicht bestätigt werden')
  }
  return success(
    'Verknüpfung bestätigt. Ab jetzt zählen die verknüpften Kandidatensätze als **dieselbe ' +
      'Person** (3.6; Grundlage von P1, P6 und der Equal-Pay-Fristen).',
  )
}

/**
 * Trennt eine Verknüpfung (3.6, Punkt 2): „eine falsche Verknüpfung muss
 * rückholbar sein, ohne die Historie zu verlieren."
 *
 * Der Satz bleibt deshalb stehen und wechselt auf `detached`; die Historie
 * bekommt einen weiteren Eintrag. `candidate.workerIdentityId` wird geleert —
 * der Kandidatensatz zählt wieder als eigene Person.
 */
export async function detachLink(
  identity: LoadedIdentity,
  input: { readonly linkId: string; readonly reason: string },
): Promise<ActionResult> {
  const link = await prisma.workerIdentityLink.findUnique({
    where: { id: input.linkId },
    include: { workerIdentity: true, candidate: true },
  })
  if (link === null) return failure('Unbekannte Verknüpfung.')
  if (link.linkStatus === 'detached') return failure('Die Verknüpfung ist schon getrennt.')
  if (input.reason.trim() === '') {
    return failure('Die Begründung ist bei einer Trennung Pflicht (3.6).', 'SPEC 3.6, mergeHistory')
  }

  const decision = checkPermission(
    identity.subject,
    'update',
    workerIdentityRef({ tenantId: link.workerIdentity.tenantId }),
  )
  if (!decision.allowed) {
    return verweigere(
      identity,
      decision,
      'update',
      'workerIdentityLink',
      link.id,
      link.workerIdentity.tenantId,
    )
  }

  // Einen Einsatz, der auf dieser Identität beruht, darf die Trennung nicht
  // stillschweigend entwerten: `assignment.workerIdentityRef` ist ab `planned`
  // Pflicht (3.7). Der Prototyp verweigert deshalb und benennt den Grund.
  const assignments = await prisma.assignment.count({
    where: { candidateId: link.candidateId, workerIdentityId: link.workerIdentityId },
  })
  if (assignments > 0) {
    return failure(
      `Zu diesem Kandidatensatz bestehen ${assignments} Einsätze mit dieser Personenidentität. ` +
        '`assignment.workerIdentityRef` ist ab `planned` Pflicht (3.7) — die Trennung würde die ' +
        'Grundlage der Zählung nach 5.1 entfernen, ohne sie zu ersetzen.',
      'SPEC 3.7, assignment.workerIdentityRef',
    )
  }

  const now = new Date()
  try {
    await prisma.$transaction(async (tx) => {
      await tx.workerIdentityLink.update({
        where: { id: link.id },
        data: {
          linkStatus: 'detached',
          detachedAt: now,
          detachedById: identity.user.id,
          reason: input.reason.trim(),
          updatedById: identity.user.id,
        },
      })
      if (link.candidate.workerIdentityId === link.workerIdentityId) {
        await tx.candidate.update({
          where: { id: link.candidateId },
          data: { workerIdentityId: null, updatedById: identity.user.id },
        })
      }
      await tx.workerIdentityMergeEntry.create({
        data: {
          workerIdentityId: link.workerIdentityId,
          candidateId: link.candidateId,
          occurredAt: now,
          action: 'detached',
          reason: input.reason.trim(),
          actedById: identity.user.id,
          createdById: identity.user.id,
        },
      })
      await protokolliere(
        tx,
        schreibEintrag({
          decision,
          operation: 'update',
          bezug: protokollbezug(
            'workerIdentityLink',
            link.id,
            link.workerIdentity.tenantId,
          ),
          userId: identity.user.id,
          occurredAt: now,
          changedFields: [{ field: 'linkStatus', from: link.linkStatus, to: 'detached' }],
          reason: input.reason.trim(),
        }),
      )
    })
  } catch (error) {
    return asFailure(error, 'Verknüpfung konnte nicht getrennt werden')
  }
  return success(
    'Verknüpfung getrennt; der Satz und die Historie bleiben erhalten (3.6). Der Kandidatensatz ' +
      'zählt wieder als eigene Person.',
  )
}

/**
 * Legt für **einen** Kandidatensatz eine bestätigte Personenidentität an.
 *
 * Nötig, weil 3.7 `workerIdentityRef` ab Status `planned` zur Pflicht macht:
 * ohne Identität kann 5.1 die Überlassungstage der Person nicht zählen, auch
 * wenn es (noch) keinen zweiten Satz gibt, mit dem sie sich verknüpfen ließe.
 * 3.6 lässt das ausdrücklich zu — `linkedCandidates` verlangt „mindestens
 * einen". Die Verknüpfung ist damit von Anfang an bestätigt: sie wird nicht
 * vorgeschlagen, sondern von einer Person angelegt.
 */
export async function createIdentityForCandidate(
  identity: LoadedIdentity,
  input: { readonly candidateId: string; readonly reason: string },
): Promise<ActionResult> {
  const candidate = await prisma.candidate.findUnique({ where: { id: input.candidateId } })
  if (candidate === null) return failure('Unbekannter Kandidat.')
  if (candidate.workerIdentityId !== null) {
    return failure('Der Kandidatensatz ist schon bestätigt verknüpft.')
  }
  const operatorTenant = await prisma.tenant.findFirst({ where: { tenantType: 'operator' } })
  if (operatorTenant === null) return failure('Kein Betreibermandant vorhanden (3.11).')

  const decision = checkPermission(
    identity.subject,
    'create',
    workerIdentityRef({ tenantId: operatorTenant.id }),
  )
  if (!decision.allowed) {
    return verweigere(
      identity,
      decision,
      'create',
      'workerIdentity',
      candidate.candidateNumber,
      operatorTenant.id,
    )
  }

  const reason =
    input.reason.trim() === ''
      ? 'Personenidentität für einen einzelnen Kandidatensatz angelegt (3.7 verlangt sie ab `planned`).'
      : input.reason.trim()
  const now = new Date()
  try {
    await prisma.$transaction(async (tx) => {
      const created = await tx.workerIdentity.create({
        data: {
          tenantId: operatorTenant.id,
          identityNumber: `PI-${String((await tx.workerIdentity.count()) + 1).padStart(4, '0')}`,
          matchGivenName: candidate.givenName,
          matchFamilyName: candidate.familyName,
          matchDateOfBirth: candidate.dateOfBirth,
          matchPlaceOfBirth: candidate.placeOfBirth,
          confirmedAt: now,
          confirmedById: identity.user.id,
          createdById: identity.user.id,
        },
      })
      await tx.workerIdentityLink.create({
        data: {
          workerIdentityId: created.id,
          candidateId: candidate.id,
          linkStatus: 'confirmed',
          proposalBasis: 'Von einer Person beim Betreiber angelegt, nicht maschinell gefunden.',
          proposedAt: now,
          confirmedAt: now,
          confirmedById: identity.user.id,
          reason,
          createdById: identity.user.id,
        },
      })
      await tx.candidate.update({
        where: { id: candidate.id },
        data: { workerIdentityId: created.id, updatedById: identity.user.id },
      })
      await tx.workerIdentityMergeEntry.create({
        data: {
          workerIdentityId: created.id,
          candidateId: candidate.id,
          occurredAt: now,
          action: 'confirmed',
          reason,
          actedById: identity.user.id,
          createdById: identity.user.id,
        },
      })
      await protokolliere(
        tx,
        schreibEintrag({
          decision,
          operation: 'create',
          bezug: protokollbezug('workerIdentity', created.id, operatorTenant.id),
          userId: identity.user.id,
          occurredAt: now,
          reason,
        }),
      )
    })
  } catch (error) {
    return asFailure(error, 'Personenidentität konnte nicht angelegt werden')
  }
  return success('Personenidentität angelegt und bestätigt verknüpft (3.6).')
}

/** Kandidatensätze ohne bestätigte Identität — nur für den Betreiber ([43]). */
export async function loadCandidatesWithoutIdentity(
  identity: LoadedIdentity,
): Promise<readonly { readonly id: string; readonly label: string }[]> {
  const operatorTenant = await prisma.tenant.findFirst({ where: { tenantType: 'operator' } })
  if (operatorTenant === null) return []
  const decision = checkPermission(
    identity.subject,
    'read',
    workerIdentityRef({ tenantId: operatorTenant.id }),
  )
  if (!decision.allowed) return []

  const candidates = await prisma.candidate.findMany({
    where: { workerIdentityId: null, status: 'active' },
    include: { supplier: true },
    orderBy: { candidateNumber: 'asc' },
  })
  return candidates.map((candidate) => ({
    id: candidate.id,
    label: `${candidate.candidateNumber} — ${candidate.givenName} ${candidate.familyName} (${candidate.supplier.legalName})`,
  }))
}
