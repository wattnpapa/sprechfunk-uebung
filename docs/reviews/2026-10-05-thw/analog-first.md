Befunde: P0=0 P1=0 P2=2 P3=5
Abgleich: behoben=5 teilweise=2 offen=0 nicht-pruefbar=0

# THW-Review „Analog first“ – Sprechfunk Übungsgenerator (zweiter Lauf)

- **Datum:** 2026-10-05
- **Perspektive:** erfahrener, IT-skeptischer THW-Helfer, der Meldeblock, Vordruck, Whiteboard und Funk bevorzugt (Skill `thw-analog-first-reviewer`)
- **Geprüft gegen:** lokaler Build `http://127.0.0.1:3000`, Mock-Firestore im `localStorage` (`useFirestoreEmulator=1`), Playwright/Chromium 1194
- **Rollen:** Generator/Übungsleitung (Desktop 1440×1000), Teilnehmer (412×915, mobil/Touch), Übungsleitungs-Ansicht während der Übung, Admin
- **Belege:** Screenshots und Downloads unter `/tmp/claude-0/-home-user-sprechfunk-uebung/8e81b214-a84b-574f-81cf-240dddbe65b9/scratchpad/analog-first/r2/`
- **Kontext:** Ausbildungswerkzeug für Dienstabende, kein Echteinsatz-System. „Einsatz“ meint hier den Übungsabend.

## Durchgeführter Ablauf

1. Generator: Übung „Dienstabend Funk“, 3 Teilnehmer, 8 Sprüche, individuelle Lösungswörter, Vorlage `thwleer` (`01-generator.png`, `02-links.png`). ZIP (`alle.zip`, 35 Dateien, 617 kB) und „Alle Übersichten als eine PDF“ geladen, mit `pdftotext`/`pdftoppm` geprüft (`p-ueb-1.png`, `p-ul-1.png`).
2. Teilnehmer mobil: Nr. 1 online abgehakt, Netz getrennt, Nr. 2 abgehakt (`12-tn-offline-klick.png`), offline neu geladen (`13-tn-offline-reload.png`), wieder online (`14-tn-online-wieder.png`).
3. Übungsleitung in frischem Tab: **als erste Aktion** „Übungsleitung als PDF“ (`ul-erst.pdf`), dann Anmeldung, „abgesetzt“, „Zeit nachtragen“/„Zeit ändern“ (`22-ul-zeit-edit.png`, `23-ul-zeit-gespeichert.png`), Übungsleitungs-PDF und Debrief-PDF; offline neu geladen (`25-ul-offline-reload.png`) und offline erneut PDF + Debrief erzeugt (`ul-offline.pdf`, `debrief-offline.pdf`).
4. Zweite Übung „Papierabend“: Generator offline neu geladen (`40-gen-offline-reload.png`); Sammel-Nachtrag von 7 Papierzeiten (`51-sammel-zwischen.png`, `52-sammel-ende.png`, Ergebnis nach Reload stabil); Nachtrag mit Browser-Uhr drei Tage später (`47-ul-nachtrag-spaeter.png`); Zugang nur mit den Codes vom Blatt (`48-join.png`, `49-join-result.png`).
5. Reines Teilnehmer-Gerät (eigener Browser-Kontext, nur der Teilnehmer-Link wurde je geöffnet): online geladen, dann offline „Alle meine Vordrucke herunterladen (ZIP)“ (`50-tn-nur-tn-geraet-offline-zip.png`) und Vordruck-Ansicht (`53-tn-geraet-offline-vordruck.png`).
6. Admin-Liste (`30-admin.png`).

**Nicht prüfbar im Mock:** echte Firestore-Synchronisation zwischen zwei Geräten nach Netzrückkehr und Konfliktverhalten. Im Mock teilen sich alle Tabs eines Kontexts denselben `localStorage`; dass die offline gesetzte Markierung bei der Leitung ankam, beweist daher nichts über den Echtbetrieb.

## Urteil aus Sicht der Rolle

Der Papierweg ist jetzt rund. Alles, was ich am Abend auf dem Tisch haben will, kommt als Ausdruck heraus: Übersicht je Teilnehmer mit Übungs- und Teilnehmercode, QR-Code und Spalte „Abgesetzt (Uhrzeit)“, Übungsleitungs-Blatt mit Teilnehmercodes, Soll/Ist-Feldern und Zeitspalte, ein `LIESMICH.txt`, das sagt, was wofür ist. Das ZIP ist von 31,6 MB auf 617 kB geschrumpft. „Übungsleitung als PDF“ geht als erste Aktion und sogar offline. Die Seiten lassen sich nach dem ersten Besuch ohne Netz neu laden. Papierzeiten kann die Leitung je Zeile nachtragen, gekennzeichnet als „nachgetragen“, und sie überleben das Neuladen.

Reibung bleibt beim **Zurückholen** der Papierstände: Wer die Zeit des Anmeldespruchs korrigiert, korrigiert nicht die Anmeldezeit; die Ausdrucke widersprechen sich danach. Wer erst Tage später nachträgt, bekommt das falsche Datum. Die Uhrzeiten, die Teilnehmer laut Übersicht notieren sollen, haben in der App keinen Eingang.

Aufgabe „Übung auf Papier durchführen und danach digital nachziehen“: ohne fremde Hilfe machbar.

## Befunde

### P2-1 – Korrigierte Zeit des Anmeldespruchs ändert die Anmeldezeit nicht; Ausdrucke widersprechen sich

1. **Priorität:** P2
2. **Fundstelle / Aufgabe:** `#/uebungsleitung/<id>`, Nachrichtenplan Zeile Nr. 1 (Anmeldespruch), „Zeit nachtragen“ → später „Zeit ändern“; Teilnehmer-Tabelle Spalte „Angemeldet“; `Uebungsleitung.pdf` Seite 1 Spalte „Anmeldung“; Debrief-PDF.
3. **Beobachtung:**
   - Übung „Papierabend“: Anmeldespruch Heros Oldenburg 21/11 auf 19:00 nachgetragen. Teilnehmer-Tabelle zeigt danach „angemeldet 051900oct26“. Anschließend per „Zeit ändern“ auf 19:10 korrigiert. Plan: „Leitung 19:10 · nachgetragen“, `051910oct26`. Teilnehmer-Tabelle bleibt bei „angemeldet 051900oct26“ (`44-ul-anmeldung-vs-nachtrag.png`). `ul-offline.pdf` Seite 1: Anmeldung `051900oct26`.
   - Übung „Dienstabend Funk“: Anmeldespruch erst per Klick um 21:01 abgesetzt, dann auf 19:05 geändert. `ul.pdf` Seite 1: Anmeldung `052101oct26`, Seite 2: Nr. 1 `051905oct26`. `debrief.pdf`: Anmeldung `051905oct26`.
   - Ursache: Die Anmeldezeit wird nur gesetzt, wenn noch keine existiert (`src/uebungsleitung/aktionen.ts:84-92`, `meldeMitFunkspruchAn`).
4. **Erwartung der Rolle:** Ich korrigiere eine Zeit einmal, und danach steht überall dieselbe. Anmeldung und Anmeldespruch sind derselbe Vorgang.
5. **Auswirkung:** Bei der Nachbesprechung liegen zwei Ausdrucke mit verschiedenen Anmeldezeiten auf dem Tisch (Übungsleitungs-PDF gegen Debrief). Beim Abgleich mit dem Papierplan weiß niemand, welche Zeit gilt, und die Glaubwürdigkeit der ganzen Auswertung leidet.
6. **Empfehlung:** Eine Zeitkorrektur am Anmeldespruch soll die Anmeldezeit mitziehen, zumindest solange die Anmeldung über diesen Spruch entstanden ist. Alternativ die Anmeldezeit in der Teilnehmer-Tabelle selbst korrigierbar machen. Übungsleitungs-PDF und Debrief müssen dieselbe Quelle zeigen.
7. **Verifikation:** Anmeldespruch nachtragen (19:00), auf 19:10 ändern: Teilnehmer-Tabelle, `Uebungsleitung.pdf` und Debrief zeigen alle `051910…`.

### P2-2 – Späterer Sammel-Nachtrag landet auf dem falschen Datum

1. **Priorität:** P2
2. **Fundstelle / Aufgabe:** Nachrichtenplan, „Zeit nachtragen“ an einer offenen Zeile, Nachtrag mehr als einen Tag nach der Übung.
3. **Beobachtung:** Übung vom 05.10. (Datum in den Kopfdaten). Browser-Uhr auf drei Tage später gestellt, Zeile Nr. 3 mit 19:20 nachgetragen. Ergebnis: `081920oct26` – also 08.10. statt 05.10. (`47-ul-nachtrag-spaeter.png`). Zeilen, die am selben Abend nachgetragen wurden, stehen korrekt auf `05…`. Der Nachtrag nimmt als Tag „heute bzw. gestern“, nicht das Übungsdatum (`src/uebungsleitung/lagebild.ts:202-218`, `uhrzeitZuIso`). Es wird nur HH:MM abgefragt, ein Datum gibt es nicht.
4. **Erwartung der Rolle:** Das Übungsleitungs-PDF sagt ausdrücklich „… mit Uhrzeit eintragen und später in der App nachtragen“. „Später“ heißt bei uns auch: beim nächsten Dienstabend in Ruhe. Die Uhrzeit vom Papier soll dem Übungstag zugeordnet werden.
5. **Auswirkung:** Der Nachrichtenplan und das Debrief tragen für einen Teil der Sprüche einen falschen Tag. Heatmap/Timeline und Reihenfolge werden unsinnig. Weil die DTG-Form den Tag nur als zwei Ziffern zeigt, fällt der Fehler auf Papier kaum auf.
6. **Empfehlung:** Nachgetragene Uhrzeiten auf das Übungsdatum beziehen (bei Übungen über Mitternacht den Folgetag zulassen), oder beim Nachtrag das Datum sichtbar mit anbieten. Mindestens warnen, wenn das Ergebnis nicht auf dem Übungsdatum liegt.
7. **Verifikation:** Übung vom Tag X, am Tag X+3 eine Zeile mit 19:20 nachtragen: Plan und Debrief zeigen Tag X 19:20.

### P3-1 – Die Uhrzeiten der Teilnehmer vom Papier haben keinen Weg zurück in die App

1. **Priorität:** P3
2. **Fundstelle / Aufgabe:** Teilnehmer-Übersicht (`p-ueb-1.png`): Spalte „Abgesetzt (Uhrzeit)“ und Fußtext „Abgesetzte Sprüche abhaken und Uhrzeit notieren – so geht auch ohne Netz nichts verloren.“ Teilnehmeransicht (`12-tn-offline-klick.png`); Übungsleitung „Bestätigen“ / „N gemeldete bestätigen“.
3. **Beobachtung:** Am Handy kann der Teilnehmer nur „Als abgesetzt markieren“, die Zeit ist die Klickzeit („ABGESETZT 21:00“). Eine abweichende Uhrzeit lässt sich dort nicht eintragen. Bei der Leitung erscheinen solche Nachklicks als „GEMELDET (TN)“ mit Klickzeit („Teilnehmer: 052100oct26“, `23-ul-zeit-gespeichert.png`, Zeile 4). „N gemeldete bestätigen“ übernimmt laut Code genau diese Meldezeit als Absetzzeit (`src/uebungsleitung/aktionen.ts`, `gemeldeteBestaetigen`). Das Debrief zeigt beide Spalten getrennt („Gemeldet (TN)“, „Bestätigt (Leitung)“) – gut, aber die TN-Spalte zeigt dann nur Klickzeiten. Die Entscheidung, Teilnehmern keine Zeiteingabe zu geben, ist im Umsetzungsdokument begründet (die Hauptaktion am Handy soll einfach bleiben). Nachvollziehbar.
4. **Erwartung der Rolle:** Wenn mir das Blatt sagt „Uhrzeit notieren, so geht nichts verloren“, will ich wissen, wohin die Zeit danach geht. Sonst notiere ich sie umsonst.
5. **Auswirkung:** Gering. Die Zeiten der Leitung sind maßgeblich und können dort nachgetragen werden. Risiko: Die Leitung bestätigt nach einer Papierphase alle Meldungen mit einem Klick und übernimmt so Klickzeiten statt Papierzeiten.
6. **Empfehlung:** Den Fußtext der Übersicht um den Weg ergänzen („Notierte Zeiten gibst du nach der Übung der Übungsleitung; die trägt sie nach“). Bei „N gemeldete bestätigen“ einen Hinweis zeigen, dass die Meldezeit übernommen wird.
7. **Verifikation:** Ein Teilnehmer, der nur auf Papier gearbeitet hat, kann ohne Rückfrage sagen, was mit seinen notierten Zeiten passiert.

### P3-2 – „Unterlagen für den Notfall“ lassen sich auf einem reinen Teilnehmer-Gerät offline nicht erzeugen

1. **Priorität:** P3
2. **Fundstelle / Aufgabe:** Teilnehmeransicht, Kasten „Unterlagen für den Notfall“, Button „Alle meine Vordrucke herunterladen (ZIP)“.
3. **Beobachtung:** Ein frischer Browser-Kontext öffnet nur den Teilnehmer-Link (Service Worker aktiv, `navigator.serviceWorker.controller` gesetzt). Nach dem Trennen des Netzes erzeugt der ZIP-Button keinen Download, die Meldung lautet nur „ZIP konnte nicht erstellt werden.“ (`50-tn-nur-tn-geraet-offline-zip.png`). Die Vordruck-Ansicht auf demselben Gerät funktioniert offline (`53-tn-geraet-offline-vordruck.png`). Im Kontext, in dem vorher der Generator gelaufen war, erschien zusätzlich der bessere Text „Die Druckfunktion konnte nicht geladen werden … Ohne Netz helfen die vorher gedruckten Unterlagen“ (`41-tn-offline-zip.png`). Der Kasten selbst sagt richtig „Lade sie vor der Übung herunter“.
4. **Erwartung der Rolle:** Wenn das Handy die Vordrucke offline anzeigen kann, erwarte ich, dass es sie auch als Datei speichern kann. Wenn nicht, will ich den Grund wissen.
5. **Auswirkung:** Gering, weil der Hinweis zum Vorab-Download dasteht. Wer ihn überliest, bekommt am Übungsort ohne Netz eine knappe Fehlermeldung ohne Grund und ohne Ausweg.
6. **Empfehlung:** Die ZIP-Funktion beim ersten Online-Besuch mit vorhalten. Andernfalls im Fehlerfall immer den erklärenden Text zeigen und auf die Vordruck-Ansicht verweisen, die offline geht.
7. **Verifikation:** Teilnehmer-Link online öffnen, Flugmodus, ZIP-Button: Download kommt, oder die Meldung nennt Grund und Alternative.

### P3-3 – Hinweis im Generator stimmt nicht mehr: „Ohne Netz lässt sich diese Seite nicht neu laden“

1. **Priorität:** P3
2. **Fundstelle / Aufgabe:** Generator-Ergebnis unter dem ZIP-Button (`02-links.png`, `.generator-druck-hinweis`).
3. **Beobachtung:** Der Text sagt „Ohne Netz lässt sich diese Seite nicht neu laden; dann sind die Ausdrucke die Rückfallebene.“ Tatsächlich laden Generator (`40-gen-offline-reload.png`), Teilnehmeransicht (`13-tn-offline-reload.png`) und Übungsleitung (`25-ul-offline-reload.png`) nach dem ersten Besuch offline neu, mit Daten. Die Übungsleitung kann offline sogar PDF und Debrief erzeugen (`ul-offline.pdf`, `debrief-offline.pdf`).
4. **Erwartung der Rolle:** Was auf dem Bildschirm steht, stimmt. Sonst glaube ich dem nächsten Hinweis auch nicht.
5. **Auswirkung:** Gering. Der Hinweis ist vorsichtiger als nötig, und der Kern stimmt: vorher drucken. Er unterschlägt aber, dass ein Gerät, das die Seite schon einmal geöffnet hatte, weiterarbeiten kann. Ein Gerät, das sie nie geöffnet hatte, kann es nicht.
6. **Empfehlung:** Wortlaut an das tatsächliche Verhalten anpassen, etwa: „Öffne die Links vor der Übung einmal mit Netz; ohne Netz zu Hause gedruckte Unterlagen sind die sichere Rückfallebene.“
7. **Verifikation:** Hinweistext gegen einen Offline-Reload-Test lesen: Aussage und Verhalten passen zusammen.

### P3-4 – Am Handy nicht erkennbar, welche Markierung noch nicht bei der Leitung ist

1. **Priorität:** P3 (Echtbetrieb im Mock nicht prüfbar)
2. **Fundstelle / Aufgabe:** Teilnehmeransicht mobil, Nr. 1 online und Nr. 2 offline abgehakt.
3. **Beobachtung:** Der Kopf zeigt jetzt deutlich „Sync: offline – wird nachgereicht“ (gelb, `12-tn-offline-klick.png`) und nach Rückkehr „Sync: live“ (`14-tn-online-wieder.png`). Die beiden Karten sehen aber identisch aus („✓ ABGESETZT 21:00“). Ob Nr. 2 die Leitung schon erreicht hat, zeigt die einzelne Karte nicht.
4. **Erwartung der Rolle:** Pro Spruch sehen: „bei der Leitung“ oder „nur hier“.
5. **Auswirkung:** Gering. Im Zweifel fragt man per Funk nach; genau das erzeugt aber Doppelmeldungen.
6. **Empfehlung:** Offline gesetzte, noch nicht übertragene Markierungen bis zur Bestätigung kenntlich machen (z. B. „lokal“).
7. **Verifikation:** Gegen echten Firestore: Flugmodus, zwei Sprüche abhaken. Karten zeigen „lokal“, nach Netzrückkehr verschwindet der Zusatz.

### P3-5 – Soll-Lösungswort wird im Übungsleitungs-PDF mitten im Wort umbrochen

1. **Priorität:** P3
2. **Fundstelle:** `Uebungsleitung.pdf` Seite 1, Spalte „Lösungswort Soll“ (`p-ul-1.png`).
3. **Beobachtung:** „EINSATZBESPRECHUN“ / „G“ auf zwei Zeilen; die Spalte „Lösungswort Ist“ daneben ist gleich schmal.
4. **Erwartung der Rolle:** Soll und Ist stehen auf Papier vollständig nebeneinander. Der Vergleich passiert Buchstabe für Buchstabe.
5. **Auswirkung:** Beim Abgleich auf Papier liest man leicht ein „G“ als eigenen Eintrag. Für das handschriftliche Ist ist zu wenig Platz für lange Wörter.
6. **Empfehlung:** Lösungswort-Spalten breiter (zulasten von „Bemerkungen“) oder Umbruch nur an Wortgrenzen.
7. **Verifikation:** Übung mit Lösungswort ≥ 18 Zeichen drucken: Wort steht in einer Zeile, Ist-Feld bietet gleich viel Platz.

## Positiv festgehalten (kein Befund)

- **Zugang vom Blatt:** Übersicht mit Übungscode, Teilnehmercode (groß) und QR-Code; Übungsleitungs-PDF mit Zugangsadresse, Teilnehmercode je Zeile und QR „Übungsleitung wieder öffnen“. Mit den beiden Codes vom Blatt kommt man über `#/teilnehmer` in seine Ansicht (`49-join-result.png`).
- **Papier ersetzt Bildschirm 1:1:** Spalte „Abgesetzt (Uhrzeit)“ auf der Übersicht, „Lösungswort Ist“/„Stärke Ist“ und Zeitspalte auf dem Übungsleitungs-PDF, dazu ein Satz zum Papierbetrieb auf beiden Blättern.
- **`LIESMICH.txt` im ZIP:** „Druck die Unterlagen VOR der Übung aus …“ und Zweck jeder Datei, inklusive des Hinweises, dass die Nadeldrucker-Dateien kleiner sind.
- **Sammel-Nachtrag funktioniert:** sieben Papierzeiten (19:00–19:12) nacheinander per „Zeit nachtragen“, auch per Enter. Alle als „nachgetragen“ gekennzeichnet und nach dem Neuladen erhalten. Tempo bleibt „–“ statt eines Unsinnswerts.
- **Offlinefähigkeit nach Erstbesuch:** Neuladen ohne Netz funktioniert in allen Rollen; Übungsleitungs-PDF und Debrief entstehen offline.
- **Debrief trennt Herkunft:** „Gemeldet (TN)“ und „Bestätigt (Leitung)“ mit „(nachgetragen)“ getrennt ausgewiesen.

## Analog-/Digital-Übergabematrix

| Prozessschritt | Digitaler Nutzen | Analoger Fallback | Sauberer Wiedereinstieg in Digital |
|---|---|---|---|
| Funksprüche verteilen, Vordrucke erstellen | Faire Zufallsverteilung, Lösungswörter, Stärken, vorausgefüllte Vordrucke in Sekunden | ZIP (617 kB) mit `LIESMICH.txt`, vor dem Abend gedruckt | Codes + QR auf Übersicht und Übungsleitungs-PDF; Übung über Admin/Übungs-ID wieder abrufbar |
| Teilnehmer: Spruch absetzen | Live-Fortschritt für die Leitung, Fokus auf den nächsten Spruch | Übersicht mit Spalte „Abgesetzt (Uhrzeit)“ | Nachklicken am Handy nur mit Klickzeit; Papierzeiten gehen über die Leitung (P3-1) |
| Übungsleitung: Anmeldung, Lösungswort, Stärke | Soll/Ist-Vergleich automatisch, Debrief je Teilnehmer | `Uebungsleitung.pdf` S. 1 mit Ist-Feldern, Codes, Bemerkungen | Eingabefelder vorhanden; Anmeldezeit folgt einer Korrektur des Anmeldespruchs nicht (P2-1) |
| Übungsleitung: Nachrichtenplan führen | Tempo, ETA, Funklast, Heatmap | `Uebungsleitung.pdf` ab S. 2 mit Spalte „Abgesetzt (Uhrzeit)“ | „Zeit nachtragen“ je Zeile, gekennzeichnet; bei Nachtrag an einem späteren Tag falsches Datum (P2-2) |
| Gerät/Tab weg, kein Netz | – | Ausdruck; nach Erstbesuch lädt die Seite offline neu | Lokaler Stand bleibt; Sync-Badge zeigt „offline – wird nachgereicht“; pro Spruch nicht unterscheidbar (P3-4) |
| Nachbesprechung | Debrief-PDF mit TN-/Leitungszeit getrennt | Papierplan mit Bemerkungen | Stimmig, sofern die Zeiten zum Übungstag passen und Anmeldezeit konsistent ist (P2-1, P2-2) |

## Würde ich dafür das Papier weglegen?

**Nein, und das muss ich auch nicht: Die Anwendung druckt mir das Papier jetzt so, dass ich es nach dem Abend ohne Umschreiben wieder einpflegen kann.** Einzige Einschränkung: Korrekturen an Anmeldezeiten und Nachträge an einem späteren Tag muss ich gegenlesen.

## Abschluss

- **Aufgabe geschafft:** ja
- **Fremde Hilfe nötig:** nein
- **Größtes Missverständnis:** Der Generator sagt „ohne Netz lässt sich die Seite nicht neu laden“, dabei arbeitet sie nach dem ersten Besuch offline weiter. Nur ein nie geöffnetes Gerät steht ohne Netz da.
- **Größtes Einsatzrisiko:** Nach einer Papierphase zeigen Übungsleitungs-PDF und Debrief unterschiedliche Anmeldezeiten bzw. ein falsches Datum, und die Nachbesprechung streitet über die Zeiten statt über den Funkverkehr.
- **Top-Priorität für die nächste Iteration:** Zeitkorrektur am Anmeldespruch auf die Anmeldezeit durchziehen und nachgetragene Uhrzeiten immer dem Übungsdatum zuordnen (P2-1, P2-2).

## Abgleich mit dem Lauf vom 2026-10-04

| Alte ID | Titel | Alte Priorität | Status jetzt | Beleg aus diesem Lauf |
|---|---|---|---|---|
| P1-1 | „Übungsleitung als PDF“ schlägt in frischer Sitzung fehl | P1 | behoben | Frischer Tab, erste Aktion: Download `ul-erst.pdf` (3 Seiten). Auch offline nach Reload: `ul-offline.pdf`. |
| P2-1 | Druckstücke enthalten keine Zugangsdaten | P2 | behoben | Übersicht: Übungscode `T4JN4Q`, Teilnehmercode `42YQ`, QR „Zugang Teilnehmeransicht“ (`p-ueb-1.png`). Übungsleitungs-PDF: Codes je Teilnehmer, Zugangsadresse, QR (`p-ul-1.png`). Login nur mit Codes klappt (`49-join-result.png`). Rest: Das Deckblatt der Gesamt-Vordrucke trägt keine Codes, die Übersicht genügt aber. |
| P2-2 | Papierstände lassen sich nicht zeitrichtig nachtragen | P2 | teilweise | Leitung: „Zeit nachtragen“/„Zeit ändern“ je Zeile, „nachgetragen“ gekennzeichnet, auch im Debrief; 7 Zeiten nach Reload erhalten. Offen: Anmeldezeit zieht nicht mit (neu P2-1), falsches Datum bei späterem Nachtrag (neu P2-2), Teilnehmer ohne Zeiteingabe (neu P3-1). |
| P2-3 | Ausdrucke ohne Abhak-/Ist-Spalten | P2 | behoben | Übersicht: Spalte „Abgesetzt (Uhrzeit)“; Übungsleitungs-PDF: „Lösungswort Ist“, „Stärke Ist“, Zeitspalte „Abgesetzt (Uhrzeit)“ (`ul.pdf`). |
| P2-4 | Kein „vor der Übung drucken“-Hinweis; App ohne Netz nicht startbar | P2 | behoben | Hinweis am ZIP-Button (`02-links.png`), im Teilnehmer-Kasten „Unterlagen für den Notfall“, in `LIESMICH.txt` und auf beiden PDFs. Offline-Reload in allen Rollen erfolgreich (`13-…`, `25-…`, `40-…`). Hinweistext jetzt zu pessimistisch (neu P3-3). |
| P3-1 | Sync-Zustand schwach sichtbar, nicht je Nachricht | P3 | teilweise | Global deutlich: „Sync: offline – wird nachgereicht“ (`12-tn-offline-klick.png`). Je Spruch weiterhin kein Unterschied zwischen lokal und übertragen (neu P3-4). |
| P3-2 | Dateigröße der Druckdaten | P3 | behoben | `alle.zip` 617 kB statt 31,6 MB; Meldevordruck A5 ca. 22 kB statt 1,9 MB; `LIESMICH.txt` nennt die kleineren Nadeldrucker-Dateien. |
