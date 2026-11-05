/**
 * Das Prüfwerk als Eingangsstelle: welche Prüfung läuft, welche Ergebnisart
 * entsteht, welche Befunde protokolliert werden.
 *
 * Der Kern dieser Tests ist die Trennung aus SPEC 5.5.1 a): der Rechenweg sagt,
 * **ob** ein Treffer vorliegt, die Querschnittstabelle 4.7 sagt, **was er
 * bewirkt**. Dieselbe nicht gedeckte Erlaubnis sperrt am Einsatzstart (Q20) und
 * warnt nur am Einkaufsbeleg (Q38) — das muss prüfbar sein.
 */
import { describe, expect, it } from 'vitest'
import { pruefe, umgesetztePruefungen } from './pruefwerk'
import type { Ausloeser, Pruefauftrag, Pruefung, Sachverhalt } from './typen'

const LEERE_WERTE = {
  datumsangaben: [],
  zitate: [],
  statuswerte: [],
  mengen: [],
  pruefungen: [],
  kriterien: [],
}

/** Die Grundlage der Feature-Datei, gekürzt auf das, was P9 und P10 lesen. */
const GRUNDLAGE: readonly string[] = [
  'der Entleiher "Nordwerk Metall GmbH" führt den Standort "Werk Süd", an dem eine Unterweisung verlangt wird',
  'der Lieferant "Rheinpersonal GmbH" steht im Status "active" und hat den Erlaubnissatz "EP-1" als befristete Erlaubnis vom 01.01.2026 bis 31.12.2026, anerkannt, mit hinterlegter Urkunde',
  'der Lieferant "Saale Personal GmbH" steht im Status "onboarding" und hat den Erlaubnissatz "EP-5" mit dem Anerkennungsstatus "submitted"',
  'der Kandidat "Miriam Falk" bei "Rheinpersonal GmbH" benötigt eine Arbeitserlaubnis, die als Nachweis anerkannt und bis zum 31.12.2026 gültig ist',
]

function auftrag(
  eigene: readonly string[],
  anlass: Partial<Ausloeser> & { satz: string },
  erwartetePruefungen: readonly Pruefung[] = ['P9'],
): Pruefauftrag {
  const sachverhalte: Sachverhalt[] = [
    ...GRUNDLAGE.map((satz) => ({ art: 'erlaubnissatz', satz, werte: LEERE_WERTE })),
    { art: 'rahmenaussage', satz: 'die Angaben dieser Grundlage gelten', werte: LEERE_WERTE },
    ...eigene.map((satz) => ({ art: 'sonstiges', satz, werte: LEERE_WERTE })),
  ]
  return {
    ausloeser: {
      art: 'statusuebergang',
      rolle: 'MSP-Disponent',
      objektart: 'unbekannt',
      zielstatus: null,
      stichtag: null,
      werte: LEERE_WERTE,
      ...anlass,
    },
    sachverhalte,
    erwartetePruefungen,
    szenario: { name: 'Einheitentest', tags: ['@p9'] },
  }
}

describe('Registry der elf Prüfungen (SPEC 4.7)', () => {
  it('hat bisher sechs Rechenwege: P1, P2, P6, P9, P10 und P11', () => {
    expect(umgesetztePruefungen()).toEqual(['P1', 'P2', 'P6', 'P9', 'P10', 'P11'])
  })

  it('liefert keinen Befund, solange eine erwartete Prüfung keinen Rechenweg hat', () => {
    const befunde = pruefe(
      auftrag(
        ['ein Einsatz von "Miriam Falk" steht im Status "planned" mit tatsächlichem Beginn 01.03.2026'],
        { satz: 'der MSP-Disponent den Einsatz in den Status "active" überführt', objektart: 'einsatz', zielstatus: 'active' },
        ['P9', 'P4'],
      ),
    )
    // Eine nicht umgesetzte Prüfung darf nicht wie eine erfüllte aussehen.
    expect(befunde).toEqual([])
  })

  it('rechnet P9 nur, wenn der Vorgang sie erwartet', () => {
    const ohneP9 = pruefe(
      auftrag([], { satz: 'der Betreiber die Erlaubnis prüft', art: 'berechnung' }, ['P4']),
    )
    expect(ohneP9).toEqual([])
  })
})

describe('Ergebnisart aus 4.7, Treffer aus dem Rechenweg (SPEC 5.5.1 a)', () => {
  const nichtGedeckt = [
    'ein Einsatz von "Miriam Falk" über "Rheinpersonal GmbH" steht im Status "planned" mit tatsächlichem Beginn 15.01.2027',
  ]

  it('sperrt den Einsatzstart (Q20)', () => {
    const [befund] = pruefe(
      auftrag(nichtGedeckt, {
        satz: 'der MSP-Disponent den Einsatz in den Status "active" überführen will',
        art: 'statusuebergangsversuch',
        objektart: 'einsatz',
        zielstatus: 'active',
      }),
    )
    expect(befund?.ergebnisart).toBe('sperre')
    expect(befund?.uebergangVollzogen).toBe(false)
    expect(befund?.werte).toMatchObject({
      qZeile: 'Q20',
      ruleRef: 'permitValidityCheck',
      result: 'blocked',
      statusNachher: 'planned',
      ersterUngedeckterTag: '2027-01-15',
    })
  })

  it('warnt am Einkaufsbeleg und lässt den Übergang stattfinden (Q38)', () => {
    const [befund] = pruefe(
      auftrag(
        [
          'der Einkaufsbeleg beruht auf genehmigten Stundenzetteln zu Einsätzen über "Rheinpersonal GmbH"',
          'der Leistungszeitraum ist der 01.01.2027 bis 31.01.2027',
        ],
        {
          satz: 'der MSP-Disponent den Beleg in den Status "created" überführt',
          objektart: 'beleg',
          zielstatus: 'created',
        },
      ),
    )
    expect(befund?.ergebnisart).toBe('warnung')
    expect(befund?.uebergangVollzogen).toBe(true)
    expect(befund?.werte).toMatchObject({ qZeile: 'Q38', statusNachher: 'created' })
  })

  it('stellt ohne Übergang nur fest, statt zu sperren (5.5.2 Nr. 4 und 5)', () => {
    const [befund] = pruefe(
      auftrag(
        ['für "Rheinpersonal GmbH" soll der Zeitraum vom 01.01.2027 bis 31.01.2027 geprüft werden'],
        { satz: 'der Betreiber die Erlaubnis prüft', art: 'berechnung' },
      ),
    )
    expect(befund?.ergebnisart).toBe('warnung')
    expect(befund?.werte.qZeile).toBeNull()
  })

  it('meldet eine gedeckte Erlaubnis als Information und vollzieht den Übergang', () => {
    const [befund] = pruefe(
      auftrag(
        ['ein Einsatz von "Miriam Falk" über "Rheinpersonal GmbH" steht im Status "planned" mit tatsächlichem Beginn 01.03.2026'],
        {
          satz: 'der MSP-Disponent den Einsatz in den Status "active" überführt',
          objektart: 'einsatz',
          zielstatus: 'active',
        },
      ),
    )
    expect(befund?.ergebnisart).toBe('information')
    expect(befund?.uebergangVollzogen).toBe(true)
    expect(befund?.werte.statusNachher).toBe('active')
    expect(befund?.adressaten).toEqual([])
  })
})

describe('Q04: Sperre je Einladung, nicht je Ausschreibung (SPEC 5.4.1)', () => {
  const ausschreibung = (lieferanten: string) => [
    'die Bedarfsanfrage "BA-2026-031" steht im Status "approved"',
    `die Ausschreibung lädt ${lieferanten} ein und die Angebotsfrist endet am 31.03.2026`,
  ]

  it('lässt den Übergang zu, solange eine zulässige Einladung bleibt', () => {
    const befunde = pruefe(
      auftrag(ausschreibung('"Rheinpersonal GmbH" und "Saale Personal GmbH"'), {
        satz: 'der MSP-Disponent die Bedarfsanfrage in den Status "tendered" überführt',
        objektart: 'bedarfsanfrage',
        zielstatus: 'tendered',
      }),
    )
    const einladungen = befunde.filter((befund) => befund.werte.gegenstand === 'Einladung')
    const ausschreibungsbefund = befunde.find((b) => b.werte.gegenstand === 'Ausschreibung')

    expect(einladungen).toHaveLength(2)
    expect(einladungen[0]?.ergebnisart).toBe('information')
    expect(einladungen[0]?.werte.statusNachher).toBe('invited')
    // Der gesperrte Lieferant wird nicht eingeladen.
    expect(einladungen[1]?.ergebnisart).toBe('sperre')
    expect(einladungen[1]?.werte.statusNachher).toBeNull()
    // Die Ausschreibung geht trotzdem heraus.
    expect(ausschreibungsbefund?.ergebnisart).toBe('information')
    expect(ausschreibungsbefund?.werte.statusNachher).toBe('tendered')
  })

  it('sperrt den Übergang, wenn kein eingeladener Lieferant zulässig ist', () => {
    const befunde = pruefe(
      auftrag(ausschreibung('ausschließlich "Saale Personal GmbH"'), {
        satz: 'der MSP-Disponent die Bedarfsanfrage in den Status "tendered" überführen will',
        art: 'statusuebergangsversuch',
        objektart: 'bedarfsanfrage',
        zielstatus: 'tendered',
      }),
    )
    expect(befunde.every((befund) => !befund.uebergangVollzogen)).toBe(true)
    const ausschreibungsbefund = befunde.find((b) => b.werte.gegenstand === 'Ausschreibung')
    expect(ausschreibungsbefund?.ergebnisart).toBe('sperre')
    expect(ausschreibungsbefund?.werte.statusNachher).toBe('approved')
  })
})

describe('Übersteuerung (SPEC 5.5.4)', () => {
  it('weist sie zurück, wenn die Überlassung auch nach richtiger Datenlage unzulässig wäre', () => {
    const befunde = pruefe(
      auftrag(
        [
          'das Anlegen des Einsatzes ist durch die Prüfung P9 gesperrt',
          'für den Zeitraum ab dem 01.01.2027 besteht tatsächlich keine Erlaubnis',
        ],
        {
          satz: 'der MSP-Administrator die Sperre zu übersteuern versucht',
          art: 'uebersteuerungsversuch',
        },
      ),
    )
    expect(befunde).toHaveLength(1)
    expect(befunde[0]?.ergebnisart).toBe('sperre')
    expect(befunde[0]?.uebergangVollzogen).toBe(false)
    expect(befunde[0]?.werte).toMatchObject({ uebersteuerung: 'zurückgewiesen', bedingungC: 'nein' })
  })

  it('erzeugt bei Wirksamkeit zwei Protokolleinträge (Invariante 5)', () => {
    const befunde = pruefe(
      auftrag(
        [
          'der Einsatzstart ist durch die Prüfung P9 gesperrt',
          'die Erlaubnis für den Starttag besteht nachweislich und ist im System nicht eingestellt',
          'das Einstellen und Anerkennen ist vor dem Einsatzstart nicht möglich',
          'nach richtiger Datenlage wäre die Überlassung zulässig',
        ],
        {
          satz: 'der MSP-Administrator den Übergang mit Pflichtbegründung übersteuert',
          art: 'uebersteuerung',
        },
      ),
    )
    expect(befunde).toHaveLength(2)
    expect(befunde.map((befund) => befund.werte.result)).toEqual(['blocked', 'success'])
    expect(befunde[0]?.uebergangVollzogen).toBe(false)
    expect(befunde[1]?.uebergangVollzogen).toBe(true)
    expect(befunde[1]?.werte.statusNachher).toBe('active')
    // Invariante 4: jede Übersteuerung wird MA angezeigt.
    expect(befunde[1]?.adressaten).toEqual(['MA'])
    // Invariante 6: sie heilt die Rechtslage nicht.
    expect(befunde[1]?.meldung).toMatch(/heilt die Rechtslage nicht/)
  })
})

describe('Nächtlicher Lauf N1 (SPEC 5.5.1, 5.4.4)', () => {
  const lieferant = [
    '"Rheinpersonal GmbH" steht im Status "active" und der Erlaubnissatz "EP-1" ist bis zum 31.12.2026 gültig',
  ]

  it('informiert im Vorlauf und lässt den Lieferantenstatus unberührt', () => {
    const [befund] = pruefe(
      auftrag(lieferant, {
        satz: 'der nächtliche Lauf am 02.10.2026 läuft',
        art: 'nachtlauf',
        stichtag: '2026-10-02',
      }),
    )
    expect(befund?.ergebnisart).toBe('information')
    expect(befund?.adressaten).toEqual(['LA'])
    expect(befund?.werte).toMatchObject({ statusNachher: 'active', restzeitTage: 90 })
  })

  it('warnt mit Eskalation nach Ablauf und sperrt den Lieferanten nicht (5.4.2 a)', () => {
    const [befund] = pruefe(
      auftrag(lieferant, {
        satz: 'der nächtliche Lauf am 01.01.2027 läuft',
        art: 'nachtlauf',
        stichtag: '2027-01-01',
      }),
    )
    expect(befund?.ergebnisart).toBe('warnung')
    expect(befund?.uebergangVollzogen).toBe(false)
    expect(befund?.adressaten).toEqual(['LA', 'LD', 'MD', 'MA'])
    expect(befund?.werte).toMatchObject({ statusNachher: 'active', vorlaufstufe: 'abgelaufen' })
  })
})

describe('P10 — Pflichtnachweise (SPEC 5.4.4)', () => {
  const einsatzstart = [
    'ein Einsatz von "Miriam Falk" über "Rheinpersonal GmbH" am Standort "Werk Süd" steht im Status "planned" mit tatsächlichem Beginn 01.03.2026',
  ]

  it('führt je Feststellung einen Befund und einen für die Summe (5.4.4)', () => {
    const befunde = pruefe(
      auftrag(
        [...einsatzstart, 'am Standort wird eine Unterweisung verlangt und für den Einsatz ist kein Unterweisungsnachweis erfasst'],
        {
          satz: 'der MSP-Disponent den Einsatz in den Status "active" überführen will',
          art: 'statusuebergangsversuch',
          objektart: 'einsatz',
          zielstatus: 'active',
        },
        ['P10'],
      ),
    )
    const sammel = befunde.find((befund) => befund.werte.gegenstand === 'Sammelergebnis')
    const einzeln = befunde.filter((befund) => befund.werte.gegenstand !== 'Sammelergebnis')
    expect(einzeln.map((befund) => befund.werte.nachweisart)).toEqual(['safetyBriefing'])
    expect(einzeln[0]?.ergebnisart).toBe('sperre')
    expect(sammel?.ergebnisart).toBe('sperre')
    expect(sammel?.werte).toMatchObject({ qZeile: 'Q21', ruleRef: 'mandatoryDocumentCheck' })
    expect(sammel?.werte.statusNachher).toBe('planned')
  })

  it('läuft an einem Übergang, den 4.7 ihr nicht zuordnet, überhaupt nicht', () => {
    const befunde = pruefe(
      auftrag(
        ['die Bedarfsanfrage "BA-2026-030" steht im Status "approved"'],
        {
          satz: 'der MSP-Disponent die Bedarfsanfrage in den Status "tendered" überführt',
          objektart: 'bedarfsanfrage',
          zielstatus: 'tendered',
        },
        ['P10'],
      ),
    )
    // 4.7 nennt zu Q04 nur P9. P10 schweigt hier — und schweigt sichtbar.
    expect(befunde).toEqual([])
  })

  it('warnt bei einer Stammdatenänderung, statt zu sperren (5.5.1 b)', () => {
    const befunde = pruefe(
      auftrag(
        [
          'am Standort "Werk Nord" war keine Unterweisung verlangt',
          'ein Einsatz von "Miriam Falk" an diesem Standort steht im Status "active"',
        ],
        {
          satz: 'der Entleiher am 01.03.2026 einstellt, dass eine Unterweisung verlangt wird',
          art: 'erfassung',
          objektart: 'unbekannt',
          zielstatus: null,
          stichtag: '2026-03-01',
        },
        ['P10'],
      ),
    )
    const sammel = befunde.find((befund) => befund.werte.gegenstand === 'Sammelergebnis')
    expect(sammel?.ergebnisart).toBe('warnung')
    expect(sammel?.uebergangVollzogen).toBe(false)
    expect(sammel?.werte.qZeile).toBeNull()
    // Die Unterweisung wird zum Pflichtnachweis; der laufende Einsatz läuft
    // weiter (5.4.5). Adressaten sind Bedarfsträger und Lieferantendisponent.
    expect(sammel?.adressaten).toEqual(['KB', 'LD'])
  })

  it('weist eine Übersteuerung bei tatsächlich fehlendem Nachweis zurück', () => {
    const befunde = pruefe(
      auftrag(
        [
          'der Einsatzstart ist durch die Prüfung P10 gesperrt',
          'die Unterweisung am Standort hat tatsächlich nicht stattgefunden',
        ],
        {
          satz: 'der MSP-Administrator die Sperre zu übersteuern versucht',
          art: 'uebersteuerungsversuch',
          objektart: 'unbekannt',
          zielstatus: null,
        },
        ['P10'],
      ),
    )
    expect(befunde).toHaveLength(1)
    expect(befunde[0]?.ergebnisart).toBe('sperre')
    expect(befunde[0]?.werte).toMatchObject({ uebersteuerung: 'zurückgewiesen', bedingungC: 'nein' })
  })

  it('rechnet P9 und P10 am selben Einsatzstart getrennt (Q20 und Q21)', () => {
    const befunde = pruefe(
      auftrag(
        [
          ...einsatzstart,
          'die Arbeitserlaubnis ist anerkannt und bis zum 31.12.2026 gültig',
          'die Unterweisung am Standort ist anerkannt und bis zum 31.08.2027 gültig',
        ],
        {
          satz: 'der MSP-Disponent den Einsatz in den Status "active" überführt',
          objektart: 'einsatz',
          zielstatus: 'active',
        },
        ['P9', 'P10'],
      ),
    )
    const p9 = befunde.filter((befund) => befund.pruefung === 'P9')
    const p10 = befunde.filter((befund) => befund.pruefung === 'P10')
    expect(p9.map((befund) => befund.werte.qZeile)).toEqual(['Q20'])
    expect(p10.some((befund) => befund.werte.qZeile === 'Q21')).toBe(true)
    expect(befunde.every((befund) => befund.ergebnisart === 'information')).toBe(true)
  })
})

describe('Rückwirkende Änderung (SPEC 5.5.3, R3)', () => {
  it('stellt einen Verstoß in der Vergangenheit fest, statt zu sperren', () => {
    const [befund] = pruefe(
      auftrag(
        [
          'für "Rheinpersonal GmbH" wird das Enddatum des Erlaubnissatzes "EP-1" am 15.11.2026 von 31.12.2026 auf 30.09.2026 berichtigt',
          'für den Zeitraum vom 01.10.2026 bis 31.10.2026 sind Belege freigegeben',
        ],
        {
          satz: 'der MSP-Administrator die Berichtigung speichert',
          art: 'berichtigung',
        },
      ),
    )
    expect(befund?.ergebnisart).toBe('warnung')
    expect(befund?.adressaten).toEqual(['MA'])
    expect(befund?.meldung).toMatch(/nicht gesperrt/)
    expect(befund?.werte.tageUngedeckt).toBe(31)
  })
})
