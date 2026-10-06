Befunde: P0=0 P1=2 P2=2 P3=3
Abgleich: behoben=3 teilweise=3 offen=0 nicht-pruefbar=0

# THW-Review: Folgenschwere Bedienhandlungen (destructive-action), dritter Lauf

Datum: 2026-10-06 · Perspektive: praktisch-technischer THW-Helfer, der zügig arbeitet und dabei versehentlich etwas Folgenschweres auslösen könnte · Methode: Skill `thw-destructive-action-reviewer`

Geprüft wurde am laufenden Build (`http://127.0.0.1:3000`, Mock-Modus, kein echtes Firebase) mit Playwright (Chromium 1194). Abgedeckt waren:

- Generator auf dem Desktop (1440×1000): Generieren, Überschreiben, Entwurf und Profile
- Teilnehmer auf dem Pixel 7: Liste, Vordruck und Gefahrenbereich
- Übungsleitung auf dem Desktop: klassische Übung und X-Zeit-Cockpit
- Admin auf dem Desktop

Jede Aktion wurde tatsächlich ausgelöst, wo möglich einmal abgebrochen und einmal bestätigt. Alle Dialogtexte wurden mitgeschnitten. Die Screenshots liegen im Scratchpad der Sitzung unter `destructive-action/NN-*.png`. Ihre Dateinamen stehen bei den Befunden.

Einordnung: Die App ist ein Ausbildungswerkzeug für Dienstabend und Ausbildung, kein Echteinsatzsystem. „Einsatzrisiko“ heißt hier, dass eine laufende oder vorbereitete Übung kaputtgeht, dass Teilnehmer mit falschen Unterlagen arbeiten oder dass die Übungsleitung ihre Mitschrift verliert.

## Urteil aus Sicht der Rolle

Die drei Hauptbaustellen aus dem zweiten Lauf sind erledigt:

- **X-Zeit-Basis:** Der Knopf heißt nach dem ersten Start „Neu starten (verschiebt alle Zeiten)“. Eine Änderung fragt mit alter und neuer Uhrzeit sowie der Zahl der danach überfälligen Sprüche nach, und eine Rückgängig-Leiste holt die alte Basis zurück.
- **Entwurf:** „Entwurf verwerfen“ hat einen harmlosen Nachbarn „Hinweis ausblenden ✕“ und danach ein „Rückgängig“.
- **Admin:** Das Löschen ist um 8 s verzögert, und ein „Rückgängig“ holt die Übung zurück.

Außerdem gilt:

- „Als neue Übung generieren“ fragt nicht mehr nach.
- Nach dem Zurücksetzen „für alle“ bestätigt die Übungsleitung mit Uhrzeit, was passiert ist.
- Einzelne Statuswechsel lassen sich überall per „Rückgängig“ zurückholen. Das gilt für Abhaken und Zurücknehmen beim Teilnehmer in Liste und Vordruck sowie für Zurücknehmen, Auslassen und Anmeldung in der Übungsleitung.
- Ein Doppeltipp auf „Als abgesetzt markieren“ blieb beim Teilnehmer folgenlos.

Neu und folgenschwer ist eine Nebenwirkung der Umsetzung. **„Bestehende Übung überschreiben“ im Generator setzt jetzt den gesamten Übungsstand für alle zurück, einschließlich der Notizen der Übungsleitung.** Der offene Leitungs-Arbeitsplatz wird dabei still geleert, ohne jeden Hinweis. Außerdem zeigt die Seite „Gespeicherte Übungen“ (Admin) die Übungen aller Nutzer mit je einem Löschen-Knopf. Nichts auf der Seite sagt, dass es nicht nur die eigenen sind. Dazu kommen zwei mittlere Punkte: Das Zeitfeld der X-Zeit-Basis feuert die „für ALLE“-Rückfrage schon beim ersten Tastendruck, und Profile lassen sich ohne Rückweg löschen.

Alle Aufgaben lassen sich ohne fremde Hilfe erledigen.

## Befunde

### P1-1: Überschreiben im Generator leert still den Arbeitsplatz der Übungsleitung, auch ihre Notizen

- **Fundstelle / Aufgabe:** Generator einer gespeicherten Übung, `#ueberschreibenBtn` („Bestehende Übung überschreiben …“). Gleichzeitig ist die Übungsleitung derselben Übung in einem zweiten Tab offen. Screenshots `30-leitung-vor-ueberschreiben.png`, `31-leitung-live-nach-ueberschreiben.png`, `23-generator-nach-ueberschreiben.png`. Code: `src/generator/controllerGenerieren.ts:99-117` (`setzeLiveStatusZurueck`), Rückfragetext `src/generator/controllerHilfen.ts:41-56`.
- **Beobachtung:** In der Übungsleitung waren 3 Nachrichten abgesetzt, und beim ersten Teilnehmer stand die Notiz „Buchstabieren ueben“. Im Generator wurde dann „Bestehende Übung überschreiben …“ bestätigt. Die Rückfrage erwähnt im dritten von vier Spiegelstrichen: „Der Übungsstand wird für alle zurückgesetzt: … sowie die Notizen der Übungsleitung … Wer ihn behalten will, sichert ihn vorher in der Übungsleitung mit ‚Übungsleitung als PDF‘.“ Danach zeigte die offene Übungsleitung ohne Neuladen 0 abgesetzte Nachrichten, und das Notizfeld war leer. Auch nach dem Neuladen gab es keinen Hinweis, keine Meldung und keine Uhrzeit. Die Suche im Seitentext nach „überschrieben“, „neu verteilt“, „alten Fassung“ und „zurückgesetzt“ blieb erfolglos. Der Hinweis „Diese Übung wurde am … neu verteilt“ (`lageMarkup.ts:65-70`) erscheint nicht mehr, weil nach dem Zurücksetzen kein alter Status übrig ist, an dem er sich festmachen könnte. Nur der Generator meldet: „Übung überschrieben, der Übungsstand ist für alle zurückgesetzt.“
- **Erwartung der Rolle:** Die Person am Leitungs-Laptop ist oft nicht dieselbe wie die am Generator. Sie erwartet, dass ihre eigene Mitschrift nicht von einem anderen Gerät aus gelöscht wird, ohne dass sie gefragt wird. Wenn doch, will sie es wenigstens sofort und dauerhaft sehen: was weg ist, wann und warum.
- **Auswirkung im Einsatz:** Die Notizen der Übungsleitung zu Teilnehmern und Sprüchen sind die Grundlage der Nachbesprechung. Sie sind weg, und eine Sicherung gibt es nur, wenn jemand vorher daran gedacht hat, das PDF zu ziehen. Wer mitten in der Übung überschreibt, etwa um einen Tippfehler im Namen zu korrigieren, setzt außerdem alle Teilnehmer-Abhakstände zurück. Die Leitung sieht plötzlich eine leere Übung und hält das eher für einen Sync-Fehler als für eine bewusste Handlung. Der vorherige Befund P2-1 (alte Status ohne Hinweis) ist damit ins Gegenteil gekippt, aus „falsche Daten“ wurde „Daten weg“.
- **Empfehlung:**
  - Notizen der Übungsleitung sind keine Status der alten Fassung. Sie sollten beim Überschreiben erhalten bleiben oder zumindest automatisch gesichert werden, etwa durch ein Debrief-PDF oder einen lokalen Schnappschuss am Leitungsgerät.
  - Die Übungsleitung zeigt einen festen Hinweis: „Diese Übung wurde am … um … im Generator überschrieben. Der Übungsstand wurde dabei für alle zurückgesetzt.“
  - Die Rückfrage im Generator nennt die Zahlen wie beim Reset in der Übungsleitung („Gelöscht werden 3 abgesetzte Nachrichten, 1 Notiz …“) und stellt das Zurücksetzen nach oben statt in den dritten Spiegelstrich.
  - Läuft die Übung erkennbar (Status oder Anmeldungen vorhanden), sollte das Überschreiben deutlicher abgesetzt sein, etwa durch Eintippen des Übungscodes.
- **Verifikation:** Die Leitung hat Notizen und abgesetzte Nachrichten, dann wird im Generator überschrieben. Danach sind die Notizen entweder noch da oder als Datei gesichert, und ein Zweitgerät der Leitung zeigt ohne Vorwissen einen Hinweis mit Uhrzeit auf das Überschreiben.

### P1-2: „Gespeicherte Übungen“ zeigt fremde Übungen mit Löschen-Knopf, ohne das zu sagen

- **Fundstelle / Aufgabe:** Route `#/admin`, Karte „Gespeicherte Übungen“, Knöpfe `button[data-action='delete']`. Screenshots `60-admin-liste.png`, `61-admin-loesch-hinweis.png`. Code: `src/index.html:262-268` (Überschrift), `src/services/FirebaseService.ts:102-113` (Abfrage über die ganze Collection `uebungen` ohne Filter), `firestore.rules:16-24, 47` („Restrisiko 1“, `allow delete: if true`).
- **Beobachtung:** Die Liste heißt „Gespeicherte Übungen“ und hat keinen erklärenden Text. Sie fragt die gesamte Sammlung ab. Im Produktivbetrieb sind das die Übungen aller Ortsverbände, die das Werkzeug nutzen. Jede Zeile hat „Öffnen“, „Überwachen“ und „Löschen“. Erreichbar ist die Seite auch für normale Nutzer: Die Fehlerseite der Übungsleitung verlinkt sie mit „Gespeicherte Übungen öffnen“ (`src/uebungsleitung/UebungsleitungView.ts:110`), und die Generator-Fehlermeldung verweist darauf (`controllerHilfen.ts:70`). Im Mock waren nur die eigenen Übungen zu sehen. Dass die Liste in Produktion fremde Übungen enthält, folgt aus Abfrage und Regeln, beobachtet wurde es nicht. Die Löschrückfrage ist gut: Sie nennt Name, Datum, Rufgruppe, Teilnehmerzahl und Übungscode und bietet 8 s „Rückgängig“.
- **Erwartung der Rolle:** Bei „Gespeicherte Übungen“ in einer App ohne Anmeldung erwartet man die eigenen Übungen, die man in diesem Browser angelegt hat. Der Generator zeigt dazu „Zuletzt in diesem Browser erstellt“. Dass hier fremde Übungen stehen und gelöscht werden können, erwartet niemand.
- **Auswirkung im Einsatz:** Ein Helfer sucht „seinen“ Dienstabend, findet zwei Einträge „Dienstabend“ mit gleichem Datum und löscht den falschen. Der Dienstabend eines anderen Ortsverbands ist dann weg, die Teilnehmer-Links dort funktionieren nicht mehr, und die betroffene Übungsleitung erfährt nicht, warum. Die 8 s Rückgängig helfen nur, wenn der Fehler sofort auffällt. Das technische Restrisiko ist in den Regeln bewusst akzeptiert. Die Bedienoberfläche macht es aber unnötig wahrscheinlich.
- **Empfehlung:**
  - Über der Liste klar sagen: „Hier stehen alle Übungen aller Nutzer dieser Website, nicht nur deine. Lösch nur Übungen, die du selbst angelegt hast.“
  - Übungen aus „Zuletzt in diesem Browser erstellt“ in der Liste kennzeichnen („von dir in diesem Browser angelegt“).
  - Fremde Übungen nur nach einer zusätzlichen Rückfrage löschen, etwa durch Eintippen des Übungscodes.
  - Den Link auf der Fehlerseite der Übungsleitung auf die eigene Liste lenken.
- **Verifikation:** Ein Erstnutzer öffnet `#/admin` und kann ohne Vorwissen sagen, ob die Liste nur seine oder alle Übungen enthält und welche davon seine sind.

### P2-1: Das Zeitfeld der X-Zeit-Basis fragt schon beim ersten Tastendruck „für ALLE ändern?“

- **Fundstelle / Aufgabe:** Übungsleitung einer X-Zeit-Übung, Cockpit, `#cockpitXZeitBasisInput` (`<input type="time">`), Ereignis `change` (`src/uebungsleitung/UebungsleitungView.ts:248-250`) → `CockpitSteuerung.aendereBasis` (`src/uebungsleitung/cockpitSteuerung.ts:166-181`). Screenshot `41-cockpit-nach-eingabe.png`.
- **Beobachtung:** Die Basis stand auf 06:30. Getippt wurde ins Stundenfeld, um 05:30 einzugeben (Chromium mit `--lang=de-DE`).
  1. Nach der ersten Ziffer „0“ kam sofort die Rückfrage „X-Zeit-Basis für ALLE ändern: 06:30 → keine Basis?“.
  2. Nach dem Abbrechen und der Ziffer „5“ kam die nächste: „06:30 → 05:30?“, obwohl die Minuten noch gar nicht eingegeben waren.
  3. In einem Lauf ohne Sprachschalter (12-Stunden-Anzeige) führte ein „OK“ beim ersten Dialog dazu, dass die Basis für alle entfernt wurde („X-Zeit-Basis 06:29 → – geändert“).

  Abbrechen setzt das Feld zurück, sodass man so nicht zu Ende tippen kann. Mit `fill()` oder dem Zeitwähler kommt dagegen genau eine saubere Rückfrage. Der Knopf „Neu starten (verschiebt alle Zeiten)“ und die Rückgängig-Leiste funktionieren wie erwartet.
- **Erwartung der Rolle:** Erst die Uhrzeit fertig eintippen, dann einmal gefragt werden, und zwar mit dem Wert, den man eingeben wollte.
- **Auswirkung im Einsatz:** Wer die Basis korrigieren will, etwa weil der Beginn verspätet war, wird zweimal mit Zwischenwerten gefragt. Er wird in genau dem Dialog zum reflexhaften „OK“ erzogen, der für alle die Soll-Zeiten verschiebt, und kann dabei versehentlich „keine Basis“ für alle bestätigen. Die Rückgängig-Leiste rettet das. Sie steht aber nur einige Sekunden, und wer mehrfach bestätigt hat, weiß nicht mehr, welcher Stand der richtige war.
- **Empfehlung:** Die Änderung über das Zeitfeld erst mit einem eigenen „Übernehmen“-Knopf auslösen, oder erst beim Verlassen des Feldes nachfragen. Ein leerer oder unvollständiger Zwischenwert darf nie eine Rückfrage auslösen. „Basis entfernen“ sollte ein eigener, bewusster Weg sein.
- **Verifikation:** Jemand tippt 05:45 Ziffer für Ziffer ins Feld. Er bekommt genau eine Rückfrage mit „06:30 → 05:45“, und keine Rückfrage nennt „keine Basis“.

### P2-2: Profile lassen sich ohne Rückweg löschen, und „Löschen“ steht direkt neben „Laden“

- **Fundstelle / Aufgabe:** Generator, aufklappbare Karte „Profile“, `#profilLoeschenBtn`. Screenshots `52-profile.png`, `53-profil-geloescht.png`. Code: `src/generator/controllerProfile.ts:129-140`.
- **Beobachtung:** Zwei Profile waren gespeichert, ausgewählt war das zuletzt gespeicherte. „Laden“, „Als Datei herunterladen“ und „Löschen“ stehen in einer Reihe, je 37 px hoch und 8 px auseinander. „Löschen“ ist nur rot umrandet. Die Rückfrage lautet nur „Profil ‚OV Leer Fortgeschritten‘ aus diesem Browser löschen?“. Danach war das Profil weg, mit Toast „… gelöscht.“, aber ohne Rückgängig. Die Rückfrage sagt nicht, dass es ohne heruntergeladene Datei keine Kopie gibt und was alles drinsteckt (Teilnehmerliste, Stellennamen, Lösungswörter).
- **Erwartung der Rolle:** Ein Profil ist die Vorlage für jeden Dienstabend des Ortsverbands. Man erwartet, dass ein Fehlklick wie beim Entfernen eines Teilnehmers oder beim Verwerfen eines Entwurfs zurückzuholen ist.
- **Auswirkung im Einsatz:** Das betrifft nur die Vorbereitung. Wer aber die Liste mit 15 Funkrufnamen und Stellennamen verliert, tippt sie neu, und dabei schleichen sich Tippfehler in Funkrufnamen ein, die dann auf allen Ausdrucken stehen.
- **Empfehlung:** Nach dem Löschen einige Sekunden „Profil gelöscht – Rückgängig“ anbieten, wie bei Entwurf und Teilnehmer. In der Rückfrage sagen, ob es eine Datei-Sicherung gibt („Es gibt keine andere Kopie, außer du hast es als Datei heruntergeladen“). „Löschen“ räumlich von „Laden“ absetzen.
- **Verifikation:** Nach einem versehentlichen Klick auf „Löschen“ und „OK“ ist das Profil mit einem Klick wieder da.

### P3-1: Rückfragen bleiben native „OK/Abbrechen“-Dialoge, und der Überschreiben-Knopf klebt am Hauptknopf

- **Fundstelle / Aufgabe:** Alle Bestätigungen laufen über `uiFeedback.confirm` → `globalThis.confirm` (`src/core/UiFeedback.ts:63-68`). Generator-Aktionsleiste: `03-actionbar.png`.
- **Beobachtung:** Die Texte sind konkret und nennen Reichweite und Mengen. Die Knöpfe heißen aber weiter „OK“, nicht nach der Folge. Eine Rückfrage schreibt die Bedeutung der Knöpfe sogar in den Text („OK: trotzdem … übernehmen. Abbrechen: nicht übernehmen“, `xZeitBasisWechsel.ts:44-53`). Das ist ein Zeichen, dass die Standardknöpfe nicht reichen. „Bestehende Übung überschreiben …“ steht weiterhin 8 px über „Als neue Übung generieren“ und ist ähnlich breit. Positiv: „Als neue Übung generieren“ fragt nicht mehr nach (im Lauf 0 Dialoge).
- **Erwartung der Rolle:** Ein Bestätigungsknopf, der die Folge nennt („Für alle zurücksetzen“, „Überschreiben“, „Löschen“).
- **Auswirkung im Einsatz:** Gering, weil der Text die Folge nennt. Zusammen mit P2-1 wird „OK“ aber zum Reflex.
- **Empfehlung:** Für Überschreiben, Löschen, die Resets und die X-Zeit-Basis eigene Dialoge mit handlungsbenanntem, nicht vorausgewähltem Bestätigungsknopf. Den Überschreiben-Knopf mit mehr Abstand oder hinter „Weitere Optionen“ setzen.
- **Verifikation:** Kein destruktiver Dialog hat mehr einen Knopf „OK“.

### P3-2: Kleinigkeiten an Rückgängig-Leisten und Rückgängig-Fristen

- **Fundstelle / Aufgabe:** Übungsleitung `#uebungsleitungUndo` (`21b-leitung-undo.png`, `43-auslassen.png`). Admin `#adminLoeschHinweis` (`62-admin-zweite-loeschung.png`, `src/admin/loeschPuffer.ts:37-43`).
- **Beobachtung:**
  - In der Übungsleitung schwebt die Leiste unten mittig (`position: fixed`) und verdeckt mitten in der Tabelle weiter Empfänger und Sender einer Zeile (Nr. 6). Der zusätzliche Abstand `ul-undo-offen` hilft nur am Seitenende.
  - Im Admin führt eine zweite Löschung innerhalb der 8 s die erste sofort aus. Der Toast „Übung ‚Dienstabend XZeit‘ gelöscht.“ erschien etwa 0,4 s nach deren Rückfrage, obwohl diese „8 Sekunden lang ‚Rückgängig‘“ versprochen hatte.
  - Nach dem Löschen bleibt die Zählung „Zeige 1 – 2 von 2“ stehen, obwohl nur noch eine Zeile sichtbar ist.
- **Erwartung der Rolle:** Die Leiste verdeckt nichts, was man gerade liest. Die versprochene Frist gilt.
- **Auswirkung im Einsatz:** Gering.
- **Empfehlung:** Die Leiste in der Übungsleitung so platzieren, dass sie keine Tabellenzeile verdeckt, etwa in einer festen Fußzeile mit Platzhalter. Im Admin mehrere Löschungen parallel puffern, oder die zweite Rückfrage sagen lassen, dass die erste damit endgültig wird.
- **Verifikation:** Während die Leiste steht, ist keine Tabellenzeile verdeckt. Zwei schnelle Löschungen lassen sich beide noch zurückholen.

### P3-3: Teilnehmer: nach dem Zurücksetzen „für alle“ keine Bestätigung, dazu ein unpassender Satz in der Rückfrage

- **Fundstelle / Aufgabe:** Teilnehmer mobil, `#teilnehmerGefahrBereich` → `#btn-reset-teilnehmer-data`. Screenshots `17-tn-gefahr-offen.png`, `18-tn-nach-reset.png`. Code: `src/teilnehmer/index.ts:330-358`.
- **Beobachtung:** Der Gefahrenbereich ist gut abgesetzt: aufklappbar, rot umrandet, mit dem Knopf „Abhak-Stand für alle zurücksetzen“ und einem erklärenden Text. Nach dem Bestätigen lädt die Seite neu und bleibt unten am zugeklappten Gefahrenbereich stehen. Es erscheint keine Meldung wie „Abhak-Stand zurückgesetzt“, anders als inzwischen in der Übungsleitung („Übungsstand für alle zurückgesetzt (um 06:27)“, `26-leitung-nach-reset.png`). In einer klassischen Übung enthält die Rückfrage außerdem den Satz „Eine eigene X-Zeit wird gelöscht.“, obwohl es dort keine X-Zeit gibt.
- **Erwartung der Rolle:** Nach einer großen, nicht umkehrbaren Aktion eine knappe Bestätigung, so wie bei der Leitung. Die Rückfrage nennt nur, was wirklich betroffen ist.
- **Auswirkung im Einsatz:** Gering. Es entsteht aber Unsicherheit („hat es geklappt?“), und ein irrelevanter Satz verdünnt eine wichtige Rückfrage.
- **Empfehlung:** Nach dem Reload einmalig „Abhak-Stand für alle zurückgesetzt (um …)“ oben anzeigen und nach oben scrollen. Den X-Zeit-Satz nur in X-Zeit-Übungen zeigen.
- **Verifikation:** Nach einem Reset ist oben eine Bestätigung mit Uhrzeit zu sehen. In einer klassischen Übung erwähnt die Rückfrage keine X-Zeit.

## Nicht prüfbar / Annahmen

- Echtes Firebase und mehrere Geräte wurden nicht geprüft (Mock-Modus). Für P1-1 lief die Übungsleitung in einem zweiten Tab desselben Browsers, und der Mock reichte den Reset dorthin durch. Die Wirkung auf ein echtes Zweitgerät ergibt sich aus Code (`setzeLiveStatusZurueck`) und Rückfragetext.
- P1-2: Dass die Admin-Liste in Produktion fremde Übungen zeigt, ergibt sich aus Abfrage (`FirebaseService.ts:102-113`) und Regeln. Im Mock gab es nur eigene Übungen.
- Annahme: Bei größeren Übungen arbeiten Generator-Bearbeiter und Übungsleitung an verschiedenen Geräten oder sind verschiedene Personen. Das macht P1-1 erst wahrscheinlich.
- Das verzögerte Löschen im Admin wird auch beim Schließen des Tabs (`pagehide`) ausgelöst. Ob ein Firestore-Löschauftrag dann noch ankommt, ließ sich im Mock nicht prüfen. Im schlimmsten Fall bleibt die Übung bestehen, was die harmlosere Richtung ist.

## Abschluss

- **Aufgabe geschafft:** ja (alle destruktiven Abläufe ließen sich auslösen, abbrechen und, wo vorgesehen, rückgängig machen)
- **Fremde Hilfe nötig:** nein
- **Größtes Missverständnis:** „Gespeicherte Übungen“ sieht aus wie die eigene Liste, enthält aber die Übungen aller Nutzer, jede mit „Löschen“.
- **Größtes Einsatzrisiko:** Ein Überschreiben im Generator löscht mitten in der Übung die Notizen und den gesamten Stand der Übungsleitung, und die Leitung bekommt davon keinen Hinweis.
- **Top-Priorität für die nächste Iteration:** Beim Überschreiben die Notizen der Übungsleitung erhalten oder automatisch sichern, und das Überschreiben in der Übungsleitung dauerhaft sichtbar machen.

## Abgleich mit dem Lauf vom 2026-10-05

| Alte ID | Titel | Alte Prio | Status jetzt | Beleg aus dieser Prüfung |
|---|---|---|---|---|
| P1-1 | „Jetzt starten“ verschiebt laufende X-Zeit-Übung ohne Rückfrage/Rückgängig | P1 | behoben | Nach dem ersten Start heißt der Knopf „Neu starten (verschiebt alle Zeiten)“. Eine Basisänderung fragt „X-Zeit-Basis für ALLE ändern: 06:28 → 05:30? … Überfällig jetzt: 0, danach: 21“. Danach steht die Leiste „X-Zeit-Basis 06:28 → 05:30 geändert – gilt für alle. Rückgängig“, und Rückgängig stellte 06:28 wieder her (`41-cockpit-nach-eingabe.png`). Neues Teilproblem beim Tippen ins Zeitfeld: siehe P2-1. |
| P2-1 | Nach dem Überschreiben bleiben in der Übungsleitung alte Status ohne Hinweis | P2 | teilweise | Alte Status bleiben nicht mehr stehen: Das Überschreiben setzt den Stand für alle zurück (Leitung danach 0 abgesetzt, `31-leitung-live-nach-ueberschreiben.png`). Die Leitung bekommt aber weiterhin keinen Hinweis, und ihre Notizen gehen mit verloren. Siehe neuer Befund P1-1. |
| P2-2 | „Entwurf verwerfen“ ohne Rückweg, einziger Knopf am Hinweis | P2 | behoben | Die Hinweisleiste hat jetzt „Entwurf verwerfen“ und „Hinweis ausblenden ✕“ (`50-entwurf-hinweis.png`). Nach dem Verwerfen: „Entwurf verworfen, das Formular ist leer. Rückgängig“. Rückgängig stellte Name und alle 6 Teilnehmer wieder her (`51-entwurf-verworfen.png`). |
| P3-1 | Native „OK/Abbrechen“-Dialoge, harmlose Rückfrage trainiert „OK“ | P3 | teilweise | „Als neue Übung generieren“ fragt nicht mehr nach (0 Dialoge beim Generieren). Alle destruktiven Rückfragen sind aber weiter native `confirm` mit „OK“, und der Überschreiben-Knopf steht weiter 8 px über dem Hauptknopf (`03-actionbar.png`). Siehe neuer P3-1. |
| P3-2 | Kleinigkeiten an den Rückgängig-Leisten (Verdeckung Leitung, stumme Sperrsekunde Teilnehmer) | P3 | teilweise | Teilnehmer: Die Leiste erscheint auf der anderen Bildschirmhälfte, im Vordruck als eigene Zeile über der Knopfleiste (`11-tn-nach-doppeltipp.png`, `15-tn-vordruck-abgesetzt.png`). „Rückgängig“ wirkte beim ersten Tipp. Übungsleitung: Die Leiste verdeckt mitten in der Tabelle weiter eine Zeile (`21b-leitung-undo.png`). |
| P3-3 | Nach dem Zurücksetzen „für alle“ keine Bestätigung (Übungsleitung) | P3 | behoben | Nach dem Reset steht oben „Übungsstand für alle zurückgesetzt (um 06:27).“, und die Seite steht ganz oben (scrollY 0, `26-leitung-nach-reset.png`). Beim Teilnehmer fehlt das Gegenstück, siehe neuer P3-3. |
