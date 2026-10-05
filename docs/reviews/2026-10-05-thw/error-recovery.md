Befunde: P0=0 P1=0 P2=2 P3=4
Abgleich: behoben=9 teilweise=2 offen=0 nicht-pruefbar=0

# THW-Review: Fehlerbehebung und Wiederaufnahme (error-recovery), zweiter Lauf

Datum: 2026-10-05. Perspektive: ein beschäftigter Helfer, der normale Bedienfehler macht und ohne Admin weiterarbeiten will.

Methode: Live-Durchlauf gegen `http://127.0.0.1:3000` im Mock-Modus (localStorage-Firestore) mit Playwright und Chromium 1194.
- Generator, Übungsleitung und Admin am Desktop (1440×1000), Teilnehmer auf dem Smartphone (Pixel 7).
- Absichtlich provozierte Fehler: leere Pflichtfelder, keine Vorlage, Dubletten in anderer Schreibweise, unsinnige Zahlen (-5, 0, leer, 9999, -20 %, 150 %), Doppelklick, Neuladen vor und nach dem Generieren, falsche IDs und Codes, Zahlendreher, falsche Zeile angetippt, schnelles „Rückgängig“, Änderung nach dem Generieren, Überschreiben und Neuanlage, Löschen.

Screenshots liegen unter `/tmp/claude-0/-home-user-sprechfunk-uebung/8e81b214-a84b-574f-81cf-240dddbe65b9/scratchpad/error-recovery2/`. Die Dateinamen stehen bei den Befunden.

Kontext: Die App ist ein Ausbildungswerkzeug für Dienstabend und Ausbildung, kein Echteinsatz-System. „Einsatzkritisch“ heißt hier, dass die Übung nicht ordentlich weiterlaufen kann oder die Übungsleitung falsch bewertet.

## Urteil

Seit dem ersten Lauf ist die Fehlerkorrektur deutlich robuster geworden. Ich habe keinen Fehler gefunden, der sich nur mit Admin-Hilfe oder durch Löschen des gesamten Übungsstands beheben lässt.

Was jetzt funktioniert:
- **Generator:** Fehlende und falsche Eingaben werden am Feld markiert und mit konkretem Text erklärt. Das erste fehlerhafte Feld bekommt den Fokus, die Meldung bleibt stehen.
- **Unsinnige Werte:** 9999 Sprüche oder 150 % werden vor dem Start abgefangen.
- **Eingaben bleiben erhalten:** Ein halb ausgefülltes Formular übersteht ein Neuladen als Entwurf. Nach dem Generieren steht die Übungs-ID in der Adresse.
- **Neu generieren:** Das legt standardmäßig eine neue Übung an. Das Überschreiben der alten Übung ist ein eigener Knopf mit einer ausführlichen Rückfrage.
- **Übungsleitung:** Eine falsche Anmeldung lässt sich einzeln zurücknehmen.
- **Teilnehmer:** Eine versehentlich als abgesetzt markierte Nachricht lässt sich auch bei ausgeblendeten Abgesetzten per „Rückgängig“ zurückholen. Fehlerseiten bieten das Code-Formular direkt an.

Reibung bleibt an kleineren Stellen:
- **Generator:** Fehler-Toasts stapeln sich und bleiben auch nach der Korrektur stehen.
- **Admin:** Zwei gleichnamige Übungen sind in der Liste kaum zu unterscheiden, und Löschen bleibt endgültig.
- **„Rückgängig“:** Es reagiert in zwei Fällen anders, als man im Moment erwartet.

**Ergebnis:** Alle geprüften Aufgaben lassen sich ohne fremde Hilfe erledigen.

## Befunde

### P2-1 Fehler-Toasts im Generator stapeln sich, bleiben nach der Korrektur stehen und verdecken das Formular
- **Fundstelle / Aufgabe:** `#/generator`. Der Helfer klickt mehrmals auf „Übung generieren“ und korrigiert zwischendurch einzelne Fehler.
- **Beobachtung:**
  - Jeder Klick erzeugt unten einen weiteren roten Toast. Die Toasts verschwinden nicht von selbst, weil Fehler-Toasts bewusst nicht mehr ausgeblendet werden (`src/core/UiFeedback.ts:58-74`).
  - Nach sechs Versuchen lagen sechs Toasts übereinander und verdeckten etwa die untere Hälfte des Bildschirms mit Spiel-Modus, Quelle und Vorlagenauswahl (`g04-9999.png`).
  - Auch längst behobene Fehler blieben sichtbar, zum Beispiel „Teilnehmernamen müssen eindeutig sein.“ und „Bitte mindestens eine Funkspruch-Vorlage auswählen.“, nachdem beides korrigiert war.
  - Die eigentliche, aktuelle Fehlerliste steht ein zweites Mal im Kasten `#generatorFehler` neben dem Knopf. Dazu kommen die Feldmarkierungen.
- **Erwartung der Rolle:** Sichtbar ist nur der aktuelle Fehlerstand. Ein neuer Versuch ersetzt die alte Meldung, statt eine weitere danebenzulegen.
- **Auswirkung:** Wer mehrfach probiert, sieht widersprüchliche Altmeldungen und muss jeden Toast einzeln wegklicken, um an die verdeckten Felder zu kommen. Er sucht dann nach Fehlern, die er schon behoben hat. Das kostet Zeit beim Vorbereiten, gefährdet aber keine Daten.
- **Empfehlung:** Beim nächsten Generierungsversuch alte Fehler-Toasts ersetzen oder schließen. Alternativ für Formularfehler gar keinen Toast zeigen, weil der Fehlerkasten am Knopf und die Feldmarkierungen schon da sind. Toasts nie über aktive Eingabefelder legen.
- **Verifikation:** Dreimal mit unterschiedlichen Fehlern generieren. Danach ist höchstens eine Meldung sichtbar, und sie nennt nur die aktuell bestehenden Fehler.

### P2-2 „Als neue Übung generieren“ erzeugt Übungen mit gleichem Namen, die im Admin nur am Zeitstempel unterscheidbar sind, und Löschen ist endgültig
- **Fundstelle / Aufgabe:** Generator, Knopf „Als neue Übung generieren“ bei einer bestehenden Übung, danach `#/admin` → „Löschen“.
- **Beobachtung:**
  - Die neue Übung übernimmt den Namen „Dienstabend Reload“ unverändert.
  - In der Admin-Liste stehen danach zwei Zeilen mit gleichem Namen, Datum, gleicher Leitung, Teilnehmerzahl und Spielmodus. Unterscheidbar sind sie nur an „Erstellt 21:01:39“ bzw. „21:06:54“ (`a02-liste.png`). Der Übungscode steht nicht in der Liste.
  - Die Löschrückfrage nennt Name, Datum, Teilnehmerzahl und Übungscode. Das ist gut, aber der Code lässt sich in der Liste nicht gegenprüfen.
  - Nach dem Löschen erscheint „Übung „Dienstabend Reload“ gelöscht.“, ohne Rückgängig (`a03-nach-loeschen.png`).
- **Erwartung der Rolle:**
  - Die beiden Übungen lassen sich auf einen Blick unterscheiden, zum Beispiel am Übungscode in der Liste oder an einem Namenszusatz bei der Neuanlage („… (2)“).
  - Ein Fehlgriff beim Löschen lässt sich kurz zurücknehmen.
- **Auswirkung:** Die Übungsleitung räumt nach dem Neuanlegen die „alte“ Übung auf und erwischt die Übung, deren Codes schon ausgegeben sind. Alle Teilnehmer- und Leitungslinks sind dann tot, und neue Codes müssen verteilt werden. Für einen Dienstabend ist das ärgerlich, mehr nicht. Die Bewertung erfolgt aus Fehlerkorrektur-Sicht, die Berechtigungsfrage behandelt das Review zu destruktiven Aktionen.
- **Empfehlung:**
  - Übungscode als Spalte in die Admin-Liste aufnehmen.
  - Bei „Als neue Übung“ einen Namenszusatz vorschlagen.
  - Optional nach dem Löschen eine kurze Rücknahmefrist im Toast anbieten.
- **Verifikation:** Eine Übung als neue Übung duplizieren und `#/admin` öffnen. Die beiden Zeilen unterscheiden sich sichtbar am Code bzw. Namen.

### P3-1 Teilnehmer: Ein sehr schnelles „Rückgängig“ wird kommentarlos ignoriert
- **Fundstelle / Aufgabe:** Smartphone, `#/teilnehmer/<id>/<code>`, „✓ Als abgesetzt markieren“ in der falschen Zeile, dann sofort „Rückgängig“ im Hinweis unten.
- **Beobachtung:**
  - Ein Tipp etwa 0,4 s nach dem Markieren bewirkt nichts. Der Spruch bleibt abgesetzt, der Hinweis bleibt unverändert stehen, es gibt keine Rückmeldung.
  - Ab etwa 1 s funktioniert „Rückgängig“ zuverlässig, auch bei aktiver Ausblendung (`t06-nach-absetzen-ausgeblendet.png`). Ursache ist die Doppeltipp-Sperre von 1000 ms (`src/teilnehmer/rueckgaengigHinweis.ts:42-45`, `ansichtHelfer.ts:17`).
  - Der Hinweis steht 8 s, ein zweiter Tipp greift also.
- **Erwartung der Rolle:** Wer den Fehler sofort bemerkt, tippt sofort auf „Rückgängig“, und das wirkt.
- **Auswirkung:** Der Helfer glaubt, er habe korrigiert, und wendet sich wieder dem Funkgerät zu. Die Nachricht bleibt abgesetzt und ist bei aktiver Ausblendung unsichtbar. Das kommt selten vor, weil der Hinweis sichtbar stehen bleibt.
- **Empfehlung:** Die Sperre nur gegen den zweiten Tipp des Doppeltipps auf denselben Knopf wirken lassen, nicht gegen den Rückgängig-Knopf. Alternativ den Knopf in der Sperrzeit sichtbar deaktiviert zeigen.
- **Verifikation:** Markieren und nach 300 ms „Rückgängig“ tippen. Der Spruch ist wieder offen.

### P3-2 Übungsleitung: Die Rückgängig-Leiste bleibt nach einer neuen Aktion stehen und bezieht sich auf die ältere
- **Fundstelle / Aufgabe:** `#/uebungsleitung/<id>`, Nachrichtenplan. Die Leitung nimmt ein „abgesetzt“ per ↺ zurück und markiert dann eine andere Nachricht als abgesetzt.
- **Beobachtung:**
  - Nach der Rücknahme erscheint die Leiste „„Abgesetzt“ für Heros Oldenburg 21/11 Nr. 2 zurückgenommen. Rückgängig ✕“. Das Abhaken einer anderen Nachricht lässt diese Leiste unverändert stehen, etwa 10 s lang (`u07-veralteter-undo.png`).
  - Ein Klick auf „Rückgängig“ in diesem Moment markiert wieder Nr. 2 und nicht die gerade abgehakte Nachricht. Der Plan zählt danach zwei abgesetzte statt einer.
  - Dasselbe gilt für die Leiste nach „Anmeldung zurücknehmen“.
  - Abhaken selbst erzeugt keine Leiste. Es wird über ↺ in der Zeile korrigiert.
- **Erwartung der Rolle:** „Rückgängig“ betrifft die letzte eigene Aktion, oder die Leiste verschwindet, sobald etwas anderes getan wird.
- **Auswirkung:** Die Leitung möchte den gerade gemachten Fehlklick zurücknehmen und setzt stattdessen einen zweiten falschen Status. Der Text nennt die Nummer korrekt, im Trubel liest ihn aber niemand. Leicht über ↺ korrigierbar.
- **Empfehlung:** Die Leiste bei jeder neuen Statusaktion schließen. Alternativ auch für das Abhaken eine Leiste mit dem neuen Bezug zeigen.
- **Verifikation:** Rücknahme ausführen, dann eine andere Nachricht abhaken. Die alte Rückgängig-Leiste ist weg.

### P3-3 Schnellzugang im Generator: Ein Code mit falscher Länge führt ohne Hinweis ins Code-Formular
- **Fundstelle / Aufgabe:** Startseite `#/generator`, Kasten „Du nimmst an einer Übung teil …“. Eingetippt wird ein Übungscode mit 5 Zeichen und ein Teilnehmercode mit 3 Zeichen.
- **Beobachtung:**
  - Nach „Teilnehmer-Zugang öffnen“ springt die Adresse auf `#/teilnehmer?uc=NRKH2&tc=9LK`. Es erscheint das Code-Formular mit den eingetippten Werten und dem allgemeinen Hinweis „Gib Übungscode und Teilnehmercode ein …“ (`g10-quickjoin-falsch.png`).
  - Eine Fehlermeldung gibt es nicht. Der Helfer weiß nicht, ob er etwas falsch gemacht hat oder ob die Seite noch lädt.
  - Ein falscher Code mit korrekter Länge bringt im Formular dagegen eine klare Meldung mit dem Hinweis auf 0/O und 1/I (`t04-join-zahlendreher.png`).
- **Erwartung der Rolle:** „Übungscode hat 6 Zeichen, du hast 5 eingegeben“, direkt am Schnellzugang oder spätestens im Formular.
- **Auswirkung:** Ein zusätzlicher, unklarer Schritt. Der Helfer drückt im Formular noch einmal auf „Zugang öffnen“ und bekommt erst dann eine Meldung.
- **Empfehlung:** Die Länge schon im Schnellzugang prüfen, oder die Formatprüfung im Formular beim Ankommen sofort anzeigen.
- **Verifikation:** 5 bzw. 3 Zeichen eingeben und absenden. Es erscheint sofort eine Meldung zur Länge.

### P3-4 `#/uebungsleitung/` ohne ID zeigt weiterhin das leere Gerüst
- **Fundstelle / Aufgabe:** Eine Übungsleitungs-Adresse, bei der die ID ganz fehlt, etwa weil der Link vor dem letzten Schrägstrich abgeschnitten wurde.
- **Beobachtung:** Es erscheinen „Teilnehmer“, „Nachrichtenplan 0 / 0“, „ETA: –“, „Live-Status: –“ ohne jede Meldung. Bei einer *falschen* ID kommt dagegen inzwischen eine klare Seite: „Übung nicht gefunden … Geprüfte Übungs-ID … Gespeicherte Übungen öffnen / Neue Übung erstellen“ (`u01-falsche-id.png`).
- **Erwartung der Rolle:** Dieselbe Fehlerseite wie bei falscher ID.
- **Auswirkung:** Das kommt selten vor. Die Seite wirkt dann wie eine leere, noch ladende Übung.
- **Empfehlung:** Den Fall „keine ID“ wie „ID nicht gefunden“ behandeln.
- **Verifikation:** `#/uebungsleitung/` öffnen. Die Fehlerseite mit den Weiter-Wegen erscheint.

## Positiv beobachtet (nicht ändern)
- **Generator, Pflichtfelder:** Fehlende Übungsleitung, Vorlage oder Teilnehmernamen werden einzeln am Feld erklärt, das erste Feld bekommt den Fokus (`g01-leer.png`). Der Fehlerkasten steht nach 6 s noch da.
- **Generator, Zahlen:** Für -5, 0 und leer meldet die App „Bitte eine ganze Zahl ab 1 eintragen.“, für 9999 „Höchstens 200 Funksprüche pro Teilnehmer …“, für -20 % und 150 % „Bitte einen Wert von 0 bis 100 eintragen.“ Der Tab bleibt bedienbar. Die Statusleiste nennt schon vor dem Generieren „ca. 36“ Nachrichten.
- **Generator, Dubletten:** „heros oldenburg 21/11 “ wird als Dublette erkannt, beide Zeilen werden markiert und auf die Gegenzeile verwiesen (`g03-dup.png`).
- **Generator, gelöschte Zeile:** Eine gelöschte Teilnehmerzeile lässt sich per „Rückgängig“ wiederherstellen. Ein individuelles Lösungswort übersteht das Hin- und Herschalten.
- **Generator, Neuladen und Doppelklick:** Ein Neuladen vor dem Generieren stellt den Entwurf wieder her, mit Hinweis und „Entwurf verwerfen“ (`g07-reload-entwurf.png`). Nach dem Generieren steht `#/generator/<id>` in der Adresse, und ein Neuladen zeigt Ergebnis und Links weiter (`g09-reload-nach-ergebnis.png`). Ein Doppelklick erzeugt genau eine Übung.
- **Generator, Änderung nach dem Generieren:** Eine Änderung danach markiert das Ergebnis als „Eingaben geändert …“ (`g11-geaendert.png`). „Überschreiben“ fragt mit konkreten Folgen nach. „Als neue Übung“ lässt die bisherige unverändert.
- **Teilnehmer, Fehlerseiten:** Bei falschem Code oder falscher ID stehen ein konkreter Hinweis und das Code-Formular direkt auf der Seite (`t01-falscher-code.png`, `t02-falsche-id.png`). Ein Doppeltipp auf „abgesetzt“ markiert genau einmal.
- **Teilnehmer, Korrektur und Reset:** „Zurücknehmen“ funktioniert je Zeile. Der Gesamt-Reset liegt eingeklappt in einem eigenen Bereich und fragt mit Anzahl und Wirkung nach.
- **Übungsleitung:** Die Anmeldung lässt sich einzeln zurücknehmen, mit Rückgängig-Leiste. Zeiten werden über ein Zeitfeld korrigiert, ungültige Uhrzeiten lassen sich gar nicht eingeben. Der globale Reset nennt die Mengen und empfiehlt vorher ein PDF.

## Abschluss

- **Aufgabe geschafft:** ja
- **Fremde Hilfe nötig:** nein
- **Größtes Missverständnis:** Gestapelte, nicht mehr aktuelle Fehler-Toasts im Generator erwecken den Eindruck, längst behobene Fehler bestünden noch.
- **Größtes Einsatzrisiko:** Nach „Als neue Übung generieren“ gibt es zwei gleichnamige Übungen, und beim Aufräumen im Admin wird endgültig und ohne Rücknahme die falsche gelöscht.
- **Top-Priorität für die nächste Iteration:** Im Generator nur den aktuellen Fehlerstand zeigen (alte Fehler-Toasts beim neuen Versuch ersetzen) und den Übungscode in die Admin-Liste aufnehmen.

## Abgleich mit dem Lauf vom 2026-10-04

| Alte ID | Titel (gekürzt) | Alte Prio | Status jetzt | Beleg aus dieser Prüfung |
|---|---|---|---|---|
| P1-1 | Übungsleitung mit falscher ID: leeres Gerüst | P1 | behoben | `#/uebungsleitung/<id…x>` zeigt „Übung nicht gefunden … Geprüfte Übungs-ID …“ mit „Gespeicherte Übungen öffnen“ und „Neue Übung erstellen“ (`u01-falsche-id.png`). Rest ohne ID siehe neu P3-4. |
| P1-2 | Falsche Anmeldung nicht zurücknehmbar | P1 | behoben | Nach „Anmeldung erhalten“ steht der Link „Anmeldung zurücknehmen“, auch nach Neuladen. Der Klick stellt den Knopf wieder her, dazu kommt eine Rückgängig-Leiste (`u03-anmelden-falsch.png`, `u04-anmeldung-zurueck.png`). |
| P1-3 | Ergebnis nach Neuladen weg, Formular zurückgesetzt | P1 | behoben | Vor dem Generieren werden Name, 12 Sprüche, 3 Teilnehmer und die Vorlage als Entwurf wiederhergestellt (`g07-reload-entwurf.png`). Danach steht `#/generator/<id>` in der Adresse, und ein Neuladen zeigt die Links (`g09-reload-nach-ergebnis.png`). |
| P2-1 | Fehler nur als flüchtige Toasts ohne Feldbezug | P2 | behoben | Fehler stehen am Feld, das erste Feld hat den Fokus, der Fehlerkasten ist nach 6 s noch sichtbar, die Texte nennen Wert und Bereich (`g01-leer.png`, `g04-9999.png`). Als Nebenwirkung stapeln sich Toasts, siehe neu P2-1. |
| P2-2 | 9999 Sprüche frieren den Tab ein | P2 | behoben | 9999 ergibt „Höchstens 200 Funksprüche pro Teilnehmer …“, die Seite bleibt bedienbar, es wird nichts generiert (`g04-9999.png`). |
| P2-3 | Teilnehmer-Fehlerseiten sind Sackgassen | P2 | teilweise | Falscher Code und falsche ID zeigen jetzt Hinweis und Code-Formular (`t01`, `t02`). Offen ist der Nebenpunkt: Der Schnellzugang mit falscher Codelänge bleibt ohne Meldung (`g10-quickjoin-falsch.png`, neu P3-3). |
| P2-4 | Falsch markierte Nachricht verschwindet bei Ausblendung | P2 | behoben | Mit aktiver Ausblendung erscheint „Spruch 2 als abgesetzt markiert. Rückgängig“, und der Spruch wird zurückgeholt (`t06-nach-absetzen-ausgeblendet.png`). Einschränkung bei sehr schnellem Tipp siehe neu P3-1. |
| P2-5 | Veraltetes Ergebnis, ungenaue Neugenerier-Warnung | P2 | behoben | Nach dem Umbenennen erscheint der Hinweis „Eingaben geändert. …“ (`g11-geaendert.png`). Standard ist „Als neue Übung generieren“ mit neuen Codes. „Überschreiben“ zählt die Folgen einzeln auf, auch neue Codes für umbenannte Teilnehmer und nicht mehr passende Status. |
| P2-6 | Löschen im Admin unbeschriftet, ohne Namen, ohne Rückmeldung | P2 | teilweise | Der Knopf heißt „Löschen“ (`title`/`aria-label` mit Übungsname). Die Rückfrage nennt Name, Datum, Teilnehmer und Übungscode, danach kommt der Toast „… gelöscht.“ (`a03-nach-loeschen.png`). Es gibt weiterhin kein Rückgängig und keinen Code in der Liste (neu P2-2). |
| P3-1 | Dubletten in anderer Schreibweise akzeptiert | P3 | behoben | „heros oldenburg 21/11 “ wird abgewiesen, beide Zeilen werden markiert: „Gleicher Funkrufname wie in Zeile …“ (`g03-dup.png`). |
| P3-2 | Kleine Eingabeverluste im Generator | P3 | behoben | Eine gelöschte Teilnehmerzeile kommt per „Rückgängig“ zurück (`g06-zeile-geloescht.png`). „FUNKE“ bleibt nach dem Wechsel „Keine“ → „Individuell“ erhalten. |
