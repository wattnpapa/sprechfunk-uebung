# Einbau einer neuen Vorlage

Neun Stationen. Wer eine auslässt, bricht einen Test oder liefert eine falsche
Zahl aus. Reihenfolge einhalten, weil spätere Stationen die neue Gesamtzahl brauchen.

## 1. Textdatei

`assets/funksprueche/nachrichten_<organisation>_<lage>.txt`

- Namensschema wie der Bestand: `nachrichten_<org>_<thema>.txt`, klein, mit Unterstrichen.
- Nicht nach erfundenen Ortsverbänden oder Wachen benennen. Die THW-Dateien
  tragen echte OV-Namen, weil sie von dort stammen. Geschriebene Vorlagen
  tragen Organisation und Lage.
- Prüfskript laufen lassen, bevor es weitergeht.

## 2. Registry des Bestands

`scripts/lib/funkspruch-daten.mjs`, Array `VORLAGEN`:

```js
{
    datei: "nachrichten_feuerwehr_unwetter.txt",
    slug: "feuerwehr-unwetter",
    name: "Feuerwehr, Unwetterlage",
    organisation: ["feuerwehr"],
    herkunft: "geschrieben",
    imArchiv: true
}
```

- `organisation` ist ein Schlüssel aus `ORGANISATIONEN` in derselben Datei.
  Neue Organisation dort ergänzen, damit die Übersichtstabelle einen Namen hat.
- `herkunft`: `"uebung"` für Material aus einer gefunkten Übung, `"geschrieben"`
  für Vorlagen aus diesen Skills. Die Tabelle auf `/funksprueche/` zeigt es.
- `schwierigkeit` nur setzen, wenn die ganze Vorlage eine Stufe ist
  (wie „grundausbildung-einfach"). Sonst weglassen, dann zählt die Textlänge.

## 3. Registry der App

`src/data/funkspruchVorlagen.ts`, Objekt `FUNKSPRUCH_VORLAGEN`:

```ts
feuerwehrUnwetter: { text: "Funksprüche Feuerwehr, Unwetterlage", filename: "assets/funksprueche/nachrichten_feuerwehr_unwetter.txt" }
```

- Der Schlüssel wird in `verwendeteVorlagen` der Übung gespeichert und in der
  Admin-Übersicht wieder aufgelöst. Einmal vergeben, nie mehr umbenennen.
- `text` ist der Anzeigename in der Mehrfachauswahl des Generators.

## 4. Archivseite

`src/pages/funksprueche-vorlage-<slug>.html`, Vorlage: eine bestehende
Archivseite kopieren (z. B. `funksprueche-vorlage-thw-essen.html`) und
anpassen. Pflicht:

- `<title>` 50–60 Zeichen, `<meta name="description">` 140–160 Zeichen,
  beides eindeutig über alle Seiten (`tests/seo/ContentQuality.test.ts`).
- Canonical, `og:*`, `twitter:*` auf `https://sprechfunk-uebung.de/funksprueche/vorlage/<slug>/`.
- Breadcrumb `Startseite › Funksprüche › Vorlage <Name>`.
- Abschnitte: Lage, was die Vorlage besonders übt, Umfang, Download, Liste.
  Der Download verweist auf `../../../assets/funksprueche-<slug>.txt`
  (Dateiname aus `downloadDateiname()`, erzeugt der Build).
- `<!-- AP-08:LISTE -->` als Einsetzstelle für die Liste, sonst schlägt der
  Build fehl.
- **Herkunft nennen**: „Diese Vorlage wurde für den Generator geschrieben,
  nicht aus einer gefunkten Übung übernommen." Plus Hinweis, dass Rückmeldungen
  aus der Praxis erwünscht sind. Nicht behaupten, die Texte kämen aus einem Einsatz.
- Alle Zahlen im Text (Anzahl, Zeichen) müssen zur Datei passen. Nach jeder
  Änderung der Datei die Zahlen auf der Seite nachziehen.
- Keine Floskeln aus `FLOSKELN` in `scripts/lib/content-quality.mjs`.

## 5. Seiten-Registry

`scripts/site-pages.mjs`, ein Eintrag in `SITE_PAGES` nach dem Muster der
anderen Archivseiten:

```js
{
    slug: "funksprueche/vorlage/feuerwehr-unwetter",
    source: "pages/funksprueche-vorlage-feuerwehr-unwetter.html",
    sources: ["src/pages/funksprueche-vorlage-feuerwehr-unwetter.html", "assets/funksprueche/nachrichten_feuerwehr_unwetter.txt"],
    archivVorlage: "feuerwehr-unwetter",
    breadcrumbEltern: [{ name: "Funksprüche", slug: "funksprueche" }],
    kurzGesagt: "…",           // 3 bis 4 Sätze, keine Floskeln
    related: ["funksprueche", "funkuebung-feuerwehr", "funkuebung-planen"],
    label: "Vorlage Feuerwehr Unwetter",
    hubCategory: "anwendung",
    archiv: true,
    schemaType: "CollectionPage", datePublished: "JJJJ-MM-TT",  // Tag des Einbaus, danach nie ändern
    about: ["Funksprüche", "Übungstexte", "Feuerwehr"],
    faq: [ /* 3 Fragen, Antworten über 40 Zeichen */ ]
}
```

- `archivVorlage` muss dem `slug` aus Station 2 entsprechen; ein Test prüft
  die 1:1-Zuordnung.
- `related` erzeugt die „Weiterlesen"-Links. Mindestens eine Organisationsseite
  aufnehmen (`funkuebung-feuerwehr`, `funkuebung-katastrophenschutz` …).

## 6. Feste Zahlen nachziehen

Die Gesamtzahl steht an drei Stellen fest im Quelltext, weil Titel und
Description kein Platzhalter sein können:

- `src/pages/funksprueche.html`: `<title>`, `description`, `og:*`, `twitter:*`
- `src/index.html`: `description`, `og:description`
- `CLAUDE.md`: der Satz „Am JJJJ-MM-TT sind das X und Y" (mit neuem Datum)

Neue Zahl ermitteln:

```bash
node -e 'import("./scripts/lib/funkspruch-bestand.mjs").then(m => console.log(m.ANZAHL_GESAMT_TEXT, m.ANZAHL_ARCHIV_TEXT))'
```

Alles andere (`{{FUNKSPRUECHE_GESAMT}}`, `kurzGesagt` mit `ANZAHL_GESAMT_TEXT`)
löst der Build auf.

## 7. Seitenzahl im Schema-Test

`tests/seo/SchemaGraph.test.ts`: `expect(SITE_PAGES).toHaveLength(N)` um die
Zahl neuer Seiten erhöhen. Der Test ist absichtlich starr, damit niemand
unbemerkt eine URL verliert.

## 8. Eingehende Links

Jede Inhaltsseite braucht mindestens drei eingehende interne Links
(`npm run links:check` nach dem Build). Die Übersichtstabelle auf
`/funksprueche/` liefert einen. Zwei weitere aus passenden Seiten setzen,
z. B. `src/pages/funkuebung-feuerwehr.html` und
`src/pages/funkuebung-katastrophenschutz.html`, mit unterschiedlichen
Ankertexten, die den Inhalt nennen (nicht „hier").

## 9. Hub-Text ehrlich halten

`src/pages/funksprueche.html`, Abschnitt „Das Archiv": Der Satz über die
Herkunft muss zwischen gefunkten THW-Vorlagen und geschriebenen Vorlagen
unterscheiden. Ebenso `README.md` und `CLAUDE.md`, wo vom „gewachsenen
Bestand echter Übungsfunksprüche" die Rede ist.

## Prüfen

```bash
npm run lint
npx vitest run tests/seo tests/admin tests/generator
npm run build
npm run links:check
npm run content:check
npm run perf:budget
```

E2E für das Archiv läuft über alle `ARCHIV_VORLAGEN` automatisch
(`e2e/funkspruch-archiv.spec.ts`), braucht aber einen laufenden Build:
`npm run test:e2e -- e2e/funkspruch-archiv.spec.ts`.
