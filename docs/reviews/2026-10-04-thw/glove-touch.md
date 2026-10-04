# THW Glove-Touch-Review – Sprechfunk Übungsgenerator

Datum: 2026-10-04 · Perspektive: Helfer mit Arbeitshandschuhen bzw. eingeschränkter Feinmotorik, stehend, oft einhändig.
Prüfumgebung: lokaler Build (`http://127.0.0.1:3000`), Mock-Firestore, Playwright mit Chromium 141, Geräteprofile Pixel 7 (412×839, Hoch- und Querformat), iPhone 13 (390×664), iPad gen 7 (810×1080). Echte Taps über `touchscreen.tap`, Treffer geprüft mit `elementFromPoint`. Screenshots unter `scratchpad/glove-touch/` (Namen in den Befunden).

Einordnung: Die App ist ein Ausbildungswerkzeug für Dienstabend und Ausbildung, kein Einsatzsystem. „Im Einsatz“ heißt hier: während einer laufenden Funkübung, Handfunkgerät in der einen Hand, Smartphone in der anderen, ggf. mit Handschuhen im Freien oder im Fahrzeug. Annahme: Teilnehmer nutzen ihr eigenes Smartphone, die Übungsleitung eher Laptop oder Tablet.

Messverfahren: Ausgewertet wurden die Bounding-Boxen aller sichtbaren Bedienelemente. Als Richtwert gilt eine Kantenlänge von etwa 44 CSS-px. Mit Handschuhen reicht auch das oft nicht; ein realer Test mit Handschuhen auf echten Geräten steht noch aus.

## Urteil aus Sicht der Rolle

Die Kernaufgabe des Teilnehmers, einen Spruch als „übertragen“ zu markieren, lässt sich in der Tabellenansicht erledigen. Der Status-Chip liegt auf dem Smartphone aber halb abgeschnitten am rechten Rand, ist nur etwa 27 px hoch, und gleich daneben sitzt ein zweiter, noch kleinerer Schalter mit derselben Funktion. Ein versehentlicher Doppeltipp hebt die Markierung ohne jede Rückmeldung wieder auf.

In der Vordruck-Ansicht, die am ehesten für die Arbeit „ein Spruch nach dem anderen“ gedacht ist, gibt es auf Touch-Geräten **keinen** Weg, einen Spruch als übertragen zu markieren. Das geht nur über die Leertaste. Im getesteten Browser blieb der Vordruck außerdem leer.

Bei der Übungsleitung landet der zweite Tipp eines Doppeltipps auf „✓ abgesetzt“ genau auf dem Rücksetz-Knopf „↺“, und der setzt den Status ohne Rückfrage zurück.

Formulare und Generator funktionieren mit dem Finger. Sie bestehen aber durchgehend aus kleinen Zielen: 30 px hohe Felder, Radios mit 13 bis 16 px und „×“-Knöpfe mit 23×18 px. Für die Vorbereitung am Schreibtisch ist das hinnehmbar, nicht aber für die Bedienung während der Übung.

Ohne fremde Hilfe geht es mit Umwegen. Zuverlässig mit Handschuhen geht es nicht.

---

## Befunde

### P1-1 – Übungsleitung: Doppeltipp auf „✓ abgesetzt“ setzt den Status sofort wieder zurück

- **Fundstelle / Aufgabe:** `#/uebungsleitung/<id>`, Nachrichtenplan, Spalte Status, Knopf `button[data-action="abgesetzt"]`. Code: `src/uebungsleitung/UebungsleitungNachrichtenView.ts:356-374`. Screenshots `ipad-ul-before.png`, `ipad-ul-after1.png`, `ipad-ul-after2.png`.
- **Beobachtung:** Auf dem iPad-Profil wurde „✓ abgesetzt“ (94×30 px) angetippt. 150 ms danach liegt unter derselben Fingerposition der neue Knopf „↺ Status zurücksetzen“ (32×30 px, `data-action="reset"`). Ein zweiter Tipp an derselben Stelle setzt die Nachricht sofort zurück auf „offen“. Es erscheint kein Dialog und kein Hinweis, und die Zahl der Reset-Knöpfe fällt von 1 auf 0. Die beiden gegensätzlichen Aktionen nehmen nacheinander denselben Platz ein.
- **Erwartung der Rolle:** Ein Tipp bestätigt, ein versehentlicher zweiter Tipp richtet nichts an. Zurücknehmen ist eine bewusste, räumlich getrennte Handlung.
- **Auswirkung:** Mit Handschuhen oder auf einem wackelnden Tisch ist ein Doppeltipp häufig. Die Übungsleitung glaubt dann, die Nachricht sei bestätigt, sie steht aber wieder auf „offen“. Fortschritt, Funklast und Debrief stimmen dann nicht mehr, und dem Teilnehmer fehlt die Bestätigung.
- **Empfehlung:** Den Rücksetz-Knopf nicht an der Stelle einblenden, an der eben „abgesetzt“ stand. Er gehört deutlich abgesetzt ans Zeilenende oder hinter ein „Mehr“-Menü. Nach dem Bestätigen eine kurze Tippsperre (etwa 0,5 bis 1 s) für die Zeile einbauen. Das Zurücksetzen mit einer kurzen Rückgängig-Leiste („Zurückgesetzt – Rückgängig“) statt stumm ausführen.
- **Verifikation:** Doppeltipp mit 100 bis 300 ms Abstand auf „✓ abgesetzt“ führen; der Status muss danach „abgesetzt“ sein. E2E-Test mit zwei `touchscreen.tap` an derselben Koordinate.

### P1-2 – Teilnehmer, Vordruck-Ansicht: „Übertragen“ nur per Leertaste, kein Touch-Bedienelement

- **Fundstelle / Aufgabe:** `#/teilnehmer/...`, Knopf „Meldevordruck“ bzw. „Nachrichtenvordruck“, Modal `#teilnehmerDocModal`. Code: `src/teilnehmer/TeilnehmerView.ts:239-274` (Modal mit Legende) und `:681-686` (Space → `onDocToggleCurrent`, sonst keine Bindung). Screenshots `p7-tn-modal.png`, `p7-tn-modal-landscape.png`.
- **Beobachtung:** Das Modal bietet „Zurück“, „Weiter“, Schließen und den Schalter „Übertragene ausblenden“. Die zentrale Aktion „Übertragen“ steht nur in der Tastaturlegende („Space – Übertragen“), ebenso Ü, M, N und Esc. Ein Tipp auf den Vordruck löst nichts aus, und eine Wischgeste gibt es nicht. Auf Smartphone und Tablet ohne Tastatur ist die Aktion damit nicht erreichbar. Die Legende belegt im Hochformat zusätzlich rund 170 px Höhe.
- **Erwartung der Rolle:** Ich blättere Vordruck für Vordruck durch und tippe nach dem Funken auf einen großen Knopf „Übertragen“, ohne das Modal verlassen zu müssen.
- **Auswirkung:** Wer am Smartphone mit dem Vordruck arbeitet, muss für jeden Spruch das Modal schließen, in der Tabelle den richtigen Spruch suchen, den Chip treffen und den Vordruck wieder öffnen. Das kostet unter Funkverkehr Zeit, und Sprüche werden vergessen oder falsch markiert.
- **Empfehlung:** Im Modal einen großen, daumennahen Knopf „Übertragen / Offen“ ergänzen, am besten in einer festen Leiste unten zusammen mit „Zurück“ und „Weiter“. Die Tastaturlegende auf Touch-Geräten ausblenden oder einklappen.
- **Verifikation:** Auf einem Smartphone ohne Tastatur einen Spruch im Vordruck als übertragen markieren und weiterblättern. Ein E2E-Test mit `hasTouch` muss das ohne Tastaturereignis schaffen.
- **Nebenbeobachtung (keine Touch-Frage, aber blockierend):** Im getesteten Chromium 141 blieb der Vordruck auf Desktop und Mobil leer. Die Seitenzahl wurde nicht gesetzt, und es kam der Seitenfehler `getOrInsertComputed is not a function` aus `pdfjs-dist` ^6.3. Annahme: Diese Funktion fehlt älteren Browsern, also vermutlich auch auf vielen privaten Smartphones der Helfer. Muss auf realen Geräten mit üblichen Browserständen geprüft werden.

### P1-3 – Teilnehmer, Tabelle auf dem Smartphone: Statusaktion abgeschnitten am Rand, zwei Mini-Ziele für dieselbe Aktion

- **Fundstelle / Aufgabe:** `#/teilnehmer/...`, Tabelle `#teilnehmerTableView`, Zelle Status mit `.btn-toggle-uebertragen-chip` (78×27 px) und `.btn-toggle-uebertragen` (Schalter 34×17 px, 8 px daneben). Code: `TeilnehmerView.ts:223-236` und `:378-391`. Screenshots `pixel7-teilnehmer.png`, `pixel7-teilnehmer-full.png`, `p7-tn-table-scrolled.png`.
- **Beobachtung:** Auf dem Pixel 7 ist die Tabelle 616 px breit, der sichtbare Bereich 372 px. Der Chip steht als „OFFE…“ abgeschnitten am rechten Rand, Schalter und Spalte „Leitung“ (Bestätigung durch die Übungsleitung) liegen außerhalb. Erst ein Wischen nach links innerhalb der Tabelle macht sie sichtbar. Weil die Spalten Empfänger und Nachricht sehr schmal umbrechen, sind die Zeilen zwischen 100 und 300 px hoch, und die Statusaktion steht mitten in der Zeile auf wechselnder Höhe. Beim Antippen des Chips verschob sich die Tabelle horizontal (`pixel7-teilnehmer-after-tap.png`: Spalte „Nr.“ verschwindet links).
- **Erwartung der Rolle:** Pro Spruch eine große, immer gleich platzierte Fläche, die ich mit dem Daumen treffe, ohne seitlich wischen zu müssen. Ich sehe auf einen Blick, ob die Leitung bestätigt hat.
- **Auswirkung:** Das seitliche Wischen innerhalb einer vertikal scrollenden Seite ist mit Handschuhen fehleranfällig. Es wird schnell zum Tipp auf Chip oder Schalter oder zum Seitenscroll. Mit zwei kleinen, dicht nebeneinanderliegenden Zielen für dieselbe Aktion steigt das Risiko eines unbeabsichtigten Umschaltens. Die Bestätigung durch die Leitung bleibt unbemerkt.
- **Empfehlung:** Auf schmalen Bildschirmen eine Kartenansicht statt der Tabelle: Nr. und Empfänger oben, Text darunter, darunter eine breite Status-Schaltfläche über die volle Kartenbreite (mindestens etwa 48 px hoch) und der Bestätigungshinweis der Leitung in der Karte. Nur **ein** Bedienelement für „übertragen“.
- **Verifikation:** Im Pixel-7- und iPhone-SE-Profil muss die Statusaktion ohne horizontales Scrollen voll sichtbar sein. Bounding-Box mindestens 44×44 px, kein zweites Ziel im Abstand unter 8 px. Danach Praxistest mit Arbeitshandschuhen: 10 Sprüche nacheinander markieren und Fehltipps zählen.

### P2-1 – Teilnehmer: Doppeltipp auf den Status-Chip hebt die Markierung stumm wieder auf

- **Fundstelle / Aufgabe:** `.btn-toggle-uebertragen-chip`, Handler `TeilnehmerView.ts:734-746` (reines Umschalten).
- **Beobachtung:** Zwei Tipps im Abstand von 120 ms auf den Chip von Spruch 3: Danach steht er wieder auf „offen“. Es gibt keine Meldung und keine Rückgängig-Möglichkeit. Je nach Sync-Timing wurde die Übungsleitung zwischendurch kurz informiert (nicht im Detail geprüft). Im Modus „Übertragene ausblenden“ verschwindet die Zeile nach dem Tipp. Ein zweiter Tipp landete im Test auf einer Textzelle, aber bei passender Zeilenhöhe kann er auf dem Chip der nächsten Zeile landen (plausibles Risiko, nicht beobachtet).
- **Erwartung der Rolle:** Ein Tipp markiert. Zurücknehmen ist eine eigene, bewusste Handlung.
- **Auswirkung:** Ein Spruch gilt als offen, obwohl er gefunkt wurde. Der Teilnehmer funkt ihn erneut oder meldet ihn falsch.
- **Empfehlung:** Nach einer Statusänderung eine kurze Tippsperre für die Zeile. Die Rücknahme über eine getrennte, kleinere Aktion oder eine Rückgängig-Leiste anbieten. Im Ausblende-Modus die Liste erst nach Ende der Abgangsanimation nachrücken lassen und Tipps in dieser Zeit ignorieren.
- **Verifikation:** Doppeltipp mit 100 bis 300 ms Abstand; der Status muss „übertragen“ bleiben. Gleicher Test bei aktivem „Übertragene ausblenden“.

### P2-2 – Kopfbereich frisst den Bildschirm, Elemente laufen aus dem Bild (Teilnehmer, Hoch- und Querformat)

- **Fundstelle / Aufgabe:** Kopfzeile `header.app-header` (sticky, 86 px), darunter „Menü“ mit sieben Links, dann die Übungs-Kopfkarte. Screenshots `pixel7-teilnehmer.png`, `pixel7-teilnehmer-landscape.png`.
- **Beobachtung:** Im Hochformat beginnt die erste Nachricht erst bei etwa 770 px, also am unteren Bildrand des 839 px hohen Viewports. Hamburger-Menü **und** ausgeschriebene Linkliste sind gleichzeitig sichtbar. Die Kopfkarte ist zu breit (Inhalt 474 px bei 370 px Breite): „Lokale Daten löschen“ liegt bei x = 403–495 px, also fast vollständig außerhalb des 412 px breiten Viewports und praktisch nicht erreichbar. „ZIP herunterladen“ ragt über den Kartenrand. Im Querformat (839×412) füllen Kopfzeile, Navigation und Kopfkarte den ganzen ersten Bildschirm, und es ist kein einziger Spruch sichtbar.
- **Erwartung der Rolle:** Nach dem Öffnen des Links sehe ich sofort meinen nächsten Spruch. Alles, was ich sehe, kann ich auch antippen.
- **Auswirkung:** Bei jedem Wechsel zurück zur App muss gescrollt werden. Das sind mit Handschuhen zusätzliche Gesten, und jede Scrollgeste über der Tabelle kann einen Fehltipp auslösen. Der Rücksetzknopf ist im Hochformat nicht erreichbar, der ZIP-Download nur am Rand.
- **Empfehlung:** In der Teilnehmeransicht auf dem Smartphone die Navigation einklappen. Kopfzeile und Übungsdaten auf eine kompakte Zeile reduzieren (Funkrufname, Rufgruppe) und den Rest aufklappbar machen. Die Aktionen in der Kopfkarte umbrechen lassen, statt sie über den Rand zu schieben.
- **Verifikation:** Pixel 7 hoch und quer: Der erste offene Spruch samt Statusaktion muss ohne Scrollen sichtbar sein, und `document.body.scrollWidth` darf nicht größer als die Viewport-Breite sein.

### P2-3 – Vordruck-Modal: Kopf liegt unter der fixierten App-Kopfzeile, Schließen-Knopf klein

- **Fundstelle / Aufgabe:** `#teilnehmerDocModal`, `#btn-doc-close` (31×31 px). Screenshots `p7-tn-modal.png`, `p7-tn-modal-landscape.png`.
- **Beobachtung:** Im Hochformat liegt der Modal-Kopf teilweise hinter der sticky App-Kopfzeile: Titel „Vordruck“ und Schalter sind oben abgeschnitten. `elementFromPoint` am oberen Rand des Schließen-Knopfs liefert `app-header-grid` statt des Knopfs, und nur die untere Hälfte ist antippbar. Im Querformat überlagert die Tastaturlegende Seiteninhalte unterhalb des Modals.
- **Erwartung der Rolle:** Ein großer, frei liegender „Schließen“-Knopf und vollständig sichtbare Bedienelemente.
- **Auswirkung:** Fehltipps auf die App-Kopfzeile (dort sitzt das Menü) statt auf Schließen, und ein unklarer Zustand, weil das Modal nicht als Vollbild erkennbar ist.
- **Empfehlung:** Das Modal auf Smartphones als Vollbild über der App-Kopfzeile anzeigen. Schließen als beschrifteten Knopf mit mindestens 44 px, „Zurück“ und „Weiter“ unten in Daumenreichweite statt oben und unten verteilt.
- **Verifikation:** `elementFromPoint` an Mittelpunkt und Ecken des Schließen-Knopfs muss den Knopf liefern; Sichtprüfung hoch und quer.

### P2-4 – Übungsleitung auf Smartphone/Tablet: Layout springt nach jeder Bestätigung, kleine Ziele dicht an dicht

- **Fundstelle / Aufgabe:** `#/uebungsleitung/<id>`, Nachrichtenplan und Teilnehmertabelle. Screenshots `p7-ul-nachrichten.png` (vor dem Tipp), `p7-ul-nachrichten-after.png` (nach dem Tipp), `p7-ul-teilnehmer.png`, `ipad-ul.png`.
- **Beobachtung:** Nach einem Tipp auf „✓ abgesetzt“ wird die Tabelle neu aufgebaut. Ihre horizontale Scrollposition springt zurück nach links (die Statusspalte ist wieder außer Sicht), und die Kennzahl-Badges wachsen („Funklast: S Heros Oldenburg 21/11 (1) | E …“) und schieben die Tabelle um eine Zeile nach unten. Jede weitere Bestätigung braucht also erneutes Seitwärtswischen und Neuorientieren. Ziele: „Anmelden“ 83×30 px, Kopier-Knopf 26×30 px, Filter-Selects 71–73×30 px, Notizfelder 48×30 px, „Ausblenden“-Schalter 27×14 px mit 4 px Abstand zum Label. „Lokale Übungsdaten zurücksetzen“ steht als gleich großer Knopf direkt neben den PDF-Knöpfen (eine Bestätigungsabfrage ist vorhanden).
- **Erwartung der Rolle:** Nach dem Bestätigen bleibt alles an seinem Platz, der nächste Spruch liegt direkt darunter.
- **Auswirkung:** Unter Funkverkehr verliert die Übungsleitung die Position. Jedes Springen erhöht die Gefahr, die falsche Zeile zu bestätigen (Annahme: die Übungsleitung nutzt teils Tablets; am Desktop mit Maus ist das deutlich weniger kritisch).
- **Empfehlung:** Scrollposition und Layout beim Neuaufbau erhalten, Kennzahlen in fester Höhe oder einklappbar anzeigen. Auf Tablets die Statusaktion als erste oder feste Spalte, Ziele mindestens 44 px, und Rücksetz- bzw. Lösch-Aktionen räumlich von Download-Aktionen trennen.
- **Verifikation:** Fünf Sprüche nacheinander auf dem Tablet bestätigen. Die Statusaktion des nächsten Spruchs muss ohne Wischen erreichbar bleiben, und die Tabelle darf sich vertikal nicht verschieben.

### P3-1 – Generator auf dem Smartphone: durchgehend kleine Ziele

- **Fundstelle / Aufgabe:** Startseite/`#/generator`, Screenshots `gc-1.png`, `gc-2.png`, Messdaten `pixel7-generator.json`.
- **Beobachtung:** Die Quelle-Radios („Vorlagen verwenden“ usw.) sind 13×13 px mit rund 9 px Abstand untereinander, die Optionen-Checkboxen und -Radios 16×16 px. Die Labels sind antippbar, was hilft. Die „×“ zum Entfernen einer Vorlage misst 23×18 px bei elf Chips untereinander. Die Felder für Übungs- und Teilnehmercode sind 30 px hoch, „Teilnehmer-Zugang öffnen“ ebenfalls 30 px. Der Papierkorb pro Teilnehmer (37×30 px) steht direkt neben dem Namensfeld und löscht ohne Rückfrage. Zahlenfelder verlangen Tastatureingabe ohne +/-‑Stufen.
- **Erwartung der Rolle:** Vorbereitung erfolgt meist am Schreibtisch (Annahme). Wer aber am Smartphone kurz Teilnehmer ändert, will nicht versehentlich eine Vorlage oder Zeile entfernen.
- **Auswirkung:** Ein Fehltipp entfernt eine Vorlage oder einen Teilnehmer; das ist korrigierbar, kostet aber Zeit. Geringe Bedeutung für die laufende Übung.
- **Empfehlung:** Radios und Checkboxen als ganze, mindestens 44 px hohe Zeilen gestalten, die „×“ vergrößern, Code-Felder und Zugangsknopf in normaler Höhe, Papierkorb mit Rückgängig-Leiste.
- **Verifikation:** Messskript: kein interaktives Element unter 44 px Kantenlänge in Generator- und Teilnehmer-Zugangskarte.

### P3-2 – Verwaltung (Admin) auf dem Smartphone: Löschen im seitlich gescrollten Tabellenteil

- **Fundstelle / Aufgabe:** `#/admin`, Tabelle „Gespeicherte Übungen“, Screenshot `pixel7-admin.png`.
- **Beobachtung:** Die Aktionsknöpfe (37×30 px, nur Icons) liegen außerhalb des sichtbaren Bereichs in der seitlich scrollenden Tabelle, und „Vorherige“/„Nächste“ sind 30 px hoch. Löschen fragt nach („Möchtest du diese Übung wirklich löschen?“).
- **Auswirkung:** Gering; Verwaltung findet kaum unterwegs statt.
- **Empfehlung:** Auf schmalen Bildschirmen Karten statt Tabelle, Aktionen beschriftet.
- **Verifikation:** Sichtprüfung im Pixel-7-Profil.

## Nicht geprüft / offene Punkte

- Realer Test mit Arbeitshandschuhen auf echten Geräten (kapazitive Handschuhe und ohne), Nässe auf dem Display.
- Verhalten bei geöffneter Bildschirmtastatur (Suchfeld der Teilnehmeransicht, Code-Eingabe): im Emulator nicht realistisch abbildbar.
- X-Zeit-Modus mit Fokus-Modus der Teilnehmeransicht (`#toggle-fokus-modus`) wurde nicht im Mobilprofil durchgespielt.
- Vordruck-Rendering in aktuellen Mobilbrowsern (siehe Nebenbeobachtung P1-2).

## Abschluss

- **Aufgabe geschafft:** mit Umwegen. In der Tabelle lässt sich ein Spruch markieren, im Vordruck auf Touch-Geräten nicht.
- **Fremde Hilfe nötig:** nein. Der Teilnehmer muss aber selbst herausfinden, dass er seitlich wischen muss und die Vordruck-Ansicht dafür nicht taugt.
- **Größtes Missverständnis:** Die Legende „Space – Übertragen“ im Vordruck verspricht eine Funktion, die es am Smartphone nicht gibt.
- **Größtes Einsatzrisiko:** Ein versehentlicher Doppeltipp bei der Übungsleitung („✓ abgesetzt“ → „↺“) oder beim Teilnehmer (Chip) nimmt eine Bestätigung stumm zurück, und der Übungsstand ist dann falsch.
- **Top-Priorität für die nächste Iteration:** In Teilnehmer- und Übungsleitungsansicht eine einzige, große, ortsfeste Status-Schaltfläche je Spruch, die einen Doppeltipp verträgt, und dazu im Vordruck-Modal ein Touch-Knopf „Übertragen“.
