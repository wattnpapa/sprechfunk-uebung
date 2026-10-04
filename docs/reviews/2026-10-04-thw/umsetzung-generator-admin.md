# Umsetzung Bereich Generator und Admin

Branch `thw-fix/generator-admin`, Stand 2026-10-04. Zuständig für `src/generator/*`,
`src/admin/*`, die Generator- und Admin-Teile von `src/styles/main.css` sowie
`GenerationService`/`FirebaseService`. Beide Services blieben unverändert; alles
ließ sich im Generator-Controller lösen.

Neue Module:

- `src/generator/GeneratorValidierung.ts`: Eingabeprüfung als reine Funktionen, mit Feldbezug.
- `src/generator/GeneratorEntwurf.ts`: Formular-Entwurf im localStorage.
- `src/generator/GeneratorHinweise.ts`: stehende Rückmeldungen (Feldfehler, Fehlerkasten,
  Veraltet-Hinweis, Entwurf, Rückgängig, Statusleiste).
- `src/generator/beuebteStelleBlatt.ts`: Blatt „Lage und Auftrag“ für die beübte Stelle.

## Befunde

| Bericht / Befund | Status | Umsetzung oder Begründung |
|---|---|---|
| destructive-action P0-2: Neu generieren überschreibt verteilte Übung | umgesetzt | Eine gespeicherte Übung zeigt „Diese Übung ist gespeichert (Übungscode …)“. Der Hauptknopf heißt dann „Als neue Übung generieren“: neue ID, neuer Übungscode, neue Teilnehmercodes, neuer Seed. Die alte Übung bleibt unverändert. Überschreiben gibt es nur über den eigenen Knopf „Bestehende Übung überschreiben …“. Dessen Rückfrage nennt die Folgen: Ausdrucke passen nicht mehr, Links zeigen andere Sprüche, umbenannte Teilnehmer bekommen neue Codes, Status hängen an Nachrichtennummern und sind zurückzusetzen, Lösungswörter gelten sofort. `src/generator/index.ts` (`startUebung`, `rueckfrageText`, `alsNeueUebungVorbereiten`) |
| workflow F1 (P1): Status zeigen nach Neugenerieren auf andere Sprüche; Lösungswort wechselt | umgesetzt | Wie oben. Ursache des Lösungswortwechsels: `updateUI()` loste beim Öffnen per ID neu aus. Jetzt `renderTeilnehmer(false)`, die gespeicherten Wörter bleiben. Status werden beim Überschreiben nicht automatisch zurückgesetzt, das wäre ein Eingriff in den Live-Status (Bereich leitung-sync). Die Rückfrage sagt deshalb ausdrücklich, dass sie in der Übungsleitung zurückzusetzen sind. |
| stress-test P3-2: „Neu generieren“ ersetzt Sprüche unter denselben Links | umgesetzt | siehe P0-2 |
| error-recovery P2-5: Ergebnis wirkt nach Änderungen aktuell | umgesetzt | Jede Eingabe nach dem Generieren blendet über dem Ergebnis „Eingaben geändert. Das Ergebnis unten zeigt noch den gespeicherten Stand …“ ein und dimmt die Links. Die Rückfrage nennt die Folgen, zählt aber nicht jeden betroffenen Teilnehmer einzeln auf. |
| error-recovery P1-3 / stress-test P1-4: Reload verliert Formular | umgesetzt | Das Formular einer noch nicht gespeicherten Übung wird nach 400 ms als Entwurf gesichert (`generatorEntwurf:v1`). Beim nächsten Öffnen kommt es wieder, mit dem Hinweis „Deine Eingaben vom … wurden wiederhergestellt“ und dem Knopf „Entwurf verwerfen“. Nach erfolgreichem Generieren wird der Entwurf gelöscht. Hochgeladene Dateien lassen sich nicht wiederherstellen (Browser-Grenze). |
| stress-test P2-1 / error-recovery P1-3: Adresse ohne Übungs-ID, Reload verliert Ergebnis | umgesetzt | Nach dem Speichern `history.replaceState` auf `#/generator/<id>`. Reload und Lesezeichen zeigen das Ergebnis mit Links. `src/core/router.ts` blieb unverändert, das Format `#/generator/<id>` gab es schon. Bewusst `replaceState` und kein neuer Verlaufseintrag: „Zurück“ verhält sich wie vorher. Wer direkt eingestiegen ist, verlässt damit die App. Das Ergebnis geht dabei nicht mehr verloren, weil die Adresse jetzt darauf zeigt. |
| new-user P1-3 / workflow F7: Vorbelegung mit 11 Vorlagen inkl. „Lustige Funksprüche“, fremden Rufnamen, „Musterstadt“ | umgesetzt | Keine Vorlage ist vorausgewählt. Eine neue Übung hat drei leere Teilnehmerzeilen, Rufgruppe und Leitung sind leer; Beispiele stehen nur als Platzhalter. Die Rollen der Führungsstellen-Übung sind ebenfalls leer vorbelegt (Platzhalter „z. B. Heros Musterstadt 10“). Eine Rückfrage beim Generieren entfällt: Leere Pflichtfelder werden am Feld gemeldet. Der zufällige Übungsname bleibt, er ist kein fremder Funkrufname. |
| offline-resilience P1-2 / analog-first: „Übung generieren“ ohne Netz tut still nichts | umgesetzt | Bei `navigator.onLine === false` kommt sofort eine Meldung. Nicht ladbare Vorlagen, Szenarien und Drehbücher melden „Prüfe die Internetverbindung“. Speichern hat ein Zeitlimit von 15 s. Bei jedem Fehlschlag wird der vorherige Stand der Übung wiederhergestellt; die Meldung steht dauerhaft im Fehlerkasten an der Aktionsleiste und sagt, ob die angezeigten Links noch gelten („zuletzt gespeicherte Fassung“) oder ob es noch keine gibt („Gib noch keine Links weiter“). Während des Laufs sind die Knöpfe gesperrt, ein Doppelklick erzeugt nichts doppelt. |
| offline-resilience P0-2: ZIP/Übersicht im Generator ohne Meldung | teilweise | Die Generator-Knöpfe (ZIP, Sammel-PDF, Drehbuch) melden Fehler jetzt sichtbar. Die eigentliche Ursache, das gecachte fehlgeschlagene `import()` in `src/services/pdfGeneratorLazy.ts`, liegt im Bereich core-pdf. |
| error-recovery P2-1: Fehlermeldungen nur als Toast, kein Feld markiert | umgesetzt | Alle Eingabefehler werden auf einmal gesammelt. Jedes Feld bekommt `is-invalid`, `aria-invalid` und einen Text darunter, das erste wird angesprungen. Zusätzlich steht ein Fehlerkasten (`role="alert"`) bis zum nächsten Versuch. Eine Korrektur am Feld entfernt dessen Markierung sofort. Der Toast bleibt als Zusatz; seine Anzeigedauer (`src/core/UiFeedback.ts`) gehört nicht zu diesem Bereich. |
| error-recovery P2-2: 9999 Sprüche frieren den Tab ein | umgesetzt | Obergrenze 200 Funksprüche pro Teilnehmer mit Meldung am Feld (`MAX_SPRUECHE_PRO_TEILNEHMER`), dazu `max="200"`. Prozentfelder außerhalb 0–100, leere oder nicht ganze Werte und X-Zeit-Intervall < 1 werden ebenfalls am Feld gemeldet. |
| error-recovery P3-1: Doppelte Funkrufnamen nur exakt erkannt | umgesetzt | Der Vergleich ignoriert Groß-/Kleinschreibung und Leerraum, beide Zeilen werden markiert („Gleicher Funkrufname wie in Zeile …“). Gleiches gilt für die Rollen der Führungsstellen-Übung. |
| error-recovery P3-2 / destructive-action P2-2 / glove-touch P3-1: Teilnehmer ohne Rückgängig entfernt; Lösungswort beim Umschalten verloren | umgesetzt | Nach dem Entfernen erscheint 10 s lang „„Name“ entfernt. Rückgängig“, das Name, Stelle und Lösungswort an der alten Position zurückbringt. Leere Zeilen lassen sich jetzt ebenfalls entfernen; vorher war das ein stiller No-op. Eigene Lösungswörter werden je Option gemerkt und beim Zurückwechseln wieder eingesetzt. |
| new-user P2-6 / workflow F9: Statusleiste „Teilnehmer: 0“, Begriffe unerklärt | umgesetzt | Die Statusleiste rechnet vor dem Generieren live aus dem Formular (Teilnehmer, „ca. N“ Nachrichten, Lösungswort-Modus). „Dauer (opt.)“ heißt jetzt „Dauer (optimal)“. Kurze Hilfetexte stehen bei Spiel-Modus (Klassisch/X-Zeit), Intervall/Start-Offset, Quelle (Vorlagen/Szenario/Führungsstellen-Übung), Vorlagenauswahl, Stellenname, Auto-Stärke und Spruch/Durchsage. „Ergibt 1 Nachrichten“ heißt jetzt „= 1 je Teilnehmer“. Die Code-Box ist als „Du nimmst an einer Übung teil …?“ gekennzeichnet. Bei der Führungsstellen-Übung zeigt die Statusleiste die Drehbuchdauer statt der Funkspruch-Schätzung (428 statt 180 Min). |
| new-user P2-7: Unklar, welcher Link wofür ist | umgesetzt | Die Zeilen heißen „Übung bearbeiten – nur für dich, nicht an Teilnehmer geben“, „Übung überwachen – für die Übungsleitung“ und „Link oder Codes an diese Funkstelle weitergeben“. Die Spalten heißen „Zweck / Wer bekommt ihn / Link und Codes“, darüber steht ein Satz „Wer bekommt was“. Auch die Mail für den Bearbeiten-Link sagt, dass er nicht für Teilnehmer ist. `data-link-type` blieb unverändert (E2E, Screenshot-Skript). |
| new-user P2-5 (Teil Generator): Rückweg zur eigenen Übung unklar | umgesetzt | Hinweis im Ergebnis: Link aufheben, die Adresse dieser Seite führt ebenfalls zurück. Der aktive Menüpunkt je Rolle gehört zum Kopf (core) und wurde hier nicht geändert. |
| analog-first P2-4 / offline-resilience P2-4: Kein Hinweis „vorher drucken“ | umgesetzt | Am ZIP-Knopf: „Druck die Unterlagen vor der Übung aus. Ohne Netz lässt sich diese Seite nicht neu laden; dann sind die Ausdrucke die Rückfallebene.“ |
| Auftrag: Lösungswort-Spalte nicht abschneiden | umgesetzt | Das Lösungswort-Feld ist mindestens so breit wie das längste vordefinierte Wort. Sobald Stellenname oder Lösungswörter angezeigt werden, belegt die Teilnehmerkarte ab 992 px eine ganze Zeile (`:has()`). Ohne `:has()` scrollt die Tabelle innerhalb der Karte (`.table-responsive`), statt abzuschneiden. |
| workflow F8 (P2, teils Annahme): Kein Blatt für die beübte Stelle | teilweise | Im Ergebnis einer Führungsstellen-Übung steht, dass die beübte Stelle keinen Link bekommt und Drehbuch und Rollenkarten nicht sehen darf. Der Knopf „Blatt für die beübte Stelle drucken (Lage und Auftrag)“ öffnet ein Druckblatt aus den vorhandenen Drehbuchfeldern `lage` und `auftrag` mit Beginn, Dauer und Funkrufnamen, ohne Erwartungen. Ein eigenes PDF im ZIP und Dokumentverweise bei Ausdruck/E-Mail-Einspielungen im Leitungsplan liegen in den Bereichen pdf und Übungsleitung. |
| destructive-action P1-1 / error-recovery P2-6 / new-user P3-3: Admin-Löschen | umgesetzt (ohne Rückgängig) | Die Knöpfe sind beschriftet („Öffnen“, „Überwachen“, „Löschen“) und haben ein `aria-label` mit dem Übungsnamen. „Löschen“ ist rot umrandet und hat Abstand zu den anderen. Die Rückfrage nennt Name, Datum, Rufgruppe, Teilnehmerzahl und Übungscode und sagt, dass alle Links danach nicht mehr funktionieren. Nach dem Löschen kommt „Übung „…“ gelöscht.“. Ein Rückgängig fehlt bewusst: Es bräuchte einen Papierkorb oder verzögertes Löschen in Firestore samt Regeln. Ein Neu-Anlegen aus der Liste könnte unvollständige Daten schreiben. |
| glove-touch P3-2: Admin auf dem Smartphone | teilweise | Auf Touch-Geräten sind Aktionsknöpfe und Blätterknöpfe mindestens 44 px groß und beschriftet. Eine Kartenansicht statt Tabelle wurde nicht gebaut, weil die Verwaltung laut Bericht kaum unterwegs genutzt wird. |
| glove-touch P3-1: Generator-Ziele klein | umgesetzt | Bei `pointer: coarse` sind Radio- und Checkbox-Zeilen mindestens 44 px hoch, die Eingaben größer, der Papierkorb und das „×“ der Abschnitte mindestens 44 px, das Chip-„×“ 36 × 32 px. Die Code-Felder haben jetzt normale Höhe. |
| night-visibility Befund 9: Deaktivierte Admin-Blätterknöpfe 2,55:1 | umgesetzt | Volle Deckkraft mit `--text-2` auf `--flaeche-2` (Token, gilt in beiden Themes). Der Hover-Kontrast des Primärknopfs im Dark Mode ist ein globaler Button-Token und wurde nicht geändert. |
| night-visibility Befund 3: Generator-Chart ohne Dark-Farben | nicht hier | Laut Auftrag beim Agenten für `src/core/chart.ts`; Chart-Code im Generator wurde nicht angefasst. |
| field-user P3: Code-Felder ohne Eingabehilfen (Generator-Schnellzugang) | umgesetzt | `autocapitalize="characters"`, `autocomplete="off"`, `spellcheck="false"`, normale Feldhöhe. Das Formular der Teilnehmeransicht gehört zum Bereich teilnehmer. |
| command P3-3: Admin-Liste ohne Stand der Übungen | nicht umgesetzt | Dafür müsste die Liste für jede Übung die Status-Unterkollektion lesen, also mehr Firestore-Reads je Seite. Für den Zweck (Aufräumen) zu teuer; der Bericht stuft es selbst als gering ein. |
| offline-resilience P1-1: Seite ohne Netz nicht ladbar (Service Worker) | nicht umgesetzt | Produktentscheidung außerhalb des Generators (App-Hülle, Caching). Hier ersetzt durch den Druck-Hinweis. |
| offline-resilience P2-3: Toasts verschwinden nach 2,5 s | nicht hier | `src/core/UiFeedback.ts` gehört zum Kern. Im Generator ist der stehende Fehlerkasten die Abhilfe. |
| destructive-action P3-1: Browser-`confirm` mit „OK“ | nicht umgesetzt | Ein eigener Dialog gehört in `UiFeedback` (Kern) und gälte für alle Bereiche. Im Generator ist das Risiko anders gelöst: Der folgenschwere Weg hat einen eigenen, eindeutig beschrifteten Knopf, die Rückfrage ist nur die zweite Stufe und nennt die Folgen. |
| new-user P3-1: Datumsformat 10/04/2026 im Datumsfeld | nicht umgesetzt | `input type=date` zeigt das Format des Browsers bzw. Betriebssystems; ein eigenes Datumsfeld wäre mehr Code als Nutzen. |
| workflow F9: Kurzlink, Navigation, beübte Stelle in der Leitung, Nummerierung, ZIP-Gliederung | nicht hier | Teilnehmer-, Kern-, Leitungs- und PDF-Bereich. |

## Zusätzlich gefunden und behoben

- **Gespeichertes XSS im Admin:** Übungsname, Rufgruppe, Leitung und Teilnehmerliste gingen
  ungefiltert in `innerHTML`, obwohl jeder anonym Übungen anlegen darf. Diese Werte werden
  jetzt maskiert (`src/admin/AdminView.ts`). Ebenso die Werte der Teilnehmertabelle im
  Generator (`GeneratorTeilnehmerTableRenderer.ts`); eine per Link geöffnete Übung konnte dort
  Markup einschleusen.
- Ein nicht gefundener oder nicht ladbarer Link `#/generator/<id>` meldet das jetzt, statt
  still ein leeres Formular zu zeigen.

## Dateien außerhalb der Zuständigkeit

- `e2e/app.spec.ts`, `e2e/funkspruch-archiv.spec.ts`: an die neue Vorbelegung angepasst
  (Leitung füllen, Vorlage wählen, Abschnitte und Teilnehmer eintragen, Multi-Select-Test ohne
  Vorauswahl) und um Prüfungen für Feldfehler und den Hinweis zur beübten Stelle erweitert.
  Nicht ausgeführt (Port-Konflikt mit parallelen Agenten).
- `scripts/generate-anleitung-screenshots.mjs`: im zweiten Lauf die Leitung füllen.
- `src/styles/main.css`: nur ein neuer Block zwischen Generator und Übungsleitung.

## Prüfung

`npm run lint` ohne Fehler, `npx vitest run` grün, Build und `npm run perf:budget` grün. Im
Worktree braucht Rollup wegen des verlinkten `node_modules` `--preserveSymlinks`; das ist eine
Eigenheit der Arbeitsumgebung, keine Codeänderung. Sichtprüfung mit Playwright im Mock-Modus
(Desktop 1440 px und Pixel-7-Profil): Feldfehler, Entwurf nach Reload, Lösungswort-Merker,
9999-Grenze, Adresse nach dem Generieren, Reload mit Ergebnis, neue Übung mit neuer ID neben
der alten, Überschreiben, Rückgängig, Fehler der Führungsstellen-Rollen, Admin-Rückfrage und
Erfolgsmeldung.
