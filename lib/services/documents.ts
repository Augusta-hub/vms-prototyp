/**
 * Fachdienst Nachweise — SPEC 3.10 (Objekt) und **5.4.3** (Nachweisfluss:
 * einstellen, anerkennen, zurückweisen).
 *
 * Drei Dinge bestimmen den Aufbau:
 *
 *  1. **Jeder** Zugriff läuft über `checkPermission` (2.2, 2.3) — auch das
 *     Listen. Gelistet wird, was die Prüffunktion für diese Identität erlaubt,
 *     und in der Fassung, die `lib/visibility/projections.ts` daraus macht.
 *     Die Sichtbarkeitsklasse aus 3.10 entscheidet dabei nicht selbst: sie ist
 *     die Tatsache, an der [35] und [36] auswerten (siehe `documentRef`).
 *  2. **Jeder** Statuswechsel läuft über `attemptTransition` mit dem Modell aus
 *     `lib/status/document.ts`. Eine Funktion, die `verificationStatus` setzt,
 *     gibt es hier nicht.
 *  3. **`mandatory` und `blocking` werden gerechnet, nie geschrieben** (3.10,
 *     5.4.4). Der Rechenweg steht in `lib/aueg/regeln/p10Nachweise.ts`; dieser
 *     Dienst zeigt das Ergebnis an und legt es nirgends ab.
 *
 * **Was der Prototyp nicht hat.** Eine Ablage für die Datei: `fileRef` ist nach
 * 3.10 ein „undurchsichtiger Verweis", und Ablageort und -verfahren sind
 * *offene Fragen 1 und 2*. Hier entsteht deshalb ein Verweis, hinter dem keine
 * Datei liegt — der Dienst behauptet nichts anderes, und die Oberfläche sagt es.
 * Benachrichtigungen (5.4.3, jede Zeile) hat der Prototyp ebenfalls nicht; die
 * Adressaten stehen im Ergebnis, damit sie nicht verloren gehen.
 */
import { katalogwirkung, passtZumBezugsobjekt } from '../aueg/regeln/p10Nachweise'
import { alsNachweiszeile, nachweisstand } from '../aueg/anbindung'
import type { Nachweisart } from '../aueg/regelwerk'
import { checkPermission, type Decision, type ResourceRef } from '../authz/check'
import type { LoadedIdentity } from '../identity/loadSubject'
import {
  pruefeDokument,
  type Bezugsobjektart,
  type Sichtbarkeitsklasse,
} from '../masterdata/invariants'
import { prisma } from '../prisma'
import {
  DOCUMENT_MODEL,
  DOCUMENT_STATE_LABELS,
  type DocumentFacts,
  type DocumentState,
  type DocumentTransitionName,
} from '../status/document'
import { attemptTransition, type TransitionOutcome } from '../status/machine'
import { project } from '../visibility/projections'
import {
  asFailure,
  documentRef,
  failure,
  loadEngagements,
  success,
  type ActionResult,
  type Engagements,
} from './common'

/* ------------------------------------------------------------------ */
/* Laden                                                               */
/* ------------------------------------------------------------------ */

/** Die Felder eines Nachweises, soweit eine Oberfläche sie zeigt. */
export interface DocumentFields {
  readonly documentNumber: string
  readonly documentCategory: string
  readonly subjectType: string
  readonly subjectLabel: string
  readonly issuer: string | null
  readonly issuedOn: string | null
  readonly validFrom: string | null
  readonly validTo: string | null
  readonly fileRef: string
  readonly fileName: string
  readonly mimeType: string
  readonly uploadedAt: string
  readonly uploadedBy: string
  readonly verificationStatus: string
  readonly verifiedAt: string | null
  readonly verifiedBy: string | null
  readonly rejectionReason: string | null
  readonly confidentiality: string
}

export interface DocumentView {
  readonly id: string
  readonly fields: Partial<DocumentFields>
  /** Felder, die eine Fußnote dieser Rolle nicht zeigt — benannt, nicht verschwiegen. */
  readonly concealed: readonly string[]
  readonly state: DocumentState
  readonly stateLabel: string
  /** `mandatory`, abgeleitet aus dem Katalog (3.10, 5.4.4). */
  readonly mandatory: boolean
  /** `blocking`, abgeleitet aus dem Katalog (3.10, 5.4.4). */
  readonly blocking: boolean
  readonly derivationReason: string
  /** Die Übergänge, die aus diesem Zustand überhaupt führen (5.4.3). */
  readonly availableTransitions: readonly DocumentTransitionName[]
  /** Zugriff über die Mandantengrenze — nach 2.3 protokollpflichtig. */
  readonly crossTenant: boolean
}

/**
 * Nachweise in der sichtbaren Fassung.
 *
 * Geladen werden **alle** Dokumente und danach einzeln geprüft, statt eine
 * Abfrage mit der Mandantenbedingung zu bauen: die Sichtbarkeit hängt nach 3.10
 * und 2.2 an Sichtbarkeitsklasse, Nachweisart, Beauftragung und Einsteller —
 * Bedingungen, die in der Prüffunktion stehen und nicht in einer `where`-Klausel
 * nachgebaut werden sollen. Zwei Quellen für dieselbe Grenze liefen auseinander.
 */
export async function loadDocuments(identity: LoadedIdentity): Promise<readonly DocumentView[]> {
  const engagements = await loadEngagements()
  const rows = await prisma.document.findMany({
    include: DOCUMENT_INCLUDE,
    orderBy: { documentNumber: 'asc' },
  })

  const views: DocumentView[] = []
  for (const row of rows) {
    const decision = checkPermission(identity.subject, 'read', refFor(row, engagements))
    if (!decision.allowed) continue
    views.push(asView(row, decision, identity, engagements))
  }
  return views
}

/** Ein einzelner Nachweis, oder `null`, wenn diese Identität ihn nicht sieht. */
export async function loadDocument(
  identity: LoadedIdentity,
  documentId: string,
): Promise<DocumentView | null> {
  const row = await prisma.document.findUnique({
    where: { id: documentId },
    include: DOCUMENT_INCLUDE,
  })
  if (row === null) return null
  const engagements = await loadEngagements()
  const decision = checkPermission(identity.subject, 'read', refFor(row, engagements))
  if (!decision.allowed) return null
  return asView(row, decision, identity, engagements)
}

/* ------------------------------------------------------------------ */
/* Auswahl für die Oberfläche                                          */
/* ------------------------------------------------------------------ */

export interface SubjectOption {
  readonly subjectType: Bezugsobjektart
  readonly id: string
  readonly label: string
}

export interface DocumentOptions {
  /** Die Bezugsobjekte, zu denen diese Identität einstellen darf (2.2, `A`). */
  readonly subjects: readonly SubjectOption[]
  readonly mayCreate: boolean
}

/**
 * Welche Bezugsobjekte darf diese Identität mit einem Nachweis versehen?
 *
 * Geprüft wird je Objekt mit `checkPermission` — nicht mit einer Rollenliste.
 * Die Prüfung läuft mit der **weitesten** Sichtbarkeitsklasse
 * (`assignmentParties`): sie entscheidet, ob die Mandantengrenze den Vorgang
 * überhaupt erreichbar macht. Welche Klasse am Ende zulässig ist, entscheidet
 * das Einstellen selbst — die Invariante aus 3.10 kann eine engere verlangen.
 */
export async function loadDocumentOptions(identity: LoadedIdentity): Promise<DocumentOptions> {
  const engagements = await loadEngagements()
  const [suppliers, candidates, assignments, sites, agreements] = await Promise.all([
    prisma.supplier.findMany({ orderBy: { supplierNumber: 'asc' } }),
    prisma.candidate.findMany({
      include: {
        supplier: { select: { tenantId: true } },
        assignments: { select: { customer: { select: { tenantId: true } } } },
      },
      orderBy: { candidateNumber: 'asc' },
    }),
    prisma.assignment.findMany({
      include: {
        customer: { select: { tenantId: true } },
        supplier: { select: { tenantId: true } },
      },
      orderBy: { assignmentNumber: 'asc' },
    }),
    prisma.site.findMany({ orderBy: { siteNumber: 'asc' } }),
    prisma.masterAgreement.findMany({
      include: {
        customer: { select: { tenantId: true } },
        supplier: { select: { tenantId: true } },
      },
      orderBy: { agreementNumber: 'asc' },
    }),
  ])

  const subjects: SubjectOption[] = []
  const offer = (
    subjectType: Bezugsobjektart,
    id: string,
    label: string,
    sides: {
      readonly tenantId: string
      readonly tenantType: 'operator' | 'customer' | 'supplier'
      readonly customerTenantIds: readonly string[]
      readonly supplierTenantId: string | null
      readonly siteId: string | null
    },
  ): void => {
    const decision = checkPermission(
      identity.subject,
      'create',
      documentRef(
        {
          ...sides,
          documentCategory: 'other',
          confidentiality: 'assignmentParties',
          verificationStatus: 'submitted',
          ownerTenantId: null,
          uploadedById: null,
        },
        engagements,
      ),
    )
    if (decision.allowed) subjects.push({ subjectType, id, label })
  }

  for (const row of suppliers) {
    offer('supplier', row.id, `Lieferant ${row.supplierNumber} — ${row.legalName}`, {
      tenantId: row.tenantId,
      tenantType: 'supplier',
      customerTenantIds: [],
      supplierTenantId: row.tenantId,
      siteId: null,
    })
  }
  for (const row of candidates) {
    offer(
      'candidate',
      row.id,
      `Kandidat ${row.candidateNumber} — ${row.givenName} ${row.familyName}`,
      {
        tenantId: row.tenantId,
        tenantType: 'supplier',
        customerTenantIds: [
          ...new Set(row.assignments.map((einsatz) => einsatz.customer.tenantId)),
        ],
        supplierTenantId: row.supplier.tenantId,
        siteId: null,
      },
    )
  }
  for (const row of assignments) {
    offer('assignment', row.id, `Einsatz ${row.assignmentNumber}`, {
      tenantId: row.tenantId,
      tenantType: 'operator',
      customerTenantIds: [row.customer.tenantId],
      supplierTenantId: row.supplier.tenantId,
      siteId: row.siteId,
    })
  }
  for (const row of sites) {
    offer('site', row.id, `Standort ${row.siteNumber} — ${row.name}`, {
      tenantId: row.tenantId,
      tenantType: 'customer',
      customerTenantIds: [row.tenantId],
      supplierTenantId: null,
      siteId: row.id,
    })
  }
  for (const row of agreements) {
    offer('masterAgreement', row.id, `Rahmenvertrag ${row.agreementNumber}`, {
      tenantId: row.tenantId,
      tenantType: 'operator',
      customerTenantIds: row.customer === null ? [] : [row.customer.tenantId],
      supplierTenantId: row.supplier?.tenantId ?? null,
      siteId: null,
    })
  }

  return { subjects, mayCreate: subjects.length > 0 }
}

/* ------------------------------------------------------------------ */
/* Einstellen (— → submitted)                                          */
/* ------------------------------------------------------------------ */

export interface NewDocumentInput {
  readonly documentCategory: Nachweisart
  readonly subjectType: Bezugsobjektart
  /** Die Kennung des Bezugsobjekts — genau eines (3.10). */
  readonly subjectId: string
  readonly fileName: string
  readonly mimeType: string
  readonly issuer: string | null
  readonly issuedOn: Date | null
  readonly validFrom: Date | null
  readonly validTo: Date | null
  /**
   * Sichtbarkeitsklasse (3.10, Pflicht). Nicht abgeleitet: 3.10 führt sie als
   * Feld, und ein Nachweis derselben Art kann je Fall verschieden offen sein.
   * Einen Vorschlag je Art macht `vorschlagSichtbarkeit`; dass eine
   * Vertragsunterlage des Lieferanten nicht `assignmentParties` sein darf,
   * prüft die Invariante in `lib/masterdata/invariants.ts`.
   */
  readonly confidentiality: Sichtbarkeitsklasse
}

/**
 * Stellt einen Nachweis ein — 5.4.3, `— → submitted`.
 *
 * Der Mandant des Dokuments **folgt dem Bezugsobjekt** (3.10) und wird deshalb
 * aus ihm gelesen, nicht aus der Identität des Einstellers: ein Lieferant, der
 * eine Unterweisung zu einem Einsatz einstellt, legt kein Dokument in seinem
 * eigenen Mandanten an.
 */
export async function submitDocument(
  identity: LoadedIdentity,
  input: NewDocumentInput,
): Promise<ActionResult> {
  const subject = await loadSubjectObject(input.subjectType, input.subjectId)
  if (subject === null) return failure('Unbekanntes Bezugsobjekt (3.10).')

  const engagements = await loadEngagements()
  const uploadedAt = new Date()
  // Der Ablageverweis ist in diesem Prototyp ein Platzhalter: hinter ihm liegt
  // keine Datei (offene Fragen 1 und 2). Er ist **undurchsichtig** im Sinne von
  // 3.10 — aus ihm lässt sich kein Ablageort ableiten.
  const fileRef = `ablage://prototyp/${input.documentCategory}/${uploadedAt.getTime()}`
  const documentNumber = await nextDocumentNumber()

  const felder = {
    documentCategory: input.documentCategory,
    subjectType: input.subjectType,
    supplierId: input.subjectType === 'supplier' ? subject.id : null,
    customerId: input.subjectType === 'customer' ? subject.id : null,
    candidateId: input.subjectType === 'candidate' ? subject.id : null,
    assignmentId: input.subjectType === 'assignment' ? subject.id : null,
    siteId: input.subjectType === 'site' ? subject.id : null,
    masterAgreementId: input.subjectType === 'masterAgreement' ? subject.id : null,
    fileRef,
    fileName: input.fileName.trim(),
    mimeType: input.mimeType.trim(),
    // Der Nachweis entsteht als eingereicht; die Anerkennung ist die Handlung
    // des Betreibers ([34], 5.4.3).
    verificationStatus: 'submitted' as const,
    verifiedAt: null,
    verifiedById: null,
    rejectionReason: null,
    validFrom: input.validFrom,
    validTo: input.validTo,
    confidentiality: input.confidentiality,
  }

  // Die Invarianten aus 3.10 **vor** dem Übergang: ein Dokument, das sie
  // verletzt, ist kein Vorgang, über dessen Status man streiten müsste.
  const verletzungen = pruefeDokument(felder)
  if (verletzungen.length > 0) {
    const erste = verletzungen[0]
    if (erste !== undefined) {
      return failure(`${erste.feld}: ${erste.grund}`, erste.specReference)
    }
  }

  const resource = documentRef(
    {
      tenantId: subject.tenantId,
      tenantType: subject.tenantType,
      documentCategory: input.documentCategory,
      confidentiality: input.confidentiality,
      verificationStatus: 'submitted',
      // **Kein** Eigentümer beim Einstellen. 3.10 macht den Einsteller zum
      // Eigentümer, und `documentRef` legt ihm das bestehende Dokument offen —
      // beim Anlegen wäre das aber der Zugreifende selbst, und eine Offenlegung,
      // die sich der Zugreifende selbst erteilt, trägt die Mandantengrenze aus
      // 2.3 nicht. Wer einstellen darf, muss den Vorgang über sein
      // Bezugsobjekt erreichen.
      ownerTenantId: null,
      customerTenantIds: subject.customerTenantIds,
      supplierTenantId: subject.supplierTenantId,
      siteId: subject.siteId,
      uploadedById: identity.user.id,
    },
    engagements,
  )

  const outcome = attemptTransition(DOCUMENT_MODEL, 'submit', {
    currentStatus: null,
    subject: identity.subject,
    resource,
    facts: factsFor(felder, identity.user.id, null, false),
  })
  if (!outcome.applied) return rejection(outcome)

  try {
    await prisma.document.create({
      data: {
        tenantId: subject.tenantId,
        documentNumber,
        ...felder,
        issuer: input.issuer,
        issuedOn: input.issuedOn,
        uploadedAt,
        uploadedById: identity.user.id,
        createdById: identity.user.id,
      },
    })
  } catch (error) {
    return asFailure(error, 'Nachweis konnte nicht eingestellt werden')
  }

  // 5.4.3, Nebenwirkung: „Benachrichtigung an `MD`". Der Prototyp verschickt
  // nichts; die Zuständigkeit steht im Ergebnis, damit sie nicht verschwindet.
  return success(
    `${outcome.label}: ${documentNumber} steht auf „eingereicht" und wartet auf die ` +
      `Anerkennung durch MD (${outcome.specReference}). ` +
      'Hinter dem Ablageverweis liegt in diesem Prototyp keine Datei (offene Fragen 1 und 2).',
  )
}

/* ------------------------------------------------------------------ */
/* Anerkennen und Zurückweisen (submitted → accepted / rejected)       */
/* ------------------------------------------------------------------ */

export interface DocumentDecisionInput {
  readonly documentId: string
  /** Pflicht beim Zurückweisen (3.10, 5.4.3). */
  readonly rejectionReason: string | null
  /**
   * Beim Anerkennen ohne `validTo`: die ausdrückliche Bestätigung, dass der
   * Nachweis unbefristet gilt (5.4.3, 5.4.4). Keine Sperre, aber eine
   * Entscheidung — sie soll nicht aus Versehen entstehen.
   */
  readonly validToDeliberatelyOpen?: boolean
}

/**
 * Anerkennen — 5.4.3, `submitted` → `accepted`.
 *
 * Danach wird P10 **neu gerechnet** (5.4.3, Nebenwirkung; 5.5.1 b). Der
 * Prototyp rechnet die Prüfungen an den Übergängen, nicht in abgeleiteten
 * Spalten — neu gerechnet wird deshalb hier und das Ergebnis gemeldet. Es ist
 * nach 5.5.1 b ausdrücklich Information oder Warnung und **nie** eine Sperre:
 * „gesperrt werden Handlungen, nicht Feststellungen."
 */
export async function acceptDocument(
  identity: LoadedIdentity,
  input: DocumentDecisionInput,
): Promise<ActionResult> {
  return decide(identity, 'accept', input)
}

/** Zurückweisen — 5.4.3, `submitted` → `rejected`. Endzustand. */
export async function rejectDocument(
  identity: LoadedIdentity,
  input: DocumentDecisionInput,
): Promise<ActionResult> {
  return decide(identity, 'reject', input)
}

async function decide(
  identity: LoadedIdentity,
  transition: 'accept' | 'reject',
  input: DocumentDecisionInput,
): Promise<ActionResult> {
  const row = await prisma.document.findUnique({
    where: { id: input.documentId },
    include: DOCUMENT_INCLUDE,
  })
  if (row === null) return failure('Unbekannter Nachweis.')

  const engagements = await loadEngagements()
  const verifiedAt = new Date()
  const facts = factsFor(
    {
      documentCategory: row.documentCategory,
      subjectType: row.subjectType,
      supplierId: row.supplierId,
      customerId: row.customerId,
      candidateId: row.candidateId,
      assignmentId: row.assignmentId,
      siteId: row.siteId,
      masterAgreementId: row.masterAgreementId,
      fileRef: row.fileRef,
      fileName: row.fileName,
      mimeType: row.mimeType,
      verifiedAt: transition === 'accept' ? verifiedAt : null,
      verifiedById: transition === 'accept' ? identity.user.id : null,
      rejectionReason: transition === 'reject' ? input.rejectionReason : null,
      validTo: row.validTo,
    },
    identity.user.id,
    row.uploadedById,
    input.validToDeliberatelyOpen ?? false,
  )

  const outcome = attemptTransition(DOCUMENT_MODEL, transition, {
    currentStatus: row.verificationStatus as DocumentState,
    subject: identity.subject,
    resource: refFor(row, engagements),
    facts,
  })
  if (!outcome.applied) return rejection(outcome)

  try {
    await prisma.document.update({
      where: { id: row.id },
      data:
        transition === 'accept'
          ? {
              verificationStatus: 'accepted',
              verifiedAt,
              verifiedById: identity.user.id,
              updatedById: identity.user.id,
            }
          : {
              verificationStatus: 'rejected',
              rejectionReason: input.rejectionReason,
              updatedById: identity.user.id,
            },
    })
  } catch (error) {
    return asFailure(error, 'Die Entscheidung über den Nachweis konnte nicht gespeichert werden')
  }

  const nachgerechnet = await recomputeAfterDecision(row, transition, verifiedAt)
  const hinweis = unbefristetHinweis(transition, row.validTo, facts)
  return success(
    `${outcome.label}: ${row.documentNumber} steht jetzt auf ` +
      `„${DOCUMENT_STATE_LABELS[outcome.to]}" (${outcome.specReference}). ${nachgerechnet}${hinweis}`,
  )
}

/**
 * P10 nach der Entscheidung neu gerechnet — der Anlass „Speicherung" aus
 * 5.5.1 b, für den der Pflichtkatalog in 5.4.4 eine eigene Spalte trägt
 * (`Speicherung` in `lib/aueg/regelwerk.ts`).
 *
 * Gerechnet wird gegen das **Bezugsobjekt** des Nachweises, mit dem Tag der
 * Entscheidung als Stichtag. Das Ergebnis sperrt nichts; es sagt, was der
 * Nachweis an der Lage geändert hat.
 */
async function recomputeAfterDecision(
  row: LoadedDocument,
  transition: 'accept' | 'reject',
  evaluationDate: Date,
): Promise<string> {
  const umfeld = await documentsAroundSubject(row)
  if (umfeld === null) {
    return 'P10 wurde nicht neu gerechnet: das Bezugsobjekt trägt keine Pflichtnachweise (5.4.4).'
  }
  const stand = nachweisstand({
    nachweise: umfeld.documents.map(alsNachweiszeile),
    qZeile: 'Speicherung',
    bezugsobjekt: umfeld.subjectRef,
    stichtag: evaluationDate,
    zeitraum: null,
    arbeitserlaubnisErforderlich: umfeld.arbeitserlaubnisErforderlich,
    unterweisungVerlangt: umfeld.unterweisungVerlangt,
    // **Nur die geänderte Art.** 5.5.1 b rechnet die abgeleiteten Felder des
    // geänderten Datums neu — nicht den ganzen Katalog. Die Sammelprüfung über
    // alle Pflichtarten gehört zum Übergang (Q21), wo sie auch sperren kann;
    // hier würde sie Mängel melden, die mit diesem Nachweis nichts zu tun
    // haben (etwa eine fehlende Unterweisung, während eine Qualifikation
    // anerkannt wird).
    nurArten: [row.documentCategory as Nachweisart],
  })
  const vorwort =
    transition === 'accept'
      ? 'P10 neu gerechnet (5.4.3, 5.5.1 b)'
      : 'P10 neu gerechnet; der Pflichtnachweis bleibt offen (5.4.3)'
  return `${vorwort}: ${stand.meldung}`
}

/**
 * 5.4.4, „Nachweis ohne `validTo`": bei den **sperrenden** Arten trägt das
 * Ergebnis eine Information an `MD` — „damit das Enddatum nicht aus Versehen
 * leer bleibt". Eine Sperre ist es nicht.
 */
function unbefristetHinweis(
  transition: 'accept' | 'reject',
  validTo: Date | null,
  facts: DocumentFacts,
): string {
  if (transition !== 'accept' || validTo !== null) return ''
  const wirkung = katalogwirkung(facts.documentCategory, {
    arbeitserlaubnisErforderlich: null,
    unterweisungVerlangt: null,
  })
  if (!wirkung.sperrend) return ''
  return (
    ' Information an MD: Der Nachweis gilt unbefristet, obwohl seine Art sperrt — ' +
    'ungewöhnlich, aber zulässig (SPEC 5.4.4, Nachweis ohne validTo).'
  )
}

/* ------------------------------------------------------------------ */
/* Laden des Umfelds                                                   */
/* ------------------------------------------------------------------ */

const DOCUMENT_INCLUDE = {
  uploadedBy: { select: { id: true, givenName: true, familyName: true, tenantId: true } },
  verifiedBy: { select: { givenName: true, familyName: true } },
  supplier: { select: { id: true, tenantId: true, legalName: true } },
  customer: { select: { id: true, tenantId: true, legalName: true } },
  candidate: {
    select: {
      id: true,
      candidateNumber: true,
      workPermitRequired: true,
      supplier: { select: { tenantId: true, legalName: true } },
      // Die Kunden, bei denen dieser Kandidat im Einsatz ist — der
      // Einsatzbezug, von dem [35] spricht.
      assignments: { select: { customer: { select: { tenantId: true } } } },
    },
  },
  assignment: {
    select: {
      id: true,
      assignmentNumber: true,
      tenantId: true,
      siteId: true,
      customer: { select: { tenantId: true } },
      supplier: { select: { tenantId: true } },
      site: { select: { safetyBriefingRequired: true } },
      candidate: { select: { id: true, workPermitRequired: true } },
    },
  },
  site: {
    select: { id: true, tenantId: true, name: true, safetyBriefingRequired: true },
  },
  masterAgreement: {
    select: {
      id: true,
      tenantId: true,
      agreementNumber: true,
      customer: { select: { tenantId: true } },
      supplier: { select: { tenantId: true } },
    },
  },
} as const

type LoadedDocument = Awaited<
  ReturnType<typeof prisma.document.findMany<{ include: typeof DOCUMENT_INCLUDE }>>
>[number]

/**
 * Der `ResourceRef` eines geladenen Nachweises. Kunde und Lieferant kommen aus
 * dem **Bezugsobjekt**: ein Nachweis am Einsatz betrifft beide, einer am
 * Kandidaten nur den Lieferanten, einer am Standort nur den Kunden.
 */
function refFor(row: LoadedDocument, engagements: Engagements): ResourceRef {
  const bezug = subjectSides(row)
  return documentRef(
    {
      tenantId: row.tenantId,
      tenantType: bezug.tenantType,
      documentCategory: row.documentCategory,
      confidentiality: row.confidentiality,
      verificationStatus: row.verificationStatus,
      ownerTenantId: row.uploadedBy.tenantId,
      customerTenantIds: bezug.customerTenantIds,
      supplierTenantId: bezug.supplierTenantId,
      siteId: bezug.siteId,
      uploadedById: row.uploadedById,
    },
    engagements,
  )
}

/**
 * Mandant, einsatzbezogene Kunden, Lieferant und Standort des Bezugsobjekts
 * (3.10).
 *
 * „Einsatzbezogen zum eigenen Kunden" ([35]) heißt je Bezugsobjekt etwas
 * anderes: beim **Einsatz** dessen Kunde, beim **Kandidaten** die Kunden seiner
 * Einsätze (ein Kandidat kann bei mehreren im Einsatz sein), beim **Standort**
 * und beim **Kunden** der eigene. Beim **Lieferanten** gibt es keinen
 * einsatzbezogenen Kunden — dort trägt allein die Beauftragung, die
 * `documentRef` ergänzt ([36]).
 */
function subjectSides(row: LoadedDocument): {
  readonly tenantType: 'operator' | 'customer' | 'supplier'
  readonly customerTenantIds: readonly string[]
  readonly supplierTenantId: string | null
  readonly siteId: string | null
} {
  if (row.supplier !== null) {
    return {
      tenantType: 'supplier',
      customerTenantIds: [],
      supplierTenantId: row.supplier.tenantId,
      siteId: null,
    }
  }
  if (row.candidate !== null) {
    return {
      tenantType: 'supplier',
      customerTenantIds: [
        ...new Set(row.candidate.assignments.map((einsatz) => einsatz.customer.tenantId)),
      ],
      supplierTenantId: row.candidate.supplier.tenantId,
      siteId: null,
    }
  }
  if (row.customer !== null) {
    return {
      tenantType: 'customer',
      customerTenantIds: [row.customer.tenantId],
      supplierTenantId: null,
      siteId: null,
    }
  }
  if (row.site !== null) {
    return {
      tenantType: 'customer',
      customerTenantIds: [row.site.tenantId],
      supplierTenantId: null,
      siteId: row.site.id,
    }
  }
  if (row.assignment !== null) {
    return {
      tenantType: 'operator',
      customerTenantIds: [row.assignment.customer.tenantId],
      supplierTenantId: row.assignment.supplier.tenantId,
      siteId: row.assignment.siteId,
    }
  }
  if (row.masterAgreement !== null) {
    return {
      tenantType: 'operator',
      customerTenantIds:
        row.masterAgreement.customer === null ? [] : [row.masterAgreement.customer.tenantId],
      supplierTenantId: row.masterAgreement.supplier?.tenantId ?? null,
      siteId: null,
    }
  }
  // Nach 3.10 unmöglich (genau ein Verweis ist gesetzt, geprüft in
  // lib/masterdata/invariants.ts). Tritt es doch ein, ist der Nachweis für
  // niemanden außerhalb seines Mandanten sichtbar — die strengere Antwort.
  return {
    tenantType: 'operator',
    customerTenantIds: [],
    supplierTenantId: null,
    siteId: null,
  }
}

/**
 * Die Nachweise **um** das Bezugsobjekt herum, für das Neurechnen von P10: ein
 * Nachweis am Kandidaten wird gegen die Nachweise desselben Kandidaten
 * gerechnet, einer am Einsatz gegen Einsatz, Kandidat und Lieferant — genau die
 * Zusammenstellung, die der Einsatzstart (Q21) prüft.
 */
async function documentsAroundSubject(row: LoadedDocument): Promise<{
  readonly subjectRef: string | null
  readonly documents: readonly DocumentRowForRules[]
  readonly arbeitserlaubnisErforderlich: boolean | null
  readonly unterweisungVerlangt: boolean | null
} | null> {
  if (row.assignmentId !== null && row.assignment !== null) {
    const documents = await prisma.document.findMany({
      where: {
        OR: [
          { assignmentId: row.assignmentId },
          { candidateId: row.assignment.candidate?.id ?? '—' },
          { supplierId: await supplierIdOfAssignment(row.assignmentId) },
        ],
      },
    })
    return {
      subjectRef: null,
      documents,
      arbeitserlaubnisErforderlich: row.assignment.candidate?.workPermitRequired ?? null,
      unterweisungVerlangt: row.assignment.site.safetyBriefingRequired,
    }
  }
  if (row.candidateId !== null && row.candidate !== null) {
    const documents = await prisma.document.findMany({ where: { candidateId: row.candidateId } })
    return {
      subjectRef: row.candidateId,
      documents,
      arbeitserlaubnisErforderlich: row.candidate.workPermitRequired,
      unterweisungVerlangt: null,
    }
  }
  if (row.supplierId !== null) {
    const documents = await prisma.document.findMany({ where: { supplierId: row.supplierId } })
    return {
      subjectRef: row.supplierId,
      documents,
      arbeitserlaubnisErforderlich: null,
      unterweisungVerlangt: null,
    }
  }
  return null
}

type DocumentRowForRules = Parameters<typeof alsNachweiszeile>[0]

async function supplierIdOfAssignment(assignmentId: string): Promise<string> {
  const row = await prisma.assignment.findUnique({
    where: { id: assignmentId },
    select: { supplierId: true },
  })
  return row?.supplierId ?? '—'
}

/** Mandant und Seiten eines Bezugsobjekts beim Einstellen (3.10). */
async function loadSubjectObject(
  subjectType: Bezugsobjektart,
  subjectId: string,
): Promise<{
  readonly id: string
  readonly tenantId: string
  readonly tenantType: 'operator' | 'customer' | 'supplier'
  /** Die einsatzbezogenen Kundenmandanten — siehe `subjectSides`. */
  readonly customerTenantIds: readonly string[]
  readonly supplierTenantId: string | null
  readonly siteId: string | null
} | null> {
  switch (subjectType) {
    case 'supplier': {
      const row = await prisma.supplier.findUnique({ where: { id: subjectId } })
      return row === null
        ? null
        : {
            id: row.id,
            tenantId: row.tenantId,
            tenantType: 'supplier',
            customerTenantIds: [],
            supplierTenantId: row.tenantId,
            siteId: null,
          }
    }
    case 'customer': {
      const row = await prisma.customer.findUnique({ where: { id: subjectId } })
      return row === null
        ? null
        : {
            id: row.id,
            tenantId: row.tenantId,
            tenantType: 'customer',
            customerTenantIds: [row.tenantId],
            supplierTenantId: null,
            siteId: null,
          }
    }
    case 'candidate': {
      const row = await prisma.candidate.findUnique({
        where: { id: subjectId },
        include: {
          supplier: { select: { tenantId: true } },
          // Die Kunden der Einsätze dieses Kandidaten — der Einsatzbezug,
          // von dem [35] spricht.
          assignments: { select: { customer: { select: { tenantId: true } } } },
        },
      })
      return row === null
        ? null
        : {
            id: row.id,
            tenantId: row.tenantId,
            tenantType: 'supplier',
            customerTenantIds: [
              ...new Set(row.assignments.map((einsatz) => einsatz.customer.tenantId)),
            ],
            supplierTenantId: row.supplier.tenantId,
            siteId: null,
          }
    }
    case 'assignment': {
      const row = await prisma.assignment.findUnique({
        where: { id: subjectId },
        include: {
          customer: { select: { tenantId: true } },
          supplier: { select: { tenantId: true } },
        },
      })
      return row === null
        ? null
        : {
            id: row.id,
            tenantId: row.tenantId,
            tenantType: 'operator',
            customerTenantIds: [row.customer.tenantId],
            supplierTenantId: row.supplier.tenantId,
            siteId: row.siteId,
          }
    }
    case 'site': {
      const row = await prisma.site.findUnique({ where: { id: subjectId } })
      return row === null
        ? null
        : {
            id: row.id,
            tenantId: row.tenantId,
            tenantType: 'customer',
            customerTenantIds: [row.tenantId],
            supplierTenantId: null,
            siteId: row.id,
          }
    }
    case 'masterAgreement': {
      const row = await prisma.masterAgreement.findUnique({
        where: { id: subjectId },
        include: {
          customer: { select: { tenantId: true } },
          supplier: { select: { tenantId: true } },
        },
      })
      return row === null
        ? null
        : {
            id: row.id,
            tenantId: row.tenantId,
            tenantType: 'operator',
            customerTenantIds: row.customer === null ? [] : [row.customer.tenantId],
            supplierTenantId: row.supplier?.tenantId ?? null,
            siteId: null,
          }
    }
  }
}

/* ------------------------------------------------------------------ */
/* Hilfsmittel                                                         */
/* ------------------------------------------------------------------ */

/**
 * Vorschlag für die Sichtbarkeitsklasse je Nachweisart (3.10). Ein
 * **Vorschlag**, keine Ableitung: 3.10 führt das Feld, und die Oberfläche
 * überschreibt es. Die Begründung steht in 3.10: „der Kunde sieht
 * einsatzbezogene Nachweise, nicht die Vertragsunterlagen des Lieferanten."
 */
export function vorschlagSichtbarkeit(art: Nachweisart): Sichtbarkeitsklasse {
  switch (art) {
    case 'safetyBriefing':
    case 'qualificationCertificate':
      return 'assignmentParties'
    case 'permitCertificate':
    case 'clearanceCertificate':
    case 'agreementDocument':
    case 'workPermit':
      return 'operatorAndOwner'
    default:
      return 'operatorAndOwner'
  }
}

function factsFor(
  felder: {
    readonly documentCategory: string
    readonly subjectType: string
    readonly supplierId: string | null
    readonly customerId: string | null
    readonly candidateId: string | null
    readonly assignmentId: string | null
    readonly siteId: string | null
    readonly masterAgreementId: string | null
    readonly fileRef: string
    readonly fileName: string
    readonly mimeType: string
    readonly verifiedAt: Date | null
    readonly verifiedById: string | null
    readonly rejectionReason: string | null
    readonly validTo: Date | null
  },
  actingUserId: string,
  uploadedById: string | null,
  validToDeliberatelyOpen: boolean,
): DocumentFacts {
  const art = felder.documentCategory as Nachweisart
  return {
    documentCategory: art,
    subjectType: felder.subjectType as DocumentFacts['subjectType'],
    subjectRef:
      felder.supplierId ??
      felder.customerId ??
      felder.candidateId ??
      felder.assignmentId ??
      felder.siteId ??
      felder.masterAgreementId,
    fileRef: felder.fileRef,
    fileName: felder.fileName,
    mimeType: felder.mimeType,
    categoryFitsSubject: passtZumBezugsobjekt(art, felder.subjectType),
    uploadedById,
    actingUserId,
    verifiedAt: felder.verifiedAt,
    verifiedById: felder.verifiedById,
    rejectionReason: felder.rejectionReason,
    validTo: felder.validTo,
    validToDeliberatelyOpen,
  }
}

function asView(
  row: LoadedDocument,
  decision: Decision,
  identity: LoadedIdentity,
  engagements: Engagements,
): DocumentView {
  const state = row.verificationStatus as DocumentState
  // `mandatory` und `blocking` — gerechnet, nicht gelesen (3.10, 5.4.4). Die
  // Pflichtangaben kommen vom Bezugsobjekt; fehlen sie, rechnet 5.4.6 streng.
  const wirkung = katalogwirkung(row.documentCategory as Nachweisart, {
    arbeitserlaubnisErforderlich:
      row.candidate?.workPermitRequired ?? row.assignment?.candidate?.workPermitRequired ?? null,
    unterweisungVerlangt:
      row.site?.safetyBriefingRequired ?? row.assignment?.site.safetyBriefingRequired ?? null,
  })
  const fields: DocumentFields = {
    documentNumber: row.documentNumber,
    documentCategory: row.documentCategory,
    subjectType: row.subjectType,
    subjectLabel: subjectLabel(row),
    issuer: row.issuer,
    issuedOn: day(row.issuedOn),
    validFrom: day(row.validFrom),
    validTo: day(row.validTo),
    fileRef: row.fileRef,
    fileName: row.fileName,
    mimeType: row.mimeType,
    uploadedAt: day(row.uploadedAt) ?? '',
    uploadedBy: `${row.uploadedBy.givenName} ${row.uploadedBy.familyName}`,
    verificationStatus: row.verificationStatus,
    verifiedAt: day(row.verifiedAt),
    verifiedBy:
      row.verifiedBy === null ? null : `${row.verifiedBy.givenName} ${row.verifiedBy.familyName}`,
    rejectionReason: row.rejectionReason,
    confidentiality: row.confidentiality,
  }
  const projected = project(fields, decision)
  return {
    id: row.id,
    fields: projected ?? {},
    concealed: decision.allowed ? decision.concealedFields : [],
    state,
    stateLabel: DOCUMENT_STATE_LABELS[state],
    mandatory: wirkung.pflicht,
    blocking: wirkung.sperrend,
    derivationReason: wirkung.begruendung,
    availableTransitions: offeredTransitions(row, state, identity, engagements),
    crossTenant: decision.allowed ? decision.crossTenant : false,
  }
}

/**
 * Welche Übergänge aus 5.4.3 bietet die Oberfläche **dieser** Identität an?
 *
 * Nicht nach dem Zustand allein: eine Handlung anzubieten, die die Matrix
 * dieser Rolle nicht erlaubt, wäre eine Einladung in eine Verweigerung. Geprüft
 * wird deshalb mit `checkPermission` und dem **Zielstatus** — genau so, wie der
 * Übergang es später tut (Fußnote [34] liest ihn).
 *
 * Das Vier-Augen-Prinzip aus 5.4.3 kommt hinzu: wer den Nachweis eingestellt
 * hat, entscheidet nicht über ihn. Es ist eine Vorbedingung des Übergangs; hier
 * steht es, damit die Oberfläche keinen Knopf zeigt, der sicher scheitert.
 */
function offeredTransitions(
  row: LoadedDocument,
  state: DocumentState,
  identity: LoadedIdentity,
  engagements: Engagements,
): readonly DocumentTransitionName[] {
  if (state !== 'submitted') return []
  if (row.uploadedById === identity.user.id) return []
  const resource = refFor(row, engagements)
  return (['accept', 'reject'] as const).filter((name) => {
    const targetStatus = name === 'accept' ? 'accepted' : 'rejected'
    const auslösende: readonly string[] = DOCUMENT_MODEL.transitions[name].roles
    const triggeringGrants = identity.subject.grants.filter((eintrag) =>
      auslösende.includes(eintrag.roleCode),
    )
    if (triggeringGrants.length === 0) return false
    return checkPermission({ ...identity.subject, grants: triggeringGrants }, 'transition', {
      ...resource,
      targetStatus,
    }).allowed
  })
}

function subjectLabel(row: LoadedDocument): string {
  if (row.supplier !== null) return `Lieferant ${row.supplier.legalName}`
  if (row.customer !== null) return `Kunde ${row.customer.legalName}`
  if (row.candidate !== null) return `Kandidat ${row.candidate.candidateNumber}`
  if (row.assignment !== null) return `Einsatz ${row.assignment.assignmentNumber}`
  if (row.site !== null) return `Standort ${row.site.name}`
  if (row.masterAgreement !== null) {
    return `Rahmenvertrag ${row.masterAgreement.agreementNumber}`
  }
  return 'ohne Bezugsobjekt'
}

/**
 * Die nächste Dokumentnummer (3.0: „fachliche Nummer, eindeutig"). Gezählt wird
 * über den Bestand, weil der Prototyp keinen Nummernkreis führt.
 */
async function nextDocumentNumber(): Promise<string> {
  const count = await prisma.document.count()
  const year = new Date().getUTCFullYear()
  return `DOK-${year}-${String(count + 1).padStart(4, '0')}`
}

function day(value: Date | null): string | null {
  return value === null ? null : value.toISOString().slice(0, 10)
}

function rejection(outcome: TransitionOutcome<DocumentState>): ActionResult {
  if (outcome.applied) return success('')
  return failure(outcome.rejection.reason, outcome.rejection.specReference)
}
