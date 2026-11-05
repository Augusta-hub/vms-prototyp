/**
 * Zusicherungen gegen den Befund auswerten.
 *
 * Bis zu dieser Arbeitseinheit hat der Runner nur die Ergebnisart geprüft; alle
 * anderen Zusicherungsarten meldete er als ausstehend, auch wenn ein Befund
 * vorlag. Damit konnte kein Szenario gruen werden — jedes sichert mehr zu als
 * die Ergebnisart.
 *
 * Dieses Modul wertet die Arten aus, die der Befund strukturiert hergibt:
 * Deckung, Vorgangsstatus, Protokolleintrag, gerechnete Werte, Adressierung
 * und die zurueckgewiesene Uebersteuerung. Grundsatz bleibt: **was nicht
 * entschieden werden kann, gilt als ausstehend**, nicht als erfuellt. Jede
 * Pruefung unten vergleicht wirklich — keine gibt `erfuellt` zurueck, nur weil
 * ein Befund existiert.
 *
 * Fachliche Feststellungen in Prosa (`fachaussage`, `rechtsfolge`) bleiben
 * bewusst ausstehend: sie sind Spezifikation, kein Rechenergebnis.
 */

import type { Befund } from './pruefwerk'
import type { Erwartung } from './erwartung'

export type Auswertung =
  | { ergebnis: 'erfuellt' }
  | { ergebnis: 'verletzt'; grund: string }
  | { ergebnis: 'ausstehend'; grund: string }

const ERFUELLT: Auswertung = { ergebnis: 'erfuellt' }

/** Wertet eine Zusicherung aus, soweit der Befund es hergibt. */
export function werteAus(erwartung: Erwartung, befunde: readonly Befund[]): Auswertung {
  switch (erwartung.art) {
    case 'ergebnisart':
      return werteErgebnisart(erwartung, befunde)
    case 'deckung':
      return werteDeckung(erwartung, befunde)
    case 'vorgangsstatus':
      return werteVorgangsstatus(erwartung, befunde)
    case 'kriterium':
      return werteKriterium(erwartung, befunde)
    case 'betroffenheit':
      return werteBetroffenheit(erwartung, befunde)
    case 'uebersteuerung_zurueckgewiesen':
      return werteUebersteuerung(befunde)
    case 'protokolleintrag':
      return werteProtokoll(erwartung, befunde)
    case 'berechneter_wert':
      return werteBerechnetenWert(erwartung, befunde)
    case 'adressierung':
      return werteAdressierung(erwartung, befunde)
    case 'pruefbarkeit':
      return wertePruefbarkeit(erwartung, befunde)
    default:
      return {
        ergebnis: 'ausstehend',
        grund: `Zusicherungsart "${erwartung.art}" ist eine fachliche Feststellung, kein Rechenergebnis`,
      }
  }
}

function werteErgebnisart(erwartung: Erwartung, befunde: readonly Befund[]): Auswertung {
  const erwartet = erwartung.ergebnisart
  if (erwartet === null) {
    return { ergebnis: 'ausstehend', grund: 'der Satz nennt keine Ergebnisart' }
  }

  if (erwartet === 'treffer') {
    const treffer = befunde.some((befund) => befund.ergebnisart !== 'information')
    return treffer
      ? ERFUELLT
      : { ergebnis: 'verletzt', grund: `erwartet war ein Treffer, Befunde: ${alsText(befunde)}` }
  }

  // Nennt der Satz mehrere Pruefungen ("die Ergebnisse der Pruefungen P9 und
  // P10 sind Informationen"), muss **jede** von ihnen dieses Ergebnis tragen.
  // Ein `some` ueber alle Befunde wuerde die eine durch die andere decken.
  const genannt = erwartung.werte.pruefungen
  if (genannt.length > 1) {
    const fehlend = genannt.filter(
      (name) =>
        !befunde.some((befund) => befund.pruefung === name && befund.ergebnisart === erwartet),
    )
    return fehlend.length === 0
      ? ERFUELLT
      : {
          ergebnis: 'verletzt',
          grund: `${fehlend.join(', ')} trägt nicht "${erwartet}", Befunde: ${alsText(befunde)}`,
        }
  }

  return befunde.some((befund) => befund.ergebnisart === erwartet)
    ? ERFUELLT
    : {
        ergebnis: 'verletzt',
        grund: `erwartete Ergebnisart "${erwartet}" fehlt, Befunde: ${alsText(befunde)}`,
      }
}

/**
 * Pruefbarkeit (SPEC 5.0, 5.4.6): eine fehlende Angabe wird wie „ja" gerechnet.
 * Der Befund fuehrt die gelesene Pflichtangabe mit — geprueft wird, dass sie
 * wirklich als „ja" in die Rechnung ging, nicht nur, dass ein Befund existiert.
 */
function wertePruefbarkeit(erwartung: Erwartung, befunde: readonly Befund[]): Auswertung {
  // "ist die Pruefung P6 nicht pruefbar", "ist die Ueberlassungskette nicht
  // bildbar": das ist keine Prosa, sondern der Mangel, den der Befund fuehrt.
  // Nur wenn **kein** Befund `pruefbar` oder `mangel` fuehrt, ist der Rechenweg
  // dafuer nicht da — dann ausstehend, nicht rot und nicht stillschweigend
  // gruen.
  if (/nicht (?:prüfbar|bildbar|bestimmbar)/.test(erwartung.satz)) {
    const fuehrtPruefbarkeit = befunde.some(
      (befund) => 'pruefbar' in befund.werte || 'mangel' in befund.werte,
    )
    if (!fuehrtPruefbarkeit) {
      return { ergebnis: 'ausstehend', grund: 'kein Befund führt pruefbar oder mangel' }
    }
    const unpruefbar = befunde.some(
      (befund) =>
        befund.werte['pruefbar'] === 'nein' ||
        (befund.werte['mangel'] ?? null) !== null,
    )
    return unpruefbar
      ? ERFUELLT
      : {
          ergebnis: 'verletzt',
          grund: 'erwartet war ein Mangel, der Befund nennt die Lage als prüfbar',
        }
  }

  if (!/wie "ja" gerechnet/.test(erwartung.satz)) {
    return {
      ergebnis: 'ausstehend',
      grund: 'der Satz nennt keine Annahme, die im Befund stehen müsste',
    }
  }
  const angaben = befunde.flatMap((befund) =>
    Object.values(befund.werte).filter((wert): wert is string => typeof wert === 'string'),
  )
  const wieJa = angaben.some((wert) => /nicht gesetzt .* wie .ja. gerechnet/.test(wert))
  return wieJa
    ? ERFUELLT
    : {
        ergebnis: 'verletzt',
        grund: 'kein Befund führt eine Pflichtangabe, die als „ja" gerechnet wurde',
      }
}

/**
 * Kriterien der Konkretisierungspflicht K1 bis K5 (SPEC 5.3.3).
 *
 * Die Art war in `erwartung.ts` seit der ersten Fassung als auswertbar
 * geführt, hatte hier aber keinen Zweig und fiel in den Vorgabefall — jede
 * Zusicherung über ein Kriterium blieb damit **ungeprüft** ausstehend. Das ist
 * die gefährlichere Hälfte: K1 bis K5 sind die ganze Prüfung P8.
 *
 * Verglichen wird auf der **Nummer** des Kriteriums, nicht auf seiner
 * Bezeichnung: die Szenarien kürzen („K2 Person"), SPEC 5.3.3 schreibt aus
 * („K2 Konkretisierung der Person"). Ein Textvergleich wäre ein Fehlalarm über
 * Wortwahl.
 */
function werteKriterium(erwartung: Erwartung, befunde: readonly Befund[]): Auswertung {
  const genannt = genannteKriterien(erwartung)
  if (genannt.length === 0) {
    return { ergebnis: 'ausstehend', grund: 'der Satz nennt kein Kriterium' }
  }
  if (!befunde.some((befund) => 'kriterienGeprueft' in befund.werte)) {
    return { ergebnis: 'ausstehend', grund: 'kein Befund führt kriterienGeprueft' }
  }

  const liste = (schluessel: string): readonly string[] =>
    befunde.flatMap((befund) => {
      const wert = befund.werte[schluessel]
      return typeof wert === 'string' && wert.length > 0 ? wert.split(',') : []
    })

  const geprueft = liste('kriterienGeprueft')
  const [erwartet, menge] =
    // Die Reihenfolge zählt: „nicht erfüllt" enthält „erfüllt".
    /nicht prüfbar/.test(erwartung.satz)
      ? (['nicht prüfbar', liste('kriterienNichtPruefbar')] as const)
      : /nicht erfüllt/.test(erwartung.satz)
        ? (['nicht erfüllt', liste('kriterienOffen')] as const)
        : /\berfüllt\b/.test(erwartung.satz)
          ? (['erfüllt', liste('kriterienErfuellt')] as const)
          : // „die Sperre nennt das Kriterium »K1 Kennzeichnung«", „eine Sperre
            // wegen des Kriteriums K1": genannt wird, was **nicht** trägt.
            /nennt das Kriterium|wegen des Kriteriums/.test(erwartung.satz)
            ? (['von der Sperre genannt', liste('kriterienOffen')] as const)
            : // „werden die Kriterien K1 bis K4 erneut geprüft", „prüft das
              // Kriterium K3 nur …": zugesichert ist, **dass** geprüft wird.
              (['geprüft', geprueft] as const)

  const fehlend = genannt.filter((kriterium) => !menge.includes(kriterium))
  return fehlend.length === 0
    ? ERFUELLT
    : {
        ergebnis: 'verletzt',
        grund:
          `${fehlend.join(', ')} ist nicht "${erwartet}"; der Befund führt geprüft: ` +
          `${geprueft.join(', ') || 'keines'}, erfüllt: ${liste('kriterienErfuellt').join(', ') || 'keines'}, ` +
          `offen: ${liste('kriterienOffen').join(', ') || 'keines'}, nicht prüfbar: ` +
          `${liste('kriterienNichtPruefbar').join(', ') || 'keines'}`,
      }
}

/**
 * Die genannten Kriterien, mit aufgelöster Spanne: „die Kriterien K1 bis K4"
 * nennt vier, `leseWerte` findet aber nur die beiden Ränder.
 */
function genannteKriterien(erwartung: Erwartung): readonly string[] {
  const spanne = /\bK(\d)\s+bis\s+K(\d)\b/.exec(erwartung.satz)
  if (spanne?.[1] !== undefined && spanne[2] !== undefined) {
    const von = Number(spanne[1])
    const bis = Number(spanne[2])
    if (von <= bis) {
      return Array.from({ length: bis - von + 1 }, (_, i) => `K${von + i}`)
    }
  }
  return erwartung.werte.kriterien
}

/**
 * Betroffenheit durch eine Arbeitskampfanzeige (SPEC 5.3.2). Der Befund führt
 * die geprüften Tage als `betroffeneTage` und das offene Ende als
 * `anzeigeOffen` — beides wird hier wirklich verglichen und nicht nur auf
 * Vorhandensein geprüft.
 */
function werteBetroffenheit(erwartung: Erwartung, befunde: readonly Befund[]): Auswertung {
  if (!befunde.some((befund) => 'betroffeneTage' in befund.werte)) {
    return { ergebnis: 'ausstehend', grund: 'kein Befund führt betroffeneTage' }
  }

  const betroffene = befunde.flatMap((befund) => {
    const wert = befund.werte['betroffeneTage']
    return typeof wert === 'string' && wert.length > 0 ? wert.split(',') : []
  })

  // „bis auf Weiteres betroffen" ist eine Aussage über die **offene** Anzeige
  // (5.3.2, Grenzfall „Anzeige ohne Bis-Datum"), nicht über einen Tag.
  if (/bis auf Weiteres/.test(erwartung.satz)) {
    const offen = befunde.some((befund) => befund.werte['anzeigeOffen'] === 'ja')
    if (!offen) {
      return {
        ergebnis: 'verletzt',
        grund: 'der Befund führt die Anzeige nicht als offen (anzeigeOffen ≠ ja)',
      }
    }
    return betroffene.length > 0
      ? ERFUELLT
      : { ergebnis: 'verletzt', grund: 'die offene Anzeige deckt keinen geprüften Tag' }
  }

  const genannt = erwartung.werte.datumsangaben
  if (genannt.length === 0) {
    return { ergebnis: 'ausstehend', grund: 'der Satz nennt keinen Tag' }
  }
  const verneint = /\bnicht betroffen\b|\bkein betroffener\b/.test(erwartung.satz)
  const falsch = verneint
    ? genannt.filter((tag) => betroffene.includes(tag))
    : genannt.filter((tag) => !betroffene.includes(tag))
  return falsch.length === 0
    ? ERFUELLT
    : {
        ergebnis: 'verletzt',
        grund: verneint
          ? `${falsch.join(', ')} ist betroffen, erwartet war das Gegenteil`
          : `${falsch.join(', ')} ist nicht betroffen; betroffen: ${betroffene.join(', ') || 'kein Tag'}`,
      }
}

/** Tagesgenaue Deckung des Prüfzeitraums (SPEC 5.4.1). */
function werteDeckung(erwartung: Erwartung, befunde: readonly Befund[]): Auswertung {
  // "die Warnung nennt den nicht gedeckten 01.07.2026" sichert den **Inhalt**
  // der Meldung zu, nicht die Deckung selbst (SPEC 5.5.2 Nr. 2: jede
  // Feststellung nennt ihren Gegenstand).
  if (/\bnennt\b/.test(erwartung.satz)) {
    return nenntWerte(erwartung, befunde)
  }

  const ungedeckt = zahlenwert(befunde, 'tageUngedeckt')
  if (ungedeckt === null) {
    return { ergebnis: 'ausstehend', grund: 'kein Befund nennt tageUngedeckt' }
  }

  const verlangtLuecke = /deckt (?:keinen|nichts)|nicht gedeckt|Lücke/.test(erwartung.satz)

  // Nennt der Satz einen Tag, wird **dieser Tag** geprueft und nicht nur die
  // Zahl der Luecken. "Der 01.07.2026 ist nicht gedeckt" ist eine Aussage
  // ueber den 01.07.2026; SPEC 5.4.1 Schritt 3 prueft tagesgenau, und eine
  // Zusicherung, die jede beliebige Luecke genuegen liesse, pruefte weniger
  // als das Szenario zusichert.
  const genannteTage = erwartung.werte.datumsangaben
  if (genannteTage.length > 0) {
    const ungedeckteTage = tagesliste(befunde)
    const falsch = verlangtLuecke
      ? genannteTage.filter((tag) => !ungedeckteTage.includes(tag))
      : genannteTage.filter((tag) => ungedeckteTage.includes(tag))
    if (falsch.length > 0) {
      return {
        ergebnis: 'verletzt',
        grund: verlangtLuecke
          ? `${falsch.join(', ')} ist gedeckt, erwartet war eine Lücke; ungedeckt: ${ungedeckteTage.join(', ') || 'kein Tag'}`
          : `${falsch.join(', ')} ist nicht gedeckt`,
      }
    }
    return ERFUELLT
  }

  // "deckt keinen Tag": der Satz deckt **nichts**, nicht nur einzelne Tage
  // (SPEC 5.4.1 Schritt 4, 5.4.6).
  if (/deckt (?:keinen|nichts)/.test(erwartung.satz)) {
    const gedeckt = zahlenwert(befunde, 'tageGedeckt')
    return gedeckt === 0
      ? ERFUELLT
      : { ergebnis: 'verletzt', grund: `erwartet war keine Deckung, gedeckt: ${gedeckt} Tage` }
  }

  if (verlangtLuecke) {
    return ungedeckt > 0
      ? ERFUELLT
      : { ergebnis: 'verletzt', grund: 'erwartet war eine Lücke, der Zeitraum ist voll gedeckt' }
  }
  if (/jede[rn]? Tag\b[^.]*gedeckt|vollständig gedeckt|umschließt|ist gedeckt/.test(erwartung.satz)) {
    return ungedeckt === 0
      ? ERFUELLT
      : { ergebnis: 'verletzt', grund: `erwartet war volle Deckung, ungedeckt: ${ungedeckt} Tage` }
  }
  return { ergebnis: 'ausstehend', grund: 'der Satz sagt nicht, ob Deckung oder Lücke erwartet ist' }
}

/**
 * Ob der Übergang stattgefunden hat (SPEC 5.5.2). Eine Sperre lässt ihn nicht
 * stattfinden, Information und Warnung schon.
 */
function werteVorgangsstatus(erwartung: Erwartung, befunde: readonly Befund[]): Auswertung {
  if (befunde.length === 0) {
    return { ergebnis: 'ausstehend', grund: 'kein Befund' }
  }

  // Q04 prueft je eingeladenem Lieferanten (SPEC 5.4.1). Nennt der Satz eine
  // Firma, gilt die Zusicherung nur fuer deren Befund — sonst wuerde die
  // zulaessige Einladung des einen die gesperrte des anderen verdecken.
  const einschlaegig = aufFirmaEingegrenzt(erwartung, befunde)
  if (einschlaegig === null) {
    return {
      ergebnis: 'ausstehend',
      grund: `kein Befund zum genannten Lieferanten; Befunde zu: ${lieferantenVon(befunde).join(', ') || 'keinem'}`,
    }
  }

  // Der Vorgangsstatus selbst. Der Befund fuehrt ihn als `statusNachher`: bei
  // einer Sperre bleibt der Vorgang in seinem Zustand (SPEC 4.0 Regel 5,
  // 5.5.2), bei Information und Warnung erreicht er den Zielstatus. Ohne
  // diesen Vergleich wuerde "der Status des Einsatzes ist »active«" nur
  // besagen, dass irgendein Uebergang stattfand — nicht welcher.
  const erwarteterStatus = letzterStatuswert(erwartung)
  if (erwarteterStatus !== null) {
    const erreicht = einschlaegig.some(
      (befund) => befund.werte['statusNachher'] === erwarteterStatus,
    )
    if (/\bkein(?:e|en|em|er)?\b|\bnicht\b/.test(erwartung.satz)) {
      return !erreicht
        ? ERFUELLT
        : {
            ergebnis: 'verletzt',
            grund: `der Vorgang steht in "${erwarteterStatus}" — das sollte er nicht`,
          }
    }
    return erreicht
      ? ERFUELLT
      : {
          ergebnis: 'verletzt',
          grund: `erwartet war der Status "${erwarteterStatus}", der Befund nennt ${statusAlsText(einschlaegig)}`,
        }
  }

  // `some`, nicht `every`: eine wirksame Übersteuerung liefert nach SPEC 5.5.4
  // Invariante 5 zwei Befunde — die dokumentierte Sperre und den vollzogenen
  // Übergang. Der Vorgang ist vollzogen, wenn **ein** Befund ihn vollzieht.
  const vollzogen = einschlaegig.some((befund) => befund.uebergangVollzogen)

  const verlangtKeinUebergang =
    /findet (?:der Übergang )?nicht statt|entsteht kein|bleibt (?:der|die|das|in)|unverändert|wird nicht|nicht angelegt|beendet den Einsatz nicht|erneut auszulösen/.test(
      erwartung.satz,
    )
  const verlangtUebergang =
    /findet (?:der Übergang )?statt|entstehen im Status|erscheint im Einladungskreis|Übergang statt/.test(
      erwartung.satz,
    )

  if (verlangtKeinUebergang) {
    return !vollzogen
      ? ERFUELLT
      : { ergebnis: 'verletzt', grund: 'der Übergang hätte nicht stattfinden dürfen' }
  }
  if (verlangtUebergang) {
    return vollzogen
      ? ERFUELLT
      : { ergebnis: 'verletzt', grund: 'der Übergang hätte stattfinden müssen' }
  }
  return {
    ergebnis: 'ausstehend',
    grund: 'der Satz sagt nicht eindeutig, ob der Übergang stattfinden soll',
  }
}

function werteUebersteuerung(befunde: readonly Befund[]): Auswertung {
  if (befunde.length === 0) return { ergebnis: 'ausstehend', grund: 'kein Befund' }
  return befunde.every((befund) => !befund.uebergangVollzogen)
    ? ERFUELLT
    : { ergebnis: 'verletzt', grund: 'die Übersteuerung wurde nicht zurückgewiesen' }
}

/**
 * Protokolleintrag: nach SPEC 5.5.2 Nummer 1 wird **jedes** Ergebnis
 * protokolliert, auch eine Information. Geprüft wird, dass der Befund eine
 * Begründung trägt — und, wo der Satz eine Prüfung nennt, dass es zu ihr einen
 * Befund gibt.
 */
function werteProtokoll(erwartung: Erwartung, befunde: readonly Befund[]): Auswertung {
  if (befunde.length === 0) return { ergebnis: 'ausstehend', grund: 'kein Befund' }

  const genannt = erwartung.werte.pruefungen
  if (genannt.length > 0) {
    const fehlend = genannt.filter((name) => !befunde.some((befund) => befund.pruefung === name))
    if (fehlend.length > 0) {
      return {
        ergebnis: 'verletzt',
        grund: `kein Befund zu ${fehlend.join(', ')}, protokolliert werden kann nur ${alsText(befunde)}`,
      }
    }
  }

  // „ein Protokolleintrag mit der Prüfung »industrialActionCheck« und dem
  // Ergebnis »blocked« liegt vor" nennt zwei Felder des Audit-Eintrags
  // (SPEC 3.12): `ruleRef` und `result`. Der Befund führt beide. Ohne diesen
  // Vergleich war der Satz erfüllt, sobald **irgendein** Befund irgendeine
  // Begründung trug — eine Zusicherung, die nichts einlöst.
  for (const [schluessel, werte] of [
    ['ruleRef', erwartung.werte.zitate.filter((zitat) => /Check$/.test(zitat))],
    ['result', erwartung.werte.zitate.filter((zitat) => ERGEBNISWERTE.includes(zitat))],
  ] as const) {
    for (const wert of werte) {
      if (!befunde.some((befund) => befund.werte[schluessel] === wert)) {
        const gefuehrt = [...new Set(befunde.map((befund) => String(befund.werte[schluessel])))]
        return {
          ergebnis: 'verletzt',
          grund: `kein Befund führt ${schluessel} = "${wert}" (geführt: ${gefuehrt.join(', ') || 'nichts'})`,
        }
      }
    }
  }

  return befunde.every((befund) => befund.meldung.trim().length > 0)
    ? ERFUELLT
    : { ergebnis: 'verletzt', grund: 'ein Befund trägt keine Begründung' }
}

/** `result` des Audit-Eintrags (SPEC 3.12). */
const ERGEBNISWERTE: readonly string[] = ['success', 'denied', 'blocked']

/**
 * Gerechnete Werte: der Satz nennt ein Datum oder eine Tageszahl, der Befund
 * führt sie unter `werte`. Nennt der Satz keinen prüfbaren Wert, bleibt die
 * Zusicherung ausstehend.
 */
function werteBerechnetenWert(erwartung: Erwartung, befunde: readonly Befund[]): Auswertung {
  const werte = befunde.flatMap((befund) => Object.values(befund.werte))
  if (werte.length === 0) return { ergebnis: 'ausstehend', grund: 'der Befund führt keine Werte' }

  // "die Unterbrechung ist (nicht) zaehlwirksam" und "die Zaehlwirksamkeit
  // traegt den Vermerk 'vorlaeufig'" sichern ein Ja/Nein zu, keine Zahl. Der
  // Befund fuehrt sie als "ja"/"nein" (SPEC 3.7, `countsAsReset`).
  if (/zählwirksam|Ergebnis der Bewertung/i.test(erwartung.satz)) {
    return werteJaNein(erwartung, befunde)
  }

  // "es entsteht keine Ueberlassungskette bei diesem Kunden" ist eine Aussage
  // ueber den **Kettenbeginn**, nicht ueber den Statusuebergang: der Uebergang
  // nach `terminatedEarly` findet statt, nur entsteht kein Ueberlassungstag
  // (SPEC 5.1.5, "Einsatz, der nie begonnen hat"). Die Signatur `entsteht kein`
  // der Art `vorgangsstatus` meint einen Vorgang, der nicht entsteht — eine
  // Einladung, einen Einsatz. Eine **Kette** ist kein Vorgang. Ohne diesen
  // Zweig verlangte der Lauf, dass der Uebergang unterbleibt, und machte aus
  // richtiger Fachlogik ein rotes Szenario.
  if (/entsteht keine Überlassungskette/.test(erwartung.satz)) {
    const fuehrend = befunde.filter((befund) => 'kettenbeginn' in befund.werte)
    if (fuehrend.length === 0) {
      return { ergebnis: 'ausstehend', grund: 'kein Befund führt kettenbeginn' }
    }
    const genannt = fuehrend
      .map((befund) => befund.werte['kettenbeginn'])
      .filter((wert) => wert !== null)
    return genannt.length === 0
      ? ERFUELLT
      : { ergebnis: 'verletzt', grund: `der Befund nennt den Kettenbeginn ${genannt.join(', ')}` }
  }

  const erwarteteDaten = erwartung.werte.datumsangaben
  const erwarteteTage = erwartung.werte.mengen
    .filter((menge) => menge.einheit === 'tage')
    .map((menge) => menge.wert)
  // Monatsangaben sind so vergleichbar wie Tageszahlen: der Befund fuehrt die
  // gerechnete Frist als `fristMonate` bzw. `grenzeMonate` (SPEC 5.1.2, 5.2.2).
  // Der Lauf hat sie lange nicht verglichen — "gilt die gesetzliche Regelfrist
  // von 9 Monaten" blieb ausstehend, obwohl die Fachlogik 9 rechnete. Eine
  // ungeprueffte Zusicherung ist schlimmer als eine rote.
  const erwarteteMonate = erwartung.werte.mengen
    .filter((menge) => menge.einheit === 'monate')
    .map((menge) => menge.wert)

  if (
    erwarteteDaten.length === 0 &&
    erwarteteTage.length === 0 &&
    erwarteteMonate.length === 0
  ) {
    return { ergebnis: 'ausstehend', grund: 'der Satz nennt keinen vergleichbaren Wert' }
  }

  for (const datum of erwarteteDaten) {
    if (!werte.includes(datum)) {
      return { ergebnis: 'verletzt', grund: `der Wert ${datum} kommt im Befund nicht vor` }
    }
  }
  for (const anzahl of erwarteteTage) {
    if (!werte.includes(anzahl)) {
      return { ergebnis: 'verletzt', grund: `die Tageszahl ${anzahl} kommt im Befund nicht vor` }
    }
  }
  // Die Monatszahl wird gegen die **Fristschluessel** verglichen, nicht gegen
  // alle Werte: eine 9 irgendwo im Befund ist keine Frist von 9 Monaten.
  const monatswerte = befunde.flatMap((befund) =>
    MONATSSCHLUESSEL.flatMap((schluessel) =>
      schluessel in befund.werte ? [befund.werte[schluessel]] : [],
    ),
  )
  // Die Verneinung gehoert dazu, wie bei der Ergebnisart: "es wird **nicht** mit
  // 9 Monaten gerechnet, weil die Abweichung den Tarifvertrag voraussetzt" ist
  // der Satz, mit dem SPEC 5.2.2 Fall 1 festlegt, dass eine fehlende
  // Tarifzuordnung **nicht** die Regelfrist ergibt. Ohne die Ausnahme las der
  // Lauf ihn als Zusicherung von 9 Monaten und machte aus der richtigen
  // Fachlogik — 0 Monate — ein rotes Szenario.
  const verneint = /(?:nicht|keine)[^.]{0,24}\d+\s*Monaten/.test(erwartung.satz)
  for (const anzahl of erwarteteMonate) {
    if (monatswerte.length === 0) {
      return { ergebnis: 'ausstehend', grund: 'kein Befund führt eine Frist in Monaten' }
    }
    const gefuehrt = monatswerte.includes(anzahl)
    if (verneint && gefuehrt) {
      return {
        ergebnis: 'verletzt',
        grund: `mit ${anzahl} Monaten sollte nicht gerechnet werden, der Befund führt sie aber`,
      }
    }
    if (!verneint && !gefuehrt) {
      return {
        ergebnis: 'verletzt',
        grund: `die Frist von ${anzahl} Monaten kommt im Befund nicht vor (geführt: ${monatswerte.join(', ')})`,
      }
    }
  }
  return ERFUELLT
}

/**
 * Schluessel, unter denen ein Befund eine Frist **in Monaten** fuehrt: die
 * Grenze der Hoechstueberlassungsdauer (SPEC 5.1.2) und die Equal-Pay-Frist
 * (5.2.2).
 */
const MONATSSCHLUESSEL = [
  'grenzeMonate',
  'maxAssignmentDurationMonths',
  'fristMonate',
  'equalPayDeadlineMonths',
] as const

/**
 * Eine Ja/Nein-Zusicherung gegen den Befund (SPEC 3.7, `countsAsReset`, und
 * 5.1.4). Fuehrt kein Befund den Schluessel, bleibt der Satz ausstehend — die
 * Abwesenheit eines Wertes ist kein "nein".
 */
function werteJaNein(erwartung: Erwartung, befunde: readonly Befund[]): Auswertung {
  // Der Szenariogrundriss Q25 nennt das Ergebnis der Lueckenbewertung in Worten.
  // Die drei Werte sind eine geschlossene Menge und stehen beide im Befund:
  // "keine Luecke" ist `keineLuecke`, "Reset" und "kein Reset" sind
  // `zaehlwirksam` (SPEC 5.1.4).
  const bewertung = /Ergebnis der Bewertung ist "([^"]+)"/.exec(erwartung.satz)?.[1]
  if (bewertung !== undefined) {
    const [schluessel, erwartet] = /keine Lücke/.test(bewertung)
      ? (['keineLuecke', 'ja'] as const)
      : /kein Reset/.test(bewertung)
        ? (['zaehlwirksam', 'nein'] as const)
        : /\bReset\b/.test(bewertung)
          ? (['zaehlwirksam', 'ja'] as const)
          : (['', ''] as const)
    if (schluessel === '') {
      return { ergebnis: 'ausstehend', grund: `die Bewertung "${bewertung}" ist nicht abgebildet` }
    }
    return vergleicheJaNein(schluessel, erwartet, befunde)
  }

  const schluessel = /vorläufig|Vermerk/.test(erwartung.satz) ? 'vorlaeufig' : 'zaehlwirksam'
  const gefuehrt = befunde
    .map((befund) => befund.werte[schluessel])
    .find((wert) => wert === 'ja' || wert === 'nein')
  if (gefuehrt === undefined) {
    return { ergebnis: 'ausstehend', grund: `kein Befund führt ${schluessel}` }
  }
  const erwartetNein = /\bnicht (?:zählwirksam|vorläufig)\b/.test(erwartung.satz)
  return gefuehrt === (erwartetNein ? 'nein' : 'ja')
    ? ERFUELLT
    : {
        ergebnis: 'verletzt',
        grund: `erwartet war ${schluessel} = ${erwartetNein ? 'nein' : 'ja'}, der Befund nennt ${gefuehrt}`,
      }
}

/** Vergleicht einen Ja/Nein-Schluessel des Befunds mit dem erwarteten Wert. */
function vergleicheJaNein(
  schluessel: string,
  erwartet: string,
  befunde: readonly Befund[],
): Auswertung {
  const gefuehrt = befunde
    .map((befund) => befund.werte[schluessel])
    .find((wert) => wert === 'ja' || wert === 'nein')
  if (gefuehrt === undefined) {
    return { ergebnis: 'ausstehend', grund: `kein Befund führt ${schluessel}` }
  }
  return gefuehrt === erwartet
    ? ERFUELLT
    : {
        ergebnis: 'verletzt',
        grund: `erwartet war ${schluessel} = ${erwartet}, der Befund nennt ${gefuehrt}`,
      }
}

/** Adressaten und Eskalation (SPEC 5.5.2 Nummer 6). */
function werteAdressierung(erwartung: Erwartung, befunde: readonly Befund[]): Auswertung {
  if (befunde.length === 0) return { ergebnis: 'ausstehend', grund: 'kein Befund' }

  // Platzhalter eines Szenariogrundrisses lassen sich nicht vergleichen.
  if (/<[^>]+>/.test(erwartung.satz)) {
    return { ergebnis: 'ausstehend', grund: 'der Satz nennt einen Platzhalter, keinen Adressaten' }
  }

  const adressaten = befunde.flatMap((befund) => [...befund.adressaten])
  if (/keine Benachrichtigung|kein Adressat|nicht benachrichtigt/.test(erwartung.satz)) {
    return adressaten.length === 0
      ? ERFUELLT
      : { ergebnis: 'verletzt', grund: `erwartet war kein Adressat, genannt: ${adressaten.join(', ')}` }
  }

  // Nennt der Satz eine Rolle ausdruecklich, wird sie verglichen. Die Szenarien
  // schreiben die Rolle aus, der Befund nennt das Kuerzel aus SPEC 2.1 —
  // verglichen wird auf dem Kuerzel. "zusätzlich" ist die Stufenfolge aus
  // SPEC 5.4.4 und gehoert nicht zum Rollennamen.
  const genannt = erwartung.werte.zitate
    .map((zitat) => rollenkuerzel(zitat.replace(/^zusätzlich\s+/, '').trim()))
    .filter((kuerzel): kuerzel is string => kuerzel !== null)

  if (genannt.length > 0) {
    const fehlend = genannt.filter((rolle) => !adressaten.includes(rolle))
    return fehlend.length === 0
      ? ERFUELLT
      : {
          ergebnis: 'verletzt',
          grund: `erwartete Adressaten fehlen: ${fehlend.join(', ')}; genannt: ${adressaten.join(', ') || 'keine'}`,
        }
  }

  return adressaten.length > 0
    ? ERFUELLT
    : { ergebnis: 'verletzt', grund: 'der Befund nennt keinen Adressaten' }
}

/**
 * Rollenkuerzel aus SPEC 2.1. Die Szenarien schreiben die Rolle aus, Matrix
 * und Befund fuehren das Kuerzel; ohne diese Zuordnung vergleicht man
 * "Lieferantenadministrator" mit "LA" und bekommt einen Fehlalarm.
 */
const ROLLENKUERZEL: ReadonlyArray<readonly [RegExp, string]> = [
  [/^MSP-Administrator$/, 'MA'],
  [/^MSP-Disponent$/, 'MD'],
  [/^Bedarfsträger$/, 'KB'],
  [/^Genehmiger$/, 'KG'],
  [/^Einkauf(?: ?\/ ?Controlling)?$/, 'KE'],
  [/^Lieferantendisponent$/, 'LD'],
  [/^Lieferantenadministrator$/, 'LA'],
  [/^Leiharbeitnehmer$/, 'AN'],
]

/** Das Kuerzel zu einer ausgeschriebenen Rolle, oder `null` bei etwas anderem. */
function rollenkuerzel(bezeichnung: string): string | null {
  if (/^(?:MA|MD|KB|KG|KE|LD|LA|AN)$/.test(bezeichnung)) return bezeichnung
  for (const [muster, kuerzel] of ROLLENKUERZEL) {
    if (muster.test(bezeichnung)) return kuerzel
  }
  return null
}

/**
 * Nennt die Meldung die Werte, die der Satz verlangt? Geprueft wird gegen die
 * gerechneten Werte **und** den Meldungstext — beide erreichen den Benutzer.
 */
function nenntWerte(erwartung: Erwartung, befunde: readonly Befund[]): Auswertung {
  const daten = erwartung.werte.datumsangaben
  if (daten.length === 0) {
    return { ergebnis: 'ausstehend', grund: 'der Satz nennt keinen vergleichbaren Wert' }
  }

  const text = befunde
    .map((befund) => `${befund.meldung} ${Object.values(befund.werte).join(' ')}`)
    .join(' ')

  const fehlend = daten.filter((datum) => !text.includes(datum))
  return fehlend.length === 0
    ? ERFUELLT
    : {
        ergebnis: 'verletzt',
        grund: `die Meldung nennt ${fehlend.join(', ')} nicht`,
      }
}

const FIRMA = /"([^"]*(?:GmbH|AG|KG|SE|OHG)[^"]*)"/

/**
 * Grenzt die Befunde auf die im Satz genannte Firma ein. Nennt der Satz keine,
 * bleiben alle Befunde einschlaegig. Nennt er eine, zu der es keinen Befund
 * gibt, ist das Ergebnis `null` — dann gilt die Zusicherung als ausstehend,
 * nicht als erfuellt.
 */
function aufFirmaEingegrenzt(
  erwartung: Erwartung,
  befunde: readonly Befund[],
): readonly Befund[] | null {
  const firma = FIRMA.exec(erwartung.satz)?.[1]
  if (firma === undefined) return befunde
  const treffer = befunde.filter((befund) => befund.werte['lieferant'] === firma)
  return treffer.length > 0 ? treffer : null
}

function lieferantenVon(befunde: readonly Befund[]): readonly string[] {
  const namen = befunde
    .map((befund) => befund.werte['lieferant'])
    .filter((wert): wert is string => typeof wert === 'string')
  return [...new Set(namen)]
}

/**
 * Der Statuswert, den der Satz zusichert. Die Szenarien schreiben ihn in
 * Anfuehrungszeichen und englisch wie das Datenmodell (SPEC Kapitel 4); steht
 * mehr als einer im Satz, ist der letzte der zugesicherte.
 */
function letzterStatuswert(erwartung: Erwartung): string | null {
  const werte = erwartung.werte.statuswerte
  return werte.length === 0 ? null : (werte[werte.length - 1] ?? null)
}

function statusAlsText(befunde: readonly Befund[]): string {
  const werte = befunde.map((befund) => befund.werte['statusNachher'] ?? 'keinen Status')
  return [...new Set(werte)].join(', ')
}

/** Die ungedeckten Tage, die der Befund als Liste fuehrt (SPEC 5.4.1). */
function tagesliste(befunde: readonly Befund[]): readonly string[] {
  const tage = befunde.flatMap((befund) => {
    const wert = befund.werte['ungedeckteTage']
    return typeof wert === 'string' && wert.length > 0 ? wert.split(',') : []
  })
  return [...new Set(tage)]
}

function zahlenwert(befunde: readonly Befund[], schluessel: string): number | null {
  for (const befund of befunde) {
    const wert = befund.werte[schluessel]
    if (typeof wert === 'number') return wert
  }
  return null
}

function alsText(befunde: readonly Befund[]): string {
  if (befunde.length === 0) return 'keine'
  return befunde.map((befund) => `${befund.pruefung}=${befund.ergebnisart}`).join(', ')
}
