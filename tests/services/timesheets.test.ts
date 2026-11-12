/**
 * Die Zeiterfassung gegen eine echte Datenbank — SPEC **3.8** und **4.4**.
 *
 * Was hier geprüft wird und **nirgends sonst**:
 *
 *  - dass die Freigabeschritte aus der **Konfiguration des Kunden** entstehen
 *    (3.1) und das Rollenkürzel **kopiert** wird — eine Änderung der
 *    Konfiguration darf einen laufenden Zettel nicht umhängen,
 *  - dass die **Erfassungsform** über die Ableitbarkeit entscheidet: aus einem
 *    Abschnitt folgt der Nachtzuschlag, aus einer Tagessumme nicht,
 *  - dass die Betreiberstufe **hinzutritt** und die Kundenstufe nicht ersetzt,
 *  - dass **Q36** bei fehlendem Vergleichsentgelt sperrt und **Q35** trotz
 *    Zeiten nach dem Fristende nicht (5.5.5),
 *  - dass eine Sperre **nichts schreibt** (4.0, Regel 5) und jeder Schreibweg
 *    seinen Audit-Eintrag trägt (3.12).
 *
 * Die Übergangsmenge selbst ist in `lib/status/timesheet.test.ts` ohne
 * Datenbank geprüft, die Zuschlagsableitung in
 * `lib/timetracking/premiums.test.ts`. Alle Daten sind synthetisch
 * (CLAUDE.md, Regel 3).
 */

import { beforeEach, describe, expect, it } from 'vitest'
import { loadIdentity, type LoadedIdentity } from '../../lib/identity/loadSubject'
import { prisma } from '../../lib/prisma'
import {
  addTimeEntry,
  createCorrectionTimesheet,
  createTimesheet,
  decideStage,
  loadTimesheets,
  removeTimeEntry,
  reworkTimesheet,
  submitTimesheet,
} from '../../lib/services/timesheets'
import {
  baueWelt,
  legeAbrechnungsperiodeAn,
  legeEinsatzAn,
  legeStufenfolgeAn,
  legeVergleichsentgeltAn,
  legeZuschlagsartAn,
  leereDatenbank,
  tag,
  type Welt,
} from './fixture'

/** Der Zettelzeitraum ist der Prüfzeitraum (5.0) — fest gesetzt. */
const PERIODE_VON = tag('2026-10-01')
const PERIODE_BIS = tag('2026-10-31')
const HEUTE = tag('2026-11-05')

let welt: Welt
let administrator: LoadedIdentity
let disponent: LoadedIdentity
let bedarfstraeger: LoadedIdentity
let genehmiger: LoadedIdentity
let lieferantDisponent: LoadedIdentity
let einsatz: string
let periode: string

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
  bedarfstraeger = await identitaet(welt.bedarfstraeger)
  genehmiger = await identitaet(welt.genehmiger)
  lieferantDisponent = await identitaet(welt.lieferantDisponent)

  periode = await legeAbrechnungsperiodeAn(welt, {
    nummer: '2026-10',
    von: PERIODE_VON,
    bis: PERIODE_BIS,
  })
  einsatz = await legeEinsatzAn(welt, {
    nummer: 'E-2026-0001',
    status: 'active',
    plannedStartDate: tag('2026-09-01'),
    actualStartDate: tag('2026-09-01'),
    vergleichsentgelt: '18.5000',
  })
})

function ok(ergebnis: { ok: boolean; message?: string; error?: string; specReference?: string }) {
  if (!ergebnis.ok) {
    throw new Error(`${ergebnis.error} (${ergebnis.specReference ?? '-'})`)
  }
  return ergebnis.message ?? ''
}

async function zettelAnlegen(): Promise<string> {
  ok(await createTimesheet(disponent, { assignmentId: einsatz, billingPeriodId: periode }, HEUTE))
  const zettel = await prisma.timesheet.findFirstOrThrow()
  return zettel.id
}

async function status(id: string): Promise<string> {
  return (await prisma.timesheet.findUniqueOrThrow({ where: { id } })).status
}

describe('Stundenzettel anlegen (4.4, — → recorded)', () => {
  it('legt ihn mit dem Schnitt aus Periode und Einsatz an', async () => {
    const meldung = ok(
      await createTimesheet(disponent, { assignmentId: einsatz, billingPeriodId: periode }, HEUTE),
    )
    expect(meldung).toContain('2026-10-01 bis 2026-10-31')
    const zettel = await prisma.timesheet.findFirstOrThrow()
    expect(zettel.status).toBe('recorded')
    expect(zettel.recordedById).toBe(welt.disponent)
    // Der Zettel gehört dem **Betreibermandanten** (3.8).
    expect(zettel.tenantId).toBe(welt.betreiberMandant)
  })

  it('schneidet den Zeitraum am Einsatzbeginn ab, wenn der Einsatz mitten in der Periode beginnt', async () => {
    const spaeter = await legeEinsatzAn(welt, {
      nummer: 'E-2026-0002',
      status: 'active',
      plannedStartDate: tag('2026-10-15'),
      actualStartDate: tag('2026-10-15'),
      vergleichsentgelt: '18.5000',
    })
    const meldung = ok(
      await createTimesheet(disponent, { assignmentId: spaeter, billingPeriodId: periode }, HEUTE),
    )
    expect(meldung).toContain('2026-10-15 bis 2026-10-31')
  })

  it('verweigert ihn, wenn der Einsatz nicht in die Periode fällt', async () => {
    const spaeter = await legeEinsatzAn(welt, {
      nummer: 'E-2026-0003',
      status: 'active',
      plannedStartDate: tag('2026-12-01'),
      actualStartDate: tag('2026-12-01'),
    })
    const ergebnis = await createTimesheet(
      disponent,
      { assignmentId: spaeter, billingPeriodId: periode },
      HEUTE,
    )
    expect(ergebnis.ok).toBe(false)
    expect(await prisma.timesheet.count()).toBe(0)
  })

  it('verweigert ihn in einer geschlossenen Periode (3.9, 4.4)', async () => {
    const geschlossen = await legeAbrechnungsperiodeAn(welt, {
      nummer: '2026-09',
      von: tag('2026-09-01'),
      bis: tag('2026-09-30'),
      status: 'closed',
    })
    const ergebnis = await createTimesheet(
      disponent,
      { assignmentId: einsatz, billingPeriodId: geschlossen },
      HEUTE,
    )
    expect(ergebnis.ok).toBe(false)
    if (!ergebnis.ok) expect(ergebnis.error).toContain('Abrechnungsperiode')
    expect(await prisma.timesheet.count()).toBe(0)
  })

  it('verweigert den zweiten Zettel zu Einsatz und Periode (3.13)', async () => {
    await zettelAnlegen()
    const ergebnis = await createTimesheet(
      disponent,
      { assignmentId: einsatz, billingPeriodId: periode },
      HEUTE,
    )
    expect(ergebnis.ok).toBe(false)
    if (!ergebnis.ok) expect(ergebnis.error).toContain('genau einer')
    expect(await prisma.timesheet.count()).toBe(1)
  })

  it('trägt den abgelehnten Versuch ins Protokoll (3.12) — mit der fachlichen Kennung', async () => {
    await zettelAnlegen()
    await createTimesheet(disponent, { assignmentId: einsatz, billingPeriodId: periode }, HEUTE)
    const eintraege = await prisma.auditEntry.findMany({
      where: { objectType: 'timesheet', result: 'denied' },
    })
    expect(eintraege).toHaveLength(1)
    expect(eintraege[0]?.objectRef).toMatch(/^SZ-2026-10-/)
  })
})

describe('Zeitpositionen: zwei Formen, eine Tabelle (3.8, Frage 16)', () => {
  let zettel: string

  beforeEach(async () => {
    zettel = await zettelAnlegen()
  })

  it('nimmt eine Tagessumme an', async () => {
    const meldung = ok(
      await addTimeEntry(
        disponent,
        {
          timesheetId: zettel,
          workDate: tag('2026-10-05'),
          startMinute: null,
          endMinute: null,
          breakMinutes: null,
          hours: 8,
          note: null,
          declaredPremiums: [],
        },
        HEUTE,
      ),
    )
    expect(meldung).toContain('Tagessumme')
    const position = await prisma.timeEntry.findFirstOrThrow()
    expect(Number(position.hours)).toBe(8)
  })

  it('rechnet die Stunden eines Abschnitts selbst — die Eingabe ist die Uhrzeit', async () => {
    ok(
      await addTimeEntry(
        disponent,
        {
          timesheetId: zettel,
          workDate: tag('2026-10-06'),
          startMinute: 8 * 60,
          endMinute: 16 * 60 + 30,
          breakMinutes: 30,
          // Absichtlich falsch: der Dienst rechnet und übernimmt nicht.
          hours: 99,
          note: null,
          declaredPremiums: [],
        },
        HEUTE,
      ),
    )
    const position = await prisma.timeEntry.findFirstOrThrow()
    expect(Number(position.hours)).toBe(8)
  })

  it('nimmt einen Abschnitt über Mitternacht an — er gehört dem Tag seines Beginns', async () => {
    ok(
      await addTimeEntry(
        disponent,
        {
          timesheetId: zettel,
          workDate: tag('2026-10-07'),
          startMinute: 22 * 60,
          endMinute: 6 * 60,
          breakMinutes: 30,
          hours: null,
          note: null,
          declaredPremiums: [],
        },
        HEUTE,
      ),
    )
    const position = await prisma.timeEntry.findFirstOrThrow()
    expect(Number(position.hours)).toBe(7.5)
    expect(position.workDate.toISOString().slice(0, 10)).toBe('2026-10-07')
  })

  it('verweigert zwei überlappende Abschnitte am selben Tag (Invariante 4)', async () => {
    ok(
      await addTimeEntry(
        disponent,
        {
          timesheetId: zettel,
          workDate: tag('2026-10-08'),
          startMinute: 6 * 60,
          endMinute: 12 * 60,
          breakMinutes: null,
          hours: null,
          note: null,
          declaredPremiums: [],
        },
        HEUTE,
      ),
    )
    const ergebnis = await addTimeEntry(
      disponent,
      {
        timesheetId: zettel,
        workDate: tag('2026-10-08'),
        startMinute: 10 * 60,
        endMinute: 14 * 60,
        breakMinutes: null,
        hours: null,
        note: null,
        declaredPremiums: [],
      },
      HEUTE,
    )
    expect(ergebnis.ok).toBe(false)
    if (!ergebnis.ok) expect(ergebnis.error).toContain('überlappen')
    expect(await prisma.timeEntry.count()).toBe(1)
  })

  it('verweigert eine Position ohne Stunden — Abwesenheit wird nicht erfasst (Frage 21)', async () => {
    const ergebnis = await addTimeEntry(
      disponent,
      {
        timesheetId: zettel,
        workDate: tag('2026-10-09'),
        startMinute: null,
        endMinute: null,
        breakMinutes: null,
        hours: 0,
        note: 'krank',
        declaredPremiums: [],
      },
      HEUTE,
    )
    expect(ergebnis.ok).toBe(false)
    if (!ergebnis.ok) expect(ergebnis.error).toContain('produktive')
  })

  it('entfernt eine Position vor der Einreichung ([44])', async () => {
    ok(
      await addTimeEntry(
        disponent,
        {
          timesheetId: zettel,
          workDate: tag('2026-10-05'),
          startMinute: null,
          endMinute: null,
          breakMinutes: null,
          hours: 8,
          note: null,
          declaredPremiums: [],
        },
        HEUTE,
      ),
    )
    const position = await prisma.timeEntry.findFirstOrThrow()
    ok(await removeTimeEntry(administrator, { timeEntryId: position.id }, HEUTE))
    expect(await prisma.timeEntry.count()).toBe(0)
  })
})

describe('Zuschläge: abgeleitet oder angegeben (3.8, Frage 16)', () => {
  let zettel: string
  let nacht: string

  beforeEach(async () => {
    zettel = await zettelAnlegen()
    nacht = await legeZuschlagsartAn(welt, {
      code: 'NACHT',
      grundlage: 'timeOfDay',
      anlass: 'night',
      vonMinute: 23 * 60,
      bisMinute: 6 * 60,
    })
  })

  const position = (teile: {
    readonly startMinute: number | null
    readonly endMinute: number | null
    readonly hours: number | null
    readonly declaredPremiums?: readonly { readonly premiumTypeId: string; readonly hours: number }[]
  }) =>
    addTimeEntry(
      disponent,
      {
        timesheetId: zettel,
        workDate: tag('2026-10-12'),
        startMinute: teile.startMinute,
        endMinute: teile.endMinute,
        breakMinutes: null,
        hours: teile.hours,
        note: null,
        declaredPremiums: teile.declaredPremiums ?? [],
      },
      HEUTE,
    )

  it('leitet den Nachtzuschlag aus einem Abschnitt ab', async () => {
    ok(await position({ startMinute: 22 * 60, endMinute: 6 * 60, hours: null }))
    const zuschlag = await prisma.timeEntryPremium.findFirstOrThrow()
    expect(zuschlag.premiumTypeId).toBe(nacht)
    expect(Number(zuschlag.hours)).toBe(7)
    expect(zuschlag.origin).toBe('derived')
  })

  it('leitet ihn aus einer Tagessumme **nicht** ab — sie trägt keine Uhrzeit', async () => {
    const meldung = ok(await position({ startMinute: null, endMinute: null, hours: 8 }))
    expect(await prisma.timeEntryPremium.count()).toBe(0)
    expect(meldung).toContain('kein Zuschlag nach Uhrzeit')
  })

  it('übernimmt ihn an einer Tagessumme als Angabe', async () => {
    ok(
      await position({
        startMinute: null,
        endMinute: null,
        hours: 8,
        declaredPremiums: [{ premiumTypeId: nacht, hours: 5 }],
      }),
    )
    const zuschlag = await prisma.timeEntryPremium.findFirstOrThrow()
    expect(Number(zuschlag.hours)).toBe(5)
    expect(zuschlag.origin).toBe('declared')
  })

  it('lässt die Angabe stehen, auch wenn dieselbe Art ableitbar wäre', async () => {
    ok(
      await position({
        startMinute: 22 * 60,
        endMinute: 6 * 60,
        hours: null,
        declaredPremiums: [{ premiumTypeId: nacht, hours: 4 }],
      }),
    )
    const zuschlag = await prisma.timeEntryPremium.findFirstOrThrow()
    expect(Number(zuschlag.hours)).toBe(4)
    expect(zuschlag.origin).toBe('declared')
  })
})

describe('Einreichen und die Stufenfolge (4.4, 3.1)', () => {
  let zettel: string

  beforeEach(async () => {
    zettel = await zettelAnlegen()
    ok(
      await addTimeEntry(
        disponent,
        {
          timesheetId: zettel,
          workDate: tag('2026-10-05'),
          startMinute: null,
          endMinute: null,
          breakMinutes: null,
          hours: 8,
          note: null,
          declaredPremiums: [],
        },
        HEUTE,
      ),
    )
  })

  it('erzeugt die **Vorbelegung** aus 4.4, wenn der Kunde keine Folge pflegt: KB, dann MD', async () => {
    ok(await submitTimesheet(disponent, { timesheetId: zettel }, HEUTE))
    const stufen = await prisma.timesheetApproval.findMany({ orderBy: { level: 'asc' } })
    expect(stufen.map((stufe) => stufe.assignedRoleCode)).toEqual([
      'demandOwner',
      'operatorCoordinator',
    ])
    expect(await status(zettel)).toBe('inApproval')
  })

  it('erzeugt die **konfigurierte** Folge, wenn der Kunde eine pflegt (3.1)', async () => {
    await legeStufenfolgeAn(welt, ['approver', 'procurementController', 'operatorAdmin'])
    ok(await submitTimesheet(disponent, { timesheetId: zettel }, HEUTE))
    const stufen = await prisma.timesheetApproval.findMany({ orderBy: { level: 'asc' } })
    expect(stufen.map((stufe) => stufe.assignedRoleCode)).toEqual([
      'approver',
      'procurementController',
      'operatorAdmin',
    ])
  })

  it('hängt einen laufenden Zettel nicht um, wenn die Konfiguration sich ändert', async () => {
    ok(await submitTimesheet(disponent, { timesheetId: zettel }, HEUTE))
    await legeStufenfolgeAn(welt, ['approver'])
    const stufen = await prisma.timesheetApproval.findMany({ orderBy: { level: 'asc' } })
    // Kopiert, nicht verwiesen (3.8): die alte Folge steht weiter am Zettel.
    expect(stufen.map((stufe) => stufe.assignedRoleCode)).toEqual([
      'demandOwner',
      'operatorCoordinator',
    ])
  })

  it('verweigert eine Folge **ohne** Kundenstufe — der Betreiber ersetzt nichts (2.1)', async () => {
    await legeStufenfolgeAn(welt, ['operatorCoordinator', 'operatorAdmin'])
    const ergebnis = await submitTimesheet(disponent, { timesheetId: zettel }, HEUTE)
    expect(ergebnis.ok).toBe(false)
    if (!ergebnis.ok) expect(ergebnis.error).toContain('Kundenstufe')
    // Nichts geschrieben: der Zettel bleibt erfasst, es gibt keine Stufe.
    expect(await status(zettel)).toBe('recorded')
    expect(await prisma.timesheetApproval.count()).toBe(0)
  })

  it('verweigert einen leeren Zettel und schreibt nichts', async () => {
    const leer = await legeEinsatzAn(welt, {
      nummer: 'E-2026-0009',
      status: 'active',
      plannedStartDate: tag('2026-09-01'),
      actualStartDate: tag('2026-09-01'),
    })
    ok(await createTimesheet(disponent, { assignmentId: leer, billingPeriodId: periode }, HEUTE))
    const zweiter = await prisma.timesheet.findFirstOrThrow({ where: { assignmentId: leer } })
    const ergebnis = await submitTimesheet(disponent, { timesheetId: zweiter.id }, HEUTE)
    expect(ergebnis.ok).toBe(false)
    expect(await status(zweiter.id)).toBe('recorded')
  })

  it('meldet Q33, wenn Zeiten nach dem Fristende liegen (P1, Warnung)', async () => {
    await prisma.assignment.update({
      where: { id: einsatz },
      data: { maxDurationEndDate: tag('2026-10-03') },
    })
    const meldung = ok(await submitTimesheet(disponent, { timesheetId: zettel }, HEUTE))
    expect(meldung).toContain('P1')
    expect(meldung).toContain('nach** dem Fristende')
    // Eine Warnung sperrt nicht (5.5).
    expect(await status(zettel)).toBe('inApproval')
  })
})

describe('Freigabe entscheiden (4.4, inApproval)', () => {
  let zettel: string

  beforeEach(async () => {
    zettel = await zettelAnlegen()
    ok(
      await addTimeEntry(
        disponent,
        {
          timesheetId: zettel,
          workDate: tag('2026-10-05'),
          startMinute: null,
          endMinute: null,
          breakMinutes: null,
          hours: 8,
          note: null,
          declaredPremiums: [],
        },
        HEUTE,
      ),
    )
    ok(await submitTimesheet(disponent, { timesheetId: zettel }, HEUTE))
  })

  const entscheiden = (
    wer: LoadedIdentity,
    decision: 'approved' | 'rejected' = 'approved',
    grund: string | null = null,
  ) =>
    decideStage(
      wer,
      { timesheetId: zettel, decision, rejectionReason: grund, comment: null },
      HEUTE,
    )

  it('die erste Stufe genehmigt, ohne den Status zu wechseln', async () => {
    const meldung = ok(await entscheiden(bedarfstraeger))
    expect(meldung).toContain('Stufe 1')
    expect(await status(zettel)).toBe('inApproval')
  })

  it('die zweite Stufe führt nach `approved` — und nicht die erste', async () => {
    ok(await entscheiden(bedarfstraeger))
    // Der Disponent hat den Zettel erfasst **und** eingereicht; das
    // Vier-Augen-Prinzip schließt ihn von der Betreiberstufe aus (2.4, Regel
    // 5). Die Stufe fällt deshalb an einen zweiten MD-Benutzer.
    const zweiterDisponent = await identitaet(welt.zweiterDisponent)
    const meldung = ok(await entscheiden(zweiterDisponent))
    expect(meldung).toContain('genehmigen')
    expect(await status(zettel)).toBe('approved')
    const zettelsatz = await prisma.timesheet.findUniqueOrThrow({ where: { id: zettel } })
    expect(zettelsatz.approvedById).toBe(welt.zweiterDisponent)
  })

  it('verweigert die Stufe dem, der erfasst und eingereicht hat (2.4, Regel 5)', async () => {
    ok(await entscheiden(bedarfstraeger))
    const ergebnis = await entscheiden(disponent)
    expect(ergebnis.ok).toBe(false)
    expect(await status(zettel)).toBe('inApproval')
  })

  it('verweigert die Stufe auch dem, der sie nur **eingereicht** hat', async () => {
    // Erfasser und Einreicher sind hier **verschiedene** Personen: erfasst hat
    // `disponent`, eingereicht `zweiterDisponent`. Das Vier-Augen-Prinzip
    // schließt beide aus (2.4, Regel 5) — ohne diesen Fall bliebe eine Prüfung
    // allein auf den Erfasser unentdeckt.
    const zweiterDisponent = await identitaet(welt.zweiterDisponent)
    const weiterer = await legeEinsatzAn(welt, {
      nummer: 'E-2026-0007',
      status: 'active',
      plannedStartDate: tag('2026-09-01'),
      actualStartDate: tag('2026-09-01'),
      vergleichsentgelt: '18.5000',
    })
    ok(await createTimesheet(disponent, { assignmentId: weiterer, billingPeriodId: periode }, HEUTE))
    const zweiterZettel = await prisma.timesheet.findFirstOrThrow({
      where: { assignmentId: weiterer },
    })
    ok(
      await addTimeEntry(
        disponent,
        {
          timesheetId: zweiterZettel.id,
          workDate: tag('2026-10-06'),
          startMinute: null,
          endMinute: null,
          breakMinutes: null,
          hours: 8,
          note: null,
          declaredPremiums: [],
        },
        HEUTE,
      ),
    )
    ok(await submitTimesheet(zweiterDisponent, { timesheetId: zweiterZettel.id }, HEUTE))
    ok(
      await decideStage(
        bedarfstraeger,
        {
          timesheetId: zweiterZettel.id,
          decision: 'approved',
          rejectionReason: null,
          comment: null,
        },
        HEUTE,
      ),
    )

    const ergebnis = await decideStage(
      zweiterDisponent,
      { timesheetId: zweiterZettel.id, decision: 'approved', rejectionReason: null, comment: null },
      HEUTE,
    )
    expect(ergebnis.ok).toBe(false)
    if (!ergebnis.ok) expect(ergebnis.error).toContain('Vier-Augen')
    expect(await status(zweiterZettel.id)).toBe('inApproval')
  })

  it('bietet dem Erfasser die Freigabe **nicht** an — keine Eingabe heilt das', async () => {
    // Die Zelle des `MD` trägt in 2.2 ein `S` ohne Fußnote; ohne diesen Filter
    // würde die Oberfläche dem Erfasser einen Knopf anbieten, den die
    // Vorbedingung sicher abweist (2.4, Regel 5).
    const sichtbar = await loadTimesheets(disponent, HEUTE)
    const zettelsatz = sichtbar.find((eintrag) => eintrag.id === zettel)
    expect(zettelsatz?.availableTransitions.map((uebergang) => uebergang.name)).toEqual([])
  })

  it('bietet sie der Rolle der offenen Stufe an', async () => {
    const sichtbar = await loadTimesheets(bedarfstraeger, HEUTE)
    const zettelsatz = sichtbar.find((eintrag) => eintrag.id === zettel)
    // Alle drei Wege aus `inApproval`: welcher greift, entscheidet die Lage
    // und nicht die Oberfläche (4.4) — `approve` nur als letzte Stufe.
    expect(zettelsatz?.availableTransitions.map((uebergang) => uebergang.name).sort()).toEqual([
      'approve',
      'approveStage',
      'reject',
    ])
  })

  it('bietet sie einer Kundenrolle **ohne** eigene Stufe nicht an', async () => {
    const sichtbar = await loadTimesheets(genehmiger, HEUTE)
    const zettelsatz = sichtbar.find((eintrag) => eintrag.id === zettel)
    expect(zettelsatz?.availableTransitions.map((uebergang) => uebergang.name)).toEqual([])
  })

  it('verweigert die Stufe einer Rolle, der sie nicht zugewiesen ist', async () => {
    // Stufe 1 trägt `demandOwner`; der Genehmiger ist eine andere Rolle.
    const ergebnis = await entscheiden(genehmiger)
    expect(ergebnis.ok).toBe(false)
    expect(await prisma.timesheetApproval.count({ where: { decision: null } })).toBe(2)
  })

  it('lehnt mit Begründung ab und lässt die offenen Stufen entfallen', async () => {
    ok(await entscheiden(bedarfstraeger, 'rejected', 'Freitag fehlt'))
    expect(await status(zettel)).toBe('rejected')
    const zettelsatz = await prisma.timesheet.findUniqueOrThrow({ where: { id: zettel } })
    expect(zettelsatz.rejectionReason).toBe('Freitag fehlt')
  })

  it('verweigert die Ablehnung ohne Begründung', async () => {
    const ergebnis = await entscheiden(bedarfstraeger, 'rejected', null)
    expect(ergebnis.ok).toBe(false)
    expect(await status(zettel)).toBe('inApproval')
  })

  it('verwirft die Stufen beim Nacharbeiten und erzeugt sie beim Einreichen neu', async () => {
    ok(await entscheiden(bedarfstraeger, 'rejected', 'Freitag fehlt'))
    ok(await reworkTimesheet(disponent, { timesheetId: zettel }, HEUTE))
    expect(await status(zettel)).toBe('recorded')
    expect(await prisma.timesheetApproval.count()).toBe(0)
    ok(await submitTimesheet(disponent, { timesheetId: zettel }, HEUTE))
    expect(await prisma.timesheetApproval.count()).toBe(2)
    expect(await prisma.timesheetApproval.count({ where: { decision: null } })).toBe(2)
  })
})

describe('Q36 sperrt, Q35 nicht (4.7, 5.5.5)', () => {
  let zettel: string

  async function bisZurLetztenStufe(): Promise<void> {
    zettel = await zettelAnlegen()
    ok(
      await addTimeEntry(
        disponent,
        {
          timesheetId: zettel,
          workDate: tag('2026-10-05'),
          startMinute: null,
          endMinute: null,
          breakMinutes: null,
          hours: 8,
          note: null,
          declaredPremiums: [],
        },
        HEUTE,
      ),
    )
    ok(await submitTimesheet(disponent, { timesheetId: zettel }, HEUTE))
    ok(
      await decideStage(
        bedarfstraeger,
        { timesheetId: zettel, decision: 'approved', rejectionReason: null, comment: null },
        HEUTE,
      ),
    )
  }

  it('sperrt die Genehmigung, wenn die Equal-Pay-Fälligkeit erreicht ist und kein Vergleichsentgelt steht', async () => {
    await prisma.assignment.update({
      where: { id: einsatz },
      data: { equalPayDueDate: tag('2026-10-10'), comparableWage: null },
    })
    await bisZurLetztenStufe()
    const zweiterDisponent = await identitaet(welt.zweiterDisponent)
    const ergebnis = await decideStage(
      zweiterDisponent,
      { timesheetId: zettel, decision: 'approved', rejectionReason: null, comment: null },
      HEUTE,
    )
    expect(ergebnis.ok).toBe(false)
    if (!ergebnis.ok) expect(ergebnis.error).toContain('P4')
    // Eine Sperre schreibt nichts (4.0, Regel 5): der Zettel bleibt in Prüfung,
    // und die letzte Stufe bleibt offen.
    expect(await status(zettel)).toBe('inApproval')
    expect(await prisma.timesheetApproval.count({ where: { decision: null } })).toBe(1)
  })

  it('trägt die Sperre als `blocked` mit `ruleRef` ins Protokoll (3.12)', async () => {
    await prisma.assignment.update({
      where: { id: einsatz },
      data: { equalPayDueDate: tag('2026-10-10'), comparableWage: null },
    })
    await bisZurLetztenStufe()
    const zweiterDisponent = await identitaet(welt.zweiterDisponent)
    await decideStage(
      zweiterDisponent,
      { timesheetId: zettel, decision: 'approved', rejectionReason: null, comment: null },
      HEUTE,
    )
    const eintrag = await prisma.auditEntry.findFirstOrThrow({
      where: { objectType: 'timesheet', result: 'blocked' },
    })
    expect(eintrag.ruleRef).toBe('P4')
  })

  it('genehmigt trotz Zeiten nach dem Fristende — P1 sperrt hier nicht (Q35, 5.5.5)', async () => {
    await prisma.assignment.update({
      where: { id: einsatz },
      data: { maxDurationEndDate: tag('2026-10-03') },
    })
    await bisZurLetztenStufe()
    const zweiterDisponent = await identitaet(welt.zweiterDisponent)
    const meldung = ok(
      await decideStage(
        zweiterDisponent,
        { timesheetId: zettel, decision: 'approved', rejectionReason: null, comment: null },
        HEUTE,
      ),
    )
    expect(await status(zettel)).toBe('approved')
    expect(meldung).toContain('Pflicht-Eskalation')
  })

  it('sperrt, wenn der **Eintrag am Standort** fehlt — auch mit Wert am Einsatz (5.2.4)', async () => {
    // Q36 sperrt bei „kein **verwendbarer** Vergleichsentgelt-Eintrag"
    // (5.5.5), und verwendbar heißt nach 5.2.4 Schritt 2: ein eindeutiger
    // Eintrag **am Standort** zur Tätigkeit. Der Wert am Einsatz allein genügt
    // nicht — die frühere, mildere Lesart des Dienstes hätte hier genehmigt.
    await prisma.assignment.update({
      where: { id: einsatz },
      data: { equalPayDueDate: tag('2026-10-10'), comparableWage: '18.5000' },
    })
    await bisZurLetztenStufe()
    const zweiter = await identitaet(welt.zweiterDisponent)
    const ergebnis = await decideStage(
      zweiter,
      { timesheetId: zettel, decision: 'approved', rejectionReason: null, comment: null },
      HEUTE,
    )
    expect(ergebnis.ok).toBe(false)
    expect(await status(zettel)).toBe('inApproval')
  })

  it('genehmigt mit gültigem Eintrag am Standort (5.2.4, Schritt 2)', async () => {
    await prisma.assignment.update({
      where: { id: einsatz },
      data: { equalPayDueDate: tag('2026-10-10'), comparableWage: '19.4200' },
    })
    await legeVergleichsentgeltAn(welt, { betrag: '19.4200' })
    await bisZurLetztenStufe()
    const zweiter = await identitaet(welt.zweiterDisponent)
    ok(
      await decideStage(
        zweiter,
        { timesheetId: zettel, decision: 'approved', rejectionReason: null, comment: null },
        HEUTE,
      ),
    )
    expect(await status(zettel)).toBe('approved')
  })

  it('genehmigt bei einer **Schätzung** — verwendbar, aber kein Nachweis (3.3)', async () => {
    await prisma.assignment.update({
      where: { id: einsatz },
      data: { equalPayDueDate: tag('2026-10-10'), comparableWage: '19.4200' },
    })
    await legeVergleichsentgeltAn(welt, { betrag: '19.4200', quelle: 'estimate' })
    await bisZurLetztenStufe()
    const zweiter = await identitaet(welt.zweiterDisponent)
    ok(
      await decideStage(
        zweiter,
        { timesheetId: zettel, decision: 'approved', rejectionReason: null, comment: null },
        HEUTE,
      ),
    )
    expect(await status(zettel)).toBe('approved')
  })

  it('sperrt bei **zwei** gültigen Einträgen — Eindeutigkeit aus 3.3 verletzt (5.2.4)', async () => {
    // „Mehr als ein gültiger Eintrag ist kein Eintrag": wer einen von zwei
    // widersprechenden Entgeltwerten wählt, trifft eine Entgeltentscheidung.
    await prisma.assignment.update({
      where: { id: einsatz },
      data: { equalPayDueDate: tag('2026-10-10'), comparableWage: '19.4200' },
    })
    await legeVergleichsentgeltAn(welt, { betrag: '19.4200' })
    await legeVergleichsentgeltAn(welt, { betrag: '20.1000' })
    await bisZurLetztenStufe()
    const zweiter = await identitaet(welt.zweiterDisponent)
    const ergebnis = await decideStage(
      zweiter,
      { timesheetId: zettel, decision: 'approved', rejectionReason: null, comment: null },
      HEUTE,
    )
    expect(ergebnis.ok).toBe(false)
  })

  it('genehmigt vor der Fälligkeit auch ohne Vergleichsentgelt — nichts geschuldet (5.2.2)', async () => {
    await prisma.assignment.update({
      where: { id: einsatz },
      data: { equalPayDueDate: tag('2027-06-01'), comparableWage: null },
    })
    await bisZurLetztenStufe()
    const zweiterDisponent = await identitaet(welt.zweiterDisponent)
    ok(
      await decideStage(
        zweiterDisponent,
        { timesheetId: zettel, decision: 'approved', rejectionReason: null, comment: null },
        HEUTE,
      ),
    )
    expect(await status(zettel)).toBe('approved')
  })
})

describe('Sichtbarkeit des Zettels (2.2, 2.3)', () => {
  beforeEach(async () => {
    const zettel = await zettelAnlegen()
    ok(
      await addTimeEntry(
        disponent,
        {
          timesheetId: zettel,
          workDate: tag('2026-10-05'),
          startMinute: null,
          endMinute: null,
          breakMinutes: null,
          hours: 8,
          note: null,
          declaredPremiums: [],
        },
        HEUTE,
      ),
    )
  })

  it('der Betreiber sieht ihn', async () => {
    expect(await loadTimesheets(administrator, HEUTE)).toHaveLength(1)
  })

  it('der Lieferant des Einsatzes sieht ihn ([7])', async () => {
    const sichtbar = await loadTimesheets(lieferantDisponent, HEUTE)
    expect(sichtbar).toHaveLength(1)
    expect(sichtbar[0]?.crossTenant).toBe(true)
  })

  it('der Bedarfsträger des Kunden sieht ihn ([2])', async () => {
    expect(await loadTimesheets(bedarfstraeger, HEUTE)).toHaveLength(1)
  })

  it('der Lieferantendisponent eines **anderen** Lieferanten sieht ihn nicht', async () => {
    const anderer = await identitaet(welt.zweiterLieferantDisponent)
    expect(await loadTimesheets(anderer, HEUTE)).toEqual([])
  })
})


describe('Protokoll der Zeiterfassung (3.12)', () => {
  it('trägt für jeden Schreibweg einen Eintrag', async () => {
    const zettel = await zettelAnlegen()
    ok(
      await addTimeEntry(
        disponent,
        {
          timesheetId: zettel,
          workDate: tag('2026-10-05'),
          startMinute: null,
          endMinute: null,
          breakMinutes: null,
          hours: 8,
          note: null,
          declaredPremiums: [],
        },
        HEUTE,
      ),
    )
    ok(await submitTimesheet(disponent, { timesheetId: zettel }, HEUTE))
    ok(
      await decideStage(
        bedarfstraeger,
        { timesheetId: zettel, decision: 'approved', rejectionReason: null, comment: null },
        HEUTE,
      ),
    )

    const eintraege = await prisma.auditEntry.findMany({ orderBy: { entryNumber: 'asc' } })
    expect(eintraege.map((eintrag) => [eintrag.objectType, eintrag.operation])).toEqual([
      ['timesheet', 'create'],
      ['timeEntry', 'create'],
      ['timesheet', 'transition'],
      ['timesheet', 'transition'],
      ['timesheet', 'transition'],
    ])
    // Der Systemübergang `openApproval` trägt ein Systemkennzeichen (4.0,
    // Regel 10), die Benutzerhandlungen einen Benutzer.
    expect(eintraege[3]?.systemActor).not.toBeNull()
    expect(eintraege[3]?.actorUserId).toBeNull()
  })
})

describe('Korrekturfassung (4.4, Fußnote [28])', () => {
  /** Ein genehmigter Zettel — der Ausgangspunkt jeder Korrektur. */
  async function genehmigterZettel(): Promise<string> {
    const id = await zettelAnlegen()
    ok(
      await addTimeEntry(
        disponent,
        {
          timesheetId: id,
          workDate: tag('2026-10-05'),
          startMinute: null,
          endMinute: null,
          breakMinutes: null,
          hours: 8,
          note: 'ursprünglich',
          declaredPremiums: [],
        },
        HEUTE,
      ),
    )
    ok(await submitTimesheet(disponent, { timesheetId: id }, HEUTE))
    ok(
      await decideStage(
        bedarfstraeger,
        { timesheetId: id, decision: 'approved', rejectionReason: null, comment: null },
        HEUTE,
      ),
    )
    const zweiter = await identitaet(welt.zweiterDisponent)
    ok(
      await decideStage(
        zweiter,
        { timesheetId: id, decision: 'approved', rejectionReason: null, comment: null },
        HEUTE,
      ),
    )
    expect(await status(id)).toBe('approved')
    return id
  }

  it('legt sie zum genehmigten Zettel an und übernimmt die Positionen', async () => {
    const original = await genehmigterZettel()
    const meldung = ok(
      await createCorrectionTimesheet(
        disponent,
        { timesheetId: original, reason: 'Der 5.10. war ein Feiertag.' },
        HEUTE,
      ),
    )
    expect(meldung).toContain('Korrekturfassung')
    const fassung = await prisma.timesheet.findFirstOrThrow({
      where: { correctionOfId: original },
      include: { entries: true },
    })
    expect(fassung.status).toBe('recorded')
    expect(fassung.entries).toHaveLength(1)
    expect(fassung.entries[0]?.correctionReason).toContain('Feiertag')
    expect(fassung.entries[0]?.correctedFromId).not.toBeNull()
    // Der ersetzte Zettel bleibt genehmigt, bis die Fassung genehmigt ist.
    expect(await status(original)).toBe('approved')
  })

  it('verweigert sie ohne Begründung ([28])', async () => {
    const original = await genehmigterZettel()
    const ergebnis = await createCorrectionTimesheet(
      disponent,
      { timesheetId: original, reason: '  ' },
      HEUTE,
    )
    expect(ergebnis.ok).toBe(false)
    expect(await prisma.timesheet.count({ where: { correctionOfId: original } })).toBe(0)
  })

  it('verweigert sie zu einem nicht genehmigten Zettel', async () => {
    const id = await zettelAnlegen()
    const ergebnis = await createCorrectionTimesheet(
      disponent,
      { timesheetId: id, reason: 'Grund' },
      HEUTE,
    )
    expect(ergebnis.ok).toBe(false)
  })

  it('verweigert eine **zweite** Fassung zum selben Zettel (3.13)', async () => {
    const original = await genehmigterZettel()
    ok(
      await createCorrectionTimesheet(
        disponent,
        { timesheetId: original, reason: 'erste Korrektur' },
        HEUTE,
      ),
    )
    const ergebnis = await createCorrectionTimesheet(
      disponent,
      { timesheetId: original, reason: 'zweite Korrektur' },
      HEUTE,
    )
    expect(ergebnis.ok).toBe(false)
  })

  it('verweigert sie in einer geschlossenen Periode (4.5.1)', async () => {
    const original = await genehmigterZettel()
    await prisma.billingPeriod.update({ where: { id: periode }, data: { status: 'closed' } })
    const ergebnis = await createCorrectionTimesheet(
      disponent,
      { timesheetId: original, reason: 'Grund' },
      HEUTE,
    )
    expect(ergebnis.ok).toBe(false)
  })

  it('setzt den ersetzten Zettel mit der Genehmigung der Fassung auf `corrected` (4.4)', async () => {
    const original = await genehmigterZettel()
    ok(
      await createCorrectionTimesheet(
        disponent,
        { timesheetId: original, reason: 'Stunden falsch erfasst.' },
        HEUTE,
      ),
    )
    const fassung = await prisma.timesheet.findFirstOrThrow({ where: { correctionOfId: original } })
    ok(await submitTimesheet(disponent, { timesheetId: fassung.id }, HEUTE))
    ok(
      await decideStage(
        bedarfstraeger,
        { timesheetId: fassung.id, decision: 'approved', rejectionReason: null, comment: null },
        HEUTE,
      ),
    )
    const zweiter = await identitaet(welt.zweiterDisponent)
    const meldung = ok(
      await decideStage(
        zweiter,
        { timesheetId: fassung.id, decision: 'approved', rejectionReason: null, comment: null },
        HEUTE,
      ),
    )
    expect(await status(fassung.id)).toBe('approved')
    expect(await status(original)).toBe('corrected')
    expect(meldung).toContain('korrigiert')

    // Der Systemübergang trägt ein **Systemkennzeichen** und keinen Benutzer
    // (4.0, Regel 10; 3.12).
    const eintrag = await prisma.auditEntry.findFirstOrThrow({
      where: { objectType: 'timesheet', statusTo: 'corrected' },
    })
    expect(eintrag.systemActor).not.toBeNull()
    expect(eintrag.actorUserId).toBeNull()
  })

  it('erlaubt nach der Ersetzung eine neue Fassung — die Kette geht weiter (3.13)', async () => {
    const original = await genehmigterZettel()
    ok(
      await createCorrectionTimesheet(
        disponent,
        { timesheetId: original, reason: 'erste Korrektur' },
        HEUTE,
      ),
    )
    const fassung = await prisma.timesheet.findFirstOrThrow({ where: { correctionOfId: original } })
    ok(await submitTimesheet(disponent, { timesheetId: fassung.id }, HEUTE))
    ok(
      await decideStage(
        bedarfstraeger,
        { timesheetId: fassung.id, decision: 'approved', rejectionReason: null, comment: null },
        HEUTE,
      ),
    )
    const zweiter = await identitaet(welt.zweiterDisponent)
    ok(
      await decideStage(
        zweiter,
        { timesheetId: fassung.id, decision: 'approved', rejectionReason: null, comment: null },
        HEUTE,
      ),
    )
    // Jetzt ist die Fassung der gültige Zettel; zu ihr darf eine zweite
    // Korrektur entstehen, ohne 3.13 zu verletzen.
    ok(
      await createCorrectionTimesheet(
        disponent,
        { timesheetId: fassung.id, reason: 'zweite Korrektur' },
        HEUTE,
      ),
    )
  })
})
