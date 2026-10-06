Befunde: P0=0 P1=0 P2=1 P3=2
Abgleich: behoben=7 teilweise=0 offen=0 nicht-pruefbar=0

# THW-Review „Analog first“: Sprechfunk Übungsgenerator (dritter Lauf)

- **Datum:** 2026-10-06
- **Perspektive:** erfahrener, IT-skeptischer THW-Helfer, der Meldeblock, Vordruck, Whiteboard und Funk bevorzugt (Skill `thw-analog-first-reviewer`)
- **Geprüft gegen:** lokaler Build `http://127.0.0.1:3000`, Mock-Firestore im `localStorage` (`useFirestoreEmulator=1`), Playwright mit Chromium 1194, Zeitzone Europe/Berlin
- **Rollen:** Generator/Übungsleitung (Desktop 1440×1000), Teilnehmer (412×915 und `devices["Pixel 7"]`), Übungsleitungs-Ansicht während und nach der Übung, Admin
- **Belege:** Screenshots, PDFs und ZIPs unter `/tmp/claude-0/-home-user-sprechfunk-uebung/8e81b214-a84b-574f-81cf-240dddbe65b9/scratchpad/analog-first/r3/`
- **Kontext:** Ausbildungswerkzeug für Dienstabende, kein Echteinsatz-System. „Einsatz“ meint hier den Übungsabend.

## Durchgeführter Ablauf

1. **Übung A „Dienstabend Papier“** (Datum 05.10., 3 Teilnehmer, 8 Sprüche, individuelle Lösungswörter, eines davon „EINSATZBESPRECHUNG“, Vorlage `thwleer`). Ich habe das Ergebnis gesichtet (`01-gen-ergebnis.png`) und die ZIP-Datei (`alle.zip`, 35 Dateien, 617 kB) sowie „Alle Übersichten als eine PDF“ (`uebersichten.pdf`) geladen und mit `pdftotext`/`pdftoppm` geprüft (`p-ul-1.png`, `p-ul-2.png`, `p-ueb-1.png`).
2. **Teilnehmer mobil:** Nr. 1 mit Netz abgehakt, Netz getrennt, Nr. 2 abgehakt (`12-tn-offline-abgesetzt.png`). Danach ohne Netz neu geladen (`13-tn-offline-reload.png`) und wieder mit Netz verbunden (`14-tn-wieder-online.png`).
3. **Übungsleitung in frischem Tab:** Die erste Aktion war „Übungsleitung als PDF“ (`ul-erst.pdf`). Danach habe ich die Zeit des Anmeldespruchs von Heros Oldenburg 21/11 auf 19:00 nachgetragen und auf 19:10 geändert (`21-ul-anmeldung-korrigiert.png`). Es folgte ein Sammel-Nachtrag mit 5 weiteren Papierzeiten, dann Neuladen (`23-ul-nach-reload.png`), Übungsleitungs-PDF (`ul.pdf`) und Debrief (`debrief.pdf`). Ohne Netz habe ich neu geladen und das PDF noch einmal erzeugt (`24-ul-offline-reload.png`, `ul-offline.pdf`). Zuletzt habe ich den Generator ohne Netz geöffnet (`25-gen-offline.png`).
4. **Übung B „Papierabend Samstag“:** Generiert mit einer Browser-Uhr am 03.10. um 17:00 (Datum 03.10., 2 Teilnehmer). Die Übungsleitung hat erst drei Tage später (06.10.) in einem eigenen Browser-Kontext mit echter Uhr nachgetragen: 19:00, 19:20, 23:50 und 00:15 (`40-B-nachtrag.png`, `43-B-oben.png`, `ul-B.pdf`, `debrief-B.pdf`).
5. **Reines Teilnehmer-Gerät** (eigener Kontext, Pixel 7, nur der Teilnehmer-Link geöffnet): Ohne Netz habe ich „Alle meine Vordrucke herunterladen (ZIP)“ (`50-tn-geraet-offline-zip.png`, `tn-offline.zip`) und das Neuladen ohne Netz (`51-tn-geraet-offline-reload.png`) geprüft.
6. **Admin-Liste** (`30-admin.png`).

**Nicht prüfbar im Mock:** Ob die echte Firestore-Synchronisation zwischen zwei Geräten nach Netzrückkehr funktioniert, und was bei einem Konflikt passiert. Im Mock teilen sich alle Tabs eines Kontexts denselben `localStorage`.

## Urteil aus Sicht der Rolle

Den Papierweg kann ich jetzt in beide Richtungen ohne Bauchschmerzen gehen. Vor dem Abend druckt die App alles, was auf den Tisch gehört: die Übersicht je Teilnehmer mit Codes, QR-Code, Spalte „Abgesetzt (Uhrzeit)“ und dem Satz, wohin notierte Zeiten gehen; dazu das Übungsleitungs-Blatt mit Soll/Ist, Teilnehmercodes und Zeitspalte sowie ein `LIESMICH.txt`. Nach dem Abend trage ich die Papierzeiten je Zeile nach. Sie landen auch Tage später auf dem Übungstag. Eine korrigierte Zeit des Anmeldespruchs steht danach in der Teilnehmer-Tabelle, im Übungsleitungs-PDF und im Debrief gleich. Am Handy sehe ich je Spruch „Nur auf diesem Gerät“ oder „An die Übungsleitung gesendet“. Das Notfall-ZIP entsteht auch auf einem reinen Teilnehmer-Gerät ohne Netz.

Reibung gibt es nur noch an den Rändern. Eine Papierzeit nach Mitternacht landet auf dem falschen Tag und löst eine rote Warnung „Übung wurde neu verteilt … zurücksetzen“ aus, die nicht stimmt. Wer mitten in der Übung auf Papier wechselt, sieht auf dem Ausdruck nicht, welche Sprüche die Teilnehmer schon am Handy gemeldet hatten. Für die Nachbesprechung auf Papier muss ich das Debrief für jeden Teilnehmer einzeln herunterladen.

Ob ich die Aufgabe „Übung auf Papier durchführen und danach digital nachziehen“ ohne fremde Hilfe schaffe: ja.

## Befunde

### P2-1: Nachgetragene Uhrzeit nach Mitternacht landet am Vormittag des Übungstags und löst einen falschen „neu verteilt“-Alarm aus

1. **Priorität:** P2
2. **Fundstelle / Aufgabe:** `#/uebungsleitung/<id>`, Nachrichtenplan, „Zeit nachtragen“ an einer offenen Zeile. Klassische Übung (kein X-Zeit) vom 03.10., gespielt am Abend über Mitternacht, nachgetragen am 06.10.
3. **Beobachtung:**
   - Die Nachträge 19:00, 19:20 und 23:50 landen richtig auf `031900oct26`, `031920oct26` und `032350oct26`.
   - Der Nachtrag **00:15** landet auf `030015oct26`. Das ist der frühe Morgen *vor* der Übung, nicht der 04.10. (`40-B-nachtrag.png`, Zeile Nr. 7; ebenso im Debrief `debrief-B.pdf` Zeile 4). In der Kennzahl „Sprüche je 5 min“ steht der Spruch dadurch nicht mehr am Ende des Abends.
   - Gleichzeitig erscheint oben in der Lage ein roter Alarm: „⚠ Diese Übung wurde am 03.10. um 17:00 neu verteilt. 1 gesetzte Status gehören zur alten Fassung und passen nicht mehr zu den Texten. Sichere den Stand bei Bedarf als PDF und setze ihn dann zurück. [Zum Zurücksetzen]“ (`43-B-oben.png`). Die Übung wurde nie neu verteilt. Der Hinweis entsteht, weil die nachgetragene Zeit jetzt vor dem Erstellzeitpunkt liegt (`src/uebungsleitung/veraltet.ts`, `zaehleVeralteteStatus`).
   - Ursache aus Nutzersicht: Den Folgetag nimmt die App nur an, wenn eine X-Zeit-Basis gesetzt ist (`src/uebungsleitung/nachtrag.ts`, `vorDerBasis`). In der klassischen Übung gibt es diese Basis nicht. Im Eingabefeld steht nur „Abgesetzt um HH:MM“, ein Datum ist nicht zu sehen.
4. **Erwartung der Rolle:** Wenn wir bis nach Mitternacht funken (Ausbildungswochenende, Nachtübung; Annahme: das kommt vor, ist aber nicht die Regel), gehört 00:15 vom Papier zum Ende dieses Abends. Eine rote Warnung erwarte ich nur, wenn wirklich etwas kaputt ist.
5. **Auswirkung:** Der Spruch steht im Plan und im Debrief am falschen Tag. Schwerer wiegt die Fehlwarnung: Sie fordert ausdrücklich zum Zurücksetzen auf. Folgt die Leitung ihr, wirft sie den ganzen nachgetragenen Papierstand weg. Wer der Warnung nicht folgt, lernt dagegen, rote Hinweise zu übergehen.
6. **Empfehlung:** Liegt eine nachgetragene Uhrzeit am Übungstag *vor* dem Erstellzeitpunkt der Übung oder deutlich vor den übrigen Zeiten des Abends, soll die App den Folgetag annehmen oder nachfragen („00:15 am 04.10.?“). Beim Nachtrag soll das Datum, auf das die Zeit gebucht wird, sichtbar sein. Nachgetragene Zeiten (Kennzeichen „nachgetragen“) dürfen nicht als „alte Fassung“ zählen.
7. **Verifikation:** Klassische Übung vom Tag X, um 17:00 erstellt. Am Tag X+3 trägt die Leitung 23:50 und 00:15 nach. Plan und Debrief zeigen X 23:50 und X+1 00:15, ein „neu verteilt“-Hinweis erscheint nicht.

### P3-1: Übungsleitungs-PDF mitten in der Übung zeigt nicht, was die Teilnehmer schon gemeldet haben

1. **Priorität:** P3
2. **Fundstelle / Aufgabe:** „📄 Übungsleitung als PDF“ während der laufenden Übung, um bei einem Geräteproblem auf Papier weiterzumachen. `Uebungsleitung.pdf` Seite 2 ff., Spalte „Abgesetzt (Uhrzeit)“.
3. **Beobachtung:** Heros Oldenburg 22/12 hat am Handy Nr. 1 (Anmeldung) und Nr. 2 abgehakt. Am Bildschirm der Leitung stehen beide als „GEMELDET (TN) · Teilnehmer: 060823oct26“, die Lage zeigt „2 zu bestätigen“. Im PDF stehen die zugehörigen Planzeilen 2 und 5 leer (`p-ul-2.png`). Auf Seite 1 desselben PDFs steht die Anmeldung von 22/12 dagegen schon mit `060823oct26` (`p-ul-1.png`). Das Blatt widerspricht sich also: Laut Seite 1 ist der Teilnehmer angemeldet, laut Seite 2 ist sein Anmeldespruch offen.
4. **Erwartung der Rolle:** Wenn ich mitten in der Übung auf Papier wechsle, soll mir der Ausdruck den Stand zeigen, den ich am Bildschirm hatte, auch „vom Teilnehmer gemeldet, noch nicht bestätigt“.
5. **Auswirkung:** Gering. Auf Papier sehe ich diese Sprüche als offen und frage sie per Funk ab oder lasse sie doppelt absetzen. Nach dem Nachtrag stehen dann zwei Zeiten für denselben Spruch nebeneinander.
6. **Empfehlung:** Im PDF gemeldete, unbestätigte Sprüche kennzeichnen, z. B. „TN 08:23 (gemeldet)“ in der Zeitspalte, damit die Leitung nur noch abhaken muss.
7. **Verifikation:** Ein Teilnehmer hakt zwei Sprüche am Handy ab, die Leitung druckt sofort. Beide Zeilen tragen im PDF die Meldezeit mit dem Zusatz „gemeldet“, und Seite 1 und Seite 2 widersprechen sich nicht.

### P3-2: Debrief für die Nachbesprechung auf Papier nur einzeln je Teilnehmer

1. **Priorität:** P3
2. **Fundstelle / Aufgabe:** `#/uebungsleitung/<id>`, Teilnehmer-Tabelle, Spalte „Nachbesprechung“, Knopf „Debrief (PDF)“ je Zeile (`24-ul-offline-reload.png`, `src/uebungsleitung/teilnehmerMarkup.ts:346-362`).
3. **Beobachtung:** Für die Unterlagen *vor* der Übung gibt es Sammel-Downloads (ZIP, „Alle Übersichten als eine PDF“, „Alle Teilnehmer-Übersichten als PDF“). Für die Nachbesprechung gibt es nur je Teilnehmer einen Knopf. Bei 3 Teilnehmern sind das 3 Downloads und 3 Druckaufträge, bei 10 Teilnehmern entsprechend 10.
4. **Erwartung der Rolle:** Nach der Übung lege ich jedem seinen Bogen hin, und das soll ein einziger Druckauftrag sein, wie beim Ausdruck vorher.
5. **Auswirkung:** Gering, kostet am Ende des Abends ein paar Minuten am Rechner, während die Helfer warten.
6. **Empfehlung:** Einen Knopf „Alle Debriefs als eine PDF“ neben „Übungsleitung als PDF“ anbieten, in der Reihenfolge der Teilnehmerverwaltung.
7. **Verifikation:** Ein Klick liefert eine PDF mit einem Debrief je Teilnehmer, jeder auf eigener Seite.

## Positiv festgehalten (kein Befund)

- **Korrektur zieht überall durch:** Ich habe den Anmeldespruch auf 19:00 nachgetragen und auf 19:10 geändert. Teilnehmer-Tabelle („angemeldet 051910oct26 · über Anmelde-Funkspruch“), `ul.pdf` Seite 1 und 2 und `debrief.pdf` zeigen alle `051910oct26`.
- **Späterer Nachtrag landet auf dem Übungstag:** Ich habe am 06.10. für eine Übung vom 05.10. bzw. 03.10. nachgetragen, und alle Abendzeiten stehen richtig auf `05…` bzw. `03…`. Sie sind als „nachgetragen“ gekennzeichnet und bleiben nach dem Neuladen erhalten. Das Tempo bleibt „–“.
- **Zustellstand je Spruch am Handy:** Offline abgehakt steht „⚠ Nur auf diesem Gerät – wird gesendet, sobald Netz da ist“ (gelb). Das übersteht auch das Neuladen ohne Netz (`13-tn-offline-reload.png`). Nach Netzrückkehr steht „An die Übungsleitung gesendet“ (`14-tn-wieder-online.png`).
- **Notfall-ZIP auf reinem Teilnehmer-Gerät ohne Netz:** Der Download kommt (`tn-offline.zip`).
- **Hinweis im Generator stimmt jetzt:** „Ohne Netz öffnet sich diese Seite nur auf einem Gerät, das sie vorher schon einmal mit Netz geladen hat, und auch dann nicht in jedem Fall mit allen Übungsdaten. Die Ausdrucke sind die sichere Rückfallebene.“ Das passt zum beobachteten Verhalten: Generator, Teilnehmer und Leitung laden ohne Netz neu, die Leitung erzeugt ohne Netz ihr PDF (`ul-offline.pdf`).
- **Weg der Papierzeiten erklärt:** Die Übersicht trägt den Satz „Notierte Uhrzeiten gibst du nach der Übung der Übungsleitung; sie trägt sie in der App nach.“ An „N gemeldete bestätigen (mit Meldezeit des Teilnehmers)“ steht: „Die Sammelbestätigung übernimmt seine Tippzeit, nicht die Zeit vom Papier.“
- **Lösungswort im PDF ungebrochen:** „EINSATZBESPRECHUNG“ steht in einer Zeile, und die Spalte „Lösungswort Ist“ ist genauso breit (`p-ul-1.png`).
- **Offline-Hinweis bei der Leitung:** „Keine Verbindung – angezeigt wird der zuletzt bekannte Stand der Teilnehmer. Deine Markierungen bleiben auf diesem Gerät und werden nachgereicht“ (`24-ul-offline-reload.png`).

## Analog-/Digital-Übergabematrix

| Prozessschritt | Digitaler Nutzen | Analoger Fallback | Sauberer Wiedereinstieg in Digital |
|---|---|---|---|
| Funksprüche verteilen, Vordrucke erstellen | Faire Verteilung, Lösungswörter, Stärken, vorausgefüllte Vordrucke in Sekunden | ZIP (617 kB) mit `LIESMICH.txt`, vor dem Abend gedruckt; Notfall-ZIP auch am Teilnehmer-Handy ohne Netz | Codes und QR auf Übersicht und Übungsleitungs-PDF; Übung über Admin oder die Liste „Zuletzt in diesem Browser erstellt“ wieder abrufbar |
| Teilnehmer: Spruch absetzen | Live-Fortschritt für die Leitung, Fokus auf den nächsten Spruch | Übersicht mit Spalte „Abgesetzt (Uhrzeit)“ | Notierte Zeiten gehen an die Leitung (steht auf dem Blatt); am Handy je Spruch sichtbar, ob er schon gesendet ist |
| Übungsleitung: Anmeldung, Lösungswort, Stärke | Soll/Ist-Vergleich automatisch, Debrief je Teilnehmer | `Uebungsleitung.pdf` S. 1 mit Ist-Feldern, Codes, Bemerkungen | Eingabefelder vorhanden; Anmeldezeit folgt der Korrektur des Anmeldespruchs |
| Übungsleitung: Nachrichtenplan führen | Tempo, ETA, Funklast, Heatmap | `Uebungsleitung.pdf` ab S. 2 mit Zeitspalte; Wechsel mitten in der Übung zeigt TN-Meldungen nicht (P3-1) | „Zeit nachtragen“ je Zeile, auf den Übungstag gebucht; nach Mitternacht falscher Tag und Fehlalarm (P2-1) |
| Gerät/Tab weg, kein Netz | – | Ausdruck; nach dem ersten Besuch lädt jede Rolle ohne Netz neu | Lokaler Stand bleibt, Sync-Hinweise bei Leitung und Teilnehmer, je Spruch „Nur auf diesem Gerät“ |
| Nachbesprechung | Debrief-PDF mit TN- und Leitungszeit getrennt, „(nachgetragen)“ gekennzeichnet | Papierplan mit Bemerkungen | Stimmig; Ausdruck nur einzeln je Teilnehmer (P3-2) |

## Würde ich dafür das Papier weglegen?

**Nein, aber ich muss mich auch nicht mehr zwischen Papier und App entscheiden.** Die App druckt mir vorher genau das Papier, mit dem ich ohne Netz weiterarbeiten kann, und nimmt die Papierstände hinterher sauber und gekennzeichnet zurück. Nur bei Übungen über Mitternacht muss ich die nachgetragenen Zeiten gegenlesen.

## Abschluss

- **Aufgabe geschafft:** ja
- **Fremde Hilfe nötig:** nein
- **Größtes Missverständnis:** Nach einem Nachtrag über Mitternacht behauptet die App, die Übung sei „neu verteilt“ worden, obwohl nur eine Uhrzeit auf den falschen Tag gerutscht ist.
- **Größtes Einsatzrisiko:** Die Leitung folgt dieser Fehlwarnung, klickt „Zum Zurücksetzen“ und wirft den gesamten nachgetragenen Papierstand weg.
- **Top-Priorität für die nächste Iteration:** Nachgetragene Uhrzeiten nach Mitternacht dem Folgetag zuordnen (oder das Datum beim Nachtrag zeigen) und nachgetragene Zeiten aus der „neu verteilt“-Prüfung herausnehmen (P2-1).

## Abgleich mit dem Lauf vom 2026-10-05

| Alte ID | Titel | Alte Priorität | Status jetzt | Beleg aus diesem Lauf |
|---|---|---|---|---|
| P2-1 | Korrigierte Zeit des Anmeldespruchs ändert die Anmeldezeit nicht; Ausdrucke widersprechen sich | P2 | behoben | Anmeldespruch nachgetragen 19:00, geändert auf 19:10: Teilnehmer-Tabelle „angemeldet 051910oct26 · über Anmelde-Funkspruch“ (`21-ul-anmeldung-korrigiert.png`), `ul.pdf` S. 1 Anmeldung und S. 2 Nr. 1 `051910oct26`, `debrief.pdf` Anmeldung `051910oct26`. Gleiches Bild in Übung B (`ul-B.pdf`, `debrief-B.pdf`: `031900oct26`). |
| P2-2 | Späterer Sammel-Nachtrag landet auf dem falschen Datum | P2 | behoben | Übung vom 05.10. am 06.10. nachgetragen: alle Zeilen `05…`. Übung vom 03.10. am 06.10.: 19:00/19:20/23:50 auf `03…` (`40-B-nachtrag.png`). Nur der Sonderfall über Mitternacht ist falsch, als neuer Befund P2-1 erfasst. |
| P3-1 | Uhrzeiten der Teilnehmer vom Papier haben keinen Weg zurück in die App | P3 | behoben | Übersicht: „Notierte Uhrzeiten gibst du nach der Übung der Übungsleitung; sie trägt sie in der App nach.“ (`uebersichten.pdf`). Leitung: „2 gemeldete bestätigen (mit Meldezeit des Teilnehmers)“ und der Hinweis „… übernimmt seine Tippzeit, nicht die Zeit vom Papier.“ (`24-ul-offline-reload.png`). |
| P3-2 | „Unterlagen für den Notfall“ auf reinem Teilnehmer-Gerät offline nicht erzeugbar | P3 | behoben | Eigener Kontext (Pixel 7), nur Teilnehmer-Link geöffnet, Netz getrennt: Download `Heros Oldenburg 24-14_Dienstabend Papier.zip` kommt (`tn-offline.zip`, `50-tn-geraet-offline-zip.png`). |
| P3-3 | Generator-Hinweis „Ohne Netz lässt sich diese Seite nicht neu laden“ stimmt nicht mehr | P3 | behoben | Neuer Text „Ohne Netz öffnet sich diese Seite nur auf einem Gerät, das sie vorher schon einmal mit Netz geladen hat …“ (`01-gen-ergebnis.png`). Er passt zum beobachteten Offline-Neuladen (`25-gen-offline.png`, `24-ul-offline-reload.png`, `13-tn-offline-reload.png`). |
| P3-4 | Am Handy nicht erkennbar, welche Markierung noch nicht bei der Leitung ist | P3 | behoben | Offline abgehakte Nr. 2 trägt „⚠ Nur auf diesem Gerät – wird gesendet, sobald Netz da ist“, Nr. 1 „An die Übungsleitung gesendet“ (`12-…`, `13-tn-offline-reload.png`). Nach Netzrückkehr tragen beide „An die Übungsleitung gesendet“ (`14-tn-wieder-online.png`). Gegen echten Firestore nicht geprüft (Mock). |
| P3-5 | Soll-Lösungswort im Übungsleitungs-PDF mitten im Wort umbrochen | P3 | behoben | „EINSATZBESPRECHUNG“ steht in einer Zeile, „Lösungswort Ist“ ist gleich breit (`p-ul-1.png`). |
