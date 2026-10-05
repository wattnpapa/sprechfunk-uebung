# Umsetzung Bereich Generator und Admin (zweiter Lauf)

Branch `thw-fix2/generator-admin`, Stand 2026-10-05. Grundlage sind die elf Berichte in
diesem Ordner, auch die Einträge „teilweise“ und „offen“ im Abgleich mit dem Lauf vom
2026-10-04. Commits: `64641eb` (Generator), `807065e` (Admin), dazu dieses Dokument.

Neue Module:

- `src/generator/liveStatusZuruecksetzen.ts`: Zurücksetz-Marker für den Live-Status nach dem Überschreiben.
- `src/generator/GeneratorVorlagenInfo.ts`: Beschreibung der Vorlagen unter der Auswahl.
- `src/generator/GeneratorZuletzt.ts`: „Zuletzt in diesem Browser erstellt“.
- `src/admin/loeschPuffer.ts`, `src/admin/loeschTexte.ts`: verzögertes Löschen und Rückfragetext.

Keine neuen Firestore-Felder, keine Regeländerung, keine neue Abhängigkeit.

## Befunde

| Bericht / Befund | Status | Umsetzung oder Begründung |
|---|---|---|
| destructive-action P2-1 / workflow W3 / workflow F1 (teilweise): Nach dem Überschreiben bleiben alte Status in der Übungsleitung stehen | umgesetzt | Nach erfolgreichem Überschreiben schreibt der Generator über `LiveStatusService` (unverändert, nur aufgerufen) Zurücksetz-Marker mit aktuellem Zeitstempel in `leitung-public`, `leitung` und alle `teilnehmer-<code>`-Dokumente, für die Nachrichtennummern der alten und der neuen Fassung. Das ist derselbe Mechanismus wie „Übungsstand für alle zurücksetzen“ in der Übungsleitung; die Geräte übernehmen ihn per Last-Write-Wins. Die X-Zeit-Basis bleibt. Die Rückfrage nennt das Zurücksetzen und empfiehlt vorher „Übungsleitung als PDF“. Bestätigt der Server nicht binnen 10 s, steht im Ergebnis ein gelber Hinweis. Mit Live-Sync aus gibt es nichts zurückzusetzen. Sichtprüfung: Leitung im zweiten Tab, ein Spruch abgehakt, überschrieben, nach Reload wieder alle offen. |
| destructive-action P2-2: „Entwurf verwerfen“ ohne Rückweg | umgesetzt | Neben „Entwurf verwerfen“ steht „Hinweis ausblenden ✕“, das nichts löscht. Nach dem Verwerfen 10 s lang „Entwurf verworfen … Rückgängig“; Rückgängig schreibt den Entwurf zurück und stellt das Formular wieder her. |
| destructive-action P3-1: Reflexhaftes „OK“, Rückfrage auch bei harmloser Aktion, Überschreiben dicht am Hauptknopf | teilweise | „Als neue Übung generieren“ fragt nicht mehr nach. Der Überschreiben-Knopf hat mehr Abstand zum Hauptknopf. Eigene Dialoge mit handlungsbenanntem Knopf statt `confirm` gehören in `src/core/UiFeedback.ts` (Kern). |
| error-recovery P2-2: Gleichnamige Übungen nach „Als neue Übung“, Code fehlt in der Liste, Löschen endgültig | umgesetzt | Unveränderter Name bekommt „(2)“, „(3)“ … (eigener Name bleibt). Admin-Liste hat die Spalte „Übungscode“. Löschen: siehe nächste Zeile. |
| destructive-action Abgleich P1-1 / error-recovery Abgleich P2-6: Admin-Löschen ohne Rückgängig | umgesetzt | Verzögertes Löschen ohne neue Firestore-Regel: Nach der Rückfrage verschwindet die Zeile, oben steht „Übung … wird in 8 Sekunden gelöscht. Rückgängig“. Erst danach `deleteDoc`. Eine zweite Löschung oder das Verlassen der Seite (`hashchange`, `pagehide`) führt eine offene sofort aus. Einschränkung: Wer den Tab in diesen 8 s schließt, kann die Löschung verlieren, dann bleibt die Übung bestehen. Die Rückfrage nennt die Frist. |
| new-user P2-1: Vorlagen nur nach Ortsverband benannt | umgesetzt | Unter der Auswahl „Was steckt in den Vorlagen? Lage, Umfang, Herkunft“, ohne Auswahl aufgeklappt, mit Markierung „(gewählt)“. Texte aus den Beschreibungen der Archivseiten; Anzahl und Herkunft prüft `tests/generator/vorlagenRegistry.test.ts` gegen `scripts/lib/funkspruch-bestand.mjs`. Die Spaßvorlage heißt „Zum Auflockern: humorvolle Funksprüche“, ist abgesetzt und sagt „nicht für die fachliche Ausbildung“. Nur noch ein Platzhalter im Feld. Einen Beispielspruch je Vorlage gibt es nicht (verweist auf die Archivseiten; Texte würden erst nach `fetch` vorliegen). |
| new-user P3-1: „Teilnehmer Code: X / Y“ | umgesetzt (Generator) | „Übungscode X · Teilnehmercode Y“; der Kopiertext nennt beide getrennt. Die Übungsleitung (`teilnehmerMarkup.ts`) ändert der Leitung-Bereich. Platzhalter im Schnellzugang jetzt „z. B. K7M4Q2“ / „z. B. A1B2“. |
| error-recovery P3-3: Schnellzugang mit falscher Codelänge ohne Meldung | umgesetzt | Länge und unzulässige Zeichen (O, 0, I, 1, Sonderzeichen) werden am Feld gemeldet, die Seite bleibt. |
| error-recovery P2-1 / workflow W9 (Teil): Fehler-Toasts stapeln sich und bleiben nach Erfolg stehen | umgesetzt | Eingabefehler erzeugen keinen Toast mehr, nur Feldmarkierung und Fehlerkasten (der bei jedem Versuch ersetzt wird). Verbindungs- und Speicherfehler kommen weiter zusätzlich als Toast. |
| offline-resilience P2-1: „nicht gespeichert – nichts verändert“ nach Zeitlimit, obwohl der Schreibvorgang noch ankommen kann | umgesetzt (Text) | Nach dem Zeitlimit: „Speichern nicht bestätigt … kann noch ankommen, solange diese Seite offen ist“, mit Folge je Modus. Abgelehnte Schreibvorgänge melden weiter „nicht gespeichert“. Die spätere Ankunft sichtbar zu machen, gehört zum Service-Teil (core-offline). |
| analog-first P3-3 / offline-resilience P2-4: Druck-Hinweis „lässt sich nicht neu laden“ stimmt nicht mehr | umgesetzt | „Ohne Netz öffnet sich diese Seite nur auf einem Gerät, das sie vorher schon einmal mit Netz geladen hat, und auch dann nicht in jedem Fall mit allen Übungsdaten. Die Ausdrucke sind die sichere Rückfallebene.“ Bewusst vorsichtiger als im Bericht vorgeschlagen: Ohne persistenten Firestore-Cache (offline P1-2) kommen die Übungsdaten nach einem Offline-Reload nicht sicher. |
| offline-resilience P1-1 (Teil Generator): Druckteil im Generator nicht vorgeladen | umgesetzt | `vorladenPdfGenerator()` beim Anzeigen eines Ergebnisses. Das gecachte fehlgeschlagene `import()` in `pdfGeneratorLazy.ts` liegt bei core-pdf. |
| offline-resilience P3-2 (Teil Generator): Zwei Meldungen für dieselbe Ursache beim ZIP | umgesetzt | Scheitert schon das Laden des Druckteils, legt der Generator keine zweite Meldung dazu. Ersetzen gleichlautender Toasts wäre Kern (`UiFeedback`). |
| stress-test P3-2: Hinweis nach „Als neue Übung“ verdeckt die Linktabelle | umgesetzt | Rückmeldung steht als grüner Kasten oben im Ergebnis statt als Toast. |
| workflow W6 / new-user P3-5 (Teil Generator): Kein Rückweg zur eigenen Übung auf der Startseite | umgesetzt | „Zuletzt in diesem Browser erstellt“ (bis zu 5 Übungen mit Link, Übungscode, Zeit; nur localStorage). Zwei Menüs und die Verlinkung von `#/admin` gehören zum Kopf (core). |
| new-user P3-6: Führungsstellen-Übung fragt Leitung doppelt, leere Überschrift, abgeschnittene Platzhalter, Erklärung unten | umgesetzt | Am Feld der Übungsleitung steht im FS-Modus, dass der Name nur als Betriebsleitung auf den Ausdrucken erscheint. Die leere Überschrift „Lösungswörter & Optionen“ wird ausgeblendet, der Erklärtext steht oben unter der Drehbuchauswahl, die Rollenfelder stehen untereinander, der Abschnitts-Platzhalter ist kürzer. Das Feld ganz auszublenden hätte die Pflichtprüfung und die Ausdrucke geändert. |
| new-user P3-7: Dauer im Generator und im Admin widersprechen sich | umgesetzt (Benennung) | Admin-Kennzahl heißt „Ø reine Sprechzeit je Übung (grob, 15 s je Spruch)“. Eine gemeinsame Rechnung bräuchte die Texte aller Übungen in der Statistik-Aggregation. |
| new-user P3-4 / P3-1 (Abgleich, offen): Datumsformat im Generator | nicht umgesetzt | `input type=date` zeigt das Format des Browsers; der Bericht vermutet selbst die Testbrowser-Sprache. DTG in Kopfzeile und Leitung gehören zu Kern bzw. Leitung. |
| glove-touch P3-3: Generator-Radios 13×13, Teilnehmer entfernen 37×30, Schnellzugang 39 px | umgesetzt | Die Touch-Regeln gelten jetzt auch nach Breite (`max-width: 767.98px`), weil die Emulation `pointer: coarse` nicht meldete. Gemessen auf 412 px: Radio 21,6 px in 44-px-Zeile; Schnellzugang-Felder und -Knopf 44 px. |
| glove-touch P3-4 / Abgleich P3-2: Admin am Handy, Aktionen seitlich, Löschen neben Überwachen | umgesetzt | Unter 576 px Kartenansicht mit Spaltennamen; Aktionen in jeder Karte sichtbar, „Löschen“ rechts abgesetzt. |
| night-visibility Befund 2 (Teil Admin): Admin-Checkbox im Dark Mode kaum sichtbar | umgesetzt | Kontur `--text-3` und Fläche `--flaeche-2` für ausgeschaltete Checkboxen in Admin und Generator. Der Schalter im Nachrichtenplan gehört zur Leitung, eine globale Regel zum Kern. |
| field-user P3: Code-Hinweis nennt Verwechslungen, die nicht vorkommen | teilweise | Im Generator-Schnellzugang nennt die Meldung das unzulässige Zeichen. Das Teilnehmer-Formular gehört zum Bereich teilnehmer. |
| command P3-3 (offen): Admin-Liste ohne Stand der Übungen | nicht umgesetzt | Unverändert zur Begründung vom 2026-10-04: je Übung ein Read der Status-Unterkollektion. |
| workflow W9: Prozentwerte driften beim Wiederöffnen (10 % → 13 %) | nicht umgesetzt | Gespeichert werden nur Stückzahlen; die Prozente ließen sich nur mit neuen persistierten Feldern (Regeln, Ausdrucksbudget) exakt zurückgeben. Die Stückzahlen bleiben gleich. |
| workflow W4, W8, W5, W7, W1/W2; destructive P1-1, P3-2, P3-3; stress P1-1, P2-1…P2-3; analog P2-1, P2-2 u. a. | nicht hier | Übungsleitung, Teilnehmer, PDF/ZIP und Kern. |

## Dateien außerhalb der Zuständigkeit

- `src/index.html`: nur der Admin-Abschnitt (Spalte Übungscode, Rückgängig-Leiste, Klasse der Tabelle, Beschriftung der Dauer-Kennzahl).
- `e2e/app.spec.ts`: Admin-Löschtests auf die 8-s-Frist umgestellt, Toast-Erwartungen der Generator-Validierung ersetzt, neue Tests (Schnellzugang, Vorlagen-Info, Entwurf/Rückgängig, Namenszusatz und Zuletzt-Liste, Überschreiben setzt Leitung zurück, Admin-Rückgängig, Übungscode-Spalte). Gelesen, nicht ausgeführt; die gleichen Abläufe liefen per eigenem Playwright-Skript auf Port 3112.
- `src/data/funkspruchVorlagen.ts`: Felder `beschreibung`, `herkunft`, `anzahl`, `nebenbei`.
- `src/services/LiveStatusService.ts` und `liveStatusMerge.ts` unverändert, nur aufgerufen.

## Prüfung

`npm run lint` ohne Warnungen, `npx tsc --noEmit` grün, `npx vitest run --coverage` grün
(2542 Tests), `npm run build` und `npm run perf:budget` grün. Sichtprüfung im Mock-Modus
(1440 px und 412 px, hell und dunkel): alle oben genannten Abläufe, ohne Seitenfehler.
