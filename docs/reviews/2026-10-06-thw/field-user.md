Befunde: P0=0 P1=0 P2=1 P3=7
Abgleich: behoben=5 teilweise=3 offen=1 nicht-pruefbar=0

# THW-Field-User-Review (3. Lauf) – Sprechfunk Übungsgenerator

Reviewer: field-user (Skill `thw-field-user-reviewer`), 2026-10-06
Methode: Live-Test gegen den lokalen Build (`http://127.0.0.1:3000`, Mock-Firestore im localStorage), Playwright mit Chromium 1194.
Screenshots: `scratchpad/field-user3/` dieser Sitzung (die Dateinamen stehen unten als Beleg).

## Rahmen

- **Geräte/Viewports:** Pixel 7 (412×839 CSS-px, Touch) als Hauptgerät, iPhone SE (320×568) als kleinstes Gerät, Desktop 1366×900 für Generator und zum Setzen der X-Zeit, Übungsleitung auch auf 412 px. Hell- und Dunkelmodus.
- **Testdaten:** zwei neu erzeugte Übungen mit je vier Teilnehmern (Vorlage „THW Leer“): klassisch mit 12 Sprüchen je Teilnehmer (Übungscode FFVEWF), X-Zeit mit 6 Sprüchen, Intervall 2 min und Offset 1 min (GSGJU7).
- **Szenarien** (abgeleitet, es war kein Auftrag vorgegeben):
  1. Helfer tippt die Codes vom Zettel auf der Startseite ein, mit einem Tippfehler („O“), korrigiert und kommt in die Übung. – **ja**
  2. Helfer öffnet den Kurzlink mit falschem Teilnehmercode, korrigiert und kommt in die Übung. – **ja**
  3. Fünf Sprüche abhaken, den Link neu öffnen und den nächsten offenen Spruch finden. – **ja**
  4. Abhaken ohne Netz (`context.setOffline`), danach wieder online. – **ja** (Zustand an der Karte erkennbar)
  5. Übungsleitung bestätigt einen gemeldeten Spruch; der Helfer sieht die Bestätigung. – **ja**
  6. X-Zeit-Übung auf dem iPhone SE: warten, die Übungsleitung setzt die X-Zeit, im Fokus-Modus abhaken und zurücknehmen. – **mit Schwierigkeiten** (der Knopf liegt unter dem Bildschirmrand)
  7. Vordruck-Ansicht am Handy öffnen und darin abhaken. – **ja**
  8. Übungsleitung am Handy: Lage überblicken, Anmeldung bestätigen, Spruch im Plan finden. – **ja**, mit langem Scrollweg
- **Mentales Modell des Helfers:** „Ich bin Heros Oldenburg 21/11. Ich will sehen, was ich als Nächstes an wen funke, und nach dem Funken abhaken – wie auf dem Spruchzettel. Wenn die Leitung es hat, ist gut.“ Er denkt in Sprüchen, Häkchen und „hat die Leitung's?“, nicht in Synchronisation oder Ansichten.

Kontext: Die App ist ein Ausbildungswerkzeug für den Dienstabend, kein Einsatzsystem. Handschuhe, Kälte und Funklöcher kommen bei Übungen im Freien oder im Fahrzeug vor, aber seltener als im Einsatz; die Prioritäten sind entsprechend gesetzt.

**Gesamteindruck:** Für die Teilnehmerrolle am Handy ist die App jetzt rund. Diese Punkte bei einem Redesign erhalten:
- Karten mit „ALS NÄCHSTES“ und einem großen Knopf „Als abgesetzt markieren“ (339×48 px).
- An jeder abgehakten Karte steht der Übertragungsstand: „Wird an die Übungsleitung gesendet …“, „An die Übungsleitung gesendet“, „Leitung hat bestätigt 08:26“, offline gelb „⚠ Nur auf diesem Gerät – wird gesendet, sobald Netz da ist“.
- Rückgängig-Leiste und „Zurücknehmen“ an jeder Karte.
- Beim Öffnen springt die Seite zum nächsten offenen Spruch.
- Der Vordruck öffnet auf dem nächsten offenen Spruch und hat große Knöpfe (Zurück 96×48, Abhaken 185×60, Weiter 91×48, Schließen 126×44).
- Ein ungültiges Zeichen im Code wird benannt.
- Die Übungsleitung zeigt Teilnehmer und Plan auch am Handy als Karten.

Es gibt keinen Befund mehr mit P0 oder P1.

---

## Befunde

### [P2] X-Zeit-Fokus auf kleinem Handy: der fällige Spruch und sein Knopf liegen unter dem Bildschirmrand

**Evidence:** Observed
**Where:** Teilnehmeransicht der X-Zeit-Übung, iPhone SE (320×568), Fokus-Modus (am Handy automatisch an). Vor dem Start: `se-30-xzeit-vor-start.png`, `se-30b-full.png`. Nach dem Setzen durch die Übungsleitung: `se-31-xzeit-gesetzt.png`, `se-31b-full.png`.
**Field-user reaction:** „Oben steht ‚1 jetzt fällig‘ – und wo ist der Spruch?“ Er sieht Kopfkarte und X-Zeit-Karte und muss scrollen, um den Spruch zu lesen und den Knopf zu finden.
**Problem:** Vor dem Fokus-Inhalt stehen der Seitenkopf mit Titel und Datum-Zeit-Gruppe (DTG), die Zeile „☰ Menü“, die Kopfkarte (Übungsname, Live-Badge, Ich/Rufgruppe/Übungsleitung) und die X-Zeit-Karte (Text, Countdown-Zeile, Fokus-Schalter, „Ohne Übungsleitung üben …“). Die Fokus-Karte beginnt bei y ≈ 495. Der Knopf „Als abgesetzt markieren“ liegt bei y = 667 und endet bei 714, die Bildhöhe ist 568. Vor dem Start gilt dasselbe für die neue Vorschau „Dein erster Spruch: Nr. 1 an Heros Wind 10, 0 min nach der X-Zeit“: Sie ist gut, steht aber unter dem ersten Bildschirm. Auf dem Pixel 7 tritt das Problem nicht auf.
**Operational impact:** Im X-Zeit-Modus zählt die Minute. Bei jedem fälligen Spruch muss der Helfer erst scrollen, und nach dem Abhaken springt die Seite wieder nach oben (`se-32-fokus-nach-tap.png`, scrollY 406). Mit kleinem Handy oder Handschuh kostet das Zeit, und der Countdown liegt dabei außer Sicht.
**Recommendation:** Im Fokus-Modus den Kopf verdichten:
- die Kopfkarte auf eine Zeile kürzen („21/11 · T_OL_GOLD-1“);
- die X-Zeit-Karte nach dem Start auf eine Zeile reduzieren („X 08:25 · Nächste in 2:14“);
- Fokus-Schalter und „Ohne Übungsleitung üben“ unter den fälligen Spruch verschieben.

Alternativ beim Fälligwerden den fälligen Spruch automatisch ins Bild scrollen.
**Retest:** iPhone SE, X-Zeit gesetzt, fälliger Spruch: Empfänger, Text und Knopf sind ohne Scrollen sichtbar. Vor dem Start ist die Vorschau „Dein erster Spruch …“ ohne Scrollen sichtbar.

### [P3] Nach jedem Abhaken wandert der nächste Spruch nach unten

**Evidence:** Observed
**Where:** Teilnehmeransicht, klassische Übung, Pixel 7, Liste. Ohne Zutun der Testautomatik gemessen (Klick per DOM, ohne automatisches Scrollen): Knopf des nächsten offenen Spruchs bei y = 557 → 833 → 1131 → 1430 → 1752 → 2027 nach 0 bis 5 abgehakten Sprüchen, die Bildhöhe ist 839. Beleg `p-20-nach5-ohne-autoscroll.png`.
**Field-user reaction:** Er hakt Spruch 1 ab und sieht danach Spruch 1 in Grün, groß – „und weiter?“, dann scrollt er.
**Problem:** Eine abgehakte Karte wird höher als eine offene: Sie bekommt Statuszeile, Sendekasten und „Zurücknehmen“. Die Seite folgt dem Fortschritt nicht. Beim erneuten Öffnen springt sie dagegen richtig zum nächsten offenen Spruch (`p-21-neuer-tab-nach5.png`, Knopf bei y = 464).
**Operational impact:** Gering. Der nächste Spruch steht direkt darunter und trägt „ALS NÄCHSTES“, aber jeder Spruch kostet einen Wisch.
**Recommendation:** Nach Ablauf der Rückgängig-Frist die abgehakte Karte auf eine Zeile einklappen („Nr. 1 ✓ 08:24 · gesendet – Zurücknehmen“) oder sanft zum nächsten offenen Spruch scrollen. Dasselbe Verhalten wie beim Öffnen.
**Retest:** Pixel 7, fünf Sprüche nacheinander abhaken, ohne zu scrollen: Der nächste Knopf bleibt im Bild.

### [P3] Die mitlaufende Offline-Leiste läuft nicht mit

**Evidence:** Observed
**Where:** `#teilnehmerSyncLeiste` („Keine Verbindung zur Übungsleitung – neue Markierungen bleiben vorerst auf diesem Gerät …“). Offline bei scrollY 1626 gemessen: Die Leiste steht bei y = −1194, ist also nicht sichtbar, obwohl sie `position: sticky; top: 0` hat (`src/styles/main.css:2572`). Sie sitzt im Kopfbereich (`src/teilnehmer/kopfMarkup.ts:100`), und ihr Container scrollt mit weg. Belege `p-15-offline-vor.png`, `p-22-offline-start.png`.
**Field-user reaction:** Netz ist weg, er sieht davon nichts, bis er abhakt.
**Problem:** Der Hinweis soll mitlaufen, steht aber nur oben auf der Seite. Weil die Seite beim Öffnen zum nächsten Spruch springt, ist er praktisch nie zu sehen. Die gelbe Warnung an der Karte gleicht das nach dem Abhaken aus, und die Rückgängig-Leiste („Spruch 6 als abgesetzt markiert.“) erwähnt den Offline-Zustand nicht.
**Recommendation:** Die Leiste außerhalb des Kopf-Containers platzieren (direkt im scrollenden Hauptbereich oder fest am oberen Rand). In der Rückgängig-Leiste offline „… – nur auf diesem Gerät“ ergänzen.
**Retest:** Pixel 7, zu Spruch 6 scrollen, Flugmodus an: Der Hinweis erscheint ohne Scrollen im Bild und verschwindet nach Netzrückkehr.

### [P3] Rückgängig-Leiste deckt oben Inhalt ab

**Evidence:** Observed
**Where:** Rückgängig-Leiste „Spruch N als abgesetzt markiert. – Rückgängig“ (oben, ca. 8 s). Auf dem Pixel 7 und dem iPhone SE überdeckt sie den oberen Kartenrand bzw. Kopf (`p-16-offline-abgehakt.png`: „Zurücknehmen“ von Nr. 4 halb verdeckt; `se-32-fokus-nach-tap.png`: Fokus-Schalter verdeckt).
**Field-user reaction:** Tippt oben auf „Zurücknehmen“ und trifft die Leiste oder deren Rückgängig-Knopf.
**Problem:** Die Leiste liegt über bedienbaren Elementen. Das ist kein Datenverlust, denn beide Knöpfe nehmen zurück, aber es sind unerwartete Treffer.
**Recommendation:** Die Leiste unten am Bildschirm anzeigen, im Daumenbereich. Dort liegt auch der Knopf, den der Helfer gerade gedrückt hat, oder sie bekommt einen eigenen Platz, der den Inhalt nach unten schiebt.
**Retest:** Pixel 7, abhaken: In den 8 s ist keine Schaltfläche der Liste verdeckt.

### [P3] „Ohne Übungsleitung üben“ und „Abhak-Stand zurücksetzen“ sehen nicht aufklappbar aus

**Evidence:** Observed
**Where:** X-Zeit-Karte, Zeile „Ohne Übungsleitung üben: X-Zeit selbst setzen“ (`se-30`, `se-31`), und „Abhak-Stand komplett zurücksetzen“ am Seitenende (`se-31b-full.png`). Beides sind `<summary>` mit `display: flex` (`src/styles/main.css:2640`, `:2709`). Dadurch verschwindet das Aufklapp-Dreieck.
**Field-user reaction:** Die graue Zeile liest er als Erklärtext, nicht als Schalter. Den roten Kasten hält er für einen Knopf, der sofort alles löscht.
**Problem:** Eine fehlende Aufklapp-Kennung verbirgt die Funktion „Ohne Übungsleitung üben“. Gut ist: Das Zurücksetzen ist zweistufig, mit Erklärtext und dem eigentlichen Knopf „Abhak-Stand für alle zurücksetzen“ (`p-40-reset-klick.png`). Nach dem Setzen durch die Übungsleitung bleibt „Ohne Übungsleitung üben“ sichtbar, samt Feld und „Neu starten“ (`se-33-selbst-setzen.png`).
**Recommendation:** Ein Pfeil (▸/▾) vor beiden Zeilen. „Ohne Übungsleitung üben“ ausblenden oder ausgrauen, solange die Übungsleitung die X-Zeit führt.
**Retest:** Drei Helfer ohne Einweisung: Sie erkennen beide Zeilen als aufklappbar, und keiner erwartet ein sofortiges Löschen.

### [P3] Rest-Fachjargon in Kopf und Übungsleitung

**Evidence:** Observed
**Where:**
- Teilnehmer: die DTG „060823oct26“ im Seitenkopf (`p-11-start.png`) und „Meldung 1 fällig · X+0“ (`se-31`).
- Übungsleitung: „zuletzt 060826oct26“, „angemeldet 060826oct26“, „TN 1 · Leitung 0“ (`src/uebungsleitung/teilnehmerMarkup.ts:204`), „ETA: – (zu wenig Daten)“, „Live-Status“, „Tempo“, „Abs.-Nr.“ (`p-52-ul-plan.png`, `p-57-ul-plan.png`).
**Field-user reaction:** „TN 1 · Leitung 0 – heißt das, die Leitung hat nichts?“ Die DTG in Kleinbuchstaben („oct“) liest er stockend.
**Problem:** Viel ist besser geworden: „Übungsleitung: live · alles gesendet 08:23“ statt „Sync“, „Nr. 2 bei X+3 min“, „Sprüche je 5 min“ statt „Heatmap“, dazu „Was bedeuten die Kennzahlen?“. Für einen Zeitstempel ist die DTG in der Teilnehmer- und Übungsleitungsansicht aber die schwerste Form. Eine Uhrzeit „08:26“ genügt.
**Recommendation:** In Karten Uhrzeit statt DTG verwenden, die DTG nur im Vordruck. „TN 1 · Leitung 0“ → „1 vom Teilnehmer gemeldet, 0 von dir bestätigt“. „X+0“ → „jetzt“.
**Retest:** Ein Übungsleiter ohne Einweisung erklärt jede Angabe der Teilnehmerkarte richtig.

### [P3] Zwei Menü-Knöpfe am Handy

**Evidence:** Observed
**Where:** Seitenkopf: das Symbol ☰▾ oben rechts (68×36 px) und darunter die Zeile „☰ Menü“ (`p-01-start.png`, `p-11-start.png`, `se-30`).
**Field-user reaction:** „Welches Menü ist das richtige?“
**Problem:** Es gibt zwei gleich aussehende Einstiege mit verschiedenem Inhalt (Einstellungen/Dark Mode bzw. Seiten-Navigation). Der obere ist nur 36 px hoch. In der Teilnehmerrolle braucht der Helfer keinen der beiden, sie kosten aber Höhe (siehe P2).
**Recommendation:** Am Handy einen einzigen beschrifteten Menü-Knopf mit mindestens 44 px. In der Teilnehmerrolle den Kopf verkleinern.
**Retest:** Helfer ohne Einweisung findet „Dark Mode“ und „Anleitung“ beim ersten Versuch.

### [P3] Übungsleitung am Handy: langer Weg zum Nachrichtenplan

**Evidence:** Observed
**Where:** `#/uebungsleitung/<id>` auf dem Pixel 7, vier Teilnehmer. Die Seite ist ca. 19.800 CSS-px lang (`p-50b-ul-mobil-full.png`). Der Plan beginnt erst nach vier Teilnehmerkarten mit Stärke-Eingabe, Notiz und Debrief.
**Field-user reaction:** Der Übungsleiter will nachsehen, was 23/13 als Nächstes funkt, und wischt lange.
**Problem:** Die Karten selbst sind gut lesbar und bedienbar (`p-51`, `p-52`, `p-57`), und „Als Nächstes“ springt per Knopf in den Plan. Bei 8 bis 10 Teilnehmern wird der Weg aber lang. „Teilnehmer einklappen“ ist vorhanden, standardmäßig aber aus.
**Recommendation:** Am Handy die Teilnehmerkarten standardmäßig auf Name, Fortschritt und Anmelde-Knopf einklappen; Stärke, Notiz und Debrief aufklappbar. Oder eine Sprungleiste „Lage · Teilnehmer · Plan“.
**Retest:** Pixel 7 mit 8 Teilnehmern: Der Plan ist mit höchstens zwei Wischbewegungen erreichbar.

### Nicht verifiziert

- **Echtes Funkloch:** Der Mock arbeitet mit dem localStorage. Die Anzeige „Nur auf diesem Gerät“ und der Übergang zu „An die Übungsleitung gesendet“ funktionieren im Mock. Ob mit echtem Firestore im Flugmodus nachgereicht wird, muss auf einem Gerät geprüft werden.
- **Uhrzeitfeld:** Das Feld „Eigene X-Zeit“ zeigte wieder „08:27 AM“ (`se-33-selbst-setzen.png`), obwohl der Kontext auf de-DE stand. Das kommt vermutlich aus dem headless-Chromium. Auf einem deutsch eingestellten Android- und iOS-Gerät prüfen.
- **Sonnenlicht/Nacht:** Der Dunkelmodus ist lesbar, der Status steht als Wort, Symbol und Farbe (`p-56-dark.png`). Ein Test draußen steht aus.
- **Handschuhe:** Nur über die Maße bewertet. Die Hauptknöpfe haben mindestens 44 px, die Schalterzeilen sind als ganze Zeile tippbar (145×44, 202×44).
- **Vordruck-Lesbarkeit:** Feldbeschriftungen im gerenderten Vordruck (`p-55-vordruck.png`) sind klein. Ob man ohne Zoom draußen lesen kann, wurde nicht getestet.

---

## Comprehension check

- **Orientation:** understood. Rolle, Funkrufname, Rufgruppe und Übungsleitung stehen in der Kopfkarte. Abzug: zwei Menüs.
- **Next action:** understood beim Öffnen und nach Unterbrechung („ALS NÄCHSTES“, Sprung zum nächsten offenen Spruch); uncertain im X-Zeit-Fokus auf kleinem Handy, weil der Knopf unter dem Rand liegt.
- **System status:** understood. Der Übertragungsstand steht an jeder Karte (wird gesendet / gesendet / nur auf diesem Gerät / Leitung hat bestätigt), dazu das Badge „Übungsleitung: live · alles gesendet“.
- **Error recovery:** understood. Fehlerhafte Codes werden mit Zeichen benannt, das Codeformular bleibt gefüllt; Rückgängig-Leiste, „Zurücknehmen“ an Karte, Fokus-Karte und Vordruck; Zurücksetzen zweistufig.
- **Field suitability:** suitable für die Teilnehmerrolle am Handy; limited für den X-Zeit-Fokus auf sehr kleinen Geräten und die Übungsleitung am Handy bei vielen Teilnehmern.

---

## Abgleich mit dem Lauf vom 2026-10-05

| # | Alter Befund | Alte Prio | Status jetzt | Beleg aus diesem Lauf |
|---|---|---|---|---|
| 1 | Abgehakt „nur auf dem Handy“ sieht aus wie „angekommen“ | P2 | teilweise | An der Karte steht jetzt eindeutig „⚠ Nur auf diesem Gerät – wird gesendet, sobald Netz da ist“ (gelb) bzw. „An die Übungsleitung gesendet“; nach Netzrückkehr wechselt es (`p-16`, `p-17`). Die empfohlene mitlaufende Leiste existiert, steht aber außerhalb des Bildes (y = −1194), siehe neuer P3. |
| 2 | Nach Unterbrechung steht der nächste offene Spruch nicht im Bild | P2 | teilweise | Klassisch: Beim Neuöffnen springt die Seite zum nächsten offenen Spruch, Knopf bei y = 464 / 839 (`p-21`). X-Zeit-Fokus auf dem iPhone SE: Knopf weiter bei y = 667 / 568 (`se-31`), siehe neuer P2. |
| 3 | Übungsleitung am Handy: Tabellen seitlich abgeschnitten | P2 | behoben | Teilnehmer und Nachrichtenplan sind am Handy Karten; „Anmeldung erhalten“, Absender → Empfänger, Text und Status-Knopf sind ohne seitliches Wischen sichtbar; scrollWidth = 412 (`p-51`, `p-52`, `p-57`). Rest: Seitenlänge, siehe neuer P3. |
| 4 | X-Zeit vor dem Start: widersprüchliche Anweisung, keine Sprüche | P2 | behoben | Nur noch ein Text: „Warte auf die X-Zeit der Übungsleitung – sie erscheint hier automatisch.“ Dazu die Vorschau „Dein erster Spruch: Nr. 1 an Heros Wind 10, 0 min nach der X-Zeit“; „Jetzt starten“ ist in „Ohne Übungsleitung üben“ eingeklappt (`se-30`, `se-30b-full`). Auf dem SE steht die Vorschau unter dem Rand (neuer P2). |
| 5 | Kleine Schalter für Ausblenden, Fokus, X-Zeit | P3 | behoben | Die ganze Zeile ist Tippfläche: „Abgesetzte ausblenden“ 145×44, „Nur fälligen Spruch zeigen (Fokus)“ 202×44, Summary 249×45, „Neu starten“ 111×44. |
| 6 | Software- und Spezialbegriffe | P3 | teilweise | „Sync“ → „Übungsleitung: live · alles gesendet“, „nächster Spruch bei X+3 min“, „Sprüche je 5 min“, „Was bedeuten die Kennzahlen?“. Es bleiben DTG in Karten, „TN 1 · Leitung 0“, „ETA“, „Tempo“, „X+0“ (neuer P3). |
| 7 | Code-Hinweis nennt nicht vorkommende Verwechslungen | P3 | behoben | „FFVEWO“ → „‚O‘ kommt in Codes nicht vor. Codes enthalten kein O, 0, I oder 1 …“ direkt am Feld (`p-03-nach-typo.png`); bei gültigem, aber falschem Code bleibt das Formular mit den Werten stehen (`p-10-falscher-tc.png`). |
| 8 | Teilnehmer sieht nicht, ob die Leitung bestätigt hat | P3 | behoben | Die Übungsleitung bestätigt am Handy; beim Teilnehmer steht „Leitung hat bestätigt 08:26“ an der Karte (`p-53`, `p-54`). |
| 9 | Zwei Menü-Knöpfe am Handy | P3 | offen | Weiterhin ☰▾ oben rechts und „☰ Menü“ darunter (`p-11-start.png`, `se-30`). |
