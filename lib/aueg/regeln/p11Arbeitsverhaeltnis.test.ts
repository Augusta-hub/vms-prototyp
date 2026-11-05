/**
 * Das Arbeitsverhältnis beim Verleiher aus SPEC 5.3.4. Der Prüfzeitpunkt ist
 * der **erste Überlassungstag**, nicht früher — und `employedSince` = erster
 * Überlassungstag genügt.
 */

import { describe, expect, it } from 'vitest'
import {
  pruefeArbeitsverhaeltnis,
  type Beschaeftigungslage,
} from './p11Arbeitsverhaeltnis'

function lage(teile: Partial<Beschaeftigungslage> = {}): Beschaeftigungslage {
  return {
    person: 'Miriam Falk',
    lieferant: 'Rheinpersonal GmbH',
    status: 'employed',
    beschaeftigtSeit: '2026-08-01',
    ersterUeberlassungstag: '2026-09-01',
    amEinsatzstart: true,
    ...teile,
  }
}

describe('Arbeitsverhältnis am ersten Überlassungstag (SPEC 5.3.4)', () => {
  it('genügt, wenn es vor dem ersten Überlassungstag begonnen hat', () => {
    const ergebnis = pruefeArbeitsverhaeltnis(lage())
    expect(ergebnis.bestehtAmErstenTag).toBe(true)
    expect(ergebnis.mangel).toBeNull()
  })

  it('genügt auch, wenn es **am** ersten Überlassungstag beginnt (Grenzfall)', () => {
    const ergebnis = pruefeArbeitsverhaeltnis(lage({ beschaeftigtSeit: '2026-09-01' }))
    expect(ergebnis.bestehtAmErstenTag).toBe(true)
    expect(ergebnis.meldung).toMatch(/besteht am ersten Überlassungstag/)
  })

  it('genügt nicht, wenn es einen Tag später beginnt', () => {
    const ergebnis = pruefeArbeitsverhaeltnis(lage({ beschaeftigtSeit: '2026-09-02' }))
    expect(ergebnis.bestehtAmErstenTag).toBe(false)
    expect(ergebnis.mangel).toBe('beginntZuSpaet')
  })

  it('spricht bei einem Bewerber an', () => {
    const ergebnis = pruefeArbeitsverhaeltnis(
      lage({ status: 'applicant', beschaeftigtSeit: null }),
    )
    expect(ergebnis.mangel).toBe('nurBewerber')
  })

  it('behandelt `inactive` wie einen Bewerber (Grenzfall)', () => {
    const ergebnis = pruefeArbeitsverhaeltnis(lage({ status: 'inactive' }))
    expect(ergebnis.mangel).toBe('inaktiv')
    expect(ergebnis.vermerke.join(' ')).toMatch(/wie ein Bewerber behandelt/)
  })
})

describe('Fehlende Angaben wirken wie ein Treffer (SPEC 5.0, 5.3.4)', () => {
  it('nennt das fehlende `employmentStatusWithSupplier`', () => {
    const ergebnis = pruefeArbeitsverhaeltnis(lage({ status: null, beschaeftigtSeit: null }))
    expect(ergebnis.mangel).toBe('statusFehlt')
    expect(ergebnis.fehlendeFelder).toEqual(['employmentStatusWithSupplier'])
  })

  it('nennt das fehlende `employedSince` bei `employed`', () => {
    const ergebnis = pruefeArbeitsverhaeltnis(lage({ beschaeftigtSeit: null }))
    expect(ergebnis.mangel).toBe('beschaeftigungsdatumFehlt')
    expect(ergebnis.fehlendeFelder).toEqual(['employedSince'])
  })

  it('beanstandet nichts, wenn der erste Überlassungstag noch nicht feststeht', () => {
    const ergebnis = pruefeArbeitsverhaeltnis(lage({ ersterUeberlassungstag: null }))
    expect(ergebnis.bestehtAmErstenTag).toBe(true)
  })
})

describe('Vorprüfung gegen Einsatzstart (SPEC 5.5.5, Q13 und Q17 gegen Q47)', () => {
  it('nennt in der Vorprüfung die Folge, nicht die Sperre', () => {
    const ergebnis = pruefeArbeitsverhaeltnis(
      lage({ status: 'applicant', beschaeftigtSeit: null, amEinsatzstart: false }),
    )
    expect(ergebnis.meldung).toMatch(/Bis zum Einsatzstart ist ein Arbeitsverhältnis nachzuweisen/)
    expect(ergebnis.vermerke.join(' ')).toMatch(/Zeile Q47/)
  })

  it('nennt am Einsatzstart den offenen Weg', () => {
    const ergebnis = pruefeArbeitsverhaeltnis(lage({ status: 'applicant', beschaeftigtSeit: null }))
    expect(ergebnis.meldung).toMatch(/der Übergang ist gesperrt/)
    expect(ergebnis.adressaten).toEqual(['MD', 'LD'])
  })

  it('prüft den Kandidatensatz des genannten Verleihers', () => {
    const ergebnis = pruefeArbeitsverhaeltnis(
      lage({ lieferant: 'Elbe Zeitarbeit GmbH', status: 'applicant', beschaeftigtSeit: null }),
    )
    expect(ergebnis.lieferant).toBe('Elbe Zeitarbeit GmbH')
    expect(ergebnis.meldung).toMatch(/Elbe Zeitarbeit GmbH/)
  })
})
