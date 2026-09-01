# Verweisende Domains

Hier liegen die normalisierten Monatsstände der verweisenden Domains, eine Datei
je Monat: `YYYY-MM.csv` mit den Spalten `domain,verweisende_seiten,verlinkte_seiten`.

## Warum von Hand exportiert

Die Search-Console-API hat **keinen Endpunkt für den Links-Bericht**. Sie bietet
`searchanalytics`, `sitemaps` und `urlInspection` – verweisende Domains stehen in
keinem davon. Der Bericht ist nur in der Oberfläche zu exportieren. Deshalb gibt es
hier einen Eingangsordner statt eines API-Aufrufs.

## Ablauf

1. Search Console öffnen, links **Links** → Abschnitt **Top verweisende Websites**
   → **Weitere Informationen** → oben rechts **Exportieren** → **CSV herunterladen**.
2. Die Datei nach `seo/backlinks/eingang/` legen. Der Dateiname ist egal, mehrere
   Dateien werden zusammengeführt.
3. `npm run backlinks:report`

Ergebnis: `seo/backlinks/YYYY-MM.csv` (normalisiert, wird eingecheckt) und
`seo/backlinks-report.md` mit neuen, verlorenen und veränderten Domains gegenüber
dem Vormonat.

Ohne Eingangsdatei läuft das Skript folgenlos durch und meldet das – ein Fork
oder ein CI-Lauf ohne Export bricht dadurch nicht.

## Was nicht eingecheckt wird

Die Rohexporte unter `eingang/` bleiben lokal (siehe `.gitignore` dort). Sie
enthalten dieselben Daten, aber im wechselnden Format der Oberfläche; die
normalisierte Fassung ist die, auf die sich der Vergleich stützt.
