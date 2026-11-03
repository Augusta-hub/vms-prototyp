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

## M4 — Klickbare Demo: Besetzung ⬜

Fortschrittsmesser steht: `npm run test:aueg` führt die 267 Szenarien aus und
berichtet je Prüfung P1 bis P11. Stand 03.11.2026 sind alle ausstehend — jede
implementierte Prüfung schlägt sich unmittelbar in der Tabelle nieder
(siehe [tests/aueg/README.md](tests/aueg/README.md)).

- ✅ Gherkin-Runner angebunden, AÜG-Suite läuft (rot, getrennt von `npm test`)
- ⬜ Profilvorschlag durch Lieferanten, Sicht- und Datenschutzregeln
- ⬜ Auswahlprozess bis Zu-/Absage
- ⬜ Einsatz anlegen, Laufzeit, Verlängerung, Beendigung
- ⬜ AÜG-Prüfungen aus M2 greifen beim Anlegen und Verlängern
- ⬜ **Demo-Stand vorführbar**

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
