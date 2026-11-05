/**
 * Der Rechenweg aus SPEC 5.2.5 — Schema, Einsatzbranche und Stufe.
 *
 * Der wichtigste Test hier ist der letzte: **ohne hinterlegte Stufenfolge
 * bleibt die Stufe offen.** Eine Stufengrenze zu erfinden hieße, einen
 * Tarifwert in den Code zu schreiben (5.2.5, CLAUDE.md). Die Rechnung darf
 * daran scheitern, aber nicht raten.
 */

import { describe, expect, it } from 'vitest'
import { pruefeBranchenzuschlag, type Zuschlagslage } from './p5Branchenzuschlag'

function lage(teile: Partial<Zuschlagslage> = {}): Zuschlagslage {
  return {
    schema: 'Beispielschema B1',
    schemaAusdruecklichOhne: false,
    brancheBestimmbar: null,
    ueberlassungstage: 273,
    positionenAbweichend: false,
    ...teile,
  }
}

describe('Schema und Anwendbarkeit (SPEC 5.2.5, Schritt 1)', () => {
  it('ist ohne Schema nicht anwendbar — Information, kein Mangel', () => {
    const ergebnis = pruefeBranchenzuschlag(
      lage({ schema: null, schemaAusdruecklichOhne: true }),
    )
    expect(ergebnis.anwendbar).toBe(false)
    expect(ergebnis.treffer).toBe(false)
    expect(ergebnis.meldung).toMatch(/nicht anwendbar/)
  })

  it('ist mit Schema anwendbar', () => {
    expect(pruefeBranchenzuschlag(lage()).anwendbar).toBe(true)
  })
})

describe('Einsatzbranche (SPEC 5.2.5, Schritt 2; 5.2.7)', () => {
  it('warnt, wenn die Branche nicht bestimmbar ist — die Stufe wirkt auf das Entgelt', () => {
    const ergebnis = pruefeBranchenzuschlag(lage({ brancheBestimmbar: false }))
    expect(ergebnis.mangel).toBe('brancheFehlt')
    expect(ergebnis.treffer).toBe(true)
    expect(ergebnis.stufeBestimmbar).toBe(false)
    expect(ergebnis.adressaten.length).toBeGreaterThan(0)
  })

  it('liest ein Schweigen des Vorgangs als bestimmbar', () => {
    // Die Grundlage führt einen Standort; 5.2.5 liest die Branche aus seiner
    // Tarifzuordnung, ersatzweise aus `customer.industrySector`. Ein Vorgang,
    // der die Lücke meint, sagt sie ausdrücklich.
    expect(pruefeBranchenzuschlag(lage()).brancheBestimmbar).toBe(true)
  })

  it('rechnet ohne Schema keine fehlende Branche an', () => {
    // Ohne Schema gibt es keinen Zuschlag — dann ist die Branche gleichgültig.
    const ergebnis = pruefeBranchenzuschlag(
      lage({ schema: null, brancheBestimmbar: false }),
    )
    expect(ergebnis.mangel).toBeNull()
  })
})

describe('Stufe (SPEC 5.2.5, Schritt 3)', () => {
  it('bestimmt die Stufe aus den Überlassungstagen der Kette, wenn die Folge hinterlegt ist', () => {
    const ergebnis = pruefeBranchenzuschlag(
      lage({
        // Synthetische Stufenfolge: **Konfiguration am Schema**, kein Wert des
        // Regelwerks. Sie steht hier nur, um die Auswahl zu prüfen.
        stufenfolge: [
          { abTagen: 42, bezeichnung: 'Stufe 1' },
          { abTagen: 180, bezeichnung: 'Stufe 3' },
          { abTagen: 365, bezeichnung: 'Stufe 5' },
        ],
      }),
    )
    expect(ergebnis.stufe).toBe('Stufe 3')
    expect(ergebnis.ueberlassungstage).toBe(273)
  })

  it('nennt die Eingangsgröße, aber keine erfundene Stufe, wenn die Folge fehlt', () => {
    const ergebnis = pruefeBranchenzuschlag(lage())
    expect(ergebnis.stufe).toBeNull()
    expect(ergebnis.stufeBestimmbar).toBe(false)
    expect(ergebnis.vermerke.join(' ')).toMatch(/Stufenfolge/)
    // Die Zahl der Überlassungstage steht trotzdem im Ergebnis.
    expect(ergebnis.meldung).toMatch(/273 Überlassungstage/)
  })

  it('bleibt ohne Tageszahl ohne Stufe', () => {
    const ergebnis = pruefeBranchenzuschlag(
      lage({
        ueberlassungstage: null,
        stufenfolge: [{ abTagen: 42, bezeichnung: 'Stufe 1' }],
      }),
    )
    expect(ergebnis.stufe).toBeNull()
  })
})

describe('Plausibilität am Beleg (SPEC 5.2.5, Schritt 4)', () => {
  it('nennt abweichende Positionen und prüft die Zuordnung, nicht die Höhe', () => {
    const ergebnis = pruefeBranchenzuschlag(lage({ positionenAbweichend: true }))
    expect(ergebnis.mangel).toBe('positionenAbweichend')
    expect(ergebnis.meldung).toMatch(/nicht die Höhe des Betrags/)
  })
})
