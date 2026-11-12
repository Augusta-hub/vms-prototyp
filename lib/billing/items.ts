/**
 * Belegpositionen aus genehmigten Zeiten — SPEC **3.9**, Vorbedingung der
 * Anlage in 4.5.2.
 *
 * **Dieses Modul rechnet, es liest nicht.** Keine Datenbank, keine Rechte,
 * keine Statusführung — dieselbe Linie wie `lib/aueg/` und
 * `lib/timetracking/premiums.ts`: eine Lage hinein, ein Ergebnis heraus.
 *
 * **Der Grundsatz wird gelesen, nicht gesucht.** 3.7 führt am Einsatz beide
 * Seiten als Verweis: `agreedRateCardItemRef` die Einkaufsseite,
 * `customerRateCardItemRef` die Verkaufsseite. Welche Preisposition gilt, ist
 * damit entschieden, als der Einsatz entstand — sie hier erneut aus
 * Qualifikation, Tätigkeit und Standort zu suchen wäre eine zweite Fassung
 * derselben Zuordnung, und eine der beiden wäre falsch. Gesucht wird nur, was
 * der Einsatz nicht nennt: der **Zuschlagssatz** je Zuschlagsart.
 *
 * **Ein fehlender Zuschlagssatz ist ein Mangel, keine Lücke.** 4.5.2 macht die
 * Preisposition der jeweiligen Seite zur Vorbedingung der Anlage. Der
 * `defaultValue` der Zuschlagsart (3.8) tritt **nicht** ein: er ist die
 * Vorbelegung für das Anlegen einer Preisposition, keine Vereinbarung zwischen
 * den Parteien. Ein Betrag aus dem Katalog statt aus der Preisliste wäre eine
 * erfundene kaufmännische Abrede.
 *
 * **Was dieses Modul nicht entscheidet.** Wie Geldbeträge gerundet werden, ist
 * *offene Frage 53* — gerechnet wird ungerundet. Worauf sich die
 * **Mindestabrechnung** (`minimumHours`, 3.3) bezieht, ist *offene Frage 54*;
 * bis zur Antwort wird sie **nicht** angewandt, weil „mindestens vier Stunden"
 * je Tag und je Periode verschiedene Beträge ergeben.
 */

/** Berechnungsart einer Zuschlagsart (3.8). */
export type Berechnungsart = 'percentage' | 'absolute'

/** Eine Zuschlagsart, soweit die Bepreisung sie braucht (3.8). */
export interface Zuschlagsart {
  readonly id: string
  readonly code: string
  readonly calculationBase: Berechnungsart
}

/** Eine Preisposition, soweit die Bepreisung sie braucht (3.3). */
export interface Preisposition {
  readonly id: string
  readonly rateCardId: string
  readonly itemType: 'baseRate' | 'premiumRate'
  readonly premiumTypeId: string | null
  readonly hourlyRate: number | null
  readonly premiumValue: number | null
  readonly validFrom: Date | null
  readonly validTo: Date | null
}

/**
 * Ein genehmigter Stundenzettel, soweit die Abrechnung ihn braucht (3.8).
 *
 * `basePrice` ist der Grundsatz der **abzurechnenden Seite**: auf der
 * Einkaufsseite `agreedHourlyRate` oder der Satz der vereinbarten
 * Preisposition, auf der Verkaufsseite der Satz der Kundenpreisposition (3.7,
 * 3.3). Er kommt vom Aufrufer, weil nur dort steht, welche Seite gerechnet
 * wird.
 */
export interface Abrechnungszeile {
  readonly timesheetId: string
  readonly timesheetNumber: string
  readonly assignmentId: string
  readonly assignmentNumber: string
  /** Pflicht bei `sales` (3.9) — aus dem Einsatz. */
  readonly costCenterId: string | null
  readonly baseHours: number
  readonly premiumHours: readonly { readonly premiumTypeId: string; readonly hours: number }[]
  readonly basePrice: number | null
  /** Die Preisposition, aus der `basePrice` kommt; `null` bei abweichendem Satz. */
  readonly basePriceItemId: string | null
  /** Die Preisliste der abzurechnenden Seite — in ihr stehen die Zuschlagssätze. */
  readonly rateCardId: string | null
}

export interface Belegposition {
  readonly timesheetId: string
  readonly assignmentId: string
  readonly premiumTypeId: string | null
  readonly quantity: number
  readonly unitPrice: number
  readonly amount: number
  readonly rateCardItemId: string | null
  readonly costCenterId: string | null
}

/** Ein Satz, den die Preisliste der Seite nicht hergibt (4.5.2, Vorbedingung). */
export interface Satzmangel {
  readonly timesheetNumber: string
  readonly assignmentNumber: string
  /** `null` = der Grundsatz fehlt; sonst das Kürzel der Zuschlagsart. */
  readonly premiumCode: string | null
  readonly reason: string
}

export interface Belegableitung {
  readonly positionen: readonly Belegposition[]
  readonly maengel: readonly Satzmangel[]
}

/**
 * Die Positionen eines Belegs aus den genehmigten Zetteln (3.9).
 *
 * Je Zettel entsteht **eine** Grundleistungsposition und **je Zuschlagsart
 * eine** weitere — die Gliederung, die 3.9 mit `premiumTypeRef` am
 * Belegposten vorgibt („leer = Grundleistung"). Eine Position über null
 * Stunden entsteht nicht: sie wäre eine Zeile ohne Leistung.
 */
export function belegpositionen(eingabe: {
  readonly zeilen: readonly Abrechnungszeile[]
  readonly preispositionen: readonly Preisposition[]
  readonly zuschlagsarten: readonly Zuschlagsart[]
  /** Stichtag der Satzgültigkeit: der Belegtag (5.0, 3.3). */
  readonly stichtag: Date
}): Belegableitung {
  const artNachId = new Map(eingabe.zuschlagsarten.map((art) => [art.id, art]))
  const positionen: Belegposition[] = []
  const maengel: Satzmangel[] = []

  for (const zeile of eingabe.zeilen) {
    if (zeile.basePrice === null) {
      maengel.push({
        timesheetNumber: zeile.timesheetNumber,
        assignmentNumber: zeile.assignmentNumber,
        premiumCode: null,
        reason:
          'Der Einsatz nennt keinen Verrechnungssatz für diese Belegseite (3.7, 3.3) — ' +
          'ohne Satz gibt es keinen Betrag.',
      })
      continue
    }

    if (zeile.baseHours > 0) {
      positionen.push({
        timesheetId: zeile.timesheetId,
        assignmentId: zeile.assignmentId,
        premiumTypeId: null,
        quantity: zeile.baseHours,
        unitPrice: zeile.basePrice,
        amount: zeile.baseHours * zeile.basePrice,
        rateCardItemId: zeile.basePriceItemId,
        costCenterId: zeile.costCenterId,
      })
    }

    for (const zuschlag of zeile.premiumHours) {
      if (zuschlag.hours <= 0) continue
      const art = artNachId.get(zuschlag.premiumTypeId)
      const satz = zuschlagssatz({
        premiumTypeId: zuschlag.premiumTypeId,
        rateCardId: zeile.rateCardId,
        preispositionen: eingabe.preispositionen,
        stichtag: eingabe.stichtag,
      })
      if (art === undefined || satz === null) {
        maengel.push({
          timesheetNumber: zeile.timesheetNumber,
          assignmentNumber: zeile.assignmentNumber,
          premiumCode: art?.code ?? zuschlag.premiumTypeId,
          reason:
            art === undefined
              ? 'Die Zuschlagsart steht nicht im Katalog (3.8).'
              : 'Die Preisliste dieser Seite führt für diese Zuschlagsart keinen gültigen ' +
                'Zuschlagssatz (3.3). Der Vorbelegungswert der Zuschlagsart tritt nicht ein — ' +
                'er ist keine Vereinbarung zwischen den Parteien.',
        })
        continue
      }
      const einzelpreis =
        art.calculationBase === 'percentage'
          ? (zeile.basePrice * satz.value) / 100
          : satz.value
      positionen.push({
        timesheetId: zeile.timesheetId,
        assignmentId: zeile.assignmentId,
        premiumTypeId: zuschlag.premiumTypeId,
        quantity: zuschlag.hours,
        unitPrice: einzelpreis,
        amount: zuschlag.hours * einzelpreis,
        rateCardItemId: satz.rateCardItemId,
        costCenterId: zeile.costCenterId,
      })
    }
  }

  return { positionen, maengel }
}

/**
 * Der Zuschlagssatz einer Art aus der Preisliste **dieser Seite** (3.3).
 *
 * Gesucht wird in der Preisliste, zu der der Grundsatz des Einsatzes gehört —
 * nicht in allen Preislisten: die Einkaufs- und die Kundenpreisliste führen
 * dieselbe Zuschlagsart mit verschiedenen Werten, und ihre Differenz ist die
 * Marge des Betreibers ([41], [42]). Eine Suche über beide Seiten würde sie
 * zufällig vermischen.
 *
 * Mehrere gültige Sätze: der **später** beginnende gilt — dieselbe Regel wie
 * bei den Tarifzuordnungen in 5.1.2. Ein Satz ohne Laufzeit gilt immer (3.3:
 * „abweichend von der Preisliste", also optional).
 */
function zuschlagssatz(eingabe: {
  readonly premiumTypeId: string
  readonly rateCardId: string | null
  readonly preispositionen: readonly Preisposition[]
  readonly stichtag: Date
}): { readonly value: number; readonly rateCardItemId: string } | null {
  if (eingabe.rateCardId === null) return null
  const einschlaegig = eingabe.preispositionen.filter(
    (position) =>
      position.rateCardId === eingabe.rateCardId &&
      position.itemType === 'premiumRate' &&
      position.premiumTypeId === eingabe.premiumTypeId &&
      position.premiumValue !== null &&
      giltAm(position, eingabe.stichtag),
  )
  const spaeteste = [...einschlaegig].sort(
    (a, b) => (b.validFrom?.getTime() ?? 0) - (a.validFrom?.getTime() ?? 0),
  )[0]
  if (spaeteste === undefined || spaeteste.premiumValue === null) return null
  return { value: spaeteste.premiumValue, rateCardItemId: spaeteste.id }
}

function giltAm(position: Preisposition, stichtag: Date): boolean {
  if (position.validFrom !== null && position.validFrom > stichtag) return false
  if (position.validTo !== null && position.validTo < stichtag) return false
  return true
}

export interface Belegsummen {
  readonly netAmount: number
  readonly taxAmount: number
  readonly grossAmount: number
}

/**
 * Netto, Steuer und Brutto eines Belegs (3.9, *abgeleitet*).
 *
 * **Ungerundet** (*offene Frage 53*): ob die Summe der gerundeten Positionen
 * oder die gerundete Summe gilt, ist nicht entschieden, und beide Wege ergeben
 * verschiedene Beträge. Der Steuersatz ist eine **Angabe am Beleg** (*offene
 * Frage 52*) — ein Satz im Code wäre ein Festwert ohne Fundstelle, und 0 %
 * wäre eine stillschweigende Behauptung über die Steuerpflicht.
 */
export function belegsummen(
  positionen: readonly Belegposition[],
  taxRate: number,
): Belegsummen {
  const netAmount = positionen.reduce((summe, position) => summe + position.amount, 0)
  const taxAmount = (netAmount * taxRate) / 100
  return { netAmount, taxAmount, grossAmount: netAmount + taxAmount }
}

/**
 * Stimmen die Summen des Belegs mit seinen Positionen überein (4.5.2,
 * `created` → `inReview`: „Summen abgeleitet und mit den Zetteln
 * abgeglichen")?
 *
 * Geprüft wird beides, was ein Beleg behaupten kann: dass seine Summen aus
 * seinen Positionen folgen **und** dass seine Mengen aus den Zetteln folgen.
 * Das erste allein wäre ein in sich stimmiger Beleg über fremde Stunden.
 *
 * Verglichen wird mit einer Toleranz von einem Zehntausendstel — der
 * Nachkommastelle, mit der die Beträge geführt werden (3.3, 3.9). Ein
 * Gleichheitsvergleich auf Gleitkommazahlen wäre an dieser Stelle eine
 * Fehlerquelle ohne fachlichen Grund.
 */
export function summenStimmen(eingabe: {
  readonly positionen: readonly Belegposition[]
  readonly netAmount: number
  readonly taxAmount: number
  readonly grossAmount: number
  readonly taxRate: number
  readonly zeilen: readonly Abrechnungszeile[]
}): boolean {
  const erwartet = belegsummen(eingabe.positionen, eingabe.taxRate)
  if (!nahe(erwartet.netAmount, eingabe.netAmount)) return false
  if (!nahe(erwartet.taxAmount, eingabe.taxAmount)) return false
  if (!nahe(erwartet.grossAmount, eingabe.grossAmount)) return false

  for (const zeile of eingabe.zeilen) {
    const eigene = eingabe.positionen.filter((position) => position.timesheetId === zeile.timesheetId)
    const grund = eigene.find((position) => position.premiumTypeId === null)
    const grundmenge = grund?.quantity ?? 0
    if (!nahe(grundmenge, zeile.baseHours)) return false
    for (const zuschlag of zeile.premiumHours) {
      if (zuschlag.hours <= 0) continue
      const position = eigene.find((eintrag) => eintrag.premiumTypeId === zuschlag.premiumTypeId)
      if (position === undefined || !nahe(position.quantity, zuschlag.hours)) return false
    }
  }
  return true
}

function nahe(a: number, b: number): boolean {
  return Math.abs(a - b) < 0.0001
}
