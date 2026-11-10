/**
 * Schreiben des Audit-Eintrags (SPEC **3.12**).
 *
 * Drei Eigenschaften, die 3.12 verlangt, entstehen genau hier:
 *
 * **1. Lückenlosigkeit.** `entryNumber` ist „fortlaufend, lückenlos"; Lücken
 * sind nach 3.12 „ein Befund, kein Betriebszustand". Eine Datenbanksequenz
 * leistet das nicht — sie zieht bei jedem Rollback eine Nummer, die niemand
 * mehr verwendet. Die Nummer kommt deshalb aus einer **einzigen Zeile**
 * (`AuditSequence`), die der schreibende Vorgang mit `FOR UPDATE` sperrt:
 * gleichzeitige Vorgänge warten aufeinander, und ein Rollback gibt die Nummer
 * zurück.
 *
 * **2. Der Eintrag teilt das Schicksal seiner Handlung — außer bei der
 * Verweigerung.** Ein erfolgreicher Eintrag wird in **derselben** Transaktion
 * geschrieben wie die Handlung: rollt die Handlung zurück, verschwindet auch
 * das Protokoll, denn protokolliert wird, was geschehen ist. Ein **abgelehnter**
 * Zugriff ist umgekehrt: er rollt die Handlung ja gerade zurück, und 3.12
 * verlangt trotzdem den Eintrag („abgelehnte Zugriffe werden ebenfalls
 * protokolliert"). Er braucht deshalb eine **eigene** Transaktion —
 * `protokolliereVerweigerung`. Wäre er in derselben, wäre er mit dem Rollback
 * weg und die Spur genau dort blind, wo sie am meisten taugt.
 *
 * **3. Unveränderlichkeit.** Es gibt in diesem Modul keine Funktion, die einen
 * Eintrag ändert oder löscht — und in der Datenbank verhindert ein Trigger aus
 * der Migration beides (3.12, [39]).
 */
import { prisma } from '../prisma'
import { pruefeAuditEintragOderWirf, type AuditDraft } from './entry'

/**
 * Der Teil des Prisma-Clients, der in einer Transaktion zur Verfügung steht.
 * Als Typ hergeleitet, damit er der Prisma-Fassung folgt statt sie zu
 * wiederholen.
 */
export type Transaktion = Parameters<Parameters<typeof prisma.$transaction>[0]>[0]

/**
 * Schreibt den Eintrag in der laufenden Transaktion und gibt seine Nummer
 * zurück.
 *
 * Ein `update` **ohne** geändertes Feld erzeugt keinen Eintrag und gibt `null`
 * zurück: 3.12 protokolliert Änderungen, und wo nichts geändert wurde, ist
 * nichts zu protokollieren. Jeder andere Entwurf wird geschrieben.
 */
export async function protokolliere(
  tx: Transaktion,
  draft: AuditDraft,
): Promise<number | null> {
  if (draft.operation === 'update' && (draft.changedFields ?? []).length === 0) return null
  pruefeAuditEintragOderWirf(draft)

  const entryNumber = await naechsteNummer(tx)
  await tx.auditEntry.create({
    data: {
      entryNumber,
      occurredAt: draft.occurredAt,
      actorUserId: draft.actor.kind === 'user' ? draft.actor.userId : null,
      systemActor: draft.actor.kind === 'system' ? draft.actor.label : null,
      actingAsRoleAssignmentId:
        draft.actor.kind === 'user' ? draft.actor.roleAssignmentId : null,
      delegationId: draft.actor.kind === 'user' ? draft.actor.delegationId : null,
      tenantId: draft.tenantId,
      objectType: draft.objectType,
      objectRef: draft.objectRef,
      operation: draft.operation,
      statusFrom: draft.statusFrom ?? null,
      statusTo: draft.statusTo ?? null,
      // Ein Json-Feld bleibt leer, indem es **nicht** gesetzt wird: Prisma
      // unterscheidet `null` im Json-Wert von „kein Wert" (DbNull).
      ...(draft.changedFields === undefined || draft.changedFields.length === 0
        ? {}
        : { changedFields: draft.changedFields.map((feld) => ({ ...feld })) }),
      reason: draft.reason ?? null,
      ruleRef: draft.ruleRef ?? null,
      result: draft.result,
      crossTenant: draft.crossTenant ?? false,
      // `clientContext` bleibt ungesetzt, solange 6.8 den Umfang nicht
      // festlegt (3.12): IP-Adressen sind personenbezogen.
    },
  })
  return entryNumber
}

/**
 * Schreibt den Eintrag in einer **eigenen** Transaktion.
 *
 * Für abgelehnte Zugriffe und gesperrte Handlungen: die Handlung selbst rollt
 * zurück, der Eintrag muss bleiben (3.12). Auch für Protokollierung ohne
 * eigene Schreibhandlung — etwa die Offenlegung von Klardaten (6.4).
 */
export async function protokolliereGetrennt(draft: AuditDraft): Promise<number | null> {
  return prisma.$transaction(async (tx) => protokolliere(tx, draft))
}

/**
 * Die nächste Eintragsnummer. Sperrt die Zählerzeile, bis die Transaktion
 * endet — das ist die Zusicherung der Lückenlosigkeit aus 3.12.
 *
 * Die Zeile entsteht mit der Migration. `INSERT ... ON CONFLICT DO NOTHING`
 * steht trotzdem davor, weil ein `TRUNCATE` in den Testläufen sie entfernt und
 * der erste Eintrag danach nicht an der fehlenden Zeile scheitern darf.
 */
async function naechsteNummer(tx: Transaktion): Promise<number> {
  await tx.$executeRaw`
    INSERT INTO "AuditSequence" ("id", "lastEntryNumber") VALUES (1, 0)
    ON CONFLICT ("id") DO NOTHING
  `
  const zeilen = await tx.$queryRaw<{ lastEntryNumber: number }[]>`
    SELECT "lastEntryNumber" FROM "AuditSequence" WHERE "id" = 1 FOR UPDATE
  `
  const stand = zeilen[0]
  if (stand === undefined) {
    throw new Error('SPEC 3.12: Der Zähler der Eintragsnummern fehlt.')
  }
  const naechste = stand.lastEntryNumber + 1
  await tx.$executeRaw`
    UPDATE "AuditSequence" SET "lastEntryNumber" = ${naechste} WHERE "id" = 1
  `
  return naechste
}
