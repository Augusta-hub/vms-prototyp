/**
 * Die Drehtürklausel aus SPEC 5.3.1. Entscheidend sind drei Dinge: das
 * Rückschaufenster auf den Tag genau, die Rechtsfolge (Equal Pay, **kein**
 * Einsatzverbot) und der Unterschied zwischen „nein" und „nicht erfasst".
 */

import { describe, expect, it } from 'vitest'
import { pruefeDrehtuer, type Drehtuerlage, type Vorbeschaeftigung } from './p6Drehtuer'

function erklaerung(teile: Partial<Vorbeschaeftigung> = {}): Vorbeschaeftigung {
  return {
    bestand: true,
    ende: '2026-04-30',
    arbeitgeber: 'Nordwerk Metall GmbH',
    erklaert: '2026-08-10',
    lieferant: 'Rheinpersonal GmbH',
    ...teile,
  }
}

function lage(teile: Partial<Drehtuerlage> = {}): Drehtuerlage {
  return {
    person: 'Miriam Falk',
    entleiher: 'Nordwerk Metall GmbH',
    konzern: 'Nordwerk Gruppe',
    konzernunternehmen: ['Nordwerk Service GmbH'],
    ueberlassungsbeginn: '2026-09-01',
    erklaerung: erklaerung(),
    lieferant: 'Rheinpersonal GmbH',
    ...teile,
  }
}

describe('Rückschaufenster (SPEC 5.3.1, Schritt 2)', () => {
  it('reicht sechs Monate vor den Stichtag bis zum Vortag', () => {
    const ergebnis = pruefeDrehtuer(lage())
    expect(ergebnis.stichtag).toBe('2026-09-01')
    expect(ergebnis.fensterVon).toBe('2026-03-01')
    expect(ergebnis.fensterBis).toBe('2026-08-31')
  })

  it('hängt am Überlassungsbeginn: ein verschobener Start verschiebt das Fenster', () => {
    const ergebnis = pruefeDrehtuer(lage({ ueberlassungsbeginn: '2026-12-01' }))
    expect(ergebnis.fensterVon).toBe('2026-06-01')
    expect(ergebnis.fensterBis).toBe('2026-11-30')
    expect(ergebnis.treffer).toBe(false)
  })

  it('zählt den ersten und den letzten Tag des Fensters mit (Grenzfall)', () => {
    expect(pruefeDrehtuer(lage({ erklaerung: erklaerung({ ende: '2026-03-01' }) })).treffer).toBe(
      true,
    )
    expect(pruefeDrehtuer(lage({ erklaerung: erklaerung({ ende: '2026-08-31' }) })).treffer).toBe(
      true,
    )
    expect(pruefeDrehtuer(lage({ erklaerung: erklaerung({ ende: '2026-02-28' }) })).treffer).toBe(
      false,
    )
  })
})

describe('Auswertung der Erklärung (SPEC 5.3.1, Schritt 3)', () => {
  it('ist bei „nein" kein Treffer und bleibt prüfbar', () => {
    const ergebnis = pruefeDrehtuer(
      lage({ erklaerung: erklaerung({ bestand: false, ende: null, arbeitgeber: null }) }),
    )
    expect(ergebnis.pruefbar).toBe(true)
    expect(ergebnis.treffer).toBe(false)
    expect(ergebnis.mangel).toBeNull()
  })

  it('ist ohne Erklärung **nicht prüfbar** und nennt das fehlende Feld', () => {
    const ergebnis = pruefeDrehtuer(lage({ erklaerung: null }))
    expect(ergebnis.pruefbar).toBe(false)
    expect(ergebnis.mangel).toBe('erklaerungFehlt')
    expect(ergebnis.fehlendeFelder).toEqual(['previousEmploymentDeclaration'])
    expect(ergebnis.treffer).toBe(false)
  })

  it('zieht die Equal-Pay-Fälligkeit nicht vor, solange die Erklärung fehlt', () => {
    const ergebnis = pruefeDrehtuer(lage({ erklaerung: null }))
    expect(ergebnis.equalPayAbErstemTag).toBe(false)
    expect(ergebnis.vermerke.join(' ')).toMatch(/nicht vorgezogen/)
  })

  it('ist bei „ja" ohne Datum nicht prüfbar', () => {
    const ergebnis = pruefeDrehtuer(lage({ erklaerung: erklaerung({ ende: null }) }))
    expect(ergebnis.pruefbar).toBe(false)
    expect(ergebnis.mangel).toBe('endeFehlt')
  })

  it('hält das Austrittsdatum außerhalb des Fensters sichtbar', () => {
    const ergebnis = pruefeDrehtuer(lage({ erklaerung: erklaerung({ ende: '2026-01-31' }) }))
    expect(ergebnis.treffer).toBe(false)
    expect(ergebnis.austritt).toBe('2026-01-31')
    expect(ergebnis.vermerke.join(' ')).toMatch(/kann es wieder in das Fenster holen/)
  })

  it('verlangt beim Lieferantenwechsel eine eigene Erklärung des neuen Kandidatensatzes', () => {
    const ergebnis = pruefeDrehtuer(lage({ lieferant: 'Elbe Zeitarbeit GmbH' }))
    expect(ergebnis.pruefbar).toBe(false)
    expect(ergebnis.mangel).toBe('erklaerungAnderenVerleihers')
  })
})

describe('Konzernbezug (SPEC 5.3.1, Schritt 4)', () => {
  it('trifft auch bei einem Unternehmen desselben Konzerns', () => {
    const ergebnis = pruefeDrehtuer(
      lage({
        erklaerung: erklaerung({ arbeitgeber: 'Nordwerk Service GmbH', ende: '2026-05-31' }),
      }),
    )
    expect(ergebnis.treffer).toBe(true)
    expect(ergebnis.bezug).toBe('konzern')
  })

  it('prüft ohne gepflegten Konzern nur den Entleiher selbst und vermerkt es', () => {
    const ergebnis = pruefeDrehtuer(
      lage({
        konzern: null,
        konzernunternehmen: [],
        erklaerung: erklaerung({ arbeitgeber: 'Nordwerk Service GmbH', ende: '2026-05-31' }),
      }),
    )
    expect(ergebnis.treffer).toBe(false)
    expect(ergebnis.konzernGeprueft).toBe(false)
    expect(ergebnis.adressaten).toContain('MA')
    expect(ergebnis.vermerke.join(' ')).toMatch(/Konzernbetrachtung war nicht möglich/)
  })

  it('trifft nicht bei einem dritten Arbeitgeber', () => {
    const ergebnis = pruefeDrehtuer(
      lage({ erklaerung: erklaerung({ arbeitgeber: 'Fremdwerk AG' }) }),
    )
    expect(ergebnis.treffer).toBe(false)
    expect(ergebnis.bezug).toBe('dritter')
  })
})

describe('Rechtsfolge (SPEC 5.3.1, Schritt 5)', () => {
  it('setzt bei einem Treffer Equal Pay ab dem ersten Überlassungstag', () => {
    const ergebnis = pruefeDrehtuer(lage())
    expect(ergebnis.treffer).toBe(true)
    expect(ergebnis.equalPayAbErstemTag).toBe(true)
    expect(ergebnis.adressaten).toEqual(['MD', 'LD'])
    expect(ergebnis.meldung).toMatch(/Equal Pay ab dem ersten Überlassungstag/)
    // § 8 Abs. 3 untersagt die Überlassung nicht — das ist der Kern der Regel.
    expect(ergebnis.meldung).toMatch(/Überlassung selbst ist zulässig/)
  })

  it('lässt das Rückschaufenster ohne Überlassungsbeginn offen', () => {
    const ergebnis = pruefeDrehtuer(lage({ ueberlassungsbeginn: null }))
    expect(ergebnis.fensterVon).toBeNull()
    expect(ergebnis.treffer).toBe(false)
    expect(ergebnis.pruefbar).toBe(true)
  })
})
