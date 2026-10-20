/**
 * Objektzeilen der Berechtigungsmatrix (SPEC 2.2).
 *
 * Ein `ResourceType` ist **eine Zeile** der Matrix, nicht eine Tabelle: wo
 * Kapitel 3 es ausdrücklich sagt, teilen Unterobjekte die Zeile ihres
 * Hauptobjekts (2.2, Lesart). Deshalb trägt `supplierOffer` auch die
 * Angebotsposition und `assignment` auch Verlängerung und Unterbrechung.
 *
 * Alle 24 Zeilen sind hier benannt, damit die Matrix in lib/authz/matrix.ts
 * die einzige Stelle bleibt, an der Rechte stehen. Belegt sind die Zeilen zu
 * 3.1 bis 3.5 und die beiden Zeilen zu 3.11; jede unbelegte Zeile verweigert
 * jeden Zugriff, weil Sichtbarkeit positiv festgelegt ist (2.3).
 */
export type ResourceType =
  // 3.1 Kunde, Standort, Kostenstelle
  | 'customer'
  | 'site'
  | 'costCenter'
  // 3.2 Lieferant und AÜG-Erlaubnis
  | 'supplier'
  | 'supplierPermit'
  // 3.3 Vertragsrahmen und Konditionen
  | 'masterAgreement'
  | 'rateCard'
  | 'collectiveAgreementAssignment'
  | 'comparableWageEntry'
  // 3.4 Bedarfsanfrage
  | 'demandRequest'
  // 3.5 Ausschreibung und Angebot
  | 'tender'
  | 'supplierOffer'
  // 3.6 Kandidat und Personenidentität
  | 'candidate'
  | 'workerIdentity'
  // 3.7 Einsatz
  | 'assignment'
  // 3.8 Zeiten
  | 'timesheet'
  | 'timeEntry'
  | 'premiumType'
  // 3.9 Abrechnung
  | 'billingDocument'
  | 'billingPeriod'
  // 3.10 Nachweise
  | 'document'
  // 3.11 Benutzerverwaltung
  | 'userAndRoleAssignment'
  | 'delegation'
  // 3.12 Protokoll
  | 'auditEntry'

/** Zeilenbeschriftung wie in SPEC 2.2, für Oberfläche und Protokoll. */
export const RESOURCE_LABELS: { readonly [T in ResourceType]: string } = {
  customer: 'Kunde / Entleiher (3.1)',
  site: 'Standort (3.1)',
  costCenter: 'Kostenstelle (3.1)',
  supplier: 'Lieferant / Verleiher (3.2)',
  supplierPermit: 'AÜG-Erlaubnis (3.2)',
  masterAgreement: 'Rahmenvertrag (3.3)',
  rateCard: 'Preisliste, Preisposition (3.3)',
  collectiveAgreementAssignment: 'Tarifzuordnung (3.3)',
  comparableWageEntry: 'Vergleichsentgelt (3.3)',
  demandRequest: 'Bedarfsanfrage (3.4)',
  tender: 'Ausschreibung, Einladung (3.5)',
  supplierOffer: 'Lieferantenangebot, Angebotsposition (3.5)',
  candidate: 'Kandidat / Profilvorschlag (3.6)',
  workerIdentity: 'Personenidentität (3.6)',
  assignment: 'Einsatz, Verlängerung, Unterbrechung (3.7)',
  timesheet: 'Stundenzettel, Freigabeschritt (3.8)',
  timeEntry: 'Zeitposition (3.8)',
  premiumType: 'Zuschlagsart (Katalog, 3.8)',
  billingDocument: 'Abrechnungsbeleg, Belegposition (3.9)',
  billingPeriod: 'Abrechnungsperiode (3.9)',
  document: 'Dokument / Nachweis (3.10)',
  userAndRoleAssignment:
    'Benutzer, Rollenzuweisung, Mandantenzuordnung, Zuständigkeit (3.11)',
  delegation: 'Vertretung (3.11)',
  auditEntry: 'Audit-Eintrag (3.12)',
}

/**
 * Fachliches Objekt → Matrixzeile.
 *
 * Die Zeile zu 3.11 bündelt vier Objekte: Benutzer, Rollenzuweisung,
 * Mandantenzuordnung (das Feld `tenantId` am Benutzer — 3.11 führt dafür kein
 * eigenes Objekt) und Zuständigkeit.
 *
 * Die **Betreuungszuordnung** (`accountAssignment`, 3.11) ist in 2.2 in keiner
 * Zeile genannt. Sie wird hier derselben Zeile zugeordnet, weil 2.1 die
 * Verwaltung der Mandanten- und Betreuungszuordnungen dem `MA` zuweist. Die
 * Lücke in 2.2 ist in PROGRESS.md unter „Offen" benannt.
 *
 * Der **Mandant** (`tenant`) fehlt hier bewusst: 3.11 sagt ausdrücklich, dass
 * die Matrix für ihn keine eigene Zeile trägt — er wird mit dem Kunden (3.1)
 * bzw. dem Lieferanten (3.2) gepflegt und folgt deren Zeile.
 *
 * **Unterobjekte** stehen auf der Zeile ihres Hauptobjekts, wo Kapitel 3 das
 * ausdrücklich sagt (2.2, Lesart): Preisposition → Preisliste,
 * Angebotsposition → Lieferantenangebot, Anforderung → Bedarfsanfrage,
 * Einladung → Ausschreibung.
 *
 * Der **Ansprechpartner** (3.1, 3.2) ist hier nicht genannt: 2.2 führt ihn
 * nicht als Objekt, sondern als **Feld** seines Eigentümers — Fußnote [1]
 * nennt ihn ausdrücklich unter den Feldern ohne kaufmännische Wirkung. Er
 * folgt deshalb der Zeile von Kunde, Standort bzw. Lieferant.
 */
export const MATRIX_ROW_BY_OBJECT = {
  user: 'userAndRoleAssignment',
  roleAssignment: 'userAndRoleAssignment',
  tenantAssignment: 'userAndRoleAssignment',
  responsibilityScope: 'userAndRoleAssignment',
  accountAssignment: 'userAndRoleAssignment',
  delegation: 'delegation',
  customer: 'customer',
  site: 'site',
  costCenter: 'costCenter',
  supplier: 'supplier',
  supplierPermit: 'supplierPermit',
  masterAgreement: 'masterAgreement',
  rateCard: 'rateCard',
  rateCardItem: 'rateCard',
  collectiveAgreementAssignment: 'collectiveAgreementAssignment',
  comparableWageEntry: 'comparableWageEntry',
  demandRequest: 'demandRequest',
  demandRequestQualification: 'demandRequest',
  tender: 'tender',
  tenderInvitation: 'tender',
  supplierOffer: 'supplierOffer',
  supplierOfferItem: 'supplierOffer',
} as const satisfies Record<string, ResourceType>

export type ModelName = keyof typeof MATRIX_ROW_BY_OBJECT
