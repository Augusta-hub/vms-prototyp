/**
 * Abrechnung — SPEC 3.9 (Objekte) und 4.5 (Statusmodelle).
 *
 * Die Seite zeigt, was die gewählte Testidentität sehen und auslösen darf: der
 * Betreiber erstellt, prüft, gibt frei, klärt und storniert; `KE` beanstandet
 * die **Kundenseite** ([31]), `LD` bestätigt oder beanstandet die
 * **Lieferantenseite** ([32]). Mehr gibt die Matrix den Gegenseiten nicht —
 * und `KB` und `KG` sehen den Beleg überhaupt nicht.
 *
 * Vier Dinge macht die Seite ausdrücklich sichtbar, weil sie fachlich tragen:
 *
 *  - die **Herkunft jeder Menge**: jede Position nennt ihren Stundenzettel und
 *    ihren Einsatz, und nichts davon ist eine Eingabe (3.9),
 *  - die **Herkunft jedes Preises**: kommt er aus einer Preisposition (3.3)
 *    oder aus einem abweichenden Satz am Einsatz (*offene Frage 17*)?
 *  - die **Befunde** aus Kapitel 5 (Q38 bis Q40) — am Beleg **keine Sperre**,
 *    weil die Leistung erbracht ist (5.5.5),
 *  - den **Stand der Periode**: was ihrem Schluss noch entgegensteht, steht
 *    da, statt nur einen Knopf zu verstecken (*offene Frage 24*).
 */
import {
  loadBillingDocuments,
  loadBillingOptions,
  loadBillingPeriods,
  type BillingDocumentView,
  type BillingPeriodView,
} from '../../lib/services/billing'
import { currentIdentity } from '../identity'
import { Meldung, Status, Wert } from '../ui'
import {
  cancelDocumentAction,
  closePeriodAction,
  createDocumentAction,
  openPeriodAction,
  transitionDocumentAction,
} from './actions'

export const dynamic = 'force-dynamic'

const EURO = new Intl.NumberFormat('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 4 })

export default async function AbrechnungPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; fehler?: string }>
}) {
  const params = await searchParams
  const { identity, hint } = await currentIdentity()

  if (identity === null) {
    return (
      <>
        <h1>Abrechnung</h1>
        <p className="hint">{hint}</p>
      </>
    )
  }

  const [documents, periods, options] = await Promise.all([
    loadBillingDocuments(identity),
    loadBillingPeriods(identity),
    loadBillingOptions(identity),
  ])

  return (
    <>
      <h1>Abrechnung (SPEC 3.9, 4.5)</h1>
      <p>
        Abrechnungsperiode, Abrechnungsbeleg und Belegposition. Der Beleg bildet ab, was{' '}
        <strong>genehmigte</strong> Zeiten und Konditionen ergeben; er ist{' '}
        <strong>kein Zahlungsvorgang</strong> (1.4). Auf der Lieferantenseite gilt das{' '}
        <strong>Gutschriftverfahren</strong>: der Betreiber erstellt, der Lieferant bestätigt oder
        beanstandet (Entscheidung zu Frage 6).
      </p>

      <Meldung ok={params.ok} fehler={params.fehler} />

      <h2>Abrechnungsperioden (3.9, 4.5.1)</h2>
      {periods.length === 0 ? (
        <p className="hint">Keine Periode sichtbar.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Nummer</th>
              <th>Kunde</th>
              <th>Zeitraum</th>
              <th>Schlusstermin</th>
              <th>Status</th>
              <th>offene Zettel</th>
              <th>nicht abgegebene Belege</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {periods.map((periode) => (
              <Periode key={periode.id} periode={periode} />
            ))}
          </tbody>
        </table>
      )}

      {options.mayOpenPeriod ? (
        <form action={openPeriodAction}>
          <p>
            <label htmlFor="periodNumber">Nummer: </label>
            <input id="periodNumber" name="periodNumber" required placeholder="2026-12" />{' '}
            <label htmlFor="periodFrom">von: </label>
            <input id="periodFrom" name="periodFrom" type="date" required />{' '}
            <label htmlFor="periodTo">bis: </label>
            <input id="periodTo" name="periodTo" type="date" required />{' '}
            <label htmlFor="closingDate">Schlusstermin: </label>
            <input id="closingDate" name="closingDate" type="date" required />{' '}
            <button type="submit">Periode öffnen</button>
          </p>
          <p className="hint">
            Das Öffnen ist ein <strong>Übergang</strong> und keine Anlage: Fußnote [33] nennt
            „Öffnen und Schließen" ausdrücklich als Statusvorgang, und die Matrix gibt dem{' '}
            <code>MD</code> auf dieser Zeile kein <code>A</code>. Geschlossen ist ein{' '}
            <strong>Endzustand</strong> — es gibt keinen Weg zurück (4.5.1).
          </p>
        </form>
      ) : null}

      {options.mayCreate ? (
        <>
          <h2>Beleg erstellen (4.5.2)</h2>
          {options.billable.length === 0 ? (
            <p className="hint">
              In keiner offenen Periode liegen genehmigte, noch nicht abgerechnete Stundenzettel.
              Ein Beleg entsteht ausschließlich aus genehmigten Zetteln (3.9, 4.4).
            </p>
          ) : (
            <table>
              <caption>
                Was abzurechnen ist: gezählt, nicht geschätzt. Ein Zettel, der schon auf einem
                nicht stornierten Beleg <strong>derselben Seite</strong> steht, ist abgerechnet;
                die andere Seite rechnet ihn sehr wohl noch ab.
              </caption>
              <thead>
                <tr>
                  <th>Periode</th>
                  <th>Seite</th>
                  <th>Gegenseite</th>
                  <th>Zettel</th>
                </tr>
              </thead>
              <tbody>
                {options.billable.map((zeile) => (
                  <tr key={`${zeile.periodNumber}-${zeile.direction}-${zeile.counterpartyId}`}>
                    <td>{zeile.periodNumber}</td>
                    <td>{zeile.direction === 'sales' ? 'Verkauf' : 'Einkauf'}</td>
                    <td>{zeile.counterparty}</td>
                    <td>{zeile.timesheetCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <form action={createDocumentAction}>
            <p>
              <label htmlFor="billingPeriodId">Periode: </label>
              <select id="billingPeriodId" name="billingPeriodId" required>
                {options.periods.map((periode) => (
                  <option key={periode.id} value={periode.id}>
                    {periode.label}
                  </option>
                ))}
              </select>{' '}
              <label htmlFor="direction">Seite: </label>
              <select id="direction" name="direction">
                <option value="sales">Verkauf (Rechnung an den Kunden)</option>
                <option value="purchase">Einkauf (Gutschrift an den Lieferanten)</option>
              </select>
            </p>
            <p>
              <label htmlFor="customerId">Kunde: </label>
              <select id="customerId" name="customerId">
                <option value="">—</option>
                {options.customers.map((kunde) => (
                  <option key={kunde.id} value={kunde.id}>
                    {kunde.label}
                  </option>
                ))}
              </select>{' '}
              <label htmlFor="supplierId">Lieferant: </label>
              <select id="supplierId" name="supplierId">
                <option value="">—</option>
                {options.suppliers.map((lieferant) => (
                  <option key={lieferant.id} value={lieferant.id}>
                    {lieferant.label}
                  </option>
                ))}
              </select>{' '}
              <label htmlFor="taxRate">Steuersatz (%): </label>
              <input id="taxRate" name="taxRate" size={5} required placeholder="19" />{' '}
              <button type="submit">Beleg erstellen</button>
            </p>
            <p className="hint">
              Der <strong>Steuersatz</strong> ist eine Angabe am Beleg, weil kein Kapitel sagt,
              woher er kommt (<em>offene Frage 52</em>). Ein Satz im Programm wäre ein Festwert
              ohne Fundstelle, und 0 % wäre eine stillschweigende Behauptung über die
              Steuerpflicht. Gerechnet wird <strong>ungerundet</strong> (<em>offene Frage 53</em>).
            </p>
          </form>
        </>
      ) : null}

      <h2>Abrechnungsbelege (3.9, 4.5.2)</h2>
      {documents.length === 0 ? (
        <p className="hint">Kein Beleg sichtbar.</p>
      ) : (
        documents.map((beleg) => <Beleg key={beleg.id} beleg={beleg} />)
      )}
    </>
  )
}

function Periode({ periode }: { readonly periode: BillingPeriodView }) {
  return (
    <tr>
      <td>{periode.periodNumber}</td>
      <td>
        <Wert value={periode.customer} />
      </td>
      <td>{periode.period}</td>
      <td>{periode.closingDate}</td>
      <td>
        <Status value={periode.statusLabel} />
      </td>
      <td>{periode.undecidedTimesheets}</td>
      <td>{periode.unfinishedDocuments}</td>
      <td>
        {periode.status === 'closed' ? null : periode.mayClose ? (
          <form action={closePeriodAction}>
            <input type="hidden" name="billingPeriodId" value={periode.id} />
            <button type="submit">schließen (4.5.1)</button>
          </form>
        ) : (
          <span className="hint">
            <Wert value={periode.closeObstacle} />
          </span>
        )}
      </td>
    </tr>
  )
}

function Beleg({ beleg }: { readonly beleg: BillingDocumentView }) {
  const kann = (name: string) => beleg.availableTransitions.some((u) => u.name === name)
  const beanstandet = kann('disputeBySales') || kann('disputeByPurchase')
  const beanstandung = beleg.availableTransitions.find(
    (u) => u.name === 'disputeBySales' || u.name === 'disputeByPurchase',
  )

  return (
    <section>
      <h3>
        {beleg.documentNumber} <Status value={beleg.statusLabel} />
      </h3>
      <p>
        <code>{beleg.documentType}</code> ·{' '}
        {beleg.direction === 'sales' ? 'Verkauf' : 'Einkauf'} · {beleg.counterparty}
        <br />
        Periode {beleg.periodNumber} ({beleg.periodStatus === 'open' ? 'offen' : 'geschlossen'}) ·
        Belegdatum {beleg.issueDate} · erstellt von {beleg.createdBy}
        <br />
        <strong>
          {EURO.format(beleg.netAmount)} {beleg.currency} netto
        </strong>{' '}
        + {EURO.format(beleg.taxAmount)} Steuer ({beleg.taxRate} %) ={' '}
        {EURO.format(beleg.grossAmount)} {beleg.currency} brutto
        <br />
        Stundenzettel: {beleg.timesheetNumbers.join(', ')}
        {beleg.releasedAt === null ? null : (
          <>
            <br />
            Freigegeben am {beleg.releasedAt} · Prüffrist bis <Wert value={beleg.reviewDeadline} />
            {beleg.withinReviewDeadline
              ? ''
              : ' — abgelaufen: der Beleg gilt als akzeptiert, solange keine Beanstandung erfolgte (4.5.2)'}
          </>
        )}
        {beleg.cancellationOf === null ? null : (
          <>
            <br />
            <span className="hint">Stornobeleg zu {beleg.cancellationOf} (3.9)</span>
          </>
        )}
        {beleg.cancelledBy === null ? null : (
          <>
            <br />
            <span className="hint">Storniert durch {beleg.cancelledBy} (3.9)</span>
          </>
        )}
        {beleg.replacedTimesheets.length === 0 ? null : (
          <>
            <br />
            <span className="fehler">
              Ersetzte Zettel: {beleg.replacedTimesheets.join(', ')} — eine Korrekturfassung ist
              genehmigt worden. Der Beleg ist zu stornieren und neu zu erstellen (4.5.2).
            </span>
          </>
        )}
        {beleg.crossTenant ? (
          <>
            <br />
            <span className="hint">Zugriff über die Mandantengrenze (2.3) — protokolliert</span>
          </>
        ) : null}
      </p>

      <table>
        <caption>
          Belegpositionen (3.9) — jede Menge kommt aus einem Stundenzettel, jeder Preis aus einer
          Preisposition oder aus einem abweichenden Satz am Einsatz.
        </caption>
        <thead>
          <tr>
            <th>Stundenzettel</th>
            <th>Einsatz</th>
            <th>Leistung</th>
            <th>Menge</th>
            <th>Einzelpreis</th>
            <th>Betrag</th>
            <th>Kostenstelle</th>
            <th>Preisherkunft</th>
          </tr>
        </thead>
        <tbody>
          {beleg.items.map((position, index) => (
            <tr key={`${position.timesheetNumber}-${position.premium ?? 'grund'}-${index}`}>
              <td>{position.timesheetNumber}</td>
              <td>{position.assignmentNumber}</td>
              <td>{position.premium === null ? 'Grundleistung' : position.premium}</td>
              <td>{position.quantity.toFixed(2)} h</td>
              <td>{EURO.format(position.unitPrice)}</td>
              <td>{EURO.format(position.amount)}</td>
              <td>
                <Wert value={position.costCenter} />
              </td>
              <td>
                <code>{position.fromRateCard ? 'Preisposition' : 'abweichender Satz'}</code>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {beleg.findings.length === 0 ? null : (
        <ul>
          {beleg.findings.map((befund) => (
            <li
              key={`${befund.check}-${befund.row}`}
              className={befund.satisfied ? 'hint' : 'fehler'}
            >
              <strong>
                {befund.row} ({befund.effect})
              </strong>
              : {befund.message}
            </li>
          ))}
        </ul>
      )}

      {beleg.disputeReason === null ? null : (
        <p className="fehler">
          Beanstandung: {beleg.disputeReason}
          {beleg.disputeResolutionNote === null ? null : (
            <>
              <br />
              Klärung: {beleg.disputeResolutionNote}
            </>
          )}
        </p>
      )}
      {beleg.cancellationReason === null ? null : (
        <p className="hint">Stornogrund: {beleg.cancellationReason}</p>
      )}

      {kann('review') || kann('release') || kann('confirm') ? (
        <form action={transitionDocumentAction}>
          <input type="hidden" name="billingDocumentId" value={beleg.id} />
          <p>
            {kann('review') ? (
              <>
                <button type="submit" name="transition" value="review">
                  prüfen (4.5.2)
                </button>{' '}
              </>
            ) : null}
            {kann('release') ? (
              <>
                <button type="submit" name="transition" value="release">
                  freigeben (4.5.2)
                </button>{' '}
              </>
            ) : null}
            {kann('confirm') ? (
              <>
                <button type="submit" name="transition" value="confirm">
                  Gutschrift bestätigen ([32])
                </button>{' '}
              </>
            ) : null}
          </p>
          {kann('release') ? (
            <p className="hint">
              Die Freigabe trägt das Vier-Augen-Prinzip: wer den Beleg erstellt hat, gibt ihn nicht
              frei ([30], 2.4 Regel 5). Dem Ersteller wird der Knopf deshalb nicht angeboten.
            </p>
          ) : null}
        </form>
      ) : null}

      {beanstandet && beanstandung !== undefined ? (
        <form action={transitionDocumentAction}>
          <input type="hidden" name="billingDocumentId" value={beleg.id} />
          <input type="hidden" name="transition" value={beanstandung.name} />
          <p>
            <label htmlFor={`disputeReason-${beleg.id}`}>Beanstandungsgrund: </label>
            <input id={`disputeReason-${beleg.id}`} name="disputeReason" size={32} required />{' '}
            <button type="submit">{beanstandung.label}</button>
          </p>
          <p className="hint">
            Die Statusführung des Belegs bleibt beim Betreiber ([31], [32]) — die Gegenseite
            beanstandet, sie führt den Beleg nicht. Nach Ablauf der Prüffrist ist das nicht mehr
            möglich (4.5.2).
          </p>
        </form>
      ) : null}

      {kann('clarify') ? (
        <form action={transitionDocumentAction}>
          <input type="hidden" name="billingDocumentId" value={beleg.id} />
          <input type="hidden" name="transition" value="clarify" />
          <p>
            <label htmlFor={`resolution-${beleg.id}`}>Klärung: </label>
            <input id={`resolution-${beleg.id}`} name="disputeResolutionNote" size={32} required />{' '}
            <button type="submit">Beanstandung klären (4.5.2)</button>
          </p>
          <p className="hint">
            Die Klärung führt zurück in die <strong>Prüfung</strong>, nicht in die Freigabe:
            freigegeben wird erneut, mit erneutem Vier-Augen-Prinzip. Haben sich die Zeiten
            geändert, muss die Korrekturfassung genehmigt sein (4.4).
          </p>
        </form>
      ) : null}

      {kann('cancel') ? (
        <form action={cancelDocumentAction}>
          <input type="hidden" name="billingDocumentId" value={beleg.id} />
          <p>
            <label htmlFor={`cancellationReason-${beleg.id}`}>Stornogrund: </label>
            <input
              id={`cancellationReason-${beleg.id}`}
              name="cancellationReason"
              size={32}
              required
            />{' '}
            <button type="submit">stornieren (4.5.2)</button>
          </p>
          <p className="hint">
            Der Storno erzeugt einen <strong>neuen</strong> Beleg mit der Gegenbuchung; der alte
            bleibt erhalten, und die Belegnummern bleiben lückenlos (3.9). Die Stundenzettel sind
            danach wieder abrechenbar.
          </p>
        </form>
      ) : null}
    </section>
  )
}
