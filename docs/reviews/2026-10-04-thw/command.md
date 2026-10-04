# THW Command Reviewer – Übungsleitung als Führungsstelle

Datum: 2026-10-04 · Reviewer: `command` (Skill `thw-command-reviewer`)
Build: lokal unter `http://127.0.0.1:3000`, Mock-Firestore (`useFirestoreEmulator=1`, `e2eFirestoreSeed`)
Screenshots: `/tmp/claude-0/-home-user-sprechfunk-uebung/8e81b214-a84b-574f-81cf-240dddbe65b9/scratchpad/command/` (nicht eingecheckt)

## Rolle und Prüfumfang

Geprüft aus der Sicht einer Führungskraft, die die Übung leitet: Am Dienstabend sitzt sie an der
Übungsleitung (Desktop), behält den Fortschritt aller Teilnehmer im Blick, erkennt Verzug
und kann den Stand notfalls an eine zweite Person übergeben. Bei der
Führungsstellen-Übung spielt sie nach Drehbuch ein. Die App ist ein **Ausbildungswerkzeug**,
kein Echteinsatz-System. Die Prioritäten unten beziehen sich deshalb auf den Übungsablauf
(Übung läuft aus dem Ruder, Auswertung wird falsch) und nicht auf Gefahren im Einsatz.

Real durchgespielt (Playwright, Chromium, 1440×900 und 412×915):

1. Generator, klassisch, 7 Teilnehmer, individuelle Lösungswörter → Links (`01`, `02`)
2. Teilnehmer 21/11 meldet zwei Nachrichten als übertragen (`03`)
3. Übungsleitung `#/uebungsleitung/<id>`: zwei Teilnehmer angemeldet, viermal „✓ abgesetzt“,
   Reload, zweiter Tab (`04`, `05`, `05b`)
4. X-Zeit-Übung (Intervall 1 min), Basis 10 min in die Vergangenheit gesetzt (`07`, `08`, `20`, `21`)
5. Führungsstellen-Übung „hochwasser-fuehrungsstelle“, Beginn 09:00, Cockpit gestartet,
   Senderfilter auf den Stab (`09`–`11`, `22`–`25`), mobil (`26`, `27`)
6. Admin `#/admin` (`12`)
7. „Lokale Übungsdaten zurücksetzen“ ausgelöst und im Dialog abgebrochen

Nicht prüfbar: echtes Firestore-Live-Sync zwischen zwei Geräten. Im Mock teilen sich beide
Tabs dasselbe `localStorage`. PDF-Inhalte (Übungsleitung-PDF, Debrief, Drehbuch) habe ich
nicht geöffnet.

## Urteil aus Sicht der Rolle

Die Übungsleitung funktioniert als **Abhakliste**. Stammdaten, Teilnehmer, Nachrichtenplan,
„✓ abgesetzt“ und Rückgängig sind ohne Hilfe bedienbar. Der Stand übersteht einen Reload.
Die Unterscheidung „OFFEN / GEMELDET (nur vom Teilnehmer) / ABGESETZT“ samt Zähler
„(1 nur gemeldet)“ ist für die Rolle wertvoll. Das X-Zeit-Cockpit mit Uhrzeit, Laufzeit,
X-Zeit und „12 hinter Plan“ ist die beste Lageübersicht der App. Bei der
Führungsstellen-Übung zeigen die Plan-Zeilen Weg und Meldeart als Badge sowie die
Erwartung an die beübte Stelle. Das ist eine gute Einspielvorlage.

Die Reibung entsteht, sobald die Übung läuft. Die Seite ist eine einzige, rund 12.000 px
lange Liste (`05b`). Das Cockpit meldet „12 hinter Plan“, sagt aber nicht, **welche**
Nachrichten fällig oder überfällig sind. Alle offenen Zeilen sehen gleich aus. „Was ist als
Nächstes dran?“ beantwortet die Seite nicht, man muss scrollen und selbst rechnen. Anmeldung
und Fortschritt eines Teilnehmers werden an zwei Stellen unabhängig geführt und
widersprechen sich sichtbar. Die verdichteten Kennzahlen (Tempo, ETA, Heatmap, Timeline)
liefern bei wenigen Markierungen irreführende Werte oder liegen am Seitenende.

Aufgabe ohne fremde Hilfe erledigbar: ja. Unter dem Zeitdruck einer laufenden X-Zeit- oder
Führungsstellen-Übung geht das aber nur mit Umwegen.

## Befunde

### P1-1 – Fällige und überfällige Nachrichten sind im Plan nicht erkennbar (X-Zeit, Führungsstelle)

- **Fundstelle / Aufgabe:** `#/uebungsleitung/<id>` im X-Zeit-Modus, Cockpit plus Nachrichtenplan.
  Prüfen, was jetzt eingespielt werden muss.
- **Beobachtung:** Bei Basis X−10 min zeigt das Cockpit „X + 10 min“ und „12 hinter Plan“
  (`08`, `20`). Im Plan haben alle offenen Zeilen dieselbe Klasse `status-pending-row`. Das
  gilt für X+0 bis X+9 (überfällig), für X+10 (jetzt fällig) und für X+15 (Zukunft). Sie
  tragen dieselbe gelbe Randfarbe und dasselbe Badge „OFFEN“ (`21`). In der Spalte „Zeit“
  steht nur der Ist-Zeitpunkt nach dem Abhaken, keine Soll-Uhrzeit.
  Code: `src/uebungsleitung/UebungsleitungNachrichtenView.ts:327` (nur abgesetzt/pending),
  `:342` (Zeit = `erledigtUm`).
- **Erwartung der Rolle:** Auf einen Blick erkennen, was überfällig ist, was jetzt dran ist
  und was als Nächstes kommt. Am besten mit Soll-Uhrzeit (bei Beginn 09:00 also „09:03“
  statt „X+3“).
- **Auswirkung:** Die Übungsleitung muss X+n gegen die laufende X-Zeit im Kopf abgleichen
  und durch eine lange Liste scrollen. Einspielungen werden vergessen oder zu spät gespielt.
  Bei der Führungsstellen-Übung verfälscht das den Zeitdruck auf die beübte Stelle, also
  genau das, was geübt werden soll.
- **Empfehlung:** Offene Zeilen in drei sichtbar verschiedene Zustände teilen: überfällig,
  jetzt fällig (aktuelles Intervall) und später. Der Zustand muss auch ohne Farbe erkennbar
  sein, etwa als Text-Badge „überfällig 4 min“. Soll-Uhrzeit neben X+n anzeigen, sobald eine
  Basis gesetzt ist. Das Cockpit-Badge „12 hinter Plan“ sollte zur ersten überfälligen
  Zeile springen.
- **Verifikation:** Basis 10 min zurücksetzen. Die Zeilen X+0…X+9 müssen sich von X+10 und
  X+11… unterscheiden. Ein Klick auf das Plan-Badge scrollt zur ersten überfälligen Zeile.

### P1-2 – „Angemeldet“ und Anmeldungs-Funkspruch sind zwei getrennte Zustände und widersprechen sich

- **Fundstelle / Aufgabe:** Klassische Übung. Anmeldephase in der Teilnehmertabelle und im
  Nachrichtenplan.
- **Beobachtung:** Nach „✓ abgesetzt“ auf Nachricht 1 („Ich melde mich in Ihrem
  Sprechfunkverkehrskreis an“) von Heros Oldenburg 24/14 und 86/11 ist diese Zeile im Plan
  grün „ABGESETZT“ (`05`). In der Teilnehmertabelle stehen beide trotzdem weiter auf
  „Anmelden“ und „keine Meldung“. Umgekehrt ist 22/12 über die Tabelle angemeldet
  (Zeitstempel 041912oct26), zeigt in „Fortschritt“ aber „keine Meldung“. 21/11 dagegen
  hat zwei Meldungen vom Teilnehmergerät, war aber vor dem Klick „nicht angemeldet“ (`04`).
- **Erwartung der Rolle:** Eine Wahrheit pro Teilnehmer: angemeldet ja/nein, seit wann, und
  wie viele Nachrichten erledigt sind, egal ob über Tabelle, Plan oder Teilnehmergerät
  erfasst.
- **Auswirkung:** Die Leitung kann nicht sicher sagen, wer im Kreis ist. Bei einer Übergabe
  an eine zweite Person ist der Stand widersprüchlich. Der Debrief eines Teilnehmers zeigt
  womöglich „nicht angemeldet“, obwohl die Anmeldung gefunkt wurde (Annahme, PDF nicht
  geöffnet).
- **Empfehlung:** Die Anmeldung über die Tabelle und das Abhaken des Anmeldungs-Funkspruchs
  als denselben Vorgang behandeln oder zumindest gegenseitig anzeigen. „Fortschritt“ sollte
  auch von der Leitung abgesetzte Nachrichten zählen und dabei kennzeichnen, wer markiert hat.
- **Verifikation:** Anmeldungs-Funkspruch eines Teilnehmers abhaken. Die Tabellenzeile zeigt
  danach „angemeldet <Zeit>“ und Fortschritt ≥ 1. Das gilt auch umgekehrt.

### P1-3 – Die Lageübersicht ist eine Endlosliste ohne Zusammenfassung „offen je Teilnehmer / als Nächstes“

- **Fundstelle / Aufgabe:** Gesamte Seite `#/uebungsleitung/<id>`. Während der Übung
  schnell den Stand erfassen.
- **Beobachtung:** Stammdaten (Übungs-ID, Code usw.) belegen den ersten Bildschirm (`04`).
  Danach folgen die Teilnehmertabelle mit Lösungswort-, Stärke- und Notizfeldern und
  schließlich alle 70 Nachrichten als Zeilen mit je eigenem Notizfeld (`05b`, etwa
  12.300 px). Die Verdichtungen „Heatmap (5 Minuten)“ und „Timeline je Teilnehmer“ stehen
  ganz am Ende hinter der letzten Nachricht. Der Schalter „ausblenden“ für abgesetzte
  Nachrichten ist klein und sitzt im Spaltenkopf. Er ist standardmäßig aus.
- **Erwartung der Rolle:** Oben eine knappe Lagezeile: je Teilnehmer erledigt/offen, wer
  hängt, nächste fällige Nachricht. Details erst bei Bedarf.
- **Auswirkung:** Um eine Lagefrage zu beantworten („wer ist noch nicht dran gewesen?“),
  muss man scrollen und Filter bedienen. In der laufenden Übung kostet das die Aufmerksamkeit,
  die eigentlich dem Funkverkehr gilt.
- **Empfehlung:** Stammdaten einklappbar machen oder verkleinern. Erledigte Nachrichten
  standardmäßig ausblenden bzw. einklappen. Heatmap und Timeline oberhalb des Plans oder in
  eine eigene Ansicht verschieben. Notizfelder pro Zeile erst auf Klick zeigen.
- **Verifikation:** Bei 1440×900 sind Cockpit/Fortschritt, der Stand je Teilnehmer und die
  nächsten fälligen Nachrichten ohne Scrollen sichtbar.

### P2-1 – Tempo und ETA sind bei wenigen Markierungen irreführend und ohne Hinweis auf ihre Grundlage

- **Fundstelle:** Kopf „Nachrichtenplan“ (`05`): „5 / 70 · ETA: 041915oct26 (Rest: 3 min) ·
  Tempo: 22,8 N/min“.
- **Beobachtung:** Nach vier schnellen Klicks innerhalb weniger Sekunden rechnet die App für
  65 offene Nachrichten mit 3 Minuten Rest. Grundlage ist der mittlere Abstand zwischen
  erster und letzter Markierung (`src/uebungsleitung/index.ts`, `calculateEtaLabel`), ohne
  Mindeststichprobe.
- **Erwartung der Rolle:** Eine Schätzung erst dann, wenn sie belastbar ist, oder mit dem
  Hinweis „Schätzung aus n Nachrichten“.
- **Auswirkung:** Die Leitung plant das Ende des Dienstabends oder eine Pause auf eine falsche
  Zahl hin. Nachgetragene Sammelmarkierungen verzerren das Tempo dauerhaft.
- **Empfehlung:** ETA erst ab einer Mindestzahl und Mindestdauer zeigen und die Basis nennen.
  Im X-Zeit-Modus ist der Plan (Intervall) die bessere Grundlage für das Ende.
- **Verifikation:** Vier Nachrichten in 5 s abhaken. Es erscheint keine ETA bzw. eine ETA mit
  dem Hinweis „zu wenig Daten“.

### P2-2 – Führungsstellen-Übung: beübte Stelle und Einspieler sind in der Teilnehmertabelle gleichrangig

- **Fundstelle:** `#/uebungsleitung/<id>` einer Führungsstellen-Übung (`23`).
- **Beobachtung:** „Einsatzleitung / Heros Musterstadt 10“ (die beübte Stelle, ohne
  Teilnehmerlink laut Generator `10`) steht mit Teilnehmercode, „keine Meldung“ und
  „Anmelden“ genauso in der Liste wie die Abschnitte und der Führungsstab, die von der
  Übungsleitung gespielt werden. Der Plan kennt nur „OFFEN / abgesetzt“. Ob die erwartete
  Reaktion der beübten Stelle kam, lässt sich nur im freien Notizfeld festhalten.
- **Erwartung der Rolle:** Klar getrennt: wer beübt wird und wer einspielt. Pro Einspielung
  neben „eingespielt“ auch „Reaktion erfolgt / ausstehend / abweichend“, denn das ist der
  eigentliche Prüfgegenstand.
- **Auswirkung:** Für die Auswertung fehlt ein strukturierter Soll-Ist-Vergleich. Was die
  beübte Stelle nicht erledigt hat, findet sich nur in Freitexten. Die Leitung kann die
  beübte Stelle versehentlich „anmelden“ oder ihr einen Code weitergeben (Annahme).
- **Empfehlung:** Beübte Stelle als eigene Rolle oben hervorheben, ohne Code/Anmelden.
  Eine optionale Bewertung der „Erwartung“ je Einspielung anbieten, die in den Debrief
  übernommen wird.
- **Verifikation:** Führungsstellen-Übung erzeugen. Die beübte Stelle ist getrennt
  gekennzeichnet. Je Plan-Zeile lässt sich die Reaktion mit einem Klick bewerten.

### P2-3 – Übungsbeginn aus dem Generator kommt nicht im Cockpit an

- **Fundstelle:** Generator `#fuehrungsstelleBeginn` = 09:00 (`09`) → Cockpit der
  Übungsleitung.
- **Beobachtung:** Das Cockpit meldet „Noch keine X-Zeit-Basis – ‚Jetzt starten‘ oder auf
  Teilnehmer warten“ (erster Lauf). Der Plan zeigt nur X+n und keine Uhrzeiten. Der
  eingegebene Beginn wird nach dem Generator-Hinweis für „Uhrzeiten im Drehbuch“ verwendet,
  also für das PDF, aber nicht als Vorschlag für die Basis.
- **Erwartung der Rolle:** Wenn ich 09:00 als Beginn eingebe, schlägt mir die Übungsleitung
  09:00 als Basis vor und zeigt die Einspielzeiten als Uhrzeit.
- **Auswirkung:** Das Drehbuch-PDF hat Uhrzeiten, die Bildschirmansicht X+n. Wer nach PDF und
  Bildschirm parallel arbeitet, muss umrechnen. Ein vergessenes „Jetzt starten“ lässt Cockpit
  und Planvergleich leer.
- **Empfehlung:** Den Beginn als vorbelegte Basis anbieten, die aber noch ausdrücklich
  bestätigt werden muss. Soll-Uhrzeit im Plan zeigen (siehe P1-1).
- **Verifikation:** Beginn 09:00 erzeugen. Das Cockpit zeigt 09:00 als vorgeschlagene Basis,
  der Plan zeigt „09:01 (X+1)“.

### P2-4 – Die Nachrichtennummer ist nicht eindeutig

- **Fundstelle:** Spalte „Nr“ im Nachrichtenplan (`05`, `24`, mobil `27`).
- **Beobachtung:** „Nr“ ist die laufende Nummer **je Sender**. In der klassischen Übung
  stehen sieben Zeilen mit „1“ untereinander, bei der Führungsstellen-Übung ebenfalls
  mehrfach „1“, „2“. Mobil erscheint durch die Szenario-Sortierung „11“ vor „10“ (`27`).
- **Erwartung der Rolle:** Eine eindeutige Nummer, mit der sich zwei Leitungsplätze oder
  Leitung und Teilnehmer auf eine Nachricht beziehen können („Nummer 23 nachholen“).
- **Auswirkung:** Verwechslungsgefahr bei Absprachen und in der Nachbesprechung. Eine Nummer
  allein identifiziert keine Nachricht.
- **Empfehlung:** Eine fortlaufende Plan-Nummer anzeigen und die Absendernummer nur zusätzlich
  (z. B. „23 · 21/11-3“).
- **Verifikation:** Jede Plan-Zeile trägt eine eindeutige Nummer, die auch im PDF erscheint.

### P2-5 – „Lokale Übungsdaten zurücksetzen“ wirkt laut Dialog für alle Geräte

- **Fundstelle:** Button `#resetUebungsleitungLocalData`, rot, gleich groß neben den
  PDF-Exporten (`04`).
- **Beobachtung:** Die Beschriftung sagt „Lokale …“. Der Bestätigungsdialog (`src/uebungsleitung/index.ts:816`)
  lautet im Live-Modus: „Wirklich alle Daten der Übungsleitung zurücksetzen? Das wirkt auch
  für Teilnehmer und weitere Leitungs-Arbeitsplätze.“
- **Erwartung der Rolle:** Die Beschriftung sagt, was passiert. Eine Aktion, die den
  gemeinsamen Übungsstand löscht, steht nicht neben dem Export.
- **Auswirkung:** Der Stand aller Leitungsplätze und Teilnehmer geht verloren, sobald
  jemand den Dialog nur überfliegt. Die Nachvollziehbarkeit für die Nachbesprechung ist
  dann weg.
- **Empfehlung:** Beschriftung an die tatsächliche Wirkung anpassen. Die Aktion von den
  Exporten absetzen. Vorher einen Export des Stands anbieten.
- **Verifikation:** Die Beschriftung nennt die Reichweite. Der Button steht nicht in der
  Exportzeile.

### P2-6 – Übungsleitung auf dem Smartphone ist abgeschnitten

- **Fundstelle:** `#/uebungsleitung/<id>` bei 412×915 (`27`).
- **Beobachtung:** Die Plan-Tabelle läuft horizontal über. Nachrichtentext, Erwartung und
  Notiz sind am rechten Rand abgeschnitten. Status und „✓ abgesetzt“ liegen außerhalb des
  sichtbaren Bereichs.
- **Erwartung der Rolle:** Wer als zweite Leitung mit dem Handy durch den Raum geht, kann
  zumindest abhaken und den Stand sehen.
- **Auswirkung:** Die Übungsleitung ist praktisch an den Laptop gebunden. Annahme: Das
  entspricht oft dem Dienstabend-Ablauf, daher nur P2.
- **Empfehlung:** Plan mobil als Karten oder mit Status/Abhaken links anzeigen.
- **Verifikation:** Bei 412 px Breite ist „✓ abgesetzt“ jeder Zeile ohne seitliches Scrollen
  erreichbar.

### P3-1 – Herkunft und Zeitpunkt einer Statusänderung nur teilweise sichtbar

- **Fundstelle:** Statuszelle im Plan (`05`).
- **Beobachtung:** Bei „GEMELDET“ steht „Teilnehmer: 041912oct26“. Das ist gut. Bei
  „ABGESETZT“ fehlt die Angabe, wer markiert hat (Leitung, welcher Platz, oder Teilnehmer
  mit Bestätigung). Die Spalte „Zeit“ zeigt nur den früheren der Zeitpunkte.
- **Empfehlung:** Herkunft auch bei „ABGESETZT“ kurz angeben (z. B. „Leitung 19:12 /
  TN 19:11“).
- **Verifikation:** Jede erledigte Zeile zeigt Quelle und Uhrzeit.

### P3-2 – Kopfbereich: technische Kennungen vor Lageinformation

- **Fundstelle:** Karte „Übungsüberwachung“ (`04`).
- **Beobachtung:** Die Übungs-ID (UUID) und das DTG „040000oct26“ als Datum belegen Platz
  oberhalb jeder Lageinformation. Der Übungscode ist wichtig (für Nachzügler), die UUID
  braucht im Ablauf niemand.
- **Empfehlung:** UUID nach hinten oder in den Export verschieben, Kopf auf eine Zeile
  verdichten.

### P3-3 – Admin-Liste ohne Stand der Übungen

- **Fundstelle:** `#/admin` (`12`).
- **Beobachtung:** Die Liste zeigt Erstellung, Name, Datum, Rufgruppe, Leitung, Anzahl,
  Modus und Quelle. Ob eine Übung gelaufen, angefangen oder abgeschlossen ist, steht dort
  nicht.
- **Empfehlung:** Optional Fortschritt bzw. letzte Aktivität anzeigen, um alte, nie
  gelaufene Übungen zu erkennen. Für die Führungsrolle von geringer Bedeutung.

## Was gut funktioniert (beibehalten)

- Dreistufiger Status OFFEN / GEMELDET / ABGESETZT, dazu „(n nur gemeldet)“ im Kopf, so dass
  unbestätigte Teilnehmermeldungen erkennbar sind.
- X-Zeit-Cockpit mit großer Uhrzeit, Laufzeit, X-Zeit und Planvergleich („12 hinter Plan“ /
  „im Plan“). Die Basis zeigt, wer sie gesetzt hat.
- Führungsstellen-Plan mit Badges für Weg und Meldeart sowie der Zeile „Erwartet: …“. Das
  ist eine starke Einspielhilfe, und mit dem Filter „Sender = Stab“ hat man eine
  Rollenkarte am Bildschirm (`25`).
- Der Stand übersteht einen Reload. Ein zweiter Tab zeigt denselben Fortschritt (im Mock
  geprüft, nicht über zwei Geräte).
- Rückgängig (↺) je Nachricht ohne Rückfrage, und das Zurücksetzen der ganzen Übung mit
  Rückfrage.

## Abschluss

- **Aufgabe geschafft:** mit Umwegen
- **Fremde Hilfe nötig:** nein
- **Größtes Missverständnis:** „Anmelden“ in der Teilnehmertabelle und der abgehakte
  Anmeldungs-Funkspruch im Plan sind zwei voneinander unabhängige Zustände. Ein Teilnehmer
  kann gleichzeitig „angemeldet“ und „nicht angemeldet“ aussehen.
- **Größtes Einsatzrisiko:** In der X-Zeit- und Führungsstellen-Übung meldet das Cockpit
  Verzug, der Plan zeigt aber nicht, welche Einspielungen überfällig sind. Einspielungen
  gehen dann verloren oder kommen zu spät, und der geübte Zeitdruck stimmt nicht.
- **Top-Priorität für die nächste Iteration:** Offene Plan-Zeilen nach überfällig / jetzt
  fällig / später unterscheiden und mit Soll-Uhrzeit anzeigen, dazu ein Sprung vom
  Cockpit-Badge zur ersten überfälligen Zeile.
