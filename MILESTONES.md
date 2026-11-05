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
berichtet je Prüfung P1 bis P11. Stand 05.11.2026: **82 grün, 0 rot, 185
ausstehend** — jede implementierte Prüfung schlägt sich unmittelbar in der
Tabelle nieder (siehe [tests/aueg/README.md](tests/aueg/README.md)).

- ✅ Gherkin-Runner angebunden, AÜG-Suite läuft (getrennt von `npm test`)
- 🟨 AÜG-Prüfungen umgesetzt — **sechs von elf laufen:**
  - **P1 Höchstüberlassungsdauer** (5.1): 19 von 56 grün. Kalendarische
    Zählung über Lieferanten und Kunden hinweg entlang der **bestätigten**
    Personenidentität, Tarifabweichung als Konfiguration, Schwellen und
    Eskalation, Übersteuerung nach 5.5.4
  - **P2 Unterbrechung und Drei-Monats-Regel** (5.1.4): 6 von 9 grün.
    Fachlich **vollständig** — die drei ausstehenden hängen an Prosa, eines
    davon an der Zeiterfassung aus M5
  - **P6 Drehtürklausel** (5.3.1): 8 von 23 grün. Nicht übersteuerbar, die
    zugehörigen Szenarien erwarten den zurückgewiesenen Versuch
  - **P9 AÜG-Erlaubnis** (5.4.1): 29 von 44 grün. Tagesgenaue Deckung,
    Lücken, Anerkennungsstatus, befristete gegen unbefristete Erlaubnis,
    Datenfehler, nächtlicher Lauf N1
  - **P10 Pflichtnachweise** (5.4.4): 15 von 23 grün. Pflichtkatalog als
    Konfiguration, Sammelergebnis als strengstes Einzelergebnis, fehlende
    Pflichtangaben wie „ja", nächtlicher Lauf N5
  - **P11 Arbeitsverhältnis beim Verleiher** (5.3.4): 7 von 18 grün
  - P3 bis P5, P7 und P8 stehen aus — sie stehen ohne Rechenweg in der
    Registry und liefern deshalb **keinen** Befund. Eine Zeile der 4.7 mit
    zwei Prüfungen, von denen eine fehlt, bleibt **unbeurteilt**: ohne beide
    Einzelergebnisse ist das strengste nach 5.5.2 Nr. 2 nicht bestimmbar
  - Die ausstehenden Szenarien der laufenden Prüfungen scheitern nicht am
    Rechenweg, sondern an Prosa-Zusicherungen, die der Runner nicht
    maschinell prüft. Der Runner hat seit 05.11.2026 **eigene Tests**
    (`tests/aueg-runner/support/*.test.ts`): sie nageln fest, welche Sätze
    Prosa bleiben **müssen** — ein stillschweigend grünes Szenario ist
    schlimmer als ein rotes
- 🟨 Anbindung an die Übergänge — **Q04 und Q06** (Erlaubnis, 4.1 und 4.2.1)
  sowie **P1, P6 und P11 am Einsatz und an der Verlängerung** (4.2.3 und 4.3)
  sind angebunden. `lib/aueg/anbindung.ts` rechnet die Umrechnung zwischen
  Datenmodell und Regelwerk ohne Prisma; `lib/services/staffing.ts` lädt die
  Kette, die Tarifzuordnungen und den Konzernverbund. Der Stichtag kommt aus
  der Tabelle in 5.0, nie aus dem Tag des Aufrufs. In `RULE_CHECKS_PENDING`
  bleiben P7 und P8 (kein Rechenweg) und P9/P10 am Einsatz — die rechnen, ihre
  Eingangsdaten sind dort nur nicht geladen. Ohne Statusmodell bleiben Q31,
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
  Transaktion wie der Übergang fortgeschrieben (5.1.3). Durch die Oberfläche
  gegengeprüft: `planned` → `active` an E-2026-0002 schreibt das Fristende
  14.08.2028 und die angerechnete Dauer 1 — Beginn 15.02.2027 plus 18 Monate,
  letzter zulässiger Tag. `equalPayDueDate` bleibt leer, bis P3 läuft
- 🟨 **Demo-Stand vorführbar** — der Prozess ist durchklickbar (Stammdaten →
  Bedarf → Ausschreibung → Profilvorschlag → Einsatz mit Verlängerung,
  Unterbrechung und Beendigung), und die Prüfungen greifen an den Übergängen.
  Was fehlt: für `lib/services/` gibt es keinen automatisierten Test — die
  Dienste sind nur von Hand und über die Oberfläche belegt

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
