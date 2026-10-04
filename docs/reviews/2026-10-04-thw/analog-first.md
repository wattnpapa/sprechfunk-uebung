# THW-Review „Analog first“ – Sprechfunk Übungsgenerator

- **Datum:** 2026-10-04
- **Perspektive:** erfahrener, IT-skeptischer THW-Helfer, der Meldeblock, Vordruck, Whiteboard und Funk bevorzugt (Skill `thw-analog-first-reviewer`)
- **Geprüft gegen:** lokaler Build `http://127.0.0.1:3000`, Mock-Firestore im `localStorage` (`useFirestoreEmulator=1`), Playwright/Chromium
- **Rollen:** Generator/Übungsleitung (Desktop 1440×1000), Teilnehmer (Pixel 7), Übungsleitungs-Ansicht während der Übung, Admin
- **Belege:** Screenshots und Downloads unter `/tmp/claude-0/-home-user-sprechfunk-uebung/8e81b214-a84b-574f-81cf-240dddbe65b9/scratchpad/analog-first/` (Dateinamen unten genannt)
- **Kontext:** Ausbildungswerkzeug für Dienstabende, kein Echteinsatz-System. „Einsatz“ meint hier den Übungsabend.

## Durchgeführter Ablauf

1. Generator: Übung „Dienstabend Funk“, 3 Teilnehmer, 8 Sprüche je Teilnehmer, individuelle Lösungswörter, Vorlage `thwleer` → generiert (`01-generator.png`, `02-links.png`).
2. „Alle Druckdaten als ZIP“ (`alle.zip`, 34 Dateien, ca. 31,6 MB) und „Alle Übersichten als eine PDF“ (`uebersichten.pdf`) heruntergeladen und mit `pdftotext`/`pdftoppm` inhaltlich geprüft.
3. Teilnehmer auf Pixel 7: Ansicht geöffnet (`10-tn-mobil.png`), Nachricht 1 als übertragen markiert, dann Netz getrennt (`context.setOffline(true)`), Nachricht 2 markiert (`12-tn-offline-klick.png`), Seite offline neu geladen (`13-tn-offline-reload.png`), wieder online: beide Markierungen erhalten. Teilnehmer-ZIP geladen (`tn.zip`).
4. Übungsleitung in **frischer Sitzung**: Teilnehmer angemeldet, eine Nachricht „abgesetzt“, dann „Übungsleitung als PDF“ geklickt (`23-ul-pdf-fehler.png`), anschließend „Alle Teilnehmer-Übersichten als PDF“, danach erneut „Übungsleitung als PDF“ (`ul.pdf`), „Debrief PDF“ (`debrief.pdf`). Offline-Reload (`22-ul-offline-reload.png`).
5. Admin-Liste (`30-admin.png`).

**Nicht prüfbar im Mock:** echtes Verhalten bei Firestore-Ausfall, Wiederanlauf mit Konflikt zwischen zwei Geräten, Synchronisation nach Netzrückkehr. Der Sync-Badge blieb im Mock offline auf „Sync: live“ (`12-tn-offline-klick.png`), weil der Mock nicht über das Netz geht – das ist **kein** beobachteter Fehler der echten App, aber auch kein Beleg, dass die Anzeige „Sync: offline“ im Ernstfall erscheint.

## Urteil aus Sicht der Rolle

Ehrlich: Diese Anwendung ist eine der wenigen, bei denen ich das Papier nicht weglegen muss – sie **erzeugt** es. Der Kern (Funksprüche verteilen, Nachrichten- und Meldevordrucke, Übersichten je Teilnehmer, Nachrichtenplan der Übungsleitung) kommt vollständig als PDF/ZIP heraus, vorausgefüllt, in A4/A5 und sogar als Nadeldrucker-Variante. Damit läuft der Übungsabend auch ohne ein einziges Gerät im Raum. Das ist der richtige Ansatz.

Reibung entsteht an drei Stellen: (1) Der wichtigste Papier-Rückfall der Übungsleitung, „Übungsleitung als PDF“, **funktionierte in einer frischen Sitzung nicht** – erst nachdem ein anderer PDF-Export gelaufen war. (2) Die Druckstücke enthalten keine Zugangsdaten (Übungscode/Teilnehmercode, Link/QR), der Weg von Papier zurück ins Digitale hängt also an einer Mail oder einem Bildschirm. (3) Was auf Papier abgehakt wurde, lässt sich nur „jetzt“ nachtragen – die Uhrzeit wird beim Klick gesetzt und ist nicht korrigierbar.

Die Aufgabe „Übung auf Papier durchführen“ ist ohne fremde Hilfe machbar, sofern die Unterlagen **vor** dem Abend gedruckt werden.

## Befunde

### P1-1 – „Übungsleitung als PDF“ schlägt in frischer Sitzung fehl

1. **Priorität:** P1
2. **Fundstelle / Aufgabe:** `#/uebungsleitung/<id>`, Button `#exportUebungsleitungPdf` („📄 Übungsleitung als PDF“), direkt nach Öffnen bzw. Neuladen der Übungsleitungs-Ansicht.
3. **Beobachtung:** Klick erzeugte keinen Download (8 s Wartezeit). Konsole: `TypeError: this.pdf.autoTable is not a function` (Chunk `Uebungsleitung-*.js`). Im Screenshot `23-ul-pdf-fehler.png` ist kein Ergebnis sichtbar. Nach einem Klick auf „Alle Teilnehmer-Übersichten als PDF“ lieferte derselbe Button anschließend korrekt `ul.pdf` (3 Seiten). Ursache im Code: `src/uebungsleitung/index.ts:786-791` importiert `jspdf` direkt und ruft `Uebungsleitung.draw()` auf, ohne das autoTable-Plugin anzuwenden; das passiert nur im Konstruktor von `PDFGenerator` (`src/services/pdfGenerator.ts:29-33`), der hier noch nicht geladen ist.
4. **Erwartung der Rolle:** Der Ausdruck des Nachrichtenplans ist *die* Rückfallebene der Übungsleitung. Ein Klick, ein PDF – immer.
5. **Auswirkung:** Wer kurz vor Beginn merkt, dass das Laptop-Akku knapp ist, und schnell den Plan drucken will, bekommt nichts. Ohne Kenntnis des Umwegs (anderen PDF-Export zuerst) ist der Papierplan aus dieser Ansicht nicht zu bekommen. Ersatz: ZIP aus dem Generator enthält `Uebungsleitung.pdf` – das weiß aber in der Übungsleitungs-Ansicht niemand.
6. **Empfehlung:** Der Export muss unabhängig von der Klickreihenfolge funktionieren. Fehlschlag sichtbar und mit Alternative melden („Plan alternativ im Druckdaten-ZIP“).
7. **Verifikation:** Übungsleitungs-Link in neuem Tab öffnen, als erste Aktion „Übungsleitung als PDF“ klicken → Download erscheint. Als E2E-Test ohne vorherigen anderen PDF-Export.

### P2-1 – Druckstücke enthalten keine Zugangsdaten für den Wiedereinstieg

1. **Priorität:** P2
2. **Fundstelle / Aufgabe:** Teilnehmer-Übersicht (`uebersichten.pdf`, ZIP `Teilnehmer/<Name>/Übersicht_*.pdf`), Melde-/Nachrichtenvordrucke, `Uebungsleitung.pdf`.
3. **Beobachtung:** Fußzeile aller PDFs: „Übung ID: <UUID> | Generiert … | Generator: https://sprechfunk-uebung.de/“. **Kein** Übungscode, **kein** Teilnehmercode, kein Teilnehmer-Link, kein QR-Code (`pdftotext … | grep -i code` leer). In der App stehen die Codes sichtbar (`02-links.png`: „Teilnehmer Code: YJUYPG / SW9D“), und der Generator hat sogar ein Schnellzugangsfeld „Übungscode / Teilnehmercode“.
4. **Erwartung der Rolle:** Das Blatt, das ich in der Hand habe, ist mein Schlüssel. Wenn mein Handy wieder geht oder ich am Rechner sitze, tippe ich den Code vom Blatt ab und bin drin.
5. **Auswirkung:** Teilnehmer, die auf Papier begonnen haben, brauchen den Link aus Mail/Messenger oder müssen bei der Übungsleitung nachfragen. Die 36-stellige UUID ist zum Abtippen ungeeignet.
6. **Empfehlung:** Auf der Teilnehmer-Übersicht (und optional auf dem Deckblatt der Vordrucke) Übungscode + Teilnehmercode groß und abschreibbar abdrucken, optional QR-Code auf den Teilnehmer-Link (es gibt bereits einen eigenen QR-Encoder im Repo, `scripts/lib/qrcode.mjs`). Auf dem Übungsleitungs-PDF die Codeliste aller Teilnehmer.
7. **Verifikation:** Ausdruck einem Helfer geben, Handy neu starten lassen – er kommt nur mit dem Blatt in seine Teilnehmeransicht.

### P2-2 – Papierstände lassen sich nicht zeitrichtig nachtragen

1. **Priorität:** P2
2. **Fundstelle / Aufgabe:** Übungsleitung, Nachrichtenplan, Button `data-action="abgesetzt"` und Spalte „Zeit“ (`src/uebungsleitung/UebungsleitungNachrichtenView.ts:342, 373`); Teilnehmer-Chip „ÜBERTRAGEN“.
3. **Beobachtung:** Status wird mit dem Klickzeitpunkt gespeichert und als DTG angezeigt (`ul.pdf`: Zeit „041915oct26“). Es gibt kein Feld, um eine abweichende (auf Papier notierte) Uhrzeit einzutragen. Freitext-Notiz je Nachricht existiert (`textarea.nachricht-notiz`).
4. **Erwartung der Rolle:** Wenn ich den Abend auf dem Papierplan mitgeschrieben habe (Zeit-Spalte), will ich hinterher in Ruhe abhaken und meine notierten Zeiten übernehmen – Sammelerfassung statt Echtzeit.
5. **Auswirkung:** Nach einer analog geführten Phase zeigen Debrief-PDF, Tempo („155,8 N/min“), ETA und Heatmap Unsinn, weil alle Nachträge dieselbe Uhrzeit tragen. Für die Nachbesprechung (Debrief) wird das Zeitbild falsch.
6. **Empfehlung:** Beim Abhaken optional Uhrzeit (HH:MM) setzen bzw. nachträglich korrigieren können; nachträglich erfasste Einträge als „nachgetragen“ kennzeichnen, damit die Statistik sie nicht als Echtzeit wertet.
7. **Verifikation:** Fünf Nachrichten mit Papierzeiten 19:00–19:20 nachtragen → Debrief-PDF zeigt die Papierzeiten, Tempo-Anzeige springt nicht.

### P2-3 – Ausdrucke haben keine Spalten zum Abhaken/Mitschreiben auf Teilnehmerseite

1. **Priorität:** P2
2. **Fundstelle / Aufgabe:** Teilnehmer-Übersicht (`p-ueb-1.png`, aus `uebersichten.pdf`).
3. **Beobachtung:** Spalten nur „Nr. / Empfänger / Nachrichtentext“. Keine Spalte „gesendet ✓ / Uhrzeit“. Die Übungsleitungs-PDF hat dagegen „Zeit“ und auf Seite 1 „Bemerkungen“ (`p-ul-2.png`) – gut. Lösungswort und Stärke stehen dort nur als Soll; für das empfangene Ist gibt es kein eigenes Feld.
4. **Erwartung der Rolle:** Das Papier soll das digitale Abhaken 1:1 ersetzen: Kästchen „übertragen“, Uhrzeit, ggf. „Quittung erhalten“. In der Übungsleitungs-Liste je Teilnehmer ein leeres Feld „Lösungswort empfangen“ und „Stärke empfangen“.
5. **Auswirkung:** Teilnehmer kritzeln an den Rand; die spätere Übernahme (vgl. P2-2) wird uneinheitlich. Die Übungsleitung vergleicht Soll/Ist im Kopf statt auf dem Blatt.
6. **Empfehlung:** Schmale Spalte „✓ / Uhrzeit“ auf der Teilnehmer-Übersicht; auf Seite 1 des Übungsleitungs-PDF Leerfelder „Ist“ neben Lösungswort und Stärke – dieselben Felder, die die Bildschirmansicht (`Empfangenes Lösungswort`, Stärke-Eingaben in `20-ul.png`) hat.
7. **Verifikation:** Probeabend nur mit Ausdrucken; danach alles aus dem Papier in die App übertragen, ohne dass Informationen fehlen oder umformuliert werden müssen.

### P2-4 – Kein Hinweis „vor der Übung drucken“ an der Stelle, wo es zählt; App ist ohne Netz nicht startbar

1. **Priorität:** P2
2. **Fundstelle / Aufgabe:** Generator-Ergebnis (`02-links.png`), Teilnehmer- und Übungsleitungs-Reload offline (`13-tn-offline-reload.png`, `22-ul-offline-reload.png`).
3. **Beobachtung:** Offline-Reload liefert die Browser-Fehlerseite „No internet“ (kein Service Worker, kein Offline-Cache – Suche nach `serviceWorker` in `src/` ergibt nichts). Solange die Seite offen bleibt, arbeitet die Teilnehmeransicht weiter (Markierung offline gesetzt, nach Reload online erhalten). Im Generator-Ergebnis wird das ZIP prominent angeboten, aber nirgends gesagt, dass es die Rückfallebene für Netz-/Geräteausfall ist. Die Inhaltsseite `/funkuebung-vorlage/` hat zwar einen Abschnitt „Unterlagen rechtzeitig drucken“ – den sieht man beim Generieren aber nicht.
4. **Erwartung der Rolle:** Direkt unter den Links: „Druck die Unterlagen vorher aus – ohne Netz lässt sich die Seite nicht neu laden.“
5. **Auswirkung:** Im Keller des Ortsverbands ohne Empfang: Tab versehentlich geschlossen oder Handy neu gestartet → Teilnehmer steht ohne Sprüche da, wenn nichts gedruckt wurde.
6. **Empfehlung:** Einzeiligen Hinweis an den Druck-Buttons; in Teilnehmer-/Übungsleitungsansicht ein dezenter Hinweis „Seite nicht schließen, solange kein Netz“ bei Offline-Zustand. (Ob die App offlinefähig werden soll, ist eine Produktentscheidung – für einen Dienstabend reicht der Papierweg, wenn er klar kommuniziert ist.)
7. **Verifikation:** Erstnutzer generiert eine Übung und kann danach ohne Nachfrage sagen, was er bei Netzausfall tut.

### P3-1 – Sync-Zustand ist schwach sichtbar und im Mock nicht verifizierbar

1. **Priorität:** P3 (Annahme, im Mock nicht real prüfbar)
2. **Fundstelle / Aufgabe:** Teilnehmer, Badge `#teilnehmerLiveSyncBadge` („Sync: live“), mobil (`10-tn-mobil.png`).
3. **Beobachtung:** Kleiner Badge neben dem Titel. Laut Code gibt es „Sync: offline – Status wird lokal gespeichert und später übertragen“ (`src/teilnehmer/TeilnehmerView.ts:295`), und beim Zusammenführen gewinnt je Eintrag der jüngere Zeitstempel (`src/services/liveStatusMerge.ts:20-37`). Für den Nutzer ist nicht erkennbar, *welche* Einträge noch nicht bei der Leitung sind, und nicht, welcher Stand im Konfliktfall gilt.
4. **Erwartung der Rolle:** Ich will wissen: „Hat die Leitung meinen Haken?“ – pro Nachricht, nicht nur global. Die Spalte „Leitung“ in der Tabelle liefert die Bestätigung, ist mobil aber rechts abgeschnitten (`10-tn-mobil.png`, Spalte STATUS nur angeschnitten).
5. **Auswirkung:** Gering – es ist eine Übung, im Zweifel klärt man es per Funk. Aber genau dann wird doppelt gemeldet.
6. **Empfehlung:** Markierungen, die noch nicht übertragen sind, kenntlich machen (z. B. „lokal“), und im Hilfetext einen Satz zur Regel „neuester Stand gewinnt“.
7. **Verifikation:** Gegen echten Firestore: Gerät in Flugmodus, drei Nachrichten abhaken, Netz an → Leitung sieht drei Einträge, Teilnehmer sah vorher „lokal“.

### P3-2 – Datei-Größe der Druckdaten

1. **Priorität:** P3
2. **Fundstelle:** `alle.zip` (3 Teilnehmer, 8 Sprüche): 34 Dateien, ca. 31,6 MB unkomprimiert; jede Vordruck-PDF ca. 1,9 MB, die Nadeldrucker-Variante ca. 15 kB.
3. **Beobachtung / Auswirkung:** Für den Druck am Vorabend unkritisch. Für „schnell noch per Messenger an den Helfer schicken“ (ein typischer Analog-Ersatz) sind 1,9 MB pro Datei unhandlich; bei 15 Teilnehmern wird das ZIP groß.
4. **Empfehlung:** Die schlanken Varianten im Hinweistext erwähnen („Nadeldrucker-Variante ist klein und auch auf Laserdruckern brauchbar“, falls zutreffend – vom Reviewer nicht gedruckt geprüft).
5. **Verifikation:** Dateigrößen im ZIP-Hinweis sichtbar.

## Positiv festgehalten (kein Befund)

- Vollständiger Papiersatz: Teilnehmer-Übersicht, Melde- und Nachrichtenvordruck je A4/A5/Nadeldrucker, Gesamtdrucke, `Uebungsleitung.pdf` mit Zeit-/Bemerkungsspalte, Debrief je Teilnehmer.
- Eindeutige Schlüssel auf Papier und digital: Absender + laufende Nr. + Übungs-ID auf jedem Blatt – Dubletten bei der Übernahme sind dadurch vermeidbar.
- Teilnehmeransicht arbeitet weiter, solange die Seite offen ist; Markierungen überleben Reload (lokaler Speicher).
- „Lokale Daten löschen“/„Lokale Übungsdaten zurücksetzen“ sind mit Rückfrage geschützt (`src/uebungsleitung/index.ts:816-824`).
- Die Übung lässt sich über die Admin-Liste wieder öffnen und neu ausdrucken (`30-admin.png`).

## Analog-/Digital-Übergabematrix

| Prozessschritt | Digitaler Nutzen | Analoger Fallback | Sauberer Wiedereinstieg in Digital |
|---|---|---|---|
| Funksprüche verteilen und Vordrucke erstellen | Zufällige, faire Verteilung, Lösungswörter, Stärkemeldungen, vorausgefüllte Vordrucke in Sekunden | Druckdaten-ZIP vor dem Abend drucken – vollständig vorhanden | Übung bleibt per Übungs-ID/Admin abrufbar; **fehlt:** Codes/QR auf dem Blatt (P2-1) |
| Teilnehmer: Spruch absetzen und abhaken | Live-Fortschritt für die Leitung, Fokus-Modus, Ausblenden erledigter Sprüche | Übersicht/Vordruck abhaken | Nur per Klick „jetzt“; **fehlen:** Abhakspalte auf Papier (P2-3), Zeitkorrektur (P2-2) |
| Übungsleitung: Anmeldung, Lösungswort, Stärke erfassen | Soll/Ist-Vergleich automatisch, Debrief je Teilnehmer | `Uebungsleitung.pdf` Seite 1 (Soll vorgedruckt, Bemerkungen) | Eingabefelder vorhanden; **fehlen:** Ist-Felder auf Papier (P2-3); Export in frischer Sitzung defekt (P1-1) |
| Übungsleitung: Nachrichtenplan „abgesetzt“ führen | Tempo, ETA, Funklast, Heatmap | `Uebungsleitung.pdf` Seiten 2 ff. mit Zeitspalte | Nachtragen möglich, aber nur mit Klickzeit (P2-2) |
| Gerät/Tab weg, kein Netz | – | Ausdruck; offene Seite arbeitet weiter | Nach Netzrückkehr Link erneut öffnen; lokaler Stand bleibt erhalten, Zusammenführung „jüngster gewinnt“ (im Mock nicht verifiziert, P3-1) |
| Nachbesprechung | Debrief-PDF je Teilnehmer mit Soll/Ist und Zeiten | Papierplan mit Bemerkungen | Aussagekräftig nur bei zeitrichtiger Erfassung (P2-2) |

## Würde ich dafür das Papier weglegen?

**Nein – und das muss ich auch nicht.** Der Generator ersetzt nicht das Papier, sondern die Stunden, die ich sonst am Vorabend Funksprüche ausdenke und Vordrucke von Hand fülle; der Abend selbst läuft mit den Ausdrucken robust weiter. Die digitale Live-Verfolgung ist ein Zusatz, den ich nutze, wenn Netz und Akkus da sind – sobald der Übungsleitungs-PDF zuverlässig geht und Codes auf dem Blatt stehen, ist der Wechsel zwischen beiden Welten sauber.

## Abschluss

- **Aufgabe geschafft:** mit Umwegen (Papierplan der Übungsleitung erst nach einem anderen PDF-Export)
- **Fremde Hilfe nötig:** nein (sofern der Umweg über das Generator-ZIP bekannt ist)
- **Größtes Missverständnis:** Dass die App offen und online bleiben müsse – tatsächlich ist der vollständige Papiersatz da, aber an keiner Stelle als Rückfallebene ausgewiesen.
- **Größtes Einsatzrisiko:** Die Übungsleitung will kurzfristig den Nachrichtenplan drucken und „Übungsleitung als PDF“ liefert in einer frisch geöffneten Ansicht nichts.
- **Top-Priorität für die nächste Iteration:** „Übungsleitung als PDF“ reihenfolgeunabhängig funktionsfähig machen (P1-1) und mit einem E2E-Test als erste Aktion absichern.
