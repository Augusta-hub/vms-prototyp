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
 * **Stand:** abgedeckt sind die Invarianten des **Dokuments** (SPEC 3.10). Die
 * Verweise des Schemas an `customer`, `supplier`, `supplierPermit`,
 * `masterAgreement` und `rateCardItem` zeigen ebenfalls hierher, ihre Prüfungen
 * stehen aber bis heute inline in `lib/services/masterData.ts`. Das ist eine
 * Abweichung, die vor dieser Arbeitseinheit bestand; sie ist in PROGRESS.md
 * benannt und wird mit dem Dienst für Nachweise aufgelöst, nicht nebenbei.
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

  return verletzungen
}

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
