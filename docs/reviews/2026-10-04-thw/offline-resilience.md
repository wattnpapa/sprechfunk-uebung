# Offline-Resilienz-Audit – Sprechfunk Übungsgenerator

**Reviewer:** offline-resilience (THW Offline Resilience Reviewer)
**Datum:** 2026-10-04
**Stand:** lokaler Build, `http://127.0.0.1:3000`, Mock-Modus (`useFirestoreEmulator=1`, Daten in `localStorage`)
**Werkzeug:** Playwright/Chromium 1194, `context.setOffline()`, CDP-Netzdrosselung (400 kbit/s, 400 ms Latenz, Cache aus)
**Screenshots:** `/tmp/claude-0/-home-user-sprechfunk-uebung/8e81b214-a84b-574f-81cf-240dddbe65b9/scratchpad/offline-resilience/`

## Methodik und Grenzen

- **Beobachtet** = im laufenden Mock-Build mit Playwright erlebt.
- **Annahme (Code)** = Verhalten des echten Firestore-Pfads, aus dem Quelltext abgeleitet, nicht live geprüft. Der Mock-Modus schreibt synchron in `localStorage` und kann deshalb nie „offline" sein; alles, was dort beim Sync klappt, sagt über Firestore nichts aus.
- Grundlage für die Annahmen:
  - `src/services/firebaseClient.ts:37`: `getFirestore(app)` ohne `persistentLocalCache`, also der Standard-**Speicher-Cache**: kein IndexedDB, kein Offline-Vorrat der Übung über einen Reload hinweg.
  - `src/services/LiveStatusService.ts:221-240` (`flush`): `await backend.write()`. Ein `setDoc` ohne Netz wird nach dem Firestore-Web-SDK erst erfüllt, wenn der Server es bestätigt. Es lehnt **nicht** ab. `handleError` → Zustand `fehler` („Sync: offline") wird deshalb nur bei echten Fehlern erreicht (z. B. `PERMISSION_DENIED`), nicht bei Funkloch. `onSnapshot` meldet bei Netzverlust ebenfalls keinen Fehler.
  - `FirebaseService.getUebung` (`src/services/FirebaseService.ts:473-486`): `getDoc` ohne Netz und ohne Cache-Treffer lehnt mit „client is offline" ab.
- Einen Service Worker oder ein Web-App-Manifest gibt es nicht (`src/index.html`, `src/app.ts`): Ohne Netz lässt sich keine Seite neu laden oder öffnen.
- Testumgebung: Das vorhandene Chromium 1194 kennt `Map.getOrInsertComputed` nicht, das PDF.js braucht. Die **Vordruck-Darstellung** blieb deshalb auch online leer (`pageerror`), und Befunde zum Vordruck-Inhalt waren nicht prüfbar. Der unten belegte Ladefehler nach Netzverlust ist davon getrennt: Er zeigt eine eigene Meldung („Failed to fetch dynamically imported module") und betrifft auch den ZIP-Export, der online funktionierte.
- Zwei echte Geräte gegen echtes Firestore (Konflikte, Gerätewechsel) waren nicht testbar. Im Mock teilen sich alle Seiten eines Kontexts einen `localStorage`.

## Urteil aus Sicht der Rolle

Wer als Teilnehmer **die Seite einmal geladen hat**, kann im Funkloch weiter Sprüche als abgesetzt markieren. Der Stand liegt in `localStorage` und übersteht auch einen Neustart des Browsers (beobachtet: drei Markierungen, zwei davon offline gesetzt, waren nach „No internet" → wieder online → Reload alle da). Die Grundentscheidung „lokal führt, Server folgt" ist richtig.

Danach endet die Robustheit:
- Die Anzeige „Sync: live" bleibt nach dem Code auch bei Netzverlust stehen (Annahme). Der Helfer kann also nicht erkennen, ob die Übungsleitung seine Meldung hat.
- Die Papierwege (Vordruck, ZIP) laden ihren Code erst beim ersten Klick nach. Fällt das Netz genau dann aus, gehen sie **bis zum nächsten Reload gar nicht mehr**, auch wenn das Netz längst zurück ist (beobachtet).
- Ein Reload ohne Netz endet auf der Browser-Fehlerseite (beobachtet).
- Die Übungsleitung kann ohne Netz keine Übung erzeugen. Die App sagt dazu nichts: Nach Klick auf „Übung generieren" passiert sichtbar nichts (beobachtet).

Für einen Dienstabend im Gerätehaus mit WLAN reicht das. Für eine Übung im Gelände mit wackligem Mobilfunk braucht es Vorbereitung, und die App sagt nicht, welche. Ohne fremde Hilfe erkennt ein Helfer nicht, warum Vordruck und ZIP plötzlich leer bleiben.

---

## Befunde

### P0-1 – Sync-Anzeige meldet „live", obwohl nichts ankommt

- **Fundstelle / Aufgabe:** Teilnehmer `#/teilnehmer/<id>/<tc>`, Badge `#teilnehmerLiveSyncBadge`; Übungsleitung `#/uebungsleitung/<id>`, Badge `#uebungsleitungLiveSyncBadge`. Aufgabe: Spruch absetzen und markieren, während das Netz weg ist.
- **Beobachtung:**
  - *Beobachtet (Mock):* Nach `setOffline(true)` (`navigator.onLine === false`) zeigen beide Badges weiter grün „Sync: live" bzw. „Live-Status: live" (`11b-teilnehmer-offline-badge.png`, `21-leitung-offline-aktionen.png`). Tooltip: „Status wird live an die Übungsleitung übertragen." Das ist im Mock technisch erklärbar (`localStorage`), zeigt aber: Die App wertet den Netzzustand des Browsers nicht aus.
  - *Annahme (Code):* Im echten Firestore-Pfad bleibt es ebenso. `flush()` wartet auf ein `setDoc`, das offline nicht ablehnt, sondern hängt (`LiveStatusService.ts:231-238`). `setState("fehler")` kommt nur aus `handleError`. Der vorbereitete Text „Sync: offline – Status wird lokal gespeichert und später übertragen" (`TeilnehmerView.ts:295`) wird im Funkloch also voraussichtlich nie angezeigt. Er erscheint eher bei Regel- oder Rechtefehlern, wo „später übertragen" gerade **nicht** stimmt.
- **Erwartung der Rolle:** Grün heißt „ist bei der Leitung angekommen". Ohne Netz muss das sofort sichtbar umschlagen, und zwar mit der Folge: „Deine Markierungen sind nur auf diesem Gerät."
- **Auswirkung im Einsatz:** Der Teilnehmer verlässt sich darauf, dass die Leitung seinen Fortschritt sieht, und meldet nicht zusätzlich per Funk. Die Leitung sieht im Gegenzug grün und hält den Stand des Teilnehmers für aktuell. Bei einer Ausbildung führt das zu falscher Auswertung (Debrief), nicht zu Gefahr. Der Befund ist P0, weil die zentrale Statusanzeige das Gegenteil der Wirklichkeit sagt.
- **Empfehlung:** Den Zustand an „letzte Schreiboperation vom Server bestätigt" knüpfen, nicht an „Schreiben angestoßen". Zusätzlich den Offline-Zustand des Browsers berücksichtigen. Drei klar getrennte Zustände: *übertragen (Uhrzeit)*, *wartet auf Netz – N Änderungen nur auf diesem Gerät*, *Fehler – wird nicht übertragen*. Den Fehlertext „später übertragen" nur dort zeigen, wo das auch stimmt.
- **Verifikation:** Gegen den Firestore-Emulator (`?emulator=1`) bzw. mit `setOffline(true)` eine Markierung setzen. Das Badge muss innerhalb weniger Sekunden umschlagen und die Zahl offener Änderungen zeigen. Nach `setOffline(false)` muss es auf „übertragen hh:mm" zurückgehen. Zusätzlich ein E2E-Test mit gedrosselter bzw. blockierter Firestore-Route.

### P0-2 – Vordruck und ZIP bleiben nach kurzem Netzverlust dauerhaft kaputt

- **Fundstelle / Aufgabe:** Teilnehmer: Meldevordruck/Nachrichtenvordruck (`[data-doc-view='meldevordruck']`), Button „ZIP herunterladen". Generator: „Alle Druckdaten als ZIP herunterladen" (`#zipAllPdfsBtn`), „Alle Übersichten als eine PDF" (`#uebersichtAllPdfBtn`). Übungsleitung: Debrief-PDF.
- **Beobachtung (beobachtet):**
  1. Teilnehmerseite online geladen, Netz weg, Meldevordruck geöffnet → leere weiße Fläche, kein Hinweis (`12-teilnehmer-offline-meldevordruck.png`). Konsole: `Failed to fetch dynamically imported module: …/pdfGenerator-BrSPeaxn.js`.
  2. Netz wieder da, **ohne Reload** erneut Vordruck → wieder leer, wieder derselbe Fehler (`16d-vordruck-nach-offline-wieder-online.png`). ZIP → Toast „ZIP konnte nicht erstellt werden.", kein Download.
  3. Generator: ZIP offline → **weder Download noch Meldung**. Wieder online, ohne Reload → wieder kein Download, keine Meldung. Kontrolle in frischer Seite online: ZIP lädt sofort (`Kontrolle_….zip`).
  - *Ursache (Code):* `src/services/pdfGeneratorLazy.ts:11-13` hält das erste `import()`-Promise fest (`modulePromise ??=`). Schlägt es einmal fehl, bleibt es fehlgeschlagen. Generator-Handler `onZipAllPdfs`/`onDownloadUebersichtPdf` (`src/generator/index.ts:200-207`) und `renderDocPage`/`getDocBlob` (`src/teilnehmer/index.ts:630-650`) haben keinen Fehlerzweig.
- **Erwartung der Rolle:** Der Papierweg ist die Rückfallebene, wenn das Digitale wackelt. Gerade er muss ohne Netz funktionieren. Wenn nicht, dann mit klarer Ansage und von selbst wieder, sobald das Netz zurück ist.
- **Auswirkung im Einsatz:** Ein kurzer Aussetzer beim ersten Vordruck-Klick nimmt dem Teilnehmer für den Rest der Übung Vordruck und Druck-ZIP. Ohne Hinweis kommt er nicht darauf, dass ein Neuladen hilft. Lädt er aber neu, solange das Netz weg ist, landet er auf der Fehlerseite (siehe P1-1). Die Übungsleitung klickt am Generator auf ZIP und es passiert gar nichts.
- **Empfehlung:** Den Druck-/Vordruckteil beim Öffnen der Übung im Hintergrund vorladen, solange Netz da ist, damit er im Funkloch schon vorhanden ist. Einen fehlgeschlagenen Ladeversuch beim nächsten Klick erneut versuchen. Jeder Druck-/ZIP-Klick braucht eine sichtbare Rückmeldung: „Druckfunktion konnte ohne Netz nicht geladen werden – bei Netz erneut tippen".
- **Verifikation:** E2E: Seite laden → `setOffline(true)` → Vordruck öffnen → `setOffline(false)` → Vordruck erneut → Seite muss gerendert sein, ZIP muss herunterladen. Variante: Seite laden, 5 s warten, `setOffline(true)` → Vordruck und ZIP müssen direkt funktionieren.

### P1-1 – Ohne Netz lässt sich keine Seite öffnen oder neu laden

- **Fundstelle / Aufgabe:** Alle Rollen; Reload, Tab wiederherstellen, Link aus Messenger/QR-Code öffnen, Browser von Android aus dem Speicher geworfen.
- **Beobachtung (beobachtet):** `page.reload()` offline → Chromium-Fehlerseite „No internet / ERR_INTERNET_DISCONNECTED" für Teilnehmer, Generator und Übungsleitung (`13-teilnehmer-reload-offline.png`, `04-generator-reload-offline.png`, `23-leitung-reload-offline.png`). Es gibt keinen Service Worker, kein App-Shell-Caching.
  - *Annahme (Code):* Auch wenn die Seite aus dem HTTP-Cache käme, scheitert im echten Pfad `getDoc` ohne Netz. Firestore läuft mit Speicher-Cache, also hat die Übung nach einem Reload keinen lokalen Vorrat. `TeilnehmerController.init` (`src/teilnehmer/index.ts:81`) und `UebungsleitungController` (`src/uebungsleitung/index.ts:93`) fangen diesen Fehler nicht ab. Die Seite bleibt ohne Inhalt und ohne Erklärung. Die lokal gespeicherten Markierungen (`localStorage`) wären da, aber die Nachrichtenliste nicht.
- **Erwartung der Rolle:** Was einmal offen war, bleibt offen. Ein versehentlicher Reload im Funkloch darf die Übung nicht beenden.
- **Auswirkung im Einsatz:** Auf Mobilgeräten werden Hintergrund-Tabs vom System verworfen. Beim Zurückwechseln lädt der Browser neu, und im Funkloch ist die Übung für diesen Teilnehmer bis zur nächsten Netzverbindung beendet. Die Liste seiner Sprüche hat er dann nicht mehr. Positiv: Die Markierungen gehen dabei nicht verloren (beobachtet, `14-teilnehmer-wieder-online.png`, 3 von 3 erhalten).
- **Empfehlung:** Die App-Hülle und die zuletzt geöffnete Übung (Nachrichtenliste des Teilnehmers) offline vorhalten, sodass ein Reload ohne Netz die Liste aus dem Gerät zeigt, deutlich gekennzeichnet als „Stand von hh:mm, ohne Verbindung". Gibt es keinen Vorrat, eine eigene, verständliche Meldung statt leerer Seite bzw. Browser-Fehler, mit dem Hinweis auf den Papier-Ausdruck.
- **Verifikation:** Teilnehmerseite online öffnen, `setOffline(true)`, `reload()` → Nachrichtenliste mit Stand-Hinweis sichtbar, Markieren möglich. Im echten Pfad: Firestore-Requests blockieren, Reload → kein leerer Inhaltsbereich.

### P1-2 – Übung generieren ohne Netz: stilles Nichts

- **Fundstelle / Aufgabe:** Generator `#/generator`, Button `#startUebungBtn` („Übung generieren").
- **Beobachtung (beobachtet):**
  - Erstgenerierung offline: Klick → keine Meldung, kein Ergebnis, Zähler bleiben bei „Teilnehmer: 0 / Nachrichten: 0" (`05-generator-erstgenerierung-offline.png`). Ursache: Der Abruf der Spruchvorlage `assets/funksprueche/nachrichten_thw_leer.txt` scheitert. `loadFunkspruecheFromVorlagen` fängt den Fehler und schreibt ihn nur in die Konsole (`src/generator/index.ts:672-687`). Das Toast-Element `#globalToastContainer` blieb leer.
  - Neu generieren offline: Erst kommt die Rückfrage „Übung neu generieren? Bestehende Nachrichten gehen verloren.", nach Bestätigen passiert nichts. Das alte Ergebnis mit den alten Links bleibt stehen (`02-generator-offline-neu-generiert.png`). Der Nutzer kann nicht erkennen, ob die angezeigten Links zur alten oder zu einer neuen Übung gehören.
  - *Annahme (Code):* Ist die Vorlage schon geladen bzw. wird ein Upload benutzt, kommt man im echten Pfad bis `saveUebung` → `setDoc` (`FirebaseService.ts:605`). Das Promise hängt ohne Netz. `startUebung` wartet unbegrenzt, der Button wird nicht gesperrt (`GeneratorView.ts:413`), und es gibt keinen Fortschrittshinweis. Kommt das Netz zurück, erscheint das Ergebnis Minuten später „von selbst". Erneutes Klicken in der Zwischenzeit erzeugt eine zweite, verschiedene Verteilung unter derselben ID. Die Prüfung auf vergebene Übungscodes (`isUebungCodeVergeben`, `getDocs`) liefert offline vermutlich ein leeres Cache-Ergebnis, also „frei", ohne Rückfrage am Server.
- **Erwartung der Rolle:** Entweder es klappt, oder eine klare Ansage: „Ohne Internet kann keine Übung erstellt werden – Teilnehmer-Links funktionieren nur, wenn die Übung gespeichert ist."
- **Auswirkung im Einsatz:** Die Übungsleitung im Gerätehaus mit schwachem Netz klickt mehrfach, glaubt an einen Bedienfehler oder verteilt alte Links. Bei der Annahme „hängt bis Netz kommt": Die Teilnehmer bekommen Links, deren Übung womöglich noch nicht oder in anderer Fassung gespeichert ist.
- **Empfehlung:** Jeder Fehlschlag beim Laden der Vorlagen und beim Speichern bekommt eine sichtbare Meldung mit Ursache „keine Verbindung". Während des Speicherns einen sichtbaren Zustand zeigen und den Button sperren. Nach einer Zeitgrenze ehrlich melden: „noch nicht gespeichert – Links noch nicht weitergeben". Das Ergebnis erst als gültig zeigen, wenn der Server bestätigt hat.
- **Verifikation:** E2E: Vorlage wählen, `setOffline(true)`, generieren → innerhalb von 2 s eine verständliche Meldung, keine alten Links als neues Ergebnis. Gegen den Emulator mit blockiertem Netz: Button gesperrt, kein Doppelspeichern.

### P1-3 – „Status zurücksetzen" hängt ohne Netz (Annahme)

- **Fundstelle / Aufgabe:** Teilnehmer, Zurücksetzen (`resetData` → `performReset`, `src/teilnehmer/index.ts:367-410`).
- **Beobachtung:** *Annahme (Code), nicht live geprüft:* Bei aktivem Live-Sync wartet `performReset` auf `liveStatus.flush()`, bevor lokal gelöscht und neu geladen wird. Im echten Pfad hängt dieses `await` ohne Netz. Der Nutzer hat die Rückfrage („wirkt auch für die Übungsleitung und Ihre anderen Geräte") bestätigt, aber es passiert nichts, bis Netz kommt. Danach wird plötzlich zurückgesetzt und die Seite neu geladen. Erschwerend käme ein Reload in dieser Zeit hinzu (P1-1). Im Mock nicht reproduzierbar, weil `localStorage` sofort schreibt. Der Reset-Button war im Testfenster nicht mit dem Text „zurücksetzen" auffindbar und wurde deshalb nicht ausgelöst.
- **Erwartung der Rolle:** Eine bestätigte, folgenreiche Aktion passiert sofort oder wird mit Grund abgelehnt. Sie darf nicht unbestimmt später geschehen.
- **Auswirkung im Einsatz:** Der Teilnehmer tippt erneut, setzt weiter Sprüche ab, und Minuten später werden diese neuen Markierungen durch den verspäteten Reset gelöscht. Das ist stiller Datenverlust.
- **Empfehlung:** Zurücksetzen ohne Bestätigung vom Server entweder nicht anbieten („nur mit Verbindung möglich") oder sofort lokal ausführen und die Übertragung sichtbar als „wartet" führen. Kein verzögertes Neuladen.
- **Verifikation:** Gegen den Emulator mit blockiertem Netz zurücksetzen. Erwartet wird eine sofortige Rückmeldung, und nach Wiederverbindung kein Löschen später gesetzter Markierungen.

### P2-1 – Übungsleitung kann „online" nicht von „zuletzt gesehen vor 20 Minuten" unterscheiden

- **Fundstelle / Aufgabe:** Übungsleitung, Teilnehmertabelle `#uebungsleitungTeilnehmer` (Spalte Fortschritt „3/6, zuletzt hh:mm").
- **Beobachtung:** *Beobachtet:* Die Tabelle zeigt Fortschritt und „zuletzt <Zeitstempel>" (`21-leitung-offline-aktionen.png`). Das ist gut, aber unauffällig. *Code:* `online` bedeutet nur „es gibt ein Status-Dokument" (`src/services/liveStatusMerge.ts:332`), nicht „hat sich kürzlich gemeldet". Ein Teilnehmer im Funkloch sieht für die Leitung genauso aus wie einer, der nur gerade nichts absetzt.
- **Erwartung der Rolle:** Auf einen Blick: Wer ist seit X Minuten nicht mehr synchron?
- **Auswirkung im Einsatz:** Die Leitung wertet Lücken als Untätigkeit oder Funkdisziplin-Problem, obwohl es ein Netzproblem ist. Sie fragt nicht per Funk nach.
- **Empfehlung:** Teilnehmer, deren letzter Stand älter als ein einstellbarer Zeitraum ist, sichtbar markieren („keine Verbindung seit hh:mm?"). Das Alter in Minuten zeigen statt nur der Uhrzeit.
- **Verifikation:** Teilnehmer-Status mit altem Zeitstempel einspielen. In der Leitungsansicht erscheint ein deutlicher Hinweis neben dem Namen.

### P2-2 – Langsames Netz: zwölf Sekunden lang falsche Seite

- **Fundstelle / Aufgabe:** Teilnehmer-Link öffnen bei schwachem Mobilfunk (Drosselung 400 kbit/s, 400 ms Latenz, Cache aus).
- **Beobachtung (beobachtet):** Bis die eigene Nachrichtenliste da ist, vergehen **12,8 s** nach Reload. In dieser Zeit zeigt der Bildschirm (Aufnahme nach 3 s) das Startformular des **Generators** mit „Kopfdaten / Datum der Übung / Name der Übung" (`17b-teilnehmer-langsam-3s-nach-reload.png`), also nicht „Übung wird geladen". Das Start-Bundle `dist/bundle.js` ist rund 1 MB groß.
- **Erwartung der Rolle:** Sofort ein Hinweis „Deine Übung wird geladen …" und nichts, was zum Ausfüllen einlädt.
- **Auswirkung im Einsatz:** Der Teilnehmer hält den Link für falsch, tippt in Felder oder geht zurück und öffnet erneut. Damit beginnt das Laden von vorn.
- **Empfehlung:** Für Teilnehmer- und Leitungs-Links einen neutralen Ladezustand zeigen, bis die Route bekannt ist. Den Startumfang für Teilnehmer verkleinern.
- **Verifikation:** Drosselungslauf wie oben. Kein Generator-Formular sichtbar, Ladehinweis innerhalb von 1 s, Liste schneller als heute (Messwert vorher/nachher datiert festhalten).

### P2-3 – Erfolgs- bzw. Fehlermeldungen verschwinden nach 2,5 Sekunden

- **Fundstelle / Aufgabe:** Globale Toasts (`src/core/UiFeedback.ts:55-59`), z. B. „ZIP konnte nicht erstellt werden."
- **Beobachtung:** *Beobachtet:* Die Teilnehmer-ZIP offline zeigt den Toast korrekt (`15-teilnehmer-zip-offline-toast.png`). *Code:* Er verschwindet nach 2,5 s ohne Bestätigung und ohne Ursache („keine Verbindung").
- **Erwartung der Rolle:** Eine Fehlermeldung bleibt stehen, bis ich sie gesehen habe, und sagt, was ich tun soll.
- **Auswirkung im Einsatz:** Wer gerade funkt oder auf den Vordruck schaut, verpasst die Meldung und glaubt, die ZIP sei geladen.
- **Empfehlung:** Fehler-Toasts stehen lassen, bis sie weggetippt werden, und eine Handlungsanweisung mitgeben („Verbindung prüfen, dann erneut").
- **Verifikation:** Fehler provozieren, 10 s warten, die Meldung ist noch sichtbar.

### P2-4 – Kein Hinweis, dass man sich vorab offline absichern sollte

- **Fundstelle / Aufgabe:** Teilnehmeransicht nach dem Öffnen, Generator-Ergebnis „Druckdaten" je Teilnehmer.
- **Beobachtung:** *Beobachtet:* Die App bietet Druck-ZIP je Teilnehmer und ZIP für alle. Das ist eine gute Papier-Rückfallebene, aber nirgends steht, dass sie im Gelände ohne Netz die einzige verlässliche Grundlage ist. Ebenso fehlt der Hinweis, die Seite nicht neu zu laden.
- **Erwartung der Rolle:** Vor der Übung ein klarer Satz: „Schwaches Netz am Übungsort? ZIP jetzt herunterladen bzw. ausdrucken."
- **Auswirkung im Einsatz:** Teilnehmer merken erst im Funkloch, dass sie nichts in der Hand haben.
- **Empfehlung:** In der Teilnehmeransicht und im Generator-Ergebnis einen kurzen Hinweis zur Offline-Vorbereitung. Optional den Download der eigenen Unterlagen beim ersten Öffnen anbieten.
- **Verifikation:** Durchsicht durch einen Erstnutzer: Kann er vor der Übung sagen, was er bei Netzausfall tun soll?

### P3-1 – Beitritt per Code offline (im Mock nicht aussagekräftig)

- **Fundstelle / Aufgabe:** `#/teilnehmer`, Formular `#teilnehmerJoinForm`.
- **Beobachtung:** *Beobachtet (Mock):* Der Beitritt mit Übungs-/Teilnehmercode funktionierte offline (`31-join-offline-nach-absenden.png`), weil der Mock lokal auflöst. *Annahme (Code):* Im echten Pfad läuft `resolveTeilnehmerJoinCodes` über `getDocs` (`FirebaseService.ts:517`). Offline kommt aus dem leeren Speicher-Cache vermutlich ein leeres Ergebnis zurück, und der Nutzer sieht „Kombination aus Übungscode und Teilnehmercode wurde nicht gefunden." Er hält dann seinen Code für falsch, obwohl nur das Netz fehlt.
- **Erwartung der Rolle:** „Keine Verbindung – Code kann gerade nicht geprüft werden."
- **Auswirkung im Einsatz:** Wiederholtes Abtippen, Rückfragen bei der Leitung per Funk.
- **Empfehlung:** Den Fall „nicht gefunden" vom Fall „nicht prüfbar" unterscheiden.
- **Verifikation:** Gegen den Emulator mit blockiertem Netz einen gültigen Code eingeben. Die Meldung nennt die Verbindung, nicht den Code.

---

## Positiv festgehalten

- Markierungen des Teilnehmers werden sofort lokal gespeichert und überstehen Netzverlust, Fehlerseite und Reload (beobachtet, 3/3).
- Jeder Eintrag trägt einen eigenen Zeitstempel. Das Zusammenführen ist Last-Write-Wins je Nachricht (`liveStatusMerge.ts:67-90`), und ein Zurücknehmen wird als `uebertragen: false` statt durch Löschen gespeichert. Damit sind stille Rückfälle durch ältere Stände bewusst abgefangen. Wie das bei zwei echten Geräten mit abweichenden Uhren wirkt, war nicht testbar.
- Beim nächsten Öffnen wird der gesamte lokale Stand erneut veröffentlicht (`publishStatus` in `startLiveSync`). Was offline nicht ankam, wird später nachgeholt, sofern die Seite noch einmal mit Netz geöffnet wird.
- Die Teilnehmer-ZIP meldet ihren Fehler (anders als die Generator-ZIP).

## Abschluss

- **Aufgabe geschafft:** mit Umwegen. Markieren gelingt offline; Vordruck, ZIP, Reload und Übungserstellung nicht.
- **Fremde Hilfe nötig:** ja. Dass nach einem Aussetzer nur ein Reload *mit Netz* Vordruck und ZIP zurückbringt, findet ein Helfer nicht selbst heraus.
- **Größtes Missverständnis:** Das grüne „Sync: live" bedeutet nicht, dass die Übungsleitung die Markierung erhalten hat. Es bleibt nach dem Code auch im Funkloch grün.
- **Größtes Einsatzrisiko:** Ein kurzer Netzaussetzer beim ersten Vordruck-Klick nimmt dem Teilnehmer für den Rest der Übung die Papier-Rückfallebene, ohne dass die App es erklärt.
- **Top-Priorität für die nächste Iteration:** Den Druck-/Vordruckteil vorladen, solange Netz da ist, und einen fehlgeschlagenen Ladeversuch erneut erlauben (P0-2). Direkt danach die Sync-Anzeige an tatsächliche Serverbestätigung knüpfen (P0-1).
