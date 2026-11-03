/**
 * Das Lauf-Skript der AUEG-Suite: `npm run test:aueg`.
 *
 * Laesst cucumber-js laufen und haengt den Bericht an. Der Rueckgabewert ist
 * der von cucumber — die Suite ist rot, solange die Fachlogik aus SPEC
 * Kapitel 5 fehlt, und das soll ein Lauf auch melden.
 *
 * Zusaetzliche Argumente werden durchgereicht:
 *   npm run test:aueg -- --tags '@p1 and @sperre'
 */

import { spawnSync } from 'node:child_process'
import { resolve } from 'node:path'

const KONFIGURATION = 'tests/aueg-runner/cucumber.cjs'

const argumente = process.argv.slice(2)
const cucumber = resolve(process.cwd(), 'node_modules/.bin/cucumber-js')

const lauf = spawnSync(cucumber, ['--config', KONFIGURATION, ...argumente], {
  stdio: 'inherit',
  env: process.env,
})

if (lauf.error) {
  console.error('cucumber-js liess sich nicht starten:', lauf.error.message)
  process.exit(1)
}

// Der Bericht laeuft auch nach einem roten Lauf — er ist der Fortschrittsmesser,
// nicht die Erfolgsmeldung.
require('./bericht')

process.exit(lauf.status ?? 1)
