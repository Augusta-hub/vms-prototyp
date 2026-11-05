# Dienst-Tests

Hier liegt der Teil des Prototyps, der sich **nur** mit einer Datenbank prüfen
lässt: die Naht zwischen dem Regelwerk aus [SPEC.md](../../SPEC.md) Kapitel 5
und den Statusmodellen aus Kapitel 4.

```bash
npm run test:services
```

## Warum ein eigener Lauf

`npm test` läuft **ohne** Datenbank. Das ist kein Zufall, sondern die Linie des
Projekts: die Fachlogik in `lib/aueg/` rechnet auf einer Lage, nicht auf einer
Verbindung, und ist deshalb ohne Prisma prüfbar. Ein Test, der dafür eine
Datenbank braucht, prüft etwas anderes — und soll den schnellen Lauf nicht
aufhalten.

Was ohne Datenbank **nicht** zu prüfen ist, steht hier:

- ob der Dienst die richtigen Zeilen lädt — die Überlassungskette über
  Lieferanten hinweg (5.0), die Tarifzuordnung nach der Rangfolge aus 5.1.2,
  den Konzernverbund des Entleihers (3.1, § 18 AktG),
- ob die gerechnete Tatsache den Übergang wirklich erreicht und ihn sperrt
  oder durchlässt (4.2.3, 4.3),
- ob die abgeleiteten Felder `maxDurationEndDate` und `countedDurationDays` an
  **jedem** Einsatz der Kette landen (5.1.3, „Ergebnisfelder") — und ob eine
  Sperre nichts schreibt (4.0, Regel 5).

## Welche Datenbank

Eine **eigene**: der Name der Entwicklungsdatenbank aus `DATABASE_URL` mit dem
Zusatz `_test`. Sie wird vor dem Lauf einmal angelegt und migriert
(`tests/services/aufbau.ts`) und vor **jedem** Test geleert
(`tests/services/fixture.ts`).

Die Entwicklungsdatenbank wird nicht angefasst. Das ist nicht nur Hygiene: die
Tests legen Einsätze an, führen Übergänge aus und schreiben abgeleitete Felder.
Täten sie das in `vms_prototyp`, wäre nach jedem Lauf unklar, was Seed und was
Test ist.

Verbindungsdaten stehen in keiner Datei dieses Verzeichnisses (CLAUDE.md,
Regel 2) — abgeleitet wird nur der Name der Datenbank, aus der Umgebung. Alle
Personen, Firmen und Datumsangaben im Fixture sind synthetisch (Regel 3).

## Aufbau

| Datei | Zweck |
|---|---|
| `umgebung.ts` | leitet die Verbindung der Testdatenbank aus `DATABASE_URL` ab |
| `aufbau.ts` | legt sie an und migriert sie, einmal je Lauf (`globalSetup`) |
| `verbindung.ts` | setzt `DATABASE_URL`, **bevor** ein Modul `lib/prisma.ts` importiert |
| `fixture.ts` | leert die Datenbank und baut die synthetische Welt |
| `staffing.test.ts` | die Prüfungen P1, P6 und P11 an den Übergängen aus 4.3 |

Die Welt ist klein: ein Betreiber, ein Kunde mit Standort und Kostenstelle, ein
zweites Unternehmen desselben Konzerns, zwei Lieferanten und eine Person mit je
einem Kandidatensatz je Lieferant. Weniger würde die Regeln nicht tragen — die
Überlassungskette läuft über Lieferanten hinweg, und die Drehtürklausel greift
auch für einen Arbeitgeber aus dem Konzern des Entleihers.

## Was noch fehlt

- Die Dienste `demand.ts` und `masterData.ts` haben keine Tests. Das Muster
  steht jetzt; die Arbeit ist dieselbe.
- P9 und P10 sind am Einsatz und an der Verlängerung noch nicht angebunden
  (ihre Eingangsdaten werden dort nicht geladen). Sobald sie es sind, gehören
  ihre Sperren hierher.
