# THW-Review „Erstnutzer ohne Einweisung“ (new-user) – 2026-10-04

**Perspektive:** THW-Helfer, praktisch-technisch versiert, kennt Sprechfunk aus der Ausbildung,
hat die Anwendung aber noch nie gesehen und liest vorher keine Anleitung.
**Rollen geprüft:** Ausbilder, der eine Übung anlegt (Generator, Desktop 1440×900), Teilnehmer
(Pixel 7, mobil, und Desktop), Übungsleitung während der Übung (Desktop), Admin-Liste,
Inhaltsverzeichnis der Startseite.
**Umgebung:** lokaler Build unter `http://127.0.0.1:3000`, Mock-Firestore (`useFirestoreEmulator`),
Playwright mit Chromium 141.0.7390.37, `locale: de-DE`. Screenshots unter
`scratchpad/new-user/` (Dateinamen unten angegeben).
**Kontext:** Ausbildungswerkzeug für Dienstabende, kein Echteinsatzsystem. „Einsatz“ meint hier die
laufende Übung mit Gruppe am Funkgerät.

## Urteil aus Sicht der Rolle

Die Kernaufgabe „Übung anlegen und Links verteilen“ ist ohne Hilfe machbar: Die drei Karten
Kopfdaten / Einstellungen / Teilnehmerverwaltung sind gut lesbar, alles ist vorausgefüllt, und nach
„Übung generieren“ steht eine klare Linktabelle mit *Öffnen / Kopieren / Mail / Druckdaten*.
Die Teilnehmeransicht ist auf dem Handy grundsätzlich verständlich („Meine Funksprüche“, Tabelle,
Status antippen).

Reibung entsteht an drei Stellen. **Erstens** übernimmt ein Erstnutzer die Vorbelegung, und die
mischt elf Vorlagen aller Organisationen, darunter „Lustige Funksprüche (Chat GPT)“, mit
Beispiel-Rufnamen, die nicht seine sind. Das Ergebnis taugt für den Dienstabend nicht. **Zweitens**
führen die Hilfen, zu denen ein unsicherer Nutzer greift, ins Leere: Alle Links im
Inhaltsverzeichnis der Startseite zeigen eine leere Seite, und die Vordruck-Vorschau blieb im
Testbrowser ohne jede Meldung weiß. **Drittens** benutzen die Rollen für denselben Vorgang
verschiedene Wörter: „übertragen“ und „abgesetzt“, „Anmelden“, „Lokale Daten löschen“, das aber
nicht nur lokal wirkt. Außerdem setzen Generator und Übungsleitung viele Begriffe ohne Erklärung
voraus (X-Zeit, Szenario, Führungsstellen-Übung, Stellenname, Debrief, Funklast, Heatmap).

## Befunde

### P1-1 – Das Inhaltsverzeichnis der Startseite führt bei jedem Eintrag auf eine leere Seite

1. **Priorität:** P1
2. **Fundstelle / Aufgabe:** Startseite `/`, Karte „Inhalt“ unter dem Generator (`#inhalt a`). Ein
   unsicherer Nutzer sucht dort Hilfe zu „Kopfdaten“, „Ergebnis“ oder „Gespeicherte Übungen“.
3. **Beobachtung:** Alle zehn Einträge wurden einzeln angeklickt (`#uebungsueberwachung-uebungsleitung`,
   `#teilnehmer`, `#nachrichtenplan`, `#kopfdaten`, `#einstellungen`, `#teilnehmerverwaltung`,
   `#ergebnis`, `#gespeicherte-uebungen`, `#statistik-uebungen-pro-zeit`, `#uebersicht-kennzahlen`).
   Danach sind null Karten sichtbar: nur Kopfzeile und Fußzeile, dazwischen grau
   (`30-toc-klick.png`). `#teilnehmer` öffnet stattdessen das Code-Formular für Teilnehmer. Der
   Hash-Router wertet die Sprungmarken als Routen. Das Verzeichnis entsteht automatisch aus den
   `<h2>` der eingebetteten App-Ansichten (`scripts/lib/render-page.mjs:465`,
   `baueInhaltsverzeichnis`). Es listet deshalb Abschnitte anderer Rollen auf, die auf dieser
   Seite gar nicht zu sehen sind.
4. **Erwartung der Rolle:** Ein Inhaltsverzeichnis springt zu einer Erklärung des Abschnitts,
   oder es fehlt.
5. **Auswirkung:** Der Nutzer verliert sein vorausgefülltes Formular aus dem Blick, landet auf
   einer leeren Seite und muss über „Übung erstellen“ zurück. Er schließt daraus, dass die Seite
   kaputt ist. Das passiert genau dann, wenn er Hilfe sucht.
6. **Empfehlung:** Auf der Startseite kein Verzeichnis aus App-Überschriften bilden. Oder nur auf
   echte Erklärabschnitte verlinken, etwa auf die Anleitung mit passendem Anker.
7. **Verifikation:** Jeden Link im Inhaltsverzeichnis anklicken. Danach muss sichtbarer Inhalt mit
   der verlinkten Überschrift im Viewport stehen (E2E).

### P1-2 – Die Vordruck-Vorschau bleibt weiß, und es kommt keine Fehlermeldung

1. **Priorität:** P1
2. **Fundstelle / Aufgabe:** Teilnehmeransicht `#/teilnehmer/<id>/<tc>`, Schaltflächen
   „Meldevordruck“ und „Nachrichtenvordruck“ (`[data-doc-view]`), mobil und am Desktop.
3. **Beobachtung:** Das Modal „Vordruck“ öffnet sich. Es zeigt nur einen leeren Rahmen und den
   Hinweis „Seite“ ohne Zahl, auch nach 12 s Wartezeit (`17-tn-meldevordruck.png`,
   `19-tn-meldevordruck-9s.png`, `21-tn-desktop-vordruck.png`, `31-vordruck-12s.png`). Die Konsole
   meldet `PAGEERR this[#Yr].getOrInsertComputed is not a function`. Die Funktion steht in
   `dist/pdfjs/pdf.min.js` und `pdf.worker.min.js` (pdfjs-dist 6.3.289) und nutzt
   `Map.prototype.getOrInsertComputed`, das Chromium 141 nicht kennt. Der Nutzer erfährt davon
   nichts.
   *Annahme:* In aktuellen Browsern wird die Vorschau gezeichnet (die Anleitungs-Screenshots
   zeigen sie). Auf Diensthandys oder Vereinsrechnern mit älterem Browser, älterem iOS-Safari
   oder Android-WebView ist aber dasselbe Bild zu erwarten.
4. **Erwartung der Rolle:** Ein Tipp auf „Meldevordruck“ zeigt den Vordruck. Klappt das nicht,
   kommt ein Satz wie „Vorschau in diesem Browser nicht möglich – nutze die Tabelle oder lade die
   PDF herunter“.
5. **Auswirkung:** Der Teilnehmer sitzt am Funkgerät vor einem weißen Blatt. Er weiß nicht, ob er
   warten, neu laden oder den Ausbilder rufen soll. Die Übung stockt für ihn.
6. **Empfehlung:** Die nötige Browserfunktion vorher prüfen oder nachrüsten. Schlägt das
   Rendering fehl, eine sichtbare Meldung mit Ausweg zeigen (Tabelle, ZIP/PDF herunterladen).
7. **Verifikation:** Die Vorschau in einem Browser ohne `Map.prototype.getOrInsertComputed` öffnen
   (z. B. Chromium 141). Erwartet wird entweder ein gerenderter Vordruck oder ein verständlicher
   Hinweis, nie ein leerer Rahmen.

### P1-3 – Die Vorbelegung erzeugt eine Übung, die nicht zur eigenen Einheit passt

1. **Priorität:** P1
2. **Fundstelle / Aufgabe:** Generator `/`. Ein Erstnutzer füllt nur das Nötigste aus und klickt
   „Übung generieren“.
3. **Beobachtung:**
   - Unter „Funkspruch-Vorlagen auswählen“ sind alle elf Vorlagen vorausgewählt: THW (sechs),
     Feuerwehr, Sanitäts-/Betreuungsdienst, Wasserrettung, Rettungsdienst und „Lustige
     Funksprüche (Chat GPT)“ (`02-start-full.png`).
   - Die Teilnehmerliste enthält sieben Rufnamen als echte Feldwerte, nicht als Platzhalter
     („Heros Oldenburg 16/11“ … „Heros Wilhemshaven 21/10“, mit Tippfehler).
   - Der Name der Übung ändert sich bei jedem Laden zufällig („Funklinie Bravo“, „Tango
     Verbindung“, „Wellenbrecher“).
   - Die erzeugten Sprüche des ersten Teilnehmers mischen eine Feuerwehr-Lage („Brandgeruch im
     Hause … Feuerwehr auf dem Wege“) mit „MICKEY MAUS hat heute blaue Schuhe an“, „CHASE von der
     PAW PATROL“ und „GRAF DRACULA“ (`12-tn-mobil-full.png`).
4. **Erwartung der Rolle:** Die Vorbelegung ist ein neutraler, ernsthafter Startpunkt. Fremde
   Rufnamen stehen nur als Beispiel (grau) im Feld.
5. **Auswirkung:** Der Ausbilder verteilt Links an Rufnamen, die es in seiner Einheit nicht gibt,
   und Sprüche aus fremden Organisationen. Merkt er das erst am Dienstabend, muss er neu
   generieren und alle Links neu verteilen.
6. **Empfehlung:** Keine oder nur eine neutrale Vorlage vorauswählen, Spaßvorlagen nie.
   Beispiel-Rufnamen als Platzhalter oder mit dem Hinweis „Beispiel – bitte ersetzen“. Vor dem
   Generieren kurz zusammenfassen: „11 Vorlagen aus 5 Organisationen gewählt“.
7. **Verifikation:** Ein Testnutzer generiert ohne Anleitung eine Übung für seine Einheit. Danach
   wird geprüft, ob Rufnamen und Vorlagen wie beabsichtigt sind.

### P2-1 – Ein geteilter Teilnehmer-Link öffnet nur ein Formular

1. **Priorität:** P2
2. **Fundstelle / Aufgabe:** Teilnehmer öffnet den Link aus Mail oder Messenger
   (`#/teilnehmer?uc=…&tc=…`). Ebenso die Schnellzugangs-Box oben im Generator.
3. **Beobachtung:**
   - Der Link öffnet „Teilnehmer-Zugang – Bitte Übungscode und Teilnehmercode eingeben“. Beide
     Codes sind bereits eingetragen; erst ein weiterer Tipp auf „Zugang öffnen“ zeigt die Sprüche
     (`10-tn-kurzlink.png`, `src/teilnehmer/index.ts:71–76`).
   - Aus der Schnellzugangs-Box im Generator führt „Teilnehmer-Zugang öffnen“ zum selben Formular.
     Falsche Codes erzeugen dort zunächst keine Fehlermeldung (`04-falscher-code.png`). Erst der
     zweite Klick meldet „Kombination … nicht gefunden“ (`16-tn-zugang-falsch.png`).
   - Die Platzhalter „K7M4Q2“ und „A1B2“ sehen aus wie vorausgefüllte Codes.
4. **Erwartung der Rolle:** Link antippen, und die eigenen Sprüche erscheinen.
5. **Auswirkung:** Der Text „Bitte … eingeben“ passt nicht dazu, dass die Codes schon dastehen.
   Teilnehmer fragen nach („Muss ich da noch was eintippen?“), und der Ausbilder verliert in der
   Startphase Zeit.
6. **Empfehlung:** Sind beide Codes im Link, direkt öffnen. Das Formular nur bei fehlenden oder
   falschen Codes zeigen, dann mit Fehlermeldung. Platzhalter als „z. B. K7M4Q2“ kennzeichnen.
7. **Verifikation:** E2E: Ein Kurzlink mit gültigen Codes zeigt ohne Klick `#teilnehmerNachrichtenBody`.

### P2-2 – Dieselbe Sache heißt je nach Rolle anders, und Schaltflächen sehen aus wie Anzeigen

1. **Priorität:** P2
2. **Fundstelle / Aufgabe:** Teilnehmeransicht (Status-Chip) gegenüber Übungsleitung
   (`#uebungsleitungNachrichten`, `#uebungsleitungTeilnehmer`).
3. **Beobachtung:**
   - Der Teilnehmer markiert einen Spruch als „ÜBERTRAGEN“. Die Leitung markiert ihn als
     „✓ abgesetzt“ und filtert „Abgesetzt ausblenden“. In der Fortschrittsspalte steht
     „noch nichts übertragen“ (`13-tn-zeile-uebertragen.png`, `24-ul-nachrichtenplan.png`,
     `25-ul-nach-klick.png`).
   - Beim Teilnehmer ist der gelbe Chip „OFFEN“ selbst die Schaltfläche. Bei der Leitung ist
     derselbe gelbe „OFFEN“ nur eine Anzeige, und die Schaltfläche ist der grüne Knopf daneben.
   - „Anmelden“ in der Teilnehmertabelle der Leitung bedeutet „Teilnehmer hat sich im Funk
     angemeldet“. Es sieht aber aus wie ein Login. Nach dem Klick steht dort nur eine Uhrzeit
     (`041916oct26`) und kein Rückgängig (`26-ul-tn-nach-anmelden.png`).
4. **Erwartung der Rolle:** Dasselbe Wort für denselben Vorgang in allen Rollen. Was gleich
   aussieht, verhält sich gleich.
5. **Auswirkung:** In der Nachbesprechung zeigen „übertragen“ beim Teilnehmer und „abgesetzt“ bei
   der Leitung scheinbar zwei Zustände. Die Leitung tippt auf „OFFEN“ und es passiert nichts. Ein
   versehentliches „Anmelden“ lässt sich nicht erkennbar zurücknehmen.
6. **Empfehlung:** Einen Begriff festlegen (z. B. „abgesetzt“, wie im Funkbetrieb üblich – als
   Annahme). Schaltflächen und Statusanzeigen optisch klar trennen. „Anmelden“ als „Anmeldung
   erhalten“ beschriften und ein Rückgängig anbieten.
7. **Verifikation:** Ein Erstnutzer erklärt ohne Hilfe, was „OFFEN“, „abgesetzt“ und „Anmelden“ in
   beiden Ansichten bedeuten.

### P2-3 – „Lokale Daten löschen“ wirkt nicht nur lokal

1. **Priorität:** P2
2. **Fundstelle / Aufgabe:** Teilnehmer: `#btn-reset-teilnehmer-data` „Lokale Daten löschen“.
   Leitung: „⟲ Lokale Übungsdaten zurücksetzen“.
3. **Beobachtung:** Die Bestätigungsdialoge sagen das Gegenteil der Beschriftung:
   - Teilnehmer: „Möchten Sie wirklich Ihren Übertragungsstatus … zurücksetzen? Das wirkt auch für
     die Übungsleitung und Ihre anderen Geräte.“
   - Leitung: „Wirklich alle Daten der Übungsleitung zurücksetzen? Das wirkt auch für Teilnehmer
     und weitere Leitungs-Arbeitsplätze.“

   Auf dem Pixel 7 ragt der Teilnehmer-Knopf über den Kartenrand hinaus und ist nur angeschnitten
   zu sehen (x=320, Breite 92 bei 412 px Viewport). Die Dialoge siezen, der Rest der App duzt.
4. **Erwartung der Rolle:** „Lokal“ heißt „nur auf meinem Gerät“. Etwa um ein hängendes Handy zu
   „reparieren“.
5. **Auswirkung:** Wer den Dialog nicht genau liest, setzt den Stand der Leitung mitten in der
   Übung zurück. Das ist ein Ausbildungswerkzeug, es geht also um Übungsstand, nicht um
   Einsatzdaten.
6. **Empfehlung:** Die Beschriftung an die tatsächliche Wirkung anpassen („Meinen Status für alle
   zurücksetzen“). Den Knopf aus der Kopfzeile in einen weniger prominenten Bereich verschieben.
   Durchgängig duzen.
7. **Verifikation:** Beschriftung und Dialogtext stimmen inhaltlich überein. Auf 412 px Breite
   ist der Knopf vollständig sichtbar.

### P2-4 – Teilnehmeransicht auf dem Handy: Status abgeschnitten, Vordruck-Modus nur mit Tastatur

1. **Priorität:** P2
2. **Fundstelle / Aufgabe:** `#/teilnehmer/<id>/<tc>` auf dem Pixel 7.
3. **Beobachtung:**
   - In der Tabelle ist die Spalte „STATUS“ angeschnitten („STAT…“). Der Chip „OFFEN“ beginnt bei
     x=364 und ist 78 px breit, sein Ende liegt außerhalb des 412-px-Viewports. Die Spalte
     „LEITUNG“ ist nur über seitliches Wischen in der Tabelle erreichbar (`11-tn-mobil.png`).
   - Im Vordruck-Modal liegt die Titelzeile („Vordruck“, Schalter, ×) halb unter der fixierten
     App-Kopfzeile (`19-tn-meldevordruck-9s.png`).
   - Das Modal zeigt Tastenkürzel (Space, Ü, M, N, Esc), die es auf dem Handy nicht gibt.
     „Übertragen“ ist dort **nur** per Leertaste möglich: Sichtbar sind lediglich „Zurück“ und
     „Weiter“.
4. **Erwartung der Rolle:** Die wichtigste Handlung („erledigt“) liegt auf dem Handy immer
   sichtbar und antippbar im Blick.
5. **Auswirkung:** Der Teilnehmer erkennt den Status-Knopf nicht als solchen. Im Vordruck-Modus
   kann er nicht abhaken und muss in die Tabelle zurück.
6. **Empfehlung:** Auf schmalen Bildschirmen den Status als Teil der Zeile umbrechen statt in eine
   rechte Spalte. Im Modal eine Touch-Schaltfläche „Übertragen“ anbieten und die Tastenkürzel nur
   auf Geräten mit Tastatur zeigen. Das Modal unterhalb der Kopfzeile platzieren.
7. **Verifikation:** Auf 390–412 px Breite ist der Status-Knopf jeder Zeile ohne horizontales
   Wischen antippbar. Im Vordruck-Modal lässt sich ein Spruch per Tipp als übertragen markieren.

### P2-5 – Navigation passt nicht zur Rolle, und der Rückweg zur eigenen Übung ist unklar

1. **Priorität:** P2
2. **Fundstelle / Aufgabe:** Kopfnavigation in allen Rollen. Ergebnisbereich im Generator.
3. **Beobachtung:**
   - In der Teilnehmeransicht, der Übungsleitung und im Admin ist immer der Reiter „Übung
     erstellen“ markiert (`11-tn-mobil.png`, `22-ul.png`, `27-admin.png`).
   - Auf dem Handy gibt es zwei Menüs übereinander: das Hamburger-Menü oben rechts und die Zeile
     „☰ Menü“ mit allen Reitern (`03-start-mobil.png`).
   - „Gespeicherte Übungen“ (`#/admin`) taucht in der Navigation nicht auf.
   - Nach dem Generieren steht nirgends, dass man sich den Übungsleitungs-Link aufheben muss, um
     zurückzukommen.
4. **Erwartung der Rolle:** Ein Teilnehmer sieht, dass er „in seiner Übung“ ist. Der Ausbilder
   weiß, wie er nächste Woche wieder an seine Übung kommt.
5. **Auswirkung:** Teilnehmer tippen auf „Übung erstellen“ und landen im Generator. Ausbilder, die
   den Tab schließen, finden ihre Übung nicht wieder.
6. **Empfehlung:** In Teilnehmer- und Leitungsansicht einen eigenen aktiven Zustand zeigen
   (z. B. „Meine Übung“) oder die Erstell-Navigation zurücknehmen. Ein Menü auf dem Handy. Im
   Ergebnis ein Hinweis: „Speichere den Übungsleitungs-Link – darüber kommst du zurück.“
7. **Verifikation:** Erstnutzer schließt den Tab nach dem Generieren und findet ohne Hilfe
   zurück in die Übungsleitung.

### P2-6 – Der Generator setzt Fachbegriffe ohne Erklärung voraus

1. **Priorität:** P2
2. **Fundstelle / Aufgabe:** Generator `/`, Karten Kopfdaten, Einstellungen, Teilnehmerverwaltung
   und Statusleiste.
3. **Beobachtung:**
   - Ohne Erklärung am Feld stehen „Spiel-Modus: Klassisch / X-Zeit“, „Szenario (zusammenhängende
     Lage)“, „Führungsstellen-Übung (eine Stelle wird beübt)“, „Stellenname anzeigen“,
     „Automatische Ergänzung von Stärkemeldungen“ und „Spruch / Durchsage kennzeichnen“.
   - In der Statusleiste steht vor dem Generieren „Teilnehmer: 0“ und „Nachrichten: 0“, obwohl
     sieben Teilnehmer eingetragen sind. „Dauer (opt.)“ lässt offen, ob „optional“ oder
     „optimal“ gemeint ist (`02-start-full.png`, `05-nach-generieren.png`).
   - „Ergibt 1 Nachrichten“ ist grammatisch falsch.
   - Was die Seite überhaupt ist, steht erst unterhalb des Formulars („BOS-Sprechfunkübung online
     erstellen …“). Darüber steht die Code-Box für Teilnehmer, die mit dem Erstellen nichts zu tun
     hat.
4. **Erwartung der Rolle:** Kurzer Hilfetext oder ein (i) an jeder Option, die nicht
   selbsterklärend ist. Die Zusammenfassung zeigt den aktuellen Stand.
5. **Auswirkung:** Der Nutzer lässt Optionen aus Unsicherheit auf Standard oder probiert sie aus
   und generiert mehrfach. Die Zahl „0 Teilnehmer“ lässt ihn glauben, seine Eingaben seien nicht
   übernommen.
6. **Empfehlung:** Einzeilige Erklärungen unter X-Zeit, Szenario, Führungsstellen-Übung und
   Stellenname. Die Statusleiste live aktualisieren. „opt.“ ausschreiben. Einen Satz zum Zweck
   der Seite über das Formular setzen. Die Teilnehmer-Code-Box als klar getrennten Bereich „Du
   hast einen Code bekommen?“ kennzeichnen.
7. **Verifikation:** Ein Erstnutzer erklärt den Unterschied zwischen Klassisch und X-Zeit und
   zwischen Vorlagen und Szenario, ohne die Anleitung zu öffnen.

### P2-7 – Unklar, welcher Link aus der Linktabelle wofür ist

1. **Priorität:** P2
2. **Fundstelle / Aufgabe:** Ergebnis → Links (`#links-teilnehmer-container`).
3. **Beobachtung:**
   - Die ersten zwei Zeilen heißen „ÜBUNG – Allgemein“ (`#/generator/<id>`) und „ÜBUNGSLEITUNG –
     Allgemein“ (`#/uebungsleitung/<id>`, in der Anzeige gekürzt mit „…“) (`05-nach-generieren.png`).
     Dass „Übung“ den Bearbeitungsmodus öffnet und dort ein erneutes „Übung generieren“ die
     Nachrichten ersetzt, sieht man erst am Bestätigungsdialog („Übung neu generieren? Bestehende
     Nachrichten gehen verloren.“).
   - Bei den Teilnehmern steht der Kurzlink plus „Teilnehmer Code: NH3GHF / D29J“. Es fehlt der
     Satz „Diesen Link oder diese Codes an den Teilnehmer geben“.
4. **Erwartung der Rolle:** Jede Zeile sagt, wer den Link bekommt und was er damit tut.
5. **Auswirkung:** Der Ausbilder schickt womöglich den Bearbeitungslink an Teilnehmer oder
   verwendet ihn selbst statt der Überwachung.
6. **Empfehlung:** Statt „Allgemein“ zum Beispiel „Übung bearbeiten (nur für dich)“ und „Übung
   überwachen (für die Leitung)“. Bei Teilnehmern „an diese Funkstelle weitergeben“.
7. **Verifikation:** Ein Erstnutzer ordnet jeden Link ohne Klick dem richtigen Empfänger zu.

### P3-1 – Datumsangaben in drei Formaten, Uhr im Kopf ohne Erklärung

1. **Priorität:** P3
2. **Fundstelle:** Kopfzeile aller Seiten („041911oct26“), Teilnehmer/Leitung „Datum: 040000oct26“,
   Generator-Datumsfeld „10/04/2026“ (im Test mit `locale: de-DE`), Admin „4.10.2026“.
3. **Beobachtung:** Die Datum-Zeit-Gruppe steht ohne Beschriftung in der Kopfzeile. Das Datumsfeld
   zeigt im Testbrowser Monat/Tag. Ob das am Browser liegt oder an der Seite, ist nicht geklärt.
4. **Erwartung:** Entweder erkennbar „DTG“ beziehungsweise Uhrzeit oder überall TT.MM.JJJJ.
5. **Auswirkung:** Kurzes Stocken. „10/04“ kann als 10. April gelesen werden.
6. **Empfehlung:** DTG mit Beschriftung oder Tooltip versehen und das Datum einheitlich anzeigen.
7. **Verifikation:** Erstnutzer lesen das Übungsdatum korrekt ab.

### P3-2 – Kennzahlen der Übungsleitung ohne Bedeutung

1. **Priorität:** P3
2. **Fundstelle:** `#/uebungsleitung/<id>` (`22-ul.png`, `24-ul-nachrichtenplan.png`).
3. **Beobachtung:**
   - Unbeschriftete oder unerklärte Angaben: „Live-Status: live“, „Tempo: –“, „Funklast: S Heros
     Oldenburg 16/11 (1) | E Heros Wind 10 (1)“, „Heatmap 5m: 19:15=1“, „ETA: –“, „Debrief PDF“.
   - Die Stärke zeigt „Soll: 4/4/27/35“ und vier Felder mit „-“ ohne Spaltenbeschriftung.
   - In der Spalte „NR“ steht in vielen Zeilen „1“ untereinander, weil jeder Teilnehmer seine
     eigene Nummer 1 hat.
4. **Erwartung:** Deutsche, sprechende Begriffe. Zu den Stärkefeldern die Felder (*Annahme:*
   Führer/Unterführer/Helfer/Gesamt).
5. **Auswirkung:** Die Leitung ignoriert die Kennzahlen oder trägt die Ist-Stärke in die falsche
   Spalte ein.
6. **Empfehlung:** Begriffe ausschreiben oder mit Tooltip versehen, die Stärkefelder beschriften,
   die Nummer als „Nr. je Teilnehmer“ kennzeichnen.
7. **Verifikation:** Ein Erstnutzer trägt eine gemeldete Stärke richtig ein.

### P3-3 – Kleinigkeiten: Symbol-Knöpfe und doppelter Titel

1. **Priorität:** P3
2. **Fundstelle:** Admin „Gespeicherte Übungen“, Teilnehmer-Kopfzeile.
3. **Beobachtung:**
   - Die Aktionen im Admin sind nur Symbole (Lupe, Monitor, Mülleimer). Ihre Bedeutung steht nur
     im `title` („Übung öffnen“, „Übung überwachen“), auf Touchgeräten also nicht sichtbar
     (`27-admin.png`).
   - Die Teilnehmer-Kopfzeile lautet „Sprechfunkübung: Sprechfunkübung Wellenbrecher 2026“.
   - Beim Leitungs-Link fehlt ein Rückgängig für „Anmelden“ (siehe P2-2).
4. **Erwartung:** Text an den Knöpfen, kein doppeltes Wort.
5. **Auswirkung:** Gering. Lupe und Monitor werden verwechselt.
6. **Empfehlung:** Kurze Textlabels („Öffnen“, „Überwachen“, „Löschen“). Das Präfix nur setzen,
   wenn der Name es nicht schon enthält.
7. **Verifikation:** Sichtprüfung.

## Nicht geprüft / Grenzen

- Die Live-Synchronisation zwischen echten Geräten ist nicht geprüft. Teilnehmer- und
  Leitungskontext hatten getrennte Mock-Speicher, deshalb zeigte die Leitung „keine Meldung“.
- Der X-Zeit-Modus und das Cockpit wurden nicht durchgespielt, die Modi Szenario und
  Führungsstellen-Übung nur von der Beschriftung her bewertet.
- Download von ZIP und PDF ist nicht inhaltlich geprüft.
- Bei P1-2 ist die Darstellung in aktuellen Browsern nicht geprüft (nur Chromium 141 verfügbar).

## Abschluss

- **Aufgabe geschafft:** mit Umwegen. Übung anlegen und Links verteilen klappt. Eine für die
  eigene Einheit brauchbare Übung entsteht nur, wenn man die Vorbelegung bemerkt und korrigiert.
- **Fremde Hilfe nötig:** nein für den Grundablauf; ja für X-Zeit, Szenario, Stärke-Erfassung und
  das Zurückfinden zur Übung.
- **Größtes Missverständnis:** „Lokale Daten löschen“ klingt nach „nur mein Gerät“, setzt aber den
  Stand für Übungsleitung und alle Geräte zurück.
- **Größtes Einsatzrisiko:** Ein Erstnutzer generiert mit der Vorbelegung und verteilt Links an
  fremde Beispiel-Rufnamen mit gemischten Organisations- und Spaßsprüchen. Das fällt erst am
  Dienstabend auf und erzwingt dann Neugenerieren und Neuverteilen.
- **Top-Priorität für die nächste Iteration:** Die Vorbelegung des Generators entschärfen (keine
  Spaßvorlage, keine Organisationsmischung, Beispiel-Rufnamen nur als Platzhalter). Direkt danach
  das tote Inhaltsverzeichnis entfernen.
