/**
 * Statusmodell der Abrechnungsperiode — SPEC **4.5.1**, Objekt `billingPeriod`
 * (3.9).
 *
 * Zwei Zustände, ein Übergang: `open` → `closed`. Das ist kein armes Modell,
 * sondern ein scharfes — die Periode ist der **Rahmen**, in dem Zeiten und
 * Belege entstehen, und sie hat genau zwei Lagen: sie nimmt auf, oder sie ist
 * zu.
 *
 * **Warum das Öffnen ein Übergang und keine Anlage ist.** 4.5.1 nennt in der
 * Zeile „— → `open`" zwei Rollen: „`MA` (anlegen), `MD` öffnet ([33])". Die
 * Matrix 2.2 gibt `MD` auf dieser Zeile **kein** `A`, sondern `L S[33]`, und
 * Fußnote [33] lautet „Öffnen und Schließen einer Abrechnungsperiode" — das
 * Öffnen ist dort ausdrücklich ein Statusvorgang. Ein Entwurfszustand, der
 * Anlegen und Öffnen trennen würde, führt 4.5.1 nicht. Deshalb trägt dieser
 * Übergang `operation: 'transition'`: genau der Fall, den
 * `TransitionDefinition` vorsieht, wenn die Matrix die Operation anders
 * zuweist als die Stellung der Zeile vermuten lässt. Ohne diese Angabe könnte
 * `MD` die Periode nicht öffnen, obwohl 4.5.1 und [33] es beide sagen.
 *
 * Nicht vorhanden — und damit nicht ausdrückbar:
 *
 *  - **`closed` → `open`.** Nachträgliche Zeiten laufen über eine
 *    Korrekturfassung (4.4) in der **nächsten** offenen Periode, nachträgliche
 *    Beträge über Storno und Nachbeleg (4.5.2). „Ein Wiederöffnen wäre eine
 *    Änderung dieses Kapitels, kein Sonderfall im Betrieb" (4.5.1).
 *  - **Ein Schluss durch Fristablauf.** Das Erreichen von `closingDate`
 *    erzeugt Erinnerung und Eskalation (2.4), nicht den Übergang (4.0,
 *    Regel 4).
 *
 * **Endzustand:** `closed`.
 *
 * *Offene Frage 24* steht an der Vorbedingung des Schlusses und ist dort
 * benannt: die Vorbedingung verlangt heute, dass **jeder** Zettel der Periode
 * entschieden ist.
 */
import type { Precondition, StatusModel, TransitionDefinition } from './machine'

export type BillingPeriodState = 'open' | 'closed'

export const BILLING_PERIOD_STATE_LABELS: {
  readonly [S in BillingPeriodState]: string
} = {
  open: 'offen',
  closed: 'geschlossen',
}

/**
 * Die Tatsachen, die 4.5.1 in der Spalte „Vorbedingungen" nennt. Erhoben
 * werden sie vom Aufrufer (`lib/services/billing.ts`).
 */
export interface BillingPeriodFacts {
  // — Öffnen (4.5.1, — → open) —
  /** `periodFrom`, `periodTo` und `closingDate` sind gesetzt (3.9). */
  readonly datesComplete: boolean
  /** Das Ende liegt nicht vor dem Beginn (3.9). */
  readonly rangeOrdered: boolean
  /** Es gibt keine überlappende **offene** Periode für denselben Kunden. */
  readonly noOverlappingOpenPeriod: boolean

  // — Schließen (4.5.1, open → closed) —
  /** Zettel der Periode in `recorded`, `submitted` oder `inApproval` (4.4). */
  readonly undecidedTimesheets: number
  /** Belege der Periode, die nicht in `released`, `confirmed` oder `cancelled` stehen. */
  readonly unfinishedDocuments: number

  /** Stichtag des Vorgangs (5.0) — hier der Tag des Schlusses. */
  readonly evaluationDate: Date
}

type BillingPeriodPrecondition = Precondition<BillingPeriodFacts>
type BillingPeriodTransition = TransitionDefinition<BillingPeriodState, BillingPeriodFacts>

/**
 * Die Vorbedingung, an der *offene Frage 24* hängt.
 *
 * 4.5.1 verlangt: „Kein Stundenzettel der Periode in `recorded`, `submitted`
 * oder `inApproval`". Das ist die strenge Folge aus 2.4 Regel 1 — kein
 * Statuswechsel durch Fristablauf, also auch keine Genehmigungsfiktion zum
 * Periodenschluss —, und sie hat den Preis, den 4.5.1 selbst benennt: ein
 * einzelner hängender Zettel hält die Abrechnung der ganzen Periode auf. Die
 * Alternative (Schließen mit Übertrag der offenen Zettel in die nächste
 * Periode) ist eine kaufmännische Festlegung und wird hier **nicht** geraten.
 */
const allTimesheetsDecided: BillingPeriodPrecondition = {
  description:
    'Kein Stundenzettel der Periode steht noch auf „erfasst", „eingereicht" oder ' +
    '„in Prüfung" (4.4). Ein hängender Zettel hält die Periode auf — offene Frage 24.',
  specReference: 'SPEC 4.5.1, open → closed; 2.4, Regel 1',
  isSatisfied: (facts) => facts.undecidedTimesheets === 0,
}

/**
 * Jeder Beleg der Periode ist abgegeben, bestätigt oder storniert (4.5.1).
 *
 * Ein Beleg in `created`, `inReview` oder `disputed` ist noch nicht aus der
 * Hand: `created` und `inReview` sind nicht abgegeben, `disputed` ist
 * widersprochen. Eine Periode mit einem solchen Beleg zu schließen hieße, den
 * Vorgang offen zu lassen und ihm die Grundlage zu nehmen — denn in einer
 * geschlossenen Periode entsteht kein Nachbeleg mehr (4.5.2).
 */
const allDocumentsFinished: BillingPeriodPrecondition = {
  description:
    'Jeder Abrechnungsbeleg der Periode steht auf „freigegeben", „bestätigt" oder ' +
    '„storniert" (4.5.2).',
  specReference: 'SPEC 4.5.1, open → closed',
  isSatisfied: (facts) => facts.unfinishedDocuments === 0,
}

const TRANSITIONS = {
  /**
   * `— → open` (4.5.1). Die Periode entsteht **offen**; einen Entwurf führt
   * 4.5.1 nicht. Zur Operation siehe den Kopfkommentar.
   */
  open: {
    from: [],
    to: 'open',
    label: 'Abrechnungsperiode öffnen',
    roles: ['operatorAdmin', 'operatorCoordinator'],
    operation: 'transition',
    specReference: 'SPEC 4.5.1, — → open',
    preconditions: [
      {
        description: '`periodFrom`, `periodTo` und `closingDate` sind gesetzt (3.9).',
        specReference: 'SPEC 4.5.1, — → open; 3.9',
        isSatisfied: (facts) => facts.datesComplete,
      },
      {
        description: 'Das Ende der Periode liegt nicht vor ihrem Beginn (3.9).',
        specReference: 'SPEC 3.9',
        isSatisfied: (facts) => facts.rangeOrdered,
      },
      {
        description:
          'Für denselben Kunden ist keine überlappende Periode offen (4.5.1) — sonst wäre ' +
          'nicht entscheidbar, in welche ein Zettel gehört (3.13).',
        specReference: 'SPEC 4.5.1, — → open',
        isSatisfied: (facts) => facts.noOverlappingOpenPeriod,
      },
    ],
  },

  /** `open` → `closed` (4.5.1). */
  close: {
    from: ['open'],
    to: 'closed',
    label: 'Abrechnungsperiode schließen',
    roles: ['operatorCoordinator', 'operatorAdmin'],
    specReference: 'SPEC 4.5.1, open → closed',
    preconditions: [allTimesheetsDecided, allDocumentsFinished],
  },
} as const satisfies Readonly<Record<string, BillingPeriodTransition>>

export type BillingPeriodTransitionName = keyof typeof TRANSITIONS

export const BILLING_PERIOD_MODEL: StatusModel<
  BillingPeriodState,
  BillingPeriodFacts,
  typeof TRANSITIONS
> = {
  object: 'Abrechnungsperiode (3.9)',
  specReference: 'SPEC 4.5.1',
  states: ['open', 'closed'],
  terminalStates: ['closed'],
  transitions: TRANSITIONS,
}
