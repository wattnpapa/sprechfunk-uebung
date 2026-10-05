Befunde: P0=0 P1=0 P2=2 P3=7
Abgleich: behoben=9 teilweise=3 offen=1 nicht-pruefbar=0

# THW-Review „Erstnutzer ohne Einweisung“ (new-user) – 2026-10-05, zweiter Lauf

**Perspektive:** THW-Helfer, praktisch-technisch versiert, kennt Sprechfunk aus der Ausbildung,
hat die Anwendung aber noch nie gesehen und liest vorher keine Anleitung.
**Rollen geprüft:** Ausbilder legt eine Übung an (Generator, Desktop 1440×900, zusätzlich Pixel 7),
Teilnehmer (Pixel 7, Link aus der Linktabelle), Übungsleitung während der Übung (Desktop, im selben
Browser-Kontext wie ein zweiter Teilnehmer, damit die Mock-Synchronisation greift), Gespeicherte
Übungen (`#/admin`), Quellen-Modi Szenario und Führungsstellen-Übung (nur Formular).
**Umgebung:** lokaler Build `http://127.0.0.1:3000`, Mock-Firestore (`useFirestoreEmulator`),
Playwright mit Chromium 141 (`/opt/pw-browsers/chromium-1194`), `locale: de-DE`.
Screenshots unter `scratchpad/new-user2/` (Dateinamen unten).
**Kontext:** Ausbildungswerkzeug für Dienstabende, kein Echteinsatzsystem.

## Urteil aus Sicht der Rolle

Gegenüber dem ersten Lauf ist die App für einen Erstnutzer deutlich zugänglicher. Der Generator
startet leer und ehrlich: keine Vorlage vorausgewählt, Rufnamen nur als graue Beispiele. Wer
einfach auf „Übung generieren“ klickt, bekommt an jedem fehlenden Feld eine verständliche Meldung
(`03-nach-generieren-naiv.png`). Die Linktabelle sagt jetzt, wer welchen Link bekommt
(„Übung bearbeiten – nur für dich“, „Übung überwachen – für die Übungsleitung“, „Link oder Codes an
diese Funkstelle weitergeben“). Der Teilnehmer-Link öffnet auf dem Handy direkt die eigenen
Sprüche als gut lesbare Karten mit einem großen Knopf „Als abgesetzt markieren“ und einem
„Rückgängig“ (`10-tn-mobil.png`, `13-tn-menue.png`). Die Vordruck-Vorschau wird gezeichnet und
lässt sich per Touch abhaken (`15-tn-meldevordruck.png`). Teilnehmer und Leitung sprechen beide
von „abgesetzt“.

Reibung bleibt dort, wo der Nutzer etwas **auswählen oder auswerten** muss, ohne den Inhalt zu
kennen: Die Vorlagen heißen nach Ortsverbänden („THW Leer“, „THW Melle“ …) und verraten nicht,
welche Lage drinsteckt. Die Leitung sieht eine „Soll“-Stärke je Teilnehmer, die nicht die Stärke
dieser Funkstelle ist. Dazu kommen kleinere Wortfragen (Kennzahlenleiste, DTG ohne Beschriftung,
„Teilnehmer Code“ mit zwei Codes darin).

Die Grundaufgabe – Übung anlegen, Links verteilen, als Teilnehmer abhaken, als Leitung verfolgen –
ist ohne fremde Hilfe zu schaffen.

## Befunde

### P2-1 – Vorlagen sind nach Ortsverbänden benannt, ihr Inhalt bleibt verborgen

1. **Priorität:** P2
2. **Fundstelle / Aufgabe:** Generator `/`, Karte Einstellungen → „Funkspruch-Vorlagen auswählen
   (mindestens eine)“, Auswahlliste `#funkspruchVorlage` / `.multiselect`
   (`05-vorlagen-dropdown.png`, `45-multiselect-mobil.png`, `vorlagen.txt`).
3. **Beobachtung:**
   - Der Hilfetext verlangt: „Wähle die Sammlungen, die zu deiner Einheit passen.“
   - Die Liste nennt aber fünf THW-Sammlungen nur nach Ort: „Funksprüche THW Leer“, „… Melle“,
     „… Essen“, „… Lehrte“, „… Saarstedt“. Ob darin Hochwasser, Sturm, Bergung oder
     Grundausbildungsstoff steckt, steht nirgends. Bei den anderen Organisationen steht die Lage
     dabei („Feuerwehr, Unwetterlage“, „Rettungsdienst, Busunfall mit MANV“).
   - Es gibt keine Vorschau oder Anzahl je Sammlung. Ob die Sprüche aus echten Übungen stammen oder
     für den Generator geschrieben wurden, sieht man hier nicht.
   - „Lustige Funksprüche (Chat GPT)“ steht gleichrangig zwischen den Fachvorlagen. Sie ist nicht
     mehr vorausgewählt, aber nicht als Spaßvorlage abgesetzt.
   - Das Feld zeigt zwei Platzhalter hintereinander: „Vorlagen auswählen ... Vorlage suchen ...“.
4. **Erwartung der Rolle:** Ich sehe an der Auswahl, welche Lage und welcher Schwierigkeitsgrad
   drin ist, und kann einen Beispielspruch ansehen, bevor ich mich festlege.
5. **Auswirkung:** Der Ausbilder wählt nach Bauchgefühl („wir sind THW, also alle THW“) oder nach
   dem nächstgelegenen Ortsnamen. Passen die Sprüche nicht (z. B. Hochwasser-Ostfriesland-Lage
   mit Ortsnamen, die keiner kennt), merkt er es erst nach dem Generieren in der Teilnehmeransicht
   und muss neu generieren.
6. **Empfehlung:** Je Vorlage eine Kurzbeschreibung zeigen (Lage, Organisation, Anzahl, Herkunft
   „aus Übung des OV …“ oder „für den Generator geschrieben“) und einen Beispielspruch. Die
   Spaßvorlage optisch absetzen oder unter „Sonstiges“ führen. Nur einen Platzhalter anzeigen.
7. **Verifikation:** Ein Erstnutzer soll ohne Anleitung die Vorlage für „Sturm/Unwetter, THW“
   finden und vorher sagen, welche Lage er bekommt. Danach generieren und vergleichen.

### P2-2 – „Soll“-Stärke in der Übungsleitung wird als Stärke der Funkstelle gelesen

1. **Priorität:** P2
2. **Fundstelle / Aufgabe:** `#/uebungsleitung/<id>`, Tabelle Teilnehmer, Spalte STÄRKE,
   „Soll (F/UF/H/Ges): 0/5/15/20“ mit vier Eingabefeldern F/UF/H/Ges
   (`20-ul.png`, `22-ul-tn-nach-anmelden.png`, `src/uebungsleitung/teilnehmerMarkup.ts:331`).
3. **Beobachtung:**
   - In der Zeile von „Heros Oldenburg 23/11“ steht „Soll 0/5/15/20“.
   - Dieselbe Funkstelle meldet in ihren eigenen Sprüchen „Aktuelle Stärke: 3/8/5/16“, „3/6/17/26“
     und „2/5/1/8“.
   - Die 0/5/15/20 ist die Summe aus Spruch Nr. 7 von 21/11 *an* 23/11 („21-10 = 0/1/2/3,
     22-51 = 0/2/6/8, 24-53 = 0/2/7/9“).
   - „Soll“ ist also die Summe der Stärken, die *bei* dieser Stelle eingehen. Das steht nur im
     Generator-Hilfetext („… die Summe prüft die Übungsleitung“), nicht an der Spalte. Der Tooltip
     erklärt nur die Abkürzungen F/UF/H/Ges.
4. **Erwartung der Rolle:** Eine Stärke in der Zeile einer Funkstelle ist deren eigene Stärke. Wenn
   sie etwas anderes ist, steht dran, was: „Summe der an 23/11 gemeldeten Stärken – trag ein, was
   23/11 als Summe errechnet hat“.
5. **Auswirkung:** Die Leitung vergleicht mit den falschen Zahlen. Entweder gilt eine richtige
   Summe des Teilnehmers als falsch, oder sie trägt die eigene Meldung der Stelle ein. Die
   Auswertung der Stärkeaufgabe in der Nachbesprechung ist dann wertlos.
6. **Empfehlung:** Spalte und Feld nach dem benennen, was geprüft wird (z. B. „Erwartete Summe
   der empfangenen Stärkemeldungen“). Beim Teilnehmer einen passenden Auftrag anzeigen („Addiere die
   an dich gemeldeten Stärken und melde die Summe an die Übungsleitung“). *Annahme:* So ist die
   Aufgabe gemeint – das ist aus der Oberfläche allein nicht sicher ableitbar.
7. **Verifikation:** Ein Erstnutzer in der Rolle Übungsleitung erklärt ohne Hilfe, woher „Soll“
   kommt und was er in die vier Felder einträgt.

### P3-1 – „Teilnehmer Code: ZFVY8J / USZK“ – zwei Codes unter einem Namen

1. **Priorität:** P3
2. **Fundstelle:** Linktabelle im Generator (`08-links.png`) und Teilnehmertabelle der Leitung
   (`20-ul.png`). `src/generator/GeneratorLinksRenderer.ts:81`,
   `src/uebungsleitung/teilnehmerMarkup.ts:140`.
3. **Beobachtung:** Beschriftet ist „Teilnehmer Code: ZFVY8J / USZK“. Das Zugangsformular fragt
   dagegen getrennt nach „Übungscode (6 Zeichen)“ und „Teilnehmercode (4 Zeichen)“
   (`17-tn-falscher-link.png`). Die Platzhalter im Zugangsfeld auf der Startseite („K7M4Q2“, „A1B2“)
   sind grau, aber ohne „z. B.“, während alle anderen Felder „z. B.“ tragen.
4. **Erwartung der Rolle:** Der Zettel nennt dieselben Begriffe wie das Formular.
5. **Auswirkung:** Wer die Codes abtippt statt den Link zu nutzen, trägt womöglich „ZFVY8J / USZK“
   als Teilnehmercode ein. Die Fehlermeldung hilft dann zwar, kostet aber einen Versuch.
6. **Empfehlung:** „Übungscode ZFVY8J · Teilnehmercode USZK“. Platzhalter wie die übrigen mit
   „z. B.“.
7. **Verifikation:** Sichtprüfung. Ein Teilnehmer gibt die Codes vom Ausdruck ohne Fehlversuch ein.

### P3-2 – Zwei Nummerierungen zwischen Teilnehmer und Leitung

1. **Priorität:** P3
2. **Fundstelle:** Teilnehmerkarten „Nr. 1 … Nr. 10“ (`11-tn-mobil-full.png`) gegenüber
   Übungsleitung „Als Nächstes: Nr. 1 · …, Nr. 3 · …, Nr. 4 · …“ und Spalte NR mit „Abs.-Nr.“ darunter
   (`20-ul.png`, `23-ul-nach-abgesetzt.png`).
3. **Beobachtung:** Der Teilnehmer kennt nur seine eigene Nummer. Die Leitung arbeitet mit einer
   fortlaufenden Plan-Nummer; die Teilnehmernummer steht klein als „Abs.-Nr.“ darunter. Die
   Schaltflächen „Als Nächstes“ nennen nur die Plan-Nummer.
4. **Erwartung der Rolle:** Sagt 22/11 am Funk „mein Spruch Nummer 2“, findet die Leitung ihn sofort.
5. **Auswirkung:** Kurze Suche über den Sender-Filter. Deutlich besser als im ersten Lauf, aber
   „Als Nächstes: Nr. 4“ verleitet dazu, beim Teilnehmer nach seiner Nr. 4 zu fragen.
6. **Empfehlung:** In „Als Nächstes“ die Absender-Nummer mitnennen („21/11 Nr. 2 → 23/11“). „Abs.-Nr.“
   einmal erklären (Tooltip „Nummer beim Absender“).
7. **Verifikation:** Leitung findet auf Zuruf „23/11, Spruch 3“ die Zeile ohne Filter.

### P3-3 – „GEMELDET (TN)“ und „Bestätigen“ ohne Erklärung

1. **Priorität:** P3
2. **Fundstelle:** Nachrichtenplan der Übungsleitung, Zeilen 2 und 5 (`23-ul-nach-abgesetzt.png`),
   Knopf „2 gemeldete bestätigen“ in der Lage-Leiste.
3. **Beobachtung:** Was der Teilnehmer als abgesetzt markiert, erscheint bei der Leitung als
   gestrichelter Chip „GEMELDET (TN)“ mit Knopf „Bestätigen“. Nach Bestätigung steht „Leitung 21:03 /
   TN 21:03“. Erklärt wird das nur im `title` von „2 gemeldete bestätigen“, also nicht auf Touch und
   nicht an der Zeile.
4. **Erwartung der Rolle:** Ein Satz, was „gemeldet“ gegenüber „abgesetzt“ bedeutet und ob ich
   bestätigen *muss*.
5. **Auswirkung:** Die Leitung lässt Zeilen unbestätigt oder bestätigt alles pauschal, ohne
   mitgehört zu haben. Der Fortschritt („2 / 30 (2 nur gemeldet)“) wirkt dann unklar.
6. **Empfehlung:** Kurzer sichtbarer Hinweis über dem Plan: „Gemeldet = der Teilnehmer hat
   abgehakt. Bestätige, wenn du den Spruch gehört hast.“
7. **Verifikation:** Erstnutzer erklärt den Unterschied ohne Hilfe.

### P3-4 – Kennzahlenleiste und Datumsangaben bleiben kryptisch

1. **Priorität:** P3
2. **Fundstelle:** Übungsleitung, Leiste über dem Nachrichtenplan (`23-ul-nach-abgesetzt.png`),
   Kopfzeile aller Seiten, Kopf der Übungsleitung.
3. **Beobachtung:**
   - „Tempo: 18,1 N/min“, „Funklast: S Heros Oldenburg 22/11 (2) | E Heros Oldenburg 10 (2)“,
     „Heatmap 5m: 21:00=3“, „ETA: – (zu wenig Daten)“, „Live-Status: live“ und „Debrief PDF“ stehen
     ohne Erklärung da. „S“ und „E“ bleiben offen (*Annahme:* Sender/Empfänger).
   - Die Uhr in der Kopfzeile („052103oct26“) ist unbeschriftet. Das Übungsdatum steht bei der Leitung
     als „Datum 050000oct26“, im Admin als „5.10.2026“.
   - Das Datumsfeld im Generator zeigte im Testbrowser „10/05/2026“. Das liegt vermutlich an der
     Sprache des Testbrowsers, nicht an der Seite, und ist hier nicht abschließend prüfbar.
4. **Erwartung der Rolle:** Deutsche Klartextbegriffe, eine Beschriftung „DTG“ oder „Uhrzeit“, ein
   Datum in einer Form.
5. **Auswirkung:** Die Leiste wird ignoriert. „050000oct26“ als Übungsdatum lässt stocken (00:00 Uhr?).
6. **Empfehlung:** Begriffe ausschreiben („Tempo: 18 Sprüche/Min“, „Meiste Sendungen: 22/11“,
   „Nachbesprechung (PDF)“). DTG in der Kopfzeile beschriften. Das Übungsdatum als Datum anzeigen.
7. **Verifikation:** Erstnutzer liest jede Kennzahl ohne Rückfrage vor.

### P3-5 – Zwei Menüs auf dem Handy, „Gespeicherte Übungen“ nicht auffindbar

1. **Priorität:** P3
2. **Fundstelle:** Kopfzeile auf Pixel 7 (`44-start-mobil.png`, `13-tn-menue.png`), Navigation
   allgemein.
3. **Beobachtung:**
   - Auf dem Handy gibt es weiterhin zwei Menüs: das Hamburger-Menü oben rechts (GitHub, Anleitung,
     Über den Autor, Dark Mode) und darunter „☰ Menü“ mit den Seiten. Beide tragen dasselbe Symbol.
   - Auf der Startseite ist „Menü“ aufgeklappt, in der Teilnehmeransicht zugeklappt.
   - `#/admin` („Gespeicherte Übungen“) ist von keiner Seite verlinkt (`adminlinks.txt` leer).
   - Wer `/` in einem neuen Tab öffnet, sieht ein leeres Formular ohne Hinweis auf die zuletzt
     erstellte Übung. Der Rückweg hängt allein am aufgehobenen Bearbeiten-Link; darauf weist die
     Linktabelle jetzt aber deutlich hin.
4. **Erwartung der Rolle:** Ein Menü. Wenn es eine Liste gespeicherter Übungen gibt, finde ich sie.
5. **Auswirkung:** Gering. Der Nutzer tippt zuerst das falsche Menü an.
6. **Empfehlung:** Die Einträge des Hamburger-Menüs in „Menü“ zusammenführen. Ob „Gespeicherte
   Übungen“ verlinkt werden soll, bewusst entscheiden. Andernfalls auf der Startseite „Zuletzt in
   diesem Browser erstellt: …“ anbieten.
7. **Verifikation:** Auf 412 px ist genau ein Menüknopf sichtbar.

### P3-6 – Führungsstellen-Übung: Übungsleitung und Übergeordnete Stelle doppelt gefragt

1. **Priorität:** P3
2. **Fundstelle:** Generator, Quelle „Führungsstellen-Übung“ (`41-fuehrungsstelle.png`).
3. **Beobachtung:**
   - Die Kopfdaten fragen weiter „Funkrufname der Übungsleitung“. Im Drehbuch-Block stehen zusätzlich
     „Beübte Führungsstelle“, „Übergeordnete Stelle“ und „EA 1–3“.
   - Laut Text spielt die Übungsleitung übergeordnete Stelle und Einsatzabschnitte selbst. Ob der
     Funkrufname der Übungsleitung dann überhaupt verwendet wird, bleibt offen.
   - Die Platzhalter sind abgeschnitten („z. B. Heros M“, „z. B. Kater Mi“, „Stellenname, z. B. Einsatz…“).
   - Unter der Überschrift „Lösungswörter & Optionen“ steht nichts mehr.
   - Die Erklärung zu Stellenname und Ablauf steht erst ganz unten.
4. **Erwartung der Rolle:** Ich trage jeden Funkrufnamen genau einmal ein und weiß, welcher davon
   „ich als Leitung“ bin.
5. **Auswirkung:** Unsicherheit, ob Übungsleitung und übergeordnete Stelle gleich oder verschieden
   sein sollen. Eventuell ein Fehlversuch.
6. **Empfehlung:** In diesem Modus das Feld der Übungsleitung ausblenden oder erklären. Die leere
   Überschrift entfernen. Den Erklärtext über die Eingabefelder setzen.
7. **Verifikation:** Erstnutzer füllt den Modus ohne Rückfrage aus.

### P3-7 – Übungsdauer widerspricht sich zwischen Generator und Admin

1. **Priorität:** P3
2. **Fundstelle:** Generator-Statusleiste „Dauer (optimal): 93 Min“ (`07-ergebnis.png`) gegenüber
   `#/admin` → „Ø Übungsdauer (geschätzt): 7 Min 30 Sek“ (`30.txt`) für dieselbe einzige Übung
   (3 Teilnehmer, 30 Sprüche).
3. **Beobachtung:** Zwei Schätzungen derselben Übung unterscheiden sich um mehr als den Faktor zehn.
4. **Erwartung der Rolle:** Eine Zahl, die zum Dienstabend passt.
5. **Auswirkung:** Gering. Die Planungszahl verliert an Glaubwürdigkeit.
6. **Empfehlung:** Beide Werte aus derselben Rechnung ableiten oder unterschiedlich benennen.
7. **Verifikation:** Bei genau einer Übung zeigen Admin und Generator dieselbe Dauer.

## Nicht geprüft / Grenzen

- Der X-Zeit-Ablauf (Cockpit, „X jetzt“) wurde nicht durchgespielt; nur der Erklärtext im Generator
  wurde gelesen.
- Szenario- und Führungsstellen-Modus sind nur im Formular geprüft, nicht generiert.
- Die Inhalte von ZIP- und PDF-Downloads wurden nicht geprüft. Gesehen wurde nur die
  Vordruck-Vorschau.
- Der Inhalt der Rückfrage bei „Abhak-Stand für alle zurücksetzen“ ist nur aus dem Quelltext
  bekannt. Der Kartentext selbst ist im Screenshot belegt (`16-tn-reset.png`).
- Die Synchronisation lief nur zwischen Tabs desselben Browser-Kontexts im Mock, nicht zwischen
  echten Geräten.

## Abschluss

- **Aufgabe geschafft:** ja. Anlegen, Verteilen, Abhaken und Verfolgen gelingen ohne Umweg.
  Umwege gibt es nur bei der Wahl passender Vorlagen und bei der Stärkeprüfung.
- **Fremde Hilfe nötig:** nein für den Grundablauf. Für die Stärkeauswertung der Leitung
  wahrscheinlich ja.
- **Größtes Missverständnis:** „Soll 0/5/15/20“ in der Zeile einer Funkstelle wird als deren eigene
  Stärke gelesen. Es ist aber die Summe der Stärken, die bei ihr eingehen.
- **Größtes Einsatzrisiko:** Der Ausbilder wählt eine Vorlage nach Ortsnamen und merkt erst am
  Dienstabend, dass Lage und Ortsbezüge nicht zur Gruppe passen.
- **Top-Priorität für die nächste Iteration:** Jede Vorlage mit Lage, Herkunft und einem
  Beispielspruch beschreiben.

## Abgleich mit dem Lauf vom 2026-10-04

| Alt-ID | Titel (kurz) | Alt-Prio | Status jetzt | Beleg aus diesem Lauf |
|---|---|---|---|---|
| P1-1 | Inhaltsverzeichnis der Startseite führt auf leere Seite | P1 | behoben | Auf `/` gibt es kein `#inhalt` mehr (`toc.txt` leer). Unter dem Formular stehen echte Links in den Wissensbereich (`02-start-full.png`). |
| P1-2 | Vordruck-Vorschau bleibt weiß, keine Meldung | P1 | behoben | In Chromium 141 gerendert, „Seite 1 / 10“, kein Seitenfehler im Log (`15-tn-meldevordruck.png`, `log3.txt`). |
| P1-3 | Vorbelegung erzeugt unpassende Übung | P1 | behoben | Keine Vorlage vorausgewählt (`vorlagen.txt`), Rufnamen nur als Platzhalter (`tn.txt`). Generieren ohne Auswahl wird mit Feldmeldungen verhindert (`03-nach-generieren-naiv.png`). Der Übungsname ist weiterhin zufällig („Feuerlinie“, „Frequenz Schatten“), stört aber kaum. |
| P2-1 | Geteilter Teilnehmer-Link öffnet nur ein Formular | P2 | teilweise | Der Link `#/teilnehmer?uc=…&tc=…` öffnet direkt die Sprüche (`10-tn-mobil.png`). Ein falscher Code zeigt sofort eine Meldung mit Tipp zu 0/O und 1/I (`17-tn-falscher-link.png`). Offen: Die Platzhalter „K7M4Q2“ und „A1B2“ auf der Startseite haben weiterhin kein „z. B.“ (`44-start-mobil.png`). |
| P2-2 | Begriffe je Rolle verschieden, Knöpfe sehen aus wie Anzeigen | P2 | behoben | Beide Rollen sagen „abgesetzt“. Der Status-Chip ist beim Teilnehmer getrennt vom Knopf „Als abgesetzt markieren“. Bei der Leitung heißt es „Anmeldung erhalten“, mit „Anmeldung zurücknehmen“ (`22-ul-tn-nach-anmelden.png`). Neu entstanden ist „GEMELDET (TN)“, siehe P3-3. |
| P2-3 | „Lokale Daten löschen“ wirkt nicht nur lokal | P2 | behoben | Teilnehmer: Karte „Abhak-Stand komplett zurücksetzen“ mit Erklärung „auf diesem Gerät, auf deinen anderen Geräten und bei der Übungsleitung“, steht unten auf der Seite (`16-tn-reset.png`). Leitung: „⟲ Übungsstand für alle zurücksetzen“. Siezen ist in den Rückfragen nicht mehr zu finden. |
| P2-4 | Mobil: Status abgeschnitten, Vordruck nur per Tastatur | P2 | behoben | Die Sprüche sind Karten mit voller Breite und großem Abhak-Knopf (`10-tn-mobil.png`). Im Vordruck gibt es Touch-Knöpfe „Zurück / Zurücknehmen (wieder offen) / Weiter“, keine Tastenkürzel, und die Kopfzeile liegt nicht darüber (`15-tn-meldevordruck.png`). |
| P2-5 | Navigation passt nicht zur Rolle, Rückweg unklar | P2 | teilweise | „Übung erstellen“ ist in der Teilnehmeransicht nicht mehr markiert (`13-tn-menue.png`). Die Linktabelle sagt jetzt „Heb den Link auf, darüber kommst du zu dieser Übung zurück“ (`08-links.png`). Offen: zwei Menüs auf dem Handy, `#/admin` nicht verlinkt (P3-5). |
| P2-6 | Generator setzt Fachbegriffe voraus | P2 | behoben | Erklärtexte stehen an Spiel-Modus, Quelle, Stellenname, Stärkemeldungen und Spruch/Durchsage. Die Statusleiste zählt live („Teilnehmer: 2 · Nachrichten: ca. 20“ nach zwei Namen). „Dauer (optimal)“ ist ausgeschrieben, „= 1 je Teilnehmer“ statt „Ergibt 1 Nachrichten“. Die Code-Box sagt „Zum Erstellen einer Übung brauchst du das nicht“ (`02-start-full.png`). |
| P2-7 | Unklar, welcher Link wofür ist | P2 | behoben | Spalten „Zweck / Wer bekommt ihn“, Beschriftungen „Übung bearbeiten – nur für dich“, „Übung überwachen – für die Übungsleitung“, „Link oder Codes an diese Funkstelle weitergeben“ (`08-links.png`). |
| P3-1 | Datum in drei Formaten, Uhr ohne Erklärung | P3 | offen | Kopfzeile „052103oct26“ unbeschriftet. Leitung „Datum 050000oct26“, Admin „5.10.2026“. Das Datumsfeld zeigt „10/05/2026“ (vermutlich wegen der Sprache des Testbrowsers) (`20-ul.png`, `30.txt`). |
| P3-2 | Kennzahlen der Übungsleitung ohne Bedeutung | P3 | teilweise | Die Stärke ist jetzt beschriftet („Soll (F/UF/H/Ges)“, Felder F/UF/H/Ges), die Teilnehmernummer steht als „Abs.-Nr.“ da (`23-ul-nach-abgesetzt.png`). Offen: Tempo, Funklast S/E, Heatmap 5m, ETA, „Debrief PDF“ (P3-4). Neu: Bedeutung von „Soll“ (P2-2). |
| P3-3 | Symbol-Knöpfe im Admin, doppelter Titel | P3 | behoben | Der Admin zeigt Textknöpfe „Öffnen / Überwachen / Löschen“ (`30.txt`). Die Teilnehmer-Kopfzeile lautet nur „Sprechfunkübung Feuerlinie 2026“ (`10-tn-mobil.png`). |
