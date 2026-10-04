# THW-Field-User-Review – Sprechfunk Übungsgenerator

Reviewer: field-user (Skill `thw-field-user-reviewer`), 2026-10-04
Methode: Live-Test gegen lokalen Build (`http://127.0.0.1:3000`, Mock-Firestore), Playwright/Chromium.
Screenshots: `scratchpad/field-user/` dieser Sitzung (Dateinamen unten als Beleg).

## Rahmen

- **Geräte/Viewports:** Pixel 7 (412×915, Touch) als Hauptgerät, iPhone SE (375×667) als kleinstes Gerät, Desktop 1366×900 für Generator und Übungsleitung. Hell- und Dunkelmodus.
- **Szenarien (abgeleitet, da kein Auftrag vorgegeben):**
  1. Teilnehmer bekommt beim Dienstabend Übungscode und Teilnehmercode, öffnet die Seite am Handy, findet seinen nächsten Funkspruch und hakt ihn nach dem Absetzen ab.
  2. Wie 1, aber im X-Zeit-Modus mit Fokus-Ansicht.
  3. Teilnehmer vertippt sich beim Code.
  4. Übungsleitung verfolgt den Fortschritt (Desktop, kurz auch am Handy).
- **Ergebnis:** Szenario 1 **mit Schwierigkeiten** (Statusspalte am Handy nur per seitlichem Wischen in der Tabelle erreichbar). Szenario 2 **ja** (Fokus-Modus gut). Szenario 3 **mit Schwierigkeiten** (Fehlermeldung ohne Weg zurück). Szenario 4 Desktop **ja**, Handy **nein/eingeschränkt**.
- **Mentales Modell des Helfers:** „Ich bin Heros Oldenburg 16/11. Ich will sehen: Was muss ich als Nächstes an wen funken – und wenn ich's gesprochen habe, haken ich es ab.“ Er denkt in einer Liste von Sprüchen mit Häkchen, wie auf dem Papier-Spruchzettel, nicht in Tabellen, Ansichten, Sync oder ZIP.

Kontext-Hinweis: Ausbildungswerkzeug für Dienstabende, kein Echteinsatz. Handschuhe, Regen und Funkloch sind hier seltener als im Einsatz, aber Übungen finden durchaus im Fahrzeug, im Freien oder in der Unterkunft mit schlechtem Netz statt. Priorisierung entsprechend.

---

## Befunde

### [P1] Statusspalte („offen/übertragen“) am Handy außerhalb des Bildschirms

**Evidence:** Observed
**Where:** Teilnehmeransicht `#/teilnehmer/<id>/<code>`, Tabelle `#teilnehmerNachrichtenBody`, Spalte „Status“. Screenshots `m-pixel-03-teilnehmer.png`, `m-pixel-04-teilnehmer-full.png`, `m-pixel-10-dark.png`.
**Field-user reaction:** „Wo hake ich das jetzt ab?“ Sieht Nr., Empfänger, Text – und am rechten Rand ein angeschnittenes „STAT…“ bzw. ein halbes gelbes Kästchen mit „0“.
**Problem:** Die Tabelle ist 731 px breit, der Container 372 px (`.table-responsive`, overflow-x auto). Der Status-Chip liegt bei x=434–512, der Schalter bei x=520–554 – beide komplett außerhalb des 412-px-Viewports. Erreichbar nur durch horizontales Wischen *innerhalb* der Tabelle; nichts weist darauf hin. Der Chip ist zudem nur 78×27 px, der Schalter 34×17 px. Auch die Spalte für Bestätigungen dahinter ist unsichtbar.
**Operational impact:** Die Kernhandlung der Teilnehmerrolle (Spruch abhaken) ist am Handy versteckt. Folge: Helfer haken nicht ab, Übungsleitung sieht keinen Fortschritt (`0/70` bleibt stehen) oder Helfer wischen beim Versuch versehentlich die Seite/Spalten durch und haken den falschen Spruch ab.
**Recommendation:** Am Handy keine Tabelle, sondern je Spruch eine Karte: oben Nr. + Empfänger, darunter Text, darunter ein vollbreiter Knopf „Abgesetzt ✓“ (≥48 px hoch). Status als Wort *und* Farbe in der Karte. Den doppelten Bedienweg (Chip + Schalter) auf einen reduzieren.
**Retest:** Pixel 7 und iPhone SE: Spruch 1 ohne seitliches Wischen abhaken; Bedienelement mindestens 44×44 px; Status ohne Scrollen nach rechts lesbar.

### [P1] „Lokale Daten löschen“ und Teile des Kopfs abgeschnitten, auf iPhone SE überlappt der Titel das Menü

**Evidence:** Observed
**Where:** Kopfkarte der Teilnehmeransicht (`src/teilnehmer/TeilnehmerView.ts:163-175`); `m-pixel-03-teilnehmer.png` (rechts angeschnittener Rahmen), `m-se-03-teilnehmer.png` (ZIP-Knopf halb, „Sprechfunk Übungsgenerator“ unter dem Menü-Knopf).
**Field-user reaction:** „Da ragt rechts was raus – ist das kaputt?“ Auf dem SE: Titel und Menüsymbol liegen übereinander.
**Problem:** Die Knopfleiste im Kartenkopf bricht nicht um. „Lokale Daten löschen“ liegt bei x=403–495 (außerhalb), der ZIP-Knopf ist auf dem SE halb sichtbar. Ausgerechnet die folgenschwere Rücksetz-Aktion ist ein angeschnittener, unbeschrifteter Rand.
**Operational impact:** Wirkt defekt und untergräbt Vertrauen; ein Helfer, der den Knopf sucht (z. B. nach falschem Abhaken), findet ihn nicht. Umgekehrt kann ein halb sichtbarer Rand versehentlich angetippt werden (Schutz: Bestätigungsdialog vorhanden, `src/teilnehmer/index.ts:377`).
**Recommendation:** Kopfleiste am Handy umbrechen lassen oder Nebenfunktionen (ZIP, Daten löschen) in ein beschriftetes „Mehr…“-Menü am Seitenende verschieben. Das App-Kopf-Layout auf 375 px prüfen.
**Retest:** iPhone SE und Pixel 7: kein Element ragt über den rechten Rand; Titel und Menüknopf überlappen nicht.

### [P1] Falscher Code: Fehlermeldung ohne Weg zurück zur Eingabe

**Evidence:** Observed
**Where:** `#/teilnehmer/<id>/ZZZZZZ` → `m-pixel-08-falscher-code.png`
**Field-user reaction:** „Teilnehmer nicht in dieser Übung gefunden. – Und jetzt?“
**Problem:** Es erscheint nur der rote Kasten. Kein Hinweis, welcher Code falsch sein könnte, kein Eingabefeld, kein Knopf „Code neu eingeben“. Der Navigationspunkt „Übung erstellen“ ist hervorgehoben, was in die falsche Rolle führt.
**Operational impact:** Bei einem Zahlendreher (häufig bei 4–6-stelligen Codes wie `K559`/`MNTA`, Verwechslung 0/O, 5/S, 8/B) steht der Helfer fest und braucht die Übungsleitung. Am Dienstabend kostet das bei 7–15 Teilnehmern spürbar Zeit.
**Recommendation:** Auf der Fehlerseite direkt das Codeformular mit den zuletzt eingegebenen Werten anzeigen, Text: „Code nicht gefunden. Bitte Übungscode und Teilnehmercode prüfen (Zahl 0 / Buchstabe O verwechselt?).“ Zeichen wie 0/O, 1/I im Code-Alphabet vermeiden, falls noch nicht geschehen.
**Retest:** Falschen Teilnehmercode eingeben → innerhalb einer Aktion korrigieren und richtig landen, ohne URL anzufassen.

### [P1] Vordruck-Ansicht am Handy: Abhaken nur per Leertaste, Hinweise nur für Tastatur

**Evidence:** Observed (Bedienelemente), Likely (leeres Vordruckbild – siehe unten)
**Where:** Teilnehmeransicht → „Meldevordruck“ → Modal `#teilnehmerDocModal`; `y-04-meldevordruck.png`, `x-07-meldevordruck.png`
**Field-user reaction:** „Ich sehe den Vordruck – wo drücke ich ‚übertragen‘?“
**Problem:** Im Modal gibt es nur Zurück, Weiter, Schließen (31×31 px) und „Übertragene ausblenden“. Die Legende nennt „Space – Übertragen“, „Ü“, „M“, „N“, „Esc“ – am Handy gibt es keine dieser Tasten. Ein Touch-Knopf zum Abhaken fehlt. Zusätzlich blieb das Vordruckbild im Test auch nach 8 s leer (weiße Fläche); im headless-Mock kann das am PDF-Rendering liegen, muss auf echtem Gerät geprüft werden.
**Operational impact:** Wer mit dem Vordruck arbeitet (realitätsnäher, deshalb gewollt), muss zum Abhaken das Modal schließen und in der Tabelle seitlich suchen – doppelter Weg, Fehlerquelle.
**Recommendation:** Unter dem Vordruck einen großen Knopf „Abgesetzt ✓“ / „Rückgängig“ für die angezeigte Seite. Tastaturlegende nur bei Geräten mit Tastatur zeigen. Schließen-Knopf auf ≥44 px. Lade-/Fehlerzustand im Vordruckbereich anzeigen statt leerer Fläche.
**Retest:** Am Handy Meldevordruck öffnen, Spruch 1 abhaken, weiterblättern, ohne Modal zu verlassen. Vordruck auf realem Android/iOS sichtbar.

### [P2] Abhaken ohne Rückmeldung „angekommen bei der Übungsleitung“ in Sichtweite

**Evidence:** Observed (Anzeige), Not verified (echtes Netz)
**Where:** Badge „Sync: live“ im Kartenkopf (`TeilnehmerView.ts:167`, Zustände `:292-295`); `m-pixel-05-nach-uebertragen.png`, `m-pixel-09-offline-klick.png`
**Field-user reaction:** „Hat die Übungsleitung das jetzt gesehen?“
**Problem:** Der Sync-Status steht ganz oben im Kopf, die Abhak-Handlung weit unten in der Tabelle. Nach dem Tippen ändert sich nur die Zeile (grün, „ÜBERTRAGEN“ – angeschnitten). Ob das wirklich übertragen oder nur lokal gespeichert ist, sieht man erst nach Hochscrollen. Das Wort „übertragen“ ist zudem doppeldeutig: Funkspruch übertragen (gefunkt) vs. Daten übertragen (Sync). Bei einem Offline-Klick im Mock war im sichtbaren Bereich keine Änderung erkennbar (Mock nutzt localStorage, daher echtes Offline-Verhalten **nicht verifiziert**).
**Operational impact:** Unsicherheit, Rückfragen über Funk („Hast du meinen Spruch 3 drin?“), die die Übung stören.
**Recommendation:** Sync-Zustand in die Nähe der Aktion: z. B. kleine Zeile unter dem Abhak-Knopf „gespeichert · an Übungsleitung gesendet“ bzw. „nur auf diesem Gerät – wird gesendet, sobald Netz da ist“. Für die Funkhandlung „abgesetzt“ oder „gefunkt“ statt „übertragen“ verwenden.
**Retest:** Am echten Gerät Flugmodus an, Spruch abhaken, Flugmodus aus – Zustand jederzeit ohne Scrollen ablesbar.

### [P2] Teilnehmer-Startseite: Nachrichtenliste beginnt erst unterhalb des ersten Bildschirms

**Evidence:** Observed
**Where:** `m-pixel-03-teilnehmer.png`, `m-se-03-teilnehmer.png`
**Field-user reaction:** Öffnet Link, sieht Navigation (8 Links), Titel, Kopfdaten – aber keinen einzigen Funkspruch (SE) bzw. erst den Anfang von Spruch 1 am unteren Rand (Pixel 7).
**Problem:** Die Website-Navigation („Wissen“, „FAQ“, „GitHub“ …) und eine große Kopfkarte stehen vor der eigentlichen Aufgabe. Der Titel wiederholt „Sprechfunkübung: Sprechfunkübung …“. Kopfdaten stehen untereinander mit großen Abständen. Datum „040000oct26“ (DTG) ist für viele Helfer nicht auf Anhieb lesbar.
**Operational impact:** Jedes Zurückkehren zur Seite (nach Unterbrechung, Display aus) kostet Scrollen und Suchen; der nächste offene Spruch ist nicht sofort da.
**Recommendation:** In der Teilnehmerrolle Website-Navigation einklappen; oben eine kompakte Zeile „Ich: Heros Oldenburg 16/11 · Rufgruppe T_OL_GOLD-1 · ÜL: Heros Wind 10“, darunter sofort der nächste offene Spruch. Beim Zurückkehren automatisch zum nächsten offenen Spruch springen. Doppeltes „Sprechfunkübung“ vermeiden.
**Retest:** Teilnehmerlink auf iPhone SE öffnen → nächster offener Spruch mit Abhak-Knopf ohne Scrollen sichtbar.

### [P2] Fokus-Modus: nach „Als übertragen markieren“ kein Rückgängig

**Evidence:** Observed
**Where:** X-Zeit-Übung, Fokus-Modus `#teilnehmerFokusCard`; `y-01-fokus.png` → `y-02-fokus-nach-klick.png`
**Field-user reaction:** Positiv: großer Knopf (338×47 px), klarer Text „Meldung 1 fällig · X+0“, Empfänger, Spruchtext. Nach dem Tippen: Countdown „Nächste Meldung in 2:42“. „Moment, ich hab mich verdrückt – wie hole ich den zurück?“
**Problem:** Kein „Rückgängig“-Hinweis, keine kurze Bestätigung „Meldung 1 abgehakt“. Korrektur nur über Fokus-Modus aus → Tabelle → seitlich wischen (siehe P1 oben).
**Operational impact:** Versehentliches Abhaken (Handschuh, Tasche, Doppeltipp) führt dazu, dass ein Spruch ausfällt und die Übungsleitung ihn als erledigt sieht.
**Recommendation:** Nach dem Abhaken für einige Sekunden „Meldung 1 abgehakt – Rückgängig“ einblenden; in der Countdown-Karte den zuletzt abgehakten Spruch klein mit „zurücknehmen“ anbieten.
**Retest:** Im Fokus-Modus abhaken und innerhalb von 5 s mit einem Tipp zurücknehmen.

**Was gut ist (bei Redesign erhalten):** Der Fokus-Modus ist genau das richtige Modell für den Helfer – ein Spruch, ein großer Knopf, klare Fälligkeit, Restanzahl „noch 10 offen“. Er sollte am Handy der Standard sein, nicht ein versteckter Schalter, der nur bei X-Zeit existiert.

### [P2] X-Zeit startet jeder Teilnehmer selbst

**Evidence:** Likely
**Where:** X-Zeit-Karte in der Teilnehmeransicht („X-Zeit: [--:--] Jetzt starten“), `x-03-nach-code-eingabe.png`; Speicherung in `this.storage.xZeitBasis` (`src/teilnehmer/index.ts:242`)
**Field-user reaction:** „Muss ich das drücken oder macht das die Übungsleitung? Wann genau?“
**Problem:** Die Bezugszeit wird je Gerät gesetzt. Ohne klare Ansage drücken Helfer zu unterschiedlichen Zeitpunkten – die Fälligkeiten laufen auseinander. Ob die Basis von der Übungsleitung übernommen wird, ist in der Oberfläche nicht erkennbar.
**Operational impact:** Uneinheitlicher Takt, Funkspitzen oder Leerlauf, Rückfragen.
**Recommendation:** Wenn die Übungsleitung eine X-Zeit gesetzt hat, diese anzeigen („X-Zeit 19:16, gesetzt von der Übungsleitung“) und den eigenen Start-Knopf ausblenden; sonst Hinweistext „Erst drücken, wenn die Übungsleitung ‚X-Zeit jetzt‘ funkt“.
**Retest:** Zwei Teilnehmergeräte, Übungsleitung setzt X-Zeit → beide zeigen identische Fälligkeiten ohne eigenes Zutun.

### [P2] Übungsleitungsansicht am Handy/Tablet-Hochformat nicht nutzbar

**Evidence:** Observed
**Where:** `#/uebungsleitung/<id>` auf Pixel 7; `m-pixel-11-uebungsleitung.png`, `x-11-ul-nachrichten-mobil.png`
**Field-user reaction:** Übungsleiter geht im Raum herum, will am Handy nachsehen, wer noch hängt.
**Problem:** Die Knöpfe „Übungsleitung als PDF“ ragen links aus der Karte; der Nachrichtenplan ist abgeschnitten (Spruchtext und Notizfeld nach wenigen Zeichen abgeschnitten, Status/„abgesetzt“ gar nicht sichtbar). Der rote Knopf „Lokale Übungsdaten zurücksetzen“ steht gleichrangig zwischen den PDF-Knöpfen.
**Operational impact:** Übungsleitung ist an den Laptop gebunden. Für den Dienstabend akzeptabel (Annahme: Übungsleitung sitzt meist am Tisch), daher P2.
**Recommendation:** Mindestens eine kompakte Handy-Ansicht „Teilnehmer + Fortschritt“ (die Teilnehmertabelle funktioniert schon halbwegs). Zurücksetzen räumlich von häufigen Aktionen trennen.
**Retest:** Pixel 7: Fortschritt aller Teilnehmer und „Anmelden“ ohne Seitwärtsscrollen bedienbar.

### [P3] Code-Felder ohne Eingabehilfen

**Evidence:** Observed
**Where:** `#/teilnehmer` → `#joinUebungCode`, `#joinTeilnehmerCode` (`m-pixel-02-teilnehmer-leer.png`)
**Problem:** Normale Textfelder ohne `autocapitalize="characters"`/`autocomplete="off"`, Tastatur startet in Kleinschreibung. Kleinschreibung wird aber akzeptiert (Observed: Eingabe in Kleinbuchstaben führte korrekt zur Übung) – gut. Knopf „Zugang öffnen“ ist nicht vollbreit, Startseite des Generators zeigt dasselbe Formular nochmal mit anderem Knopftext („Teilnehmer-Zugang öffnen“).
**Recommendation:** Großbuchstaben-Tastatur, Autokorrektur aus, vollbreiter Knopf, einheitliche Beschriftung.
**Retest:** Am Handy Code tippen, ohne die Shift-Taste zu nutzen und ohne dass die Autokorrektur eingreift.

### [P3] Fachfremde Begriffe in der Teilnehmerrolle

**Evidence:** Observed
**Where:** Teilnehmeransicht: „Sync: live“, „ZIP herunterladen“, „Lokale Daten löschen“; Übungsleitung: „Tempo“, „Funklast“, „Heatmap 5m“, „ETA“ (`d03-uebungsleitung.png`)
**Problem:** Für Helfer ohne IT-Hintergrund unklar, was „ZIP“ oder „lokale Daten“ bedeuten und ob man das braucht.
**Recommendation:** „Alle meine Vordrucke herunterladen (ZIP)“, „Meinen Abhak-Stand zurücksetzen“, „Verbindung zur Übungsleitung: ok“. In der ÜL-Ansicht kurze Erklärtexte per Tipp.
**Retest:** Drei Helfer ohne Einweisung fragen, was die Knöpfe tun.

### Nicht verifiziert

- **Sonnenlicht / Nacht:** Dunkelmodus funktioniert (`m-pixel-10-dark.png`), Status farbig + Wort – gut. Echte Ablesbarkeit draußen nicht testbar.
- **Handschuhe:** Bedienziele gemessen (Chip 78×27, Schalter 34×17, Schließen 31×31 – zu klein; Fokus-Knopf 338×47 – gut). Realer Handschuh-Test steht aus.
- **Echtes Funkloch:** Im Mock nicht prüfbar; Badge-Texte existieren („Sync: offline … wird später übertragen“). Mit echtem Firestore und Flugmodus testen.
- **Vordruck leer:** Modal-Vordruck blieb im headless Mobil-Test leer; auf realem Gerät prüfen.

---

## Comprehension check

- **Orientation:** uncertain – Rolle und eigener Rufname klar, aber Website-Navigation „Übung erstellen“ ist auch in der Teilnehmerrolle aktiv markiert.
- **Next action:** uncertain (Tabelle am Handy) / understood (Fokus-Modus)
- **System status:** uncertain – Spruchstatus in angeschnittener Spalte, Sync-Zustand weit von der Aktion entfernt.
- **Error recovery:** failed (falscher Code ohne Rückweg; Abhaken im Fokus-Modus ohne Rückgängig)
- **Field suitability:** limited – Desktop/Übungsleitung brauchbar; Teilnehmerrolle am Handy nur mit Fokus-Modus gut, sonst eingeschränkt.

## Zusammenfassung

| Priorität | Anzahl |
|---|---|
| P0 | 0 |
| P1 | 4 |
| P2 | 5 |
| P3 | 2 |
