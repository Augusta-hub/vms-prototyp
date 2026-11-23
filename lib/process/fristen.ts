/**
 * Prozessfristen und Stufenabstände — SPEC **4.0**, Tabelle „Prozessfristen",
 * und **2.4** Regeln 5 und 6.
 *
 * Die Zahlen dieses Kapitels sind **Vorbelegungen**, nicht Festwerte: jeder
 * Wert ist je Kunde über `processDeadlineConfig` (3.1) übersteuerbar. Deshalb
 * stehen sie hier an **einer** Stelle und nicht als Zahl im Dienst — eine
 * Änderung ist eine Änderung von 4.0.
 *
 * **Abgrenzung zum Regelwerk.** `lib/aueg/regelwerk.ts` hält die Festwerte aus
 * 5.0: Vorlauf- und Schwellenwerte der AÜG-Fristen, für alle Kunden gleich.
 * Prozessfristen sind das Gegenstück — sie haben keine rechtliche Wirkung und
 * sind verhandelbar. Die beiden Tabellen werden deshalb nicht vermischt.
 *
 * **Einheit.** Gelesen werden hier **Tage**. Welche Tage, sagt 4.0 je Zeile:
 * Arbeitstage, wo die Frist in Arbeitstagen läuft, sonst Kalendertage. Der
 * nächtliche Lauf wertet bislang nur Anlässe mit **Kalendertagen** aus
 * (Stundenzettel und Abrechnungsbeleg); kommen die Anlässe aus 4.1 und 4.2
 * hinzu, braucht ihr Takt den Arbeitstagkalender aus `lib/aueg/kalender.ts`.
 */

/**
 * Die Vorbelegungen aus 4.0, je Konfigurationsschlüssel.
 *
 * Enthalten ist, wofür 4.0 eine **Zahl** nennt. Die Genehmigungsfrist eines
 * Stundenzettels fehlt deshalb: ihr Termin ist der `closingDate` der
 * Abrechnungsperiode (3.9) und keine Tageszahl — nur ihr Stufenabstand steht
 * hier. Ebenso die Angebots- und die Bindefrist, die an Objektfeldern hängen.
 */
export const PROZESSFRIST_VORBELEGUNG = {
  demandApprovalDeadlineDays: 3,
  demandApprovalEscalationStepDays: 2,
  invitationViewDeadlineDays: 1,
  invitationViewEscalationStepDays: 1,
  offerDeadlineEscalationStepDays: 1,
  submissionFeedbackDeadlineDays: 3,
  submissionFeedbackEscalationStepDays: 2,
  extensionApprovalDeadlineDays: 5,
  extensionApprovalEscalationStepDays: 2,
  timesheetSubmissionDeadlineDays: 3,
  timesheetSubmissionEscalationStepDays: 1,
  timesheetApprovalEscalationStepDays: 1,
  billingReviewDeadlineDays: 14,
  billingReviewEscalationStepDays: 7,
  billingDisputeEscalationStepDays: 7,
} as const

export type Prozessfristschluessel = keyof typeof PROZESSFRIST_VORBELEGUNG

/**
 * Der Fristwert dieses Kunden — sein Wert aus `processDeadlineConfig`, sonst
 * die Vorbelegung aus 4.0 (2.4, Regel 5).
 *
 * Ein unbrauchbarer Wert fällt auf die Vorbelegung zurück und wird nicht
 * gemeldet: die Konfiguration ist freies JSON am Kundenstammsatz, und ein
 * Verfahren, das Fristen überwacht, darf an einer krummen Zahl nicht stehen
 * bleiben. Null und negative Werte sind unbrauchbar — eine Frist von null
 * Tagen wäre keine Frist, und ein negativer Stufenabstand eine Eskalation vor
 * dem Befund.
 */
export function prozessfristTage(config: unknown, schluessel: Prozessfristschluessel): number {
  const vorbelegung = PROZESSFRIST_VORBELEGUNG[schluessel]
  if (config === null || typeof config !== 'object') return vorbelegung
  const wert = (config as Record<string, unknown>)[schluessel]
  return typeof wert === 'number' && Number.isFinite(wert) && wert > 0 ? wert : vorbelegung
}

/**
 * Die Stufe eines Befundes aus einer Prozessfrist (2.4, Regel 6).
 *
 * `tageSeitBefund` ist 0 an dem Tag, an dem der Befund entsteht — bei einer
 * Frist der erste Tag **nach** ihrem Ablauf, sonst der Tag des Ereignisses
 * selbst. Jeder volle Stufenabstand rückt eine Stufe weiter; mehr Stufen als
 * `stufen` gibt es nicht, denn mehr nennt die Stufenfolge in 2.4 nicht.
 */
export function eskalationsstufe(
  tageSeitBefund: number,
  stufenabstandTage: number,
  stufen: number,
): number {
  if (stufen <= 0) return 0
  if (stufenabstandTage <= 0) return stufen
  const tage = Math.max(0, Math.floor(tageSeitBefund))
  return Math.min(1 + Math.floor(tage / stufenabstandTage), stufen)
}

/**
 * Die Adressaten eines Befundes bis zur erreichten Stufe — **kumulativ**
 * (2.4, Regel 6).
 *
 * Die höhere Stelle tritt hinzu, die zuständige bleibt adressiert: sie ist es,
 * die entscheiden muss, und eine Eskalation, die den Zuständigen aus der
 * Nachricht nimmt, nähme ihm den Vorgang nicht ab, sondern nur die Kenntnis
 * davon.
 */
export function stufenkreis<T>(
  stufenfolge: readonly T[],
  tageSeitBefund: number,
  stufenabstandTage: number,
): readonly T[] {
  return stufenfolge.slice(
    0,
    eskalationsstufe(tageSeitBefund, stufenabstandTage, stufenfolge.length),
  )
}
