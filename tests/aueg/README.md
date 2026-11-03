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

Stand 03.11.2026: **267 Szenarien, alle 267 ausstehend.** Kein Szenario ist
grün, und das ist der erwartete Zustand — SPEC Kapitel 5 ist spezifiziert, aber
noch nicht implementiert. Jeder Schritt, dem die Fachlogik fehlt, meldet
ausdrücklich `ausstehend` mit dem Hinweis auf das fehlende Modul
`lib/aueg/pruefwerk`; **stillschweigend grün wird nichts.**

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
