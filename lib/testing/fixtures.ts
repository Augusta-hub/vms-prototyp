/**
 * Prüfbausteine für die Unit-Tests: Mandanten, Rechte und Subjekte.
 *
 * Diese Datei enthält **keine** Fachlogik und wird von der Anwendung nicht
 * benutzt — sie liegt nur hier, damit die Tests zu den Statusmodellen, zur
 * Sichtbarkeit und zur Prüffunktion dieselbe kleine Welt beschreiben und sie
 * nicht viermal wiederholen.
 *
 * Die Namen sind erfunden; es gibt keine Echtdaten (CLAUDE.md, Regel 3).
 */
import type { Grant, ScopeRef, Subject } from '../authz/check'
import type { RoleCode, TenantType } from '../authz/roles'

export const OPERATOR_TENANT = 'tenant-operator'
export const CUSTOMER_TENANT = 'tenant-customer-1'
export const OTHER_CUSTOMER_TENANT = 'tenant-customer-2'
export const SUPPLIER_TENANT = 'tenant-supplier-1'
export const OTHER_SUPPLIER_TENANT = 'tenant-supplier-2'

export const TENANT_TYPE_BY_ID: Readonly<Record<string, TenantType>> = {
  [OPERATOR_TENANT]: 'operator',
  [CUSTOMER_TENANT]: 'customer',
  [OTHER_CUSTOMER_TENANT]: 'customer',
  [SUPPLIER_TENANT]: 'supplier',
  [OTHER_SUPPLIER_TENANT]: 'supplier',
}

/** Der Mandant, in dem eine Rolle nach 2.1 überhaupt vergeben werden kann. */
export const HOME_TENANT_BY_ROLE: { readonly [R in RoleCode]: string } = {
  operatorAdmin: OPERATOR_TENANT,
  operatorCoordinator: OPERATOR_TENANT,
  demandOwner: CUSTOMER_TENANT,
  approver: CUSTOMER_TENANT,
  procurementController: CUSTOMER_TENANT,
  supplierCoordinator: SUPPLIER_TENANT,
  supplierAdmin: SUPPLIER_TENANT,
  temporaryWorker: SUPPLIER_TENANT,
}

export function grant(
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

export function subject(
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

/** Ein Benutzer mit zwei Rollen in derselben Organisation (Kapitel 2). */
export function subjectWithRoles(
  roleCodes: readonly RoleCode[],
  options: { readonly userId?: string } = {},
): Subject {
  const first = roleCodes[0]
  if (first === undefined) throw new Error('Mindestens eine Rolle angeben.')
  const tenantId = HOME_TENANT_BY_ROLE[first]
  return {
    userId: options.userId ?? 'user-mehrfachrolle',
    tenantId,
    tenantType: TENANT_TYPE_BY_ID[tenantId] as TenantType,
    grants: roleCodes.map((roleCode) => grant(roleCode, { tenantId })),
    accountAssignmentCustomerTenantIds: [],
  }
}

export const DAY = (iso: string): Date => new Date(`${iso}T00:00:00.000Z`)
