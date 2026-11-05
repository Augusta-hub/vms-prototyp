/**
 * Kalendertage für die AÜG-Fristenarithmetik (SPEC 5.0, Abschnitt
 * „Fristenarithmetik").
 *
 * Die Vorgaben, die dieses Modul umsetzt:
 *
 *  - **Einheit ist der Kalendertag.** Keine Arbeitstage, keine Stunden, keine
 *    Umrechnung Monat → 30 Tage.
 *  - **Tagesgrenze 00:00 Uhr, Zeitzone `Europe/Berlin`.** Ein Zeitpunkt wird
 *    für Fristzwecke auf seinen Kalendertag abgebildet.
 *  - **Grenztage zählen mit.** Ein Zeitraum `von`–`bis` umfasst beide Randtage.
 *  - **Keine Rundung.** Tageszahlen sind ganzzahlig, weil sie gezählt werden.
 *
 * Deshalb ist ein Tag hier **keine** `Date`-Instanz, sondern die ISO-Kennung
 * `JJJJ-MM-TT`. Eine `Date` trägt eine Uhrzeit und eine Zeitzone mit sich; beim
 * Rechnen mit Kalendertagen ist beides nur eine Fehlerquelle — eine Sommerzeit-
 * grenze darf eine Fristberechnung nicht um einen Tag verschieben. Die
 * Umrechnung in UTC-Mitternacht findet ausschließlich innerhalb dieses Moduls
 * statt und ist dort reine Arithmetik, keine Zeitzonenumrechnung.
 *
 * Monatsfristen nach §§ 187 Abs. 2, 188 Abs. 2 BGB sind mit P1 (SPEC 5.1) und
 * P2 (5.1.4) hinzugekommen: die Höchstüberlassungsdauer, die Drei-Monats-Regel
 * der Unterbrechung und das Rückschaufenster der Drehtürklausel (5.3.1) rechnen
 * alle mit derselben Arithmetik, und sie gehört an **eine** Stelle.
 */

/** Ein Kalendertag als ISO-Kennung `JJJJ-MM-TT`. */
export type Tag = string

const TAGESMUSTER = /^(\d{4})-(\d{2})-(\d{2})$/
const MILLISEKUNDEN_JE_TAG = 86_400_000

/** Ist der Text ein Kalendertag in der Form `JJJJ-MM-TT` — und existiert er? */
export function istTag(wert: unknown): wert is Tag {
  if (typeof wert !== 'string') return false
  const treffer = TAGESMUSTER.exec(wert)
  if (treffer === null) return false
  // Ein Datum wie 2026-02-30 ist kein Kalendertag. Die Rückrechnung deckt das
  // auf, ohne einen eigenen Kalender zu führen.
  return alsZahl(wert) !== null
}

/**
 * Nimmt einen Tag an oder wirft. Die Grenze zwischen „gelesener Text" und
 * „Kalendertag" liegt hier und nur hier.
 */
export function tag(wert: string): Tag {
  if (!istTag(wert)) {
    throw new Error(`„${wert}" ist kein Kalendertag in der Form JJJJ-MM-TT (SPEC 5.0).`)
  }
  return wert
}

/** Zahl der Tage von `von` bis `bis`; negativ, wenn `bis` vor `von` liegt. */
export function tagesdifferenz(von: Tag, bis: Tag): number {
  return (zahl(bis) - zahl(von)) / MILLISEKUNDEN_JE_TAG
}

/** Der Tag `anzahl` Tage nach `ausgang`. Negative Werte gehen zurück. */
export function tagVersetzt(ausgang: Tag, anzahl: number): Tag {
  return alsTag(zahl(ausgang) + anzahl * MILLISEKUNDEN_JE_TAG)
}

/** Der folgende Kalendertag. */
export function folgetag(ausgang: Tag): Tag {
  return tagVersetzt(ausgang, 1)
}

/** `a` liegt vor `b` oder ist derselbe Tag. */
export function istVorOderGleich(a: Tag, b: Tag): boolean {
  return zahl(a) <= zahl(b)
}

/** Der frühere der beiden Tage. */
export function frueherer(a: Tag, b: Tag): Tag {
  return istVorOderGleich(a, b) ? a : b
}

/** Der spätere der beiden Tage. */
export function spaeterer(a: Tag, b: Tag): Tag {
  return istVorOderGleich(a, b) ? b : a
}

/**
 * Alle Kalendertage eines Zeitraums, **beide Randtage eingeschlossen**
 * (SPEC 5.0: „Ein Zeitraum von–bis umfasst beide Randtage"). Liegt `bis` vor
 * `von`, ist das Ergebnis leer — ein leerer Zeitraum ist kein Fehler, sondern
 * eine Lage, die die Regel bewertet.
 */
export function tageDesZeitraums(von: Tag, bis: Tag): Tag[] {
  const tage: Tag[] = []
  const anzahl = tagesdifferenz(von, bis)
  for (let versatz = 0; versatz <= anzahl; versatz += 1) {
    tage.push(tagVersetzt(von, versatz))
  }
  return tage
}

/**
 * Der Tag im `monate`-ten Folgemonat, der dieselbe Tageszahl trägt wie
 * `ausgang`. Gibt es ihn im Zielmonat nicht, ist es der **letzte** Tag des
 * Zielmonats (§ 188 Abs. 3 BGB; SPEC 5.0, „Fehlender Tag im Zielmonat":
 * Beginn 31.01., 1 Monat → 28.02. bzw. 29.02.).
 *
 * Negative Werte gehen zurück — das Rückschaufenster der Drehtürklausel ist
 * eine Monatsfrist in die Vergangenheit (SPEC 5.3.1, Schritt 2).
 */
export function monatsversatz(ausgang: Tag, monate: number): Tag {
  const [jahr, monat, monatstag] = zerlegt(ausgang)
  const monatszahl = jahr * 12 + (monat - 1) + monate
  const zieljahr = Math.floor(monatszahl / 12)
  const zielmonat = monatszahl - zieljahr * 12 + 1
  const zieltag = Math.min(monatstag, tageImMonat(zieljahr, zielmonat))
  return `${String(zieljahr).padStart(4, '0')}-${String(zielmonat).padStart(2, '0')}-${String(zieltag).padStart(2, '0')}`
}

/**
 * Ende einer Monatsfrist nach §§ 187 Abs. 2, 188 Abs. 2 BGB (SPEC 5.0,
 * „Monatsfristen"): beginnt die Frist mit dem Tag `T`, endet eine Frist von
 * `monate` Monaten mit dem **Vortag** des Tages im `monate`-ten Folgemonat, der
 * dieselbe Tageszahl trägt wie `T`.
 *
 * Beispiel aus 5.0: Beginn 15.01., 18 Monate → Ende 14.07. des Folgejahres.
 * Beispiel aus 5.1.4: Lückenbeginn 01.04., 3 Monate → Ende 30.06.
 */
export function monatsfristEnde(beginn: Tag, monate: number): Tag {
  const ziel = monatsversatz(beginn, monate)
  // § 188 Abs. 3 BGB (SPEC 5.0, „Fehlender Tag im Zielmonat": Beginn 31.01.,
  // 1 Monat → Ende 28.02. bzw. 29.02.): fehlt die Tageszahl im Zielmonat, endet
  // die Frist mit dem **letzten** Tag dieses Monats — nicht mit seinem Vortag.
  // Der Vortag wäre der 27.02. und damit ein Tag zu früh.
  if (zerlegt(ziel)[2] !== zerlegt(beginn)[2]) return ziel
  return tagVersetzt(ziel, -1)
}

/** Zahl der Tage eines Kalendermonats. */
export function tageImMonat(jahr: number, monat: number): number {
  return new Date(Date.UTC(jahr, monat, 0)).getUTCDate()
}

function zerlegt(wert: Tag): [number, number, number] {
  const treffer = TAGESMUSTER.exec(wert)
  if (treffer === null) {
    throw new Error(`„${wert}" ist kein Kalendertag in der Form JJJJ-MM-TT (SPEC 5.0).`)
  }
  return [Number(treffer[1]), Number(treffer[2]), Number(treffer[3])]
}

/** Liegt der Tag im Zeitraum, Randtage eingeschlossen? */
export function liegtImZeitraum(prueftag: Tag, von: Tag, bis: Tag): boolean {
  return istVorOderGleich(von, prueftag) && istVorOderGleich(prueftag, bis)
}

function zahl(wert: Tag): number {
  const zeitwert = alsZahl(wert)
  if (zeitwert === null) {
    throw new Error(`„${wert}" ist kein Kalendertag in der Form JJJJ-MM-TT (SPEC 5.0).`)
  }
  return zeitwert
}

function alsZahl(wert: string): number | null {
  const treffer = TAGESMUSTER.exec(wert)
  if (treffer === null) return null
  const [, jahr, monat, monatstag] = treffer
  if (jahr === undefined || monat === undefined || monatstag === undefined) return null
  const zeitwert = Date.UTC(Number(jahr), Number(monat) - 1, Number(monatstag))
  if (Number.isNaN(zeitwert)) return null
  // Fängt 2026-02-30 ab: Date.UTC rollt über, die Rückrechnung weicht ab.
  return alsTag(zeitwert) === wert ? zeitwert : null
}

function alsTag(zeitwert: number): Tag {
  const datum = new Date(zeitwert)
  const jahr = String(datum.getUTCFullYear()).padStart(4, '0')
  const monat = String(datum.getUTCMonth() + 1).padStart(2, '0')
  const monatstag = String(datum.getUTCDate()).padStart(2, '0')
  return `${jahr}-${monat}-${monatstag}`
}
