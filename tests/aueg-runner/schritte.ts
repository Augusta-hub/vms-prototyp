/**
 * Die Schrittdefinition der AUEG-Suite.
 *
 * Es ist genau eine, und das ist eine Entscheidung mit Begruendung:
 * Die vier Feature-Dateien enthalten 1626 Schritte in 1080 verschiedenen
 * Formulierungen. Je Formulierung eine Definition zu pflegen, wuerde die
 * Szenarien unter Druck setzen, sich dem Runner anzupassen — CLAUDE.md Regel 1
 * verbietet genau das. Cucumber laesst ausserdem keine Mischung aus engen
 * Mustern und einem Auffangmuster zu: ein Schritt, auf den beide passen, gilt
 * als "ambiguous" und fuehrt zum Fehler.
 *
 * Also: ein Muster, das jeden Schritt annimmt, und dahinter eine Erfassung,
 * die nach Schluesselwort unterscheidet (`support/welt.ts`). Was ein Schritt
 * fachlich bedeutet, entscheidet die Fachlogik aus SPEC Kapitel 5 — die fehlt,
 * und deshalb bleibt jedes Szenario an seinem "Wenn" ausstehend stehen.
 */

import {
  Before,
  BeforeAll,
  BeforeStep,
  Given,
  setDefaultTimeout,
  setWorldConstructor,
} from '@cucumber/cucumber'
import { AuegWelt, type Schrittart } from './support/welt'

setWorldConstructor(AuegWelt)
setDefaultTimeout(10_000)

/**
 * Keine Verbindung zur Entwicklungsdatenbank (CLAUDE.md Regel 3).
 * Der Runner laedt keinen Prisma-Client; ohne DATABASE_URL koennte auch ein
 * versehentlicher Import `vms_prototyp` nicht erreichen.
 */
BeforeAll(function () {
  delete process.env.DATABASE_URL
  delete process.env.DIRECT_DATABASE_URL
})

Before(function (this: AuegWelt, { pickle, gherkinDocument }) {
  this.szenario = {
    name: pickle.name,
    tags: pickle.tags.map((tag) => tag.name),
    datei: gherkinDocument.uri ?? pickle.uri,
  }
  this.schrittart = 'Unknown'
  this.sachverhalte = []
  this.ausloeser = null
  this.erwartungen = []
  this.befunde = []
})

BeforeStep(function (this: AuegWelt, { pickleStep }) {
  this.schrittart = (pickleStep.type ?? 'Unknown') as Schrittart
})

// Nimmt jeden Schritt an. Die Unterscheidung macht die Welt, nicht das Muster.
Given(/^(.+)$/, function (this: AuegWelt, satz: string) {
  return this.schritt(satz)
})
