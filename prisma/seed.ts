/**
 * Synthetische Demo-Daten — SPEC 3.1 bis 3.5 und 3.11.
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
 * Preislisten **beider** Seiten, Tarifzuordnungen, Vergleichsentgelte und je
 * eine Bedarfsanfrage pro Zustand aus 4.1.
 *
 * **Zu den Zuständen:** `draft`, `submitted`, `approved`, `tendered`,
 * `cancelled` und `expired` entstehen hier als Daten in genau dem Zustand, den
 * 4.1 beschreibt. `inSelection` und `filled` setzen den Profilvorschlag (3.6)
 * und den Einsatz (3.7) voraus; beide Objekte sind noch nicht modelliert. Die
 * beiden Anfragen tragen den Zustand deshalb **als Seed-Datum**, nicht über
 * einen Übergang — über die Oberfläche sind sie bis 3.6/3.7 nicht erreichbar.
 * Der Seed legt Daten an und ist kein Weg um Kapitel 4 herum: die
 * Statusmodelle in lib/status/ bleiben die einzige Stelle, an der ein Zustand
 * **wechselt**.
 */
import { PrismaClient, type RoleCode, type TenantType } from '@prisma/client'
import {
  assertOrganizationRefPresent,
  assertSingleOperatorTenant,
} from '../lib/tenants/invariants'

const prisma = new PrismaClient()

/** Stichtag der Demo-Daten: fest, damit Zeiträume reproduzierbar bleiben. */
const SEED_DATE = new Date('2026-01-01T00:00:00.000Z')
const day = (iso: string): Date => new Date(`${iso}T00:00:00.000Z`)
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
  // jeder Einladung (4.2.1, Prüfung P9 in 5.4). Die Urkunde selbst ist ein
  // Dokument nach 3.10 und noch nicht modelliert; der Verweis bleibt leer.
  await prisma.supplierPermit.create({
    data: {
      tenantId: supplier1.tenantId,
      supplierId: supplier1.id,
      permitNumber: 'AZ-2024-0815',
      issuingAuthority: 'Agentur für Arbeit Düsseldorf',
      permitType: 'unlimited',
      issuedOn: day('2024-02-01'),
      validFrom: day('2024-02-01'),
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
      validTo: day('2027-06-30'),
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
  // statt 18 (5.1) und 15 Monate Equal-Pay-Frist statt 9 (5.2) — genau die
  // Parameter, die 3.3 am Zuordnungsobjekt führt.
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
          {
            itemType: 'premiumRate',
            premiumTypeRef: 'Nachtzuschlag',
            premiumValue: 25,
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
