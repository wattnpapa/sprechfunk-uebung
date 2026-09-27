---
name: funkspruch-basis
description: Gemeinsame Grundlage für alle Funkspruch-Skills dieses Projekts. Immer laden, wenn Übungsfunksprüche für eine Vorlage geschrieben, erweitert, geprüft oder in den Bestand unter assets/funksprueche/ eingebaut werden. Enthält Dateiformat, Sprechfunk-Stil nach DV 810.3, Qualitätsregeln, das Prüfskript und den vollständigen Einbau-Pfad (Registry, App-Liste, Archivseite, Sitemap, feste Zahlen). Der Fachteil je Organisation steht in funkspruch-feuerwehr, funkspruch-sanitaet-betreuung, funkspruch-wasserrettung und funkspruch-rettungsdienst.
user-invocable: true
argument-hint: "[schreiben|pruefen|einbauen] [Datei oder Slug]"
allowed-tools:
  - Bash(node .claude/skills/funkspruch-basis/scripts/*)
---

# Funkspruch-Basis

Dieser Skill ist die Klammer. Er sagt, **wie** ein Funkspruch für dieses Projekt
aussieht und **wie** eine Vorlage in den Bestand kommt. **Was** eine Organisation
funkt, sagt der jeweilige Organisations-Skill. Beide zusammen laden, nie nur einen.

## Warum es diese Skills gibt

- Der Bestand ist THW-lastig: fünf von sieben Vorlagen stammen aus THW-Ortsverbänden.
- Feuerwehr, Sanitäts- und Betreuungsdienst, Wasserrettung und Rettungsdienst
  brauchen Übungstexte in ihrer eigenen Sprache, nicht THW-Texte mit getauschtem Absender.
- Jede Organisation bekommt deshalb einen Skill, der Fachsprache, Einheiten,
  Meldearten und typische Lagen kennt.

## Ablauf

1. **Organisations-Skill laden** (`funkspruch-<organisation>`), dazu diesen.
2. **Lage festlegen**: eine zusammenhängende Übungslage je Vorlage, mit
   erfundenen Orts- und Straßennamen. Keine realen Ereignisse nachstellen.
3. **Schreiben** nach `referenz/stil.md`. Eine Nachricht je Zeile, sonst nichts.
4. **Prüfen** mit dem Skript, bis es ohne Fehler durchläuft:
   ```bash
   node .claude/skills/funkspruch-basis/scripts/pruefe-vorlage.mjs assets/funksprueche/<datei>.txt
   ```
   Es prüft Format, Dubletten innerhalb der Datei und gegen den gesamten
   Bestand, verbotene Wendungen, und zeigt die Verteilung über Kategorien,
   Schwierigkeit und Buchstabieranteil.
5. **Einbauen** nach `referenz/einbau.md`. Der Pfad hat neun Stationen, keine
   davon ist optional. Zum Schluss `npm run lint`, `npx vitest run tests/seo`,
   `npm run build`.
6. **Ehrlich kennzeichnen**: Eine geschriebene Vorlage ist keine gefunkte Übung.
   Archivseite und Registry (`herkunft: "geschrieben"`) sagen das ausdrücklich.
   Die bestehende Aussage „gewachsen, nicht generiert" gilt nur für die
   THW-Vorlagen und darf nicht auf neue Vorlagen ausgedehnt werden.

## Harte Regeln

- **Kein Text doppelt.** `tests/seo/FunkspruchArchiv.test.ts` verlangt, dass
  keine Kennung im ganzen Bestand zweimal vorkommt. Die Kennung ist der
  SHA-256 über den Text: zwei gleiche Zeilen in zwei Dateien brechen den Test.
- **Keine Kopfzeile, kein Kommentar, keine Leerzeile.** Der Upload im Generator
  liest jede nicht leere Zeile als Nachricht. Die Datei endet mit genau einem
  Zeilenumbruch.
- **Keine Absender und Empfänger im Text.** Die Rufnamen kommen aus der
  Teilnehmerliste der Übung. Dritte Einheiten dürfen genannt werden, sparsam.
- **Keine realen Personen, keine Marken, keine Firmen.** Die humorvolle Vorlage
  ist aus genau diesem Grund nicht im öffentlichen Archiv.
- **Keine erfundenen Quellen, Normen oder Zahlen** in Seitentexten. Zitierbar
  sind nur real existierende Vorschriften (DV 810.3, FwDV 100, FwDV 3 usw.),
  und nur da, wo der Bezug stimmt. Im Zweifel keine Quelle nennen.
- **Mindestens zehn Einträge** je Archivvorlage, sonst bekommt sie keine eigene URL.
- Erfundene Ortsnamen müssen als erfunden erkennbar bleiben: keine Namen
  echter Städte für die Kulisse. Straßennamen wie „Lindenstraße" sind in
  Ordnung, weil sie überall vorkommen.

## Ziel-Verteilung einer Vorlage

Der Generator mischt zufällig, deshalb muss die Datei selbst gemischt sein.
Richtwerte für 120 bis 160 Zeilen:

| Merkmal | Ziel | Woher |
|---|---|---|
| Schwierigkeit einfach (≤ 80 Zeichen) | 25–35 % | `SCHWIERIGKEIT_GRENZEN` |
| Schwierigkeit mittel | 45–55 % | |
| Schwierigkeit schwer (≥ 180 Zeichen) | 15–25 % | |
| Buchstabieranteil (ein Wort in GROSSBUCHSTABEN) | 30–50 % | `hatBuchstabieranteil` |
| Sammelkategorie „allgemein" | ≤ 50 % | `kategorieFuer` |
| Verschiedene Kategorien vertreten | ≥ 5 | `KATEGORIE_REGELN` |

Die Kategorien ergeben sich aus Wortmustern in `scripts/lib/funkspruch-daten.mjs`.
Wer z. B. „Stärke 1/8/9" schreibt, landet in „Stärkemeldung"; „Erkunden Sie"
in „Erkundung". Das Skript zeigt, was die Datei tatsächlich trifft.

## Abnahme durch Menschen

Vor dem Merge liest jemand mit Praxis in der Organisation die Datei quer und
achtet auf: falsche Fahrzeug- oder Einheitsbezeichnungen, Führungsstrukturen,
die es so nicht gibt, Meldungen, die im Einsatz anders laufen würden,
regional falsche Rufnamensysteme. Was die Person beanstandet, wird geändert,
nicht wegdiskutiert. Der PR-Text nennt, ob diese Durchsicht stattgefunden hat.
