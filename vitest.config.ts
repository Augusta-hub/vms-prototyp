import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    // Tests liegen neben dem Code (CLAUDE.md, Abschnitt Tests). Der Runner in
    // tests/aueg-runner/ ist das Messgeraet der AUEG-Suite und hat eigene
    // Tests: eine falsche Signatur dort macht aus richtiger Fachlogik ein rotes
    // Szenario oder aus einer ungepruften Aussage eine gruene.
    include: ['lib/**/*.test.ts', 'tests/aueg-runner/**/*.test.ts'],
    // tests/aueg/ enthaelt die AUEG-Regeln als Gherkin ohne Runner und wird
    // von diesem Framework nicht angefasst (CLAUDE.md, harte Regel 1).
    exclude: ['node_modules/**', '.next/**', 'tests/aueg/**'],
  },
})
