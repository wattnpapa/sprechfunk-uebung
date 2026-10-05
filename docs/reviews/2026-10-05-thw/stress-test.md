Befunde: P0=0 P1=1 P2=3 P3=2
Abgleich: behoben=12 teilweise=0 offen=0 nicht-pruefbar=0

# THW-Review: Stress-Test-Nutzer (zweiter Lauf)

Datum: 2026-10-05 · Perspektive: `thw-stress-test-user` · Build: lokal `http://127.0.0.1:3000`, Mock-Firestore (localStorage)

Rolle: ein erfahrener THW-Helfer, nebenbei mit Funkgerät, Meldeblock und Kameraden beschäftigt. Er hat pro Schritt 10 bis 20 Sekunden Aufmerksamkeit, wird unterbrochen, tippt doppelt („die Seite hat nicht reagiert“) und drückt versehentlich „Zurück“.

Geprüfte Rollen:
- Generator am Desktop (1366×900).
- Teilnehmer auf Pixel 7 (412×915, Touch-Emulation).
- Übungsleitung während der Übung (1366×900 und 412 px).
- Admin nur kurz angesehen.

Kontext: Die App ist ein Ausbildungswerkzeug für den Dienstabend, kein Echteinsatz-System. Ein falscher Status verfälscht die Auswertung der Übung. Er kostet keinen Auftrag. Die Prioritäten sind daran gemessen, wie im ersten Lauf.

Vorgehen:
- Alle Abläufe wurden mit Playwright real durchgeklickt.
- Getestet wurden Doppeltipps mit 120 ms, 150 ms, 400 ms, 700 ms, 1200 ms und 1300 ms Abstand, Reload mitten in der Eingabe, `history.back()` aus dem Vordruck-Fenster und nach dem Generieren sowie „Neu generieren“.
- Screenshots liegen im Scratchpad der Review-Sitzung unter `stress-test/`, die Dateinamen stehen bei den Belegen.

## Urteil aus Sicht der Rolle

**Was funktioniert:**
Seit dem ersten Lauf hat sich viel geändert, und zwar spürbar.
- Auf dem Handy ist jeder Funkspruch eine Karte mit einem großen Knopf „✓ Als abgesetzt markieren“ über die volle Breite (48 px hoch, x 39–378 bei 412 px).
- Der nächste offene Spruch steht oben, mit Markierung „ALS NÄCHSTES“ (`t01-mobile.png`).
- Nach jedem Statuswechsel erscheint unten ein Hinweis mit „Rückgängig“.
- Ein schneller Doppeltipp (120–150 ms) setzt genau einen Spruch.
- Der Generator stellt nach einem Reload alle Eingaben wieder her und sagt das auch (`g02-after-reload.png`).
- Nach dem Generieren steht die Übungsadresse in der URL, ein Reload zeigt wieder die Links (`g04-reload.png`).
- Das Vordruck-Fenster hat einen eigenen Statusknopf, und „Zurück“ schließt nur das Fenster.
- Die Übungsleitung hat eine „Lage“-Zeile mit „Als Nächstes“ und Sprung in den Plan.
- „Gemeldet (TN)“ ist gestrichelt und klar von „✓ abgesetzt“ zu unterscheiden.
- Zurücknehmen liegt in einer anderen Spalte und hat ein Rückgängig.

**Wo es noch reibt:**
- Ist „Abgesetzte ausblenden“ eingeschaltet, verschwindet der eben abgesetzte Spruch nach etwa 0,35 s. Der nächste Spruch rutscht unter den Finger. Ein zweiter Tipp nach 0,7–1,2 s markiert einen Spruch, der nie gefunkt wurde.
- Ohne Ausblenden trifft ein langsamer zweiter Tipp (≈1,3 s) den neuen Knopf „Zurücknehmen“. Das lässt sich über den Hinweis korrigieren, man muss es aber merken.
- Das Vordruck-Fenster beginnt immer bei Seite 1 statt beim nächsten offenen Spruch.

**Ohne fremde Hilfe machbar?**
- Teilnehmer: ja.
- Übungsleitung: ja.
- Generator: ja.

---

## Befunde

### P1-1 „Abgesetzte ausblenden“: Der Spruch verschwindet sofort, und ein zweiter Tipp markiert den nächsten, nicht gefunkten Spruch

- **Priorität:** P1. Ein falscher Status wäre nach Skill-Definition P0. Im Ausbildungskontext wird nur die Auswertung verfälscht, deshalb P1, wie im ersten Lauf.
- **Fundstelle / Aufgabe:** Teilnehmer (Pixel 7), Liste mit eingeschaltetem Schalter „Abgesetzte ausblenden“ (`#toggle-hide-transmitted`), Knopf `[data-aktion='absetzen']`.
- **Beobachtung (gemessen):**
  - Erster Tipp auf „Als abgesetzt markieren“ beim obersten Spruch. Die Zahl der Zeilen fällt nach etwa 350 ms (Zeilenzählung alle 50 ms: `7,7,7,7,7,7,7,6`). An derselben Stelle liegt dann der Absetzen-Knopf des nächsten Spruchs (`elementFromPoint` → `data-id="5"`).
  - Zweiter Tipp an derselben Stelle:
    - nach 150 ms: harmlos, nur ein Spruch gesetzt;
    - nach 400 ms: harmlos;
    - **nach 700 ms: Nr. 3 und Nr. 4 abgesetzt;**
    - **nach 1200 ms: Nr. 5 und Nr. 6 abgesetzt.**
  - Gefunkt wurde jeweils nur der erste Spruch.
  - Der Rückgängig-Hinweis nennt danach nur den zuletzt gesetzten Spruch („Spruch 4 als abgesetzt markiert“). Der erste Spruch ist zu diesem Zeitpunkt schon ausgeblendet (`t12-hide-after-tap.png`, `t2700-hide.png`, `t21200-hide.png`).
  - Laut Quelltext ist gewollt, dass der eben abgesetzte Spruch „kurz stehen“ bleibt (`src/teilnehmer/nachrichtenMarkup.ts:117–127`). Die Markierung wird aber beim ersten Neuzeichnen verbraucht (`src/teilnehmer/controllerBasis.ts:76–79`). Ein zweites Neuzeichnen, vermutlich durch den Live-Sync, blendet die Zeile sofort aus. In der Liste gilt nur die Sperre je Nachricht und nicht die Kontextsperre (`src/teilnehmer/TeilnehmerView.ts:59–70`). Darum greift beim nachgerutschten Spruch keine Sperre.
- **Erwartung der Rolle:** Der Spruch, den ich gerade abgehakt habe, bleibt einen Moment stehen, und ein zweiter Tipp bewirkt nichts. Gerade wer „Abgesetzte ausblenden“ einschaltet, tut das, um im Stress schnell abzuhaken.
- **Auswirkung im Einsatz (Übung):**
  - Der Helfer hakt Nr. 3 ab, die Seite „zuckt“, er tippt sicherheitshalber noch einmal. Nr. 4 ist dann als abgesetzt gemeldet und aus seiner Liste verschwunden. Er funkt sie nie.
  - Bei der Übungsleitung steht Nr. 4 als „gemeldet (TN)“.
  - Mit „5 gemeldete bestätigen“ wird sie schnell mit bestätigt. Der Debrief zeigt dann einen Spruch als gefunkt, der nie über Funk ging.
- **Empfehlung:**
  - Die abgesetzte Karte wirklich einige Sekunden stehen lassen, sichtbar als „✓ abgesetzt“, mindestens so lange wie den Rückgängig-Hinweis.
  - Bei eingeschaltetem Ausblenden nach jedem Statuswechsel dieselbe Kontextsperre wie in Fokus-Karte und Vordruck anwenden.
  - Ausblenden erst, wenn der Finger weg ist bzw. die Sperre abgelaufen ist.
- **Verifikation:** Playwright mit Pixel 7 und eingeschaltetem Ausblenden: Tipp, dann zweiter Tipp an derselben Koordinate nach 400, 700, 1200 und 2000 ms. Es darf jeweils genau ein Spruch abgesetzt sein, und die erste Karte ist nach 1,2 s noch sichtbar.

### P2-1 Langsamer zweiter Tipp (≈1,3 s) trifft „Zurücknehmen“ und setzt den Spruch wieder auf offen

- **Priorität:** P2. Der Hinweis „Spruch 4 wieder offen. Rückgängig“ erscheint, der Fehler ist also sichtbar und mit einem Tipp korrigierbar.
- **Fundstelle / Aufgabe:** Teilnehmer (Pixel 7), Liste ohne Ausblenden, Knopf „✓ Als abgesetzt markieren“.
- **Beobachtung:**
  - Der Absetzen-Knopf geht über die volle Kartenbreite. Nach dem Tipp wird die Karte neu gezeichnet: Status-Chip links, „Zurücknehmen“ rechts in derselben Höhe, in der vorher der rechte Teil des Absetzen-Knopfs lag (`t03-undo.png`: Absetzen y≈1245–1357 px im Bild, Zurücknehmen y≈1166–1270 px, x≈632–900 px).
  - Ein Tipp bei 85 % Breite und erneut nach 120 ms: korrekt, nur abgesetzt.
  - Derselbe Tipp erneut nach 1300 ms: der Spruch ist wieder offen (Log „B undo text: Spruch 4 wieder offen“, `t11-slow-dbl.png`).
  - Die Sperre von 1 s (`STATUS_SPERRE_MS`, `src/teilnehmer/ansichtHelfer.ts:17`) deckt den „träge-Seite“-Fall nicht ab. Der Kommentar in `src/teilnehmer/nachrichtenMarkup.ts:90–95` („trifft also nie die Gegenaktion“) stimmt geometrisch nur für die linke Kartenhälfte.
- **Erwartung der Rolle:** Wo ich eben „abgesetzt“ gedrückt habe, liegt danach nichts, was das Gegenteil bewirkt.
- **Auswirkung:**
  - Wer den Hinweis unten übersieht (Blick schon beim Funkgerät), hat einen gefunkten Spruch wieder offen.
  - Er funkt ihn eventuell doppelt, oder die Leitung sieht einen falschen Rückstand.
- **Empfehlung:** „Zurücknehmen“ nicht in den Bereich des ehemaligen Absetzen-Knopfs legen, etwa ganz unten links in der Karte oder nur über den Hinweis bzw. eine Detailansicht. Alternativ die Sperre für die Gegenaktion auf etwa 2–3 s verlängern.
- **Verifikation:** Tipp auf den Absetzen-Knopf bei 15 %, 50 % und 85 % Breite, zweiter Tipp nach 1,5 s an derselben Stelle. Der Spruch bleibt abgesetzt.

### P2-2 Das Vordruck-Fenster öffnet immer bei Seite 1, nicht beim nächsten offenen Spruch

- **Priorität:** P2
- **Fundstelle / Aufgabe:** Teilnehmer (Pixel 7), Tab „Meldevordruck“ (`[data-doc-view='meldevordruck']`, Modal `#teilnehmerDocModal`).
- **Beobachtung:**
  - Nr. 1–4 waren abgesetzt. Das Fenster öffnete mit „Seite 1 / 8“, also mit dem bereits abgesetzten Spruch 1. Unten stand „✓ ABGESETZT“ und mittig der große Knopf „Zurücknehmen (wieder offen)“ (`t05-vordruck.png`, `t14-modal-start.png`).
  - Bis zum ersten offenen Spruch waren 4× „Weiter“ nötig (`t15-modal-open.png`).
  - Positiv: Ein Doppeltipp auf den Statusknopf im Fenster setzt nur einen Spruch. Der zweite Tipp auf das danach erscheinende „Zurücknehmen“ wird gesperrt (`t16-modal-after-dbl.png`).
  - Der Fensterkopf liegt jetzt über dem App-Kopf, „✕ Schließen“ ist voll sichtbar.
- **Erwartung der Rolle:** Vordruck öffnen heißt „zeig mir, was ich jetzt funken soll“.
- **Auswirkung:**
  - Nach jeder Unterbrechung muss man blättern und dabei an Sprüchen vorbei, die mittig groß „Zurücknehmen“ anbieten.
  - Ein reflexhafter Tipp in die Mitte nimmt einen gefunkten Spruch zurück.
- **Empfehlung:** Das Fenster beim als Nächstes markierten Spruch öffnen, also dem ersten offenen. Auf abgesetzten Seiten „Zurücknehmen“ kleiner und nicht in der Mitte der Knopfleiste anbieten.
- **Verifikation:** Bei 4 von 8 abgesetzten Sprüchen öffnet das Fenster auf Seite 5. Auf Seite 1 liegt mittig kein Zurücknehmen-Knopf in voller Größe.

### P2-3 Übungsleitung: Der Nachrichtenplan beginnt erst unter der Falz, das Abhaken braucht Scrollen oder den Umweg über „Lage“

- **Priorität:** P2
- **Fundstelle / Aufgabe:** `#/uebungsleitung/<id>` am Desktop 1366×900 (`u01-top.png`).
- **Beobachtung:**
  - Oben stehen Kopfkarte, „Lage“-Zeile, dann die Teilnehmertabelle mit Stärke-Eingaben und Notizfeldern je Teilnehmer.
  - Die Überschrift „Nachrichtenplan“ liegt bei etwa 870 px, die erste abhakbare Zeile außerhalb des ersten Bildschirms. Bei 3 Teilnehmern ist die Seite 4333 px hoch.
  - Die Chips „Als Nächstes: Nr. 2 …“ springen zuverlässig zur Zeile und rahmen sie ein (`u07-chip-jump.png`). Das ist ein guter Ausweg.
  - Danach muss man zum Überblick wieder hochscrollen.
- **Erwartung der Rolle:** Beim Mithören wird der gehörte Spruch ohne Suchen abgehakt. Die Teilnehmerverwaltung (Stärke, Notizen) braucht man selten.
- **Auswirkung:**
  - Bei schnellem Funkverkehr pendelt die Leitung zwischen „Lage“ oben und Plan unten.
  - Kommen zwei Sprüche kurz hintereinander, bleibt einer unbestätigt, oder er wird später mit „gemeldete bestätigen“ pauschal bestätigt.
- **Empfehlung:** Die Teilnehmertabelle während der laufenden Übung einklappbar machen bzw. kompakt halten. Alternativ die „Lage“-Zeile beim Scrollen mitführen, damit „Als Nächstes“ immer erreichbar ist.
- **Verifikation:** Bei 3×8 Sprüchen ist auf 1366×900 mindestens ein „Als abgesetzt markieren“ ohne Scrollen sichtbar, oder die Lage-Zeile bleibt beim Scrollen sichtbar.

### P3-1 Übungsleitung auf schmalem Bildschirm: Tabellen seitlich abgeschnitten

- **Priorität:** P3. Die Übungsleitung arbeitet laut Annahme am Laptop oder Tablet.
- **Fundstelle / Aufgabe:** `#/uebungsleitung/<id>` bei 412 px (`u05-mobile.png`).
- **Beobachtung:**
  - Die Seite selbst scrollt nicht seitlich (scrollWidth 412). Teilnehmer- und Plantabelle laufen aber im Container über den Rand: „Anmeldung erh…“, „angemeldet 052…“, „Anmeldung zurückneh…“, Spalte „EMP…“.
  - Rote Links („Anmeldung zurücknehmen“) sind halb abgeschnitten.
- **Erwartung der Rolle:** Wer kurz vom Handy aus nachsieht, sieht vollständige Knöpfe.
- **Auswirkung:** Wenig, solange die Leitung am größeren Gerät sitzt. Am Handy ist Fehlbedienung beim Wischen möglich.
- **Empfehlung:** Auf schmalen Bildschirmen eine Kartenansicht wie beim Teilnehmer, oder zumindest die Aktionsspalten zuerst.
- **Verifikation:** Bei 412 px liegt jeder Knopf vollständig im sichtbaren Bereich.

### P3-2 Generator: Der Hinweis „Neue Übung angelegt“ überdeckt die Linktabelle

- **Priorität:** P3
- **Fundstelle / Aufgabe:** Generator nach „Als neue Übung generieren“ (`g05-regen.png`).
- **Beobachtung:** Der Hinweis rechts unten liegt über dem Kopf der Spalte „Aktionen“ der Linktabelle. Die Rückfrage vorher ist klar und gut: Sie nennt, dass die bisherige Übung samt Links und Ausdrucken bestehen bleibt, und es gibt einen getrennten Knopf „Bestehende Übung überschreiben …“.
- **Erwartung der Rolle:** Die Bestätigung verdeckt nicht das, was man als Nächstes braucht, nämlich die neuen Links.
- **Auswirkung:** Gering. Man wartet, bis der Hinweis verschwindet.
- **Empfehlung:** Den Hinweis über der Ergebnis-Karte bzw. am oberen Rand zeigen.
- **Verifikation:** Sichtprüfung: Nach dem Neu-Generieren ist kein Linkknopf verdeckt.

---

## Nicht prüfbar / Annahmen

- Der Kurzlink `#/teilnehmer?uc=…&tc=…` leitet im Mock jetzt direkt auf die Teilnehmeransicht weiter (`t00-kurzlink.png`, URL danach `#/teilnehmer/<id>/<tc>`).
- Echtes Offline- und Latenzverhalten wurde nicht geprüft. Es ist Gegenstand der Perspektive „Offline-Resilienz“. Bei langsamerem Netz kann das Neuzeichnen in P1-1 später kommen und damit noch schlechter vorhersagbar sein (Annahme).
- Die Übungsleitung wurde im selben Browser-Kontext mit Pixel-7-Kennung geprüft, aber auf 1366×900 umgestellt. Der Mock-Store liegt im localStorage und ist nur so gemeinsam nutzbar.
- Admin wurde nur geöffnet. Für die Stress-Perspektive ist er nicht zentral, die Seite lud ohne Fehler (`a01-admin.png`).

## Abschluss

- **Aufgabe geschafft:** ja
- **Fremde Hilfe nötig:** nein
- **Größtes Missverständnis:** Mit „Abgesetzte ausblenden“ hält der Helfer das Zucken der Liste für „hat nicht reagiert“ und tippt nach. Dabei hakt er den nächsten, nie gefunkten Spruch ab.
- **Größtes Einsatzrisiko:** Sprüche gelten als abgesetzt und werden über „gemeldete bestätigen“ von der Leitung mitbestätigt, obwohl sie nie gefunkt wurden. Die Auswertung der Übung ist dann still falsch.
- **Top-Priorität für die nächste Iteration:** Im Ausblenden-Modus die eben abgesetzte Karte mehrere Sekunden stehen lassen und die Kontextsperre auch in der Liste anwenden, abgesichert durch einen Playwright-Test mit zweitem Tipp nach 700 und 1200 ms.

---

## Abgleich mit dem Lauf vom 2026-10-04

| Alte ID | Titel (kurz) | Alte Prio | Status jetzt | Beleg aus diesem Lauf |
|---|---|---|---|---|
| P1-1 | Doppeltipp hebt Status still wieder auf (Leitung und Teilnehmer) | P1 | behoben | Leitung: `dblclick` auf „Als abgesetzt markieren“ ergibt „abgesetzt“. „zurücknehmen“ liegt jetzt in der Spalte Zeit (x 1175–1267), es gibt einen Rückgängig-Hinweis (`u02-after-dbl.png`, `u06-reset.png`). Teilnehmer: Doppeltipp mit 120 ms setzt genau einen Spruch. Neue Restrisiken mit anderer Ursache: P1-1 und P2-1 oben. |
| P1-2 | Status-Chip auf dem Handy abgeschnitten | P1 | behoben | Kartenansicht, Knopf x 39–378 bei 412 px, keine Knöpfe außerhalb des Viewports (`t01-mobile.png`). |
| P1-3 | Vordruck-Modus ohne Markieren-Knopf, Kopf verdeckt | P1 | behoben | Mittiger Statusknopf (185×60 px), „✕ Schließen“ voll sichtbar, Modal z-index 5100 über dem App-Kopf, Vordruck rendert (`t05-vordruck.png`). Startseite: siehe neuer P2-2. |
| P1-4 | Reload im Generator verwirft Eingaben | P1 | behoben | Name, Leitung, 3 Teilnehmer und Spruchzahl nach Reload wieder da. Dazu der Hinweis „Deine Eingaben … wurden wiederhergestellt“ mit „Entwurf verwerfen“ (`g02-after-reload.png`). |
| P2-1 | „Zurück“ verlässt die App, Reload verliert das Ergebnis | P2 | behoben | Nach dem Generieren URL `#/generator/<id>` per replaceState, history.length bleibt 2. Reload zeigt die Linkliste (`g04-reload.png`). |
| P2-2 | Gerätezurück schließt das Vordruck-Fenster nicht | P2 | behoben | `goBack()` aus dem offenen Modal: Modal zu, URL bleibt `#/teilnehmer/<id>/<tc>`. |
| P2-3 | Erster Funkspruch unter der Falz, kein „als Nächstes“ | P2 | behoben | Erste Karte beginnt bei etwa 395 px von 915 px. Markierung „ALS NÄCHSTES“ und blauer Rand auch ohne X-Zeit (`t01-mobile.png`). Navigation auf „Menü“ eingeklappt. |
| P2-4 | „Lokale Daten löschen“ abgeschnitten, falscher aktiver Menüpunkt | P2 | behoben | In der Kopfkarte keine abgeschnittenen Knöpfe mehr. Das Zurücksetzen steckt in einem zugeklappten Bereich „Abhak-Stand komplett zurücksetzen“ (`src/teilnehmer/kopfMarkup.ts:136`). In der Übungsleitung ist „Übung erstellen“ nicht hervorgehoben (`u01-top.png`). |
| P2-5 | Nachrichtenplan ohne Fokus, gemeldet ≈ abgesetzt | P2 | behoben | „Lage“ mit „Als Nächstes“ und Sprung zur Zeile, „Abgesetzte ausblenden“ zusätzlich oben, Notizen erst auf „+ Notiz“. „GEMELDET (TN)“ gestrichelt neben „✓ ABGESETZT“ durchgezogen (`u02-after-dbl.png`). Rest (Plan unter der Falz) als neuer P2-3. |
| P3-1 | „Lokale Übungsdaten zurücksetzen“ neben PDF-Knöpfen | P3 | behoben | Nur noch „⟲ Übungsstand für alle zurücksetzen“ am Seitenende (y≈4071 von 4333 px). In der Kopfkarte stehen nur die PDF-Knöpfe. |
| P3-2 | „Neu generieren“ ersetzt Sprüche unter denselben Links | P3 | behoben | Zwei getrennte Knöpfe: „Bestehende Übung überschreiben …“ und „Als neue Übung generieren“. Die Rückfrage nennt: neue ID und Codes, die bisherige Übung bleibt mit Links und Ausdrucken bestehen (`g05-regen.png`). |
| (nicht prüfbar) | Kurzlink löst im Mock nicht auf | – | behoben | `#/teilnehmer?uc=…&tc=…` führt im Mock jetzt direkt zur Teilnehmeransicht (`t00-kurzlink.png`). |
