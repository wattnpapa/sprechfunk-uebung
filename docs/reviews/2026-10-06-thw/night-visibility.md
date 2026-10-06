Befunde: P0=0 P1=0 P2=2 P3=4
Abgleich: behoben=6 teilweise=1 offen=0 nicht-pruefbar=0

# Night-Visibility-Audit, dritter Lauf: Sprechfunk Übungsgenerator

**Datum:** 2026-10-06 · **Perspektive:** THW-Helfer, der das Display nachts (Fahrzeughalle, Unterkunft, im Freien unter Arbeitslicht) oder tagsüber im Sonnenlicht nutzt · **Themes:** Light und Dark (`localStorage.theme`, dazu passendes `colorScheme` im Browser-Kontext)

**Prüfumfang:** Lokaler Build unter `http://127.0.0.1:3000` im Mock-Modus, Chromium 1194 per Playwright, je Theme ein eigener Durchlauf:
- Generator (Desktop 1440×900): Formular, Profil-Bereich, Vorlagen-Auswahl, Ergebnis-Links, Statistik, Theme-Wechsel bei sichtbarem Diagramm
- Teilnehmer: Desktop, mobil (Pixel-7-Viewport 412 px), Vordruck-Modal desktop und mobil, X-Zeit mit Fokuskarte und 5 überfälligen Sprüchen
- Übungsleitung: Kopf, Lage, Teilnehmerliste, Nachrichtenplan, Schalter „Abgesetzte ausblenden“, Heatmap und Timeline, Gefahrenbereich, X-Zeit-Cockpit mit 12 überfälligen Sprüchen, **Warnzeile „seit n min nichts vom Gerät“ diesmal real ausgelöst** (Browseruhr per `page.clock` um 15 min vorgestellt)
- Admin; Inhaltsseiten `/buchstabiertafel/`, `/faq/`, `/anleitung/`, `/funkuebung-thw/` (Desktop und mobil, Umschalter)
- automatische Kontrastmessung je Theme und Ansicht über alle sichtbaren Textknoten (WCAG-Ratio gegen den tatsächlich darunterliegenden, gemischten Hintergrund), zusätzlich Suche nach großen hellen Flächen
- Achromatopsie und Deuteranopie per CDP `Emulation.setEmulatedVisionDeficiency` (Teilnehmer mobil, Nachrichtenplan, Cockpit, Fokuskarte)
- Theme-Regeln: Umschalten auf Inhaltsseite, Reload, Übergang in die App, Systemwechsel mit und ohne eigene Wahl, erstes Bild mit um 2,5 s verzögertem `bundle.js`

Screenshots: Sitzungs-Scratchpad `night-visibility/run3/{light,dark}-NN-*.png` (nicht eingecheckt), Messwerte in `run3/report.json`.

**Nicht prüfbar:** Reale Umgebungshelligkeit, Displayhelligkeit, Spiegelung und Sonnenlicht ließen sich nicht simulieren. Die Aussagen dazu stützen sich auf gemessene Kontraste, Flächenhelligkeit und sichtbare Codierung.

---

## Urteil

Der Dark Mode ist jetzt durchgängig benutzbar. Alle Warnungen aus dem letzten Lauf sind nachts lesbar: „⚠ 5 weitere Meldungen fällig, diese seit 23 min“ steht auf der Fokuskarte als eigener, gerahmter Kasten in hellem Gelb, „⚠ seit 15 min nichts vom Gerät“ erscheint in der Teilnehmerzeile der Übungsleitung gut sichtbar, die Überschrift „Übungsstand zurücksetzen“ ist rot und klar. Die Kontrastmessung findet in **keiner** Ansicht von Teilnehmer, Übungsleitung, Admin und Inhaltsseiten mehr Text unter WCAG AA, in beiden Themes. Status wird weiter nie nur über Farbe vermittelt („OFFEN“, „✓ ABGESETZT 06:25“, „überfällig 21 min“, „12 hinter Plan“), auch in Graustufen ist alles zuzuordnen. Theme-Wahl, erstes Bild und Inhaltsseiten verhalten sich vorhersehbar.

Was bleibt, liegt am Rand der Hauptaufgaben: Ein deaktiviertes Auswahlfeld im Generator ist im Dark Mode ein heller Balken mit unsichtbarer Schrift. In den Tabellen wird der farbige Zustandsstreifen an **jeder** Zelle wiederholt, bei einer zurückliegenden X-Zeit-Übung wird der Nachrichtenplan dadurch zu einem Gitter aus roten Balken. Dazu kommen Kleinigkeiten: eine noch flächige Heatmap, eine weiße Rückgängig-Leiste im Dark Mode, eine Timeline, deren zwei Punktarten sich nur in der Farbe unterscheiden, und einige native Radios.

Alle Aufgaben lassen sich in beiden Themes ohne fremde Hilfe erledigen.

---

## Befunde

### Befund 1: Profil-Auswahl im Dark Mode heller Balken mit unsichtbarer Schrift (P2)

1. **Priorität:** P2
2. **Fundstelle / Aufgabe:** Generator → „Profile: Eingaben für die nächste Übung speichern und laden“ aufklappen, Feld „Gespeicherte Profile“ (`#profilAuswahl`, deaktiviert, solange kein Profil existiert). Screenshot `dark-23-profil.png`, Gegenprobe `light-23-profil.png`.
3. **Beobachtung:** Im Dark Mode berechnet der Browser für das deaktivierte `select` den Hintergrund `rgb(233,236,239)` (Bootstraps heller Disabled-Grund) und die Schrift `rgb(231,234,240)` (Theme-Textfarbe). Kontrast rund **1,0:1**: Der Hinweis „Noch kein Profil in diesem Browser“ ist unsichtbar. Gleichzeitig ist das Feld mit ca. 980 × 38 px die hellste Fläche des ganzen Generators. Die deaktivierten Knöpfe daneben („Laden“, „Löschen“) sind korrekt dunkel mit gestricheltem Rand. Im Light Mode ist dasselbe Feld lesbar.
4. **Erwartung der Rolle:** Ein ausgegrautes Feld ist im Dark Mode dunkelgrau und sagt lesbar, warum es nicht geht.
5. **Auswirkung im Einsatz:** Wer abends am Laptop den Dienstabend vorbereitet, bekommt beim Aufklappen einen hellen Streifen ins Gesicht und erfährt nicht, dass noch kein Profil gespeichert ist. Er sucht, warum „Laden“ nicht geht. Zeitverlust, keine Fehlentscheidung, und nur in der Vorbereitung, deshalb P2 und nicht höher.
6. **Empfehlung:** Deaktivierte Formularfelder (`select`, `input`, `textarea`) im Dark Mode auf dieselbe dunkle Fläche mit gedämpfter, aber lesbarer Schrift legen wie die deaktivierten Knöpfe (die Regel für `.btn:disabled` gibt es schon). Betrifft vermutlich jedes deaktivierte Formularfeld der App, nicht nur dieses.
7. **Verifikation:** Profil-Bereich im Dark Mode ohne gespeichertes Profil öffnen: Feld nicht heller als die übrigen Eingabefelder, Kontrast des Hinweistexts ≥ 4,5:1. Den bestehenden Kontrasttest um `:disabled`-Formularfelder ergänzen.

### Befund 2: Zustandsstreifen an jeder Tabellenzelle wiederholt, bei Rückstand ein Gitter aus roten Balken (P2)

1. **Priorität:** P2
2. **Fundstelle / Aufgabe:** Übungsleitung → Nachrichtenplan, besonders im X-Zeit-Modus mit überfälligen Sprüchen; ebenso die Teilnehmer-Tabelle am Desktop. Screenshots `dark-17c-xzeit-plan.png`, `light-17c-xzeit-plan.png`, `dark-11-nachrichtenplan.png`, `dark-05-teilnehmer-desktop.png`. Ursache in `src/styles/main.css`: Die Randmarke ist als `box-shadow: inset … 0 0` auf `> td` gesetzt (z. B. `.status-pending-row.plan-zeile--ueberfaellig > td`, Zeile ~2011; `.status-ok-row > td`, ~1321; `.status-pending-row > td`, ~1330; `.ist-naechster > td`, ~2673), also auf jede Zelle statt nur auf die erste.
3. **Beobachtung:** Jede Zeile trägt ihren 4–8 px breiten Farbstreifen sechs- bis siebenmal, an jeder Spaltengrenze. Bei einer X-Zeit-Übung mit 12 überfälligen Sprüchen besteht der sichtbare Plan aus rund 50 roten (Dark: lachsfarbenen, Light: tiefroten) senkrechten Balken. Der Text der Spalten „Empfänger“, „Sender“ und „Nachricht“ stößt direkt an den Balken. Auf dem Smartphone (Kartenansicht) tritt das nicht auf, dort ist der Streifen einmal links.
4. **Erwartung der Rolle:** Ein Streifen links an der Zeile: „diese Zeile ist überfällig“. Der Rest der Zeile bleibt ruhig, damit man den Spruchtext lesen kann.
5. **Auswirkung im Einsatz:** Gerade wenn die Übung hinter dem Plan liegt und die Übungsleitung schnell den nächsten Spruch finden will, flimmert der Plan. Das stärkste Alarmsignal der App (Rot) wird zum Hintergrundmuster und verliert seine Wirkung. Im abgedunkelten Raum sind die hellroten Balken auf dunklem Grund die auffälligste Struktur des Bildschirms. Die Information selbst geht nicht verloren („überfällig 21 min“ steht als Text da), deshalb P2.
6. **Empfehlung:** Die Randmarke nur an der ersten Zelle der Zeile zeigen (wie in der Kartenansicht). Die übrigen Zellen behalten nur ihren Grund.
7. **Verifikation:** Screenshot des X-Zeit-Plans mit überfälligen Zeilen in beiden Themes: genau ein Farbstreifen je Zeile, Text mit Abstand zum Streifen.

### Befund 3: Heatmap mit nur einem Zeitfenster bleibt eine volle Farbfläche (P3)

1. **Priorität:** P3
2. **Fundstelle / Aufgabe:** Übungsleitung → „Heatmap & Timeline“ (`#nachrichtenHeatmapChart`, `.heatmap-balken`), Screenshot `dark-13-auswertung.png`
3. **Beobachtung:** Die Farbe kommt jetzt aus dem Theme (`rgb(74,111,208)` dunkel, `rgb(18,39,94)` hell, Deckkraft 0,85) statt aus festem Hellblau, das ist deutlich ruhiger. Solange alle erledigten Sprüche in ein 5-Minuten-Fenster fallen, füllt ein einziger Balken aber die ganze Kartenbreite (gemessen 1342 × 86 px). Im Dark Mode ist das nach den Primärknöpfen die größte gesättigte Fläche der Seite.
4. **Erwartung der Rolle:** Ein Diagramm ohne Dringlichkeit tritt zurück.
5. **Auswirkung im Einsatz:** Gering. Am Anfang jeder Übung leuchtet ein großer blauer Block, der nur „bisher x Sprüche“ sagt.
6. **Empfehlung:** Balkenbreite begrenzen (feste Spaltenbreite je 5-Minuten-Fenster statt `flex-fill`) oder die Deckkraft im Dark Mode weiter absenken.
7. **Verifikation:** Dark-Mode-Screenshot direkt nach dem ersten abgesetzten Spruch: Heatmap nicht breiter als ein schmales Säulenfeld.

### Befund 4: Rückgängig-Leiste der Übungsleitung im Dark Mode weiß (P3)

1. **Priorität:** P3
2. **Fundstelle / Aufgabe:** Übungsleitung, z. B. nach Ändern der X-Zeit-Basis, „zurücknehmen“ oder „auslassen“ (`#uebungsleitungUndo`, Stil `.uebungsleitung-undo` in `src/styles/main.css` ~2072: `background: var(--text)`). Screenshots `dark-17-cockpit-ueberfaellig.png`, `dark-17c-xzeit-plan.png`.
3. **Beobachtung:** Die Leiste ist bewusst invertiert. Im Light Mode ist sie dunkel, im Dark Mode dadurch **weiß mit schwarzer Schrift** und damit die hellste Fläche des Bildschirms. Die Rückgängig-Leiste beim Teilnehmer ist dagegen im Dark Mode dunkel (`dark-05-teilnehmer-desktop.png`). Sie steht einige Sekunden und liegt über dem Plan.
4. **Erwartung der Rolle:** Rückmeldungen fallen auf, ohne zu blenden. Gleiche Funktion, gleiches Aussehen in beiden Ansichten.
5. **Auswirkung im Einsatz:** Gering. Kurzes Aufblenden nach seltenen Aktionen, die Augen der Übungsleitung müssen sich im dunklen Raum kurz neu anpassen.
6. **Empfehlung:** Im Dark Mode eine erhöhte dunkle Fläche mit hellem Rand nutzen, wie beim Teilnehmer.
7. **Verifikation:** X-Zeit-Basis im Dark Mode ändern: Leiste nicht heller als eine Karte.

### Befund 5: Timeline unterscheidet Senden und Empfangen nur über Farbe gleicher Helligkeit (P3)

1. **Priorität:** P3
2. **Fundstelle / Aufgabe:** Übungsleitung → „Heatmap & Timeline“ → „Timeline je Teilnehmer“ (`src/uebungsleitung/nachrichtenDiagramme.ts:59-70`), Screenshot `dark-13-auswertung.png`
3. **Beobachtung:** Beide Datenreihen sind gleich geformte 4-px-Punkte, „Senden“ in `--akzent-hell` (dunkel `#8fa9e8`), „Empfangen“ in der Warnfarbe (gelb). Rechnerisch haben beide fast dieselbe Helligkeit. In Graustufen oder bei geringer Displayhelligkeit sind die Punkte deshalb nicht zu unterscheiden. Die y-Achse zeigt im Screenshot keine Teilnehmernamen, nur die Achsenbeschriftung „Teilnehmer“. Die Zeitachse zeigt bei kurzer Laufzeit zehnmal „06:25“.
4. **Erwartung der Rolle:** Zwei Arten von Ereignissen unterscheiden sich auch in der Form, jede Zeile ist einem Namen zugeordnet.
5. **Auswirkung im Einsatz:** Gering, die Timeline dient der Nachbesprechung. Bei Rot-Grün-Schwäche ist sie weniger betroffen (Blau gegen Gelb), bei gedimmtem Display schon.
6. **Empfehlung:** Unterschiedliche Punktformen (z. B. Kreis gegen Dreieck) und größere Punkte, Teilnehmernamen an der y-Achse.
7. **Verifikation:** Graustufen-Screenshot der Timeline: Senden und Empfangen ohne Legende unterscheidbar, jede Zeile benannt.

### Befund 6: Kleine Restschwächen im Generator-Formular (P3)

1. **Priorität:** P3
2. **Fundstelle / Aufgabe:** Generator, Bereich „Quelle“ und Vorlagen-Auswahl, Screenshots `dark-24-vorlagen.png`, `dark-01-generator-top.png`
3. **Beobachtung:**
   - Die vier Radios unter „Funksprüche auswählen“ (`#optionVorlagen`, `#optionUpload`, `#optionSzenario`, `#optionFuehrungsstelle`) sind native Browser-Radios mit 13 px ohne `form-check-input`. Im Dark Mode sind sie kleine graue Kreise, der gewählte Punkt ist schwer zu erkennen. Die Radios „Klassisch / X-Zeit“ direkt daneben sind dagegen groß, mit Kontur und blauer Füllung.
   - Der Aufklapper „Was steckt in den Vorlagen? Lage, Umfang, Herkunft“ und die Hervorhebung der gewählten Vorlage („Funksprüche THW Leer (gewählt)“) stehen in `rgb(74,111,208)` auf `rgb(20,25,34)`: **3,76:1 bei 13 px**, die einzigen Texttreffer unter AA im Dark Mode. Im Light Mode ist nur der Platzhalter „Vorlagen auswählen oder suchen …“ mit 3,04:1 darunter (Platzhalter, vertretbar).
4. **Erwartung der Rolle:** Alle Auswahlfelder eines Formulars sehen gleich aus und zeigen ihren Zustand deutlich. Hinweise sind lesbar.
5. **Auswirkung im Einsatz:** Gering, betrifft die Vorbereitung am Schreibtisch. Die gewählte Quelle ist zusätzlich an den eingeblendeten Feldern darunter zu erkennen, die gewählte Vorlage am Wort „(gewählt)“.
6. **Empfehlung:** Die Quelle-Radios wie die übrigen Radios gestalten. Für Links und Hervorhebungen im Dark Mode die hellere Akzentfarbe (`--akzent-hell`) nehmen.
7. **Verifikation:** Kontrastmessung im Dark Mode: 0 Treffer im Generator. Screenshot: alle Radios gleich groß, Zustand in Graustufen erkennbar.

---

## Positiv beobachtet (keine Maßnahme nötig)

- **Warnungen nachts lesbar:** Fokuskarte „⚠ 5 weitere Meldungen fällig, diese seit 23 min“ (`rgb(242,198,108)` auf `rgb(43,35,18)`, eigener Rahmen, Symbol), Banner „6 fällig, älteste seit 23 min“, Teilnehmerzeile „⚠ seit 15 min nichts vom Gerät“ (`rgb(242,198,108)`), Gefahrenbereich-Überschrift rot (`dark-19-fokuskarte-mobil.png`, `dark-15-stilles-geraet.png`, `dark-14-gefahrenbereich.png`).
- **Kontrastmessung:** In beiden Themes 0 Texttreffer unter AA für Teilnehmer (Desktop, mobil, X-Zeit, Fokuskarte), Vordruck-Modal, Übungsleitung (Kopf, Plan, Cockpit, X-Zeit-Plan, Gefahrenbereich, Warnzeile), Admin und alle vier Inhaltsseiten. Einzige Treffer: Befund 6.
- **Schalter und Checkboxen:** Ausgeschaltet im Dark Mode mit Kontur `rgb(123,132,151)` und hellem Knopf, auf allen Routen (Plan, Teilnehmer, Admin, Generator).
- **Teilnehmer mobil:** Aktion „Als abgesetzt markieren“ als neutraler Primärknopf ohne Haken, klar getrennt vom grünen Chip „✓ ABGESETZT 06:25“. Der nächste Spruch ist mit „ALS NÄCHSTES“ und blauem Rand markiert. In Achromatopsie und Deuteranopie ist alles zuzuordnen (`dark-08-teilnehmer-mobil-achromatopsia.png`).
- **Cockpit:** Uhrzeit, Laufzeit, „X + 23 min“, „0/12“ groß in Monospace. „12 hinter Plan“ und „überfällig 23 min“ als Text, in Graustufen eindeutig (`dark-17b-cockpit-grau.png`).
- **Vordruck:** Invertiert weiße Linien und Schrift auf Schwarz, deaktivierter Knopf mit gestricheltem Rand statt Transparenz.
- **Theme-Regeln:** Auf `/buchstabiertafel/` umgeschaltet, nach Reload weiter dunkel, in der App ebenfalls dunkel, Systemwechsel auf hell ändert die eigene Wahl nicht. Ohne Wahl folgt die App dem System (hell → dunkel). Erstes Bild mit verzögertem Bundle: dunkel (`rgb(11,14,20)`), Knopf schon „☀️ Light Mode“ (`dark-22-erstes-bild-vor-js.png`).
- **Statistik-Diagramm:** Wird beim Theme-Wechsel mit passenden Achsen- und Rasterfarben neu gezeichnet (`dark-04-generator-stats.png`, `light-04b-stats-nach-toggle.png`).

---

## Abschluss

- **Aufgabe geschafft:** ja
- **Fremde Hilfe nötig:** nein
- **Größtes Missverständnis:** Im Dark Mode zeigt das Feld „Gespeicherte Profile“ einen leeren hellen Balken statt „Noch kein Profil in diesem Browser“, und man sucht, warum „Laden“ nicht geht.
- **Größtes Einsatzrisiko:** Wenn eine X-Zeit-Übung hinter dem Plan liegt, verwandeln die an jeder Zelle wiederholten roten Streifen den Nachrichtenplan in ein Balkengitter, und Rot verliert als Alarmsignal seine Wirkung.
- **Top-Priorität für die nächste Iteration:** Die Zustandsmarke im Nachrichtenplan und in der Teilnehmer-Tabelle nur an der ersten Zelle zeigen (Befund 2) und dabei deaktivierte Formularfelder im Dark Mode dunkel und lesbar machen (Befund 1).

---

## Abgleich mit dem Lauf vom 2026-10-05

| Alte ID | Titel | Alte Priorität | Status jetzt | Beleg aus dieser Prüfung |
|---|---|---|---|---|
| 1 | Warnhinweise im Dark Mode nahezu unsichtbar | P1 | behoben | Fokuskarte „⚠ 5 weitere Meldungen fällig, diese seit 23 min“ gemessen `rgb(242,198,108)` auf `rgb(43,35,18)` mit Rahmen `rgb(122,97,41)` (`dark-19-fokuskarte-mobil.png`). „⚠ seit 15 min nichts vom Gerät“ real ausgelöst, `rgb(242,198,108)` auf dunklem Grund (`dark-15-stilles-geraet.png`). Überschrift „Übungsstand zurücksetzen“ klar rot (`dark-14-gefahrenbereich.png`). Kontrastmessung in allen drei Ansichten: 0 Treffer. |
| 2 | Zwei Schalter im Dark Mode kaum erkennbar | P2 | behoben | `#toggleHideAbgesetzt` ausgeschaltet: Rand `rgb(123,132,151)`, Grund `rgb(28,34,45)`, Knopf `#aab3c4`, im Screenshot klar als Schalter zu sehen (`dark-11-nachrichtenplan.png`). Admin `#adminOnlyTestFilter`: gleiche Werte. |
| 3 | Heatmap als grelle, nicht theme-abhängige Blaufläche | P3 | teilweise | Farbe jetzt aus dem Theme (`rgb(74,111,208)`, Deckkraft 0,85) statt festem Hellblau. Bei einem einzigen Zeitfenster aber weiterhin ein Block über die volle Breite, 1342 × 86 px (neuer Befund 3). |
| 4 | Aktion „✓ Als abgesetzt markieren“ (Teilnehmer) im Stil des erledigten Status | P3 | behoben | Mobil und Desktop: „Als abgesetzt markieren“ als blauer Primärknopf ohne Haken, der grüne Chip „✓ ABGESETZT 06:25“ ist klar etwas anderes, auch in Graustufen (`dark-07-teilnehmer-mobil.png`, `dark-08-…-achromatopsia.png`, `light-07-…`). |
| 5 | Inhaltsseiten ohne Theme-Umschalter | P3 | behoben | `/buchstabiertafel/` hat einen Umschalter (Desktop und mobil sichtbar, 130 × 37 px). Klick → `data-theme=dark`, gespeichert, bleibt nach Reload und gilt in der App (`dark-21-buchstabiertafel-mobil.png`). |
| 6 | Umschalter beschriftet sich erst nach dem Laden von JS | P3 | behoben | Bundle um 2,5 s verzögert, `theme=dark`: Nach 0,9 s ist die Seite dunkel und der Knopf heißt schon „☀️ Light Mode“ (`dark-22-erstes-bild-vor-js.png`). |
| 7 | Kontrastreste in deaktivierten Zuständen | P3 | behoben | Deaktivierte Knöpfe haben einen gestrichelten Rand und volle Deckkraft. Die Kontrastmessung im Vordruck-Modal ergibt in beiden Themes 0 Treffer. Ein anderes deaktiviertes Element, das Profil-`select`, ist neu aufgefallen (Befund 1). |
