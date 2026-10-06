Befunde: P0=0 P1=1 P2=2 P3=5
Abgleich: behoben=8 teilweise=2 offen=0 nicht-pruefbar=0

# Offline-Resilienz-Audit (3. Lauf) – Sprechfunk Übungsgenerator

**Reviewer:** offline-resilience (THW Offline Resilience Reviewer)
**Datum:** 2026-10-06
**Stand:** lokaler Build `http://127.0.0.1:3000` (HEAD `b6f025d`), Service Worker aktiv
**Werkzeug:** Playwright mit Chromium 1194, `context.setOffline()`, „Lie-Fi“ über `context.route()` mit 20 s Verzögerung je Abruf bei `navigator.onLine === true`, gezieltes Abbrechen des Druck-Chunks (`route.abort`)
**Screenshots und Protokoll:** `/tmp/claude-0/-home-user-sprechfunk-uebung/8e81b214-a84b-574f-81cf-240dddbe65b9/scratchpad/offline-resilience3/` (`log.txt` enthält alle Messwerte)

## Methodik und Grenzen

Es gibt drei Arten von Aussagen:

- **Beobachtet (Mock):** Lauf im Mock-Modus (`useFirestoreEmulator=1`, Übung in `localStorage`, Seed vom Vortag mit 3 Teilnehmern). Der Mock liest und schreibt synchron in `localStorage`. **Die neue lokale Übungskopie greift dort gar nicht**, denn `FirebaseService.getUebung` kehrt im Mock vorher zurück (`src/services/FirebaseService.ts:145-149`). Ein Reload ohne Netz zeigt im Mock deshalb immer die Übung. Über Firestore sagt das nichts aus.
- **Beobachtet (Echtpfad, angenähert):** Lauf ohne Mock-Flag. Der Browser erreicht Firestore in dieser Umgebung nicht, weil der Proxy mit `ERR_CERT_AUTHORITY_INVALID` bzw. 403 ablehnt. Die App-Hülle kommt trotzdem vom lokalen Server. Das entspricht „App da, Datenbank nicht erreichbar“. Firestore meldet dabei sofort „Could not reach Cloud Firestore backend“. Die Kopie (`sprechfunk:uebung-offline:<id>`) habe ich **von Hand** mit dem Übungsdokument aus dem Seed angelegt, im selben Format, das `speichereOfflineKopie` schreibt (`{stand, json}`, `uebungOfflineKopie.ts:69`). Dass die App die Kopie nach einem erfolgreichen Laden selbst anlegt, konnte ich nicht live sehen. Das ist **Annahme (Code)**: `FirebaseService.ts:163`.
- **Annahme (Code):** Echtes Firestore-Verhalten, aus dem Quelltext abgeleitet. Grundlagen:
  - `firebaseClient.ts`: Speicher-Cache ohne Persistenz. Die Übung überlebt einen Reload nur über die eigene Kopie in `localStorage`, höchstens 3 Übungen (`uebungOfflineKopie.ts:21`).
  - `getUebung`: Ist eine Kopie vorhanden und `navigator.onLine === false`, kommt sie sofort. Bei Netz wartet die App höchstens 6 s auf den Server und nimmt dann die Kopie (`FirebaseService.ts:150-171`). **Ohne** Kopie gibt es kein Zeitlimit (`await anfrage`, Z. 157). Dann bestimmt das SDK, wann es aufgibt.
  - Service Worker `scripts/lib/service-worker.mjs`: network-first, nach 3,5 s Ausweichen auf den Cache. Firestore läuft am Worker vorbei.
- Gegenprobe: Mit `setOffline(true)` scheitern in Chromium auch die Abrufe des Workers. Bei `context.route` laufen die Abrufe des Workers durch die Verzögerung (Lie-Fi-Messung unten).
- Nicht testbar: zwei echte Geräte gegen echtes Firestore (Konflikte, verspätet ankommende Schreibvorgänge).

## Urteil aus Sicht der Rolle

Der Teilnehmer, der seine Seite einmal mit Netz geöffnet hat, kommt jetzt durch ein Funkloch. Er kann offline abhaken. Das Badge sagt „Keine Verbindung – 2 Sprüche nur hier“, jede Karte „Nur auf diesem Gerät – wird gesendet, sobald Netz da ist“. Ein Reload ohne Netz zeigt die Liste aus der Kopie, mit dem Hinweis „letzter bekannter Stand … gespeichert am …“, und die Markierungen sind noch da. Ohne Kopie steht dort eine ehrliche Netz-Fehlerseite statt des Code-Formulars. Zurücksetzen ohne Netz lehnt die App ab. Der Druckteil lädt nach einem Aussetzer wieder, ohne die Seite neu zu laden. Die Übungsleitung sieht den Offline-Zustand oben in der Lage-Box.

Eine Lücke bleibt im häufigsten Wiedereinstieg auf dem Handy: **Wer den ursprünglichen Link aus dem Messenger (`#/teilnehmer?uc=…&tc=…`) im Funkloch erneut antippt, bekommt das Code-Formular mit „Codes konnten nicht geprüft werden“, obwohl die Übung als Kopie auf dem Gerät liegt.** Daneben gibt es zwei kleinere Ehrlichkeitslücken: Der Stand-Hinweis verschwindet bei einem Routenwechsel, und ein nicht bestätigtes Speichern im Generator wird nach dem Zeitlimit nicht weiter verfolgt.

Ohne fremde Hilfe ist die Aufgabe jetzt in fast allen Fällen machbar. Die Papier-Rückfallebene wird an den richtigen Stellen genannt.

---

## Befunde

### P1-1 – Ursprünglicher Teilnehmer-Link öffnet im Funkloch die gespeicherte Kopie nicht

- **Fundstelle / Aufgabe:** Teilnehmer tippt den Link aus Messenger, Mail oder QR-Code erneut an (`#/teilnehmer?uc=WV5GAH&tc=Y553`). Das passiert, wenn der Tab geschlossen wurde oder der Messenger einen neuen Tab öffnet.
- **Beobachtung (Echtpfad, angenähert):** Die Kopie der Übung liegt auf dem Gerät. Über die ID-Route (`#/teilnehmer/<id>/Y553`) erscheint die Liste offline nach 58 ms samt Stand-Hinweis und 1 Markierung (`51-echt-kopie-offline-reload.png`). Derselbe Teilnehmer öffnet offline den Code-Link: Er sieht „Teilnehmer-Zugang … Die Codes konnten gerade nicht geprüft werden – es fehlt die Internetverbindung. Versuch es erneut, sobald wieder Netz da ist.“ Die Codes sind ausgefüllt, aber es kommt keine Liste und kein Stand-Hinweis (`52-echt-codelink-offline-mit-kopie.png`).
  - *Ursache (Code):* `resolveJoinAndNavigate` (`src/teilnehmer/index.ts:292-315`) fragt immer Firestore (`resolveJoinCodesRemote`, `FirebaseService.ts:209-236`). Die Kopie ist nach Übungs-ID abgelegt und wird für die Zuordnung Code → ID nicht befragt, obwohl sie `uebungCode` und `teilnehmerIds` enthält. Die Umleitung auf die ID-Route per `location.replace` hilft nur, solange derselbe Tab weiterlebt.
- **Erwartung der Rolle:** „Ich tippe denselben Link wie vorhin an und sehe meine Sprüche.“ Für den Helfer gibt es nur diesen einen Link. Dass es intern eine zweite Adresse gibt, weiß er nicht.
- **Auswirkung im Einsatz:** Gerade im Gelände wird der Browser-Tab oft geschlossen oder vom System verworfen, und man kommt über den Messenger zurück. Dann steht der Helfer ohne Spruchliste da, obwohl sie auf seinem Gerät liegt. Ihm bleibt nur der Papiervordruck, falls er einen hat. Die Meldung ist immerhin ehrlich, sie schiebt die Schuld nicht mehr auf die Codes.
- **Empfehlung:** Liegt für den Übungscode eine Kopie auf dem Gerät und passt der Teilnehmercode zu deren Teilnehmerliste, diese Kopie mit Stand-Hinweis öffnen, statt am Server zu scheitern. Den Code-Link selbst als Lesezeichen auf die ID-Route ummünzen reicht nicht, weil der Messenger immer den Originallink öffnet.
- **Verifikation:** Echtpfad oder Emulator: Code-Link einmal mit Netz öffnen, Tab schließen, `setOffline(true)`, denselben Code-Link neu öffnen → Liste mit Hinweis „letzter bekannter Stand“, Markierungen erhalten.

### P2-1 – Stand-Hinweis verschwindet beim Routenwechsel, die Daten bleiben veraltet

- **Fundstelle / Aufgabe:** Hinweis `#offlineStandHinweis` („Ohne Verbindung: Angezeigt wird der letzte bekannte Stand …“) nach einem Hash-Wechsel innerhalb der App.
- **Beobachtung (Echtpfad, angenähert):** Die Teilnehmerseite war aus der Kopie geladen, der Hinweis sichtbar. Dann offline per Hash zur Übungsleitung und zurück zum Teilnehmer: Beide Ansichten zeigen die Übung (Teilnehmer 6 Zeilen), **ohne** Hinweis. Kommt das Netz zurück, erscheint auch kein „Jetzt neu laden“, weil `wiederOnline()` den Hinweis voraussetzt (Protokoll `[C]`, `58-echt-hinweis-wieder-online.png`). Beim ersten Laden einer Route bzw. beim Reload erscheint der Hinweis zuverlässig (B1, B4, B5).
  - *Vermutete Ursache (Code):* `initOfflineStandHinweis` räumt bei `hashchange` ab (`src/core/OfflineStandHinweis.ts:82`). Die Kopie wird ohne Netz innerhalb derselben Ereignisverarbeitung geliefert (Microtask), der Hinweis also gesetzt und unmittelbar danach vom späteren `hashchange`-Listener wieder entfernt.
- **Erwartung der Rolle:** Solange alte Daten zu sehen sind, steht das dabei.
- **Auswirkung im Einsatz:** Die Übungsleitung wechselt zwischen Ansichten und hält den gezeigten Übungsstand für aktuell, obwohl er z. B. vor einem Überschreiben im Generator liegt. Nach Netzrückkehr fehlt die Aufforderung zum Neuladen. Das Live-Badge zeigt weiter „Keine Verbindung“, sagt aber nichts über den Stand der Übungsdaten.
- **Empfehlung:** Den Hinweis an die angezeigte Übung binden statt an die Adresse: entfernen, wenn eine frische Serverfassung geladen ist, nicht bei jedem Routenwechsel.
- **Verifikation:** Offline Kopie anzeigen → Hash zur anderen Ansicht und zurück → Hinweis sichtbar. Online gehen → „Jetzt neu laden“ erscheint.

### P2-2 – Generator: Nicht bestätigtes Speichern wird nach dem Zeitlimit nicht weiter verfolgt (Annahme)

- **Fundstelle / Aufgabe:** Generator, „Bestehende Übung überschreiben …“ bzw. „Als neue Übung generieren“ bei schwachem Netz (`navigator.onLine === true`, Server antwortet nicht).
- **Beobachtung:**
  - *Beobachtet:* Bei hartem Offline lehnt die App sofort ab (`controllerGenerieren.ts:72-79`, gegenüber dem Vortag unverändert).
  - *Annahme (Code):* Nach 15 s steht jetzt ein ehrlicher Text: „Speichern nicht bestätigt … kann noch ankommen, solange diese Seite offen ist … Öffne die Übung später mit Netz über ihren Bearbeiten-Link neu“ (`controllerHilfen.ts:62-73`). Die dafür gebaute Funktion `speichereMitBestaetigung` (`src/services/speicherBestaetigung.ts`), die die spätere Ankunft melden könnte, **wird nirgends aufgerufen** (`grep` liefert nur die Definition). `controllerGenerieren.ts:168` nutzt weiter `mitZeitlimit`. Der lokale Stand wird zurückgesetzt (`ctrl.funkUebung = sicherung`). Kommt der Schreibvorgang danach an, zeigt der Generator weiter die alte Fassung, und niemand sagt es.
- **Erwartung der Rolle:** „Ist es jetzt gespeichert oder nicht?“ Wenn die App das später erfährt, sagt sie es von selbst.
- **Auswirkung im Einsatz:** Die Übungsleitung muss selbst daran denken, später neu zu laden und zu vergleichen. Ausdrucke der alten Fassung und Teilnehmer-Links der neuen können auseinanderlaufen. Beim Modus „neu“ kann es die Übung doppelt geben. Das sagt der Text inzwischen selbst.
- **Empfehlung:** Die verspätete Bestätigung abwarten und sichtbar melden („Speichern ist jetzt angekommen – die neue Fassung gilt, Links/Ausdrucke neu verteilen“) bzw. endgültiges Scheitern melden.
- **Verifikation:** Emulator, Antworten 20 s zurückhalten, überschreiben → Zeitlimit-Meldung → freigeben → innerhalb weniger Sekunden folgt eine Folgemeldung, die Anzeige zeigt die gespeicherte Fassung.

### P3-1 – Generator: Alte Fehlermeldung bleibt nach erfolgreichem Neuversuch stehen

- **Fundstelle / Aufgabe:** Generator-Ergebnis, „Alle Druckdaten als ZIP herunterladen“ (`#zipAllPdfsBtn`).
- **Beobachtung (Mock):** Der Druck-Chunk war gesperrt. ZIP → genau eine Meldung „Die Druckfunktion konnte nicht geladen werden … Tipp erneut …“ (`30-gen-zip-blockiert.png`). Sperre aufgehoben, erneut getippt → der Download `Offline-Test_060625oct26.zip` kommt. Die rote Meldung steht aber 12 s später noch unten rechts (`31-gen-zip-retry.png`). Eine Erfolgsmeldung gibt es nicht.
- **Auswirkung:** Der Nutzer sieht neben der heruntergeladenen Datei eine Fehlermeldung und ist unsicher, ob das ZIP vollständig ist.
- **Empfehlung:** Nach erfolgreichem Laden die Druck-Ladefehlermeldung entfernen oder durch einen kurzen Erfolgshinweis ersetzen.
- **Verifikation:** Chunk sperren → ZIP → freigeben → ZIP → keine Fehlermeldung mehr sichtbar.

### P3-2 – Lie-Fi: 7,7 s bis zur Liste, ohne Hinweis auf schwaches Netz

- **Fundstelle / Aufgabe:** Reload der Teilnehmerseite bei Netz, das verbunden ist, aber nicht durchlässt.
- **Beobachtung (Mock):** Jeder eigene Abruf um 20 s verzögert, Service Worker aktiv. Die Liste steht nach **7,7 s** (`25-tn-liefi.png`). Am Vortag blieb die Seite weiß, Navigation nach 40 s. Das ist eine klare Verbesserung. Die Wartezeit entsteht vermutlich, weil Hülle, Bundle und weitere Dateien nacheinander je 3,5 s auf das Netz warten (`NETZ_ZEITLIMIT_MS`). Bis dahin fehlt jeder Hinweis, dass das Netz schwach ist.
- **Empfehlung:** Versionierte Dateien (Bundle, Chunks mit Hash im Namen) sofort aus dem Cache liefern und im Hintergrund aktualisieren. Das Zeitlimit nur für die HTML-Hülle anwenden.
- **Verifikation:** Gleicher Aufbau → Liste in unter 4 s.

### P3-3 – Generator bietet „überschreiben“ auf Basis der Offline-Kopie an

- **Fundstelle / Aufgabe:** `#/generator/<id>`, wenn die Übung aus der Kopie kommt.
- **Beobachtung (Echtpfad, angenähert):** Der Stand-Hinweis erscheint. „Bestehende Übung überschreiben …“ und „Als neue Übung generieren“ bleiben bedienbar, die Rückfrage zum Überschreiben erscheint (`57-echt-generator-kopie.png`, Rückfrage abgebrochen). Ein Speichern scheitert, solange der Server nicht erreichbar ist. *Annahme:* Kommt das Netz zwischendurch zurück (ohne Neuladen), wird mit der alten Fassung als Grundlage überschrieben.
- **Auswirkung:** Selten, denn meist bearbeitet nur eine Person. Wer aber an zwei Geräten arbeitet, kann so einen neueren Stand verdrängen.
- **Empfehlung:** Solange die Kopie angezeigt wird, das Überschreiben sperren oder in der Rückfrage ausdrücklich nennen, dass die Grundlage der gespeicherte Stand von hh:mm ist.
- **Verifikation:** Kopie anzeigen → Überschreiben ist gesperrt oder nennt den Stand.

### P3-4 – Übungsleitung: „(2 warten)“, ohne dass etwas getan wurde

- **Fundstelle / Aufgabe:** `#uebungsleitungLiveSyncBadge` direkt nach dem Öffnen ohne Datenbankverbindung.
- **Beobachtung (Echtpfad, angenähert):** Nach 12 s ohne jede Eingabe steht dort „Live-Status: offline – wird nachgereicht (2 warten)“ (`56-echt-leitung-kopie.png`). Die Zahl stammt aus `getOffeneAenderungen()` (`LiveStatusService.ts:132`) und zählt offenbar Schreibvorgänge, die die App beim Öffnen selbst auslöst.
- **Auswirkung:** Die Leitung fragt sich, welche ihrer Eingaben nicht angekommen sind, und sucht danach.
- **Empfehlung:** Nur Änderungen zählen, die der Nutzer selbst ausgelöst hat, oder sie benennen („2 Einträge“).
- **Verifikation:** Leitung offline öffnen → keine Zahl. Einen Spruch abhaken → „(1 wartet)“.

### P3-5 – „Deine Codes sind in Ordnung“, ohne dass sie geprüft wurden

- **Fundstelle / Aufgabe:** Netz-Fehlerseite des Teilnehmers ohne Kopie (`54-echt-ohne-kopie.png`).
- **Beobachtung:** Der Text ist klar und nennt die Papier-Rückfallebene. Das ist gut. Er behauptet aber „Deine Codes sind in Ordnung“, obwohl ohne Server nichts geprüft wurde (`teilnehmer/index.ts:122-134`). *Annahme:* Ein abgeschnittener oder falscher Link landet offline auf derselben Aussage. Zudem zeigt `ladeUebungUndTeilnehmer` bei **jedem** Fehler diese Seite, also auch bei einem Rechtefehler.
- **Empfehlung:** „Ob deine Codes stimmen, lässt sich ohne Netz nicht prüfen“ statt einer Zusage.
- **Verifikation:** Offline mit erfundener ID öffnen → kein „in Ordnung“.

---

## Positiv festgehalten (beobachtet)

- **Lokale Übungskopie:** Liegt eine Kopie vor, kommt bei unerreichbarem Server nach 0,3 s die Liste (sofortiger Firestore-Fehler), offline nach dem Reload nach 58 ms. Der Hinweis nennt Datum und Uhrzeit und sagt ausdrücklich, dass spätere Änderungen fehlen (`50-…`, `51-…`). Teilnehmer, Übungsleitung und Generator zeigen ihn.
- **Ohne Kopie:** eigene Seite „Keine Verbindung – die Übung kann gerade nicht geladen werden … Arbeite mit den ausgedruckten Vordrucken weiter“, mit „Erneut versuchen“ und ohne Code-Formular. Nach 3, 10 und 20 s unverändert (`54-…`).
- **Badge Teilnehmer:** Es zeigt „Übungsleitung: live · alles gesendet 06:24“, offline „Keine Verbindung – 2 Sprüche nur hier“. Der Tooltip nennt „Zuletzt alles angekommen um 06:24“. Pro Karte steht „Nur auf diesem Gerät – wird gesendet, sobald Netz da ist“ (`21-…`, `51-…`).
- Offline gesetzte Markierungen überstehen den Reload (3/3) und werden nach Netzrückkehr übertragen (Mock).
- Teilnehmer-Zurücksetzen offline: „Zurücksetzen für alle braucht eine Verbindung … es wurde nichts gelöscht“, die Markierungen bleiben (`23-…`).
- Teilnehmer-ZIP offline: 1 Download. Debrief der Leitung offline: genau 1 Download.
- Druckteil-Neuversuch: Abrufe `pdfGenerator-….js`, dann `?neuladen=1/2/3`. Nach Freigabe lädt das ZIP ohne Neuladen der Seite. Im Generator wird der Druckteil beim Anzeigen des Ergebnisses vorgeladen.
- Übungsleitung offline: Banner in der Lage-Box oben „⚠ Keine Verbindung – angezeigt wird der zuletzt bekannte Stand der Teilnehmer … Zuletzt vom Server bestätigt: 06:25“ (`40-ul-offline.png`). Reload offline zeigt den Nachrichtenplan.
- Generator-Hinweis „Druck die Unterlagen vor der Übung aus. Ohne Netz öffnet sich diese Seite nur auf einem Gerät, das sie vorher schon einmal mit Netz geladen hat …“: ehrlich und an der richtigen Stelle (`31-…`).

## Abschluss

- **Aufgabe geschafft:** ja, solange der Teilnehmer über die schon geöffnete Seite bzw. deren Adresse zurückkommt. Mit Umwegen, wenn er den Originallink aus dem Messenger erneut öffnet.
- **Fremde Hilfe nötig:** nein. Die Meldungen nennen die Ursache (Netz) und die Rückfallebene (Papier).
- **Größtes Missverständnis:** Wer im Funkloch den Messenger-Link antippt, hält seine Spruchliste für nicht verfügbar, obwohl sie auf dem Gerät liegt.
- **Größtes Einsatzrisiko:** Nach einem Ansichtswechsel fehlt der Hinweis „letzter bekannter Stand“, und veraltete Übungsdaten wirken aktuell.
- **Top-Priorität für die nächste Iteration:** Den Code-Link offline über die lokale Kopie auflösen (P1-1).

---

## Abgleich mit dem Lauf vom 2026-10-05

| Alt-ID | Titel (kurz) | Alte Prio | Status jetzt | Beleg aus dieser Prüfung |
|---|---|---|---|---|
| P1-1 | Druckteil im Generator nach Offline-Klick bis zum Neuladen kaputt | P1 | **behoben** | Chunk gesperrt → eine Meldung. Freigegeben → erneut getippt → `Offline-Test_060625oct26.zip` geladen, Abrufe mit `?neuladen=N` (`30-…`, `31-…`, `log.txt`). Vorladen im Generator beim Öffnen beobachtet. Rest: alte Meldung bleibt stehen → neu P3-1. |
| P1-2 | Neu öffnen ohne Datenbank: Code-Formular, Schuld bei den Codes | P1 | **teilweise** | ID-Route mit Kopie: Liste plus Stand-Hinweis, Markierungen erhalten (`50-…`, `51-…`). Ohne Kopie: eigene Netz-Fehlerseite ohne Code-Formular (`54-…`). Code-Link aus dem Messenger nutzt die Kopie nicht (`52-…`) → neu P1-1. Hinweis geht beim Routenwechsel verloren → neu P2-1. |
| P1-3 | Lie-Fi: Service Worker ohne Zeitlimit, Seite weiß | P1 | **behoben** | Bei 20 s Verzögerung je Abruf steht die Liste nach 7,7 s (vorher weiß, 40 s) (`25-tn-liefi.png`). Rest → P3-2. |
| P1-4 | Teilnehmer-Zurücksetzen offline ohne Sperre | P1 | **behoben** | Offline abgelehnt: „Zurücksetzen für alle braucht eine Verbindung … es wurde nichts gelöscht“, 3 Markierungen bleiben (`23-…`). Mit Netz: Zeitlimit 10 s, kein Löschen ohne Bestätigung (`teilnehmer/zuruecksetzen.ts:63-78`, Code). |
| P2-1 | Generator meldet „nichts verändert“, Schreiben kommt evtl. später an | P2 | **teilweise** | Text jetzt ehrlich: „Speichern nicht bestätigt … kann noch ankommen“ (`controllerHilfen.ts:62-73`). Die spätere Ankunft wird nicht verfolgt, `speichereMitBestaetigung` ist unbenutzt → neu P2-2. |
| P2-2 | Teilnehmer sieht nicht, wie viel aussteht / wann bestätigt | P2 | **behoben** | „Keine Verbindung – 2 Sprüche nur hier“, online „· alles gesendet 06:24“, Tooltip „Zuletzt alles angekommen um 06:24“ (`log.txt`, `21-…`, `51-…`). |
| P3-1 | Beitritt per Code offline meldet „nicht gefunden“ | P3 | **behoben** | Code-Link bei unerreichbarem Server: „Die Codes konnten gerade nicht geprüft werden – es fehlt die Internetverbindung“ nach 15 s unverändert (`55-…`). Der Fall „leeres Cache-Ergebnis“ ist im Code abgedeckt (`FirebaseService.ts:232`), live nicht reproduzierbar. |
| P3-2 | Fehlermeldungen stapeln sich | P3 | **behoben** | ZIP mit gesperrtem Druckteil erzeugt genau eine Meldung, auch nach dem zweiten Versuch keine zweite (`30-…`, `31-…`). |
| P3-3 | Leitung: Offline-Zustand nur im Kopf des Nachrichtenplans | P3 | **behoben** | Gelbes Banner oben in der Lage-Box mit Folge und Bestätigungszeit, ohne Hover sichtbar (`40-ul-offline.png`). |
| P3-4 | Ein Klick auf „Debrief PDF“ erzeugt zwei Downloads | P3 | **behoben** | Offline geklickt: genau 1 Download (`log.txt`). |
