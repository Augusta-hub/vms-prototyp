# Fortschritt

Chronologisches Arbeitsprotokoll. Neueste Einträge oben. Pro Arbeitseinheit:
was gemacht wurde, welche Entscheidungen gefallen sind, was offen bleibt.

---

## 2026-10-20 — SPEC Kapitel 4: Statusmodelle (M1)

**Gemacht**

- Kapitel 4 in `SPEC.md` vollständig ausgearbeitet, TODO-Marker der
  Unterpunkte 4.1–4.7 entfernt:
  - **4.0** (neu): Konventionen für alle Statusmodelle — zehn Regeln (nur
    genannte Übergänge, dreifach bedingte Berechtigung, Protokollpflicht, kein
    genehmigender Übergang durch Fristablauf, Sperren sind keine Zustände,
    Vier-Augen, keine Betreiberentscheidung anstelle des Kunden,
    Sichtbarkeit von Benachrichtigungen, Endgültigkeit von Endzuständen,
    Systemübergänge), die Namenskonvention der Statusbezeichner, die Tabelle
    der **Prozessfristen** mit Vorbelegungen (2.4 Regel 5 verlangt sie hier)
    und die Liste der Statusmodelle, die dieses Kapitel **nicht** führt
  - **4.1–4.6**: je Modell eine Zustandstabelle (deutscher Begriff, englischer
    Bezeichner, fachliche Bedeutung), eine Übergangstabelle (Von, Nach,
    auslösende Rolle mit Fußnotenbezug auf 2.2, Vorbedingungen,
    Nebenwirkungen: Benachrichtigung, Sperre, Protokolleintrag, Fristenlauf),
    die Endzustände, eine ausdrückliche Liste der Übergänge, die es **nicht**
    gibt, ein `stateDiagram-v2` und die ausgelösten AÜG-Prüfungen
  - **4.7**: Querschnitt — elf benannte Prüfungen P1–P11 mit englischem
    Bezeichner, die drei Ergebnisarten mit ihrer Wirkung im Statusmodell, eine
    Tabelle über 44 Zeilen (Q01–Q44) Statusübergang → Prüfung → Prüfgegenstand
    → Ergebnisart und ein Ableitungsmuster für die Gherkin-Szenarien
- Zehn Statusmodelle statt der sechs aus der Gliederung: 4.2 und 4.3 und 4.5
  enthalten je zwei bzw. drei Modelle, weil Einladung, Angebot und
  Profilvorschlag (4.2), Einsatz und Verlängerung (4.3) sowie
  Abrechnungsperiode und Abrechnungsbeleg (4.5) **verschiedene** Objekte mit
  eigenem Lebenszyklus sind (Kapitel 3). Zwei der sieben von Kapitel 3
  gemeldeten Lücken sind damit geschlossen (Einladung, Abrechnungsperiode).
- Glossar 1.5 um 67 Status-, Übergangs- und Prüfbegriffe auf **165 Einträge**
  ergänzt — in **dieselbe** Tabelle. Statuswerte stehen einmal mit allen
  Modellen, in denen sie vorkommen, nicht je Modell erneut. Der TODO-Marker an 1.5 ist auf
  „TODO (Kapitel 5–6)" reduziert.
- `MILESTONES.md`: „SPEC Kapitel 4.1–4.3 (Statusmodelle des Kernprozesses)
  ausgearbeitet" unter M1 auf ✅
- Kein Anwendungscode, keine Testdateien, keine neuen Verzeichnisse — nur
  `SPEC.md`, `MILESTONES.md`, `PROGRESS.md`. Nichts committet.

**Entscheidungen**

| Thema | Entscheidung |
|---|---|
| Aufgabenteilung 2.2 ↔ 4 | Die Matrix sagt, *wer überhaupt* einen Status wechseln darf (`S`); Kapitel 4 sagt, *welchen Übergang wann*. Kapitel 4 darf einschränken, nie erweitern |
| Geschlossene Übergangsmenge | Was nicht in Kapitel 4 steht, ist unzulässig. Jedes Modell nennt deshalb ausdrücklich die Übergänge, die es **nicht** gibt — das ist der prüfbare Teil |
| Fristablauf | Zeitgesteuerte Übergänge gibt es nur, wo sie **entziehen** (`expired` bei Bedarfsanfrage, Einladung, Angebot). Kein `approved`, `confirmed`, `active` oder `completed` durch Zeitablauf (2.4 Regel 1) |
| Sperren sind keine Zustände | Ein Prüfergebnis „Sperre" verhindert den Übergang; der Vorgang bleibt stehen. Einzige Ausnahme ist `blocked` beim Lieferanten — das beschreibt die Organisation, nicht ein Prüfergebnis |
| Prozessfristen | Vorbelegungen in 4.0, je Kunde über `processDeadlineConfig` konfigurierbar, ohne rechtliche Wirkung. AÜG-Fristen bleiben ausschließlich in Kapitel 5 |
| Statusbezeichner | modellübergreifend einheitlich: gleiche Bedeutung, gleicher Bezeichner. Deshalb `filled` für die besetzte Anfrage und `completed` für den beendeten Einsatz |
| „Eingereicht" als eigener Zustand (4.1) | Die Gliederung kannte nur Entwurf → freigegeben. Fußnoten [12] und [13] trennen Einreichen (`KB`) und Freigeben (`KG`); ohne `submitted` gäbe es den Eskalationsanlass aus 2.4 nicht |
| Teilbesetzung | kein eigener Zustand: bei `headcount > 1` bleibt die Anfrage in `inSelection`, bis die letzte Stelle besetzt ist |
| `filled` ist Endzustand | Eine Nachbesetzung nach vorzeitiger Beendigung ist eine **neue** Bedarfsanfrage, keine Wiederöffnung — sonst verliert die Historie den Bezug zwischen Anfrage, Angebot und Einsatz |
| „verlängert" ist **kein** Zustand des Einsatzes | Eine wirksame Verlängerung verschiebt `plannedEndDate` und lässt den Einsatz in `active`. Der Vorgang hat seinen eigenen Lebenszyklus (4.3.2) — sonst würden Zeiterfassung und Fristenlauf für einen Verwaltungsakt unterbrochen |
| Antrag auf Beendigung ist **kein** Zustand | Ein offener Antrag ändert nichts; erst die Wirksamkeit führt nach `terminatedEarly` (2.4 Regel 1) |
| Rücknahme vor Beginn | wird als `terminatedEarly` geführt, nicht als eigener Zustand — so bleibt die Pflichtbegründung erhalten und erkennbar, dass keine Arbeitsleistung erbracht wurde |
| Genehmigung nach [26] | Verlängerung: **immer** durch `KG`, unabhängig vom Antragsteller (Kostenwirkung). Vorzeitige Beendigung: durch `KG` nur bei Antrag der Kundenseite; auf Antrag des Lieferanten keine Genehmigung, nur Unterrichtung — der Verleiher entscheidet über den Einsatz seines Arbeitnehmers |
| Stundenzettel und offene Frage 5 | Die Stufenzahl steht in den Daten (`timesheetApproval`), nicht im Statusmodell. `inApproval` trägt eine wie fünf Stufen; mit der Antwort ändert sich nur `assignedRoleCode` |
| Keine Zeitfreigabe durch den Betreiber | `MD` darf erfassen und korrigieren ([27], [28]), aber keine Freigabestufe entscheiden — die Zeitfreigabe ist eine Kundenentscheidung |
| Korrektur genehmigter Zeiten | ausschließlich über eine Korrekturfassung, die den vollen Zyklus durchläuft; erst ihre Genehmigung setzt den alten Zettel auf `corrected`. Die Regel „ein Zettel je Einsatz und Periode" (3.13) meint den jeweils **gültigen** Zettel |
| „Offen" gehört zur Periode, nicht zum Beleg | Die Gliederung nannte „offen → erstellt" als Belegzustände. `open` ist der Zustand der Abrechnungsperiode (4.5.1); der Beleg beginnt mit `created` |
| Belegmodell trägt offene Frage 6 | Gutschriftverfahren und Rechnungseingang haben **dieselben** Zustände; unterschiedlich ist nur die auslösende Rolle. Die Übergangstabelle führt dafür die Spalte „Seite / Variante" (Verkauf, Einkauf A, Einkauf B) |
| `confirmed` nur auf der Einkaufsseite | 2.2 gibt `KE` mit [31] nur die Beanstandung, keine Bestätigung. Auf der Verkaufsseite ist `released` der Ruhezustand — ohne Bestätigungsfiktion durch Fristablauf |
| Kein Wiederöffnen einer Periode | Nachträgliche Zeiten laufen über eine Korrekturfassung in der nächsten offenen Periode, nachträgliche Beträge über Storno und Nachbeleg |
| Lieferantensperre beendet keinen Einsatz | `blocked` verhindert neue Vorgänge; laufende Einsätze, Zeiterfassung und Abrechnung laufen weiter. Ob der Entzug der Erlaubnis einen laufenden Einsatz beendet, entscheidet 5.4 — der Übergang liegt in 4.3.1 bereit |
| `inactive` ist reaktivierbar | einzige Ausnahme von „Endzustände sind endgültig", und zwar nur durch `MA` — so steht es in Fußnote [5] |
| Ergebnisarten in 4.7 sind ein **Vorschlag** | Welche Prüfung sperrt und welche nur warnt, ist ein offener Punkt von M2 und wird in 5.5 bestätigt oder geändert — dort, nicht im Code |
| 4.7 als Testvorlage | Jede der 44 Zeilen ergibt mindestens zwei Szenarien (Prüfung geht durch / spricht an), bei Sperren ein drittes für die Übersteuerung nach 5.5. Fristablauf bekommt ein eigenes Szenario mit der Erwartung „Status unverändert, Eskalation ausgelöst" |

**Offen / als Nächstes**

- **Neue offene Fragen 23 und 24** in `SPEC.md`:
  - **23** — Darf der Lieferantendisponent eine Einladung selbst absagen? 3.5
    sieht `declined`, `declineReason` und `respondedAt` vor, die Matrix 2.2
    gibt `LD` auf der Zeile „Ausschreibung, Einladung (3.5)" aber nur `L[16]`:
    kein `S`, kein `Ä`. Entweder erhält `LD` ein eng begrenztes Statusrecht auf
    die **eigene** Einladung (analog [20]) oder der `MD` erfasst die Absage auf
    Meldung. Das ist eine Entscheidung über Kapitel 2.
  - **24** — Darf eine Abrechnungsperiode geschlossen werden, solange einzelne
    Stundenzettel nicht entschieden sind? Die Vorbedingung in 4.5.1 verlangt
    heute, dass alle Zettel entschieden sind — strenge Folge aus 2.4 Regel 1,
    mit dem Preis, dass ein hängender Zettel die ganze Periode aufhält.
- **Widersprüche und Lücken, die bei der Ausarbeitung aufgefallen sind** und
  bewusst **nicht** stillschweigend aufgelöst wurden. Sie stehen jeweils als
  Hinweis an der betroffenen Stelle in `SPEC.md`:
  1. **2.2 ↔ 3.5 (Absage einer Einladung)** — siehe offene Frage 23.
  2. **3.4 ohne Feld für den Rückweisungsgrund.** Die Rückweisung
     `submitted` → `draft` (4.1) verlangt eine Begründung; 3.4 führt nur
     `cancellationReason` für den Storno. Bis zur Entscheidung steht die
     Begründung im Audit-Eintrag (`reason`, 3.12). Entweder erhält 3.4 ein
     eigenes Feld, oder die Protokolllösung wird ausdrücklich festgeschrieben.
  3. **3.6 `submittedAt` als unbedingte Pflicht.** Die Matrix setzt mit `X[21]`
     („nur im Status Entwurf") einen Zustand `draft` des Profilvorschlags
     voraus, 3.6 führt `submittedAt` aber als Pflichtfeld ohne Einschränkung.
     Richtig wäre „Pflicht ab Status eingereicht" — eine Wortkorrektur in 3.6,
     die diese Arbeitseinheit nicht vorgenommen hat, weil nur Kapitel 4
     geändert werden sollte.
  4. **2.2 ↔ offene Frage 6 (Rechnungseingang).** Reicht der Lieferant seine
     Rechnung selbst ein (Variante B), muss er einen Beleg **anlegen** können.
     Die Matrix gibt `LD` auf der Belegzeile nur `L[7] S[32]` — kein `A`. Mit
     der Antwort auf Frage 6 ist in 2.2 ein `A[7]` nachzutragen und [32] um das
     Einreichen zu erweitern.
  5. **3.7 führt die vorzeitige Beendigung nicht als eigenen Vorgang** (anders
     als die Verlängerung), sondern als Felder am Einsatz. Ein beantragter,
     noch nicht entschiedener Beendigungsvorgang hat deshalb keinen eigenen
     Zustand. Für den Prototyp genügt das; soll die Beendigung mehrstufig
     genehmigt werden, ist in 3.7 ein Vorgang analog `assignmentExtension`
     nachzutragen.
- **Statusmodelle, die weiter fehlen** (aus der Übergabe von Kapitel 3):
  Rahmenvertrag und Preisliste (3.3) brauchen ein vollständiges Modell mit
  Übergängen und auslösender Rolle; Dokument/Nachweis (3.10) gehört mit
  Anerkennung, Fristen und Sperrwirkung nach **5.4**; Kunde, Standort und
  Kostenstelle (3.1) haben nur aktiv/inaktiv, die Matrix hält `S` für `MA`
  frei. Die Ausschreibung (3.5) braucht kein eigenes Modell — der Fortschritt
  ergibt sich aus 4.1 und den Einladungen. Alle vier Punkte stehen als Tabelle
  in 4.0.
- **Offene Frage 18 bleibt die wichtigste.** Die Prüfungen P1
  (Höchstüberlassungsdauer) und P6 (Drehtür) in 4.2, 4.3 und 4.4 setzen voraus, dass
  der Betreiber dieselbe Person über Lieferanten hinweg erkennt
  (`workerIdentity`). Wird Frage 18 mit „nein" beantwortet, prüfen diese
  Übergänge nur innerhalb eines Lieferanten. Die Zustände und Übergänge
  ändern sich dadurch nicht — die Aussagekraft der Prüfungen schon.
- **Offene Fragen 4, 5, 6, 15, 16, 20 und 21 wirken in Kapitel 4 hinein.** Das
  Kapitel trägt beide Antworten; die Stellen sind mit *(offene Frage n)*
  gekennzeichnet. Besonders: Frage 5 betrifft nur `assignedRoleCode` je
  Freigabeschritt, Frage 6 nur die Spalte „Seite / Variante" in 4.5.2.
- **Als Nächstes M2:** Kapitel 5.1, 5.2 und 5.4 ausformulieren und die
  `.feature`-Dateien in `tests/aueg/` aus der Tabelle 4.7 ableiten. Dort ist
  auch die Spalte „Ergebnisart" zu bestätigen — M2 nennt sie als eigene
  Entscheidung („welche Prüfung sperrt und welche nur warnt").
- Glossar 1.5 um die Rechenbegriffe aus Kapitel 5 und die Datenschutzbegriffe
  aus Kapitel 6 ergänzen, dann den TODO-Marker entfernen.
- **Hinweis zu M5 und M6.** Beide nennen „SPEC Kapitel 3.8 und 4.4" bzw.
  „3.9 und 4.5" als ein Paket. Mit dieser Arbeitseinheit sind beide
  Spezifikationshälften fertig; die Punkte sind in `MILESTONES.md` aber
  **nicht** umgestellt worden, weil der Auftrag dieser Arbeitseinheit nur den
  Punkt unter M1 nannte. Nachzuziehen, sobald es jemand bestätigt.

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
