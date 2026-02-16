# GA4 Dashboard Vorschlag

## Ziel

Schnell sehen:
- welche Module genutzt werden,
- welche Kernaktionen häufig/selten sind,
- wo Fehler auftreten.

## Voraussetzung

- Consent wurde von Nutzern aktiviert (`Analytics: an`).
- Events kommen an (`ui_click`, `route_change`, Feature-Events, `js_error`).

## Exploration 1: Modulnutzung

- Dimensionen:
  - `page_title`
  - `page_path`
- Metrik:
  - `Event count`
- Filter:
  - `event_name = page_view`

Interpretation:
- Verteilung auf `Generator`, `Admin`, `Uebungsleitung`, `Teilnehmer`.

## Exploration 2: Wichtigste Klicks

- Dimensionen:
  - `event_name`
  - `click_key`
  - `route_hash`
- Metrik:
  - `Event count`
- Filter:
  - `event_name = ui_click`

Interpretation:
- Welche Buttons werden wirklich genutzt?
- Gibt es tote/seltene Aktionen?

## Exploration 3: Kern-Funnel

Schritte:
1. `generator_start_uebung`
2. `download_all_pdfs_zip`
3. `teilnehmer_toggle_uebertragen`

Optional:
4. `uebungsleitung_mark_abgesetzt`

Interpretation:
- Bruchstellen zwischen Erstellung, Download und Durchführung.

## Exploration 4: Fehler-Monitoring

- Dimensionen:
  - `kind`
  - `message`
  - `source`
- Metrik:
  - `Event count`
- Filter:
  - `event_name = js_error`

Interpretation:
- Häufige Client-Fehler priorisieren.

## Custom Definitions (empfohlen)

Für bessere Reports in GA4 als Event-Parameter registrieren:
- `click_key`
- `route_hash`
- `kind`
- `source`
