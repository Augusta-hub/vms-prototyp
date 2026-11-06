/**
 * Der Pflichtkatalog aus SPEC 5.4.4 und seine Grenzfälle (5.4.5, 5.4.6).
 *
 * Der Kern dieser Tests ist die Sammelprüfung: welche Nachweisart an welchem
 * Übergang geprüft wird, welche Wirkung ihr Fehlen hat, und dass das
 * Sammelergebnis das **strengste Einzelergebnis** ist — bei einzeln geführten
 * Feststellungen.
 */
import { describe, expect, it } from 'vitest'
import {
  katalogwirkung,
  passtZumBezugsobjekt,
  pruefeNachweise,
  pruefeNachweisVorlauf,
  type Nachweis,
  type Nachweislage,
} from './p10Nachweise'
import type { Nachweisart } from '../regelwerk'

function nachweis(art: Nachweisart, abweichung: Partial<Nachweis> = {}): Nachweis {
  return {
    art,
    anerkennung: 'accepted',
    gueltigVon: '2026-01-01',
    gueltigBis: '2026-12-31',
    datei: true,
    gehoertZu: null,
    ...abweichung,
  }
}

function lage(abweichung: Partial<Nachweislage> = {}): Nachweislage {
  return {
    zeitraum: { von: '2026-03-01', bis: '2026-03-01' },
    nachweise: [],
    arbeitserlaubnisErforderlich: true,
    unterweisungVerlangt: true,
    ausdruecklichAbwesend: [],
    bezugsobjekt: null,
    ...abweichung,
  }
}

describe('5.4.4: welche Nachweisart an welchem Übergang', () => {
  it('prüft am Einsatzstart Arbeitserlaubnis, Unterweisung und Qualifikation (Q21)', () => {
    const ergebnis = pruefeNachweise(
      lage({ nachweise: [nachweis('workPermit'), nachweis('safetyBriefing')] }),
      'Q21',
    )
    expect(ergebnis.einzelbefunde.map((befund) => befund.art)).toEqual([
      'workPermit',
      'safetyBriefing',
      'qualificationCertificate',
    ])
    expect(ergebnis.erfuellt).toBe(true)
    expect(ergebnis.ergebnisart).toBe('information')
  })

  it('prüft die AÜG-Erlaubnis nicht — die läuft über P9', () => {
    const ergebnis = pruefeNachweise(lage(), 'Q21')
    expect(ergebnis.einzelbefunde.map((befund) => befund.art)).not.toContain('permitCertificate')
  })

  it('prüft am Lieferanten die Unbedenklichkeitsbescheinigung (Q42)', () => {
    const ergebnis = pruefeNachweise(lage({ nachweise: [] }), 'Q42')
    expect(ergebnis.einzelbefunde.map((befund) => befund.art)).toEqual(['clearanceCertificate'])
  })

  it('prüft am Stundenzettel nur die Unterweisung (Q37)', () => {
    const ergebnis = pruefeNachweise(lage({ nachweise: [] }), 'Q37')
    expect(ergebnis.einzelbefunde.map((befund) => befund.art)).toEqual(['safetyBriefing'])
  })
})

describe('5.4.4: die Wirkung je Nachweisart (offene Frage 31)', () => {
  it('sperrt den Einsatzstart, wenn die Unterweisung fehlt', () => {
    const ergebnis = pruefeNachweise(lage({ nachweise: [nachweis('workPermit')] }), 'Q21')
    const unterweisung = ergebnis.maengel.find((befund) => befund.art === 'safetyBriefing')
    expect(unterweisung?.mangel).toBe('fehlt')
    expect(unterweisung?.ergebnisart).toBe('sperre')
    expect(ergebnis.ergebnisart).toBe('sperre')
    // 5.5.2 Nr. 2: die Feststellung nennt Nachweisart und Bezugsobjekt.
    expect(unterweisung?.bezugsobjekt).toBe('einsatz')
    expect(unterweisung?.meldung).toMatch(/safetyBriefing/)
    expect(unterweisung?.meldung).not.toMatch(/unvollständig/)
  })

  it('warnt nur, wenn der Qualifikationsnachweis fehlt — er sperrt nie', () => {
    const ergebnis = pruefeNachweise(
      lage({
        nachweise: [nachweis('workPermit'), nachweis('safetyBriefing')],
        ausdruecklichAbwesend: ['qualificationCertificate'],
      }),
      'Q21',
    )
    const qualifikation = ergebnis.maengel.find(
      (befund) => befund.art === 'qualificationCertificate',
    )
    expect(qualifikation?.ergebnisart).toBe('warnung')
    expect(qualifikation?.sperrend).toBe(false)
    // Das Sammelergebnis ist das strengste Einzelergebnis — hier eine Warnung.
    expect(ergebnis.ergebnisart).toBe('warnung')
    expect(ergebnis.maengel).toHaveLength(1)
  })

  it('warnt nur, wenn die Unbedenklichkeitsbescheinigung fehlt (Q42)', () => {
    const ergebnis = pruefeNachweise(
      lage({ nachweise: [], ausdruecklichAbwesend: ['clearanceCertificate'] }),
      'Q42',
    )
    expect(ergebnis.ergebnisart).toBe('warnung')
  })

  it('informiert am Profilvorschlag, auch wenn die Arbeitserlaubnis fehlt (Q10)', () => {
    const ergebnis = pruefeNachweise(lage({ nachweise: [] }), 'Q10')
    const arbeitserlaubnis = ergebnis.maengel.find((befund) => befund.art === 'workPermit')
    expect(arbeitserlaubnis?.mangel).toBe('fehlt')
    expect(arbeitserlaubnis?.ergebnisart).toBe('information')
  })

  it('warnt am Stundenzettel bei abgelaufener Unterweisung, statt zu sperren (Q37)', () => {
    const ergebnis = pruefeNachweise(
      lage({
        zeitraum: { von: '2027-09-01', bis: '2027-09-30' },
        nachweise: [nachweis('safetyBriefing', { gueltigBis: '2027-08-31' })],
      }),
      'Q37',
    )
    expect(ergebnis.maengel[0]?.mangel).toBe('abgelaufen')
    expect(ergebnis.ergebnisart).toBe('warnung')
  })
})

describe('5.4.3: geprüft wird die Anerkennung', () => {
  it('deckt mit `submitted` keinen Pflichtnachweis', () => {
    const ergebnis = pruefeNachweise(
      lage({
        nachweise: [nachweis('workPermit', { anerkennung: 'submitted' }), nachweis('safetyBriefing')],
      }),
      'Q21',
    )
    const arbeitserlaubnis = ergebnis.maengel.find((befund) => befund.art === 'workPermit')
    expect(arbeitserlaubnis?.mangel).toBe('nichtAnerkannt')
    expect(ergebnis.ergebnisart).toBe('sperre')
  })

  it('deckt mit `rejected` nichts', () => {
    const ergebnis = pruefeNachweise(
      lage({ nachweise: [nachweis('safetyBriefing', { anerkennung: 'rejected' })] }),
      'Q37',
    )
    expect(ergebnis.maengel[0]?.mangel).toBe('nichtAnerkannt')
  })

  it('deckt nichts ohne hinterlegte Datei (3.10, 5.4.5)', () => {
    const ergebnis = pruefeNachweise(
      lage({ nachweise: [nachweis('safetyBriefing', { datei: false })] }),
      'Q37',
    )
    expect(ergebnis.maengel[0]?.mangel).toBe('dateiFehlt')
  })

  it('gilt unbefristet, wenn kein Enddatum gesetzt ist (5.4.4)', () => {
    const ergebnis = pruefeNachweise(
      lage({
        zeitraum: { von: '2030-01-01', bis: '2030-12-31' },
        nachweise: [
          nachweis('workPermit', { gueltigBis: null }),
          nachweis('safetyBriefing', { gueltigBis: null }),
        ],
      }),
      'Q21',
    )
    expect(ergebnis.erfuellt).toBe(true)
  })

  it('schließt den letzten Gültigkeitstag ein (5.4.5)', () => {
    const amEnde = lage({
      zeitraum: { von: '2026-12-31', bis: '2026-12-31' },
      nachweise: [nachweis('workPermit'), nachweis('safetyBriefing')],
    })
    expect(pruefeNachweise(amEnde, 'Q21').erfuellt).toBe(true)
    const tagDanach = lage({
      zeitraum: { von: '2027-01-01', bis: '2027-01-01' },
      nachweise: [nachweis('workPermit'), nachweis('safetyBriefing')],
    })
    expect(pruefeNachweise(tagDanach, 'Q21').ergebnisart).toBe('sperre')
  })
})

describe('5.4.6: fehlende Angaben wirken wie „ja"', () => {
  it('rechnet eine nicht gesetzte Erforderlichkeit der Arbeitserlaubnis wie „ja"', () => {
    const ergebnis = pruefeNachweise(
      lage({ arbeitserlaubnisErforderlich: null, nachweise: [nachweis('safetyBriefing')] }),
      'Q21',
    )
    const arbeitserlaubnis = ergebnis.maengel.find((befund) => befund.art === 'workPermit')
    expect(arbeitserlaubnis?.pflicht).toBe(true)
    expect(ergebnis.ergebnisart).toBe('sperre')
    expect(ergebnis.pflichtangaben['workPermitRequired']).toMatch(/wie „ja" gerechnet/)
  })

  it('rechnet eine nicht gesetzte Unterweisungspflicht wie „ja"', () => {
    const ergebnis = pruefeNachweise(
      lage({ unterweisungVerlangt: null, nachweise: [nachweis('workPermit')] }),
      'Q21',
    )
    expect(ergebnis.ergebnisart).toBe('sperre')
    expect(ergebnis.pflichtangaben['safetyBriefingRequired']).toMatch(/wie „ja" gerechnet/)
  })

  it('verlangt keine Arbeitserlaubnis, wenn der Kandidat sie nicht braucht', () => {
    const ergebnis = pruefeNachweise(
      lage({ arbeitserlaubnisErforderlich: false, nachweise: [nachweis('safetyBriefing')] }),
      'Q21',
    )
    expect(ergebnis.erfuellt).toBe(true)
  })

  it('macht aus einer nie verpflichtenden Art ohne Erwähnung keinen Befund', () => {
    // `qualificationCertificate` ist nach dem Katalog nie Pflicht; ihr
    // Stillschweigen ist kein Mangel, ihr ausdrückliches Fehlen schon.
    const still = pruefeNachweise(
      lage({ nachweise: [nachweis('workPermit'), nachweis('safetyBriefing')] }),
      'Q21',
    )
    expect(still.erfuellt).toBe(true)
  })
})

describe('5.4.5: Grenzfälle', () => {
  it('deckt nicht mit einem Nachweis eines anderen Bezugsobjekts', () => {
    const ergebnis = pruefeNachweise(
      lage({
        bezugsobjekt: 'Elbe Zeitarbeit GmbH',
        nachweise: [
          nachweis('workPermit', { gehoertZu: 'Rheinpersonal GmbH' }),
          nachweis('safetyBriefing'),
        ],
      }),
      'Q21',
    )
    const arbeitserlaubnis = ergebnis.maengel.find((befund) => befund.art === 'workPermit')
    expect(arbeitserlaubnis?.mangel).toBe('fremdesBezugsobjekt')
    expect(ergebnis.ergebnisart).toBe('sperre')
  })

  it('prüft ohne Stichtag nur Vorliegen und Anerkennung', () => {
    const ergebnis = pruefeNachweise(
      lage({
        zeitraum: null,
        nachweise: [
          nachweis('workPermit', { gueltigBis: '2020-12-31' }),
          nachweis('safetyBriefing', { gueltigBis: '2020-12-31' }),
        ],
      }),
      'Q21',
    )
    expect(ergebnis.erfuellt).toBe(true)
    expect(ergebnis.gueltigkeitGeprueft).toBe(false)
  })

  it('führt jede Einzelfeststellung eigens (5.4.4, 5.5.2 Nr. 2)', () => {
    const ergebnis = pruefeNachweise(
      lage({ nachweise: [], ausdruecklichAbwesend: ['qualificationCertificate'] }),
      'Q21',
    )
    expect(ergebnis.maengel.map((befund) => befund.art)).toEqual([
      'workPermit',
      'safetyBriefing',
      'qualificationCertificate',
    ])
    expect(ergebnis.ergebnisart).toBe('sperre')
    expect(ergebnis.adressaten.length).toBeGreaterThan(0)
  })
})

describe('5.4.4 und 5.5.1 N5: gestufter Vorlauf vor dem Ablauf', () => {
  const arbeitserlaubnis = lage({ nachweise: [nachweis('workPermit')] })

  it('informiert ab 60 Tagen Restzeit', () => {
    const ergebnis = pruefeNachweisVorlauf(arbeitserlaubnis, '2026-11-01')
    expect(ergebnis.restzeitTage).toBe(60)
    expect(ergebnis.stufe).toBe('information')
  })

  it('warnt ab 30 Tagen Restzeit', () => {
    expect(pruefeNachweisVorlauf(arbeitserlaubnis, '2026-12-01').stufe).toBe('warnung')
  })

  it('eskaliert ab 7 Tagen Restzeit', () => {
    expect(pruefeNachweisVorlauf(arbeitserlaubnis, '2026-12-24').stufe).toBe('eskalation')
  })

  it('eskaliert nach Ablauf an LA, LD, MD und MA', () => {
    const ergebnis = pruefeNachweisVorlauf(arbeitserlaubnis, '2027-01-01')
    expect(ergebnis.stufe).toBe('abgelaufen')
    expect(ergebnis.adressaten).toEqual(['LA', 'LD', 'MD', 'MA'])
    expect(ergebnis.meldung).toMatch(/laufende Einsatz wird nicht beendet/)
  })

  it('kennt keine Frist bei einem Nachweis ohne Enddatum', () => {
    const unbefristet = lage({ nachweise: [nachweis('workPermit', { gueltigBis: null })] })
    expect(pruefeNachweisVorlauf(unbefristet, '2027-01-01').stufe).toBe('keine')
  })

  it('nimmt den Nachweis, dessen Ende am nächsten liegt', () => {
    const mehrere = lage({
      nachweise: [
        nachweis('workPermit', { gueltigBis: '2027-06-30' }),
        nachweis('safetyBriefing', { gueltigBis: '2026-12-31' }),
      ],
    })
    const ergebnis = pruefeNachweisVorlauf(mehrere, '2026-12-20')
    expect(ergebnis.art).toBe('safetyBriefing')
    expect(ergebnis.endeBis).toBe('2026-12-31')
  })
})

/**
 * `mandatory` und `blocking` sind nach 3.10 **abgeleitete** Felder: sie folgen
 * aus dem Katalog in 5.4.4 und stehen nicht am Dokument. Diese Gruppe hält
 * fest, was die Ableitung ergibt — vor allem die eine Zeile, deren Sperre nicht
 * in der Wirkungstabelle steht.
 */
describe('Abgeleitete Felder `mandatory` und `blocking` (SPEC 3.10, 5.4.4)', () => {
  const ohneAngaben = { arbeitserlaubnisErforderlich: null, unterweisungVerlangt: null }

  it('führt die Erlaubnisurkunde als Pflicht **und** sperrend — über P9 (5.4.4)', () => {
    const wirkung = katalogwirkung('permitCertificate', ohneAngaben)
    expect(wirkung.pflicht).toBe(true)
    expect(wirkung.sperrend).toBe(true)
    expect(wirkung.begruendung).toMatch(/P9/)
  })

  it('macht die Arbeitserlaubnis zur Pflicht, wenn der Kandidat sie braucht (3.6)', () => {
    expect(
      katalogwirkung('workPermit', {
        arbeitserlaubnisErforderlich: true,
        unterweisungVerlangt: null,
      }).pflicht,
    ).toBe(true)
    expect(
      katalogwirkung('workPermit', {
        arbeitserlaubnisErforderlich: false,
        unterweisungVerlangt: null,
      }).pflicht,
    ).toBe(false)
  })

  it('rechnet die fehlende Angabe wie „ja" — die strengere Annahme (5.4.6)', () => {
    expect(katalogwirkung('workPermit', ohneAngaben).pflicht).toBe(true)
    expect(katalogwirkung('safetyBriefing', ohneAngaben).pflicht).toBe(true)
  })

  it('führt den Qualifikationsnachweis als nicht sperrend (5.4.4, „nie Sperre")', () => {
    const wirkung = katalogwirkung('qualificationCertificate', ohneAngaben)
    expect(wirkung.sperrend).toBe(false)
    expect(wirkung.pflicht).toBe(false)
  })

  it('nennt die Prüfzeitpunkte der Art, nicht alle Übergänge (5.4.4)', () => {
    expect(katalogwirkung('safetyBriefing', ohneAngaben).prueft).toContain('Q21')
    expect(katalogwirkung('safetyBriefing', ohneAngaben).prueft).toContain('Q37')
    expect(katalogwirkung('clearanceCertificate', ohneAngaben).prueft).not.toContain('Q21')
  })
})

describe('Nachweisart und Bezugsobjekt passen zusammen (SPEC 5.4.3, 5.4.4)', () => {
  it('verlangt die Erlaubnisurkunde am Lieferanten', () => {
    expect(passtZumBezugsobjekt('permitCertificate', 'supplier')).toBe(true)
    expect(passtZumBezugsobjekt('permitCertificate', 'assignment')).toBe(false)
  })

  it('verlangt die Unterweisung am Einsatz und die Arbeitserlaubnis am Kandidaten', () => {
    expect(passtZumBezugsobjekt('safetyBriefing', 'assignment')).toBe(true)
    expect(passtZumBezugsobjekt('safetyBriefing', 'site')).toBe(false)
    expect(passtZumBezugsobjekt('workPermit', 'candidate')).toBe(true)
  })

  it('lässt `other` an jedem Bezugsobjekt zu (5.4.4, „beliebig")', () => {
    expect(passtZumBezugsobjekt('other', 'site')).toBe(true)
    expect(passtZumBezugsobjekt('other', 'masterAgreement')).toBe(true)
  })
})
