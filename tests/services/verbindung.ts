/**
 * Setzt `DATABASE_URL` auf die Testdatenbank, **bevor** ein Modul
 * `lib/prisma.ts` importiert: der Client dort wird beim Import gebaut und liest
 * die Umgebung genau einmal.
 */
import 'dotenv/config'
import { testdatenbankUrl } from './umgebung'

process.env.DATABASE_URL = testdatenbankUrl()
