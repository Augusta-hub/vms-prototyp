/**
 * Die synthetische Welt der Dienst-Tests.
 *
 * Sie ist **klein**: ein Betreiber, ein Kunde mit Standort und Kostenstelle,
 * zwei Lieferanten, eine Person mit je einem Kandidatensatz je Lieferant. Mehr
 * braucht keine der Regeln aus SPEC 5.1 und 5.3 — und weniger würde sie nicht
 * tragen, weil die Überlassungskette über **Lieferanten hinweg** läuft (5.0).
 *
 * Alle Namen, Nummern und Daten sind erfunden (CLAUDE.md, Regel 3). Die
 * Datumsangaben liegen bewusst fest und nicht relativ zu „heute": eine Regel,
 * die ihren Stichtag aus dem Vorgang nimmt, darf von einem Test nicht anders
 * behandelt werden als von der Spezifikation (5.0).
 */

import { pruefeDokumentOderWirf } from '../../lib/masterdata/invariants'
import { prisma } from '../../lib/prisma'

/** Ein Kalendertag als UTC-Mitternacht — so führt Prisma die Datumsfelder. */
export function tag(iso: string): Date {
  return new Date(`${iso}T00:00:00.000Z`)
}

export interface Welt {
  readonly betreiberMandant: string
  readonly kundenMandant: string
  readonly lieferantMandant: string
  readonly zweiterLieferantMandant: string
  readonly administrator: string
  readonly disponent: string
  /** Genehmiger der Kundenseite (`KG`) — 4.3.2 weist ihm die Verlängerung zu. */
  readonly genehmiger: string
  readonly kunde: string
  readonly standort: string
  readonly kostenstelle: string
  readonly lieferant: string
  readonly zweiterLieferant: string
  readonly kandidat: string
  readonly kandidatZweiterLieferant: string
  readonly personenidentitaet: string
  readonly einkaufsposition: string
  /** Preisposition zum **eigenen** Rahmenvertrag des zweiten Lieferanten (K1). */
  readonly zweiteEinkaufsposition: string
  /** Die Urkunde zur AÜG-Erlaubnis des ersten Lieferanten (3.2, 3.10). */
  readonly erlaubnisurkunde: string
  readonly verkaufsposition: string
}

/**
 * Leert alle Tabellen der Testdatenbank. `TRUNCATE ... CASCADE` über das
 * Schema statt einer Liste von Modellen: die Liste würde bei jedem neuen Modell
 * veralten, und ein vergessenes Modell macht den nächsten Test unberechenbar.
 */
export async function leereDatenbank(): Promise<void> {
  const tabellen = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename NOT LIKE '_prisma%'
  `
  if (tabellen.length === 0) return
  const liste = tabellen.map((zeile) => `"public"."${zeile.tablename}"`).join(', ')
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${liste} RESTART IDENTITY CASCADE`)
}

/** Legt die Welt an und gibt die Kennungen zurück. */
export async function baueWelt(): Promise<Welt> {
  const betreiber = await prisma.tenant.create({
    data: { tenantNumber: 'T-OP', tenantType: 'operator', displayName: 'Betreiber (Test)' },
  })
  const kundenMandant = await prisma.tenant.create({
    data: { tenantNumber: 'T-KU', tenantType: 'customer', displayName: 'Nordwerk Metall GmbH' },
  })
  const lieferantMandant = await prisma.tenant.create({
    data: { tenantNumber: 'T-LI-1', tenantType: 'supplier', displayName: 'Rheinpersonal GmbH' },
  })
  const zweiterLieferantMandant = await prisma.tenant.create({
    data: { tenantNumber: 'T-LI-2', tenantType: 'supplier', displayName: 'Elbe Zeitarbeit GmbH' },
  })

  const administrator = await prisma.user.create({
    data: {
      userNumber: 'U-MA',
      tenantId: betreiber.id,
      loginIdentifier: 'ma@test.invalid',
      givenName: 'Mara',
      familyName: 'Administrator',
    },
  })
  const disponent = await prisma.user.create({
    data: {
      userNumber: 'U-MD',
      tenantId: betreiber.id,
      loginIdentifier: 'md@test.invalid',
      givenName: 'Dirk',
      familyName: 'Disponent',
    },
  })
  for (const [benutzer, rolle] of [
    [administrator.id, 'operatorAdmin'],
    [disponent.id, 'operatorCoordinator'],
  ] as const) {
    await prisma.roleAssignment.create({
      data: {
        userId: benutzer,
        roleCode: rolle,
        tenantId: betreiber.id,
        validFrom: tag('2025-01-01'),
        grantedById: administrator.id,
      },
    })
  }

  // Der Genehmiger gehört zur **Kundenseite**: 4.3.2 weist ihm die Genehmigung
  // der Verlängerung zu, und Fußnote [26] verlangt die eigene Organisation.
  const genehmiger = await prisma.user.create({
    data: {
      userNumber: 'U-KG',
      tenantId: kundenMandant.id,
      loginIdentifier: 'kg@test.invalid',
      givenName: 'Gesa',
      familyName: 'Genehmigerin',
    },
  })
  await prisma.roleAssignment.create({
    data: {
      userId: genehmiger.id,
      roleCode: 'approver',
      tenantId: kundenMandant.id,
      validFrom: tag('2025-01-01'),
      grantedById: administrator.id,
    },
  })

  const kunde = await prisma.customer.create({
    data: {
      tenantId: kundenMandant.id,
      customerNumber: 'K-1',
      legalName: 'Nordwerk Metall GmbH',
      addressStreet: 'Werkstraße 1',
      addressPostalCode: '40210',
      addressCity: 'Düsseldorf',
      addressCountry: 'DE',
      corporateGroup: 'Nordwerk Gruppe',
      validFrom: tag('2025-01-01'),
    },
  })
  // Ein zweites Unternehmen desselben Konzerns — die Drehtürklausel greift auch
  // für einen Arbeitgeber aus dem Konzern des Entleihers (§ 18 AktG, 5.3.1).
  const konzernMandant = await prisma.tenant.create({
    data: { tenantNumber: 'T-KU-2', tenantType: 'customer', displayName: 'Nordwerk Service GmbH' },
  })
  await prisma.customer.create({
    data: {
      tenantId: konzernMandant.id,
      customerNumber: 'K-2',
      legalName: 'Nordwerk Service GmbH',
      addressStreet: 'Servicestraße 2',
      addressPostalCode: '40210',
      addressCity: 'Düsseldorf',
      addressCountry: 'DE',
      corporateGroup: 'Nordwerk Gruppe',
      validFrom: tag('2025-01-01'),
    },
  })

  const standort = await prisma.site.create({
    data: {
      tenantId: kundenMandant.id,
      customerId: kunde.id,
      siteNumber: 'S-1',
      name: 'Werk Süd',
      addressStreet: 'Werkstraße 1',
      addressPostalCode: '40210',
      addressCity: 'Düsseldorf',
      addressCountry: 'DE',
      safetyBriefingRequired: true,
      validFrom: tag('2025-01-01'),
    },
  })
  const kostenstelle = await prisma.costCenter.create({
    data: {
      tenantId: kundenMandant.id,
      customerId: kunde.id,
      costCenterNumber: 'KST-4711',
      name: 'Montage',
      validFrom: tag('2025-01-01'),
    },
  })

  const lieferant = await prisma.supplier.create({
    data: {
      tenantId: lieferantMandant.id,
      supplierNumber: 'L-1',
      legalName: 'Rheinpersonal GmbH',
      addressStreet: 'Rheinallee 7',
      addressPostalCode: '50667',
      addressCity: 'Köln',
      addressCountry: 'DE',
      status: 'active',
      validFrom: tag('2025-01-01'),
    },
  })
  const zweiterLieferant = await prisma.supplier.create({
    data: {
      tenantId: zweiterLieferantMandant.id,
      supplierNumber: 'L-2',
      legalName: 'Elbe Zeitarbeit GmbH',
      addressStreet: 'Elbchaussee 3',
      addressPostalCode: '22765',
      addressCity: 'Hamburg',
      addressCountry: 'DE',
      status: 'active',
      validFrom: tag('2025-01-01'),
    },
  })

  const rahmenvertrag = await prisma.masterAgreement.create({
    data: {
      tenantId: betreiber.id,
      agreementNumber: 'RV-L-1',
      agreementType: 'supplierAgreement',
      supplierId: lieferant.id,
      validFrom: tag('2025-01-01'),
      status: 'active',
    },
  })
  const einkaufsliste = await prisma.rateCard.create({
    data: {
      tenantId: betreiber.id,
      rateCardNumber: 'PL-EK-1',
      masterAgreementId: rahmenvertrag.id,
      rateCardScope: 'supplierRateCard',
      validFrom: tag('2025-01-01'),
      currency: 'EUR',
      status: 'active',
    },
  })
  const verkaufsliste = await prisma.rateCard.create({
    data: {
      tenantId: betreiber.id,
      rateCardNumber: 'PL-VK-1',
      masterAgreementId: rahmenvertrag.id,
      rateCardScope: 'customerRateCard',
      validFrom: tag('2025-01-01'),
      currency: 'EUR',
      status: 'active',
    },
  })
  const einkaufsposition = await prisma.rateCardItem.create({
    data: { rateCardId: einkaufsliste.id, itemType: 'baseRate' },
  })
  const verkaufsposition = await prisma.rateCardItem.create({
    data: { rateCardId: verkaufsliste.id, itemType: 'baseRate' },
  })

  // Die AÜG-Erlaubnis beider Lieferanten mit ihrer **Urkunde** (3.2, 3.10).
  // Nach 5.4.1 deckt eine Erlaubnis nur, wenn sie anerkannt ist **und** eine
  // hinterlegte Urkunde trägt (E25, 5.4.5). Ein Lieferant im Status `active`
  // ohne das ist nach 3.2 ein Datenfehler — und keine Grundlage, sondern der
  // Fall, den P9 verhindert.
  const erlaubnisurkunden = new Map<string, string>()
  for (const [nummer, lieferantId, mandantId] of [
    ['AZ-TEST-1', lieferant.id, lieferantMandant.id],
    ['AZ-TEST-2', zweiterLieferant.id, zweiterLieferantMandant.id],
  ] as const) {
    const urkunde = await prisma.document.create({
      data: {
        tenantId: mandantId,
        documentNumber: `DOK-${nummer}`,
        documentCategory: 'permitCertificate',
        subjectType: 'supplier',
        supplierId: lieferantId,
        fileRef: `ablage://synthetisch/${nummer}`,
        fileName: `${nummer}.pdf`,
        mimeType: 'application/pdf',
        uploadedAt: tag('2025-01-02'),
        uploadedById: administrator.id,
        verificationStatus: 'accepted',
        verifiedAt: tag('2025-01-03'),
        verifiedById: administrator.id,
        // Der Kunde sieht an der Erlaubnis nur den Gültigkeitsstatus, nicht den
        // Urkundeninhalt ([36], 3.10).
        confidentiality: 'operatorAndOwner',
      },
    })
    erlaubnisurkunden.set(lieferantId, urkunde.id)
    await prisma.supplierPermit.create({
      data: {
        tenantId: mandantId,
        supplierId: lieferantId,
        permitNumber: nummer,
        issuingAuthority: 'Agentur für Arbeit (synthetisch)',
        permitType: 'unlimited',
        issuedOn: tag('2025-01-01'),
        validFrom: tag('2025-01-01'),
        certificateDocumentRef: urkunde.id,
        verificationStatus: 'accepted',
        verifiedAt: tag('2025-01-03'),
        verifiedById: administrator.id,
      },
    })
  }

  // Ein **eigener** Rahmenvertrag des zweiten Lieferanten mit eigener
  // Preisposition. SPEC 5.3.3, Grenzfall „Lieferantenwechsel": der neue Einsatz
  // braucht einen aktiven Rahmenvertrag des **neuen** Lieferanten; die Übernahme
  // der Angaben aus dem alten Einsatz ist eine Änderung, keine Fortschreibung.
  // Eine Welt, in der ein Einsatz über „Elbe Zeitarbeit" auf den Rahmenvertrag
  // von „Rheinpersonal" verweist, ist nicht gekennzeichnet (K1) — das ist ein
  // Datenfehler und keine Grundlage.
  const zweiterRahmenvertrag = await prisma.masterAgreement.create({
    data: {
      tenantId: betreiber.id,
      agreementNumber: 'RV-L-2',
      agreementType: 'supplierAgreement',
      supplierId: zweiterLieferant.id,
      validFrom: tag('2025-01-01'),
      status: 'active',
    },
  })
  const zweiteEinkaufsliste = await prisma.rateCard.create({
    data: {
      tenantId: betreiber.id,
      rateCardNumber: 'PL-EK-2',
      masterAgreementId: zweiterRahmenvertrag.id,
      rateCardScope: 'supplierRateCard',
      validFrom: tag('2025-01-01'),
      currency: 'EUR',
      status: 'active',
    },
  })
  const zweiteEinkaufsposition = await prisma.rateCardItem.create({
    data: { rateCardId: zweiteEinkaufsliste.id, itemType: 'baseRate' },
  })

  // Die Tarifzuordnung der **Verleiherseite**. Sie ist nach SPEC 3.2 ab Status
  // `active` Pflicht, und 5.2.2 liest aus ihr die Equal-Pay-Frist. Ohne sie
  // gilt Fall 1: Equal Pay ab dem ersten Überlassungstag — dann sperrt Q48
  // jeden Einsatzstart ohne Vergleichsentgelt. Eine Welt ohne sie ist deshalb
  // keine rechtmäßige Welt, sondern ein Datenfehler; den prüft ein eigener
  // Test, nicht die Grundlage.
  for (const lieferantId of [lieferant.id, zweiterLieferant.id]) {
    await prisma.collectiveAgreementAssignment.create({
      data: {
        tenantId: betreiber.id,
        collectiveAgreement: 'Beispieltarif Z1',
        appliesToType: 'supplier',
        supplierId: lieferantId,
        validFrom: tag('2025-01-01'),
        validTo: tag('2028-12-31'),
        // Leer heißt: gesetzliche Regelfrist von neun Monaten (5.2.2, Fall 2).
        equalPayDeadlineMonths: null,
      },
    })
  }

  const personenidentitaet = await prisma.workerIdentity.create({
    data: {
      tenantId: betreiber.id,
      identityNumber: 'PI-1001',
      matchGivenName: 'Jana',
      matchFamilyName: 'Behrens',
      matchDateOfBirth: tag('1992-04-17'),
      confirmedAt: tag('2025-06-01'),
    },
  })

  const kandidat = await prisma.candidate.create({
    data: {
      tenantId: lieferantMandant.id,
      candidateNumber: 'KA-1',
      supplierId: lieferant.id,
      givenName: 'Jana',
      familyName: 'Behrens',
      dateOfBirth: tag('1992-04-17'),
      pseudonym: 'Kandidat A',
      employmentStatusWithSupplier: 'employed',
      employedSince: tag('2025-08-01'),
      workPermitRequired: false,
      status: 'active',
      workerIdentityId: personenidentitaet.id,
    },
  })
  const kandidatZweiterLieferant = await prisma.candidate.create({
    data: {
      tenantId: zweiterLieferantMandant.id,
      candidateNumber: 'KA-2',
      supplierId: zweiterLieferant.id,
      givenName: 'Jana',
      familyName: 'Behrens',
      dateOfBirth: tag('1992-04-17'),
      pseudonym: 'Kandidat B',
      employmentStatusWithSupplier: 'employed',
      employedSince: tag('2026-05-01'),
      workPermitRequired: false,
      status: 'active',
      workerIdentityId: personenidentitaet.id,
    },
  })
  for (const satz of [kandidat.id, kandidatZweiterLieferant.id]) {
    await prisma.workerIdentityLink.create({
      data: {
        workerIdentityId: personenidentitaet.id,
        candidateId: satz,
        linkStatus: 'confirmed',
        proposalBasis: 'synthetischer Testfall',
        proposedAt: tag('2025-06-01'),
        confirmedAt: tag('2025-06-01'),
        confirmedById: administrator.id,
      },
    })
  }

  return {
    betreiberMandant: betreiber.id,
    kundenMandant: kundenMandant.id,
    lieferantMandant: lieferantMandant.id,
    zweiterLieferantMandant: zweiterLieferantMandant.id,
    administrator: administrator.id,
    disponent: disponent.id,
    genehmiger: genehmiger.id,
    kunde: kunde.id,
    standort: standort.id,
    kostenstelle: kostenstelle.id,
    lieferant: lieferant.id,
    zweiterLieferant: zweiterLieferant.id,
    kandidat: kandidat.id,
    kandidatZweiterLieferant: kandidatZweiterLieferant.id,
    personenidentitaet: personenidentitaet.id,
    einkaufsposition: einkaufsposition.id,
    zweiteEinkaufsposition: zweiteEinkaufsposition.id,
    erlaubnisurkunde: erlaubnisurkunden.get(lieferant.id) ?? '',
    verkaufsposition: verkaufsposition.id,
  }
}

/** Ein Einsatz der Welt (SPEC 3.7). */
export async function legeEinsatzAn(
  welt: Welt,
  eigenes: {
    readonly nummer: string
    readonly status: 'planned' | 'active' | 'interrupted' | 'completed' | 'terminatedEarly'
    readonly plannedStartDate: Date
    readonly plannedEndDate?: Date | null
    readonly actualStartDate?: Date | null
    readonly actualEndDate?: Date | null
    readonly lieferant?: string
    readonly kandidat?: string
    readonly mitPersonenidentitaet?: boolean
    /** `comparableWage` (3.7) — ab `equalPayDueDate` Pflicht (5.2.4). */
    readonly vergleichsentgelt?: string | null
    /**
     * Tag des Übergangs nach `planned` — das Kriterium K5 aus SPEC 5.3.3.
     *
     * Ohne Angabe wird der **erste Überlassungstag** gesetzt. Das ist keine
     * Bequemlichkeit: `createdAt` ist der Tag dieses Übergangs (4.3.1 kennt nur
     * „— → `planned`"), und eine Zeile, die nach ihrem eigenen Beginn entsteht,
     * ist ein Verstoß gegen § 1 Abs. 1 Sätze 5 und 6 AÜG. Ließe man hier die
     * Vorbelegung `now()` stehen, wäre jeder Einsatz des Fixtures mit einem
     * Beginn in der Vergangenheit nicht konkretisiert — und das ist keine
     * rechtmäßige Grundlage, sondern der Fall, den P8 verhindert.
     */
    readonly angelegtAm?: Date
    /**
     * `agreedRateCardItemRef` (3.7). Ohne Angabe die Preisposition zum
     * Rahmenvertrag des ersten Lieferanten; bei einem anderen Lieferanten ist
     * **dessen** Position zu nennen, sonst trägt die Kennzeichnung nicht (K1).
     */
    readonly einkaufsposition?: string
    /**
     * Unterweisung am Standort (`safetyBriefing`, 3.10). Ohne Angabe wird sie
     * angelegt: der Standort des Fixtures verlangt sie (`safetyBriefingRequired`,
     * 3.1), und ohne sie sperrt P10 den Einsatzstart (Q21, 5.4.4). `false`
     * lässt sie weg — die Lage, die diese Sperre prüft.
     */
    readonly mitUnterweisung?: boolean
  },
): Promise<string> {
  const ersterTag = eigenes.actualStartDate ?? eigenes.plannedStartDate
  const einsatz = await prisma.assignment.create({
    data: {
      createdAt:
        eigenes.angelegtAm ??
        (ersterTag < eigenes.plannedStartDate ? ersterTag : eigenes.plannedStartDate),
      tenantId: welt.betreiberMandant,
      assignmentNumber: eigenes.nummer,
      customerId: welt.kunde,
      siteId: welt.standort,
      costCenterId: welt.kostenstelle,
      supplierId: eigenes.lieferant ?? welt.lieferant,
      candidateId: eigenes.kandidat ?? welt.kandidat,
      workerIdentityId:
        eigenes.mitPersonenidentitaet === false ? null : welt.personenidentitaet,
      activityDescription: 'Montage von Baugruppen an der Linie 2',
      plannedStartDate: eigenes.plannedStartDate,
      plannedEndDate: eigenes.plannedEndDate ?? null,
      actualStartDate: eigenes.actualStartDate ?? null,
      actualEndDate: eigenes.actualEndDate ?? null,
      weeklyHours: '35.00',
      comparableWage: eigenes.vergleichsentgelt ?? null,
      comparableWageCurrency: eigenes.vergleichsentgelt === undefined ? null : 'EUR',
      agreedRateCardItemId: eigenes.einkaufsposition ?? welt.einkaufsposition,
      customerRateCardItemId: welt.verkaufsposition,
      status: eigenes.status,
    },
  })

  if (eigenes.mitUnterweisung !== false) {
    await legeNachweisAn(welt, {
      nummer: `UW-${eigenes.nummer}`,
      art: 'safetyBriefing',
      bezug: { art: 'assignment', id: einsatz.id },
      // Die Unterweisung gilt ab dem ersten Überlassungstag; sie **vor** dem
      // Einsatz zu datieren wäre genauso synthetisch, aber weniger wahr.
      gueltigVon: ersterTag,
    })
  }

  return einsatz.id
}

/**
 * Eine freigegebene Bedarfsanfrage (SPEC 3.4, Statusmodell 4.1). Sie ist der
 * Ausgangspunkt der Ausschreibung und damit von Q04 und Q06.
 */
export async function legeBedarfsanfrageAn(
  welt: Welt,
  eigenes: {
    readonly nummer: string
    readonly status?: 'draft' | 'submitted' | 'approved' | 'tendered'
    readonly startDate: Date
    readonly endDate?: Date | null
  },
): Promise<string> {
  const anfrage = await prisma.demandRequest.create({
    data: {
      tenantId: welt.kundenMandant,
      requestNumber: eigenes.nummer,
      customerId: welt.kunde,
      siteId: welt.standort,
      costCenterId: welt.kostenstelle,
      title: 'Montage Linie 2',
      activityDescription:
        'Montage von Baugruppen an der Linie 2, Zweischichtbetrieb, Werk Süd',
      startDate: eigenes.startDate,
      endDate: eigenes.endDate ?? null,
      weeklyHours: '35.00',
      headcount: 1,
      status: eigenes.status ?? 'approved',
      requestedById: welt.genehmiger,
      approvedById: (eigenes.status ?? 'approved') === 'draft' ? null : welt.genehmiger,
      approvedAt: (eigenes.status ?? 'approved') === 'draft' ? null : tag('2025-12-01'),
      qualificationRequirements: {
        create: [{ qualification: 'Montageerfahrung', requirementKind: 'mandatory' }],
      },
    },
  })
  return anfrage.id
}

/** Nachweisarten aus 3.10, soweit die Tests sie brauchen. */
export type Nachweisart =
  | 'permitCertificate'
  | 'safetyBriefing'
  | 'qualificationCertificate'
  | 'workPermit'
  | 'clearanceCertificate'
  | 'agreementDocument'
  | 'other'

/**
 * Ein Dokument nach SPEC 3.10. Der Mandant folgt dem Bezugsobjekt; die
 * Invarianten aus 3.10 prüft `lib/masterdata/invariants.ts`, und dieser Helfer
 * ruft sie auf — ein Fixture, das sie verletzt, soll beim Anlegen auffallen und
 * nicht erst in einem Rechenergebnis.
 */
export async function legeNachweisAn(
  welt: Welt,
  eigenes: {
    readonly nummer: string
    readonly art: Nachweisart
    readonly bezug:
      | { readonly art: 'supplier' | 'candidate' | 'assignment' | 'site'; readonly id: string }
    readonly gueltigVon?: Date | null
    readonly gueltigBis?: Date | null
    readonly anerkennung?: 'submitted' | 'accepted' | 'rejected'
    /** Leer lassen heißt: Nachweis ohne hinterlegte Datei (5.4.5). */
    readonly ablage?: string
  },
): Promise<string> {
  const anerkennung = eigenes.anerkennung ?? 'accepted'
  const felder = {
    documentCategory: eigenes.art,
    subjectType: eigenes.bezug.art,
    supplierId: eigenes.bezug.art === 'supplier' ? eigenes.bezug.id : null,
    customerId: null,
    candidateId: eigenes.bezug.art === 'candidate' ? eigenes.bezug.id : null,
    assignmentId: eigenes.bezug.art === 'assignment' ? eigenes.bezug.id : null,
    siteId: eigenes.bezug.art === 'site' ? eigenes.bezug.id : null,
    masterAgreementId: null,
    fileRef: eigenes.ablage ?? `ablage://synthetisch/${eigenes.nummer}`,
    fileName: `${eigenes.nummer}.pdf`,
    mimeType: 'application/pdf',
    verificationStatus: anerkennung,
    verifiedAt: anerkennung === 'accepted' ? tag('2025-12-01') : null,
    verifiedById: anerkennung === 'accepted' ? welt.administrator : null,
    rejectionReason: anerkennung === 'rejected' ? 'synthetischer Testfall' : null,
    validFrom: eigenes.gueltigVon ?? null,
    validTo: eigenes.gueltigBis ?? null,
  } as const

  // Eine leere Ablage ist eine **zulässige** Testlage (5.4.5 rechnet sie als
  // Datenfehler), aber keine zulässige Zeile nach 3.10. Dann wird die Invariante
  // bewusst übergangen und der Fall im Test benannt.
  if ((eigenes.ablage ?? 'x') !== '') pruefeDokumentOderWirf(felder, eigenes.nummer)

  const dokument = await prisma.document.create({
    data: {
      tenantId: welt.betreiberMandant,
      documentNumber: `DOK-${eigenes.nummer}`,
      ...felder,
      uploadedAt: tag('2025-11-30'),
      uploadedById: welt.administrator,
      confidentiality: 'operatorAndOwner',
    },
  })
  return dokument.id
}

/** Eine Tarifzuordnung (SPEC 3.3) — die Grenze aus 5.1.2, die Frist aus 5.2.2. */
export async function legeTarifzuordnungAn(
  welt: Welt,
  eigenes: {
    readonly ebene: 'site' | 'customer' | 'supplier'
    readonly monate: number | null
    readonly validFrom: Date
    readonly validTo?: Date | null
    /** `equalPayDeadlineMonths` (5.2.2); leer = gesetzliche Regelfrist. */
    readonly equalPayMonate?: number | null
    /** `industryPremiumScheme` (5.2.5). */
    readonly zuschlagsschema?: string | null
  },
): Promise<void> {
  await prisma.collectiveAgreementAssignment.create({
    data: {
      tenantId: welt.betreiberMandant,
      collectiveAgreement: 'Beispieltarif',
      appliesToType: eigenes.ebene,
      siteId: eigenes.ebene === 'site' ? welt.standort : null,
      customerId: eigenes.ebene === 'customer' ? welt.kunde : null,
      supplierId: eigenes.ebene === 'supplier' ? welt.lieferant : null,
      validFrom: eigenes.validFrom,
      validTo: eigenes.validTo ?? null,
      maxAssignmentDurationMonths: eigenes.monate,
      equalPayDeadlineMonths: eigenes.equalPayMonate ?? null,
      industryPremiumScheme: eigenes.zuschlagsschema ?? null,
    },
  })
}

/**
 * Entfernt die Tarifzuordnungen der Verleiherseite — die Datenlage aus 5.2.2
 * Fall 1. Sie ist ein **Datenfehler** (3.2 macht die Zuordnung ab `active` zur
 * Pflicht), und ihre Folge ist die strengste des Kapitels: Equal Pay ab dem
 * ersten Überlassungstag.
 */
export async function entferneVerleiherzuordnungen(): Promise<void> {
  await prisma.collectiveAgreementAssignment.deleteMany({
    where: { appliesToType: 'supplier' },
  })
}
