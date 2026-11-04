/**
 * Abgleich der Personenidentität — SPEC 3.6, Entscheidung zu vormals offener
 * Frage 18.
 *
 * Die Entscheidung ist in vier Punkten eng, und dieses Modul setzt genau sie
 * um:
 *
 *  1. **Der Abgleich schlägt vor, er verknüpft nicht selbst.** Dieses Modul
 *     gibt Vorschläge zurück und schreibt nichts. Jede Verknüpfung bestätigt
 *     eine Person beim Betreiber (`confirmedAt`, `confirmedBy`); ein
 *     maschineller Treffer allein löst keine AÜG-Prüfung aus (4.2.3,
 *     „Grundlage von P1 und P6").
 *  2. **Der Merkmalssatz ist abschließend:** Name, Geburtsdatum, Geburtsort.
 *     Keine Sozialversicherungsnummer, keine Steuer-Identifikationsnummer,
 *     keine Ausweisnummer. Der Typ `MatchingAttributes` trägt deshalb genau
 *     diese vier Felder — mehr ist nicht ausdrückbar.
 *  3. **Die Zweckbindung ist eng:** ausschließlich die Prüfungen aus 5.1, 5.2
 *     und 5.3 sowie die Erkennung von Doppelvorschlägen (2.3, Regel 4). Keine
 *     Nutzung für Auswertungen, Bewertungen oder Lieferantenvergleiche.
 *  4. **Kunden und Lieferanten sehen das Ergebnis nicht** ([43]). Dieses Modul
 *     wird deshalb nur aus dem Betreiberteil der Dienste aufgerufen; die
 *     Prüffunktion verweigert die Zeile allen anderen Rollen.
 *
 * **Kein unscharfer Abgleich.** Verglichen wird nach Normalisierung
 * (Leerraum, Groß- und Kleinschreibung) auf **Gleichheit**. Eine
 * Ähnlichkeitsrechnung würde Treffer erzeugen, die eine Person beim Betreiber
 * nicht nachprüfen kann — und ein unbestätigter Treffer hat nach 3.6 ohnehin
 * keine Wirkung. Namensabweichungen sind damit bewusst kein Treffer, sondern
 * ein Fall für die manuelle Zusammenführung.
 */

/** Der **abschließende** Merkmalssatz aus 3.6. */
export interface MatchingAttributes {
  readonly givenName: string
  readonly familyName: string
  readonly dateOfBirth: Date
  /**
   * Geburtsort. Am Kandidaten optional (3.6); fehlt er auf einer Seite, bleibt
   * der Vorschlag auf Name und Geburtsdatum gestützt und sagt das.
   */
  readonly placeOfBirth: string | null
}

/** Ein Kandidatensatz, wie der Abgleich ihn braucht (3.6). */
export interface CandidateForMatching extends MatchingAttributes {
  readonly candidateId: string
  readonly supplierId: string
  /** Bereits **bestätigt** verknüpfte Identität, falls vorhanden. */
  readonly workerIdentityId: string | null
}

/** Stärke eines Vorschlags — die Grundlage, auf der er beruht. */
export type MatchStrength = 'allAttributes' | 'withoutPlaceOfBirth'

/**
 * Ein **Vorschlag**, nicht eine Verknüpfung. `basis` ist der Satz, den die
 * bestätigende Person beim Betreiber vor sich hat (`proposalBasis`, 3.6).
 */
export interface MatchProposal {
  readonly candidateId: string
  readonly otherCandidateId: string
  readonly strength: MatchStrength
  readonly basis: string
}

/** Vergleichsform: Leerraum zusammengezogen, Groß- und Kleinschreibung egal. */
function normalize(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLocaleLowerCase('de-DE')
}

function sameDay(left: Date, right: Date): boolean {
  return (
    left.getUTCFullYear() === right.getUTCFullYear() &&
    left.getUTCMonth() === right.getUTCMonth() &&
    left.getUTCDate() === right.getUTCDate()
  )
}

function day(value: Date): string {
  return value.toISOString().slice(0, 10)
}

/**
 * Treffen zwei Kandidatensätze nach dem abschließenden Merkmalssatz
 * aufeinander? `null` heißt „kein Treffer" — und das ist der Regelfall.
 *
 * Name und Geburtsdatum müssen **beide** gleich sein; ein Geburtsort, der auf
 * beiden Seiten vorliegt und verschieden ist, widerlegt den Treffer.
 */
export function compareAttributes(
  left: MatchingAttributes,
  right: MatchingAttributes,
): { readonly strength: MatchStrength; readonly basis: string } | null {
  if (normalize(left.familyName) !== normalize(right.familyName)) return null
  if (normalize(left.givenName) !== normalize(right.givenName)) return null
  if (!sameDay(left.dateOfBirth, right.dateOfBirth)) return null

  const name = `${left.givenName} ${left.familyName}`
  if (left.placeOfBirth !== null && right.placeOfBirth !== null) {
    if (normalize(left.placeOfBirth) !== normalize(right.placeOfBirth)) return null
    return {
      strength: 'allAttributes',
      basis: `Name „${name}", Geburtsdatum ${day(left.dateOfBirth)} und Geburtsort „${left.placeOfBirth}" stimmen überein.`,
    }
  }
  return {
    strength: 'withoutPlaceOfBirth',
    basis:
      `Name „${name}" und Geburtsdatum ${day(left.dateOfBirth)} stimmen überein; der Geburtsort ` +
      'liegt nicht auf beiden Seiten vor und konnte nicht verglichen werden.',
  }
}

/**
 * Vorschläge für **einen** Kandidatensatz gegen alle anderen.
 *
 * Verglichen wird nur **lieferantenübergreifend**: 3.6 begründet das Objekt mit
 * Kandidatensätzen „verschiedener Lieferanten". Zwei Sätze desselben
 * Lieferanten sind eine Doppelerfassung in **seinen** Daten und keine Frage der
 * Personenidentität — der Betreiber würde sie sonst für ihn bereinigen und
 * dabei Daten zusammenführen, die er nicht pflegt.
 */
export function proposalsFor(
  candidate: CandidateForMatching,
  others: readonly CandidateForMatching[],
): readonly MatchProposal[] {
  const proposals: MatchProposal[] = []
  for (const other of others) {
    if (other.candidateId === candidate.candidateId) continue
    if (other.supplierId === candidate.supplierId) continue
    const match = compareAttributes(candidate, other)
    if (match === null) continue
    proposals.push({
      candidateId: candidate.candidateId,
      otherCandidateId: other.candidateId,
      strength: match.strength,
      basis: match.basis,
    })
  }
  return proposals
}

/**
 * Alle Vorschläge über einen Bestand — je Paar **einmal**, damit derselbe
 * Treffer nicht zweimal zur Bestätigung vorgelegt wird.
 */
export function allProposals(
  candidates: readonly CandidateForMatching[],
): readonly MatchProposal[] {
  const proposals: MatchProposal[] = []
  for (let index = 0; index < candidates.length; index += 1) {
    const candidate = candidates[index]
    if (candidate === undefined) continue
    for (const other of candidates.slice(index + 1)) {
      if (other.supplierId === candidate.supplierId) continue
      const match = compareAttributes(candidate, other)
      if (match === null) continue
      proposals.push({
        candidateId: candidate.candidateId,
        otherCandidateId: other.candidateId,
        strength: match.strength,
        basis: match.basis,
      })
    }
  }
  return proposals
}

/**
 * Gilt dieser Kandidatensatz als dieselbe Person wie ein anderer — also
 * **bestätigt** verknüpft?
 *
 * Das ist die Frage, die 5.1, 5.2 und 5.3 stellen, und sie hat genau eine
 * Antwort: zwei Sätze zählen zusammen, wenn **beide** auf dieselbe bestätigte
 * Identität verweisen. Ein nur vorgeschlagener Treffer zählt nicht — bis zur
 * Bestätigung ist jeder Kandidatensatz eine eigene Person (4.2.3).
 */
export function isSamePerson(
  left: Pick<CandidateForMatching, 'workerIdentityId'>,
  right: Pick<CandidateForMatching, 'workerIdentityId'>,
): boolean {
  return left.workerIdentityId !== null && left.workerIdentityId === right.workerIdentityId
}
