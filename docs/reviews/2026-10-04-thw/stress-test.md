# THW-Review: Stress-Test-Nutzer

Datum: 2026-10-04 · Perspektive: `thw-stress-test-user` · Build: lokal `http://127.0.0.1:3000`, Mock-Firestore (localStorage)

Rolle: ein erfahrener THW-Helfer, nebenbei mit Funkgerät, Meldeblock und Kameraden beschäftigt. Er hat pro Schritt 10 bis 20 Sekunden Aufmerksamkeit, wird unterbrochen, tippt doppelt und drückt versehentlich „Zurück“.
Geprüfte Rollen: Generator (Desktop 1366×900), Teilnehmer (Pixel 7, 412×915), Übungsleitung während der Übung (Desktop und 412 px).
Kontext: Das ist ein Ausbildungswerkzeug für den Dienstabend und kein Echteinsatz-System. Die Prioritäten unten sind daran gemessen. Ein falscher Status kostet hier die Auswertung der Übung, aber keinen Auftrag im Einsatz.

Screenshots liegen in `scratchpad/stress-test/` der Review-Sitzung, Dateinamen siehe die Belege. Die Abläufe wurden mit Playwright real durchgeklickt: Doppelklick, Reload, `history.back()` und Unterbrechung mitten in der Eingabe.

## Urteil aus Sicht der Rolle

**Was funktioniert:**
- Die Teilnehmeransicht ist im Kern einfach: eine Liste der eigenen Funksprüche, ein Chip „offen/übertragen“ pro Zeile.
- Der Status übersteht einen Reload.
- Er kommt bei der Übungsleitung als „gemeldet“ an.
- Notizen der Übungsleitung bleiben nach einem Reload erhalten, auch ohne Fokuswechsel.
- „Neu generieren“ und „Lokale Daten zurücksetzen“ fragen vorher nach.
- Über den Übungs-Link (`#/generator/<id>`) lässt sich eine erzeugte Übung wieder öffnen.

**Wo es reibt:**
- Ein schneller Doppeltipp auf den Status macht die eigene Eingabe still wieder rückgängig, und zwar bei Teilnehmer **und** Übungsleitung.
- Auf dem Handy ist die einzige Aktion pro Zeile, der Status-Chip, halb abgeschnitten. Der erste Funkspruch steht erst unter der Falz.
- Eine Unterbrechung beim Ausfüllen des Generators kostet alle Eingaben.
- Nach dem Generieren führt „Zurück“ aus der App heraus.
- Im Vordruck-Modus auf dem Handy gibt es keinen Knopf zum Markieren als übertragen, nur die Tastenkürzel.

**Ohne fremde Hilfe machbar?**
- Teilnehmer: ja, mit Umwegen (seitlich wischen, um den Status zu sehen).
- Übungsleitung: ja, aber ein nervöser Doppelklick verfälscht den Stand, ohne dass es auffällt.

---

## Befunde

### P1-1 Doppeltipp auf den Status hebt die eigene Eingabe still wieder auf (Übungsleitung und Teilnehmer)

- **Priorität:** P1. Nach Skill-Definition wäre ein falscher Status P0. Im Ausbildungskontext wird nur die Auswertung verfälscht, deshalb P1.
- **Fundstelle / Aufgabe:**
  - Übungsleitung, `#/uebungsleitung/<id>`, Nachrichtenplan, Knopf `button[data-action='abgesetzt']`.
  - Teilnehmer, `#/teilnehmer/<id>/<tc>`, Chip `.btn-toggle-uebertragen-chip`.
- **Beobachtung:**
  - Übungsleitung: Nach einem Klick auf „✓ abgesetzt“ wird die Zelle neu gezeichnet. An derselben Stelle liegt nun der rote Knopf „↺“ (`data-action="reset"`). Gemessen: „abgesetzt“ liegt bei x 1016–1110, y 575. „↺“ liegt danach bei x 1051–1083 in derselben Zeile, also mitten im alten Ziel.
  - Ein Doppelklick ergab reproduzierbar: abgesetzt, sofort zurückgesetzt, wieder „OFFEN“. Es kam keine Rückfrage und keine Meldung (Messwerte „after dbl: rs 0“, Screenshot `u02-after-abgesetzt.png`, erste Zeile „OFFEN“).
  - Quelle: `src/uebungsleitung/UebungsleitungNachrichtenView.ts:352–375`. Der Zurücksetzen-Knopf ersetzt den Abgesetzt-Knopf an gleicher Position. `resetNachricht` in `src/uebungsleitung/index.ts:749` fragt nicht nach.
  - Teilnehmer: Der Chip ist ein Umschalter. Ein Doppeltipp auf Nachricht 1 endete bei „offen“ (`t02-after-taps.png`). Für den Nutzer sieht es aus, als habe der Tipp nicht gegriffen.
- **Erwartung der Rolle:** Ein Tipp heißt „erledigt“. Ein zweiter Tipp im Eifer, oder weil die Seite träge wirkte, darf das nicht umdrehen.
- **Auswirkung im Einsatz (Übung):**
  - Die Übungsleitung hakt einen Spruch ab, den sie gerade gehört hat. Der Spruch bleibt offen, und sie merkt es nicht, weil der Blick schon wieder beim Funk ist.
  - Folgen: Fortschritt, ETA, Heatmap und Debrief stimmen nicht. Am Ende sucht man „fehlende“ Sprüche, die gefunkt wurden.
  - Beim Teilnehmer: Der Status bei der Leitung springt hin und her.
- **Empfehlung:**
  - „Rückgängig“ räumlich vom Bestätigen trennen, also nicht an dieselbe Stelle setzen, und für kurze Zeit gegen einen schnellen Folgeklick sperren.
  - Alternativ das Zurücksetzen nur über einen deutlich anderen Weg anbieten, etwa einen Rückgängig-Hinweis mit Zeitfenster.
  - Beim Teilnehmer-Chip den zweiten Tipp innerhalb kurzer Zeit ignorieren oder den Statuswechsel deutlicher quittieren.
- **Verifikation:** Playwright-`dblclick()` auf „✓ abgesetzt“ und auf den Teilnehmer-Chip. Danach muss der Status „abgesetzt“ bzw. „übertragen“ sein.

### P1-2 Auf dem Handy ist die einzige Aktion pro Zeile, der Status-Chip, abgeschnitten

- **Priorität:** P1
- **Fundstelle / Aufgabe:** Teilnehmer auf Pixel 7, Tabelle „Meine Funksprüche“, Spalte STATUS.
- **Beobachtung:**
  - Die Tabelle ist breiter als der Bildschirm. Der Chip „offen“ liegt bei x 364–442 bei 412 px Breite: nur etwa 48 von 78 px sind sichtbar, der Text lautet „OFFE“ (`t01-mobile.png`, `t01b-mobile-full.png`).
  - Nach dem Antippen rutscht die Tabelle seitlich weg. Danach ist die Spalte NR. nicht mehr zu sehen (`t02-after-taps.png`).
  - Die Seite selbst scrollt nicht seitlich (scrollWidth = 412), nur der Tabellencontainer. Für den Nutzer ist nicht erkennbar, dass dort mehr steht.
- **Erwartung der Rolle:** Funkspruch lesen, daneben ein großer Knopf „übertragen“. Kein seitliches Wischen.
- **Auswirkung:**
  - Mit einer Hand am Funkgerät wird der Chip verfehlt oder gar nicht gefunden. Der Helfer markiert nichts, und bei der Leitung erscheint der Spruch als offen.
  - Seitliches Wischen in einer Tabelle wird leicht mit Scrollen verwechselt.
- **Empfehlung:** Auf schmalen Bildschirmen eine Kartenansicht pro Funkspruch: Nr., Empfänger, Text und darunter ein Statusknopf über die volle Breite. Nicht die Desktop-Tabelle.
- **Verifikation:** Bei 360 und 412 px Breite liegt der Statusknopf jeder Zeile vollständig im Viewport, ohne Scrollen des Containers. Prüfung per `boundingBox().x + width <= viewport.width`.

### P1-3 Teilnehmer: Der Vordruck-Modus bietet auf dem Handy keinen Weg zum Markieren als übertragen

- **Priorität:** P1
- **Fundstelle / Aufgabe:** Teilnehmer auf Pixel 7, Tab „Meldevordruck“ (Modal `#teilnehmerDocModal`).
- **Beobachtung:**
  - Sichtbar sind die Knöpfe „Zurück“, „Weiter“ und ×. „Übertragen“ steht nur als Tastenkürzel „Space Übertragen“ in einer Legende (`t10-meldevordruck-wait.png`, Liste der Knöpfe: `["", "Zurück", "Weiter"]`).
  - Die Legende mit Esc, M, N usw. ist auf dem Handy nutzlos, belegt aber ein Drittel der Höhe.
  - Der Kopf des Modals („Vordruck“, Schalter, ×) liegt unter dem fixierten App-Kopf. Modal-Oberkante 58 px, Kopfunterkante 86 px. Text und Schließen-X sind halb verdeckt.
  - Die Vordruck-Fläche blieb im Test auch nach 6 s weiß. Ob das an der Headless-Umgebung liegt (PDF.js-Worker), ist **nicht geklärt**. Bitte auf einem echten Gerät nachprüfen.
- **Erwartung der Rolle:** Wer im Vordruck mitliest und funkt, will direkt darunter „Übertragen“ tippen und zum nächsten Spruch kommen.
- **Auswirkung:** Der Helfer muss das Modal schließen, in der Tabelle den abgeschnittenen Chip suchen (P1-2) und wieder öffnen. Unter Funkverkehr unterbleibt das Markieren.
- **Empfehlung:**
  - Im Modal einen großen Knopf „✓ Übertragen“ neben bzw. zwischen „Zurück“ und „Weiter“.
  - Die Tastenlegende nur bei Geräten mit Tastatur zeigen.
  - Den Modal-Kopf unterhalb des App-Kopfs bzw. über ihm anordnen.
- **Verifikation:** Auf dem Handy-Viewport im Modal per Tipp den Status setzen; das Schließen-X ist voll sichtbar und tippbar.

### P1-4 Ein Reload oder eine Unterbrechung im Generator verwirft alle Eingaben

- **Priorität:** P1 (die Übungsleitung bereitet oft nebenher vor und wird angesprochen)
- **Fundstelle / Aufgabe:** Generator `#/generator` bzw. `/`.
- **Beobachtung:**
  - Name, Leitung und ersten Teilnehmer eingetragen, dann Reload.
  - Danach steht wieder der Vorgabewert „Sprechfunkübung Kontrollzone 2026“ im Namen, der erste Teilnehmer ist wieder „Heros Oldenburg 16/11“ (Beispielliste mit 7 Einträgen).
  - Es gab keinen Hinweis und keine Wiederherstellung (Log „after reload name=…“).
- **Erwartung der Rolle:** Nach einem versehentlichen Wischen oder Neuladen, oder wenn das Tablet in den Ruhezustand geht, steht das Eingegebene noch da.
- **Auswirkung:**
  - Teilnehmerliste und Rufnamen müssen neu getippt werden. Unter Zeitdruck kurz vor dem Dienstabend entstehen dabei Tippfehler in Funkrufnamen.
  - Schlimmer noch: Weil plausible Beispielwerte drinstehen, merkt man eventuell nicht, dass die Eingaben weg sind, und generiert mit den Beispiel-Teilnehmern.
- **Empfehlung:**
  - Formularstand als Entwurf lokal halten und nach einem Reload wiederherstellen, mit sichtbarem Hinweis „Entwurf wiederhergestellt“.
  - Beispielwerte optisch als Beispiel kennzeichnen, etwa als Platzhalter statt als Wert.
- **Verifikation:** Felder füllen, Reload. Die Werte sind wieder da, und der Hinweis ist sichtbar.

### P2-1 Nach dem Generieren führt „Zurück“ aus der App heraus, und ein Reload verliert das Ergebnis

- **Priorität:** P2 (das Ergebnis lässt sich über den Übungs-Link wiederfinden, wenn man ihn hat)
- **Fundstelle / Aufgabe:** Generator, Ergebnis-Karte „Links“.
- **Beobachtung:**
  - Nach „Übung generieren“ bleibt die URL bei `/`, die History-Länge ist 2.
  - `history.back()` landete auf `about:blank`, also außerhalb der App (`g04-after-back.png`).
  - Ein Reload von `#/generator` zeigt das Ergebnis nicht mehr.
  - Über den Übungs-Link `#/generator/<id>` ist es wiederherstellbar (`g05-restore.png`). Das muss man aber wissen, und der Link stand vorher nur in der Tabelle.
- **Erwartung der Rolle:** Nach dem Generieren ist die Adresse die der Übung. Zurück und Reload führen wieder zu den Links.
- **Auswirkung:** Kurz vor Beginn, während die Teilnehmer auf ihre Links warten, ist die Linkliste weg. Wer den Übungs-Link nicht kopiert hat, findet die Übung nur über Admin.
- **Empfehlung:** Nach dem Generieren auf die Übungsadresse wechseln, damit Reload, Zurück und Lesezeichen funktionieren. Zusätzlich einen kurzen Hinweis „Diesen Link aufheben, um die Übung wiederzufinden“.
- **Verifikation:** Generieren, dann Reload und Zurück. Die Linkliste ist sichtbar.

### P2-2 Teilnehmer: Gerätezurück verlässt die Ansicht bzw. die App statt das Vordruck-Fenster zu schließen

- **Priorität:** P2
- **Fundstelle / Aufgabe:** Teilnehmer, Modal „Meldevordruck“, dann Android-„Zurück“.
- **Beobachtung:**
  - Erster Lauf: Zurück aus dem offenen Modal führte zur Codeeingabe „Teilnehmer-Zugang“ (`t06-doc-back.png`).
  - Zweiter Lauf: Zurück führte auf `about:blank`, das Modal ist weg (Log „after back url about:blank“).
  - Bei echten Nutzern ist die vorherige Seite typischerweise der Messenger, aus dem der Link kam.
- **Erwartung der Rolle:** „Zurück“ schließt das offene Fenster.
- **Auswirkung:** Der Helfer verliert die Ansicht mitten im Funkverkehr und muss den Link im Messenger erneut suchen. Wer den Teilnehmercode nicht notiert hat, hängt fest.
- **Empfehlung:** Das offene Vordruck-Fenster als eigenen Navigationsschritt behandeln, sodass „Zurück“ nur das Fenster schließt.
- **Verifikation:** Modal öffnen, `history.back()`. Das Modal ist zu, die Teilnehmeransicht bleibt.

### P2-3 Teilnehmer: Der erste Funkspruch steht erst unter der Falz, und es gibt keinen Hinweis „als Nächstes“

- **Priorität:** P2
- **Fundstelle / Aufgabe:** Teilnehmer, Pixel 7, Startzustand (`t01-mobile.png`).
- **Beobachtung:**
  - Oben stehen App-Kopf, die zweizeilige Hauptnavigation (mit „Übung erstellen“ hervorgehoben), Kopfkarte, Metadaten, Tabs, Schalter und Filter.
  - Der erste Funkspruch beginnt bei etwa 710 px von 915 px. Sichtbar ist nur eine Zeile.
  - Ohne X-Zeit gibt es keine Kennzeichnung, welcher Spruch der nächste offene ist. Der Fokus-Modus (`src/teilnehmer/TeilnehmerView.ts:490 ff.`) greift nur bei X-Zeit-Übungen.
- **Erwartung der Rolle:** Aufs Handy schauen und sofort den nächsten offenen Spruch sehen.
- **Auswirkung:**
  - Nach jeder Unterbrechung muss der Helfer scrollen und die Liste nach dem ersten „offen“ absuchen. Der Chip dafür ist zudem abgeschnitten (P1-2).
  - „Übertragene ausblenden“ hilft, ist aber standardmäßig aus und klein.
- **Empfehlung:**
  - In der Teilnehmeransicht die Seiten-Navigation einklappen oder entfernen und die Metadaten kompakt halten.
  - Den nächsten offenen Spruch oben hervorheben, auch ohne X-Zeit.
- **Verifikation:** Beim Laden auf 412×915 ist der nächste offene Funkspruch samt Statusknopf vollständig sichtbar.

### P2-4 Teilnehmer: „Lokale Daten löschen“ ist auf dem Handy unsichtbar abgeschnitten, und „Übung erstellen“ ist als aktiver Menüpunkt markiert

- **Priorität:** P2
- **Fundstelle / Aufgabe:** Teilnehmer-Kopfkarte (Pixel 7) und Hauptnavigation.
- **Beobachtung:**
  - Neben „ZIP herunterladen“ steht ein zweiter Knopf „Lokale Daten löschen“ bei x 403–494 bei 412 px Breite. Nur ein Rand ist zu sehen (`t01-mobile.png`, rechts oben in der Karte).
  - In der Navigation ist in allen Rollen „Übung erstellen“ als aktiv hervorgehoben (`t01-mobile.png`, `u01.png`).
- **Erwartung der Rolle:** Sichtbare Knöpfe sind vollständig sichtbar. Der hervorgehobene Menüpunkt zeigt, wo man ist.
- **Auswirkung:**
  - Ein abgeschnittenes Element wird beim Wischen eher zufällig getroffen. Eine Rückfrage ist vorhanden (`src/teilnehmer/index.ts:370–380`), das mildert es.
  - Der hervorgehobene „Übung erstellen“-Eintrag lädt einen gestressten Teilnehmer ein, dorthin zu tippen, weil „da bin ich doch“. Dann verlässt er seine Ansicht.
- **Empfehlung:**
  - Seltene, zerstörende Aktionen in der Teilnehmeransicht ans Ende der Seite verschieben, voll sichtbar und abgesetzt.
  - Den aktiven Navigationspunkt nur auf der Generatorseite setzen.
- **Verifikation:** Alle Knöpfe der Kopfkarte liegen bei 360 px vollständig im Viewport. In `#/teilnehmer` ist kein Menüpunkt aktiv markiert.

### P2-5 Übungsleitung: Der Nachrichtenplan ist eine lange Liste ohne Fokus auf das, was gerade dran ist

- **Priorität:** P2
- **Fundstelle / Aufgabe:** `#/uebungsleitung/<id>`, Karte „Nachrichtenplan“ (`u02-after-abgesetzt.png`, 3 Teilnehmer × 8 Sprüche = 24 Zeilen, Seite etwa 5300 px hoch).
- **Beobachtung:**
  - Die Zeilen sind nach Nr. sortiert. Offene, gemeldete und abgesetzte Zeilen stehen gemischt.
  - Zu jeder Zeile gibt es ein großes Notizfeld, das die Zeilen hoch macht.
  - „Ausblenden“ für abgesetzte ist ein kleiner Schalter im Spaltenkopf, standardmäßig aus.
  - Wenn ein Teilnehmer „gemeldet“ hat, ist der Chip grün, im gleichen Grün wie „abgesetzt“. Erst der Kleintext „Teilnehmer: …“ unterscheidet die beiden.
  - Nach einem Reload springt die Scrollposition grob zurück (2920 → 2863 px, also ungefähr gehalten). Das ist in Ordnung.
- **Erwartung der Rolle:** Wer Funk mithört, will den gehörten Spruch in Sekunden finden: nach Sender filtern, offene oben.
- **Auswirkung:** Suchen und Scrollen kosten Aufmerksamkeit, während schon der nächste Spruch kommt. Gemeldet und bestätigt sehen fast gleich aus, Bestätigungen werden deshalb vergessen.
- **Empfehlung:**
  - Abgesetzte standardmäßig ausblenden oder ans Ende sortieren.
  - Notizfelder erst auf Tipp aufklappen.
  - „gemeldet (unbestätigt)“ farblich klar von „abgesetzt“ trennen.
- **Verifikation:** Bei 3×8 Sprüchen sind alle offenen Sprüche eines Senders ohne Scrollen auf einem 900 px hohen Bildschirm sichtbar. Die Zustände sind auch in Graustufen unterscheidbar.

### P3-1 Übungsleitung: „Lokale Übungsdaten zurücksetzen“ steht gleichrangig neben den PDF-Knöpfen

- **Priorität:** P3 (es gibt eine Rückfrage mit klarer Folgenbeschreibung, siehe `src/uebungsleitung/index.ts:816–823`)
- **Fundstelle / Aufgabe:** Kopfkarte Übungsleitung (`u01.png`, `u04-mobile.png`).
- **Beobachtung:**
  - Der rote Knopf steht direkt neben „Alle Teilnehmer-Übersichten als PDF“, gleich groß.
  - Auf 412 px stehen die drei Knöpfe nebeneinander, der linke ist am Rand abgeschnitten.
  - Die Rückfrage nennt korrekt, dass es auch für Teilnehmer wirkt.
- **Erwartung der Rolle:** Zerstörende Aktionen stehen abseits.
- **Auswirkung:** Ein vorschnelles „OK“ auf die Browser-Rückfrage löscht den Stand der laufenden Übung für alle.
- **Empfehlung:** Den Knopf räumlich absetzen, etwa in einen „Weitere Aktionen“-Bereich am Seitenende.
- **Verifikation:** Sichtprüfung: Der Knopf liegt nicht in der Reihe häufiger Aktionen.

### P3-2 Generator: „Neu generieren“ ersetzt die Sprüche unter denselben Links

- **Priorität:** P3 (Rückfrage vorhanden: „Übung neu generieren? Bestehende Nachrichten gehen verloren.“)
- **Fundstelle / Aufgabe:** Generator, zweiter Klick auf „Übung generieren“ nach dem Ergebnis.
- **Beobachtung:**
  - Der zweite Lauf behält dieselbe Übungs-ID. Die Teilnehmerlinks bleiben gleich, die Inhalte ändern sich (Log: first = second).
  - Teilnehmer, die schon geöffnet haben, sehen dann andere Sprüche bzw. haben ausgedruckte Vordrucke, die nicht mehr passen.
  - Ein Doppelklick beim ersten Generieren erzeugte nur eine Übung, das ist gut.
- **Erwartung der Rolle:** Die Rückfrage sagt, dass bereits verteilte Links und Ausdrucke danach nicht mehr stimmen.
- **Auswirkung:** Teilnehmer funken andere Sprüche, als die Leitung im Plan hat. Das fällt erst spät auf.
- **Empfehlung:** In der Rückfrage ausdrücklich nennen, dass verteilte Links und Ausdrucke ungültig werden.
- **Verifikation:** Der Rückfragetext enthält diesen Hinweis.

---

## Nicht prüfbar / Annahmen

- Der Kurzlink `#/teilnehmer?uc=…&tc=…` zeigte im Mock die vorausgefüllte Codeeingabe mit „Zugang öffnen“ (`t00-kurzlink.png`). Laut Skriptkommentar löst er im Mock nicht auf, das Verhalten mit echtem Firestore wurde nicht geprüft.
- Die weiße Vordruckfläche im Modal (P1-3) kann an der Headless-Umgebung liegen.
- Echtes Offline-Verhalten und Verzögerungen der Synchronisation wurden hier nicht geprüft (eigene Perspektive „Offline-Resilienz“).

## Abschluss

- **Aufgabe geschafft:** mit Umwegen
- **Fremde Hilfe nötig:** nein (bei verlorener Linkliste nach Reload ggf. ja)
- **Größtes Missverständnis:** Ein Doppeltipp auf „abgesetzt“ bzw. „übertragen“ sieht nach „hat nicht reagiert“ aus, hat den Status aber in Wahrheit gesetzt und gleich wieder entfernt.
- **Größtes Einsatzrisiko:** Der Status in der Übungsleitung ist still falsch, durch das Zurücksetzen-Ziel genau unter dem Bestätigungsknopf, und Fortschritt und Debrief stimmen dann nicht.
- **Top-Priorität für die nächste Iteration:** Den Zurücksetzen-Knopf „↺“ räumlich und zeitlich vom Knopf „✓ abgesetzt“ entkoppeln, beim Teilnehmer-Chip dasselbe Prinzip anwenden, und dafür einen Playwright-Doppelklick-Test ergänzen.
