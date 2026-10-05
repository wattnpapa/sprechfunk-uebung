Befunde: P0=0 P1=4 P2=2 P3=4
Abgleich: behoben=5 teilweise=4 offen=0 nicht-pruefbar=1

# Offline-Resilienz-Audit (2. Lauf) – Sprechfunk Übungsgenerator

**Reviewer:** offline-resilience (THW Offline Resilience Reviewer)
**Datum:** 2026-10-05
**Stand:** lokaler Build `http://127.0.0.1:3000` (Branch `claude/thw-reviewer-full-run-i9kef8`, inkl. Service Worker aus `377fae8`), Mock-Modus (`useFirestoreEmulator=1`, Daten in `localStorage`)
**Werkzeug:** Playwright mit Chromium 1194, `context.setOffline()`, CDP-Drosselung (400 ms Latenz, 50 kB/s), „Lie-Fi“ über `context.route()` mit 25 s Verzögerung bei `navigator.onLine === true`
**Screenshots:** `/tmp/claude-0/-home-user-sprechfunk-uebung/8e81b214-a84b-574f-81cf-240dddbe65b9/scratchpad/offline-resilience2/`

## Methodik und Grenzen

- **Beobachtet** heißt: im laufenden Build mit Playwright erlebt.
- **Annahme (Code)** heißt: Verhalten des echten Firestore-Pfads, aus dem Quelltext abgeleitet und nicht live geprüft. Der Mock schreibt synchron in `localStorage` und kann deshalb weder hängen noch scheitern. Was im Mock nach einem Reload ohne Netz funktioniert, sagt über Firestore nichts aus.
- **Echtpfad, angenähert:** Ohne Mock-Flag erreicht der Browser in dieser Umgebung Firestore nicht. Der Proxy lehnt ab (`net::ERR_CERT_AUTHORITY_INVALID`), die App-Hülle kommt aber vom lokalen Server. Das entspricht „App geladen, Datenbank nicht erreichbar“ und zeigt, was ein Teilnehmer sieht, wenn `getDoc` scheitert (Screenshot `30-echtpfad-tn-3s.png`). Ein echtes Funkloch lässt `getDoc` erst nach einigen Sekunden mit „client is offline“ scheitern. Die angezeigte Seite ist dieselbe.
- Grundlagen aus dem Code:
  - `src/services/firebaseClient.ts:36`: `getFirestore(app)` ohne persistenten Cache. Über einen Reload hinweg gibt es keinen lokalen Vorrat der Übung.
  - Service Worker `scripts/lib/service-worker.mjs` → `dist/sw.js`: network-first ohne Zeitlimit für alle eigenen Dateien, Firestore läuft am Worker vorbei. Bei der Installation kommt die Hülle in den Cache (`/`, `bundle.js`, CSS, Schriften), alles Weitere erst beim ersten Abruf.
  - `src/services/LiveStatusService.ts:112-123, 171-192`: Der Sync-Zustand hängt an der Serverbestätigung, an `navigator.onLine` und an `fromCache`. Ein unbestätigtes Schreiben schaltet nach 6 s auf „offline“.
- Gegenprobe: In Chromium scheitern auch Abrufe des Service Workers, sobald `setOffline(true)` gesetzt ist (Probe: `fetch('/faq/')` aus dem Worker → „Failed to fetch“, Navigation → `ERR_FAILED`). Die Offline-Simulation erfasst den Worker also mit.
- Nicht testbar: zwei echte Geräte gegen echtes Firestore (Konflikte, Uhrabweichung). Im Mock teilen sich alle Seiten eines Kontexts denselben `localStorage`.

## Urteil aus Sicht der Rolle

Gegenüber dem 4. Oktober ist die App deutlich ehrlicher geworden:
- Bei Netzverlust schlägt das Sync-Badge sofort auf gelb „Sync: offline – wird nachgereicht“ um, und der Tooltip erklärt die Folge.
- Der Teilnehmer kann offline weiter abhaken. Meldevordruck und ZIP funktionieren offline, weil der Druckteil vorgeladen wird.
- Ein Reload ohne Netz zeigt die App statt der Browser-Fehlerseite.
- Der Generator lehnt das Erzeugen ohne Netz sofort und verständlich ab.
- Die Übungsleitung kann ohne Verbindung nicht mehr „für alle“ zurücksetzen.

Es bleiben drei Stellen, an denen ein Helfer ohne fremde Hilfe nicht weiterkommt:
1. **Neu öffnen ohne Datenbank:** Die Hülle lädt, die Übung nicht. Der Teilnehmer landet auf dem Code-Formular, das ihm nahelegt, seine Codes seien falsch. Seine lokal gespeicherten Markierungen sieht er nicht.
2. **Druckteil im Generator:** Ein einziger Klick ohne Netz macht ZIP und Übersichts-PDF bis zum Neuladen unbrauchbar. Die Meldung „tipp dann erneut“ führt in eine Schleife.
3. **Wackliges Netz:** Ist das Netz nur schlecht, aber nicht ganz weg, hilft der Service Worker nicht. Die Seite bleibt weiß, bis der Abruf aufgibt.

Für einen Dienstabend mit WLAN ist die App jetzt robust. Für Gelände mit schwachem Mobilfunk gilt: Wer die Seite offen lässt, arbeitet weiter. Wer sie schließt oder vom System verwerfen lässt, steht ohne Netz vor einer irreführenden Fehlerseite.

---

## Befunde

### P1-1 – Druckteil im Generator nach einem Klick ohne Netz bis zum Neuladen kaputt; die Meldung verspricht das Gegenteil

- **Fundstelle / Aufgabe:** Generator, Ergebnis einer gespeicherten Übung (`#/generator/<id>`): „Alle Druckdaten als ZIP herunterladen“ (`#zipAllPdfsBtn`), ebenso „Alle Übersichten als eine PDF“ (`#uebersichtAllPdfBtn`), weil dieselbe Ursache gilt.
- **Beobachtung (beobachtet):**
  1. Seite online geöffnet, Netz weg, ZIP geklickt. Es erscheinen zwei Meldungen: „Die Druckfunktion konnte nicht geladen werden. Prüf die Verbindung und tipp dann erneut …“ und „Die Druckdaten konnten nicht erstellt werden …“ (`03-generator-zip-offline.png`).
  2. Netz wieder da, wie verlangt erneut getippt. Es kommen dieselben zwei Meldungen, kein Download, auch nach 25 s nicht (`43-gen-retry-online.png`). In der Konsole steht wieder `Failed to fetch dynamically imported module …/pdfGenerator-b1jgK7B2.js`. Ein neuer Netzabruf findet nicht statt.
  3. Kontrolle: Dieselbe Übung in einer frischen Seite online → ZIP lädt sofort (`Offline-Test_052114oct26.zip`).
  - *Ursache (Code und Browserverhalten):* `src/services/pdfGeneratorLazy.ts:22-30` verwirft zwar das fehlgeschlagene Promise, aber der Browser merkt sich ein gescheitertes `import()` derselben Modul-URL für die ganze Lebensdauer der Seite. Ein zweites `import()` scheitert sofort, ohne Netz zu fragen. Der Unit-Test (`tests/services/pdfGeneratorLazy.test.ts`) ersetzt den Importer und kann das nicht abbilden.
  - Im Generator wird der Druckteil **nicht** vorgeladen. `vorladenPdfGenerator` läuft nur für Teilnehmer und Übungsleitung (`src/app.ts:130-133`). Im Cache des Service Workers lag `pdfGenerator-*.js` nach einer Generator-Sitzung nicht (Cache-Listing im Lauf A).
  - *Annahme:* Bei Teilnehmer und Übungsleitung greift derselbe Mechanismus, wenn das stille Vorladen 1,5 s nach dem Öffnen gerade in ein Funkloch fällt. Dann bleiben Vordruck und ZIP dort ebenfalls bis zum Reload tot.
- **Erwartung der Rolle:** „Tipp dann erneut“ muss funktionieren, sobald das Netz zurück ist. Der Papierweg ist die Rückfallebene.
- **Auswirkung im Einsatz:** Die Übungsleitung will kurz vor Beginn im Gerätehaus mit schwachem WLAN die Ausdrucke ziehen. Ein Aussetzer, dann tippt sie immer wieder „erneut“ und bekommt jedes Mal dieselbe Meldung. Dass nur ein Neuladen hilft, steht nirgends.
- **Empfehlung:** Der Druckteil muss nach Netzrückkehr ohne Neuladen wieder ladbar sein. Den Druckteil auch im Generator vorladen, sobald ein Ergebnis angezeigt wird. Passt nichts davon, muss die Meldung die tatsächliche Abhilfe nennen („Seite mit Netz neu laden“). Eine Ursache sollte nur eine Meldung erzeugen.
- **Verifikation:** E2E: Generator-Ergebnis öffnen → `setOffline(true)` → ZIP → `setOffline(false)` → ZIP erneut → Download innerhalb von 10 s. Dasselbe für Teilnehmer mit einem Funkloch genau im Vorlade-Zeitfenster.

### P1-2 – Neu öffnen ohne Datenbank: Hülle ja, Übung nein; Fehlerseite schiebt die Schuld auf die Codes

- **Fundstelle / Aufgabe:** Teilnehmer-Link `#/teilnehmer/<id>/<tc>` nach Reload, nach einem vom Mobilbrowser verworfenen Tab oder bei erneutem Öffnen aus dem Messenger, jeweils ohne Netz. Übungsleitung analog.
- **Beobachtung:**
  - *Beobachtet (Mock):* Reload offline zeigt die App (Service Worker) samt Nachrichtenliste, 3 von 3 Markierungen erhalten (`24-tn-reload-offline.png`). Das liegt aber nur daran, dass der Mock die Übung aus `localStorage` liest.
  - *Beobachtet (Echtpfad, angenähert):* Ist die Datenbank nicht erreichbar, kommt die Hülle. Statt der Liste zeigt die Seite „Teilnehmer-Zugang“ mit dem Einleitungstext „Prüfe die Codes und öffne den Zugang neu … frag die Übungsleitung nach deinen Codes“. Darunter steht rot „Die Übung konnte nicht geladen werden. Prüfe die Internetverbindung und lade die Seite neu – oder gib die Codes erneut ein.“ Dazu kommen leere Code-Felder (`30-echtpfad-tn-3s.png`, nach 12 und 25 s unverändert).
  - *Code:* `src/teilnehmer/index.ts:103-109`, Fehler aus `getUebung` → `zeigeFehlerseite`. Die Übung selbst (Nachrichtenliste) wird nirgends lokal vorgehalten, nur die Markierungen (`sprechfunk:teilnehmer:<id>:<name>`). Übungsleitung: `src/uebungsleitung/teilnehmerStand.ts:52-57`, mit einer brauchbaren Meldung samt Hinweis auf den ausgedruckten Plan.
- **Erwartung der Rolle:** Was ich vorhin offen hatte, sehe ich wieder, gekennzeichnet als „Stand von hh:mm, ohne Verbindung“. Wenn nicht, erklärt die Seite, dass es am Netz liegt und nicht an meinen Codes.
- **Auswirkung im Einsatz:** Android verwirft Hintergrund-Tabs regelmäßig. Der Teilnehmer wechselt vom Funkgerät zurück aufs Handy und hat im Funkloch keine Liste mehr. Die Seite lenkt ihn zuerst auf die Codes, und er fragt per Funk bei der Leitung nach Codes, die gar nicht falsch sind. Seine lokal gespeicherten Markierungen sind da, aber unsichtbar. Der Verweis „lade die Seite neu“ hilft ohne Netz nicht.
- **Empfehlung:** Die zuletzt geöffnete Übung auf dem Gerät vorhalten, so wie heute schon die Markierungen, und offline mit Stand-Hinweis anzeigen. Solange das fehlt: Bei Verbindungsfehlern einen eigenen Zustand ohne Code-Formular und ohne „frag nach deinen Codes“ zeigen, mit dem Satz „Deine Markierungen sind auf diesem Gerät gespeichert. Nimm die ausgedruckten Vordrucke, bis wieder Netz da ist.“
- **Verifikation:** Gegen den Firestore-Emulator: Teilnehmerseite öffnen, Emulator stoppen bzw. `setOffline(true)`, Reload → Liste mit Stand-Hinweis oder verständliche Netzmeldung ohne Code-Formular. Die Markierungen bleiben erhalten.

### P1-3 – Wackliges Netz („Lie-Fi“): Service Worker wartet ohne Zeitlimit, die Seite bleibt weiß

- **Fundstelle / Aufgabe:** Jeder Reload oder jedes Öffnen bei Netz, das verbunden ist, aber nichts durchlässt (Funkzelle überlastet, ein Balken, Captive Portal).
- **Beobachtung (beobachtet):** Teilnehmerseite war mit aktivem Service Worker geladen. Dann wurde jeder Abruf um 25 s verzögert, `navigator.onLine` blieb `true`. Reload → nach 8 s ist der Body leer (Screenshot war nicht einmal möglich, weil die Seite noch nicht stand). Die Navigation endete erst nach 40 s. Bei hartem Offline kommt die Hülle dagegen sofort aus dem Cache (`04-generator-reload-offline.png`, `10-leitung-reload-offline.png`).
  - *Ursache (Code):* `netzZuerst()` in `scripts/lib/service-worker.mjs` greift erst auf den Cache zurück, wenn `fetch` **scheitert**, nicht wenn es lange dauert.
- **Erwartung der Rolle:** Schlechtes Netz ist im Gelände der Normalfall, nicht „gar kein Netz“. Die App sollte dann schneller sein als ohne Offline-Vorrat, nicht gleich langsam.
- **Auswirkung im Einsatz:** Weiße Seite, kein Ladehinweis (der kommt erst mit dem Bundle). Der Helfer tippt Reload und startet damit das Warten von vorn.
- **Empfehlung:** Für die App-Hülle und die eigenen Skripte nach wenigen Sekunden auf den Cache ausweichen, z. B. mit einem Zeitlimit für den Netzversuch oder mit „Cache sofort, im Hintergrund aktualisieren“ für versionierte Dateien.
- **Verifikation:** Playwright mit `context.route()` und 20 s Verzögerung: Reload → Liste bzw. Ladehinweis innerhalb von 4 s.

### P1-4 – Teilnehmer „Abhak-Stand zurücksetzen“ ohne Netz: keine Sperre, Folge unbestimmt (Annahme für den Echtpfad)

- **Fundstelle / Aufgabe:** Teilnehmer, `#teilnehmerGefahrBereich` → `#btn-reset-teilnehmer-data`.
- **Beobachtung:**
  - *Beobachtet (Mock):* Bei gelbem Badge „Sync: offline“ erscheint die Rückfrage „Wirklich alle 3 … wieder auf ‚offen‘ setzen? Das gilt auch für die Übungsleitung und deine anderen Geräte …“. Nach dem Bestätigen wird sofort lokal zurückgesetzt und neu geladen. Es kommt kein Hinweis, dass die Übungsleitung davon noch nichts weiß (`25-tn-reset-offline.png`).
  - *Annahme (Code):* `performReset` (`src/teilnehmer/index.ts:289-300`) wartet mit `await this.liveStatus.flush()` **ohne** Zeitlimit. Im echten Pfad hängt das ohne Netz, und es passiert sichtbar nichts. Kommt das Netz zurück, wird Minuten später zurückgesetzt und neu geladen. Markierungen, die der Teilnehmer in der Zwischenzeit gesetzt hat, gehen dabei verloren (`clearTeilnehmerStorage`). Fällt dieser Reload in ein neues Funkloch, landet er auf der Fehlerseite aus P1-2. Die Übungsleitung hat für denselben Fall bereits eine Sperre mit Meldung (beobachtet: „Zurücksetzen für alle braucht eine Verbindung … es wurde nichts gelöscht.“, `09-leitung-reset-offline.png`).
- **Erwartung der Rolle:** Eine bestätigte, folgenreiche Aktion passiert sofort oder wird mit Grund abgelehnt, nicht irgendwann später.
- **Auswirkung im Einsatz:** Das Risiko ist ein stiller Verlust frisch gesetzter Markierungen und ein unerwarteter Seitenneustart mitten im Funkverkehr.
- **Empfehlung:** Dieselbe Regel wie bei der Übungsleitung anwenden: Ohne Verbindung „für alle“ ablehnen, mit klarer Meldung. Mit Verbindung ein Zeitlimit für die Bestätigung setzen und kein verzögertes Neuladen.
- **Verifikation:** Gegen den Emulator mit blockiertem Netz zurücksetzen → sofortige Meldung, nichts gelöscht. Nach Wiederverbindung: kein späterer Reset, keine verlorenen Markierungen.

### P2-1 – Generator meldet nach 15 s „nicht gespeichert – nichts verändert“, der Schreibvorgang kann aber später noch ankommen (Annahme)

- **Fundstelle / Aufgabe:** Generator, „Übung generieren“ bzw. „Bestehende Übung überschreiben …“ bei schwachem Netz (`navigator.onLine === true`).
- **Beobachtung:**
  - *Beobachtet:* Bei hartem Offline kommt sofort die klare Meldung „Keine Internetverbindung … versuche es erneut“, und die alten Links bleiben unverändert (`02-generator-offline-generieren.png`). Das ist gut.
  - *Annahme (Code):* Bei Lie-Fi greift `mitZeitlimit` (15 s, `src/generator/controllerHilfen.ts:14, 32-38`). Danach steht „Die Übung wurde nicht gespeichert … Es wurde nichts verändert: Die angezeigten Links gehören weiter zur zuletzt gespeicherten Fassung“ (`controllerHilfen.ts:64-71`), und der lokale Stand wird zurückgesetzt (`controllerGenerieren.ts:81-83`). Das `setDoc` aus `saveUebung` wird aber nicht abgebrochen. Es bleibt in der Schreib-Warteschlange des Firestore-SDK und wird übertragen, sobald die Verbindung zurückkommt, solange der Tab offen ist. Im Modus „überschreiben“ wird die Übung dann doch überschrieben, obwohl die App „nichts verändert“ gesagt hat. Im Modus „neu“ entsteht eine verwaiste zweite Übung.
- **Erwartung der Rolle:** Wenn die App „nicht gespeichert“ sagt, ist auch nichts gespeichert, oder sie sagt „unklar, ob angekommen“.
- **Auswirkung im Einsatz:** Ausgedruckte Unterlagen und die Teilnehmer-Links passen später nicht mehr zusammen, ohne dass jemand eine Änderung bewusst ausgelöst hat.
- **Empfehlung:** Nach Ablauf des Zeitlimits ehrlich „Speichern noch nicht bestätigt – kann später noch ankommen“ melden und die spätere Bestätigung bzw. Ankunft sichtbar machen. Alternativ das Überschreiben ohne Bestätigung gar nicht erst anstoßen.
- **Verifikation:** Emulator, Netz per Route um 20 s verzögern, überschreiben → Meldung abwarten → Netz freigeben → prüfen, ob sich das Dokument geändert hat und ob die App das anzeigt.

### P2-2 – Teilnehmer sieht nicht, wie viel noch aussteht und wann zuletzt bestätigt wurde

- **Fundstelle / Aufgabe:** Teilnehmer, Badge `#teilnehmerLiveSyncBadge`.
- **Beobachtung (beobachtet):** Nach zwei Offline-Markierungen bleibt der Text „Sync: offline – wird nachgereicht“. Er nennt keine Zahl offener Änderungen und keine Uhrzeit des letzten bestätigten Stands (`21b-tn-offline-badge.png`). Die Texte der Übungsleitung sind für eine Zahl vorbereitet (`UebungsleitungNachrichtenView.ts:26`, `${offen}`). Der Service liefert sie (`getOffeneAenderungen`, `LiveStatusService.ts:103`), die Teilnehmeransicht nutzt sie nicht (`src/teilnehmer/ansichtHelfer.ts:26`). Nach Netzrückkehr springt das Badge auf „Sync: live“, ohne Bestätigungszeit (`26-tn-wieder-online.png`).
- **Erwartung der Rolle:** „3 Markierungen nur auf diesem Gerät“ bzw. „alles übertragen um 21:07“. So erkenne ich den letzten sicheren Stand.
- **Auswirkung im Einsatz:** Der Teilnehmer weiß nicht, ob er der Leitung per Funk „Nr. 1 bis 3 abgesetzt“ nachmelden sollte.
- **Empfehlung:** Die Zahl der ausstehenden Änderungen und die Uhrzeit der letzten Serverbestätigung im Badge oder direkt darunter zeigen.
- **Verifikation:** Offline 2 Markierungen → Badge nennt „2“. Online → „übertragen hh:mm“.

### P3-1 – Beitritt per Code im Funkloch meldet vermutlich „nicht gefunden“ (Annahme)

- **Fundstelle / Aufgabe:** `#/teilnehmer`, `#teilnehmerJoinForm`.
- **Beobachtung:** *Code:* `resolveJoinAndNavigate` (`src/teilnehmer/index.ts:238-253`) hat jetzt einen Fehlerzweig mit Netzhinweis. `getDocs` im Speicher-Cache-Modus liefert offline aber vermutlich ein **leeres** Ergebnis statt eines Fehlers. Dann erscheint „Kombination aus Übungscode und Teilnehmercode wurde nicht gefunden. Prüfe beide Codes …“. Es gibt keine Prüfung von `navigator.onLine`. Im Mock nicht reproduzierbar.
- **Erwartung / Auswirkung:** Wie im ersten Lauf: Der Helfer tippt seine Codes mehrfach neu und fragt per Funk nach.
- **Empfehlung:** Ohne Verbindung bzw. bei einem Ergebnis nur aus dem Cache „Codes können gerade nicht geprüft werden (keine Verbindung)“ anzeigen.
- **Verifikation:** Emulator gestoppt oder offline, gültige Codes → Meldung nennt die Verbindung.

### P3-2 – Fehlermeldungen stapeln sich

- **Fundstelle / Aufgabe:** Globale Meldungen (`#globalToastContainer`).
- **Beobachtung (beobachtet):** Ein ZIP-Klick ohne Netz erzeugt zwei Meldungen für dieselbe Ursache. Mit der noch stehenden Generator-Meldung sind es drei Kästen übereinander, die Seiteninhalt verdecken (`03-generator-zip-offline.png`). Nach dem zweiten Versuch sind es vier.
- **Empfehlung:** Je Ursache eine Meldung. Eine gleichlautende Meldung ersetzen statt erneut anhängen.
- **Verifikation:** Zweimal ZIP offline → genau eine Meldung sichtbar.

### P3-3 – Übungsleitung: Offline-Zustand nur im Kopf des Nachrichtenplans

- **Fundstelle / Aufgabe:** `#/uebungsleitung/<id>`, Badge `#uebungsleitungLiveSyncBadge`.
- **Beobachtung (beobachtet):** Bei 1440×1000 steht das gelbe Badge am unteren Rand des ersten Bildschirms im Kopf „Nachrichtenplan“. Die Lagezeile oben und die Teilnehmertabelle („keine Meldung“) zeigen keinen Hinweis, dass die Leitung selbst gerade ohne Verbindung ist (`08-leitung-offline.png`). Der Tooltip erklärt es gut („Angezeigt wird der zuletzt bekannte Stand der Teilnehmer“), aber nur bei Hover.
- **Empfehlung:** Den Offline-Zustand zusätzlich an der Lagezeile bzw. über der Teilnehmertabelle zeigen und den Tooltip-Satz sichtbar machen.
- **Verifikation:** Offline → Hinweis im ersten Bildschirmdrittel sichtbar, ohne Hover.

### P3-4 – Nebenbefund: Ein Klick auf „Debrief PDF“ erzeugt zwei Downloads

- **Fundstelle / Aufgabe:** Übungsleitung, Teilnehmertabelle, Button `data-action="download-debrief"`.
- **Beobachtung (beobachtet):** Online und offline löst ein Klick zweimal `Debrief_Heros Oldenburg 21-11_Offline-Test.pdf` aus. Die Ursache wurde nicht untersucht (vermutlich doppelt gebundener Handler).
- **Auswirkung:** Doppelte Dateien auf dem Handy oder Tablet und Verunsicherung, welche die richtige ist. Keine Datenverluste.
- **Empfehlung / Verifikation:** Ein Klick soll genau einen Download erzeugen. Im E2E die Download-Ereignisse zählen.

---

## Positiv festgehalten (beobachtet)

- Das Sync-Badge schlägt bei Netzverlust sofort auf gelb „offline – wird nachgereicht“ um, bei Teilnehmer und Übungsleitung, mit erklärendem Tooltip. Nach Rückkehr springt es auf „live“.
- Offline gesetzte Markierungen überstehen Reload und Wiederverbindung (3/3).
- Der Teilnehmer kann offline Meldevordruck anzeigen (Seite 1/6 gerendert, `22-tn-offline-meldevordruck.png`) und das ZIP laden. Die Übungsleitung kann offline „Übungsleitung als PDF“ und Debrief laden. Grund ist das Vorladen nach 1,5 s.
- Der Service Worker liefert die App-Hülle bei hartem Offline für Generator, Teilnehmer und Übungsleitung.
- Der Generator lehnt das Generieren offline sofort ab und lässt die alten Links stehen. Die Fehlerbox bleibt sichtbar.
- Die Übungsleitung kann offline nicht mehr für alle zurücksetzen und erklärt warum.
- Fehlermeldungen bleiben stehen (nach 10 s noch sichtbar, mit ×).
- Der Abschnitt „Unterlagen für den Notfall“ beim Teilnehmer und „Druck die Unterlagen vor der Übung aus“ im Generator benennen die Papier-Rückfallebene.
- Ein Kaltstart gedrosselt (400 ms, 50 kB/s) zeigt nach 3 s „Übung wird geladen …“ statt des Generator-Formulars. Die Liste stand nach 14,0 s. Ein Warmstart mit Service Worker brauchte 3,7 s. Einschränkung: Die CDP-Drosselung wirkt auf die Seite, nicht sicher auf Abrufe des Workers.

## Abschluss

- **Aufgabe geschafft:** mit Umwegen. Abhaken, Vordruck und ZIP gehen offline, solange die Seite offen bleibt. Neu öffnen ohne Datenbank und der Generator-Druck nach einem Aussetzer gehen nicht.
- **Fremde Hilfe nötig:** ja. Dass nach einem Aussetzer im Generator nur „neu laden mit Netz“ hilft, findet niemand allein heraus, denn die Meldung sagt „tipp erneut“.
- **Größtes Missverständnis:** Die Fehlerseite nach einem Reload ohne Netz lässt den Teilnehmer an seinen Codes zweifeln statt am Netz.
- **Größtes Einsatzrisiko:** Ein vom Handy verworfener Tab im Funkloch nimmt dem Teilnehmer seine Spruchliste, obwohl seine Markierungen lokal noch da sind.
- **Top-Priorität für die nächste Iteration:** Die zuletzt geöffnete Übung auf dem Gerät vorhalten und offline mit Stand-Hinweis anzeigen (P1-2). Direkt danach den Druckteil nach Netzrückkehr wieder ladbar machen und im Generator vorladen (P1-1).

---

## Abgleich mit dem Lauf vom 2026-10-04

| Alt-ID | Titel (kurz) | Alte Prio | Status jetzt | Beleg aus dieser Prüfung |
|---|---|---|---|---|
| P0-1 | Sync-Anzeige meldet „live“, obwohl nichts ankommt | P0 | **behoben** | Offline schlägt das Badge sofort auf „Sync: offline – wird nachgereicht“ bzw. „Live-Status: offline …“ um (`21b-tn-offline-badge.png`, `08-leitung-offline.png`). Im Code hängt der Zustand an Serverbestätigung, `navigator.onLine`, `fromCache` und 6-s-Timeout (`LiveStatusService.ts:112-123`). Rest: keine Zahl und keine Uhrzeit beim Teilnehmer → neu P2-2. |
| P0-2 | Vordruck und ZIP nach Netzverlust dauerhaft kaputt | P0 | **teilweise** | Teilnehmer und Übungsleitung: Druckteil vorgeladen, Vordruck, ZIP und PDFs offline funktionsfähig (beobachtet). Generator: Nach einem Offline-Klick bleibt ZIP auch online ohne Reload kaputt, die Meldung „tipp erneut“ hilft nicht (beobachtet, `43-gen-retry-online.png`) → neu P1-1. |
| P1-1 | Ohne Netz keine Seite öffnen oder neu laden | P1 | **teilweise** | Die Hülle kommt jetzt bei hartem Offline aus dem Service Worker (`04-…`, `10-…`, `24-…`). Die Übung selbst wird nicht vorgehalten: Mit unerreichbarer Datenbank landet der Teilnehmer auf dem Code-Formular (`30-echtpfad-tn-3s.png`) → neu P1-2. Bei Lie-Fi bleibt die Seite weiß → neu P1-3. |
| P1-2 | Übung generieren ohne Netz: stilles Nichts | P1 | **behoben** | Sofortige Fehlerbox „Keine Internetverbindung …“, alte Links unverändert (`02-generator-offline-generieren.png`). Zeitlimit und Sperre beim Speichern im Code (`controllerGenerieren.ts:51-80`). Rest im Lie-Fi-Fall → neu P2-1. |
| P1-3 | „Status zurücksetzen“ hängt ohne Netz | P1 | **teilweise** | Übungsleitung: offline abgelehnt mit klarer Meldung (beobachtet, `09-leitung-reset-offline.png`). Teilnehmer: weiter ohne Sperre, `flush()` ohne Zeitlimit (`teilnehmer/index.ts:296`) → neu P1-4. |
| P2-1 | Leitung unterscheidet „online“ nicht von „lange nichts gehört“ | P2 | **nicht prüfbar** | Im Code gibt es jetzt „seit N min nichts vom Gerät – Funkloch oder Pause?“ ab 10 min (`uebungsleitung/teilnehmerMarkup.ts:165-180`). Live nicht bestätigt: Ein eingespielter alter Teilnehmerstand wurde im Mock nicht übernommen (Zeile zeigte weiter „keine Meldung“). Echtes Altern über 10 min wurde nicht abgewartet. |
| P2-2 | Langsames Netz: 12 s lang falsche Seite | P2 | **behoben** | Kaltstart gedrosselt: nach 3 s „Übung wird geladen …“, kein Generator-Formular (`42-tn-kalt-langsam-3s.png`). Die Liste kommt kalt weiterhin erst nach 14 s, warm mit Worker nach 3,7 s. |
| P2-3 | Meldungen verschwinden nach 2,5 s | P2 | **behoben** | Fehlermeldungen nach 10 s noch sichtbar, mit ×. Ursache bzw. Handlungsanweisung im Text (`03-generator-zip-offline.png`). Neu: Sie stapeln sich → P3-2. |
| P2-4 | Kein Hinweis zur Offline-Vorbereitung | P2 | **behoben** | Teilnehmer: Abschnitt „Unterlagen für den Notfall … fällt am Übungsort das Netz weg, hast du sie trotzdem“ (`24-tn-reload-offline.png`). Generator: „Druck die Unterlagen vor der Übung aus …“ (`03-…`). |
| P3-1 | Beitritt per Code offline meldet „nicht gefunden“ | P3 | **teilweise** | Fehlerzweig mit Netzhinweis bei einer Exception ist da (`teilnehmer/index.ts:244-249`). Der vermutliche Fall „leeres Cache-Ergebnis“ endet weiter in „nicht gefunden“, ohne `onLine`-Prüfung (Annahme) → neu P3-1. |
