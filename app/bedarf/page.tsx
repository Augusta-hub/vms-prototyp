/**
 * Bedarfsanfragen — SPEC 3.4 mit dem Statusmodell 4.1, dazu Ausschreibung und
 * Einladung (3.5, 4.2.1) und die Angebote (4.2.2).
 *
 * Angezeigt werden nur die Übergänge, die **diese** Rolle an **diesem**
 * Vorgang auslösen darf; welcher Übergang aus welchem Zustand führt, sagt
 * Kapitel 4 (lib/status/). Ein Zustandswechsel ohne Schaltfläche ist keine
 * Lücke der Oberfläche, sondern die Aussage der Spezifikation.
 */
import {
  loadDemandFormOptions,
  loadDemandRequests,
  type DemandRequestListEntry,
  type InvitationSummary,
  type OfferSummary,
} from '../../lib/services/demand'
import { DEMAND_REQUEST_STATE_LABELS } from '../../lib/status/demandRequest'
import { SUPPLIER_OFFER_STATE_LABELS } from '../../lib/status/supplierOffer'
import { TENDER_INVITATION_STATE_LABELS } from '../../lib/status/tenderInvitation'
import { currentIdentity } from '../identity'
import { Meldung, Status, Verdeckt, Wert } from '../ui'
import {
  createDemandRequestAction,
  publishTenderAction,
  runSystemDeadlinesAction,
  transitionDemandRequestAction,
  transitionOfferAction,
} from './actions'

export const dynamic = 'force-dynamic'

/** Übergänge, für die Kapitel 4 eine Begründung zur Pflicht macht. */
const REASON_REQUIRED = new Set(['returnToDraft', 'cancel', 'reject'])

export default async function BedarfPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; fehler?: string }>
}) {
  const params = await searchParams
  const { identity, hint } = await currentIdentity()

  if (identity === null) {
    return (
      <>
        <h1>Bedarfsanfragen</h1>
        <p className="hint">{hint}</p>
      </>
    )
  }

  const requests = await loadDemandRequests(identity)
  const options = await loadDemandFormOptions(identity)

  return (
    <>
      <h1>Bedarfsanfragen</h1>
      <p>
        Bedarf melden, einreichen, freigeben und ausschreiben — Zustände und Übergänge nach
        SPEC 4.1. Die Angebotsfrist und der Ablauf sind Systemübergänge; sie entziehen nur und
        gewähren nichts (4.0, Regel 4).
      </p>
      <Meldung ok={params.ok} fehler={params.fehler} />

      {options.mayRunSystemDeadlines ? (
        <form action={runSystemDeadlinesAction}>
          <button type="submit">Fristenlauf starten (Systemübergänge 4.1, 4.2)</button>
        </form>
      ) : null}

      {requests.length === 0 ? (
        <p className="hint">Für diese Rolle ist keine Bedarfsanfrage sichtbar (2.3, Grundsatz).</p>
      ) : (
        requests.map((request) => <Anfrage key={request.id} request={request} options={options} />)
      )}

      {options.mayCreate && options.sites.length > 0 && options.costCenters.length > 0 ? (
        <form action={createDemandRequestAction}>
          <fieldset>
            <legend>Bedarfsanfrage anlegen — entsteht im Entwurf (4.1, — → draft)</legend>
            <div className="grid">
              <Feld name="requestNumber" label="Anfragenummer" required />
              <Feld name="title" label="Titel" required />
              <Auswahl name="siteId" label="Standort" options={options.sites} />
              <Auswahl name="costCenterId" label="Kostenstelle" options={options.costCenters} />
              {options.demandOwners.length > 0 ? (
                <Auswahl
                  name="requestedById"
                  label="Bedarfsträger (Auftraggeber, Fußnote [10])"
                  options={options.demandOwners}
                />
              ) : null}
              <Feld name="headcount" label="Anzahl" required />
              <Feld name="startDate" label="Beginn" type="date" required />
              <Feld name="endDate" label="Ende (leer = unbefristet)" type="date" />
              <Feld name="weeklyHours" label="Wochenstunden" required />
              <Feld name="maxHourlyRate" label="Kostenrahmen je Stunde" />
            </div>
            <label className="field">
              Tätigkeitsbeschreibung (Konkretisierung, 5.3)
              <textarea name="activityDescription" rows={2} required />
            </label>
            <label className="field">
              Anforderung (Qualifikation, Pflicht)
              <input name="qualification" required />
            </label>
            <label className="field">
              Interner Vermerk (für Lieferanten nicht sichtbar, [14])
              <input name="internalNote" />
            </label>
            <button type="submit">Bedarfsanfrage anlegen</button>
          </fieldset>
        </form>
      ) : null}
    </>
  )
}

function Anfrage({
  request,
  options,
}: {
  readonly request: DemandRequestListEntry
  readonly options: Awaited<ReturnType<typeof loadDemandFormOptions>>
}) {
  const fields = request.fields
  const mayPublish = request.availableTransitions.some(
    (transition) => transition.name === 'publishTender' || transition.name === 'openNextRound',
  )

  return (
    <fieldset>
      <legend>
        <Wert value={fields.requestNumber} /> — <Wert value={fields.title} /> ·{' '}
        <Status value={`${request.status} (${DEMAND_REQUEST_STATE_LABELS[request.status]})`} />
        {request.terminal ? ' · Endzustand' : ''}
      </legend>

      <table>
        <tbody>
          <Zeile label="Kunde" value={fields.customer} />
          <Zeile label="Standort" value={fields.site} />
          <Zeile label="Kostenstelle" value={fields.costCenterNumber} />
          <Zeile label="Tätigkeit" value={fields.activityDescription} />
          <Zeile label="Anforderungen" value={fields.qualifications} />
          <Zeile label="Anzahl" value={fields.headcount} />
          <Zeile label="Beginn" value={fields.startDate} />
          <Zeile label="Ende" value={fields.endDate} />
          <Zeile label="Wochenstunden" value={fields.weeklyHours} />
          <Zeile label="Angebotsfrist" value={fields.offerDeadline} />
          <Zeile label="Kostenrahmen" value={fields.maxHourlyRate} />
          <Zeile label="Interner Vermerk" value={fields.internalNote} />
          <Zeile label="Bedarfsträger" value={fields.requestedBy} />
          <Zeile label="Freigegeben von" value={fields.approvedBy} />
          <Zeile label="Rückweisungsgrund" value={fields.rejectionReason} />
          <Zeile label="Stornogrund" value={fields.cancellationReason} />
        </tbody>
      </table>
      <Verdeckt fields={request.concealed} />

      <div className="actions">
        {request.availableTransitions.length === 0 ? (
          <span className="hint">
            Kein Übergang, den diese Rolle an diesem Vorgang auslösen darf (2.2, Kapitel 4).
          </span>
        ) : (
          request.availableTransitions
            .filter(
              (transition) =>
                transition.name !== 'publishTender' && transition.name !== 'openNextRound',
            )
            .map((transition) => (
              <form key={transition.name} action={transitionDemandRequestAction} className="inline">
                <input type="hidden" name="demandRequestId" value={request.id} />
                <input type="hidden" name="transition" value={transition.name} />
                {REASON_REQUIRED.has(transition.name) ? (
                  <input name="reason" placeholder="Begründung (Pflicht)" required />
                ) : null}
                <button type="submit">{transition.label}</button>
              </form>
            ))
        )}
      </div>

      {mayPublish && options.suppliers.length > 0 ? (
        <details>
          <summary>Ausschreiben: Lieferanten einladen (3.5, 4.1 und 4.2.1)</summary>
          <form action={publishTenderAction}>
            <input type="hidden" name="demandRequestId" value={request.id} />
            <p className="hint">
              Jede Einladung wird einzeln geprüft: der Lieferant muss <code>active</code> sein
              (4.6) und eine anerkannte, gültige AÜG-Erlaubnis haben (5.4, Prüfung P9). Die
              Benachrichtigungen gehen je Lieferant einzeln (2.3, Regel 2).
            </p>
            {options.suppliers.map((supplier) => (
              <label key={supplier.id} className="field">
                <input type="checkbox" name="supplierIds" value={supplier.id} /> {supplier.label}
              </label>
            ))}
            <div className="grid">
              <label className="field">
                Angebotsfrist
                <input name="offerDeadline" type="datetime-local" required />
              </label>
              <label className="field">
                Verteilungsart
                <select name="distributionMode">
                  <option value="simultaneous">gleichzeitig an alle</option>
                  <option value="staged">in Wellen</option>
                </select>
              </label>
            </div>
            <button type="submit">Ausschreibung veröffentlichen</button>
          </form>
        </details>
      ) : null}

      {request.tenders.map((tender) => (
        <details key={tender.id} open>
          <summary>
            Ausschreibung {tender.tenderNumber} · Runde {tender.tenderRound} · Frist{' '}
            {tender.offerDeadline}
            {tender.closedAt === null ? '' : ` · geschlossen ${tender.closedAt}`}
          </summary>
          {tender.invitations.length === 0 ? (
            <p className="hint">Keine Einladung sichtbar.</p>
          ) : (
            tender.invitations.map((invitation) => (
              <Einladung key={invitation.id} invitation={invitation} />
            ))
          )}
        </details>
      ))}
    </fieldset>
  )
}

function Einladung({ invitation }: { readonly invitation: InvitationSummary }) {
  return (
    <div>
      <p>
        Einladung an <Wert value={invitation.fields.supplier} /> ·{' '}
        <Status
          value={`${invitation.status} (${TENDER_INVITATION_STATE_LABELS[invitation.status]})`}
        />
        {invitation.fields.declineReason === undefined ? null : invitation.fields
            .declineReason === null ? null : (
          <> · Absagegrund: {invitation.fields.declineReason}</>
        )}
      </p>
      <Verdeckt fields={invitation.concealed} />
      {invitation.offer === null ? null : <Angebot offer={invitation.offer} />}
    </div>
  )
}

function Angebot({ offer }: { readonly offer: OfferSummary }) {
  return (
    <div>
      <p>
        Angebot <Wert value={offer.fields.offerNumber} /> ·{' '}
        <Status value={`${offer.status} (${SUPPLIER_OFFER_STATE_LABELS[offer.status]})`} /> ·
        verfügbar ab <Wert value={offer.fields.availableFrom} /> · angebotene Anzahl{' '}
        <Wert value={offer.fields.offeredHeadcount} />
      </p>
      <table>
        <thead>
          <tr>
            <th>Qualifikationsstufe</th>
            <th>Anzahl</th>
            <th>Verrechnungssatz</th>
            <th>Abweichungsgrund</th>
          </tr>
        </thead>
        <tbody>
          {offer.items.map((item, index) => (
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
              <td>
                <Wert value={item.rateDeviationReason} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <Verdeckt fields={offer.concealed} />
      <div className="actions">
        {offer.availableTransitions.map((transition) => (
          <form key={transition.name} action={transitionOfferAction} className="inline">
            <input type="hidden" name="offerId" value={offer.id} />
            <input type="hidden" name="transition" value={transition.name} />
            {REASON_REQUIRED.has(transition.name) ? (
              <input name="reason" placeholder="Begründung ohne Fremdbezug (2.3)" required />
            ) : null}
            <button type="submit">{transition.label}</button>
          </form>
        ))}
      </div>
    </div>
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
      <th style={{ width: '14rem' }}>{label}</th>
      <td>
        <Wert value={value} />
      </td>
    </tr>
  )
}

function Feld({
  name,
  label,
  type = 'text',
  required = false,
}: {
  readonly name: string
  readonly label: string
  readonly type?: string
  readonly required?: boolean
}) {
  return (
    <label className="field">
      {label}
      <input name={name} type={type} required={required} />
    </label>
  )
}

function Auswahl({
  name,
  label,
  options,
}: {
  readonly name: string
  readonly label: string
  readonly options: readonly { readonly id: string; readonly label: string }[]
}) {
  return (
    <label className="field">
      {label}
      <select name={name}>
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  )
}
