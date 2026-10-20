# Fortschritt

Chronologisches Arbeitsprotokoll. Neueste Einträge oben. Pro Arbeitseinheit:
was gemacht wurde, welche Entscheidungen gefallen sind, was offen bleibt.

---

## 2026-10-16 — SPEC Kapitel 3: Objekte / Datenmodell (M1)

**Gemacht**

- Kapitel 3 in `SPEC.md` vollständig ausgearbeitet, TODO-Marker der
  Unterpunkte 3.1–3.13 entfernt:
  - **3.0** (neu): Konventionen für alle Objekte — Standardfelder, Geldbeträge,
    Gültigkeitszeiträume, abgeleitete Felder, und die ausdrücklichen Verbote
    (keine Anmeldedaten, keine Zahlungsdaten, keine Echtdaten im Modell)
  - **3.1–3.12**: je Objekt Zweck und Abgrenzung, Attributtabelle (deutscher
    Fachbegriff, englischer Bezeichner, Typ/Wertebereich, Pflicht/optional,
    Bemerkung), Mandantenzugehörigkeit und Eigentümer, Beziehungen mit
    Kardinalität, Verweis auf das Statusmodell in Kapitel 4 und — bei
    personenbezogenen Objekten — der Hinweis auf die Datenkategorie für 6.3
  - **3.13**: Beziehungsübersicht in vier Strängen, Tabelle der fünf fachlich
    entscheidenden Kardinalitäten und ein `erDiagram` über 36 Objekte mit
    63 Beziehungen
- Drei Objekte sind gegenüber der Gliederung **hinzugekommen**, weil Kapitel 2
  und 5 sie voraussetzen: `supplierPermit` (3.2, eigenes Objekt statt Feld am
  Lieferanten, weil es historisiert und anerkannt wird), `workerIdentity`
  (3.6, mandantenübergreifende Personenidentität beim Betreiber) und
  `timesheetApproval` (3.8, Freigabeschritt, damit die Stufenzahl aus offener
  Frage 5 nicht im Modell festgeschrieben ist). Dazu die Unterobjekte
  `tenderInvitation`, `supplierOfferItem`, `assignmentExtension`,
  `assignmentInterruption`, `rateCardItem` und `billingDocumentItem`.
- Glossar 1.5 um 67 Objekt- und Attributbegriffe auf 98 Einträge ergänzt — in **dieselbe**
  Tabelle, wie in der Übergabenotiz zu Kapitel 2 gefordert. Der TODO-Marker ist
  auf „TODO (Kapitel 4–6)" reduziert: die Objektbezeichner sind vollständig,
  die Statusnamen aus Kapitel 4, die Rechenbegriffe aus Kapitel 5 und die
  Datenschutzbegriffe aus Kapitel 6 fehlen noch. Vollständig ist das Glossar
  damit **nicht**, deshalb bleibt der Marker in reduzierter Form stehen.
- Berechtigungsmatrix 2.2 verfeinert, ohne eine dort getroffene Entscheidung zu
  kippen: aus 17 Objektzeilen sind 21 geworden, dazu sechs neue Fußnoten
  [40]–[45]. Die Lesart erklärt jetzt zusätzlich, dass Unterobjekte die Zeile
  ihres Hauptobjekts teilen.
- `MILESTONES.md`: „SPEC Kapitel 3.1–3.7 (Stammdaten bis Einsatz)
  ausgearbeitet" unter M1 auf ✅; „Glossar DE → EN angelegt" auf 🟨
- Kein Anwendungscode, kein Datenbankschema, keine neuen Verzeichnisse — nur
  `SPEC.md`, `MILESTONES.md`, `PROGRESS.md`. Nichts committet.

**Entscheidungen**

| Thema | Entscheidung |
|---|---|
| Granularität | Kapitel 3 beschreibt fachliche Objekte, keine Tabellen: keine Datentypen, keine Schlüsselstrategie, keine Indizes, keine Migrationen (offene Frage 1 bleibt unberührt) |
| Standardfelder | `id`, `tenantId`, `created*`, `updated*`, `deactivatedAt`, `status` gelten für jedes Objekt und stehen einmal in 3.0, nicht in jeder Tabelle |
| Historisierung statt Überschreiben | Stammdatenänderungen mit Wirkung für die Zukunft erzeugen einen neuen Gültigkeitszeitraum; das gilt für AÜG-Erlaubnis, Preisliste, Tarifzuordnung und Rahmenvertrag |
| Zwei Vertragsstrecken | Nur Betreiber ↔ Kunde und Betreiber ↔ Lieferant. Ein Direktvertrag Kunde ↔ Lieferant ist nicht vorgesehen |
| Preisseiten getrennt | Einkaufspreisliste (Betreiber ↔ Lieferant) und Kundenpreisliste (Betreiber ↔ Kunde) sind verschiedene Objekte; die Marge ist für beide Gegenseiten unsichtbar (neue Fußnoten [41], [42]) |
| Einsatz im Betreibermandanten | Einsatz und Stundenzettel gehören dem Betreiber, weil sie beide Seiten verbinden; Kunde und Lieferant sehen jeweils nur ihren Umfang |
| Ausschreibungsrunden | Eine Wiederholung ist eine neue Ausschreibung mit erhöhter Rundennummer, keine Änderung der alten; je Einladung höchstens ein Angebot |
| Angebot ohne Kandidat | Zulässig — ein Angebot kann zunächst nur Verfügbarkeit und Preis melden, Profilvorschläge sind eigene Objekte |
| Zuschläge | Die Zuschlagsart (Katalog beim Betreiber) sagt *dass und wie* gerechnet wird, die Preisposition *wie viel* |
| Keine Statusdoppelung | Die Zeitposition trägt keinen Status — genehmigt wird der Stundenzettel (neue Fußnote [44]) |
| Rückverfolgbarkeit | Jede Belegposition verweist auf genau einen Stundenzettel und einen Einsatz, damit jeder Betrag bis zur genehmigten Zeit zurückverfolgbar ist |
| Rechte sind kein Datenbestand | Die Rechte einer Rolle stehen in der Matrix 2.2 und sind Teil des Regelwerks; eine frei konfigurierbare Rechteverwaltung ist im Prototyp nicht vorgesehen |
| Rollen als fester Katalog | Acht Rollencodes aus 2.1; `temporaryWorker` entfällt ersatzlos, falls offene Frage 4 mit „kein Zugang" beantwortet wird |
| Keine Geheimnisse im Modell | Passwörter, Hashes, Token und Zwei-Faktor-Geheimnisse sind nicht Teil des Datenmodells und auch nicht der Beispieldaten (CLAUDE.md Regel 2) |
| Keine Zahlungsdaten | Bankverbindungen und Mandate sind nicht vorgesehen; Zahlungsabwicklung und Mahnwesen sind nach 1.4 nicht im Umfang |
| Besondere Datenkategorien | Das Kandidatenobjekt führt keine Gesundheitsdaten; arbeitsmedizinische und ähnliche Nachweise nur als Vorliegen und Gültigkeit (3.10), nicht inhaltlich |
| Protokollumfang | Protokolliert werden alle schreibenden Operationen, lesende Zugriffe über Mandantengrenzen, lesende Zugriffe auf Kandidaten-Klardaten, Vertretungen, Eskalationsstufen und Übersteuerungen — nicht lesende Zugriffe im eigenen Mandanten auf nicht personenbezogene Daten |
| Audit-Zweckbindung | Audit-Einträge dienen Nachweis, Fehlersuche und Berechtigungsreview, nicht der Leistungs- oder Verhaltenskontrolle |
| Fremdsysteme | Jedes Objekt trägt ein optionales `externalReference` ohne fachliche Wirkung; eine Schnittstellenbeschreibung ist das nicht (offene Frage 7) |

**Verfeinerung der Berechtigungsmatrix 2.2 — was genau geändert wurde**

| Alte Zeile | Neu | Begründung |
|---|---|---|
| (keine) | `AÜG-Erlaubnis (3.2)` | 3.2 trennt Erlaubnisdaten vom Lieferanten; Rechte unterscheiden sich (LA pflegt, MD erkennt an, KE sieht nur den Gültigkeitsstatus über [36]) |
| `Rahmenvertrag, Preisliste, Tarifzuordnung (3.3)` | drei Zeilen | Die Rechte unterscheiden sich tatsächlich. `KG` behält `L[8]` nur bei der Preisliste, weil [8] ausdrücklich „nur die Kostenwirkung des zu genehmigenden Vorgangs" meint — bei Rahmenvertrag und Tarifzuordnung entfällt die Zeile für KG (vermerkt in [40]) |
| (keine) | `Personenidentität (3.6)` | neues Objekt, ausschließlich Betreiber ([43]) |
| `Stundenzettel, Zeitposition (3.8)` | zwei Zeilen | KB und KG genehmigen den Zettel, nicht die Position; die Position trägt keinen Status ([44]) |
| `Benutzer, Rolle, Mandantenzuordnung (3.11)` | zusätzlich `Vertretung (3.11)` | 2.4 Regel 7 lässt jeden Rolleninhaber die **eigene** Vertretung einrichten — das war in der Matrix nicht abgebildet ([45]) |
| Zeilenbeschriftungen 3.5, 3.7, 3.9 | ergänzt um die Unterobjekte | Angebotsposition, Verlängerung, Unterbrechung, Freigabeschritt und Belegposition teilen die Zeile ihres Hauptobjekts (neue Lesart-Regel) |

Keine bestehende Berechtigung wurde entzogen oder erweitert; alle Buchstaben
der 17 alten Zeilen sind in den 21 neuen wiederzufinden.

**Offen / als Nächstes**

- **Neue offene Fragen 15–22** in `SPEC.md`: Vergleichsentgelt (15),
  Zeiterfassungsgranularität (16), einsatzindividuelle Konditionen (17),
  Personenidentität über Lieferanten hinweg (18), gleichzeitige Einsätze
  derselben Person (19), Pflichtnachweise (20), Abwesenheitsart im
  Stundenzettel (21), Aufbewahrung der Audit-Einträge (22).
  **Frage 18 ist die wichtigste:** wird sie mit „nein" beantwortet, entfällt
  `workerIdentity` und mit ihr die lieferantenübergreifende Zählung aus 5.1 —
  dann braucht Kapitel 5 einen anderen Weg. Das ist keine Einzelheit, sondern
  eine Grundsatzentscheidung über die Leistungsfähigkeit des Regelwerks.
- Die bestehenden offenen Fragen 4, 5, 6, 7, 8, 11, 12, 13 und 14 wirken in
  Kapitel 3 hinein. Das Kapitel trägt beide Antworten; die Stellen sind im Text
  mit *(offene Frage n)* gekennzeichnet. Jede nicht gewählte Antwort lässt das
  betroffene Feld oder Objekt ersatzlos entfallen, ohne dass ein anderes Objekt
  nachzuziehen ist.
- **Lücken in Kapitel 4, die Kapitel 3 aufgedeckt hat.** Sieben Objekte haben
  einen fachlichen Lebenszyklus, für den Kapitel 4 heute kein Statusmodell
  führt: Rahmenvertrag, Preisliste, Ausschreibung, Einladung,
  Abrechnungsperiode, Dokument/Nachweis (gehört zu 5.4) und Kunde/Standort
  (nur aktiv/inaktiv). Im Text ist jeweils vermerkt, wohin das Modell gehört.
  Bei der Ausarbeitung von Kapitel 4 nachzutragen.
- Kapitel 6.3 kann jetzt objektweise aufgebaut werden: jedes personenbezogene
  Objekt in Kapitel 3 trägt den Hinweis auf seine Datenkategorie.
- M5 und M6 nennen „SPEC Kapitel 3.8 und 4.4" bzw. „3.9 und 4.5" als ein
  Paket. Die Objekthälfte ist jetzt fertig, die Statusmodelle 4.4 und 4.5
  fehlen — die Meilensteinpunkte bleiben deshalb offen.
- Glossar 1.5 um die Begriffe aus Kapitel 4–6 ergänzen, dann den TODO-Marker
  entfernen.

---

## 2026-10-16 — SPEC Kapitel 2: Rollen und Berechtigungen (M1)

**Gemacht**

- Kapitel 2 in `SPEC.md` ausgearbeitet, TODO-Marker der Unterpunkte 2.2–2.4
  entfernt:
  - **2.1**: die acht Rollen je mit Zweck, typischen Aufgaben und Abgrenzung
    zu den benachbarten Rollen
  - **2.2**: Berechtigungsmatrix Rolle × Objekt × Operation (anlegen, lesen,
    ändern, Status wechseln, löschen) über 17 Objektzeilen entlang Kapitel 3,
    mit 39 Fußnoten für Feld- und Statuseinschränkungen
  - **2.3**: Sichtbarkeitsregeln — Grundsatz, zwischen Lieferanten (inkl.
    Rückschlussverboten über Aggregate, Benachrichtigungen, Statusverläufe und
    Doppelvorschläge), zwischen Kunden eines MSP, Querschnittssicht des
    Betreibers, Leiharbeitnehmer, Unabhängigkeit von der Betriebsform
  - **2.4**: Vertretung (9 Regeln) und Eskalation (5 Regeln plus Tabelle der
    Eskalationsanlässe mit Zuständigkeit und Stufenfolge)
- Glossar 1.5 angelegt als Auszug mit den 31 Begriffen aus Kapitel 2
  (Rollen, Berechtigung, Mandant, Vertretung, Eskalation); Objektbezeichner
  bleiben Kapitel 3 vorbehalten, damit es keine doppelte Pflege gibt. Der
  TODO-Marker an 1.5 bleibt deshalb stehen.
- `MILESTONES.md`: „SPEC Kapitel 2 (Rollen) ausgearbeitet" unter M1 auf ✅
- Kein Anwendungscode, kein Stackbezug — nur `SPEC.md`, `MILESTONES.md`,
  `PROGRESS.md`

**Entscheidungen**

| Thema | Entscheidung |
|---|---|
| Berechtigungsmodell | Wirksames Recht = Schnittmenge aus Rolle, Mandantenzuordnung und Zuständigkeit; keine Rollenvererbung |
| Rollenbegriff | Rollen sind Funktionen, nicht Personen; Mehrfachrollen nur innerhalb **einer** Organisation |
| Mandantengrenze | geht dem Rollenrecht vor und gilt für Listen, Suche, Berichte, Benachrichtigungen und Exporte, nicht nur für Detailansichten |
| Sichtbarkeit | positiv festgelegt — fehlt eine Regel, ist das Objekt nicht sichtbar |
| Löschen | in der Matrix grundsätzlich Deaktivierung/Stornierung; physische Löschung nur über das Löschkonzept (6.6) |
| Audit-Einträge | entstehen nur durch das System, für jede Rolle unveränderlich (kein `Ä`, kein `X`) |
| Betreiber vs. Kunde | der Betreiber ersetzt keine Kundenentscheidung, auch nicht in Vertretung — liegengebliebene Freigaben werden eskaliert, nicht übernommen |
| Vertretung | befristet, personenbezogen, nur innerhalb einer Organisation, ohne Ketten, mit Vertretungsvermerk; Vier-Augen-Prinzip bleibt erhalten |
| Eskalation | keine Genehmigungsfiktion — Fristablauf löst nie einen Statuswechsel aus |
| Benchmarking | kundenübergreifende Vergleichsauswertungen im Prototyp nicht vorgesehen |
| Offene Fragen 4 und 8 | Kapitel 2 trägt beide Antworten; betroffene Stellen sind im Text gekennzeichnet, die Spalte `AN` der Matrix entfällt ersatzlos, falls Leiharbeitnehmer keinen Zugang erhalten |

**Offen / als Nächstes**

- Neue offene Fragen in `SPEC.md` (11–14): Sichtbarkeit der Lieferantenidentität
  für den Kunden, kundenseitige Benutzer- und Vertretungsverwaltung,
  Organisation in Doppelrolle Kunde/Lieferant, Pflege der Zuständigkeit auf
  Standort- und Kostenstellenebene
- Die Matrixzeilen zu 3.3 (Konditionen) und 3.8 (Zeitobjekte) bleiben so grob
  wie Kapitel 3 — sie sind mit Kapitel 3 zu verfeinern, nicht in Kapitel 2
- Glossar 1.5 um die Objektbezeichner aus Kapitel 3 ergänzen
- Offene Frage 5 (Genehmigungsstufen) wirkt direkt auf die Matrixzeile
  Stundenzettel und auf die Eskalationstabelle

---

## 2026-10-16 — Projektgerüst (M0)

**Gemacht**

- Repository-Struktur angelegt: `CLAUDE.md`, `SPEC.md`, `MILESTONES.md`,
  `PROGRESS.md`, `tests/aueg/`, `.gitignore`, `.env.example`
- `SPEC.md` als reine Gliederung: Rollen, Objekte, Statusmodelle, AÜG-Regeln,
  Datenschutz/Löschfristen, Offene Fragen
- `CLAUDE.md` mit den Arbeitsregeln (Tests in `tests/aueg/` unantastbar, keine
  Zugangsdaten außerhalb `.env`, Fortschrittspflicht hier)
- `tests/aueg/README.md` mit Konventionen für die Gherkin-Szenarien
- Kein Anwendungscode — wie vereinbart

**Entscheidungen**

| Thema | Entscheidung |
|---|---|
| Betreibermodell | MSP / Personaldienstleister steuert mehrere Kunden und Lieferanten |
| Umfang | Stammdaten & Anfragen, Kandidaten & Besetzung, Zeiterfassung & Freigabe, Abrechnung & Reporting |
| AÜG-Regeln im Prototyp | Höchstüberlassungsdauer, Equal Pay, Drehtür & Streik, Erlaubnis & Fristen |
| Testformat | Gherkin-`.feature`-Dateien, stack-neutral |
| Sprache | Doku Deutsch, Code Englisch, Glossar in SPEC.md |
| Hosting-Ziel | Hoster mit Serverstandort Deutschland/EU, AVV-fähig |
| Meilensteine | klickbare Demo zuerst (Stammdaten → Anfrage → Besetzung) |
| Tech-Stack | **bewusst offen gelassen** |

**Offen / als Nächstes**

- Tech-Stack entscheiden (offene Frage 1 in SPEC.md) — blockiert M3
- Tarifvertrag klären (offene Frage 3) — blockiert Equal-Pay-Spezifikation
- Offene Fragen 2 und 4–10 in SPEC.md beantworten
- M1: Rollen und Kernobjekte in SPEC.md ausarbeiten
