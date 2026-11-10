/**
 * Statusmodell des Lieferanten — SPEC 4.6, Objekt `supplier` (3.2).
 *
 * Zustände: `onboarding` → `active` ↔ `blocked`, und aus allen dreien
 * `inactive`, aus dem `MA` reaktivieren darf.
 *
 * **Drei Wege nach `active`, drei Namen.** 4.6 führt sie in drei Zeilen mit
 * **verschiedenen** Vorbedingungen: das erstmalige Freischalten
 * (`activate`), die Entsperrung (`unblock`, mit Vier-Augen-Prinzip und
 * Aufhebungsgrund) und die Reaktivierung (`reactivate`, mit Begründung). Ein
 * gemeinsamer Übergang „nach aktiv" würde die Unterschiede verschlucken —
 * und die geschlossene Übergangsmenge soll sie tragen (4.0, Regel 1).
 *
 * **Die AÜG-Erlaubnis ist hier Vorbedingung, nicht Zustand** (4.6). Sie hat
 * ihr eigenes Objekt mit eigenem Nachweisfluss (3.2, 5.4.3); ihr Ablauf
 * wechselt **keinen** Lieferantenstatus — 5.4.2 a) hat das ausdrücklich
 * entschieden. Die Wirkung tritt ohne Statuswechsel über P9 ein.
 *
 * Nicht vorhanden — und damit nicht ausdrückbar:
 *
 *  - **Entsperrung durch `MD`.** Fußnote [5] sagt: sperren ja, entsperren
 *    nein. Der Übergang trägt deshalb nur `MA`; zusätzlich prüft die Fußnote
 *    an der Matrixzeile den Zielstatus.
 *  - **`onboarding` → `blocked`** als Umweg um die Voraussetzungen. Fehlende
 *    Nachweise im Onboarding sind keine Sperre, sondern ein noch nicht
 *    erfüllter Übergang (4.6, „Ausgeschlossen").
 *  - **`inactive` bei laufendem Einsatz.** Erst sind die Einsätze zu beenden
 *    (4.3), dann endet die Beauftragung — das ist eine Vorbedingung und keine
 *    Nebenwirkung, weil ein Statuswechsel am Lieferanten keine Überlassung
 *    still beenden darf.
 *  - **ein zeitgesteuerter Übergang.** Weder der Ablauf der Erlaubnis noch das
 *    Vertragsende sperren selbst (5.4.2 a); der nächtliche Lauf stellt den
 *    Ablauf fest und eskaliert mit dem **Vorschlag** zu sperren, den Übergang
 *    vollzieht `MA` oder `MD` mit `blockReason`.
 *  - **ein Zustand für die Sperre aus einem Prüfergebnis.** `blocked`
 *    beschreibt die Organisation; ein Ergebnis „Sperre" aus 5.5 bleibt ein
 *    Prüfergebnis und erzeugt keinen Zustand (4.0, Regel 5).
 *
 * **Endzustände: keiner.** `inactive` ist der Ruhezustand am Ende der
 * Beauftragung, aus dem `MA` reaktivieren darf — 4.6 nennt das ausdrücklich
 * „die einzige Ausnahme von 4.0 Regel 9".
 */
import type { Precondition, StatusModel, TransitionDefinition } from './machine'

export type SupplierState = 'onboarding' | 'active' | 'blocked' | 'inactive'

/**
 * Die Tatsachen, die die Vorbedingungen aus 4.6 brauchen. Erhoben werden sie
 * vom Aufrufer (`lib/services/supplierStatus.ts`), nicht hier gelesen: dieses
 * Modul ist rein und ohne Datenbank prüfbar.
 *
 * **Zwei Angaben sind Ergebnisse des Regelwerks aus Kapitel 5** und werden
 * dort gerechnet: `hasAcceptedValidPermit` (P9, 5.4.1) und
 * `mandatoryDocumentsPresent` (P10, 5.4.4). Der Stichtag ist nach 5.0 der
 * **Tag des Übergangs** — nicht der Tag des Aufrufs.
 */
export interface SupplierFacts {
  // — Anlage (3.2) —
  readonly supplierNumber: string
  readonly legalName: string
  /** Anschrift vollständig: Straße, Postleitzahl, Ort (3.2). */
  readonly addressComplete: boolean
  /** „mindestens einer" (3.2). */
  readonly contactCount: number

  // — Freischalten (4.6) —
  /** Rahmenvertrag im Status `active` (3.3). */
  readonly hasActiveMasterAgreement: boolean
  /** `supplierCollectiveAgreement` gesetzt — Pflicht ab `active` (3.2). */
  readonly hasCollectiveAgreement: boolean
  /** P9: Erlaubnis anerkannt und am Stichtag gültig (5.4.1). */
  readonly hasAcceptedValidPermit: boolean
  /** P10: Pflichtnachweise des Lieferanten (5.4.4). */
  readonly mandatoryDocumentsPresent: boolean

  // — Sperren und Entsperren —
  /** Pflicht bei `blocked` (3.2, 4.6). */
  readonly blockReason: string | null
  /** Wer gesperrt hat — trägt das Vier-Augen-Prinzip (2.4, Regel 5). */
  readonly blockedById: string | null
  /** Die Person, die den Übergang auslöst. */
  readonly actingUserId: string
  /** „Sperrgrund behoben und dokumentiert" (4.6, `blocked` → `active`). */
  readonly unblockReason: string | null
  /** „Begründung Pflicht" (4.6, `inactive` → `active`). */
  readonly reactivationReason: string | null

  // — Beenden —
  /** `validTo` gesetzt (3.2, 4.6). */
  readonly validTo: Date | null
  /** Einsätze in `planned`, `active` oder `interrupted` (4.3). */
  readonly runningAssignments: number

  /** Stichtag: Tag des Übergangs (5.0). */
  readonly evaluationDate: Date
}

type SupplierPrecondition = Precondition<SupplierFacts>
type SupplierTransition = TransitionDefinition<SupplierState, SupplierFacts>

/**
 * Die Voraussetzungen, die **jeder** Weg nach `active` teilt: Rahmenvertrag,
 * Tarifbindung und die anerkannte, gültige Erlaubnis. 4.6 nennt sie beim
 * Freischalten vollständig und bei der Reaktivierung mit „wie `onboarding` →
 * `active`"; bei der Entsperrung nennt es die Erlaubnis ausdrücklich.
 */
const activeMasterAgreement: SupplierPrecondition = {
  description: 'Ein Rahmenvertrag der Lieferantenseite steht im Status `active` (3.3).',
  specReference: 'SPEC 4.6, → active; 3.3',
  isSatisfied: (facts) => facts.hasActiveMasterAgreement,
}

const collectiveAgreement: SupplierPrecondition = {
  description:
    '`supplierCollectiveAgreement` ist gesetzt — Pflicht ab Status `active` (3.2). Ohne sie ' +
    'fehlt die Grundlage für jede Abweichung vom Gleichstellungsgrundsatz (5.2).',
  specReference: 'SPEC 4.6, → active; 3.2',
  isSatisfied: (facts) => facts.hasCollectiveAgreement,
}

/** P9 (5.4.1) — in 4.7 die Zeilen Q41, Q43 und Q44, jede mit **Sperre**. */
const permitAccepted: SupplierPrecondition = {
  ruleRef: 'P9',
  description: 'P9: AÜG-Erlaubnis anerkannt und am Tag des Übergangs gültig (5.4.1).',
  specReference: 'SPEC 4.6, → active; 5.4.1; 4.7 Q41, Q43, Q44',
  isSatisfied: (facts) => facts.hasAcceptedValidPermit,
}

/**
 * P10 (5.4.4) — in 4.7 die Zeilen Q42, Q43 und Q44.
 *
 * **Die Ergebnisart kommt aus dem Pflichtkatalog**, nicht aus der Zeile in
 * 4.7: für den Lieferanten führt der Katalog nur die
 * Unbedenklichkeitsbescheinigung, und die trägt „nie Sperre". Die Tatsache ist
 * deshalb in der Regel erfüllt, auch wenn der Nachweis fehlt — das ist
 * *offene Frage 31*, und sie hält ausdrücklich fest, dass die Rechnung dem
 * Katalog folgt. Die Vorbedingung steht hier trotzdem: sie ist der Ort, an dem
 * eine andere Antwort auf Frage 31 wirksam würde, ohne das Modell zu ändern.
 */
const mandatoryDocuments: SupplierPrecondition = {
  ruleRef: 'P10',
  description: 'P10: Pflichtnachweise des Lieferanten vorhanden (5.4.4).',
  specReference: 'SPEC 4.6, → active; 5.4.4; 4.7 Q42, Q43, Q44',
  isSatisfied: (facts) => facts.mandatoryDocumentsPresent,
}

const TRANSITIONS = {
  /**
   * | — | `onboarding` | `MA` | `supplierNumber`, `legalName`, `address`,
   * mindestens ein Ansprechpartner | Lieferantenmandant wird angelegt (3.11);
   * `LA` kann Stammdaten und Nachweise pflegen ([7]) |
   */
  create: {
    from: [],
    to: 'onboarding',
    label: 'Lieferant anlegen',
    roles: ['operatorAdmin'],
    specReference: 'SPEC 4.6, — → onboarding',
    preconditions: [
      {
        description: 'Lieferantennummer und Firmenname sind gesetzt (3.2).',
        specReference: 'SPEC 4.6, — → onboarding; 3.2',
        isSatisfied: (facts) =>
          facts.supplierNumber.trim() !== '' && facts.legalName.trim() !== '',
      },
      {
        description: 'Die Anschrift ist vollständig (3.2).',
        specReference: 'SPEC 4.6, — → onboarding; 3.2',
        isSatisfied: (facts) => facts.addressComplete,
      },
      {
        description: 'Mindestens ein Ansprechpartner (3.2).',
        specReference: 'SPEC 4.6, — → onboarding; 3.2',
        isSatisfied: (facts) => facts.contactCount >= 1,
      },
    ],
  },

  /**
   * | `onboarding` | `active` | `MA` | Rahmenvertrag `active` (3.3);
   * `supplierCollectiveAgreement` gesetzt; AÜG-Erlaubnis anerkannt und gültig
   * (5.4); Pflichtnachweise vorhanden | Benachrichtigung an `LA` und `LD`; der
   * Lieferant erscheint im Einladungskreis (4.2); AÜG-Prüfungen P9, P10 |
   */
  activate: {
    from: ['onboarding'],
    to: 'active',
    label: 'freischalten',
    roles: ['operatorAdmin'],
    specReference: 'SPEC 4.6, onboarding → active',
    preconditions: [
      activeMasterAgreement,
      collectiveAgreement,
      permitAccepted,
      mandatoryDocuments,
    ],
  },

  /**
   * | `active` | `blocked` | `MA`, `MD` ([5]) | `blockReason` Pflicht | keine
   * neue Einladung, kein neues Angebot, kein neuer Profilvorschlag, kein neuer
   * Einsatz; laufende Einsätze laufen weiter |
   */
  block: {
    from: ['active'],
    to: 'blocked',
    label: 'sperren',
    roles: ['operatorAdmin', 'operatorCoordinator'],
    specReference: 'SPEC 4.6, active → blocked',
    preconditions: [
      {
        description: 'Der Sperrgrund ist Pflicht (3.2, 4.6).',
        specReference: 'SPEC 4.6, active → blocked; 3.2',
        isSatisfied: (facts) =>
          facts.blockReason !== null && facts.blockReason.trim() !== '',
      },
    ],
  },

  /**
   * | `blocked` | `active` | **nur** `MA` ([5]) | Sperrgrund behoben und
   * dokumentiert; Auslöser ist nicht die sperrende Person (Vier-Augen, 2.4
   * Regel 5); Erlaubnis gültig und anerkannt | Protokolleintrag mit
   * Aufhebungsgrund |
   *
   * `MD` fehlt hier **nicht aus Versehen**: [5] sagt „sperren ja, entsperren
   * nein".
   */
  unblock: {
    from: ['blocked'],
    to: 'active',
    label: 'entsperren',
    roles: ['operatorAdmin'],
    specReference: 'SPEC 4.6, blocked → active',
    preconditions: [
      {
        description:
          'Der Aufhebungsgrund ist Pflicht: 4.6 verlangt den Sperrgrund „behoben **und ' +
          'dokumentiert**".',
        specReference: 'SPEC 4.6, blocked → active',
        isSatisfied: (facts) =>
          facts.unblockReason !== null && facts.unblockReason.trim() !== '',
      },
      {
        description:
          'Die entsperrende Person ist nicht die sperrende (Vier-Augen-Prinzip, 2.4 Regel 5).',
        specReference: 'SPEC 4.6, blocked → active; 2.4, Regel 5',
        isSatisfied: (facts) =>
          facts.blockedById === null || facts.blockedById !== facts.actingUserId,
      },
      permitAccepted,
      mandatoryDocuments,
    ],
  },

  /**
   * | `onboarding`, `active`, `blocked` | `inactive` | `MA` | `validTo`
   * gesetzt; kein Einsatz dieses Lieferanten in `planned`, `active` oder
   * `interrupted` | Zugänge werden gesperrt (3.11); offene Einladungen und
   * Angebote enden (4.2); Historie bleibt lesbar |
   */
  deactivate: {
    from: ['onboarding', 'active', 'blocked'],
    to: 'inactive',
    label: 'Beauftragung beenden',
    roles: ['operatorAdmin'],
    specReference: 'SPEC 4.6, → inactive',
    preconditions: [
      {
        description: '`validTo` ist gesetzt (3.2, 4.6).',
        specReference: 'SPEC 4.6, → inactive; 3.2',
        isSatisfied: (facts) => facts.validTo !== null,
      },
      {
        description:
          'Kein Einsatz dieses Lieferanten in `planned`, `active` oder `interrupted` (4.3). ' +
          'Erst sind die Einsätze zu beenden, dann endet die Beauftragung.',
        specReference: 'SPEC 4.6, → inactive; 4.3',
        isSatisfied: (facts) => facts.runningAssignments === 0,
      },
    ],
  },

  /**
   * | `inactive` | `active` | **nur** `MA` ([5]) | Reaktivierung:
   * Rahmenvertrag und Erlaubnis wieder gültig und anerkannt; Begründung
   * Pflicht | wie `onboarding` → `active`; Protokolleintrag mit
   * Reaktivierungsgrund |
   */
  reactivate: {
    from: ['inactive'],
    to: 'active',
    label: 'reaktivieren',
    roles: ['operatorAdmin'],
    specReference: 'SPEC 4.6, inactive → active',
    preconditions: [
      {
        description: 'Die Begründung der Reaktivierung ist Pflicht (4.6).',
        specReference: 'SPEC 4.6, inactive → active',
        isSatisfied: (facts) =>
          facts.reactivationReason !== null && facts.reactivationReason.trim() !== '',
      },
      activeMasterAgreement,
      collectiveAgreement,
      permitAccepted,
      mandatoryDocuments,
    ],
  },
} as const satisfies Readonly<Record<string, SupplierTransition>>

export const SUPPLIER_MODEL: StatusModel<SupplierState, SupplierFacts, typeof TRANSITIONS> = {
  object: 'Lieferant / Verleiher (3.2)',
  specReference: 'SPEC 4.6',
  states: ['onboarding', 'active', 'blocked', 'inactive'],
  /**
   * **Keiner.** 4.6 sagt es ausdrücklich: „keiner im strengen Sinn. `inactive`
   * ist der Ruhezustand am Ende der Beauftragung, aus dem `MA` reaktivieren
   * darf ([5]). Das ist die einzige Ausnahme von 4.0 Regel 9."
   */
  terminalStates: [],
  transitions: TRANSITIONS,
}

export type SupplierTransitionName = keyof typeof TRANSITIONS & string

/** Deutsche Bezeichnung der Zustände (4.6), für die Oberfläche. */
export const SUPPLIER_STATE_LABELS: { readonly [S in SupplierState]: string } = {
  onboarding: 'Onboarding',
  active: 'aktiv',
  blocked: 'gesperrt',
  inactive: 'inaktiv',
}
