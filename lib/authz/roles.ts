/**
 * Rollenkatalog zu SPEC 2.1 und 3.11.
 *
 * Die acht Rollen sind ein **fester Katalog**, keine pflegbaren Daten (3.11).
 * Deshalb stehen Kürzel, Bezeichnung und zulässiger Mandantentyp hier im Code
 * und nicht in einer Tabelle. Rollen erben nicht voneinander (Kapitel 2).
 */

/** Mandantentyp (3.11). Entspricht dem Enum `TenantType` im Prisma-Schema. */
export type TenantType = 'operator' | 'customer' | 'supplier'

/** Rollenkürzel (2.1). Entspricht dem Enum `RoleCode` im Prisma-Schema. */
export type RoleCode =
  | 'operatorAdmin'
  | 'operatorCoordinator'
  | 'demandOwner'
  | 'approver'
  | 'procurementController'
  | 'supplierCoordinator'
  | 'supplierAdmin'
  | 'temporaryWorker'

export interface RoleCatalogEntry {
  readonly roleCode: RoleCode
  /** Spaltenkürzel der Berechtigungsmatrix in SPEC 2.2. */
  readonly abbreviation: 'MA' | 'MD' | 'KB' | 'KG' | 'KE' | 'LD' | 'LA' | 'AN'
  readonly name: string
  /** Verhindert Rollen über Organisationsgrenzen hinweg (Kapitel 2, 3.11). */
  readonly appliesToTenantType: TenantType
  /** Nur bei eigenem Zugang für Leiharbeitnehmer — offene Frage 4. */
  readonly optional?: true
}

export const ROLE_CATALOG: { readonly [R in RoleCode]: RoleCatalogEntry } = {
  operatorAdmin: {
    roleCode: 'operatorAdmin',
    abbreviation: 'MA',
    name: 'Betreiber / MSP-Administrator',
    appliesToTenantType: 'operator',
  },
  operatorCoordinator: {
    roleCode: 'operatorCoordinator',
    abbreviation: 'MD',
    name: 'MSP-Disponent',
    appliesToTenantType: 'operator',
  },
  demandOwner: {
    roleCode: 'demandOwner',
    abbreviation: 'KB',
    name: 'Kunde: Bedarfsträger / Fachbereich',
    appliesToTenantType: 'customer',
  },
  approver: {
    roleCode: 'approver',
    abbreviation: 'KG',
    name: 'Kunde: Genehmiger',
    appliesToTenantType: 'customer',
  },
  procurementController: {
    roleCode: 'procurementController',
    abbreviation: 'KE',
    name: 'Kunde: Einkauf / Controlling',
    appliesToTenantType: 'customer',
  },
  supplierCoordinator: {
    roleCode: 'supplierCoordinator',
    abbreviation: 'LD',
    name: 'Lieferant: Disponent',
    appliesToTenantType: 'supplier',
  },
  supplierAdmin: {
    roleCode: 'supplierAdmin',
    abbreviation: 'LA',
    name: 'Lieferant: Administrator',
    appliesToTenantType: 'supplier',
  },
  temporaryWorker: {
    roleCode: 'temporaryWorker',
    abbreviation: 'AN',
    // Der Leiharbeitnehmer ist beim Verleiher angestellt; ohne eigenen Zugang
    // übernimmt der Lieferantendisponent alle seine Vorgänge in seinem Namen
    // (2.1). Der Zugang gehört deshalb zum Lieferantenmandanten.
    name: 'Leiharbeitnehmer',
    appliesToTenantType: 'supplier',
    optional: true,
  },
}

export const ROLE_CODES: readonly RoleCode[] = Object.keys(ROLE_CATALOG) as RoleCode[]

/** Rollen, die ein Mandant dieses Typs überhaupt vergeben darf (Kapitel 2). */
export function rolesForTenantType(tenantType: TenantType): readonly RoleCode[] {
  return ROLE_CODES.filter((code) => ROLE_CATALOG[code].appliesToTenantType === tenantType)
}

/**
 * Nicht vertretbare Rollen (2.4, Regel 8). Die personenbezogene Erfassung des
 * Leiharbeitnehmers ist unabhängig von offener Frage 4 nicht übertragbar.
 */
export const NON_DELEGABLE_ROLES: readonly RoleCode[] = ['temporaryWorker']
