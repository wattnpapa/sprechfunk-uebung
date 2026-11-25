/**
 * Änderungsverlauf für Nutzerinnen und Nutzer („Was ist neu“), aufrufbar über
 * die Versionsnummer in der Fußzeile der Startseite. Aufbau wie in der
 * Erfassungsbogen-App (gleicher Autor): Wer den Generator vor Monaten genutzt
 * hat, soll nachlesen können, was seither anders ist, ohne die Commit-Liste auf
 * GitHub zu lesen.
 *
 * Gepflegt von Hand, neueste Einträge oben. Nur, was man in der App, auf den
 * Ausdrucken oder auf der Website bemerkt; Technik (Abhängigkeiten, Tests,
 * Refactorings) bleibt draußen. Ein Eintrag je Tag, Datum als ISO-Datum.
 * Regeln für die Pflege: CLAUDE.md, Abschnitt „Änderungsverlauf“.
 *
 * Die Datei wird erst beim Öffnen des Dialogs nachgeladen (dynamischer Import
 * in AenderungenDialog.ts) und zählt damit nicht zum Startpaket.
 */

export interface Aenderung {
    /** Tag der Änderung, ISO (JJJJ-MM-TT). */
    datum: string;
    punkte: readonly string[];
}

/**
 * Ein Satz je Monat über den Einträgen: Wer nach Wochen zurückkommt, liest
 * zuerst das Wichtigste und blättert nur bei Bedarf in die Tage. Schlüssel
 * JJJJ-MM; jeder Monat mit Einträgen braucht einen Satz
 * (tests/core/Aenderungen.test.ts).
 */
export const MONATE: Readonly<Record<string, string>> = {
    "2026-11":
        "Nachrichten heißen jetzt fachlich richtig Durchsage oder Gespräch statt Spruch oder Durchsage. Die Versionsnummer steht wieder in der Fußzeile, und dieser Änderungsverlauf ist neu.",
    "2026-10":
        "Zwei Prüfrunden aus Sicht von THW-Übungsleitungen und Teilnehmern: Profile für wiederkehrende Eingaben, Ausdrucke mit Zugangscode und QR-Code, Arbeiten ohne Netz, Lagebild und Zeitführung für die Übungsleitung. In der Führungsstellen-Übung lässt sich auch die Führung der beübten Stelle einspielen.",
    "2026-09":
        "Zwei neue Übungsformen: der Szenario-Modus mit zusammenhängenden Lagen und die Führungsstellen-Übung mit Drehbuch, Rollen und Zeitachse. Dazu Funkspruch-Vorlagen für Feuerwehr, Sanitäts- und Betreuungsdienst, Wasserrettung und Rettungsdienst.",
    "2026-08":
        "Die Website bekommt einen Wissensbereich mit eigener Navigation, ein öffentliches Funkspruch-Archiv und Quellenangaben. Im Generator lassen sich Nachrichten als Spruch oder Durchsage kennzeichnen.",
    "2026-07":
        "Großer Umbau: neue Gestaltung, Live-Abgleich des Übungsstands in Echtzeit, reproduzierbare Verteilung, Fokus-Modus für Teilnehmer, Übungs-Cockpit für die Leitung und die ersten Inhaltsseiten rund um den Generator.",
    "2026-06":
        "Neuer Spielmodus X-Zeit: Jede Nachricht hat einen Zeitpunkt nach Übungsbeginn, Teilnehmer sehen Ampel und Countdown.",
    "2026-02":
        "Kurze Zugangscodes ersetzen die langen Links, Teilnehmer sehen ihre Vordrucke am Bildschirm, dazu Stärkemeldungen, Lösungsbuchstaben, Debrief-PDF und eine Desktop-App.",
    "2026-01":
        "Die Übungsleitung bekommt eine eigene Ansicht am Bildschirm, mit Notizen je Nachricht. Teilnehmer können einen Stellennamen tragen.",
    "2025-10":
        "Mehr Funksprüche, eine neue Auswahl der Vorlagen und taktische Stärken in den Meldungen.",
    "2025-07":
        "Druckvorlagen in A4 und A5, eigene Deckblätter mit Rufgruppe und Vorlagen für Nadeldrucker.",
    "2025-04":
        "Übungen lassen sich speichern und über einen Link wieder laden. Jede Übung trägt eine ID und eine Prüfsumme.",
    "2025-03":
        "Neuer Meldevordruck, vier Vordrucke auf einem Blatt und eine gleichmäßigere Verteilung der Nachrichten.",
    "2025-02":
        "Die erste Fassung: Funksprüche auf Teilnehmer verteilen, als PDF ausgeben, mit Nachrichten- und Meldevordruck und Lösungswörtern als Rätsel."
};

export const AENDERUNGEN: readonly Aenderung[] = [
    {
        datum: "2026-11-25",
        punkte: [
            "Die Versionsnummer steht wieder in der Fußzeile der Startseite, daneben die ID der geladenen Übung. Beides war seit dem Umbau der Fußzeile im August nicht mehr zu sehen.",
            "Neu: dieser Änderungsverlauf. Ein Klick auf die Versionsnummer zeigt, was sich seit der ersten Fassung geändert hat, monatsweise zum Blättern."
        ]
    },
    {
        datum: "2026-11-11",
        punkte: [
            "Generator: Die Kennzeichnung der Nachrichten heißt jetzt Durchsage (wird mitgeschrieben) oder Gespräch (ohne Mitschrift), wie im BOS-Fernmeldebetrieb. Vorher standen dort Spruch und Durchsage. Ältere Übungen, Entwürfe und Profile werden beim Laden übersetzt.",
            "Vordruck: Nur bei einer Durchsage wird das Feld im Kopf angekreuzt.",
            "Texte: Für die allgemeine Nachricht steht in der App, auf den Ausdrucken und auf den Inhaltsseiten jetzt „Nachricht“ oder „Funkspruch“. „Spruch“ bleibt der formgebundenen Nachricht vorbehalten."
        ]
    },
    {
        datum: "2026-10-28",
        punkte: [
            "Fußzeile: einsatzauftrag.app steht in der Zeile der weiteren Werkzeuge."
        ]
    },
    {
        datum: "2026-10-26",
        punkte: [
            "Führungsstellen-Übung: Die Übungsleitung kann jetzt auch die Führung der beübten Stelle einspielen. Dann wird nur deren Fernmeldezentrale beübt."
        ]
    },
    {
        datum: "2026-10-05",
        punkte: [
            "Generator: Wiederkehrende Eingaben lassen sich als Profil speichern, wieder laden und als Datei mit anderen austauschen.",
            "Übungsleitung: Zeitführung, Meldungen auslassen, die Reaktion der Teilnehmer festhalten und eine Kartenansicht.",
            "Eine schon geladene Übung öffnet sich ohne Netz aus der lokalen Kopie. Fehlt die Verbindung, steht da ein Verbindungsfehler statt „nicht gefunden“.",
            "Der Live-Abgleich zeigt, wann zuletzt synchronisiert wurde und welche Bestätigungen angekommen sind.",
            "Admin: Gelöschte Übungen lassen sich für kurze Zeit zurückholen, und die Liste zeigt den Übungscode.",
            "PDF: Die Unterlagen der Übungsleitung haben für Führungsstellen-Übungen ein eigenes Layout, die Plan-Nummer stimmt mit dem Bildschirm überein.",
            "Dark Mode: Farben, Schalter und Diagramme sind überall lesbar, auch auf den Inhaltsseiten."
        ]
    },
    {
        datum: "2026-10-04",
        punkte: [
            "PDF: Die Ausdrucke tragen Zugangscode und QR-Code, dazu Felder zum Abhaken und für die tatsächliche Zeit.",
            "PDF: Für die beübte Führungsstelle gibt es ein Blatt „Ausgangslage und Auftrag“.",
            "PDF: Die Dateien sind deutlich kleiner, ein Vordruck-PDF schrumpft von 1,9 MB auf rund 20 kB.",
            "Die App lässt sich auch ohne Netz neu laden.",
            "Übungsleitung: Lagebild und eine gemeinsame X-Zeit für alle.",
            "Teilnehmer: Abhaken am Handy ist zuverlässiger, ein Doppeltipp zählt nicht mehr doppelt, und der Vordruck lässt sich per Touch bedienen.",
            "Generator: „Neu generieren“ legt eine neue Übung an, ein Entwurf bleibt erhalten, und Fehler stehen direkt am Feld.",
            "Fehlermeldungen bleiben stehen, bis du sie wegtippst.",
            "Die Vordruck-Vorschau funktioniert auch in älteren Browsern."
        ]
    },
    {
        datum: "2026-10-01",
        punkte: [
            "Führungsstellen-Übung: Die Rollen können Stellennamen tragen."
        ]
    },
    {
        datum: "2026-09-30",
        punkte: [
            "Neu: die Führungsstellen-Übung. Die Übungsleitung spielt nach Drehbuch die unterstellten Einsatzabschnitte und den übergeordneten Stab, jede Meldung hat eine Minute auf der Zeitachse. Zum Start gibt es die Drehbücher Hochwasser und Bombenfund mit Evakuierung."
        ]
    },
    {
        datum: "2026-09-27",
        punkte: [
            "Funksprüche: je eine neue Vorlage für Feuerwehr, Sanitäts- und Betreuungsdienst, Wasserrettung und Rettungsdienst. Diese Vorlagen sind für den Generator geschrieben und stammen nicht aus gefunkten Übungen."
        ]
    },
    {
        datum: "2026-09-01",
        punkte: [
            "Neu: der Szenario-Modus mit 10 zusammenhängenden Übungslagen, deren Meldungen aufeinander aufbauen.",
            "Admin: Die Übungsübersicht zeigt Spielmodus und Funkspruch-Quelle."
        ]
    },
    {
        datum: "2026-08-04",
        punkte: [
            "Website: Der Funkspruch-Bestand ist als öffentliches Archiv einsehbar.",
            "Website: neue Seite zum zeitversetzten Üben mit der X-Zeit.",
            "Website: Quellenangaben auf den Inhaltsseiten und eine Seite über den Autor."
        ]
    },
    {
        datum: "2026-08-03",
        punkte: [
            "Generator: Nachrichten lassen sich als Spruch oder Durchsage kennzeichnen.",
            "Vordruck: Alle Felder des Nachrichtenvordrucks werden erfasst und gedruckt.",
            "Website: Wissensbereich mit eigener Navigation und einer Fußzeile in vier Spalten.",
            "Funksprüche: Kaputte Umlaute sind repariert, Sammelzeilen in einzelne Funksprüche zerlegt."
        ]
    },
    {
        datum: "2026-08-01",
        punkte: [
            "Website: sechs neue Fachseiten, Inhalte nach THW-Unterlagen korrigiert.",
            "Übungsleitung: Das Notizfeld verliert beim Schreiben nicht mehr den Fokus, wenn der Stand aktualisiert wird."
        ]
    },
    {
        datum: "2026-07-30",
        punkte: [
            "Teilnehmer: Fokus-Modus mit der fälligen Meldung und Countdown.",
            "Übungsleitung: Übungs-Cockpit mit Laufzeit, X-Zeit und Stand gegenüber dem Plan.",
            "Funksprüche: neue Vorlage mit einfachen Funksprüchen für die Grundausbildung, außerdem deutlich mehr lustige Funksprüche."
        ]
    },
    {
        datum: "2026-07-27",
        punkte: [
            "Admin: Die Statistik lässt sich nach Jahr filtern, und die Suche geht über alle Übungen statt nur über die aktuelle Seite."
        ]
    },
    {
        datum: "2026-07-26",
        punkte: [
            "Der Übungsstand wird in Echtzeit zwischen Übungsleitung und Teilnehmern abgeglichen.",
            "Generator: Die Nachrichten werden gleichmäßig gemischt, und dieselbe Übung lässt sich wieder genauso erzeugen.",
            "PDF: Alle Teilnehmer-Übersichten gibt es als eine Datei.",
            "Generator: Für jedes Lösungswort ist eine Nachricht garantiert, die es trägt.",
            "Website: erste Inhaltsseiten rund um den Generator."
        ]
    },
    {
        datum: "2026-07-25",
        punkte: [
            "Neue Gestaltung der gesamten App.",
            "Funksprüche: neue Vorlage THW Ludwigslust.",
            "Generator: Bei mehreren Teilnehmern kommt kein Funkspruch mehr doppelt vor, und die Zahl der Buchstabier-Aufgaben stimmt genau mit der Einstellung überein.",
            "Die Besucherzählung läuft über GoatCounter statt über Google Analytics."
        ]
    },
    {
        datum: "2026-06-04",
        punkte: [
            "Neu: der Spielmodus X-Zeit. Jede Nachricht bekommt einen Zeitpunkt nach Übungsbeginn.",
            "Teilnehmer: Ampel und Countdown zeigen, wann die nächste Nachricht fällig ist."
        ]
    },
    {
        datum: "2026-02-22",
        punkte: [
            "Teilnehmer treten mit einem kurzen Code bei, die langen Zugangslinks entfallen.",
            "Übungsleitung: Der Teilnehmercode steht in der Zeile und lässt sich mit einem Klick kopieren.",
            "Admin: Testübungen lassen sich ausblenden.",
            "Den Generator gibt es auch als Desktop-App."
        ]
    },
    {
        datum: "2026-02-16",
        punkte: [
            "Impressum und Datenschutz sind über die Fußzeile erreichbar."
        ]
    },
    {
        datum: "2026-02-14",
        punkte: [
            "Teilnehmer sehen ihre Vordrucke als PDF direkt am Bildschirm und können alles als ZIP herunterladen.",
            "Neu: ein Debrief-PDF für die Nachbesprechung.",
            "Übungsleitung: Suchfilter für Nachrichten und eine Schätzung der Restzeit neben dem Fortschrittsbalken."
        ]
    },
    {
        datum: "2026-02-09",
        punkte: [
            "Funksprüche: neue Vorlage THW Lehrte."
        ]
    },
    {
        datum: "2026-02-08",
        punkte: [
            "Neu: ein Monitor, der den Stand der Teilnehmer zeigt."
        ]
    },
    {
        datum: "2026-02-03",
        punkte: [
            "Funksprüche: neue Vorlage THW Essen."
        ]
    },
    {
        datum: "2026-02-01",
        punkte: [
            "Neu: Stärkemeldungen und Lösungsbuchstaben als Aufgaben in der Übung.",
            "Übungsleitung: Filter nach Sender und Empfänger, dazu ein eigenes PDF."
        ]
    },
    {
        datum: "2026-01-19",
        punkte: [
            "Übungsleitung: Zu jeder Nachricht lässt sich eine Notiz festhalten."
        ]
    },
    {
        datum: "2026-01-17",
        punkte: [
            "Neu: die Ansicht für die Übungsleitung am Bildschirm, erreichbar über einen eigenen Link.",
            "Teilnehmer können zusätzlich zum Funkrufnamen einen Stellennamen tragen.",
            "Vor dem erneuten Generieren fragt die App nach."
        ]
    },
    {
        datum: "2025-10-20",
        punkte: [
            "Funksprüche: neue Vorlage THW Melle."
        ]
    },
    {
        datum: "2025-10-12",
        punkte: [
            "Neue Funksprüche und eine neue Auswahl der Vorlagen.",
            "Meldungen können eine taktische Stärke enthalten.",
            "Admin: überarbeitete Übersicht."
        ]
    },
    {
        datum: "2025-07-20",
        punkte: [
            "Druckvorlagen in A4 und A5.",
            "Jeder Teilnehmer bekommt ein eigenes Deckblatt als erste Seite, mit Rufgruppe.",
            "Vorlagen für Nadeldrucker."
        ]
    },
    {
        datum: "2025-07-19",
        punkte: [
            "Neue Funksprüche."
        ]
    },
    {
        datum: "2025-07-09",
        punkte: [
            "Admin: Übungen lassen sich löschen."
        ]
    },
    {
        datum: "2025-07-08",
        punkte: [
            "Eigene Funkspruch-Dateien lassen sich wieder hochladen, auch wenn sie unter Windows gespeichert wurden."
        ]
    },
    {
        datum: "2025-04-15",
        punkte: [
            "Neu: Admin-Bereich mit Statistik."
        ]
    },
    {
        datum: "2025-04-13",
        punkte: [
            "Der Name der Übung steht im Kopf der PDFs.",
            "Die Links zur Übung werden nach dem Generieren angezeigt.",
            "Neu: eine Anleitung und eine Erklärung, wie die Übungsdauer berechnet wird."
        ]
    },
    {
        datum: "2025-04-10",
        punkte: [
            "Übungen lassen sich speichern und wieder laden."
        ]
    },
    {
        datum: "2025-04-08",
        punkte: [
            "Jede Übung trägt eine eigene ID und eine Prüfsumme, beide stehen in der Fußzeile und auf den Vordrucken."
        ]
    },
    {
        datum: "2025-04-06",
        punkte: [
            "Lustige Funksprüche und eine gemischte Auswahl.",
            "Alle Unterlagen lassen sich auf einmal als PDF herunterladen."
        ]
    },
    {
        datum: "2025-03-31",
        punkte: [
            "Neuer Meldevordruck und vier Vordrucke auf einem Blatt.",
            "Die Versionsnummer steht auf der Seite und in den PDFs."
        ]
    },
    {
        datum: "2025-03-20",
        punkte: [
            "Nachrichten an mehrere Empfänger und die Lösungswörter werden zuverlässiger verteilt."
        ]
    },
    {
        datum: "2025-03-04",
        punkte: [
            "Die Nachrichten werden gleichmäßiger auf die Teilnehmer verteilt."
        ]
    },
    {
        datum: "2025-02-27",
        punkte: [
            "Neu: der Meldevordruck.",
            "Das Datum der Übung ist mit dem heutigen Tag vorbelegt."
        ]
    },
    {
        datum: "2025-02-23",
        punkte: [
            "Neu: der Nachrichtenvordruck.",
            "Ein Diagramm zeigt, wie die Nachrichten verteilt sind.",
            "Funksprüche: neue Auswahl."
        ]
    },
    {
        datum: "2025-02-22",
        punkte: [
            "Die Übung lässt sich als PDF ausgeben, mit eigenen Unterlagen für die Übungsleitung.",
            "Neu: Lösungswörter als Rätsel.",
            "Datum und Uhrzeit stehen als Datum-Zeit-Gruppe da."
        ]
    },
    {
        datum: "2025-02-21",
        punkte: [
            "Die erste Fassung des Generators: Funksprüche auf Teilnehmer verteilen, auf Wunsch aus einer eigenen Liste."
        ]
    }
];
