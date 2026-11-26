/**
 * Fachdienst nächtlicher Lauf und Benachrichtigung — SPEC **5.5.1 c** und
 * **3.14**.
 *
 * Der Lauf lädt die Vorgänge, bei denen **Zeit allein** die Lage ändert, lässt
 * `lib/nightly/befunde.ts` rechnen und schreibt aus jedem Befund je Adressat
 * **eine** Benachrichtigung — und einen Audit-Eintrag, weil 5.5.2 Nr. 1 jedes
 * Ergebnis protokolliert und 2.4 Nr. 4 jede Eskalationsstufe.
 *
 * **Der Lauf ist eine Systemhandlung** (4.0, Regel 10): er vollzieht keinen
 * Übergang, und seine Protokolleinträge tragen ein Systemkennzeichen, auch
 * wenn ihn ein Mensch anstößt. Angestoßen werden darf er nur vom Betreiber —
 * nicht, weil 2.2 dafür eine Zeile hätte, sondern weil er über **alle**
 * Mandanten läuft und nur der Betreiber über die Grenze sieht (2.3).
 *
 * **Er ist wiederholbar.** Je Anlass, Vorgang, Adressat, Stufe und Lauftag
 * entsteht **eine** Benachrichtigung (3.14); ein zweiter Lauf am selben Tag
 * findet dieselben Befunde und legt nichts doppelt an. Das ist keine
 * Bequemlichkeit: ein Verfahren, das Fristen überwacht, muss nach einem
 * Abbruch neu startbar sein.
 */
import { systemlauf } from '../audit/entry'
import { protokolliere, type Transaktion } from '../audit/record'
import { REGELWERK } from '../aueg/regelwerk'
import { ausfallstufe, laufstand, type Ausfallstufe, type Laufstand } from '../nightly/zeitplan'
import { checkPermission } from '../authz/check'
import type { RoleCode } from '../authz/roles'
import type { Rollenkuerzel } from '../aueg/typen'
import type { LoadedIdentity } from '../identity/loadSubject'
import {
  befundLaufAusgefallen,
  befundeAnfrageOhneFreigabe,
  befundeAusschreibungOhneAngebot,
  befundeBelegBeanstandet,
  befundeEinladungOhneKenntnisnahme,
  befundeN1,
  befundeN2,
  befundeN3,
  befundeN5,
  befundeN6,
  befundeProfilOhneRueckmeldung,
  befundeVerlaengerungOhneEntscheidung,
  befundeZettelNichtEingereicht,
  befundeZettelNichtGenehmigt,
  type Befundart,
  type Nachtbefund,
} from '../nightly/befunde'
import { NOTIFICATION_KIND_LABELS } from '../notifications/bezeichnungen'
import { prozessfristTage, type Prozessfristschluessel } from '../process/fristen'
import { prisma } from '../prisma'
import { asFailure, failure, notificationRef, success, type ActionResult } from './common'
import { KUERZEL_JE_ROLLE, ROLLE_JE_KUERZEL, schreibeBenachrichtigung } from './notifications'
import { postausgangAbarbeiten } from './zustellung'

export interface NightlyRunResult {
  readonly runDate: string
  readonly checked: number
  readonly findings: number
  readonly informations: number
  readonly warnings: number
  readonly escalations: number
  readonly notifications: number
  /** Die Befunde in Worten — für die Oberfläche und den Bericht. */
  readonly messages: readonly {
    readonly zeile: string
    readonly art: Befundart
    readonly message: string
  }[]
}

/**
 * Führt den nächtlichen Lauf aus (5.5.1 c).
 *
 * Stichtag ist der Tag des Laufs. Er wird als Parameter genommen und nicht aus
 * der Uhr gelesen: ein Lauf, der sich nicht auf einen Tag festlegen lässt, ist
 * nicht nachrechenbar — und 5.0 verlangt für **jede** Prüfung einen Stichtag,
 * der aus dem Vorgang kommt.
 */
export async function runNightly(
  identity: LoadedIdentity,
  runDate: Date = new Date(),
): Promise<ActionResult> {
  const operatorTenant = await prisma.tenant.findFirst({ where: { tenantType: 'operator' } })
  if (operatorTenant === null) return failure('Kein Betreibermandant vorhanden (3.11).')

  if (!darfLaufenLassen(identity, operatorTenant.id)) {
    return failure(
      'Der nächtliche Lauf prüft Vorgänge über die Mandantengrenze hinweg; ihn anzustoßen ist ' +
        'dem Betreiberadministrator vorbehalten (2.3, 3.14).',
      'SPEC 2.3; 3.14, Fußnote [47]',
    )
  }

  // Auch der Lauf von Hand meldet die Lücke, die er schließt (5.5.1): wer ihn
  // anstößt, soll erfahren, dass er zu spät kommt.
  return laufDurchfuehren(operatorTenant.id, await ladeLaufstand(runDate), runDate, identity.user.id)
}

/**
 * Derselbe Lauf, ausgelöst vom **Planer außerhalb des Systems** (5.5.1,
 * „Wer den Lauf auslöst").
 *
 * Er hat keinen Benutzer, und er bekommt auch keinen: im Protokoll ist der
 * Handelnde ohnehin der Systemlauf (4.0, Regel 10), und ein erfundener
 * Benutzer würde eine Entscheidung vortäuschen, die niemand getroffen hat.
 * Statt der Berechtigungsprüfung steht am Zugang die Frage, ob der Lauf
 * **fällig** ist: ein Planer, der zu früh oder zweimal ruft, soll nichts
 * auslösen.
 */
export async function runNightlyScheduled(jetzt: Date = new Date()): Promise<ActionResult> {
  const operatorTenant = await prisma.tenant.findFirst({ where: { tenantType: 'operator' } })
  if (operatorTenant === null) return failure('Kein Betreibermandant vorhanden (3.11).')

  const stand = await ladeLaufstand(jetzt)
  if (!stand.faellig) {
    return success(
      `Kein Lauf fällig: der Lauf zum Stichtag ${iso(stand.stichtag)} wird erst am ` +
        `${iso(stand.faelligSeit)} fällig (5.5.1).`,
    )
  }
  if (!stand.offen) {
    return success(
      `Kein Lauf fällig: der Stichtag ${iso(stand.stichtag)} ist bereits gelaufen. Der nächste ` +
        `Lauf wird am ${iso(stand.naechsteFaelligkeit)} fällig (5.5.1).`,
    )
  }
  // Gerechnet wird zu **dem** Stand, den die Fälligkeit ergeben hat. Ihn hier
  // noch einmal zu bestimmen hieße, ihn an zwei Stellen zu rechnen.
  return laufDurchfuehren(operatorTenant.id, stand, jetzt, null)
}

/**
 * Der Lauf selbst. Der **Stichtag** kommt aus dem Laufstand und wird hier
 * nicht mehr bestimmt (5.5.1): `runDate` ist nur der Zeitpunkt, zu dem die
 * Nachrichten entstanden sind.
 */
async function laufDurchfuehren(
  operatorTenantId: string,
  stand: Laufstand,
  runDate: Date,
  startedById: string | null,
): Promise<ActionResult> {
  const operatorTenant = { id: operatorTenantId }
  const tag = stand.stichtag
  const lagen = await ladeLagen(operatorTenant.id)
  const befunde: Nachtbefund[] = [
    ...befundeN1(lagen.lieferanten, tag, operatorTenant.id),
    ...befundeN2(lagen.einsaetze, tag),
    ...befundeN3(lagen.einsaetze, tag),
    ...befundeN5(lagen.nachweislagen, tag),
    ...befundeN6(lagen.unterbrechungen, tag),
    ...befundeZettelNichtEingereicht(lagen.zettel, tag),
    ...befundeZettelNichtGenehmigt(lagen.zettel, tag),
    ...befundeBelegBeanstandet(lagen.belege, tag),
    // Die vier Anlässe aus 2.4 mit Arbeitstagfristen (4.0).
    ...befundeAnfrageOhneFreigabe(lagen.anfragen, tag, operatorTenant.id),
    ...befundeAusschreibungOhneAngebot(lagen.einladungen, tag, operatorTenant.id),
    // Achte Prozessfrist aus 4.0 — sie steht nicht in 2.4 und erreicht deshalb
    // nur `LD` und `LA`.
    ...befundeEinladungOhneKenntnisnahme(lagen.einladungen, tag, operatorTenant.id),
    ...befundeProfilOhneRueckmeldung(lagen.vorschlaege, tag, operatorTenant.id),
    ...befundeVerlaengerungOhneEntscheidung(lagen.verlaengerungen, tag, operatorTenant.id),
    // 5.5.1: die Lücke, die dieser Lauf schließt. Sie steht **im** Lauf, weil
    // es den einzigen Zeitpunkt gibt, zu dem das System sie bemerken kann.
    ...befundLaufAusgefallen(stand, operatorTenant.id),
  ]

  let geschrieben = 0
  try {
    await prisma.$transaction(async (tx) => {
      for (const befund of befunde) {
        geschrieben += await schreibeBenachrichtigungen(tx, befund, tag, runDate)
      }
      await tx.nightlyRuleRun.upsert({
        where: { runDate: tag },
        update: {
          startedAt: runDate,
          checked: lagen.geprueft,
          informations: zaehle(befunde, 'information'),
          warnings: zaehle(befunde, 'warning'),
          escalations: zaehle(befunde, 'escalation'),
          notifications: geschrieben,
          startedById,
        },
        create: {
          runDate: tag,
          startedAt: runDate,
          checked: lagen.geprueft,
          informations: zaehle(befunde, 'information'),
          warnings: zaehle(befunde, 'warning'),
          escalations: zaehle(befunde, 'escalation'),
          notifications: geschrieben,
          startedById,
        },
      })
    })
  } catch (error) {
    return asFailure(error, 'Der nächtliche Lauf konnte nicht abgeschlossen werden')
  }

  // Der Lauf stellt zu, was er erzeugt hat (3.14). Er tut es **nach** der
  // Transaktion: ein Netzaufruf darf keine Datenbanksperre halten, und eine
  // gesendete E-Mail holt kein Rollback zurück. Ohne konfigurierten Mailweg
  // bleiben die Aufträge offen — gemeldet wird das trotzdem, damit „nichts
  // zugestellt" nicht wie „alles zugestellt" aussieht.
  const ausgang = await postausgangAbarbeiten({ jetzt: runDate })
  const zustellung =
    ausgang.grund === ''
      ? ` Zustellung: ${ausgang.zugestellt} zugestellt, ${ausgang.unterblieben} unterblieben, ` +
        `${ausgang.gescheitert} gescheitert, ${ausgang.offen} weiter offen.`
      : ` Zustellung: nichts versandt — ${ausgang.grund} ${ausgang.offen} Auftrag/Aufträge offen.`

  return success(
    `Nächtlicher Lauf zum ${tag.toISOString().slice(0, 10)}: ${lagen.geprueft} Vorgänge geprüft, ` +
      `${befunde.length} Befund(e) — ${zaehle(befunde, 'information')} Information, ` +
      `${zaehle(befunde, 'warning')} Warnung, ${zaehle(befunde, 'escalation')} mit Eskalation. ` +
      `${geschrieben} Benachrichtigung(en) erzeugt (5.5.1, 3.14). Der Lauf erzeugt **keinen** ` +
      'Statuswechsel und keine Sperre.' +
      zustellung,
  )
}

/**
 * Darf diese Identität den Lauf anstoßen?
 *
 * Der Lauf sieht über **alle** Mandanten. Das darf nach 2.3 nur der Betreiber,
 * und innerhalb des Betreibers nur, wer das Aufkommen des Betriebs sieht.
 *
 * Gefragt wird das über einen Vorgang **ohne Adressaten** — und genau darin
 * liegt die Prüfung: Fußnote [47] verlangt, dass die Nachricht an die eigene
 * Rollenzuweisung gerichtet ist, und eine Nachricht ohne Adressaten ist das
 * für niemanden. Wessen Zelle die Fußnote trägt, fällt hier heraus; `MA`
 * trägt sie nicht und kommt durch. Wer nur die eigenen Nachrichten sieht, kann
 * keinen Lauf verantworten, der fremde erzeugt.
 */
function darfLaufenLassen(identity: LoadedIdentity, operatorTenantId: string): boolean {
  return checkPermission(identity.subject, 'read', {
    type: 'notification',
    tenantId: operatorTenantId,
    tenantType: 'operator',
  }).allowed
}

/** Dieselbe Frage für die Oberfläche — sie soll keinen Knopf anbieten, der nie trägt. */
export async function mayRunNightly(identity: LoadedIdentity): Promise<boolean> {
  const operatorTenant = await prisma.tenant.findFirst({ where: { tenantType: 'operator' } })
  return operatorTenant === null ? false : darfLaufenLassen(identity, operatorTenant.id)
}

function zaehle(befunde: readonly Nachtbefund[], art: Befundart): number {
  return befunde.filter((befund) => befund.art === art).length
}

/**
 * Schreibt je Adressat eine Benachrichtigung und **einen** Audit-Eintrag je
 * Befund.
 *
 * Die Stufe ist die Stellung des Adressaten in der kumulativen Liste aus 5.4.4
 * und 5.1.6: `LA` ist Stufe 1, `LD` Stufe 2, `MD` Stufe 3 — genau die
 * Stufenfolge, die 2.4 für diesen Anlass nennt. Sie wird damit **abgelesen**
 * und nicht gezählt.
 */
async function schreibeBenachrichtigungen(
  tx: Transaktion,
  befund: Nachtbefund,
  tag: Date,
  raisedAt: Date,
): Promise<number> {
  let geschrieben = 0
  for (const [index, kuerzel] of befund.adressaten.entries()) {
    const roleCode = ROLLE_JE_KUERZEL[kuerzel as Rollenkuerzel]
    const recipientTenantId = befund.mandantJeRolle[kuerzel as Rollenkuerzel]
    // Eine Rolle ohne Mandanten im Vorgang ist nicht adressierbar: eine
    // Benachrichtigung an „KE" zu einem Vorgang ohne Kunden hätte keinen
    // Empfänger. Sie entfällt, statt an irgendwen zu gehen (2.3).
    if (roleCode === null || recipientTenantId === undefined) continue

    const vorhanden = await tx.notification.findFirst({
      where: {
        trigger: befund.anlass,
        objectRef: befund.objectRef,
        recipientRoleCode: roleCode,
        recipientTenantId,
        escalationLevel: index + 1,
        runDate: tag,
      },
      select: { id: true },
    })
    if (vorhanden !== null) continue

    await schreibeBenachrichtigung(tx, {
      tenantId: befund.tenantId,
      trigger: befund.anlass,
      kind: befund.art,
      objectType: befund.objectType,
      objectRef: befund.objectRef,
      recipientRoleCode: roleCode,
      recipientTenantId,
      escalationLevel: index + 1,
      ruleRef: befund.pruefung,
      message: befund.meldung,
      raisedAt,
      runDate: tag,
    })
    geschrieben += 1
  }

  if (geschrieben > 0) {
    // 5.5.2 Nr. 1: jedes Ergebnis wird protokolliert — auch eine Information.
    //
    // Der Eintrag wird **als Systemlauf gebaut** und nicht über einen Benutzer
    // ohne Entscheidung: den Lauf löst kein Benutzer aus, auch wenn ein Mensch
    // ihn anstößt (4.0, Regel 10). So steht die Systemhandlung im Aufbau des
    // Eintrags und nicht in einem Kennzeichen, das jemand mit einer Benutzer-
    // kennung überschreiben könnte.
    await protokolliere(tx, {
      occurredAt: raisedAt,
      actor: systemlauf(),
      tenantId: befund.tenantId,
      objectType: 'notification',
      objectRef: befund.objectRef,
      operation: 'create',
      result: 'success',
      reason: `${befund.zeile}: ${befund.meldung}`,
      ruleRef: befund.pruefung,
      crossTenant: false,
    })
  }
  return geschrieben
}

/** Ein Zeitpunkt in Worten — Tag für einen Stichtag, Minute für eine Uhrzeit. */
function iso(wert: Date): string {
  return wert.getUTCHours() === 0 && wert.getUTCMinutes() === 0
    ? wert.toISOString().slice(0, 10)
    : wert.toISOString().slice(0, 16).replace('T', ' ') + ' UTC'
}

/**
 * Der Stand des Laufs für die Oberfläche und für den Planer (5.5.1).
 *
 * Der jüngste verzeichnete Lauf ist die einzige Auskunft darüber, seit wann
 * geprüft wird; ohne ihn lässt sich keine Lücke benennen.
 */
export async function ladeLaufstand(jetzt: Date = new Date()): Promise<Laufstand> {
  const letzter = await prisma.nightlyRuleRun.findFirst({ orderBy: { runDate: 'desc' } })
  return laufstand({
    jetzt,
    letzterStichtag: letzter?.runDate ?? null,
    zeitplan: REGELWERK.lauf,
  })
}

/**
 * Die Stufe des Ausfalls zu einem Stand (5.5.1) — dieselbe Rechnung, die den
 * Befund im Lauf erzeugt. Sie steht hier mit, damit eine Überwachung
 * **außerhalb** des Systems die Schwelle nicht nachbauen muss: sie bekommt
 * das Urteil, nicht nur die Zahl.
 */
export function laufAusfallstufe(stand: Laufstand): Ausfallstufe {
  return ausfallstufe(stand.ausgefalleneTage, REGELWERK.lauf)
}

/* ------------------------------------------------------------------ */
/* Laden                                                               */
/* ------------------------------------------------------------------ */

async function ladeLagen(operatorTenantId: string) {
  const lieferanten = await prisma.supplier.findMany({
    where: { status: { in: ['onboarding', 'active', 'blocked'] } },
    include: { permits: true, documents: true },
  })
  const einsaetze = await prisma.assignment.findMany({
    where: { status: { in: ['planned', 'active', 'interrupted'] } },
    include: {
      customer: { select: { tenantId: true } },
      supplier: { select: { tenantId: true } },
      site: { select: { safetyBriefingRequired: true } },
      candidate: { select: { workPermitRequired: true } },
      documents: true,
      interruptions: { where: { interruptionTo: null } },
    },
  })
  const zettel = await prisma.timesheet.findMany({
    where: { status: { in: ['recorded', 'rejected', 'submitted', 'inApproval'] } },
    include: {
      billingPeriod: true,
      approvals: { where: { decision: null }, orderBy: { level: 'asc' } },
      assignment: {
        include: {
          customer: { select: { tenantId: true, processDeadlineConfig: true } },
          supplier: { select: { tenantId: true } },
        },
      },
    },
  })
  const belege = await prisma.billingDocument.findMany({
    where: { status: 'disputed' },
    include: {
      customer: { select: { tenantId: true, processDeadlineConfig: true } },
      supplier: { select: { tenantId: true } },
    },
  })
  // Die vier Fristanlässe aus 2.4 mit Arbeitstagfristen (4.0). Jede Abfrage
  // liest das **Bundesland des Standorts** mit: es bestimmt die Feiertage und
  // damit die Frist (4.0).
  const anfragen = await prisma.demandRequest.findMany({
    where: { status: 'submitted' },
    include: {
      customer: { select: { tenantId: true, processDeadlineConfig: true } },
      site: { select: { federalState: true } },
    },
  })
  const einladungen = await prisma.tenderInvitation.findMany({
    where: { tender: { closedAt: null } },
    include: {
      supplier: { select: { tenantId: true, legalName: true } },
      offer: { select: { id: true } },
      tender: {
        select: {
          tenderNumber: true,
          offerDeadline: true,
          closedAt: true,
          demandRequest: {
            select: {
              customer: { select: { tenantId: true, processDeadlineConfig: true } },
              site: { select: { federalState: true } },
            },
          },
        },
      },
    },
  })
  const vorschlaege = await prisma.candidateSubmission.findMany({
    where: { status: 'releasedToCustomer' },
    include: {
      demandRequest: {
        select: {
          customer: { select: { tenantId: true, processDeadlineConfig: true } },
          site: { select: { federalState: true } },
        },
      },
    },
  })
  const verlaengerungen = await prisma.assignmentExtension.findMany({
    where: { status: 'requested' },
    include: {
      assignment: {
        select: {
          assignmentNumber: true,
          tenantId: true,
          plannedEndDate: true,
          customer: { select: { tenantId: true, processDeadlineConfig: true } },
          site: { select: { federalState: true } },
        },
      },
    },
  })

  return {
    geprueft:
      lieferanten.length +
      einsaetze.length +
      zettel.length +
      belege.length +
      anfragen.length +
      einladungen.length +
      vorschlaege.length +
      verlaengerungen.length,
    lieferanten: lieferanten.map((lieferant) => ({
      id: lieferant.id,
      legalName: lieferant.legalName,
      tenantId: lieferant.tenantId,
      status: lieferant.status,
      erlaubnisse: lieferant.permits.map((erlaubnis) => ({
        id: erlaubnis.id,
        permitNumber: erlaubnis.permitNumber,
        permitType: erlaubnis.permitType,
        validFrom: erlaubnis.validFrom,
        validTo: erlaubnis.validTo,
        verificationStatus: erlaubnis.verificationStatus,
        certificateDocumentRef: erlaubnis.certificateDocumentRef,
        supersedesId: erlaubnis.supersedesId,
      })),
      urkunden: lieferant.documents.map(alsZeile),
    })),
    einsaetze: einsaetze.map((einsatz) => ({
      id: einsatz.id,
      assignmentNumber: einsatz.assignmentNumber,
      tenantId: einsatz.tenantId,
      status: einsatz.status,
      customerTenantId: einsatz.customer.tenantId,
      supplierTenantId: einsatz.supplier.tenantId,
      maxDurationEndDate: einsatz.maxDurationEndDate,
      equalPayDueDate: einsatz.equalPayDueDate,
      comparableWage: einsatz.comparableWage === null ? null : Number(einsatz.comparableWage),
    })),
    // N5 prüft Nachweise, „deren Bezugsobjekt aktiv ist": die Einsätze oben
    // sind es, und ihre Nachweise sind die einsatzbezogenen (3.10).
    nachweislagen: einsaetze.map((einsatz) => ({
      objectType: 'assignment',
      objectRef: einsatz.id,
      tenantId: einsatz.tenantId,
      mandanten: {
        operator: operatorTenantId,
        customer: einsatz.customer.tenantId,
        supplier: einsatz.supplier.tenantId,
      },
      nachweise: einsatz.documents.map(alsZeile),
      arbeitserlaubnisErforderlich: einsatz.candidate.workPermitRequired,
      unterweisungVerlangt: einsatz.site.safetyBriefingRequired,
    })),
    unterbrechungen: einsaetze.flatMap((einsatz) =>
      einsatz.interruptions.map((unterbrechung) => ({
        assignmentId: einsatz.id,
        assignmentNumber: einsatz.assignmentNumber,
        tenantId: einsatz.tenantId,
        customerTenantId: einsatz.customer.tenantId,
        supplierTenantId: einsatz.supplier.tenantId,
        interruptionFrom: unterbrechung.interruptionFrom,
        interruptionTo: unterbrechung.interruptionTo,
      })),
    ),
    zettel: zettel.map((zeile) => ({
      id: zeile.id,
      timesheetNumber: zeile.timesheetNumber,
      tenantId: zeile.tenantId,
      customerTenantId: zeile.assignment.customer.tenantId,
      supplierTenantId: zeile.assignment.supplier.tenantId,
      status: zeile.status,
      periodTo: zeile.periodTo,
      closingDate: zeile.billingPeriod.closingDate,
      openStageRole: alsKuerzel(zeile.approvals[0]?.assignedRoleCode ?? null),
      submissionDeadlineDays: frist(zeile, 'timesheetSubmissionDeadlineDays'),
      submissionEscalationStepDays: frist(zeile, 'timesheetSubmissionEscalationStepDays'),
      approvalEscalationStepDays: frist(zeile, 'timesheetApprovalEscalationStepDays'),
    })),
    belege: belege.map((beleg) => ({
      id: beleg.id,
      documentNumber: beleg.documentNumber,
      tenantId: beleg.tenantId,
      customerTenantId: beleg.customer?.tenantId ?? null,
      supplierTenantId: beleg.supplier?.tenantId ?? null,
      status: beleg.status,
      disputedAt: beleg.disputedAt,
      disputeResolutionNote: beleg.disputeResolutionNote,
      disputeEscalationStepDays: prozessfristTage(
        beleg.customer?.processDeadlineConfig,
        'billingDisputeEscalationStepDays',
      ),
    })),
    anfragen: anfragen.map((anfrage) => ({
      id: anfrage.id,
      requestNumber: anfrage.requestNumber,
      tenantId: anfrage.tenantId,
      customerTenantId: anfrage.customer.tenantId,
      status: anfrage.status,
      submittedAt: anfrage.submittedAt,
      land: anfrage.site.federalState,
      fristArbeitstage: prozessfristTage(
        anfrage.customer.processDeadlineConfig,
        'demandApprovalDeadlineDays',
      ),
      stufenabstandArbeitstage: prozessfristTage(
        anfrage.customer.processDeadlineConfig,
        'demandApprovalEscalationStepDays',
      ),
    })),
    einladungen: einladungen.map((einladung) => ({
      id: einladung.id,
      tenderNumber: einladung.tender.tenderNumber,
      supplierName: einladung.supplier.legalName,
      tenantId: einladung.tenantId,
      supplierTenantId: einladung.supplier.tenantId,
      customerTenantId: einladung.tender.demandRequest.customer.tenantId,
      invitationStatus: einladung.invitationStatus,
      offerDeadline: einladung.tender.offerDeadline,
      hatAngebot: einladung.offer !== null,
      ausschreibungOffen: einladung.tender.closedAt === null,
      invitedAt: einladung.invitedAt,
      kenntnisFristArbeitstage: prozessfristTage(
        einladung.tender.demandRequest.customer.processDeadlineConfig,
        'invitationViewDeadlineDays',
      ),
      kenntnisStufenabstandArbeitstage: prozessfristTage(
        einladung.tender.demandRequest.customer.processDeadlineConfig,
        'invitationViewEscalationStepDays',
      ),
      land: einladung.tender.demandRequest.site.federalState,
      stufenabstandArbeitstage: prozessfristTage(
        einladung.tender.demandRequest.customer.processDeadlineConfig,
        'offerDeadlineEscalationStepDays',
      ),
    })),
    vorschlaege: vorschlaege.map((vorschlag) => ({
      id: vorschlag.id,
      submissionNumber: vorschlag.submissionNumber,
      tenantId: vorschlag.tenantId,
      customerTenantId: vorschlag.demandRequest.customer.tenantId,
      status: vorschlag.status,
      releasedToCustomerAt: vorschlag.releasedToCustomerAt,
      land: vorschlag.demandRequest.site.federalState,
      fristArbeitstage: prozessfristTage(
        vorschlag.demandRequest.customer.processDeadlineConfig,
        'submissionFeedbackDeadlineDays',
      ),
      stufenabstandArbeitstage: prozessfristTage(
        vorschlag.demandRequest.customer.processDeadlineConfig,
        'submissionFeedbackEscalationStepDays',
      ),
    })),
    verlaengerungen: verlaengerungen.map((verlaengerung) => ({
      id: verlaengerung.id,
      assignmentNumber: verlaengerung.assignment.assignmentNumber,
      // Die Verlängerung trägt keinen eigenen Mandanten (3.7): maßgeblich ist
      // der des Einsatzes, zu dem sie gehört.
      tenantId: verlaengerung.assignment.tenantId,
      customerTenantId: verlaengerung.assignment.customer.tenantId,
      status: verlaengerung.status,
      requestedAt: verlaengerung.requestedAt,
      plannedEndDate: verlaengerung.assignment.plannedEndDate,
      land: verlaengerung.assignment.site.federalState,
      fristArbeitstage: prozessfristTage(
        verlaengerung.assignment.customer.processDeadlineConfig,
        'extensionApprovalDeadlineDays',
      ),
      spaetestensTageVorEnde: prozessfristTage(
        verlaengerung.assignment.customer.processDeadlineConfig,
        'extensionApprovalLatestDaysBeforeEnd',
      ),
      stufenabstandArbeitstage: prozessfristTage(
        verlaengerung.assignment.customer.processDeadlineConfig,
        'extensionApprovalEscalationStepDays',
      ),
    })),
  }
}

function alsZeile(dokument: {
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
}) {
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
 * Ein Fristwert dieses Kunden (4.0, 2.4 Regel 5) — Vorbelegung, wo er keinen
 * führt. Die Zeile nimmt den Zettel, weil der Kunde am Einsatz hängt.
 */
function frist(
  zeile: {
    readonly assignment: { readonly customer: { readonly processDeadlineConfig: unknown } }
  },
  schluessel: Prozessfristschluessel,
): number {
  return prozessfristTage(zeile.assignment.customer.processDeadlineConfig, schluessel)
}

function alsKuerzel(roleCode: RoleCode | null): Rollenkuerzel | null {
  return roleCode === null ? null : (KUERZEL_JE_ROLLE[roleCode] ?? null)
}

/* ------------------------------------------------------------------ */
/* Lesen (3.14, Fußnote [47])                                          */
/* ------------------------------------------------------------------ */

export interface NotificationView {
  readonly id: string
  readonly trigger: string
  readonly kind: Befundart
  readonly kindLabel: string
  readonly objectType: string
  readonly objectRef: string
  /** Statuswechsel bei `trigger = statusTransition` (3.14). */
  readonly statusFrom: string | null
  readonly statusTo: string | null
  readonly recipientRoleCode: RoleCode
  readonly escalationLevel: number
  readonly ruleRef: string | null
  readonly message: string
  readonly raisedAt: string
  readonly runDate: string | null
  readonly crossTenant: boolean
}

export { NOTIFICATION_KIND_LABELS, NOTIFICATION_TRIGGER_LABELS } from '../notifications/bezeichnungen'

/**
 * Die Benachrichtigungen, die diese Identität lesen darf ([47]).
 *
 * Geladen werden alle und danach einzeln geprüft — dieselbe Begründung wie bei
 * Nachweisen, Zetteln und Belegen: die Grenze hängt an Rolle **und** Mandant,
 * und das steht in der Prüffunktion, nicht in einer `where`-Klausel.
 */
export async function loadNotifications(
  identity: LoadedIdentity,
  limit = 200,
): Promise<readonly NotificationView[]> {
  const rows = await prisma.notification.findMany({
    include: { tenant: { select: { tenantType: true } } },
    orderBy: { raisedAt: 'desc' },
    take: limit,
  })
  const views: NotificationView[] = []
  for (const row of rows) {
    const decision = checkPermission(
      identity.subject,
      'read',
      notificationRef({
        tenantId: row.tenantId,
        tenantType: row.tenant.tenantType,
        recipientRoleCode: row.recipientRoleCode,
        recipientTenantId: row.recipientTenantId,
      }),
    )
    if (!decision.allowed) continue
    views.push({
      id: row.id,
      trigger: row.trigger,
      kind: row.kind,
      kindLabel: NOTIFICATION_KIND_LABELS[row.kind],
      objectType: row.objectType,
      objectRef: row.objectRef,
      statusFrom: row.statusFrom,
      statusTo: row.statusTo,
      recipientRoleCode: row.recipientRoleCode,
      escalationLevel: row.escalationLevel,
      ruleRef: row.ruleRef,
      message: row.message,
      raisedAt: row.raisedAt.toISOString().slice(0, 16).replace('T', ' '),
      runDate: row.runDate === null ? null : row.runDate.toISOString().slice(0, 10),
      crossTenant: decision.crossTenant,
    })
  }
  return views
}

export interface NightlyRunView {
  readonly runDate: string
  readonly startedAt: string
  readonly checked: number
  readonly informations: number
  readonly warnings: number
  readonly escalations: number
  readonly notifications: number
}

/** Die letzten Läufe — der Nachweis, dass geprüft wurde (5.4.7, 5.5.1). */
export async function loadNightlyRuns(
  identity: LoadedIdentity,
  limit = 14,
): Promise<readonly NightlyRunView[]> {
  const operatorTenant = await prisma.tenant.findFirst({ where: { tenantType: 'operator' } })
  if (operatorTenant === null) return []
  if (!darfLaufenLassen(identity, operatorTenant.id)) return []
  const rows = await prisma.nightlyRuleRun.findMany({
    orderBy: { runDate: 'desc' },
    take: limit,
  })
  return rows.map((row) => ({
    runDate: row.runDate.toISOString().slice(0, 10),
    startedAt: row.startedAt.toISOString().slice(0, 16).replace('T', ' '),
    checked: row.checked,
    informations: row.informations,
    warnings: row.warnings,
    escalations: row.escalations,
    notifications: row.notifications,
  }))
}
