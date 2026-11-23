-- Bundesland des Standorts (SPEC 3.1) — es bestimmt die Feiertage der
-- Arbeitstagfristen aus 4.0. Optional: fehlt es, gelten nur die
-- bundeseinheitlichen Feiertage.

-- CreateEnum
CREATE TYPE "FederalState" AS ENUM ('BW', 'BY', 'BE', 'BB', 'HB', 'HH', 'HE', 'MV', 'NI', 'NW', 'RP', 'SL', 'SN', 'ST', 'SH', 'TH');

-- AlterTable
ALTER TABLE "Site" ADD COLUMN     "federalState" "FederalState";

