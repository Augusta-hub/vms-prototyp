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
        Anwendungscode zu <code>SPEC.md</code> Kapitel 2, 3.1 bis 3.5 und 3.11. Umgesetzt sind
        Stammdaten, Bedarfsanfrage, Ausschreibung, Einladung und Lieferantenangebot mit den
        Statusmodellen 4.1, 4.2.1 und 4.2.2. Noch nicht umgesetzt: Kandidat und Profilvorschlag
        (3.6), Einsatz (3.7), Zeiten (3.8), Abrechnung (3.9), Nachweise (3.10) und das Protokoll
        (3.12) — und damit auch keine AÜG-Prüfung aus Kapitel 5.
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
        Gelesen aus <code>lib/authz/matrix.ts</code>. Belegt sind die Zeilen zu 3.1 bis 3.5 und
        3.11; jede andere Zeile verweigert jeden Zugriff, bis ihr Fachmodul kommt. Zahlen in
        Klammern sind die Fußnoten aus 2.2.
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
