-- SPEC 5.5.1, „Der ausgebliebene Lauf wird gemeldet": ein eigener Anlass für
-- die Benachrichtigung über ausgefallene Läufe. Er entsteht in dem Lauf, der
-- die Lücke schließt — das System kann sein eigenes Schweigen nicht melden.
ALTER TYPE "NotificationTrigger" ADD VALUE 'nightlyRunMissed';
