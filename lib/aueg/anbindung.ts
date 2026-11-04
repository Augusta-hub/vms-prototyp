/**
 * Anbindung von P9 an die Übergänge, die 4.7 ihr zuordnet.
 *
 * Die Statusmodelle in `lib/status/` führen die Vorbedingung aus 5.4 schon als
 * **Tatsache**: `TenderInvitationFacts.hasAcceptedValidPermit` (Q06) und
 * `InvitedSupplierFact.hasAcceptedValidPermit` (Q04) tragen den Kommentar
 * „Erlaubnis anerkannt **und** am Stichtag gültig (5.4, Prüfung P9)". Wer
 * diesen Wert setzt, war bisher offen — ein Boolescher Wert, den irgendwer von
 * Hand füllt, ist genau die stille Lücke, die 5.0 verbietet („kein stilles
 * Durchlassen").
 *
 * Dieses Modul schließt sie: der Wert wird aus den Erlaubnissätzen (3.2)
 * **gerechnet**, mit demselben Rechenweg, den die Gherkin-Suite prüft. Der
 * Aufrufer, der die Tatsachen für einen Übergang zusammenstellt, nimmt ihn von
 * hier und nicht aus einem Feld.
 *
 * **Angebunden sind Q04 und Q06** — die beiden Übergänge, für die es in
 * `lib/status/` ein Statusmodell gibt (4.1 Bedarfsanfrage, 4.2.1 Einladung).
 * Für Q16, Q20 (Einsatz, 4.3), Q31 (Verlängerung, 4.3.2) und Q38 (Beleg, 4.5)
 * sowie Q41, Q43 und Q44 (Lieferantenstatus, 4.6) gibt es **noch keine**
 * Übergangsmenge; dort bleibt die Anbindung offen und wird hier nicht
 * vorgebaut. Das Prüfwerk rechnet diese Zeilen bereits, nur hängt noch kein
 * Übergang daran.
 */

import { pruefeErlaubnis, type Erlaubnissatz, type Zeitraum } from './regeln/p9Erlaubnis'
import type { Tag } from './kalender'

/**
 * Deckt die AÜG-Erlaubnis des Lieferanten den ganzen Zeitraum — anerkannt, mit
 * hinterlegter Urkunde, an **jedem** Tag (5.4.1, Schritte 2 bis 4)?
 *
 * Das ist der Wert für `hasAcceptedValidPermit` an Q04 und Q06. Für Q06 ist der
 * Zeitraum nach 5.0 der Tag des Übergangs bis zur Angebotsfrist — nicht nur der
 * Stichtag: eine Einladung, deren Erlaubnis vor dem Ende der Angebotsfrist
 * abläuft, ist nach 4.7 Q04 gesperrt.
 */
export function hatAnerkannteGueltigeErlaubnis(
  saetze: readonly Erlaubnissatz[],
  zeitraum: Zeitraum,
  lieferant = '(Lieferant)',
): boolean {
  return pruefeErlaubnis({ lieferant, saetze, zeitraum, unterbrechungen: [] }).gedeckt
}

/**
 * Derselbe Wert für einen einzelnen Stichtag — die Kurzform für die Übergänge,
 * denen 5.0 einen Stichtag und keinen Prüfzeitraum zuordnet.
 */
export function hatErlaubnisAmStichtag(
  saetze: readonly Erlaubnissatz[],
  stichtag: Tag,
  lieferant = '(Lieferant)',
): boolean {
  return hatAnerkannteGueltigeErlaubnis(saetze, { von: stichtag, bis: stichtag }, lieferant)
}
