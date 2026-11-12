/**
 * Benachrichtigungen — SPEC 3.14 (Objekt), 2.4 (Eskalation) und 5.5.1 c
 * (nächtlicher Lauf).
 *
 * Die Seite zeigt, was die gewählte Testidentität an Nachrichten erhält —
 * **nur** die, die an ihre Rollenzuweisung gerichtet sind ([47]). Der
 * Betreiberadministrator sieht das Aufkommen des Betriebs, wie er das
 * Protokoll sieht ([39]).
 *
 * Drei Dinge macht sie ausdrücklich sichtbar, weil sie fachlich tragen:
 *
 *  - die **Stufe** je Nachricht: sie kommt aus der Restzeit (5.4.4, 5.1.6),
 *    nicht aus einem Takt — die kumulativen Adressaten sind der Grund, warum
 *    dieselbe Lage an `LA`, `LD` und `MD` zugleich geht,
 *  - dass der Lauf **nichts ändert**: kein Statuswechsel, keine Sperre, keine
 *    Genehmigungsfiktion,
 *  - die **Läufe selbst**, damit „nichts gemeldet" von „nicht gelaufen" zu
 *    unterscheiden ist.
 */
import {
  loadNightlyRuns,
  loadNotifications,
  mayRunNightly,
  NOTIFICATION_TRIGGER_LABELS,
  type NotificationView,
} from '../../lib/services/nightly'
import { currentIdentity } from '../identity'
import { Meldung, Status, Wert } from '../ui'
import { runNightlyAction } from './actions'

export const dynamic = 'force-dynamic'

export default async function BenachrichtigungenPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; fehler?: string }>
}) {
  const params = await searchParams
  const { identity, hint } = await currentIdentity()

  if (identity === null) {
    return (
      <>
        <h1>Benachrichtigungen</h1>
        <p className="hint">{hint}</p>
      </>
    )
  }

  const [notifications, runs, darfLaufen] = await Promise.all([
    loadNotifications(identity),
    loadNightlyRuns(identity),
    mayRunNightly(identity),
  ])

  return (
    <>
      <h1>Benachrichtigungen (SPEC 3.14, 2.4, 5.5.1)</h1>
      <p>
        Eine Benachrichtigung <strong>ändert nichts</strong>. Sie genehmigt nicht, verlängert
        nicht und besetzt nicht — Fristablauf erzeugt Aufmerksamkeit, nie einen Statuswechsel
        (2.4, Regel 1). Adressiert wird eine <strong>Rolle in einer Organisation</strong>, nicht
        eine Person: wer sie gerade trägt, steht in den Rollenzuweisungen (3.11).
      </p>
      <p className="hint">
        Die <strong>Stufe</strong> kommt bei den Anlässen aus Kapitel 5 aus der Restzeit: 5.4.4
        und 5.1.6 nennen Vorlaufwerte je Stufe, und die Adressaten sind kumulativ — die Warnung
        geht <em>zusätzlich</em> an <code>LD</code>, nicht statt an <code>LA</code>. Für die
        Prozessfristen aus 4.0 gibt es nur einen Termin; in welchem Abstand dort die nächste
        Stufe folgt, ist <em>offene Frage 57</em>. Zugestellt wird nichts — ob per E-Mail, im
        System oder beides, ist <em>offene Frage 56</em>.
      </p>

      <Meldung ok={params.ok} fehler={params.fehler} />

      {darfLaufen ? (
        <form action={runNightlyAction}>
          <p>
            <button type="submit">nächtlichen Lauf anstoßen (5.5.1)</button>{' '}
            <span className="hint">
              Stichtag ist der Tag des Laufs. Er prüft die Vorgänge, bei denen{' '}
              <strong>Zeit allein</strong> die Lage ändert — N1, N2, N3, N5 und N6 — und die
              Fristanlässe aus 2.4. <strong>N4 fehlt</strong>: für die Arbeitskampfanzeige führt
              Kapitel 3 kein Feld (offene Frage 30).
            </span>
          </p>
        </form>
      ) : null}

      <h2>Läufe (5.5.1 c)</h2>
      {runs.length === 0 ? (
        <p className="hint">
          Kein Lauf verzeichnet. Das ist der Grund, warum es diese Tabelle gibt: ohne sie wäre
          „nichts gemeldet" nicht von „nicht gelaufen" zu unterscheiden — und bei einem
          Verfahren, das Fristen überwacht, ist das der wichtigere der beiden Fälle.
        </p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Stichtag</th>
              <th>gestartet</th>
              <th>geprüft</th>
              <th>Information</th>
              <th>Warnung</th>
              <th>mit Eskalation</th>
              <th>neue Nachrichten</th>
            </tr>
          </thead>
          <tbody>
            {runs.map((lauf) => (
              <tr key={lauf.runDate}>
                <td>{lauf.runDate}</td>
                <td>{lauf.startedAt}</td>
                <td>{lauf.checked}</td>
                <td>{lauf.informations}</td>
                <td>{lauf.warnings}</td>
                <td>{lauf.escalations}</td>
                <td>{lauf.notifications}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <h2>Nachrichten (3.14)</h2>
      {notifications.length === 0 ? (
        <p className="hint">
          Keine Benachrichtigung für diese Identität. Das kann beides heißen: es gibt keine, oder
          sie sind an andere Rollenzuweisungen gerichtet ([47], 2.3).
        </p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Art</th>
              <th>Anlass</th>
              <th>Stufe</th>
              <th>Rolle</th>
              <th>Prüfung</th>
              <th>Vorgang</th>
              <th>Lauf</th>
              <th>Meldung</th>
            </tr>
          </thead>
          <tbody>
            {notifications.map((nachricht) => (
              <Nachricht key={nachricht.id} nachricht={nachricht} />
            ))}
          </tbody>
        </table>
      )}
    </>
  )
}

function Nachricht({ nachricht }: { readonly nachricht: NotificationView }) {
  return (
    <tr>
      <td>
        <Status value={nachricht.kindLabel} />
      </td>
      <td>{NOTIFICATION_TRIGGER_LABELS[nachricht.trigger] ?? nachricht.trigger}</td>
      <td>{nachricht.escalationLevel}</td>
      <td>
        <code>{nachricht.recipientRoleCode}</code>
      </td>
      <td>
        <Wert value={nachricht.ruleRef} />
      </td>
      <td>
        <code>{nachricht.objectType}</code>
        <br />
        <span className="hint">{nachricht.objectRef}</span>
      </td>
      <td>
        <Wert value={nachricht.runDate} />
      </td>
      <td>
        {nachricht.message}
        {nachricht.crossTenant ? (
          <>
            <br />
            <span className="hint">Zugriff über die Mandantengrenze (2.3) — protokolliert</span>
          </>
        ) : null}
      </td>
    </tr>
  )
}
