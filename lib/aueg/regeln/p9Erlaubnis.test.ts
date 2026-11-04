/**
 * Der Rechenweg von P9 (SPEC 5.4.1) und seine Grenzfälle (5.4.5, 5.4.6).
 *
 * Die Gherkin-Suite in `tests/aueg/` ist der fachliche Nachweis; diese Tests
 * sind die schnelle Rückmeldung auf den Rechenweg selbst. Sie prüfen, was 5.4.1
 * Schritt für Schritt vorschreibt, und sie prüfen es ohne Umweg über einen
 * Szenariosatz.
 */
import { describe, expect, it } from 'vitest'
import { pruefeErlaubnis, pruefeVorlauf, type Erlaubnislage, type Erlaubnissatz } from './p9Erlaubnis'

/** Ein anerkannter, befristeter Satz mit hinterlegter Urkunde — der Normalfall. */
function satz(abweichung: Partial<Erlaubnissatz> = {}): Erlaubnissatz {
  return {
    id: 'EP-1',
    art: 'fixedTerm',
    gueltigVon: '2026-01-01',
    gueltigBis: '2026-12-31',
    anerkennung: 'accepted',
    urkunde: true,
    datei: true,
    vorgaenger: null,
    ...abweichung,
  }
}

function lage(
  saetze: readonly Erlaubnissatz[],
  von: string | null,
  bis?: string,
  unterbrechungen: readonly { von: string; bis: string }[] = [],
): Erlaubnislage {
  return {
    lieferant: 'Rheinpersonal GmbH',
    saetze,
    zeitraum: von === null ? null : { von, bis: bis ?? von },
    unterbrechungen,
  }
}

describe('5.4.1 Schritt 2: Deckung eines Tages', () => {
  it('deckt jeden Tag, den ein anerkannter Satz mit Urkunde umschließt', () => {
    const ergebnis = pruefeErlaubnis(lage([satz()], '2026-11-01', '2026-12-31'))
    expect(ergebnis.gedeckt).toBe(true)
    expect(ergebnis.tageGesamt).toBe(61)
    expect(ergebnis.tageGedeckt).toBe(61)
    expect(ergebnis.ersterUngedeckterTag).toBeNull()
    expect(ergebnis.mangel).toBeNull()
  })

  it('schließt validFrom und validTo ein (5.4.5, Tag genau auf der Grenze)', () => {
    expect(pruefeErlaubnis(lage([satz()], '2026-12-31')).gedeckt).toBe(true)
    expect(pruefeErlaubnis(lage([satz()], '2026-01-01')).gedeckt).toBe(true)
  })

  it('deckt den Tag nach validTo nicht', () => {
    const ergebnis = pruefeErlaubnis(lage([satz()], '2027-01-01'))
    expect(ergebnis.gedeckt).toBe(false)
    expect(ergebnis.mangel).toBe('abgelaufen')
  })

  it('deckt den Tag vor validFrom nicht', () => {
    const ergebnis = pruefeErlaubnis(lage([satz()], '2025-12-31'))
    expect(ergebnis.gedeckt).toBe(false)
    expect(ergebnis.mangel).toBe('nochNichtGueltig')
  })
})

describe('5.4.1 Schritt 3: Lücken sind Treffer', () => {
  const vorgaenger = satz({ id: 'EP-1', gueltigBis: '2026-06-30' })
  const nachfolger = satz({
    id: 'EP-2',
    gueltigVon: '2026-07-02',
    gueltigBis: '2026-12-31',
    vorgaenger: 'EP-1',
  })

  it('ist ein Treffer, auch wenn die Lücke nur einen Tag beträgt', () => {
    const ergebnis = pruefeErlaubnis(
      lage([vorgaenger, nachfolger], '2026-06-01', '2026-07-31'),
    )
    expect(ergebnis.gedeckt).toBe(false)
    expect(ergebnis.ungedeckteTage).toEqual(['2026-07-01'])
    expect(ergebnis.ersterUngedeckterTag).toBe('2026-07-01')
    expect(ergebnis.mangel).toBe('luecke')
  })

  it('heilt die Lücke nicht durch den Verweis auf den Vorgänger (5.4.5)', () => {
    const ergebnis = pruefeErlaubnis(lage([vorgaenger, nachfolger], '2026-07-01'))
    expect(ergebnis.gedeckt).toBe(false)
    expect(nachfolger.vorgaenger).toBe('EP-1')
  })

  it('deckt den Folgezeitraum, sobald der Nachfolgesatz lückenlos anschließt', () => {
    const lueckenlos = satz({ id: 'EP-2', gueltigVon: '2027-01-01', gueltigBis: '2027-12-31' })
    const ergebnis = pruefeErlaubnis(lage([satz(), lueckenlos], '2026-11-01', '2027-03-31'))
    expect(ergebnis.gedeckt).toBe(true)
  })
})

describe('5.4.1 Schritt 4: nicht anerkannt zählt nicht', () => {
  it('deckt mit `submitted` keinen Tag und meldet es dem MSP-Disponenten', () => {
    const ergebnis = pruefeErlaubnis(
      lage([satz({ anerkennung: 'submitted' })], '2026-03-01', '2026-03-31'),
    )
    expect(ergebnis.gedeckt).toBe(false)
    expect(ergebnis.tageGedeckt).toBe(0)
    expect(ergebnis.mangel).toBe('anerkennungAussteht')
    // 5.4.6: die Meldung sagt, dass die Anerkennung aussteht — nicht, dass der
    // Nachweis fehlt.
    expect(ergebnis.adressaten).toEqual(['MD'])
    expect(ergebnis.meldung).toMatch(/Anerkennung .* steht noch aus/)
    expect(ergebnis.meldung).not.toMatch(/kein Erlaubnissatz/)
  })

  it('deckt mit `rejected` keinen Tag', () => {
    const ergebnis = pruefeErlaubnis(lage([satz({ anerkennung: 'rejected' })], '2026-03-01'))
    expect(ergebnis.gedeckt).toBe(false)
    expect(ergebnis.mangel).toBe('anerkennungZurueckgewiesen')
  })
})

describe('5.4.1 Schritt 6: unbefristete Erlaubnis', () => {
  it('deckt jeden Tag ab validFrom', () => {
    const unbefristet = satz({ id: 'EP-9', art: 'unlimited', gueltigVon: '2024-07-01', gueltigBis: null })
    expect(pruefeErlaubnis(lage([unbefristet], '2027-01-01', '2027-12-31')).gedeckt).toBe(true)
    expect(pruefeErlaubnis(lage([unbefristet], '2024-06-30')).gedeckt).toBe(false)
  })

  it('rechnet mit dem strengeren Wert, wenn `unlimited` ein Enddatum trägt', () => {
    const datenfehler = satz({
      id: 'EP-9',
      art: 'unlimited',
      gueltigVon: '2024-07-01',
      gueltigBis: '2026-12-31',
    })
    const ergebnis = pruefeErlaubnis(lage([datenfehler], '2026-12-01', '2027-01-31'))
    expect(ergebnis.gedeckt).toBe(false)
    expect(ergebnis.ersterUngedeckterTag).toBe('2027-01-01')
    expect(ergebnis.maengel).toContain('enddatumBeiUnbefristet')
  })
})

describe('5.4.6: was gilt, wenn Daten fehlen', () => {
  it('ist ein Treffer, wenn kein Erlaubnissatz erfasst ist', () => {
    const ergebnis = pruefeErlaubnis(lage([], '2026-03-01', '2026-03-31'))
    expect(ergebnis.gedeckt).toBe(false)
    expect(ergebnis.mangel).toBe('keinErlaubnissatz')
    expect(ergebnis.adressaten).toEqual(['LA', 'LD'])
  })

  it('deckt nichts, wenn `validTo` bei `fixedTerm` fehlt, und nennt das Feld', () => {
    const ergebnis = pruefeErlaubnis(lage([satz({ gueltigBis: null })], '2026-03-01', '2026-03-31'))
    expect(ergebnis.gedeckt).toBe(false)
    expect(ergebnis.mangel).toBe('enddatumFehlt')
    expect(ergebnis.fehlendeFelder).toContain('validTo')
    expect(ergebnis.adressaten).toEqual(['LA', 'MD'])
  })

  it('deckt nichts, wenn `documentRef` fehlt, und nennt das Feld', () => {
    const ergebnis = pruefeErlaubnis(lage([satz({ urkunde: false })], '2026-03-01', '2026-03-31'))
    expect(ergebnis.gedeckt).toBe(false)
    expect(ergebnis.mangel).toBe('urkundeFehlt')
    expect(ergebnis.fehlendeFelder).toContain('documentRef')
  })

  it('deckt nichts, wenn `fileRef` am Dokument fehlt (5.4.5)', () => {
    const ergebnis = pruefeErlaubnis(lage([satz({ datei: false })], '2026-03-01'))
    expect(ergebnis.gedeckt).toBe(false)
    expect(ergebnis.mangel).toBe('dateiFehlt')
    expect(ergebnis.fehlendeFelder).toContain('fileRef')
  })

  it('prüft ohne Stichtag nur Anerkennung und Datenstand, nicht die Gültigkeit', () => {
    // Der Grundsatz aus 5.0 gilt den Eingangsdaten der Regel, nicht dem
    // Stichtag des Vorgangs: ein deckungsfähiger Satz liegt vor, und ohne Tag
    // gibt es keinen Tag, an dem er nicht deckt (5.4.3).
    const ergebnis = pruefeErlaubnis(lage([satz()], null))
    expect(ergebnis.gedeckt).toBe(true)
    expect(ergebnis.deckungGeprueft).toBe(false)
    expect(ergebnis.mangel).toBeNull()
    expect(ergebnis.meldung).toMatch(/nennt keinen Stichtag/)
  })

  it('bleibt ohne Stichtag ein Treffer, wenn der Erlaubnissatz selbst nicht trägt', () => {
    const ohneUrkunde = pruefeErlaubnis(lage([satz({ urkunde: false })], null))
    expect(ohneUrkunde.gedeckt).toBe(false)
    expect(ohneUrkunde.mangel).toBe('urkundeFehlt')
    const ohneSatz = pruefeErlaubnis(lage([], null))
    expect(ohneSatz.gedeckt).toBe(false)
    expect(ohneSatz.mangel).toBe('keinErlaubnissatz')
  })

  it('meldet die Deckung als geprüft, sobald ein Zeitraum vorliegt', () => {
    expect(pruefeErlaubnis(lage([satz()], '2026-03-01')).deckungGeprueft).toBe(true)
  })

  it('lässt den Satzmangel vor dem Zeitraummangel stehen (5.4.6)', () => {
    // Ohne deckungsfähigen Satz entscheidet der Satz, nicht der Zeitraum: nur
    // so unterscheidet die Meldung „Anerkennung steht aus" von „nicht prüfbar".
    const ergebnis = pruefeErlaubnis(lage([satz({ anerkennung: 'submitted' })], null))
    expect(ergebnis.mangel).toBe('anerkennungAussteht')
  })
})

describe('5.4.5: Unterbrechung verkürzt nur den Prüfzeitraum', () => {
  it('lässt die Unterbrechungstage aus der Prüfung heraus', () => {
    const bis30Juni = satz({ gueltigBis: '2026-06-30' })
    const ergebnis = pruefeErlaubnis(
      lage([bis30Juni], '2026-04-01', '2026-07-31', [{ von: '2026-07-01', bis: '2026-07-31' }]),
    )
    expect(ergebnis.tageGesamt).toBe(91)
    expect(ergebnis.gedeckt).toBe(true)
  })

  it('deckt die Tage außerhalb der Unterbrechung weiter mit', () => {
    const ergebnis = pruefeErlaubnis(
      lage([satz()], '2026-04-01', '2026-06-30', [{ von: '2026-05-01', bis: '2026-05-31' }]),
    )
    // 01.04. bis 30.06. sind 91 Tage; der Mai fällt mit seinen 31 Tagen heraus.
    expect(ergebnis.tageGesamt).toBe(60)
    expect(ergebnis.gedeckt).toBe(true)
  })
})

describe('5.4.4 und 5.5.1 N1: gestufter Vorlauf vor dem Ablauf', () => {
  const aktiv = lage([satz()], '2026-10-02')

  it('informiert, sobald 90 Tage Restzeit erreicht sind', () => {
    const ergebnis = pruefeVorlauf(aktiv, '2026-10-02')
    expect(ergebnis.stufe).toBe('information')
    expect(ergebnis.restzeitTage).toBe(90)
    expect(ergebnis.adressaten).toEqual(['LA'])
  })

  it('warnt ab 30 Tagen Restzeit, zusätzlich an den Lieferantendisponenten', () => {
    const ergebnis = pruefeVorlauf(aktiv, '2026-12-01')
    expect(ergebnis.stufe).toBe('warnung')
    expect(ergebnis.adressaten).toEqual(['LA', 'LD'])
  })

  it('eskaliert ab 14 Tagen Restzeit zusätzlich an den MSP-Disponenten', () => {
    const ergebnis = pruefeVorlauf(aktiv, '2026-12-17')
    expect(ergebnis.stufe).toBe('eskalation')
    expect(ergebnis.adressaten).toEqual(['LA', 'LD', 'MD'])
  })

  it('eskaliert nach Ablauf zusätzlich an den MSP-Administrator', () => {
    const ergebnis = pruefeVorlauf(aktiv, '2027-01-01')
    expect(ergebnis.stufe).toBe('abgelaufen')
    expect(ergebnis.adressaten).toEqual(['LA', 'LD', 'MD', 'MA'])
    // 5.4.2 a): der Lauf schlägt die Sperre vor, er vollzieht sie nicht.
    expect(ergebnis.meldung).toMatch(/Vorschlag/)
  })

  it('schweigt, solange der Vorlauf nicht erreicht ist', () => {
    expect(pruefeVorlauf(aktiv, '2026-01-02').stufe).toBe('keine')
  })

  it('kennt keine Frist bei unbefristeter Erlaubnis', () => {
    const unbefristet = lage(
      [satz({ art: 'unlimited', gueltigVon: '2024-07-01', gueltigBis: null })],
      '2027-01-01',
    )
    expect(pruefeVorlauf(unbefristet, '2027-01-01').stufe).toBe('keine')
  })

  it('rechnet mit dem spätesten Ende der deckungsfähigen Sätze', () => {
    const mitNachfolger = lage(
      [satz(), satz({ id: 'EP-2', gueltigVon: '2027-01-01', gueltigBis: '2027-12-31' })],
      '2026-12-17',
    )
    const ergebnis = pruefeVorlauf(mitNachfolger, '2026-12-17')
    expect(ergebnis.endeBis).toBe('2027-12-31')
    expect(ergebnis.stufe).toBe('keine')
  })

  it('gilt als abgelaufen, wenn kein Satz deckungsfähig ist', () => {
    const nichtAnerkannt = lage([satz({ anerkennung: 'submitted' })], '2026-10-02')
    expect(pruefeVorlauf(nichtAnerkannt, '2026-10-02').stufe).toBe('abgelaufen')
  })
})
