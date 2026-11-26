/**
 * Die E-Mail zu einer Benachrichtigung — SPEC **3.14**, „Zustellweg" und
 * „Was in der E-Mail steht".
 *
 * Hier entsteht nur **Text**. Kein Versand, kein Zugriff auf die Datenbank,
 * keine Entscheidung darüber, wer etwas erhält: der Brief ist eine Funktion
 * seiner Daten, damit sein Inhalt prüfbar ist. Wer ihn bekommt, entscheidet
 * `lib/services/zustellung.ts` nach 2.3.
 *
 * **Was nicht hineinkommt.** Nichts über die Felder hinaus, die die Anzeige
 * auch zeigt. `meldung` ist nach 2.4 Regel 3 bereits auf das beschränkt, was
 * der Empfänger sehen darf; die E-Mail fügt keine Namen, keine Begründung und
 * keine Anhänge hinzu. Der Brief kennt deshalb den Vorgang nur als Objektart
 * und Verweis — dieselben zwei Werte wie der Audit-Eintrag (3.12).
 */

/** Was eine Benachrichtigung für den Brief hergibt (3.14). */
export interface Briefdaten {
  /** Art in Worten: „Information", „Warnung", „Warnung mit Eskalation". */
  readonly art: string
  /** Anlass in Worten, aus dem Katalog der Anlässe (3.14). */
  readonly anlass: string
  readonly meldung: string
  readonly objectType: string
  readonly objectRef: string
  /** Lesbare Benennung des Vorgangs (3.14); leer, wo keine vorliegt. */
  readonly bezeichnung: string | null
  /** Adressierte Rolle als Kürzel oder Bezeichner (2.1, 2.2). */
  readonly rolle: string
  readonly stufe: number
  readonly pruefung: string | null
  readonly statusFrom: string | null
  readonly statusTo: string | null
  readonly raisedAt: Date
  /** Stichtag des nächtlichen Laufs; leer bei einer Nachricht aus einem Übergang. */
  readonly runDate: Date | null
}

/** Ein fertiger Brief: Empfänger, Betreff, Text — mehr hat eine E-Mail nicht. */
export interface Brief {
  /** E-Mail-Adresse; im Datenmodell die Anmeldekennung (3.11). */
  readonly empfaenger: string
  readonly betreff: string
  readonly text: string
}

function zeitpunkt(wert: Date): string {
  return `${wert.toISOString().slice(0, 16).replace('T', ' ')} UTC`
}

function tag(wert: Date): string {
  return wert.toISOString().slice(0, 10)
}

/**
 * Der Betreff: **Art und Anlass**, dazu der Vorgang.
 *
 * Die Art steht vorn, weil sie das Einzige ist, was in einer Postfachliste
 * ohne Öffnen erkennbar sein muss — eine Warnung mit Eskalation darf nicht wie
 * eine Information aussehen (2.4).
 */
export function betreff(daten: Briefdaten): string {
  // Die **Benennung** steht im Betreff, nicht die technische Kennung: ein
  // Betreff mit einem Schlüssel aus 24 Zeichen sagt dem Empfänger nichts
  // (3.14, „Was in der E-Mail steht"). Fehlt sie, bleibt die Kennung.
  return `[VMS] ${daten.art}: ${daten.anlass} — ${daten.bezeichnung ?? daten.objectRef}`
}

/**
 * Der Text. Jede Zeile ist ein Feld der Benachrichtigung; die Meldung steht
 * zuerst, weil sie der Inhalt ist und alles Weitere nur ihre Einordnung.
 *
 * `basisadresse` ist optional: ist sie gesetzt, endet der Brief mit dem Weg
 * ins Postfach. Fehlt sie, fehlt der Hinweis — eine geratene Adresse wäre ein
 * Link, der nirgends hinführt.
 */
export function brieftext(daten: Briefdaten, basisadresse: string | null = null): string {
  const zeilen: string[] = [daten.meldung, '']
  zeilen.push(`Vorgang:    ${daten.bezeichnung ?? daten.objectType}`)
  zeilen.push(`Verweis:    ${daten.objectType} ${daten.objectRef}`)
  zeilen.push(`Anlass:     ${daten.anlass}`)
  zeilen.push(`Art:        ${daten.art}`)
  zeilen.push(`Adressiert: ${daten.rolle}, Stufe ${daten.stufe}`)
  if (daten.pruefung !== null) zeilen.push(`Prüfung:    ${daten.pruefung}`)
  if (daten.statusTo !== null) {
    zeilen.push(`Status:     ${daten.statusFrom ?? '—'} → ${daten.statusTo}`)
  }
  if (daten.runDate !== null) zeilen.push(`Lauf:       ${tag(daten.runDate)}`)
  zeilen.push(`Erzeugt:    ${zeitpunkt(daten.raisedAt)}`)
  zeilen.push('')
  // 2.4, Regel 1: die Nachricht ändert nichts. Das gehört in den Brief, weil
  // eine E-Mail über eine Frist sonst wie eine Fristsetzung gelesen wird.
  zeilen.push(
    'Diese Nachricht ändert nichts: sie genehmigt nicht, verlängert nicht und',
  )
  zeilen.push('besetzt nicht (SPEC 2.4, Regel 1).')
  if (basisadresse !== null && basisadresse !== '') {
    zeilen.push('')
    zeilen.push(`Im System: ${basisadresse.replace(/\/+$/, '')}/benachrichtigungen`)
  }
  return zeilen.join('\n')
}

/** Brief aus Daten und Adresse. */
export function brief(
  daten: Briefdaten,
  empfaenger: string,
  basisadresse: string | null = null,
): Brief {
  return {
    empfaenger,
    betreff: betreff(daten),
    text: brieftext(daten, basisadresse),
  }
}
