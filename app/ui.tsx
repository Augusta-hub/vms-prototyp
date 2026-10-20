/**
 * Kleine Bausteine der Oberfläche.
 *
 * `Wert` ist der wichtigste: er unterscheidet **drei** Fälle, weil die
 * Sichtbarkeitsregeln aus 2.3 sie unterscheiden — ein Feld ohne Wert, ein Feld
 * ohne Angabe und ein Feld, das diese Rolle **nicht sehen darf**. Das letzte
 * wird benannt und nicht als leer dargestellt: eine Fußnote aus 2.2 ist eine
 * Aussage, keine Lücke.
 */
import type { ReactNode } from 'react'

export function Meldung({
  ok,
  fehler,
}: {
  readonly ok?: string | undefined
  readonly fehler?: string | undefined
}): ReactNode {
  return (
    <>
      {ok !== undefined && ok !== '' ? <p className="meldung">{ok}</p> : null}
      {fehler !== undefined && fehler !== '' ? <p className="fehler">{fehler}</p> : null}
    </>
  )
}

/**
 * Ein Feldwert. `undefined` heißt: eine Fußnote der Zelle zeigt das Feld
 * dieser Rolle nicht (2.2, 2.3). `null` heißt: keine Angabe.
 */
export function Wert({ value }: { readonly value: string | null | undefined }): ReactNode {
  if (value === undefined) return <span className="verdeckt">nicht sichtbar</span>
  if (value === null || value === '') return <span className="verdeckt">—</span>
  return <>{value}</>
}

/** Die Felder, die eine Fußnote dieser Rolle nicht zeigt — ausdrücklich genannt. */
export function Verdeckt({ fields }: { readonly fields: readonly string[] }): ReactNode {
  if (fields.length === 0) return null
  return (
    <p className="hint">
      Für diese Rolle nicht sichtbar (SPEC 2.2, Fußnoten): <code>{fields.join(', ')}</code>
    </p>
  )
}

export function Status({ value }: { readonly value: string }): ReactNode {
  return <span className="status">{value}</span>
}
