Befunde: P0=0 P1=0 P2=1 P3=5
Abgleich: behoben=6 teilweise=1 offen=0 nicht-pruefbar=0

# THW Command Reviewer – Übungsleitung als Führungsstelle (dritter Lauf)

Datum: 2026-10-06 · Reviewer: `command` (Skill `thw-command-reviewer`)
Build: lokal unter `http://127.0.0.1:3000`, Mock-Firestore (`useFirestoreEmulator=1`, `e2eFirestoreSeed`)
Screenshots: `/tmp/claude-0/-home-user-sprechfunk-uebung/8e81b214-a84b-574f-81cf-240dddbe65b9/scratchpad/command3/` (nicht eingecheckt)

## Rolle und Prüfumfang

Ich prüfe aus der Sicht der Person, die die Übung leitet. Sie sitzt am Dienstabend am Laptop,
muss den Stand aller Funkstellen erfassen, Verzug erkennen, bei der Führungsstellen-Übung nach
Drehbuch einspielen und die Reaktion der beübten Stelle festhalten. Den Stand muss sie notfalls
an eine zweite Leitung übergeben können. Die App ist ein **Ausbildungswerkzeug**. Die
Prioritäten beziehen sich auf Übungsablauf und Auswertung, nicht auf Gefahren im Einsatz.

Real durchgespielt (Playwright, Chromium, 1440×900 und 412×915):

1. Klassische Übung, 5 Teilnehmer, 10 Sprüche je Teilnehmer (`01`). Teilnehmer 21/11 meldet am
   Smartphone zwei Nachrichten. Übungsleitung: Lage, Sammelbestätigung, Anmeldung über die
   Tabelle, Abhaken, Sprung „Als Nächstes“ (`02`–`04`), „Abgesetzte ausblenden“ mit Reload,
   Smartphone-Ansicht (`06`, `06b`).
2. X-Zeit-Übung, 4 Teilnehmer, Intervall 1 min, Basis 10 min in der Vergangenheit (`10`–`15`).
   Sprung „zur ersten“, dreimal „auslassen“. Zusätzlich eine kleine X-Zeit-Übung für
   „Teilnehmer einklappen“ mit Reload (`50`) und Smartphone-Karten (`51`, `52`).
3. Führungsstellen-Übung „hochwasser-fuehrungsstelle“, Beginn 20 min in der Vergangenheit.
   Vorschlag übernommen, Warndialog bestätigt (`40`). Vier Einspielungen abgesetzt, Reaktionen
   „erfolgt“ und „ausgeblieben“ vergeben (`41`, `42`), eine Einspielung ausgelassen (`43`).
   „Abgesetzte ausblenden“ ein- und ausgeschaltet, Reload. „Übungsleitung als PDF“
   heruntergeladen und gelesen (`ul.pdf`, `pdf-01`, `pdf-02`, `zoom-02`).
4. Admin `#/admin` (`30`).

Nicht prüfbar: Live-Sync über zwei echte Geräte, weil der Mock je Browser-Kontext einen eigenen
`localStorage` hat. Eine zweite Seite im selben Kontext zeigte denselben Stand mit Reaktionsbilanz.

## Urteil aus Sicht der Rolle

Die Übungsleitung ist jetzt ein brauchbares Lagebild. Oben steht das Cockpit mit Uhr, Laufzeit,
X-Zeit, Fortschritt und „n hinter Plan“. Darunter folgt die Lagezeile mit „offen“ je Funkstelle.
„Als Nächstes“ zeigt jetzt den ältesten Rückstand **und** die „jetzt fälligen“ Zeilen. Der Knopf
„9 überfällig, 2 jetzt fällig – zur ersten“ ergibt zusammen genau die Zahl im Cockpit
(„11 hinter Plan“). Bewusst übersprungene Einspielungen lassen sich mit „auslassen“
kennzeichnen und mit Rückgängig zurücknehmen. Sie stehen im Plan als „AUSGELASSEN“ und im PDF als
„Bewusst ausgelassen (nicht eingespielt)“. In der Führungsstellen-Übung bewertet man die
Reaktion je Einspielung mit einem Klick: erfolgt, abweichend oder ausgeblieben. Die Lagezeile fasst
das als „1 erfolgt · 1 ausgeblieben · 2 ausstehend (älteste ausstehend seit … min)“ zusammen.
Dieselbe Bilanz und die Reaktion je Zeile stehen im Übungsleitungs-PDF. Damit kann eine zweite
Leitung den Stand übernehmen. Am Smartphone zeigt der Plan Karten mit Nr, Sender, Empfänger,
Soll, Status und Aktion, ohne seitliches Scrollen.

Reibung bleibt an einer Stelle, die genau zur neuen Reaktionsbewertung gehört: Wer erledigte
Zeilen ausblendet, um sich auf das Einspielen zu konzentrieren, sieht die Zeilen mit
ausstehender Reaktion nicht mehr. Die Lagezeile zählt sie, führt aber nicht zu ihnen. Der Rest
sind Kleinigkeiten in Kennzahlen und im PDF.

Ohne fremde Hilfe erledigbar: **ja**.

## Befunde

### P2-1 – Ausstehende Reaktionen verschwinden mit „Abgesetzte ausblenden“, und die Lagezeile führt nicht zu ihnen

- **Fundstelle / Aufgabe:** Führungsstellen-Übung, `#/uebungsleitung/<id>`, Lagezeile
  `[data-testid='lage-reaktionen']` und Schalter `[data-action='lage-hide']`. Aufgabe: einspielen
  und die Reaktion bewerten, sobald sie kommt, oft erst Minuten später.
- **Beobachtung:** Nach vier Einspielungen und zwei Bewertungen zeigt die Lagezeile
  „Beübte Stelle – Reaktionen: 1 erfolgt · 1 ausgeblieben · 2 ausstehend“ (`42`). Nach
  „Abgesetzte ausblenden“ sind **0** Zeilen mit Reaktionsknöpfen sichtbar. Die Bilanz zählt aber
  weiter „2 ausstehend“. Die Bilanz ist reiner Text (`<strong>` plus `<span>`,
  `src/uebungsleitung/lageMarkup.ts:82-85`) und kein Sprungziel, anders als „n überfällig – zur
  ersten“. Die Ausblende-Einstellung gilt außerdem geräteweit: Die im ersten Durchlauf
  ausgeblendete Einstellung war in der danach geöffneten Führungsstellen-Übung sofort aktiv
  („Abgesetzte wieder zeigen · 0 ausgeblendet“). Jede abgesetzte Einspielung verschwand dort
  samt Reaktionsknöpfen, sobald sie abgehakt war.
- **Erwartung der Rolle:** „Ausblenden“ blendet nur aus, was wirklich fertig ist. Eine Einspielung
  mit offener Reaktion ist für die Leitung noch nicht fertig. Aus „2 ausstehend“ will ich wie beim
  Rückstand mit einem Klick zur ältesten ausstehenden Zeile springen.
- **Auswirkung:** Gerade wer konzentriert nach Drehbuch einspielt, blendet Erledigtes aus. Er
  bewertet die Reaktionen dann nicht mehr oder muss den Filter ausschalten und in einer langen
  Liste suchen. Am Ende bleiben viele Reaktionen „ausstehend“, und die Auswertung des
  eigentlichen Prüfgegenstands wird lückenhaft.
- **Empfehlung:** Zeilen mit ausstehender Reaktion beim Ausblenden sichtbar lassen oder als
  eigenen Zustand „wartet auf Reaktion“ führen. Die Bilanz in der Lagezeile als Sprung „2
  ausstehend – zur ältesten“ anbieten.
- **Verifikation:** Führungsstellen-Übung, drei Einspielungen absetzen, eine bewerten,
  „Abgesetzte ausblenden“ einschalten. Die zwei Zeilen ohne Bewertung bleiben sichtbar. Ein Klick
  auf die Bilanz springt zur älteren der beiden.

### P3-1 – Fortschritt zählt ausgelassene Einspielungen wie abgesetzte

- **Fundstelle:** Cockpit „Fortschritt“ und Lagezeile „n offen“ (X-Zeit, `13`).
- **Beobachtung:** Nach dreimal „auslassen“, ohne eine einzige abgesetzte Nachricht, zeigt das
  Cockpit „3/32“. Die Lagezeile zählt bei den betroffenen Funkstellen je eine weniger offen. In
  der Führungsstellen-Übung stand nach 4 abgesetzten und 1 ausgelassenen Einspielung
  „Fortschritt 5/73“. Im Plan und im PDF ist „ausgelassen“ sauber getrennt.
- **Empfehlung:** Ausgelassene im Fortschritt getrennt ausweisen, etwa „4/73 · 1 ausgelassen“,
  oder aus dem Zähler herausnehmen.
- **Verifikation:** Drei Zeilen auslassen. Der Fortschritt zeigt 0 abgesetzt und 3 ausgelassen
  getrennt.

### P3-2 – Übungsleitungs-PDF: Richtungspfeil „→“ erscheint als „!’“

- **Fundstelle:** „Übungsleitung als PDF“ der Führungsstellen-Übung, Spalte „Von“ ab Seite 2
  (`pdf-02`, `zoom-02`). Quelle: `src/pdf/uebungsleitungPlan.ts:95`
  (`` `${e.sender}\n→ …` ``). Das PDF nutzt die Standardschrift Helvetica/WinAnsi, die den Pfeil
  nicht enthält.
- **Beobachtung:** Jede Zeile lautet „Heros Musterstadt 21/10 / !’ Heros Musterstadt 10“.
- **Auswirkung:** Das PDF ist die ausdrückliche Papier-Rückfallebene („Ohne Netz läuft die Übung
  auf Papier weiter“). Die Richtung Sender → Empfänger ist dort nur durch Zeichensalat
  gekennzeichnet. Das ist lesbar, wirkt aber fehlerhaft und kostet beim Lesen Zeit.
- **Empfehlung:** Ein im PDF darstellbares Zeichen oder Wort verwenden („an“, „->“) und andere
  PDFs auf dasselbe Zeichen prüfen.
- **Verifikation:** PDF erzeugen. `pdftotext` und die Ansicht zeigen „an Heros Musterstadt 10“
  bzw. einen lesbaren Pfeil.

### P3-3 – „Tempo“ wird schon aus wenigen Sekunden hochgerechnet

- **Fundstelle:** Kennzahlenleiste über dem Nachrichtenplan (`41`, `06b`).
- **Beobachtung:** Nach vier Klicks innerhalb weniger Sekunden steht „Tempo: 84,3 Sprüche/min“,
  in der klassischen Übung „52,6 Sprüche/min“. Daneben steht korrekt „ETA: – (zu wenig Daten)“.
- **Empfehlung:** Für das Tempo dieselbe Mindeststichprobe wie für die ETA verwenden und bis dahin
  „–“ zeigen.
- **Verifikation:** Vier schnelle Markierungen. Das Tempo zeigt „–“, bis genug Daten vorliegen.

### P3-4 – Führungsstellen-Übung: „Anmeldung erhalten“ bei Rollen, die die Leitung selbst spielt

- **Fundstelle:** Teilnehmertabelle der Führungsstellen-Übung (`42`).
- **Beobachtung:** Bei den Einspielern (Einsatzabschnitte, Führungsstab) steht „Anmeldung
  erhalten“. Nachdem die Anmeldung von 21/10 (Plan-Nr. 1) als abgesetzt markiert war, stand der
  Knopf weiter da. In der klassischen Übung ist beides gekoppelt.
- **Annahme:** Die Einspieler werden hier von der Übungsleitung oder von Helfern mit eigenem
  Link gespielt. Bei der beübten Stelle zählt, ob sie die Anmeldung quittiert hat. Das deckt
  bereits die Reaktionsbewertung ab.
- **Empfehlung:** Den Knopf in der Führungsstellen-Übung erklären („Rollenspieler ist bereit“)
  oder an die abgesetzte Anmeldung koppeln.
- **Verifikation:** Anmeldungs-Einspielung eines Abschnitts absetzen. In der Tabelle steht
  danach ein eindeutiger Zustand statt eines unveränderten Knopfes.

### P3-5 – X-Zeit-Basis wird im 12-Stunden-Format angezeigt

- **Fundstelle:** Cockpit `#cockpitXZeitBasisInput` (`11`, `50`).
- **Beobachtung:** Trotz `lang="de-DE"` am Feld und deutscher Browser-Sprache im Test zeigt das
  Feld „06:13 AM“. Hinweistext und Plan verwenden 24 Stunden („Basis 06:13 …“).
- **Annahme:** Das Format hängt vom Betriebssystem bzw. vom Browser-Build ab. Auf deutsch
  eingestellten Geräten tritt es vermutlich nicht auf.
- **Empfehlung:** Den gesetzten Wert sichtbar in 24-Stunden-Form wiederholen (geschieht im
  Hinweis) oder ein Textfeld HH:MM verwenden.
- **Verifikation:** In einem englisch eingestellten Browser ist die Basis ohne „AM/PM“ lesbar.

## Was gut funktioniert (beibehalten)

- Cockpit und Lagezeile ergeben zusammen dieselbe Zahl: „11 hinter Plan“ = „9 überfällig,
  2 jetzt fällig“. „Als Nächstes“ zeigt den ältesten Rückstand und die jetzt fälligen Zeilen
  (`11`, `13`).
- „auslassen“ erscheint nur bei Zeilen, deren Soll-Zeit erreicht ist. Es meldet „… ausgelassen –
  zählt nicht mehr als überfällig“ und bietet Rückgängig an (`13`). „wieder öffnen“ steht in der
  Zeile (`43`).
- Reaktionsbewertung mit einem Klick, „Reaktion ausstehend seit n min“ je Zeile, Bilanz in der
  Lagezeile und im PDF auf Seite 1 sowie je Zeile („Reaktion (Ist) / Notiz“). Der Stand übersteht
  einen Reload (`41`, `42`, `pdf-01`, `pdf-02`).
- Übernahme eines zurückliegenden Beginns nur mit Warnung, die die Folge nennt („sind sofort
  9 Einspielungen überfällig – bei allen Rollen“). Danach kann man stattdessen „jetzt starten“.
- „Teilnehmer einklappen“ und „Abgesetzte ausblenden“ bleiben nach einem Reload erhalten. Mit
  eingeklappter Tabelle beginnt der Plan direkt unter der Lage (`50`).
- Smartphone: Karten mit „von … an …“, Soll-Uhrzeit, X+n, Status, Abhak-Knopf und „überfällig n min“,
  `scrollWidth` = 412 (`51`).
- Sammelbestätigung „n gemeldete bestätigen (mit Meldezeit des Teilnehmers)“ mit Erklärung, was
  „gemeldet“ bedeutet (`02`).

## Abschluss

- **Aufgabe geschafft:** ja
- **Fremde Hilfe nötig:** nein
- **Größtes Missverständnis:** „Abgesetzte ausblenden“ behandelt eine Einspielung als erledigt,
  obwohl ihre Reaktion noch zu bewerten ist.
- **Größtes Einsatzrisiko:** In der Führungsstellen-Übung bleiben Reaktionen unbewertet, weil die
  betroffenen Zeilen ausgeblendet sind. Die Auswertung des eigentlichen Übungsziels hat dann Lücken.
- **Top-Priorität für die nächste Iteration:** Zeilen mit ausstehender Reaktion beim Ausblenden
  sichtbar lassen und aus der Lagezeile „n ausstehend – zur ältesten“ anspringbar machen.

## Abgleich mit dem Lauf vom 2026-10-05

| Alte ID | Titel | Alte Prio | Status jetzt | Beleg aus dieser Prüfung |
|---|---|---|---|---|
| P2-1 | Reaktion der beübten Stelle nicht strukturiert erfassbar | P2 | behoben | Je abgesetzter Einspielung Knöpfe „erfolgt / abweichend / ausgeblieben“ und „Reaktion ausstehend seit 0 min“ (`41`). Lagezeile „1 erfolgt · 1 ausgeblieben · 2 ausstehend (älteste …)“ (`42`). Das PDF zeigt die Bilanz auf Seite 1 und je Zeile „wie erwartet erfolgt“ bzw. „ausgeblieben“ (`pdf-01`, `pdf-02`). Der Stand übersteht einen Reload. Neue Folgereibung siehe P2-1. |
| P2-2 | Keine Entscheidung „auslassen“, „Als Nächstes“ nur Rückstand | P2 | behoben | „auslassen“ an überfälligen und fälligen Zeilen. Nach drei Klicks sinkt „12 überfällig“ auf „9 überfällig“, und eine Rückgängig-Meldung erscheint (`13`). Zeile „AUSGELASSEN · wieder öffnen“ (`43`), im PDF „Bewusst ausgelassen“. „Als Nächstes“ enthält „Nr. 13 … 06:22 · jetzt fällig“ (`11`). |
| P2-3 | Smartphone: Abhaken möglich, Inhalt nicht sichtbar | P2 | behoben | 412 px: Karten mit „von Heros Oldenburg 21/11 an Heros Oldenburg 10“, Soll 06:21/X+0, Status, Abhak-Knopf, Text, ohne seitliches Scrollen (`06b`, `51`). |
| P3-1 | Zwei verschiedene Verzugszahlen | P3 | behoben | Cockpit „14 hinter Plan“, Lage „12 überfällig, 2 jetzt fällig – zur ersten“ (`11`). Die Summe stimmt und ist benannt. |
| P3-2 | Teilnehmertabelle trennt Lage und Plan | P3 | behoben | „Teilnehmer einklappen“ übersteht einen Reload („Teilnehmer zeigen“). Die erste Plan-Zeile beginnt bei y ≈ 883 px, direkt unter der Lage (`50`). Die Stärke-Einzelfelder liegen hinter „Einzelmeldungen“ (`02`). |
| P3-3 | „Abgesetzte ausblenden“ übersteht keinen Reload | P3 | behoben | Nach Ausblenden und Reload steht „Abgesetzte wieder zeigen“. Die Einstellung gilt sogar für die nächste Übung auf dem Gerät, Folge siehe P2-1. |
| P3-4 | X-Zeit-Basis im 12-Stunden-Format | P3 | teilweise | Das Feld hat jetzt `lang="de-DE"`, zeigt im Testbrowser aber weiter „06:13 AM“ (`11`, `50`). Der Hinweis wiederholt die Basis in 24-Stunden-Form. Siehe P3-5. |
