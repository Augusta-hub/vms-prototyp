import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import './globals.css'

export const metadata: Metadata = {
  title: 'VMS-Prototyp',
  description: 'Prototyp eines Vendor-Management-Systems für Arbeitnehmerüberlassung',
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="de">
      <body>
        <header>
          <strong>VMS-Prototyp</strong> — Mandanten, Benutzer und Rollen
        </header>
        <main>{children}</main>
      </body>
    </html>
  )
}
