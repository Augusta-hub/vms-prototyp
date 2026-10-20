/**
 * Synthetische Demo-Daten für Mandanten, Benutzer und Rollen (SPEC 3.11).
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
 * Bestand: ein Betreiber, zwei Kunden, zwei Lieferanten, je ein Benutzer pro
 * Rolle. Dazu eine Betreuungszuordnung (der MSP-Disponent betreut nur Kunde 1)
 * und eine Vertretung (der Genehmiger wird im Urlaub vertreten), damit die
 * Regeln aus 2.3 und 2.4 in der Demo sichtbar sind.
 */
import { PrismaClient, type RoleCode, type TenantType } from '@prisma/client'
import { assertSingleOperatorTenant } from '../lib/tenants/invariants'

const prisma = new PrismaClient()

/** Stichtag der Demo-Daten: fest, damit Zeiträume reproduzierbar bleiben. */
const SEED_DATE = new Date('2026-01-01T00:00:00.000Z')

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
  {
    key: 'customer1',
    tenantNumber: 'M-1001',
    tenantType: 'customer',
    displayName: 'Nordwerk Metall GmbH',
  },
  {
    key: 'customer2',
    tenantNumber: 'M-1002',
    tenantType: 'customer',
    displayName: 'Südharz Logistik GmbH',
  },
  {
    key: 'supplier1',
    tenantNumber: 'M-2001',
    tenantType: 'supplier',
    displayName: 'Rheinpersonal GmbH',
  },
  {
    key: 'supplier2',
    tenantNumber: 'M-2002',
    tenantType: 'supplier',
    displayName: 'Elbe Zeitarbeit GmbH',
  },
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
    key: 'demandOwner',
    tenantKey: 'customer1',
    userNumber: 'B-1001',
    givenName: 'Sonja',
    familyName: 'Hellwig',
    loginIdentifier: 'sonja.hellwig@nordwerk-metall.example',
    roleCode: 'demandOwner',
  },
  {
    key: 'approver',
    tenantKey: 'customer1',
    userNumber: 'B-1002',
    givenName: 'Detlef',
    familyName: 'Wiegand',
    loginIdentifier: 'detlef.wiegand@nordwerk-metall.example',
    roleCode: 'approver',
  },
  {
    key: 'procurementController',
    tenantKey: 'customer2',
    userNumber: 'B-1003',
    givenName: 'Carola',
    familyName: 'Steinbach',
    loginIdentifier: 'carola.steinbach@suedharz-logistik.example',
    roleCode: 'procurementController',
  },
  {
    key: 'supplierCoordinator',
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
    key: 'supplierAdmin',
    tenantKey: 'supplier2',
    userNumber: 'B-2003',
    givenName: 'Pia',
    familyName: 'Lohmann',
    loginIdentifier: 'pia.lohmann@elbe-zeitarbeit.example',
    roleCode: 'supplierAdmin',
  },
]

async function main(): Promise<void> {
  assertSingleOperatorTenant(TENANTS.map((tenant) => ({ id: tenant.key, tenantType: tenant.tenantType })))

  // Leeren in umgekehrter Abhängigkeitsreihenfolge, damit der Seed
  // wiederholbar bleibt. Nur Entwicklungsdaten, nie Echtdaten (CLAUDE.md).
  await prisma.delegation.deleteMany()
  await prisma.accountAssignment.deleteMany()
  await prisma.responsibilityScope.deleteMany()
  await prisma.roleAssignment.deleteMany()
  await prisma.user.deleteMany()
  await prisma.tenant.deleteMany()

  const tenantIds = new Map<string, string>()
  for (const tenant of TENANTS) {
    const created = await prisma.tenant.create({
      data: {
        tenantNumber: tenant.tenantNumber,
        tenantType: tenant.tenantType,
        displayName: tenant.displayName,
        // organizationId bleibt leer: Kunde (3.1) und Lieferant (3.2) sind
        // noch nicht modelliert.
        createdAt: SEED_DATE,
      },
    })
    tenantIds.set(tenant.key, created.id)
  }

  // Der erste Benutzer entsteht mit der Einrichtung des Systems und hat
  // deshalb keinen anlegenden Benutzer (`createdById` bleibt leer).
  const userIds = new Map<string, string>()
  for (const user of USERS) {
    const tenantId = tenantIds.get(user.tenantKey)
    if (tenantId === undefined) throw new Error(`Unbekannter Mandant: ${user.tenantKey}`)
    const created = await prisma.user.create({
      data: {
        userNumber: user.userNumber,
        tenantId,
        loginIdentifier: user.loginIdentifier,
        givenName: user.givenName,
        familyName: user.familyName,
        language: 'de',
        createdAt: SEED_DATE,
      },
    })
    userIds.set(user.key, created.id)
  }

  const operatorAdminId = userIds.get('operatorAdmin')
  if (operatorAdminId === undefined) throw new Error('Betreiberadministrator fehlt')

  // Rollenzuweisungen. Vergeben vom Betreiberadministrator; für die
  // Lieferantenorganisation wäre es nach Fußnote [7] der LA — im Seed bleibt
  // es der MA, weil die Einrichtung vom Betreiber ausgeht.
  const roleAssignmentIds = new Map<string, string>()
  for (const user of USERS) {
    const userId = userIds.get(user.key)
    const tenantId = tenantIds.get(user.tenantKey)
    if (userId === undefined || tenantId === undefined) continue
    const assignment = await prisma.roleAssignment.create({
      data: {
        userId,
        roleCode: user.roleCode,
        tenantId,
        validFrom: SEED_DATE,
        grantedById: operatorAdminId,
        createdById: operatorAdminId,
        createdAt: SEED_DATE,
      },
    })
    roleAssignmentIds.set(user.key, assignment.id)
  }

  // Betreuungszuordnung (3.11): der MSP-Disponent betreut nur Kunde 1. Der
  // Betreiberadministrator bekommt keine — das ist die bewusste Entscheidung
  // für die vollständige Querschnittssicht (2.3) und Gegenstand des
  // Berechtigungsreviews.
  const coordinatorId = userIds.get('operatorCoordinator')
  const customer1Id = tenantIds.get('customer1')
  if (coordinatorId !== undefined && customer1Id !== undefined) {
    await prisma.accountAssignment.create({
      data: {
        userId: coordinatorId,
        customerTenantId: customer1Id,
        validFrom: SEED_DATE,
        createdById: operatorAdminId,
        createdAt: SEED_DATE,
      },
    })
  }

  // Vertretung (2.4): der Genehmiger bei Kunde 1 wird im Februar 2026 vom
  // Bedarfsträger desselben Kunden vertreten — befristet, personenbezogen,
  // innerhalb einer Organisation. Eingerichtet vom Rolleninhaber selbst
  // (geplante Abwesenheit, Fußnote [45]).
  const approverAssignmentId = roleAssignmentIds.get('approver')
  const approverUserId = userIds.get('approver')
  const demandOwnerId = userIds.get('demandOwner')
  if (
    approverAssignmentId !== undefined &&
    approverUserId !== undefined &&
    demandOwnerId !== undefined &&
    customer1Id !== undefined
  ) {
    await prisma.delegation.create({
      data: {
        delegatedRoleAssignmentId: approverAssignmentId,
        delegateUserId: demandOwnerId,
        tenantId: customer1Id,
        periodFrom: new Date('2026-02-09T00:00:00.000Z'),
        periodTo: new Date('2026-02-20T23:59:59.000Z'),
        reason: 'Urlaub',
        createdById: approverUserId,
        createdAt: SEED_DATE,
      },
    })
  }

  const counts = {
    Mandanten: await prisma.tenant.count(),
    Benutzer: await prisma.user.count(),
    Rollenzuweisungen: await prisma.roleAssignment.count(),
    Betreuungszuordnungen: await prisma.accountAssignment.count(),
    Vertretungen: await prisma.delegation.count(),
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
