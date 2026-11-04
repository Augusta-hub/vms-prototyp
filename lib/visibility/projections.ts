/**
 * Sichtbarkeit von **Feldern** (SPEC 2.3 und die Fußnoten aus 2.2).
 *
 * Die Prüffunktion in lib/authz/check.ts entscheidet, ob ein Vorgang überhaupt
 * zugänglich ist. Einige Fußnoten gehen weiter und beschränken, **welche
 * Felder** eine Rolle sieht: der Lieferant sieht die Anfrage „ohne
 * Kostenstelle, ohne interne Vermerke" ([14]), der Kunde sieht am Angebot die
 * fachlichen Inhalte, aber nicht die Einkaufskonditionen ([18], 3.3), und
 * Einkauf/Controlling sieht an der AÜG-Erlaubnis nur Gültigkeitsstatus und
 * Ablaufdatum ([36], 3.2).
 *
 * Diese Datei ist die **eine** Stelle, an der aus einer Entscheidung die
 * sichtbare Fassung eines Vorgangs wird. Die Felder stehen nicht hier, sondern
 * an ihrer Fußnote in lib/authz/footnotes.ts — damit Recht und
 * Feldeinschränkung nicht auseinanderlaufen.
 *
 * Auch die **Datenminimierung aus 6.4** läuft über diesen Weg und nicht über
 * eine eigene Mechanik: Fußnote [23] verdeckt am Profilvorschlag die Klardaten
 * des Kandidaten, solange die Offenlegungsstufe `pseudonymized` ist, und gibt
 * sie nach der Zusage frei (3.6, 4.2.3). Welche Felder das sind, entscheidet
 * die Fußnote am konkreten Vorgang; `checkPermission` legt das Ergebnis als
 * `concealedFields` an die Entscheidung.
 *
 * Grundsatz aus 2.3: sichtbar ist, was eine Regel ausdrücklich erlaubt. Ohne
 * erlaubte Entscheidung gibt es deshalb **keine** Fassung, auch keine leere.
 */
import type { Decision } from '../authz/check'

/** Die Felder, die diese Entscheidung aus einer gelesenen Fassung entfernt. */
export function concealedFields(decision: Decision): readonly string[] {
  if (!decision.allowed) return []
  return decision.concealedFields
}

/**
 * Die sichtbare Fassung eines Vorgangs für diese Entscheidung, oder `null`,
 * wenn der Zugriff verweigert ist.
 *
 * Entfernt werden die Felder der Fußnoten der Zelle — flach und auf jedem
 * übergebenen Objekt. Unterobjekte (Angebotspositionen, Anforderungen) werden
 * **einzeln** projiziert, mit derselben Entscheidung: sie teilen nach 2.2 die
 * Zeile ihres Hauptobjekts und damit dessen Fußnoten.
 */
export function project<T extends object>(value: T, decision: Decision): Partial<T> | null {
  if (!decision.allowed) return null
  const concealed = new Set(concealedFields(decision))
  if (concealed.size === 0) return { ...value }
  const visible: Record<string, unknown> = {}
  for (const [key, field] of Object.entries(value)) {
    if (concealed.has(key)) continue
    visible[key] = field
  }
  return visible as Partial<T>
}

/** `project` über eine Liste; eine verweigerte Entscheidung ergibt `null`. */
export function projectAll<T extends object>(
  values: readonly T[],
  decision: Decision,
): readonly Partial<T>[] | null {
  if (!decision.allowed) return null
  return values.map((value) => project(value, decision) as Partial<T>)
}

/**
 * Trägt die Fassung ein bestimmtes Feld? Für Oberflächen und Tests, die
 * belegen, dass ein Feld **nicht** sichtbar ist.
 */
export function shows(value: object, field: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, field)
}
