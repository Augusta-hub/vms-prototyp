/**
 * Nachweisfluss des Dokuments — SPEC **5.4.3**, Objekt `document` (3.10).
 *
 * **Warum dieses Modell hier steht, obwohl Kapitel 4 es nicht führt.** 3.10
 * sagt ausdrücklich: „Kapitel 4 führt **kein** Modell. Die Anerkennung
 * (`submitted` → `accepted` / `rejected`) gehört fachlich zu 5.4 und ist in
 * 5.4.3 mit Übergängen, Fristen und Sperrwirkung beschrieben." Die **Mechanik**
 * ist aber dieselbe wie bei den Modellen aus Kapitel 4: eine geschlossene
 * Übergangsmenge, auslösende Rollen, Vorbedingungen. Deshalb liegt der Fluss in
 * diesem Verzeichnis und nutzt `lib/status/machine.ts` — und trägt als
 * Fundstelle 5.4.3, nicht ein Kapitel 4, das ihn nicht nennt.
 *
 * Zustände: `submitted` → `accepted` oder `rejected`. Es gibt **keinen**
 * Zustand vor `submitted`: das Einstellen *ist* die Anlage („— → `submitted`").
 *
 * Nicht vorhanden — und damit nicht ausdrückbar:
 *
 *  - `accepted` → `submitted` und `rejected` → `submitted`. „Ein neuer oder
 *    berichtigter Nachweis ist ein **neues** Dokument" (5.4.3, 4.0 Regel 9);
 *    beim Erlaubnissatz führt 3.2 dafür `supersedesRef`.
 *  - ein Übergang durch **Ablauf der Gültigkeit**. Ein abgelaufener Nachweis
 *    bleibt `accepted` — „die Anerkennung bezieht sich auf das Schriftstück,
 *    nicht auf den Zeitraum" (5.4.3). Die Gültigkeit lesen P9 und P10 je
 *    Stichtag aus `validFrom` / `validTo`; Zeit entzieht hier nichts.
 *  - eine Anerkennung durch den **Einsteller**. Sie ist die Prüfhandlung des
 *    Betreibers ([34]) und unterliegt dem Vier-Augen-Prinzip gegenüber dem
 *    Einstellen, „auch wenn beide beim Betreiber liegen" (5.4.3). Das ist
 *    deshalb eine **Vorbedingung** und keine Frage der Rolle: `MA` darf beides,
 *    nur nicht an demselben Dokument.
 *
 * **Die Nebenwirkungen gehören nicht hierher.** 5.4.3 nennt je Übergang
 * Benachrichtigungen und — beim Anerkennen — das Neurechnen von P9 und P10. Das
 * vollzieht der Dienst (`lib/services/documents.ts`); diese Schicht prüft und
 * schreibt nichts (siehe `lib/status/machine.ts`).
 */
import type { Precondition, StatusModel, TransitionDefinition } from './machine'

/** Anerkennungsstatus (`verificationStatus`, 3.10; Fluss 5.4.3). */
export type DocumentState = 'submitted' | 'accepted' | 'rejected'

/** Nachweisart (`documentCategory`, 3.10). */
export type DocumentCategory =
  | 'permitCertificate'
  | 'safetyBriefing'
  | 'qualificationCertificate'
  | 'workPermit'
  | 'clearanceCertificate'
  | 'agreementDocument'
  | 'other'

/** Art des Bezugsobjekts (`subjectType`, 3.10). */
export type DocumentSubjectType =
  | 'supplier'
  | 'customer'
  | 'candidate'
  | 'assignment'
  | 'site'
  | 'masterAgreement'

/**
 * Die Tatsachen, die die Vorbedingungen aus 5.4.3 brauchen. Erhoben wird sie
 * vom Aufrufer (`lib/services/documents.ts`), nicht hier gelesen: dieses Modul
 * ist rein und ohne Datenbank prüfbar.
 */
export interface DocumentFacts {
  readonly documentCategory: DocumentCategory
  readonly subjectType: DocumentSubjectType
  /** Der **eine** gesetzte Verweis auf das Bezugsobjekt (3.10). */
  readonly subjectRef: string | null
  readonly fileRef: string
  readonly fileName: string
  readonly mimeType: string
  /**
   * Passt die Nachweisart zum Bezugsobjekt, wie der Pflichtkatalog in 5.4.4 es
   * führt? Gerechnet wird das aus dem Katalog, nicht hier aufgezählt — die
   * Angabe kommt aus `lib/aueg/regelwerk.ts`.
   */
  readonly categoryFitsSubject: boolean
  /** Einsteller des Dokuments (`uploadedBy`, 3.10) — trägt das Vier-Augen-Prinzip. */
  readonly uploadedById: string | null
  /** Die Person, die den Übergang auslöst. */
  readonly actingUserId: string
  /** `verifiedAt` / `verifiedBy`, Pflicht bei `accepted` (3.10). */
  readonly verifiedAt: Date | null
  readonly verifiedById: string | null
  /** Pflicht bei `rejected` (3.10). */
  readonly rejectionReason: string | null
  /**
   * Trägt der Nachweis ein Enddatum? Bei Arten **mit** Gültigkeitszeitraum
   * verlangt 5.4.3 „`validTo` ist gesetzt **oder bewusst leer**" — das ist
   * keine Sperre, sondern eine bewusste Angabe (siehe `validToDeliberatelyOpen`).
   */
  readonly validTo: Date | null
  /**
   * Hat der Anerkennende das fehlende Enddatum ausdrücklich als unbefristet
   * bestätigt? 5.4.3 lässt `validTo` leer, **wenn bewusst**; 5.4.4 ergänzt für
   * die sperrenden Arten eine **Information** an `MD`, keine Sperre. Diese
   * Angabe ist deshalb die bewusste Entscheidung, nicht ihre Wirkung.
   */
  readonly validToDeliberatelyOpen: boolean
}

type DocumentPrecondition = Precondition<DocumentFacts>
type DocumentTransition = TransitionDefinition<DocumentState, DocumentFacts>

const fourEyes: DocumentPrecondition = {
  description:
    'Anerkennung und Zurückweisung nicht durch den Einsteller selbst — Vier-Augen-Prinzip ' +
    'gegenüber dem Einstellen (5.4.3), auch wenn beide beim Betreiber liegen.',
  specReference: 'SPEC 5.4.3, keine Anerkennung durch den Einsteller; 2.4',
  isSatisfied: (facts) =>
    facts.uploadedById === null || facts.uploadedById !== facts.actingUserId,
}

const TRANSITIONS = {
  /**
   * | — | `submitted` | `LA`/`LD` (Lieferanten- und Kandidatennachweise), `MA`
   * (Vertragsunterlagen), `KB` ([35], einsatzbezogene Nachweise zum eigenen
   * Kunden) | `documentCategory`, `subjectType`, `subjectRef`, `fileRef`,
   * `fileName`, `mimeType` gesetzt (3.10) | `mandatory` und `blocking` werden
   * aus dem Katalog in 5.4.4 **abgeleitet**, nicht gesetzt |
   *
   * **`KB` steht hier, obwohl die Matrix ihm kein `A` gibt.** Die Zeile
   * „Dokument / Nachweis (3.10)" in 2.2 trägt für `KB` nur `L[35]`, während
   * 5.4.3 ihn unter den auslösenden Rollen des Einstellens nennt. Beides ist
   * Spezifikation, und geraten wird hier nichts (*offene Frage 42*): der
   * Übergang nennt die Rolle, wie 5.4.3 es tut, und die Prüffunktion verweigert
   * sie anhand der Matrix. Der Widerspruch wird damit zu einer Verweigerung mit
   * Fundstelle und nicht zu einer stillen Entscheidung.
   */
  submit: {
    from: [],
    to: 'submitted',
    label: 'Nachweis einstellen',
    roles: ['supplierAdmin', 'supplierCoordinator', 'operatorAdmin', 'demandOwner'],
    specReference: 'SPEC 5.4.3, — → submitted',
    preconditions: [
      {
        description: 'Bezugsobjekt gesetzt — genau eines, passend zu `subjectType` (3.10).',
        specReference: 'SPEC 5.4.3, — → submitted; 3.10',
        isSatisfied: (facts) => facts.subjectRef !== null && facts.subjectRef.trim() !== '',
      },
      {
        description: '`fileRef`, `fileName` und `mimeType` sind gesetzt (3.10).',
        specReference: 'SPEC 5.4.3, — → submitted; 3.10',
        isSatisfied: (facts) =>
          facts.fileRef.trim() !== '' &&
          facts.fileName.trim() !== '' &&
          facts.mimeType.trim() !== '',
      },
    ],
  },

  /**
   * | `submitted` | `accepted` | `MD` ([34]), `MA` | Nachweisart und
   * Bezugsobjekt passen zum Katalog; bei Nachweisarten mit
   * Gültigkeitszeitraum ist `validTo` gesetzt oder bewusst leer |
   * `verifiedAt` / `verifiedBy` gesetzt; abhängige Prüfungen (P9, P10) werden
   * neu gerechnet; Benachrichtigung an den Einsteller |
   */
  accept: {
    from: ['submitted'],
    to: 'accepted',
    label: 'anerkennen',
    roles: ['operatorCoordinator', 'operatorAdmin'],
    specReference: 'SPEC 5.4.3, submitted → accepted',
    preconditions: [
      fourEyes,
      {
        description:
          'Nachweisart und Bezugsobjekt passen zum Pflichtkatalog (5.4.4): eine ' +
          'Erlaubnisurkunde gehört an den Lieferanten, eine Unterweisung an den Einsatz.',
        specReference: 'SPEC 5.4.3, submitted → accepted; 5.4.4',
        isSatisfied: (facts) => facts.categoryFitsSubject,
      },
      {
        description:
          '`validTo` ist gesetzt oder bewusst leer. Ein unbefristeter Nachweis ist zulässig ' +
          '(5.4.4) — die Unbefristetheit muss aber erklärt und nicht vergessen sein.',
        specReference: 'SPEC 5.4.3, submitted → accepted; 5.4.4, Nachweis ohne validTo',
        isSatisfied: (facts) => facts.validTo !== null || facts.validToDeliberatelyOpen,
      },
      {
        description: '`verifiedAt` und `verifiedBy` sind gesetzt (3.10).',
        specReference: 'SPEC 5.4.3, submitted → accepted; 3.10',
        isSatisfied: (facts) => facts.verifiedAt !== null && facts.verifiedById !== null,
      },
    ],
  },

  /**
   * | `submitted` | `rejected` | `MD` ([34]), `MA` | `rejectionReason` Pflicht
   * | Benachrichtigung an den Einsteller mit Begründung; der Pflichtnachweis
   * bleibt offen; Eskalationsanlass „Nachweis fehlt" (2.4) |
   */
  reject: {
    from: ['submitted'],
    to: 'rejected',
    label: 'zurückweisen',
    roles: ['operatorCoordinator', 'operatorAdmin'],
    specReference: 'SPEC 5.4.3, submitted → rejected',
    preconditions: [
      fourEyes,
      {
        description:
          'Der Zurückweisungsgrund ist Pflicht (3.10, 5.4.3): der Einsteller muss wissen, ' +
          'was nachzubessern ist.',
        specReference: 'SPEC 5.4.3, submitted → rejected; 3.10',
        isSatisfied: (facts) =>
          facts.rejectionReason !== null && facts.rejectionReason.trim() !== '',
      },
    ],
  },
} as const satisfies Readonly<Record<string, DocumentTransition>>

export const DOCUMENT_MODEL: StatusModel<DocumentState, DocumentFacts, typeof TRANSITIONS> = {
  object: 'Dokument / Nachweis (3.10)',
  specReference: 'SPEC 5.4.3',
  states: ['submitted', 'accepted', 'rejected'],
  /**
   * 5.4.3 nennt ausdrücklich nur `rejected` einen „Endzustand". `accepted`
   * steht hier nicht — nicht, weil ein Übergang aus ihm führte (es führt
   * keiner), sondern weil die Spezifikation das Wort nicht benutzt: der
   * anerkannte Nachweis bleibt in Gebrauch, und seine Gültigkeit läuft weiter
   * (5.4.3, kein Statuswechsel durch Ablauf). Die Liste gibt deshalb den
   * Wortlaut wieder und nicht eine Ableitung daraus.
   */
  terminalStates: ['rejected'],
  transitions: TRANSITIONS,
}

export type DocumentTransitionName = keyof typeof TRANSITIONS & string

/** Deutsche Bezeichnung der Zustände (5.4.3), für die Oberfläche. */
export const DOCUMENT_STATE_LABELS: { readonly [S in DocumentState]: string } = {
  submitted: 'eingereicht',
  accepted: 'anerkannt',
  rejected: 'zurückgewiesen',
}
