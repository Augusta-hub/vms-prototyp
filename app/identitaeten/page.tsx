/**
 * Personenidentität — SPEC 3.6, Entscheidung zu vormals offener Frage 18.
 *
 * Die Seite gibt es **nur für den Betreiber**. Für jede andere Rolle zeigt sie
 * nicht eine leere Liste, sondern sagt, dass sie den Datenraum nicht einsieht:
 * Kunden und Lieferanten sehen das Objekt und seine Existenz nicht (Fußnote
 * [43], 2.3 Regel 4). Die Prüfung dafür steht im Dienst, nicht hier —
 * `loadIdentities` gibt `null` zurück, wenn die Prüffunktion den Zugriff
 * verweigert.
 */
import {
  loadCandidatesWithoutIdentity,
  loadIdentities,
  type IdentityView,
} from '../../lib/services/workerIdentity'
import { currentIdentity } from '../identity'
import { Meldung, Status, Wert } from '../ui'
import {
  confirmLinkAction,
  createIdentityAction,
  detachLinkAction,
  proposeLinksAction,
} from './actions'

export const dynamic = 'force-dynamic'

export default async function IdentitaetenPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; fehler?: string }>
}) {
  const params = await searchParams
  const { identity, hint } = await currentIdentity()

  if (identity === null) {
    return (
      <>
        <h1>Personenidentität</h1>
        <p className="hint">{hint}</p>
      </>
    )
  }

  const identities = await loadIdentities(identity)
  if (identities === null) {
    return (
      <>
        <h1>Personenidentität</h1>
        <p className="hint">
          Diese Rolle sieht die Personenidentität nicht — und erfährt auch nicht, dass es sie gibt
          (SPEC 3.6, Fußnote [43], 2.3 Regel 4). Ergebnisse daraus erreichen Kunden und Lieferanten
          nur als Information oder Sperre zum eigenen Vorgang, nie als Historie.
        </p>
      </>
    )
  }

  const candidatesWithoutIdentity = await loadCandidatesWithoutIdentity(identity)

  return (
    <>
      <h1>Personenidentität</h1>
      <p>
        Die betreiberseitige Information, dass Kandidatensätze verschiedener Lieferanten
        <strong> dieselbe Person </strong>
        betreffen (SPEC 3.6). Ohne sie sind die Zählung der Höchstüberlassungsdauer über
        Lieferanten und Kunden hinweg (5.1), die Equal-Pay-Fristen (5.2), die Drehtürprüfung (5.3)
        und die Erkennung von Doppelvorschlägen (2.3, Regel 4) nicht möglich.
      </p>
      <p className="hint">
        Der Merkmalssatz ist <strong>abschließend</strong>: Name, Geburtsdatum, Geburtsort. Keine
        Sozialversicherungs-, Steuer- oder Ausweisnummer. Der Abgleich <strong>schlägt vor</strong>
        , er verknüpft nicht selbst — jede Verknüpfung wird hier bestätigt, und ein nur
        vorgeschlagener Treffer gilt nicht als Identität. Die Rechtsgrundlage ist{' '}
        <strong>offene Frage 25</strong> und juristisch zu prüfen.
      </p>
      <Meldung ok={params.ok} fehler={params.fehler} />

      <form action={proposeLinksAction}>
        <button type="submit">Abgleich laufen lassen (schlägt vor, verknüpft nicht)</button>
      </form>

      {identities.length === 0 ? (
        <p className="hint">Keine Personenidentität geführt.</p>
      ) : (
        identities.map((record) => <Identitaet key={record.id} record={record} />)
      )}

      {candidatesWithoutIdentity.length > 0 ? (
        <details>
          <summary>Identität für einen einzelnen Kandidatensatz anlegen</summary>
          <p className="hint">
            Nötig, weil `assignment.workerIdentityRef` ab Status `planned` Pflicht ist (3.7): ohne
            Identität kann 5.1 die Überlassungstage der Person nicht zählen, auch wenn es keinen
            zweiten Satz gibt, mit dem sie sich verknüpfen ließe. 3.6 lässt das zu —
            `linkedCandidates` verlangt „mindestens einen".
          </p>
          <form action={createIdentityAction}>
            <div className="grid">
              <label className="field">
                Kandidatensatz ohne bestätigte Identität
                <select name="candidateId" required>
                  {candidatesWithoutIdentity.map((candidate) => (
                    <option key={candidate.id} value={candidate.id}>
                      {candidate.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                Begründung (geht in die Verknüpfungshistorie)
                <input name="reason" />
              </label>
            </div>
            <button type="submit">Identität anlegen und bestätigen</button>
          </form>
        </details>
      ) : null}
    </>
  )
}

function Identitaet({ record }: { readonly record: IdentityView }) {
  return (
    <fieldset>
      <legend>
        {record.identityNumber} — {record.matchLabel} ·{' '}
        <Status
          value={
            record.countsAcrossSuppliers
              ? 'zählt über Lieferanten hinweg (5.1)'
              : 'zählt nicht über Lieferanten hinweg'
          }
        />
      </legend>

      <table>
        <thead>
          <tr>
            <th>Kandidatensatz</th>
            <th>Lieferant</th>
            <th>Stand</th>
            <th>Grundlage des Vorschlags</th>
            <th>Bestätigt am</th>
            <th>Getrennt am</th>
          </tr>
        </thead>
        <tbody>
          {record.links.map((link) => (
            <tr key={link.id}>
              <td>{link.candidateLabel}</td>
              <td>{link.supplierLabel}</td>
              <td>
                <Status value={link.linkStatus} />
              </td>
              <td>{link.proposalBasis}</td>
              <td>
                <Wert value={link.confirmedAt} />
              </td>
              <td>
                <Wert value={link.detachedAt} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {record.links
        .filter((link) => link.linkStatus === 'proposed')
        .map((link) => (
          <form key={`confirm-${link.id}`} action={confirmLinkAction}>
            <input type="hidden" name="linkId" value={link.id} />
            <label className="field">
              Begründung der Bestätigung (Pflicht, geht in die Historie) — {link.candidateLabel}
              <input name="reason" required />
            </label>
            <button type="submit">Verknüpfung bestätigen</button>
          </form>
        ))}

      {record.links
        .filter((link) => link.linkStatus === 'confirmed')
        .map((link) => (
          <form key={`detach-${link.id}`} action={detachLinkAction}>
            <input type="hidden" name="linkId" value={link.id} />
            <label className="field">
              Begründung der Trennung (Pflicht) — {link.candidateLabel}
              <input name="reason" required />
            </label>
            <button type="submit">Verknüpfung trennen</button>
          </form>
        ))}

      <h3>Verknüpfungshistorie (3.6)</h3>
      <table>
        <thead>
          <tr>
            <th>Zeitpunkt</th>
            <th>Handlung</th>
            <th>Begründung</th>
          </tr>
        </thead>
        <tbody>
          {record.mergeHistory.map((entry, index) => (
            <tr key={index}>
              <td>{entry.occurredAt}</td>
              <td>{entry.action}</td>
              <td>{entry.reason}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </fieldset>
  )
}
