import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    // Tests liegen neben dem Code (CLAUDE.md, Abschnitt Tests).
    include: ['lib/**/*.test.ts'],
    // tests/aueg/ enthaelt die AUEG-Regeln als Gherkin ohne Runner und wird
    // von diesem Framework nicht angefasst (CLAUDE.md, harte Regel 1).
    exclude: ['node_modules/**', '.next/**', 'tests/aueg/**'],
  },
})
