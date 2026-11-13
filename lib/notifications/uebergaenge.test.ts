/**
 * Der Katalog der Benachrichtigungen aus den Übergängen (SPEC 3.14, 4.0
 * Regel 8).
 *
 * Die erste Gruppe prüft **Vollständigkeit gegen Kapitel 4**: jeder Übergang
 * jedes Statusmodells hat eine Zeile, und jede Zeile gehört zu einem Übergang.
 * Das ist der Test, der beißt — ein neuer Übergang ohne Entscheidung über seine
 * Nachricht fällt hier auf, nicht im Betrieb.
 */
import { describe, expect, it } from 'vitest'
import { ASSIGNMENT_MODEL } from '../status/assignment'
import { ASSIGNMENT_EXTENSION_MODEL } from '../status/assignmentExtension'
import { BILLING_DOCUMENT_MODEL } from '../status/billingDocument'
import { BILLING_PERIOD_MODEL } from '../status/billingPeriod'
import { CANDIDATE_SUBMISSION_MODEL } from '../status/candidateSubmission'
import { DEMAND_REQUEST_MODEL } from '../status/demandRequest'
import { DOCUMENT_MODEL } from '../status/document'
import { SUPPLIER_MODEL } from '../status/supplier'
import { SUPPLIER_OFFER_MODEL } from '../status/supplierOffer'
import { TENDER_INVITATION_MODEL } from '../status/tenderInvitation'
import { TIMESHEET_MODEL } from '../status/timesheet'
import {
  adressaten,
  katalogzeile,
  mandantenDerRolle,
  meldung,
  UEBERGANGSKATALOG,
  warnungsbefunde,
  type Pruefbefund,
  type Vorgangslage,
} from './uebergaenge'

const MODELLE: Readonly<Record<string, { readonly transitions: Readonly<Record<string, unknown>> }>> =
  {
    demandRequest: DEMAND_REQUEST_MODEL,
    tenderInvitation: TENDER_INVITATION_MODEL,
    supplierOffer: SUPPLIER_OFFER_MODEL,
    candidateSubmission: CANDIDATE_SUBMISSION_MODEL,
    assignment: ASSIGNMENT_MODEL,
    assignmentExtension: ASSIGNMENT_EXTENSION_MODEL,
    timesheet: TIMESHEET_MODEL,
    billingPeriod: BILLING_PERIOD_MODEL,
    billingDocument: BILLING_DOCUMENT_MODEL,
    supplier: SUPPLIER_MODEL,
    document: DOCUMENT_MODEL,
  }

const BETREIBER = 'tenant-operator'
const KUNDE = 'tenant-customer'
const LIEFERANT = 'tenant-supplier'
const LAGE: Vorgangslage = { operator: BETREIBER, customer: KUNDE, supplier: LIEFERANT }

describe('Vollständigkeit gegen Kapitel 4', () => {
  it('führt jedes Statusmodell, das Kapitel 4 nennt', () => {
    expect(Object.keys(UEBERGANGSKATALOG).sort()).toEqual(Object.keys(MODELLE).sort())
  })

  for (const [objectType, modell] of Object.entries(MODELLE)) {
    it(`entscheidet für jeden Übergang von ${objectType}`, () => {
      const uebergaenge = Object.keys(modell.transitions).sort()
      expect(Object.keys(UEBERGANGSKATALOG[objectType] ?? {}).sort()).toEqual(uebergaenge)
    })
  }

  it('begründet jede Zeile ohne Adressaten', () => {
    // Eine leere Adressatenliste ist eine **Aussage** über Kapitel 4 und
    // braucht ihren Wortlaut. Ohne diese Bedingung wäre eine vergessene Zeile
    // von einer bewusst leeren nicht zu unterscheiden.
    for (const [objectType, zeilen] of Object.entries(UEBERGANGSKATALOG)) {
      for (const [uebergang, zeile] of Object.entries(zeilen)) {
        if (zeile.adressaten.length > 0) continue
        expect(zeile.ohneNachricht, `${objectType}.${uebergang}`).toBeTruthy()
      }
    }
  })

  it('nennt zu jeder Zeile einen Kapitelverweis und ein Ereignis', () => {
    for (const [objectType, zeilen] of Object.entries(UEBERGANGSKATALOG)) {
      for (const [uebergang, zeile] of Object.entries(zeilen)) {
        expect(zeile.specReference, `${objectType}.${uebergang}`).toMatch(/^SPEC \d/)
        expect(zeile.ereignis.length, `${objectType}.${uebergang}`).toBeGreaterThan(3)
      }
    }
  })
})

describe('Adressaten aus der Spalte „Nebenwirkungen"', () => {
  it('schickt die eingereichte Bedarfsanfrage an KG beim Kunden (4.1)', () => {
    expect(adressaten('demandRequest', 'submit', LAGE)).toEqual([
      { rolle: 'KG', mandant: KUNDE, art: 'information', stufe: 1 },
    ])
  })

  it('schickt die Genehmigung an KB und MD (4.1)', () => {
    expect(adressaten('demandRequest', 'approve', LAGE).map((eintrag) => eintrag.rolle)).toEqual([
      'KB',
      'MD',
    ])
  })

  it('erzeugt zur Sichtung des Angebots keine Nachricht (4.2.2)', () => {
    expect(adressaten('supplierOffer', 'review', LAGE)).toEqual([])
  })

  it('erzeugt zum planmäßigen Ende des Einsatzes keine Nachricht (4.3)', () => {
    expect(adressaten('assignment', 'complete', LAGE)).toEqual([])
  })

  it('erzeugt zur Bestätigung des Belegs keine Nachricht (4.5.2)', () => {
    expect(adressaten('billingDocument', 'confirm', LAGE)).toEqual([])
  })

  it('schickt die Sperre des Lieferanten an LA und eskaliert an MA (4.6)', () => {
    expect(adressaten('supplier', 'block', { operator: BETREIBER, supplier: LIEFERANT })).toEqual([
      { rolle: 'LA', mandant: LIEFERANT, art: 'information', stufe: 1 },
      { rolle: 'MA', mandant: BETREIBER, art: 'escalation', stufe: 2 },
    ])
  })

  it('lässt eine Rolle ohne Organisation im Vorgang entfallen (2.3)', () => {
    // Ein Vorgang ohne Kunden hat kein `KE`: die Nachricht entfällt, statt an
    // irgendwen zu gehen.
    const ohneKunden: Vorgangslage = { operator: BETREIBER, supplier: LIEFERANT }
    expect(adressaten('assignment', 'create', ohneKunden).map((e) => e.rolle)).toEqual(['LD'])
  })

  it('adressiert AN nie — ohne Zugang gibt es keinen Empfänger (offene Frage 4)', () => {
    expect(mandantenDerRolle('AN', LAGE)).toEqual([])
  })
})

describe('Relative Adressaten (3.14)', () => {
  it('„an den Antragsteller": die Rolle, die beantragt hat (4.3)', () => {
    expect(
      adressaten('assignmentExtension', 'reject', { ...LAGE, antragsteller: 'LD' }),
    ).toEqual([{ rolle: 'LD', mandant: LIEFERANT, art: 'information', stufe: 1 }])
  })

  it('„an die jeweils andere Seite": bei Kundenantrag der Lieferant (4.3)', () => {
    expect(
      adressaten('assignment', 'terminateEarly', { ...LAGE, antragsteller: 'KB' }).map(
        (e) => e.rolle,
      ),
    ).toEqual(['LD'])
  })

  it('„an die jeweils andere Seite": bei Lieferantenantrag der Kunde (4.3)', () => {
    expect(
      adressaten('assignment', 'terminateEarly', { ...LAGE, antragsteller: 'LD' }).map(
        (e) => e.rolle,
      ),
    ).toEqual(['KB'])
  })

  it('„an die jeweils andere Seite" ohne Antragsteller: niemand', () => {
    // Ohne Antragsteller ist „die andere Seite" nicht bestimmbar. Geraten wird
    // nichts — eine Nachricht an beide wäre eine Entscheidung über 2.3.
    expect(adressaten('assignment', 'terminateEarly', LAGE)).toEqual([])
  })

  it('„an beide Seiten": KB beim Kunden und LD beim Lieferanten (4.3)', () => {
    expect(adressaten('assignment', 'interrupt', LAGE)).toEqual([
      { rolle: 'KB', mandant: KUNDE, art: 'information', stufe: 1 },
      { rolle: 'LD', mandant: LIEFERANT, art: 'information', stufe: 1 },
    ])
  })

  it('„an alle Beteiligten": die fünf Rollen aus 4.3', () => {
    expect(
      adressaten('assignmentExtension', 'makeEffective', LAGE).map((e) => e.rolle),
    ).toEqual(['KB', 'KG', 'KE', 'LD', 'MD'])
  })

  it('„an die Rolle der nächsten Stufe": das kopierte Rollenkürzel (4.4)', () => {
    expect(adressaten('timesheet', 'approveStage', { ...LAGE, offeneStufe: 'KG' })).toEqual([
      { rolle: 'KG', mandant: KUNDE, art: 'information', stufe: 1 },
    ])
  })

  it('„an die erfassende Seite": die Rolle, die eingereicht hat (4.4)', () => {
    expect(adressaten('timesheet', 'reject', { ...LAGE, erfassendeSeite: 'LD' })).toEqual([
      { rolle: 'LD', mandant: LIEFERANT, art: 'information', stufe: 1 },
    ])
  })

  it('„an KE bzw. LD": KE auf der Verkaufsseite (4.5)', () => {
    expect(adressaten('billingDocument', 'release', { ...LAGE, richtung: 'sales' })).toEqual([
      { rolle: 'KE', mandant: KUNDE, art: 'information', stufe: 1 },
    ])
  })

  it('„an KE bzw. LD": LD auf der Einkaufsseite (4.5)', () => {
    expect(adressaten('billingDocument', 'release', { ...LAGE, richtung: 'purchase' })).toEqual([
      { rolle: 'LD', mandant: LIEFERANT, art: 'information', stufe: 1 },
    ])
  })

  it('„an die Gegenseite" ohne Seite: niemand', () => {
    expect(adressaten('billingDocument', 'cancel', LAGE)).toEqual([])
  })

  it('„an die beanstandende Seite" (4.5)', () => {
    expect(
      adressaten('billingDocument', 'clarify', { ...LAGE, beanstandendeSeite: 'KE' }),
    ).toEqual([{ rolle: 'KE', mandant: KUNDE, art: 'information', stufe: 1 }])
  })

  it('„an den Einsteller" (5.4)', () => {
    expect(adressaten('document', 'accept', { ...LAGE, einsteller: 'LA' })).toEqual([
      { rolle: 'LA', mandant: LIEFERANT, art: 'information', stufe: 1 },
    ])
  })
})

describe('Mehrere Organisationen und Doppelte', () => {
  it('erzeugt je beteiligtem Lieferanten eine Nachricht (4.5.1, 2.3 Regel 2)', () => {
    const lage: Vorgangslage = { operator: BETREIBER, supplier: ['t-1', 't-2'] }
    expect(adressaten('billingPeriod', 'open', lage)).toEqual([
      { rolle: 'LD', mandant: 't-1', art: 'information', stufe: 1 },
      { rolle: 'LD', mandant: 't-2', art: 'information', stufe: 1 },
    ])
  })

  it('schickt beim Periodenschluss an KE und an jeden LD (4.5.1)', () => {
    const lage: Vorgangslage = { operator: BETREIBER, customer: KUNDE, supplier: ['t-1', 't-2'] }
    expect(adressaten('billingPeriod', 'close', lage)).toEqual([
      { rolle: 'KE', mandant: KUNDE, art: 'information', stufe: 1 },
      { rolle: 'LD', mandant: 't-1', art: 'information', stufe: 1 },
      { rolle: 'LD', mandant: 't-2', art: 'information', stufe: 1 },
    ])
  })

  it('schickt keine Nachricht zweimal an dieselbe Rollenzuweisung', () => {
    // „Alle Beteiligten" und eine namentlich genannte Rolle können
    // zusammenfallen; zwei Nachrichten an dieselbe Zuweisung wären eine zu viel.
    const ergebnis = adressaten('assignmentExtension', 'approve', {
      ...LAGE,
      antragsteller: 'MD',
    })
    expect(ergebnis).toEqual([{ rolle: 'MD', mandant: BETREIBER, art: 'information', stufe: 1 }])
  })
})

describe('Meldung', () => {
  it('nennt Vorgang, Ereignis und Kapitel', () => {
    expect(
      meldung({
        objectType: 'demandRequest',
        uebergang: 'approve',
        bezeichnung: 'Bedarfsanfrage BA-2026-0007',
      }),
    ).toBe('Bedarfsanfrage BA-2026-0007 ist genehmigt (4.1).')
  })

  it('trägt die Begründung, wo Kapitel 4 sie verlangt (4.4, rejected)', () => {
    expect(
      meldung({
        objectType: 'timesheet',
        uebergang: 'reject',
        bezeichnung: 'Stundenzettel Z-1',
        begruendung: 'Zwei Tage fehlen.',
      }),
    ).toBe('Stundenzettel Z-1 ist abgelehnt (4.4). Begründung: Zwei Tage fehlen.')
  })

  it('trägt sie nicht, wo Kapitel 4 sie nicht verlangt (4.2.2, rejected)', () => {
    expect(
      meldung({
        objectType: 'supplierOffer',
        uebergang: 'reject',
        bezeichnung: 'Angebot A-1',
        begruendung: 'Preis zu hoch.',
      }),
    ).toBe('Angebot A-1 ist abgelehnt (4.2.2).')
  })

  it('gibt null für einen Übergang ohne Katalogzeile', () => {
    expect(meldung({ objectType: 'demandRequest', uebergang: 'gibtEsNicht', bezeichnung: 'X' })).toBe(
      null,
    )
    expect(katalogzeile('gibtEsNicht', 'submit')).toBe(null)
  })
})


describe('Warnungen aus 4.7 (5.5.2)', () => {
  const befund = (eigenes: Partial<Pruefbefund>): Pruefbefund => ({
    check: 'P1',
    satisfied: false,
    effect: 'Warnung',
    adressaten: ['MD'],
    message: 'P1: …',
    ...eigenes,
  })

  it('meldet die unerfüllte Warnung', () => {
    const liste = [befund({})]
    expect(warnungsbefunde(liste)).toEqual(liste)
  })

  it('meldet einen erfüllten Befund nicht — er nennt kein verletztes Datum', () => {
    expect(warnungsbefunde([befund({ satisfied: true })])).toEqual([])
  })

  it('meldet eine Information nicht (5.5.2: „keine Benachrichtigung")', () => {
    expect(warnungsbefunde([befund({ effect: 'Information' })])).toEqual([])
  })

  it('meldet eine Sperre nicht — sie hat den Übergang verhindert', () => {
    expect(warnungsbefunde([befund({ effect: 'Sperre' })])).toEqual([])
  })

  it('sortiert nicht um und lässt die übrigen stehen', () => {
    const eins = befund({ check: 'P1' })
    const zwei = befund({ check: 'P10' })
    expect(warnungsbefunde([eins, befund({ satisfied: true }), zwei])).toEqual([eins, zwei])
  })
})
