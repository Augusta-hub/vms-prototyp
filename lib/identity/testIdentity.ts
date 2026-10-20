/**
 * Umschaltbare Testidentität für den Prototyp.
 *
 * Es gibt **keine** Authentifizierung und keine Anmeldedaten: Passwörter,
 * Hashes, Token und Zwei-Faktor-Geheimnisse sind nach SPEC 3.0 (Festlegung 4)
 * nicht Teil des Datenmodells, und das Verfahren wird später festgelegt. Für
 * die Demo genügt es, die handelnde Person umzuschalten — wie bei einem
 * Rollenwechsel in einer Vorführung.
 *
 * Die gewählte Identität steht in einem Cookie; ohne Cookie greift
 * `VMS_TEST_IDENTITY` aus der Umgebung. Beides enthält nur eine Benutzer-Id.
 */
import { cookies } from 'next/headers'

export const TEST_IDENTITY_COOKIE = 'vms-test-identity'

export async function getTestIdentityUserId(): Promise<string | null> {
  const store = await cookies()
  const fromCookie = store.get(TEST_IDENTITY_COOKIE)?.value
  if (fromCookie !== undefined && fromCookie !== '') return fromCookie
  const fromEnv = process.env.VMS_TEST_IDENTITY
  return fromEnv !== undefined && fromEnv !== '' ? fromEnv : null
}

export async function setTestIdentityUserId(userId: string): Promise<void> {
  const store = await cookies()
  store.set(TEST_IDENTITY_COOKIE, userId, { httpOnly: true, sameSite: 'lax', path: '/' })
}
