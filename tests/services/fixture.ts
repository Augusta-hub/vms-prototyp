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
  },
): Promise<string> {
  const einsatz = await prisma.assignment.create({
    data: {
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
      agreedRateCardItemId: welt.einkaufsposition,
      customerRateCardItemId: welt.verkaufsposition,
      status: eigenes.status,
    },
  })
  return einsatz.id
}

/** Eine Tarifzuordnung (SPEC 3.3) — die Grenze aus 5.1.2. */
export async function legeTarifzuordnungAn(
  welt: Welt,
  eigenes: {
    readonly ebene: 'site' | 'customer' | 'supplier'
    readonly monate: number | null
    readonly validFrom: Date
    readonly validTo?: Date | null
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
    },
  })
}
