/**
 * Zeiten — SPEC 3.8 (Objekte) und 4.4 (Statusmodell).
 *
 * Die Seite zeigt, was die gewählte Testidentität sehen und auslösen darf: der
 * Lieferant erfasst und reicht ein ([27], [20]), die Kundenseite entscheidet
 * ihre Stufe ([29]), der Betreiber die seine. Welche Stufen es gibt, steht in
 * der Konfiguration des Kunden (3.1) — nicht hier.
 *
 * Drei Dinge macht die Seite ausdrücklich sichtbar, weil sie fachlich tragen:
 *
 *  - die **Erfassungsform** je Position (Tagessumme oder Abschnitt) und die
 *    **Herkunft** jedes Zuschlags (abgeleitet oder angegeben) — Entscheidung
 *    zu *Frage 16*,
 *  - die **Stufenfolge** mit Seite, Rolle und Entscheidung je Stufe, damit
 *    erkennbar ist, dass die Betreiberstufe hinzutritt und nichts ersetzt,
 *  - die **Befunde** aus Kapitel 5 zur Zeile, die als Nächstes greift (4.7) —
 *    eine Sperre soll man sehen, bevor man sie auslöst (5.4.6).
 *
 * Eine **Abwesenheitsart** gibt es nicht: erfasst werden ausschließlich
 * produktive Zeiten (Entscheidung zu *Frage 21*).
 */
import {
  loadTimesheetOptions,
  loadTimesheets,
  type TimesheetView,
} from '../../lib/services/timesheets'
import { currentIdentity } from '../identity'
import { Meldung, Status, Wert } from '../ui'
import {
  addTimeEntryAction,
  createCorrectionAction,
  createTimesheetAction,
  decideStageAction,
  removeTimeEntryAction,
  reworkTimesheetAction,
  submitTimesheetAction,
} from './actions'

export const dynamic = 'force-dynamic'

export default async function ZeitenPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; fehler?: string }>
}) {
  const params = await searchParams
  const { identity, hint } = await currentIdentity()

  if (identity === null) {
    return (
      <>
        <h1>Zeiten</h1>
        <p className="hint">{hint}</p>
      </>
    )
  }

  const [timesheets, options] = await Promise.all([
    loadTimesheets(identity),
    loadTimesheetOptions(identity),
  ])

  return (
    <>
      <h1>Zeiten (SPEC 3.8, 4.4)</h1>
      <p>
        Stundenzettel, Zeitposition, Freigabeschritt und Zuschlagsart. Der Zettel ist der
        Gegenstand der Genehmigung — die Zeitposition trägt <strong>keinen</strong> eigenen Status
        (Fußnote [44]). Erfasst werden <strong>ausschließlich produktive Zeiten</strong>: eine
        Abwesenheitsart gibt es nicht, und damit entsteht hier kein Gesundheitsdatum nach Art. 9
        DSGVO.
      </p>
      <p className="hint">
        Eine Position ist <strong>entweder</strong> eine Tagessumme <strong>oder</strong> ein
        Abschnitt mit Beginn und Ende. Die Form entscheidet, welche Zuschläge sich{' '}
        <strong>ableiten</strong> lassen: aus einer Tagessumme folgt kein Nachtzuschlag — er wäre
        anzugeben, und steht dann als <code>angegeben</code> in der Liste. Gerundet wird nicht
        (offene Frage 48).
      </p>
      <Meldung ok={params.ok} fehler={params.fehler} />

      <h2>Stundenzettel</h2>
      {timesheets.length === 0 ? (
        <p className="hint">
          Keine Stundenzettel für diese Identität sichtbar. Das kann beides heißen: es gibt keine,
          oder die Mandantengrenze und die Fußnoten aus 2.2 zeigen sie dieser Rolle nicht (2.3).
        </p>
      ) : (
        timesheets.map((zettel) => <Zettel key={zettel.id} zettel={zettel} />)
      )}

      <h2>Anlegen (4.4, — → erfasst)</h2>
      {!options.mayCreate ? (
        <p className="hint">
          Diese Rolle legt keine Stundenzettel an. Nach 2.2 tun das <code>AN</code> (offene Frage
          4), <code>LD</code> und <code>MD</code> im Namen des Leiharbeitnehmers ([27]).
        </p>
      ) : options.periods.length === 0 ? (
        <p className="hint">
          Keine offene Abrechnungsperiode. Ohne sie wird nicht erfasst (3.9, 4.4).
        </p>
      ) : (
        <form action={createTimesheetAction}>
          <p>
            <label htmlFor="assignmentId">Einsatz: </label>
            <select id="assignmentId" name="assignmentId" required>
              {options.assignments.map((einsatz) => (
                <option key={einsatz.id} value={einsatz.id}>
                  {einsatz.label}
                </option>
              ))}
            </select>{' '}
            <label htmlFor="billingPeriodId">Periode: </label>
            <select id="billingPeriodId" name="billingPeriodId" required>
              {options.periods.map((periode) => (
                <option key={periode.id} value={periode.id}>
                  {periode.label}
                </option>
              ))}
            </select>{' '}
            <button type="submit">Stundenzettel anlegen</button>
          </p>
          <p className="hint">
            Der Zeitraum des Zettels ist der Schnitt aus Periode und Einsatz: ein Einsatz, der
            mitten in der Periode beginnt, trägt keine Zeiten davor.
          </p>
        </form>
      )}

      <h2>Zuschlagsarten (3.8, Katalog)</h2>
      {options.premiumTypes.length === 0 ? (
        <p className="hint">Kein Katalog sichtbar — die Zeile zu 3.8 gibt dieser Rolle kein `L`.</p>
      ) : (
        <table>
          <caption>
            Die <strong>Ableitungsgrundlage</strong> sagt, woraus sich die Zuschlagsstunden rechnen
            lassen. <code>weeklyTotal</code> und <code>manual</code> sind aus einer einzelnen
            Position nie ableitbar; <code>calendarDay</code> ohne Wochentage — der Feiertag — auch
            nicht (offene Frage 51).
          </caption>
          <thead>
            <tr>
              <th>Kürzel</th>
              <th>Bezeichnung</th>
              <th>Ableitungsgrundlage</th>
            </tr>
          </thead>
          <tbody>
            {options.premiumTypes.map((art) => (
              <tr key={art.id}>
                <td>
                  <code>{art.code}</code>
                </td>
                <td>{art.name}</td>
                <td>
                  <code>{art.derivationBasis}</code>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

    </>
  )
}

function Zettel({ zettel }: { readonly zettel: TimesheetView }) {
  const stufeOffen = zettel.approvals.find((stufe) => stufe.decision === null)
  const kannEntscheiden = zettel.availableTransitions.some(
    (uebergang) =>
      uebergang.name === 'approve' ||
      uebergang.name === 'approveStage' ||
      uebergang.name === 'reject',
  )
  const kannEinreichen = zettel.availableTransitions.some(
    (uebergang) => uebergang.name === 'submit',
  )
  const kannNacharbeiten = zettel.availableTransitions.some(
    (uebergang) => uebergang.name === 'rework',
  )
  // Eine Korrekturfassung entsteht nur zu einem **genehmigten** Zettel und nur
  // einmal (4.4, 3.13). Sie ist ein eigener Vorgang und deshalb kein Übergang
  // in `availableTransitions`: für sie gilt `A`, nicht `Ä` ([28]).
  const kannKorrigieren = zettel.status === 'approved' && !zettel.hasCorrection

  return (
    <section>
      <h3>
        {zettel.timesheetNumber} <Status value={zettel.statusLabel} />
      </h3>
      <p>
        Einsatz {zettel.assignmentNumber} · {zettel.candidate} · {zettel.customer} ·{' '}
        {zettel.supplier}
        <br />
        Zeitraum {zettel.period} in Periode {zettel.periodNumber} (
        {zettel.periodStatus === 'open' ? 'offen' : 'geschlossen'}) · erfasst von{' '}
        {zettel.recordedBy}
        <br />
        <strong>{zettel.totalHours.toFixed(2)} Stunden</strong>
        {zettel.totalPremiumHours.length === 0
          ? ''
          : ` · Zuschläge: ${zettel.totalPremiumHours
              .map((summe) => `${summe.code} ${summe.hours.toFixed(2)} h`)
              .join(', ')}`}
        {zettel.crossTenant ? (
          <>
            <br />
            <span className="hint">Zugriff über die Mandantengrenze (2.3) — protokolliert</span>
          </>
        ) : null}
        {zettel.isCorrectionOf === null ? null : (
          <>
            <br />
            <span className="hint">Korrekturfassung eines früheren Zettels ([28], 4.4)</span>
          </>
        )}
      </p>

      <table>
        <caption>Zeitpositionen (3.8)</caption>
        <thead>
          <tr>
            <th>Tag</th>
            <th>Form</th>
            <th>Beginn</th>
            <th>Ende</th>
            <th>Pause</th>
            <th>Stunden</th>
            <th>Zuschläge</th>
            <th>Bemerkung</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {zettel.entries.length === 0 ? (
            <tr>
              <td colSpan={9}>
                Keine Position. Ein Zettel ohne Position lässt sich nicht einreichen (4.4).
              </td>
            </tr>
          ) : (
            zettel.entries.map((position) => (
              <tr key={position.id}>
                <td>{position.workDate}</td>
                <td>
                  <code>{position.form === 'interval' ? 'Abschnitt' : 'Tagessumme'}</code>
                </td>
                <td>
                  <Wert value={position.startTime} />
                </td>
                <td>
                  <Wert value={position.endTime} />
                </td>
                <td>
                  <Wert
                    value={position.breakMinutes === null ? null : `${position.breakMinutes} min`}
                  />
                </td>
                <td>{position.hours.toFixed(2)}</td>
                <td>
                  {position.premiums.length === 0 ? (
                    <Wert value={null} />
                  ) : (
                    <ul>
                      {position.premiums.map((zuschlag) => (
                        <li key={zuschlag.code}>
                          {zuschlag.code} {zuschlag.hours.toFixed(2)} h —{' '}
                          <code>
                            {zuschlag.origin === 'derived' ? 'abgeleitet' : 'angegeben'}
                          </code>
                        </li>
                      ))}
                    </ul>
                  )}
                </td>
                <td>
                  <Wert value={position.note} />
                  {position.violations.length === 0 ? null : (
                    <ul>
                      {position.violations.map((verletzung) => (
                        <li key={verletzung} className="fehler">
                          {verletzung}
                        </li>
                      ))}
                    </ul>
                  )}
                </td>
                <td>
                  {zettel.status === 'recorded' ? (
                    <form action={removeTimeEntryAction}>
                      <input type="hidden" name="timeEntryId" value={position.id} />
                      <button type="submit">entfernen</button>
                    </form>
                  ) : null}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      {zettel.approvals.length === 0 ? null : (
        <table>
          <caption>
            Freigabestufen (3.1, 4.4) — die Folge kommt aus der Konfiguration des Kunden; das
            Rollenkürzel ist beim Einreichen kopiert worden.
          </caption>
          <thead>
            <tr>
              <th>Stufe</th>
              <th>Seite</th>
              <th>Rolle</th>
              <th>Entscheidung</th>
              <th>am</th>
              <th>Bemerkung</th>
            </tr>
          </thead>
          <tbody>
            {zettel.approvals.map((stufe) => (
              <tr key={stufe.level}>
                <td>{stufe.level}</td>
                <td>{stufe.side === 'customer' ? 'Kunde' : 'Betreiber'}</td>
                <td>
                  <code>{stufe.roleCode}</code>
                </td>
                <td>
                  {stufe.decision === null ? (
                    <span className="hint">offen</span>
                  ) : (
                    <Status value={stufe.decision === 'approved' ? 'genehmigt' : 'abgelehnt'} />
                  )}
                </td>
                <td>
                  <Wert value={stufe.decidedAt} />
                </td>
                <td>
                  <Wert value={stufe.comment} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {zettel.findings.length === 0 ? null : (
        <ul>
          {zettel.findings.map((befund) => (
            <li key={`${befund.check}-${befund.row}`} className={befund.satisfied ? 'hint' : 'fehler'}>
              <strong>
                {befund.row} ({befund.effect})
              </strong>
              : {befund.message}
            </li>
          ))}
        </ul>
      )}

      {zettel.status === 'recorded' ? (
        <form action={addTimeEntryAction}>
          <input type="hidden" name="timesheetId" value={zettel.id} />
          <p>
            <label htmlFor={`workDate-${zettel.id}`}>Tag: </label>
            <input id={`workDate-${zettel.id}`} name="workDate" type="date" required />{' '}
            <label htmlFor={`startTime-${zettel.id}`}>Beginn: </label>
            <input
              id={`startTime-${zettel.id}`}
              name="startTime"
              placeholder="22:00"
              size={5}
            />{' '}
            <label htmlFor={`endTime-${zettel.id}`}>Ende: </label>
            <input id={`endTime-${zettel.id}`} name="endTime" placeholder="06:00" size={5} />{' '}
            <label htmlFor={`breakMinutes-${zettel.id}`}>Pause (min): </label>
            <input id={`breakMinutes-${zettel.id}`} name="breakMinutes" size={4} />{' '}
            <label htmlFor={`hours-${zettel.id}`}>oder Stunden: </label>
            <input id={`hours-${zettel.id}`} name="hours" size={5} placeholder="8" />{' '}
            <label htmlFor={`note-${zettel.id}`}>Bemerkung: </label>
            <input id={`note-${zettel.id}`} name="note" size={20} />{' '}
            <button type="submit">Position anlegen</button>
          </p>
          <p className="hint">
            Beginn und Ende <strong>beide oder keines</strong>. Mit beiden entsteht ein Abschnitt,
            und die Stunden werden gerechnet — das Feld „Stunden" bleibt dann leer. Ohne beide
            entsteht eine Tagessumme, und dann ist „Stunden" die Menge.
          </p>
        </form>
      ) : null}

      {kannEinreichen ? (
        <form action={submitTimesheetAction}>
          <input type="hidden" name="timesheetId" value={zettel.id} />
          <p>
            <button type="submit">einreichen (4.4)</button>{' '}
            <span className="hint">
              Die Einreichung ist zugleich die Erklärung, dass der Zeitraum vollständig erfasst ist
              — ableitbar ist das nicht (Entscheidung zu Frage 21).
            </span>
          </p>
        </form>
      ) : null}

      {kannNacharbeiten ? (
        <form action={reworkTimesheetAction}>
          <input type="hidden" name="timesheetId" value={zettel.id} />
          <p>
            <button type="submit">nacharbeiten (4.4)</button>{' '}
            <span className="hint">Die Freigabeschritte werden dabei verworfen.</span>
          </p>
        </form>
      ) : null}

      {kannKorrigieren ? (
        <form action={createCorrectionAction}>
          <input type="hidden" name="timesheetId" value={zettel.id} />
          <p>
            <label htmlFor={`reason-${zettel.id}`}>Begründung der Korrektur: </label>
            <input id={`reason-${zettel.id}`} name="reason" size={32} required />{' '}
            <button type="submit">Korrekturfassung anlegen (4.4)</button>
          </p>
          <p className="hint">
            Der einzige Weg, genehmigte Zeiten zu ändern ([28]). Die Positionen werden übernommen;
            der ersetzte Zettel bleibt genehmigt, bis die Fassung genehmigt ist — dann steht er auf
            „korrigiert", und ein Beleg über die alten Zeiten ist zu stornieren (4.5.2).
          </p>
        </form>
      ) : null}

      {kannEntscheiden && stufeOffen !== undefined ? (
        <form action={decideStageAction}>
          <input type="hidden" name="timesheetId" value={zettel.id} />
          <p>
            Offene Stufe {stufeOffen.level} (<code>{stufeOffen.roleCode}</code>):{' '}
            <label htmlFor={`comment-${zettel.id}`}>Bemerkung: </label>
            <input id={`comment-${zettel.id}`} name="comment" size={24} />{' '}
            <label htmlFor={`rejectionReason-${zettel.id}`}>Ablehnungsgrund: </label>
            <input id={`rejectionReason-${zettel.id}`} name="rejectionReason" size={24} />
          </p>
          <p>
            <button type="submit" name="decision" value="approved">
              Stufe genehmigen
            </button>{' '}
            <button type="submit" name="decision" value="rejected">
              ablehnen
            </button>{' '}
            <span className="hint">
              Ob daraus „Stufe genehmigen" oder „genehmigen" wird, entscheidet die Lage: nur die
              letzte offene Stufe führt nach „genehmigt" (4.4).
            </span>
          </p>
        </form>
      ) : null}
    </section>
  )
}
