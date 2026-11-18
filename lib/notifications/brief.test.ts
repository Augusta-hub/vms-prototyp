/**
 * Der Brief zu einer Benachrichtigung — SPEC **3.14**, „Was in der E-Mail
 * steht".
 *
 * Was hier geprüft wird und **nirgends sonst**:
 *
 *  - dass die **Art** im Betreff vorn steht: in einer Postfachliste muss eine
 *    Warnung mit Eskalation ohne Öffnen von einer Information zu unterscheiden
 *    sein (2.4),
 *  - dass der Brief **nichts hinzufügt**, was die Anzeige nicht auch zeigt —
 *    die Meldung ist nach 2.4 Regel 3 bereits beschränkt, und die E-Mail
 *    erweitert sie nicht,
 *  - dass leere Felder **fehlen** statt als „—" zu erscheinen: ein Lauftag an
 *    einer Nachricht aus einem Übergang wäre eine falsche Angabe,
 *  - dass der Hinweis ins System nur mit **bekannter** Adresse entsteht.
 *
 * Alle Daten sind synthetisch (CLAUDE.md, Regel 3).
 */
import { describe, expect, it } from 'vitest'
import { betreff, brief, brieftext, type Briefdaten } from './brief'

const UEBERGANG: Briefdaten = {
  art: 'Information',
  anlass: 'Statuswechsel (Kapitel 4)',
  meldung: 'Einsatz EI-2026-0001 ist aktiv.',
  objectType: 'assignment',
  objectRef: 'EI-2026-0001',
  rolle: 'operatorCoordinator',
  stufe: 1,
  pruefung: null,
  statusFrom: 'planned',
  statusTo: 'active',
  raisedAt: new Date('2026-11-18T07:30:00.000Z'),
  runDate: null,
}

const LAUF: Briefdaten = {
  art: 'Warnung mit Eskalation',
  anlass: 'N2 — Höchstüberlassungsdauer (5.1)',
  meldung: 'Höchstüberlassungsdauer in 21 Tagen erreicht.',
  objectType: 'assignment',
  objectRef: 'EI-2026-0002',
  rolle: 'operatorAdmin',
  stufe: 2,
  pruefung: 'P1',
  statusFrom: null,
  statusTo: null,
  raisedAt: new Date('2026-11-18T02:00:00.000Z'),
  runDate: new Date('2026-11-18T00:00:00.000Z'),
}

describe('Betreff (3.14)', () => {
  it('nennt Art, Anlass und Vorgang — die Art zuerst', () => {
    expect(betreff(LAUF)).toBe(
      '[VMS] Warnung mit Eskalation: N2 — Höchstüberlassungsdauer (5.1) — EI-2026-0002',
    )
  })

  it('unterscheidet Information von Warnung schon im Betreff', () => {
    expect(betreff(UEBERGANG).startsWith('[VMS] Information:')).toBe(true)
    expect(betreff(LAUF).startsWith('[VMS] Warnung mit Eskalation:')).toBe(true)
  })
})

describe('Text (3.14)', () => {
  it('beginnt mit der Meldung — sie ist der Inhalt, alles Weitere ihre Einordnung', () => {
    expect(brieftext(UEBERGANG).startsWith('Einsatz EI-2026-0001 ist aktiv.')).toBe(true)
  })

  it('führt Prüfung und Lauftag, wo sie gesetzt sind', () => {
    const text = brieftext(LAUF)
    expect(text).toContain('Prüfung:    P1')
    expect(text).toContain('Lauf:       2026-11-18')
  })

  it('lässt Prüfung und Lauftag weg, wo sie fehlen — statt „—" zu schreiben', () => {
    const text = brieftext(UEBERGANG)
    expect(text).not.toContain('Prüfung:')
    expect(text).not.toContain('Lauf:')
  })

  it('führt den Statuswechsel nur bei einer Nachricht aus einem Übergang', () => {
    expect(brieftext(UEBERGANG)).toContain('Status:     planned → active')
    expect(brieftext(LAUF)).not.toContain('Status:')
  })

  it('nennt die adressierte Rolle mit Stufe (2.4)', () => {
    expect(brieftext(LAUF)).toContain('Adressiert: operatorAdmin, Stufe 2')
  })

  it('sagt, dass die Nachricht nichts ändert (2.4, Regel 1)', () => {
    expect(brieftext(UEBERGANG)).toContain('ändert nichts')
  })

  it('verweist auf das Postfach nur mit bekannter Basisadresse', () => {
    expect(brieftext(UEBERGANG, 'https://vms.test.invalid')).toContain(
      'Im System: https://vms.test.invalid/benachrichtigungen',
    )
    expect(brieftext(UEBERGANG, 'https://vms.test.invalid/')).toContain(
      'https://vms.test.invalid/benachrichtigungen',
    )
    expect(brieftext(UEBERGANG, null)).not.toContain('Im System:')
    expect(brieftext(UEBERGANG, '')).not.toContain('Im System:')
  })
})

describe('Brief (3.14)', () => {
  it('setzt die Adresse unverändert als Empfänger', () => {
    const ergebnis = brief(UEBERGANG, 'md@test.invalid')
    expect(ergebnis.empfaenger).toBe('md@test.invalid')
    expect(ergebnis.betreff).toBe(betreff(UEBERGANG))
    expect(ergebnis.text).toBe(brieftext(UEBERGANG, null))
  })
})
