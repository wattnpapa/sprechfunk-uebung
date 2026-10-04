# THW-Review: Fehlerbehebung und Wiederaufnahme (error-recovery)

Datum: 2026-10-04 · Reviewer-Perspektive: beschäftigter Helfer, der normale Bedienfehler macht und ohne Admin weiterarbeiten will.
Methode: Live-Durchlauf gegen `http://127.0.0.1:3000` im Mock-Modus (localStorage-Firestore) mit Playwright. Generator, Übungsleitung und Admin am Desktop (1440×1000), Teilnehmer auf dem Smartphone (Pixel 7). Die Fehler wurden absichtlich provoziert: leere und doppelte Namen, unsinnige Zahlen, Doppelklick, Neuladen, Zurück, falsche Codes, falsche Auswahl, Neugenerieren, Löschen.
Screenshots: `/tmp/claude-0/-home-user-sprechfunk-uebung/8e81b214-a84b-574f-81cf-240dddbe65b9/scratchpad/error-recovery/` (Dateinamen siehe Befunde).

Kontext: Ausbildungswerkzeug für Dienstabend und Ausbildung, kein Echteinsatz-System. „Einsatzkritisch“ heißt hier: Die Übung kann nicht ordentlich weiterlaufen, oder die Übungsleitung bewertet falsch.

## Urteil

Viele typische Fehler fängt die App ab. Ein Doppelklick auf „Übung generieren“ legt nur eine Übung an. Beim Neugenerieren bleiben Übungs-ID, Übungscode und die Codes und Funksprüche unveränderter Teilnehmer gleich. Auf dem Handy bleibt der Übertragungsstatus über ein Neuladen erhalten, und ein falsch gesetzter Status lässt sich durch erneutes Tippen zurücknehmen. In der Übungsleitung macht ein ↺-Knopf ein versehentliches „✓ abgesetzt“ rückgängig. Ein Zahlendreher im Teilnehmercode bringt eine klare Meldung, und die Eingaben bleiben stehen.

Reibung entsteht an drei Stellen:
1. Es gibt **Sackgassen ohne Weg zurück**: eine Übungsleitung mit falscher ID, die Teilnehmer-Fehlerseiten und die Ergebnisseite des Generators nach Neuladen oder Zurück.
2. **Einzelne Fehlklicks lassen sich nicht zurücknehmen.** Das betrifft die Anmeldung in der Übungsleitung und das Löschen im Admin.
3. **Fehlermeldungen sind flüchtig und ohne Feldbezug.** Es sind Toasts, die nach 2,5 s verschwinden. Bei einem unrealistischen Wert gibt es gar keine Meldung, der Tab friert ein.

Die Aufgaben sind ohne fremde Hilfe meist erledigbar, aber oft nur mit Umwegen (Admin-Liste, globaler Reset, Link neu anfordern).

## Befunde

### P1-1 Übungsleitung mit falscher oder nicht mehr vorhandener ID zeigt ein leeres Gerüst ohne jede Meldung
- **Fundstelle / Aufgabe:** `#/uebungsleitung/<id>`: Die Übungsleitung öffnet einen Link mit Tippfehler, einen abgeschnittenen Link oder einen Link auf eine gelöschte Übung.
- **Beobachtung:** Die Seite zeigt die Überschriften „Übungsüberwachung“, „Teilnehmer“ und „Nachrichtenplan“ mit leeren Karten, dazu „0 / 0“ und „Live-Status: –“. Es gibt keinen Hinweis, dass die Übung nicht gefunden wurde (Screenshot `u01-falsche-id.png`). Im Code wird nur `console.error("Übung nicht gefunden")` geschrieben (`src/uebungsleitung/index.ts:94-96`, ebenso bei fehlender ID Z. 87-90).
- **Erwartung der Rolle:** „Übung nicht gefunden. Prüfe den Link oder öffne die Übung über die Liste bzw. den Generator-Link.“
- **Auswirkung:** Kurz vor Übungsbeginn wirkt die Seite so, als lade sie noch oder als fehlten die Teilnehmer. Die Übungsleitung wartet oder lädt neu und weiß nicht, dass der Link falsch ist. Der Übungsbeginn verzögert sich, eventuell wird die Übung unnötig neu erzeugt.
- **Empfehlung:** Eine sichtbare Fehlermeldung statt des leeren Gerüsts. Sie nennt die geprüfte ID und bietet den Weg zur Übungsliste bzw. zum Generator an.
- **Verifikation:** `#/uebungsleitung/<id mit geändertem letzten Zeichen>` öffnen. Erwartet wird eine Meldung mit einem Weiter-Weg und keine leeren Karten.

### P1-2 Versehentlich gesetzte Anmeldung in der Übungsleitung lässt sich nicht zurücknehmen
- **Fundstelle / Aufgabe:** Übungsleitung, Teilnehmertabelle, Knopf „Anmelden“. Die Übungsleitung klickt in der falschen Zeile.
- **Beobachtung:** Nach dem Klick wird der Knopf durch ein grünes Zeit-Badge ersetzt („041924oct26“). In der Zeile gibt es danach nur noch „Kopieren“ und „Debrief PDF“, kein Rückgängig und kein ↺ (Screenshot `u02-anmelden-falsch.png`, `src/uebungsleitung/UebungsleitungTeilnehmerView.ts:345-354`). Der Zustand übersteht ein Neuladen. Die einzige Korrekturmöglichkeit ist „⟲ Lokale Übungsdaten zurücksetzen“. Laut Rückfrage setzt das *alle* Daten der Übungsleitung zurück und wirkt auch auf Teilnehmer und weitere Leitungsplätze.
- **Erwartung der Rolle:** Eine falsche Anmeldung lässt sich genauso zurücknehmen wie ein falsches „✓ abgesetzt“. Für diesen Fall gibt es dort bereits ↺.
- **Auswirkung:** Ein Teilnehmer gilt als angemeldet, obwohl er sich nie gemeldet hat. Anmeldezeit und Debriefing sind falsch. Zur Korrektur müsste die Übungsleitung den gesamten Übungsstand löschen, und mitten in der Übung wird sie das nicht tun. Der falsche Stand bleibt also stehen.
- **Empfehlung:** Die Anmeldung einzeln zurücknehmbar machen, wie bei den Nachrichten (↺ am Badge oder Rückgängig-Hinweis direkt nach dem Klick). Optional lässt sich die Anmeldezeit korrigieren.
- **Verifikation:** In einer fremden Zeile auf „Anmelden“ klicken, danach dieselbe Zeile zurücksetzen. Die anderen Teilnehmer und Nachrichten bleiben dabei unverändert.

### P1-3 Nach Neuladen oder „Zurück“ ist die Ergebnisseite des Generators weg, und das Formular ist zurückgesetzt
- **Fundstelle / Aufgabe:** Generator `#/generator` vor und nach „Übung generieren“.
- **Beobachtung:**
  - *Vor dem Generieren:* Name „Dienstabend Test Reload“, 12 Sprüche und ein eigener Teilnehmername wurden eingetragen, danach F5. Alles ist weg. Der Übungsname ist ein neuer Zufallsname, die Teilnehmerliste wieder die Standardliste.
  - *Nach dem Generieren* bleibt die Adresse `http://127.0.0.1:3000/` ohne Übungs-ID. Ein Neuladen zeigt wieder das leere Standardformular, „Ergebnis“ und Links sind nicht mehr zu sehen (`g08-reload-after-result.png`). Bei direktem Einstieg führt „Zurück“ aus der App heraus (`about:blank`).
  - Die Übung ist trotzdem gespeichert. Zurück kommt man nur über den vorher kopierten Generator-Link oder über die Admin-Liste. Darauf weist die Seite nicht hin.
- **Erwartung der Rolle:** Nach dem Generieren zeigt die Adresse auf diese Übung (`#/generator/<id>`), damit Neuladen und Lesezeichen funktionieren. Vor dem Generieren bleibt ein halb ausgefülltes Formular erhalten oder wird zur Wiederherstellung angeboten.
- **Auswirkung:** Beim Vorbereiten des Dienstabends ist ein Neuladen schnell passiert, etwa durch Wischgeste, versehentliches F5 oder einen Absturz. Dann sind Teilnehmer- und Übungsleitungslinks weg, obwohl die Übung existiert. Die Übungsleitung erzeugt im Zweifel eine zweite Übung, und schon verteilte Ausdrucke passen nicht mehr zur neuen.
- **Empfehlung:** Nach erfolgreichem Generieren auf die Übungs-URL wechseln. Ungespeicherte Formulareingaben lokal vorhalten und beim nächsten Öffnen anbieten. Mindestens im Ergebnis sichtbar sagen: „Dieser Link führt zurück zu dieser Übung“.
- **Verifikation:** Übung generieren, F5 drücken. Ergebnis und Links sind weiterhin sichtbar. Formular halb ausfüllen, F5 drücken, die Eingaben werden angeboten.

### P2-1 Fehlermeldungen sind kurzlebige Toasts ohne Feldbezug, teils mit irreführendem Text
- **Fundstelle / Aufgabe:** Generator, „Übung generieren“ mit fehlenden oder falschen Werten.
- **Beobachtung:** Alle Funkrufnamen leer ergibt den Toast „Bitte mindestens einen Teilnehmer mit Funkrufnamen angeben.“ unten rechts, weit weg vom Knopf (`g02-leer.png`). Nach 3 s ist er verschwunden (`src/core/UiFeedback.ts:55-59`, 2500 ms). Kein Feld wird markiert, und es gibt keinen Fokussprung. Bei „Funksprüche pro Teilnehmer“ = `-5` oder leer meldet die App „ist kleiner als die Summe aus Anmeldung + An Alle + An Mehrere“ (`src/generator/index.ts:766`). Das stimmt rechnerisch, aber der eigentliche Fehler „Zahl fehlt bzw. negativ“ wird nicht genannt. Negative Prozentwerte (`-20`) und `150 %` nimmt das Feld ohne Hinweis an.
- **Erwartung der Rolle:** Die Meldung steht am betroffenen Feld, bleibt sichtbar, bis der Fehler behoben ist, und sagt genau, was falsch ist („Bitte eine Zahl ab 1 eintragen“).
- **Auswirkung:** Wer gerade zum Funkgerät oder zu einem Kameraden schaut, verpasst die Meldung. Die Übungsleitung klickt dann erneut und sucht im langen Formular nach der Ursache.
- **Empfehlung:** Fehler am Feld anzeigen und das erste fehlerhafte Feld anspringen. Fehler-Toasts nicht automatisch ausblenden. Die Texte sollen den konkreten Wert und den erlaubten Bereich nennen.
- **Verifikation:** Alle Namen leeren und generieren. Die Meldung steht nach 10 s noch da, das Namensfeld ist markiert und fokussiert.

### P2-2 Unrealistische Spruchanzahl friert die Seite ohne Rückmeldung ein
- **Fundstelle / Aufgabe:** Generator, „Funksprüche pro Teilnehmer“. Statt 10 werden 9999 eingetippt.
- **Beobachtung:** 100, 500 und 1000 werden in unter 1 s generiert. Bei 9999 reagiert der Tab auch nach 60 s nicht mehr, und selbst ein Screenshot war nicht mehr möglich. Das Feld hat `min="1"`, aber kein Maximum. Die Statusleiste zeigt vor dem Generieren „Nachrichten: 0“ und „Dauer: –“, gibt also keine Vorwarnung.
- **Erwartung der Rolle:** Ein offensichtlich unsinniger Wert wird vor dem Start abgefangen, oder es kommt eine Rückfrage („9999 Sprüche je Teilnehmer, geschätzte Dauer … – wirklich?“).
- **Auswirkung:** Der Browser hängt. Beim Schließen sind die Formulareingaben verloren (siehe P1-3), und die Übungsleitung beginnt von vorn. Für den Ausbildungszweck ist das ärgerlich, gefährlich ist es nicht.
- **Empfehlung:** Eine sinnvolle Obergrenze mit klarer Meldung festlegen. Die erwartete Nachrichtenanzahl und Dauer schon vor dem Generieren live anzeigen.
- **Verifikation:** 9999 eintragen und generieren. Es erscheint eine verständliche Meldung, die Seite bleibt bedienbar.

### P2-3 Teilnehmer-Fehlerseiten sind Sackgassen
- **Fundstelle / Aufgabe:** Smartphone, `#/teilnehmer/<id>/<falscher Code>` bzw. `#/teilnehmer/<falsche id>/<code>`. Typischer Fall: ein abgetippter oder abgeschnittener Link.
- **Beobachtung:** Es erscheint nur ein roter Kasten „Teilnehmer nicht in dieser Übung gefunden.“ bzw. „Übung nicht gefunden.“ (`t04-falscher-teilnehmer.png`, `src/teilnehmer/index.ts:81, 90`). Es gibt keinen Knopf zum Code-Formular und keinen Hinweis, was zu tun ist. Im Menü steht nur „Übung erstellen“, der Teilnehmer-Zugang ist nicht verlinkt. Im Gegensatz dazu funktioniert das Code-Formular gut: Ein Zahlendreher im Teilnehmercode ergibt „Kombination aus Übungscode und Teilnehmercode wurde nicht gefunden.“, und die Eingaben bleiben stehen (`t03-join-zahlendreher.png`).
- **Erwartung der Rolle:** Unter der Meldung steht ein Knopf „Codes eingeben“ und der Satz „Frag die Übungsleitung nach Übungs- und Teilnehmercode“.
- **Auswirkung:** Der Helfer steht mit dem Handy da und muss die Übungsleitung unterbrechen, damit sie ihm einen neuen Link schickt, obwohl er die Codes auch auf dem Ausdruck hätte.
- **Empfehlung:** Auf beiden Fehlerseiten direkt das Code-Formular anbieten bzw. dorthin verlinken.
- **Verifikation:** Falschen Teilnehmerlink öffnen. Ohne Adresszeile ist man mit einem Tipp im Code-Formular.
- **Nicht prüfbar:** Den Kurzlink `#/teilnehmer?uc=…&tc=…` löst der Mock nicht auf (bekannte Einschränkung, siehe `scripts/generate-anleitung-screenshots.mjs`). Ob er in Produktion bei falschem Code automatisch eine Meldung zeigt, wurde nicht geprüft. Aus dem Generator-Schnellzugang mit falschem Format (5 bzw. 3 Zeichen) landet man im Formular **ohne** Fehlermeldung. Die Formatprüfung greift erst beim zweiten Absenden (`t01-quickjoin-falsch.png`).

### P2-4 Falsch als „übertragen“ markierte Nachricht verschwindet bei aktiver Ausblendung
- **Fundstelle / Aufgabe:** Teilnehmer (mobil). Ein Status-Chip wird versehentlich in der falschen Zeile angetippt, „Übertragene ausblenden“ (`#toggle-hide-transmitted`) ist aktiv.
- **Beobachtung:** Der Chip wechselt von „OFFEN“ auf „ÜBERTRAGEN“. Ohne Ausblendung lässt er sich durch erneutes Tippen korrigieren (`t06-falsch-markiert.png`), und ein Doppeltipp hebt sich selbst auf. Bei aktiver Ausblendung verschwindet die Zeile sofort aus der Liste (10 auf 9 Zeilen, `t07-ausgeblendet.png`). Das gilt auch nach einem Neuladen, weil die Einstellung gespeichert wird. Es gibt keinen Toast und kein „Rückgängig“. Zum Korrigieren muss der Helfer erst die Ausblendung abschalten und die Zeile suchen.
- **Erwartung der Rolle:** Nach dem Tippen erscheint kurz „Nachricht X als übertragen markiert – Rückgängig“.
- **Auswirkung:** Eine noch nicht gefunkte Nachricht fällt aus dem Blick und wird nicht abgesetzt. Die Übungsleitung sieht sie als übertragen, und das Debriefing stimmt nicht.
- **Empfehlung:** Nach dem Markieren kurz einen Rückgängig-Hinweis zeigen. Die gerade markierte Zeile erst mit Verzögerung ausblenden.
- **Verifikation:** Ausblendung an, falsche Zeile antippen. Innerhalb weniger Sekunden lässt sich das mit einem Tipp rückgängig machen.

### P2-5 Änderungen nach dem Generieren: Ergebnis wirkt aktuell, ist es aber nicht, und das Neugenerieren warnt ungenau
- **Fundstelle / Aufgabe:** Generator, Ergebnis ist angezeigt. Die Übungsleitung korrigiert einen Funkrufnamen (Zahlendreher 11/11 auf 11/12) und generiert neu.
- **Beobachtung:** Nach dem Umbenennen ohne Neugenerieren zeigen die Links weiter den alten Stand, ohne Hinweis, dass das Ergebnis veraltet ist (`g12-rename-nach-generierung.png`). Beim Neugenerieren fragt die App „Übung neu generieren? Bestehende Nachrichten gehen verloren.“ Tatsächlich passiert Folgendes:
  - Die Funksprüche unveränderter Teilnehmer und die Codes bleiben gleich (positiv).
  - Der umbenannte Teilnehmer bekommt aber einen **neuen Teilnehmercode** (AC2C wird zu UCQV). Sein schon verschickter Link führt danach auf „Teilnehmer nicht in dieser Übung gefunden“.
  - Eine in der Übungsleitung vorher gesetzte Anmeldung war nach dem Neugenerieren und Neuladen nicht mehr sichtbar („keine Meldung“, `u05-nach-neugenerierung.png`). Dieser Punkt ist nur einmal beobachtet, die Ursache ist nicht geklärt.
- **Erwartung der Rolle:** Nach jeder Änderung steht ein Hinweis „Eingaben geändert, Ergebnis ist veraltet“. Die Rückfrage sagt konkret, wessen Link sich ändert, welche Ausdrucke neu gedruckt werden müssen und ob Leitungsstatus verloren geht.
- **Auswirkung:** Ein Teilnehmer mit dem alten Link oder Ausdruck kommt nicht mehr hinein, oder die Übungsleitung arbeitet mit einem Stand, den sie gar nicht mehr generiert hat.
- **Empfehlung:** Ein veraltetes Ergebnis sichtbar kennzeichnen. In der Rückfrage die betroffenen Teilnehmer bzw. Links aufzählen. Klar sagen, was mit dem laufenden Leitungsstatus passiert.
- **Verifikation:** Nach dem Generieren einen Namen ändern. Das Ergebnis ist als veraltet markiert, die Rückfrage beim Neugenerieren nennt genau diesen Teilnehmer.

### P2-6 Löschen im Admin: Symbol ohne Beschriftung, Rückfrage ohne Übungsnamen, keine Bestätigung und kein Rückgängig
- **Fundstelle / Aufgabe:** `#/admin`, Übungsliste. Zwei Übungen mit gleichem Datum, gleicher Rufgruppe, gleicher Leitung und gleicher Teilnehmerzahl (`a02-liste.png`), es wird die falsche Zeile erwischt.
- **Beobachtung:** Der rote Papierkorb hat weder `title` noch `aria-label` (`src/admin/AdminView.ts:69`), die Nachbarknöpfe haben einen Tooltip. Die Rückfrage lautet nur „Möchtest du diese Übung wirklich löschen?“ (`src/admin/index.ts:158`), ohne Namen und Datum. Nach dem Löschen verschwindet die Zeile kommentarlos, es gibt keinen Erfolgs-Toast und kein Rückgängig.
- **Erwartung der Rolle:** In der Rückfrage stehen Name und Datum der Übung. Danach kommt eine Bestätigung, idealerweise mit kurzer Rücknahmemöglichkeit.
- **Auswirkung:** Die Übung des laufenden Dienstabends wird statt der Testübung gelöscht. Teilnehmer und Übungsleitung verlieren den Zugang, und das lässt sich nur durch Neugenerieren mit neuen Links beheben. (Die Schwere hier ist aus Fehlerkorrektur-Sicht bewertet. Zur Frage, wer überhaupt löschen darf, siehe das Review zu destruktiven Aktionen.)
- **Empfehlung:** Die Rückfrage nennt die Übung. Der Knopf bekommt einen Tooltip bzw. ein Label „Übung löschen“. Nach dem Löschen eine Rückmeldung anzeigen, wenn möglich eine Rücknahmefrist.
- **Verifikation:** Löschen anklicken. Im Dialog stehen „Dienstabend A, 04.10.2026“, danach erscheint eine Erfolgsmeldung.

### P3-1 Doppelte Funkrufnamen, die sich nur in Groß-/Kleinschreibung oder Leerzeichen unterscheiden, werden akzeptiert
- **Fundstelle / Aufgabe:** Generator, Teilnehmerverwaltung: „Heros Oldenburg 21/11“ und „heros oldenburg 21/11 “.
- **Beobachtung:** Exakte Dubletten weist die App ab („Teilnehmernamen müssen eindeutig sein.“, `g03-dupe.png`). Die Variante mit anderer Schreibweise wurde dagegen generiert. Der Vergleich in `src/generator/index.ts:786` unterscheidet Groß- und Kleinschreibung.
- **Erwartung der Rolle:** Das wird als derselbe Funkrufname erkannt.
- **Auswirkung:** Zwei Teilnehmer mit praktisch gleichem Rufnamen verwirren im Funkverkehr. Ernst ist das nicht, weil es vor Übungsbeginn auffällt.
- **Empfehlung:** Beim Dublettenvergleich Groß-/Kleinschreibung und Leerzeichen ignorieren und die betroffenen Zeilen markieren.
- **Verifikation:** Die beiden Schreibweisen eintragen. Die App meldet eine Dublette und markiert beide Zeilen.

### P3-2 Kleine Eingabeverluste ohne Rückweg im Generator
- **Fundstelle / Aufgabe:** Generator, Teilnehmerverwaltung und Lösungswörter.
- **Beobachtung:**
  - Der rote Papierkorb an einer Teilnehmerzeile löscht sofort, ohne Rückfrage und ohne Rückgängig. Der eingetragene Name ist weg (7 auf 6 Zeilen, `g11-teilnehmerliste.png`).
  - Ein selbst eingetragenes individuelles Lösungswort („FUNKE“) war nach dem Wechsel auf „Keine Lösungswörter“ und zurück durch ein Zufallswort ersetzt („DIGITALFUNK“).
  - Positiv: Ein Wechsel der Quelle (Vorlagen, Szenario, Vorlagen) lässt die Teilnehmerliste unverändert.
- **Erwartung der Rolle:** Eine kurze Rücknahme nach dem Löschen einer Zeile. Ein Hin- und Herschalten verwirft keine eigenen Eingaben.
- **Auswirkung:** Die Daten müssen neu eingetippt werden. Das kostet Zeit, gefährdet aber nichts.
- **Empfehlung:** Nach dem Löschen einer Zeile kurz „Rückgängig“ anbieten. Eigene Lösungswörter beim Umschalten merken.
- **Verifikation:** Zeile löschen und wiederherstellen. Lösungswort eintragen, zweimal die Option wechseln, das Wort steht noch da.

## Positiv beobachtet (nicht ändern)
- Ein Doppelklick auf „Übung generieren“ erzeugt genau eine Übung (geprüft im Mock-Speicher).
- Beim Neugenerieren bleiben Übungs-ID, Übungscode und die Codes und Funksprüche unveränderter Teilnehmer gleich.
- Teilnehmer: Der Status übersteht ein Neuladen, ein Doppeltipp hebt sich auf, und das Code-Formular meldet einen Zahlendreher klar, ohne die Eingaben zu verwerfen.
- Übungsleitung: Ein falsches „✓ abgesetzt“ lässt sich per ↺ einzeln zurücknehmen. Der globale Reset fragt vorher mit einem klaren Hinweis auf die Wirkung bei allen Beteiligten.

## Abschluss

- **Aufgabe geschafft:** mit Umwegen
- **Fremde Hilfe nötig:** nein bei den meisten Fehlern. Bei falschem Teilnehmerlink oder verlorener Ergebnisseite muss die Übungsleitung Links bzw. Codes erneut herausgeben oder über die Admin-Liste suchen.
- **Größtes Missverständnis:** Eine Übungsleitungsseite mit falscher ID sieht aus wie eine leere, noch ladende Übung und nicht wie ein Fehler.
- **Größtes Einsatzrisiko:** Eine versehentlich gesetzte Anmeldung lässt sich in der Übungsleitung nur durch Löschen des gesamten Übungsstands korrigieren, also bleibt der falsche Status stehen.
- **Top-Priorität für die nächste Iteration:** Für jede einzelne Statusaktion in der Übungsleitung (insbesondere „Anmelden“) eine Rücknahme schaffen, und Sackgassen-Seiten (falsche ID, falscher Teilnehmercode) immer mit einem Weiter-Weg versehen.
