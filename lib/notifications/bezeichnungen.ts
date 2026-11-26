/**
 * Art und Anlass einer Benachrichtigung in Worten — SPEC **3.14**, **5.5.1**
 * und **2.4**.
 *
 * Sie stehen hier und nicht im Fachdienst, weil zwei Stellen sie brauchen: die
 * Anzeige im Postfach und der Brief der Zustellung (3.14). Dieselbe Nachricht
 * muss in beiden gleich heißen — ein Anlass, der im System „N2" und in der
 * E-Mail „Höchstüberlassungsdauer" wäre, hätte zwei Namen und damit zwei
 * Bedeutungen.
 */
import type { Befundart } from '../nightly/befunde'

export const NOTIFICATION_KIND_LABELS: Readonly<Record<Befundart, string>> = {
  information: 'Information',
  warning: 'Warnung',
  escalation: 'Warnung mit Eskalation',
}

/** Anlässe in Worten (3.14, 5.5.1 und 2.4). */
export const NOTIFICATION_TRIGGER_LABELS: Readonly<Record<string, string>> = {
  permitExpiry: 'N1 — AÜG-Erlaubnis läuft ab (5.4)',
  maxDurationThreshold: 'N2 — Höchstüberlassungsdauer (5.1)',
  equalPayThreshold: 'N3 — Equal-Pay-Fälligkeit (5.2)',
  documentExpiry: 'N5 — Nachweis läuft ab (5.4)',
  interruptionThreshold: 'N6 — Unterbrechung über drei Monate (5.1.4)',
  timesheetNotSubmitted: 'Stundenzettel nicht eingereicht (2.4)',
  timesheetNotApproved: 'Stundenzettel nicht genehmigt vor Periodenschluss (2.4)',
  billingDocumentDisputed: 'Abrechnungsbeleg beanstandet und nicht geklärt (2.4)',
  statusTransition: 'Statuswechsel (Kapitel 4)',
  ruleWarning: 'Warnung aus der Prüfung zum Übergang (4.7)',
  nightlyRunMissed: 'Nächtlicher Lauf ausgeblieben (5.5.1)',
  demandApprovalOverdue: 'Bedarfsanfrage nicht freigegeben (2.4, 4.1)',
  tenderNoOffer: 'Ausschreibung ohne Angebot (2.4, 4.2)',
  submissionFeedbackOverdue: 'Profil ohne Rückmeldung des Kunden (2.4, 4.2)',
  extensionApprovalOverdue: 'Verlängerung nicht entschieden (2.4, 4.3.2)',
  invitationNotViewed: 'Einladung nicht geöffnet (4.0, 4.2)',
}
