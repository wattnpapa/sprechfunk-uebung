Befunde: P0=0 P1=0 P2=1 P3=3
Abgleich: behoben=6 teilweise=0 offen=0 nicht-pruefbar=0

# THW-Review: Fehlerbehebung und Wiederaufnahme (error-recovery), dritter Lauf

Datum: 2026-10-06. Perspektive: ein beschäftigter Helfer, der normale Bedienfehler macht und danach ohne Admin weiterarbeiten will.

## Methode

Geprüft wurde live gegen `http://127.0.0.1:3000` im Mock-Modus (localStorage-Firestore), mit Playwright und Chromium 1194.

Geräte und Rollen:
- Generator, Übungsleitung und Admin am Desktop (1440×1000).
- Teilnehmer auf dem Smartphone (Pixel 7).

Diese Fehler habe ich absichtlich provoziert:
- im Generator: alles leer abschicken, Dubletten in anderer Schreibweise, 9999 / -5 Sprüche, 150 %, keine Vorlage, Doppelklick auf „generieren“
- Neuladen mitten in der Eingabe und nach dem Generieren
- Änderungen nach dem Generieren, „Als neue Übung“ und „Überschreiben“
- beim Teilnehmer: Zahlendreher und falsche Länge im Code, Kleinschreibung im Code, Doppeltipp auf „abgesetzt“, sofortiges „Rückgängig“, falsche Zeile antippen und dann neu laden, Browser-Zurück im Vordruck
- bei der Übungsleitung: Link ohne ID oder mit falscher ID, falsche Anmeldung und deren Rücknahme, eine neue Aktion bei noch offener Rückgängig-Leiste, Doppelklick, Uhrzeit-Zahlendreher in die Zukunft, X-Zeit-Basis in der Zukunft
- im Admin: Löschen abbrechen, Löschen und „Rückgängig“, Löschen und sofort neu laden

Die Screenshots liegen unter `/tmp/claude-0/-home-user-sprechfunk-uebung/8e81b214-a84b-574f-81cf-240dddbe65b9/scratchpad/error-recovery/`. Im Ordner liegen auch Bilder älterer Läufe. Maßgeblich sind die Dateien, die bei den Befunden genannt sind.

Zum Kontext: Die App ist ein Ausbildungswerkzeug für Dienstabend und Ausbildung, kein Echteinsatz-System. „Einsatzkritisch“ bedeutet hier: Die Übung kann nicht sauber weiterlaufen, oder die Übungsleitung bewertet auf falscher Grundlage.

## Urteil

Die Fehlerkorrektur ist inzwischen robust. Alle Aufgaben ließen sich ohne fremde Hilfe erledigen. Keine Sackgasse ließ sich nur mit Admin-Hilfe oder durch Verwerfen des Übungsstands auflösen. Alle sechs Befunde des Vorlaufs sind behoben, und ich habe das jeweils selbst nachgeprüft.

**Was trägt:**
- **Generator:** Fehler stehen direkt am Feld, mit konkretem Text und Fokus auf dem ersten Fehler. Es stapeln sich keine Toasts mehr (`g01-leer.png`, `g02-dup-9999.png`, `g03-neg-150.png`).
- **Entwurf:** Ein Neuladen vor dem Generieren stellt den Entwurf mit Hinweis wieder her (`g04-reload-entwurf.png`).
- **Doppelklick:** Er erzeugt genau eine Übung.
- **„Als neue Übung“:** Die neue Übung heißt „… (2)“. Der Admin zeigt den Übungscode als Spalte (`a05-duplikat.png`).
- **Löschen im Admin:** Es hat jetzt 8 s „Rückgängig“ (`a02-geloescht.png`, `a03-rueckgaengig.png`).
- **Teilnehmer:**
  - „Rückgängig“ wirkt auch sofort nach dem Tipp (`t06-schnell-rueckgaengig.png`).
  - Ein falscher Tipp lässt sich nach dem Neuladen per „Zurücknehmen“ korrigieren (`t07-reload-nach-falschtipp.png`).
  - Im Vordruck gibt es eine eigene Rückgängig-Zeile, und Browser-Zurück schließt nur den Vordruck (`t11-vordruck-abgesetzt.png`).
- **Übungsleitung:**
  - Ein Link ohne ID und ein Link mit falscher ID führen beide zu einer klaren Fehlerseite mit Weiter-Wegen (`u01-ohne-id.png`, `u02-falsche-id.png`).
  - Die Rückgängig-Leiste verschwindet bei der nächsten Aktion (`u04-undo-nach-neuer-aktion.png`).

**Wo Reibung bleibt:**
- Eine vertippte Uhrzeit, die in der Zukunft liegt, wird ohne Rückmeldung auf den Vortag gelegt.
- Kleinere Punkte betreffen Hinweise, die stehen bleiben, und Eingaben, die beim Neuladen verloren gehen.

## Befunde

### P2-1 Übungsleitung: Eine Uhrzeit-Korrektur mit Zahlendreher in die Zukunft landet ohne Rückmeldung auf dem Vortag
- **Fundstelle / Aufgabe:** `#/uebungsleitung/<id>`, Nachrichtenplan. Eine Nachricht wird als abgesetzt markiert, dann „Zeit ändern“ gewählt. Statt der echten Zeit 06:25 wird versehentlich 06:53 eingetippt (Zahlendreher, 27 min in der Zukunft).
- **Beobachtung:**
  - Die Eingabe wird ohne Meldung übernommen.
  - In der Statusspalte steht „Leitung 06:53 · nachgetragen“. Das sieht plausibel aus.
  - Gespeichert ist aber **05.10.** 06:53, also der Vortag. Die Zeit-Spalte zeigt dazu „050653oct26“, die Teilnehmerzeile „zuletzt 050653oct26“ und als Anmeldezeit „050653oct26 über Anmelde-Funkspruch“ (`u07-zukunftszeit.png`).
  - Mit 23:59 passiert dasselbe: Am Übungstag 06.10. entsteht 052359oct26 (`u05-zeit.png`).
  - Das Zeitfeld hat kein `max`.
  - Ursache ist die Regel „Liegt das Ergebnis in der Zukunft, ist der Vortag gemeint“ in `src/uebungsleitung/nachtrag.ts:76-78`. Sie ist für Nachträge über Mitternacht gedacht, fängt aber auch jeden Tippfehler nach oben still ab.
- **Erwartung der Rolle:** „Diese Uhrzeit liegt in der Zukunft – meinst du gestern 06:53 oder hast du dich vertippt?“ Mindestens soll erkennbar sein, dass ein anderes Datum gespeichert wurde.
- **Auswirkung im Einsatz:**
  - Die Leitung glaubt, die Zeit korrigiert zu haben.
  - Die Nachricht steht nun einen Tag vor Übungsbeginn. Das verfälscht Reihenfolge, „zuletzt“-Anzeige, Anmeldezeit und die Auswertung je 5 Minuten. Die Heatmap führt dazu einen Slot „06:50“, der zum Vortag gehört.
  - Der Fehler fällt erst in der Nachbesprechung auf, wenn überhaupt.
  - Er lässt sich über „Zeit ändern“ korrigieren, aber nur, wenn man die DTG-Zeichenfolge liest.
- **Empfehlung:**
  - Liegt eine Eingabe am Übungstag in der Zukunft, nachfragen statt still verschieben. Ausnahme: Die Übung läuft erkennbar über Mitternacht.
  - Ein vom Übungstag abweichendes Datum in der Statusspalte im Klartext zeigen, etwa „05.10. 06:53“.
- **Verifikation:** Während einer laufenden Übung eine Uhrzeit 20 min in der Zukunft eintragen. Es erscheint eine Rückfrage oder ein Fehler, und es wird nicht still ein Vortagsdatum gespeichert.

### P3-1 Generator: Der Fehlerkasten am Knopf bleibt nach der Korrektur stehen
- **Fundstelle / Aufgabe:** `#/generator`. Ohne Vorlage auf „Übung generieren“ klicken, danach eine Vorlage wählen.
- **Beobachtung:** Die rote Feldmarkierung an der Vorlagenauswahl verschwindet sofort. Der rote Kasten unter dem Knopf meldet aber weiter „Bitte mindestens eine Funkspruch-Vorlage auswählen.“, bis erneut geklickt wird (`g11-fehlerkasten-nach-korrektur.png`).
- **Erwartung der Rolle:** Ist das Feld korrigiert, verschwindet auch die Meldung am Knopf, oder sie ist erkennbar als „vom letzten Versuch“ gekennzeichnet.
- **Auswirkung im Einsatz:** Der Helfer sucht kurz nach einem Fehler, den er schon behoben hat. Ein Klick löst das auf. Das ist reine Zeitfrage, ein Risiko für Daten besteht nicht.
- **Empfehlung:** Den Kasten bei jeder Feldkorrektur aus dem aktuellen Fehlerstand neu aufbauen oder ausblenden.
- **Verifikation:** Ohne Vorlage generieren, dann eine Vorlage wählen. Der Kasten ist danach leer oder ausgeblendet.

### P3-2 Generator: Änderungen an einer schon generierten Übung gehen beim Neuladen ohne Hinweis verloren
- **Fundstelle / Aufgabe:** `#/generator/<id>` nach dem Generieren. Ein Teilnehmername wird geändert („23/13“ → „32/13“), und die Seite zeigt korrekt „Eingaben geändert …“ (`g07-geaendert.png`). Danach wird neu geladen, zum Beispiel durch eine versehentliche Wischgeste.
- **Beobachtung:**
  - Nach dem Neuladen steht wieder „Heros Oldenburg 23/13“ im Feld.
  - Weder der Hinweis „Eingaben geändert“ noch ein Entwurfshinweis ist sichtbar (`g08-reload-nach-aenderung.png`).
  - Die Änderung ist ohne Spur weg. Das ist so gewollt: Der Entwurf gilt nur, solange die Übung noch nicht gespeichert ist (`src/generator/GeneratorEntwurf.ts:8-10`).
- **Erwartung der Rolle:** Wie vor dem Generieren soll gelten: „Deine ungespeicherten Änderungen wurden wiederhergestellt“. Alternativ eine Warnung beim Verlassen, solange „Eingaben geändert“ aktiv ist.
- **Auswirkung im Einsatz:** Wer kurz vor dem Dienstabend Namen oder Mengen korrigiert und dann neu lädt, verteilt womöglich Ausdrucke vom alten Stand. Er glaubt, die Änderung sei drin. Die gespeicherte Übung selbst bleibt intakt.
- **Empfehlung:** Ungespeicherte Änderungen an einer bestehenden Übung ebenfalls als Entwurf je Übungs-ID halten und nach dem Neuladen mit „verwerfen“ anbieten. Mindestens beim Verlassen warnen.
- **Verifikation:** Nach dem Generieren einen Namen ändern und neu laden. Die Änderung ist wieder da, oder es erscheint ein Hinweis, dass sie verworfen wurde.

### P3-3 Admin: Neuladen oder Verlassen innerhalb der 8 s führt die Löschung sofort und ohne Hinweis aus
- **Fundstelle / Aufgabe:** `#/admin`. Eine Übung wird gelöscht. Die Rückfrage verspricht: „Nach dem Bestätigen kannst du 8 Sekunden lang ‚Rückgängig‘ wählen.“ Gleich danach wird die Seite neu geladen, etwa weil der Helfer unsicher ist oder die Liste „hängt“.
- **Beobachtung:** Nach dem Neuladen ist die Übung endgültig gelöscht, und die Liste ist leer (`a04-reload-nach-loeschen.png`). Das ist so gebaut: `pagehide` und `hashchange` schließen die Löschung sofort ab (`src/admin/index.ts:43-48`). Weder die Rückfrage noch der Hinweis „wird in 8 Sekunden gelöscht“ sagt das.
- **Erwartung der Rolle:** Wer die Seite verlässt, bevor die Frist um ist, verliert entweder nur die Rücknahme-Möglichkeit und weiß das, oder die Löschung entfällt.
- **Auswirkung im Einsatz:** Das passiert selten, weil „Rückgängig“ gut sichtbar daneben steht. Wer die Löschung aber durch Wegnavigieren „abbrechen“ will, erreicht das Gegenteil.
- **Empfehlung:** Im Hinweis ergänzen: „Verlässt du die Seite, wird sofort gelöscht.“ Alternativ beim Verlassen während der Frist kurz nachfragen.
- **Verifikation:** Löschen bestätigen und innerhalb der 8 s neu laden. Entweder sagte der Hinweis das vorher, oder die Übung ist noch da.

## Positiv beobachtet (nicht ändern)

**Generator**
- **Pflichtfelder und Zahlen:**
  - Leitung, Vorlage und Teilnehmer werden einzeln am Feld erklärt, die Leitung bekommt den Fokus.
  - Bei 9999 kommt „Höchstens 200 …“, bei -5 „ganze Zahl ab 1“, bei 150 % „Wert von 0 bis 100“.
  - Dubletten in anderer Schreibweise werden in beiden Zeilen mit Verweis auf die Gegenzeile markiert.
- **Toasts:** In drei Fehlversuchen in Folge erschien kein einziger Toast. Sichtbar sind nur der Fehlerkasten und die Feldmarkierungen.
- **Neuladen vor dem Generieren:** Name, Leitung, drei Teilnehmer und 12 Sprüche kommen wieder, dazu „Entwurf verwerfen“.
- **Nach dem Generieren:** `#/generator/<id>` steht in der Adresse, und das Ergebnis übersteht ein Neuladen. Ein Doppelklick auf „generieren“ ergibt genau eine Übung im Speicher.
- **„Überschreiben …“** zählt die Folgen konkret auf. „Als neue Übung“ hängt „(2)“ an den Namen an.

**Teilnehmer und Schnellzugang**
- **Schnellzugang:** Eine falsche Länge meldet sich sofort am Feld: „Der Übungscode hat 6 Zeichen, eingegeben sind 5.“
- **Code-Formular:** Bei falscher Länge kommt „Codeformat ungültig …“. Codes in Kleinschreibung funktionieren. Bei einem Zahlendreher erscheint „Prüfe beide Codes – schau bei Q, D, G, J und 6 genau hin“ zusammen mit dem Formular (`t02-zahlendreher.png`, `t04-join-kurz.png`).
- **Teilnehmeransicht:** Ein Doppeltipp markiert genau einmal. „Rückgängig“ wirkt sofort, „Zurücknehmen“ auch nach dem Neuladen. Im Vordruck sitzt die Rückgängig-Zeile über der Knopfleiste, und „Als abgesetzt markieren“ wird nach dem Tipp zu „✓ abgesetzt 06:29“, kann also nicht doppelt ausgelöst werden.

**Übungsleitung und Admin**
- **Übungsleitung:**
  - Die Anmeldung lässt sich einzeln zurücknehmen, mit Rückgängig-Leiste.
  - Ein Doppelklick auf „abgesetzt“ wirkt genau einmal.
  - Eine X-Zeit-Basis in der Zukunft wird als „vor X“ angezeigt, ein Zahlendreher dort ist also sichtbar (`u08-basis-zukunft.png`).
  - Der globale Reset liegt im Gefahrenbereich und nennt die Wirkung.
- **Admin:**
  - Die Löschrückfrage nennt Name, Datum, Teilnehmerzahl und Code.
  - Bei Abbruch bleibt alles unverändert.
  - „Rückgängig“ holt die Zeile vollständig zurück.

## Abschluss

- **Aufgabe geschafft:** ja
- **Fremde Hilfe nötig:** nein
- **Größtes Missverständnis:** Eine vertippte, zu späte Uhrzeit sieht in der Statusspalte korrekt aus („06:53 · nachgetragen“), ist aber auf den Vortag gebucht.
- **Größtes Einsatzrisiko:** Durch still auf den Vortag verschobene Zeiten bewertet die Nachbesprechung Reihenfolge und Tempo auf falscher Grundlage.
- **Top-Priorität für die nächste Iteration:** Uhrzeiten in der Zukunft beim „Zeit ändern“ nicht still auf den Vortag legen, sondern nachfragen und ein abweichendes Datum im Klartext zeigen.

## Abgleich mit dem Lauf vom 2026-10-05

| Alte ID | Titel (gekürzt) | Alte Prio | Status jetzt | Beleg aus dieser Prüfung |
|---|---|---|---|---|
| P2-1 | Fehler-Toasts im Generator stapeln sich und bleiben stehen | P2 | behoben | Drei Fehlversuche nacheinander (alles leer; Dublette + 9999; -5 + 150 %) erzeugen keinen Toast. Sichtbar sind nur der Fehlerkasten mit dem aktuellen Stand und die Feldmarkierungen (`g01-leer.png`, `g02-dup-9999.png`, `g03-neg-150.png`). Ein Rest ist neu P3-1: Der Kasten bleibt bis zum nächsten Klick stehen. |
| P2-2 | Gleichnamige Übungen nach „Als neue Übung“, Löschen endgültig | P2 | behoben | Die neue Übung heißt „Dienstabend Fehler (2)“, und die Admin-Liste zeigt die Codes MVSDHS und W8ZRDN (`a05-duplikat.png`). Nach dem Löschen steht „… wird in 8 Sekunden gelöscht. Rückgängig“, und die Rücknahme stellt die Zeile wieder her (`a02-geloescht.png`, `a03-rueckgaengig.png`). Ein Randfall ist neu P3-3. |
| P3-1 | Sehr schnelles „Rückgängig“ beim Teilnehmer wird ignoriert | P3 | behoben | Doppeltipp auf „Als abgesetzt markieren“ und etwa 0,3 s danach „Rückgängig“: Nr. 1 steht wieder auf OFFEN (`t06-schnell-rueckgaengig.png`, `t07-…`). |
| P3-2 | Rückgängig-Leiste der Übungsleitung bezieht sich nach einer neuen Aktion auf die alte | P3 | behoben | Leiste nach „Anmeldung zurücknehmen“ geöffnet, dann eine andere Nachricht abgehakt: Die Leiste ist sofort weg (`isVisible=false`, `u04-undo-nach-neuer-aktion.png`). |
| P3-3 | Schnellzugang mit falscher Codelänge ohne Hinweis | P3 | behoben | 5 bzw. 3 Zeichen im Schnellzugang führen direkt zu „Der Übungscode hat 6 Zeichen, eingegeben sind 5.“ / „Der Teilnehmercode hat 4 Zeichen, eingegeben sind 3.“, die Seite bleibt auf `#/generator` (`g10-quickjoin.png`). |
| P3-4 | `#/uebungsleitung/` ohne ID zeigt leeres Gerüst | P3 | behoben | Es erscheint „Im Link fehlt die Übungs-ID. … Gespeicherte Übungen öffnen / Neue Übung erstellen“ (`u01-ohne-id.png`). |
