/**
 * Der Rechenweg aus SPEC 5.3.3 — die Kriterien K1 bis K5 und die drei
 * Prüfstufen.
 *
 * Zwei Dinge sind hier wichtiger als die einzelnen Kriterien:
 *
 *  1. **Die Stufe entscheidet, was geprüft wird.** Die Bedarfsanfrage ist kein
 *     Überlassungsvertrag; an ihr wird nicht K1 geprüft, und sie kann nicht
 *     gesperrt werden. Wer alle fünf Kriterien überall prüft, sperrt eine
 *     Anfrage wegen eines Rahmenvertrags, den es noch nicht gibt.
 *  2. **Das Ergebnis behauptet nichts über den Inhalt.** 5.3.3 Nr. 4: genannt
 *     wird, **was** geprüft wurde, nicht „die Konkretisierung ist erfüllt".
 *     Diese Software kann die Form eines Vertrags nicht beurteilen.
 */

import { describe, expect, it } from 'vitest'
import {
  pruefeKonkretisierung,
  type Konkretisierungslage,
  type Rahmenvertrag,
} from './p8Konkretisierung'

const RAHMENVERTRAG: Rahmenvertrag = {
  bezeichnung: 'RV-L-2026-004',
  art: 'supplierAgreement',
  status: 'active',
  gegenpartei: 'Rheinpersonal GmbH',
  laufzeitVon: '2026-01-01',
  laufzeitBis: '2027-12-31',
}

function lage(teile: Partial<Konkretisierungslage> = {}): Konkretisierungslage {
  return {
    preisposition: 'PP-14',
    rahmenvertrag: RAHMENVERTRAG,
    lieferant: 'Rheinpersonal GmbH',
    kandidat: 'Miriam Falk',
    taetigkeit: 'Zerspanung an CNC-Drehmaschine, Dreischicht',
    titelDerAnfrage: 'Zerspanung Werk Süd',
    taetigkeitWieTitel: false,
    mitAnfrage: true,
    qualifikationsanforderung: true,
    standort: 'Werk Süd',
    beginnGesetzt: true,
    geplanterBeginn: '2026-09-01',
    geplantesEnde: '2026-12-31',
    anlagetag: '2026-08-25',
    ersterUeberlassungstag: '2026-09-01',
    ...teile,
  }
}

const offenVon = (teile: Partial<Konkretisierungslage>, stufe: 'anlage' | 'start' = 'anlage') =>
  pruefeKonkretisierung(lage(teile), stufe).offen

describe('Die Prüfstufe bestimmt den Umfang (SPEC 5.3.3, Nr. 1 bis 3)', () => {
  it('prüft an der Bedarfsanfrage nur die Vorläufer von K3', () => {
    const ergebnis = pruefeKonkretisierung(
      // Ohne Rahmenvertrag und ohne Kandidat — an der Anfrage ohne Belang.
      lage({ rahmenvertrag: null, preisposition: null, kandidat: null, standort: null }),
      'anfrage',
    )
    expect(ergebnis.kriterien.map((befund) => befund.kriterium)).toEqual(['K3'])
    expect(ergebnis.treffer).toBe(false)
  })

  it('prüft beim Anlegen K1 bis K4, nicht K5', () => {
    const ergebnis = pruefeKonkretisierung(lage({ anlagetag: null }), 'anlage')
    expect(ergebnis.kriterien.map((befund) => befund.kriterium)).toEqual(['K1', 'K2', 'K3', 'K4'])
    expect(ergebnis.treffer).toBe(false)
  })

  it('prüft am Start K1 bis K5 — Rahmenvertrag und Felder können sich geändert haben', () => {
    const ergebnis = pruefeKonkretisierung(lage(), 'start')
    expect(ergebnis.kriterien.map((befund) => befund.kriterium)).toEqual([
      'K1',
      'K2',
      'K3',
      'K4',
      'K5',
    ])
    expect(ergebnis.vermerke.join(' ')).toMatch(/erneut geprüft/)
  })
})

describe('K1 Kennzeichnung (SPEC 5.3.3)', () => {
  it('nimmt einen aktiven Rahmenvertrag der Lieferantenseite an', () => {
    expect(offenVon({})).toEqual([])
  })

  it('macht K1 ohne Preisposition **nicht prüfbar** — und das wirkt wie ein Treffer', () => {
    // 5.3.3, Grenzfall „Fehlende Preisposition": das Feld ist in 3.7 Pflicht,
    // der Fall ist ein Datenfehler (5.0).
    const ergebnis = pruefeKonkretisierung(lage({ preisposition: null }), 'anlage')
    expect(ergebnis.nichtPruefbar).toEqual(['K1'])
    expect(ergebnis.offen).toEqual(['K1'])
    expect(ergebnis.treffer).toBe(true)
    expect(ergebnis.fehlendeFelder).toContain('agreedRateCardItemRef')
  })

  it('lässt einen Rahmenvertrag, der nicht aktiv ist, nicht als Kennzeichnung gelten', () => {
    expect(offenVon({ rahmenvertrag: { ...RAHMENVERTRAG, status: 'terminated' } })).toEqual(['K1'])
  })

  it('verlangt die Lieferantenseite, nicht irgendeinen Rahmenvertrag', () => {
    expect(offenVon({ rahmenvertrag: { ...RAHMENVERTRAG, art: 'customerAgreement' } })).toEqual([
      'K1',
    ])
  })

  it('verlangt den Lieferanten des Einsatzes als Gegenpartei', () => {
    // 5.3.3, Grenzfall „Lieferantenwechsel": der neue Einsatz braucht einen
    // eigenen Rahmenvertrag des neuen Lieferanten.
    const ergebnis = pruefeKonkretisierung(
      lage({ lieferant: 'Elbe Zeitarbeit GmbH' }),
      'anlage',
    )
    expect(ergebnis.offen).toEqual(['K1'])
    expect(ergebnis.kriterien[0]?.grund).toMatch(/Lieferantenwechsel/)
  })

  it('verlangt die Deckung des Beginns, nicht nur einen aktiven Vertrag', () => {
    expect(
      offenVon({ rahmenvertrag: { ...RAHMENVERTRAG, laufzeitVon: '2026-10-01' } }),
    ).toEqual(['K1'])
  })
})

describe('Rahmenvertrag endet im Einsatzzeitraum (SPEC 5.3.3, Grenzfall)', () => {
  it('ist eine Warnung mit Nennung des Enddatums, keine Sperre', () => {
    const ergebnis = pruefeKonkretisierung(lage({ geplantesEnde: '2028-06-30' }), 'anlage')
    expect(ergebnis.offen).toEqual([])
    expect(ergebnis.treffer).toBe(true)
    expect(ergebnis.nurWarnung).toBe(true)
    expect(ergebnis.laufzeitendeImEinsatz).toBe('2027-12-31')
    expect(ergebnis.vermerke.join(' ')).toMatch(/verlängert werden/)
  })

  it('mildert nicht, solange ein Kriterium offen ist', () => {
    // Ein offenes Kriterium ist die Sperre, die 4.7 vorsieht; die
    // Laufzeitwarnung darf sie nicht überschreiben.
    const ergebnis = pruefeKonkretisierung(
      lage({ geplantesEnde: '2028-06-30', kandidat: null }),
      'anlage',
    )
    expect(ergebnis.nurWarnung).toBe(false)
    expect(ergebnis.offen).toEqual(['K2'])
  })

  it('warnt nicht, wenn der Vertrag das geplante Ende deckt', () => {
    expect(pruefeKonkretisierung(lage(), 'anlage').laufzeitendeImEinsatz).toBeNull()
  })
})

describe('K2 bis K4 (SPEC 5.3.3)', () => {
  it('verlangt den Kandidaten (K2)', () => {
    expect(offenVon({ kandidat: null })).toEqual(['K2'])
  })

  it('verlangt eine Tätigkeitsbeschreibung, die nicht der Titel ist (K3)', () => {
    expect(offenVon({ taetigkeit: '  ' })).toEqual(['K3'])
    expect(offenVon({ taetigkeitWieTitel: true })).toEqual(['K3'])
  })

  it('lässt den Vergleich mit dem Titel ohne Bedarfsanfrage entfallen (K3)', () => {
    // 5.3.3, Grenzfall „Einsatz ohne Bedarfsanfrage": `demandRequestRef` ist in
    // 3.7 optional; K3 prüft dann nur „gesetzt und nicht leer".
    const ergebnis = pruefeKonkretisierung(
      lage({ mitAnfrage: false, taetigkeitWieTitel: true }),
      'anlage',
    )
    expect(ergebnis.offen).toEqual([])
    expect(ergebnis.vermerke.join(' ')).toMatch(/Vergleich mit dem Titel entfällt/)
  })

  it('verlangt Standort und gesetzten Beginn (K4)', () => {
    expect(offenVon({ standort: null })).toEqual(['K4'])
    expect(offenVon({ beginnGesetzt: false })).toEqual(['K4'])
  })
})

describe('K5 Rechtzeitigkeit (SPEC 5.3.3)', () => {
  it('ist erfüllt, wenn die Anlage vor dem ersten Überlassungstag liegt', () => {
    expect(offenVon({}, 'start')).toEqual([])
  })

  it('genügt am ersten Überlassungstag selbst', () => {
    // 5.3.3, Grenzfall „Tag genau auf der Grenze": beurteilt wird die
    // Tagesreihenfolge, nicht die Uhrzeit des Vertrags.
    expect(offenVon({ anlagetag: '2026-09-01' }, 'start')).toEqual([])
  })

  it('ist nicht erfüllt, wenn die Anlage nach dem ersten Überlassungstag liegt', () => {
    const ergebnis = pruefeKonkretisierung(lage({ anlagetag: '2026-09-05' }), 'start')
    expect(ergebnis.offen).toEqual(['K5'])
    expect(ergebnis.kriterien[4]?.grund).toMatch(/nicht\s+mehr heilbar/)
  })

  it('ist ohne Tag der Anlage nicht prüfbar und wirkt wie ein Treffer', () => {
    const ergebnis = pruefeKonkretisierung(lage({ anlagetag: null }), 'start')
    expect(ergebnis.nichtPruefbar).toEqual(['K5'])
    expect(ergebnis.treffer).toBe(true)
  })
})

describe('Vorläufer von K3 an der Bedarfsanfrage (SPEC 5.3.3, Nr. 1)', () => {
  it('warnt, wenn Titel und Beschreibung identisch sind', () => {
    const ergebnis = pruefeKonkretisierung(lage({ taetigkeitWieTitel: true }), 'anfrage')
    expect(ergebnis.treffer).toBe(true)
    expect(ergebnis.adressaten).toContain('KB')
    expect(ergebnis.meldung).toMatch(/kein Überlassungsvertrag/)
  })

  it('zählt die fehlende Qualifikationsanforderung mit', () => {
    expect(pruefeKonkretisierung(lage({ qualifikationsanforderung: false }), 'anfrage').treffer).toBe(
      true,
    )
  })

  it('verlangt sie nicht, wo der Vorgang nichts über sie sagt', () => {
    // `null` ist keine Verneinung. Eine Anfrage, die zur
    // Qualifikationsanforderung schweigt, wird nicht dafür gerügt — 4.1 macht
    // sie zur Pflicht ab `submitted`, und **das** prüft die Übergangsmenge.
    expect(
      pruefeKonkretisierung(lage({ qualifikationsanforderung: null }), 'anfrage').treffer,
    ).toBe(false)
  })
})

describe('Das Ergebnis behauptet nichts über den Inhalt (SPEC 5.3.3, Nr. 4)', () => {
  it('nennt die geprüften Kriterien', () => {
    const ergebnis = pruefeKonkretisierung(lage(), 'anlage')
    expect(ergebnis.meldung).toMatch(/Geprüft sind die Kriterien K1, K2, K3, K4/)
  })

  it('sagt nicht, die Konkretisierung sei inhaltlich erfüllt', () => {
    const ergebnis = pruefeKonkretisierung(lage(), 'anlage')
    expect(ergebnis.meldung).toMatch(/beurteilt das System nicht/)
    expect(ergebnis.meldung).not.toMatch(/Konkretisierung ist (?:inhaltlich )?erfüllt/)
  })

  it('nennt im Trefferfall den offenen Weg und schließt die Übersteuerung aus', () => {
    const ergebnis = pruefeKonkretisierung(lage({ kandidat: null }), 'anlage')
    expect(ergebnis.meldung).toMatch(/nachzutragen/)
    expect(ergebnis.meldung).toMatch(/übersteuert wird die Konkretisierung nicht/)
    expect(ergebnis.adressaten).toEqual(['MD', 'MA'])
  })
})
