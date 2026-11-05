/**
 * Die Umgebung der Dienst-Tests: eine **eigene** Datenbank.
 *
 * Warum nicht die Entwicklungsdatenbank: die Tests legen Daten an, führen
 * Übergänge aus und schreiben abgeleitete Felder. Täten sie das in
 * `vms_prototyp`, wäre nach jedem Lauf unklar, was Seed und was Test ist — und
 * zwei Sessions, die gleichzeitig arbeiten, würden sich gegenseitig die Zeilen
 * unter den Füßen wegziehen. Die Testdatenbank heißt deshalb wie die
 * Entwicklungsdatenbank mit dem Zusatz `_test` und wird vor dem Lauf einmal
 * migriert und vor **jedem** Test geleert.
 *
 * Warum nicht in `npm test`: dieser Lauf braucht eine laufende PostgreSQL-
 * Instanz. `npm test` soll ohne Datenbank durchlaufen — die Fachlogik in
 * `lib/aueg/` ist dort ohne Prisma geprüft, und das soll so bleiben. Die
 * Dienst-Tests laufen deshalb über `npm run test:services`, wie die AÜG-Suite
 * über `npm run test:aueg` läuft.
 *
 * **Keine Verbindungsdaten in dieser Datei** (CLAUDE.md, Regel 2): die
 * Verbindung kommt aus `DATABASE_URL`, und abgeleitet wird nur der Name der
 * Datenbank. Nichts davon wird ausgegeben.
 */

/** Der Name, den die Testdatenbank neben der Entwicklungsdatenbank trägt. */
const TESTZUSATZ = '_test'

/**
 * Leitet die Verbindung der Testdatenbank aus `DATABASE_URL` ab. Wirft, wenn
 * keine gesetzt ist — ein Dienst-Test ohne Datenbank ist kein bestandener
 * Test, sondern ein übersprungener.
 */
export function testdatenbankUrl(): string {
  const entwicklung = process.env.DATABASE_URL
  if (entwicklung === undefined || entwicklung.trim() === '') {
    throw new Error(
      'DATABASE_URL ist nicht gesetzt. Die Dienst-Tests brauchen eine ' +
        'PostgreSQL-Verbindung; sie legen eine eigene Datenbank mit dem Zusatz ' +
        `"${TESTZUSATZ}" an und fassen die Entwicklungsdatenbank nicht an.`,
    )
  }
  const url = new URL(entwicklung)
  const name = url.pathname.replace(/^\//, '')
  if (name === '') throw new Error('DATABASE_URL nennt keine Datenbank.')
  if (name.endsWith(TESTZUSATZ)) return entwicklung
  url.pathname = `/${name}${TESTZUSATZ}`
  return url.toString()
}

/** Der Name der Entwicklungsdatenbank — für die `CREATE DATABASE`-Verbindung. */
export function entwicklungsdatenbankUrl(): string {
  const entwicklung = process.env.DATABASE_URL
  if (entwicklung === undefined) throw new Error('DATABASE_URL ist nicht gesetzt.')
  return entwicklung
}

/** Der reine Name der Testdatenbank, ohne Verbindungsdaten. */
export function testdatenbankName(): string {
  return new URL(testdatenbankUrl()).pathname.replace(/^\//, '')
}
