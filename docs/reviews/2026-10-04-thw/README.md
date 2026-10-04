# THW-Reviewer-Lauf vom 2026-10-04

Elf Reviewer-Perspektiven haben dieselbe lokal gebaute App (Mock-Modus, localStorage statt
Firestore, Playwright mit Chromium 141) unabhängig voneinander geprüft: Generator am Desktop,
Teilnehmer auf Pixel 7 / iPhone SE, Übungsleitung, Admin, teils Inhaltsseiten und die
Führungsstellen-Übung „Hochwasser“. Reine Audits, keine Codeänderungen.

| Bericht | P0 | P1 | P2 | P3 |
|---|---|---|---|---|
| [analog-first](analog-first.md) | 0 | 1 | 4 | 2 |
| [command](command.md) | 0 | 3 | 6 | 3 |
| [destructive-action](destructive-action.md) | 2 | 2 | 2 | 1 |
| [error-recovery](error-recovery.md) | 0 | 3 | 6 | 2 |
| [field-user](field-user.md) | 0 | 4 | 5 | 2 |
| [glove-touch](glove-touch.md) | 0 | 3 | 4 | 2 |
| [new-user](new-user.md) | 0 | 3 | 7 | 3 |
| [night-visibility](night-visibility.md) | 0 | 0 | 5 | 4 |
| [offline-resilience](offline-resilience.md) | 2 | 3 | 4 | 1 |
| [stress-test](stress-test.md) | 0 | 4 | 5 | 2 |
| [workflow](workflow.md) | 0 | 4 | 4 | 2 |
| **Summe (mit Dubletten)** | **4** | **30** | **52** | **24** |

Viele Befunde wurden von mehreren Perspektiven unabhängig gefunden. Zusammengelegt ergibt
sich folgende Liste; die Spalte „gefunden von“ ist ein guter Indikator für die Dringlichkeit.

## Zusammengeführte Befunde, priorisiert

### Echte Bugs (im Code bestätigt)

| # | Befund | Beleg | gefunden von |
|---|---|---|---|
| B1 | Vordruck-Vorschau bleibt ohne Meldung leer: `pdfjs-dist` 6.3 ruft `Map.prototype.getOrInsertComputed` auf, das Chromium 141 nicht kennt; `renderPdfPage` fängt den Fehler nicht ab. Betrifft vermutlich alle Geräte mit nicht ganz aktuellem Browser. Auf echten Geräten gegenprüfen. | `dist/pdfjs/pdf.min.js`, `package.json` (`pdfjs-dist ^6.3.289`) | new-user, workflow, glove-touch, night-visibility, offline, field-user, stress-test |
| B2 | „Übungsleitung als PDF“ scheitert in frischer Ansicht mit `this.pdf.autoTable is not a function`: jsPDF wird direkt importiert, das autoTable-Plugin nur im Konstruktor von `pdfGenerator` angemeldet. | `src/uebungsleitung/index.ts:786`, `src/pdf/Uebungsleitung.ts:54`, `src/services/pdfGenerator.ts:29-33` | analog-first |
| B3 | Ein fehlgeschlagener Lazy-Import des PDF-Moduls wird dauerhaft gecacht; nach kurzem Netzverlust bleiben Vordruck und ZIP bis zum Reload kaputt, ohne Rückmeldung. | `src/services/pdfGeneratorLazy.ts:12` | offline |
| B4 | Inhaltsverzeichnis der Startseite: Sprungmarken `#abschnitt` werden vom Hash-Router als Route gelesen, Ergebnis ist eine leere Seite. | `scripts/lib/render-page.mjs` (`baueInhaltsverzeichnis`), `src/core/router.ts` | new-user |
| B5 | Theme springt bei OS-Wechsel hell/dunkel um, obwohl der Nutzer explizit ein Theme gewählt hat. | `src/core/ThemeManager.ts:59-64` | night-visibility |

### P0 / hohes P1 – Datenverlust und falscher Stand

1. **Neu generieren überschreibt eine verteilte Übung** unter gleicher ID und gleichen Codes;
   Status hängen danach an anderen Sprüchen, Lösungswort wechselt, Ausdrucke passen nicht mehr.
   Rückfrage „Bestehende Nachrichten gehen verloren“ benennt die Folgen nicht. Kein Undo.
   *(destructive-action P0, workflow, error-recovery)*
2. **„Lokale Daten löschen“ / „Lokale Übungsdaten zurücksetzen“ wirken bei Live-Sync für alle**
   – Beschriftung sagt „lokal“, nur der Bestätigungsdialog nennt die echte Reichweite.
   Gleichzeitig ist das die einzige Korrektur für ein versehentliches „Anmelden“.
   *(destructive-action P0, command, new-user, error-recovery, field-user)*
3. **Sync-Anzeige bleibt offline grün** („live“); `navigator.onLine` / Firestore-Pending-Writes
   werden nicht ausgewertet. Im echten Pfad aus Code abgeleitet. *(offline P0)*
4. **Doppeltipp macht „✓ abgesetzt“ rückgängig**: „↺“ erscheint exakt an derselben Stelle,
   ohne Rückfrage. Gleiches beim Status-Chip der Teilnehmer.
   *(stress-test, glove-touch – beide gemessen)*

### P1 – Kernhandlung schwer erreichbar

5. **Teilnehmer-Tabelle am Handy**: 731 px Tabelle in 372 px Container, Status-Chip und Schalter
   nur per Seitwärtswischen erreichbar, zwei Mini-Ziele (78×27 / 34×17 px) für dieselbe Aktion.
   *(field-user, glove-touch, stress-test, night-visibility, new-user, destructive-action)*
6. **Vordruck-Modal mobil ohne „übertragen“-Knopf**, nur Leertaste; Schließen-Knopf 31×31 px
   und teils unter der fixierten Kopfzeile. *(field-user, glove-touch, stress-test, new-user, workflow)*
7. **Kopfzeile Teilnehmer** auf schmalen Geräten abgeschnitten / überlappend; im Querformat kein
   Spruch sichtbar. *(field-user, glove-touch, destructive-action)*
8. **Fokus-Modus** wird durchweg positiv bewertet – Empfehlung: am Handy als Standard.
   *(field-user)*

### P1 – Zwei Wahrheiten über denselben Vorgang

9. **Teilnehmer „übertragen“ vs. Übungsleitung „abgesetzt“** sind getrennte Status; das
   Debrief-PDF zählt nur die Leitung. *(workflow, new-user)*
10. **„Anmelden“-Knopf vs. Anmelde-Funkspruch** sind unabhängig – beobachtet: Funkspruch
    abgesetzt, Tabelle „keine Meldung“. *(command, workflow, new-user)*
11. **X-Zeit je Gerät**: Übungsbeginn aus dem Generator kommt im Cockpit nicht an, die Leitung
    übernimmt die Startzeit eines Rollenspielers (`src/teilnehmer/index.ts:180`).
    *(workflow, command, field-user)*

### P1 – Übungsleitung als Lagebild

12. Im X-Zeit-/Führungsstellen-Plan keine Soll-Zeit und keine Unterscheidung überfällig/fällig/später,
    obwohl das Cockpit „12 hinter Plan“ meldet (`UebungsleitungNachrichtenView.ts:327/342`). *(command)*
13. ~12.000 px lange Liste ohne Lagezeile „offen je Teilnehmer / als Nächstes“; Heatmap und
    Timeline ganz unten. *(command)*
14. Falsche/gelöschte Übungs-ID zeigt leere Karten „0 / 0“ statt Fehlermeldung
    (`src/uebungsleitung/index.ts:94-96`). *(error-recovery)*

### P1 – Generator

15. **Eingaben und Ergebnis gehen bei Reload/Zurück verloren**; die Adresse bekommt nach dem
    Generieren keine Übungs-ID, „Zurück“ verlässt die App. *(stress-test, error-recovery, new-user)*
16. **Vorbelegung**: alle 11 Vorlagen inkl. „Lustige Funksprüche“ vorausgewählt, fremde
    Beispiel-Rufnamen und „Musterstadt“ als echte Werte. *(new-user, workflow)*
17. **Ohne Netz** tut „Übung generieren“ still nichts (`src/generator/index.ts:684-687`); Reload
    ohne Netz endet auf der Browser-Fehlerseite (kein Service Worker). *(offline, analog-first)*

### P2 – Auswahl

- Fehlermeldungen nur als Toast (2,5 s), kein Feld markiert. *(error-recovery)*
- Falscher Teilnehmercode / Fehlerseiten ohne Weg zurück zum Code-Formular. *(field-user, error-recovery)*
- Admin-Löschen: Icon ohne Beschriftung, Rückfrage ohne Übungsnamen, keine Rückmeldung. *(destructive-action, error-recovery)*
- Ausdrucke ohne Übungs-/Teilnehmercode, Link oder QR-Code; keine Abhak-Spalten; Papier-Nachträge nur mit Klick-Uhrzeit. *(analog-first, workflow)*
- „✓ abgesetzt“-Knopf in Graustufen kaum vom Status ABGESETZT unterscheidbar. *(night-visibility)*
- Chart.js-Diagramme in Generator und Übungsleitung ohne Dark-Mode-Farben; heller Blitz beim Laden. *(night-visibility)*
- ETA ohne Mindeststichprobe; beübte Stelle gleichrangig mit Einspielern in der Tabelle. *(command)*
- 9999 Sprüche pro Teilnehmer frieren den Tab ein. *(error-recovery)*
- Begriffe (X-Zeit, Szenario, Stellenname) unerklärt; Reiter „Übung erstellen“ in allen Rollen aktiv. *(new-user)*

## Was gut funktioniert

- Teilnehmer-Markierungen überleben Offline-Phase und Reload und werden danach erneut übertragen.
- Papiersatz (ZIP mit Vordrucken, Drehbuch) ist vollständig; die App erzeugt Papier statt es zu ersetzen.
- Kontraste in Light und Dark durchgehend WCAG AA, Status nie nur über Farbe.
- Doppelklick auf „Übung generieren“ erzeugt genau eine Übung; Zahlendreher im Code gibt klare Meldung.
- Fokus-Modus und X-Zeit-Cockpit, Führungsstellen-Plan mit „Erwartet: …“.

## Grenzen dieses Laufs

- Kein echter Firestore, kein Live-Sync zwischen zwei Geräten (Mock teilt bzw. trennt localStorage).
  Alle Aussagen zum echten Sync-Pfad sind aus dem Code abgeleitet und in den Berichten als Annahme markiert.
- Keine echten Geräte, Handschuhe, Sonnenlicht oder Funklöcher.
- Vordruck-Inhalt im Modal wegen B1 nicht prüfbar.
