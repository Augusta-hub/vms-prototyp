/**
 * Fußnoten der Berechtigungsmatrix (SPEC 2.2).
 *
 * Eine Fußnote ist eine **Einschränkung einer Zelle**, keine eigene Regel: sie
 * kann ein in der Matrix genanntes Recht nur verkleinern, nie vergrößern. Jede
 * Fußnote trägt deshalb ihren Wortlaut aus 2.2 und ein Prädikat, das gegen den
 * konkreten Vorgang auswertet. Schlägt eine Fußnote fehl, ist der Zugriff
 * verweigert — auch wenn die Zelle die Operation nennt.
 *
 * **Zwei Arten von Einschränkung.** Die meisten Fußnoten entscheiden über den
 * Zugriff als Ganzes; einige beschränken die **Felder**, die eine Rolle sieht
 * oder ändern darf ([1], [14], [18], [36], [41] …). Letztere tragen zusätzlich
 * einen `fieldScope`: `hidden` nennt die Felder, die aus einer gelesenen
 * Fassung zu entfernen sind (ausgewertet in lib/visibility/projections.ts),
 * `writable` die Felder, die eine Änderung überhaupt berühren darf. Fehlt das
 * Prädikat eine Angabe, verweigert es — Sichtbarkeit ist positiv festgelegt
 * (2.3).
 *
 * Hinterlegt sind alle Fußnoten der belegten Zeilen: 3.11 ([2], [7], [38],
 * [45]) und die Zeilen zu 3.1 bis 3.5. Die Fußnoten der noch unbelegten Zeilen
 * (3.6 bis 3.10, 3.12) kommen mit ihren Zeilen hinzu; die Struktur trägt sie
 * unverändert.
 */
import type { Operation } from './operations'
import type { RoleCode, TenantType } from './roles'
import type { ResourceType } from './resources'

/** Was eine Fußnote zur Auswertung braucht. */
export interface ConstraintContext {
  readonly operation: Operation
  readonly subject: {
    readonly userId: string
    readonly tenantId: string
    readonly tenantType: TenantType
  }
  readonly grant: {
    readonly roleAssignmentId: string
    readonly roleCode: RoleCode
    readonly tenantId: string
    /** Gesetzt, wenn das Recht aus einer Vertretung stammt (2.4). */
    readonly viaDelegation?: { readonly delegationId: string }
  }
  readonly resource: {
    readonly type: ResourceType
    readonly tenantId: string
    readonly tenantType: TenantType
    /** Ersteller des Vorgangs — für die Vier-Augen-Fußnoten [5] und [30]. */
    readonly createdById?: string
    /** Betroffene Person — für die eigenen Daten des Leiharbeitnehmers [4]. */
    readonly subjectUserId?: string
    /** Vertretene Rollenzuweisung — Zeile Vertretung, Fußnote [45]. */
    readonly delegatedRoleAssignmentId?: string
    /** Aktueller Status des Vorgangs (Kapitel 4) — [11], [19], [21], [37]. */
    readonly status?: string
    /** Zielstatus eines Übergangs — [5], [12], [13], [17], [20], [34], [46]. */
    readonly targetStatus?: string
    /**
     * Kunde, den der Vorgang betrifft. Bei Objekten des Kundenmandanten ist er
     * mit `tenantId` identisch; bei Objekten des Betreibers oder eines
     * Lieferanten benennt er den Kunden, auf den sich der Vorgang bezieht —
     * das „bzw. der eigene Kunde" aus Fußnote [2].
     */
    readonly customerTenantId?: string
    /**
     * Lieferant, den der Vorgang betrifft. Bei Objekten des
     * Lieferantenmandanten identisch mit `tenantId`; bei Einladung und
     * Ausschreibung (Objekte des Betreibers) benennt er den eingeladenen
     * Lieferanten — das „die eigene Einladung" aus [16] und [46].
     */
    readonly supplierTenantId?: string
    /**
     * Mandanten, mit denen zu diesem Objekt eine **Beauftragung** besteht —
     * Grundlage von [3] (Lieferant sieht Kunden und Standorte seiner
     * Beauftragung) und [6] / [36] (Kunde sieht die für ihn beauftragten
     * Lieferanten).
     */
    readonly engagementTenantIds?: readonly string[]
    /** Bedarfsträger einer Bedarfsanfrage — [11] und Vier-Augen in 4.1. */
    readonly requestedById?: string
    /** Seite einer Preisliste (3.3) — [41] und [42]. */
    readonly rateCardScope?: 'supplierRateCard' | 'customerRateCard'
    /**
     * true, wenn der Zugriff aus der Entscheidung über einen konkreten Vorgang
     * heraus erfolgt — die „Kostenwirkung des zu genehmigenden Vorgangs" aus
     * Fußnote [8].
     */
    readonly inApprovalContext?: boolean
  }
}

export interface Footnote {
  readonly number: number
  /** Wortlaut aus SPEC 2.2, gekürzt auf die prüfbare Aussage. */
  readonly text: string
  /** true = Einschränkung erfüllt, false = Zugriff verweigert. */
  readonly isSatisfied: (ctx: ConstraintContext) => boolean
  /**
   * Feldbezogene Einschränkung derselben Fußnote. `hidden` wird beim Lesen
   * entfernt, `writable` begrenzt eine Änderung auf die genannten Felder.
   */
  readonly fieldScope?: {
    readonly hidden?: readonly string[]
    readonly writable?: readonly string[]
  }
}

/** Eigene Organisation oder — wo der Vorgang ihn benennt — der eigene Kunde. */
function ownOrganizationOrOwnCustomer(ctx: ConstraintContext): boolean {
  if (ctx.resource.tenantId === ctx.subject.tenantId) return true
  return ctx.resource.customerTenantId === ctx.subject.tenantId
}

/** Eigene Lieferantenorganisation, auch wenn der Vorgang dem Betreiber gehört. */
function ownSupplierOrganization(ctx: ConstraintContext): boolean {
  if (ctx.subject.tenantType !== 'supplier') return false
  if (ctx.resource.tenantId === ctx.subject.tenantId) return true
  return ctx.resource.supplierTenantId === ctx.subject.tenantId
}

/** Besteht zu diesem Objekt eine Beauftragung mit dem Mandanten des Subjekts? */
function hasEngagement(ctx: ConstraintContext): boolean {
  return ctx.resource.engagementTenantIds?.includes(ctx.subject.tenantId) === true
}

/** Zielstatus eines Übergangs; `undefined` erfüllt keine Einschränkung. */
function targetStatusIn(ctx: ConstraintContext, allowed: readonly string[]): boolean {
  if (ctx.operation !== 'transition') return true
  return ctx.resource.targetStatus !== undefined && allowed.includes(ctx.resource.targetStatus)
}

export const FOOTNOTES = {
  1: {
    number: 1,
    text:
      'Nur Felder ohne kaufmännische Wirkung (Ansprechpartner, Anschrift, Beschreibung); ' +
      'Konditionen gehören zu 3.3.',
    // Die Einschränkung betrifft die Felder, nicht den Zugriff: der Vorgang
    // selbst ist lesbar und änderbar, die Konditionen stehen in eigenen
    // Objekten (3.3) mit eigener Matrixzeile.
    isSatisfied: () => true,
    fieldScope: {
      writable: [
        'legalName',
        'legalForm',
        'addressStreet',
        'addressPostalCode',
        'addressCity',
        'addressCountry',
        'commercialRegisterNumber',
        'contacts',
      ],
    },
  },
  2: {
    number: 2,
    text: 'Nur die eigene Organisation bzw. der eigene Kunde (Mandantengrenze, Kapitel 2.3).',
    isSatisfied: ownOrganizationOrOwnCustomer,
  },
  3: {
    number: 3,
    text:
      'Nur Kunden und Standorte, für die eine eigene Beauftragung besteht, und nur im Umfang, ' +
      'den Kapitel 2.3 zulässt.',
    isSatisfied: (ctx) => ctx.subject.tenantType === 'supplier' && hasEngagement(ctx),
  },
  4: {
    number: 4,
    text:
      'Nur bei eigenem Zugang für Leiharbeitnehmer (offene Frage 4) und nur die eigenen Daten ' +
      'bzw. der eigene Einsatz.',
    // Ohne benannte betroffene Person ist die Einschränkung nicht erfüllbar;
    // sie verweigert dann (2.3, positive Festlegung).
    isSatisfied: (ctx) =>
      ctx.resource.subjectUserId !== undefined && ctx.resource.subjectUserId === ctx.subject.userId,
  },
  5: {
    number: 5,
    text:
      'Sperren ja, Entsperren nein; Entsperrung und Reaktivierung nur durch MA ' +
      '(Vier-Augen-Prinzip, Kapitel 2.4).',
    // 4.6 weist dem MD genau einen Übergang zu: `active` → `blocked`.
    isSatisfied: (ctx) => targetStatusIn(ctx, ['blocked']),
  },
  6: {
    number: 6,
    text:
      'Nur Lieferanten mit Beauftragung für den eigenen Kunden; ob dem Kunden die ' +
      'Lieferantenidentität überhaupt angezeigt wird, ist offene Frage 11.',
    isSatisfied: (ctx) => ctx.subject.tenantType === 'customer' && hasEngagement(ctx),
  },
  7: {
    number: 7,
    text: 'Nur die eigene Lieferantenorganisation.',
    isSatisfied: ownSupplierOrganization,
  },
  8: {
    number: 8,
    text:
      'Nur die Kostenwirkung des zu genehmigenden Vorgangs, nicht die Preisliste insgesamt.',
    // Ohne den Zusammenhang eines zu genehmigenden Vorgangs besteht kein
    // Zugriff: die Preisliste als Ganzes ist für KG nicht sichtbar.
    isSatisfied: (ctx) => ctx.resource.inApprovalContext === true,
  },
  9: {
    number: 9,
    text: 'Nur die eigenen Konditionen, nie die eines anderen Lieferanten (Kapitel 2.3).',
    isSatisfied: ownSupplierOrganization,
  },
  10: {
    number: 10,
    text: 'Anlegen im Auftrag des Kunden, mit Kennzeichnung des Auftraggebers.',
    // Die Kennzeichnung ist Pflicht (3.4, 4.1): ohne benannten Auftraggeber
    // darf der MD nicht anlegen.
    isSatisfied: (ctx) =>
      ctx.operation !== 'create' ||
      (ctx.resource.requestedById !== undefined && ctx.resource.requestedById !== ctx.subject.userId),
  },
  11: {
    number: 11,
    text:
      'Nur eigene Anfragen bzw. Anfragen des eigenen Fachbereichs und nur im Status Entwurf.',
    // Der „eigene Fachbereich" ist die Zuständigkeit aus 3.11 und damit offene
    // Frage 14; geprüft wird deshalb die eigene Anfrage. Die Zuständigkeit
    // prüft lib/authz/check.ts ohnehin zusätzlich.
    isSatisfied: (ctx) =>
      ctx.resource.status === 'draft' && ctx.resource.requestedById === ctx.subject.userId,
  },
  12: {
    number: 12,
    text:
      'Einreichen zur Freigabe und Stornieren; die Freigabe selbst erfolgt durch KG.',
    isSatisfied: (ctx) => targetStatusIn(ctx, ['submitted', 'cancelled']),
  },
  13: {
    number: 13,
    text: 'Freigeben oder ablehnen.',
    // 4.1 kennt für KG zwei Übergänge: `approved` (freigeben) und die
    // Rückweisung nach `draft` mit Pflichtbegründung.
    isSatisfied: (ctx) => targetStatusIn(ctx, ['approved', 'draft']),
  },
  14: {
    number: 14,
    text:
      'Nur Anfragen mit eigener Einladung, ohne Kostenstelle, ohne interne Vermerke und ohne ' +
      'Angebote anderer Lieferanten (Kapitel 2.3).',
    isSatisfied: (ctx) => ctx.subject.tenantType === 'supplier' && hasEngagement(ctx),
    fieldScope: {
      hidden: [
        'costCenterId',
        'costCenter',
        'costCenterNumber',
        'internalNote',
        'maxHourlyRate',
        'requestedById',
        'requestedBy',
        'approvedById',
        'approvedBy',
      ],
    },
  },
  15: {
    number: 15,
    text:
      'Nur Stand und Fortschritt zur eigenen Anfrage; Lieferantenidentität nach offener Frage 11.',
    isSatisfied: (ctx) => ctx.resource.customerTenantId === ctx.subject.tenantId,
    // Die Lieferantenidentität bleibt verdeckt, solange Frage 11 offen ist;
    // ebenso die Teilnehmerzahl, die 2.3 keiner Seite zeigt.
    fieldScope: { hidden: ['supplierId', 'supplier', 'supplierTenantId', 'invitations'] },
  },
  16: {
    number: 16,
    text: 'Nur die eigene Einladung.',
    isSatisfied: ownSupplierOrganization,
  },
  17: {
    number: 17,
    text: 'Annehmen, ablehnen oder zur Auswahl an den Kunden weiterleiten.',
    isSatisfied: (ctx) => targetStatusIn(ctx, ['reviewed', 'accepted', 'rejected']),
  },
  18: {
    number: 18,
    text:
      'Fachliche Inhalte des Angebots; Preisbestandteile nur, soweit Kapitel 2.3 und 6.4 es ' +
      'zulassen.',
    isSatisfied: (ctx) => ctx.resource.customerTenantId === ctx.subject.tenantId,
    // 3.3 ist hier eindeutig: Kundenrollen sehen die Einkaufsseite nie — die
    // Differenz zur Kundenpreisliste ist die Marge des Betreibers.
    fieldScope: {
      hidden: ['hourlyRate', 'rateCardItemId', 'rateCardItem', 'rateDeviationReason'],
    },
  },
  19: {
    number: 19,
    text: 'Nur solange das eigene Angebot eingereicht und noch nicht gesichtet ist.',
    isSatisfied: (ctx) => ownSupplierOrganization(ctx) && ctx.resource.status === 'submitted',
  },
  20: {
    number: 20,
    text: 'Einreichen und Zurückziehen des eigenen Vorgangs.',
    isSatisfied: (ctx) =>
      ownSupplierOrganization(ctx) && targetStatusIn(ctx, ['submitted', 'withdrawn']),
  },
  21: {
    number: 21,
    text: 'Nur im Status Entwurf.',
    isSatisfied: (ctx) => ownSupplierOrganization(ctx) && ctx.resource.status === 'draft',
  },
  34: {
    number: 34,
    text: 'Nachweis anerkennen oder zurückweisen (Kapitel 5.4).',
    isSatisfied: (ctx) => targetStatusIn(ctx, ['accepted', 'rejected']),
  },
  36: {
    number: 36,
    text:
      'Nur Gültigkeitsstatus der AÜG-Erlaubnis der beauftragten Lieferanten, ohne ' +
      'Urkundeninhalte.',
    isSatisfied: (ctx) => ctx.subject.tenantType === 'customer' && hasEngagement(ctx),
    // 3.2 ist hier enger als der Satz in 2.2: „Einkauf/Controlling des Kunden
    // sieht ausschließlich Gültigkeitsstatus und Ablaufdatum der beauftragten
    // Lieferanten, nicht die Urkunde." Sichtbar bleiben deshalb nur
    // `verificationStatus` und `validTo`.
    fieldScope: {
      hidden: [
        'permitNumber',
        'issuingAuthority',
        'permitType',
        'issuedOn',
        'validFrom',
        'restrictions',
        'certificateDocumentRef',
        'verifiedAt',
        'verifiedById',
        'verifiedBy',
        'rejectionReason',
        'supersedesId',
      ],
    },
  },
  37: {
    number: 37,
    text: 'Nur solange der Nachweis nicht anerkannt ist.',
    isSatisfied: (ctx) => ownSupplierOrganization(ctx) && ctx.resource.status !== 'accepted',
  },
  38: {
    number: 38,
    text:
      'Nur lesend, zur Zuordnung von Vorgängen; die Rollenvergabe bleibt bei MA bzw. LA. ' +
      'Die kundenseitige Benutzerverwaltung liegt derzeit beim Betreiber — offene Frage 12.',
    isSatisfied: (ctx) => ctx.operation === 'read',
  },
  40: {
    number: 40,
    text:
      'Nur der eigene Rahmenvertrag mit dem Betreiber; der Rahmenvertrag eines anderen ' +
      'Mandanten ist nie sichtbar.',
    isSatisfied: ownSupplierOrganization,
  },
  41: {
    number: 41,
    text:
      'Nur die Kundenpreisliste des eigenen Kunden (Betreiber ↔ Kunde). Die ' +
      'Einkaufskonditionen des Betreibers gegenüber Lieferanten sind für Kundenrollen nicht ' +
      'sichtbar.',
    isSatisfied: (ctx) =>
      ctx.resource.rateCardScope === 'customerRateCard' &&
      ctx.resource.customerTenantId === ctx.subject.tenantId,
  },
  42: {
    number: 42,
    text:
      'Nur die eigene Einkaufspreisliste (Betreiber ↔ eigener Lieferant); die Kundenpreisliste ' +
      'ist nie sichtbar.',
    isSatisfied: (ctx) =>
      ctx.resource.rateCardScope === 'supplierRateCard' && ownSupplierOrganization(ctx),
  },
  45: {
    number: 45,
    text:
      'Nur die eigene Vertretung für eine eigene Rollenzuweisung bei geplanter Abwesenheit ' +
      '(2.4, Regel 7). Keine Rechteerweiterung, keine Ketten.',
    isSatisfied: (ctx) => {
      // Keine Vertretungsketten: wer selbst in Vertretung handelt, bestimmt
      // keinen Untervertreter (2.4, Regel 4). Die Regel betrifft das
      // Einrichten; die eigene Vertretung lesen und beenden darf der Vertreter
      // im Rahmen der vertretenen Rollenzuweisung.
      if (ctx.operation === 'create' && ctx.grant.viaDelegation !== undefined) return false
      // Nur zur eigenen Rollenzuweisung. Ohne Angabe der vertretenen Zuweisung
      // ist die Einschränkung nicht erfüllbar — positiv festgelegt (2.3).
      return ctx.resource.delegatedRoleAssignmentId === ctx.grant.roleAssignmentId
    },
  },
  46: {
    number: 46,
    text:
      'Nur die Absage der eigenen Einladung (`declined` mit `declineReason`, Kapitel 4.2.1). ' +
      'Keine weitere Statusführung: Annahme, Fristverlängerung und der Fortschritt der ' +
      'Ausschreibung bleiben beim Betreiber.',
    isSatisfied: (ctx) => ownSupplierOrganization(ctx) && targetStatusIn(ctx, ['declined']),
  },
} as const satisfies Record<number, Footnote>

export type FootnoteNumber = keyof typeof FOOTNOTES

/**
 * Dieselbe Tabelle, auf den Vertrag `Footnote` verbreitert. `as const` macht
 * jede Zelle einzeln eng typisiert; die Hilfsfunktionen unten lesen aber
 * dasselbe Feld über alle Fußnoten hinweg.
 */
const FOOTNOTES_AS_CONTRACT: Readonly<Record<FootnoteNumber, Footnote>> = FOOTNOTES

export function footnoteText(number: FootnoteNumber): string {
  return FOOTNOTES[number].text
}

/**
 * Felder, die aus einer gelesenen Fassung zu entfernen sind, weil eine Fußnote
 * sie der Rolle nicht zeigt (2.2, 2.3). Vereinigung über alle Fußnoten der
 * Zelle: jede verkleinert, keine vergrößert.
 */
export function hiddenFields(footnotes: readonly FootnoteNumber[]): readonly string[] {
  const hidden = new Set<string>()
  for (const number of footnotes) {
    for (const field of FOOTNOTES_AS_CONTRACT[number].fieldScope?.hidden ?? []) hidden.add(field)
  }
  return [...hidden]
}

/**
 * Felder, die eine Änderung berühren darf, oder `null`, wenn keine Fußnote der
 * Zelle die Felder einschränkt. Schnittmenge über alle Fußnoten, die eine
 * Angabe machen — auch hier verkleinert jede Fußnote nur.
 */
export function writableFields(footnotes: readonly FootnoteNumber[]): readonly string[] | null {
  let allowed: Set<string> | null = null
  for (const number of footnotes) {
    const scope = FOOTNOTES_AS_CONTRACT[number].fieldScope?.writable
    if (scope === undefined) continue
    if (allowed === null) {
      allowed = new Set(scope)
      continue
    }
    const narrowed: Set<string> = allowed
    allowed = new Set(scope.filter((field: string) => narrowed.has(field)))
  }
  return allowed === null ? null : [...allowed]
}
