/**
 * Die Abschrift der Querschnittstabelle 4.7.
 *
 * Geprüft wird, dass die Zeilen zu P9 so stehen, wie 4.7 sie führt (bestätigt
 * in 5.5.5) — und dass die Suche eine Zeile nur dann liefert, wenn sie
 * eindeutig ist. Eine falsch getroffene Zeile wäre eine falsche Ergebnisart,
 * und das ist der Unterschied zwischen einer Sperre und einer Warnung.
 */
import { describe, expect, it } from 'vitest'
import { QUERSCHNITT, zeileFuerNachtlauf, zeileFuerUebergang } from './querschnitt'

describe('Zeilen zu P9 (SPEC 4.7, bestätigt in 5.5.5)', () => {
  it('führt genau die acht sperrenden Zeilen aus 5.5.6', () => {
    const sperrend = QUERSCHNITT.filter(
      (zeile) => zeile.pruefung === 'P9' && zeile.trefferart === 'sperre',
    ).map((zeile) => zeile.nummer)
    expect(sperrend).toEqual(['Q04', 'Q06', 'Q16', 'Q20', 'Q31', 'Q41', 'Q43', 'Q44'])
  })

  it('warnt am Einkaufsbeleg statt zu sperren (Q38)', () => {
    const zeile = zeileFuerUebergang('P9', 'beleg', null, 'created')
    expect(zeile?.nummer).toBe('Q38')
    expect(zeile?.trefferart).toBe('warnung')
  })

  it('wirkt bei Q04 je Einladung, nicht auf die Ausschreibung', () => {
    const zeile = zeileFuerUebergang('P9', 'bedarfsanfrage', 'approved', 'tendered')
    expect(zeile?.nummer).toBe('Q04')
    expect(zeile?.jeEinladung).toBe(true)
  })
})

describe('Suche nach der Zeile eines Übergangs', () => {
  it('unterscheidet Q41, Q43 und Q44 am Ausgangsstatus', () => {
    expect(zeileFuerUebergang('P9', 'lieferant', 'onboarding', 'active')?.nummer).toBe('Q41')
    expect(zeileFuerUebergang('P9', 'lieferant', 'blocked', 'active')?.nummer).toBe('Q43')
    expect(zeileFuerUebergang('P9', 'lieferant', 'inactive', 'active')?.nummer).toBe('Q44')
  })

  it('liefert ohne Ausgangsstatus nur, was eindeutig ist', () => {
    // Drei Zeilen führen nach `active`; ohne Ausgangsstatus ist keine gemeint.
    expect(zeileFuerUebergang('P9', 'lieferant', null, 'active')).toBeNull()
    // Zur Verlängerung führt nur Q31; dort ist der Ausgangsstatus entbehrlich.
    expect(zeileFuerUebergang('P9', 'verlaengerung', null, 'effective')?.nummer).toBe('Q31')
  })

  it('liefert nichts für einen Übergang, den 4.7 zu P9 nicht nennt', () => {
    expect(zeileFuerUebergang('P9', 'einsatz', 'active', 'interrupted')).toBeNull()
    expect(zeileFuerUebergang('P9', 'stundenzettel', 'inApproval', 'approved')).toBeNull()
  })

  it('liefert keine Zeile für eine Prüfung ohne Rechenweg', () => {
    expect(zeileFuerUebergang('P1', 'einsatz', 'planned', 'active')).toBeNull()
    expect(zeileFuerUebergang('P11', 'einsatz', 'planned', 'active')).toBeNull()
  })

  it('unterscheidet P9 und P10 am selben Übergang', () => {
    // Q20 und Q21 liegen beide auf `planned` → `active` (4.7): die Erlaubnis
    // über P9, die Pflichtnachweise über P10.
    expect(zeileFuerUebergang('P9', 'einsatz', 'planned', 'active')?.nummer).toBe('Q20')
    expect(zeileFuerUebergang('P10', 'einsatz', 'planned', 'active')?.nummer).toBe('Q21')
    // Q41 ist P9, Q42 ist P10 — beide auf `onboarding` → `active`.
    expect(zeileFuerUebergang('P9', 'lieferant', 'onboarding', 'active')?.nummer).toBe('Q41')
    expect(zeileFuerUebergang('P10', 'lieferant', 'onboarding', 'active')?.nummer).toBe('Q42')
  })

  it('führt die P10-Zeilen mit Ergebnisart aus dem Katalog (offene Frage 31)', () => {
    const ausKatalog = QUERSCHNITT.filter((zeile) => zeile.pruefung === 'P10').map(
      (zeile) => zeile.nummer,
    )
    expect(ausKatalog).toEqual(['Q10', 'Q21', 'Q37', 'Q42', 'Q43', 'Q44', 'N5'])
    expect(
      QUERSCHNITT.filter((zeile) => zeile.pruefung === 'P10').every(
        (zeile) => zeile.ergebnisartAusKatalog === true,
      ),
    ).toBe(true)
  })
})

describe('Nächtlicher Lauf (SPEC 5.5.1)', () => {
  it('findet N1 zum Lieferanten', () => {
    const zeile = zeileFuerNachtlauf('P9', 'lieferant')
    expect(zeile?.nummer).toBe('N1')
    // 5.5.1 c): der Lauf erzeugt keine Sperre — sie bräuchte einen Übergang.
    expect(zeile?.trefferart).toBe('warnung')
    expect(zeile?.nach).toBeNull()
  })

  it('findet N5 zum Einsatz', () => {
    expect(zeileFuerNachtlauf('P10', 'einsatz')?.nummer).toBe('N5')
  })

  it('findet keinen nächtlichen Lauf zu einer Prüfung ohne Zeile', () => {
    expect(zeileFuerNachtlauf('P1', 'einsatz')).toBeNull()
    // N1 gilt dem Lieferanten, N5 dem Einsatz — nicht umgekehrt.
    expect(zeileFuerNachtlauf('P10', 'lieferant')).toBeNull()
    expect(zeileFuerNachtlauf('P9', 'einsatz')).toBeNull()
  })
})
