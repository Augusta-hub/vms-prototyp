/**
 * Synthetische Demo-Daten — SPEC 3.1 bis 3.7 und 3.11.
 *
 * Alle Organisationen und Personen sind **erfunden** (CLAUDE.md, Regel 3).
 * Die Firmennamen sind dieselben wie in den Szenarien in tests/aueg/, damit
 * Spezifikation und Demo dieselbe Welt beschreiben. E-Mail-Adressen liegen in
 * der reservierten Domain `.example` und gehen nirgendwohin.
 *
 * Es gibt **keine** Anmeldedaten: kein Passwort, kein Hash, kein Token
 * (SPEC 3.0, Festlegung 4). Die handelnde Person wird im Prototyp über die
 * Testidentität umgeschaltet (lib/identity/testIdentity.ts).
 *
 * Bestand: ein Betreiber, zwei Kunden mit Standorten und Kostenstellen, zwei
 * Lieferanten mit anerkannter, gültiger AÜG-Erlaubnis, Rahmenverträge und
 * Preislisten **beider** Seiten, Tarifzuordnungen, Vergleichsentgelte, je eine
 * Bedarfsanfrage pro Zustand aus 4.1, Kandidaten bei **beiden** Lieferanten mit
 * Personenidentitäten (3.6), je ein Profilvorschlag pro Zustand aus 4.2.3, je
 * ein Einsatz pro Zustand aus 4.3.1 — einer mit laufender Unterbrechung — und
 * je eine Verlängerung pro Zustand aus 4.3.2.
 *
 * **Zu den Zuständen:** Der Seed legt **Daten** in genau dem Zustand an, den
 * Kapitel 4 beschreibt. Er ist kein Weg um Kapitel 4 herum: die Statusmodelle
 * in lib/status/ bleiben die einzige Stelle, an der ein Zustand **wechselt**.
 * Mit 3.6 und 3.7 liegen unter `inSelection` und `filled` jetzt die Objekte,
 * die 4.1 dafür verlangt — vorgelegte Profilvorschläge und ein Einsatz.
 */
import { PrismaClient, type RoleCode, type TenantType } from '@prisma/client'
import { equalPaystand, hoechstdauerstand } from '../lib/aueg/anbindung'
import {
  assertOrganizationRefPresent,
  assertSingleOperatorTenant,
} from '../lib/tenants/invariants'

const prisma = new PrismaClient()

/** Stichtag der Demo-Daten: fest, damit Zeiträume reproduzierbar bleiben. */
const SEED_DATE = new Date('2026-01-01T00:00:00.000Z')
const day = (iso: string): Date => new Date(`${iso}T00:00:00.000Z`)
const frueherer = (a: Date, b: Date): Date => (a <= b ? a : b)
const hour = (iso: string): Date => new Date(`${iso}:00.000Z`)

interface TenantSeed {
  readonly key: string
  readonly tenantNumber: string
  readonly tenantType: TenantType
  readonly displayName: string
}

const TENANTS: readonly TenantSeed[] = [
  {
    key: 'operator',
    tenantNumber: 'M-0001',
    tenantType: 'operator',
    displayName: 'Rheinmain Personalsteuerung GmbH',
  },
  { key: 'customer1', tenantNumber: 'M-1001', tenantType: 'customer', displayName: 'Nordwerk Metall GmbH' },
  { key: 'customer2', tenantNumber: 'M-1002', tenantType: 'customer', displayName: 'Südharz Logistik GmbH' },
  { key: 'supplier1', tenantNumber: 'M-2001', tenantType: 'supplier', displayName: 'Rheinpersonal GmbH' },
  { key: 'supplier2', tenantNumber: 'M-2002', tenantType: 'supplier', displayName: 'Elbe Zeitarbeit GmbH' },
]

interface UserSeed {
  readonly key: string
  readonly tenantKey: string
  readonly userNumber: string
  readonly givenName: string
  readonly familyName: string
  readonly loginIdentifier: string
  readonly roleCode: RoleCode
}

const USERS: readonly UserSeed[] = [
  {
    key: 'operatorAdmin',
    tenantKey: 'operator',
    userNumber: 'B-0001',
    givenName: 'Anke',
    familyName: 'Reimers',
    loginIdentifier: 'anke.reimers@rheinmain-personalsteuerung.example',
    roleCode: 'operatorAdmin',
  },
  {
    key: 'operatorCoordinator',
    tenantKey: 'operator',
    userNumber: 'B-0002',
    givenName: 'Holger',
    familyName: 'Pietsch',
    loginIdentifier: 'holger.pietsch@rheinmain-personalsteuerung.example',
    roleCode: 'operatorCoordinator',
  },
  {
    // Zweiter Disponent, bewusst auf **einen** Kunden eingeschränkt — damit die
    // Betreuungszuordnung aus 2.3 am Seed als Einschränkung sichtbar bleibt.
    key: 'operatorCoordinatorLimited',
    tenantKey: 'operator',
    userNumber: 'B-0003',
    givenName: 'Mirjam',
    familyName: 'Kaluza',
    loginIdentifier: 'mirjam.kaluza@rheinmain-personalsteuerung.example',
    roleCode: 'operatorCoordinator',
  },
  {
    key: 'demandOwner1',
    tenantKey: 'customer1',
    userNumber: 'B-1001',
    givenName: 'Sonja',
    familyName: 'Hellwig',
    loginIdentifier: 'sonja.hellwig@nordwerk-metall.example',
    roleCode: 'demandOwner',
  },
  {
    key: 'approver1',
    tenantKey: 'customer1',
    userNumber: 'B-1002',
    givenName: 'Detlef',
    familyName: 'Wiegand',
    loginIdentifier: 'detlef.wiegand@nordwerk-metall.example',
    roleCode: 'approver',
  },
  {
    key: 'procurementController1',
    tenantKey: 'customer1',
    userNumber: 'B-1004',
    givenName: 'Birte',
    familyName: 'Ahlgrim',
    loginIdentifier: 'birte.ahlgrim@nordwerk-metall.example',
    roleCode: 'procurementController',
  },
  {
    key: 'procurementController2',
    tenantKey: 'customer2',
    userNumber: 'B-1003',
    givenName: 'Carola',
    familyName: 'Steinbach',
    loginIdentifier: 'carola.steinbach@suedharz-logistik.example',
    roleCode: 'procurementController',
  },
  {
    key: 'demandOwner2',
    tenantKey: 'customer2',
    userNumber: 'B-1005',
    givenName: 'Ruben',
    familyName: 'Kastner',
    loginIdentifier: 'ruben.kastner@suedharz-logistik.example',
    roleCode: 'demandOwner',
  },
  {
    key: 'approver2',
    tenantKey: 'customer2',
    userNumber: 'B-1006',
    givenName: 'Elke',
    familyName: 'Vogtland',
    loginIdentifier: 'elke.vogtland@suedharz-logistik.example',
    roleCode: 'approver',
  },
  {
    key: 'supplierCoordinator1',
    tenantKey: 'supplier1',
    userNumber: 'B-2001',
    givenName: 'Nils',
    familyName: 'Brandner',
    loginIdentifier: 'nils.brandner@rheinpersonal.example',
    roleCode: 'supplierCoordinator',
  },
  {
    key: 'temporaryWorker',
    tenantKey: 'supplier1',
    userNumber: 'B-2002',
    givenName: 'Jana',
    familyName: 'Behrens',
    loginIdentifier: 'jana.behrens@rheinpersonal.example',
    roleCode: 'temporaryWorker',
  },
  {
    key: 'supplierAdmin1',
    tenantKey: 'supplier1',
    userNumber: 'B-2004',
    givenName: 'Gerda',
    familyName: 'Oswald',
    loginIdentifier: 'gerda.oswald@rheinpersonal.example',
    roleCode: 'supplierAdmin',
  },
  {
    key: 'supplierAdmin2',
    tenantKey: 'supplier2',
    userNumber: 'B-2003',
    givenName: 'Pia',
    familyName: 'Lohmann',
    loginIdentifier: 'pia.lohmann@elbe-zeitarbeit.example',
    roleCode: 'supplierAdmin',
  },
  {
    key: 'supplierCoordinator2',
    tenantKey: 'supplier2',
    userNumber: 'B-2005',
    givenName: 'Timo',
    familyName: 'Harnisch',
    loginIdentifier: 'timo.harnisch@elbe-zeitarbeit.example',
    roleCode: 'supplierCoordinator',
  },
]

async function main(): Promise<void> {
  assertSingleOperatorTenant(
    TENANTS.map((tenant) => ({ id: tenant.key, tenantType: tenant.tenantType })),
  )

  // Leeren in umgekehrter Abhängigkeitsreihenfolge, damit der Seed
  // wiederholbar bleibt. Nur Entwicklungsdaten, nie Echtdaten (CLAUDE.md).
  // 3.6 und 3.7 zuerst: Einsatz, Verlängerung und Unterbrechung hängen an
  // Kandidat, Profilvorschlag und Personenidentität. Noch davor die Nachweise
  // (3.10): sie verweisen auf fast jedes andere Objekt und auf den Benutzer,
  // der sie eingestellt hat.
  // Das **Protokoll** zuerst, und nicht mit `deleteMany`: Audit-Einträge sind
  // nach 3.12 unveränderlich, und ein Trigger aus der Migration verweigert
  // `UPDATE` und `DELETE` auf der Tabelle. Das trifft auch den Seed, und zwar
  // zu Recht — er löscht Benutzer, und der Fremdschlüssel würde die Einträge
  // dieser Benutzer stillschweigend auf `NULL` setzen. `TRUNCATE` ist der
  // Verwaltungsweg, keine Anwendungsoperation: es löst die Zeilentrigger nicht
  // aus. Der Zähler wird mit zurückgesetzt, damit die Nummernfolge einer
  // frischen Entwicklungsdatenbank wieder bei 1 beginnt (3.12).
  await prisma.$executeRawUnsafe('TRUNCATE TABLE "AuditEntry", "AuditSequence"')
  await prisma.$executeRawUnsafe(
    'INSERT INTO "AuditSequence" ("id", "lastEntryNumber") VALUES (1, 0) ON CONFLICT ("id") DO NOTHING',
  )
  // 3.14 ganz zuerst: eine Benachrichtigung verweist auf einen Mandanten und
  // auf einen Vorgang, aber nichts verweist auf sie.
  await prisma.notification.deleteMany()
  await prisma.nightlyRuleRun.deleteMany()
  // 3.8 und 3.9 danach: der Zuschlag hängt an der Zeitposition, diese am
  // Zettel, der Zettel an Einsatz und Periode — und der **Beleg** am Zettel,
  // deshalb geht er allen voraus.
  await prisma.billingDocumentItem.deleteMany()
  // Der Storno verweist auf den stornierten Beleg (3.9); die Kante wird vor dem
  // Löschen gelöst, wie bei Kandidat und Personenidentität.
  await prisma.billingDocument.updateMany({ data: { cancellationOfId: null } })
  await prisma.billingDocument.deleteMany()
  await prisma.timeEntryPremium.deleteMany()
  await prisma.timeEntry.deleteMany()
  await prisma.timesheetApproval.deleteMany()
  await prisma.timesheet.deleteMany()
  await prisma.billingPeriod.deleteMany()
  await prisma.premiumType.deleteMany()
  await prisma.customerTimesheetApprovalStage.deleteMany()
  await prisma.document.deleteMany()
  await prisma.assignmentExtension.deleteMany()
  await prisma.assignmentInterruption.deleteMany()
  await prisma.assignment.deleteMany()
  await prisma.workerIdentityMergeEntry.deleteMany()
  await prisma.workerIdentityLink.deleteMany()
  await prisma.candidate.updateMany({ data: { workerIdentityId: null } })
  await prisma.workerIdentity.deleteMany()
  await prisma.candidateSubmission.deleteMany()
  await prisma.candidateQualification.deleteMany()
  await prisma.candidate.deleteMany()
  await prisma.supplierOfferItem.deleteMany()
  await prisma.supplierOffer.deleteMany()
  await prisma.tenderInvitation.deleteMany()
  await prisma.tender.deleteMany()
  await prisma.demandRequestQualification.deleteMany()
  await prisma.demandRequest.deleteMany()
  await prisma.comparableWageEntry.deleteMany()
  await prisma.rateCardItem.deleteMany()
  await prisma.rateCard.deleteMany()
  await prisma.masterAgreement.deleteMany()
  await prisma.supplierPermit.deleteMany()
  await prisma.contactPerson.deleteMany()
  await prisma.costCenter.deleteMany()
  // Tarifzuordnungen hängen an Kunde, Standort und Lieferant; die Gegenrichtung
  // (Tarifbindung) wird vorher gelöst.
  await prisma.customer.updateMany({ data: { customerCollectiveAgreementId: null } })
  await prisma.supplier.updateMany({ data: { supplierCollectiveAgreementId: null } })
  await prisma.site.updateMany({ data: { collectiveAgreementAssignmentId: null } })
  await prisma.collectiveAgreementAssignment.deleteMany()
  await prisma.site.deleteMany()
  await prisma.customer.deleteMany()
  await prisma.supplier.deleteMany()
  await prisma.delegation.deleteMany()
  await prisma.accountAssignment.deleteMany()
  await prisma.responsibilityScope.deleteMany()
  await prisma.roleAssignment.deleteMany()
  await prisma.user.deleteMany()
  await prisma.tenant.deleteMany()

  // ── Mandanten und Benutzer (3.11) ────────────────────────────────────────
  const tenantIds = new Map<string, string>()
  for (const tenant of TENANTS) {
    const created = await prisma.tenant.create({
      data: {
        tenantNumber: tenant.tenantNumber,
        tenantType: tenant.tenantType,
        displayName: tenant.displayName,
        createdAt: SEED_DATE,
      },
    })
    tenantIds.set(tenant.key, created.id)
  }
  const tenantId = (key: string): string => {
    const id = tenantIds.get(key)
    if (id === undefined) throw new Error(`Unbekannter Mandant: ${key}`)
    return id
  }

  // Der erste Benutzer entsteht mit der Einrichtung des Systems und hat
  // deshalb keinen anlegenden Benutzer (`createdById` bleibt leer).
  const userIds = new Map<string, string>()
  for (const user of USERS) {
    const created = await prisma.user.create({
      data: {
        userNumber: user.userNumber,
        tenantId: tenantId(user.tenantKey),
        loginIdentifier: user.loginIdentifier,
        givenName: user.givenName,
        familyName: user.familyName,
        language: 'de',
        createdAt: SEED_DATE,
      },
    })
    userIds.set(user.key, created.id)
  }
  const userId = (key: string): string => {
    const id = userIds.get(key)
    if (id === undefined) throw new Error(`Unbekannter Benutzer: ${key}`)
    return id
  }
  const operatorAdminId = userId('operatorAdmin')

  // Rollenzuweisungen. Vergeben vom Betreiberadministrator; für die
  // Lieferantenorganisation wäre es nach Fußnote [7] der LA — im Seed bleibt
  // es der MA, weil die Einrichtung vom Betreiber ausgeht.
  const roleAssignmentIds = new Map<string, string>()
  for (const user of USERS) {
    const assignment = await prisma.roleAssignment.create({
      data: {
        userId: userId(user.key),
        roleCode: user.roleCode,
        tenantId: tenantId(user.tenantKey),
        validFrom: SEED_DATE,
        grantedById: operatorAdminId,
        createdById: operatorAdminId,
        createdAt: SEED_DATE,
      },
    })
    roleAssignmentIds.set(user.key, assignment.id)
  }

  // Betreuungszuordnung (3.11, 2.3): der erste MSP-Disponent betreut **beide**
  // Kunden — ohne das ließe sich am Seed nicht zeigen, dass der Betreiber den
  // Querschnitt führt. Der zweite Disponent betreut nur Kunde 2 und zeigt
  // damit die Einschränkung. Der Betreiberadministrator bekommt keine: das ist
  // die bewusste Entscheidung für die vollständige Querschnittssicht (2.3) und
  // Gegenstand des Berechtigungsreviews (6.8).
  for (const customerKey of ['customer1', 'customer2'] as const) {
    await prisma.accountAssignment.create({
      data: {
        userId: userId('operatorCoordinator'),
        customerTenantId: tenantId(customerKey),
        validFrom: SEED_DATE,
        createdById: operatorAdminId,
        createdAt: SEED_DATE,
      },
    })
  }
  await prisma.accountAssignment.create({
    data: {
      userId: userId('operatorCoordinatorLimited'),
      customerTenantId: tenantId('customer2'),
      validFrom: SEED_DATE,
      createdById: operatorAdminId,
      createdAt: SEED_DATE,
    },
  })

  // Zuständigkeit (`responsibilityScope`, 3.11): **bewusst leer.** Ob
  // Kundenrollen auf einzelne Standorte und Kostenstellen eingeschränkt werden
  // dürfen und wer die Zuständigkeit pflegt, ist **offene Frage 14**. Solange
  // sie offen ist, legt der Seed kein Beispiel an — eine geseedete
  // Einschränkung wäre eine stillschweigende Antwort. Sobald die Frage
  // entschieden ist, gehört hier ein Beispiel hin (und in 3.11 ein Verweis auf
  // die Entscheidung).

  // Vertretung (2.4): der Genehmiger bei Kunde 1 wird im Februar 2026 vom
  // Bedarfsträger desselben Kunden vertreten — befristet, personenbezogen,
  // innerhalb einer Organisation. Eingerichtet vom Rolleninhaber selbst
  // (geplante Abwesenheit, Fußnote [45]).
  const approverAssignmentId = roleAssignmentIds.get('approver1')
  if (approverAssignmentId === undefined) throw new Error('Rollenzuweisung des Genehmigers fehlt')
  await prisma.delegation.create({
    data: {
      delegatedRoleAssignmentId: approverAssignmentId,
      delegateUserId: userId('demandOwner1'),
      tenantId: tenantId('customer1'),
      periodFrom: day('2026-02-09'),
      periodTo: new Date('2026-02-20T23:59:59.000Z'),
      reason: 'Urlaub',
      createdById: userId('approver1'),
      createdAt: SEED_DATE,
    },
  })

  // ── Kunden, Standorte, Kostenstellen (3.1) ───────────────────────────────
  const customer1 = await prisma.customer.create({
    data: {
      tenantId: tenantId('customer1'),
      customerNumber: 'K-1001',
      legalName: 'Nordwerk Metall GmbH',
      legalForm: 'GmbH',
      addressStreet: 'Hafenstraße 12',
      addressPostalCode: '21079',
      addressCity: 'Hamburg',
      addressCountry: 'DE',
      industrySector: 'Metallverarbeitung',
      corporateGroup: 'Nordwerk Gruppe',
      // Vorbelegungen aus 4.0, je Kunde konfigurierbar (2.4, Regel 5).
      processDeadlineConfig: {
        demandApprovalDeadlineDays: 3,
        invitationViewDeadlineDays: 1,
        submissionFeedbackDeadlineDays: 3,
      },
      validFrom: day('2025-01-01'),
      createdById: operatorAdminId,
      createdAt: SEED_DATE,
      contacts: {
        create: [
          {
            name: 'Detlef Wiegand',
            function: 'Leiter Einkauf',
            email: 'detlef.wiegand@nordwerk-metall.example',
            createdById: operatorAdminId,
          },
        ],
      },
    },
  })

  const customer2 = await prisma.customer.create({
    data: {
      tenantId: tenantId('customer2'),
      customerNumber: 'K-1002',
      legalName: 'Südharz Logistik GmbH',
      legalForm: 'GmbH',
      addressStreet: 'Am Güterbahnhof 3',
      addressPostalCode: '37412',
      addressCity: 'Herzberg am Harz',
      addressCountry: 'DE',
      industrySector: 'Logistik',
      validFrom: day('2025-04-01'),
      createdById: operatorAdminId,
      createdAt: SEED_DATE,
      contacts: {
        create: [
          {
            name: 'Carola Steinbach',
            function: 'Controlling',
            email: 'carola.steinbach@suedharz-logistik.example',
            createdById: operatorAdminId,
          },
        ],
      },
    },
  })

  const site1 = await prisma.site.create({
    data: {
      tenantId: customer1.tenantId,
      customerId: customer1.id,
      siteNumber: 'S-01',
      name: 'Werk Nord',
      addressStreet: 'Hafenstraße 12',
      addressPostalCode: '21079',
      addressCity: 'Hamburg',
      addressCountry: 'DE',
      standardWeeklyHours: 38.5,
      safetyBriefingRequired: true,
      validFrom: day('2025-01-01'),
      createdById: operatorAdminId,
      createdAt: SEED_DATE,
      contacts: {
        create: [{ name: 'Holger Marx', function: 'Werkleitung', createdById: operatorAdminId }],
      },
    },
  })

  const site2 = await prisma.site.create({
    data: {
      tenantId: customer1.tenantId,
      customerId: customer1.id,
      siteNumber: 'S-02',
      name: 'Werk Süd',
      addressStreet: 'Industriering 8',
      addressPostalCode: '21107',
      addressCity: 'Hamburg',
      addressCountry: 'DE',
      standardWeeklyHours: 35,
      safetyBriefingRequired: true,
      validFrom: day('2025-06-01'),
      createdById: operatorAdminId,
      createdAt: SEED_DATE,
    },
  })

  const site3 = await prisma.site.create({
    data: {
      tenantId: customer2.tenantId,
      customerId: customer2.id,
      siteNumber: 'S-01',
      name: 'Zentrallager Herzberg',
      addressStreet: 'Am Güterbahnhof 3',
      addressPostalCode: '37412',
      addressCity: 'Herzberg am Harz',
      addressCountry: 'DE',
      standardWeeklyHours: 40,
      safetyBriefingRequired: false,
      validFrom: day('2025-04-01'),
      createdById: operatorAdminId,
      createdAt: SEED_DATE,
    },
  })

  const costCenter1 = await prisma.costCenter.create({
    data: {
      tenantId: customer1.tenantId,
      customerId: customer1.id,
      costCenterNumber: 'KST-4711',
      name: 'Montage Halle 2',
      siteId: site1.id,
      budgetAmount: 180000,
      budgetCurrency: 'EUR',
      validFrom: day('2025-01-01'),
      createdById: operatorAdminId,
      createdAt: SEED_DATE,
    },
  })

  const costCenter2 = await prisma.costCenter.create({
    data: {
      tenantId: customer1.tenantId,
      customerId: customer1.id,
      costCenterNumber: 'KST-4712',
      name: 'Instandhaltung',
      siteId: site2.id,
      validFrom: day('2025-06-01'),
      createdById: operatorAdminId,
      createdAt: SEED_DATE,
    },
  })

  const costCenter3 = await prisma.costCenter.create({
    data: {
      tenantId: customer2.tenantId,
      customerId: customer2.id,
      costCenterNumber: 'KST-900',
      name: 'Wareneingang',
      siteId: site3.id,
      validFrom: day('2025-04-01'),
      createdById: operatorAdminId,
      createdAt: SEED_DATE,
    },
  })

  // ── Lieferanten und AÜG-Erlaubnis (3.2) ──────────────────────────────────
  const supplier1 = await prisma.supplier.create({
    data: {
      tenantId: tenantId('supplier1'),
      supplierNumber: 'L-2001',
      legalName: 'Rheinpersonal GmbH',
      legalForm: 'GmbH',
      addressStreet: 'Rheinallee 44',
      addressPostalCode: '40210',
      addressCity: 'Düsseldorf',
      addressCountry: 'DE',
      // `active`: Rahmenvertrag, Tarifbindung und anerkannte Erlaubnis liegen
      // vor (4.6, onboarding → active).
      status: 'active',
      validFrom: day('2025-01-15'),
      createdById: operatorAdminId,
      createdAt: SEED_DATE,
      contacts: {
        create: [
          {
            name: 'Nils Brandner',
            function: 'Disposition',
            email: 'nils.brandner@rheinpersonal.example',
            createdById: operatorAdminId,
          },
        ],
      },
    },
  })

  const supplier2 = await prisma.supplier.create({
    data: {
      tenantId: tenantId('supplier2'),
      supplierNumber: 'L-2002',
      legalName: 'Elbe Zeitarbeit GmbH',
      legalForm: 'GmbH',
      addressStreet: 'Elbchaussee 210',
      addressPostalCode: '22605',
      addressCity: 'Hamburg',
      addressCountry: 'DE',
      status: 'active',
      validFrom: day('2025-03-01'),
      createdById: operatorAdminId,
      createdAt: SEED_DATE,
      contacts: {
        create: [
          {
            name: 'Pia Lohmann',
            function: 'Geschäftsführung',
            email: 'pia.lohmann@elbe-zeitarbeit.example',
            createdById: operatorAdminId,
          },
        ],
      },
    },
  })

  // Beide Erlaubnisse sind anerkannt und am Stichtag gültig — Voraussetzung
  // jeder Einladung (4.2.1, Prüfung P9 in 5.4). Dazu gehört die **Urkunde**:
  // 3.2 macht den Verweis zur Pflicht (E25), 3.10 die hinterlegte Datei, und
  // 5.4.1 rechnet einen Satz ohne beides als nicht deckungsfähig. Die Urkunde
  // ist ein Dokument nach 3.10; sie trägt den Mandanten des Lieferanten und
  // ist für den Kunden auf den Gültigkeitsstatus beschränkt ([36]).
  const urkunde1 = await prisma.document.create({
    data: {
      tenantId: supplier1.tenantId,
      documentNumber: 'DOK-2024-0815',
      documentCategory: 'permitCertificate',
      subjectType: 'supplier',
      supplierId: supplier1.id,
      issuer: 'Agentur für Arbeit Düsseldorf',
      issuedOn: day('2024-02-01'),
      validFrom: day('2024-02-01'),
      fileRef: 'ablage://beispiel/erlaubnis/AZ-2024-0815',
      fileName: 'AZ-2024-0815_Erlaubnisurkunde.pdf',
      mimeType: 'application/pdf',
      uploadedAt: day('2024-02-05'),
      uploadedById: userId('supplierAdmin1'),
      verificationStatus: 'accepted',
      verifiedAt: day('2025-01-20'),
      verifiedById: userId('operatorCoordinator'),
      confidentiality: 'operatorAndOwner',
      createdById: userId('supplierAdmin1'),
      createdAt: SEED_DATE,
    },
  })
  const urkunde2 = await prisma.document.create({
    data: {
      tenantId: supplier2.tenantId,
      documentNumber: 'DOK-2025-0423',
      documentCategory: 'permitCertificate',
      subjectType: 'supplier',
      supplierId: supplier2.id,
      issuer: 'Agentur für Arbeit Hamburg',
      issuedOn: day('2025-06-15'),
      validFrom: day('2025-07-01'),
      // Läuft **bald** ab: so zeigt der nächtliche Lauf die gestufte
      // Ablaufbehandlung aus 5.4.4 an echten Daten (N1), statt sie nur zu
      // behaupten. Die Urkunde endet mit der Erlaubnis.
      validTo: day('2026-12-05'),
      fileRef: 'ablage://beispiel/erlaubnis/AZ-2025-0423',
      fileName: 'AZ-2025-0423_Erlaubnisurkunde.pdf',
      mimeType: 'application/pdf',
      uploadedAt: day('2025-06-20'),
      uploadedById: userId('supplierAdmin2'),
      verificationStatus: 'accepted',
      verifiedAt: day('2025-07-02'),
      verifiedById: userId('operatorCoordinator'),
      confidentiality: 'operatorAndOwner',
      createdById: userId('supplierAdmin2'),
      createdAt: SEED_DATE,
    },
  })

  await prisma.supplierPermit.create({
    data: {
      tenantId: supplier1.tenantId,
      supplierId: supplier1.id,
      permitNumber: 'AZ-2024-0815',
      issuingAuthority: 'Agentur für Arbeit Düsseldorf',
      permitType: 'unlimited',
      issuedOn: day('2024-02-01'),
      validFrom: day('2024-02-01'),
      certificateDocumentRef: urkunde1.id,
      verificationStatus: 'accepted',
      verifiedAt: day('2025-01-20'),
      verifiedById: userId('operatorCoordinator'),
      createdById: userId('supplierAdmin1'),
      createdAt: SEED_DATE,
    },
  })

  await prisma.supplierPermit.create({
    data: {
      tenantId: supplier2.tenantId,
      supplierId: supplier2.id,
      permitNumber: 'AZ-2025-0423',
      issuingAuthority: 'Agentur für Arbeit Hamburg',
      permitType: 'fixedTerm',
      issuedOn: day('2025-06-15'),
      validFrom: day('2025-07-01'),
      validTo: day('2026-12-05'),
      certificateDocumentRef: urkunde2.id,
      verificationStatus: 'accepted',
      verifiedAt: day('2025-07-02'),
      verifiedById: userId('operatorCoordinator'),
      createdById: userId('supplierAdmin2'),
      createdAt: SEED_DATE,
    },
  })

  // ── Tarifzuordnungen (3.3) ───────────────────────────────────────────────
  //
  // Der Tarifkatalog ist Konfiguration (Entscheidung zu offener Frage 3). Die
  // Zuordnung des Verleihers ist nach 3.2 Pflicht ab Status `active`; sie wird
  // deshalb nach dem Lieferanten angelegt und dann verknüpft.
  const supplierAgreementAssignment = await prisma.collectiveAgreementAssignment.create({
    data: {
      tenantId: tenantId('operator'),
      collectiveAgreement: 'iGZ-DGB-Tarifwerk',
      appliesToType: 'supplier',
      supplierId: supplier1.id,
      validFrom: day('2025-01-01'),
      createdById: operatorAdminId,
      createdAt: SEED_DATE,
    },
  })
  await prisma.supplier.update({
    where: { id: supplier1.id },
    data: { supplierCollectiveAgreementId: supplierAgreementAssignment.id },
  })

  const supplier2AgreementAssignment = await prisma.collectiveAgreementAssignment.create({
    data: {
      tenantId: tenantId('operator'),
      collectiveAgreement: 'BAP-DGB-Tarifwerk',
      appliesToType: 'supplier',
      supplierId: supplier2.id,
      validFrom: day('2025-03-01'),
      createdById: operatorAdminId,
      createdAt: SEED_DATE,
    },
  })
  await prisma.supplier.update({
    where: { id: supplier2.id },
    data: { supplierCollectiveAgreementId: supplier2AgreementAssignment.id },
  })

  // Entleihertarif mit abweichenden Werten: 24 Monate Höchstüberlassungsdauer
  // statt 18 (5.1) — genau die Parameter, die 3.3 am Zuordnungsobjekt führt.
  // Die 15 Monate Equal-Pay-Frist stehen hier nur als Datenbeispiel: 5.2.2
  // liest die Frist aus der Zuordnung der **Verleiherseite**, nicht aus der des
  // Entleihers. Für die Rechnung ist dieser Wert deshalb ohne Wirkung — anders
  // als `maxAssignmentDurationMonths`, das 5.1.2 gerade hier liest.
  const customerAgreementAssignment = await prisma.collectiveAgreementAssignment.create({
    data: {
      tenantId: tenantId('operator'),
      collectiveAgreement: 'Tarifvertrag Metall Nord',
      appliesToType: 'customer',
      customerId: customer1.id,
      validFrom: day('2025-01-01'),
      maxAssignmentDurationMonths: 24,
      equalPayDeadlineMonths: 15,
      industryPremiumScheme: 'Branchenzuschlag Metall M1 bis M6',
      createdById: operatorAdminId,
      createdAt: SEED_DATE,
    },
  })
  await prisma.customer.update({
    where: { id: customer1.id },
    data: { customerCollectiveAgreementId: customerAgreementAssignment.id },
  })

  const siteAgreementAssignment = await prisma.collectiveAgreementAssignment.create({
    data: {
      tenantId: tenantId('operator'),
      collectiveAgreement: 'Branchenzuschlagstarif Metall',
      appliesToType: 'site',
      siteId: site1.id,
      validFrom: day('2025-01-01'),
      industryPremiumScheme: 'Branchenzuschlag Metall M1 bis M6',
      createdById: operatorAdminId,
      createdAt: SEED_DATE,
    },
  })
  await prisma.site.update({
    where: { id: site1.id },
    data: { collectiveAgreementAssignmentId: siteAgreementAssignment.id },
  })

  // ── Rahmenverträge und Preislisten beider Seiten (3.3) ───────────────────
  const customerAgreement1 = await prisma.masterAgreement.create({
    data: {
      tenantId: tenantId('operator'),
      agreementNumber: 'RV-K-1001',
      agreementType: 'customerAgreement',
      customerId: customer1.id,
      validFrom: day('2025-01-01'),
      noticePeriodDays: 90,
      paymentTermsDays: 30,
      status: 'active',
      createdById: operatorAdminId,
      createdAt: SEED_DATE,
    },
  })

  const customerAgreement2 = await prisma.masterAgreement.create({
    data: {
      tenantId: tenantId('operator'),
      agreementNumber: 'RV-K-1002',
      agreementType: 'customerAgreement',
      customerId: customer2.id,
      validFrom: day('2025-04-01'),
      paymentTermsDays: 45,
      status: 'active',
      createdById: operatorAdminId,
      createdAt: SEED_DATE,
    },
  })

  const supplierAgreement1 = await prisma.masterAgreement.create({
    data: {
      tenantId: tenantId('operator'),
      agreementNumber: 'RV-L-2001',
      agreementType: 'supplierAgreement',
      supplierId: supplier1.id,
      validFrom: day('2025-01-15'),
      paymentTermsDays: 30,
      status: 'active',
      createdById: operatorAdminId,
      createdAt: SEED_DATE,
    },
  })

  const supplierAgreement2 = await prisma.masterAgreement.create({
    data: {
      tenantId: tenantId('operator'),
      agreementNumber: 'RV-L-2002',
      agreementType: 'supplierAgreement',
      supplierId: supplier2.id,
      validFrom: day('2025-03-01'),
      paymentTermsDays: 30,
      status: 'active',
      createdById: operatorAdminId,
      createdAt: SEED_DATE,
    },
  })

  // Die Differenz zwischen Kunden- und Einkaufspreisliste ist die Marge des
  // Betreibers und für beide Gegenseiten unsichtbar ([41], [42]).
  await prisma.rateCard.create({
    data: {
      tenantId: tenantId('operator'),
      rateCardNumber: 'PL-K-1001-2026',
      masterAgreementId: customerAgreement1.id,
      rateCardScope: 'customerRateCard',
      validFrom: day('2026-01-01'),
      currency: 'EUR',
      status: 'active',
      createdById: operatorAdminId,
      createdAt: SEED_DATE,
      items: {
        create: [
          {
            itemType: 'baseRate',
            qualificationLevel: 'Helfer',
            hourlyRate: 24.5,
            minimumHours: 4,
            createdById: operatorAdminId,
          },
          {
            itemType: 'baseRate',
            qualificationLevel: 'Fachkraft Metall',
            hourlyRate: 31.9,
            createdById: operatorAdminId,
          },
        ],
      },
    },
  })

  await prisma.rateCard.create({
    data: {
      tenantId: tenantId('operator'),
      rateCardNumber: 'PL-K-1002-2026',
      masterAgreementId: customerAgreement2.id,
      rateCardScope: 'customerRateCard',
      validFrom: day('2026-01-01'),
      currency: 'EUR',
      status: 'active',
      createdById: operatorAdminId,
      createdAt: SEED_DATE,
      items: {
        create: [
          {
            itemType: 'baseRate',
            qualificationLevel: 'Fachkraft Lager',
            hourlyRate: 27.4,
            createdById: operatorAdminId,
          },
        ],
      },
    },
  })

  await prisma.rateCard.create({
    data: {
      tenantId: tenantId('operator'),
      rateCardNumber: 'PL-L-2001-2026',
      masterAgreementId: supplierAgreement1.id,
      rateCardScope: 'supplierRateCard',
      validFrom: day('2026-01-01'),
      currency: 'EUR',
      status: 'active',
      createdById: operatorAdminId,
      createdAt: SEED_DATE,
      items: {
        create: [
          {
            itemType: 'baseRate',
            qualificationLevel: 'Helfer',
            hourlyRate: 19.8,
            createdById: operatorAdminId,
          },
          {
            itemType: 'baseRate',
            qualificationLevel: 'Fachkraft Metall',
            hourlyRate: 25.6,
            createdById: operatorAdminId,
          },
        ],
      },
    },
  })

  await prisma.rateCard.create({
    data: {
      tenantId: tenantId('operator'),
      rateCardNumber: 'PL-L-2002-2026',
      masterAgreementId: supplierAgreement2.id,
      rateCardScope: 'supplierRateCard',
      validFrom: day('2026-01-01'),
      currency: 'EUR',
      status: 'active',
      createdById: operatorAdminId,
      createdAt: SEED_DATE,
      items: {
        create: [
          {
            itemType: 'baseRate',
            qualificationLevel: 'Fachkraft Lager',
            hourlyRate: 21.4,
            createdById: operatorAdminId,
          },
        ],
      },
    },
  })

  // ── Vergleichsentgelte (3.3, Grundlage 5.2) ──────────────────────────────
  //
  // **Ein Eintrag trägt die Tätigkeit eines Einsatzes wörtlich.** 5.2.4
  // Schritt 1 wählt den Eintrag über die `activityDescription` des Einsatzes;
  // ohne eine Übereinstimmung sperrt P4 **jede** Zettelgenehmigung (Q36), und
  // der Beispielstand könnte weder eine Genehmigung noch eine Abrechnung
  // zeigen — und damit auch keine der Warnungen, die 4.7 an diesen Übergängen
  // führt. Die übrigen Einträge bleiben bewusst unpassend: die Sperre aus Q36
  // ist an ihnen genauso zu sehen.
  await prisma.comparableWageEntry.create({
    data: {
      tenantId: customer1.tenantId,
      siteId: site1.id,
      activityKey: 'Bedienung der CNC-Maschinen 3 und 4 in der Nachtschicht, Halle 2',
      comparableWage: 21.6,
      currency: 'EUR',
      validFrom: day('2026-01-01'),
      wageSource: 'collectiveAgreement',
      reportedAt: day('2026-01-05'),
      reportedById: userId('procurementController1'),
      createdById: userId('procurementController1'),
      createdAt: SEED_DATE,
    },
  })

  await prisma.comparableWageEntry.create({
    data: {
      tenantId: customer1.tenantId,
      siteId: site1.id,
      activityKey: 'Montage Metallbau',
      comparableWage: 19.42,
      currency: 'EUR',
      validFrom: day('2026-01-01'),
      wageSource: 'collectiveAgreement',
      reportedAt: day('2026-01-05'),
      reportedById: userId('procurementController1'),
      createdById: userId('procurementController1'),
      createdAt: SEED_DATE,
    },
  })

  await prisma.comparableWageEntry.create({
    data: {
      tenantId: customer1.tenantId,
      siteId: site2.id,
      activityKey: 'Instandhaltung Mechanik',
      comparableWage: 22.1,
      currency: 'EUR',
      validFrom: day('2026-01-01'),
      // `estimate` ist für 5.2 nur eine Warnung, kein Nachweis (3.3).
      wageSource: 'estimate',
      reportedAt: day('2026-01-05'),
      reportedById: userId('procurementController1'),
      createdById: userId('procurementController1'),
      createdAt: SEED_DATE,
    },
  })

  await prisma.comparableWageEntry.create({
    data: {
      tenantId: customer2.tenantId,
      siteId: site3.id,
      activityKey: 'Kommissionierung',
      comparableWage: 17.85,
      currency: 'EUR',
      validFrom: day('2026-01-01'),
      wageSource: 'companyAgreement',
      reportedAt: day('2026-01-08'),
      reportedById: userId('procurementController2'),
      createdById: userId('procurementController2'),
      createdAt: SEED_DATE,
    },
  })

  // ── Bedarfsanfragen: je ein Zustand aus 4.1 ──────────────────────────────
  interface DemandSeed {
    readonly requestNumber: string
    readonly status:
      | 'draft'
      | 'submitted'
      | 'approved'
      | 'tendered'
      | 'inSelection'
      | 'filled'
      | 'cancelled'
      | 'expired'
    readonly customerId: string
    readonly tenantId: string
    readonly siteId: string
    readonly costCenterId: string
    readonly requestedById: string
    readonly title: string
    readonly activityDescription: string
    readonly qualification: string
    readonly headcount: number
    readonly startDate: Date
    readonly endDate: Date | null
    readonly weeklyHours: number
    readonly maxHourlyRate: number | null
    readonly internalNote: string | null
    readonly offerDeadline: Date | null
    readonly approvedById: string | null
    readonly approvedAt: Date | null
    readonly cancellationReason: string | null
    readonly rejectionReason: string | null
  }

  const demands: readonly DemandSeed[] = [
    {
      requestNumber: 'BA-2026-0001',
      status: 'draft',
      customerId: customer1.id,
      tenantId: customer1.tenantId,
      siteId: site1.id,
      costCenterId: costCenter1.id,
      requestedById: userId('demandOwner1'),
      title: 'Montagehelfer Halle 2',
      activityDescription: 'Montage von Baugruppen im Metallbau, Halle 2, Zweischichtbetrieb',
      qualification: 'Erfahrung Metallmontage',
      headcount: 3,
      startDate: day('2027-02-01'),
      endDate: day('2027-07-31'),
      weeklyHours: 38.5,
      maxHourlyRate: 26,
      internalNote: 'Budget steht nur bis Q3 bereit',
      offerDeadline: null,
      approvedById: null,
      approvedAt: null,
      cancellationReason: null,
      rejectionReason: null,
    },
    {
      requestNumber: 'BA-2026-0002',
      status: 'submitted',
      customerId: customer1.id,
      tenantId: customer1.tenantId,
      siteId: site2.id,
      costCenterId: costCenter2.id,
      requestedById: userId('demandOwner1'),
      title: 'Instandhalter Mechanik',
      activityDescription: 'Wartung und Instandhaltung mechanischer Anlagen, Werk Süd',
      qualification: 'Industriemechanik',
      headcount: 1,
      startDate: day('2027-01-15'),
      endDate: null,
      weeklyHours: 35,
      maxHourlyRate: 34,
      internalNote: null,
      offerDeadline: null,
      approvedById: null,
      approvedAt: null,
      cancellationReason: null,
      // Eine frühere Rückweisung ist dokumentiert; die Anfrage ist danach
      // erneut eingereicht worden (4.1, submitted → draft → submitted).
      rejectionReason: 'Kostenstelle fehlte in der ersten Fassung',
    },
    {
      requestNumber: 'BA-2026-0003',
      status: 'approved',
      customerId: customer1.id,
      tenantId: customer1.tenantId,
      siteId: site1.id,
      costCenterId: costCenter1.id,
      requestedById: userId('demandOwner1'),
      title: 'Fachkraft Metall, Nachtschicht',
      activityDescription: 'Bedienung von CNC-Maschinen in der Nachtschicht, Halle 2',
      qualification: 'CNC-Erfahrung',
      headcount: 2,
      startDate: day('2027-03-01'),
      endDate: day('2027-12-31'),
      weeklyHours: 38.5,
      maxHourlyRate: 36,
      internalNote: 'Nachtzuschlag ist eingeplant',
      offerDeadline: null,
      approvedById: userId('approver1'),
      approvedAt: day('2026-02-05'),
      cancellationReason: null,
      rejectionReason: null,
    },
    {
      requestNumber: 'BA-2026-0004',
      status: 'tendered',
      customerId: customer1.id,
      tenantId: customer1.tenantId,
      siteId: site1.id,
      costCenterId: costCenter1.id,
      requestedById: userId('demandOwner1'),
      title: 'Montagehelfer Zusatzbedarf',
      activityDescription: 'Zuführung und Vormontage von Baugruppen, Halle 2',
      qualification: 'Erfahrung Metallmontage',
      headcount: 2,
      startDate: day('2027-01-04'),
      endDate: day('2027-06-30'),
      weeklyHours: 38.5,
      maxHourlyRate: 28,
      internalNote: 'Zwei Lieferanten eingeladen',
      offerDeadline: hour('2026-12-15T12:00'),
      approvedById: userId('approver1'),
      approvedAt: day('2026-10-01'),
      cancellationReason: null,
      rejectionReason: null,
    },
    {
      requestNumber: 'BA-2026-0005',
      status: 'inSelection',
      customerId: customer2.id,
      tenantId: customer2.tenantId,
      siteId: site3.id,
      costCenterId: costCenter3.id,
      requestedById: userId('demandOwner2'),
      title: 'Kommissionierer Zentrallager',
      activityDescription: 'Kommissionierung im Wareneingang, Zentrallager Herzberg',
      qualification: 'Staplerschein',
      headcount: 4,
      startDate: day('2027-02-15'),
      endDate: day('2027-08-31'),
      weeklyHours: 40,
      maxHourlyRate: 25,
      internalNote: null,
      offerDeadline: hour('2026-12-01T12:00'),
      approvedById: userId('approver2'),
      approvedAt: day('2026-09-15'),
      cancellationReason: null,
      rejectionReason: null,
    },
    {
      requestNumber: 'BA-2026-0006',
      status: 'filled',
      customerId: customer2.id,
      tenantId: customer2.tenantId,
      siteId: site3.id,
      costCenterId: costCenter3.id,
      requestedById: userId('demandOwner2'),
      title: 'Staplerfahrer Nachtschicht',
      activityDescription: 'Innerbetrieblicher Transport in der Nachtschicht, Zentrallager',
      qualification: 'Staplerschein',
      headcount: 1,
      startDate: day('2026-09-01'),
      endDate: day('2027-02-28'),
      weeklyHours: 40,
      maxHourlyRate: 26,
      internalNote: null,
      offerDeadline: hour('2026-08-01T12:00'),
      approvedById: userId('approver2'),
      approvedAt: day('2026-07-01'),
      cancellationReason: null,
      rejectionReason: null,
    },
    {
      requestNumber: 'BA-2026-0007',
      status: 'cancelled',
      customerId: customer1.id,
      tenantId: customer1.tenantId,
      siteId: site2.id,
      costCenterId: costCenter2.id,
      requestedById: userId('demandOwner1'),
      title: 'Lagerhelfer Werk Süd',
      activityDescription: 'Bereitstellung von Material am Montageband, Werk Süd',
      qualification: 'keine besondere',
      headcount: 2,
      startDate: day('2026-11-01'),
      endDate: day('2027-01-31'),
      weeklyHours: 35,
      maxHourlyRate: null,
      internalNote: null,
      offerDeadline: null,
      approvedById: null,
      approvedAt: null,
      cancellationReason: 'Bedarf durch internen Übergang entfallen',
      rejectionReason: null,
    },
    {
      requestNumber: 'BA-2026-0008',
      status: 'expired',
      customerId: customer1.id,
      tenantId: customer1.tenantId,
      siteId: site1.id,
      costCenterId: costCenter1.id,
      requestedById: userId('demandOwner1'),
      title: 'Qualitätsprüfer Wareneingang',
      activityDescription: 'Sicht- und Maßprüfung im Wareneingang, Halle 1',
      qualification: 'Messmittelerfahrung',
      headcount: 1,
      startDate: day('2026-06-01'),
      endDate: day('2026-12-31'),
      weeklyHours: 38.5,
      maxHourlyRate: 30,
      internalNote: 'Bedarfsbeginn verstrichen, keine Besetzung zustande gekommen',
      offerDeadline: hour('2026-05-15T12:00'),
      approvedById: userId('approver1'),
      approvedAt: day('2026-04-02'),
      cancellationReason: null,
      rejectionReason: null,
    },
  ]

  const demandIds = new Map<string, string>()
  for (const demand of demands) {
    const created = await prisma.demandRequest.create({
      data: {
        tenantId: demand.tenantId,
        requestNumber: demand.requestNumber,
        customerId: demand.customerId,
        siteId: demand.siteId,
        costCenterId: demand.costCenterId,
        requestedById: demand.requestedById,
        title: demand.title,
        activityDescription: demand.activityDescription,
        headcount: demand.headcount,
        startDate: demand.startDate,
        endDate: demand.endDate,
        weeklyHours: demand.weeklyHours,
        offerDeadline: demand.offerDeadline,
        maxHourlyRate: demand.maxHourlyRate,
        currency: demand.maxHourlyRate === null ? null : 'EUR',
        internalNote: demand.internalNote,
        approvedAt: demand.approvedAt,
        approvedById: demand.approvedById,
        cancellationReason: demand.cancellationReason,
        rejectionReason: demand.rejectionReason,
        status: demand.status,
        createdById: demand.requestedById,
        createdAt: SEED_DATE,
        qualificationRequirements: {
          create: [
            {
              qualification: demand.qualification,
              requirementKind: 'mandatory',
              createdById: demand.requestedById,
            },
          ],
        },
      },
    })
    demandIds.set(demand.requestNumber, created.id)
  }

  // ── Ausschreibung, Einladungen, Angebot (3.5, 4.2) ───────────────────────
  //
  // Zur ausgeschriebenen Anfrage BA-2026-0004: eine Ausschreibung mit zwei
  // Einladungen. Lieferant 1 hat angeboten (`offerSubmitted`), Lieferant 2 hat
  // abgesagt (`declined` mit Grund, Fußnote [46]). Keiner der beiden erfährt
  // vom anderen (2.3).
  const tenderedDemandId = demandIds.get('BA-2026-0004')
  if (tenderedDemandId === undefined) throw new Error('Ausgeschriebene Anfrage fehlt')

  const tender = await prisma.tender.create({
    data: {
      tenantId: tenantId('operator'),
      tenderNumber: 'BA-2026-0004-R1',
      demandRequestId: tenderedDemandId,
      tenderRound: 1,
      distributionMode: 'simultaneous',
      publishedAt: day('2026-10-05'),
      publishedById: userId('operatorCoordinator'),
      offerDeadline: hour('2026-12-15T12:00'),
      createdById: userId('operatorCoordinator'),
      createdAt: SEED_DATE,
    },
  })

  const invitation1 = await prisma.tenderInvitation.create({
    data: {
      tenantId: tenantId('operator'),
      tenderId: tender.id,
      supplierId: supplier1.id,
      invitedAt: day('2026-10-05'),
      viewedAt: day('2026-10-06'),
      respondedAt: day('2026-10-07'),
      invitationStatus: 'offerSubmitted',
      createdById: userId('operatorCoordinator'),
      createdAt: SEED_DATE,
    },
  })

  await prisma.tenderInvitation.create({
    data: {
      tenantId: tenantId('operator'),
      tenderId: tender.id,
      supplierId: supplier2.id,
      invitedAt: day('2026-10-05'),
      viewedAt: day('2026-10-06'),
      respondedAt: day('2026-10-06'),
      declineReason: 'Keine Kapazität im angefragten Zeitraum',
      invitationStatus: 'declined',
      createdById: userId('operatorCoordinator'),
      createdAt: SEED_DATE,
    },
  })

  await prisma.supplierOffer.create({
    data: {
      tenantId: supplier1.tenantId,
      offerNumber: 'A-L-2001-1',
      tenderInvitationId: invitation1.id,
      supplierId: supplier1.id,
      availableFrom: day('2027-01-04'),
      offeredHeadcount: 2,
      offerValidUntil: hour('2026-12-31T12:00'),
      note: 'Zwei Mitarbeitende mit Montageerfahrung verfügbar',
      submittedAt: day('2026-10-07'),
      status: 'submitted',
      createdById: userId('supplierCoordinator1'),
      createdAt: SEED_DATE,
      items: {
        create: [
          {
            qualificationLevel: 'Helfer',
            headcount: 2,
            hourlyRate: 19.8,
            currency: 'EUR',
            createdById: userId('supplierCoordinator1'),
          },
        ],
      },
    },
  })

  // ── Kandidaten und Personenidentität (3.6) ───────────────────────────────
  //
  // Vier Kandidaten bei Lieferant 1, drei bei Lieferant 2 — alle erfunden
  // (CLAUDE.md, Regel 3). Zwei Personen sind **bei beiden Lieferanten**
  // geführt; das ist der Fall, für den 3.6 die Personenidentität einführt und
  // den 5.1 braucht, um über Lieferanten hinweg zu zählen:
  //
  //  - **Marek Dvořák** ist bei beiden Lieferanten geführt, und **beide**
  //    Verknüpfungen sind bestätigt. Erst dadurch zählen die Einsätze der
  //    Person zusammen (P1).
  //  - **Ilona Brandt** ist ebenfalls bei beiden geführt, aber nur die
  //    Verknüpfung bei Lieferant 1 ist **bestätigt**; die bei Lieferant 2 ist
  //    **nur vorgeschlagen**. Nach 3.6 und 4.2.3 zählt dieser Satz deshalb als
  //    eigene Person — ein maschineller Treffer allein löst keine Prüfung aus.
  //    `Candidate.workerIdentityId` bleibt dort leer, der Vorschlag steht
  //    allein in `WorkerIdentityLink`.
  interface CandidateSeed {
    readonly key: string
    readonly supplierId: string
    readonly tenantId: string
    readonly candidateNumber: string
    readonly givenName: string
    readonly familyName: string
    readonly dateOfBirth: Date
    readonly placeOfBirth: string | null
    readonly pseudonym: string
    readonly qualification: string
    readonly employmentStatusWithSupplier: 'employed' | 'applicant'
    readonly employedSince: Date | null
    readonly workPermitRequired: boolean
    readonly previousEmploymentDeclaredAt: Date | null
    readonly previousEmploymentExisted: boolean | null
    readonly previousEmploymentEndedOn: Date | null
    readonly previousEmploymentEmployer: string | null
    readonly createdBy: string
  }

  const candidateSeeds: readonly CandidateSeed[] = [
    {
      key: 'marek-s1',
      supplierId: supplier1.id,
      tenantId: supplier1.tenantId,
      candidateNumber: 'K-L-2001-1',
      givenName: 'Marek',
      familyName: 'Dvořák',
      dateOfBirth: day('1989-04-12'),
      placeOfBirth: 'Pilsen',
      pseudonym: 'Profil M.D. (Montage)',
      qualification: 'Erfahrung Metallmontage',
      employmentStatusWithSupplier: 'employed',
      employedSince: day('2024-03-01'),
      workPermitRequired: false,
      previousEmploymentDeclaredAt: day('2026-09-20'),
      previousEmploymentExisted: false,
      previousEmploymentEndedOn: null,
      previousEmploymentEmployer: null,
      createdBy: userId('supplierCoordinator1'),
    },
    {
      key: 'ilona-s1',
      supplierId: supplier1.id,
      tenantId: supplier1.tenantId,
      candidateNumber: 'K-L-2001-2',
      givenName: 'Ilona',
      familyName: 'Brandt',
      dateOfBirth: day('1992-09-30'),
      placeOfBirth: 'Erfurt',
      pseudonym: 'Profil I.B. (Lager)',
      qualification: 'Staplerschein',
      employmentStatusWithSupplier: 'employed',
      employedSince: day('2025-01-15'),
      workPermitRequired: false,
      previousEmploymentDeclaredAt: day('2026-08-11'),
      previousEmploymentExisted: false,
      previousEmploymentEndedOn: null,
      previousEmploymentEmployer: null,
      createdBy: userId('supplierCoordinator1'),
    },
    {
      // Erklärung „ja" mit Austritt beim Entleiher: der Fall, den die
      // Drehtürklausel trifft (5.3.1). Gerechnet wird er mit P6 — hier stehen
      // nur die Daten.
      key: 'henrik-s1',
      supplierId: supplier1.id,
      tenantId: supplier1.tenantId,
      candidateNumber: 'K-L-2001-3',
      givenName: 'Henrik',
      familyName: 'Saalfeld',
      dateOfBirth: day('1985-02-03'),
      placeOfBirth: 'Kassel',
      pseudonym: 'Profil H.S. (CNC)',
      qualification: 'CNC-Erfahrung',
      employmentStatusWithSupplier: 'employed',
      employedSince: day('2026-10-01'),
      workPermitRequired: false,
      previousEmploymentDeclaredAt: day('2026-09-28'),
      previousEmploymentExisted: true,
      previousEmploymentEndedOn: day('2026-08-31'),
      previousEmploymentEmployer: 'Nordwerk Metall GmbH',
      createdBy: userId('supplierCoordinator1'),
    },
    {
      // Bewerber **ohne** Arbeitsverhältnis und **ohne** Erklärung: zwei
      // Vorbedingungen fehlen zugleich (P11 in 5.3.4, P6 in 5.3.1). Der Fall
      // belegt, dass die Zusage und der Einsatz daran scheitern.
      key: 'tomas-s1',
      supplierId: supplier1.id,
      tenantId: supplier1.tenantId,
      candidateNumber: 'K-L-2001-4',
      givenName: 'Tomáš',
      familyName: 'Kříž',
      dateOfBirth: day('1998-07-22'),
      placeOfBirth: 'Brünn',
      pseudonym: 'Profil T.K. (Helfer)',
      qualification: 'keine besondere',
      employmentStatusWithSupplier: 'applicant',
      employedSince: null,
      workPermitRequired: true,
      previousEmploymentDeclaredAt: null,
      previousEmploymentExisted: null,
      previousEmploymentEndedOn: null,
      previousEmploymentEmployer: null,
      createdBy: userId('supplierCoordinator1'),
    },
    {
      key: 'marek-s2',
      supplierId: supplier2.id,
      tenantId: supplier2.tenantId,
      candidateNumber: 'K-L-2002-1',
      givenName: 'Marek',
      familyName: 'Dvořák',
      dateOfBirth: day('1989-04-12'),
      placeOfBirth: 'Pilsen',
      pseudonym: 'Kandidat 7781',
      qualification: 'Erfahrung Metallmontage',
      employmentStatusWithSupplier: 'employed',
      employedSince: day('2026-11-01'),
      workPermitRequired: false,
      previousEmploymentDeclaredAt: day('2026-10-25'),
      previousEmploymentExisted: false,
      previousEmploymentEndedOn: null,
      previousEmploymentEmployer: null,
      createdBy: userId('supplierCoordinator2'),
    },
    {
      key: 'ilona-s2',
      supplierId: supplier2.id,
      tenantId: supplier2.tenantId,
      candidateNumber: 'K-L-2002-2',
      givenName: 'Ilona',
      familyName: 'Brandt',
      dateOfBirth: day('1992-09-30'),
      placeOfBirth: 'Erfurt',
      pseudonym: 'Kandidat 7782',
      qualification: 'Staplerschein',
      employmentStatusWithSupplier: 'employed',
      employedSince: day('2026-12-01'),
      workPermitRequired: false,
      previousEmploymentDeclaredAt: day('2026-11-20'),
      previousEmploymentExisted: false,
      previousEmploymentEndedOn: null,
      previousEmploymentEmployer: null,
      createdBy: userId('supplierCoordinator2'),
    },
    {
      key: 'ruth-s2',
      supplierId: supplier2.id,
      tenantId: supplier2.tenantId,
      candidateNumber: 'K-L-2002-3',
      givenName: 'Ruth',
      familyName: 'Delfs',
      dateOfBirth: day('1990-11-05'),
      placeOfBirth: 'Rostock',
      pseudonym: 'Kandidat 7783',
      qualification: 'Fachkraft Lager',
      employmentStatusWithSupplier: 'employed',
      employedSince: day('2024-09-01'),
      workPermitRequired: false,
      previousEmploymentDeclaredAt: day('2026-07-02'),
      previousEmploymentExisted: false,
      previousEmploymentEndedOn: null,
      previousEmploymentEmployer: null,
      createdBy: userId('supplierCoordinator2'),
    },
  ]

  const candidateIds = new Map<string, string>()
  for (const candidate of candidateSeeds) {
    const created = await prisma.candidate.create({
      data: {
        tenantId: candidate.tenantId,
        candidateNumber: candidate.candidateNumber,
        supplierId: candidate.supplierId,
        givenName: candidate.givenName,
        familyName: candidate.familyName,
        dateOfBirth: candidate.dateOfBirth,
        placeOfBirth: candidate.placeOfBirth,
        pseudonym: candidate.pseudonym,
        employmentStatusWithSupplier: candidate.employmentStatusWithSupplier,
        employedSince: candidate.employedSince,
        workPermitRequired: candidate.workPermitRequired,
        previousEmploymentDeclaredAt: candidate.previousEmploymentDeclaredAt,
        previousEmploymentExisted: candidate.previousEmploymentExisted,
        previousEmploymentEndedOn: candidate.previousEmploymentEndedOn,
        previousEmploymentEmployer: candidate.previousEmploymentEmployer,
        status: 'active',
        createdById: candidate.createdBy,
        createdAt: SEED_DATE,
        qualifications: {
          create: [{ qualification: candidate.qualification, createdById: candidate.createdBy }],
        },
      },
    })
    candidateIds.set(candidate.key, created.id)
  }

  const candidateId = (key: string): string => {
    const id = candidateIds.get(key)
    if (id === undefined) throw new Error(`Kandidat ${key} fehlt`)
    return id
  }

  /**
   * Legt eine Personenidentität mit ihren Verknüpfungen und der Historie an
   * (3.6). `confirmed` bestätigt die Verknüpfung und setzt
   * `Candidate.workerIdentityId`; `proposed` tut genau das **nicht**.
   */
  async function seedIdentity(input: {
    readonly identityNumber: string
    readonly givenName: string
    readonly familyName: string
    readonly dateOfBirth: Date
    readonly placeOfBirth: string
    readonly links: readonly {
      readonly candidateKey: string
      readonly linkStatus: 'confirmed' | 'proposed'
      readonly basis: string
      readonly reason: string
      readonly at: Date
    }[]
  }): Promise<void> {
    const confirmed = input.links.filter((link) => link.linkStatus === 'confirmed')
    const firstConfirmed = confirmed[0]
    const identity = await prisma.workerIdentity.create({
      data: {
        tenantId: tenantId('operator'),
        identityNumber: input.identityNumber,
        matchGivenName: input.givenName,
        matchFamilyName: input.familyName,
        matchDateOfBirth: input.dateOfBirth,
        matchPlaceOfBirth: input.placeOfBirth,
        confirmedAt: firstConfirmed?.at ?? null,
        confirmedById: firstConfirmed === undefined ? null : userId('operatorCoordinator'),
        createdById: userId('operatorCoordinator'),
        createdAt: SEED_DATE,
      },
    })
    for (const link of input.links) {
      await prisma.workerIdentityLink.create({
        data: {
          workerIdentityId: identity.id,
          candidateId: candidateId(link.candidateKey),
          linkStatus: link.linkStatus,
          proposalBasis: link.basis,
          proposedAt: link.at,
          confirmedAt: link.linkStatus === 'confirmed' ? link.at : null,
          confirmedById:
            link.linkStatus === 'confirmed' ? userId('operatorCoordinator') : null,
          reason: link.reason,
          createdById: userId('operatorCoordinator'),
          createdAt: SEED_DATE,
        },
      })
      // Der Vorschlag ist eine Systemhandlung und trägt keine Person
      // (4.0, Regel 10); die Bestätigung trägt sie (3.6).
      await prisma.workerIdentityMergeEntry.create({
        data: {
          workerIdentityId: identity.id,
          candidateId: candidateId(link.candidateKey),
          occurredAt: link.at,
          action: 'proposed',
          reason: link.basis,
          createdById: userId('operatorCoordinator'),
          createdAt: SEED_DATE,
        },
      })
      if (link.linkStatus === 'confirmed') {
        await prisma.workerIdentityMergeEntry.create({
          data: {
            workerIdentityId: identity.id,
            candidateId: candidateId(link.candidateKey),
            occurredAt: link.at,
            action: 'confirmed',
            reason: link.reason,
            actedById: userId('operatorCoordinator'),
            createdById: userId('operatorCoordinator'),
            createdAt: SEED_DATE,
          },
        })
        await prisma.candidate.update({
          where: { id: candidateId(link.candidateKey) },
          data: { workerIdentityId: identity.id },
        })
      }
    }
  }

  await seedIdentity({
    identityNumber: 'PI-0001',
    givenName: 'Marek',
    familyName: 'Dvořák',
    dateOfBirth: day('1989-04-12'),
    placeOfBirth: 'Pilsen',
    links: [
      {
        candidateKey: 'marek-s1',
        linkStatus: 'confirmed',
        basis: 'Name, Geburtsdatum und Geburtsort stimmen überein.',
        reason: 'Beim Betreiber geprüft und bestätigt; Ausweisdaten lagen beim Lieferanten vor.',
        at: day('2026-11-02'),
      },
      {
        candidateKey: 'marek-s2',
        linkStatus: 'confirmed',
        basis: 'Name, Geburtsdatum und Geburtsort stimmen überein.',
        reason:
          'Zweiter Kandidatensatz derselben Person bei einem anderen Lieferanten; bestätigt, ' +
          'damit 5.1 die Überlassungstage zusammenzählt.',
        at: day('2026-11-03'),
      },
    ],
  })

  await seedIdentity({
    identityNumber: 'PI-0002',
    givenName: 'Ilona',
    familyName: 'Brandt',
    dateOfBirth: day('1992-09-30'),
    placeOfBirth: 'Erfurt',
    links: [
      {
        candidateKey: 'ilona-s1',
        linkStatus: 'confirmed',
        basis: 'Name, Geburtsdatum und Geburtsort stimmen überein.',
        reason: 'Beim Betreiber geprüft und bestätigt.',
        at: day('2026-10-14'),
      },
      {
        // **Nur vorgeschlagen.** Bis zur Bestätigung zählt dieser
        // Kandidatensatz als eigene Person (3.6, 4.2.3).
        candidateKey: 'ilona-s2',
        linkStatus: 'proposed',
        basis: 'Name, Geburtsdatum und Geburtsort stimmen überein.',
        reason: 'Vorschlag des Abgleichs, noch nicht bestätigt.',
        at: day('2026-10-20'),
      },
    ],
  })

  // Einzelsätze brauchen die Identität trotzdem: 3.7 macht
  // `assignment.workerIdentityRef` ab `planned` zur Pflicht, und 5.1 zählt
  // darüber. 3.6 lässt das zu — `linkedCandidates` verlangt „mindestens einen".
  await seedIdentity({
    identityNumber: 'PI-0003',
    givenName: 'Henrik',
    familyName: 'Saalfeld',
    dateOfBirth: day('1985-02-03'),
    placeOfBirth: 'Kassel',
    links: [
      {
        candidateKey: 'henrik-s1',
        linkStatus: 'confirmed',
        basis: 'Von einer Person beim Betreiber angelegt, nicht maschinell gefunden.',
        reason: 'Einzelner Kandidatensatz; Identität für die Zählung nach 5.1 angelegt.',
        at: day('2026-10-02'),
      },
    ],
  })

  await seedIdentity({
    identityNumber: 'PI-0004',
    givenName: 'Ruth',
    familyName: 'Delfs',
    dateOfBirth: day('1990-11-05'),
    placeOfBirth: 'Rostock',
    links: [
      {
        candidateKey: 'ruth-s2',
        linkStatus: 'confirmed',
        basis: 'Von einer Person beim Betreiber angelegt, nicht maschinell gefunden.',
        reason: 'Einzelner Kandidatensatz; Identität für die Zählung nach 5.1 angelegt.',
        at: day('2026-08-20'),
      },
    ],
  })

  // ── Ausschreibungen zu BA-2026-0005 und BA-2026-0006 (3.5) ───────────────
  //
  // Die beiden Anfragen trugen ihren Zustand bisher **nur** als Seed-Datum,
  // weil Profilvorschlag und Einsatz fehlten. Jetzt liegen die Objekte darunter:
  // `inSelection` hat vorgelegte Vorschläge, `filled` hat einen Einsatz.
  const selectionDemandId = demandIds.get('BA-2026-0005')
  const filledDemandId = demandIds.get('BA-2026-0006')
  if (selectionDemandId === undefined || filledDemandId === undefined) {
    throw new Error('Anfragen zu Auswahl und Besetzung fehlen')
  }

  const selectionTender = await prisma.tender.create({
    data: {
      tenantId: tenantId('operator'),
      tenderNumber: 'BA-2026-0005-R1',
      demandRequestId: selectionDemandId,
      tenderRound: 1,
      distributionMode: 'simultaneous',
      publishedAt: day('2026-09-20'),
      publishedById: userId('operatorCoordinator'),
      offerDeadline: hour('2026-12-01T12:00'),
      createdById: userId('operatorCoordinator'),
      createdAt: SEED_DATE,
    },
  })

  const selectionOffers = new Map<string, string>()
  for (const entry of [
    { key: 'supplier1', supplierId: supplier1.id, tenantId: supplier1.tenantId, offerNumber: 'A-L-2001-2', user: 'supplierCoordinator1', rate: 19.8 },
    { key: 'supplier2', supplierId: supplier2.id, tenantId: supplier2.tenantId, offerNumber: 'A-L-2002-1', user: 'supplierCoordinator2', rate: 21.4 },
  ]) {
    const invitation = await prisma.tenderInvitation.create({
      data: {
        tenantId: tenantId('operator'),
        tenderId: selectionTender.id,
        supplierId: entry.supplierId,
        invitedAt: day('2026-09-20'),
        viewedAt: day('2026-09-21'),
        respondedAt: day('2026-09-25'),
        invitationStatus: 'offerSubmitted',
        createdById: userId('operatorCoordinator'),
        createdAt: SEED_DATE,
      },
    })
    const offer = await prisma.supplierOffer.create({
      data: {
        tenantId: entry.tenantId,
        offerNumber: entry.offerNumber,
        tenderInvitationId: invitation.id,
        supplierId: entry.supplierId,
        availableFrom: day('2027-02-15'),
        offeredHeadcount: 2,
        offerValidUntil: hour('2026-12-20T12:00'),
        submittedAt: day('2026-09-25'),
        reviewedAt: day('2026-09-28'),
        status: 'reviewed',
        createdById: userId(entry.user),
        createdAt: SEED_DATE,
        items: {
          create: [
            {
              qualificationLevel: 'Fachkraft Lager',
              headcount: 2,
              hourlyRate: entry.rate,
              currency: 'EUR',
              createdById: userId(entry.user),
            },
          ],
        },
      },
    })
    selectionOffers.set(entry.key, offer.id)
  }

  const filledInvitation = await prisma.tenderInvitation.create({
    data: {
      tenantId: tenantId('operator'),
      tenderId: (
        await prisma.tender.create({
          data: {
            tenantId: tenantId('operator'),
            tenderNumber: 'BA-2026-0006-R1',
            demandRequestId: filledDemandId,
            tenderRound: 1,
            distributionMode: 'simultaneous',
            publishedAt: day('2026-07-05'),
            publishedById: userId('operatorCoordinator'),
            offerDeadline: hour('2026-08-01T12:00'),
            createdById: userId('operatorCoordinator'),
            createdAt: SEED_DATE,
          },
        })
      ).id,
      supplierId: supplier2.id,
      invitedAt: day('2026-07-05'),
      viewedAt: day('2026-07-06'),
      respondedAt: day('2026-07-10'),
      invitationStatus: 'offerSubmitted',
      createdById: userId('operatorCoordinator'),
      createdAt: SEED_DATE,
    },
  })

  const filledOffer = await prisma.supplierOffer.create({
    data: {
      tenantId: supplier2.tenantId,
      offerNumber: 'A-L-2002-2',
      tenderInvitationId: filledInvitation.id,
      supplierId: supplier2.id,
      availableFrom: day('2026-09-01'),
      offeredHeadcount: 1,
      submittedAt: day('2026-07-10'),
      reviewedAt: day('2026-07-12'),
      status: 'accepted',
      createdById: userId('supplierCoordinator2'),
      createdAt: SEED_DATE,
      items: {
        create: [
          {
            qualificationLevel: 'Fachkraft Lager',
            headcount: 1,
            hourlyRate: 21.4,
            currency: 'EUR',
            createdById: userId('supplierCoordinator2'),
          },
        ],
      },
    },
  })

  // ── Profilvorschläge: je ein Zustand aus 4.2.3 ───────────────────────────
  //
  // Wie bei den Bedarfsanfragen gilt: der Seed legt **Daten** in dem Zustand
  // an, den 4.2.3 beschreibt. Er ist kein Weg um Kapitel 4 herum — die
  // Übergangsmenge in lib/status/candidateSubmission.ts bleibt die einzige
  // Stelle, an der ein Zustand **wechselt**.
  //
  // Die Offenlegungsstufe folgt 6.4: `pseudonymized` in jedem Zustand außer
  // `accepted`. Mit der Zusage wechselt sie auf `identified` — vorher sieht der
  // Kunde kein Klardatum ([23]).
  interface SubmissionSeed {
    readonly submissionNumber: string
    readonly offerKey: 'selection-supplier1' | 'selection-supplier2' | 'filled'
    readonly candidateKey: string
    readonly status:
      | 'draft'
      | 'submitted'
      | 'reviewed'
      | 'releasedToCustomer'
      | 'interviewScheduled'
      | 'accepted'
      | 'rejected'
      | 'withdrawn'
    readonly availableFrom: Date
    readonly submittedAt: Date | null
    readonly releasedToCustomerAt: Date | null
    readonly interviewScheduledAt: Date | null
    readonly decision: 'accepted' | 'rejected' | null
    readonly decisionReason: string | null
    readonly decidedAt: Date | null
    readonly decidedByKey: string | null
    readonly withdrawnAt: Date | null
    readonly createdByKey: string
  }

  const submissionSeeds: readonly SubmissionSeed[] = [
    {
      submissionNumber: 'PV-2026-0001',
      offerKey: 'selection-supplier1',
      candidateKey: 'tomas-s1',
      status: 'draft',
      availableFrom: day('2027-02-15'),
      submittedAt: null,
      releasedToCustomerAt: null,
      interviewScheduledAt: null,
      decision: null,
      decisionReason: null,
      decidedAt: null,
      decidedByKey: null,
      withdrawnAt: null,
      createdByKey: 'supplierCoordinator1',
    },
    {
      submissionNumber: 'PV-2026-0002',
      offerKey: 'selection-supplier1',
      candidateKey: 'ilona-s1',
      status: 'submitted',
      availableFrom: day('2027-02-15'),
      submittedAt: day('2026-10-05'),
      releasedToCustomerAt: null,
      interviewScheduledAt: null,
      decision: null,
      decisionReason: null,
      decidedAt: null,
      decidedByKey: null,
      withdrawnAt: null,
      createdByKey: 'supplierCoordinator1',
    },
    {
      submissionNumber: 'PV-2026-0003',
      offerKey: 'selection-supplier2',
      candidateKey: 'ruth-s2',
      status: 'reviewed',
      availableFrom: day('2027-02-15'),
      submittedAt: day('2026-10-06'),
      releasedToCustomerAt: null,
      interviewScheduledAt: null,
      decision: null,
      decisionReason: null,
      decidedAt: null,
      decidedByKey: null,
      withdrawnAt: null,
      createdByKey: 'supplierCoordinator2',
    },
    {
      submissionNumber: 'PV-2026-0004',
      offerKey: 'selection-supplier1',
      candidateKey: 'marek-s1',
      status: 'releasedToCustomer',
      availableFrom: day('2027-02-15'),
      submittedAt: day('2026-10-07'),
      releasedToCustomerAt: day('2026-10-09'),
      interviewScheduledAt: null,
      decision: null,
      decisionReason: null,
      decidedAt: null,
      decidedByKey: null,
      withdrawnAt: null,
      createdByKey: 'supplierCoordinator1',
    },
    {
      submissionNumber: 'PV-2026-0005',
      offerKey: 'selection-supplier2',
      // Derselbe Mensch wie `ilona-s1`, aber **nur vorgeschlagen** verknüpft:
      // der Betreiber sieht den Doppelvorschlag, keiner der beiden Lieferanten
      // erfährt davon (2.3, Regel 4).
      candidateKey: 'ilona-s2',
      status: 'interviewScheduled',
      availableFrom: day('2027-03-01'),
      submittedAt: day('2026-10-08'),
      releasedToCustomerAt: day('2026-10-10'),
      interviewScheduledAt: hour('2026-10-20T09:00'),
      decision: null,
      decisionReason: null,
      decidedAt: null,
      decidedByKey: null,
      withdrawnAt: null,
      createdByKey: 'supplierCoordinator2',
    },
    {
      submissionNumber: 'PV-2026-0006',
      offerKey: 'selection-supplier1',
      candidateKey: 'henrik-s1',
      status: 'rejected',
      availableFrom: day('2027-02-15'),
      submittedAt: day('2026-10-05'),
      releasedToCustomerAt: day('2026-10-09'),
      interviewScheduledAt: null,
      decision: 'rejected',
      // **Ohne** Bezug auf ein fremdes Angebot (2.3, Regel 3).
      decisionReason: 'Qualifikationsprofil passt nicht zur ausgeschriebenen Tätigkeit',
      decidedAt: day('2026-10-12'),
      decidedByKey: 'demandOwner2',
      withdrawnAt: null,
      createdByKey: 'supplierCoordinator1',
    },
    {
      submissionNumber: 'PV-2026-0007',
      offerKey: 'selection-supplier2',
      candidateKey: 'marek-s2',
      status: 'withdrawn',
      availableFrom: day('2027-02-15'),
      submittedAt: day('2026-10-06'),
      releasedToCustomerAt: null,
      interviewScheduledAt: null,
      decision: null,
      decisionReason: null,
      decidedAt: null,
      decidedByKey: null,
      withdrawnAt: day('2026-10-11'),
      createdByKey: 'supplierCoordinator2',
    },
    {
      submissionNumber: 'PV-2026-0008',
      offerKey: 'filled',
      candidateKey: 'ruth-s2',
      status: 'accepted',
      availableFrom: day('2026-09-01'),
      submittedAt: day('2026-07-14'),
      releasedToCustomerAt: day('2026-07-16'),
      interviewScheduledAt: hour('2026-07-20T10:00'),
      decision: 'accepted',
      decisionReason: null,
      decidedAt: day('2026-07-22'),
      decidedByKey: 'demandOwner2',
      withdrawnAt: null,
      createdByKey: 'supplierCoordinator2',
    },
  ]

  const offerIdByKey = (key: SubmissionSeed['offerKey']): string => {
    if (key === 'filled') return filledOffer.id
    const id = selectionOffers.get(key === 'selection-supplier1' ? 'supplier1' : 'supplier2')
    if (id === undefined) throw new Error(`Angebot ${key} fehlt`)
    return id
  }

  const submissionIds = new Map<string, string>()
  for (const submission of submissionSeeds) {
    const offerId = offerIdByKey(submission.offerKey)
    const offer = await prisma.supplierOffer.findUniqueOrThrow({
      where: { id: offerId },
      include: { tenderInvitation: { include: { tender: true } } },
    })
    const created = await prisma.candidateSubmission.create({
      data: {
        tenantId: offer.tenantId,
        submissionNumber: submission.submissionNumber,
        candidateId: candidateId(submission.candidateKey),
        supplierOfferId: offerId,
        demandRequestId: offer.tenderInvitation.tender.demandRequestId,
        submittedAt: submission.submittedAt,
        availableFrom: submission.availableFrom,
        // Klardaten erst nach Zusage (6.4): nur der zugesagte Vorschlag steht
        // auf `identified`.
        disclosureLevel: submission.status === 'accepted' ? 'identified' : 'pseudonymized',
        releasedToCustomerAt: submission.releasedToCustomerAt,
        interviewScheduledAt: submission.interviewScheduledAt,
        decision: submission.decision,
        decisionReason: submission.decisionReason,
        decidedAt: submission.decidedAt,
        decidedById:
          submission.decidedByKey === null ? null : userId(submission.decidedByKey),
        withdrawnAt: submission.withdrawnAt,
        status: submission.status,
        createdById: userId(submission.createdByKey),
        createdAt: SEED_DATE,
      },
    })
    submissionIds.set(submission.submissionNumber, created.id)
  }

  // ── Einsätze: je ein Zustand aus 4.3.1, einer mit Unterbrechung ──────────
  //
  // „Verlängert" ist **kein** Zustand (4.3.1): die Verlängerungen unten haben
  // ihren eigenen Lebenszyklus, und ihre Wirksamkeit zeigt sich am
  // verschobenen `plannedEndDate` des Einsatzes, nicht an seinem Status.
  //
  // Die abgeleiteten Felder `maxDurationEndDate`, `equalPayDueDate` und
  // `countedDurationDays` bleiben **leer**: sie sind Ergebnisse aus 5.1 und
  // 5.2 (3.0, Festlegung 3) und werden nicht als Seed-Datum erfunden.
  const rateCardItemByQualification = async (
    rateCardNumber: string,
    qualificationLevel: string,
  ): Promise<string> =>
    (
      await prisma.rateCardItem.findFirstOrThrow({
        where: { rateCard: { rateCardNumber }, qualificationLevel },
      })
    ).id

  const purchaseLagerS2 = await rateCardItemByQualification('PL-L-2002-2026', 'Fachkraft Lager')
  const purchaseHelferS1 = await rateCardItemByQualification('PL-L-2001-2026', 'Helfer')
  const purchaseMetallS1 = await rateCardItemByQualification('PL-L-2001-2026', 'Fachkraft Metall')
  const salesLagerK2 = await rateCardItemByQualification('PL-K-1002-2026', 'Fachkraft Lager')
  const salesHelferK1 = await rateCardItemByQualification('PL-K-1001-2026', 'Helfer')
  const salesMetallK1 = await rateCardItemByQualification('PL-K-1001-2026', 'Fachkraft Metall')

  interface AssignmentSeed {
    readonly assignmentNumber: string
    readonly status: 'planned' | 'active' | 'interrupted' | 'completed' | 'terminatedEarly'
    readonly customerId: string
    readonly siteId: string
    readonly costCenterId: string
    readonly supplierId: string
    readonly candidateKey: string
    readonly submissionNumber: string | null
    readonly demandRequestNumber: string | null
    readonly activityDescription: string
    readonly plannedStartDate: Date
    readonly plannedEndDate: Date | null
    readonly actualStartDate: Date | null
    readonly actualEndDate: Date | null
    readonly weeklyHours: number
    readonly shiftModel: string | null
    readonly agreedRateCardItemId: string
    readonly customerRateCardItemId: string
    readonly comparableWage: number | null
    readonly terminationReason: string | null
    readonly terminationRequestedByKey: string | null
    readonly terminationApprovedByKey: string | null
  }

  const assignmentSeeds: readonly AssignmentSeed[] = [
    {
      // Aus dem zugesagten Profilvorschlag der besetzten Anfrage.
      assignmentNumber: 'E-2026-0001',
      status: 'active',
      customerId: customer2.id,
      siteId: site3.id,
      costCenterId: costCenter3.id,
      supplierId: supplier2.id,
      candidateKey: 'ruth-s2',
      submissionNumber: 'PV-2026-0008',
      demandRequestNumber: 'BA-2026-0006',
      activityDescription:
        'Innerbetrieblicher Transport mit Frontstapler in der Nachtschicht, Zentrallager ' +
        'Herzberg, Tore 4 bis 9',
      plannedStartDate: day('2026-09-01'),
      plannedEndDate: day('2027-02-28'),
      actualStartDate: day('2026-09-01'),
      actualEndDate: null,
      weeklyHours: 40,
      shiftModel: 'Nachtschicht',
      agreedRateCardItemId: purchaseLagerS2,
      customerRateCardItemId: salesLagerK2,
      comparableWage: 17.85,
      terminationReason: null,
      terminationRequestedByKey: null,
      terminationApprovedByKey: null,
    },
    {
      // Zusage liegt vor, die Überlassung hat noch nicht begonnen.
      assignmentNumber: 'E-2026-0002',
      status: 'planned',
      customerId: customer2.id,
      siteId: site3.id,
      costCenterId: costCenter3.id,
      supplierId: supplier1.id,
      candidateKey: 'ilona-s1',
      submissionNumber: null,
      demandRequestNumber: 'BA-2026-0005',
      activityDescription:
        'Kommissionierung im Wareneingang mit Handscanner, Zentrallager Herzberg, Zone B',
      plannedStartDate: day('2027-02-15'),
      plannedEndDate: day('2027-08-31'),
      actualStartDate: null,
      actualEndDate: null,
      weeklyHours: 40,
      shiftModel: null,
      agreedRateCardItemId: purchaseHelferS1,
      customerRateCardItemId: salesLagerK2,
      comparableWage: 17.85,
      terminationReason: null,
      terminationRequestedByKey: null,
      terminationApprovedByKey: null,
    },
    {
      // Einsatz **ohne** vorangegangene Anfrage (3.7) — und mit laufender
      // Unterbrechung (4.3.1, `active` → `interrupted`).
      assignmentNumber: 'E-2026-0003',
      status: 'interrupted',
      customerId: customer1.id,
      siteId: site1.id,
      costCenterId: costCenter1.id,
      supplierId: supplier1.id,
      candidateKey: 'marek-s1',
      submissionNumber: null,
      demandRequestNumber: null,
      activityDescription:
        'Vormontage von Baugruppen an Station 7, Halle 2, Zweischichtbetrieb',
      plannedStartDate: day('2026-04-01'),
      plannedEndDate: day('2027-03-31'),
      actualStartDate: day('2026-04-01'),
      actualEndDate: null,
      weeklyHours: 38.5,
      shiftModel: 'Zweischicht',
      agreedRateCardItemId: purchaseHelferS1,
      customerRateCardItemId: salesHelferK1,
      comparableWage: 19.42,
      terminationReason: null,
      terminationRequestedByKey: null,
      terminationApprovedByKey: null,
    },
    {
      assignmentNumber: 'E-2026-0004',
      status: 'completed',
      customerId: customer1.id,
      siteId: site1.id,
      costCenterId: costCenter1.id,
      supplierId: supplier2.id,
      candidateKey: 'marek-s2',
      submissionNumber: null,
      demandRequestNumber: null,
      activityDescription: 'Zuführung von Material an die Montagelinie, Halle 2',
      plannedStartDate: day('2025-09-01'),
      plannedEndDate: day('2026-02-28'),
      actualStartDate: day('2025-09-01'),
      actualEndDate: day('2026-02-28'),
      weeklyHours: 38.5,
      shiftModel: null,
      agreedRateCardItemId: purchaseMetallS1,
      customerRateCardItemId: salesMetallK1,
      comparableWage: 19.42,
      terminationReason: null,
      terminationRequestedByKey: null,
      terminationApprovedByKey: null,
    },
    {
      // Vorzeitig beendet auf Antrag der **Kundenseite**, mit Genehmigung des
      // Genehmigers ([26], 4.3.1).
      assignmentNumber: 'E-2026-0005',
      status: 'terminatedEarly',
      customerId: customer1.id,
      siteId: site1.id,
      costCenterId: costCenter1.id,
      supplierId: supplier1.id,
      candidateKey: 'henrik-s1',
      submissionNumber: null,
      demandRequestNumber: null,
      activityDescription: 'Bedienung der CNC-Maschinen 3 und 4 in der Nachtschicht, Halle 2',
      plannedStartDate: day('2026-10-05'),
      plannedEndDate: day('2027-04-30'),
      actualStartDate: day('2026-10-05'),
      actualEndDate: day('2026-11-28'),
      weeklyHours: 38.5,
      shiftModel: 'Nachtschicht',
      agreedRateCardItemId: purchaseMetallS1,
      customerRateCardItemId: salesMetallK1,
      comparableWage: 19.42,
      terminationReason: 'Auftragsrückgang in der Nachtschicht; Bedarf entfallen',
      terminationRequestedByKey: 'demandOwner1',
      terminationApprovedByKey: 'approver1',
    },
  ]

  const assignmentIds = new Map<string, string>()
  for (const assignment of assignmentSeeds) {
    const candidate = await prisma.candidate.findUniqueOrThrow({
      where: { id: candidateId(assignment.candidateKey) },
    })
    const created = await prisma.assignment.create({
      data: {
        tenantId: tenantId('operator'),
        assignmentNumber: assignment.assignmentNumber,
        customerId: assignment.customerId,
        siteId: assignment.siteId,
        costCenterId: assignment.costCenterId,
        supplierId: assignment.supplierId,
        candidateId: candidate.id,
        // Pflicht ab `planned` (3.7) — und nur eine **bestätigte** Identität.
        workerIdentityId: candidate.workerIdentityId,
        demandRequestId:
          assignment.demandRequestNumber === null
            ? null
            : (demandIds.get(assignment.demandRequestNumber) ?? null),
        candidateSubmissionId:
          assignment.submissionNumber === null
            ? null
            : (submissionIds.get(assignment.submissionNumber) ?? null),
        activityDescription: assignment.activityDescription,
        plannedStartDate: assignment.plannedStartDate,
        plannedEndDate: assignment.plannedEndDate,
        actualStartDate: assignment.actualStartDate,
        actualEndDate: assignment.actualEndDate,
        weeklyHours: assignment.weeklyHours,
        shiftModel: assignment.shiftModel,
        agreedRateCardItemId: assignment.agreedRateCardItemId,
        customerRateCardItemId: assignment.customerRateCardItemId,
        currency: 'EUR',
        comparableWage: assignment.comparableWage,
        comparableWageCurrency: assignment.comparableWage === null ? null : 'EUR',
        terminationReason: assignment.terminationReason,
        terminationRequestedById:
          assignment.terminationRequestedByKey === null
            ? null
            : userId(assignment.terminationRequestedByKey),
        terminationRequestedAt:
          assignment.terminationRequestedByKey === null ? null : day('2026-11-10'),
        terminationApprovedById:
          assignment.terminationApprovedByKey === null
            ? null
            : userId(assignment.terminationApprovedByKey),
        terminationApprovedAt:
          assignment.terminationApprovedByKey === null ? null : day('2026-11-12'),
        status: assignment.status,
        createdById: userId('operatorCoordinator'),
        // K5 aus SPEC 5.3.3: die Konkretisierung muss **vor** dem ersten
        // Überlassungstag vorliegen, und 4.3.1 kennt genau einen Weg nach
        // `planned` — der Einsatz entsteht dort, `createdAt` ist also der Tag
        // dieses Übergangs. Ein Einsatz, der vor dem Stichtag dieser
        // Demonstrationsdaten begann, ist deshalb auch vorher angelegt: sonst
        // wäre er erst nach seinem eigenen Beginn konkretisiert, und das ist
        // ein Verstoß gegen § 1 Abs. 1 Sätze 5 und 6 AÜG.
        createdAt: frueherer(SEED_DATE, assignment.actualStartDate ?? assignment.plannedStartDate),
      },
    })
    assignmentIds.set(assignment.assignmentNumber, created.id)
  }

  const assignmentId = (number: string): string => {
    const id = assignmentIds.get(number)
    if (id === undefined) throw new Error(`Einsatz ${number} fehlt`)
    return id
  }

  // Unterbrechungen (3.7). Eine läuft noch — sie trägt den Einsatz in
  // `interrupted` —, eine ist beendet und zeigt die Rückkehr nach `active`.
  // `countsAsReset` bleibt **leer**: das rechnet P2 in 5.1 (3.0, Festlegung 3).
  await prisma.assignmentInterruption.create({
    data: {
      assignmentId: assignmentId('E-2026-0003'),
      // Offen und **über drei Monate**: N6 stellt fest, dass die Zählung mit
      // der Wiederaufnahme zurückgesetzt wird (5.1.4). Der Lauf setzt sie
      // nicht selbst zurück — das ist der Übergang `interrupted` → `active`.
      interruptionFrom: day('2026-07-25'),
      reasonCategory: 'Betriebsruhe beim Entleiher',
      reasonText: 'Umbau Halle 2; Wiederaufnahme noch offen',
      createdById: userId('operatorCoordinator'),
      createdAt: SEED_DATE,
    },
  })

  await prisma.assignmentInterruption.create({
    data: {
      assignmentId: assignmentId('E-2026-0003'),
      interruptionFrom: day('2026-07-01'),
      interruptionTo: day('2026-07-21'),
      reasonCategory: 'Betriebsruhe beim Entleiher',
      reasonText: 'Werksferien; danach fortgesetzt',
      createdById: userId('operatorCoordinator'),
      createdAt: SEED_DATE,
    },
  })

  // ── Nachweise (3.10) zu den Einsätzen und zum Kandidaten ─────────────────
  //
  // Der Pflichtkatalog aus 5.4.4 entscheidet, welche Art Pflicht ist: die
  // **Unterweisung** dort, wo der Standort sie verlangt (`safetyBriefingRequired`,
  // 3.1), die **Arbeitserlaubnis** dort, wo der Kandidat sie braucht
  // (`workPermitRequired`, 3.6). Beide sperren den Einsatzstart (Q21). Die
  // Beispieldaten führen sie deshalb, wo sie Pflicht sind — eine Lage ohne sie
  // wäre kein Demonstrationsstand, sondern der Fall, den P10 verhindert.
  //
  // Eine der drei trägt ein **Enddatum**, das bald erreicht ist: nur dann hat
  // der nächtliche Lauf etwas zu melden (N5), und nur dann ist an echten Daten
  // zu sehen, dass die Stufe aus der Restzeit kommt (5.4.4).
  //
  // Eine zweite ist **vor dem Ende ihres Einsatzes abgelaufen**: E-2026-0005
  // lief bis zum 28.11., die Unterweisung deckt nur bis zum 31.10. Damit ist
  // die Warnung aus **Q37** an echten Daten zu sehen — die Genehmigung eines
  // Novemberzettels findet statt und meldet den Mangel an `KB` und `LD`
  // (4.7, 5.4.4). Ohne diesen Fall bliebe die Zeile eine Zusicherung, die man
  // nur im Test sieht.
  const unterweisungen: ReadonlyArray<readonly [string, string, string | null]> = [
    ['E-2026-0003', '2026-04-01', '2026-11-25'],
    ['E-2026-0004', '2025-09-01', null],
    ['E-2026-0005', '2026-10-05', '2026-10-31'],
  ]
  for (const [nummer, ab, bis] of unterweisungen) {
    await prisma.document.create({
      data: {
        // **Der Mandant folgt dem Bezugsobjekt** (3.10). Die Unterweisung
        // hängt am Einsatz, und der Einsatz gehört dem Betreiber (3.7) — auch
        // wenn der Kunde sie durchgeführt und eingestellt hat. Dass er sie
        // sieht, trägt die Sichtbarkeitsklasse ([35]), nicht der Mandant.
        tenantId: tenantId('operator'),
        documentNumber: `DOK-UW-${nummer}`,
        documentCategory: 'safetyBriefing',
        subjectType: 'assignment',
        assignmentId: assignmentId(nummer),
        issuer: 'Nordwerk Metall GmbH, Fachkraft für Arbeitssicherheit',
        issuedOn: day(ab),
        validFrom: day(ab),
        validTo: bis === null ? null : day(bis),
        fileRef: `ablage://beispiel/unterweisung/${nummer}`,
        fileName: `Unterweisung_${nummer}.pdf`,
        mimeType: 'application/pdf',
        uploadedAt: day(ab),
        uploadedById: userId('demandOwner1'),
        verificationStatus: 'accepted',
        verifiedAt: day(ab),
        verifiedById: userId('operatorCoordinator'),
        // Einsatzbezogener Nachweis: Kunde und Lieferant sehen ihn ([35]).
        confidentiality: 'assignmentParties',
        createdById: userId('demandOwner1'),
        createdAt: SEED_DATE,
      },
    })
  }

  // Die Arbeitserlaubnis des einen Kandidaten, der sie braucht. Nach 6.4 wird
  // **nur Vorliegen und Gültigkeit** geführt — kein Inhalt (3.10).
  await prisma.document.create({
    data: {
      tenantId: tenantId('supplier1'),
      documentNumber: 'DOK-AE-2001-4',
      documentCategory: 'workPermit',
      subjectType: 'candidate',
      candidateId: candidateId('tomas-s1'),
      issuer: 'Ausländerbehörde (Beispiel)',
      issuedOn: day('2025-11-01'),
      validFrom: day('2025-11-15'),
      validTo: day('2027-11-14'),
      fileRef: 'ablage://beispiel/arbeitserlaubnis/K-L-2001-4',
      fileName: 'Arbeitserlaubnis_K-L-2001-4.pdf',
      mimeType: 'application/pdf',
      uploadedAt: day('2025-11-05'),
      uploadedById: userId('supplierAdmin1'),
      verificationStatus: 'accepted',
      verifiedAt: day('2025-11-06'),
      verifiedById: userId('operatorCoordinator'),
      confidentiality: 'operatorAndOwner',
      createdById: userId('supplierAdmin1'),
      createdAt: SEED_DATE,
    },
  })

  // ── Verlängerungen: je ein Zustand aus 4.3.2 ─────────────────────────────
  //
  // Die wirksame Verlängerung hat `plannedEndDate` des Einsatzes E-2026-0001
  // schon verschoben — das ist ihre Wirkung, und der Einsatz bleibt dabei
  // `active` (4.3.1).
  interface ExtensionSeed {
    readonly assignmentNumber: string
    readonly status: 'requested' | 'approved' | 'rejected' | 'effective' | 'withdrawn'
    readonly newEndDate: Date
    readonly reason: string
    readonly requestedByKey: string
    readonly requestedAt: Date
    readonly approvedByKey: string | null
    readonly approvedAt: Date | null
    readonly effectiveByKey: string | null
    readonly effectiveAt: Date | null
    readonly rejectionReason: string | null
    readonly withdrawnAt: Date | null
  }

  const extensionSeeds: readonly ExtensionSeed[] = [
    {
      assignmentNumber: 'E-2026-0001',
      status: 'effective',
      newEndDate: day('2027-02-28'),
      reason: 'Nachtschicht bleibt bis Ende Februar besetzt',
      requestedByKey: 'demandOwner2',
      requestedAt: day('2026-10-01'),
      approvedByKey: 'approver2',
      approvedAt: day('2026-10-03'),
      effectiveByKey: 'operatorCoordinator',
      effectiveAt: day('2026-10-04'),
      rejectionReason: null,
      withdrawnAt: null,
    },
    {
      assignmentNumber: 'E-2026-0001',
      status: 'requested',
      newEndDate: day('2027-06-30'),
      reason: 'Anschlussbedarf im Zentrallager absehbar',
      requestedByKey: 'supplierCoordinator2',
      requestedAt: day('2026-12-20'),
      approvedByKey: null,
      approvedAt: null,
      effectiveByKey: null,
      effectiveAt: null,
      rejectionReason: null,
      withdrawnAt: null,
    },
    {
      // Genehmigt, aber noch nicht wirksam — und genau das ist ein eigener
      // Zustand: ohne `MD` verschiebt sich nichts (4.3.2).
      assignmentNumber: 'E-2026-0003',
      status: 'approved',
      newEndDate: day('2027-09-30'),
      reason: 'Montagelinie läuft länger als geplant',
      requestedByKey: 'demandOwner1',
      requestedAt: day('2026-11-15'),
      approvedByKey: 'approver1',
      approvedAt: day('2026-11-18'),
      effectiveByKey: null,
      effectiveAt: null,
      rejectionReason: null,
      withdrawnAt: null,
    },
    {
      assignmentNumber: 'E-2026-0003',
      status: 'rejected',
      newEndDate: day('2028-03-31'),
      reason: 'Langfristige Verlängerung angefragt',
      requestedByKey: 'supplierCoordinator1',
      requestedAt: day('2026-10-20'),
      approvedByKey: null,
      approvedAt: null,
      effectiveByKey: null,
      effectiveAt: null,
      rejectionReason:
        'Laufzeit über die geplante Linienumstellung hinaus; Bedarf dann nicht gesichert',
      withdrawnAt: null,
    },
    {
      assignmentNumber: 'E-2026-0002',
      status: 'withdrawn',
      newEndDate: day('2027-12-31'),
      reason: 'Verlängerung vorsorglich beantragt',
      requestedByKey: 'demandOwner2',
      requestedAt: day('2026-12-05'),
      approvedByKey: null,
      approvedAt: null,
      effectiveByKey: null,
      effectiveAt: null,
      rejectionReason: null,
      withdrawnAt: day('2026-12-08'),
    },
  ]

  for (const extension of extensionSeeds) {
    await prisma.assignmentExtension.create({
      data: {
        assignmentId: assignmentId(extension.assignmentNumber),
        newEndDate: extension.newEndDate,
        reason: extension.reason,
        requestedAt: extension.requestedAt,
        requestedById: userId(extension.requestedByKey),
        approvedAt: extension.approvedAt,
        approvedById:
          extension.approvedByKey === null ? null : userId(extension.approvedByKey),
        effectiveAt: extension.effectiveAt,
        effectiveById:
          extension.effectiveByKey === null ? null : userId(extension.effectiveByKey),
        rejectionReason: extension.rejectionReason,
        withdrawnAt: extension.withdrawnAt,
        status: extension.status,
        createdById: userId(extension.requestedByKey),
        createdAt: SEED_DATE,
      },
    })
  }

  // ── Zuschlagsarten und Abrechnungsperiode (3.8, 3.9) ─────────────────────
  //
  // Der Katalog ist **Konfiguration** (CLAUDE.md): Zeitfenster und Wochentage
  // stehen als Daten, nicht als Konstanten im Code. Die `derivationBasis`
  // entscheidet, ob ein Zuschlag an einer Position abgeleitet werden kann
  // (3.8, Entscheidung zu Frage 16) — der Feiertagszuschlag bleibt ohne
  // Kalender (offene Frage 51) bewusst ohne Wochentage und damit nicht
  // ableitbar.
  const premiumTypes: readonly {
    readonly code: string
    readonly name: string
    readonly appliesTo: 'night' | 'sunday' | 'publicHoliday' | 'overtime' | 'hardship'
    readonly derivationBasis: 'timeOfDay' | 'calendarDay' | 'weeklyTotal' | 'manual'
    readonly defaultValue: string
    readonly legalBasis: 'statutory' | 'collectiveAgreement' | 'contractual'
    readonly fromMinute?: number
    readonly toMinute?: number
    readonly weekdays?: readonly number[]
  }[] = [
    {
      code: 'NACHT',
      name: 'Nachtzuschlag 23:00 bis 06:00',
      appliesTo: 'night',
      derivationBasis: 'timeOfDay',
      defaultValue: '25.0000',
      legalBasis: 'collectiveAgreement',
      fromMinute: 23 * 60,
      toMinute: 6 * 60,
    },
    {
      code: 'SONNTAG',
      name: 'Sonntagszuschlag',
      appliesTo: 'sunday',
      derivationBasis: 'calendarDay',
      defaultValue: '50.0000',
      legalBasis: 'collectiveAgreement',
      weekdays: [0],
    },
    {
      code: 'FEIERTAG',
      name: 'Feiertagszuschlag',
      appliesTo: 'publicHoliday',
      derivationBasis: 'calendarDay',
      defaultValue: '100.0000',
      legalBasis: 'collectiveAgreement',
      // Kein Feiertagskalender in Kapitel 3 (offene Frage 51): ohne Wochentage
      // bleibt dieser Zuschlag nicht ableitbar und damit `declared`.
      weekdays: [],
    },
    {
      code: 'UEBER',
      name: 'Überstundenzuschlag',
      appliesTo: 'overtime',
      derivationBasis: 'weeklyTotal',
      defaultValue: '25.0000',
      legalBasis: 'collectiveAgreement',
    },
    {
      code: 'ERSCH',
      name: 'Erschwerniszuschlag',
      appliesTo: 'hardship',
      derivationBasis: 'manual',
      defaultValue: '1.5000',
      legalBasis: 'contractual',
    },
  ]
  for (const art of premiumTypes) {
    await prisma.premiumType.create({
      data: {
        tenantId: tenantId('operator'),
        code: art.code,
        name: art.name,
        calculationBase: art.code === 'ERSCH' ? 'absolute' : 'percentage',
        defaultValue: art.defaultValue,
        appliesTo: art.appliesTo,
        derivationBasis: art.derivationBasis,
        legalBasis: art.legalBasis,
        fromMinute: art.fromMinute ?? null,
        toMinute: art.toMinute ?? null,
        weekdays: [...(art.weekdays ?? [])],
        validFrom: new Date('2025-01-01T00:00:00.000Z'),
        createdById: operatorAdminId,
        createdAt: SEED_DATE,
      },
    })
  }

  // ── Zuschlagssätze in den Preislisten (3.3) ──────────────────────────────
  //
  // Erst hier, weil die Preisposition die **Zuschlagsart** verweist (3.3: „1
  // Zuschlagsart : n Preispositionen") und der Katalog gerade entstanden ist.
  // Ohne diese Sätze entsteht kein Beleg über einen Zuschlag: 4.5.2 macht die
  // Preisposition der jeweiligen Seite zur Vorbedingung, und der
  // Vorbelegungswert der Zuschlagsart tritt **nicht** an ihre Stelle — er ist
  // keine Vereinbarung zwischen den Parteien.
  //
  // Kunden- und Einkaufsseite tragen **verschiedene** Werte; die Differenz ist
  // die Marge des Betreibers und für beide Gegenseiten unsichtbar ([41], [42]).
  const zuschlagssaetze: readonly {
    readonly code: string
    readonly kunde: string
    readonly lieferant: string
  }[] = [
    { code: 'NACHT', kunde: '25.0000', lieferant: '20.0000' },
    { code: 'SONNTAG', kunde: '55.0000', lieferant: '50.0000' },
    { code: 'FEIERTAG', kunde: '110.0000', lieferant: '100.0000' },
    { code: 'UEBER', kunde: '30.0000', lieferant: '25.0000' },
    // Erschwernis rechnet absolut (3.8): ein Betrag je Stunde, kein Prozentsatz.
    { code: 'ERSCH', kunde: '2.0000', lieferant: '1.5000' },
  ]
  for (const satz of zuschlagssaetze) {
    const art = await prisma.premiumType.findUniqueOrThrow({ where: { code: satz.code } })
    for (const preisliste of await prisma.rateCard.findMany()) {
      await prisma.rateCardItem.create({
        data: {
          rateCardId: preisliste.id,
          itemType: 'premiumRate',
          premiumTypeId: art.id,
          premiumValue:
            preisliste.rateCardScope === 'customerRateCard' ? satz.kunde : satz.lieferant,
          createdById: operatorAdminId,
          createdAt: SEED_DATE,
        },
      })
    }
  }

  // Die Nummernkreise der Belege (3.9) auf null stellen: der Seed setzt den
  // Bestand zurück, und eine weiterzählende Nummer wäre eine Lücke in einem
  // Kreis, dessen Belege es nicht mehr gibt.
  for (const documentType of ['customerInvoice', 'supplierCreditNote', 'supplierInvoice'] as const) {
    await prisma.billingNumberRange.upsert({
      where: { documentType },
      update: { lastNumber: 0 },
      create: { documentType, lastNumber: 0 },
    })
  }

  // Zwei offene Perioden, damit ein Zettel anzulegen ist (3.9). Das Schließen
  // steht seit der Abrechnung (4.5.1); es verlangt, dass **jeder** Zettel der
  // Periode entschieden und **jeder** Beleg abgegeben ist (offene Frage 24).
  for (const periode of [
    {
      periodNumber: '2026-10',
      periodFrom: new Date('2026-10-01T00:00:00.000Z'),
      periodTo: new Date('2026-10-31T00:00:00.000Z'),
      closingDate: new Date('2026-11-10T00:00:00.000Z'),
    },
    {
      periodNumber: '2026-11',
      periodFrom: new Date('2026-11-01T00:00:00.000Z'),
      periodTo: new Date('2026-11-30T00:00:00.000Z'),
      closingDate: new Date('2026-12-10T00:00:00.000Z'),
    },
  ]) {
    await prisma.billingPeriod.create({
      data: {
        tenantId: tenantId('operator'),
        periodNumber: periode.periodNumber,
        periodFrom: periode.periodFrom,
        periodTo: periode.periodTo,
        closingDate: periode.closingDate,
        status: 'open',
        openedAt: SEED_DATE,
        openedById: operatorAdminId,
        createdById: operatorAdminId,
        createdAt: SEED_DATE,
      },
    })
  }

  // Eine **eigene** Stufenfolge für den zweiten Kunden (3.1, Entscheidung zu
  // Frage 5): Genehmiger, dann Betreiber. Der erste Kunde bleibt ohne
  // Konfiguration und fährt damit auf der Vorbelegung aus 4.4 — so ist beides
  // in der Oberfläche zu sehen, die Konfiguration und ihr Ausbleiben.
  for (const [index, roleCode] of (['approver', 'operatorCoordinator'] as const).entries()) {
    await prisma.customerTimesheetApprovalStage.create({
      data: {
        customerId: customer2.id,
        level: index + 1,
        roleCode,
        createdById: operatorAdminId,
        createdAt: SEED_DATE,
      },
    })
  }

  // ── Abgeleitete Fristenfelder am Einsatz (3.7, 5.1.3, 5.2.3) ────────────
  //
  // 3.7 führt `maxDurationEndDate`, `countedDurationDays` und
  // `equalPayDueDate` als **abgeleitet**: sie sind Ergebnisse des Regelwerks
  // und werden an den Übergängen des Einsatzes fortgeschrieben. Der Seed legt
  // die Einsätze direkt an und umgeht diese Übergänge — ohne diesen Schritt
  // stünden die Felder leer, und ein aktiver Einsatz ohne Fristenstand ist
  // nach 3.7 ein Datenfehler. Der nächtliche Lauf (5.5.1) läse ihn als
  // „nichts zu prüfen", und die Demo zeigte eine Ruhe, die es nicht gibt.
  //
  // Gerechnet wird mit denselben Rechenwegen wie im Dienst, über die Kette
  // aller Einsätze **derselben Person beim selben Kunden** (5.1.3).
  const alleEinsaetze = await prisma.assignment.findMany({
    include: { customer: { select: { legalName: true } }, interruptions: true },
  })
  const alleTarifzuordnungen = await prisma.collectiveAgreementAssignment.findMany()
  const zuordnungszeilen = alleTarifzuordnungen.map((zuordnung) => ({
    appliesToType: zuordnung.appliesToType,
    customerId: zuordnung.customerId,
    siteId: zuordnung.siteId,
    supplierId: zuordnung.supplierId,
    validFrom: zuordnung.validFrom,
    validTo: zuordnung.validTo,
    maxAssignmentDurationMonths: zuordnung.maxAssignmentDurationMonths,
    equalPayDeadlineMonths: zuordnung.equalPayDeadlineMonths,
    industryPremiumScheme: zuordnung.industryPremiumScheme,
  }))
  for (const einsatz of alleEinsaetze) {
    const kette = alleEinsaetze
      .filter(
        (zeile) =>
          zeile.customerId === einsatz.customerId &&
          zeile.workerIdentityId !== null &&
          zeile.workerIdentityId === einsatz.workerIdentityId,
      )
      .map((zeile) => ({
        id: zeile.id,
        customerId: zeile.customerId,
        supplierId: zeile.supplierId,
        plannedStartDate: zeile.plannedStartDate,
        plannedEndDate: zeile.plannedEndDate,
        actualStartDate: zeile.actualStartDate,
        actualEndDate: zeile.actualEndDate,
        status: zeile.status,
        // Eine zählwirksame Unterbrechung setzt die Kette zurück (5.1.4) —
        // sie gehört deshalb in die Eingangsdaten, nicht neben sie.
        interruptions: zeile.interruptions.map((unterbrechung) => ({
          interruptionFrom: unterbrechung.interruptionFrom,
          interruptionTo: unterbrechung.interruptionTo,
        })),
      }))
    if (kette.length === 0) continue

    const ersterTag = einsatz.actualStartDate ?? einsatz.plannedStartDate
    const dauer = hoechstdauerstand({
      einsaetze: kette,
      kunde: einsatz.customer.legalName,
      tarifzuordnungen: zuordnungszeilen,
      stichtag: ersterTag,
      zeitraum: null,
      identitaetBestaetigt: einsatz.workerIdentityId !== null,
    })
    const equalPay = equalPaystand({
      einsaetze: kette,
      kunde: einsatz.customer.legalName,
      verleiherzuordnungen: zuordnungszeilen.filter(
        (zuordnung) => zuordnung.supplierId === einsatz.supplierId,
      ),
      stichtag: ersterTag,
      zeitraum: null,
      ersterUeberlassungstag: ersterTag,
      vergleichsentgeltGesetzt: einsatz.comparableWage !== null,
      identitaetBestaetigt: einsatz.workerIdentityId !== null,
    })
    await prisma.assignment.update({
      where: { id: einsatz.id },
      data: {
        maxDurationEndDate: dauer.maxDurationEndDate,
        countedDurationDays: dauer.countedDurationDays,
        equalPayDueDate: equalPay.equalPayDueDate,
      },
    })
  }

  // ── Mandantenverweis nachtragen und prüfen (3.11) ────────────────────────
  //
  // `organizationRef` ist Pflicht außer beim Betreiber. Der Verweis ist
  // polymorph (Kunde oder Lieferant) und deshalb ein Skalar; die Invariante
  // wird jetzt **erzwungen** — die Lücke aus der vorigen Arbeitseinheit ist
  // damit geschlossen.
  const organizationByTenant: readonly { readonly tenantKey: string; readonly id: string }[] = [
    { tenantKey: 'customer1', id: customer1.id },
    { tenantKey: 'customer2', id: customer2.id },
    { tenantKey: 'supplier1', id: supplier1.id },
    { tenantKey: 'supplier2', id: supplier2.id },
  ]
  for (const entry of organizationByTenant) {
    await prisma.tenant.update({
      where: { id: tenantId(entry.tenantKey) },
      data: { organizationId: entry.id },
    })
  }
  for (const tenant of await prisma.tenant.findMany()) {
    assertOrganizationRefPresent(
      {
        id: tenant.tenantNumber,
        tenantType: tenant.tenantType,
        organizationId: tenant.organizationId,
      },
      { enforce: true },
    )
  }

  const counts = {
    Mandanten: await prisma.tenant.count(),
    Benutzer: await prisma.user.count(),
    Rollenzuweisungen: await prisma.roleAssignment.count(),
    Betreuungszuordnungen: await prisma.accountAssignment.count(),
    Zuständigkeiten: await prisma.responsibilityScope.count(),
    Vertretungen: await prisma.delegation.count(),
    Kunden: await prisma.customer.count(),
    Standorte: await prisma.site.count(),
    Kostenstellen: await prisma.costCenter.count(),
    Lieferanten: await prisma.supplier.count(),
    'AÜG-Erlaubnisse': await prisma.supplierPermit.count(),
    Rahmenverträge: await prisma.masterAgreement.count(),
    Preislisten: await prisma.rateCard.count(),
    Preispositionen: await prisma.rateCardItem.count(),
    Tarifzuordnungen: await prisma.collectiveAgreementAssignment.count(),
    Vergleichsentgelte: await prisma.comparableWageEntry.count(),
    Bedarfsanfragen: await prisma.demandRequest.count(),
    Ausschreibungen: await prisma.tender.count(),
    Einladungen: await prisma.tenderInvitation.count(),
    Lieferantenangebote: await prisma.supplierOffer.count(),
    Kandidaten: await prisma.candidate.count(),
    Personenidentitäten: await prisma.workerIdentity.count(),
    'Verknüpfungen (bestätigt)': await prisma.workerIdentityLink.count({
      where: { linkStatus: 'confirmed' },
    }),
    'Verknüpfungen (nur vorgeschlagen)': await prisma.workerIdentityLink.count({
      where: { linkStatus: 'proposed' },
    }),
    Verknüpfungshistorie: await prisma.workerIdentityMergeEntry.count(),
    Profilvorschläge: await prisma.candidateSubmission.count(),
    Einsätze: await prisma.assignment.count(),
    Verlängerungen: await prisma.assignmentExtension.count(),
    Unterbrechungen: await prisma.assignmentInterruption.count(),
    'Nachweise (3.10)': await prisma.document.count(),
    'Zuschlagsarten (3.8)': await prisma.premiumType.count(),
    'Abrechnungsperioden (3.9)': await prisma.billingPeriod.count(),
    'Abrechnungsbelege (3.9)': await prisma.billingDocument.count(),
    'Benachrichtigungen (3.14)': await prisma.notification.count(),
    'Freigabestufen je Kunde (3.1)': await prisma.customerTimesheetApprovalStage.count(),
  }
  console.log('Synthetische Demo-Daten angelegt:', counts)
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (error: unknown) => {
    console.error(error)
    await prisma.$disconnect()
    process.exit(1)
  })
