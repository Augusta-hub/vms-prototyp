/**
 * Tests zu den wirksamen Rechten und den Vertretungsregeln aus SPEC 2.4.
 *
 * Geprüft wird, was `buildSubject` aus Daten macht: befristet,
 * personenbezogen, nur innerhalb einer Organisation, keine Ketten, keine
 * Rechteerweiterung.
 */
import { describe, expect, it } from 'vitest'
import {
  buildSubject,
  delegationViolations,
  type DelegationRecord,
  type GrantInput,
  type RoleAssignmentRecord,
  type TenantRecord,
  type UserRecord,
} from './grants'

const CUSTOMER_TENANT = 'tenant-customer-1'
const OTHER_CUSTOMER_TENANT = 'tenant-customer-2'

const STICHTAG = new Date('2026-06-15T10:00:00.000Z')

const customerTenant: TenantRecord = {
  id: CUSTOMER_TENANT,
  tenantType: 'customer',
  deactivatedAt: null,
}

const delegateUser: UserRecord = {
  id: 'user-delegate',
  tenantId: CUSTOMER_TENANT,
  deactivatedAt: null,
}

const approverAssignment: RoleAssignmentRecord = {
  id: 'ra-approver',
  userId: 'user-approver',
  roleCode: 'approver',
  tenantId: CUSTOMER_TENANT,
  validFrom: new Date('2026-01-01T00:00:00.000Z'),
  validTo: null,
  deactivatedAt: null,
  responsibilityScopes: [{ scopeType: 'costCenter', scopeRef: 'cc-1' }],
}

const ownAssignment: RoleAssignmentRecord = {
  id: 'ra-own',
  userId: delegateUser.id,
  roleCode: 'demandOwner',
  tenantId: CUSTOMER_TENANT,
  validFrom: new Date('2026-01-01T00:00:00.000Z'),
  validTo: null,
  deactivatedAt: null,
  responsibilityScopes: [],
}

function delegation(overrides: Partial<DelegationRecord> = {}): DelegationRecord {
  return {
    id: 'del-1',
    delegatedRoleAssignmentId: approverAssignment.id,
    delegateUserId: delegateUser.id,
    tenantId: CUSTOMER_TENANT,
    periodFrom: new Date('2026-06-01T00:00:00.000Z'),
    periodTo: new Date('2026-06-30T00:00:00.000Z'),
    revokedAt: null,
    deactivatedAt: null,
    ...overrides,
  }
}

function input(overrides: Partial<GrantInput> = {}): GrantInput {
  return {
    user: delegateUser,
    tenant: customerTenant,
    ownRoleAssignments: [ownAssignment],
    delegationsAsDelegate: [delegation()],
    delegatedRoleAssignments: [approverAssignment],
    accountAssignments: [],
    evaluationDate: STICHTAG,
    ...overrides,
  }
}

describe('eigene Rollenzuweisungen', () => {
  it('eine Zuweisung im Gültigkeitszeitraum wirkt', () => {
    const subject = buildSubject(input({ delegationsAsDelegate: [] }))
    expect(subject.grants).toHaveLength(1)
    expect(subject.grants[0]).toMatchObject({ roleCode: 'demandOwner' })
    expect(subject.grants[0]?.viaDelegation).toBeUndefined()
  })

  it('eine abgelaufene Zuweisung wirkt nicht', () => {
    const subject = buildSubject(
      input({
        delegationsAsDelegate: [],
        ownRoleAssignments: [{ ...ownAssignment, validTo: new Date('2026-05-31T00:00:00.000Z') }],
      }),
    )
    expect(subject.grants).toHaveLength(0)
  })

  it('eine deaktivierte Zuweisung wirkt nicht', () => {
    const subject = buildSubject(
      input({
        delegationsAsDelegate: [],
        ownRoleAssignments: [
          { ...ownAssignment, deactivatedAt: new Date('2026-06-01T00:00:00.000Z') },
        ],
      }),
    )
    expect(subject.grants).toHaveLength(0)
  })

  it('ein deaktivierter Mandant sperrt alle Zugänge (3.11)', () => {
    const subject = buildSubject(
      input({
        tenant: { ...customerTenant, deactivatedAt: new Date('2026-06-01T00:00:00.000Z') },
      }),
    )
    expect(subject.grants).toHaveLength(0)
    expect(subject.accountAssignmentCustomerTenantIds).toHaveLength(0)
  })

  it('ein deaktivierter Benutzer hat keine Rechte', () => {
    const subject = buildSubject(
      input({ user: { ...delegateUser, deactivatedAt: new Date('2026-06-01T00:00:00.000Z') } }),
    )
    expect(subject.grants).toHaveLength(0)
  })
})

describe('Vertretung — befristet und personenbezogen (2.4, Regeln 1 und 9)', () => {
  it('innerhalb des Zeitraums wirkt die Vertretung', () => {
    const subject = buildSubject(input())
    const delegated = subject.grants.filter((grant) => grant.viaDelegation !== undefined)
    expect(delegated).toHaveLength(1)
    expect(delegated[0]).toMatchObject({ roleCode: 'approver', roleAssignmentId: 'ra-approver' })
  })

  it('vor Beginn wirkt sie nicht', () => {
    const subject = buildSubject(input({ evaluationDate: new Date('2026-05-31T23:59:59.000Z') }))
    expect(subject.grants.filter((grant) => grant.viaDelegation !== undefined)).toHaveLength(0)
  })

  it('nach Ablauf enden die Rechte sofort (Regel 9)', () => {
    const subject = buildSubject(input({ evaluationDate: new Date('2026-07-01T00:00:00.000Z') }))
    expect(subject.grants.filter((grant) => grant.viaDelegation !== undefined)).toHaveLength(0)
  })

  it('eine vorzeitig beendete Vertretung wirkt nicht mehr', () => {
    const subject = buildSubject(
      input({
        delegationsAsDelegate: [delegation({ revokedAt: new Date('2026-06-10T00:00:00.000Z') })],
      }),
    )
    expect(subject.grants.filter((grant) => grant.viaDelegation !== undefined)).toHaveLength(0)
  })

  it('eine Vertretung für eine andere Person wirkt für diesen Benutzer nicht', () => {
    const subject = buildSubject(
      input({ delegationsAsDelegate: [delegation({ delegateUserId: 'user-dritte' })] }),
    )
    expect(subject.grants.filter((grant) => grant.viaDelegation !== undefined)).toHaveLength(0)
  })

  it('eine abgelaufene vertretene Zuweisung wird nicht wiederbelebt', () => {
    const subject = buildSubject(
      input({
        delegatedRoleAssignments: [
          { ...approverAssignment, validTo: new Date('2026-05-01T00:00:00.000Z') },
        ],
      }),
    )
    expect(subject.grants.filter((grant) => grant.viaDelegation !== undefined)).toHaveLength(0)
  })
})

describe('Vertretung — keine Rechteerweiterung und keine Organisationsgrenze (Regeln 2 und 3)', () => {
  it('der Vertretungs-Grant übernimmt Rolle, Mandant und Zuständigkeiten unverändert', () => {
    const subject = buildSubject(input())
    const delegated = subject.grants.find((grant) => grant.viaDelegation !== undefined)
    expect(delegated?.responsibilityScopes).toEqual(approverAssignment.responsibilityScopes)
    expect(delegated?.tenantId).toBe(CUSTOMER_TENANT)
  })

  it('die eigenen Rechte bleiben neben der Vertretung unverändert bestehen', () => {
    const subject = buildSubject(input())
    expect(subject.grants.map((grant) => grant.roleCode).sort()).toEqual(['approver', 'demandOwner'])
  })

  it('eine Vertretung über die Organisationsgrenze wirkt nicht', () => {
    const subject = buildSubject(
      input({
        delegatedRoleAssignments: [{ ...approverAssignment, tenantId: OTHER_CUSTOMER_TENANT }],
      }),
    )
    expect(subject.grants.filter((grant) => grant.viaDelegation !== undefined)).toHaveLength(0)
  })

  it('eine nicht vertretbare Rolle wird nicht übertragen (Regel 8)', () => {
    const workerAssignment: RoleAssignmentRecord = {
      ...approverAssignment,
      id: 'ra-worker',
      roleCode: 'temporaryWorker',
      tenantId: CUSTOMER_TENANT,
    }
    const subject = buildSubject(
      input({
        delegationsAsDelegate: [delegation({ delegatedRoleAssignmentId: 'ra-worker' })],
        delegatedRoleAssignments: [workerAssignment],
      }),
    )
    expect(subject.grants.filter((grant) => grant.viaDelegation !== undefined)).toHaveLength(0)
  })
})

describe('Einrichten einer Vertretung — Prüfung vor dem Anlegen (2.4)', () => {
  it('eine zulässige Vertretung hat keine Verstöße', () => {
    expect(
      delegationViolations({
        delegatedRoleAssignment: approverAssignment,
        delegateUser,
        periodFrom: new Date('2026-07-01T00:00:00.000Z'),
        periodTo: new Date('2026-07-14T00:00:00.000Z'),
        evaluationDate: STICHTAG,
      }),
    ).toEqual([])
  })

  it('ohne Ende ist sie unzulässig (Regel 1)', () => {
    const violations = delegationViolations({
      delegatedRoleAssignment: approverAssignment,
      delegateUser,
      periodFrom: new Date('2026-07-01T00:00:00.000Z'),
      periodTo: null,
      evaluationDate: STICHTAG,
    })
    expect(violations).toHaveLength(1)
    expect(violations[0]).toContain('Unbefristete')
  })

  it('über die Organisationsgrenze ist sie unzulässig (Regel 3)', () => {
    const violations = delegationViolations({
      delegatedRoleAssignment: approverAssignment,
      delegateUser: { ...delegateUser, tenantId: OTHER_CUSTOMER_TENANT },
      periodFrom: new Date('2026-07-01T00:00:00.000Z'),
      periodTo: new Date('2026-07-14T00:00:00.000Z'),
      evaluationDate: STICHTAG,
    })
    expect(violations).toHaveLength(1)
    expect(violations[0]).toContain('Organisationsgrenzen')
  })

  it('ein Vertreter bestimmt keinen Untervertreter (Regel 4)', () => {
    const violations = delegationViolations({
      delegatedRoleAssignment: approverAssignment,
      delegateUser,
      periodFrom: new Date('2026-07-01T00:00:00.000Z'),
      periodTo: new Date('2026-07-14T00:00:00.000Z'),
      delegateHeldDelegations: [delegation()],
      evaluationDate: STICHTAG,
    })
    expect(violations).toHaveLength(1)
    expect(violations[0]).toContain('Untervertreter')
  })

  it('die Rolle des Leiharbeitnehmers ist nicht vertretbar (Regel 8)', () => {
    const violations = delegationViolations({
      delegatedRoleAssignment: { ...approverAssignment, roleCode: 'temporaryWorker' },
      delegateUser,
      periodFrom: new Date('2026-07-01T00:00:00.000Z'),
      periodTo: new Date('2026-07-14T00:00:00.000Z'),
      evaluationDate: STICHTAG,
    })
    expect(violations).toHaveLength(1)
    expect(violations[0]).toContain('nicht vertretbar')
  })
})

describe('Betreuungszuordnung (3.11)', () => {
  it('nur wirksame Betreuungszuordnungen des Benutzers zählen', () => {
    const subject = buildSubject(
      input({
        accountAssignments: [
          {
            userId: delegateUser.id,
            customerTenantId: CUSTOMER_TENANT,
            validFrom: new Date('2026-01-01T00:00:00.000Z'),
            validTo: null,
            deactivatedAt: null,
          },
          {
            userId: delegateUser.id,
            customerTenantId: OTHER_CUSTOMER_TENANT,
            validFrom: new Date('2026-01-01T00:00:00.000Z'),
            validTo: new Date('2026-03-31T00:00:00.000Z'),
            deactivatedAt: null,
          },
          {
            userId: 'user-andere',
            customerTenantId: OTHER_CUSTOMER_TENANT,
            validFrom: new Date('2026-01-01T00:00:00.000Z'),
            validTo: null,
            deactivatedAt: null,
          },
        ],
      }),
    )
    expect(subject.accountAssignmentCustomerTenantIds).toEqual([CUSTOMER_TENANT])
  })
})
