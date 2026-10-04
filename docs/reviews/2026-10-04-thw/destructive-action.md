# THW-Review: Folgenschwere Bedienhandlungen (destructive-action)

Datum: 2026-10-04 · Perspektive: praktisch-technischer THW-Helfer, der zügig arbeitet und dabei versehentlich etwas Folgenschweres auslösen könnte · Methode: Skill `thw-destructive-action-reviewer`

Geprüft am laufenden Build (`http://127.0.0.1:3000`, Mock-Modus, kein echtes Firebase) mit Playwright: Generator (Desktop 1440×1000), Teilnehmer (Pixel 7), Übungsleitung (Desktop), Admin (Desktop). Alle Dialogtexte wurden mitgeschnitten. Screenshots liegen im Scratchpad der Sitzung unter `destructive-action/01…15-*.png`; die Dateinamen stehen bei den Befunden.

Einordnung: Die App ist ein Ausbildungswerkzeug für Dienstabend und Ausbildung, kein Echteinsatzsystem. „Einsatzrisiko“ heißt hier: Eine laufende oder vorbereitete Übung wird kaputt gemacht, Teilnehmer arbeiten mit falschen Unterlagen, oder die Übungsleitung verliert ihre Mitschrift.

## Urteil aus Sicht der Rolle

Die meisten folgenschweren Aktionen sind abgesichert: Neu generieren, Übung löschen, Teilnehmer-Reset und Leitungs-Reset fragen alle nach, und die Dialoge zu den beiden Resets sagen sogar, dass sie auch auf andere Geräte wirken. Abbrechen funktioniert jedes Mal. Ein Doppeltipp auf den Status-Chip in der Teilnehmeransicht schaltet zweimal um und landet wieder beim Ausgangszustand. Das ist harmlos.

Es hakt an drei Stellen. Die **Beschriftungen der Reset-Schaltflächen sagen „lokal“**, obwohl sie bei aktivem Live-Sync die Daten aller Beteiligten zurücksetzen. Ein **erneutes Generieren einer bestehenden Übung** überschreibt sie unter derselben ID, demselben Übungscode und denselben Teilnehmercodes. Bereits verteilte Links und ausgedruckte Vordrucke passen danach nicht mehr dazu, und nichts warnt davor. Außerdem **löscht der Admin-Bereich Übungen dauerhaft**: Die Rückfrage nennt die Übung nicht, ein Undo gibt es nicht, und eine Erfolgsmeldung erscheint auch nicht. Keine dieser Aktionen lässt sich rückgängig machen.

Alle Aufgaben lassen sich ohne fremde Hilfe erledigen. Das Risiko ist nicht, dass etwas nicht klappt, sondern dass eine Aktion mehr bewirkt, als ihre Beschriftung erwarten lässt.

## Befunde

### P0-1 – „Lokale Daten löschen“ / „Lokale Übungsdaten zurücksetzen“ wirken auf alle Beteiligten

- **Fundstelle / Aufgabe:** Teilnehmeransicht mobil, Schaltfläche `#btn-reset-teilnehmer-data` („⟲ Lokale Daten löschen“, Screenshot `06-teilnehmer-reset-button.png`); Übungsleitung, Schaltfläche `#resetUebungsleitungLocalData` („⟲ Lokale Übungsdaten zurücksetzen“, `09-uebungsleitung-reset-button.png`). Code: `src/teilnehmer/TeilnehmerView.ts:171-172`, `src/uebungsleitung/UebungsleitungView.ts:213-218`, Logik in `src/teilnehmer/index.ts:370-412` und `src/uebungsleitung/index.ts:816-860`.
- **Beobachtung:** Bei aktivem Sync („Sync: live“ bzw. „Live-Status: live“) erscheinen erst nach dem Klick die Dialoge „Möchten Sie wirklich Ihren Übertragungsstatus … zurücksetzen? Das wirkt auch für die Übungsleitung und Ihre anderen Geräte.“ und „Wirklich alle Daten der Übungsleitung zurücksetzen? Das wirkt auch für Teilnehmer und weitere Leitungs-Arbeitsplätze.“ Nach dem Bestätigen standen beim Teilnehmer alle Nachrichten wieder auf „OFFEN“. Der Leitungs-Reset schreibt Rücksetz-Marker für alle Nachrichten, alle Notizen und den Anmeldestatus aller Teilnehmer in den gemeinsamen Live-Status. Die Beschriftung der Schaltfläche spricht trotzdem nur von „lokal“. Auf dem Smartphone steht die Teilnehmer-Schaltfläche gleich groß und direkt neben „ZIP herunterladen“ im Kopf.
- **Erwartung der Rolle:** „Lokal“ heißt für einen Helfer „nur auf diesem Gerät, z. B. wenn die Ansicht hängt“. Er würde den Knopf als harmlosen Reparaturknopf benutzen.
- **Auswirkung im Einsatz:** Eine zweite Leitungsperson am Laptop will „nur ihre Ansicht aufräumen“ und löscht mitten in der Übung die gesamte Mitschrift der Übungsleitung: Abgesetzt-Status, Zeitstempel, Notizen und Anmeldungen. Danach lässt sich nicht mehr nachvollziehen, welche Sprüche gelaufen sind, und die Nachbesprechung (Debrief-PDF, Übungsleitungs-PDF) bricht weg. Die Dialogwarnung steht zwar da, aber nur in einem reflexartig wegklickbaren Browser-`confirm` und im Widerspruch zur Beschriftung.
- **Empfehlung:** Die Beschriftung muss die tatsächliche Reichweite nennen, je nach Sync-Zustand. Bei Live-Sync etwa „Übung für alle zurücksetzen“, ohne Sync „Daten auf diesem Gerät löschen“. Wenn der Knopf nur reparieren soll, bräuchte es zusätzlich einen wirklich lokalen Weg („Ansicht neu laden / Gerät neu verbinden“), der nichts überschreibt. Den alle-betreffenden Reset räumlich von Export-Knöpfen trennen, z. B. in einen eigenen „Gefahrenbereich“ am Seitenende. Die Bestätigung sollte konkret beziffern, was verloren geht („12 abgesetzte Nachrichten, 3 Notizen, 2 Anmeldungen“), und eine bewusste Zusatzhandlung verlangen, etwa das Eintippen des Übungscodes.
- **Verifikation:** Bei aktivem Live-Status zeigt die Schaltfläche einen anderen Text als ohne. Ein Test-Helfer, der gebeten wird, „nur seine Ansicht zurückzusetzen“, löst den gemeinsamen Reset nicht aus.

### P0-2 – Erneutes Generieren überschreibt eine verteilte Übung unter gleichen Codes

- **Fundstelle / Aufgabe:** Generator mit bestehender Übung `#/generator/<id>` (der Weg führt über die Lupe im Admin, den Übungs-Link im Ergebnis oder einfach den noch offenen Generator-Tab). Schaltfläche `#startUebungBtn` („Übung generieren“). Screenshots `03-generator-ergebnis.png`, `10-generator-bestehende-uebung.png`, `11-generator-nach-ueberschreiben.png`. Code: `src/generator/index.ts:366-403`, `src/services/FirebaseService.ts:576-606` (`setDoc` auf dieselbe ID).
- **Beobachtung:** Nach dem Generieren bleibt „Übung generieren“ direkt unter dem Ergebnis sichtbar. Ein zweiter Klick zeigt nur „Übung neu generieren? Bestehende Nachrichten gehen verloren.“ Nach dem Bestätigen hatte das gespeicherte Dokument dieselbe ID, denselben Übungscode (`765RLH`) und dieselben Teilnehmercodes (`tc=ABE8`), aber einen anderen Nachrichteninhalt (Prüfsumme der Nachrichten vorher ≠ nachher) und ein neues `createDate`. Die geladene Bestandsübung sieht aus wie ein leeres Formular für eine neue Übung (`10-…`). Ein Hinweis wie „Diese Übung ist bereits verteilt“ fehlt.
- **Erwartung der Rolle:** Wer eine Übung „nur noch mal anschauen“ oder „eine Kleinigkeit ändern“ will, erwartet entweder eine Kopie oder eine deutliche Warnung, dass ausgegebene Unterlagen ungültig werden. Der Satz „Bestehende Nachrichten gehen verloren“ klingt eher nach dem eigenen Entwurf.
- **Auswirkung im Einsatz:** Die Teilnehmer haben ausgedruckte Nachrichtenvordrucke oder geöffnete Links, und die Übungsleitung hat ihr PDF. Nach dem Neu-Generieren laufen dieselben Links mit anderen Funksprüchen. Lösungswörter und Stärken passen nicht mehr zum Ausdruck, und der Live-Status hängt an Nachrichtennummern, deren Inhalt sich geändert hat. Der Dienstabend läuft gegen widersprüchliche Unterlagen, und der Fehler fällt erst am Funkgerät auf. Die alte Fassung lässt sich nicht wiederherstellen.
- **Empfehlung:** Eine geladene, bereits gespeicherte Übung sichtbar als solche kennzeichnen (Name, Erstelldatum, „bereits verteilt: Links/PDFs im Umlauf“). Standardaktion dort: „Als neue Übung kopieren“ mit neuer ID und neuen Codes. Überschreiben nur als bewusst abgesetzte Zweitaktion mit konkretem Text: „Alle ausgegebenen Links und Ausdrucke dieser Übung passen danach nicht mehr. Teilnehmer müssen neue Unterlagen bekommen.“ Nach erfolgreichem Generieren den Knopf umbenennen, etwa in „Neu würfeln (ersetzt Ergebnis oben)“, oder aus dem Blickfeld nehmen.
- **Verifikation:** Öffnet man `#/generator/<id>` und klickt den Hauptknopf, entsteht eine neue ID und die alte bleibt unverändert. Das Überschreiben ist nur über einen zweiten, explizit beschrifteten Weg möglich.

### P1-1 – Löschen im Admin: unspezifische Rückfrage, keine Wiederherstellung, keine Rückmeldung

- **Fundstelle / Aufgabe:** `#/admin`, Übungsliste, roter Mülleimer `button[data-action='delete']` (`12-admin.png`, `13-admin-nach-loeschen.png`). Code: `src/admin/AdminView.ts:69-71`, `src/admin/index.ts:153-172`.
- **Beobachtung:** Der Lösch-Knopf ist ein reines Icon ohne `title` und ohne `aria-label`. Die beiden Nachbarn „Übung öffnen“ und „Übung überwachen“ haben einen Tooltip. Alle drei Icons sind gleich groß (ca. 37×30 px) und stehen ohne Abstand nebeneinander. Die Rückfrage lautet nur „Möchtest du diese Übung wirklich löschen?“, ohne Namen, Datum oder Teilnehmerzahl. Nach dem Bestätigen verschwindet die Zeile kommentarlos, ohne Erfolgsmeldung und ohne Undo. Danach zeigte der Teilnehmer-Link auf einem Gerät ohne Zwischenspeicher nur „Übung nicht gefunden.“ (`15-…`). Laut `firestore.rules`/CLAUDE.md darf jeder anonym löschen; der Admin-Bereich hat keinen Zugangsschutz.
- **Erwartung der Rolle:** Vor dem endgültigen Löschen will man sehen, *welche* Übung gemeint ist, besonders in einer langen, gemischten Liste. Ein Fehlklick in der Zeile daneben (Lupe/Monitor) soll nicht zum Löschen führen.
- **Auswirkung im Einsatz:** Wer beim Aufräumen die falsche Zeile erwischt, löscht womöglich die Übung für den heutigen Abend, auch die eines anderen Ortsverbands. Teilnehmer-Links und die Übungsleitung zeigen dann „Übung nicht gefunden“, und eine Wiederherstellung gibt es nicht.
- **Empfehlung:** Die Bestätigung muss die Übung nennen (Name, Datum, Rufgruppe, Teilnehmerzahl, ob sie heute oder in Zukunft stattfindet) und sagen: „Alle Teilnehmer- und Leitungs-Links funktionieren danach nicht mehr. Nicht rückgängig zu machen.“ Den Lösch-Knopf mit Abstand von den harmlosen Aktionen absetzen und beschriften. Nach dem Löschen eine sichtbare Rückmeldung zeigen, idealerweise mit kurzem „Rückgängig“ (verzögertes Löschen oder Papierkorb). Bei Übungen mit Datum heute oder in der Zukunft zusätzlich warnen.
- **Verifikation:** Der Dialogtext enthält den Übungsnamen. Ein Testnutzer kann innerhalb einiger Sekunden nach dem Löschen rückgängig machen. Der Screenreader liest den Knopf als „Übung … löschen“ vor.

### P1-2 – Einzel-Rücksetzen eines Nachrichtenstatus ohne Rückfrage und ohne Undo, direkt neben dem Status

- **Fundstelle / Aufgabe:** Übungsleitung → Nachrichtenplan, Knopf „↺“ (`button[data-action='reset']`, nur `title="Status zurücksetzen"`), `08-uebungsleitung-nachrichten.png`. Code: `src/uebungsleitung/UebungsleitungNachrichtenView.ts:357-362`, `src/uebungsleitung/index.ts:749-761`.
- **Beobachtung:** Ein Klick auf ↺ setzt „abgesetzt“ sofort wieder auf „offen“ und löscht dabei den Abgesetzt-Zeitstempel, ohne Rückfrage (mitgeschnitten: kein Dialog). Bei Live-Sync gilt das für alle Leitungs-Arbeitsplätze. Der Knopf erscheint an genau der Stelle, an der vorher „✓ abgesetzt“ stand, ist klein und nur mit einem Symbol beschriftet.
- **Erwartung der Rolle:** Ein versehentlicher Doppelklick auf „abgesetzt“ soll nicht dazu führen, dass der Status gleich wieder verschwindet. Wird er doch zurückgenommen, will man den ursprünglichen Zeitpunkt wiederbekommen.
- **Auswirkung im Einsatz:** Beim schnellen Abhaken während laufenden Funkverkehrs (Zeitdruck, viele Zeilen) kann ein zweiter Klick auf dieselbe Stelle das Abhaken zurücknehmen. Die ursprüngliche Absetzzeit ist dann weg, und Fortschritt, ETA und das spätere Übungsleitungs-PDF stimmen nicht. Im Test traf der zweite Klick zufällig die nächste Zeile, weil sich die Spalte verschiebt, aber die Lage beider Knöpfe macht den Fehlgriff plausibel. Wegen des Ausbildungscharakters ist der Schaden begrenzt, deshalb P1 und nicht P0.
- **Empfehlung:** ↺ nicht an die Stelle des gerade gedrückten Knopfs setzen, sondern etwas abgesetzt und mit Text („zurücknehmen“). Statt einer Rückfrage lieber ein kurzes Undo-Banner („Status von Nr. 1 / Heros A 24/14 zurückgenommen – Rückgängig“), das den alten Zeitstempel wiederherstellt.
- **Verifikation:** Ein schneller Doppelklick auf „✓ abgesetzt“ ergibt dauerhaft „abgesetzt“. Ein versehentliches ↺ lässt sich mit einem Klick samt Originalzeit zurückholen.

### P2-1 – Anmeldung in der Übungsleitung nicht rücknehmbar

- **Fundstelle / Aufgabe:** Übungsleitung → Teilnehmer, Knopf „Anmelden“ (`07-uebungsleitung-oben.png`, `src/uebungsleitung/UebungsleitungTeilnehmerView.ts:346-355`).
- **Beobachtung:** Nach einem Klick wird „Anmelden“ zum grünen Zeitstempel-Badge. Einen Weg zurück gibt es in der Zeile nicht (gefundene Knöpfe danach: nur „Details“). Das Gegenteil hilft nur über den globalen Reset aus P0-1.
- **Erwartung der Rolle:** Wer in der falschen Zeile auf „Anmelden“ tippt (vier gleich aussehende Zeilen untereinander), will die Anmeldung zurücknehmen und beim richtigen Teilnehmer setzen.
- **Auswirkung im Einsatz:** Anmeldezeiten in Übersicht und PDF sind falsch. Die einzige Korrektur ist der Reset, der alles löscht, und der Fehlgriff verleitet damit genau zur gefährlichsten Aktion der Seite.
- **Empfehlung:** Am Badge eine kleine, eindeutig beschriftete Korrektur anbieten („Anmeldung zurücknehmen“), alternativ ein Undo-Banner wie in P1-2.
- **Verifikation:** Eine falsch gesetzte Anmeldung lässt sich ohne globalen Reset korrigieren.

### P2-2 – Teilnehmer im Generator ohne Rückfrage und ohne Undo entfernt

- **Fundstelle / Aufgabe:** Generator → Teilnehmerverwaltung, roter Mülleimer `.delete-teilnehmer` (`01-generator-setup.png`, `02-teilnehmer-entfernt.png`).
- **Beobachtung:** Ein Klick entfernt die Zeile sofort, ohne Rückfrage. Name, Stellenname und individuelles Lösungswort sind weg. Der Mülleimer steht direkt rechts neben dem Lösungswort-Feld.
- **Erwartung der Rolle:** Beim Vorbereiten ist das vertretbar, nur das Wiederherstellen eines versehentlich gelöschten Eintrags erwartet man.
- **Auswirkung im Einsatz:** Gering, es geht ja um die Vorbereitung. Bei langen Listen mit gepflegten Funkrufnamen und Stellennamen kostet es aber Zeit und verleitet zu Tippfehlern beim Neueingeben.
- **Empfehlung:** Kurzes „Teilnehmer ‚Heros A 22/12‘ entfernt – Rückgängig“. Keine Rückfrage, das würde nur nerven.
- **Verifikation:** Ein versehentlich entfernter Teilnehmer ist mit einem Klick samt Lösungswort wieder da.

### P3-1 – Rückfragen sind Browser-Standarddialoge mit generischem Text

- **Fundstelle / Aufgabe:** Alle Bestätigungen laufen über `uiFeedback.confirm` → `globalThis.confirm` (`src/core/UiFeedback.ts:16-18`).
- **Beobachtung:** Die Dialoge sind die nativen „OK/Abbrechen“-Boxen. Die Teilnehmeransicht siezt („Möchten Sie …“), Admin und der Rest der App duzen. Die Schaltflächen heißen nicht nach der Folge („Für alle zurücksetzen“), sondern „OK“.
- **Erwartung der Rolle:** Ein Knopf, der sagt, was passiert. Ein „OK“ wird reflexartig gedrückt.
- **Auswirkung im Einsatz:** Das verstärkt P0-1, P0-2 und P1-1. Allein ist es geringfügig.
- **Empfehlung:** Eigene Bestätigungsdialoge mit handlungsbenannten Schaltflächen, einheitlicher Du-Form und dem destruktiven Knopf nicht als Vorauswahl.
- **Verifikation:** Kein destruktiver Dialog enthält mehr nur „OK“.

## Nicht prüfbar / Annahmen

- Echtes Firebase und mehrere Geräte gleichzeitig wurden nicht geprüft (Mock-Modus). Die Reichweite der Resets auf andere Geräte stammt aus dem Dialogtext und aus dem Code (`publishLeitungPublic`/`publishTeilnehmerStatus` mit Rücksetz-Markern), nicht aus einem beobachteten Zweitgerät.
- Ob ein bereits geöffneter Teilnehmer-Tab die neu generierten Nachrichten automatisch übernimmt oder die alten weiter zeigt, wurde nicht geprüft. Beides ist problematisch, nur jeweils anders.
- Annahme: Der Admin-Bereich wird in der Praxis von mehreren Ausbildern genutzt; der fehlende Zugriffsschutz ist laut CLAUDE.md eine bewusste Grenze. Bewertet wurde hier nur die Bedienung.

## Abschluss

- **Aufgabe geschafft:** ja (alle destruktiven Abläufe ließen sich auslösen und abbrechen)
- **Fremde Hilfe nötig:** nein
- **Größtes Missverständnis:** „Lokale Daten löschen“ bzw. „Lokale Übungsdaten zurücksetzen“ klingt nach diesem einen Gerät, setzt bei Live-Sync aber den Stand der ganzen Übung für alle zurück.
- **Größtes Einsatzrisiko:** Ein erneuter Klick auf „Übung generieren“ bei einer schon verteilten Übung tauscht unter denselben Links und Codes still die Funksprüche aus, und die Ausdrucke der Teilnehmer stimmen dann nicht mehr.
- **Top-Priorität für die nächste Iteration:** Die Reset-Schaltflächen nach ihrer tatsächlichen Reichweite beschriften und den alle betreffenden Reset mit konkreter Folgenangabe in einen abgesetzten Gefahrenbereich verlegen.
