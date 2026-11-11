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
  createTimesheet,
  decideStage,
  loadTimesheets,
  openBillingPeriod,
  removeTimeEntry,
  reworkTimesheet,
  submitTimesheet,
} from '../../lib/services/timesheets'
import {
  baueWelt,
  legeAbrechnungsperiodeAn,
  legeEinsatzAn,
  legeStufenfolgeAn,
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

describe('Abrechnungsperiode öffnen (3.9, [33])', () => {
  it('öffnet eine Periode und protokolliert sie', async () => {
    ok(
      await openBillingPeriod(
        administrator,
        {
          periodNumber: '2026-12',
          customerId: null,
          periodFrom: tag('2026-12-01'),
          periodTo: tag('2026-12-31'),
          closingDate: tag('2027-01-10'),
        },
        HEUTE,
      ),
    )
    const periode = await prisma.billingPeriod.findFirstOrThrow({
      where: { periodNumber: '2026-12' },
    })
    expect(periode.status).toBe('open')
    expect(periode.openedById).toBe(welt.administrator)
    expect(
      await prisma.auditEntry.count({ where: { objectType: 'billingPeriod' } }),
    ).toBeGreaterThan(0)
  })

  it('verweigert sie dem Lieferanten — die Zeile gibt ihm nur `L[7]`', async () => {
    const ergebnis = await openBillingPeriod(
      lieferantDisponent,
      {
        periodNumber: '2026-12',
        customerId: null,
        periodFrom: tag('2026-12-01'),
        periodTo: tag('2026-12-31'),
        closingDate: tag('2027-01-10'),
      },
      HEUTE,
    )
    expect(ergebnis.ok).toBe(false)
    expect(await prisma.billingPeriod.count({ where: { periodNumber: '2026-12' } })).toBe(0)
  })

  it('verweigert ein Ende vor dem Beginn', async () => {
    const ergebnis = await openBillingPeriod(
      administrator,
      {
        periodNumber: '2026-13',
        customerId: null,
        periodFrom: tag('2026-12-31'),
        periodTo: tag('2026-12-01'),
        closingDate: tag('2027-01-10'),
      },
      HEUTE,
    )
    expect(ergebnis.ok).toBe(false)
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
