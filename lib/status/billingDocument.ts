/**
 * Statusmodell des Abrechnungsbelegs — SPEC **4.5.2**, Objekte
 * `billingDocument` und `billingDocumentItem` (3.9).
 *
 * `created` → `inReview` → `released`, von dort `disputed` (und über die
 * Klärung zurück in die Prüfung) oder — **nur auf der Einkaufsseite** —
 * `confirmed`. Aus jedem dieser Zustände führt `cancelled`.
 *
 * **Zwei Seiten, ein Modell.** 4.5.2 führt die Spalte „Seite / Variante": die
 * Zustände sind für Verkauf und Einkauf dieselben, die **auslösenden Rollen**
 * sind es nicht. Die Kundenseite beanstandet `KE` ([31]), die Lieferantenseite
 * `LD` ([32]) — und bestätigen kann nur `LD`, weil „die Verkaufsseite keine
 * Bestätigung kennt" (4.5.2). Deshalb gibt es **zwei** Beanstandungsübergänge
 * mit demselben Ziel und nicht einen mit beiden Rollen: sonst könnte `KE`
 * einen Einkaufsbeleg beanstanden, den sie nie sieht. Dieselbe Bauart wie die
 * zwei Genehmigungsübergänge am Stundenzettel (4.4).
 *
 * **Auf der Verkaufsseite ist `released` der Ruhezustand.** 2.2 gibt `KE` mit
 * [31] nur die Beanstandung, keine Bestätigung: der Beleg gilt als akzeptiert,
 * solange keine Beanstandung erfolgt — **ohne** dass ein Übergang das
 * feststellt (4.5.2). Ein Zustand „akzeptiert" wäre eine Behauptung über eine
 * Handlung, die niemand vorgenommen hat.
 *
 * **Keine AÜG-Sperre an diesem Modell.** 4.7 ordnet dem Beleg drei Zeilen zu —
 * **Q38** (P9, Erlaubnis im Leistungszeitraum), **Q39** (P4,
 * Vergleichsentgelt) und **Q40** (P5, Branchenzuschlagsstufe) —, und alle drei
 * sind Warnung oder Information, keine Sperre. Der Grund steht in 5.5.5: die
 * Leistung ist **erbracht**, und eine Sperre der Abrechnung verhindert keine
 * Überlassung mehr; sie würde dem Leiharbeitnehmer und dem Lieferanten das
 * Entgelt für einen Fehler vorenthalten, der vorher entstanden ist. Deshalb
 * trägt keine Vorbedingung dieses Modells eine `ruleRef` — die Befunde stehen
 * im Ergebnis des Dienstes. Das ist der Gegensatz zu 4.4, wo Q36 die einzige
 * Sperre trägt.
 *
 * **Variante B (Rechnungseingang) ist nicht umgesetzt.** 4.5.2 führt sie als
 * „dokumentierte, nicht umgesetzte Variante" und sagt, was sie verlangen
 * würde: ein `A[7]` für `LD` in 2.2 und eine Erweiterung von [32] um das
 * Einreichen. Mit der Entscheidung zu *Frage 6* (Gutschriftverfahren) bleibt
 * die Matrix wie sie ist, und dieses Modell führt den Übergang deshalb
 * **nicht** — ein Übergang, den die Prüffunktion in jedem Fall verweigert,
 * wäre eine Zeile ohne Weg.
 *
 * Nicht vorhanden — und damit nicht ausdrückbar:
 *
 *  - **Freigabe durch den Ersteller.** Vier-Augen-Prinzip ([30], 2.4 Regel 5).
 *    Die Vorbedingung prüft die **Person** und trifft damit auch `MA`, dessen
 *    Zelle in 2.2 keine Fußnote trägt.
 *  - **`released` → `confirmed` auf der Verkaufsseite.** Siehe oben.
 *  - **`disputed` → `released`.** Die Klärung führt zurück in die **Prüfung**;
 *    freigegeben wird erneut, mit erneutem Vier-Augen-Prinzip.
 *  - **Eine Bestätigungsfiktion.** Der Ablauf von `billingReviewDeadlineDays`
 *    erzeugt Erinnerung und Eskalation, nie den Übergang (2.4, Regel 1).
 *  - **Ein Beleg aus nicht genehmigten Zeiten.** `created` setzt ausschließlich
 *    Zettel in `approved` voraus (3.9, 4.4).
 *  - **Eine Änderung eines freigegebenen Belegs.** Korrekturen laufen über
 *    Storno und Nachbeleg; der alte Beleg bleibt (3.9).
 *  - **Ein Weg aus `confirmed` oder `cancelled`.**
 *
 * **Endzustände:** `confirmed` (nur Einkaufsseite) und `cancelled`.
 */
import type { Precondition, StatusModel, TransitionDefinition } from './machine'

export type BillingDocumentState =
  | 'created'
  | 'inReview'
  | 'released'
  | 'disputed'
  | 'confirmed'
  | 'cancelled'

export const BILLING_DOCUMENT_STATE_LABELS: {
  readonly [S in BillingDocumentState]: string
} = {
  created: 'erstellt',
  inReview: 'in Prüfung',
  released: 'freigegeben',
  disputed: 'beanstandet',
  confirmed: 'bestätigt',
  cancelled: 'storniert',
}

/** Belegseite (3.9) — sie entscheidet, welche Gegenseite handelt. */
export type BillingDirection = 'sales' | 'purchase'

/**
 * Die Tatsachen, die die Vorbedingungen aus 4.5.2 brauchen. Erhoben werden sie
 * vom Aufrufer (`lib/services/billing.ts`); dieses Modul rechnet nicht und
 * liest nicht.
 */
export interface BillingDocumentFacts {
  /** Verkauf oder Einkauf (3.9) — Grundlage der seitenweisen Übergänge. */
  readonly direction: BillingDirection
  /** `documentType` passt zur Seite (3.9: „folgt der Belegart"). */
  readonly typeMatchesDirection: boolean

  // — Anlage (4.5.2, — → created) —
  /** Zahl der zugrunde liegenden Stundenzettel; 3.9 verlangt mindestens einen. */
  readonly timesheetCount: number
  /** Alle zugrunde liegenden Zettel stehen auf `approved` (3.9, 4.4). */
  readonly allTimesheetsApproved: boolean
  /** Zustand der Abrechnungsperiode (4.5.1). */
  readonly billingPeriodStatus: 'open' | 'closed'
  /** Zu jeder Leistung gibt es eine Preisposition der **eigenen** Seite (3.3). */
  readonly ratesPresent: boolean
  /** Mindestens eine Belegposition ist entstanden. */
  readonly itemCount: number

  // — Prüfung (4.5.2, created → inReview) —
  /** Summen abgeleitet und mit den Zetteln abgeglichen (4.5.2). */
  readonly amountsMatchTimesheets: boolean

  // — Freigabe (4.5.2, inReview → released) —
  readonly actingUserId: string
  readonly createdById: string

  // — Beanstandung (4.5.2, released → disputed) —
  /** Pflicht bei Beanstandung (3.9, 4.5.2). */
  readonly disputeReason: string | null
  /** Die Prüffrist `billingReviewDeadlineDays` läuft noch (4.0, 4.5.2). */
  readonly withinReviewDeadline: boolean

  // — Bestätigung (4.5.2, released → confirmed) —
  /** Eine erhobene und **nicht geklärte** Beanstandung (4.5.2). */
  readonly openDispute: boolean

  // — Klärung (4.5.2, disputed → inReview) —
  /** Pflicht bei der Rückführung (4.5.2: „Klärung dokumentiert"). */
  readonly disputeResolutionNote: string | null
  /** Ein zugrunde liegender Zettel ist nicht mehr der gültige (4.4). */
  readonly timesheetsChanged: boolean
  /** Zu jedem geänderten Zettel ist die Korrekturfassung genehmigt (4.4). */
  readonly correctionsApproved: boolean

  // — Storno (4.5.2, → cancelled) —
  /** Pflicht bei Storno (4.5.2). */
  readonly cancellationReason: string | null

  /**
   * Stichtag: Prüfzeitraum des Belegs ist „frühester `periodFrom` bis
   * spätester `periodTo` der zugrunde liegenden Zettel" (5.0).
   */
  readonly evaluationDate: Date
}

type BillingPrecondition = Precondition<BillingDocumentFacts>
type BillingTransition = TransitionDefinition<BillingDocumentState, BillingDocumentFacts>

/* ------------------------------------------------------------------ */
/* Vorbedingungen                                                      */
/* ------------------------------------------------------------------ */

/**
 * Vier-Augen-Prinzip der Freigabe (2.4 Regel 5, Fußnote [30]).
 *
 * Geprüft wird die **Person**, nicht die Rolle — und deshalb trifft die Regel
 * auch `MA`, dessen Zelle in 2.2 ein `S` ohne Fußnote trägt. Fußnote [30]
 * prüft dasselbe noch einmal an der Zelle des `MD`: zwei Schichten, damit
 * keine allein hält.
 */
const fourEyes: BillingPrecondition = {
  description:
    'Die freigebende Person hat den Beleg nicht erstellt — Vier-Augen-Prinzip ' +
    '(2.4, Regel 5; Fußnote [30]).',
  specReference: 'SPEC 4.5.2, inReview → released; 2.4, Regel 5',
  isSatisfied: (facts) => facts.actingUserId !== facts.createdById,
}

/** Die Beanstandung trägt ihren Grund (3.9, 4.5.2). */
const disputeReasonGiven: BillingPrecondition = {
  description: 'Der Beanstandungsgrund ist Pflicht (3.9).',
  specReference: 'SPEC 4.5.2, released → disputed; 3.9',
  isSatisfied: (facts) =>
    facts.disputeReason !== null && facts.disputeReason.trim() !== '',
}

/**
 * Die Beanstandung liegt in der Prüffrist (4.5.2: „innerhalb der Prüffrist").
 *
 * `billingReviewDeadlineDays` ist eine **Prozessfrist** (4.0): ihr Ablauf
 * erzeugt Erinnerung und Eskalation, nie einen Übergang. Hier wirkt sie
 * andersherum — sie begrenzt eine Handlung, statt eine auszulösen. Das ist
 * kein Widerspruch zu 2.4 Regel 1: der Beleg bleibt nach Fristablauf
 * `released`, und 4.5.2 nennt diesen Ruhezustand ausdrücklich als „gilt als
 * akzeptiert, solange keine Beanstandung erfolgt".
 */
const withinReviewDeadline: BillingPrecondition = {
  description:
    'Die Prüffrist des Belegs läuft noch (`billingReviewDeadlineDays`, 4.0) — nach ihrem ' +
    'Ablauf gilt der freigegebene Beleg als akzeptiert (4.5.2).',
  specReference: 'SPEC 4.5.2, released → disputed; 4.0, Prozessfristen',
  isSatisfied: (facts) => facts.withinReviewDeadline,
}

const TRANSITIONS = {
  /**
   * `— → created` (4.5.2), Seite Verkauf und Einkauf A. Die Belegpositionen
   * werden aus den Zetteln **abgeleitet**, nicht eingegeben (3.9).
   */
  create: {
    from: [],
    to: 'created',
    label: 'Beleg erstellen',
    roles: ['operatorCoordinator', 'operatorAdmin'],
    specReference: 'SPEC 4.5.2, — → created',
    preconditions: [
      {
        description: 'Die Belegart passt zur Belegseite (3.9).',
        specReference: 'SPEC 3.9',
        isSatisfied: (facts) => facts.typeMatchesDirection,
      },
      {
        description: 'Mindestens ein zugrunde liegender Stundenzettel (3.9).',
        specReference: 'SPEC 3.9',
        isSatisfied: (facts) => facts.timesheetCount > 0,
      },
      {
        description:
          'Alle zugrunde liegenden Stundenzettel stehen auf „genehmigt" (3.9, 4.4) — ' +
          'aus nicht genehmigten Zeiten entsteht kein Beleg.',
        specReference: 'SPEC 4.5.2, — → created; 4.4',
        isSatisfied: (facts) => facts.allTimesheetsApproved,
      },
      {
        description: 'Die Abrechnungsperiode ist offen (4.5.1).',
        specReference: 'SPEC 4.5.2, — → created; 4.5.1',
        isSatisfied: (facts) => facts.billingPeriodStatus === 'open',
      },
      {
        description:
          'Zu jeder abgerechneten Leistung liegt eine Preisposition der eigenen Seite vor ' +
          '(3.3) — ohne Satz gibt es keinen Betrag.',
        specReference: 'SPEC 4.5.2, — → created; 3.3',
        isSatisfied: (facts) => facts.ratesPresent,
      },
      {
        description: 'Mindestens eine Belegposition ist entstanden (3.9).',
        specReference: 'SPEC 3.9',
        isSatisfied: (facts) => facts.itemCount > 0,
      },
    ],
  },

  /** `created` → `inReview` (4.5.2). */
  review: {
    from: ['created'],
    to: 'inReview',
    label: 'Beleg prüfen',
    roles: ['operatorCoordinator', 'operatorAdmin'],
    specReference: 'SPEC 4.5.2, created → inReview',
    preconditions: [
      {
        description:
          'Die Summen sind abgeleitet und stimmen mit den Stundenzetteln überein (4.5.2).',
        specReference: 'SPEC 4.5.2, created → inReview',
        isSatisfied: (facts) => facts.amountsMatchTimesheets,
      },
    ],
  },

  /** `inReview` → `released` (4.5.2). */
  release: {
    from: ['inReview'],
    to: 'released',
    label: 'Beleg freigeben',
    roles: ['operatorCoordinator', 'operatorAdmin'],
    specReference: 'SPEC 4.5.2, inReview → released',
    preconditions: [fourEyes],
  },

  /**
   * `released` → `disputed`, Seite **Verkauf** (4.5.2). Auslösende Rolle ist
   * `KE` ([31]); die Statusführung bleibt beim Betreiber.
   */
  disputeBySales: {
    from: ['released'],
    to: 'disputed',
    label: 'Beleg beanstanden (Kundenseite)',
    roles: ['procurementController'],
    specReference: 'SPEC 4.5.2, released → disputed (Verkauf)',
    preconditions: [
      {
        description: 'Die Kundenseite beanstandet nur einen Verkaufsbeleg (3.9, [31]).',
        specReference: 'SPEC 4.5.2, Seite / Variante; 2.2, Fußnote [31]',
        isSatisfied: (facts) => facts.direction === 'sales',
      },
      disputeReasonGiven,
      withinReviewDeadline,
    ],
  },

  /**
   * `released` → `disputed`, Seite **Einkauf** (4.5.2). Auslösende Rolle ist
   * `LD` ([32]).
   */
  disputeByPurchase: {
    from: ['released'],
    to: 'disputed',
    label: 'Gutschrift beanstanden (Lieferantenseite)',
    roles: ['supplierCoordinator'],
    specReference: 'SPEC 4.5.2, released → disputed (Einkauf)',
    preconditions: [
      {
        description: 'Die Lieferantenseite beanstandet nur einen Einkaufsbeleg (3.9, [32]).',
        specReference: 'SPEC 4.5.2, Seite / Variante; 2.2, Fußnote [32]',
        isSatisfied: (facts) => facts.direction === 'purchase',
      },
      disputeReasonGiven,
      withinReviewDeadline,
    ],
  },

  /**
   * `released` → `confirmed` (4.5.2) — **nur** auf der Einkaufsseite. Die
   * Verkaufsseite kennt keine Bestätigung: 2.2 gibt `KE` mit [31] allein die
   * Beanstandung.
   */
  confirm: {
    from: ['released'],
    to: 'confirmed',
    label: 'Gutschrift bestätigen',
    roles: ['supplierCoordinator'],
    specReference: 'SPEC 4.5.2, released → confirmed',
    preconditions: [
      {
        description:
          'Nur die Einkaufsseite kennt die Bestätigung (4.5.2) — auf der Verkaufsseite ist ' +
          '„freigegeben" der Ruhezustand.',
        specReference: 'SPEC 4.5.2, Endzustände',
        isSatisfied: (facts) => facts.direction === 'purchase',
      },
      {
        description: 'Keine offene Beanstandung (4.5.2).',
        specReference: 'SPEC 4.5.2, released → confirmed',
        isSatisfied: (facts) => !facts.openDispute,
      },
    ],
  },

  /**
   * `disputed` → `inReview` (4.5.2): die Klärung führt zurück in die
   * **Prüfung**, nicht in die Freigabe — freigegeben wird erneut, mit erneutem
   * Vier-Augen-Prinzip.
   */
  clarify: {
    from: ['disputed'],
    to: 'inReview',
    label: 'Beanstandung klären',
    roles: ['operatorCoordinator', 'operatorAdmin'],
    specReference: 'SPEC 4.5.2, disputed → inReview',
    preconditions: [
      {
        description: 'Die Klärung ist dokumentiert (4.5.2).',
        specReference: 'SPEC 4.5.2, disputed → inReview',
        isSatisfied: (facts) =>
          facts.disputeResolutionNote !== null && facts.disputeResolutionNote.trim() !== '',
      },
      {
        description:
          'Haben sich die Zeiten geändert, ist die Korrekturfassung des Stundenzettels ' +
          'genehmigt (4.4) — ein Beleg über ersetzte Zeiten wäre ein Beleg über Zeiten, ' +
          'die niemand genehmigt hat.',
        specReference: 'SPEC 4.5.2, disputed → inReview; 4.4',
        isSatisfied: (facts) => !facts.timesheetsChanged || facts.correctionsApproved,
      },
    ],
  },

  /**
   * `created`, `inReview`, `released`, `disputed` → `cancelled` (4.5.2).
   *
   * **Ein** Übergang mit vier Ausgangszuständen, weil 4.5.2 ihn in **einer**
   * Zeile führt. Der stornierte Beleg bleibt erhalten; der Storno erzeugt
   * einen neuen Beleg mit `cancellationOf` (3.9), und die Belegnummern bleiben
   * lückenlos.
   */
  cancel: {
    from: ['created', 'inReview', 'released', 'disputed'],
    to: 'cancelled',
    label: 'Beleg stornieren',
    roles: ['operatorCoordinator', 'operatorAdmin'],
    specReference: 'SPEC 4.5.2, → cancelled',
    preconditions: [
      {
        description: 'Der Stornogrund ist Pflicht (4.5.2).',
        specReference: 'SPEC 4.5.2, → cancelled',
        isSatisfied: (facts) =>
          facts.cancellationReason !== null && facts.cancellationReason.trim() !== '',
      },
    ],
  },
} as const satisfies Readonly<Record<string, BillingTransition>>

export type BillingDocumentTransitionName = keyof typeof TRANSITIONS

export const BILLING_DOCUMENT_MODEL: StatusModel<
  BillingDocumentState,
  BillingDocumentFacts,
  typeof TRANSITIONS
> = {
  object: 'Abrechnungsbeleg (3.9)',
  specReference: 'SPEC 4.5.2',
  states: ['created', 'inReview', 'released', 'disputed', 'confirmed', 'cancelled'],
  terminalStates: ['confirmed', 'cancelled'],
  transitions: TRANSITIONS,
}
