# language: de
#
# Ausfuehrbare Fassung der AUEG-Regeln "Drehtuerklausel, Arbeitskampf,
# Kennzeichnung und Arbeitsverhaeltnis beim Verleiher" (SPEC 5.3).
#
# Quellen: SPEC 5.0 (Stichtag, fehlende Daten), SPEC 5.3 (Pruefungen P6, P7,
# P8 und P11), die Querschnittstabelle 4.7 (Q01, Q02, Q05, Q08, Q09, Q12,
# Q13, Q15, Q17, Q22, Q45, Q46, Q47) und SPEC 5.5 (Ergebnisarten,
# Uebersteuerung, naechtlicher Lauf N4).
#
# Lesart der Erwartungen (SPEC 4.7, 5.5.2):
#   Information - der Uebergang findet statt, das Ergebnis wird vermerkt
#   Warnung     - der Uebergang findet statt, Benachrichtigung und Eskalation
#   Sperre      - der Uebergang findet nicht statt, der Vorgang bleibt stehen
#
# Zur Drehtuerklausel: die Rechtsfolge eines Treffers ist Equal Pay ab dem
# ersten Ueberlassungstag, kein Einsatzverbot (SPEC 5.3.1). Gesperrt wird nur
# die fehlende Tatsachengrundlage, also die fehlende Erklaerung.
#
# Zum Arbeitskampf: Kapitel 3 fuehrt fuer die Arbeitskampfanzeige kein Feld
# und fuer die Zusicherung nach § 11 Abs. 5 Satz 2 AUEG kein Objekt; beide
# werden behelfsweise als Dokument mit documentCategory = other gefuehrt
# (SPEC 5.3.2, offene Frage 30). Die Szenarien benennen sie fachlich.
#
# Firmen, Personen und Datumsangaben sind synthetisch.
# Step-Definitions und Runner fehlen bewusst.

@spec-5.3
Funktionalität: Drehtürklausel, Arbeitskampf, Kennzeichnung und Arbeitsverhältnis

  Vier Regeln mit einem gemeinsamen Zeitpunkt: dem ersten Überlassungstag.
  Die Drehtürklausel nimmt dem Verleiher die tarifliche Abweichung, wenn der
  Leiharbeitnehmer in den letzten sechs Monaten beim Entleiher oder im Konzern
  ausgeschieden ist (§ 8 Abs. 3 AÜG). Das Einsatzverbot bei Arbeitskampf
  schützt den betroffenen Betrieb (§ 11 Abs. 5 AÜG). Kennzeichnung und
  Konkretisierung müssen vor Beginn der Überlassung vorliegen
  (§ 1 Abs. 1 Sätze 5 und 6 AÜG). Und ohne Arbeitsverhältnis beim Verleiher
  gibt es keine Überlassung (§ 1 Abs. 1 Satz 1 AÜG).

  Grundlage:
    Angenommen der Entleiher "Nordwerk Metall GmbH" gehört zum Konzernverbund "Nordwerk Gruppe" und führt den Standort "Werk Süd"
    Und der Lieferant "Rheinpersonal GmbH" ist aktiv und hat eine anerkannte, unbefristete AÜG-Erlaubnis
    Und zwischen Betreiber und "Rheinpersonal GmbH" besteht der Rahmenvertrag "RV-L-2026-004" im Status "active" mit Laufzeit vom 01.01.2026 bis 31.12.2027
    Und zu diesem Rahmenvertrag ist die Preisposition "PP-14" vereinbart
    Und der Kandidat "Miriam Falk" bei "Rheinpersonal GmbH" ist beschäftigt seit dem 01.08.2026
    Und außer der jeweils geprüften Regel liefert keine andere AÜG-Prüfung einen Befund
    Und die Angaben dieser Grundlage gelten, soweit ein Szenario nichts anderes sagt — Laufzeiten und Tarifparameter werden dort eigens gesetzt

  # ==================================================================
  # P6 — Drehtürklausel (SPEC 5.3.1)
  # ==================================================================

  @p6 @aueg-8-abs-3 @rechenweg
  Szenario: Rückschaufenster der Drehtürklausel
    Angenommen für "Miriam Falk" ist ein Überlassungsbeginn am 01.09.2026 vorgesehen
    Wenn der Betreiber die Drehtürklausel prüft
    Dann ist der Stichtag der 01.09.2026
    Und das Rückschaufenster reicht vom 01.03.2026 bis zum 31.08.2026

  # ---- Q08: Profilvorschlag submitted -> reviewed, Ergebnisart Warnung ----

  @q08 @p6 @information
  Szenario: Q08 Erklärung zur Vorbeschäftigung verneint ein früheres Arbeitsverhältnis
    Angenommen der Profilvorschlag "PV-2026-030" für "Miriam Falk" steht im Status "submitted" und nennt als verfügbar ab den 01.09.2026
    Und die Erklärung zur Vorbeschäftigung vom 10.08.2026 verneint ein Arbeitsverhältnis beim Entleiher und im Konzern
    Wenn der MSP-Disponent den Profilvorschlag in den Status "reviewed" überführt
    Dann ist das Ergebnis der Prüfung P6 eine Information ohne Treffer
    Und der Status des Profilvorschlags ist "reviewed"

  @q08 @p6 @warnung
  Szenario: Q08 Vorbeschäftigung beim Entleiher innerhalb des Fensters
    Angenommen der Profilvorschlag "PV-2026-031" für "Miriam Falk" steht im Status "submitted" und nennt als verfügbar ab den 01.09.2026
    Und die Erklärung zur Vorbeschäftigung nennt ein Arbeitsverhältnis bei "Nordwerk Metall GmbH", beendet am 30.04.2026
    Wenn der MSP-Disponent den Profilvorschlag in den Status "reviewed" überführt
    Dann ist das Ergebnis der Prüfung P6 ein Treffer und damit eine Warnung
    Und die Warnung nennt als Rechtsfolge Equal Pay ab dem ersten Überlassungstag
    Und der Status des Profilvorschlags ist "reviewed"

  @q08 @p6 @warnung
  Szenario: Q08 Erklärung zur Vorbeschäftigung fehlt
    Angenommen der Profilvorschlag "PV-2026-032" für "Miriam Falk" steht im Status "submitted" und nennt als verfügbar ab den 01.09.2026
    Und für den Kandidaten ist keine Erklärung zur Vorbeschäftigung erfasst
    Wenn der MSP-Disponent den Profilvorschlag in den Status "reviewed" überführt
    Dann ist die Prüfung P6 nicht prüfbar
    Und das Ergebnis ist eine Warnung mit Nennung des fehlenden Feldes "previousEmploymentDeclaration"
    Und die Warnung erreicht den Lieferantendisponenten über den MSP-Disponenten
    Und die Equal-Pay-Fälligkeit wird nicht vorgezogen, solange die Erklärung fehlt
    Und der Status des Profilvorschlags ist "reviewed"

  # ---- Q12: Profilvorschlag -> accepted, Warnung bei Treffer, Sperre ohne Erklärung ----

  @q12 @p6 @information
  Szenario: Q12 Zusage ohne Vorbeschäftigung
    Angenommen der Profilvorschlag "PV-2026-030" für "Miriam Falk" steht im Status "releasedToCustomer"
    Und die Erklärung zur Vorbeschäftigung verneint ein Arbeitsverhältnis beim Entleiher und im Konzern
    Wenn der Bedarfsträger zusagt und der MSP-Disponent den Status "accepted" setzt
    Dann ist das Ergebnis der Prüfung P6 eine Information
    Und der Status des Profilvorschlags ist "accepted"

  @q12 @p6 @warnung
  Szenario: Q12 Zusage bei greifender Drehtürklausel
    Angenommen der Profilvorschlag "PV-2026-031" für "Miriam Falk" steht im Status "releasedToCustomer"
    Und die Erklärung zur Vorbeschäftigung nennt ein Arbeitsverhältnis bei "Nordwerk Metall GmbH", beendet am 30.04.2026
    Und der vorgesehene Überlassungsbeginn ist der 01.09.2026
    Wenn der Bedarfsträger zusagt und der MSP-Disponent den Status "accepted" setzt
    Dann ist das Ergebnis der Prüfung P6 eine Warnung, keine Sperre
    Und die tarifliche Equal-Pay-Frist ist für diese Überlassung nicht anwendbar
    Und die Equal-Pay-Fälligkeit wird auf den Kettenbeginn gesetzt
    Und das Vergleichsentgelt ist damit ab dem ersten Überlassungstag Pflicht
    Und die Warnung geht an den MSP-Disponenten und an den Lieferantendisponenten
    Und der Status des Profilvorschlags ist "accepted"

  @q12 @p6 @sperre
  Szenario: Q12 Zusage ohne Erklärung zur Vorbeschäftigung wird gesperrt
    Angenommen der Profilvorschlag "PV-2026-032" für "Miriam Falk" steht im Status "releasedToCustomer"
    Und für den Kandidaten ist keine Erklärung zur Vorbeschäftigung erfasst
    Wenn der Bedarfsträger zusagt und der MSP-Disponent den Status "accepted" setzen will
    Dann ist das Ergebnis der Prüfung P6 eine Sperre
    Und der Grund der Sperre ist die fehlende Tatsachengrundlage, nicht die Drehtürklausel
    Und der Status des Profilvorschlags ist weiter "releasedToCustomer"
    Und die Sperre nennt als offenen Weg, dass der Verleiher die Erklärung einholt

  @q12 @p6 @keine-uebersteuerung
  Szenario: Q12 Übersteuerungsversuch wird zurückgewiesen
    Angenommen die Zusage zum Profilvorschlag "PV-2026-032" ist durch die Prüfung P6 gesperrt
    Wenn der MSP-Administrator die Sperre zu übersteuern versucht
    Dann wird die Übersteuerung zurückgewiesen, weil die Prüfung P6 nicht übersteuerbar ist
    Und die Sperre wird durch Beibringen der Erklärung aufgelöst
    Und der Status des Profilvorschlags ist weiter "releasedToCustomer"

  # ---- Q15: Einsatz -> planned, Warnung bei Treffer, Sperre ohne Erklärung ----

  @q15 @p6 @information
  Szenario: Q15 Einsatz anlegen ohne Vorbeschäftigung
    Angenommen für "Miriam Falk" soll ein Einsatz mit geplantem Beginn 01.09.2026 angelegt werden
    Und die Erklärung zur Vorbeschäftigung verneint ein Arbeitsverhältnis beim Entleiher und im Konzern
    Wenn der MSP-Disponent den Einsatz in den Status "planned" überführt
    Dann ist das Ergebnis der Prüfung P6 eine Information
    Und der Status des Einsatzes ist "planned"

  @q15 @p6 @warnung
  Szenario: Q15 Einsatz anlegen bei greifender Drehtürklausel
    Angenommen für "Miriam Falk" soll ein Einsatz mit geplantem Beginn 01.09.2026 angelegt werden
    Und die Erklärung zur Vorbeschäftigung nennt ein Arbeitsverhältnis bei "Nordwerk Metall GmbH", beendet am 30.04.2026
    Wenn der MSP-Disponent den Einsatz in den Status "planned" überführt
    Dann ist das Ergebnis der Prüfung P6 eine Warnung
    Und die Equal-Pay-Fälligkeit des Einsatzes ist der erste Überlassungstag
    Und der Status des Einsatzes ist "planned"

  @q15 @p6 @sperre
  Szenario: Q15 Einsatz anlegen ohne Erklärung wird gesperrt
    Angenommen für "Miriam Falk" soll ein Einsatz mit geplantem Beginn 01.09.2026 angelegt werden
    Und für den Kandidaten ist keine Erklärung zur Vorbeschäftigung erfasst
    Wenn der MSP-Disponent den Einsatz in den Status "planned" überführen will
    Dann ist das Ergebnis der Prüfung P6 eine Sperre
    Und es entsteht kein Einsatz im Status "planned"
    Und ein Protokolleintrag mit der Prüfung "revolvingDoorCheck" und dem Ergebnis "blocked" liegt vor

  @q15 @p6 @sperre @grenzfall
  Szenario: Q15 Erklärung "ja" ohne Datum ist nicht prüfbar
    Angenommen für "Miriam Falk" soll ein Einsatz mit geplantem Beginn 01.09.2026 angelegt werden
    Und die Erklärung zur Vorbeschäftigung bejaht ein früheres Arbeitsverhältnis, nennt aber kein Ende
    Wenn der MSP-Disponent den Einsatz in den Status "planned" überführen will
    Dann ist die Prüfung P6 nicht prüfbar
    Und das Ergebnis ist eine Sperre
    Und die Sperre nennt die unvollständige Erklärung

  @q15 @p6 @keine-uebersteuerung
  Szenario: Q15 Übersteuerungsversuch wird zurückgewiesen
    Angenommen das Anlegen des Einsatzes für "Miriam Falk" ist durch die Prüfung P6 gesperrt
    Wenn der MSP-Administrator die Sperre zu übersteuern versucht
    Dann wird die Übersteuerung zurückgewiesen, weil die Prüfung P6 nicht übersteuerbar ist
    Und es entsteht kein Einsatz im Status "planned"

  # ---- Grenzfälle der Drehtürklausel ----

  @p6 @grenzfall
  Szenariogrundriss: Austrittsdatum am Rand des Rückschaufensters
    Angenommen für "Miriam Falk" ist ein Überlassungsbeginn am 01.09.2026 vorgesehen
    Und die Erklärung zur Vorbeschäftigung nennt ein Arbeitsverhältnis bei "Nordwerk Metall GmbH", beendet am <austritt>
    Wenn der Betreiber die Drehtürklausel prüft
    Dann ist das Ergebnis "<ergebnis>"

    Beispiele:
      | austritt   | ergebnis                                      |
      | 01.03.2026 | Treffer, der Tag liegt im Fenster             |
      | 28.02.2026 | kein Treffer, Information mit Austrittsdatum  |
      | 31.08.2026 | Treffer, letzter Tag des Fensters              |

  @p6 @grenzfall
  Szenario: Verschobener Starttermin lässt einen Treffer entfallen
    Angenommen die Erklärung zur Vorbeschäftigung nennt ein Arbeitsverhältnis bei "Nordwerk Metall GmbH", beendet am 30.04.2026
    Und der geplante Beginn des Einsatzes wird vom 01.09.2026 auf den 01.12.2026 verschoben
    Wenn der Betreiber die Drehtürklausel zum neuen Beginn prüft
    Dann reicht das Rückschaufenster vom 01.06.2026 bis zum 30.11.2026
    Und das Ergebnis ist kein Treffer, sondern eine Information mit Nennung des Austrittsdatums
    Und das frühere Prüfergebnis am Vorgang wird ersetzt, nicht ergänzt

  @p6 @warnung @grenzfall
  Szenario: Vorbeschäftigung bei einem Unternehmen desselben Konzerns
    Angenommen für "Miriam Falk" ist ein Überlassungsbeginn am 01.09.2026 bei "Nordwerk Metall GmbH" vorgesehen
    Und die Erklärung zur Vorbeschäftigung nennt ein Arbeitsverhältnis bei "Nordwerk Service GmbH", beendet am 31.05.2026
    Und "Nordwerk Service GmbH" gehört zum Konzernverbund "Nordwerk Gruppe"
    Wenn der Betreiber die Drehtürklausel prüft
    Dann ist das Ergebnis ein Treffer und damit eine Warnung
    Und die Rechtsfolge ist Equal Pay ab dem ersten Überlassungstag

  @p6 @grenzfall
  Szenario: Konzernzugehörigkeit des Entleihers ist nicht gepflegt
    Angenommen beim Kunden "Nordwerk Metall GmbH" ist kein Konzernverbund gepflegt
    Und die Erklärung zur Vorbeschäftigung nennt ein Arbeitsverhältnis bei "Nordwerk Service GmbH", beendet am 31.05.2026
    Wenn der Betreiber die Drehtürklausel prüft
    Dann wird nur der Entleiher selbst geprüft
    Und das Ergebnis trägt die Information, dass die Konzernbetrachtung nicht möglich war
    Und diese Information ist an den MSP-Administrator adressiert

  @p6 @grenzfall
  Szenario: Lieferantenwechsel verlangt eine neue Erklärung
    Angenommen "Miriam Falk" war über "Rheinpersonal GmbH" bei "Nordwerk Metall GmbH" überlassen und dieser Einsatz endet am 31.10.2026
    Und für den Kandidatensatz bei "Rheinpersonal GmbH" liegt eine Erklärung zur Vorbeschäftigung vor
    Und ein neuer Einsatz über "Elbe Zeitarbeit GmbH" soll am 01.11.2026 beginnen
    Wenn der MSP-Disponent den neuen Einsatz in den Status "planned" überführen will
    Dann ist für den Kandidatensatz bei "Elbe Zeitarbeit GmbH" eine eigene Erklärung erforderlich
    Und der neue Überlassungsbeginn eröffnet ein neues Rückschaufenster vom 01.05.2026 bis zum 31.10.2026
    Und ohne eigene Erklärung ist das Ergebnis der Prüfung P6 eine Sperre

  @p6 @warnung @grenzfall @rueckwirkend
  Szenario: Nachträglich korrigiertes Austrittsdatum lässt die Drehtür greifen
    Angenommen ein Einsatz von "Miriam Falk" läuft seit dem 01.09.2026 im Status "active"
    Und das Austrittsdatum in der Erklärung zur Vorbeschäftigung wird am 15.11.2026 von 31.01.2026 auf 30.04.2026 berichtigt
    Wenn der Lieferantendisponent die Berichtigung speichert
    Dann rückt die Equal-Pay-Fälligkeit auf den Kettenbeginn
    Und das Ergebnis ist eine Warnung mit Pflicht-Eskalation an den MSP-Administrator und an Einkauf und Controlling des Kunden
    Und es gibt keine Sperre und keine Entwertung abgerechneter Zeiten

  @p6 @information @grenzfall
  Szenario: Drehtürprüfung läuft auch ohne Tarifzuordnung
    Angenommen für den Lieferanten "Rheinpersonal GmbH" ist am Stichtag keine Tarifzuordnung gültig
    Und die Erklärung zur Vorbeschäftigung nennt ein Arbeitsverhältnis bei "Nordwerk Metall GmbH", beendet am 30.04.2026
    Wenn der Betreiber die Drehtürklausel prüft
    Dann gilt Equal Pay ohnehin ab dem ersten Überlassungstag
    Und die Prüfung P6 läuft trotzdem und dokumentiert den Grund

  @p6 @grenzfall
  Szenario: Drehtürprüfung hängt nicht an der Personenidentität
    Angenommen für den Kandidaten "Miriam Falk" ist keine bestätigte Personenidentität geführt
    Und die Erklärung zur Vorbeschäftigung liegt vor und verneint ein früheres Arbeitsverhältnis
    Wenn der Betreiber die Drehtürklausel prüft
    Dann ist das Ergebnis eine Information ohne Treffer
    Und die fehlende Personenidentität ist für die Prüfung P6 ohne Belang
    Und das System führt keinen Abgleich gegen Personaldaten des Entleihers

  # ==================================================================
  # P7 — Einsatzverbot bei Arbeitskampf (SPEC 5.3.2)
  # ==================================================================

  # ---- Q05: Bedarfsanfrage approved -> tendered, Ergebnisart Warnung ----

  @q05 @p7 @aueg-11-abs-5 @information
  Szenario: Q05 Keine Arbeitskampfanzeige am Standort
    Angenommen die Bedarfsanfrage "BA-2026-010" für den Standort "Werk Süd" steht im Status "approved"
    Und die Ausschreibung ist mit der Angebotsfrist 20.08.2026 veröffentlicht
    Und für den Standort "Werk Süd" liegt keine Arbeitskampfanzeige vor
    Wenn der MSP-Disponent die Bedarfsanfrage in den Status "tendered" überführt
    Dann ist das Ergebnis der Prüfung P7 eine Information
    Und der Status der Bedarfsanfrage ist "tendered"

  @q05 @p7 @warnung
  Szenario: Q05 Arbeitskampf am Standort während der Angebotsfrist
    Angenommen die Bedarfsanfrage "BA-2026-011" für den Standort "Werk Süd" steht im Status "approved"
    Und der Übergang wird am 10.08.2026 ausgelöst und die Angebotsfrist endet am 20.08.2026
    Und für den Standort "Werk Süd" ist eine Arbeitskampfanzeige vom 12.08.2026 bis 18.08.2026 erfasst
    Wenn der MSP-Disponent die Bedarfsanfrage in den Status "tendered" überführt
    Dann deckt die Anzeige Tage des Prüfzeitraums vom 10.08.2026 bis 20.08.2026 ab
    Und das Ergebnis der Prüfung P7 ist eine Warnung
    Und der Status der Bedarfsanfrage ist "tendered"
    Und die Sperre greift erst beim Einsatzstart

  # ---- Q22: Einsatz planned -> active, Ergebnisart Sperre ----

  @q22 @p7 @information
  Szenario: Q22 Einsatzstart ohne Arbeitskampfanzeige
    Angenommen ein Einsatz von "Miriam Falk" am Standort "Werk Süd" steht im Status "planned" mit tatsächlichem Beginn 01.09.2026
    Und für den Standort liegt keine Arbeitskampfanzeige vor
    Wenn der MSP-Disponent den Einsatz in den Status "active" überführt
    Dann ist das Ergebnis der Prüfung P7 eine Information
    Und der Status des Einsatzes ist "active"

  @q22 @p7 @sperre
  Szenario: Q22 Einsatzstart im Arbeitskampf ohne Zusicherung wird gesperrt
    Angenommen ein Einsatz von "Miriam Falk" am Standort "Werk Süd" steht im Status "planned" mit tatsächlichem Beginn 15.09.2026
    Und für den Standort ist eine Arbeitskampfanzeige vom 10.09.2026 bis 20.09.2026 mit den betroffenen Bereichen erfasst, die die Tätigkeit des Einsatzes umfassen
    Und für diesen Einsatz liegt keine Zusicherung nach § 11 Abs. 5 Satz 2 AÜG vor
    Wenn der MSP-Disponent den Einsatz in den Status "active" überführen will
    Dann ist das Ergebnis der Prüfung P7 eine Sperre
    Und der Status des Einsatzes ist weiter "planned"
    Und die Sperre nennt als offene Wege die Zusicherung des Entleihers oder einen späteren Start
    Und ein Protokolleintrag mit der Prüfung "industrialActionCheck" und dem Ergebnis "blocked" liegt vor

  @q22 @p7 @warnung
  Szenario: Q22 Zusicherung des Entleihers lässt den Einsatzstart zu
    Angenommen ein Einsatz von "Miriam Falk" am Standort "Werk Süd" steht im Status "planned" mit tatsächlichem Beginn 15.09.2026
    Und für den Standort ist eine Arbeitskampfanzeige vom 10.09.2026 bis 20.09.2026 erfasst
    Und für diesen Einsatz liegt eine Zusicherung nach § 11 Abs. 5 Satz 2 AÜG mit Datum und erklärender Person vor, die den 15.09.2026 abdeckt
    Wenn der MSP-Disponent den Einsatz in den Status "active" überführt
    Dann ist das Ergebnis der Prüfung P7 eine Warnung statt eines Treffers
    Und der Status des Einsatzes ist "active"
    Und der Sachverhalt bleibt sichtbar und wird eskaliert, solange der Arbeitskampf läuft

  @q22 @p7 @keine-uebersteuerung
  Szenario: Q22 Übersteuerungsversuch wird zurückgewiesen
    Angenommen der Einsatzstart am 15.09.2026 ist durch die Prüfung P7 gesperrt
    Wenn der MSP-Administrator die Sperre zu übersteuern versucht
    Dann wird die Übersteuerung zurückgewiesen, weil die Prüfung P7 nicht übersteuerbar ist
    Und die gesetzliche Ausnahme ist allein die Zusicherung nach § 11 Abs. 5 Satz 2 AÜG
    Und der Status des Einsatzes ist weiter "planned"

  # ---- Grenzfälle Arbeitskampf ----

  @q22 @p7 @sperre @grenzfall
  Szenario: Q22 Einsatzstart am letzten Tag der Anzeige
    Angenommen ein Einsatz von "Miriam Falk" steht im Status "planned" mit tatsächlichem Beginn 20.09.2026
    Und für den Standort ist eine Arbeitskampfanzeige vom 10.09.2026 bis 20.09.2026 erfasst und keine Zusicherung vorhanden
    Wenn der MSP-Disponent den Einsatz in den Status "active" überführen will
    Dann ist der 20.09.2026 ein betroffener Tag
    Und das Ergebnis der Prüfung P7 ist eine Sperre
    Und der Status des Einsatzes ist weiter "planned"

  @q22 @p7 @information @grenzfall
  Szenario: Q22 Einsatzstart am Tag nach dem Ende der Anzeige
    Angenommen ein Einsatz von "Miriam Falk" steht im Status "planned" mit tatsächlichem Beginn 21.09.2026
    Und für den Standort ist eine Arbeitskampfanzeige vom 10.09.2026 bis 20.09.2026 erfasst
    Wenn der MSP-Disponent den Einsatz in den Status "active" überführt
    Dann ist das Ergebnis der Prüfung P7 eine Information
    Und der Status des Einsatzes ist "active"

  @p7 @warnung @grenzfall
  Szenario: Anzeige ohne Bis-Datum bleibt wirksam
    Angenommen für den Standort "Werk Süd" ist eine Arbeitskampfanzeige ab dem 10.09.2026 ohne Enddatum erfasst
    Und ein Einsatz von "Miriam Falk" an diesem Standort steht im Status "active"
    Wenn der nächtliche Lauf am 25.09.2026 läuft
    Dann ist der Prüfzeitraum bis auf Weiteres betroffen
    Und die offene Anzeige wird täglich als Warnung geführt, solange ein betroffener Einsatz besteht
    Und das Ende der Anzeige ist vom Entleiher nachzutragen

  @q22 @p7 @warnung @grenzfall
  Szenario: Nur ein Teil des Betriebs ist betroffen
    Angenommen ein Einsatz von "Miriam Falk" mit der Tätigkeit "Instandhaltung Stufe 3" steht im Status "planned" mit tatsächlichem Beginn 15.09.2026
    Und die Arbeitskampfanzeige vom 10.09.2026 bis 20.09.2026 nennt nur den Bereich "Montage"
    Wenn der MSP-Disponent den Einsatz in den Status "active" überführt
    Dann ist das Ergebnis der Prüfung P7 eine Warnung statt eines Treffers
    Und die Beurteilung der unmittelbaren Betroffenheit bleibt eine Entscheidung des Entleihers
    Und der Status des Einsatzes ist "active"

  @p7 @warnung @grenzfall @rueckwirkend
  Szenario: Rückwirkend angezeigter Arbeitskampf
    Angenommen ein Einsatz von "Miriam Falk" lief vom 01.09.2026 bis 30.09.2026
    Und am 10.10.2026 wird eine Arbeitskampfanzeige für den Zeitraum vom 10.09.2026 bis 20.09.2026 nachgetragen
    Wenn der Entleiher die Anzeige erfasst
    Dann ist das Ergebnis eine Warnung mit Pflicht-Eskalation an den MSP-Administrator
    Und eine Sperre greift nicht mehr
    Und genehmigte Zeiten werden nicht entwertet

  @p7 @information @grenzfall
  Szenario: Ohne Anzeige kein Treffer — die einzige Ausnahme vom Grundsatz
    Angenommen für den Standort "Werk Süd" ist keine Arbeitskampfanzeige erfasst
    Und tatsächlich läuft an diesem Standort ein Arbeitskampf, den niemand gemeldet hat
    Wenn der MSP-Disponent einen Einsatz in den Status "active" überführt
    Dann ist das Ergebnis der Prüfung P7 eine Information ohne Treffer
    Und die fehlende Anzeige wirkt hier nicht wie ein Treffer
    Und die Regel ist nur so gut wie die Meldedisziplin des Entleihers

  @p7 @grenzfall
  Szenario: Lieferantenwechsel ist für den Arbeitskampf ohne Belang
    Angenommen für den Standort "Werk Süd" ist eine Arbeitskampfanzeige vom 10.09.2026 bis 20.09.2026 erfasst
    Und ein neuer Einsatz derselben Person über "Elbe Zeitarbeit GmbH" soll am 15.09.2026 an diesem Standort beginnen
    Wenn der MSP-Disponent den neuen Einsatz in den Status "active" überführen will
    Dann wird die Prüfung P7 standort- und entleiherbezogen erneut gerechnet
    Und das Ergebnis ist ohne Zusicherung eine Sperre

  @nachtlauf @p7 @warnung
  Szenario: N4 Arbeitskampf beginnt während eines laufenden Einsatzes
    Angenommen ein Einsatz von "Miriam Falk" am Standort "Werk Süd" steht im Status "active"
    Und für den Standort ist eine Arbeitskampfanzeige ab dem 10.09.2026 erfasst
    Wenn der nächtliche Lauf am 10.09.2026 läuft
    Dann ist das Ergebnis der Prüfung P7 eine Warnung mit Pflicht-Eskalation an den MSP-Disponenten und den MSP-Administrator
    Und die Unterbrechung des Einsatzes wird vorgeschlagen
    Und das System unterbricht den Einsatz nicht selbst
    Und der Status des Einsatzes bleibt "active"

  # ==================================================================
  # P8 — Kennzeichnungs- und Konkretisierungspflicht (SPEC 5.3.3)
  # ==================================================================

  # ---- Q01, Q02: Bedarfsanfrage, Ergebnisart Information / Warnung ----

  @q01 @p8 @aueg-1-abs-1-satz-5 @information
  Szenario: Q01 Tätigkeitsbeschreibung ist vorhanden und eigenständig
    Angenommen die Bedarfsanfrage "BA-2026-020" steht im Status "draft"
    Und ihr Titel ist "Zerspanung Werk Süd" und ihre Tätigkeitsbeschreibung beschreibt Aufgaben, Maschinen und Schichtlage eigenständig
    Und sie nennt mindestens eine Qualifikationsanforderung
    Wenn der Bedarfsträger die Bedarfsanfrage in den Status "submitted" überführt
    Dann ist das Ergebnis der Prüfung P8 eine Information
    Und der Status der Bedarfsanfrage ist "submitted"

  @q01 @p8 @information
  Szenario: Q01 Tätigkeitsbeschreibung ist mit dem Titel identisch
    Angenommen die Bedarfsanfrage "BA-2026-021" steht im Status "draft"
    Und ihr Titel und ihre Tätigkeitsbeschreibung lauten beide "Zerspanung Werk Süd"
    Wenn der Bedarfsträger die Bedarfsanfrage in den Status "submitted" überführt
    Dann ist das Ergebnis der Prüfung P8 eine Information mit Nennung des nicht erfüllten Kriteriums
    Und der Status der Bedarfsanfrage ist "submitted"
    Und die Bedarfsanfrage ist kein Überlassungsvertrag

  @q02 @p8 @information
  Szenario: Q02 Freigabe mit konkreter Tätigkeitsbeschreibung
    Angenommen die Bedarfsanfrage "BA-2026-020" steht im Status "submitted" mit eigenständiger Tätigkeitsbeschreibung und einer Qualifikationsanforderung
    Wenn der Genehmiger die Bedarfsanfrage in den Status "approved" überführt
    Dann ist das Ergebnis der Prüfung P8 eine Information
    Und der Status der Bedarfsanfrage ist "approved"

  @q02 @p8 @warnung
  Szenario: Q02 Freigabe ohne eigenständige Tätigkeitsbeschreibung
    Angenommen die Bedarfsanfrage "BA-2026-021" steht im Status "submitted"
    Und ihr Titel und ihre Tätigkeitsbeschreibung sind identisch
    Wenn der Genehmiger die Bedarfsanfrage in den Status "approved" überführt
    Dann ist das Ergebnis der Prüfung P8 eine Warnung
    Und die Warnung nennt das geprüfte Kriterium, nicht eine Beurteilung des Inhalts
    Und der Status der Bedarfsanfrage ist "approved"

  # ---- Q45: Einsatz -> planned, Kriterien K1 bis K4, Ergebnisart Sperre ----

  @q45 @p8 @information
  Szenario: Q45 Kennzeichnung und Konkretisierung sind beim Anlegen vollständig
    Angenommen für "Miriam Falk" soll ein Einsatz mit geplantem Beginn 01.09.2026 und geplantem Ende 31.12.2026 angelegt werden
    Und der Einsatz verweist über die Preisposition "PP-14" auf den aktiven Rahmenvertrag "RV-L-2026-004" der Lieferantenseite
    Und der Einsatz nennt den Kandidaten, eine eigenständige Tätigkeitsbeschreibung, den Standort "Werk Süd" und den geplanten Beginn
    Wenn der MSP-Disponent den Einsatz in den Status "planned" überführt
    Dann sind die Kriterien K1 bis K4 erfüllt
    Und das Ergebnis der Prüfung P8 ist eine Information
    Und das Ergebnis nennt die geprüften Kriterien, nicht die Aussage, die Konkretisierung sei inhaltlich erfüllt
    Und der Status des Einsatzes ist "planned"

  @q45 @p8 @sperre
  Szenariogrundriss: Q45 Fehlendes Kriterium sperrt das Anlegen
    Angenommen für "Miriam Falk" soll ein Einsatz mit geplantem Beginn 01.09.2026 angelegt werden
    Und das Kriterium "<kriterium>" ist nicht erfüllt, weil <lage>
    Wenn der MSP-Disponent den Einsatz in den Status "planned" überführen will
    Dann ist das Ergebnis der Prüfung P8 eine Sperre
    Und es entsteht kein Einsatz im Status "planned"
    Und die Sperre nennt das Kriterium "<kriterium>" und den offenen Weg, die Angabe nachzutragen

    Beispiele:
      | kriterium              | lage                                                                        |
      | K1 Kennzeichnung       | der Rahmenvertrag der Lieferantenseite steht im Status "terminated"         |
      | K2 Person              | am Einsatz ist kein Kandidat gesetzt                                        |
      | K3 Tätigkeit           | die Tätigkeitsbeschreibung ist mit dem Titel der Bedarfsanfrage identisch    |
      | K4 Ort und Zeit        | am Einsatz ist kein Standort gesetzt                                        |

  @q45 @p8 @keine-uebersteuerung
  Szenario: Q45 Übersteuerungsversuch wird zurückgewiesen
    Angenommen das Anlegen des Einsatzes ist durch die Prüfung P8 gesperrt
    Wenn der MSP-Administrator die Sperre zu übersteuern versucht
    Dann wird die Übersteuerung zurückgewiesen, weil die Prüfung P8 nicht übersteuerbar ist
    Und die Konkretisierung wird nachgetragen, nicht übersteuert

  @q45 @p8 @warnung @grenzfall
  Szenario: Q45 Rahmenvertrag endet vor dem geplanten Ende des Einsatzes
    Angenommen für "Miriam Falk" soll ein Einsatz vom 01.09.2026 bis 30.06.2028 angelegt werden
    Und der Rahmenvertrag "RV-L-2026-004" der Lieferantenseite endet am 31.12.2027
    Wenn der MSP-Disponent den Einsatz in den Status "planned" überführt
    Dann ist das Ergebnis der Prüfung P8 eine Warnung mit Nennung des Enddatums 31.12.2027
    Und der Status des Einsatzes ist "planned"
    Und die Kennzeichnung lag bei Beginn vor und der Vertrag kann verlängert werden

  @q45 @p8 @sperre @grenzfall
  Szenario: Q45 Fehlende Preisposition macht die Kennzeichnung nicht prüfbar
    Angenommen für "Miriam Falk" soll ein Einsatz mit geplantem Beginn 01.09.2026 angelegt werden
    Und am Einsatz ist keine vereinbarte Preisposition der Einkaufsseite gesetzt
    Wenn der MSP-Disponent den Einsatz in den Status "planned" überführen will
    Dann ist das Kriterium K1 nicht prüfbar
    Und das Ergebnis der Prüfung P8 wirkt wie ein Treffer und ist eine Sperre
    Und die Sperre nennt das fehlende Feld "agreedRateCardItemRef" als Datenfehler

  @q45 @p8 @information @grenzfall
  Szenario: Q45 Einsatz ohne vorangegangene Bedarfsanfrage
    Angenommen für "Miriam Falk" soll ein Einsatz ohne Bezug zu einer Bedarfsanfrage angelegt werden
    Und der Einsatz nennt eine eigenständige Tätigkeitsbeschreibung, Kandidat, Standort, Beginn und die Preisposition "PP-14"
    Wenn der MSP-Disponent den Einsatz in den Status "planned" überführt
    Dann prüft das Kriterium K3 nur, ob die Tätigkeitsbeschreibung gesetzt und nicht leer ist
    Und der Vergleich mit dem Titel einer Bedarfsanfrage entfällt
    Und das Ergebnis der Prüfung P8 ist eine Information

  # ---- Q46: Einsatz planned -> active, Kriterium K5, Ergebnisart Sperre ----

  @q46 @p8 @information
  Szenario: Q46 Konkretisierung lag vor dem ersten Überlassungstag vollständig vor
    Angenommen ein Einsatz von "Miriam Falk" wurde am 25.08.2026 in den Status "planned" überführt
    Und der tatsächliche Beginn ist der 01.09.2026
    Und die Kriterien K1 bis K4 sind am 01.09.2026 weiterhin erfüllt
    Wenn der MSP-Disponent den Einsatz in den Status "active" überführt
    Dann ist das Kriterium K5 erfüllt
    Und das Ergebnis der Prüfung P8 ist eine Information
    Und der Status des Einsatzes ist "active"

  @q46 @p8 @information @grenzfall
  Szenario: Q46 Übergang nach "planned" am ersten Überlassungstag genügt
    Angenommen ein Einsatz von "Miriam Falk" wurde am 01.09.2026 in den Status "planned" überführt
    Und der tatsächliche Beginn ist der 01.09.2026
    Und der Übergang nach "active" erfolgt nach dem Übergang nach "planned"
    Wenn der MSP-Disponent den Einsatz in den Status "active" überführt
    Dann ist das Kriterium K5 erfüllt, weil das System die Tagesreihenfolge und nicht die Uhrzeit des Vertrags beurteilt
    Und das Ergebnis der Prüfung P8 ist eine Information

  @q46 @p8 @sperre
  Szenario: Q46 Konkretisierung erst nach dem ersten Überlassungstag
    Angenommen ein Einsatz von "Miriam Falk" wurde am 05.09.2026 in den Status "planned" überführt
    Und der tatsächliche Beginn ist der 01.09.2026
    Wenn der MSP-Disponent den Einsatz in den Status "active" überführen will
    Dann ist das Kriterium K5 nicht erfüllt
    Und das Ergebnis der Prüfung P8 ist eine Sperre
    Und der Status des Einsatzes ist weiter "planned"
    Und nach dem ersten Überlassungstag ist der Verstoß nicht mehr heilbar

  @q46 @p8 @sperre
  Szenario: Q46 Rahmenvertrag ist zwischen Anlage und Start beendet
    Angenommen ein Einsatz von "Miriam Falk" steht im Status "planned" mit tatsächlichem Beginn 01.09.2026
    Und der Rahmenvertrag "RV-L-2026-004" der Lieferantenseite wurde am 20.08.2026 gekündigt und steht nicht mehr im Status "active"
    Wenn der MSP-Disponent den Einsatz in den Status "active" überführen will
    Dann werden die Kriterien K1 bis K4 erneut geprüft
    Und das Ergebnis der Prüfung P8 ist eine Sperre wegen des Kriteriums K1
    Und der Status des Einsatzes ist weiter "planned"

  @q46 @p8 @keine-uebersteuerung
  Szenario: Q46 Übersteuerungsversuch am Einsatzstart wird zurückgewiesen
    Angenommen der Einsatzstart ist durch die Prüfung P8 gesperrt
    Wenn der MSP-Administrator die Sperre zu übersteuern versucht
    Dann wird die Übersteuerung zurückgewiesen, weil die Prüfung P8 nicht übersteuerbar ist
    Und der Status des Einsatzes ist weiter "planned"

  @p8 @grenzfall @rueckwirkend
  Szenario: Nachträglich geänderte Tätigkeitsbeschreibung löst beide Prüfungen aus
    Angenommen ein Einsatz von "Miriam Falk" läuft seit dem 01.09.2026 im Status "active"
    Und die Tätigkeitsbeschreibung wird am 15.10.2026 geändert
    Wenn der MSP-Disponent die Änderung mit Begründung speichert
    Dann laufen die Prüfungen P8 und P4 erneut
    Und ein in der Vergangenheit erfüllter Verstoß wird festgestellt und eskaliert, nicht rückwirkend gesperrt
    Und die geänderte Tätigkeit kann einen anderen Vergleichsentgelt-Eintrag treffen

  @p8 @abgrenzung
  Szenario: Das System kennt nur erklärte Arbeitnehmerüberlassung
    Angenommen ein Einsatz ist im VMS angelegt
    Wenn der Betreiber die Kennzeichnung prüft
    Dann ist der Einsatz damit als Arbeitnehmerüberlassung erklärt
    Und ein Werk- oder Dienstvertrag kann im VMS nicht entstehen
    Und eine verdeckte Überlassung außerhalb des VMS kann das System nicht erkennen

  # ==================================================================
  # P11 — Arbeitsverhältnis beim Verleiher (SPEC 5.3.4)
  # ==================================================================

  # ---- Q09, Q13, Q17: Vorprüfungen, Ergebnisart Warnung ----

  @q09 @p11 @aueg-1-abs-1-satz-1 @information
  Szenario: Q09 Kandidat ist beim Verleiher beschäftigt
    Angenommen der Profilvorschlag "PV-2026-040" für "Miriam Falk" steht im Status "submitted" und nennt als verfügbar ab den 01.09.2026
    Und der Kandidat ist beschäftigt seit dem 01.08.2026
    Wenn der MSP-Disponent den Profilvorschlag in den Status "reviewed" überführt
    Dann ist das Ergebnis der Prüfung P11 eine Information
    Und der Status des Profilvorschlags ist "reviewed"

  @q09 @p11 @warnung
  Szenario: Q09 Kandidat ist Bewerber beim Verleiher
    Angenommen der Profilvorschlag "PV-2026-041" für den Kandidaten "Lennart Voß" steht im Status "submitted" und nennt als verfügbar ab den 01.09.2026
    Und das Beschäftigungsverhältnis beim Lieferanten ist "applicant"
    Wenn der MSP-Disponent den Profilvorschlag in den Status "reviewed" überführt
    Dann ist das Ergebnis der Prüfung P11 eine Warnung
    Und die Warnung nennt die Folge, dass bis zum Einsatzstart ein Arbeitsverhältnis nachzuweisen ist
    Und der Status des Profilvorschlags ist "reviewed"

  @q09 @p11 @warnung
  Szenario: Q09 Arbeitsverhältnis beginnt nach dem vorgesehenen Überlassungsbeginn
    Angenommen der Profilvorschlag "PV-2026-042" für "Miriam Falk" steht im Status "submitted" und nennt als verfügbar ab den 01.09.2026
    Und der Kandidat ist beschäftigt seit dem 15.09.2026
    Wenn der MSP-Disponent den Profilvorschlag in den Status "reviewed" überführt
    Dann ist das Ergebnis der Prüfung P11 eine Warnung
    Und die Warnung nennt, dass das Arbeitsverhältnis nach dem vorgesehenen Überlassungsbeginn beginnt
    Und der Status des Profilvorschlags ist "reviewed"

  @q09 @p11 @warnung @grenzfall
  Szenario: Q09 Angaben zum Beschäftigungsverhältnis fehlen
    Angenommen der Profilvorschlag "PV-2026-043" für den Kandidaten "Lennart Voß" steht im Status "submitted"
    Und am Kandidaten ist kein Beschäftigungsverhältnis beim Lieferanten erfasst
    Wenn der MSP-Disponent den Profilvorschlag in den Status "reviewed" überführt
    Dann wirkt die fehlende Angabe wie ein Treffer
    Und das Ergebnis der Prüfung P11 ist eine Warnung mit Nennung des fehlenden Feldes
    Und der Status des Profilvorschlags ist "reviewed"

  @q13 @p11 @information
  Szenario: Q13 Zusage für einen beschäftigten Kandidaten
    Angenommen der Profilvorschlag "PV-2026-040" für "Miriam Falk" steht im Status "releasedToCustomer"
    Und der Kandidat ist beschäftigt seit dem 01.08.2026, der vorgesehene Beginn ist der 01.09.2026
    Wenn der Bedarfsträger zusagt und der MSP-Disponent den Status "accepted" setzt
    Dann ist das Ergebnis der Prüfung P11 eine Information
    Und der Status des Profilvorschlags ist "accepted"

  @q13 @p11 @warnung
  Szenario: Q13 Zusage für einen Bewerber ist zulässig
    Angenommen der Profilvorschlag "PV-2026-041" für "Lennart Voß" steht im Status "releasedToCustomer"
    Und das Beschäftigungsverhältnis beim Lieferanten ist "applicant"
    Wenn der Bedarfsträger zusagt und der MSP-Disponent den Status "accepted" setzt
    Dann ist das Ergebnis der Prüfung P11 eine Warnung, keine Sperre
    Und der Status des Profilvorschlags ist "accepted"
    Und die Sperre greift erst am Einsatzstart

  @q17 @p11 @information
  Szenario: Q17 Einsatz anlegen für einen beschäftigten Kandidaten
    Angenommen für "Miriam Falk" soll ein Einsatz mit geplantem Beginn 01.09.2026 angelegt werden
    Und der Kandidat ist beschäftigt seit dem 01.08.2026
    Wenn der MSP-Disponent den Einsatz in den Status "planned" überführt
    Dann ist das Ergebnis der Prüfung P11 eine Information
    Und der Status des Einsatzes ist "planned"

  @q17 @p11 @warnung
  Szenario: Q17 Einsatz anlegen für einen Bewerber ist zulässig
    Angenommen für "Lennart Voß" soll ein Einsatz mit geplantem Beginn 01.09.2026 angelegt werden
    Und das Beschäftigungsverhältnis beim Lieferanten ist "applicant"
    Wenn der MSP-Disponent den Einsatz in den Status "planned" überführt
    Dann ist das Ergebnis der Prüfung P11 eine Warnung
    Und der Einsatz wird geplant, nicht begonnen
    Und der Status des Einsatzes ist "planned"

  # ---- Q47: Einsatz planned -> active, Ergebnisart Sperre (neu, 5.5.5) ----

  @q47 @p11 @information
  Szenario: Q47 Arbeitsverhältnis besteht am ersten Überlassungstag
    Angenommen ein Einsatz von "Miriam Falk" steht im Status "planned" mit tatsächlichem Beginn 01.09.2026
    Und der Kandidat ist beschäftigt seit dem 01.08.2026
    Wenn der MSP-Disponent den Einsatz in den Status "active" überführt
    Dann ist das Ergebnis der Prüfung P11 eine Information
    Und der Status des Einsatzes ist "active"

  @q47 @p11 @information @grenzfall
  Szenario: Q47 Arbeitsverhältnis beginnt genau am ersten Überlassungstag
    Angenommen ein Einsatz von "Miriam Falk" steht im Status "planned" mit tatsächlichem Beginn 01.09.2026
    Und der Kandidat ist beschäftigt seit dem 01.09.2026
    Wenn der MSP-Disponent den Einsatz in den Status "active" überführt
    Dann genügt das Arbeitsverhältnis, weil es am ersten Überlassungstag besteht
    Und das Ergebnis der Prüfung P11 ist eine Information
    Und der Status des Einsatzes ist "active"

  @q47 @p11 @sperre
  Szenario: Q47 Kein Arbeitsverhältnis am Einsatzstart
    Angenommen ein Einsatz von "Lennart Voß" steht im Status "planned" mit tatsächlichem Beginn 01.09.2026
    Und das Beschäftigungsverhältnis beim Lieferanten ist am 01.09.2026 weiter "applicant"
    Wenn der MSP-Disponent den Einsatz in den Status "active" überführen will
    Dann ist das Ergebnis der Prüfung P11 eine Sperre
    Und der Status des Einsatzes ist weiter "planned"
    Und ein Protokolleintrag mit der Prüfung "employmentRelationshipCheck" und dem Ergebnis "blocked" liegt vor

  @q47 @p11 @sperre @grenzfall
  Szenario: Q47 Arbeitsverhältnis beginnt nach dem ersten Überlassungstag
    Angenommen ein Einsatz von "Miriam Falk" steht im Status "planned" mit tatsächlichem Beginn 01.09.2026
    Und der Kandidat ist beschäftigt seit dem 02.09.2026
    Wenn der MSP-Disponent den Einsatz in den Status "active" überführen will
    Dann ist das Ergebnis der Prüfung P11 eine Sperre
    Und der Status des Einsatzes ist weiter "planned"

  @q47 @p11 @sperre @grenzfall
  Szenario: Q47 Kandidat ist beim Lieferanten inaktiv
    Angenommen ein Einsatz von "Miriam Falk" steht im Status "planned" mit tatsächlichem Beginn 01.09.2026
    Und der Kandidat steht beim Lieferanten im Status "inactive"
    Wenn der MSP-Disponent den Einsatz in den Status "active" überführen will
    Dann wird der Kandidat wie ein Bewerber behandelt
    Und das Ergebnis der Prüfung P11 ist eine Sperre
    Und der Status des Einsatzes ist weiter "planned"

  @q47 @p11 @sperre @grenzfall
  Szenario: Q47 Lieferantenwechsel ohne neues Arbeitsverhältnis
    Angenommen "Miriam Falk" war über "Rheinpersonal GmbH" überlassen und ist dort beschäftigt seit dem 01.08.2026
    Und ein neuer Einsatz über "Elbe Zeitarbeit GmbH" steht im Status "planned" mit tatsächlichem Beginn 01.11.2026
    Und der Kandidatensatz bei "Elbe Zeitarbeit GmbH" trägt das Beschäftigungsverhältnis "applicant"
    Wenn der MSP-Disponent den neuen Einsatz in den Status "active" überführen will
    Dann prüft die Prüfung P11 den Kandidatensatz des neuen Verleihers
    Und das Ergebnis ist eine Sperre
    Und der Status des neuen Einsatzes ist weiter "planned"

  @q47 @p11 @uebersteuerung
  Szenario: Q47 Übersteuerung, weil der Arbeitsvertrag besteht, aber nicht erfasst ist
    Angenommen der Einsatzstart ist durch die Prüfung P11 gesperrt
    Und der Arbeitsvertrag zwischen "Rheinpersonal GmbH" und "Miriam Falk" besteht nachweislich seit dem 25.08.2026 und ist im System nicht erfasst
    Und die Erfassung ist vor dem Einsatzstart nicht möglich
    Und nach richtiger Datenlage wäre die Überlassung zulässig
    Wenn der MSP-Administrator den Übergang mit Pflichtbegründung übersteuert
    Dann findet der Übergang statt und der Status des Einsatzes ist "active"
    Und zwei Protokolleinträge liegen vor, der abgelehnte mit "blocked" und der vollzogene mit "success"
    Und die Begründung nennt die Prüfung "employmentRelationshipCheck" und die Tatsache, die stattdessen gilt

  @q47 @p11 @uebersteuerung
  Szenario: Q47 Übersteuerungsversuch ohne bestehendes Arbeitsverhältnis wird zurückgewiesen
    Angenommen der Einsatzstart ist durch die Prüfung P11 gesperrt
    Und ein Arbeitsverhältnis beim Verleiher besteht tatsächlich nicht
    Wenn der MSP-Administrator die Sperre zu übersteuern versucht
    Dann wird die Übersteuerung zurückgewiesen, weil die Überlassung auch nach richtiger Datenlage unzulässig wäre
    Und der Status des Einsatzes ist weiter "planned"

  @p11 @warnung @grenzfall @rueckwirkend
  Szenario: Nachträglich korrigiertes Beschäftigungsdatum
    Angenommen ein Einsatz von "Miriam Falk" läuft seit dem 01.09.2026 im Status "active"
    Und das Beschäftigungsdatum wird am 20.10.2026 von 01.08.2026 auf 15.09.2026 berichtigt
    Wenn der Lieferantendisponent die Berichtigung speichert
    Dann ist das Ergebnis eine Warnung mit Pflicht-Eskalation an den MSP-Administrator
    Und der Befund nennt § 1 Abs. 1 AÜG und die möglichen Folgen nach §§ 9, 10 AÜG
    Und der Befund wird festgestellt, nicht gesperrt

  @p11 @grenzfall
  Szenario: Arbeitsverhältnisprüfung hängt nicht an der Personenidentität
    Angenommen für den Kandidaten "Miriam Falk" ist keine bestätigte Personenidentität geführt
    Und der Kandidat ist beim Lieferanten beschäftigt seit dem 01.08.2026
    Wenn der Betreiber die Prüfung P11 am Einsatzstart 01.09.2026 rechnet
    Dann ist das Ergebnis eine Information
    Und die fehlende Personenidentität ist für die Prüfung P11 ohne Belang
