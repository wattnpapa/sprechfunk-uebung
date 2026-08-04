# Quellenregister (AP-11)

Dieses Dokument hält fest, **wie** die Quellenangaben auf sprechfunk-uebung.de geprüft
wurden. Die maschinenlesbare Fassung steht in `scripts/lib/quellen.mjs` und wird von
`tests/seo/Quellen.test.ts` erzwungen; hier steht, was ein Test nicht prüfen kann: der
Abrufweg, die tatsächlich gelesenen Seiten und was nicht zu belegen war.

**Prüfdatum: 2026-08-04.** Alle Abrufe an diesem Tag.

Grundregel: Es steht nur im Register, was am Dokument selbst gelesen wurde. Wo kein
Beleg vorliegt, sagt die Seite das — statt eine Fundstelle zu behaupten.

---

## 1. PDV/DV 810.3 „Sprechfunkdienst"

| | |
|---|---|
| Vollständiger Titel | Dienstvorschrift für die Abwicklung des Sprechfunkverkehrs und die Sprechfunkausbildung im Bereich des nichtöffentlichen beweglichen Landfunkdienstes der Behörden und Organisationen mit Sicherheitsaufgaben (BOS), mit Ergänzungen für den Katastrophenschutz |
| Ausgabe | Ausgabe 1983, Stand Dezember 1988 |
| Abgerufen als | PDF, DLRG Kreisverband Lahn-Dill |
| URL | https://kv-lahn-dill.dlrg.de/fileadmin/groups/7210000/downloads/PDv-810-3.pdf |
| Gelesen | Titelblatt sowie die Seiten 1–6, 13–14, 17–18 und 24–25 im Volltext |

Ausgabe und Untertitel stammen vom Titelblatt des abgerufenen PDF, nicht aus einer
Sekundärquelle. Dass die Vorschrift ein Auszug aus der PDV/DV 810
„Fernmeldebetriebsdienst" ist, steht ebenfalls dort.

Als geprüft hinterlegte Abschnitte:

| Abschnitt | Inhalt |
|---|---|
| 1 | Allgemeines, Geltungsbereich für die BOS |
| 3.4 | Vorrangstufen: Einfach (eee), Sofort (sss), Blitz (bbb), Staatsnot (aaa) |
| 4.1 | Verkehrsarten: Richtungs-, Wechsel- und Gegenverkehr |
| 4.2 | Verkehrsformen: Linien-, Stern-, Kreis- und Querverkehr |
| 4.3 | Abwicklung; Betriebsworte, Sprachwendungen und Buchstabiertafel nach Anlage 15 |
| 4.5 | Übungen: Vermerk „Übung", Tatsachenmeldungen mit Vermerk „Tatsache" |
| 7.2 | Direktbetrieb |
| 7.3 | Relaisbetrieb: Vergrößerung der Reichweite, Überleitung in andere Verkehrsbereiche |

**Zwei Fehler, die dieser Abruf aufgedeckt hat.** Beide standen zuvor veröffentlicht auf
`/verkehrsarten/` und wurden im selben Zug korrigiert:

1. Die Seite nannte vier Verkehrsarten und zählte den Relaisbetrieb dazu. Abschnitt 4.1
   nennt **drei** — Richtungs-, Wechsel- und Gegenverkehr. Der Relaisbetrieb steht in
   Abschnitt 7.3 und ist keine Verkehrsart.
2. Die Seite führte die Relaisschaltungen RS-1 bis RS-4 so auf, als stünden sie in der
   Vorschrift. Sie stehen dort nicht. Abschnitt 7.3 nennt zwei Zwecke des Relaisbetriebs;
   die Bezeichnungen stammen aus der Gerätepraxis des analogen BOS-Funks. Die Seite sagt
   das jetzt ausdrücklich.

## 2. DIN 5009 „Diktierregeln"

| | |
|---|---|
| Ausgabe | 2022-06 |
| Abgerufen bei | DIN Media (Beuth), Normenauskunft |
| URL | https://www.dinmedia.de/de/norm/din-5009/352073096 |
| Gelesen | Titel, Ausgabedatum, Anwendungsbereich und Ersetzungsvermerk der Normenauskunft |

Belegt sind damit: der Titel, dass die Ausgabe 2022-06 die Ausgabe 1996-12 ersetzt und
dass die Buchstabiertafel auf Städtenamen statt auf Vornamen umgestellt wurde.

**Nicht belegt und deshalb nirgends behauptet:** der Wortlaut einzelner Tabellenzeilen.
Der Normtext ist kostenpflichtig und wurde nicht erworben. Die Buchstabiertafel auf
`/buchstabiertafel/` gibt die in der Ausbildung verwendete Fassung wieder und beruft
sich für den einzelnen Buchstaben nicht auf die Norm.

## 3. Ausbildungshandbuch Sprechfunk im THW

| | |
|---|---|
| Herausgeber | THW-Leitung |
| Gelesen | nur der Titel |

Der Abruf des PDF lief in eine Zugriffssperre (Bot-Schutz) und war nicht zu umgehen.
Belegt ist deshalb ausschließlich, dass ein Dokument dieses Titels existiert.

**Folge für die Website:** Ausgabe, Version und Kapitelnummern stehen nirgends. Drei
zuvor veröffentlichte Kapitelangaben (`Kapitel 2`, `2.5 und 3.2`, `5.2.1`) wurden
ersatzlos entfernt, ebenso die falsche Kurzform „THW-Handbuch *Sprechfunk im THW*".
Der Quellenabschnitt der betroffenen Seiten sagt das offen.

---

## Zuordnung Seite → Quelle

| Seite | Quelle (geprüfte Abschnitte) | Zusätzlicher Hinweis auf der Seite |
|---|---|---|
| `/sprechfunk-regeln/` | DV 810.3 (1, 4.3) | ja |
| `/betriebsworte/` | DV 810.3 (4.3) | ja |
| `/buchstabiertafel/` | DV 810.3 (4.3), DIN 5009 | – |
| `/verkehrsarten/` | DV 810.3 (4.1, 4.2, 7.2, 7.3) | ja |
| `/uebungsfunkverkehr/` | DV 810.3 (3.4, 4.5) | – |
| `/funkrufnamen/` | DV 810.3 (1) | ja |
| `/funkrufnamen-thw/` | THW-Handbuch (keine Fundstelle) | ja |
| `/funkuebung-katastrophenschutz/` | DV 810.3 (1) | ja |
| `/wissen/` | DV 810.3 (1) | ja |
| `/funkmeldesystem/` | **keine geprüfte Quelle** | ja |
| `/bos-funk/` | DV 810.3 (1) | ja |
| `/funkreichweite/` | THW-Handbuch (keine Fundstelle) | – |
| `/antennen/` | THW-Handbuch (keine Fundstelle) | – |

## Bewusst nicht belegt

Diese Angaben stehen auf der Website, aber **ohne** Quellenangabe, weil keine geprüfte
vorliegt. Sie sind als solche gekennzeichnet:

- **Statusmeldungen des Funkmeldesystems.** Die Bedeutungen sind weitgehend, aber nicht
  vollständig einheitlich; maßgeblich ist die Festlegung der zuständigen Leitstelle.
- **Relaisschaltungen RS-1 bis RS-4.** Gerätepraxis des analogen BOS-Funks, nicht
  Vorschriftentext.
- **Technische Einzelheiten zu TMO und DMO.** Wiedergabe des Sprachgebrauchs der
  Ausbildung.
- **Funkrufnamen einzelner Bundesländer und Organisationen.** Ländersache; die Beispiele
  zeigen den Aufbau, keine bundesweite Festlegung.

## Offene Punkte

- Die PDV/DV 810.3 wurde über eine Kopie bei einer Hilfsorganisation abgerufen, nicht
  über eine amtliche Veröffentlichung. Eine amtliche Fundstelle wäre besser; sie war
  nicht frei zugänglich.
- Das Ausbildungshandbuch des THW bleibt ungeprüft, solange der Abruf blockiert ist.
- Fachliche Freigabe der beiden Korrekturen auf `/verkehrsarten/`: **offen.**
