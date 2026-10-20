'use server'

import { revalidatePath } from 'next/cache'
import { setTestIdentityUserId } from '../lib/identity/testIdentity'

/**
 * Schaltet die Testidentität um (siehe lib/identity/testIdentity.ts).
 * Keine Authentifizierung, nur ein Rollenwechsel für die Vorführung.
 */
export async function switchTestIdentity(formData: FormData): Promise<void> {
  const userId = formData.get('userId')
  if (typeof userId === 'string' && userId !== '') {
    await setTestIdentityUserId(userId)
  }
  revalidatePath('/')
}
