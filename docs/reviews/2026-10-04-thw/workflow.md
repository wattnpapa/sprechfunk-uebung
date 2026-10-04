# THW-Workflow-Review – Sprechfunk Übungsgenerator

- **Datum:** 2026-10-04
- **Perspektive:** Helfer, der eine Sprechfunkübung vom Anlegen bis zur Nachbesprechung komplett durchziehen will (Skill `thw-workflow-reviewer`)
- **Umgebung:** lokaler Build unter `http://127.0.0.1:3000`, Mock-Firestore (localStorage), Chromium 141 (Playwright), Desktop 1440×1000 und Mobil 412×915 (Touch)
- **Screenshots:** `scratchpad/workflow/*.png` (Dateinamen im Befund genannt)
- **Rahmen:** Die App ist ein Ausbildungswerkzeug für Dienstabende, kein Einsatzsystem. „Einsatz“ meint hier den Übungsabend mit 3–10 Sprechern und einer Übungsleitung unter Zeitdruck.

## Erwartete Arbeitsfolge (Soll aus Nutzersicht)

> Annahme: So läuft ein Funk-Dienstabend in einem OV oder einer Wache ab. Eine verbindliche THW-Vorgabe dafür gibt es nicht.

1. **Vorbereiten (Tage vorher, Desktop):** Kopfdaten, Teilnehmer und Funkrufnamen festlegen, Inhalte wählen, Übung erzeugen.
2. **Verteilen:** Je Sprecher einen Zugang (Link, Code oder Papier) ausgeben, dazu Druckdaten für die Papier-Rückfallebene. Den eigenen Leitungs-Zugang sichern.
3. **Durchführen (Teilnehmer, Handy):** Funkspruch absetzen, als übertragen markieren, eingehende Sprüche mitschreiben.
4. **Überwachen (Übungsleitung, Laptop):** Anmeldungen, Fortschritt, Lösungswort und Stärke prüfen, Notizen machen.
5. **Auswerten:** Je Teilnehmer ein Debriefing, das den tatsächlichen Verlauf zeigt.
6. **Führungsstellen-Variante:** Die Rollenspieler (EA, Stab) spielen nach Drehbuch und gemeinsamer X-Zeit ein, die beübte Stelle arbeitet. Die Übungsleitung vergleicht mit der „Erwartung“.

## Durchgeführte Abläufe

| # | Ablauf | Ergebnis |
|---|---|---|
| A | Generator klassisch: 3 Teilnehmer, 8 Sprüche, zentrales Lösungswort „FUNKER“, Vorlage THW Leer → generieren → ZIP und Sammel-PDF herunterladen → Seite neu laden | erfolgreich, ZIP 31 MB / 34 Dateien |
| B | Teilnehmer mobil: Kurzlink `?uc=&tc=` → „Zugang öffnen“ → 2 Sprüche als übertragen markieren → Vordruck-Ansicht → Reload | Status bleibt erhalten, **Vordruck bleibt leer** |
| C | Übungsleitung parallel: Teilnehmer-Meldung live sehen, „Anmelden“, „✓ abgesetzt“, Notiz, Debrief-PDF, Leitungs-PDF, Reload | funktioniert, Debriefing unvollständig (siehe F3) |
| D | Admin-Liste → Übung öffnen → Werte ändern → **neu generieren** → Teilnehmer- und Leitungssicht prüfen | Codes bleiben gleich, Inhalte und Status passen nicht mehr zusammen (siehe F1) |
| E | Führungsstellen-Übung „Hochwasser“: Rollen eintragen, Übungsbeginn 19:30 → generieren → Drehbuch-PDF → Leitungs-Cockpit → Rollenspieler-Sicht (EA 1, Stab), X-Zeit starten | erfolgreich erzeugt, X-Zeit nicht gemeinsam (siehe F2) |

## Kurzurteil

Mit dem Durchgang über Generator, Links, Teilnehmer, Übungsleitung und Debriefing kommt man **ohne fremde Hilfe ans Ziel**. Die einzelnen Bildschirme sind ordentlich, und der Live-Abgleich vom Teilnehmer zur Leitung funktioniert sichtbar: „GEMELDET“, Fortschritt 1/8, `24-ul-after-tn-toggle.png`. Reibung entsteht an den **Übergängen**:

- Eine schon verteilte Übung lässt sich unter denselben Codes neu würfeln. Danach hängen die Status an anderen Sprüchen.
- Im X-Zeit- und Führungsstellen-Modus gibt es keine gemeinsame Uhr. Den Übungsbeginn trägt man im Generator ein, wirksam wird er aber nirgends.
- Teilnehmer („übertragen“) und Leitung („abgesetzt“) führen zwei getrennte Status. Das Debriefing kennt nur den der Leitung.
- Die Vordruck-Vorschau bleibt auf einem 1 Jahr alten Chromium kommentarlos weiß.
- Papier und Digital sind nicht verbunden: Auf den Ausdrucken stehen weder Code noch Link.

---

## Befunde

### F1 – P1 – Neu generieren überschreibt eine schon verteilte Übung unter denselben Codes; Status zeigen danach auf andere Sprüche

1. **Priorität:** P1
2. **Fundstelle / Aufgabe:** Generator-Ergebnis, Link-Typ „ÜBUNG – Allgemein“ (`#/generator/<id>`, mit „Mail“-Knopf) und Admin → Lupe → erneut „Übung generieren“
3. **Beobachtung:**
   - Ablauf D: Die Übung lief schon. Teilnehmer 21/11 hatte Spruch 1 bestätigt und Spruch 3 gemeldet, Lösungswort-Soll war „FUNKER“. Danach habe ich sie über `#/generator/<id>` geöffnet und „Sprüche pro Teilnehmer“ auf 6 gesetzt. Es kam nur die Rückfrage „Übung neu generieren? Bestehende Nachrichten gehen verloren.“
   - Nach OK bleiben **alle Links und Codes gleich** (`762Y76 / 7HNC …`). Die Spruchtexte sind komplett neu.
   - Die Leitung zeigt weiter „1 / 6 zuletzt 041914oct26“ und die alten „ABGESETZT“-Stempel. Diese Status gehören jetzt zu anderen Texten.
   - Das Lösungswort-Soll ist plötzlich „AUSFALLSICHERHEIT“, nicht mehr „FUNKER“. Die Einstellung „zentral“ wurde beim Öffnen per ID nicht übernommen.
   - Auch im Führungsstellen-Lauf (E) erzeugt ein zweiter Klick auf „Übung generieren“ dieselbe ID neu (`43-fs-result.png`).
4. **Erwartung der Rolle:** Eine verteilte Übung mit gedruckten Vordrucken ist „eingefroren“. Wer etwas ändert, bekommt eine **neue** Übung mit neuen Codes oder wird klar gewarnt: „Gedruckte Unterlagen und verteilte Links passen danach nicht mehr, bisherige Status werden zurückgesetzt.“
5. **Auswirkung im Einsatz:**
   - Die Papiervordrucke der Teilnehmer zeigen andere Texte als ihre Handys und die Leitung.
   - Status und Debriefing verweisen auf falsche Sprüche.
   - Typischer Auslöser: Der Ausbilder „korrigiert nur schnell den Namen“ am Abend selbst.
   - Der „ÜBUNG“-Link wird mit Mail-Knopf angeboten, landet also leicht bei Dritten, die dann ebenfalls neu generieren können.
6. **Empfehlung:**
   - Das Neu-Generieren einer Übung mit vorhandenen Status oder Ausdrucken als eigenständige Aktion „Als neue Übung speichern“ anbieten, mit neuen Codes.
   - Alternativ die Status beim Überschreiben sichtbar zurücksetzen und den Dialog konkret formulieren.
   - Den Bearbeiten-Link als solchen benennen („Bearbeiten – nicht an Teilnehmer geben“).
   - Die Lösungswort-Einstellung beim Öffnen per ID wiederherstellen.
7. **Verifikation:** Ablauf D wiederholen. Danach haben entweder alle Teilnehmer neue Codes oder Leitung und Teilnehmer zeigen 0/n und keine alten Stempel, und das Lösungswort-Soll bleibt „FUNKER“.

### F2 – P1 – Keine gemeinsame X-Zeit in der Führungsstellen-Übung; der Übungsbeginn aus dem Generator wirkt nirgends

1. **Priorität:** P1
2. **Fundstelle / Aufgabe:** Generator `#fuehrungsstelleBeginn` → Leitungs-Cockpit `#uebungsleitungCockpit` → Rollenspieler-Sicht `#xZeitBanner`
3. **Beobachtung:**
   - Im Generator habe ich „Übungsbeginn 19:30“ eingetragen. Das Drehbuch-PDF druckt „Übungsbeginn: 19:30 Uhr“.
   - Das Leitungs-Cockpit zeigt trotzdem „Noch keine X-Zeit-Basis – ‚Jetzt starten‘ oder auf Teilnehmer warten“ (`44-fs-ul-top.png`).
   - EA 1 drückt in seiner Sicht „Jetzt starten“. Die Leitung übernimmt das („Basis 19:18 aus Teilnehmer-Meldung übernommen“).
   - Danach setzt die Leitung selbst „Jetzt starten“. Der Rollenspieler „Führungsstab“ (Kater Oldenburg) sieht auch nach Reload weiter ein leeres Feld „X-Zeit: Jetzt starten“.
   - Im Code (`src/teilnehmer/index.ts:180`) bezieht die Teilnehmersicht von der Leitung nur Bestätigungen, keine X-Zeit-Basis.
4. **Erwartung der Rolle:** Die Übungsleitung sagt einmal „X-Zeit läuft“, und alle Einspieler sehen dieselbe Uhr. Ein vorab geplanter Beginn (19:30) gilt automatisch.
5. **Auswirkung im Einsatz:**
   - Jeder Rollenspieler muss selbst „Jetzt starten“ drücken. Die Uhren laufen deshalb um Sekunden bis Minuten auseinander.
   - Wer es vergisst, sieht keinen Countdown.
   - Das Drehbuch-Timing, z. B. „Lagemeldung alle 30 Minuten“ oder abgestimmte Einspielungen von Stab und EA, gerät aus dem Takt.
   - Die Leitung sieht nicht, welche Rolle mit welcher Basis läuft.
   - Es entsteht doppelte Eingabe an drei Stellen: Generator, Cockpit und jede Rolle.
6. **Empfehlung:**
   - Eine einzige, von der Leitung gesetzte X-Zeit-Basis an alle Rollen verteilen. Der geplante Übungsbeginn aus dem Generator ist der Vorschlag dafür.
   - In der Rollenansicht anzeigen, ob und von wem die Basis gesetzt wurde.
   - Den Start durch einen Rollenspieler nur mit Rückfrage oder gar nicht erlauben.
7. **Verifikation:** Die Leitung setzt die Basis. Jede geöffnete Rollen-Sicht (auch eine nachträglich geöffnete) zeigt dieselbe Basis und denselben nächsten Termin, ohne eigenes Zutun.

### F3 – P1 – Zwei getrennte Statuswelten (Teilnehmer „übertragen“ und Leitung „abgesetzt“); das Debriefing zeigt nur die der Leitung

1. **Priorität:** P1
2. **Fundstelle / Aufgabe:**
   - Teilnehmer `.btn-toggle-uebertragen-chip`
   - Leitung `#uebungsleitungNachrichten [data-action=abgesetzt]` und Teilnehmertabelle `[data-action=anmelden]`
   - Debrief-PDF
3. **Beobachtung:**
   - Teilnehmer 21/11 meldet Spruch 3 als übertragen. Die Leitung zeigt „GEMELDET – Teilnehmer: 041914oct26“, daneben aber weiter den Knopf „✓ abgesetzt“ (`25-ul-after-actions.png`).
   - Im **Debrief-PDF** steht Spruch 3 als **„offen“**. Gezählt wird nur, was die Leitung angeklickt hat.
   - Umgekehrt: Die Leitung bestätigt Spruch 1, beim Teilnehmer steht „OFFEN“ und in der Spalte Leitung „bestätigt“. Das widerspricht sich.
   - Dazu kommt: Wenn die Leitung den Anmelde-Funkspruch von 22/12 auf „abgesetzt“ setzt, steht in der Spalte „Angemeldet“ weiter der Knopf „Anmelden“. Die Anmeldung muss also zweimal gepflegt werden.
4. **Erwartung der Rolle:**
   - Leitung: Eine Meldung des Teilnehmers ist ein Vorschlag, den ich mit einem Klick übernehme. Das Debriefing zeigt beides, „vom Teilnehmer gemeldet“ und „von der Leitung bestätigt“.
   - Der abgesetzte Anmelde-Funkspruch gilt als Anmeldung.
5. **Auswirkung im Einsatz:**
   - Bei 3 Teilnehmern × 8 Sprüchen sind das 24 Klicks, die die Leitung **zusätzlich** zum Mithören machen muss. Bei üblichen 7 × 10 sind es 70.
   - Wer nicht nachklickt, bekommt ein Debriefing voller „offen“, obwohl die Teilnehmer gemeldet haben. Die Nachbesprechung baut dann auf falschen Zahlen auf.
6. **Empfehlung:**
   - Im Debriefing beide Spalten ausgeben: „gemeldet“ (Teilnehmer) und „bestätigt“ (Leitung).
   - In der Leitung eine Sammelaktion „gemeldete übernehmen“ anbieten.
   - Die Anmeldung aus dem abgesetzten Anmelde-Funkspruch ableiten oder umgekehrt.
   - Beim Teilnehmer „bestätigt“ und „OFFEN“ nicht gegeneinander zeigen.
7. **Verifikation:** Der Teilnehmer meldet 3 Sprüche, die Leitung klickt nichts. Das Debrief-PDF weist diese 3 als „gemeldet“ aus. Bestätigt die Leitung den Anmelde-Funkspruch, steht der Teilnehmer als angemeldet.

### F4 – P1 – Vordruck-Vorschau bleibt auf etwas älteren Browsern leer, ohne jede Meldung

1. **Priorität:** P1
2. **Fundstelle / Aufgabe:** Teilnehmer → „Meldevordruck“ oder „Nachrichtenvordruck“ (`#teilnehmerDocModal`), mobil und Desktop
3. **Beobachtung:**
   - Die Canvas bleibt auch nach 8 s weiß, die Seitenanzeige `#teilnehmerDocPage` leer (`16-tn-meldevordruck.png`, `22-tn-desktop-nachrichtenvordruck.png`, `28-tn-vordruck-wait.png`).
   - Konsole: `PAGEERR this[#Yr].getOrInsertComputed is not a function`.
   - Ursache: `pdfjs-dist` 6.3 (`package.json:123`) nutzt `Map.prototype.getOrInsertComputed`, das Chromium 141 (Stand Herbst 2025) nicht kennt.
   - `renderPdfPage` (`src/teilnehmer/TeilnehmerView.ts:765 ff.`) fängt den Fehler nicht ab. Es erscheint kein Hinweis und keine Ausweichmöglichkeit.
4. **Erwartung der Rolle:** Entweder sehe ich den Vordruck, oder ich bekomme den Hinweis „Vorschau nicht verfügbar – Tabelle nutzen / PDF herunterladen“.
5. **Auswirkung im Einsatz:**
   - Teilnehmer mit älterem Handy (Annahme: z. B. iPhones, die kein aktuelles iOS mehr bekommen, oder verwaltete Dienst-Rechner) sehen ein leeres Formular.
   - Ein Fehler ist nicht erkennbar. Der Teilnehmer hält die Übung für kaputt, und die Leitung muss am Abend Fehlersuche betreiben.
   - Hinweis: Auf aktuellen Browsern ist das vermutlich unauffällig. Das Risiko hängt vom Gerätebestand ab.
6. **Empfehlung:**
   - Die Vorschau auf Browsern ohne diese Funktion zum Laufen bringen.
   - Mindestens einen sichtbaren Fehlerhinweis mit Verweis auf Tabelle bzw. PDF-Download zeigen.
   - In der CI einen älteren Browser mitprüfen.
7. **Verifikation:** Den Vordruck in Chromium 141 und Safari (iOS 18) öffnen. Entweder rendert er, oder ein klarer Hinweis samt Ausweg erscheint.

### F5 – P2 – Papier und Digital sind nicht verbunden: Auf den Ausdrucken fehlen Zugangscodes, auf dem Leitungs-PDF der Weg zurück

1. **Priorität:** P2
2. **Fundstelle / Aufgabe:** ZIP → `Teilnehmer/<Name>/Übersicht_*.pdf` und `Uebungsleitung.pdf`, Generator nach Reload (`05-generator-after-reload.png`)
3. **Beobachtung:**
   - Die Teilnehmer-Übersichten enthalten Kopfdaten und Spruchliste, aber **keinen Übungs- und Teilnehmercode, keinen Link, keinen QR-Code** (per `pdftotext` geprüft).
   - Das Leitungs-PDF nennt nur die Übungs-ID im Fußtext, keinen Übungscode und keinen Leitungs-Link.
   - Nach Reload ist das Generator-Ergebnis mit allen Links weg (URL `/`).
   - Zurück zur eigenen Übung führt nur die öffentliche Admin-Liste aller Übungen (`30-admin.png`) oder ein vorher gesicherter Link.
4. **Erwartung der Rolle:**
   - Teilnehmer: Auf meinem Zettel steht, wie ich digital mitmache, z. B. als QR-Code.
   - Leitung: Mein ausgedrucktes Leitungsblatt bringt mich zurück in die Überwachung.
5. **Auswirkung im Einsatz:**
   - Beim Dienstabend werden Codes mündlich oder per Messenger weitergegeben. Dabei gehen Zahlendreher durch (Codes wie `7HNC` / `25LY`).
   - Schließt der Ausbilder den Tab nach dem Generieren, sucht er seine Übung in einer Liste fremder Übungen.
6. **Empfehlung:**
   - Teilnehmercode und QR-Link auf die Teilnehmer-Übersicht und die Vordrucke drucken.
   - Übungscode und Leitungs-Link auf das Leitungs-PDF drucken.
   - Die zuletzt erzeugten eigenen Übungen lokal merken und anbieten.
7. **Verifikation:** Einen Ausdruck mit dem Handy scannen, man landet direkt in der eigenen Teilnehmersicht. Nach einem Reload findet der Generator die eben erzeugte Übung ohne Admin-Liste.

### F6 – P2 – Mobile Vordruck-Ansicht: „Übertragen“ geht nur per Leertaste

1. **Priorität:** P2
2. **Fundstelle / Aufgabe:** Teilnehmer mobil → Meldevordruck (`16-tn-meldevordruck.png`, Markup `src/teilnehmer/TeilnehmerView.ts:239-273`)
3. **Beobachtung:**
   - Im Modal gibt es Zurück, Weiter und Schließen sowie eine Legende „Space – Übertragen“. Einen Touch-Knopf zum Markieren gibt es nicht.
   - Auf dem Handy liegt der App-Kopf über der Modal-Kopfzeile. Titel und Schalter „Übertragene ausblenden“ sind halb verdeckt.
   - Die Legende listet Tastenkürzel, die es auf dem Handy nicht gibt.
4. **Erwartung der Rolle:** Spruch im Vordruck ansehen, abgeben und gleich „übertragen“ tippen, dann weiter zum nächsten.
5. **Auswirkung im Einsatz:**
   - Für jeden Spruch: Vordruck schließen, Zeile in der Tabelle suchen (die Statusspalte ist abgeschnitten, F10), tippen, Vordruck wieder öffnen.
   - Der Kontext geht bei jedem Spruch verloren, und Sprüche werden leicht doppelt oder gar nicht markiert.
6. **Empfehlung:**
   - Im Vordruck einen großen Knopf „Übertragen“ / „Zurück auf offen“ mit aktuellem Status zeigen.
   - Die Tastenlegende nur auf Geräten mit Tastatur zeigen.
   - Das Modal unterhalb des App-Kopfs beginnen lassen.
7. **Verifikation:** Auf 412 px Breite 5 Sprüche nacheinander nur in der Vordruck-Ansicht als übertragen markieren, ohne das Modal zu schließen.

### F7 – P2 – Platzhalter und Beispielwerte gehen ohne Rückfrage in die Übung

1. **Priorität:** P2
2. **Fundstelle / Aufgabe:** Generator klassisch und Führungsstellen-Formular (`40-fs-form-initial.png`, `41-fs-empty-generate.png`)
3. **Beobachtung:**
   - Der Generator ist vorbelegt:
     - Name: zufällig „Sprechfunkübung Funknetz Gamma 2026“ oder „… Verbindung Titan 2026“
     - 7 Teilnehmer „Heros Oldenburg …“
     - alle 11 Vorlagen, inklusive `vorlageLustig` und aller Organisationen gemischt
     - 30 % an Mehrere, 50 % Buchstabier-Aufgaben
   - Im Führungsstellen-Modus sind beübte Stelle, Stab und EAs mit „Heros Musterstadt …“ / „Kater Musterstadt“ vorbelegt. Die Werte sehen aus wie Platzhalter, sind aber echte Feldinhalte.
   - Ein Klick auf „Übung generieren“ ohne jede Eingabe erzeugt sofort eine Übung mit diesen Werten.
   - Im Lauf E stehen deshalb in den Links „Heros Musterstadt 21/10 / Einsatzabschnitt 1“ neben meinen eigenen „Heros Oldenburg 10“.
4. **Erwartung der Rolle:** Beispielwerte sind als Beispiel erkennbar (grau oder Platzhalter), und vor dem Erzeugen kommt eine Zusammenfassung: „Du verwendest noch Beispiel-Funkrufnamen“.
5. **Auswirkung im Einsatz:** Die gedruckten Vordrucke tragen fremde oder erfundene Funkrufnamen („Musterstadt“) oder unpassende Vorlagen, z. B. Rettungsdienst-MANV für eine THW-Gruppe. Bemerkt wird das oft erst beim Ausdrucken oder am Abend selbst, und dann folgt F1.
6. **Empfehlung:**
   - Beispielwerte als Platzhalter statt als Feldinhalt setzen.
   - Vor dem Generieren unveränderte Beispielwerte und die gewählten Vorlagen in einer kurzen Prüfliste zeigen.
   - Die Vorlagen-Vorauswahl auf eine Organisation begrenzen.
7. **Verifikation:** Auf einem frischen Profil sofort „Übung generieren“ drücken. Es erscheint ein Hinweis auf Beispielwerte, statt dass still eine Übung entsteht.

### F8 – P2 – Führungsstellen-Übung: Kein eigenes Ausgabeblatt für die beübte Stelle; „Ausdruck“ und „E-Mail“ als Weg ohne erkennbare Übergabe

1. **Priorität:** P2 (teilweise Annahme)
2. **Fundstelle / Aufgabe:** Drehbuch-PDF (16 Seiten), ZIP-Inhalt (`src/services/pdfZipService.ts:40-43`), Leitungs-Nachrichtenplan mit Wegen „Funk / Ausdruck / E-Mail“ (`50-fs-ul-plan.png`)
3. **Beobachtung:**
   - Lage und „Auftrag der beübten Führungsstelle“ stehen nur im Drehbuch, gemischt mit Rollentabelle und den „Erwartet:“-Texten. Die beübte Stelle darf das Drehbuch laut Rollentabelle nicht kennen.
   - Ein separates Blatt nur mit Lage und Auftrag ist im ZIP nicht enthalten.
   - Für Einspielungen mit Weg „Ausdruck“ oder „E-Mail“ zeigt der Plan nicht, welches Dokument der Rollenspieler übergeben soll. Annahme: Gemeint ist der Nachrichtenvordruck aus dem ZIP. Das ist nicht beschriftet.
4. **Erwartung der Rolle:** Die Leitung druckt ein Blatt „Ausgangslage und Auftrag“ für die beübte Stelle und hat für jede Ausdruck- oder Mail-Einspielung ein fertiges Übergabedokument.
5. **Auswirkung im Einsatz:** Die Leitung muss Lage und Auftrag aus dem Drehbuch abschreiben oder die Seiten zerschneiden. Dabei rutschen die „Erwartet“-Texte leicht mit hinüber, und die Übung ist verraten.
6. **Empfehlung:**
   - Ein eigenes PDF „Ausgangslage für die beübte Stelle“ ohne Erwartungen ins ZIP legen.
   - Bei Ausdruck- und Mail-Einspielungen auf das konkrete Dokument im ZIP verweisen.
7. **Verifikation:** Im ZIP einer Führungsstellen-Übung liegt ein Blatt ohne die Wörter „Erwartet“ und „Drehbuch“. Jede Ausdruck-Zeile im Plan nennt ihre Datei.

### F9 – P3 – Kleinere Brüche in der Ablaufführung

1. **Priorität:** P3
2. **Fundstelle / Aufgabe / Beobachtung:**
   - **Statusleiste veraltet:** Vor dem ersten Generieren zeigt sie „Teilnehmer: 0 · Nachrichten: 0 · Lösungswörter: Keine“, obwohl 3 Teilnehmer und ein zentrales Lösungswort eingestellt sind (`02-generator-filled.png`). Sie aktualisiert sich erst nach dem Generieren.
   - **Dauerangabe widersprüchlich:** Bei der Führungsstellen-Übung nennt die Statusleiste „Dauer (opt.): 428 Min“, Drehbuch und Info „180 Minuten“.
   - **Kurzlink braucht Extraklick:** `#/teilnehmer?uc=…&tc=…` füllt die Codes nur vor, der Teilnehmer muss noch „Zugang öffnen“ tippen (`10-tn-shortlink.png`).
   - **Navigation:** In Teilnehmer- und Leitungssicht ist „Übung erstellen“ als aktiver Menüpunkt hervorgehoben. Das kann zu einem versehentlichen Wechsel in den Generator verleiten.
   - **Beübte Stelle im Leitungs-Plan:** Die beübte Stelle steht mit Teilnehmercode „7TXH“ und Knopf „Anmelden“ in der Teilnehmertabelle, obwohl der Generator sagt, sie erhalte keinen Zugang (`44-fs-ul-top.png`).
   - **Nummerierung im Führungsstellen-Plan:** Die Nr. gilt je Absender, sortiert wird nach X-Zeit. Beim Empfänger erscheinen Nr. 9, 11, 10, 10 hintereinander (`50-fs-ul-plan.png`).
   - **ZIP:** 31 MB und 34 Dateien für 3 Teilnehmer (A4, A5, Nadeldrucker, Einzel- und Sammeldateien). Zum Mailen an Teilnehmer ist das zu groß, und welches Paket man drucken soll, steht nirgends.
3. **Erwartung der Rolle:** Die Zusammenfassung stimmt vor dem Klick. Ein Link führt direkt in die Übung. Die Druckdaten sind nach Zweck sortiert („zum Ausdrucken für den Abend: diese Datei“).
4. **Auswirkung im Einsatz:** Jeweils kleine Unsicherheiten und Zusatzschritte, kein Abbruch.
5. **Empfehlung:**
   - Statusleiste live aus dem Formular berechnen.
   - Für die Führungsstellen-Übung die Drehbuchdauer anzeigen.
   - Den Kurzlink bei gültigen Codes direkt öffnen.
   - Den Navigationszustand rollenabhängig setzen.
   - Die beübte Stelle in der Leitung als „beübt“ kennzeichnen statt mit Code und „Anmelden“.
   - Das ZIP mit einer Liesmich-Datei oder nach Zweck gliedern.
6. **Verifikation:** Je Punkt eine Sichtprüfung im Durchlauf A und E.

### F10 – P3 – Teilnehmertabelle auf dem Handy: Statusknopf und „Lokale Daten löschen“ angeschnitten

1. **Priorität:** P3 (Detailbewertung den Mobil- und Handschuh-Reviews überlassen)
2. **Fundstelle / Aufgabe:** Teilnehmer 412 px (`12-tn-mobile-top.png`, `13-tn-mobile-full.png`)
3. **Beobachtung:**
   - Die Tabelle ist 635 px breit. Der Status-Chip beginnt bei x = 338 und ist am Rand abgeschnitten („OFFE…“).
   - Die Spalte „Leitung“ (Bestätigung) ist nur mit seitlichem Wischen sichtbar.
   - Der Knopf „Lokale Daten löschen“ liegt bei x = 403–495 und damit größtenteils außerhalb.
4. **Erwartung der Rolle:** Die Kernaktion „übertragen“ ist je Spruch voll sichtbar, die Leitungsbestätigung ebenso.
5. **Auswirkung im Einsatz:** Der Teilnehmer sieht nicht, dass die Leitung bestätigt hat, und tippt neben den Knopf.
6. **Empfehlung:** Den Spruch auf dem Handy als Karte zeigen, mit Status und Bestätigung unter dem Text.
7. **Verifikation:** Auf 360–412 px kein horizontales Scrollen in der Spruchliste, Status-Chip vollständig sichtbar.

---

## Nicht prüfbar / Hinweise

- **Geräteübergreifende Fortsetzung der Leitung:** Laut Code (`src/uebungsleitung/index.ts:274-313`, `subscribeLeitungInternal`) wird der Leitungsstand über Firestore gespiegelt. Im Mock-Modus (localStorage je Browser-Kontext) ließ sich das nicht mit zwei Geräten prüfen.
- **Offline-Verhalten** und **Löschen über die öffentliche Admin-Liste** gehören zu den Reviews `offline-resilience` und `destructive-action`. Die Admin-Liste mit Lösch-Knopf je fremder Übung ist laut `firestore.rules` ein bewusst akzeptiertes Restrisiko. Für den Ablauf heißt das trotzdem: Eine laufende Übung kann von Dritten entfernt werden.
- Die Spruchinhalte stammen aus der Vorlage („ParkhausNach“ ohne Leerzeichen) und wurden fachlich nicht bewertet.

## Abschluss

- **Aufgabe geschafft:** mit Umwegen. Die klassische Übung läuft vom Anlegen bis zum Debrief. Die Führungsstellen-Übung lässt sich erzeugen und überwachen, die gemeinsame X-Zeit aber nur über Absprache.
- **Fremde Hilfe nötig:** nein
- **Größtes Missverständnis:** Teilnehmer und Leitung glauben beide, den Status „ihres“ Spruchs gepflegt zu haben. Im Debriefing zählt aber nur der Klick der Leitung.
- **Größtes Einsatzrisiko:** Wer eine bereits verteilte Übung neu generiert, behält dieselben Codes. Papier, Handys und Leitungsstatus zeigen danach unbemerkt verschiedene Inhalte.
- **Top-Priorität für die nächste Iteration:** Das Neu-Generieren einer verteilten Übung verhindern oder als neue Übung mit neuen Codes anlegen (F1). Direkt danach eine von der Leitung gesetzte gemeinsame X-Zeit-Basis für alle Rollen (F2).
