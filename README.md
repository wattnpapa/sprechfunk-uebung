# Sprechfunk Übungsgenerator

[![Build](https://github.com/wattnpapa/sprechfunk-uebung/actions/workflows/main.yml/badge.svg)](https://github.com/wattnpapa/sprechfunk-uebung/actions/workflows/main.yml)
[![Coverage](https://codecov.io/gh/wattnpapa/sprechfunk-uebung/branch/main/graph/badge.svg)](https://codecov.io/gh/wattnpapa/sprechfunk-uebung)
[![Coverage Report](https://img.shields.io/badge/Coverage%20Report-HTML-blue)](https://github.com/wattnpapa/sprechfunk-uebung#readme/coverage/)

Web-Anwendung zur Erstellung von BOS-Sprechfunkübungen mit:
- Generator für Übungsdaten und Funkspruchverteilung
- Teilnehmeransicht mit Tabellen- und Vordruckmodus
- Übungsleitung mit Live-Status/Filtern
- Admin-Übersicht mit Statistik und Verwaltung
- PDF/ZIP-Export

## Live
- Demo: https://sprechfunk-uebung.de/
- Repository: https://github.com/wattnpapa/sprechfunk-uebung

## Kernfunktionen
- Übungskonfiguration:
- Kopfdaten, Teilnehmerliste, Stellennamen, Verteilung der Sprüche
- Lösungswörter:
- keine / zentral / individuell, Zufalls-Neuvergabe
- Quellen:
- Vorlagen oder eigener Text-Upload
- Ergebnisbereich:
- Link-Tabelle (Teilnehmer/Übungsleitung), Copy-/Mail-Aktionen, ZIP-Download
- Teilnehmeransicht:
- Status je Nachricht, Filter, optionales Ausblenden übertragener Nachrichten
- Modal mit PDF-Seiten (Meldevordruck/Nachrichtenvordruck), Tastenkürzel
- Übungsleitung:
- Teilnehmerstatus, Nachrichtenplan, Sender-/Empfänger-/Textfilter
- Admin:
- Übungsliste, Suche, Pagination, Kennzahlen/Diagramm, Löschen
- Themes:
- Light/Dark + Star-Trek-Theme (LCARS-Stil)

## Lokal starten
Voraussetzungen:
- Node.js 20+
- npm

Schritte:
1. `npm ci`
2. `npm run build`
3. `npm run serve`
4. Browser öffnen: `http://127.0.0.1:3000`

Entwicklung mit Watch:
- `npm run dev`

## Tests und Qualität
- Lint: `npm run lint`
- Unit/Integration: `npm run test`
- Coverage: `npm run test:coverage`
- E2E komplett: `npm run test:e2e`

E2E-Suiten (tag-basiert):
- Smoke: `npm run test:e2e:smoke`
- Generator: `npm run test:e2e:generator`
- Admin: `npm run test:e2e:admin`
- Teilnehmer: `npm run test:e2e:teilnehmer`
- Übungsleitung: `npm run test:e2e:uebungsleitung`
- Routing: `npm run test:e2e:routing`
- Alle nacheinander: `npm run test:e2e:split`

## CI/CD (GitHub Actions)
Workflow: `.github/workflows/main.yml`
- Build, Lint, Unit/Integration mit Coverage
- Codecov-Upload (`CODECOV_TOKEN` via Secret/Variable)
- E2E als Matrix-Jobs:
- `smoke`, `generator`, `admin`, `teilnehmer`, `uebungsleitung`, `routing`
- E2E Matrix läuft nur bei relevanten Code-Änderungen (Path Filter)
- Playwright mit Retry in CI (`retries: 1`)
- Pro E2E-Suite werden Artefakte hochgeladen:
- `test-results`, `playwright-report`
- E2E JUnit-Resultate werden zu Codecov hochgeladen
- Deployment auf GitHub Pages nach erfolgreichen Jobs
- Nightly Full E2E: `.github/workflows/e2e-nightly.yml`
- PR-Validierung: `.github/workflows/ci.yml`
- Empfohlene Required Checks (Branch Protection):
- `validate`
- `e2e-smoke-routing`

## Analytics
- GA4 Tracking mit generischem `ui_click` Event + Feature-Events
- Eindeutige Klick-Zuordnung via `click_key` und `data-analytics-id`
- Route-spezifische Page-Titel für bessere Auswertung pro Modul
- Consent-Mode: Tracking standardmäßig aus, per Footer-Button aktivierbar
- Event-Schema: `docs/analytics-events.md`
- Dashboard-Vorschlag: `docs/analytics-dashboard.md`
- Error Monitoring: `docs/error-monitoring.md`
- Architekturentscheidungen: `docs/adr/`

## Sicherheit / Dependencies
- Sicherheitsupdates regelmäßig über Dependabot/NPM Audit
- `jspdf`/`jspdf-autotable` auf aktuellem Stand
- Dependabot Konfiguration: `.github/dependabot.yml`
- Geplanter Hygiene-Workflow: `.github/workflows/dependency-hygiene.yml`

## Betrieb / Performance
- Feature Flags: `docs/feature-flags.md`
- Performance Budget: `docs/performance-budget.md`
- Backup/Restore Playbook: `docs/backup-restore-firestore.md`

## Lizenz
MIT

# 📖 Anleitung – Sprechfunk Übungsgenerator

## 🔹 Überblick
Mit diesem Generator kannst du realistische **Sprechfunk-Übungen** erstellen – inklusive Teilnehmerverwaltung, Funkspruchverteilung und PDF-Erstellung für alle Beteiligten.

---

## 🚀 Schnellstart

1️⃣ **Kopfdaten eingeben**  
2️⃣ **Teilnehmer verwalten**  
3️⃣ **Funksprüche auswählen oder hochladen**  
4️⃣ **Lösungswörter aktivieren (optional)**  
5️⃣ **Übung generieren & Vorschau ansehen**  
6️⃣ **PDFs für Teilnehmer & Übungsleitung erstellen**  
7️⃣ **Statistik zur Nachrichtenverteilung auswerten**  

---

## 📅 1️⃣ Kopfdaten eintragen

Bevor die Übung gestartet wird, müssen folgende Angaben gemacht werden:

- **Datum der Übung**
- **Name der Übung**
- **Rufgruppe der Übung**
- **Funkrufname der Übungsleitung**

Diese Informationen erscheinen später auf den generierten PDFs.

---

## 👥 2️⃣ Teilnehmer hinzufügen & verwalten

- **Teilnehmer hinzufügen:** Klicke auf **„Teilnehmer hinzufügen“**.
- **Teilnehmer bearbeiten:** Namen können direkt in den Eingabefeldern geändert werden.
- **Teilnehmer entfernen:** Mit dem **Mülleimer-Icon** kann ein Teilnehmer gelöscht werden.

---

## 🎤 3️⃣ Funksprüche konfigurieren

- **Funkspruch-Vorlage wählen:** Wähle eine der vordefinierten Vorlagen.
- **Eigene Datei hochladen:** Falls eigene Funksprüche genutzt werden sollen.
- **Anzahl der Funksprüche pro Teilnehmer festlegen**.
- **Verteilung einstellen:**
  - **An Alle:** Funksprüche, die alle Teilnehmer hören.
  - **An Mehrere:** Funksprüche, die an eine zufällige Teilnehmergruppe gehen.
  - **An Einzelne:** Direkte Nachrichten an einen Teilnehmer.

---

## 🔑 4️⃣ Lösungswörter-Modus (optional)

- **Zentrales Lösungswort:** Alle Teilnehmer müssen das gleiche Wort entschlüsseln.
- **Individuelle Lösungswörter:** Jeder Teilnehmer bekommt ein eigenes Wort.
- **Automatische Zuweisung oder manuelle Eingabe möglich**.

Falls aktiviert, werden Lösungsbuchstaben über mehrere Funksprüche verteilt.

---

## ⚙ 5️⃣ Übung generieren & Vorschau anzeigen

- Klicke auf **„Übung generieren“**, um die Funksprüche zu verteilen.
- Eine Vorschau wird angezeigt.
- Mit den Navigationspfeilen kann zwischen den Seiten gewechselt werden.

---

## 📄 6️⃣ PDFs generieren

- **Teilnehmer PDFs:** Enthalten individuelle Übungsblätter mit Funksprüchen.
- **Übungsleitung PDF:** Enthält eine Übersicht über alle Teilnehmer & Nachrichten.
- **Nachrichtenvordruck PDFs:** Erstellt für jeden Teilnehmer eine PDF mit Nachrichtenvorlagen.
- **ZIP-Download:** Alle PDFs können gebündelt heruntergeladen werden.

---

## 📊 7️⃣ Statistik & Auswertung

- **Balkendiagramm zeigt Nachrichtenverteilung** auf Teilnehmer.
- **Berechnung der geschätzten Übungsdauer** basierend auf:
  - Länge der Nachrichten.
  - Anzahl der Nachrichtenempfänger.
  - Verzögerungen durch Wiederholungen & Mitschreiben.

📌 **Erklärung zur Berechnung der Dauer:**  
- Die Zeit wird für jede Nachricht individuell berechnet.
- Empfänger müssen Nachrichten **mitschreiben**, daher dauert die Übertragung länger.
- **Optimale & langsame Zeiten** werden geschätzt.

---

# 🛠 Mitwirken & Feedback  

Du hast eine Idee oder hast einen Bug gefunden?  
Super! **Pull Requests sind willkommen!** 🎉  

📌 **Wie du helfen kannst:**  
- Code verbessern & Fehler beheben  
- Neue Features vorschlagen & implementieren  
- Tests schreiben & optimieren  
- Dokumentation verbessern  

🚀 **Mach mit & trage zum Projekt bei!**  
[📩 Eröffne ein Issue auf GitHub](https://github.com/wattnpapa/sprechfunk-uebung/issues)  

---

# 👨‍💻 Über den Autor  

![Johannes Rudolph](https://www.gravatar.com/avatar/b4d8c8a87a392586b9caee287180163b?s=200)  

👋 **Johannes Rudolph**  
💼 **Master of Client Adventures** bei **DIA Connecting Software GmbH & Co. KG**  
📍 **B2B eCommerce, Digitalisierung & IT-Strategie**  

🛠 **Technik, Prozesse & Vernetzung**  
Johannes ist ein Experte für digitale Geschäftsmodelle, IT-Schnittstellen & Prozessoptimierung im B2B-Bereich.  

📡 **Ehrenamtlich aktiv im Zivil- und Katastrophenschutz**  
Seit 2007 engagiert er sich im THW – als **Gruppenführer Kommunikation & Bereichsausbilder Sprechfunk**.  
In Einsätzen übernimmt er die **Sachgebietsleitung Kommunikation** und sorgt für zuverlässige Führungsstrukturen.  

📌 **Mein Motto:**  
_"Technik verstehen, vernetzen und sinnvoll einsetzen – in der IT und im Einsatz."_  

🔗 **Mehr erfahren:**  
[🌐 LinkedIn](https://www.linkedin.com/in/johannesrudolph/)  
[💻 GitHub](https://github.com/wattnpapa)  
[📩 Kontakt](mailto:johannes.rudolph@thw-oldenburg.de)  

---

📌 **Lizenz:** MIT License  
📜 Dieses Projekt steht unter der **MIT-Lizenz** – freie Nutzung & Weiterentwicklung erlaubt!  
