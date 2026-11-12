/**
 * Invarianten der Stammdaten, die **Prisma nicht erzwingen kann**.
 *
 * „Genau einer von mehreren Verweisen ist gesetzt" und „dieses Feld ist Pflicht,
 * **wenn** jenes einen bestimmten Wert hat" sind Bedingungen über mehrere
 * Spalten. Eine Datenbank kann das als Check-Constraint, Prisma als Schema
 * nicht — deshalb steht die Prüfung hier, und das Schema verweist an den
 * betroffenen Feldern hierher.
 *
 * **Diese Funktionen rechnen, sie laden nicht.** Sie nehmen die Felder, die
 * geschrieben werden sollen, und geben die Verletzungen zurück. Wer schreibt,
 * ruft sie vorher auf.
 *
 * **Stand:** abgedeckt sind die Invarianten des **Dokuments** (SPEC 3.10) und
 * die fünf, auf die das Schema sonst hierher verweist — Ansprechpartner (3.1,
 * 3.2), Lieferant (3.2), AÜG-Erlaubnis (3.2), Rahmenvertrag (3.3) und
 * Preisposition (3.3). Bis zur Arbeitseinheit zu 5.4.3 standen die letzten vier
 * teils inline in `lib/services/masterData.ts` und teils nirgends; jetzt stehen
 * sie hier, und `masterData.ts` ruft sie auf.
 *
 * **Wer sie aufruft.** `pruefeErlaubnis` ruft `createSupplierPermit` auf. Für
 * `pruefeAnsprechpartner`, `pruefeLieferant`, `pruefeRahmenvertrag` und
 * `pruefePreisposition` gibt es heute **keinen** Schreibweg mit freier Eingabe:
 * der Ansprechpartner entsteht nur zusammen mit seinem Eigentümer, der Status
 * `active` des Lieferanten kommt erst mit dem Statusmodell 4.6, und
 * Rahmenvertrag und Preisposition legt bisher nur der Seed an. Die Funktionen
 * stehen trotzdem hier und sind geprüft: sie sind die Fundstelle, auf die das
 * Schema zeigt, und der Aufruf kommt mit dem Schreibweg — nicht umgekehrt.
 *
 * Eine Abweichung bleibt und ist benannt: 3.2 macht die **Urkunde** am
 * Erlaubnissatz zur Pflicht (`documentRef`), das Schema führt den Verweis aber
 * weiter als optional. Das ist eine Spalte, die Prisma ausdrücken *könnte* —
 * die Nachbesserung ist eine Migration und gehört nicht in diese Datei. P9
 * rechnet einen Satz ohne Urkunde schon heute als nicht deckungsfähig (5.4.1).
 */

/** Nachweisart (`documentCategory`, SPEC 3.10). */
export type Nachweisart =
  | 'permitCertificate'
  | 'safetyBriefing'
  | 'qualificationCertificate'
  | 'workPermit'
  | 'clearanceCertificate'
  | 'agreementDocument'
  | 'other'

/** Art des Bezugsobjekts (`subjectType`, SPEC 3.10). */
export type Bezugsobjektart =
  | 'supplier'
  | 'customer'
  | 'candidate'
  | 'assignment'
  | 'site'
  | 'masterAgreement'

/** Anerkennungsstatus (`verificationStatus`, SPEC 3.10, Fluss in 5.4.3). */
export type Anerkennung = 'submitted' | 'accepted' | 'rejected'

/** Sichtbarkeitsklasse (`confidentiality`, SPEC 3.10). */
export type Sichtbarkeitsklasse = 'operatorOnly' | 'operatorAndOwner' | 'assignmentParties'

/** Die Felder eines Dokuments, soweit die Invarianten sie brauchen. */
export interface Dokumentfelder {
  readonly documentCategory: Nachweisart
  readonly subjectType: Bezugsobjektart
  readonly supplierId: string | null
  readonly customerId: string | null
  readonly candidateId: string | null
  readonly assignmentId: string | null
  readonly siteId: string | null
  readonly masterAgreementId: string | null
  readonly fileRef: string
  readonly fileName: string
  readonly mimeType: string
  readonly verificationStatus: Anerkennung
  readonly verifiedAt: Date | null
  readonly verifiedById: string | null
  readonly rejectionReason: string | null
  readonly validFrom: Date | null
  readonly validTo: Date | null
  readonly confidentiality: Sichtbarkeitsklasse
}

/** Eine verletzte Invariante — mit Feld und Fundstelle, nicht nur mit Text. */
export interface Verletzung {
  readonly feld: string
  readonly grund: string
  readonly specReference: string
}

/** Der Verweis, der zu einer Bezugsobjektart gehört (SPEC 3.10). */
const VERWEIS: Readonly<Record<Bezugsobjektart, keyof Dokumentfelder>> = {
  supplier: 'supplierId',
  customer: 'customerId',
  candidate: 'candidateId',
  assignment: 'assignmentId',
  site: 'siteId',
  masterAgreement: 'masterAgreementId',
}

/**
 * Prüft die Invarianten eines Dokuments (SPEC 3.10). Gibt **alle**
 * Verletzungen zurück, nicht die erste: wer Daten einstellt, soll sie in einem
 * Durchgang berichtigen können.
 */
export function pruefeDokument(felder: Dokumentfelder): readonly Verletzung[] {
  const verletzungen: Verletzung[] = []

  // 1. Genau **ein** Bezugsobjekt, und zwar das zur Art passende. Ein Dokument
  //    mit zwei Bezügen gehört zwei Mandanten — und der Mandant folgt nach 3.10
  //    dem Bezugsobjekt. Zwei Bezüge heißt: keine bestimmbare Sichtbarkeit.
  const gesetzte = (Object.keys(VERWEIS) as Bezugsobjektart[]).filter(
    (art) => felder[VERWEIS[art]] !== null,
  )
  const erwartet = felder.subjectType
  if (!gesetzte.includes(erwartet)) {
    verletzungen.push({
      feld: VERWEIS[erwartet],
      grund:
        `\`subjectType\` ist „${erwartet}", aber \`${VERWEIS[erwartet]}\` ist nicht gesetzt. ` +
        'Das Bezugsobjekt ist nach 3.10 Pflicht und bestimmt den Mandanten des Dokuments.',
      specReference: 'SPEC 3.10, subjectRef',
    })
  }
  const ueberzaehlig = gesetzte.filter((art) => art !== erwartet)
  if (ueberzaehlig.length > 0) {
    verletzungen.push({
      feld: ueberzaehlig.map((art) => VERWEIS[art]).join(', '),
      grund:
        `Neben dem Bezug „${erwartet}" ${ueberzaehlig.length === 1 ? 'ist' : 'sind'} auch ` +
        `${ueberzaehlig.map((art) => `\`${VERWEIS[art]}\``).join(', ')} gesetzt. 3.10 lässt ` +
        '**genau einen** Verweis zu; der Mandant des Dokuments folgt ihm.',
      specReference: 'SPEC 3.10, subjectRef',
    })
  }

  // 2. Die Ablageangaben sind Pflicht (3.10). Ein Nachweis ohne Datei ist nach
  //    5.4.5 ein Datenfehler — und P9 wie P10 rechnen ihn als solchen.
  for (const feld of ['fileRef', 'fileName', 'mimeType'] as const) {
    if (felder[feld].trim() === '') {
      verletzungen.push({
        feld,
        grund:
          `\`${feld}\` ist in 3.10 Pflicht. Ein Nachweis ohne hinterlegte Datei ist ein ` +
          'Datenfehler und wirkt in 5.4 wie ein fehlender Nachweis.',
        specReference: 'SPEC 3.10; 5.4.5',
      })
    }
  }

  // 3. Die Anerkennung trägt ihre Belege (3.10, Fluss 5.4.3).
  if (felder.verificationStatus === 'accepted') {
    if (felder.verifiedAt === null || felder.verifiedById === null) {
      verletzungen.push({
        feld: 'verifiedAt, verifiedBy',
        grund:
          'Bei `accepted` sind Zeitpunkt und Person der Anerkennung Pflicht (3.10). Die ' +
          'Anerkennung ist eine Handlung des Betreibers ([34]) und muss zurechenbar sein.',
        specReference: 'SPEC 3.10, verifiedAt / verifiedBy',
      })
    }
  }
  if (felder.verificationStatus === 'rejected' && (felder.rejectionReason ?? '').trim() === '') {
    verletzungen.push({
      feld: 'rejectionReason',
      grund:
        'Bei `rejected` ist der Zurückweisungsgrund Pflicht (3.10): der Einsteller muss ' +
        'wissen, was nachzubessern ist.',
      specReference: 'SPEC 3.10, rejectionReason',
    })
  }

  // 4. Ein Gültigkeitszeitraum, der rückwärts läuft, ist keiner.
  if (
    felder.validFrom !== null &&
    felder.validTo !== null &&
    felder.validTo.getTime() < felder.validFrom.getTime()
  ) {
    verletzungen.push({
      feld: 'validTo',
      grund: '`validTo` liegt vor `validFrom`.',
      specReference: 'SPEC 3.10, validFrom / validTo',
    })
  }

  // 5. Die Erlaubnisurkunde gehört an den Lieferanten. 3.10 führt die Beziehung
  //    „1 Erlaubnisurkunde : 1 AÜG-Erlaubnis (3.2)" — und die Erlaubnis hängt am
  //    Lieferanten, nicht am Einsatz oder am Kandidaten.
  if (felder.documentCategory === 'permitCertificate' && felder.subjectType !== 'supplier') {
    verletzungen.push({
      feld: 'subjectType',
      grund:
        'Eine Erlaubnisurkunde gehört zur AÜG-Erlaubnis und damit zum **Lieferanten** ' +
        `(3.2, 3.10); hier ist das Bezugsobjekt „${felder.subjectType}".`,
      specReference: 'SPEC 3.10, Beziehungen; 3.2',
    })
  }

  // 6. Eine **Vertragsunterlage des Lieferanten** ist für Kundenrollen nie
  //    einsatzbezogen. 3.10 sagt zur Sichtbarkeitsklasse ausdrücklich: „der
  //    Kunde sieht einsatzbezogene Nachweise, **nicht die Vertragsunterlagen
  //    des Lieferanten**" — und 2.2 trägt dieselbe Grenze in Fußnote [35].
  //    `assignmentParties` an einer Erlaubnisurkunde,
  //    Unbedenklichkeitsbescheinigung oder Vertragsunterlage widerspricht dem
  //    Satz, mit dem das Feld eingeführt ist.
  if (
    VERTRAGSUNTERLAGEN.includes(felder.documentCategory) &&
    felder.confidentiality === 'assignmentParties'
  ) {
    verletzungen.push({
      feld: 'confidentiality',
      grund:
        `Die Nachweisart „${felder.documentCategory}" ist eine Vertragsunterlage des ` +
        'Lieferanten; 3.10 und Fußnote [35] stellen sie der einsatzbezogenen Sichtbarkeit ' +
        'ausdrücklich entgegen. `assignmentParties` ist hier nicht zulässig.',
      specReference: 'SPEC 3.10, confidentiality; 2.2, Fußnote [35]',
    })
  }

  return verletzungen
}

/**
 * Nachweisarten, die 3.10 als Vertragsunterlagen bzw. Lieferantennachweise von
 * den einsatzbezogenen Nachweisen abgrenzt (dieselbe Liste wie in
 * `lib/authz/footnotes.ts` zu [35] — dort als Sichtbarkeitsregel, hier als
 * Invariante der Daten).
 */
const VERTRAGSUNTERLAGEN: readonly Nachweisart[] = [
  'permitCertificate',
  'clearanceCertificate',
  'agreementDocument',
]

/** Wirft, wenn ein Dokument eine Invariante aus 3.10 verletzt. */
export class DokumentInvarianteError extends Error {}

export function pruefeDokumentOderWirf(felder: Dokumentfelder, bezeichnung: string): void {
  const verletzungen = pruefeDokument(felder)
  if (verletzungen.length === 0) return
  throw new DokumentInvarianteError(
    `Dokument „${bezeichnung}" verletzt SPEC 3.10:\n` +
      verletzungen
        .map((eintrag) => `  - ${eintrag.feld}: ${eintrag.grund} (${eintrag.specReference})`)
        .join('\n'),
  )
}

/* ------------------------------------------------------------------ */
/* Die übrigen Invarianten, auf die das Schema verweist                */
/* ------------------------------------------------------------------ */

/**
 * Ansprechpartner (SPEC 3.1, 3.2): **genau einer** der drei Verweise ist
 * gesetzt. Das Unterobjekt hat keinen eigenen Mandanten — es gehört dem
 * Mandanten seines Eigentümers, und zwei Eigentümer hätte es nicht geben
 * können.
 */
export function pruefeAnsprechpartner(felder: {
  readonly customerId: string | null
  readonly siteId: string | null
  readonly supplierId: string | null
}): readonly Verletzung[] {
  const gesetzte = (['customerId', 'siteId', 'supplierId'] as const).filter(
    (feld) => felder[feld] !== null,
  )
  if (gesetzte.length === 1) return []
  return [
    {
      feld: gesetzte.length === 0 ? 'customerId, siteId, supplierId' : gesetzte.join(', '),
      grund:
        gesetzte.length === 0
          ? 'Der Ansprechpartner gehört zu einem Kunden, einem Standort oder einem Lieferanten ' +
            '(3.1, 3.2); ohne Eigentümer hat er keinen Mandanten.'
          : '3.1 und 3.2 lassen **genau einen** Eigentümer zu; hier sind mehrere gesetzt.',
      specReference: 'SPEC 3.1, 3.2, Ansprechpartner',
    },
  ]
}

/**
 * Lieferant (SPEC 3.2): die **Tarifbindung des Verleihers** ist „Pflicht ab
 * Status `active`". Sie ist die Grundlage für die Abweichung vom
 * Gleichstellungsgrundsatz (5.2) — ein aktiver Verleiher ohne Tarifbindung
 * führt dazu, dass 5.2 die gesetzliche Regelfrist rechnet, ohne es zu merken.
 */
export function pruefeLieferant(felder: {
  readonly status: string
  readonly supplierCollectiveAgreementId: string | null
}): readonly Verletzung[] {
  if (felder.status !== 'active' || felder.supplierCollectiveAgreementId !== null) return []
  return [
    {
      feld: 'supplierCollectiveAgreementId',
      grund:
        'Die Tarifbindung des Verleihers ist ab Status `active` Pflicht (3.2). Ohne sie fehlt ' +
        'die Grundlage für jede Abweichung vom Gleichstellungsgrundsatz (5.2).',
      specReference: 'SPEC 3.2, supplierCollectiveAgreement',
    },
  ]
}

/**
 * AÜG-Erlaubnis (SPEC 3.2): `validTo` ist „Pflicht bei `fixedTerm`, leer bei
 * `unlimited`" — und die Anerkennung trägt ihre Belege, wie beim Dokument.
 *
 * 5.4.6 nennt den ersten Fall ausdrücklich einen **Datenfehler**: „der Satz
 * deckt **nichts**". Die Prüfung hier verhindert, dass er überhaupt entsteht.
 */
export function pruefeErlaubnis(felder: {
  readonly permitType: string
  readonly validFrom: Date | null
  readonly validTo: Date | null
  readonly verificationStatus: Anerkennung
  readonly verifiedAt: Date | null
  readonly verifiedById: string | null
  readonly rejectionReason: string | null
}): readonly Verletzung[] {
  const verletzungen: Verletzung[] = []
  if (felder.permitType === 'fixedTerm' && felder.validTo === null) {
    verletzungen.push({
      feld: 'validTo',
      grund:
        'Eine befristete Erlaubnis braucht ein Ende (3.2). Ein Satz ohne `validTo` ist nach ' +
        '5.4.6 ein Datenfehler und deckt **nichts**.',
      specReference: 'SPEC 3.2, validTo; 5.4.6',
    })
  }
  if (felder.permitType === 'unlimited' && felder.validTo !== null) {
    verletzungen.push({
      feld: 'validTo',
      grund: 'Eine unbefristete Erlaubnis hat kein Ende (3.2).',
      specReference: 'SPEC 3.2, validTo',
    })
  }
  if (
    felder.validFrom !== null &&
    felder.validTo !== null &&
    felder.validTo.getTime() < felder.validFrom.getTime()
  ) {
    verletzungen.push({
      feld: 'validTo',
      grund: '`validTo` liegt vor `validFrom`.',
      specReference: 'SPEC 3.2, validFrom / validTo',
    })
  }
  if (
    felder.verificationStatus === 'accepted' &&
    (felder.verifiedAt === null || felder.verifiedById === null)
  ) {
    verletzungen.push({
      feld: 'verifiedAt, verifiedBy',
      grund: 'Bei `accepted` sind Zeitpunkt und Person der Anerkennung Pflicht (3.2, [34]).',
      specReference: 'SPEC 3.2, verifiedAt / verifiedBy',
    })
  }
  if (
    felder.verificationStatus === 'rejected' &&
    (felder.rejectionReason ?? '').trim() === ''
  ) {
    verletzungen.push({
      feld: 'rejectionReason',
      grund: 'Bei `rejected` ist der Zurückweisungsgrund Pflicht (3.2).',
      specReference: 'SPEC 3.2, rejectionReason',
    })
  }
  return verletzungen
}

/**
 * Rahmenvertrag (SPEC 3.3): **genau eine** Gegenpartei, und zwar die zur
 * Vertragsart passende. Der Prototyp kennt nur zwei Vertragsstrecken —
 * Betreiber ↔ Kunde und Betreiber ↔ Lieferant; ein Direktvertrag zwischen Kunde
 * und Lieferant ist „nicht vorgesehen" (3.3).
 */
export function pruefeRahmenvertrag(felder: {
  readonly agreementType: string
  readonly customerId: string | null
  readonly supplierId: string | null
}): readonly Verletzung[] {
  const erwartet = felder.agreementType === 'customerAgreement' ? 'customerId' : 'supplierId'
  const andere = erwartet === 'customerId' ? 'supplierId' : 'customerId'
  const verletzungen: Verletzung[] = []
  if (felder[erwartet] === null) {
    verletzungen.push({
      feld: erwartet,
      grund:
        `Die Vertragsart „${felder.agreementType}" verlangt \`${erwartet}\` als Gegenpartei ` +
        '(3.3); sie bestimmt auch die Sichtbarkeit ([40] in 2.2).',
      specReference: 'SPEC 3.3, counterpartyRef',
    })
  }
  if (felder[andere] !== null) {
    verletzungen.push({
      feld: andere,
      grund:
        '3.3 lässt **genau eine** Gegenpartei zu. Ein Vertrag mit Kunde **und** Lieferant wäre ' +
        'der Direktvertrag, den 3.3 ausdrücklich nicht vorsieht.',
      specReference: 'SPEC 3.3, Abgrenzung',
    })
  }
  return verletzungen
}

/**
 * Preisposition (SPEC 3.3): die Pflichtfelder hängen an `itemType`. Ein
 * Grundsatz braucht Qualifikationsstufe und Verrechnungssatz, ein Zuschlagssatz
 * die Zuschlagsart und den Zuschlagswert.
 */
export function pruefePreisposition(felder: {
  readonly itemType: string
  readonly qualificationLevel: string | null
  readonly hourlyRate: unknown
  readonly premiumTypeId: string | null
  readonly premiumValue: unknown
}): readonly Verletzung[] {
  const verletzungen: Verletzung[] = []
  if (felder.itemType === 'baseRate') {
    if ((felder.qualificationLevel ?? '').trim() === '') {
      verletzungen.push({
        feld: 'qualificationLevel',
        grund: 'Die Qualifikationsstufe ist bei `baseRate` Pflicht (3.3).',
        specReference: 'SPEC 3.3, Preisposition',
      })
    }
    if (felder.hourlyRate === null || felder.hourlyRate === undefined) {
      verletzungen.push({
        feld: 'hourlyRate',
        grund: 'Der Verrechnungssatz ist bei `baseRate` Pflicht (3.3).',
        specReference: 'SPEC 3.3, Preisposition',
      })
    }
  }
  if (felder.itemType === 'premiumRate') {
    if (felder.premiumTypeId === null) {
      verletzungen.push({
        feld: 'premiumTypeId',
        grund: 'Die Zuschlagsart ist bei `premiumRate` Pflicht (3.3, Verweis auf 3.8).',
        specReference: 'SPEC 3.3, Preisposition',
      })
    }
    if (felder.premiumValue === null || felder.premiumValue === undefined) {
      verletzungen.push({
        feld: 'premiumValue',
        grund: 'Der Zuschlagswert ist bei `premiumRate` Pflicht (3.3).',
        specReference: 'SPEC 3.3, Preisposition',
      })
    }
  }
  return verletzungen
}

/**
 * Abrechnungsbeleg (SPEC 3.9): drei Bedingungen, die Prisma nicht erzwingen
 * kann, weil jede **zwei** Spalten betrifft.
 *
 *  - Die **Seite folgt der Belegart**: `customerInvoice` ist Verkauf,
 *    `supplierCreditNote` und `supplierInvoice` sind Einkauf. Ein
 *    Verkaufsbeleg mit einer Lieferantenbelegart wäre ein Beleg, dessen
 *    Gegenseite nicht feststeht — und daran hängen die Sichtbarkeit (2.3) und
 *    die Fußnoten [31] und [32].
 *  - **Kunde bei `sales`, Lieferant bei `purchase`** — und jeweils **nicht**
 *    die andere Seite: ein Beleg hat genau eine Gegenpartei.
 *  - Der **Steuersatz** ist Pflicht (*offene Frage 52*): er ist eine Angabe am
 *    Beleg, weil kein Kapitel sagt, woher er kommt.
 */
export function pruefeAbrechnungsbeleg(felder: {
  readonly documentType: string
  readonly direction: string
  readonly customerId: string | null
  readonly supplierId: string | null
  readonly taxRate: unknown
}): readonly Verletzung[] {
  const verletzungen: Verletzung[] = []
  const erwartet = felder.documentType === 'customerInvoice' ? 'sales' : 'purchase'
  if (felder.direction !== erwartet) {
    verletzungen.push({
      feld: 'direction',
      grund: `Die Seite folgt der Belegart (3.9): \`${felder.documentType}\` ist \`${erwartet}\`.`,
      specReference: 'SPEC 3.9, Beleg',
    })
  }
  if (felder.direction === 'sales') {
    if (felder.customerId === null) {
      verletzungen.push({
        feld: 'customerId',
        grund: 'Der Kunde ist bei `sales` Pflicht (3.9).',
        specReference: 'SPEC 3.9, Beleg',
      })
    }
    if (felder.supplierId !== null) {
      verletzungen.push({
        feld: 'supplierId',
        grund: 'Ein Verkaufsbeleg nennt keinen Lieferanten — ein Beleg hat eine Gegenpartei (3.9).',
        specReference: 'SPEC 3.9, Beleg',
      })
    }
  }
  if (felder.direction === 'purchase') {
    if (felder.supplierId === null) {
      verletzungen.push({
        feld: 'supplierId',
        grund: 'Der Lieferant ist bei `purchase` Pflicht (3.9).',
        specReference: 'SPEC 3.9, Beleg',
      })
    }
    if (felder.customerId !== null) {
      verletzungen.push({
        feld: 'customerId',
        grund: 'Ein Einkaufsbeleg nennt keinen Kunden — ein Beleg hat eine Gegenpartei (3.9).',
        specReference: 'SPEC 3.9, Beleg',
      })
    }
  }
  if (felder.taxRate === null || felder.taxRate === undefined) {
    verletzungen.push({
      feld: 'taxRate',
      grund:
        'Der Steuersatz ist Pflicht (3.9); woher er kommt, ist offene Frage 52 — ein Festwert ' +
        'im Programm wäre eine Zahl ohne Fundstelle.',
      specReference: 'SPEC 3.9, Beleg',
    })
  }
  return verletzungen
}

/** Wirft, wenn eine der Invarianten oben verletzt ist. */
export class StammdatenInvarianteError extends Error {}

export function wirfBeiVerletzung(
  verletzungen: readonly Verletzung[],
  bezeichnung: string,
): void {
  if (verletzungen.length === 0) return
  throw new StammdatenInvarianteError(
    `${bezeichnung} verletzt die Spezifikation:\n` +
      verletzungen
        .map((eintrag) => `  - ${eintrag.feld}: ${eintrag.grund} (${eintrag.specReference})`)
        .join('\n'),
  )
}

/* ------------------------------------------------------------------ */
/* Zeitposition (SPEC 3.8) — die vier Invarianten                      */
/* ------------------------------------------------------------------ */

/**
 * Die Felder einer Zeitposition, soweit die Invarianten sie brauchen (3.8).
 *
 * Uhrzeiten als **Minuten seit Mitternacht**: ein Dienstbeginn ist eine
 * Uhrzeit, kein Zeitpunkt, und eine Zeitzone hätte an ihm nichts zu suchen.
 */
export interface Zeitpositionsfelder {
  readonly workDate: Date
  readonly startMinute: number | null
  readonly endMinute: number | null
  readonly breakMinutes: number | null
  readonly hours: number
}

/** Tagessumme oder Abschnitt? Abgeleitet, keine Spalte (3.8, `entryForm`). */
export type Erfassungsform = 'dayTotal' | 'interval'

export function erfassungsform(felder: {
  readonly startMinute: number | null
  readonly endMinute: number | null
}): Erfassungsform {
  return felder.startMinute !== null && felder.endMinute !== null ? 'interval' : 'dayTotal'
}

/**
 * Die Dauer eines Abschnitts in Minuten, Pause abgezogen (3.8).
 *
 * `endMinute` kleiner als `startMinute` heißt Überschreitung von Mitternacht —
 * der Abschnitt gehört dem Tag seines **Beginns**, und die Dauer läuft über
 * den Tageswechsel hinweg. Ohne diesen Fall wäre eine Nachtschicht nicht
 * erfassbar.
 */
export function abschnittsdauerInMinuten(felder: {
  readonly startMinute: number
  readonly endMinute: number
  readonly breakMinutes: number | null
}): number {
  const brutto =
    felder.endMinute > felder.startMinute
      ? felder.endMinute - felder.startMinute
      : MINUTEN_JE_TAG - felder.startMinute + felder.endMinute
  return brutto - (felder.breakMinutes ?? 0)
}

export const MINUTEN_JE_TAG = 24 * 60

/** Toleranz beim Vergleich von Stunden: eine Sekunde, in Stunden. */
const STUNDEN_TOLERANZ = 1 / 3600

/**
 * Die Invarianten **einer** Zeitposition (3.8, Nummern 1 bis 3).
 *
 * Die vierte — zwei Abschnitte desselben Tages überlappen nicht — betrifft
 * eine **Menge** von Positionen und steht in `pruefeZeitpositionen`.
 */
export function pruefeZeitposition(felder: Zeitpositionsfelder): readonly Verletzung[] {
  const verletzungen: Verletzung[] = []

  // 1. Beide oder keines. Eine halbe Uhrzeit ist keine Erfassungsform.
  const halb =
    (felder.startMinute === null) !== (felder.endMinute === null)
  if (halb) {
    verletzungen.push({
      feld: 'startTime/endTime',
      grund: 'Beginn und Ende sind beide gesetzt oder beide leer (Invariante 1).',
      specReference: 'SPEC 3.8, Zeitposition',
    })
  }

  const form = erfassungsform(felder)

  for (const [feld, wert] of [
    ['startTime', felder.startMinute],
    ['endTime', felder.endMinute],
  ] as const) {
    if (wert !== null && (wert < 0 || wert >= MINUTEN_JE_TAG)) {
      verletzungen.push({
        feld,
        grund: 'Eine Uhrzeit liegt zwischen 00:00 und 23:59.',
        specReference: 'SPEC 3.8, Zeitposition',
      })
    }
  }

  // 2. Pause nur bei abschnittsweiser Erfassung — an einer Tagessumme wäre sie
  //    doppelt abgezogen.
  if (form === 'dayTotal' && felder.breakMinutes !== null) {
    verletzungen.push({
      feld: 'breakMinutes',
      grund:
        'Eine Pause gehört zu einem Abschnitt; an einer Tagessumme ist sie schon abgezogen ' +
        '(Invariante 2).',
      specReference: 'SPEC 3.8, Zeitposition',
    })
  }
  if (felder.breakMinutes !== null && felder.breakMinutes < 0) {
    verletzungen.push({
      feld: 'breakMinutes',
      grund: 'Eine Pause ist nicht negativ.',
      specReference: 'SPEC 3.8, Zeitposition',
    })
  }

  // 3. Bei einem Abschnitt ist `hours` die Dauer. Zwei Quellen für dieselbe
  //    Menge, die auseinanderlaufen können, sind ein Fehler und keine
  //    Wahlfreiheit.
  if (form === 'interval' && !halb && felder.startMinute !== null && felder.endMinute !== null) {
    const dauer = abschnittsdauerInMinuten({
      startMinute: felder.startMinute,
      endMinute: felder.endMinute,
      breakMinutes: felder.breakMinutes,
    })
    if (dauer <= 0) {
      verletzungen.push({
        feld: 'hours',
        grund: 'Die Pause ist so lang wie der Abschnitt oder länger — es bleibt keine Arbeitszeit.',
        specReference: 'SPEC 3.8, Zeitposition',
      })
    } else if (Math.abs(dauer / 60 - felder.hours) > STUNDEN_TOLERANZ) {
      verletzungen.push({
        feld: 'hours',
        grund:
          `Bei abschnittsweiser Erfassung ist die Menge die Dauer: ${(dauer / 60).toFixed(4)} ` +
          `statt ${felder.hours} Stunden (Invariante 3). Gerundet wird bis zur Antwort auf ` +
          'offene Frage 48 nicht.',
        specReference: 'SPEC 3.8, Zeitposition',
      })
    }
  }

  // Nur produktive Zeiten (Entscheidung zu Frage 21): eine Position ohne
  // Stunden ist kein Nachweis einer Abwesenheit, sondern keine Position.
  if (!(felder.hours > 0)) {
    verletzungen.push({
      feld: 'hours',
      grund:
        'Erfasst werden ausschließlich produktive Zeiten; eine Position ohne Stunden gibt es ' +
        'nicht (3.8, Entscheidung zu offener Frage 21).',
      specReference: 'SPEC 3.8, Zeitposition',
    })
  }

  return verletzungen
}

/**
 * Die vierte Invariante (3.8): zwei **Abschnitte** desselben Tages überlappen
 * nicht. Mehrere Abschnitte sind erlaubt — geteilte Dienste gibt es —, dieselbe
 * Stunde zweimal nicht.
 *
 * Tagessummen bleiben außer Betracht: sie tragen keine Uhrzeit, und zwei
 * Tagessummen am selben Tag sind eine Frage der Summe, nicht der Überlappung.
 * Ein Abschnitt über Mitternacht wird auf der Zeitachse seines **Beginntags**
 * verglichen, deshalb kann er über 24:00 hinausreichen.
 */
export function pruefeZeitpositionen(
  positionen: readonly (Zeitpositionsfelder & { readonly id?: string })[],
): readonly Verletzung[] {
  const verletzungen: Verletzung[] = []
  const abschnitte = positionen
    .filter((position) => erfassungsform(position) === 'interval')
    .map((position) => {
      const start = position.startMinute ?? 0
      const ende = position.endMinute ?? 0
      return {
        tag: position.workDate.toISOString().slice(0, 10),
        von: start,
        bis: ende > start ? ende : ende + MINUTEN_JE_TAG,
      }
    })

  for (let i = 0; i < abschnitte.length; i += 1) {
    for (let j = i + 1; j < abschnitte.length; j += 1) {
      const a = abschnitte[i]
      const b = abschnitte[j]
      if (a === undefined || b === undefined || a.tag !== b.tag) continue
      if (a.von < b.bis && b.von < a.bis) {
        verletzungen.push({
          feld: 'startTime/endTime',
          grund:
            `Zwei Abschnitte am ${a.tag} überlappen sich (Invariante 4): dieselbe Stunde darf ` +
            'nicht zweimal abgerechnet werden.',
          specReference: 'SPEC 3.8, Zeitposition',
        })
      }
    }
  }
  return verletzungen
}

export function pruefeZeitpositionOderWirf(
  felder: Zeitpositionsfelder,
  bezeichnung: string,
): void {
  wirfBeiVerletzung(pruefeZeitposition(felder), `Zeitposition ${bezeichnung}`)
}
