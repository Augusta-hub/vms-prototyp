/**
 * Protokoll — SPEC **3.12** (Audit-Eintrag).
 *
 * Die Seite hat **kein Formular**. Das ist keine Auslassung, sondern die
 * Umsetzung von 3.12: „Audit-Einträge entstehen ausschließlich durch das System
 * und sind für jede Rolle unveränderlich — deshalb kein `Ä` und kein `X` in
 * 2.2 ([39])." Eine Zeile, die man ändern oder löschen könnte, wäre kein
 * Protokoll.
 *
 * Gezeigt wird, was die gewählte Testidentität sehen darf: `MA` alles (seine
 * Zelle trägt `L` ohne Fußnote), `MD` die Einträge zu Objekten des Betreibers
 * und der betreuten Kunden, `KE` und `LA` die der eigenen Organisation ([39]).
 * Dass `MD` damit die Einträge zu **Lieferanten** nicht sieht, obwohl 4.6 ihm
 * die Sperre zuweist, ist *offene Frage 46*.
 *
 * Oben steht die Lückenprüfung: 3.12 nennt Lücken in der Nummernfolge
 * ausdrücklich „ein Befund, kein Betriebszustand". Sie läuft über den **ganzen**
 * Bestand, nicht über die sichtbare Teilmenge — sonst wäre jede
 * Sichtbarkeitsregel ein Befund.
 */
import {
  AUDIT_OPERATION_LABELS,
  AUDIT_RESULT_LABELS,
  loadAuditEntries,
  pruefeLueckenlosigkeit,
  type AuditEntryView,
} from '../../lib/services/audit'
import { currentIdentity } from '../identity'
import { Status, Wert } from '../ui'

export const dynamic = 'force-dynamic'

function zeitpunkt(wert: Date): string {
  return wert.toISOString().slice(0, 16).replace('T', ' ')
}

export default async function ProtokollPage(): Promise<React.ReactNode> {
  const { identity, hint } = await currentIdentity()

  if (identity === null) {
    return (
      <>
        <h1>Protokoll</h1>
        <p className="hint">{hint}</p>
      </>
    )
  }

  const [entries, lueckenlosigkeit] = await Promise.all([
    loadAuditEntries(identity),
    pruefeLueckenlosigkeit(),
  ])

  return (
    <>
      <h1>Protokoll (SPEC 3.12)</h1>
      <p>
        Das <strong>fachliche</strong> Protokoll: wer hat wann an welchem Objekt welche Operation
        ausgeführt — in eigener Zuständigkeit oder in Vertretung. Nicht das technische Betriebslog;
        Server-, Netz- und Fehlerprotokolle sind nicht Gegenstand von 3.12.
      </p>
      <p>
        Protokolliert werden <strong>alle schreibenden Operationen</strong> (3.12, Nummer 1) samt
        abgelehnten Versuchen, die Offenlegung von <strong>Klardaten</strong> nach der Zusage
        (Nummer 3, 6.4) und der Zugriff auf einzeln geladene Objekte über die Mandantengrenze
        (Nummer 2). Lesezugriffe innerhalb des eigenen Mandanten auf nicht personenbezogene Daten
        werden ausdrücklich <strong>nicht</strong> protokolliert. In welcher Granularität Listen zu
        protokollieren sind, ist <em>offene Frage 45</em>; die Aufbewahrung ist <em>Frage 22</em>.
      </p>
      <p className="hint">
        Einträge sind unveränderlich. Diese Seite hat deshalb kein Formular, und die Datenbank
        verweigert <code>UPDATE</code> und <code>DELETE</code> auf der Tabelle über einen Trigger
        aus der Migration zu 3.12 — eine zweite Schicht neben der Matrix.
      </p>

      <h2>Lückenlosigkeit der Eintragsnummern</h2>
      <p>
        {lueckenlosigkeit.count === 0 ? (
          'Noch kein Eintrag vorhanden.'
        ) : (
          <>
            {lueckenlosigkeit.count} Eintrag/Einträge, Nummern {lueckenlosigkeit.lowest} bis{' '}
            {lueckenlosigkeit.highest}.{' '}
            {lueckenlosigkeit.missing.length === 0 ? (
              <strong>Keine Lücke.</strong>
            ) : (
              <strong className="fehler">
                Befund: {lueckenlosigkeit.missing.length} fehlende Nummer(n) —{' '}
                {lueckenlosigkeit.missing.slice(0, 20).join(', ')}
              </strong>
            )}
          </>
        )}
      </p>

      <h2>Einträge</h2>
      {entries.length === 0 ? (
        <p className="hint">
          Keine Einträge für diese Identität sichtbar. Das kann beides heißen: es gibt keine, oder
          Fußnote [39] zeigt sie dieser Rolle nicht (2.3 — sichtbar ist, was eine Regel ausdrücklich
          erlaubt).
        </p>
      ) : (
        <table>
          <caption>Neuester Eintrag zuerst; angezeigt werden höchstens 200.</caption>
          <thead>
            <tr>
              <th>Nr.</th>
              <th>Zeitpunkt</th>
              <th>Handelnder</th>
              <th>Funktion</th>
              <th>Objekt</th>
              <th>Operation</th>
              <th>Status</th>
              <th>Ergebnis</th>
              <th>Begründung / Regel</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => (
              <Zeile key={entry.id} entry={entry} />
            ))}
          </tbody>
        </table>
      )}
    </>
  )
}

function Zeile({ entry }: { readonly entry: AuditEntryView }): React.ReactNode {
  return (
    <tr>
      <td>{entry.entryNumber}</td>
      <td>{zeitpunkt(entry.occurredAt)}</td>
      <td>
        {entry.actor}
        {entry.delegationNote === null ? null : (
          <>
            <br />
            <span className="hint">{entry.delegationNote}</span>
          </>
        )}
        {entry.crossTenant ? (
          <>
            <br />
            <span className="hint">über die Mandantengrenze (2.3)</span>
          </>
        ) : null}
      </td>
      <td>
        <Wert value={entry.actingAs} />
      </td>
      <td>
        {entry.objectLabel}
        <br />
        <code>{entry.objectRef}</code>
        <br />
        <span className="hint">Mandant: {entry.tenant}</span>
      </td>
      <td>{AUDIT_OPERATION_LABELS[entry.operation]}</td>
      <td>
        {entry.statusFrom === null && entry.statusTo === null ? (
          <Wert value={null} />
        ) : (
          <>
            <Wert value={entry.statusFrom} /> → <Status value={entry.statusTo ?? '—'} />
          </>
        )}
        {entry.changedFields.length === 0 ? null : (
          <ul>
            {entry.changedFields.map((feld) => (
              <li key={feld.field}>
                <code>{feld.field}</code>: <Wert value={feld.from} /> → <Wert value={feld.to} />
              </li>
            ))}
          </ul>
        )}
      </td>
      <td>
        <Status value={AUDIT_RESULT_LABELS[entry.result]} />
      </td>
      <td>
        <Wert value={entry.reason} />
        {entry.ruleRef === null ? null : (
          <>
            <br />
            <span className="hint">Regel: {entry.ruleRef}</span>
          </>
        )}
      </td>
    </tr>
  )
}
