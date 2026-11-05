/**
 * Die Anbindung des Regelwerks an die Statusmodelle — gegen eine echte
 * Datenbank.
 *
 * Was hier geprüft wird und **nirgends sonst**: dass der Dienst die richtigen
 * Zeilen lädt (die Überlassungskette über Lieferanten hinweg, die
 * Tarifzuordnung nach der Rangfolge aus 5.1.2, den Konzernverbund des
 * Entleihers), dass die gerechnete Tatsache den Übergang wirklich erreicht, und
 * dass die abgeleiteten Felder aus 3.7 an **jedem** Einsatz der Kette landen.
 *
 * Die Rechnung selbst ist in `lib/aueg/` ohne Datenbank geprüft. Hier geht es
 * um die Naht zwischen beidem: um die Abfrage, die Umrechnung und den
 * Schreibvorgang.
 *
 * Alle Daten sind synthetisch (CLAUDE.md, Regel 3), und die Tests laufen gegen
 * eine **eigene** Datenbank, nicht gegen die Entwicklungsdatenbank
 * (`tests/services/umgebung.ts`).
 */

import { beforeEach, describe, expect, it } from 'vitest'
import { prisma } from '../../lib/prisma'
import { loadIdentity, type LoadedIdentity } from '../../lib/identity/loadSubject'
import {
  requestExtension,
  transitionAssignment,
  transitionExtension,
} from '../../lib/services/staffing'
import {
  baueWelt,
  entferneVerleiherzuordnungen,
  legeEinsatzAn,
  legeTarifzuordnungAn,
  leereDatenbank,
  tag,
  type Welt,
} from './fixture'

let welt: Welt
let disponent: LoadedIdentity
let genehmiger: LoadedIdentity

beforeEach(async () => {
  await leereDatenbank()
  welt = await baueWelt()
  const geladen = await loadIdentity(welt.disponent)
  const geladenerGenehmiger = await loadIdentity(welt.genehmiger)
  if (geladen === null || geladenerGenehmiger === null) {
    throw new Error('Die Testidentitäten ließen sich nicht laden.')
  }
  disponent = geladen
  genehmiger = geladenerGenehmiger
})

/** Der Fristenstand, wie er in der Datenbank steht (3.7, abgeleitete Felder). */
async function fristenstand(
  nummer: string,
): Promise<{ fristende: string | null; angerechnet: number | null }> {
  const zeile = await prisma.assignment.findFirstOrThrow({ where: { assignmentNumber: nummer } })
  return {
    fristende: zeile.maxDurationEndDate?.toISOString().slice(0, 10) ?? null,
    angerechnet: zeile.countedDurationDays,
  }
}

/** Der Einsatzstart (4.3.1, `planned` → `active`) mit dem genannten Tag. */
async function starte(einsatzId: string, ersterTag: Date) {
  return transitionAssignment(disponent, {
    assignmentId: einsatzId,
    transition: 'start',
    actualStartDate: ersterTag,
    actualEndDate: null,
    interruptionFrom: null,
    interruptionReason: null,
    interruptionTo: null,
  })
}

describe('P1: die Überlassungskette wird geladen und fortgeschrieben (SPEC 5.1, 5.0)', () => {
  it('zählt über Lieferanten hinweg und schreibt den Stand an jeden Einsatz der Kette', async () => {
    await legeTarifzuordnungAn(welt, {
      ebene: 'site',
      monate: 18,
      validFrom: tag('2025-01-01'),
      validTo: tag('2028-12-31'),
    })
    // Erster Einsatz über „Rheinpersonal", vorzeitig beendet (4.3.1).
    await legeEinsatzAn(welt, {
      nummer: 'E-1',
      status: 'terminatedEarly',
      plannedStartDate: tag('2026-01-15'),
      actualStartDate: tag('2026-01-15'),
      actualEndDate: tag('2026-05-31'),
    })
    // Zweiter Einsatz über den **anderen** Lieferanten, dieselbe Person,
    // derselbe Kunde: § 1 Abs. 1b Satz 2 rechnet die Zeiten an.
    const zweiter = await legeEinsatzAn(welt, {
      nummer: 'E-2',
      status: 'planned',
      plannedStartDate: tag('2026-06-01'),
      lieferant: welt.zweiterLieferant,
      kandidat: welt.kandidatZweiterLieferant,
      // Der neue Einsatz verweist auf den **eigenen** Rahmenvertrag des neuen
      // Lieferanten (K1, SPEC 5.3.3, Grenzfall „Lieferantenwechsel").
      einkaufsposition: welt.zweiteEinkaufsposition,
    })

    const ergebnis = await starte(zweiter, tag('2026-06-01'))
    expect(ergebnis.ok).toBe(true)

    // 546 Tage ab dem 15.01.2026 enden am 14.07.2027 (5.1.3, Schritt 4), und
    // am Stichtag sind 138 Tage angerechnet — über **beide** Einsätze.
    for (const nummer of ['E-1', 'E-2']) {
      expect(await fristenstand(nummer)).toEqual({ fristende: '2027-07-14', angerechnet: 138 })
    }
  })

  it('sperrt den Einsatzstart nach dem Fristende und schreibt nichts (Q23)', async () => {
    await legeTarifzuordnungAn(welt, {
      ebene: 'site',
      monate: 18,
      validFrom: tag('2025-01-01'),
      validTo: tag('2028-12-31'),
    })
    await legeEinsatzAn(welt, {
      nummer: 'E-1',
      status: 'completed',
      plannedStartDate: tag('2026-01-15'),
      actualStartDate: tag('2026-01-15'),
      actualEndDate: tag('2027-07-14'),
    })
    const zweiter = await legeEinsatzAn(welt, {
      nummer: 'E-2',
      status: 'planned',
      plannedStartDate: tag('2027-07-15'),
    })

    const ergebnis = await starte(zweiter, tag('2027-07-15'))
    expect(ergebnis.ok).toBe(false)
    expect(ergebnis.ok === false && ergebnis.error).toMatch(/Höchstüberlassungsdauer/)

    const zeile = await prisma.assignment.findFirstOrThrow({ where: { assignmentNumber: 'E-2' } })
    expect(zeile.status).toBe('planned')
    // Eine Sperre schreibt nichts: der Übergang hat nicht stattgefunden
    // (4.0, Regel 5).
    expect(zeile.maxDurationEndDate).toBeNull()
  })

  it('lässt den Start am Fristende zu — der Tag selbst ist zulässig (5.1.5)', async () => {
    await legeTarifzuordnungAn(welt, {
      ebene: 'site',
      monate: 18,
      validFrom: tag('2025-01-01'),
      validTo: tag('2028-12-31'),
    })
    await legeEinsatzAn(welt, {
      nummer: 'E-1',
      status: 'completed',
      plannedStartDate: tag('2026-01-15'),
      actualStartDate: tag('2026-01-15'),
      actualEndDate: tag('2027-07-13'),
    })
    const zweiter = await legeEinsatzAn(welt, {
      nummer: 'E-2',
      status: 'planned',
      plannedStartDate: tag('2027-07-14'),
      // Die Kette läuft seit dem 15.01.2026; Equal Pay ist seit dem 15.10.2026
      // geschuldet (9 Monate, 5.2.2 Fall 2). Ohne `comparableWage` sperrt Q48
      // den Start — zu Recht. Der Test prüft die Grenze aus 5.1.5, nicht die
      // Entgeltlücke, und braucht deshalb eine rechtmäßige Welt.
      vergleichsentgelt: '21.40',
    })

    expect((await starte(zweiter, tag('2027-07-14'))).ok).toBe(true)
  })
})

describe('Die Grenze kommt aus der Tarifzuordnung am Stichtag (SPEC 5.1.2)', () => {
  async function fristendeNachStart(): Promise<string | null> {
    const einsatz = await legeEinsatzAn(welt, {
      nummer: 'E-1',
      status: 'planned',
      plannedStartDate: tag('2026-01-15'),
    })
    const ergebnis = await starte(einsatz, tag('2026-01-15'))
    expect(ergebnis.ok).toBe(true)
    return (await fristenstand('E-1')).fristende
  }

  it('nimmt die Zuordnung des Standorts vor der des Kunden', async () => {
    await legeTarifzuordnungAn(welt, { ebene: 'customer', monate: 24, validFrom: tag('2025-01-01') })
    await legeTarifzuordnungAn(welt, { ebene: 'site', monate: 18, validFrom: tag('2025-01-01') })
    // 18 Monate ab dem 15.01.2026, nicht 24.
    expect(await fristendeNachStart()).toBe('2027-07-14')
  })

  it('liest die Zuordnung der Verleiherseite nicht', async () => {
    await legeTarifzuordnungAn(welt, { ebene: 'supplier', monate: 36, validFrom: tag('2025-01-01') })
    await legeTarifzuordnungAn(welt, { ebene: 'site', monate: 18, validFrom: tag('2025-01-01') })
    expect(await fristendeNachStart()).toBe('2027-07-14')
  })

  it('rechnet mit der gesetzlichen Regelgrenze, wenn keine Zuordnung den Stichtag deckt', async () => {
    await legeTarifzuordnungAn(welt, {
      ebene: 'site',
      monate: 24,
      validFrom: tag('2025-01-01'),
      validTo: tag('2025-12-31'),
    })
    // Die Zuordnung endet vor dem Stichtag: 18 Monate, nicht 24 — und nicht
    // „keine Grenze" (5.0, Grundsatz 4).
    expect(await fristendeNachStart()).toBe('2027-07-14')
  })

  it('nimmt die spätere Zuordnung derselben Ebene — eine Senkung wirkt nach vorn', async () => {
    await legeTarifzuordnungAn(welt, { ebene: 'site', monate: 24, validFrom: tag('2025-01-01') })
    await legeTarifzuordnungAn(welt, { ebene: 'site', monate: 18, validFrom: tag('2026-01-01') })
    expect(await fristendeNachStart()).toBe('2027-07-14')
  })
})

describe('P6: die Drehtürklausel erreicht den Übergang (SPEC 5.3.1, 4.3.1)', () => {
  async function einsatzMitVorbeschaeftigung(arbeitgeber: string, austritt: Date): Promise<string> {
    await prisma.candidate.update({
      where: { id: welt.kandidat },
      data: {
        previousEmploymentDeclaredAt: tag('2026-05-01'),
        previousEmploymentExisted: true,
        previousEmploymentEndedOn: austritt,
        previousEmploymentEmployer: arbeitgeber,
      },
    })
    return legeEinsatzAn(welt, {
      nummer: 'E-1',
      status: 'planned',
      plannedStartDate: tag('2026-09-01'),
    })
  }

  it('sperrt den Start ohne Vergleichsentgelt, wenn die Drehtür greift', async () => {
    const einsatz = await einsatzMitVorbeschaeftigung('Nordwerk Metall GmbH', tag('2026-04-30'))
    const ergebnis = await starte(einsatz, tag('2026-09-01'))
    // Equal Pay ab dem ersten Tag (5.3.1, Schritt 5) — ohne
    // `comparableWage` greift die Vorbedingung aus 4.3.1 zu P4.
    expect(ergebnis.ok).toBe(false)
    expect(ergebnis.ok === false && ergebnis.error).toMatch(/Vergleichsentgelt/)
  })

  it('greift auch für einen Arbeitgeber desselben Konzerns (§ 18 AktG)', async () => {
    const einsatz = await einsatzMitVorbeschaeftigung('Nordwerk Service GmbH', tag('2026-05-31'))
    const ergebnis = await starte(einsatz, tag('2026-09-01'))
    expect(ergebnis.ok).toBe(false)
    expect(ergebnis.ok === false && ergebnis.error).toMatch(/Vergleichsentgelt/)
  })

  it('greift nicht, wenn der Austritt vor dem Rückschaufenster liegt', async () => {
    const einsatz = await einsatzMitVorbeschaeftigung('Nordwerk Metall GmbH', tag('2026-02-28'))
    // Das Fenster reicht vom 01.03.2026 bis zum 31.08.2026 (5.3.1, Schritt 2).
    expect((await starte(einsatz, tag('2026-09-01'))).ok).toBe(true)
  })

  it('greift nicht für einen dritten Arbeitgeber', async () => {
    const einsatz = await einsatzMitVorbeschaeftigung('Fremdwerk AG', tag('2026-04-30'))
    expect((await starte(einsatz, tag('2026-09-01'))).ok).toBe(true)
  })

  it('lässt den Start zu, wenn das Vergleichsentgelt hinterlegt ist', async () => {
    const einsatz = await einsatzMitVorbeschaeftigung('Nordwerk Metall GmbH', tag('2026-04-30'))
    await prisma.assignment.update({
      where: { id: einsatz },
      data: { comparableWage: '21.40', comparableWageCurrency: 'EUR' },
    })
    expect((await starte(einsatz, tag('2026-09-01'))).ok).toBe(true)
  })
})

describe('P11: das Arbeitsverhältnis beim Verleiher erreicht den Übergang (SPEC 5.3.4, Q47)', () => {
  it('sperrt den Start eines Bewerbers', async () => {
    await prisma.candidate.update({
      where: { id: welt.kandidat },
      data: { employmentStatusWithSupplier: 'applicant', employedSince: null },
    })
    const einsatz = await legeEinsatzAn(welt, {
      nummer: 'E-1',
      status: 'planned',
      plannedStartDate: tag('2026-09-01'),
    })
    const ergebnis = await starte(einsatz, tag('2026-09-01'))
    expect(ergebnis.ok).toBe(false)
    expect(ergebnis.ok === false && ergebnis.error).toMatch(/Arbeitsverhältnis/)
  })

  it('sperrt den Start, wenn das Arbeitsverhältnis einen Tag zu spät beginnt', async () => {
    await prisma.candidate.update({
      where: { id: welt.kandidat },
      data: { employedSince: tag('2026-09-02') },
    })
    const einsatz = await legeEinsatzAn(welt, {
      nummer: 'E-1',
      status: 'planned',
      plannedStartDate: tag('2026-09-01'),
    })
    expect((await starte(einsatz, tag('2026-09-01'))).ok).toBe(false)
  })

  it('lässt den Start zu, wenn es **am** ersten Überlassungstag beginnt', async () => {
    await prisma.candidate.update({
      where: { id: welt.kandidat },
      data: { employedSince: tag('2026-09-01') },
    })
    const einsatz = await legeEinsatzAn(welt, {
      nummer: 'E-1',
      status: 'planned',
      plannedStartDate: tag('2026-09-01'),
    })
    expect((await starte(einsatz, tag('2026-09-01'))).ok).toBe(true)
  })
})

describe('P1 an der Verlängerung (SPEC 4.3.2, Q30)', () => {
  async function laufenderEinsatz(): Promise<string> {
    await legeTarifzuordnungAn(welt, {
      ebene: 'site',
      monate: 18,
      validFrom: tag('2025-01-01'),
      validTo: tag('2028-12-31'),
    })
    return legeEinsatzAn(welt, {
      nummer: 'E-1',
      status: 'active',
      plannedStartDate: tag('2026-01-15'),
      plannedEndDate: tag('2027-03-31'),
      actualStartDate: tag('2026-01-15'),
    })
  }

  it('sperrt die Wirksamkeit einer Verlängerung über das Fristende hinaus', async () => {
    const einsatz = await laufenderEinsatz()
    expect(
      (
        await requestExtension(disponent, {
          assignmentId: einsatz,
          newEndDate: tag('2027-09-30'),
          reason: 'Projekt läuft länger',
        })
      ).ok,
    ).toBe(true)

    const verlaengerung = await prisma.assignmentExtension.findFirstOrThrow()
    expect(
      (
        await transitionExtension(genehmiger, {
          extensionId: verlaengerung.id,
          transition: 'approve',
          rejectionReason: null,
        })
      ).ok,
    ).toBe(true)

    const wirksam = await transitionExtension(disponent, {
      extensionId: verlaengerung.id,
      transition: 'makeEffective',
      rejectionReason: null,
    })
    // Das Fristende ist der 14.07.2027; das neue Ende liegt danach.
    expect(wirksam.ok).toBe(false)
    expect(wirksam.ok === false && wirksam.error).toMatch(/maxDurationEndDate/)

    const zeile = await prisma.assignment.findFirstOrThrow({ where: { assignmentNumber: 'E-1' } })
    expect(zeile.plannedEndDate?.toISOString().slice(0, 10)).toBe('2027-03-31')
  })

  it('lässt eine Verlängerung innerhalb des Fristendes wirksam werden und schreibt den Stand fort', async () => {
    const einsatz = await laufenderEinsatz()
    await requestExtension(disponent, {
      assignmentId: einsatz,
      newEndDate: tag('2027-06-30'),
      reason: 'Projekt läuft länger',
    })
    const verlaengerung = await prisma.assignmentExtension.findFirstOrThrow()
    await transitionExtension(genehmiger, {
      extensionId: verlaengerung.id,
      transition: 'approve',
      rejectionReason: null,
    })
    const wirksam = await transitionExtension(disponent, {
      extensionId: verlaengerung.id,
      transition: 'makeEffective',
      rejectionReason: null,
    })
    expect(wirksam.ok).toBe(true)

    const zeile = await prisma.assignment.findFirstOrThrow({ where: { assignmentNumber: 'E-1' } })
    expect(zeile.plannedEndDate?.toISOString().slice(0, 10)).toBe('2027-06-30')
    // Das neue Ende ist Rechengrundlage: der Fristenstand wird mit ihm neu
    // abgeleitet (5.5.1 b).
    expect(zeile.maxDurationEndDate?.toISOString().slice(0, 10)).toBe('2027-07-14')
  })
})

describe('P3: die Equal-Pay-Fälligkeit erreicht den Übergang (SPEC 5.2, 4.3)', () => {
  async function fristenstandMitEqualPay(nummer: string) {
    const zeile = await prisma.assignment.findFirstOrThrow({ where: { assignmentNumber: nummer } })
    return zeile.equalPayDueDate?.toISOString().slice(0, 10) ?? null
  }

  it('schreibt equalPayDueDate an jeden Einsatz der Kette fort', async () => {
    await legeEinsatzAn(welt, {
      nummer: 'E-1',
      status: 'terminatedEarly',
      plannedStartDate: tag('2026-01-15'),
      actualStartDate: tag('2026-01-15'),
      actualEndDate: tag('2026-05-31'),
    })
    const zweiter = await legeEinsatzAn(welt, {
      nummer: 'E-2',
      status: 'planned',
      plannedStartDate: tag('2026-06-01'),
    })

    expect((await starte(zweiter, tag('2026-06-01'))).ok).toBe(true)
    // Kettenbeginn 15.01.2026, Regelfrist 9 Monate (5.2.2 Fall 2): das
    // Fristbudget sind 273 Tage bis zum 14.10., die Fälligkeit ist der 15.10.
    for (const nummer of ['E-1', 'E-2']) {
      expect(await fristenstandMitEqualPay(nummer)).toBe('2026-10-15')
    }
  })

  it('nimmt die tarifliche Frist der Verleiherseite, nicht die des Standorts', async () => {
    // 5.2.2: die Frist kommt von der Verleiherseite — anders als die Grenze in
    // 5.1.2. Eine Zuordnung des Standorts mit anderer Frist bleibt unbeachtet.
    await prisma.collectiveAgreementAssignment.updateMany({
      where: { appliesToType: 'supplier' },
      data: { equalPayDeadlineMonths: 6 },
    })
    await legeTarifzuordnungAn(welt, {
      ebene: 'site',
      monate: 18,
      equalPayMonate: 12,
      validFrom: tag('2025-01-01'),
    })
    const einsatz = await legeEinsatzAn(welt, {
      nummer: 'E-1',
      status: 'planned',
      plannedStartDate: tag('2026-01-15'),
    })

    expect((await starte(einsatz, tag('2026-01-15'))).ok).toBe(true)
    // 6 Monate ab dem 15.01.2026: Budget bis zum 14.07., Fälligkeit 15.07.
    expect(await fristenstandMitEqualPay('E-1')).toBe('2026-07-15')
  })

  it('begrenzt eine Frist über der Regelfrist ohne Zuschlagsschema auf neun Monate', async () => {
    // § 8 Abs. 4 Satz 2: die Verlängerung setzt die stufenweise Annäherung
    // voraus. Ohne Schema ist der Wert nicht verwendbar (5.2.2, Fall 5).
    await prisma.collectiveAgreementAssignment.updateMany({
      where: { appliesToType: 'supplier' },
      data: { equalPayDeadlineMonths: 12, industryPremiumScheme: null },
    })
    const einsatz = await legeEinsatzAn(welt, {
      nummer: 'E-1',
      status: 'planned',
      plannedStartDate: tag('2026-01-15'),
    })

    expect((await starte(einsatz, tag('2026-01-15'))).ok).toBe(true)
    expect(await fristenstandMitEqualPay('E-1')).toBe('2026-10-15')
  })

  it('lässt die tarifliche Frist mit Zuschlagsschema gelten', async () => {
    await prisma.collectiveAgreementAssignment.updateMany({
      where: { appliesToType: 'supplier' },
      data: { equalPayDeadlineMonths: 12, industryPremiumScheme: 'Beispielschema B1' },
    })
    const einsatz = await legeEinsatzAn(welt, {
      nummer: 'E-1',
      status: 'planned',
      plannedStartDate: tag('2026-01-15'),
    })

    expect((await starte(einsatz, tag('2026-01-15'))).ok).toBe(true)
    expect(await fristenstandMitEqualPay('E-1')).toBe('2027-01-15')
  })

  it('sperrt den Start ohne Verleihertarif und ohne Vergleichsentgelt (Q48)', async () => {
    // 5.2.2 Fall 1: ohne Tarifzuordnung der Verleiherseite gibt es keine
    // Abweichung vom Gleichstellungsgrundsatz — Equal Pay ab dem **ersten**
    // Überlassungstag. Zusammen mit fehlendem `comparableWage` ist das die
    // Sperre aus Q48.
    await entferneVerleiherzuordnungen()
    const einsatz = await legeEinsatzAn(welt, {
      nummer: 'E-1',
      status: 'planned',
      plannedStartDate: tag('2026-01-15'),
    })

    const ergebnis = await starte(einsatz, tag('2026-01-15'))
    expect(ergebnis.ok).toBe(false)

    const zeile = await prisma.assignment.findFirstOrThrow({ where: { assignmentNumber: 'E-1' } })
    expect(zeile.status).toBe('planned')
    // Eine Sperre schreibt nichts (4.0, Regel 5).
    expect(zeile.equalPayDueDate).toBeNull()
  })

  it('lässt denselben Start mit hinterlegtem Vergleichsentgelt zu', async () => {
    await entferneVerleiherzuordnungen()
    const einsatz = await legeEinsatzAn(welt, {
      nummer: 'E-1',
      status: 'planned',
      plannedStartDate: tag('2026-01-15'),
      vergleichsentgelt: '21.40',
    })

    expect((await starte(einsatz, tag('2026-01-15'))).ok).toBe(true)
    // Die Fälligkeit ist der erste Überlassungstag selbst.
    expect(await fristenstandMitEqualPay('E-1')).toBe('2026-01-15')
  })

  it('leitet die Fälligkeit mit der Verlängerung neu ab (Q32)', async () => {
    await legeTarifzuordnungAn(welt, {
      ebene: 'site',
      monate: 18,
      validFrom: tag('2025-01-01'),
      validTo: tag('2028-12-31'),
    })
    const einsatz = await legeEinsatzAn(welt, {
      nummer: 'E-1',
      status: 'active',
      plannedStartDate: tag('2026-01-15'),
      plannedEndDate: tag('2026-06-30'),
      actualStartDate: tag('2026-01-15'),
      vergleichsentgelt: '21.40',
    })

    await requestExtension(disponent, {
      assignmentId: einsatz,
      newEndDate: tag('2026-12-31'),
      reason: 'Projekt läuft länger',
    })
    const verlaengerung = await prisma.assignmentExtension.findFirstOrThrow()
    await transitionExtension(genehmiger, {
      extensionId: verlaengerung.id,
      transition: 'approve',
      rejectionReason: null,
    })
    expect(
      (
        await transitionExtension(disponent, {
          extensionId: verlaengerung.id,
          transition: 'makeEffective',
          rejectionReason: null,
        })
      ).ok,
    ).toBe(true)

    // Die Fälligkeit fällt in den verlängerten Zeitraum und wird mit ihm
    // fortgeschrieben (5.5.1 b).
    expect(await fristenstandMitEqualPay('E-1')).toBe('2026-10-15')
  })
})

describe('Die Kette hängt an der bestätigten Personenidentität (SPEC 5.0, Frage 18)', () => {
  it('zählt einen Einsatz ohne bestätigte Identität nicht mit', async () => {
    await legeTarifzuordnungAn(welt, {
      ebene: 'site',
      monate: 18,
      validFrom: tag('2025-01-01'),
      validTo: tag('2028-12-31'),
    })
    // Derselbe Kunde, dieselbe Person — aber ohne bestätigte Verknüpfung am
    // Einsatz. Dann gehört er nicht zur Kette.
    await legeEinsatzAn(welt, {
      nummer: 'E-1',
      status: 'completed',
      plannedStartDate: tag('2026-01-15'),
      actualStartDate: tag('2026-01-15'),
      actualEndDate: tag('2026-05-31'),
      mitPersonenidentitaet: false,
    })
    const zweiter = await legeEinsatzAn(welt, {
      nummer: 'E-2',
      status: 'planned',
      plannedStartDate: tag('2026-06-01'),
    })

    expect((await starte(zweiter, tag('2026-06-01'))).ok).toBe(true)
    // Die Kette beginnt erst mit dem zweiten Einsatz: ein Tag angerechnet,
    // Fristende 18 Monate ab dem 01.06.2026.
    expect(await fristenstand('E-2')).toEqual({ fristende: '2027-11-30', angerechnet: 1 })
    // Der erste Einsatz gehört nicht zur Kette und wird nicht fortgeschrieben.
    expect((await fristenstand('E-1')).fristende).toBeNull()
  })
})

describe('P8: Kennzeichnung und Konkretisierung am Übergang (SPEC 5.3.3)', () => {
  /** Eine rechtmäßige Lage: Tarifzuordnung und Vergleichsentgelt liegen vor. */
  async function grundlage(): Promise<void> {
    await legeTarifzuordnungAn(welt, {
      ebene: 'site',
      monate: 18,
      validFrom: tag('2025-01-01'),
      validTo: tag('2028-12-31'),
    })
  }

  it('lässt den Einsatzstart zu, wenn K1 bis K5 tragen (Q46)', async () => {
    await grundlage()
    const einsatz = await legeEinsatzAn(welt, {
      nummer: 'E-1',
      status: 'planned',
      plannedStartDate: tag('2026-01-15'),
      plannedEndDate: tag('2026-12-31'),
      vergleichsentgelt: '21.4000',
    })
    expect((await starte(einsatz, tag('2026-01-15'))).ok).toBe(true)
  })

  it('sperrt den Einsatzstart, wenn der Rahmenvertrag nicht mehr aktiv ist (K1)', async () => {
    await grundlage()
    const einsatz = await legeEinsatzAn(welt, {
      nummer: 'E-1',
      status: 'planned',
      plannedStartDate: tag('2026-01-15'),
      plannedEndDate: tag('2026-12-31'),
      vergleichsentgelt: '21.4000',
    })
    // Der Rahmenvertrag der Lieferantenseite wird gekündigt — die Kennzeichnung
    // trägt nicht mehr, und 5.3.3 Nr. 3 prüft K1 am Start **erneut**.
    await prisma.masterAgreement.updateMany({
      where: { agreementNumber: 'RV-L-1' },
      data: { status: 'terminated' },
    })

    const ergebnis = await starte(einsatz, tag('2026-01-15'))
    expect(ergebnis.ok).toBe(false)
    const zeile = await prisma.assignment.findFirstOrThrow({ where: { assignmentNumber: 'E-1' } })
    expect(zeile.status).toBe('planned')
  })

  it('sperrt den Einsatzstart, wenn die Konkretisierung erst nach dem ersten Tag vorlag (K5)', async () => {
    await grundlage()
    // Der Einsatz entsteht am 05.02.2026, der erste Überlassungstag ist der
    // 15.01.2026: die Konkretisierung lag bei Beginn der Überlassung nicht vor
    // (§ 1 Abs. 1 Sätze 5 und 6 AÜG). `createdAt` ist der Tag des Übergangs
    // nach `planned` — 4.3.1 kennt keinen anderen Weg dorthin.
    const einsatz = await legeEinsatzAn(welt, {
      nummer: 'E-1',
      status: 'planned',
      plannedStartDate: tag('2026-01-15'),
      plannedEndDate: tag('2026-12-31'),
      vergleichsentgelt: '21.4000',
      angelegtAm: tag('2026-02-05'),
    })

    const ergebnis = await starte(einsatz, tag('2026-01-15'))
    expect(ergebnis.ok).toBe(false)
    const zeile = await prisma.assignment.findFirstOrThrow({ where: { assignmentNumber: 'E-1' } })
    expect(zeile.status).toBe('planned')
    // Und nichts ist geschrieben: eine Sperre schreibt keine abgeleiteten Felder.
    expect(zeile.actualStartDate).toBeNull()
    expect(zeile.maxDurationEndDate).toBeNull()
  })

  it('sperrt den Einsatzstart, wenn die Tätigkeitsbeschreibung nur der Titel der Anfrage ist (K3)', async () => {
    await grundlage()
    const einsatz = await legeEinsatzAn(welt, {
      nummer: 'E-1',
      status: 'planned',
      plannedStartDate: tag('2026-01-15'),
      plannedEndDate: tag('2026-12-31'),
      vergleichsentgelt: '21.4000',
    })
    // Eine Bedarfsanfrage, deren Titel die Tätigkeitsbeschreibung des Einsatzes
    // ist: damit ist die Beschreibung ein Verweis und keine eigenständige
    // Konkretisierung (5.3.3, K3).
    const anfrage = await prisma.demandRequest.create({
      data: {
        tenantId: welt.kundenMandant,
        requestNumber: 'BA-K3',
        customerId: welt.kunde,
        siteId: welt.standort,
        costCenterId: welt.kostenstelle,
        title: 'Montage von Baugruppen an der Linie 2',
        activityDescription: 'Montage von Baugruppen an der Linie 2, Dreischicht',
        startDate: tag('2026-01-15'),
        weeklyHours: '35.00',
        headcount: 1,
        status: 'approved',
        requestedById: welt.genehmiger,
      },
    })
    await prisma.assignment.update({
      where: { id: einsatz },
      data: { demandRequestId: anfrage.id },
    })

    expect((await starte(einsatz, tag('2026-01-15'))).ok).toBe(false)
  })
})
