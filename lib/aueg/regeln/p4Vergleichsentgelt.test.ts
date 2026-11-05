/**
 * Der Rechenweg aus SPEC 5.2.4 — Verwendbarkeit des Eintrags und Wert am
 * Einsatz.
 *
 * Der Kern dieser Tests ist die Trennung der **zwei** Mängel: ein fehlender
 * Eintrag des Standorts ist unabhängig von der Fälligkeit ein Mangel, ein
 * fehlender Wert am Einsatz erst ab ihr. Dazu die Schätzung, die verwendbar ist,
 * aber kein Nachweis — sie lässt den Übergang zu, auch wo 4.7 eine Sperre
 * vorsieht.
 */

import { describe, expect, it } from 'vitest'
import { pruefeVergleichsentgelt, type Entgeltlage } from './p4Vergleichsentgelt'

function lage(teile: Partial<Entgeltlage> = {}): Entgeltlage {
  return {
    standort: 'Werk Süd',
    taetigkeit: 'Zerspanung Stufe 2',
    taetigkeitFehlt: false,
    anzahlEintraege: 1,
    eintragsbetrag: 21.4,
    quelle: 'collectiveAgreement',
    einsatzwert: 21.4,
    einsatzwertGesetzt: true,
    abweichungBegruendet: false,
    stichtag: '2026-10-20',
    zeitraum: null,
    faelligkeit: '2026-10-15',
    ...teile,
  }
}

describe('Verwendbarkeit des Eintrags (SPEC 5.2.4, Schritt 2)', () => {
  it('nimmt einen eindeutigen Eintrag mit Nachweisquelle an', () => {
    const ergebnis = pruefeVergleichsentgelt(lage())
    expect(ergebnis.verwendbar).toBe(true)
    expect(ergebnis.nachweis).toBe(true)
    expect(ergebnis.treffer).toBe(false)
  })

  it('behandelt „kein Eintrag" als Treffer, unabhängig von der Fälligkeit', () => {
    // Der Entleiher pflegt den Eintrag (3.3). Fehlt er, ist am Tag der
    // Fälligkeit nichts da — der Mangel besteht schon vorher.
    const ergebnis = pruefeVergleichsentgelt(
      lage({ anzahlEintraege: 0, eintragsbetrag: null, faelligkeit: '2027-06-01' }),
    )
    expect(ergebnis.verwendbar).toBe(false)
    expect(ergebnis.mangel).toBe('keinEintrag')
    expect(ergebnis.treffer).toBe(true)
    expect(ergebnis.adressaten).toContain('KE')
  })

  it('behandelt mehrere gültige Einträge wie „kein Eintrag" und wählt keinen aus', () => {
    const ergebnis = pruefeVergleichsentgelt(lage({ anzahlEintraege: 2 }))
    expect(ergebnis.verwendbar).toBe(false)
    expect(ergebnis.mangel).toBe('mehrdeutig')
    expect(ergebnis.meldung).toMatch(/keiner/)
  })

  it('macht die Prüfung ohne Tätigkeitsbeschreibung nicht ausführbar — wie ein Treffer', () => {
    const ergebnis = pruefeVergleichsentgelt(
      lage({ taetigkeitFehlt: true, taetigkeit: null }),
    )
    expect(ergebnis.mangel).toBe('taetigkeitFehlt')
    expect(ergebnis.treffer).toBe(true)
    // Eine Schätzung heilt diesen Mangel nicht: ohne Tätigkeit ist auch sie
    // nicht zuzuordnen.
    expect(
      pruefeVergleichsentgelt(lage({ taetigkeitFehlt: true, quelle: 'estimate' })).nurWarnung,
    ).toBe(false)
  })
})

describe('Die Schätzung ist verwendbar, aber kein Nachweis (SPEC 3.3, 5.2.4)', () => {
  it('begrenzt den Treffer auf eine Warnung', () => {
    const ergebnis = pruefeVergleichsentgelt(lage({ quelle: 'estimate' }))
    expect(ergebnis.verwendbar).toBe(true)
    expect(ergebnis.nachweis).toBe(false)
    expect(ergebnis.schaetzung).toBe(true)
    // Sie ist ein Befund — aber einer, der den Übergang zulässt.
    expect(ergebnis.treffer).toBe(true)
    expect(ergebnis.nurWarnung).toBe(true)
  })

  it('zählt die übrigen Quellen als Nachweis', () => {
    for (const quelle of ['collectiveAgreement', 'companyAgreement', 'individualContract'] as const) {
      expect(pruefeVergleichsentgelt(lage({ quelle })).nachweis).toBe(true)
    }
  })
})

describe('Wert am Einsatz (SPEC 5.2.4, Schritt 3)', () => {
  it('ist eine Information, solange der Stichtag vor der Fälligkeit liegt', () => {
    const ergebnis = pruefeVergleichsentgelt(
      lage({ einsatzwert: null, einsatzwertGesetzt: false, stichtag: '2026-03-01' }),
    )
    expect(ergebnis.faelligkeitErreicht).toBe(false)
    expect(ergebnis.treffer).toBe(false)
  })

  it('ist ein Treffer, sobald die Fälligkeit erreicht ist und der Wert fehlt', () => {
    const ergebnis = pruefeVergleichsentgelt(
      lage({ einsatzwert: null, einsatzwertGesetzt: false }),
    )
    expect(ergebnis.faelligkeitErreicht).toBe(true)
    expect(ergebnis.mangel).toBe('wertFehltNachFaelligkeit')
  })

  it('rechnet den Tag der Fälligkeit selbst mit (5.2.6)', () => {
    // Der 15.10. ist der erste Tag mit Pflicht, nicht der letzte ohne.
    const amTag = pruefeVergleichsentgelt(
      lage({ einsatzwert: null, einsatzwertGesetzt: false, stichtag: '2026-10-15' }),
    )
    expect(amTag.faelligkeitErreicht).toBe(true)

    const tagDavor = pruefeVergleichsentgelt(
      lage({ einsatzwert: null, einsatzwertGesetzt: false, stichtag: '2026-10-14' }),
    )
    expect(tagDavor.faelligkeitErreicht).toBe(false)
  })

  it('warnt bei einer Abweichung nach unten und eskaliert an die Kundenseite', () => {
    const ergebnis = pruefeVergleichsentgelt(lage({ einsatzwert: 19.8 }))
    expect(ergebnis.abweichungNachUnten).toBe(true)
    expect(ergebnis.mangel).toBe('abweichungNachUnten')
    // Nie eine Sperre: die Abweichung ist mit Begründung zulässig (3.7).
    expect(ergebnis.nurWarnung).toBe(true)
    expect(ergebnis.adressaten).toContain('KE')
  })

  it('lässt eine Abweichung nach oben als Information durchgehen', () => {
    const ergebnis = pruefeVergleichsentgelt(lage({ einsatzwert: 23 }))
    expect(ergebnis.abweichungNachOben).toBe(true)
    expect(ergebnis.treffer).toBe(false)
  })

  it('nimmt die ausdrückliche Aussage des Vorgangs über den Prüfzeitraum an', () => {
    // Beleg → `created`: die Tabelle in 5.0 bildet den Zeitraum aus den
    // zugrunde liegenden Zetteln. Nennt der Vorgang ihn nicht, sagt er
    // stattdessen, dass die Fälligkeit in ihn fällt.
    const ergebnis = pruefeVergleichsentgelt(
      lage({
        einsatzwert: null,
        einsatzwertGesetzt: false,
        stichtag: null,
        faelligkeitImZeitraumGenannt: true,
      }),
    )
    expect(ergebnis.faelligkeitErreicht).toBe(true)
    expect(ergebnis.treffer).toBe(true)
  })

  it('nennt dem Lieferanten nie den Katalog des Standorts (Schritt 4)', () => {
    expect(pruefeVergleichsentgelt(lage()).meldung).toMatch(/nie der Katalog des Standorts/)
  })
})
