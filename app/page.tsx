/**
 * Startseite des Prototyps.
 *
 * Sie zeigt zwei Dinge: die umschaltbare Testidentität mit ihren wirksamen
 * Rechten (SPEC 2, 2.4) und die belegten Zeilen der Berechtigungsmatrix aus
 * 2.2, gelesen aus dem Code — nicht aus der Datenbank, weil Rechte keine
 * pflegbaren Daten sind (3.11).
 *
 * Ohne erreichbare Datenbank bleibt der Abschnitt zur Identität leer und sagt
 * das; die Matrix ist auch dann sichtbar.
 */
import { PERMISSION_MATRIX } from '../lib/authz/matrix'
import { OPERATION_ABBREVIATION, OPERATIONS } from '../lib/authz/operations'
import { RESOURCE_LABELS, type ResourceType } from '../lib/authz/resources'
import { ROLE_CATALOG, ROLE_CODES } from '../lib/authz/roles'
import { loadIdentity } from '../lib/identity/loadSubject'
import { getTestIdentityUserId } from '../lib/identity/testIdentity'
import { prisma } from '../lib/prisma'
import { switchTestIdentity } from './actions'

interface UserOption {
  id: string
  label: string
}

async function loadUserOptions(): Promise<{ options: UserOption[]; error: string | null }> {
  try {
    const users = await prisma.user.findMany({
      include: { tenant: true, roleAssignments: true },
      orderBy: [{ tenant: { tenantNumber: 'asc' } }, { userNumber: 'asc' }],
    })
    return {
      options: users.map((user) => ({
        id: user.id,
        label: `${user.givenName} ${user.familyName} — ${user.tenant.displayName} (${user.roleAssignments
          .map((assignment) => assignment.roleCode)
          .join(', ')})`,
      })),
      error: null,
    }
  } catch {
    return {
      options: [],
      error:
        'Keine Datenbank erreichbar. DATABASE_URL in .env setzen, dann "npm run db:migrate" und "npm run db:seed".',
    }
  }
}

export default async function Home() {
  const { options, error } = await loadUserOptions()
  const userId = await getTestIdentityUserId()
  const identity = userId === null || error !== null ? null : await loadIdentity(userId)

  return (
    <>
      <h1>Identität und Rechte</h1>
      <p>
        Anwendungscode zu <code>SPEC.md</code> Kapitel 2, 3.1 bis 3.12. Umgesetzt sind
        Stammdaten, Bedarfsanfrage, Ausschreibung, Einladung, Lieferantenangebot, Kandidat und
        Profilvorschlag, der Einsatz mit den Statusmodellen 4.1, 4.2 und 4.3 sowie Dokumente und
        Nachweise (3.10) samt ihrem Nachweisfluss aus 5.4.3 — einstellen, anerkennen,
        zurückweisen —, der Lieferantenstatus (4.6), das fachliche Protokoll (3.12), die
        Zeiterfassung (3.8, 4.4) mit Stundenzetteln, zwei Erfassungsformen, Zuschlägen samt
        Herkunft, je Kunde konfigurierten Freigabestufen und der Korrekturfassung — und die{' '}
        <strong>Abrechnung</strong> (3.9, 4.5): Abrechnungsperiode mit Schluss, Abrechnungsbeleg
        auf beiden Seiten, Belegpositionen aus genehmigten Zeiten, Beanstandung, Klärung und
        Storno mit Gegenbuchung — und der <strong>nächtliche Lauf</strong> (5.5.1) mit den
        Benachrichtigungen aus 3.14. Aus Kapitel 5 rechnen <strong>alle elf</strong> Prüfungen P1
        bis P11. An den Übergängen greifen P1, P3, P4, P5, P6, P8, P9, P10 und P11: sie schreiben
        Fristende, angerechnete Dauer und Equal-Pay-Fälligkeit fort und sperren Ausschreibung,
        Anlage, Einsatzstart, das Freischalten eines Lieferanten und die Genehmigung von Zeiten
        ohne Vergleichsentgelt. Am <strong>Beleg</strong> sperrt keine Prüfung: die Leistung ist
        erbracht, und der Befund wird dokumentiert statt die Abrechnung zu blockieren (5.5.5).
        Der nächtliche Lauf prüft die Zeilen <strong>N1, N2, N3, N5 und N6</strong> aus 5.5.1 und
        die Fristanlässe aus 2.4; er erzeugt keinen Statuswechsel und keine Sperre. Nicht
        angebunden ist P7 — für die Arbeitskampfanzeige führt Kapitel 3 kein Feld (offene
        Frage 30), und damit fehlt auch die Zeile <strong>N4</strong>.
      </p>

      <h2>Testidentität</h2>
      {error !== null ? <p className="hint">{error}</p> : null}
      {identity === null ? (
        <p className="hint">Keine Testidentität gewählt.</p>
      ) : (
        <>
          <p>
            <strong>
              {identity.user.givenName} {identity.user.familyName}
            </strong>{' '}
            ({identity.user.loginIdentifier}) — Mandant {identity.tenant.displayName}, Typ{' '}
            <code>{identity.tenant.tenantType}</code>
          </p>
          <table>
            <caption>Wirksame Rechte zum heutigen Stichtag</caption>
            <thead>
              <tr>
                <th>Rolle</th>
                <th>Kürzel</th>
                <th>Zuständigkeit</th>
                <th>Vertretung</th>
              </tr>
            </thead>
            <tbody>
              {identity.subject.grants.length === 0 ? (
                <tr>
                  <td colSpan={4}>Keine wirksame Rollenzuweisung.</td>
                </tr>
              ) : (
                identity.subject.grants.map((grant) => (
                  <tr key={`${grant.roleAssignmentId}-${grant.viaDelegation?.delegationId ?? 'eigen'}`}>
                    <td>{ROLE_CATALOG[grant.roleCode].name}</td>
                    <td>{ROLE_CATALOG[grant.roleCode].abbreviation}</td>
                    <td>
                      {grant.responsibilityScopes.length === 0
                        ? 'ganzer Mandant'
                        : grant.responsibilityScopes
                            .map((scope) => `${scope.scopeType}: ${scope.scopeRef}`)
                            .join(', ')}
                    </td>
                    <td>
                      {grant.viaDelegation === undefined
                        ? 'eigene Zuweisung'
                        : `in Vertretung von ${grant.viaDelegation.delegatedUserId}`}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </>
      )}

      {options.length > 0 ? (
        <form action={switchTestIdentity}>
          <p>
            <label htmlFor="userId">Identität wechseln: </label>
            <select id="userId" name="userId" defaultValue={userId ?? ''}>
              {options.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>{' '}
            <button type="submit">Übernehmen</button>
          </p>
        </form>
      ) : null}

      <h2>Berechtigungsmatrix (SPEC 2.2)</h2>
      <p>
        Gelesen aus <code>lib/authz/matrix.ts</code>. Mit der Abrechnung ist{' '}
        <strong>jede</strong> Zeile belegt — eine unbelegte hätte jeden Zugriff verweigert, weil
        Sichtbarkeit positiv festgelegt ist (2.3). Zahlen in Klammern sind die Fußnoten aus 2.2.
      </p>
      <table>
        <thead>
          <tr>
            <th>Objekt</th>
            {ROLE_CODES.map((code) => (
              <th key={code} title={ROLE_CATALOG[code].name}>
                {ROLE_CATALOG[code].abbreviation}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {(Object.keys(PERMISSION_MATRIX) as ResourceType[]).map((resourceType) => (
            <tr key={resourceType}>
              <td>{RESOURCE_LABELS[resourceType]}</td>
              {ROLE_CODES.map((code) => {
                const cell = PERMISSION_MATRIX[resourceType]?.[code]
                if (cell === undefined) return <td key={code}>–</td>
                return (
                  <td key={code}>
                    {OPERATIONS.filter((operation) => cell[operation] !== undefined)
                      .map((operation) => {
                        const footnotes = cell[operation] ?? []
                        const suffix =
                          footnotes.length === 0 ? '' : `[${footnotes.join('][')}]`
                        return `${OPERATION_ABBREVIATION[operation]}${suffix}`
                      })
                      .join(' ')}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </>
  )
}
