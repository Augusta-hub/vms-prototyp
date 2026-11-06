/**
 * Der Stammdatendienst gegen eine echte Datenbank — SPEC 3.1 bis 3.3.
 *
 * **Stand:** diese Datei prüft bisher nur die Naht, die mit 5.4.3 entstanden
 * ist — dass `createSupplierPermit` die Invarianten aus 3.2 aus
 * `lib/masterdata/invariants.ts` wirklich aufruft und nicht eine zweite,
 * eigene Fassung führt. Die übrigen Schreibwege (Kunde, Standort,
 * Kostenstelle, Vergleichsentgelt) sind hier noch nicht geprüft; das ist in
 * PROGRESS.md benannt.
 *
 * Alle Daten sind synthetisch (CLAUDE.md, Regel 3).
 */

import { beforeEach, describe, expect, it } from 'vitest'
import { loadIdentity, type LoadedIdentity } from '../../lib/identity/loadSubject'
import { prisma } from '../../lib/prisma'
import { createSupplierPermit } from '../../lib/services/masterData'
import { baueWelt, leereDatenbank, tag, type Welt } from './fixture'

let welt: Welt
let administrator: LoadedIdentity

beforeEach(async () => {
  await leereDatenbank()
  welt = await baueWelt()
  const geladen = await loadIdentity(welt.administrator)
  if (geladen === null) throw new Error('Die Testidentität ließ sich nicht laden.')
  administrator = geladen
})

describe('AÜG-Erlaubnis anlegen (SPEC 3.2)', () => {
  const eingabe = (teile: Partial<Parameters<typeof createSupplierPermit>[1]> = {}) => ({
    supplierId: welt.lieferant,
    permitNumber: 'AZ-NEU-1',
    issuingAuthority: 'Agentur für Arbeit (synthetisch)',
    permitType: 'fixedTerm' as const,
    issuedOn: tag('2026-01-01'),
    validFrom: tag('2026-02-01'),
    validTo: tag('2029-01-31'),
    certificateDocumentRef: null,
    ...teile,
  })

  it('legt den befristeten Satz mit Ende an — als eingereicht (5.4.3)', async () => {
    const ergebnis = await createSupplierPermit(administrator, eingabe())
    expect(ergebnis.ok).toBe(true)
    const zeile = await prisma.supplierPermit.findFirstOrThrow({
      where: { permitNumber: 'AZ-NEU-1' },
    })
    expect(zeile.verificationStatus).toBe('submitted')
  })

  it('verweigert den befristeten Satz ohne Ende und nennt 3.2 (5.4.6: Datenfehler)', async () => {
    const ergebnis = await createSupplierPermit(administrator, eingabe({ validTo: null }))
    expect(ergebnis.ok).toBe(false)
    if (!ergebnis.ok) {
      expect(ergebnis.specReference).toMatch(/SPEC 3\.2/)
      expect(ergebnis.error).toMatch(/validTo/)
    }
    expect(await prisma.supplierPermit.count({ where: { permitNumber: 'AZ-NEU-1' } })).toBe(0)
  })

  it('verweigert den unbefristeten Satz mit Ende (3.2)', async () => {
    const ergebnis = await createSupplierPermit(administrator, eingabe({ permitType: 'unlimited' }))
    expect(ergebnis.ok).toBe(false)
  })

  it('verweigert einen rückwärts laufenden Zeitraum (3.2)', async () => {
    const ergebnis = await createSupplierPermit(
      administrator,
      eingabe({ validFrom: tag('2029-01-01'), validTo: tag('2026-01-01') }),
    )
    expect(ergebnis.ok).toBe(false)
  })
})
