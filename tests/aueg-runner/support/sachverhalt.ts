/**
 * Vorbedingungen der Szenarien als Sachverhalte erfassen.
 *
 * Eine Vorbedingung ("Angenommen", "Und" vor dem "Wenn") stellt eine Tatsache
 * fest. Der Runner erfasst sie als `Sachverhalt`: wovon der Satz handelt
 * (`art`), welche Daten er traegt (`werte`) und den Satz im Original. Mehr
 * behauptet der Runner nicht — ob eine Tatsache eine AUEG-Pruefung ansprechen
 * laesst, entscheidet die Fachlogik aus SPEC Kapitel 5 (noch offen, M4).
 *
 * 456 verschiedene Vorbedingungssaetze stehen in den vier Feature-Dateien. Je
 * Satz ein Muster zu pflegen, waere nicht zu halten und wuerde die Saetze zur
 * Anpassung an den Runner einladen — genau das verbietet CLAUDE.md Regel 1.
 * Deshalb klassifiziert dieses Modul nach Signatur statt nach Satzbau.
 */

import { leseWerte, type GeleseneWerte } from './werte'

/** Wovon eine Vorbedingung handelt. Ableitung aus SPEC Kapitel 3 und 5. */
export type Sachverhaltsart =
  | 'rahmenaussage'
  | 'entleiher'
  | 'konzern'
  | 'lieferant'
  | 'rahmenvertrag'
  | 'erlaubnissatz'
  | 'nachweis'
  | 'kandidat'
  | 'personenidentitaet'
  | 'tarifzuordnung'
  | 'vergleichsentgelt'
  | 'taetigkeit'
  | 'ueberlassungskette'
  | 'unterbrechung'
  | 'fristenstand'
  | 'vorgang'
  | 'zeitraum'
  | 'arbeitskampfanzeige'
  | 'vorbeschaeftigung'
  | 'sperrvorzustand'
  | 'uebersteuerungsvoraussetzung'
  | 'rueckwirkende_korrektur'
  | 'fristlauf'
  | 'kriterium'
  | 'pruefvorzustand'
  | 'sonstiges'

export interface Sachverhalt {
  art: Sachverhaltsart
  satz: string
  werte: GeleseneWerte
}

/**
 * Signaturen, in dieser Reihenfolge geprueft: spezifisch vor allgemein.
 * Ein Satz ueber einen gesperrten Einsatzstart ist ein Sperrvorzustand und
 * keine Aussage ueber den Einsatz.
 */
const SIGNATUREN: ReadonlyArray<readonly [Sachverhaltsart, RegExp]> = [
  // Rahmenaussagen der Grundlage: sie tragen keine pruefbaren Daten.
  ['rahmenaussage', /liefert keine andere AÜG-Prüfung einen Befund|Angaben dieser Grundlage gelten|ist im VMS angelegt/],

  // Vorzustand: ein Uebergang ist bereits durch eine Pruefung gesperrt (SPEC 5.5.4).
  ['sperrvorzustand', /ist (?:seit dem \d{2}\.\d{2}\.\d{4} )?durch die Prüfung P\d+ gesperrt|wurde durch die Prüfung P\d+ gesperrt|ist durch die Prüfung P\d+ gesperrt/],

  // Voraussetzungen einer Uebersteuerung (SPEC 5.5.4).
  ['uebersteuerungsvoraussetzung', /nach richtiger Datenlage|Bedingungen für eine Übersteuerung sind erfüllt|unstreitig richtig|nicht möglich$|nicht möglich\b|besteht tatsächlich nicht|hat tatsächlich nicht stattgefunden|besteht nachweislich|liegt (?:dem Betreiber )?nachweislich vor|stammen nachweislich|nachweislich (?:ein|vom|bis|am)|Budget von \d+ Tagen ist ausgeschöpft/],

  // Rueckwirkende Aenderungen (SPEC 5.5.3).
  ['rueckwirkende_korrektur', /berichtigt|nachgetragen|nachträglich|wird .* geändert|dadurch wird eine Überschreitung|rückt dadurch|Nachtragung/],

  // Vorzustand der Pruefhistorie (SPEC 5.4.7).
  ['pruefvorzustand', /Prüfungen P\d.*gelaufen|wurde am \d{2}\.\d{2}\.\d{4} als Warnung mit Pflicht-Eskalation festgestellt|frühere Prüfergebnis/],

  // Kriterien der Konkretisierungspflicht (SPEC 5.3.3).
  ['kriterium', /\bKriterium\b|Kriterien K\d/],

  // Drehtuerklausel: Erklaerung zur Vorbeschaeftigung (SPEC 5.3.1).
  ['vorbeschaeftigung', /Vorbeschäftigung|Austrittsdatum|previousEmploymentDeclaration/],

  // Arbeitskampf (SPEC 5.3.2).
  ['arbeitskampfanzeige', /Arbeitskampf|Zusicherung nach § 11|betroffenen Bereiche|Bereich "Montage"/],

  // Erlaubnis des Verleihers (SPEC 5.4.1).
  ['erlaubnissatz', /Erlaubnissatz|Erlaubnisart|Nachfolgesatz|Anerkennungsstatus|unbefristete AÜG-Erlaubnis|Erlaubnis (?:ist|von|deckt|besteht|erlischt|war)|keine Erlaubnis|behördliche Verlängerung der Erlaubnis/],

  // Pflichtnachweise (SPEC 5.4.4) und Nachweisfluss (SPEC 5.4.3).
  ['nachweis', /Arbeitserlaubnis|Unterweisung|Unbedenklichkeitsbescheinigung|Qualifikationsnachweis|Erlaubnisurkunde|\bNachweis\b|\bUrkunde\b|hinterlegte Datei|fileRef|documentRef|Pflichtnachweise/],

  // Personenidentitaet als Schluessel der Kette (SPEC 5.0).
  ['personenidentitaet', /Personenidentität|Kandidatensätze?|maschinell .* verknüpft|Identitätsvorschlag|Kandidatensatz/],

  // Tarifwerte sind Konfiguration (SPEC 3.3).
  ['tarifzuordnung', /Tarifzuordnung|maxAssignmentDurationMonths|equalPayDeadlineMonths|Branchenzuschlagsschema|Regelfrist|Regelgrenze|Grenze (?:beträgt|von \d+ Monaten)|Zuschlagsstufe|Zuschlagsart/],

  // Vergleichsentgelt (SPEC 5.2.1).
  ['vergleichsentgelt', /Vergleichsentgelt|Herkunft "(?:collectiveAgreement|estimate)"/],

  // Fristenstand als abgeleitetes Feld (SPEC 5.1, 5.2).
  ['fristenstand', /Fristende|Equal-Pay-Fälligkeit|Restbudget|Tagebudget|Fristbudget|Equal Pay (?:war|ist) .* geschuldet|Fälligkeit (?:ist|liegt|rückt)/],

  // Unterbrechung und Drei-Monats-Regel (SPEC 5.1.3).
  ['unterbrechung', /[Uu]nterbrechung|unterbrochen|Wiederaufnahmetag|Wiederaufnahme|Lücke/],

  // Ueberlassungskette (SPEC 5.0).
  ['ueberlassungskette', /überlassen|Überlassungstage|angerechnete Dauer|Kettenbeginn|\bKette\b|Überlassungsbeginn|Überlassung (?:ab|von|wird|ist)/],

  // Stammdaten der Einkaufsseite (SPEC 3.1).
  ['entleiher', /\bEntleiher "|führt den Standort|beim Kunden "|Standort (?:"[^"]+" |)(?:ist|war|wird|verlangt)|desselben Kunden/],
  ['konzern', /Konzernverbund|Konzern\b/],

  // Stammdaten der Lieferantenseite (SPEC 3.2).
  ['rahmenvertrag', /Rahmenvertrag|Preisposition|agreedRateCardItemRef/],
  ['lieferant', /\bLieferant "|Lieferanten "|^"[^"]+" (?:steht im Status|wurde von|hat nur den)|Lieferant (?:ist aktiv|steht im Status)/],

  // Kandidat und Arbeitsverhaeltnis beim Verleiher (SPEC 3.6, 5.3.4).
  ['kandidat', /beschäftigt seit|Beschäftigungsverhältnis|Beschäftigungsdatum|\bKandidat\b|\bKandidaten\b|Arbeitsvertrag|"applicant"|im Status "inactive"/],

  // Taetigkeit und Konkretisierung (SPEC 5.3.3).
  ['taetigkeit', /Tätigkeit|Qualifikationsanforderung|\bTitel\b/],

  // Vorgaenge mit Status (SPEC Kapitel 4).
  ['vorgang', /Bedarfsanfrage|Ausschreibung|Einladung|Profilvorschlag|\bEinsatz\b|\bEinsätze\b|Verlängerung|Stundenzettel|Abrechnungsbeleg|Einkaufsbeleg|\bBeleg\b|steht (?:im|auf) ?"?(?:Status)?/],

  // Zeitraeume von Zettel, Beleg und Pruefung (SPEC 5.0).
  ['zeitraum', /Zeitposition|Zeitraum|Leistungszeitraum|Periode|geprüft werden|Angebotsfrist/],

  // Fristen der Vorgangssteuerung (SPEC 2.4).
  ['fristlauf', /Genehmigungsfrist|Freigabefrist|nicht entschieden|verstrichen|Freigabestufe|Freigabeschritte/],
]

/** Erfasst eine Vorbedingung als Sachverhalt. */
export function erfasseSachverhalt(satz: string): Sachverhalt {
  const werte = leseWerte(satz)
  for (const [art, signatur] of SIGNATUREN) {
    if (signatur.test(satz)) return { art, satz, werte }
  }
  return { art: 'sonstiges', satz, werte }
}
