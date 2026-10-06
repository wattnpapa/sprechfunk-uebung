Befunde: P0=0 P1=0 P2=2 P3=7
Abgleich: behoben=6 teilweise=2 offen=1 nicht-pruefbar=0

# THW-Workflow-Review (dritter Lauf) – Sprechfunk Übungsgenerator

- **Datum:** 2026-10-06
- **Perspektive:** Helfer, der eine Sprechfunkübung vom Anlegen bis zur Nachbesprechung komplett durchziehen will (Skill `thw-workflow-reviewer`)
- **Umgebung:** lokaler Build unter `http://127.0.0.1:3000`, Mock-Firestore (localStorage), Chromium 141 (`/opt/pw-browsers/chromium-1194`), persistentes Browserprofil; Desktop 1440×1000, Teilnehmer und Rollenspieler mit 412×915
- **Screenshots und Downloads:** `scratchpad/workflow3/*.png` und `scratchpad/workflow3/dl-*` (Dateinamen stehen im Befund)
- **Rahmen:** Die App ist ein Ausbildungswerkzeug für Dienstabende, kein Einsatzsystem. „Einsatz“ meint hier den Übungsabend mit 3–10 Sprechern und einer Übungsleitung unter Zeitdruck.

## Erwartete Arbeitsfolge (Soll aus Nutzersicht)

> Annahme: So läuft ein Funk-Dienstabend in einem Ortsverband oder auf einer Wache ab. Eine verbindliche THW-Vorgabe dafür gibt es nicht.

1. **Vorbereiten (Desktop, Tage vorher):** Kopfdaten, Teilnehmer und Inhalte eintragen, als Profil für den nächsten Abend sichern, Übung erzeugen.
2. **Verteilen:** Je Sprecher Link oder Codes, Ausdrucke als Rückfallebene, Leitungszugang sichern.
3. **Durchführen (Teilnehmer, Handy):** Spruch absetzen, abhaken, eingehende Sprüche mitschreiben.
4. **Überwachen (Übungsleitung, Laptop):** Anmeldungen, Fortschritt, Bestätigung, Lösungswort, Stärke, Notizen.
5. **Korrigieren:** Kurz vor Beginn noch etwas ändern (Umfang, Teilnehmer), ohne dass Papier und Bildschirm auseinanderlaufen.
6. **Auswerten:** Debriefing je Teilnehmer bzw. für die beübte Stelle.
7. **Führungsstellen-Variante:** Rollenspieler (Einsatzabschnitte, Stab) spielen nach Drehbuch und gemeinsamer X-Zeit ein, die beübte Stelle arbeitet ohne Zugang, die Leitung hält die Reaktion gegen die „Erwartung“ fest.

## Durchgeführte Abläufe

| # | Ablauf | Ergebnis |
|---|---|---|
| A | Generator: Datum, Name, Rufgruppe, Leitung, 3 Teilnehmer, 8 Sprüche, zentrales Lösungswort „FUNKER“, Vorlage THW Leer → **Profil „OV Oldenburg Dienstabend“ speichern** → generieren → ZIP (35 Dateien + LIESMICH) und Sammel-PDF → `/` in neuem Tab → Profil laden | erfolgreich; „Zuletzt in diesem Browser erstellt“ zeigt die Übung, Profil füllt alle Felder in eine neue Übung (`a02`, `a04`, `a06`, `a07`) |
| B | Teilnehmer 21/11 per Kurzlink (412 px) → 2 Sprüche in der Liste abhaken → Leitung sieht „TN 2 · Leitung 0“ live → Meldevordruck → 2 Sprüche über den Vordruck → Leitung „gemeldete bestätigen“ → Debrief-PDF und Leitungs-PDF → Reload beider Seiten | erfolgreich (`b02`–`b12`) |
| C | Teilnehmer 22/12 über das Code-Feld der Startseite (Kleinbuchstaben eingegeben); Admin-Liste | erfolgreich (`d06`, `d07`, `d08`) |
| D | Bearbeiten-Link → Umfang 8 → 6 → „Bestehende Übung überschreiben …“ → Leitung prüfen → **geöffnete** Teilnehmerseite prüfen; Wiederholung mit 23/13 (1 Spruch abgehakt, dann 6 → 5 überschrieben) | Leitung sauber auf 0/6 zurückgesetzt; offene Teilnehmerseite zeigt weiter die alten Texte (N1) |
| E | Führungsstellen-Übung „Hochwasser“, 3 Abschnitte + Stab, geplanter Beginn 45 min in der Vergangenheit → generieren → Drehbuch, ZIP, Blatt für die beübte Stelle | erfolgreich (`e01`–`e03`) |
| F | Leitung: Vorschlag „05:44 übernehmen (liegt 46 min zurück)“ → Rückfrage abbrechen → „jetzt starten“; danach Basis auf 25 min zurück gesetzt → EA 1 und Stab am Handy → Einspielungen abhaken → Leitung bestätigt → Reaktion „abweichend“ + Notiz → Leitungs-PDF, Rollen-Debrief | Zeitführung funktioniert; Ausdrucke tragen die alte Planzeit (N2) (`f03`–`f08`, `g01`–`g08`) |

## Kurzurteil

Der klassische Ablauf trägt **ohne fremde Hilfe vom leeren Formular bis zum Debriefing**, und der Vorbereitungsteil ist gegenüber dem zweiten Lauf deutlich runder:

- Profile heben alle Eingaben auf und laden sie immer in eine **neue** Übung („Profil … geladen. Prüfe Datum und Name, noch ist keine Übung gespeichert.“, `a07`).
- Die Startseite zeigt „Zuletzt in diesem Browser erstellt: Dienstabend Sprechfunk – Übungscode …“ (`a06`).
- Überschreiben setzt den Übungsstand jetzt gleich mit zurück („Übung überschrieben, der Übungsstand ist für alle zurückgesetzt. Verteile die Unterlagen neu.“, Leitung 0/6).
- Der Vordruck öffnet beim nächsten offenen Spruch („Seite 3 / 8“), und der Knopf wird nach dem Abhaken zu einem ruhigen „✓ abgesetzt 06:25“ mit „Weiter“ daneben. Ein zweiter Tipp nimmt nichts mehr zurück (`b07-tn-vordruck-tap0.png`).
- Führungsstellen-Übung: Ein verpasster Beginn wird nur nach Rückfrage übernommen („… sind sofort 21 Einspielungen überfällig – bei allen Rollen“), mit „stattdessen jetzt starten“ als Alternative. Rollen sehen ihren Rückstand („4 fällig, älteste seit 24 min · Nächste in 5:01“, `f05`). Das Leitungs-PDF hat jetzt ein eigenes Layout mit Erwartung, Reaktion und Notiz.

Reibung bleibt an den **Übergängen nach einer Änderung**:

- Wer kurz vor Beginn überschreibt, hat offene Handys mit alten Texten im Raum (N1).
- Wer in der Führungsstellen-Übung später startet als geplant, hat Papier mit anderen Uhrzeiten als der Bildschirm (N2).

Der **Abschluss** bleibt Handarbeit: Debriefs nur einzeln, kein Ende-Zustand, kein eigenes Ergebnis für die beübte Stelle (N3).

---

## Befunde

### N1 – P2 – Nach „Überschreiben“ zeigen geöffnete Teilnehmerseiten weiter die alten Funksprüche, nur mit gelöschten Haken

1. **Priorität:** P2
2. **Fundstelle / Aufgabe:** Generator `#/generator/<id>` → `#ueberschreibenBtn`; parallel geöffnete Teilnehmerseite `#/teilnehmer/<id>/<code>` (`d09-tn-live-nach-ueberschreiben.png`, `d04-tn-after-overwrite.png`)
3. **Beobachtung:**
   - Teilnehmer 23/13 hat Nr. 1 abgehakt, die Seite bleibt offen. Danach überschreibt die Leitung die Übung (6 → 5 Sprüche).
   - Die offene Teilnehmerseite zeigt sofort Nr. 1 wieder „OFFEN“. Sie zeigt aber weiter **6 alte Sprüche** mit den alten Texten (Nr. 2 „LEER, Ostermeedlandsweg 17 – 21 …“).
   - Kopf „Übungsleitung: live · alles gesendet 06:28“, kein Hinweis auf geänderten Inhalt, auch nach 15 s nicht.
   - Erst nach Neuladen: 5 Sprüche, Nr. 2 lautet „Mülldeponie BREINERMOOR …“.
   - Im ersten Durchgang (21/11, 8 → 6) dasselbe: 8 alte Karten bei 6 neuen Sprüchen.
   - Die Rückfrage beim Überschreiben sagt „Geöffnete Teilnehmer-Links zeigen andere Funksprüche“. Tatsächlich zeigen sie bis zum Neuladen die **alten**.
   - Technischer Hintergrund: Die Teilnehmerseite abonniert nur Status (`src/teilnehmer/index.ts:215-216`), nicht den Inhalt der Übung. Das gilt daher auch mit echtem Firestore.
4. **Erwartung der Rolle:** Ändert die Leitung den Inhalt, sagt jedes offene Gerät deutlich: „Die Übung wurde neu erzeugt – Seite neu laden“. Alternativ lädt es selbst neu, bevor jemand weiter abhakt.
5. **Auswirkung im Einsatz:**
   - Typisch ist das kurz vor Beginn: Sprecher haben ihr Handy schon offen, die Leitung korrigiert noch etwas.
   - Die Sprecher funken die alten Texte. Ihre Haken landen auf den Nummern der neuen Sprüche, sodass Leitung und Debrief Sprüche als erledigt führen, die nie gefunkt wurden.
   - Gleichzeitig verschwinden schon gesetzte Haken kommentarlos, was eher wie ein Fehler der App wirkt.
6. **Empfehlung:**
   - Inhaltsänderung an offene Teilnehmerseiten melden (Banner mit „Neu laden“) und Abhaken bis dahin sperren.
   - Den Rückfragetext an das tatsächliche Verhalten anpassen.
7. **Verifikation:** Ablauf D wiederholen. Die offene Teilnehmerseite zeigt innerhalb weniger Sekunden einen Hinweis oder die neuen Texte. Ein Haken auf einer alten Karte ist nicht möglich.

### N2 – P2 – Führungsstellen-Übung: Ausdrucke behalten den geplanten Beginn, auch wenn die Leitung eine andere X-Zeit gesetzt hat

1. **Priorität:** P2
2. **Fundstelle / Aufgabe:** Leitung → „Übungsleitung als PDF“ (`#exportUebungsleitungPdf`) nach gesetzter Basis; Drehbuch-PDF und „Ausgangslage_beuebte_Stelle.pdf“ aus Generator/ZIP (`dl-g-ulpdf-…pdf`, Seite 2 als `g-ulpdf-p-02.png`; `dl-e-drehbuch-…pdf`; Bildschirm `g08-ul-nach-reaktion.png`)
3. **Beobachtung:**
   - Im Generator stand als Übungsbeginn 05:44. In der Leitung habe ich ihn bewusst nicht übernommen, sondern die Basis auf 06:05 gesetzt.
   - Bildschirm: Nr. 1 „Soll 06:06 · X+1“.
   - Das **danach** exportierte Leitungs-PDF zeigt bei Nr. 1 „+0:01 (05:45)“, bei Nr. 3 „+0:03 (05:47)“ usw. Daneben steht „Eingespielt 060633oct26“.
   - Drehbuch-Kopf „Übungsbeginn: 05:44 Uhr“, Blatt der beübten Stelle „Übungsbeginn 05:44 Uhr“.
   - Es gibt keinen Hinweis, dass die gedruckten Uhrzeiten nicht mehr gelten.
4. **Erwartung der Rolle:**
   - Ein Ausdruck aus der Leitung, gemacht nach dem Start, nutzt die gesetzte X-Zeit.
   - Vor dem Start gedruckte Unterlagen nennen die Uhrzeit nur als „geplant“ und führen die relative X-Zeit als maßgeblich.
5. **Auswirkung im Einsatz:**
   - Die Führungsstellen-Übung lebt von der Zeitachse. Fängt der Abend 20 Minuten später an (der Normalfall), arbeiten Rollenspieler mit Drehbuch auf Papier nach anderen Uhrzeiten als die Leitung am Bildschirm.
   - Wer bei Netzausfall auf das Papier wechselt (die LIESMICH empfiehlt das ausdrücklich), rechnet jede Zeile um.
   - Die Nachbesprechung vergleicht „Soll 05:45“ mit „eingespielt 06:33“ und sieht 48 Minuten Verzug, wo es keinen gab.
6. **Empfehlung:**
   - Leitungs-PDF mit der aktuell gesetzten Basis rechnen; ohne Basis nur „X+…“ drucken.
   - Auf Drehbuch und Blatt den Beginn als „geplant“ kennzeichnen. Die Spalte „X-Zeit“ führen, die Uhrzeit nur in Klammern.
7. **Verifikation:** Geplanter Beginn 19:30, Basis in der Leitung 19:50, dann Leitungs-PDF exportieren: Nr. 1 zeigt 19:51, nicht 19:31.

### N3 – P3 – Abschluss: Debriefs nur einzeln, kein Ende-Zustand, für die beübte Stelle kein eigenes Ergebnis

1. **Priorität:** P3
2. **Fundstelle / Aufgabe:** Leitung, Spalte „Nachbesprechung“ (`[data-action=download-debrief]`), Zeile „beübte Stelle“ (`f03`: Nachbesprechung „–“); Rollen-Debrief `dl-g-debrief-stab-…pdf`
3. **Beobachtung:**
   - Klassisch: drei Teilnehmer, drei einzelne Knöpfe „Debrief (PDF)“. Es gibt keine Sammelaktion und keinen Schritt „Übung beenden“; sichtbare Knöpfe sind nur PDF-Export, „Neu starten“ und „Übungsstand für alle zurücksetzen“.
   - Führungsstelle: Das Leitungs-PDF ist inzwischen eine brauchbare Auswertung, mit Erwartung je Einspielung, „Reaktion (Ist) / Notiz“ und der Zusammenfassung „Reaktionen: 1 abweichend · 2 ausstehend“ auf Seite 1.
   - Die beübte Stelle selbst hat aber kein Debrief.
   - Das Debrief eines Rollenspielers hat noch das klassische Layout: „Lösungswort (Soll/Ist) –/–“, „Stärke (Soll/Ist) –/–“, keine X-Zeit, keine Erwartung.
4. **Erwartung der Rolle:** Nach dem letzten Spruch erzeugt ein Knopf „Übung beenden“ alle Debriefs in einer Datei und friert den Stand ein. In der Führungsstellen-Übung kommt dazu ein Blatt „Auswertung beübte Stelle“.
5. **Auswirkung im Einsatz:**
   - Bei 7–10 Teilnehmern sind es direkt nach dem Abend 7–10 Downloads.
   - Ein späterer Klick in der Leitung ändert das Ergebnis noch.
   - Die Rollen-Debriefs in der Führungsstellen-Übung bewerten die Leitung selbst und bringen der Nachbesprechung nichts.
6. **Empfehlung:**
   - Sammel-Debrief als ein PDF oder ZIP.
   - Optional ein „beendet“-Vermerk mit Zeitpunkt.
   - In der Führungsstellen-Übung das Rollen-Debrief durch eine Auswertung der beübten Stelle ersetzen; das Leitungs-PDF ist dafür schon fast die Vorlage.
7. **Verifikation:** Ein Klick liefert alle Debriefs. In der Führungsstellen-Übung gibt es ein PDF für die beübte Stelle ohne Spalte „Lösungswort“.

### N4 – P3 – Führungsstellen-Übung: Reaktion der beübten Stelle erst erfassbar, nachdem die Leitung ihre eigenen Rollenspieler „bestätigt“ hat

1. **Priorität:** P3 (Annahme: Rollenspieler sind Teil des Übungsleitungsteams)
2. **Fundstelle / Aufgabe:** Leitung, Lagezeile „Beübte Stelle – Reaktionen“ und Plan-Zeile (`g04-ul-full.png`, `g08-ul-nach-reaktion.png`)
3. **Beobachtung:**
   - Der Stab hatte zwei Einspielungen abgehakt. In der Leitung standen sie als „GEMELDET (TN) – Bestätigen“, und die Lage zeigte „Kater Oldenburg: 16 offen, 2 zu bestätigen“, aber „Beübte Stelle – Reaktionen: noch nichts eingespielt“.
   - Die Knöpfe „erfolgt / abweichend / ausgeblieben“ gab es zu diesem Zeitpunkt nirgends (0 Treffer).
   - Erst nach „gemeldete bestätigen“ erschienen sie (9 Knöpfe, `g07`).
4. **Erwartung der Rolle:** Bei der klassischen Übung ist die Bestätigung sinnvoll (die Leitung hört den Spruch). In der Führungsstellen-Übung spielt die Leitung selbst bzw. ihr Team ein. Sobald ein Rollenspieler „eingespielt“ meldet, will die Leitung die Reaktion der beübten Stelle festhalten.
5. **Auswirkung im Einsatz:** Ein zusätzlicher Klick je Einspielung bzw. Sammelklick, ohne Nutzen für die Übung. Wer das nicht weiß, sucht die Reaktionsknöpfe und hält „noch nichts eingespielt“ für einen Synchronisationsfehler.
6. **Empfehlung:** In der Führungsstellen-Übung die Meldung des Rollenspielers als eingespielt werten, oder die Reaktionsknöpfe schon bei „gemeldet“ anbieten.
7. **Verifikation:** Rolle hakt ab, und in der Leitung erscheinen ohne weiteren Klick die Reaktionsknöpfe; die Lagezeile zählt die Einspielung.

### N5 – P3 – Automatische Vermerke landen in der Notizspalte

1. **Priorität:** P3
2. **Fundstelle / Aufgabe:** Debrief-PDF klassisch (`dl-b-debrief-…pdf`), Leitungs-PDF klassisch und FS (`dl-b-ulpdf-…pdf`, `g-ulpdf-p-02.png`)
3. **Beobachtung:**
   - Jede per Sammelbestätigung übernommene Zeile hat in „Notiz Übungsleitung“ bzw. „Anmerkung“ den Text „Zeit aus der Meldung des Teilnehmers übernommen.“
   - In der Führungsstellen-Übung steht davor „Reaktion der beübten Stelle: abweichend.“ und danach erst die eigentliche Notiz („Übernahme nicht quittiert, Lagekarte nicht nachgeführt“).
4. **Erwartung der Rolle:** In der Notizspalte steht nur, was die Leitung selbst notiert hat. Herkunft der Zeit und Reaktion stehen in eigenen Spalten oder als Kennzeichen.
5. **Auswirkung im Einsatz:** In der Nachbesprechung sind die wenigen echten Beobachtungen zwischen identischen Systemsätzen schwer zu finden; bei 73 Einspielungen wird die Spalte zur Textwand.
6. **Empfehlung:** Herkunft der Zeit als kurzes Kennzeichen (z. B. „TN“) an der Uhrzeit; Reaktion in eigener Spalte; Notizspalte nur für Freitext.
7. **Verifikation:** Debrief nach Sammelbestätigung: Die Notizspalte ist leer, solange keine Notiz geschrieben wurde.

### N6 – P3 – Leitungs-PDF der Führungsstellen-Übung: Pfeil wird als „!’“ gedruckt

1. **Priorität:** P3
2. **Fundstelle / Aufgabe:** Leitungs-PDF FS, Spalte „Von“ (`g-ulpdf-p-02.png`)
3. **Beobachtung:** Jede Zeile lautet „Heros Oldenburg 21/10 / !’ Heros Oldenburg 10“. Am Bildschirm steht an derselben Stelle „→“; der Pfeil fehlt im PDF-Zeichensatz.
4. **Erwartung der Rolle:** „→ Heros Oldenburg 10“ oder „an Heros Oldenburg 10“.
5. **Auswirkung im Einsatz:** Gering, wirkt aber auf dem Papier, das bei Netzausfall die Arbeitsgrundlage ist, wie ein Fehler.
6. **Empfehlung:** Zeichen, das der PDF-Font kann, oder das Wort „an“.
7. **Verifikation:** PDF-Text enthält kein „!’“.

### N7 – P3 – Veralteter Vorschlag bleibt nach gesetzter X-Zeit der auffälligste Knopf im Cockpit

1. **Priorität:** P3
2. **Fundstelle / Aufgabe:** Leitung → Cockpit (`f03-ul-cockpit-jetzt.png`)
3. **Beobachtung:** Nach „jetzt starten“ (Basis 06:30) steht weiter der blau gefüllte Knopf „05:44 übernehmen (liegt 46 min zurück)“ im Cockpit, optisch stärker als das Feld mit der gültigen Basis. Ein Klick fragt nach („X-Zeit-Basis für ALLE ändern: …?“), der Knopf bleibt aber die ganze Übung über stehen.
4. **Erwartung der Rolle:** Ist die Basis gesetzt, verschwindet der Vorschlag oder wird zur unauffälligen Information („geplant war 05:44“).
5. **Auswirkung im Einsatz:** Mitten in der Übung lädt der prominenteste Knopf dazu ein, die Zeitachse aller Rollen zu verschieben. Die Rückfrage verhindert den Schaden, kostet aber Aufmerksamkeit.
6. **Empfehlung:** Vorschlag nach gesetzter Basis ausblenden oder als Text zeigen.
7. **Verifikation:** Nach „jetzt starten“ gibt es im Cockpit keinen gefüllten Knopf „… übernehmen“ mehr.

### N8 – P3 – Profil übernimmt einmalige Angaben (Datum, Name) in die nächste Übung

1. **Priorität:** P3
2. **Fundstelle / Aufgabe:** Generator → Profile → „Laden“ (`a07-profil-geladen.png`)
3. **Beobachtung:**
   - Das am 06.10. gespeicherte Profil setzt in der neuen Übung Datum 08.10.2026, Name „Dienstabend Sprechfunk“ und Lösungswort „FUNKER“.
   - Der Hinweis sagt richtig „Prüfe Datum und Name, noch ist keine Übung gespeichert.“
   - Lädt man das Profil im nächsten Monat, steht aber das alte Datum im Feld.
4. **Erwartung der Rolle:** Ein Profil enthält, was jeden Dienstabend gleich ist: Leitung, Rufgruppe, Teilnehmer, Verteilung, Vorlagen. Das Datum ist danach heute oder leer.
5. **Auswirkung im Einsatz:**
   - Übersieht man den Hinweis, tragen Ausdrucke, Debriefs und Admin-Liste das Datum des alten Abends.
   - Gleiches Lösungswort jeden Monat nimmt der Übung den Reiz.
6. **Empfehlung:** Datum beim Laden auf heute (oder leer) setzen und Name und Lösungswort optional übernehmen; zumindest das Datumsfeld markieren.
7. **Verifikation:** Profil laden: Das Datum ist nicht das des Speichertags.

### N9 – P3 – Verteilung: Prozentwerte ändern sich beim Wiederöffnen; ungewöhnliche Vorgaben

1. **Priorität:** P3
2. **Fundstelle / Aufgabe:** Generator `#verteilungSection` (`a01-crop.png`, `a03-crop-vert.png`); Wiederöffnen per Bearbeiten-Link
3. **Beobachtung:**
   - Ein frisches Formular steht auf „% an Mehrere 30“ und „% Buchstabier-Aufgaben 50“, also die Hälfte aller Sprüche als Buchstabieraufgabe (aus `src/models/FunkUebung.ts:59-62`). Das Markup selbst nennt 5 % und 0 %.
   - Nach dem Überschreiben auf 5 Sprüche zeigt das Wiederöffnen 20 % / 40 % / 60 %. Eingegeben waren 10 % / 30 % / 50 %; zurückgerechnet wird aus den gespeicherten Stückzahlen.
4. **Erwartung der Rolle:** Die Vorgabe ist zurückhaltend (wenige Buchstabieraufgaben). Wiederöffnen zeigt die Werte, die man eingegeben hat.
5. **Auswirkung im Einsatz:** Wer die Vorgaben nicht prüft, bekommt einen Abend mit sehr vielen Buchstabieraufgaben. Beim Bearbeiten wirkt die eigene Eingabe verändert.
6. **Empfehlung:** Vorgaben wie im Markup (oder bewusst gewählt und begründet) und die eingegebenen Prozentwerte mitspeichern.
7. **Verifikation:** Neues Formular zeigt die dokumentierten Vorgaben. 10/30/50 eingeben, speichern, wiederöffnen: 10/30/50.

---

## Nicht prüfbar / Hinweise

- **Zwei Geräte über Firestore:** Im Mock-Modus laufen alle Rollen im selben Browser über `localStorage`. In einem Lauf (Stab und EA 1 gleichzeitig offen) kam ein Haken von EA 1 nicht bei der Leitung an. Drei gezielte Wiederholungen mit je einer offenen Rolle kamen alle an. Ich werte das als Effekt des gemeinsamen Speichers im Testaufbau, nicht als Befund. Mit zwei echten Handys sollte es trotzdem einmal geprüft werden.
- **N1 mit echtem Firestore:** Dass die Teilnehmerseite den Inhalt nicht neu liest, ergibt sich aus dem Code (nur Status-Abos). Beobachtet ist es im Mock-Modus.
- **Inhalte:** Spruchtexte und Drehbuch fachlich nicht bewertet. Die Schreibweise „1/5/16//22“ für Stärken ist im Drehbuch durchgängig und wurde nicht als Fehler gewertet.

## Abschluss

- **Aufgabe geschafft:** ja (klassisch vollständig, mit Profil); Führungsstellen-Übung ja, mit Umweg beim Papier (Uhrzeiten) und beim Erfassen der Reaktionen
- **Fremde Hilfe nötig:** nein
- **Größtes Missverständnis:** Nach dem Überschreiben glaubt ein Sprecher, sein Handy zeige die aktuelle Übung, und funkt alte Texte, deren Haken die Leitung als neue Sprüche verbucht.
- **Größtes Einsatzrisiko:** Bei verspätetem Start einer Führungsstellen-Übung laufen Drehbuch und Leitungs-PDF mit anderen Uhrzeiten als der Bildschirm, gerade dann, wenn man wegen Netzausfall auf Papier wechseln muss.
- **Top-Priorität für die nächste Iteration:** Offene Teilnehmerseiten bei geändertem Inhalt sichtbar zum Neuladen zwingen (N1).

---

## Abgleich mit dem Lauf vom 2026-10-05

| Alte ID | Titel (kurz) | Alte Prio | Status jetzt | Beleg aus dieser Prüfung |
|---|---|---|---|---|
| W1 | Geplanter Beginn ohne Prüfung übernommen | P2 | behoben | Knopf heißt „05:44 übernehmen (liegt 46 min zurück)“. Klick fragt: „Der geplante Beginn 05:44 liegt 46 Minuten zurück. Übernimmst du ihn, sind sofort 21 Einspielungen überfällig – bei allen Rollen.“ Nach „Abbrechen“ folgt „Stattdessen jetzt starten (X-Zeit-Basis 06:30)?“ (`f03`). Spätere Basisänderung fragt mit Überfällig-Zahlen vorher/nachher, danach gibt es „Rückgängig“. Restthema: N7. |
| W2 | Rollen sehen ihren Rückstand nicht | P2 | behoben | EA 1: „4 fällig, älteste seit 24 min · Nächste in 5:01“ und unter der Fokuskarte „⚠ 3 weitere Meldungen fällig, diese seit 24 min“ (`f05`); Stab: „3 fällig, älteste seit 23 min“. |
| W3 | Überschreiben lässt alte Status stehen | P2 | behoben | Rückfrage nennt „Der Übungsstand wird für alle zurückgesetzt …“. Ergebnis: „Übung überschrieben, der Übungsstand ist für alle zurückgesetzt.“ Leitung zeigt für alle „0 / 6 · noch nichts abgesetzt“ (`d03`). Neuer Folgebefund für offene Teilnehmerseiten: N1. |
| W4 | Kein Auswertungsergebnis für die beübte Stelle | P2 | teilweise | Leitungs-PDF FS jetzt mit Spalten X-Zeit, Weg · Meldeart, Erwartete Reaktion, Eingespielt, „Reaktion (Ist) / Notiz“, Seite 1 „Reaktionen: 1 abweichend · 2 ausstehend“, Nr. fortlaufend. Plan-Zeile „Ausdruck · Auftrag“ zeigt den Betreff („Einsatzauftrag Nr. 1 – …“). Offen: kein Debrief für die beübte Stelle (Zeile „–“), Rollen-Debrief weiter mit „Lösungswort –/–“, „Stärke –/–“ (N3). |
| W5 | Vordruck öffnet auf Seite 1, Knopf toggelt zurück | P3 | behoben | Mit 2 abgehakten Sprüchen öffnet der Meldevordruck auf „Seite 3 / 8“. Nach dem Tipp wird der Knopf zu „✓ abgesetzt 06:25“ (nicht klickbar), daneben „Zurücknehmen“ separat und „Weiter“. „Weiter“ + Tipp setzt Nr. 4 ab, keine Rücknahme (`b07-…tap0/1`). Ein automatisches Weiterblättern gibt es nicht, „Weiter“ steht aber direkt daneben. |
| W6 | Kein Rückweg zur eigenen Übung | P3 | behoben | `/` in neuem Tab: „Zuletzt in diesem Browser erstellt: Dienstabend Sprechfunk – Übungscode Z8B8TM · 06.10., 06:23“ (`a06`). Zusätzlich lassen sich die Eingaben per Profil sichern. |
| W7 | Kein Abschluss, Debriefs nur einzeln | P3 | offen | Drei einzelne „Debrief (PDF)“-Knöpfe, keine Sammelaktion, kein „Übung beenden“ (N3). |
| W8 | FS-ZIP mit leerem Ordner für die beübte Stelle | P3 | behoben | FS-ZIP: `Teilnehmer/` enthält nur 21/10, 22/10, 23/10 und Kater Oldenburg. LIESMICH: „die beübte Stelle hat keinen Ordner“, dazu `Ausgangslage_beuebte_Stelle.pdf`. |
| W9 | Kleinere Brüche (Fehler-Toast, Nummern, Prozentwerte, Datum) | P3 | teilweise | Fehler nach leerem Generieren stehen im Kasten `#generatorFehler` (0 Toasts) und sind nach erfolgreicher Generierung weg. Leitungs-PDF nummeriert wie der Bildschirm (1, 2, 3 … mit „Abs.-Nr.“). Leitungskopf „Datum 08.10.2026“. Offen: Prozentwerte driften beim Wiederöffnen (N9). |
