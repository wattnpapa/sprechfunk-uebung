# Wettbewerbsvergleich: Quellen und Belege

Register aller Aussagen über Dritte, die auf sprechfunk-uebung.de veröffentlicht sind
(AP-09). **Von Hand gepflegt** – im Gegensatz zu den übrigen Dateien unter `seo/` wird
diese nicht generiert.

Regeln:

1. Jede Aussage über einen Dritten braucht hier eine Zeile mit Quelle und Abrufdatum.
2. Steht eine Aussage nicht hier, darf sie nicht auf der Website stehen.
3. Nur Merkmale, die auf der öffentlichen Website des Anbieters nachlesbar sind. Keine
   Wertung, keine Rückschlüsse, keine Angaben aus zweiter Hand.
4. Wiedervorlage alle sechs Monate. Ändert sich eine Angabe, wird zuerst die Website
   korrigiert, dann diese Datei.

**Letzte Erhebung: 2026-08-04** · **Nächste Wiedervorlage: 2027-02-04**

## Status der Prüfung

| Schritt | Wer | Stand |
| --- | --- | --- |
| Erhebung von der Anbieter-Website | Claude Code (automatisiert, WebFetch) | 2026-08-04 |
| Fachliche Bestätigung | Johannes Rudolph | **offen** |
| Rechtliche Freigabe (§ 6 UWG) | Johannes Rudolph | **offen** |

Solange die letzten beiden Zeilen offen sind, darf `/alternative/` nicht nach main
gemergt werden.

## funkuebung.de

Verwendet auf: `/alternative/` (Abschnitte „Weg 4", „Die Merkmale nebeneinander",
„Wann die kommerzielle Lösung die bessere Wahl ist").

| Nr. | Aussage auf unserer Seite | Quelle | Abgerufen | Belegtext von dort |
| --- | --- | --- | --- | --- |
| 1 | Nennt für den Einstieg eine Registrierung mit E-Mail-Adresse | https://funkuebung.de/ | 2026-08-04 | „Registrierung mit E-Mail" |
| 2 | Dauerhaft kostenloser Tarif mit Mengengrenzen | https://funkuebung.de/preise | 2026-08-04 | Tarif „Dienstabend", u. a. „Bis zu 8 Teilnehmer pro Übung", „30 KI-Meldungen pro Monat", „4 PDF-Exporte pro Jahr" |
| 3 | Zwei kostenpflichtige Tarife, monatlich kündbar | https://funkuebung.de/preise | 2026-08-04 | „Einheit" 9,00 € monatlich, „Ausbildung" 29,00 € monatlich; „Monatlich kündbar, ohne lange Vertragsbindung" |
| 4 | Meldungen werden per KI erzeugt | https://funkuebung.de/ | 2026-08-04 | „KI-Meldungen auf Knopfdruck" |
| 5 | PDF-Übungsdokument vorhanden | https://funkuebung.de/ | 2026-08-04 | „PDF-Übungsdokument" |
| 6 | Digitaler Teilnehmerzugang per Code | https://funkuebung.de/ | 2026-08-04 | „Digitaler Teilnehmerzugang per Code" |
| 7 | Live-Cockpit für die Übungsleitung | https://funkuebung.de/ | 2026-08-04 | „Live-Cockpit" |
| 8 | Team-Arbeit mit mehreren Logins je Organisation | https://funkuebung.de/ | 2026-08-04 | „Im Team arbeiten – Teilt Übungen innerhalb eurer Einheit … mit mehreren Logins für die Organisation" |
| 9 | Beschaffung über Rechnung möglich | https://funkuebung.de/preise | 2026-08-04 | „Behörden, Ausbildungsstätten & Verbände: Die Beschaffung über Rechnung ist möglich, ohne private Zahlungsmittel." |
| 10 | Grenze von acht Teilnehmern im kostenlosen Tarif | https://funkuebung.de/preise | 2026-08-04 | „Bis zu 8 Teilnehmer pro Übung" |

### Bewusst nicht behauptet

Diese Punkte stehen **nicht** auf der Website, weil kein Beleg vorliegt:

| Nicht behauptet | Grund |
| --- | --- |
| Konkrete Beträge auf `/alternative/` | Preise können sich ändern; ein veralteter Betrag wäre irreführend. Die Seite nennt nur die Tarifstruktur mit Abrufdatum und verlinkt die Preisseite. |
| Wie der Anbieter mit Daten umgeht | Nicht geprüft. Die Vergleichstabelle verweist auf dessen Datenschutzerklärung, statt eine Aussage zu treffen. |
| Ob es einen Gastzugang ohne Konto gibt | Nicht auffindbar. `https://funkuebung.de/registrieren` lieferte am 2026-08-04 HTTP 404; geraten wird nicht. |
| Anzahl verfügbarer Meldungen | Wird nicht als Zahl ausgewiesen. Die Tabelle sagt genau das. |
| Quelloffenheit des Anbieters | Auf der Website nicht ausgewiesen. Die Tabelle sagt „nicht ausgewiesen", nicht „nein". |

## Aussagen über die eigene Anwendung

Nicht Gegenstand von § 6 UWG, aber ebenfalls belegpflichtig – sie müssen mit
`/datenschutz/` und dem Code übereinstimmen.

| Aussage | Beleg im Repo |
| --- | --- |
| Kein Konto, keine Anmeldung | `firestore.rules`, Kopfkommentar: „Die Anwendung kennt keine Authentifizierung." |
| Kein Zugriffsschutz auf Übungen | `firestore.rules`, Restrisiko 1: „Jeder mit dem öffentlichen API-Key kann Übungen lesen, anlegen und LÖSCHEN. Der Übungscode ist ein Auffindbarkeits-, kein Zugriffsschutz." |
| Gespeichert werden Übungsname, Funkrufnamen, Funksprüche | `src/pages/datenschutz.html`, Abschnitt 4 (Firebase) |
| Keine Werbe-Cookies, anonyme Reichweitenmessung | `src/pages/datenschutz.html`, Abschnitt 3 (GoatCounter) |
| EUPL-1.2, Quellcode öffentlich | `LICENSE`, `README.md` |
| Keine Speicherdauer zugesagt | `firestore.rules` enthält keine TTL, es gibt keinen Aufräumjob. Die Seiten nennen deshalb **keine** Dauer. |
