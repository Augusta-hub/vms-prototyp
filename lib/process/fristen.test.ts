/**
 * Prozessfristen und Stufenabstand — SPEC **4.0** und **2.4** Regeln 5 und 6.
 *
 * Was hier geprüft wird und **nirgends sonst**:
 *
 *  - dass der Wert des **Kunden** vorgeht und die Vorbelegung einspringt, wo
 *    keiner steht (2.4, Regel 5),
 *  - dass ein **unbrauchbarer** Wert auf die Vorbelegung zurückfällt, statt
 *    das Verfahren stehen zu lassen: die Konfiguration ist freies JSON am
 *    Kundenstammsatz,
 *  - dass die **erste** Stufe mit dem Befund entsteht und jede weitere erst
 *    nach einem **vollen** Abstand,
 *  - dass die Stufenfolge aus 2.4 die **Obergrenze** ist — der Takt erzeugt
 *    keine Stufe, die 2.4 nicht nennt,
 *  - dass die Adressaten **kumulativ** sind: die höhere Stelle tritt hinzu,
 *    die zuständige bleibt.
 *
 * Alle Werte sind synthetisch (CLAUDE.md, Regel 3).
 */
import { describe, expect, it } from 'vitest'
import {
  eskalationsstufe,
  prozessfristTage,
  PROZESSFRIST_VORBELEGUNG,
  stufenkreis,
} from './fristen'

describe('Fristwert des Kunden (2.4, Regel 5)', () => {
  it('nimmt die Vorbelegung aus 4.0, wo keine Konfiguration steht', () => {
    expect(prozessfristTage(null, 'timesheetSubmissionDeadlineDays')).toBe(3)
    expect(prozessfristTage(undefined, 'billingReviewDeadlineDays')).toBe(14)
    expect(prozessfristTage({}, 'billingDisputeEscalationStepDays')).toBe(7)
  })

  it('nimmt den Wert des Kunden, wo einer steht', () => {
    expect(
      prozessfristTage({ timesheetSubmissionDeadlineDays: 10 }, 'timesheetSubmissionDeadlineDays'),
    ).toBe(10)
  })

  it('liest je Schlüssel und verwechselt zwei Werte nicht', () => {
    const config = {
      timesheetSubmissionDeadlineDays: 10,
      timesheetSubmissionEscalationStepDays: 4,
    }
    expect(prozessfristTage(config, 'timesheetSubmissionDeadlineDays')).toBe(10)
    expect(prozessfristTage(config, 'timesheetSubmissionEscalationStepDays')).toBe(4)
  })

  it('fällt bei unbrauchbaren Werten auf die Vorbelegung zurück', () => {
    const schluessel = 'timesheetSubmissionEscalationStepDays'
    const vorbelegung = PROZESSFRIST_VORBELEGUNG[schluessel]
    expect(prozessfristTage({ [schluessel]: 0 }, schluessel)).toBe(vorbelegung)
    expect(prozessfristTage({ [schluessel]: -3 }, schluessel)).toBe(vorbelegung)
    expect(prozessfristTage({ [schluessel]: 'bald' }, schluessel)).toBe(vorbelegung)
    expect(prozessfristTage({ [schluessel]: Number.NaN }, schluessel)).toBe(vorbelegung)
    expect(prozessfristTage({ [schluessel]: null }, schluessel)).toBe(vorbelegung)
    expect(prozessfristTage('kein Objekt', schluessel)).toBe(vorbelegung)
  })
})

describe('Stufe aus dem Stufenabstand (2.4, Regel 6)', () => {
  it('gibt am Tag des Befundes die erste Stufe', () => {
    expect(eskalationsstufe(0, 2, 3)).toBe(1)
  })

  it('rückt erst nach einem **vollen** Abstand weiter', () => {
    expect(eskalationsstufe(1, 2, 3)).toBe(1)
    expect(eskalationsstufe(2, 2, 3)).toBe(2)
    expect(eskalationsstufe(3, 2, 3)).toBe(2)
    expect(eskalationsstufe(4, 2, 3)).toBe(3)
  })

  it('bleibt bei der letzten Stufe der Stufenfolge', () => {
    expect(eskalationsstufe(100, 2, 3)).toBe(3)
    expect(eskalationsstufe(100, 1, 2)).toBe(2)
  })

  it('behandelt einen Tag vor dem Befund wie den Tag des Befundes', () => {
    // Negative Tage entstehen nicht; käme einer, wäre die erste Stufe die
    // richtige Antwort — eine Stufe null gibt es in 2.4 nicht.
    expect(eskalationsstufe(-5, 2, 3)).toBe(1)
  })

  it('gibt ohne Stufenfolge keine Stufe', () => {
    expect(eskalationsstufe(10, 2, 0)).toBe(0)
  })

  it('erreicht bei einem Abstand von null alle Stufen sofort', () => {
    // Kann aus der Konfiguration nicht kommen (`prozessfristTage` lässt die
    // Null nicht durch); die Funktion bleibt trotzdem total.
    expect(eskalationsstufe(0, 0, 3)).toBe(3)
  })
})

describe('Stufenkreis — kumulativ (2.4, Regel 6)', () => {
  const folge = ['LD', 'LA', 'MD'] as const

  it('nimmt die höhere Stelle hinzu, ohne die zuständige zu ersetzen', () => {
    expect(stufenkreis(folge, 0, 1)).toEqual(['LD'])
    expect(stufenkreis(folge, 1, 1)).toEqual(['LD', 'LA'])
    expect(stufenkreis(folge, 2, 1)).toEqual(['LD', 'LA', 'MD'])
  })

  it('wächst nicht über die Stufenfolge hinaus', () => {
    expect(stufenkreis(folge, 365, 1)).toEqual(['LD', 'LA', 'MD'])
  })

  it('gibt zu einer leeren Stufenfolge nichts', () => {
    expect(stufenkreis([], 10, 1)).toEqual([])
  })
})
