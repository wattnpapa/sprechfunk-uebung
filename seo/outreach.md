# Zielliste für die Ansprache (AP-12)

Recherchierte Anlaufstellen, bei denen der Übungsgenerator inhaltlich passt.
**Diese Liste ist nur zusammengestellt und geprüft – verschickt wurde nichts.**
Jede Kontaktaufnahme macht ein Mensch, einzeln.

Alle URLs am **2026-08-04** abgerufen und mit HTTP 200 beantwortet, geprüft mit
`npm run outreach:check`. Der Lauf braucht Netz und läuft deshalb nicht in der CI.

## Regeln für die Ansprache

Diese Regeln sind nicht Deko, sondern der Grund, warum die Liste überhaupt
brauchbar ist:

- **Kein Massenversand.** Jede Nachricht bezieht sich auf die konkrete Stelle.
  Zehn passende Anschreiben schlagen hundert gleichlautende.
- **Nutzen nennen, nicht um einen Link bitten.** Der tragfähige Aufhänger ist
  „hier ist ein kostenloses Werkzeug, mit dem eure Sprechfunkausbildung weniger
  Vorbereitung braucht" – nicht „bitte verlinkt uns". Wer den Link zur Bedingung
  macht, bekommt weder Link noch Nutzer.
- **Belastbare Punkte zuerst:** kostenlos, ohne Anmeldung, ohne Installation,
  quelloffen unter EUPL-1.2, Bestand echter Übungsfunksprüche. Alles davon ist
  in einer Minute nachprüfbar.
- **Keine Superlative, kein Vergleich mit anderen Anbietern.** Wer eine kommerzielle
  Lösung nutzt, hat dafür Gründe.
- **Ein einziges Nachfassen**, frühestens nach drei Wochen. Danach nicht mehr.
- **Antwortet jemand mit Kritik, ist das ein Ergebnis**, kein Hindernis. In den
  Status eintragen, was tatsächlich zurückkam.

### Was ausgeschlossen ist

- Gekaufte Links, Linktausch-Netzwerke, bezahlte Gastbeiträge ohne Kennzeichnung
- Automatisierter E-Mail-Versand aus dem Repository heraus
- Kommentar-Links in Foren
- Verzeichniseinträge in Linkfarmen
- **Kontaktdaten von Privatpersonen in dieser Datei.** Es stehen hier nur
  öffentliche Organisationsauftritte; der konkrete Ansprechweg wird beim
  Ansprechen auf der jeweiligen Seite gesucht und nicht hier gesammelt.
  `scripts/lib/outreach.mjs` bricht ab, wenn eine private Adresse oder
  Telefonnummer in einer Zeile auftaucht.

### Status

`offen` · `angesprochen` · `verlinkt` · `abgelehnt` · `zurückgestellt`

---

## THW: Bundesebene, Ortsverbände und Jugend

Der Generator ist im THW entstanden; die Fachgruppe Kommunikation ist die Stelle,
an der Sprechfunkausbildung tatsächlich stattfindet.

| Name | URL | Warum passend | Relevanter Inhalt | Kanal | Status |
|---|---|---|---|---|---|
| Technisches Hilfswerk (Bundesanstalt) | [thw.de](https://www.thw.de/) | Träger der Sprechfunkausbildung im THW; Ausgangspunkt zu Landesverbänden und Ortsverbänden | `/funkuebung-thw/`, `/funkrufnamen-thw/` | Kontaktformular der Bundesanstalt | offen |
| THW-Jugend | [thw-jugend.de](https://www.thw-jugend.de/) | Jugendarbeit braucht wiederholbare Übungen ohne Vorbereitungsaufwand | Vorlage „Humorvolle Lagen", `/funkuebung-dienstabend/` | Kontaktformular | offen |
| THW-Bundesvereinigung | [thw-bv.de](https://www.thw-bv.de/) | Fördervereinigung mit Reichweite in die Ortsverbände | `/open-source/`, `/kostenlos-ohne-anmeldung/` | Kontaktformular | offen |
| THW-Ortsverband Oldenburg | [thw-oldenburg.de](https://www.thw-oldenburg.de/) | Eigener Ortsverband des Autors, naheliegender erster Schritt | Aushänge, `/funkuebung-thw/` | direkt im Ortsverband | offen |
| THW-Ortsverband Hannover | [thw-hannover.de](https://www.thw-hannover.de/) | Großer Ortsverband mit eigener Website | `/funkuebung-thw/`, Checkliste als PDF | Kontaktformular | offen |
| THW-Ortsverband Köln | [thw-koeln.de](https://www.thw-koeln.de/) | Großer Ortsverband mit eigener Website | `/funkuebung-thw/`, `/x-zeit/` | Kontaktformular | offen |
| THW-Ortsverband München | [thw-muenchen.de](https://www.thw-muenchen.de/) | Großer Ortsverband mit eigener Website | `/funkuebung-planen/`, Aushänge | Kontaktformular | offen |
| THW-Ortsverband Hamburg | [thw-hamburg.de](https://www.thw-hamburg.de/) | Großer Ortsverband mit eigener Website | `/funkuebung-thw/` | Kontaktformular | offen |
| THW-Ortsverband Melle | [thw-melle.de](https://www.thw-melle.de/) | Hat bereits Übungsfunksprüche beigesteuert | `/funksprueche/vorlage/thw-melle/` | bestehender Kontakt | offen |

## Feuerwehr: Landesverbände und Kreisebene

Hier fehlt dem Bestand am meisten: die mitgelieferten Übungstexte sind stark
THW-geprägt. Der Aufhänger ist deshalb zweiseitig – Werkzeug anbieten **und**
um Übungstexte bitten.

| Name | URL | Warum passend | Relevanter Inhalt | Kanal | Status |
|---|---|---|---|---|---|
| Deutscher Feuerwehrverband | [feuerwehrverband.de](https://www.feuerwehrverband.de/) | Dachverband mit Fachbereichen zu Ausbildung und Technik | `/funkuebung-feuerwehr/`, `/einbetten/` | Kontaktformular | offen |
| Deutsche Jugendfeuerwehr | [jugendfeuerwehr.de](https://jugendfeuerwehr.de/) | Jugendarbeit mit wiederkehrendem Übungsbedarf | `/funkuebung-dienstabend/` | Kontaktformular | offen |
| Landesfeuerwehrverband Niedersachsen | [lfv-nds.de](https://www.lfv-nds.de/) | Landesverband mit Ausbildungsstruktur | `/funkuebung-feuerwehr/`, Aushänge | Kontaktformular | offen |
| Landesfeuerwehrverband Bayern | [lfv-bayern.de](https://www.lfv-bayern.de/) | Landesverband mit sehr vielen angeschlossenen Einheiten | `/funkuebung-feuerwehr/` | Kontaktformular | offen |
| Landesfeuerwehrverband Baden-Württemberg | [fwvbw.de](https://www.fwvbw.de/) | Landesverband mit Ausbildungsstruktur | `/funkuebung-planen/` | Kontaktformular | offen |
| Verband der Feuerwehren in NRW | [vdf-nrw.de](https://www.vdf-nrw.de/) | Landesverband des bevölkerungsreichsten Bundeslandes | `/funkuebung-feuerwehr/` | Kontaktformular | offen |
| Landesfeuerwehrverband Hessen | [feuerwehr-hessen.de](https://www.feuerwehr-hessen.de/) | Landesverband mit Ausbildungsstruktur | `/sprechfunk-regeln/`, Aushänge | Kontaktformular | offen |
| Landesfeuerwehrverband Rheinland-Pfalz | [lfv-rlp.de](https://www.lfv-rlp.de/) | Landesverband mit Ausbildungsstruktur | `/funkuebung-feuerwehr/` | Kontaktformular | offen |
| Landesfeuerwehrverband Schleswig-Holstein | [lfv-sh.de](https://www.lfv-sh.de/) | Landesverband mit Ausbildungsstruktur | `/funkuebung-planen/` | Kontaktformular | offen |
| Landesfeuerwehrverband Sachsen | [lfv-sachsen.de](https://www.lfv-sachsen.de/) | Landesverband mit Ausbildungsstruktur | `/funkuebung-feuerwehr/` | Kontaktformular | offen |
| Landesfeuerwehrverband Brandenburg | [lfv-brandenburg.de](https://www.lfv-brandenburg.de/) | Landesverband mit Ausbildungsstruktur | `/funkuebung-feuerwehr/` | Kontaktformular | offen |
| Landesfeuerwehrverband Saarland | [lfv-saarland.de](https://www.lfv-saarland.de/) | Landesverband mit Ausbildungsstruktur | `/funkuebung-feuerwehr/` | Kontaktformular | offen |
| Berliner Feuerwehr | [berliner-feuerwehr.de](https://www.berliner-feuerwehr.de/) | Berufsfeuerwehr mit eigenem Ausbildungsbetrieb | `/betriebsworte/`, Aushänge | Kontaktformular | offen |
| Kreisfeuerwehr Osnabrück | [kreisfeuerwehr-osnabrueck.de](https://www.kreisfeuerwehr-osnabrueck.de/) | Kreisebene – dort findet die Sprechfunkausbildung statt | Checkliste als PDF, `/funkuebung-planen/` | Kontaktformular | offen |
| Kreisfeuerwehrverband Rendsburg-Eckernförde | [kfv-rd-eck.de](https://www.kfv-rd-eck.de/) | Kreisebene mit Ausbildungsbetrieb | `/funkuebung-feuerwehr/` | Kontaktformular | offen |
| Arbeitsgemeinschaft der Leiter der Berufsfeuerwehren | [agbf.de](https://www.agbf.de/) | Fachgremium der Berufsfeuerwehren | `/bos-funk/`, `/funkmeldesystem/` | Kontaktformular | offen |
| Vereinigung zur Förderung des Deutschen Brandschutzes | [vfdb.de](https://www.vfdb.de/) | Fachvereinigung mit Referaten zu Technik und Ausbildung | `/verkehrsarten/`, `/funkreichweite/` | Kontaktformular | offen |

## Hilfsorganisationen mit eigener Sprechfunkausbildung

Alle fünf arbeiten im Katastrophenschutz nach denselben Regeln. Der Einstieg
führt jeweils über den Bundesverband zu den Gliederungen.

| Name | URL | Warum passend | Relevanter Inhalt | Kanal | Status |
|---|---|---|---|---|---|
| Deutsches Rotes Kreuz | [drk.de](https://www.drk.de/) | Bundesverband; Einstieg zu den Kreisverbänden mit Ausbildungsbetrieb | `/funkuebung-katastrophenschutz/` | Kontaktformular | offen |
| Johanniter-Unfall-Hilfe | [johanniter.de](https://www.johanniter.de/) | Bundesverband mit Katastrophenschutzeinheiten | `/funkuebung-katastrophenschutz/` | Kontaktformular | offen |
| Malteser Hilfsdienst | [malteser.de](https://www.malteser.de/) | Bundesverband mit Katastrophenschutzeinheiten | `/sprechfunk-regeln/` | Kontaktformular | offen |
| Deutsche Lebens-Rettungs-Gesellschaft | [dlrg.de](https://www.dlrg.de/) | Wasserrettung mit eigenem Sprechfunkbetrieb | `/verkehrsarten/`, `/funkreichweite/` | Kontaktformular | offen |
| Arbeiter-Samariter-Bund | [asb.de](https://www.asb.de/) | Bundesverband mit Katastrophenschutzeinheiten | `/funkuebung-katastrophenschutz/` | Kontaktformular | offen |

## Behörden im Bevölkerungsschutz

Kein Verlinkungsziel im engeren Sinn, aber die Stellen, an denen fachliche
Richtigkeit geprüft werden kann – und ein möglicher Weg in Fachnewsletter.

| Name | URL | Warum passend | Relevanter Inhalt | Kanal | Status |
|---|---|---|---|---|---|
| Bundesamt für Bevölkerungsschutz und Katastrophenhilfe | [bbk.bund.de](https://www.bbk.bund.de/) | Fachbehörde für Bevölkerungsschutz und Ausbildung | `/funkuebung-katastrophenschutz/` | Kontaktformular | offen |
| Bundesanstalt für den Digitalfunk der BOS | [bdbos.bund.de](https://www.bdbos.bund.de/) | Zuständig für den BOS-Digitalfunk; Bezug zu TMO und DMO | `/bos-funk/` | Kontaktformular | offen |

## Fachportale, Blogs und Ausbildungsplattformen

Die wahrscheinlichsten Linkgeber: sie berichten regelmäßig über Werkzeuge für
die Ausbildung.

| Name | URL | Warum passend | Relevanter Inhalt | Kanal | Status |
|---|---|---|---|---|---|
| Feuerwehr-Magazin | [feuerwehrmagazin.de](https://www.feuerwehrmagazin.de/) | Fachmedium der Feuerwehren mit großer Reichweite | `/funkuebung-feuerwehr/`, Aushänge | Redaktionskontakt der Website | offen |
| 112 Magazin | [112-magazin.de](https://www.112-magazin.de/) | Fachmagazin für Feuerwehr und Rettungsdienst | `/funkuebung-planen/` | Redaktionskontakt der Website | offen |
| rettungsdienst.de | [rettungsdienst.de](https://www.rettungsdienst.de/) | Fachportal für den Rettungsdienst | `/bos-funk/`, `/funkmeldesystem/` | Redaktionskontakt der Website | offen |
| Feuerwehr-Weblog | [feuerwehr-weblog.de](https://www.feuerwehr-weblog.de/) | Unabhängiges Blog zu Feuerwehrthemen | `/open-source/`, `/kostenlos-ohne-anmeldung/` | Kontaktformular | offen |
| Feuerwehr LernBar | [feuerwehr-lernbar.de](https://www.feuerwehr-lernbar.de/) | Plattform rund um Ausbildungsmaterial | Aushänge als PDF, `/einbetten/` | Kontaktformular | offen |
| Atemschutzunfälle.de | [atemschutzunfaelle.de](https://www.atemschutzunfaelle.de/) | Etabliertes Fachportal mit Ausbildungsbezug | `/uebungsfunkverkehr/` | Kontaktformular | offen |
| BOSfahrzeuge | [bosfahrzeuge.de](https://www.bosfahrzeuge.de/) | Community rund um BOS-Technik | `/funkrufnamen/`, `/bos-funk/` | Kontaktformular | offen |
| Blaulicht-Nachrichten | [blaulicht-nachrichten.de](https://www.blaulicht-nachrichten.de/) | Nachrichtenportal mit BOS-Bezug | `/kostenlos-ohne-anmeldung/` | Redaktionskontakt der Website | offen |
| Feuerwehr-UB | [feuerwehr-ub.de](https://www.feuerwehr-ub.de/) | Anbieter von Unterrichtsmaterial für die Feuerwehr | Aushänge, `/buchstabiertafel/` | Kontaktformular | offen |
| Funkbasis | [funkbasis.de](https://www.funkbasis.de/) | Community zu Funktechnik einschließlich BOS | `/funkreichweite/`, `/antennen/` | Forenregeln beachten, kein Kommentar-Link | zurückgestellt |

## Fachverlage und Zeitschriften mit Online-Ausgabe

| Name | URL | Warum passend | Relevanter Inhalt | Kanal | Status |
|---|---|---|---|---|---|
| Brandschutz online | [brandschutz-online.de](https://www.brandschutz-online.de/) | Online-Auftritt einer Fachzeitschrift zum Brandschutz | `/sprechfunk-regeln/` | Redaktionskontakt der Website | offen |
| Kohlhammer Verlag | [kohlhammer.de](https://www.kohlhammer.de/) | Verlag mit Programm zu Feuerwehr und Bevölkerungsschutz | `/verkehrsarten/` | Kontaktformular | offen |
| S+K Verlag | [skverlag.de](https://www.skverlag.de/) | Fachverlag für Feuerwehr und Rettungsdienst | `/funkuebung-planen/` | Kontaktformular | offen |
| ecomed Storck | [ecomed-storck.de](https://www.ecomed-storck.de/) | Fachverlag mit Titeln zur Gefahrenabwehr | `/bos-funk/` | Kontaktformular | offen |

## Freie Software für Behörden und Organisationen

Hier zählt die Lizenz, nicht das Thema: EUPL-1.2 ist die Open-Source-Lizenz der
Europäischen Union und in Behörden anerkannt.

| Name | URL | Warum passend | Relevanter Inhalt | Kanal | Status |
|---|---|---|---|---|---|
| Open CoDE | [opencode.de](https://opencode.de/) | Plattform für Open Source der öffentlichen Verwaltung | `/open-source/`, Quellcode unter EUPL-1.2 | Registrierung und Projekteintrag | offen |
| Zentrum für Digitale Souveränität | [zendis.de](https://zendis.de/) | Betreiber von Open CoDE, Schwerpunkt digitale Souveränität | `/open-source/` | Kontaktformular | offen |
| Open Source Business Alliance | [osb-alliance.de](https://osb-alliance.de/) | Verband für Open Source in Deutschland | `/open-source/` | Kontaktformular | offen |

## Sammlungen und Verzeichnisse auf GitHub

Kein Anschreiben, sondern ein Pull Request oder ein passend gesetztes Thema am
eigenen Repository.

| Name | URL | Warum passend | Relevanter Inhalt | Kanal | Status |
|---|---|---|---|---|---|
| GitHub-Thema „emergency-management" | [github.com/topics/emergency-management](https://github.com/topics/emergency-management) | Sammelpunkt für Software im Bevölkerungsschutz | Repository-Themen ergänzen | Themen am eigenen Repository setzen | offen |
| GitHub-Thema „disaster-response" | [github.com/topics/disaster-response](https://github.com/topics/disaster-response) | Sammelpunkt für Software in der Gefahrenabwehr | Repository-Themen ergänzen | Themen am eigenen Repository setzen | offen |
| GitHub-Thema „civil-protection" | [github.com/topics/civil-protection](https://github.com/topics/civil-protection) | Kleinerer, thematisch sehr genauer Sammelpunkt | Repository-Themen ergänzen | Themen am eigenen Repository setzen | offen |
| Awesome-Verzeichnis | [awesome.re](https://awesome.re/) | Einstieg zu den thematischen Awesome-Listen | Passende Liste suchen, dann Pull Request | Pull Request an die jeweilige Liste | offen |

---

## Was zuerst

Nicht alles auf einmal. In dieser Reihenfolge ist der Aufwand am kleinsten und
der erwartbare Ertrag am größten:

1. **GitHub-Themen setzen** – kostet fünf Minuten, kein Anschreiben nötig.
2. **Eigener Ortsverband und die beitragenden Ortsverbände** – bestehender
   Kontakt, echter Nutzen, glaubwürdigste Referenz.
3. **Zwei bis drei Kreisverbände der Feuerwehr** – dort findet die Ausbildung
   statt, und dort fehlen dem Bestand Übungstexte.
4. **Ein Fachportal** – erst ansprechen, wenn Punkt 2 und 3 etwas ergeben haben,
   das sich zeigen lässt.
5. **Open CoDE** – eigener Ablauf mit Registrierung, deshalb separat einplanen.

## Offene Punkte

- Der Ansprechweg steht bewusst nur als Kanalart in der Tabelle. Die konkrete
  Adresse wird beim Ansprechen auf der jeweiligen Seite gesucht, nicht hier
  gesammelt.
- Die Statusspalte pflegt der Mensch, der anspricht. Solange überall `offen`
  steht, hat noch keine Ansprache stattgefunden.
- Ob eine Stelle tatsächlich einen Ausbildungsbereich auf ihrer Website führt,
  ist hier **nicht** durchgängig geprüft – geprüft ist, dass die Seite
  existiert und wofür die Organisation zuständig ist.
- Nicht aufgenommen: der Landesfeuerwehrverband Mecklenburg-Vorpommern.
  `www.lfv-mv.de` liefert am 2026-08-04 eine unvollständige Zertifikatskette
  (`UNABLE_TO_GET_ISSUER_CERT_LOCALLY`), sowohl gegenüber Node als auch
  gegenüber curl. Sobald das behoben ist, gehört der Verband in die Liste.
