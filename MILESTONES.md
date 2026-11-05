# Meilensteine

Ziel der ersten Phase ist eine **klickbare Demo** entlang des Kernprozesses
Stammdaten → Bedarfsanfrage → Besetzung. Alles Weitere folgt danach. Keine
Datumszusagen, solange der Tech-Stack nicht entschieden ist.

Legende: ⬜ offen · 🟨 in Arbeit · ✅ abgeschlossen

---

## M0 — Projektgerüst ✅

- ✅ Ordnerstruktur, `.gitignore` inkl. `.env`
- ✅ CLAUDE.md mit Arbeitsregeln
- ✅ SPEC.md als Gliederung
- ✅ MILESTONES.md, PROGRESS.md
- ✅ `tests/aueg/` mit README und Konventionen

## M1 — Entscheidungen und Spezifikation des Kernprozesses ⬜

- ✅ Tech-Stack entschieden: Next.js + TypeScript + PostgreSQL/Prisma
- ✅ Tarifvertrag geklärt: Tarifwerk als Konfiguration, nicht verdrahtet
- ✅ SPEC Kapitel 2 (Rollen) ausgearbeitet
- ✅ SPEC Kapitel 3.1–3.7 (Stammdaten bis Einsatz) ausgearbeitet
- ✅ SPEC Kapitel 4.1–4.3 (Statusmodelle des Kernprozesses) ausgearbeitet
- 🟨 Glossar DE → EN angelegt (Kapitel 2 bis 5 gemappt, Kapitel 6 offen)

## M2 — AÜG-Regelwerk als Testbasis ✅

- ✅ SPEC Kapitel 5.1 Höchstüberlassungsdauer ausformuliert
- ✅ SPEC Kapitel 5.2 Equal Pay ausformuliert
- ✅ SPEC Kapitel 5.4 Erlaubnis und Fristen ausformuliert
- ✅ SPEC Kapitel 5.0, 5.3 und 5.5 ausformuliert (Konventionen, Drehtür /
  Arbeitskampf / Kennzeichnung, Regelwerk-Mechanik)
- ✅ `tests/aueg/*.feature` für 5.1 bis 5.4 geschrieben — 254 Szenarien, alle
  48 Prüfpunkte aus 4.7 belegt; ohne Runner und Step-Definitions, deshalb bis
  M3 nicht ausgeführt
- ✅ Entscheidung, welche Prüfung sperrt und welche nur warnt — 4.7 bestätigt
  bzw. geändert in 5.5.5 (38 bestätigt, 6 geändert, 4 neu)

## M3 — Klickbare Demo: Stammdaten und Bedarfsanfrage ✅

- ✅ Projektsetup im gewählten Stack, lokal lauffähig — Next.js (App Router)
  mit TypeScript, Prisma auf PostgreSQL, Vitest für die Unit-Tests
- ✅ Mandanten-, Benutzer- und Rollenmodell — Objekte aus SPEC 3.11, die
  Berechtigungsmatrix 2.2 als typisierter Code mit Prüffunktion
- ✅ Kunden, Standorte, Kostenstellen, Lieferanten inkl. Erlaubnisnachweis,
  dazu Rahmenvertrag, Preislisten beider Seiten, Tarifzuordnung und
  Vergleichsentgelt (SPEC 3.1 bis 3.3)
- ✅ Bedarfsanfrage anlegen, einreichen, freigeben, an Lieferanten
  ausschreiben; Einladung absagen oder anbieten — Statusmodelle 4.1, 4.2.1 und
  4.2.2 als geschlossene Übergangsmenge
- ✅ Synthetische Demo-Daten (Seed) — Mandanten, Benutzer, Rollen,
  Betreuungszuordnungen, Vertretung, Stammdaten beider Seiten und je eine
  Bedarfsanfrage pro Zustand aus 4.1; Migration und Seed gegen die lokale
  Datenbank gelaufen

Noch **nicht** Teil von M3 und bewusst offen: der Lieferantenstatus als
Übergangsmenge (4.6), die Nebenwirkungen aus Kapitel 4 (Benachrichtigung,
Fristenlauf, Audit-Eintrag aus 3.12) und jede AÜG-Prüfung aus Kapitel 5.

## M4 — Klickbare Demo: Besetzung 🟨

Fortschrittsmesser steht: `npm run test:aueg` führt die 267 Szenarien aus und
berichtet je Prüfung P1 bis P11. Stand 05.11.2026: **120 grün, 0 rot, 147
ausstehend** — jede implementierte Prüfung schlägt sich unmittelbar in der
Tabelle nieder (siehe [tests/aueg/README.md](tests/aueg/README.md)).

- ✅ Gherkin-Runner angebunden, AÜG-Suite läuft (getrennt von `npm test`)
- ✅ AÜG-Prüfungen umgesetzt — **alle elf laufen:**
  - **P1 Höchstüberlassungsdauer** (5.1): 22 von 56 grün. Kalendarische
    Zählung über Lieferanten und Kunden hinweg entlang der **bestätigten**
    Personenidentität, Tarifabweichung als Konfiguration, Schwellen und
    Eskalation, Übersteuerung nach 5.5.4
  - **P2 Unterbrechung und Drei-Monats-Regel** (5.1.4): 6 von 9 grün.
    Fachlich **vollständig** — die drei ausstehenden hängen an Prosa, eines
    davon an der Zeiterfassung aus M5
  - **P3 Equal-Pay-Fälligkeit** (5.2.3): 11 von 21 grün. Gerechnet auf
    **derselben** Überlassungskette wie P1 — „dieselbe Kette, andere Frist"
    (5.2.1); die Kettenbildung ist aus `p1Hoechstdauer.ts` importiert, nicht
    nachgebaut. Die Frist kommt vom **Verleihertarif** (5.2.2), nicht von der
    Einsatzbranche: alle sechs Fälle, einschließlich der Begrenzung auf 15
    Monate und der nicht verwendbaren Frist ohne Zuschlagsschema
  - **P4 Vergleichsentgelt** (5.2.4): 7 von 26 grün. Der fehlende Eintrag des
    Standorts und der fehlende Wert am Einsatz sind **zwei** Mängel mit
    verschiedenen Fälligkeiten; `wageSource = estimate` ist verwendbar, aber
    kein Nachweis und begrenzt die Sperre auf eine Warnung. **Nicht
    übersteuerbar** (5.5.4)
  - **P5 Branchenzuschlagsschema** (5.2.5): 2 von 5 grün. Ohne hinterlegte
    Stufenfolge bleibt die Stufe **offen** — eine Stufengrenze zu erfinden wäre
    ein Tarifwert im Code
  - **P6 Drehtürklausel** (5.3.1): 8 von 23 grün. Nicht übersteuerbar, die
    zugehörigen Szenarien erwarten den zurückgewiesenen Versuch
  - **P7 Einsatzverbot bei Arbeitskampf** (5.3.2): 5 von 14 grün. Die
    **einzige** Regel des Kapitels, die den Grundsatz aus 5.0 umkehrt: ohne
    Arbeitskampfanzeige gibt es **keinen** Treffer, weil der Grundsatz sonst
    jeden Einsatzstart sperren würde. Zusicherung nach § 11 Abs. 5 Satz 2 AÜG
    und Teilbetroffenheit mildern die Sperre zur Warnung; nicht übersteuerbar
  - **P8 Kennzeichnung und Konkretisierung** (5.3.3): 10 von 20 grün. Die
    Regel mit der schärfsten Rechtsfolge auf der schwächsten Datengrundlage —
    deshalb eine **formale** Prüfung von K1 bis K5 in drei Stufen, die nie
    behauptet, die Konkretisierung sei inhaltlich erfüllt. Nicht
    übersteuerbar: die Konkretisierung wird nachgetragen
  - **P9 AÜG-Erlaubnis** (5.4.1): 29 von 44 grün. Tagesgenaue Deckung,
    Lücken, Anerkennungsstatus, befristete gegen unbefristete Erlaubnis,
    Datenfehler, nächtlicher Lauf N1
  - **P10 Pflichtnachweise** (5.4.4): 15 von 23 grün. Pflichtkatalog als
    Konfiguration, Sammelergebnis als strengstes Einzelergebnis, fehlende
    Pflichtangaben wie „ja", nächtlicher Lauf N5
  - **P11 Arbeitsverhältnis beim Verleiher** (5.3.4): 7 von 18 grün
  - Die Bremse aus 5.5.2 Nr. 2 — ein Vorgang mit einer Prüfung ohne
    Rechenweg bleibt **ganz** unbeurteilt — fängt damit nichts mehr und bleibt
    trotzdem stehen. Sie ist die Haltung, nicht eine Übergangslösung, und
    `pruefwerk.test.ts` hält fest, dass sie jetzt leer läuft
  - Die ausstehenden Szenarien der laufenden Prüfungen scheitern nicht am
    Rechenweg, sondern an Prosa-Zusicherungen, die der Runner nicht
    maschinell prüft. Der Runner hat seit 05.11.2026 **eigene Tests**
    (`tests/aueg-runner/support/*.test.ts`): sie nageln fest, welche Sätze
    Prosa bleiben **müssen** — ein stillschweigend grünes Szenario ist
    schlimmer als ein rotes
- 🟨 Anbindung an die Übergänge — **Q04 und Q06** (Erlaubnis, 4.1 und 4.2.1)
  sowie **P1, P3, P6, P8 und P11 am Einsatz und an der Verlängerung** (4.2.3
  und 4.3) sind angebunden. `lib/aueg/anbindung.ts` rechnet die Umrechnung zwischen
  Datenmodell und Regelwerk ohne Prisma; `lib/services/staffing.ts` lädt die
  Kette, die Tarifzuordnungen und den Konzernverbund. Der Stichtag kommt aus
  der Tabelle in 5.0, nie aus dem Tag des Aufrufs. In `RULE_CHECKS_PENDING`
  bleiben P9 und P10 am Einsatz — die rechnen, ihre Eingangsdaten sind dort nur
  nicht geladen — und **P7**: für die Arbeitskampfanzeige führt Kapitel 3 kein
  Feld und für die Zusicherung kein Objekt, 5.3.2 nennt die Regel deshalb
  selbst „prüfbar, aber nicht auswertbar" (*offene Frage 30*). Ein Feld dafür
  zu erfinden hieße, die Frage im Code zu entscheiden. Dasselbe gilt für den Teil von P4,
  der den Vergleichsentgelt-**Eintrag** des Standorts prüft (Q18, Q36), und für
  die Zuschlagsstufe aus P5: beide rechnen, ihre Eingangsdaten sind an den
  Übergängen nicht geladen. Die Sperre aus **Q48** greift dagegen, weil sie nur
  `equalPayDueDate` und `comparableWage` braucht. Ohne Statusmodell bleiben Q31,
  Q37, Q38 und Q41 bis Q44 — sie warten auf SPEC 3.9 und die Statusmodelle
  4.4, 4.5 und 4.6 (Lieferantenstatus)
- ✅ Profilvorschlag durch Lieferanten, Sicht- und Datenschutzregeln —
  Kandidat, Profilvorschlag und Personenidentität (SPEC 3.6) mit dem
  Statusmodell 4.2.3; die Datenminimierung aus 6.4 über die Offenlegungsstufe
  und Fußnote [23] (pseudonymisiertes Profil, Klardaten erst nach Zusage)
- ✅ Auswahlprozess bis Zu-/Absage — einreichen, sichten, dem Kunden vorlegen,
  Interview, Zusage, Absage, Zurückziehen; die Zusage trifft ausschließlich der
  Bedarfsträger (4.2.3, Fußnote [24])
- ✅ Einsatz anlegen, Laufzeit, Verlängerung, Beendigung — Einsatz (SPEC 3.7)
  mit den Statusmodellen 4.3.1 und 4.3.2, Unterbrechung als eigener Vorgang,
  Verlängerung mit Antrag, Genehmigung und Wirksamkeit
- ✅ **AÜG-Prüfungen aus M2 greifen beim Anlegen und Verlängern** — P1, P6 und
  P11 werden an den Übergängen des Einsatzes gerechnet, und `maxDurationEndDate`
  und `countedDurationDays` werden an jedem Einsatz der Kette in derselben
  Transaktion wie der Übergang fortgeschrieben (5.1.3), seit 05.11.2026 auch
  `equalPayDueDate` (5.2.3). Durch die Oberfläche gegengeprüft: `planned` →
  `active` an E-2026-0002 schreibt das Fristende 14.08.2028, die angerechnete
  Dauer 1 und die Equal-Pay-Fälligkeit **15.11.2027** — Beginn 15.02.2027 plus
  18 bzw. 9 Monate, letzter zulässiger Tag bzw. erster Tag mit Equal-Pay-Pflicht
- 🟨 **Demo-Stand vorführbar** — der Prozess ist durchklickbar (Stammdaten →
  Bedarf → Ausschreibung → Profilvorschlag → Einsatz mit Verlängerung,
  Unterbrechung und Beendigung), und die Prüfungen greifen an den Übergängen.
  Die Naht zwischen Regelwerk und Statusmodell ist seit 05.11.2026
  **automatisiert belegt**: `npm run test:services` führt 25 Tests gegen eine
  **eigene** Datenbank (`_test`, vor jedem Test geleert) und prüft, was ohne
  Datenbank nicht prüfbar ist — welche Zeilen der Dienst lädt, ob die gerechnete
  Tatsache den Übergang erreicht und ob eine Sperre nichts schreibt. Zwei
  absichtliche Mutationen im Dienst machen punktgenau je ein Szenario rot; ein
  grüner Lauf, der nichts prüft, wäre kein Beleg. Was fehlt: `demand.ts` und
  `masterData.ts` haben noch keine Tests — das Muster steht

## M5 — Zeiterfassung und Freigabe ⬜

- ⬜ SPEC Kapitel 3.8 und 4.4 ausgearbeitet
- ⬜ Stundenzettel, Zuschläge, Genehmigungsworkflow
- ⬜ Zeitbezogene AÜG-Prüfungen (Unterbrechung, Fristenlauf)

## M6 — Abrechnung und Reporting ⬜

- ⬜ SPEC Kapitel 3.9 und 4.5 ausgearbeitet
- ⬜ Abrechnungsbelege aus genehmigten Zeiten
- ⬜ Kennzahlen und Dashboards (offene Frage 9)

## M7 — Datenschutz und Härtung ⬜

- ⬜ SPEC Kapitel 6 vollständig
- ⬜ Löschkonzept implementiert
- ⬜ Zugriffsprotokollierung und Berechtigungsreview
- ⬜ Deployment auf DE/EU-Hoster, AVV-Unterlagen
