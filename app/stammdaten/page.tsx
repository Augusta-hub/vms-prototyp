/**
 * Stammdaten — SPEC 3.1, 3.2 und 3.3.
 *
 * Die Seite listet, was die gewählte Testidentität sehen darf, und zeigt nur
 * die Formulare, deren Anlegen die Matrix 2.2 dieser Rolle erlaubt. Eine Liste
 * ist keine Ausnahme von der Mandantengrenze (2.3, Grundsatz): gelistet wird,
 * was `checkPermission` für diese Identität erlaubt.
 *
 * Felder, die eine Fußnote dieser Rolle nicht zeigt, erscheinen als „nicht
 * sichtbar" — benannt, nicht als Lücke.
 */
import {
  loadMasterData,
  loadMasterDataOptions,
  type VisibleRow,
} from '../../lib/services/masterData'
import {
  loadSupplierStatus,
  reasonFieldFor,
  SUPPLIER_TRANSITION_LABELS,
  type SupplierStatusView,
} from '../../lib/services/supplierStatus'
import { currentIdentity } from '../identity'
import { Meldung, Status, Verdeckt, Wert } from '../ui'
import {
  createComparableWageAction,
  createCostCenterAction,
  createCustomerAction,
  createPermitAction,
  createSiteAction,
  createSupplierAction,
  transitionSupplierAction,
} from './actions'

export const dynamic = 'force-dynamic'

export default async function StammdatenPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; fehler?: string }>
}) {
  const params = await searchParams
  const { identity, hint } = await currentIdentity()

  if (identity === null) {
    return (
      <>
        <h1>Stammdaten</h1>
        <p className="hint">{hint}</p>
      </>
    )
  }

  const data = await loadMasterData(identity)
  const options = await loadMasterDataOptions(identity)
  const mayCreate = options.mayCreate
  const supplierStatus = await loadSupplierStatus(identity)

  return (
    <>
      <h1>Stammdaten</h1>
      <p>
        Kunde, Standort und Kostenstelle (SPEC 3.1), Lieferant und AÜG-Erlaubnis (3.2),
        Rahmenvertrag, Preisliste, Tarifzuordnung und Vergleichsentgelt (3.3).
      </p>
      <Meldung ok={params.ok} fehler={params.fehler} />

      <h2>Kunden (3.1)</h2>
      <Liste
        rows={data.customers}
        columns={[
          ['Kundennummer', 'customerNumber'],
          ['Firmenname', 'legalName'],
          ['Ort', 'addressCity'],
          ['Branche', 'industrySector'],
          ['Konzern', 'corporateGroup'],
          ['Ansprechpartner', 'contacts'],
          ['gültig ab', 'validFrom'],
        ]}
      />
      {mayCreate.customer ? (
        <form action={createCustomerAction}>
          <fieldset>
            <legend>Kunde anlegen — legt auch den Kundenmandanten an (3.1, 3.11)</legend>
            <div className="grid">
              <Feld name="customerNumber" label="Kundennummer" required />
              <Feld name="legalName" label="Firmenname" required />
              <Feld name="addressStreet" label="Straße" />
              <Feld name="addressPostalCode" label="PLZ" />
              <Feld name="addressCity" label="Ort" />
              <Feld name="industrySector" label="Branche" />
              <Feld name="contactName" label="Ansprechpartner" required />
              <Feld name="validFrom" label="gültig ab" type="date" required />
            </div>
            <button type="submit">Kunde anlegen</button>
          </fieldset>
        </form>
      ) : null}

      <h2>Standorte (3.1)</h2>
      <Liste
        rows={data.sites}
        columns={[
          ['Standortnummer', 'siteNumber'],
          ['Bezeichnung', 'name'],
          ['Kunde', 'customer'],
          ['Ort', 'addressCity'],
          ['Regelarbeitszeit', 'standardWeeklyHours'],
          ['Unterweisung nötig', 'safetyBriefingRequired'],
          ['gültig ab', 'validFrom'],
        ]}
      />
      {mayCreate.site && options.customers.length > 0 ? (
        <form action={createSiteAction}>
          <fieldset>
            <legend>Standort anlegen (3.1)</legend>
            <div className="grid">
              <Auswahl name="customerId" label="Kunde" options={options.customers} />
              <Feld name="siteNumber" label="Standortnummer" required />
              <Feld name="name" label="Bezeichnung" required />
              <Feld name="addressStreet" label="Straße" />
              <Feld name="addressPostalCode" label="PLZ" />
              <Feld name="addressCity" label="Ort" />
              <Feld name="standardWeeklyHours" label="Regelarbeitszeit (Std./Woche)" />
              <Auswahl
                name="safetyBriefingRequired"
                label="Unterweisung erforderlich"
                options={[
                  { id: 'ja', label: 'ja' },
                  { id: 'nein', label: 'nein' },
                ]}
              />
              <Feld name="validFrom" label="gültig ab" type="date" required />
            </div>
            <button type="submit">Standort anlegen</button>
          </fieldset>
        </form>
      ) : null}

      <h2>Kostenstellen (3.1)</h2>
      <p className="hint">
        Die Kostenstelle ist eine interne Zuordnung des Kunden und für Lieferanten nie sichtbar
        (Fußnote [14] in 2.2).
      </p>
      <Liste
        rows={data.costCenters}
        columns={[
          ['Nummer', 'costCenterNumber'],
          ['Bezeichnung', 'name'],
          ['Kunde', 'customer'],
          ['Standort', 'site'],
          ['Budget', 'budgetAmount'],
          ['gültig ab', 'validFrom'],
        ]}
      />
      {mayCreate.costCenter && options.customers.length > 0 ? (
        <form action={createCostCenterAction}>
          <fieldset>
            <legend>Kostenstelle anlegen (3.1)</legend>
            <div className="grid">
              <Auswahl name="customerId" label="Kunde" options={options.customers} />
              <Feld name="costCenterNumber" label="Kostenstellennummer" required />
              <Feld name="name" label="Bezeichnung" required />
              <Auswahl
                name="siteId"
                label="Standort (optional)"
                options={[{ id: '', label: '— keiner —' }, ...options.sites]}
              />
              <Feld name="validFrom" label="gültig ab" type="date" required />
            </div>
            <button type="submit">Kostenstelle anlegen</button>
          </fieldset>
        </form>
      ) : null}

      <h2>Lieferanten (3.2)</h2>
      <Liste
        rows={data.suppliers}
        columns={[
          ['Lieferantennummer', 'supplierNumber'],
          ['Firmenname', 'legalName'],
          ['Ort', 'addressCity'],
          ['Status (4.6)', 'status'],
          ['Verleihertarif', 'collectiveAgreement'],
          ['Ansprechpartner', 'contacts'],
          ['gültig ab', 'validFrom'],
        ]}
      />
      {mayCreate.supplier ? (
        <form action={createSupplierAction}>
          <fieldset>
            <legend>
              Lieferant anlegen — entsteht in <code>onboarding</code> (4.6) mit eigenem Mandanten
            </legend>
            <div className="grid">
              <Feld name="supplierNumber" label="Lieferantennummer" required />
              <Feld name="legalName" label="Firmenname" required />
              <Feld name="addressStreet" label="Straße" />
              <Feld name="addressPostalCode" label="PLZ" />
              <Feld name="addressCity" label="Ort" />
              <Feld name="contactName" label="Ansprechpartner" required />
              <Feld name="validFrom" label="gültig ab" type="date" required />
            </div>
            <button type="submit">Lieferant anlegen</button>
          </fieldset>
        </form>
      ) : null}

      <h2>Lieferantenstatus (4.6)</h2>
      <p className="hint">
        Vier Zustände: <code>onboarding</code> → <code>active</code> ↔ <code>blocked</code>, und
        aus allen dreien <code>inactive</code>. Die AÜG-Erlaubnis ist dabei{' '}
        <strong>Vorbedingung, nicht Zustand</strong> — ihr Ablauf wechselt keinen Status (5.4.2 a),
        sondern sperrt jede neue Einladung und jeden Einsatzstart über P9. Beim Freischalten,
        Entsperren und Reaktivieren rechnen P9 und P10 (4.7, Q41 bis Q44); was fehlt, steht unten
        im Klartext und nicht nur als fehlender Knopf.
      </p>
      {supplierStatus.length === 0 ? (
        <p className="hint">Kein Lieferant sichtbar.</p>
      ) : (
        supplierStatus.map((supplier) => (
          <Lieferantenstatus key={supplier.id} supplier={supplier} />
        ))
      )}

      <h2>AÜG-Erlaubnis (3.2)</h2>
      <p className="hint">
        Einkauf/Controlling des Kunden sieht nur Gültigkeitsstatus und Ablaufdatum der beauftragten
        Lieferanten, nicht die Urkunde (Fußnote [36], 3.2).
      </p>
      <Liste
        rows={data.permits}
        columns={[
          ['Lieferant', 'supplier'],
          ['Erlaubnisnummer', 'permitNumber'],
          ['Behörde', 'issuingAuthority'],
          ['Art', 'permitType'],
          ['gültig ab', 'validFrom'],
          ['gültig bis', 'validTo'],
          ['Anerkennung', 'verificationStatus'],
          ['Urkunde', 'certificateDocumentRef'],
        ]}
      />
      {mayCreate.supplierPermit && options.suppliers.length > 0 ? (
        <form action={createPermitAction}>
          <fieldset>
            <legend>Erlaubnis einreichen — Anerkennung durch den MSP-Disponenten (5.4.3)</legend>
            <div className="grid">
              <Auswahl name="supplierId" label="Lieferant" options={options.suppliers} />
              <Feld name="permitNumber" label="Erlaubnisnummer" required />
              <Feld name="issuingAuthority" label="Erlaubnisbehörde" required />
              <Auswahl
                name="permitType"
                label="Erlaubnisart"
                options={[
                  { id: 'fixedTerm', label: 'befristet' },
                  { id: 'unlimited', label: 'unbefristet' },
                ]}
              />
              <Feld name="issuedOn" label="erteilt am" type="date" required />
              <Feld name="validFrom" label="gültig ab" type="date" required />
              <Feld name="validTo" label="gültig bis (nur befristet)" type="date" />
              <Feld name="certificateDocumentRef" label="Urkunde (Verweis, 3.10)" />
            </div>
            <button type="submit">Erlaubnis einreichen</button>
          </fieldset>
        </form>
      ) : null}

      <h2>Rahmenverträge (3.3)</h2>
      <p className="hint">
        Der Prototyp kennt zwei Vertragsstrecken: Betreiber ↔ Kunde und Betreiber ↔ Lieferant. Ein
        Direktvertrag zwischen Kunde und Lieferant ist nicht vorgesehen (3.3).
      </p>
      <Liste
        rows={data.agreements}
        columns={[
          ['Vertragsnummer', 'agreementNumber'],
          ['Art', 'agreementType'],
          ['Gegenpartei', 'counterparty'],
          ['gültig ab', 'validFrom'],
          ['gültig bis', 'validTo'],
          ['Zahlungsziel (Tage)', 'paymentTermsDays'],
          ['Status', 'status'],
        ]}
      />

      <h2>Preislisten (3.3)</h2>
      <p className="hint">
        Kundenrollen sehen nie die Einkaufsseite, Lieferantenrollen nie die Kundenseite (Fußnoten
        [41] und [42]). Die Differenz ist die Marge des Betreibers.
      </p>
      {data.rateCards.length === 0 ? (
        <p className="hint">Keine Preisliste sichtbar.</p>
      ) : (
        data.rateCards.map((rateCard) => (
          <div key={rateCard.id}>
            <h3>
              <Wert value={rateCard.fields.rateCardNumber} /> —{' '}
              <Wert value={rateCard.fields.rateCardScope} /> für{' '}
              <Wert value={rateCard.fields.counterparty} /> (
              <Wert value={rateCard.fields.status} />)
            </h3>
            <table>
              <thead>
                <tr>
                  <th>Positionsart</th>
                  <th>Qualifikationsstufe</th>
                  <th>Verrechnungssatz</th>
                  <th>Zuschlagswert</th>
                  <th>Mindestabrechnung</th>
                </tr>
              </thead>
              <tbody>
                {rateCard.items.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <Wert value={item.fields.itemType} />
                    </td>
                    <td>
                      <Wert value={item.fields.qualificationLevel} />
                    </td>
                    <td>
                      <Wert value={item.fields.hourlyRate} />
                    </td>
                    <td>
                      <Wert value={item.fields.premiumValue} />
                    </td>
                    <td>
                      <Wert value={item.fields.minimumHours} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))
      )}

      <h2>Tarifzuordnungen (3.3)</h2>
      <Liste
        rows={data.collectiveAgreements}
        columns={[
          ['Tarifvertrag', 'collectiveAgreement'],
          ['gilt für', 'appliesToType'],
          ['Zielobjekt', 'target'],
          ['Höchstüberlassung (Monate)', 'maxAssignmentDurationMonths'],
          ['Equal-Pay-Frist (Monate)', 'equalPayDeadlineMonths'],
          ['Branchenzuschlagsschema', 'industryPremiumScheme'],
          ['gültig ab', 'validFrom'],
        ]}
      />

      <h2>Vergleichsentgelte (3.3)</h2>
      <p className="hint">
        Geführt je Tätigkeit am Standort, gepflegt vom Entleiher; für Lieferantenrollen ist der
        Katalog nicht sichtbar (3.3, Entscheidung zu Frage 15).
      </p>
      <Liste
        rows={data.comparableWages}
        columns={[
          ['Standort', 'site'],
          ['Tätigkeit', 'activityKey'],
          ['Vergleichsentgelt', 'comparableWage'],
          ['Währung', 'currency'],
          ['Herkunft', 'wageSource'],
          ['gültig ab', 'validFrom'],
          ['gemeldet am', 'reportedAt'],
        ]}
      />
      {mayCreate.comparableWageEntry && options.sites.length > 0 ? (
        <form action={createComparableWageAction}>
          <fieldset>
            <legend>Vergleichsentgelt melden (3.3, Grundlage für Equal Pay 5.2)</legend>
            <div className="grid">
              <Auswahl name="siteId" label="Standort" options={options.sites} />
              <Feld name="activityKey" label="Tätigkeit / Entgeltgruppe" required />
              <Feld name="comparableWage" label="Vergleichsentgelt je Stunde" required />
              <Auswahl
                name="wageSource"
                label="Herkunft der Angabe"
                options={[
                  { id: 'collectiveAgreement', label: 'Tarifvertrag' },
                  { id: 'companyAgreement', label: 'Betriebsvereinbarung' },
                  { id: 'individualContract', label: 'Einzelvertrag' },
                  { id: 'estimate', label: 'Schätzung (nur Warnung, 5.2)' },
                ]}
              />
              <Feld name="validFrom" label="gültig ab" type="date" required />
            </div>
            <button type="submit">Vergleichsentgelt melden</button>
          </fieldset>
        </form>
      ) : null}
    </>
  )
}

function Liste<T extends object>({
  rows,
  columns,
}: {
  readonly rows: readonly VisibleRow<T>[]
  readonly columns: readonly (readonly [string, keyof T & string])[]
}) {
  if (rows.length === 0) {
    return <p className="hint">Für diese Rolle ist hier nichts sichtbar (2.3, Grundsatz).</p>
  }
  const concealed = rows[0]?.concealed ?? []
  return (
    <>
      <table>
        <thead>
          <tr>
            {columns.map(([label]) => (
              <th key={label}>{label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              {columns.map(([label, field]) => (
                <td key={label}>
                  <Wert value={row.fields[field] as string | null | undefined} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <Verdeckt fields={concealed} />
    </>
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

/**
 * Ein Lieferant mit seinem Status, den Handlungen, die 4.6 dieser Rolle aus
 * diesem Zustand zulässt, und den Befunden aus Kapitel 5.
 *
 * Angeboten wird nur, was die Rolle auslösen **darf** — die Vorbedingungen
 * stehen daneben als Text. Ein Knopf, den eine fehlende Vorbedingung
 * verschwinden lässt, würde die Lage verschweigen (5.4.6: die Meldung nennt
 * Nachweisart und Bezugsobjekt, nicht „Nachweise unvollständig").
 */
function Lieferantenstatus({ supplier }: { readonly supplier: SupplierStatusView }) {
  return (
    <fieldset>
      <legend>
        {supplier.supplierNumber} — {supplier.legalName} ·{' '}
        <Status value={supplier.stateLabel} />
      </legend>

      {supplier.blockReason === null ? null : (
        <p>
          Sperrgrund: <Wert value={supplier.blockReason} />
          {supplier.unblockReason === null ? null : (
            <>
              {' '}
              · Aufhebungsgrund: <Wert value={supplier.unblockReason} />
            </>
          )}
        </p>
      )}
      {supplier.reactivationReason === null ? null : (
        <p>
          Reaktivierungsgrund: <Wert value={supplier.reactivationReason} />
        </p>
      )}
      {supplier.validTo === null ? null : (
        <p>
          Beauftragung endet: <Wert value={supplier.validTo} />
        </p>
      )}

      <ul>
        {supplier.findings.map((finding) => (
          <li key={finding.check}>
            <strong>{finding.check}</strong> {finding.satisfied ? '✓' : '✗'} — {finding.message}
          </li>
        ))}
      </ul>

      {supplier.blockers.length > 0 ? (
        <p className="hint">
          Offene Vorbedingungen für den nächsten Übergang nach <code>active</code>:{' '}
          {supplier.blockers.join(' · ')}
        </p>
      ) : null}
      {supplier.runningAssignments > 0 ? (
        <p className="hint">
          {supplier.runningAssignments} laufender Einsatz bzw. laufende Einsätze — die Beauftragung
          lässt sich erst beenden, wenn sie beendet sind (4.6, 4.3).
        </p>
      ) : null}

      {supplier.availableTransitions.length === 0 ? (
        <p className="hint">Diese Rolle löst aus diesem Zustand keinen Übergang aus (2.2, 4.6).</p>
      ) : (
        supplier.availableTransitions
          .filter((transition) => transition !== 'create')
          .map((transition) => {
            const reason = reasonFieldFor(
              transition as Exclude<typeof transition, 'create'>,
            )
            return (
              <form key={transition} action={transitionSupplierAction}>
                <input type="hidden" name="supplierId" value={supplier.id} />
                <input type="hidden" name="transition" value={transition} />
                {reason === null ? null : (
                  <label className="field">
                    Begründung (Pflicht, 4.6)
                    <input name={reason} required />
                  </label>
                )}
                {transition === 'deactivate' ? (
                  <label className="field">
                    Ende der Beauftragung (`validTo`, Pflicht)
                    <input type="date" name="validTo" required />
                  </label>
                ) : null}
                <button type="submit">
                  {SUPPLIER_TRANSITION_LABELS[transition as Exclude<typeof transition, 'create'>]}
                </button>
              </form>
            )
          })
      )}
    </fieldset>
  )
}
