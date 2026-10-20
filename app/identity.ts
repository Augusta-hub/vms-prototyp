/**
 * Die handelnde Person für eine Seite — ohne Authentifizierung, über die
 * umschaltbare Testidentität (SPEC 3.0, Festlegung 4).
 *
 * Alle Seiten lesen die Identität hier und nirgends sonst. Ohne erreichbare
 * Datenbank oder ohne gewählte Identität gibt es **kein** Subjekt: die Seiten
 * zeigen dann den Hinweis statt einer Liste — sichtbar ist, was eine Regel
 * ausdrücklich erlaubt (2.3).
 */
import { loadIdentity, type LoadedIdentity } from '../lib/identity/loadSubject'
import { getTestIdentityUserId } from '../lib/identity/testIdentity'

export interface IdentityState {
  readonly identity: LoadedIdentity | null
  readonly hint: string | null
}

export const NO_DATABASE_HINT =
  'Keine Datenbank erreichbar. DATABASE_URL in .env setzen, dann „npm run db:deploy" und „npm run db:seed".'

export async function currentIdentity(): Promise<IdentityState> {
  let userId: string | null = null
  try {
    userId = await getTestIdentityUserId()
  } catch {
    userId = null
  }
  if (userId === null) {
    return {
      identity: null,
      hint: 'Keine Testidentität gewählt. Auf der Startseite eine Person auswählen.',
    }
  }
  try {
    const identity = await loadIdentity(userId)
    if (identity === null) {
      return { identity: null, hint: 'Die gewählte Testidentität gibt es nicht mehr.' }
    }
    return { identity, hint: null }
  } catch {
    return { identity: null, hint: NO_DATABASE_HINT }
  }
}

/** Die wirksamen Rollenkürzel der Identität, für die Kopfzeile der Seiten. */
export function roleAbbreviations(identity: LoadedIdentity): readonly string[] {
  return identity.subject.grants.map((grant) => grant.roleCode)
}
