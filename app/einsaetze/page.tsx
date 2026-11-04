/**
 * Einsätze — SPEC 3.7 mit den Statusmodellen 4.3.1 (Einsatz) und 4.3.2
 * (Verlängerung).
 *
 * Drei Festlegungen aus 4.3 sind an dieser Seite ablesbar:
 *
 *  - **„verlängert" ist kein Zustand**: eine wirksame Verlängerung verschiebt
 *    das geplante Ende, der Einsatz bleibt `planned` oder `active`.
 *  - **der Antrag auf vorzeitige Beendigung ist kein Zustand**: er steht als
 *    Feldsatz am Einsatz, und der Einsatz läuft unverändert weiter.
 *  - **die Rücknahme vor Beginn ist `terminatedEarly`**: ein Einsatz, der nie
 *    begonnen hat, wird nicht „beendet".
 */
import {
  loadAssignments,
  loadStaffingFormOptions,
  type AssignmentListEntry,
  type StaffingFormOptions,
} from '../../lib/services/staffing'
import { ASSIGNMENT_STATE_LABELS } from '../../lib/status/assignment'
import { ASSIGNMENT_EXTENSION_STATE_LABELS } from '../../lib/status/assignmentExtension'
import { currentIdentity } from '../identity'
import { Meldung, Status, Verdeckt, Wert } from '../ui'
import {
  createAssignmentAction,
  recordTerminationRequestAction,
  requestExtensionAction,
  transitionAssignmentAction,
  transitionExtensionAction,
} from './actions'

export const dynamic = 'force-dynamic'

export default async function EinsaetzePage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; fehler?: string }>
}) {
  const params = await searchParams
  const { identity, hint } = await currentIdentity()

  if (identity === null) {
    return (
      <>
        <h1>Einsätze</h1>
        <p className="hint">{hint}</p>
      </>
    )
  }

  const [assignments, options] = await Promise.all([
    loadAssignments(identity),
    loadStaffingFormOptions(identity),
  ])
  const isOperator = identity.tenant.tenantType === 'operator'

  return (
    <>
      <h1>Einsätze</h1>
      <p>
        Überlassung einer Person an einen Kunden (SPEC 3.7) mit den Statusmodellen 4.3.1 und 4.3.2.
        Anlegen, verlängern und beenden führt der MSP-Disponent aus; Kunde und Lieferant beantragen
        (Fußnote [25]), die Kundenseite genehmigt (Fußnote [26]). Die abgeleiteten Felder
        (Fristende der Höchstüberlassung, Equal-Pay-Fälligkeit, angerechnete Dauer) rechnet
        Kapitel 5 und sind deshalb leer.
      </p>
      <Meldung ok={params.ok} fehler={params.fehler} />

      {assignments.length === 0 ? (
        <p className="hint">Für diese Rolle ist kein Einsatz sichtbar (2.3, Grundsatz).</p>
      ) : (
        assignments.map((assignment) => (
          <Einsatz
            key={assignment.id}
            assignment={assignment}
            options={options}
            isOperator={isOperator}
          />
        ))
      )}

      {isOperator && options.acceptedSubmissions.length > 0 ? (
        <>
          <h2>Einsatz anlegen (4.3.1: — → planned)</h2>
          <p className="hint">
            Anzeige nur zugesagter Profilvorschläge ohne Einsatz. Die Tätigkeitsbeschreibung ist
            eine <strong>eigene</strong> Angabe des Einsatzes und nicht nur ein Verweis auf die
            Anfrage (Konkretisierungspflicht, 5.3.3). Ohne bestätigte Personenidentität scheitert
            der Übergang — sie ist ab `planned` Pflicht (3.7).
          </p>
          {options.acceptedSubmissions.map((submission) => (
            <form key={submission.id} action={createAssignmentAction}>
              <input type="hidden" name="submissionId" value={submission.id} />
              <p>
                <strong>{submission.label}</strong>
              </p>
              <div className="grid">
                <label className="field">
                  Kostenstelle (für Lieferanten nicht sichtbar)
                  <select name="costCenterId" required>
                    {submission.costCenters.map((costCenter) => (
                      <option key={costCenter.id} value={costCenter.id}>
                        {costCenter.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  Preisposition Einkauf (Lieferantenseite)
                  <select name="agreedRateCardItemId" required>
                    {submission.supplierRateCardItems.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  Preisposition Verkauf (Kundenseite, für Lieferanten nie sichtbar)
                  <select name="customerRateCardItemId" required>
                    {submission.customerRateCardItems.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  Geplanter Beginn
                  <input name="plannedStartDate" type="date" required />
                </label>
                <label className="field">
                  Geplantes Ende
                  <input name="plannedEndDate" type="date" />
                </label>
                <label className="field">
                  Wochenstunden
                  <input name="weeklyHours" defaultValue="40" required />
                </label>
                <label className="field">
                  Schichtmodell
                  <input name="shiftModel" />
                </label>
                <label className="field">
                  Vergleichsentgelt (leer = vom Standort erben, 3.3)
                  <input name="comparableWage" />
                </label>
              </div>
              <label className="field">
                Tätigkeitsbeschreibung des Einsatzes
                <input name="activityDescription" required />
              </label>
              <button type="submit">Einsatz anlegen</button>
            </form>
          ))}
        </>
      ) : null}
    </>
  )
}

function Einsatz({
  assignment,
  options,
  isOperator,
}: {
  readonly assignment: AssignmentListEntry
  readonly options: StaffingFormOptions
  readonly isOperator: boolean
}) {
  const transitionNames = assignment.availableTransitions.map((transition) => transition.name)
  const starts = transitionNames.includes('start')
  const interrupts = transitionNames.includes('interrupt')
  const resumes = transitionNames.includes('resume')
  const ends = transitionNames.includes('complete') || transitionNames.includes('terminateEarly')

  return (
    <fieldset>
      <legend>
        <Wert value={assignment.fields.assignmentNumber} /> —{' '}
        <Wert value={assignment.fields.candidate ?? assignment.fields.pseudonym} /> ·{' '}
        <Status value={`${assignment.status} (${ASSIGNMENT_STATE_LABELS[assignment.status]})`} />
      </legend>

      <table>
        <tbody>
          <Zeile label="Kunde" value={assignment.fields.customer} />
          <Zeile label="Standort" value={assignment.fields.site} />
          <Zeile label="Kostenstelle" value={assignment.fields.costCenterNumber} />
          <Zeile label="Lieferant" value={assignment.fields.supplier} />
          <Zeile label="Tätigkeit" value={assignment.fields.activityDescription} />
          <Zeile label="Geplanter Beginn" value={assignment.fields.plannedStartDate} />
          <Zeile label="Geplantes Ende" value={assignment.fields.plannedEndDate} />
          <Zeile label="Tatsächlicher Beginn" value={assignment.fields.actualStartDate} />
          <Zeile label="Tatsächliches Ende" value={assignment.fields.actualEndDate} />
          <Zeile label="Wochenstunden" value={assignment.fields.weeklyHours} />
          <Zeile label="Schichtmodell" value={assignment.fields.shiftModel} />
          <Zeile label="Satz Einkauf" value={assignment.fields.agreedHourlyRate} />
          <Zeile label="Satz Verkauf" value={assignment.fields.customerHourlyRate} />
          <Zeile label="Vergleichsentgelt" value={assignment.fields.comparableWage} />
          <Zeile
            label="Equal-Pay-Fälligkeit (abgeleitet, 5.2)"
            value={assignment.fields.equalPayDueDate}
          />
          <Zeile
            label="Fristende Höchstüberlassung (abgeleitet, 5.1)"
            value={assignment.fields.maxDurationEndDate}
          />
          <Zeile
            label="Angerechnete Dauer (abgeleitet, 5.1)"
            value={assignment.fields.countedDurationDays}
          />
          <Zeile label="Beendigungsgrund" value={assignment.fields.terminationReason} />
          <Zeile
            label="Personenidentität (nur Betreiber)"
            value={assignment.fields.workerIdentityId}
          />
        </tbody>
      </table>
      <Verdeckt fields={assignment.concealed} />

      {assignment.openTerminationRequest === null ? null : (
        <p className="hint">
          Offener Antrag auf vorzeitige Beendigung: {assignment.openTerminationRequest}. Der
          Einsatz läuft unverändert weiter — ein unentschiedener Vorgang bewirkt nichts (4.3.1).
        </p>
      )}

      {assignment.interruptions.length > 0 ? (
        <>
          <h3>Unterbrechungen (3.7)</h3>
          <table>
            <thead>
              <tr>
                <th>Von</th>
                <th>Bis</th>
                <th>Grund</th>
                <th>Zählwirksam (P2, 5.1)</th>
              </tr>
            </thead>
            <tbody>
              {assignment.interruptions.map((interruption) => (
                <tr key={interruption.id}>
                  <td>
                    <Wert value={interruption.from} />
                  </td>
                  <td>
                    <Wert value={interruption.to} />
                  </td>
                  <td>
                    <Wert value={interruption.reason} />
                  </td>
                  <td>
                    <Wert value={interruption.countsAsReset} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      ) : null}

      {assignment.terminal ? (
        <p className="hint">
          Endzustand (4.0, Regel 9): aus „{assignment.status}" führt kein Übergang zurück. Eine
          erneute Überlassung derselben Person ist ein <strong>neuer</strong> Einsatz.
        </p>
      ) : assignment.availableTransitions.length === 0 ? (
        <p className="hint">Diese Rolle löst an diesem Einsatz keinen Übergang aus (4.3.1).</p>
      ) : (
        <form action={transitionAssignmentAction}>
          <input type="hidden" name="assignmentId" value={assignment.id} />
          <div className="grid">
            {starts ? (
              <label className="field">
                Tatsächlicher Beginn (Pflicht für „Beginn bestätigen")
                <input name="actualStartDate" type="date" />
              </label>
            ) : null}
            {ends ? (
              <label className="field">
                Tatsächliches Ende (Pflicht für beide Beendigungen)
                <input name="actualEndDate" type="date" />
              </label>
            ) : null}
            {interrupts ? (
              <>
                <label className="field">
                  Unterbrechung von
                  <input name="interruptionFrom" type="date" />
                </label>
                <label className="field">
                  Grund der Unterbrechung
                  <input name="interruptionReason" />
                </label>
              </>
            ) : null}
            {resumes ? (
              <label className="field">
                Unterbrechung bis (Pflicht für „fortsetzen")
                <input name="interruptionTo" type="date" />
              </label>
            ) : null}
          </div>
          <p>
            {assignment.availableTransitions.map((transition) => (
              <button key={transition.name} type="submit" name="transition" value={transition.name}>
                {transition.label}
              </button>
            ))}
          </p>
        </form>
      )}

      <h3>Verlängerungen (4.3.2)</h3>
      {assignment.extensions.length === 0 ? (
        <p className="hint">Keine Verlängerung zu diesem Einsatz.</p>
      ) : (
        assignment.extensions.map((extension) => (
          <table key={extension.id}>
            <tbody>
              <tr>
                <th style={{ width: '20rem' }}>Status</th>
                <td>
                  <Status
                    value={`${extension.status} (${ASSIGNMENT_EXTENSION_STATE_LABELS[extension.status]})`}
                  />
                </td>
              </tr>
              <Zeile label="Neues Ende" value={extension.newEndDate} />
              <Zeile label="Begründung" value={extension.reason} />
              <Zeile label="Genehmigt am" value={extension.approvedAt} />
              <Zeile label="Wirksam am" value={extension.effectiveAt} />
              <Zeile label="Ablehnungsgrund" value={extension.rejectionReason} />
              {extension.availableTransitions.length === 0 ? null : (
                <tr>
                  <th>Übergänge</th>
                  <td>
                    <form action={transitionExtensionAction}>
                      <input type="hidden" name="extensionId" value={extension.id} />
                      {extension.availableTransitions.some(
                        (transition) => transition.name === 'reject',
                      ) ? (
                        <label className="field">
                          Begründung der Ablehnung (Pflicht)
                          <input name="rejectionReason" />
                        </label>
                      ) : null}
                      {extension.availableTransitions.map((transition) => (
                        <button
                          key={transition.name}
                          type="submit"
                          name="transition"
                          value={transition.name}
                        >
                          {transition.label}
                        </button>
                      ))}
                    </form>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        ))
      )}

      {assignment.terminal ? null : (
        <details>
          <summary>Verlängerung beantragen (4.3.2: — → requested)</summary>
          <form action={requestExtensionAction}>
            <input type="hidden" name="assignmentId" value={assignment.id} />
            <div className="grid">
              <label className="field">
                Neues Ende (muss nach dem bisherigen Ende liegen)
                <input name="newEndDate" type="date" required />
              </label>
              <label className="field">
                Begründung (Pflicht)
                <input name="reason" required />
              </label>
            </div>
            <button type="submit">Verlängerung beantragen</button>
          </form>
        </details>
      )}

      {isOperator && !assignment.terminal ? (
        <details>
          <summary>Antrag auf vorzeitige Beendigung festhalten (3.7)</summary>
          <p className="hint">
            Der Antrag hat <strong>keinen</strong> eigenen Zustand (4.3.1). Er wird beim Betreiber
            festgehalten, weil die Matrix 2.2 dem Bedarfsträger und dem Lieferantendisponenten auf
            dieser Zeile kein Änderungsrecht gibt und 4.3.1 für den Antrag keinen Übergang kennt —
            die Lücke steht als <strong>offene Frage 39</strong> in SPEC Kapitel 7. Bei einem
            Antrag der Kundenseite ist die Genehmigung des Genehmigers Pflicht (Fußnote [26]).
          </p>
          <form action={recordTerminationRequestAction}>
            <input type="hidden" name="assignmentId" value={assignment.id} />
            <div className="grid">
              <label className="field">
                Antragsteller
                <select name="requestedByUserId" required>
                  {options.terminationRequesters.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                Genehmiger (nur bei Antrag der Kundenseite)
                <select name="approvedByUserId" defaultValue="">
                  <option value="">keine Genehmigung</option>
                  {options.approvers.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label className="field">
              Beendigungsgrund (Pflicht)
              <input name="reason" required />
            </label>
            <button type="submit">Antrag festhalten</button>
          </form>
        </details>
      ) : null}
    </fieldset>
  )
}

function Zeile({
  label,
  value,
}: {
  readonly label: string
  readonly value: string | null | undefined
}) {
  return (
    <tr>
      <th style={{ width: '20rem' }}>{label}</th>
      <td>
        <Wert value={value} />
      </td>
    </tr>
  )
}
