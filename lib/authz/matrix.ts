/**
 * Die Berechtigungsmatrix aus SPEC 2.2 — **die** eine Stelle, an der Rechte
 * stehen.
 *
 * Aufbau: Objektzeile → Rolle → Operation → Fußnoten. Eine Operation, die in
 * einer Zelle nicht genannt ist, ist nicht erlaubt; eine Rolle ohne Zelle hat
 * keinen Zugriff; eine Zeile, die hier fehlt, verweigert jeden Zugriff. Das
 * ist keine Vereinfachung, sondern die positive Festlegung aus 2.3: sichtbar
 * ist, was eine Regel ausdrücklich erlaubt.
 *
 * Die Matrix nennt das **Maximum** je Rolle. Mandantengrenze (2.3) und
 * Zuständigkeit gehen vor und werden in lib/authz/check.ts **vor** der Matrix
 * geprüft.
 *
 * Belegt sind in dieser Arbeitseinheit die beiden Zeilen zu 3.11. Die übrigen
 * 22 Zeilen aus 2.2 kommen mit ihren Fachmodulen hinzu; bis dahin verweigern
 * sie jeden Zugriff.
 */
import type { FootnoteNumber } from './footnotes'
import type { Operation } from './operations'
import type { ResourceType } from './resources'
import type { RoleCode } from './roles'

/**
 * Eine Zelle der Matrix: die erlaubten Operationen mit ihren Fußnoten.
 * Leeres Array = Operation ohne Einschränkung.
 */
export type MatrixCell = {
  readonly [O in Operation]?: readonly FootnoteNumber[]
}

/** Eine Zeile der Matrix. Fehlende Rolle = kein Zugriff (`–` in 2.2). */
export type MatrixRow = {
  readonly [R in RoleCode]?: MatrixCell
}

export type PermissionMatrix = {
  readonly [T in ResourceType]?: MatrixRow
}

export const PERMISSION_MATRIX: PermissionMatrix = {
  // | Benutzer, Rollenzuweisung, Mandantenzuordnung, Zuständigkeit (3.11)
  // | MA: A L Ä S X | MD: L[38] | KB: – | KG: – | KE: L[2] | LD: – |
  // | LA: A[7] L[7] Ä[7] S[7] X[7] | AN: – |
  userAndRoleAssignment: {
    operatorAdmin: {
      create: [],
      read: [],
      update: [],
      transition: [],
      delete: [],
    },
    operatorCoordinator: { read: [38] },
    procurementController: { read: [2] },
    supplierAdmin: {
      create: [7],
      read: [7],
      update: [7],
      transition: [7],
      delete: [7],
    },
  },

  // | Vertretung (3.11)
  // | MA: A L Ä X | MD: L[38] | KB: A[45] L[45] X[45] | KG: A[45] L[45] X[45] |
  // | KE: A[45] L[45] X[45] | LD: A[45] L[45] X[45] | LA: A[7] L[7] Ä[7] X[7] |
  // | AN: – |
  //
  // Kein `S` in dieser Zeile: die Vertretung hat kein Statusmodell (3.11).
  // Bei [45] fehlt `Ä`, weil eine laufende Vertretung beendet und neu angelegt
  // wird, nicht geändert (Fußnote [45]).
  delegation: {
    operatorAdmin: { create: [], read: [], update: [], delete: [] },
    operatorCoordinator: { read: [38] },
    demandOwner: { create: [45], read: [45], delete: [45] },
    approver: { create: [45], read: [45], delete: [45] },
    procurementController: { create: [45], read: [45], delete: [45] },
    supplierCoordinator: { create: [45], read: [45], delete: [45] },
    supplierAdmin: { create: [7], read: [7], update: [7], delete: [7] },
  },
}

/**
 * Die Zelle zu Rolle und Objekt, oder `undefined` für „kein Zugriff".
 * Einzige Leseschnittstelle auf die Matrix.
 */
export function matrixCell(resourceType: ResourceType, roleCode: RoleCode): MatrixCell | undefined {
  return PERMISSION_MATRIX[resourceType]?.[roleCode]
}

/**
 * Die Fußnoten, unter denen eine Rolle die Operation an diesem Objekt
 * ausführen darf — oder `undefined`, wenn die Matrix sie nicht nennt.
 * `undefined` und das leere Array sind verschieden: `undefined` heißt „nicht
 * erlaubt", das leere Array „erlaubt, ohne Einschränkung".
 */
export function grantedFootnotes(
  resourceType: ResourceType,
  roleCode: RoleCode,
  operation: Operation,
): readonly FootnoteNumber[] | undefined {
  return matrixCell(resourceType, roleCode)?.[operation]
}
