import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import Link from 'next/link'
import './globals.css'
import { currentIdentity } from './identity'
import { ROLE_CATALOG } from '../lib/authz/roles'

export const metadata: Metadata = {
  title: 'VMS-Prototyp',
  description: 'Prototyp eines Vendor-Management-Systems für Arbeitnehmerüberlassung',
}

export default async function RootLayout({ children }: { children: ReactNode }) {
  const { identity } = await currentIdentity()

  return (
    <html lang="de">
      <body>
        <header>
          <strong>VMS-Prototyp</strong>
          <nav>
            <Link href="/">Identität und Rechte</Link>
            <Link href="/stammdaten">Stammdaten</Link>
            <Link href="/bedarf">Bedarfsanfragen</Link>
            <Link href="/einladungen">Einladungen</Link>
            <Link href="/besetzung">Besetzung</Link>
            <Link href="/einsaetze">Einsätze</Link>
            <Link href="/nachweise">Nachweise</Link>
            <Link href="/identitaeten">Personenidentität</Link>
            <Link href="/protokoll">Protokoll</Link>
          </nav>
          <span className="identity">
            {identity === null
              ? 'keine Identität'
              : `${identity.user.givenName} ${identity.user.familyName} · ${identity.tenant.displayName} · ${identity.subject.grants
                  .map((grant) => ROLE_CATALOG[grant.roleCode].abbreviation)
                  .join(', ')}`}
          </span>
        </header>
        <main>{children}</main>
      </body>
    </html>
  )
}
