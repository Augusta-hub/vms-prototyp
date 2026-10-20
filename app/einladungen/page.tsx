/**
 * Einladungen — SPEC 3.5 mit dem Statusmodell 4.2.1.
 *
 * Für den Lieferantendisponenten ist das Öffnen dieser Seite der **erste
 * lesende Zugriff** auf seine Einladungen: sie wechseln dabei nach `viewed`
 * (4.2.1, Systemübergang). Das ist kein Rechtsgeschäft und keine Zusage.
 *
 * **Nie sichtbar** (2.3, „Zwischen Lieferanten"): die Teilnehmerliste der
 * Ausschreibung, die Zahl der Eingeladenen, die Zahl der eingegangenen
 * Angebote, fremde Angebote und die eigene Platzierung. Die Seite zeigt
 * deshalb nur die eigene Einladung und die Anfrage im Umfang von Fußnote [14].
 */
import { loadInvitations, type InvitationListEntry } from '../../lib/services/demand'
import { TENDER_INVITATION_STATE_LABELS } from '../../lib/status/tenderInvitation'
import { currentIdentity } from '../identity'
import { Meldung, Status, Verdeckt, Wert } from '../ui'
import { declineInvitationAction, submitOfferAction } from './actions'

export const dynamic = 'force-dynamic'

export default async function EinladungenPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; fehler?: string }>
}) {
  const params = await searchParams
  const { identity, hint } = await currentIdentity()

  if (identity === null) {
    return (
      <>
        <h1>Einladungen</h1>
        <p className="hint">{hint}</p>
      </>
    )
  }

  const invitations = await loadInvitations(identity)
  const isSupplier = identity.tenant.tenantType === 'supplier'

  return (
    <>
      <h1>Einladungen</h1>
      <p>
        Teilnahme an einer Ausschreibung (SPEC 3.5) mit dem Statusmodell 4.2.1. Die Absage der
        eigenen Einladung setzt der Lieferantendisponent selbst (Fußnote [46]); Annahme,
        Fristverlängerung und der Fortschritt der Ausschreibung bleiben beim Betreiber.
      </p>
      <Meldung ok={params.ok} fehler={params.fehler} />

      {invitations.length === 0 ? (
        <p className="hint">Für diese Rolle ist keine Einladung sichtbar (2.3, Grundsatz).</p>
      ) : (
        invitations.map((invitation) => (
          <Einladung key={invitation.id} invitation={invitation} isSupplier={isSupplier} />
        ))
      )}
    </>
  )
}

function Einladung({
  invitation,
  isSupplier,
}: {
  readonly invitation: InvitationListEntry
  readonly isSupplier: boolean
}) {
  const mayDecline = invitation.availableTransitions.some(
    (transition) => transition.name === 'decline',
  )
  const mayOffer =
    isSupplier &&
    invitation.offer === null &&
    (invitation.status === 'invited' || invitation.status === 'viewed')

  return (
    <fieldset>
      <legend>
        <Wert value={invitation.request.requestNumber} /> —{' '}
        <Wert value={invitation.request.title} /> ·{' '}
        <Status
          value={`${invitation.status} (${TENDER_INVITATION_STATE_LABELS[invitation.status]})`}
        />
      </legend>

      <table>
        <tbody>
          <Zeile label="Lieferant" value={invitation.fields.supplier} />
          <Zeile label="Eingeladen am" value={invitation.fields.invitedAt} />
          <Zeile label="Zur Kenntnis genommen" value={invitation.fields.viewedAt} />
          <Zeile label="Beantwortet am" value={invitation.fields.respondedAt} />
          <Zeile label="Absagegrund" value={invitation.fields.declineReason} />
          <Zeile label="Angebotsfrist" value={invitation.offerDeadline} />
        </tbody>
      </table>
      <Verdeckt fields={invitation.concealed} />

      <h3>Die Anfrage im Umfang von Fußnote [14]</h3>
      <table>
        <tbody>
          <Zeile label="Kunde" value={invitation.request.customer} />
          <Zeile label="Standort" value={invitation.request.site} />
          <Zeile label="Kostenstelle" value={invitation.request.costCenterNumber} />
          <Zeile label="Tätigkeit" value={invitation.request.activityDescription} />
          <Zeile label="Anforderungen" value={invitation.request.qualifications} />
          <Zeile label="Anzahl" value={invitation.request.headcount} />
          <Zeile label="Beginn" value={invitation.request.startDate} />
          <Zeile label="Ende" value={invitation.request.endDate} />
          <Zeile label="Wochenstunden" value={invitation.request.weeklyHours} />
          <Zeile label="Kostenrahmen" value={invitation.request.maxHourlyRate} />
          <Zeile label="Interner Vermerk" value={invitation.request.internalNote} />
        </tbody>
      </table>
      <Verdeckt fields={invitation.requestConcealed} />

      {invitation.offer === null ? null : (
        <>
          <h3>Eigenes Angebot</h3>
          <table>
            <tbody>
              <Zeile label="Angebotsnummer" value={invitation.offer.fields.offerNumber} />
              <Zeile label="Status" value={invitation.offer.status} />
              <Zeile label="Verfügbar ab" value={invitation.offer.fields.availableFrom} />
              <Zeile label="Angebotene Anzahl" value={invitation.offer.fields.offeredHeadcount} />
              <Zeile label="Bindefrist" value={invitation.offer.fields.offerValidUntil} />
              <Zeile label="Bemerkung" value={invitation.offer.fields.note} />
              <Zeile label="Ablehnungsgrund" value={invitation.offer.fields.rejectionReason} />
            </tbody>
          </table>
          <table>
            <thead>
              <tr>
                <th>Qualifikationsstufe</th>
                <th>Anzahl</th>
                <th>Verrechnungssatz</th>
              </tr>
            </thead>
            <tbody>
              {invitation.offer.items.map((item, index) => (
                <tr key={index}>
                  <td>
                    <Wert value={item.qualificationLevel} />
                  </td>
                  <td>
                    <Wert value={item.headcount} />
                  </td>
                  <td>
                    <Wert value={item.hourlyRate} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {mayDecline ? (
        <form action={declineInvitationAction}>
          <input type="hidden" name="invitationId" value={invitation.id} />
          <label className="field">
            Absagegrund (Pflicht, ohne Bezug auf andere Lieferanten)
            <input name="declineReason" required />
          </label>
          <button type="submit">Einladung absagen</button>
        </form>
      ) : null}

      {mayOffer ? (
        <details>
          <summary>Angebot abgeben (4.2.2: anlegen und einreichen)</summary>
          <form action={submitOfferAction}>
            <input type="hidden" name="invitationId" value={invitation.id} />
            <div className="grid">
              <label className="field">
                Verfügbar ab
                <input name="availableFrom" type="date" required />
              </label>
              <label className="field">
                Angebotene Anzahl
                <input name="offeredHeadcount" defaultValue="1" required />
              </label>
              <label className="field">
                Bindefrist (optional)
                <input name="offerValidUntil" type="datetime-local" />
              </label>
              <label className="field">
                Qualifikationsstufe der Position
                <input name="qualificationLevel" required />
              </label>
              <label className="field">
                Anzahl der Position
                <input name="itemHeadcount" defaultValue="1" required />
              </label>
              <label className="field">
                Verrechnungssatz je Stunde (Einkaufsseite)
                <input name="hourlyRate" required />
              </label>
            </div>
            <label className="field">
              Bemerkung
              <input name="note" />
            </label>
            <button type="submit">Angebot einreichen</button>
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
      <th style={{ width: '16rem' }}>{label}</th>
      <td>
        <Wert value={value} />
      </td>
    </tr>
  )
}
