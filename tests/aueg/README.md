# AÜG-Tests

Dieses Verzeichnis enthält die **ausführbare Fassung der AÜG-Regeln** aus
Kapitel 5 von [SPEC.md](../../SPEC.md), als Gherkin-`.feature`-Dateien.

## Grundregel

**Diese Dateien werden nie geändert, um einen Test grün zu bekommen.**
Schlägt ein Szenario fehl, ist der Anwendungscode falsch. Eine Änderung hier
ist nur zulässig, wenn sich die Rechtslage oder die Spezifikation ändert —
und dann mit Begründung in [PROGRESS.md](../../PROGRESS.md).

## Konventionen

- Eine `.feature`-Datei je Regelbereich, benannt nach dem SPEC-Abschnitt:
  - `max-assignment-duration.feature` → SPEC 5.1
  - `equal-pay.feature` → SPEC 5.2
  - `revolving-door-and-strike.feature` → SPEC 5.3
  - `permit-and-deadlines.feature` → SPEC 5.4
- Sprache der Szenarien: **Deutsch** (`# language: de`, also
  `Funktionalität` / `Szenario` / `Angenommen` / `Wenn` / `Dann`).
  Fachlich lesbar — ein Jurist oder Disponent muss das Szenario verstehen,
  ohne Code zu lesen.
- Jedes Szenario trägt einen Verweis auf den SPEC-Abschnitt als Tag, z. B.
  `@spec-5.1` und, wo sinnvoll, die Norm als `@aueg-1-1b`.
- Erwartetes Systemverhalten wird benannt: `Information`, `Warnung` oder
  `Sperre` — nicht nur „nicht erlaubt".
- Datumsangaben absolut und synthetisch. **Keine echten Personen-, Kunden-
  oder Lohndaten.**
- Grenzfälle gehören dazu: Tag genau auf der Grenze, Unterbrechung exakt
  3 Monate, Lieferantenwechsel mitten im Einsatz, rückwirkende Korrektur.

## Vorhandene Dateien

Stand 20.10.2026 — abgeleitet aus der Querschnittstabelle 4.7 (Q01 bis Q48),
den Berechnungsvorschriften und Grenzfalltabellen aus Kapitel 5 und dem
nächtlichen Lauf (5.5.1, N1 bis N6):

| Datei | SPEC | Prüfungen | Szenarien |
|---|---|---|---|
| `max-assignment-duration.feature` | 5.1 | P1, P2 | 64 (63 Szenarien, 1 Szenariogrundriss mit 3 Beispielen) |
| `equal-pay.feature` | 5.2 | P3, P4, P5 | 49 |
| `revolving-door-and-strike.feature` | 5.3 | P6, P7, P8, P11 | 70 (68 Szenarien, 2 Szenariogrundrisse mit 7 Beispielen) |
| `permit-and-deadlines.feature` | 5.4 | P9, P10 | 71 (69 Szenarien, 2 Szenariogrundrisse mit 8 Beispielen) |

**254 Szenarien**, alle 48 Zeilen der Tabelle 4.7 belegt: je Prüfpunkt
mindestens eines, in dem die Prüfung durchgeht, und eines, in dem sie
anspricht; bei einer Sperre zusätzlich die Übersteuerung nach 5.5.4 — bei den
nicht übersteuerbaren Prüfungen P4, P6, P7 und P8 stattdessen der
zurückgewiesene Versuch.

**Tags.** `@spec-5.1` bis `@spec-5.4` (Abschnitt), `@q07` (Prüfpunkt),
`@p1` bis `@p11` (Prüfung), `@information` / `@warnung` / `@sperre`
(Ergebnisart), dazu `@grenzfall`, `@rueckwirkend`, `@uebersteuerung`,
`@keine-uebersteuerung`, `@nachtlauf`, `@frist-eskalation`, `@sichtbarkeit`,
`@rechenweg`, `@nachweisfluss` und die Norm als `@aueg-1-abs-1b`.

## Reihenfolge

Szenarien werden geschrieben, **bevor** die zugehörige Logik entsteht
(Meilenstein M2 vor M3/M4). Ein rotes Szenario ist der Normalzustand, bis die
Implementierung nachzieht.

## Ausführen

```bash
npm run test:aueg           # Suite ausführen, mit Kurzbericht
npm run test:aueg:report    # nur den Bericht neu erzeugen
```

Der Runner liegt in [tests/aueg-runner/](../aueg-runner/): `@cucumber/cucumber`
über `tsx`, deutschsprachiges Gherkin, Step-Definitions in `schritte.ts`. Die
Suite läuft **getrennt** von `npm test` — die rote AÜG-Suite darf die grüne
Unit-Suite nicht blockieren. Der ausführliche Bericht landet unter
`reports/aueg-bericht.md` und ist nicht im Repository (`.gitignore`).

Nach Tags filtern geht wie gewohnt, z. B. nur die Höchstüberlassungsdauer:

```bash
npx cucumber-js -c tests/aueg-runner/cucumber.cjs --tags @p1
```

### 254 oder 267?

Die Tabelle oben zählt **254** Szenarien, so wie sie in den Dateien stehen —
ein Szenariogrundriss ist dort eine Zeile. Der Runner führt **267** aus, weil
jeder Grundriss in seine Beispiele expandiert (63+3, 49, 68+7, 69+8). Beide
Zahlen sind richtig, sie zählen Verschiedenes.

## Stand des Regelwerks

Stand 05.11.2026: **267 Szenarien — 120 grün, 0 rot, 147 ausstehend.** Umgesetzt
sind in `lib/aueg/` **alle elf** Prüfungen:

| Prüfung | grün | rot | ausstehend | von | Kapitel |
|---|---:|---:|---:|---:|---|
| P1 Höchstüberlassungsdauer | **22** | 0 | 34 | 56 | 5.1 |
| P2 Unterbrechung und Drei-Monats-Regel | **6** | 0 | 3 | 9 | 5.1.4 |
| P3 Equal-Pay-Fälligkeit | **11** | 0 | 10 | 21 | 5.2.3 |
| P4 Vergleichsentgelt | **7** | 0 | 19 | 26 | 5.2.4 |
| P5 Branchenzuschlagsschema | **2** | 0 | 3 | 5 | 5.2.5 |
| P6 Drehtürklausel | **8** | 0 | 15 | 23 | 5.3.1 |
| P7 Einsatzverbot bei Arbeitskampf | **5** | 0 | 9 | 14 | 5.3.2 |
| P8 Kennzeichnung und Konkretisierung | **10** | 0 | 10 | 20 | 5.3.3 |
| P9 AÜG-Erlaubnis | **29** | 0 | 15 | 44 | 5.4.1 |
| P10 Pflichtnachweise | **15** | 0 | 8 | 23 | 5.4.4 |
| P11 Arbeitsverhältnis beim Verleiher | **7** | 0 | 11 | 18 | 5.3.4 |

Damit hat jede Prüfung aus 4.7 einen Rechenweg. Die Bremse aus 5.5.2 Nr. 2 —
„ein Vorgang, zu dem eine Prüfung ohne Rechenweg gehört, bleibt **ganz**
unbeurteilt" — fängt dadurch nichts mehr und bleibt trotzdem stehen: sie ist die
Haltung, nicht eine Übergangslösung. `pruefwerk.test.ts` hält beides fest, dass
sie jetzt leer läuft und was sie täte, wenn eine Prüfung ihren Rechenweg
verliert.

**P7 ist die einzige Prüfung, die den Grundsatz aus 5.0 umkehrt.** Sonst wirkt
eine fehlende Angabe wie ein Treffer; hier nicht: ohne Arbeitskampfanzeige gibt
es **keinen** Treffer, weil eine fehlende Anzeige im Regelfall bedeutet, dass
kein Arbeitskampf läuft (5.3.2). Der Preis steht in 5.5.1 — die Regel ist nur so
gut wie die Meldedisziplin des Entleihers.

Grün sind die Rechenwegszenarien dieser Prüfungen, die Übergänge Q01 bis Q04,
Q06 bis Q12, Q14 bis Q17, Q20 bis Q23, Q26, Q28, Q30, Q31, Q33, Q35, Q37, Q38,
Q41 bis Q47, die gestuften nächtlichen Läufe N1, N2, N4 und N5, die
zurückgewiesenen und die wirksamen Übersteuerungen.

**Warum die 147 ausstehen, obwohl alle elf Prüfungen laufen.** Nur noch **13**
der 254 geschriebenen Szenarien haben **keinen** Befund, und das sind genau die
ohne Prüfungszuordnung (nächtlicher Lauf, Fristeskalation). In allen anderen ist
das Prüfergebnis selbst zugesichert und grün; ausstehend bleibt jeweils ein
**anderer** Satz desselben Szenarios, den der Runner nicht maschinell prüft:

| Grund | Zusicherungen | Beispielsatz |
|---|---:|---|
| Fachliche Feststellung in Prosa (`fachaussage`) | 157 | „die Übersteuerung heilt die Rechtslage nicht", „das System unterbricht den Einsatz nicht selbst" |
| Satz nennt keinen vergleichbaren Wert (`berechneter_wert`) | 18 | „die abgeleiteten Felder sind an jedem Einsatz der Kette fortgeschrieben" |
| Rechtsfolge in Prosa (`rechtsfolge`) | 16 | „der 14.07.2027 ist der letzte zulässige Überlassungstag" |
| Datentrennung (`sichtbarkeit`) | 4 | „das Entgeltgefüge des Entleihers bleibt für Lieferantenrollen unsichtbar" |
| Übrige (`pruefbarkeit`, `kriterium` ohne genanntes Kriterium) | 4 | „wird die Lage wie »kein Eintrag« behandelt" |

Ein Teil dieser Sätze **wäre** gegen den Befund prüfbar und ist nur von der
Signaturtabelle in `tests/aueg-runner/support/erwartung.ts` als Prosa
eingeordnet. Das ist die nächste Verbesserung am **Runner**, nicht an der
Fachlogik; sie betrifft alle vier Feature-Dateien.

**Der Runner hat eine eigene Gegenprobe.** cucumber überspringt die Schritte
nach einem ausstehenden Schritt — eine falsch ausgewertete Zusicherung bleibt
dadurch unsichtbar, bis ein früherer Schritt grün wird, und wird dann plötzlich
rot. Deshalb werden **alle** Zusicherungen jedes Szenarios zusätzlich ohne das
Überspringen durchgerechnet. Mit 5.2 hat das vier solche Fälle gefunden, darunter
eine echte Lücke in der Fachlogik (5.2.6, „mindestens eine Warnung"). Mit 5.3
kamen drei dazu, alle im Runner: die Art `kriterium` war als auswertbar geführt,
hatte aber keinen Auswertungszweig — bei P8 sind K1 bis K5 die **ganze** Prüfung;
„ist der 20.09.2026 ein betroffener Tag" galt als Prosa; und ein Protokolleintrag
war erfüllt, sobald irgendein Befund irgendeine Begründung trug, ohne dass
`ruleRef` und `result` verglichen wurden. Die Einordnung und die Auswertung sind
in `tests/aueg-runner/support/erwartung.test.ts` und `auswertung.test.ts`
festgenagelt. Stand jetzt: **559 Zusicherungen erfüllt, 0 verletzt, 239
ausstehend.**

Ein Szenario gilt erst als grün, wenn **jede** seiner Zusicherungen geprüft ist.

| Prüfung | Szenarien | Regel |
|---|---|---|
| P1 | 56 | Höchstüberlassungsdauer (SPEC 5.1) |
| P2 | 9 | Unterbrechung und Drei-Monats-Regel (5.1) |
| P3 | 21 | Equal-Pay-Fälligkeit (5.2) |
| P4 | 26 | Vergleichsentgelt (5.2) |
| P5 | 5 | Branchenzuschlagsschema (5.2) |
| P6 | 23 | Drehtürklausel (5.3) |
| P7 | 14 | Einsatzverbot bei Arbeitskampf (5.3) |
| P8 | 20 | Kennzeichnung und Konkretisierung (5.3) |
| P9 | 44 | AÜG-Erlaubnis (5.4) |
| P10 | 23 | Pflichtnachweise (5.4) |
| P11 | 18 | Arbeitsverhältnis beim Verleiher (5.3) |
| — | 13 | ohne Prüfungszuordnung (nächtlicher Lauf, Fristeskalation) |

Diese Tabelle ist der Fortschrittsmesser für M4 und M5: sie zeigt, wie viel vom
Regelwerk tatsächlich läuft, nicht wie viel beschrieben ist.


## Noch offen

- Die 13 Szenarien ohne Prüfungszuordnung sind dem Bericht nach Prüfung nicht
  zuzuordnen (nächtlicher Lauf N1–N6, Fristeskalation). Sie sind nicht
  vergessen, nur anders eingeordnet.
- Das Modul `lib/aueg/pruefwerk` mit `pruefe()` ist die eine Stelle, an der die
  Suite ansetzt. Es entsteht mit M4.
