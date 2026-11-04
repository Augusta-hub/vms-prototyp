/**
 * Besetzung — Kandidat und Profilvorschlag (SPEC 3.6) mit dem Statusmodell
 * 4.2.3.
 *
 * Die Seite zeigt dieselben Vorgänge für alle Rollen und **verlässt sich auf
 * die Projektion**: was eine Rolle nicht sehen darf, kommt nicht als leeres
 * Feld, sondern als „nicht sichtbar" — die Fußnote aus 2.2 ist eine Aussage,
 * keine Lücke.
 *
 * Die Datenminimierung aus 6.4 ist deshalb hier **nicht** programmiert: der
 * Kunde sieht am vorgelegten Profil das Pseudonym und nach der Zusage die
 * Klardaten, weil Fußnote [23] es so bestimmt (lib/authz/footnotes.ts).
 */
import { loadCandidates, loadStaffingFormOptions, loadSubmissions } from '../../lib/services/staffing'
import type { CandidateListEntry, SubmissionListEntry } from '../../lib/services/staffing'
import { CANDIDATE_SUBMISSION_STATE_LABELS } from '../../lib/status/candidateSubmission'
import { currentIdentity } from '../identity'
import { Meldung, Status, Verdeckt, Wert } from '../ui'
import {
  createCandidateAction,
  submitCandidateAction,
  transitionSubmissionAction,
} from './actions'

export const dynamic = 'force-dynamic'

export default async function BesetzungPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; fehler?: string }>
}) {
  const params = await searchParams
  const { identity, hint } = await currentIdentity()

  if (identity === null) {
    return (
      <>
        <h1>Besetzung</h1>
        <p className="hint">{hint}</p>
      </>
    )
  }

  const [candidates, submissions, options] = await Promise.all([
    loadCandidates(identity),
    loadSubmissions(identity),
    loadStaffingFormOptions(identity),
  ])
  const isSupplier = identity.tenant.tenantType === 'supplier'

  return (
    <>
      <h1>Besetzung</h1>
      <p>
        Kandidat und Profilvorschlag (SPEC 3.6) mit dem Statusmodell 4.2.3. Der Kunde sieht ein
        <strong> pseudonymisiertes </strong>
        Profil; die Klardaten gibt erst die Zusage frei (Fußnote [23], 6.4). Die Personenidentität
        (3.6) ist ausschließlich beim Betreiber geführt — Kunden und Lieferanten sehen sie und ihre
        Existenz nicht (Fußnote [43]).
      </p>
      <Meldung ok={params.ok} fehler={params.fehler} />

      <h2>Profilvorschläge</h2>
      {submissions.length === 0 ? (
        <p className="hint">Für diese Rolle ist kein Profilvorschlag sichtbar (2.3, Grundsatz).</p>
      ) : (
        submissions.map((submission) => (
          <Vorschlag key={submission.id} submission={submission} />
        ))
      )}

      {isSupplier && options.ownOffers.length > 0 && options.ownCandidates.length > 0 ? (
        <>
          <h2>Kandidat vorlegen (4.2.3: anlegen und vorlegen)</h2>
          <form action={submitCandidateAction}>
            <div className="grid">
              <label className="field">
                Eigenes Angebot
                <select name="offerId" required>
                  {options.ownOffers.map((offer) => (
                    <option key={offer.id} value={offer.id}>
                      {offer.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                Eigener Kandidat
                <select name="candidateId" required>
                  {options.ownCandidates.map((candidate) => (
                    <option key={candidate.id} value={candidate.id}>
                      {candidate.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                Verfügbar ab
                <input name="availableFrom" type="date" required />
              </label>
              <label className="field">
                Abweichender Satz je Stunde (optional, offene Frage 17)
                <input name="offeredHourlyRate" />
              </label>
            </div>
            <button type="submit">Profilvorschlag einreichen</button>
          </form>
        </>
      ) : null}

      <h2>Kandidaten</h2>
      {candidates.length === 0 ? (
        <p className="hint">Für diese Rolle ist kein Kandidat sichtbar (2.3, Grundsatz).</p>
      ) : (
        candidates.map((candidate) => <Kandidat key={candidate.id} candidate={candidate} />)
      )}

      {isSupplier ? (
        <details>
          <summary>Kandidat anlegen (3.6)</summary>
          <p className="hint">
            Pflichtangaben nach 3.6: Vorname, Name, Geburtsdatum, Pseudonym, Beschäftigungs­verhältnis
            und die Angabe, ob eine Arbeitserlaubnis nötig ist. Die Erklärung zur Vorbeschäftigung
            ist optional — ohne sie sperrt die Drehtürprüfung aber die Zusage und den Einsatz
            (5.3.1).
          </p>
          <form action={createCandidateAction}>
            <div className="grid">
              <label className="field">
                Vorname
                <input name="givenName" required />
              </label>
              <label className="field">
                Name
                <input name="familyName" required />
              </label>
              <label className="field">
                Geburtsdatum
                <input name="dateOfBirth" type="date" required />
              </label>
              <label className="field">
                Geburtsort (Merkmal des Abgleichs, 3.6)
                <input name="placeOfBirth" />
              </label>
              <label className="field">
                Pseudonym (Anzeigeform für das Profil, 6.4)
                <input name="pseudonym" required />
              </label>
              <label className="field">
                Qualifikation
                <input name="qualification" />
              </label>
              <label className="field">
                Beschäftigungsverhältnis
                <select name="employmentStatusWithSupplier" defaultValue="employed">
                  <option value="employed">employed (Arbeitsverhältnis besteht)</option>
                  <option value="applicant">applicant (Bewerber)</option>
                </select>
              </label>
              <label className="field">
                Beschäftigt seit (Pflicht bei `employed`)
                <input name="employedSince" type="date" />
              </label>
              <label className="field">
                Arbeitserlaubnis erforderlich
                <select name="workPermitRequired" defaultValue="nein">
                  <option value="nein">nein</option>
                  <option value="ja">ja</option>
                </select>
              </label>
            </div>
            <fieldset>
              <legend>Erklärung zur Vorbeschäftigung (5.3.1, Inhalt abschließend)</legend>
              <div className="grid">
                <label className="field">
                  Datum der Erklärung
                  <input name="previousEmploymentDeclaredAt" type="date" />
                </label>
                <label className="field">
                  Arbeitsverhältnis beim Entleiher oder im Konzern in den letzten sechs Monaten?
                  <select name="previousEmploymentExisted" defaultValue="">
                    <option value="">keine Angabe</option>
                    <option value="nein">nein</option>
                    <option value="ja">ja</option>
                  </select>
                </label>
                <label className="field">
                  Ende dieses Arbeitsverhältnisses
                  <input name="previousEmploymentEndedOn" type="date" />
                </label>
                <label className="field">
                  Früherer Arbeitgeber
                  <input name="previousEmploymentEmployer" />
                </label>
              </div>
            </fieldset>
            <button type="submit">Kandidat anlegen</button>
          </form>
        </details>
      ) : null}
    </>
  )
}

function Vorschlag({ submission }: { readonly submission: SubmissionListEntry }) {
  const needsReason = submission.availableTransitions.some(
    (transition) =>
      transition.name === 'rejectByOperator' || transition.name === 'rejectByCustomer',
  )
  const schedulesInterview = submission.availableTransitions.some(
    (transition) => transition.name === 'scheduleInterview',
  )

  return (
    <fieldset>
      <legend>
        <Wert value={submission.fields.submissionNumber} /> — Anfrage {submission.requestNumber}{' '}
        {submission.requestTitle} ·{' '}
        <Status
          value={`${submission.status} (${CANDIDATE_SUBMISSION_STATE_LABELS[submission.status]})`}
        />
      </legend>

      <table>
        <tbody>
          <Zeile label="Pseudonym" value={submission.fields.pseudonym} />
          <Zeile label="Vorname" value={submission.fields.givenName} />
          <Zeile label="Name" value={submission.fields.familyName} />
          <Zeile label="Geburtsdatum" value={submission.fields.dateOfBirth} />
          <Zeile label="Kontakt (E-Mail)" value={submission.fields.contactEmail} />
          <Zeile label="Kontakt (Telefon)" value={submission.fields.contactPhone} />
          <Zeile label="Qualifikationen" value={submission.fields.qualifications} />
          <Zeile label="Lieferant" value={submission.fields.supplier} />
          <Zeile label="Kandidatennummer" value={submission.fields.candidateNumber} />
          <Zeile label="Verfügbar ab" value={submission.fields.availableFrom} />
          <Zeile label="Abweichender Satz" value={submission.fields.offeredHourlyRate} />
          <Zeile label="Offenlegungsstufe" value={submission.fields.disclosureLevel} />
          <Zeile label="Eingereicht am" value={submission.fields.submittedAt} />
          <Zeile label="Dem Kunden vorgelegt am" value={submission.fields.releasedToCustomerAt} />
          <Zeile label="Interview" value={submission.fields.interviewScheduledAt} />
          <Zeile label="Entscheidung" value={submission.fields.decision} />
          <Zeile label="Entscheidungsgrund" value={submission.fields.decisionReason} />
          <Zeile label="Zurückgezogen am" value={submission.fields.withdrawnAt} />
          <Zeile label="Einsatz" value={submission.assignmentNumber} />
        </tbody>
      </table>
      <Verdeckt fields={submission.concealed} />

      {submission.terminal ? (
        <p className="hint">
          Endzustand (4.0, Regel 9): aus „{submission.status}" führt kein Übergang zurück.
        </p>
      ) : submission.availableTransitions.length === 0 ? (
        <p className="hint">Diese Rolle löst an diesem Vorgang keinen Übergang aus (4.2.3).</p>
      ) : (
        <form action={transitionSubmissionAction}>
          <input type="hidden" name="submissionId" value={submission.id} />
          {needsReason ? (
            <label className="field">
              Entscheidungsgrund (Pflicht bei Ablehnung, ohne Bezug auf ein fremdes Angebot)
              <input name="decisionReason" />
            </label>
          ) : null}
          {schedulesInterview ? (
            <label className="field">
              Interviewtermin (optional)
              <input name="interviewAt" type="datetime-local" />
            </label>
          ) : null}
          <p>
            {submission.availableTransitions.map((transition) => (
              <button key={transition.name} type="submit" name="transition" value={transition.name}>
                {transition.label}
              </button>
            ))}
          </p>
        </form>
      )}
    </fieldset>
  )
}

function Kandidat({ candidate }: { readonly candidate: CandidateListEntry }) {
  return (
    <fieldset>
      <legend>
        <Wert value={candidate.fields.candidateNumber} /> —{' '}
        <Wert value={candidate.fields.pseudonym} /> · <Status value={candidate.status} />
      </legend>
      <table>
        <tbody>
          <Zeile label="Vorname" value={candidate.fields.givenName} />
          <Zeile label="Name" value={candidate.fields.familyName} />
          <Zeile label="Geburtsdatum" value={candidate.fields.dateOfBirth} />
          <Zeile label="Geburtsort" value={candidate.fields.placeOfBirth} />
          <Zeile label="Lieferant" value={candidate.fields.supplier} />
          <Zeile label="Qualifikationen" value={candidate.fields.qualifications} />
          <Zeile
            label="Beschäftigungsverhältnis"
            value={candidate.fields.employmentStatusWithSupplier}
          />
          <Zeile label="Beschäftigt seit" value={candidate.fields.employedSince} />
          <Zeile label="Arbeitserlaubnis nötig" value={candidate.fields.workPermitRequired} />
          <Zeile
            label="Erklärung zur Vorbeschäftigung vom"
            value={candidate.fields.previousEmploymentDeclaredAt}
          />
          <Zeile
            label="Vorbeschäftigung bestand"
            value={candidate.fields.previousEmploymentExisted}
          />
          <Zeile
            label="Vorbeschäftigung endete am"
            value={candidate.fields.previousEmploymentEndedOn}
          />
          <Zeile
            label="Früherer Arbeitgeber"
            value={candidate.fields.previousEmploymentEmployer}
          />
          {candidate.identityNote === null ? null : (
            <Zeile label="Personenidentität (nur Betreiber)" value={candidate.identityNote} />
          )}
        </tbody>
      </table>
      <Verdeckt fields={candidate.concealed} />
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
