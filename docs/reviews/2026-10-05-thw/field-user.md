Befunde: P0=0 P1=0 P2=4 P3=5
Abgleich: behoben=7 teilweise=3 offen=1 nicht-pruefbar=0

# THW-Field-User-Review (2. Lauf) – Sprechfunk Übungsgenerator

Reviewer: field-user (Skill `thw-field-user-reviewer`), 2026-10-05
Methode: Live-Test gegen den lokalen Build (`http://127.0.0.1:3000`, Mock-Firestore im localStorage), Playwright/Chromium.
Screenshots: `scratchpad/field-user/` dieser Sitzung (Dateinamen unten als Beleg).

## Rahmen

- **Geräte/Viewports:** Pixel 7 (412×839 CSS-px, Touch) als Hauptgerät, iPhone SE (375×667) als kleinstes Gerät, Desktop 1366×900 für Generator und Übungsleitung, Übungsleitung zusätzlich auf 412 px. Hell- und Dunkelmodus.
- **Testdaten:** zwei Übungen mit je vier Teilnehmern (Vorlage „THW Leer“): klassisch (12 Sprüche je Teilnehmer) und X-Zeit (6 Sprüche, Intervall 2 min, Offset 1 min).
- **Szenarien (abgeleitet, kein Auftrag vorgegeben):**
  1. Helfer bekommt Codes vom Zettel, tippt sie am Handy ein (dabei ein Tippfehler), findet seinen nächsten Spruch, hakt ab, nimmt einen versehentlich abgehakten zurück. – **ja**
  2. Wie 1, aber mit Vordruck-Ansicht statt Liste. – **ja**
  3. Unterbrechung: fünf Sprüche abgehakt, Seite neu geladen, nächsten offenen Spruch wiederfinden. – **mit Schwierigkeiten**
  4. X-Zeit-Übung: Übungsleitung setzt X-Zeit, Helfer arbeitet im Fokus-Modus, verdrückt sich und nimmt zurück. – **ja**
  5. Abhaken ohne Netz (Offline-Simulation). – **mit Schwierigkeiten** (Abhaken geht, Zustand nicht erkennbar)
  6. Übungsleitung schaut am Handy, wer hängt. – **mit Schwierigkeiten**
- **Mentales Modell des Helfers:** „Ich bin Heros Oldenburg 21/11. Ich will sehen, was ich als Nächstes an wen funke, und nach dem Funken abhaken – wie auf dem Spruchzettel.“ Er denkt in Sprüchen und Häkchen, nicht in Sync, Ansichten oder Basiszeiten.

Kontext: Ausbildungswerkzeug für Dienstabende, kein Echteinsatz. Handschuhe, Nässe und Funklöcher kommen bei Übungen im Freien oder im Fahrzeug vor, sind aber seltener als im Einsatz; die Prioritäten sind entsprechend gesetzt.

**Gesamteindruck gegenüber dem 1. Lauf:** Die Teilnehmerrolle am Handy ist jetzt für den Kernablauf brauchbar. Karten statt Tabelle, ein großer Knopf „✓ Als abgesetzt markieren“ (339×48 px), Rückgängig-Leiste, „Zurücknehmen“ an jedem abgehakten Spruch, Vordruck mit Touch-Knöpfen, Fehlerseite mit Codeformular, X-Zeit von der Übungsleitung. Diese Punkte bei einem Redesign erhalten. Kein Befund ist mehr P0 oder P1.

---

## Befunde

### [P2] Abgehakt „nur auf dem Handy“ sieht genauso aus wie „bei der Übungsleitung angekommen“

**Evidence:** Observed (Anzeige im Mock mit `context.setOffline`), Not verified (echtes Funkloch mit Firestore)
**Where:** Teilnehmeransicht, Spruchkarte nach „✓ Als abgesetzt markieren“, Rückgängig-Leiste `#teilnehmerRueckgaengig`, Badge „Sync: …“ im Kopf. Beleg `p-60-offline-abgehakt.png`.
**Field-user reaction:** „Abgesetzt 21:05, grün – passt, die Übungsleitung hat's.“
**Problem:** Offline abgehakt zeigen Karte („✓ ABGESETZT 21:05“) und Leiste („Spruch 3 als abgesetzt markiert.“) genau dasselbe wie online. Der einzige Hinweis „Sync: offline – wird nachgereicht“ steht im Kopf, beim Abhaken lag er bei y = −369, also außerhalb des Bildschirms. Ein Wechsel offline → online ist an der Karte ebenfalls nicht zu sehen.
**Operational impact:** Nachfragen über Funk („Hast du meinen Spruch 3?“), oder die Übungsleitung bestätigt doppelt bzw. gar nicht. Bei Übungen im Freien mit schwachem Netz läuft der Fortschritt in der Übungsleitung unbemerkt hinterher.
**Recommendation:** Den Übertragungszustand an die Stelle der Handlung bringen: in der Rückgängig-Leiste und an der Karte ein Zusatz wie „nur auf diesem Handy – wird gesendet, sobald Netz da ist“ (z. B. mit Wolke-durchgestrichen-Symbol und Wort), der nach erfolgreicher Übertragung verschwindet. Offline zusätzlich einen schmalen, mitlaufenden (sticky) Hinweis am oberen Rand statt nur des Badges im Kopf.
**Retest:** Pixel 7, Flugmodus an, drei Sprüche abhaken: Zustand „noch nicht gesendet“ an jeder der drei Karten ohne Scrollen ablesbar; Flugmodus aus: Hinweis verschwindet innerhalb weniger Sekunden.

### [P2] Nach Unterbrechung steht der nächste offene Spruch nicht im Bild

**Evidence:** Observed
**Where:** Teilnehmeransicht, klassische Übung, Liste; nach fünf abgehakten Sprüchen Seite neu geladen. Belege `p-52-dark-reload-nach5.png`, `iphonese-20-xzeit-start.png`, `m-30-tn-nach-ul-xzeit.png`.
**Field-user reaction:** Display war aus, Seite lädt neu: „Wo war ich? Hier ist alles grün.“
**Problem:** Abgehakte Sprüche bleiben in voller Größe stehen. Nach fünf erledigten lag der Knopf des nächsten offenen Spruchs bei y = 1022 bei 839 px Bildhöhe, also unter dem ersten Bildschirm. Die Seite springt nicht zu „ALS NÄCHSTES“. Der Schalter „Abgesetzte ausblenden“ hilft (dann y = 613), ist aber standardmäßig aus und klein (siehe P3). Im X-Zeit-Fokus-Modus auf dem iPhone SE liegen Kopfkarte, Ansichtsumschalter und X-Zeit-Karte vor dem fälligen Spruch; der Knopf „Als abgesetzt markieren“ beginnt bei y = 725 bei 667 px Höhe.
**Operational impact:** Mit jedem Spruch wird das Wiederfinden länger. Es kostet Scrollen und erhöht das Risiko, den falschen Spruch zu funken oder einen zu überspringen.
**Recommendation:** Beim Öffnen und nach jedem Abhaken zum nächsten offenen Spruch scrollen, oder abgehakte Sprüche nach dem Rückgängig-Fenster zu einer Zeile („Nr. 1–5 abgesetzt – anzeigen“) zusammenklappen. Im Fokus-Modus die X-Zeit-Karte auf eine Zeile reduzieren, sobald die Basis gesetzt ist, damit der fällige Spruch samt Knopf im ersten Bildschirm steht.
**Retest:** Pixel 7 und iPhone SE: 5 von 12 abhaken, neu laden → nächster offener Spruch mit Knopf ohne Scrollen sichtbar. Fokus-Modus auf iPhone SE: Knopf ohne Scrollen sichtbar.

### [P2] Übungsleitung am Handy: Tabellen seitlich abgeschnitten

**Evidence:** Observed
**Where:** `#/uebungsleitung/<id>` bei 412 px; Belege `m-40-ul-mobil.png`, `m-41-a.png`, `m-41-b.png`.
**Field-user reaction:** Der Übungsleiter geht durch den Raum, will am Handy sehen, wer hängt, und eine Anmeldung bestätigen.
**Problem:** Das Cockpit ist am Handy gut lesbar: Uhrzeit, X-Zeit, Fortschritt „1/24“, „Lage“, „Als Nächstes“, „1 gemeldete bestätigen“. Die Teilnehmertabelle schneidet dagegen den Knopf „Anmeldung erh…“ und die Spalte „angemeldet 052…“ ab, Stärke, Notizen und Debrief sind nicht sichtbar. Im Nachrichtenplan sieht man nur Nr. und Status, Empfänger und Spruchtext sind abgeschnitten („Her / Win“). Es gibt keinen Hinweis, dass man seitlich wischen kann.
**Operational impact:** Für den Dienstabend akzeptabel, wenn die Übungsleitung am Laptop sitzt (Annahme). Unterwegs sind die Anmeldung und die Zuordnung eines Spruchs zum Empfänger nur mit Wischen innerhalb der Tabelle möglich.
**Recommendation:** Die Kartendarstellung der Teilnehmeransicht auch für die Teilnehmertabelle und den Nachrichtenplan der Übungsleitung übernehmen: je Teilnehmer eine Karte mit Fortschritt und Anmelde-Knopf, je Spruch eine Karte mit Absender → Empfänger, Text und Status-Knopf.
**Retest:** Pixel 7: Anmeldung eines Teilnehmers bestätigen und bei Spruch 5 Empfänger und Text lesen, ohne seitlich zu wischen.

### [P2] X-Zeit-Übung vor dem Start: widersprüchliche Anweisung, keine Sprüche zu sehen

**Evidence:** Observed
**Where:** Teilnehmeransicht einer X-Zeit-Übung, bevor die Übungsleitung die X-Zeit setzt (Fokus-Modus am Handy automatisch an). Beleg `iphonese-20-xzeit-start.png`, `iphonese-20b-full.png`.
**Field-user reaction:** „Oben steht ‚Warte auf die X-Zeit der Übungsleitung‘, direkt darunter ‚Starte oben die X-Zeit (Jetzt starten)‘ – was denn nun?“
**Problem:** Zwei Texte widersprechen sich, und der Knopf „Jetzt starten“ (96×30 px) wirkt wie die Aufforderung. Bis zum Start ist kein einziger Spruch zu sehen, auch keine Vorschau („Dein erster Spruch geht an Heros Wind 10“). Nach dem Setzen durch die Übungsleitung bleiben Uhrzeitfeld und „Jetzt starten“ bedienbar. Positiv: Eine Abweichung von der Basis der Übungsleitung wird abgefragt, und eine spätere Basis der Übungsleitung überschreibt die eigene (`src/teilnehmer/xZeitSteuerung.ts`, `src/services/liveStatusMerge.ts:242`).
**Operational impact:** Einige Helfer starten selbst und laufen bis zum Setzen durch die Übungsleitung mit eigener Uhr. Es gibt Rückfragen in der Wartephase, die man zur Vorbereitung (Spruch lesen, Vordruck anschauen) nutzen könnte.
**Recommendation:** Vor dem Start nur einen Text: „Warte, bis die Übungsleitung die X-Zeit setzt – das passiert hier automatisch.“ Darunter den ersten Spruch als Vorschau ohne Abhak-Knopf. „Jetzt starten“ und das Zeitfeld hinter „Ohne Übungsleitung üben…“ einklappen und ausblenden, sobald die Übungsleitung die Basis gesetzt hat.
**Retest:** Neuer Helfer ohne Einweisung öffnet die X-Zeit-Übung vor dem Start: Er drückt nichts und kann sagen, an wen sein erster Spruch geht.

### [P3] Kleine Schalter für Ausblenden, Fokus-Modus und X-Zeit

**Evidence:** Observed (Maße), Not verified (Handschuh)
**Where:** „Abgesetzte ausblenden“ 39×21 px (Schalter) bzw. 141×20 px (Beschriftung); Fokus-Modus-Schalter 34×17 px; „Jetzt starten“ 96×30 px; im Vordruck-Modal „Abgesetzte ausblenden“ 141×20 px.
**Field-user reaction:** Trifft mit Handschuh oder kalten Fingern nicht, tippt daneben auf den Filter oder auf eine Karte.
**Problem:** Die Hauptknöpfe sind groß (Abhaken 339×48, Zurücknehmen ca. 120×46, Vordruck-Navigation 96–185×48–60, Schließen 126×44). Die Nebenschalter bleiben unter 44 px Höhe, und gerade „Abgesetzte ausblenden“ ist das Mittel gegen P2 „Unterbrechung“.
**Recommendation:** Die ganze Zeile inklusive Beschriftung als Tippfläche von mindestens 44 px Höhe; Schalter optisch vergrößern.
**Retest:** Bounding-Box der Tippfläche ≥ 44×44 px; Test mit Arbeitshandschuh.

### [P3] Software- und Spezialbegriffe in der Teilnehmer- und Leitungsansicht

**Evidence:** Observed
**Where:** Teilnehmer: Badge „Sync: live“ / „Sync: offline – wird nachgereicht“, Kopfzeile „052100oct26“ ohne Erklärung, Countdown „X+3 · noch 5 offen“ (`m-32-fokus-nach-tap.png`). Übungsleitung: „Live-Status“, „Tempo“, „Funklast: S … | E …“, „Heatmap 5m: 21:00=1“, „Abs.-Nr.“, „TN 1 · Leitung 0“ (`m-41-a.png`, `m-41-b.png`).
**Field-user reaction:** „Sync?“ – „X+3 heißt jetzt was, in drei Minuten oder Spruch 3?“ – „Heatmap?“
**Problem:** „ZIP“ und „lokale Daten“ sind gegenüber dem 1. Lauf verständlich umbenannt, „Sync“ und mehrere Kennzahlen der Übungsleitung nicht. „X+3“ neben dem Countdown ist doppeldeutig. Die Datum-Zeit-Gruppe (DTG) im Seitenkopf ist für die Aufgabe des Teilnehmers nicht nötig.
**Recommendation:** „Verbindung zur Übungsleitung: steht / unterbrochen – wird nachgereicht“; „nächster Spruch bei X+3 min“; Kennzahlen der Übungsleitung mit Klartext-Kurzbezeichnung oder Erklärung per Tipp.
**Retest:** Drei Helfer ohne Einweisung erklären Badge und Countdown-Zeile richtig.

### [P3] Code-Hinweis nennt Verwechslungen, die in den Codes gar nicht vorkommen

**Evidence:** Observed
**Where:** Fehlermeldungen in `src/teilnehmer/index.ts:252` und `src/teilnehmer/TeilnehmerView.ts:92`; Zeichenvorrat `src/services/generationCodes.ts:3` (`ABCDEFGHJKLMNPQRSTUVWXYZ23456789`, ohne 0, O, 1, I). Beleg `pixel7-03-falscher-code.png`, `pixel7-10-formatfehler.png`.
**Field-user reaction:** Liest „0 und O werden leicht verwechselt“ und probiert hin und her, obwohl keines der beiden Zeichen vorkommt. Wer ein „O“ eintippt (z. B. bei „Q“ verlesen), bekommt „Codeformat ungültig. Übungscode: 6 Zeichen …“, obwohl er sechs Zeichen getippt hat.
**Problem:** Der gut gemeinte Hinweis schickt auf die falsche Fährte, und die Formatmeldung nennt nicht das eigentliche Problem, das unzulässige Zeichen. Positiv: Nach dem Fehler bleibt das Formular mit den eingegebenen Werten stehen, Großschreibung erfolgt automatisch, und Kleinbuchstaben werden akzeptiert.
**Recommendation:** Im Hinweis klar sagen: „Codes enthalten kein O, 0, I oder 1. Q, G und 6 genau ansehen.“ Bei einem unzulässigen Zeichen dieses Zeichen benennen, oder O→Q bzw. I→J nicht stillschweigend, sondern als Vorschlag anbieten.
**Retest:** „T2VAFO“ eingeben → Meldung nennt das „O“ als Ursache.

### [P3] Teilnehmer sieht nicht, ob die Übungsleitung seinen Spruch bestätigt hat

**Evidence:** Observed
**Where:** Nach dem Abhaken zeigt die Übungsleitung „GEMELDET (TN) – Bestätigen“ (`m-41-b.png`), der Teilnehmer dauerhaft „✓ ABGESETZT 21:01“ (`pixel7-12-nach-abhaken.png`).
**Field-user reaction:** „Hat die Leitung meinen Spruch quittiert?“
**Problem:** Die Übungsleitung unterscheidet zwischen „vom Teilnehmer gemeldet“ und „bestätigt“, der Teilnehmer sieht diesen Unterschied nicht.
**Recommendation:** An der Karte „von der Übungsleitung bestätigt“ ergänzen, sobald das der Fall ist (ggf. nur, wenn die Übungsleitung mit Bestätigung arbeitet).
**Retest:** Übungsleitung bestätigt Spruch 1 → beim Teilnehmer erscheint der Zusatz ohne Neuladen.

### [P3] Zwei Menü-Knöpfe am Handy

**Evidence:** Observed
**Where:** Seitenkopf am Handy: Symbol ☰▾ oben rechts und darunter die Zeile „☰ Menü“ (`pixel7-04-nach-korrektur.png`, `iphonese-20-xzeit-start.png`). Auf dem iPhone SE ist der Titel zu „Sprechfunk Übun…“ gekürzt; es gibt keine Überlappung mehr.
**Field-user reaction:** „Welches Menü ist das richtige?“
**Problem:** Zwei gleich aussehende Einstiege mit unterschiedlichem Inhalt kosten Orientierung. In der Teilnehmerrolle wird keiner davon gebraucht.
**Recommendation:** Am Handy einen einzigen beschrifteten Menü-Knopf; in der Teilnehmerrolle die Kopfzone so klein halten, dass der nächste Spruch nach oben rückt (vgl. P2 „Unterbrechung“).
**Retest:** Helfer ohne Einweisung findet „Anleitung“ beim ersten Versuch.

### Nicht verifiziert

- **Echtes Funkloch:** Der Mock arbeitet mit dem localStorage. Ob abgehakte Sprüche nach Netzrückkehr wirklich nachgereicht werden, muss mit echtem Firestore und Flugmodus auf einem Gerät geprüft werden.
- **Uhrzeitfeld:** Das X-Zeit-Feld zeigte im headless-Chromium „09:03 PM“ (12-Stunden-Format), obwohl der Kontext auf de-DE stand. Auf einem deutsch eingestellten Android- und iOS-Gerät prüfen.
- **Sonnenlicht/Nacht:** Der Dunkelmodus ist lesbar (`p-52-dark-reload-nach5.png`), der Status steht als Wort und als Farbe. Ein Test draußen steht aus.
- **Handschuhe:** Nur über die gemessenen Maße bewertet.

---

## Comprehension check

- **Orientation:** understood. Rolle, eigener Funkrufname, Rufgruppe und Übungsleitung stehen oben in der Kopfkarte. Abzug: zwei Menüs.
- **Next action:** understood beim ersten Öffnen („ALS NÄCHSTES“, großer Knopf), uncertain nach einer Unterbrechung und vor dem X-Zeit-Start.
- **System status:** uncertain. Spruchstatus klar (Wort und Farbe, mit Uhrzeit), Übertragung an die Übungsleitung am Spruch nicht erkennbar.
- **Error recovery:** understood. Rückgängig-Leiste, „Zurücknehmen“ je Spruch und im Vordruck, Codeformular nach Fehler, Gesamt-Zurücksetzen hinter aufklappbarem Bereich mit Erklärung.
- **Field suitability:** limited (am Handy für Teilnehmer gut geeignet; offline-Status und Wiedereinstieg nach Unterbrechung schwach; Übungsleitung am Handy nur eingeschränkt).

---

## Abgleich mit dem Lauf vom 2026-10-04

| # | Alter Befund | Alte Prio | Status jetzt | Beleg aus diesem Lauf |
|---|---|---|---|---|
| 1 | Statusspalte am Handy außerhalb des Bildschirms | P1 | behoben | Karten statt Tabelle; Status „OFFEN“/„✓ ABGESETZT 21:01“ und Knopf 339×48 px im Bild; kein Element ragt über 412 px hinaus (`pixel7-04`, `pixel7-12`). |
| 2 | Kopf abgeschnitten, Titel überlappt Menü auf iPhone SE | P1 | behoben | Overflow-Messung auf Pixel 7 leer (scrollWidth = 412); auf dem SE ist der Titel mit „…“ gekürzt und überlappt nicht; ZIP und Zurücksetzen stehen beschriftet am Seitenende (`iphonese-20b-full`). |
| 3 | Falscher Code ohne Weg zurück | P1 | behoben | Kurzform und Pfad-Link mit falschem Code zeigen das Codeformular mit den eingegebenen Werten; Korrektur eines Zeichens führt direkt in die Übung (`pixel7-03`, `p-50`). Hinweistext siehe neuer P3. |
| 4 | Vordruck-Ansicht: Abhaken nur per Leertaste | P1 | behoben | Modal mit „Zurück“ 96×48, „Zurücknehmen (wieder offen)“ / Abhaken 185×60, „Weiter“ 91×48, „Schließen“ 126×44; der Vordruck wird gerendert; keine Tastenlegende am Handy (`pixel7-15-meldevordruck`). |
| 5 | Abhaken ohne Rückmeldung „angekommen“ in Sichtweite | P2 | offen | Offline abgehakt: Karte und Leiste identisch zu online, Badge außerhalb des Bildschirms (`p-60`). „übertragen“ ist zu „abgesetzt“ geworden (das ist erledigt). |
| 6 | Nachrichtenliste beginnt unterhalb des ersten Bildschirms | P2 | teilweise | Erster Start auf Pixel 7: Spruch 1 mit Knopf im Bild, Website-Navigation zu „Menü“ eingeklappt, Kopfdaten kompakt. Nach Fortschritt und Neuladen liegt der nächste offene Spruch unter dem Bild (y = 1022 / 839), Fokus-Knopf auf dem SE bei y = 725 / 667. |
| 7 | Fokus-Modus ohne Rückgängig | P2 | behoben | Nach dem Tippen: Leiste „Spruch 1 als abgesetzt markiert. – Rückgängig“ und in der Countdown-Karte „Zuletzt abgesetzt: Meldung 1 – Zurücknehmen“ (`m-32`). |
| 8 | X-Zeit startet jeder Teilnehmer selbst | P2 | behoben | Übungsleitung „Jetzt starten“ → beim Teilnehmer „X-Zeit 21:03 – von der Übungsleitung gesetzt.“ ohne eigenes Zutun; eigene Abweichung mit Rückfrage (`m-30`, `d-11`). Rest-Unklarheit vor dem Start siehe neuer P2. |
| 9 | Übungsleitungsansicht am Handy nicht nutzbar | P2 | teilweise | Cockpit (Lage, Als Nächstes, Bestätigen) am Handy gut bedienbar; Teilnehmertabelle und Nachrichtenplan weiter seitlich abgeschnitten (`m-40`, `m-41-a`, `m-41-b`). |
| 10 | Code-Felder ohne Eingabehilfen | P3 | behoben | `autocapitalize="characters"`, `autocomplete="off"`, `spellcheck="false"`, Platzhalter „z. B. K7M4Q2“, Label mit Zeichenzahl, vollbreiter Knopf „Zugang öffnen“ (`pixel7-03`). |
| 11 | Fachfremde Begriffe in der Teilnehmerrolle | P3 | teilweise | „Alle meine Vordrucke herunterladen (ZIP)“ mit Erklärtext und „Abhak-Stand komplett zurücksetzen“ sind verständlich; „Sync: live“, „X+3“, „Tempo“, „Funklast“, „Heatmap 5m“ bleiben (`m-41-a`). |
