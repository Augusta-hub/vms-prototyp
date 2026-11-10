/**
 * Der Lieferantenstatus gegen eine echte Datenbank — SPEC 4.6 und die vier
 * Querschnittszeilen Q41 bis Q44.
 *
 * Was hier geprüft wird und **nirgends sonst**: dass der Dienst die richtigen
 * Zeilen lädt (Erlaubnis samt Urkunde, Nachweise, Rahmenvertrag **mit
 * Zeitraum**, laufende Einsätze), dass die gerechneten Tatsachen den Übergang
 * wirklich erreichen und ihn sperren, und dass eine Sperre nichts schreibt
 * (4.0, Regel 5).
 *
 * Die Übergangsmenge selbst ist in `lib/status/supplier.test.ts` ohne
 * Datenbank geprüft. Alle Daten sind synthetisch (CLAUDE.md, Regel 3).
 */

import { beforeEach, describe, expect, it } from 'vitest'
import { loadIdentity, type LoadedIdentity } from '../../lib/identity/loadSubject'
import { prisma } from '../../lib/prisma'
import {
  loadSupplierStatus,
  transitionSupplier,
  type SupplierTransitionInput,
} from '../../lib/services/supplierStatus'
import { baueWelt, legeEinsatzAn, leereDatenbank, tag, type Welt } from './fixture'

/** Der Tag des Übergangs — nach 5.0 der Stichtag, nie „heute" (fest gesetzt). */
const UEBERGANGSTAG = tag('2026-11-10')

let welt: Welt
let administrator: LoadedIdentity
let disponent: LoadedIdentity
let lieferantAdmin: LoadedIdentity

async function identitaet(userId: string): Promise<LoadedIdentity> {
  const geladen = await loadIdentity(userId)
  if (geladen === null) throw new Error('Die Testidentität ließ sich nicht laden.')
  return geladen
}

beforeEach(async () => {
  await leereDatenbank()
  welt = await baueWelt()
  administrator = await identitaet(welt.administrator)
  disponent = await identitaet(welt.disponent)
  lieferantAdmin = await identitaet(welt.lieferantAdmin)
})

/** Der erste Lieferant der Welt in einem bestimmten Zustand (4.6). */
async function setzeStatus(
  status: 'onboarding' | 'active' | 'blocked' | 'inactive',
  weiteres: Record<string, unknown> = {},
): Promise<void> {
  await prisma.supplier.update({
    where: { id: welt.lieferant },
    data: { status, ...weiteres },
  })
}

function eingabe(teile: Partial<SupplierTransitionInput> = {}): SupplierTransitionInput {
  return {
    supplierId: welt.lieferant,
    transition: 'activate',
    blockReason: null,
    unblockReason: null,
    reactivationReason: null,
    validTo: null,
    ...teile,
  }
}

async function status(): Promise<string> {
  const zeile = await prisma.supplier.findUniqueOrThrow({ where: { id: welt.lieferant } })
  return zeile.status
}

describe('Freischalten (onboarding → active, Q41 und Q42)', () => {
  beforeEach(async () => {
    await setzeStatus('onboarding')
  })

  it('schaltet frei, wenn Rahmenvertrag, Tarifbindung, Erlaubnis und Nachweise tragen', async () => {
    const ergebnis = await transitionSupplier(administrator, eingabe(), UEBERGANGSTAG)
    expect(ergebnis.ok).toBe(true)
    if (ergebnis.ok) expect(ergebnis.message).toMatch(/aktiv/)
    expect(await status()).toBe('active')
  })

  it('sperrt das Freischalten ohne anerkannte Erlaubnis — P9, Q41 (5.4.1)', async () => {
    await prisma.supplierPermit.updateMany({
      where: { supplierId: welt.lieferant },
      data: { verificationStatus: 'submitted' },
    })
    const ergebnis = await transitionSupplier(administrator, eingabe(), UEBERGANGSTAG)
    expect(ergebnis.ok).toBe(false)
    if (!ergebnis.ok) {
      expect(ergebnis.error).toMatch(/P9/)
      expect(ergebnis.specReference).toMatch(/Q41/)
    }
    // 4.0, Regel 5: eine Sperre schreibt nichts.
    expect(await status()).toBe('onboarding')
  })

  it('sperrt es, wenn die Urkunde zur Erlaubnis fehlt (3.2 E25, 5.4.5)', async () => {
    await prisma.supplierPermit.updateMany({
      where: { supplierId: welt.lieferant },
      data: { certificateDocumentRef: null },
    })
    const ergebnis = await transitionSupplier(administrator, eingabe(), UEBERGANGSTAG)
    expect(ergebnis.ok).toBe(false)
    expect(await status()).toBe('onboarding')
  })

  it('sperrt es, wenn die Erlaubnis am Tag des Übergangs abgelaufen ist (5.0)', async () => {
    // Der Stichtag ist der **Tag des Übergangs**: eine Erlaubnis, die bis
    // Juni 2026 lief, deckt den 10.11.2026 nicht mehr.
    await prisma.supplierPermit.updateMany({
      where: { supplierId: welt.lieferant },
      data: { permitType: 'fixedTerm', validTo: tag('2026-06-30') },
    })
    const ergebnis = await transitionSupplier(administrator, eingabe(), UEBERGANGSTAG)
    expect(ergebnis.ok).toBe(false)
    if (!ergebnis.ok) expect(ergebnis.error).toMatch(/P9/)
    expect(await status()).toBe('onboarding')
  })

  it('rechnet mit dem Tag des Übergangs und **nicht** mit „heute" (5.0)', async () => {
    // Die Erlaubnis läuft Ende 2026 ab. Heute (der Tag des Testlaufs) deckt sie
    // noch; der **Übergangstag** liegt im März 2027 und wird nicht gedeckt.
    // Wer „heute" prüft, schaltet diesen Lieferanten frei — und genau das ist
    // der Fehler, den 5.0 verhindert.
    await prisma.supplierPermit.updateMany({
      where: { supplierId: welt.lieferant },
      data: { permitType: 'fixedTerm', validTo: tag('2026-12-31') },
    })
    const spaeter = tag('2027-03-01')
    const ergebnis = await transitionSupplier(administrator, eingabe(), spaeter)
    expect(ergebnis.ok).toBe(false)
    if (!ergebnis.ok) expect(ergebnis.error).toMatch(/P9/)
    expect(await status()).toBe('onboarding')

    // Am Tag des Übergangs **vor** dem Ablauf trägt dieselbe Erlaubnis.
    const vorher = await transitionSupplier(administrator, eingabe(), tag('2026-12-01'))
    expect(vorher.ok).toBe(true)
    expect(await status()).toBe('active')
  })

  it('sperrt es ohne Tarifbindung des Verleihers (3.2)', async () => {
    await prisma.supplier.update({
      where: { id: welt.lieferant },
      data: { supplierCollectiveAgreementId: null },
    })
    const ergebnis = await transitionSupplier(administrator, eingabe(), UEBERGANGSTAG)
    expect(ergebnis.ok).toBe(false)
    if (!ergebnis.ok) expect(ergebnis.error).toMatch(/supplierCollectiveAgreement/)
  })

  it('sperrt es, wenn der Rahmenvertrag am Stichtag nicht mehr gilt (3.0, Festlegung 2)', async () => {
    // Der Status allein wäre die halbe Antwort: der Vertrag steht auf `active`,
    // sein Zeitraum deckt den Stichtag aber nicht.
    await prisma.masterAgreement.updateMany({
      where: { supplierId: welt.lieferant },
      data: { validTo: tag('2026-01-31') },
    })
    const ergebnis = await transitionSupplier(administrator, eingabe(), UEBERGANGSTAG)
    expect(ergebnis.ok).toBe(false)
    if (!ergebnis.ok) expect(ergebnis.error).toMatch(/Rahmenvertrag/)
  })

  it('löst das Freischalten nicht durch den Disponenten aus ([5])', async () => {
    const ergebnis = await transitionSupplier(disponent, eingabe(), UEBERGANGSTAG)
    expect(ergebnis.ok).toBe(false)
    expect(await status()).toBe('onboarding')
  })

  it('löst es nicht durch den Lieferanten selbst aus ([7]: Stammdaten, nicht Status)', async () => {
    const ergebnis = await transitionSupplier(lieferantAdmin, eingabe(), UEBERGANGSTAG)
    expect(ergebnis.ok).toBe(false)
    expect(await status()).toBe('onboarding')
  })
})

describe('Sperren und Entsperren (Q43)', () => {
  it('sperrt den Lieferanten durch den Disponenten mit Sperrgrund ([5])', async () => {
    const ergebnis = await transitionSupplier(
      disponent,
      eingabe({ transition: 'block', blockReason: 'Erlaubnis widerrufen (synthetisch)' }),
      UEBERGANGSTAG,
    )
    expect(ergebnis.ok).toBe(true)
    const zeile = await prisma.supplier.findUniqueOrThrow({ where: { id: welt.lieferant } })
    expect(zeile.status).toBe('blocked')
    expect(zeile.blockReason).toBe('Erlaubnis widerrufen (synthetisch)')
    expect(zeile.blockedById).toBe(welt.disponent)
    expect(zeile.blockedAt).not.toBeNull()
  })

  it('verweigert die Sperre ohne Sperrgrund (3.2) und schreibt nichts', async () => {
    const ergebnis = await transitionSupplier(
      disponent,
      eingabe({ transition: 'block', blockReason: '  ' }),
      UEBERGANGSTAG,
    )
    expect(ergebnis.ok).toBe(false)
    expect(await status()).toBe('active')
  })

  it('entsperrt **nicht** durch den Disponenten — [5]: sperren ja, entsperren nein', async () => {
    await transitionSupplier(
      disponent,
      eingabe({ transition: 'block', blockReason: 'synthetisch' }),
      UEBERGANGSTAG,
    )
    const ergebnis = await transitionSupplier(
      disponent,
      eingabe({ transition: 'unblock', unblockReason: 'Grund behoben' }),
      UEBERGANGSTAG,
    )
    expect(ergebnis.ok).toBe(false)
    expect(await status()).toBe('blocked')
  })

  it('entsperrt nicht durch die sperrende Person (Vier-Augen, 2.4 Regel 5)', async () => {
    // Der Administrator sperrt und versucht selbst zu entsperren.
    await transitionSupplier(
      administrator,
      eingabe({ transition: 'block', blockReason: 'synthetisch' }),
      UEBERGANGSTAG,
    )
    const ergebnis = await transitionSupplier(
      administrator,
      eingabe({ transition: 'unblock', unblockReason: 'Grund behoben' }),
      UEBERGANGSTAG,
    )
    expect(ergebnis.ok).toBe(false)
    if (!ergebnis.ok) expect(ergebnis.error).toMatch(/Vier-Augen/)
    expect(await status()).toBe('blocked')
  })

  it('entsperrt durch `MA`, wenn der Disponent gesperrt hatte — mit Aufhebungsgrund', async () => {
    await transitionSupplier(
      disponent,
      eingabe({ transition: 'block', blockReason: 'synthetisch' }),
      UEBERGANGSTAG,
    )
    const ergebnis = await transitionSupplier(
      administrator,
      eingabe({ transition: 'unblock', unblockReason: 'Erlaubnis neu erteilt' }),
      UEBERGANGSTAG,
    )
    expect(ergebnis.ok).toBe(true)
    // P10 prüft an **Q43**, nicht an der Zeile des Freischaltens: welche
    // Nachweisarten der Katalog prüft, hängt am Prüfzeitpunkt (5.4.4).
    if (ergebnis.ok) expect(ergebnis.message).toMatch(/Q43/)
    const zeile = await prisma.supplier.findUniqueOrThrow({ where: { id: welt.lieferant } })
    expect(zeile.status).toBe('active')
    expect(zeile.unblockReason).toBe('Erlaubnis neu erteilt')
    // Der Sperrvermerk bleibt die Geschichte dieser Organisation.
    expect(zeile.blockReason).toBe('synthetisch')
  })

  it('verweigert die Entsperrung ohne Aufhebungsgrund (4.6)', async () => {
    await transitionSupplier(
      disponent,
      eingabe({ transition: 'block', blockReason: 'synthetisch' }),
      UEBERGANGSTAG,
    )
    const ergebnis = await transitionSupplier(
      administrator,
      eingabe({ transition: 'unblock', unblockReason: null }),
      UEBERGANGSTAG,
    )
    expect(ergebnis.ok).toBe(false)
    expect(await status()).toBe('blocked')
  })

  it('sperrt die Entsperrung ohne gültige Erlaubnis — P9, Q43', async () => {
    await transitionSupplier(
      disponent,
      eingabe({ transition: 'block', blockReason: 'Erlaubnis abgelaufen' }),
      UEBERGANGSTAG,
    )
    await prisma.supplierPermit.updateMany({
      where: { supplierId: welt.lieferant },
      data: { verificationStatus: 'rejected', rejectionReason: 'synthetisch' },
    })
    const ergebnis = await transitionSupplier(
      administrator,
      eingabe({ transition: 'unblock', unblockReason: 'Grund behoben' }),
      UEBERGANGSTAG,
    )
    expect(ergebnis.ok).toBe(false)
    if (!ergebnis.ok) expect(ergebnis.specReference).toMatch(/Q43/)
    expect(await status()).toBe('blocked')
  })
})

describe('Beauftragung beenden und reaktivieren (Q44)', () => {
  it('beendet die Beauftragung mit `validTo` und ohne laufenden Einsatz', async () => {
    const ergebnis = await transitionSupplier(
      administrator,
      eingabe({ transition: 'deactivate', validTo: tag('2026-12-31') }),
      UEBERGANGSTAG,
    )
    expect(ergebnis.ok).toBe(true)
    const zeile = await prisma.supplier.findUniqueOrThrow({ where: { id: welt.lieferant } })
    expect(zeile.status).toBe('inactive')
    expect(zeile.validTo?.toISOString().slice(0, 10)).toBe('2026-12-31')
  })

  it('verweigert sie bei laufendem Einsatz (4.3) und schreibt nichts', async () => {
    await legeEinsatzAn(welt, {
      nummer: 'E-LAUFEND',
      status: 'active',
      plannedStartDate: tag('2026-02-02'),
      plannedEndDate: tag('2027-01-31'),
      actualStartDate: tag('2026-02-02'),
    })
    const ergebnis = await transitionSupplier(
      administrator,
      eingabe({ transition: 'deactivate', validTo: tag('2026-12-31') }),
      UEBERGANGSTAG,
    )
    expect(ergebnis.ok).toBe(false)
    if (!ergebnis.ok) expect(ergebnis.error).toMatch(/Einsatz/)
    expect(await status()).toBe('active')
  })

  it('verweigert sie ohne `validTo` (3.2)', async () => {
    const ergebnis = await transitionSupplier(
      administrator,
      eingabe({ transition: 'deactivate', validTo: null }),
      UEBERGANGSTAG,
    )
    expect(ergebnis.ok).toBe(false)
  })

  it('reaktiviert mit Begründung und nimmt das Ende der Beauftragung zurück', async () => {
    await setzeStatus('inactive', { validTo: tag('2026-10-31') })
    const ergebnis = await transitionSupplier(
      administrator,
      eingabe({ transition: 'reactivate', reactivationReason: 'Neue Beauftragung 2027' }),
      UEBERGANGSTAG,
    )
    expect(ergebnis.ok).toBe(true)
    if (ergebnis.ok) expect(ergebnis.message).toMatch(/Q44/)
    const zeile = await prisma.supplier.findUniqueOrThrow({ where: { id: welt.lieferant } })
    expect(zeile.status).toBe('active')
    expect(zeile.reactivationReason).toBe('Neue Beauftragung 2027')
    expect(zeile.validTo).toBeNull()
  })

  it('verweigert die Reaktivierung ohne Begründung (4.6)', async () => {
    await setzeStatus('inactive', { validTo: tag('2026-10-31') })
    const ergebnis = await transitionSupplier(
      administrator,
      eingabe({ transition: 'reactivate', reactivationReason: null }),
      UEBERGANGSTAG,
    )
    expect(ergebnis.ok).toBe(false)
    expect(await status()).toBe('inactive')
  })

  it('sperrt die Reaktivierung ohne Pflichtnachweise und Erlaubnis — Q44', async () => {
    await setzeStatus('inactive', { validTo: tag('2026-10-31') })
    await prisma.supplierPermit.deleteMany({ where: { supplierId: welt.lieferant } })
    const ergebnis = await transitionSupplier(
      administrator,
      eingabe({ transition: 'reactivate', reactivationReason: 'Neue Beauftragung' }),
      UEBERGANGSTAG,
    )
    expect(ergebnis.ok).toBe(false)
    if (!ergebnis.ok) expect(ergebnis.specReference).toMatch(/Q44/)
    expect(await status()).toBe('inactive')
  })
})

describe('Die Ansicht des Lieferantenstatus (2.3, 5.4.6)', () => {
  it('nennt dem Betreiber die Übergänge und die offenen Vorbedingungen', async () => {
    await setzeStatus('onboarding')
    await prisma.supplierPermit.updateMany({
      where: { supplierId: welt.lieferant },
      data: { verificationStatus: 'submitted' },
    })
    const zeilen = await loadSupplierStatus(administrator, UEBERGANGSTAG)
    const eigene = zeilen.find((zeile) => zeile.id === welt.lieferant)
    expect(eigene?.state).toBe('onboarding')
    expect(eigene?.availableTransitions).toContain('activate')
    // Benannt, nicht verschwiegen: welcher Nachweis fehlt (5.4.6).
    expect(eigene?.blockers.join(' ')).toMatch(/P9/)
    expect(eigene?.findings.find((befund) => befund.check === 'P9')?.satisfied).toBe(false)
  })

  it('bietet dem Disponenten nur die Sperre an ([5])', async () => {
    const zeilen = await loadSupplierStatus(disponent, UEBERGANGSTAG)
    const eigene = zeilen.find((zeile) => zeile.id === welt.lieferant)
    expect(eigene?.availableTransitions).toEqual(['block'])
  })

  it('bietet dem Lieferanten keinen Übergang an und zeigt ihm nur sich selbst ([7])', async () => {
    const zeilen = await loadSupplierStatus(lieferantAdmin, UEBERGANGSTAG)
    expect(zeilen.map((zeile) => zeile.supplierNumber)).toEqual(['L-1'])
    expect(zeilen[0]?.availableTransitions).toEqual([])
  })

  it('bietet die Beendigung nicht an, solange ein Einsatz läuft (4.6)', async () => {
    await legeEinsatzAn(welt, {
      nummer: 'E-LAUFEND-2',
      status: 'active',
      plannedStartDate: tag('2026-02-02'),
      plannedEndDate: tag('2027-01-31'),
      actualStartDate: tag('2026-02-02'),
    })
    const zeilen = await loadSupplierStatus(administrator, UEBERGANGSTAG)
    const eigene = zeilen.find((zeile) => zeile.id === welt.lieferant)
    expect(eigene?.runningAssignments).toBe(1)
    expect(eigene?.availableTransitions).not.toContain('deactivate')
  })

  it('bietet dem sperrenden Betreiber die Entsperrung nicht an (Vier-Augen)', async () => {
    await transitionSupplier(
      administrator,
      eingabe({ transition: 'block', blockReason: 'synthetisch' }),
      UEBERGANGSTAG,
    )
    const zeilen = await loadSupplierStatus(administrator, UEBERGANGSTAG)
    const eigene = zeilen.find((zeile) => zeile.id === welt.lieferant)
    expect(eigene?.state).toBe('blocked')
    expect(eigene?.availableTransitions).not.toContain('unblock')
    expect(eigene?.availableTransitions).toContain('deactivate')
  })
})
