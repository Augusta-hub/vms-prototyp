# Fortschritt

Chronologisches Arbeitsprotokoll. Neueste Einträge oben. Pro Arbeitseinheit:
was gemacht wurde, welche Entscheidungen gefallen sind, was offen bleibt.

---

## 2026-10-20 — Stammdaten, Bedarfsanfrage und Ausschreibung (M3, zweite Hälfte)

**Gemacht**

- **Datenmodell zu SPEC 3.1 bis 3.5**, 17 neue Objekte im Prisma-Schema, dazu
  15 Enums für die Wertebereiche aus Kapitel 3 und 4:

  | Kapitel | Objekte |
  |---|---|
  | 3.1 | `Customer`, `Site`, `CostCenter`, `ContactPerson` |
  | 3.2 | `Supplier`, `SupplierPermit` |
  | 3.3 | `MasterAgreement`, `RateCard`, `RateCardItem`, `CollectiveAgreementAssignment`, `ComparableWageEntry` |
  | 3.4 | `DemandRequest`, `DemandRequestQualification` |
  | 3.5 | `Tender`, `TenderInvitation`, `SupplierOffer`, `SupplierOfferItem` |

  Jedes mandantengebundene Objekt trägt die Standardfelder aus 3.0 und
  `tenantId`; Historisierung über `validFrom`/`validTo`, halb offen. Migration
  `20261020135457_stammdaten_bedarf_ausschreibung` ist gegen die lokale
  Datenbank **gelaufen** (`prisma migrate status`: „Database schema is up to
  date!", 24 Tabellen).
- **Berechtigungsmatrix um zwölf Objektzeilen ergänzt** (`lib/authz/matrix.ts`):
  Kunde, Standort, Kostenstelle, Lieferant, AÜG-Erlaubnis, Rahmenvertrag,
  Preisliste, Tarifzuordnung, Vergleichsentgelt, Bedarfsanfrage, Ausschreibung
  und Lieferantenangebot — Zelle für Zelle aus 2.2, mit dem Wortlaut der Zeile
  als Kommentar darüber. Dazu **26 neue Fußnoten** mit Wortlaut **und**
  Prädikat ([1], [3]–[6], [8]–[21], [34], [36], [37], [40]–[42], [46]). Das
  Rechtemodell wurde **benutzt, nicht neu gebaut**: jeder Zugriff läuft über
  `checkPermission`.
- **Zwei Erweiterungen am `ResourceRef`**, beide in 2.2 und 3.5 begründet:
  - `disclosedToTenantIds` — die Fälle, in denen Kapitel 2 und 3 einem
    **anderen** Mandanten ausdrücklich Zugang gewähren: die Einladung gehört
    dem Betreiber, „ist aber dem Lieferanten zugänglich" (3.5, `L[16] S[46]`),
    der Kunde sieht den Fortschritt zur eigenen Anfrage (`L[15]`), das Angebot
    gehört dem Lieferanten und ist dem Kunden im Umfang von [18] zugänglich.
    Ohne diesen benannten Ausnahmeweg hätte die Mandantengrenze Rechte
    verweigert, die 2.2 ausdrücklich vergibt. Die Fußnote prüft danach
    **erneut**, ob es der eigene Vorgang ist, und der Zugriff bleibt
    `crossTenant`.
  - `status`, `targetStatus`, `customerTenantId`, `supplierTenantId`,
    `engagementTenantIds`, `requestedById`, `rateCardScope`,
    `inApprovalContext` — die Angaben, die die neuen Fußnoten brauchen.
- **Feldbezogene Sichtbarkeit** (`lib/visibility/projections.ts`): Fußnoten,
  die nicht den Zugriff, sondern die **Felder** einschränken, tragen ihre
  Feldliste ([14], [15], [18], [36]). Aus der Entscheidung der Prüffunktion
  wird damit die sichtbare Fassung eines Vorgangs. Die Oberfläche schreibt
  „nicht sichtbar" und nennt die Felder — eine Fußnote ist eine Aussage, keine
  Lücke.
- **Statusmodelle 4.1 und 4.2.1 als geschlossene Übergangsmenge**
  (`lib/status/`), dazu 4.2.2, weil 4.2.1 es braucht: die Einladung wechselt
  nach `offerSubmitted` ausschließlich als Folge von `draft` → `submitted` am
  Angebot.
  - Ein Übergang wird über seinen **Namen** angefordert; die Namen sind die
    Schlüssel der Übergangstabelle. Ein Übergang, den Kapitel 4 nicht nennt,
    hat keinen Namen und ist im Typsystem nicht ausdrückbar (CLAUDE.md).
  - Geprüft wird in der Reihenfolge aus 4.0: genannter Übergang aus diesem
    Zustand → auslösende Rolle → `checkPermission` (bei der Anlage mit `A`,
    sonst mit `S`) → Vorbedingungen. Für die Rollenprüfung wird das Subjekt auf
    die in Kapitel 4 genannten Rollen eingeschränkt, damit keine zweite Rolle
    derselben Person einen Übergang trägt (2.1: Rollen erben nicht).
  - Fußnote [46] ist umgesetzt: der Lieferantendisponent sagt die **eigene**
    Einladung selbst ab, mit Pflichtbegründung; der MSP-Disponent kann das
    nicht.
  - Die Systemübergänge (`viewed`, `offerSubmitted`, `expired`) werden **ohne
    Subjekt** angefordert und von einer Benutzerhandlung abgewiesen (4.0,
    Regel 10). Der Fristenlauf ist als Schaltfläche vorführbar; gestartet wird
    der Lauf, nicht der einzelne Übergang.
- **Fachdienste** (`lib/services/`): Stammdaten lesen und anlegen, Bedarfsanfrage
  anlegen und wechseln, Ausschreibung veröffentlichen, Einladung absagen,
  Angebot einreichen und führen. Jede Liste läuft durch die Prüffunktion und
  die Projektion — ein verweigerter Vorgang erscheint **nicht** als leere
  Zeile, sondern nicht (2.3).
- **Oberfläche, durchklickbar** (`app/stammdaten`, `app/bedarf`,
  `app/einladungen`, Navigation im Rahmen). Angezeigt werden nur die Übergänge,
  die diese Rolle an diesem Vorgang auslösen darf; eine unerfüllte Vorbedingung
  bleibt sichtbar und wird beim Versuch mit SPEC-Verweis benannt.
- **Seed erweitert:** 5 Mandanten, 14 Benutzer, 2 Kunden mit 3 Standorten und
  3 Kostenstellen, 2 Lieferanten mit anerkannter gültiger Erlaubnis, 4
  Rahmenverträge, 4 Preislisten **beider** Seiten mit 7 Positionen, 4
  Tarifzuordnungen, 3 Vergleichsentgelte, **8 Bedarfsanfragen — eine je Zustand
  aus 4.1**, dazu eine Ausschreibung mit zwei Einladungen (eine mit Angebot,
  eine abgesagt). Seed ist gegen die lokale Datenbank gelaufen.
- **Die beiden offenen Punkte aus der vorigen Arbeitseinheit sind behoben:**
  - `AccountAssignment` führt den ersten MSP-Disponenten jetzt für **beide**
    Kunden; ein zweiter Disponent ist bewusst auf einen Kunden eingeschränkt,
    damit die Betreuungszuordnung am Seed als Einschränkung sichtbar bleibt.
  - `ResponsibilityScope` bleibt **leer**, solange offene Frage 14 offen ist —
    im Seed als Kommentar festgehalten, mit dem Hinweis, wohin das Beispiel
    gehört, sobald die Frage entschieden ist.
  - Zusätzlich geschlossen: `Tenant.organizationId` wird jetzt gesetzt, und
    `assertOrganizationRefPresent` läuft im Seed mit `enforce: true`.
- **Durchgeklickt** (lokaler Entwicklungsserver, alle Rollen über die
  Testidentität): Bedarf anlegen → einreichen (KB) → freigeben (KG) →
  ausschreiben mit zwei Einladungen (MD) → Einladung als Lieferant öffnen
  (Übergang nach `viewed`) → Angebot einreichen (LD 1) → Einladung absagen
  (LD 2). Dabei geprüft: Lieferant 2 sieht das Angebot von Lieferant 1 nicht,
  der Lieferant sieht keine Kostenstelle, keinen internen Vermerk und keinen
  Kostenrahmen, der Kunde sieht keinen Einkaufssatz, Einkauf/Controlling sieht
  an der Erlaubnis nur Anerkennung und Ablaufdatum, und der eingeschränkte
  MSP-Disponent sieht nur seinen betreuten Kunden.
- **`tests/aueg/` unberührt** (`git status tests/` ist leer). Diese
  Arbeitseinheit implementiert **keine** AÜG-Prüfung; die 254 Szenarien bleiben
  rot. Die Stellen, an denen Kapitel 5 greift, sind im Code benannt.

**Prüfergebnisse** (tatsächlich gelaufen, nicht beabsichtigt)

| Befehl | Ergebnis |
|---|---|
| `npx prisma migrate dev` | Migration `20261020135457_stammdaten_bedarf_ausschreibung` angelegt und angewendet |
| `npx prisma migrate status` | „Database schema is up to date!", 2 Migrationen, 24 Tabellen |
| `npx prisma db seed` | durchgelaufen; Zählung siehe oben |
| `npm test` | **143 Tests grün** (vorher 56), 6 Dateien |
| `npm run typecheck` | Exit 0, keine Meldung |
| `npm run build` | Exit 0, fünf Routen |

Die 87 neuen Tests: 27 zu 4.1, 19 zu 4.2.1, 20 zu 4.2.2 und 21 zur
Sichtbarkeit. Je Statusmodell mindestens ein erlaubter Übergang, einer, der an
der Vorbedingung scheitert, einer, der an der Rolle scheitert, einer, den
Kapitel 4 nicht nennt, und die Mandantengrenze.

**Entscheidungen**

| Thema | Entscheidung |
|---|---|
| Geschlossene Übergangsmenge | Ein Übergang wird über seinen **Namen** aus der Übergangstabelle angefordert. Ein in Kapitel 4 nicht genannter Übergang ist damit nicht ausdrückbar, statt zur Laufzeit abgewiesen zu werden |
| Anlage ist `A`, nicht `S` | „— → draft" in Kapitel 4 ist die Anlage des Vorgangs; die Prüffunktion wird dafür mit `create` aufgerufen, für jeden anderen Übergang mit `transition` (2.2, Lesart) |
| 4.2.2 mit umgesetzt | Ohne das Angebot wäre 4.2.1 nur halb umgesetzt: die Einladung wechselt nach `offerSubmitted` nur als Folge des Übergangs am Angebot. `reviewed` → `accepted` ist genannt und scheitert an seiner Vorbedingung, weil der Profilvorschlag (3.6) fehlt |
| Zustände `inSelection` und `filled` im Seed | Beide setzen 3.6 bzw. 3.7 voraus und sind über die Oberfläche nicht erreichbar. Der Seed legt sie als **Daten** an, damit 4.1 vollständig vorführbar ist — kein Weg um Kapitel 4 herum, denn gewechselt wird ausschließlich über die Statusmodelle |
| Unterobjekte ohne eigenen `tenantId` | Preisposition, Anforderung, Angebotsposition und Ansprechpartner gehören zum Mandanten ihres Hauptobjekts und teilen nach 2.2 auch dessen Matrixzeile; der Mandant wird über das Hauptobjekt gelesen, nicht doppelt geführt |
| Beauftragung aus Einladungen abgeleitet | Fußnoten [3], [6] und [36] setzen eine Beauftragung voraus, für die Kapitel 3 kein Objekt führt. Abgeleitet wird sie aus den Einladungen, je Kunde **und je Standort** ([3] nennt „Kunden und Standorte"), gekapselt in einer Funktion → **neue offene Frage 36** |
| Fußnote [8] verweigert ohne Entscheidungszusammenhang | `KG` sieht die Preisliste nur „für die Kostenwirkung des zu genehmigenden Vorgangs". Ohne benannte Verbindung ist das nicht prüfbar; die Umsetzung verlangt ein ausdrückliches Kennzeichen und verweigert sonst → **neue offene Frage 37** |
| `createdOnBehalfOf` ist der Auftraggeber | Der Handelnde steht schon in `createdBy` (3.0); das Feld trägt deshalb den Bedarfsträger des Kunden und wird nur bei Anlage durch den Betreiber gesetzt → **neue offene Frage 38** |
| Rechteprüfung beim Anlegen eines Mandanten | Kunde und Lieferant entstehen **mit** ihrem Mandanten (3.1, 3.2). Die Prüfung läuft in der Transaktion, nachdem der Mandant existiert — nur dann prüft sie auf dem wirklichen Mandanten; ein verweigerter Zugriff rollt zurück |
| Fristenlauf als Schaltfläche | Die zeitgesteuerten Übergänge brauchen einen Auslöser, um vorführbar zu sein. Gestartet wird der **Lauf** (5.5.1, nächtlicher Lauf), die Übergänge selbst werden ohne Subjekt angefordert und tragen keinen Benutzer |

**Offen / als Nächstes**

- **Drei neue offene Fragen in SPEC Kapitel 7:** 36 (woran bemisst sich die
  Beauftragung?), 37 (wie erreicht die Kostenwirkung den Genehmiger?), 38 (wen
  benennt `createdOnBehalfOf`?). Nicht im Code entschieden, die vorläufige
  Auslegung steht jeweils an der Fundstelle **und** in der Fragentabelle.
- **Abweichungen von der SPEC, benannt statt stillschweigend:**
  1. `SupplierPermit.certificateDocumentRef` ist nach 3.2 **Pflicht**
     („Urkunde: Verweis auf `document`"), bleibt aber optional, solange 3.10
     nicht modelliert ist. Dasselbe gilt für `Site.worksCouncilAgreementRef`,
     `CollectiveAgreementAssignment.documentRef` und
     `RateCardItem.premiumTypeRef` (Zuschlagsart, 3.8) — alle vier sind
     benannte Skalare mit Kommentar, kein Fremdschlüssel.
  2. `SupplierOfferItem` führt die Liste `premiumRates` aus 3.5 **nicht**: sie
     verweist auf die Zuschlagsart aus 3.8.
  3. Die Nebenwirkungen aus Kapitel 4 — Benachrichtigungen, Fristenlauf,
     Audit-Eintrag (4.0, Regel 3) — sind **nicht** umgesetzt und im Code an
     ihrer Stelle als Kommentar benannt. Sie hängen an 3.12.
  4. Fußnote [1] (nur Felder ohne kaufmännische Wirkung) trägt ihre Feldliste
     als `writable`-Angabe, wirkt aber noch nicht: die Oberfläche dieser
     Arbeitseinheit legt an und liest, sie ändert nicht. Sobald ein
     Änderungspfad entsteht, ist `writableFields` dort anzuwenden.
  5. 4.6 (Lieferantenstatus) ist **nicht** als Übergangsmenge umgesetzt. Der
     Lieferant trägt seinen Status als Feld, und die Einladung prüft ihn als
     Vorbedingung; Freischalten, Sperren und Entsperren gehören zur
     Arbeitseinheit, die 4.6 umsetzt. Fußnote [5] ist vorbereitet.
- **Widerspruch, aufgefallen in 2.2:** die Zeile „Vergleichsentgelt (3.3)"
  trägt für `MA` `A L Ä X`, aber das Objekt gehört nach 3.3 dem
  **Kundenmandanten** und wird vom Entleiher gepflegt. Der Betreiber darf nach
  2.2 also anlegen und ändern, was 3.3 ausdrücklich dem Kunden zuweist („nur er
  kennt es"). Die Umsetzung folgt der Matrix; fachlich wäre zu klären, ob `MA`
  dort nur lesen soll.
- Die Betreuungszuordnung wirkt jetzt auch auf Vorgänge des Betreibers, die
  einen Kunden **betreffen** (Ausschreibung, Einladung) — sonst ließe sich die
  Einschränkung über ein Betreiberobjekt umgehen. Das ist eine Auslegung von
  2.3, Bedingung 2 und mit offener Frage 34 verwandt.
- Danach M4: Kandidat und Profilvorschlag (3.6) mit 4.2.3 und der
  Datenminimierung aus 6.4, dann der Einsatz (3.7) mit 4.3 — und erst damit
  werden `inSelection` und `filled` über die Oberfläche erreichbar. Die
  AÜG-Prüfungen aus Kapitel 5 kommen in einer eigenen Arbeitseinheit; erst sie
  machen die 254 Szenarien in `tests/aueg/` grün.
- `.claude/launch.json` ist neu und nicht in `.gitignore`: eine
  Startkonfiguration für den Entwicklungsserver. Falls sie nicht ins
  Repository gehört, gehört sie in `.gitignore`.

---

## 2026-10-20 — Entwicklungsdatenbank eingerichtet, Schema bewiesen

**Gemacht**

- **PostgreSQL 18.6 über Homebrew** installiert (`postgresql@18`) und als
  lokalen Dienst gestartet. Datenbank `vms_prototyp` angelegt, Zugriff über
  lokale Trust-Authentifizierung ohne Passwort.
- `DATABASE_URL` in der lokalen `.env` gesetzt — die Datei bleibt durch
  `.gitignore` ausgeschlossen, geprüft mit `git check-ignore`.
- **Die Lücke aus der vorigen Arbeitseinheit ist geschlossen:** Migration und
  Seed sind erstmals gegen eine echte Datenbank gelaufen.
  - `npx prisma migrate deploy` → `20261020120000_init` angewendet, ohne Fehler
  - `npx prisma db seed` → 5 Mandanten, 8 Benutzer, 8 Rollenzuweisungen,
    1 Betreuungszuordnung, 1 Vertretung
  - `npm run build` → Exit 0
  - `npm test` → 56 Tests grün
- Das Schema ist damit nicht mehr nur typgeprüft, sondern tatsächlich
  angelegt: Enum-Namen, Unique-Constraints und Fremdschlüssel halten.

**Lokale Einrichtung** (für die nächste Arbeitseinheit)

```bash
brew services start postgresql@18
export PATH="/opt/homebrew/opt/postgresql@18/bin:$PATH"
createdb vms_prototyp          # nur beim ersten Mal
npx prisma migrate deploy
npx prisma db seed
npm run dev                    # App auf http://localhost:3000
npm test                       # Unit-Tests (vitest)
```

`DATABASE_URL` muss in `.env` stehen, Form siehe `.env.example`. Den Dienst
beendet `brew services stop postgresql@18`.

**Entscheidungen**

| Thema | Entscheidung |
|---|---|
| Entwicklungsdatenbank | PostgreSQL über Homebrew als lokaler Dienst. Kein Docker (nicht installiert, größerer Eingriff), keine gehostete Dev-Datenbank — auch synthetische Daten sollen nicht bei einem Dritten liegen, solange das Hosting-Ziel DE/EU ist (SPEC 6.9, offene Frage 2) |
| Autostart | `brew services` startet den Dienst auch bei der Anmeldung. Das ist eine dauerhafte Änderung an der Maschine, bewusst so gewählt, damit die nächste Arbeitseinheit nicht daran scheitert |

**Offen / als Nächstes**

- **Zwei Beobachtungen am Seed**, nicht stillschweigend geändert:
  1. `ResponsibilityScope` hat **0 Zeilen** — Zuständigkeiten auf Standort- und
     Kostenstellenebene sind nicht geseedet. Passt zu **offener Frage 14**, die
     noch unbeantwortet ist; sobald sie entschieden ist, gehört ein Beispiel in
     den Seed.
  2. `AccountAssignment` hat **1 Zeile**, obwohl zwei Kunden und zwei
     Lieferanten angelegt sind. Für eine Demo der Mandantentrennung sollte der
     Betreiber für **beide** Kunden eine Betreuungszuordnung haben — sonst
     lässt sich 2.3 am Seed nicht zeigen.
- Die Einrichtungsschritte stehen bisher nur hier im Protokoll. Ein `README.md`
  mit dem lokalen Setup wäre der bessere Ort.
- Danach M3b: Kunden, Standorte, Lieferanten inkl. Erlaubnisnachweis und die
  Bedarfsanfrage von Anlegen bis Ausschreiben.

---

## 2026-10-20 — Projektsetup, Mandanten-, Benutzer- und Rollenmodell (M3, erste Hälfte)

**Gemacht**

- **Erster Anwendungscode des Projekts.** Next.js (App Router) mit TypeScript
  im Wurzelverzeichnis, Prisma auf PostgreSQL, Vitest für die Unit-Tests.
  Verbindungsdaten ausschließlich über `DATABASE_URL` aus `.env`;
  `.env.example` um `DATABASE_URL`-Form und `VMS_TEST_IDENTITY` ergänzt.
  `package-lock.json` liegt im Repository, `node_modules/` bleibt ignoriert.
  **Nichts committet.**

  | Bereich | Dateien |
  |---|---|
  | Projektsetup | `package.json`, `tsconfig.json`, `next.config.ts`, `vitest.config.ts` |
  | Datenmodell | `prisma/schema.prisma`, `prisma/migrations/20261020120000_init/` |
  | Rechtemodell | `lib/authz/roles.ts`, `resources.ts`, `operations.ts`, `footnotes.ts`, `matrix.ts`, `check.ts`, `grants.ts` |
  | Tests | `lib/authz/check.test.ts` (35), `lib/authz/grants.test.ts` (21) |
  | Oberfläche | `app/layout.tsx`, `app/page.tsx`, `app/actions.ts`, `app/globals.css` |
  | Identität, Hilfsmittel | `lib/prisma.ts`, `lib/identity/testIdentity.ts`, `lib/identity/loadSubject.ts`, `lib/tenants/invariants.ts` |
  | Demo-Daten | `prisma/seed.ts` |

- **Prisma-Schema zu SPEC 3.11:** `Tenant`, `User`, `RoleAssignment`,
  `ResponsibilityScope`, `AccountAssignment`, `Delegation` — jedes mit den
  Standardfeldern aus 3.0 (`id`, `tenantId` bei mandantengebundenen Objekten,
  `createdAt`/`createdById`, `updatedAt`/`updatedById`,
  `deactivatedAt`/`deactivatedById`, dazu `externalReference` aus der Notiz zu
  Frage 7). Die Mandantenzuordnung ist das Feld `tenantId` am Benutzer — 3.11
  führt dafür kein eigenes Objekt. Rollen sind das Enum `RoleCode` mit den acht
  Kürzeln aus 2.1, **keine** pflegbare Tabelle.
- **Berechtigungsmatrix 2.2 als Code**, an einer Stelle:
  `lib/authz/matrix.ts` ist `Objektzeile → Rolle → Operation → Fußnoten`.
  Alle 24 Objektzeilen aus 2.2 sind als Typ benannt, belegt sind die beiden
  Zeilen zu 3.11. Die Fußnoten `[2]`, `[7]`, `[38]` und `[45]` tragen ihren
  Wortlaut aus 2.2 **und** ein Prädikat, das gegen den Vorgang auswertet; die
  übrigen 42 kommen mit ihren Zeilen, die Struktur trägt sie unverändert.
- **Prüffunktion `checkPermission`** mit der Reihenfolge aus 2.3:
  **Mandantengrenze → Rollenrecht → Fußnoten → Zuständigkeit**. Ein Zugriff,
  den die Matrix nicht ausdrücklich nennt, wird verweigert; eine unbelegte
  Zeile verweigert alles. Die Entscheidung nennt die Begründung mit
  SPEC-Verweis, trägt den Vertretungsvermerk aus 2.4 Regel 6 und weist
  mandantenübergreifende Zugriffe als `crossTenant` aus, damit die
  Protokollpflicht aus 2.3 bedient werden kann, sobald 3.12 steht.
- **56 Unit-Tests, alle grün** (`lib/authz/*.test.ts`, nicht in `tests/aueg/`):
  je Rolle ein erlaubter und ein verweigerter Zugriff auf die Zeilen zu 3.11,
  die Mandantengrenze zwischen Kunden, zwischen Lieferanten und gegenüber dem
  Betreiber, die Betreuungszuordnung als Einschränkung der Querschnittssicht
  und die Vertretungsregeln aus 2.4: befristet, personenbezogen, keine Ketten,
  keine Rechteerweiterung, nicht vertretbare Rolle, vorzeitiges Ende.
- **Synthetischer Seed:** ein Betreiber, zwei Kunden, zwei Lieferanten, je ein
  Benutzer pro Rolle (acht), dazu eine Betreuungszuordnung (der MSP-Disponent
  betreut nur Kunde 1) und eine Vertretung (der Genehmiger wird zwölf Tage
  vertreten). Erfundene Organisationen, dieselben Namen wie in
  `tests/aueg/*.feature`; E-Mail-Adressen in der reservierten Domain
  `.example`. Keine Passwörter, keine Hashes, keine Token — der Prototyp
  modelliert keine Anmeldedaten (3.0, Festlegung 4).
- **Umschaltbare Testidentität statt Authentifizierung:** die handelnde Person
  steht in einem Cookie, Vorbelegung über `VMS_TEST_IDENTITY`. Die Startseite
  zeigt die wirksamen Rechte dieser Identität und die belegten Matrixzeilen,
  gelesen aus dem Code.
- **`tests/aueg/` unberührt.** Diese Arbeitseinheit implementiert keine
  AÜG-Regel; die 254 Szenarien sind weiterhin ohne Runner (siehe „Offen").

**Lokal starten**

```
npm install
# DATABASE_URL in .env auf eine erreichbare PostgreSQL-Datenbank setzen
npm run db:migrate     # legt das Schema an (prisma migrate dev)
npm run db:seed        # synthetische Demo-Daten
npm run dev            # http://localhost:3000
```

Ohne Datenbank startet die Anwendung trotzdem: die Startseite zeigt die
Berechtigungsmatrix und sagt, dass keine Datenbank erreichbar ist.

**Tests ausführen**

```
npm test               # Unit-Tests (Vitest), 56 Tests, ohne Datenbank
npm run typecheck      # tsc --noEmit
npm run build          # Produktionsbuild
```

Die Gherkin-Dateien in `tests/aueg/` werden von Vitest ausdrücklich nicht
eingesammelt (`vitest.config.ts`); sie brauchen einen eigenen Runner.

**Entscheidungen**

| Thema | Entscheidung |
|---|---|
| Rechte sind Code, nicht Daten | 3.11 sagt es ausdrücklich: die Rechte einer Rolle sind keine pflegbaren Daten. Deshalb gibt es keine Tabelle für Rolle, Operation oder Berechtigung — die acht Rollen sind ein Enum, Bezeichnung und `appliesToTenantType` stehen im Katalog in `lib/authz/roles.ts` |
| Fehlender Eintrag heißt „kein Zugriff" | Die Matrix ist ein partielles Abbild: fehlende Zeile, fehlende Rolle oder fehlende Operation verweigern. Das ist die positive Festlegung aus 2.3 im Typsystem — ein Recht entsteht nur durch einen Eintrag, nie durch eine Lücke |
| Fußnoten sind Prädikate, keine Prosa | Jede Fußnote trägt ihren Wortlaut und eine Funktion über (Operation, Benutzer, Rollenzuweisung, Vorgang). Eine Fußnote kann ein Recht nur verkleinern. `undefined` und `[]` sind verschieden: `undefined` = nicht erlaubt, `[]` = erlaubt ohne Einschränkung |
| Mandantengrenze vor allem anderen | `checkPermission` prüft sie als erstes und kennt nur eine Ausnahme: den Betreibermandanten, und den nur im Rahmen seiner Betreuungszuordnungen. Ein verweigerter Zugriff über die Grenze nennt `tenantBoundary`, nicht das fehlende Rollenrecht — die Begründung soll die Regel sagen, die wirklich greift |
| Vertretung kann strukturell nicht erweitern | `Grant`s entstehen ausschließlich in `lib/authz/grants.ts`. Ein Vertretungs-`Grant` übernimmt Rolle, Mandant und Zuständigkeiten unverändert aus der vertretenen Rollenzuweisung (2.4 Regel 2); eine Vertretung belebt kein abgelaufenes Recht und überschreitet keine Organisationsgrenze |
| Stichtag wird übergeben, nie „heute" | Wie in 5.0 für das Regelwerk festgelegt, nimmt `buildSubject` ein `evaluationDate`. Damit sind Vertretungszeiträume und Laufzeiten reproduzierbar prüfbar |
| Kein `status` auf den Objekten aus 3.11 | 3.0 verlangt `status` nur, „wo ein Statusmodell existiert"; 3.11 nennt für jedes Objekt dieses Kapitels „Statusmodell: keines". Aktiv/inaktiv läuft über `deactivatedAt`, die Wirksamkeit einer Vertretung über ihren Zeitraum und `revokedAt` |
| `temporaryWorker` gehört zum Lieferantenmandanten | `appliesToTenantType = supplier`. Begründung aus 2.1: ohne eigenen Zugang übernimmt der Lieferantendisponent alle Vorgänge dieser Rolle **in seinem Namen** — die Rolle sitzt also in der Lieferantenorganisation. Entfällt mit Frage 4, falls kein eigener Zugang kommt |
| Testidentität statt Authentifizierung | Umschaltbar über Cookie, Vorbelegung über `VMS_TEST_IDENTITY`. Kein Anmeldeverfahren, keine Anmeldedaten im Modell (3.0, Festlegung 4; Auftrag dieser Arbeitseinheit) |
| Vitest, Tests neben dem Code | Leichtgewichtig, TypeScript ohne Zusatzschritt, kein Browser nötig. `vitest.config.ts` sammelt nur `lib/**/*.test.ts` und schließt `tests/aueg/` ausdrücklich aus |
| Initiale Migration ohne laufende Datenbank erzeugt | `prisma migrate diff --from-empty --to-schema-datamodel` schreibt `prisma/migrations/20261020120000_init/migration.sql`. So liegt die Migration im Repository, obwohl hier keine PostgreSQL-Instanz läuft (siehe „Offen") |

**Offen**

- **Migration und Seed sind nicht gegen eine Datenbank gelaufen.** Auf dieser
  Maschine gibt es weder PostgreSQL noch Docker. Geprüft sind: `prisma
  validate`, `prisma generate`, die erzeugte Migration als SQL,
  `npx tsc --noEmit`, `next build`, die ausgelieferte Startseite (HTTP 200,
  Matrix sichtbar) und die 56 Unit-Tests. **Nicht** geprüft sind: das
  Anwenden der Migration, der schreibende Seed und die Seite mit Daten.
  Nächster Schritt dafür: PostgreSQL lokal bereitstellen (z. B.
  `brew install postgresql@17`, `brew services start postgresql@17`,
  `createdb vms_dev`), `DATABASE_URL` setzen, `npm run db:migrate` und
  `npm run db:seed`.
- **Widerspruch 2.2 ↔ 3.11 beim Statuswechsel.** Die Zeile „Benutzer,
  Rollenzuweisung, Mandantenzuordnung, Zuständigkeit" gibt `MA` ein `S` und
  `LA` ein `S[7]`, aber 3.11 sagt für jedes Objekt dieses Kapitels
  „Statusmodell: keines". Die Matrix im Code ist der SPEC treu geblieben (die
  Operation `transition` steht dort), das Schema hat kein `status`-Feld — damit
  ist das Recht derzeit ohne Gegenstand. Entweder meint `S` dort die
  Aktivierung/Deaktivierung, dann gehört das in 3.11, oder die Zelle ist zu
  streichen. **Nicht selbst entschieden.**
- **Die Betreuungszuordnung hat in 2.2 keine Zeile.** 3.11 führt
  `accountAssignment` als eigenes Objekt, die Matrix nennt es nicht. Der Code
  ordnet es der Zeile „Benutzer, Rollenzuweisung, …" zu, weil 2.1 die
  Verwaltung der Zuordnungen dem `MA` zuweist. Entweder bekommt 2.2 eine Zeile
  oder 3.11 sagt ausdrücklich, dass das Objekt die Benutzerzeile teilt.
- **Drei Verweise zeigen auf Objekte, die es noch nicht gibt** — benannt, nicht
  stillschweigend umgebogen:
  `Tenant.organizationId` (3.11: Pflicht außer beim Betreiber) bleibt leer und
  ohne Fremdschlüssel, die Prüfung dazu ist in
  `lib/tenants/invariants.ts` abschaltbar und steht auf „aus";
  `AccountAssignment.customerTenantId` zeigt auf den **Kundenmandanten** statt
  auf `customer` (3.1); `ResponsibilityScope.scopeRef` ist ein Skalar ohne
  Fremdschlüssel, und der Seed legt deshalb **keine** Zuständigkeit an. Mit
  3.1 und 3.2 sind alle drei auf echte Beziehungen zu ziehen.
- **`createdById` ist nullable, 3.0 verlangt es als Pflicht.** Der erste
  Mandant und der erste Benutzer entstehen mit der Einrichtung des Systems; es
  gibt dafür keinen anlegenden Benutzer. Das Feld bleibt nur für diese
  systemseitig angelegten Sätze leer. Entweder nimmt 3.0 das auf, oder die
  Einrichtung erhält einen technischen Systembenutzer.
- **`updatedAt` wird von Prisma schon beim Anlegen gesetzt**, 3.0 verlangt den
  Wert erst „ab der ersten Änderung". Entweder wird 3.0 gelockert oder das Feld
  ohne `@updatedAt` selbst gesetzt. Fachliche Wirkung hat es nur dort, wo
  „nie geändert" von „einmal geändert" unterschieden werden soll.
- **Für `AN` ist kein erlaubter Zugriff getestet**, weil beide Zeilen zu 3.11
  für den Leiharbeitnehmer `–` tragen — das ist die Festlegung aus 2.2, keine
  Lücke im Test. Der Test prüft stattdessen, dass **alle** Operationen auf
  beiden Zeilen verweigert werden. Ein erlaubter Zugriff für `AN` ist zu
  ergänzen, sobald eine Zeile mit `AN`-Zelle belegt wird (3.7, 3.8, 3.10).
- **Auslegung in Fußnote [45]:** „keine Ketten" wird nur beim **Anlegen** einer
  Vertretung geprüft. Lesen und Beenden der eigenen Vertretung bleibt dem
  Vertreter im Rahmen der vertretenen Rollenzuweisung erlaubt, weil 2.4 Regel 4
  das Bestimmen eines Untervertreters verbietet, nicht jede Handlung an einer
  Vertretung. Falls das anders gemeint ist, ändert sich ein Prädikat.
- **Drei neue offene Fragen in SPEC Kapitel 7: 33, 34 und 35** (damit 27 von 35
  offen) — Eindeutigkeit der Anmeldekennung, Reichweite der Betreuungszuordnung
  gegenüber Lieferanten, Wirkung einer Zuständigkeit auf Objekte ohne Standort
  und Kostenstelle. Alle drei sind beim Schreiben des Codes aufgefallen und
  **nicht selbst entschieden**; die Umsetzung nennt ihre vorläufige Auslegung
  an der Fundstelle im Code und in der Fragentabelle.
- **`tests/aueg/` bleibt ohne Runner.** Die 254 Szenarien sind weiterhin nicht
  ausführbar — es fehlen Step-Definitions und ein Cucumber-Runner, und die
  AÜG-Regeln selbst sind nicht Teil dieser Arbeitseinheit. Der Runner gehört
  zu dem Meilenstein, der die Regeln umsetzt (M4).
- **Installationsskripte sind in `package.json` freigegeben** (`allowScripts`
  für `prisma`, `@prisma/client`, `@prisma/engines`, `esbuild`). npm 11
  verlangt das ausdrücklich; ohne die Freigabe fehlen Prisma-Engines und die
  esbuild-Binärdatei.

## 2026-10-20 — Gherkin-Szenarien für die AÜG-Regeln (M2)

**Gemacht**

- **Vier `.feature`-Dateien in `tests/aueg/` geschrieben, 254 Szenarien**, alle
  48 Zeilen der Querschnittstabelle 4.7 belegt. Geändert wurden nur
  `tests/aueg/*.feature`, `tests/aueg/README.md`, `PROGRESS.md`,
  `MILESTONES.md` und die Fragentabelle in Kapitel 7 der SPEC. **Kein
  Anwendungscode, keine Step-Definitions, kein Runner** — das Projektsetup
  existiert noch nicht (Frage 1 ist entschieden, M3 setzt um). Nichts
  committet.

| Datei | SPEC | Prüfungen | Szenarien |
|---|---|---|---|
| `max-assignment-duration.feature` | 5.1 | P1, P2 | 64 |
| `equal-pay.feature` | 5.2 | P3, P4, P5 | 49 |
| `revolving-door-and-strike.feature` | 5.3 | P6, P7, P8, P11 | 70 |
| `permit-and-deadlines.feature` | 5.4 | P9, P10 | 71 |

- **Je Prüfpunkt mindestens zwei Szenarien** (Prüfung geht durch / Prüfung
  spricht an). Bei den 23 sperrenden Zeilen kommt ein drittes hinzu: die
  dokumentierte Übersteuerung nach 5.5.4, wo die Prüfung übersteuerbar ist
  (P1, P2, P9, P10, P11), und der **zurückgewiesene Versuch**, wo sie es nicht
  ist (P4, P6, P7, P8).
- **Die Rechenwege sind mit Zahlen hinterlegt**, nicht nur beschrieben:
  Tagebudget 546 Tage für eine lückenlose Kette ab 15.01.2026 (Fristende
  14.07.2027), Equal-Pay-Fristbudget 273 Tage (Fälligkeit 15.10.2026), die
  Verschiebung um 91 Lückentage bei einer Unterbrechung von exakt drei Monaten,
  die Vorlaufschwellen 90/30 und 60/30 als Stichtage. Jede Zahl ist aus 5.1.3
  bzw. 5.2.3 nachgerechnet.
- **Grenzfälle als eigene Szenarien**, wie in 4.7 verlangt: Tag genau auf der
  Grenze (Fristende, Equal-Pay-Fälligkeit, Rückschaufenster der Drehtür,
  `employedSince`, `validTo` der Erlaubnis), Unterbrechung exakt drei Monate
  (als Szenariogrundriss mit den drei Rechenbeispielen aus 5.1.4),
  Lieferantenwechsel mitten im Einsatz (in allen vier Dateien, weil er je Regel
  anders wirkt), rückwirkende Korrektur, gleichzeitige Einsätze mit
  überlappenden Tagen, fehlende und nur vorgeschlagene Personenidentität,
  Zeitraum ohne Tarifzuordnung, fehlendes Vergleichsentgelt und
  `wageSource = estimate`.
- **Fristablauf hat eigene Szenarien** mit der Erwartung „Status unverändert,
  Eskalation ausgelöst": die nicht entschiedene Verlängerung bleibt in
  `requested`, der nicht genehmigte Stundenzettel bleibt in `inApproval`, und
  eine AÜG-Sperre hebt sich nicht durch Zeitablauf auf.
- **Der nächtliche Lauf ist abgedeckt** (N1 bis N6), jeweils mit der
  Erwartung, dass er keinen Statuswechsel und keine Sperre erzeugt — N1 mit
  der Stufenfolge 90/30/14 Tage als Szenariogrundriss.
- **Sichtbarkeit ist Teil der Erwartung** (4.7, Regel 3): die Warnung an den
  Lieferanten nennt nur den eigenen Einsatz, nie die Historie bei anderen
  Lieferanten; der Kunde erhält den Fristenstand, nicht die Historie bei
  anderen Kunden; der Lieferant erhält den Einsatzwert des Vergleichsentgelts,
  nicht den Katalog des Standorts; die Personenidentität wird nie offengelegt.
- **Tags durchgängig vergeben:** Abschnitt (`@spec-5.1`), Prüfpunkt (`@q07`),
  Prüfung (`@p1`), Ergebnisart (`@information` / `@warnung` / `@sperre`) und
  Zweck (`@grenzfall`, `@rueckwirkend`, `@uebersteuerung`,
  `@keine-uebersteuerung`, `@nachtlauf`, `@frist-eskalation`,
  `@sichtbarkeit`, `@rechenweg`, `@nachweisfluss`), dazu die Norm.
- **`tests/aueg/README.md` um den Abschnitt „Vorhandene Dateien"** mit Tabelle
  und Tagkonvention ergänzt.

**Entscheidungen**

| Thema | Entscheidung |
|---|---|
| Erwartung ist immer eine Ergebnisart | Jedes Szenario nennt `Information`, `Warnung` oder `Sperre` und den Status **nach** dem Übergang — nie „nicht erlaubt". Ein Szenario, in dem die Prüfung durchgeht, erwartet eine **Information**, weil es nach 5.5.2 keinen Zustand „Prüfung nicht durchgeführt" gibt |
| Keine Step-Definitions | Die Dateien sind Spezifikation in ausführbarer Form. Ein Runner käme vor dem Projektsetup, und die Bindung an eine Technik würde die fachliche Lesbarkeit schwächen, die der Zweck dieser Dateien ist |
| Tarifwerte als Vorbedingung | `maxAssignmentDurationMonths`, `equalPayDeadlineMonths` und `industryPremiumScheme` werden **im Szenario gesetzt** (Beispielwerte, Schemata „Beispieltarif E1/E2/E3", „Beispieltarif Z1", „Beispielschema B1"). Im Erwartungsteil steht kein Tarifwert, nur gesetzliche Werte (18, 15, 9, 6, 3 Monate) |
| Synthetische Stammdaten, wiederverwendet | Dieselben erfundenen Organisationen und Personen über alle vier Dateien: „Nordwerk Metall GmbH" mit „Werk Süd" und „Werk Nord", „Nordwerk Service GmbH" im Konzern, die Lieferanten „Rheinpersonal GmbH", „Elbe Zeitarbeit GmbH" und „Saale Personal GmbH", die Kandidaten „Jana Behrens", „Tobias Krohn", „Miriam Falk" und „Lennart Voß". Keine echten Namen, keine echten Entgelte |
| Rollen ausgeschrieben | In den Szenarien stehen „der MSP-Disponent", „der Genehmiger", „der Lieferantendisponent" statt der Kürzel `MD`, `KG`, `LD` — ein Disponent oder Jurist soll das Szenario ohne die Matrix aus 2.2 lesen können. Die Kürzel bleiben der SPEC |
| „Fristende erreicht" heißt „überschritten" | Q23 und Q26 sprechen von „Fristende bereits erreicht". Gelesen wird das nach **5.1.5**: `maxDurationEndDate` ist der **letzte zulässige** Überlassungstag, ein Start oder eine Wiederaufnahme **an** diesem Tag geht durch (mit Warnung, weil das Restbudget danach null ist), erst der Folgetag ist gesperrt. Sonst widersprächen sich 5.1.5 und 4.7 |
| Q04 wirkt je Einladung | Nach 5.4.1 modelliert: der nicht gedeckte Lieferant wird nicht eingeladen, der Übergang nach `tendered` findet statt, solange eine zulässige Einladung bleibt; nur wenn **kein** Lieferant zulässig ist, bleibt die Anfrage in `approved` |
| Arbeitskampf fachlich formuliert | Anzeige und Zusicherung werden als Sachverhalt benannt („für den Standort ist eine Arbeitskampfanzeige vom … bis … erfasst"), **ohne ein Feld zu erfinden** — die Datenlücke bleibt Frage 30, die Szenarien bleiben gültig, sobald sie entschieden ist |

**Offen**

- **Zwei neue offene Fragen, 31 und 32** (damit 24 von 32 offen). Beide sind
  beim Schreiben der Szenarien als **Abweichung zwischen 4.7 und Kapitel 5**
  aufgefallen und **nicht selbst entschieden** worden:
  - **31** Sammelprüfung P10 gegen Pflichtkatalog 5.4.4: 4.7 ordnet Q21, Q42,
    Q43 und Q44 eine **Sperre** zu, der Katalog führt `qualificationCertificate`
    und `clearanceCertificate` aber als „nie Sperre"; umgekehrt bleibt Q10
    **Information**, während der Katalog einen fehlenden Qualifikationsnachweis
    als Warnung führt. Die Szenarien rechnen nach dem **Katalog**, weil 5.4.6
    für fehlende Nachweise ausdrücklich dorthin verweist, und benennen die
    Abweichung im Kommentar über dem Szenario
    (`permit-and-deadlines.feature`).
  - **32** Rangfolge in 5.2.2: bei `equalPayDeadlineMonths` über 15 **ohne**
    Branchenzuschlagsschema treffen Fall 5 (9 Monate) und Fall 6 (15 Monate)
    beide zu, eine Rangfolge nennt die Tabelle nicht. Diese Kombination ist in
    `equal-pay.feature` **ausgelassen**; geprüft werden nur die eindeutigen
    Fälle 1 bis 5 und die Begrenzung auf 15 mit Schema.
- **Dokumentarische Unschärfe in 3.6, keine Fachfrage:** das Feld
  `previousEmploymentDeclaration` ist dort „optional; vor dem Übergang des
  Einsatzes nach `planned` erforderlich", während 5.3.1 und Q12 die Sperre
  schon bei der **Zusage** des Profilvorschlags setzen. Die Szenarien folgen
  5.3.1 (Sperre bei Q12 und Q15); die Klammerbemerkung in 3.6 sollte beim
  nächsten Durchgang durch Kapitel 3 nachgezogen werden.
- **Kein Runner, keine Step-Definitions** — bis zum Projektsetup (M3) sind alle
  Szenarien formal „rot" im Sinne von „nicht ausgeführt". Dass sie ausführbar
  werden, ist ein Punkt von M3, nicht von M2.
- **Noch nicht abgeleitet:** die Zeilen des nächtlichen Laufs sind abgedeckt,
  die Prüfungen bei der **Speicherung** (5.5.1 b) nur dort, wo eine
  rückwirkende Änderung sie auslöst. Ein eigener Satz Szenarien „Speichern
  sperrt nie" je Feld ist bewusst nicht entstanden — die Regel ist in drei
  Szenarien belegt, eine Vervollständigung gehört zu M4.
- **Kapitel 6 (Datenschutz) ist weiter Gliederung**; Löschfristen und
  Aufbewahrung berühren die Aufzeichnungspflichten aus 5.4.7 (Frage 22).

## 2026-10-20 — SPEC Kapitel 5: AÜG-Regeln (M2)

**Gemacht**

- **Kapitel 5 vollständig ausgearbeitet**, 5.0 bis 5.5, rund 1.500 Zeilen. Die
  Gliederungspunkte mit `TODO` sind ersetzt; in Kapitel 5 steht kein `TODO`
  mehr. Nur `SPEC.md`, `PROGRESS.md` und `MILESTONES.md` geändert, nichts
  committet. Kein Anwendungscode, **keine Testdateien** — `tests/aueg/` ist
  unberührt, die Szenarien sind der nächste Schritt.
- **Neuer Abschnitt 5.0 „Konventionen für alle Regeln"** (analog 3.0 und 4.0):
  Lesart, Stichtag und Prüfzeitraum je Prüfanlass als Tabelle,
  Fristenarithmetik nach §§ 187 Abs. 2, 188 Abs. 2 und 3 BGB, die
  **Überlassungskette** als gemeinsame Rechengrundlage von 5.1 und 5.2, der
  Grundsatz für fehlende Daten, die Festwerte des Regelwerks und eine Liste
  dessen, was das Kapitel nicht tut.
- **5.1 Höchstüberlassungsdauer** (P1, P2): Rangfolge der Grenze
  (Standort → Kunde → Regelgrenze 18 Monate, Verleiherseite ausdrücklich
  irrelevant), siebenschrittige Berechnungsvorschrift mit Eingangsdaten E1–E7,
  Tagebudget und Ableitung von `maxDurationEndDate`, die Drei-Monats-Regel in
  einer Formel mit drei Rechenbeispielen, zwölf Grenzfälle, Schwellen und
  Eskalation, Rechtsfolge nach §§ 9, 10, 16 AÜG, sieben Fälle fehlender Daten.
- **5.2 Equal Pay** (P3, P4, P5): sechs Datenlagen für die Frist, darunter die
  wichtigste — **ohne Verleihertarif gilt Equal Pay ab dem ersten
  Überlassungstag**, nicht nach neun Monaten. Berechnung von `equalPayDueDate`,
  Verwendbarkeitsprüfung des Vergleichsentgelts samt `estimate`-Behandlung,
  Stufenbestimmung des Branchenzuschlags ohne eine einzige Tarifzahl, elf
  Grenzfälle.
- **5.3 Drehtür, Arbeitskampf, Kennzeichnung** (P6, P7, P8, P11): Herkunft und
  Form der Erklärung zur Vorbeschäftigung festgelegt (3.6 verwies hierher), die
  fünf Prüfkriterien K1–K5 der Konkretisierung, der Prüfzeitpunkt für P11
  festgelegt (3.6 verwies hierher), Abgrenzung zu Werk- und Dienstvertrag.
- **5.4 Erlaubnis und Nachweise** (P9, P10): tagesgenaue Deckungsprüfung über
  die historisierten Erlaubnissätze, die **zwei Entscheidungen, die 4.6 offen
  gelassen hatte**, der **Nachweisfluss des Dokuments** (3.10 und 4.0 verwiesen
  hierher), der Pflichtkatalog um Prüfzeitpunkt, Fristen und Ablaufbehandlung je
  Art erweitert, Aufzeichnungspflichten nach §§ 7, 17 AÜG.
- **5.5 Regelwerk-Mechanik**: drei Prüfanlässe (Statusübergang, Speicherung,
  nächtlicher Lauf mit den Zeilen N1–N6), die drei Ergebnisarten bestätigt und
  um sechs Festlegungen ergänzt, Stichtagslogik und sieben Regeln R1–R7 für
  rückwirkende Änderungen, die Übersteuerung mit sechs Invarianten und einer
  Übersteuerbarkeitstabelle je Prüfung.
- **Die Spalte „Ergebnisart" in 4.7 ist entschieden** (M2-Punkt): alle 44 Zeilen
  durchgegangen, **38 bestätigt mit Begründung, 6 geändert, 4 neu**. 4.7 ist
  nachgezogen — Spaltenname ohne „Vorschlag", geänderte Zeilen mit Vermerk
  *(geändert, 5.5.5)*, Q45–Q48 ergänzt.
- **Kapitel 4 nachgezogen**, wo 5.5 etwas ändert: 4.0 (Nachweis-Vorlauf,
  Statusmodell des Dokuments), 4.2.3 und seine Prüfungstabelle, 4.3.1
  (Vorbedingungen von → `planned` und `planned` → `active`,
  `interrupted` → `active`, Beendigung aus Rechtsgründen), 4.3 Prüfungstabelle,
  4.4 (Zettelgenehmigung), 4.6 (automatische Sperre, laufende Einsätze), 4.7
  (Szenarienregel 1, Abschlussabsatz).
- **Kapitel 3 nachgezogen**, wo es auf Kapitel 5 verwies: 3.2 (`supplierPermit`
  Statusmodell), 3.6 (`previousEmploymentDeclaration`), 3.7 (Unterbrechung),
  3.10 (Statusmodell des Dokuments). **Kein Feld hinzugefügt** — Kapitel 3
  bleibt führend.
- **Glossar 1.5 um 23 Einträge** ergänzt (Rechen- und Prüfbegriffe), in dieselbe
  Tabelle. Der TODO-Marker an 1.5 ist auf „TODO (Kapitel 6)" reduziert.
- **Kapitel 7 um die Fragen 26 bis 30** ergänzt, davon drei als „juristisch zu
  prüfen" gekennzeichnet. Die Tabelle war zwischen Zeile 24 und 25 in zwei
  Tabellen zerfallen — zusammengeführt. Status von Frage 10 um den Hinweis
  erweitert, dass 5.5.4 jede Antwort verträgt.
- **Kopfzeile der SPEC** von „Status: Gliederung" auf „Status: in Arbeit" mit
  Angabe der ausgearbeiteten Kapitel umgestellt — die alte Aussage war mit
  4.800 Zeilen nicht mehr richtig.

**Entscheidungen**

| Thema | Entscheidung |
|---|---|
| Zählgröße | **Überlassungstage, nicht Monate.** Die Monatsgrenze wird nach BGB-Fristenarithmetik in ein **Tagebudget** ab Kettenbeginn umgerechnet; gezählt werden Kalendertage. Keine Umrechnung Monat → 30 Tage, keine Rundung |
| Gemeinsame Rechengrundlage | 5.1 und 5.2 rechnen auf **derselben Überlassungskette** — § 8 Abs. 4 Satz 4 wiederholt die Drei-Monats-Regel des § 1 Abs. 1b Satz 2. Das ist die Struktur des Gesetzes und hält die Szenarien konsistent |
| Lückentage | Verbrauchen **Kalenderzeit, aber kein Fristbudget**: `maxDurationEndDate` und `equalPayDueDate` verschieben sich um die Lückentage nach hinten. Additive Lesart; die kalendarische wäre strenger → **Frage 26**, juristisch zu prüfen |
| Exakt drei Monate | **Kein Reset.** „Nicht mehr als drei Monate" schließt den Grenzfall ein; Formel und drei Rechenbeispiele stehen in 5.1.4 |
| Welche Tarifseite gilt | **5.1 liest die Entleiherseite** (Standort, dann Kunde) — die Öffnungsklausel des § 1 Abs. 1b ist eine Regelung der Einsatzbranche. **5.2 liest die Verleiherseite** — die Abweichung vom Gleichstellungsgrundsatz ist eine Regelung des Zeitarbeitstarifs |
| Ohne Verleihertarif | **Equal Pay ab dem ersten Überlassungstag**, nicht nach neun Monaten. Die Frist setzt den Tarifvertrag voraus (§ 8 Abs. 2, 4 AÜG). Die Regelfrist 9 gilt nur, wenn eine Zuordnung besteht und keinen abweichenden Wert nennt |
| Gesetzliche Schranken | 15 Monate (§ 8 Abs. 4 Satz 2) und die Bindung der Verlängerung über 9 Monate an ein Branchenzuschlagsschema sind **Gesetzeswerte** und werden erzwungen: ein höherer oder unzulässig konfigurierter Wert wird begrenzt und erzeugt eine Warnung an `MA` |
| Fehlende Daten | **Eine fehlende Rechengrundlage wirkt wie ein Treffer, nicht wie ein Freibrief.** Einzige Ausnahme: eine fehlende Arbeitskampfanzeige (sonst wäre jeder Einsatzstart gesperrt) — die Ausnahme ist benannt und begründet |
| Fehlende Tarifzuordnung | Der einzige Fall mit definiertem Ersatzwert, weil das Gesetz ihn liefert: 18 Monate (5.1), bzw. Equal Pay ab Tag eins (5.2). Immer mit Information, damit eine vergessene Zuordnung nicht als Entscheidung durchgeht |
| Lieferantenwechsel | Ein Einsatz gehört zu genau einem Lieferanten — ein Wechsel ist `terminatedEarly` plus **neuer** Einsatz. Die Kette läuft über beide (§ 1 Abs. 1b Satz 2: „denselben oder einen anderen Verleiher"), die Equal-Pay-Frist kann sich ändern, weil sie vom Verleihertarif kommt |
| Kriterium für Sperren | **Eine Sperre ist nur dort richtig, wo ein Weg offensteht, sie rechtmäßig aufzulösen.** Dieses eine Kriterium trägt alle sechs Änderungen in 4.7 |
| Drehtürklausel (Q12, Q15) | **Von Sperre auf Warnung.** § 8 Abs. 3 AÜG untersagt die Überlassung nicht — er nimmt die tarifliche Abweichung. Rechtsfolge ist Equal Pay ab dem ersten Tag. **Sperre bleibt nur bei fehlender Erklärung**, weil dann die Tatsachengrundlage fehlt |
| Arbeitsverhältnis (Q13, Q17) | **Von Sperre auf Warnung.** Es muss am ersten Überlassungstag bestehen, nicht bei der Zusage oder Einsatzplanung — ein Kandidat als `applicant` ist der Regelfall der Branche. Die Sperre wandert in die neue Zeile **Q47** (Einsatzstart) |
| Wiederaufnahme (Q26) | **Von Warnung auf Sperre**, wenn das Fristende erreicht ist. `interrupted` → `active` ist ein Überlassungsbeginn wie `planned` → `active`, und dort sperrt Q23 — eine Warnung wäre ein Widerspruch im selben Statusmodell |
| Zettelgenehmigung (Q35) | **Von Sperre auf Warnung mit Pflicht-Eskalation.** Die Zeiten sind erbracht; die Sperre verhindert keine Überlassung, sondern nur die Abrechnung geleisteter Arbeit, belastet Leiharbeitnehmer und Lieferant für einen Fehler des Betreibers und erzeugt einen hängenden Zettel (Frage 24) |
| Vergleichsentgelt (Q36) | **Sperre bestätigt**, aber präzisiert: nur bei **keinem verwendbaren** Eintrag. `wageSource = estimate` lässt den Übergang zu und warnt (3.3). Unterschied zu Q35: hier steht ein zumutbarer Weg offen, und ihn zu gehen ist die Pflicht des Entleihers |
| Vier neue Zeilen | **Q45, Q46** (Kennzeichnung und Konkretisierung am Einsatz und am Einsatzstart — die schärfste Rechtsfolge des AÜG war in 4.7 nur an der Bedarfsanfrage geprüft), **Q47** (Arbeitsverhältnis am Einsatzstart), **Q48** (Vergleichsentgelt, wenn Equal Pay ab Tag eins geschuldet ist). Keine Zeile entfernt, keine umbenannt |
| Erlaubnis sperrt nicht automatisch (4.6, Frage a) | **Nein, kein automatischer Übergang nach `blocked`.** Die Wirkung tritt ohne Statuswechsel über P9 ein; der nächtliche Lauf eskaliert mit dem Vorschlag zu sperren, den Übergang vollzieht ein Mensch mit `blockReason`. Ein Systemübergang würde die Pflichtbegründung und das Vier-Augen-Prinzip aus [5] unterlaufen |
| Laufender Einsatz bei Erlöschen (4.6, Frage b) | **Das System beendet ihn nicht.** Einsatzstart und Verlängerung sind gesperrt, der laufende Einsatz erzeugt eine tägliche Warnung mit Pflicht-Eskalation, der Übergang `terminatedEarly` aus Rechtsgründen steht bereit. Die Rechtsfolge hängt vom Erlöschensgrund ab → **Frage 29** |
| Sperre je Einladung | Q04 wirkt **je Lieferant**: ein gesperrter Lieferant wird nicht eingeladen, die Ausschreibung findet statt, solange eine zulässige Einladung bleibt. Nur wenn kein Lieferant zulässig ist, ist der Übergang gesperrt |
| Prüfung sperrt nie das Speichern | Gesperrt werden **Handlungen** (Statusübergänge), nicht **Feststellungen**. Eine Korrektur der Wahrheit darf nicht daran scheitern, dass die Wahrheit unbequem ist |
| Rückwirkende Änderungen | Neuberechnung ja, Rückbau von Übergängen nein. Ein Verstoß in der Vergangenheit wird **festgestellt und eskaliert**, nicht gesperrt — es gibt nichts mehr zu sperren. Genehmigte Zettel und freigegebene Belege werden nicht entwertet |
| Übersteuerung (Frage 10) | **Dreiteiliger Grundsatz:** die Angabe ist nachweislich unrichtig, die Berichtigung nicht rechtzeitig möglich, **und** die Überlassung wäre nach richtiger Datenlage zulässig. Fehlt das Dritte, ist die Sperre nicht übersteuerbar. Eine Übersteuerung korrigiert eine falsche Datenlage, sie erlaubt keine rechtswidrige Überlassung. P4, P6, P7 und P8 sind **nicht** übersteuerbar |
| Vorlauffristen | **Festwerte des Regelwerks**, nicht je Kunde konfigurierbar und keine Tarifwerte: sie beschreiben, wie früh gewarnt wird, nicht was rechtlich gilt. Sie stehen in 5.0 und 5.4.4, nicht in `processDeadlineConfig` |
| Grenze der Prüfbarkeit | Ausdrücklich benannt statt stillschweigend überspielt: das System kann nicht feststellen, ob Equal Pay **gezahlt** wurde (kein Entgelt im Modell → **Frage 28**), ob eine Tätigkeitsbeschreibung die Wirklichkeit trifft, ob eine Überlassung verdeckt läuft, oder ob eine Erlaubnis widerrufen wurde, ohne dass es jemand einträgt |

**Offen**

- **Fünf neue offene Fragen, 26 bis 30** (damit 22 von 30 offen):
  - **26** *(juristisch)* Zählen Unterbrechungen bis drei Monate als
    Überlassungsdauer mit? 5.1.3 und 5.2.3 rechnen additiv; bei anderer Antwort
    ändert sich nur je ein Rechenschritt.
  - **27** *(juristisch)* Welche Grenze gilt, wenn sich der Monatswert während
    einer laufenden Kette ändert? Heute: Wert am Stichtag.
  - **28** Soll der Verleiher das tatsächliche Entgelt melden, damit Equal Pay
    prüfbar wird? Betrifft 5.2, 6.3, 6.4.
  - **29** *(juristisch)* Rechtsfolge des Erlöschens der Erlaubnis für laufende
    Überlassungen (Abwicklungszeitraum, Erlöschensgrund) und wer die Beendigung
    entscheidet.
  - **30** Wie wird ein Arbeitskampf erfasst, und wer gibt die Zusicherung nach
    § 11 Abs. 5 Satz 2 AÜG ab?
- **Widerspruch zu Kapitel 3, nicht stillschweigend aufgelöst: 3.1 führt kein
  Feld für die Arbeitskampfanzeige** und 3.7 kein Objekt für die Zusicherung,
  obwohl 4.7 sie in Q05 und Q22 voraussetzt. 5.3.2 beschreibt die benötigten
  Angaben, **erfindet aber kein Feld** und nennt den Behelf (`document` mit
  `documentCategory = other`). Der Feldsatz gehört nach 3.1 bzw. 3.7 und ist mit
  **Frage 30** zu entscheiden. Dies ist die einzige echte Datenlücke, die
  Kapitel 5 gefunden hat.
- **Spannung zu 3.12:** Die Übersteuerung wird heute nur als Audit-Eintrag mit
  `reason` geführt. Braucht sie ein eigenes Objekt mit Antrag, Entscheidung und
  Nachfrist, entscheidet die Antwort auf **Frage 10**; 5.5.4 hält die Stelle
  offen und nennt, was sich dann in Kapitel 2 und 3 ändert.
- **Frage 24 ist entschärft, nicht gelöst:** mit der Änderung von Q35 entfällt
  ein Anlass für hängende Stundenzettel (eine AÜG-Sperre an der
  Zettelgenehmigung), der Grundkonflikt zwischen Periodenschluss und
  unentschiedenen Zetteln bleibt.
- **Als Nächstes: die Szenarien in `tests/aueg/`** — 48 Zeilen aus 4.7, sechs
  Zeilen N1–N6 aus 5.5.1 und die Grenzfalltabellen aus 5.1.5, 5.2.6, 5.3 und
  5.4.5. Je Zeile mindestens zwei Szenarien, bei übersteuerbaren Sperren ein
  drittes, bei nicht übersteuerbaren ein Szenario, das den Versuch zurückweist.
  Erst danach Anwendungscode.
- **Nicht angefasst**, weil nicht Auftrag dieser Arbeitseinheit: die weiter
  fehlenden Statusmodelle für Rahmenvertrag und Preisliste (3.3, 4.0) und
  Kapitel 1 und 6.
- Noch offen: 2, 4, 5, 7–14, 16, 17, 21, 22, 24–30.

---

## 2026-10-20 — Fragen 15, 18, 19, 20 entschieden (M2-Vorbereitung)

**Gemacht**

- Die vier Fragen, die Kapitel 5 blockierten, sind entschieden und an allen
  betroffenen Stellen eingearbeitet. Mit der neuen Frage 25 sind jetzt 17 von
  25 Fragen offen.
- **Neues Objekt `comparableWageEntry` in 3.3** (Frage 15): Vergleichsentgelt
  je Tätigkeit und Standort, mit Gültigkeitszeitraum und Herkunftsangabe
  (`wageSource`). Dazu eine neue Matrixzeile „Vergleichsentgelt (3.3)" und die
  Umstellung von `comparableWage` in 3.7 auf „erbt aus dem Standorteintrag,
  begründet übersteuerbar". Die Kapitelüberschrift 3.3 ist erweitert.
- **3.6 Personenidentität** (Frage 18): Merkmalssatz abschließend festgelegt,
  Verfahren in vier Punkten beschrieben (Vorschlag statt Verknüpfung, manuelle
  Bestätigung, enge Zweckbindung, Unsichtbarkeit für Kunden und Lieferanten).
  `workerIdentityRef` am Einsatz ist von optional auf „Pflicht ab `planned`"
  gezogen; die Abhängigkeitsnotiz in 4.2 ist durch eine Präzisierung ersetzt.
- **3.10 Pflichtkatalog** (Frage 20): Tabelle mit sechs Nachweisarten und
  gestufter Wirkung; `mandatory` und `blocking` sind jetzt **abgeleitete**
  Felder, die dem Katalog in 5.4 folgen und nicht am Dokument gesetzt werden.
  Die acht `(offene Frage 20)`-Marken in 4.3, 4.6 und 4.7 sind entfernt, weil
  die Ergebnisarten damit verbindlich sind.
- **5.1, 5.2 und 5.4**: die betroffenen Gliederungspunkte tragen jetzt die
  Festlegung und nur noch den Rest als TODO.
- Glossar um fünf Einträge ergänzt.

**Entscheidungen**

| Thema | Entscheidung |
|---|---|
| Vergleichsentgelt (Frage 15) | **Je Tätigkeit am Standort**, gepflegt vom Entleiher (`KE`), mit Herkunftsangabe. Der Einsatz erbt den Wert und kann ihn begründet übersteuern. `wageSource = estimate` ist eine Warnung, kein Nachweis |
| Sichtbarkeit des Entgeltgefüges | Der Katalog ist für **Lieferantenrollen nicht sichtbar** — der Verleiher erhält den Wert nur für den konkreten Einsatz über `comparableWage` (3.7), nicht das Entgeltgefüge des Entleihers insgesamt |
| Personenidentität (Frage 18) | **Wird geführt.** Abgleich ausschließlich über Name, Geburtsdatum, Geburtsort — keine Sozialversicherungs-, Steuer- oder Ausweisnummern |
| Maschineller Treffer ist keine Identität | Ein nur vorgeschlagener, nicht bestätigter Treffer löst **keine** AÜG-Prüfung aus; bis zur Bestätigung zählt der Kandidatensatz als eigene Person |
| Gleichzeitige Einsätze (Frage 19) | **Zulässig.** Gezählt werden Kalendertage der Überlassung an denselben Entleiher über die Personenidentität; überlappende Tage zählen genau einmal. Keine Stundenzählung, keine Summierung je Einsatz |
| Pflichtnachweise (Frage 20) | **Fester Katalog, gestufte Wirkung.** Sperre: AÜG-Erlaubnis, Arbeitserlaubnis, Unterweisung am Standort. Warnung: Qualifikationsnachweis, Unbedenklichkeitsbescheinigung. Information: sonstige. Kein kundenindividueller Katalog im Prototyp |
| Rechtliches wird nicht mitentschieden | Die fachliche Entscheidung zu Frage 18 steht, die datenschutzrechtliche Absicherung ist als **Frage 25** ausdrücklich offen und als juristisch zu prüfen gekennzeichnet — nicht implizit mit abgehakt |

**Offen / als Nächstes**

- **Neue offene Frage 25:** Rechtsgrundlage der Personenidentität —
  Verantwortlichkeit im MSP-Modell, Rechtsgrundlage nach Art. 6 DSGVO,
  Informationspflicht gegenüber dem Leiharbeitnehmer, Löschfrist. Betrifft
  3.6, 6.1, 6.3, 6.5 und braucht juristische Prüfung.
- Kapitel 5 ist jetzt ausarbeitbar: 5.1, 5.2 und 5.4 haben ihre
  Datengrundlage, 5.3 hängt an keiner offenen Frage mehr, 5.5 braucht noch
  Frage 10 (Genehmigung von Ausnahmen).
- Danach M2: die Gherkin-Szenarien aus der 44-zeiligen Tabelle in 4.7
  ableiten.
- Noch offen: 2, 4, 5, 7–14, 16, 17, 21, 22, 24, 25.

---

## 2026-10-20 — Blocker entschieden, fünf Widersprüche aufgelöst (M1)

**Gemacht**

- **Vier offene Fragen entschieden** (1, 3, 6, 23) und die Entscheidungen an
  allen betroffenen Stellen eingearbeitet, nicht nur in Kapitel 7. Damit sind
  20 der 24 Fragen noch offen.
- **Die fünf Widersprüche aus der Kapitel-4-Übergabe sind erledigt:**
  1. *2.2 ↔ 3.5 (Absage einer Einladung)* — `LD` erhält in der Matrix
     `S[46]`: ein eng begrenztes Statusrecht auf die **eigene** Einladung.
     Neue Fußnote [46]; der Hinweis in 4.2.1 und die Übergangszeile
     `invited`/`viewed` → `declined` sind nachgezogen.
  2. *3.4 ohne Feld für den Rückweisungsgrund* — neues Feld
     `rejectionReason` in 3.4, Pflicht bei Rückweisung und für den
     Bedarfsträger sichtbar. Der Audit-Eintrag entsteht zusätzlich, ersetzt
     das Feld nicht.
  3. *3.6 `submittedAt` als unbedingte Pflicht* — korrigiert auf „Pflicht ab
     Status eingereicht", mit Verweis auf `X[21]`.
  4. *2.2 ↔ Rechnungseingang* — entfällt mit der Entscheidung für das
     Gutschriftverfahren; die Matrix bleibt unverändert, Fußnote [32]
     begründet jetzt, **warum** die Zeile kein `A` trägt.
  5. *3.7 ohne eigenen Beendigungsvorgang* — bleibt bewusst asymmetrisch zur
     Verlängerung; die Begründung steht jetzt als Hinweis in 3.7 statt nur im
     Protokoll.
- `CLAUDE.md`: Abschnitt Tech-Stack von „noch nicht entschieden" auf die
  getroffene Wahl umgestellt, mit zwei Leitsätzen für die Umsetzung
  (Statusübergänge typisiert, Tarifwerte als Konfiguration).
- `MILESTONES.md`: die beiden Blocker unter M1 auf ✅.
- Kein Anwendungscode.

**Entscheidungen**

| Thema | Entscheidung |
|---|---|
| Tech-Stack (Frage 1) | Next.js (App Router) mit TypeScript, PostgreSQL über Prisma. Kürzester Weg zu M3/M4; die Statusmodelle aus Kapitel 4 werden als typisierte Übergänge abgebildet |
| Tarifwerk (Frage 3) | **Konfiguration, nicht verdrahtet.** Fristen, Abweichungen und Zuschlagsstufen sind Daten an der Tarifzuordnung (3.3); Kapitel 5 spezifiziert nur die Mechanik. Ein konkretes Tarifwerk wird als erste Belegung angelegt, die Szenarien in `tests/aueg/` prüfen gegen eine synthetische Beispielbelegung |
| Abrechnung (Frage 6) | **Gutschriftverfahren.** Der Betreiber erstellt `supplierCreditNote`, der Lieferant bestätigt oder beanstandet. Der Rechnungseingang bleibt als Variante „Einkauf B" in 4.5 dokumentiert, wird im Prototyp aber nicht umgesetzt |
| Absage einer Einladung (Frage 23) | `LD` sagt selbst ab, analog [20] auf den eigenen Vorgang begrenzt. Annahme, Fristverlängerung und Ausschreibungsfortschritt bleiben beim Betreiber |
| Dokumentierte, nicht umgesetzte Varianten | Werden **nicht** aus der SPEC entfernt, sondern als solche gekennzeichnet — so bleibt nachvollziehbar, was bewusst weggelassen wurde und was es kosten würde, es nachzuziehen |

**Offen / als Nächstes**

- Noch offen: Fragen 2, 4, 5, 7–22, 24 (20 Stück). Für M2 blockierend sind vor
  allem **18** (Personenidentität über Lieferanten hinweg — ohne sie keine
  Zählung nach 5.1), **15** (Vergleichsentgelt für Equal Pay) und **20**
  (Pflichtnachweise und ihre Sperrwirkung).
- Kapitel 5 (AÜG-Regeln) ist jetzt nicht mehr durch die Tarifvertragsfrage
  blockiert und kann ausgearbeitet werden — 5.1 und 5.2 brauchen aber die
  Antworten auf 15, 18 und 19.
- Mit der Stack-Entscheidung ist M3 entsperrt: Projektsetup, Mandanten- und
  Rollenmodell, danach die klickbare Demo.
- Statusmodelle, die weiter fehlen (aus der Kapitel-4-Übergabe): Rahmenvertrag
  und Preisliste (3.3), Dokument/Nachweis (3.10, gehört nach 5.4), Kunde /
  Standort / Kostenstelle (3.1, nur aktiv/inaktiv).

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
