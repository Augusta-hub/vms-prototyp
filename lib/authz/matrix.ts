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
 * Belegt sind die Zeilen zu 3.1 bis 3.8, die Zeile zu 3.10, die beiden Zeilen
 * zu 3.11, die Zeile zu 3.12 und aus 3.9 die **Abrechnungsperiode** — sie
 * steht hier, weil 4.4 sie braucht. Der Abrechnungsbeleg kommt mit 4.5 hinzu;
 * bis dahin verweigert seine Zeile jeden Zugriff.
 *
 * Die Zellen stehen in derselben Reihenfolge wie die Spalten in 2.2
 * (MA · MD · KB · KG · KE · LD · LA · AN); über jeder Zeile steht ihr Wortlaut
 * aus der Spezifikation, damit die Übertragung nachprüfbar bleibt.
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

/** Volle Rechte des Betreiberadministrators: `A L Ä S X` in 2.2. */
const MA_FULL: MatrixCell = {
  create: [],
  read: [],
  update: [],
  transition: [],
  delete: [],
}

/** `A L Ä X` — dieselbe Zelle ohne Statusrecht (Objekt ohne Statusmodell). */
const MA_WITHOUT_TRANSITION: MatrixCell = {
  create: [],
  read: [],
  update: [],
  delete: [],
}

export const PERMISSION_MATRIX: PermissionMatrix = {
  // | Kunde / Entleiher (3.1)
  // | MA: A L Ä S X | MD: L Ä[1] | KB: L[2] | KG: L[2] | KE: L[2] Ä[1] |
  // | LD: L[3] | LA: L[3] | AN: L[4] |
  customer: {
    operatorAdmin: MA_FULL,
    operatorCoordinator: { read: [], update: [1] },
    demandOwner: { read: [2] },
    approver: { read: [2] },
    procurementController: { read: [2], update: [1] },
    supplierCoordinator: { read: [3] },
    supplierAdmin: { read: [3] },
    temporaryWorker: { read: [4] },
  },

  // | Standort (3.1)
  // | MA: A L Ä S X | MD: L Ä[1] | KB: L[2] | KG: L[2] | KE: A[2] L[2] Ä[2] |
  // | LD: L[3] | LA: L[3] | AN: L[4] |
  site: {
    operatorAdmin: MA_FULL,
    operatorCoordinator: { read: [], update: [1] },
    demandOwner: { read: [2] },
    approver: { read: [2] },
    procurementController: { create: [2], read: [2], update: [2] },
    supplierCoordinator: { read: [3] },
    supplierAdmin: { read: [3] },
    temporaryWorker: { read: [4] },
  },

  // | Kostenstelle (3.1)
  // | MA: A L Ä X | MD: L | KB: L[2] | KG: L[2] | KE: A[2] L[2] Ä[2] X[2] |
  // | LD: – | LA: – | AN: – |
  //
  // Kein Recht für Lieferantenrollen: die Kostenstelle ist eine interne
  // Zuordnung des Kunden und für Lieferanten nie sichtbar ([14], 3.1).
  costCenter: {
    operatorAdmin: MA_WITHOUT_TRANSITION,
    operatorCoordinator: { read: [] },
    demandOwner: { read: [2] },
    approver: { read: [2] },
    procurementController: { create: [2], read: [2], update: [2], delete: [2] },
  },

  // | Lieferant / Verleiher (3.2)
  // | MA: A L Ä S X | MD: L Ä[1] S[5] | KB: L[6] | KG: – | KE: L[6] |
  // | LD: L[7] | LA: L[7] Ä[7] | AN: – |
  supplier: {
    operatorAdmin: MA_FULL,
    operatorCoordinator: { read: [], update: [1], transition: [5] },
    demandOwner: { read: [6] },
    procurementController: { read: [6] },
    supplierCoordinator: { read: [7] },
    supplierAdmin: { read: [7], update: [7] },
  },

  // | AÜG-Erlaubnis (3.2)
  // | MA: A L Ä S X | MD: L S[34] | KB: – | KG: – | KE: L[36] | LD: L[7] |
  // | LA: A[7] L[7] Ä[37] S[20] | AN: – |
  supplierPermit: {
    operatorAdmin: MA_FULL,
    operatorCoordinator: { read: [], transition: [34] },
    procurementController: { read: [36] },
    supplierCoordinator: { read: [7] },
    supplierAdmin: { create: [7], read: [7], update: [37], transition: [20] },
  },

  // | Rahmenvertrag (3.3)
  // | MA: A L Ä S X | MD: L | KB: – | KG: – | KE: L[2] | LD: L[40] |
  // | LA: L[40] | AN: – |
  masterAgreement: {
    operatorAdmin: MA_FULL,
    operatorCoordinator: { read: [] },
    procurementController: { read: [2] },
    supplierCoordinator: { read: [40] },
    supplierAdmin: { read: [40] },
  },

  // | Preisliste, Preisposition (3.3)
  // | MA: A L Ä S X | MD: L | KB: – | KG: L[8] | KE: L[2] L[41] |
  // | LD: L[9] L[42] | LA: L[9] L[42] | AN: – |
  //
  // Zwei Fußnoten an derselben Operation gelten **beide**: die Zelle trägt sie
  // als Liste, und check.ts verlangt jede einzeln.
  rateCard: {
    operatorAdmin: MA_FULL,
    operatorCoordinator: { read: [] },
    approver: { read: [8] },
    procurementController: { read: [2, 41] },
    supplierCoordinator: { read: [9, 42] },
    supplierAdmin: { read: [9, 42] },
  },

  // | Tarifzuordnung (3.3)
  // | MA: A L Ä S X | MD: L | KB: – | KG: – | KE: L[2] | LD: L[7] |
  // | LA: L[7] | AN: – |
  collectiveAgreementAssignment: {
    operatorAdmin: MA_FULL,
    operatorCoordinator: { read: [] },
    procurementController: { read: [2] },
    supplierCoordinator: { read: [7] },
    supplierAdmin: { read: [7] },
  },

  // | Vergleichsentgelt (3.3)
  // | MA: A L Ä X | MD: L | KB: – | KG: L[8] | KE: A[2] L[2] Ä[2] X[2] |
  // | LD: – | LA: – | AN: – |
  //
  // Kein Recht für Lieferantenrollen: der Verleiher erhält den Wert für den
  // konkreten Einsatz (3.7), nicht das Entgeltgefüge des Entleihers (3.3).
  comparableWageEntry: {
    operatorAdmin: MA_WITHOUT_TRANSITION,
    operatorCoordinator: { read: [] },
    approver: { read: [8] },
    procurementController: { create: [2], read: [2], update: [2], delete: [2] },
  },

  // | Bedarfsanfrage (3.4)
  // | MA: A L Ä S X | MD: A[10] L Ä S | KB: A L[2] Ä[11] S[12] | KG: L[2] S[13] |
  // | KE: L[2] | LD: L[14] | LA: – | AN: – |
  demandRequest: {
    operatorAdmin: MA_FULL,
    operatorCoordinator: { create: [10], read: [], update: [], transition: [] },
    demandOwner: { create: [], read: [2], update: [11], transition: [12] },
    approver: { read: [2], transition: [13] },
    procurementController: { read: [2] },
    supplierCoordinator: { read: [14] },
  },

  // | Ausschreibung, Einladung (3.5)
  // | MA: A L Ä S X | MD: A L Ä S | KB: L[15] | KG: – | KE: L[15] |
  // | LD: L[16] S[46] | LA: – | AN: – |
  tender: {
    operatorAdmin: MA_FULL,
    operatorCoordinator: { create: [], read: [], update: [], transition: [] },
    demandOwner: { read: [15] },
    procurementController: { read: [15] },
    supplierCoordinator: { read: [16], transition: [46] },
  },

  // | Lieferantenangebot, Angebotsposition (3.5)
  // | MA: L S X | MD: L S[17] | KB: L[18] | KG: – | KE: L[2] |
  // | LD: A L[7] Ä[19] S[20] X[21] | LA: L[7] | AN: – |
  //
  // Kein `A` und kein `Ä` für den Betreiber: fremderstellte Inhalte kann er
  // sperren oder stornieren, aber nicht inhaltlich ändern (2.1, 4.2.2).
  supplierOffer: {
    operatorAdmin: { read: [], transition: [], delete: [] },
    operatorCoordinator: { read: [], transition: [17] },
    demandOwner: { read: [18] },
    procurementController: { read: [2] },
    supplierCoordinator: {
      create: [],
      read: [7],
      update: [19],
      transition: [20],
      delete: [21],
    },
    supplierAdmin: { read: [7] },
  },

  // | Kandidat / Profilvorschlag (3.6)
  // | MA: L S X | MD: L Ä[22] S[17] | KB: L[23] S[24] | KG: – | KE: – |
  // | LD: A L[7] Ä[7] S[20] X[21] | LA: L[7] | AN: L[4] |
  //
  // Kein `A` und kein `Ä` für den Betreiber an den fachlichen Angaben: der
  // Lieferant ist Eigentümer der Personendaten; `MA` darf sperren oder
  // stornieren, `MD` nur Pseudonymisierung und Freigabe ändern ([22], 3.6).
  // Für `KG` und `KE` trägt die Zeile **nichts**: die Auswahl ist Sache des
  // Bedarfsträgers, und Personendaten gehen Genehmigung und Einkauf nicht an.
  candidate: {
    operatorAdmin: { read: [], transition: [], delete: [] },
    operatorCoordinator: { read: [], update: [22], transition: [17] },
    demandOwner: { read: [23], transition: [24] },
    supplierCoordinator: {
      create: [],
      read: [7],
      update: [7],
      transition: [20],
      delete: [21],
    },
    supplierAdmin: { read: [7] },
    temporaryWorker: { read: [4] },
  },

  // | Personenidentität (3.6)
  // | MA: A L Ä X | MD: A L Ä[43] | KB: – | KG: – | KE: – | LD: – | LA: – |
  // | AN: – |
  //
  // **Ausschließlich Betreibermandant.** Kunden und Lieferanten sehen das
  // Objekt und seine Existenz nicht ([43], 2.3 Regel 4) — deshalb trägt die
  // Zeile für sie keine Zelle, nicht einmal ein eingeschränktes `L`. Kein `S`:
  // die Personenidentität hat kein Statusmodell (3.6).
  workerIdentity: {
    operatorAdmin: MA_WITHOUT_TRANSITION,
    operatorCoordinator: { create: [], read: [], update: [43] },
  },

  // | Einsatz, Verlängerung, Unterbrechung (3.7)
  // | MA: A L Ä S X | MD: A L Ä S | KB: L[2] S[25] | KG: L[2] S[26] |
  // | KE: L[2] | LD: L[7] S[25] | LA: L[7] | AN: L[4] |
  //
  // Verlängerung und Unterbrechung teilen diese Zeile (2.2, Lesart; 3.7).
  assignment: {
    operatorAdmin: MA_FULL,
    operatorCoordinator: { create: [], read: [], update: [], transition: [] },
    demandOwner: { read: [2], transition: [25] },
    approver: { read: [2], transition: [26] },
    procurementController: { read: [2] },
    supplierCoordinator: { read: [7], transition: [25] },
    supplierAdmin: { read: [7] },
    temporaryWorker: { read: [4] },
  },

  // | Dokument / Nachweis (3.10)
  // | MA: A L Ä S X | MD: L S[34] | KB: L[35] | KG: – | KE: L[36] |
  // | LD: A L[7] Ä[37] | LA: A L[7] Ä[37] X[37] | AN: L[4] |
  //
  // Drei Dinge sind an dieser Zeile bemerkenswert und stehen so in 2.2:
  //
  //  - `MD` trägt **kein** `Ä`. Der Betreiberdisponent erkennt an oder weist
  //    zurück ([34]); den Nachweis selbst ändert er nicht.
  //  - `KB` trägt **nur** `L[35]`, obwohl 5.4.3 ihn unter den Rollen nennt, die
  //    einen einsatzbezogenen Nachweis einstellen. Der Widerspruch ist
  //    *offene Frage 42* und wird hier nicht durch ein zusätzliches `A`
  //    aufgelöst: die Matrix bleibt der Wortlaut von 2.2.
  //  - `LD` hat `A`, aber **kein** `X`: löschen darf nur der
  //    Lieferantenadministrator, und auch er nur bis zur Anerkennung ([37]).
  document: {
    operatorAdmin: MA_FULL,
    operatorCoordinator: { read: [], transition: [34] },
    demandOwner: { read: [35] },
    procurementController: { read: [36] },
    supplierCoordinator: { create: [], read: [7], update: [37] },
    supplierAdmin: { create: [], read: [7], update: [37], delete: [37] },
    temporaryWorker: { read: [4] },
  },

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

  // | Stundenzettel, Freigabeschritt (3.8)
  // | MA: A L Ä S X | MD: A[27] L Ä[28] S | KB: L[2] S[29] | KG: L[2] S[29] |
  // | KE: L[2] | LD: A[27] L[7] Ä[28] S[20] | LA: L[7] | AN: A[4] L[4] Ä[4] S[4] |
  //
  // Der Freigabeschritt teilt diese Zeile (2.2, Lesart). `MD` trägt `S` ohne
  // Fußnote, weil 4.4 ihm den Systemübergang und — nach der Entscheidung zu
  // *Frage 5* — eine eigene Stufe zuweist; welche Stufe, prüft [29] am
  // Vorgang.
  timesheet: {
    operatorAdmin: MA_FULL,
    operatorCoordinator: { create: [27], read: [], update: [28], transition: [] },
    demandOwner: { read: [2], transition: [29] },
    approver: { read: [2], transition: [29] },
    procurementController: { read: [2] },
    supplierCoordinator: { create: [27], read: [7], update: [28], transition: [20] },
    supplierAdmin: { read: [7] },
    temporaryWorker: { create: [4], read: [4], update: [4], transition: [4] },
  },

  // | Zeitposition (3.8)
  // | MA: A L Ä X[44] | MD: A[27] L Ä[28] | KB: L[2] | KG: L[2] | KE: L[2] |
  // | LD: A[27] L[7] Ä[28] | LA: L[7] | AN: A[4] L[4] Ä[4] |
  //
  // **Kein `S` in dieser Zeile**, auch nicht für `MA`: die Zeitposition trägt
  // keinen eigenen Status ([44], 3.8). Und `MA` trägt bei `X` eine Fußnote —
  // die einzige Stelle, an der die Matrix dem Betreiberadministrator eine
  // Einschränkung auferlegt: entfernt wird nur vor der Einreichung.
  timeEntry: {
    operatorAdmin: { create: [], read: [], update: [], delete: [44] },
    operatorCoordinator: { create: [27], read: [], update: [28] },
    demandOwner: { read: [2] },
    approver: { read: [2] },
    procurementController: { read: [2] },
    supplierCoordinator: { create: [27], read: [7], update: [28] },
    supplierAdmin: { read: [7] },
    temporaryWorker: { create: [4], read: [4], update: [4] },
  },

  // | Zuschlagsart (Katalog, 3.8)
  // | MA: A L Ä X | MD: L | KB: – | KG: – | KE: L[2] | LD: L[9] | LA: – | AN: – |
  //
  // Ein Katalog ohne Statusmodell: kein `S`. Der Lieferant sieht nur
  // Zuschlagsarten, die in seinen eigenen Konditionen vorkommen ([9]).
  premiumType: {
    operatorAdmin: MA_WITHOUT_TRANSITION,
    operatorCoordinator: { read: [] },
    procurementController: { read: [2] },
    supplierCoordinator: { read: [9] },
  },

  // | Abrechnungsbeleg, Belegposition (3.9)
  // | MA: A L Ä S X | MD: A L S[30] | KB: – | KG: – | KE: L[2] S[31] |
  // | LD: L[7] S[32] | LA: L[7] | AN: – |
  //
  // Die Belegposition teilt diese Zeile (4.5, Satz 2). Drei Dinge sind an ihr
  // bemerkenswert, und alle drei sind Absicht:
  //
  //  - **`MD` trägt kein `Ä`.** Eine inhaltliche Änderung kann nur `MA`
  //    vornehmen; der Regelfall ist Storno und Neuerstellung (4.5.2,
  //    Zustand `created`). Deshalb steht hier `create`, `read` und
  //    `transition` — und kein `update`.
  //  - **`KB` und `KG` fehlen vollständig.** Der Beleg ist kaufmännisch;
  //    Bedarfsträger und Genehmiger sehen ihn nicht. Das ist die einzige Zeile
  //    der Kundenseite, in der nur `KE` steht.
  //  - **Die Gegenseiten tragen kein `A`.** Im Gutschriftverfahren
  //    (Entscheidung zu *Frage 6*) legt der Lieferant keinen Beleg an ([32]);
  //    Variante B würde hier ein `A[7]` verlangen und ist nicht umgesetzt
  //    (4.5.2).
  billingDocument: {
    operatorAdmin: MA_FULL,
    operatorCoordinator: { create: [], read: [], transition: [30] },
    procurementController: { read: [2], transition: [31] },
    supplierCoordinator: { read: [7], transition: [32] },
    supplierAdmin: { read: [7] },
  },

  // | Abrechnungsperiode (3.9)
  // | MA: A L Ä S X | MD: L S[33] | KB: – | KG: – | KE: L[2] | LD: L[7] |
  // | LA: L[7] | AN: – |
  //
  // `MD` trägt **kein** `A`, aber `S[33]` — und [33] lautet „Öffnen und
  // Schließen einer Abrechnungsperiode". Das Öffnen ist damit ein Übergang und
  // keine Anlage; lib/status/billingPeriod.ts sagt es am Übergang selbst
  // (`operation: 'transition'`).
  billingPeriod: {
    operatorAdmin: MA_FULL,
    operatorCoordinator: { read: [], transition: [33] },
    procurementController: { read: [2] },
    supplierCoordinator: { read: [7] },
    supplierAdmin: { read: [7] },
  },

  // | Audit-Eintrag (3.12)
  // | MA: L | MD: L[39] | KB: – | KG: – | KE: L[39] | LD: – | LA: L[39] | AN: – |
  //
  // Nur `L`, in jeder Spalte: Einträge entstehen ausschließlich durch das
  // System und sind für jede Rolle unveränderlich (3.12, [39]). Deshalb trägt
  // die Zeile kein `A`, kein `Ä`, kein `S` und kein `X` — auch nicht für `MA`.
  // Das ist die einzige Zeile der Matrix ohne `MA_FULL`.
  auditEntry: {
    operatorAdmin: { read: [] },
    operatorCoordinator: { read: [39] },
    procurementController: { read: [39] },
    supplierAdmin: { read: [39] },
  },

  // | Benachrichtigung (3.14)
  // | MA: L | MD: L[47] | KB: L[47] | KG: L[47] | KE: L[47] | LD: L[47] |
  // | LA: L[47] | AN: L[4] |
  //
  // Wie die Zeile zum Protokoll trägt sie **nur** `L`: eine Benachrichtigung
  // entsteht durch das System und wird gelesen, sonst nichts (3.14). Anders
  // als dort steht sie **jeder** Rolle offen — aber nur für die Nachrichten,
  // die an die eigene Rollenzuweisung gerichtet sind ([47]). `MA` trägt keine
  // Fußnote: er sieht das Aufkommen des Betriebs, wie er das Protokoll sieht.
  notification: {
    operatorAdmin: { read: [] },
    operatorCoordinator: { read: [47] },
    demandOwner: { read: [47] },
    approver: { read: [47] },
    procurementController: { read: [47] },
    supplierCoordinator: { read: [47] },
    supplierAdmin: { read: [47] },
    temporaryWorker: { read: [4] },
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
