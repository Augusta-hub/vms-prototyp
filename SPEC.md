# Spezifikation — VMS für Arbeitnehmerüberlassung

**Status: Gliederung.** Dieses Dokument enthält heute nur die Struktur. Jeder
Abschnitt wird einzeln ausgearbeitet; unausgefüllte Punkte sind mit `TODO`
markiert. Keine Annahmen — ungeklärtes gehört in [Offene Fragen](#7-offene-fragen).

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
- 1.5 Glossar DE → EN (Fachbegriff, englischer Bezeichner, Definition) — TODO
  vervollständigen; die Begriffe aus Kapitel 2 sind unten bereits gemappt, die
  Bezeichner der Objekte folgen mit Kapitel 3

### 1.5 Glossar DE → EN (Auszug: Begriffe aus Kapitel 2)

Die Objektbezeichner (Kunde, Lieferant, Bedarfsanfrage, Einsatz, Stundenzettel
usw.) werden mit Kapitel 3 ergänzt und hier bewusst noch nicht vorweggenommen.

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
- Eigene Abrechnungsbelege prüfen und beanstanden *(offene Frage 6)*
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
- Die Matrix bleibt auf der Objektgranularität von Kapitel 3. Wo Kapitel 3 ein
  Objekt noch grob umreißt (z. B. 3.3, 3.8), bleibt die Zeile entsprechend
  grob — sie wird mit Kapitel 3 verfeinert, nicht hier erfunden.

| Objekt (Kap.) | MA | MD | KB | KG | KE | LD | LA | AN |
|---|---|---|---|---|---|---|---|---|
| Kunde / Entleiher (3.1) | A L Ä S X | L Ä[1] | L[2] | L[2] | L[2] Ä[1] | L[3] | L[3] | L[4] |
| Standort (3.1) | A L Ä S X | L Ä[1] | L[2] | L[2] | A[2] L[2] Ä[2] | L[3] | L[3] | L[4] |
| Kostenstelle (3.1) | A L Ä X | L | L[2] | L[2] | A[2] L[2] Ä[2] X[2] | – | – | – |
| Lieferant / Verleiher (3.2) | A L Ä S X | L Ä[1] S[5] | L[6] | – | L[6] | L[7] | L[7] Ä[7] | – |
| Rahmenvertrag, Preisliste, Tarifzuordnung (3.3) | A L Ä S X | L | – | L[8] | L[2] | L[9] | L[9] | – |
| Bedarfsanfrage (3.4) | A L Ä S X | A[10] L Ä S | A L[2] Ä[11] S[12] | L[2] S[13] | L[2] | L[14] | – | – |
| Ausschreibung / Verteilung (3.5) | A L Ä S X | A L Ä S | L[15] | – | L[15] | L[16] | – | – |
| Lieferantenangebot (3.5) | L S X | L S[17] | L[18] | – | L[2] | A L[7] Ä[19] S[20] X[21] | L[7] | – |
| Kandidat / Profilvorschlag (3.6) | L S X | L Ä[22] S[17] | L[23] S[24] | – | – | A L[7] Ä[7] S[20] X[21] | L[7] | L[4] |
| Einsatz / Überlassung (3.7) | A L Ä S X | A L Ä S | L[2] S[25] | L[2] S[26] | L[2] | L[7] S[25] | L[7] | L[4] |
| Stundenzettel, Zeitposition (3.8) | A L Ä S X | A[27] L Ä[28] S | L[2] S[29] | L[2] S[29] | L[2] | A[27] L[7] Ä[28] S[20] | L[7] | A[4] L[4] Ä[4] S[4] |
| Zuschlagsart (Katalog, 3.8) | A L Ä X | L | – | – | L[2] | L[9] | – | – |
| Abrechnungsbeleg (3.9) | A L Ä S X | A L S[30] | – | – | L[2] S[31] | L[7] S[32] | L[7] | – |
| Abrechnungsperiode (3.9) | A L Ä S X | L S[33] | – | – | L[2] | L[7] | L[7] | – |
| Dokument / Nachweis (3.10) | A L Ä S X | L S[34] | L[35] | – | L[36] | A L[7] Ä[37] | A L[7] Ä[37] X[37] | L[4] |
| Benutzer, Rolle, Mandantenzuordnung (3.11) | A L Ä S X | L[38] | – | – | L[2] | – | A[7] L[7] Ä[7] S[7] X[7] | – |
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
| [32] | Bestätigen oder beanstanden; die Rolle des Lieferanten im Belegfluss hängt an **offener Frage 6**. |
| [33] | Öffnen und Schließen einer Abrechnungsperiode. |
| [34] | Nachweis anerkennen oder zurückweisen (Kapitel 5.4). |
| [35] | Nur einsatzbezogene Nachweise zum eigenen Kunden (z. B. Unterweisung, Qualifikation), keine Vertragsunterlagen des Lieferanten. |
| [36] | Nur Gültigkeitsstatus der AÜG-Erlaubnis der beauftragten Lieferanten, ohne Urkundeninhalte. |
| [37] | Nur solange der Nachweis nicht anerkannt ist. |
| [38] | Nur lesend, zur Zuordnung von Vorgängen; die Rollenvergabe bleibt bei MA bzw. LA. Die kundenseitige Benutzerverwaltung liegt derzeit beim Betreiber — **offene Frage 12**. |
| [39] | Nur Einträge zu Objekten der eigenen Organisation bzw. des betreuten Kunden. Audit-Einträge entstehen ausschließlich durch das System und sind für jede Rolle unveränderlich — deshalb trägt die Zeile kein `Ä` und kein `X`. |

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

- 3.1 Kunde (Entleiher), Standort, Kostenstelle — TODO
- 3.2 Lieferant (Verleiher) inkl. AÜG-Erlaubnis und Vertragsrahmen — TODO
- 3.3 Rahmenvertrag, Preisliste / Konditionen, Tarifzuordnung — TODO
- 3.4 Bedarfsanfrage (Anforderung) — TODO
- 3.5 Ausschreibung / Verteilung an Lieferanten, Lieferantenangebot — TODO
- 3.6 Kandidat / Profilvorschlag — TODO
- 3.7 Einsatz (Überlassung) mit Laufzeit, Verlängerung, Beendigung — TODO
- 3.8 Stundenzettel, Zeitposition, Zuschlagsart — TODO
- 3.9 Abrechnungsbeleg (Gutschrift / Rechnung), Abrechnungsperiode — TODO
- 3.10 Dokument / Nachweis (Erlaubnisurkunde, Unterweisung, Qualifikation) — TODO
- 3.11 Benutzer, Rolle, Mandantenzuordnung — TODO
- 3.12 Audit-Eintrag (fachliches Protokoll) — TODO
- 3.13 Beziehungen und Kardinalitäten (Übersichtsdiagramm) — TODO

## 4. Statusmodelle

Je Modell: Zustände, erlaubte Übergänge, auslösende Rolle, Vorbedingungen,
Nebenwirkungen (Benachrichtigung, Sperre, Protokolleintrag).

- 4.1 Bedarfsanfrage: Entwurf → freigegeben → ausgeschrieben → in Auswahl →
  besetzt → storniert / abgelaufen — TODO verfeinern
- 4.2 Lieferantenangebot / Profilvorschlag: eingereicht → gesichtet →
  Interview → zugesagt → abgelehnt → zurückgezogen — TODO verfeinern
- 4.3 Einsatz: geplant → aktiv → unterbrochen → verlängert → beendet →
  vorzeitig beendet — TODO verfeinern
- 4.4 Stundenzettel: erfasst → eingereicht → in Prüfung → genehmigt →
  abgelehnt → korrigiert — TODO verfeinern
- 4.5 Abrechnungsbeleg: offen → erstellt → geprüft → freigegeben →
  storniert — TODO verfeinern
- 4.6 Lieferantenstatus: Onboarding → aktiv → gesperrt → inaktiv — TODO
- 4.7 Querschnitt: welche Statusübergänge AÜG-Prüfungen auslösen (Verweis
  auf Kapitel 5) — TODO

## 5. AÜG-Regeln

Verbindlich für den Prototyp. Jede Regel wird in `tests/aueg/` als
Gherkin-Szenario hinterlegt, bevor sie implementiert wird.

### 5.1 Höchstüberlassungsdauer

- Regelgrenze 18 Monate je Leiharbeitnehmer bei demselben Entleiher
  (§ 1 Abs. 1b AÜG) — Berechnungsvorschrift TODO
- Unterbrechung von mehr als 3 Monaten setzt die Zählung zurück — TODO
- Tarifliche Abweichung (Öffnungsklausel, Betriebsvereinbarung) — TODO
- Zählung über mehrere Einsätze, Lieferanten und Standorte hinweg — TODO
- Warn- und Sperrschwellen im System (Vorlauf, Eskalation) — TODO
- Rechtsfolge bei Überschreitung und Systemverhalten — TODO

### 5.2 Equal Pay / Equal Treatment

- Gleichstellungsgrundsatz (§ 8 Abs. 1 AÜG) — TODO
- Abweichung durch Tarifvertrag der Zeitarbeitsbranche — TODO
- Equal Pay spätestens nach 9 Monaten (§ 8 Abs. 4 AÜG) — TODO
- Branchenzuschlagstarifverträge als abweichendes Modell — TODO
- Vergleichsentgelt: welche Daten der Entleiher liefern muss — TODO
- Fristenberechnung und Unterbrechungswirkung — TODO
- Systemverhalten: Warnung, Pflichtfeld, Freigabesperre — TODO

### 5.3 Drehtürklausel, Arbeitskampf, Kennzeichnung

- Drehtürklausel: vorheriges Arbeitsverhältnis beim Entleiher oder
  Konzernunternehmen (§ 8 Abs. 3 AÜG) — TODO
- Einsatzverbot bei Arbeitskampf (§ 11 Abs. 5 AÜG) — TODO
- Kennzeichnungs- und Konkretisierungspflicht des Überlassungsvertrags
  (§ 1 Abs. 1 AÜG) — TODO
- Abgrenzung zu Werk- und Dienstvertrag, verdeckte Überlassung — TODO
- Systemverhalten je Regel (harte Sperre vs. dokumentierte Ausnahme) — TODO

### 5.4 Erlaubnis, Nachweise und Fristen

- Überwachung der AÜG-Erlaubnis je Lieferant: Gültigkeit, Befristung,
  Verlängerung, unbefristete Erlaubnis — TODO
- Sperre von Lieferanten ohne gültigen Nachweis — TODO
- Erinnerungs- und Eskalationsfristen vor Ablauf — TODO
- Weitere Nachweise (Unbedenklichkeitsbescheinigungen, Qualifikationen,
  Unterweisungen) — TODO
- Aufzeichnungs- und Dokumentationspflichten — TODO

### 5.5 Regelwerk-Mechanik

- Wo greifen Prüfungen: Statusübergang, Speicherung, nächtlicher Lauf — TODO
- Ergebnisarten: Information, Warnung, Sperre — TODO
- Ausnahmen: wer darf übersteuern, mit welcher Begründung, Protokoll — TODO
- Stichtagslogik und rückwirkende Änderungen — TODO

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
| 1 | Tech-Stack (Sprache, Framework, Datenbank, ORM) | gesamtes Projekt | offen |
| 2 | Konkreter Hoster und Betriebsmodell (Hetzner / IONOS / anderer DE-EU-Anbieter) | Kapitel 6.9 | offen |
| 3 | Welcher Tarifvertrag ist zugrunde zu legen (iGZ/BAP, Branchenzuschläge)? | Kapitel 5.1, 5.2 | offen |
| 4 | Bekommen Leiharbeitnehmer einen eigenen Zugang (z. B. Zeiterfassung)? | Kapitel 2 | offen |
| 5 | Mehrstufige Genehmigung der Stundenzettel: wie viele Stufen, welche Rollen? | Kapitel 4.4 | offen |
| 6 | Gutschriftverfahren oder Rechnungseingang des Lieferanten? | Kapitel 3.9 | offen |
| 7 | Schnittstellen zu Fremdsystemen (ERP, Zeitwirtschaft, HR4YOU) im Prototyp? | Kapitel 1.4 | offen |
| 8 | Werden mehrere Kunden eines MSP in einer Instanz oder getrennt betrieben? | Kapitel 1.3 | offen |
| 9 | Welche Kennzahlen muss das Reporting zwingend liefern? | Kapitel 3 | offen |
| 10 | Wie werden Ausnahmen von AÜG-Sperren fachlich genehmigt? | Kapitel 5.5 | offen |
| 11 | Erfährt der Kunde, welcher Lieferant ein Angebot oder einen Kandidaten stellt, oder tritt der MSP als einziger sichtbarer Vertragspartner auf? | Kapitel 2.2, 2.3 | offen |
| 12 | Wer verwaltet kundenseitige Benutzer und Vertretungen — der Betreiber oder eine zusätzliche kundenseitige Administratorrolle? | Kapitel 2.1, 2.2, 2.4 | offen |
| 13 | Wie wird eine Organisation behandelt, die gleichzeitig Kunde und Lieferant ist (Mandantenzuordnung, Sichtbarkeit)? | Kapitel 2.3 | offen |
| 14 | Dürfen Kundenrollen (Bedarfsträger, Genehmiger) für mehrere Standorte und Kostenstellen eingeschränkt werden, und wer pflegt diese Zuständigkeit? | Kapitel 2.2 | offen |

Neue Fragen werden hier ergänzt, nicht im Code beantwortet.
