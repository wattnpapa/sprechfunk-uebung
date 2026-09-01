# ADR 0007: Firestore-Regeln per Workflow deployen

## Status
Accepted

## Context

`firestore.rules` liegt seit ADR 0005 im Repository und ist damit reviewbar. Ausgeliefert wurde die
Datei aber nie automatisch: `.github/workflows/main.yml` lädt ausschließlich `dist/` zu GitHub
Pages hoch. Firebase stellt in diesem Projekt nur die Datenbank, nicht die Website. Zwischen
„Regel gemergt" und „Regel gilt" lag also ein manueller Schritt, den nichts einforderte – es gab
weder ein npm-Skript noch eine `.firebaserc`, und dokumentiert war der Deploy nur als Randnotiz.

Am 2026-09-01 ist genau das eingetreten. Der Szenario-Modus führte das Feld `szenarioSlug` ein und
ergänzte es korrekt in `erlaubteFelder()`. `tests/services/FirestoreRules.contract.test.ts` war
grün, der Pages-Deploy war grün – und trotzdem scheiterte in Produktion jedes Speichern mit
„Übung konnte nicht gespeichert werden", weil Firestore weiterhin die alte, ohne das Feld
veröffentlichte Regelfassung auswertete. Behoben wurde es durch einen von Hand ausgeführten
`firebase deploy`.

Die Lücke ist strukturell: Ein Test kann prüfen, dass die Regeldatei zum Code passt, aber nicht,
ob diese Datei jemals bei Firebase angekommen ist.

## Decision

- Ein eigener Workflow `.github/workflows/firestore-rules.yml` deployt die Regeln bei jedem Push
  auf `main`, der `firestore.rules` anfasst. Auslöser ist bewusst nur diese eine Datei; nähme man
  `.firebaserc`, `firebase.json` oder den Workflow selbst dazu, wäre der Job schon rot, bevor die
  Zugangsdaten überhaupt eingerichtet sein können.
- Zugangsdaten: ein **Repository-Secret** `FIREBASE_SERVICE_ACCOUNT` mit dem JSON-Schlüssel eines
  Service Accounts (`roles/firebaserules.admin` plus `roles/firebase.viewer`). Der Workflow legt
  den Schlüssel unter `$RUNNER_TEMP` ab, setzt `GOOGLE_APPLICATION_CREDENTIALS` und löscht ihn
  wieder. Repository-Ebene, nicht Environment: die bestehenden `FIREBASE_*`-Secrets liegen im
  Environment `github-pages`, enthalten die öffentliche Web-Konfiguration und wären für diesen
  Job ohnehin unsichtbar.
- **Fehlt das Secret, schlägt der Job fehl** und nennt im Fehler und in der Job-Zusammenfassung das
  nachzuholende Kommando. Er überspringt sich nicht still.
- Das Kommando gibt es genau einmal, als `npm run rules:deploy`. `.firebaserc` hält die
  Projekt-ID, damit weder Skript noch Dokumentation `--project` mitschleppen müssen.
- `ci.yml` bekommt den Job `firestore-rules-hinweis`: Er meldet im Pull Request, dass diese
  Änderung nach dem Merge einen Deploy braucht. Er schlägt nie fehl und ist kein Required Check
  (ADR 0001 bleibt unberührt).
- `tests/repo/FirestoreRulesDeploy.test.ts` hält Workflow, npm-Skript, `.firebaserc` und die
  Doku-Aussagen zusammen.
- Indizes bleiben manuell (`--only firestore:indexes`). Ein Index-Deploy kann vorschlagen, in
  Produktion vorhandene Indizes zu löschen; das gehört nicht in einen Lauf ohne Rückfrage.

## Consequences

- Eine gemergte Regeländerung erreicht Produktion ohne Zutun, sobald das Secret existiert.
- Solange es nicht existiert, ist jede Regeländerung auf `main` rot. Das ist der Zweck: Der rote
  Lauf ersetzt die Erinnerung, die vorher niemand hatte. Der Preis ist ein roter Haken auf `main`
  in genau diesen Fällen.
- Das Projekt hat erstmals ein Server-Credential in der CI. Es ist auf das Schreiben von Regeln
  beschränkt und für Pull Requests aus Forks nicht erreichbar, weil der Workflow nur auf
  `push` und `workflow_dispatch` reagiert.
- Der Regel-Deploy ist von der Website-Auslieferung entkoppelt: Ein fehlgeschlagener Regel-Deploy
  hält keinen Seiten-Release auf und umgekehrt.

## Nicht gewählt

- **Stiller Skip bei fehlendem Secret**, wie ihn `seo-snapshot.yml` für
  `GSC_SERVICE_ACCOUNT_JSON` macht. Dort ist ein ausgefallener Snapshot folgenlos. Hier wäre ein
  grüner, übersprungener Job von der Lücke nicht zu unterscheiden, die dieser Workflow schließt.
- **Zusätzlicher Schritt im bestehenden Pages-Deploy (`main.yml`).** Er würde bei jedem Push
  laufen, nicht nur bei Regeländerungen, und einen fehlgeschlagenen Regel-Deploy mit dem
  Website-Release verkoppeln.
- **Workload Identity Federation** (`google-github-actions/auth`) statt eines Schlüssels. Sicherer,
  weil ohne langlebiges Credential, aber die Einrichtung – Pool, Provider, Attribut-Bedingung,
  IAM-Bindung – steht in keinem Verhältnis zu einem Ein-Personen-Projekt mit einem einzigen
  Deploy-Ziel. Der Wechsel bliebe eine reine Änderung an diesem Workflow.
- **`firebase-tools` als devDependency.** Ein großes Paket in jedem `npm ci` aller CI-Jobs, damit
  ein Job es gelegentlich braucht. Der Deploy zieht es stattdessen per `npx`.
- **Prüfen, ob die veröffentlichten Regeln vom Repository abweichen (Drift-Check).** Wäre die
  gründlichere Absicherung, braucht aber lesenden Zugriff auf die aktive Regelfassung und damit
  dieselben Zugangsdaten. Sinnvoll erst, wenn der Deploy-Weg sich als unzuverlässig erweist.
