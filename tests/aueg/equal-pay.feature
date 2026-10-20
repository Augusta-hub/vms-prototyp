# language: de
#
# Ausfuehrbare Fassung der AUEG-Regeln "Equal Pay / Equal Treatment" (SPEC 5.2).
#
# Quellen: SPEC 5.0 (Stichtag, Fristenarithmetik, Ueberlassungskette, fehlende
# Daten), SPEC 5.2 (Pruefungen P3, P4 und P5), die Querschnittstabelle 4.7
# (Q18, Q19, Q27, Q29, Q32, Q34, Q36, Q39, Q40, Q48) und SPEC 5.5
# (Ergebnisarten, rueckwirkende Aenderungen, Uebersteuerung, naechtlicher
# Lauf N3).
#
# Lesart der Erwartungen (SPEC 4.7, 5.5.2):
#   Information - der Uebergang findet statt, das Ergebnis wird vermerkt
#   Warnung     - der Uebergang findet statt, Benachrichtigung und Eskalation
#   Sperre      - der Uebergang findet nicht statt, der Vorgang bleibt stehen
#
# Grenze der Pruefbarkeit (SPEC 5.2.1): das System fuehrt kein Entgelt des
# Leiharbeitnehmers. Geprueft wird die Faelligkeit (P3), das Vorliegen und die
# Verwendbarkeit des Vergleichsentgelts (P4) und die Zuordnung eines
# Branchenzuschlagsschemas (P5) - nie, ob Equal Pay gezahlt wurde.
#
# Firmen, Personen, Tarifparameter, Betraege und Datumsangaben sind synthetisch.
# Step-Definitions und Runner fehlen bewusst.

@spec-5.2 @aueg-8
Funktionalität: Equal Pay und Equal Treatment

  Der Verleiher hat dem Leiharbeitnehmer die wesentlichen Arbeitsbedingungen
  einschließlich des Arbeitsentgelts zu gewähren, die im Betrieb des Entleihers
  für einen vergleichbaren Arbeitnehmer gelten (§ 8 Abs. 1 AÜG). Ein
  Tarifvertrag der Zeitarbeitsbranche kann abweichen (§ 8 Abs. 2 AÜG), aber
  längstens bis zum neunten Monat, bei stufenweiser Annäherung über einen
  Branchenzuschlagstarifvertrag bis zum fünfzehnten Monat (§ 8 Abs. 4 AÜG).
  Gerechnet wird auf derselben Überlassungskette wie in 5.1, mit derselben
  Drei-Monats-Anrechnung — nur Fristwert und Ergebnisfeld unterscheiden sich.

  Grundlage:
    Angenommen der Entleiher "Nordwerk Metall GmbH" führt den Standort "Werk Süd"
    Und der Lieferant "Rheinpersonal GmbH" ist aktiv und hat eine anerkannte, unbefristete AÜG-Erlaubnis
    Und die Personenidentität "PI-1001" ist für den Kandidaten "Jana Behrens" bei "Rheinpersonal GmbH" bestätigt
    Und für den Lieferanten "Rheinpersonal GmbH" ist die Tarifzuordnung "Beispieltarif Z1" ohne Angabe von equalPayDeadlineMonths vom 01.01.2025 bis 31.12.2028 gültig
    Und für den Standort "Werk Süd" ist der Vergleichsentgelt-Eintrag zur Tätigkeit "Zerspanung Stufe 2" mit 21,40 EUR je Stunde, Herkunft "collectiveAgreement", ab dem 01.01.2026 gültig
    Und außer der jeweils geprüften Regel liefert keine andere AÜG-Prüfung einen Befund
    Und die Angaben dieser Grundlage gelten, soweit ein Szenario nichts anderes sagt — Laufzeiten und Tarifparameter werden dort eigens gesetzt

  # ------------------------------------------------------------------
  # Welche Frist gilt (SPEC 5.2.2, Fälle 1 bis 6) — Prüfung P3
  # ------------------------------------------------------------------

  @p3 @information @rechenweg
  Szenario: Fall 2 — Zuordnung vorhanden, Frist nicht angegeben, gesetzliche Regelfrist
    Angenommen "Jana Behrens" ist bei "Nordwerk Metall GmbH" seit dem 15.01.2026 lückenlos überlassen
    Und die Tarifzuordnung der Verleiherseite nennt keine abweichende Equal-Pay-Frist
    Wenn der Betreiber die Equal-Pay-Fälligkeit zum Stichtag 15.01.2026 rechnet
    Dann gilt die gesetzliche Regelfrist von 9 Monaten
    Und das Fristbudget beträgt 273 Tage, nämlich die Kalendertage vom 15.01.2026 bis zum 14.10.2026
    Und die Equal-Pay-Fälligkeit ist der 15.10.2026 als erster Tag mit Equal-Pay-Pflicht
    Und das Ergebnis der Prüfung P3 ist eine Information

  @p3 @warnung
  Szenario: Fall 1 — keine Tarifzuordnung der Verleiherseite, Equal Pay ab dem ersten Tag
    Angenommen "Jana Behrens" ist bei "Nordwerk Metall GmbH" seit dem 15.01.2026 lückenlos überlassen
    Und für den Lieferanten "Rheinpersonal GmbH" ist am Stichtag keine Tarifzuordnung gültig
    Wenn der Betreiber die Equal-Pay-Fälligkeit zum Stichtag 15.01.2026 rechnet
    Dann beträgt die Frist 0 Monate
    Und die Equal-Pay-Fälligkeit ist der 15.01.2026, also der erste Überlassungstag
    Und das Ergebnis der Prüfung P3 ist eine Warnung mit Nennung des fehlenden Verleihertarifs
    Und die Warnung ist an den MSP-Administrator adressiert
    Und es wird nicht mit 9 Monaten gerechnet, weil die Abweichung den Tarifvertrag voraussetzt

  @p3 @information
  Szenario: Fall 3 — tarifliche Frist unterhalb der Regelfrist
    Angenommen "Jana Behrens" ist bei "Nordwerk Metall GmbH" seit dem 15.01.2026 lückenlos überlassen
    Und die Tarifzuordnung der Verleiherseite nennt equalPayDeadlineMonths = 6
    Wenn der Betreiber die Equal-Pay-Fälligkeit zum Stichtag 15.01.2026 rechnet
    Dann gilt die Frist von 6 Monaten
    Und das Fristbudget beträgt 181 Tage, nämlich die Kalendertage vom 15.01.2026 bis zum 14.07.2026
    Und die Equal-Pay-Fälligkeit ist der 15.07.2026
    Und das Ergebnis der Prüfung P3 ist eine Information

  @p3 @information
  Szenario: Fall 4 — tarifliche Frist über 9 Monaten mit Branchenzuschlagsschema
    Angenommen "Jana Behrens" ist bei "Nordwerk Metall GmbH" seit dem 15.01.2026 lückenlos überlassen
    Und die Tarifzuordnung der Verleiherseite nennt equalPayDeadlineMonths = 12 und das Branchenzuschlagsschema "Beispielschema B1"
    Wenn der Betreiber die Equal-Pay-Fälligkeit zum Stichtag 15.01.2026 rechnet
    Dann gilt die Frist von 12 Monaten
    Und die Equal-Pay-Fälligkeit ist der 15.01.2027
    Und das Ergebnis der Prüfung P3 ist eine Information

  @p3 @warnung @grenzfall
  Szenario: Fall 4 — tarifliche Frist über 15 Monaten wird auf die gesetzliche Obergrenze begrenzt
    Angenommen "Jana Behrens" ist bei "Nordwerk Metall GmbH" seit dem 15.01.2026 lückenlos überlassen
    Und die Tarifzuordnung der Verleiherseite nennt equalPayDeadlineMonths = 18 und das Branchenzuschlagsschema "Beispielschema B1"
    Wenn der Betreiber die Equal-Pay-Fälligkeit zum Stichtag 15.01.2026 rechnet
    Dann wird mit höchstens 15 Monaten gerechnet
    Und das Fristbudget beträgt 455 Tage, nämlich die Kalendertage vom 15.01.2026 bis zum 14.04.2027
    Und die Equal-Pay-Fälligkeit ist der 15.04.2027
    Und das Ergebnis trägt zusätzlich eine Warnung wegen der Begrenzung auf 15 Monate

  @p3 @warnung
  Szenario: Fall 5 — Frist über 9 Monaten ohne Branchenzuschlagsschema ist nicht verwendbar
    Angenommen "Jana Behrens" ist bei "Nordwerk Metall GmbH" seit dem 15.01.2026 lückenlos überlassen
    Und die Tarifzuordnung der Verleiherseite nennt equalPayDeadlineMonths = 12 und kein Branchenzuschlagsschema
    Wenn der Betreiber die Equal-Pay-Fälligkeit zum Stichtag 15.01.2026 rechnet
    Dann wird mit 9 Monaten gerechnet
    Und die Equal-Pay-Fälligkeit ist der 15.10.2026
    Und das Ergebnis der Prüfung P3 ist eine Warnung, die die unzulässige Konfiguration benennt
    Und die Warnung ist an den MSP-Administrator adressiert

  # ------------------------------------------------------------------
  # Q18 — Einsatz -> planned, P4 Vergleichsentgelt hinterlegt
  # Ergebnisart: Warnung (4.7, bestätigt in 5.5.5)
  # ------------------------------------------------------------------

  @q18 @p4 @information
  Szenario: Q18 Vergleichsentgelt liegt beim Anlegen vor
    Angenommen für "Jana Behrens" soll ein Einsatz am Standort "Werk Süd" mit der Tätigkeit "Zerspanung Stufe 2" angelegt werden
    Und der Einsatz ist vom 15.01.2026 bis 31.12.2026 geplant
    Wenn der MSP-Disponent den Einsatz in den Status "planned" überführt
    Dann ist das Ergebnis der Prüfung P4 eine Information
    Und der Einsatz erbt das Vergleichsentgelt von 21,40 EUR je Stunde aus dem Eintrag des Standorts
    Und der Status des Einsatzes ist "planned"

  @q18 @p4 @warnung
  Szenario: Q18 Für die Tätigkeit ist kein Vergleichsentgelt hinterlegt
    Angenommen für "Jana Behrens" soll ein Einsatz am Standort "Werk Süd" mit der Tätigkeit "Instandhaltung Stufe 3" angelegt werden
    Und für diese Tätigkeit ist am Standort kein Vergleichsentgelt-Eintrag gültig
    Wenn der MSP-Disponent den Einsatz in den Status "planned" überführt
    Dann ist das Ergebnis der Prüfung P4 eine Warnung
    Und die Warnung nennt Standort und Tätigkeit und ist an Einkauf und Controlling des Kunden adressiert
    Und der Status des Einsatzes ist "planned"
    Und das Vergleichsentgelt am Einsatz bleibt leer, solange die Fälligkeit nicht erreicht ist

  @q18 @p4 @information @grenzfall
  Szenario: Q18 Fälligkeit liegt in der Zukunft, Vergleichsentgelt noch nicht Pflicht
    Angenommen für "Jana Behrens" wird ein Einsatz vom 15.01.2026 bis 31.03.2026 angelegt
    Und die Equal-Pay-Fälligkeit ist der 15.10.2026
    Und das Vergleichsentgelt am Einsatz ist leer
    Wenn der MSP-Disponent den Einsatz in den Status "planned" überführt
    Dann ist das Ergebnis der Prüfung P4 eine Information, weil der Stichtag vor der Fälligkeit liegt
    Und der Status des Einsatzes ist "planned"

  @q18 @p4 @warnung @grenzfall
  Szenario: Q18 Vergleichsentgelt am Einsatz liegt unter dem Eintrag des Standorts
    Angenommen für "Jana Behrens" wird ein Einsatz am Standort "Werk Süd" mit der Tätigkeit "Zerspanung Stufe 2" angelegt
    Und am Einsatz ist ein Vergleichsentgelt von 19,80 EUR je Stunde mit Begründung erfasst
    Wenn der MSP-Disponent den Einsatz in den Status "planned" überführt
    Dann ist das Ergebnis der Prüfung P4 eine Warnung mit Eskalation an Einkauf und Controlling des Kunden
    Und die Abweichung nach unten wird mit Begründung protokolliert
    Und der Status des Einsatzes ist "planned"

  @q18 @p4 @information @grenzfall
  Szenario: Q18 Vergleichsentgelt am Einsatz liegt über dem Eintrag des Standorts
    Angenommen für "Jana Behrens" wird ein Einsatz am Standort "Werk Süd" mit der Tätigkeit "Zerspanung Stufe 2" angelegt
    Und am Einsatz ist ein Vergleichsentgelt von 23,00 EUR je Stunde erfasst
    Wenn der MSP-Disponent den Einsatz in den Status "planned" überführt
    Dann ist das Ergebnis der Prüfung P4 eine Information
    Und mehr als das Vergleichsentgelt zu gewähren ist zulässig
    Und der Status des Einsatzes ist "planned"

  @q18 @p4 @warnung @grenzfall
  Szenario: Q18 Mehrere gültige Vergleichsentgelt-Einträge sind ein Datenfehler
    Angenommen für den Standort "Werk Süd" und die Tätigkeit "Zerspanung Stufe 2" sind zwei Einträge mit sich überschneidender Laufzeit gültig
    Wenn der MSP-Disponent einen Einsatz mit dieser Tätigkeit in den Status "planned" überführt
    Dann wird die Lage wie "kein Eintrag" behandelt
    Und das Ergebnis der Prüfung P4 ist eine Warnung, die die konkurrierenden Einträge nennt
    Und es wird keiner der beiden Einträge ausgewählt

  # ------------------------------------------------------------------
  # Q19 — Einsatz -> planned, P5 Branchenzuschlagsschema
  # Ergebnisart: Information (4.7, bestätigt in 5.5.5)
  # ------------------------------------------------------------------

  @q19 @p5 @information
  Szenario: Q19 Branchenzuschlagsschema ist zugeordnet
    Angenommen die Tarifzuordnung der Verleiherseite nennt das Branchenzuschlagsschema "Beispielschema B1"
    Und für den Standort "Werk Süd" ist die Einsatzbranche über die Tarifzuordnung des Standorts bestimmt
    Wenn der MSP-Disponent einen Einsatz für "Jana Behrens" in den Status "planned" überführt
    Dann ist das Ergebnis der Prüfung P5 eine Information
    Und die Information nennt die ermittelte Zuschlagsstufe, nicht den Betrag
    Und Eingangsgröße der Stufe ist die Zahl der Überlassungstage der Kette

  @q19 @p5 @information
  Szenario: Q19 Kein Branchenzuschlagsschema zugeordnet
    Angenommen die Tarifzuordnung der Verleiherseite nennt kein Branchenzuschlagsschema
    Wenn der MSP-Disponent einen Einsatz für "Jana Behrens" in den Status "planned" überführt
    Dann ist das Ergebnis der Prüfung P5 eine Information
    Und die Information nennt, dass kein Branchenzuschlag anwendbar ist
    Und der Status des Einsatzes ist "planned"

  @q19 @p5 @warnung @grenzfall
  Szenario: Q19 Einsatzbranche ist nicht bestimmbar
    Angenommen die Tarifzuordnung der Verleiherseite nennt das Branchenzuschlagsschema "Beispielschema B1"
    Und für den Standort "Werk Süd" ist keine Tarifzuordnung gültig und beim Kunden ist keine Branche gepflegt
    Wenn der MSP-Disponent einen Einsatz für "Jana Behrens" in den Status "planned" überführt
    Dann ist die Zuschlagsstufe nicht bestimmbar
    Und das Ergebnis der Prüfung P5 ist eine Warnung mit Nennung des fehlenden Feldes
    Und der Status des Einsatzes ist "planned"

  # ------------------------------------------------------------------
  # Q29, Q32 — Verlängerung, P3 und P4
  # Ergebnisart: Warnung / Warnung (4.7, bestätigt in 5.5.5)
  # ------------------------------------------------------------------

  @q29 @p3 @information
  Szenario: Q29 Verlängerter Zeitraum endet vor der Equal-Pay-Fälligkeit
    Angenommen ein Einsatz von "Jana Behrens" läuft bis zum 31.07.2026 und die Equal-Pay-Fälligkeit ist der 15.10.2026
    Und die Verlängerung "VL-2026-003" mit neuem Ende 30.09.2026 steht im Status "requested"
    Wenn der Genehmiger die Verlängerung in den Status "approved" überführt
    Dann ist der Prüfzeitraum der 01.08.2026 bis 30.09.2026
    Und das Ergebnis der Prüfung P3 ist eine Information
    Und der Status der Verlängerung ist "approved"

  @q29 @p3 @warnung
  Szenario: Q29 Equal-Pay-Fälligkeit fällt in den verlängerten Zeitraum
    Angenommen ein Einsatz von "Jana Behrens" läuft bis zum 30.09.2026 und die Equal-Pay-Fälligkeit ist der 15.10.2026
    Und die Verlängerung "VL-2026-004" mit neuem Ende 31.12.2026 steht im Status "requested"
    Wenn der Genehmiger die Verlängerung in den Status "approved" überführt
    Dann ist der Prüfzeitraum der 01.10.2026 bis 31.12.2026
    Und das Ergebnis der Prüfung P3 ist eine Warnung
    Und die Warnung nennt der Kundenseite die Fälligkeit 15.10.2026 im verlängerten Zeitraum
    Und der Status der Verlängerung ist "approved"

  @q32 @p4 @information
  Szenario: Q32 Vergleichsentgelt liegt für den verlängerten Zeitraum vor
    Angenommen die Verlängerung "VL-2026-004" mit neuem Ende 31.12.2026 steht im Status "approved"
    Und die Equal-Pay-Fälligkeit ist der 15.10.2026
    Und am Einsatz ist ein Vergleichsentgelt von 21,40 EUR je Stunde erfasst
    Wenn der MSP-Disponent die Verlängerung in den Status "effective" überführt
    Dann ist das Ergebnis der Prüfung P4 eine Information
    Und der Status der Verlängerung ist "effective"
    Und die Equal-Pay-Fälligkeit wird neu abgeleitet

  @q32 @p4 @warnung
  Szenario: Q32 Vergleichsentgelt fehlt für den Zeitraum ab Fälligkeit
    Angenommen die Verlängerung "VL-2026-004" mit neuem Ende 31.12.2026 steht im Status "approved"
    Und die Equal-Pay-Fälligkeit ist der 15.10.2026
    Und am Einsatz ist kein Vergleichsentgelt erfasst und für die Tätigkeit ist kein Eintrag am Standort gültig
    Wenn der MSP-Disponent die Verlängerung in den Status "effective" überführt
    Dann ist das Ergebnis der Prüfung P4 eine Warnung
    Und die Warnung ist an Einkauf und Controlling des Kunden adressiert und nennt Standort und Tätigkeit
    Und der Status der Verlängerung ist "effective"
    Und die Sperre greift erst bei der Zettelgenehmigung und am Einsatzstart

  # ------------------------------------------------------------------
  # Q34, Q36 — Stundenzettel, P3 und P4
  # Ergebnisart: Warnung / Sperre (4.7, Q36 bestätigt mit Präzisierung)
  # ------------------------------------------------------------------

  @q34 @p3 @information
  Szenario: Q34 Zettelzeitraum endet vor der Equal-Pay-Fälligkeit
    Angenommen der Stundenzettel "SZ-2026-09-001" zum Einsatz von "Jana Behrens" steht im Status "submitted"
    Und sein Zeitraum ist der 01.09.2026 bis 30.09.2026
    Und die Equal-Pay-Fälligkeit ist der 15.10.2026
    Wenn das System die Freigabe eröffnet und den Stundenzettel in den Status "inApproval" überführt
    Dann ist das Ergebnis der Prüfung P3 eine Information
    Und der Status des Stundenzettels ist "inApproval"

  @q34 @p3 @warnung
  Szenario: Q34 Equal-Pay-Fälligkeit wird im Zettelzeitraum erreicht
    Angenommen der Stundenzettel "SZ-2026-10-001" zum Einsatz von "Jana Behrens" steht im Status "submitted"
    Und sein Zeitraum ist der 01.10.2026 bis 31.10.2026
    Und die Equal-Pay-Fälligkeit ist der 15.10.2026
    Wenn das System die Freigabe eröffnet und den Stundenzettel in den Status "inApproval" überführt
    Dann ist das Ergebnis der Prüfung P3 eine Warnung
    Und die Warnung geht an die genehmigende Rolle und nennt den 15.10.2026
    Und der Status des Stundenzettels ist "inApproval"

  @q36 @p4 @information
  Szenario: Q36 Genehmigung mit verwendbarem Vergleichsentgelt
    Angenommen der Stundenzettel "SZ-2026-10-001" steht im Status "inApproval" und alle Freigabeschritte sind zugestimmt
    Und die Equal-Pay-Fälligkeit 15.10.2026 liegt im Zettelzeitraum
    Und am Einsatz ist ein Vergleichsentgelt von 21,40 EUR je Stunde aus einem Eintrag mit Herkunft "collectiveAgreement" erfasst
    Wenn die Rolle der letzten Freigabestufe den Stundenzettel in den Status "approved" überführt
    Dann ist das Ergebnis der Prüfung P4 eine Information
    Und der Status des Stundenzettels ist "approved"

  @q36 @p4 @sperre
  Szenario: Q36 Genehmigung ohne verwendbaren Vergleichsentgelt-Eintrag wird gesperrt
    Angenommen der Stundenzettel "SZ-2026-10-001" steht im Status "inApproval" und alle Freigabeschritte sind zugestimmt
    Und die Equal-Pay-Fälligkeit 15.10.2026 liegt im Zettelzeitraum
    Und für Standort und Tätigkeit ist kein Vergleichsentgelt-Eintrag gültig und am Einsatz ist kein Wert erfasst
    Wenn die Rolle der letzten Freigabestufe den Stundenzettel in den Status "approved" überführen will
    Dann ist das Ergebnis der Prüfung P4 eine Sperre
    Und der Status des Stundenzettels ist weiter "inApproval"
    Und die Sperre nennt Standort und Tätigkeit und den offenen Weg, dass der Entleiher den Wert nachträgt
    Und ein Protokolleintrag mit der Prüfung "comparableWageCheck" und dem Ergebnis "blocked" liegt vor

  @q36 @p4 @warnung @grenzfall
  Szenario: Q36 Eintrag mit Herkunft "estimate" lässt die Genehmigung zu
    Angenommen der Stundenzettel "SZ-2026-10-001" steht im Status "inApproval" und alle Freigabeschritte sind zugestimmt
    Und die Equal-Pay-Fälligkeit 15.10.2026 liegt im Zettelzeitraum
    Und der Vergleichsentgelt-Eintrag des Standorts trägt die Herkunft "estimate"
    Wenn die Rolle der letzten Freigabestufe den Stundenzettel in den Status "approved" überführt
    Dann ist der Eintrag verwendbar, aber kein Nachweis
    Und das Ergebnis der Prüfung P4 ist eine Warnung statt einer Sperre
    Und der Status des Stundenzettels ist "approved"
    Und die Warnung bleibt am Vorgang, bis ein Nachweis vorliegt

  @q36 @p4 @sperre @grenzfall
  Szenario: Q36 Mehrere gültige Einträge sperren wie ein fehlender Eintrag
    Angenommen der Stundenzettel "SZ-2026-10-001" steht im Status "inApproval" und alle Freigabeschritte sind zugestimmt
    Und die Equal-Pay-Fälligkeit 15.10.2026 liegt im Zettelzeitraum
    Und für Standort und Tätigkeit sind zwei Einträge gleichzeitig gültig
    Wenn die Rolle der letzten Freigabestufe den Stundenzettel in den Status "approved" überführen will
    Dann ist das Ergebnis der Prüfung P4 eine Sperre
    Und die Sperre nennt die konkurrierenden Einträge
    Und der Status des Stundenzettels ist weiter "inApproval"

  @q36 @p4 @keine-uebersteuerung
  Szenario: Q36 Übersteuerungsversuch wird zurückgewiesen
    Angenommen die Genehmigung des Stundenzettels "SZ-2026-10-001" ist durch die Prüfung P4 gesperrt
    Wenn der MSP-Administrator die Sperre zu übersteuern versucht
    Dann wird die Übersteuerung zurückgewiesen, weil die Prüfung P4 nicht übersteuerbar ist
    Und der offene Weg ist die Ergänzung des Vergleichsentgelts durch den Entleiher
    Und der Status des Stundenzettels ist weiter "inApproval"
    Und der Versuch wird protokolliert

  # ------------------------------------------------------------------
  # Q48 — Einsatz planned -> active, P4 (neu, 5.5.5)
  # Ergebnisart: Sperre
  # ------------------------------------------------------------------

  @q48 @p4 @information
  Szenario: Q48 Equal Pay ab dem ersten Tag, Vergleichsentgelt ist gesetzt
    Angenommen ein Einsatz von "Jana Behrens" steht im Status "planned" mit tatsächlichem Beginn 15.01.2026
    Und für den Lieferanten ist am Stichtag keine Tarifzuordnung gültig, Equal Pay ist damit ab dem ersten Überlassungstag geschuldet
    Und am Einsatz ist ein Vergleichsentgelt von 21,40 EUR je Stunde erfasst
    Wenn der MSP-Disponent den Einsatz in den Status "active" überführt
    Dann ist das Ergebnis der Prüfung P4 eine Information
    Und der Status des Einsatzes ist "active"

  @q48 @p4 @sperre
  Szenario: Q48 Equal Pay ab dem ersten Tag, Vergleichsentgelt fehlt
    Angenommen ein Einsatz von "Jana Behrens" steht im Status "planned" mit tatsächlichem Beginn 15.01.2026
    Und für den Lieferanten ist am Stichtag keine Tarifzuordnung gültig, Equal Pay ist damit ab dem ersten Überlassungstag geschuldet
    Und am Einsatz ist kein Vergleichsentgelt erfasst
    Wenn der MSP-Disponent den Einsatz in den Status "active" überführen will
    Dann ist das Ergebnis der Prüfung P4 eine Sperre
    Und der Status des Einsatzes ist weiter "planned"
    Und die Sperre nennt den offenen Weg, dass der Entleiher das Vergleichsentgelt nachträgt

  @q48 @p4 @sperre @grenzfall
  Szenario: Q48 Fälligkeit liegt genau am ersten Überlassungstag
    Angenommen ein Einsatz von "Jana Behrens" steht im Status "planned" mit tatsächlichem Beginn 15.10.2026
    Und die Equal-Pay-Fälligkeit der Kette ist der 15.10.2026
    Und am Einsatz ist kein Vergleichsentgelt erfasst
    Wenn der MSP-Disponent den Einsatz in den Status "active" überführen will
    Dann ist das Ergebnis der Prüfung P4 eine Sperre
    Und der Status des Einsatzes ist weiter "planned"
    Und der 15.10.2026 ist der erste Tag mit Equal-Pay-Pflicht, nicht der letzte ohne

  @q48 @p4 @warnung @grenzfall
  Szenario: Q48 Vergleichsentgelt aus einer Schätzung lässt den Einsatzstart zu
    Angenommen ein Einsatz von "Jana Behrens" steht im Status "planned" mit tatsächlichem Beginn 15.10.2026
    Und die Equal-Pay-Fälligkeit der Kette ist der 15.10.2026
    Und der Vergleichsentgelt-Eintrag des Standorts trägt die Herkunft "estimate" und der Wert ist an den Einsatz übernommen
    Wenn der MSP-Disponent den Einsatz in den Status "active" überführt
    Dann ist das Ergebnis der Prüfung P4 eine Warnung
    Und der Status des Einsatzes ist "active"

  @q48 @p4 @keine-uebersteuerung
  Szenario: Q48 Übersteuerungsversuch am Einsatzstart wird zurückgewiesen
    Angenommen der Einsatzstart ist durch die Prüfung P4 gesperrt
    Wenn der MSP-Administrator die Sperre zu übersteuern versucht
    Dann wird die Übersteuerung zurückgewiesen, weil die Prüfung P4 nicht übersteuerbar ist
    Und der Status des Einsatzes ist weiter "planned"

  # ------------------------------------------------------------------
  # Q39, Q40 — Abrechnungsbeleg -> created, P4 und P5
  # Ergebnisart: Warnung / Information (4.7, bestätigt in 5.5.5)
  # ------------------------------------------------------------------

  @q39 @p4 @information
  Szenario: Q39 Vergleichsentgelt liegt für den Leistungszeitraum vor
    Angenommen der Abrechnungsbeleg zur Periode Oktober 2026 beruht auf genehmigten Stundenzetteln zum Einsatz von "Jana Behrens"
    Und die Equal-Pay-Fälligkeit 15.10.2026 liegt im Leistungszeitraum
    Und am Einsatz ist ein Vergleichsentgelt von 21,40 EUR je Stunde erfasst
    Wenn der MSP-Disponent den Beleg in den Status "created" überführt
    Dann ist das Ergebnis der Prüfung P4 eine Information
    Und der Status des Belegs ist "created"

  @q39 @p4 @warnung
  Szenario: Q39 Vergleichsentgelt fehlt für Zeiträume nach der Fälligkeit
    Angenommen der Abrechnungsbeleg zur Periode Oktober 2026 beruht auf genehmigten Stundenzetteln zum Einsatz von "Jana Behrens"
    Und die Equal-Pay-Fälligkeit 15.10.2026 liegt im Leistungszeitraum
    Und am Einsatz ist kein Vergleichsentgelt erfasst, weil die Genehmigung mit einer Schätzung erfolgte
    Wenn der MSP-Disponent den Beleg in den Status "created" überführt
    Dann ist das Ergebnis der Prüfung P4 eine Warnung
    Und der Status des Belegs ist "created"
    Und die Abrechnung erbrachter Leistung wird nicht blockiert

  @q40 @p5 @information
  Szenario: Q40 Abgerechnete Zuschlagsarten passen zur ermittelten Stufe
    Angenommen der Abrechnungsbeleg zur Periode Oktober 2026 enthält Positionen mit Zuschlagsarten aus dem Schema "Beispielschema B1"
    Und die ermittelte Zuschlagsstufe folgt aus 273 Überlassungstagen der Kette
    Wenn der MSP-Disponent den Beleg in den Status "created" überführt
    Dann ist das Ergebnis der Prüfung P5 eine Information
    Und geprüft wird die Zuordnung der Zuschlagsart, nicht die Höhe des Betrags

  @q40 @p5 @information
  Szenario: Q40 Abgerechnete Zuschlagsarten passen nicht zur ermittelten Stufe
    Angenommen der Abrechnungsbeleg zur Periode Oktober 2026 enthält zwei Positionen mit einer Zuschlagsart einer höheren Stufe
    Und die ermittelte Zuschlagsstufe folgt aus 273 Überlassungstagen der Kette
    Wenn der MSP-Disponent den Beleg in den Status "created" überführt
    Dann ist das Ergebnis der Prüfung P5 eine Information mit Nennung der betroffenen Positionen
    Und der Status des Belegs ist "created"

  # ------------------------------------------------------------------
  # Q27 — Einsatz -> completed, P3
  # Ergebnisart: Information (4.7, bestätigt in 5.5.5)
  # ------------------------------------------------------------------

  @q27 @p3 @information
  Szenario: Q27 Equal-Pay-Stand wird beim Abschluss festgeschrieben
    Angenommen ein Einsatz von "Jana Behrens" steht im Status "active" mit tatsächlichem Ende 31.12.2026
    Und die Equal-Pay-Fälligkeit ist der 15.10.2026
    Wenn der MSP-Disponent den Einsatz in den Status "completed" überführt
    Dann ist das Ergebnis der Prüfung P3 eine Information
    Und die Equal-Pay-Fälligkeit ist zum 31.12.2026 festgeschrieben
    Und der Status des Einsatzes ist "completed"

  @q27 @p3 @information
  Szenario: Q27 Abschluss bei nie erreichter Fälligkeit
    Angenommen ein Einsatz von "Jana Behrens" steht im Status "active" mit tatsächlichem Ende 30.06.2026
    Und die Equal-Pay-Fälligkeit ist der 15.10.2026
    Wenn der MSP-Disponent den Einsatz in den Status "completed" überführt
    Dann ist das Ergebnis der Prüfung P3 eine Information
    Und die Information nennt, dass die Fälligkeit im Einsatzzeitraum nicht erreicht wurde
    Und der Status des Einsatzes ist "completed"

  # ------------------------------------------------------------------
  # Grenzfälle der Kette und der Daten (SPEC 5.2.6, 5.2.7)
  # ------------------------------------------------------------------

  @p3 @grenzfall
  Szenario: Unterbrechung von exakt drei Monaten verschiebt die Fälligkeit nach hinten
    Angenommen "Tobias Krohn" ist bei "Nordwerk Metall GmbH" seit dem 01.10.2025 überlassen
    Und für den Lieferanten gilt die Regelfrist von 9 Monaten
    Und die Überlassung ist vom 01.04.2026 bis zum 30.06.2026 unterbrochen und wird am 01.07.2026 fortgesetzt
    Wenn der Betreiber die Equal-Pay-Fälligkeit zum Stichtag 01.07.2026 rechnet
    Dann ist die Unterbrechung nicht zählwirksam und die Vorzeiten werden angerechnet
    Und die 182 Überlassungstage vor der Unterbrechung bleiben erhalten
    Und die Equal-Pay-Fälligkeit verschiebt sich um die 91 Lückentage vom 01.07.2026 auf den 30.09.2026
    Und das Ergebnis der Prüfung P3 ist eine Information

  @p3 @grenzfall
  Szenario: Unterbrechung über drei Monate setzt die Equal-Pay-Frist neu an
    Angenommen "Tobias Krohn" war bei "Nordwerk Metall GmbH" vom 01.06.2025 bis 31.03.2026 lückenlos überlassen
    Und für den Lieferanten gilt die Regelfrist von 9 Monaten
    Und Equal Pay war in dieser Kette ab dem 01.03.2026 geschuldet
    Und die Überlassung ist vom 01.04.2026 bis zum 01.07.2026 unterbrochen und wird am 02.07.2026 fortgesetzt
    Wenn der Betreiber die Equal-Pay-Fälligkeit zum Stichtag 02.07.2026 rechnet
    Dann ist die Unterbrechung zählwirksam und eine neue Kette beginnt am 02.07.2026
    Und die Equal-Pay-Fälligkeit ist der 02.04.2027
    Und die Frist beginnt neu, obwohl Equal Pay vor der Unterbrechung schon fällig war

  @p3 @warnung @grenzfall
  Szenario: Lieferantenwechsel mitten im Einsatz — Frist kommt vom Verleihertarif
    Angenommen "Jana Behrens" war über "Rheinpersonal GmbH" vom 15.01.2026 bis 31.05.2026 bei "Nordwerk Metall GmbH" überlassen
    Und ein neuer Einsatz über "Elbe Zeitarbeit GmbH" beginnt am 01.06.2026 bei demselben Kunden
    Und für "Elbe Zeitarbeit GmbH" ist am Stichtag keine Tarifzuordnung gültig
    Wenn der Betreiber die Equal-Pay-Fälligkeit zum Stichtag 01.06.2026 rechnet
    Dann läuft die Überlassungskette entleiherbezogen weiter
    Und Equal Pay ist ab dem ersten Tag des neuen Einsatzes, dem 01.06.2026, geschuldet
    Und das Ergebnis der Prüfung P3 ist eine Warnung mit Nennung des fehlenden Verleihertarifs
    Und es gibt keine rückwirkende Sperre für den Zeitraum vor dem 01.06.2026

  @p3 @p4 @warnung @grenzfall @rueckwirkend
  Szenario: Rückwirkende Korrektur zieht die Equal-Pay-Fälligkeit in die Vergangenheit
    Angenommen die Kette von "Jana Behrens" bei "Nordwerk Metall GmbH" besteht aus zwei Einsätzen seit dem 15.01.2026
    Und am 20.11.2026 wird eine bisher nicht erfasste Überlassung von 60 Tagen aus dem Jahr 2025 nachgetragen
    Und die Equal-Pay-Fälligkeit rückt dadurch vor den 20.11.2026 und das Vergleichsentgelt fehlt für den Zeitraum ab Fälligkeit
    Wenn der MSP-Disponent die Nachtragung mit Begründung speichert
    Dann wird die Speicherung nicht gesperrt
    Und die Equal-Pay-Fälligkeit wird an allen Einsätzen der Kette neu berechnet
    Und das Ergebnis ist eine Warnung mit Pflicht-Eskalation an den MSP-Administrator und an Einkauf und Controlling des Kunden
    Und genehmigte Stundenzettel und freigegebene Belege werden nicht entwertet
    Und Korrekturen laufen über Korrekturfassung und Storno mit Nachbeleg

  @p3 @warnung @grenzfall
  Szenario: Fehlende Personenidentität kann die Fälligkeit nur zu spät ergeben
    Angenommen für den Kandidaten "Miriam Falk" bei "Elbe Zeitarbeit GmbH" ist keine bestätigte Personenidentität geführt
    Und über den Kandidatensatz dieses Lieferanten sind 40 Überlassungstage bei "Nordwerk Metall GmbH" bekannt
    Und am Einsatz ist kein Vergleichsentgelt erfasst
    Wenn der Betreiber die Equal-Pay-Fälligkeit rechnet
    Dann ist die Kette auf einen Lieferanten begrenzt
    Und die Fälligkeit kann dadurch nur zu spät, nie zu früh berechnet werden
    Und das Ergebnis trägt den Vermerk "Zählgrundlage auf einen Lieferanten begrenzt"
    Und das Ergebnis ist bei fehlendem Vergleichsentgelt mindestens eine Warnung

  @p3 @grenzfall
  Szenario: Unbestätigter maschineller Identitätsvorschlag zählt für die Frist nicht
    Angenommen der Kandidatensatz "KA-55" ist maschinell mit der Personenidentität "PI-1003" verknüpft, die Verknüpfung ist nicht bestätigt
    Und über die Kandidatensätze dieser Personenidentität sind 300 Überlassungstage bei "Nordwerk Metall GmbH" bekannt
    Wenn der Betreiber die Equal-Pay-Fälligkeit für einen Einsatz dieses Kandidatensatzes rechnet
    Dann werden die 300 Tage nicht angerechnet
    Und das Ergebnis trägt die Information, dass ein unbestätigter Identitätsvorschlag vorliegt

  @p4 @warnung @grenzfall
  Szenario: Tätigkeit am Einsatz weicht von der Bedarfsanfrage ab
    Angenommen die Bedarfsanfrage nennt die Tätigkeit "Zerspanung Stufe 2"
    Und der Einsatz von "Jana Behrens" nennt die Tätigkeit "Instandhaltung Stufe 3"
    Und für "Instandhaltung Stufe 3" ist am Standort kein Vergleichsentgelt-Eintrag gültig
    Wenn der Betreiber das Vergleichsentgelt prüft
    Dann ist die Tätigkeit des Einsatzes maßgeblich, nicht die der Bedarfsanfrage
    Und das Ergebnis der Prüfung P4 ist eine Warnung mit Nennung von Standort und Tätigkeit

  @p4 @warnung @grenzfall
  Szenario: Standortwechsel innerhalb desselben Kunden wechselt den Vergleichsentgelt-Eintrag
    Angenommen "Jana Behrens" wechselt am 01.07.2026 vom Standort "Werk Süd" zum Standort "Werk Nord" desselben Kunden
    Und für "Werk Nord" ist zur Tätigkeit "Zerspanung Stufe 2" kein Vergleichsentgelt-Eintrag gültig
    Wenn der Betreiber das Vergleichsentgelt zum Stichtag 01.07.2026 prüft
    Dann läuft die Überlassungskette entleiherbezogen weiter
    Und der Vergleichsentgelt-Eintrag wechselt mit dem Standort
    Und das Ergebnis der Prüfung P4 ist eine Warnung an Einkauf und Controlling des Kunden

  @p4 @sichtbarkeit
  Szenario: Der Lieferant erhält den Einsatzwert, nicht den Katalog des Standorts
    Angenommen für den Standort "Werk Süd" sind Vergleichsentgelt-Einträge zu zwölf Tätigkeiten gepflegt
    Und am Einsatz von "Jana Behrens" ist ein Vergleichsentgelt von 21,40 EUR je Stunde erfasst
    Wenn eine Warnung aus der Prüfung P4 an den Lieferantendisponenten geht
    Dann nennt sie den Wert des konkreten Einsatzes
    Und sie nennt den Katalog des Standorts nicht
    Und das Entgeltgefüge des Entleihers bleibt für Lieferantenrollen unsichtbar

  @p4 @grenzfall
  Szenario: Fehlende Tätigkeitsbeschreibung macht die Prüfung nicht ausführbar
    Angenommen am Einsatz von "Jana Behrens" ist keine Tätigkeitsbeschreibung erfasst
    Wenn der Betreiber das Vergleichsentgelt prüft
    Dann ist die Prüfung P4 nicht ausführbar und wirkt wie ein Treffer
    Und zusätzlich greift die Prüfung P8 aus der Konkretisierungspflicht

  # ------------------------------------------------------------------
  # Nächtlicher Lauf (SPEC 5.5.1, Zeile N3)
  # ------------------------------------------------------------------

  @nachtlauf @p3 @information
  Szenario: N3 Vorlauf von 60 Tagen vor der Equal-Pay-Fälligkeit
    Angenommen ein Einsatz von "Jana Behrens" steht im Status "active"
    Und die Equal-Pay-Fälligkeit ist der 15.10.2026
    Wenn der nächtliche Lauf am 16.08.2026 läuft
    Dann ist das Ergebnis eine Information an den MSP-Disponenten und an Einkauf und Controlling des Kunden
    Und der Status des Einsatzes bleibt "active"
    Und der Lauf erzeugt keinen Statuswechsel und keine Sperre

  @nachtlauf @p3 @p4 @warnung
  Szenario: N3 Vorlauf von 30 Tagen und fehlendes Vergleichsentgelt
    Angenommen ein Einsatz von "Jana Behrens" steht im Status "active"
    Und die Equal-Pay-Fälligkeit ist der 15.10.2026
    Und am Einsatz ist kein Vergleichsentgelt erfasst
    Wenn der nächtliche Lauf am 15.09.2026 läuft
    Dann ist das Ergebnis eine Warnung
    Und der Eskalationsanlass "Equal-Pay-Frist erreicht, Vergleichsentgelt fehlt" wird erzeugt
    Und der MSP-Administrator wird eskaliert, Einkauf und Controlling des Kunden erhalten eine Information
    Und die Warnung verfällt nicht und wird im nächsten Lauf erneut festgestellt
