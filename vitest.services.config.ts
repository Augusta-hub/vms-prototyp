import { defineConfig } from 'vitest/config'

/**
 * Lauf der Dienst-Tests (`npm run test:services`).
 *
 * Getrennt von `vitest.config.ts`, weil dieser Lauf eine **laufende
 * PostgreSQL-Instanz** braucht: er legt eine eigene Testdatenbank an, migriert
 * sie und führt echte Übergänge aus `lib/services/` aus. `npm test` bleibt
 * dadurch ohne Datenbank lauffähig — die Fachlogik in `lib/aueg/` ist dort
 * ohne Prisma geprüft, und das soll so bleiben.
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/services/**/*.test.ts'],
    globalSetup: ['tests/services/aufbau.ts'],
    setupFiles: ['tests/services/verbindung.ts'],
    // Die Tests teilen sich **eine** Datenbank und leeren sie vor jedem Test;
    // parallele Dateien würden sich dabei gegenseitig die Zeilen löschen.
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
})
