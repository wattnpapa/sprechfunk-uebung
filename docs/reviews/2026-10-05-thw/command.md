Befunde: P0=0 P1=0 P2=3 P3=4
Abgleich: behoben=7 teilweise=4 offen=1 nicht-pruefbar=0

# THW Command Reviewer – Übungsleitung als Führungsstelle (zweiter Lauf)

Datum: 2026-10-05 · Reviewer: `command` (Skill `thw-command-reviewer`)
Build: lokal unter `http://127.0.0.1:3000`, Mock-Firestore (`useFirestoreEmulator=1`, `e2eFirestoreSeed`)
Screenshots: `/tmp/claude-0/-home-user-sprechfunk-uebung/8e81b214-a84b-574f-81cf-240dddbe65b9/scratchpad/command/` (nicht eingecheckt)

## Rolle und Prüfumfang

Ich prüfe aus der Sicht der Person, die die Übung leitet. Sie sitzt am Dienstabend an der
Übungsleitung (Desktop), muss den Stand aller Teilnehmer erfassen, Verzug erkennen und den
Stand notfalls an eine zweite Person übergeben. Bei der Führungsstellen-Übung spielt sie nach
Drehbuch ein. Die App ist ein **Ausbildungswerkzeug**. Die Prioritäten beziehen sich auf den
Übungsablauf und die Auswertung, nicht auf Gefahren im Einsatz.

Real durchgespielt (Playwright, Chromium, 1440×900 und Pixel 7):

1. Klassische Übung, 5 Teilnehmer, 10 Sprüche je Teilnehmer → Links (`01`)
2. Teilnehmer 21/11 meldet zwei Nachrichten am eigenen Gerät
3. Übungsleitung: Lagezeile, Anmeldungs-Funkspruch von 24/14 im Plan abgehakt, 22/12 über die
   Tabelle angemeldet, drei schnelle Klicks auf die erste Aktion (`02`, `03`, `04`, `05`),
   Sprung über „Als Nächstes“ (`06`), Reload, zweiter Tab (`07`), Rücksetzen bis zum Dialog
   ausgelöst und abgebrochen (`08`, `08b`)
4. X-Zeit-Übung, Intervall 1 min, 4 Teilnehmer, Basis 10 min in der Vergangenheit gesetzt
   (`10`–`14`), Klick auf „12 überfällig – zur ersten“ und auf das Cockpit-Badge
5. Übungsleitung derselben X-Zeit-Übung auf Pixel 7 (`15`, `16`)
6. Führungsstellen-Übung „hochwasser-fuehrungsstelle“, Beginn 20 min in der Vergangenheit,
   Vorschlag im Cockpit übernommen (`20`–`24`)
7. Admin `#/admin` (`30`)

Nicht prüfbar: echtes Live-Sync über zwei Geräte. Ein zweiter Browser-Kontext hat im Mock einen
eigenen `localStorage`. Die in Schritt 4 gesetzte Basis kam dort nicht an (`15`: „Noch keine
verbindliche X-Zeit-Basis“). Das ist im Mock erwartbar und hier **nicht** als Befund gewertet.
Die PDF-Inhalte habe ich nicht geöffnet.

## Urteil aus Sicht der Rolle

Gegenüber dem ersten Lauf hat die Übungsleitung einen großen Schritt gemacht. Direkt unter dem
Kopf steht jetzt eine **Lagezeile**: offen je Teilnehmer, „n zu bestätigen“, die nächsten drei
Nachrichten als Sprungknöpfe und im X-Zeit-Modus „12 überfällig – zur ersten“ (`11`). Im Plan
tragen die Zeilen eine eindeutige Plan-Nummer, die Absendernummer, eine Soll-Uhrzeit mit X+n und
ein Text-Badge „überfällig 10 min“. Die Zeilen unterscheiden sich farbig nach überfällig, fällig
und später (`13`). Anmeldung und Anmeldungs-Funkspruch sind gekoppelt. Bei „ABGESETZT“ steht,
wer markiert hat („Leitung 21:01 / TN 21:01“). Der geplante Beginn aus dem Generator erscheint
im Cockpit als Vorschlag „20:42 übernehmen“ und wird erst durch einen Klick verbindlich (`21`).
Die beübte Stelle ist in der Teilnehmertabelle als eigene Rolle ohne Code gekennzeichnet (`22`).

Die verbleibende Reibung liegt dort, wo die Leitung **bewerten oder entscheiden** muss. Bei der
Führungsstellen-Übung lässt sich nicht strukturiert festhalten, ob die erwartete Reaktion kam.
Bei Verzug gibt es keinen Weg, eine Einspielung bewusst auszulassen, sie bleibt dauerhaft
„überfällig“. Auf dem Smartphone ist Abhaken möglich, den Inhalt der Zeile sieht man aber nicht.

Ohne fremde Hilfe erledigbar: **ja**. Auch unter dem Zeitdruck einer X-Zeit-Übung ist das jetzt
weitgehend ohne Umwege möglich.

## Befunde

### P2-1 – Führungsstellen-Übung: Die Reaktion der beübten Stelle ist nicht strukturiert erfassbar

- **Fundstelle / Aufgabe:** `#/uebungsleitung/<id>` einer Führungsstellen-Übung, Plan-Zeile und
  Lagezeile (`22`, `24`). Ich will während und nach der Übung wissen, welche Erwartungen die
  beübte Stelle erfüllt hat.
- **Beobachtung:** Jede Plan-Zeile zeigt Weg und Meldeart als Badge, den Text und „Erwartet: …“
  (z. B. „Anmeldung quittieren, Stärke 1/5/16//22 in die Kräfteübersicht …“). An Bedienelementen
  hat die Zeile nur „Als abgesetzt markieren“, „+ Notiz“ und „Zeit nachtragen“. Für die Reaktion
  gibt es weder einen Zustand noch einen Knopf. Die Lagezeile zählt „offen“ je **Einspieler**
  („Heros Musterstadt 22/10: 19 offen“, „Kater Musterstadt: 18 offen“). Ausgerechnet über die
  beübte Stelle, um die es geht, sagt sie nichts. Die Tabellenzeile der beübten Stelle meldet nur
  „empfängt 73 Einspielungen“.
- **Erwartung der Rolle:** Je Einspielung neben „eingespielt“ ein schneller Vermerk „Reaktion
  erfolgt / ausstehend / abweichend“ und in der Lagezeile eine Summe dazu, etwa „beübte Stelle:
  12 erfüllt, 3 ausstehend, 1 abweichend“.
- **Auswirkung:** Der eigentliche Prüfgegenstand der Stabsrahmenübung ist nur in Freitextnotizen
  festgehalten. Eine Nachbesprechung oder Übergabe an eine zweite Leitung muss diese Notizen
  einzeln lesen. Was ausblieb, geht leicht unter.
- **Empfehlung:** Je Einspielung eine optionale Bewertung der Erwartung mit einem Klick anbieten
  und in Lagezeile, Übungsleitungs-PDF und Debrief übernehmen. Ausstehende Reaktionen mit Alter
  anzeigen („Reaktion ausstehend seit 6 min“).
- **Verifikation:** Führungsstellen-Übung starten, drei Einspielungen absetzen und zwei davon als
  „Reaktion erfolgt“ bewerten. Die Lagezeile zeigt „2 erfüllt, 1 ausstehend“, und das PDF enthält
  denselben Stand.

### P2-2 – Bei Verzug fehlt die Entscheidung „auslassen“, und „Als Nächstes“ zeigt nur den Rückstand

- **Fundstelle / Aufgabe:** X-Zeit- bzw. Führungsstellen-Übung mit Verzug (`11`, `22`). Ich muss
  entscheiden, ob ich Rückstand nachspiele oder auf den aktuellen Takt springe.
- **Beobachtung:** Bei Basis X−10 min zeigt die Lagezeile „Als Nächstes“ die drei ältesten
  überfälligen Nachrichten (alle „überfällig 10 min“). Die zwei Zeilen, die gerade „jetzt fällig“
  sind (`data-plan-zustand="faellig"`, im Plan vorhanden), erscheinen dort nicht. Für eine Zeile
  gibt es nur die Zustände OFFEN, GEMELDET und ABGESETZT. Eine bewusst ausgelassene Einspielung
  bleibt für immer „überfällig“ und zählt weiter in „12 überfällig“ und „hinter Plan“.
- **Erwartung der Rolle:** In der Lagezeile sowohl „überfällig“ als auch „jetzt dran“ sehen. Eine
  Einspielung als „entfällt“ oder „ausgelassen“ markieren können, damit sie aus der Verzugszahl
  verschwindet und in der Auswertung erkennbar bleibt.
- **Auswirkung:** Wer nach einer Unterbrechung (Annahme: Funkstörung oder Pause am Dienstabend)
  bewusst auf den aktuellen Takt springt, behält ein dauerhaft rotes Lagebild. Echter neuer
  Verzug ist dann nicht mehr von bewusst Übersprungenem zu unterscheiden. Die Alternative ist,
  ausgelassene Einspielungen als „abgesetzt“ zu markieren. Das verfälscht die Auswertung.
- **Empfehlung:** Einen Zustand „ausgelassen“ mit Rückgängig einführen, der nicht in Verzug und
  Fortschritt zählt und im PDF eigens erscheint. In „Als Nächstes“ mindestens die erste
  „jetzt fällige“ Zeile neben dem ältesten Rückstand zeigen.
- **Verifikation:** Basis X−10 setzen, fünf überfällige Zeilen auslassen. Die Zahl „überfällig“
  sinkt um fünf, und „Als Nächstes“ zeigt eine Zeile „jetzt fällig“.

### P2-3 – Übungsleitung auf dem Smartphone: Abhaken möglich, Inhalt der Zeile nicht sichtbar

- **Fundstelle:** `#/uebungsleitung/<id>` auf Pixel 7 (412 px), Nachrichtenplan (`16`).
- **Beobachtung:** Die Seite selbst scrollt nicht mehr seitlich (`scrollWidth` = 412). Nr, Status
  und „Als abgesetzt markieren“ stehen links und sind erreichbar. Die Spalte Empfänger ist nach
  wenigen Zeichen abgeschnitten („Her / Old / 24/1“). Sender, Nachricht, Soll und Zeit liegen
  außerhalb des sichtbaren Bereichs und sind nur über seitliches Scrollen innerhalb der Tabelle
  erreichbar. Jede Zeile ist dadurch etwa 400 px hoch.
- **Erwartung der Rolle:** Eine zweite Leitung, die mit dem Handy durch den Raum geht, sieht pro
  Zeile mindestens Sender → Empfänger, Soll-Uhrzeit und Status, bevor sie abhakt.
- **Auswirkung:** Am Handy hakt man nach Plan-Nummer ab, ohne zu sehen, welcher Spruch das ist.
  Das kann zum Abhaken der falschen Zeile führen. Annahme: Die Leitung sitzt meist am Laptop,
  daher P2.
- **Empfehlung:** Plan unterhalb einer Breite als Karten zeigen: Kopfzeile „Nr · Sender →
  Empfänger · Soll“, darunter Status und Aktion, Text einklappbar.
- **Verifikation:** Bei 412 px sind Sender, Empfänger, Soll-Uhrzeit und Abhak-Knopf jeder Zeile
  ohne seitliches Scrollen lesbar.

### P3-1 – Zwei verschiedene Verzugszahlen nebeneinander

- **Fundstelle:** Cockpit und Lagezeile (`11`, `22`).
- **Beobachtung:** In der X-Zeit-Übung steht im Cockpit „14 hinter Plan“ und direkt darunter
  „12 überfällig – zur ersten“. In der Führungsstellen-Übung sind es „11 hinter Plan“ und
  „9 überfällig“. Die Differenz sind die „jetzt fälligen“ Zeilen. Erklärt wird das nirgends.
- **Empfehlung:** Eine Zahl führen oder beide erklären, etwa „14 hinter Plan (12 überfällig,
  2 jetzt fällig)“.
- **Verifikation:** Cockpit und Lagezeile ergeben ohne Rechnen dieselbe Aussage.

### P3-2 – Teilnehmertabelle mit Erfassungsfeldern trennt Lage und Plan

- **Fundstelle:** `#/uebungsleitung/<id>`, klassisch (`04`, Seitenhöhe ca. 7.300 px bei
  50 Nachrichten).
- **Beobachtung:** Die Lagezeile beantwortet die Lagefrage jetzt oben. Zwischen ihr und dem Plan
  steht aber weiterhin die volle Teilnehmertabelle mit Stärkefeldern (F/UF/H/Ges) und großen
  Notizfeldern, etwa 450 px bei 5 Teilnehmern. Wer im Plan arbeitet, scrollt jedes Mal daran
  vorbei. Heatmap und Timeline liegen weiter am Seitenende, sind aber über einen Knopf in der
  Lagezeile erreichbar.
- **Empfehlung:** Teilnehmertabelle einklappbar machen oder Stärke und Notiz erst auf Klick
  zeigen, wie es bei den Plan-Notizen schon gelöst ist („+ Notiz“).
- **Verifikation:** Bei 1440×900 ist nach dem Laden die erste offene Plan-Zeile höchstens einen
  Bildschirm unter der Lagezeile.

### P3-3 – „Abgesetzte ausblenden“ übersteht keinen Reload

- **Fundstelle:** Lagezeile `[data-action='lage-hide']`.
- **Beobachtung:** Nach Klick auf „Abgesetzte ausblenden“ und einem Reload steht wieder
  „Abgesetzte ausblenden“, die erledigten Zeilen sind wieder sichtbar. Der Code startet mit
  `hideAbgesetzt = false` (`src/uebungsleitung/index.ts:51`).
- **Empfehlung:** Die Ansichtseinstellung pro Gerät merken.
- **Verifikation:** Ausblenden, neu laden, die Einstellung bleibt erhalten.

### P3-4 – Eingabe der X-Zeit-Basis im 12-Stunden-Format

- **Fundstelle:** Cockpit `#cockpitXZeitBasisInput` (`11`, `22`).
- **Beobachtung:** Das native Zeitfeld zeigte im Testbrowser „08:52 PM“, während Uhrzeit,
  Hinweistext und Plan 24-Stunden-Zeit verwenden („Basis 20:52 …“). Annahme: Das Format hängt
  von der Sprache des Browsers bzw. Betriebssystems ab. Auf deutsch eingestellten Geräten tritt
  es vermutlich nicht auf.
- **Empfehlung:** Prüfen, ob sich das Feld unabhängig vom Gerät auf 24 Stunden festlegen lässt,
  oder den gesetzten Wert daneben in 24-Stunden-Form wiederholen (das geschieht im Hinweistext
  bereits).
- **Verifikation:** Auf einem englisch eingestellten Browser zeigt das Feld oder seine
  Beschriftung die Basis in 24-Stunden-Form.

## Was gut funktioniert (beibehalten)

- Lagezeile mit offen je Teilnehmer, „n zu bestätigen“, „Als Nächstes“ als Sprungknöpfe und dem
  Sprung „n überfällig – zur ersten“, der die Zielzeile hervorhebt (`12`).
- Überfällig, fällig und später sind im Plan durch Farbe **und** Text unterscheidbar. Dazu kommen
  Soll-Uhrzeit und X+n in einer eigenen Spalte (`13`).
- Plan-Nummer 1…n eindeutig, Absendernummer darunter („Abs.-Nr. 2“).
- Herkunft je Status: „Leitung 21:01 / TN 21:01“, „Teilnehmer: 052100oct26“, Fortschritt je
  Teilnehmer getrennt nach „TN 2 · Leitung 1“, Hinweis „kein Live-Gerät“.
- ETA: Im klassischen Modus erscheint sie erst ab ausreichender Stichprobe („zu wenig Daten“,
  `src/uebungsleitung/auswertung.ts:67`). Im X-Zeit-Modus steht „Ende laut Plan: 21:12 (noch
  23 offen)“.
- Rücksetzen steht abgesetzt am Seitenende und ist nach Reichweite beschriftet („für alle“). Der
  Dialog nennt die Mengen („5 abgesetzte Nachrichten, 0 Notizen und 5 Anmeldungen“) und rät,
  vorher das PDF zu sichern (`08b`).
- Beübte Stelle in der Tabelle als „beübte Stelle“, ohne Code und ohne Anmelde-Knopf.

## Abschluss

- **Aufgabe geschafft:** ja
- **Fremde Hilfe nötig:** nein
- **Größtes Missverständnis:** Eine bewusst übersprungene Einspielung ist für die Software
  dasselbe wie eine vergessene. Beide bleiben „überfällig“.
- **Größtes Einsatzrisiko:** Bei der Führungsstellen-Übung steht nur in Freitextnotizen, ob die
  beübte Stelle die Erwartungen erfüllt hat. Ausgebliebene Reaktionen gehen für Nachbesprechung
  und Übergabe leicht verloren.
- **Top-Priorität für die nächste Iteration:** Je Einspielung eine Bewertung der Reaktion mit
  einem Klick (erfolgt / ausstehend / abweichend), zusammengefasst in der Lagezeile und im PDF.

## Abgleich mit dem Lauf vom 2026-10-04

| Alte ID | Titel | Alte Prio | Status jetzt | Beleg aus dieser Prüfung |
|---|---|---|---|---|
| P1-1 | Fällige/überfällige Nachrichten im Plan nicht erkennbar | P1 | behoben | `13`: Zeilen mit Badge „überfällig 10 min“, roter Rand, Spalte „Soll“ 20:52/X+0. `data-plan-zustand` ergibt 11× überfällig, 2× fällig, Rest später. „12 überfällig – zur ersten“ und Cockpit-Badge springen zur Zeile (`12`, `14`). |
| P1-2 | „Angemeldet“ und Anmeldungs-Funkspruch widersprechen sich | P1 | behoben | Anmelde-Funkspruch von 24/14 im Plan abgehakt → Tabelle „angemeldet 052101oct26“, Fortschritt „1 / 10 · Leitung 1“. 22/12 über die Tabelle angemeldet → Plan-Zeile 2 „ABGESETZT, Leitung 21:01“. 21/11 per Gerät → „angemeldet … vom Teilnehmer gemeldet“. |
| P1-3 | Endlosliste ohne Zusammenfassung | P1 | teilweise | Lagezeile mit offen je TN und „Als Nächstes“ oben (`02`). Plan-Notizen nur auf „+ Notiz“. Die Teilnehmertabelle mit Stärke- und Notizfeldern steht weiter zwischen Lage und Plan, Heatmap und Timeline am Ende (über Knopf erreichbar). Siehe neu P3-2. |
| P2-1 | Tempo/ETA bei wenigen Markierungen irreführend | P2 | behoben | X-Zeit nach einer Markierung: „Tempo: –“, „Ende laut Plan: 21:12 (noch 23 offen)“ (`13`). Klassisch: Mindeststichprobe mit Text „ETA: – (zu wenig Daten)“ (`auswertung.ts:67`). |
| P2-2 | Beübte Stelle und Einspieler gleichrangig, keine Reaktionsbewertung | P2 | teilweise | Beübte Stelle jetzt eigene Zeile „beübte Stelle · kein Teilnehmerlink – wird beübt“ (`22`). Eine Bewertung der Reaktion fehlt weiter (Zeile hat nur Abhaken/Notiz/Zeit). Siehe neu P2-1. |
| P2-3 | Übungsbeginn aus Generator kommt nicht im Cockpit an | P2 | behoben | Cockpit: „20:42 übernehmen“ und „Geplanter Übungsbeginn laut Generator: 20:42. Erst mit ‚Übernehmen‘ verbindlich.“ (`21`). Danach Plan mit „20:43 / X+1“ (`24`). |
| P2-4 | Nachrichtennummer nicht eindeutig | P2 | behoben | Spalte Nr 1…n fortlaufend, darunter „Abs.-Nr. 1“ (`05`, `13`, mobil `16`: 11, 12, 13 … aufsteigend). |
| P2-5 | „Lokale Übungsdaten zurücksetzen“ wirkt für alle | P2 | behoben | Knopf „⟲ Übungsstand für alle zurücksetzen“ in eigenem Bereich am Seitenende, mit Erklärtext. Dialog nennt Mengen und PDF-Tipp (`08`, `08b`). |
| P2-6 | Übungsleitung auf Smartphone abgeschnitten | P2 | teilweise | Status und Abhak-Knopf links erreichbar, keine seitliche Seitenverschiebung. Empfänger, Sender, Text und Soll weiter abgeschnitten (`16`). Siehe neu P2-3. |
| P3-1 | Herkunft bei „ABGESETZT“ fehlt | P3 | behoben | „Leitung 21:01 / TN 21:01“ bzw. „Leitung 21:02“ in der Statuszelle (`03`, `13`). |
| P3-2 | Technische Kennungen vor Lageinformation | P3 | teilweise | Kopf auf eine Zeile verdichtet, Übungscode hervorgehoben. Die UUID steht weiter sichtbar im Kopf, nur kleiner („Übungs-ID: 0923b6b3-…“, `02`), mobil zweizeilig (`15`). |
| P3-3 | Admin-Liste ohne Stand der Übungen | P3 | offen | `#/admin` (`30`): Spalten Erstellt, Name, Datum, Rufgruppe, Leitung, Anzahl, Spielmodus, Funksprüche, Aktionen. Kein Fortschritt und keine letzte Aktivität. |
