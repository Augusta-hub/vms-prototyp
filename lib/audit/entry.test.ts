/**
 * Der Audit-Eintrag ohne Datenbank — SPEC 3.12.
 *
 * Geprüft wird hier, was **ohne** Datenbank entschieden wird: welche Angaben
 * ein Eintrag haben muss, wen er als Handelnden nennt, und wie aus einer
 * abgelehnten Handlung ein Eintrag wird. Die Lückenlosigkeit der Nummern und
 * die Unveränderlichkeit stehen in `tests/services/audit.test.ts`, weil sie
 * Eigenschaften der Datenbank sind.
 */
import { describe, expect, it } from 'vitest'
import type { Decision } from '../authz/check'
import type { Rejection } from '../status/machine'
import {
  geaenderteFelder,
  handelnder,
  leseEintrag,
  pruefeAuditEintrag,
  pruefeAuditEintragOderWirf,
  schreibEintrag,
  systemlauf,
  verweigerungsEintrag,
  versuchOhneZuweisung,
  SYSTEM_ACTOR,
  type AuditDraft,
} from './entry'
import { ablehnungsEintrag, ergebnisDerAblehnung, uebergangsEintrag } from './transitions'

const ERLAUBT: Decision = {
  allowed: true,
  grant: {
    roleAssignmentId: 'RA-1',
    roleCode: 'operatorAdmin',
    tenantId: 'T-OP',
    responsibilityScopes: [],
  },
  footnotes: [],
  concealedFields: [],
  crossTenant: false,
}

const ERLAUBT_IN_VERTRETUNG: Decision = {
  ...ERLAUBT,
  grant: {
    ...ERLAUBT.grant,
    viaDelegation: { delegationId: 'V-1', delegatedUserId: 'U-2' },
  },
  delegationNote: { delegationId: 'V-1', delegatedUserId: 'U-2' },
} as Decision

const VERWEIGERT: Decision = {
  allowed: false,
  denial: {
    kind: 'noRolePermission',
    reason: 'Die Matrix nennt für KB an diesem Objekt keine Operation „create".',
    specReference: 'SPEC 2.2',
  },
}

const TAG = new Date('2026-11-10T09:00:00.000Z')
const BEZUG = { objectType: 'supplier' as const, objectRef: 'L-1', tenantId: 'T-LIEF' }

function entwurf(teile: Partial<AuditDraft> = {}): AuditDraft {
  return {
    occurredAt: TAG,
    actor: { kind: 'user', userId: 'U-1', roleAssignmentId: 'RA-1', delegationId: null },
    tenantId: 'T-LIEF',
    objectType: 'supplier',
    objectRef: 'L-1',
    operation: 'update',
    result: 'success',
    changedFields: [{ field: 'legalName', from: 'alt', to: 'neu' }],
    ...teile,
  }
}

describe('Handelnder (3.12)', () => {
  it('nennt die Rollenzuweisung aus der Entscheidung, nicht den Benutzer allein', () => {
    const actor = handelnder('U-1', ERLAUBT)
    expect(actor).toEqual({
      kind: 'user',
      userId: 'U-1',
      roleAssignmentId: 'RA-1',
      delegationId: null,
    })
  })

  it('trägt den Vertretungsvermerk, wenn das Recht aus einer Vertretung stammt (2.4, Regel 6)', () => {
    const actor = handelnder('U-1', ERLAUBT_IN_VERTRETUNG)
    expect(actor).toMatchObject({ delegationId: 'V-1' })
  })

  it('ist beim Systemübergang ein Systemkennzeichen, kein Benutzer (4.0, Regel 10)', () => {
    expect(handelnder('U-1', null)).toEqual({ kind: 'system', label: SYSTEM_ACTOR })
    expect(systemlauf()).toEqual({ kind: 'system', label: SYSTEM_ACTOR })
  })

  it('nennt bei einer Verweigerung keine Rollenzuweisung — es steht keine fest (Frage 44)', () => {
    expect(handelnder('U-1', VERWEIGERT)).toEqual({
      kind: 'user',
      userId: 'U-1',
      roleAssignmentId: null,
      delegationId: null,
    })
    expect(versuchOhneZuweisung('U-1').kind).toBe('user')
  })
})

describe('Invarianten des Eintrags (3.12)', () => {
  it('nimmt einen vollständigen Eintrag ohne Beanstandung', () => {
    expect(pruefeAuditEintrag(entwurf())).toEqual([])
  })

  it('verlangt die handelnde Rollenzuweisung beim erfolgreichen Zugriff', () => {
    const verletzungen = pruefeAuditEintrag(
      entwurf({
        actor: { kind: 'user', userId: 'U-1', roleAssignmentId: null, delegationId: null },
      }),
    )
    expect(verletzungen.map((eintrag) => eintrag.feld)).toContain('actingAsRoleAssignmentRef')
  })

  it('verlangt sie beim abgelehnten Zugriff **nicht** — dort steht keine fest (Frage 44)', () => {
    const verletzungen = pruefeAuditEintrag(
      entwurf({
        result: 'denied',
        operation: 'create',
        changedFields: [],
        actor: { kind: 'user', userId: 'U-1', roleAssignmentId: null, delegationId: null },
      }),
    )
    expect(verletzungen).toEqual([])
  })

  it('verlangt beim Übergang den Zielstatus (4.0, Regel 3)', () => {
    const verletzungen = pruefeAuditEintrag(
      entwurf({ operation: 'transition', changedFields: [], statusFrom: 'active', statusTo: null }),
    )
    expect(verletzungen.map((eintrag) => eintrag.feld)).toEqual(['statusTo'])
  })

  it('lässt `statusFrom` bei der Anlage leer — davor gab es den Vorgang nicht', () => {
    const verletzungen = pruefeAuditEintrag(
      entwurf({ operation: 'transition', changedFields: [], statusFrom: null, statusTo: 'draft' }),
    )
    expect(verletzungen).toEqual([])
  })

  it('duldet keinen Statuswert an einem Lesezugriff', () => {
    const verletzungen = pruefeAuditEintrag(
      entwurf({ operation: 'read', changedFields: [], statusFrom: 'active' }),
    )
    expect(verletzungen.map((eintrag) => eintrag.feld)).toEqual(['statusFrom'])
  })

  it('verlangt bei `update` die geänderten Felder', () => {
    const verletzungen = pruefeAuditEintrag(entwurf({ changedFields: [] }))
    expect(verletzungen.map((eintrag) => eintrag.feld)).toEqual(['changedFields'])
  })

  it('verlangt Mandant und Objektverweis — Grundlage von [39]', () => {
    const verletzungen = pruefeAuditEintrag(entwurf({ tenantId: '  ', objectRef: '' }))
    expect(verletzungen.map((eintrag) => eintrag.feld).sort()).toEqual(['objectRef', 'tenantRef'])
  })

  it('verlangt beim Systemlauf ein Kennzeichen', () => {
    const verletzungen = pruefeAuditEintrag(entwurf({ actor: { kind: 'system', label: '' } }))
    expect(verletzungen.map((eintrag) => eintrag.feld)).toEqual(['actorUserRef'])
  })

  it('wirft mit Fundstelle, wenn eine Invariante verletzt ist', () => {
    expect(() => pruefeAuditEintragOderWirf(entwurf({ changedFields: [] }))).toThrow(/SPEC 3\.12/)
  })
})

describe('Geänderte Felder (3.12, Pflicht bei `update`)', () => {
  it('nennt nur die Felder, die sich geändert haben', () => {
    const felder = geaenderteFelder(
      { legalName: 'Alt GmbH', addressCity: 'Augsburg' },
      { legalName: 'Neu GmbH', addressCity: 'Augsburg' },
      ['legalName', 'addressCity'],
    )
    expect(felder).toEqual([{ field: 'legalName', from: 'Alt GmbH', to: 'Neu GmbH' }])
  })

  it('vergleicht nur die genannten Felder — der Umfang kommt aus 6.6, nicht aus dem Objekt', () => {
    const felder = geaenderteFelder({ a: 1, b: 2 }, { a: 9, b: 9 }, ['a'])
    expect(felder).toEqual([{ field: 'a', from: '1', to: '9' }])
  })

  it('führt Datumswerte als Kalendertag, nicht als Zeitstempel (3.0)', () => {
    const felder = geaenderteFelder(
      { validTo: null },
      { validTo: new Date('2027-03-01T00:00:00.000Z') },
      ['validTo'],
    )
    expect(felder).toEqual([{ field: 'validTo', from: null, to: '2027-03-01' }])
  })

  it('unterscheidet „kein Wert" von leerem Text', () => {
    expect(geaenderteFelder({ x: null }, { x: '' }, ['x'])).toEqual([
      { field: 'x', from: null, to: '' },
    ])
  })
})

describe('Einträge zu Handlungen', () => {
  it('die Anlage trägt `create` und nur den Zielstatus (2.2: Anlage ist `A`)', () => {
    const draft = uebergangsEintrag({
      outcome: {
        applied: true,
        from: null,
        to: 'onboarding',
        label: 'Anlegen',
        decision: ERLAUBT,
        specReference: 'SPEC 4.6, — → onboarding',
      },
      bezug: BEZUG,
      userId: 'U-1',
      occurredAt: TAG,
    })
    expect(draft.operation).toBe('create')
    expect(draft.statusFrom).toBeNull()
    expect(draft.statusTo).toBe('onboarding')
    expect(draft.result).toBe('success')
    expect(pruefeAuditEintrag(draft)).toEqual([])
  })

  it('der Statuswechsel trägt `transition` und beide Zustände (4.0, Regel 3)', () => {
    const draft = uebergangsEintrag({
      outcome: {
        applied: true,
        from: 'active',
        to: 'blocked',
        label: 'Sperren',
        decision: ERLAUBT,
        specReference: 'SPEC 4.6, active → blocked',
      },
      bezug: BEZUG,
      userId: 'U-1',
      occurredAt: TAG,
      reason: 'Unbedenklichkeitsbescheinigung abgelaufen',
    })
    expect(draft.operation).toBe('transition')
    expect(draft.statusFrom).toBe('active')
    expect(draft.statusTo).toBe('blocked')
    expect(draft.reason).toBe('Unbedenklichkeitsbescheinigung abgelaufen')
  })

  it('die Änderung trägt die geänderten Felder', () => {
    const draft = schreibEintrag({
      decision: ERLAUBT,
      operation: 'update',
      bezug: BEZUG,
      userId: 'U-1',
      occurredAt: TAG,
      changedFields: [{ field: 'legalName', from: 'a', to: 'b' }],
    })
    expect(draft.changedFields).toHaveLength(1)
    expect(pruefeAuditEintrag(draft)).toEqual([])
  })

  it('der verweigerte Zugriff trägt `denied` und die Begründung samt Fundstelle', () => {
    const draft = verweigerungsEintrag({
      decision: VERWEIGERT,
      operation: 'create',
      bezug: BEZUG,
      userId: 'U-1',
      occurredAt: TAG,
    })
    expect(draft.result).toBe('denied')
    expect(draft.reason).toContain('SPEC 2.2')
    expect(draft.actor).toMatchObject({ roleAssignmentId: null })
    expect(pruefeAuditEintrag(draft)).toEqual([])
  })

  it('der protokollierte Lesezugriff nennt, **warum** er protokolliert wird', () => {
    const draft = leseEintrag({
      decision: ERLAUBT,
      bezug: BEZUG,
      userId: 'U-1',
      occurredAt: TAG,
      reason: 'Klardaten nach der Zusage (6.4)',
    })
    expect(draft.operation).toBe('read')
    expect(draft.reason).toContain('6.4')
    expect(pruefeAuditEintrag(draft)).toEqual([])
  })
})

describe('Verweigerung oder Sperre (3.12, 4.0 Regel 5)', () => {
  const ablehnung = (teile: Partial<Rejection>): Rejection => ({
    kind: 'precondition',
    reason: 'Vorbedingung nicht erfüllt',
    specReference: 'SPEC 4.6',
    ...teile,
  })

  it('eine Vorbedingung mit Regel aus Kapitel 5 ist eine **Sperre**', () => {
    expect(ergebnisDerAblehnung(ablehnung({ ruleRef: 'P9' }))).toBe('blocked')
  })

  it('eine Vorbedingung des Vorgangs selbst ist keine Sperre, sondern eine Verweigerung', () => {
    expect(ergebnisDerAblehnung(ablehnung({}))).toBe('denied')
  })

  it('ein fehlendes Recht ist eine Verweigerung, nie eine Sperre', () => {
    expect(
      ergebnisDerAblehnung(
        ablehnung({ kind: 'notPermitted', ruleRef: 'P9', reason: 'kein Recht' }),
      ),
    ).toBe('denied')
  })

  it('der Eintrag zur Sperre trägt die Regel, damit die Spur sie nennt', () => {
    const draft = ablehnungsEintrag({
      rejection: ablehnung({ ruleRef: 'P9', decision: ERLAUBT }),
      bezug: BEZUG,
      userId: 'U-1',
      occurredAt: TAG,
      statusFrom: 'onboarding',
      statusTo: 'active',
    })
    expect(draft.result).toBe('blocked')
    expect(draft.ruleRef).toBe('P9')
    // Der Zugriff **war** erlaubt: die Rollenzuweisung bleibt im Eintrag.
    expect(draft.actor).toMatchObject({ roleAssignmentId: 'RA-1' })
    expect(pruefeAuditEintrag(draft)).toEqual([])
  })

  it('der Eintrag zur abgelehnten Anlage trägt `create`, nicht `transition`', () => {
    const draft = ablehnungsEintrag({
      rejection: ablehnung({ kind: 'notPermitted', reason: 'kein Recht' }),
      bezug: BEZUG,
      userId: 'U-1',
      occurredAt: TAG,
      statusTo: 'onboarding',
      operation: 'create',
    })
    expect(draft.operation).toBe('create')
    expect(draft.result).toBe('denied')
  })
})
