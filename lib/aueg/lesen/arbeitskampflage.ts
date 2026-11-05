/**
 * Die Lage lesen, gegen die P7 rechnet (SPEC 5.3.2).
 *
 * **Lesarten, die hier festgelegt sind:**
 *
 *  1. **Nur eine erfasste Anzeige ist eine Anzeige.** „Tatsächlich läuft an
 *     diesem Standort ein Arbeitskampf, den niemand gemeldet hat" ist keine
 *     Arbeitskampfanzeige. Das ist der Kern des Grenzfalls „Fehlende Angaben"
 *     aus 5.3.2: die Regel ist nur so gut wie die Meldedisziplin des
 *     Entleihers, und ein Satz über die Wirklichkeit außerhalb des Systems
 *     ändert keine Daten (wie Lesart 3 in `kandidatenlage.ts`).
 *  2. **Die Anzeige hängt am Standort**, nicht am Einsatz und nicht am
 *     Lieferanten (5.3.2, Grenzfall „Lieferantenwechsel"). Nennt ein Satz
 *     einen anderen Standort als den des Vorgangs, gilt die Anzeige nicht.
 *  3. **Ein fehlendes Bis-Datum ist eine Angabe, keine Lücke.** „ab dem
 *     10.09.2026 ohne Enddatum" heißt: der Arbeitskampf läuft. Der Zeitraum
 *     ist bis auf Weiteres betroffen.
 *  4. **Ob die Zusicherung den Stichtag deckt, liest dieser Leser.** Die
 *     Zusicherung ist behelfsweise ein Dokument und kein Zeitraumfeld
 *     (*offene Frage 30*); deckt der Vorgang Tage ausdrücklich ab, werden sie
 *     mit dem Stichtag verglichen, sagt er nur „liegt vor", gilt sie.
 *  5. **Der Prüfzeitraum folgt 5.3.2 Schritt 1**, nicht dem Tag des Aufrufs:
 *     bei → `tendered` der Zeitraum bis `offerDeadline`, bei `planned` →
 *     `active` der `actualStartDate`, im nächtlichen Lauf der Tag des Laufs,
 *     bei einer nachgetragenen Anzeige der Zeitraum des Einsatzes.
 */

import { istTag, type Tag } from '../kalender'
import {
  zeileFuerNachtlauf,
  zeileFuerUebergang,
  type Objektart,
  type Querschnittzeile,
} from '../querschnitt'
import type {
  Arbeitskampfanzeige,
  Arbeitskampflage,
  Zusicherung,
} from '../regeln/p7Arbeitskampf'
import type { Ausloeser, Sachverhalt } from '../typen'
import {
  alsObjektart,
  DATUM,
  einTag,
  leseVorgangslage,
  neuerZeitraum,
  personAusSatz,
  type Anlass,
  type Uebersteuerungslage,
} from './vorgangslage'

export interface Arbeitskampfprueflage {
  readonly anlass: Anlass
  readonly zeile: Querschnittzeile | null
  readonly objektart: Objektart
  readonly vonStatus: string | null
  readonly nachStatus: string | null
  readonly stichtag: Tag | null
  readonly uebersteuerung: Uebersteuerungslage
  readonly person: string | null
  readonly lage: Arbeitskampflage
}

/** Liest die Lage für P7 (SPEC 5.3.2). */
export function leseArbeitskampflage(
  sachverhalte: readonly Sachverhalt[],
  ausloeser: Ausloeser,
): Arbeitskampfprueflage {
  const vorgang = leseVorgangslage(sachverhalte, ausloeser)

  let person: string | null = null
  let taetigkeit: string | null = null
  let anzeige: Gelesene | null = null
  let zusicherung: Gelesene_Zusicherung | null = null
  let beginn: Tag | null = null

  for (const { satz } of vorgang.saetze) {
    const gelesenePerson = personAusSatz(satz)
    if (gelesenePerson !== null) person = gelesenePerson

    const gelesenTaetigkeit = /mit der Tätigkeit "([^"]+)"/.exec(satz)?.[1]
    if (gelesenTaetigkeit !== undefined) taetigkeit = gelesenTaetigkeit

    const gelesen = leseAnzeige(satz)
    if (gelesen !== undefined) anzeige = gelesen

    const gelesenZusicherung = leseZusicherung(satz)
    if (gelesenZusicherung !== undefined) zusicherung = gelesenZusicherung

    const gelesenBeginn = leseBeginn(satz)
    if (gelesenBeginn !== null) beginn = gelesenBeginn
  }

  const uebersteuert =
    vorgang.anlass === 'uebersteuerung' || vorgang.anlass === 'uebersteuerungsversuch'
  const gelesene = alsObjektart(ausloeser.objektart)
  const objektart: Objektart = uebersteuert
    ? (vorgang.gesperrterVorgang?.objektart ?? gelesene)
    : gelesene !== 'unbekannt'
      ? gelesene
      : (vorgang.vorgangsart ?? 'unbekannt')
  const nachStatus = uebersteuert
    ? (vorgang.gesperrterVorgang?.nachStatus ?? ausloeser.zielstatus)
    : ausloeser.zielstatus
  const vonStatus = uebersteuert
    ? (vorgang.vorgangsstatus ?? vorgang.gesperrterVorgang?.vonStatus ?? null)
    : vorgang.vorgangsstatus

  const zeile =
    vorgang.anlass === 'nachtlauf'
      ? zeileFuerNachtlauf('P7', objektart)
      : zeileFuerUebergang('P7', objektart, vonStatus, nachStatus)

  const standort = vorgang.standortImSzenario
  // Lesart 2: eine Anzeige für einen anderen Standort gilt dem Vorgang nicht.
  const einschlaegig =
    anzeige !== null &&
    (anzeige.standort === null || standort === null || anzeige.standort === standort)
      ? anzeige
      : null

  const { stichtag, zeitraum } = bezug(vorgang, ausloeser, zeile, beginn)

  const anzeigedaten: Arbeitskampfanzeige | null =
    einschlaegig === null
      ? null
      : {
          standort: einschlaegig.standort ?? standort,
          zeitraum: { von: einschlaegig.von, bis: einschlaegig.bis },
          bereiche: einschlaegig.bereiche,
          bereicheDeckenTaetigkeit: deckenTaetigkeit(einschlaegig, taetigkeit),
        }

  return {
    anlass: vorgang.anlass,
    zeile,
    objektart,
    vonStatus: vonStatus ?? zeile?.von ?? null,
    nachStatus: nachStatus ?? zeile?.nach ?? null,
    stichtag,
    uebersteuerung: vorgang.uebersteuerung,
    person,
    lage: {
      standort,
      taetigkeit,
      anzeige: anzeigedaten,
      zusicherung: alsZusicherung(zusicherung, stichtag),
      stichtag,
      zeitraum,
    },
  }
}

/* ------------------------------------------------------------------ */

/** Die Anzeige, wie der Satz sie nennt. `null` heißt: ausdrücklich keine. */
interface Gelesene {
  readonly standort: string | null
  readonly von: Tag
  readonly bis: Tag | null
  readonly bereiche: readonly string[]
  /** Der Vorgang sagt ausdrücklich, dass die Bereiche die Tätigkeit umfassen. */
  readonly umfasstTaetigkeit: boolean | null
}

interface Gelesene_Zusicherung {
  readonly datum: Tag | null
  readonly person: string | null
  /** Tage, die der Vorgang als abgedeckt nennt; leer heißt „ohne Angabe". */
  readonly gedeckteTage: readonly Tag[]
}

/**
 * `undefined` — der Satz sagt nichts über eine Anzeige; `null` — es ist
 * ausdrücklich keine erfasst (Lesart 1).
 */
function leseAnzeige(satz: string): Gelesene | null | undefined {
  if (!/Arbeitskampf/.test(satz)) return undefined

  // Lesart 1: ein Arbeitskampf, den niemand gemeldet hat, ist keine Anzeige.
  if (/niemand gemeldet/.test(satz)) return undefined
  if (/keine Arbeitskampfanzeige/.test(satz)) return null

  const standort = standortAusSatz(satz)
  const bereiche = leseBereiche(satz)
  const umfasstTaetigkeit = /die die Tätigkeit des Einsatzes umfassen|umfasst die Tätigkeit/.test(
    satz,
  )
    ? true
    : null

  // Lesart 3: „ohne Enddatum" und „ab dem …" sind offene Zeiträume.
  const offen =
    einTag(satz, new RegExp(`ab dem ${DATUM} ohne Enddatum`)) ??
    (/\bbis\b/.test(satz) ? null : einTag(satz, new RegExp(`ab dem ${DATUM}`)))
  if (offen !== null) {
    return { standort, von: offen, bis: null, bereiche, umfasstTaetigkeit }
  }

  const geschlossen =
    neuerZeitraum(satz, new RegExp(`Arbeitskampfanzeige vom ${DATUM} bis (?:zum )?${DATUM}`)) ??
    neuerZeitraum(
      satz,
      new RegExp(`Arbeitskampfanzeige für den Zeitraum vom ${DATUM} bis (?:zum )?${DATUM}`),
    ) ??
    neuerZeitraum(satz, new RegExp(`vom ${DATUM} bis (?:zum )?${DATUM}`))
  if (geschlossen === null) return undefined
  return {
    standort,
    von: geschlossen.von,
    bis: geschlossen.bis,
    bereiche,
    umfasstTaetigkeit,
  }
}

/** Die Bereiche, die eine Anzeige benennt (5.3.2, „betroffene Bereiche"). */
function leseBereiche(satz: string): readonly string[] {
  const treffer = /nennt nur (?:den Bereich|die Bereiche) (.+)$/.exec(satz)?.[1]
  if (treffer === undefined) return []
  return [...treffer.matchAll(/"([^"]+)"/g)]
    .map((eintrag) => eintrag[1])
    .filter((wert): wert is string => wert !== undefined)
}

/**
 * Deckt die Anzeige die Tätigkeit des Einsatzes ab?
 *
 * `null` — die Anzeige nennt keine Bereiche; dann ist der Betrieb als Ganzes
 * betroffen. Sonst entscheidet, ob die Tätigkeit unter den genannten Bereichen
 * steht. Dieser Vergleich **mildert** nur: er kann eine Sperre zur Warnung
 * machen, nie eine Warnung zur Sperre (5.3.2, Grenzfall „Nur ein Teil des
 * Betriebs betroffen" — die Beurteilung bleibt beim Entleiher).
 */
function deckenTaetigkeit(anzeige: Gelesene, taetigkeit: string | null): boolean | null {
  if (anzeige.umfasstTaetigkeit === true) return true
  if (anzeige.bereiche.length === 0) return null
  if (taetigkeit === null) return null
  return anzeige.bereiche.some((bereich) => bereich === taetigkeit)
}

/**
 * `undefined` — der Satz sagt nichts; `null` — ausdrücklich keine Zusicherung.
 */
function leseZusicherung(satz: string): Gelesene_Zusicherung | null | undefined {
  if (!/Zusicherung/.test(satz)) return undefined
  if (/keine Zusicherung/.test(satz)) return null
  if (!/liegt eine Zusicherung|Zusicherung .*vor\b/.test(satz)) return undefined

  const gedeckte = [...satz.matchAll(/die den (\d{2})\.(\d{2})\.(\d{4}) abdeckt/g)].map(
    (treffer) => `${treffer[3]}-${treffer[2]}-${treffer[1]}` as Tag,
  )
  return {
    datum: einTag(satz, new RegExp(`Zusicherung vom ${DATUM}`)),
    person: /erklärender Person/.test(satz) ? '(Person genannt, Feld fehlt in 3.7)' : null,
    gedeckteTage: gedeckte,
  }
}

/** Lesart 4: ob die Zusicherung den Stichtag deckt, entscheidet der Vorgang. */
function alsZusicherung(
  gelesen: Gelesene_Zusicherung | null,
  stichtag: Tag | null,
): Zusicherung | null {
  if (gelesen === null) return null
  const deckt =
    gelesen.gedeckteTage.length === 0
      ? true
      : stichtag !== null && gelesen.gedeckteTage.includes(stichtag)
  return { datum: gelesen.datum, person: gelesen.person, decktStichtag: deckt }
}

/** Der erste Überlassungstag bzw. der Tag, auf den der Vorgang zielt. */
function leseBeginn(satz: string): Tag | null {
  return (
    einTag(satz, new RegExp(`tatsächlichem Beginn ${DATUM}`)) ??
    einTag(satz, new RegExp(`tatsächliche(?:r)? Beginn ist der ${DATUM}`)) ??
    einTag(satz, new RegExp(`soll am ${DATUM} (?:an diesem Standort )?beginnen`)) ??
    einTag(satz, new RegExp(`Einsatzstart (?:am )?${DATUM}`)) ??
    einTag(satz, new RegExp(`geplantem Beginn ${DATUM}`))
  )
}

/**
 * Stichtag und Prüfzeitraum nach 5.3.2 Schritt 1 (Lesart 5).
 *
 * Bei → `tendered` ist der Prüfzeitraum maßgeblich: zum Zeitpunkt der
 * Ausschreibung steht nicht fest, ob der Arbeitskampf beim Einsatzstart noch
 * läuft, und deshalb prüft 4.7 dort den **Zeitraum** bis zur Angebotsfrist.
 */
function bezug(
  vorgang: ReturnType<typeof leseVorgangslage>,
  ausloeser: Ausloeser,
  zeile: Querschnittzeile | null,
  beginn: Tag | null,
): { stichtag: Tag | null; zeitraum: { von: Tag | null; bis: Tag | null } | null } {
  const genannt = istTag(ausloeser.stichtag) ? ausloeser.stichtag : null

  if (vorgang.anlass === 'nachtlauf') {
    return { stichtag: genannt, zeitraum: null }
  }

  if (zeile?.nach === 'tendered' || vorgang.zeit.angebotsfrist !== null) {
    return {
      stichtag: null,
      zeitraum: {
        von: vorgang.zeit.uebergangstag ?? genannt,
        bis: vorgang.zeit.angebotsfrist,
      },
    }
  }

  // Eine nachgetragene Anzeige wird gegen den Zeitraum des Einsatzes geprüft:
  // sie soll offenlegen, dass ein Einsatz in einem betroffenen Zeitraum lief
  // (5.3.2, Grenzfall „Rückwirkende Anzeige").
  if (vorgang.anlass === 'erfassung' || vorgang.anlass === 'berichtigung') {
    const einsatz = vorgang.zeit.geplant
    if (einsatz !== null) {
      return { stichtag: null, zeitraum: { von: einsatz.von, bis: einsatz.bis } }
    }
  }

  const stichtag = genannt ?? vorgang.zeit.tatsaechlicherBeginn ?? beginn
  return { stichtag, zeitraum: null }
}

/** Der Standort, den ein Satz über die Anzeige benennt (3.1). */
function standortAusSatz(satz: string): string | null {
  return (
    /für den Standort(?:s|es)?\s+"([^"]+)"/.exec(satz)?.[1] ??
    /am Standort\s+"([^"]+)"/.exec(satz)?.[1] ??
    null
  )
}
