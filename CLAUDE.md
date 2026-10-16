# Arbeitsregeln für dieses Projekt

Prototyp eines Vendor-Management-Systems (VMS) für Arbeitnehmerüberlassung in
Deutschland. Funktionales Vorbild ist ivocoPro. **Es wird kein fremder Code,
kein Markup und kein Text übernommen** — ausschließlich Eigenentwicklung auf
Basis von [SPEC.md](SPEC.md).

## Betreibermodell

Das VMS wird aus Sicht eines **MSP / Personaldienstleisters** gebaut: Ein
Betreiber steuert damit mehrere Kunden (Entleiher) und mehrere Lieferanten
(Sub-Verleiher). Datentrennung zwischen Kunden und zwischen Lieferanten ist
Pflicht, kein nachträgliches Feature.

## Harte Regeln

1. **Tests in `tests/aueg/` werden nie geändert, um sie grün zu bekommen.**
   Diese Dateien sind die ausführbare Fassung der AÜG-Regeln. Schlägt ein Test
   fehl, wird der Anwendungscode korrigiert. Ein Test darf nur geändert werden,
   wenn sich die Rechtslage oder die Spezifikation ändert — und dann mit einer
   expliziten Begründung in [PROGRESS.md](PROGRESS.md).
2. **Keine Zugangsdaten in Dateien außer `.env`.** Keine Passwörter, Tokens,
   API-Keys, Verbindungsstrings oder Kundendaten in Code, Markdown, Fixtures,
   Commit-Messages oder Kommentaren. `.env` ist in `.gitignore`;
   [.env.example](.env.example) enthält nur leere Platzhalter.
3. **Keine Echtdaten.** Keine echten Personen-, Kunden- oder Lohndaten im
   Repository oder in der Entwicklungsdatenbank. Testdaten sind synthetisch.
4. **Fortschritt wird in [PROGRESS.md](PROGRESS.md) dokumentiert** — am Ende
   jeder Arbeitseinheit: was gemacht wurde, welche Entscheidungen gefallen
   sind, was offen bleibt.
5. **Offene fachliche Fragen werden nicht geraten.** Sie kommen in den
   Abschnitt „Offene Fragen" in [SPEC.md](SPEC.md) und werden nachgefragt.

## Spezifikation vor Code

[SPEC.md](SPEC.md) ist führend. Code, der von der Spezifikation abweicht, ist
ein Fehler im Code oder in der Spezifikation — nie ein stillschweigender
Kompromiss. Änderungen an der Fachlogik beginnen in SPEC.md.

## Sprache

- Dokumentation (Markdown, Kommentare zu Fachlogik): **Deutsch**
- Bezeichner, Dateinamen, Code: **Englisch**
- Deutsche Rechts- und Fachbegriffe werden im Glossar in SPEC.md auf die
  englischen Bezeichner gemappt (z. B. Höchstüberlassungsdauer →
  `maxAssignmentDuration`). Nicht improvisieren, Glossar nutzen und erweitern.

## Tests

- AÜG-Regeln: Gherkin-`.feature`-Dateien in `tests/aueg/`, fachlich lesbar und
  stack-neutral. Siehe [tests/aueg/README.md](tests/aueg/README.md).
- Alles andere: Tests neben dem Code, Framework folgt dem Tech-Stack.

## Tech-Stack

**Noch nicht entschieden** — siehe „Offene Fragen" in SPEC.md. Bis zur
Entscheidung entsteht kein Anwendungscode, der einen Stack voraussetzt.
Hosting-Ziel ist ein Hoster mit Serverstandort Deutschland/EU (AVV-fähig).

## Commits

- Kleine, thematisch saubere Commits, Betreff auf Deutsch.
- Keine Geheimnisse, keine Echtdaten, keine generierten Artefakte.
