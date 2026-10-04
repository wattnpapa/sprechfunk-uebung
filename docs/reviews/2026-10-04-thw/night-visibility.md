# Night-Visibility-Audit – Sprechfunk Übungsgenerator

**Datum:** 2026-10-04 · **Perspektive:** THW-Helfer, der das Display nachts (Fahrzeughalle, Unterkunft, im Freien unter Arbeitslicht) oder tagsüber im Sonnenlicht nutzt · **Themes:** Light und Dark (`localStorage.theme`)

**Prüfumfang:** Lokaler Build unter `http://127.0.0.1:3000` im Mock-Modus, Chromium per Playwright.
- Generator (Desktop 1440×900): Kopfdaten, Ergebnis-Links, Statistik
- Teilnehmer (mobil 412×915): Tabelle, Status-Chip, Vordruck-Modal
- Übungsleitung (Desktop): Teilnehmerliste, Nachrichtenplan; X-Zeit-Cockpit
- Admin, eine Inhaltsseite (`/funkuebung-thw/`)
- je Theme eine automatische Kontrastmessung aller sichtbaren Textknoten (WCAG-Ratio gegen den tatsächlich darunterliegenden Hintergrund)
- Simulation von Deuteranopie und Achromatopsie (CDP `Emulation.setEmulatedVisionDeficiency`) für Teilnehmer und Nachrichtenplan
- Theme-Wechsel mit halb ausgefülltem Formular, Wechsel der Systemeinstellung, erstes Paint vor dem Laden von JS

Screenshots: `scratchpad/night-visibility/{light,dark}-NN-*.png` (Sitzungs-Scratchpad, nicht eingecheckt).

**Nicht prüfbar:** Reale Umgebungshelligkeit, Displayhelligkeit, Spiegelung und Sonnenlicht ließen sich nicht simulieren. Die Aussagen zu Sonne und Dunkelheit stützen sich auf gemessene Kontraste und sichtbare Codierung. Das PDF-Rendering im Vordruck-Modal schlug in der Test-Chromium-Version fehl (`TypeError: …getOrInsertComputed is not a function` aus pdf.js), die Canvas blieb leer. Wie der invertierte Vordruck im Dark Mode aussieht, konnte deshalb nicht angesehen werden (siehe Befund 8).

---

## Urteil

Die App ist für Dunkelheit und Sonne in einem guten Zustand. Der Dark Mode ist eine eigene Farbbelegung und keine Invertierung. In beiden Themes fand die Kontrastmessung über Generator, Teilnehmer, Übungsleitung und Inhaltsseite **keinen einzigen Text unter WCAG AA**. Ausnahmen gibt es nur bei deaktivierten Blätter-Buttons im Admin und bei einem Hover-Zustand. Den Status zeigt die App nie nur über Farbe: Chips wie `OFFEN`, `ÜBERTRAGEN` und `ABGESETZT` stehen als Text in Versalien da. In Graustufen und bei Rot-Grün-Schwäche bleiben sie lesbar.

Reibung entsteht an drei Stellen:
1. **Das Theme ist nicht vorhersehbar.** Eine Änderung der Systemeinstellung überschreibt die bewusst gewählte Einstellung. Inhaltsseiten ignorieren das dunkle System-Theme. Vor dem Laden von JS wird kurz hell gerendert.
2. **Diagramme haben keine Dark-Mode-Farben.** Achsenbeschriftung und Raster bleiben auf den Chart.js-Standardwerten (Generator-Statistik, Übungsleitungs-Zeitleiste). Der Admin-Bereich macht es bereits richtig.
3. **Auf dem Smartphone ist die Statusspalte abgeschnitten.** Die Spalte, die man im Halbdunkel am schnellsten erfassen will, sieht man nur zur Hälfte.

Die Aufgaben lassen sich in beiden Themes ohne fremde Hilfe erledigen.

---

## Befunde

### Befund 1 – Systemwechsel überschreibt die gewählte Einstellung (P2)

1. **Priorität:** P2
2. **Fundstelle / Aufgabe:** Alle App-Routen, Umschalter `#themeToggle` / `#themeToggleMobile`; `src/core/ThemeManager.ts:59-64`
3. **Beobachtung:** Im Test ist das System hell eingestellt, der Nutzer klickt auf „Dark Mode“, `localStorage.theme` steht danach auf `"dark"`. Danach wechselt das System (z. B. automatischer Hell-Dunkel-Wechsel am Smartphone bei Sonnenuntergang oder -aufgang) und die Oberfläche springt auf **hell**, obwohl `"dark"` gespeichert bleibt (gemessen: `nachSystemwechsel: ["light","dark"]`). Nach dem nächsten Neuladen ist sie wieder dunkel. Ursache: Die Bedingung `!storedTheme || storedTheme === "light" || storedTheme === "dark"` ist für jede gespeicherte Wahl wahr.
4. **Erwartung der Rolle:** Wer bewusst „dunkel“ eingestellt hat, behält dunkel, bis er selbst umschaltet.
5. **Auswirkung im Einsatz:** Abends am Übungsabend wechselt das Handy des Teilnehmers mitten in der Übung, und der Bildschirm wird plötzlich hell. Die Augen sind gerade an die Dunkelheit gewöhnt, man ist geblendet und verliert die Zeile. Nach einem Reload ändert sich das Theme erneut, das wirkt willkürlich. Die Daten bleiben erhalten, der Wechsel unterbricht keinen Vorgang (geprüft: halb ausgefülltes Formular bleibt nach dem Umschalten erhalten).
6. **Empfehlung:** Der Systemwechsel sollte nur greifen, solange der Nutzer nichts selbst gewählt hat. Eine eigene Wahl hat Vorrang. Optional eine dritte Stellung „wie System“ anbieten.
7. **Verifikation:** E2E: `colorScheme: light`, umschalten auf dark, `emulateMedia({colorScheme:"light"})` → `body[data-theme]` bleibt `dark`.

### Befund 2 – Kurzer heller Blitz vor dem Laden von JS und Inhaltsseiten ohne System-Dunkel (P2)

1. **Priorität:** P2
2. **Fundstelle / Aufgabe:** Laden und Neuladen jeder Route. `src/index.html:47` (`<body data-theme="light">`), Theme erst in `ThemeManager.init()` aus dem Modul-Bundle. Statische Seiten, z. B. `src/pages/funkuebung-thw.html:39-46`: Das Theme wird erst bei `DOMContentLoaded` gesetzt und nur, wenn etwas gespeichert ist.
3. **Beobachtung:**
   - `theme=dark` ist gespeichert, das Bundle wird künstlich um 1,5 s verzögert: Die Seite erscheint zuerst komplett im **hellen** Theme mit Hintergrund `rgb(243,245,249)` (`dark-13-erstes-paint-vor-js.png`). Bei schneller Verbindung dauert das nur Millisekunden, bei schlechtem Netz in der Halle oder im Gelände spürbar länger.
   - Das System ist dunkel und nichts gespeichert: Die App wird dunkel, die Inhaltsseite `/funkuebung-thw/` bleibt **hell** (gemessen: `statischSystemDunkel: "light"`, `appSystemDunkel: "dark"`).
   - Die Routen laufen über Neuladen. Beim Wechsel Generator → Teilnehmer → Übungsleitung tritt der Blitz also wiederholt auf.
4. **Erwartung der Rolle:** Ist der Bildschirm einmal dunkel, bleibt er beim Laden und beim Klick auf „Anleitung“ oder „FAQ“ dunkel.
5. **Auswirkung im Einsatz:** Bei Nacht blendet jeder weiße Blitz. Wer aus dem Teilnehmerlink kurz die Buchstabiertafel oder die Anleitung öffnet, bekommt eine ganz helle Seite. Das kann Nachtsicht kosten, und das Display leuchtet in einem abgedunkelten Raum für alle sichtbar auf.
6. **Empfehlung:** Das gespeicherte Theme bzw. die Systemeinstellung so früh setzen, dass schon das erste Bild stimmt: in App und Inhaltsseiten gleich, mit derselben Fallback-Regel auf das System-Theme.
7. **Verifikation:** Playwright mit verzögertem `bundle.js` und `theme=dark` → erster Screenshot hat einen dunklen Hintergrund. Mit `colorScheme: dark` ohne gespeichertes Theme → `/funkuebung-thw/` hat `data-theme="dark"`.

### Befund 3 – Diagramme bleiben im Dark Mode bei hellen Standardfarben (P2)

1. **Priorität:** P2
2. **Fundstelle / Aufgabe:** Generator → Ergebnis → Tab „Statistik“ (`#distributionChart`, `src/generator/GeneratorResultRenderer.ts:48-66`). Übungsleitung-Zeitleiste (`src/uebungsleitung/UebungsleitungNachrichtenView.ts:410-450`).
3. **Beobachtung:** Im Dark Mode sind die Achsentitel („Anzahl der Nachrichten“, „Teilnehmer“), die Teilnehmernamen an der X-Achse, die Ticks und die Legende sichtbar dunkelgrau auf fast schwarzem Grund (`dark-03-generator-stats.png`), die Rasterlinien fehlen praktisch ganz. Beide Diagramme setzen keine Text- oder Rasterfarbe und laufen auf den Chart.js-Defaults (für hellen Grund gedacht, rechnerisch rund 3:1 auf `--flaeche`). Die Zeitleiste der Übungsleitung nutzt zusätzlich `#9ca3af` für „Empfangen“, das auf dunklem Grund nur schwach von den Linien absticht. Die Admin-Statistik macht es dagegen richtig (`AdminView.ts:188-200`, Farben aus den Tokens, Neuzeichnen beim Theme-Wechsel; `dark-10-admin.png` ist gut lesbar). Die Zeitleiste selbst wurde nicht angesehen: Der Canvas war im Test nicht sichtbar, der Befund dazu stützt sich auf den Code.
4. **Erwartung der Rolle:** Die Teilnehmernamen unter den Balken sind genauso lesbar wie der übrige Text.
5. **Auswirkung im Einsatz:** Gering. Die Statistik dient der Vorbereitung und der Abschätzung, wer wie viele Sprüche bekommt. Abends am Laptop muss die Übungsleitung die schräg gestellten, schwachen Namen aber erst entziffern. Falsche Entscheidungen drohen dadurch nicht.
6. **Empfehlung:** Alle Diagramme so einfärben wie die Admin-Statistik, also aus den Theme-Farben, und sie beim Theme-Wechsel neu zeichnen.
7. **Verifikation:** Screenshot der Statistik im Dark Mode: Achsentexte mindestens 4,5:1 und Raster erkennbar. Theme umschalten → das Diagramm zeichnet sich neu.

### Befund 4 – Statusspalte auf dem Smartphone abgeschnitten (P2)

1. **Priorität:** P2
2. **Fundstelle / Aufgabe:** Teilnehmer, mobil 412 px, Tabelle `#teilnehmerNachrichtenBody`, Spalte „Status“ (`.btn-toggle-uebertragen-chip`)
3. **Beobachtung:** In beiden Themes ragt die Tabelle über den rechten Rand. Der Status-Chip ist nur angeschnitten sichtbar: „OFFE…“ bzw. „ÜBERTRAGE…“ (`light-05-teilnehmer-mobil-status.png`, `dark-04-teilnehmer-mobil.png`, `dark-05b-teilnehmer-mobil-full.png`). Ist die Tabelle seitlich gescrollt, verschwindet links die Spalte „Nr.“. Die Kopfkarte hat rechts neben „ZIP herunterladen“ ebenfalls ein angeschnittenes Element.
4. **Erwartung der Rolle:** Der Status jeder Zeile ist ohne seitliches Wischen vollständig zu sehen, zusammen mit der Nummer.
5. **Auswirkung im Einsatz:** Bei schwachem Licht und gedimmtem Display erkennt man den Status vor allem an der Wortlänge. Ist das Wort halb abgeschnitten, bleibt nur die Farbe des Rahmens (Gelb gegen Grün), und genau die verschwimmt bei wenig Licht bzw. bei Rot-Grün-Schwäche. Man wischt zusätzlich und kann dabei die Zeile verlieren. (Die Ursache ist das Layout. Für die Nachtsicht relevant ist, dass dadurch die Text-Codierung wegfällt.)
6. **Empfehlung:** Den Status in der schmalen Ansicht in voller Breite in der Zeile zeigen (z. B. unter dem Nachrichtentext oder als Zeilenkopf), Nummer und Status immer sichtbar.
7. **Verifikation:** Screenshot bei 360 px und 412 px Breite: Chip-Text vollständig, keine horizontale Scrollbreite der Tabelle.

### Befund 5 – Aktionsknopf „✓ abgesetzt“ sieht aus wie ein Status (P2)

1. **Priorität:** P2
2. **Fundstelle / Aufgabe:** Übungsleitung → Nachrichtenplan, Spalte „Abgesetzt“ (`#uebungsleitungNachrichten button[data-action='abgesetzt']`)
3. **Beobachtung:** Neben dem Status-Chip `OFFEN` steht der Knopf „✓ abgesetzt“. Er ist grün umrandet, hat grüne Schrift und einen Haken, also genau die Merkmale des erledigten Status. In Graustufen (`light-09-uebungsleitung-nachrichten-achromatopsia.png`) und bei Deuteranopie (`dark-09-…-deuteranopia.png`) sehen beide Elemente fast gleich aus, der Knopf wirkt wie ein zweiter Status. Ein abgesetzter Spruch hat dagegen den Chip `ABGESETZT` plus einen roten Rückgängig-Knopf `↺`.
4. **Erwartung der Rolle:** Auf einen Blick ist klar: Was ist der Zustand, was ist die Aktion?
5. **Auswirkung im Einsatz:** Die Übungsleitung scannt bei gedimmtem Laptop die Spalte. Eine Zeile mit „OFFEN ✓ abgesetzt“ kann als erledigt gelesen werden, und man übersieht einen offenen Spruch. In der Ausbildung bleibt die Folge klein (der Spruch wird später nachgeholt), das Missverständnis steckt aber in der Darstellung selbst.
6. **Empfehlung:** Die Aktion sprachlich und optisch vom Status trennen, z. B. „Als abgesetzt markieren“ ohne Haken und neutral gestaltet. Haken und Grün bleiben dem erledigten Zustand vorbehalten.
7. **Verifikation:** Graustufen-Screenshot des Nachrichtenplans: Ein Betrachter ohne Vorwissen ordnet die Zeilen in fünf Sekunden richtig nach offen und abgesetzt.

### Befund 6 – Kleine Schalter im Dark Mode kaum sichtbar (P3)

1. **Priorität:** P3
2. **Fundstelle / Aufgabe:** Teilnehmer „Übertragene ausblenden“ (Tabelle und Vordruck-Modal), Nachrichtenplan „Ausblenden“
3. **Beobachtung:** Der Schalter ist im Dark Mode im ausgeschalteten Zustand ein dunkles Rechteck mit sehr schwacher Kontur auf dunklem Grund (`dark-04-teilnehmer-mobil.png`, `dark-14-vordruck-desktop.png`). Im Light Mode sieht man Knopf und Kontur (`light-05-…`).
4. **Erwartung der Rolle:** Man erkennt, dass es ein Schalter ist und in welcher Stellung er steht.
5. **Auswirkung im Einsatz:** Wer nicht weiß, dass ein Filter aktiv ist, sucht übertragene Sprüche vergeblich. Der Text daneben hilft, die Stellung bleibt bei Nacht aber unklar.
6. **Empfehlung:** Kontur und Knopf des Schalters im Dark Mode deutlicher absetzen und den Zustand zusätzlich als Text anzeigen („an/aus“ oder „ausgeblendet: n“).
7. **Verifikation:** Kontrast zwischen Schalterrand bzw. Knopf und Umgebung mindestens 3:1 in beiden Themes.

### Befund 7 – Grelle Flächen und `theme-color` im Dark Mode (P3)

1. **Priorität:** P3
2. **Fundstelle / Aufgabe:** `src/index.html:11` `<meta name="theme-color" content="#0d6efd">` (gilt für beide Themes, gemessen nach dem Umschalten). Generator-Ergebnis: „Alle Druckdaten als ZIP herunterladen“ als vollbreite, helle Blaufläche (`dark-02-generator-links.png`).
3. **Beobachtung:** Mobile Browser färben ihre Adressleiste in kräftigem Hellblau, auch wenn die Seite dunkel ist. Die Farbe passt weder zum dunklen noch zum hellen Kopfbalken (`--kopf-fond`). Die ZIP-Fläche ist im Dark Mode die hellste Fläche auf der Seite.
4. **Erwartung der Rolle:** Der ganze Bildschirm ist im Dark Mode gleichmäßig gedämpft, nur Warnungen stechen hervor.
5. **Auswirkung im Einsatz:** Der hellblaue Balken oben leuchtet in einem dunklen Raum dauerhaft. Gering, aber überflüssig.
6. **Empfehlung:** Die `theme-color` je Theme an den Kopfbalken anpassen und die Fläche großer Primärknöpfe im Dark Mode etwas dämpfen.
7. **Verifikation:** Mobil im Dark Mode: Adressleiste dunkel. Helligkeitsvergleich der größten Flächen im Screenshot.

### Befund 8 – Vordruck im Dark Mode wird invertiert dargestellt (P3, nicht abschließend prüfbar)

1. **Priorität:** P3
2. **Fundstelle / Aufgabe:** Teilnehmer → „Meldevordruck“ / „Nachrichtenvordruck“. `src/styles/main.css:2010-2012` (`filter: invert(1) hue-rotate(180deg)`)
3. **Beobachtung:** Im Dark Mode bekommt die Vordruck-Canvas eine Invertierung (gemessen am Computed Style). Weil pdf.js in der Test-Chromium-Version nicht renderte, blieb die Canvas in beiden Themes leer, das Ergebnis konnte also nicht angesehen werden. Auf dem Smartphone liegt außerdem der Modal-Titel „Vordruck“ halb unter dem App-Kopf (`dark-15-vordruck-mobil.png`).
4. **Erwartung der Rolle:** Nachts ein dunkles Blatt. Wer aber den gleichen Vordruck auf Papier vor sich hat, erkennt Felder und Farbkennungen wieder.
5. **Auswirkung im Einsatz:** Plausibles Risiko: Farbige Feldmarkierungen des Vordrucks (falls vorhanden) bekommen durch `hue-rotate` andere Helligkeiten. Ein Vergleich mit dem Papiervordruck kostet dann einen Moment.
6. **Empfehlung:** In einem aktuellen Browser nachts prüfen, ob Feldbezeichnungen und Kennfarben invertiert eindeutig bleiben. Sonst einen Umschalter „Vordruck hell/dunkel“ im Modal anbieten.
7. **Verifikation:** Screenshot des gerenderten Vordrucks in beiden Themes nebeneinander, Feldbezeichnungen lesbar, Farbfelder unterscheidbar.

### Befund 9 – Einzelne Kontrastschwächen in Neben­zuständen (P3)

1. **Priorität:** P3
2. **Fundstelle / Aufgabe:**
   - Admin `#adminPrevPage` / `#adminNextPage` deaktiviert: 2,55:1 (Light) bzw. 4,25:1 (Dark) bei 13 px
   - Dark: `#startUebungBtn` im Hover-Zustand weiß auf `rgb(91,125,214)`: 3,93:1
3. **Beobachtung:** Das sind die einzigen Treffer der Kontrastmessung unter AA, in sämtlichen geprüften Ansichten und beiden Themes.
4. **Erwartung der Rolle:** Auch „gerade nicht verfügbar“ ist lesbar.
5. **Auswirkung im Einsatz:** Vernachlässigbar, ein deaktivierter Zustand darf schwächer sein. Aufgeführt, damit die Messung vollständig ist.
6. **Empfehlung:** Keine dringende Änderung. Der Hover-Kontrast des Primärknopfs im Dark Mode könnte angehoben werden.
7. **Verifikation:** Die Kontrastmessung erneut laufen lassen.

---

## Positiv beobachtet (keine Maßnahme nötig)

- Der Status ist immer **Text plus Farbe plus Rahmen bzw. Randstreifen**: `OFFEN`, `ÜBERTRAGEN`, `ABGESETZT`, `keine Meldung`, `7 hinter Plan`. Die Graustufen- und Deuteranopie-Simulation zeigt keinen Zustand, der nur über Farbe codiert ist.
- Fließtext und Tabellen erreichen in beiden Themes WCAG AA. Light Mode für Sonnenlicht: dunkle Schrift (`--text #11141b`) auf Weiß, kräftige Rahmen.
- Der Dark Mode ist keine reine Invertierung. Die Signalfarben sind eigens für den dunklen Grund aufgehellt.
- Uhrzeit, Laufzeit und X-Zeit im Cockpit stehen groß und in Monospace und sind auch auf Abstand lesbar (`dark-16-cockpit.png`).
- Der Theme-Wechsel verliert keine Eingaben (Formularwert nach dem Umschalten erhalten).

---

## Abschluss

- **Aufgabe geschafft:** ja
- **Fremde Hilfe nötig:** nein
- **Größtes Missverständnis:** Der grüne Knopf „✓ abgesetzt“ neben `OFFEN` lässt einen offenen Spruch bei schwachem Licht und in Graustufen wie erledigt aussehen.
- **Größtes Einsatzrisiko:** Mitten in einer Abendübung springt das Theme durch den automatischen Systemwechsel ungefragt von dunkel auf hell und blendet den Helfer.
- **Top-Priorität für die nächste Iteration:** Das Theme vorhersehbar machen: Eine eigene Wahl hat Vorrang vor dem System, das richtige Theme gilt schon ab dem ersten Bild, Inhaltsseiten verwenden dieselbe Regel (Befunde 1 und 2).
