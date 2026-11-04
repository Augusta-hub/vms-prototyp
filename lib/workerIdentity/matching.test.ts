/**
 * Tests des Identitätsabgleichs gegen SPEC 3.6 (Entscheidung zu vormals
 * offener Frage 18).
 *
 * Der Kern der Entscheidung ist eine Unterscheidung, und sie ist hier geprüft:
 * der Abgleich **schlägt vor**, und ein nur vorgeschlagener Treffer ist
 * **keine** Identität. Dazu der abschließende Merkmalssatz und die Grenze zum
 * eigenen Lieferanten.
 *
 * Diese Tests prüfen Anwendungscode und sind **nicht** die AÜG-Regeln; die
 * stehen als Gherkin in tests/aueg/ und werden hier nicht berührt.
 */
import { describe, expect, it } from 'vitest'
import { DAY } from '../testing/fixtures'
import {
  allProposals,
  compareAttributes,
  isSamePerson,
  proposalsFor,
  type CandidateForMatching,
} from './matching'

function candidate(overrides: Partial<CandidateForMatching> = {}): CandidateForMatching {
  return {
    candidateId: 'k-1',
    supplierId: 'lieferant-1',
    givenName: 'Marek',
    familyName: 'Dvořák',
    dateOfBirth: DAY('1989-04-12'),
    placeOfBirth: 'Pilsen',
    workerIdentityId: null,
    ...overrides,
  }
}

describe('3.6 — der abschließende Merkmalssatz', () => {
  it('Name, Geburtsdatum und Geburtsort gleich → Treffer über alle Merkmale', () => {
    const match = compareAttributes(candidate(), candidate())
    expect(match?.strength).toBe('allAttributes')
    expect(match?.basis).toContain('Geburtsort')
  })

  it('Geburtsort fehlt auf einer Seite → Treffer, aber der Vorschlag sagt es', () => {
    const match = compareAttributes(candidate(), candidate({ placeOfBirth: null }))
    expect(match?.strength).toBe('withoutPlaceOfBirth')
    expect(match?.basis).toContain('nicht auf beiden Seiten vor')
  })

  it('verschiedener Geburtsort widerlegt den Treffer', () => {
    expect(compareAttributes(candidate(), candidate({ placeOfBirth: 'Brünn' }))).toBeNull()
  })

  it('verschiedenes Geburtsdatum ist kein Treffer', () => {
    expect(compareAttributes(candidate(), candidate({ dateOfBirth: DAY('1989-04-13') }))).toBeNull()
  })

  it('verschiedener Name ist kein Treffer — auch nicht bei gleichem Geburtsdatum', () => {
    expect(compareAttributes(candidate(), candidate({ familyName: 'Dvorská' }))).toBeNull()
    expect(compareAttributes(candidate(), candidate({ givenName: 'Marketa' }))).toBeNull()
  })

  it('Groß- und Kleinschreibung und Leerraum entscheiden nicht', () => {
    const match = compareAttributes(
      candidate(),
      candidate({ givenName: '  marek ', familyName: 'DVOŘÁK', placeOfBirth: ' pilsen' }),
    )
    expect(match?.strength).toBe('allAttributes')
  })

  it('kein unscharfer Abgleich: ein Tippfehler im Namen ist kein Treffer', () => {
    expect(compareAttributes(candidate(), candidate({ familyName: 'Dvorak' }))).toBeNull()
  })
})

describe('3.6 — der Abgleich schlägt vor', () => {
  const marekS1 = candidate({ candidateId: 'k-1', supplierId: 'lieferant-1' })
  const marekS2 = candidate({ candidateId: 'k-2', supplierId: 'lieferant-2' })
  const andere = candidate({
    candidateId: 'k-3',
    supplierId: 'lieferant-2',
    givenName: 'Ruth',
    familyName: 'Delfs',
    dateOfBirth: DAY('1990-11-05'),
    placeOfBirth: 'Rostock',
  })

  it('schlägt den Satz eines **anderen** Lieferanten vor', () => {
    const proposals = proposalsFor(marekS1, [marekS1, marekS2, andere])
    expect(proposals).toHaveLength(1)
    expect(proposals[0]?.otherCandidateId).toBe('k-2')
  })

  it('schlägt **nicht** den eigenen zweiten Satz vor: das ist eine Doppelerfassung des Lieferanten', () => {
    const zweiterSatzS1 = candidate({ candidateId: 'k-4', supplierId: 'lieferant-1' })
    expect(proposalsFor(marekS1, [zweiterSatzS1])).toEqual([])
  })

  it('schlägt sich nicht selbst vor', () => {
    expect(proposalsFor(marekS1, [marekS1])).toEqual([])
  })

  it('nennt je Paar **einen** Vorschlag, nicht zwei', () => {
    const proposals = allProposals([marekS1, marekS2, andere])
    expect(proposals).toHaveLength(1)
    expect(proposals[0]).toMatchObject({ candidateId: 'k-1', otherCandidateId: 'k-2' })
  })

  it('der Vorschlag trägt seine Begründung — sie wird beim Bestätigen gelesen (3.6)', () => {
    const proposals = allProposals([marekS1, marekS2])
    expect(proposals[0]?.basis).toContain('Marek Dvořák')
    expect(proposals[0]?.basis).toContain('1989-04-12')
  })
})

describe('3.6 und 4.2.3 — ein Vorschlag ist keine Identität', () => {
  it('zwei Sätze zählen zusammen, wenn **beide** auf dieselbe bestätigte Identität verweisen', () => {
    expect(
      isSamePerson({ workerIdentityId: 'pi-1' }, { workerIdentityId: 'pi-1' }),
    ).toBe(true)
  })

  it('ein nur vorgeschlagener Treffer zählt nicht: der Satz trägt keine Identität', () => {
    // Genau der Fall aus dem Seed: Ilona Brandt bei Lieferant 1 bestätigt,
    // bei Lieferant 2 nur vorgeschlagen. Bis zur Bestätigung ist jeder Satz
    // eine eigene Person — und P1 zählt die Tage deshalb nicht zusammen.
    expect(isSamePerson({ workerIdentityId: 'pi-2' }, { workerIdentityId: null })).toBe(false)
  })

  it('zwei Sätze ohne Identität sind nicht dieselbe Person', () => {
    expect(isSamePerson({ workerIdentityId: null }, { workerIdentityId: null })).toBe(false)
  })

  it('verschiedene Identitäten sind verschiedene Personen', () => {
    expect(isSamePerson({ workerIdentityId: 'pi-1' }, { workerIdentityId: 'pi-2' })).toBe(false)
  })

  it('der Abgleich schreibt nichts: ein Vorschlag setzt keine Identität am Satz', () => {
    const marekS1 = candidate({ candidateId: 'k-1', supplierId: 'lieferant-1' })
    const marekS2 = candidate({ candidateId: 'k-2', supplierId: 'lieferant-2' })
    allProposals([marekS1, marekS2])
    expect(marekS1.workerIdentityId).toBeNull()
    expect(marekS2.workerIdentityId).toBeNull()
    expect(isSamePerson(marekS1, marekS2)).toBe(false)
  })
})
