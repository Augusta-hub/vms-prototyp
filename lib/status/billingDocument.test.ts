/**
 * Tests des Abrechnungsbelegs gegen SPEC 4.5.2.
 *
 * Geprüft wird je Übergang: ein erlaubter Fall, die Spalte „Von", die
 * auslösende Rolle und jede Vorbedingung einzeln. Dazu die Fälle, die 4.5.2
 * ausdrücklich **ausschließt** — die Freigabe durch den Ersteller, die
 * Bestätigung auf der Verkaufsseite, der Weg von `disputed` direkt nach
 * `released`, die Bestätigungsfiktion — und die Eigenheit dieses Modells: es
 * trägt **keine** AÜG-Sperre, weil 4.7 dem Beleg nur Warnungen und
 * Informationen zuordnet (5.5.5).
 *
 * Diese Tests prüfen Anwendungscode und sind **nicht** die AÜG-Regeln; die
 * stehen als Gherkin in tests/aueg/ und werden hier nicht berührt.
 */
import { describe, expect, it } from 'vitest'
import type { ResourceRef } from '../authz/check'
import {
  CUSTOMER_TENANT,
  DAY,
  OPERATOR_TENANT,
  SUPPLIER_TENANT,
  subject,
} from '../testing/fixtures'
import {
  BILLING_DOCUMENT_MODEL,
  type BillingDocumentFacts,
  type BillingDocumentState,
} from './billingDocument'
import {
  attemptTransition,
  isTerminal,
  transitionsFrom,
  type TransitionDefinition,
} from './machine'

const TODAY = DAY('2026-11-12')
const ERSTELLER = 'user-operatorCoordinator'
const ANDERE_PERSON = 'user-operatorAdmin'

function salesResource(
  status: BillingDocumentState,
  options: Partial<ResourceRef> = {},
): ResourceRef {
  return {
    type: 'billingDocument',
    tenantId: OPERATOR_TENANT,
    tenantType: 'operator',
    customerTenantId: CUSTOMER_TENANT,
    status,
    createdById: ERSTELLER,
    disclosedToTenantIds: [CUSTOMER_TENANT],
    ...options,
  }
}

function purchaseResource(
  status: BillingDocumentState,
  options: Partial<ResourceRef> = {},
): ResourceRef {
  return {
    type: 'billingDocument',
    tenantId: OPERATOR_TENANT,
    tenantType: 'operator',
    supplierTenantId: SUPPLIER_TENANT,
    status,
    createdById: ERSTELLER,
    disclosedToTenantIds: [SUPPLIER_TENANT],
    ...options,
  }
}

function facts(overrides: Partial<BillingDocumentFacts> = {}): BillingDocumentFacts {
  return {
    direction: 'sales',
    typeMatchesDirection: true,
    timesheetCount: 2,
    allTimesheetsApproved: true,
    billingPeriodStatus: 'open',
    ratesPresent: true,
    itemCount: 3,
    amountsMatchTimesheets: true,
    actingUserId: ANDERE_PERSON,
    createdById: ERSTELLER,
    disputeReason: null,
    withinReviewDeadline: true,
    openDispute: false,
    disputeResolutionNote: null,
    timesheetsChanged: false,
    correctionsApproved: true,
    cancellationReason: null,
    evaluationDate: TODAY,
    ...overrides,
  }
}

describe('Erstellen (— → created, SPEC 4.5.2)', () => {
  it('erstellt den Beleg aus genehmigten Zetteln in einer offenen Periode', () => {
    const outcome = attemptTransition(BILLING_DOCUMENT_MODEL, 'create', {
      currentStatus: null,
      subject: subject('operatorCoordinator'),
      resource: salesResource('created'),
      facts: facts(),
    })
    expect(outcome.applied).toBe(true)
    if (outcome.applied) expect(outcome.to).toBe('created')
  })

  it('verweigert ihn aus nicht genehmigten Zeiten (3.9, 4.4)', () => {
    const outcome = attemptTransition(BILLING_DOCUMENT_MODEL, 'create', {
      currentStatus: null,
      subject: subject('operatorCoordinator'),
      resource: salesResource('created'),
      facts: facts({ allTimesheetsApproved: false }),
    })
    expect(outcome.applied).toBe(false)
    if (!outcome.applied) expect(outcome.rejection.kind).toBe('precondition')
  })

  it('verweigert ihn ohne Stundenzettel — 3.9 verlangt mindestens einen', () => {
    const outcome = attemptTransition(BILLING_DOCUMENT_MODEL, 'create', {
      currentStatus: null,
      subject: subject('operatorCoordinator'),
      resource: salesResource('created'),
      facts: facts({ timesheetCount: 0 }),
    })
    expect(outcome.applied).toBe(false)
  })

  it('verweigert ihn in einer geschlossenen Periode (4.5.1)', () => {
    const outcome = attemptTransition(BILLING_DOCUMENT_MODEL, 'create', {
      currentStatus: null,
      subject: subject('operatorCoordinator'),
      resource: salesResource('created'),
      facts: facts({ billingPeriodStatus: 'closed' }),
    })
    expect(outcome.applied).toBe(false)
  })

  it('verweigert ihn ohne Preisposition der eigenen Seite (3.3)', () => {
    const outcome = attemptTransition(BILLING_DOCUMENT_MODEL, 'create', {
      currentStatus: null,
      subject: subject('operatorCoordinator'),
      resource: salesResource('created'),
      facts: facts({ ratesPresent: false }),
    })
    expect(outcome.applied).toBe(false)
  })

  it('verweigert einen Beleg ohne Position', () => {
    const outcome = attemptTransition(BILLING_DOCUMENT_MODEL, 'create', {
      currentStatus: null,
      subject: subject('operatorCoordinator'),
      resource: salesResource('created'),
      facts: facts({ itemCount: 0 }),
    })
    expect(outcome.applied).toBe(false)
  })

  it('verweigert eine Belegart, die nicht zur Seite passt (3.9)', () => {
    const outcome = attemptTransition(BILLING_DOCUMENT_MODEL, 'create', {
      currentStatus: null,
      subject: subject('operatorCoordinator'),
      resource: salesResource('created'),
      facts: facts({ typeMatchesDirection: false }),
    })
    expect(outcome.applied).toBe(false)
  })

  it('verweigert ihn dem Lieferanten — im Gutschriftverfahren legt er keinen Beleg an ([32])', () => {
    // Variante B (Rechnungseingang) würde ein `A[7]` in 2.2 verlangen; sie ist
    // dokumentiert und nicht umgesetzt (4.5.2, Entscheidung zu Frage 6).
    const outcome = attemptTransition(BILLING_DOCUMENT_MODEL, 'create', {
      currentStatus: null,
      subject: subject('supplierCoordinator'),
      resource: purchaseResource('created'),
      facts: facts({ direction: 'purchase' }),
    })
    expect(outcome.applied).toBe(false)
    if (!outcome.applied) expect(outcome.rejection.kind).toBe('roleNotTriggering')
  })

  it('verweigert ihn der Kundenseite — `KE` trägt nur `L[2] S[31]`', () => {
    const outcome = attemptTransition(BILLING_DOCUMENT_MODEL, 'create', {
      currentStatus: null,
      subject: subject('procurementController'),
      resource: salesResource('created'),
      facts: facts(),
    })
    expect(outcome.applied).toBe(false)
  })
})

describe('Prüfen (created → inReview, SPEC 4.5.2)', () => {
  it('führt den Beleg in die Prüfung, wenn die Summen stimmen', () => {
    const outcome = attemptTransition(BILLING_DOCUMENT_MODEL, 'review', {
      currentStatus: 'created',
      subject: subject('operatorCoordinator'),
      resource: salesResource('created'),
      facts: facts(),
    })
    expect(outcome.applied).toBe(true)
  })

  it('verweigert sie, wenn die Summen nicht zu den Zetteln passen (4.5.2)', () => {
    const outcome = attemptTransition(BILLING_DOCUMENT_MODEL, 'review', {
      currentStatus: 'created',
      subject: subject('operatorCoordinator'),
      resource: salesResource('created'),
      facts: facts({ amountsMatchTimesheets: false }),
    })
    expect(outcome.applied).toBe(false)
    if (!outcome.applied) expect(outcome.rejection.kind).toBe('precondition')
  })

  it('läuft auch durch den Ersteller — geprüft werden darf der eigene Beleg', () => {
    // Das Vier-Augen-Prinzip aus [30] gilt der **Freigabe**, nicht der
    // Prüfung: 4.5.2 nennt es nur in der Zeile `inReview` → `released`.
    const outcome = attemptTransition(BILLING_DOCUMENT_MODEL, 'review', {
      currentStatus: 'created',
      subject: subject('operatorCoordinator'),
      resource: salesResource('created'),
      facts: facts({ actingUserId: ERSTELLER }),
    })
    expect(outcome.applied).toBe(true)
  })
})

describe('Freigeben (inReview → released, SPEC 4.5.2)', () => {
  it('gibt den Beleg durch eine andere Person als den Ersteller frei', () => {
    const outcome = attemptTransition(BILLING_DOCUMENT_MODEL, 'release', {
      currentStatus: 'inReview',
      subject: subject('operatorAdmin'),
      resource: salesResource('inReview'),
      facts: facts(),
    })
    expect(outcome.applied).toBe(true)
    if (outcome.applied) expect(outcome.to).toBe('released')
  })

  it('verweigert die Freigabe durch den Ersteller — beim `MD` schon die Fußnote [30]', () => {
    // Zwei Schichten, und hier greift die **erste**: die Prüffunktion wertet
    // [30] an der Zelle des `MD` aus, bevor die Vorbedingungen laufen (4.0,
    // Reihenfolge der Prüfung). Deshalb `notPermitted` und nicht
    // `precondition`.
    const outcome = attemptTransition(BILLING_DOCUMENT_MODEL, 'release', {
      currentStatus: 'inReview',
      subject: subject('operatorCoordinator'),
      resource: salesResource('inReview'),
      facts: facts({ actingUserId: ERSTELLER }),
    })
    expect(outcome.applied).toBe(false)
    if (!outcome.applied) expect(outcome.rejection.kind).toBe('notPermitted')
  })

  it('verweigert sie auch dem Betreiberadministrator — hier trägt die Vorbedingung', () => {
    // Die Zelle des `MA` trägt in 2.2 **keine** Fußnote. Fiele die
    // Vorbedingung aus dem Modell weg, könnte er seinen eigenen Beleg
    // freigeben — die zweite Schicht ist deshalb nicht Zierde.
    const outcome = attemptTransition(BILLING_DOCUMENT_MODEL, 'release', {
      currentStatus: 'inReview',
      subject: subject('operatorAdmin'),
      resource: salesResource('inReview', { createdById: ANDERE_PERSON }),
      facts: facts({ actingUserId: ANDERE_PERSON, createdById: ANDERE_PERSON }),
    })
    expect(outcome.applied).toBe(false)
    if (!outcome.applied) expect(outcome.rejection.kind).toBe('precondition')
  })

  it('führt nicht aus `created` — der Beleg wird zuerst geprüft (4.5.2)', () => {
    const outcome = attemptTransition(BILLING_DOCUMENT_MODEL, 'release', {
      currentStatus: 'created',
      subject: subject('operatorAdmin'),
      resource: salesResource('created'),
      facts: facts(),
    })
    expect(outcome.applied).toBe(false)
    if (!outcome.applied) expect(outcome.rejection.kind).toBe('statusMismatch')
  })
})

describe('Beanstanden (released → disputed, SPEC 4.5.2)', () => {
  it('die Kundenseite beanstandet einen Verkaufsbeleg ([31])', () => {
    const outcome = attemptTransition(BILLING_DOCUMENT_MODEL, 'disputeBySales', {
      currentStatus: 'released',
      subject: subject('procurementController'),
      resource: salesResource('released'),
      facts: facts({ disputeReason: 'Die Stunden am 12.10. sind nicht erbracht.' }),
    })
    expect(outcome.applied).toBe(true)
    if (outcome.applied) expect(outcome.to).toBe('disputed')
  })

  it('der Lieferant beanstandet eine Gutschrift ([32])', () => {
    const outcome = attemptTransition(BILLING_DOCUMENT_MODEL, 'disputeByPurchase', {
      currentStatus: 'released',
      subject: subject('supplierCoordinator'),
      resource: purchaseResource('released'),
      facts: facts({ direction: 'purchase', disputeReason: 'Nachtzuschlag fehlt.' }),
    })
    expect(outcome.applied).toBe(true)
  })

  it('die Kundenseite beanstandet **keine** Gutschrift — sie sieht sie nicht', () => {
    // Deshalb zwei Übergänge mit demselben Ziel statt eines mit beiden Rollen.
    // Die Mandantengrenze fängt den Fall schon ab; geprüft wird hier die
    // **zweite** Schicht, die Vorbedingung des Modells: der Vorgang gibt sich
    // als Verkaufsbeleg, die Tatsachen nennen die Einkaufsseite.
    const outcome = attemptTransition(BILLING_DOCUMENT_MODEL, 'disputeBySales', {
      currentStatus: 'released',
      subject: subject('procurementController'),
      resource: salesResource('released'),
      facts: facts({ direction: 'purchase', disputeReason: 'Grund' }),
    })
    expect(outcome.applied).toBe(false)
    if (!outcome.applied) expect(outcome.rejection.kind).toBe('precondition')
  })

  it('die Kundenseite kommt an eine Gutschrift gar nicht erst heran (2.3, [31])', () => {
    // Die erste Schicht: der Einkaufsbeleg nennt keinen Kunden, also fällt
    // `KE` schon an der Mandantengrenze heraus.
    const outcome = attemptTransition(BILLING_DOCUMENT_MODEL, 'disputeBySales', {
      currentStatus: 'released',
      subject: subject('procurementController'),
      resource: purchaseResource('released'),
      facts: facts({ direction: 'purchase', disputeReason: 'Grund' }),
    })
    expect(outcome.applied).toBe(false)
    if (!outcome.applied) expect(outcome.rejection.kind).toBe('notPermitted')
  })

  it('der Lieferant beanstandet **keinen** Verkaufsbeleg', () => {
    const outcome = attemptTransition(BILLING_DOCUMENT_MODEL, 'disputeByPurchase', {
      currentStatus: 'released',
      subject: subject('supplierCoordinator'),
      resource: purchaseResource('released'),
      facts: facts({ direction: 'sales', disputeReason: 'Grund' }),
    })
    expect(outcome.applied).toBe(false)
    if (!outcome.applied) expect(outcome.rejection.kind).toBe('precondition')
  })

  it('verweigert die Beanstandung ohne Grund (3.9)', () => {
    const outcome = attemptTransition(BILLING_DOCUMENT_MODEL, 'disputeBySales', {
      currentStatus: 'released',
      subject: subject('procurementController'),
      resource: salesResource('released'),
      facts: facts({ disputeReason: '   ' }),
    })
    expect(outcome.applied).toBe(false)
    if (!outcome.applied) expect(outcome.rejection.kind).toBe('precondition')
  })

  it('verweigert sie nach Ablauf der Prüffrist (4.5.2, 4.0)', () => {
    // Der Beleg bleibt `released` — „gilt als akzeptiert, solange keine
    // Beanstandung erfolgt" (4.5.2). Die Frist erzeugt keinen Übergang, sie
    // begrenzt eine Handlung.
    const outcome = attemptTransition(BILLING_DOCUMENT_MODEL, 'disputeBySales', {
      currentStatus: 'released',
      subject: subject('procurementController'),
      resource: salesResource('released'),
      facts: facts({ disputeReason: 'zu spät', withinReviewDeadline: false }),
    })
    expect(outcome.applied).toBe(false)
  })

  it('verweigert sie dem Bedarfsträger und dem Genehmiger — sie sehen den Beleg nicht', () => {
    for (const rolle of ['demandOwner', 'approver'] as const) {
      const outcome = attemptTransition(BILLING_DOCUMENT_MODEL, 'disputeBySales', {
        currentStatus: 'released',
        subject: subject(rolle),
        resource: salesResource('released'),
        facts: facts({ disputeReason: 'Grund' }),
      })
      expect(outcome.applied).toBe(false)
    }
  })
})

describe('Bestätigen (released → confirmed, SPEC 4.5.2)', () => {
  it('der Lieferant bestätigt die Gutschrift ([32])', () => {
    const outcome = attemptTransition(BILLING_DOCUMENT_MODEL, 'confirm', {
      currentStatus: 'released',
      subject: subject('supplierCoordinator'),
      resource: purchaseResource('released'),
      facts: facts({ direction: 'purchase' }),
    })
    expect(outcome.applied).toBe(true)
    if (outcome.applied) expect(outcome.to).toBe('confirmed')
  })

  it('die Verkaufsseite kennt keine Bestätigung — `released` ist ihr Ruhezustand', () => {
    // Geprüft wird hier die **Vorbedingung**, nicht die Mandantengrenze: der
    // Vorgang gibt sich als Einkaufsbeleg (der Lieferant kommt also durch
    // Grenze und Fußnote [32]), die Tatsachen nennen aber die Verkaufsseite.
    // Ohne diese Trennung träfe der Test die Grenze und nie das Modell — und
    // bliebe grün, wenn die Vorbedingung verschwände.
    const outcome = attemptTransition(BILLING_DOCUMENT_MODEL, 'confirm', {
      currentStatus: 'released',
      subject: subject('supplierCoordinator'),
      resource: purchaseResource('released'),
      facts: facts({ direction: 'sales' }),
    })
    expect(outcome.applied).toBe(false)
    if (!outcome.applied) expect(outcome.rejection.kind).toBe('precondition')
  })

  it('verweigert sie der Kundenseite — [31] gibt `KE` nur die Beanstandung', () => {
    const outcome = attemptTransition(BILLING_DOCUMENT_MODEL, 'confirm', {
      currentStatus: 'released',
      subject: subject('procurementController'),
      resource: salesResource('released'),
      facts: facts(),
    })
    expect(outcome.applied).toBe(false)
    if (!outcome.applied) expect(outcome.rejection.kind).toBe('roleNotTriggering')
  })

  it('verweigert sie dem Betreiber — er führt den Status, bestätigt aber nicht für die Gegenseite', () => {
    const outcome = attemptTransition(BILLING_DOCUMENT_MODEL, 'confirm', {
      currentStatus: 'released',
      subject: subject('operatorCoordinator'),
      resource: purchaseResource('released'),
      facts: facts({ direction: 'purchase' }),
    })
    expect(outcome.applied).toBe(false)
  })

  it('verweigert sie bei offener Beanstandung (4.5.2)', () => {
    const outcome = attemptTransition(BILLING_DOCUMENT_MODEL, 'confirm', {
      currentStatus: 'released',
      subject: subject('supplierCoordinator'),
      resource: purchaseResource('released'),
      facts: facts({ direction: 'purchase', openDispute: true }),
    })
    expect(outcome.applied).toBe(false)
    if (!outcome.applied) expect(outcome.rejection.kind).toBe('precondition')
  })
})

describe('Klären (disputed → inReview, SPEC 4.5.2)', () => {
  it('führt den Beleg mit dokumentierter Klärung zurück in die Prüfung', () => {
    const outcome = attemptTransition(BILLING_DOCUMENT_MODEL, 'clarify', {
      currentStatus: 'disputed',
      subject: subject('operatorCoordinator'),
      resource: salesResource('disputed'),
      facts: facts({ disputeResolutionNote: 'Stunden geprüft, Zettel unverändert.' }),
    })
    expect(outcome.applied).toBe(true)
    if (outcome.applied) expect(outcome.to).toBe('inReview')
  })

  it('verweigert sie ohne dokumentierte Klärung (4.5.2)', () => {
    const outcome = attemptTransition(BILLING_DOCUMENT_MODEL, 'clarify', {
      currentStatus: 'disputed',
      subject: subject('operatorCoordinator'),
      resource: salesResource('disputed'),
      facts: facts({ disputeResolutionNote: null }),
    })
    expect(outcome.applied).toBe(false)
  })

  it('verweigert sie, wenn die Zeiten geändert und nicht neu genehmigt sind (4.4)', () => {
    const outcome = attemptTransition(BILLING_DOCUMENT_MODEL, 'clarify', {
      currentStatus: 'disputed',
      subject: subject('operatorCoordinator'),
      resource: salesResource('disputed'),
      facts: facts({
        disputeResolutionNote: 'Zeiten korrigiert.',
        timesheetsChanged: true,
        correctionsApproved: false,
      }),
    })
    expect(outcome.applied).toBe(false)
    if (!outcome.applied) expect(outcome.rejection.kind).toBe('precondition')
  })

  it('lässt sie zu, wenn die Korrekturfassung genehmigt ist (4.4)', () => {
    const outcome = attemptTransition(BILLING_DOCUMENT_MODEL, 'clarify', {
      currentStatus: 'disputed',
      subject: subject('operatorCoordinator'),
      resource: salesResource('disputed'),
      facts: facts({
        disputeResolutionNote: 'Korrekturfassung genehmigt.',
        timesheetsChanged: true,
        correctionsApproved: true,
      }),
    })
    expect(outcome.applied).toBe(true)
  })

  it('verweigert sie der beanstandenden Seite — die Statusführung bleibt beim Betreiber', () => {
    for (const rolle of ['procurementController', 'supplierCoordinator'] as const) {
      const outcome = attemptTransition(BILLING_DOCUMENT_MODEL, 'clarify', {
        currentStatus: 'disputed',
        subject: subject(rolle),
        resource: salesResource('disputed'),
        facts: facts({ disputeResolutionNote: 'geklärt' }),
      })
      expect(outcome.applied).toBe(false)
    }
  })
})

describe('Stornieren (→ cancelled, SPEC 4.5.2)', () => {
  it('storniert aus jedem der vier Zustände, die 4.5.2 nennt', () => {
    for (const status of ['created', 'inReview', 'released', 'disputed'] as const) {
      const outcome = attemptTransition(BILLING_DOCUMENT_MODEL, 'cancel', {
        currentStatus: status,
        subject: subject('operatorCoordinator'),
        resource: salesResource(status),
        facts: facts({ cancellationReason: 'Falscher Kunde.' }),
      })
      expect(outcome.applied).toBe(true)
      if (outcome.applied) expect(outcome.to).toBe('cancelled')
    }
  })

  it('verweigert den Storno ohne Begründung (4.5.2)', () => {
    const outcome = attemptTransition(BILLING_DOCUMENT_MODEL, 'cancel', {
      currentStatus: 'released',
      subject: subject('operatorCoordinator'),
      resource: salesResource('released'),
      facts: facts({ cancellationReason: null }),
    })
    expect(outcome.applied).toBe(false)
    if (!outcome.applied) expect(outcome.rejection.kind).toBe('precondition')
  })

  it('verweigert ihn den Gegenseiten — [31] und [32] geben keinen Storno', () => {
    for (const rolle of ['procurementController', 'supplierCoordinator'] as const) {
      const outcome = attemptTransition(BILLING_DOCUMENT_MODEL, 'cancel', {
        currentStatus: 'released',
        subject: subject(rolle),
        resource: salesResource('released'),
        facts: facts({ cancellationReason: 'Grund' }),
      })
      expect(outcome.applied).toBe(false)
    }
  })

  it('storniert einen bestätigten Beleg nicht — `confirmed` ist Endzustand', () => {
    const outcome = attemptTransition(BILLING_DOCUMENT_MODEL, 'cancel', {
      currentStatus: 'confirmed',
      subject: subject('operatorCoordinator'),
      resource: purchaseResource('confirmed'),
      facts: facts({ direction: 'purchase', cancellationReason: 'Grund' }),
    })
    expect(outcome.applied).toBe(false)
    if (!outcome.applied) {
      expect(outcome.rejection.kind).toBe('statusMismatch')
      expect(outcome.rejection.specReference).toContain('4.0, Regel 9')
    }
  })
})

describe('Ausgeschlossene Übergänge und Endzustände (SPEC 4.5.2)', () => {
  it('`confirmed` und `cancelled` sind Endzustände', () => {
    expect(isTerminal(BILLING_DOCUMENT_MODEL, 'confirmed')).toBe(true)
    expect(isTerminal(BILLING_DOCUMENT_MODEL, 'cancelled')).toBe(true)
    expect(transitionsFrom(BILLING_DOCUMENT_MODEL, 'confirmed')).toEqual([])
    expect(transitionsFrom(BILLING_DOCUMENT_MODEL, 'cancelled')).toEqual([])
  })

  it('kennt genau die acht Übergänge, die 4.5.2 nennt', () => {
    // 4.0, Regel 1 als Eigenschaft des Typsystems: was 4.5.2 nicht nennt, hat
    // keinen Namen. Die Zeile „released → disputed" zählt doppelt, weil sie in
    // 4.5.2 zweimal steht — einmal je Seite.
    expect(Object.keys(BILLING_DOCUMENT_MODEL.transitions).sort()).toEqual([
      'cancel',
      'clarify',
      'confirm',
      'create',
      'disputeByPurchase',
      'disputeBySales',
      'release',
      'review',
    ])
  })

  it('kennt keinen Weg von `disputed` nach `released`', () => {
    expect(transitionsFrom(BILLING_DOCUMENT_MODEL, 'disputed')).toEqual(['clarify', 'cancel'])
  })

  it('kennt keinen Systemübergang — jeder Übergang hat eine auslösende Rolle', () => {
    // Der Unterschied zu 4.4, wo das Eröffnen der Freigabe und die Ersetzung
    // durch eine Korrekturfassung **Folgen** sind (4.0, Regel 10).
    for (const definition of Object.values(BILLING_DOCUMENT_MODEL.transitions)) {
      expect(definition.roles.length).toBeGreaterThan(0)
    }
  })

  it('trägt keine AÜG-Sperre — 4.7 gibt dem Beleg nur Warnung und Information', () => {
    // Das ist die tragende Aussage von 5.5.5 zu Q38 bis Q40: die Leistung ist
    // erbracht. Eine Vorbedingung mit `ruleRef` wäre hier eine Sperre, und
    // genau die soll das Modell nicht ausdrücken können.
    // `as const satisfies` verengt die Literaltypen so weit, dass `ruleRef`
    // nicht mehr auf jeder Vereinigung steht; die Schleife nennt den Typ
    // deshalb selbst — geprüft wird der Wert, nicht die Verengung.
    const uebergaenge: readonly TransitionDefinition<
      BillingDocumentState,
      BillingDocumentFacts
    >[] = Object.values(BILLING_DOCUMENT_MODEL.transitions)
    for (const definition of uebergaenge) {
      for (const vorbedingung of definition.preconditions) {
        expect(vorbedingung.ruleRef).toBeUndefined()
      }
    }
  })

  it('erreicht `confirmed` nur aus `released`', () => {
    for (const status of ['created', 'inReview', 'disputed'] as const) {
      const outcome = attemptTransition(BILLING_DOCUMENT_MODEL, 'confirm', {
        currentStatus: status,
        subject: subject('supplierCoordinator'),
        resource: purchaseResource(status),
        facts: facts({ direction: 'purchase' }),
      })
      expect(outcome.applied).toBe(false)
    }
  })
})
