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
Davon sind inzwischen erledigt: der Lieferantenstatus (4.6, 10.11.2026), die
AÜG-Prüfungen (alle elf, siehe M4) und der Audit-Eintrag (3.12, 10.11.2026).
Offen bleiben Benachrichtigungen und Fristenlauf.

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
- 🟨 Anbindung an die Übergänge — **P1, P3, P6, P8, P9, P10 und P11** sind an
  den Übergängen der Bedarfsanfrage, des Profilvorschlags, des Einsatzes und
  der Verlängerung angebunden (4.1, 4.2.1, 4.2.3, 4.3). `lib/aueg/anbindung.ts` rechnet die Umrechnung zwischen
  Datenmodell und Regelwerk ohne Prisma; `lib/services/staffing.ts` lädt die
  Kette, die Tarifzuordnungen und den Konzernverbund. Der Stichtag kommt aus
  der Tabelle in 5.0, nie aus dem Tag des Aufrufs. In `RULE_CHECKS_PENDING`
  bleibt **P7**: für die Arbeitskampfanzeige führt Kapitel 3 kein Feld und für
  die Zusicherung kein Objekt, 5.3.2 nennt die Regel deshalb selbst „prüfbar,
  aber nicht auswertbar" (*offene Frage 30*). Ein Feld dafür zu erfinden hieße,
  die Frage im Code zu entscheiden. Die beiden übrigen Einträge dort sind
  keine Lücken, sondern Stellen **ohne** Zeile in 4.7 — P10 beim Einreichen
  des Vorschlags und beim Anlegen des Einsatzes; jeder trägt seine Begründung. Dasselbe gilt für den Teil von P4,
  der den Vergleichsentgelt-**Eintrag** des Standorts prüft (Q18, Q36), und für
  die Zuschlagsstufe aus P5: beide rechnen, ihre Eingangsdaten sind an den
  Übergängen nicht geladen. Die Sperre aus **Q48** greift dagegen, weil sie nur
  `equalPayDueDate` und `comparableWage` braucht. Ohne Statusmodell bleiben Q31,
  Q37, Q38 und Q41 bis Q44 — sie warten auf SPEC 3.9 und die Statusmodelle
  4.4, 4.5 und 4.6 (Lieferantenstatus)
- ✅ **Dokument und Nachweis (SPEC 3.10) als Datenmodell** — ein `document` je
  Bezugsobjekt mit Nachweisart, Gültigkeit, Ablageverweis, Anerkennung und
  Sichtbarkeitsklasse. `mandatory` und `blocking` sind **keine** Spalten: 3.10
  führt sie als abgeleitete Felder aus dem Pflichtkatalog in 5.4.4, und zwei
  Quellen für dieselbe Aussage laufen auseinander. Die Invarianten, die Prisma
  nicht erzwingen kann — genau **ein** Bezugsobjekt, Belege der Anerkennung —
  stehen in `lib/masterdata/invariants.ts`
- ✅ **Nachweisfluss (SPEC 5.4.3) mit Dienst und Oberfläche** — einstellen,
  anerkennen, zurückweisen als geschlossene Übergangsmenge
  (`lib/status/document.ts`), mit dem Vier-Augen-Prinzip gegenüber dem
  Einstellen und ohne jeden Weg zurück: ein berichtigter Nachweis ist ein neues
  Dokument, und der Ablauf der Gültigkeit wechselt **keinen** Status. Die Zeile
  „Dokument / Nachweis" in 2.2 ist belegt, samt Fußnoten [34] bis [37]: der
  Kunde sieht die einsatzbezogenen Nachweise seines Kunden ([35]),
  Einkauf/Controlling die AÜG-Erlaubnis ohne Urkundeninhalte ([36]), der
  Lieferant die eigenen und ändert sie nur bis zur Anerkennung ([37]).
  **Keine Ablage** hinter `fileRef` und **keine** Benachrichtigungen (offene
  Fragen 1 und 2)
- ✅ **Lieferantenstatus (SPEC 4.6) mit Dienst und Oberfläche** — das letzte
  Statusmodell des Kernprozesses: `onboarding` → `active` ↔ `blocked` und aus
  allen dreien `inactive`, mit drei getrennten Wegen nach `active`
  (freischalten, entsperren, reaktivieren) und ihren verschiedenen
  Vorbedingungen. Damit greifen **Q41 bis Q44**: P9 und P10 sperren
  Freischalten, Entsperrung und Reaktivierung. Entsperrt wird nur durch `MA`
  ([5]) und **nicht** durch die sperrende Person (2.4, Regel 5); die
  Beauftragung endet erst, wenn kein Einsatz mehr läuft (4.3). Kein
  zeitgesteuerter Übergang: der Ablauf der Erlaubnis wechselt keinen Status
  (5.4.2 a), er sperrt über P9
- ✅ **Fachliches Protokoll (SPEC 3.12) mit Dienst und Oberfläche** — jede
  schreibende Operation der sechs Fachdienste erzeugt einen Audit-Eintrag in
  **derselben** Transaktion wie die Handlung; ein **abgelehnter** Versuch
  erzeugt ihn in einer eigenen, weil die Handlung zurückrollt und 3.12 den
  Eintrag trotzdem verlangt. Verweigerung (`denied`, Kapitel 2) und Sperre
  (`blocked` mit `ruleRef`, Kapitel 5) sind unterschieden (4.0, Regel 5). Die
  Eintragsnummern sind **lückenlos**, weil die Nummer aus einer gesperrten
  Zählerzeile kommt und nicht aus einer Sequenz; die Einträge sind
  unveränderlich in zwei Schichten — die Matrix nennt keine schreibende
  Operation ([39]), und ein Trigger verweigert `UPDATE` und `DELETE`. Lesend
  protokolliert werden nur die drei Fälle, die 3.12 nennt; die Granularität
  bei Listen ist *offene Frage 45*. **Nicht** umgesetzt: Eskalationsstufen und
  Übersteuerungen (beide Vorgänge gibt es im Prototyp nicht) und
  `clientContext` (Umfang legt 6.8 fest)
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
  **automatisiert belegt**: `npm run test:services` führt 120 Tests gegen eine
  **eigene** Datenbank (`_test`, vor jedem Test geleert) und prüft, was ohne
  Datenbank nicht prüfbar ist — welche Zeilen der Dienst lädt, ob die gerechnete
  Tatsache den Übergang erreicht und ob eine Sperre nichts schreibt. Zwei
  absichtliche Mutationen im Dienst machen punktgenau je ein Szenario rot; ein
  grüner Lauf, der nichts prüft, wäre kein Beleg. Was fehlt: `demand.ts` hat
  noch keine eigene Testdatei — das Muster steht, und `masterData.ts`,
  `documents.ts`, `staffing.ts`, `supplierStatus.ts` und das Protokoll (3.12)
  haben eine

## M5 — Zeiterfassung und Freigabe 🟨

- ✅ SPEC Kapitel 3.8 und 4.4 ausgearbeitet — Stundenzettel, Freigabeschritt,
  Zeitposition und Zuschlagsart samt Statusmodell
- ✅ **Die drei Fragen entschieden, die M5 blockiert haben** (11.11.2026):
  **Frage 5** — die Freigabestufen sind Konfiguration je Kunde
  (`timesheetApprovalConfig`, 3.1), Vorbelegung zwei Stufen, zuerst die
  Kundenseite, dann der Betreiber; die Betreiberstufe tritt **hinzu** und
  ersetzt die Kundenentscheidung nicht. **Frage 16** — **beide**
  Erfassungsformen, Tagessumme und Abschnitt, und die Form entscheidet, welche
  Zuschläge ableitbar sind (`derived` / `declared`, `derivationBasis`).
  **Frage 21** — **nur produktive Zeiten**: `absenceType` entfällt ersatzlos,
  damit entsteht über die Zeiterfassung kein Gesundheitsdatum nach Art. 9
  DSGVO. Neu offen daraus: **Frage 47** (welche Kundenrolle trägt die erste
  Stufe in der Vorbelegung) und **Frage 48** (Rundung der Stunden) — beide
  blockieren die Umsetzung nicht
- ✅ **Stundenzettel, Zuschläge, Genehmigungsworkflow** (11.11.2026) —
  Stundenzettel, Zeitposition, Freigabeschritt und Zuschlagsart mit dem
  Statusmodell 4.4, dazu die Abrechnungsperiode aus 3.9 in dem Umfang, den 4.4
  braucht (`open`/`closed`; 3.9 nennt das selbst den „fachlichen
  Mindestumfang"). Die Freigabestufen sind **Konfiguration je Kunde** (3.1) und
  werden beim Einreichen in die Schritte **kopiert**; die Betreiberstufe tritt
  hinzu und ersetzt die Kundenentscheidung nicht. Eine Zeitposition ist
  Tagessumme **oder** Abschnitt, und die Form entscheidet, welche Zuschläge
  ableitbar sind (`derived` / `declared`). **Keine** Abwesenheitsart: über die
  Zeiterfassung entsteht kein Gesundheitsdatum nach Art. 9 DSGVO
- ✅ **Zeitbezogene AÜG-Prüfungen an den Übergängen** — **Q33 bis Q37** greifen:
  P1 beim Einreichen und bei der Genehmigung (Warnung, nach 5.5.5 ausdrücklich
  **keine** Sperre), P3 beim Eröffnen der Freigabe, **P4 als Sperre** bei
  erreichter Equal-Pay-Fälligkeit ohne verwendbares Vergleichsentgelt (Q36) und
  P10 für die Unterweisung am Standort. P1 und P3 werden dabei aus den
  Ergebnisfeldern am Einsatz **gelesen** (5.1.3, 5.2.3), nicht ein zweites Mal
  aus der Überlassungskette gerechnet
- ⬜ **Korrekturfassung anlegen** — der Übergang `approved` → `corrected` steht
  im Statusmodell und ist geprüft; der Dienst legt die Korrekturfassung noch
  nicht an. Gebraucht wird sie mit dem Belegstorno aus 4.5
- ⬜ **Periode schließen** — gehört zum vollständigen Statusmodell in 4.5 und zu
  offener Frage 24; die Prüfung auf „offen" in 4.4 greift trotzdem

## M6 — Abrechnung und Reporting ⬜

- ⬜ SPEC Kapitel 3.9 und 4.5 ausgearbeitet
- ⬜ Abrechnungsbelege aus genehmigten Zeiten
- ⬜ Kennzahlen und Dashboards (offene Frage 9)

## M7 — Datenschutz und Härtung ⬜

- ⬜ SPEC Kapitel 6 vollständig
- ⬜ Löschkonzept implementiert
- ⬜ Zugriffsprotokollierung und Berechtigungsreview
- ⬜ Deployment auf DE/EU-Hoster, AVV-Unterlagen
