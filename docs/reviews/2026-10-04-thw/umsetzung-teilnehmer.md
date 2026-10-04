# Umsetzung Bereich „Teilnehmer“ – THW-Review 2026-10-04

Branch `thw-fix/teilnehmer`. Zuständig waren `src/teilnehmer/TeilnehmerView.ts` (ohne
`renderPdfPage`), die UI-Steuerung in `src/teilnehmer/index.ts` (ohne X-Zeit-Basis-Übernahme und
Live-Sync-Logik), `src/teilnehmer/init.ts` und das Teilnehmer-CSS.

Geprüft mit eigenem Playwright-Skript gegen einen lokalen Build (Mock-Modus) auf iPhone SE
(375×667), 360×740, Pixel 7 (412×839, hell und dunkel), Pixel 7 quer (839×412) und Desktop
1366×900, dazu die Teilnehmer-Specs aus `e2e/app.spec.ts` gegen denselben Server.

## Messwerte vorher / nachher

| Messung | vorher | nachher |
|---|---|---|
| Pixel 7: Abhak-Ziel | Chip 78×27 + Schalter 34×17, rechts außerhalb (x bis 554 bei 412 px) | ein Knopf 339×48, vollständig im Bild |
| Pixel 7: erster Spruch beginnt bei | 727 px (von 839) | 449 px, Knopf endet bei 623 px |
| iPhone SE 375×667: Knopf des ersten Spruchs | nicht sichtbar | 611–659 px, ohne Scrollen sichtbar |
| 360 px: Elemente über dem rechten Rand | 8 (ZIP, Löschen, Ansicht, Chips, Schalter) | 0 |
| Tabelle `scrollWidth` / Breite bei 412 px | 571 / 372 (Seitwärtswischen) | 372 / 372 |
| Doppeltipp (150 ms) auf „abgesetzt“ | Markierung still wieder weg | bleibt „abgesetzt“, Rückgängig-Hinweis erscheint |
| Vordruck mobil: Schließen | 31×31 px, Oberkante unter App-Kopf | 126×44 px, Vollbild über dem App-Kopf |
| Vordruck mobil: Abhaken per Touch | nicht möglich | Knopf 185×60 px in der Fußleiste |
| Gerätezurück bei offenem Vordruck | verlässt die Ansicht / `about:blank` | schließt nur das Fenster |

## Begriff: „abgesetzt“ statt „übertragen“

Teilnehmer markierten bisher „übertragen“, die Leitung „abgesetzt“. Gemeint ist derselbe
Vorgang: der Spruch ist gefunkt. „Absetzen“ ist das Wort aus dem Sprechfunkbetrieb und steht
bei der Leitung schon im Bestand. „Übertragen“ war doppeldeutig (gefunkt vs. Daten an die
Leitung gesendet, field-user P2). Deshalb heißt die Teilnehmer-Aktion jetzt „Als abgesetzt
markieren“, der Status „abgesetzt HH:MM“, der Filter „Abgesetzte ausblenden“, im Fokus-Modus
„Alle Meldungen abgesetzt“. Die Sync-Hinweistexte sagen „gesendet“ bzw. „gehen an die
Übungsleitung“ und nie mehr „übertragen“. „gesendet“ als Teilnehmerstatus wurde verworfen,
weil es wieder nach Datenübertragung klingt.

Bei der Leitung bleibt „gemeldet“ für eine Teilnehmer-Markierung, die die Leitung noch nicht
bestätigt hat. Das passt: Der Teilnehmer meldet „abgesetzt“, die Leitung bestätigt. In der
Teilnehmerzeile steht die Bestätigung jetzt als „Leitung: bestätigt HH:MM“. Das gespeicherte
Feld heißt weiter `uebertragen`; es ändert sich nichts an Firestore, Regeln oder Merge.

Nicht angepasst (außerhalb des Bereichs): die Wörter „übertragen“ in der Übungsleitung
(`UebungsleitungTeilnehmerView.ts:329` „noch nichts übertragen“) und auf den Inhaltsseiten
(`src/pages/anleitung.html`, `faq.html`, `digitale-funkuebung.html`, `funktionen.html`). Die
Anleitung beschreibt außerdem noch den alten „Schalter“ und die Leertaste als einzigen Weg im
Vordruck; die Screenshots in `assets/anleitung/` zeigen die alte Oberfläche und müssen mit
`npm run anleitung:screenshots` neu erzeugt werden.

## Befunde

Spalte „Commit“: `fix` = `fix(teilnehmer): …` (Code und Tests), `docs` = dieser Bericht.

| Bericht / Befund | Ergebnis | Begründung / Umsetzung |
|---|---|---|
| field-user P1 Statusspalte am Handy außerhalb | umgesetzt (fix) | Unter 768 px Karte je Spruch statt Tabelle (`TeilnehmerView.renderNachrichten`, CSS „Teilnehmer: Kopf, Liste, Aktionen“). Ein vollbreiter Knopf „✓ Als abgesetzt markieren“ (≥ 48 px), Status als Wort und Farbe in der Karte, Leitungsbestätigung in der Karte. |
| glove-touch P1-3 Tabelle: Status abgeschnitten, zwei Mini-Ziele | umgesetzt (fix) | Der Schalter ist entfernt, es gibt genau einen Abhak-Knopf. Der Status-Chip ist nur noch Anzeige (`<span>`). |
| stress-test P1-2 Chip abgeschnitten | umgesetzt (fix) | wie oben; geprüft bei 360, 375 und 412 px. |
| night-visibility Befund 4 Statusspalte abgeschnitten | umgesetzt (fix) | Status steht vollständig mit Uhrzeit in der Karte. |
| workflow F10 / new-user P2-4 Tabelle am Handy | umgesetzt (fix) | wie oben. |
| stress-test P1-1, glove-touch P2-1 Doppeltipp nimmt Markierung still zurück (Teilnehmer) | umgesetzt (fix) | Zurücknehmen ist ein eigener, kleiner Knopf rechts in der Statuszeile, nicht an der Stelle des Abhak-Knopfs. Nach jedem Wechsel ist die Nachricht 1 s gesperrt (`STATUS_SPERRE_MS`). Jeder Wechsel zeigt 8 s lang „Spruch N als abgesetzt markiert – Rückgängig“; der Rückgängig-Knopf ist selbst 1 s gegen Doppeltipp gesperrt. Rückgängig stellt auch die ursprüngliche Absetzzeit wieder her. Der Leitungs-Teil des Befunds gehört dem Leitungs-Agenten. |
| error-recovery P2-4 falsch markierte Nachricht verschwindet bei „ausblenden“ | umgesetzt (fix) | Rückgängig-Hinweis nach jedem Wechsel; dazu „(N ausgeblendet)“ neben dem Schalter. |
| field-user P1 / glove-touch P1-2 / stress-test P1-3 / workflow F6 / new-user P2-4 Vordruck: Abhaken nur per Leertaste | umgesetzt (fix) | Fußleiste im Vordruck: Status, „Abgesetzte ausblenden“, Zurück, großer Knopf „✓ Als abgesetzt markieren“ / „Zurücknehmen (wieder offen)“, Weiter. Kontextsperre 1 s für Knopf und Leertaste, weil der Vordruck danach auf den nächsten Spruch springen kann. Tastenlegende nur bei Geräten mit Maus und ab 768 px, Text „Leertaste – Abgesetzt / zurücknehmen“. |
| (beim Prüfen gefunden) erster Spruch im Vordruck ließ sich nicht abhaken | umgesetzt (fix) | `getCurrentDocMessage` lehnte Seite 1 ab (`docPage <= 1`), obwohl Seite 1 Spruch 1 ist. Test „lässt im Vordruck auch den ersten Spruch abhaken“. |
| glove-touch P2-3 / stress-test P1-3 Modal unter fixierter Kopfzeile, Schließen 31 px | umgesetzt (fix) | Das Fenster wird beim Öffnen an `<body>` gehängt (ein Vorfahr bildete einen eigenen Stapel- und Positionierungskontext), `z-index` über dem App-Kopf, unter 768 px Vollbild. „Schließen“ ist ein beschrifteter Knopf mit 44 px. Schließen per Hintergrund-Tipp wird jetzt an den Controller gemeldet. |
| stress-test P2-2 Gerätezurück verlässt die Ansicht statt das Vordruck-Fenster zu schließen | umgesetzt (fix) | Das Öffnen legt einen Verlaufseintrag ohne neue Adresse an; „Zurück“ schließt nur das Fenster, Schließen per Knopf nimmt den Eintrag wieder weg (`merkeVordruckImVerlauf`). |
| field-user P1 / glove-touch P2-2 / stress-test P2-4 / workflow F10 Kopfzeile: „Lokale Daten löschen“ und ZIP ragen heraus | umgesetzt (fix) | Beide Knöpfe sind aus dem Kopf entfernt: ZIP in eine eigene Karte „Unterlagen für den Notfall“ am Seitenende, Zurücksetzen in einen eingeklappten, rot umrandeten Bereich darunter. Bei 360–412 px liegt kein Element mehr über dem Rand. |
| field-user P1 iPhone SE: Titel überlappt Menüknopf | umgesetzt (fix, globale CSS) | `.app-header-title p` kürzt unter 992 px mit Auslassungszeichen. Das ist eine Zeile im globalen App-Kopf, siehe „Dateien außerhalb“. |
| destructive-action P0-1 (Teilnehmer-Teil) / new-user P2-3 / field-user P3 „Lokale Daten löschen“ wirkt für alle | umgesetzt (fix) | Beschriftung nach Reichweite: mit Live-Verbindung „Abhak-Stand für alle zurücksetzen“, sonst „Abhak-Stand auf diesem Gerät löschen“ (`setResetUmfang`). Erklärtext daneben nennt Übungsleitung und andere Geräte und verweist für Einzelfehler auf „Zurücknehmen“. Rückfrage in Du-Form mit Anzahl („alle 2 als abgesetzt markierten Funksprüche“), Reichweite, Verlust der eigenen X-Zeit und „nicht rückgängig“. Die Rückfrage bleibt der Browser-Dialog mit „OK“ (destructive-action P3-1, `UiFeedback` ist Kernbereich). |
| field-user P1 / error-recovery P2-3 falscher Code / Fehlerseiten ohne Rückweg | umgesetzt (fix) | „Übung nicht gefunden“, „Teilnehmer nicht in dieser Übung gefunden“ und Ladefehler zeigen jetzt das Code-Formular mit der Meldung darüber (`renderZugangsFehler`). Bei unbekanntem Teilnehmercode ist der Übungscode vorbelegt. Hinweis auf 0/O und 1/I. |
| new-user P2-1 / workflow F9 geteilter Link braucht Extratipp | umgesetzt (fix) | Stehen beide Codes im Link, wird direkt aufgelöst und die Adresse ersetzt (`location.replace`, sonst führte „Zurück“ wieder auf den Link und gleich wieder vor). Bei falschen Codes bleibt das vorbelegte Formular mit Fehlermeldung. |
| offline P3-1 Beitritt offline: „nicht gefunden“ statt „keine Verbindung“ | teilweise (fix) | Wirft die Prüfung einen Fehler, heißt es jetzt „Die Codes konnten gerade nicht geprüft werden. Prüfe die Internetverbindung …“. Liefert Firestore offline aus dem leeren Cache still ein leeres Ergebnis, ist das von „nicht gefunden“ nicht zu unterscheiden; dafür bräuchte `FirebaseService` eine Cache-Kennung (nicht mein Bereich). |
| field-user P2 / stress-test P2-3 / glove-touch P2-2 erster Spruch unter der Falz, kein „als Nächstes“ | umgesetzt (fix) | Kompakter Kopf (Titel, Sync, „Ich / Rufgruppe / Übungsleitung“ in einer umbrechenden Zeile; Datum am Handy ausgeblendet), Überschrift „Meine Funksprüche“ am Handy nur für Screenreader, Website-Navigation in der Teilnehmerrolle am Handy zugeklappt (`klappeNavigationEin` in `init.ts`). Der erste offene Spruch trägt „als Nächstes“ und eine blaue Kante, auch ohne X-Zeit. |
| glove-touch P2-2 Querformat: kein Spruch sichtbar | teilweise (fix) | Pixel 7 quer: der erste Spruch beginnt jetzt bei 366 von 412 px (vorher 489), sein Text ist sichtbar; der Knopf braucht noch einen kurzen Scroll. Mehr ginge nur, wenn der fixierte App-Kopf im Querformat mitscrollt – das ist globales Layout und nicht mein Bereich. |
| new-user P3-3 doppelter Titel „Sprechfunkübung: Sprechfunkübung …“ | umgesetzt (fix) | `teilnehmerTitel`: das Präfix entfällt, wenn der Name schon „übung“ enthält. |
| field-user P2 / new-user P3-1 Datum als DTG „040000oct26“ | umgesetzt im Teilnehmerkopf (fix) | Datum als TT.MM.JJJJ, Uhrzeiten als HH:MM. Die DTG-Uhr im globalen App-Kopf ist nicht mein Bereich. |
| field-user P2 Fokus-Modus: kein Rückgängig; am Handy Standard | umgesetzt (fix) | Nach dem Abhaken Rückgängig-Hinweis; in der Fokus-Karte zusätzlich „Zuletzt abgesetzt: Meldung N – Zurücknehmen“ unter dem großen Knopf. Kontextsperre 1 s, damit ein Doppeltipp nicht die nachrückende fällige Meldung mit abhakt. Am Handy (≤ 576 px) ist der Fokus-Modus Standard, solange der Teilnehmer ihn nicht selbst umgeschaltet hat; nur bei X-Zeit-Übungen, weil nur dort Fälligkeiten existieren (klassische Übung: Hervorhebung „als Nächstes“). |
| field-user P2 Sync-Rückmeldung weit weg von der Aktion | teilweise (fix) | Der Rückgängig-Hinweis erscheint nach jedem Abhaken unten im Blickfeld. Ob die Markierung wirklich bei der Leitung ankam, kann die Ansicht erst zeigen, wenn der Sync-Zustand zuverlässig ist (offline P0-1, Sync-Agent). Die Sync-Titel nennen den Vorgang nicht mehr „übertragen“. |
| field-user P3 Code-Felder ohne Eingabehilfen | umgesetzt (fix) | `autocapitalize="characters"`, `autocorrect="off"`, `spellcheck="false"`, große Felder, vollbreiter Knopf am Handy, Längenangabe im Label. Die abweichende Beschriftung im Generator-Schnellzugang gehört zum Generator. |
| field-user P3 Fachbegriffe ZIP, lokale Daten, Sync | teilweise (fix) | „Alle meine Vordrucke herunterladen (ZIP)“ mit Erklärsatz, Zurücksetzen nach Reichweite benannt (s. o.). „Sync: …“ bleibt als Kurzwort, weil Text und Zustände dem Sync-Agenten gehören; der Tooltip erklärt es jetzt in Alltagssprache. |
| offline P2-4 kein Hinweis auf Offline-Vorbereitung | umgesetzt (fix) | Karte „Unterlagen für den Notfall“: ZIP vor der Übung laden oder drucken, falls am Übungsort das Netz wegfällt. |
| night-visibility Befund 6 Schalter im Dark Mode kaum sichtbar | umgesetzt (fix) | Teilnehmer-Schalter (auch Fokus-Modus) im Dark Mode mit hellerem Rand und hellem Knopf; Zustand bei „Abgesetzte ausblenden“ zusätzlich als Text „(N ausgeblendet)“. Schalterfläche 44 px hoch. |
| new-user P2-2 Begriffe je Rolle verschieden; Chip sieht aus wie Anzeige | umgesetzt (Teilnehmerseite, fix) | „abgesetzt“ wie bei der Leitung (s. Abschnitt Begriff). Status ist jetzt Anzeige, Aktion ist ein Knopf – wie bei der Leitung. |
| workflow F3 zwei Statuswelten, Debrief zählt nur Leitung | Begriff umgesetzt, Rest nicht | Gleiche Wortwahl ist umgesetzt. Debrief und „gemeldete übernehmen“ liegen bei Leitung/PDF. |
| new-user P2-5 / stress-test P2-4 „Übung erstellen“ in der Teilnehmerrolle aktiv, zwei Menüs | teilweise | Die Website-Navigation ist am Handy in der Teilnehmerrolle zugeklappt, damit stehen nicht mehr zwei Menüs offen übereinander. Die aktive Markierung „Übung erstellen“ entsteht zur Buildzeit (`scripts/lib/navigation.mjs`) und gehört zur globalen Navigation – nicht umgesetzt. |
| field-user P2 / workflow F2 X-Zeit startet jeder selbst | nicht umgesetzt | X-Zeit-Basis-Übernahme liegt laut Auftrag beim Übungsleitung/Sync-Agenten. Markup der X-Zeit-Karte bewusst unverändert gelassen. |
| offline P0-1 Sync-Anzeige bleibt offline grün | nicht umgesetzt | Offline-Erkennung liegt beim Sync-Agenten. Nur die Tooltip-Texte in `updateLiveSyncState` sind geändert (s. „Dateien“). |
| offline P1-3 Zurücksetzen hängt ohne Netz | nicht umgesetzt | `performReset` wartet auf `liveStatus.flush()` – Live-Sync-Logik, Sync-Agent. |
| offline P1-1 Reload ohne Netz | teilweise | Wirft `getUebung` (z. B. „client is offline“), erscheint jetzt eine verständliche Meldung mit Code-Formular statt einer leeren Seite. Offline-Vorrat (Service Worker, persistenter Cache) ist eine Produktentscheidung außerhalb des Bereichs. |
| new-user P1-2 / workflow F4 / B1 Vordruck bleibt weiß | nicht umgesetzt | `renderPdfPage` gehört dem core-pdf-Agenten. In diesem Lauf scheitern deshalb weiter die E2E-Tests „keyboard shortcuts work in modal“ und „doc preview renders pdf content“ (Seitenzahl wird erst nach dem Rendern gesetzt). |
| offline P0-2 / B3 Vordruck/ZIP nach Netzverlust dauerhaft kaputt | nicht umgesetzt | `pdfGeneratorLazy.ts`, core-pdf. |
| night-visibility Befund 8 Vordruck im Dark Mode invertiert | nicht umgesetzt | Wegen B1 im Testbrowser nicht ansehbar; ohne Ansicht keine begründete Änderung. Nach dem B1-Fix nachprüfen. |
| analog-first P3-1 je Nachricht erkennen, was noch nicht bei der Leitung ist | nicht umgesetzt | Braucht den Bestätigungsstand je Schreibvorgang aus dem Live-Sync (Sync-Agent). Die Leitungsbestätigung je Spruch ist am Handy jetzt sichtbar („Leitung: bestätigt HH:MM“). |
| analog-first P2-2 Papierzeiten nachtragen | nicht umgesetzt | Betrifft vor allem den Leitungsstatus und das Debrief. Für die Teilnehmeransicht als Ausbildungswerkzeug reicht der Klickzeitpunkt; eine Zeiteingabe je Spruch würde die Hauptaktion am Handy wieder verkomplizieren. |
| destructive-action P3-1 Browser-Dialog mit „OK“, Siezen | teilweise | Siezen im Teilnehmer-Dialog beseitigt. Eigene Dialoge mit handlungsbenannten Knöpfen wären ein Umbau von `UiFeedback` (Kern). |
| offline P2-2 Langsames Netz zeigt Generator-Formular | nicht umgesetzt | Startverhalten von `index.html`/`App`, nicht Teilnehmerbereich. |
| offline P2-3 Toasts verschwinden nach 2,5 s | nicht umgesetzt (Kern) | Für die Teilnehmer-Statuswechsel gibt es jetzt den eigenen, 8 s stehenden Rückgängig-Hinweis. |

## Dateien außerhalb der Zuständigkeit

- `src/styles/main.css`, Abschnitt „App-Kopf“ (`@media (max-width: 992px)`): sechs Zeilen
  `.app-header-title p { overflow: hidden; text-overflow: ellipsis; }` gegen die Überlappung
  von Schriftzug und Menüknopf auf 375 px. Der übrige CSS-Teil ersetzt nur den bisherigen
  Abschnitt „Teilnehmer: Dokumentenansicht“ und ergänzt die Teilnehmerliste davor; die Zeile
  `#teilnehmerTableView … min-width: 170px` (neben der Leitungsregel) ist nicht angefasst,
  sondern im Teilnehmerabschnitt überschrieben.
- `src/teilnehmer/TeilnehmerView.ts` → `updateLiveSyncState`: nur die `title`-Texte geändert,
  nicht Zustände oder Logik. Mögliche Überschneidung mit dem Sync-Agenten.
- `src/teilnehmer/TeilnehmerView.ts` → `renderHeader`: die X-Zeit-Karte ist unverändert, der
  Rest des Kopfs wurde umgebaut. Ändert der Sync-Agent dieselbe Methode, ist ein Konflikt
  wahrscheinlich; beim Zusammenführen die X-Zeit-Karte aus seinem Stand übernehmen.
- `e2e/app.spec.ts`: Selektor `.btn-toggle-uebertragen-chip` → `[data-aktion='absetzen']`,
  Kurzlink-Test auf direktes Öffnen umgestellt, drei neue Tests (falscher Code, Kurzlink mit
  falschem Code, Handy 375×667 mit Doppeltipp, Vordruck-Knopf und Gerätezurück).
- `scripts/generate-anleitung-screenshots.mjs`: derselbe Selektor.
