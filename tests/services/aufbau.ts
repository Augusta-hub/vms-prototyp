/**
 * Globaler Aufbau der Dienst-Tests: Testdatenbank anlegen und migrieren.
 *
 * Läuft **einmal** vor dem Lauf, in einem eigenen Prozess (vitest
 * `globalSetup`). Danach ist das Schema aktuell; das Leeren der Tabellen
 * übernimmt `fixture.ts` vor jedem Test.
 */

import { execFileSync } from 'node:child_process'
import { PrismaClient } from '@prisma/client'
import { entwicklungsdatenbankUrl, testdatenbankName, testdatenbankUrl } from './umgebung'

export default async function aufbau(): Promise<void> {
  const url = testdatenbankUrl()
  const name = testdatenbankName()

  // Existiert die Datenbank schon? Dann nichts anlegen. Ein Verbindungsfehler
  // mit dem Prisma-Code P1003 heißt „Datenbank gibt es nicht" — jeder andere
  // Fehler ist ein echter und wird weitergereicht.
  if (!(await existiert(url))) {
    const verwaltung = new PrismaClient({ datasources: { db: { url: entwicklungsdatenbankUrl() } } })
    try {
      // `CREATE DATABASE` läuft nicht in einer Transaktion; deshalb
      // `$executeRawUnsafe` mit einem einzelnen Befehl. Der Name ist
      // abgeleitet und nicht eingegeben (siehe `umgebung.ts`).
      await verwaltung.$executeRawUnsafe(`CREATE DATABASE "${name}"`)
    } finally {
      await verwaltung.$disconnect()
    }
  }

  // Das Schema aus prisma/migrations/ anwenden. `migrate deploy` ist der
  // Befehl für eine Datenbank, die kein Entwickler von Hand verändert.
  execFileSync('npx', ['prisma', 'migrate', 'deploy'], {
    env: { ...process.env, DATABASE_URL: url },
    stdio: 'ignore',
  })
}

async function existiert(url: string): Promise<boolean> {
  const client = new PrismaClient({ datasources: { db: { url } } })
  try {
    await client.$queryRawUnsafe('SELECT 1')
    return true
  } catch (fehler) {
    if (fehler instanceof Error && /P1003|does not exist/i.test(fehler.message)) return false
    throw fehler
  } finally {
    await client.$disconnect()
  }
}
