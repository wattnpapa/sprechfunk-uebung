# ADR 0008: Firestore-Regeln als Teil des Deployments

## Status
Accepted. Ersetzt den Deploy-Weg aus [ADR 0007](0007-firestore-regeln-deploy.md); dessen
Zugangsdaten, Fehlerverhalten und das Kommando `npm run rules:deploy` bleiben.

## Context

ADR 0007 deployte `firestore.rules` über einen eigenen Workflow, der nur lief, wenn ein Push
auf `main` die Regeldatei anfasste, und bewusst vom Website-Release entkoppelt war. Am
2026-09-30 lief dieser Workflow grün, und trotzdem lehnte Firestore danach **jedes** Speichern
ab, klassische Übungen eingeschlossen. Ursache war nicht der Deploy, sondern die Regeln
selbst: Firestore wertet höchstens 1000 Ausdrücke je Anfrage aus. Der Helfer
`optionalOk(daten, feld, …)` prüfte die Anwesenheit jedes optionalen Felds über
`daten.keys().hasAny([feld])`, und `keys()` zählt mit der Zahl der Dokumentfelder. Mit dem
27. optionalen Feld (`fuehrungsstelle`) lag ein vollständiges Dokument mit 36 Feldern über
dem Limit. Kein Test im Repository konnte das sehen: Der Vertragstest liest nur Feldlisten,
und E2E läuft im Mock-Modus ohne Firestore.

Zwei Lücken wurden dabei sichtbar:

1. Der Regel-Deploy war ein eigener Vorgang neben dem Website-Deploy. Ob er gelaufen ist,
   musste man in einem zweiten Workflow nachsehen; die Website konnte vor den Regeln live
   gehen, und ein ausgefallener Lauf wurde erst beim nächsten Push nachgeholt, der die
   Regeldatei berührte. Der Betreiber will die Regeln als Teil des Deployments, nicht als
   Nebenpfad mit manueller Rückfallebene.
2. Ob Firestore die Regeln überhaupt auswerten kann, prüfte nichts.

## Decision

- Der Regel-Deploy ist ein Job `firestore-rules` in `.github/workflows/main.yml`. Er läuft bei
  **jedem** Push auf `main` (und bei `workflow_dispatch`), ohne Pfadfilter: `firebase deploy
  --only firestore:rules` ist idempotent, und die CLI räumt alte Regelversionen an der Quote
  selbst ab. So holt jeder Push auch einen früher ausgefallenen Deploy nach.
- Der Job `deploy` (GitHub Pages) hängt von `firestore-rules` ab und läuft nur bei dessen
  Erfolg. Reihenfolge: erst Regeln, dann Website. Ein neuer Stand von `dist/` trifft nie auf
  alte Regeln.
- Fehlt das Repository-Secret `FIREBASE_SERVICE_ACCOUNT`, schlägt der Job fehl und **hält die
  Website zurück**. Das ist gewollt: Eine Website, deren Schreibzugriffe Firestore ablehnt, ist
  kein Release.
- `.github/workflows/firestore-rules.yml` entfällt. Es gibt genau einen Deploy-Weg;
  `tests/repo/FirestoreRulesDeploy.test.ts` lehnt einen zweiten ab.
- `tests/rules/FirestoreRules.emulator.test.ts` schreibt im Firestore-Emulator Dokumente, wie
  `GenerationService` und `FirebaseService` sie wirklich erzeugen (klassisch mit 10 und 100
  Teilnehmern, Führungsstellen-Übung mit größter Rollenbesetzung, minimal, Statusdokumente),
  und verlangt eine Reserve: Mit 40 zusätzlichen `&& true`-Gliedern (rund 120 Ausdrücke)
  müssen die Regeln noch unter dem Limit bleiben. Gemessen am 2026-10-01 lassen die Regeln
  rund 80 Glieder zu, ein vollständiges Dokument liegt also bei etwa 750 Ausdrücken. `npm run rules:test` startet den Emulator
  über `firebase-tools` per `npx` gegen das Projekt `demo-sprechfunk` (nie gegen Produktion);
  der Job `firestore-rules-emulator` in `ci.yml` führt ihn in jedem Pull Request aus, als
  Hinweis-Job, nicht als Required Check (ADR 0001).
- In `firestore.rules` prüfen optionale Felder ihre Anwesenheit über `'feld' in daten` statt
  über `keys()`, und die Prüfungen stehen ausgeschrieben statt in Hilfsfunktionen: Im Emulator
  kostet ein Aufruf rund vier Ausdrücke zusätzlich, ein Zahlencheck über Helfer etwa 25 statt
  16. Der Vertragstest verbietet `keys().hasAny(` und erlaubt `keys()` nur für die Allowlists.
  Der Kommentar vor `istGueltigeUebung` nennt die gemessenen Kosten je Konstrukt.
- `@firebase/rules-unit-testing` kommt als devDependency dazu (klein, nutzt das ohnehin
  vorhandene `firebase`). `firebase-tools` bleibt außerhalb von `package.json` und kommt per
  `npx`, wie in ADR 0007 begründet.

## Consequences

- Ein Push auf `main` deployt Regeln und Website in dieser Reihenfolge oder gar nichts.
  Der rote Haken auf `main` bei fehlendem Secret trifft jetzt auch die Website – das ist der
  Preis dafür, dass niemand mehr an den Regel-Deploy denken muss.
- Jeder Push erzeugt eine Regelversion bei Firebase, auch ohne Änderung. Die CLI löscht an
  der Quote die ältesten; Kosten entstehen nicht.
- Der Emulator-Job braucht Java und lädt Emulator und CLI bei jedem Lauf (etwa eine Minute).
  Dafür fällt eine Regeländerung, die Produktion das Speichern verbieten würde, im Pull
  Request auf, nicht nach dem Merge.
- Die geforderte Reserve von rund 120 Ausdrücken reicht für etwa sechs weitere optionale
  Felder; tatsächlich frei sind derzeit rund 250. Wird die Reserve knapp, sind die Regeln zu
  verschlanken, nicht die Reserve zu senken.

## Nicht gewählt

- **Regeln nur deployen, wenn `firestore.rules` sich geändert hat** (`dorny/paths-filter` im
  Job). Spart einen idempotenten Aufruf, lässt aber einen ausgefallenen Deploy bis zur nächsten
  Regeländerung liegen.
- **Regel-Deploy nach dem Website-Deploy.** Dann liefe die neue Website kurzzeitig gegen alte
  Regeln – genau der Zustand, den der Job verhindern soll.
- **Emulator-Test als Required Check.** Er hängt an Downloads von Emulator und CLI; ein
  ausgefallener Download dürfte keinen Merge blockieren. Als Hinweis-Job ist er sichtbar genug.
- **Weniger Prüfungen in den Regeln, um Budget zu sparen.** Die Typ- und Längenprüfungen sind
  der Zweck der Regeln (ADR 0005). Gespart wird an der Form (`in` statt `keys()`, keine
  Hüllfunktion), nicht am Inhalt.
