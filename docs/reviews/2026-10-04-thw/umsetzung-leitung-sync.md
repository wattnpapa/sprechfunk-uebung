# Umsetzung THW-Review – Bereich `leitung-sync`

Branch `thw-fix/leitung-sync`. Bereich: Übungsleitung (`src/uebungsleitung/*`), Live-Sync
(`LiveStatusService`, `liveStatusMerge`, `types/LiveStatus.ts`, `types/Storage.ts`),
Debrief-PDF (`pdfDebriefService`) und die X-Zeit-/Live-Sync-Logik in `src/teilnehmer/index.ts`.

Neue reine Rechenhelfer liegen in `src/uebungsleitung/lagebild.ts` (Plan-Nummern,
Fälligkeit, ETA, Anmelde-Kopplung, Papier-Nachtrag), getestet in
`tests/uebungsleitung/lagebild.test.ts`.

## Neue bzw. geänderte Zustände und Felder

- `LiveSyncState` hat den neuen Zustand **`offline`** („keine Verbindung, wird
  nachgereicht“). `fehler` heißt jetzt ausschließlich „Server lehnt ab, wird **nicht**
  übertragen“. Der Zustand hängt an der Serverbestätigung: `navigator.onLine` und
  `online`/`offline`-Ereignisse, Snapshots mit `metadata.fromCache`
  (`includeMetadataChanges`), unbestätigte `setDoc` nach 6 s (`SCHREIB_TIMEOUT_MS`).
  `flush(timeoutMs)` liefert `true` nur bei Bestätigung; `getOffeneAenderungen()` zählt
  unbestätigte Dokumente. Die Teilnehmer-Darstellung (`TeilnehmerView.updateLiveSyncState`)
  hat nur die zwei nötigen Label-Zeilen bekommen – die weitere Gestaltung macht der
  Teilnehmer-Bereich.
- `leitung-public` trägt `xZeitBasis` und `xZeitBasisGeaendertUm` (verbindliche Basis
  der Leitung, Last-Write-Wins zwischen Leitungsplätzen). Beide Felder standen schon in
  der Allowlist von `firestore.rules`, eine Regeländerung war nicht nötig; Contract- und
  Emulator-Test decken den Schreibweg jetzt ab.
- Bestätigungen in `leitung-public` können `nachgetragen: true` tragen (Papier-Nachtrag).
  Das liegt innerhalb der `nachrichten`-Map, die die Regeln nur in der Größe prüfen.
- Gerätelokal: `UebungsleitungStorage.xZeitBasisGeaendertUm`,
  `NachrichtenStatus.nachgetragen`, `TeilnehmerStorage.xZeitBasisQuelle` (`leitung`|`eigen`).

## Befunde

| Bericht / Befund | Stand | Umsetzung bzw. Begründung |
|---|---|---|
| README P0 #2, destructive-action P0-1, command P2-5, new-user P2-3, stress-test P3-1, field-user P2 (Leitung) – „Lokale Übungsdaten zurücksetzen“ wirkt für alle | umgesetzt (Leitung) | Knopf heißt je nach Sync „Übungsstand für alle zurücksetzen“ bzw. „… auf diesem Gerät löschen“, steht in einem eigenen Bereich am Seitenende statt neben den Exporten; Rückfrage nennt die Zahl der abgesetzten Nachrichten, Notizen und Anmeldungen und empfiehlt vorher das PDF. Ohne Verbindung wird der Reset abgelehnt; ohne Serverbestätigung wird lokal nichts gelöscht und nicht neu geladen. Der Teilnehmer-Knopf gehört zum Teilnehmer-Bereich. |
| destructive-action P0-1 (Zusatzhandlung Übungscode eintippen) | nicht umgesetzt | Konkrete Folgenangabe plus räumliche Trennung reicht für ein Ausbildungswerkzeug; ein Pflicht-Eintippen würde die seltene, gewollte Nutzung unnötig erschweren. |
| README P0 #3, offline-resilience P0-1 – Sync-Anzeige bleibt offline „live“ | umgesetzt | Siehe Zustände oben; Leitungs-Badge zeigt „offline – wird nachgereicht (n offen)“ bzw. „Fehler – wird nicht übertragen“. |
| README P0 #4, stress-test P1-1, glove-touch P1-1, destructive-action P1-2 – Doppeltipp hebt „✓ abgesetzt“ auf | umgesetzt (Leitung) | Nach dem Markieren steht in der Statusspalte nur Text; „zurücknehmen“ liegt in der letzten Spalte, ist 1,5 s gesperrt (`RUECKNAHME_SPERRE_MS`), ein zweites „abgesetzt“ ist wirkungslos. Die Rücknahme zeigt eine Rückgängig-Leiste (10 s), die den ursprünglichen Zeitpunkt wiederherstellt. Teilnehmer-Chip: Teilnehmer-Bereich. |
| glove-touch P2-4 – Layout springt nach Bestätigung | umgesetzt | Statuszelle mit fester Mindesthöhe, seitliche Scrollposition bleibt beim Neuaufbau erhalten, Kennzahl-Badges abgeschnitten statt wachsend, Aktionen auf groben Zeigern mind. 44 px. |
| night-visibility 5 – „✓ abgesetzt“ sieht aus wie ein Status | umgesetzt | Aktion heißt „Als abgesetzt markieren“, neutral, ohne Haken; Haken und Füllung nur am Zustand „✓ abgesetzt“; „gemeldet (TN)“ gestrichelt. |
| README #9, workflow F3, new-user P2-2 – Teilnehmer „übertragen“ vs. Leitung „abgesetzt“, Debrief zählt nur Leitung | umgesetzt (Leitung/Debrief) | Fortschritt zählt beide Quellen („TN n · Leitung m“), Debrief-PDF hat die Spalten „Gemeldet (TN)“ und „Bestätigt (Leitung)“ plus Zählzeile; Sammelaktion „n gemeldete bestätigen“ übernimmt die Zeit der Teilnehmer-Meldung. Begriffsvereinheitlichung in der Teilnehmeransicht: Teilnehmer-Bereich. |
| README #10, command P1-2, new-user P2-2/P3-3, error-recovery P1-2, destructive-action P2-1 – „Anmelden“ und Anmelde-Funkspruch getrennt, nicht rücknehmbar | umgesetzt | Ein Vorgang: „Anmeldung erhalten“ setzt den Anmelde-Funkspruch auf abgesetzt und umgekehrt (auch beim Nachtrag); Anzeige nennt die Quelle (Funkspruch, Teilnehmer). „Anmeldung zurücknehmen“ einzeln, mit Rückgängig. |
| README #11, workflow F2, command P2-3, field-user P2 – keine gemeinsame X-Zeit | umgesetzt | Leitung setzt die Basis verbindlich (`leitung-public`); Cockpit bietet den geplanten Beginn aus dem Generator (`fuehrungsstelle.beginn`) als „09:00 übernehmen“ an, sonst die früheste Rollenspieler-Basis – nie stillschweigend. Abweichende Rollen werden genannt. Teilnehmer übernehmen die Basis automatisch, eine eigene nur nach Rückfrage; die Herkunft steht unter dem Eingabefeld. Für die klassische X-Zeit-Übung gibt es im Generator kein Beginn-Feld – dort greift nur die Leitungs-Basis. |
| README #12, command P1-1 – keine Soll-Zeit, kein überfällig/fällig/später | umgesetzt | Spalte „Soll“ mit Uhrzeit und X+n; offene Zeilen tragen „überfällig n min“ / „jetzt fällig“ / „in n min“ als Text-Badge und Randmarke; Klick auf das Plan-Badge im Cockpit springt zur ersten überfälligen Zeile. ETA im X-Zeit-Modus aus dem Plan („Ende laut Plan“). |
| README #13, command P1-3, stress-test P2-5 – Endlosliste ohne Lagezeile | umgesetzt | Karte „Lage“ unter dem Cockpit: offen je Teilnehmer, drei nächste Nachrichten (mit Sprung), „n überfällig – zur ersten“, Abgesetzte ausblenden, Sprung zu Heatmap & Timeline. Kopf auf zwei Zeilen verdichtet, Notizfelder erst auf „+ Notiz“. |
| command P1-3 – erledigte standardmäßig ausblenden | bewusst anders | Ausblenden bleibt eine Option (jetzt prominent in der Lagezeile). Standardmäßig ausgeblendet verschwänden frisch bestätigte Zeilen sofort, die Rücknahme wäre nicht mehr in Reichweite. |
| README #14, error-recovery P1-1 – falsche ID zeigt leere Karten | umgesetzt | Meldung mit geprüfter ID und Wegen zu „Gespeicherte Übungen“ und Generator, übrige Karten ausgeblendet; Ladefehler (offline) mit eigener Meldung (offline-resilience P1-1, Leitungsteil). |
| offline-resilience P1-1 – Offline-Reload / App-Hülle offline | nicht umgesetzt | Service Worker bzw. Offline-Cache ist eine Produktentscheidung außerhalb dieses Bereichs; hier nur die ehrliche Fehlermeldung. |
| command P2-1 – ETA ohne Mindeststichprobe | umgesetzt | Erst ab 5 Nachrichten und 3 min Spanne, mit „aus n Nachrichten“; sonst „ETA: – (zu wenig Daten)“. Nachgetragene Zeiten zählen weder für ETA noch für Tempo. |
| command P2-2, workflow F9 – beübte Stelle gleichrangig | umgesetzt | Eigene Zeile oben „beübte Stelle“, ohne Code, Anmeldung und Fortschritt, mit Zahl der Einspielungen. |
| command P2-2 – Bewertung „Reaktion erfolgt/abweichend“ je Einspielung | nicht umgesetzt | Neue Funktion mit eigenem persistiertem Feld und Debrief-Teil; das Notizfeld je Zeile deckt es vorerst ab. Eigenes Arbeitspaket. |
| command P2-4, workflow F9, new-user P3-2 – Nr. nicht eindeutig | umgesetzt (Bildschirm) | Fortlaufende Plan-Nr., darunter „Abs.-Nr.“; Reihenfolge im X-Zeit-Modus nach Zeitplan. Im Übungsleitungs-PDF (`src/pdf/Uebungsleitung.ts`, Bereich core-pdf) nicht geändert. |
| command P2-6, field-user P2 – Übungsleitung mobil abgeschnitten | teilweise | Status/Aktion ist die zweite Spalte und ohne Seitwärtswischen erreichbar, Kopfzeilen umbrechen. „zurücknehmen“ steht bewusst in der letzten Spalte (Doppeltipp-Schutz) und braucht mobil Wischen. Eine Kartenansicht wurde nicht gebaut. |
| command P3-1 – Herkunft bei ABGESETZT | umgesetzt | „Leitung 19:12 · nachgetragen“ und „TN 19:11“ unter dem Zustand. |
| command P3-2 – UUID vor Lageinformation | umgesetzt | UUID klein unter dem Kopf, Übungscode im Kopf. |
| new-user P3-2 – Kennzahlen ohne Bedeutung | umgesetzt | Tooltips für Tempo/Funklast/Heatmap, Stärke-Felder „F/UF/H/Ges“. |
| offline-resilience P2-1 – „online“ vs. „zuletzt gesehen vor 20 min“ | umgesetzt | „Gerät vor n min“, ab 10 min bei offenen Nachrichten „seit n min nichts vom Gerät“. |
| analog-first P2-2, README P2 – Papier-Nachtrag nur mit Klickzeit | umgesetzt | „Zeit nachtragen“ / „Zeit ändern“ je Zeile (HH:MM), gekennzeichnet als „nachgetragen“, auch im Debrief. |
| destructive-action P3-1 – Browser-Dialoge, Siezen | teilweise | Leitungs-Rückfragen duzen und nennen die Folgen; eigener Dialog mit benannten Knöpfen gehört zu `UiFeedback` (Kern, nicht dieser Bereich). |
| offline-resilience P1-3 – Teilnehmer-Reset hängt offline | nicht in diesem Bereich | Teilnehmer-Bereich; `flush(timeoutMs)` steht dafür bereit. |
| analog-first P1-1 / README B2 – Übungsleitung-PDF in frischer Sitzung | nicht in diesem Bereich | `exportPdf` macht der core-pdf-Bereich; unverändert gelassen. |
| analog-first P2-3, workflow F5 – Ist-Felder/Codes im Übungsleitungs-PDF | nicht in diesem Bereich | `src/pdf/Uebungsleitung.ts`, core-pdf. |
| night-visibility 3 – Chart-Farben Timeline | nicht in diesem Bereich | Theme-Farben kommen aus `src/core/chart.ts` (core-pdf); Chart-Code unverändert. |
| field-user P2 – Sync-Rückmeldung nahe der Abhak-Aktion, new-user P2-2 Teilnehmerbegriffe, Teilnehmer-Chip-Doppeltipp | nicht in diesem Bereich | Teilnehmer-Bereich; der Zustand `offline` steht zur Verfügung. |

## Prüfungen

`npm run lint` (0 Fehler), `npx vitest run` (alle grün), `npm run build`,
`npm run perf:budget` (bestanden). Sichtprüfung im Mock-Modus auf Port 3104 (Desktop und
412 px): Doppelklick bleibt „abgesetzt“, Teilnehmer übernimmt die Leitungs-Basis,
Badge wechselt mit `setOffline` auf „offline – wird nachgereicht“, falsche ID zeigt die
Meldung. Neue E2E-Fälle in `e2e/app.spec.ts` (Doppelklick, falsche ID) – geschrieben,
nicht ausgeführt.
