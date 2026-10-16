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

## Reihenfolge

Szenarien werden geschrieben, **bevor** die zugehörige Logik entsteht
(Meilenstein M2 vor M3/M4). Ein rotes Szenario ist der Normalzustand, bis die
Implementierung nachzieht.

## Noch offen

- Welcher Gherkin-Runner die Dateien ausführt, hängt am Tech-Stack
  (offene Frage 1 in SPEC.md). Bis dahin sind die Szenarien Spezifikation in
  ausführbarer Form, aber ohne Step-Definitions.
