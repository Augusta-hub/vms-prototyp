/**
 * Operationen der Berechtigungsmatrix (SPEC 2.2, Glossar 1.5).
 *
 * `delete` ist im Regelfall Deaktivierung oder Stornierung, nicht physische
 * Löschung (2.2, Lesart). Physisches Löschen folgt ausschließlich dem
 * Löschkonzept aus Kapitel 6.6.
 *
 * `transition` meint nur die Übergänge, die **Kapitel 4** der Rolle zuweist:
 * die Matrix sagt, wer überhaupt — Kapitel 4 sagt, welchen Übergang wann.
 */
export type Operation = 'create' | 'read' | 'update' | 'transition' | 'delete'

export const OPERATIONS: readonly Operation[] = [
  'create',
  'read',
  'update',
  'transition',
  'delete',
]

/** Kürzel der Matrix in 2.2: A, L, Ä, S, X. */
export const OPERATION_ABBREVIATION: { readonly [O in Operation]: string } = {
  create: 'A',
  read: 'L',
  update: 'Ä',
  transition: 'S',
  delete: 'X',
}

export const OPERATION_LABELS: { readonly [O in Operation]: string } = {
  create: 'anlegen',
  read: 'lesen',
  update: 'ändern',
  transition: 'Status wechseln',
  delete: 'löschen (deaktivieren, stornieren)',
}
