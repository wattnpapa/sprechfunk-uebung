Befunde: P0=0 P1=1 P2=2 P3=3
Abgleich: behoben=5 teilweise=2 offen=0 nicht-pruefbar=0

# THW-Review: Folgenschwere Bedienhandlungen (destructive-action), zweiter Lauf

Datum: 2026-10-05 · Perspektive: praktisch-technischer THW-Helfer, der zügig arbeitet und dabei versehentlich etwas Folgenschweres auslösen könnte · Methode: Skill `thw-destructive-action-reviewer`

Geprüft wurde am laufenden Build (`http://127.0.0.1:3000`, Mock-Modus, kein echtes Firebase) mit Playwright. Abgedeckt waren Generator (Desktop 1440×1000), Teilnehmer (Pixel 7), Übungsleitung (Desktop, klassisch und X-Zeit) und Admin (Desktop). Alle Dialogtexte wurden mitgeschnitten, alle Aktionen tatsächlich ausgelöst, jeweils einmal abgebrochen und einmal bestätigt. Die Screenshots liegen im Scratchpad der Sitzung unter `destructive-action/01…24-*.png`. Ihre Dateinamen stehen bei den Befunden.

Einordnung: Die App ist ein Ausbildungswerkzeug für Dienstabend und Ausbildung, kein Echteinsatzsystem. „Einsatzrisiko“ heißt hier: Eine laufende oder vorbereitete Übung geht kaputt, Teilnehmer arbeiten mit falschen Unterlagen, oder die Übungsleitung verliert ihre Mitschrift.

## Urteil aus Sicht der Rolle

Bei den folgenschweren Aktionen hat sich seit dem ersten Lauf deutlich etwas getan. Die Reset-Knöpfe sagen jetzt, wen sie treffen („Abhak-Stand für alle zurücksetzen“, „Übungsstand für alle zurücksetzen“). Sie stehen jeweils in einem rot umrandeten Bereich am Seitenende, beim Teilnehmer zusätzlich hinter einem aufzuklappenden Abschnitt. Die Rückfrage nennt, was verloren geht („1 abgesetzte Nachrichten, 0 Notizen und 1 Anmeldungen“). Wer im Generator eine gespeicherte Übung erneut generiert, legt standardmäßig eine neue Übung mit neuen Codes an. Überschreiben ist ein eigener, rot umrandeter Weg, und die Rückfrage nennt die Folgen konkret. Im Admin nennt die Löschrückfrage Name, Datum, Rufgruppe, Teilnehmerzahl und Übungscode, und nach dem Löschen erscheint eine Erfolgsmeldung. Einzelne Statuswechsel lassen sich überall per „Rückgängig“-Leiste zurückholen: Abhaken beim Teilnehmer, „zurücknehmen“ und „Anmeldung zurücknehmen“ in der Übungsleitung sowie das Entfernen eines Teilnehmers im Generator. Doppeltipps sind abgefangen. Das galt beim Teilnehmer am Handy und beim Abhaken in der Übungsleitung, wo „zurücknehmen“ direkt nach dem Klick kurz gesperrt ist.

Eine wirklich folgenschwere Stelle ist dabei durchgerutscht. **„Jetzt starten“ im X-Zeit-Cockpit der Übungsleitung ersetzt eine schon gesetzte X-Zeit-Basis für alle Teilnehmer**, ohne Rückfrage und ohne Rückgängig. Dazu kommen zwei mittlere Punkte. Nach einem bewussten Überschreiben warnt die Übungsleitung nicht vor ihren nicht mehr passenden Status. Und „Entwurf verwerfen“ löscht die wiederhergestellten Generator-Eingaben ohne Rückweg.

Alle Aufgaben lassen sich ohne fremde Hilfe erledigen.

## Befunde

### P1-1: „Jetzt starten“ verschiebt eine laufende X-Zeit-Übung für alle, ohne Rückfrage und ohne Rückgängig

- **Fundstelle / Aufgabe:** Übungsleitung einer X-Zeit-Übung, Cockpit „X-Zeit-Basis (Übungsbeginn, gilt für alle)“, Knopf `#btn-cockpit-xzeit-jetzt` („Jetzt starten“) und Zeitfeld `#cockpitXZeitBasisInput`. Screenshot `20-cockpit-nach-jetzt.png`. Code: `src/uebungsleitung/index.ts:171-183` (`uebernehmen` → `setCockpitBasis`), `:211-224`.
- **Beobachtung:** Die Basis stand auf 09:00, zwei Nachrichten waren abgesetzt, und der Plan-Status zeigte „16 hinter Plan“. Ein Klick auf „Jetzt starten“ setzte die Basis ohne Dialog auf 21:02 (mitgeschnitten: 0 Dialoge), und der Plan-Status sprang auf „im Plan“. Der Hinweis lautet danach „Basis 21:02 von der Übungsleitung gesetzt – gilt für alle Teilnehmer.“ Es gibt keine Rückgängig-Leiste, und die alte Basis wird nirgends mehr angezeigt. Der Knopf heißt auch bei laufender Übung weiter „Jetzt starten“. Eine Änderung im Zeitfeld wird ebenfalls sofort für alle übernommen.
- **Erwartung der Rolle:** „Jetzt starten“ ist der Knopf für den Übungsbeginn. Wer ihn bei laufender Übung sieht, hält ihn eher für harmlos („Uhr neu synchronisieren“) oder wird ihn als zweite Leitungsperson am eigenen Laptop drücken, weil er nicht weiß, dass schon gestartet wurde. Erwartet wird mindestens: „Die Übung läuft seit 09:00. Neu starten verschiebt alle Fälligkeiten für alle.“
- **Auswirkung im Einsatz:** Alle Fälligkeiten verschieben sich auf einen Schlag, für die Übungsleitung und bei allen Teilnehmern, die der Leitungs-Basis folgen. Überfällige Sprüche verschwinden aus der Anzeige, „Als Nächstes“ zeigt andere Nummern, und die Teilnehmer bekommen neue Minutenangaben mitten im Funkverkehr. Die ursprüngliche Startzeit muss man aus dem Gedächtnis rekonstruieren. Das ist kein Datenverlust der Mitschrift, deshalb nur P1. Aber es bricht den Zeitplan einer laufenden Übung.
- **Empfehlung:** Ist bereits eine Basis gesetzt, sollte der Knopf anders heißen, etwa „Neu starten (verschiebt alle Zeiten)“. Er sollte dann nachfragen und die alte und neue Basis nennen sowie sagen, wie viele Nachrichten dadurch nicht mehr überfällig oder fällig sind. Nach jeder Basisänderung eine Rückgängig-Leiste wie bei „zurücknehmen“ zeigen („X-Zeit-Basis 09:00 → 21:02 geändert – Rückgängig“). Das gilt auch für Änderungen über das Zeitfeld.
- **Verifikation:** Die Basis ist gesetzt, und es wird „Jetzt starten“ oder „Neu starten“ geklickt. Dann erscheint entweder eine Rückfrage mit beiden Uhrzeiten, oder eine Rückgängig-Leiste stellt die alte Basis mit einem Klick wieder her.

### P2-1: Nach dem Überschreiben bleiben in der Übungsleitung die alten Status stehen, ohne Hinweis

- **Fundstelle / Aufgabe:** Generator einer gespeicherten Übung, `#ueberschreibenBtn` („Bestehende Übung überschreiben …“), danach Übungsleitung derselben Übung. Screenshots `21-generator-nach-ueberschreiben.png`, `22-leitung-nach-ueberschreiben.png`. Code: `src/generator/controllerHilfen.ts:40-79`.
- **Beobachtung:** Die Rückfrage vor dem Überschreiben ist gut. Sie sagt, dass Ausdrucke nicht mehr passen und dass gesetzte Status an Nachrichtennummern hängen: „Setze sie in der Übungsleitung zurück.“ Nach dem Bestätigen erscheint im Generator ein Toast mit demselben Rat, der nach 2,5 s verschwindet. Die Übungsleitung derselben Übung zeigte danach weiter zwei Nachrichten als abgesetzt, jetzt mit neuem Inhalt. Dort gab es keinen Hinweis, dass die Übung überschrieben wurde und der Stand nicht mehr passt.
- **Erwartung der Rolle:** Die Person am Leitungs-Laptop ist oft nicht dieselbe wie die am Generator. Sie erwartet, dass ihre Ansicht ihr sagt, wenn sich die Grundlage geändert hat.
- **Auswirkung im Einsatz:** Abgehakte Nachrichten zeigen Inhalte, die nie gefunkt wurden, und Fortschritt und Debrief-PDF stimmen nicht. Um das zu reparieren, muss die Leitung den Reset „für alle“ ausführen, also genau die gefährlichste Aktion der Seite, und zwar aus einem Toast heraus, den sie nicht gesehen hat.
- **Empfehlung:** Die Übungsleitung zeigt einen festen, nicht automatisch verschwindenden Hinweis, wenn der Live-Status älter ist als der aktuelle Stand der Übung: „Diese Übung wurde am … neu verteilt. Die gesetzten Status gehören zur alten Fassung.“ Daneben steht ein klar benannter Weg, den alten Stand zu sichern (PDF) und dann zurückzusetzen. Alternativ setzt das Überschreiben den Status nach einer eigenen Zusatzfrage gleich mit zurück.
- **Verifikation:** Nach einem Überschreiben öffnet ein Zweitgerät die Übungsleitung und sieht ohne Vorwissen einen Hinweis auf die geänderte Fassung.

### P2-2: „Entwurf verwerfen“ löscht wiederhergestellte Eingaben ohne Rückweg, und es ist der einzige Knopf am Hinweis

- **Fundstelle / Aufgabe:** Generator nach einem Reload mit ungespeicherten Eingaben, Hinweisleiste `#generatorEntwurfHinweis` mit `#generatorEntwurfVerwerfen`. Screenshot `24-entwurf-hinweis.png`.
- **Beobachtung:** Der Hinweis lautet „Deine Eingaben vom 05.10., 21:03 wurden wiederhergestellt. Sie liegen nur in diesem Browser, noch ist keine Übung gespeichert.“ Rechts daneben steht nur „Entwurf verwerfen“. Ein Klick setzte das Formular ohne Rückfrage und ohne Rückmeldung auf Standardwerte zurück („Sprechfunkübung Projekt Grenzton 2026“). Teilnehmerliste und Name waren weg, und eine Rückgängig-Leiste fehlte.
- **Erwartung der Rolle:** Viele Nutzer klicken einen Hinweis weg, sobald sie ihn gelesen haben. Der einzige Knopf in der Leiste wird deshalb leicht als „Hinweis schließen“ verstanden.
- **Auswirkung im Einsatz:** Das passiert nur in der Vorbereitung. Wer aber eine lange Teilnehmerliste mit Funkrufnamen und Stellennamen eingetragen hat, muss sie neu tippen, und dabei schleichen sich Tippfehler ein.
- **Empfehlung:** Neben „Entwurf verwerfen“ einen harmlosen Weg „Hinweis ausblenden“ (✕) anbieten. Nach dem Verwerfen kurz „Entwurf verworfen – Rückgängig“ zeigen, so wie beim Entfernen eines Teilnehmers.
- **Verifikation:** Ein Klick auf das einzige auffällige Bedienelement der Hinweisleiste lässt die Eingaben stehen. Ein versehentliches Verwerfen lässt sich mit einem Klick zurückholen.

### P3-1: Rückfragen bleiben native „OK/Abbrechen“-Dialoge, und eine Rückfrage trainiert das reflexhafte „OK“

- **Fundstelle / Aufgabe:** Alle Bestätigungen laufen über `uiFeedback.confirm` → `globalThis.confirm` (`src/core/UiFeedback.ts:16-21`). Generator-Aktionsleiste: `04-actionbar.png`.
- **Beobachtung:** Die Texte sind inzwischen konkret und durchgehend in Du-Form. Die Knöpfe heißen aber weiter „OK“, nicht nach der Folge. Auch die harmlose Aktion „Als neue Übung generieren“ fragt nach („Als neue Übung anlegen? …“). Wer das dreimal mit OK bestätigt hat, drückt beim im gleichen Stil gebauten Überschreiben-Dialog ebenso schnell OK. In der Aktionsleiste steht „Bestehende Übung überschreiben …“ etwa 8 px über dem Hauptknopf und ist ähnlich breit (Messung: y 481 bzw. 526, je 37 px hoch).
- **Erwartung der Rolle:** Eine Rückfrage nur dort, wo wirklich etwas verloren geht, und ein Bestätigungsknopf, der die Folge nennt („Für alle zurücksetzen“, „Überschreiben“).
- **Auswirkung im Einsatz:** Die Wirkung ist gering, weil Inhalt und Reichweite jetzt im Text stehen. Die Gewöhnung schwächt aber die Schutzwirkung der wirklich gefährlichen Dialoge.
- **Empfehlung:** Für „Als neue Übung generieren“ keine Rückfrage, sondern die vorhandene Erfolgsmeldung. Für Überschreiben, Löschen und die Resets eigene Dialoge mit handlungsbenanntem, nicht vorausgewähltem Bestätigungsknopf. Den Überschreiben-Knopf mit mehr Abstand oder hinter einem „Weitere Optionen“ absetzen.
- **Verifikation:** Kein destruktiver Dialog hat mehr einen Knopf „OK“. Nicht-destruktive Aktionen fragen nicht nach.

### P3-2: Kleinigkeiten an den Rückgängig-Leisten

- **Fundstelle / Aufgabe:** Übungsleitung, Rückgängig-Leiste nach „zurücknehmen“ (`14-leitung-zurueckgenommen.png`); Teilnehmer mobil, `#btn-teilnehmer-rueckgaengig` (`src/teilnehmer/rueckgaengigHinweis.ts:39-47`).
- **Beobachtung:** In der Übungsleitung schwebt die Leiste unten mittig über der Nachrichtentabelle und verdeckt Teile der darunterliegenden Zeile (Empfänger und Nachricht von Nr. 4). Beim Teilnehmer wird ein Tipp auf „Rückgängig“ in der ersten Sekunde nach dem Statuswechsel absichtlich ignoriert, als Schutz gegen Doppeltipps. Das geschieht aber ohne jede Rückmeldung: Im Test blieb ein Tipp nach etwa 0,4 s wirkungslos, und der Knopf sah unverändert aktiv aus.
- **Erwartung der Rolle:** Wer den Fehlgriff sofort bemerkt und schnell „Rückgängig“ tippt, erwartet, dass es wirkt oder dass sichtbar ist, warum nicht.
- **Auswirkung im Einsatz:** Gering. Ein zweiter Tipp wirkt, und die Leiste bleibt 8 s stehen. Es kann aber zu Verunsicherung führen („hat nicht geklappt“).
- **Empfehlung:** Den Knopf während der Sperrsekunde sichtbar deaktiviert darstellen. Die Leiste in der Übungsleitung so platzieren, dass sie keine Tabellenzeile verdeckt, oder genug Platz unter der Tabelle lassen.
- **Verifikation:** In der Sperrzeit ist der Knopf erkennbar ausgegraut. Während die Leiste steht, bleibt keine Tabellenzeile verdeckt.

### P3-3: Nach dem Zurücksetzen „für alle“ keine Bestätigung

- **Fundstelle / Aufgabe:** Übungsleitung, `#resetUebungsleitungLocalData` bestätigt. Screenshot `16-leitung-nach-reset.png`. Code: `src/uebungsleitung/zuruecksetzen.ts:76-93`.
- **Beobachtung:** Nach dem Bestätigen lädt die Seite neu und bleibt unten am Gefahrenbereich stehen. Alle Nachrichten stehen auf „OFFEN“, aber eine Meldung wie „Übungsstand zurückgesetzt“ gibt es nicht. Fehlerfälle (offline, Server bestätigt nicht) melden sich dagegen deutlich, das ist gut.
- **Erwartung der Rolle:** Nach einer großen, nicht umkehrbaren Aktion eine knappe Bestätigung, was passiert ist.
- **Auswirkung im Einsatz:** Gering. Es fördert aber Unsicherheit und im Zweifel einen zweiten Klick.
- **Empfehlung:** Nach dem Reload einmalig „Übungsstand für alle zurückgesetzt (um 21:05)“ anzeigen und die Seite nach oben scrollen.
- **Verifikation:** Nach einem Reset ist eine Bestätigung mit Uhrzeit sichtbar.

## Nicht prüfbar / Annahmen

- Echtes Firebase und mehrere Geräte gleichzeitig wurden nicht geprüft (Mock-Modus). Die Reichweite der Resets und der X-Zeit-Basis auf andere Geräte stammt aus Beschriftung, Hinweistext und Code (`leitung-public`), nicht aus einem beobachteten Zweitgerät.
- Ob Teilnehmer, die eine eigene X-Zeit-Basis gesetzt haben, von P1-1 betroffen sind, wurde nicht geprüft. Laut Teilnehmerdialog ist eine eigene Basis eine bewusste Abweichung, die Leitungs-Basis gilt also im Normalfall.
- Annahme: Bei größeren Übungen arbeiten mehrere Personen an der Übungsleitung. Das macht P1-1 und P2-1 erst wahrscheinlich.

## Abschluss

- **Aufgabe geschafft:** ja (alle destruktiven Abläufe ließen sich auslösen, abbrechen und, wo vorgesehen, rückgängig machen)
- **Fremde Hilfe nötig:** nein
- **Größtes Missverständnis:** „Jetzt starten“ sieht bei laufender X-Zeit-Übung wie ein harmloser Start- oder Sync-Knopf aus, setzt aber den Übungsbeginn für alle neu.
- **Größtes Einsatzrisiko:** Ein zweiter Klick auf „Jetzt starten“ mitten in der Übung verschiebt ohne Rückfrage alle Fälligkeiten bei Leitung und Teilnehmern, und die alte Startzeit ist nicht mehr zu sehen.
- **Top-Priorität für die nächste Iteration:** Eine bereits gesetzte X-Zeit-Basis nur über eine benannte Rückfrage oder mit Rückgängig-Leiste ändern lassen.

## Abgleich mit dem Lauf vom 2026-10-04

| Alte ID | Titel | Alte Prio | Status jetzt | Beleg aus dieser Prüfung |
|---|---|---|---|---|
| P0-1 | „Lokale Daten löschen“ / „Lokale Übungsdaten zurücksetzen“ wirken auf alle | P0 | behoben | Bei „Sync: live“ heißt der Teilnehmer-Knopf „Abhak-Stand für alle zurücksetzen“. Er steht in einem aufzuklappenden, rot umrandeten Abschnitt unter „Unterlagen für den Notfall“, getrennt vom ZIP-Knopf (`10-teilnehmer-gefahr-offen.png`). Die Leitung heißt „Übungsstand für alle zurücksetzen“ und steht in einem eigenen Gefahrenbereich am Seitenende (`15-leitung-gefahrenbereich.png`). Die Rückfrage nennt die Anzahl („alle 3 als abgesetzt markierten“ bzw. „1 abgesetzte Nachrichten, 0 Notizen und 1 Anmeldungen“). Ein Eintippen des Übungscodes wird nicht verlangt, die Kernforderung (Reichweite in der Beschriftung) ist aber erfüllt. |
| P0-2 | Erneutes Generieren überschreibt eine verteilte Übung unter gleichen Codes | P0 | behoben | Der Hauptknopf heißt „Als neue Übung generieren“. Bestätigt entstand eine neue ID (`61c2426d…` ≠ `ba7944b6…`) mit neuem Übungscode. Das Überschreiben ist ein eigener, rot umrandeter Knopf mit Folgen-Text („Verteilte Ausdrucke und Vordrucke passen nicht mehr …“). Eine geladene Übung ist gekennzeichnet: „Diese Übung ist gespeichert (Übungscode FFN9VG). Links und Ausdrucke sind womöglich schon verteilt.“ (`05-generator-bestehende-geladen.png`) |
| P1-1 | Löschen im Admin: unspezifische Rückfrage, keine Wiederherstellung, keine Rückmeldung | P1 | teilweise | Die Rückfrage nennt „Übung „Dienstabend Review“ endgültig löschen? Datum 5.10.2026 · Rufgruppe T_OL_GOLD-1 · 4 Teilnehmer · Übungscode C76UG7“ und die Folgen. Der Knopf hat `aria-label` „Übung „…“ löschen“, ist ein eigener Knopf mit Abstand und Text, und danach erscheint der Toast „Übung „XZeit Review“ gelöscht.“ Es fehlt weiterhin ein Rückgängig bzw. Papierkorb. |
| P1-2 | Einzel-Rücksetzen eines Nachrichtenstatus ohne Rückfrage und ohne Undo | P1 | behoben | Der Knopf ist als Text „zurücknehmen“ beschriftet und war direkt nach dem Doppelklick auf „Als abgesetzt markieren“ gesperrt (`disabled=true`), sodass der Doppelklick dauerhaft „abgesetzt“ ergab. Danach erschien die Leiste „„Abgesetzt“ für Heros Oldenburg 21/11 Nr. 1 zurückgenommen. Rückgängig“, und Rückgängig stellte den Status wieder her (`14-leitung-zurueckgenommen.png`). |
| P2-1 | Anmeldung in der Übungsleitung nicht rücknehmbar | P2 | behoben | Unter dem Anmelde-Badge steht „Anmeldung zurücknehmen“. Ein Klick ergab die Leiste „Anmeldung von Heros Oldenburg 21/11 zurückgenommen. Rückgängig“ (`12-leitung-anmeldung-zurueck.png`, `20-cockpit-nach-jetzt.png`). |
| P2-2 | Teilnehmer im Generator ohne Rückfrage und ohne Undo entfernt | P2 | behoben | Nach dem Entfernen erscheint „„Heros Oldenburg 22/12“ entfernt.“ mit „Rückgängig“. Ein Klick stellte die Zeile samt Namen an derselben Position wieder her (`01-generator-teilnehmer-entfernt.png`). |
| P3-1 | Rückfragen sind Browser-Standarddialoge mit generischem Text | P3 | teilweise | Die Texte sind jetzt konkret und einheitlich in Du-Form (Teilnehmer: „deine anderen Geräte“). Es sind aber weiterhin native `confirm`-Dialoge mit „OK“, siehe neuer Befund P3-1. |
