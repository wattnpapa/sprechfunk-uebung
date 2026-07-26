# ADR 0006: Live-Sync des Übungsstatus

## Status
Accepted

## Context

Der Übungsverlauf war rein gerätelokal: Teilnehmer hakten „übertragen" in ihrem
`localStorage` ab, die Übungsleitung „abgesetzt" in ihrem. Beide Seiten sahen
einander nie. Ein Gerätewechsel oder ein geleerter Browser-Cache kostete den
kompletten Übungsverlauf, und das ETA-/Tempo-Panel rechnete nur mit dem, was die
Leitung manuell mitgeklickt hatte.

## Decision

Der Status wird zusätzlich über die Firestore-Subcollection
`uebungen/{uebungId}/status` synchronisiert (`onSnapshot`).

**Dokumente – ein Schreiber pro Dokument, damit keine Rollenkonflikte entstehen:**

| Dokument                    | Schreiber       | Inhalt |
|-----------------------------|-----------------|--------|
| `teilnehmer-<teilnehmerId>` | Teilnehmer      | eigene Übertragungsmeldungen, X-Zeit-Basis |
| `leitung-public`            | Übungsleitung   | Bestätigungen (`abgesetztUm`) |
| `leitung`                   | Übungsleitung   | interne Daten: Notizen, Lösungswörter, Stärken |

`leitung` und `leitung-public` sind getrennt, damit Teilnehmer die Bestätigungen
abonnieren können, ohne die internen Notizen der Leitung zu laden.

**Weitere Festlegungen:**

- **Lokal bleibt führend.** `localStorage` ist weiterhin die Anzeigequelle;
  Firestore-Schreibvorgänge laufen gebündelt und „fire and forget". Fällt das Netz
  aus, läuft die Übung weiter und die Badges zeigen „Sync: offline".
- **Merge per Last-Write-Wins je Eintrag.** Jeder Eintrag trägt `geaendertUm`
  (bzw. `statusGeaendertUm`/`notizGeaendertUm`). Zurücksetzen wird als Marker
  gespeichert (`uebertragen: false`) statt gelöscht – sonst würde ein veralteter
  Remote-Stand den Eintrag wiederbeleben.
- **Fortschritt zählt beide Seiten.** Eine Nachricht gilt als erledigt, sobald
  Teilnehmer *oder* Leitung sie markiert hat; für ETA, Tempo, Funklast, Heatmap
  und Timeline zählt der frühere der beiden Zeitstempel. Der Fortschrittsbalken
  weist unbestätigte Meldungen separat aus („n nur gemeldet").
- **Nachzügler-Erkennung** über den Median der Gruppe: markiert wird, wer
  weniger als die Hälfte des Median-Fortschritts erreicht hat (erst ab drei
  aktiven Teilnehmern).
- **Feature-Flag `enableLiveStatusSync`** (Default an, abschaltbar über
  `localStorage` oder `?ff_disable=enableLiveStatusSync`).
- **Mock-/E2E-Modus** nutzt dasselbe Dokumentmodell in
  `localStorage["sprechfunkLiveStatus:{uebungId}"]` und verteilt Änderungen über
  `storage`-Events. Dadurch ist der komplette Sync-Pfad in Playwright testbar.

## Consequences

- Die Übungsleitung sieht den Stand jedes Teilnehmers in Echtzeit; das
  ETA-/Tempo-Panel arbeitet mit echten Daten.
- Ein Gerätewechsel stellt den Verlauf wieder her.
- **Die Firestore-Regeln müssen deployt werden** (`firebase deploy --only
  firestore:rules`). ADR 0005 sperrt Unterkollektionen von `/uebungen`
  ausdrücklich; ohne die hier ergänzte `match /status/{statusId}`-Regel weist
  Firestore jeden Schreibvorgang ab. Die App degradiert dann sichtbar auf
  lokalen Betrieb, statt die Übung zu blockieren.
- Der Feldvertrag der Statusdokumente ist wie bei den Übungsdaten durch
  `tests/services/FirestoreRules.contract.test.ts` abgesichert: neue Felder ohne
  Pflege der Allowlist fallen im Test auf statt erst in Produktion.
- Zusätzliche Schreiblast: pro Statusänderung ein Dokument-Write, gebündelt über
  400 ms. Bei einer Übung mit 20 Teilnehmern und 200 Nachrichten sind das in der
  Größenordnung einige hundert Writes.
- Es gibt weiterhin keine Authentifizierung (siehe Restrisiken in ADR 0005).
  Die Regeln prüfen Dokument-ID und Struktur, nicht die Identität: Es lässt sich
  nicht erzwingen, dass nur der jeweilige Teilnehmer sein Statusdokument
  schreibt. Das entspricht dem bisherigen Zugriffsmodell der `uebungen`.
