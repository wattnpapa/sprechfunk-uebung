Befunde: P0=0 P1=1 P2=4 P3=4
Abgleich: behoben=4 teilweise=5 offen=0 nicht-pruefbar=0

# THW Glove-Touch-Review (zweiter Lauf) – Sprechfunk Übungsgenerator

Datum: 2026-10-05 · Perspektive: Helfer mit Arbeitshandschuhen bzw. eingeschränkter Feinmotorik, stehend, oft einhändig (Handfunkgerät in der anderen Hand).
Prüfumgebung: lokaler Build `http://127.0.0.1:3000`, Mock-Firestore, Playwright mit Chromium 1194 (`/opt/pw-browsers/chromium-1194`). Geräteprofile: Pixel 7 (412×839, hoch und quer), iPhone SE (320×568), iPad gen 7 (810×1080) und Desktop 1440×1000 zum Erzeugen der Übungen. Getippt wurde mit `touchscreen.tap` bzw. `locator.tap`, Treffer wurden mit `elementFromPoint` geprüft. Messung: Bounding-Boxen aller sichtbaren Bedienelemente, Richtwert etwa 44 CSS-px Kantenlänge. Screenshots liegen unter `scratchpad/glove-touch/`, die Dateinamen stehen in den Befunden.

Einordnung: Die App ist ein Ausbildungswerkzeug für Dienstabend und Ausbildung, kein Einsatzsystem. „Im Einsatz“ meint hier die laufende Funkübung. Annahme: Teilnehmer nutzen ihr eigenes Smartphone, die Übungsleitung Laptop oder Tablet.

## Urteil aus Sicht der Rolle

Die Teilnehmeransicht ist auf dem Smartphone jetzt robust bedienbar. Jeder Spruch ist eine Karte über die volle Breite mit einem einzigen großen Knopf „✓ Als abgesetzt markieren“ (über 44 px hoch, volle Kartenbreite). Ein Doppeltipp nimmt nichts mehr zurück. Zurücknehmen ist ein eigener, versetzter Knopf, und nach dem Markieren erscheint eine Rückgängig-Leiste. Im Vordruck gibt es jetzt eine daumennahe Leiste mit „Zurück“, „Als abgesetzt markieren“ und „Weiter“, im Hochformat als Vollbild, mit großem „Schließen“.

Die neue Rückgängig-Leiste hat aber eine neue Falle geschaffen. Im Vordruck legt sie sich 8 Sekunden lang genau über die Aktionsleiste. Wer nach dem Markieren sofort auf „Weiter“ tippt, das ist der natürliche Ablauf, trifft „Rückgängig“. Der Spruch steht dann wieder auf „offen“, und weitergeblättert wurde auch nicht. Dazu kommen kleinere Reibungen: Im Querformat schrumpft der Vordruck auf Briefmarkengröße. Auf kleinen Geräten liegt bei X-Zeit der große Fokus-Knopf unterhalb der ersten Bildschirmseite. Die Übungsleitung auf dem Tablet hat weiterhin viele 30-px-Ziele und eine abgeschnittene Spalte.

Ohne fremde Hilfe ist die Aufgabe zu schaffen. In der Vordruck-Ansicht geht es mit Handschuhen nur mit Umweg: nach jedem Markieren abwarten oder die Liste benutzen.

---

## Befunde

### P1-1 – Rückgängig-Leiste liegt über der Aktionsleiste: „Weiter“ wird zu „Rückgängig“

- **Fundstelle / Aufgabe:** `#/teilnehmer/<id>/<code>` → „Meldevordruck“ bzw. „Nachrichtenvordruck“ → „✓ Als abgesetzt markieren“ → „Weiter“. Elemente `#teilnehmerRueckgaengig` (z-index 5200, `src/teilnehmer/kopfMarkup.ts`, Funktion `unterlagenUndGefahrHtml`) und `#btn-doc-next`/`#btn-doc-absetzen`/`#btn-doc-prev` (`vordruckModalFussHtml`). Screenshot `v-modal-tap1.png`.
- **Beobachtung:** Nach dem Tipp auf „Als abgesetzt markieren“ im Vordruck (Pixel 7, hoch) erscheint unten die schwarze Leiste „Spruch 1 als abgesetzt markiert. Rückgängig“ (y = 761 bis 823 bei 839 px Viewport) und verdeckt die gesamte Aktionsleiste. `elementFromPoint` in der Mitte von „Weiter“ liefert `#btn-teilnehmer-rueckgaengig`, in der Mitte von „Zurück“ und vom Hauptknopf liefert es den Text der Leiste. Real ausgeführt: markieren, nach 1,2 s an der Position von „Weiter“ getippt. Ergebnis: weiterhin „Seite 1 / 8“, Status wieder „OFFEN“. Die Leiste bleibt laut Code-Kommentar rund 8 s stehen. In der Listenansicht liegt dieselbe Leiste ebenfalls über dem unteren Bildschirmrand. Dort sitzt häufig der Knopf der nächsten Karte (`p7-tn-after-tap.png`). Dass dort ein Tipp auf „Rückgängig“ landet, ist plausibel, wurde aber nicht gezielt nachgestellt.
- **Erwartung der Rolle:** Markieren, dann sofort „Weiter“ zum nächsten Vordruck. Der Knopf, auf den mein Daumen zielt, bleibt derselbe Knopf.
- **Auswirkung im Einsatz:** Der häufigste Ablauf im Vordruck (Spruch funken, abhaken, weiter) macht die Markierung stumm rückgängig. Die Leiste meldet das zwar als „rückgängig gemacht“, aber mit Handschuhen und dem Blick auf das Funkgerät fällt das kaum auf. Der Teilnehmer glaubt, der Spruch sei abgehakt, und die Übungsleitung sieht ihn als offen. Alternativ wartet der Helfer bei jedem Spruch 8 s, bis die Leiste weg ist.
- **Empfehlung:** Die Rückgängig-Leiste darf im Vordruck die Aktionsleiste nicht überdecken. Sie gehört über die Leiste, also zwischen Vordruck und Knöpfe, oder in die Aktionsleiste selbst, etwa als Statuszeile „abgesetzt – Rückgängig“ an der Stelle des Status-Chips. In der Liste nicht über den Bereich legen, in dem der nächste Hauptknopf liegt, oder den Inhalt um ihre Höhe nach oben freistellen. Optional nach dem Markieren automatisch zum nächsten offenen Vordruck springen, dann entfällt der zweite Tipp ganz.
- **Verifikation:** Im Pixel-7- und iPhone-SE-Profil im Vordruck markieren und 0,5 s, 1 s und 3 s danach auf „Weiter“ tippen. Erwartet wird Seite 2, und Spruch 1 bleibt „abgesetzt“. `elementFromPoint` auf die Mittelpunkte der drei Aktionsknöpfe muss während der sichtbaren Leiste die Knöpfe selbst liefern.

### P2-1 – Vordruck: Hauptknopf wechselt an derselben Stelle zwischen „abgesetzt“ und „Zurücknehmen“

- **Fundstelle / Aufgabe:** Vordruck-Modal, `#btn-doc-absetzen` (`src/teilnehmer/vordruckVorschau.ts:202-208`). Screenshots `p7-modal.png`, `v-modal-tap2.png`.
- **Beobachtung:** Ist der angezeigte Spruch schon abgesetzt, steht an derselben Stelle und in derselben Größe wie sonst „✓ Als abgesetzt markieren“ der Knopf „Zurücknehmen (wieder offen)“. Ein Doppeltipp innerhalb der Tippsperre wird abgefangen. Ein einzelner späterer Tipp nimmt dagegen sofort zurück, etwa wenn der Teilnehmer mit „Zurück“ auf einen schon erledigten Vordruck blättert und aus Gewohnheit auf die Mitte tippt (im Test reproduziert: `m1` „ABGESETZT“ → Tipp → „OFFEN“). In der Liste sind die beiden Aktionen bewusst getrennt: großer grüner Knopf gegen kleinen „Zurücknehmen“-Knopf rechts. Im Vordruck gilt dieses Prinzip nicht.
- **Erwartung der Rolle:** Die große Fläche in der Mitte bedeutet immer „erledigt“. Zurücknehmen ist klein und liegt woanders, wie in der Liste.
- **Auswirkung im Einsatz:** Beim Zurückblättern wird ein bereits gefunkter Spruch versehentlich wieder geöffnet. Die Rückgängig-Leiste fängt das zwar ab, verdeckt dabei aber wieder die Aktionsleiste (siehe P1-1).
- **Empfehlung:** Bei abgesetztem Spruch die Mitte als deaktivierte Statusanzeige („✓ abgesetzt 21:02“) zeigen und „Zurücknehmen“ als kleineren, seitlich versetzten Knopf anbieten, analog zur Liste.
- **Verifikation:** Abgesetzten Vordruck öffnen und in die Mitte der Aktionsleiste tippen: Der Status darf sich nicht ändern.

### P2-2 – Querformat: Vordruck als Briefmarke, erste Spruchaktion außerhalb des Bildes

- **Fundstelle / Aufgabe:** Pixel 7 quer (839×412), Teilnehmeransicht und Vordruck-Modal. Screenshots `p7l-tn.png`, `p7l-modal.png`.
- **Beobachtung:** Im Querformat ist das Modal kein Vollbild. Die App-Kopfzeile (GitHub, Anleitung, Über den Autor, Dark Mode) liegt darüber, und der Vordruck wird als etwa 35 px breites, unlesbares Vorschaubild gezeigt. Die Aktionsleiste ist vorhanden und groß (48 px). In der Listenansicht füllen Kopfzeile, Navigation, Kopfkarte, Ansichtsumschalter und Filter den ersten Bildschirm, die erste Karte beginnt am unteren Rand, und ihr Knopf ist nicht sichtbar.
- **Erwartung der Rolle:** Ein Smartphone in einer Halterung oder quer in der Hand zeigt den Vordruck lesbar, und der nächste Spruch ist ohne Scrollen sichtbar.
- **Auswirkung im Einsatz:** Wer das Gerät quer hält, etwa im Fahrzeug, muss drehen oder scrollen. Jede zusätzliche Scrollgeste mit Handschuhen birgt das Risiko eines Fehltipps.
- **Empfehlung:** Das Vordruck-Modal auf Touch-Geräten auch im Querformat als Vollbild zeigen und den Vordruck auf die verfügbare Höhe skalieren, notfalls mit Scrollen innerhalb des Vordrucks. In der Teilnehmeransicht die Kopfzeile auf niedrigen Viewports reduzieren.
- **Verifikation:** Pixel 7 quer: Der Vordruck füllt mindestens die halbe Bildschirmhöhe, und in der Liste ist der erste offene Spruch samt Knopf ohne Scrollen sichtbar.

### P2-3 – X-Zeit auf kleinem Smartphone: Fokus-Knopf unterhalb der ersten Seite, „Jetzt starten“ klein und wiederholbar

- **Fundstelle / Aufgabe:** X-Zeit-Übung, `#/teilnehmer/<id>/<code>`, iPhone SE (320×568). Karte `#xZeitBanner` mit `#xZeitBasisInput` (130×30), `#btn-xzeit-jetzt` (96×30) und `#toggle-fokus-modus` (34×17, Label 82×20). Fokus-Karte `#teilnehmerFokusCard`. Screenshots `se-x-top.png`, `se-x-started.png`, `se2-fokus-full.png`, `se2-after-jetzt2.png`.
- **Beobachtung:** Der Fokus-Modus ist auf schmalen Geräten jetzt Standard, und die Karte hat einen großen Knopf (246×72). Er liegt aber bei y = 715, also unterhalb des 568 px hohen Viewports. Davor stehen Kopfzeile, „Menü“, Übungskarte, Ansichtsumschalter, Schalter und die X-Zeit-Karte. Der Helfer muss also bei jedem fälligen Spruch erst scrollen. „Jetzt starten“ ist nur 30 px hoch, und sein Text bleibt nach dem Start unverändert. Ein zweiter Tipp eine Minute später setzte die eigene Basis ohne Rückfrage von 21:04 auf 21:05, und alle Fälligkeiten verschoben sich. Eine Rückfrage gibt es laut Code nur, wenn die Übungsleitung bereits eine Basis gesetzt hat (`src/teilnehmer/xZeitSteuerung.ts`, `bestaetigeAbweichung`).
- **Erwartung der Rolle:** Im Fokus-Modus sehe ich nach dem Entsperren sofort den fälligen Spruch und den Knopf. Ein versehentlicher Tipp auf „Jetzt starten“ verstellt nicht meine Uhr.
- **Auswirkung im Einsatz:** Zusätzliches Scrollen bei jedem Spruch. Wird die X-Zeit versehentlich neu gestartet, zeigt der Countdown andere Zeiten als bei der Leitung, und der Teilnehmer funkt zu spät oder zu früh.
- **Empfehlung:** Im Fokus-Modus die Fokus-Karte direkt unter eine kompakte Kopfzeile setzen. X-Zeit-Einstellung und Schalter einklappen, sobald die X-Zeit läuft. „Jetzt starten“ nach dem Start in „X-Zeit läuft seit …“ umwandeln, und ein Neustart nur über eine bewusste Aktion mit Rückfrage. Bedienelemente der X-Zeit-Karte auf mindestens 44 px.
- **Verifikation:** iPhone SE, X-Zeit gestartet, Fokus-Modus an: Der Knopf der Fokus-Karte liegt vollständig im ersten Viewport. Ein erneuter Tipp auf die Startfläche ändert die Basis nicht ohne Bestätigung.

### P2-4 – Übungsleitung auf dem Tablet: abgeschnittene Aktionsspalte, viele 30-px-Ziele

- **Fundstelle / Aufgabe:** `#/uebungsleitung/<id>`, iPad hoch (810×1080) und Pixel 7. Screenshots `ipad3-ul-after.png`, `p7ul-teilnehmer.png`, `p7ul-nachrichten.png`, `v-ipad-zurueck.png`.
- **Beobachtung:** Positiv: Ein Doppeltipp auf „Als abgesetzt markieren“ (167×44) bleibt „abgesetzt“, denn unter dem Finger liegt danach nur die Textzeile „Leitung 21:08“. Die Seite springt vertikal nicht (scrollY vor und nach dem Tipp gleich, 1028). Weiterhin klein bzw. eng:
  - Kopier-Knopf 26×30.
  - Stärke-Felder F/UF/H/Ges je 48×30 mit 4 px Abstand.
  - „+ Notiz“ 45×30, „Details“ 76×30, Filter-Selects 71–73×30.
  - Schalter „Abgesetzte ausblenden“ 27×14.
  - X-Zeit-Feld und „Jetzt starten“ im Cockpit 30 px hoch.

  Auf dem iPad hoch ist der Nachrichtenplan breiter als der Bereich (790 zu 736 px). Die Spalte „Zeit“ mit „Zeit ändern“ und „zurücknehmen“ ist am rechten Rand abgeschnitten („Zeit“, „zurü“), ebenso „Debrief PDF“ in der Teilnehmertabelle. „Zeit ändern“ und „zurücknehmen“ (je 44 hoch) stehen mit nur 8 px Abstand übereinander, und „zurücknehmen“ wirkt ohne Rückfrage und ohne Rückgängig-Leiste. Auf dem Smartphone sind die Tabellen 710 bzw. 854 px breit bei 338 px sichtbarer Breite.
- **Erwartung der Rolle:** Auf dem Tablet sind alle Aktionen einer Zeile ohne Seitwärtswischen sichtbar. Gegensätzliche Aktionen liegen nicht direkt übereinander.
- **Auswirkung im Einsatz:** Annahme: Die Übungsleitung nutzt teils Tablets. Dann muss sie zum Korrigieren seitlich wischen, und ein Fehltipp zwischen „Zeit ändern“ und „zurücknehmen“ öffnet einen bestätigten Spruch stumm wieder. Am Laptop mit Maus ist das unkritisch.
- **Empfehlung:** Auf Tablet-Breite die Zeitspalte nicht abschneiden, etwa indem die Aktionen in die Statusspalte wandern. „zurücknehmen“ räumlich von „Zeit ändern“ trennen und mit derselben Rückgängig-Leiste versehen wie beim Teilnehmer. Die Ziele in den Zeilen auf mindestens 44 px bringen.
- **Verifikation:** iPad hoch: `scrollWidth` der Tabellen nicht größer als `clientWidth`. Keine Zeilenaktion unter 44 px, Abstand zwischen gegensätzlichen Aktionen mindestens 16 px.

### P3-1 – Teilnehmer: Nebenbedienelemente und Navigation klein bzw. doppelt

- **Fundstelle / Aufgabe:** Teilnehmeransicht Pixel 7. Messwerte: Suchfeld `#teilnehmerSearchInput` 372×30, Schalter „Abgesetzte ausblenden“ 39×21 (Label 141×20), Navigationslinks 32 px hoch, Footer-Links 14 px hoch mit engem Zeilenabstand. Screenshot `p7-tn-top.png`, `se2-fokus-full.png`.
- **Beobachtung:** Kopfzeile mit Hamburger-Menü **und** darunter eine zweite Zeile „☰ Menü“: zwei Menüs übereinander, beide unter 44 px. Die Hauptaktionen sind groß, die Nebenaktionen nicht. Positiv: `scrollWidth` = Viewport-Breite (412), also kein seitliches Wischen mehr nötig.
- **Erwartung der Rolle:** Filter und Schalter mit dem Daumen ohne Zielen treffen. Nur ein Menü.
- **Auswirkung im Einsatz:** Gering. Ein Fehltipp öffnet ein Menü oder einen Footer-Link und führt aus der Übung heraus (der Abhak-Stand bleibt lokal erhalten).
- **Empfehlung:** Suchfeld in normaler Höhe, Schalterzeile als ganze, mindestens 44 px hohe Tippfläche, in der Teilnehmeransicht nur ein Menü.
- **Verifikation:** Messskript: keine interaktiven Elemente oberhalb der ersten Karte unter 44 px.

### P3-2 – Code-Eingabe: kein automatischer Sprung ins zweite Feld, Absenden hinter der Tastatur

- **Fundstelle / Aufgabe:** `#/teilnehmer` ohne Code, Formular `#teilnehmerJoinForm`. Screenshot `kb-join.png`, `p7-join.png`.
- **Beobachtung:** Die Felder sind 39 px hoch und haben Großschreibung und keine Autokorrektur (gut). Nach sechs Zeichen im Übungscode bleibt der Fokus im ersten Feld, ein Sprung zum Teilnehmercode erfolgt nicht. Mit simulierter Tastatur (Viewport 412×430) liegt „Zugang öffnen“ bei y = 443, also verdeckt. Absenden per Eingabetaste ist über das Formular möglich. Die reale Bildschirmtastatur lässt sich im Emulator nicht abbilden.
- **Erwartung der Rolle:** Möglichst wenig Tippen: Nach dem vollständigen Code springt der Cursor weiter.
- **Auswirkung im Einsatz:** Ein zusätzlicher Präzisionstipp ins zweite Feld. Gering, weil der Link mit den Codes meist direkt geöffnet wird.
- **Empfehlung:** Nach sechs Zeichen automatisch ins Teilnehmercode-Feld wechseln, Feldhöhe mindestens 44 px.
- **Verifikation:** Auf einem realen Smartphone den Code mit Handschuh eingeben und die nötigen Tipps zählen.

### P3-3 – Generator auf dem Smartphone: kleine Radios und Löschknöpfe

- **Fundstelle / Aufgabe:** `#/generator`, Pixel 7. Screenshot `p7-gen-full.png`.
- **Beobachtung:** Radios für die Quelle (`#optionVorlagen` usw.) 13×13, Optionen-Checkboxen 16×16 (Labels antippbar). „Teilnehmer entfernen“ 37×30 direkt neben dem Namensfeld. Code-Felder der Schnellanmeldung 39 px, „Teilnehmer-Zugang öffnen“ 37 px.
- **Auswirkung im Einsatz:** Gering. Vorbereitung erfolgt meist am Schreibtisch (Annahme).
- **Empfehlung:** Radios und Checkboxen als ganze Zeilen mit mindestens 44 px, Löschknopf größer und mit Abstand.
- **Verifikation:** Messskript im Generator: keine Ziele unter 44 px.

### P3-4 – Verwaltung auf dem Smartphone: Aktionen außerhalb des sichtbaren Tabellenteils

- **Fundstelle / Aufgabe:** `#/admin`, Pixel 7. Screenshot `p7-admin-full.png`.
- **Beobachtung:** Die Aktionen sind jetzt beschriftet („Öffnen“ 85×30, „Überwachen“ 120×30, „Löschen“ 96×30). Sie liegen aber rechts außerhalb der sichtbaren Tabelle und brauchen seitliches Wischen. „Löschen“ steht direkt neben „Überwachen“. „Vorherige“/„Nächste“ sind 30 px hoch.
- **Auswirkung im Einsatz:** Gering, Verwaltung findet kaum unterwegs statt. Löschen fragt nach (aus dem Vorlauf, nicht erneut geprüft).
- **Empfehlung:** Auf schmalen Bildschirmen Karten statt Tabelle, „Löschen“ räumlich abgesetzt.
- **Verifikation:** Pixel 7: Alle Aktionen einer Übung sind ohne Seitwärtswischen sichtbar.

## Nicht geprüft

- Realer Handschuhtest auf echten Geräten (kapazitive und normale Arbeitshandschuhe), Nässe auf dem Display.
- Echte Bildschirmtastatur (nur per verkleinertem Viewport angenähert).
- Wischgesten im Vordruck: Eine Wischbewegung über den Vordruck blätterte nicht (CDP-Touch-Events, „Seite 1 / 8“ blieb). Das ist kein Mangel, weil große Knöpfe vorhanden sind. Erwähnt wird es nur, weil manche Nutzer es erwarten.

## Abschluss

- **Aufgabe geschafft:** ja, in der Liste ohne Umweg. Im Vordruck nur mit Umweg (nach dem Markieren abwarten, bevor man auf „Weiter“ tippt).
- **Fremde Hilfe nötig:** nein.
- **Größtes Missverständnis:** Der Helfer tippt nach dem Markieren auf „Weiter“ und hält den Spruch für erledigt. Tatsächlich hat er „Rückgängig“ getroffen.
- **Größtes Einsatzrisiko:** Unbemerkt wieder geöffnete Sprüche durch die Rückgängig-Leiste über der Vordruck-Aktionsleiste, und dadurch ein falscher Übungsstand bei Teilnehmer und Leitung.
- **Top-Priorität für die nächste Iteration:** Die Rückgängig-Leiste so platzieren, dass sie im Vordruck und in der Liste nie einen anderen Knopf überdeckt.

---

## Abgleich mit dem Lauf vom 2026-10-04

| Alte ID | Titel | Alte Prio | Status jetzt | Beleg aus dieser Prüfung |
|---|---|---|---|---|
| P1-1 | Übungsleitung: Doppeltipp auf „✓ abgesetzt“ setzt sofort zurück | P1 | behoben | iPad: Doppeltipp (150 ms) auf „Als abgesetzt markieren“. Unter dem Finger liegt danach die Textzeile „Leitung 21:08“, die Zeile bleibt „ABGESETZT“. „zurücknehmen“ steht in einer anderen Spalte (x = 747 statt 144). Rest-Risiko siehe neuer P2-4. |
| P1-2 | Vordruck: „Übertragen“ nur per Leertaste | P1 | behoben | `#btn-doc-absetzen` in fester Leiste unten, per Tipp funktionsfähig („OFFEN“ → „ABGESETZT“). Die Tastaturlegende ist auf Touch ausgeblendet (`display: none`), der Vordruck rendert. Neue Folgeprobleme: P1-1 und P2-1. |
| P1-3 | Tabelle: Statusaktion abgeschnitten, zwei Mini-Ziele | P1 | behoben | Kartenansicht. Ein Knopf über die volle Breite, mindestens 44 px hoch (`p7-tn-top.png`). `scrollWidth` 412 = Viewport, kein seitliches Wischen. |
| P2-1 | Teilnehmer: Doppeltipp hebt Markierung stumm auf | P2 | behoben | Doppeltipp auf Spruch 2: bleibt „abgesetzt“, danach „Zurücknehmen“ seitlich versetzt (`p7-tn-doubletap.png`). Mit „Abgesetzte ausblenden“: Spruch 1 verschwindet, Spruch 2 bleibt „offen“. Rückgängig-Leiste vorhanden. |
| P2-2 | Kopfbereich frisst den Bildschirm, Elemente laufen aus dem Bild | P2 | teilweise | Hochformat: erster Knopf bei y = 495 bis 543 von 839 sichtbar, kein Überlauf. Querformat: weiterhin keine Spruchaktion im ersten Bildschirm (`p7l-tn.png`). Zwei Menüs übereinander bleiben (neuer P3-1). |
| P2-3 | Vordruck-Modal unter der Kopfzeile, Schließen klein | P2 | teilweise | Hochformat: Vollbild, „Schließen“ 126×44 frei (`p7-modal.png`). Querformat: kein Vollbild, App-Kopfzeile sichtbar, Vordruck als winziges Vorschaubild (`p7l-modal.png`, neuer P2-2). |
| P2-4 | Übungsleitung: Layout springt, kleine Ziele dicht | P2 | teilweise | Kein vertikaler Sprung mehr (scrollY 1028 → 1028). Ziele weiterhin 26–48×30, Zeitspalte auf dem iPad abgeschnitten (neuer P2-4). |
| P3-1 | Generator: durchgehend kleine Ziele | P3 | teilweise | Code-Felder 30 → 39 px, Zugangsknopf 30 → 37 px. Radios weiterhin 13×13, „Teilnehmer entfernen“ 37×30 (neuer P3-3). |
| P3-2 | Admin: Löschen im seitlich gescrollten Tabellenteil | P3 | teilweise | Aktionen jetzt beschriftet (Öffnen/Überwachen/Löschen). Weiterhin außerhalb des sichtbaren Bereichs und 30 px hoch (`p7-admin-full.png`, neuer P3-4). |
