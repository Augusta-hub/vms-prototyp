/**
 * Tests der Prüffunktion gegen SPEC 2.2, 2.3 und 2.4.
 *
 * Diese Tests prüfen Anwendungscode und sind **nicht** die AÜG-Regeln; die
 * stehen als Gherkin in tests/aueg/ und werden hier nicht berührt.
 *
 * Aufbau: je Rolle mindestens ein erlaubter und ein verweigerter Zugriff auf
 * die belegten Zeilen zu 3.11, dann die Mandantengrenze und die
 * Vertretungsregeln.
 */
import { describe, expect, it } from 'vitest'
import { checkPermission, type Grant, type ResourceRef, type ScopeRef, type Subject } from './check'
import { ROLE_CATALOG, ROLE_CODES, type RoleCode, type TenantType } from './roles'

const OPERATOR_TENANT = 'tenant-operator'
const CUSTOMER_TENANT = 'tenant-customer-1'
const OTHER_CUSTOMER_TENANT = 'tenant-customer-2'
const SUPPLIER_TENANT = 'tenant-supplier-1'
const OTHER_SUPPLIER_TENANT = 'tenant-supplier-2'

const TENANT_TYPE_BY_ID: Record<string, TenantType> = {
  [OPERATOR_TENANT]: 'operator',
  [CUSTOMER_TENANT]: 'customer',
  [OTHER_CUSTOMER_TENANT]: 'customer',
  [SUPPLIER_TENANT]: 'supplier',
  [OTHER_SUPPLIER_TENANT]: 'supplier',
}

/** Der Mandant, in dem eine Rolle nach 2.1 überhaupt vergeben werden kann. */
const HOME_TENANT_BY_ROLE: { readonly [R in RoleCode]: string } = {
  operatorAdmin: OPERATOR_TENANT,
  operatorCoordinator: OPERATOR_TENANT,
  demandOwner: CUSTOMER_TENANT,
  approver: CUSTOMER_TENANT,
  procurementController: CUSTOMER_TENANT,
  supplierCoordinator: SUPPLIER_TENANT,
  supplierAdmin: SUPPLIER_TENANT,
  temporaryWorker: SUPPLIER_TENANT,
}

function grant(
  roleCode: RoleCode,
  options: {
    readonly roleAssignmentId?: string
    readonly tenantId?: string
    readonly responsibilityScopes?: readonly ScopeRef[]
    readonly viaDelegation?: { readonly delegationId: string; readonly delegatedUserId: string }
  } = {},
): Grant {
  return {
    roleAssignmentId: options.roleAssignmentId ?? `ra-${roleCode}`,
    roleCode,
    tenantId: options.tenantId ?? HOME_TENANT_BY_ROLE[roleCode],
    responsibilityScopes: options.responsibilityScopes ?? [],
    ...(options.viaDelegation !== undefined ? { viaDelegation: options.viaDelegation } : {}),
  }
}

function subject(
  roleCode: RoleCode,
  options: {
    readonly userId?: string
    readonly tenantId?: string
    readonly grants?: readonly Grant[]
    readonly accountAssignmentCustomerTenantIds?: readonly string[]
  } = {},
): Subject {
  const tenantId = options.tenantId ?? HOME_TENANT_BY_ROLE[roleCode]
  return {
    userId: options.userId ?? `user-${roleCode}`,
    tenantId,
    tenantType: TENANT_TYPE_BY_ID[tenantId] as TenantType,
    grants: options.grants ?? [grant(roleCode, { tenantId })],
    accountAssignmentCustomerTenantIds: options.accountAssignmentCustomerTenantIds ?? [],
  }
}

function userResource(tenantId: string): ResourceRef {
  return {
    type: 'userAndRoleAssignment',
    tenantId,
    tenantType: TENANT_TYPE_BY_ID[tenantId] as TenantType,
  }
}

function delegationResource(
  tenantId: string,
  delegatedRoleAssignmentId?: string,
): ResourceRef {
  return {
    type: 'delegation',
    tenantId,
    tenantType: TENANT_TYPE_BY_ID[tenantId] as TenantType,
    ...(delegatedRoleAssignmentId !== undefined ? { delegatedRoleAssignmentId } : {}),
  }
}

describe('Berechtigungsmatrix 2.2 — je Rolle ein erlaubter und ein verweigerter Zugriff', () => {
  it('MA darf Benutzer anlegen (Zeile 3.11, A ohne Fußnote)', () => {
    const decision = checkPermission(subject('operatorAdmin'), 'create', userResource(OPERATOR_TENANT))
    expect(decision.allowed).toBe(true)
  })

  it('MA darf den Status einer Vertretung nicht wechseln (Zeile Vertretung trägt kein S)', () => {
    const decision = checkPermission(
      subject('operatorAdmin'),
      'transition',
      delegationResource(OPERATOR_TENANT, 'ra-operatorAdmin'),
    )
    expect(decision).toMatchObject({ allowed: false, denial: { kind: 'noRolePermission' } })
  })

  it('MD darf Benutzer lesen (L[38])', () => {
    const decision = checkPermission(
      subject('operatorCoordinator'),
      'read',
      userResource(OPERATOR_TENANT),
    )
    expect(decision.allowed).toBe(true)
  })

  it('MD darf Benutzer nicht ändern — [38] erlaubt nur lesenden Zugriff', () => {
    const decision = checkPermission(
      subject('operatorCoordinator'),
      'update',
      userResource(OPERATOR_TENANT),
    )
    expect(decision).toMatchObject({ allowed: false, denial: { kind: 'noRolePermission' } })
  })

  it('KB darf eine Vertretung zur eigenen Rollenzuweisung anlegen (A[45])', () => {
    const decision = checkPermission(
      subject('demandOwner'),
      'create',
      delegationResource(CUSTOMER_TENANT, 'ra-demandOwner'),
    )
    expect(decision.allowed).toBe(true)
  })

  it('KB darf keine Vertretung zu einer fremden Rollenzuweisung anlegen ([45])', () => {
    const decision = checkPermission(
      subject('demandOwner'),
      'create',
      delegationResource(CUSTOMER_TENANT, 'ra-approver'),
    )
    expect(decision).toMatchObject({ allowed: false, denial: { kind: 'footnote', footnote: 45 } })
  })

  it('KB darf keine Benutzer lesen — die Zeile 3.11 trägt für KB kein Recht', () => {
    const decision = checkPermission(subject('demandOwner'), 'read', userResource(CUSTOMER_TENANT))
    expect(decision).toMatchObject({ allowed: false, denial: { kind: 'noRolePermission' } })
  })

  it('KG darf die eigene Vertretung lesen (L[45])', () => {
    const decision = checkPermission(
      subject('approver'),
      'read',
      delegationResource(CUSTOMER_TENANT, 'ra-approver'),
    )
    expect(decision.allowed).toBe(true)
  })

  it('KG darf keine Benutzer anlegen', () => {
    const decision = checkPermission(subject('approver'), 'create', userResource(CUSTOMER_TENANT))
    expect(decision).toMatchObject({ allowed: false, denial: { kind: 'noRolePermission' } })
  })

  it('KE darf Benutzer des eigenen Kunden lesen (L[2])', () => {
    const decision = checkPermission(
      subject('procurementController'),
      'read',
      userResource(CUSTOMER_TENANT),
    )
    expect(decision.allowed).toBe(true)
  })

  it('KE darf Benutzer nicht anlegen', () => {
    const decision = checkPermission(
      subject('procurementController'),
      'create',
      userResource(CUSTOMER_TENANT),
    )
    expect(decision).toMatchObject({ allowed: false, denial: { kind: 'noRolePermission' } })
  })

  it('LD darf die eigene Vertretung beenden (X[45])', () => {
    const decision = checkPermission(
      subject('supplierCoordinator'),
      'delete',
      delegationResource(SUPPLIER_TENANT, 'ra-supplierCoordinator'),
    )
    expect(decision.allowed).toBe(true)
  })

  it('LD darf keine Benutzer der eigenen Organisation lesen — die Zeile 3.11 trägt für LD nichts', () => {
    const decision = checkPermission(
      subject('supplierCoordinator'),
      'read',
      userResource(SUPPLIER_TENANT),
    )
    expect(decision).toMatchObject({ allowed: false, denial: { kind: 'noRolePermission' } })
  })

  it('LA darf Benutzer der eigenen Lieferantenorganisation anlegen (A[7])', () => {
    const decision = checkPermission(subject('supplierAdmin'), 'create', userResource(SUPPLIER_TENANT))
    expect(decision.allowed).toBe(true)
  })

  it('LA darf keine Benutzer eines anderen Lieferanten anlegen — Mandantengrenze vor [7]', () => {
    const decision = checkPermission(
      subject('supplierAdmin'),
      'create',
      userResource(OTHER_SUPPLIER_TENANT),
    )
    expect(decision).toMatchObject({ allowed: false, denial: { kind: 'tenantBoundary' } })
  })

  // AN (Leiharbeitnehmer) trägt in beiden Zeilen zu 3.11 kein Recht — das ist
  // die Festlegung aus 2.2, kein fehlender Test. Ein erlaubter Zugriff für AN
  // ist erst an einer Zeile zu zeigen, die eine AN-Zelle trägt (3.7, 3.8, 3.10);
  // die sind in dieser Arbeitseinheit nicht belegt.
  it('AN darf an den Objekten aus 3.11 nichts — weder lesen noch anlegen', () => {
    const worker = subject('temporaryWorker')
    for (const operation of ['create', 'read', 'update', 'transition', 'delete'] as const) {
      expect(checkPermission(worker, operation, userResource(SUPPLIER_TENANT)).allowed).toBe(false)
      expect(
        checkPermission(worker, operation, delegationResource(SUPPLIER_TENANT, 'ra-temporaryWorker'))
          .allowed,
      ).toBe(false)
    }
  })

  it('jede der acht Rollen aus 2.1 ist im Katalog geführt', () => {
    expect(ROLE_CODES).toHaveLength(8)
    for (const code of ROLE_CODES) {
      expect(ROLE_CATALOG[code].roleCode).toBe(code)
    }
  })
})

describe('nicht positiv erlaubter Zugriff wird verweigert (2.3)', () => {
  // Die Zeile zu 3.8 ist noch nicht belegt; sie steht hier für jede Zeile, die
  // auf ihr Fachmodul wartet. Als dieser Test entstand, war es die Zeile zur
  // Bedarfsanfrage (mit 3.4 belegt), danach die zum Kandidaten (mit 3.6
  // belegt).
  it('eine Zeile ohne Eintrag in der Matrix verweigert jeden Zugriff', () => {
    const decision = checkPermission(subject('operatorAdmin'), 'read', {
      type: 'timesheet',
      tenantId: OPERATOR_TENANT,
      tenantType: 'operator',
    })
    expect(decision).toMatchObject({ allowed: false, denial: { kind: 'noRolePermission' } })
  })

  it('ein Benutzer ohne wirksame Rollenzuweisung hat keinen Zugriff', () => {
    const decision = checkPermission(
      subject('operatorAdmin', { grants: [] }),
      'read',
      userResource(OPERATOR_TENANT),
    )
    expect(decision).toMatchObject({ allowed: false, denial: { kind: 'noGrant' } })
  })

  it('eine Rolle, die nicht zum Mandantentyp passt, wirkt nicht', () => {
    // Datenfehler: ein Kundenmandant trägt eine Betreiberrolle.
    const decision = checkPermission(
      {
        userId: 'user-broken',
        tenantId: CUSTOMER_TENANT,
        tenantType: 'customer',
        grants: [grant('operatorAdmin', { tenantId: CUSTOMER_TENANT })],
        accountAssignmentCustomerTenantIds: [],
      },
      'create',
      userResource(CUSTOMER_TENANT),
    )
    expect(decision).toMatchObject({
      allowed: false,
      denial: { kind: 'roleTenantTypeMismatch' },
    })
  })
})

describe('Mandantengrenze vor Rollenrecht (2.3)', () => {
  it('der Betreiber sieht über die Mandantengrenze und die Entscheidung weist es aus', () => {
    const decision = checkPermission(
      subject('operatorAdmin'),
      'read',
      userResource(CUSTOMER_TENANT),
    )
    expect(decision).toMatchObject({ allowed: true, crossTenant: true })
  })

  it('ein Kundenbenutzer sieht keinen anderen Kunden', () => {
    const decision = checkPermission(
      subject('procurementController'),
      'read',
      userResource(OTHER_CUSTOMER_TENANT),
    )
    expect(decision).toMatchObject({ allowed: false, denial: { kind: 'tenantBoundary' } })
  })

  it('ein Lieferant sieht keinen anderen Lieferanten', () => {
    const decision = checkPermission(
      subject('supplierAdmin'),
      'read',
      userResource(OTHER_SUPPLIER_TENANT),
    )
    expect(decision).toMatchObject({ allowed: false, denial: { kind: 'tenantBoundary' } })
  })

  it('die Mandantengrenze greift vor dem Rollenrecht: auch ein Zugriff ohne jedes Rollenrecht scheitert zuerst an ihr', () => {
    const decision = checkPermission(
      subject('demandOwner'),
      'read',
      userResource(OTHER_CUSTOMER_TENANT),
    )
    expect(decision).toMatchObject({ allowed: false, denial: { kind: 'tenantBoundary' } })
  })

  it('die Betreuungszuordnung schränkt die Querschnittssicht ein (2.3, Bedingung 2)', () => {
    const betreut = subject('operatorCoordinator', {
      accountAssignmentCustomerTenantIds: [CUSTOMER_TENANT],
    })
    expect(checkPermission(betreut, 'read', userResource(CUSTOMER_TENANT)).allowed).toBe(true)
    expect(checkPermission(betreut, 'read', userResource(OTHER_CUSTOMER_TENANT))).toMatchObject({
      allowed: false,
      denial: { kind: 'accountAssignment' },
    })
  })

  it('ohne Betreuungszuordnung bleibt die Querschnittssicht vollständig', () => {
    const decision = checkPermission(
      subject('operatorCoordinator'),
      'read',
      userResource(OTHER_CUSTOMER_TENANT),
    )
    expect(decision.allowed).toBe(true)
  })

  it('[2] und [7] verweigern auch dann, wenn die Mandantengrenze passiert wäre', () => {
    // Konstruierter Fall: ein Kundenbenutzer mit einer Rollenzuweisung, deren
    // Fußnote [2] auf den eigenen Mandanten begrenzt, greift auf ein Objekt im
    // eigenen Mandanten zu — erlaubt. Der Gegentest ist die Mandantengrenze.
    expect(
      checkPermission(subject('procurementController'), 'read', userResource(CUSTOMER_TENANT))
        .allowed,
    ).toBe(true)
  })
})

describe('Zuständigkeit innerhalb des Mandanten (3.11)', () => {
  it('ohne Zuständigkeit wirkt die Rollenzuweisung auf den ganzen Mandanten', () => {
    const decision = checkPermission(
      subject('supplierAdmin'),
      'read',
      userResource(SUPPLIER_TENANT),
    )
    expect(decision.allowed).toBe(true)
  })

  it('eine Zuständigkeit auf einen Standort verweigert einen Vorgang an einem anderen Standort', () => {
    const scoped = subject('supplierAdmin', {
      grants: [
        grant('supplierAdmin', {
          responsibilityScopes: [{ scopeType: 'site', scopeRef: 'site-a' }],
        }),
      ],
    })
    expect(
      checkPermission(scoped, 'read', { ...userResource(SUPPLIER_TENANT), siteId: 'site-a' })
        .allowed,
    ).toBe(true)
    expect(
      checkPermission(scoped, 'read', { ...userResource(SUPPLIER_TENANT), siteId: 'site-b' }),
    ).toMatchObject({ allowed: false, denial: { kind: 'responsibilityScope' } })
  })
})

describe('Vertretung (2.4)', () => {
  const approverAssignment = 'ra-approver-1'

  function delegateSubject(options: { readonly ownRole?: RoleCode } = {}): Subject {
    const own = options.ownRole === undefined ? [] : [grant(options.ownRole, { tenantId: CUSTOMER_TENANT })]
    return {
      userId: 'user-delegate',
      tenantId: CUSTOMER_TENANT,
      tenantType: 'customer',
      grants: [
        ...own,
        grant('approver', {
          roleAssignmentId: approverAssignment,
          tenantId: CUSTOMER_TENANT,
          viaDelegation: { delegationId: 'del-1', delegatedUserId: 'user-approver' },
        }),
      ],
      accountAssignmentCustomerTenantIds: [],
    }
  }

  it('der Vertreter erhält die Rechte der vertretenen Rollenzuweisung und einen Vertretungsvermerk', () => {
    const decision = checkPermission(
      delegateSubject(),
      'read',
      delegationResource(CUSTOMER_TENANT, approverAssignment),
    )
    expect(decision).toMatchObject({
      allowed: true,
      delegationNote: { delegationId: 'del-1', delegatedUserId: 'user-approver' },
    })
  })

  it('keine Rechteerweiterung: was weder die eigene noch die vertretene Rolle darf, bleibt verweigert', () => {
    const decision = checkPermission(
      delegateSubject({ ownRole: 'demandOwner' }),
      'create',
      userResource(CUSTOMER_TENANT),
    )
    expect(decision).toMatchObject({ allowed: false, denial: { kind: 'noRolePermission' } })
  })

  it('keine Ketten: in Vertretung wird keine weitere Vertretung eingerichtet (Regel 4, Fußnote [45])', () => {
    const decision = checkPermission(
      delegateSubject(),
      'create',
      delegationResource(CUSTOMER_TENANT, approverAssignment),
    )
    expect(decision).toMatchObject({ allowed: false, denial: { kind: 'footnote', footnote: 45 } })
  })

  it('die Rolle des Leiharbeitnehmers wirkt auch über eine Vertretung nicht (Regel 8)', () => {
    const decision = checkPermission(
      {
        userId: 'user-delegate-supplier',
        tenantId: SUPPLIER_TENANT,
        tenantType: 'supplier',
        grants: [
          grant('temporaryWorker', {
            tenantId: SUPPLIER_TENANT,
            viaDelegation: { delegationId: 'del-2', delegatedUserId: 'user-worker' },
          }),
        ],
        accountAssignmentCustomerTenantIds: [],
      },
      'read',
      userResource(SUPPLIER_TENANT),
    )
    expect(decision).toMatchObject({ allowed: false, denial: { kind: 'roleNotDelegable' } })
  })

  it('personenbezogen: der Vertreter handelt an der vertretenen Zuweisung, nicht an einer fremden', () => {
    const decision = checkPermission(
      delegateSubject(),
      'read',
      delegationResource(CUSTOMER_TENANT, 'ra-fremd'),
    )
    expect(decision).toMatchObject({ allowed: false, denial: { kind: 'footnote', footnote: 45 } })
  })

  it('eine Vertretung trägt die Zuständigkeiten der vertretenen Zuweisung unverändert', () => {
    const scopes: readonly ScopeRef[] = [{ scopeType: 'costCenter', scopeRef: 'cc-1' }]
    const delegate: Subject = {
      userId: 'user-delegate',
      tenantId: CUSTOMER_TENANT,
      tenantType: 'customer',
      grants: [
        grant('approver', {
          roleAssignmentId: approverAssignment,
          tenantId: CUSTOMER_TENANT,
          responsibilityScopes: scopes,
          viaDelegation: { delegationId: 'del-1', delegatedUserId: 'user-approver' },
        }),
      ],
      accountAssignmentCustomerTenantIds: [],
    }
    expect(
      checkPermission(delegate, 'read', {
        ...delegationResource(CUSTOMER_TENANT, approverAssignment),
        costCenterId: 'cc-2',
      }),
    ).toMatchObject({ allowed: false, denial: { kind: 'responsibilityScope' } })
  })
})
