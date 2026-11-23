/**
 * Der nächtliche Lauf — SPEC **5.5.1 c**, Zeilen N1 bis N6.
 *
 * „Einmal täglich, Stichtag ist der Tag des Laufs. Er prüft die Vorgänge, bei
 * denen **Zeit allein** die Lage ändert, und erzeugt die Vorlaufwarnungen aus
 * 5.0."
 *
 * **Dieses Modul rechnet, es lädt nicht.** Jede Funktion nimmt die Zeilen, die
 * der Aufrufer geladen hat, und gibt Befunde zurück — dieselbe Linie wie
 * `lib/aueg/` und `lib/billing/items.ts`. Geschrieben wird in
 * `lib/services/nightly.ts`.
 *
 * **Drei Dinge, die der Lauf nicht tut**, und zwar keines aus Nachlässigkeit:
 *
 *  - **Keinen Statuswechsel** (4.0, Regeln 4 und 10). Ein Einsatz, dessen
 *    Fristende erreicht ist, wird nicht beendet; eine Unterbrechung wird
 *    **vorgeschlagen**, nicht vollzogen (5.3.2).
 *  - **Keine Sperre** (5.5.1 c). Eine Sperre braucht einen Übergang, den sie
 *    verhindert; der Lauf hat keinen.
 *  - **Keine Genehmigungsfiktion** (2.4, Regel 1). Ein nicht genehmigter
 *    Stundenzettel bleibt nicht genehmigt — er wird eskaliert.
 *
 * **Zwei Quellen der Stufe, eine Form.** Für die Anlässe aus Kapitel 5 nennen
 * 5.4.4, 5.1.6 und 5.0 Vorlaufwerte je Stufe: die Stufe steht in der
 * **Restzeit** und wird abgelesen. Für die **Prozessfristen** aus 4.0 gibt es
 * nur einen Termin; dort zählt der **Stufenabstand** je Anlass (2.4, Regel 6;
 * Werte in 4.0, je Kunde konfigurierbar) — Stufe 1 mit dem Befund, jede
 * weitere nach einem vollen Abstand. In beiden Fällen sind die Adressaten
 * **kumulativ**: die Warnung geht zusätzlich an `LD`, nicht statt an `LA`.
 * Mehr Stufen, als die Stufenfolge in 2.4 nennt, gibt es nicht.
 *
 * **N4 fehlt.** Die Zeile verlangt P7, und für die Arbeitskampfanzeige führt
 * Kapitel 3 kein Feld (*offene Frage 30*); 5.3.2 sagt dazu selbst, die Regel
 * sei „prüfbar, aber **nicht auswertbar**". Eine Zeile ohne Rechenweg wäre
 * eine Zusicherung, die nichts einlöst — dieselbe Haltung wie in
 * `lib/aueg/querschnitt.ts`.
 */
import {
  erlaubnisVorlauf,
  nachweisVorlauf,
  unterbrechungsstand,
  type Erlaubniszeile,
  type Nachweiszeile,
} from '../aueg/anbindung'
import { REGELWERK, type Regelwerkkonfiguration } from '../aueg/regelwerk'
import type { Rollenkuerzel } from '../aueg/typen'
import { stufenkreis } from '../process/fristen'
import { ausfallstufe, type Laufstand } from './zeitplan'

/** Die Anlässe, die dieser Lauf erzeugt — die Zeilen aus 5.5.1 und 2.4. */
export type Anlass =
  | 'permitExpiry'
  | 'maxDurationThreshold'
  | 'equalPayThreshold'
  | 'documentExpiry'
  | 'interruptionThreshold'
  | 'timesheetNotSubmitted'
  | 'timesheetNotApproved'
  | 'billingDocumentDisputed'
  | 'nightlyRunMissed'

/** Art des Befunds — sie folgt der Ergebnisart aus 5.5.2. */
export type Befundart = 'information' | 'warning' | 'escalation'

/**
 * Ein Befund des Laufs. Jeder nennt seine Prüfung, seinen Gegenstand und das
 * fehlende oder verletzte Datum (5.5.2 Nr. 2) — ein Sammelergebnis „drei
 * Befunde" wäre nicht abarbeitbar.
 */
export interface Nachtbefund {
  /** Zeilennummer aus 5.5.1 (`N1` …) oder der Anlass aus 2.4. */
  readonly zeile: string
  readonly anlass: Anlass
  readonly art: Befundart
  /** `P1` … `P11`; `null` bei einer Prozessfrist aus 4.0. */
  readonly pruefung: string | null
  readonly objectType: string
  readonly objectRef: string
  /** Mandant des betroffenen Objekts (3.12, 3.14). */
  readonly tenantId: string
  /** Adressaten als Rollenkürzel (5.5.2 Nr. 6), kumulativ nach Stufe. */
  readonly adressaten: readonly Rollenkuerzel[]
  /**
   * Die Organisation je Adressat. Eine Rolle wirkt immer in **einem**
   * Mandanten (2.1): `MD` und `MA` beim Betreiber, `KB`, `KG` und `KE` beim
   * Kunden, `LD` und `LA` beim Lieferanten. Ohne diese Zuordnung wäre eine
   * Benachrichtigung an „LD" nicht adressierbar, wenn mehrere Lieferanten
   * beteiligt sind.
   */
  readonly mandantJeRolle: Readonly<Partial<Record<Rollenkuerzel, string>>>
  readonly meldung: string
}

/** Die Mandanten, in denen die Rollen eines Vorgangs wirken (2.1). */
export interface Mandantenlage {
  readonly operator: string
  readonly customer?: string | null
  readonly supplier?: string | null
}

function mandantJeRolle(lage: Mandantenlage): Readonly<Partial<Record<Rollenkuerzel, string>>> {
  return {
    MA: lage.operator,
    MD: lage.operator,
    ...(lage.customer != null ? { KB: lage.customer, KG: lage.customer, KE: lage.customer } : {}),
    ...(lage.supplier != null ? { LD: lage.supplier, LA: lage.supplier } : {}),
  }
}

/**
 * Die Art eines Vorlaufbefunds aus seiner Stufe (5.4.4).
 *
 * `information` im Vorlauf, `warning` ab der Warnstufe, `escalation` darüber —
 * und **nie** eine Sperre: die erzeugt der Lauf nicht (5.5.1 c).
 */
function artAusStufe(stufe: string): Befundart {
  if (stufe === 'eskalation' || stufe === 'abgelaufen') return 'escalation'
  if (stufe === 'warnung') return 'warning'
  return 'information'
}

/* ------------------------------------------------------------------ */
/* N1 — AÜG-Erlaubnis (P9, SPEC 5.4.4)                                 */
/* ------------------------------------------------------------------ */

export interface Lieferantenzeile {
  readonly id: string
  readonly legalName: string
  readonly tenantId: string
  /** `onboarding`, `active`, `blocked` — nur diese prüft N1 (5.5.1). */
  readonly status: string
  readonly erlaubnisse: readonly Erlaubniszeile[]
  readonly urkunden: readonly Nachweiszeile[]
}

/** Lieferantenzustände, die N1 prüft (5.5.1, Spalte „Gegenstand"). */
const N1_ZUSTAENDE: readonly string[] = ['onboarding', 'active', 'blocked']

export function befundeN1(
  lieferanten: readonly Lieferantenzeile[],
  stichtag: Date,
  /** Der Betreibermandant — `MD` und `MA` wirken dort (2.1). */
  operatorTenantId: string,
): readonly Nachtbefund[] {
  const befunde: Nachtbefund[] = []
  for (const lieferant of lieferanten) {
    if (!N1_ZUSTAENDE.includes(lieferant.status)) continue
    const stand = erlaubnisVorlauf({
      lieferant: lieferant.legalName,
      erlaubnisse: lieferant.erlaubnisse,
      urkunden: lieferant.urkunden,
      stichtag,
    })
    // `keine` heißt: unbefristet oder außerhalb jedes Vorlaufs. Dann gibt es
    // nichts zu melden — eine Benachrichtigung ohne Anlass wäre Lärm.
    if (stand.stufe === 'keine') continue
    befunde.push({
      zeile: 'N1',
      anlass: 'permitExpiry',
      art: artAusStufe(stand.stufe),
      pruefung: 'P9',
      objectType: 'supplier',
      objectRef: lieferant.id,
      tenantId: lieferant.tenantId,
      adressaten: stand.adressaten,
      mandantJeRolle: mandantJeRolle({
        operator: operatorTenantId,
        supplier: lieferant.tenantId,
      }),
      meldung: stand.meldung,
    })
  }
  return befunde
}

/* ------------------------------------------------------------------ */
/* N2 und N3 — Fristen am Einsatz (P1, P3, P4; SPEC 5.1.6 und 5.0)     */
/* ------------------------------------------------------------------ */

export interface Einsatzlage {
  readonly id: string
  readonly assignmentNumber: string
  readonly tenantId: string
  readonly status: string
  readonly customerTenantId: string
  readonly supplierTenantId: string
  /** *Abgeleitet* aus 5.1.3 — gelesen, nicht neu gerechnet. */
  readonly maxDurationEndDate: Date | null
  /** *Abgeleitet* aus 5.2.3. */
  readonly equalPayDueDate: Date | null
  readonly comparableWage: number | null
}

/** Einsatzzustände, die N2 und N3 prüfen (5.5.1). */
const N2_ZUSTAENDE: readonly string[] = ['planned', 'active', 'interrupted']

/** Tage von `stichtag` bis `ziel`; negativ, wenn das Ziel verstrichen ist. */
export function restTage(stichtag: Date, ziel: Date): number {
  const tag = 24 * 60 * 60 * 1000
  return Math.round((alsTagesanfang(ziel) - alsTagesanfang(stichtag)) / tag)
}

function alsTagesanfang(wert: Date): number {
  return Date.UTC(wert.getUTCFullYear(), wert.getUTCMonth(), wert.getUTCDate())
}

/**
 * **N2**: `maxDurationEndDate` innerhalb des Vorlaufs oder erreicht.
 *
 * Die Schwellen stehen in 5.0 (`maxDurationNoticeDays` 90,
 * `maxDurationWarningDays` 30) und ihre Adressaten in 5.1.6. Das Fristende
 * wird **gelesen**, nicht neu gerechnet: es steht nach 5.1.3 am Einsatz und
 * wird an dessen Übergängen fortgeschrieben.
 */
export function befundeN2(
  einsaetze: readonly Einsatzlage[],
  stichtag: Date,
  konfiguration = REGELWERK,
): readonly Nachtbefund[] {
  const befunde: Nachtbefund[] = []
  for (const einsatz of einsaetze) {
    if (!N2_ZUSTAENDE.includes(einsatz.status)) continue
    const fristende = einsatz.maxDurationEndDate
    if (fristende === null) continue
    const rest = restTage(stichtag, fristende)
    if (rest > konfiguration.dauer.hinweisTage) continue

    const erreicht = rest < 0
    const art: Befundart = erreicht
      ? 'escalation'
      : rest <= konfiguration.dauer.warnungTage
        ? 'warning'
        : 'information'
    const adressaten = erreicht
      ? konfiguration.adressatenDauerErreicht
      : rest <= konfiguration.dauer.warnungTage
        ? konfiguration.adressatenDauerWarnung
        : konfiguration.adressatenDauerHinweis
    befunde.push({
      zeile: 'N2',
      anlass: 'maxDurationThreshold',
      art,
      pruefung: 'P1',
      objectType: 'assignment',
      objectRef: einsatz.id,
      tenantId: einsatz.tenantId,
      adressaten,
      mandantJeRolle: mandantJeRolle({
        operator: einsatz.tenantId,
        customer: einsatz.customerTenantId,
        supplier: einsatz.supplierTenantId,
      }),
      meldung: erreicht
        ? `P1: Das Fristende der Höchstüberlassungsdauer (${tag(fristende)}) ist seit ` +
          `${Math.abs(rest)} Tag(en) erreicht, der Einsatz ${einsatz.assignmentNumber} läuft ` +
          'weiter. Warnung mit Pflicht-Eskalation (SPEC 5.1.6); der Lauf beendet den Einsatz ' +
          'nicht — das ist ein Übergang in 4.3 und braucht eine auslösende Rolle.'
        : `P1: Das Fristende der Höchstüberlassungsdauer am ${tag(fristende)} ist in ` +
          `${rest} Tag(en) erreicht (Einsatz ${einsatz.assignmentNumber}). Schwelle ` +
          `${rest <= konfiguration.dauer.warnungTage ? konfiguration.dauer.warnungTage : konfiguration.dauer.hinweisTage} ` +
          'Tage nach SPEC 5.1.6.',
    })
  }
  return befunde
}

/**
 * **N3**: `equalPayDueDate` innerhalb des Vorlaufs oder erreicht **und**
 * `comparableWage` nicht gesetzt.
 *
 * Die zweite Bedingung ist Teil der Zeile: ein Einsatz mit hinterlegtem
 * Vergleichsentgelt braucht keine Warnung, auch wenn die Fälligkeit naht. Der
 * **Hinweis** (60 Tage) geht nach 5.0 an `MD` und `KE` auch dann, wenn der
 * Wert fehlt — gewarnt (30 Tage) wird nur ohne Wert.
 */
export function befundeN3(
  einsaetze: readonly Einsatzlage[],
  stichtag: Date,
  konfiguration = REGELWERK,
): readonly Nachtbefund[] {
  const befunde: Nachtbefund[] = []
  for (const einsatz of einsaetze) {
    if (!N2_ZUSTAENDE.includes(einsatz.status)) continue
    const faelligkeit = einsatz.equalPayDueDate
    if (faelligkeit === null) continue
    if (einsatz.comparableWage !== null) continue
    const rest = restTage(stichtag, faelligkeit)
    if (rest > konfiguration.equalPay.hinweisTage) continue

    const erreicht = rest <= 0
    const art: Befundart = erreicht
      ? 'escalation'
      : rest <= konfiguration.equalPay.warnungTage
        ? 'warning'
        : 'information'
    const adressaten =
      rest <= konfiguration.equalPay.warnungTage
        ? konfiguration.adressatenEqualPayWarnung
        : konfiguration.adressatenEqualPayHinweis
    befunde.push({
      zeile: 'N3',
      anlass: 'equalPayThreshold',
      art,
      pruefung: 'P4',
      objectType: 'assignment',
      objectRef: einsatz.id,
      tenantId: einsatz.tenantId,
      adressaten,
      mandantJeRolle: mandantJeRolle({
        operator: einsatz.tenantId,
        customer: einsatz.customerTenantId,
        supplier: einsatz.supplierTenantId,
      }),
      meldung: erreicht
        ? `P3/P4: Die Equal-Pay-Fälligkeit (${tag(faelligkeit)}) ist erreicht, am Einsatz ` +
          `${einsatz.assignmentNumber} steht kein Vergleichsentgelt (SPEC 5.2.1). Der Entleiher ` +
          'pflegt den Eintrag am Standort (3.3); ab der Fälligkeit sperrt Q36 die Genehmigung ' +
          'von Zeiten.'
        : `P3/P4: Die Equal-Pay-Fälligkeit am ${tag(faelligkeit)} ist in ${rest} Tag(en) ` +
          `erreicht und am Einsatz ${einsatz.assignmentNumber} steht kein Vergleichsentgelt ` +
          '(SPEC 5.0, Festwerte).',
    })
  }
  return befunde
}

/* ------------------------------------------------------------------ */
/* N5 — Nachweise (P10, SPEC 5.4.4)                                    */
/* ------------------------------------------------------------------ */

export interface Nachweislage {
  /** Das Bezugsobjekt, zu dem die Nachweise gehören (3.10). */
  readonly objectType: string
  readonly objectRef: string
  readonly tenantId: string
  readonly mandanten: Mandantenlage
  readonly nachweise: readonly Nachweiszeile[]
  readonly arbeitserlaubnisErforderlich: boolean | null
  readonly unterweisungVerlangt: boolean | null
}

/**
 * **N5**: Nachweise mit `validTo`, deren Bezugsobjekt **aktiv** ist.
 *
 * „Aktiv" entscheidet der Aufrufer — er lädt nur die Bezugsobjekte, die es
 * sind. Hier wird gerechnet, nicht ausgewählt.
 */
export function befundeN5(
  lagen: readonly Nachweislage[],
  stichtag: Date,
): readonly Nachtbefund[] {
  const befunde: Nachtbefund[] = []
  for (const lage of lagen) {
    const stand = nachweisVorlauf({
      nachweise: lage.nachweise,
      bezugsobjekt: lage.objectRef,
      stichtag,
      arbeitserlaubnisErforderlich: lage.arbeitserlaubnisErforderlich,
      unterweisungVerlangt: lage.unterweisungVerlangt,
    })
    if (stand.stufe === 'keine') continue
    befunde.push({
      zeile: 'N5',
      anlass: 'documentExpiry',
      art: artAusStufe(stand.stufe),
      pruefung: 'P10',
      objectType: lage.objectType,
      objectRef: lage.objectRef,
      tenantId: lage.tenantId,
      adressaten: stand.adressaten,
      mandantJeRolle: mandantJeRolle(lage.mandanten),
      meldung: stand.meldung,
    })
  }
  return befunde
}

/* ------------------------------------------------------------------ */
/* N6 — offene Unterbrechung (P2, SPEC 5.1.4)                          */
/* ------------------------------------------------------------------ */

export interface Unterbrechungslage {
  readonly assignmentId: string
  readonly assignmentNumber: string
  readonly tenantId: string
  readonly customerTenantId: string
  readonly supplierTenantId: string
  readonly interruptionFrom: Date
  /** `null` = offen; nur offene Unterbrechungen prüft N6 (5.5.1). */
  readonly interruptionTo: Date | null
}

/**
 * **N6**: eine offene Unterbrechung überschreitet die Drei-Monats-Schwelle.
 *
 * **Information**, keine Warnung: die Zählung wird nicht hier zurückgesetzt,
 * sondern mit der **Wiederaufnahme** (5.1.4). Der Lauf stellt fest, dass es so
 * weit ist — entschieden wird am Übergang `interrupted` → `active` (Q25).
 */
export function befundeN6(
  unterbrechungen: readonly Unterbrechungslage[],
  stichtag: Date,
): readonly Nachtbefund[] {
  const befunde: Nachtbefund[] = []
  for (const lage of unterbrechungen) {
    if (lage.interruptionTo !== null) continue
    const stand = unterbrechungsstand({
      von: lage.interruptionFrom,
      bis: null,
      stichtag,
    })
    if (!stand.ueberschreitet) continue
    befunde.push({
      zeile: 'N6',
      anlass: 'interruptionThreshold',
      art: 'information',
      pruefung: 'P2',
      objectType: 'assignment',
      objectRef: lage.assignmentId,
      tenantId: lage.tenantId,
      // 5.1.4 nennt für diese Feststellung keine eigenen Adressaten; sie
      // betrifft die Zählung und damit die Rolle, die sie führt (5.1.6).
      adressaten: REGELWERK.adressatenDauerHinweis,
      mandantJeRolle: mandantJeRolle({
        operator: lage.tenantId,
        customer: lage.customerTenantId,
        supplier: lage.supplierTenantId,
      }),
      meldung:
        `P2: Die Unterbrechung des Einsatzes ${lage.assignmentNumber} seit ` +
        `${tag(lage.interruptionFrom)} dauert ${stand.dauerTage} Tage und überschreitet damit ` +
        'die Drei-Monats-Schwelle. Die Zählung wird mit der **Wiederaufnahme** zurückgesetzt, ' +
        'nicht durch diesen Lauf (SPEC 5.1.4).',
    })
  }
  return befunde
}

/* ------------------------------------------------------------------ */
/* Prozessfristen aus 2.4 und 4.0                                      */
/* ------------------------------------------------------------------ */

export interface Zettellage {
  readonly id: string
  readonly timesheetNumber: string
  readonly tenantId: string
  readonly customerTenantId: string
  readonly supplierTenantId: string
  readonly status: string
  readonly periodTo: Date
  /** `closingDate` der Abrechnungsperiode (3.9). */
  readonly closingDate: Date
  /** Rolle der **offenen** Freigabestufe (3.1, 4.4); `null`, wenn keine offen ist. */
  readonly openStageRole: Rollenkuerzel | null
  /** `timesheetSubmissionDeadlineDays` des Kunden (3.1), sonst Vorbelegung. */
  readonly submissionDeadlineDays: number
  /** `timesheetSubmissionEscalationStepDays` (4.0, 2.4 Regel 6), Kalendertage. */
  readonly submissionEscalationStepDays: number
  /** `timesheetApprovalEscalationStepDays` (4.0, 2.4 Regel 6), Kalendertage. */
  readonly approvalEscalationStepDays: number
}

/**
 * **Stundenzettel nicht eingereicht** (2.4; Frist aus 4.0:
 * `timesheetSubmissionDeadlineDays`, Vorbelegung 3 Kalendertage nach
 * `periodTo`).
 *
 * Zuständig ist `LD` — der Leiharbeitnehmer hat keinen eigenen Zugang
 * (*offene Frage 4*). Die weiteren Stufen `LA` und `MD` treten nach je einem
 * `timesheetSubmissionEscalationStepDays` **hinzu** (2.4, Regel 6).
 */
/** Stufenfolge aus 2.4: `LD` → `LA` → `MD`, ohne die Vertretung (Regel 6). */
const STUFEN_ZETTEL_EINREICHUNG: readonly Rollenkuerzel[] = ['LD', 'LA', 'MD']

export function befundeZettelNichtEingereicht(
  zettel: readonly Zettellage[],
  stichtag: Date,
): readonly Nachtbefund[] {
  const befunde: Nachtbefund[] = []
  for (const lage of zettel) {
    if (lage.status !== 'recorded' && lage.status !== 'rejected') continue
    const frist = new Date(lage.periodTo)
    frist.setUTCDate(frist.getUTCDate() + lage.submissionDeadlineDays)
    if (restTage(stichtag, frist) >= 0) continue
    // Tag 0 des Befundes ist der erste Tag **nach** dem Fristablauf (2.4,
    // Regel 6): am Tag des Ablaufs selbst ist die Frist noch gewahrt.
    const tageSeitBefund = -restTage(stichtag, frist) - 1
    befunde.push({
      zeile: '2.4',
      anlass: 'timesheetNotSubmitted',
      art: 'warning',
      pruefung: null,
      objectType: 'timesheet',
      objectRef: lage.id,
      tenantId: lage.tenantId,
      adressaten: stufenkreis(
        STUFEN_ZETTEL_EINREICHUNG,
        tageSeitBefund,
        lage.submissionEscalationStepDays,
      ),
      mandantJeRolle: mandantJeRolle({
        operator: lage.tenantId,
        customer: lage.customerTenantId,
        supplier: lage.supplierTenantId,
      }),
      meldung:
        `Der Stundenzettel ${lage.timesheetNumber} ist seit dem ${tag(frist)} fällig und steht ` +
        'noch nicht auf „eingereicht" (SPEC 2.4, 4.0). Der Fristablauf reicht ihn **nicht** ' +
        'ein — er erzeugt Aufmerksamkeit, nie einen Statuswechsel (2.4, Regel 1).',
    })
  }
  return befunde
}

/**
 * **Stundenzettel nicht genehmigt vor Periodenschluss** (2.4; Frist aus 4.0:
 * bis `closingDate` der Abrechnungsperiode).
 *
 * Zuständig ist die Rolle der **offenen** Stufe (3.1, 4.4) — nicht eine feste
 * Rolle: welche es ist, steht in der Konfiguration des Kunden und ist beim
 * Einreichen in den Freigabeschritt kopiert worden.
 *
 * Die Stufenfolge hängt daran: 2.4 führt „Vertretung → `KE` → `MD`", „bei
 * einer Betreiberstufe Vertretung → `MA`". Ohne die Vertretung (Regel 6)
 * bleibt `KE` → `MD` bei einer Kundenstufe und `MA` bei einer Betreiberstufe.
 * Trägt die offene Stufe selbst schon eine dieser Rollen, entfällt sie als
 * weitere Stufe — eine Eskalation an sich selbst wäre keine.
 */
/**
 * Die Stufenfolge zur offenen Freigabestufe (2.4, Zeile „Stundenzettel nicht
 * genehmigt vor Periodenschluss").
 *
 * `MD` und `MA` wirken beim Betreiber (2.1) — eine offene Stufe mit einer
 * dieser Rollen ist eine **Betreiberstufe**, und 2.4 führt dafür `MA` als
 * weitere Stelle. Sonst ist es eine Kundenstufe mit `KE` und danach `MD`.
 */
function stufenZettelGenehmigung(zustaendig: Rollenkuerzel): readonly Rollenkuerzel[] {
  const folge: Rollenkuerzel[] =
    zustaendig === 'MD' || zustaendig === 'MA' ? [zustaendig, 'MA'] : [zustaendig, 'KE', 'MD']
  return folge.filter((rolle, index) => folge.indexOf(rolle) === index)
}

export function befundeZettelNichtGenehmigt(
  zettel: readonly Zettellage[],
  stichtag: Date,
): readonly Nachtbefund[] {
  const befunde: Nachtbefund[] = []
  for (const lage of zettel) {
    if (lage.status !== 'submitted' && lage.status !== 'inApproval') continue
    if (restTage(stichtag, lage.closingDate) >= 0) continue
    const zustaendig = lage.openStageRole
    if (zustaendig === null) continue
    const tageSeitBefund = -restTage(stichtag, lage.closingDate) - 1
    befunde.push({
      zeile: '2.4',
      anlass: 'timesheetNotApproved',
      art: 'warning',
      pruefung: null,
      objectType: 'timesheet',
      objectRef: lage.id,
      tenantId: lage.tenantId,
      adressaten: stufenkreis(
        stufenZettelGenehmigung(zustaendig),
        tageSeitBefund,
        lage.approvalEscalationStepDays,
      ),
      mandantJeRolle: mandantJeRolle({
        operator: lage.tenantId,
        customer: lage.customerTenantId,
        supplier: lage.supplierTenantId,
      }),
      meldung:
        `Der Stundenzettel ${lage.timesheetNumber} ist seit dem Schlusstermin der ` +
        `Abrechnungsperiode (${tag(lage.closingDate)}) nicht entschieden; die offene Stufe ` +
        `trägt ${zustaendig} (SPEC 4.4). Es gibt **keine** Genehmigungsfiktion (2.4, Regel 1): ` +
        'der Zettel hält die Abrechnung der Periode auf (4.5.1).',
    })
  }
  return befunde
}

export interface Beleglage {
  readonly id: string
  readonly documentNumber: string
  readonly tenantId: string
  readonly customerTenantId: string | null
  readonly supplierTenantId: string | null
  readonly status: string
  readonly disputedAt: Date | null
  readonly disputeResolutionNote: string | null
  /** `billingDisputeEscalationStepDays` (4.0, 2.4 Regel 6), Kalendertage. */
  readonly disputeEscalationStepDays: number
}

/** Stufenfolge aus 2.4: `MD` → `MA`, ohne die Vertretung (Regel 6). */
const STUFEN_BELEG_BEANSTANDET: readonly Rollenkuerzel[] = ['MD', 'MA']

/**
 * **Abrechnungsbeleg beanstandet und nicht geklärt** (2.4). Zuständig ist
 * `MD`, nach einem `billingDisputeEscalationStepDays` tritt `MA` hinzu
 * (2.4, Regel 6).
 *
 * Es gibt dafür **keine Frist in 4.0**: der Anlass entsteht mit der
 * Beanstandung und besteht, solange der Beleg beanstandet ist. Gemeldet wird
 * deshalb ab dem Tag der Beanstandung, nicht nach einem Vorlauf — und dieser
 * Tag ist zugleich Tag 0 des Stufenabstands.
 */
export function befundeBelegBeanstandet(
  belege: readonly Beleglage[],
  stichtag: Date,
): readonly Nachtbefund[] {
  const befunde: Nachtbefund[] = []
  for (const lage of belege) {
    if (lage.status !== 'disputed') continue
    if (lage.disputedAt === null) continue
    const tageOffen = Math.abs(restTage(stichtag, lage.disputedAt))
    befunde.push({
      zeile: '2.4',
      anlass: 'billingDocumentDisputed',
      art: 'warning',
      pruefung: null,
      objectType: 'billingDocument',
      objectRef: lage.id,
      tenantId: lage.tenantId,
      adressaten: stufenkreis(STUFEN_BELEG_BEANSTANDET, tageOffen, lage.disputeEscalationStepDays),
      mandantJeRolle: mandantJeRolle({
        operator: lage.tenantId,
        customer: lage.customerTenantId,
        supplier: lage.supplierTenantId,
      }),
      meldung:
        `Der Abrechnungsbeleg ${lage.documentNumber} ist seit ${tageOffen} Tag(en) beanstandet ` +
        'und nicht geklärt (SPEC 2.4, 4.5.2). Die Klärung führt zurück in die Prüfung; der ' +
        'Beleg hält den Schluss der Abrechnungsperiode auf (4.5.1).',
    })
  }
  return befunde
}

function tag(wert: Date): string {
  return wert.toISOString().slice(0, 10)
}

/* ------------------------------------------------------------------ */
/* Der ausgebliebene Lauf (5.5.1)                                      */
/* ------------------------------------------------------------------ */

/**
 * Der Befund über **ausgefallene Läufe** (SPEC 5.5.1, Tabelle „Der
 * ausgebliebene Lauf wird gemeldet").
 *
 * Er entsteht in dem Lauf, der die Lücke schließt — das ist der einzige
 * Zeitpunkt, zu dem das System sie bemerken kann: die Nachricht über einen
 * ausgebliebenen Lauf entsteht im Lauf, und bleibt er weg, bleibt auch sie
 * weg. Wer den Ausfall **während** des Ausfalls bemerken will, braucht eine
 * Überwachung außerhalb (5.5.1).
 *
 * Gemeldet werden die **Tage**, nicht nur ihre Zahl: eine Frist, die in dieser
 * Zeit erreicht wurde, ist nachzusehen.
 */
export function befundLaufAusgefallen(
  stand: Laufstand,
  operatorTenantId: string,
  konfiguration: Regelwerkkonfiguration = REGELWERK,
): readonly Nachtbefund[] {
  const stufe = ausfallstufe(stand.ausgefalleneTage, konfiguration.lauf)
  if (stufe === 'keine') return []

  const benannt = stand.ausgefallen.map(tag)
  const tage =
    benannt.length < stand.ausgefalleneTage
      ? `${benannt.join(', ')} und weitere`
      : benannt.join(', ')

  return [
    {
      zeile: 'Lauf',
      anlass: 'nightlyRunMissed',
      art: stufe === 'warnung' ? 'warning' : 'information',
      // Keine Prüfung aus Kapitel 5: der Befund betrifft den Lauf selbst.
      pruefung: null,
      objectType: 'nightlyRuleRun',
      // Der Stichtag ist die Kennung: so entsteht je Lauf **eine** Meldung,
      // und ein wiederholter Lauf desselben Tages verdoppelt sie nicht (3.14).
      objectRef: tag(stand.stichtag),
      tenantId: operatorTenantId,
      adressaten:
        stufe === 'warnung'
          ? konfiguration.adressatenLaufAusgefallenWarnung
          : konfiguration.adressatenLaufAusgefallen,
      mandantJeRolle: mandantJeRolle({ operator: operatorTenantId }),
      meldung:
        `Der nächtliche Lauf ist ${stand.ausgefalleneTage} Tag(e) ausgefallen: ${tage}. ` +
        (stufe === 'warnung'
          ? `Ab ${konfiguration.lauf.ausfallWarnungTage} Tagen ist das ein defekter Zeitplan ` +
            'und keine Wartung (SPEC 5.5.1); Eskalation an `MA`. '
          : '') +
        'Die ausgefallenen Tage werden **nicht** nachgeholt — der Stichtag ist der Tag des ' +
        'Laufs (5.5.1). Fristen, die in dieser Zeit erreicht wurden, nennt dieser Lauf mit, ' +
        'weil N1 bis N6 Spannen prüfen und keine Kanten.',
    },
  ]
}
