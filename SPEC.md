# Spezifikation — VMS für Arbeitnehmerüberlassung

**Status: in Arbeit.** Die Kapitel 2 (Rollen und Berechtigungen), 3 (Objekte und
Datenmodell), 4 (Statusmodelle) und 5 (AÜG-Regeln) sind ausgearbeitet; Kapitel 1
und 6 sind Gliederung. Jeder Abschnitt wird einzeln ausgearbeitet; unausgefüllte
Punkte sind mit `TODO` markiert. Keine Annahmen — ungeklärtes gehört in
[Offene Fragen](#7-offene-fragen).

> **Rechtlicher Hinweis:** Die genannten Paragrafen dienen der Orientierung.
> Vor der Implementierung ist jede Regel gegen den aktuellen Gesetzestext und
> den einschlägigen Tarifvertrag zu prüfen. Dieses Dokument ist keine
> Rechtsberatung.

---

## 1. Kontext und Abgrenzung

- 1.1 Zweck des Systems — TODO
- 1.2 Betreibermodell: MSP / Personaldienstleister steuert mehrere Kunden
  (Entleiher) und mehrere Lieferanten (Sub-Verleiher) — TODO ausarbeiten
- 1.3 Mandantentrennung: was sieht wer nicht — TODO
- 1.4 Nicht im Umfang (Lohnabrechnung, Zeitwirtschaft des Entleihers,
  Bewerbermanagement des Lieferanten) — TODO
- 1.5 Glossar DE → EN (Fachbegriff, englischer Bezeichner, Definition) — die
  Begriffe aus Kapitel 2, die Objekt- und Attributbezeichner aus Kapitel 3, die
  Status- und Übergangsbegriffe aus Kapitel 4 und die Rechen- und Prüfbegriffe
  aus Kapitel 5 sind unten gemappt; die Datenschutzbegriffe aus Kapitel 6 folgen
  mit diesem Kapitel — TODO (Kapitel 6)

### 1.5 Glossar DE → EN

Enthält die Begriffe aus Kapitel 2 (Rollen, Berechtigung, Mandant, Vertretung,
Eskalation), die Objekt- und Attributbezeichner aus Kapitel 3, die Status- und
Übergangsbegriffe aus Kapitel 4 und die Rechen- und Prüfbegriffe aus Kapitel 5.
Weitere Begriffe werden in **diese** Tabelle ergänzt, nicht in eine zweite.

**Zu den Statuswerten aus Kapitel 4:** Dieselbe Bedeutung trägt denselben
Bezeichner, auch über Modelle hinweg; die Spalte „Bedeutung" nennt deshalb die
Modelle, in denen ein Wert vorkommt. Wo ein Zustand fachlich etwas anderes ist,
trägt er einen anderen Namen (4.0, Namenskonvention).

| Deutsch | Englischer Bezeichner | Bedeutung |
|---|---|---|
| Betreiber (MSP) | `operator` | Personaldienstleister, der das VMS betreibt und mehrere Kunden und Lieferanten steuert |
| MSP-Administrator | `operatorAdmin` | Rolle: verantwortet Mandanten, Benutzer, Stammdaten und Regelwerk |
| MSP-Disponent | `operatorCoordinator` | Rolle: operative Steuerung des Kernprozesses |
| Bedarfsträger | `demandOwner` | Rolle auf Kundenseite: meldet Bedarf, entscheidet fachlich über Kandidaten |
| Genehmiger | `approver` | Rolle auf Kundenseite: Budget- und Zeitfreigabe |
| Einkauf / Controlling | `procurementController` | Rolle auf Kundenseite: kaufmännischer Rahmen und Auswertung |
| Lieferantendisponent | `supplierCoordinator` | Rolle beim Lieferanten: Angebote, Kandidaten, Zeiten |
| Lieferantenadministrator | `supplierAdmin` | Rolle beim Lieferanten: Stammdaten, Nachweise, Benutzer |
| Leiharbeitnehmer | `temporaryWorker` | überlassene Person; eigener Zugang ist offene Frage 4 |
| Rolle | `role` | Funktion mit festgelegten Rechten, keine Person |
| Rollenzuweisung | `roleAssignment` | Verbindung aus Benutzer, Rolle und Mandant |
| Berechtigung | `permission` | Recht einer Rolle auf eine Operation an einem Objekt |
| Berechtigungsmatrix | `permissionMatrix` | Zuordnung Rolle × Objekt × Operation (Kapitel 2.2) |
| Operation | `operation` | `create`, `read`, `update`, `transition`, `delete` |
| Statuswechsel | `statusTransition` | Übergang eines Objekts in einen anderen Status (Kapitel 4) |
| Mandant | `tenant` | Organisation mit eigenem Datenraum (Betreiber, Kunde, Lieferant) |
| Mandantenzuordnung | `tenantAssignment` | Zuordnung eines Benutzers zu einem Mandanten |
| Betreuungszuordnung | `accountAssignment` | Einschränkung eines MSP-Benutzers auf eine Teilmenge der Kunden |
| Zuständigkeit | `responsibilityScope` | Einschränkung innerhalb eines Mandanten (Standort, Kostenstelle) |
| Sichtbarkeitsregel | `visibilityRule` | Regel, welche Objekte ein Mandant sehen darf (Kapitel 2.3) |
| Datenminimierung | `dataMinimization` | Beschränkung der übermittelten Daten auf das Erforderliche |
| Pseudonymisiertes Profil | `pseudonymizedProfile` | Kandidatenprofil ohne Klardaten (Kapitel 6.4) |
| Vier-Augen-Prinzip | `dualControl` | Erstellen und Freigeben nicht durch dieselbe Person |
| Übersteuerung | `override` | dokumentiertes Abweichen von einer Systemsperre (Kapitel 5.5) |
| Vertretung | `delegation` | befristete Übertragung der Rechte einer Rollenzuweisung |
| Vertreter | `delegate` | Person, die eine Rollenzuweisung vertritt |
| Vertretungszeitraum | `delegationPeriod` | Beginn und Ende einer Vertretung |
| Vertretungsvermerk | `delegationNote` | Kennzeichnung einer Handlung in Vertretung |
| Eskalation | `escalation` | Weitergabe eines liegengebliebenen Vorgangs an eine weitere Stelle |
| Eskalationsstufe | `escalationLevel` | Position in der Stufenfolge einer Eskalation |
| Eskalationsfrist | `escalationDeadline` | Frist, nach deren Ablauf eskaliert wird |
| Mandantentyp | `tenantType` | `operator`, `customer` oder `supplier` (Kapitel 3.11) |
| Fachliche Kennung | `…Number` | lesbare, mandantenweit eindeutige Nummer eines Objekts (z. B. `customerNumber`) |
| Gültigkeitsbeginn / -ende | `validFrom` / `validTo` | fachlicher Gültigkeitszeitraum; `validTo` leer = unbefristet |
| Deaktivierung | `deactivatedAt` | fachliches „Löschen" (Kapitel 2.2, 6.6) |
| Fremdsystemkennung | `externalReference` | Kennung desselben Sachverhalts in einem Fremdsystem (offene Frage 7) |
| Kunde / Entleiher | `customer` | Organisation, die Leiharbeitnehmer entleiht (Kapitel 3.1) |
| Standort | `site` | konkreter Einsatzort eines Kunden (Kapitel 3.1) |
| Kostenstelle | `costCenter` | kaufmännische Zuordnung beim Kunden (Kapitel 3.1) |
| Konzernzugehörigkeit | `corporateGroup` | Konzernverbund des Kunden; relevant für die Drehtürklausel (Kapitel 5.3) |
| Lieferant / Verleiher | `supplier` | Sub-Verleiher, der Personal stellt (Kapitel 3.2) |
| AÜG-Erlaubnis | `supplierPermit` | Erlaubnis zur Arbeitnehmerüberlassung eines Lieferanten (Kapitel 3.2) |
| Erlaubnisnummer | `permitNumber` | Aktenzeichen der Erlaubnis |
| Erlaubnisbehörde | `issuingAuthority` | ausstellende Agentur für Arbeit |
| Rahmenvertrag | `masterAgreement` | Vertragsrahmen zwischen Betreiber und einem Kunden oder Lieferanten (Kapitel 3.3) |
| Preisliste | `rateCard` | Satz von Konditionen zu einem Rahmenvertrag (Kapitel 3.3) |
| Preisposition | `rateCardItem` | eine Kondition der Preisliste (Grundsatz oder Zuschlagssatz) |
| Verrechnungssatz | `hourlyRate` | Stundensatz einer Preisposition |
| Einkaufspreisliste | `supplierRateCard` | Konditionen Betreiber ↔ Lieferant |
| Kundenpreisliste | `customerRateCard` | Konditionen Betreiber ↔ Kunde |
| Tarifzuordnung | `collectiveAgreementAssignment` | anzuwendender Tarifvertrag für Lieferant, Kunde oder Standort (Kapitel 3.3) |
| Tarifvertrag | `collectiveAgreement` | Katalogwert (iGZ, BAP, Branchenzuschlagstarif …); der Katalog ist Konfiguration (3.3) |
| Branchenzuschlag | `industryPremium` | tariflicher Zuschlag nach Einsatzbranche (Kapitel 5.2) |
| Höchstüberlassungsdauer | `maxAssignmentDuration` | zulässige Dauer der Überlassung an denselben Entleiher (Kapitel 5.1) |
| Equal-Pay-Frist | `equalPayDeadline` | Frist, ab der Equal Pay greift (Kapitel 5.2) |
| Vergleichsentgelt | `comparableWage` | Entgelt eines vergleichbaren Stammarbeitnehmers (Kapitel 5.2) |
| Vergleichsentgelt-Eintrag | `comparableWageEntry` | gepflegter Wert je Tätigkeit und Standort, vom Entleiher gemeldet (Kapitel 3.3) |
| Tätigkeitsschlüssel | `activityKey` | Tätigkeit bzw. Entgeltgruppe, auf die sich ein Vergleichsentgelt bezieht |
| Herkunft der Entgeltangabe | `wageSource` | Tarif, Betriebsvereinbarung, Einzelvertrag oder Schätzung |
| Bedarfsanfrage | `demandRequest` | gemeldeter Personalbedarf eines Kunden (Kapitel 3.4) |
| Tätigkeitsbeschreibung | `activityDescription` | Konkretisierung der Tätigkeit (Kapitel 5.3) |
| Anforderung (Qualifikation) | `qualificationRequirement` | geforderte Qualifikation einer Bedarfsanfrage |
| Anzahl / Kopfzahl | `headcount` | Zahl der gesuchten bzw. angebotenen Personen |
| Angebotsfrist | `offerDeadline` | Frist für den Eingang von Angeboten |
| Ausschreibung | `tender` | Verteilung einer freigegebenen Bedarfsanfrage an Lieferanten (Kapitel 3.5) |
| Ausschreibungsrunde | `tenderRound` | Zählung wiederholter Ausschreibungen zur selben Anfrage |
| Einladung | `tenderInvitation` | Teilnahme genau eines Lieferanten an einer Ausschreibung |
| Lieferantenangebot | `supplierOffer` | Antwort eines Lieferanten auf eine Einladung (Kapitel 3.5) |
| Angebotsposition | `supplierOfferItem` | Preis- und Mengenangabe eines Angebots je Qualifikation |
| Bindefrist | `offerValidUntil` | Frist, bis zu der ein Angebot gilt |
| Kandidat | `candidate` | Person, die ein Lieferant für Überlassungen führt (Kapitel 3.6) |
| Profilvorschlag | `candidateSubmission` | Vorlegen eines Kandidaten auf eine konkrete Anfrage (Kapitel 3.6) |
| Offenlegungsstufe | `disclosureLevel` | `pseudonymized` oder `identified` (Kapitel 6.4) |
| Personenidentität | `workerIdentity` | betreiberseitige Verknüpfung von Kandidatensätzen derselben Person (Kapitel 3.6) |
| Drehtürklausel | `revolvingDoorRule` | Regel zur Vorbeschäftigung beim Entleiher (Kapitel 5.3) |
| Einsatz / Überlassung | `assignment` | konkrete Überlassung einer Person an einen Kunden (Kapitel 3.7) |
| Verlängerung | `assignmentExtension` | Verlängerung eines Einsatzes (Kapitel 3.7) |
| Unterbrechung | `assignmentInterruption` | dokumentierte Unterbrechung der Überlassung (Kapitel 5.1) |
| Vorzeitige Beendigung | `earlyTermination` | Beendigung vor dem geplanten Ende |
| Stundenzettel | `timesheet` | Zeitnachweis eines Einsatzes für einen Abrechnungszeitraum (Kapitel 3.8) |
| Zeitposition | `timeEntry` | einzelner Zeitnachweis eines Tages bzw. Abschnitts (Kapitel 3.8) |
| Freigabeschritt | `timesheetApproval` | eine Stufe der Stundenzettelgenehmigung (offene Frage 5) |
| Zuschlagsart | `premiumType` | Katalogwert für Zuschläge (Nacht, Sonntag, Feiertag …) (Kapitel 3.8) |
| Abwesenheitsart | `absenceType` | Grund für fehlende Arbeitsleistung (offene Frage 21) |
| Abrechnungsperiode | `billingPeriod` | Zeitraum, für den abgerechnet wird (Kapitel 3.9) |
| Abrechnungsbeleg | `billingDocument` | kaufmännischer Beleg über Überlassungsleistung (Kapitel 3.9) |
| Belegposition | `billingDocumentItem` | eine Position eines Abrechnungsbelegs |
| Gutschrift | `creditNote` | Belegart im Gutschriftverfahren — im Prototyp das Verfahren der Lieferantenseite (3.9) |
| Rechnung | `invoice` | Belegart im Rechnungseingangsverfahren — dokumentiert, im Prototyp nicht umgesetzt (3.9) |
| Beanstandung | `dispute` | Widerspruch gegen einen Abrechnungsbeleg (Kapitel 4.5) |
| Dokument / Nachweis | `document` | hinterlegtes Schriftstück mit Nachweisfunktion (Kapitel 3.10) |
| Nachweisart | `documentCategory` | Katalogwert der Dokumentart |
| Pflichtnachweis | `mandatory` | Nachweis, den der Pflichtkatalog in 5.4 verlangt |
| Sperrwirkung | `blocking` | ob ein fehlender Pflichtnachweis den Übergang sperrt oder nur warnt (5.4, 5.5) |
| Erlaubnisurkunde | `permitCertificate` | Urkunde zur AÜG-Erlaubnis |
| Unterweisung | `safetyBriefing` | Arbeitsschutzunterweisung am Einsatzort |
| Qualifikationsnachweis | `qualificationCertificate` | Nachweis einer Qualifikation |
| Unbedenklichkeitsbescheinigung | `clearanceCertificate` | Bescheinigung über abgeführte Beiträge und Steuern |
| Vertragsunterlage | `agreementDocument` | Nachweisart für Unterlagen zum Rahmenvertrag |
| Arbeitserlaubnis | `workPermit` | aufenthalts- und arbeitsrechtlicher Nachweis eines Kandidaten |
| Anerkennung (Nachweis) | `verificationStatus` | `submitted`, `accepted`, `rejected` (Kapitel 5.4) |
| Benutzer | `user` | Person mit Zugang zum System (Kapitel 3.11) |
| Rollenkürzel | `roleCode` | technischer Code einer Rolle (`operatorAdmin` …) |
| Audit-Eintrag | `auditEntry` | fachlicher Protokollsatz (Kapitel 3.12) |
| Statusmodell | `statusModel` | Satz zulässiger Zustände und Übergänge eines Objekts (Kapitel 4) |
| Zustand | `state` | ein Wert des Statusmodells |
| Endzustand | `terminalState` | Zustand, aus dem kein Übergang herausführt (4.0, Regel 9) |
| Übergang | `transition` | Wechsel von einem Zustand in einen anderen |
| Auslösende Rolle | `triggeringRole` | Rolle, die einen Übergang auslöst; braucht `S` in 2.2 |
| Vorbedingung | `precondition` | Bedingung, die vor einem Übergang erfüllt sein muss |
| Nebenwirkung | `sideEffect` | Folge eines Übergangs: Benachrichtigung, Sperre, Protokolleintrag, Fristenlauf |
| Systemübergang | `systemTransition` | Übergang ohne Benutzerhandlung, zeitgesteuert oder abgeleitet (4.0, Regel 10) |
| Prozessfrist | `processDeadline` | Frist des Verfahrens ohne rechtliche Wirkung; Vorbelegungen in 4.0 |
| Fristvorbelegung | `…DeadlineDays` | Konfigurationsschlüssel einer Prozessfrist in `processDeadlineConfig` (3.1), Werte in 4.0 |
| Fristenlauf | `deadlineClock` | Beginn und Fortlauf einer Frist, die ein Übergang in Gang setzt |
| Prüfergebnis | `ruleCheckResult` | Ergebnis einer AÜG-Prüfung (Kapitel 4.7, 5.5) |
| Information (Ergebnisart) | `info` | Übergang findet statt, Ergebnis wird vermerkt (4.7) |
| Warnung (Ergebnisart) | `warning` | Übergang findet statt, erzeugt Benachrichtigung und Eskalationsanlass (4.7) |
| Sperre (Ergebnisart) | `block` | Übergang findet nicht statt; Übersteuerung nur nach 5.5 (4.7) |
| Entwurf | `draft` | Anfangszustand: Bedarfsanfrage (4.1), Angebot und Profilvorschlag (4.2), Rahmenvertrag und Preisliste (3.3) |
| Eingereicht | `submitted` | zur Entscheidung vorgelegt: Bedarfsanfrage, Angebot, Profilvorschlag, Stundenzettel (4.1, 4.2, 4.4); auch Anerkennungsstatus eines Nachweises (5.4) |
| Freigegeben / genehmigt | `approved` | kundenseitig entschieden: Bedarfsanfrage (4.1), Verlängerung (4.3), Stundenzettel (4.4); auch Anerkennungsstatus eines Nachweises (5.4) |
| Ausgeschrieben | `tendered` | Bedarfsanfrage ist an Lieferanten verteilt (4.1) |
| In Auswahl | `inSelection` | mindestens ein Profil ist dem Kunden vorgelegt (4.1) |
| Besetzt | `filled` | so viele Einsätze wie `headcount` (4.1) |
| Storniert | `cancelled` | Vorgang aufgehoben: Bedarfsanfrage (4.1), Abrechnungsbeleg (4.5) |
| Abgelaufen | `expired` | Frist verstrichen, ohne dass etwas zustande kam: Bedarfsanfrage, Einladung, Angebot (4.1, 4.2); auch Preisliste und Rahmenvertrag (3.3) |
| Eingeladen | `invited` | Einladung zugestellt (4.2) |
| Zur Kenntnis genommen | `viewed` | Einladung geöffnet (4.2) |
| Angebot abgegeben | `offerSubmitted` | Einladung ist mit einem Angebot beantwortet (4.2) |
| Abgesagt | `declined` | Lieferant bietet nicht an; vom Lieferantendisponenten selbst gesetzt (4.2.1, [46]) |
| Gesichtet | `reviewed` | Betreiber hat Angebot bzw. Profilvorschlag bewertet (4.2) |
| Dem Kunden vorgelegt | `releasedToCustomer` | Profilvorschlag ist pseudonymisiert beim Kunden (4.2, 6.4) |
| Interview vereinbart | `interviewScheduled` | Kunde will die Person kennenlernen (4.2) |
| Zugesagt | `accepted` | Zuschlag bzw. fachliche Zusage (4.2); auch Anerkennungsstatus eines Nachweises (5.4) |
| Abgelehnt | `rejected` | Absage mit Begründung: Angebot, Profilvorschlag, Verlängerung, Stundenzettel (4.2–4.4); auch Anerkennungsstatus eines Nachweises (5.4) |
| Zurückgezogen | `withdrawn` | durch den Einreicher beendet: Angebot, Profilvorschlag, Verlängerung (4.2, 4.3) |
| Geplant | `planned` | Einsatz angelegt, Überlassung nicht begonnen (4.3) |
| Aktiv | `active` | läuft: Einsatz (4.3), Lieferant (4.6); auch Preisliste und Rahmenvertrag (3.3) |
| Unterbrochen | `interrupted` | dokumentierte Unterbrechung der Überlassung läuft (4.3) |
| Beendet | `completed` | Einsatz regulär zum geplanten Ende abgelaufen (4.3) |
| Vorzeitig beendet | `terminatedEarly` | Einsatz endet vor dem geplanten Ende (4.3) |
| Beantragt | `requested` | Verlängerung beantragt, nicht entschieden (4.3) |
| Wirksam | `effective` | Verlängerung vollzogen, `plannedEndDate` verschoben (4.3) |
| Erfasst | `recorded` | Stundenzettel in Erfassung, Zeitpositionen änderbar (4.4) |
| In Prüfung (Stundenzettel) | `inApproval` | mindestens ein Freigabeschritt offen (4.4) *(offene Frage 5)* |
| Korrigiert | `corrected` | Stundenzettel durch eine genehmigte Korrekturfassung ersetzt (4.4) |
| Korrekturfassung | `correctionOf` | neuer Stundenzettel, der einen genehmigten ersetzt (3.8, 4.4) |
| Offen (Periode) | `open` | Abrechnungsperiode nimmt Zeiten und Belege auf (4.5) |
| Geschlossen (Periode) | `closed` | Abrechnungsperiode abgeschlossen (4.5) |
| Erstellt | `created` | Abrechnungsbeleg erzeugt, nicht abgegeben (4.5) |
| In Prüfung (Beleg) | `inReview` | Abrechnungsbeleg wird vor der Freigabe geprüft (4.5) |
| Freigegeben (Beleg) | `released` | Vier-Augen-Freigabe erfolgt, Beleg abgegeben (4.5) |
| Beanstandet | `disputed` | Gegenseite widerspricht dem Beleg (4.5) |
| Bestätigt | `confirmed` | Gegenseite bestätigt den Beleg; nur Einkaufsseite (4.5) |
| Onboarding | `onboarding` | Lieferant angelegt, Voraussetzungen unvollständig (4.6) |
| Gesperrt | `blocked` | Teilnahme des Lieferanten ausgesetzt (4.6) |
| Inaktiv | `inactive` | Beauftragung des Lieferanten beendet (4.6); auch Kandidat (3.6) |
| Gekündigt | `terminated` | Rahmenvertrag beendet (3.3); Statusmodell noch nicht geführt (4.0) |
| Höchstüberlassungsprüfung | `maxDurationCheck` | Prüfung P1 (4.7, 5.1) |
| Unterbrechungsprüfung | `interruptionResetCheck` | Prüfung P2 (4.7, 5.1) |
| Equal-Pay-Fristprüfung | `equalPayDeadlineCheck` | Prüfung P3 (4.7, 5.2) |
| Vergleichsentgeltprüfung | `comparableWageCheck` | Prüfung P4 (4.7, 5.2) |
| Branchenzuschlagsprüfung | `industryPremiumCheck` | Prüfung P5 (4.7, 5.2) |
| Drehtürprüfung | `revolvingDoorCheck` | Prüfung P6 (4.7, 5.3) |
| Arbeitskampfprüfung | `industrialActionCheck` | Prüfung P7 (4.7, 5.3) |
| Konkretisierungsprüfung | `concretizationCheck` | Prüfung P8 (4.7, 5.3) |
| Erlaubnisprüfung | `permitValidityCheck` | Prüfung P9 (4.7, 5.4) |
| Nachweisprüfung | `mandatoryDocumentCheck` | Prüfung P10 (4.7, 5.4) |
| Arbeitsverhältnisprüfung | `employmentRelationshipCheck` | Prüfung P11 (4.7, 5.3) |
| Stichtag | `evaluationDate` | der eine Tag, auf den eine Prüfung rechnet; nie „heute" (5.0) |
| Prüfzeitraum | `evaluationPeriod` | Zeitraum, für dessen **jeden** Tag eine Prüfbedingung erfüllt sein muss (5.0) |
| Überlassungstag | `assignmentDay` | Kalendertag, an dem mindestens ein Einsatz derselben Person bei demselben Kunden überlassen ist; überlappende Einsätze ergeben einen Tag (5.0) |
| Tatsächlicher Überlassungstag | `realizedAssignmentDay` | Überlassungstag aus einem begonnenen Einsatz, ohne Tage einer Unterbrechung (5.0) |
| Vorgesehener Überlassungstag | `plannedAssignmentDay` | Überlassungstag aus einem geplanten oder noch nicht erbrachten Zeitraum (5.0) |
| Lückentag | `gapDay` | Kalendertag innerhalb einer Kette ohne Überlassung; verbraucht Kalenderzeit, aber kein Fristbudget (5.0, 5.1.3) |
| Überlassungskette | `assignmentChain` | Folge aller Überlassungstage einer Person bei einem Kunden ohne Lücke von mehr als drei Monaten; gemeinsame Rechengrundlage von 5.1 und 5.2 |
| Kettenbeginn | `chainStartDate` | erster Überlassungstag der Kette (5.0) |
| Tagebudget Höchstüberlassung | `maxDurationDays` | Zahl der Kalendertage, die die Monatsgrenze ab `chainStartDate` ergibt (5.1.3) |
| Fristende Höchstüberlassung | `maxDurationEndDate` | letzter zulässiger Überlassungstag der Kette (3.7, 5.1.3) |
| Fristbudget Equal Pay | `equalPayDeadlineDays` | Zahl der Kalendertage, die die Equal-Pay-Frist ab `chainStartDate` ergibt (5.2.3) |
| Equal-Pay-Fälligkeit | `equalPayDueDate` | **erster** Tag, für den Equal Pay geschuldet ist (3.7, 5.2.3) |
| Zählwirksame Unterbrechung | `countsAsReset` | Unterbrechung von **mehr als** drei Monaten; setzt die Zählung zurück (3.7, 5.1.4) |
| Drei-Monats-Grenze | `dreiMonatsEnde` | Vortag des entsprechenden Tages im dritten Folgemonat ab Lückenbeginn; exakt drei Monate setzen **nicht** zurück (5.1.4) |
| Arbeitskampfanzeige | `industrialActionNotice` | Meldung des Entleihers über einen Arbeitskampf am Standort; **Kapitel 3 führt dafür kein Feld** (5.3.2, offene Frage 30) |
| Zusicherung bei Arbeitskampf | `industrialActionAssurance` | Erklärung des Entleihers nach § 11 Abs. 5 Satz 2 AÜG, dass keine Tätigkeiten Arbeitskampfbetroffener übernommen werden (5.3.2) |
| Kennzeichnung | `designationAsTemporaryWork` | ausdrückliche Bezeichnung der Überlassung im Vertrag; Kriterium K1 in 5.3.3 |
| Konkretisierung | `concretization` | Benennung der Person vor der Überlassung unter Bezugnahme auf den Vertrag; Kriterien K2 bis K5 in 5.3.3 |
| Nachweisfluss | `verificationFlow` | Lebenszyklus der Anerkennung eines Nachweises: `submitted` → `accepted` / `rejected` (5.4.3) |
| Vorlauffrist Nachweis | `documentExpiryNoticeDays` | gestufte Vorlaufwerte vor Ablauf eines Nachweises (5.0, 5.4.4) |
| Nächtlicher Lauf | `nightlyRuleRun` | täglicher Prüflauf für zeitabhängige Befunde; erzeugt nie einen Statuswechsel und nie eine Sperre (5.5.1) |
| Festwert des Regelwerks | — | Schwellen- und Vorlaufwert, der Systemverhalten beschreibt und deshalb in 5.0 steht, nicht in der Konfiguration |
| Gesetzliche Regelgrenze | — | Wert, der ohne Tarifzuordnung gilt: 18 Monate (5.1.2), 9 Monate bzw. bei fehlendem Verleihertarif der erste Überlassungstag (5.2.2) |

## 2. Rollen und Berechtigungen

Rollen beschreiben **Funktionen, nicht Personen**. Eine Person kann mehrere
Rollen tragen, aber nur innerhalb **einer** Organisation (Betreiber, Kunde oder
Lieferant). Eine Rolle, die über Organisationsgrenzen hinweg gilt, gibt es
nicht.

Die wirksame Berechtigung eines Benutzers ist die **Schnittmenge** aus drei
Angaben:

1. **Rolle** — was darf diese Funktion fachlich (Kapitel 2.2)?
2. **Mandantenzuordnung** — auf welche Organisation wirkt das Recht
   (Kapitel 2.3)?
3. **Zuständigkeit** — auf welche Objekte innerhalb dieser Organisation
   (Standort, Kostenstelle, Betreuungszuordnung)?

Fehlt eine der drei, besteht kein Zugriff. Rollen erben nicht voneinander: eine
„höhere" Rolle hat nicht automatisch die Rechte einer „niedrigeren".

> **Abhängigkeit von offenen Fragen.** Dieses Kapitel ist so formuliert, dass
> es beide Antworten auf **offene Frage 4** (eigener Zugang für
> Leiharbeitnehmer) und **offene Frage 8** (eine Instanz pro MSP oder getrennte
> Instanzen) verträgt:
>
> - Zu Frage 4: Die Rolle `Leiharbeitnehmer` ist durchgängig als *optionaler*
>   Zugang beschrieben. Alle Vorgänge, die sie betrifft, haben eine zweite
>   Zuständigkeit (Lieferant: Disponent, siehe Fußnote [27] in 2.2). Wird die
>   Frage mit „kein eigener Zugang" beantwortet, entfällt die Spalte `AN` der
>   Berechtigungsmatrix vollständig, ohne dass eine andere Regel nachzuziehen
>   ist. Betroffene Stellen sind mit *(offene Frage 4)* gekennzeichnet.
> - Zu Frage 8: Kapitel 2.3 formuliert **fachliche** Sichtbarkeitsregeln. Sie
>   gelten unabhängig davon, ob alle Kunden eines MSP in einer Instanz oder in
>   getrennten Instanzen betrieben werden. Bei getrennten Instanzen sind
>   einzelne Regeln bereits durch die Betriebsform erfüllt — sie entfallen
>   dadurch nicht als Anforderung. Betroffene Stellen sind mit
>   *(offene Frage 8)* gekennzeichnet.

### 2.1 Rollenübersicht

#### Betreiber / MSP-Administrator (`operatorAdmin`)

**Zweck.** Verantwortet das System als Ganzes: Mandanten, Benutzer, Stammdaten
und Regelwerk. Die einzige Rolle mit Querschnittssicht über alle Kunden und
Lieferanten.

**Typische Aufgaben**

- Kunden, Lieferanten, Standorte und Kostenstellen anlegen und pflegen
- Benutzer, Rollen und Mandantenzuordnungen verwalten (Kapitel 3.11)
- Rahmenverträge, Preislisten und Tarifzuordnungen hinterlegen (Kapitel 3.3)
- Lieferanten freischalten, sperren und entsperren (Kapitel 4.6)
- Schwellen, Fristen und Regelverhalten des AÜG-Regelwerks konfigurieren
  (Kapitel 5.5)
- Berechtigungsreview und Auswertung der Audit-Einträge (Kapitel 6.8)

**Abgrenzung.** Gegenüber dem MSP-Disponenten: der Administrator richtet ein
und konfiguriert, er führt das Tagesgeschäft nicht. Gegenüber allen
Kundenrollen: er ersetzt keine Kundenentscheidung — er kann weder genehmigen
noch Stundenzettel freigeben, auch nicht in Vertretung (Kapitel 2.4).
Fremderstellte Inhalte (Lieferantenangebote, Profilvorschläge) kann er sperren
oder stornieren, aber nicht inhaltlich ändern.

#### MSP-Disponent (`operatorCoordinator`)

**Zweck.** Operative Steuerung des Kernprozesses Bedarf → Ausschreibung →
Besetzung → Einsatz → Abrechnung für die ihm zugeordneten Kunden.

**Typische Aufgaben**

- Bedarfsanfragen prüfen, ggf. im Auftrag des Kunden anlegen (Kapitel 3.4)
- Ausschreibung an geeignete Lieferanten verteilen und steuern (Kapitel 3.5)
- Lieferantenangebote und Profilvorschläge sichten, dem Kunden pseudonymisiert
  vorlegen, Zu- und Absagen gegenüber dem Lieferanten führen (Kapitel 3.6)
- Einsätze anlegen, verlängern, beenden (Kapitel 3.7)
- Stundenzettel überwachen, Korrekturen mit Begründung erfassen (Kapitel 3.8)
- Abrechnungsbelege erstellen, Beanstandungen klären (Kapitel 3.9)
- AÜG-Prüfergebnisse bearbeiten und eskalieren (Kapitel 5)

**Abgrenzung.** Gegenüber dem MSP-Administrator: keine Stammdaten-, Vertrags-
und Benutzerhoheit. Gegenüber dem Lieferanten: er bewertet und vermittelt
Angebote, erstellt aber keine eigenen Profilvorschläge. Gegenüber dem
Bedarfsträger: er führt den Prozess, trifft aber nicht die fachliche
Auswahlentscheidung.

#### Kunde: Bedarfsträger / Fachbereich (`demandOwner`)

**Zweck.** Meldet den Personalbedarf seines Fachbereichs und entscheidet
fachlich über die vorgeschlagenen Kandidaten.

**Typische Aufgaben**

- Bedarfsanfrage im Entwurf erstellen und zur Freigabe einreichen
- Anforderungsprofil, Einsatzort, Zeitraum und Qualifikationen beschreiben
- Vorgelegte Profile fachlich beurteilen, Interviews durchführen, zusagen oder
  ablehnen
- Einsätze seines Bereichs verfolgen, Verlängerung oder vorzeitige Beendigung
  beantragen
- Einsatzbezogene Nachweise einsehen (Unterweisung, Qualifikation)

**Abgrenzung.** Gegenüber dem Genehmiger: er beantragt, er genehmigt nicht —
weder Budget noch Zeiten, soweit Kapitel 4 die Freigabe dem Genehmiger
zuweist. Gegenüber Einkauf/Controlling: keine Sicht auf Konditionen und
Preislisten. Gegenüber dem MSP-Disponenten: keine Kommunikation mit dem
Lieferanten und keine Statusführung des Angebots.

#### Kunde: Genehmiger (`approver`)

**Zweck.** Trägt die Freigabeverantwortung auf Kundenseite — Budget- und
Zeitfreigaben.

**Typische Aufgaben**

- Bedarfsanfragen freigeben oder ablehnen (Kapitel 4.1)
- Verlängerung und vorzeitige Beendigung von Einsätzen genehmigen
  (Kapitel 4.3)
- Stundenzettel genehmigen oder ablehnen, soweit Kapitel 4.4 ihm diese Stufe
  zuweist — Stufenzahl und Zuständigkeit sind **offene Frage 5**
- Kostenwirkung des zu genehmigenden Vorgangs beurteilen

**Abgrenzung.** Gegenüber dem Bedarfsträger: er beschreibt keinen Bedarf und
trifft keine fachliche Kandidatenauswahl; wer beantragt, genehmigt nicht
(Vier-Augen-Prinzip, Kapitel 2.4). Gegenüber Einkauf/Controlling: er entscheidet
den Einzelfall, nicht den Rahmen. Gegenüber dem Betreiber: seine Entscheidung
ist nicht delegierbar an den MSP — unentschiedene Vorgänge werden eskaliert,
nicht übernommen.

#### Kunde: Einkauf / Controlling (`procurementController`)

**Zweck.** Verantwortet den kaufmännischen Rahmen und die Nachvollziehbarkeit
des Volumens auf Kundenseite.

**Typische Aufgaben**

- Rahmenvertrag, Preisliste und Konditionen des eigenen Kunden einsehen
- Kostenstellen und Standorte des eigenen Kunden pflegen
- Abrechnungsbelege prüfen und beanstanden (Kapitel 4.5)
- Volumen, Laufzeiten und Kennzahlen des eigenen Kunden auswerten
- Gültigkeitsstatus der AÜG-Erlaubnis der beauftragten Lieferanten verfolgen
  (Kapitel 5.4)

**Abgrenzung.** Gegenüber dem Genehmiger: keine Einzelfallfreigabe von Bedarfen
und Zeiten. Gegenüber dem Bedarfsträger: keine Sicht auf Kandidatendaten.
Gegenüber dem MSP-Administrator: er pflegt keine systemweiten Stammdaten, nur
die seines eigenen Kunden.

#### Lieferant: Disponent (`supplierCoordinator`)

**Zweck.** Bearbeitet die Anfragen, zu denen der eigene Lieferant eingeladen
ist, und stellt Personal.

**Typische Aufgaben**

- Eingeladene Bedarfsanfragen sichten und bewerten
- Angebot abgeben, ändern bis zur Sichtung, zurückziehen
- Kandidaten und Profilvorschläge einstellen und pflegen (Kapitel 3.6)
- Eigene Einsätze verfolgen, Beendigung durch den Lieferanten anzeigen
- Stundenzettel erfassen oder im Namen des Leiharbeitnehmers einreichen,
  solange dieser keinen eigenen Zugang hat *(offene Frage 4)*
- Eigene Gutschriften prüfen, bestätigen oder beanstanden (3.9, 4.5)
- Nachweise zu Kandidaten und Einsätzen hochladen

**Abgrenzung.** Gegenüber dem Lieferantenadministrator: keine Benutzer- und
Stammdatenhoheit der eigenen Organisation, keine Pflege der AÜG-Erlaubnis.
Gegenüber anderen Lieferanten: keinerlei Einblick (Kapitel 2.3). Gegenüber dem
MSP-Disponenten: er bietet an, er entscheidet nicht über die Besetzung.

#### Lieferant: Administrator (`supplierAdmin`)

**Zweck.** Verantwortet die eigene Lieferantenorganisation im System:
Stammdaten, Nachweise, Benutzer.

**Typische Aufgaben**

- Eigene Stammdaten und Ansprechpartner pflegen
- AÜG-Erlaubnis und weitere Nachweise hochladen und aktuell halten
  (Kapitel 5.4)
- Benutzer und Rollen der eigenen Organisation verwalten, Vertretungen
  einrichten
- Eigene Angebote, Einsätze und Belege lesend überblicken

**Abgrenzung.** Gegenüber dem Lieferantendisponenten: keine operative
Bearbeitung von Anfragen, Angeboten und Kandidaten. Gegenüber dem
MSP-Administrator: Hoheit nur über die eigene Organisation; Freischaltung und
Entsperrung des Lieferanten bleiben beim Betreiber.

#### Leiharbeitnehmer (`temporaryWorker`) — *optionaler Zugang, offene Frage 4*

**Zweck.** Sieht die eigenen Einsatzdaten und erfasst — sofern ein Zugang
eingeräumt wird — die eigenen Zeiten.

**Typische Aufgaben** *(nur bei eigenem Zugang)*

- Eigenen Einsatz, Einsatzort und Zeitraum einsehen
- Eigene Zeiten erfassen und zur Genehmigung einreichen
- Eigene Nachweise und Unterweisungen einsehen
- Eigenes Profil einsehen

**Abgrenzung.** Keine Sicht auf andere Leiharbeitnehmer, auf Konditionen,
Preise, Kundendaten über den eigenen Einsatz hinaus oder auf Abrechnungsbelege.
Diese Rolle ist nicht vertretbar (Kapitel 2.4). Ohne eigenen Zugang übernimmt
der Lieferantendisponent alle hier genannten Vorgänge in seinem Namen; die
übrigen Regeln dieses Kapitels bleiben unverändert.

### 2.2 Berechtigungsmatrix Rolle × Objekt × Operation

**Rollenkürzel**

| Kürzel | Rolle |
|---|---|
| MA | Betreiber / MSP-Administrator |
| MD | MSP-Disponent |
| KB | Kunde: Bedarfsträger / Fachbereich |
| KG | Kunde: Genehmiger |
| KE | Kunde: Einkauf / Controlling |
| LD | Lieferant: Disponent |
| LA | Lieferant: Administrator |
| AN | Leiharbeitnehmer *(offene Frage 4)* |

**Operationen:** `A` anlegen · `L` lesen · `Ä` ändern · `S` Status wechseln ·
`X` löschen · `–` kein Zugriff. `[n]` verweist auf die Fußnoten unter der
Tabelle.

**Lesart**

- Die Matrix nennt das **Maximum** je Rolle. Mandantengrenze (Kapitel 2.3) und
  Zuständigkeit gehen vor: ein Recht wirkt nur auf Objekte der eigenen
  Organisation bzw. des betreuten Kunden.
- `L` heißt nicht „alle Felder". Feldeinschränkungen stehen in den Fußnoten;
  die Datenminimierung bei Kandidatendaten regelt Kapitel 6.4.
- `S` meint nur die Übergänge, die **Kapitel 4** der Rolle zuweist. Die Matrix
  sagt, *wer überhaupt*; Kapitel 4 sagt, *welchen Übergang wann*.
- `X` ist im Regelfall Deaktivierung oder Stornierung, nicht physische
  Löschung. Physisches Löschen folgt ausschließlich dem Löschkonzept
  (Kapitel 6.6).
- Die Matrix bleibt auf der Objektgranularität von Kapitel 3. Mit der
  Ausarbeitung von Kapitel 3 sind die Zeilen zu 3.2 (AÜG-Erlaubnis), 3.3
  (Rahmenvertrag, Preisliste, Tarifzuordnung), 3.6 (Personenidentität), 3.8
  (Stundenzettel, Zeitposition) und 3.11 (Vertretung) verfeinert worden; die
  dort getroffenen Entscheidungen bleiben unverändert.
- **Unterobjekte teilen die Zeile ihres Hauptobjekts**, wo Kapitel 3 das
  ausdrücklich sagt: Angebotsposition zum Lieferantenangebot, Verlängerung und
  Unterbrechung zum Einsatz, Freigabeschritt zum Stundenzettel, Belegposition
  zum Abrechnungsbeleg, Preisposition zur Preisliste.

| Objekt (Kap.) | MA | MD | KB | KG | KE | LD | LA | AN |
|---|---|---|---|---|---|---|---|---|
| Kunde / Entleiher (3.1) | A L Ä S X | L Ä[1] | L[2] | L[2] | L[2] Ä[1] | L[3] | L[3] | L[4] |
| Standort (3.1) | A L Ä S X | L Ä[1] | L[2] | L[2] | A[2] L[2] Ä[2] | L[3] | L[3] | L[4] |
| Kostenstelle (3.1) | A L Ä X | L | L[2] | L[2] | A[2] L[2] Ä[2] X[2] | – | – | – |
| Lieferant / Verleiher (3.2) | A L Ä S X | L Ä[1] S[5] | L[6] | – | L[6] | L[7] | L[7] Ä[7] | – |
| AÜG-Erlaubnis (3.2) | A L Ä S X | L S[34] | – | – | L[36] | L[7] | A[7] L[7] Ä[37] S[20] | – |
| Rahmenvertrag (3.3) | A L Ä S X | L | – | – | L[2] | L[40] | L[40] | – |
| Preisliste, Preisposition (3.3) | A L Ä S X | L | – | L[8] | L[2] L[41] | L[9] L[42] | L[9] L[42] | – |
| Tarifzuordnung (3.3) | A L Ä S X | L | – | – | L[2] | L[7] | L[7] | – |
| Vergleichsentgelt (3.3) | A L Ä X | L | – | L[8] | A[2] L[2] Ä[2] X[2] | – | – | – |
| Bedarfsanfrage (3.4) | A L Ä S X | A[10] L Ä S | A L[2] Ä[11] S[12] | L[2] S[13] | L[2] | L[14] | – | – |
| Ausschreibung, Einladung (3.5) | A L Ä S X | A L Ä S | L[15] | – | L[15] | L[16] S[46] | – | – |
| Lieferantenangebot, Angebotsposition (3.5) | L S X | L S[17] | L[18] | – | L[2] | A L[7] Ä[19] S[20] X[21] | L[7] | – |
| Kandidat / Profilvorschlag (3.6) | L S X | L Ä[22] S[17] | L[23] S[24] | – | – | A L[7] Ä[7] S[20] X[21] | L[7] | L[4] |
| Personenidentität (3.6) | A L Ä X | A L Ä[43] | – | – | – | – | – | – |
| Einsatz, Verlängerung, Unterbrechung (3.7) | A L Ä S X | A L Ä S | L[2] S[25] | L[2] S[26] | L[2] | L[7] S[25] | L[7] | L[4] |
| Stundenzettel, Freigabeschritt (3.8) | A L Ä S X | A[27] L Ä[28] S | L[2] S[29] | L[2] S[29] | L[2] | A[27] L[7] Ä[28] S[20] | L[7] | A[4] L[4] Ä[4] S[4] |
| Zeitposition (3.8) | A L Ä X[44] | A[27] L Ä[28] | L[2] | L[2] | L[2] | A[27] L[7] Ä[28] | L[7] | A[4] L[4] Ä[4] |
| Zuschlagsart (Katalog, 3.8) | A L Ä X | L | – | – | L[2] | L[9] | – | – |
| Abrechnungsbeleg, Belegposition (3.9) | A L Ä S X | A L S[30] | – | – | L[2] S[31] | L[7] S[32] | L[7] | – |
| Abrechnungsperiode (3.9) | A L Ä S X | L S[33] | – | – | L[2] | L[7] | L[7] | – |
| Dokument / Nachweis (3.10) | A L Ä S X | L S[34] | L[35] | – | L[36] | A L[7] Ä[37] | A L[7] Ä[37] X[37] | L[4] |
| Benutzer, Rollenzuweisung, Mandantenzuordnung, Zuständigkeit (3.11) | A L Ä S X | L[38] | – | – | L[2] | – | A[7] L[7] Ä[7] S[7] X[7] | – |
| Vertretung (3.11) | A L Ä X | L[38] | A[45] L[45] X[45] | A[45] L[45] X[45] | A[45] L[45] X[45] | A[45] L[45] X[45] | A[7] L[7] Ä[7] X[7] | – |
| Audit-Eintrag (3.12) | L | L[39] | – | – | L[39] | – | L[39] | – |

**Fußnoten**

| # | Einschränkung |
|---|---|
| [1] | Nur Felder ohne kaufmännische Wirkung (Ansprechpartner, Anschrift, Beschreibung); Konditionen gehören zu 3.3. |
| [2] | Nur die eigene Organisation bzw. der eigene Kunde (Mandantengrenze, Kapitel 2.3). |
| [3] | Nur Kunden und Standorte, für die eine eigene Beauftragung besteht, und nur im Umfang, den Kapitel 2.3 zulässt. |
| [4] | Nur bei eigenem Zugang für Leiharbeitnehmer *(offene Frage 4)* und nur die eigenen Daten bzw. der eigene Einsatz. Ohne eigenen Zugang entfällt die Spalte `AN` vollständig. |
| [5] | Sperren ja, Entsperren nein; Entsperrung und Reaktivierung nur durch MA (Vier-Augen-Prinzip, Kapitel 2.4). |
| [6] | Nur Lieferanten mit Beauftragung für den eigenen Kunden; ob dem Kunden die Lieferantenidentität überhaupt angezeigt wird, ist **offene Frage 11**. |
| [7] | Nur die eigene Lieferantenorganisation. |
| [8] | Nur die Kostenwirkung des zu genehmigenden Vorgangs, nicht die Preisliste insgesamt. |
| [9] | Nur die eigenen Konditionen, nie die eines anderen Lieferanten (Kapitel 2.3). |
| [10] | Anlegen im Auftrag des Kunden, mit Kennzeichnung des Auftraggebers. |
| [11] | Nur eigene Anfragen bzw. Anfragen des eigenen Fachbereichs und nur im Status Entwurf. |
| [12] | Einreichen zur Freigabe und Stornieren; die Freigabe selbst erfolgt durch KG. |
| [13] | Freigeben oder ablehnen. |
| [14] | Nur Anfragen mit eigener Einladung, ohne Kostenstelle, ohne interne Vermerke und ohne Angebote anderer Lieferanten (Kapitel 2.3). |
| [15] | Nur Stand und Fortschritt zur eigenen Anfrage; Lieferantenidentität nach **offener Frage 11**. |
| [16] | Nur die eigene Einladung. |
| [17] | Annehmen, ablehnen oder zur Auswahl an den Kunden weiterleiten. |
| [18] | Fachliche Inhalte des Angebots; Preisbestandteile nur, soweit Kapitel 2.3 und 6.4 es zulassen. |
| [19] | Nur solange das eigene Angebot eingereicht und noch nicht gesichtet ist. |
| [20] | Einreichen und Zurückziehen des eigenen Vorgangs. |
| [21] | Nur im Status Entwurf. |
| [22] | Nur Pseudonymisierung und Freigabe der Sichtbarkeit (Kapitel 6.4), nicht die fachlichen Angaben des Lieferanten. |
| [23] | Im Umfang der Datenminimierung (Kapitel 6.4): pseudonymisiertes Profil, Klardaten erst nach Zusage. |
| [24] | Fachliche Auswahlentscheidung (Interview, Zusage, Ablehnung); die Statusführung gegenüber dem Lieferanten übernimmt MD. |
| [25] | Antrag auf Verlängerung oder vorzeitige Beendigung; wirksam wird der Übergang durch MD (Kapitel 4.3). |
| [26] | Genehmigung von Verlängerung und vorzeitiger Beendigung, soweit Kapitel 4.3 sie der Kundenseite zuweist. |
| [27] | Erfassung im Namen des Leiharbeitnehmers, solange dieser keinen eigenen Zugang hat *(offene Frage 4)*. |
| [28] | Korrektur nur mit Begründung und Protokolleintrag (Kapitel 3.12); genehmigte Zeiten nur über eine Korrekturfassung (Kapitel 4.4). |
| [29] | Genehmigen oder ablehnen; Anzahl der Stufen und die jeweils zuständige Rolle sind **offene Frage 5**. |
| [30] | Freigabe nicht durch dieselbe Person, die den Beleg erstellt hat (Vier-Augen-Prinzip, Kapitel 2.4). |
| [31] | Beanstandung; die Statusführung des Belegs bleibt beim Betreiber. |
| [32] | Bestätigen oder beanstanden. Im Gutschriftverfahren (Entscheidung zu offener Frage 6) legt der Lieferant keinen Beleg an — deshalb trägt die Zeile kein `A`. |
| [33] | Öffnen und Schließen einer Abrechnungsperiode. |
| [34] | Nachweis anerkennen oder zurückweisen (Kapitel 5.4). |
| [35] | Nur einsatzbezogene Nachweise zum eigenen Kunden (z. B. Unterweisung, Qualifikation), keine Vertragsunterlagen des Lieferanten. |
| [36] | Nur Gültigkeitsstatus der AÜG-Erlaubnis der beauftragten Lieferanten, ohne Urkundeninhalte. |
| [37] | Nur solange der Nachweis nicht anerkannt ist. |
| [38] | Nur lesend, zur Zuordnung von Vorgängen; die Rollenvergabe bleibt bei MA bzw. LA. Die kundenseitige Benutzerverwaltung liegt derzeit beim Betreiber — **offene Frage 12**. |
| [39] | Nur Einträge zu Objekten der eigenen Organisation bzw. des betreuten Kunden. Audit-Einträge entstehen ausschließlich durch das System und sind für jede Rolle unveränderlich — deshalb trägt die Zeile kein `Ä` und kein `X`. |
| [40] | Nur der eigene Rahmenvertrag mit dem Betreiber; der Rahmenvertrag eines anderen Mandanten ist nie sichtbar. Für KG entfällt die Zeile, weil [8] ausdrücklich nur die Kostenwirkung des Einzelvorgangs meint. |
| [41] | Nur die Kundenpreisliste des eigenen Kunden (Betreiber ↔ Kunde). Die Einkaufskonditionen des Betreibers gegenüber Lieferanten sind für Kundenrollen nicht sichtbar. |
| [42] | Nur die eigene Einkaufspreisliste (Betreiber ↔ eigener Lieferant); die Kundenpreisliste ist nie sichtbar. |
| [43] | Zusammenführen und Trennen von Kandidatensätzen derselben Person. Das Objekt ist ausschließlich beim Betreiber geführt; Kunden und Lieferanten sehen es und seine Existenz nicht (Kapitel 2.3, Regel 4). Dass es geführt wird, ist entschieden; der Merkmalssatz ist in 3.6 abschließend festgelegt. |
| [44] | Die Zeitposition trägt keinen eigenen Status; genehmigt wird der Stundenzettel (Kapitel 4.4). `X` meint das Entfernen einer Position vor der Einreichung; Korrekturen genehmigter Zeiten laufen über eine Korrekturfassung ([28]). |
| [45] | Nur die eigene Vertretung für eine eigene Rollenzuweisung bei geplanter Abwesenheit (Kapitel 2.4, Regel 7). Unvorhergesehene Abwesenheit richtet der Administrator der eigenen Organisation ein (LA bzw. kundenseitig derzeit der Betreiber — **offene Frage 12**). Keine Rechteerweiterung, keine Ketten; `Ä` fehlt, weil eine laufende Vertretung beendet (`X`) und neu angelegt wird. Für AN entfällt die Zeile: die Rolle ist nicht vertretbar (Kapitel 2.4, Regel 8). |
| [46] | Nur die Absage der **eigenen** Einladung (`declined` mit `declineReason`, Kapitel 4.2.1), analog [20]. Keine weitere Statusführung: Annahme, Fristverlängerung und der Fortschritt der Ausschreibung bleiben beim Betreiber. Entscheidung zu *offener Frage 23*. |

### 2.3 Sichtbarkeitsregeln

#### Grundsatz

Die Mandantengrenze geht dem Rollenrecht **vor**. Ein Recht aus Kapitel 2.2
wirkt nur auf Objekte der eigenen Organisation; der Betreiber ist die einzige
Ausnahme (siehe unten). Jede Liste, jede Suche, jeder Bericht, jede
Benachrichtigung und jeder Export unterliegt derselben Grenze — nicht nur die
Detailansicht.

Sichtbarkeit wird **positiv** festgelegt: sichtbar ist, was eine Regel
ausdrücklich erlaubt. Es gibt keine Sicht „aus Versehen", und das Fehlen einer
Regel bedeutet „nicht sichtbar".

#### Zwischen Lieferanten

Ein Lieferant sieht ausschließlich den eigenen Datenraum. Nicht sichtbar sind:

- **fremde Angebote** — Inhalt, Preise, Konditionen, Verfügbarkeiten, Zu- und
  Absagen anderer Lieferanten
- **fremde Kandidaten und Profile** — auch nicht pseudonymisiert oder
  aggregiert
- **die Teilnehmerliste einer Ausschreibung** — wer sonst eingeladen wurde,
  wie viele eingeladen wurden, wie viele Angebote eingegangen sind
- **die eigene Platzierung** — kein Rang, kein Hinweis auf Preisniveau („Ihr
  Angebot liegt über dem Durchschnitt"), keine Ablehnungsbegründung, die auf
  ein fremdes Angebot Bezug nimmt
- **Abrechnungs- und Volumendaten anderer Lieferanten**, auch nicht in
  Kennzahlen des Kunden

Daraus folgen Regeln, die über die reine Objektsichtbarkeit hinausgehen:

1. **Keine Rückschlüsse über Aggregate.** Kennzahlen und Auswertungen für einen
   Lieferanten enthalten nur eigene Werte. Ein Vergleichswert über alle
   Lieferanten ist auch dann unzulässig, wenn er aggregiert ist, solange sich
   daraus bei kleiner Lieferantenzahl ein Einzelwert ableiten lässt.
2. **Keine Rückschlüsse über Benachrichtigungen.** Nachrichten an Lieferanten
   enthalten keine Fremddaten und werden einzeln adressiert; mehrere
   Lieferanten stehen nie gemeinsam im Adressfeld einer Nachricht.
3. **Keine Rückschlüsse über Statusverläufe.** Dass eine Anfrage besetzt wurde,
   darf dem nicht ausgewählten Lieferanten mitgeteilt werden — nicht aber,
   durch wen, mit welchem Kandidaten und zu welchem Preis.
4. **Doppelvorschläge bleiben verdeckt.** Schlagen zwei Lieferanten denselben
   Kandidaten vor, erfährt keiner der beiden davon. Der Konflikt wird nur beim
   Betreiber sichtbar und dort entschieden. Dasselbe gilt für die Zählung der
   Höchstüberlassungsdauer über Lieferanten hinweg (Kapitel 5.1): sie findet
   beim Betreiber statt, und der Lieferant erfährt das Ergebnis nur als
   Information oder Sperre zum eigenen Vorgang — ohne die Einsatzhistorie bei
   anderen Lieferanten.

#### Zwischen Kunden eines MSP

Ein Kunde sieht ausschließlich seine eigene Organisation. Nicht sichtbar sind
Bedarfe, Ausschreibungen, Kandidaten, Einsätze, Stundenzettel, Belege,
Konditionen, Preislisten und Kennzahlen anderer Kunden — einschließlich der
Information, **dass** ein anderer Kunde existiert, soweit sie nicht ohnehin
bekannt ist.

1. Kundenübergreifende Vergleichs- oder Benchmarkauswertungen sind im
   Prototyp **nicht vorgesehen**. Wird so etwas später gewünscht, ist es eine
   eigene fachliche und datenschutzrechtliche Entscheidung und keine
   Erweiterung dieses Kapitels.
2. Lieferantenstammdaten und Nachweise werden beim Betreiber **einmal**
   geführt; ein Kunde sieht daran nur, was seine eigene Beauftragung betrifft
   (Fußnoten [3] und [6] in Kapitel 2.2), nie die Beauftragung eines anderen
   Kunden.
3. Teilt ein Leiharbeitnehmer Einsätze bei mehreren Kunden, sieht jeder Kunde
   nur den eigenen Einsatz. Der Fristenstand aus Kapitel 5.1 und 5.2 wird dem
   Kunden als Ergebnis mitgeteilt, nicht als Historie bei anderen Kunden.
4. Ein kundenseitiger Benutzer, der für mehrere Standorte oder Kostenstellen
   zuständig ist, bleibt innerhalb seiner Kundenorganisation. Eine
   Mandantenzuordnung über Kundengrenzen hinweg ist für Kundenrollen
   ausgeschlossen.

#### Betreiber: Querschnittssicht

Der Betreiber sieht alle Mandanten — das ist der Zweck des MSP-Modells und
keine Lücke. Er ist dabei an drei Bedingungen gebunden:

1. **Zweckbindung.** Zugriff nur zur Steuerung des beauftragten Prozesses.
2. **Betreuungszuordnung.** MSP-Benutzer können auf eine Teilmenge der Kunden
   eingeschränkt werden; die Querschnittssicht ist nicht automatisch jedem
   MSP-Benutzer zu geben.
3. **Protokollierung.** Lesende Zugriffe über Mandantengrenzen hinweg werden
   als Audit-Eintrag erfasst (Kapitel 3.12) und sind Gegenstand des
   Berechtigungsreviews (Kapitel 6.8).

#### Leiharbeitnehmer

Unabhängig davon, ob ein eigener Zugang eingeräumt wird *(offene Frage 4)*,
gilt: ein Leiharbeitnehmer sieht nur die eigenen Daten — eigenen Einsatz,
eigene Zeiten, eigene Nachweise, eigenes Profil. Nie sichtbar sind andere
Leiharbeitnehmer, Konditionen, Preise, Abrechnungsbelege und Kundendaten über
den eigenen Einsatz hinaus. Ohne eigenen Zugang entfällt die Regel nicht, sie
betrifft dann die Auskunft an den Leiharbeitnehmer über andere Wege
(Kapitel 6.7).

#### Unabhängigkeit von der Betriebsform

Die Regeln dieses Abschnitts sind fachliche Anforderungen an die
Sichtbarkeit, nicht an die Betriebsform. Sie gelten gleichermaßen, wenn alle
Kunden eines MSP in einer gemeinsamen Instanz betrieben werden und wenn jeder
Kunde eine eigene Instanz erhält *(offene Frage 8)*. Im Fall getrennter
Instanzen sind die Regeln zwischen Kunden technisch bereits erfüllt; die Regeln
zwischen Lieferanten, die Querschnittssicht des Betreibers und die
AÜG-Zählung über Kunden hinweg (Kapitel 5.1) bleiben aber auch dann zu lösen —
dann als Frage der Zusammenführung über Instanzgrenzen. Keine Regel dieses
Abschnitts darf mit „das trennt schon der Betrieb" begründet werden.

### 2.4 Vertretungs- und Eskalationsregeln

#### Vertretung

Eine **Vertretung** überträgt die Rechte einer Rollenzuweisung befristet auf
eine andere Person. Sie löst Abwesenheit, nicht fehlende Zuständigkeit.

1. **Befristet und personenbezogen.** Jede Vertretung nennt die vertretene
   Rollenzuweisung, die vertretende Person und einen Vertretungszeitraum mit
   Beginn und Ende. Unbefristete Vertretungen gibt es nicht.
2. **Keine Rechteerweiterung.** Der Vertreter erhält genau die Rechte der
   vertretenen Rollenzuweisung, begrenzt auf deren Mandanten und
   Zuständigkeit — nie mehr, auch nicht in Verbindung mit den eigenen Rollen.
3. **Nur innerhalb einer Organisation.** Kein Vertreter über Kunden-,
   Lieferanten- oder Organisationsgrenzen hinweg. Insbesondere vertritt der
   Betreiber keine Kundenentscheidung: eine liegengebliebene Freigabe wird
   eskaliert, nicht übernommen.
4. **Keine Vertretungsketten.** Ein Vertreter kann keinen Untervertreter
   bestimmen.
5. **Vier-Augen-Prinzip bleibt.** Wer einen Vorgang erstellt hat, darf ihn auch
   als Vertreter nicht freigeben. Das betrifft insbesondere Abrechnungsbelege
   (Fußnote [30] in Kapitel 2.2) und die Entsperrung eines Lieferanten
   (Fußnote [5]).
6. **Sichtbarer Vertretungsvermerk.** Jede Handlung in Vertretung trägt die
   handelnde Person **und** die vertretene Rollenzuweisung und wird als
   Audit-Eintrag protokolliert (Kapitel 3.12). Die fachliche Verantwortung
   bleibt bei der vertretenen Funktion.
7. **Einrichtung.** Geplante Abwesenheit richtet der Rolleninhaber selbst ein;
   unvorhergesehene Abwesenheit der Administrator der eigenen Organisation
   (LA für Lieferanten, kundenseitig derzeit der Betreiber — **offene
   Frage 12**). Beide Wege werden protokolliert.
8. **Nicht vertretbar.** Die Übersteuerung einer AÜG-Sperre (Kapitel 5.5,
   **offene Frage 10**) und die Rolle des Leiharbeitnehmers (personenbezogene
   Erfassung, unabhängig von **offener Frage 4**).
9. **Ende.** Mit Ablauf des Vertretungszeitraums enden die Rechte sofort.
   Begonnene, nicht abgeschlossene Vorgänge fallen an die vertretene Funktion
   zurück; der Vertreter verliert den Zugriff darauf.

#### Eskalation

Eine **Eskalation** adressiert einen Vorgang, der liegen bleibt oder blockiert
ist, an eine weitere Stelle. Sie ändert ihn nicht.

1. **Keine Genehmigungsfiktion.** Fristablauf genehmigt, verlängert oder
   besetzt nichts. Ein nicht genehmigter Stundenzettel bleibt nicht genehmigt
   und kann die Abrechnung blockieren; eine AÜG-Sperre hebt sich nicht durch
   Zeitablauf auf. Eskalation erzeugt Aufmerksamkeit, nie einen Statuswechsel.
2. **Stufenfolge.** Zuerst Erinnerung an die zuständige Rolle, dann an deren
   Vertretung, dann an die nächste Rolle derselben Organisation, erst zuletzt
   an den Betreiber. Die Organisationsgrenze wird nur in der letzten Stufe
   überschritten — und auch dann erhält der Betreiber die Information, nicht
   die Entscheidungsbefugnis.
3. **Sichtbarkeit gilt auch für Eskalationen.** Eine Eskalationsnachricht
   enthält nur Daten, die der Empfänger nach Kapitel 2.3 sehen darf. Die
   Eskalation eines Lieferantenvorgangs an den Betreiber offenbart dem
   Lieferanten nichts über andere Lieferanten.
4. **Protokollpflicht.** Jede Stufe wird als Audit-Eintrag erfasst
   (Kapitel 3.12), mit Anlass, Adressat und Zeitpunkt.
5. **Fristwerte.** Die Zahlenwerte der Eskalationsfristen sind je Kunde
   konfigurierbar (Pflege durch den Betreiber). Die Vorbelegungen werden in
   Kapitel 4 für die Prozessfristen und in Kapitel 5 für die AÜG-Fristen
   festgelegt, nicht hier.

**Eskalationsanlässe**

| Anlass | Zuständig | Eskalation an | Verweis |
|---|---|---|---|
| Bedarfsanfrage liegt zur Freigabe und wird nicht entschieden | KG | Vertretung → KB → MD | 4.1 |
| Ausschreibung ohne Angebot bis zum Ende der Angebotsfrist | LD | Vertretung → LA → MD | 4.2 |
| Vorgelegtes Profil ohne Rückmeldung des Kunden | KB | Vertretung → KG → MD | 4.2 |
| Stundenzettel nicht eingereicht | AN *(offene Frage 4)* bzw. LD | LD → LA → MD | 4.4 |
| Stundenzettel nicht genehmigt vor Periodenschluss | KG *(offene Frage 5)* | Vertretung → KE → MD | 4.4, 3.9 |
| AÜG-Erlaubnis läuft ab oder Nachweis fehlt | LA | LD → MD → MA | 5.4 |
| Warnschwelle Höchstüberlassungsdauer erreicht | MD | MA, zusätzlich Information an KB | 5.1 |
| Equal-Pay-Frist erreicht, Vergleichsentgelt fehlt | MD | MA, zusätzlich Information an KE | 5.2 |
| Abrechnungsbeleg beanstandet und nicht geklärt | MD | MA | 4.5 |
| AÜG-Sperre blockiert einen Vorgang | MD | MA | 5.5, offene Frage 10 |

## 3. Objekte / Datenmodell

Dieses Kapitel beschreibt **fachliche Objekte, keine Tabellen**. Es nennt keine
Datentypen einer konkreten Datenbank, keine Schlüsselstrategie, keine Indizes
und keine Migrationen; das Schema entsteht erst mit der Umsetzung (Prisma auf
PostgreSQL, siehe CLAUDE.md). Die Angaben unter „Typ / Wertebereich" sind
fachliche Wertebereiche.

Die englischen Bezeichner sind im Glossar 1.5 gemappt. Die Objektgranularität
entspricht den Zeilen der Berechtigungsmatrix in Kapitel 2.2; wo dieses Kapitel
feiner ist, ist die Matrix mitgezogen worden (siehe Lesart in 2.2).

### 3.0 Konventionen für alle Objekte

Die folgenden Angaben gelten für **jedes** Objekt und werden in den einzelnen
Attributtabellen nicht wiederholt.

| Deutsch | Bezeichner | Typ / Wertebereich | Pflicht | Bemerkung |
|---|---|---|---|---|
| Technische Identität | `id` | undurchsichtiger Schlüssel | Pflicht | Form folgt der Umsetzung; nie fachlich interpretiert |
| Fachliche Kennung | `…Number` | Text, eindeutig je Mandant | Pflicht, wo in der Tabelle genannt | lesbare Nummer für Kommunikation und Belege |
| Mandant | `tenantId` | Verweis auf `tenant` (3.11) | Pflicht bei mandantengebundenen Objekten | trägt die Mandantengrenze aus Kapitel 2.3 |
| Angelegt am / von | `createdAt` / `createdBy` | Zeitpunkt / Verweis auf `user` | Pflicht | erzeugt zusätzlich einen Audit-Eintrag (3.12) |
| Geändert am / von | `updatedAt` / `updatedBy` | Zeitpunkt / Verweis auf `user` | Pflicht ab der ersten Änderung | |
| Deaktiviert am / von | `deactivatedAt` / `deactivatedBy` | Zeitpunkt / Verweis auf `user` | optional | fachliches „Löschen" (`X` in 2.2); physische Löschung nur über 6.6 |
| Status | `status` | Wertebereich des jeweiligen Statusmodells | Pflicht, wo ein Statusmodell existiert | Übergänge ausschließlich nach Kapitel 4 |

**Weitere Festlegungen**

1. **Geldbeträge** werden als Dezimalwert mit Währung geführt (`currency`,
   ISO 4217; im Prototyp `EUR`). Rundungs- und Nachkommaregeln gehören zu
   Kapitel 3.9 und sind dort je Belegart zu entscheiden.
2. **Gültigkeitszeiträume** werden als `validFrom` / `validTo` geführt, halb
   offen: `validTo` leer heißt unbefristet. Stammdaten werden nicht
   überschrieben, wenn sich der Wert mit Wirkung für die Zukunft ändert —
   dann entsteht ein neuer Zeitraum. Die Stichtagslogik dazu steht in 5.5.
3. **Abgeleitete Felder** (Fristenstände, Summen) sind Ergebnisse des
   Regelwerks aus Kapitel 5 bzw. der Zeitobjekte aus 3.8, keine Eingaben. Sie
   werden am Objekt geführt, damit Warnungen und Sperren nachvollziehbar
   bleiben, und sind in den Tabellen als *abgeleitet* gekennzeichnet.
4. **Anmeldedaten** (Passwörter, Hashes, Token, Zwei-Faktor-Geheimnisse) sind
   **nicht** Teil dieses Datenmodells und gehören auch nicht in Beispiel- oder
   Testdaten (CLAUDE.md, Regel 2). Das Authentifizierungsverfahren wird mit der
   Umsetzung festgelegt und ist nicht Teil dieses Kapitels.
5. **Zahlungsdaten** (Bankverbindungen, Mandate) sind im Prototyp nicht
   vorgesehen; Zahlungsabwicklung und Mahnwesen sind nach 1.4 nicht im Umfang.
6. **Keine Echtdaten.** Alle Beispiel- und Entwicklungsdaten sind synthetisch
   (CLAUDE.md, Regel 3).

> **Abhängigkeit von offenen Fragen.** Dieses Kapitel ist so formuliert, dass
> es beide Antworten auf die Fragen **4** (Zugang für Leiharbeitnehmer),
> **5** (Genehmigungsstufen), **6** (Gutschrift oder Rechnung), **7**
> (Schnittstellen), **8** (eine Instanz oder getrennte Instanzen), **11**
> (Lieferantenidentität gegenüber dem Kunden), **12** (kundenseitige
> Benutzerverwaltung), **13** (Doppelrolle Kunde/Lieferant) und **14**
> (Zuständigkeit auf Standort- und Kostenstellenebene) verträgt. Die
> betroffenen Stellen sind im Text mit *(offene Frage n)* gekennzeichnet. Eine
> Festlegung wird dort **nicht** vorweggenommen: die Felder sind so
> geschnitten, dass die jeweils nicht gewählte Antwort das Feld entfallen
> lässt, ohne dass ein anderes Objekt nachzuziehen ist.
>
> Allgemein gilt zu **Frage 7**: Die Objekte dieses Kapitels tragen jeweils ein
> optionales Feld `externalReference` (Text) für die Kennung desselben
> Sachverhalts in einem Fremdsystem. Es ist ohne Schnittstelle leer und ohne
> fachliche Wirkung; eine Schnittstellenbeschreibung ist es nicht. Zu
> **Frage 8** gilt: Die Objektbeschreibungen sind von der Betriebsform
> unabhängig. Bei getrennten Instanzen bleiben die mandantenübergreifenden
> Objekte (`workerIdentity` in 3.6, die Zählungen aus 5.1) als Anforderung
> bestehen — dann als Frage der Zusammenführung über Instanzgrenzen.

### 3.1 Kunde (Entleiher), Standort, Kostenstelle

#### Kunde (`customer`)

**Zweck.** Die Entleiher-Organisation, die den Betreiber beauftragt hat.
**Abgrenzung:** Der Kunde ist die Vertragspartei und der Datenraum; der
konkrete Einsatzort ist der Standort, die kaufmännische Zuordnung die
Kostenstelle. Rechtliche Fristen des AÜG, insbesondere die
Höchstüberlassungsdauer (5.1), zählen **je Kunde**, nicht je Standort und nicht
je Kostenstelle.

| Deutsch | Bezeichner | Typ / Wertebereich | Pflicht | Bemerkung |
|---|---|---|---|---|
| Kundennummer | `customerNumber` | Text, betreiberweit eindeutig | Pflicht | fachliche Identität |
| Firmenname | `legalName` | Text | Pflicht | |
| Rechtsform | `legalForm` | Katalogwert | optional | |
| Anschrift | `address` | strukturierte Anschrift | Pflicht | Sitz der Gesellschaft |
| Handelsregisternummer | `commercialRegisterNumber` | Text | optional | |
| Branche | `industrySector` | Katalogwert | optional | wirkt auf Branchenzuschläge (5.2) über das Zuschlagsschema der Tarifzuordnung (3.3) |
| Tarifbindung des Entleihers | `customerCollectiveAgreement` | Verweis auf `collectiveAgreementAssignment` (3.3) | optional | Grundlage für Equal Pay (5.2) |
| Konzernzugehörigkeit | `corporateGroup` | Text oder Verweis | optional | relevant für die Drehtürklausel (5.3) |
| Ansprechpartner | `contacts` | Liste (Name, Funktion, E-Mail, Telefon) | mindestens einer | personenbezogen |
| Prozessfristen | `processDeadlineConfig` | Satz von Fristwerten in Tagen | optional | Eskalationsfristen je Kunde (2.4, Regel 5); die Werte legt Kapitel 4 bzw. 5 fest, nicht dieses Kapitel |
| Gültigkeitszeitraum | `validFrom` / `validTo` | Zeitraum | `validFrom` Pflicht | Ende der Beauftragung |
| Fremdsystemkennung | `externalReference` | Text | optional | *(offene Frage 7)* |

**Mandant und Eigentümer.** Der Kunde **ist** ein Mandant: zu jedem `customer`
gehört genau ein `tenant` mit `tenantType = customer` (3.11). Pflegehoheit liegt
beim Betreiber (`MA`); der MSP-Disponent darf nur Felder ohne kaufmännische
Wirkung ändern (Fußnote [1] in 2.2), Einkauf/Controlling des Kunden nur lesen.

**Beziehungen.** 1 Kunde : n Standorte · 1 Kunde : n Kostenstellen · 1 Kunde :
n Rahmenverträge (3.3) · 1 Kunde : n Bedarfsanfragen (3.4) · 1 Kunde :
n Einsätze (3.7). Ein Standort gehört zu genau einem Kunden.

**Statusmodell.** Kapitel 4 führt für den Kunden **kein** eigenes Statusmodell.
Der Lebenszyklus beschränkt sich auf aktiv/inaktiv über `deactivatedAt` bzw.
`validTo`; die Matrix sieht `S` für `MA` vor, damit ein Onboarding-Modell
analog 4.6 nachgetragen werden kann, ohne die Matrix zu ändern.

**Datenkategorie (→ 6.3).** Kontaktdaten der Ansprechpartner =
Beschäftigtendaten des Kunden. Keine besonderen Kategorien nach Art. 9 DSGVO.

> *(offene Frage 13)* Ob eine Organisation gleichzeitig Kunde und Lieferant
> sein darf, ist offen. Dieses Kapitel trägt beide Antworten: `customer` und
> `supplier` sind getrennte Objekte mit getrennten Mandanten. Wird die
> Doppelrolle zugelassen, kommt ein Merkmal `organizationRef` hinzu, das beide
> Sätze verknüpft und **nur** für den Betreiber sichtbar ist — die
> Sichtbarkeitsregeln aus 2.3 bleiben unverändert. Wird sie nicht zugelassen,
> entfällt das Merkmal ersatzlos.

#### Standort (`site`)

**Zweck.** Der konkrete Einsatzort beim Kunden. Er trägt die Angaben, die die
Kennzeichnungs- und Konkretisierungspflicht des Überlassungsvertrags verlangt
(§ 1 Abs. 1 AÜG, siehe 5.3), und die Grundlage für die Unterweisungspflicht.

| Deutsch | Bezeichner | Typ / Wertebereich | Pflicht | Bemerkung |
|---|---|---|---|---|
| Standortnummer | `siteNumber` | Text, eindeutig je Kunde | Pflicht | |
| Bezeichnung | `name` | Text | Pflicht | |
| Kunde | `customerRef` | Verweis auf `customer` | Pflicht | |
| Anschrift | `address` | strukturierte Anschrift | Pflicht | Einsatzort im Sinne von 5.3 |
| Betriebsvereinbarung | `worksCouncilAgreement` | Verweis auf `document` (3.10) | optional | kann die Höchstüberlassungsdauer abweichend regeln (5.1) |
| Tarifzuordnung | `collectiveAgreementRef` | Verweis (3.3) | optional | Branchenzuschlag je Einsatzbranche (5.2) |
| Regelarbeitszeit | `standardWeeklyHours` | Dezimalzahl, Stunden | optional | Vorbelegung für Bedarfsanfrage und Einsatz |
| Unterweisung erforderlich | `safetyBriefingRequired` | ja/nein | Pflicht | steuert den Pflichtnachweis (3.10, 5.4) |
| Ansprechpartner vor Ort | `contacts` | Liste | optional | personenbezogen |
| Gültigkeitszeitraum | `validFrom` / `validTo` | Zeitraum | `validFrom` Pflicht | |
| Fremdsystemkennung | `externalReference` | Text | optional | *(offene Frage 7)* |

**Mandant und Eigentümer.** Kundenmandant. Pflege durch Betreiber (`MA`) und
durch Einkauf/Controlling des Kunden (`KE`, Fußnote [2] in 2.2).

**Beziehungen.** 1 Standort : n Kostenstellen (optional zugeordnet) ·
1 Standort : n Bedarfsanfragen · 1 Standort : n Einsätze. Ein Lieferant sieht
Standorte nur im Umfang der eigenen Beauftragung (Fußnote [3]).

**Statusmodell.** Keines in Kapitel 4; aktiv/inaktiv wie beim Kunden.

**Datenkategorie (→ 6.3).** Kontaktdaten der Ansprechpartner vor Ort.

#### Kostenstelle (`costCenter`)

**Zweck.** Die kaufmännische Zuordnung eines Bedarfs, Einsatzes oder einer
Belegposition innerhalb der Kundenorganisation. **Abgrenzung:** sie ist eine
interne Zuordnung des Kunden und für Lieferanten **nie** sichtbar
(Fußnote [14] in 2.2).

| Deutsch | Bezeichner | Typ / Wertebereich | Pflicht | Bemerkung |
|---|---|---|---|---|
| Kostenstellennummer | `costCenterNumber` | Text, eindeutig je Kunde | Pflicht | |
| Bezeichnung | `name` | Text | Pflicht | |
| Kunde | `customerRef` | Verweis auf `customer` | Pflicht | |
| Standort | `siteRef` | Verweis auf `site` | optional | |
| Verantwortlich | `responsibleUserRef` | Verweis auf `user` (3.11) | optional | *(offene Frage 14)* — wer die Zuständigkeit pflegt, ist offen |
| Budgetrahmen | `budgetAmount` | Betrag + Währung | optional | Kennzahlenbedarf ist **offene Frage 9** |
| Gültigkeitszeitraum | `validFrom` / `validTo` | Zeitraum | `validFrom` Pflicht | |
| Fremdsystemkennung | `externalReference` | Text | optional | *(offene Frage 7)* |

**Mandant und Eigentümer.** Kundenmandant; Pflege durch `KE` und `MA`.

**Beziehungen.** 1 Kostenstelle : n Bedarfsanfragen · 1 Kostenstelle :
n Einsätze · 1 Kostenstelle : n Belegpositionen (3.9) · 1 Kostenstelle :
n Zeitpositionen bei abweichender Zuordnung (3.8).

**Statusmodell.** Keines in Kapitel 4.

**Datenkategorie (→ 6.3).** Nur über `responsibleUserRef` personenbezogen.

> *(offene Frage 14)* Ob Kundenrollen auf einzelne Standorte und Kostenstellen
> eingeschränkt werden dürfen, ist offen. Die Einschränkung ist in 3.11 als
> eigenes Objekt `responsibilityScope` vorgesehen; wird die Frage mit „keine
> Einschränkung" beantwortet, entfällt dieses Objekt ersatzlos, und die
> Felder in 3.1 bleiben unberührt.

### 3.2 Lieferant (Verleiher) inkl. AÜG-Erlaubnis und Vertragsrahmen

#### Lieferant (`supplier`)

**Zweck.** Ein Sub-Verleiher, der dem Betreiber Personal zur Überlassung
stellt. **Abgrenzung:** Der Lieferant ist Vertragspartei und Datenraum; seine
Erlaubnis ist ein eigenes Objekt (unten), seine Konditionen stehen in 3.3.

| Deutsch | Bezeichner | Typ / Wertebereich | Pflicht | Bemerkung |
|---|---|---|---|---|
| Lieferantennummer | `supplierNumber` | Text, betreiberweit eindeutig | Pflicht | |
| Firmenname | `legalName` | Text | Pflicht | |
| Rechtsform | `legalForm` | Katalogwert | optional | |
| Anschrift | `address` | strukturierte Anschrift | Pflicht | |
| Handelsregisternummer | `commercialRegisterNumber` | Text | optional | |
| Tarifbindung des Verleihers | `supplierCollectiveAgreement` | Verweis (3.3) | Pflicht ab Status `active` | Grundlage für die Abweichung vom Gleichstellungsgrundsatz (5.2); welches Tarifwerk gilt, ist Konfiguration am Zuordnungsobjekt (3.3) |
| Ansprechpartner | `contacts` | Liste | mindestens einer | personenbezogen |
| Lieferantenstatus | `status` | siehe 4.6 | Pflicht | `onboarding`, `active`, `blocked`, `inactive` |
| Sperrgrund | `blockReason` | Text | Pflicht bei `blocked` | |
| Gesperrt am / von | `blockedAt` / `blockedBy` | Zeitpunkt / Verweis | Pflicht bei `blocked` | Entsperrung nur durch `MA` (Fußnote [5] in 2.2) |
| Gültigkeitszeitraum | `validFrom` / `validTo` | Zeitraum | `validFrom` Pflicht | |
| Fremdsystemkennung | `externalReference` | Text | optional | *(offene Frage 7)* |

**Mandant und Eigentümer.** Der Lieferant **ist** ein Mandant
(`tenantType = supplier`). Stammdatenhoheit: Betreiber (`MA`) für Nummer,
Status und Freischaltung; der Lieferantenadministrator (`LA`) pflegt die
eigenen Angaben und Ansprechpartner (Fußnote [7]).

**Beziehungen.** 1 Lieferant : n AÜG-Erlaubnisse (historisiert) ·
1 Lieferant : n Rahmenverträge (3.3) · 1 Lieferant : n Einladungen (3.5) ·
1 Lieferant : n Angebote (3.5) · 1 Lieferant : n Kandidaten (3.6) ·
1 Lieferant : n Einsätze (3.7).

**Statusmodell.** → **4.6** (Onboarding → aktiv → gesperrt → inaktiv).

**Datenkategorie (→ 6.3).** Kontaktdaten der Ansprechpartner.

**Nicht geführt.** Bankverbindungen und Zahlungsdaten (siehe 3.0, Festlegung 5).

#### AÜG-Erlaubnis (`supplierPermit`)

**Zweck.** Der Nachweis, dass ein Lieferant Arbeitnehmerüberlassung betreiben
darf (§ 1 AÜG). **Abgrenzung:** Das Objekt trägt die *Daten* der Erlaubnis
(Nummer, Behörde, Gültigkeit); die *Urkunde* ist ein Dokument nach 3.10. Die
Überwachung von Fristen und die Sperrwirkung regelt 5.4.

| Deutsch | Bezeichner | Typ / Wertebereich | Pflicht | Bemerkung |
|---|---|---|---|---|
| Lieferant | `supplierRef` | Verweis auf `supplier` | Pflicht | |
| Erlaubnisnummer | `permitNumber` | Text | Pflicht | Aktenzeichen der Behörde |
| Erlaubnisbehörde | `issuingAuthority` | Text | Pflicht | zuständige Agentur für Arbeit |
| Erlaubnisart | `permitType` | `fixedTerm`, `unlimited` | Pflicht | unbefristete Erlaubnis nach dreijähriger Erteilung |
| Erteilt am | `issuedOn` | Datum | Pflicht | |
| Gültig von / bis | `validFrom` / `validTo` | Datum | `validTo` Pflicht bei `fixedTerm`, leer bei `unlimited` | |
| Beschränkungen | `restrictions` | Text | optional | z. B. Beschränkung auf Branchen |
| Urkunde | `documentRef` | Verweis auf `document` (3.10) | Pflicht | Nachweisart `permitCertificate` |
| Anerkennungsstatus | `verificationStatus` | `submitted`, `accepted`, `rejected` | Pflicht | Anerkennung durch `MD` (Fußnote [34]) |
| Anerkannt am / von | `verifiedAt` / `verifiedBy` | Zeitpunkt / Verweis | Pflicht bei `accepted` | |
| Zurückweisungsgrund | `rejectionReason` | Text | Pflicht bei `rejected` | |
| Vorgänger | `supersedesRef` | Verweis auf `supplierPermit` | optional | Verlängerung erzeugt einen **neuen** Satz; der alte bleibt erhalten |

**Mandant und Eigentümer.** Lieferantenmandant; eingestellt und aktuell
gehalten vom `LA`, anerkannt oder zurückgewiesen vom `MD`. Einkauf/Controlling
des Kunden sieht ausschließlich Gültigkeitsstatus und Ablaufdatum der
beauftragten Lieferanten, **nicht** die Urkunde (Fußnote [36]).

**Beziehungen.** n Erlaubnissätze : 1 Lieferant · 1 Erlaubnis : 1 Urkunde
(3.10).

**Statusmodell.** Die Anerkennung folgt dem Nachweisfluss aus **5.4.3**; die
Sperrwirkung auf den Lieferanten läuft über **4.6**. Ein eigenes Statusmodell
in Kapitel 4 gibt es nicht und ist dort auch nicht nötig — die Werte von
`verificationStatus` sind in 5.4.3 beschrieben, die Prüfung der Gültigkeit ist
P9 (5.4.1).

**Datenkategorie (→ 6.3).** Keine personenbezogenen Daten außer den
Bearbeitungsvermerken (`verifiedBy`).

#### Vertragsrahmen

Der Vertragsrahmen eines Lieferanten besteht aus Rahmenvertrag, Preisliste und
Tarifzuordnung und ist in **3.3** beschrieben, weil er für Kunden und
Lieferanten dieselbe Struktur hat.

### 3.3 Rahmenvertrag, Preisliste / Konditionen, Tarifzuordnung, Vergleichsentgelt

#### Rahmenvertrag (`masterAgreement`)

**Zweck.** Die vertragliche Grundlage zwischen dem Betreiber und **einem**
anderen Mandanten. **Abgrenzung:** Der Prototyp kennt nur zwei Vertragsstrecken
— Betreiber ↔ Kunde und Betreiber ↔ Lieferant. Ein Direktvertrag zwischen Kunde
und Lieferant ist **nicht** vorgesehen; er wäre eine eigene fachliche
Entscheidung und keine Erweiterung dieses Kapitels.

| Deutsch | Bezeichner | Typ / Wertebereich | Pflicht | Bemerkung |
|---|---|---|---|---|
| Vertragsnummer | `agreementNumber` | Text, betreiberweit eindeutig | Pflicht | |
| Vertragsart | `agreementType` | `customerAgreement`, `supplierAgreement` | Pflicht | bestimmt die Gegenpartei und die Sichtbarkeit ([40] in 2.2) |
| Gegenpartei | `counterpartyRef` | Verweis auf `customer` oder `supplier` | Pflicht | genau eine |
| Laufzeit | `validFrom` / `validTo` | Zeitraum | `validFrom` Pflicht | `validTo` leer = unbefristet |
| Kündigungsfrist | `noticePeriodDays` | Ganzzahl, Tage | optional | |
| Zahlungsziel | `paymentTermsDays` | Ganzzahl, Tage | optional | kaufmännische Angabe, keine Zahlungsabwicklung (1.4) |
| Vertragsunterlage | `documentRefs` | Liste von Verweisen (3.10) | optional | Nachweisart `agreementDocument` |
| Vertragsstatus | `status` | `draft`, `active`, `expired`, `terminated` | Pflicht | siehe Hinweis unten |
| Fremdsystemkennung | `externalReference` | Text | optional | *(offene Frage 7)* |

**Mandant und Eigentümer.** Der Rahmenvertrag gehört dem **Betreiber**
(`tenantType = operator`) und ist der Gegenpartei zugeordnet. Pflege nur durch
`MA`; `KE` liest den eigenen Kundenvertrag, `LD`/`LA` den eigenen
Lieferantenvertrag ([40]).

**Beziehungen.** 1 Rahmenvertrag : n Preislisten · 1 Rahmenvertrag :
n Dokumente · n Rahmenverträge : 1 Gegenpartei (zeitlich aufeinanderfolgend
oder nach Leistungsart getrennt).

**Statusmodell.** Kapitel 4 führt heute **kein** Modell für den Rahmenvertrag.
Die vier oben genannten Werte sind der fachlich benötigte Mindestumfang; ein
vollständiges Modell mit Übergängen und auslösenden Rollen gehört nach
Kapitel 4 und ist dort nachzutragen.

**Datenkategorie (→ 6.3).** Keine personenbezogenen Daten.

#### Preisliste (`rateCard`) und Preisposition (`rateCardItem`)

**Zweck.** Die Konditionen zu einem Rahmenvertrag: Verrechnungssätze je
Qualifikation und Zuschlagssätze je Zuschlagsart. **Abgrenzung:** Die Preisliste
sagt, *was ein Satz kostet*; was tatsächlich abgerechnet wird, entsteht aus den
Zeiten (3.8) und steht im Beleg (3.9).

**Die Seitentrennung ist wesentlich:** eine Preisliste ist entweder
**Einkaufspreisliste** (Betreiber ↔ Lieferant) oder **Kundenpreisliste**
(Betreiber ↔ Kunde). Kundenrollen sehen nie die Einkaufsseite, Lieferantenrollen
nie die Kundenseite (Fußnoten [41] und [42] in 2.2). Die Differenz ist die
Marge des Betreibers und für beide Gegenseiten unsichtbar.

**Preisliste**

| Deutsch | Bezeichner | Typ / Wertebereich | Pflicht | Bemerkung |
|---|---|---|---|---|
| Preislistennummer | `rateCardNumber` | Text | Pflicht | |
| Rahmenvertrag | `masterAgreementRef` | Verweis | Pflicht | bestimmt die Gegenpartei |
| Seite | `rateCardScope` | `supplierRateCard`, `customerRateCard` | Pflicht | muss zur Vertragsart passen |
| Laufzeit | `validFrom` / `validTo` | Zeitraum | `validFrom` Pflicht | Preisrunden erzeugen neue Listen, keine Änderung der alten |
| Währung | `currency` | ISO 4217 | Pflicht | Prototyp `EUR` |
| Status | `status` | `draft`, `active`, `expired` | Pflicht | kein Modell in Kapitel 4; nachzutragen wie beim Rahmenvertrag |

**Preisposition**

| Deutsch | Bezeichner | Typ / Wertebereich | Pflicht | Bemerkung |
|---|---|---|---|---|
| Preisliste | `rateCardRef` | Verweis | Pflicht | |
| Positionsart | `itemType` | `baseRate`, `premiumRate` | Pflicht | trennt Grundsatz von Zuschlagssatz |
| Qualifikationsstufe | `qualificationLevel` | Katalogwert | Pflicht bei `baseRate` | |
| Tätigkeit | `activityDescription` | Text | optional | engere Fassung als die Qualifikationsstufe |
| Standort | `siteRef` | Verweis (3.1) | optional | standortabhängige Sätze |
| Zuschlagsart | `premiumTypeRef` | Verweis (3.8) | Pflicht bei `premiumRate` | |
| Verrechnungssatz | `hourlyRate` | Betrag je Stunde | Pflicht bei `baseRate` | |
| Zuschlagswert | `premiumValue` | Prozentsatz oder Betrag | Pflicht bei `premiumRate` | Berechnungsart kommt aus der Zuschlagsart |
| Mindestabrechnung | `minimumHours` | Dezimalzahl | optional | |
| Laufzeit | `validFrom` / `validTo` | Zeitraum | optional | abweichend von der Preisliste |

**Mandant und Eigentümer.** Betreibermandant, über den Rahmenvertrag der
Gegenpartei zugeordnet. Pflege nur durch `MA`.

**Beziehungen.** 1 Preisliste : n Preispositionen · 1 Preisposition :
n Einsätze (als vereinbarter Satz, 3.7) · 1 Zuschlagsart : n Preispositionen.

**Statusmodell.** Keines in Kapitel 4 (siehe oben).

**Datenkategorie (→ 6.3).** Keine personenbezogenen Daten.

> *(offene Frage 17, neu)* Ob je Einsatz ein von der Preisliste abweichender
> Satz vereinbart werden darf und wer die Abweichung genehmigt, ist offen.
> Dieses Kapitel trägt beide Antworten: der Einsatz (3.7) verweist mit
> `agreedRateCardItemRef` auf eine Preisposition und führt zusätzlich die
> optionalen Felder `agreedHourlyRate` und `rateDeviationReason`. Ist keine
> Abweichung zulässig, entfallen die beiden optionalen Felder.

#### Tarifzuordnung (`collectiveAgreementAssignment`)

**Zweck.** Ordnet einem Lieferanten (Verleihertarif), einem Kunden oder einem
Standort (Entleihertarif, Branchenzuschlag) den anzuwendenden Tarifvertrag zu.
**Abgrenzung:** Das Objekt hält die *Zuordnung und ihre Parameter*; die
Rechenregeln stehen in 5.1 und 5.2, nicht hier.

| Deutsch | Bezeichner | Typ / Wertebereich | Pflicht | Bemerkung |
|---|---|---|---|---|
| Tarifvertrag | `collectiveAgreement` | Katalogwert | Pflicht | Der Katalog ist **Konfiguration**, kein festverdrahteter Wertebereich (Entscheidung zu offener Frage 3); die Fristen und Stufen des jeweiligen Tarifwerks stehen in den folgenden Feldern |
| Gilt für | `appliesToType` | `supplier`, `customer`, `site` | Pflicht | |
| Zielobjekt | `appliesToRef` | Verweis | Pflicht | |
| Laufzeit | `validFrom` / `validTo` | Zeitraum | `validFrom` Pflicht | Tarifrunden erzeugen neue Zuordnungen |
| Abweichende Höchstüberlassungsdauer | `maxAssignmentDurationMonths` | Ganzzahl, Monate | optional | tarifliche oder betriebliche Abweichung von 18 Monaten (5.1); leer = Regelgrenze |
| Abweichende Equal-Pay-Frist | `equalPayDeadlineMonths` | Ganzzahl, Monate | optional | Abweichung von 9 Monaten (5.2); leer = Regelfrist |
| Branchenzuschlagsschema | `industryPremiumScheme` | Katalogwert | optional | Stufenfolge der Branchenzuschläge (5.2) |
| Rechtsgrundlage | `documentRef` | Verweis (3.10) | optional | Betriebsvereinbarung, Tarifauszug |

**Mandant und Eigentümer.** Betreibermandant (Regelwerkdaten); Pflege nur
durch `MA`. `LD`/`LA` lesen die eigene Zuordnung, `KE` die des eigenen Kunden.

**Beziehungen.** n Tarifzuordnungen : 1 Lieferant, Kunde oder Standort
(zeitlich aufeinanderfolgend) · 1 Tarifzuordnung : n Einsätze, über das
jeweilige Zielobjekt.

**Statusmodell.** Keines; die Gültigkeit ergibt sich aus dem Zeitraum.

**Datenkategorie (→ 6.3).** Keine personenbezogenen Daten.

#### Vergleichsentgelt (`comparableWageEntry`)

**Zweck.** Das Entgelt, das ein vergleichbarer Stammarbeitnehmer des Entleihers
für eine Tätigkeit an einem Standort erhält — die Datengrundlage für Equal Pay
(5.2). **Entscheidung zu offener Frage 15:** geführt wird es **je Tätigkeit am
Standort**, nicht je Einsatz und nicht je Kostenstelle. Gepflegt wird es vom
Entleiher, weil nur er es kennt.

| Deutsch | Bezeichner | Typ / Wertebereich | Pflicht | Bemerkung |
|---|---|---|---|---|
| Standort | `siteRef` | Verweis (3.1) | Pflicht | |
| Tätigkeit / Entgeltgruppe | `activityKey` | Katalogwert oder Text | Pflicht | dieselbe Fassung wie `activityDescription` in 3.4 und 3.7 |
| Vergleichsentgelt | `comparableWage` | Betrag je Stunde | Pflicht | Bruttostundenentgelt des vergleichbaren Stammarbeitnehmers |
| Laufzeit | `validFrom` / `validTo` | Zeitraum | `validFrom` Pflicht | Entgeltrunden erzeugen neue Einträge (Historisierung nach 3.0) |
| Herkunft der Angabe | `wageSource` | `collectiveAgreement`, `companyAgreement`, `individualContract`, `estimate` | Pflicht | `estimate` ist für 5.2 nur eine Warnung, kein Nachweis |
| Gemeldet am / von | `reportedAt` / `reportedBy` | Zeitpunkt / Verweis | Pflicht | Nachvollziehbarkeit der Entleiherangabe |

**Mandant und Eigentümer.** **Kundenmandant** — der Entleiher pflegt die
Einträge (`KE`, [2]); der Betreiber liest sie für die Prüfungen aus 5.2. Für
**Lieferantenrollen ist der Katalog nicht sichtbar**: der Verleiher braucht den
Wert für den konkreten Einsatz und erhält ihn dort über `comparableWage` in 3.7
([7]) — nicht das Entgeltgefüge des Entleihers insgesamt.

**Beziehungen.** n Vergleichsentgelte : 1 Standort (je Tätigkeit und Zeitraum
genau einer gültig) · 1 Vergleichsentgelt : n Einsätze, über Standort und
Tätigkeit.

**Statusmodell.** Keines; die Gültigkeit ergibt sich aus dem Zeitraum.

**Datenkategorie (→ 6.3).** Keine personenbezogenen Daten der
Leiharbeitnehmer, aber **Entgeltdaten der Stammbelegschaft des Entleihers** in
aggregierter Form. Zugriff deshalb eng: Kundenmandant und Betreiber, kein
Lieferant, kein Export in Berichte, die Lieferanten erreichen.

### 3.4 Bedarfsanfrage (Anforderung)

#### Bedarfsanfrage (`demandRequest`)

**Zweck.** Der vom Kunden gemeldete Personalbedarf: Tätigkeit, Anforderungen,
Ort, Zeitraum, Menge. **Abgrenzung:** Die Bedarfsanfrage beschreibt den Bedarf.
Ihre Verteilung an Lieferanten ist die Ausschreibung (3.5), die Besetzung der
Profilvorschlag (3.6), die Durchführung der Einsatz (3.7). Eine Anfrage über
mehrere Köpfe (`headcount > 1`) kann zu mehreren Einsätzen führen.

| Deutsch | Bezeichner | Typ / Wertebereich | Pflicht | Bemerkung |
|---|---|---|---|---|
| Anfragenummer | `requestNumber` | Text, eindeutig je Kunde | Pflicht | |
| Kunde | `customerRef` | Verweis (3.1) | Pflicht | |
| Standort | `siteRef` | Verweis (3.1) | Pflicht | Einsatzort; Kennzeichnungspflicht (5.3) |
| Kostenstelle | `costCenterRef` | Verweis (3.1) | Pflicht | für Lieferanten **nicht** sichtbar (Fußnote [14]) |
| Bedarfsträger | `requestedBy` | Verweis auf `user` (3.11) | Pflicht | personenbezogen |
| Im Auftrag angelegt von | `createdOnBehalfOf` | Verweis auf `user` | Pflicht bei Anlage durch `MD` | Kennzeichnung nach Fußnote [10] |
| Titel | `title` | Text | Pflicht | |
| Tätigkeitsbeschreibung | `activityDescription` | Text | Pflicht | Konkretisierung (5.3) |
| Anforderungen | `qualificationRequirements` | Liste (Qualifikation, Pflicht/Wunsch) | mindestens eine | |
| Anzahl | `headcount` | Ganzzahl ≥ 1 | Pflicht | |
| Beginn | `startDate` | Datum | Pflicht | |
| Ende | `endDate` | Datum | optional | leer = unbefristeter Bedarf; die Höchstüberlassungsdauer begrenzt ihn trotzdem (5.1) |
| Wochenstunden | `weeklyHours` | Dezimalzahl | Pflicht | Vorbelegung aus dem Standort |
| Schichtmodell | `shiftPattern` | Katalogwert | optional | |
| Angebotsfrist | `offerDeadline` | Zeitpunkt | Pflicht ab Status „ausgeschrieben" | Eskalationsanlass (2.4, 4.2) |
| Kostenrahmen | `maxHourlyRate` | Betrag je Stunde | optional | sichtbar nur für `KG` ([8]) und `KE` ([2]) |
| Interner Vermerk | `internalNote` | Text | optional | für Lieferanten **nicht** sichtbar ([14]) |
| Freigegeben am / von | `approvedAt` / `approvedBy` | Zeitpunkt / Verweis | Pflicht ab Status „freigegeben" | Vier-Augen-Prinzip (2.4, Regel 5) |
| Stornogrund | `cancellationReason` | Text | Pflicht bei Storno | |
| Rückweisungsgrund | `rejectionReason` | Text | Pflicht bei Rückweisung | Begründung der Rückweisung `submitted` → `draft` durch `KG` (4.1); für den Bedarfsträger sichtbar, damit er weiß, was zu ändern ist |
| Status | `status` | siehe 4.1 | Pflicht | |
| Fremdsystemkennung | `externalReference` | Text | optional | *(offene Frage 7)* |

**Mandant und Eigentümer.** Kundenmandant. Eigentümer ist der Bedarfsträger
(`KB`); er darf nur im Status „Entwurf" ändern ([11]) und zur Freigabe
einreichen ([12]). Der `MD` darf im Auftrag des Kunden anlegen ([10]), der `KG`
freigeben oder ablehnen ([13]).

**Beziehungen.** 1 Bedarfsanfrage : n Ausschreibungen (Runden, 3.5) ·
1 Bedarfsanfrage : n Profilvorschläge, mittelbar über Angebote (3.6) ·
1 Bedarfsanfrage : n Einsätze (3.7, bis zu `headcount`) · n Bedarfsanfragen :
1 Standort · n Bedarfsanfragen : 1 Kostenstelle.

**Statusmodell.** → **4.1** (Entwurf → freigegeben → ausgeschrieben → in
Auswahl → besetzt → storniert / abgelaufen).

**Datenkategorie (→ 6.3).** `requestedBy`, `createdOnBehalfOf`, `approvedBy`
sind Beschäftigtendaten des Kunden bzw. des Betreibers. Keine Kandidatendaten.

> *(offene Frage 14)* Ob ein Bedarfsträger nur für seinen Standort oder seine
> Kostenstelle anfragen darf, entscheidet die Zuständigkeit aus 3.11, nicht
> dieses Objekt. Die Felder bleiben in beiden Fällen gleich.

### 3.5 Ausschreibung / Verteilung an Lieferanten, Lieferantenangebot

#### Ausschreibung (`tender`)

**Zweck.** Die vom Betreiber gesteuerte Verteilung einer freigegebenen
Bedarfsanfrage an ausgewählte Lieferanten. **Abgrenzung:** Die Ausschreibung ist
der Vorgang; die Teilnahme eines einzelnen Lieferanten ist die Einladung. Eine
Wiederholung (zweite Welle, erweiterter Lieferantenkreis) ist eine **neue**
Ausschreibung mit erhöhter Rundennummer, keine Änderung der alten.

| Deutsch | Bezeichner | Typ / Wertebereich | Pflicht | Bemerkung |
|---|---|---|---|---|
| Ausschreibungsnummer | `tenderNumber` | Text | Pflicht | |
| Bedarfsanfrage | `demandRequestRef` | Verweis (3.4) | Pflicht | |
| Runde | `tenderRound` | Ganzzahl ≥ 1 | Pflicht | |
| Verteilungsart | `distributionMode` | `simultaneous`, `staged` | Pflicht | gleichzeitig an alle oder in Wellen |
| Veröffentlicht am / von | `publishedAt` / `publishedBy` | Zeitpunkt / Verweis | Pflicht | `MD` oder `MA` |
| Angebotsfrist | `offerDeadline` | Zeitpunkt | Pflicht | kann die Frist der Anfrage je Runde verkürzen |
| Geschlossen am | `closedAt` | Zeitpunkt | optional | |

**Mandant und Eigentümer.** Betreibermandant — die Ausschreibung ist die
Steuerungshandlung des MSP. Der Kunde sieht nur Stand und Fortschritt zur
eigenen Anfrage ([15]), der Lieferant nur die eigene Einladung ([16]).

**Beziehungen.** n Ausschreibungen : 1 Bedarfsanfrage · 1 Ausschreibung :
n Einladungen (mindestens eine).

**Statusmodell.** Kapitel 4 führt **kein** eigenes Modell. Der Fortschritt
ergibt sich aus 4.1 (Status der Bedarfsanfrage) und aus den Einladungen; eine
Ausschreibung ist offen bis `closedAt`.

**Datenkategorie (→ 6.3).** Nur Bearbeitungsvermerke.

#### Einladung (`tenderInvitation`)

**Zweck.** Die Teilnahme genau **eines** Lieferanten an einer Ausschreibung.
Sie ist das Objekt, an dem die Mandantengrenze zum Lieferanten hängt: der
Lieferant sieht seine Einladung und nichts darüber hinaus.

| Deutsch | Bezeichner | Typ / Wertebereich | Pflicht | Bemerkung |
|---|---|---|---|---|
| Ausschreibung | `tenderRef` | Verweis | Pflicht | |
| Lieferant | `supplierRef` | Verweis (3.2) | Pflicht | |
| Eingeladen am | `invitedAt` | Zeitpunkt | Pflicht | |
| Zur Kenntnis genommen am | `viewedAt` | Zeitpunkt | optional | Grundlage für die Eskalation nach 4.2 |
| Beantwortet am | `respondedAt` | Zeitpunkt | optional | |
| Absagegrund | `declineReason` | Text | Pflicht bei Absage | |
| Einladungsstatus | `invitationStatus` | `invited`, `viewed`, `offerSubmitted`, `declined`, `expired` | Pflicht | siehe Hinweis |

**Mandant und Eigentümer.** Die Einladung gehört dem Betreiber, ist aber dem
Lieferanten zugänglich. **Nie sichtbar:** die Teilnehmerliste der Ausschreibung,
die Zahl der Eingeladenen und die Zahl der eingegangenen Angebote (2.3,
„Zwischen Lieferanten").

**Beziehungen.** n Einladungen : 1 Ausschreibung · 1 Einladung : 0..1
Lieferantenangebot · n Einladungen : 1 Lieferant.

**Statusmodell.** Die oben genannten Werte sind ein eigener, kleiner
Lebenszyklus, den Kapitel 4 heute nicht führt. Er gehört in **4.2** neben das
Angebot und ist dort nachzutragen.

**Datenkategorie (→ 6.3).** Nur Bearbeitungsvermerke.

#### Lieferantenangebot (`supplierOffer`) und Angebotsposition (`supplierOfferItem`)

**Zweck.** Die Antwort eines Lieferanten auf eine Einladung: Verfügbarkeit,
Menge, Preis — und, soweit vorhanden, Kandidaten. **Abgrenzung / Festlegung:**
Ein Angebot darf auch ohne Kandidaten abgegeben werden (reine Verfügbarkeits-
und Preismeldung); die Profilvorschläge sind eigene Objekte (3.6) und können
nachreichbar sein.

**Angebot**

| Deutsch | Bezeichner | Typ / Wertebereich | Pflicht | Bemerkung |
|---|---|---|---|---|
| Angebotsnummer | `offerNumber` | Text, eindeutig je Lieferant | Pflicht | |
| Einladung | `tenderInvitationRef` | Verweis | Pflicht | bestimmt Ausschreibung und Anfrage |
| Lieferant | `supplierRef` | Verweis | Pflicht | abgeleitet aus der Einladung, zur Sichtbarkeitsprüfung mitgeführt |
| Verfügbar ab | `availableFrom` | Datum | Pflicht | |
| Angebotene Anzahl | `offeredHeadcount` | Ganzzahl ≥ 1 | Pflicht | darf unter `headcount` der Anfrage liegen |
| Bindefrist | `offerValidUntil` | Zeitpunkt | optional | |
| Bemerkung | `note` | Text | optional | für den Kunden nur im Umfang von [18] |
| Eingereicht am | `submittedAt` | Zeitpunkt | Pflicht ab Status „eingereicht" | |
| Gesichtet am | `reviewedAt` | Zeitpunkt | optional | ab hier keine Änderung mehr durch `LD` ([19]) |
| Zurückgezogen am | `withdrawnAt` | Zeitpunkt | optional | |
| Status | `status` | siehe 4.2 | Pflicht | |

**Angebotsposition**

| Deutsch | Bezeichner | Typ / Wertebereich | Pflicht | Bemerkung |
|---|---|---|---|---|
| Angebot | `supplierOfferRef` | Verweis | Pflicht | |
| Qualifikationsstufe | `qualificationLevel` | Katalogwert | Pflicht | |
| Anzahl | `headcount` | Ganzzahl ≥ 1 | Pflicht | |
| Verrechnungssatz | `hourlyRate` | Betrag je Stunde | Pflicht | Einkaufsseite |
| Preisposition | `rateCardItemRef` | Verweis (3.3) | optional | gesetzt, wenn der Satz aus der Einkaufspreisliste kommt |
| Abweichungsgrund | `rateDeviationReason` | Text | Pflicht bei Abweichung von der Preisliste | *(offene Frage 17)* |
| Zuschläge | `premiumRates` | Liste (Zuschlagsart, Wert) | optional | Zuschlagsarten aus 3.8 |

**Mandant und Eigentümer.** Lieferantenmandant. Der `LD` legt an, ändert bis
zur Sichtung ([19]), reicht ein und zieht zurück ([20]); der `MA` kann sperren
oder stornieren, aber nicht inhaltlich ändern (2.1). Der Kunde sieht fachliche
Inhalte, Preisbestandteile nur im Umfang von [18].

**Beziehungen.** 1 Einladung : 0..1 Angebot · 1 Angebot : n Angebotspositionen
· 1 Angebot : n Profilvorschläge (3.6, auch null).

**Statusmodell.** → **4.2** (eingereicht → gesichtet → Interview → zugesagt →
abgelehnt → zurückgezogen).

**Datenkategorie (→ 6.3).** Keine Kandidatendaten im Angebot selbst; die
Personendaten stehen ausschließlich in 3.6.

> *(offene Frage 11)* Ob dem Kunden angezeigt wird, **welcher** Lieferant ein
> Angebot abgegeben hat, oder ob der Betreiber als einziger sichtbarer
> Vertragspartner auftritt, ist offen. Das Objekt trägt `supplierRef` in jedem
> Fall — die Zuordnung ist für die Abrechnung und die AÜG-Prüfungen zwingend.
> Offen ist allein die **Anzeige**; sie wird in 2.3 und 6.4 entschieden, nicht
> durch ein zusätzliches Feld.

### 3.6 Kandidat / Profilvorschlag

#### Kandidat (`candidate`)

**Zweck.** Eine Person, die ein Lieferant für Überlassungen führt.
**Abgrenzung:** Der Kandidat ist die Person **beim Lieferanten**; das Vorlegen
auf eine konkrete Anfrage ist der Profilvorschlag. Wird der Kandidat besetzt,
ist er im Einsatz (3.7) der Leiharbeitnehmer — dieselbe Person, anderes Objekt.

| Deutsch | Bezeichner | Typ / Wertebereich | Pflicht | Bemerkung |
|---|---|---|---|---|
| Kandidatennummer | `candidateNumber` | Text, eindeutig je Lieferant | Pflicht | |
| Lieferant | `supplierRef` | Verweis (3.2) | Pflicht | |
| Vorname / Name | `givenName` / `familyName` | Text | Pflicht | Klardaten; Sichtbarkeit nach 6.4 |
| Geburtsdatum | `dateOfBirth` | Datum | Pflicht | nötig für Identitätsabgleich (unten) und Drehtürprüfung (5.3) |
| Kontaktdaten | `contactData` | E-Mail, Telefon | optional | für den Kunden nur nach Zusage ([23]) |
| Pseudonym | `pseudonym` | Text | Pflicht | Anzeigeform für das pseudonymisierte Profil (6.4) |
| Qualifikationen | `qualifications` | Liste (Qualifikation, Nachweis) | optional | Nachweise als Dokumente (3.10) |
| Beschäftigungsverhältnis | `employmentStatusWithSupplier` | `employed`, `applicant` | Pflicht | Überlassung setzt ein Arbeitsverhältnis beim Verleiher voraus; Prüfzeitpunkt in 5.3 |
| Beschäftigt seit | `employedSince` | Datum | Pflicht bei `employed` | |
| Arbeitserlaubnis erforderlich | `workPermitRequired` | ja/nein | Pflicht | Nachweis als Dokument (3.10) |
| Erklärung zur Vorbeschäftigung | `previousEmploymentDeclaration` | Erklärung (Datum, Inhalt) | optional; vor dem Übergang des Einsatzes nach `planned` erforderlich (5.3.1) | Grundlage der Drehtürprüfung. **Herkunft und Form sind in 5.3.1 festgelegt:** Erklärung des Kandidaten, vom Verleiher eingeholt, mit Angabe, ob in den letzten sechs Monaten ein Arbeitsverhältnis beim Entleiher oder im Konzern bestand, dem Ende dieses Verhältnisses und dem Datum der Erklärung |
| Personenidentität | `workerIdentityRef` | Verweis (unten) | optional | nur beim Betreiber sichtbar |
| Status | `status` | `active`, `inactive` | Pflicht | kein Modell in Kapitel 4; der Vorgangsstatus hängt am Profilvorschlag |

**Mandant und Eigentümer.** Lieferantenmandant; der Lieferant ist Eigentümer
der Personendaten. Der Betreiber darf **nicht** die fachlichen Angaben des
Lieferanten ändern, sondern nur Pseudonymisierung und Sichtbarkeitsfreigabe
([22]). Der Kunde sieht den Kandidaten nur im Umfang der Datenminimierung
([23], 6.4).

**Beziehungen.** n Kandidaten : 1 Lieferant · 1 Kandidat : n Profilvorschläge ·
1 Kandidat : n Einsätze (auch **gleichzeitig** beim selben Kunden, 3.7) ·
1 Kandidat : n Dokumente (3.10) · n Kandidaten : 0..1 Personenidentität.

**Statusmodell.** Keines in Kapitel 4; die Vorgangsstatus stehen am
Profilvorschlag (4.2) und am Einsatz (4.3).

**Datenkategorie (→ 6.3).** **Der sensibelste Datenbestand des Systems:**
Bewerber- und Beschäftigtendaten einer natürlichen Person, einschließlich
Identifikationsmerkmalen (Name, Geburtsdatum). **Festlegung:** Der Prototyp
führt **keine** Gesundheitsdaten und keine anderen besonderen Kategorien nach
Art. 9 DSGVO im Kandidatenobjekt. Arbeitsmedizinische Eignung und ähnliche
Nachweise werden ausschließlich als *Vorliegen und Gültigkeit* geführt (3.10),
nicht inhaltlich. Löschfristen für abgelehnte Kandidaten: 6.5.

#### Profilvorschlag (`candidateSubmission`)

**Zweck.** Das Vorlegen eines Kandidaten auf eine konkrete Anfrage — der
Vorgang, der den Auswahlprozess trägt. **Abgrenzung:** Derselbe Kandidat kann
auf mehrere Anfragen vorgeschlagen werden; jeder Vorschlag hat seinen eigenen
Status und seine eigene Offenlegungsstufe.

| Deutsch | Bezeichner | Typ / Wertebereich | Pflicht | Bemerkung |
|---|---|---|---|---|
| Vorschlagsnummer | `submissionNumber` | Text | Pflicht | |
| Kandidat | `candidateRef` | Verweis | Pflicht | |
| Angebot | `supplierOfferRef` | Verweis (3.5) | Pflicht | bestimmt Einladung, Ausschreibung und Anfrage |
| Bedarfsanfrage | `demandRequestRef` | Verweis (3.4) | Pflicht | *abgeleitet*, zur Prüfung der Sichtbarkeit mitgeführt |
| Vorgelegt am | `submittedAt` | Zeitpunkt | Pflicht ab Status „eingereicht" | im Entwurf leer; die Matrix setzt mit `X[21]` einen Zustand `draft` voraus |
| Verfügbar ab | `availableFrom` | Datum | Pflicht | |
| Abweichender Satz | `offeredHourlyRate` | Betrag je Stunde | optional | wenn er von der Angebotsposition abweicht *(offene Frage 17)* |
| Offenlegungsstufe | `disclosureLevel` | `pseudonymized`, `identified` | Pflicht | Klardaten erst nach Zusage ([23], 6.4) |
| Dem Kunden vorgelegt am | `releasedToCustomerAt` | Zeitpunkt | optional | Freigabe durch `MD` ([22]) |
| Interview | `interviewScheduledAt` | Zeitpunkt | optional | |
| Entscheidung | `decision` | `accepted`, `rejected` | optional | fachlich durch `KB` ([24]) |
| Entscheidungsgrund | `decisionReason` | Text | Pflicht bei `rejected` | enthält **nie** Bezug auf ein fremdes Angebot (2.3, Regel 3) |
| Entschieden am / von | `decidedAt` / `decidedBy` | Zeitpunkt / Verweis | Pflicht bei Entscheidung | |
| Zurückgezogen am | `withdrawnAt` | Zeitpunkt | optional | durch `LD` ([20]) |
| Status | `status` | siehe 4.2 | Pflicht | |

**Mandant und Eigentümer.** Lieferantenmandant (der Vorschlag ist die Handlung
des Lieferanten), mit Statusführung gegenüber dem Kunden durch den `MD` ([17])
und fachlicher Entscheidung durch den `KB` ([24]).

**Beziehungen.** n Profilvorschläge : 1 Kandidat · n Profilvorschläge :
1 Angebot · 1 Profilvorschlag : 0..1 Einsatz (3.7).

**Statusmodell.** → **4.2** (eingereicht → gesichtet → Interview → zugesagt →
abgelehnt → zurückgezogen).

**Datenkategorie (→ 6.3).** Personenbezogen über den Kandidaten; die
Offenlegungsstufe ist die technische Umsetzung der Datenminimierung aus 6.4.
Jeder Zugriff auf Klardaten ist zu protokollieren (3.12).

#### Personenidentität (`workerIdentity`)

**Zweck.** Die betreiberseitige Information, dass Kandidatensätze
verschiedener Lieferanten **dieselbe Person** betreffen. Ohne dieses Objekt
sind die Zählung der Höchstüberlassungsdauer über Lieferanten und Kunden hinweg
(5.1), die Equal-Pay-Fristen (5.2), die Drehtürprüfung (5.3) und die Erkennung
von Doppelvorschlägen (2.3, Regel 4) **nicht möglich**.

| Deutsch | Bezeichner | Typ / Wertebereich | Pflicht | Bemerkung |
|---|---|---|---|---|
| Identitätsnummer | `identityNumber` | Text, betreiberweit eindeutig | Pflicht | nie an Kunden oder Lieferanten weitergegeben |
| Abgleichmerkmale | `matchingAttributes` | Name, Geburtsdatum, Geburtsort | Pflicht | **abschließender** Merkmalssatz (Entscheidung zu offener Frage 18); keine Sozialversicherungs-, Steuer- oder Ausweisnummern |
| Verknüpfte Kandidaten | `linkedCandidates` | Liste von Verweisen (3.6) | mindestens einer | lieferantenübergreifend |
| Bestätigt am / von | `confirmedAt` / `confirmedBy` | Zeitpunkt / Verweis | Pflicht bei bestätigter Verknüpfung | maschinelle Vorschläge werden manuell bestätigt |
| Verknüpfungshistorie | `mergeHistory` | Liste (Zeitpunkt, Handlung, Begründung) | Pflicht ab erster Änderung | Zusammenführen und Trennen bleiben nachvollziehbar |

**Mandant und Eigentümer.** **Ausschließlich Betreibermandant.** Kunden und
Lieferanten sehen das Objekt nicht und erfahren auch nicht, dass es existiert
(Fußnote [43] in 2.2, 2.3 Regel 4). Ergebnisse daraus erreichen sie nur als
Information oder Sperre zum eigenen Vorgang — nie als Historie.

**Beziehungen.** 1 Personenidentität : n Kandidaten · 1 Personenidentität :
n Einsätze (mittelbar, über die Kandidaten) — sie ist der Schlüssel, über den
5.1 über Lieferanten und Kunden hinweg zählt.

**Statusmodell.** Keines.

**Datenkategorie (→ 6.3).** **Die kritischste Kategorie des Modells:**
mandantenübergreifende Identifikationsdaten einer natürlichen Person. Die
Rechtsgrundlage ist in 6.1 und 6.3 zu bestimmen; die Zweckbindung ist eng auf
die AÜG-Prüfungen zu begrenzen.

> **Entschieden (vormals offene Frage 18).** Der Betreiber **führt** die
> Personenidentität. Der Merkmalssatz für den Abgleich ist **abschließend**:
> Name, Geburtsdatum, Geburtsort. Keine Sozialversicherungsnummer, keine
> Steuer-Identifikationsnummer, keine Ausweisnummer. Das Verfahren:
>
> 1. Der Abgleich **schlägt vor**, er verknüpft nicht selbst. Jede Verknüpfung
>    wird von einer Person beim Betreiber bestätigt (`confirmedAt`,
>    `confirmedBy`) — ein maschineller Treffer allein löst keine AÜG-Prüfung
>    aus.
> 2. Zusammenführen und Trennen sind in `mergeHistory` mit Begründung
>    festzuhalten; eine falsche Verknüpfung muss rückholbar sein, ohne die
>    Historie zu verlieren.
> 3. Die **Zweckbindung ist eng**: ausschließlich die Prüfungen aus 5.1, 5.2
>    und 5.3 sowie die Erkennung von Doppelvorschlägen (2.3, Regel 4). Keine
>    Nutzung für Auswertungen, Bewertungen oder Lieferantenvergleiche.
> 4. Kunden und Lieferanten sehen das Objekt und seine Existenz nicht ([43]);
>    Ergebnisse erreichen sie nur als Information oder Sperre zum eigenen
>    Vorgang.
>
> **Offen bleibt die Rechtsgrundlage** — Verantwortlichkeit, Rechtsgrundlage
> nach Art. 6 DSGVO, Informationspflicht gegenüber dem Leiharbeitnehmer und
> Löschfrist sind in 6.1, 6.3 und 6.5 zu bestimmen und **juristisch zu
> prüfen** (neue offene Frage 25). Die fachliche Entscheidung steht, die
> rechtliche Absicherung nicht.

### 3.7 Einsatz (Überlassung) mit Laufzeit, Verlängerung, Beendigung

#### Einsatz (`assignment`)

**Zweck.** Die konkrete Überlassung einer Person an einen Kunden für einen
Zeitraum — das zentrale Objekt für die AÜG-Fristen und für die Abrechnung.
**Abgrenzung:** Ein Einsatz ist **eine** Person bei **einem** Kunden an **einem**
Standort. Mehrere Köpfe einer Anfrage ergeben mehrere Einsätze.

| Deutsch | Bezeichner | Typ / Wertebereich | Pflicht | Bemerkung |
|---|---|---|---|---|
| Einsatznummer | `assignmentNumber` | Text, betreiberweit eindeutig | Pflicht | |
| Kunde | `customerRef` | Verweis (3.1) | Pflicht | Bezugspunkt der Höchstüberlassungsdauer (5.1) |
| Standort | `siteRef` | Verweis (3.1) | Pflicht | Einsatzort (5.3) |
| Kostenstelle | `costCenterRef` | Verweis (3.1) | Pflicht | für Lieferanten nicht sichtbar |
| Lieferant | `supplierRef` | Verweis (3.2) | Pflicht | Anzeige gegenüber dem Kunden nach *(offener Frage 11)* |
| Kandidat | `candidateRef` | Verweis (3.6) | Pflicht | |
| Personenidentität | `workerIdentityRef` | Verweis (3.6) | Pflicht ab Status `planned` | nur Betreibersicht; Grundlage der Zählung nach 5.1 |
| Bedarfsanfrage | `demandRequestRef` | Verweis (3.4) | optional | leer bei Einsatz ohne vorangegangene Anfrage |
| Profilvorschlag | `candidateSubmissionRef` | Verweis (3.6) | optional | |
| Tätigkeitsbeschreibung | `activityDescription` | Text | Pflicht | Konkretisierungspflicht (5.3); **nicht** nur ein Verweis auf die Anfrage |
| Geplanter Beginn / Ende | `plannedStartDate` / `plannedEndDate` | Datum | `plannedStartDate` Pflicht | |
| Tatsächlicher Beginn / Ende | `actualStartDate` / `actualEndDate` | Datum | optional | |
| Wochenstunden | `weeklyHours` | Dezimalzahl | Pflicht | |
| Schichtmodell | `shiftModel` | Katalogwert | optional | |
| Vereinbarte Preisposition | `agreedRateCardItemRef` | Verweis (3.3) | Pflicht | Einkaufsseite |
| Abweichender Satz | `agreedHourlyRate` | Betrag je Stunde | optional | *(offene Frage 17)* |
| Abweichungsgrund | `rateDeviationReason` | Text | Pflicht bei Abweichung | *(offene Frage 17)* |
| Kundenseitige Preisposition | `customerRateCardItemRef` | Verweis (3.3) | Pflicht | Verkaufsseite; für Lieferanten nie sichtbar ([42]) |
| Vergleichsentgelt | `comparableWage` | Betrag je Stunde | Pflicht ab `equalPayDueDate` | erbt beim Anlegen aus dem Vergleichsentgelt des Standorts zur Tätigkeit (3.3); eine Abweichung ist mit Begründung möglich und wird protokolliert |
| Equal-Pay-Fälligkeit | `equalPayDueDate` | Datum | *abgeleitet* | Ergebnis aus 5.2 |
| Fristende Höchstüberlassung | `maxDurationEndDate` | Datum | *abgeleitet* | Ergebnis aus 5.1 |
| Angerechnete Dauer | `countedDurationDays` | Ganzzahl, Tage | *abgeleitet* | einschließlich Vorläufern derselben Person beim selben Kunden |
| Beendigungsgrund | `terminationReason` | Text | Pflicht bei vorzeitiger Beendigung | |
| Beendigung beantragt von | `terminationRequestedBy` | Verweis auf `user` | Pflicht bei Antrag | `KB` ([25]), `LD` ([25]) oder `MD` |
| Status | `status` | siehe 4.3 | Pflicht | |
| Fremdsystemkennung | `externalReference` | Text | optional | *(offene Frage 7)* |

**Mandant und Eigentümer.** Der Einsatz ist das Objekt an der Nahtstelle und
gehört dem **Betreibermandanten**; er ist gleichzeitig dem Kunden und dem
Lieferanten zugänglich, jedem nur im eigenen Umfang (Fußnoten [2] und [7]).
Anlegen, verlängern und beenden führt der `MD` aus; Kunde und Lieferant
beantragen ([25]), der Kunde genehmigt im Rahmen von 4.3 ([26]).

**Beziehungen.** n Einsätze : 1 Bedarfsanfrage · 1 Einsatz : 0..1
Profilvorschlag · n Einsätze : 1 Kandidat · 1 Einsatz : n Verlängerungen ·
1 Einsatz : n Unterbrechungen · 1 Einsatz : n Stundenzettel (3.8) · 1 Einsatz :
n Belegpositionen (3.9) · 1 Einsatz : n Dokumente (3.10, z. B. Unterweisung).

**Statusmodell.** → **4.3** (geplant → aktiv → unterbrochen → verlängert →
beendet → vorzeitig beendet).

**Datenkategorie (→ 6.3).** Beschäftigtendaten mit Arbeitsort und Arbeitszeit,
verknüpft mit Entgeltbezug über `comparableWage`. Löschfrist für beendete
Einsätze: 6.5.

> **Zur Asymmetrie zwischen Verlängerung und Beendigung.** Die Verlängerung ist
> ein eigener Vorgang (`assignmentExtension`, unten), die vorzeitige Beendigung
> dagegen nur ein Feldersatz am Einsatz (`terminationReason`,
> `terminationRequestedBy`). Ein beantragter, noch nicht entschiedener
> Beendigungsvorgang hat deshalb keinen eigenen Zustand — der Einsatz bleibt
> `active`, bis die Beendigung wirksam wird (4.3.1). Das ist bewusst so: die
> Verlängerung ändert die Laufzeit und damit Kosten und Fristen und wird
> **immer** genehmigt ([26]), die Beendigung wird je nach antragstellender
> Seite genehmigt oder nur unterrichtet. Soll die Beendigung später mehrstufig
> genehmigt werden, ist hier ein Vorgang analog `assignmentExtension`
> nachzutragen.

#### Verlängerung (`assignmentExtension`)

**Zweck.** Die Verschiebung des Einsatzendes nach hinten, als eigener,
protokollierter Vorgang. **Abgrenzung:** keine stille Änderung von
`plannedEndDate` — jede Verlängerung ist ein Satz mit Antrag, Genehmigung und
Wirksamkeit und löst die AÜG-Prüfungen aus (4.7).

| Deutsch | Bezeichner | Typ / Wertebereich | Pflicht | Bemerkung |
|---|---|---|---|---|
| Einsatz | `assignmentRef` | Verweis | Pflicht | |
| Neues Ende | `newEndDate` | Datum | Pflicht | muss nach dem bisherigen Ende liegen |
| Begründung | `reason` | Text | Pflicht | |
| Beantragt am / von | `requestedAt` / `requestedBy` | Zeitpunkt / Verweis | Pflicht | `KB` oder `LD` ([25]) |
| Genehmigt am / von | `approvedAt` / `approvedBy` | Zeitpunkt / Verweis | Pflicht ab Genehmigung | `KG`, soweit 4.3 es der Kundenseite zuweist ([26]) |
| Wirksam gesetzt am / von | `effectiveAt` / `effectiveBy` | Zeitpunkt / Verweis | Pflicht ab Wirksamkeit | `MD` ([25]) |
| Prüfergebnis | `ruleCheckResult` | Information, Warnung, Sperre | *abgeleitet* | Ergebnis der AÜG-Prüfung (5.1, 5.5) |
| Status | `status` | siehe 4.3 | Pflicht | |

**Mandant und Eigentümer.** Wie der Einsatz. Die Verlängerung **teilt die
Matrixzeile des Einsatzes** (2.2, Lesart).

**Beziehungen.** n Verlängerungen : 1 Einsatz.

**Statusmodell.** → **4.3**.

**Datenkategorie (→ 6.3).** Wie der Einsatz.

#### Unterbrechung (`assignmentInterruption`)

**Zweck.** Eine dokumentierte Unterbrechung der Überlassung. Sie ist fachlich
notwendig, weil eine Unterbrechung von mehr als drei Monaten die Zählung der
Höchstüberlassungsdauer zurücksetzt (5.1).

| Deutsch | Bezeichner | Typ / Wertebereich | Pflicht | Bemerkung |
|---|---|---|---|---|
| Einsatz | `assignmentRef` | Verweis | Pflicht | |
| Von / bis | `interruptionFrom` / `interruptionTo` | Datum | `interruptionFrom` Pflicht | `interruptionTo` leer = läuft noch |
| Grund | `reason` | Katalogwert + Text | Pflicht | |
| Zählwirksam | `countsAsReset` | ja/nein | *abgeleitet* | Ergebnis der Rechenvorschrift aus 5.1 |

**Festlegung und Grenze.** Dieses Objekt erfasst **dokumentierte**
Unterbrechungen innerhalb eines laufenden Einsatzes. Ob auch die Lücke
**zwischen** zwei Einsätzen derselben Person beim selben Kunden als
Unterbrechung zählt, ist eine Rechenfrage von 5.1 und keine Frage des
Datenmodells — die Lücke ergibt sich aus den Einsatzdaten und braucht kein
eigenes Objekt. **5.1.4 hat entschieden:** beide Fälle werden nach derselben
Drei-Monats-Regel bewertet, die Lücke zwischen zwei Einsätzen ohne eigenes
Objekt aus den Einsatzdaten.

**Beziehungen.** n Unterbrechungen : 1 Einsatz. Teilt die Matrixzeile des
Einsatzes.

**Statusmodell.** Keines; relevant ist der Zeitraum. Der Einsatzstatus
„unterbrochen" steht in 4.3.

**Datenkategorie (→ 6.3).** Der Unterbrechungsgrund kann auf Abwesenheitsgründe
hinauslaufen und damit auf Gesundheitsdaten — siehe die Festlegung zu 3.8 und
*offene Frage 21*.

> **Entschieden (vormals offene Frage 19).** Mehrere **gleichzeitige** Einsätze
> derselben Person beim selben Kunden sind **zulässig** (Teilzeit über zwei
> Kostenstellen). Für die Höchstüberlassungsdauer zählt 5.1 **Kalendertage der
> Überlassung an denselben Entleiher**: ein Tag, an dem zwei Einsätze laufen,
> zählt genau **einmal**. Nicht gezählt werden Stunden, und nicht summiert wird
> je Einsatz — sonst wäre die Grenze bei Teilzeit über zwei Kostenstellen nach
> der Hälfte der Zeit erreicht. Die Zählung läuft über die Personenidentität
> (3.6), nicht über den Kandidatensatz eines Lieferanten.

### 3.8 Stundenzettel, Zeitposition, Zuschlagsart

#### Stundenzettel (`timesheet`)

**Zweck.** Die Zusammenfassung der Zeiten **eines** Einsatzes für **einen**
Abrechnungszeitraum — der Gegenstand der Genehmigung. **Abgrenzung:** Der
Stundenzettel wird genehmigt, nicht die einzelne Zeitposition
(Fußnote [44] in 2.2).

| Deutsch | Bezeichner | Typ / Wertebereich | Pflicht | Bemerkung |
|---|---|---|---|---|
| Zettelnummer | `timesheetNumber` | Text | Pflicht | |
| Einsatz | `assignmentRef` | Verweis (3.7) | Pflicht | |
| Abrechnungsperiode | `billingPeriodRef` | Verweis (3.9) | Pflicht | |
| Zeitraum von / bis | `periodFrom` / `periodTo` | Datum | Pflicht | innerhalb der Abrechnungsperiode |
| Erfasst von | `recordedBy` | Verweis auf `user` | Pflicht | Leiharbeitnehmer *(offene Frage 4)* oder `LD` in dessen Namen ([27]) |
| Eingereicht am / von | `submittedAt` / `submittedBy` | Zeitpunkt / Verweis | Pflicht ab Status „eingereicht" | |
| Summe Stunden | `totalHours` | Dezimalzahl | *abgeleitet* | Summe der Zeitpositionen |
| Summe je Zuschlagsart | `totalPremiumHours` | Liste (Zuschlagsart, Stunden) | *abgeleitet* | Grundlage der Belegpositionen (3.9) |
| Freigabeschritte | `approvals` | Liste von `timesheetApproval` | Pflicht ab Einreichung | Anzahl und Zuständigkeit sind **offene Frage 5** |
| Endgültig genehmigt am / von | `approvedAt` / `approvedBy` | Zeitpunkt / Verweis | Pflicht ab Status „genehmigt" | der letzte Freigabeschritt |
| Ablehnungsgrund | `rejectionReason` | Text | Pflicht bei Ablehnung | |
| Korrekturfassung zu | `correctionOf` | Verweis auf `timesheet` | optional | genehmigte Zeiten werden nur über eine Korrekturfassung geändert ([28], 4.4) |
| Status | `status` | siehe 4.4 | Pflicht | |
| Fremdsystemkennung | `externalReference` | Text | optional | *(offene Frage 7)* |

**Mandant und Eigentümer.** Der Stundenzettel entsteht auf der Lieferanten-
bzw. Arbeitnehmerseite und wird kundenseitig genehmigt; geführt wird er im
**Betreibermandanten**, weil er beide Seiten verbindet und Grundlage beider
Belegseiten ist (3.9). Erfassung: Leiharbeitnehmer oder `LD` ([27]);
Korrekturen nur mit Begründung und Protokolleintrag ([28]).

**Beziehungen.** n Stundenzettel : 1 Einsatz · n Stundenzettel :
1 Abrechnungsperiode · 1 Stundenzettel : n Zeitpositionen · 1 Stundenzettel :
n Freigabeschritte · 1 Stundenzettel : n Belegpositionen (3.9) ·
1 Stundenzettel : 0..1 Korrekturfassung.

**Statusmodell.** → **4.4** (erfasst → eingereicht → in Prüfung → genehmigt →
abgelehnt → korrigiert).

**Datenkategorie (→ 6.3).** Arbeitszeitdaten einer natürlichen Person;
zusammen mit dem Einsatz ein vollständiges Bild von Anwesenheit und Abwesenheit.

#### Freigabeschritt (`timesheetApproval`)

**Zweck.** Eine Stufe der Genehmigung. Das Objekt existiert, damit die Zahl der
Stufen **nicht** im Datenmodell festgeschrieben ist — *(offene Frage 5)*.

| Deutsch | Bezeichner | Typ / Wertebereich | Pflicht | Bemerkung |
|---|---|---|---|---|
| Stundenzettel | `timesheetRef` | Verweis | Pflicht | |
| Stufe | `level` | Ganzzahl ≥ 1 | Pflicht | |
| Zuständige Rolle | `assignedRoleCode` | Rollenkürzel (2.1) | Pflicht | welche Rolle welche Stufe trägt, ist **offene Frage 5** |
| Entscheidung | `decision` | `approved`, `rejected` | optional | leer = offen |
| Entschieden am / von | `decidedAt` / `decidedBy` | Zeitpunkt / Verweis | Pflicht bei Entscheidung | |
| Vertretungsvermerk | `delegationRef` | Verweis (3.11) | optional | Handlung in Vertretung (2.4, Regel 6) |
| Bemerkung | `comment` | Text | optional | |

**Mandant und Eigentümer.** Wie der Stundenzettel; **teilt dessen
Matrixzeile**. Bei einstufiger Genehmigung existiert genau ein Satz — das
Objekt bleibt dann trivial, aber die Struktur muss nicht geändert werden.

**Statusmodell.** Teil von **4.4**.

**Datenkategorie (→ 6.3).** Beschäftigtendaten der entscheidenden Person.

#### Zeitposition (`timeEntry`)

**Zweck.** Ein einzelner Zeitnachweis — ein Tag oder ein Abschnitt eines Tages.
**Abgrenzung:** Die Zeitposition trägt **keinen eigenen Status**; genehmigt wird
der Stundenzettel ([44]).

| Deutsch | Bezeichner | Typ / Wertebereich | Pflicht | Bemerkung |
|---|---|---|---|---|
| Stundenzettel | `timesheetRef` | Verweis | Pflicht | |
| Tag | `workDate` | Datum | Pflicht | |
| Beginn / Ende | `startTime` / `endTime` | Uhrzeit | optional | nur bei abschnittsweiser Erfassung — **offene Frage 16** |
| Pause | `breakMinutes` | Ganzzahl, Minuten | optional | |
| Stunden | `hours` | Dezimalzahl ≥ 0 | Pflicht | die abzurechnende Menge |
| Zuschläge | `premiums` | Liste (Zuschlagsart, Stunden) | optional | mehrere Zuschlagsarten je Position möglich |
| Abweichende Kostenstelle | `costCenterRef` | Verweis (3.1) | optional | wenn sie von der des Einsatzes abweicht |
| Abwesenheit | `absenceType` | Katalogwert | optional | **offene Frage 21** — siehe Festlegung unten |
| Bemerkung | `note` | Text | optional | |
| Korrektur von | `correctedFrom` | Verweis auf `timeEntry` | optional | |
| Korrekturgrund | `correctionReason` | Text | Pflicht bei Korrektur | ([28]) |

**Mandant und Eigentümer.** Wie der Stundenzettel; erfasst durch
Leiharbeitnehmer *(offene Frage 4)* oder `LD` ([27]).

**Beziehungen.** n Zeitpositionen : 1 Stundenzettel · n Zeitpositionen :
m Zuschlagsarten · n Zeitpositionen : 0..1 abweichende Kostenstelle.

**Statusmodell.** Keines ([44]).

**Datenkategorie (→ 6.3).** Arbeitszeitdaten. **Festlegung:** Die
Abwesenheitsart wird im Prototyp **nicht** mit medizinischem Gehalt geführt.
Ob überhaupt eine Abwesenheitsart erfasst wird — und wenn ja, ob differenziert
(„krank", „Urlaub", „Feiertag") oder nur als „keine Arbeitsleistung" — ist
**offene Frage 21**: „krank" ist ein Gesundheitsdatum nach Art. 9 DSGVO, und
die Lohnabrechnung ist nach 1.4 nicht im Umfang. Das Feld ist deshalb optional
und entfällt ersatzlos, wenn die Frage mit „nur keine Arbeitsleistung"
beantwortet wird.

#### Zuschlagsart (`premiumType`)

**Zweck.** Der Katalog der Zuschlagsarten — Nacht, Sonntag, Feiertag,
Überstunde, Erschwernis. **Abgrenzung:** Die Zuschlagsart sagt, *dass* und *wie*
gerechnet wird; *wie viel* steht in der Preisposition (3.3).

| Deutsch | Bezeichner | Typ / Wertebereich | Pflicht | Bemerkung |
|---|---|---|---|---|
| Kürzel | `code` | Text, betreiberweit eindeutig | Pflicht | |
| Bezeichnung | `name` | Text | Pflicht | |
| Berechnungsart | `calculationBase` | `percentage`, `absolute` | Pflicht | |
| Vorbelegung | `defaultValue` | Prozentsatz oder Betrag | optional | überschreibbar je Preisposition |
| Anlass | `appliesTo` | Katalogwert | Pflicht | Nacht, Sonntag, Feiertag, Überstunde, Erschwernis … |
| Rechtsgrundlage | `legalBasis` | `statutory`, `collectiveAgreement`, `contractual` | Pflicht | |
| Laufzeit | `validFrom` / `validTo` | Zeitraum | `validFrom` Pflicht | |

**Mandant und Eigentümer.** Betreibermandant (Katalog); Pflege nur durch `MA`.
Der Lieferant sieht nur Zuschlagsarten, die in seinen eigenen Konditionen
vorkommen ([9]).

**Beziehungen.** 1 Zuschlagsart : n Preispositionen (3.3) · 1 Zuschlagsart :
n Zeitpositionszuschläge · 1 Zuschlagsart : n Belegpositionen (3.9).

**Statusmodell.** Keines.

**Datenkategorie (→ 6.3).** Keine personenbezogenen Daten.

### 3.9 Abrechnungsbeleg (Gutschrift / Rechnung), Abrechnungsperiode

#### Abrechnungsperiode (`billingPeriod`)

**Zweck.** Der Zeitraum, für den Zeiten gesammelt und Belege erstellt werden.
Ihr Schluss ist die Frist, zu der genehmigte Stundenzettel vorliegen müssen
(Eskalationsanlass in 2.4).

| Deutsch | Bezeichner | Typ / Wertebereich | Pflicht | Bemerkung |
|---|---|---|---|---|
| Periodennummer | `periodNumber` | Text | Pflicht | z. B. Jahr und Monat |
| Kunde | `customerRef` | Verweis (3.1) | optional | leer = betreiberweite Periode |
| Von / bis | `periodFrom` / `periodTo` | Datum | Pflicht | |
| Schlusstermin | `closingDate` | Datum | Pflicht | Frist für die Genehmigung |
| Status | `status` | `open`, `closed` | Pflicht | Öffnen und Schließen durch `MD` ([33]) |
| Geöffnet / geschlossen am, von | `openedAt` / `openedBy` / `closedAt` / `closedBy` | Zeitpunkt / Verweis | Pflicht beim jeweiligen Vorgang | |

**Mandant und Eigentümer.** Betreibermandant; `MA` legt an, `MD` öffnet und
schließt ([33]).

**Beziehungen.** 1 Abrechnungsperiode : n Stundenzettel (3.8) ·
1 Abrechnungsperiode : n Abrechnungsbelege.

**Statusmodell.** Die beiden Werte sind der fachliche Mindestumfang; ein
vollständiges Modell gehört in **4.5** neben den Beleg und ist dort
nachzutragen.

**Datenkategorie (→ 6.3).** Nur Bearbeitungsvermerke.

#### Abrechnungsbeleg (`billingDocument`) und Belegposition (`billingDocumentItem`)

**Zweck.** Der kaufmännische Beleg über erbrachte Überlassungsleistung.
**Abgrenzung:** Der Beleg bildet ab, was genehmigte Zeiten und Konditionen
ergeben; er ist kein Zahlungsvorgang (Zahlungsabwicklung und Mahnwesen sind
nach 1.4 nicht im Umfang).

Es gibt zwei Belegseiten, die den Preislisten entsprechen (3.3): die
**Kundenseite** (Betreiber stellt dem Kunden) und die **Lieferantenseite**
(Betreiber und Lieferant rechnen ab). Auf der Lieferantenseite gilt das
**Gutschriftverfahren** (Entscheidung zu offener Frage 6): der Betreiber
erstellt die Gutschrift, der Lieferant bestätigt oder beanstandet sie.

**Beleg**

| Deutsch | Bezeichner | Typ / Wertebereich | Pflicht | Bemerkung |
|---|---|---|---|---|
| Belegnummer | `documentNumber` | Text, lückenlos je Nummernkreis | Pflicht | Nummernkreise je Belegart |
| Belegart | `documentType` | `customerInvoice`, `supplierCreditNote`, `supplierInvoice` | Pflicht | die beiden Lieferantenarten schließen sich aus; im Prototyp wird nur `supplierCreditNote` verwendet (Gutschriftverfahren) |
| Seite | `direction` | `sales`, `purchase` | Pflicht | folgt der Belegart |
| Kunde | `customerRef` | Verweis (3.1) | Pflicht bei `sales` | |
| Lieferant | `supplierRef` | Verweis (3.2) | Pflicht bei `purchase` | |
| Abrechnungsperiode | `billingPeriodRef` | Verweis | Pflicht | |
| Belegdatum | `issueDate` | Datum | Pflicht | |
| Netto / Steuer / Brutto | `netAmount` / `taxAmount` / `grossAmount` | Betrag | Pflicht | *abgeleitet* aus den Positionen |
| Währung | `currency` | ISO 4217 | Pflicht | |
| Zugrunde liegende Stundenzettel | `basedOnTimesheets` | Liste von Verweisen (3.8) | mindestens einer | nur **genehmigte** Zettel (4.4) |
| Erstellt von | `createdBy` | Verweis auf `user` | Pflicht | |
| Freigegeben am / von | `releasedAt` / `releasedBy` | Zeitpunkt / Verweis | Pflicht ab Freigabe | **nicht** dieselbe Person wie `createdBy` ([30], 2.4 Regel 5) |
| Beanstandung | `disputeReason` | Text | Pflicht bei Beanstandung | `KE` ([31]) bzw. `LD` ([32]) |
| Beanstandet am / von | `disputedAt` / `disputedBy` | Zeitpunkt / Verweis | Pflicht bei Beanstandung | |
| Storno zu | `cancellationOf` | Verweis auf `billingDocument` | optional | Storno erzeugt einen neuen Beleg, der alte bleibt |
| Status | `status` | siehe 4.5 | Pflicht | |
| Fremdsystemkennung | `externalReference` | Text | optional | *(offene Frage 7)* — hier besonders relevant für die ERP-Übergabe |

**Belegposition**

| Deutsch | Bezeichner | Typ / Wertebereich | Pflicht | Bemerkung |
|---|---|---|---|---|
| Beleg | `billingDocumentRef` | Verweis | Pflicht | |
| Einsatz | `assignmentRef` | Verweis (3.7) | Pflicht | |
| Stundenzettel | `timesheetRef` | Verweis (3.8) | Pflicht | Nachvollziehbarkeit bis zur Zeiterfassung |
| Zuschlagsart | `premiumTypeRef` | Verweis (3.8) | optional | leer = Grundleistung |
| Menge | `quantity` | Dezimalzahl | Pflicht | |
| Einheit | `unit` | `hour` | Pflicht | im Prototyp nur Stunden |
| Einzelpreis | `unitPrice` | Betrag | Pflicht | aus der jeweiligen Preisseite (3.3) |
| Betrag | `amount` | Betrag | Pflicht | *abgeleitet* |
| Kostenstelle | `costCenterRef` | Verweis (3.1) | Pflicht bei `sales` | aus Einsatz oder Zeitposition |

**Mandant und Eigentümer.** Betreibermandant; der Betreiber erstellt beide
Seiten. `KE` prüft und beanstandet die Kundenseite ([31]), `LD` bestätigt oder
beanstandet die Lieferantenseite ([32]). Die Statusführung bleibt in jedem Fall
beim Betreiber — im Gutschriftverfahren legt der Lieferant keinen Beleg an.

**Beziehungen.** n Belege : 1 Abrechnungsperiode · 1 Beleg :
n Belegpositionen · n Belegpositionen : 1 Stundenzettel · n Belegpositionen :
1 Einsatz · 1 Beleg : 0..1 Storno.

**Statusmodell.** → **4.5** (offen → erstellt → geprüft → freigegeben →
storniert).

**Datenkategorie (→ 6.3).** Mittelbar personenbezogen: über Einsatz und
Stundenzettel ist jede Position einer Person zuzuordnen. **Wichtig für 6.5:**
Belege unterliegen handels- und steuerrechtlichen Aufbewahrungspflichten; sie
sind von der Löschung personenbezogener Daten gesondert zu behandeln
(Löschkonzept 6.6).

> **Entschieden (vormals offene Frage 6).** Für den Prototyp gilt das
> **Gutschriftverfahren**: der Betreiber erstellt `supplierCreditNote`, der
> Lieferant bestätigt oder beanstandet. Der Rechnungseingang
> (`supplierInvoice`, vom Lieferanten eingereicht) bleibt als Belegart im
> Katalog und im Statusmodell 4.5 beschrieben, wird im Prototyp aber **nicht**
> umgesetzt — damit entfällt auch die Matrixänderung, die er verlangt hätte
> (ein `A[7]` für `LD`). Die Belegpositionen und ihre Herleitung aus den
> Stundenzetteln sind in beiden Verfahren gleich.

### 3.10 Dokument / Nachweis (Erlaubnisurkunde, Unterweisung, Qualifikation)

#### Dokument (`document`)

**Zweck.** Ein hinterlegtes Schriftstück mit fachlicher Nachweisfunktion.
**Abgrenzung:** Das Dokument ist die *Datei samt Nachweisangaben*; die fachlichen
Daten eines Nachweises stehen an dem Objekt, zu dem er gehört (z. B. die
Erlaubnisdaten an `supplierPermit`, 3.2). Ein Dokumentenmanagementsystem ist
das VMS nicht.

| Deutsch | Bezeichner | Typ / Wertebereich | Pflicht | Bemerkung |
|---|---|---|---|---|
| Dokumentnummer | `documentNumber` | Text | Pflicht | |
| Nachweisart | `documentCategory` | `permitCertificate`, `safetyBriefing`, `qualificationCertificate`, `workPermit`, `clearanceCertificate`, `agreementDocument`, `other` | Pflicht | Katalog; welche Art Pflicht ist und ob sie sperrt, steht im Pflichtkatalog in 5.4 |
| Bezugsobjekt (Art) | `subjectType` | `supplier`, `customer`, `candidate`, `assignment`, `site`, `masterAgreement` | Pflicht | |
| Bezugsobjekt | `subjectRef` | Verweis | Pflicht | genau eines |
| Ausgestellt von | `issuer` | Text | optional | |
| Ausgestellt am | `issuedOn` | Datum | optional | |
| Gültig von / bis | `validFrom` / `validTo` | Datum | optional | `validTo` steuert die Fristenüberwachung in 5.4 |
| Ablageverweis | `fileRef` | undurchsichtiger Verweis | Pflicht | Ablageort und -verfahren folgen den **offenen Fragen 1 und 2** |
| Dateiname | `fileName` | Text | Pflicht | |
| Dateityp | `mimeType` | Text | Pflicht | |
| Hochgeladen am / von | `uploadedAt` / `uploadedBy` | Zeitpunkt / Verweis | Pflicht | |
| Anerkennungsstatus | `verificationStatus` | `submitted`, `accepted`, `rejected` | Pflicht | Anerkennung durch `MD` ([34]); Änderung durch den Einsteller nur bis zur Anerkennung ([37]) |
| Anerkannt am / von | `verifiedAt` / `verifiedBy` | Zeitpunkt / Verweis | Pflicht bei `accepted` | |
| Zurückweisungsgrund | `rejectionReason` | Text | Pflicht bei `rejected` | |
| Pflichtnachweis | `mandatory` | ja/nein | Pflicht | *abgeleitet* aus dem Pflichtkatalog in 5.4; nicht frei setzbar |
| Sperrwirkung | `blocking` | ja/nein | Pflicht | *abgeleitet* aus dem Pflichtkatalog in 5.4: `ja` sperrt den Übergang, `nein` warnt (5.5) |
| Sichtbarkeitsklasse | `confidentiality` | `operatorOnly`, `operatorAndOwner`, `assignmentParties` | Pflicht | setzt [35] und [36] um: der Kunde sieht einsatzbezogene Nachweise, nicht die Vertragsunterlagen des Lieferanten |

**Mandant und Eigentümer.** Der Mandant folgt dem Bezugsobjekt; Eigentümer ist,
wer das Dokument eingestellt hat (`LA`/`LD` für Lieferanten- und
Kandidatennachweise, `MA` für Vertragsunterlagen). Die Anerkennung liegt beim
Betreiber ([34]). Der Kunde sieht nur einsatzbezogene Nachweise zum eigenen
Kunden ([35]) und beim Lieferanten nur den Gültigkeitsstatus der AÜG-Erlaubnis
ohne Urkundeninhalte ([36]).

**Beziehungen.** n Dokumente : 1 Bezugsobjekt (Lieferant, Kunde, Kandidat,
Einsatz, Standort oder Rahmenvertrag) · 1 Erlaubnisurkunde : 1 AÜG-Erlaubnis
(3.2).

**Statusmodell.** Kapitel 4 führt **kein** Modell. Die Anerkennung
(`submitted` → `accepted` / `rejected`) gehört fachlich zu **5.4** und ist in
**5.4.3** mit Übergängen, Fristen und Sperrwirkung beschrieben. Wichtig: der
Ablauf der Gültigkeit wechselt **keinen** Status — die Anerkennung bezieht sich
auf das Schriftstück, die Gültigkeit auf den Zeitraum (5.4.3).

**Datenkategorie (→ 6.3).** Qualifikations- und Nachweisdaten einer
natürlichen Person, wenn das Bezugsobjekt ein Kandidat oder ein Einsatz ist.
**Festlegung:** Arbeitsmedizinische und ähnliche Nachweise werden **nur als
Vorliegen und Gültigkeit** geführt — kein Befundinhalt, keine Diagnose, keine
Eignungsbeurteilung im Volltext. Das ist die Umsetzung der Datenminimierung
(6.4) auf der Dokumentenebene.

> **Entschieden (vormals offene Frage 20).** Der Pflichtkatalog ist **fest**,
> nicht je Kunde konfigurierbar, und die Sperrwirkung ist **gestuft**:
>
> | Nachweisart | Bezug | Wirkung bei Fehlen oder Ablauf |
> |---|---|---|
> | AÜG-Erlaubnis | Lieferant | **Sperre** — kein Onboarding, kein Einsatzstart (5.4) |
> | Arbeitserlaubnis | Kandidat | **Sperre** — kein Einsatzstart |
> | Unterweisung am Standort | Einsatz | **Sperre** — kein Einsatzstart, solange der Standort sie verlangt (`safetyBriefingRequired`, 3.1) |
> | Qualifikationsnachweis | Kandidat | Warnung |
> | Unbedenklichkeitsbescheinigung | Lieferant | Warnung |
> | Sonstige (`other`) | beliebig | Information |
>
> `mandatory` und `blocking` sind deshalb **abgeleitete** Felder: sie folgen
> aus dem Katalog in 5.4 und werden nicht am einzelnen Dokument gesetzt. Die
> drei Sperren sind genau die, die 4.7 in Q21 und Q42 bereits als Sperre
> entworfen hat; Q10 bleibt Information, Q37 bleibt Warnung.

### 3.11 Benutzer, Rolle, Mandantenzuordnung

Dieses Kapitel führt die Objekte, die die Regeln aus Kapitel 2 tragen. Die
**Rechte** einer Rolle sind **keine pflegbaren Daten**: sie stehen in der
Berechtigungsmatrix 2.2 und sind Teil des Regelwerks. Eine frei konfigurierbare
Rechteverwaltung ist im Prototyp ausdrücklich **nicht** vorgesehen.

#### Mandant (`tenant`)

**Zweck.** Der Datenraum einer Organisation. Jedes mandantengebundene Objekt
trägt genau einen `tenantId` (3.0).

| Deutsch | Bezeichner | Typ / Wertebereich | Pflicht | Bemerkung |
|---|---|---|---|---|
| Mandantennummer | `tenantNumber` | Text, systemweit eindeutig | Pflicht | |
| Mandantentyp | `tenantType` | `operator`, `customer`, `supplier` | Pflicht | genau **ein** Mandant mit `operator` |
| Organisation | `organizationRef` | Verweis auf `customer` oder `supplier` | Pflicht außer beim Betreiber | |
| Anzeigename | `displayName` | Text | Pflicht | |
| Aktiv | `deactivatedAt` | Zeitpunkt | optional | Deaktivierung sperrt alle Zugänge des Mandanten |

**Mandant und Eigentümer.** Betreibermandant; angelegt mit dem Kunden bzw.
Lieferanten. Deshalb trägt die Matrix in 2.2 **keine** eigene Zeile für den
Mandanten — er wird mit 3.1 bzw. 3.2 gepflegt.

**Beziehungen.** 1 Mandant : n Benutzer · 1 Mandant : 0..1 Kunde oder
Lieferant · 1 Mandant : n Objekte aller mandantengebundenen Arten.

**Statusmodell.** Keines.

> *(offene Frage 8)* Ob alle Mandanten eines MSP in einer Instanz liegen oder
> je Kunde eine Instanz betrieben wird, ändert dieses Objekt nicht. Bei
> getrennten Instanzen existiert in jeder Instanz ein Betreibermandant, und die
> mandantenübergreifenden Auswertungen aus 5.1 sind über Instanzgrenzen
> zusammenzuführen — als Anforderung bleiben sie bestehen (2.3).

#### Benutzer (`user`)

**Zweck.** Eine Person mit Zugang zum System.

| Deutsch | Bezeichner | Typ / Wertebereich | Pflicht | Bemerkung |
|---|---|---|---|---|
| Benutzernummer | `userNumber` | Text | Pflicht | |
| Mandant | `tenantRef` | Verweis | Pflicht | **genau einer** — Mehrfachrollen nur innerhalb einer Organisation (Kapitel 2) |
| Anmeldekennung | `loginIdentifier` | E-Mail-Adresse | Pflicht | personenbezogen; **kein** Geheimnis im Datenmodell (3.0, Festlegung 4) |
| Vorname / Name | `givenName` / `familyName` | Text | Pflicht | |
| Sprache | `language` | Sprachcode | optional | Oberfläche Deutsch im Prototyp |
| Aktiv | `deactivatedAt` | Zeitpunkt | optional | |

**Mandant und Eigentümer.** Mandant des Benutzers. Pflege durch `MA`
(Betreiber- und — derzeit — Kundenbenutzer) bzw. `LA` (eigene Organisation,
[7]). Wer kundenseitige Benutzer verwaltet, ist **offene Frage 12**: wird eine
kundenseitige Administratorrolle eingeführt, kommt eine Rolle in 2.1 und eine
Spalte in 2.2 hinzu — dieses Objekt bleibt unverändert.

**Beziehungen.** 1 Benutzer : n Rollenzuweisungen · 1 Benutzer :
n Betreuungszuordnungen (nur MSP-Benutzer) · 1 Benutzer : n Vertretungen (als
Vertreter) · 1 Benutzer : n Audit-Einträge (3.12).

**Statusmodell.** Keines; aktiv/inaktiv über `deactivatedAt`.

**Datenkategorie (→ 6.3).** Beschäftigtendaten. **Nicht enthalten:**
Anmeldegeheimnisse, Zugriffsprotokolle (die stehen in 3.12).

#### Rolle (`role`)

| Deutsch | Bezeichner | Typ / Wertebereich | Pflicht | Bemerkung |
|---|---|---|---|---|
| Rollenkürzel | `roleCode` | `operatorAdmin`, `operatorCoordinator`, `demandOwner`, `approver`, `procurementController`, `supplierCoordinator`, `supplierAdmin`, `temporaryWorker` | Pflicht | die acht Rollen aus 2.1 |
| Bezeichnung | `name` | Text | Pflicht | |
| Gilt für Mandantentyp | `appliesToTenantType` | `operator`, `customer`, `supplier` | Pflicht | verhindert Rollen über Organisationsgrenzen (Kapitel 2) |

**Festlegung.** Die Rollen sind ein **fester Katalog**, keine Nutzerdaten. Die
Rolle `temporaryWorker` existiert nur, wenn *(offene Frage 4)* mit „eigener
Zugang" beantwortet wird; andernfalls entfällt der Katalogwert ersatzlos, wie
die Spalte `AN` der Matrix.

#### Rollenzuweisung (`roleAssignment`)

| Deutsch | Bezeichner | Typ / Wertebereich | Pflicht | Bemerkung |
|---|---|---|---|---|
| Benutzer | `userRef` | Verweis | Pflicht | |
| Rolle | `roleRef` | Verweis | Pflicht | |
| Mandant | `tenantRef` | Verweis | Pflicht | muss dem Mandanten des Benutzers entsprechen |
| Zuständigkeiten | `responsibilityScopes` | Liste von `responsibilityScope` | optional | *(offene Frage 14)* |
| Laufzeit | `validFrom` / `validTo` | Zeitraum | `validFrom` Pflicht | |
| Vergeben von | `grantedBy` | Verweis auf `user` | Pflicht | Gegenstand des Berechtigungsreviews (6.8) |

**Festlegung.** Die Rollenzuweisung ist die Einheit, auf die sich Vertretung
(unten) und Audit-Eintrag (3.12) beziehen — nicht der Benutzer. Das wirksame
Recht ist die Schnittmenge aus Rolle, Mandant und Zuständigkeit (Kapitel 2).

#### Zuständigkeit (`responsibilityScope`)

| Deutsch | Bezeichner | Typ / Wertebereich | Pflicht | Bemerkung |
|---|---|---|---|---|
| Rollenzuweisung | `roleAssignmentRef` | Verweis | Pflicht | |
| Art | `scopeType` | `site`, `costCenter` | Pflicht | |
| Zielobjekt | `scopeRef` | Verweis (3.1) | Pflicht | |

**Festlegung.** Fehlt zu einer Rollenzuweisung jede Zuständigkeit, wirkt sie
auf den ganzen Mandanten. Ob die Einschränkung überhaupt eingeführt wird und
wer sie pflegt, ist **offene Frage 14**; wird sie verworfen, entfällt das Objekt
ersatzlos.

#### Betreuungszuordnung (`accountAssignment`)

| Deutsch | Bezeichner | Typ / Wertebereich | Pflicht | Bemerkung |
|---|---|---|---|---|
| MSP-Benutzer | `userRef` | Verweis | Pflicht | nur Benutzer des Betreibermandanten |
| Kunde | `customerRef` | Verweis (3.1) | Pflicht | |
| Laufzeit | `validFrom` / `validTo` | Zeitraum | `validFrom` Pflicht | |

**Festlegung.** Die Betreuungszuordnung schränkt die Querschnittssicht des
Betreibers ein (2.3). Fehlt sie für einen MSP-Benutzer vollständig, ist das eine
bewusste Entscheidung des `MA` und Gegenstand des Berechtigungsreviews (6.8) —
kein stiller Vollzugriff.

#### Vertretung (`delegation`)

| Deutsch | Bezeichner | Typ / Wertebereich | Pflicht | Bemerkung |
|---|---|---|---|---|
| Vertretene Rollenzuweisung | `delegatedRoleAssignmentRef` | Verweis | Pflicht | nicht der Benutzer, sondern die Zuweisung (2.4, Regel 2) |
| Vertreter | `delegateUserRef` | Verweis auf `user` | Pflicht | muss **demselben Mandanten** angehören (2.4, Regel 3) |
| Zeitraum | `periodFrom` / `periodTo` | Zeitpunkt | **beide Pflicht** | unbefristete Vertretungen gibt es nicht (2.4, Regel 1) |
| Grund | `reason` | Text | optional | |
| Eingerichtet von | `createdBy` | Verweis auf `user` | Pflicht | Rolleninhaber selbst oder Administrator ([45], 2.4 Regel 7) |
| Beendet am / von | `revokedAt` / `revokedBy` | Zeitpunkt / Verweis | optional | vorzeitiges Ende |

**Festlegung.** Keine Ketten (ein Vertreter kann keinen Untervertreter
bestimmen, 2.4 Regel 4), keine Rechteerweiterung, kein Übergang über
Organisationsgrenzen. Mit Ablauf des Zeitraums enden die Rechte sofort; offene
Vorgänge fallen an die vertretene Funktion zurück (2.4 Regel 9). Jede Handlung
in Vertretung trägt den Vertretungsvermerk im Audit-Eintrag (3.12).
Die Rolle `temporaryWorker` ist **nicht** vertretbar (2.4 Regel 8), ebenso
nicht die Übersteuerung einer AÜG-Sperre (5.5).

**Beziehungen.** n Vertretungen : 1 Rollenzuweisung · n Vertretungen :
1 Vertreter · 1 Vertretung : n Audit-Einträge.

**Statusmodell.** Keines; die Wirksamkeit ergibt sich aus dem Zeitraum und
`revokedAt`.

**Datenkategorie (→ 6.3).** Beschäftigtendaten beider beteiligten Personen.

### 3.12 Audit-Eintrag (fachliches Protokoll)

#### Audit-Eintrag (`auditEntry`)

**Zweck.** Das fachliche Protokoll: wer hat wann an welchem Objekt welche
Operation ausgeführt — in eigener Zuständigkeit oder in Vertretung.
**Abgrenzung:** Der Audit-Eintrag ist das *fachliche* Protokoll der
Geschäftsvorgänge, nicht das technische Betriebslog (Server-, Netz- und
Fehlerprotokolle sind nicht Gegenstand dieses Kapitels).

| Deutsch | Bezeichner | Typ / Wertebereich | Pflicht | Bemerkung |
|---|---|---|---|---|
| Eintragsnummer | `entryNumber` | fortlaufend, lückenlos | Pflicht | Lücken sind ein Befund, kein Betriebszustand |
| Zeitpunkt | `occurredAt` | Zeitpunkt | Pflicht | |
| Handelnder Benutzer | `actorUserRef` | Verweis (3.11) | Pflicht | bei Systemläufen ein Systemkennzeichen |
| Handelnde Rollenzuweisung | `actingAsRoleAssignmentRef` | Verweis (3.11) | Pflicht | sagt, *in welcher Funktion* gehandelt wurde |
| Vertretungsvermerk | `delegationRef` | Verweis (3.11) | Pflicht bei Handlung in Vertretung | 2.4, Regel 6 |
| Mandant des Objekts | `tenantRef` | Verweis | Pflicht | Grundlage der Sichtbarkeit nach [39] |
| Objektart | `objectType` | Objektname aus Kapitel 3 | Pflicht | |
| Objekt | `objectRef` | Verweis | Pflicht | |
| Operation | `operation` | `create`, `read`, `update`, `transition`, `delete` | Pflicht | dieselben Operationen wie in 2.2 |
| Status vorher / nachher | `statusFrom` / `statusTo` | Statuswert | Pflicht bei `transition` | |
| Geänderte Felder | `changedFields` | Liste (Feld, vorher, nachher) | Pflicht bei `update` | Umfang und Aufbewahrung siehe 6.6 |
| Begründung | `reason` | Text | Pflicht bei Korrektur und Übersteuerung | [28] und 5.5 |
| Ausgelöste Regel | `ruleRef` | Verweis auf eine Regel aus Kapitel 5 | optional | bei Prüfergebnissen und Sperren |
| Ergebnis | `result` | `success`, `denied`, `blocked` | Pflicht | abgelehnte Zugriffe werden ebenfalls protokolliert |
| Aufrufkontext | `clientContext` | Satz technischer Merkmale | optional | Umfang ist in **6.8** festzulegen; IP-Adressen sind personenbezogen |

**Unveränderlichkeit.** Audit-Einträge entstehen **ausschließlich durch das
System** und sind für jede Rolle unveränderlich — deshalb kein `Ä` und kein `X`
in 2.2 ([39]). Eine Korrektur erzeugt einen **neuen** Eintrag; der alte bleibt
stehen.

**Was protokolliert wird.** Festlegung aus Kapitel 2:

1. **Alle schreibenden Operationen** an allen Objekten dieses Kapitels
   (`create`, `update`, `transition`, `delete`).
2. **Lesende Zugriffe über Mandantengrenzen hinweg** — also die
   Querschnittssicht des Betreibers (2.3, „Betreiber").
3. **Lesende Zugriffe auf Klardaten von Kandidaten** (6.4), unabhängig vom
   Mandanten.
4. **Jede Handlung in Vertretung** (2.4, Regel 6) und **jede Eskalationsstufe**
   (2.4, Regel 4), mit Anlass, Adressat und Zeitpunkt.
5. **Jede Übersteuerung einer AÜG-Sperre** mit Begründung (5.5).

Lesende Zugriffe **innerhalb** des eigenen Mandanten auf nicht
personenbezogene Daten werden nicht protokolliert — das wäre eine
Vollprotokollierung ohne Zweck und würde den Bestand personenbezogener Daten
unnötig vergrößern.

**Mandant und Eigentümer.** Der Eintrag gehört technisch dem Betreiber, wird
aber dem Mandanten des betroffenen Objekts zugeordnet: `KE` und `LA` sehen
Einträge zu Objekten der eigenen Organisation, `MD` zu Objekten der betreuten
Kunden ([39]).

**Beziehungen.** n Audit-Einträge : 1 Benutzer · n Audit-Einträge :
1 Rollenzuweisung · n Audit-Einträge : 1 Objekt beliebiger Art ·
n Audit-Einträge : 0..1 Vertretung.

**Statusmodell.** Keines — ein Eintrag ist ein Faktum, kein Vorgang.

**Datenkategorie (→ 6.3).** Protokolldaten über das Verhalten von
Beschäftigten. Sie sind zweckgebunden auf Nachweis, Fehlersuche und
Berechtigungsreview (6.8) und **nicht** zur Leistungs- oder
Verhaltenskontrolle zu verwenden — eine Festlegung, die in 6.3 und ggf. in
einer Betriebsvereinbarung zu verankern ist.

> *(offene Frage 22, neu)* Wie lange Audit-Einträge aufbewahrt werden und wie
> sich das zum Löschanspruch der betroffenen Person verhält, ist offen. Die
> Spannung ist echt: der Eintrag ist der Nachweis, dass eine Löschung,
> Korrektur oder Übersteuerung stattgefunden hat, und darf nicht mit dem
> gelöschten Datensatz verschwinden. Die Entscheidung gehört nach 6.5 und 6.6;
> dieses Kapitel legt sie nicht vor.

### 3.13 Beziehungen und Kardinalitäten

#### Die vier Stränge des Modells

Das Datenmodell hat vier Stränge, die sich am Einsatz (3.7) treffen.

**1. Stammdaten und Vertragsrahmen.** Ein Mandant ist entweder der Betreiber,
ein Kunde oder ein Lieferant. Zu jedem Kunden gehören beliebig viele Standorte
und Kostenstellen, zu jedem Lieferanten beliebig viele AÜG-Erlaubnissätze
(historisiert, nicht überschrieben). Je Gegenpartei gibt es einen oder mehrere
Rahmenverträge, zu jedem Rahmenvertrag eine oder mehrere Preislisten und zu
jeder Preisliste viele Preispositionen. Die Tarifzuordnung hängt an Lieferant,
Kunde oder Standort und liefert die Parameter für 5.1 und 5.2.

**2. Der Kernprozess.** Eine Bedarfsanfrage gehört zu genau einem Kunden, einem
Standort und einer Kostenstelle. Aus ihr gehen eine oder mehrere
Ausschreibungen hervor (Runden), zu jeder Ausschreibung gehört je Lieferant
genau eine Einladung, zu jeder Einladung höchstens ein Angebot, zu jedem
Angebot beliebig viele Angebotspositionen und beliebig viele Profilvorschläge
— auch keiner. Jeder Profilvorschlag verweist auf genau einen Kandidaten; ein
Kandidat kann in vielen Vorschlägen stehen. Aus einem angenommenen Vorschlag
entsteht höchstens ein Einsatz; eine Anfrage über mehrere Köpfe führt zu
mehreren Einsätzen.

**3. Durchführung und Abrechnung.** Ein Einsatz hat beliebig viele
Verlängerungen, beliebig viele Unterbrechungen und beliebig viele
Stundenzettel — je Abrechnungsperiode einen. Ein Stundenzettel hat beliebig
viele Zeitpositionen und einen oder mehrere Freigabeschritte; jede Zeitposition
kann mehrere Zuschlagsarten tragen. Ein Abrechnungsbeleg gehört zu genau einer
Abrechnungsperiode und hat beliebig viele Belegpositionen; jede Position
verweist auf genau einen Stundenzettel und genau einen Einsatz, sodass jeder
Betrag bis zur Zeiterfassung zurückverfolgbar ist.

**4. Querschnitt.** Dokumente hängen polymorph an Lieferant, Kunde, Kandidat,
Einsatz, Standort oder Rahmenvertrag. Benutzer gehören zu genau einem Mandanten
und tragen beliebig viele Rollenzuweisungen, die ihrerseits Zuständigkeiten und
Vertretungen tragen. Audit-Einträge hängen an einem Benutzer, einer
Rollenzuweisung und einem beliebigen Objekt. Die Personenidentität steht
außerhalb der Mandantenstruktur: sie verbindet Kandidatensätze verschiedener
Lieferanten und ist nur für den Betreiber sichtbar — sie ist der einzige
bewusst mandantenübergreifende Knoten des Modells, mit abschließendem
Merkmalssatz und enger Zweckbindung (3.6).

#### Die fünf Kardinalitäten, die fachlich entscheidend sind

| Beziehung | Kardinalität | Warum sie so ist |
|---|---|---|
| Einladung : Angebot | 1 : 0..1 | Ein Lieferant gibt je Einladung höchstens **ein** Angebot ab; eine zweite Chance ist eine neue Ausschreibungsrunde. So bleibt die Angebotshistorie eindeutig. |
| Kandidat : Profilvorschlag | 1 : n | Derselbe Kandidat darf auf viele Anfragen vorgeschlagen werden, mit **eigenem** Status und eigener Offenlegungsstufe je Vorschlag (6.4). |
| Einsatz : Stundenzettel | 1 : n, je Periode 1 | Genau ein Zettel je Einsatz und Abrechnungsperiode; Korrekturen laufen über eine Korrekturfassung, nicht über einen zweiten Zettel ([28], 4.4). |
| Belegposition : Stundenzettel | n : 1 | Jeder abgerechnete Betrag ist bis zur genehmigten Zeit zurückverfolgbar — Voraussetzung für die Beanstandung (4.5). |
| Personenidentität : Kandidat | 1 : n | Der einzige mandantenübergreifende Knoten; ohne ihn keine Zählung über Lieferanten hinweg (5.1). Jede Verknüpfung wird manuell bestätigt (3.6). |

#### Übersichtsdiagramm

Das Diagramm zeigt die fachlichen Beziehungen, **nicht** ein
Datenbankschema. Unterobjekte und Kataloge sind enthalten, Standardfelder aus
3.0 nicht.

```mermaid
erDiagram
    TENANT ||--o| CUSTOMER : "ist"
    TENANT ||--o| SUPPLIER : "ist"
    TENANT ||--o{ USER : "hat"

    CUSTOMER ||--o{ SITE : "hat"
    CUSTOMER ||--o{ COST_CENTER : "hat"
    SITE ||--o{ COST_CENTER : "optional zugeordnet"
    SUPPLIER ||--o{ SUPPLIER_PERMIT : "weist nach"

    CUSTOMER ||--o{ MASTER_AGREEMENT : "Vertragsstrecke Kunde"
    SUPPLIER ||--o{ MASTER_AGREEMENT : "Vertragsstrecke Lieferant"
    MASTER_AGREEMENT ||--o{ RATE_CARD : "hat"
    RATE_CARD ||--|{ RATE_CARD_ITEM : "enthaelt"
    PREMIUM_TYPE ||--o{ RATE_CARD_ITEM : "bewertet"
    SUPPLIER ||--o{ COLLECTIVE_AGREEMENT_ASSIGNMENT : "Verleihertarif"
    CUSTOMER ||--o{ COLLECTIVE_AGREEMENT_ASSIGNMENT : "Entleihertarif"
    SITE ||--o{ COLLECTIVE_AGREEMENT_ASSIGNMENT : "Branchenzuschlag"

    CUSTOMER ||--o{ DEMAND_REQUEST : "meldet"
    SITE ||--o{ DEMAND_REQUEST : "Einsatzort"
    COST_CENTER ||--o{ DEMAND_REQUEST : "belastet"
    DEMAND_REQUEST ||--o{ TENDER : "Runden"
    TENDER ||--|{ TENDER_INVITATION : "verteilt an"
    SUPPLIER ||--o{ TENDER_INVITATION : "eingeladen"
    TENDER_INVITATION ||--o| SUPPLIER_OFFER : "beantwortet mit"
    SUPPLIER_OFFER ||--|{ SUPPLIER_OFFER_ITEM : "enthaelt"
    SUPPLIER_OFFER ||--o{ CANDIDATE_SUBMISSION : "schlaegt vor"

    SUPPLIER ||--o{ CANDIDATE : "fuehrt"
    CANDIDATE ||--o{ CANDIDATE_SUBMISSION : "vorgeschlagen in"
    WORKER_IDENTITY ||--o{ CANDIDATE : "verknuepft"

    CANDIDATE_SUBMISSION ||--o| ASSIGNMENT : "fuehrt zu"
    DEMAND_REQUEST ||--o{ ASSIGNMENT : "besetzt durch"
    CUSTOMER ||--o{ ASSIGNMENT : "entleiht"
    SITE ||--o{ ASSIGNMENT : "Einsatzort"
    COST_CENTER ||--o{ ASSIGNMENT : "belastet"
    SUPPLIER ||--o{ ASSIGNMENT : "verleiht"
    CANDIDATE ||--o{ ASSIGNMENT : "ist eingesetzt"
    RATE_CARD_ITEM ||--o{ ASSIGNMENT : "vereinbarter Satz"
    ASSIGNMENT ||--o{ ASSIGNMENT_EXTENSION : "verlaengert"
    ASSIGNMENT ||--o{ ASSIGNMENT_INTERRUPTION : "unterbrochen"

    ASSIGNMENT ||--o{ TIMESHEET : "Zeiten"
    BILLING_PERIOD ||--o{ TIMESHEET : "Zeitraum"
    TIMESHEET ||--|{ TIME_ENTRY : "enthaelt"
    TIMESHEET ||--|{ TIMESHEET_APPROVAL : "Freigabeschritte"
    TIME_ENTRY }o--o{ PREMIUM_TYPE : "Zuschlaege"
    TIMESHEET ||--o| TIMESHEET : "Korrekturfassung"

    BILLING_PERIOD ||--o{ BILLING_DOCUMENT : "Belege"
    BILLING_DOCUMENT ||--|{ BILLING_DOCUMENT_ITEM : "enthaelt"
    TIMESHEET ||--o{ BILLING_DOCUMENT_ITEM : "Grundlage"
    ASSIGNMENT ||--o{ BILLING_DOCUMENT_ITEM : "abgerechnet"
    BILLING_DOCUMENT ||--o| BILLING_DOCUMENT : "Storno zu"

    SUPPLIER_PERMIT ||--|| DOCUMENT : "Urkunde"
    SUPPLIER ||--o{ DOCUMENT : "Nachweise"
    CANDIDATE ||--o{ DOCUMENT : "Nachweise"
    ASSIGNMENT ||--o{ DOCUMENT : "Unterweisung"
    MASTER_AGREEMENT ||--o{ DOCUMENT : "Vertragsunterlagen"

    USER ||--o{ ROLE_ASSIGNMENT : "hat"
    ROLE ||--o{ ROLE_ASSIGNMENT : "Katalog"
    ROLE_ASSIGNMENT ||--o{ RESPONSIBILITY_SCOPE : "Zustaendigkeit"
    ROLE_ASSIGNMENT ||--o{ DELEGATION : "vertreten durch"
    USER ||--o{ DELEGATION : "vertritt"
    USER ||--o{ ACCOUNT_ASSIGNMENT : "betreut"
    CUSTOMER ||--o{ ACCOUNT_ASSIGNMENT : "betreut von"
    USER ||--o{ AUDIT_ENTRY : "handelt"
    ROLE_ASSIGNMENT ||--o{ AUDIT_ENTRY : "in Funktion"
    DELEGATION ||--o{ AUDIT_ENTRY : "Vertretungsvermerk"
```

**Was das Diagramm nicht zeigt.** Die Mandantengrenze. Sie ist keine Beziehung,
sondern eine Bedingung über jeder Beziehung: eine Kante zwischen zwei Objekten
verschiedener Mandanten ist nur dort zulässig, wo Kapitel 2.3 sie ausdrücklich
erlaubt. Das betrifft insbesondere `TENDER_INVITATION` (Betreiber →
Lieferant), `ASSIGNMENT` (Betreiber ↔ Kunde ↔ Lieferant), `TIMESHEET`
(Lieferant → Kunde) und `WORKER_IDENTITY` (nur Betreiber).

## 4. Statusmodelle

Dieses Kapitel beschreibt, **welcher Übergang wann und durch wen** zulässig
ist. Die Berechtigungsmatrix 2.2 sagt mit `S` nur, *wer überhaupt* einen Status
wechseln darf; dieses Kapitel ist die zweite Hälfte dieser Aussage. Die Objekte
und ihre Felder stehen in Kapitel 3 und werden hier nicht erweitert.

- 4.1 Bedarfsanfrage
- 4.2 Einladung, Lieferantenangebot, Profilvorschlag
- 4.3 Einsatz und Verlängerung
- 4.4 Stundenzettel und Freigabeschritte
- 4.5 Abrechnungsperiode und Abrechnungsbeleg
- 4.6 Lieferantenstatus
- 4.7 Querschnitt: Statusübergang → AÜG-Prüfung → Ergebnisart

### 4.0 Konventionen für alle Statusmodelle

Die folgenden Regeln gelten für **jedes** Modell dieses Kapitels und werden in
den einzelnen Abschnitten nicht wiederholt.

1. **Nur genannte Übergänge.** Ein Status wechselt ausschließlich durch einen in
   diesem Kapitel genannten Übergang. Was nicht aufgeführt ist, ist nicht
   zulässig — auch nicht „aus Versehen" durch eine Feldänderung. Jedes Modell
   nennt deshalb ausdrücklich, welche Übergänge es **nicht** gibt.
2. **Berechtigung ist dreifach bedingt.** Die auslösende Rolle braucht `S` in
   der Matrix 2.2, die Mandantenzuordnung des Objekts und die Zuständigkeit
   (Kapitel 2). Fehlt eine der drei, ist der Übergang unzulässig, selbst wenn
   dieses Kapitel ihn nennt.
3. **Jeder Übergang wird protokolliert.** Ein Übergang erzeugt einen
   Audit-Eintrag mit `operation = transition` und `statusFrom` / `statusTo`
   (3.12). Handlungen in Vertretung tragen zusätzlich den Vertretungsvermerk
   (2.4, Regel 6). Die Spalte „Nebenwirkungen" nennt den Protokolleintrag nur
   dort gesondert, wo er über diesen Pflichtumfang hinausgeht (z. B. eine
   Pflichtbegründung).
4. **Kein genehmigender Übergang durch Fristablauf.** Zeit allein genehmigt,
   verlängert, besetzt und bestätigt nichts (2.4, Regel 1). Zeitgesteuerte
   Übergänge gibt es nur dort, wo sie **entziehen** statt zu gewähren:
   `expired` bei Bedarfsanfrage, Einladung und Angebot. Alles andere wird
   eskaliert, nicht gewechselt.
5. **Sperren sind keine Zustände.** Ein Prüfergebnis „Sperre" (5.5) verhindert
   einen Übergang; es erzeugt keinen eigenen Status. Ein gesperrter Vorgang
   bleibt in seinem Zustand stehen. Nur beim Lieferanten ist `blocked` ein
   echter Zustand (4.6) — er beschreibt die Organisation, nicht ein
   Prüfergebnis.
6. **Vier-Augen-Prinzip.** Wo ein Übergang eine Freigabe ist, darf er nicht von
   derselben Person ausgelöst werden, die den Vorgang erstellt oder beantragt
   hat — auch nicht in Vertretung (2.4, Regel 5). Das betrifft die Freigabe der
   Bedarfsanfrage (4.1), die Freigabe des Abrechnungsbelegs (4.5, Fußnote [30])
   und die Entsperrung eines Lieferanten (4.6, Fußnote [5]).
7. **Der Betreiber ersetzt keine Kundenentscheidung.** Kein Übergang, den
   dieses Kapitel einer Kundenrolle zuweist, darf vom Betreiber vollzogen
   werden — auch nicht in Vertretung und auch nicht nach Fristablauf (2.1,
   2.4 Regel 3). Liegengebliebene Entscheidungen werden eskaliert.
8. **Benachrichtigungen unterliegen den Sichtbarkeitsregeln.** Eine
   Benachrichtigung aus einem Übergang enthält nur Daten, die der Empfänger
   nach 2.3 sehen darf; mehrere Lieferanten stehen nie gemeinsam im Adressfeld
   (2.3, Regel 2).
9. **Endzustände sind endgültig.** Aus einem Endzustand führt kein Übergang
   zurück. Ein Vorgang, der nach einem Endzustand wiederholt werden soll,
   entsteht als **neues** Objekt (neue Ausschreibungsrunde, neuer Einsatz,
   Korrekturfassung, Storno- und Nachbeleg).
10. **Systemübergänge.** Zeitgesteuerte und abgeleitete Übergänge trägt das
    System. Der Audit-Eintrag führt dann ein Systemkennzeichen statt eines
    Benutzers (3.12).

**Namenskonvention.** Statusbezeichner sind modellübergreifend einheitlich:
derselbe Bezeichner bedeutet dasselbe. Wo ein Zustand fachlich etwas anderes
ist, trägt er einen anderen Namen — deshalb heißt die besetzte Bedarfsanfrage
`filled` und der regulär beendete Einsatz `completed`, nicht beides „fertig".

**Prozessfristen.** Die Fristwerte dieses Kapitels sind **Vorbelegungen** und je
Kunde über `processDeadlineConfig` (3.1) konfigurierbar (2.4, Regel 5). Sie sind
Prozessfristen ohne rechtliche Wirkung; die AÜG-Fristen stehen ausschließlich in
Kapitel 5. Fristablauf löst Erinnerung und Eskalation aus, nie einen Übergang
(Regel 4).

| Anlass | Konfigurationsschlüssel | Vorbelegung | Wirkung bei Ablauf |
|---|---|---|---|
| Entscheidung über eine eingereichte Bedarfsanfrage | `demandApprovalDeadlineDays` | 3 Arbeitstage ab `submitted` | Eskalation KG → Vertretung → KB → MD (2.4) |
| Kenntnisnahme einer Einladung | `invitationViewDeadlineDays` | 1 Arbeitstag ab `invitedAt` | Erinnerung an LD, dann LA |
| Angebotsfrist | Objektfeld `offerDeadline` (3.4, 3.5) | keine Vorbelegung — je Anfrage bzw. Runde | Einladung ohne Angebot auf `expired`; Eskalation (2.4) |
| Bindefrist eines Angebots | Objektfeld `offerValidUntil` (3.5) | keine Vorbelegung — je Angebot, optional | Angebot auf `expired`, offene Profilvorschläge werden abgelehnt (4.2) |
| Rückmeldung des Kunden auf ein vorgelegtes Profil | `submissionFeedbackDeadlineDays` | 3 Arbeitstage ab `releasedToCustomer` | Eskalation KB → Vertretung → KG → MD (2.4) |
| Entscheidung über eine Verlängerung | `extensionApprovalDeadlineDays` | 5 Arbeitstage ab `requested`, spätestens 10 Kalendertage vor Einsatzende | Eskalation KG → Vertretung → KE → MD |
| Einreichung eines Stundenzettels | `timesheetSubmissionDeadlineDays` | 3 Kalendertage nach `periodTo` | Eskalation LD → LA → MD (2.4) |
| Genehmigung eines Stundenzettels | `timesheetApprovalDeadlineDays` | bis `closingDate` der Abrechnungsperiode, Erinnerung 3 Kalendertage vorher | Eskalation; **keine** Genehmigungsfiktion |
| Prüfung eines Abrechnungsbelegs | `billingReviewDeadlineDays` | 14 Kalendertage ab `released` | Erinnerung, dann Eskalation; **keine** Bestätigungsfiktion |
| Vorlauf vor Ablauf eines Nachweises | → Kapitel 5.4 | **festgelegt in 5.4.4**, je Nachweisart gestuft; keine Prozessfrist, sondern Festwert des Regelwerks (5.0) | Information, Warnung, Eskalation nach Stufenfolge (5.4.4); **kein** Übergang |

**Statusmodelle, die dieses Kapitel nicht führt.** Kapitel 3 verweist für jedes
Objekt auf sein Statusmodell. Sieben Objekte haben einen Lebenszyklus, für den
die Gliederung von Kapitel 4 keines vorsah. Zwei davon trägt dieses Kapitel
nach, fünf bleiben offen:

| Objekt | Stand |
|---|---|
| Einladung (3.5) | **nachgetragen** in 4.2 |
| Abrechnungsperiode (3.9) | **nachgetragen** in 4.5 |
| Rahmenvertrag (3.3) | offen — `draft` / `active` / `expired` / `terminated`, Pflege ausschließlich `MA`; gehört in ein eigenes Unterkapitel |
| Preisliste (3.3) | offen — `draft` / `active` / `expired`, dito |
| Ausschreibung (3.5) | kein eigenes Modell nötig: offen bis `closedAt`, der Fortschritt ergibt sich aus 4.1 und den Einladungen |
| Dokument / Nachweis (3.10) | **nachgetragen in 5.4.3** (Anerkennung mit Fristen und Sperrwirkung), nicht in diesem Kapitel |
| Kunde, Standort, Kostenstelle (3.1) | kein Modell; aktiv/inaktiv über `validTo` und `deactivatedAt`. Die Matrix hält `S` für `MA` frei, damit ein Onboarding-Modell analog 4.6 nachgetragen werden kann |

### 4.1 Bedarfsanfrage

Objekt: `demandRequest` (3.4). Matrixzeile „Bedarfsanfrage (3.4)" in 2.2.

#### Zustände

| Deutsch | Bezeichner | Fachliche Bedeutung |
|---|---|---|
| Entwurf | `draft` | Der Bedarfsträger beschreibt den Bedarf. Der **einzige** Zustand, in dem `KB` inhaltlich ändern darf (Fußnote [11]). |
| Zur Freigabe eingereicht | `submitted` | Der Bedarf ist vollständig beschrieben und wartet auf die Entscheidung des Genehmigers. Eskalationsanlass (2.4). |
| Freigegeben | `approved` | Bedarf und Kostenwirkung sind kundenseitig freigegeben ([13]); `approvedAt` / `approvedBy` sind gesetzt. Noch nicht an Lieferanten verteilt. |
| Ausgeschrieben | `tendered` | Mindestens eine Ausschreibung (3.5) ist veröffentlicht; die Angebotsfrist läuft. Weitere Runden ändern den Zustand nicht. |
| In Auswahl | `inSelection` | Mindestens ein Profilvorschlag ist dem Kunden vorgelegt (4.2). Der Auswahlprozess läuft. |
| Besetzt | `filled` | So viele Einsätze sind wirksam, wie `headcount` verlangt (4.3). **Endzustand.** |
| Storniert | `cancelled` | Der Bedarf ist entfallen; `cancellationReason` ist Pflicht. **Endzustand.** |
| Abgelaufen | `expired` | Der Bedarfsbeginn ist erreicht, ohne dass eine Besetzung zustande kam. **Endzustand.** |

**Teilbesetzung ist kein eigener Zustand.** Sind bei `headcount > 1` erst
einige Stellen besetzt, bleibt die Anfrage in `inSelection`. Erst die letzte
Besetzung führt nach `filled`. Das hält die Zahl der Zustände klein und
verhindert, dass Teilmengen in Berichten doppelt gezählt werden.

#### Übergänge

| Von | Nach | Auslösende Rolle | Vorbedingungen | Nebenwirkungen |
|---|---|---|---|---|
| — | `draft` | `KB` (anlegen), `MD` im Auftrag ([10]) | Kunde, Standort und Kostenstelle gesetzt; Zuständigkeit des Bedarfsträgers *(offene Frage 14)* | Bei Anlage durch `MD` ist `createdOnBehalfOf` Pflicht ([10]) |
| `draft` | `submitted` | `KB` ([12]), `MD` | Pflichtfelder vollständig: `activityDescription`, mindestens eine Anforderung, `siteRef`, `startDate`, `weeklyHours`, `headcount` | Benachrichtigung an `KG`; `demandApprovalDeadlineDays` beginnt; ab hier keine inhaltliche Änderung durch `KB` ([11]); AÜG-Prüfung P8 (5.3) |
| `submitted` | `approved` | `KG` ([13]) | Auslöser ist **nicht** `requestedBy` (2.4, Regel 5); Kostenwirkung beurteilt ([8]) | `approvedAt` / `approvedBy` werden gesetzt; Benachrichtigung an `KB` und `MD`; Frist endet; AÜG-Prüfungen P8, P1-Vorschau |
| `submitted` | `draft` | `KG` ([13]) | Begründung Pflicht (Rückweisung zur Überarbeitung; 3.4 führt dafür **kein** Feld — siehe Hinweis unten) | Benachrichtigung an `KB`; `KB` darf wieder ändern ([11]); Protokolleintrag mit Begründung |
| `approved` | `tendered` | `MD`, `MA` | Ausschreibung mit mindestens einer Einladung veröffentlicht; `offerDeadline` gesetzt; je eingeladenem Lieferanten: Status `active` (4.6) und anerkannte, gültige Erlaubnis (5.4) | Einladungen entstehen in `invited` (4.2); je Lieferant **eine einzeln adressierte** Benachrichtigung (2.3, Regel 2); Angebotsfrist läuft; AÜG-Prüfungen P9 (Sperre je Einladung), P7 |
| `tendered` | `tendered` | `MD`, `MA` | Vorherige Ausschreibung geschlossen (`closedAt`); neue Ausschreibung mit `tenderRound + 1` | **Kein** Statuswechsel, aber ein Protokolleintrag am neuen Ausschreibungsobjekt; neue Einladungen; die alten Einladungen bleiben in ihrem Endzustand |
| `tendered` | `inSelection` | `MD` ([17]) | Mindestens ein Profilvorschlag steht in `releasedToCustomer` (4.2) | Benachrichtigung an `KB`; `submissionFeedbackDeadlineDays` beginnt; AÜG-Prüfungen P1, P6, P11 je Vorschlag |
| `inSelection` | `tendered` | `MD` | Alle vorgelegten Vorschläge sind abgelehnt oder zurückgezogen **und** die Angebotsfrist läuft noch oder eine neue Runde ist eröffnet | Benachrichtigung an `KB`; Protokolleintrag. Kein Rückfall, wenn bereits ein Einsatz aus der Anfrage besteht |
| `inSelection` | `filled` | `MD` | So viele Einsätze in `planned` oder `active` wie `headcount`; je Einsatz keine Sperre aus 5.1, 5.3, 5.4 | Offene Einladungen auf `expired`, offene Angebote und Vorschläge auf `rejected` mit Begründung **ohne** Bezug auf ein fremdes Angebot (2.3, Regel 3); Ausschreibung erhält `closedAt`; einzeln adressierte Benachrichtigungen |
| `draft`, `submitted`, `approved`, `tendered`, `inSelection` | `cancelled` | `KB` ([12]), `MD`, `MA` | `cancellationReason` Pflicht; **kein** wirksamer Einsatz aus dieser Anfrage (dann 4.3) | Offene Einladungen, Angebote und Vorschläge werden beendet (4.2); einzeln adressierte Benachrichtigungen; Protokolleintrag mit Begründung |
| `approved`, `tendered`, `inSelection` | `expired` | System | `startDate` erreicht und kein Einsatz zu dieser Anfrage vorhanden | Wie `cancelled`, ohne Begründungsfeld; Benachrichtigung an `KB` und `MD`; Protokolleintrag mit Systemkennzeichen. Entzieht nur — genehmigt nichts (4.0, Regel 4) |

#### Endzustände und ausgeschlossene Übergänge

**Endzustände:** `filled`, `cancelled`, `expired`.

Ausdrücklich **nicht** vorhanden:

- **Kein** `draft` → `approved`. Einreichen und Freigeben sind getrennte
  Handlungen zweier Rollen (Vier-Augen-Prinzip).
- **Keine** Freigabe durch `MA` oder `MD`. Die Freigabe ist eine
  Kundenentscheidung; eine liegengebliebene Freigabe wird eskaliert, nicht
  übernommen (2.4, Regel 3).
- **Kein** `submitted` → `tendered`. Ohne Freigabe keine Ausschreibung.
- **Kein** zeitgesteuerter Übergang nach `approved`, `tendered`, `inSelection`
  oder `filled`. Fristablauf gewährt nichts.
- **Kein** Rückweg aus `filled`, `cancelled` oder `expired`. Eine Nachbesetzung
  nach vorzeitiger Beendigung eines Einsatzes ist eine **neue** Bedarfsanfrage,
  keine Wiederöffnung — sonst verliert die Historie den Bezug zwischen Anfrage,
  Angebot und Einsatz.
- **Kein** `filled` → `cancelled`. Ein besetzter Bedarf wird über den Einsatz
  beendet (4.3), nicht über die Anfrage.
- **Kein** Übergang durch Änderung eines Feldes. Eine Verschiebung von
  `startDate` oder `endDate` im Zustand `draft` ist eine Änderung, kein
  Statuswechsel.

> **Entschieden (vormals Lücke in 3.4).** Die Rückweisung `submitted` → `draft`
> verlangt eine Begründung, damit der Bedarfsträger weiß, was zu ändern ist.
> 3.4 führt dafür jetzt das Feld `rejectionReason`; es ist bei Rückweisung
> Pflicht und für den Bedarfsträger sichtbar. Der Audit-Eintrag (`reason`,
> 3.12) entsteht zusätzlich, ersetzt das Feld aber nicht.

#### Diagramm

```mermaid
stateDiagram-v2
    [*] --> draft : anlegen (KB, MD im Auftrag)
    draft --> submitted : einreichen (KB)
    submitted --> approved : freigeben (KG)
    submitted --> draft : zurueckweisen (KG)
    approved --> tendered : ausschreiben (MD)
    tendered --> tendered : neue Runde (MD)
    tendered --> inSelection : Profil vorgelegt (MD)
    inSelection --> tendered : alle Vorschlaege abgelehnt (MD)
    inSelection --> filled : headcount besetzt (MD)
    draft --> cancelled : stornieren (KB, MD)
    submitted --> cancelled : stornieren (KB, MD)
    approved --> cancelled : stornieren (KB, MD)
    tendered --> cancelled : stornieren (KB, MD)
    inSelection --> cancelled : stornieren (KB, MD)
    approved --> expired : Bedarfsbeginn erreicht (System)
    tendered --> expired : Bedarfsbeginn erreicht (System)
    inSelection --> expired : Bedarfsbeginn erreicht (System)
    filled --> [*]
    cancelled --> [*]
    expired --> [*]
```

#### AÜG-Prüfungen (→ Kapitel 5)

| Übergang | Prüfung | Kapitel |
|---|---|---|
| `draft` → `submitted` | P8 Kennzeichnung und Konkretisierung: liegt eine konkrete Tätigkeitsbeschreibung vor? | 5.3 |
| `submitted` → `approved` | P8 erneut; P1 Vorschau: überschreitet der angefragte Zeitraum die Höchstüberlassungsdauer schon rechnerisch? (ohne Person, daher nur Information) | 5.3, 5.1 |
| `approved` → `tendered` | P9 Erlaubnis je eingeladenem Lieferanten; P7 Arbeitskampf am Standort | 5.4, 5.3 |
| `tendered` → `inSelection` | P1, P6, P11 je vorgelegtem Profilvorschlag — siehe 4.2 | 5.1, 5.3 |
| `inSelection` → `filled` | Keine eigene Prüfung; die Prüfungen liegen am Einsatz (4.3) | 5.1–5.4 |

Die Ergebnisarten stehen in der Querschnittstabelle 4.7.

### 4.2 Einladung, Lieferantenangebot, Profilvorschlag

Drei Objekte mit eigenem Lebenszyklus, die denselben Vorgang tragen: die
Einladung (`tenderInvitation`, 3.5) ist die Teilnahme eines Lieferanten, das
Angebot (`supplierOffer`, 3.5) seine Antwort, der Profilvorschlag
(`candidateSubmission`, 3.6) die Vorlage einer Person. Sie werden gemeinsam
behandelt, weil die Übergänge voneinander abhängen — aber sie sind **drei**
Modelle, nicht eines.

Die Matrix 2.2 führt sie in drei Zeilen: „Ausschreibung, Einladung (3.5)",
„Lieferantenangebot, Angebotsposition (3.5)" und „Kandidat / Profilvorschlag
(3.6)".

#### 4.2.1 Einladung

| Deutsch | Bezeichner | Fachliche Bedeutung |
|---|---|---|
| Eingeladen | `invited` | Die Einladung ist zugestellt; der Lieferant hat sie noch nicht geöffnet. |
| Zur Kenntnis genommen | `viewed` | Der Lieferant hat die Anfrage im Umfang von [14] gesehen; `viewedAt` ist gesetzt. Grundlage der Eskalation (2.4). |
| Angebot abgegeben | `offerSubmitted` | Zu dieser Einladung existiert ein eingereichtes Angebot. **Ende des eigenen Lebenszyklus** — der Vorgang läuft am Angebot weiter. |
| Abgesagt | `declined` | Der Lieferant bietet nicht an; `declineReason` ist Pflicht. **Endzustand.** |
| Abgelaufen | `expired` | Die Angebotsfrist ist verstrichen oder die Ausschreibung ist geschlossen, ohne dass ein Angebot vorliegt. **Endzustand.** |

| Von | Nach | Auslösende Rolle | Vorbedingungen | Nebenwirkungen |
|---|---|---|---|---|
| — | `invited` | `MD`, `MA` | Ausschreibung veröffentlicht (4.1); Lieferant `active` (4.6) mit anerkannter, gültiger Erlaubnis (5.4) | Einzeln adressierte Benachrichtigung an `LD` (2.3, Regel 2); `invitationViewDeadlineDays` beginnt; AÜG-Prüfung P9 (Sperre) |
| `invited` | `viewed` | System | Erster lesender Zugriff eines Benutzers des Lieferanten auf die Einladung | `viewedAt` wird gesetzt; Erinnerungsfrist endet. **Kein** Rechtsgeschäft und keine Zusage |
| `invited`, `viewed` | `offerSubmitted` | System, als Folge des Übergangs `draft` → `submitted` am Angebot (4.2.2) | Angebot zu dieser Einladung in `submitted` | `respondedAt` wird gesetzt; Benachrichtigung an `MD` |
| `invited`, `viewed` | `declined` | `LD` ([46]) | `declineReason` Pflicht | `respondedAt` wird gesetzt; Benachrichtigung an `MD`; die Absage enthält keinen Bezug auf andere Lieferanten |
| `invited`, `viewed` | `expired` | System | `offerDeadline` der Ausschreibung verstrichen **oder** Ausschreibung geschlossen (`closedAt`), und kein Angebot vorhanden | Benachrichtigung an `MD`; Eskalationsanlass „Ausschreibung ohne Angebot" (2.4). Entzieht nur |

**Endzustände:** `declined`, `expired`. `offerSubmitted` ist das Ende des
eigenen Lebenszyklus: die Einladung ist beantwortet, der Vorgang läuft am
Angebot weiter (4.2.2).

**Ausgeschlossen:**

- **Kein** Rückweg von `declined` oder `expired`. Eine zweite Chance ist eine
  neue Ausschreibungsrunde mit neuer Einladung (3.5), keine Wiederbelebung.
- **Kein** `offerSubmitted` → `viewed`. Zieht der Lieferant sein Angebot zurück,
  bleibt die Einladung auf `offerSubmitted`: sie **war** beantwortet, und der
  Rückzug ist am Angebot dokumentiert.
- **Keine** Mitteilung über fremde Einladungen. Kein Übergang darf erkennbar
  machen, wie viele Lieferanten eingeladen wurden oder geantwortet haben
  (2.3, „Zwischen Lieferanten").

```mermaid
stateDiagram-v2
    [*] --> invited : einladen (MD)
    invited --> viewed : erster Zugriff (System)
    invited --> offerSubmitted : Angebot eingereicht (System)
    viewed --> offerSubmitted : Angebot eingereicht (System)
    invited --> declined : absagen (LD)
    viewed --> declined : absagen (LD)
    invited --> expired : Angebotsfrist verstrichen (System)
    viewed --> expired : Angebotsfrist verstrichen (System)
    offerSubmitted --> [*]
    declined --> [*]
    expired --> [*]
```

> **Entschieden (vormals offene Frage 23).** Die Einladung trägt in 3.5
> `declineReason`, `respondedAt` und den Wert `declined`; der
> Lieferantendisponent sagt seine Einladung deshalb **selbst** ab. Die Matrix
> 2.2 führt dafür in der Zeile „Ausschreibung, Einladung (3.5)" jetzt
> `L[16] S[46]` — ein eng begrenztes Statusrecht auf den eigenen Vorgang,
> analog [20]. Annahme, Fristverlängerung und der Fortschritt der
> Ausschreibung bleiben beim Betreiber.

#### 4.2.2 Lieferantenangebot

| Deutsch | Bezeichner | Fachliche Bedeutung |
|---|---|---|
| Entwurf | `draft` | Der Lieferant erfasst Verfügbarkeit, Menge und Preis. Löschen nur hier ([21]). |
| Eingereicht | `submitted` | Das Angebot liegt beim Betreiber; `submittedAt` ist gesetzt. Änderung durch `LD` noch möglich ([19]). |
| Gesichtet | `reviewed` | Der Betreiber hat das Angebot bewertet; `reviewedAt` ist gesetzt. **Ab hier keine Änderung durch `LD`** ([19]). |
| Zugesagt | `accepted` | Der Lieferant erhält den Zuschlag: mindestens ein Profilvorschlag dieses Angebots ist besetzt. **Endzustand.** |
| Abgelehnt | `rejected` | Der Betreiber lehnt ab; Begründung Pflicht und **ohne** Bezug auf ein fremdes Angebot (2.3, Regel 3). **Endzustand.** |
| Zurückgezogen | `withdrawn` | Der Lieferant zieht zurück; `withdrawnAt` ist gesetzt. **Endzustand.** |
| Abgelaufen | `expired` | Die Bindefrist `offerValidUntil` ist verstrichen, ohne Entscheidung. **Endzustand.** |

| Von | Nach | Auslösende Rolle | Vorbedingungen | Nebenwirkungen |
|---|---|---|---|---|
| — | `draft` | `LD` (anlegen) | Eigene Einladung in `invited` oder `viewed`; Angebotsfrist nicht verstrichen | Je Einladung höchstens **ein** Angebot (3.13) |
| `draft` | `submitted` | `LD` ([20]) | Mindestens eine Angebotsposition; `availableFrom` und `offeredHeadcount` gesetzt; Angebotsfrist nicht verstrichen | Einladung auf `offerSubmitted` (4.2.1); Benachrichtigung an `MD`; Angebot wird für den Betreiber sichtbar |
| `submitted` | `submitted` | `LD` ([19]) | Angebot noch nicht gesichtet | Inhaltliche Änderung, **kein** Statuswechsel; Protokolleintrag mit geänderten Feldern (3.12) |
| `submitted` | `reviewed` | `MD` ([17]), `MA` | — | `reviewedAt` wird gesetzt; ab hier keine Änderung durch `LD` ([19]); keine Benachrichtigung an andere Lieferanten |
| `reviewed` | `accepted` | `MD` ([17]) | Mindestens ein Profilvorschlag dieses Angebots in `accepted` (4.2.3) | Benachrichtigung an `LD` — Zuschlag ohne Angaben zu fremden Angeboten; Grundlage für den Einsatz (4.3) |
| `submitted`, `reviewed` | `rejected` | `MD` ([17]), `MA` | Begründung Pflicht, ohne Fremdbezug (2.3, Regel 3) | Benachrichtigung an `LD`; offene Profilvorschläge dieses Angebots auf `rejected`; Protokolleintrag mit Begründung |
| `draft`, `submitted`, `reviewed` | `withdrawn` | `LD` ([20]) | Angebot noch nicht `accepted` | Benachrichtigung an `MD`; offene Profilvorschläge dieses Angebots auf `withdrawn`; Einladung bleibt auf `offerSubmitted` |
| `submitted`, `reviewed` | `expired` | System | `offerValidUntil` verstrichen und keine Entscheidung getroffen | Benachrichtigung an `LD` und `MD`; offene Profilvorschläge auf `expired`-Wirkung (4.2.3: `rejected` mit Fristbegründung). Entzieht nur |

**Endzustände:** `accepted`, `rejected`, `withdrawn`, `expired`.

**Ausgeschlossen:**

- **Kein** `accepted` → irgendwohin. Ein Widerruf des Zuschlags ist die
  vorzeitige Beendigung des entstandenen Einsatzes (4.3), nicht ein Rückschritt
  des Angebots.
- **Keine** inhaltliche Änderung durch den Betreiber. `MA` darf sperren oder
  stornieren, aber nicht ändern (2.1); `rejected` ist deshalb kein Ersatz für
  eine Korrektur.
- **Kein** `draft` → `reviewed`. Ein nicht eingereichtes Angebot ist für den
  Betreiber nicht sichtbar.
- **Kein** Übergang, der dem Lieferanten die eigene Platzierung verrät — auch
  nicht in der Ablehnungsbegründung (2.3, „Zwischen Lieferanten").

```mermaid
stateDiagram-v2
    [*] --> draft : anlegen (LD)
    draft --> submitted : einreichen (LD)
    submitted --> submitted : aendern bis zur Sichtung (LD)
    submitted --> reviewed : sichten (MD)
    reviewed --> accepted : Zuschlag (MD)
    submitted --> rejected : ablehnen (MD)
    reviewed --> rejected : ablehnen (MD)
    draft --> withdrawn : zurueckziehen (LD)
    submitted --> withdrawn : zurueckziehen (LD)
    reviewed --> withdrawn : zurueckziehen (LD)
    submitted --> expired : Bindefrist verstrichen (System)
    reviewed --> expired : Bindefrist verstrichen (System)
    accepted --> [*]
    rejected --> [*]
    withdrawn --> [*]
    expired --> [*]
```

#### 4.2.3 Profilvorschlag

| Deutsch | Bezeichner | Fachliche Bedeutung |
|---|---|---|
| Entwurf | `draft` | Der Lieferant stellt den Vorschlag zusammen. Löschen nur hier ([21]). |
| Eingereicht | `submitted` | Der Vorschlag liegt beim Betreiber; `submittedAt` ist gesetzt. |
| Gesichtet | `reviewed` | Der Betreiber hat geprüft und die AÜG-Vorprüfungen ausgeführt. |
| Dem Kunden vorgelegt | `releasedToCustomer` | Der Vorschlag ist dem Bedarfsträger zugänglich — **pseudonymisiert**, `releasedToCustomerAt` gesetzt ([22], 6.4). |
| Interview vereinbart | `interviewScheduled` | Der Bedarfsträger will die Person kennenlernen; `interviewScheduledAt` ist gesetzt. |
| Zugesagt | `accepted` | Fachliche Zusage des Kunden; `decision = accepted`. Offenlegungsstufe wechselt auf `identified` (6.4). **Endzustand.** |
| Abgelehnt | `rejected` | Absage; `decisionReason` Pflicht, **ohne** Bezug auf ein fremdes Angebot (2.3, Regel 3). **Endzustand.** |
| Zurückgezogen | `withdrawn` | Der Lieferant zieht den Vorschlag zurück; `withdrawnAt` ist gesetzt. **Endzustand.** |

| Von | Nach | Auslösende Rolle | Vorbedingungen | Nebenwirkungen |
|---|---|---|---|---|
| — | `draft` | `LD` (anlegen) | Eigenes Angebot in `draft`, `submitted` oder `reviewed`; Kandidat vorhanden (3.6); `pseudonym` gesetzt | Derselbe Kandidat darf in mehreren Vorschlägen stehen, mit eigenem Status je Vorschlag (3.13) |
| `draft` | `submitted` | `LD` ([20]) | `availableFrom` gesetzt; Offenlegungsstufe `pseudonymized` | Benachrichtigung an `MD`; der Vorschlag wird für den Betreiber sichtbar, für den Kunden **nicht** |
| `submitted` | `reviewed` | `MD` ([17]), `MA` | — | AÜG-Prüfungen P1, P6, P10, P11; Doppelvorschlag desselben Kandidaten wird **nur** beim Betreiber sichtbar (2.3, Regel 4) |
| `reviewed` | `releasedToCustomer` | `MD` ([22]) | Offenlegungsstufe `pseudonymized`; Prüfergebnisse ohne Sperre; Pflichtnachweise im Umfang von 5.4 geprüft | Benachrichtigung an `KB`; `submissionFeedbackDeadlineDays` beginnt; Bedarfsanfrage auf `inSelection` (4.1); **keine** Klardaten an den Kunden (6.4) |
| `releasedToCustomer` | `interviewScheduled` | `KB` ([24]) | — | Benachrichtigung an `MD`, von dort an `LD`; Klardaten bleiben verdeckt, bis die Zusage erfolgt (6.4) |
| `releasedToCustomer`, `interviewScheduled` | `accepted` | `KB` entscheidet ([24]), wirksam gegenüber dem Lieferanten durch `MD` ([17]) | `decision`, `decidedAt`, `decidedBy` gesetzt; P1 ohne Sperre; P6 als Warnung, aber **Sperre** bei fehlender Erklärung zur Vorbeschäftigung; P11 als Warnung (5.3, 5.5.5) | Offenlegungsstufe wechselt auf `identified`, jeder Zugriff auf Klardaten wird protokolliert (3.12, 6.4); Angebot auf `accepted` (4.2.2); Einsatz kann angelegt werden (4.3) |
| `submitted`, `reviewed`, `releasedToCustomer`, `interviewScheduled` | `rejected` | `KB` entscheidet ([24]) bzw. `MD` ([17]) bei Vorgängen, die den Kunden nicht erreicht haben | `decisionReason` Pflicht, ohne Fremdbezug | Benachrichtigung an `LD` über `MD`; Klardaten bleiben verdeckt; Löschfrist für abgelehnte Kandidaten läuft (6.5) |
| `draft`, `submitted`, `reviewed`, `releasedToCustomer`, `interviewScheduled` | `withdrawn` | `LD` ([20]) | Vorschlag noch nicht `accepted` | Benachrichtigung an `MD` und `KB`; Bedarfsanfrage bleibt in `inSelection`, solange ein anderer Vorschlag offen ist |

**Abschluss offener Vorschläge.** Erreicht die Bedarfsanfrage `filled`,
`cancelled` oder `expired` (4.1), setzt `MD` die noch offenen Vorschläge auf
`rejected` mit einer Begründung, die den Anlass nennt („Anfrage anderweitig
besetzt", „Bedarf entfallen", „Frist abgelaufen") und **keinen** Hinweis auf
ein fremdes Angebot enthält. Das ist ein Übergang mit Auslöser, kein
Zeitablauf (4.0, Regel 4).

**Endzustände:** `accepted`, `rejected`, `withdrawn`. Der Profilvorschlag hat
**keinen** Zustand `expired`: eine ausbleibende Entscheidung läuft nie ab, sie
wird eskaliert (2.4) und am Ende mit Begründung abgelehnt.

**Ausgeschlossen:**

- **Kein** `accepted` → `rejected`. Wird die Zusage hinfällig, ist das die
  vorzeitige Beendigung des Einsatzes (4.3).
- **Keine** Zusage durch den Betreiber. Die fachliche Auswahl ist eine
  Kundenentscheidung ([24], 2.4 Regel 3); `MD` führt nur den Status gegenüber
  dem Lieferanten.
- **Kein** `releasedToCustomer` ohne Pseudonymisierung. Der Übergang **ist**
  die Umsetzung der Datenminimierung (6.4); eine Vorlage mit Klardaten ist kein
  Sonderfall, sondern unzulässig.
- **Kein** zeitgesteuerter Übergang nach `rejected`. Eine ausbleibende
  Rückmeldung des Kunden wird eskaliert (2.4), nicht entschieden.
- **Kein** Übergang, der einem Lieferanten einen Doppelvorschlag desselben
  Kandidaten offenbart (2.3, Regel 4).

```mermaid
stateDiagram-v2
    [*] --> draft : anlegen (LD)
    draft --> submitted : vorlegen (LD)
    submitted --> reviewed : sichten und pruefen (MD)
    reviewed --> releasedToCustomer : pseudonymisiert vorlegen (MD)
    releasedToCustomer --> interviewScheduled : Interview (KB)
    releasedToCustomer --> accepted : zusagen (KB, wirksam MD)
    interviewScheduled --> accepted : zusagen (KB, wirksam MD)
    submitted --> rejected : ablehnen (MD)
    reviewed --> rejected : ablehnen (MD)
    releasedToCustomer --> rejected : ablehnen (KB)
    interviewScheduled --> rejected : ablehnen (KB)
    draft --> withdrawn : zurueckziehen (LD)
    submitted --> withdrawn : zurueckziehen (LD)
    reviewed --> withdrawn : zurueckziehen (LD)
    releasedToCustomer --> withdrawn : zurueckziehen (LD)
    interviewScheduled --> withdrawn : zurueckziehen (LD)
    accepted --> [*]
    rejected --> [*]
    withdrawn --> [*]
```

#### AÜG-Prüfungen (→ Kapitel 5)

| Übergang | Prüfung | Kapitel |
|---|---|---|
| Einladung → `invited` | P9 Erlaubnis des Lieferanten gültig und anerkannt | 5.4 |
| Profilvorschlag `submitted` → `reviewed` | P1 bisher angerechnete Dauer dieser Person bei diesem Kunden; P6 Drehtürklausel; P10 Pflichtnachweise des Kandidaten; P11 Arbeitsverhältnis beim Verleiher | 5.1, 5.3, 5.4 |
| Profilvorschlag `reviewed` → `releasedToCustomer` | Keine AÜG-Prüfung — hier greift die Datenminimierung (6.4) | 6.4 |
| Profilvorschlag → `accepted` | P1 mit Sperrwirkung; P6 und P11 als Warnung — P6 sperrt nur, wenn die Erklärung zur Vorbeschäftigung fehlt (5.3.1, 5.3.4, 5.5.5) | 5.1, 5.3 |

**Grundlage von P1 und P6.** Beide Prüfungen setzen voraus, dass der Betreiber
erkennt, ob zwei Kandidatensätze dieselbe Person betreffen (`workerIdentity`,
3.6). Das ist entschieden und damit tragfähig. Zu beachten: ein nur
**maschinell vorgeschlagener**, noch nicht bestätigter Treffer löst keine
Prüfung aus — bis zur Bestätigung zählt der Kandidatensatz als eigene Person.
Die Übergänge dieses Abschnitts bleiben davon unberührt.

### 4.3 Einsatz und Verlängerung

Zwei Modelle: der Einsatz (`assignment`, 3.7) und die Verlängerung
(`assignmentExtension`, 3.7). Beide teilen die Matrixzeile „Einsatz,
Verlängerung, Unterbrechung (3.7)" in 2.2.

#### 4.3.1 Einsatz

| Deutsch | Bezeichner | Fachliche Bedeutung |
|---|---|---|
| Geplant | `planned` | Der Einsatz ist angelegt und terminiert, die Überlassung hat nicht begonnen. `plannedStartDate` liegt in der Zukunft oder der Start ist noch nicht bestätigt. |
| Aktiv | `active` | Die Überlassung läuft; `actualStartDate` ist gesetzt. Der Fristenlauf nach 5.1 und 5.2 läuft. |
| Unterbrochen | `interrupted` | Eine dokumentierte Unterbrechung (3.7) läuft; es wird keine Arbeitsleistung erbracht. Das Arbeitsverhältnis beim Verleiher bleibt unberührt. |
| Beendet | `completed` | Die Überlassung ist zum vorgesehenen Ende abgelaufen; `actualEndDate` ist gesetzt. **Endzustand.** |
| Vorzeitig beendet | `terminatedEarly` | Die Überlassung endet vor dem geplanten Ende; `terminationReason` und `terminationRequestedBy` sind Pflicht. **Endzustand.** |

**„Verlängert" ist kein Zustand des Einsatzes.** Die Gliederung dieses Kapitels
nannte „verlängert" als Zustand. Das ist in der Ausarbeitung bewusst anders
gelöst: eine wirksame Verlängerung verschiebt `plannedEndDate` und lässt den
Einsatz in seinem Zustand (`planned` oder `active`). Der Vorgang selbst hat
seinen eigenen Lebenszyklus (4.3.2) — so bleibt sichtbar, ob eine Verlängerung
beantragt, genehmigt oder wirksam ist, ohne den Einsatz aus `active`
herauszunehmen und damit Zeiterfassung und Fristenlauf zu unterbrechen.

**Der Antrag auf vorzeitige Beendigung ist kein Zustand.** Ein offener Antrag
ändert am Einsatz nichts: er läuft weiter, Zeiten werden weiter erfasst, der
Fristenlauf läuft weiter. Erst die Wirksamkeit führt nach `terminatedEarly`.
Das ist die Anwendung von 2.4 Regel 1 — ein unentschiedener Vorgang bewirkt
nichts (siehe auch den Hinweis am Ende dieses Abschnitts).

| Von | Nach | Auslösende Rolle | Vorbedingungen | Nebenwirkungen |
|---|---|---|---|---|
| — | `planned` | `MD`, `MA` | Profilvorschlag in `accepted` (4.2.3) oder Einsatz ohne vorangegangene Anfrage; Lieferant `active` (4.6); eigene `activityDescription` (nicht nur ein Verweis, 5.3.3); vereinbarte Preisposition beider Seiten; P1, P8 und P9 ohne Sperre; P6 ohne Sperre, also mit vorliegender Erklärung zur Vorbeschäftigung; P11 als Warnung zulässig (5.3, 5.5.5) | Benachrichtigung an `KB`, `KE` und `LD`; abgeleitete Felder `maxDurationEndDate`, `equalPayDueDate`, `countedDurationDays` werden berechnet (5.1, 5.2); Bedarfsanfrage ggf. auf `filled` (4.1) |
| `planned` | `active` | `MD` | `actualStartDate` gesetzt; P9 Erlaubnis gültig; P10 Pflichtnachweise vorhanden; P7 kein Arbeitskampf am Standort oder Zusicherung nach § 11 Abs. 5 Satz 2 (5.3.2); P1 Fristende nicht überschritten; P8 Konkretisierung vollständig und rechtzeitig (5.3.3); P11 Arbeitsverhältnis besteht am ersten Überlassungstag (5.3.4); P4 Vergleichsentgelt vorhanden, soweit Equal Pay ab dem ersten Tag geschuldet ist (5.2) | **Fristenlauf beginnt** (5.1, 5.2); Stundenzettel für die laufende Abrechnungsperiode wird erwartet (4.4); Benachrichtigung an `KB` und `LD` |
| `active` | `interrupted` | `MD`, auf Anzeige von `LD` oder `KB` ([25]) | Unterbrechung (3.7) mit `interruptionFrom` und Grund angelegt | Zeiterfassung für den Unterbrechungszeitraum gesperrt (4.4); P2 bewertet die Wirkung auf die Zählung (`countsAsReset`, 5.1); Benachrichtigung an beide Seiten |
| `interrupted` | `active` | `MD` | `interruptionTo` gesetzt; P9 Erlaubnis weiterhin gültig; P7 kein Arbeitskampf; P1 Fristende am Wiederaufnahmetag nicht erreicht — sonst **Sperre** (5.5.5, Q26) | P1 und P2 werden neu gerechnet — eine Unterbrechung von mehr als drei Monaten setzt die Zählung zurück (5.1.4); `maxDurationEndDate` wird neu abgeleitet; Benachrichtigung |
| `active` | `completed` | `MD` | `plannedEndDate` erreicht; `actualEndDate` gesetzt; keine laufende Unterbrechung | Keine neuen Zeitpositionen möglich (4.4); offene Stundenzettel müssen eingereicht und genehmigt werden; Fristenlauf endet; Löschfrist für den beendeten Einsatz beginnt (6.5) |
| `planned`, `active`, `interrupted` | `terminatedEarly` | `MD` setzt wirksam; Antrag durch `KB` oder `LD` ([25]); Genehmigung durch `KG` ([26]) **nur** bei Antrag der Kundenseite | `terminationReason` und `terminationRequestedBy` Pflicht; bei Kundenantrag Genehmigung `KG` vorhanden; `actualEndDate` gesetzt | Wie `completed`; zusätzlich Benachrichtigung an die jeweils andere Seite mit Begründung; eine Nachbesetzung ist eine **neue** Bedarfsanfrage (4.1) |

**Zuweisung der Genehmigung (Festlegung dieses Kapitels).** Fußnote [26] in 2.2
weist `KG` die Genehmigung von Verlängerung und vorzeitiger Beendigung zu,
„soweit Kapitel 4.3 sie der Kundenseite zuweist". Dieses Kapitel weist zu:

- **Verlängerung:** immer genehmigungspflichtig durch `KG`, unabhängig davon,
  wer sie beantragt — sie erzeugt Kosten beim Kunden (4.3.2).
- **Vorzeitige Beendigung auf Antrag der Kundenseite:** genehmigungspflichtig
  durch `KG`, weil Mindestlaufzeiten und Kündigungsfristen Kostenwirkung haben.
- **Vorzeitige Beendigung auf Antrag des Lieferanten:** **keine** Genehmigung
  der Kundenseite. Der Verleiher entscheidet über den Einsatz seines
  Arbeitnehmers; der Kunde wird unterrichtet, nicht gefragt.
- **Vorzeitige Beendigung aus Rechtsgründen** (entzogene Erlaubnis,
  AÜG-Sperre): `MD` setzt sie mit Pflichtbegründung wirksam. **Ob** ein
  laufender Einsatz bei Erlöschen der Erlaubnis zu beenden ist, entscheidet
  **5.4.2 b)**: Das System beendet ihn **nicht** selbst — es sperrt neue
  Überlassungen, erzeugt eine Warnung mit Pflicht-Eskalation und hält diesen
  Übergang bereit. Welche Rechtsfolge im Einzelnen greift, ist *offene
  Frage 29*.

**Endzustände:** `completed`, `terminatedEarly`.

**Ausgeschlossen:**

- **Kein** `completed` oder `terminatedEarly` → `active`. Eine erneute
  Überlassung derselben Person beim selben Kunden ist ein **neuer** Einsatz —
  und zählt nach 5.1 weiter, statt neu zu beginnen.
- **Kein** `planned` → `completed`. Ein Einsatz, der nie begonnen hat, wird
  `terminatedEarly` mit Begründung; so bleibt erkennbar, dass keine
  Arbeitsleistung erbracht wurde.
- **Kein** Zustand `blocked`. Eine AÜG-Sperre verhindert den Übergang nach
  `active` oder die Wirksamkeit einer Verlängerung; der Einsatz bleibt stehen
  (4.0, Regel 5).
- **Kein** zeitgesteuerter Übergang nach `active`. Der Beginn wird bestätigt,
  nicht unterstellt — sonst beginnt der Fristenlauf nach 5.1 für eine
  Überlassung, die es nicht gibt.
- **Kein** zeitgesteuerter Übergang nach `completed`. Das Erreichen von
  `plannedEndDate` erzeugt eine Erinnerung; das tatsächliche Ende wird
  festgestellt, weil `actualEndDate` die Grundlage der Abrechnung und des
  Fristenlaufs ist.
- **Keine** stille Verlängerung. Das Verschieben von `plannedEndDate` ohne
  Verlängerungsvorgang ist unzulässig (3.7).
- **Kein** `interrupted` → `completed` ohne Wiederaufnahme. Endet der Einsatz
  während einer Unterbrechung, ist das `terminatedEarly`.

```mermaid
stateDiagram-v2
    [*] --> planned : anlegen (MD)
    planned --> active : Beginn bestaetigen (MD)
    active --> interrupted : unterbrechen (MD)
    interrupted --> active : fortsetzen (MD)
    active --> completed : regulaer beenden (MD)
    planned --> terminatedEarly : vorzeitig beenden (MD)
    active --> terminatedEarly : vorzeitig beenden (MD)
    interrupted --> terminatedEarly : vorzeitig beenden (MD)
    completed --> [*]
    terminatedEarly --> [*]
```

#### 4.3.2 Verlängerung

| Deutsch | Bezeichner | Fachliche Bedeutung |
|---|---|---|
| Beantragt | `requested` | Der Antrag liegt vor; `requestedAt` / `requestedBy` gesetzt. Der Einsatz läuft unverändert. |
| Genehmigt | `approved` | Die Kundenseite hat zugestimmt; `approvedAt` / `approvedBy` gesetzt. Noch **nicht** wirksam. |
| Abgelehnt | `rejected` | Die Kundenseite lehnt ab. **Endzustand.** |
| Wirksam | `effective` | Der Betreiber hat die Verlängerung vollzogen; `effectiveAt` / `effectiveBy` gesetzt und `plannedEndDate` des Einsatzes verschoben. **Endzustand.** |
| Zurückgezogen | `withdrawn` | Der Antragsteller zieht zurück. **Endzustand.** |

| Von | Nach | Auslösende Rolle | Vorbedingungen | Nebenwirkungen |
|---|---|---|---|---|
| — | `requested` | `KB` ([25]), `LD` ([25]), `MD` | Einsatz in `planned`, `active` oder `interrupted`; `newEndDate` nach dem bisherigen Ende; Begründung Pflicht | Benachrichtigung an `KG`; `extensionApprovalDeadlineDays` beginnt; AÜG-Vorprüfungen P1 und P3 als `ruleCheckResult` am Vorgang |
| `requested` | `approved` | `KG` ([26]) | Auslöser ist nicht `requestedBy` (2.4, Regel 5); Kostenwirkung beurteilt ([8]) | Benachrichtigung an `MD` und den Antragsteller; Frist endet |
| `requested` | `rejected` | `KG` ([26]) | Begründung Pflicht | Benachrichtigung an den Antragsteller; der Einsatz endet zum unveränderten `plannedEndDate` |
| `requested` | `withdrawn` | Antragsteller (`KB`, `LD` oder `MD`) | Noch nicht genehmigt | Benachrichtigung an `KG` |
| `approved` | `effective` | `MD` | P1 `newEndDate` innerhalb von `maxDurationEndDate` — sonst **Sperre** (5.1, 5.5); P9 Erlaubnis für den verlängerten Zeitraum gültig; P3 Equal-Pay-Fälligkeit geprüft | `plannedEndDate` des Einsatzes wird verschoben; `maxDurationEndDate` und `equalPayDueDate` werden neu abgeleitet; Benachrichtigung an alle Beteiligten; Protokolleintrag am Einsatz **und** am Vorgang |

**Endzustände:** `effective`, `rejected`, `withdrawn`.

**Ausgeschlossen:**

- **Kein** `requested` → `effective`. Ohne kundenseitige Genehmigung wird keine
  Verlängerung wirksam — der Betreiber ersetzt die Entscheidung nicht (2.4,
  Regel 3).
- **Kein** `approved` → `rejected`. Eine genehmigte, aber nicht gewollte
  Verlängerung wird nicht wirksam gesetzt und läuft über die Frist aus; der
  Vorgang bleibt in `approved` und ist dokumentiert.
- **Kein** zeitgesteuerter Übergang nach `approved` oder `effective`.
  Fristablauf verlängert nichts (2.4, Regel 1).
- **Keine** Verlängerung über `maxDurationEndDate` hinaus ohne dokumentierte
  Übersteuerung nach 5.5 *(offene Frage 10)*.
- **Keine** Rückgängigmachung einer wirksamen Verlängerung. Das verkürzte Ende
  ist eine vorzeitige Beendigung (4.3.1).

```mermaid
stateDiagram-v2
    [*] --> requested : beantragen (KB, LD, MD)
    requested --> approved : genehmigen (KG)
    requested --> rejected : ablehnen (KG)
    requested --> withdrawn : zurueckziehen (Antragsteller)
    approved --> effective : wirksam setzen (MD)
    effective --> [*]
    rejected --> [*]
    withdrawn --> [*]
```

#### AÜG-Prüfungen (→ Kapitel 5)

| Übergang | Prüfung | Kapitel |
|---|---|---|
| → `planned` | P1 Höchstüberlassungsdauer über alle Vorläufer derselben Person beim selben Kunden; P6 Drehtürklausel; P8 Kennzeichnung und Konkretisierung (Q45); P9 Erlaubnis; P11 Arbeitsverhältnis beim Verleiher; P4 Vergleichsentgelt vorhanden; P5 Branchenzuschlagsschema zugeordnet | 5.1–5.4 |
| `planned` → `active` | P9 Erlaubnis am Starttag; P10 Pflichtnachweise; P7 Arbeitskampf am Standort; P1 Fristende nicht erreicht; P8 Konkretisierung rechtzeitig und vollständig (Q46); P11 Arbeitsverhältnis am ersten Überlassungstag (Q47); P4 Vergleichsentgelt, wenn Equal Pay ab dem ersten Tag geschuldet ist (Q48) | 5.4, 5.3, 5.1, 5.2 |
| `active` → `interrupted` | P2 Erfassung der Unterbrechung für die Zählung | 5.1 |
| `interrupted` → `active` | P2 Bewertung der Unterbrechungsdauer (Zurücksetzen der Zählung); P1 Neuberechnung **mit Sperrwirkung**, wenn das Fristende erreicht ist (Q26) | 5.1 |
| Verlängerung `requested` → `approved` | P1 und P3 als Vorschau, damit die Kundenseite die Fristwirkung kennt | 5.1, 5.2 |
| Verlängerung `approved` → `effective` | P1 mit Sperrwirkung; P9 für den verlängerten Zeitraum; P3 / P4 Equal Pay | 5.1, 5.4, 5.2 |
| `active` → `completed` / `terminatedEarly` | P1 und P3 Abschlussrechnung der Fristen (Dokumentation, keine Sperre) | 5.1, 5.2 |

> **Hinweis auf eine Lücke in 3.7.** Die Verlängerung ist ein eigenes Objekt mit
> Antrag, Genehmigung und Wirksamkeit. Die vorzeitige Beendigung ist das
> **nicht**: 3.7 führt sie als Felder am Einsatz (`terminationReason`,
> `terminationRequestedBy`). Ein beantragter, noch nicht entschiedener
> Beendigungsvorgang hat deshalb keinen eigenen Zustand und ist nur über das
> Feld und die Eskalation sichtbar. Für den Prototyp genügt das; wird eine
> mehrstufige Genehmigung der Beendigung gewünscht, ist in 3.7 ein eigener
> Vorgang analog `assignmentExtension` nachzutragen.

### 4.4 Stundenzettel und Freigabeschritte

Objekte: `timesheet` und `timesheetApproval` (3.8). Matrixzeile „Stundenzettel,
Freigabeschritt (3.8)" in 2.2; der Freigabeschritt teilt die Zeile.

> **Abhängigkeit von offener Frage 5.** Wie viele Genehmigungsstufen es gibt und
> welche Rolle welche Stufe trägt, ist offen. Dieses Modell ist deshalb so
> gebaut, dass die **Stufenzahl in den Daten steht, nicht im Statusmodell**: die
> Zustände und Übergänge unten gelten für eine wie für fünf Stufen. Was sich mit
> der Antwort ändert, ist allein der Inhalt von `assignedRoleCode` je
> `timesheetApproval` (3.8) — kein Zustand, kein Übergang, keine Nebenwirkung.
> Die betroffenen Stellen sind mit *(offene Frage 5)* gekennzeichnet.

#### Zustände

| Deutsch | Bezeichner | Fachliche Bedeutung |
|---|---|---|
| Erfasst | `recorded` | Zeiten werden erfasst oder nachgearbeitet. Der **einzige** Zustand, in dem Zeitpositionen frei angelegt, geändert und entfernt werden dürfen ([44]). |
| Eingereicht | `submitted` | Der Zettel liegt zur Genehmigung vor; `submittedAt` / `submittedBy` gesetzt. Keine Änderung durch die erfassende Seite mehr. |
| In Prüfung | `inApproval` | Mindestens ein Freigabeschritt ist offen. Bei mehreren Stufen bleibt der Zettel so lange hier, bis die letzte Stufe entschieden ist *(offene Frage 5)*. |
| Genehmigt | `approved` | Alle Stufen haben zugestimmt; `approvedAt` / `approvedBy` tragen die **letzte** Stufe. Grundlage für Abrechnungsbelege (4.5). |
| Abgelehnt | `rejected` | Eine Stufe hat abgelehnt; `rejectionReason` ist Pflicht. Der Zettel ist zur Nacharbeit freigegeben. |
| Korrigiert | `corrected` | Eine genehmigte Korrekturfassung hat diesen Zettel ersetzt (`correctionOf` am neuen Zettel). **Endzustand.** |

**Die Zeitposition trägt keinen Status** (Fußnote [44] in 2.2). Genehmigt wird
der Zettel; die Zeitpositionen folgen seinem Zustand.

#### Übergänge

| Von | Nach | Auslösende Rolle | Vorbedingungen | Nebenwirkungen |
|---|---|---|---|---|
| — | `recorded` | `AN` *(offene Frage 4)*, `LD` im Namen des Leiharbeitnehmers ([27]), `MD` ([27]) | Einsatz in `active`, `interrupted`, `completed` oder `terminatedEarly`; Abrechnungsperiode `open` (4.5); je Einsatz und Periode genau **ein** Zettel (3.13) | `recordedBy` wird gesetzt; `timesheetSubmissionDeadlineDays` beginnt mit dem Periodenende |
| `recorded` | `submitted` | `AN` *(offene Frage 4)*, `LD` ([20]), `MD` | Mindestens eine Zeitposition; Summen abgeleitet; Zeitpositionen liegen innerhalb `periodFrom` / `periodTo` und außerhalb einer laufenden Unterbrechung (4.3) | Freigabeschritte werden nach der konfigurierten Stufenfolge erzeugt *(offene Frage 5)*; Benachrichtigung an die Rolle der ersten Stufe; AÜG-Prüfungen P1 und P4 |
| `submitted` | `inApproval` | System | Mindestens ein Freigabeschritt vorhanden | Erste Stufe wird geöffnet; `timesheetApprovalDeadlineDays` läuft gegen `closingDate` der Periode (4.5) |
| `inApproval` | `inApproval` | Rolle der offenen Stufe — `KB` oder `KG` ([29]) *(offene Frage 5)* | Entscheidung `approved` am Freigabeschritt; weitere Stufen offen | Nächste Stufe wird geöffnet; Benachrichtigung an deren Rolle; **kein** Statuswechsel des Zettels |
| `inApproval` | `approved` | Rolle der **letzten** Stufe ([29]) *(offene Frage 5)* | Alle Stufen `approved`; P4 ohne Sperre (Q36); P1 als **Warnung mit Pflicht-Eskalation** zulässig — Zeiten nach Fristende sperren die Genehmigung nicht, weil sie erbracht sind (5.5.5, Q35) | `approvedAt` / `approvedBy` gesetzt; Zeitpositionen sind gesperrt — Änderungen nur über eine Korrekturfassung ([28]); der Zettel wird für die Belegerstellung verfügbar (4.5); Benachrichtigung an `MD` und `LD` |
| `inApproval` | `rejected` | Rolle einer offenen Stufe ([29]) *(offene Frage 5)* | `rejectionReason` Pflicht | Noch offene Stufen entfallen; Benachrichtigung an die erfassende Seite mit Begründung; Protokolleintrag mit Begründung |
| `rejected` | `recorded` | `AN` *(offene Frage 4)*, `LD`, `MD` | Abrechnungsperiode noch `open` (4.5) | Vorhandene Freigabeschritte werden verworfen und bei der nächsten Einreichung neu erzeugt; Korrekturen tragen Begründung und Protokolleintrag ([28]) |
| `approved` | `corrected` | System, als Folge der Genehmigung einer Korrekturfassung | Neuer Zettel mit `correctionOf` auf diesen Zettel ist `approved` | Belegpositionen, die auf diesem Zettel beruhen, sind zu stornieren und neu zu erstellen (4.5); Benachrichtigung an `KE` bzw. `LD` |

**Korrekturen nach der Genehmigung.** Ein genehmigter Zettel wird nie wieder
geändert. Die Korrektur ist ein **neuer** Zettel mit `correctionOf` (3.8), der
den vollen Zyklus `recorded` → `submitted` → `inApproval` → `approved`
durchläuft. Erst seine Genehmigung setzt den alten Zettel auf `corrected`. Die
Regel „ein Zettel je Einsatz und Periode" (3.13) ist dadurch nicht verletzt:
genau ein Zettel ist zu jedem Zeitpunkt der **gültige**, die Korrekturfassungen
bilden eine Kette.

**Endzustände:** `corrected`. `approved` ist ein Ruhezustand: endgültig, solange
keine Korrekturfassung genehmigt wird.

**Ausgeschlossen:**

- **Kein** `recorded` → `approved`. Einreichen und Genehmigen sind getrennt.
- **Keine** Genehmigung durch die erfassende Seite. Wer den Zettel eingereicht
  hat, genehmigt ihn nicht — auch nicht in Vertretung (2.4, Regel 5). Das
  schließt insbesondere `LD` und `AN` von jeder Freigabestufe aus.
- **Keine** Genehmigung durch den Betreiber. `MD` darf erfassen und korrigieren
  ([27], [28]), aber keine Stufe entscheiden: die Zeitfreigabe ist eine
  Kundenentscheidung (2.1, 2.4 Regel 3).
- **Kein** Übergang durch Fristablauf. Ein nicht genehmigter Zettel wird mit
  Erreichen von `closingDate` eskaliert und bleibt in `inApproval`; er gilt
  **nicht** als genehmigt (2.4, Regel 1). Er kann dadurch die Abrechnung
  blockieren — das ist beabsichtigt.
- **Kein** `approved` → `recorded` und **kein** `approved` → `rejected`.
  Nachträgliche Änderungen laufen ausschließlich über die Korrekturfassung.
- **Kein** `corrected` → irgendwohin. Der ersetzte Zettel bleibt als Beleg der
  Historie stehen.
- **Keine** Erfassung von Zeiten für einen Zeitraum, in dem der Einsatz
  `interrupted` war, und keine Erfassung in einer geschlossenen
  Abrechnungsperiode (4.5).

#### Diagramm

```mermaid
stateDiagram-v2
    [*] --> recorded : erfassen (AN, LD, MD)
    recorded --> submitted : einreichen (AN, LD, MD)
    submitted --> inApproval : Freigabeschritte eroeffnen (System)
    inApproval --> inApproval : Stufe genehmigt, weitere offen (KB, KG)
    inApproval --> approved : letzte Stufe genehmigt (KB, KG)
    inApproval --> rejected : ablehnen (KB, KG)
    rejected --> recorded : nacharbeiten (AN, LD, MD)
    approved --> corrected : Korrekturfassung genehmigt (System)
    corrected --> [*]
```

#### AÜG-Prüfungen (→ Kapitel 5)

| Übergang | Prüfung | Kapitel |
|---|---|---|
| `recorded` → `submitted` | P1 liegen Zeiten nach `maxDurationEndDate` im Zettel? P4 ist für den Zeitraum ein Vergleichsentgelt hinterlegt? | 5.1, 5.2 |
| `submitted` → `inApproval` | P3 Equal-Pay-Fälligkeit im Zeitraum erreicht? | 5.2 |
| `inApproval` → `approved` | P1 als Warnung mit Pflicht-Eskalation für Zeiten nach Fristende (**geändert**, 5.5.5); P4 Vergleichsentgelt bei erreichter Fälligkeit **mit Sperrwirkung**; P10 Unterweisungsnachweis für den Standort als Warnung | 5.1, 5.2, 5.4 |

### 4.5 Abrechnungsperiode und Abrechnungsbeleg

Zwei Modelle: die Abrechnungsperiode (`billingPeriod`, 3.9) und der
Abrechnungsbeleg (`billingDocument`, 3.9). Die Belegposition teilt die
Matrixzeile des Belegs.

> **Entschieden (vormals offene Frage 6).** Die Lieferantenseite läuft im
> **Gutschriftverfahren**: der Betreiber erstellt `supplierCreditNote`, der
> Lieferant bestätigt oder beanstandet. Für den Prototyp sind damit nur die
> Varianten **Verkauf** und **Einkauf A** umzusetzen. Die Spalte
> „Seite / Variante" der Übergangstabelle führt **Einkauf B**
> (Rechnungseingang) weiter mit, weil die Zustände identisch sind und sich nur
> die auslösende Rolle unterscheidet — als dokumentierte, nicht umgesetzte
> Variante.

#### 4.5.1 Abrechnungsperiode

| Deutsch | Bezeichner | Fachliche Bedeutung |
|---|---|---|
| Offen | `open` | Zeiten dürfen erfasst, eingereicht und genehmigt werden; Belege dürfen entstehen. |
| Geschlossen | `closed` | Die Periode ist abgeschlossen; keine neuen Zettel und keine neuen Belege zu dieser Periode. **Endzustand.** |

| Von | Nach | Auslösende Rolle | Vorbedingungen | Nebenwirkungen |
|---|---|---|---|---|
| — | `open` | `MA` (anlegen), `MD` öffnet ([33]) | `periodFrom`, `periodTo` und `closingDate` gesetzt; keine überlappende offene Periode für denselben Kunden | Stundenzettel können angelegt werden (4.4); Benachrichtigung an `LD` der beteiligten Lieferanten |
| `open` | `closed` | `MD` ([33]), `MA` | Kein Stundenzettel der Periode in `recorded`, `submitted` oder `inApproval`; alle Belege der Periode in `released`, `confirmed` oder `cancelled` — *(offene Frage 24)* | Keine neuen Zettel und Belege; `closedAt` / `closedBy` gesetzt; Benachrichtigung an `KE` und `LD` |

**Ausgeschlossen:**

- **Kein** `closed` → `open`. Nachträgliche Zeiten laufen über eine
  Korrekturfassung (4.4) in der **nächsten** offenen Periode, nachträgliche
  Beträge über Storno und Nachbeleg (4.5.2). Ein Wiederöffnen wäre eine
  Änderung dieses Kapitels, kein Sonderfall im Betrieb.
- **Kein** Schließen durch Fristablauf. Das Erreichen von `closingDate` erzeugt
  Erinnerung und Eskalation (2.4), nicht den Übergang.

```mermaid
stateDiagram-v2
    [*] --> open : anlegen und oeffnen (MA, MD)
    open --> closed : schliessen (MD, MA)
    closed --> [*]
```

> *(offene Frage 24, neu)* Darf eine Abrechnungsperiode geschlossen werden,
> solange einzelne Stundenzettel nicht entschieden sind, und wer trägt diese
> Entscheidung? Die Vorbedingung oben verlangt heute, dass **alle** Zettel
> entschieden sind — das ist die strenge Folge aus 2.4 Regel 1 (kein
> Statuswechsel durch Fristablauf), hat aber den Preis, dass ein einzelner
> hängender Zettel die Abrechnung der ganzen Periode aufhält. Die Alternative
> (Schließen mit Übertrag der offenen Zettel in die nächste Periode) ist eine
> kaufmännische Festlegung und wird hier **nicht** geraten.

#### 4.5.2 Abrechnungsbeleg

| Deutsch | Bezeichner | Fachliche Bedeutung |
|---|---|---|
| Erstellt | `created` | Der Beleg ist aus genehmigten Stundenzetteln erzeugt, aber nicht abgegeben. Eine inhaltliche Änderung kann nur `MA` vornehmen — `MD` trägt in 2.2 kein `Ä` auf dieser Zeile; der Regelfall ist Storno und Neuerstellung. |
| In Prüfung | `inReview` | Der Beleg wird geprüft: auf der Verkaufsseite betreiberintern vor der Freigabe, auf der Einkaufsseite in Variante B die eingegangene Lieferantenrechnung. |
| Freigegeben | `released` | Vier-Augen-Freigabe erfolgt ([30]); der Beleg gilt als abgegeben. Auf der Verkaufsseite der Ruhezustand, solange keine Beanstandung erfolgt. |
| Beanstandet | `disputed` | Die Gegenseite widerspricht; `disputeReason`, `disputedAt` / `disputedBy` Pflicht. Eskalationsanlass (2.4). |
| Bestätigt | `confirmed` | Die Gegenseite hat ausdrücklich bestätigt ([32]). **Nur auf der Einkaufsseite** — die Verkaufsseite kennt keine Bestätigung. **Endzustand.** |
| Storniert | `cancelled` | Der Beleg ist aufgehoben; der Storno erzeugt einen **neuen** Beleg mit `cancellationOf` (3.9). **Endzustand.** |

| Von | Nach | Seite / Variante | Auslösende Rolle | Vorbedingungen | Nebenwirkungen |
|---|---|---|---|---|---|
| — | `created` | Verkauf, Einkauf A | `MD`, `MA` | Alle zugrunde liegenden Stundenzettel in `approved` (3.9, 4.4); Abrechnungsperiode `open`; Preisposition der jeweiligen Seite vorhanden (3.3) | Belegpositionen werden aus den Zetteln abgeleitet; `createdBy` gesetzt; AÜG-Prüfungen P9 und P4 als Warnung |
| — | `created` | **Einkauf B** *(nicht umgesetzt)* | `LD` — Recht `A` in 2.2 erst nachzutragen, siehe Hinweis | Wie oben; der Lieferant reicht die Rechnung zu genehmigten Zetteln ein | Benachrichtigung an `MD` |
| `created` | `inReview` | alle | `MD`, `MA`; in Variante B prüft `MD` die Lieferantenrechnung | Summen abgeleitet und mit den Zetteln abgeglichen | Keine inhaltliche Änderung mehr ohne Protokolleintrag |
| `inReview` | `released` | alle | `MD`, `MA` | Auslöser ist **nicht** `createdBy` ([30], 2.4 Regel 5) | `releasedAt` / `releasedBy` gesetzt; Beleg wird für die Gegenseite sichtbar; `billingReviewDeadlineDays` beginnt; Benachrichtigung an `KE` bzw. `LD` |
| `released` | `disputed` | Verkauf | `KE` ([31]) | `disputeReason` Pflicht; innerhalb der Prüffrist | Benachrichtigung an `MD`; Eskalationsanlass „Beleg beanstandet und nicht geklärt" (2.4) |
| `released` | `disputed` | Einkauf A, Einkauf B | `LD` ([32]) | Wie oben | Wie oben |
| `released` | `confirmed` | Einkauf A, Einkauf B | `LD` ([32]) | Keine offene Beanstandung | Beleg ist abgeschlossen; Übergabe an ein Fremdsystem nach *(offener Frage 7)* |
| `disputed` | `inReview` | alle | `MD`, `MA` | Beanstandung geklärt, Klärung dokumentiert; wenn sich die Zeiten ändern: Korrekturfassung genehmigt (4.4) | Erneute Freigabe erforderlich ([30]); Benachrichtigung an die beanstandende Seite |
| `created`, `inReview`, `released`, `disputed` | `cancelled` | alle | `MD`, `MA` | Begründung Pflicht; bei `released` und `disputed` entsteht ein Storno- und ggf. ein Nachbeleg mit `cancellationOf` (3.9) | Benachrichtigung an die Gegenseite; der stornierte Beleg bleibt erhalten — Belegnummern bleiben lückenlos |

**Endzustände:** `confirmed` (nur Einkaufsseite), `cancelled`. Auf der
Verkaufsseite ist `released` der Ruhezustand: 2.2 gibt `KE` mit [31] nur die
Beanstandung, keine Bestätigung — der Beleg gilt als akzeptiert, solange keine
Beanstandung erfolgt, **ohne** dass ein Übergang das feststellt.

**Ausgeschlossen:**

- **Keine** Freigabe durch den Ersteller. Vier-Augen-Prinzip ([30]).
- **Keine** Bestätigungsfiktion. Der Ablauf von `billingReviewDeadlineDays`
  erzeugt Erinnerung und Eskalation, nie den Übergang nach `confirmed` (2.4,
  Regel 1).
- **Kein** Beleg aus nicht genehmigten Zeiten. `created` setzt ausschließlich
  Zettel in `approved` voraus (3.9).
- **Keine** Änderung eines freigegebenen Belegs. Korrekturen laufen über Storno
  und Nachbeleg; der alte Beleg bleibt (3.9).
- **Kein** Übergang `disputed` → `released` ohne erneute Freigabe. Die Klärung
  führt zurück in die Prüfung, nicht direkt in die Freigabe.
- **Kein** `confirmed` oder `cancelled` → irgendwohin.
- **Keine** Statusführung durch den Lieferanten oder den Kunden über die
  Beanstandung bzw. Bestätigung hinaus ([31], [32]).

```mermaid
stateDiagram-v2
    [*] --> created : erstellen (MD, in Variante B der LD)
    created --> inReview : pruefen (MD)
    inReview --> released : freigeben (MD, nicht der Ersteller)
    released --> disputed : beanstanden (KE bzw. LD)
    released --> confirmed : bestaetigen (LD, nur Einkaufsseite)
    disputed --> inReview : Klaerung (MD)
    created --> cancelled : stornieren (MD, MA)
    inReview --> cancelled : stornieren (MD, MA)
    released --> cancelled : stornieren (MD, MA)
    disputed --> cancelled : stornieren (MD, MA)
    confirmed --> [*]
    cancelled --> [*]
```

#### AÜG-Prüfungen (→ Kapitel 5)

| Übergang | Prüfung | Kapitel |
|---|---|---|
| → `created` (Einkaufsseite) | P9 war die Erlaubnis des Lieferanten im Leistungszeitraum gültig? | 5.4 |
| → `created` (beide Seiten) | P4 war für Zeiträume nach `equalPayDueDate` ein Vergleichsentgelt hinterlegt? | 5.2 |
| `inReview` → `released` | Keine eigene AÜG-Prüfung; die Prüfungen liegen am Stundenzettel (4.4) | — |

> **Erledigt (vormals Lücke in 2.2).** Variante B hätte verlangt, dass der
> Lieferant einen Beleg **anlegen** kann; die Matrix 2.2 gibt `LD` in der Zeile
> „Abrechnungsbeleg, Belegposition (3.9)" nur `L[7] S[32]`, kein `A`. Mit der
> Entscheidung für das Gutschriftverfahren bleibt die Matrix wie sie ist. Wird
> Variante B später doch umgesetzt, ist in 2.2 ein `A[7]` nachzutragen und
> Fußnote [32] um das Einreichen zu erweitern.

### 4.6 Lieferantenstatus

Objekt: `supplier` (3.2). Matrixzeile „Lieferant / Verleiher (3.2)" in 2.2. Die
AÜG-Erlaubnis ist ein eigenes Objekt mit eigenem Nachweisfluss (3.2, 5.4); sie
ist hier **Vorbedingung**, nicht Zustand.

#### Zustände

| Deutsch | Bezeichner | Fachliche Bedeutung |
|---|---|---|
| Onboarding | `onboarding` | Der Lieferant ist angelegt, die Voraussetzungen für eine Beauftragung sind noch nicht vollständig: Rahmenvertrag, Tarifbindung, anerkannte Erlaubnis, Nachweise. Keine Teilnahme am Kernprozess. |
| Aktiv | `active` | Der Lieferant darf eingeladen werden, anbieten, Kandidaten vorschlagen und Einsätze führen. |
| Gesperrt | `blocked` | Die Teilnahme ist ausgesetzt; `blockReason`, `blockedAt` / `blockedBy` Pflicht. Laufende Einsätze sind davon zunächst **nicht** betroffen (siehe unten). |
| Inaktiv | `inactive` | Die Beauftragung ist beendet. Kein neuer Vorgang; die Historie bleibt lesbar. |

`blocked` ist der einzige Zustand dieses Kapitels, der eine Sperre **ist** — er
beschreibt die Organisation. Prüfergebnisse „Sperre" aus 5.5 bleiben dagegen
Prüfergebnisse und erzeugen keinen Zustand (4.0, Regel 5).

#### Übergänge

| Von | Nach | Auslösende Rolle | Vorbedingungen | Nebenwirkungen |
|---|---|---|---|---|
| — | `onboarding` | `MA` | `supplierNumber`, `legalName`, `address`, mindestens ein Ansprechpartner | Lieferantenmandant wird angelegt (3.11); `LA` kann Stammdaten und Nachweise pflegen ([7]) |
| `onboarding` | `active` | `MA` | Rahmenvertrag `active` (3.3); `supplierCollectiveAgreement` gesetzt (3.2, Pflicht ab `active`); AÜG-Erlaubnis mit `verificationStatus = accepted` und gültigem Zeitraum (5.4); Pflichtnachweise vorhanden | Benachrichtigung an `LA` und `LD`; der Lieferant erscheint im Einladungskreis (4.2); AÜG-Prüfungen P9, P10 |
| `active` | `blocked` | `MA`, `MD` ([5]) | `blockReason` Pflicht | **Keine** neue Einladung, kein neues Angebot, kein neuer Profilvorschlag, kein neuer Einsatz; offene Einladungen bleiben stehen und laufen in `expired` (4.2); laufende Einsätze, Zeiterfassung und Abrechnung laufen weiter; Benachrichtigung an `LA`; Eskalation an `MA` |
| `blocked` | `active` | **nur** `MA` ([5]) | Sperrgrund behoben und dokumentiert; Auslöser ist nicht die sperrende Person (Vier-Augen, 2.4 Regel 5); Erlaubnis gültig und anerkannt | Benachrichtigung an `LA` und `LD`; Protokolleintrag mit Aufhebungsgrund |
| `onboarding`, `active`, `blocked` | `inactive` | `MA` | `validTo` gesetzt; kein Einsatz dieses Lieferanten in `planned`, `active` oder `interrupted` | Zugänge des Lieferantenmandanten werden gesperrt (3.11); offene Einladungen und Angebote enden (4.2); Historie und Belege bleiben lesbar; Löschfristen nach 6.5 |
| `inactive` | `active` | **nur** `MA` ([5]) | Reaktivierung: Rahmenvertrag und Erlaubnis wieder gültig und anerkannt; Begründung Pflicht | Wie `onboarding` → `active`; Protokolleintrag mit Reaktivierungsgrund |

**Wirkung auf laufende Einsätze.** Eine Sperre unterbricht oder beendet keinen
laufenden Einsatz. Das ist bewusst so: ein Statuswechsel am Lieferanten darf
nicht still eine Überlassung beenden, die arbeits- und vertragsrechtliche
Folgen hat. **5.4.2 b) hat entschieden**, was bei Erlöschen oder Entzug der
AÜG-Erlaubnis geschieht: das System beendet den laufenden Einsatz **nicht** —
es sperrt Einsatzstart und Verlängerung (Q20, Q31), erzeugt eine Warnung mit
Pflicht-Eskalation an `MD` und `MA` und hält den Übergang `terminatedEarly` aus
Rechtsgründen (4.3.1) bereit. Welche Rechtsfolge im Einzelnen greift und wer die
Beendigung entscheidet, ist *offene Frage 29*.

**Endzustände:** keiner im strengen Sinn. `inactive` ist der Ruhezustand am
Ende der Beauftragung, aus dem `MA` reaktivieren darf ([5]). Das ist die einzige
Ausnahme von 4.0 Regel 9 und steht ausdrücklich in Fußnote [5]
(„Entsperrung und Reaktivierung nur durch MA").

**Ausgeschlossen:**

- **Keine** Entsperrung durch `MD`. [5] sagt ausdrücklich: sperren ja,
  entsperren nein.
- **Keine** Entsperrung oder Reaktivierung durch den Lieferanten selbst. `LA`
  pflegt Stammdaten und Nachweise ([7]), nicht den Status seiner Organisation.
- **Kein** `onboarding` → `blocked` → … als Umweg um die Voraussetzungen.
  Fehlende Nachweise im Onboarding sind keine Sperre, sondern ein noch nicht
  erfüllter Übergang nach `active`.
- **Kein** `inactive` bei laufendem Einsatz. Erst sind die Einsätze zu beenden
  (4.3), dann endet die Beauftragung.
- **Kein** zeitgesteuerter Übergang. Ob der Ablauf der Erlaubnis oder das
  Vertragsende automatisch sperrt, ist in **5.4.2 a) entschieden: nein.** Die
  Wirkung tritt ohne Statuswechsel über P9 ein (jede Einladung, jeder neue
  Einsatz und jeder Einsatzstart sind gesperrt); der nächtliche Lauf stellt den
  Ablauf fest und eskaliert mit dem Vorschlag zu sperren, den Übergang vollzieht
  `MA` oder `MD` mit `blockReason`.
- **Keine** Vertretung für die Entsperrung, soweit sie mit einer Übersteuerung
  einer AÜG-Sperre zusammenfällt (2.4, Regel 8).

#### Diagramm

```mermaid
stateDiagram-v2
    [*] --> onboarding : anlegen (MA)
    onboarding --> active : freischalten (MA)
    active --> blocked : sperren (MA, MD)
    blocked --> active : entsperren (nur MA)
    onboarding --> inactive : Onboarding abbrechen (MA)
    active --> inactive : Beauftragung beenden (MA)
    blocked --> inactive : Beauftragung beenden (MA)
    inactive --> active : reaktivieren (nur MA)
```

#### AÜG-Prüfungen (→ Kapitel 5)

| Übergang | Prüfung | Kapitel |
|---|---|---|
| `onboarding` → `active` | P9 Erlaubnis anerkannt und gültig; P10 Pflichtnachweise vollständig | 5.4 |
| `active` → `blocked` | Die Sperre ist in der Regel das **Ergebnis** einer Prüfung (P9, P10), nicht ihr Anlass | 5.4, 5.5 |
| `blocked` → `active` | P9 und P10 erneut, mit Sperrwirkung | 5.4 |
| `inactive` → `active` | P9 und P10 wie beim erstmaligen Freischalten | 5.4 |

### 4.7 Querschnitt: Statusübergang → AÜG-Prüfung → Ergebnisart

Diese Tabelle ist die Brücke zwischen den Statusmodellen und dem Regelwerk in
Kapitel 5 — und die Vorlage für die Gherkin-Szenarien in `tests/aueg/`. Jede
Zeile ist ein prüfbarer Satz: ein Übergang, eine Prüfung, ein erwartetes
Ergebnis.

#### Die geprüften Regeln

| Kürzel | Prüfung | Bezeichner | Kapitel |
|---|---|---|---|
| P1 | Höchstüberlassungsdauer je Person und Entleiher | `maxDurationCheck` | 5.1 |
| P2 | Unterbrechung und Zurücksetzen der Zählung | `interruptionResetCheck` | 5.1 |
| P3 | Equal-Pay-Frist erreicht | `equalPayDeadlineCheck` | 5.2 |
| P4 | Vergleichsentgelt vorhanden und verwendbar | `comparableWageCheck` | 5.2 |
| P5 | Branchenzuschlagsstufe zutreffend | `industryPremiumCheck` | 5.2 |
| P6 | Drehtürklausel (Vorbeschäftigung beim Entleiher oder im Konzern) | `revolvingDoorCheck` | 5.3 |
| P7 | Einsatzverbot bei Arbeitskampf | `industrialActionCheck` | 5.3 |
| P8 | Kennzeichnungs- und Konkretisierungspflicht | `concretizationCheck` | 5.3 |
| P9 | AÜG-Erlaubnis des Lieferanten gültig und anerkannt | `permitValidityCheck` | 5.4 |
| P10 | Pflichtnachweise vorhanden und gültig | `mandatoryDocumentCheck` | 5.4 |
| P11 | Arbeitsverhältnis beim Verleiher besteht | `employmentRelationshipCheck` | 5.3 |

#### Ergebnisarten

| Ergebnisart | Bezeichner | Wirkung im Statusmodell |
|---|---|---|
| Information | `info` | Der Übergang findet statt. Das Ergebnis wird am Objekt vermerkt (`ruleCheckResult`) und protokolliert. |
| Warnung | `warning` | Der Übergang findet statt, erzeugt aber eine Benachrichtigung an die zuständige Rolle und einen Eskalationsanlass (2.4). |
| Sperre | `block` | Der Übergang findet **nicht** statt. Das Objekt bleibt in seinem Zustand (4.0, Regel 5). Eine Übersteuerung ist nur nach 5.5 möglich, mit Begründung und Protokolleintrag, und ist **nicht vertretbar** (2.4, Regel 8) — *(offene Frage 10)*. |

> **Die Spalte „Ergebnisart" ist entschieden** — sie war ein Vorschlag aus Sicht
> der Statusmodelle und ist in **5.5.5** bestätigt bzw. geändert worden (M2,
> „Entscheidung, welche Prüfung sperrt und welche nur warnt"). 38 der
> ursprünglichen 44 Zeilen sind unverändert bestätigt, sechs sind geändert
> (Q12, Q13, Q15, Q17, Q26, Q35) und vier sind neu hinzugekommen (Q45 bis Q48).
> Die Begründung je Änderung steht in 5.5.5; das maßgebliche Kriterium ist:
> eine Sperre ist nur dort richtig, wo ein Weg offensteht, sie rechtmäßig
> aufzulösen (5.5.2, Nummer 5). Geändert wird die Spalte **hier**, nicht im
> Code. Prüfungen ohne Statusübergang (nächtlicher Lauf, N1 bis N6) stehen in
> **5.5.1** und nicht in dieser Tabelle.

#### Querschnittstabelle

| Nr. | Objekt | Übergang | Prüfung | Prüfgegenstand | Ergebnisart |
|---|---|---|---|---|---|
| Q01 | Bedarfsanfrage | `draft` → `submitted` | P8 | Tätigkeitsbeschreibung vorhanden und konkret | Information |
| Q02 | Bedarfsanfrage | `submitted` → `approved` | P8 | dito, vor der Freigabe | Warnung |
| Q03 | Bedarfsanfrage | `submitted` → `approved` | P1 | angefragter Zeitraum länger als die Höchstüberlassungsdauer (ohne Person) | Information |
| Q04 | Bedarfsanfrage | `approved` → `tendered` | P9 | je eingeladenem Lieferanten: Erlaubnis anerkannt und über die Angebotsfrist hinaus gültig | **Sperre** (je Einladung) |
| Q05 | Bedarfsanfrage | `approved` → `tendered` | P7 | Arbeitskampf am Standort angezeigt | Warnung |
| Q06 | Einladung | → `invited` | P9 | Lieferant `active` und Erlaubnis gültig | **Sperre** |
| Q07 | Profilvorschlag | `submitted` → `reviewed` | P1 | bisher angerechnete Dauer dieser Person bei diesem Kunden; Warnschwelle aus 5.1 | Warnung |
| Q08 | Profilvorschlag | `submitted` → `reviewed` | P6 | Vorbeschäftigung beim Entleiher oder im Konzern innerhalb der Frist aus 5.3 | Warnung |
| Q09 | Profilvorschlag | `submitted` → `reviewed` | P11 | `employmentStatusWithSupplier = employed` oder Zusage dazu | Warnung |
| Q10 | Profilvorschlag | `submitted` → `reviewed` | P10 | Pflichtnachweise des Kandidaten (Arbeitserlaubnis, Qualifikation) | Information |
| Q11 | Profilvorschlag | → `accepted` | P1 | Höchstüberlassungsdauer würde im angefragten Zeitraum überschritten | **Sperre** |
| Q12 | Profilvorschlag | → `accepted` | P6 | Drehtürklausel greift (Rechtsfolge: Equal Pay ab dem ersten Überlassungstag, 5.3.1) | Warnung bei Treffer, **Sperre** bei fehlender Erklärung *(geändert, 5.5.5)* |
| Q13 | Profilvorschlag | → `accepted` | P11 | kein Arbeitsverhältnis beim Verleiher; Prüfzeitpunkt ist der erste Überlassungstag (5.3.4) | Warnung *(geändert, 5.5.5; die Sperre steht in Q47)* |
| Q14 | Einsatz | → `planned` | P1 | `maxDurationEndDate` liegt vor dem geplanten Ende | **Sperre** |
| Q15 | Einsatz | → `planned` | P6 | Drehtürklausel greift (Rechtsfolge: Equal Pay ab dem ersten Überlassungstag, 5.3.1) | Warnung bei Treffer, **Sperre** bei fehlender Erklärung *(geändert, 5.5.5)* |
| Q16 | Einsatz | → `planned` | P9 | Erlaubnis für den geplanten Zeitraum gültig | **Sperre** |
| Q17 | Einsatz | → `planned` | P11 | Arbeitsverhältnis beim Verleiher besteht; Prüfzeitpunkt ist der erste Überlassungstag (5.3.4) | Warnung *(geändert, 5.5.5; die Sperre steht in Q47)* |
| Q18 | Einsatz | → `planned` | P4 | Vergleichsentgelt hinterlegt | Warnung |
| Q19 | Einsatz | → `planned` | P5 | Branchenzuschlagsschema am Standort zugeordnet | Information |
| Q20 | Einsatz | `planned` → `active` | P9 | Erlaubnis am Starttag gültig und anerkannt | **Sperre** |
| Q21 | Einsatz | `planned` → `active` | P10 | Pflichtnachweise zum Einsatz, insbesondere Unterweisung am Standort | **Sperre** |
| Q22 | Einsatz | `planned` → `active` | P7 | Arbeitskampf am Einsatzort | **Sperre** |
| Q23 | Einsatz | `planned` → `active` | P1 | Fristende bereits erreicht | **Sperre** |
| Q24 | Einsatz | `active` → `interrupted` | P2 | Unterbrechung wird mit Beginn und Grund erfasst | Information |
| Q25 | Einsatz | `interrupted` → `active` | P2 | Unterbrechungsdauer über der Schwelle aus 5.1 — Zählung wird zurückgesetzt | Information |
| Q26 | Einsatz | `interrupted` → `active` | P1 | Neuberechnung von `maxDurationEndDate` nach der Unterbrechung | **Sperre**, wenn das Fristende am Wiederaufnahmetag erreicht ist; Warnung, wenn es im Restzeitraum liegt *(geändert, 5.5.5)* |
| Q27 | Einsatz | → `completed` / `terminatedEarly` | P1, P3 | Abschlussstand der Fristen wird festgeschrieben | Information |
| Q28 | Verlängerung | `requested` → `approved` | P1 | Fristwirkung des neuen Endes für die Kundenseite sichtbar | Warnung |
| Q29 | Verlängerung | `requested` → `approved` | P3 | Equal-Pay-Fälligkeit fällt in den verlängerten Zeitraum | Warnung |
| Q30 | Verlängerung | `approved` → `effective` | P1 | `newEndDate` nach `maxDurationEndDate` | **Sperre** |
| Q31 | Verlängerung | `approved` → `effective` | P9 | Erlaubnis für den verlängerten Zeitraum gültig | **Sperre** |
| Q32 | Verlängerung | `approved` → `effective` | P4 | Vergleichsentgelt für den Zeitraum ab Equal-Pay-Fälligkeit | Warnung |
| Q33 | Stundenzettel | `recorded` → `submitted` | P1 | Zeitpositionen nach `maxDurationEndDate` enthalten | Warnung |
| Q34 | Stundenzettel | `submitted` → `inApproval` | P3 | Equal-Pay-Fälligkeit im Zettelzeitraum erreicht | Warnung |
| Q35 | Stundenzettel | `inApproval` → `approved` | P1 | Zeiten nach Fristende sollen genehmigt werden | Warnung mit Pflicht-Eskalation an `MA` *(geändert, 5.5.5)* |
| Q36 | Stundenzettel | `inApproval` → `approved` | P4 | Fälligkeit erreicht, **kein verwendbarer** Vergleichsentgelt-Eintrag; `wageSource = estimate` genügt und erzeugt eine Warnung (5.2.4) | **Sperre** |
| Q37 | Stundenzettel | `inApproval` → `approved` | P10 | Unterweisungsnachweis für den Standort gültig | Warnung |
| Q38 | Abrechnungsbeleg | → `created` (Einkauf) | P9 | Erlaubnis im gesamten Leistungszeitraum gültig | Warnung |
| Q39 | Abrechnungsbeleg | → `created` | P4 | Vergleichsentgelt für Zeiträume nach Fälligkeit hinterlegt | Warnung |
| Q40 | Abrechnungsbeleg | → `created` | P5 | Branchenzuschlagsstufe der abgerechneten Zuschläge plausibel | Information |
| Q41 | Lieferant | `onboarding` → `active` | P9 | Erlaubnis anerkannt und gültig | **Sperre** |
| Q42 | Lieferant | `onboarding` → `active` | P10 | Pflichtnachweise vollständig | **Sperre** |
| Q43 | Lieferant | `blocked` → `active` | P9, P10 | Sperrgrund behoben, Nachweise gültig | **Sperre** |
| Q44 | Lieferant | `inactive` → `active` | P9, P10 | wie beim erstmaligen Freischalten | **Sperre** |
| Q45 | Einsatz | → `planned` | P8 | Kennzeichnung und Konkretisierung: aktiver Rahmenvertrag der Lieferantenseite, Kandidat, eigene `activityDescription`, Standort und Beginn (K1–K4, 5.3.3) | **Sperre** *(neu, 5.5.5)* |
| Q46 | Einsatz | `planned` → `active` | P8 | Konkretisierung liegt **vor** dem ersten Überlassungstag vollständig vor (K5, 5.3.3) | **Sperre** *(neu, 5.5.5)* |
| Q47 | Einsatz | `planned` → `active` | P11 | `employmentStatusWithSupplier = employed` und `employedSince` ≤ erster Überlassungstag | **Sperre** *(neu, 5.5.5)* |
| Q48 | Einsatz | `planned` → `active` | P4 | `equalPayDueDate` liegt am oder vor dem ersten Überlassungstag und `comparableWage` ist nicht gesetzt | **Sperre** *(neu, 5.5.5)* |

#### Ableitungsmuster für die Szenarien

Jede Zeile der Tabelle lässt sich unmittelbar in ein Gherkin-Szenario
überführen. Das Muster ist für alle drei Ergebnisarten dasselbe und
unterscheidet sich nur im `Dann`-Teil:

```
Szenario: <Nr.> <Prüfung> bei <Übergang>
  Gegeben <Ausgangslage aus Kapitel 3: Objekte, Fristen, Nachweise>
  Und das Objekt steht im Status <Von-Zustand>
  Wenn <auslösende Rolle> den Übergang nach <Nach-Zustand> auslöst
  Dann ist das Ergebnis <Information | Warnung | Sperre>
  Und der Status ist <Nach-Zustand bei Information/Warnung, Von-Zustand bei Sperre>
  Und ein Protokolleintrag mit der Regel <Kürzel> liegt vor
```

Drei Regeln für die Szenarien, die sich aus diesem Kapitel ergeben:

1. **Je Zeile mindestens zwei Szenarien** — eines, in dem die Prüfung durchgeht,
   und eines, in dem sie anspricht. Bei einer **übersteuerbaren** Sperre kommt
   ein drittes hinzu: die dokumentierte Übersteuerung nach 5.5.4
   *(offene Frage 10)*. Bei einer **nicht übersteuerbaren** Sperre — P4, P6, P7
   und P8, siehe die Tabelle in 5.5.4 — kommt stattdessen ein Szenario hinzu,
   das den Versuch einer Übersteuerung zurückweist.
2. **Fristablauf gehört in ein eigenes Szenario** mit der Erwartung
   „Status unverändert, Eskalation ausgelöst" — niemals „genehmigt" (2.4,
   Regel 1). Das ist die schärfste Zusicherung dieses Kapitels und muss
   ausführbar geprüft werden.
3. **Sichtbarkeit ist Teil der Erwartung.** Wo ein Übergang eine
   Benachrichtigung auslöst, prüft das Szenario mit, dass sie keine Fremddaten
   enthält (2.3, Regeln 1–4) — besonders bei `rejected` und `expired` im
   Ausschreibungsprozess.

Die `.feature`-Dateien selbst sind ein **eigener Arbeitsschritt** innerhalb von
M2. Die Grundlage ist mit Kapitel 5 vollständig: dieses Kapitel liefert die
Übergänge und die erwartete Wirkung, Kapitel 5 die Rechenvorschriften, die
Grenzfälle und das Verhalten bei fehlenden Daten. Neben den 48 Zeilen dieser
Tabelle sind die sechs Zeilen N1 bis N6 des nächtlichen Laufs (5.5.1) und die
Grenzfalltabellen aus 5.1.5, 5.2.6, 5.3 und 5.4.5 abzuleiten — die Grenzfälle
sind die Szenarien, an denen sich die Rechnung entscheidet.

## 5. AÜG-Regeln

Verbindlich für den Prototyp. Jede Regel wird in `tests/aueg/` als
Gherkin-Szenario hinterlegt, bevor sie implementiert wird.

> **Tarifwerk ist Konfiguration, keine verdrahtete Regel** (Entscheidung zu
> offener Frage 3). Fristen, Abweichungen und Zuschlagsstufen stehen als Daten
> an der Tarifzuordnung (3.3: `maxAssignmentDurationMonths`,
> `equalPayDeadlineMonths`, `industryPremiumScheme`). Dieses Kapitel
> spezifiziert nur die **Mechanik**: wie gerechnet, gezählt und geprüft wird,
> wenn ein Tarifwerk zugeordnet ist, und was ohne Zuordnung gilt (gesetzliche
> Regelgrenzen). Ein konkretes Tarifwerk wird als erste Belegung angelegt; die
> Szenarien in `tests/aueg/` prüfen die Mechanik gegen eine synthetische
> Beispielbelegung, nicht gegen einen echten Tariftext.

**Aufbau des Kapitels.** 5.0 legt fest, was für **alle** Regeln gilt: Stichtag,
Fristenarithmetik, die Überlassungskette als gemeinsame Rechengrundlage von 5.1
und 5.2, und — am wichtigsten — was bei fehlenden Daten geschieht. 5.1 bis 5.4
arbeiten je Regel die Berechnungsvorschrift, die Grenzfälle und die bediente
Prüfung aus. 5.5 ist die Mechanik: wo Prüfungen greifen, was die drei
Ergebnisarten bewirken, wie rückwirkende Änderungen behandelt werden und wie
eine Sperre übersteuert wird. Die **Prüfungsnummern P1–P11 und die Zeilen
Q01–Q48 der Querschnittstabelle 4.7** sind die Brücke zu den Statusmodellen und
zu den Szenarien in `tests/aueg/`; dieses Kapitel benennt sie nicht neu.

### 5.0 Konventionen für alle Regeln

Die folgenden Festlegungen gelten für **jede** Regel dieses Kapitels und werden
in 5.1 bis 5.4 nicht wiederholt.

#### Lesart

1. **Die Paragrafenverweise dienen der Orientierung.** Der rechtliche Hinweis am
   Anfang dieses Dokuments gilt für jede Regel dieses Kapitels. Wo die
   Rechtslage für eine Berechnung nicht eindeutig ist, steht die Frage in
   Kapitel 7 und wird **nicht** durch eine Annahme im Rechenweg ersetzt.
2. **Mechanik, nicht Tarifwerk.** Fristen, Abweichungen und Zuschlagsstufen sind
   Daten an der Tarifzuordnung (3.3). Dieses Kapitel nennt Zahlen nur, wo sie
   **gesetzliche** Werte sind (18 Monate, 9 Monate, 15 Monate, 6 Monate,
   3 Monate) oder wo sie Systemverhalten beschreiben (Vorlauffristen, unten).
   Ein Wert aus einem konkreten Tarifvertrag steht nirgends in diesem Kapitel.
3. **Das Kapitel prüft Daten, nicht Wirklichkeit.** Das System stellt fest, was
   seine Daten hergeben: ob ein Nachweis vorliegt, ob eine Frist erreicht ist,
   ob ein Wert gepflegt ist. Es stellt **nicht** fest, ob tatsächlich Equal Pay
   gezahlt wurde, ob die Tätigkeitsbeschreibung die Wirklichkeit trifft oder ob
   eine Überlassung verdeckt als Werkvertrag läuft. Wo diese Grenze erreicht
   ist, sagt die Regel es ausdrücklich.
4. **Objekt- und Feldbezug ist verbindlich.** Jede Berechnungsvorschrift nennt
   ihre Eingangsdaten mit Objekt und Feld aus Kapitel 3. Ein Feld, das Kapitel 3
   nicht führt, wird hier **nicht** erfunden; fehlt eines, steht ein Hinweis an
   der Regel und die Lücke in `PROGRESS.md`.

#### Stichtag und Prüfzeitraum

Jede Prüfung hat genau **einen Stichtag** (`evaluationDate`) oder genau **einen
Prüfzeitraum** (`evaluationPeriod`). Er ist nie „heute", sondern aus dem Vorgang
abgeleitet — sonst liefert dieselbe Prüfung am selben Vorgang morgen ein anderes
Ergebnis als heute.

| Prüfanlass | Stichtag bzw. Prüfzeitraum |
|---|---|
| Bedarfsanfrage `draft` → `submitted`, `submitted` → `approved` | Stichtag: Tag des Übergangs; Prüfzeitraum für P1-Vorschau: `startDate` bis `endDate` (bei leerem `endDate` nur `startDate`) |
| Bedarfsanfrage `approved` → `tendered`, Einladung → `invited` | Prüfzeitraum: Tag des Übergangs bis `offerDeadline` der Ausschreibung |
| Profilvorschlag `submitted` → `reviewed`, → `accepted` | Prüfzeitraum: `availableFrom` des Vorschlags bis `endDate` der Bedarfsanfrage (bei leerem `endDate`: bis `startDate`) |
| Einsatz → `planned` | Prüfzeitraum: `plannedStartDate` bis `plannedEndDate` (bei leerem `plannedEndDate`: nur `plannedStartDate`, mit Information nach 5.1) |
| Einsatz `planned` → `active` | Stichtag: `actualStartDate` |
| Einsatz `active` → `interrupted` | Stichtag: `interruptionFrom` |
| Einsatz `interrupted` → `active` | Stichtag: `interruptionTo` + 1 Tag (erster Wiederaufnahmetag) |
| Einsatz → `completed` / `terminatedEarly` | Stichtag: `actualEndDate` |
| Verlängerung `requested` → `approved` | Prüfzeitraum: bisheriges `plannedEndDate` + 1 Tag bis `newEndDate` |
| Verlängerung `approved` → `effective` | derselbe Prüfzeitraum, erneut am Tag der Wirksamkeit |
| Stundenzettel (alle Übergänge) | Prüfzeitraum: `periodFrom` bis `periodTo` des Zettels |
| Abrechnungsbeleg → `created` | Prüfzeitraum: frühester `periodFrom` bis spätester `periodTo` der zugrunde liegenden Zettel |
| Lieferant `onboarding` / `blocked` / `inactive` → `active` | Stichtag: Tag des Übergangs |
| Nächtlicher Lauf (5.5) | Stichtag: Tag des Laufs |

**Zeitraumbezogene Stammdaten werden mit dem Stichtag gelesen**, nicht mit dem
aktuellen Datum: Tarifzuordnung, Vergleichsentgelt, Preisposition, AÜG-Erlaubnis
und Rollenzuweisung gelten in der Fassung, die am Stichtag gültig war
(`validFrom` / `validTo`, 3.0 Festlegung 2). Bei einem Prüfzeitraum muss die
Bedingung für **jeden Tag** des Zeitraums erfüllt sein, soweit die Regel nichts
anderes sagt.

#### Fristenarithmetik

| Festlegung | Regel |
|---|---|
| Einheit | **Kalendertage.** Keine Arbeitstage, keine Stunden, keine Umrechnung Monat → 30 Tage. Arbeitstage gibt es nur bei Prozessfristen (4.0), nicht bei AÜG-Fristen |
| Monatsfristen | nach §§ 187 Abs. 2, 188 Abs. 2 BGB: beginnt die Frist mit dem Tag `T`, endet eine Frist von `M` Monaten mit dem Vortag des Tages im `M`-ten Folgemonat, der dieselbe Tageszahl trägt wie `T`. Beispiel: Beginn 15.01., 18 Monate → Ende 14.07. des Folgejahres |
| Fehlender Tag im Zielmonat | letzter Tag des Zielmonats (§ 188 Abs. 3 BGB). Beispiel: Beginn 31.01., 1 Monat → Ende 28.02. bzw. 29.02. |
| Tagesgrenze | 00:00 Uhr, Zeitzone `Europe/Berlin`. Ein Zeitpunkt wird für Fristzwecke auf seinen Kalendertag abgebildet |
| Rundung | **keine.** Tageszahlen sind ganzzahlig, weil sie gezählt und nicht gerechnet werden. Rundung von Beträgen folgt 3.0 Festlegung 1 und 3.9 |
| Halb offene Zeiträume | `validTo` leer = unbefristet; `interruptionTo` leer = läuft noch; `plannedEndDate` leer = unbefristeter Bedarf (3.4) |
| Grenztage zählen mit | Ein Zeitraum `von`–`bis` umfasst **beide** Randtage. „Bis zum `maxDurationEndDate`" heißt: dieser Tag ist noch zulässig |

#### Die Überlassungskette

5.1 und 5.2 rechnen auf derselben Grundlage. Sie wird hier **einmal** definiert.

| Begriff | Bezeichner | Definition |
|---|---|---|
| Überlassungstag | `assignmentDay` | Ein Kalendertag, an dem **mindestens ein** Einsatz derselben Person bei demselben Kunden überlassen ist. Laufen an einem Tag zwei Einsätze, ist es **ein** Überlassungstag (Entscheidung zu Frage 19) |
| Tatsächlicher Überlassungstag | `realizedAssignmentDay` | Überlassungstag aus einem Einsatz in `active`, `interrupted`, `completed` oder `terminatedEarly`, begrenzt durch `actualStartDate` und `actualEndDate`; ist `actualEndDate` leer, bis zum Stichtag. Tage innerhalb einer dokumentierten Unterbrechung (3.7) sind **keine** Überlassungstage |
| Vorgesehener Überlassungstag | `plannedAssignmentDay` | Überlassungstag aus einem Einsatz in `planned` oder aus dem noch nicht erbrachten Teil eines laufenden Einsatzes, begrenzt durch `plannedStartDate` und `plannedEndDate` |
| Lückentag | `gapDay` | Kalendertag zwischen zwei Überlassungstagen derselben Kette, an dem keine Überlassung besteht |
| Überlassungskette | `assignmentChain` | Die Folge aller Überlassungstage **einer Personenidentität bei einem Kunden**, zwischen denen keine Lücke von mehr als drei Monaten liegt |
| Kettenbeginn | `chainStartDate` | Erster Überlassungstag der Kette |
| Angerechnete Dauer | `countedDurationDays` (3.7) | Zahl der **tatsächlichen** Überlassungstage der Kette bis zum Stichtag einschließlich |

**Bezugspunkt ist der Kunde**, nicht der Standort, nicht die Kostenstelle, nicht
der Lieferant (3.1: „zählen je Kunde"). Ein Lieferantenwechsel unterbricht die
Kette nicht; ein Standortwechsel innerhalb desselben Kunden auch nicht.

**Schlüssel ist die Personenidentität** (`workerIdentity`, 3.6), nicht der
Kandidatensatz eines Lieferanten. Eine nur **maschinell vorgeschlagene**, nicht
bestätigte Verknüpfung (`confirmedAt` leer) gehört **nicht** zur Kette
(Entscheidung zu Frage 18, 4.2).

**Bildung der Kette.** Alle Überlassungstage der Person bei diesem Kunden werden
chronologisch geordnet. Zwischen je zwei aufeinanderfolgenden Überlassungstagen
wird die Lücke bewertet (5.1.4). Bei einer Lücke von **mehr als drei Monaten**
wird geschnitten; die Kette beginnt neu. Maßgeblich ist die Kette, die den
Stichtag enthält oder ihm unmittelbar vorausgeht.

**Vorschau gegen Rückschau.** `countedDurationDays` zählt nur tatsächliche Tage.
Prüfungen, die in die Zukunft sehen — P1 bei → `planned`, bei der Verlängerung
und in der Vorschau an der Bedarfsanfrage — rechnen mit tatsächlichen **und**
vorgesehenen Tagen und kennzeichnen ihr Ergebnis als Vorschau.

#### Fehlende Daten: der Grundsatz

Fehlende Daten sind der **häufigste** Fall, nicht der Ausnahmefall. Deshalb
gilt durchgängig:

> **Eine fehlende Rechengrundlage wirkt wie ein Treffer, nicht wie ein
> Freibrief.** Was nicht geprüft werden kann, gilt als nicht erfüllt. Eine
> Prüfung, die wegen fehlender Daten kein Ergebnis bilden kann, liefert
> dasselbe Ergebnis wie eine Prüfung, die anspricht — nie „in Ordnung".

Daraus folgen vier Regeln:

1. **Kein stilles Durchlassen.** Es gibt keinen Zustand „Prüfung nicht
   durchgeführt". Jede Prüfung liefert eines der drei Ergebnisse aus 4.7.
2. **Der Grund wird mitgeführt.** Ein Ergebnis aus fehlenden Daten nennt das
   fehlende Datum mit Objekt und Feld, damit die zuständige Rolle weiß, was
   beizubringen ist. Das ist der Unterschied zwischen einer brauchbaren und
   einer ärgerlichen Sperre.
3. **Die Zuständigkeit folgt dem Datum.** Fehlt ein Nachweis des Lieferanten,
   geht die Meldung an `LA`/`LD`; fehlt das Vergleichsentgelt, an `KE`; fehlt
   eine Tarifzuordnung oder eine Personenidentität, an `MA` (2.4).
4. **Gesetzliche Regelgrenze statt Lücke.** Fehlt eine **Tarifzuordnung**, wird
   nicht „nicht geprüft", sondern mit der gesetzlichen Regelgrenze gerechnet
   (5.1.2, 5.2.2). Das ist der einzige Fall, in dem eine fehlende Angabe einen
   definierten Ersatzwert hat — weil das Gesetz ihn liefert.

#### Festwerte dieses Kapitels

Vorlauf- und Schwellenwerte sind **Regelwerk, keine Nutzerdaten** und keine
Tarifwerte: sie beschreiben, wie früh das System warnt, nicht was rechtlich
gilt. Sie werden deshalb hier festgelegt und nicht je Kunde konfiguriert (anders
als die Prozessfristen in 4.0). Eine Änderung ist eine Änderung dieses Kapitels.

| Schwelle | Bezeichner | Wert | Wirkung |
|---|---|---|---|
| Vorlauf Höchstüberlassungsdauer, Hinweis | `maxDurationNoticeDays` | 90 Tage vor `maxDurationEndDate` | Information an `MD` |
| Vorlauf Höchstüberlassungsdauer, Warnung | `maxDurationWarningDays` | 30 Tage vor `maxDurationEndDate` | Warnung; Eskalationsanlass „Warnschwelle Höchstüberlassungsdauer erreicht" (2.4) |
| Vorlauf Equal-Pay-Fälligkeit | `equalPayNoticeDays` | 60 Tage vor `equalPayDueDate` | Information an `MD` und `KE` |
| Vorlauf Equal-Pay-Fälligkeit, Warnung | `equalPayWarningDays` | 30 Tage vor `equalPayDueDate`, wenn `comparableWage` fehlt | Warnung; Eskalationsanlass „Equal-Pay-Frist erreicht, Vergleichsentgelt fehlt" (2.4) |
| Vorlauf Ablauf eines Nachweises | `documentExpiryNoticeDays` | je Nachweisart, Tabelle in 5.4.4 | Information, Warnung, Eskalation nach Stufen |

#### Was dieses Kapitel nicht tut

- **Keine Lohnabrechnung und keine Entgeltprüfung.** Das System führt kein
  Entgelt des Leiharbeitnehmers (1.4, 3.0). Equal Pay wird über das Vorliegen
  des Vergleichsentgelts geprüft, nicht über einen Vergleich gezahlter Löhne
  (5.2.1, *offene Frage 28*).
- **Keine arbeitsrechtliche Folgenbehandlung.** Dass ein Verstoß nach
  §§ 9, 10 AÜG zur Unwirksamkeit des Arbeitsvertrags und zu einem
  Arbeitsverhältnis beim Entleiher führen kann, stellt das System **fest** und
  eskaliert es; es bildet weder die Festhaltenserklärung noch das entstehende
  Arbeitsverhältnis ab.
- **Keine Prüfung gegen Behördendaten.** Die AÜG-Erlaubnis wird gegen den vom
  Lieferanten eingestellten, vom Betreiber anerkannten Nachweis geprüft, nicht
  gegen ein Register (*offene Frage 7*).
- **Keine Statusmodelle.** Die Übergänge stehen in Kapitel 4. Die einzige
  Ausnahme ist der Nachweisfluss des Dokuments (5.4.3), den 4.0 ausdrücklich
  hierher verweist.
- **Keine Szenarien.** Die `.feature`-Dateien in `tests/aueg/` entstehen als
  eigener Schritt aus 4.7 und aus diesem Kapitel.

### 5.1 Höchstüberlassungsdauer

Bedient die Prüfungen **P1** (`maxDurationCheck`) und **P2**
(`interruptionResetCheck`).

#### 5.1.1 Die Regel in Worten

Derselbe Leiharbeitnehmer darf demselben Entleiher nicht länger als **18
aufeinander folgende Monate** überlassen werden (§ 1 Abs. 1b Satz 1 AÜG). Zeiten
**vorheriger** Überlassungen an denselben Entleiher sind vollständig
anzurechnen — auch die durch einen **anderen** Verleiher —, wenn zwischen den
Einsätzen jeweils **nicht mehr als drei Monate** liegen (Satz 2). Ein
Tarifvertrag der Einsatzbranche kann eine abweichende Dauer zulassen; für nicht
tarifgebundene Entleiher kann eine Betriebsvereinbarung auf Grundlage eines
solchen Tarifvertrags abweichen (Sätze 3 bis 6).

Die Grenze ist **personen- und entleiherbezogen**. Sie ist nicht
standortbezogen, nicht kostenstellenbezogen und nicht lieferantenbezogen — ein
Lieferantenwechsel verlängert sie nicht (5.0, Überlassungskette).

#### 5.1.2 Welche Grenze gilt

Die Grenze ist ein Monatswert `maxAssignmentDurationMonths`. Er wird **am
Stichtag** aus der Tarifzuordnung gelesen (3.3), in dieser Reihenfolge:

| Rang | Herkunft | Bedingung |
|---|---|---|
| 1 | `collectiveAgreementAssignment` mit `appliesToType = site` und `appliesToRef` = `assignment.siteRef`, gültig am Stichtag, `maxAssignmentDurationMonths` gesetzt | Abweichung für den konkreten Einsatzort; `documentRef` trägt die Rechtsgrundlage (Tarifauszug oder Betriebsvereinbarung, vgl. `site.worksCouncilAgreement` in 3.1) |
| 2 | dieselbe Zuordnung mit `appliesToType = customer` und `appliesToRef` = `assignment.customerRef` | Abweichung für den Entleiher insgesamt |
| 3 | **gesetzliche Regelgrenze: 18 Monate** | kein Eintrag vorhanden oder `maxAssignmentDurationMonths` leer |

**Die Verleiherseite ist hier irrelevant.** Eine Zuordnung mit
`appliesToType = supplier` wird für 5.1 **nicht** gelesen: die Öffnungsklausel
des § 1 Abs. 1b ist eine Regelung der **Einsatzbranche**. Der Verleihertarif
wirkt in 5.2, nicht hier.

**Zeitraum ohne Tarifzuordnung.** Deckt keine gültige Zuordnung den Stichtag ab,
gilt die Regelgrenze von 18 Monaten — nicht „keine Grenze" und nicht „Prüfung
entfällt" (5.0, Grundsatz 4). Das Ergebnis trägt zusätzlich eine Information,
dass mit der Regelgrenze gerechnet wurde, damit eine vergessene Zuordnung
auffällt und nicht als Entscheidung durchgeht.

**Wechselt der Wert innerhalb einer laufenden Kette** (Tarifrunde, neue
Betriebsvereinbarung, Standortwechsel), rechnet das System mit dem Wert, der am
**Stichtag der Prüfung** gilt. Eine Senkung wirkt damit nach vorn: liegt die neu
berechnete Grenze schon in der Vergangenheit, ist das Ergebnis eine **Warnung
mit Pflicht-Eskalation** an `MA` und `maxDurationEndDate` wird auf den Stichtag
gesetzt — die nächste Überlassung ist damit gesperrt, die vergangene wird
festgestellt, nicht rückwirkend untersagt (5.5.3). Ob diese Lesart rechtlich
trägt, ist ***offene Frage 27***.

#### 5.1.3 Berechnungsvorschrift

**Eingangsdaten**

| Nr. | Datum | Objekt und Feld |
|---|---|---|
| E1 | Personenidentität, bestätigt | `workerIdentity` mit gesetztem `confirmedAt`; `linkedCandidates` (3.6) |
| E2 | Kunde | `assignment.customerRef` (3.7) |
| E3 | Alle Einsätze derselben Person bei diesem Kunden | `assignment` mit übereinstimmendem `workerIdentityRef` und `customerRef`, Status `planned`, `active`, `interrupted`, `completed` oder `terminatedEarly` (3.7, 4.3) |
| E4 | Je Einsatz die Laufzeit | `actualStartDate` / `actualEndDate`, ersatzweise `plannedStartDate` / `plannedEndDate` (3.7) |
| E5 | Dokumentierte Unterbrechungen | `assignmentInterruption.interruptionFrom` / `.interruptionTo` (3.7) |
| E6 | Grenze in Monaten | `collectiveAgreementAssignment.maxAssignmentDurationMonths` nach der Rangfolge in 5.1.2, sonst 18 |
| E7 | Stichtag bzw. Prüfzeitraum | aus der Tabelle in 5.0 |

**Rechenschritte**

1. **Überlassungstage bilden.** Für jeden Einsatz aus E3 die Menge der
   Kalendertage von seinem wirksamen Beginn bis zu seinem wirksamen Ende
   (E4: tatsächliche Daten haben Vorrang vor geplanten). Tage innerhalb einer
   Unterbrechung aus E5 werden entfernt; bei leerem `interruptionTo` bis zum
   Stichtag. Die Mengen aller Einsätze werden **vereinigt** — ein Tag, an dem
   zwei Einsätze laufen, ist einmal enthalten (Entscheidung zu Frage 19).
2. **Kette schneiden.** Die Tage chronologisch ordnen. Für jedes Paar
   benachbarter Tage die Lücke nach 5.1.4 bewerten. Bei **Reset** schneiden. Die
   Kette, die den Stichtag enthält oder ihm unmittelbar vorausgeht, ist die
   maßgebliche; `chainStartDate` ist ihr erster Tag.
3. **Angerechnete Dauer zählen.** `countedDurationDays` = Zahl der
   **tatsächlichen** Überlassungstage der Kette bis zum Stichtag einschließlich.
   Vorgesehene Tage zählen hier **nicht** mit; sie gehen nur in die Vorschau
   (Schritt 6).
4. **Tagebudget bestimmen.** `maxDurationDays` = Zahl der Kalendertage im
   Zeitraum von `chainStartDate` bis zum Ende einer Frist von `E6` Monaten, die
   mit `chainStartDate` beginnt (5.0, Fristenarithmetik). Beispiel:
   `chainStartDate` = 15.01.2026, 18 Monate → Fristende 14.07.2027 →
   `maxDurationDays` = 546.
5. **Fristende ableiten.** `maxDurationEndDate` = der Kalendertag, auf den der
   `maxDurationDays`-te Überlassungstag der Kette fällt:
   - Restbudget `R` = `maxDurationDays` − `countedDurationDays`.
   - `R` ≤ 0: Das Budget ist ausgeschöpft. `maxDurationEndDate` ist der Tag, an
     dem der Budgettag erreicht wurde (rückwärts aus der Kette bestimmt).
   - `R` > 0: `maxDurationEndDate` = der `R`-te **vorgesehene** Überlassungstag
     nach dem Stichtag. Sind weniger als `R` vorgesehene Tage bekannt — etwa
     weil `plannedEndDate` leer ist —, wird ab dem letzten bekannten Tag
     kalendarisch fortgeschrieben: jeder Folgetag gilt als Überlassungstag.
   - Bei einer lückenlosen Kette ergibt das `chainStartDate` + `E6` Monate
     − 1 Tag. Lückentage verschieben das Fristende nach hinten, weil sie
     Kalenderzeit, aber kein Budget verbrauchen (*offene Frage 26*).
6. **Vorschau rechnen** (nur bei → `planned`, bei der Verlängerung und in der
   Vorschau an der Bedarfsanfrage): Schritte 1 bis 5 erneut, mit tatsächlichen
   **und** vorgesehenen Tagen bis zum Ende des Prüfzeitraums. Ergebnis ist der
   **letzte Tag des Prüfzeitraums im Vergleich zu `maxDurationEndDate`**.
7. **Ergebnis bilden.**
   - Letzter Tag des Prüfzeitraums ≤ `maxDurationEndDate` und Restbudget über
     den Schwellen aus 5.0 → **Information**.
   - Restbudget unterhalb `maxDurationNoticeDays` → **Information** mit Hinweis,
     unterhalb `maxDurationWarningDays` → **Warnung** mit Eskalation.
   - Letzter Tag des Prüfzeitraums > `maxDurationEndDate` → **Treffer**. Die
     Ergebnisart folgt der Zeile aus 4.7 (bestätigt in 5.5.5).

**Ergebnisfelder.** `assignment.countedDurationDays` und
`assignment.maxDurationEndDate` (3.7, beide *abgeleitet*) werden an **jedem**
Einsatz der Kette geführt, nicht nur am geprüften — sonst zeigt ein älterer
Einsatz einen überholten Stand. Das Prüfergebnis selbst steht als
`ruleCheckResult` am auslösenden Vorgang (3.7, bei der Verlängerung als Feld,
sonst als Audit-Eintrag mit `ruleRef`, 3.12).

#### 5.1.4 Unterbrechung und Zurücksetzen (P2)

Zwei Arten von Unterbrechung sind zu unterscheiden. **Beide** werden nach
derselben Drei-Monats-Regel bewertet.

**a) Lücke zwischen zwei Einsätzen.** Sie ergibt sich aus den Einsatzdaten und
braucht kein eigenes Objekt (3.7, Festlegung). `gapFrom` = wirksames Ende des
früheren Einsatzes + 1 Tag, `gapTo` = wirksamer Beginn des späteren Einsatzes
− 1 Tag.

**b) Dokumentierte Unterbrechung innerhalb eines Einsatzes**
(`assignmentInterruption`, 3.7). `gapFrom` = `interruptionFrom`, `gapTo` =
`interruptionTo`; ist `interruptionTo` leer, ist `gapTo` der Stichtag und das
Ergebnis **vorläufig**.

**Bewertung in einem Satz:** Reset tritt ein, wenn `gapTo` **nach** dem Tag
liegt, mit dem eine Frist von drei Monaten ab `gapFrom` endet.

```
dreiMonatsEnde = gapFrom + 3 Monate − 1 Tag      (§§ 187 Abs. 2, 188 Abs. 2 BGB)
countsAsReset  = gapTo > dreiMonatsEnde
```

| Beispiel | Rechnung | Ergebnis |
|---|---|---|
| Ende 31.03., Wiederaufnahme 01.07. | `gapFrom` = 01.04., `dreiMonatsEnde` = 30.06., `gapTo` = 30.06. | **exakt drei Monate → kein Reset.** Die Kette läuft weiter, die Vorzeiten sind vollständig anzurechnen |
| Ende 31.03., Wiederaufnahme 02.07. | `gapTo` = 01.07. > 30.06. | **Reset.** Neue Kette ab 02.07. |
| Ende 31.03., Wiederaufnahme 01.04. | `gapFrom` = 01.04., `gapTo` = 31.03. < `gapFrom` | **keine Lücke.** Durchgehende Überlassung |

Das Gesetz sagt „nicht mehr als drei Monate" — **exakt** drei Monate liegen
innerhalb der Anrechnung und setzen die Zählung **nicht** zurück. Das ist der
Grenzfall, der am häufigsten falsch gerechnet wird, und gehört in ein eigenes
Szenario.

`assignmentInterruption.countsAsReset` (3.7, *abgeleitet*) trägt das Ergebnis.
P2 ist die Prüfung, die es setzt: bei `active` → `interrupted` als
**Information** (die Unterbrechung wird erfasst, ihre Wirkung ist noch offen),
bei `interrupted` → `active` als **Information** über die eingetretene Wirkung,
mit anschließender Neuberechnung von P1 (Schritte 2 bis 5).

**Eine Unterbrechung verlängert die Überlassung nicht.** Sie verschiebt nur den
Kalendertag, an dem das Budget ausgeschöpft ist. Wer eine Unterbrechung
einlegt, um die Grenze zu umgehen, gewinnt bis zu drei Monate Kalenderzeit und
keinen einzigen Überlassungstag — das ist die beabsichtigte Wirkung der Regel
und keine Lücke in der Rechnung.

#### 5.1.5 Grenzfälle

| Grenzfall | Festlegung |
|---|---|
| **Tag genau auf der Grenze** | `maxDurationEndDate` ist der **letzte zulässige** Überlassungstag. Eine Überlassung an diesem Tag ist zulässig, am Folgetag nicht. Ein Prüfzeitraum, dessen letzter Tag gleich `maxDurationEndDate` ist, geht durch |
| **Unterbrechung exakt drei Monate** | **Kein** Reset (5.1.4). Die Kette läuft weiter, `countedDurationDays` wird fortgeschrieben, `maxDurationEndDate` verschiebt sich um die Lückentage nach hinten |
| **Lieferantenwechsel mitten im Einsatz** | Ein Einsatz gehört zu genau einem Lieferanten (3.7, `supplierRef` Pflicht). Ein Wechsel ist deshalb **keine Änderung** des Einsatzes, sondern `terminatedEarly` des alten und ein **neuer** Einsatz (4.3.1). Die Kette läuft über beide: § 1 Abs. 1b Satz 2 rechnet Zeiten „durch denselben oder einen anderen Verleiher" an. `countedDurationDays` wird fortgeschrieben, `chainStartDate` bleibt. Liegt zwischen beiden eine Lücke, gilt 5.1.4 |
| **Rückwirkende Korrektur** | Ändert sich ein `actualStartDate`, `actualEndDate` oder eine Unterbrechung nachträglich, werden Kette und abgeleitete Felder **aller** Einsätze der Kette neu gerechnet (5.5.3). Ein Übergang, der bei seiner Ausführung zulässig war, bleibt wirksam; wird dadurch eine Überschreitung in der Vergangenheit sichtbar, ist das Ergebnis eine **Warnung mit Pflicht-Eskalation** an `MA`, keine Sperre — es gibt nichts mehr zu sperren |
| **Fehlende Personenidentität** | Ohne bestätigte `workerIdentity` wird die Kette nur über den Kandidatensatz **eines** Lieferanten gebildet. `countedDurationDays` kann dadurch nur **zu niedrig** sein, nie zu hoch: ein Treffer bleibt deshalb ein Treffer, ein Nicht-Treffer trägt zusätzlich die Information „Zählgrundlage auf einen Lieferanten begrenzt". Am Einsatz tritt der Fall nicht auf — `workerIdentityRef` ist Pflicht ab `planned` (3.7); am Profilvorschlag (Q07) tritt er regelmäßig auf |
| **Unbestätigter maschineller Treffer** | Zählt **nicht** (3.6, 4.2). Bis zur Bestätigung ist der Kandidatensatz eine eigene Person. Das Ergebnis trägt die Information, dass ein unbestätigter Vorschlag vorliegt — adressiert an `MD`, nicht an den Lieferanten (2.3, Regel 4) |
| **Zeitraum ohne Tarifzuordnung** | Regelgrenze 18 Monate, mit Information (5.1.2) |
| **Grenze ändert sich in der Kette** | Wert am Stichtag; Senkung wirkt nach vorn (5.1.2, *offene Frage 27*) |
| **`plannedEndDate` leer** (unbefristeter Bedarf) | Zulässig (3.4). `maxDurationEndDate` wird trotzdem berechnet (Schritt 5, kalendarische Fortschreibung) und ist die faktische Obergrenze. P1 bei → `planned` ist dann **Information**, keine Sperre: überschritten ist noch nichts |
| **Gleichzeitige Einsätze** | Zulässig (3.7). Überlappende Tage zählen einmal (Schritt 1). Endet einer der beiden früher, läuft die Kette über den anderen weiter — ohne Lücke |
| **Einsatz, der nie begonnen hat** | `planned` → `terminatedEarly` ohne `actualStartDate` erzeugt **keinen** Überlassungstag. Die Kette bleibt unberührt |
| **Mehrere Kunden desselben Konzerns** | Jeder Kunde ist eine eigene Kette. § 1 Abs. 1b stellt auf den **Entleiher** ab, nicht auf den Konzern; die Konzernbetrachtung gehört zur Drehtürklausel (5.3.1) |

#### 5.1.6 Schwellen, Warnungen, Eskalation

| Zeitpunkt | Ergebnis | Adressat |
|---|---|---|
| Restbudget ≤ `maxDurationNoticeDays` (90 Tage) | Information | `MD` |
| Restbudget ≤ `maxDurationWarningDays` (30 Tage) | Warnung, Eskalationsanlass „Warnschwelle Höchstüberlassungsdauer erreicht" (2.4) | `MD` → `MA`, zusätzlich Information an `KB` |
| `maxDurationEndDate` erreicht, Einsatz noch `active` | Warnung mit Pflicht-Eskalation | `MD` → `MA`; Information an `KB` und `LD` |
| Übergang würde die Grenze überschreiten | Sperre nach 4.7 | auslösende Rolle, Protokolleintrag |

Die Schwellen werden im **nächtlichen Lauf** (5.5.1) geprüft, nicht nur bei
Statusübergängen — sonst bleibt ein laufender Einsatz ohne Verlängerungsantrag
bis zum Fristende unbemerkt. Der Lauf erzeugt **keinen** Statuswechsel (4.0,
Regel 4).

Die Information an den Lieferanten enthält **nur** den Fristenstand des eigenen
Einsatzes, nie die Einsatzhistorie bei anderen Lieferanten (2.3, Regel 4). Die
Information an den Kunden enthält den Fristenstand, nicht die Historie bei
anderen Kunden (2.3).

#### 5.1.7 Rechtsfolge bei Überschreitung

Eine Überschreitung führt nach § 9 Abs. 1 Nr. 1b AÜG zur Unwirksamkeit des
Arbeitsvertrags zwischen Verleiher und Leiharbeitnehmer; nach § 10 Abs. 1 AÜG
gilt dann ein Arbeitsverhältnis zum Entleiher als zustande gekommen, sofern der
Leiharbeitnehmer nicht am Arbeitsverhältnis mit dem Verleiher festhält. Hinzu
kommen Ordnungswidrigkeitsfolgen (§ 16 AÜG).

**Systemverhalten.** Das System verhindert die Überschreitung, soweit sie vor
ihr liegt (Sperre bei Q11, Q14, Q23, Q26, Q30), und **stellt sie fest**, wo sie
schon eingetreten ist (Warnung mit Pflicht-Eskalation an `MA`). Es bildet die
Festhaltenserklärung und das entstehende Arbeitsverhältnis beim Entleiher
**nicht** ab; das ist Rechtsanwendung außerhalb des Systems (1.4, 5.0). Der
Befund bleibt als Audit-Eintrag mit `ruleRef` dauerhaft erhalten (3.12).

#### 5.1.8 Was gilt, wenn Daten fehlen

| Fehlendes Datum | Verhalten |
|---|---|
| Keine bestätigte Personenidentität | Kette auf einen Lieferanten begrenzt, Ergebnis mit Vermerk (5.1.5). **Kein** Durchlassen ohne Vermerk |
| `actualStartDate` fehlt bei `active` | Widerspruch zu 4.3 (Vorbedingung des Übergangs). Die Prüfung rechnet mit `plannedStartDate` und liefert eine **Warnung** mit Hinweis auf das fehlende Feld |
| `actualEndDate` fehlt bei beendetem Einsatz | Dasselbe mit `plannedEndDate`; zusätzlich Warnung, weil `actualEndDate` die Grundlage von Abrechnung und Fristenlauf ist (4.3) |
| Unterbrechung ohne `interruptionTo` | `gapTo` = Stichtag, `countsAsReset` **vorläufig**; das Ergebnis trägt den Vermerk „vorläufig" und wird bei `interrupted` → `active` endgültig |
| Keine Tarifzuordnung am Stichtag | Regelgrenze 18 Monate + Information (5.1.2) |
| Keine Laufzeitdaten überhaupt (`plannedStartDate` fehlt) | Die Kette ist nicht bildbar. Ergebnis: **wie ein Treffer** (5.0, Grundsatz) — bei einem Übergang, dem 4.7 eine Sperre zuordnet, also Sperre. `plannedStartDate` ist in 3.7 Pflicht; der Fall ist ein Datenfehler, kein Betriebszustand |
| Widersprüchliche Daten (Ende vor Beginn) | Datenfehler. Ergebnis wie ein Treffer, mit Nennung der widersprüchlichen Felder |

#### 5.1.9 Bediente Prüfungen

| Prüfung | Zeilen in 4.7 | Ergebnisart (bestätigt in 5.5.5) |
|---|---|---|
| P1 Vorschau ohne Person | Q03 | Information |
| P1 am Profilvorschlag | Q07 (Warnschwelle), Q11 (Zusage) | Warnung / **Sperre** |
| P1 am Einsatz | Q14 (anlegen), Q23 (Start), Q26 (Wiederaufnahme), Q27 (Abschluss) | **Sperre** / **Sperre** / **Sperre** (geändert) / Information |
| P1 an der Verlängerung | Q28 (Vorschau), Q30 (Wirksamkeit) | Warnung / **Sperre** |
| P1 am Stundenzettel | Q33, Q35 | Warnung / Warnung (geändert) |
| P2 Unterbrechung | Q24, Q25 | Information / Information |

### 5.2 Equal Pay / Equal Treatment

Bedient die Prüfungen **P3** (`equalPayDeadlineCheck`), **P4**
(`comparableWageCheck`) und **P5** (`industryPremiumCheck`).

#### 5.2.1 Die Regel in Worten

Der Verleiher hat dem Leiharbeitnehmer für die Zeit der Überlassung die
**wesentlichen Arbeitsbedingungen einschließlich des Arbeitsentgelts** zu
gewähren, die im Betrieb des Entleihers für einen vergleichbaren Arbeitnehmer
gelten (Gleichstellungsgrundsatz, § 8 Abs. 1 AÜG). Ein **Tarifvertrag der
Zeitarbeitsbranche** kann hiervon abweichen (§ 8 Abs. 2 AÜG). Diese Abweichung
endet jedoch: nach **neun Monaten** Überlassung an denselben Entleiher gilt
Equal Pay zwingend (§ 8 Abs. 4 Satz 1 AÜG). Sieht ein
**Branchenzuschlagstarifvertrag** eine stufenweise Annäherung an das
Vergleichsentgelt vor, kann die Abweichung längstens bis zum **15. Monat**
fortbestehen (§ 8 Abs. 4 Satz 2 AÜG). Vorhergehende Überlassungszeiten an
denselben Entleiher werden angerechnet, wenn die Unterbrechung **nicht mehr als
drei Monate** beträgt (§ 8 Abs. 4 Satz 4 AÜG).

**Dieselbe Kette, andere Frist.** Die Anrechnungsregel des § 8 Abs. 4 Satz 4 ist
die des § 1 Abs. 1b Satz 2: drei Monate. 5.2 rechnet deshalb auf **derselben
Überlassungskette** wie 5.1 (5.0) und unterscheidet sich nur im Fristwert und im
Ergebnisfeld. Das ist keine Vereinfachung, sondern die Struktur des Gesetzes —
und sie hält die Szenarien konsistent.

**Grenze der Prüfbarkeit.** Das System führt **kein Entgelt des
Leiharbeitnehmers** (1.4, 3.0 Festlegung 4 und 5). Es kann deshalb nicht
feststellen, **ob** Equal Pay gezahlt wurde. Was es prüft, ist dreierlei: ob die
Fälligkeit erreicht ist (P3), ob das Vergleichsentgelt vorliegt und verwendbar
ist (P4) und ob ein Branchenzuschlagsschema zugeordnet ist (P5). Die Einhaltung
selbst bleibt Pflicht des Verleihers. Ob der Verleiher das tatsächliche Entgelt
melden soll, damit die Einhaltung prüfbar wird, ist ***offene Frage 28*** —
eine Frage mit erheblicher datenschutzrechtlicher Tragweite, die hier nicht
geraten wird.

#### 5.2.2 Welche Frist gilt

Die Frist ist ein Monatswert `equalPayDeadlineMonths`. Sie wird **am Stichtag**
aus der Tarifzuordnung der **Verleiherseite** gelesen (3.3) — anders als in 5.1,
wo die Einsatzbranche maßgeblich ist. Die Abweichung vom
Gleichstellungsgrundsatz ist eine Regelung des **Zeitarbeitstarifvertrags**;
ohne ihn gibt es keine Abweichung.

| Fall | Datenlage | Frist | Ergebnis von P3 |
|---|---|---|---|
| 1 | Keine gültige Zuordnung mit `appliesToType = supplier` am Stichtag (`supplier.supplierCollectiveAgreement` fehlt oder ist abgelaufen) | **0 Monate** — Equal Pay gilt ab dem **ersten** Überlassungstag (§ 8 Abs. 1 AÜG) | **Warnung**: `supplierCollectiveAgreement` ist ab `active` Pflicht (3.2); das Fehlen ist ein Datenfehler mit unmittelbarer Entgeltfolge |
| 2 | Zuordnung vorhanden, `equalPayDeadlineMonths` leer | **9 Monate** (gesetzliche Regelfrist, § 8 Abs. 4 Satz 1) | Information |
| 3 | Zuordnung vorhanden, `equalPayDeadlineMonths` ≤ 9 | der angegebene Wert | Information |
| 4 | `equalPayDeadlineMonths` > 9 **und** `industryPremiumScheme` gesetzt | der angegebene Wert, **höchstens 15** | Information; bei Begrenzung auf 15 zusätzlich Warnung |
| 5 | `equalPayDeadlineMonths` > 9, **kein** `industryPremiumScheme` | **9 Monate** — der angegebene Wert ist nicht verwendbar: die Verlängerung über neun Monate setzt die stufenweise Annäherung voraus (§ 8 Abs. 4 Satz 2) | **Warnung** mit Nennung der unzulässigen Konfiguration, Adressat `MA` |
| 6 | `equalPayDeadlineMonths` > 15 | **15 Monate** (gesetzliche Obergrenze) | **Warnung** mit Nennung der unzulässigen Konfiguration, Adressat `MA` |

Die Werte 9 und 15 sind **gesetzliche** Werte und stehen deshalb in diesem
Kapitel; die Stufenfolge eines konkreten Branchenzuschlagstarifs steht als
Konfiguration am `industryPremiumScheme` (3.3) und nirgends hier.

**Wechselt der Wert innerhalb einer laufenden Kette** — insbesondere beim
**Lieferantenwechsel**, weil die Frist vom Verleihertarif kommt —, gilt der Wert
am Stichtag. Rückt `equalPayDueDate` dadurch in die Vergangenheit und ist
`comparableWage` nicht gesetzt, ist das Ergebnis eine **Warnung mit
Pflicht-Eskalation** an `MA` und `KE`, keine rückwirkende Sperre (5.5.3). Auch
dies ist Gegenstand von ***offener Frage 27***.

#### 5.2.3 Berechnungsvorschrift: Equal-Pay-Fälligkeit (P3)

**Eingangsdaten.** E1 bis E5 und E7 wie in 5.1.3, zusätzlich:

| Nr. | Datum | Objekt und Feld |
|---|---|---|
| E8 | Frist in Monaten | `collectiveAgreementAssignment.equalPayDeadlineMonths` nach 5.2.2 |
| E9 | Zuschlagsschema | `collectiveAgreementAssignment.industryPremiumScheme` (3.3) |

**Rechenschritte**

1. **Kette bilden** — Schritte 1 und 2 aus 5.1.3, unverändert. `chainStartDate`
   ist derselbe Tag wie dort.
2. **Fristbudget bestimmen.** `equalPayDeadlineDays` = Zahl der Kalendertage im
   Zeitraum von `chainStartDate` bis zum Ende einer Frist von `E8` Monaten ab
   `chainStartDate`. Bei `E8` = 0 ist das Budget 0.
3. **Fälligkeit ableiten.** `equalPayDueDate` = der
   (`equalPayDeadlineDays` + 1)-te Überlassungstag der Kette — der **erste Tag,
   für den Equal Pay geschuldet ist**. Fortschreibung über das Bekannte hinaus
   wie in 5.1.3, Schritt 5. Bei `E8` = 0 ist `equalPayDueDate` =
   `chainStartDate`.
   - Lückenlose Kette, 9 Monate, `chainStartDate` = 15.01.2026:
     `equalPayDeadlineDays` = 273 (15.01. bis 14.10.), `equalPayDueDate` =
     15.10.2026.
   - Lückentage verschieben die Fälligkeit nach hinten, aus demselben Grund wie
     in 5.1 (*offene Frage 26*).
4. **Ergebnis bilden.**
   - Prüfzeitraum endet vor `equalPayDueDate` → **Information**.
   - `equalPayDueDate` fällt in den Prüfzeitraum und `comparableWage` ist
     gesetzt → **Information**.
   - `equalPayDueDate` fällt in den Prüfzeitraum und `comparableWage` fehlt →
     **Warnung**; die Ergebnisart je Übergang steht in 4.7.
   - `equalPayDueDate` liegt vor dem Prüfzeitraum (Fälligkeit längst erreicht)
     und `comparableWage` fehlt → **Warnung mit Eskalation**; am Übergang
     `inApproval` → `approved` des Stundenzettels greift P4 als **Sperre**
     (Q36).

**Ergebnisfeld.** `assignment.equalPayDueDate` (3.7, *abgeleitet*), an jedem
Einsatz der Kette fortgeschrieben. `assignment.comparableWage` ist **Pflicht ab
`equalPayDueDate`** (3.7) — dieses Kapitel liefert damit das Datum, ab dem die
Pflicht greift.

#### 5.2.4 Berechnungsvorschrift: Vergleichsentgelt (P4)

**Eingangsdaten**

| Nr. | Datum | Objekt und Feld |
|---|---|---|
| E10 | Vergleichsentgelt des Standorts | `comparableWageEntry` mit `siteRef` = `assignment.siteRef`, `activityKey` = `assignment.activityDescription`, gültig am Stichtag (3.3) |
| E11 | Herkunft der Angabe | `comparableWageEntry.wageSource` (3.3) |
| E12 | Wert am Einsatz | `assignment.comparableWage` (3.7) |
| E13 | Fälligkeit | `assignment.equalPayDueDate` aus 5.2.3 |

**Rechenschritte**

1. **Eintrag suchen.** Genau ein `comparableWageEntry` je Standort, Tätigkeit
   und Zeitraum ist gültig (3.3). Die Tätigkeit wird in **derselben Fassung**
   verglichen wie in 3.4 und 3.7 (`activityKey` ↔ `activityDescription`, 3.3).
2. **Verwendbarkeit prüfen.**
   - Kein Eintrag gefunden → **nicht verwendbar**.
   - Mehr als ein gültiger Eintrag → Datenfehler, der die Eindeutigkeit aus 3.3
     verletzt. Behandlung **wie „kein Eintrag"**, mit Nennung der
     konkurrierenden Einträge. Es wird **nicht** einer ausgewählt.
   - `wageSource = estimate` → der Eintrag ist **verwendbar, aber kein
     Nachweis** (3.3). Ergebnis: **Warnung**, auch dort, wo das Fehlen eine
     Sperre wäre. Eine Schätzung lässt den Übergang zu und bleibt sichtbar,
     statt ihn zu blockieren — die Entscheidung dazu steht in 3.3 und wird hier
     nur ausgerechnet.
   - `wageSource` ∈ {`collectiveAgreement`, `companyAgreement`,
     `individualContract`} → **Nachweis**.
3. **Wert am Einsatz prüfen.**
   - Stichtag vor `equalPayDueDate` und `comparableWage` leer → **Information**
     (noch nicht Pflicht).
   - Stichtag ab `equalPayDueDate` und `comparableWage` leer → **Treffer**;
     Ergebnisart je Übergang nach 4.7 (Q18 Warnung, Q36 und Q48 Sperre).
   - `comparableWage` gesetzt und gleich dem Standorteintrag → **Information**.
   - `comparableWage` **niedriger** als der Standorteintrag → **Warnung** mit
     Eskalation an `KE`; die Abweichung ist nach 3.7 nur mit Begründung
     zulässig und wird protokolliert. Eine Abweichung nach unten verkleinert
     das geschuldete Entgelt und ist deshalb nie eine stille Änderung.
   - `comparableWage` **höher** als der Standorteintrag → **Information**.
     Mehr als das Vergleichsentgelt zu gewähren ist zulässig.
4. **Sichtbarkeit beachten.** Der Lieferant erhält den Wert für den konkreten
   Einsatz (`comparableWage`, 3.7), **nie** den Katalog des Standorts (3.3).
   Eine Warnung an `LD` nennt deshalb den Einsatzwert und nicht den
   Standorteintrag.

#### 5.2.5 Berechnungsvorschrift: Branchenzuschlag (P5)

**Eingangsdaten.** E9 (`industryPremiumScheme` der Verleiherzuordnung),
`customer.industrySector` bzw. die Tarifzuordnung des Standorts (3.1),
`countedDurationDays` der Kette aus 5.1.3.

**Rechenschritte**

1. **Schema bestimmen.** `industryPremiumScheme` aus der am Stichtag gültigen
   Zuordnung der Verleiherseite. Fehlt es, ist kein Branchenzuschlag anwendbar →
   **Information** (Q19) bzw. **Information** am Beleg (Q40).
2. **Einsatzbranche bestimmen.** Aus der Tarifzuordnung des Standorts
   (`appliesToType = site`), ersatzweise `customer.industrySector` (3.1). Fehlt
   beides, ist die Stufe nicht bestimmbar → **Warnung** mit Nennung des
   fehlenden Feldes.
3. **Stufe bestimmen.** Die Stufenfolge ist **Konfiguration** am Schema und wird
   hier nicht ausgeschrieben. Eingangsgröße ist die Zahl der Überlassungstage
   der **Kette** nach 5.1.3 — mit derselben Anrechnungs- und Reset-Regel. Das
   Ergebnis ist die Stufe, nicht der Betrag.
4. **Plausibilität am Beleg.** Bei → `created` (Q40) wird geprüft, ob die
   abgerechneten Zuschlagsarten (`billingDocumentItem.premiumTypeRef`, 3.9) zur
   ermittelten Stufe passen. Das System prüft die **Zuordnung**, nicht die Höhe:
   die Höhe steht in der Preisposition (3.3) und ist kaufmännisch vereinbart.
   Abweichung → **Information** mit Nennung der betroffenen Positionen.

**Keine Zahl aus einem Tarifvertrag.** P5 nennt keine Prozentsätze, keine
Stufengrenzen und keine Branchenzuordnung. Sie alle sind Konfiguration (3.3,
Entscheidung zu Frage 3).

#### 5.2.6 Grenzfälle

| Grenzfall | Festlegung |
|---|---|
| **Tag genau auf der Grenze** | `equalPayDueDate` ist der **erste** Tag mit Equal-Pay-Pflicht, nicht der letzte ohne. Ein Stundenzettel, dessen Zeitraum an diesem Tag beginnt, braucht `comparableWage` |
| **Unterbrechung exakt drei Monate** | **Kein** Reset (§ 8 Abs. 4 Satz 4: „mehr als drei Monate"), identisch zu 5.1.4. Die Vorzeiten werden angerechnet, `equalPayDueDate` verschiebt sich um die Lückentage nach hinten |
| **Unterbrechung über drei Monate** | Reset. Die Frist beginnt mit dem neuen `chainStartDate` neu — und zwar auch dann, wenn Equal Pay vor der Unterbrechung schon fällig war |
| **Lieferantenwechsel mitten im Einsatz** | Die **Kette** läuft weiter (entleiherbezogen), die **Frist** kann sich ändern, weil sie vom Verleihertarif kommt (5.2.2). Rückt die Fälligkeit dadurch in die Vergangenheit: Warnung mit Eskalation, keine rückwirkende Sperre. Hat der neue Verleiher keinen Tarif, gilt Fall 1 — Equal Pay ab dem ersten Tag des **neuen** Einsatzes |
| **Rückwirkende Korrektur** | Neuberechnung von `equalPayDueDate` an allen Einsätzen der Kette. Genehmigte Stundenzettel und freigegebene Belege werden **nicht** entwertet; Korrekturen laufen über Korrekturfassung (4.4) und Storno/Nachbeleg (4.5). Wird Equal Pay dadurch für einen abgerechneten Zeitraum rückwirkend fällig, ist das Ergebnis eine Warnung mit Pflicht-Eskalation an `MA` und `KE` |
| **Fehlende Personenidentität** | Kette auf einen Lieferanten begrenzt. Die Fälligkeit kann dadurch nur **zu spät** berechnet werden, nie zu früh — das Ergebnis trägt den Vermerk „Zählgrundlage auf einen Lieferanten begrenzt" und ist bei fehlendem `comparableWage` mindestens eine Warnung |
| **Unbestätigter maschineller Treffer** | Zählt nicht (3.6) |
| **Zeitraum ohne Tarifzuordnung** | Fall 1 in 5.2.2: **keine** Abweichung vom Gleichstellungsgrundsatz, Equal Pay ab dem ersten Überlassungstag. Das ist die strengste Folge einer fehlenden Angabe in diesem Kapitel — und die rechtlich einzig mögliche, weil die Abweichung den Tarifvertrag voraussetzt |
| **Tätigkeit ohne Vergleichsentgelt-Eintrag** | P4 nicht verwendbar (5.2.4, Schritt 2). Der Entleiher pflegt den Eintrag (3.3); die Meldung geht an `KE` |
| **Tätigkeit am Einsatz weicht von der Anfrage ab** | Maßgeblich ist `assignment.activityDescription` (3.7), nicht die der Bedarfsanfrage. Eine Änderung der Tätigkeit am Einsatz kann einen anderen Vergleichsentgelt-Eintrag treffen und löst die Neuberechnung von P4 aus |
| **`wageSource = estimate`** | Verwendbar, aber kein Nachweis: Warnung statt Sperre (3.3, 5.2.4) |
| **Standortwechsel innerhalb desselben Kunden** | Die Kette läuft weiter (entleiherbezogen), der Vergleichsentgelt-Eintrag wechselt mit dem Standort. Fehlt er am neuen Standort, greift P4 |

#### 5.2.7 Was gilt, wenn Daten fehlen

| Fehlendes Datum | Verhalten |
|---|---|
| Keine Verleiher-Tarifzuordnung | Equal Pay ab dem ersten Überlassungstag, Warnung an `MA` (5.2.2, Fall 1). **Nicht** 9 Monate — die Frist setzt den Tarifvertrag voraus |
| `equalPayDeadlineMonths` leer | Regelfrist 9 Monate, Information |
| `industryPremiumScheme` fehlt bei Frist > 9 | Frist auf 9 begrenzt, Warnung (Fall 5) |
| Kein `comparableWageEntry` | P4 nicht verwendbar; Ergebnisart je Übergang (Q18 Warnung, Q36 Sperre, Q48 Sperre), Meldung an `KE` mit Standort und Tätigkeit |
| `comparableWage` am Einsatz leer nach Fälligkeit | Treffer nach 5.2.4, Schritt 3 |
| `industrySector` und Standort-Tarifzuordnung fehlen | Stufe nicht bestimmbar, P5 **Warnung** statt Information — die Stufe wirkt auf das geschuldete Entgelt |
| Kein `activityDescription` am Einsatz | Verstoß gegen 3.7 (Pflichtfeld) und gegen die Konkretisierungspflicht (5.3.3). P4 nicht ausführbar → wie ein Treffer; zusätzlich greift P8 |

#### 5.2.8 Bediente Prüfungen

| Prüfung | Zeilen in 4.7 | Ergebnisart (bestätigt in 5.5.5) |
|---|---|---|
| P3 Equal-Pay-Frist | Q29 (Verlängerung, Vorschau), Q34 (Stundenzettel), Q27 (Abschluss) | Warnung / Warnung / Information |
| P4 Vergleichsentgelt | Q18 (Einsatz anlegen), Q32 (Verlängerung), Q36 (Zettelgenehmigung), Q39 (Beleg), Q48 (Einsatzstart, neu) | Warnung / Warnung / **Sperre** / Warnung / **Sperre** |
| P5 Branchenzuschlag | Q19 (Einsatz anlegen), Q40 (Beleg) | Information / Information |

### 5.3 Drehtürklausel, Arbeitskampf, Kennzeichnung

Bedient die Prüfungen **P6** (`revolvingDoorCheck`), **P7**
(`industrialActionCheck`), **P8** (`concretizationCheck`) und **P11**
(`employmentRelationshipCheck`).

#### 5.3.1 Drehtürklausel (P6)

**Die Regel in Worten.** Die tarifliche Abweichung vom
Gleichstellungsgrundsatz (§ 8 Abs. 2 AÜG) gilt **nicht** für einen
Leiharbeitnehmer, der in den letzten **sechs Monaten** vor der Überlassung aus
einem Arbeitsverhältnis beim **Entleiher** oder bei einem Arbeitgeber
**desselben Konzerns** (§ 18 AktG) ausgeschieden ist (§ 8 Abs. 3 AÜG).

**Die Rechtsfolge ist Equal Pay, nicht ein Einsatzverbot.** Das ist der
wichtigste Punkt dieser Regel und der Grund, aus dem 5.5.5 die Ergebnisarten der
Zeilen Q12 und Q15 ändert. § 8 Abs. 3 untersagt die Überlassung **nicht** — er
nimmt dem Verleiher die Möglichkeit, tariflich nach unten abzuweichen. Wer die
Drehtür als Sperre modelliert, verhindert einen zulässigen Einsatz und
verschweigt gleichzeitig die Entgeltfolge, auf die es ankommt.

**Herkunft und Form der Angabe** (3.6 verweist diese Festlegung ausdrücklich
hierher): Grundlage ist die **Erklärung des Kandidaten**, die der Verleiher
einholt und in `candidate.previousEmploymentDeclaration` (3.6) festhält. Der
Inhalt ist abschließend:

1. Bestand in den letzten sechs Monaten vor dem vorgesehenen
   Überlassungsbeginn ein Arbeitsverhältnis beim Entleiher oder bei einem
   Unternehmen desselben Konzerns — ja oder nein?
2. Wenn ja: **Ende** dieses Arbeitsverhältnisses (Datum) und der Arbeitgeber,
   bezogen auf den Entleiher oder dessen Konzern.
3. Datum der Erklärung und die Person, die sie abgegeben hat.

Das Feld bleibt in 3.6 **optional**; erforderlich wird es durch diese Regel
vor dem Übergang des Einsatzes nach `planned` (unten).

**Keine Gegenprüfung beim Entleiher.** Der Entleiher kennt seine ehemaligen
Beschäftigten, das VMS nicht — es führt keine Stammbelegschaft. Ein Abgleich
gegen Personaldaten des Entleihers ist im Prototyp **nicht** vorgesehen; er wäre
eine eigene fachliche und datenschutzrechtliche Entscheidung. Die Verantwortung
für die Richtigkeit der Erklärung liegt beim Verleiher.

**Berechnungsvorschrift**

| Nr. | Eingangsdatum | Objekt und Feld |
|---|---|---|
| E14 | Erklärung zur Vorbeschäftigung | `candidate.previousEmploymentDeclaration` (3.6) |
| E15 | Entleiher | `assignment.customerRef` bzw. `demandRequest.customerRef` |
| E16 | Konzernzugehörigkeit des Entleihers | `customer.corporateGroup` (3.1) |
| E17 | Vorgesehener Überlassungsbeginn | `assignment.plannedStartDate`, am Profilvorschlag `candidateSubmission.availableFrom` |

1. **Stichtag bestimmen:** der vorgesehene erste Überlassungstag (E17).
2. **Rückschaufenster bestimmen:** die sechs Monate vor dem Stichtag, also
   `fensterVon` = Stichtag − 6 Monate (§§ 187 Abs. 2, 188 Abs. 2 BGB) bis
   `fensterBis` = Stichtag − 1 Tag.
3. **Erklärung auswerten:**
   - Erklärung fehlt → **nicht prüfbar** (siehe „Wenn Daten fehlen" unten).
   - Erklärung „nein" → **kein Treffer**, Information.
   - Erklärung „ja" mit Ende **innerhalb** des Fensters → **Treffer**.
   - Erklärung „ja" mit Ende **vor** `fensterVon` → kein Treffer, Information
     mit Nennung des Austrittsdatums (die Angabe bleibt sichtbar, weil eine
     Verschiebung des Starttermins sie wieder in das Fenster holen kann).
   - Erklärung „ja" ohne Datum → **nicht prüfbar**.
4. **Konzernbezug prüfen:** Der Treffer gilt auch, wenn der frühere Arbeitgeber
   nicht der Entleiher selbst, sondern ein Unternehmen desselben Konzerns war
   (E16). Ist `corporateGroup` beim Kunden leer, wird nur der Entleiher selbst
   geprüft; das Ergebnis trägt dann die Information, dass die
   Konzernbetrachtung nicht möglich war.
5. **Rechtsfolge setzen:** Bei einem Treffer ist `equalPayDeadlineMonths` für
   diese Überlassung **nicht anwendbar**. 5.2.3 rechnet mit `E8` = 0:
   `equalPayDueDate` = `chainStartDate`, Equal Pay also **ab dem ersten
   Überlassungstag**. Das Ergebnis von P6 ist eine **Warnung** mit Nennung
   dieser Folge, adressiert an `MD` und `LD`; `comparableWage` ist damit ab dem
   ersten Tag Pflicht (3.7), und P4 greift entsprechend.

**Grenzfälle**

| Grenzfall | Festlegung |
|---|---|
| **Tag genau auf der Grenze** | Ende des früheren Arbeitsverhältnisses exakt am Tag `fensterVon` → **Treffer** (der Tag liegt im Fenster). Ende am Tag davor → kein Treffer |
| **Starttermin verschiebt sich** | Das Fenster hängt am Überlassungsbeginn. Verschiebt sich `plannedStartDate` nach hinten, kann ein Treffer entfallen; P6 wird bei jedem betroffenen Übergang neu gerechnet und das Ergebnis am Vorgang ersetzt, nicht ergänzt |
| **Lieferantenwechsel mitten im Einsatz** | Der neue Einsatz hat einen neuen Überlassungsbeginn und damit ein neues Fenster. Die Erklärung ist für den **neuen** Kandidatensatz beim neuen Verleiher erneut einzuholen — sie ist eine Angabe des Kandidaten gegenüber **seinem** Arbeitgeber, nicht eine Eigenschaft der Person im System |
| **Rückwirkende Korrektur** | Wird das Austrittsdatum nachträglich korrigiert und greift die Drehtür dadurch, rückt `equalPayDueDate` auf `chainStartDate`. Folge: Warnung mit Pflicht-Eskalation an `MA` und `KE`, keine Sperre und keine Entwertung abgerechneter Zeiten (5.5.3) |
| **Fehlende oder unbestätigte Personenidentität** | Ohne Belang: P6 beruht auf der **Erklärung des Kandidaten**, nicht auf der Einsatzhistorie. Die Personenidentität hilft nur, eine bereits vorliegende Erklärung eines anderen Kandidatensatzes derselben Person zu finden — sie ersetzt sie nicht |
| **Zeitraum ohne Tarifzuordnung** | Dann gilt ohnehin Equal Pay ab dem ersten Tag (5.2.2, Fall 1). P6 läuft trotzdem und liefert Information, damit der Grund dokumentiert ist |
| **Konzern ohne gepflegte Zugehörigkeit** | `corporateGroup` leer → nur der Entleiher selbst wird geprüft, mit Information an `MA` (Schritt 4) |

**Wenn Daten fehlen.** Fehlt die Erklärung oder ist sie unvollständig, ist P6
**nicht prüfbar**. Dann gilt:

- Am Profilvorschlag `submitted` → `reviewed` (Q08): **Warnung** mit Nennung des
  fehlenden Feldes, Adressat `LD` über `MD`.
- Am Profilvorschlag → `accepted` (Q12) und am Einsatz → `planned` (Q15):
  **Sperre**. Der Grund ist nicht die Drehtür, sondern die fehlende
  Tatsachengrundlage: eine Erklärung ist vom Verleiher in Stunden zu beschaffen,
  während die Entgeltfolge für die gesamte Überlassung gilt. Die Sperre hat
  damit einen offenen, zumutbaren Weg — das ist das Kriterium aus 5.5.2.
- `equalPayDueDate` wird **nicht** vorgezogen, solange die Erklärung fehlt. Eine
  Entgeltfolge ohne Tatsachengrundlage zu setzen wäre eine Annahme, und
  Annahmen trifft dieses Kapitel nicht.

#### 5.3.2 Einsatzverbot bei Arbeitskampf (P7)

**Die Regel in Worten.** Der Entleiher darf Leiharbeitnehmer nicht tätig werden
lassen, wenn sein Betrieb **unmittelbar von einem Arbeitskampf betroffen** ist
(§ 11 Abs. 5 Satz 1 AÜG). Das gilt nicht, wenn der Entleiher sicherstellt, dass
der Leiharbeitnehmer **keine Tätigkeiten übernimmt**, die bisher von
Arbeitskampfbetroffenen ausgeübt wurden (Satz 2). Der Leiharbeitnehmer ist
nicht verpflichtet, in einem betroffenen Betrieb tätig zu werden (Satz 3).

**Erforderliche Angaben.** Die Prüfung braucht drei Dinge:

| Angabe | Inhalt | Herkunft |
|---|---|---|
| Arbeitskampfanzeige | Standort, Von-Datum, Bis-Datum (offen zulässig), betroffene Bereiche oder Tätigkeiten | Meldung des Entleihers (`KE` oder `KB`) |
| Zusicherung nach § 11 Abs. 5 Satz 2 | Erklärung des Entleihers, dass der Leiharbeitnehmer keine Tätigkeiten der Arbeitskampfbetroffenen übernimmt, mit Datum und erklärender Person | Erklärung des Entleihers, je Einsatz |
| Betroffenheit des Einsatzes | Vergleich von `assignment.siteRef` und `activityDescription` mit der Anzeige | abgeleitet |

> **Lücke in Kapitel 3.** Für die Arbeitskampfanzeige führt **3.1 heute kein
> Feld** am Standort, und für die Zusicherung gibt es kein Objekt. 4.7 setzt sie
> in Q05 und Q22 aber voraus. Dieses Kapitel **erfindet das Feld nicht** (5.0,
> Lesart 4): es beschreibt, welche Angaben die Regel braucht, und benennt die
> Lücke. Behelfsweise sind Anzeige und Zusicherung als `document` mit
> `documentCategory = other` am Standort bzw. am Einsatz zu hinterlegen (3.10) —
> damit ist die Regel prüfbar, aber nicht auswertbar. Die saubere Lösung ist
> ein Feldsatz am Standort und eine Erklärung am Einsatz; sie gehört nach 3.1
> bzw. 3.7. Wer die Zusicherung abgeben darf, ist ***offene Frage 30***.

**Berechnungsvorschrift**

1. **Stichtag bzw. Prüfzeitraum** nach 5.0. Bei → `tendered` ist es der Zeitraum
   bis `offerDeadline`, bei `planned` → `active` der `actualStartDate`, im
   nächtlichen Lauf der Tag des Laufs.
2. **Anzeige suchen:** Liegt für `assignment.siteRef` (bzw.
   `demandRequest.siteRef`) eine Arbeitskampfanzeige vor, deren Zeitraum den
   Stichtag bzw. einen Tag des Prüfzeitraums enthält?
   - Nein → **kein Treffer**, Information.
   - Ja → weiter.
3. **Zusicherung prüfen:** Liegt für diesen Einsatz eine Zusicherung nach § 11
   Abs. 5 Satz 2 vor, die den Stichtag abdeckt?
   - Ja → **Warnung** statt Treffer. Der Einsatz ist zulässig, der Sachverhalt
     bleibt sichtbar und wird eskaliert, solange der Arbeitskampf läuft.
   - Nein → **Treffer**.
4. **Ergebnisart** je Übergang nach 4.7: Q05 Warnung (ausschreiben), Q22 Sperre
   (Einsatzstart).

**Laufender Einsatz während eines Arbeitskampfs.** Beginnt ein Arbeitskampf,
während ein Einsatz `active` ist, erzeugt der nächtliche Lauf (5.5.1, Zeile N4)
eine **Warnung mit Pflicht-Eskalation** an `MD` und `MA` und schlägt die
Unterbrechung vor. Das System unterbricht **nicht** selbst: ein
Systemstatuswechsel am laufenden Einsatz hätte arbeits- und vertragsrechtliche
Folgen, und 4.0 Regel 4 lässt zeitgesteuerte Übergänge nur dort zu, wo sie
entziehen. Der Übergang `active` → `interrupted` liegt in 4.3.1 bereit und wird
von `MD` ausgelöst.

**Grenzfälle**

| Grenzfall | Festlegung |
|---|---|
| **Tag genau auf der Grenze** | Der erste und der letzte Tag der Anzeige sind betroffen. Ein Einsatzstart am Tag nach dem Ende der Anzeige ist zulässig |
| **Anzeige ohne Bis-Datum** | Zulässig (der Arbeitskampf läuft). Der Prüfzeitraum ist dann bis auf Weiteres betroffen; das Ende ist vom Entleiher nachzutragen. Der nächtliche Lauf erinnert nach `maxDurationNoticeDays`-Logik nicht — stattdessen wird die offene Anzeige täglich als Warnung geführt, solange ein betroffener Einsatz besteht |
| **Nur ein Teil des Betriebs betroffen** | Die Anzeige nennt Bereiche oder Tätigkeiten. Deckt sie die `activityDescription` des Einsatzes nicht ab, ist das Ergebnis eine **Warnung** statt eines Treffers — die Beurteilung „unmittelbar betroffen" ist eine Entscheidung des Entleihers, nicht eine Textvergleichsoperation des Systems |
| **Lieferantenwechsel mitten im Einsatz** | Ohne Belang: P7 ist standort- und entleiherbezogen, nicht lieferantenbezogen. Der neue Einsatz wird am Einsatzstart erneut geprüft |
| **Rückwirkende Anzeige** | Wird ein Arbeitskampf nachträglich für einen vergangenen Zeitraum angezeigt, in dem ein Einsatz lief, ist das Ergebnis eine **Warnung mit Pflicht-Eskalation** an `MA`. Eine Sperre greift nicht mehr; genehmigte Zeiten werden nicht entwertet (5.5.3) |
| **Fehlende Angaben** | Ohne Anzeige **kein** Treffer. Das ist die **einzige** Ausnahme vom Grundsatz aus 5.0, und sie ist notwendig: eine fehlende Anzeige bedeutet im Regelfall, dass kein Arbeitskampf läuft, und der Grundsatz würde jeden Einsatzstart sperren. Der Preis ist, dass die Regel nur so gut ist wie die Meldedisziplin des Entleihers — das ist in 5.5.1 als Grenze festgehalten und gehört in den Rahmenvertrag, nicht in die Rechenvorschrift |

#### 5.3.3 Kennzeichnungs- und Konkretisierungspflicht (P8)

**Die Regel in Worten.** Verleiher und Entleiher haben die Überlassung **vor
Beginn** der Überlassung in ihrem Vertrag ausdrücklich als
Arbeitnehmerüberlassung zu **bezeichnen** (Kennzeichnung) und die Person des
Leiharbeitnehmers **vor der Überlassung** unter Bezugnahme auf diesen Vertrag zu
**konkretisieren** (§ 1 Abs. 1 Sätze 5 und 6 AÜG). Ein Verstoß führt nach § 9
Abs. 1 Nr. 1a AÜG zur Unwirksamkeit des Arbeitsvertrags und nach § 10 Abs. 1 AÜG
zu einem Arbeitsverhältnis beim Entleiher.

Dies ist die Regel mit der **schärfsten** Rechtsfolge und der **schwächsten**
Datengrundlage: das System kann die Form des Vertrags nicht beurteilen. Deshalb
ist P8 eine **formale** Prüfung mit klaren Kriterien, und die fachliche
Beurteilung bleibt beim `MD`.

**Prüfkriterien**

| Kriterium | Prüfgegenstand | Objekt und Feld |
|---|---|---|
| K1 Kennzeichnung | Der Einsatz ist auf einen **aktiven Rahmenvertrag der Lieferantenseite** zurückzuführen: `agreementType = supplierAgreement`, Status `active`, Gegenpartei = `assignment.supplierRef`, Laufzeit deckt den Prüfzeitraum. Der Weg führt über `assignment.agreedRateCardItemRef` → `rateCard.masterAgreementRef` (3.3) | 3.3, 3.7 |
| K2 Konkretisierung der Person | `assignment.candidateRef` gesetzt (3.7) | 3.7 |
| K3 Konkretisierung der Tätigkeit | `assignment.activityDescription` gesetzt, nicht leer und **nicht identisch** mit `demandRequest.title`; am Einsatz eigenständig geführt, nicht nur ein Verweis auf die Anfrage (3.7) | 3.7 |
| K4 Konkretisierung von Ort und Zeit | `assignment.siteRef` und `plannedStartDate` gesetzt (3.7) | 3.7 |
| K5 Rechtzeitigkeit | K1 bis K4 sind **vor** dem ersten Überlassungstag erfüllt: der Zeitpunkt des Übergangs nach `planned` liegt vor `actualStartDate` | 3.7, 3.12 |

**Berechnungsvorschrift**

1. An der **Bedarfsanfrage** (Q01, Q02) werden nur die Vorläufer von K3 geprüft:
   `activityDescription` gesetzt, nicht identisch mit `title`, mindestens eine
   `qualificationRequirement`. Die Bedarfsanfrage ist kein Überlassungsvertrag;
   das Ergebnis ist Information bzw. Warnung.
2. Am **Einsatz** → `planned` (Q45, neu) werden K1 bis K4 geprüft. Fehlt eines,
   ist das Ergebnis eine **Sperre**: der Weg ist offen und zumutbar — das
   fehlende Feld ist nachzutragen.
3. Am **Einsatz** `planned` → `active` (Q46, neu) wird K5 geprüft, zusammen mit
   K1 bis K4 erneut, weil sich Rahmenvertrag und Felder zwischen Anlage und
   Start geändert haben können. Fehlt eines, ist das Ergebnis eine **Sperre** —
   nach dem ersten Überlassungstag ist der Verstoß nicht mehr heilbar.
4. **Keine inhaltliche Beurteilung.** Ob eine vorhandene
   `activityDescription` die Tätigkeit zutreffend beschreibt, prüft das System
   nicht und behauptet es auch nicht. Das Ergebnis nennt deshalb immer, **was**
   geprüft wurde (die Kriterien), nicht „die Konkretisierung ist erfüllt".

**Grenzfälle**

| Grenzfall | Festlegung |
|---|---|
| **Tag genau auf der Grenze** | K5 verlangt „vor der Überlassung". Ein Übergang nach `planned` **am** ersten Überlassungstag genügt, solange er vor dem Übergang nach `active` liegt; das System kann die Tagesreihenfolge, nicht die Uhrzeit des Vertrags beurteilen. Ein Übergang nach `planned` **nach** `actualStartDate` ist ein Treffer |
| **Rahmenvertrag läuft im Einsatzzeitraum ab** | K1 verlangt Deckung des **Prüfzeitraums**. Endet der Rahmenvertrag vor `plannedEndDate`, ist das Ergebnis eine **Warnung** mit Nennung des Enddatums — nicht eine Sperre, weil die Kennzeichnung bei Beginn vorlag und der Vertrag verlängert werden kann |
| **Lieferantenwechsel mitten im Einsatz** | Der neue Einsatz braucht einen eigenen aktiven Rahmenvertrag des neuen Lieferanten (K1) und eine eigene Konkretisierung (K2 bis K4). Die Übernahme der Angaben aus dem alten Einsatz ist eine Änderung, keine Fortschreibung |
| **Rückwirkende Korrektur** | Wird `activityDescription` nachträglich geändert, läuft P8 erneut und P4 ebenfalls (die Tätigkeit bestimmt das Vergleichsentgelt, 5.2.4). Ein in der Vergangenheit erfüllter Verstoß wird festgestellt und eskaliert, nicht rückwirkend gesperrt |
| **Einsatz ohne Bedarfsanfrage** | Zulässig (3.7, `demandRequestRef` optional). K3 prüft dann nur auf „gesetzt und nicht leer"; der Vergleich mit `title` entfällt |
| **Fehlende Preisposition** | Ohne `agreedRateCardItemRef` ist K1 nicht prüfbar. Das Feld ist in 3.7 Pflicht; der Fall ist ein Datenfehler und wirkt wie ein Treffer (5.0) |

#### 5.3.4 Arbeitsverhältnis beim Verleiher (P11)

**Die Regel in Worten.** Arbeitnehmerüberlassung setzt voraus, dass der Verleiher
**Arbeitgeber** des überlassenen Arbeitnehmers ist (§ 1 Abs. 1 Satz 1 AÜG). Ohne
Arbeitsverhältnis beim Verleiher gibt es keine Überlassung, sondern eine
Arbeitsvermittlung oder einen anderen Sachverhalt.

**Prüfzeitpunkt** (3.6 verweist diese Festlegung ausdrücklich hierher): Das
Arbeitsverhältnis muss **am ersten Überlassungstag** bestehen, nicht früher. Das
ist der Grund, aus dem 5.5.5 die Ergebnisarten der Zeilen Q13 und Q17 von Sperre
auf Warnung ändert und die Sperre in der neuen Zeile Q47 an den Einsatzstart
setzt: ein Kandidat im Status `applicant` darf vorgeschlagen und zugesagt
werden — der Arbeitsvertrag wird in der Branche regelmäßig **für** den Einsatz
geschlossen. Eine Sperre bei der Zusage oder bei der Einsatzplanung würde den
Regelfall unmöglich machen, ohne eine einzige unzulässige Überlassung zu
verhindern.

**Berechnungsvorschrift**

| Nr. | Eingangsdatum | Objekt und Feld |
|---|---|---|
| E18 | Beschäftigungsverhältnis | `candidate.employmentStatusWithSupplier` ∈ {`employed`, `applicant`} (3.6) |
| E19 | Beschäftigt seit | `candidate.employedSince` (3.6, Pflicht bei `employed`) |
| E20 | Erster Überlassungstag | `assignment.actualStartDate`, ersatzweise `plannedStartDate` |

1. **Vorprüfung** am Profilvorschlag (Q09), bei der Zusage (Q13) und bei der
   Einsatzplanung (Q17):
   - `employed` und `employedSince` ≤ E20 → **Information**.
   - `employed` und `employedSince` > E20 → **Warnung**: das
     Arbeitsverhältnis beginnt nach dem vorgesehenen Überlassungsbeginn.
   - `applicant` → **Warnung** mit Nennung der Folge: bis zum Einsatzstart ist
     ein Arbeitsverhältnis nachzuweisen, sonst greift Q47.
2. **Prüfung am Einsatzstart** `planned` → `active` (Q47, neu), Stichtag
   `actualStartDate`:
   - `employed` und `employedSince` ≤ `actualStartDate` → **Information**.
   - sonst → **Sperre**.

**Grenzfälle**

| Grenzfall | Festlegung |
|---|---|
| **Tag genau auf der Grenze** | `employedSince` = `actualStartDate` genügt. Das Arbeitsverhältnis muss am ersten Überlassungstag bestehen, nicht vorher begonnen haben |
| **Lieferantenwechsel mitten im Einsatz** | Der neue Einsatz hat einen eigenen Kandidatensatz beim neuen Verleiher (3.6) mit eigenem `employmentStatusWithSupplier`. P11 prüft **diesen**, nicht den alten. Ein Wechsel ohne neues Arbeitsverhältnis ist gesperrt |
| **Rückwirkende Korrektur** | Wird `employedSince` nachträglich nach hinten korrigiert, sodass es nach dem Überlassungsbeginn liegt, ist das Ergebnis eine **Warnung mit Pflicht-Eskalation** an `MA`: der Befund ist § 1 Abs. 1 AÜG und damit potenziell § 9/§ 10 — festgestellt, nicht gesperrt (5.1.7, 5.5.3) |
| **Kandidat `inactive`** | Ein Kandidat in `inactive` (3.6) darf nicht überlassen werden. Behandlung wie `applicant`: Warnung in der Vorprüfung, **Sperre** am Einsatzstart |
| **Fehlende oder unbestätigte Personenidentität** | Ohne Belang: P11 ist eine Eigenschaft des Kandidatensatzes beim Verleiher, nicht der Person über Lieferanten hinweg |
| **Fehlende Angaben** | `employmentStatusWithSupplier` ist in 3.6 Pflicht, `employedSince` Pflicht bei `employed`. Fehlt eines, wirkt das wie ein Treffer (5.0) — in der Vorprüfung Warnung, am Einsatzstart Sperre |

#### 5.3.5 Abgrenzung zu Werk- und Dienstvertrag

Das System kennt **nur** erklärte Arbeitnehmerüberlassung: jeder Einsatz (3.7)
**ist** eine Überlassung, und die Kennzeichnung nach K1 stellt den Bezug zum
Überlassungsvertrag her. Ein Werk- oder Dienstvertrag ist im Datenmodell nicht
abgebildet und kann im VMS nicht entstehen.

Eine **verdeckte** Überlassung — eine als Werkvertrag bezeichnete Leistung, die
tatsächlich Überlassung ist — kann das System nicht erkennen, weil der Vorgang
außerhalb des VMS läuft. Der Beitrag des Systems ist deshalb ein indirekter: wer
einen Einsatz im VMS anlegt, erklärt ihn damit als Überlassung, und P8 stellt
sicher, dass Kennzeichnung und Konkretisierung vorliegen. Mehr leistet dieses
Kapitel nicht, und es behauptet es auch nicht.

#### 5.3.6 Systemverhalten je Regel

| Prüfung | Harte Sperre, wo … | Dokumentierte Ausnahme |
|---|---|---|
| P6 Drehtür | die Erklärung **fehlt** (Q12, Q15) | **Keine Übersteuerung.** Der Treffer selbst ist keine Sperre, sondern setzt Equal Pay ab dem ersten Tag. Die Sperre bei fehlender Erklärung wird durch Beibringen der Erklärung aufgelöst |
| P7 Arbeitskampf | eine Anzeige den Einsatzstart abdeckt und **keine** Zusicherung vorliegt (Q22) | **Keine Übersteuerung.** Die gesetzliche Ausnahme ist die Zusicherung nach § 11 Abs. 5 Satz 2 — ein eigener, dokumentierter Sachverhalt, keine Abweichung von der Regel (5.5.4) |
| P8 Kennzeichnung | ein Kriterium K1 bis K5 nicht erfüllt ist (Q45, Q46) | **Keine Übersteuerung.** Die Konkretisierung wird nachgetragen, nicht übersteuert |
| P11 Arbeitsverhältnis | am Einsatzstart kein Arbeitsverhältnis besteht (Q47) | Übersteuerung denkbar, wenn der Arbeitsvertrag nachweislich besteht, aber im System nicht erfasst ist (5.5.4, Bedingung (a)) |

#### 5.3.7 Bediente Prüfungen

| Prüfung | Zeilen in 4.7 | Ergebnisart (bestätigt in 5.5.5) |
|---|---|---|
| P6 Drehtür | Q08, Q12, Q15 | Warnung / Warnung bei Treffer, **Sperre** bei fehlender Erklärung (geändert) |
| P7 Arbeitskampf | Q05, Q22 | Warnung / **Sperre** |
| P8 Kennzeichnung und Konkretisierung | Q01, Q02, Q45 (neu), Q46 (neu) | Information / Warnung / **Sperre** / **Sperre** |
| P11 Arbeitsverhältnis | Q09, Q13, Q17, Q47 (neu) | Warnung / Warnung (geändert) / Warnung (geändert) / **Sperre** |

### 5.4 Erlaubnis, Nachweise und Fristen

Bedient die Prüfungen **P9** (`permitValidityCheck`) und **P10**
(`mandatoryDocumentCheck`). Dieser Abschnitt trägt außerdem den
**Nachweisfluss** des Dokuments, den 3.10 und 4.0 ausdrücklich hierher
verweisen, und entscheidet die **zwei Fragen**, die 4.6 offen gelassen hat.

#### 5.4.1 AÜG-Erlaubnis (P9)

**Die Regel in Worten.** Wer Arbeitnehmer gewerbsmäßig zur Arbeitsleistung
überlassen will, bedarf der **Erlaubnis** (§ 1 Abs. 1 AÜG). Die Erlaubnis wird
zunächst **befristet** auf ein Jahr erteilt und kann verlängert werden; nach
dreijähriger ununterbrochener Erlaubniserteilung kann sie **unbefristet** erteilt
werden (§ 2 Abs. 4, 5 AÜG). Überlassung ohne Erlaubnis führt nach § 9 Abs. 1
Nr. 1, § 10 Abs. 1 AÜG zur Unwirksamkeit des Arbeitsvertrags und zu einem
Arbeitsverhältnis beim Entleiher.

**Berechnungsvorschrift**

| Nr. | Eingangsdatum | Objekt und Feld |
|---|---|---|
| E21 | Erlaubnissätze des Lieferanten | `supplierPermit` mit `supplierRef` = Lieferant, historisiert über `supersedesRef` (3.2) |
| E22 | Erlaubnisart | `supplierPermit.permitType` ∈ {`fixedTerm`, `unlimited`} |
| E23 | Gültigkeit | `supplierPermit.validFrom` / `.validTo` (bei `unlimited` leer) |
| E24 | Anerkennung | `supplierPermit.verificationStatus` ∈ {`submitted`, `accepted`, `rejected`} |
| E25 | Urkunde | `supplierPermit.documentRef` auf ein `document` mit `documentCategory = permitCertificate` (3.10) |
| E26 | Prüfzeitraum | aus der Tabelle in 5.0 |

1. **Prüfzeitraum bilden.** P9 prüft nie einen einzelnen Tag, außer wo 5.0 einen
   Stichtag nennt. Für jeden **Tag** des Prüfzeitraums gilt Schritt 2.
2. **Deckung prüfen.** Ein Tag ist gedeckt, wenn **mindestens ein**
   Erlaubnissatz existiert mit
   - `verificationStatus = accepted`,
   - `validFrom` ≤ Tag,
   - `validTo` ≥ Tag **oder** `permitType = unlimited` und `validTo` leer, und
   - gesetztem `documentRef` (E25).
3. **Lücken sind Treffer.** Ist **ein** Tag des Prüfzeitraums nicht gedeckt, ist
   P9 ein Treffer — auch wenn der Zeitraum sonst gedeckt ist. Eine Lücke
   zwischen zwei befristeten Erlaubnissen (verspätete Verlängerung) ist genau
   dieser Fall und muss ein eigenes Szenario werden.
4. **Nicht anerkannt zählt nicht.** `submitted` und `rejected` decken keinen Tag.
   Eine eingestellte, aber nicht anerkannte Erlaubnis ist kein Nachweis — die
   Anerkennung ist die Handlung, mit der der Betreiber die Prüfung übernimmt
   (Fußnote [34] in 2.2).
5. **Ergebnisart** je Übergang nach 4.7: Q04 (je Einladung), Q06, Q16, Q20, Q31,
   Q41, Q43, Q44 **Sperre**; Q38 (Beleg) Warnung.
6. **Unbefristete Erlaubnis.** `permitType = unlimited` mit leerem `validTo`
   deckt jeden Tag ab `validFrom`. Ein `validTo` an einem Satz mit
   `unlimited` ist ein Datenfehler (3.2: leer bei `unlimited`) und wirkt wie ein
   befristeter Satz — das System rechnet mit dem strengeren Wert.

**Sperre je Einladung, nicht je Ausschreibung.** Q04 prüft P9 **je eingeladenem
Lieferanten**. Ein gesperrter Lieferant wird **nicht eingeladen**; der Übergang
`approved` → `tendered` findet trotzdem statt, solange mindestens eine
zulässige Einladung bleibt. Nur wenn **kein** Lieferant zulässig ist, ist der
Übergang gesperrt. Andernfalls hielte ein einzelner Lieferant mit abgelaufener
Erlaubnis die ganze Ausschreibung auf.

#### 5.4.2 Die zwei Entscheidungen, die 4.6 offen gelassen hat

**a) Setzt der Ablauf oder der Entzug der Erlaubnis den Lieferanten automatisch
auf `blocked`?** — **Nein.**

Begründung: Die **Wirkung** einer Sperre tritt ohne Statuswechsel ein. P9 sperrt
jede Einladung (Q06), jeden neuen Einsatz (Q16) und jeden Einsatzstart (Q20);
ein automatischer Statuswechsel fügt dem nichts hinzu, außer einer stillen
Änderung am Zustand einer Organisation. 4.6 weist `active` → `blocked`
ausdrücklich `MA` und `MD` mit Pflichtbegründung (`blockReason`) zu, und die
Entsperrung ist an das Vier-Augen-Prinzip gebunden ([5]). Ein Systemübergang
würde beides unterlaufen.

Was stattdessen geschieht: Der nächtliche Lauf (5.5.1, Zeile N1) stellt den
Ablauf fest, erzeugt eine **Warnung** und eskaliert nach der Stufenfolge aus
5.4.4. Die Eskalation an `MA` enthält den **Vorschlag**, den Lieferanten zu
sperren; den Übergang vollzieht ein Mensch mit Begründung.

**b) Ist ein laufender Einsatz zu beenden, wenn die Erlaubnis erlischt?** —
**Das System beendet ihn nicht.**

| Lage | Systemverhalten |
|---|---|
| Einsatz in `planned` | `planned` → `active` ist **gesperrt** (Q20). Der Einsatz bleibt stehen, bis die Erlaubnis wieder gedeckt ist |
| Einsatz in `active` oder `interrupted` | **Warnung mit Pflicht-Eskalation** an `MD` und `MA`, täglich wiederholt, solange der Zustand besteht. Der Übergang `terminatedEarly` aus Rechtsgründen liegt in 4.3.1 bereit (`MD`, Pflichtbegründung) und wird **von einem Menschen** ausgelöst |
| Verlängerung in `approved` | `approved` → `effective` ist **gesperrt** (Q31): eine Verlängerung in einen nicht gedeckten Zeitraum ist eine neue Überlassungsentscheidung |
| Abrechnung | Läuft weiter. Erbrachte Leistung wird abgerechnet; P9 am Beleg ist eine **Warnung** (Q38), die den Befund dokumentiert, keine Sperre der Abrechnung |

Begründung: Die Rechtsfolge hängt vom **Erlöschensgrund** ab — § 2 Abs. 4 AÜG
sieht für den Fall der Nichtverlängerung einen Abwicklungszeitraum vor, in dem
bestehende Verträge erfüllt werden dürfen, während Rücknahme und Widerruf
(§§ 4, 5 AÜG) anders zu beurteilen sind. Eine automatische Beendigung hätte
arbeits- und vertragsrechtliche Folgen für den Leiharbeitnehmer, die das System
nicht tragen kann, und sie wäre nach 4.0 Regel 4 ein zeitgesteuerter Übergang
mit Entzugswirkung an einem laufenden Vorgang. Welche Rechtsfolge im Einzelnen
greift und wer die Beendigung entscheidet, ist ***offene Frage 29*** — sie ist
**juristisch zu prüfen** und wird hier nicht geraten. Das Systemverhalten oben
ist so gewählt, dass es jede Antwort verträgt: es verhindert neue
Überlassungen, stellt den Befund fest und hält den Beendigungsübergang bereit.

#### 5.4.3 Nachweisfluss des Dokuments

3.10 und 4.0 verweisen den Lebenszyklus des Nachweises hierher. Er ist klein:
geprüft wird die **Anerkennung**, nicht die Gültigkeit.

| Deutsch | Bezeichner | Fachliche Bedeutung |
|---|---|---|
| Eingereicht | `submitted` | Der Nachweis ist eingestellt und wartet auf die Anerkennung. Änderung durch den Einsteller zulässig ([37]). Deckt **keinen** Pflichtnachweis ab |
| Anerkannt | `accepted` | Der Betreiber hat den Nachweis geprüft und übernommen; `verifiedAt` / `verifiedBy` gesetzt. Keine Änderung mehr durch den Einsteller ([37]). Deckt den Pflichtnachweis, soweit der Gültigkeitszeitraum reicht |
| Zurückgewiesen | `rejected` | Der Nachweis ist nicht brauchbar; `rejectionReason` Pflicht. **Endzustand.** Deckt nichts |

| Von | Nach | Auslösende Rolle | Vorbedingungen | Nebenwirkungen |
|---|---|---|---|---|
| — | `submitted` | `LA`/`LD` (Lieferanten- und Kandidatennachweise), `MA` (Vertragsunterlagen), `KB` ([35], einsatzbezogene Nachweise zum eigenen Kunden) | `documentCategory`, `subjectType`, `subjectRef`, `fileRef`, `fileName`, `mimeType` gesetzt (3.10) | `mandatory` und `blocking` werden aus dem Katalog in 5.4.4 **abgeleitet**, nicht gesetzt (3.10); Benachrichtigung an `MD` |
| `submitted` | `accepted` | `MD` ([34]), `MA` | Nachweisart und Bezugsobjekt passen zum Katalog; bei Nachweisarten mit Gültigkeitszeitraum ist `validTo` gesetzt oder bewusst leer | `verifiedAt` / `verifiedBy` gesetzt; abhängige Prüfungen (P9, P10) werden neu gerechnet; Benachrichtigung an den Einsteller |
| `submitted` | `rejected` | `MD` ([34]), `MA` | `rejectionReason` Pflicht | Benachrichtigung an den Einsteller mit Begründung; der Pflichtnachweis bleibt offen; Eskalationsanlass „Nachweis fehlt" (2.4) |

**Ausgeschlossen:**

- **Kein** `accepted` → `submitted` und **kein** `rejected` → `submitted`. Ein
  neuer oder berichtigter Nachweis ist ein **neues** Dokument (4.0, Regel 9).
  Beim Erlaubnissatz führt 3.2 dafür `supersedesRef`.
- **Kein** Statuswechsel durch **Ablauf der Gültigkeit**. Ein abgelaufener
  Nachweis bleibt `accepted` — die Anerkennung bezieht sich auf das
  Schriftstück, nicht auf den Zeitraum. Die Gültigkeit ergibt sich aus
  `validFrom` / `validTo` und wird von P9 und P10 je Stichtag gelesen. Das ist
  die Anwendung von 4.0 Regel 4 auf den Nachweis: Zeit entzieht hier nichts, sie
  macht den Nachweis nur für Tage außerhalb des Zeitraums unbrauchbar.
- **Keine** Anerkennung durch den Einsteller. Die Anerkennung ist die
  Prüfhandlung des Betreibers ([34]); sie unterliegt dem Vier-Augen-Prinzip
  gegenüber dem Einstellen, auch wenn beide beim Betreiber liegen.

#### 5.4.4 Pflichtkatalog, Fristen und Ablaufbehandlung (P10)

Der Katalog ist **fest** und nicht je Kunde konfigurierbar (Entscheidung zu
Frage 20, 3.10). Dieser Abschnitt ergänzt ihn um Prüfzeitpunkt, Fristen und
Ablaufbehandlung.

| Nachweisart | Bezugsobjekt | Pflicht, wenn | Prüfzeitpunkt | Fehlt oder nicht anerkannt | Abgelaufen am Stichtag | Vorlauf (Information / Warnung / Eskalation) |
|---|---|---|---|---|---|---|
| `permitCertificate` | Lieferant, über `supplierPermit` | immer | P9: Q04, Q06, Q16, Q20, Q31, Q38, Q41, Q43, Q44 | **Sperre** (P9) | **Sperre** für neue Vorgänge; laufender Einsatz nach 5.4.2 b) | 90 / 30 / 14 Tage |
| `workPermit` | Kandidat | `candidate.workPermitRequired = ja` (3.6) | Q10 (Information), Q21 (Sperre) | **Sperre** ab `planned` → `active` | **Sperre** für neue Vorgänge; laufender Einsatz: Warnung mit Pflicht-Eskalation an `MD`, `MA` und `LA` | 60 / 30 / 7 Tage |
| `safetyBriefing` | Einsatz | `site.safetyBriefingRequired = ja` (3.1) | Q21 (Sperre), Q37 (Warnung) | **Sperre** ab `planned` → `active` | **Warnung** am Stundenzettel (Q37); **Sperre** für einen neuen Einsatz am selben Standort | 30 / 14 / — |
| `qualificationCertificate` | Kandidat | nie Sperre | Q10, Q21 | **Warnung** | **Warnung** | 60 / 30 / — |
| `clearanceCertificate` | Lieferant | nie Sperre | Q41, Q42, nächtlicher Lauf | **Warnung** | **Warnung** mit Eskalation an `MD` | 90 / 30 / — |
| `agreementDocument` | Rahmenvertrag | nie Sperre | nächtlicher Lauf | **Information** | **Information** | — |
| `other` | beliebig | nie | — | **Information** | **Information** | — |

Die ersten sechs Zeilen sind der Katalog aus 3.10 (Entscheidung zu Frage 20),
unverändert in der Wirkung und hier nur um Prüfzeitpunkt, Ablaufbehandlung und
Fristen ergänzt. Die Zeile `agreementDocument` ist hinzugefügt, weil 3.10 die
Nachweisart führt, der Katalog sie aber nicht nannte; ihre Wirkung entspricht
der von `other` und ändert deshalb keine Festlegung.

**Lesart der Spalte „Prüfzeitpunkt".** P10 ist eine Sammelprüfung: an einem
Übergang prüft sie **alle** Nachweisarten, die für die beteiligten Objekte
Pflicht sind. Bei `planned` → `active` (Q21) sind das `workPermit` (wenn
erforderlich), `safetyBriefing` (wenn der Standort sie verlangt) und
`qualificationCertificate`; die AÜG-Erlaubnis läuft über P9 (Q20) und wird von
P10 nicht doppelt geprüft. Das Ergebnis von P10 ist das **strengste**
Einzelergebnis, und jede Einzelfeststellung wird eigens vermerkt (5.5.2).

**Fristen vor Ablauf.** Die Vorlaufwerte sind Festwerte dieses Kapitels (5.0)
und tragen in 4.0 die Zeile „Vorlauf vor Ablauf eines Nachweises". Die
Stufenfolge entspricht dem Eskalationsanlass „AÜG-Erlaubnis läuft ab oder
Nachweis fehlt" (2.4: `LA` → `LD` → `MD` → `MA`):

| Restzeit bis `validTo` | Ergebnis | Adressat |
|---|---|---|
| Information-Vorlauf erreicht | Information | `LA` (Lieferanten- und Kandidatennachweise), `KB` (Unterweisung) |
| Warnungs-Vorlauf erreicht | Warnung | zusätzlich `LD` |
| Eskalations-Vorlauf erreicht | Warnung mit Eskalation | zusätzlich `MD` |
| `validTo` verstrichen | Warnung mit Eskalation | zusätzlich `MA`; bei sperrenden Arten greift ab hier die Sperre an jedem Übergang |

**Nachweis ohne `validTo`.** Zulässig (3.10, `validFrom`/`validTo` optional).
Ein anerkannter Nachweis ohne Enddatum gilt unbefristet und läuft nicht ab. Bei
den **sperrenden** Arten ist das ein Befund: eine Arbeitserlaubnis und eine
Unterweisung ohne Enddatum sind ungewöhnlich. Das Ergebnis trägt deshalb eine
**Information** an `MD` beim Anerkennen, damit das Enddatum nicht aus Versehen
leer bleibt. Eine Sperre ist es nicht — es gibt Nachweise, die unbefristet sind.

#### 5.4.5 Grenzfälle

| Grenzfall | Festlegung |
|---|---|
| **Tag genau auf der Grenze** | `validFrom` und `validTo` sind **eingeschlossen**. Eine Erlaubnis mit `validTo` = 30.06. deckt den 30.06., nicht den 01.07. Ein Einsatzstart am `validTo` ist zulässig; eine Verlängerung über ihn hinaus nicht (Q31) |
| **Lücke zwischen zwei Erlaubnissätzen** | Treffer, auch wenn sie nur einen Tag beträgt (5.4.1, Schritt 3). Der Nachfolgesatz trägt `supersedesRef` (3.2), heilt die Lücke aber nicht |
| **Verlängerung rückwirkend eingestellt** | Ein Erlaubnissatz mit `validFrom` in der Vergangenheit, der eine Lücke schließt, wird ab Anerkennung berücksichtigt und schließt sie **ab dann** für alle künftigen Prüfungen. Übergänge, die in der Lücke gesperrt wurden, werden nicht nachträglich wirksam — sie sind nicht geschehen (4.0, Regel 5) |
| **Unterbrechung exakt drei Monate** | Für 5.4 ohne Belang: P9 und P10 prüfen Zeiträume, nicht Ketten. Eine Unterbrechung verkürzt nur den Prüfzeitraum um ihre Tage, weil an ihnen keine Überlassung stattfindet |
| **Lieferantenwechsel mitten im Einsatz** | Der neue Einsatz wird gegen die Erlaubnis des **neuen** Lieferanten geprüft, für seinen eigenen Zeitraum. Die Erlaubnis des alten Lieferanten deckt den alten Einsatz; am Beleg (Q38) wird je Leistungszeitraum der jeweils zuständige Lieferant geprüft |
| **Rückwirkende Korrektur von `validTo`** | Wird ein `validTo` nachträglich nach vorn gezogen (Widerruf, Korrektur), werden alle Prüfungen neu gerechnet. Laufende Einsätze folgen 5.4.2 b); abgerechnete Zeiträume erzeugen eine **Warnung mit Pflicht-Eskalation** an `MA` und werden nicht entwertet (5.5.3) |
| **Nachweis anerkannt, Datei fehlt** | `fileRef` ist in 3.10 Pflicht. Ein Satz ohne `fileRef` ist ein Datenfehler und deckt nichts (5.4.1, Schritt 2) |
| **Standort verlangt Unterweisung nachträglich** | Wird `site.safetyBriefingRequired` von „nein" auf „ja" gestellt, wird die Unterweisung für **laufende** Einsätze zum Pflichtnachweis. Folge: Warnung mit Eskalation an `KB` und `LD`, Sperre erst für den nächsten Einsatzstart — ein laufender Einsatz wird nicht durch eine Stammdatenänderung unterbrochen |
| **Fehlende oder unbestätigte Personenidentität** | Ohne Belang: P9 ist lieferantenbezogen, P10 bezieht sich auf den Kandidatensatz, den Einsatz oder den Lieferanten. Ein Nachweis eines anderen Kandidatensatzes derselben Person deckt **nicht** mit — der Nachweis gehört dem Verleiher, der ihn eingestellt hat |
| **Zeitraum ohne Tarifzuordnung** | Ohne Belang für 5.4 |

#### 5.4.6 Was gilt, wenn Daten fehlen

| Fehlendes Datum | Verhalten |
|---|---|
| Kein `supplierPermit` | P9 Treffer. Ergebnisart je Übergang (Sperre außer Q38) |
| `verificationStatus = submitted` | Deckt nicht (5.4.1, Schritt 4). Meldung an `MD` mit dem Hinweis, dass die Anerkennung aussteht — das ist der häufigste Fall im Onboarding und darf nicht wie ein fehlender Nachweis aussehen |
| `validTo` fehlt bei `permitType = fixedTerm` | Datenfehler (3.2: Pflicht bei `fixedTerm`). Der Satz deckt **nichts**; Meldung an `LA` und `MD` |
| `documentRef` fehlt am Erlaubnissatz | Datenfehler (3.2: Pflicht). Der Satz deckt nichts |
| `workPermitRequired` nicht gesetzt | Pflicht in 3.6. Fehlt es, wird **wie „ja"** gerechnet — die strengere Annahme, weil die mildere eine Sperre umgehen würde |
| `safetyBriefingRequired` nicht gesetzt | Pflicht in 3.1. Fehlt es, wird **wie „ja"** gerechnet, aus demselben Grund |
| Pflichtnachweis fehlt vollständig | Ergebnisart nach dem Katalog in 5.4.4. Die Meldung nennt **Nachweisart und Bezugsobjekt**, nicht „Nachweise unvollständig" |

#### 5.4.7 Aufzeichnungs- und Dokumentationspflichten

Der Verleiher trifft nach § 7 AÜG Anzeige-, Auskunfts- und
Aufzeichnungspflichten; die Erlaubnisbehörde kann prüfen (§ 17 AÜG). Der Beitrag
des Systems:

1. **Die Einsatzhistorie je Person und Entleiher** ist vollständig und
   auswertbar: Einsätze, Laufzeiten, Unterbrechungen, Verlängerungen und die
   abgeleiteten Fristenstände (3.7, 5.1).
2. **Jedes Prüfergebnis bleibt erhalten** — als `ruleCheckResult` am Vorgang und
   als Audit-Eintrag mit `ruleRef` (3.12). Auch die Ergebnisse, die nichts
   bewirkt haben; der Nachweis, dass geprüft wurde, ist Teil des Nachweises.
3. **Jede Übersteuerung ist mit Begründung protokolliert** (5.5.4, 3.12).
4. **Nachweise bleiben mit Gültigkeitszeitraum und Anerkennungsvermerk
   erhalten**, auch nach Ablauf (5.4.3: kein Statuswechsel durch Ablauf).

**Aufbewahrung und Löschung** regelt Kapitel 6 (6.5, 6.6). Dieses Kapitel legt
keine Aufbewahrungsfrist fest — die Spannung zwischen Nachweispflicht und
Löschanspruch ist *offene Frage 22*.

#### 5.4.8 Bediente Prüfungen

| Prüfung | Zeilen in 4.7 | Ergebnisart (bestätigt in 5.5.5) |
|---|---|---|
| P9 Erlaubnis | Q04, Q06, Q16, Q20, Q31, Q41, Q43, Q44 | **Sperre** |
| P9 am Beleg | Q38 | Warnung |
| P10 Pflichtnachweise | Q10, Q21, Q37, Q42, Q43, Q44 | Information / **Sperre** / Warnung / **Sperre** / **Sperre** / **Sperre** |

### 5.5 Regelwerk-Mechanik

#### 5.5.1 Wo Prüfungen greifen

Es gibt genau **drei** Anlässe, zu denen eine Prüfung läuft. Ein vierter wird
nicht eingeführt — insbesondere kein Prüflauf beim Lesen oder beim Anzeigen
einer Liste; das wäre nicht nachvollziehbar und würde die Protokollierung
unbrauchbar machen.

**a) Statusübergang.** Der verbindliche Fall. Die Prüfung läuft als
**Vorbedingung** des Übergangs, mit dem Stichtag aus 5.0. Ein Ergebnis `block`
verhindert den Übergang; der Vorgang bleibt in seinem Zustand (4.0, Regel 5).
Welche Prüfung an welchem Übergang läuft, steht **ausschließlich** in der
Querschnittstabelle 4.7 — nicht in diesem Kapitel und nicht im Code. Das
Ergebnis wird am Objekt vermerkt und protokolliert (5.5.2).

**b) Speicherung.** Wird ein Datum geändert, das Rechengrundlage ist, werden die
abgeleiteten Felder neu berechnet: `countedDurationDays`,
`maxDurationEndDate`, `equalPayDueDate` (3.7), `countsAsReset` (3.7),
`mandatory` und `blocking` (3.10). Auslösende Daten sind insbesondere
`actualStartDate` / `actualEndDate`, Unterbrechungen, `workerIdentity`,
`comparableWageEntry`, `collectiveAgreementAssignment`, `supplierPermit` und
`document`.

> **Eine Prüfung sperrt niemals das Speichern.** Das Ergebnis einer Prüfung bei
> der Speicherung ist Information oder Warnung, nie `block`. Eine Korrektur der
> Wahrheit darf nicht daran scheitern, dass die Wahrheit unbequem ist: wer ein
> `actualEndDate` berichtigen will, muss das können, auch wenn dadurch eine
> Fristüberschreitung sichtbar wird. Gesperrt werden **Handlungen**
> (Statusübergänge), nicht **Feststellungen**.

Die Pflichtfelder aus Kapitel 3 bleiben davon unberührt: ein Pflichtfeld muss
gefüllt sein, das ist keine AÜG-Prüfung, sondern eine Eingabebedingung.

**c) Nächtlicher Lauf** (`nightlyRuleRun`). Einmal täglich, Stichtag ist der Tag
des Laufs. Er prüft die Vorgänge, bei denen **Zeit allein** die Lage ändert, und
erzeugt die Vorlaufwarnungen aus 5.0. Er erzeugt **keinen Statuswechsel** (4.0,
Regeln 4 und 10) und **keine Sperre** — eine Sperre braucht einen Übergang, den
sie verhindert.

| Nr. | Gegenstand | Prüfung | Prüfumfang | Ergebnis |
|---|---|---|---|---|
| N1 | Lieferanten in `onboarding`, `active`, `blocked` | P9 | Erlaubnis abgelaufen oder innerhalb des Vorlaufs | Information / Warnung / Warnung mit Eskalation nach 5.4.4 |
| N2 | Einsätze in `planned`, `active`, `interrupted` | P1 | `maxDurationEndDate` innerhalb des Vorlaufs oder erreicht | Information / Warnung nach 5.1.6 |
| N3 | Einsätze in `planned`, `active`, `interrupted` | P3, P4 | `equalPayDueDate` innerhalb des Vorlaufs oder erreicht und `comparableWage` nicht gesetzt | Information / Warnung nach 5.0 |
| N4 | Einsätze in `active`, `interrupted` | P7 | Arbeitskampfanzeige deckt den Tag des Laufs | Warnung mit Pflicht-Eskalation; Unterbrechung wird vorgeschlagen (5.3.2) |
| N5 | Nachweise mit `validTo`, deren Bezugsobjekt aktiv ist | P10 | Ablauf oder Vorlauf erreicht | nach Katalog 5.4.4 |
| N6 | Einsätze in `interrupted` mit offener Unterbrechung | P2 | Unterbrechung überschreitet die Drei-Monats-Schwelle | Information: die Zählung wird mit der Wiederaufnahme zurückgesetzt (5.1.4) |

**Was der nächtliche Lauf nicht leistet.** Er kennt nur, was gemeldet ist. Eine
Arbeitskampfanzeige, die niemand einstellt, erzeugt keine Warnung (5.3.2); eine
Erlaubnis, die die Behörde widerrufen hat, ohne dass es jemand einträgt, gilt im
System weiter. Das ist keine Lücke der Rechenvorschrift, sondern die Grenze des
Systems, und sie gehört in den Rahmenvertrag mit Kunden und Lieferanten
(Mitteilungspflichten), nicht in dieses Kapitel.

#### 5.5.2 Die drei Ergebnisarten und ihre Wirkung

Die Definitionen aus 4.7 gelten unverändert und werden hier **bestätigt**:

| Ergebnisart | Bezeichner | Wirkung |
|---|---|---|
| Information | `info` | Der Übergang findet statt. Das Ergebnis wird am Objekt vermerkt und protokolliert. Keine Benachrichtigung, kein Eskalationsanlass |
| Warnung | `warning` | Der Übergang findet statt, erzeugt eine Benachrichtigung an die zuständige Rolle und einen Eskalationsanlass (2.4) |
| Sperre | `block` | Der Übergang findet **nicht** statt. Der Vorgang bleibt in seinem Zustand. Übersteuerung nur nach 5.5.4, nicht vertretbar (2.4, Regel 8) |

Ergänzend legt dieses Kapitel fest:

1. **Jedes Ergebnis wird vermerkt und protokolliert.** Am Vorgang, wo Kapitel 3
   ein Feld führt (`assignmentExtension.ruleCheckResult`, 3.7), sonst als
   Audit-Eintrag mit `ruleRef` und `result` (3.12). Auch eine Information wird
   protokolliert — der Nachweis, dass geprüft wurde, ist Teil des Nachweises
   (5.4.7).
2. **Das strengste Ergebnis gewinnt, alle werden einzeln geführt.**
   `block` > `warning` > `info`. Ein Sammelergebnis „drei Befunde" wäre nicht
   abarbeitbar: jede Feststellung nennt ihre Prüfung, ihren Gegenstand und das
   fehlende oder verletzte Datum.
3. **Eine Warnung verfällt nicht.** Sie bleibt am Vorgang, bis ihr Grund
   entfällt, und wird im nächtlichen Lauf erneut festgestellt. Es gibt kein
   „Wegklicken" — eine Warnung, die man schließen kann, ohne den Grund zu
   beheben, ist eine Information mit falschem Namen.
4. **Eine Sperre ist kein Zustand** (4.0, Regel 5). Sie erzeugt keinen Status,
   keine Kennzeichnung am Objekt und keine Wiedervorlage. Einzige Ausnahme im
   System bleibt `blocked` beim Lieferanten (4.6), und das ist eine Aussage über
   die Organisation, kein Prüfergebnis.
5. **Eine Sperre ist nur dort richtig, wo ein Weg offensteht, sie rechtmäßig
   aufzulösen.** Dieses Kriterium trägt die Änderungen in 5.5.5: wo die Sperre
   einen Weg hat — einen Nachweis beibringen, einen Wert eintragen, einen
   kürzeren Zeitraum wählen, eine Erklärung einholen —, ist sie das richtige
   Mittel. Wo sie keinen hat, weil der Sachverhalt in der Vergangenheit liegt
   und nicht mehr änderbar ist, bestraft sie die Falschen und blockiert
   Vorgänge, die niemandem helfen. Dann ist das Mittel die **Feststellung mit
   Pflicht-Eskalation**.
6. **Sichtbarkeit gilt auch für Prüfergebnisse** (2.3). Ein Ergebnis an einen
   Lieferanten enthält nur den eigenen Vorgang, nie die Einsatzhistorie bei
   anderen Lieferanten und nie das Entgeltgefüge des Entleihers. Ein Ergebnis an
   einen Kunden enthält den Fristenstand, nicht die Historie bei anderen Kunden.
   Die Zählung findet beim Betreiber statt; beide Seiten erfahren das **Ergebnis
   zu ihrem Vorgang** (2.3, Regel 4).

#### 5.5.3 Stichtagslogik und rückwirkende Änderungen

**Stichtagslogik** steht in 5.0 (Stichtag, Prüfzeitraum, Fristenarithmetik,
Lesen zeitraumbezogener Stammdaten mit dem Stichtag). Zwei Festlegungen kommen
hier hinzu:

1. **Abgeleitete Felder werden neu berechnet, nie fortgeschrieben.** Sie sind
   ein Abbild des Rechenergebnisses zum letzten Prüfzeitpunkt, kein eigener
   Datenbestand. Jede Prüfung rechnet sie aus den Eingangsdaten neu; ein
   inkrementelles Weiterzählen wäre nach der ersten Korrektur falsch.
2. **Dieselbe Prüfung mit demselben Stichtag und derselben Datenlage liefert
   dasselbe Ergebnis.** Das ist die Bedingung dafür, dass die Szenarien in
   `tests/aueg/` überhaupt ausführbar sind, und der Grund, aus dem „heute" nie
   Stichtag ist (5.0).

**Rückwirkende Änderungen** sind der Normalfall, nicht die Ausnahme: ein
tatsächliches Ende wird nachgetragen, eine Unterbrechung nachgemeldet, eine
Personenidentität später bestätigt, ein Vergleichsentgelt rückwirkend gepflegt.
Dafür gilt:

| Regel | Festlegung |
|---|---|
| **R1 Neuberechnung** | Eine rückwirkende Änderung löst die Neuberechnung der abgeleiteten Felder an **allen** betroffenen Objekten aus — bei den Ketten aus 5.1 und 5.2 an **jedem** Einsatz der Kette, nicht nur am geänderten |
| **R2 Kein Rückbau von Übergängen** | Ein Übergang, der bei seiner Ausführung zulässig war, bleibt wirksam. Endzustände sind endgültig (4.0, Regel 9). Es gibt keine rückwirkende Sperre und keinen automatischen Rückschritt |
| **R3 Feststellung statt Sperre** | Legt eine rückwirkende Änderung einen Verstoß in der **Vergangenheit** offen, ist das Ergebnis eine **Warnung mit Pflicht-Eskalation** an `MA`, nie eine Sperre: es gibt nichts mehr zu sperren. Der Befund bleibt als Audit-Eintrag mit `ruleRef` dauerhaft erhalten (3.12) |
| **R4 Keine Entwertung abgerechneter Vorgänge** | Genehmigte Stundenzettel und freigegebene Belege werden nicht rückwirkend entwertet. Änderungen laufen über Korrekturfassung (4.4) und Storno mit Nachbeleg (4.5) |
| **R5 Wirkung nach vorn** | Die neue Lage gilt für **jede folgende** Prüfung. Ist `maxDurationEndDate` durch die Korrektur in die Vergangenheit gerückt, sind der nächste Einsatzstart, die nächste Wiederaufnahme und die nächste Verlängerung gesperrt — ohne dass der laufende Einsatz still beendet wird |
| **R6 Nicht übersteuerbar** | Eine Feststellung nach R3 ist keine Sperre und damit nicht übersteuerbar. Sie kann nur dadurch entfallen, dass die Datenlage berichtigt wird — und dann ist sie keine Feststellung mehr, sondern ein weiterer Audit-Eintrag |
| **R7 Protokollpflicht** | Die Änderung selbst trägt `changedFields` und bei Korrekturen eine Pflichtbegründung (3.12, Fußnote [28]). Die ausgelöste Neuberechnung trägt `ruleRef` |

#### 5.5.4 Übersteuerung einer Sperre

> ***Offene Frage 10*** — **wie Ausnahmen von AÜG-Sperren fachlich genehmigt
> werden, ist nicht entschieden.** Dieser Abschnitt ist deshalb zweigeteilt: die
> **Invarianten** gelten unabhängig von der Antwort, das **Verfahren** ist als
> Provisorium gekennzeichnet und wird mit der Antwort ersetzt. Keine andere
> Festlegung dieses Kapitels hängt von der Antwort ab.

**Grundsatz.** Eine Übersteuerung ist das letzte Mittel. Sie ist zulässig, wenn
**alle drei** Bedingungen erfüllt sind:

- **(a) Die Sperre beruht auf einer Angabe, die nachweislich unrichtig oder
  unvollständig ist** — ein falsches Datum, eine falsch verknüpfte
  Personenidentität, eine nicht erfasste Unterbrechung, ein vorliegender, aber
  nicht eingestellter Nachweis.
- **(b) Die Berichtigung der Angabe ist nicht rechtzeitig möglich.**
- **(c) Die Überlassung wäre nach richtiger Datenlage zulässig.**

**Fehlt (c), ist die Sperre nicht übersteuerbar.** Dann ist der Vorgang zu
unterlassen. Das ist der entscheidende Satz dieses Abschnitts: Eine
Übersteuerung korrigiert eine **falsche Datenlage**, sie erlaubt keine
**rechtswidrige Überlassung**. Wer 18 Monate ausgeschöpft hat, verlängert nicht
per Übersteuerung — der zulässige Weg ist die tarifliche Öffnungsklausel als
Konfiguration (5.1.2), ein anderer Entleiher oder das Ende der Überlassung.

**Übersteuerbarkeit je Prüfung**

| Prüfung | Übersteuerbar | Begründung |
|---|---|---|
| P1 Höchstüberlassungsdauer | **ja**, nach (a) bis (c) | Die Zählung beruht auf Daten, die falsch sein können: eine fehlerhafte Identitätsverknüpfung, ein falsches Enddatum, eine nicht erfasste Unterbrechung. Die Begründung nennt die Tatsache, die das System falsch führt — nicht „wird ausnahmsweise zugelassen" |
| P2 Unterbrechung | **ja**, nach (a) bis (c) | Dito; betrifft vor allem nicht erfasste oder falsch datierte Unterbrechungen |
| P3 Equal-Pay-Frist | nein | P3 sperrt nicht |
| P4 Vergleichsentgelt | **nein** | Der Weg ist die **Ergänzung des Werts** durch den Entleiher (3.3). Eine Sperre mit offenem Weg wird nicht übersteuert, sondern aufgelöst |
| P5 Branchenzuschlag | nein | P5 sperrt nicht |
| P6 Drehtür | **nein** | Der Treffer selbst sperrt nicht (5.3.1). Die Sperre bei fehlender Erklärung wird durch die Erklärung aufgelöst |
| P7 Arbeitskampf | **nein** | Die gesetzliche Ausnahme ist die **Zusicherung** nach § 11 Abs. 5 Satz 2 AÜG — ein eigener, dokumentierter Sachverhalt, keine Abweichung von der Regel. Eine Übersteuerung wäre eine dokumentierte Rechtsverletzung |
| P8 Kennzeichnung und Konkretisierung | **nein** | Die Konkretisierung wird **nachgetragen**. Nach dem ersten Überlassungstag ist sie nicht heilbar — und dann hilft auch keine Übersteuerung (§ 1 Abs. 1 Sätze 5, 6; § 9 Abs. 1 Nr. 1a AÜG) |
| P9 Erlaubnis | **ja**, eng | Nur im Fall (a): die Erlaubnis **besteht**, ist aber nicht eingestellt oder noch nicht anerkannt. Eine Übersteuerung bei **fehlender** Erlaubnis ist nach (c) ausgeschlossen |
| P10 Pflichtnachweise | **ja**, eng | Dito: der Nachweis liegt vor, ist aber nicht erfasst. Bei tatsächlich fehlendem Nachweis greift (c) nicht |
| P11 Arbeitsverhältnis | **ja**, eng | Nur im Fall (a): der Arbeitsvertrag besteht, ist aber im System nicht erfasst |

**Invarianten** — sie gelten unabhängig von der Antwort auf Frage 10:

1. **Vorgangsbezogen und einmalig.** Eine Übersteuerung gilt für **genau einen
   Übergang** eines **genau benannten** Objekts. Es gibt keine Übersteuerung
   einer Regel, eines Lieferanten, eines Kunden oder eines Zeitraums, und keine
   dauerhafte Ausnahme. Wird derselbe Übergang später erneut versucht, braucht
   er eine neue Übersteuerung.
2. **Pflichtbegründung mit Tatsachenbezug.** Die Begründung nennt die übersteuerte
   Prüfung (`ruleRef`), die Angabe, die das System unrichtig führt, und die
   Tatsache, die stattdessen gilt. Ein Freitext ohne Tatsachenbezug erfüllt die
   Bedingung (a) nicht. Protokolliert wird mit `reason` (3.12, Pflicht bei
   Übersteuerung).
3. **Vier-Augen und nicht vertretbar.** Nicht durch dieselbe Person, die den
   Vorgang erstellt, beantragt oder eingereicht hat (2.4, Regel 5), und **nicht
   in Vertretung** (2.4, Regel 8).
4. **Eskalationspflicht.** Jede Übersteuerung wird `MA` angezeigt
   (Eskalationsanlass „AÜG-Sperre blockiert einen Vorgang", 2.4) und ist
   Gegenstand des Berechtigungsreviews (6.8).
5. **Vollständige Protokollierung.** Zwei Audit-Einträge entstehen: der
   abgelehnte Übergang mit `result = blocked` und der vollzogene Übergang mit
   `result = success`, `ruleRef` und `reason` (3.12). Die Spur zeigt, dass eine
   Sperre bestand — nicht nur, dass ein Übergang geschah.
6. **Keine Heilung der Rechtslage.** Eine Übersteuerung ändert nichts an der
   Rechtsfolge eines Verstoßes. Sie dokumentiert eine Entscheidung; sie ersetzt
   keine Erlaubnis, keinen Nachweis und keine Frist.

**Provisorisches Verfahren bis zur Antwort auf Frage 10.** Übersteuern darf
**nur `MA`**, einzeln, mit Pflichtbegründung nach Invariante 2, unter
Invarianten 3 bis 6. `MD` darf nicht übersteuern — er darf eskalieren (2.4).
Alle Übersteuerungen werden beim Betreiber in einer eigenen Übersicht geführt.

Was die Antwort auf Frage 10 noch zu entscheiden hat — und was sich dadurch
**nur** am Verfahren ändert, nicht an den Invarianten:

| Offen | Mögliche Antworten | Was sich ändert |
|---|---|---|
| Wer genehmigt? | `MA` allein · `MA` mit zweiter Person · eine eigene Funktion (Rechtsabteilung, Compliance) · Mitwirkung des Entleihers | Rolle und ggf. eine Spalte in 2.2; eine neue Rolle in 2.1 |
| Vorab oder nachträglich? | Vorabgenehmigung vor dem Übergang · nachträgliche Bestätigung innerhalb einer Frist | Reihenfolge der beiden Audit-Einträge aus Invariante 5 |
| Befristet? | Übersteuerung mit Nachfrist, in der das fehlende Datum beizubringen ist · ohne Frist | Eine Fristüberwachung im nächtlichen Lauf (5.5.1) als weitere Zeile |
| Eigenes Objekt? | Audit-Eintrag genügt (heute) · eigenes Objekt `override` mit Antrag, Entscheidung und Frist | Ein Objekt in Kapitel 3 und eine Zeile in 2.2; 3.12 trägt heute nur den Eintrag mit `reason` |

#### 5.5.5 Bestätigung der Ergebnisarten in 4.7

4.7 bezeichnet die Spalte „Ergebnisart" ausdrücklich als **Vorschlag aus Sicht
der Statusmodelle**, der in 5.5 bestätigt oder geändert wird; M2 führt dies als
eigenen Punkt („Entscheidung, welche Prüfung sperrt und welche nur warnt"). Die
Entscheidung ist hiermit getroffen und **in 4.7 nachgezogen**: die Spalte dort
heißt jetzt „Ergebnisart" ohne den Zusatz „Vorschlag" und trägt die Werte
dieses Abschnitts.

**38 der 44 Zeilen sind bestätigt. Sechs sind geändert. Vier Zeilen sind neu.**
Alle Änderungen folgen demselben Kriterium (5.5.2, Nummer 5): eine Sperre ist
nur dort richtig, wo ein Weg offensteht, sie rechtmäßig aufzulösen.

**Bestätigt ohne Änderung**

| Zeilen | Prüfung und Ergebnisart | Bestätigung |
|---|---|---|
| Q01, Q02 | P8 an der Bedarfsanfrage, Information / Warnung | Die Anfrage ist kein Überlassungsvertrag; die formale Vorprüfung ist richtig platziert. Die Sperre gehört an den Einsatz (neu: Q45, Q46) |
| Q03 | P1 Vorschau ohne Person, Information | Ohne Person gibt es keine Kette; die Aussage ist eine Rechnung über den angefragten Zeitraum, keine Feststellung über eine Überlassung |
| Q04 | P9 je Einladung, **Sperre** | Weg offen: gültige Erlaubnis oder anderer Lieferant. Wirkt **je Einladung**, nicht auf die ganze Ausschreibung (5.4.1) |
| Q05 | P7 beim Ausschreiben, Warnung | Zum Zeitpunkt der Ausschreibung steht nicht fest, ob der Arbeitskampf beim Einsatzstart noch läuft. Die Sperre greift beim Start (Q22) |
| Q06 | P9 bei der Einladung, **Sperre** | Weg offen wie Q04 |
| Q07 | P1 Warnschwelle am Profilvorschlag, Warnung | Vorprüfung; die Sperre greift bei der Zusage (Q11) |
| Q08 | P6 am Profilvorschlag, Warnung | Vorprüfung mit Entgeltfolge, kein Einsatzverbot (5.3.1) |
| Q09 | P11 am Profilvorschlag, Warnung | Das Arbeitsverhältnis muss am ersten Überlassungstag bestehen, nicht beim Vorschlag (5.3.4) |
| Q10 | P10 am Profilvorschlag, Information | Entspricht der Entscheidung zu Frage 20 (3.10: „Q10 bleibt Information") |
| Q11 | P1 bei der Zusage, **Sperre** | Weg offen: kürzerer Zeitraum, anderer Entleiher, tarifliche Öffnung als Konfiguration |
| Q14 | P1 beim Anlegen des Einsatzes, **Sperre** | Dito |
| Q16 | P9 beim Anlegen des Einsatzes, **Sperre** | Weg offen: Erlaubnis für den geplanten Zeitraum |
| Q18 | P4 beim Anlegen des Einsatzes, Warnung | Die Fälligkeit liegt beim Anlegen regelmäßig in der Zukunft; die Sperre greift, wenn sie erreicht ist (Q36, neu Q48) |
| Q19 | P5 beim Anlegen des Einsatzes, Information | Das Schema wirkt auf Zuschlagsstufen, nicht auf die Zulässigkeit der Überlassung |
| Q20 | P9 am Einsatzstart, **Sperre** | Weg offen; Überlassung ohne Erlaubnis ist der Kernfall von § 9, § 10 AÜG |
| Q21 | P10 am Einsatzstart, **Sperre** | Entspricht der Entscheidung zu Frage 20 (3.10). Weg offen: Nachweis beibringen |
| Q22 | P7 am Einsatzstart, **Sperre** | Weg offen: Zusicherung nach § 11 Abs. 5 Satz 2 oder späterer Start (5.3.2) |
| Q23 | P1 am Einsatzstart, **Sperre** | Weg offen: nicht starten, kürzer planen |
| Q24, Q25 | P2 bei Unterbrechung und Wiederaufnahme, Information | Die Unterbrechung wird erfasst und bewertet; sie entzieht nichts |
| Q27 | P1 und P3 beim Abschluss, Information | Abschlussstand, Dokumentationszweck |
| Q28, Q29 | P1 und P3 bei der Genehmigung der Verlängerung, Warnung | Vorschau für die Kundenseite; die Sperre greift bei der Wirksamkeit (Q30) |
| Q30 | P1 bei der Wirksamkeit, **Sperre** | Weg offen: kürzeres `newEndDate` (4.3.2 nennt diese Sperre ausdrücklich) |
| Q31 | P9 bei der Wirksamkeit, **Sperre** | Weg offen: Erlaubnis für den verlängerten Zeitraum |
| Q32 | P4 bei der Wirksamkeit, Warnung | Die Fälligkeit kann im verlängerten Zeitraum erst entstehen; die Sperre greift am Zettel (Q36) |
| Q33 | P1 beim Einreichen des Zettels, Warnung | Die Zeiten sind erbracht; das Einreichen festzustellen ist richtig, es zu verhindern nicht |
| Q34 | P3 beim Eröffnen der Freigabe, Warnung | Hinweis an die genehmigende Rolle |
| Q36 | P4 bei der Zettelgenehmigung, **Sperre** | **Bestätigt mit Präzisierung:** Sperre nur, wenn **kein verwendbarer** Eintrag vorliegt. Ein Eintrag mit `wageSource = estimate` lässt den Übergang zu und erzeugt eine Warnung (3.3, 5.2.4). Der Unterschied zu Q35: hier steht ein zumutbarer Weg offen — der Entleiher trägt den Wert nach, und das ist seine Pflicht aus 3.3 |
| Q37 | P10 Unterweisung bei der Zettelgenehmigung, Warnung | Entspricht der Entscheidung zu Frage 20 (3.10: „Q37 bleibt Warnung") |
| Q38 | P9 am Einkaufsbeleg, Warnung | Erbrachte Leistung wird abgerechnet; der Befund wird dokumentiert, die Abrechnung nicht blockiert |
| Q39 | P4 am Beleg, Warnung | Dito |
| Q40 | P5 am Beleg, Information | Plausibilität der Stufe, nicht der Höhe (5.2.5) |
| Q41, Q42 | P9 und P10 beim Freischalten des Lieferanten, **Sperre** | Weg offen: Erlaubnis und Nachweise. Entspricht der Entscheidung zu Frage 20 (3.10) |
| Q43, Q44 | P9 und P10 beim Entsperren und Reaktivieren, **Sperre** | Dito; zusätzlich gebunden an das Vier-Augen-Prinzip aus Fußnote [5] |

**Geändert**

| Zeile | Vorschlag in 4.7 | Entscheidung | Begründung |
|---|---|---|---|
| **Q12** | P6 bei der Zusage: **Sperre** | **Warnung** bei Treffer; **Sperre** nur, wenn die Erklärung zur Vorbeschäftigung fehlt | § 8 Abs. 3 AÜG untersagt die Überlassung **nicht** — er nimmt dem Verleiher die tarifliche Abweichung. Rechtsfolge ist Equal Pay ab dem ersten Überlassungstag (5.3.1, Schritt 5). Eine Sperre würde einen zulässigen Einsatz verhindern **und** die Entgeltfolge verschweigen, auf die es ankommt. Die Sperre bei **fehlender Erklärung** bleibt, weil dann die Tatsachengrundlage fehlt und ein zumutbarer Weg offensteht |
| **Q15** | P6 beim Anlegen des Einsatzes: **Sperre** | wie Q12 | Dieselbe Begründung |
| **Q13** | P11 bei der Zusage: **Sperre** | **Warnung** | Das Arbeitsverhältnis beim Verleiher muss **am ersten Überlassungstag** bestehen (§ 1 Abs. 1 Satz 1 AÜG); 3.6 verweist den Prüfzeitpunkt ausdrücklich auf 5.3. Die Zusage ist eine Auswahlentscheidung, kein Überlassungsbeginn — der Arbeitsvertrag wird in der Branche regelmäßig **für** den Einsatz geschlossen. Eine Sperre hier macht den Regelfall unmöglich, ohne eine unzulässige Überlassung zu verhindern. Die Sperre wandert an den Einsatzstart (neu: Q47) |
| **Q17** | P11 beim Anlegen des Einsatzes: **Sperre** | **Warnung** | Dieselbe Begründung: der Einsatz wird geplant, nicht begonnen |
| **Q26** | P1 bei der Wiederaufnahme: „Warnung bei Überschreitung" | **Sperre**, wenn `maxDurationEndDate` am ersten Wiederaufnahmetag bereits erreicht ist; **Warnung**, wenn das Fristende im geplanten Restzeitraum liegt, aber noch nicht erreicht ist | `interrupted` → `active` ist ein **Überlassungsbeginn** wie `planned` → `active`, und dort ist die Überschreitung eine Sperre (Q23). Eine Warnung würde genau die Überlassung zulassen, die Q23 verhindert — ein Widerspruch innerhalb desselben Statusmodells. Weg offen: nicht wieder aufnehmen |
| **Q35** | P1 bei der Zettelgenehmigung: **Sperre** | **Warnung mit Pflicht-Eskalation** an `MA` | Die Zeiten sind **erbracht**. Eine Sperre der Genehmigung verhindert nicht die Überlassung — die liegt in der Vergangenheit —, sondern nur die Abrechnung geleisteter Arbeit; sie belastet den Leiharbeitnehmer und den Lieferanten für einen Fehler, der beim Betreiber entstanden ist, und erzeugt einen hängenden Zettel, der nach 4.5 die ganze Abrechnungsperiode aufhält (*offene Frage 24*). Die Sperre gehört an den Überlassungsbeginn (Q23, Q26) und an die Verlängerung (Q30), nicht an die Zeitgenehmigung. Der Verstoß wird festgestellt, protokolliert und eskaliert (R3 in 5.5.3) |

**Neu**

| Zeile | Objekt | Übergang | Prüfung | Prüfgegenstand | Ergebnisart | Begründung |
|---|---|---|---|---|---|---|
| **Q45** | Einsatz | → `planned` | P8 | Kriterien K1 bis K4 aus 5.3.3: aktiver Rahmenvertrag der Lieferantenseite, Kandidat, eigene `activityDescription`, Standort und Beginn | **Sperre** | 4.3.1 führt „eigene `activityDescription` (nicht nur ein Verweis, 5.3)" schon als Vorbedingung, 4.7 hatte dafür aber keine Zeile. Die Kennzeichnungs- und Konkretisierungspflicht hat die schärfste Rechtsfolge im AÜG (§ 9 Abs. 1 Nr. 1a, § 10 Abs. 1) und war in der Tabelle nur an der Bedarfsanfrage geprüft |
| **Q46** | Einsatz | `planned` → `active` | P8 | Kriterium K5: Konkretisierung liegt **vor** dem ersten Überlassungstag vollständig vor; K1 bis K4 erneut | **Sperre** | Nach dem ersten Überlassungstag ist der Verstoß nicht heilbar. Dies ist der einzige Zeitpunkt, an dem die Prüfung noch etwas verhindern kann |
| **Q47** | Einsatz | `planned` → `active` | P11 | `employmentStatusWithSupplier = employed` und `employedSince` ≤ erster Überlassungstag | **Sperre** | Trägt die Sperre, die aus Q13 und Q17 entfernt wurde, an den richtigen Zeitpunkt (5.3.4). Ohne diese Zeile gäbe es für P11 keine Sperre mehr — das wäre eine Abschwächung, keine Verschiebung |
| **Q48** | Einsatz | `planned` → `active` | P4 | `equalPayDueDate` liegt am oder vor dem ersten Überlassungstag und `comparableWage` ist nicht gesetzt | **Sperre** | Equal Pay ab dem ersten Tag ist der Regelfall in drei Lagen: fehlender Verleihertarif (5.2.2, Fall 1), greifende Drehtürklausel (5.3.1) und eine Kette, deren Fälligkeit längst erreicht ist. In allen drei Fällen ist `comparableWage` ab dem ersten Tag Pflicht (3.7), und der Weg steht offen: der Entleiher trägt den Wert nach |

**Keine Zeile wurde entfernt und keine umbenannt.** Die Nummern Q01 bis Q44
behalten ihren Gegenstand; Q45 bis Q48 setzen die Zählung fort. Die Prüfungen
heißen weiter P1 bis P11.

#### 5.5.6 Zusammenfassung: welche Prüfung sperrt

| Prüfung | Sperrt bei | Warnt bei | Informiert bei |
|---|---|---|---|
| P1 Höchstüberlassungsdauer | Q11, Q14, Q23, Q26, Q30 | Q07, Q28, Q33, Q35, Schwellen (5.1.6) | Q03, Q27 |
| P2 Unterbrechung | — | — | Q24, Q25 |
| P3 Equal-Pay-Frist | — | Q29, Q34 | Q27 |
| P4 Vergleichsentgelt | Q36, Q48 | Q18, Q32, Q39 | — |
| P5 Branchenzuschlag | — | fehlende Einsatzbranche (5.2.5) | Q19, Q40 |
| P6 Drehtür | Q12, Q15 **nur bei fehlender Erklärung** | Q08, Q12, Q15 bei Treffer | — |
| P7 Arbeitskampf | Q22 | Q05, N4 | — |
| P8 Kennzeichnung | Q45, Q46 | Q02 | Q01 |
| P9 Erlaubnis | Q04, Q06, Q16, Q20, Q31, Q41, Q43, Q44 | Q38, N1 | — |
| P10 Pflichtnachweise | Q21, Q42, Q43, Q44 | Q37, N5 | Q10 |
| P11 Arbeitsverhältnis | Q47 | Q09, Q13, Q17 | — |

**Sieben Prüfungen sperren den Einsatzstart** (`planned` → `active`): P9 (Q20),
P10 (Q21), P7 (Q22), P1 (Q23) und — neu — P8 (Q46), P11 (Q47) und P4 (Q48). Das
ist beabsichtigt: der erste Überlassungstag ist der Zeitpunkt, an dem jede
AÜG-Regel noch etwas verhindern kann und nach dem keine mehr etwas heilt.

## 6. Datenschutz und Löschfristen

- 6.1 Rollen nach DSGVO: Verantwortlicher, Auftragsverarbeiter, gemeinsame
  Verantwortlichkeit im MSP-Modell — TODO
- 6.2 Verzeichnis der Verarbeitungstätigkeiten (Gliederung) — TODO
- 6.3 Datenkategorien und Rechtsgrundlagen je Objekt — TODO
- 6.4 Datenminimierung: welche Kandidatendaten der Kunde überhaupt sieht
  (Pseudonymisierung von Profilen) — TODO
- 6.5 Löschfristen je Datenkategorie (abgelehnte Kandidaten, beendete
  Einsätze, Abrechnungsbelege mit handels-/steuerrechtlicher
  Aufbewahrungspflicht) — TODO
- 6.6 Löschkonzept: Löschung vs. Anonymisierung vs. Sperrung, Umgang mit
  Protokoll- und Audit-Daten — TODO
- 6.7 Betroffenenrechte: Auskunft, Berichtigung, Löschung, Übertragbarkeit —
  Umsetzung im System — TODO
- 6.8 Technische und organisatorische Maßnahmen: Mandantentrennung,
  Verschlüsselung, Zugriffsprotokollierung, Berechtigungsreview — TODO
- 6.9 Hosting: Serverstandort Deutschland/EU, AVV, Unterauftragnehmer — TODO
- 6.10 Umgang mit Testdaten (nur synthetisch, siehe CLAUDE.md) — TODO

## 7. Offene Fragen

| # | Frage | Betrifft | Status |
|---|-------|----------|--------|
| 1 | Tech-Stack (Sprache, Framework, Datenbank, ORM) | gesamtes Projekt | **entschieden:** Next.js (App Router) mit TypeScript, PostgreSQL über Prisma — siehe CLAUDE.md |
| 2 | Konkreter Hoster und Betriebsmodell (Hetzner / IONOS / anderer DE-EU-Anbieter) | Kapitel 6.9 | offen |
| 3 | Welcher Tarifvertrag ist zugrunde zu legen (iGZ/BAP, Branchenzuschläge)? | Kapitel 5.1, 5.2 | **entschieden:** Tarifwerk ist Konfiguration an der Tarifzuordnung (3.3), nicht verdrahtet; Kapitel 5 spezifiziert nur die Mechanik |
| 4 | Bekommen Leiharbeitnehmer einen eigenen Zugang (z. B. Zeiterfassung)? | Kapitel 2 | offen |
| 5 | Mehrstufige Genehmigung der Stundenzettel: wie viele Stufen, welche Rollen? | Kapitel 4.4 | offen |
| 6 | Gutschriftverfahren oder Rechnungseingang des Lieferanten? | Kapitel 3.9 | **entschieden:** Gutschriftverfahren; der Rechnungseingang bleibt als Variante dokumentiert, im Prototyp nicht umgesetzt |
| 7 | Schnittstellen zu Fremdsystemen (ERP, Zeitwirtschaft, HR4YOU) im Prototyp? | Kapitel 1.4 | offen |
| 8 | Werden mehrere Kunden eines MSP in einer Instanz oder getrennt betrieben? | Kapitel 1.3 | offen |
| 9 | Welche Kennzahlen muss das Reporting zwingend liefern? | Kapitel 3 | offen |
| 10 | Wie werden Ausnahmen von AÜG-Sperren fachlich genehmigt? | Kapitel 5.5 | offen — **5.5.4 trägt jede Antwort:** die sechs Invarianten und die Übersteuerbarkeit je Prüfung stehen fest, offen sind nur Rolle, Verfahren, Befristung und ob es ein eigenes Objekt braucht. Provisorisch: nur `MA` |
| 11 | Erfährt der Kunde, welcher Lieferant ein Angebot oder einen Kandidaten stellt, oder tritt der MSP als einziger sichtbarer Vertragspartner auf? | Kapitel 2.2, 2.3 | offen |
| 12 | Wer verwaltet kundenseitige Benutzer und Vertretungen — der Betreiber oder eine zusätzliche kundenseitige Administratorrolle? | Kapitel 2.1, 2.2, 2.4 | offen |
| 13 | Wie wird eine Organisation behandelt, die gleichzeitig Kunde und Lieferant ist (Mandantenzuordnung, Sichtbarkeit)? | Kapitel 2.3 | offen |
| 14 | Dürfen Kundenrollen (Bedarfsträger, Genehmiger) für mehrere Standorte und Kostenstellen eingeschränkt werden, und wer pflegt diese Zuständigkeit? | Kapitel 2.2, 3.1, 3.11 | offen |
| 15 | Wie wird das Vergleichsentgelt für Equal Pay geführt, und in welcher Form liefert der Entleiher es? | Kapitel 3.3, 3.7, 5.2 | **entschieden:** je Tätigkeit am Standort als `comparableWageEntry` (3.3), mit Herkunftsangabe; der Einsatz erbt den Wert |
| 16 | Granularität der Zeiterfassung: Zeitposition je Tag mit Stundensumme oder je Abschnitt mit Beginn, Ende und Pause? | Kapitel 3.8, 4.4 | offen |
| 17 | Darf je Einsatz ein von der Preisliste abweichender Satz vereinbart werden, und wer genehmigt die Abweichung? | Kapitel 3.3, 3.5, 3.7 | offen |
| 18 | Führt der Betreiber eine Personenidentität über Lieferanten hinweg, und mit welchen Merkmalen? | Kapitel 3.6, 5.1, 5.3 | **entschieden:** ja; abschließender Merkmalssatz Name, Geburtsdatum, Geburtsort, manuelle Bestätigung, enge Zweckbindung (3.6). Rechtsgrundlage → Frage 25 |
| 19 | Sind mehrere gleichzeitige Einsätze derselben Person beim selben Kunden zulässig, und wie zählen sie auf die Höchstüberlassungsdauer? | Kapitel 3.7, 5.1 | **entschieden:** zulässig; gezählt werden Kalendertage der Überlassung an denselben Entleiher, überlappende Tage genau einmal |
| 20 | Welche Nachweisarten sind Pflicht, und blockiert ein fehlender Nachweis oder warnt er nur? | Kapitel 3.10, 5.4, 5.5 | **entschieden:** fester Katalog mit gestufter Wirkung — Sperre bei AÜG-Erlaubnis, Arbeitserlaubnis und Unterweisung am Standort, sonst Warnung oder Information (5.4) |
| 21 | Wird im Stundenzettel eine Abwesenheitsart geführt (z. B. „krank") oder nur „keine Arbeitsleistung"? Krankheit ist ein Gesundheitsdatum nach Art. 9 DSGVO. | Kapitel 3.8, 6.3 | offen |
| 22 | Wie lange werden Audit-Einträge aufbewahrt, und wie verhält sich das zum Löschanspruch der betroffenen Person? | Kapitel 3.12, 6.5, 6.6 | offen |
| 23 | Darf der Lieferantendisponent eine Einladung selbst absagen? | Kapitel 2.2, 3.5, 4.2 | **entschieden:** ja, eng begrenzt auf die eigene Einladung; Matrix 2.2 trägt dafür `S[46]` |
| 24 | Darf eine Abrechnungsperiode geschlossen werden, solange einzelne Stundenzettel nicht entschieden sind — und wer entscheidet das? Heute verhindert ein hängender Zettel das Schließen der ganzen Periode. | Kapitel 3.9, 4.4, 4.5 | offen — mit der Änderung von Q35 (5.5.5) entfällt ein Anlass für hängende Zettel, der Grundkonflikt bleibt |
| 25 | **Juristisch zu prüfen:** Rechtsgrundlage der Personenidentität (3.6) — Verantwortlichkeit im MSP-Modell, Rechtsgrundlage nach Art. 6 DSGVO, Informationspflicht gegenüber dem Leiharbeitnehmer, Löschfrist. Die fachliche Entscheidung zu Frage 18 steht; die rechtliche Absicherung fehlt und ist keine Aufgabe dieses Projekts allein. | Kapitel 3.6, 6.1, 6.3, 6.5 | offen |
| 26 | **Juristisch zu prüfen:** Zählen Unterbrechungen von **bis zu** drei Monaten als Überlassungsdauer mit? „18 aufeinander folgende Monate" (§ 1 Abs. 1b Satz 1 AÜG) legt eine kalendarische Lesart nahe, „der Zeitraum vorheriger Überlassungen ist vollständig anzurechnen" (Satz 2) und § 8 Abs. 4 Satz 4 eine additive. 5.1.3 und 5.2.3 rechnen **additiv**: Lückentage verbrauchen Kalenderzeit, aber kein Fristbudget, `maxDurationEndDate` und `equalPayDueDate` verschieben sich um die Lückentage nach hinten. Die kalendarische Lesart wäre die strengere. Bei anderer Antwort ändert sich **nur** Schritt 5 in 5.1.3 und Schritt 3 in 5.2.3, keine andere Festlegung. | Kapitel 5.1, 5.2 | offen |
| 27 | **Juristisch zu prüfen:** Welche Grenze gilt, wenn sich `maxAssignmentDurationMonths` oder `equalPayDeadlineMonths` **während** einer laufenden Überlassungskette ändert — durch Tarifrunde, neue Betriebsvereinbarung, Standortwechsel oder (bei der Equal-Pay-Frist) Lieferantenwechsel? 5.1.2 und 5.2.2 rechnen mit dem Wert **am Stichtag**, eine Senkung wirkt damit nach vorn und erzeugt eine Warnung statt einer rückwirkenden Sperre. Denkbar wären auch: Wert am Kettenbeginn, oder abschnittsweise Betrachtung je Gültigkeitszeitraum. | Kapitel 5.1, 5.2 | offen |
| 28 | Soll der Verleiher das **tatsächliche Entgelt** des Leiharbeitnehmers melden, damit die Einhaltung von Equal Pay prüfbar wird — oder bleibt die Prüfung auf das Vorliegen des Vergleichsentgelts begrenzt (so heute 5.2.1)? Die Meldung würde Entgeltdaten einer natürlichen Person in das System holen, die es bisher bewusst nicht führt (1.4, 3.0 Festlegung 4 und 5), und wäre an Rechtsgrundlage, Datenminimierung und Zweckbindung zu messen. | Kapitel 5.2, 6.3, 6.4 | offen |
| 29 | **Juristisch zu prüfen:** Welche Rechtsfolge hat das Erlöschen oder der Entzug der AÜG-Erlaubnis für **laufende** Überlassungen — Abwicklungszeitraum nach § 2 Abs. 4 AÜG, Unterscheidung zwischen Nichtverlängerung, Rücknahme und Widerruf (§§ 4, 5 AÜG) — und wer entscheidet die Beendigung? 5.4.2 b) legt das **Systemverhalten** fest (keine automatische Beendigung, Sperre neuer Überlassungen, Warnung mit Pflicht-Eskalation, Übergang bereitgehalten) und ist damit mit jeder Antwort vereinbar. | Kapitel 4.3, 4.6, 5.4 | offen |
| 30 | Wie wird ein **Arbeitskampf am Einsatzort** erfasst, und wer darf die Zusicherung nach § 11 Abs. 5 Satz 2 AÜG abgeben? 5.3.2 beschreibt die benötigten Angaben (Standort, Zeitraum, betroffene Bereiche; Zusicherung je Einsatz mit Datum und erklärender Person), aber **3.1 führt dafür kein Feld und 3.7 kein Objekt** — behelfsweise als `document` mit `documentCategory = other`. Zu entscheiden sind der Feldsatz und die zuständige Kundenrolle (`KE` oder `KB`). | Kapitel 3.1, 3.7, 5.3 | offen |
| 31 | Welche Ergebnisart gilt, wenn 4.7 einem Übergang für die **Sammelprüfung P10** eine Wirkung zuordnet, der Pflichtkatalog in 5.4.4 der konkret fehlenden Nachweisart aber eine andere gibt? Betroffen sind Q21 (Sperre, während `qualificationCertificate` „nie Sperre" trägt), Q42, Q43 und Q44 (Sperre, während `clearanceCertificate` „nie Sperre" trägt) und Q10 (Information, während der Katalog einen fehlenden Qualifikationsnachweis als Warnung führt). 5.4.6 verweist für fehlende Nachweise ausdrücklich auf den Katalog und 5.4.4 nennt als Sammelergebnis das **strengste Einzelergebnis**; die Szenarien in `tests/aueg/permit-and-deadlines.feature` rechnen deshalb nach dem Katalog und benennen die Abweichung. | Kapitel 4.7, 5.4.4 | offen |
| 32 | Welche Frist gilt, wenn `equalPayDeadlineMonths` **über 15** liegt und **kein** `industryPremiumScheme` gesetzt ist? Fall 5 der Tabelle in 5.2.2 ergibt 9 Monate (die Verlängerung über neun Monate setzt die stufenweise Annäherung voraus), Fall 6 ergibt 15 Monate (gesetzliche Obergrenze). Beide Zeilen treffen zu, die Tabelle nennt keine Rangfolge. Die Szenarien in `tests/aueg/equal-pay.feature` lassen diese Kombination deshalb aus und prüfen nur die eindeutigen Fälle. | Kapitel 5.2 | offen |

Neue Fragen werden hier ergänzt, nicht im Code beantwortet.
