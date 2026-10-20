# language: de
#
# Ausfuehrbare Fassung der AUEG-Regeln "Erlaubnis, Nachweise und Fristen"
# (SPEC 5.4).
#
# Quellen: SPEC 5.0 (Stichtag, Pruefzeitraum, fehlende Daten), SPEC 5.4
# (Pruefungen P9 und P10, Nachweisfluss, Pflichtkatalog), die
# Querschnittstabelle 4.7 (Q04, Q06, Q10, Q16, Q20, Q21, Q31, Q37, Q38, Q41,
# Q42, Q43, Q44) und SPEC 5.5 (Ergebnisarten, Uebersteuerung, naechtlicher
# Lauf N1 und N5).
#
# Lesart der Erwartungen (SPEC 4.7, 5.5.2):
#   Information - der Uebergang findet statt, das Ergebnis wird vermerkt
#   Warnung     - der Uebergang findet statt, Benachrichtigung und Eskalation
#   Sperre      - der Uebergang findet nicht statt, der Vorgang bleibt stehen
#
# Grenze der Pruefbarkeit (SPEC 5.0): geprueft wird der vom Lieferanten
# eingestellte und vom Betreiber anerkannte Nachweis, nicht ein Register
# (offene Frage 7). Was niemand eintraegt, kennt das System nicht.
#
# Firmen, Personen, Aktenzeichen und Datumsangaben sind synthetisch.
# Step-Definitions und Runner fehlen bewusst.

@spec-5.4 @aueg-1-abs-1 @aueg-2
Funktionalität: AÜG-Erlaubnis, Pflichtnachweise und Fristen

  Wer Arbeitnehmer zur Arbeitsleistung überlassen will, bedarf der Erlaubnis
  (§ 1 Abs. 1 AÜG); Überlassung ohne Erlaubnis führt nach §§ 9, 10 AÜG zur
  Unwirksamkeit des Arbeitsvertrags und zu einem Arbeitsverhältnis beim
  Entleiher. Geprüft wird tagesgenau: ein einziger nicht gedeckter Tag des
  Prüfzeitraums ist ein Treffer. Der Pflichtkatalog der Nachweise ist fest
  und nicht je Kunde konfigurierbar (SPEC 5.4.4).

  Grundlage:
    Angenommen der Entleiher "Nordwerk Metall GmbH" führt den Standort "Werk Süd", an dem eine Unterweisung verlangt wird
    Und der Lieferant "Rheinpersonal GmbH" steht im Status "active" und hat den Erlaubnissatz "EP-1" als befristete Erlaubnis vom 01.01.2026 bis 31.12.2026, anerkannt, mit hinterlegter Urkunde
    Und der Lieferant "Elbe Zeitarbeit GmbH" steht im Status "active" und hat den Erlaubnissatz "EP-9" als unbefristete Erlaubnis ab dem 01.07.2024 ohne Enddatum, anerkannt, mit hinterlegter Urkunde
    Und der Lieferant "Saale Personal GmbH" steht im Status "onboarding" und hat den Erlaubnissatz "EP-5" mit dem Anerkennungsstatus "submitted"
    Und der Kandidat "Miriam Falk" bei "Rheinpersonal GmbH" benötigt eine Arbeitserlaubnis, die als Nachweis anerkannt und bis zum 31.12.2026 gültig ist
    Und außer der jeweils geprüften Regel liefert keine andere AÜG-Prüfung einen Befund
    Und die Angaben dieser Grundlage gelten, soweit ein Szenario nichts anderes sagt — Laufzeiten und Tarifparameter werden dort eigens gesetzt

  # ==================================================================
  # P9 — AÜG-Erlaubnis (SPEC 5.4.1)
  # ==================================================================

  @p9 @rechenweg
  Szenario: Tagesgenaue Deckung des Prüfzeitraums
    Angenommen für "Rheinpersonal GmbH" soll der Zeitraum vom 01.11.2026 bis 31.12.2026 geprüft werden
    Wenn der Betreiber die Erlaubnis prüft
    Dann ist jeder Tag gedeckt, weil ein anerkannter Erlaubnissatz mit hinterlegter Urkunde ihn umschließt
    Und das Ergebnis der Prüfung P9 ist eine Information

  @p9 @grenzfall
  Szenario: Lücke zwischen zwei Erlaubnissätzen ist ein Treffer
    Angenommen für "Rheinpersonal GmbH" ist der Erlaubnissatz "EP-1" bis zum 30.06.2026 gültig
    Und der Nachfolgesatz "EP-2" ist ab dem 02.07.2026 gültig und anerkannt und verweist auf "EP-1" als Vorgänger
    Wenn der Betreiber den Zeitraum vom 01.06.2026 bis 31.07.2026 prüft
    Dann ist der 01.07.2026 nicht gedeckt
    Und das Ergebnis der Prüfung P9 ist ein Treffer, auch wenn die Lücke nur einen Tag beträgt
    Und der Verweis auf den Vorgänger heilt die Lücke nicht

  @p9 @grenzfall
  Szenario: Nicht anerkannte Erlaubnis deckt keinen Tag
    Angenommen "Saale Personal GmbH" hat den Erlaubnissatz "EP-5" mit dem Anerkennungsstatus "submitted" und der Laufzeit vom 01.01.2026 bis 31.12.2026
    Wenn der Betreiber den Zeitraum vom 01.03.2026 bis 31.03.2026 prüft
    Dann deckt der Satz keinen Tag
    Und das Ergebnis der Prüfung P9 ist ein Treffer
    Und die Meldung an den MSP-Disponenten nennt, dass die Anerkennung aussteht, nicht dass der Nachweis fehlt

  @p9 @information @grenzfall
  Szenario: Unbefristete Erlaubnis deckt jeden Tag ab dem Beginn
    Angenommen "Elbe Zeitarbeit GmbH" hat den unbefristeten Erlaubnissatz "EP-9" ab dem 01.07.2024 ohne Enddatum
    Wenn der Betreiber den Zeitraum vom 01.01.2027 bis 31.12.2027 prüft
    Dann ist jeder Tag gedeckt
    Und das Ergebnis der Prüfung P9 ist eine Information

  @p9 @grenzfall
  Szenario: Unbefristete Erlaubnis mit Enddatum ist ein Datenfehler
    Angenommen "Elbe Zeitarbeit GmbH" hat den Erlaubnissatz "EP-9" mit der Erlaubnisart "unlimited" und einem Enddatum 31.12.2026
    Wenn der Betreiber den Zeitraum vom 01.12.2026 bis 31.01.2027 prüft
    Dann rechnet das System mit dem strengeren Wert und behandelt den Satz wie eine befristete Erlaubnis
    Und die Tage ab dem 01.01.2027 sind nicht gedeckt
    Und das Ergebnis der Prüfung P9 ist ein Treffer

  @p9 @grenzfall
  Szenario: Erlaubnissatz ohne Urkunde deckt nichts
    Angenommen für "Rheinpersonal GmbH" ist am Erlaubnissatz "EP-1" keine Urkunde hinterlegt
    Wenn der Betreiber den Zeitraum vom 01.03.2026 bis 31.03.2026 prüft
    Dann deckt der Satz keinen Tag
    Und das Ergebnis der Prüfung P9 ist ein Treffer mit Nennung des fehlenden Feldes "documentRef"

  @p9 @grenzfall
  Szenario: Befristete Erlaubnis ohne Enddatum deckt nichts
    Angenommen für "Rheinpersonal GmbH" trägt der Erlaubnissatz "EP-1" die Erlaubnisart "fixedTerm" und kein Enddatum
    Wenn der Betreiber den Zeitraum vom 01.03.2026 bis 31.03.2026 prüft
    Dann ist der Satz ein Datenfehler und deckt keinen Tag
    Und die Meldung geht an den Lieferantenadministrator und den MSP-Disponenten

  # ---- Q04: Bedarfsanfrage approved -> tendered, Sperre je Einladung ----

  @q04 @p9 @information
  Szenario: Q04 Alle eingeladenen Lieferanten haben eine gültige Erlaubnis
    Angenommen die Bedarfsanfrage "BA-2026-030" steht im Status "approved"
    Und die Ausschreibung lädt "Rheinpersonal GmbH" und "Elbe Zeitarbeit GmbH" ein und die Angebotsfrist endet am 31.03.2026
    Wenn der MSP-Disponent die Bedarfsanfrage in den Status "tendered" überführt
    Dann ist das Ergebnis der Prüfung P9 je Einladung eine Information
    Und der Status der Bedarfsanfrage ist "tendered"
    Und beide Einladungen entstehen im Status "invited"

  @q04 @p9 @sperre
  Szenario: Q04 Ein eingeladener Lieferant ohne gültige Erlaubnis wird nicht eingeladen
    Angenommen die Bedarfsanfrage "BA-2026-031" steht im Status "approved"
    Und die Ausschreibung lädt "Rheinpersonal GmbH", "Elbe Zeitarbeit GmbH" und "Saale Personal GmbH" ein und die Angebotsfrist endet am 31.03.2026
    Und die Erlaubnis von "Saale Personal GmbH" ist nicht anerkannt
    Wenn der MSP-Disponent die Bedarfsanfrage in den Status "tendered" überführt
    Dann ist das Ergebnis der Prüfung P9 für "Saale Personal GmbH" eine Sperre
    Und für "Saale Personal GmbH" entsteht keine Einladung
    Und der Status der Bedarfsanfrage ist "tendered", weil mindestens eine zulässige Einladung bleibt
    Und jeder Lieferant erhält eine einzeln adressierte Benachrichtigung ohne Angaben zu fremden Einladungen

  @q04 @p9 @sperre
  Szenario: Q04 Kein eingeladener Lieferant ist zulässig
    Angenommen die Bedarfsanfrage "BA-2026-032" steht im Status "approved"
    Und die Ausschreibung lädt ausschließlich "Saale Personal GmbH" ein
    Und die Erlaubnis von "Saale Personal GmbH" ist nicht anerkannt
    Wenn der MSP-Disponent die Bedarfsanfrage in den Status "tendered" überführen will
    Dann ist das Ergebnis der Prüfung P9 eine Sperre
    Und der Status der Bedarfsanfrage ist weiter "approved"
    Und es entsteht keine Einladung

  @q04 @p9 @uebersteuerung
  Szenario: Q04 Übersteuerung, weil die Erlaubnis besteht, aber noch nicht anerkannt ist
    Angenommen die Einladung von "Saale Personal GmbH" ist durch die Prüfung P9 gesperrt
    Und die Erlaubnisurkunde liegt dem Betreiber nachweislich vor, die Anerkennung ist noch nicht vollzogen
    Und die Anerkennung ist vor dem Beginn der Angebotsfrist nicht möglich
    Und nach richtiger Datenlage wäre die Einladung zulässig
    Wenn der MSP-Administrator den Übergang mit Pflichtbegründung übersteuert
    Dann entsteht die Einladung im Status "invited"
    Und zwei Protokolleinträge liegen vor, der abgelehnte mit "blocked" und der vollzogene mit "success"
    Und die Übersteuerung ersetzt keine Erlaubnis und heilt die Rechtslage nicht

  # ---- Q06: Einladung -> invited, Ergebnisart Sperre ----

  @q06 @p9 @information
  Szenario: Q06 Einladung eines aktiven Lieferanten mit gültiger Erlaubnis
    Angenommen die Ausschreibung zur Bedarfsanfrage "BA-2026-030" hat die Angebotsfrist 31.03.2026
    Und "Rheinpersonal GmbH" steht im Status "active" und die Erlaubnis deckt den Zeitraum bis zur Angebotsfrist
    Wenn der MSP-Disponent die Einladung erzeugt
    Dann ist das Ergebnis der Prüfung P9 eine Information
    Und die Einladung steht im Status "invited"

  @q06 @p9 @sperre
  Szenario: Q06 Einladung eines Lieferanten mit ausstehender Anerkennung wird gesperrt
    Angenommen die Ausschreibung hat die Angebotsfrist 31.03.2026
    Und "Saale Personal GmbH" hat den Erlaubnissatz "EP-5" mit dem Anerkennungsstatus "submitted"
    Wenn der MSP-Disponent die Einladung erzeugen will
    Dann ist das Ergebnis der Prüfung P9 eine Sperre
    Und es entsteht keine Einladung
    Und ein Protokolleintrag mit der Prüfung "permitValidityCheck" und dem Ergebnis "blocked" liegt vor

  @q06 @p9 @sperre @grenzfall
  Szenario: Q06 Erlaubnis läuft innerhalb der Angebotsfrist ab
    Angenommen die Ausschreibung hat die Angebotsfrist 31.01.2027
    Und der Übergang wird am 15.12.2026 ausgelöst
    Und "Rheinpersonal GmbH" hat nur den Erlaubnissatz "EP-1" bis zum 31.12.2026 und keinen Nachfolgesatz
    Wenn der MSP-Disponent die Einladung erzeugen will
    Dann sind die Tage ab dem 01.01.2027 nicht gedeckt
    Und das Ergebnis der Prüfung P9 ist eine Sperre
    Und es entsteht keine Einladung

  # ---- Q16: Einsatz -> planned, Ergebnisart Sperre ----

  @q16 @p9 @information
  Szenario: Q16 Erlaubnis deckt den geplanten Zeitraum
    Angenommen für "Miriam Falk" soll ein Einsatz über "Rheinpersonal GmbH" vom 01.03.2026 bis 30.11.2026 angelegt werden
    Wenn der MSP-Disponent den Einsatz in den Status "planned" überführt
    Dann ist das Ergebnis der Prüfung P9 eine Information
    Und der Status des Einsatzes ist "planned"

  @q16 @p9 @sperre
  Szenario: Q16 Geplanter Zeitraum reicht über die Erlaubnis hinaus
    Angenommen für "Miriam Falk" soll ein Einsatz über "Rheinpersonal GmbH" vom 01.11.2026 bis 31.03.2027 angelegt werden
    Und für "Rheinpersonal GmbH" ist kein Erlaubnissatz für das Jahr 2027 erfasst
    Wenn der MSP-Disponent den Einsatz in den Status "planned" überführen will
    Dann ist das Ergebnis der Prüfung P9 eine Sperre
    Und es entsteht kein Einsatz im Status "planned"
    Und die Sperre nennt den ersten nicht gedeckten Tag 01.01.2027

  @q16 @p9 @information
  Szenario: Q16 Anerkannter Nachfolgesatz deckt den Folgezeitraum
    Angenommen für "Rheinpersonal GmbH" ist der Erlaubnissatz "EP-2" vom 01.01.2027 bis 31.12.2027 anerkannt und mit Urkunde hinterlegt
    Wenn der MSP-Disponent einen Einsatz vom 01.11.2026 bis 31.03.2027 in den Status "planned" überführt
    Dann ist jeder Tag des Prüfzeitraums gedeckt
    Und das Ergebnis der Prüfung P9 ist eine Information
    Und der Status des Einsatzes ist "planned"

  @q16 @p9 @uebersteuerung
  Szenario: Q16 Übersteuerungsversuch bei fehlender Erlaubnis wird zurückgewiesen
    Angenommen das Anlegen des Einsatzes ist durch die Prüfung P9 gesperrt
    Und für den Zeitraum ab dem 01.01.2027 besteht tatsächlich keine Erlaubnis
    Wenn der MSP-Administrator die Sperre zu übersteuern versucht
    Dann wird die Übersteuerung zurückgewiesen, weil die Überlassung auch nach richtiger Datenlage unzulässig wäre
    Und es entsteht kein Einsatz im Status "planned"

  # ---- Q20: Einsatz planned -> active, Ergebnisart Sperre ----

  @q20 @p9 @information
  Szenario: Q20 Erlaubnis ist am Starttag gültig und anerkannt
    Angenommen ein Einsatz von "Miriam Falk" über "Rheinpersonal GmbH" steht im Status "planned" mit tatsächlichem Beginn 01.03.2026
    Wenn der MSP-Disponent den Einsatz in den Status "active" überführt
    Dann ist das Ergebnis der Prüfung P9 eine Information
    Und der Status des Einsatzes ist "active"

  @q20 @p9 @information @grenzfall
  Szenario: Q20 Einsatzstart genau am letzten Gültigkeitstag der Erlaubnis
    Angenommen ein Einsatz von "Miriam Falk" über "Rheinpersonal GmbH" steht im Status "planned" mit tatsächlichem Beginn 31.12.2026
    Und der Erlaubnissatz "EP-1" ist bis zum 31.12.2026 gültig
    Wenn der MSP-Disponent den Einsatz in den Status "active" überführt
    Dann ist der 31.12.2026 eingeschlossen und gedeckt
    Und das Ergebnis der Prüfung P9 ist eine Information
    Und der Status des Einsatzes ist "active"

  @q20 @p9 @sperre
  Szenario: Q20 Einsatzstart an einem Tag in der Erlaubnislücke
    Angenommen der Erlaubnissatz "EP-1" von "Rheinpersonal GmbH" ist bis zum 30.06.2026 gültig und der Nachfolgesatz "EP-2" ab dem 02.07.2026
    Und ein Einsatz von "Miriam Falk" steht im Status "planned" mit tatsächlichem Beginn 01.07.2026
    Wenn der MSP-Disponent den Einsatz in den Status "active" überführen will
    Dann ist der 01.07.2026 nicht gedeckt
    Und das Ergebnis der Prüfung P9 ist eine Sperre
    Und der Status des Einsatzes ist weiter "planned"

  @q20 @p9 @uebersteuerung
  Szenario: Q20 Übersteuerung, weil die Erlaubnis besteht, aber nicht eingestellt ist
    Angenommen der Einsatzstart ist durch die Prüfung P9 gesperrt
    Und die Erlaubnis für den Starttag besteht nachweislich und ist im System nicht eingestellt
    Und das Einstellen und Anerkennen ist vor dem Einsatzstart nicht möglich
    Und nach richtiger Datenlage wäre die Überlassung zulässig
    Wenn der MSP-Administrator den Übergang mit Pflichtbegründung übersteuert
    Dann findet der Übergang statt und der Status des Einsatzes ist "active"
    Und zwei Protokolleinträge liegen vor, der abgelehnte mit "blocked" und der vollzogene mit "success"
    Und die Übersteuerung gilt nur für diesen einen Übergang

  @q20 @p9 @grenzfall @rueckwirkend
  Szenario: Q20 Rückwirkend eingestellte Verlängerung wirkt erst ab der Anerkennung
    Angenommen der Einsatzstart am 01.07.2026 wurde durch die Prüfung P9 gesperrt, weil die Erlaubnislücke nicht gedeckt war
    Und am 15.07.2026 wird ein Erlaubnissatz mit Beginn 01.07.2026 eingestellt und anerkannt
    Wenn der Betreiber die Prüfung P9 erneut rechnet
    Dann ist die Lücke für alle künftigen Prüfungen geschlossen
    Und der gesperrte Übergang vom 01.07.2026 wird nicht nachträglich wirksam
    Und der Einsatzstart ist erneut auszulösen

  # ---- Q31: Verlängerung approved -> effective, Ergebnisart Sperre ----

  @q31 @p9 @information
  Szenario: Q31 Erlaubnis deckt den verlängerten Zeitraum
    Angenommen ein Einsatz über "Rheinpersonal GmbH" läuft bis zum 30.09.2026
    Und die Verlängerung "VL-2026-020" mit neuem Ende 30.11.2026 steht im Status "approved"
    Wenn der MSP-Disponent die Verlängerung in den Status "effective" überführt
    Dann ist das Ergebnis der Prüfung P9 eine Information
    Und der Status der Verlängerung ist "effective"

  @q31 @p9 @sperre @grenzfall
  Szenario: Q31 Verlängerung über das Ende der Erlaubnis hinaus wird gesperrt
    Angenommen ein Einsatz über "Rheinpersonal GmbH" läuft bis zum 30.11.2026
    Und der Erlaubnissatz "EP-1" ist bis zum 31.12.2026 gültig und ein Nachfolgesatz fehlt
    Und die Verlängerung "VL-2026-021" mit neuem Ende 31.03.2027 steht im Status "approved"
    Wenn der MSP-Disponent die Verlängerung in den Status "effective" überführen will
    Dann ist das Ergebnis der Prüfung P9 eine Sperre
    Und der Status der Verlängerung ist weiter "approved"
    Und das geplante Ende des Einsatzes bleibt der 30.11.2026
    Und eine Verlängerung in einen nicht gedeckten Zeitraum ist eine neue Überlassungsentscheidung

  @q31 @p9 @uebersteuerung
  Szenario: Q31 Übersteuerung bei vorliegender, aber nicht erfasster Verlängerung der Erlaubnis
    Angenommen die Wirksamkeit der Verlängerung "VL-2026-021" ist durch die Prüfung P9 gesperrt
    Und die behördliche Verlängerung der Erlaubnis bis zum 31.12.2027 liegt nachweislich vor und ist im System nicht erfasst
    Und das Erfassen ist vor dem Ablauf des bisherigen Endes nicht möglich
    Und nach richtiger Datenlage wäre die Verlängerung zulässig
    Wenn der MSP-Administrator den Übergang mit Pflichtbegründung übersteuert
    Dann findet der Übergang statt und der Status der Verlängerung ist "effective"
    Und zwei Protokolleinträge liegen vor, der abgelehnte mit "blocked" und der vollzogene mit "success"

  # ---- Q38: Abrechnungsbeleg -> created, Ergebnisart Warnung ----

  @q38 @p9 @information
  Szenario: Q38 Erlaubnis ist im gesamten Leistungszeitraum gültig
    Angenommen der Einkaufsbeleg zur Periode März 2026 beruht auf genehmigten Stundenzetteln zu Einsätzen über "Rheinpersonal GmbH"
    Und der Leistungszeitraum ist der 01.03.2026 bis 31.03.2026
    Wenn der MSP-Disponent den Beleg in den Status "created" überführt
    Dann ist das Ergebnis der Prüfung P9 eine Information
    Und der Status des Belegs ist "created"

  @q38 @p9 @warnung
  Szenario: Q38 Erlaubnislücke im Leistungszeitraum blockiert die Abrechnung nicht
    Angenommen der Einkaufsbeleg zur Periode Juli 2026 beruht auf genehmigten Stundenzetteln zu Einsätzen über "Rheinpersonal GmbH"
    Und der Erlaubnissatz "EP-1" war bis zum 30.06.2026 gültig und der Nachfolgesatz "EP-2" erst ab dem 02.07.2026
    Wenn der MSP-Disponent den Beleg in den Status "created" überführt
    Dann ist das Ergebnis der Prüfung P9 eine Warnung
    Und die Warnung nennt den nicht gedeckten 01.07.2026
    Und der Status des Belegs ist "created"
    Und erbrachte Leistung wird abgerechnet

  @q38 @p9 @grenzfall
  Szenario: Q38 Nach einem Lieferantenwechsel wird je Leistungszeitraum geprüft
    Angenommen der Einkaufsbeleg umfasst Leistungen vom 01.05.2026 bis 31.05.2026 über "Rheinpersonal GmbH" und vom 01.06.2026 bis 30.06.2026 über "Elbe Zeitarbeit GmbH"
    Wenn der MSP-Disponent den Beleg in den Status "created" überführt
    Dann wird je Leistungszeitraum die Erlaubnis des jeweils zuständigen Lieferanten geprüft
    Und das Ergebnis der Prüfung P9 ist eine Information

  # ==================================================================
  # P10 — Pflichtnachweise (SPEC 5.4.4)
  # ==================================================================

  # ---- Q10: Profilvorschlag submitted -> reviewed, Ergebnisart Information ----

  @q10 @p10 @information
  Szenario: Q10 Pflichtnachweise des Kandidaten liegen vor
    Angenommen der Profilvorschlag "PV-2026-050" für "Miriam Falk" steht im Status "submitted"
    Und die Arbeitserlaubnis ist anerkannt und bis zum 31.12.2026 gültig
    Wenn der MSP-Disponent den Profilvorschlag in den Status "reviewed" überführt
    Dann ist das Ergebnis der Prüfung P10 eine Information
    Und der Status des Profilvorschlags ist "reviewed"

  @q10 @p10 @information
  Szenario: Q10 Erforderliche Arbeitserlaubnis fehlt
    Angenommen der Profilvorschlag "PV-2026-051" für den Kandidaten "Lennart Voß" steht im Status "submitted"
    Und für diesen Kandidaten ist eine Arbeitserlaubnis erforderlich und kein Nachweis erfasst
    Wenn der MSP-Disponent den Profilvorschlag in den Status "reviewed" überführt
    Dann ist das Ergebnis der Prüfung P10 eine Information
    Und die Information nennt die Nachweisart "workPermit" und das Bezugsobjekt Kandidat, nicht "Nachweise unvollständig"
    Und der Status des Profilvorschlags ist "reviewed"
    Und die Sperrwirkung greift erst am Einsatzstart

  # ---- Q21: Einsatz planned -> active, Ergebnisart Sperre ----

  @q21 @p10 @information
  Szenario: Q21 Alle Pflichtnachweise zum Einsatz liegen vor
    Angenommen ein Einsatz von "Miriam Falk" am Standort "Werk Süd" steht im Status "planned" mit tatsächlichem Beginn 01.03.2026
    Und die Arbeitserlaubnis ist anerkannt und bis zum 31.12.2026 gültig
    Und die Unterweisung am Standort ist anerkannt und bis zum 31.08.2027 gültig
    Wenn der MSP-Disponent den Einsatz in den Status "active" überführt
    Dann ist das Ergebnis der Prüfung P10 eine Information
    Und der Status des Einsatzes ist "active"

  @q21 @p10 @sperre
  Szenario: Q21 Unterweisung am Standort fehlt
    Angenommen ein Einsatz von "Miriam Falk" am Standort "Werk Süd" steht im Status "planned" mit tatsächlichem Beginn 01.03.2026
    Und am Standort wird eine Unterweisung verlangt und für den Einsatz ist kein Unterweisungsnachweis erfasst
    Wenn der MSP-Disponent den Einsatz in den Status "active" überführen will
    Dann ist das Ergebnis der Prüfung P10 eine Sperre
    Und die Sperre nennt die Nachweisart "safetyBriefing" und den Einsatz als Bezugsobjekt
    Und der Status des Einsatzes ist weiter "planned"

  @q21 @p10 @sperre
  Szenario: Q21 Arbeitserlaubnis ist am Starttag abgelaufen
    Angenommen ein Einsatz von "Miriam Falk" steht im Status "planned" mit tatsächlichem Beginn 15.01.2027
    Und die Arbeitserlaubnis des Kandidaten war bis zum 31.12.2026 gültig
    Wenn der MSP-Disponent den Einsatz in den Status "active" überführen will
    Dann ist das Ergebnis der Prüfung P10 eine Sperre
    Und der Status des Einsatzes ist weiter "planned"

  @q21 @p10 @sperre @grenzfall
  Szenario: Q21 Angabe zur Erforderlichkeit der Arbeitserlaubnis fehlt
    Angenommen ein Einsatz des Kandidaten "Lennart Voß" steht im Status "planned" mit tatsächlichem Beginn 01.03.2026
    Und am Kandidaten ist nicht erfasst, ob eine Arbeitserlaubnis erforderlich ist
    Und kein Nachweis der Art "workPermit" ist erfasst
    Wenn der MSP-Disponent den Einsatz in den Status "active" überführen will
    Dann wird die fehlende Angabe wie "ja" gerechnet
    Und das Ergebnis der Prüfung P10 ist eine Sperre
    Und der Status des Einsatzes ist weiter "planned"

  @q21 @p10 @sperre @grenzfall
  Szenario: Q21 Angabe zur Unterweisungspflicht des Standorts fehlt
    Angenommen ein Einsatz von "Miriam Falk" am Standort "Werk Nord" steht im Status "planned" mit tatsächlichem Beginn 01.03.2026
    Und am Standort ist nicht erfasst, ob eine Unterweisung verlangt wird, und kein Unterweisungsnachweis liegt vor
    Wenn der MSP-Disponent den Einsatz in den Status "active" überführen will
    Dann wird die fehlende Angabe wie "ja" gerechnet
    Und das Ergebnis der Prüfung P10 ist eine Sperre

  # Der Qualifikationsnachweis sperrt nach dem Katalog in 5.4.4 nie; das
  # Sammelergebnis ist das strengste Einzelergebnis. Siehe offene Frage 31
  # zum Verhaeltnis dieser Zeile zur Ergebnisart von Q21 in 4.7.
  @q21 @p10 @warnung @grenzfall
  Szenario: Q21 Nur der Qualifikationsnachweis fehlt
    Angenommen ein Einsatz von "Miriam Falk" steht im Status "planned" mit tatsächlichem Beginn 01.03.2026
    Und Arbeitserlaubnis und Unterweisung sind anerkannt und gültig
    Und für den Kandidaten ist kein Qualifikationsnachweis erfasst
    Wenn der MSP-Disponent den Einsatz in den Status "active" überführt
    Dann ist das Einzelergebnis zur Nachweisart "qualificationCertificate" eine Warnung
    Und das Sammelergebnis der Prüfung P10 ist das strengste Einzelergebnis, hier eine Warnung
    Und jede Einzelfeststellung wird eigens vermerkt
    Und der Status des Einsatzes ist "active"

  @q21 @p10 @uebersteuerung
  Szenario: Q21 Übersteuerung, weil die Unterweisung vorliegt, aber nicht erfasst ist
    Angenommen der Einsatzstart ist durch die Prüfung P10 gesperrt
    Und die Unterweisung am Standort wurde nachweislich am 25.02.2026 durchgeführt und ist im System nicht erfasst
    Und das Einstellen und Anerkennen ist vor dem Einsatzstart nicht möglich
    Und nach richtiger Datenlage wäre die Überlassung zulässig
    Wenn der MSP-Administrator den Übergang mit Pflichtbegründung übersteuert
    Dann findet der Übergang statt und der Status des Einsatzes ist "active"
    Und zwei Protokolleinträge liegen vor, der abgelehnte mit "blocked" und der vollzogene mit "success"

  @q21 @p10 @uebersteuerung
  Szenario: Q21 Übersteuerungsversuch bei tatsächlich fehlendem Nachweis wird zurückgewiesen
    Angenommen der Einsatzstart ist durch die Prüfung P10 gesperrt
    Und die Unterweisung am Standort hat tatsächlich nicht stattgefunden
    Wenn der MSP-Administrator die Sperre zu übersteuern versucht
    Dann wird die Übersteuerung zurückgewiesen, weil die Überlassung auch nach richtiger Datenlage unzulässig wäre
    Und der Status des Einsatzes ist weiter "planned"

  # ---- Q37: Stundenzettel inApproval -> approved, Ergebnisart Warnung ----

  @q37 @p10 @information
  Szenario: Q37 Unterweisungsnachweis ist für den Zettelzeitraum gültig
    Angenommen der Stundenzettel "SZ-2026-03-001" steht im Status "inApproval" und alle Freigabeschritte sind zugestimmt
    Und die Unterweisung am Standort ist anerkannt und bis zum 31.08.2027 gültig
    Wenn die Rolle der letzten Freigabestufe den Stundenzettel in den Status "approved" überführt
    Dann ist das Ergebnis der Prüfung P10 eine Information
    Und der Status des Stundenzettels ist "approved"

  @q37 @p10 @warnung
  Szenario: Q37 Unterweisungsnachweis ist abgelaufen
    Angenommen der Stundenzettel "SZ-2027-09-001" steht im Status "inApproval" und alle Freigabeschritte sind zugestimmt
    Und sein Zeitraum ist der 01.09.2027 bis 30.09.2027
    Und die Unterweisung am Standort war bis zum 31.08.2027 gültig
    Wenn die Rolle der letzten Freigabestufe den Stundenzettel in den Status "approved" überführt
    Dann ist das Ergebnis der Prüfung P10 eine Warnung
    Und der Status des Stundenzettels ist "approved"
    Und für einen neuen Einsatz am selben Standort greift die Sperre

  # ---- Q41 bis Q44: Lieferantenstatus ----

  @q41 @p9 @information
  Szenario: Q41 Freischalten eines Lieferanten mit anerkannter Erlaubnis
    Angenommen "Saale Personal GmbH" steht im Status "onboarding"
    Und der Rahmenvertrag der Lieferantenseite steht im Status "active" und die Tarifzuordnung der Verleiherseite ist gesetzt
    Und der Erlaubnissatz "EP-5" ist am 20.02.2026 anerkannt worden und vom 01.01.2026 bis 31.12.2026 gültig
    Wenn der MSP-Administrator den Lieferanten am 21.02.2026 in den Status "active" überführt
    Dann ist das Ergebnis der Prüfung P9 eine Information
    Und der Status des Lieferanten ist "active"
    Und der Lieferant erscheint im Einladungskreis

  @q41 @p9 @sperre
  Szenario: Q41 Freischalten ohne anerkannte Erlaubnis wird gesperrt
    Angenommen "Saale Personal GmbH" steht im Status "onboarding"
    Und der Erlaubnissatz "EP-5" trägt den Anerkennungsstatus "submitted"
    Wenn der MSP-Administrator den Lieferanten in den Status "active" überführen will
    Dann ist das Ergebnis der Prüfung P9 eine Sperre
    Und der Status des Lieferanten ist weiter "onboarding"
    Und die Meldung nennt, dass die Anerkennung aussteht

  @q41 @p9 @uebersteuerung
  Szenario: Q41 Übersteuerungsversuch ohne bestehende Erlaubnis wird zurückgewiesen
    Angenommen das Freischalten von "Saale Personal GmbH" ist durch die Prüfung P9 gesperrt
    Und eine Erlaubnis besteht tatsächlich nicht
    Wenn der MSP-Administrator die Sperre zu übersteuern versucht
    Dann wird die Übersteuerung zurückgewiesen
    Und der Status des Lieferanten ist weiter "onboarding"

  @q42 @p10 @information
  Szenario: Q42 Pflichtnachweise des Lieferanten liegen vor
    Angenommen "Saale Personal GmbH" steht im Status "onboarding"
    Und die Unbedenklichkeitsbescheinigung ist anerkannt und bis zum 31.12.2026 gültig
    Und die Erlaubnisurkunde ist anerkannt und hinterlegt
    Wenn der MSP-Administrator den Lieferanten in den Status "active" überführt
    Dann ist das Ergebnis der Prüfung P10 eine Information
    Und der Status des Lieferanten ist "active"

  # Die Unbedenklichkeitsbescheinigung sperrt nach dem Katalog in 5.4.4 nie,
  # 4.7 ordnet Q42 aber eine Sperre zu. Siehe offene Frage 31.
  @q42 @p10 @warnung @grenzfall
  Szenario: Q42 Unbedenklichkeitsbescheinigung fehlt
    Angenommen "Saale Personal GmbH" steht im Status "onboarding"
    Und die Erlaubnisurkunde ist anerkannt und hinterlegt
    Und keine Unbedenklichkeitsbescheinigung ist erfasst
    Wenn der MSP-Administrator den Lieferanten in den Status "active" überführt
    Dann ist das Einzelergebnis zur Nachweisart "clearanceCertificate" eine Warnung
    Und die Meldung nennt Nachweisart und Bezugsobjekt
    Und das Ergebnis wird protokolliert

  @q43 @p9 @p10 @information
  Szenario: Q43 Entsperren eines Lieferanten nach behobenem Sperrgrund
    Angenommen "Rheinpersonal GmbH" steht im Status "blocked" und wurde am 01.02.2026 vom MSP-Disponenten gesperrt
    Und der Sperrgrund ist behoben und dokumentiert
    Und die Erlaubnis ist gültig und anerkannt und die Pflichtnachweise sind gültig
    Wenn ein MSP-Administrator, der nicht die sperrende Person ist, den Lieferanten in den Status "active" überführt
    Dann sind die Ergebnisse der Prüfungen P9 und P10 Informationen
    Und der Status des Lieferanten ist "active"
    Und ein Protokolleintrag mit dem Aufhebungsgrund liegt vor

  @q43 @p9 @sperre
  Szenario: Q43 Entsperren mit abgelaufener Erlaubnis wird gesperrt
    Angenommen "Rheinpersonal GmbH" steht im Status "blocked"
    Und der Erlaubnissatz "EP-1" war bis zum 31.12.2026 gültig und ein Nachfolgesatz fehlt
    Wenn der MSP-Administrator den Lieferanten am 15.01.2027 in den Status "active" überführen will
    Dann ist das Ergebnis der Prüfung P9 eine Sperre
    Und der Status des Lieferanten ist weiter "blocked"

  @q43 @sperre @grenzfall
  Szenario: Q43 Entsperren durch den MSP-Disponenten ist ausgeschlossen
    Angenommen "Rheinpersonal GmbH" steht im Status "blocked" und alle Voraussetzungen für die Entsperrung sind erfüllt
    Wenn der MSP-Disponent den Lieferanten in den Status "active" überführen will
    Dann wird der Übergang zurückgewiesen, weil nur der MSP-Administrator entsperren darf
    Und der Status des Lieferanten ist weiter "blocked"

  @q43 @sperre @grenzfall
  Szenario: Q43 Entsperren durch die sperrende Person ist ausgeschlossen
    Angenommen "Rheinpersonal GmbH" wurde von einem MSP-Administrator gesperrt und alle Voraussetzungen für die Entsperrung sind erfüllt
    Wenn dieselbe Person den Lieferanten in den Status "active" überführen will
    Dann wird der Übergang wegen des Vier-Augen-Prinzips zurückgewiesen
    Und der Status des Lieferanten ist weiter "blocked"

  @q44 @p9 @p10 @information
  Szenario: Q44 Reaktivieren eines inaktiven Lieferanten
    Angenommen "Elbe Zeitarbeit GmbH" steht im Status "inactive"
    Und Rahmenvertrag und Erlaubnis sind wieder gültig und anerkannt und die Pflichtnachweise sind gültig
    Wenn der MSP-Administrator den Lieferanten mit Begründung in den Status "active" überführt
    Dann sind die Ergebnisse der Prüfungen P9 und P10 Informationen
    Und der Status des Lieferanten ist "active"
    Und ein Protokolleintrag mit dem Reaktivierungsgrund liegt vor

  @q44 @p9 @sperre
  Szenario: Q44 Reaktivieren ohne anerkannte Erlaubnis wird gesperrt
    Angenommen "Elbe Zeitarbeit GmbH" steht im Status "inactive"
    Und der Erlaubnissatz des Lieferanten trägt den Anerkennungsstatus "rejected"
    Wenn der MSP-Administrator den Lieferanten in den Status "active" überführen will
    Dann ist das Ergebnis der Prüfung P9 eine Sperre
    Und der Status des Lieferanten ist weiter "inactive"

  # ==================================================================
  # Nachweisfluss des Dokuments (SPEC 5.4.3)
  # ==================================================================

  @nachweisfluss @information
  Szenario: Anerkennung eines eingereichten Nachweises
    Angenommen der Lieferantenadministrator hat die Erlaubnisurkunde mit Nachweisart, Bezugsobjekt und Datei eingestellt, der Nachweis steht auf "submitted"
    Wenn der MSP-Disponent den Nachweis auf "accepted" setzt
    Dann sind Anerkennungszeitpunkt und anerkennende Person gesetzt
    Und die Prüfungen P9 und P10 werden neu gerechnet
    Und der Einsteller wird benachrichtigt
    Und der Nachweis deckt den Pflichtnachweis, soweit der Gültigkeitszeitraum reicht

  @nachweisfluss @warnung
  Szenario: Zurückweisung eines Nachweises
    Angenommen die Unbedenklichkeitsbescheinigung von "Saale Personal GmbH" steht auf "submitted"
    Wenn der MSP-Disponent den Nachweis mit Begründung auf "rejected" setzt
    Dann ist die Zurückweisung ein Endzustand und der Nachweis deckt nichts
    Und der Pflichtnachweis bleibt offen
    Und der Eskalationsanlass "AÜG-Erlaubnis läuft ab oder Nachweis fehlt" wird erzeugt
    Und der Einsteller wird mit Begründung benachrichtigt

  @nachweisfluss @grenzfall
  Szenario: Ein zurückgewiesener Nachweis wird nicht erneut eingereicht
    Angenommen ein Nachweis steht auf "rejected"
    Wenn der Lieferantenadministrator einen berichtigten Nachweis beibringen will
    Dann entsteht ein neues Dokument
    Und der zurückgewiesene Nachweis bleibt unverändert
    Und beim Erlaubnissatz führt der neue Satz den Vorgänger als Verweis

  @nachweisfluss @grenzfall
  Szenario: Ablauf der Gültigkeit erzeugt keinen Statuswechsel
    Angenommen die Arbeitserlaubnis von "Miriam Falk" ist anerkannt und bis zum 31.12.2026 gültig
    Wenn der nächtliche Lauf am 01.01.2027 läuft
    Dann ist der Anerkennungsstatus des Nachweises unverändert "accepted"
    Und der Nachweis ist für Tage außerhalb seines Zeitraums unbrauchbar
    Und die Gültigkeit wird von den Prüfungen P9 und P10 je Stichtag gelesen

  @nachweisfluss @grenzfall
  Szenario: Der Einsteller kann seinen Nachweis nicht selbst anerkennen
    Angenommen der Lieferantenadministrator hat einen Nachweis eingestellt, der auf "submitted" steht
    Wenn derselbe Lieferantenadministrator den Nachweis anerkennen will
    Dann wird der Übergang zurückgewiesen
    Und die Anerkennung bleibt die Prüfhandlung des Betreibers

  @nachweisfluss @information @grenzfall
  Szenario: Anerkennung eines sperrenden Nachweises ohne Enddatum
    Angenommen der Lieferantenadministrator hat eine Arbeitserlaubnis ohne Enddatum eingestellt
    Wenn der MSP-Disponent den Nachweis auf "accepted" setzt
    Dann gilt der Nachweis unbefristet und läuft nicht ab
    Und das Ergebnis trägt eine Information an den MSP-Disponenten, damit das Enddatum nicht aus Versehen leer bleibt
    Und eine Sperre ist es nicht

  @nachweisfluss @grenzfall
  Szenario: Anerkannter Nachweis ohne Datei deckt nichts
    Angenommen ein Erlaubnissatz verweist auf ein Dokument ohne hinterlegte Datei
    Wenn der Betreiber die Prüfung P9 rechnet
    Dann ist der Satz ein Datenfehler und deckt keinen Tag
    Und das Ergebnis nennt das fehlende Feld "fileRef"

  # ==================================================================
  # Nächtlicher Lauf (SPEC 5.5.1, Zeilen N1 und N5) und Ablaufbehandlung
  # ==================================================================

  @nachtlauf @n1 @p9
  Szenariogrundriss: N1 Gestufter Vorlauf vor Ablauf der AÜG-Erlaubnis
    Angenommen "Rheinpersonal GmbH" steht im Status "active" und der Erlaubnissatz "EP-1" ist bis zum 31.12.2026 gültig
    Wenn der nächtliche Lauf am <tag> läuft
    Dann ist das Ergebnis der Prüfung P9 "<ergebnis>"
    Und Adressat ist "<adressat>"
    Und der Status des Lieferanten bleibt "active"

    Beispiele:
      | tag        | ergebnis               | adressat                                     |
      | 02.10.2026 | Information            | Lieferantenadministrator                     |
      | 01.12.2026 | Warnung                | zusätzlich Lieferantendisponent              |
      | 17.12.2026 | Warnung mit Eskalation | zusätzlich MSP-Disponent                     |
      | 01.01.2027 | Warnung mit Eskalation | zusätzlich MSP-Administrator                 |

  @nachtlauf @n1 @p9
  Szenario: N1 Abgelaufene Erlaubnis sperrt den Lieferanten nicht automatisch
    Angenommen "Rheinpersonal GmbH" steht im Status "active" und der Erlaubnissatz "EP-1" war bis zum 31.12.2026 gültig
    Wenn der nächtliche Lauf am 01.01.2027 läuft
    Dann ist das Ergebnis eine Warnung mit Eskalation an den MSP-Administrator
    Und die Eskalation enthält den Vorschlag, den Lieferanten zu sperren
    Und der Status des Lieferanten bleibt "active"
    Und der Übergang nach "blocked" wird von einem Menschen mit Pflichtbegründung vollzogen

  @nachtlauf @n5 @p10
  Szenariogrundriss: N5 Gestufter Vorlauf vor Ablauf der Arbeitserlaubnis
    Angenommen die Arbeitserlaubnis von "Miriam Falk" ist anerkannt und bis zum 31.12.2026 gültig
    Und ein Einsatz dieses Kandidaten steht im Status "active"
    Wenn der nächtliche Lauf am <tag> läuft
    Dann ist das Ergebnis der Prüfung P10 "<ergebnis>"
    Und der Status des Einsatzes bleibt "active"

    Beispiele:
      | tag        | ergebnis               |
      | 01.11.2026 | Information            |
      | 01.12.2026 | Warnung                |
      | 24.12.2026 | Warnung mit Eskalation |
      | 01.01.2027 | Warnung mit Eskalation |

  @nachtlauf @p10 @warnung
  Szenario: N5 Abgelaufene Arbeitserlaubnis bei laufendem Einsatz
    Angenommen die Arbeitserlaubnis von "Miriam Falk" war bis zum 31.12.2026 gültig
    Und ein Einsatz dieses Kandidaten steht im Status "active"
    Wenn der nächtliche Lauf am 02.01.2027 läuft
    Dann ist das Ergebnis eine Warnung mit Pflicht-Eskalation an MSP-Disponent, MSP-Administrator und Lieferantenadministrator
    Und für einen neuen Vorgang greift die Sperre
    Und der laufende Einsatz wird nicht beendet

  @p9 @warnung @grenzfall
  Szenario: Erlaubnis erlischt während eines laufenden Einsatzes
    Angenommen ein Einsatz über "Rheinpersonal GmbH" steht im Status "active" und läuft bis zum 31.03.2027
    Und der Erlaubnissatz "EP-1" war bis zum 31.12.2026 gültig und ein Nachfolgesatz fehlt
    Wenn der nächtliche Lauf am 02.01.2027 läuft
    Dann ist das Ergebnis eine Warnung mit Pflicht-Eskalation an MSP-Disponent und MSP-Administrator, täglich wiederholt
    Und das System beendet den Einsatz nicht
    Und ein Einsatz im Status "planned" kann nicht nach "active" überführt werden
    Und eine Verlängerung im Status "approved" kann nicht wirksam werden
    Und die Abrechnung erbrachter Leistung läuft weiter
    Und der Übergang nach "terminatedEarly" aus Rechtsgründen bleibt dem MSP-Disponenten mit Pflichtbegründung vorbehalten

  @p10 @warnung @grenzfall
  Szenario: Standort verlangt die Unterweisung nachträglich
    Angenommen am Standort "Werk Nord" war keine Unterweisung verlangt
    Und ein Einsatz von "Miriam Falk" an diesem Standort steht im Status "active"
    Wenn der Entleiher am 01.03.2026 einstellt, dass eine Unterweisung verlangt wird
    Dann wird die Unterweisung für laufende Einsätze zum Pflichtnachweis
    Und das Ergebnis ist eine Warnung mit Eskalation an den Bedarfsträger und den Lieferantendisponenten
    Und die Sperre greift erst für den nächsten Einsatzstart
    Und der laufende Einsatz wird nicht durch eine Stammdatenänderung unterbrochen

  @p9 @warnung @grenzfall @rueckwirkend
  Szenario: Rückwirkend vorgezogenes Ende einer Erlaubnis
    Angenommen für "Rheinpersonal GmbH" wird das Enddatum des Erlaubnissatzes "EP-1" am 15.11.2026 von 31.12.2026 auf 30.09.2026 berichtigt
    Und für den Zeitraum vom 01.10.2026 bis 31.10.2026 sind Belege freigegeben
    Wenn der MSP-Administrator die Berichtigung speichert
    Dann werden alle Prüfungen neu gerechnet
    Und für die abgerechneten Zeiträume ist das Ergebnis eine Warnung mit Pflicht-Eskalation an den MSP-Administrator
    Und die Belege werden nicht entwertet
    Und laufende Einsätze folgen der Behandlung bei erloschener Erlaubnis

  @p10 @grenzfall
  Szenario: Ein Nachweis eines anderen Kandidatensatzes deckt nicht mit
    Angenommen "Miriam Falk" ist als Kandidat bei "Rheinpersonal GmbH" und bei "Elbe Zeitarbeit GmbH" geführt und beide Sätze sind derselben bestätigten Personenidentität zugeordnet
    Und die Arbeitserlaubnis ist nur am Kandidatensatz bei "Rheinpersonal GmbH" eingestellt
    Wenn der Betreiber die Pflichtnachweise für einen Einsatz über "Elbe Zeitarbeit GmbH" prüft
    Dann deckt der Nachweis des anderen Kandidatensatzes nicht mit
    Und das Ergebnis der Prüfung P10 ist am Einsatzstart eine Sperre
    Und der Nachweis gehört dem Verleiher, der ihn eingestellt hat

  @p9 @grenzfall
  Szenario: Unterbrechung verkürzt nur den Prüfzeitraum
    Angenommen ein Einsatz über "Rheinpersonal GmbH" ist vom 01.04.2026 bis 30.06.2026 unterbrochen
    Wenn der Betreiber die Erlaubnis für den Einsatzzeitraum prüft
    Dann entfallen die Unterbrechungstage aus dem Prüfzeitraum, weil an ihnen keine Überlassung stattfindet
    Und die Drei-Monats-Regel der Überlassungskette ist für die Prüfungen P9 und P10 ohne Belang

  # ==================================================================
  # Fristablauf (SPEC 2.4 Regel 1, 4.7 Regel 2)
  # ==================================================================

  @frist-eskalation
  Szenario: Fristablauf genehmigt keinen Stundenzettel
    Angenommen der Stundenzettel "SZ-2026-03-002" steht seit dem 05.04.2026 im Status "inApproval"
    Und die Freigabefrist läuft gegen den Periodenschluss am 15.04.2026
    Und keine Freigabestufe hat bis zum 15.04.2026 entschieden
    Wenn die Frist am 16.04.2026 verstrichen ist
    Dann ist der Status des Stundenzettels unverändert "inApproval"
    Und eine Eskalation ist ausgelöst, zuerst an die Rolle der offenen Stufe, dann an deren Vertretung, dann an Einkauf und Controlling des Kunden, zuletzt an den MSP-Disponenten
    Und der Zettel ist nicht genehmigt und kann die Abrechnung der Periode blockieren
    Und jede Eskalationsstufe ist mit Anlass, Adressat und Zeitpunkt protokolliert

  @frist-eskalation
  Szenario: Fristablauf hebt eine AÜG-Sperre nicht auf
    Angenommen der Einsatzstart ist seit dem 01.03.2026 durch die Prüfung P9 gesperrt
    Und seither sind drei Monate vergangen, ohne dass eine Erlaubnis eingestellt wurde
    Wenn der MSP-Disponent den Einsatz am 01.06.2026 in den Status "active" überführen will
    Dann ist das Ergebnis der Prüfung P9 weiter eine Sperre
    Und der Status des Einsatzes ist weiter "planned"
    Und eine Sperre hebt sich nicht durch Zeitablauf auf

  # ==================================================================
  # Aufzeichnungspflichten (SPEC 5.4.7)
  # ==================================================================

  @protokoll
  Szenario: Jedes Prüfergebnis bleibt erhalten
    Angenommen zu einem Einsatz sind die Prüfungen P1, P4, P9 und P10 mit dem Ergebnis Information gelaufen
    Wenn der Betreiber die Prüfhistorie des Einsatzes auswertet
    Dann sind auch die Ergebnisse erhalten, die nichts bewirkt haben
    Und jeder Protokolleintrag nennt die Prüfung und das Ergebnis
    Und Nachweise bleiben mit Gültigkeitszeitraum und Anerkennungsvermerk erhalten, auch nach Ablauf
    Und jede Übersteuerung ist mit Begründung protokolliert
