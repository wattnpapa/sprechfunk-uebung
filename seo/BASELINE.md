# SEO-Baseline

Ausgangswerte für die SEO-Arbeitspakete. Ziel-Suchbegriff ist "BOS Sprechfunk Übung"
auf https://sprechfunk-uebung.de.

**Erhebungsdatum: 2026-08-03** (AP-00)

Diese Datei enthält nur gemessene Werte. Was ohne Search-Console-Zugang nicht messbar war,
ist als **ausstehend** markiert und bleibt es, bis es tatsächlich erhoben wurde. Keine
Schätzungen, keine Hochrechnungen — sonst ist die Baseline als Vergleichsmaßstab wertlos.

## 1. Indexabdeckung

| Kennzahl | Wert | Quelle |
| --- | --- | --- |
| URLs in `sitemap.xml` | **29** | `curl https://sprechfunk-uebung.de/sitemap.xml`, Anzahl `<loc>` |
| URLs in der Seiten-Registry | **29** (1 Startseite + 28 Unterseiten) | `SITE_PAGES` in `scripts/site-pages.mjs` |
| Indexierte URLs laut Search Console | **ausstehend** | Search-Console-Property noch nicht verifiziert |
| Abgedeckt / ausgeschlossen / Fehler | **ausstehend** | dito |

Sitemap und Registry stimmen überein — die Sitemap wird im Postbuild aus derselben Liste
erzeugt, ein Auseinanderlaufen ist damit ausgeschlossen. `robots.txt` verweist auf die
Sitemap und erlaubt alle Pfade.

## 2. Positionen der `primary`-Keywords

**Alle Positionen: ausstehend.** Positionsdaten kommen ausschließlich aus der Search
Console; ohne verifizierte Property gibt es keine. Sobald das Secret gesetzt ist, füllt
`scripts/seo-rank-snapshot.mjs` diese Tabelle aus `seo/snapshots/<datum>.json`
(Feld `tracked.primary`).

| Keyword | Position | Impressionen | Klicks | CTR |
| --- | --- | --- | --- | --- |
| funkübung | ausstehend | ausstehend | ausstehend | ausstehend |
| funkübung erstellen | ausstehend | ausstehend | ausstehend | ausstehend |
| sprechfunkübung | ausstehend | ausstehend | ausstehend | ausstehend |
| sprechfunkübung erstellen | ausstehend | ausstehend | ausstehend | ausstehend |
| funkübung feuerwehr | ausstehend | ausstehend | ausstehend | ausstehend |
| funkübung thw | ausstehend | ausstehend | ausstehend | ausstehend |
| funkübung generator | ausstehend | ausstehend | ausstehend | ausstehend |
| bos funkübung | ausstehend | ausstehend | ausstehend | ausstehend |

Die vollständige Liste inklusive `secondary`, `defensive` und `competitors` steht in
`seo/keywords.json`.

## 3. Ladezeit der Startseite

Gemessen am 2026-08-03 gegen die Produktionsseite `https://sprechfunk-uebung.de/`.

**Messaufbau, damit die Werte später reproduzierbar sind:** ein Entwicklungsrechner
(macOS, Standort Deutschland, Kabelverbindung), je Verfahren mehrere Läufe, angegeben ist
der Median. Das sind **keine Feld- oder CrUX-Daten** und keine Aussage über die Erfahrung
echter Nutzer an anderen Standorten.

| Kennzahl | Median | Läufe | Verfahren |
| --- | --- | --- | --- |
| TTFB | **61 ms** | 5 | `curl -w %{time_starttransfer}` |
| TTFB | **106 ms** | 3 | Chromium, `navigation.responseStart` |
| `domContentLoadedEventEnd` | **221 ms** | 3 | Chromium Navigation Timing |
| `loadEventEnd` | **222 ms** | 3 | Chromium Navigation Timing |
| HTML-Größe Startseite | **46.659 B** unkomprimiert | 5 | `curl -w %{size_download}` |

Der jeweils **erste** Lauf jeder Messreihe lag deutlich höher (curl 333 ms TTFB, Chromium
1.662 ms TTFB / 2.085 ms `loadEventEnd`) — kalter DNS-, TLS- und CDN-Cache. Für Vergleiche
sind die warmen Läufe der belastbare Wert; der kalte Erstaufruf ist hier festgehalten,
damit spätere Messungen nicht versehentlich dagegen verglichen werden.

Bundle-Budgets prüft `npm run perf:budget` separat gegen `dist/` — diese Baseline sagt
nichts über Bundle-Größen aus.

## 4. Analytics

GoatCounter (`gc.zgo.at`) ist auf allen statischen Seiten eingebunden, siehe
`docs/adr/0004-goatcounter-analytics.md`. Besucherzahlen liegen dort, sind aber nicht mit
Suchanfragen verknüpfbar — genau diese Lücke schließt der Search-Console-Export.

## 5. Offene manuelle Schritte

Ohne diese Schritte bleiben Abschnitt 1 und 2 leer:

1. Search-Console-Property für `sprechfunk-uebung.de` verifizieren (DNS-TXT empfohlen,
   siehe unten).
2. `https://sprechfunk-uebung.de/sitemap.xml` in der Search Console einreichen.
3. Service-Account anlegen, in der Property als Leser hinzufügen, Schlüssel als
   Repository-Secret `GSC_SERVICE_ACCOUNT_JSON` hinterlegen.
4. Workflow „SEO-Rang-Snapshot" einmal per `workflow_dispatch` starten.
5. Diese Datei mit den dann vorliegenden Werten aktualisieren und das Erhebungsdatum
   ergänzen — alte Werte nicht überschreiben, sondern datiert daruntersetzen.

### Verifizierung: DNS statt Meta-Tag

Empfehlung ist ein **DNS-TXT-Eintrag**. Gründe:

- Er verifiziert die gesamte Domain als Property (`sc-domain:sprechfunk-uebung.de`) und
  damit auch künftige Unterseiten, ohne dass 29 HTML-Dateien angefasst werden müssen.
- Er geht bei einem Redesign nicht verloren.
- Ein Meta-Tag müsste über die Seiten-Registry in jede Seite ausgerollt werden und
  vergrößert jedes ausgelieferte HTML.

Das Snapshot-Skript ist auf eine Domain-Property vorbelegt. Wird stattdessen eine
URL-Präfix-Property verwendet, muss die Repository-Variable `GSC_SITE_URL` auf
`https://sprechfunk-uebung.de/` gesetzt werden.

Ein Verifizierungs-Token steht hier absichtlich nicht: es ist kontogebunden und liegt
nicht vor. Es wird nichts eingetragen, was nicht aus der echten Search Console kommt.
