Befunde: P0=0 P1=1 P2=1 P3=5
Abgleich: behoben=7 teilweise=2 offen=0 nicht-pruefbar=0

# Night-Visibility-Audit, zweiter Lauf: Sprechfunk Übungsgenerator

**Datum:** 2026-10-05 · **Perspektive:** THW-Helfer, der das Display nachts (Fahrzeughalle, Unterkunft, im Freien unter Arbeitslicht) oder tagsüber im Sonnenlicht nutzt · **Themes:** Light und Dark (`localStorage.theme` bzw. System-Theme)

**Prüfumfang:** Lokaler Build unter `http://127.0.0.1:3000` im Mock-Modus, Chromium 1194 per Playwright.
- Generator (Desktop 1440×900): Formular, Ergebnis-Links, Statistik-Diagramm, Theme-Umschaltung bei sichtbarem Diagramm
- Teilnehmer: Desktop, mobil (Pixel 7, 412 px), Vordruck-Modal desktop und mobil, X-Zeit-Fokuskarte mobil
- Übungsleitung: Teilnehmerliste, Nachrichtenplan, Heatmap und Timeline, Gefahrenbereich „Übungsstand zurücksetzen“, X-Zeit-Cockpit mit überfälligen Sprüchen (Basis 6 min zurück)
- Admin, Inhaltsseiten `/funkuebung-thw/`, `/buchstabiertafel/`, `/faq/`, `/anleitung/`
- automatische Kontrastmessung je Theme über alle sichtbaren Textknoten (WCAG-Ratio gegen den tatsächlich darunterliegenden, gemischten Hintergrund)
- Achromatopsie und Deuteranopie per CDP `Emulation.setEmulatedVisionDeficiency` (Teilnehmer mobil, Nachrichtenplan, X-Zeit mobil)
- Theme-Regeln: eigene Wahl gegen Systemwechsel, ohne Wahl folgt System, erstes Bild mit um 2 s verzögertem `bundle.js`, Inhaltsseite bei dunklem System

Screenshots: `scratchpad/night-visibility/{light,dark}-NN-*.png` (Sitzungs-Scratchpad, nicht eingecheckt; dieser Lauf: Nummern 01–24 mit Erzeugungszeit 2026-10-05).

**Nicht prüfbar:** Reale Umgebungshelligkeit, Displayhelligkeit, Spiegelung und Sonnenlicht ließen sich nicht simulieren. Die Aussagen dazu stützen sich auf gemessene Kontraste und sichtbare Codierung. Die Gerätewarnung „seit n min nichts vom Gerät“ ließ sich im Mock nicht auslösen (braucht ein stilles Gerät über mehrere Minuten). Die Bewertung stützt sich dort auf die berechnete Farbe derselben CSS-Klasse (siehe Befund 1).

---

## Urteil

Seit dem ersten Lauf hat sich viel verbessert. Das Theme bleibt vorhersehbar: Eine eigene Wahl übersteht den Systemwechsel, das erste Bild ist schon dunkel, die Inhaltsseiten folgen dem dunklen System. Die Diagramme sind im Dark Mode lesbar. Auf dem Smartphone erscheinen die Sprüche als Karten, Nummer und Status sind vollständig zu sehen. Der Vordruck wird jetzt gerendert und ist invertiert gut lesbar. Fließtext, Tabellen und Statuschips liegen in beiden Themes über WCAG AA. Den Status vermittelt die App weiterhin nie nur über Farbe.

Die Reibung hat jetzt eine gemeinsame Ursache: **Drei Hinweise mit Warncharakter verwenden Bootstraps `text-*-emphasis`-Klassen, und die haben im Dark Mode keine eigene Farbe.** Gemessen: dunkles Oliv bzw. Dunkelrot auf fast schwarzem Grund, 1,3:1 bis rund 2:1. Ausgerechnet die Zeilen, die vor etwas warnen („+2 weitere Meldung(en) fällig“, „Übungsstand zurücksetzen“, „seit n min nichts vom Gerät“), sind nachts praktisch unsichtbar. Dazu kommen Kleinigkeiten: zwei ausgelassene Schalter, eine grelle Heatmap und auf den Inhaltsseiten kein Umschalter.

Alle Aufgaben lassen sich in beiden Themes ohne fremde Hilfe erledigen.

---

## Befunde

### Befund 1: Warnhinweise im Dark Mode nahezu unsichtbar (P1)

1. **Priorität:** P1
2. **Fundstelle / Aufgabe:**
   - Teilnehmer, X-Zeit, Fokuskarte: „+2 weitere Meldung(en) fällig“ (`src/teilnehmer/fokusKarte.ts:141`, `text-warning-emphasis`), Screenshot `dark-23-teilnehmer-xzeit-mobil.png`
   - Übungsleitung, Überschrift des Gefahrenbereichs „Übungsstand zurücksetzen“ (`src/uebungsleitung/UebungsleitungView.ts:413`, `text-danger-emphasis`), Screenshot `dark-21-gefahrenbereich.png` und `dark-13-auswertung.png` unten
   - Übungsleitung, Teilnehmerzeile „seit n min nichts vom Gerät“ (`src/uebungsleitung/teilnehmerMarkup.ts:176`, `text-warning-emphasis`). Nicht ausgelöst, Farbe aus derselben Klasse berechnet.
3. **Beobachtung:** Im Dark Mode berechnet der Browser für `text-warning-emphasis` die Farbe `rgb(102,77,3)` und für `text-danger-emphasis` die Farbe `rgb(88,21,28)`, also die Werte für hellen Grund. Die Kontrastmessung ergibt für die Überschrift „Übungsstand zurücksetzen“ **1,29:1** auf `rgb(20,25,34)`. Die Zeile „+2 weitere Meldung(en) fällig“ ist im Screenshot nur als bräunlicher Schatten unter dem grünen Knopf zu ahnen (rechnerisch rund 2:1). Im Light Mode sind dieselben Texte gut lesbar (`light-21-gefahrenbereich.png`). Ursache: Das Dark Theme läuft über `body[data-theme="dark"]`, nicht über Bootstraps `data-bs-theme`. Die Emphasis-Variablen von Bootstrap werden deshalb nie umgestellt (in `src/styles/main.css` ist nur `--bs-emphasis-color` gemappt).
4. **Erwartung der Rolle:** Ein Hinweis, der warnt („es ist mehr fällig“, „Gerät meldet sich nicht“, „Achtung, folgenschwere Aktion“), ist mindestens so gut lesbar wie der normale Text.
5. **Auswirkung im Einsatz:** Abends im X-Zeit-Betrieb sieht der Teilnehmer auf dem gedimmten Handy nur „Meldung 1 fällig“. Dass zwei weitere Sprüche schon überfällig sind, entgeht ihm, er arbeitet zu langsam und gerät hinter den Plan. Die Übungsleitung übersieht nachts am Laptop, dass ein Gerät seit Minuten schweigt (Funkloch oder Akku), und fragt nicht per Funk nach. Die Warnung, die genau dafür gebaut wurde, kommt dann nicht an. Beim Gefahrenbereich bleiben Beschreibung und roter Knopf lesbar, nur die Überschrift fehlt. Dort ist die Folge gering. Für ein Ausbildungswerkzeug ist das kein Sicherheitsrisiko, die Übungssteuerung verliert dadurch aber genau die Signale, die sie bei Nacht braucht. Deshalb P1.
6. **Empfehlung:** Alle Emphasis- und Subtle-Farben von Bootstrap für das dunkle Theme auf eigene, aufgehellte Warn- und Gefahrfarben legen (wie sie bei den Statuschips `OFFEN` und `9 hinter Plan` schon gut funktionieren). Warnzeilen bekommen zusätzlich ein Symbol oder einen Rahmen, damit sie nicht allein an der Schriftfarbe hängen.
7. **Verifikation:** Kontrastmessung im Dark Mode für `.text-warning-emphasis`, `.text-danger-emphasis` und `.text-success-emphasis` ≥ 4,5:1. Screenshot der Fokuskarte mit mehreren fälligen Sprüchen und der Teilnehmerzeile mit stillem Gerät im Dark Mode. Ein Regressionstest, der jede verwendete `text-*-emphasis`-Klasse im Dark Theme misst.

### Befund 2: Zwei Schalter im Dark Mode weiterhin kaum erkennbar (P2)

1. **Priorität:** P2
2. **Fundstelle / Aufgabe:**
   - Übungsleitung, Nachrichtenplan, Tabellenkopf „Status – Abgesetzte ausblenden“ (`#toggleHideAbgesetzt`, `src/uebungsleitung/nachrichtenMarkup.ts:34-37`), Screenshot `dark-11-nachrichtenplan.png`
   - Admin „Nur Testübungen anzeigen“ (Checkbox), `dark-14-admin.png`
3. **Beobachtung:** Der Teilnehmer-Schalter und der X-Zeit-Schalter haben jetzt im Dark Mode einen hellen Knopf und eine deutliche Kontur (`dark-07-teilnehmer-mobil.png`). Die Sonderregel in `src/styles/main.css:2009-2014` gilt aber nur für `.teilnehmer-schalter` und `#xZeitBanner`. Der Schalter im Nachrichtenplan der Übungsleitung erscheint ausgeschaltet als schwarzes Rechteck ohne erkennbaren Knopf. Die Admin-Checkbox ist ein kaum sichtbares dunkles Quadrat.
4. **Erwartung der Rolle:** Jeder Filter zeigt auf einen Blick, ob er an oder aus ist.
5. **Auswirkung im Einsatz:** Die Übungsleitung blendet abgesetzte Sprüche aus, um sich auf die offenen zu konzentrieren, und erkennt nachts nicht, ob der Filter greift. Fehlen dann Zeilen, wirkt das wie ein Datenverlust, und man sucht. Das kostet Zeit, eine falsche Entscheidung folgt daraus nicht.
6. **Empfehlung:** Die Dark-Mode-Regel für Schalter und Checkboxen allgemein gültig machen, statt sie je Ort freizuschalten. Zusätzlich die Anzahl ausgeblendeter Zeilen am Plan-Filter zeigen, wie es der Teilnehmer-Bereich schon tut.
7. **Verifikation:** Kontrast von Kontur und Knopf zur Umgebung ≥ 3:1 in beiden Themes für jede `.form-check-input` auf allen Routen.

### Befund 3: Heatmap als grelle, nicht theme-abhängige Blaufläche (P3)

1. **Priorität:** P3
2. **Fundstelle / Aufgabe:** Übungsleitung → „Heatmap & Timeline“ (`src/uebungsleitung/nachrichtenDiagramme.ts:25-28`, feste Farbe `rgba(54,162,235,…)`), Screenshot `dark-13-auswertung.png`
3. **Beobachtung:** Die Timeline darunter ist jetzt richtig in Theme-Farben gesetzt. Die Heatmap dagegen besteht aus HTML-Balken mit fester Farbe. Bei nur einem gefüllten 5-Minuten-Fenster füllt sie die ganze Kartenbreite (~1340 × 86 px) mit kräftigem Hellblau, Deckkraft bis 0,92. Im Dark Mode ist das die hellste Fläche der Seite.
4. **Erwartung der Rolle:** Im Dark Mode ist der Bildschirm gleichmäßig gedämpft. Hervorstechen dürfen nur Warnungen.
5. **Auswirkung im Einsatz:** Gering. Der Blick wird auf ein Diagramm ohne Dringlichkeit gezogen, im abgedunkelten Raum leuchtet der Laptop auf.
6. **Empfehlung:** Die Heatmap aus derselben Theme-Palette einfärben wie die Diagramme (Akzentfarbe, im Dark Mode gedämpft).
7. **Verifikation:** Screenshot im Dark Mode: Die Heatmap ist nicht heller als die Primärknöpfe.

### Befund 4: Aktion „✓ Als abgesetzt markieren“ in der Teilnehmeransicht im Stil des erledigten Status (P3)

1. **Priorität:** P3
2. **Fundstelle / Aufgabe:** Teilnehmer, Karte bzw. Fokuskarte, Knopf `[data-aktion='absetzen']` (`src/teilnehmer/nachrichtenMarkup.ts:103`), Screenshots `dark-07-teilnehmer-mobil.png`, `dark-08-teilnehmer-mobil-achromatopsia.png`, `light-07-teilnehmer-mobil.png`
3. **Beobachtung:** In der Übungsleitung ist die Aktion jetzt neutral („Als abgesetzt markieren“, ohne Haken, grauer Rahmen). In der Teilnehmeransicht hat sie dagegen weiterhin Haken, grüne Schrift und grünen Rahmen, genau wie der erledigte Chip „✓ ABGESETZT“. In Graustufen unterscheiden sich beide nur noch durch Wortlaut und Größe. Der Text „Als … markieren“ ist eindeutig, deshalb nur P3.
4. **Erwartung der Rolle:** Grün und Haken bedeuten „erledigt“, eine Aktion sieht anders aus.
5. **Auswirkung im Einsatz:** Wer nachts nur kurz auf das Handy schaut, sieht bei offenen Sprüchen einen grünen Haken und kann für einen Moment meinen, der Spruch sei durch. Der gelbe Chip `OFFEN` direkt darüber fängt das meist ab.
6. **Empfehlung:** Beide Ansichten gleich behandeln: Der Aktionsknopf bekommt keinen Haken, Grün bleibt dem erledigten Zustand vorbehalten.
7. **Verifikation:** Graustufen-Screenshot der Teilnehmerliste: offene und abgesetzte Karten lassen sich in fünf Sekunden richtig zuordnen, ohne die Wörter zu lesen.

### Befund 5: Inhaltsseiten ohne Theme-Umschalter (P3)

1. **Priorität:** P3
2. **Fundstelle / Aufgabe:** `/anleitung/`, `/buchstabiertafel/`, `/faq/`, `/funkuebung-thw/`. Geprüft: kein `#themeToggle` oder vergleichbares Element vorhanden.
3. **Beobachtung:** Inhaltsseiten folgen jetzt der gespeicherten Wahl bzw. dem System (dunkel gemessen bei `colorScheme: dark`). Wer aber direkt auf einer Inhaltsseite landet (etwa die Buchstabiertafel aus einem Lesezeichen) und ein helles System hat, kann dort nicht auf dunkel umschalten, nur über den Umweg in die App.
4. **Erwartung der Rolle:** Den Schalter gibt es überall, wo es auch die Kopfzeile gibt.
5. **Auswirkung im Einsatz:** Gering. Die Buchstabiertafel wird oft nachts nebenbei offen gehalten, sie bleibt dann hell, bis man in die App wechselt.
6. **Empfehlung:** Denselben Umschalter in die Kopfzeile der Inhaltsseiten aufnehmen. Die Regel im frühen Theme-Skript existiert schon.
7. **Verifikation:** Auf `/buchstabiertafel/` umschalten, neu laden: Das Theme bleibt erhalten und gilt auch in der App.

### Befund 6: Umschalter beschriftet sich erst nach dem Laden von JS (P3)

1. **Priorität:** P3
2. **Fundstelle / Aufgabe:** Laden der App mit gespeichertem `theme=dark` und verzögertem Bundle, `dark-19-erstes-paint-vor-js.png`
3. **Beobachtung:** Der Hintergrund ist jetzt ab dem ersten Bild dunkel (gemessen `rgb(11,14,20)`, kein Blitz mehr). Der Knopf oben rechts heißt bis zum Laden des Bundles aber „🌙 Dark Mode“, obwohl die Seite schon dunkel ist. Ein Tipp darauf in diesem Moment bewirkt nichts.
4. **Erwartung der Rolle:** Die Beschriftung passt immer zur Anzeige.
5. **Auswirkung im Einsatz:** Vernachlässigbar, nur bei sehr langsamem Netz sichtbar.
6. **Empfehlung:** Die Beschriftung im frühen Theme-Skript mitsetzen.
7. **Verifikation:** Verzögertes Bundle, `theme=dark`: Der Knopf zeigt sofort „Light Mode“.

### Befund 7: Kontrastreste in deaktivierten Zuständen (P3)

1. **Priorität:** P3
2. **Fundstelle / Aufgabe:** Vordruck-Modal, deaktivierter Knopf „Zurück“ auf Seite 1 (`#btn-doc-prev`): 2,55:1 im Light Mode, 4,25:1 im Dark Mode bei 15 px
3. **Beobachtung:** Das ist der einzige Treffer der Kontrastmessung unter AA außerhalb von Befund 1, über alle geprüften Ansichten und beide Themes. Die deaktivierten Blätter-Knöpfe im Admin fallen nicht mehr auf.
4. **Erwartung der Rolle:** Auch „gerade nicht verfügbar“ ist erkennbar.
5. **Auswirkung im Einsatz:** Vernachlässigbar, ein deaktivierter Zustand darf schwächer sein. Aufgeführt, damit die Messung vollständig ist.
6. **Empfehlung:** Keine dringende Änderung.
7. **Verifikation:** Kontrastmessung erneut laufen lassen.

---

## Positiv beobachtet (keine Maßnahme nötig)

- **Theme vorhersehbar:** System hell, Klick auf Dark, dann System dunkel und wieder hell: Die Anzeige bleibt `dark`. Ohne eigene Wahl folgt die App dem System, und auch die Adressleiste wechselt (`theme-color` `#0e1526` dunkel bzw. `#12275e` hell).
- **Kein heller Blitz:** Das erste Bild ist mit verzögertem Bundle schon dunkel. `/faq/` und `/anleitung/` sind bei dunklem System dunkel.
- **Diagramme:** Die Generator-Statistik und die Timeline der Übungsleitung haben Theme-Farben und zeichnen sich beim Umschalten neu (`dark-04-generator-stats.png`, `dark-04c-chart-nach-toggle.png`, `dark-13-canvas-nachrichtenTimelineChart.png`).
- **Mobil:** Karten statt Tabelle, keine horizontale Scrollbreite (gemessen `scrollWidth 412 = viewport 412`). Nummer, Status und Aktion sind vollständig sichtbar, mit farbigem Randstreifen plus Text.
- **Status nie nur über Farbe:** `OFFEN`, `✓ ABGESETZT 21:02`, `ALS NÄCHSTES`, `keine Meldung`, `9 hinter Plan`, `7 überfällig – zur ersten`, „überfällig 6 min“. Bei Achromatopsie und Deuteranopie bleiben alle Zustände lesbar.
- **Vordruck:** Wird gerendert. Invertiert ergibt er weiße Linien und Schrift auf Schwarz, keine Farbfelder, die durch die Invertierung irreführend würden. Der Modal-Titel liegt mobil nicht mehr unter der Kopfzeile.
- **Primärknopf im Dark Mode gedämpft:** Die ZIP-Fläche ist nicht mehr die grellste Fläche der Seite.
- **Cockpit:** Uhrzeit, Laufzeit, X-Zeit und Fortschritt groß in Monospace, auch auf Abstand lesbar (`dark-22-cockpit-ueberfaellig.png`).

---

## Abschluss

- **Aufgabe geschafft:** ja
- **Fremde Hilfe nötig:** nein
- **Größtes Missverständnis:** Auf der X-Zeit-Fokuskarte sieht der Teilnehmer nachts nur „Meldung 1 fällig“ und hält das für alles, was ansteht, denn die Zeile „+2 weitere Meldung(en) fällig“ ist im Dark Mode praktisch unsichtbar.
- **Größtes Einsatzrisiko:** Die Übungsleitung übersieht im Dark Mode die Warnung „seit n min nichts vom Gerät“ und bemerkt ein Funkloch oder einen leeren Akku beim Teilnehmer nicht rechtzeitig.
- **Top-Priorität für die nächste Iteration:** Bootstraps `text-*-emphasis`-Farben (und die übrigen Bootstrap-Farbvariablen) für `data-theme="dark"` auf eigene, aufgehellte Werte legen und mit einem Kontrasttest absichern (Befund 1).

---

## Abgleich mit dem Lauf vom 2026-10-04

| Alte ID | Titel | Alte Priorität | Status jetzt | Beleg aus dieser Prüfung |
|---|---|---|---|---|
| 1 | Systemwechsel überschreibt die gewählte Einstellung | P2 | behoben | System hell, Klick auf Dark, dann `emulateMedia` dunkel und wieder hell: `data-theme` bleibt `dark`, gespeichert `dark`. Ohne Wahl folgt die Anzeige dem System (`light` → `dark`). |
| 2 | Heller Blitz vor JS, Inhaltsseiten ohne System-Dunkel | P2 | behoben | Bundle um 2 s verzögert, `theme=dark`: Das erste Bild ist dunkel, `body` `rgb(11,14,20)` (`dark-19-erstes-paint-vor-js.png`). Bei `colorScheme: dark` haben `/faq/` und `/anleitung/` `data-theme="dark"`. Rest: Beschriftung des Knopfs (neuer Befund 6). |
| 3 | Diagramme im Dark Mode mit hellen Standardfarben | P2 | behoben | Generator-Statistik und Timeline mit hellen Achsen und sichtbarem Raster, Neuzeichnen beim Umschalten (`dark-04-generator-stats.png`, `dark-04c-chart-nach-toggle.png`, `dark-13-canvas-…png`). Die HTML-Heatmap ist ein eigenes Element, siehe neuer Befund 3. |
| 4 | Statusspalte auf dem Smartphone abgeschnitten | P2 | behoben | Kartenansicht. `scrollWidth` = Viewport 412 px. `OFFEN` und `✓ ABGESETZT 21:02` vollständig, mit Nummer (`dark-07-teilnehmer-mobil.png`, `light-07-…`). |
| 5 | Aktionsknopf „✓ abgesetzt“ sieht aus wie ein Status (Übungsleitung) | P2 | behoben | Im Nachrichtenplan steht jetzt „Als abgesetzt markieren“ neutral ohne Haken neben dem gelben `OFFEN`. Auch in Graustufen eindeutig (`dark-11-nachrichtenplan.png`, `…-achromatopsia.png`). Gleiches Muster in der Teilnehmeransicht: neuer Befund 4. |
| 6 | Kleine Schalter im Dark Mode kaum sichtbar | P3 | teilweise | Teilnehmer- und X-Zeit-Schalter jetzt mit hellem Knopf und Kontur (`dark-07-…`, `dark-23-…`). Der Schalter im Nachrichtenplan der Übungsleitung und die Admin-Checkbox sind weiter kaum erkennbar (neuer Befund 2). |
| 7 | Grelle Flächen und `theme-color` im Dark Mode | P3 | behoben | `theme-color` dunkel `#0e1526`, hell `#12275e`, wechselt mit. Die ZIP-Fläche ist im Dark Mode gedämpft (`dark-03-generator-links.png`). |
| 8 | Vordruck im Dark Mode invertiert (nicht prüfbar) | P3 | behoben | Der Vordruck rendert jetzt. Invertiert: weiße Linien und Schrift auf Schwarz, Felder lesbar, keine farbigen Kennungen. Der Modal-Titel liegt mobil frei (`dark-06-vordruck-desktop.png`, `dark-09-vordruck-mobil.png`). |
| 9 | Kontrastschwächen in Nebenzuständen | P3 | teilweise | Admin-Blätterknöpfe und Hover des Primärknopfs fallen nicht mehr auf. Der deaktivierte Knopf „Zurück“ im Vordruck-Modal liegt mit 2,55:1 bzw. 4,25:1 weiter darunter (neuer Befund 7). |
