Befunde: P0=0 P1=0 P2=4 P3=5
Abgleich: behoben=6 teilweise=4 offen=0 nicht-pruefbar=0

# THW-Workflow-Review (zweiter Lauf) – Sprechfunk Übungsgenerator

- **Datum:** 2026-10-05
- **Perspektive:** Helfer, der eine Sprechfunkübung vom Anlegen bis zur Nachbesprechung komplett durchziehen will (Skill `thw-workflow-reviewer`)
- **Umgebung:** lokaler Build unter `http://127.0.0.1:3000`, Mock-Firestore (localStorage), Chromium 141 (`/opt/pw-browsers/chromium-1194`), Desktop 1440×1000, Mobil 412×915 und `devices["Pixel 7"]` (Touch)
- **Screenshots:** `scratchpad/workflow/*.png` (Dateinamen im Befund genannt), heruntergeladene PDFs/ZIPs als `scratchpad/workflow/dl-*`
- **Rahmen:** Die App ist ein Ausbildungswerkzeug für Dienstabende, kein Einsatzsystem. „Einsatz“ meint hier den Übungsabend mit 3–10 Sprechern und einer Übungsleitung unter Zeitdruck.

## Erwartete Arbeitsfolge (Soll aus Nutzersicht)

> Annahme: So läuft ein Funk-Dienstabend in einem OV oder einer Wache ab. Eine verbindliche THW-Vorgabe dafür gibt es nicht.

1. **Vorbereiten (Desktop, Tage vorher):** Kopfdaten, Teilnehmer, Inhalte wählen, Übung erzeugen.
2. **Verteilen:** Je Sprecher Link oder Codes, Ausdrucke als Rückfallebene, Leitungszugang sichern.
3. **Durchführen (Teilnehmer, Handy):** Spruch absetzen, abhaken, eingehende Sprüche mitschreiben.
4. **Überwachen (Übungsleitung, Laptop):** Anmeldungen, Fortschritt, Lösungswort, Stärke, Notizen.
5. **Auswerten:** Debriefing je Teilnehmer bzw. für die beübte Stelle.
6. **Führungsstellen-Variante:** Rollenspieler (EA, Stab) spielen nach Drehbuch und gemeinsamer X-Zeit ein, die beübte Stelle arbeitet ohne Zugang, die Leitung vergleicht mit der „Erwartung“.

## Durchgeführte Abläufe

| # | Ablauf | Ergebnis |
|---|---|---|
| A | Generator klassisch: zuerst leer „Übung generieren“, dann 3 Teilnehmer, 8 Sprüche, zentrales Lösungswort „FUNKER“, Vorlage THW Leer → generieren → ZIP (0,6 MB, 35 Dateien + LIESMICH) und Sammel-PDF → Reload → Startseite | erfolgreich, Ergebnis überlebt Reload (`a04`, `a06`) |
| B | Teilnehmer per Kurzlink (412 px) → 2 Sprüche abhaken → Leitung sieht „GEMELDET (TN)“ live → Meldevordruck → Leitung „1 gemeldete bestätigen“ → Debrief-PDF und Leitungs-PDF → Reload beider Seiten | erfolgreich (`b02`–`b12`) |
| C | Teilnehmer 22/12 auf Pixel 7 (Touch): Nachrichtenvordruck, dreimal „Als abgesetzt markieren“ tippen, Doppeltipp; falscher Code im Kurzlink | funktioniert, Vordruck springt nicht weiter (`c01`–`c05`) |
| D | Bearbeiten-Link → Name ändern → „Als neue Übung generieren“ (neue ID/Codes) bzw. „Bestehende Übung überschreiben …“ → Leitung prüfen → Admin-Liste | beide Wege klar beschriftet; beim Überschreiben bleiben Status stehen (`d01`–`d06`) |
| E | Führungsstellen-Übung „Hochwasser“: Rollen, Übungsbeginn 19:30 → generieren → Drehbuch, ZIP, Blatt für die beübte Stelle → Cockpit „19:30 übernehmen“ → EA 1 (schon offen) und Stab (danach geöffnet) prüfen → Notiz an Einspielung → Leitungs-PDF, Debrief | gemeinsame X-Zeit funktioniert; Auswertung der beübten Stelle bleibt dünn (`e01`–`e09`, `h01`–`h04`) |

## Kurzurteil

Der klassische Ablauf trägt jetzt **ohne fremde Hilfe von der leeren Seite bis zum Debriefing**. Die Übergänge, die im ersten Lauf hakten, sind sichtbar repariert:

- Ein Kurzlink öffnet die Teilnehmersicht direkt (`b02`).
- Teilnehmer-Meldungen erscheinen bei der Leitung als „GEMELDET (TN)“ mit Knopf „Bestätigen“ und einer Sammelaktion; das Debrief-PDF zeigt „Gemeldet (TN)“ und „Bestätigt (Leitung)“ getrennt.
- Die Anmeldung wird aus dem abgehakten Anmelde-Funkspruch übernommen („angemeldet … vom Teilnehmer gemeldet“, `b05`).
- Die X-Zeit der Führungsstellen-Übung setzt die Leitung einmal, und jede Rolle übernimmt sie – auch eine später geöffnete (`e07`, `e08`).
- Auf den Ausdrucken stehen Übungs- und Teilnehmercode bzw. der Weg zurück in die Leitung, und das ZIP hat eine LIESMICH-Datei.

Reibung bleibt an zwei Stellen: **Zeitführung** der Führungsstellen-Übung (geplanter Beginn wird ohne Plausibilitätsprüfung übernommen, Rollen sehen ihren Rückstand nicht) und **Abschluss** (Überschreiben lässt alte Status stehen, die beübte Stelle hat kein eigenes Auswertungsergebnis, Debriefs nur einzeln).

---

## Befunde

### W1 – P2 – Geplanter Übungsbeginn wird ohne Prüfung übernommen; liegt er zurück, ist sofort fast alles „überfällig“

1. **Priorität:** P2
2. **Fundstelle / Aufgabe:** Leitung → Cockpit `#uebungsleitungCockpit`, Knopf `#btn-cockpit-xzeit-vorschlag` („19:30 übernehmen“); Generator `#fuehrungsstelleBeginn`
3. **Beobachtung:**
   - Im Generator habe ich Übungsbeginn 19:30 eingetragen (Datum: heute, Feld nur Uhrzeit). Das Cockpit bietet „19:30 übernehmen“ an – gut, nicht stillschweigend.
   - Um 21:07 übernommen: ohne Rückfrage „Laufzeit 1:37:00 · X + 97 min · 44 hinter Plan“, Lage „43 überfällig – zur ersten“, jede Zeile „überfällig 96 min“ (`e06-fs-ul-after-basis.png`).
   - Die Basis geht sofort an alle Rollen (`e07`, `e08`).
4. **Erwartung der Rolle:** Liegt der geplante Beginn deutlich in der Vergangenheit (oder an einem anderen Tag als dem Übungsdatum), fragt die App nach: „19:30 liegt 97 Minuten zurück – trotzdem übernehmen oder jetzt starten?“
5. **Auswirkung im Einsatz:**
   - Typischer Fall: Der Abend beginnt verspätet, die Leitung tippt den angebotenen Knopf. Alle Rollenspieler stehen sofort mit Dutzenden überfälligen Einspielungen da, das Drehbuch-Timing ist für den Abend verdorben.
   - Korrigieren geht (neue Basis), wirkt aber wieder auf alle – mitten im Anlaufen der Übung.
6. **Empfehlung:** Beim Übernehmen den Abstand zur aktuellen Uhrzeit zeigen und ab einigen Minuten Abweichung nachfragen; den Vorschlag ausblenden oder als „verpasst“ kennzeichnen, wenn er weit zurückliegt.
7. **Verifikation:** Beginn 19:30 planen, um 21:00 das Cockpit öffnen: Es erscheint eine Rückfrage mit „jetzt starten“ als Alternative, bevor eine Basis an die Rollen geht.

### W2 – P2 – Rollenspieler sehen ihren Rückstand nicht; der Countdown zeigt auf die nächste künftige Einspielung

1. **Priorität:** P2
2. **Fundstelle / Aufgabe:** Rollen-Sicht (Teilnehmeransicht im X-Zeit-Modus), Karte „X-Zeit“ und Fokus-Karte (`e08-stab.png`, `e07-ea-after.png`); Berechnung `src/teilnehmer/nachrichtenMarkup.ts:63-80` (`naechsteFaelligkeitMs` überspringt alles mit Zeitpunkt in der Vergangenheit)
3. **Beobachtung:**
   - Leitung: „44 hinter Plan“, Einspielung Nr. 3 des Stabs „überfällig 94 min“.
   - Stab (Kater Oldenburg) zur selben Zeit: „Nächste in 6:54“ und darunter „Meldung 1 fällig · X+3 · noch 18 offen“. Kein Wort von „überfällig“ und keine Zahl, wie viele Einspielungen schon hätten raus sein müssen.
4. **Erwartung der Rolle:** Der Rollenspieler sieht dasselbe Lagebild wie die Leitung: „3 überfällig, älteste seit 94 min – Nr. 1 jetzt einspielen“. Der Countdown gilt erst, wenn nichts mehr nachhängt.
5. **Auswirkung im Einsatz:** Ein Einspieler, der durch eine Rückfrage oder eine Funkstörung zurückfällt, liest „Nächste in 6:54“ und glaubt, er habe Zeit. Die Leitung muss ihn per Zuruf oder Funk antreiben – genau die Abstimmung, die die gemeinsame X-Zeit sparen soll.
6. **Empfehlung:** In der Rollen-Sicht Rückstand ausdrücklich anzeigen (Anzahl überfällig, Minuten seit Fälligkeit der ältesten), Countdown nur ohne Rückstand oder zusätzlich.
7. **Verifikation:** Basis 10 Minuten zurück setzen, Rolle mit Einspielungen bei X+1/X+3 öffnen: Die Rolle zeigt „2 überfällig“ statt nur „Nächste in …“, gleiche Zahl wie das Cockpit der Leitung.

### W3 – P2 – Überschreiben einer laufenden Übung lässt Status, Anmeldungen und Fortschritt an den neuen Inhalten hängen

1. **Priorität:** P2
2. **Fundstelle / Aufgabe:** Generator über „Übung bearbeiten“ (`#/generator/<id>`) → `#ueberschreibenBtn` „Bestehende Übung überschreiben …“
3. **Beobachtung:**
   - Der Standardweg heißt jetzt „Als neue Übung generieren“ und legt wirklich eine neue ID und neue Codes an (`32XF79` statt `FFLDD6`); die alte bleibt unverändert. Das ist gut gelöst.
   - Der Weg „überschreiben“ warnt ausführlich, u. a.: „Gesetzte Status … passen nicht mehr zum neuen Inhalt. Setze sie in der Übungsleitung zurück.“
   - Nach dem Überschreiben (6 statt 8 Sprüche) zeigt die Leitung für 21/11 weiter „1 / 6 · TN 1 · Leitung 1“; der alte Status hängt an einem jetzt anderen Spruch (`d05-ul-after-overwrite.png`). Zurücksetzen muss man in einer anderen Ansicht unten im Bereich „Übungsstand zurücksetzen“.
4. **Erwartung der Rolle:** Wer bewusst überschreibt, bekommt im selben Schritt die Wahl „Stand zurücksetzen (empfohlen)“ oder „Stand behalten“ – nicht den Auftrag, danach woanders aufzuräumen.
5. **Auswirkung im Einsatz:** Vergisst die Leitung den zweiten Schritt (Zeitdruck kurz vor Beginn), stimmen Fortschritt, Debriefing und Teilnehmer-Abhakstände nicht mit den neuen Texten überein. Das Risiko ist durch Warnung und neuen Standardweg deutlich kleiner als im ersten Lauf, aber der Ablauf bleibt zweistufig.
6. **Empfehlung:** Das Zurücksetzen als Option direkt in die Überschreiben-Rückfrage nehmen, oder nach dem Überschreiben in der Leitung einen deutlichen Hinweis „Inhalt neu erzeugt – alter Stand noch vorhanden“ mit Ein-Klick-Zurücksetzen zeigen.
7. **Verifikation:** Ablauf D wiederholen: Nach dem Überschreiben zeigt die Leitung 0/n oder einen unübersehbaren Hinweis, ohne dass man selbst zum Gefahrenbereich scrollen muss.

### W4 – P2 – Führungsstellen-Übung: Für die beübte Stelle gibt es kein Auswertungsergebnis

1. **Priorität:** P2 (teilweise Annahme zum Ablauf einer Stabsrahmenübung)
2. **Fundstelle / Aufgabe:** Leitung, Teilnehmerzeile „beübte Stelle“ (Debrief „–“, `e06`), Leitungs-PDF der FS-Übung (`zipe/Uebungsleitung.pdf`, `dl-h-ul.pdf`), Plan-Zeile Nr. 3 „Ausdruck · Auftrag“ (`h01-row-ausdruck.png`)
3. **Beobachtung:**
   - Debriefs gibt es nur für die Rollenspieler (EA 1–3, Stab) – also für die Übungsleitung selbst. Die beübte Stelle hat in der Spalte „Debrief“ nur „–“.
   - Notizen je Einspielung landen im Leitungs-PDF als „Anmerkung: Auftrag nicht quittiert, Lagekarte nicht nachgeführt“ – das hilft. Das Leitungs-PDF hat aber das klassische Layout: Spalten „Lösungswort Soll/Ist“ und „Stärke Soll 0/0/0/0“ für alle Rollen, keine X-Zeit-Spalte, keine „Erwartung“. Die Nr.-Spalte zählt je Absender (1, 1, 1, 2 …).
   - Einspielungen mit Weg „Ausdruck“/„E-Mail“ nennen weiter nicht, welches Papier zu übergeben ist (im Plan und in der Stab-Sicht `e08` nur das Etikett „Ausdruck“).
4. **Erwartung der Rolle:** Am Ende liegt ein Blatt „Auswertung beübte Stelle“: je Einspielung X-Zeit, Weg, Erwartung, Ist/Notiz der Leitung – das ist der eigentliche Zweck dieser Übungsform.
5. **Auswirkung im Einsatz:** Die Nachbesprechung muss die Leitung aus Drehbuch-PDF, Bildschirm und Notizen von Hand zusammensetzen. Die vorhandenen Notizen gehen in einem Ausdruck unter, dessen Hälfte der Spalten (Lösungswort, Stärke) für diese Übungsform leer oder „0/0/0/0“ ist.
6. **Empfehlung:**
   - Für die beübte Stelle ein eigenes Debrief: Einspielungen in X-Zeit-Reihenfolge mit Erwartung, Stand und Notiz.
   - Das Leitungs-PDF für FS-Übungen ohne Lösungswort/Stärke, mit X-Zeit und Erwartung.
   - Bei „Ausdruck“/„E-Mail“ den konkreten Vordruck (Datei bzw. Seite) nennen.
7. **Verifikation:** FS-Übung mit 3 Notizen durchspielen: Ein PDF für die beübte Stelle enthält alle 73 Einspielungen mit Erwartung und die 3 Notizen; keine Spalte „Lösungswort“.

### W5 – P3 – Vordruck-Ansicht: öffnet auf Seite 1, springt nach dem Abhaken nicht weiter, derselbe Knopf nimmt beim nächsten Tipp zurück

1. **Priorität:** P3
2. **Fundstelle / Aufgabe:** Teilnehmer → „Meldevordruck“/„Nachrichtenvordruck“, Fußleiste `#btn-doc-absetzen` (`b06-tn-vordruck.png`, `c02-px7-after-tap*.png`)
3. **Beobachtung:**
   - Teilnehmer 21/11 hatte Nr. 1 und 2 abgehakt, „ALS NÄCHSTES“ stand bei Nr. 3. Der Vordruck öffnete trotzdem auf „Seite 1 / 8“ (Nr. 1, schon abgesetzt); der große Knopf an der Stelle lautete „Zurücknehmen (wieder offen)“. Mein Tipp darauf hat Nr. 1 zurückgenommen – und damit auch die Anmeldung bei der Leitung („Anmeldung erhalten“-Knopf wieder sichtbar, `b09-crop.png`).
   - Pixel 7: drei Tipps im Abstand von 1,5 s auf denselben Knopf → ABGESETZT, OFFEN, ABGESETZT, immer Seite 1/8. Der Doppeltipp-Schutz (1 s) greift, ein späterer zweiter Tipp toggelt.
4. **Erwartung der Rolle:** Vordruck öffnen = beim nächsten offenen Spruch landen; nach „abgesetzt“ zum nächsten Spruch weiter (oder deutlich „Weiter →“ anbieten).
5. **Auswirkung im Einsatz:** Wer im Rhythmus „funken – tippen – funken – tippen“ arbeitet, nimmt beim zweiten Tipp seinen eigenen Haken zurück. Die Liste ist der robustere Weg; der Vordruck wird so eher zur Ansicht als zum Arbeitsweg.
6. **Empfehlung:** Vordruck beim „Als Nächstes“-Spruch öffnen; nach „Als abgesetzt markieren“ automatisch weiterblättern (mit kurzem Hinweis „Nr. 3 abgesetzt – weiter zu Nr. 4“).
7. **Verifikation:** Mit 2 abgehakten Sprüchen Vordruck öffnen → Seite 3; dreimal tippen → Nr. 3, 4, 5 abgesetzt, keiner zurückgenommen.

### W6 – P3 – Ohne gesicherten Link kein Rückweg zur eigenen Übung außer über die öffentliche Admin-Liste

1. **Priorität:** P3
2. **Fundstelle / Aufgabe:** Startseite nach erneutem Aufruf (`a07-crop.png`); Admin (`d06-admin.png`)
3. **Beobachtung:** Das Ergebnis überlebt jetzt den Reload, weil die Adresse `#/generator/<id>` ist, und der Text sagt deutlich „Heb den Link auf“. Ruft man aber `/` neu auf (Lesezeichen auf die Startseite, neuer Tab), zeigt der Generator ein leeres Formular ohne Hinweis auf die eben erzeugte Übung. Zurück geht es nur über die Admin-Liste aller Übungen oder über den QR-Code auf dem Leitungs-PDF.
4. **Erwartung der Rolle:** „Deine zuletzt erzeugten Übungen auf diesem Gerät“ auf der Startseite.
5. **Auswirkung im Einsatz:** Wer den Link nicht gesichert hat, sucht am Abend seine Übung in einer Liste fremder Übungen – lösbar, aber mit Verwechslungsgefahr bei gleichen Namen.
6. **Empfehlung:** Die letzten eigenen Übungs-IDs lokal merken und auf der Startseite anbieten.
7. **Verifikation:** Übung erzeugen, `/` in neuem Tab öffnen: Die Übung ist mit einem Klick erreichbar.

### W7 – P3 – Kein Abschluss der Übung; Debriefs nur einzeln

1. **Priorität:** P3
2. **Fundstelle / Aufgabe:** Leitung, Spalte „Debrief“ (`[data-action=download-debrief]`)
3. **Beobachtung:** Jedes Debrief-PDF ist ein eigener Klick und eine eigene Datei. Es gibt keine Aktion „alle Debriefs“ und keinen Zustand „Übung beendet“ (keine Fundstelle im Code unter `src/uebungsleitung/`).
4. **Erwartung der Rolle:** Nach dem letzten Spruch ein Schritt „Übung beenden → Debriefs aller Teilnehmer“ als eine Datei.
5. **Auswirkung im Einsatz:** Bei 7–10 Teilnehmern 7–10 Downloads direkt nach dem Abend; der Stand wird nicht eingefroren, spätere Klicks ändern das Ergebnis.
6. **Empfehlung:** Sammel-Debrief (ein PDF oder ZIP) und optional ein „beendet“-Vermerk mit Zeitpunkt.
7. **Verifikation:** Ein Klick erzeugt die Debriefs aller Teilnehmer.

### W8 – P3 – FS-ZIP enthält einen Ordner für die beübte Stelle mit leeren Unterlagen

1. **Priorität:** P3
2. **Fundstelle / Aufgabe:** ZIP der Führungsstellen-Übung (`dl-e-download`, entpackt `zipe/`)
3. **Beobachtung:** `Teilnehmer/Heros Oldenburg 10/` (die beübte Stelle) enthält eine Übersicht ohne Sprüche und sechs Vordruck-PDFs, die nur aus dem Deckblatt bestehen (je ~4 kB). Die LIESMICH sagt zu `Teilnehmer/<Funkrufname>/`: „zum Weitergeben“. Gleichzeitig steht dort richtig, dass die beübte Stelle nur `Ausgangslage_beuebte_Stelle.pdf` bekommt.
4. **Erwartung der Rolle:** Für die beübte Stelle gibt es im ZIP genau ein Blatt, keinen Teilnehmerordner.
5. **Auswirkung im Einsatz:** Kleine Verwirrung beim Sortieren der Ausdrucke; leere Seiten im Sammeldruck.
6. **Empfehlung:** Ordner und Deckblätter für die beübte Stelle weglassen.
7. **Verifikation:** FS-ZIP enthält unter `Teilnehmer/` nur Rollenspieler.

### W9 – P3 – Kleinere Brüche

1. **Priorität:** P3
2. **Fundstelle / Beobachtung:**
   - **Fehlermeldung bleibt nach Erfolg stehen:** Der Fehler-Toast vom ersten, leeren Generierungsversuch („Bitte den Funkrufnamen der Übungsleitung eintragen …“) steht nach erfolgreicher Generierung weiter über der Aktionsleiste und verdeckt „Bestehende Übung überschreiben …“ teilweise (`a04-crop-actionbar.png`). Fehler-Toasts schließen bewusst nicht von selbst (`src/core/UiFeedback.ts`), aber auch nicht, wenn der Fehler behoben ist.
   - **Nummern Papier ↔ Bildschirm:** Der Bildschirm-Plan der Leitung nummeriert fortlaufend (Nr. 4, darunter „Abs.-Nr. 2“), das Leitungs-PDF nur nach Absender (1, 1, 1, 2, 2, 2 …). Wer auf Papier mitgeschrieben hat und nachträgt, muss umrechnen.
   - **Prozentwerte driften beim Wiederöffnen:** 10 % an Alle / 30 % an Mehrere werden nach Reload zu 13 % / 25 % (aus den gespeicherten Stückzahlen zurückgerechnet, `a06`). Die Stückzahlen bleiben gleich, die Eingabe wirkt aber verändert.
   - **Datum als DTG mit 0000:** Leitungskopf „Datum 080000oct26“ (`b09-crop.png`) – liest sich wie eine Uhrzeit 00:00.
3. **Empfehlung:** Fehler-Toast bei erfolgreicher Aktion schließen; Plan-Nr. auch im PDF; Prozentwerte unverändert zurückgeben; Datum ohne Uhrzeit.
4. **Verifikation:** Je Punkt Sichtprüfung im Ablauf A/B.

---

## Nicht prüfbar / Hinweise

- **Dateiname von Downloads mit Umlaut:** In Playwright kam jede Datei, deren Name ein „ü“ enthält (ZIP „Sprechfunkübung Zentrale Stern 2026_….zip“, Debrief „…Sprechfunkübung…pdf“), als `download` ohne Endung an; der Inhalt war korrekt (ZIP mit 53 Dateien). Ein Gegentest mit einem einfachen `<a download>` zeigte dasselbe Verhalten nur bei Nicht-ASCII-Namen. Ob das ein Effekt der Headless-Automatisierung ist oder echte Browser genauso reagieren, ließ sich hier nicht klären. Da der zufällige Vorschlagsname „Sprechfunkübung …“ immer ein „ü“ enthält, sollte das einmal in Chrome, Firefox und Safari (iOS) von Hand geprüft werden.
- **Geräteübergreifende Synchronisation:** Im Mock-Modus läuft der Live-Status über `localStorage`/`storage`-Event; Teilnehmer- und Leitungstab im selben Browser synchronisierten sofort. Zwei echte Geräte über Firestore wurden nicht geprüft.
- **Inhalte:** Spruchtexte und Drehbuch fachlich nicht bewertet.

## Abschluss

- **Aufgabe geschafft:** ja (klassisch vollständig); Führungsstellen-Übung mit Umwegen bei Zeitführung und Auswertung
- **Fremde Hilfe nötig:** nein
- **Größtes Missverständnis:** Ein Rollenspieler liest „Nächste in 6:54“ und hält sich für pünktlich, während die Leitung ihn 94 Minuten im Rückstand sieht.
- **Größtes Einsatzrisiko:** Ein bereits verstrichener Übungsbeginn wird mit einem Klick als gemeinsame X-Zeit an alle Rollen verteilt und macht den Abend-Zeitplan schlagartig „überfällig“.
- **Top-Priorität für die nächste Iteration:** Zeitführung der Führungsstellen-Übung absichern – Rückfrage beim Übernehmen eines vergangenen Beginns (W1) und Rückstand in der Rollen-Sicht (W2).

---

## Abgleich mit dem Lauf vom 2026-10-04

| Alte ID | Titel (kurz) | Alte Prio | Status jetzt | Beleg aus dieser Prüfung |
|---|---|---|---|---|
| F1 | Neu generieren überschreibt verteilte Übung unter gleichen Codes | P1 | teilweise | Standardknopf heißt „Als neue Übung generieren“ und erzeugt neue ID + Codes (`6d423323…`, `32XF79`); Bearbeiten-Link „Nur für dich – nicht an Teilnehmer geben“; Lösungswort „FUNKER/zentral“ bleibt beim Öffnen per ID erhalten. Überschreiben ist weiter möglich und behält die alten Status (`d05`, „1 / 6 · TN 1 · Leitung 1“) – jetzt mit ausführlicher Warnung (W3). |
| F2 | Keine gemeinsame X-Zeit, Generator-Beginn wirkt nirgends | P1 | behoben | Cockpit bietet „19:30 übernehmen“ an; danach zeigen EA 1 (offen) und der danach geöffnete Stab „X-Zeit 19:30 – von der Übungsleitung gesetzt“ (`e07`, `e08`); eigene Basis einer Rolle nur nach Rückfrage („Die Übungsleitung hat die X-Zeit 19:30 für alle festgelegt …“). Neuer Folgebefund W1/W2. |
| F3 | Zwei Statuswelten, Debrief nur Leitung | P1 | behoben | Leitung zeigt „GEMELDET (TN)“ + „Bestätigen“ und „1 gemeldete bestätigen“; Anmeldung aus Anmelde-Funkspruch („angemeldet … vom Teilnehmer gemeldet“, `b05`); Debrief-PDF mit Spalten „Gemeldet (TN)“/„Bestätigt (Leitung)“ und Zählzeile; Teilnehmer sieht „Leitung: bestätigt 21:02“ neben „ABGESETZT“ (`b10`). |
| F4 | Vordruck-Vorschau leer auf älterem Chromium | P1 | behoben | Chromium 141: Meldevordruck rendert („Seite 1 / 8“, `b06`, `c01`), keine `pageerror` in den Läufen. |
| F5 | Papier und Digital nicht verbunden | P2 | teilweise | Teilnehmer-Übersicht mit Übungscode, Teilnehmercode und Zugang/QR; Leitungs-PDF mit Übungscode, Teilnehmercodes und „Übungsleitung wieder öffnen“; Ergebnis überlebt Reload (`a06`). Startseite bietet die eigene Übung weiterhin nicht an (W6). |
| F6 | Mobile Vordruck-Ansicht: Übertragen nur per Leertaste | P2 | behoben | Pixel 7: großer Knopf „✓ Als abgesetzt markieren“/„Zurücknehmen“ in der Fußleiste, Tippen wirkt; keine Tastenlegende auf dem Handy; Modal nicht mehr vom App-Kopf verdeckt (`b06`, `c01`). Restthema Weiterblättern: W5. |
| F7 | Platzhalter/Beispielwerte gehen ungefragt in die Übung | P2 | behoben | Leeres Formular: Leitung, Teilnehmer, Vorlage leer; „Übung generieren“ meldet die drei Pflichtfelder am Feld und im Fehlerkasten (`a02`); FS-Rollen nur mit Platzhalter „z. B. Heros Musterstadt“. |
| F8 | Kein Blatt für die beübte Stelle; Ausdruck/E-Mail ohne Übergabe | P2 | teilweise | ZIP enthält `Ausgangslage_beuebte_Stelle.pdf` ohne Erwartungen, Generator hat „Blatt für die beübte Stelle drucken“ (`e03`-Popup mit Lage/Auftrag). Plan-Zeilen „Ausdruck“ nennen weiter kein Dokument (`h01`) – siehe W4. |
| F9 | Kleinere Brüche (Statusleiste, Dauer, Kurzlink, Navigation, beübte Stelle, Nummerierung, ZIP) | P3 | teilweise | Statusleiste live („Teilnehmer 3 · ca. 24 · Zentral“); FS-Dauer „180 Min (Drehbuch)“; Kurzlink öffnet direkt (`b02`); „Übung erstellen“ in der Leitung nicht mehr aktiv (`b09-crop`); beübte Stelle als eigene Zeile „wird beübt“ ohne Code (`e06`); Bildschirm-Nr. fortlaufend mit Abs.-Nr.; ZIP 0,6 MB mit LIESMICH. Offen: Leitungs-PDF nummeriert weiter je Absender (W9). |
| F10 | Teilnehmertabelle am Handy angeschnitten | P3 | behoben | Spruchliste als Karten, Status-Chip und Knopf voll sichtbar, „Leitung: bestätigt“ unter dem Text, ZIP und Zurücksetzen am Seitenende (`b10`, 412 px). |
