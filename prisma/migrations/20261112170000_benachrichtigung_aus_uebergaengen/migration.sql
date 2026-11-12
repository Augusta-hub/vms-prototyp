-- Benachrichtigungen aus den Übergängen in Kapitel 4 (SPEC 3.14, 4.0 Regel 8).
--
-- Drei Änderungen, alle aus 3.14:
--
--  1. Zwei neue Anlässe. `statusTransition` ist der Übergang selbst — die
--     Spalte „Nebenwirkungen" in Kapitel 4 nennt je Zeile die Adressaten.
--     `ruleWarning` ist die Warnung aus 4.7, die derselbe Übergang auslöst:
--     „erzeugt eine Benachrichtigung an die zuständige Rolle und einen
--     Eskalationsanlass".
--  2. `statusFrom` / `statusTo`, damit die Nachricht sagt, welcher Übergang
--     sie ausgelöst hat — derselbe Zuschnitt wie im Audit-Eintrag (3.12).
--     `statusFrom` bleibt leer, wo Kapitel 4 „—" führt, also bei der Anlage.
--  3. Der partielle Index auf `runDate IS NULL` wird **aufgehoben**. Er war
--     für den nächtlichen Lauf gebaut, der täglich über denselben Bestand
--     läuft; eine Benachrichtigung aus einem Übergang entsteht dagegen einmal
--     mit ihrem Übergang, und derselbe Übergang kann sich am selben Vorgang
--     wiederholen: 4.4 führt `inApproval` → `inApproval` je Freigabestufe, und
--     ein Beleg kann nach geklärter Beanstandung erneut freigegeben und erneut
--     beanstandet werden (4.5). Der Index hätte genau die zweite Nachricht
--     verschluckt — die, auf die jemand wartet.
--
-- Die Eindeutigkeit des Laufs bleibt unberührt: `Notification_trigger_..._key`
-- enthält `runDate`, und zwei Zeilen mit `runDate IS NULL` sind in SQL nie
-- gleich.

ALTER TYPE "NotificationTrigger" ADD VALUE 'statusTransition';
ALTER TYPE "NotificationTrigger" ADD VALUE 'ruleWarning';

ALTER TABLE "Notification" ADD COLUMN "statusFrom" TEXT,
                           ADD COLUMN "statusTo" TEXT;

DROP INDEX IF EXISTS "Notification_ohne_lauf_key";
