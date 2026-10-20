# language: de
#
# Ausfuehrbare Fassung der AUEG-Regel "Hoechstueberlassungsdauer" (SPEC 5.1).
#
# Quellen: SPEC 5.0 (Stichtag, Fristenarithmetik, Ueberlassungskette, fehlende
# Daten), SPEC 5.1 (Pruefungen P1 und P2), die Querschnittstabelle 4.7
# (Q03, Q07, Q11, Q14, Q23, Q24, Q25, Q26, Q27, Q28, Q30, Q33, Q35) und
# SPEC 5.5 (Ergebnisarten, rueckwirkende Aenderungen, Uebersteuerung,
# naechtlicher Lauf N2 und N6).
#
# Lesart der Erwartungen (SPEC 4.7, 5.5.2):
#   Information - der Uebergang findet statt, das Ergebnis wird vermerkt
#   Warnung     - der Uebergang findet statt, Benachrichtigung und Eskalation
#   Sperre      - der Uebergang findet nicht statt, der Vorgang bleibt stehen
#
# Firmen, Personen, Tarifparameter und Datumsangaben sind synthetisch.
# Step-Definitions und Runner fehlen bewusst: diese Datei ist Spezifikation in
# ausfuehrbarer Form und wird nie geaendert, um einen Test gruen zu bekommen.

@spec-5.1 @aueg-1-abs-1b
Funktionalität: Höchstüberlassungsdauer je Person und Entleiher

  Derselbe Leiharbeitnehmer darf demselben Entleiher nicht länger als die
  zulässige Dauer überlassen werden; Zeiten vorheriger Überlassungen an
  denselben Entleiher sind vollständig anzurechnen, wenn zwischen ihnen jeweils
  nicht mehr als drei Monate liegen (§ 1 Abs. 1b AÜG).
  Gezählt werden Kalendertage der Überlassung, nicht Monate: die Monatsgrenze
  wird nach §§ 187 Abs. 2, 188 Abs. 2 BGB in ein Tagebudget ab Kettenbeginn
  umgerechnet (SPEC 5.1.3). Bezugspunkt ist der Kunde, Schlüssel ist die
  bestätigte Personenidentität — ein Lieferantenwechsel verlängert nichts.

  Grundlage:
    Angenommen der Entleiher "Nordwerk Metall GmbH" führt den Standort "Werk Süd" mit der Kostenstelle "KST-4711"
    Und der Lieferant "Rheinpersonal GmbH" ist aktiv und hat eine anerkannte, unbefristete AÜG-Erlaubnis
    Und für den Standort "Werk Süd" ist die Tarifzuordnung "Beispieltarif E1" mit maxAssignmentDurationMonths = 18 vom 01.01.2025 bis 31.12.2028 gültig
    Und die Personenidentität "PI-1001" ist für den Kandidaten "Jana Behrens" bei "Rheinpersonal GmbH" bestätigt
    Und außer der jeweils geprüften Regel liefert keine andere AÜG-Prüfung einen Befund
    Und die Angaben dieser Grundlage gelten, soweit ein Szenario nichts anderes sagt — Laufzeiten und Tarifparameter werden dort eigens gesetzt

  # ------------------------------------------------------------------
  # Rechengrundlage: die Überlassungskette (SPEC 5.0, 5.1.3)
  # ------------------------------------------------------------------

  @p1 @information @rechenweg
  Szenario: Tagebudget und Fristende einer lückenlosen Kette
    Angenommen "Jana Behrens" ist bei "Nordwerk Metall GmbH" seit dem 15.01.2026 lückenlos überlassen
    Und die Grenze beträgt 18 Monate
    Wenn der Betreiber die Höchstüberlassungsdauer zum Stichtag 15.01.2026 rechnet
    Dann ist der Kettenbeginn der 15.01.2026
    Und das Tagebudget beträgt 546 Tage, nämlich die Kalendertage vom 15.01.2026 bis zum 14.07.2027
    Und das Fristende der Höchstüberlassungsdauer ist der 14.07.2027
    Und das Ergebnis der Prüfung P1 ist eine Information

  @p1 @information @grenzfall
  Szenario: Gleichzeitige Einsätze mit überlappenden Tagen zählen einmal
    Angenommen "Jana Behrens" ist bei "Nordwerk Metall GmbH" vom 15.01.2026 bis 14.04.2026 über die Kostenstelle "KST-4711" überlassen
    Und dieselbe Person ist vom 15.02.2026 bis 14.05.2026 zusätzlich über die Kostenstelle "KST-4712" desselben Kunden überlassen
    Wenn der Betreiber die angerechnete Dauer zum Stichtag 14.05.2026 rechnet
    Dann zählt jeder Kalendertag mit mindestens einer laufenden Überlassung genau einmal
    Und die angerechnete Dauer beträgt 120 Tage, nämlich die Kalendertage vom 15.01.2026 bis zum 14.05.2026
    Und die Kette läuft ohne Lücke weiter, obwohl der erste Einsatz am 14.04.2026 endet

  @p1 @information @grenzfall
  Szenario: Lieferantenwechsel mitten im Einsatz unterbricht die Kette nicht
    Angenommen "Jana Behrens" ist über "Rheinpersonal GmbH" vom 15.01.2026 bis 31.05.2026 überlassen und dieser Einsatz wird zum 31.05.2026 vorzeitig beendet
    Und dieselbe Person ist als Kandidat "Jana Behrens" bei "Elbe Zeitarbeit GmbH" geführt und mit der Personenidentität "PI-1001" bestätigt verknüpft
    Und ein neuer Einsatz über "Elbe Zeitarbeit GmbH" beginnt am 01.06.2026 am Standort "Werk Süd"
    Wenn der Betreiber die Höchstüberlassungsdauer zum Stichtag 01.06.2026 rechnet
    Dann bleibt der Kettenbeginn der 15.01.2026
    Und die angerechnete Dauer wird über beide Einsätze fortgeschrieben und beträgt 138 Tage
    Und das Fristende bleibt der 14.07.2027
    Und das Ergebnis der Prüfung P1 ist eine Information

  @p1 @information @grenzfall
  Szenario: Jeder Kunde ist eine eigene Kette, auch im Konzern
    Angenommen "Jana Behrens" ist bei "Nordwerk Metall GmbH" seit dem 15.01.2026 lückenlos überlassen
    Und "Nordwerk Metall GmbH" und "Nordwerk Service GmbH" gehören zum Konzernverbund "Nordwerk Gruppe"
    Und für "Nordwerk Service GmbH" ist eine Überlassung derselben Person ab dem 01.03.2026 geplant
    Wenn der Betreiber die Höchstüberlassungsdauer für den geplanten Einsatz bei "Nordwerk Service GmbH" rechnet
    Dann ist der Kettenbeginn dieser Kette der 01.03.2026
    Und die Überlassungstage bei "Nordwerk Metall GmbH" werden nicht angerechnet
    Und das Ergebnis der Prüfung P1 ist eine Information

  @p1 @information @grenzfall
  Szenario: Einsatz, der nie begonnen hat, erzeugt keinen Überlassungstag
    Angenommen für "Jana Behrens" ist bei "Nordwerk Metall GmbH" ein Einsatz vom 01.03.2026 bis 31.08.2026 im Status "planned" angelegt
    Und die Person war bei diesem Kunden vorher nicht überlassen
    Und der Einsatz hat kein tatsächliches Beginndatum
    Wenn der MSP-Disponent den Einsatz mit Begründung in den Status "terminatedEarly" überführt
    Dann ist das Ergebnis der Prüfung P1 eine Information
    Und die angerechnete Dauer beträgt 0 Tage
    Und es entsteht keine Überlassungskette bei diesem Kunden

  # ------------------------------------------------------------------
  # Q03 — Bedarfsanfrage submitted -> approved, P1-Vorschau ohne Person
  # Ergebnisart: Information (4.7, bestätigt in 5.5.5)
  # ------------------------------------------------------------------

  @q03 @p1 @information
  Szenario: Q03 Angefragter Zeitraum liegt innerhalb der Höchstüberlassungsdauer
    Angenommen die Bedarfsanfrage "BA-2026-001" des Bedarfsträgers für den Standort "Werk Süd" steht im Status "submitted"
    Und sie fragt den Zeitraum vom 01.03.2026 bis 31.12.2026 an
    Wenn der Genehmiger die Bedarfsanfrage in den Status "approved" überführt
    Dann ist das Ergebnis der Prüfung P1 eine Information
    Und die Information nennt die angefragte Dauer von 306 Tagen und die Grenze von 18 Monaten
    Und der Status der Bedarfsanfrage ist "approved"
    Und ein Protokolleintrag mit der Prüfung "maxDurationCheck" liegt vor

  @q03 @p1 @information
  Szenario: Q03 Angefragter Zeitraum ist länger als die Höchstüberlassungsdauer
    Angenommen die Bedarfsanfrage "BA-2026-002" für den Standort "Werk Süd" steht im Status "submitted"
    Und sie fragt den Zeitraum vom 01.03.2026 bis 31.12.2027 an
    Wenn der Genehmiger die Bedarfsanfrage in den Status "approved" überführt
    Dann ist das Ergebnis der Prüfung P1 eine Information
    Und die Information nennt, dass der angefragte Zeitraum die Grenze von 18 Monaten überschreitet und der Bedarf nicht mit einer Person zu besetzen ist
    Und der Status der Bedarfsanfrage ist "approved"
    Und das Ergebnis ist als Vorschau ohne Personenbezug gekennzeichnet

  @q03 @p1 @information @grenzfall
  Szenario: Q03 Bedarfsanfrage ohne Enddatum
    Angenommen die Bedarfsanfrage "BA-2026-003" für den Standort "Werk Süd" steht im Status "submitted"
    Und sie nennt den Beginn 01.03.2026 und kein Enddatum
    Wenn der Genehmiger die Bedarfsanfrage in den Status "approved" überführt
    Dann ist das Ergebnis der Prüfung P1 eine Information
    Und der Prüfzeitraum besteht nur aus dem 01.03.2026
    Und die Information nennt, dass ein unbefristeter Bedarf vorliegt

  # ------------------------------------------------------------------
  # Q07 — Profilvorschlag submitted -> reviewed, P1 Warnschwelle
  # Ergebnisart: Warnung (4.7, bestätigt in 5.5.5)
  # ------------------------------------------------------------------

  @q07 @p1 @information
  Szenario: Q07 Restbudget liegt über den Schwellen
    Angenommen der Profilvorschlag "PV-2026-010" für "Jana Behrens" steht im Status "submitted"
    Und er nennt als verfügbar ab den 01.06.2026, die Bedarfsanfrage endet am 31.12.2026
    Und die angerechnete Dauer der Kette beträgt zum Stichtag 01.06.2026 138 Tage, das Restbudget 408 Tage
    Wenn der MSP-Disponent den Profilvorschlag in den Status "reviewed" überführt
    Dann ist das Ergebnis der Prüfung P1 eine Information
    Und der Status des Profilvorschlags ist "reviewed"

  @q07 @p1 @warnung
  Szenario: Q07 Restbudget unter der Warnschwelle von 30 Tagen
    Angenommen der Profilvorschlag "PV-2027-044" für "Jana Behrens" steht im Status "submitted"
    Und er nennt als verfügbar ab den 14.06.2027, die Bedarfsanfrage endet am 31.08.2027
    Und die angerechnete Dauer der Kette beträgt zum Stichtag 14.06.2027 516 Tage, das Restbudget 30 Tage
    Wenn der MSP-Disponent den Profilvorschlag in den Status "reviewed" überführt
    Dann ist das Ergebnis der Prüfung P1 eine Warnung
    Und der Eskalationsanlass "Warnschwelle Höchstüberlassungsdauer erreicht" wird erzeugt und dem MSP-Administrator angezeigt
    Und der Bedarfsträger erhält zusätzlich eine Information
    Und der Status des Profilvorschlags ist "reviewed"

  @q07 @p1 @information
  Szenario: Q07 Restbudget unter der Hinweisschwelle von 90 Tagen
    Angenommen der Profilvorschlag "PV-2027-041" für "Jana Behrens" steht im Status "submitted"
    Und er nennt als verfügbar ab den 15.04.2027, die Bedarfsanfrage endet am 30.06.2027
    Und die angerechnete Dauer der Kette beträgt zum Stichtag 15.04.2027 456 Tage, das Restbudget 90 Tage
    Wenn der MSP-Disponent den Profilvorschlag in den Status "reviewed" überführt
    Dann ist das Ergebnis der Prüfung P1 eine Information mit Hinweis auf das Restbudget
    Und der MSP-Disponent ist Adressat der Information
    Und der Status des Profilvorschlags ist "reviewed"

  @q07 @p1 @warnung @grenzfall
  Szenario: Q07 Keine bestätigte Personenidentität — Zählgrundlage ist begrenzt
    Angenommen der Profilvorschlag "PV-2026-021" für den Kandidaten "Tobias Krohn" bei "Elbe Zeitarbeit GmbH" steht im Status "submitted"
    Und für diesen Kandidaten ist keine bestätigte Personenidentität geführt
    Und über den Kandidatensatz dieses Lieferanten sind 60 Überlassungstage bei "Nordwerk Metall GmbH" bekannt
    Wenn der MSP-Disponent den Profilvorschlag in den Status "reviewed" überführt
    Dann ist das Ergebnis der Prüfung P1 eine Information ohne Treffer
    Und das Ergebnis trägt den Vermerk "Zählgrundlage auf einen Lieferanten begrenzt"
    Und der Vermerk ist an den MSP-Disponenten adressiert und erreicht den Lieferanten nicht
    Und der Status des Profilvorschlags ist "reviewed"

  @q07 @p1 @grenzfall
  Szenario: Q07 Unbestätigter maschineller Identitätsvorschlag zählt nicht
    Angenommen der Profilvorschlag "PV-2026-022" für den Kandidaten "Tobias Krohn" bei "Elbe Zeitarbeit GmbH" steht im Status "submitted"
    Und das System hat diesen Kandidatensatz maschinell mit der Personenidentität "PI-1002" verknüpft, die Verknüpfung ist nicht bestätigt
    Und über die Kandidatensätze der Personenidentität "PI-1002" sind 500 Überlassungstage bei "Nordwerk Metall GmbH" bekannt
    Wenn der MSP-Disponent den Profilvorschlag in den Status "reviewed" überführt
    Dann werden die 500 Tage nicht angerechnet
    Und das Ergebnis der Prüfung P1 trägt die Information, dass ein unbestätigter Identitätsvorschlag vorliegt
    Und diese Information ist an den MSP-Disponenten adressiert, nicht an den Lieferanten
    Und der Status des Profilvorschlags ist "reviewed"

  # ------------------------------------------------------------------
  # Q11 — Profilvorschlag -> accepted, P1
  # Ergebnisart: Sperre (4.7, bestätigt in 5.5.5); P1 ist übersteuerbar (5.5.4)
  # ------------------------------------------------------------------

  @q11 @p1 @information
  Szenario: Q11 Zusage innerhalb des Fristendes
    Angenommen der Profilvorschlag "PV-2027-050" für "Jana Behrens" steht im Status "releasedToCustomer"
    Und er nennt als verfügbar ab den 01.03.2027, die Bedarfsanfrage endet am 30.06.2027
    Und das Fristende der Höchstüberlassungsdauer ist der 14.07.2027
    Wenn der Bedarfsträger den Profilvorschlag zusagt und der MSP-Disponent den Status "accepted" setzt
    Dann ist das Ergebnis der Prüfung P1 eine Information
    Und der Status des Profilvorschlags ist "accepted"

  @q11 @p1 @information @grenzfall
  Szenario: Q11 Prüfzeitraum endet genau am Fristende
    Angenommen der Profilvorschlag "PV-2027-051" für "Jana Behrens" steht im Status "releasedToCustomer"
    Und er nennt als verfügbar ab den 01.03.2027, die Bedarfsanfrage endet am 14.07.2027
    Und das Fristende der Höchstüberlassungsdauer ist der 14.07.2027
    Wenn der Bedarfsträger den Profilvorschlag zusagt und der MSP-Disponent den Status "accepted" setzt
    Dann ist das Ergebnis der Prüfung P1 eine Warnung wegen des Restbudgets von 0 Tagen nach dem 14.07.2027
    Und der Status des Profilvorschlags ist "accepted"
    Und der 14.07.2027 bleibt der letzte zulässige Überlassungstag

  @q11 @p1 @sperre
  Szenario: Q11 Zusage würde die Höchstüberlassungsdauer überschreiten
    Angenommen der Profilvorschlag "PV-2027-052" für "Jana Behrens" steht im Status "releasedToCustomer"
    Und er nennt als verfügbar ab den 01.06.2027, die Bedarfsanfrage endet am 31.12.2027
    Und das Fristende der Höchstüberlassungsdauer ist der 14.07.2027
    Wenn der Bedarfsträger den Profilvorschlag zusagt und der MSP-Disponent den Status "accepted" setzt
    Dann ist das Ergebnis der Prüfung P1 eine Sperre
    Und der Status des Profilvorschlags ist weiter "releasedToCustomer"
    Und ein Protokolleintrag mit der Prüfung "maxDurationCheck" und dem Ergebnis "blocked" liegt vor
    Und die Sperre nennt das Fristende 14.07.2027 und den letzten Tag des Prüfzeitraums 31.12.2027

  @q11 @p1 @uebersteuerung
  Szenario: Q11 Übersteuerung, weil die Personenidentität falsch verknüpft war
    Angenommen die Zusage zum Profilvorschlag "PV-2027-052" ist durch die Prüfung P1 gesperrt
    Und die Kandidatensätze "KA-77" und "KA-91" sind irrtümlich derselben Personenidentität "PI-1001" zugeordnet und betreffen nachweislich zwei verschiedene Personen
    Und die Trennung der Identitäten ist vor der Entscheidung des Kunden nicht möglich
    Und nach richtiger Datenlage wäre die Überlassung zulässig
    Wenn der MSP-Administrator den Übergang mit Pflichtbegründung übersteuert
    Dann findet der Übergang statt und der Status des Profilvorschlags ist "accepted"
    Und zwei Protokolleinträge liegen vor: der abgelehnte Übergang mit dem Ergebnis "blocked" und der vollzogene mit dem Ergebnis "success"
    Und der vollzogene Eintrag trägt die Prüfung "maxDurationCheck" und die Begründung mit Tatsachenbezug
    Und die Übersteuerung gilt nur für diesen einen Übergang dieses Profilvorschlags
    Und die Übersteuerung wird in der Übersteuerungsübersicht des Betreibers geführt

  @q11 @p1 @uebersteuerung
  Szenario: Q11 Übersteuerungsversuch ohne richtige Datenlage wird zurückgewiesen
    Angenommen die Zusage zum Profilvorschlag "PV-2027-052" ist durch die Prüfung P1 gesperrt
    Und die Daten der Kette sind unstreitig richtig
    Und die Überlassung wäre auch nach richtiger Datenlage unzulässig
    Wenn der MSP-Administrator den Übergang zu übersteuern versucht
    Dann wird die Übersteuerung zurückgewiesen, weil die Bedingung "nach richtiger Datenlage zulässig" nicht erfüllt ist
    Und der Status des Profilvorschlags ist weiter "releasedToCustomer"
    Und der Versuch wird protokolliert

  @q11 @p1 @uebersteuerung
  Szenario: Q11 Übersteuerung in Vertretung wird zurückgewiesen
    Angenommen die Zusage zum Profilvorschlag "PV-2027-052" ist durch die Prüfung P1 gesperrt
    Und die Bedingungen für eine Übersteuerung sind erfüllt
    Wenn eine Person in Vertretung des MSP-Administrators den Übergang zu übersteuern versucht
    Dann wird die Übersteuerung zurückgewiesen, weil sie nicht vertretbar ist
    Und der Status des Profilvorschlags ist weiter "releasedToCustomer"

  @q11 @p1 @uebersteuerung
  Szenario: Q11 Übersteuerung durch den MSP-Disponenten wird zurückgewiesen
    Angenommen die Zusage zum Profilvorschlag "PV-2027-052" ist durch die Prüfung P1 gesperrt
    Und die Bedingungen für eine Übersteuerung sind erfüllt
    Wenn der MSP-Disponent den Übergang zu übersteuern versucht
    Dann wird die Übersteuerung zurückgewiesen, weil nur der MSP-Administrator übersteuern darf
    Und der MSP-Disponent kann den Vorgang an den MSP-Administrator eskalieren
    Und der Status des Profilvorschlags ist weiter "releasedToCustomer"

  # ------------------------------------------------------------------
  # Q14 — Einsatz -> planned, P1
  # Ergebnisart: Sperre (4.7, bestätigt in 5.5.5)
  # ------------------------------------------------------------------

  @q14 @p1 @information
  Szenario: Q14 Einsatz anlegen innerhalb des Fristendes
    Angenommen "Jana Behrens" ist bei "Nordwerk Metall GmbH" seit dem 15.01.2026 lückenlos überlassen
    Und das Fristende der Höchstüberlassungsdauer ist der 14.07.2027
    Wenn der MSP-Disponent einen Einsatz mit geplantem Beginn 01.03.2027 und geplantem Ende 30.06.2027 in den Status "planned" überführt
    Dann ist das Ergebnis der Prüfung P1 eine Information
    Und der Status des Einsatzes ist "planned"
    Und die abgeleiteten Felder angerechnete Dauer und Fristende sind an jedem Einsatz der Kette fortgeschrieben

  @q14 @p1 @sperre
  Szenario: Q14 Geplantes Ende nach dem Fristende wird gesperrt
    Angenommen "Jana Behrens" ist bei "Nordwerk Metall GmbH" seit dem 15.01.2026 lückenlos überlassen
    Und das Fristende der Höchstüberlassungsdauer ist der 14.07.2027
    Wenn der MSP-Disponent einen Einsatz mit geplantem Beginn 01.06.2027 und geplantem Ende 31.08.2027 in den Status "planned" überführen will
    Dann ist das Ergebnis der Prüfung P1 eine Sperre
    Und es entsteht kein Einsatz im Status "planned"
    Und die Sperre nennt das Fristende 14.07.2027 und das geplante Ende 31.08.2027

  @q14 @p1 @uebersteuerung
  Szenario: Q14 Übersteuerung, weil eine Unterbrechung nicht erfasst war
    Angenommen das Anlegen des Einsatzes mit geplantem Ende 31.08.2027 ist durch die Prüfung P1 gesperrt
    Und die Überlassung war nachweislich vom 01.06.2026 bis 30.09.2026 unterbrochen, diese Unterbrechung ist im System nicht erfasst
    Und die Erfassung ist vor dem geplanten Beginn nicht möglich
    Und nach richtiger Datenlage wäre die Überlassung zulässig, weil die Unterbrechung die Zählung zurücksetzt
    Wenn der MSP-Administrator den Übergang mit Pflichtbegründung übersteuert
    Dann findet der Übergang statt und der Status des Einsatzes ist "planned"
    Und zwei Protokolleinträge liegen vor, der abgelehnte mit "blocked" und der vollzogene mit "success"
    Und die Begründung nennt die nicht erfasste Unterbrechung als Tatsache

  @q14 @p1 @information @grenzfall
  Szenario: Q14 Unbefristeter Bedarf — geplantes Ende fehlt
    Angenommen "Jana Behrens" ist bei "Nordwerk Metall GmbH" seit dem 15.01.2026 lückenlos überlassen
    Und das Fristende der Höchstüberlassungsdauer ist der 14.07.2027
    Wenn der MSP-Disponent einen Einsatz mit geplantem Beginn 01.03.2027 und ohne geplantes Ende in den Status "planned" überführt
    Dann ist das Ergebnis der Prüfung P1 eine Information
    Und der Status des Einsatzes ist "planned"
    Und das Fristende wird kalendarisch fortgeschrieben und bleibt der 14.07.2027
    Und die Information nennt, dass der 14.07.2027 die faktische Obergrenze des unbefristeten Einsatzes ist

  @q14 @p1 @sperre @grenzfall
  Szenario: Q14 Fehlende Laufzeitdaten wirken wie ein Treffer
    Angenommen für "Jana Behrens" soll ein Einsatz bei "Nordwerk Metall GmbH" angelegt werden
    Und der Einsatz trägt kein geplantes Beginndatum
    Wenn der MSP-Disponent den Einsatz in den Status "planned" überführen will
    Dann ist die Überlassungskette nicht bildbar
    Und das Ergebnis der Prüfung P1 ist eine Sperre
    Und die Sperre nennt das fehlende Feld "plannedStartDate" am Einsatz

  @q14 @p1 @sperre @grenzfall
  Szenario: Q14 Widersprüchliche Laufzeitdaten wirken wie ein Treffer
    Angenommen für "Jana Behrens" soll ein Einsatz bei "Nordwerk Metall GmbH" angelegt werden
    Und der Einsatz nennt den geplanten Beginn 01.06.2027 und das geplante Ende 01.03.2027
    Wenn der MSP-Disponent den Einsatz in den Status "planned" überführen will
    Dann ist das Ergebnis der Prüfung P1 eine Sperre
    Und die Sperre nennt die widersprüchlichen Felder "plannedStartDate" und "plannedEndDate"

  @q14 @p1 @information @grenzfall
  Szenario: Q14 Zeitraum ohne Tarifzuordnung — gesetzliche Regelgrenze
    Angenommen die Tarifzuordnung "Beispieltarif E1" für den Standort "Werk Süd" ist nur bis zum 31.12.2025 gültig
    Und für den Stichtag deckt keine Tarifzuordnung den Standort und den Kunden ab
    Und "Jana Behrens" ist bei "Nordwerk Metall GmbH" seit dem 15.01.2026 lückenlos überlassen
    Wenn der MSP-Disponent einen Einsatz mit geplantem Beginn 01.03.2027 und geplantem Ende 30.06.2027 in den Status "planned" überführt
    Dann wird mit der gesetzlichen Regelgrenze von 18 Monaten gerechnet
    Und das Ergebnis trägt zusätzlich die Information, dass mit der Regelgrenze gerechnet wurde
    Und diese Information ist an den MSP-Administrator adressiert
    Und der Status des Einsatzes ist "planned"

  @q14 @p1 @information @grenzfall
  Szenario: Q14 Abweichende tarifliche Grenze am Standort geht der Kundenzuordnung vor
    Angenommen für den Kunden "Nordwerk Metall GmbH" ist die Tarifzuordnung "Beispieltarif E2" mit maxAssignmentDurationMonths = 24 gültig
    Und für den Standort "Werk Süd" ist die Tarifzuordnung "Beispieltarif E1" mit maxAssignmentDurationMonths = 18 gültig
    Und "Jana Behrens" ist bei "Nordwerk Metall GmbH" am Standort "Werk Süd" seit dem 15.01.2026 lückenlos überlassen
    Wenn der Betreiber die Höchstüberlassungsdauer zum Stichtag 15.01.2026 rechnet
    Dann gilt die Grenze von 18 Monaten aus der Zuordnung des Standorts
    Und das Fristende der Höchstüberlassungsdauer ist der 14.07.2027

  @q14 @p1 @information @grenzfall
  Szenario: Q14 Tarifzuordnung der Verleiherseite bleibt für die Höchstüberlassungsdauer unbeachtet
    Angenommen für den Lieferanten "Rheinpersonal GmbH" ist die Tarifzuordnung "Beispieltarif Z1" mit maxAssignmentDurationMonths = 36 gültig
    Und für den Standort "Werk Süd" gilt die Grenze von 18 Monaten
    Und "Jana Behrens" ist bei "Nordwerk Metall GmbH" seit dem 15.01.2026 lückenlos überlassen
    Wenn der Betreiber die Höchstüberlassungsdauer zum Stichtag 15.01.2026 rechnet
    Dann wird die Zuordnung der Verleiherseite nicht gelesen
    Und das Fristende der Höchstüberlassungsdauer ist der 14.07.2027

  # ------------------------------------------------------------------
  # Q23 — Einsatz planned -> active, P1
  # Ergebnisart: Sperre (4.7, bestätigt in 5.5.5)
  # ------------------------------------------------------------------

  @q23 @p1 @information
  Szenario: Q23 Einsatzstart vor dem Fristende
    Angenommen ein Einsatz von "Jana Behrens" bei "Nordwerk Metall GmbH" steht im Status "planned"
    Und das Fristende der Höchstüberlassungsdauer ist der 14.07.2027
    Und der tatsächliche Beginn ist der 01.06.2027
    Wenn der MSP-Disponent den Einsatz in den Status "active" überführt
    Dann ist das Ergebnis der Prüfung P1 eine Information mit Hinweis, weil das Restbudget nach dem Stichtag 43 Tage beträgt
    Und der Status des Einsatzes ist "active"
    Und der Fristenlauf nach 5.1 und 5.2 beginnt

  @q23 @p1 @warnung @grenzfall
  Szenario: Q23 Einsatzstart genau am Fristende ist zulässig
    Angenommen ein Einsatz von "Jana Behrens" bei "Nordwerk Metall GmbH" steht im Status "planned"
    Und das Fristende der Höchstüberlassungsdauer ist der 14.07.2027
    Und der tatsächliche Beginn ist der 14.07.2027
    Wenn der MSP-Disponent den Einsatz in den Status "active" überführt
    Dann ist das Ergebnis der Prüfung P1 eine Warnung, weil das Restbudget nach dem 14.07.2027 null Tage beträgt
    Und der Status des Einsatzes ist "active"
    Und der 14.07.2027 ist der letzte zulässige Überlassungstag

  @q23 @p1 @sperre @grenzfall
  Szenario: Q23 Einsatzstart am Tag nach dem Fristende wird gesperrt
    Angenommen ein Einsatz von "Jana Behrens" bei "Nordwerk Metall GmbH" steht im Status "planned"
    Und das Fristende der Höchstüberlassungsdauer ist der 14.07.2027
    Und der tatsächliche Beginn ist der 15.07.2027
    Wenn der MSP-Disponent den Einsatz in den Status "active" überführen will
    Dann ist das Ergebnis der Prüfung P1 eine Sperre
    Und der Status des Einsatzes ist weiter "planned"
    Und die Sperre nennt das Fristende 14.07.2027 und den Stichtag 15.07.2027

  @q23 @p1 @uebersteuerung
  Szenario: Q23 Übersteuerung, weil ein tatsächliches Ende falsch erfasst war
    Angenommen der Einsatzstart am 15.07.2027 ist durch die Prüfung P1 gesperrt
    Und ein früherer Einsatz der Kette trägt nachweislich ein falsches tatsächliches Ende, er endete 40 Tage früher
    Und die Berichtigung ist vor dem Einsatzstart nicht möglich
    Und nach richtiger Datenlage wäre die Überlassung zulässig
    Wenn der MSP-Administrator den Übergang mit Pflichtbegründung übersteuert
    Dann findet der Übergang statt und der Status des Einsatzes ist "active"
    Und zwei Protokolleinträge liegen vor, der abgelehnte mit "blocked" und der vollzogene mit "success"
    Und die Übersteuerung heilt die Rechtslage nicht und wird dem MSP-Administrator angezeigt

  # ------------------------------------------------------------------
  # Q24, Q25 — Unterbrechung und Wiederaufnahme, P2
  # Ergebnisart: Information / Information (4.7, bestätigt in 5.5.5)
  # ------------------------------------------------------------------

  @q24 @p2 @information
  Szenario: Q24 Unterbrechung wird mit Beginn und Grund erfasst
    Angenommen ein Einsatz von "Tobias Krohn" bei "Nordwerk Metall GmbH" läuft seit dem 01.10.2025 und steht im Status "active"
    Und eine Unterbrechung mit Beginn 01.04.2026, Ende 30.06.2026 und Grund ist angelegt
    Wenn der MSP-Disponent den Einsatz in den Status "interrupted" überführt
    Dann ist das Ergebnis der Prüfung P2 eine Information
    Und der Status des Einsatzes ist "interrupted"
    Und die Zeiterfassung für den Unterbrechungszeitraum ist gesperrt
    Und die Wirkung auf die Zählung wird am Objekt vermerkt

  @q24 @p2 @information @grenzfall
  Szenario: Q24 Unterbrechung ohne Enddatum — Ergebnis ist vorläufig
    Angenommen ein Einsatz von "Tobias Krohn" bei "Nordwerk Metall GmbH" läuft seit dem 01.10.2025 und steht im Status "active"
    Und eine Unterbrechung mit Beginn 01.04.2026, ohne Ende und mit Grund ist angelegt
    Wenn der MSP-Disponent den Einsatz am 01.04.2026 in den Status "interrupted" überführt
    Dann ist das Ergebnis der Prüfung P2 eine Information
    Und das Lückenende ist der Stichtag 01.04.2026
    Und die Zählwirksamkeit trägt den Vermerk "vorläufig"
    Und der Vermerk wird bei der Wiederaufnahme endgültig

  @q25 @p2 @information @grenzfall
  Szenario: Q25 Unterbrechung von exakt drei Monaten setzt die Zählung nicht zurück
    Angenommen ein Einsatz von "Tobias Krohn" bei "Nordwerk Metall GmbH" hat am 01.10.2025 begonnen und steht im Status "interrupted"
    Und die angerechnete Dauer bis zum 31.03.2026 beträgt 182 Tage
    Und die Unterbrechung läuft vom 01.04.2026 bis zum 30.06.2026
    Wenn der MSP-Disponent den Einsatz zum ersten Wiederaufnahmetag 01.07.2026 in den Status "active" überführt
    Dann endet die Dreimonatsfrist ab Lückenbeginn am 30.06.2026
    Und das Lückenende 30.06.2026 liegt nicht nach dem 30.06.2026
    Und die Unterbrechung ist nicht zählwirksam
    Und der Kettenbeginn bleibt der 01.10.2025 und die angerechnete Dauer von 182 Tagen bleibt erhalten
    Und das Fristende verschiebt sich um die 91 Lückentage auf den 30.06.2027
    Und das Ergebnis der Prüfung P2 ist eine Information

  @q25 @p2 @information
  Szenario: Q25 Unterbrechung von mehr als drei Monaten setzt die Zählung zurück
    Angenommen ein Einsatz von "Tobias Krohn" bei "Nordwerk Metall GmbH" hat am 01.10.2025 begonnen und steht im Status "interrupted"
    Und die angerechnete Dauer bis zum 31.03.2026 beträgt 182 Tage
    Und die Unterbrechung läuft vom 01.04.2026 bis zum 01.07.2026
    Wenn der MSP-Disponent den Einsatz zum ersten Wiederaufnahmetag 02.07.2026 in den Status "active" überführt
    Dann liegt das Lückenende 01.07.2026 nach dem 30.06.2026
    Und die Unterbrechung ist zählwirksam
    Und eine neue Kette beginnt am 02.07.2026
    Und die angerechnete Dauer beträgt am 02.07.2026 einen Tag
    Und das Fristende der Höchstüberlassungsdauer ist der 01.01.2028
    Und das Ergebnis der Prüfung P2 ist eine Information

  @q25 @p2 @grenzfall
  Szenariogrundriss: Q25 Bewertung der Lücke nach der Drei-Monats-Regel
    Angenommen ein Einsatz von "Tobias Krohn" bei "Nordwerk Metall GmbH" endet am <ende>
    Und die Überlassung wird am <wiederaufnahme> fortgesetzt
    Wenn der Betreiber die Lücke bewertet
    Dann ist der Lückenbeginn <lueckenbeginn> und das Lückenende <lueckenende>
    Und das Ergebnis der Bewertung ist "<bewertung>"

    Beispiele:
      | ende       | wiederaufnahme | lueckenbeginn | lueckenende | bewertung                     |
      | 31.03.2026 | 01.07.2026     | 01.04.2026    | 30.06.2026  | exakt drei Monate, kein Reset |
      | 31.03.2026 | 02.07.2026     | 01.04.2026    | 01.07.2026  | Reset                         |
      | 31.03.2026 | 01.04.2026     | 01.04.2026    | 31.03.2026  | keine Lücke                   |

  @q25 @p2 @information
  Szenario: Q25 Eine Unterbrechung gewinnt Kalenderzeit, aber keinen Überlassungstag
    Angenommen ein Einsatz von "Tobias Krohn" bei "Nordwerk Metall GmbH" hat am 01.10.2025 begonnen
    Und die Überlassung ist vom 01.04.2026 bis zum 30.06.2026 unterbrochen und wird am 01.07.2026 fortgesetzt
    Wenn der Betreiber die Höchstüberlassungsdauer zum Stichtag 01.07.2026 rechnet
    Dann bleibt das Tagebudget von 547 Tagen unverändert
    Und die 91 Lückentage verbrauchen Kalenderzeit, aber kein Fristbudget
    Und das Fristende der Höchstüberlassungsdauer ist der 30.06.2027

  # ------------------------------------------------------------------
  # Q26 — Einsatz interrupted -> active, P1
  # Ergebnisart: Sperre bei erreichtem Fristende, sonst Warnung
  # (4.7, geändert in 5.5.5)
  # ------------------------------------------------------------------

  @q26 @p1 @information
  Szenario: Q26 Wiederaufnahme mit ausreichendem Restbudget
    Angenommen ein Einsatz von "Tobias Krohn" bei "Nordwerk Metall GmbH" steht im Status "interrupted"
    Und die Unterbrechung endet am 30.06.2026, der erste Wiederaufnahmetag ist der 01.07.2026
    Und das Fristende der Höchstüberlassungsdauer ist nach der Neuberechnung der 30.06.2027
    Und das geplante Ende des Einsatzes ist der 31.12.2026
    Wenn der MSP-Disponent den Einsatz in den Status "active" überführt
    Dann ist das Ergebnis der Prüfung P1 eine Information
    Und der Status des Einsatzes ist "active"

  @q26 @p1 @warnung
  Szenario: Q26 Fristende liegt im geplanten Restzeitraum
    Angenommen ein Einsatz von "Tobias Krohn" bei "Nordwerk Metall GmbH" steht im Status "interrupted"
    Und der erste Wiederaufnahmetag ist der 01.03.2027
    Und das Fristende der Höchstüberlassungsdauer ist nach der Neuberechnung der 30.06.2027
    Und das geplante Ende des Einsatzes ist der 31.08.2027
    Wenn der MSP-Disponent den Einsatz in den Status "active" überführt
    Dann ist das Ergebnis der Prüfung P1 eine Warnung
    Und die Warnung nennt das Fristende 30.06.2027 und das geplante Ende 31.08.2027
    Und der Status des Einsatzes ist "active"

  @q26 @p1 @sperre
  Szenario: Q26 Fristende am Wiederaufnahmetag ausgeschöpft
    Angenommen ein Einsatz von "Tobias Krohn" bei "Nordwerk Metall GmbH" steht im Status "interrupted"
    Und das Fristende der Höchstüberlassungsdauer ist der 30.06.2027
    Und die Unterbrechung endet am 30.06.2027, der erste Wiederaufnahmetag ist der 01.07.2027
    Wenn der MSP-Disponent den Einsatz in den Status "active" überführen will
    Dann ist das Ergebnis der Prüfung P1 eine Sperre
    Und der Status des Einsatzes ist weiter "interrupted"
    Und die Sperre nennt als offenen Weg, die Überlassung nicht wieder aufzunehmen
    Und ein Protokolleintrag mit der Prüfung "maxDurationCheck" und dem Ergebnis "blocked" liegt vor

  @q26 @p1 @warnung @grenzfall
  Szenario: Q26 Wiederaufnahme genau am Fristende
    Angenommen ein Einsatz von "Tobias Krohn" bei "Nordwerk Metall GmbH" steht im Status "interrupted"
    Und das Fristende der Höchstüberlassungsdauer ist der 30.06.2027
    Und die Unterbrechung endet am 29.06.2027, der erste Wiederaufnahmetag ist der 30.06.2027
    Wenn der MSP-Disponent den Einsatz in den Status "active" überführt
    Dann ist das Ergebnis der Prüfung P1 eine Warnung, weil das Restbudget nach dem 30.06.2027 null Tage beträgt
    Und der Status des Einsatzes ist "active"
    Und der 30.06.2027 ist der letzte zulässige Überlassungstag

  @q26 @p1 @uebersteuerung
  Szenario: Q26 Übersteuerung der gesperrten Wiederaufnahme
    Angenommen die Wiederaufnahme am 01.07.2027 ist durch die Prüfung P1 gesperrt
    Und die Unterbrechung dauerte nachweislich bis zum 15.10.2026 und ist im System mit einem falschen Ende erfasst
    Und die Berichtigung ist vor der Wiederaufnahme nicht möglich
    Und nach richtiger Datenlage wäre die Überlassung zulässig, weil die Unterbrechung die Zählung zurücksetzt
    Wenn der MSP-Administrator den Übergang mit Pflichtbegründung übersteuert
    Dann findet der Übergang statt und der Status des Einsatzes ist "active"
    Und zwei Protokolleinträge liegen vor, der abgelehnte mit "blocked" und der vollzogene mit "success"

  # ------------------------------------------------------------------
  # Q27 — Einsatz -> completed / terminatedEarly, P1 und P3
  # Ergebnisart: Information (4.7, bestätigt in 5.5.5)
  # ------------------------------------------------------------------

  @q27 @p1 @p3 @information
  Szenario: Q27 Abschlussstand der Fristen wird festgeschrieben
    Angenommen ein Einsatz von "Jana Behrens" bei "Nordwerk Metall GmbH" steht im Status "active"
    Und das tatsächliche Ende ist der 30.06.2027
    Und das Fristende der Höchstüberlassungsdauer ist der 14.07.2027
    Wenn der MSP-Disponent den Einsatz in den Status "completed" überführt
    Dann ist das Ergebnis der Prüfungen P1 und P3 eine Information
    Und die angerechnete Dauer und das Fristende sind zum 30.06.2027 festgeschrieben
    Und der Fristenlauf endet
    Und der Status des Einsatzes ist "completed"

  @q27 @p1 @information
  Szenario: Q27 Abschluss nach einer bereits festgestellten Überschreitung
    Angenommen ein Einsatz von "Jana Behrens" bei "Nordwerk Metall GmbH" steht im Status "active"
    Und eine Überschreitung des Fristendes 14.07.2027 wurde am 20.07.2027 als Warnung mit Pflicht-Eskalation festgestellt
    Und das tatsächliche Ende ist der 31.07.2027
    Wenn der MSP-Disponent den Einsatz in den Status "completed" überführt
    Dann ist das Ergebnis der Prüfung P1 am Abschluss eine Information
    Und der Abschlussstand nennt die angerechnete Dauer über dem Tagebudget
    Und die festgestellte Überschreitung bleibt als Protokolleintrag mit der Prüfung "maxDurationCheck" dauerhaft erhalten
    Und der Status des Einsatzes ist "completed"

  # ------------------------------------------------------------------
  # Q28, Q30 — Verlängerung, P1
  # Ergebnisart: Warnung (Genehmigung) / Sperre (Wirksamkeit)
  # ------------------------------------------------------------------

  @q28 @p1 @information
  Szenario: Q28 Genehmigung einer Verlängerung innerhalb des Fristendes
    Angenommen ein Einsatz von "Jana Behrens" bei "Nordwerk Metall GmbH" läuft bis zum 31.03.2027
    Und das Fristende der Höchstüberlassungsdauer ist der 14.07.2027
    Und die Verlängerung "VL-2027-007" mit neuem Ende 30.06.2027 steht im Status "requested"
    Wenn der Genehmiger die Verlängerung in den Status "approved" überführt
    Dann ist das Ergebnis der Prüfung P1 eine Information
    Und das Prüfergebnis ist am Verlängerungsvorgang vermerkt
    Und der Status der Verlängerung ist "approved"

  @q28 @p1 @warnung
  Szenario: Q28 Genehmigung einer Verlängerung über das Fristende hinaus
    Angenommen ein Einsatz von "Jana Behrens" bei "Nordwerk Metall GmbH" läuft bis zum 31.03.2027
    Und das Fristende der Höchstüberlassungsdauer ist der 14.07.2027
    Und die Verlängerung "VL-2027-008" mit neuem Ende 30.09.2027 steht im Status "requested"
    Wenn der Genehmiger die Verlängerung in den Status "approved" überführt
    Dann ist das Ergebnis der Prüfung P1 eine Warnung
    Und die Warnung nennt der Kundenseite das Fristende 14.07.2027 und das beantragte Ende 30.09.2027
    Und der Status der Verlängerung ist "approved"
    Und die Sperre greift erst bei der Wirksamkeit

  @q30 @p1 @information
  Szenario: Q30 Wirksame Verlängerung innerhalb des Fristendes
    Angenommen die Verlängerung "VL-2027-007" mit neuem Ende 30.06.2027 steht im Status "approved"
    Und das Fristende der Höchstüberlassungsdauer ist der 14.07.2027
    Wenn der MSP-Disponent die Verlängerung in den Status "effective" überführt
    Dann ist das Ergebnis der Prüfung P1 eine Information
    Und das geplante Ende des Einsatzes ist der 30.06.2027
    Und das Fristende und die Equal-Pay-Fälligkeit werden neu abgeleitet
    Und der Status der Verlängerung ist "effective"

  @q30 @p1 @sperre
  Szenario: Q30 Wirksame Verlängerung über das Fristende hinaus wird gesperrt
    Angenommen die Verlängerung "VL-2027-008" mit neuem Ende 30.09.2027 steht im Status "approved"
    Und das Fristende der Höchstüberlassungsdauer ist der 14.07.2027
    Wenn der MSP-Disponent die Verlängerung in den Status "effective" überführen will
    Dann ist das Ergebnis der Prüfung P1 eine Sperre
    Und der Status der Verlängerung ist weiter "approved"
    Und das geplante Ende des Einsatzes bleibt unverändert
    Und die Sperre nennt als offenen Weg ein kürzeres neues Ende

  @q30 @p1 @uebersteuerung
  Szenario: Q30 Übersteuerungsversuch bei ausgeschöpfter Frist wird zurückgewiesen
    Angenommen die Wirksamkeit der Verlängerung "VL-2027-008" ist durch die Prüfung P1 gesperrt
    Und die Daten der Kette sind unstreitig richtig und das Budget von 546 Tagen ist ausgeschöpft
    Wenn der MSP-Administrator die Sperre zu übersteuern versucht
    Dann wird die Übersteuerung zurückgewiesen, weil die Überlassung auch nach richtiger Datenlage unzulässig wäre
    Und der zulässige Weg bleibt eine tarifliche Öffnung als Konfiguration, ein anderer Entleiher oder das Ende der Überlassung
    Und der Status der Verlängerung ist weiter "approved"

  @q30 @p1 @uebersteuerung
  Szenario: Q30 Übersteuerung bei falsch verknüpfter Personenidentität
    Angenommen die Wirksamkeit der Verlängerung "VL-2027-008" ist durch die Prüfung P1 gesperrt
    Und 180 der angerechneten Tage stammen nachweislich aus den Einsätzen einer anderen Person
    Und die Trennung der Identitäten ist vor dem Ablauf des bisherigen Endes nicht möglich
    Und nach richtiger Datenlage wäre die Verlängerung zulässig
    Wenn der MSP-Administrator den Übergang mit Pflichtbegründung übersteuert
    Dann findet der Übergang statt und der Status der Verlängerung ist "effective"
    Und zwei Protokolleinträge liegen vor, der abgelehnte mit "blocked" und der vollzogene mit "success"

  @frist-eskalation
  Szenario: Fristablauf der Genehmigungsfrist genehmigt keine Verlängerung
    Angenommen die Verlängerung "VL-2027-009" steht seit dem 01.04.2027 im Status "requested"
    Und die Genehmigungsfrist für die Verlängerung läuft am 08.04.2027 ab
    Und der Genehmiger hat bis zum 08.04.2027 nicht entschieden
    Wenn die Genehmigungsfrist am 09.04.2027 verstrichen ist
    Dann ist der Status der Verlängerung unverändert "requested"
    Und eine Eskalation ist ausgelöst, zuerst an den Genehmiger, dann an seine Vertretung, dann an den Bedarfsträger, zuletzt an den MSP-Disponenten
    Und es gibt keine Genehmigungsfiktion: der Fristablauf genehmigt, verlängert und besetzt nichts
    Und jede Eskalationsstufe ist mit Anlass, Adressat und Zeitpunkt protokolliert

  # ------------------------------------------------------------------
  # Q33, Q35 — Stundenzettel, P1
  # Ergebnisart: Warnung / Warnung mit Pflicht-Eskalation (Q35 geändert, 5.5.5)
  # ------------------------------------------------------------------

  @q33 @p1 @information
  Szenario: Q33 Einreichen eines Zettels ohne Zeiten nach dem Fristende
    Angenommen der Stundenzettel "SZ-2027-07-001" zum Einsatz von "Jana Behrens" steht im Status "recorded"
    Und sein Zeitraum ist der 01.07.2027 bis 31.07.2027
    Und alle Zeitpositionen liegen zwischen dem 01.07.2027 und dem 14.07.2027
    Und das Fristende der Höchstüberlassungsdauer ist der 14.07.2027
    Wenn der Lieferantendisponent den Stundenzettel in den Status "submitted" überführt
    Dann ist das Ergebnis der Prüfung P1 eine Information
    Und der Status des Stundenzettels ist "submitted"

  @q33 @p1 @warnung
  Szenario: Q33 Einreichen eines Zettels mit Zeiten nach dem Fristende
    Angenommen der Stundenzettel "SZ-2027-07-002" zum Einsatz von "Jana Behrens" steht im Status "recorded"
    Und sein Zeitraum ist der 01.07.2027 bis 31.07.2027
    Und er enthält Zeitpositionen vom 15.07.2027 bis 31.07.2027
    Und das Fristende der Höchstüberlassungsdauer ist der 14.07.2027
    Wenn der Lieferantendisponent den Stundenzettel in den Status "submitted" überführt
    Dann ist das Ergebnis der Prüfung P1 eine Warnung
    Und die Warnung nennt die Zeitpositionen nach dem 14.07.2027
    Und der Status des Stundenzettels ist "submitted"
    Und das Einreichen erbrachter Zeiten wird nicht verhindert

  @q35 @p1 @information
  Szenario: Q35 Genehmigung eines Zettels ohne Zeiten nach dem Fristende
    Angenommen der Stundenzettel "SZ-2027-07-001" steht im Status "inApproval" und alle Freigabeschritte sind zugestimmt
    Und alle Zeitpositionen liegen vor dem Fristende 14.07.2027
    Wenn die Rolle der letzten Freigabestufe den Stundenzettel in den Status "approved" überführt
    Dann ist das Ergebnis der Prüfung P1 eine Information
    Und der Status des Stundenzettels ist "approved"

  @q35 @p1 @warnung
  Szenario: Q35 Genehmigung eines Zettels mit Zeiten nach dem Fristende
    Angenommen der Stundenzettel "SZ-2027-07-002" steht im Status "inApproval" und alle Freigabeschritte sind zugestimmt
    Und er enthält Zeitpositionen vom 15.07.2027 bis 31.07.2027, das Fristende ist der 14.07.2027
    Wenn die Rolle der letzten Freigabestufe den Stundenzettel in den Status "approved" überführt
    Dann ist das Ergebnis der Prüfung P1 eine Warnung mit Pflicht-Eskalation an den MSP-Administrator
    Und der Status des Stundenzettels ist "approved"
    Und die Genehmigung erbrachter Zeiten wird nicht gesperrt
    Und der Befund bleibt als Protokolleintrag mit der Prüfung "maxDurationCheck" erhalten

  # ------------------------------------------------------------------
  # Rückwirkende Änderungen (SPEC 5.5.3) und nächtlicher Lauf (5.5.1)
  # ------------------------------------------------------------------

  @p1 @warnung @grenzfall @rueckwirkend
  Szenario: Rückwirkende Korrektur eines tatsächlichen Endes
    Angenommen die Kette von "Jana Behrens" bei "Nordwerk Metall GmbH" besteht aus drei Einsätzen seit dem 15.01.2026
    Und am zweiten Einsatz wird das tatsächliche Ende am 10.08.2027 von 31.05.2026 auf 31.07.2026 berichtigt
    Und dadurch wird eine Überschreitung des Fristendes in der Vergangenheit sichtbar
    Wenn der MSP-Disponent die Berichtigung mit Begründung speichert
    Dann wird die Speicherung nicht gesperrt
    Und die abgeleiteten Felder werden an jedem Einsatz der Kette neu berechnet
    Und das Ergebnis ist eine Warnung mit Pflicht-Eskalation an den MSP-Administrator
    Und es gibt keine rückwirkende Sperre und keinen Rückschritt bereits vollzogener Übergänge
    Und genehmigte Stundenzettel und freigegebene Belege werden nicht entwertet
    Und der nächste Einsatzstart, die nächste Wiederaufnahme und die nächste Verlängerung sind gesperrt
    Und die Feststellung ist nicht übersteuerbar

  @p1 @warnung @grenzfall @rueckwirkend
  Szenario: Senkung der tariflichen Grenze während einer laufenden Kette
    Angenommen "Jana Behrens" ist bei "Nordwerk Metall GmbH" seit dem 15.01.2026 lückenlos überlassen
    Und für den Standort "Werk Süd" gilt ab dem 01.04.2027 die Tarifzuordnung "Beispieltarif E3" mit maxAssignmentDurationMonths = 12
    Und das neu berechnete Fristende liegt damit vor dem Stichtag 01.04.2027
    Wenn der Betreiber die Höchstüberlassungsdauer zum Stichtag 01.04.2027 rechnet
    Dann wird mit dem Wert gerechnet, der am Stichtag gilt
    Und das Ergebnis ist eine Warnung mit Pflicht-Eskalation an den MSP-Administrator
    Und das Fristende der Höchstüberlassungsdauer wird auf den 01.04.2027 gesetzt
    Und die vergangene Überlassung wird festgestellt, nicht rückwirkend untersagt
    Und die nächste Überlassung ist damit gesperrt

  @nachtlauf @p1 @information
  Szenario: N2 Nächtlicher Lauf erreicht den Hinweisvorlauf
    Angenommen ein Einsatz von "Jana Behrens" bei "Nordwerk Metall GmbH" steht im Status "active"
    Und das Fristende der Höchstüberlassungsdauer ist der 14.07.2027
    Wenn der nächtliche Lauf am 15.04.2027 läuft
    Dann beträgt das Restbudget 90 Tage
    Und das Ergebnis der Prüfung P1 ist eine Information an den MSP-Disponenten
    Und der Status des Einsatzes bleibt "active"
    Und der Lauf erzeugt keinen Statuswechsel und keine Sperre

  @nachtlauf @p1 @warnung
  Szenario: N2 Nächtlicher Lauf erreicht den Warnvorlauf
    Angenommen ein Einsatz von "Jana Behrens" bei "Nordwerk Metall GmbH" steht im Status "active"
    Und das Fristende der Höchstüberlassungsdauer ist der 14.07.2027
    Wenn der nächtliche Lauf am 14.06.2027 läuft
    Dann beträgt das Restbudget 30 Tage
    Und das Ergebnis der Prüfung P1 ist eine Warnung
    Und der Eskalationsanlass "Warnschwelle Höchstüberlassungsdauer erreicht" wird erzeugt
    Und der MSP-Administrator wird eskaliert, der Bedarfsträger erhält eine Information
    Und der Status des Einsatzes bleibt "active"

  @nachtlauf @p1 @warnung
  Szenario: N2 Fristende erreicht, Einsatz läuft weiter
    Angenommen ein Einsatz von "Jana Behrens" bei "Nordwerk Metall GmbH" steht im Status "active"
    Und das Fristende der Höchstüberlassungsdauer ist der 14.07.2027
    Wenn der nächtliche Lauf am 15.07.2027 läuft
    Dann ist das Ergebnis der Prüfung P1 eine Warnung mit Pflicht-Eskalation an den MSP-Administrator
    Und der Bedarfsträger und der Lieferantendisponent erhalten eine Information
    Und der Status des Einsatzes bleibt "active"
    Und der Lauf beendet den Einsatz nicht

  @nachtlauf @p2 @information
  Szenario: N6 Offene Unterbrechung überschreitet die Drei-Monats-Schwelle
    Angenommen ein Einsatz von "Tobias Krohn" bei "Nordwerk Metall GmbH" steht im Status "interrupted"
    Und die Unterbrechung hat am 01.04.2026 begonnen und hat kein Ende
    Wenn der nächtliche Lauf am 02.07.2026 läuft
    Dann ist das Ergebnis der Prüfung P2 eine Information
    Und die Information nennt, dass die Zählung mit der Wiederaufnahme zurückgesetzt wird
    Und der Status des Einsatzes bleibt "interrupted"

  # ------------------------------------------------------------------
  # Sichtbarkeit der Prüfergebnisse (SPEC 2.3, 4.7 Regel 3, 5.5.2 Nummer 6)
  # ------------------------------------------------------------------

  @sichtbarkeit @p1 @warnung
  Szenario: Warnung an den Lieferanten enthält keine Fremddaten
    Angenommen die Kette von "Jana Behrens" bei "Nordwerk Metall GmbH" läuft über Einsätze bei "Rheinpersonal GmbH" und "Elbe Zeitarbeit GmbH"
    Und das Restbudget beträgt am 14.06.2027 30 Tage
    Wenn die Warnschwelle der Höchstüberlassungsdauer erreicht wird
    Dann enthält die Information an den Lieferantendisponenten von "Rheinpersonal GmbH" nur den Fristenstand des eigenen Einsatzes
    Und sie nennt die Einsätze bei "Elbe Zeitarbeit GmbH" nicht
    Und die Information an den Bedarfsträger nennt den Fristenstand, nicht die Einsatzhistorie bei anderen Kunden
    Und die Personenidentität wird gegenüber Kunde und Lieferant nicht offengelegt
