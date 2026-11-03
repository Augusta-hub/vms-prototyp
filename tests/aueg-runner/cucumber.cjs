/**
 * Konfiguration des Gherkin-Laufs fuer die AUEG-Suite.
 *
 * Getrennt von `npm test`: die Unit-Suite in lib/ ist gruen und soll es
 * bleiben, die AUEG-Suite ist rot, bis SPEC Kapitel 5 umgesetzt ist. Zwei
 * Skripte, zwei Aussagen (siehe package.json: `test` und `test:aueg`).
 *
 * Pfade sind relativ zur Projektwurzel, nicht zu dieser Datei.
 */

module.exports = {
  default: {
    // Die Spezifikation in ausfuehrbarer Form. Wird nie geaendert, um einen
    // Test gruen zu bekommen (CLAUDE.md Regel 1).
    paths: ['tests/aueg/**/*.feature'],

    // Der Runner. schritte.ts zieht support/ selbst nach.
    require: ['tests/aueg-runner/schritte.ts'],

    // TypeScript ohne Buildschritt, ueber das schon vorhandene tsx.
    requireModule: ['tsx/cjs'],

    // Deutsches Gherkin. Die Dateien tragen zusaetzlich `# language: de`.
    language: 'de',

    // Fortschritt auf die Konsole, der Nachrichtenstrom in eine Datei —
    // daraus entsteht der Bericht (tests/aueg-runner/bericht.ts).
    format: ['progress', ['message', 'reports/aueg-messages.ndjson']],

    // Ausstehende Schritte lassen den Lauf fehlschlagen. Ein Szenario ohne
    // Fachlogik darf nicht als Erfolg durchgehen.
    strict: true,

    publish: false,
  },
}
