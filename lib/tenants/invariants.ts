/**
 * Invarianten des Mandanten (SPEC 3.11), die das Schema nicht erzwingen kann.
 *
 * PostgreSQL könnte „genau ein Betreibermandant" nur über einen partiellen
 * Index abbilden, den Prisma im Schema nicht ausdrücken kann. Die Invariante
 * steht deshalb hier und wird beim Anlegen eines Mandanten geprüft.
 */
import type { TenantType } from '../authz/roles'

export interface TenantLike {
  readonly id: string
  readonly tenantType: TenantType
  readonly organizationId?: string | null
}

export class TenantInvariantError extends Error {}

/** 3.11: „genau **ein** Mandant mit `operator`". */
export function assertSingleOperatorTenant(tenants: readonly TenantLike[]): void {
  const operators = tenants.filter((tenant) => tenant.tenantType === 'operator')
  if (operators.length > 1) {
    throw new TenantInvariantError(
      `Es darf nur einen Betreibermandanten geben, gefunden: ${operators.length} (SPEC 3.11).`,
    )
  }
}

/**
 * 3.11: `organizationRef` ist Pflicht außer beim Betreiber.
 *
 * Solange Kunde (3.1) und Lieferant (3.2) nicht modelliert sind, bleibt
 * `organizationId` leer; die Prüfung ist deshalb vorerst abgeschaltet und
 * benannt, nicht stillschweigend weggelassen.
 */
export function assertOrganizationRefPresent(
  tenant: TenantLike,
  options: { readonly enforce: boolean } = { enforce: false },
): void {
  if (!options.enforce) return
  if (tenant.tenantType === 'operator') return
  if (tenant.organizationId === undefined || tenant.organizationId === null || tenant.organizationId === '') {
    throw new TenantInvariantError(
      `Mandant ${tenant.id} braucht einen Verweis auf Kunde oder Lieferant (SPEC 3.11).`,
    )
  }
}
