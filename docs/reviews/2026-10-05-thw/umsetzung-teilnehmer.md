# Umsetzung Bereich „Teilnehmer“ – THW-Review 2026-10-05 (zweiter Lauf)

Branch `thw-fix2/teilnehmer`. Zuständig: `src/teilnehmer/*`, Teilnehmer-CSS in
`src/styles/main.css`, `tests/teilnehmer`. Die Sync-Zustandslogik (`LiveStatusService`)
ist unverändert; die Teilnehmeransicht liest nur `getState()` und `getOffeneAenderungen()`.

Code-Commit: `026fed6` (`fix(teilnehmer): …`), dieser Bericht: `docs(teilnehmer): …`.

## Geprüft (Playwright gegen lokalen Build, Mock-Modus, Port 3113)

| Messung | vorher (Bericht) | nachher |
|---|---|---|
| „ausblenden“, zweiter Tipp nach 400/700/1200/2000/3800 ms | ab 700 ms zwei Sprüche abgesetzt | immer genau einer |
| ohne „ausblenden“, zweiter Tipp nach 1,5 s bei 15/50/85 % Breite | bei 85 % „wieder offen“ | bleibt abgesetzt (Tipp trifft das inerte Statusfeld) |
| Vordruck öffnen mit 2 von 8 abgesetzt | „Seite 1 / 8“ | „Seite 3 / 8“ |
| Vordruck nach dem Abhaken: `elementFromPoint` auf Zurück/Mitte/Weiter | Weiter → „Rückgängig“ | Zurück → `btn-doc-prev`, Mitte → Statusfeld, Weiter → `btn-doc-next` |
| Pixel 7 quer: Vordruck | ca. 35 px breit, kein Vollbild | Dialog 863×360 (Vollbild), Vordruck 854 px breit, scrollt im Fenster |
| iPhone SE, X-Zeit, Fokus-Knopf | y = 715 von 667 | y = 421–468 von 667 |
| „Jetzt starten“ / Neustart | 96×30 px, setzt still neu | 111×44 px, heißt danach „Neu starten“, Rückfrage (1 Dialog gemessen) |
| Offline abhaken | Karte wie online, Badge außerhalb des Bilds | Karte „⚠ Nur auf diesem Gerät – wird gesendet …“, Badge „Keine Verbindung – 1 Spruch nur hier“, mitlaufende Leiste; online: „An die Übungsleitung gesendet“, „alles gesendet HH:MM“ |
| Zurücksetzen offline | Rückfrage, dann sofort lokal gelöscht | abgelehnt: „… es wurde nichts gelöscht.“ |
| Reload nach 5 von 8 | nächster Spruch y = 1022 / 839 | gescrollt, Nr. 6 bei y = 549–710 / 839 |

## Befunde

| Bericht / Befund | Ergebnis | Umsetzung / Begründung |
|---|---|---|
| stress-test P1-1 „ausblenden“: zweiter Tipp markiert den nachrutschenden Spruch | umgesetzt | `listenAnsicht.ts`: die eben abgesetzte Karte bleibt `HALTEN_MS` (3 s) stehen, gesteuert über die Uhr statt über das erste Neuzeichnen (Ursache war das zweite Neuzeichnen durch den Live-Sync). Danach Abgang und Listensperre `KONTEXT_SPERRE_MS` (1,5 s), sichtbar als gedimmte Knöpfe. Test + E2E „slow second tap“. |
| stress-test P2-1 träger zweiter Tipp trifft „Zurücknehmen“ | umgesetzt | An der Stelle des Absetzen-Knopfs steht nach dem Absetzen ein Statusfeld ohne Funktion, gleich hoch; „Zurücknehmen“ klein und 0,9 rem darunter. Gegenaktion je Spruch 2,5 s gesperrt (`GEGENAKTION_SPERRE_MS`). |
| stress-test P2-2 / workflow W5 Vordruck beginnt bei Seite 1 | umgesetzt | Öffnet beim ersten offenen Spruch. Automatisches Weiterblättern nach dem Abhaken bewusst **nicht**: dann läge der Abhak-Knopf des nächsten Spruchs wieder unter einem trägen zweiten Tipp (dasselbe Muster wie stress P1-1). Stattdessen wird „Weiter“ nach dem Abhaken zum Hauptknopf. |
| glove-touch P1-1 Rückgängig-Leiste über der Vordruck-Aktionsleiste | umgesetzt | Im Vordruck eigene Zeile zwischen Vordruck und Knopfleiste (`#teilnehmerDocRueckgaengig`). In der Liste schwebt die Leiste auf der Bildschirmhälfte, in der nicht getippt wurde (`leistenPosition`), also nie über dem eben getroffenen Knopf oder der Karte darunter. |
| glove-touch P2-1 Vordruck: „Zurücknehmen“ an Stelle und Größe von „Absetzen“ | umgesetzt | Mitte zeigt „✓ abgesetzt HH:MM“ als inertes Feld; „Zurücknehmen“ klein in der Statuszeile (`#btn-doc-zuruecknehmen`), mit Kontextsperre. |
| glove-touch P2-2 Querformat: Vordruck als Briefmarke | umgesetzt (Vordruck) | Modal bei `max-height: 540px` und Querformat Vollbild, Knopfleiste einzeilig, Maßstab nach Breite (`massstabFuer`), Scrollen im Fenster. Die Liste im Querformat (Kopfzeile der Website frisst den Bildschirm) ist globales Layout und nicht geändert. |
| glove-touch P2-3 X-Zeit auf iPhone SE: Fokus-Knopf unter der Falz, „Jetzt starten“ 30 px und still wiederholbar | umgesetzt | X-Zeit-Karte und Fokus-Karte stehen direkt unter dem Kopf (vor Ansichtswahl und Suche), eigenes Zeitfeld eingeklappt (`xZeitMarkup.ts`), Bedienelemente ≥ 44 px. Knopf heißt nach dem Start „Neu starten“; jede Änderung einer gesetzten eigenen Basis (auch Löschen) fragt nach (`bestaetigeAbweichung`). |
| error-recovery P3-1 / destructive-action P3-2 schnelles Rückgängig still ignoriert | umgesetzt | Rückgängig hat keine Sperre mehr; das ist sicher, weil die Leiste nie unter dem Finger auftaucht (s. glove P1-1). |
| field-user P2 / analog-first P3-4 / offline P2-2 offline abgehakt nicht unterscheidbar, keine Zahl, keine Uhrzeit | umgesetzt | `zustellung.ts` merkt geänderte Sprüche (gerätelokal, eigener localStorage-Schlüssel, kein Firestore-Feld) bis `getState() === "live"` und `getOffeneAenderungen() === 0`; Abgleich sekündlich und bei Zustandswechsel. Je Karte: „Nur auf diesem Gerät …“ (Warnfarbe) / „Wird gesendet …“ / „An die Übungsleitung gesendet“ / „Leitung hat bestätigt HH:MM“. Badge mit Zahl und „alles gesendet HH:MM“, Tooltip mit letzter Bestätigung. Mitlaufender Hinweis `#teilnehmerSyncLeiste` (sticky, lässt Tipps durch) nur ohne Verbindung. |
| field-user P3 Teilnehmer sieht die Leitungsbestätigung nicht | umgesetzt | Das Statusfeld der Karte nennt „Leitung hat bestätigt HH:MM“; die separate Leitungszelle ist am Handy ausgeblendet (Doppelung). |
| field-user P2 nach Neuladen nächster offener Spruch unter der Falz | umgesetzt | `scrolleZumNaechsten()` nach dem ersten Rendern, nur wenn der nächste offene nicht der erste ist und unter der Falz liegt. Zusammenklappen erledigter Sprüche nicht umgesetzt (Scrollen genügt, keine zweite Darstellung). |
| field-user P2 X-Zeit vor dem Start: widersprüchliche Anweisung, keine Sprüche | umgesetzt | Eine Aussage („Warte auf die X-Zeit der Übungsleitung – sie erscheint hier automatisch“), „Jetzt starten“ nur im eingeklappten „Ohne Übungsleitung üben“. Fokus-Karte nennt den ersten Spruch mit Nummer, Empfänger und Minute, ohne Text und ohne Abhak-Knopf (künftige Texte bleiben im Fokus-Modus verborgen). |
| workflow W2 Rollenspieler sehen ihren Rückstand nicht | umgesetzt | X-Zeit-Zeile: „N fällig, älteste seit M min · Nächste in …“ (`rueckstandText`), Fokus-Karte: „N weitere Meldungen fällig, diese seit M min“. |
| night-visibility Befund 1 (Teilnehmer-Teil) Warnzeile Fokus-Karte im Dark Mode unlesbar | umgesetzt | Eigene Klasse `.teilnehmer-fokus-rueckstand` mit `--warn-text`/`--warn-fond`, Rahmen und ⚠. Die allgemeine Umstellung der Bootstrap-Emphasis-Farben (Leitung, Gefahrenbereich) ist globales CSS – nicht mein Bereich. |
| night-visibility Befund 4 Abhak-Knopf mit Haken und Grün | umgesetzt | Liste, Fokus und Vordruck: „Als abgesetzt markieren“ als `btn-primary` ohne Haken; Grün und ✓ nur für den Status. |
| night-visibility Befund 7 deaktiviertes „Zurück“ im Vordruck kontrastarm | umgesetzt | Deaktiviert ohne Deckkraftabsenkung, `--text-2`, gestrichelter Rand. |
| offline P1-4 Teilnehmer setzt ohne Netz „für alle“ zurück | umgesetzt | `zuruecksetzen.ts`: ohne Verbindung (`offline`/`fehler`/`navigator.onLine === false`) abgelehnt, bevor gefragt wird; sonst `flush(10 s)`, ohne Bestätigung wird lokal nichts gelöscht und nicht neu geladen – wie bei der Leitung. |
| offline P1-2 Reload ohne Datenbank: Code-Formular schiebt Schuld auf die Codes | teilweise | Ladefehler (oder offline „nicht gefunden“) zeigen jetzt `renderVerbindungsFehler`: „Deine Codes sind in Ordnung … Markierungen auf diesem Gerät … ausgedruckte Vordrucke“, mit „Erneut versuchen“, ohne Code-Formular. Die Übung selbst offline vorzuhalten ist Firestore-Persistenz (core-offline). |
| offline P3-1 Beitritt im Funkloch meldet „nicht gefunden“ | umgesetzt | Leeres Ergebnis bei `navigator.onLine === false` → Verbindungsmeldung. |
| analog-first P3-2 ZIP offline nur „konnte nicht erstellt werden“ | umgesetzt (Meldung) | Offline: Grund und Ausweg (Vordruck-Ansicht, später mit Netz). Den ZIP-Teil vorzuladen gehört zu `pdfGeneratorLazy` (core-pdf). |
| field-user P3 Code-Hinweis 0/O, 1/I führt in die Irre | umgesetzt | Hinweis: „Codes enthalten kein O, keine 0, kein I und keine 1 …“. Bei „nicht gefunden“ werden O/0/I/1 in der Eingabe benannt (`nichtGefundenMeldung`). Nicht abgelehnt, weil ältere Codes (und der E2E-Seed „A1B2“) sie enthalten dürfen. |
| field-user P3 „Sync“, „X+3“ unklar | umgesetzt (Teilnehmer) | Badge in Klartext („Übungsleitung: live“, „Keine Verbindung – …“, „Nur auf diesem Gerät“), Fokus „Nr. 3 bei X+3 min“. Kennzahlen der Leitung und DTG im App-Kopf nicht mein Bereich. |
| field-user P3 / glove-touch P3-1 kleine Schalter, Suchfeld 30 px | umgesetzt | Ganze Schalterzeile (Label) ≥ 44 px, Suchfeld 44 px. Zwei Menüs übereinander: globale Navigation, nicht geändert. |
| glove-touch P3-2 kein Sprung ins zweite Code-Feld | umgesetzt | `bindeCodeSprung` nach sechs Zeichen, Felder ≥ 48 px. |
| error-recovery P3-3 Schnellzugang mit falscher Länge ohne Meldung | teilweise | Kommt im Teilnehmer-Formular ein unvollständiger Code aus dem Link an, steht die Formatmeldung sofort da. Die Prüfung im Generator-Schnellzugang gehört zum Generator. |
| destructive-action P3-1 native „OK“-Dialoge | nicht umgesetzt | Eigene Dialoge wären ein Umbau von `UiFeedback` (Kern). |
| new-user P3-5 / glove P3-1 zwei Menüs | nicht umgesetzt | Globale Navigation (`scripts/lib/navigation.mjs`, App-Kopf). |
| analog-first P3-1 Papierzeiten haben keinen Weg zurück | nicht umgesetzt | Begründung wie im ersten Lauf: Zeiteingabe je Spruch würde die Hauptaktion am Handy verkomplizieren; Nachtrag liegt bei der Leitung. Der Fußtext der Übersicht ist PDF (core-pdf). |
| offline P1-1 / P1-3 / P3-2, analog P3-3 Generator-Druckteil, Service Worker, Toasts | nicht mein Bereich | core-pdf / core-offline / Generator. |

## Dateien außerhalb der Zuständigkeit

- `e2e/app.spec.ts`: Handy-Test öffnet den Vordruck jetzt bei „Seite 2 / 2“ (vorher Klick auf
  „Weiter“), prüft Statusfeld und dass „Zurück“ während der Rückgängig-Zeile getroffen wird;
  neuer Test „with hiding on, a slow second tap does not mark the next message“. Nicht ausgeführt
  (Vorgabe), nur gelesen und angepasst.
- `src/styles/main.css`: nur Teilnehmer-Abschnitte; eine globale Regel ist nicht angefasst.

## Hinweise für die Zusammenführung

- `LIVE_SYNC_LABELS` heißt nicht mehr „Sync: …“. E2E prüft beim Teilnehmer nur `live`, das bleibt im Text.
- Selektoren `[data-aktion='absetzen']`, `#btn-doc-absetzen`, `#teilnehmerRueckgaengig`,
  `#btn-teilnehmer-rueckgaengig` bestehen weiter. `#btn-doc-absetzen` ist bei abgesetztem Spruch
  `hidden`; die Rücknahme im Vordruck ist `#btn-doc-zuruecknehmen` (Leertaste wie bisher).
- `resetRueckfrage` liegt jetzt in `src/teilnehmer/zuruecksetzen.ts` und wird aus `index.ts` re-exportiert.
