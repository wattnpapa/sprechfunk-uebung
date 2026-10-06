Befunde: P0=0 P1=0 P2=4 P3=5
Abgleich: behoben=4 teilweise=5 offen=0 nicht-pruefbar=0

# THW Glove-Touch-Review (dritter Lauf) – Sprechfunk Übungsgenerator

Datum: 2026-10-06 · Perspektive: Helfer mit Arbeitshandschuhen oder eingeschränkter Feinmotorik, stehend, oft einhändig (Handfunkgerät in der anderen Hand).

Prüfumgebung: lokaler Build `http://127.0.0.1:3000`, Mock-Firestore, Playwright mit Chromium 1194. Geräteprofile: Pixel 7 (412×839, hoch und quer), iPhone SE (320×568, hoch und quer), iPad gen 7 (810×1080) und Desktop 1440×1000 zum Erzeugen der Übungen. Erzeugt wurden zwei Übungen, eine klassische und eine mit X-Zeit, je mit drei Teilnehmern und acht Sprüchen. Getippt wurde mit `touchscreen.tap`. Was nach einem Tipp unter dem Finger liegt, wurde mit `elementFromPoint` geprüft. Gemessen wurden die Bounding-Boxen aller sichtbaren Bedienelemente, Richtwert etwa 44 CSS-px. Screenshots liegen unter `scratchpad/glove-touch3/`, die Dateinamen stehen in den Befunden.

Einordnung: Die App ist ein Ausbildungswerkzeug für Dienstabend und Ausbildung, kein Einsatzsystem. „Im Einsatz“ meint hier die laufende Funkübung. Annahme: Teilnehmer nutzen ihr eigenes Smartphone, die Übungsleitung Laptop oder Tablet.

Messhinweis: In einem frühen Messlauf der Übungsleitung kamen viele Ziele nur auf 30 px. Ein späterer Lauf und eine gezielte Nachmessung ergaben auf iPad und Pixel 7 übereinstimmend 44 px; `(pointer: coarse)` war in beiden Fällen aktiv. Bewertet wird der stabile Zustand mit 44 px. Ob die Seite direkt nach dem Laden kurz mit kleineren Zielen erscheint, sollte auf einem echten Gerät nachgesehen werden.

## Urteil aus Sicht der Rolle

Die Teilnehmeransicht im Hochformat ist mit Handschuhen jetzt gut bedienbar. Die Hauptaktion ist ein Knopf über die volle Breite (339×48). Ein Doppeltipp nimmt in der Liste nichts zurück. Die Rückgängig-Leiste liegt in der Liste oben und im Vordruck zwischen Vordruck und Aktionsleiste. Sie verdeckt keinen Knopf mehr. Im Vordruck ist die Mitte der Leiste nach dem Markieren eine reine Statusanzeige („✓ abgesetzt 06:24“) und keine Schaltfläche mehr. „Weiter“ bleibt an seiner Stelle. Die Code-Eingabe springt nach sechs Zeichen selbst ins zweite Feld. Die Übungsleitung auf dem Tablet hat nahezu überall 44-px-Ziele, und die Tabellen passen in die Breite.

Reibung bleibt an drei Stellen:
- **Fokus-Karte (X-Zeit) auf dem schmalen Smartphone:** Nach dem Markieren liegt „Zurücknehmen“ genau unter dem Daumen. Wer nach etwa 1,5 s noch einmal tippt, weil er unsicher ist, ob der Tipp angekommen ist, öffnet den Spruch wieder.
- **Querformat:** Nach dem Markieren schrumpft der Vordruck auf einen Streifen von etwa 110 px, und die Aktionsleiste rutscht nach oben.
- **Übungsleitung:** Nach dem Markieren verschiebt sich der Inhalt. Ein schneller zweiter Tipp landet im Textfilter.

Ohne fremde Hilfe ist die Aufgabe zu schaffen, und eine Ausweichroute ist nicht mehr nötig.

---

## Befunde

### P2-1 – „Zurücknehmen“ liegt direkt an der Stelle bzw. neben der Hauptaktion (Fokus-Karte, Vordruck)

- **Fundstelle / Aufgabe:** Ein Spruch wird als abgesetzt markiert, an zwei Stellen:
  - X-Zeit-Übung, `#/teilnehmer/<id>/<code>`, Fokus-Karte `#teilnehmerFokusCard`, iPhone SE (320×568). Screenshots `fokus-dbl-iPhoneSE-150.png`, `fokus-dbl-iPhoneSE-1500.png`.
  - Vordruck-Modal, Pixel 7, `#btn-doc-zuruecknehmen` über `#btn-doc-prev`. Screenshot `p7-modal-prev.png`.
- **Beobachtung:**
  - **Fokus-Karte:** „Als abgesetzt markieren“ (246×47, Mitte x = 160, y = 284). Nach dem Tipp zeigt die Karte „Zuletzt abgesetzt: Meldung 1 · Zurücknehmen“. Der Knopf „Zurücknehmen“ (113×44, Mitte x = 160) liegt genau unter dem Finger, `elementFromPoint` liefert ihn schon nach 150 ms. Eine Tippsperre fängt einen zweiten Tipp nach 150, 400, 700 und 1000 ms ab, das wurde real geprüft. Ein zweiter Tipp nach 1500 ms nimmt die Markierung zurück: Die Karte zeigt wieder „Meldung 1 fällig … Als abgesetzt markieren“, die Leiste meldet „Spruch 1 wieder offen.“ Auf dem breiteren Pixel 7 liegt „Zurücknehmen“ seitlich versetzt (x = 239 bis 352), dort trifft der zweite Tipp nur Text.
  - **Vordruck:** Bei einem abgesetzten Spruch steht „Zurücknehmen“ (113×44, y = 731 bis 775) nur 2 px über „Zurück“ (96×48, ab y = 777). Beide sitzen links unten, und die Wörter unterscheiden sich nur in der Endung.
- **Erwartung der Rolle:** An der Stelle, auf die ich gerade getippt habe, liegt danach nichts, was meinen Tipp ins Gegenteil verkehrt. „Zurück“ zum vorigen Vordruck und „Zurücknehmen“ der Markierung liegen nicht direkt aufeinander.
- **Auswirkung im Einsatz:** Mit Handschuhen spürt man nicht, ob ein Tipp angekommen ist. Ein kontrollierender zweiter Tipp nach ein bis zwei Sekunden ist typisch. Er öffnet in der Fokus-Karte den gerade gefunkten Spruch wieder, und die Leitung sieht ihn als offen. Die Rückgängig-Leiste meldet das zwar, aber oben am Bildschirmrand, während der Blick auf dem Funkgerät liegt. Im Vordruck führt ein leicht zu hoher Tipp auf „Zurück“ zu „Zurücknehmen“.
- **Empfehlung:** In der Fokus-Karte „Zurücknehmen“ nicht in die Fläche des bisherigen Hauptknopfs legen, sondern seitlich oder in eine Zeile darunter, wie in der Liste. Dort trifft der zweite Tipp nur ein Textfeld. Im Vordruck „Zurücknehmen“ von „Zurück“ deutlich trennen, etwa rechts neben den Status-Chip, mit mindestens 16 px Abstand. Eine eindeutigere Beschriftung wie „Markierung aufheben“ wäre eine Alternative.
- **Verifikation:** iPhone SE, Fokus-Karte: markieren, nach 0,5 / 1,5 / 3 s an derselben Stelle erneut tippen, der Spruch bleibt abgesetzt. Vordruck: zwischen „Zurücknehmen“ und „Zurück“ liegen mindestens 16 px.

### P2-2 – Querformat: Vordruck schrumpft nach dem Markieren, Aktionsleiste rutscht, Liste ohne Aktion im ersten Bildschirm

- **Fundstelle / Aufgabe:** Pixel 7 quer (863×360). Teilnehmeransicht und Nachrichtenvordruck. Screenshots `p7l-tn.png`, `p7l-modal.png`, `p7l-modal-tap.png`.
- **Beobachtung:** Das Vordruck-Modal ist jetzt Vollbild, und der Vordruck füllt die Breite. Er wird im eigenen Bereich gescrollt (Canvas 854×1213). Nach dem Tipp auf „Als abgesetzt markieren“ schiebt sich die Rückgängig-Leiste dazwischen. Der Vordruckbereich (`.modal-body`) schrumpft auf 109 px Höhe, sichtbar ist nur noch der Kopf des Formulars. Die Aktionsleiste rutscht um 26 px nach oben (Weiter: y = 292 → 266). Ein Tipp auf die alte Mitte von „Weiter“ trifft danach den Leistenhintergrund und bewirkt nichts. In der Liste beginnt der erste „Als abgesetzt markieren“-Knopf bei y = 423, also unterhalb des 360 px hohen Viewports. Den Platz davor belegen App-Kopfzeile, Navigationszeile, Übungskarte, Umschalter und Suche.
- **Erwartung der Rolle:** Quer im Fahrzeughalter lese ich den Spruch und tippe ohne Zielen auf „Weiter“. Knöpfe bleiben dort, wo sie waren.
- **Auswirkung im Einsatz:** Acht Sekunden lang ist der Vordruck praktisch unlesbar. Der erste Tipp auf „Weiter“ geht ins Leere, und der Helfer muss nachzielen. In der Liste muss vor jeder Aktion gescrollt werden.
- **Empfehlung:** Im Querformat die Rückgängig-Meldung in die Aktionsleiste integrieren, etwa an Stelle des Status-Chips, statt sie als eigene Zeile einzuschieben. Die Aktionsleiste behält ihre Position. In der Teilnehmeransicht quer die App-Kopfzeile und die Navigation einklappen.
- **Verifikation:** Pixel 7 quer: Die Position von `#btn-doc-next` ist vor und nach dem Markieren gleich, und der Vordruckbereich bleibt mindestens halb so hoch wie der Bildschirm. In der Liste ist der erste offene Spruch samt Knopf ohne Scrollen sichtbar.

### P2-3 – X-Zeit auf kleinem Smartphone: Fokus-Knopf weiterhin unter der ersten Bildschirmseite

- **Fundstelle / Aufgabe:** X-Zeit-Übung, iPhone SE (320×568), Fokus-Modus (Standard). Screenshots `se-x-top.png`, `se-x-started.png`, `se-x-full.png`.
- **Beobachtung:** Positiv: Die eigene X-Zeit steckt jetzt in einem eingeklappten Abschnitt „Ohne Übungsleitung üben: X-Zeit selbst setzen“ (Tippfläche 249×45). Feld und Knopf sind 44 px hoch. Nach dem Start heißt der Knopf „Neu starten“, und ein erneuter Tipp fragt nach („Die X-Zeit läuft seit 06:26. Neu starten setzt sie auf 06:27 – alle Fälligkeiten verschieben sich. Wirklich neu starten?“). Offen bleibt: Der Knopf der Fokus-Karte liegt bei y = 687 bis 734, also unterhalb der 568 px. Das gilt auch bei eingeklapptem Abschnitt. Davor stehen Kopfzeile, „Menü“, Übungskarte und die X-Zeit-Karte (203 px). Wurde der Abschnitt zum Selbststarten geöffnet, bleibt er nach dem Start offen, und die X-Zeit-Karte wächst auf 307 px. Im Querformat (568×320) liegt der Knopf bei y = 541.
- **Erwartung der Rolle:** Im Fokus-Modus sehe ich nach dem Entsperren sofort den fälligen Spruch und den Knopf.
- **Auswirkung im Einsatz:** Vor jedem fälligen Spruch muss gescrollt werden. Jede Scrollgeste mit Handschuh birgt das Risiko eines Fehltipps.
- **Empfehlung:** Im Fokus-Modus die Fokus-Karte direkt unter eine kompakte Kopfzeile setzen, sobald die X-Zeit läuft, und die X-Zeit-Karte auf eine Zeile verkleinern („X 06:26 · 1 fällig · nächste in 2:09“). Den Abschnitt zum Selbststarten nach dem Start wieder einklappen.
- **Verifikation:** iPhone SE, X-Zeit läuft, Fokus-Modus an: Der Knopf der Fokus-Karte liegt vollständig im ersten Viewport.

### P2-4 – Übungsleitung: Inhalt verschiebt sich nach dem Markieren, zweiter Tipp landet im Textfilter

- **Fundstelle / Aufgabe:** `#/uebungsleitung/<id>`, Nachrichtenplan, „Als abgesetzt markieren“ (iPad 545×44, Pixel 7 223×44). Screenshots `ipad-ul-after.png`, `ipad-ul-mark.png`.
- **Beobachtung:** Ein Doppeltipp setzt nichts zurück, der Spruch bleibt „ABGESETZT“. Nach dem ersten Tipp verschiebt sich aber der Inhalt unter dem Finger:
  - **iPad:** `scrollY` bleibt 2048, das Textfilterfeld rutscht jedoch von y = 584 auf 743. Wahrscheinlich ändert sich die Teilnehmerkarte darüber, nachdem der Anmeldespruch abgesetzt ist.
  - **Pixel 7:** `scrollY` 2744 → 2763.

  Unter dem Finger liegt danach die Beschriftung „Text“ bzw. das Feld `#nachrichtenTextFilterInput`. Der zweite Tipp fokussiert den Filter. Im Screenshot ist er hervorgehoben, auf einem echten Gerät öffnet sich die Bildschirmtastatur.
- **Erwartung der Rolle:** Nach dem Markieren liegt unter dem Finger dieselbe Zeile oder eine neutrale Fläche, und der nächste Knopf ist dort, wo ich ihn erwarte.
- **Auswirkung im Einsatz:** Annahme: Die Leitung nutzt ein Tablet. Dann schiebt sich die Tastatur über den halben Plan, und der nächste Spruch ist verdeckt, gerade wenn mehrere Meldungen schnell hintereinander quittiert werden. Daten gehen nicht verloren, aber Zeit und Aufmerksamkeit.
- **Empfehlung:** Änderungen oberhalb der aktiven Zeile dürfen die Zeile nicht verschieben. Die Scrollposition sollte an der getippten Zeile verankert sein. Alternativ die Höhe der Teilnehmerkarten beim Statuswechsel stabil halten.
- **Verifikation:** iPad und Pixel 7: Die Bildschirmposition (`getBoundingClientRect().top`) der markierten Zeile ist vor und nach dem Tipp gleich (±4 px). Ein zweiter Tipp 150 ms später trifft kein Eingabefeld.

### P3-1 – Teilnehmer: zwei Menüs, kleine Navigations- und Footer-Links, Rückgängig oben

- **Fundstelle / Aufgabe:** Teilnehmeransicht Pixel 7 und iPhone SE. Screenshots `p7-tn-top.png`, `p7-tn-after-tap.png`.
- **Beobachtung:**
  - **Behoben:** Suchfeld 372×44, Schalterzeile „Abgesetzte ausblenden“ als Tippfläche 192×44, `scrollWidth` = Viewport.
  - **Weiterhin vorhanden:** Hamburger-Knopf der Kopfzeile (68×36) **und** darunter „☰ Menü“ (372×36), also zwei Menüs. Die aufgeklappten Navigationslinks sind 32 px hoch. Die Footer-Links sind 14 px hoch und haben nur etwa 9 px Zeilenabstand.
  - **Rückgängig-Leiste in der Liste:** Sie erscheint jetzt oben über der Kopfzeile (16/8, 380×62). Dort verdeckt sie nichts Wichtiges. Für den Daumen einer Hand ist sie aber am weitesten entfernt. Als Ersatz gibt es „Zurücknehmen“ in der Karte.
- **Auswirkung im Einsatz:** Gering. Ein Fehltipp öffnet ein Menü oder einen Footer-Link und führt aus der Übung heraus. Der Abhak-Stand bleibt erhalten.
- **Empfehlung:** In der Teilnehmeransicht nur ein Menü zeigen, Navigations- und Footer-Links mit mindestens 44 px Zeilenhöhe.
- **Verifikation:** Messskript: oberhalb der ersten Karte und im Footer keine Links unter 44 px Höhe.

### P3-2 – Code-Eingabe: Absenden hinter der Tastatur

- **Fundstelle / Aufgabe:** `#/teilnehmer` ohne Code, `#teilnehmerJoinForm`. Screenshots `p7-join.png`, `p7-join-kb.png`.
- **Beobachtung:**
  - **Behoben:** Die Felder sind 48 px hoch. Nach sechs Zeichen springt der Fokus selbst ins Teilnehmercode-Feld.
  - **Weiterhin vorhanden:** Nach vier Zeichen bleibt der Fokus im Feld. Mit angenäherter Tastatur (Viewport 412×430) liegt „Zugang öffnen“ bei y = 461 bis 509 und damit verdeckt. `enterkeyhint` ist nicht gesetzt, die Eingabetaste der Bildschirmtastatur zeigt also kein „Los“. Das Absenden per Eingabetaste funktioniert über das Formular.
- **Auswirkung im Einsatz:** Gering: Tastatur schließen oder scrollen, dann tippen. Meist wird der Link mit den Codes direkt geöffnet.
- **Empfehlung:** `enterkeyhint="go"` im Teilnehmercode-Feld setzen oder nach vollständigen Codes den Knopf in den sichtbaren Bereich holen.
- **Verifikation:** Echtes Smartphone mit Handschuh: Code eingeben und die nötigen Tipps bis zur Teilnehmeransicht zählen.

### P3-3 – Generator auf dem Smartphone: Radio-Zeilen nur am Label tippbar, Eingaben unter 44 px

- **Fundstelle / Aufgabe:** `#/generator`, Pixel 7. Screenshot `p7-gen-full.png`.
- **Beobachtung:**
  - **Behoben:** Radios und Checkboxen 22×22 (vorher 13 bzw. 16). „Teilnehmer entfernen“ 44×44 mit 17 px Abstand zum Namensfeld. Schnellzugang 44 px.
  - **Weiterhin vorhanden:** Die Zeilen sind 44 px hoch, die Labels („Klassisch“, „X-Zeit“, „Vorlagen verwenden“ usw.) aber nur 20 px. Ein Tipp in die Zeile neben dem Label wirkt laut Messung nicht. Textfelder 39 px, „Übung generieren“ 335×37, Profil-Knöpfe 37 px, Vorlagen-Suchfeld 31 px. Viele Wissens-Links im Fließtext sind 15 px hoch.
- **Auswirkung im Einsatz:** Gering, die Vorbereitung erfolgt meist am Schreibtisch (Annahme).
- **Empfehlung:** Das Label über die ganze Zeile ziehen. Textfelder und Hauptknopf auf mindestens 44 px.
- **Verifikation:** Pixel 7: Ein Tipp auf den rechten Rand der Zeile „X-Zeit“ wählt X-Zeit.

### P3-4 – Verwaltung auf dem Smartphone: „Löschen“ 8 px unter „Öffnen“, kleine Filter

- **Fundstelle / Aufgabe:** `#/admin`, Pixel 7. Screenshot `p7-admin-full.png`.
- **Beobachtung:**
  - **Behoben:** Aktionen sichtbar und 44 px hoch (Öffnen 85×44, Überwachen 120×44, Löschen 96×44), kein seitliches Wischen (`scrollWidth` 412). Löschen fragt mit Übungsname, Datum und Übungscode nach und bietet 8 s „Rückgängig“.
  - **Weiterhin vorhanden:** „Löschen“ steht in der Zeile direkt unter „Öffnen“ (y = 646 bis 690, dann 698), also nur 8 px Abstand. Suchfeld 298×30, Jahr-Auswahl 95×30, Checkbox „Nur Testübungen“ 16×16, Übungstitel-Links 16 px hoch.
- **Auswirkung im Einsatz:** Gering, dank Rückfrage und Rückgängig.
- **Empfehlung:** „Löschen“ räumlich deutlicher absetzen, etwa rechtsbündig oder mit größerem Abstand. Filter auf 44 px.
- **Verifikation:** Pixel 7: Abstand zwischen „Löschen“ und anderen Aktionen mindestens 16 px, keine Filter unter 44 px.

### P3-5 – Übungsleitung: Planstatus-Badge und Schalter als kleine Restziele

- **Fundstelle / Aufgabe:** `#/uebungsleitung/<id>`, iPad. Messung nach 5 s Ladezeit.
- **Beobachtung:** Fast alle Bedienelemente sind 44 px hoch: Notiz, Zeit nachtragen/ändern, auslassen, zurücknehmen, Stärke-Felder 54×44 mit 8 px Abstand, Kopier-Knopf 44×44, Filter. Klein bleiben das antippbare Badge `#cockpitPlanBadge` („3 hinter Plan“, springt zur ersten fälligen Zeile, 21–85×19) und der Schalter „Abgesetzte ausblenden“ (39×21, Label 141×20).
- **Auswirkung im Einsatz:** Gering. Für den Sprung zu fälligen Sprüchen gibt es zusätzlich den Knopf „3 jetzt fällig – zur ersten“.
- **Empfehlung:** Badge und Schalterzeile als Tippflächen mit mindestens 44 px Höhe.
- **Verifikation:** Messskript im Bereich `#uebungsleitungArea`: keine interaktiven Elemente unter 44 px.

## Nicht geprüft

- Realer Handschuhtest auf echten Geräten (kapazitive und normale Arbeitshandschuhe), Nässe auf dem Display.
- Echte Bildschirmtastatur, nur per verkleinertem Viewport angenähert.
- Weitergabe einer von der Übungsleitung gesetzten X-Zeit an ein zweites Gerät. Der Mock-Speicher ist je Browser-Kontext getrennt, deshalb wurde die X-Zeit beim Teilnehmer selbst gestartet. Die Fokus-Karte sieht dabei gleich aus.

## Abschluss

- **Aufgabe geschafft:** ja.
- **Fremde Hilfe nötig:** nein.
- **Größtes Missverständnis:** In der Fokus-Karte auf dem kleinen Smartphone hält der Helfer einen zweiten, kontrollierenden Tipp für harmlos. Tatsächlich trifft er „Zurücknehmen“ und öffnet den Spruch wieder.
- **Größtes Einsatzrisiko:** Unbemerkt wieder geöffnete Sprüche in der Fokus-Karte, wenn nach etwa 1,5 s erneut getippt wird. Die Leitung sieht dann einen gefunkten Spruch als offen.
- **Top-Priorität für die nächste Iteration:** „Zurücknehmen“ in der Fokus-Karte und im Vordruck aus der Tippfläche bzw. Nachbarschaft der Hauptaktion herausnehmen.

---

## Abgleich mit dem Lauf vom 2026-10-05

| Alte ID | Titel | Alte Prio | Status jetzt | Beleg aus dieser Prüfung |
|---|---|---|---|---|
| P1-1 | Rückgängig-Leiste liegt über der Aktionsleiste: „Weiter“ wird zu „Rückgängig“ | P1 | behoben | Pixel 7 hoch: Nach dem Markieren liegt die Leiste zwischen Vordruck und Aktionsleiste (`p7-modal-prev.png`). `elementFromPoint` auf „Weiter“ liefert `#btn-doc-next`. Real getippt: Seite 2 → 3, Spruch bleibt abgesetzt. In der Liste liegt die Leiste jetzt oben (`p7-tn-after-tap.png`). Im Querformat rutscht die Leiste um 26 px, siehe neuer P2-2. |
| P2-1 | Vordruck: Hauptknopf wechselt an derselben Stelle zwischen „abgesetzt“ und „Zurücknehmen“ | P2 | behoben | Bei einem abgesetzten Spruch ist die Mitte `#teilnehmerDocErledigt` („✓ abgesetzt 06:24“, keine Schaltfläche). Ein Tipp dorthin ändert nichts. „Zurücknehmen“ ist ein eigener kleinerer Knopf. Er liegt allerdings 2 px über „Zurück“, siehe neuer P2-1. |
| P2-2 | Querformat: Vordruck als Briefmarke, erste Spruchaktion außerhalb des Bildes | P2 | teilweise | Das Modal ist quer jetzt Vollbild, der Vordruck füllt die Breite (854 px) und lässt sich scrollen (`p7l-modal.png`). Die Liste zeigt weiterhin keinen Knopf im ersten Bildschirm (erster bei y = 423 von 360). Nach dem Markieren schrumpft der Vordruck auf 109 px (neuer P2-2). |
| P2-3 | X-Zeit auf kleinem Smartphone: Fokus-Knopf unterhalb der ersten Seite, „Jetzt starten“ klein und wiederholbar | P2 | teilweise | „Jetzt starten“ ist eingeklappt und 44 px hoch, danach heißt er „Neu starten“ und fragt nach (Dialog real ausgelöst). Der Fokus-Knopf liegt weiterhin bei y = 687 von 568 (neuer P2-3). |
| P2-4 | Übungsleitung auf dem Tablet: abgeschnittene Aktionsspalte, viele 30-px-Ziele | P2 | behoben | iPad: Tabellen 736 = Container 736. Zeilenaktionen, Stärke-Felder (54×44, 8 px Abstand) und Kopier-Knopf (44×44) sind 44 px groß. „zurücknehmen“ steht neben „Zeit ändern“ und bietet eine Rückgängig-Leiste („„Abgesetzt“ für … zurückgenommen. Rückgängig“, 94×44). Neuer Folgebefund: Verschiebung nach dem Markieren (P2-4). |
| P3-1 | Teilnehmer: Nebenbedienelemente und Navigation klein bzw. doppelt | P3 | teilweise | Suchfeld und Schalterzeile 44 px. Zwei Menüs, 32-px-Navigation und 14-px-Footer-Links bleiben (neuer P3-1). |
| P3-2 | Code-Eingabe: kein automatischer Sprung ins zweite Feld, Absenden hinter der Tastatur | P3 | teilweise | Nach sechs Zeichen ist der Fokus in `joinTeilnehmerCode`, die Felder sind 48 px hoch. Das Absenden liegt mit Tastatur weiterhin verdeckt (y = 461 bis 509 bei 430 px), kein `enterkeyhint` (neuer P3-2). |
| P3-3 | Generator auf dem Smartphone: kleine Radios und Löschknöpfe | P3 | teilweise | Radios 22×22, Zeilen 44 px hoch, „Teilnehmer entfernen“ 44×44 mit 17 px Abstand. Labels nur 20 px hoch, Textfelder 39 px, „Übung generieren“ 37 px (neuer P3-3). |
| P3-4 | Verwaltung auf dem Smartphone: Aktionen außerhalb des sichtbaren Tabellenteils | P3 | behoben | Aktionen sichtbar und 44 px hoch, `scrollWidth` 412 = Viewport. Löschen mit Rückfrage samt Übungscode und 8 s Rückgängig. Restabstand von 8 px zu „Öffnen“ als neuer P3-4. |
