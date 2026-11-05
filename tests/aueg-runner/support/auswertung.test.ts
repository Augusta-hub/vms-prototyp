/**
 * Tests für die **Auswertung** einer Zusicherung gegen die Befunde — den Teil
 * des Runners, der entscheidet, ob eine Zusicherung erfüllt, verletzt oder
 * ausstehend ist.
 *
 * Warum es diese Tests gibt: cucumber **überspringt** die Schritte nach einem
 * ausstehenden Schritt. Eine Zusicherung, die der Runner falsch auswertet,
 * bleibt dadurch unsichtbar, bis ein früherer Schritt grün wird — und wird dann
 * plötzlich rot, an einer Stelle, die niemand angefasst hat. Alle Fälle hier
 * sind so aufgefallen: beim Durchrechnen **aller** Zusicherungen ohne das
 * Überspringen.
 *
 * Die Sätze sind wörtlich aus `tests/aueg/*.feature`.
 */

import { describe, expect, it } from 'vitest'

import { werteAus } from './auswertung'
import { erfasseErwartung } from './erwartung'
import type { Befund } from './pruefwerk'

function befund(teile: Partial<Befund> = {}): Befund {
  return {
    pruefung: 'P3',
    ergebnisart: 'information',
    uebergangVollzogen: true,
    werte: {},
    adressaten: [],
    meldung: 'Befund für den Test.',
    ...teile,
  }
}

const werte = (eintraege: Record<string, string | number | null>, teile: Partial<Befund> = {}) =>
  [befund({ werte: eintraege, ...teile })]

function auswerten(satz: string, befunde: readonly Befund[]) {
  return werteAus(erfasseErwartung(satz), befunde)
}

describe('Fristen in Monaten (SPEC 5.1.2, 5.2.2)', () => {
  // Der Lauf verglich lange nur Tageszahlen und Datumsangaben. "gilt die
  // gesetzliche Regelfrist von 9 Monaten" blieb deshalb ausstehend, obwohl die
  // Fachlogik 9 rechnete — eine ungeprüfte Zusicherung.
  it('vergleicht eine genannte Monatsfrist mit dem Befund', () => {
    expect(
      auswerten('gilt die gesetzliche Regelfrist von 9 Monaten', werte({ fristMonate: 9 }))
        .ergebnis,
    ).toBe('erfuellt')
  })

  it('schlägt an, wenn der Befund eine andere Frist führt', () => {
    expect(
      auswerten('gilt die Frist von 6 Monaten', werte({ fristMonate: 9 })).ergebnis,
    ).toBe('verletzt')
  })

  it('bleibt ausstehend, wenn kein Befund eine Frist in Monaten führt', () => {
    expect(
      auswerten('gilt die Frist von 6 Monaten', werte({ tagebudget: 181 })).ergebnis,
    ).toBe('ausstehend')
  })

  it('vergleicht nur die Fristschlüssel, nicht jeden Wert des Befundes', () => {
    // Eine 9 irgendwo im Befund ist keine Frist von 9 Monaten.
    expect(
      auswerten('gilt die Frist von 9 Monaten', werte({ fristMonate: 6, lueckentage: 9 }))
        .ergebnis,
    ).toBe('verletzt')
  })

  it('liest die Verneinung: „es wird nicht mit 9 Monaten gerechnet"', () => {
    // SPEC 5.2.2 Fall 1: ohne Verleihertarif gilt Equal Pay ab dem ersten Tag —
    // **nicht** die Regelfrist. Der Befund führt 0.
    const satz =
      'es wird nicht mit 9 Monaten gerechnet, weil die Abweichung den Tarifvertrag voraussetzt'
    expect(auswerten(satz, werte({ fristMonate: 0 })).ergebnis).toBe('erfuellt')
    expect(auswerten(satz, werte({ fristMonate: 9 })).ergebnis).toBe('verletzt')
  })

  it('fängt „wird mit höchstens 15 Monaten gerechnet" (Fall 6)', () => {
    expect(
      auswerten('wird mit höchstens 15 Monaten gerechnet', werte({ fristMonate: 15 })).ergebnis,
    ).toBe('erfuellt')
  })

  it('fängt „beträgt die Frist 0 Monate" (Fall 1)', () => {
    expect(
      auswerten('beträgt die Frist 0 Monate', werte({ fristMonate: 0 })).ergebnis,
    ).toBe('erfuellt')
  })
})

describe('Die Überlassungskette ist kein Vorgang', () => {
  // „es entsteht keine Überlassungskette bei diesem Kunden" sagt nichts über den
  // Statusübergang: der Übergang nach `terminatedEarly` findet statt, nur
  // entsteht kein Überlassungstag (SPEC 5.1.5). Die Signatur `entsteht kein`
  // der Art `vorgangsstatus` meint eine Einladung oder einen Einsatz, der nicht
  // entsteht — eine Kette ist keiner von beiden.
  const satz = 'es entsteht keine Überlassungskette bei diesem Kunden'

  it('ist erfüllt, wenn der Befund keinen Kettenbeginn führt', () => {
    expect(
      auswerten(satz, werte({ kettenbeginn: null, angerechneteDauer: 0 })).ergebnis,
    ).toBe('erfuellt')
  })

  it('ist verletzt, wenn der Befund einen Kettenbeginn nennt', () => {
    expect(auswerten(satz, werte({ kettenbeginn: '2026-03-01' })).ergebnis).toBe('verletzt')
  })

  it('verlangt nicht, dass der Übergang unterbleibt', () => {
    // Der vollzogene Übergang darf die Zusicherung nicht verletzen.
    expect(
      auswerten(satz, werte({ kettenbeginn: null }, { uebergangVollzogen: true })).ergebnis,
    ).toBe('erfuellt')
  })

  it('bleibt ausstehend, wenn kein Befund den Kettenbeginn führt', () => {
    expect(auswerten(satz, werte({ tagebudget: 546 })).ergebnis).toBe('ausstehend')
  })
})

describe('Ergebnisart mit Verneinung', () => {
  it('liest „eine Warnung statt einer Sperre" als Warnung (SPEC 5.2.4, Q36)', () => {
    // Eine Schätzung lässt den Übergang zu. Ohne die Ausnahme verlangte der Lauf
    // hier eine Sperre.
    expect(
      auswerten(
        'das Ergebnis der Prüfung P4 ist eine Warnung statt einer Sperre',
        [befund({ pruefung: 'P4', ergebnisart: 'warnung' })],
      ).ergebnis,
    ).toBe('erfuellt')
  })

  it('verlangt die Sperre weiter, wo der Satz sie ohne Einschränkung nennt', () => {
    expect(
      auswerten('ist das Ergebnis der Prüfung P4 eine Sperre', [
        befund({ pruefung: 'P4', ergebnisart: 'warnung' }),
      ]).ergebnis,
    ).toBe('verletzt')
  })
})

describe('Kriterien K1 bis K5 (SPEC 5.3.3)', () => {
  // Die Art `kriterium` war in `erwartung.ts` als auswertbar geführt, hatte in
  // `auswertung.ts` aber keinen Zweig: jede Zusicherung über ein Kriterium
  // blieb ungeprüft ausstehend. Bei P8 sind K1 bis K5 die ganze Prüfung.
  const konkretisierung = (teile: Record<string, string>) =>
    werte(
      {
        kriterienGeprueft: 'K1,K2,K3,K4',
        kriterienErfuellt: 'K1,K2,K3,K4',
        kriterienOffen: '',
        kriterienNichtPruefbar: '',
        ...teile,
      },
      { pruefung: 'P8' },
    )

  it('löst die Spanne „K1 bis K4" auf — vier Kriterien, nicht zwei', () => {
    // `leseWerte` findet nur die Ränder. Ohne die Auflösung bliebe K2 und K3
    // ungeprüft, und ein Befund, der nur K1 und K4 trägt, käme durch.
    expect(
      auswerten('sind die Kriterien K1 bis K4 erfüllt', konkretisierung({})).ergebnis,
    ).toBe('erfuellt')
    expect(
      auswerten(
        'sind die Kriterien K1 bis K4 erfüllt',
        konkretisierung({ kriterienErfuellt: 'K1,K4', kriterienOffen: 'K2,K3' }),
      ).ergebnis,
    ).toBe('verletzt')
  })

  it('liest „nicht erfüllt" vor „erfüllt"', () => {
    // "nicht erfüllt" enthält "erfüllt"; die Reihenfolge der Prüfung entscheidet.
    const offen = konkretisierung({
      kriterienGeprueft: 'K1,K2,K3,K4,K5',
      kriterienErfuellt: 'K1,K2,K3,K4',
      kriterienOffen: 'K5',
    })
    expect(auswerten('ist das Kriterium K5 nicht erfüllt', offen).ergebnis).toBe('erfuellt')
    expect(auswerten('ist das Kriterium K5 erfüllt', offen).ergebnis).toBe('verletzt')
  })

  it('unterscheidet „nicht prüfbar" von „nicht erfüllt"', () => {
    // SPEC 5.3.3, Grenzfall „Fehlende Preisposition": K1 ist nicht prüfbar und
    // wirkt wie ein Treffer. Beides steht im Befund, und es ist nicht dasselbe.
    const unpruefbar = konkretisierung({
      kriterienErfuellt: 'K2,K3,K4',
      kriterienOffen: 'K1',
      kriterienNichtPruefbar: 'K1',
    })
    expect(auswerten('ist das Kriterium K1 nicht prüfbar', unpruefbar).ergebnis).toBe('erfuellt')
    expect(
      auswerten(
        'ist das Kriterium K2 nicht prüfbar',
        konkretisierung({ kriterienNichtPruefbar: 'K1' }),
      ).ergebnis,
    ).toBe('verletzt')
  })

  it('liest „die Sperre nennt das Kriterium" als offenes Kriterium', () => {
    expect(
      auswerten(
        'die Sperre nennt das Kriterium "K2 Person" und den offenen Weg, die Angabe nachzutragen',
        konkretisierung({ kriterienErfuellt: 'K1,K3,K4', kriterienOffen: 'K2' }),
      ).ergebnis,
    ).toBe('erfuellt')
  })

  it('liest „erneut geprüft" als Zusicherung über den Umfang, nicht über das Ergebnis', () => {
    // „werden die Kriterien K1 bis K4 erneut geprüft" sagt nichts darüber, ob
    // sie erfüllt sind — im Szenario sind sie es gerade nicht.
    expect(
      auswerten(
        'werden die Kriterien K1 bis K4 erneut geprüft',
        konkretisierung({ kriterienErfuellt: 'K2,K3,K4', kriterienOffen: 'K1' }),
      ).ergebnis,
    ).toBe('erfuellt')
  })

  it('bleibt ausstehend, wenn kein Befund Kriterien führt', () => {
    expect(
      auswerten('sind die Kriterien K1 bis K4 erfüllt', werte({ tagebudget: 546 })).ergebnis,
    ).toBe('ausstehend')
  })
})

describe('Betroffenheit durch eine Arbeitskampfanzeige (SPEC 5.3.2)', () => {
  const arbeitskampf = (teile: Record<string, string>) =>
    werte(
      { betroffeneTage: '2026-09-15', anzeigeOffen: 'nein', ...teile },
      { pruefung: 'P7' },
    )

  it('prüft den genannten Tag, nicht nur die Zahl der Tage', () => {
    // „ist der 20.09.2026 ein betroffener Tag" ist eine Aussage über **diesen**
    // Tag. SPEC 5.3.2 prüft tagesgenau: der erste und der letzte Tag der
    // Anzeige sind betroffen, der Tag danach nicht mehr.
    expect(
      auswerten(
        'ist der 20.09.2026 ein betroffener Tag',
        arbeitskampf({ betroffeneTage: '2026-09-20' }),
      ).ergebnis,
    ).toBe('erfuellt')
    expect(
      auswerten(
        'ist der 20.09.2026 ein betroffener Tag',
        arbeitskampf({ betroffeneTage: '2026-09-15' }),
      ).ergebnis,
    ).toBe('verletzt')
  })

  it('liest „bis auf Weiteres betroffen" als offene Anzeige', () => {
    expect(
      auswerten(
        'ist der Prüfzeitraum bis auf Weiteres betroffen',
        arbeitskampf({ betroffeneTage: '2026-09-25', anzeigeOffen: 'ja' }),
      ).ergebnis,
    ).toBe('erfuellt')
    // Eine Anzeige mit Enddatum ist nicht „bis auf Weiteres".
    expect(
      auswerten('ist der Prüfzeitraum bis auf Weiteres betroffen', arbeitskampf({})).ergebnis,
    ).toBe('verletzt')
  })

  it('bleibt ausstehend, wenn kein Befund betroffene Tage führt', () => {
    expect(
      auswerten('ist der 20.09.2026 ein betroffener Tag', werte({ tagebudget: 546 })).ergebnis,
    ).toBe('ausstehend')
  })
})

describe('Protokolleintrag: Prüfung und Ergebnis (SPEC 3.12)', () => {
  // Der Satz nennt zwei Felder des Audit-Eintrags, `ruleRef` und `result`.
  // Verglichen wurden sie nicht: der Satz galt als erfüllt, sobald irgendein
  // Befund irgendeine Begründung trug.
  const satz =
    'ein Protokolleintrag mit der Prüfung "industrialActionCheck" und dem Ergebnis "blocked" liegt vor'

  it('vergleicht ruleRef und result mit dem Befund', () => {
    expect(
      auswerten(
        satz,
        werte({ ruleRef: 'industrialActionCheck', result: 'blocked' }, { pruefung: 'P7' }),
      ).ergebnis,
    ).toBe('erfuellt')
  })

  it('schlägt an, wenn der Befund eine andere Prüfung protokolliert', () => {
    expect(
      auswerten(
        satz,
        werte({ ruleRef: 'concretizationCheck', result: 'blocked' }, { pruefung: 'P8' }),
      ).ergebnis,
    ).toBe('verletzt')
  })

  it('schlägt an, wenn das Ergebnis nicht "blocked" ist', () => {
    expect(
      auswerten(
        satz,
        werte({ ruleRef: 'industrialActionCheck', result: 'success' }, { pruefung: 'P7' }),
      ).ergebnis,
    ).toBe('verletzt')
  })

  it('prüft weiter nur die Begründung, wo der Satz keine Werte nennt', () => {
    expect(auswerten('das Ergebnis wird protokolliert', werte({})).ergebnis).toBe('erfuellt')
  })
})
