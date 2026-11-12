/**
 * Schreiben der Benachrichtigungen aus einem Übergang — SPEC **3.14** und
 * **4.0 Regel 8**.
 *
 * **In derselben Transaktion wie der Übergang.** Eine Nachricht über einen
 * Übergang, der zurückgerollt ist, wäre falsch — und sie wäre nicht
 * zurückzunehmen: 3.14 gibt der Benachrichtigung keinen Lebenslauf. Deshalb
 * nimmt jede Funktion hier die laufende Transaktion und keine eigene. Das ist
 * der Unterschied zum **abgelehnten** Zugriff im Protokoll, der eine eigene
 * Transaktion braucht (3.12): dort ist der Rollback der Inhalt der Nachricht,
 * hier wäre er ihr Widerspruch.
 *
 * **Die Benachrichtigung ist ihre eigene Spur.** 3.14 nennt sie „zugleich die
 * Spur, dass sie ausgelöst wurde". Ein zusätzlicher Audit-Eintrag entsteht
 * deshalb nur, wo ein Kapitel ihn eigens verlangt:
 *
 *  - **2.4 Regel 4** für jede Eskalations*stufe* („mit Anlass, Adressat und
 *    Zeitpunkt") — aus einem Übergang ist das die Sperre des Lieferanten
 *    (4.6: „Benachrichtigung an `LA`; Eskalation an `MA`"),
 *  - **5.5.2 Nr. 1** für jedes Prüfergebnis — also für die Warnungen aus 4.7.
 *
 * Die Information über einen vollzogenen Übergang braucht keinen: den Übergang
 * selbst protokolliert 4.0 Regel 3 bereits, mit Handelndem, Zeitpunkt und
 * Statuswerten. Ein zweiter Eintrag je Adressat würde das Protokoll
 * vervielfachen, ohne eine Frage zu beantworten, die es nicht schon beantwortet.
 */
import { systemlauf } from '../audit/entry'
import { protokolliere, type Transaktion } from '../audit/record'
import { ROLE_CATALOG, type RoleCode } from '../authz/roles'
import type { Rollenkuerzel } from '../aueg/typen'
import {
  adressaten,
  katalogzeile,
  mandantenDerRolle,
  meldung,
  type Meldungsart,
  type Vorgangslage,
} from '../notifications/uebergaenge'

/** Kürzel aus 2.2 → Rollenbezeichner aus 2.1 (3.11). */
export const ROLLE_JE_KUERZEL: Readonly<Record<Rollenkuerzel, RoleCode | null>> = {
  MA: 'operatorAdmin',
  MD: 'operatorCoordinator',
  KB: 'demandOwner',
  KG: 'approver',
  KE: 'procurementController',
  LD: 'supplierCoordinator',
  LA: 'supplierAdmin',
  // *Offene Frage 4*: ohne eigenen Zugang gibt es niemanden zu adressieren.
  AN: null,
}

/** Rollenbezeichner aus 2.1 → Kürzel aus 2.2, für die relativen Adressaten. */
export const KUERZEL_JE_ROLLE: Readonly<Record<RoleCode, Rollenkuerzel>> = {
  operatorAdmin: 'MA',
  operatorCoordinator: 'MD',
  demandOwner: 'KB',
  approver: 'KG',
  procurementController: 'KE',
  supplierCoordinator: 'LD',
  supplierAdmin: 'LA',
  temporaryWorker: 'AN',
}

/** Was der Schreiber über den Vorgang wissen muss. */
export interface Uebergangsmeldung {
  readonly objectType: string
  readonly objectRef: string
  /** Mandant des **betroffenen Objekts** (3.12, 3.14). */
  readonly tenantId: string
  /** Name des Übergangs aus `lib/status/` — Schlüssel des Katalogs. */
  readonly uebergang: string
  readonly statusFrom: string | null
  readonly statusTo: string
  /** „Bedarfsanfrage BA-2026-0007" — nur Daten, die jeder Beteiligte sieht. */
  readonly bezeichnung: string
  /** Pflichtbegründung; wirkt nur, wo Kapitel 4 „mit Begründung" schreibt. */
  readonly begruendung?: string | null
  /** Organisationen und relative Rollen; `operator` wird hier ergänzt. */
  readonly lage: Omit<Vorgangslage, 'operator'> & { readonly operator?: string }
  readonly raisedAt: Date
}

/**
 * Schreibt die Benachrichtigungen, die Kapitel 4 für diesen Übergang nennt,
 * und gibt ihre Anzahl zurück.
 *
 * Null ist ein gültiges Ergebnis und kein Fehler: die meisten Zeilen in
 * Kapitel 4 nennen keine Nachricht, und eine Rolle ohne Organisation im
 * Vorgang ist nicht adressierbar (2.3).
 */
export async function benachrichtigeUebergang(
  tx: Transaktion,
  args: Uebergangsmeldung,
): Promise<number> {
  const zeile = katalogzeile(args.objectType, args.uebergang)
  if (zeile === null || zeile.adressaten.length === 0) return 0

  const operator = args.lage.operator ?? (await betreibermandant(tx))
  if (operator === null) return 0
  const lage: Vorgangslage = { ...args.lage, operator }

  const text = meldung({
    objectType: args.objectType,
    uebergang: args.uebergang,
    bezeichnung: args.bezeichnung,
    begruendung: args.begruendung ?? null,
  })
  if (text === null) return 0

  let geschrieben = 0
  for (const adressat of adressaten(args.objectType, args.uebergang, lage)) {
    const roleCode = ROLLE_JE_KUERZEL[adressat.rolle]
    if (roleCode === null) continue

    await tx.notification.create({
      data: {
        tenantId: args.tenantId,
        trigger: 'statusTransition',
        kind: adressat.art,
        objectType: args.objectType,
        objectRef: args.objectRef,
        statusFrom: args.statusFrom,
        statusTo: args.statusTo,
        recipientRoleCode: roleCode,
        recipientTenantId: adressat.mandant,
        escalationLevel: adressat.stufe,
        ruleRef: null,
        message: text,
        raisedAt: args.raisedAt,
        runDate: null,
      },
    })
    geschrieben += 1

    // 2.4 Regel 4: jede Eskalationsstufe wird als Audit-Eintrag erfasst, mit
    // Anlass, Adressat und Zeitpunkt. Nur die Stufe — die Information über den
    // Übergang steht schon im Eintrag des Übergangs (4.0 Regel 3).
    if (adressat.art === 'escalation') {
      await protokolliere(tx, {
        occurredAt: args.raisedAt,
        actor: systemlauf(),
        tenantId: args.tenantId,
        objectType: 'notification',
        objectRef: args.objectRef,
        operation: 'create',
        result: 'success',
        reason: `Eskalation Stufe ${adressat.stufe} an ${adressat.rolle}: ${text}`,
        ruleRef: null,
        crossTenant: false,
      })
    }
  }
  return geschrieben
}

/** Eine Warnung aus 4.7, die derselbe Übergang auslöst (3.14). */
export interface Warnungsmeldung {
  readonly objectType: string
  readonly objectRef: string
  readonly tenantId: string
  readonly statusFrom: string | null
  readonly statusTo: string
  /** `P1` … `P11` (4.7, 5.5.2 Nr. 1). */
  readonly ruleRef: string
  /** Die Warnung in Worten, wie die Prüfung sie formuliert (5.5.2 Nr. 2). */
  readonly meldung: string
  /** Zuständige Rollen nach 5.5.2 Nr. 6. */
  readonly adressaten: readonly Rollenkuerzel[]
  readonly lage: Omit<Vorgangslage, 'operator'> & { readonly operator?: string }
  readonly raisedAt: Date
}

/**
 * Schreibt die Benachrichtigung zu einer Warnung aus 4.7: „Der Übergang findet
 * statt, erzeugt aber eine Benachrichtigung an die zuständige Rolle und einen
 * Eskalationsanlass (2.4)."
 *
 * Sie tritt **neben** die Nachricht aus der Spalte „Nebenwirkungen", sie
 * ersetzt sie nicht: die eine sagt, dass der Vorgang weitergegangen ist, die
 * andere, womit. Beide gehören zu demselben Übergang, deshalb trägt auch diese
 * `statusFrom` und `statusTo`.
 */
export async function benachrichtigeWarnung(
  tx: Transaktion,
  args: Warnungsmeldung,
): Promise<number> {
  if (args.adressaten.length === 0) return 0
  const operator = args.lage.operator ?? (await betreibermandant(tx))
  if (operator === null) return 0
  const lage: Vorgangslage = { ...args.lage, operator }

  let geschrieben = 0
  for (const kuerzel of args.adressaten) {
    const roleCode = ROLLE_JE_KUERZEL[kuerzel]
    if (roleCode === null) continue
    for (const mandant of mandantenDerRolle(kuerzel, lage)) {
      await tx.notification.create({
        data: {
          tenantId: args.tenantId,
          trigger: 'ruleWarning',
          kind: 'warning' satisfies Meldungsart,
          objectType: args.objectType,
          objectRef: args.objectRef,
          statusFrom: args.statusFrom,
          statusTo: args.statusTo,
          recipientRoleCode: roleCode,
          recipientTenantId: mandant,
          escalationLevel: 1,
          ruleRef: args.ruleRef,
          message: args.meldung,
          raisedAt: args.raisedAt,
          runDate: null,
        },
      })
      geschrieben += 1
    }
  }

  if (geschrieben > 0) {
    // 5.5.2 Nr. 1: jedes Prüfergebnis wird protokolliert. Der Eintrag des
    // Übergangs trägt **eine** `ruleRef`; eine Warnung, die den Übergang nicht
    // verhindert hat, wäre dort nicht zu sehen.
    await protokolliere(tx, {
      occurredAt: args.raisedAt,
      actor: systemlauf(),
      tenantId: args.tenantId,
      objectType: 'notification',
      objectRef: args.objectRef,
      operation: 'create',
      result: 'success',
      reason: `${args.ruleRef}: ${args.meldung}`,
      ruleRef: args.ruleRef,
      crossTenant: false,
    })
  }
  return geschrieben
}

/**
 * Die Rolle, in der eine Person in einer Organisation gehandelt hat — für die
 * relativen Adressaten „an den Antragsteller", „an die erfassende Seite" und
 * „an den Einsteller" (3.14).
 *
 * Gelesen wird die **Rollenzuweisung** (3.11), gültig am Stichtag. Trägt die
 * Person mehrere in derselben Organisation, entscheidet die Reihenfolge des
 * Rollenkatalogs aus 2.1 — eine Festlegung dieser Umsetzung, solange
 * *offene Frage 58* nicht beantwortet ist. Sie ist deterministisch und bleibt
 * innerhalb der Organisation: eine Nachricht an die „falsche" der beiden
 * Rollen derselben Organisation offenbart nichts, was 2.3 nicht ohnehin
 * zulässt.
 */
export async function rolleDesHandelnden(
  tx: Transaktion,
  args: {
    readonly userId: string | null
    /**
     * Die Organisation — oder **mehrere** in der Reihenfolge, in der sie zu
     * prüfen sind: ein Zettel kann vom Lieferanten oder vom Betreiber
     * eingereicht sein (4.4), und die Rolle steht dort, wo die Person eine
     * Zuweisung hat.
     */
    readonly tenantId: string | readonly string[] | null
    readonly stichtag: Date
  },
): Promise<Rollenkuerzel | null> {
  const mandanten =
    args.tenantId == null ? [] : typeof args.tenantId === 'string' ? [args.tenantId] : args.tenantId
  if (args.userId === null || mandanten.length === 0) return null
  for (const mandant of mandanten) {
    const rolle = await rolleImMandanten(tx, args.userId, mandant, args.stichtag)
    if (rolle !== null) return rolle
  }
  return null
}

async function rolleImMandanten(
  tx: Transaktion,
  userId: string,
  tenantId: string,
  stichtag: Date,
): Promise<Rollenkuerzel | null> {
  const zuweisungen = await tx.roleAssignment.findMany({
    where: {
      userId,
      tenantId,
      deactivatedAt: null,
      validFrom: { lte: stichtag },
      OR: [{ validTo: null }, { validTo: { gte: stichtag } }],
    },
    select: { roleCode: true },
  })
  for (const roleCode of Object.keys(ROLE_CATALOG) as readonly RoleCode[]) {
    if (zuweisungen.some((zuweisung) => zuweisung.roleCode === roleCode)) {
      return KUERZEL_JE_ROLLE[roleCode]
    }
  }
  return null
}

/**
 * Der Betreibermandant. `MA` und `MD` wirken dort (2.1), und ohne ihn ist
 * keine Nachricht an den Betreiber adressierbar.
 */
async function betreibermandant(tx: Transaktion): Promise<string | null> {
  const mandant = await tx.tenant.findFirst({
    where: { tenantType: 'operator' },
    select: { id: true },
  })
  return mandant?.id ?? null
}
