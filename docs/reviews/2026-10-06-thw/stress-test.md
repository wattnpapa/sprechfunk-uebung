Befunde: P0=0 P1=1 P2=2 P3=2
Abgleich: behoben=5 teilweise=1 offen=0 nicht-pruefbar=0

# THW-Review: Stress-Test-Nutzer (dritter Lauf)

Datum: 2026-10-06 · Perspektive: `thw-stress-test-user` · Build: lokal `http://127.0.0.1:3000`, Mock-Firestore (localStorage)

**Rolle:** ein erfahrener THW-Helfer, der nebenbei Funkgerät und Meldeblock bedient und von Kameraden angesprochen wird. Er hat 10 bis 20 Sekunden Aufmerksamkeit pro Schritt. Er tippt nach, wenn die Seite „zuckt“, scrollt hastig zur nächsten Karte und lädt die Seite neu, wenn er unsicher ist.

**Geprüfte Rollen:**
- Generator am Desktop (1366×900)
- Teilnehmer auf Pixel 7 (412×839 CSS-px, Touch)
- Übungsleitung am Desktop (1366×900) und bei 412 px
- Admin kurz

**Kontext:** Die App ist ein Ausbildungswerkzeug für Dienstabend und Ausbildung, kein Echteinsatz-System. Ein falscher Status verfälscht die Auswertung, er kostet keinen Auftrag. Die Prioritäten folgen daraus, wie in den Vorläufen.

**Vorgehen:** Alle Abläufe wurden mit Playwright real durchgeklickt. Geprüft wurden:
- Reload mitten in der Generator-Eingabe
- Doppelklick auf „Übung generieren“
- Doppeltipps mit 150, 400, 700, 1200, 1300, 2000, 3000 und 3200 ms Abstand, an 15 %, 50 % und 85 % der Knopfbreite
- Tipps auf den nächsten Spruch kurz nach dem vorigen, mit und ohne „Abgesetzte ausblenden“
- Doppeltipp im Vordruck-Fenster und Gerätezurück aus dem Fenster
- Einzel- und Sammelbestätigung in der Übungsleitung
- „Als neue Übung generieren“

Die Screenshots liegen im Scratchpad der Review-Sitzung unter `stress-test/`. Die Dateinamen stehen jeweils beim Beleg.

## Urteil aus Sicht der Rolle

**Was funktioniert:**
- **Doppeltipp-Sperren:**
  - Im Ausblenden-Modus setzt jeder Doppeltipp zwischen 150 ms und 3,2 s genau einen Spruch. Die abgesetzte Karte bleibt etwa 3 s stehen. Unter dem Finger liegt in dieser Zeit ihr funktionsloses Statusfeld „An die Übungsleitung gesendet“.
  - Ohne Ausblenden trifft ein träger zweiter Tipp nach 1,3 s oder 2 s ebenfalls nur noch dieses Statusfeld, an jeder Stelle der Knopfbreite. „Zurücknehmen“ ist klein und liegt darunter (`t02-normal-*.png`).
- **Vordruck-Fenster:**
  - Es öffnet beim ersten offenen Spruch („Seite 5 / 8“ bzw. „Seite 6 / 8“, `t05-vordruck.png`).
  - Nach einem Doppeltipp innerhalb von 0,9 s ist der Spruch einmal abgesetzt. An der Stelle des Knopfs steht dann das funktionslose Feld „✓ abgesetzt 06:28“, und „Weiter“ wird zum Hauptknopf (`t06-vordruck-dbl.png`).
  - Gerätezurück schließt nur das Fenster.
- **Generator:**
  - Nach einem Reload sind die Eingaben wieder da, mit dem Hinweis „Deine Eingaben … wurden wiederhergestellt“ (`g02-after-reload.png`).
  - Ein Doppelklick auf „Übung generieren“ legt genau eine Übung an. Die URL zeigt danach auf `#/generator/<id>`.
  - Fehlt die Vorlagenauswahl, springt die Seite zum Feld und zeigt eine rote Meldung (`g03a-after-dbl.png`).
- **Übungsleitung:**
  - Die Teilnehmertabelle lässt sich einklappen.
  - Bei 412 px gibt es eine Kartenansicht ohne abgeschnittene Knöpfe (`u05-mobile.png`).

**Wo es reibt:**
- **Rückgängig-Leiste:** Sie erscheint in der Bildschirmhälfte, in der man *nicht* getippt hat. Wer danach zur nächsten Karte weiterscrollt, findet den nächsten Absetzen-Knopf genau unter der Leiste. Ein Tipp darauf trifft „Rückgängig“ und macht den eben gefunkten Spruch **ohne jede Rückmeldung** wieder offen.
- **Sammelbestätigung der Leitung:** Sie bestätigt mit einem Klick alle gemeldeten Sprüche, ohne Rückfrage und ohne Rückgängig.

**Ohne fremde Hilfe machbar:** ja, für Teilnehmer, Übungsleitung und Generator.

---

## Befunde

### P1-1 Die Rückgängig-Leiste legt sich nach dem Weiterscrollen über den nächsten Absetzen-Knopf. Ein Tipp nimmt den vorigen Spruch still zurück.

- **Priorität:** P1. Der Status wird falsch, und es gibt keinerlei Rückmeldung. Nach Skill-Definition wäre das P0, im Ausbildungskontext gilt P1.
- **Fundstelle / Aufgabe:** Teilnehmer, Pixel 7, Liste ohne Ausblenden. Rückgängig-Leiste `#teilnehmerRueckgaengig` mit Knopf `#btn-teilnehmer-rueckgaengig`. Logik in `src/teilnehmer/rueckgaengigHinweis.ts:8–16` (Leiste in der Gegenhälfte) und `:28–31` (Rückgängig ohne Tippsperre, „wirkt sofort“).
- **Beobachtung (gemessen):**
  1. Spruch 1 wurde in der oberen Bildschirmhälfte abgesetzt (Tipp bei y≈177 von 839). Die Leiste erscheint unten: y 761–823, „Rückgängig“ bei x 269–387, y 770–814.
  2. Danach wurde normal weitergescrollt, bis Spruch 2 („ALS NÄCHSTES“) unten stand. Sein Knopf „Als abgesetzt markieren“ lag bei y 768–816, also vollständig unter der Leiste. Sichtbar sind nur noch „OFFEN · ALS NÄCHSTES“ über der Leiste (`t10-toast-over-next.png`).
  3. Ein Tipp auf die Stelle des Knopfs bei 80 % Breite traf `btn-teilnehmer-rueckgaengig`. Danach war Spruch 1 wieder „OFFEN“ und Spruch 2 weiter offen.
  4. Es erschien **kein** Hinweis „Spruch 1 wieder offen“ und kein Rückgängig für das Rückgängig. Die Leiste war einfach weg (`t11-after-tap.png`).
  5. Der Kopf meldete nur „1 wird gesendet“.
  6. Derselbe Effekt trat im ersten Durchlauf auch zufällig auf: Der Knopf von Nr. 4 lag nach `scrollIntoView` unter der Leiste, und der Tipp ging ins Leere (`t02-normal-0.85-3000.png`).
- **Erwartung der Rolle:** Wo ich „Als abgesetzt markieren“ tippe, wird abgesetzt. Ein Rückgängig passiert nie nebenbei, und wenn doch, sagt es mir die App laut.
- **Auswirkung (Übung):**
  - Ein Helfer arbeitet mehrere Sprüche zügig nacheinander ab, z. B. beim Nachtragen nach einer Funkpause oder wenn kurze Sprüche schnell hintereinander kommen. Dabei setzt er seinen gerade gefunkten Spruch unbemerkt wieder auf offen.
  - Danach steht dieser Spruch wieder als „ALS NÄCHSTES“ oben. Der Helfer funkt ihn möglicherweise doppelt, oder die Leitung sieht einen Rückstand, den es nicht gibt.
  - Die Leiste steht 8 s, das Zeitfenster ist also real.
  - Annahme: Im normalen Funktakt (ein Spruch dauert länger als 8 s) ist das seltener als beim schnellen Nachtragen.
- **Empfehlung:**
  - Die Leiste darf keinen Knopf „Als abgesetzt markieren“ überdecken. Möglich ist etwa eine feste Leiste außerhalb des Listenbereichs, die die Liste nach oben schiebt statt sie zu überlagern. Alternativ wird sie beim Scrollen ausgeblendet.
  - Ein Rückgängig muss immer selbst einen sichtbaren Hinweis mit Spruchnummer erzeugen, z. B. „Spruch 1 wieder offen – Rückgängig“, so wie es „Zurücknehmen“ tut.
  - Optional „Rückgängig“ kurz sperren, wenn kurz vorher gescrollt wurde.
- **Verifikation:** Playwright auf Pixel 7: Spruch in der oberen Hälfte absetzen, dann so scrollen, dass der nächste Absetzen-Knopf auf Höhe der Leiste liegt, und auf den Knopf tippen. Erwartet: Entweder wird der nächste Spruch abgesetzt, oder der Knopf ist sichtbar frei. Der vorige Spruch bleibt abgesetzt. Jede Rücknahme erzeugt einen sichtbaren Hinweis.

### P2-1 „N gemeldete bestätigen“: Ein Klick bestätigt alle gemeldeten Sprüche, ohne Rückfrage und ohne Rückgängig

- **Priorität:** P2
- **Fundstelle / Aufgabe:** `#/uebungsleitung/<id>`, Lage-Zeile, Knopf `[data-action='gemeldete-bestaetigen']` (`src/uebungsleitung/lageMarkup.ts:106`, Logik `src/uebungsleitung/aktionen.ts:316–341`).
- **Beobachtung:**
  - Der Knopf „11 gemeldete bestätigen (mit Meldezeit des Teilnehmers)“ steht direkt unter den „Als Nächstes“-Chips und über „Abgesetzte ausblenden“ (`u01-top.png`).
  - Ein Klick bestätigte 10 Sprüche auf einmal. Es kam die Erfolgsmeldung „10 gemeldete Nachrichten bestätigt …“, ohne Rückgängig. Die Meldung liegt mitten über der Plantabelle (`u06-sammel.png`).
  - Der Code schließt ein eventuell offenes Rückgängig der vorigen Einzelaktion sogar aktiv (`schliesseRueckgaengig()`).
  - Einzelbestätigungen haben dagegen ein Rückgängig.
  - Positiv: Die Zeiten werden als Tippzeit des Teilnehmers gekennzeichnet, und der Hilfetext darunter erklärt das.
- **Erwartung der Rolle:** Die Leitung bestätigt, was sie gehört hat. Ein Massenknopf neben den Alltagsknöpfen ist unter Druck die naheliegende „Aufräum“-Aktion, um die gelben „zu bestätigen“-Zahlen loszuwerden.
- **Auswirkung (Übung):**
  - Sprüche, die nie über Funk kamen, z. B. versehentlich abgehakte oder solche aus P1-1, werden mitbestätigt.
  - Die Auswertung zeigt sie dann als gefunkt.
  - Ein Fehlklick lässt sich nur durch einzelnes Zurücknehmen von 10 Zeilen korrigieren.
- **Empfehlung:**
  - Nach der Sammelbestätigung ein Rückgängig für den ganzen Schub anbieten (wie bei Einzelaktionen).
  - Oder vor dem Bestätigen die betroffenen Nummern zeigen („Nr. 2, 3, 5 … bestätigen?“).
  - Den Knopf optisch von den Navigations-Chips absetzen.
- **Verifikation:** Sammelbestätigung auslösen. Ein Rückgängig stellt alle betroffenen Zeilen wieder auf „gemeldet (TN)“, oder die Rückfrage nennt die Nummern.

### P2-2 Übungsleitung: Die Lage-Zeile scrollt weg, und der Plan beginnt auch eingeklappt erst an der Falz

- **Priorität:** P2
- **Fundstelle / Aufgabe:** `#/uebungsleitung/<id>`, 1366×900, 3 Teilnehmer × 8 Sprüche.
- **Beobachtung:**
  - Mit „Teilnehmer einklappen“ rückt der Plan hoch. Der erste Knopf „Als abgesetzt markieren“ liegt trotzdem bei y≈867 von 900, also nur angeschnitten (`u02-eingeklappt.png`).
  - Nach dem Scrollen auf 1500 px ist kein „Als Nächstes“-Chip mehr sichtbar. Die Lage-Zeile wird nicht mitgeführt (`u03-scrolled.png`).
  - Die Seite ist 4578 px hoch.
  - Die Chips springen weiterhin zuverlässig zur Zeile.
- **Erwartung der Rolle:** Beim Mithören immer sehen, was als Nächstes kommt, und den gehörten Spruch ohne Suchen abhaken.
- **Auswirkung:** Die Leitung pendelt zwischen Lage oben und Plan unten. Bei dichtem Funkverkehr bleiben dadurch Bestätigungen liegen. Das treibt wiederum zur Sammelbestätigung (P2-1).
- **Empfehlung:**
  - Die Lage-Zeile mit „Als Nächstes“ beim Scrollen oben mitführen, kompakt.
  - Oder die Kopfkarte (Übungs-ID, PDF-Knöpfe) während der laufenden Übung einklappen, damit mindestens die erste Planzeile vollständig sichtbar ist.
- **Verifikation:** Bei 1366×900 und eingeklappten Teilnehmern ist mindestens eine Planzeile vollständig sichtbar. Nach dem Scrollen auf 1500 px ist „Als Nächstes“ sichtbar.

### P3-1 Ausblenden-Modus: Die Liste ist nach dem Abgang einer Karte etwa 2 s gesperrt, und ein Tipp auf den nächsten Spruch bleibt ohne Erklärung wirkungslos

- **Priorität:** P3. Die Sperre ist absichtlich, sicher und sichtbar (Knöpfe ausgegraut). Sie kostet nur einen zweiten Tipp.
- **Fundstelle / Aufgabe:** Teilnehmer, Pixel 7, „Abgesetzte ausblenden“ an. `src/teilnehmer/listenAnsicht.ts:66–68`: Sperre `ABGANG_MS + KONTEXT_SPERRE_MS` nach dem Halten von `HALTEN_MS`.
- **Beobachtung:**
  - Erster Tipp auf Spruch n, dann ein Tipp auf den nächsten Spruch nach 4,1 s bzw. 4,8 s: Beide Male wurde **nichts** gesetzt, die Liste trug die Klasse `ist-gesperrt`.
  - Nach 6,2 s griff der Tipp.
  - Sichtbar sind ausgegraute Knöpfe „Als abgesetzt markieren“ ohne Text, warum (`t13-hide-next-after-3700.png`).
  - Im ersten Durchlauf gingen aus demselben Grund zwei Tipps (Erstes und Zweites) ins Leere (`t03-hide-400.png`: „neu abgesetzt=0“).
- **Erwartung der Rolle:** Wenn ich tippe und nichts passiert, will ich wissen, ob ich warten oder nochmal tippen soll.
- **Auswirkung:** Beim schnellen Nachtragen entstehen etwa 5 s Leerlauf pro Spruch. Der Helfer zweifelt, ob die App hängt.
- **Empfehlung:** Während der Sperre kurz „Liste rückt nach – gleich wieder bereit“ zeigen oder die Sperre verkürzen, sobald die Karte sichtbar weg ist. Wichtig: den Schutz aus dem letzten Lauf dabei nicht aufgeben.
- **Verifikation:** Ein Tipp während der Sperre erzeugt einen sichtbaren Grund. Mehrfachtipps bleiben weiterhin ohne Wirkung.

### P3-2 Jede offene Karte trägt denselben großen Absetzen-Knopf

- **Priorität:** P3
- **Fundstelle / Aufgabe:** Teilnehmerliste, Pixel 7 (`t01-mobile.png`).
- **Beobachtung:**
  - Nr. 1 („ALS NÄCHSTES“, blauer Rand) und Nr. 2 tragen identische, gleich große dunkelblaue Knöpfe „Als abgesetzt markieren“.
  - Der Unterschied liegt nur in der kleinen Marke und der Randfarbe.
- **Erwartung der Rolle:** Der eine Knopf, den ich jetzt brauche, sticht heraus.
- **Auswirkung:** Wer nur kurz hinsieht, hakt leicht den falschen Spruch ab, vor allem nach dem Scrollen, wenn der „Nächste“ nicht mehr im Bild ist. Rückgängig fängt das ab.
- **Empfehlung:** Nur der nächste offene Spruch bekommt den vollen Primärknopf, spätere einen zurückhaltenderen Knopf. Alternativ zeigt der Knopf die Nummer („Nr. 2 als abgesetzt markieren“).
- **Verifikation:** Sichtprüfung: Auf einem Bildschirm mit zwei offenen Karten ist der Knopf des nächsten Spruchs eindeutig hervorgehoben bzw. trägt die Nummer.

---

## Nicht prüfbar / Annahmen

- **Verlorene Zwischenstände im Mock:** Ein Skriptabbruch im ersten Teilnehmerdurchlauf hat die dort gesetzten Stände für 21/11 nicht in den Mock-Store zurückgeschrieben. Die Lage zeigt deshalb „21/11: 8 offen“. Das liegt an der Testumgebung (localStorage-Mock je Browser-Kontext) und ist kein Befund.
- **Echtes Netz:** Latenz und Offline-Verhalten wurden nicht geprüft. Das ist Thema der Perspektive „Offline-Resilienz“.
- **Einklapp-Zustand:** Ob „Teilnehmer einklappen“ einen Reload übersteht, wurde nicht geprüft.
- **Admin:** nur geöffnet. Liste mit „Öffnen / Überwachen / Löschen“ lädt ohne Fehler (`a01-admin.png`). Für die Stress-Perspektive nicht zentral.

## Abschluss

- **Aufgabe geschafft:** ja
- **Fremde Hilfe nötig:** nein
- **Größtes Missverständnis:** Der Helfer hält die schwarze Leiste unten für einen Teil der nächsten Karte und tippt auf ihren Knopf. Damit nimmt er den vorigen Spruch zurück, statt den nächsten abzusetzen.
- **Größtes Einsatzrisiko:** Ein still zurückgenommener Spruch (P1-1) und eine pauschale Sammelbestätigung (P2-1) verfälschen die Auswertung, ohne dass es jemand bemerkt.
- **Top-Priorität für die nächste Iteration:** Die Rückgängig-Leiste darf keinen Absetzen-Knopf überdecken, und jedes Rückgängig erzeugt selbst einen sichtbaren Hinweis. Abgesichert wird das durch einen Playwright-Test „scrollen, dann auf den nächsten Knopf tippen“.

---

## Abgleich mit dem Lauf vom 2026-10-05

| Alte ID | Titel (kurz) | Alte Prio | Status jetzt | Beleg aus diesem Lauf |
|---|---|---|---|---|
| P1-1 | Ausblenden: zweiter Tipp markiert den nächsten, nicht gefunkten Spruch | P1 | behoben | Doppeltipp nach 150/400/700/1200/2000/3200 ms setzt je genau einen Spruch. Unter dem Finger liegt das Statusfeld der gehaltenen Karte (`t03-hide-*.png`). Neue Nebenwirkung als P3-1. |
| P2-1 | Langsamer zweiter Tipp trifft „Zurücknehmen“ | P2 | behoben | Zweiter Tipp nach 1,3 s bzw. 2 s bei 15/50/85 % Breite trifft `teilnehmer-abgesetzt-feld`. Der Spruch bleibt abgesetzt (`t02-normal-*.png`). |
| P2-2 | Vordruck-Fenster öffnet bei Seite 1 | P2 | behoben | Es öffnet bei „Seite 5 / 8“ bzw. „6 / 8“, dem ersten offenen Spruch. Auf abgesetzten Seiten ist „Zurücknehmen“ klein und links (`t05-vordruck.png`, `t06-vordruck-dbl.png`). |
| P2-3 | Nachrichtenplan unter der Falz | P2 | teilweise | „Teilnehmer einklappen“ existiert. Der erste Planknopf liegt danach aber noch bei y≈867/900, und die Lage scrollt weg (`u02-eingeklappt.png`, `u03-scrolled.png`). Siehe neuer P2-2. |
| P3-1 | Übungsleitung bei 412 px: Tabellen abgeschnitten | P3 | behoben | Kartenansicht, scrollWidth 412, 0 Knöpfe außerhalb des Viewports (`u05-mobile.png`). |
| P3-2 | Hinweis „Neue Übung angelegt“ überdeckt die Linktabelle | P3 | behoben | Die Bestätigung steht jetzt als grüne Zeile in der Ergebnis-Karte über den Tabs und überdeckt nichts (`g05-confirm.png`). |
