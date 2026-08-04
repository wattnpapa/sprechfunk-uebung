# Mitmachen

Danke fürs Interesse. Das hier ist ein ehrenamtliches Projekt ohne Firma dahinter –
jeder Beitrag hilft, und keiner wird als selbstverständlich genommen.

Es gibt zwei Wege hinein, und der erste ist der wichtigere.

## 1. Funksprüche beitragen

Der mitgelieferte Bestand an Übungsfunksprüchen stammt aus Übungen, die tatsächlich
gefunkt wurden – aus den THW-Ortsverbänden Essen, Leer, Lehrte, Melle und Saarstedt.
**Jede weitere Sammlung macht die Übungen für alle abwechslungsreicher**, weil der
Generator dann aus mehr Material zieht und dieselben Sprüche seltener wiederkehren.

Gebraucht werden vor allem Bestände von **Feuerwehren, Rettungsdienst und
Hilfsorganisationen** – der jetzige Bestand ist stark THW-geprägt.

### Format

Eine Textdatei, **ein Funkspruch je Zeile**, UTF-8, Zeilenende `\n`. Sonst nichts:
keine Nummerierung, keine Absender, keine Kopfzeile.

```
Ein Baum ist auf die Fahrbahn der Bundesstraße 213 gestürzt und blockiert beide Fahrtrichtungen.
Wir benötigen zusätzlich zwei Atemschutzgeräteträger an der Einsatzstelle Schulzentrum.
Der Pegel an der Messstelle Süd ist in der letzten Stunde um 12 Zentimeter gestiegen.
```

Worauf es inhaltlich ankommt:

- **Echte Übungstexte sind besser als ausgedachte.** Sie sind unterschiedlich lang,
  nennen konkrete Straßen, Pegel und Stärken – genau daran übt sich das Aufnehmen.
- **Sperrige Eigennamen sind erwünscht**, nicht störend. Wer nur runde Sätze übt,
  übt das Buchstabieren nie.
- **Keine echten personenbezogenen Daten.** Namen von Einsatzkräften, Adressen von
  Betroffenen, Kennzeichen privater Fahrzeuge: raus oder ändern. Ortsnamen und
  Straßennamen sind unkritisch.
- **Keine echten Einsatzdaten.** Übungslagen ja, Berichte aus tatsächlichen
  Einsätzen nein – auch dann nicht, wenn sie anonymisiert wirken.
- Der Vermerk „Übung" gehört **nicht** in die Zeile; den setzt die Anwendung.

### Wohin

Die Datei kommt nach `assets/funksprueche/` und heißt nach ihrer Herkunft, zum
Beispiel `nachrichten_ff_musterstadt.txt`.

Dazu ein Eintrag in `VORLAGEN` in [`scripts/lib/funkspruch-daten.mjs`](scripts/lib/funkspruch-daten.mjs):

```js
{
    datei: "nachrichten_ff_musterstadt.txt",
    slug: "ff-musterstadt",
    name: "Feuerwehr Musterstadt",
    organisation: ["feuerwehr"],
    imArchiv: true
}
```

| Feld | Bedeutung |
|---|---|
| `datei` | Dateiname in `assets/funksprueche/` |
| `slug` | URL-Bestandteil im Archiv, klein und mit Bindestrichen |
| `name` | Anzeigename in der Anwendung |
| `organisation` | eine oder mehrere aus `thw`, `feuerwehr`, `allgemein` |
| `schwierigkeit` | optional, `einfach` für kurze Meldungen der Grundausbildung |
| `imArchiv` | `true`, wenn die Sammlung auch öffentlich einsehbar sein soll |

Danach `npm test` – die Tests prüfen unter anderem, dass die Datei existiert, keine
leeren Zeilen enthält und die Bestandszahlen auf der Website dazu passen.

### Der einfache Weg

Wenn Pull Requests zu technisch sind: **[Issue „Neue Funksprüche" öffnen](https://github.com/wattnpapa/sprechfunk-uebung/issues/new?template=funksprueche.yml)**
und die Texte hineinkopieren oder die Datei anhängen. Den Rest übernehme ich.

### Lizenz und Nennung

Beiträge stehen unter der **EUPL-1.2** wie das übrige Projekt. Wer beiträgt, wird in
[`CONTRIBUTORS.md`](CONTRIBUTORS.md) und auf
[der Open-Source-Seite](https://sprechfunk-uebung.de/open-source/) genannt – aber
**nur mit ausdrücklicher Zustimmung**. Das Issue-Formular fragt das ab; wer nichts
ankreuzt, wird nicht genannt. Genannt werden Einheiten und Organisationen, keine
Privatpersonen ohne eigenen Wunsch.

## 2. Code, Inhalte und Fehler

### Fehler melden

Fachliche Fehler auf den Inhaltsseiten sind besonders willkommen – die Seiten werden
von einer Person gepflegt, und vier Augen sehen mehr. Am besten als Issue, damit die
Meldung nachvollziehbar bleibt. Wie mit Quellen und Korrekturen umgegangen wird,
steht unter [Über das Projekt](https://sprechfunk-uebung.de/ueber-das-projekt/).

### Entwicklung

```bash
npm ci
npm run build
npm run dev
```

Vor dem Pull Request:

```bash
npm run lint
npm test
npm run build
```

Konventionen im Überblick (ausführlich in [`CLAUDE.md`](CLAUDE.md)):

- **Commits** nach Conventional Commits mit Modul-Scope: `fix(generator):`,
  `feat(admin):`, `test(e2e):`
- **TypeScript** im Strict Mode, kein implizites `any`
- **Firestore**: keine `undefined`-Felder schreiben, fehlende Indizes abfangen;
  neue persistierte Felder gehören in die Allowlists in `firestore.rules`
- **Neue Seite?** Ein Eintrag in `scripts/site-pages.mjs` plus die HTML-Datei unter
  `src/pages/` – es gibt bewusst nur diese eine Registry
- **Keine neuen Laufzeit-Abhängigkeiten** ohne Begründung im PR-Text. Das
  Performance-Budget (`npm run perf:budget`) ist ein Wettbewerbsvorteil

### Was in den Pull Request gehört

- Was geändert wurde und warum
- Wie man es prüft – am besten so, dass jemand ohne Vorwissen dem Weg folgen kann
- Bei fachlichen Änderungen: die Quelle, an der du es geprüft hast

## Was hier nicht hingehört

- Serverseitige Zugangsdaten: Service-Account-JSON, Admin-SDK-Schlüssel, CI-Tokens
- Personenbezogene Daten aus echten Übungen oder Einsätzen
- Abhängigkeiten, die nur eine Zeile Code ersetzen
