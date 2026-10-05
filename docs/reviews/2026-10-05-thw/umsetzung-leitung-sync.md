# Umsetzung THW-Review (zweiter Lauf) – Bereich `leitung-sync`

Branch `thw-fix2/leitung-sync`. Bereich: Übungsleitung (`src/uebungsleitung/*`), Live-Sync
(`LiveStatusService`, `liveStatusMerge`, `types/LiveStatus.ts`, `types/Storage.ts`),
Übungsleitungs-CSS und der Übungsleitungs-Teil von `src/index.html`. Grundlage sind alle elf
Berichte unter `docs/reviews/2026-10-05-thw/`, einschließlich der Abgleichstabellen.

## Neue Zustände und Felder

- **Ausgelassen** (`NachrichtenStatus.ausgelassen`, in `leitung-public` als
  `LeitungBestaetigung.ausgelassen`): Zeile zählt weder als offen noch als abgesetzt, teilt
  sich `statusGeaendertUm` mit „abgesetzt“ (Last-Write-Wins).
- **Zeit vom Teilnehmer** (`zeitVomTeilnehmer`): `abgesetztUm` stammt aus der
  Sammelbestätigung, ist also eine Tippzeit.
- **Reaktion der beübten Stelle** (`reaktion` = `erfolgt` | `abweichend` | `ausgeblieben`,
  eigener Zeitstempel `reaktionGeaendertUm`), im Dokument `leitung` innerhalb von
  `nachrichtenNotizen`.
- **Firestore-Regeln:** keine Änderung. Alle neuen Werte liegen innerhalb der Maps
  `nachrichten` bzw. `nachrichtenNotizen`, die die Regeln nur in der Größe prüfen – kein neues
  Feld auf Dokumentebene, kein zusätzlicher Ausdruck. Contract- und Emulator-Test schreiben
  die neuen Einträge jetzt mit (`tests/services/FirestoreRules.contract.test.ts`,
  `tests/rules/FirestoreRules.emulator.test.ts`; den Emulator-Lauf habe ich nicht ausgeführt).
- **Gerätelokal:** `sprechfunk:leitungsansicht` (Ausblenden, Teilnehmertabelle eingeklappt) in
  `localStorage`, `sprechfunk:leitung-zurueckgesetzt` (einmalige Bestätigung nach dem Reset) in
  `sessionStorage`. Bewusst nicht unter dem Präfix `sprechfunk:uebungsleitung:`, das pro Übung
  belegt ist.
- **`LiveStatusService`:** `getSyncInfo()` und `onSyncInfo()` (Zustand, offene Änderungen,
  `letzteBestaetigungUm`), `getBestaetigtBis(docId)` und `getTeilnehmerBestaetigtBis(id)` (bis
  zu welchem Einreihzeitpunkt ein Dokument bestätigt ist; ein Eintrag mit `geaendertUm` danach
  liegt nur auf dem Gerät) und `flushMitZeitlimit(timeoutMs)` mit Ergebnis
  `bestaetigt` | `offline` | `zeitlimit` | `fehler`. Ohne Verbindung lehnt es sofort ab.

## Für den Teilnehmer-Bereich bereitgestellt

- `rueckstandFuerRolle()`, `rueckstandText()` und `rolleCountdownText()` in
  `src/uebungsleitung/rueckstand.ts` rechnen „überfällig / jetzt fällig“ wie der Plan der
  Leitung. **Einzige Änderung im Teilnehmer-Code:** `TeilnehmerView.updateXZeitCountdown`
  (`src/teilnehmer/TeilnehmerView.ts`) zeigt jetzt diese Zeile, also z. B. „2 überfällig,
  älteste seit 94 min – Nr. 1 jetzt einspielen · Nächste in 6:54“. Das Fälligkeitsfenster ist
  dort mangels Intervall 2 min; `rolleCountdownText` nimmt das Intervall optional an.
  Bestätigte bzw. ausgelassene Einspielungen der Leitung (aus `leitung-public`) zählen dort noch
  nicht als erledigt – das kann der Teilnehmer-Bereich über den `istErledigt`-Rückruf ergänzen.
- Badge „offene Änderungen“ und „letzte Bestätigung“: `onSyncInfo()`; Marke „nur auf diesem
  Gerät“ je Spruch: `getTeilnehmerBestaetigtBis()`; Reset mit Zeitlimit: `flushMitZeitlimit()`.
  Die Anzeige und `performReset` im Teilnehmer bleiben beim Teilnehmer-Bereich.

## Befunde

| Bericht / Befund | Stand | Umsetzung bzw. Begründung |
|---|---|---|
| destructive-action P1-1 – „Jetzt starten“ ersetzt gesetzte Basis für alle | umgesetzt | Bei gesetzter Basis heißt der Knopf „Neu starten (verschiebt alle Zeiten)“. Jede Änderung einer gesetzten Basis (Knopf, Zeitfeld, Vorschlag) fragt mit alter und neuer Zeit und der Zahl der Überfälligen vorher und nachher nach. Danach steht eine Rückgängig-Leiste „X-Zeit-Basis 09:00 → 21:02 geändert“. `cockpitSteuerung.ts`, `xZeitBasisWechsel.ts`. |
| workflow W1 – geplanter Beginn ohne Prüfung übernommen | umgesetzt | Liegt der Vorschlag ≥ 10 min zurück, heißt der Knopf „19:30 übernehmen (liegt 97 min zurück)“. Ein Klick fragt nach („sofort n Einspielungen überfällig“), bei Abbruch folgt das Angebot „Stattdessen jetzt starten (21:07)?“. |
| workflow W2 – Rollenspieler sehen Rückstand nicht | umgesetzt (Logik + minimale Anzeige) | Siehe oben: `rueckstand.ts`, eine Stelle in `TeilnehmerView.ts`. |
| command P2-2 – „auslassen“ fehlt, „Als Nächstes“ nur Rückstand | umgesetzt | Überfällige und fällige offene Zeilen haben „auslassen“ (Rückgängig-Leiste), ausgelassene Zeilen „wieder öffnen“. Ausgelassene zählen nicht in „überfällig“, „hinter Plan“, „offen“ und ETA. Im PDF/Debrief stehen sie als Vermerk. „Als Nächstes“ zeigt die älteste überfällige plus die gerade fälligen bzw. nächsten Zeilen. |
| command P2-1, workflow W4 (teilweise) – Reaktion der beübten Stelle | umgesetzt (Leitung, Lage, PDF-Daten) | Abgesetzte Einspielungen mit Erwartung haben die Knöpfe „erfolgt / abweichend / ausgeblieben“ (zweiter Klick hebt auf) und ohne Bewertung „Reaktion ausstehend seit n min“. Die Lage zeigt „Beübte Stelle – Reaktionen: 12 erfolgt · 1 abweichend · 3 ausstehend (älteste ausstehend seit 6 min)“. Übungsleitungs-PDF und Debrief bekommen die Bewertung als Vermerk vor der Notiz, die Summe als Notiz der beübten Stelle. Das Layout ist unverändert. Ein eigenes Auswertungsblatt für die beübte Stelle und ein FS-eigenes Leitungs-PDF ohne Lösungswort/Stärke sind PDF-Layout und gehören zu core-offline. |
| command P2-3, field-user P2 (Leitung am Handy), stress-test P3-1, field-user Abgleich #9, command Abgleich P2-6 | umgesetzt | Unter 992 px sind Nachrichtenplan und Teilnehmertabelle Karten: Kopf „Nr · von Sender · an Empfänger · Soll“, darunter Status mit Abhak-Knopf (≥ 44 px), Text, Zeit-Aktionen. Gemessen bei 412 px (Pixel 7) und 810 px (iPad): `scrollWidth` = Viewport, kein Überlauf im Plan. |
| glove-touch P2-4 – iPad: Zeitspalte abgeschnitten, 8 px Abstand, 30-px-Ziele | umgesetzt | iPad hochkant nutzt die Kartenansicht (kein Abschneiden). „Zeit ändern“ und „zurücknehmen“ stehen mit 16 px (Tabelle) bzw. 32 px (Karte) Abstand. Bei grobem Zeiger sind alle Knöpfe, Selects, Felder und Schalter der Leitung mindestens 44 px hoch, ebenso der Kopier-Knopf. Die Stärkefelder sind breiter und haben mehr Abstand. „zurücknehmen“ hatte schon eine Rückgängig-Leiste. |
| stress-test P2-3, command P3-2 – Plan unter der Falz | umgesetzt | Die Lagezeile bleibt ab 992 px beim Scrollen oben stehen („Als Nächstes“ springt zur Zeile). Die Teilnehmertabelle lässt sich einklappen („Teilnehmer einklappen“), je Gerät gemerkt. |
| analog-first P2-1 – Zeitkorrektur am Anmeldespruch zieht Anmeldezeit nicht mit | umgesetzt | „Zeit nachtragen/ändern“ am Anmeldespruch setzt die Anmeldezeit immer mit. Eine von Hand korrigierte Zeit hat in `anmeldeZustand` Vorrang. Übungsleitungs-PDF und Debrief nutzen denselben Stand (`buildAuswertungsStand`). |
| analog-first P2-2 – Nachtrag landet auf falschem Datum | umgesetzt | `uhrzeitZuIso` (`nachtrag.ts`) bezieht die Zeit auf das Übungsdatum. Liegt sie vor der X-Zeit-Basis, gilt der Folgetag (Übung über Mitternacht). Eine Korrektur behält ihren Tag, wenn er Übungs- oder Folgetag ist. Zukunftszeiten werden weiter auf den Vortag gelegt. |
| analog-first P3-1 – „N gemeldete bestätigen“ übernimmt Klickzeiten | umgesetzt (Kennzeichnung) | Der Knopf heißt „… (mit Meldezeit des Teilnehmers)“, darunter steht ein Satz zur Tippzeit. Die Zeile zeigt „Leitung 21:00 · Zeit vom TN“, PDF und Debrief tragen einen Vermerk. Die Erfolgsmeldung verweist auf „Zeit ändern“ für Papierzeiten. Den Fußtext der Teilnehmer-Übersicht (PDF) ändert core-offline. |
| new-user P2-2 – „Soll“-Stärke missverständlich | umgesetzt | Die Spalte heißt „Stärke-Summe“ mit „Erwartete Summe der an sie gemeldeten Stärken (F/UF/H/Ges)“ und Erklärung im Tooltip. Die Felder heißen „Gemeldete Summe …“, „Details“ heißt „Einzelmeldungen“. |
| new-user P3-1 – „Teilnehmer Code: X / Y“ | umgesetzt (Leitung) | „Übungscode X · Teilnehmercode Y“. Linktabelle und Platzhalter im Generator: Generator-Bereich. |
| new-user P3-2 – Plan-Nr. ohne Absender-Nr. in „Als Nächstes“ | umgesetzt | „Nr. 4 · 21/11 (Abs.-Nr. 2) → 23/11 · …“. |
| new-user P3-3 – „GEMELDET (TN)“ ohne Erklärung | umgesetzt | Sichtbarer Satz an der Sammelbestätigung, Eintrag in „Was bedeuten die Kennzahlen?“. |
| new-user P3-4, field-user P3 (Leitungsbegriffe), Abgleich P3-2 – Kennzahlen kryptisch, Datum als DTG | umgesetzt (Leitung) | „Tempo: … Sprüche/min“, „Funklast: sendet am meisten … \| empfängt am meisten …“, „Sprüche je 5 min: ab 21:00: 3“. Aufklappbare Erklärung aller Kennzahlen (Live-Status, Tempo, Funklast, Heatmap, ETA, Nr/Abs.-Nr., gemeldet). „Debrief PDF“ heißt „Debrief (PDF)“ unter „Nachbesprechung“. Das Übungsdatum im Kopf steht als „05.10.2026“ (auch workflow W9). Die DTG-Uhr in der Seitenkopfzeile gehört zum Kern. |
| night-visibility 1 (Leitungsteil) – „seit n min nichts vom Gerät“, Gefahrenbereich-Überschrift | umgesetzt | Eigene Klassen `ul-warnzeile` / `ul-gefahr-titel` mit Theme-Farben (`--warn-text`, `--alarm`) und Symbol ⚠ statt `text-*-emphasis`. Die globale Umstellung der Bootstrap-Klassen macht core-offline. |
| night-visibility 2 (Leitungsteil) – Schalter „Abgesetzte ausblenden“ im Plan | umgesetzt | Der Schalter steht in einer Filterleiste über dem Plan, ist ≥ 44 px hoch und im Dark Mode mit Kontur und hellem Knopf gezeichnet. Eingeschaltet zeigt er „n ausgeblendet“. Admin-Checkbox: Admin-Bereich. |
| night-visibility 3 – Heatmap-Farbe | nicht in diesem Bereich | Farbquelle `chart.ts` (core-offline). |
| offline-resilience P3-3 – Offline-Hinweis nur im Plan-Kopf | umgesetzt | Bei „offline“/„fehler“ steht oben in der (ab 992 px mitlaufenden) Lagezeile ein Hinweis mit wartenden Änderungen und „Zuletzt vom Server bestätigt: hh:mm“. Das Badge sagt „(n warten)“. |
| offline-resilience P3-4 – ein Klick, zwei Debrief-Downloads | umgesetzt | Ursache: `handleRoute` lief beim Start zweimal (`router.subscribe` + `DOMContentLoaded`), dadurch gab es zwei Controller und doppelte Listener auf den festen Containern. `initUebungsleitung` baut für dieselbe Adresse nur einmal auf und räumt eine ersetzte Ansicht ab. Alle Listener der Ansicht hängen an einem `AbortController`. E2E zählt die Downloads. |
| offline-resilience P2-2 (Service-Seite) – Teilnehmer sieht offene Änderungen/letzte Bestätigung nicht | umgesetzt (Service) | `onSyncInfo`, `getTeilnehmerBestaetigtBis`. Anzeige: Teilnehmer-Bereich. |
| offline-resilience P1-4 (Service-Seite) – Reset ohne Netz hängt in `flush()` | umgesetzt (Service) | `flushMitZeitlimit()` lehnt offline sofort ab, sonst nach 10 s. Der Aufruf in `src/teilnehmer/index.ts` (`performReset`) ist Teilnehmer-Bereich. |
| analog-first P3-4, field-user P2 (Spruch „nur hier“) – Service-Seite | umgesetzt (Service) | `getTeilnehmerBestaetigtBis()`; Kartenmarke: Teilnehmer-Bereich. |
| error-recovery P3-2 – Rückgängig-Leiste bezieht sich auf ältere Aktion | umgesetzt | Jede Statusaktion (abgesetzt, zurücknehmen, Anmeldung, Nachtrag, auslassen, Reaktion, Sammelbestätigung) schließt eine stehende Leiste. |
| error-recovery P3-4 – `#/uebungsleitung/` ohne ID zeigt leeres Gerüst | umgesetzt | `src/app.ts` ruft die Übungsleitung auch ohne ID auf, die zeigt dann ihre Fehlerseite (minimale Änderung außerhalb des Bereichs). |
| destructive-action P2-1, workflow W3 (Leitungsteil) – alte Status nach Überschreiben ohne Hinweis | umgesetzt | Sind gesetzte Status älter als `createDate` der Übung (2 min Toleranz), zeigt die Lage einen festen Hinweis „Diese Übung wurde am … neu verteilt. n gesetzte Status gehören zur alten Fassung …“ mit Sprung zum Zurücksetzen. Ein Zurücksetzen gleich in der Überschreiben-Rückfrage wäre Generator-Bereich. |
| destructive-action P3-2 (Leitungsteil) – Rückgängig-Leiste verdeckt letzte Zeile | umgesetzt | Solange die Leiste steht, bekommt der Inhalt unten 5 rem Platz. |
| destructive-action P3-3 – keine Bestätigung nach Reset | umgesetzt | Nach dem Neuladen steht oben einmalig „Übungsstand für alle zurückgesetzt (um 21:05).“ |
| destructive-action P3-1 – native OK-Dialoge | nicht umgesetzt | `UiFeedback.confirm` ist Kern. Die neuen Rückfragen nennen die Folge im Text und lassen sich nachträglich rückgängig machen. |
| command P3-1 – zwei Verzugszahlen | umgesetzt | „hinter Plan“ zählt jetzt dieselben offenen Zeilen wie die Lage („überfällig“ + „jetzt fällig“), Tooltip mit Aufteilung. Die Lage zeigt „12 überfällig, 2 jetzt fällig – zur ersten“. |
| command P3-3 – „Abgesetzte ausblenden“ übersteht keinen Reload | umgesetzt | Je Gerät gemerkt (try/catch, ohne Speicher gilt die Vorgabe). |
| command P3-4, field-user (Uhrzeitfeld) – 12-Stunden-Anzeige | nicht umgesetzt | Das Format eines `type="time"`-Felds bestimmt die Browsersprache, nicht die Seite. Die gesetzte Basis steht im Hinweis daneben weiterhin in 24-Stunden-Form. |
| command Abgleich P3-2 – UUID im Kopf | unverändert | Bleibt klein. Sie hilft beim Wiederfinden über den Admin, die Lage steht davor. |
| command Abgleich P3-3 – Admin ohne Stand | nicht in diesem Bereich | Admin-Bereich. |
| workflow W7 – kein Abschluss, Debriefs einzeln | nicht umgesetzt | Ein Sammel-Debrief (ZIP/PDF) und ein „beendet“-Zustand sind ein eigenes Arbeitspaket mit PDF-Teil. |
| workflow W9 (Leitungsteil) – Plan-Nr. im PDF, Datum mit 0000 | teilweise | Datum im Leitungskopf behoben. Plan-Nr. im Leitungs-PDF ist PDF-Layout (core-offline). |
| workflow W4 – „Ausdruck/E-Mail“ ohne konkretes Papier | nicht umgesetzt | Braucht Drehbuch-Daten (welcher Vordruck), Generator/Inhalt. |
| offline-resilience P1-2 (Leitungsteil) | unverändert | Die Leitung hatte schon eine eigene Netzmeldung. Die Übung lokal vorhalten ist ein eigenes Paket (Speicher-Konzept). |

## Dateien außerhalb des Bereichs (minimal)

- `src/app.ts`: Übungsleitung auch ohne ID initialisieren (error-recovery P3-4).
- `src/teilnehmer/TeilnehmerView.ts`: Countdown-Zeile über `rolleCountdownText` (workflow W2).
- `src/index.html`: nur der Abschnitt `#uebungsleitungArea` (Einklapp-Knopf, Kennzahlen-Erklärung,
  Reset-Bestätigung, Zeitfeld-Klasse).
- `src/styles/main.css`: ein zusammenhängender Block „Übungsleitung: Nachtrag THW-Review
  2026-10-05“ vor dem Teilnehmer-Abschnitt.
- `e2e/app.spec.ts`: neue Fälle (Fehlerseite ohne ID, genau ein Debrief-Download, Ausblenden
  übersteht Reload, Kartenansicht am Handy). Geschrieben, nicht ausgeführt.

## Prüfungen

`npm run lint` (0 Warnungen), `npx tsc --noEmit -p tsconfig.json`, `npx vitest run --coverage`
(alle grün, Schwellen gehalten), `npm run build`, `npm run perf:budget` (bestanden).
Sichtprüfung im Mock-Modus auf Port 3114 (Desktop 1440×900, iPad gen 7, Pixel 7, hell und
dunkel):

- kein seitlicher Überlauf;
- Kartenansicht mit Sender, Empfänger, Soll und Abhak-Knopf;
- Rückfragen bei „Neu starten“ und beim Vorschlag „liegt 97 min zurück“;
- „auslassen“ mit Rückgängig, Reaktionsbewertung in der Lage;
- Offline-Hinweis oben;
- Gefahrenbereich und Schalter im Dark Mode lesbar.
