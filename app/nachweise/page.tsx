/**
 * Nachweise — SPEC 3.10 (Objekt) und 5.4.3 (Nachweisfluss).
 *
 * Die Seite zeigt, was die gewählte Testidentität sehen darf: der Betreiber
 * alles, der Bedarfsträger die einsatzbezogenen Nachweise seines Kunden ([35]),
 * Einkauf/Controlling die AÜG-Erlaubnis **ohne Urkundeninhalte** ([36]), der
 * Lieferant die eigenen ([7]). Felder, die eine Fußnote nicht zeigt, erscheinen
 * als „nicht sichtbar" — benannt, nicht als Lücke.
 *
 * `Pflicht` und `Sperrwirkung` stehen in der Tabelle, sind aber **keine
 * Felder**: 3.10 führt sie als abgeleitet, und sie werden je Zeile aus dem
 * Pflichtkatalog in 5.4.4 gerechnet.
 */
import { loadDocumentOptions, loadDocuments, type DocumentView } from '../../lib/services/documents'
import { currentIdentity } from '../identity'
import { Meldung, Status, Verdeckt, Wert } from '../ui'
import { acceptDocumentAction, rejectDocumentAction, submitDocumentAction } from './actions'

export const dynamic = 'force-dynamic'

/** Nachweisarten (3.10) mit ihrer Wirkung aus dem Katalog (5.4.4). */
const ARTEN: readonly { readonly value: string; readonly label: string }[] = [
  { value: 'permitCertificate', label: 'Erlaubnisurkunde (Lieferant, Sperre über P9)' },
  { value: 'workPermit', label: 'Arbeitserlaubnis (Kandidat, Sperre)' },
  { value: 'safetyBriefing', label: 'Unterweisung am Standort (Einsatz, Sperre)' },
  { value: 'qualificationCertificate', label: 'Qualifikationsnachweis (Kandidat, Warnung)' },
  { value: 'clearanceCertificate', label: 'Unbedenklichkeitsbescheinigung (Lieferant, Warnung)' },
  { value: 'agreementDocument', label: 'Vertragsunterlage (Rahmenvertrag, Information)' },
  { value: 'other', label: 'Sonstige (Information)' },
]

const SICHTBARKEIT: readonly { readonly value: string; readonly label: string }[] = [
  { value: 'operatorAndOwner', label: 'Betreiber und Einsteller' },
  { value: 'assignmentParties', label: 'Einsatzbeteiligte (Kunde sieht ihn)' },
  { value: 'operatorOnly', label: 'nur Betreiber' },
]

export default async function NachweisePage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; fehler?: string }>
}) {
  const params = await searchParams
  const { identity, hint } = await currentIdentity()

  if (identity === null) {
    return (
      <>
        <h1>Nachweise</h1>
        <p className="hint">{hint}</p>
      </>
    )
  }

  const documents = await loadDocuments(identity)
  const options = await loadDocumentOptions(identity)

  return (
    <>
      <h1>Nachweise</h1>
      <p>
        Hinterlegte Schriftstücke mit Nachweisfunktion (SPEC 3.10): Erlaubnisurkunde,
        Unterweisung, Qualifikation, Arbeitserlaubnis. Der Nachweisfluss ist{' '}
        <strong>klein</strong> (5.4.3): eingestellt, anerkannt oder zurückgewiesen. Geprüft wird
        die <strong>Anerkennung</strong>, nicht die Gültigkeit — ein abgelaufener Nachweis bleibt
        anerkannt, und ob er einen Tag deckt, rechnen P9 und P10 je Stichtag.
      </p>
      <p className="hint">
        <strong>Pflicht</strong> und <strong>Sperrwirkung</strong> sind keine Felder am Dokument:
        3.10 führt sie als abgeleitet, gerechnet aus dem Pflichtkatalog in 5.4.4. Hinter dem
        Ablageverweis liegt in diesem Prototyp <strong>keine Datei</strong> — Ablageort und
        -verfahren sind offene Fragen 1 und 2. Benachrichtigungen (5.4.3) verschickt der Prototyp
        nicht; die Zuständigkeit steht in der Rückmeldung.
      </p>
      <Meldung ok={params.ok} fehler={params.fehler} />

      <h2>Bestand</h2>
      {documents.length === 0 ? (
        <p className="hint">Kein Nachweis sichtbar.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Nummer</th>
              <th>Nachweisart</th>
              <th>Bezugsobjekt</th>
              <th>Gültig von / bis</th>
              <th>Anerkennung</th>
              <th>Pflicht (5.4.4)</th>
              <th>Sperrwirkung</th>
              <th>Sichtbarkeit</th>
            </tr>
          </thead>
          <tbody>
            {documents.map((document) => (
              <tr key={document.id}>
                <td>
                  <Wert value={document.fields.documentNumber} />
                </td>
                <td>
                  <Wert value={document.fields.documentCategory} />
                </td>
                <td>
                  <Wert value={document.fields.subjectLabel} />
                </td>
                <td>
                  <Wert value={document.fields.validFrom} /> –{' '}
                  <Wert value={document.fields.validTo} />
                </td>
                <td>
                  <Status value={document.stateLabel} />
                </td>
                <td title={document.derivationReason}>{document.mandatory ? 'ja' : 'nein'}</td>
                <td title={document.derivationReason}>{document.blocking ? 'Sperre' : 'nein'}</td>
                <td>
                  <Wert value={document.fields.confidentiality} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {documents.map((document) => (
        <Nachweis key={`detail-${document.id}`} document={document} />
      ))}

      {options.mayCreate ? (
        <details>
          <summary>Nachweis einstellen (5.4.3, — → eingereicht)</summary>
          <p className="hint">
            Angeboten werden nur die Bezugsobjekte, zu denen die Matrix 2.2 dieser Rolle das
            Anlegen erlaubt. Die Sichtbarkeitsklasse ist ein <strong>Feld</strong> (3.10) und keine
            Ableitung; eine Vertragsunterlage des Lieferanten darf aber nicht einsatzbezogen sein —
            das lehnt die Invariante aus 3.10 ab.
          </p>
          <form action={submitDocumentAction}>
            <div className="grid">
              <label className="field">
                Nachweisart
                <select name="documentCategory" required>
                  {ARTEN.map((art) => (
                    <option key={art.value} value={art.value}>
                      {art.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                Bezugsobjekt (genau eines, 3.10)
                <select name="subject" required>
                  {options.subjects.map((subject) => (
                    <option
                      key={`${subject.subjectType}:${subject.id}`}
                      value={`${subject.subjectType}:${subject.id}`}
                    >
                      {subject.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                Dateiname
                <input name="fileName" required defaultValue="nachweis.pdf" />
              </label>
              <label className="field">
                Dateityp
                <input name="mimeType" required defaultValue="application/pdf" />
              </label>
              <label className="field">
                Ausgestellt von
                <input name="issuer" />
              </label>
              <label className="field">
                Ausgestellt am
                <input type="date" name="issuedOn" />
              </label>
              <label className="field">
                Gültig von
                <input type="date" name="validFrom" />
              </label>
              <label className="field">
                Gültig bis (leer = unbefristet)
                <input type="date" name="validTo" />
              </label>
              <label className="field">
                Sichtbarkeitsklasse
                <select name="confidentiality" required>
                  {SICHTBARKEIT.map((klasse) => (
                    <option key={klasse.value} value={klasse.value}>
                      {klasse.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <button type="submit">Nachweis einstellen</button>
          </form>
        </details>
      ) : null}
    </>
  )
}

/**
 * Ein einzelner Nachweis mit den Handlungen, die 5.4.3 aus seinem Zustand
 * zulässt. Aus `accepted` und `rejected` führt keine — das ist keine
 * Oberflächenentscheidung, sondern die geschlossene Übergangsmenge.
 */
function Nachweis({ document }: { readonly document: DocumentView }) {
  return (
    <fieldset>
      <legend>
        <Wert value={document.fields.documentNumber} /> —{' '}
        <Wert value={document.fields.documentCategory} /> · <Status value={document.stateLabel} />
      </legend>
      <p>
        Bezugsobjekt: <Wert value={document.fields.subjectLabel} /> · Datei:{' '}
        <Wert value={document.fields.fileName} /> · Ablage:{' '}
        <code>
          <Wert value={document.fields.fileRef} />
        </code>
      </p>
      <p>
        Eingestellt am <Wert value={document.fields.uploadedAt} /> von{' '}
        <Wert value={document.fields.uploadedBy} /> · anerkannt am{' '}
        <Wert value={document.fields.verifiedAt} /> von{' '}
        <Wert value={document.fields.verifiedBy} />
        {/* `== null` fängt beide Fälle: keine Angabe **und** ein Feld, das
            eine Fußnote dieser Rolle nicht zeigt (dann `undefined`). Ein
            verdeckter Grund wird nicht als „nicht sichtbar" angekündigt — die
            Liste der verdeckten Felder sagt es ohnehin. */}
        {document.fields.rejectionReason == null ? null : (
          <>
            {' '}
            · Zurückweisungsgrund: <Wert value={document.fields.rejectionReason} />
          </>
        )}
      </p>
      <p className="hint">
        Abgeleitet aus dem Katalog (5.4.4): {document.derivationReason}
        {document.crossTenant ? ' · Zugriff über die Mandantengrenze (2.3, protokollpflichtig).' : ''}
      </p>
      <Verdeckt fields={document.concealed} />

      {document.availableTransitions.includes('accept') ? (
        <form action={acceptDocumentAction}>
          <input type="hidden" name="documentId" value={document.id} />
          {document.fields.validTo === null ? (
            <label className="field">
              <input type="checkbox" name="validToDeliberatelyOpen" value="ja" /> Der Nachweis gilt
              unbefristet — bewusst ohne Enddatum (5.4.3, 5.4.4)
            </label>
          ) : null}
          <button type="submit">Anerkennen (MD, [34])</button>
        </form>
      ) : null}

      {document.availableTransitions.includes('reject') ? (
        <form action={rejectDocumentAction}>
          <input type="hidden" name="documentId" value={document.id} />
          <label className="field">
            Zurückweisungsgrund (Pflicht, 3.10)
            <input name="rejectionReason" required />
          </label>
          <button type="submit">Zurückweisen</button>
        </form>
      ) : null}
    </fieldset>
  )
}
