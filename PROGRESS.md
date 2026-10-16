# Fortschritt

Chronologisches Arbeitsprotokoll. Neueste Einträge oben. Pro Arbeitseinheit:
was gemacht wurde, welche Entscheidungen gefallen sind, was offen bleibt.

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
