Befunde: P0=0 P1=0 P2=1 P3=7
Abgleich: behoben=5 teilweise=4 offen=0 nicht-pruefbar=0

# THW-Review „Erstnutzer ohne Einweisung“ (new-user), dritter Lauf vom 2026-10-06

**Perspektive:** Ein THW-Helfer, praktisch-technisch versiert, kennt Sprechfunk aus der Ausbildung.
Er hat die Anwendung noch nie gesehen und liest vorher keine Anleitung.

**Geprüfte Rollen:**
- Ausbilder legt eine Übung an: Generator, Desktop 1440×900, zusätzlich Pixel 7
- Teilnehmer auf dem Pixel 7, über den Link aus der Linktabelle
- Übungsleitung während der Übung: Desktop, im selben Browser-Kontext wie ein zweiter Teilnehmer
- X-Zeit-Übung, durchgespielt mit Cockpit und Teilnehmer bei 412 px Breite
- Gespeicherte Übungen (`#/admin`)
- Szenario und Führungsstellen-Übung, nur das Formular

**Umgebung:** lokaler Build unter `http://127.0.0.1:3000`, Mock-Firestore (`useFirestoreEmulator`).
Playwright mit Chromium aus `/opt/pw-browsers/chromium-1194`, `locale: de-DE`.
Die Screenshots liegen unter `scratchpad/new-user/`. Die Dateinamen stehen jeweils beim Befund.

**Kontext:** Ein Ausbildungswerkzeug für Dienstabende, kein Echteinsatzsystem.

## Urteil aus Sicht der Rolle

Die Grundaufgabe gelingt ohne fremde Hilfe: Übung anlegen, Links verteilen, als Teilnehmer abhaken, als Leitung verfolgen.

**Generator.** Die Startseite trennt deutlich zwischen „Ich nehme teil“ (Codes eingeben) und „Ich erstelle eine Übung“.
- Wer naiv auf „Übung generieren“ klickt, bekommt an jedem fehlenden Feld eine verständliche Meldung (`03-naiv.png`).
- Die Vorlagen sind jetzt mit Lage, Anzahl und Herkunft beschrieben.
- Die Linktabelle sagt, wer welchen Link bekommt. Codes heißen überall gleich: „Übungscode … · Teilnehmercode …“ (`07-links.png`).
- Nach dem Generieren steht auf der Startseite „Zuletzt in diesem Browser erstellt“ (`16-start-mobil.png`).

**Teilnehmer (Handy).** Er sieht große Karten mit „Als abgesetzt markieren“, dazu „Rückgängig“ und „Zurücknehmen“ (`10-tn-mobil.png`, `12-tn-nach-absetzen.png`).
- Die Vordruck-Vorschau hat Touch-Knöpfe (`14-tn-meldevordruck.png`).
- Im X-Zeit-Modus wartet der Teilnehmer verständlich auf die Leitung. Danach steht der fällige Spruch oben (`50-x-tn-vor.png`, `53-x-tn-nach.png`).

**Leitung.** „Gemeldet“ ist erklärt, die Absender-Nummer steht in „Als Nächstes“, und die Stärke ist als „Erwartete Summe der an sie gemeldeten Stärken“ beschriftet (`20-ul.png`).

**Wo Reibung bleibt:**
- Die Stärkeaufgabe ist nur auf Seiten der Leitung erklärt. Der Teilnehmer erfährt nicht, dass er Stärken addieren und melden soll.
- Kleinere Wortfragen: „alles gesendet“ in der Kopfzeile, DTG als Zeitangabe in Tabellen, englische Restbegriffe.
- Kleinere Ungereimtheiten: ein Fehlerbanner, das nach dem Korrigieren stehen bleibt; eine Dauerformel, die nicht zur angezeigten Zahl passt; „3 hinter Plan“ eine Sekunde nach dem Start.

## Befunde

### P2-1: Die Stärkeaufgabe ist beim Teilnehmer nirgends erklärt, die Eingabefelder der Leitung sind unbeschriftet

1. **Priorität:** P2
2. **Fundstelle / Aufgabe:**
   - Teilnehmeransicht `#/teilnehmer?uc=…&tc=…` auf dem Pixel 7 (`10-tn-mobil.png`, `11-tn.txt`)
   - Übungsleitung `#/uebungsleitung/<id>`, Spalte „STÄRKE-SUMME“ (`20-ul.png`, `22-ul.txt`)
   - Generator, Option „Automatische Ergänzung von Stärkemeldungen“
3. **Beobachtung:**
   - Bei der Leitung steht in der Zeile von Heros Oldenburg 21/11: „Erwartete Summe der an sie gemeldeten Stärken (F/UF/H/Ges): 5/14/35/54“. Daneben sind vier leere Felder F/UF/H/Ges.
   - Ich habe die Summe nachgerechnet. Spruch 18 (2/8/6/16) und Spruch 20 (3/6/29/38) gehen an 21/11. Sie ergeben 5/14/35/54, die Anzeige stimmt also.
   - Der Teilnehmer 21/11 sieht in seiner Ansicht nur seine eigenen ausgehenden Sprüche. Einige davon enden mit „Aktuelle Stärke: 2/1/5/8“.
   - Dass er die bei ihm eingehenden Stärken addieren und die Summe melden soll, steht nirgends: nicht in der Kopfkarte, nicht über der Liste, nicht im Vordruck. In `src/teilnehmer/` kommt das Wort „Summe“ nicht vor.
   - Der Generator sagt nur: „Die Summe prüft die Übungsleitung.“
   - Was die Leitung in die vier Felder einträgt, steht nicht dran. *Annahme:* Gemeint ist die vom Teilnehmer gemeldete Summe.
4. **Erwartung der Rolle:**
   - Als Teilnehmer: „Zähl die Stärken zusammen, die du empfängst, und melde die Summe am Ende an Heros Wind 10.“
   - Als Leitung: Über den Feldern steht „Vom Teilnehmer gemeldet“.
5. **Auswirkung im Einsatz (Übungsbetrieb):**
   - Ohne mündliche Einweisung meldet kein Teilnehmer eine Summe, und die Felder der Leitung bleiben leer.
   - Die Stärkeauswertung, die der Generator standardmäßig einschaltet, ist dann für die Nachbesprechung wertlos. Oder der Ausbilder muss sie am Abend erst erklären.
6. **Empfehlung:**
   - In der Teilnehmeransicht einen kurzen Auftrag einblenden, sobald Stärkemeldungen an die Stelle gehen. Ebenso auf der Teilnehmer-Übersicht im PDF.
   - Die Felder der Leitung als „gemeldet“ beschriften und Abweichungen zur erwarteten Summe kenntlich machen.
7. **Verifikation:** Ein Teilnehmer ohne Einweisung meldet am Ende ungefragt die Stärkesumme. Die Leitung weiß, wohin sie sie einträgt.

### P3-1: „alles gesendet“ in der Teilnehmer-Kopfkarte, obwohl noch nichts abgesetzt ist

1. **Priorität:** P3
2. **Fundstelle:**
   - Teilnehmer-Kopfkarte, Chip „Übungsleitung: live · alles gesendet 06:23“ (`10-tn-mobil.png`, `50-x-tn-vor.png`; Quelle `src/teilnehmer/ansichtHelfer.ts:71`)
   - X-Zeit-Karte „Meldung 1 fällig · X+0“ (`53-x-tn-nach.png`)
3. **Beobachtung:**
   - Der grüne Chip sagt schon beim ersten Öffnen „alles gesendet“. Darunter stehen zehn Karten mit „OFFEN“.
   - Gemeint ist laut Tooltip, dass alle Abhak-Markierungen beim Server angekommen sind.
   - „Senden“ ist im Sprechfunk aber genau die Tätigkeit, die der Teilnehmer gleich ausführen soll.
   - Dazu kommen drei Wörter für dasselbe: die Liste nennt „Nr. 1“, der X-Zeit-Kasten „Meldung 1 fällig“, die Rückmeldung „Spruch 1 als abgesetzt markiert“.
4. **Erwartung der Rolle:** Der Status der Verbindung ist als Verbindung beschriftet, zum Beispiel „Verbunden · alles übertragen“. Ein Spruch hat überall denselben Namen.
5. **Auswirkung:** Kurzes Stocken: „Ich habe doch noch gar nichts gesendet?“ Ein falsches Handeln ist nicht wahrscheinlich, weil die Karten deutlich „OFFEN“ zeigen.
6. **Empfehlung:** Ein Wort für die Übertragung zur Leitung, das nicht mit Funkbegriffen kollidiert, etwa „bei der Leitung angekommen“. „Spruch“ oder „Nr.“ durchgängig verwenden.
7. **Verifikation:** Ein Erstnutzer erklärt den grünen Chip richtig, ohne ihn anzutippen.

### P3-2: Die Fehlermeldung im Generator bleibt nach dem Korrigieren stehen

1. **Priorität:** P3
2. **Fundstelle:** Generator, rote Box `#generatorFehler` unter „Übung generieren“ (`03-naiv.png`, `05-ausgefuellt-full.png`)
3. **Beobachtung:**
   - Nach einem Klick auf „Übung generieren“ mit leerem Formular erscheint: „Bitte den Funkrufnamen der Übungsleitung eintragen … Bitte mindestens eine Funkspruch-Vorlage auswählen. Bitte mindestens einen Teilnehmer …“.
   - Danach habe ich Leitung, drei Teilnehmer und eine Vorlage ausgefüllt. Die Box steht weiter unverändert da. Die Feldmarkierungen an den Eingaben sind dagegen verschwunden.
   - Erst ein erneuter Klick auf „Übung generieren“ räumt die Box ab.
4. **Erwartung der Rolle:** Die Meldung verschwindet oder schrumpft, sobald der Fehler behoben ist.
5. **Auswirkung:** Der Nutzer sucht, was noch fehlt, obwohl alles da ist. Das kostet ein paar Sekunden.
6. **Empfehlung:** Die Sammelmeldung bei jeder Feldänderung neu prüfen oder beim Ändern ausblenden.
7. **Verifikation:** Naiv generieren, dann alle Felder füllen. Die rote Box ist ohne weiteren Klick weg.

### P3-3: Die Vorlagennamen in der Auswahl verraten weiter nur den Ort

1. **Priorität:** P3
2. **Fundstelle:** Generator, Auswahl `#funkspruchVorlage` (`04-vorlagen-dropdown.png`), darunter die Liste „Was steckt in den Vorlagen?“ (`06-ergebnis-full.png`)
3. **Beobachtung:**
   - In der aufgeklappten Auswahl stehen weiter „Funksprüche THW Leer / Melle / Essen / Lehrte / Saarstedt“.
   - Lage, Umfang und Herkunft stehen jetzt gut lesbar in einer eigenen Liste darunter, etwa „THW Leer: Sturm- und Hochwasserlage in Ostfriesland … 118 Sprüche · aus einer gefunkten Übung“.
   - Wer nur die Auswahl benutzt, muss zwischen Auswahl und Liste hin und her lesen. Einen Beispielspruch gibt es nicht.
   - Die Spaßvorlage ist jetzt klar abgesetzt („Zum Auflockern … nicht für die fachliche Ausbildung“).
4. **Erwartung der Rolle:** Die Lage steht schon im Eintrag selbst, zum Beispiel „THW Leer – Sturm/Hochwasser Ostfriesland (118)“.
5. **Auswirkung:** Gering. Die Information ist da, nur einen Schritt entfernt.
6. **Empfehlung:** Ein Stichwort zur Lage in den Auswahltext übernehmen und optional einen Beispielspruch je Vorlage zeigen.
7. **Verifikation:** Ein Erstnutzer findet „Unwetter, THW“, ohne die Liste darunter zu lesen.

### P3-4: Zeit- und Zahlenformate uneinheitlich, englische Restbegriffe bei der Leitung

1. **Priorität:** P3
2. **Fundstelle:** Übungsleitung (`20-ul.png`, `22-ul.txt`), Admin (`30-admin.txt`), Generator-Statistik (`08-stats.png`), Kopfzeile aller Seiten
3. **Beobachtung:**
   - **Zeitangaben bei der Leitung:**
     - In der Teilnehmerzeile stehen „zuletzt 060623oct26“ und „angemeldet 060623oct26“.
     - Im Nachrichtenplan steht im Status-Chip „Leitung 06:23“, in der Spalte ZEIT daneben „060623oct26“.
     - Das Übungsdatum ist jetzt lesbar („Datum 06.10.2026“).
   - **Uhr in der Kopfzeile:** „060623oct26“ hat nur einen Tooltip. Auf dem Handy ist er nicht erreichbar.
   - **Zahlen im Admin und in der Statistik:**
     - Admin: „10.0“, „3.0“, „0.0%“, „100.0%“
     - Statistik: „192.40 Sek“
     - Das sind Dezimalpunkte statt Kommas.
   - **Englische und technische Begriffe:** „Debrief (PDF)“ unter der Überschrift „NACHBESPRECHUNG“, „Heatmap & Timeline“, „ETA“, „kein Live-Gerät“. Sie sind in „Was bedeuten die Kennzahlen?“ zum Teil erklärt, aber zugeklappt.
   - **Tempo:** „Tempo: 21,2 Sprüche/min“ erschien nach drei Sprüchen innerhalb weniger Sekunden. Die ETA wartet laut Erklärung auf fünf Sprüche, das Tempo nicht.
4. **Erwartung der Rolle:**
   - Uhrzeiten als „06:23“, Datum als „06.10.2026“, Zahlen mit Komma.
   - Deutsche Wörter, etwa „Nachbesprechung (PDF)“ und „voraussichtliches Ende“.
5. **Auswirkung:** Die Leitung liest DTG-Ketten Ziffer für Ziffer. Ein absurd hohes Tempo am Anfang lässt an der ganzen Leiste zweifeln.
6. **Empfehlung:**
   - DTG nur dort, wo es fachlich gefordert ist (Vordruck), sonst HH:MM.
   - Deutsche Zahlenformate verwenden.
   - Die Restbegriffe eindeutschen.
   - Das Tempo erst ab derselben Mindestzahl wie die ETA anzeigen.
7. **Verifikation:** Ein Erstnutzer liest jede Zeit- und Kennzahl ohne Rückfrage vor.

### P3-5: In der Dauerstatistik passt die Formel nicht zur Zahl, die Tabelle ist rechts abgeschnitten

1. **Priorität:** P3
2. **Fundstelle:** Generator → Ergebnis → Reiter „Statistik“ (`08-stats.png`)
3. **Beobachtung:**
   - Die Tabelle zeigt „Optimal 96 Min“ und „Langsam 110 Min“.
   - Darunter steht als Formel: „Langsame Dauer: Optimale Dauer × 1.5“. 96 × 1,5 wären 144 Minuten, angezeigt ist etwa das 1,15-Fache.
   - Bei 1440 px Breite ist die letzte Spaltenüberschrift („DURCHSCHNITTLICHE ZEIT PRO FUNKSPRUCH (…“) am rechten Rand abgeschnitten.
4. **Erwartung der Rolle:** Formel und Zahl stimmen überein. Die Tabelle ist ganz sichtbar.
5. **Auswirkung:** Gering. Der Ausbilder plant den Abend nach einer Zahl, deren Herleitung er nicht nachvollziehen kann.
6. **Empfehlung:** Formeltext und Rechnung angleichen. Die Tabelle umbrechen oder die Spaltentitel kürzen.
7. **Verifikation:** Langsam geteilt durch Optimal ergibt den genannten Faktor. Bei 1440 px und bei 412 px ist keine Spalte abgeschnitten.

### P3-6: Das X-Zeit-Cockpit meldet direkt nach „Jetzt starten“ schon „3 hinter Plan“

1. **Priorität:** P3
2. **Fundstelle:** `#/uebungsleitung/<id>` einer X-Zeit-Übung, `#uebungsleitungCockpit` (`51-x-ul.png`, `52-x-cockpit.png`, `52.txt`)
3. **Beobachtung:**
   - Vor dem Start erklärt das Cockpit verständlich: „Noch keine verbindliche X-Zeit-Basis – setze sie hier, die Teilnehmer übernehmen sie.“
   - Eine Sekunde nach dem Klick auf „Jetzt starten“ zeigt es „Laufzeit 00:56“ und „Fortschritt 0/18 · 3 hinter Plan“, in Rot.
   - Die Basis wird offenbar auf die volle Minute (06:25) gesetzt, und die drei Anmeldungen sind bei X+0 fällig.
   - Der Knopf heißt danach „Neu starten (verschiebt alle Zeiten)“, das ist gut.
4. **Erwartung der Rolle:** Direkt nach dem Start ist nichts verspätet. Die Laufzeit beginnt bei 00:00.
5. **Auswirkung:** Die Leitung zweifelt am Werkzeug oder drückt „Neu starten“ in der Annahme, etwas sei schiefgelaufen.
6. **Empfehlung:** Die Startzeit sekundengenau übernehmen oder X+0-Sprüche erst nach einer Karenz als „hinter Plan“ werten.
7. **Verifikation:** Nach „Jetzt starten“ zeigt das Cockpit 60 Sekunden lang „im Plan“.

### P3-7: Auf dem Handy gibt es zwei Menüs, „Gespeicherte Übungen“ ist nicht verlinkt

1. **Priorität:** P3
2. **Fundstelle:** Kopfzeile auf dem Pixel 7 (`16-start-mobil.png`, `17-mobil-burger.png`), Navigation allgemein
3. **Beobachtung:**
   - **Zwei Menüs auf dem Handy:**
     - Oben rechts sitzt ein Hamburger-Knopf mit Pfeil. Er enthält GitHub, Anleitung, Über den Autor und Dark Mode.
     - Darunter steht „☰ Menü“ mit den Seiten Übung erstellen, Wissen, Funksprüche, Anleitung, FAQ, Über das Projekt und GitHub.
     - Anleitung und GitHub stehen in beiden Menüs.
   - **„Gespeicherte Übungen“ (`#/admin`):**
     - Die Seite ist nur aus der Fehlermeldung der Übungsleitung verlinkt (`src/uebungsleitung/UebungsleitungView.ts:110`), sonst von nirgends.
     - Den Rückweg zur eigenen Übung deckt jetzt „Zuletzt in diesem Browser erstellt“ ab.
4. **Erwartung der Rolle:** Ein Menü. Eine Liste gespeicherter Übungen ist auffindbar, wenn es sie gibt.
5. **Auswirkung:** Gering. Der Nutzer tippt zuerst das falsche Menü an.
6. **Empfehlung:** Die beiden Menüs zusammenführen. Über die Verlinkung von „Gespeicherte Übungen“ bewusst entscheiden.
7. **Verifikation:** Bei 412 px ist genau ein Menüknopf sichtbar.

## Nicht geprüft / Grenzen

- Die Inhalte von ZIP- und PDF-Downloads habe ich nicht geprüft, also auch nicht, ob die Teilnehmer-PDFs einen Stärke-Auftrag enthalten. Gesehen habe ich nur die Vordruck-Vorschau.
- Szenario und Führungsstellen-Übung habe ich nur im Formular geprüft, nicht generiert.
- Datums- und Zeitfelder („10/06/2026“, „06:25 AM“) zeigt der Testbrowser trotz `locale: de-DE` im US-Format. Das hängt vermutlich an der Systemsprache des Headless-Browsers und ist hier nicht abschließend bewertbar.
- Synchronisiert wurde nur zwischen Tabs desselben Browser-Kontexts im Mock. „kein Live-Gerät“ bei 21/11 ist ein Artefakt dieses Aufbaus.

## Abschluss

- **Aufgabe geschafft:** ja
- **Fremde Hilfe nötig:** nein für den Grundablauf. Für die Stärkeaufgabe ja: der Teilnehmer erfährt sie nur mündlich.
- **Größtes Missverständnis:** „alles gesendet“ in der Kopfkarte wird als „alle Sprüche gesendet“ gelesen. Gemeint ist aber die Übertragung der Markierungen.
- **Größtes Einsatzrisiko:** Die standardmäßig eingeschaltete Stärkeprüfung läuft ins Leere, weil kein Teilnehmer weiß, dass er eine Summe melden soll.
- **Top-Priorität für die nächste Iteration:** In der Teilnehmeransicht und im Teilnehmer-PDF einen sichtbaren Auftrag zur Stärkesumme einblenden.

## Abgleich mit dem Lauf vom 2026-10-05

| Alt-ID | Titel (kurz) | Alt-Prio | Status jetzt | Beleg aus diesem Lauf |
|---|---|---|---|---|
| P2-1 | Vorlagen nach Ortsverbänden benannt, Inhalt verborgen | P2 | teilweise | Die Liste „Was steckt in den Vorlagen? Lage, Umfang, Herkunft“ nennt je Vorlage Lage, Anzahl und Herkunft (`02-start.txt`, `06-ergebnis-full.png`). Die Spaßvorlage ist abgesetzt, das Feld hat nur noch einen Platzhalter (`04-vorlagen-dropdown.png`). Offen: Die Auswahl selbst zeigt nur Ortsnamen, es gibt keinen Beispielspruch (neu P3-3). |
| P2-2 | „Soll“-Stärke als Stärke der Funkstelle gelesen | P2 | teilweise | Die Spalte heißt „STÄRKE-SUMME“, die Zeile „Erwartete Summe der an sie gemeldeten Stärken“. Die Summe für 21/11 habe ich nachgerechnet, sie stimmt (`20-ul.png`). Offen: kein Auftrag beim Teilnehmer, Eingabefelder unbeschriftet (neu P2-1). |
| P3-1 | „Teilnehmer Code: X / Y“ – zwei Codes unter einem Namen | P3 | behoben | Linktabelle und Leitung zeigen „Übungscode UXKBK6 · Teilnehmercode PP7R“ (`07-links.txt`, `22-ul.txt`). Die Platzhalter auf der Startseite tragen „Z. B.“ (`16-start-mobil.png`). |
| P3-2 | Zwei Nummerierungen zwischen Teilnehmer und Leitung | P3 | behoben | „Als Nächstes: Nr. 4 · Heros Oldenburg 21/11 (Abs.-Nr. 2) → …“. Tooltip und Kennzahlen-Erklärung nennen „Abs.-Nr. ist die Nummer beim Absender“ (`20-ul.png`, `lageMarkup.ts:47`). |
| P3-3 | „GEMELDET (TN)“ und „Bestätigen“ ohne Erklärung | P3 | behoben | Sichtbarer Satz unter der Lage-Leiste: „‚Gemeldet‘ heißt: der Teilnehmer hat abgehakt. Bestätige, wenn du den Spruch gehört hast …“ (`20-ul.png`). |
| P3-4 | Kennzahlenleiste und Datumsangaben kryptisch | P3 | teilweise | „Tempo: 21,2 Sprüche/min“, „Funklast: sendet am meisten … / empfängt am meisten …“, „Sprüche je 5 min“, dazu die aufklappbare Erklärung. Das Übungsdatum steht als „06.10.2026“ da (`22-ul.txt`). Offen: DTG in Zeitspalten, Kopfuhr ohne sichtbare Beschriftung, „Debrief“, „ETA“ (neu P3-4). |
| P3-5 | Zwei Menüs auf dem Handy, „Gespeicherte Übungen“ nicht auffindbar | P3 | teilweise | Neu ist „Zuletzt in diesem Browser erstellt: Dienstabend Funk – Übungscode UXKBK6“ (`16-start-mobil.png`). Offen: zwei Menüknöpfe (`17-mobil-burger.png`), `#/admin` nur aus der Fehlermeldung verlinkt (neu P3-7). |
| P3-6 | Führungsstellen-Übung: Leitung und übergeordnete Stelle doppelt gefragt | P3 | behoben | Unter „Funkrufname der Übungsleitung“ steht jetzt, dass er nur als Betriebsleitung auf den Ausdrucken erscheint. Die leere Überschrift ist weg, die Platzhalter sind vollständig, der Erklärtext steht über den Feldern (`41-fuehrungsstelle.png`). |
| P3-7 | Übungsdauer widerspricht sich zwischen Generator und Admin | P3 | behoben | Der Admin nennt den Wert jetzt „Ø reine Sprechzeit je Übung (grob, 15 s je Spruch): 7 Min 30 Sek“, also erkennbar eine andere Größe als „Dauer (optimal): 96 Min“ (`30-admin.txt`, `06-ergebnis-full.png`). Neu entdeckt: Die Formel in der Statistik passt nicht zur Zahl (P3-5). |
