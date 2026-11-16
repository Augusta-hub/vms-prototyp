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
import { REGELWERK } from '../../lib/aueg/regelwerk'
import {
  ladeLaufstand,
  laufAusfallstufe,
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
  // Der Zeitplan ist Festwert des Regelwerks (5.5.1); der Stand sagt, ob ein
  // Lauf aussteht und welche Tage ausgefallen sind.
  const stand = darfLaufen ? await ladeLaufstand() : null

  return (
    <>
      <h1>Benachrichtigungen (SPEC 3.14, 2.4, 5.5.1)</h1>
      <p>
        Eine Benachrichtigung <strong>ändert nichts</strong>. Sie genehmigt nicht, verlängert
        nicht und besetzt nicht — Fristablauf erzeugt Aufmerksamkeit, nie einen Statuswechsel
        (2.4, Regel 1). Adressiert wird eine <strong>Rolle in einer Organisation</strong>, nicht
        eine Person: wer sie gerade trägt, steht in den Rollenzuweisungen (3.11).
      </p>
      <p>
        Zwei Quellen führen hierher. Der <strong>nächtliche Lauf</strong> prüft die Vorgänge, bei
        denen Zeit allein die Lage ändert (5.5.1 c). Jeder <strong>Übergang</strong> aus Kapitel 4
        erzeugt die Nachrichten, die seine Spalte „Nebenwirkungen" nennt — und nur die: wo dort
        nichts steht, entsteht keine. Eine Nachricht aus einem Übergang trägt den Statuswechsel
        und keinen Lauftag.
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

      {stand === null ? null : (
        <>
          <h2>Zeitplan (5.5.1)</h2>
          <p>
            Fällig ist der Lauf eines Kalendertages um{' '}
            <strong>{REGELWERK.lauf.uhrzeit}</strong> in der Zeitzone{' '}
            <strong>{REGELWERK.lauf.zeitzone}</strong> — beides Festwerte des Regelwerks (5.0,
            5.5.1), keine Zahl im Dienst. Der <strong>Stichtag</strong> ist der Kalendertag
            dieser Zone, nicht der nach Weltzeit.
          </p>
          <table>
            <tbody>
              <tr>
                <th>fälliger Stichtag</th>
                <td>
                  <Wert value={stand.stichtag.toISOString().slice(0, 10)} />{' '}
                  {stand.offen ? <Status value="steht aus" /> : <Status value="gelaufen" />}
                </td>
              </tr>
              <tr>
                <th>fällig seit</th>
                <td>{stand.faelligSeit.toISOString().slice(0, 16).replace('T', ' ')} UTC</td>
              </tr>
              <tr>
                <th>nächste Fälligkeit</th>
                <td>
                  {stand.naechsteFaelligkeit.toISOString().slice(0, 16).replace('T', ' ')} UTC
                </td>
              </tr>
              <tr>
                <th>ausgefallen</th>
                <td>
                  {stand.ausgefalleneTage === 0 ? (
                    '—'
                  ) : (
                    <>
                      <strong>{stand.ausgefalleneTage}</strong> Tag(e):{' '}
                      {stand.ausgefallen.map((tag) => tag.toISOString().slice(0, 10)).join(', ')}
                      {stand.ausgefallen.length < stand.ausgefalleneTage ? ' …' : ''}{' '}
                      <Status
                        value={
                          laufAusfallstufe(stand) === 'warnung' ? 'Warnung (5.5.1)' : 'Information'
                        }
                      />
                    </>
                  )}
                </td>
              </tr>
            </tbody>
          </table>
          <p className="hint">
            Ein <strong>ausgefallener Lauf wird nicht nachgeholt</strong> (5.5.1): der Stichtag
            ist der Tag des Laufs, ein Lauf von heute kann nicht der von gestern sein. Fachlich
            ist das verkraftbar — N1 bis N6 prüfen <em>Spannen</em>, keine Kanten, und was
            gestern fällig war, findet der Lauf von heute noch. Der ausgefallene Tag wird
            deshalb nicht erzeugt, sondern <strong>ausgewiesen</strong> — und von dem Lauf
            gemeldet, der die Lücke schließt: ab einem Tag als Information an <code>MD</code>,
            ab {REGELWERK.lauf.ausfallWarnungTage} Tagen als Warnung mit Eskalation an{' '}
            <code>MA</code> (5.5.1, 2.4). <strong>Sein eigenes Schweigen kann das System
            nicht melden</strong>: bleibt der Lauf weg, bleibt auch die Nachricht weg. Wer den
            Ausfall <em>während</em> des Ausfalls bemerken will, braucht eine Überwachung
            außerhalb — <code>GET /api/naechtlicher-lauf</code> gibt ihr Stichtag, ausgefallene
            Tage und Stufe aus, ohne etwas auszulösen. Das System führt{' '}
            <strong>keine eigene Uhr</strong>: ein Planer außerhalb ruft zur Fälligkeitszeit
            <code> POST /api/naechtlicher-lauf</code> auf. Welcher Planer das ist, hängt vom
            Hoster ab (<em>offene Frage 2</em>).
          </p>
        </>
      )}

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
      <td>
        {NOTIFICATION_TRIGGER_LABELS[nachricht.trigger] ?? nachricht.trigger}
        {nachricht.statusTo === null ? null : (
          <>
            <br />
            <span className="hint">
              <code>{nachricht.statusFrom ?? '—'}</code> → <code>{nachricht.statusTo}</code>
            </span>
          </>
        )}
      </td>
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
