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
 * oder ändern darf ([1], [14], [18], [23], [36], [41] …). Letztere tragen
 * zusätzlich einen `fieldScope`: `hidden` nennt die Felder, die aus einer
 * gelesenen Fassung zu entfernen sind (ausgewertet in
 * lib/visibility/projections.ts), `writable` die Felder, die eine Änderung
 * überhaupt berühren darf. Fehlt das Prädikat eine Angabe, verweigert es —
 * Sichtbarkeit ist positiv festgelegt (2.3).
 *
 * **`hidden` darf vom Vorgang abhängen.** Die Datenminimierung aus 6.4 ist
 * keine feste Feldliste: der Kunde sieht am Profilvorschlag ein
 * pseudonymisiertes Profil und die Klardaten **erst nach Zusage** ([23], 3.6).
 * Dieselbe Zelle verdeckt damit je Offenlegungsstufe andere Felder. Deshalb ist
 * `hidden` entweder eine Liste oder eine Funktion über denselben
 * `ConstraintContext`, mit dem auch `isSatisfied` arbeitet — eine zweite
 * Mechanik für 6.4 gibt es nicht.
 *
 * Hinterlegt sind alle Fußnoten der belegten Zeilen: 3.11 ([2], [7], [38],
 * [45]), die Zeilen zu 3.1 bis 3.7, die Zeile zu 3.10 ([34] bis [37]) und die
 * Zeile zu 3.12 ([39]). Die Fußnoten der noch unbelegten Zeilen (3.8, 3.9)
 * kommen mit ihren Zeilen hinzu; die Struktur trägt sie unverändert.
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
    /**
     * Offenlegungsstufe des Profilvorschlags (3.6) — Grundlage der
     * Datenminimierung aus 6.4 und damit von Fußnote [23]. Fehlt die Angabe,
     * gilt die strengere Stufe `pseudonymized`: ohne ausdrückliche Zusage keine
     * Klardaten (2.3, positive Festlegung).
     */
    readonly disclosureLevel?: 'pseudonymized' | 'identified'
    /**
     * Nachweisart eines Dokuments (`documentCategory`, 3.10) — Grundlage von
     * [35] („keine Vertragsunterlagen des Lieferanten") und von [36] am
     * Dokument („nur die AÜG-Erlaubnis").
     */
    readonly documentCategory?: string
    /**
     * Sichtbarkeitsklasse eines Dokuments (`confidentiality`, 3.10). 3.10 sagt
     * ausdrücklich, dass dieses Feld „[35] und [36] umsetzt" — es ist deshalb
     * die Tatsache, an der die beiden Fußnoten auswerten, und keine zweite
     * Rechtequelle: ohne eine erfüllte Fußnote wirkt es nicht.
     */
    readonly confidentiality?: 'operatorOnly' | 'operatorAndOwner' | 'assignmentParties'
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
   * `hidden` darf vom Vorgang abhängen (siehe Kopfkommentar, Fußnote [23]).
   */
  readonly fieldScope?: {
    readonly hidden?: readonly string[] | ((ctx: ConstraintContext) => readonly string[])
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

/**
 * Nachweisarten, die 2.2 in [35] als „Vertragsunterlagen des Lieferanten" von
 * den einsatzbezogenen Nachweisen abgrenzt: die Erlaubnisurkunde und die
 * Unbedenklichkeitsbescheinigung gehören dem Lieferanten (5.4.4), die
 * Vertragsunterlage dem Rahmenvertrag (3.3).
 */
const SUPPLIER_CONTRACT_DOCUMENTS: readonly string[] = [
  'permitCertificate',
  'clearanceCertificate',
  'agreementDocument',
]

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
    fieldScope: {
      // An der Zeile „Einsatz, Verlängerung, Unterbrechung (3.7)" ist [2] die
      // **einzige** Fußnote der Kundenzellen; die Felder, die 3.7 und 3.3
      // Kundenrollen nicht zeigen, hängen deshalb hier:
      //
      //  - die **Einkaufsseite** (`agreedRateCardItemRef`, `agreedHourlyRate`):
      //    die Differenz zur Kundenpreisliste ist die Marge des Betreibers und
      //    für Kundenrollen nicht sichtbar ([41], 3.3) — ebenso wie am Angebot
      //    ([18]).
      //  - die **Lieferantenidentität**: 3.7 stellt ihre Anzeige gegenüber dem
      //    Kunden ausdrücklich unter *offene Frage 11*. Solange die offen ist,
      //    bleibt sie verdeckt (wie bei [15] und [23]).
      //  - die **Personenidentität**: sie sieht ausschließlich der Betreiber
      //    ([43], 2.3 Regel 4).
      //
      // Andere Zeilen tragen diese Felder nicht; dort wirkt die Liste nicht.
      hidden: (ctx) =>
        ctx.resource.type === 'assignment'
          ? [
              'agreedHourlyRate',
              'agreedRateCardItemId',
              'agreedRateCardItem',
              'rateDeviationReason',
              'supplier',
              'supplierId',
              'supplierTenantId',
              'workerIdentityId',
              'workerIdentity',
            ]
          : [],
    },
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
    fieldScope: {
      // Wie bei [2]: an der Zeile zu 3.7 ist [7] die einzige Fußnote der
      // Lieferantenzellen. 3.7 nennt zwei Felder ausdrücklich — die
      // **Kostenstelle** („für Lieferanten nicht sichtbar", auch [14]) und die
      // **kundenseitige Preisposition** („für Lieferanten nie sichtbar",
      // [42]) —, dazu kommt die Personenidentität ([43]).
      hidden: (ctx) =>
        ctx.resource.type === 'assignment'
          ? [
              'costCenterId',
              'costCenter',
              'costCenterNumber',
              'customerRateCardItemId',
              'customerRateCardItem',
              'customerHourlyRate',
              'workerIdentityId',
              'workerIdentity',
            ]
          : [],
    },
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
    // Die Fußnote steht an **zwei** Zeilen, und die drei Verben treffen in
    // beiden auf andere Zielzustände:
    //
    //  - Lieferantenangebot (4.2.2): sichten (`reviewed`), Zuschlag
    //    (`accepted`), ablehnen (`rejected`).
    //  - Kandidat / Profilvorschlag (4.2.3): sichten (`reviewed`), „zur
    //    Auswahl an den Kunden weiterleiten" ist der Übergang nach
    //    `releasedToCustomer`, ablehnen (`rejected`) vor der Vorlage beim
    //    Kunden. **Nicht** `accepted`: die Zusage trifft der Kunde ([24]), und
    //    4.2.3 schließt eine Zusage durch den Betreiber ausdrücklich aus.
    //    Welchen Übergang die Rolle wann auslöst, entscheidet ohnehin
    //    Kapitel 4 — die Fußnote sagt nur, welche Zielzustände die Zelle
    //    überhaupt trägt.
    isSatisfied: (ctx) =>
      targetStatusIn(ctx, ['reviewed', 'releasedToCustomer', 'accepted', 'rejected']),
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
  22: {
    number: 22,
    text:
      'Nur Pseudonymisierung und Freigabe der Sichtbarkeit (Kapitel 6.4), nicht die fachlichen ' +
      'Angaben des Lieferanten.',
    // Die Einschränkung betrifft die Felder, nicht den Zugriff: der Betreiber
    // führt den Vorgang und die Offenlegung, der Lieferant bleibt Eigentümer
    // der Personendaten (3.6).
    isSatisfied: () => true,
    fieldScope: {
      writable: ['pseudonym', 'disclosureLevel', 'releasedToCustomerAt'],
    },
  },
  23: {
    number: 23,
    text:
      'Im Umfang der Datenminimierung (Kapitel 6.4): pseudonymisiertes Profil, Klardaten erst ' +
      'nach Zusage.',
    isSatisfied: (ctx) => ctx.resource.customerTenantId === ctx.subject.tenantId,
    fieldScope: {
      // 6.4 ist in Kapitel 6 noch nicht ausgearbeitet; die Regel steht
      // ausdrücklich in 3.6 (Offenlegungsstufe), in 4.2.3 (der Übergang nach
      // `releasedToCustomer` **ist** ihre Umsetzung) und in dieser Fußnote.
      // Verdeckt werden deshalb genau die Klardaten des Kandidaten, solange die
      // Stufe `pseudonymized` ist. Ohne Angabe gilt die strengere Stufe.
      hidden: (ctx) => {
        const identified = ctx.resource.disclosureLevel === 'identified'
        const alwaysHidden = [
          // Lieferantenidentität gegenüber dem Kunden: **offene Frage 11**,
          // verdeckt wie am Fortschritt der Ausschreibung ([15]). Sie hängt
          // nicht an der Zusage und bleibt deshalb auf beiden Stufen verdeckt.
          'supplier',
          'supplierId',
          'supplierTenantId',
          'candidateNumber',
          // Die Personenidentität sehen Kunden **nie** — und erfahren auch
          // nicht, dass sie existiert ([43], 2.3 Regel 4). Sie hängt nicht an
          // der Offenlegungsstufe: die Zusage gibt die Klardaten frei, nicht
          // die mandantenübergreifende Zuordnung.
          'workerIdentityId',
          'workerIdentity',
        ]
        if (identified) return alwaysHidden
        return [
          ...alwaysHidden,
          'givenName',
          'familyName',
          'name',
          'dateOfBirth',
          'placeOfBirth',
          'contactEmail',
          'contactPhone',
          'contactData',
          'previousEmploymentDeclaredAt',
          'previousEmploymentExisted',
          'previousEmploymentEndedOn',
          'previousEmploymentEmployer',
        ]
      },
    },
  },
  24: {
    number: 24,
    text:
      'Fachliche Auswahlentscheidung (Interview, Zusage, Ablehnung); die Statusführung gegenüber ' +
      'dem Lieferanten übernimmt MD.',
    isSatisfied: (ctx) =>
      ctx.resource.customerTenantId === ctx.subject.tenantId &&
      targetStatusIn(ctx, ['interviewScheduled', 'accepted', 'rejected']),
  },
  25: {
    number: 25,
    text:
      'Antrag auf Verlängerung oder vorzeitige Beendigung; wirksam wird der Übergang durch MD ' +
      '(Kapitel 4.3).',
    // Zustände hat nur die Verlängerung (4.3.2): `requested` beim Antrag,
    // `withdrawn` beim Zurückziehen des eigenen Antrags. Die vorzeitige
    // Beendigung hat **keinen** Zustand (4.3.1) — ihr Antrag ist ein Feldsatz
    // am Einsatz, und die Matrix gibt KB und LD dafür kein `Ä`. Das ist die
    // Lücke, die 4.3.2 am Ende benennt; sie steht als *offene Frage 39* in
    // SPEC Kapitel 7, und der Prototyp lässt den Antrag deshalb über den
    // Betreiber laufen.
    isSatisfied: (ctx) =>
      ownOrganizationOrOwnCustomer(ctx) || ownSupplierOrganization(ctx)
        ? targetStatusIn(ctx, ['requested', 'withdrawn'])
        : false,
  },
  26: {
    number: 26,
    text:
      'Genehmigung von Verlängerung und vorzeitiger Beendigung, soweit Kapitel 4.3 sie der ' +
      'Kundenseite zuweist.',
    // 4.3 weist der Kundenseite zu: die Verlängerung **immer** (`approved`,
    // `rejected`), die vorzeitige Beendigung nur auf Antrag der Kundenseite —
    // und die hat keinen eigenen Zustand (4.3.1).
    isSatisfied: (ctx) =>
      ownOrganizationOrOwnCustomer(ctx) && targetStatusIn(ctx, ['approved', 'rejected']),
  },
  34: {
    number: 34,
    text: 'Nachweis anerkennen oder zurückweisen (Kapitel 5.4).',
    isSatisfied: (ctx) => targetStatusIn(ctx, ['accepted', 'rejected']),
  },
  35: {
    number: 35,
    text:
      'Nur einsatzbezogene Nachweise zum eigenen Kunden (z. B. Unterweisung, Qualifikation), ' +
      'keine Vertragsunterlagen des Lieferanten.',
    // Drei Bedingungen, alle aus dem Wortlaut:
    //
    //  - „zum eigenen Kunden": der Nachweis muss zum Mandanten des Zugreifenden
    //    einsatzbezogen sein. Er gehört nach 3.10 seinem Bezugsobjekt — einem
    //    Einsatz (Betreiber) oder einem Kandidaten (Lieferant) —, nie dem
    //    Kunden. Welche Kunden das sind, steht am Vorgang
    //    (`engagementTenantIds`, siehe `documentRef`): beim Einsatz dessen
    //    Kunde, beim Kandidaten die Kunden seiner Einsätze. Ein Kandidat kann
    //    bei mehreren Kunden im Einsatz sein — ein einzelnes
    //    `customerTenantId` wäre hier eine Verkürzung.
    //  - „einsatzbezogen": die Sichtbarkeitsklasse `assignmentParties`. 3.10
    //    führt das Feld ausdrücklich als Umsetzung dieser Fußnote.
    //  - „keine Vertragsunterlagen des Lieferanten": Erlaubnisurkunde,
    //    Unbedenklichkeitsbescheinigung und Vertragsunterlage sind für
    //    Kundenrollen nie einsatzbezogen — auch nicht, wenn jemand die
    //    Sichtbarkeitsklasse falsch setzt. Die Art entscheidet mit, nicht das
    //    Feld allein.
    isSatisfied: (ctx) =>
      ctx.subject.tenantType === 'customer' &&
      hasEngagement(ctx) &&
      ctx.resource.confidentiality === 'assignmentParties' &&
      !SUPPLIER_CONTRACT_DOCUMENTS.includes(ctx.resource.documentCategory ?? ''),
  },
  36: {
    number: 36,
    text:
      'Nur Gültigkeitsstatus der AÜG-Erlaubnis der beauftragten Lieferanten, ohne ' +
      'Urkundeninhalte.',
    // Am **Dokument** (3.10) heißt derselbe Satz zusätzlich: nur die
    // Erlaubnisurkunde. Jeder andere Nachweis des Lieferanten — auch die
    // Unbedenklichkeitsbescheinigung — ist für `KE` keine AÜG-Erlaubnis und
    // damit nicht sichtbar.
    isSatisfied: (ctx) =>
      ctx.subject.tenantType === 'customer' &&
      hasEngagement(ctx) &&
      (ctx.resource.type !== 'document' || ctx.resource.documentCategory === 'permitCertificate'),
    // 3.2 ist hier enger als der Satz in 2.2: „Einkauf/Controlling des Kunden
    // sieht ausschließlich Gültigkeitsstatus und Ablaufdatum der beauftragten
    // Lieferanten, nicht die Urkunde." Sichtbar bleiben deshalb nur
    // `verificationStatus` und `validTo`.
    //
    // Dieselbe Fußnote trägt zwei Zeilen der Matrix — die AÜG-Erlaubnis (3.2)
    // und das Dokument (3.10) —, und die Felder heißen dort verschieden. „Ohne
    // Urkundeninhalte" meint am Dokument die Datei und ihre Herkunft; die
    // Feldliste hängt deshalb am Objekt und nicht an der Fußnote allein.
    fieldScope: {
      hidden: (ctx) =>
        ctx.resource.type === 'document'
          ? [
              'documentNumber',
              'issuer',
              'issuedOn',
              'validFrom',
              'fileRef',
              'fileName',
              'mimeType',
              'uploadedAt',
              'uploadedById',
              'uploadedBy',
              'verifiedAt',
              'verifiedById',
              'verifiedBy',
              'rejectionReason',
              'confidentiality',
              'externalReference',
            ]
          : [
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
  39: {
    number: 39,
    text:
      'Nur Einträge zu Objekten der eigenen Organisation bzw. des betreuten Kunden. ' +
      'Audit-Einträge entstehen ausschließlich durch das System und sind für jede Rolle ' +
      'unveränderlich — deshalb trägt die Zeile kein Ä und kein X.',
    // Die Unveränderlichkeit steht nicht in diesem Prädikat, sondern in der
    // **Zelle**: die Zeile zu 3.12 nennt weder `update` noch `delete`, und die
    // Migration zu 3.12 legt zusätzlich einen Trigger an. Hier bleibt die
    // Sichtbarkeit — und sie ist positiv festgelegt (2.3).
    //
    // Für den Betreiber gilt „bzw. des betreuten Kunden": welche Kunden das
    // sind, hat `checkPermission` vor dieser Fußnote entschieden (2.3,
    // Bedingung 2). Objekte eines **Lieferantenmandanten** nennt [39] für `MD`
    // nicht — 3.12 sagt ausdrücklich „`MD` zu Objekten der betreuten Kunden".
    // Die Folge ist unbequem und benannt: *offene Frage 46*.
    isSatisfied: (ctx) =>
      ctx.operation === 'read' &&
      (ctx.resource.tenantId === ctx.subject.tenantId ||
        (ctx.subject.tenantType === 'operator' && ctx.resource.tenantType === 'customer')),
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
  43: {
    number: 43,
    text:
      'Zusammenführen und Trennen von Kandidatensätzen derselben Person. Das Objekt ist ' +
      'ausschließlich beim Betreiber geführt; Kunden und Lieferanten sehen es und seine ' +
      'Existenz nicht (Kapitel 2.3, Regel 4).',
    // Die Zeile in 2.2 gibt nur `MA` und `MD` Rechte; die Fußnote verkleinert
    // das `Ä` des `MD` auf die Verknüpfung. Der Merkmalssatz selbst (Name,
    // Geburtsdatum, Geburtsort) ist in 3.6 abschließend und wird vom `MA`
    // gepflegt.
    isSatisfied: (ctx) => ctx.subject.tenantType === 'operator',
    fieldScope: {
      writable: ['links', 'linkedCandidates', 'mergeHistory', 'confirmedAt', 'confirmedById'],
    },
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
 *
 * Der Kontext ist derselbe, mit dem `isSatisfied` arbeitet: Fußnoten, deren
 * Feldliste vom Vorgang abhängt ([23], Datenminimierung aus 6.4), brauchen ihn.
 */
export function hiddenFields(
  footnotes: readonly FootnoteNumber[],
  ctx: ConstraintContext,
): readonly string[] {
  const hidden = new Set<string>()
  for (const number of footnotes) {
    const scope = FOOTNOTES_AS_CONTRACT[number].fieldScope?.hidden
    if (scope === undefined) continue
    for (const field of typeof scope === 'function' ? scope(ctx) : scope) hidden.add(field)
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
