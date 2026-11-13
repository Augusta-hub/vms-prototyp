/**
 * Benachrichtigungen aus den Übergängen — SPEC **3.14** („Benachrichtigung aus
 * einem Übergang") und **4.0 Regel 8**.
 *
 * **Der Katalog ist die Spalte „Nebenwirkungen" in Kapitel 4.** Wo dort
 * „Benachrichtigung an `KG`" steht, steht hier `KG`; wo nichts steht, steht
 * hier keine Zeile. Das ist bewusst eine **Abschrift** und keine Auslegung:
 * eine Nachricht, die jemand im Dienst „sinnvoll" hinzufügt, wäre eine
 * Offenlegung ohne Deckung in 2.3, und eine, die jemand vergisst, eine Zusage
 * ohne Gegenstand.
 *
 * **Dieses Modul rechnet, es lädt und schreibt nicht.** Es nimmt die
 * Mandantenlage eines Vorgangs und gibt die Adressaten zurück — dieselbe Linie
 * wie `lib/nightly/befunde.ts` und `lib/billing/items.ts`. Geschrieben wird in
 * `lib/services/notifications.ts`, und zwar in derselben Transaktion wie der
 * Übergang: eine Nachricht über einen Übergang, der zurückgerollt ist, wäre
 * falsch.
 *
 * **Vollständig gelesen, nicht nur positiv.** Zwei Zeilen in Kapitel 4 sagen
 * ausdrücklich, dass *keine* Nachricht entsteht — `submitted` → `reviewed` am
 * Angebot („keine Benachrichtigung an andere Lieferanten", 4.2.2) — und mehrere
 * sagen gar nichts (`released` → `confirmed`, 4.5; `active` → `completed`,
 * 4.3). Diese Übergänge stehen hier mit einer **leeren** Adressatenliste und
 * einer Begründung, statt zu fehlen: eine fehlende Zeile wäre von einer
 * vergessenen nicht zu unterscheiden.
 *
 * **Die Stufe ist 1.** Ein Übergang hat stattgefunden; die Nachricht darüber
 * ist eine Information an die zuständige Rolle. Eine zweite Stufe trägt genau
 * eine Zeile: 4.6 nennt bei der Sperre „Benachrichtigung an `LA`; **Eskalation**
 * an `MA`". Die Eskalations*anlässe*, die andere Zeilen nennen, laufen nach
 * Zeit und gehören dem nächtlichen Lauf (2.4 Regel 2, 5.5.1 c).
 */
import type { Rollenkuerzel } from '../aueg/typen'

/**
 * Ein Adressat, wie Kapitel 4 ihn benennt: entweder mit dem Rollenkürzel oder
 * relativ zum Vorgang. Die relativen Schlüssel und ihre Auflösung stehen in
 * der Tabelle in 3.14.
 */
export type Adressatenschluessel =
  | Rollenkuerzel
  /** „an den Antragsteller" (4.3, Verlängerung). */
  | 'antragsteller'
  /** „an die jeweils andere Seite" (4.3, `terminatedEarly`). */
  | 'andereSeite'
  /** „an beide Seiten" (4.3, Unterbrechung und Wiederaufnahme). */
  | 'beideSeiten'
  /** „an alle Beteiligten" (4.3, `effective`). */
  | 'alleBeteiligten'
  /** „an die Rolle der ersten / nächsten Stufe" (4.4, 3.1). */
  | 'offeneStufe'
  /** „an die erfassende Seite" (4.4, `rejected`). */
  | 'erfassendeSeite'
  /** „an `KE` bzw. `LD`", „an die Gegenseite" (4.5). */
  | 'gegenseite'
  /** „an die beanstandende Seite" (4.5, `disputed` → `inReview`). */
  | 'beanstandendeSeite'
  /** „an den Einsteller" (5.4, Nachweis). */
  | 'einsteller'

/** Art der Nachricht (3.14) — bei einem Übergang die Regel `information`. */
export type Meldungsart = 'information' | 'warning' | 'escalation'

/** Eine Adressatenangabe einer Katalogzeile. */
export interface Adressatenangabe {
  readonly schluessel: Adressatenschluessel
  /**
   * Vorbelegung `information`: der Übergang hat stattgefunden. `escalation`
   * nur, wo Kapitel 4 das Wort selbst benutzt (4.6, Sperre).
   */
  readonly art?: Meldungsart
  /** Vorbelegung 1 — die zuständige Rolle (3.14). */
  readonly stufe?: number
}

/** Eine Zeile des Katalogs: ein Übergang eines Statusmodells. */
export interface Katalogzeile {
  /** Der Übergang in Worten, aus Kapitel 4 — Kern der Meldung. */
  readonly ereignis: string
  readonly adressaten: readonly Adressatenangabe[]
  /**
   * Trägt die Meldung die Pflichtbegründung des Übergangs? Nur dort, wo
   * Kapitel 4 „mit Begründung" schreibt (3.14).
   */
  readonly mitBegruendung?: boolean
  /** Warum eine Zeile **keine** Adressaten hat — Kapitel 4 im Wortlaut. */
  readonly ohneNachricht?: string
  readonly specReference: string
}

type Katalog = Readonly<Record<string, Readonly<Record<string, Katalogzeile>>>>

const INFO = (schluessel: Adressatenschluessel): Adressatenangabe => ({ schluessel })

/* ------------------------------------------------------------------ */
/* Der Katalog — Kapitel 4, Spalte „Nebenwirkungen"                    */
/* ------------------------------------------------------------------ */

/**
 * Je Statusmodell die Übergänge und ihre Adressaten. Die Schlüssel sind die
 * Übergangsnamen aus `lib/status/` und die Objektarten aus 3.12 — damit ist
 * eine Zeile für einen Übergang, den Kapitel 4 nicht nennt, nicht
 * schreibbar, ohne dass ein Statusmodell sie kennt.
 */
export const UEBERGANGSKATALOG: Katalog = {
  /* --- 4.1 Bedarfsanfrage ----------------------------------------- */
  demandRequest: {
    create: {
      ereignis: 'ist als Entwurf angelegt',
      adressaten: [],
      ohneNachricht:
        '4.1 nennt bei der Anlage nur den Vermerk `createdOnBehalfOf` — keine Nachricht.',
      specReference: 'SPEC 4.1',
    },
    submit: {
      ereignis: 'ist eingereicht und liegt zur Freigabe',
      adressaten: [INFO('KG')],
      specReference: 'SPEC 4.1',
    },
    approve: {
      ereignis: 'ist genehmigt',
      adressaten: [INFO('KB'), INFO('MD')],
      specReference: 'SPEC 4.1',
    },
    returnToDraft: {
      ereignis: 'ist zur Überarbeitung zurückgewiesen',
      adressaten: [INFO('KB')],
      specReference: 'SPEC 4.1',
    },
    publishTender: {
      ereignis: 'ist ausgeschrieben',
      adressaten: [],
      ohneNachricht:
        '4.1 nennt „je Lieferant eine einzeln adressierte Benachrichtigung" — ' +
        'das ist die Einladung selbst (4.2.1, `invite`), nicht eine Nachricht ' +
        'an der Anfrage. Eine zweite hier wäre dieselbe Nachricht doppelt, und ' +
        'eine gemeinsame verstieße gegen 2.3 Regel 2.',
      specReference: 'SPEC 4.1',
    },
    openNextRound: {
      ereignis: 'hat eine neue Ausschreibungsrunde',
      adressaten: [],
      ohneNachricht:
        '4.1 nennt für die neue Runde einen Protokolleintrag am neuen ' +
        'Ausschreibungsobjekt und neue Einladungen — die benachrichtigen selbst.',
      specReference: 'SPEC 4.1',
    },
    releaseToSelection: {
      ereignis: 'hat vorgelegte Profile zur Auswahl',
      adressaten: [INFO('KB')],
      specReference: 'SPEC 4.1',
    },
    returnToTender: {
      ereignis: 'fällt in die Ausschreibung zurück',
      adressaten: [INFO('KB')],
      specReference: 'SPEC 4.1',
    },
    fill: {
      ereignis: 'ist besetzt',
      adressaten: [],
      ohneNachricht:
        '4.1 nennt „einzeln adressierte Benachrichtigungen" — die entstehen an ' +
        'den beendeten Einladungen, Angeboten und Vorschlägen (4.2), jede in ' +
        'ihrem eigenen Mandanten.',
      specReference: 'SPEC 4.1',
    },
    cancel: {
      ereignis: 'ist storniert',
      adressaten: [],
      ohneNachricht:
        '4.1 nennt wie bei `filled` „einzeln adressierte Benachrichtigungen" an ' +
        'den beendeten Untervorgängen (4.2).',
      specReference: 'SPEC 4.1',
    },
    expire: {
      ereignis: 'ist abgelaufen — der Starttermin ist erreicht, ohne Einsatz',
      adressaten: [INFO('KB'), INFO('MD')],
      specReference: 'SPEC 4.1',
    },
  },

  /* --- 4.2.1 Einladung -------------------------------------------- */
  tenderInvitation: {
    invite: {
      ereignis: 'ist eingeladen',
      adressaten: [INFO('LD')],
      specReference: 'SPEC 4.2.1',
    },
    markViewed: {
      ereignis: 'ist gesichtet',
      adressaten: [],
      ohneNachricht: '4.2.1 nennt zur Sichtung nur `viewedAt` — keine Nachricht.',
      specReference: 'SPEC 4.2.1',
    },
    recordOfferSubmitted: {
      ereignis: 'hat ein Angebot',
      adressaten: [INFO('MD')],
      specReference: 'SPEC 4.2.1',
    },
    decline: {
      ereignis: 'ist abgelehnt',
      adressaten: [INFO('MD')],
      specReference: 'SPEC 4.2.1',
    },
    expire: {
      ereignis: 'ist ohne Angebot abgelaufen',
      adressaten: [INFO('MD')],
      specReference: 'SPEC 4.2.1',
    },
  },

  /* --- 4.2.2 Lieferantenangebot ----------------------------------- */
  supplierOffer: {
    create: {
      ereignis: 'ist als Entwurf angelegt',
      adressaten: [],
      ohneNachricht: '4.2.2 nennt bei der Anlage keine Nachricht.',
      specReference: 'SPEC 4.2.2',
    },
    submit: {
      ereignis: 'ist eingereicht',
      adressaten: [INFO('MD')],
      specReference: 'SPEC 4.2.2',
    },
    amend: {
      ereignis: 'ist inhaltlich geändert',
      adressaten: [],
      ohneNachricht:
        '4.2.2 nennt zur Änderung vor der Sichtung nur den Protokolleintrag mit ' +
        'den geänderten Feldern (3.12).',
      specReference: 'SPEC 4.2.2',
    },
    review: {
      ereignis: 'ist gesichtet',
      adressaten: [],
      ohneNachricht:
        '4.2.2 sagt es ausdrücklich: „keine Benachrichtigung an andere ' +
        'Lieferanten". Auch der eigene Lieferant erfährt die Sichtung nicht — ' +
        'sie ist eine betreiberinterne Handlung, und die Spalte nennt nur ' +
        '`reviewedAt` und das Ende des Änderungsrechts ([19]).',
      specReference: 'SPEC 4.2.2',
    },
    accept: {
      ereignis: 'hat den Zuschlag',
      adressaten: [INFO('LD')],
      specReference: 'SPEC 4.2.2',
    },
    reject: {
      ereignis: 'ist abgelehnt',
      adressaten: [INFO('LD')],
      specReference: 'SPEC 4.2.2',
    },
    withdraw: {
      ereignis: 'ist zurückgezogen',
      adressaten: [INFO('MD')],
      specReference: 'SPEC 4.2.2',
    },
    expire: {
      ereignis: 'ist abgelaufen — die Bindungsfrist ist verstrichen',
      adressaten: [INFO('LD'), INFO('MD')],
      specReference: 'SPEC 4.2.2',
    },
  },

  /* --- 4.2.3 Profilvorschlag -------------------------------------- */
  candidateSubmission: {
    create: {
      ereignis: 'ist als Entwurf angelegt',
      adressaten: [],
      ohneNachricht: '4.2.3 nennt bei der Anlage keine Nachricht.',
      specReference: 'SPEC 4.2.3',
    },
    submit: {
      ereignis: 'ist eingereicht',
      adressaten: [INFO('MD')],
      specReference: 'SPEC 4.2.3',
    },
    review: {
      ereignis: 'ist geprüft',
      adressaten: [],
      ohneNachricht:
        '4.2.3 nennt zur Prüfung die AÜG-Prüfungen und den Doppelvorschlag, der ' +
        '**nur** beim Betreiber sichtbar ist (2.3, Regel 4) — keine Nachricht.',
      specReference: 'SPEC 4.2.3',
    },
    releaseToCustomer: {
      ereignis: 'ist dem Kunden vorgelegt',
      adressaten: [INFO('KB')],
      specReference: 'SPEC 4.2.3',
    },
    scheduleInterview: {
      // „Benachrichtigung an `MD`, von dort an `LD`" — beide erhalten sie,
      // jede auf Stufe 1 in ihrer Organisation (3.14, „über MD").
      ereignis: 'hat ein vereinbartes Interview',
      adressaten: [INFO('MD'), INFO('LD')],
      specReference: 'SPEC 4.2.3',
    },
    accept: {
      ereignis: 'ist zugesagt',
      adressaten: [],
      ohneNachricht:
        '4.2.3 nennt bei der Zusage den Wechsel der Offenlegungsstufe, das ' +
        'Protokoll jedes Zugriffs auf Klardaten (6.4) und den Übergang des ' +
        'Angebots auf `accepted` — und dort steht die Nachricht an `LD` (4.2.2).',
      specReference: 'SPEC 4.2.3',
    },
    rejectByOperator: {
      ereignis: 'ist abgelehnt',
      adressaten: [INFO('LD'), INFO('MD')],
      specReference: 'SPEC 4.2.3',
    },
    rejectByCustomer: {
      ereignis: 'ist abgelehnt',
      adressaten: [INFO('LD'), INFO('MD')],
      specReference: 'SPEC 4.2.3',
    },
    withdraw: {
      ereignis: 'ist zurückgezogen',
      adressaten: [INFO('MD'), INFO('KB')],
      specReference: 'SPEC 4.2.3',
    },
  },

  /* --- 4.3 Einsatz ------------------------------------------------ */
  assignment: {
    create: {
      ereignis: 'ist geplant',
      adressaten: [INFO('KB'), INFO('KE'), INFO('LD')],
      specReference: 'SPEC 4.3',
    },
    start: {
      ereignis: 'ist angetreten — der Fristenlauf beginnt',
      adressaten: [INFO('KB'), INFO('LD')],
      specReference: 'SPEC 4.3',
    },
    interrupt: {
      ereignis: 'ist unterbrochen',
      adressaten: [INFO('beideSeiten')],
      specReference: 'SPEC 4.3',
    },
    resume: {
      ereignis: 'ist wiederaufgenommen',
      adressaten: [INFO('beideSeiten')],
      specReference: 'SPEC 4.3',
    },
    complete: {
      ereignis: 'ist beendet',
      adressaten: [],
      ohneNachricht:
        '4.3 nennt beim planmäßigen Ende das Ende des Fristenlaufs und die ' +
        'Löschfrist (6.5) — keine Nachricht. Das Ende stand im Einsatz von ' +
        'Anfang an; überrascht ist niemand.',
      specReference: 'SPEC 4.3',
    },
    terminateEarly: {
      ereignis: 'ist vorzeitig beendet',
      adressaten: [INFO('andereSeite')],
      mitBegruendung: true,
      specReference: 'SPEC 4.3',
    },
  },

  /* --- 4.3 Verlängerung ------------------------------------------- */
  assignmentExtension: {
    request: {
      ereignis: 'ist beantragt',
      adressaten: [INFO('KG')],
      specReference: 'SPEC 4.3',
    },
    approve: {
      ereignis: 'ist genehmigt',
      adressaten: [INFO('MD'), INFO('antragsteller')],
      specReference: 'SPEC 4.3',
    },
    reject: {
      ereignis: 'ist abgelehnt — der Einsatz endet zum unveränderten Ende',
      adressaten: [INFO('antragsteller')],
      specReference: 'SPEC 4.3',
    },
    withdraw: {
      ereignis: 'ist zurückgezogen',
      adressaten: [INFO('KG')],
      specReference: 'SPEC 4.3',
    },
    makeEffective: {
      ereignis: 'ist wirksam — das geplante Ende ist verschoben',
      adressaten: [INFO('alleBeteiligten')],
      specReference: 'SPEC 4.3',
    },
  },

  /* --- 4.4 Stundenzettel ------------------------------------------ */
  timesheet: {
    create: {
      ereignis: 'ist angelegt',
      adressaten: [],
      ohneNachricht: '4.4 nennt bei der Anlage keine Nachricht.',
      specReference: 'SPEC 4.4',
    },
    submit: {
      ereignis: 'ist eingereicht und liegt zur Freigabe',
      adressaten: [INFO('offeneStufe')],
      specReference: 'SPEC 4.4',
    },
    openApproval: {
      ereignis: 'ist in der Freigabe',
      adressaten: [],
      ohneNachricht:
        '4.4 nennt die Nachricht an die Rolle der **ersten** Stufe bei der ' +
        'Einreichung; `submitted` → `inApproval` ist der Systemübergang, der die ' +
        'Stufe öffnet, und nennt nur den Fristenlauf.',
      specReference: 'SPEC 4.4',
    },
    approveStage: {
      ereignis: 'hat eine freigegebene Stufe und liegt bei der nächsten',
      adressaten: [INFO('offeneStufe')],
      specReference: 'SPEC 4.4',
    },
    approve: {
      ereignis: 'ist genehmigt',
      adressaten: [INFO('MD'), INFO('LD')],
      specReference: 'SPEC 4.4',
    },
    reject: {
      ereignis: 'ist abgelehnt',
      adressaten: [INFO('erfassendeSeite')],
      mitBegruendung: true,
      specReference: 'SPEC 4.4',
    },
    rework: {
      ereignis: 'ist zur Überarbeitung zurück',
      adressaten: [],
      ohneNachricht:
        '4.4 nennt beim Rücklauf nur, dass die Freigabeschritte verworfen und ' +
        'bei der nächsten Einreichung neu erzeugt werden. Die Nachricht über die ' +
        'Ablehnung ist schon raus.',
      specReference: 'SPEC 4.4',
    },
    markCorrected: {
      // 4.4: „Benachrichtigung an `KE` bzw. `LD`". Anders als beim Beleg (4.5)
      // hat ein Zettel keine Seite: die Nebenwirkung nennt die Stornierung der
      // Belegpositionen, die auf ihm beruhen — und das sind die der Verkaufs-
      // **und** der Einkaufsseite. „bzw." heißt hier also beide, je nachdem,
      // welche Belege es gibt; adressierbar ist, wer eine Organisation im
      // Vorgang hat.
      ereignis: 'ist durch eine Korrekturfassung ersetzt',
      adressaten: [INFO('KE'), INFO('LD')],
      specReference: 'SPEC 4.4',
    },
  },

  /* --- 4.5.1 Abrechnungsperiode ----------------------------------- */
  billingPeriod: {
    open: {
      ereignis: 'ist offen — Stundenzettel können angelegt werden',
      adressaten: [INFO('LD')],
      specReference: 'SPEC 4.5.1',
    },
    close: {
      ereignis: 'ist geschlossen',
      adressaten: [INFO('KE'), INFO('LD')],
      specReference: 'SPEC 4.5.1',
    },
  },

  /* --- 4.5.2 Abrechnungsbeleg ------------------------------------- */
  billingDocument: {
    create: {
      ereignis: 'ist erstellt',
      adressaten: [],
      ohneNachricht:
        '4.5.2 nennt die Nachricht an `MD` nur für **Einkauf B** — die Variante, ' +
        'in der der Lieferant die Rechnung einreicht. Sie ist nicht umgesetzt ' +
        '(3.9); in Verkauf und Einkauf A erstellt der Betreiber selbst.',
      specReference: 'SPEC 4.5.2',
    },
    review: {
      ereignis: 'ist in Prüfung',
      adressaten: [],
      ohneNachricht:
        '4.5.2 nennt zur Prüfung nur, dass keine inhaltliche Änderung mehr ohne ' +
        'Protokolleintrag möglich ist — eine betreiberinterne Station.',
      specReference: 'SPEC 4.5.2',
    },
    release: {
      ereignis: 'ist freigegeben',
      adressaten: [INFO('gegenseite')],
      specReference: 'SPEC 4.5.2',
    },
    disputeBySales: {
      ereignis: 'ist beanstandet',
      adressaten: [INFO('MD')],
      specReference: 'SPEC 4.5.2',
    },
    disputeByPurchase: {
      ereignis: 'ist beanstandet',
      adressaten: [INFO('MD')],
      specReference: 'SPEC 4.5.2',
    },
    confirm: {
      ereignis: 'ist bestätigt',
      adressaten: [],
      ohneNachricht:
        '4.5.2 nennt bei der Bestätigung den Abschluss des Belegs und die ' +
        'Übergabe an ein Fremdsystem (*offene Frage 7*) — keine Nachricht. Der ' +
        'Betreiber sieht den Beleg ohnehin.',
      specReference: 'SPEC 4.5.2',
    },
    clarify: {
      ereignis: 'ist geklärt und erneut in Prüfung',
      adressaten: [INFO('beanstandendeSeite')],
      specReference: 'SPEC 4.5.2',
    },
    cancel: {
      ereignis: 'ist storniert',
      adressaten: [INFO('gegenseite')],
      specReference: 'SPEC 4.5.2',
    },
  },

  /* --- 4.6 Lieferantenstatus -------------------------------------- */
  supplier: {
    create: {
      ereignis: 'ist in der Anbindung',
      adressaten: [],
      ohneNachricht:
        '4.6 nennt bei der Anlage den Lieferantenmandanten (3.11) und das ' +
        'Pflegerecht von `LA` ([7]) — keine Nachricht. Zugänge gibt es noch nicht.',
      specReference: 'SPEC 4.6',
    },
    activate: {
      ereignis: 'ist freigeschaltet und erscheint im Einladungskreis',
      adressaten: [INFO('LA'), INFO('LD')],
      specReference: 'SPEC 4.6',
    },
    block: {
      ereignis: 'ist gesperrt',
      adressaten: [INFO('LA'), { schluessel: 'MA', art: 'escalation', stufe: 2 }],
      specReference: 'SPEC 4.6',
    },
    unblock: {
      ereignis: 'ist entsperrt',
      adressaten: [INFO('LA'), INFO('LD')],
      specReference: 'SPEC 4.6',
    },
    deactivate: {
      ereignis: 'ist inaktiv — die Zugänge sind gesperrt',
      adressaten: [],
      ohneNachricht:
        '4.6 nennt bei der Deaktivierung die Sperre der Zugänge (3.11), das Ende ' +
        'offener Einladungen und die Löschfristen (6.5) — keine Nachricht. Es ' +
        'gibt im Lieferantenmandanten niemanden mehr, der sie lesen könnte.',
      specReference: 'SPEC 4.6',
    },
    reactivate: {
      // „Wie `onboarding` → `active`" (4.6).
      ereignis: 'ist reaktiviert',
      adressaten: [INFO('LA'), INFO('LD')],
      specReference: 'SPEC 4.6',
    },
  },

  /* --- 5.4 Nachweis ----------------------------------------------- */
  document: {
    submit: {
      ereignis: 'ist eingestellt',
      adressaten: [INFO('MD')],
      specReference: 'SPEC 5.4',
    },
    accept: {
      ereignis: 'ist anerkannt',
      adressaten: [INFO('einsteller')],
      specReference: 'SPEC 5.4',
    },
    reject: {
      ereignis: 'ist zurückgewiesen',
      adressaten: [INFO('einsteller')],
      mitBegruendung: true,
      specReference: 'SPEC 5.4',
    },
  },
}

/* ------------------------------------------------------------------ */
/* Auflösung                                                           */
/* ------------------------------------------------------------------ */

/**
 * Die Organisationen und relativen Rollen eines Vorgangs — alles, was die
 * Auflösung der Adressaten braucht (3.14, Tabelle der relativen Adressaten).
 */
export interface Vorgangslage {
  /** Betreibermandant — `MA` und `MD` wirken dort (2.1). */
  readonly operator: string
  readonly customer?: string | readonly string[] | null
  /**
   * Lieferantenmandant oder **mehrere**: 4.5.1 adressiert beim Öffnen der
   * Periode „`LD` der beteiligten Lieferanten", und 2.3 Regel 2 verlangt, dass
   * jeder seine **eigene** Nachricht erhält. Mehrere Mandanten ergeben deshalb
   * mehrere Benachrichtigungen, nicht eine gemeinsame.
   */
  readonly supplier?: string | readonly string[] | null
  /** `requestedBy` der Verlängerung, als Rolle (4.3). */
  readonly antragsteller?: Rollenkuerzel | null
  /** Kopiertes Rollenkürzel des offenen Freigabeschritts (4.4, 3.1). */
  readonly offeneStufe?: Rollenkuerzel | null
  /** Rolle, die den Zettel eingereicht hat (4.4). */
  readonly erfassendeSeite?: Rollenkuerzel | null
  /** Rolle, von der die Beanstandung kam (4.5). */
  readonly beanstandendeSeite?: Rollenkuerzel | null
  /** Rolle, die den Nachweis eingestellt hat (5.4). */
  readonly einsteller?: Rollenkuerzel | null
  /** Seite des Belegs — bestimmt „`KE` bzw. `LD`" und „Gegenseite" (4.5). */
  readonly richtung?: 'sales' | 'purchase' | null
}

/** Ein aufgelöster Adressat: Rolle, Organisation, Art und Stufe. */
export interface Adressat {
  readonly rolle: Rollenkuerzel
  readonly mandant: string
  readonly art: Meldungsart
  readonly stufe: number
}

/**
 * Die Mandanten, in denen eine Rolle wirkt (2.1). `MA` und `MD` beim
 * Betreiber, `KB`, `KG` und `KE` beim Kunden, `LD` und `LA` beim Lieferanten.
 *
 * Mehrere sind möglich, wo Kapitel 4 mehrere Organisationen adressiert — „`LD`
 * der beteiligten Lieferanten" (4.5.1). Leer heißt **nicht adressierbar**:
 * `AN` hat keinen Zugang (*offene Frage 4*), und eine Nachricht an `KE` zu
 * einem Vorgang ohne Kunden hätte keinen Empfänger (2.3).
 */
export function mandantenDerRolle(rolle: Rollenkuerzel, lage: Vorgangslage): readonly string[] {
  switch (rolle) {
    case 'MA':
    case 'MD':
      return [lage.operator]
    case 'KB':
    case 'KG':
    case 'KE':
      return alsListe(lage.customer)
    case 'LD':
    case 'LA':
      return alsListe(lage.supplier)
    case 'AN':
      return []
  }
}

function alsListe(wert: string | readonly string[] | null | undefined): readonly string[] {
  if (wert == null) return []
  return typeof wert === 'string' ? [wert] : wert.filter((eintrag) => eintrag !== '')
}

/**
 * Löst einen Adressatenschlüssel in Rollenkürzel auf — ohne Mandanten, den
 * setzt `adressaten`.
 */
function rollen(schluessel: Adressatenschluessel, lage: Vorgangslage): readonly Rollenkuerzel[] {
  switch (schluessel) {
    case 'antragsteller':
      return lage.antragsteller == null ? [] : [lage.antragsteller]
    case 'andereSeite': {
      // Die Seite, die den Antrag **nicht** gestellt hat (4.3). Ohne
      // Antragsteller ist „die andere" nicht bestimmbar.
      if (lage.antragsteller == null) return []
      const kundenseitig = lage.antragsteller === 'KB' || lage.antragsteller === 'KG'
      return kundenseitig ? ['LD'] : ['KB']
    }
    case 'beideSeiten':
      return ['KB', 'LD']
    case 'alleBeteiligten':
      return ['KB', 'KG', 'KE', 'LD', 'MD']
    case 'offeneStufe':
      return lage.offeneStufe == null ? [] : [lage.offeneStufe]
    case 'erfassendeSeite':
      return lage.erfassendeSeite == null ? [] : [lage.erfassendeSeite]
    case 'beanstandendeSeite':
      return lage.beanstandendeSeite == null ? [] : [lage.beanstandendeSeite]
    case 'einsteller':
      return lage.einsteller == null ? [] : [lage.einsteller]
    case 'gegenseite':
      // „an `KE` bzw. `LD`": `KE` auf der Verkaufs-, `LD` auf der
      // Einkaufsseite (4.5). Ohne Seite ist die Gegenseite nicht bestimmbar.
      if (lage.richtung === 'sales') return ['KE']
      if (lage.richtung === 'purchase') return ['LD']
      return []
    default:
      return [schluessel]
  }
}

/**
 * Die Adressaten eines Übergangs (3.14). Leer, wo Kapitel 4 keine Nachricht
 * nennt — und ebenso leer, wo eine Rolle im Vorgang keine Organisation hat.
 *
 * Doppelte entfallen: „alle Beteiligten" und eine namentlich genannte Rolle
 * können zusammenfallen, und zwei Nachrichten an dieselbe Rollenzuweisung
 * wären eine zu viel.
 */
export function adressaten(
  objectType: string,
  uebergang: string,
  lage: Vorgangslage,
): readonly Adressat[] {
  const zeile = katalogzeile(objectType, uebergang)
  if (zeile === null) return []

  const gesammelt: Adressat[] = []
  for (const angabe of zeile.adressaten) {
    for (const rolle of rollen(angabe.schluessel, lage)) {
      for (const mandant of mandantenDerRolle(rolle, lage)) {
        const art = angabe.art ?? 'information'
        const stufe = angabe.stufe ?? 1
        const schonDa = gesammelt.some(
          (vorhanden) =>
            vorhanden.rolle === rolle && vorhanden.mandant === mandant && vorhanden.stufe === stufe,
        )
        if (schonDa) continue
        gesammelt.push({ rolle, mandant, art, stufe })
      }
    }
  }
  return gesammelt
}

/** Die Katalogzeile zu einem Übergang, oder `null`. */
export function katalogzeile(objectType: string, uebergang: string): Katalogzeile | null {
  return UEBERGANGSKATALOG[objectType]?.[uebergang] ?? null
}

/**
 * Die Meldung zu einem Übergang (3.14): Bezeichnung des Vorgangs, das
 * Ereignis in Worten, der Kapitelverweis — und die Pflichtbegründung **nur**
 * dort, wo Kapitel 4 „mit Begründung" schreibt.
 */
export function meldung(args: {
  readonly objectType: string
  readonly uebergang: string
  /** „Bedarfsanfrage BA-2026-0007" — nur Daten, die jeder Beteiligte sieht. */
  readonly bezeichnung: string
  readonly begruendung?: string | null
}): string | null {
  const zeile = katalogzeile(args.objectType, args.uebergang)
  if (zeile === null) return null
  const kern = `${args.bezeichnung} ${zeile.ereignis} (${zeile.specReference.replace('SPEC ', '')}).`
  const begruendung = args.begruendung?.trim()
  if (zeile.mitBegruendung !== true || begruendung === undefined || begruendung === '') return kern
  return `${kern} Begründung: ${begruendung}`
}

/* ------------------------------------------------------------------ */
/* Warnungen aus 4.7                                                   */
/* ------------------------------------------------------------------ */

/**
 * Ein Prüfergebnis zu einem Übergang, so weit die Benachrichtigung es braucht
 * (4.7, 5.5.2). Die Fachdienste führen reichere Typen; dieser ist der
 * gemeinsame Nenner.
 */
export interface Pruefbefund {
  /** `P1` … `P11`. */
  readonly check: string
  readonly satisfied: boolean
  readonly effect: 'Sperre' | 'Warnung' | 'Information'
  readonly adressaten: readonly Rollenkuerzel[]
  readonly message: string
}

/**
 * Die Befunde, die nach 4.7 eine Benachrichtigung auslösen.
 *
 * Genau eine Art tut das: die **Warnung**. 5.5.2 ist darin ausdrücklich — die
 * Information erzeugt „keine Benachrichtigung, keinen Eskalationsanlass", und
 * die Sperre hat den Übergang verhindert, es gibt also nichts zu melden. Und
 * ein **erfüllter** Befund ist kein Befund: 5.5.2 Nr. 2 verlangt, dass jede
 * Feststellung „das fehlende oder verletzte Datum" nennt.
 *
 * Diese drei Sätze stehen hier und nicht in den Fachdiensten, weil sie sonst
 * in jedem einzeln stünden — und einer davon wäre anders.
 */
export function warnungsbefunde<T extends Pruefbefund>(
  befunde: readonly T[],
): readonly T[] {
  return befunde.filter((befund) => !befund.satisfied && befund.effect === 'Warnung')
}
