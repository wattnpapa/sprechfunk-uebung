// Zentrale Registrierung aller statisch ausgelieferten, indexierbaren Seiten.
// Quelle der Wahrheit für Build (postbuild-copy.mjs), Sitemap, strukturierte
// Daten (lib/schema-graph.mjs) und SEO-Tests.

import { ANZAHL_GESAMT_TEXT } from "./lib/funkspruch-bestand.mjs";

export const SITE_URL = "https://sprechfunk-uebung.de";

/**
 * slug          – Verzeichnis unterhalb der Domain ("" = Startseite)
 * source        – auszuliefernde Datei unterhalb von src/
 *
 * Felder für die Sitemap (AP-03):
 * sources       – alle Dateien, aus denen sich der Seiteninhalt speist; für
 *                 lastmod gilt das jüngste inhaltliche Commit-Datum daraus
 * contentUpdated– optionales Override (ISO). Hat Vorrang vor der Git-Historie,
 *                 wenn diese in die Irre führt. Sonst leer lassen.
 * inSitemap     – false nimmt die URL aus der sitemap.xml, ohne sie zu
 *                 deindexieren (Rechtstexte)
 *
 * changefreq und priority gibt es bewusst nicht mehr: Google wertet beides
 * nicht aus, und ungepflegte Werte sind schlechter als keine.
 *
 * Felder für die strukturierten Daten (AP-02):
 * schemaType    – Hauptknoten: Article | HowTo | FAQPage | CollectionPage | WebPage
 * datePublished – Erstveröffentlichung, ISO YYYY-MM-DD. Fixiert, nie automatisch
 *                 ändern; entstammt dem ersten Commit der Quelldatei.
 * about         – Themen der Seite als Klartext, wird zu schema.org/Thing
 * faq           – sichtbare Fragen; rendert den FAQ-Block UND das FAQPage-Markup
 * howTo         – nur für Seiten mit sichtbarer, nummerierter Schrittfolge
 * collection    – ItemList-Einträge für CollectionPage
 * definedTerms  – Nachschlagetabelle; Begriffe werden aus dem sichtbaren HTML
 *                 gelesen (tableIndex), nicht hier doppelt geführt
 * software      – SoftwareApplication-Knoten in den Graphen aufnehmen
 * faqFromPage   – FAQ aus dem bereits sichtbaren Seiten-Markup lesen
 *
 * Titel und Description stehen bewusst NICHT hier, sondern in der jeweiligen
 * src/pages/<slug>.html und werden beim Build von dort gelesen. Brotkrumen
 * ebenso: sie stammen aus der sichtbaren breadcrumb-Liste der Seite. So kann
 * strukturiertes Markup nicht von sichtbarem Text abweichen.
 */
export const SITE_PAGES = [
    {
        slug: "", source: "index.html", sources: ["src/index.html"],
        label: "Übung erstellen",
        schemaType: "WebPage", datePublished: "2025-02-21", software: true,
        about: ["BOS-Sprechfunk", "Funkübung", "Sprechfunkausbildung"],
        // Kein HowTo: die Startseite enthält keine sichtbare, nummerierte
        // Schrittfolge. Siehe /anleitung/ und /funkuebung-planen/.
        faq: [
            {
                q: "Was kostet der Sprechfunk Übungsgenerator?",
                a: "Nichts. Die Nutzung ist kostenlos und ohne Anmeldung möglich – es gibt keine Preisstufen, keine Premium-Funktionen und keine Testphase. Der Quellcode steht unter der EUPL-1.2 auf GitHub."
            },
            {
                q: "Muss ich etwas installieren?",
                a: "Nein. Die Anwendung läuft im Browser auf Rechner, Tablet oder Smartphone. Es sind weder eine Installation noch Programmierkenntnisse nötig."
            },
            {
                q: "Für welche Organisationen ist der Generator gedacht?",
                a: "Für die Sprechfunkausbildung im Bevölkerungs- und Katastrophenschutz: THW, Feuerwehr, Rettungsdienst und Hilfsorganisationen."
            },
            {
                q: "Wie lange dauert die Vorbereitung einer Funkübung?",
                a: "Für einen Dienstabend genügt in der Regel eine Viertelstunde: Teilnehmer eintragen, Umfang festlegen, Funkspruch-Vorlage wählen und die Unterlagen erzeugen lassen."
            },
            {
                q: "Wie viele Funksprüche bringt die Anwendung mit?",
                a: `${ANZAHL_GESAMT_TEXT} fertige Funksprüche in mehreren Vorlagen. Eigene Texte aus dem Ortsverband oder der eigenen Wache lassen sich zusätzlich hochladen.`
            }
        ]
    },
    {
        slug: "anleitung", source: "pages/anleitung.html", sources: ["src/pages/anleitung.html"],
        kurzGesagt: "Eine Sprechfunkübung entsteht in sechs Schritten: Kopfdaten, Teilnehmer, Nachrichten-Einstellungen, Quelle der Funksprüche, Lösungswörter und Erzeugen. Danach stehen Druckunterlagen als PDF und ZIP sowie die Links für Teilnehmer und Übungsleitung bereit. Während der Übung zeigt die Übungsleitungs-Ansicht den Fortschritt je Funkstelle. Programmierkenntnisse sind nicht nötig.",
        related: ["funktionen", "funkuebung-planen", "faq"],
        label: "Anleitung",
        hubCategory: "anwendung",
        schemaType: "HowTo", datePublished: "2026-07-26",
        about: ["Sprechfunkübung", "Anleitung", "Übungsleitung"],
        howTo: {
            name: "Sprechfunkübung erstellen und durchführen",
            description: "In sechs Schritten von den Kopfdaten zur fertigen BOS-Sprechfunkübung mit Druckunterlagen und Live-Übungsleitung.",
            totalTime: "PT20M",
            steps: [
                { name: "Kopfdaten ausfüllen", text: "Bezeichnung der Übung, Datum und die Angaben eintragen, die später auf den Druckunterlagen erscheinen." },
                { name: "Teilnehmer eintragen", text: "Alle Funkstellen mit ihren Funkrufnamen anlegen – je Trupp, Fahrzeug oder Zweiergruppe eine Funkstelle." },
                { name: "Nachrichten-Einstellungen festlegen", text: "Festlegen, wie viele Funksprüche jede Funkstelle absetzen soll und wie die Nachrichten verteilt werden." },
                { name: "Quelle der Funksprüche wählen", text: "Eine der mitgelieferten Vorlagen verwenden oder eine eigene Datei mit Übungstexten hochladen." },
                { name: "Lösungswörter festlegen", text: "Optional Lösungswörter ergänzen, damit die Teilnehmer das Buchstabieren nach der Buchstabiertafel üben." },
                { name: "Übung generieren", text: "Die Übung erzeugen lassen und die Druckunterlagen sowie die Links für Teilnehmer und Übungsleitung abrufen." }
            ]
        },
        faq: [
            {
                q: "Brauche ich Programmierkenntnisse, um eine Übung zu erstellen?",
                a: "Nein. Die Anwendung läuft im Browser und wird über Formulare bedient. Es ist keine Installation und keine Programmierkenntnis nötig."
            },
            {
                q: "Welche Druckunterlagen entstehen?",
                a: "Für jeden Teilnehmer ein PDF mit den eigenen Funksprüchen, dazu die Übersichten für die Übungsleitung, ein Debrief-PDF für die Nachbesprechung und leere Vordrucke. Alles ist auch gesammelt als ZIP herunterladbar."
            },
            {
                q: "Kann ich eigene Funksprüche verwenden?",
                a: "Ja. Neben den mitgelieferten Vorlagen lässt sich eine eigene Datei mit Übungstexten hochladen, etwa mit Lagen aus dem eigenen Ortsverband."
            },
            {
                q: "Wie verfolge ich den Fortschritt während der Übung?",
                a: "Die Übungsleitungs-Ansicht zeigt den Fortschritt je Teilnehmer und den Nachrichtenplan live – inklusive Laufzeit, X-Zeit und Funklast."
            }
        ]
    },
    {
        slug: "funktionen", source: "pages/funktionen.html", sources: ["src/pages/funktionen.html"],
        kurzGesagt: "Der Generator verteilt Funksprüche auf die eingetragenen Funkstellen, erzeugt Melde- und Nachrichtenvordruck als PDF und begleitet die Übung live. Lösungswörter und Buchstabieraufgaben trainieren die Buchstabiertafel über eine ganze Übung hinweg. Für die Übungsleitung entsteht der Nachrichtenplan mit Status, Tempo und Funklast. Alles läuft im Browser, ohne Konto.",
        related: ["anleitung", "funksprueche", "regiebuch-funkuebung"],
        label: "Funktionen im Überblick",
        hubCategory: "anwendung",
        schemaType: "Article", datePublished: "2026-07-30",
        about: ["Funkübung", "Funktionen", "Sprechfunkausbildung"],
        faq: [
            {
                q: "Verteilt die Anwendung die Funksprüche automatisch?",
                a: "Ja. Du trägst die Teilnehmer mit ihren Funkrufnamen ein und legst fest, wie viele Funksprüche jeder absetzen soll – die Verteilung auf Absender und Empfänger übernimmt die Anwendung."
            },
            {
                q: "Welche PDFs kann ich erzeugen?",
                a: "Druckunterlagen je Teilnehmer, die Übersichten für die Übungsleitung, ein Debrief-PDF für die Nachbesprechung sowie leere Melde- und Nachrichtenvordrucke."
            },
            {
                q: "Brauche ich ein Konto?",
                a: "Nein. Die Anwendung ist ohne Anmeldung und ohne Installation nutzbar; die Teilnehmer erhalten einen Link, der alles Nötige enthält."
            },
            {
                q: "Ist das Projekt quelloffen?",
                a: "Ja. Der Quellcode steht unter der EUPL-1.2 öffentlich auf GitHub und ist damit nachprüfbar statt nur versprochen."
            }
        ]
    },
    {
        slug: "buchstabiertafel", source: "pages/buchstabiertafel.html", sources: ["src/pages/buchstabiertafel.html"],
        kurzGesagt: "Im BOS-Sprechfunk gilt in der Praxis die klassische Tafel mit Anton, Berta, Cäsar. Die DIN 5009:2022-06 ist die Neufassung mit Städtenamen, das ICAO-Alphabet der Luftfahrt kommt international vor. Umlaute, CH, SCH und ß haben eigene Zeichen. Mehrstellige Zahlen werden als ganze Zahl gesprochen, die Zwei zur Unterscheidung als „zwo“.",
        related: ["sprechfunk-regeln", "meldevordruck", "funksprueche"],
        label: "Buchstabiertafel",
        hubCategory: "grundlagen",
        schemaType: "Article", datePublished: "2026-07-26",
        about: ["Buchstabiertafel", "DIN 5009", "NATO-Alphabet", "Buchstabieren"],
        definedTerms: { name: "Buchstabiertafel im BOS-Sprechfunk", tableIndex: 0 },
        faq: [
            {
                q: "Welche Buchstabiertafel gilt im BOS-Sprechfunk?",
                a: "In der Praxis die klassische Tafel mit Anton, Berta, Cäsar. Die DIN 5009:2022-06 ist die Neufassung mit Städtenamen, das internationale Buchstabieralphabet der ICAO (NATO-Alphabet) kommt im internationalen Verkehr vor."
            },
            {
                q: "Wie werden Umlaute sowie CH und SCH buchstabiert?",
                a: "Sie haben eigene Zeichen in der Tafel: Ä wird zu Ärger, Ö zu Ökonom, Ü zu Übermut, CH zu Charlotte, SCH zu Schule und ß zu Eszett."
            },
            {
                q: "Wie werden Zahlen im Sprechfunk angesagt?",
                a: "Mehrstellige Zahlen werden als ganze Zahl gesprochen, nicht Ziffer für Ziffer. Zur Unterscheidung von „drei“ wird die Zwei als „zwo“ angesagt."
            },
            {
                q: "Wann wird überhaupt buchstabiert?",
                a: "Bei Eigennamen, Ortsangaben, Kennzeichen und schwer verständlichen Wörtern – damit sie auch bei Störungen, Nebengeräuschen oder schlechter Verbindung eindeutig ankommen."
            }
        ]
    },
    {
        slug: "meldevordruck", source: "pages/meldevordruck.html", sources: ["src/pages/meldevordruck.html"],
        kurzGesagt: "Im BOS-Sprechfunk werden Nachrichten schriftlich aufgenommen, nicht aus dem Kopf abgesetzt. Dafür gibt es zwei Vordrucke: den Meldevordruck in A5 für eine einzelne Nachricht und den Nachrichtenvordruck mit vier Nachrichten je Blatt. Beide stehen hier als leere PDF zum Ausdrucken bereit. Der Generator befüllt sie für eine Übung auch automatisch.",
        related: ["buchstabiertafel", "sprechfunk-regeln", "funksprueche"],
        label: "Meldevordruck",
        hubCategory: "anwendung",
        schemaType: "Article", datePublished: "2026-07-26",
        about: ["Meldevordruck", "Nachrichtenvordruck", "Nachrichtenaufnahme"],
        faq: [
            {
                q: "Was ist der Unterschied zwischen Meldevordruck und Nachrichtenvordruck?",
                a: "Der Meldevordruck im Format A5 nimmt eine einzelne Nachricht auf. Der Nachrichtenvordruck bündelt vier Nachrichten auf einer Seite."
            },
            {
                q: "Wo bekomme ich leere Vordrucke als PDF?",
                a: "Beide Vordrucke stehen auf dieser Seite als PDF zum Herunterladen bereit – der Meldevordruck in A5, der Nachrichtenvordruck mit vier Nachrichten je Blatt."
            },
            {
                q: "Warum werden Nachrichten schriftlich aufgenommen?",
                a: "Damit Absender, Empfänger und Nachrichtentext vollständig dokumentiert sind – im Einsatz genauso wie in der Sprechfunkübung. Nachrichten werden nicht aus dem Kopf abgesetzt, sondern schriftlich vorbereitet."
            },
            {
                q: "Kann die Anwendung die Vordrucke befüllen?",
                a: "Ja. Aus der erzeugten Übung entstehen fertig befüllte Vordrucke als PDF, sodass nur noch die aufgenommenen Nachrichten handschriftlich ergänzt werden."
            }
        ]
    },
    {
        slug: "funksprueche", source: "pages/funksprueche.html", sources: ["src/pages/funksprueche.html"],
        kurzGesagt: `Der Generator bringt ${ANZAHL_GESAMT_TEXT} fertige Funksprüche in mehreren Vorlagen mit und verteilt sie automatisch auf die Teilnehmer. Die Vorlagen decken Einsatzlagen aus dem Katastrophenschutz und bewusst überzeichnete Lagen für Jugendgruppen ab. Eigene Texte lassen sich als Textdatei hochladen, eine Zeile je Funkspruch. Über Lösungswörter entstehen Buchstabieraufgaben.`,
        related: ["funkuebung-szenarien", "buchstabiertafel", "funkuebung-vorlage"],
        label: "Funksprüche",
        hubCategory: "anwendung",
        schemaType: "CollectionPage", datePublished: "2026-07-26",
        about: ["Funksprüche", "Übungstexte", "Sprechfunkübung"],
        collection: [
            { name: "Einsatzlagen aus dem Katastrophenschutz", url: `${SITE_URL}/funksprueche/#vorlagen` },
            { name: "Humorvolle Lagen für Jugendgruppen", url: `${SITE_URL}/funksprueche/#vorlagen` }
        ],
        faq: [
            {
                q: "Wie viele Funksprüche sind enthalten?",
                a: `${ANZAHL_GESAMT_TEXT} fertige Funksprüche in mehreren Vorlagen. Sie werden automatisch auf die Teilnehmer verteilt.`
            },
            {
                q: "Welche Vorlagen gibt es?",
                a: "Einsatzlagen aus dem Katastrophenschutz – Hochwasser, Unwetterschäden, Erkundungsaufträge, Materialanforderungen und Stärkemeldungen – sowie bewusst überzeichnete, humorvolle Lagen für Jugendgruppen und lockere Ausbildungsabende."
            },
            {
                q: "Kann ich eigene Funksprüche einbinden?",
                a: "Ja. Eigene Übungstexte lassen sich als Datei hochladen und wie eine mitgelieferte Vorlage verwenden."
            },
            {
                q: "Lassen sich Buchstabieraufgaben einbauen?",
                a: "Ja. Über Lösungswörter entstehen Aufgaben, bei denen die Teilnehmer nach der Buchstabiertafel buchstabieren müssen."
            }
        ]
    },
    {
        slug: "funksprueche/vorlage/grundausbildung-einfach",
        source: "pages/funksprueche-vorlage-grundausbildung-einfach.html",
        sources: ["src/pages/funksprueche-vorlage-grundausbildung-einfach.html", "assets/funksprueche/funksprueche_grundausbildung_einfach.txt"],
        archivVorlage: "grundausbildung-einfach",
        breadcrumbEltern: [{ name: "Funksprüche", slug: "funksprueche" }],
        kurzGesagt: "Diese Vorlage enthält 462 kurze Übungsnachrichten für die erste Funkübung nach dem Lehrgang. Die Texte sind knapp, damit Anruf, Anrufantwort und Bestätigung geübt werden und nicht das Mitschreiben. Sie eignen sich für Grundausbildung, Jugendgruppen und den Wiedereinstieg nach längerer Pause. Der Download lässt sich unverändert in den Generator laden.",
        related: ["funksprueche", "funkuebung-vorlage", "funkuebung-planen"],
        label: "Vorlage Grundausbildung",
        hubCategory: "anwendung",
        archiv: true,
        schemaType: "CollectionPage", datePublished: "2026-08-04",
        about: ["Funksprüche", "Übungstexte", "Vorlage Grundausbildung"],
        faq: [
            {
                q: "Für wen ist diese Vorlage geeignet?",
                a: "Für die erste Funkübung nach dem Lehrgang, für Jugendgruppen und für den Wiedereinstieg nach längerer Pause. Die Nachrichten sind kurz, damit das Verfahren im Mittelpunkt steht und nicht das Mitschreiben."
            },
            {
                q: "Wie lang sind die Nachrichten?",
                a: "Kurz: die Hälfte liegt unter 50 Zeichen. Ein vollständiger Verkehr dauert damit etwa 30 Sekunden statt zwei Minuten."
            },
            {
                q: "Kann ich die Vorlage herunterladen und selbst nutzen?",
                a: "Ja. Der Download ist eine Textdatei mit einer Nachricht je Zeile – genau das Format, das der Generator beim Upload liest. Die Nutzung steht unter der EUPL-1.2."
            }
        ]
    },
    {
        slug: "funksprueche/vorlage/thw-essen",
        source: "pages/funksprueche-vorlage-thw-essen.html",
        sources: ["src/pages/funksprueche-vorlage-thw-essen.html", "assets/funksprueche/nachrichten_thw_essen.txt"],
        archivVorlage: "thw-essen",
        breadcrumbEltern: [{ name: "Funksprüche", slug: "funksprueche" }],
        kurzGesagt: "Diese Vorlage enthält 92 Übungsnachrichten aus einer Hochwasserlage im Essener Stadtgebiet, ausgehend von einem Deichbruch an der Emscher. Der Schwerpunkt liegt auf Erkundungsaufträgen und der geordneten Rückmeldung. Mehrere Nachrichten üben Stärkemeldungen und Koordinatenangaben im UTM-Format. Mit 92 Einträgen reicht sie für einen Abend mit acht Funkstellen.",
        related: ["funksprueche", "funkuebung-vorlage", "funkuebung-planen"],
        label: "Vorlage THW Essen",
        hubCategory: "anwendung",
        archiv: true,
        schemaType: "CollectionPage", datePublished: "2026-08-04",
        about: ["Funksprüche", "Übungstexte", "Vorlage THW Essen"],
        faq: [
            {
                q: "Woher stammen die Nachrichten dieser Vorlage?",
                a: "Aus einer Übungslage des THW-Ortsverbands Essen zu einem Deichbruch an der Emscher. Die Straßennamen sind echte Orte im Essener Norden."
            },
            {
                q: "Muss ich aus Essen sein, um die Vorlage zu nutzen?",
                a: "Nein. Die Ortsangaben sind Buchstabierstoff, unabhängig davon, ob die Teilnehmer die Straßen kennen. Wer lokale Namen bevorzugt, lädt eine eigene Datei hoch."
            },
            {
                q: "Was übt diese Vorlage besonders?",
                a: "Erkundungsaufträge mit geordneter Rückmeldung, Stärkemeldungen in der üblichen Schreibweise und die Übermittlung von Koordinaten im UTM-Format."
            }
        ]
    },
    {
        slug: "funksprueche/vorlage/thw-leer",
        source: "pages/funksprueche-vorlage-thw-leer.html",
        sources: ["src/pages/funksprueche-vorlage-thw-leer.html", "assets/funksprueche/nachrichten_thw_leer.txt"],
        archivVorlage: "thw-leer",
        breadcrumbEltern: [{ name: "Funksprüche", slug: "funksprueche" }],
        kurzGesagt: "Diese Vorlage enthält 118 Übungsnachrichten aus einer Sturm- und Hochwasserlage in Ostfriesland. Sie ist als Flächenlage angelegt: viele kleine Einsatzstellen gleichzeitig statt einer großen. Typisch sind versperrte Landesstraßen, volle Keller und drohende Uferüberläufe mit Erkundungsauftrag. Damit übt sie vor allem das Priorisieren auf einem belegten Kanal.",
        related: ["funksprueche", "funkuebung-vorlage", "funkuebung-planen"],
        label: "Vorlage THW Leer",
        hubCategory: "anwendung",
        archiv: true,
        schemaType: "CollectionPage", datePublished: "2026-08-04",
        about: ["Funksprüche", "Übungstexte", "Vorlage THW Leer"],
        faq: [
            {
                q: "Was unterscheidet eine Flächenlage von einer Einsatzlage?",
                a: "Bei einer Flächenlage kommen einzelne Meldungen von vielen Orten, bei einer Einsatzlage viele Meldungen von einem Ort. Diese Vorlage ist der erste Fall und übt vor allem das Priorisieren."
            },
            {
                q: "Wie viele Funkstellen trägt diese Vorlage?",
                a: "118 Nachrichten reichen für einen Abend mit etwa zehn Funkstellen. Für längere Übungen lässt sie sich mit der Lehrte-Vorlage kombinieren."
            },
            {
                q: "Braucht die Übung eine besetzte Führungsstelle?",
                a: "Sie ist von Vorteil. Viele Meldungen ziehen eine Entscheidung nach sich, und eine Führungsstelle beantwortet Rückfragen statt nur mitzuschreiben."
            }
        ]
    },
    {
        slug: "funksprueche/vorlage/thw-lehrte",
        source: "pages/funksprueche-vorlage-thw-lehrte.html",
        sources: ["src/pages/funksprueche-vorlage-thw-lehrte.html", "assets/funksprueche/nachrichten_thw_lehrte.txt"],
        archivVorlage: "thw-lehrte",
        breadcrumbEltern: [{ name: "Funksprüche", slug: "funksprueche" }],
        kurzGesagt: "Mit 752 Übungsnachrichten ist dies die größte Vorlage des Bestands. Sie beschreibt eine ausgedehnte Unwetterlage im Raum Lehrte und Burgdorf mit überfluteten Straßenzügen, beschädigten Bahnanlagen und Versorgungsausfällen. Die Texte sind die längsten im Archiv und verlangen eine geordnete Mitschrift. Damit trägt sie auch eine mehrtägige Stabsrahmenübung.",
        related: ["funksprueche", "funkuebung-vorlage", "funkuebung-planen"],
        label: "Vorlage THW Lehrte",
        hubCategory: "anwendung",
        archiv: true,
        schemaType: "CollectionPage", datePublished: "2026-08-04",
        about: ["Funksprüche", "Übungstexte", "Vorlage THW Lehrte"],
        faq: [
            {
                q: "Warum ist diese Vorlage die größte?",
                a: "Sie beschreibt eine ausgedehnte Unwetterlage mit mehreren gleichzeitigen Schadensschwerpunkten. 752 Nachrichten tragen rund zehn Übungsabende ohne Wiederholung."
            },
            {
                q: "Für welchen Ausbildungsstand ist sie geeignet?",
                a: "Für erfahrene Sprechfunker und für Stabsrahmenübungen. Die Texte sind die längsten im Archiv und verlangen eine geordnete Mitschrift im Meldevordruck."
            },
            {
                q: "Enthält die Vorlage Nachrichten für andere Organisationen?",
                a: "Ja. Ein Teil spricht Feuerwehreinheiten und die zivile Versorgung an, etwa Apotheken und Trinkwassertransporte. Damit eignet sie sich für organisationsübergreifende Übungen."
            }
        ]
    },
    {
        slug: "funksprueche/vorlage/thw-melle",
        source: "pages/funksprueche-vorlage-thw-melle.html",
        sources: ["src/pages/funksprueche-vorlage-thw-melle.html", "assets/funksprueche/nachrichten_thw_melle.txt"],
        archivVorlage: "thw-melle",
        breadcrumbEltern: [{ name: "Funksprüche", slug: "funksprueche" }],
        kurzGesagt: "Diese Vorlage enthält 400 Übungsnachrichten mit der höchsten Fachdichte im Archiv, aus einer Hochwasserlage an der Weser. Typisch sind Pegelmeldungen, Behandlungsplätze, Einsatzabschnitte und Kanalzuweisungen. Die Nachrichten setzen Kenntnis der Abkürzungen voraus und richten sich an Führungskräfte. Für die Grundausbildung ist sie ausdrücklich nicht gedacht.",
        related: ["funksprueche", "funkuebung-vorlage", "funkuebung-planen"],
        label: "Vorlage THW Melle",
        hubCategory: "anwendung",
        archiv: true,
        schemaType: "CollectionPage", datePublished: "2026-08-04",
        about: ["Funksprüche", "Übungstexte", "Vorlage THW Melle"],
        faq: [
            {
                q: "An wen richtet sich diese Vorlage?",
                a: "An Führungskräfte und an eine Sprechfunkausbildung auf Führungsebene. Die Nachrichten setzen Kenntnis der Abkürzungen und Fachbegriffe voraus."
            },
            {
                q: "Welche Meldearten kommen besonders häufig vor?",
                a: "Pegelmeldungen, Anforderungen mit Zeitdruck, Kanalzuweisungen für Einsatzabschnitte und Stärkemeldungen mit Fahrzeugaufstellung."
            },
            {
                q: "Eignet sich die Vorlage für die Grundausbildung?",
                a: "Nein. Die Fachdichte ist zu hoch; Teilnehmer können die Nachricht korrekt aufnehmen und trotzdem nicht handeln. Für den Einstieg gibt es die Vorlage für die Grundausbildung."
            }
        ]
    },
    {
        slug: "funksprueche/vorlage/thw-saarstedt",
        source: "pages/funksprueche-vorlage-thw-saarstedt.html",
        sources: ["src/pages/funksprueche-vorlage-thw-saarstedt.html", "assets/funksprueche/nachrichten_thw_saarstedt.txt"],
        archivVorlage: "thw-saarstedt",
        breadcrumbEltern: [{ name: "Funksprüche", slug: "funksprueche" }],
        kurzGesagt: "Diese Vorlage enthält 200 kurze Übungsnachrichten, die fast alle einen Straßen- oder Ortsnamen in Großbuchstaben tragen. Sie ist damit die Buchstabier-Vorlage des Archivs und übt Standortmeldungen. Die Texte sind mit im Schnitt 62 Zeichen kurz, der Anspruch liegt allein im Namen. Für einen Abend mit Schwerpunkt Buchstabiertafel ist sie die erste Wahl.",
        related: ["funksprueche", "funkuebung-vorlage", "funkuebung-planen"],
        label: "Vorlage THW Saarstedt",
        hubCategory: "anwendung",
        archiv: true,
        schemaType: "CollectionPage", datePublished: "2026-08-04",
        about: ["Funksprüche", "Übungstexte", "Vorlage THW Saarstedt"],
        faq: [
            {
                q: "Was macht diese Vorlage zur Buchstabier-Vorlage?",
                a: "Fast jede der 200 Nachrichten trägt einen Straßen- oder Ortsnamen in Großbuchstaben. Damit kommt das Buchstabieren nach der Buchstabiertafel in jeder Nachricht vor statt nur gelegentlich."
            },
            {
                q: "Wie lang sind die Nachrichten?",
                a: "Kurz: im Schnitt 62 Zeichen. Der Aufwand liegt nicht in der Mitschrift, sondern im Buchstabieren des Namens."
            },
            {
                q: "Lässt sich die Vorlage mit anderen mischen?",
                a: "Ja, und das ist empfehlenswert. Zusammen mit einer Unwetterlage füllen die kurzen Standortmeldungen die Lücken zwischen langen Lagemeldungen."
            }
        ]
    },
    {
        slug: "funkuebung-feuerwehr", source: "pages/funkuebung-feuerwehr.html", sources: ["src/pages/funkuebung-feuerwehr.html"],
        kurzGesagt: "Eine Funkübung für die Feuerwehr ist in wenigen Minuten vorbereitet: Teilnehmer mit ihren Florian-Rufnamen eintragen, Umfang festlegen, Vorlage wählen. Der Generator verteilt die Funksprüche und erzeugt für jede Funkstelle die Druckunterlagen. Für den Dienstabend haben sich sechs bis zehn Funkstellen mit je sechs bis zehn Sprüchen bewährt. Gefunkt wird über die vorhandenen Handfunkgeräte.",
        related: ["funkuebung-dienstabend", "funksprueche", "funkrufnamen"],
        label: "Funkübung Feuerwehr",
        hubCategory: "uebungen",
        schemaType: "Article", datePublished: "2026-07-28",
        about: ["Funkübung", "Feuerwehr", "Sprechfunkausbildung"],
        faq: [
            {
                q: "Wie schnell ist eine Funkübung für die Feuerwehr vorbereitet?",
                a: "In wenigen Minuten: Der Generator verteilt fertige Übungs-Funksprüche auf die Teilnehmer und erzeugt für jeden die passenden Druckunterlagen."
            },
            {
                q: "Was wird in einer Feuerwehr-Funkübung geübt?",
                a: "Das Absetzen und Aufnehmen von Nachrichten, das Buchstabieren nach der Buchstabiertafel und die Funkdisziplin im Anrufverfahren."
            },
            {
                q: "Eignet sich das auch für die Jugendfeuerwehr?",
                a: "Ja. Für Jugendgruppen lassen sich einfachere oder bewusst überzeichnete Übungstexte wählen, bei denen das saubere Absetzen wichtiger ist als der Realismus der Lage."
            },
            {
                q: "Brauche ich für die Übung echte Funkgeräte?",
                a: "Gefunkt wird über die vorhandenen Funkgeräte. Die Anwendung ersetzt nicht den Funk, sondern die Vorbereitung der Übungsunterlagen."
            }
        ]
    },
    {
        slug: "funkuebung-thw", source: "pages/funkuebung-thw.html", sources: ["src/pages/funkuebung-thw.html"],
        kurzGesagt: "Der Übungsgenerator ist im THW entstanden und in der Standortausbildung mehrerer Ortsverbände erprobt. Die mitgelieferten Vorlagen stammen aus echten THW-Übungslagen mit Erkundungsaufträgen, Materialanforderungen und Stärkemeldungen. Geübt wird mit den eigenen HEROS-Rufnamen des Ortsverbands. Zwischen SprFuGA und SprFuFü hält die Standortausbildung die Routine wach.",
        related: ["funkrufnamen-thw", "funkuebung-dienstabend", "funksprueche"],
        label: "Funkübung THW",
        hubCategory: "uebungen",
        schemaType: "Article", datePublished: "2026-07-28",
        about: ["Funkübung", "THW", "Standortausbildung"],
        faq: [
            {
                q: "Woher stammen die THW-Funksprüche?",
                a: "Die mitgelieferten Vorlagen stammen aus echten THW-Übungslagen: Hochwasser, Unwetterschäden, Erkundungsaufträge, Materialanforderungen und Stärkemeldungen."
            },
            {
                q: "Wer hat den Übungsgenerator entwickelt?",
                a: "Er ist im THW entstanden – entwickelt von einem Bereichsausbilder Sprechfunk und in der Standortausbildung mehrerer Ortsverbände erprobt."
            },
            {
                q: "Welche Sprechfunkausbildungen gibt es im THW?",
                a: "Die Grundausbildung Sprechfunk (SprFuGA) und die Sprechfunkausbildung für Führungskräfte (SprFuFü). Zwischen den Lehrgängen hält die Standortausbildung die Routine wach."
            },
            {
                q: "Kann ich mit den eigenen HEROS-Rufnamen üben?",
                a: "Ja. Die Teilnehmer werden mit ihren tatsächlichen Funkrufnamen eingetragen, sodass mit den echten Rufnamen des Ortsverbands geübt wird."
            }
        ]
    },
    {
        slug: "funkuebung-katastrophenschutz", source: "pages/funkuebung-katastrophenschutz.html", sources: ["src/pages/funkuebung-katastrophenschutz.html"],
        kurzGesagt: "Im Einsatz arbeiten Feuerwehr, THW, DRK, DLRG, ASB, Johanniter und Malteser auf denselben Rufgruppen, geübt wird der Sprechfunk aber meist getrennt. Der Generator senkt die Hürde: eine komplette Funkübung ist in wenigen Minuten vorbereitet, für Bereitschaften, Einsatzeinheiten und Züge. Organisationsübergreifende Übungen sind ausdrücklich vorgesehen.",
        related: ["funkuebung-thw", "funkuebung-feuerwehr", "uebungsfunkverkehr"],
        label: "Funkübung Katastrophenschutz",
        hubCategory: "uebungen",
        schemaType: "Article", datePublished: "2026-07-28",
        about: ["Funkübung", "Katastrophenschutz", "Bevölkerungsschutz"],
        faq: [
            {
                q: "Für welche Einheiten eignet sich die Übung?",
                a: "Für Bereitschaften, Einsatzeinheiten und Züge. Die Übung passt sich der eigenen Struktur an, weil die Teilnehmer mit ihren realen Funkrufnamen eingetragen werden."
            },
            {
                q: "Können mehrere Organisationen gemeinsam üben?",
                a: "Ja. Im Einsatz arbeiten Feuerwehr, THW, DRK, DLRG, ASB, Johanniter und Malteser auf denselben Rufgruppen – organisationsübergreifendes Üben ist ausdrücklich vorgesehen."
            },
            {
                q: "Was ist eine Fernmeldeübung?",
                a: "Eine Übung, in der neben dem Sprechen auch Meldewege und Dokumentation trainiert werden – also das vollständige Aufnehmen und Weiterleiten von Nachrichten."
            },
            {
                q: "Was kostet die Nutzung für unsere Organisation?",
                a: "Nichts. Die Anwendung ist kostenlos und ohne Anmeldung nutzbar, für jede Organisation."
            }
        ]
    },
    {
        slug: "funkuebung-dienstabend", source: "pages/funkuebung-dienstabend.html", sources: ["src/pages/funkuebung-dienstabend.html"],
        kurzGesagt: "Für einen Dienstabend genügen rund 15 Minuten Vorbereitung am Rechner. Der Ablauf gliedert sich in Einweisung, Anmeldung der Funkstellen, Übungsbetrieb und Nachbesprechung und passt in 90 Minuten. Sechs bis zehn Funkstellen mit je sechs bis zehn Funksprüchen füllen diesen Rahmen aus. Die Checkliste unten führt durch Vorbereitung und Durchführung.",
        related: ["funkuebung-planen", "funksprueche", "meldevordruck"],
        label: "Funkübung für den Dienstabend",
        hubCategory: "uebungen",
        schemaType: "Article", datePublished: "2026-07-28",
        about: ["Funkübung", "Dienstabend", "Ausbildungsdienst"],
        howTo: {
            name: "Funkübung für den Dienstabend vorbereiten",
            description: "In vier Schritten und rund 15 Minuten ist die Funkübung für den Dienstabend fertig vorbereitet.",
            totalTime: "PT15M",
            steps: [
                { name: "Teilnehmer eintragen", text: "Alle Funkstellen mit ihren Rufnamen anlegen – je Trupp, Fahrzeug oder Zweiergruppe eine Funkstelle. Etwa 5 Minuten." },
                { name: "Umfang festlegen", text: "Für einen 90-Minuten-Abend haben sich 6 bis 10 Funksprüche je Teilnehmer bewährt. Etwa 2 Minuten." },
                { name: "Vorlage wählen", text: "Eine der mitgelieferten Funkspruch-Vorlagen auswählen oder eigene Texte hochladen. Etwa 2 Minuten." },
                { name: "Unterlagen erzeugen", text: "Die PDFs je Teilnehmer herunterladen und drucken – oder die persönlichen Links verteilen. Etwa 5 Minuten." }
            ]
        },
        faq: [
            {
                q: "Wie lange dauert die Vorbereitung?",
                a: "Etwa eine Viertelstunde am Rechner: Teilnehmer eintragen, Umfang festlegen, Vorlage wählen, Unterlagen erzeugen."
            },
            {
                q: "Wie viele Funksprüche pro Teilnehmer sind sinnvoll?",
                a: "Für einen Abend von rund 90 Minuten haben sich 6 bis 10 Funksprüche je Teilnehmer bewährt."
            },
            {
                q: "Wie lange dauert der Übungsabend selbst?",
                a: "Der beschriebene Ablauf ist auf etwa 90 Minuten ausgelegt, von der Einweisung bis zur Nachbesprechung."
            },
            {
                q: "Gibt es Varianten für Einsteiger und Jugendgruppen?",
                a: "Ja. Über die Auswahl der Vorlage und die Anzahl der Funksprüche lässt sich der Schwierigkeitsgrad von der Einsteigerübung bis zur Jugendgruppe anpassen."
            }
        ]
    },
    {
        slug: "funkuebung-vorlage", source: "pages/funkuebung-vorlage.html", sources: ["src/pages/funkuebung-vorlage.html"],
        kurzGesagt: `Eine feste PDF-Vorlage ist nach wenigen Einsätzen verbraucht, weil alle in der Einheit die Funksprüche kennen. Der Generator erzeugt aus ${ANZAHL_GESAMT_TEXT} Übungstexten jedes Mal eine neue, vollständige Sprechfunkübung, zugeschnitten auf Teilnehmerzahl und Rufnamen. Enthalten sind die verteilten Funksprüche, Vordrucke und die Unterlagen für die Übungsleitung.`,
        related: ["funksprueche", "funkuebung-planen", "meldevordruck"],
        label: "Funkübung Vorlage",
        hubCategory: "uebungen",
        schemaType: "Article", datePublished: "2026-07-26",
        about: ["Funkübung", "Vorlage", "Übungsunterlagen"],
        faq: [
            {
                q: "Warum kein starres PDF als Vorlage?",
                a: `Eine feste Vorlage ist nach wenigen Einsätzen verbraucht, weil alle in der Einheit die Funksprüche kennen. Der Generator erzeugt aus ${ANZAHL_GESAMT_TEXT} Übungstexten jedes Mal eine neue Übung.`
            },
            {
                q: "Was enthält die fertige Übung?",
                a: "Einen vollständigen Übungssatz: die verteilten Funksprüche je Teilnehmer, die Übersichten für die Übungsleitung und die Druckunterlagen als PDF."
            },
            {
                q: "Ist die Übung auf unsere Teilnehmerzahl zugeschnitten?",
                a: "Ja. Die Verteilung richtet sich nach der eingetragenen Teilnehmerzahl und den jeweiligen Funkrufnamen."
            },
            {
                q: "Wie oft kann ich eine Vorlage verwenden?",
                a: "Unbegrenzt. Aus derselben Vorlage entstehen beliebig viele unterschiedliche Übungen."
            }
        ]
    },
    {
        slug: "funkuebung-planen", source: "pages/funkuebung-planen.html", sources: ["src/pages/funkuebung-planen.html"],
        kurzGesagt: "Eine Funkübung entsteht in sieben Schritten, von Übungsziel und Rahmen über Teilnehmer, Funksprüche und Nachrichtenplan bis zur Nachbesprechung. Der Generator übernimmt die Verteilung der Übungstexte und die Druckunterlagen. Für den Rahmen haben sich 60 bis 90 Minuten Übungsbetrieb bewährt. Die Auswertung liefert das Debrief-PDF.",
        related: ["funkuebung-dienstabend", "funkuebung-szenarien", "regiebuch-funkuebung"],
        label: "Funkübung planen",
        hubCategory: "uebungen",
        schemaType: "HowTo", datePublished: "2026-07-29",
        about: ["Funkübung", "Übungsplanung", "Übungsleitung"],
        howTo: {
            name: "Funkübung planen",
            description: "In sieben Schritten von der Idee zur durchgeführten und nachbesprochenen Sprechfunkübung.",
            totalTime: "PT30M",
            steps: [
                { name: "Übungsziel und Rahmen festlegen", text: "Klären, was geübt werden soll, wie lange die Übung dauert und welche Funkstellen beteiligt sind." },
                { name: "Teilnehmer und Funkrufnamen sammeln", text: "Alle beteiligten Funkstellen mit ihren tatsächlichen Funkrufnamen zusammenstellen." },
                { name: "Funksprüche auswählen", text: "Eine passende Vorlage wählen oder eigene Übungstexte bereitstellen." },
                { name: "Nachrichtenplan erzeugen lassen", text: "Den Nachrichtenplan automatisch erstellen lassen: welche Funkstelle wann welche Nachricht an wen absetzt." },
                { name: "Unterlagen verteilen", text: "Druckunterlagen ausgeben oder die persönlichen Teilnehmer-Links verteilen." },
                { name: "Übung durchführen", text: "Die Übung mit der Übungsleitungs-Ansicht begleiten und den Fortschritt live verfolgen." },
                { name: "Nachbesprechen und auswerten", text: "Die Übung anhand der aufgezeichneten Daten nachbesprechen und die Auswertung als Debrief-PDF nutzen." }
            ]
        },
        faq: [
            {
                q: "Womit fängt die Planung einer Funkübung an?",
                a: "Mit dem Übungsziel und dem Rahmen: was geübt werden soll, wie lange die Übung dauert und welche Funkstellen beteiligt sind."
            },
            {
                q: "Was ist der Nachrichtenplan?",
                a: "Die vollständige Übersicht, welche Funkstelle wann welche Nachricht an wen absetzt. Der Generator erzeugt ihn automatisch aus Teilnehmerliste und Funkspruch-Vorlage."
            },
            {
                q: "Wie werden die Unterlagen verteilt?",
                a: "Entweder als gedruckte PDFs je Teilnehmer oder über persönliche Links, die im Browser geöffnet werden."
            },
            {
                q: "Wie wird die Übung nachbesprochen?",
                a: "Über die aufgezeichneten Daten der Übungsleitung und das Debrief-PDF, das die Auswertung für die Nachbesprechung zusammenfasst."
            }
        ]
    },
    {
        slug: "funkuebung-szenarien", source: "pages/funkuebung-szenarien.html", sources: ["src/pages/funkuebung-szenarien.html"],
        kurzGesagt: "Eine Einkleidung macht aus zusammenhanglosen Übungstexten eine zusammenhängende Lage. Unten stehen zwölf erprobte Szenarien mit Angabe, was jedes übt und für welche Gruppe es passt. Flächenlagen erzeugen viele Meldungen von vielen Stellen, Einsatzlagen viele Meldungen von einer Stelle. Die Umsetzung ist immer gleich: Teilnehmer und passende Funksprüche eintragen.",
        related: ["funksprueche", "funkuebung-planen", "funkuebung-katastrophenschutz"],
        label: "Szenarien für die Funkübung",
        hubCategory: "uebungen",
        schemaType: "Article", datePublished: "2026-07-29",
        about: ["Funkübung", "Szenarien", "Übungslage"],
        faq: [
            {
                q: "Wozu braucht eine Funkübung ein Szenario?",
                a: "Eine Funkübung funktioniert auch mit zusammenhanglosen Übungstexten. Mit einer Einkleidung – einem Szenario – bekommen die Funksprüche einen Rahmen und die Teilnehmer werden gedanklich in eine Lage versetzt."
            },
            {
                q: "Was ist der Unterschied zwischen Flächenlage und Einsatzlage?",
                a: "Eine Flächenlage hat viele Einsatzstellen auf einer Rufgruppe, eine Einsatzlage eine Einsatzstelle mit vielen Meldungen."
            },
            {
                q: "Wie viele Szenarien stehen zur Auswahl?",
                a: "Die Seite beschreibt zwölf erprobte Szenarien für Sprechfunkübungen bei Feuerwehr, THW und Hilfsorganisationen – jeweils mit dem, was das Szenario besonders übt."
            },
            {
                q: "Wie setze ich ein Szenario um?",
                a: "Immer gleich: Teilnehmer und passende Funksprüche in den Generator eintragen, den Rest übernimmt die Anwendung."
            }
        ]
    },
    {
        slug: "sprechfunk-regeln", source: "pages/sprechfunk-regeln.html", sources: ["src/pages/sprechfunk-regeln.html"],
        kurzGesagt: "Der Sprechfunkbetrieb der BOS folgt der PDV/DV 810.3 „Sprechfunkdienst“, einem Auszug aus der PDV/DV 810. Jede Verbindung beginnt mit Anruf und Anrufantwort, die Betriebsworte regeln den Wechsel zwischen den Funkstellen. Geschrieben wird, was gesendet wird, nicht was man verstanden zu haben glaubt. Die Regeln gelten organisationsübergreifend.",
        related: ["betriebsworte", "buchstabiertafel", "uebungsfunkverkehr"],
        label: "Sprechfunk-Regeln",
        hubCategory: "grundlagen",
        schemaType: "Article", datePublished: "2026-07-29",
        about: ["Sprechfunk-Regeln", "DV 810.3", "Funkdisziplin"],
        faq: [
            {
                q: "Welche Vorschrift regelt den BOS-Sprechfunk?",
                a: "Die Dienstvorschrift PDV/DV 810.3 „Sprechfunkdienst“, ein Auszug aus der umfassenderen PDV/DV 810 „Fernmeldebetriebsdienst“, sowie die darauf aufbauenden Vorschriften der Organisationen."
            },
            {
                q: "Was sind die Grundsätze des Sprechfunkverkehrs?",
                a: "Kurz, klar und diszipliniert sprechen: nur senden, was nötig ist, und den Kanal für die anderen Funkstellen frei halten."
            },
            {
                q: "Wie läuft ein Anruf ab?",
                a: "Über Anruf und Anrufantwort: Die anrufende Funkstelle nennt die Gegenstelle und sich selbst, die Gegenstelle antwortet, bevor die Nachricht abgesetzt wird."
            },
            {
                q: "Wie werden Nachrichten aufgenommen?",
                a: "Geschrieben wird, was gesendet wird – nicht, was man verstanden zu haben glaubt. Dafür sind Melde- und Nachrichtenvordruck vorgesehen."
            }
        ]
    },
    {
        slug: "betriebsworte", source: "pages/betriebsworte.html", sources: ["src/pages/betriebsworte.html"],
        kurzGesagt: "Betriebsworte sind festgelegte Wörter mit exakt definierter Bedeutung, die einen offenen Funkkanal für viele Teilnehmer nutzbar machen. Grundlage ist die PDV/DV 810.3 „Sprechfunkdienst“. Wer sie kennt, weiß jederzeit, ob eine Antwort erwartet wird und ob eine Nachricht angekommen ist. Die Tabelle unten führt alle Betriebsworte mit Bedeutung und Beispiel.",
        related: ["sprechfunk-regeln", "verkehrsarten", "uebungsfunkverkehr"],
        label: "Betriebsworte",
        hubCategory: "grundlagen",
        schemaType: "Article", datePublished: "2026-08-01",
        about: ["Betriebsworte", "DV 810.3", "Verkehrsabwicklung"],
        definedTerms: { name: "Betriebsworte im BOS-Sprechfunk", tableIndex: 0 },
        faq: [
            {
                q: "Was sind Betriebsworte?",
                a: "Eine kleine Zahl festgelegter Wörter und Sprachwendungen mit exakt definierter Bedeutung. Sie machen einen offenen Funkkanal für viele Teilnehmer gleichzeitig nutzbar."
            },
            {
                q: "Wo sind die Betriebsworte festgelegt?",
                a: "Grundlage ist die PDV/DV 810.3 „Sprechfunkdienst“, ein Auszug aus der PDV/DV 810 „Fernmeldebetriebsdienst“."
            },
            {
                q: "Was bedeutet das Betriebswort „Ende“?",
                a: "Es beendet grundsätzlich jeden Fernmeldeverkehr. Danach ist die Rufgruppe wieder frei."
            },
            {
                q: "Muss ich die Betriebsworte auswendig lernen?",
                a: "Sie lernt man nicht auswendig, sondern im Verkehr – also durch regelmäßiges Üben im tatsächlichen Sprechfunkbetrieb."
            }
        ]
    },
    {
        slug: "uebungsfunkverkehr", source: "pages/uebungsfunkverkehr.html", sources: ["src/pages/uebungsfunkverkehr.html"],
        kurzGesagt: "Eine Sprechfunkbetriebsübung läuft auf denselben Netzen wie der Einsatzbetrieb, deshalb muss sie gekennzeichnet werden. Der Vermerk „Übung“ macht Übungsnachrichten erkennbar, das Stichwort „Tatsache“ bringt eine echte Meldung mitten in der Übung durch. Die PDV/DV 810.3 regelt beides ausdrücklich. Dazu kommen Vorrangstufen und Aufbewahrungsfristen.",
        related: ["sprechfunk-regeln", "betriebsworte", "funkuebung-planen"],
        label: "Übungsfunkverkehr",
        hubCategory: "uebungen",
        schemaType: "Article", datePublished: "2026-08-01",
        about: ["Übungsfunkverkehr", "Vorrangstufen", "DV 810.3"],
        faq: [
            {
                q: "Warum muss Übungsverkehr gekennzeichnet werden?",
                a: "Eine Sprechfunkbetriebsübung läuft auf denselben Netzen und oft in Hörweite derselben Funkstellen wie der Einsatzbetrieb. Die PDV/DV 810.3 regelt deshalb ausdrücklich, wie Übungsverkehr zu kennzeichnen ist."
            },
            {
                q: "Was bedeutet der Vermerk „Übung“?",
                a: "Er kennzeichnet den Funkverkehr als Übungsverkehr, damit mithörende Funkstellen ihn nicht für einen echten Einsatz halten."
            },
            {
                q: "Was bedeutet das Stichwort „Tatsache“?",
                a: "Damit kommt eine echte Meldung mitten in der Übung durch. „Übung“ und „Tatsache“ sind der Unterschied zwischen einer sauber geführten Übung und einem Fehlalarm."
            },
            {
                q: "Welche Vorrangstufen gibt es?",
                a: "Einfach, Sofort, Blitz und Staatsnot."
            }
        ]
    },
    {
        slug: "bos-funk", source: "pages/bos-funk.html", sources: ["src/pages/bos-funk.html"],
        kurzGesagt: "BOS steht für Behörden und Organisationen mit Sicherheitsaufgaben. Sie funken über ein gemeinsames, verschlüsseltes TETRA-Netz, den Digitalfunk BOS. Statt Kanälen gibt es Rufgruppen als logische Gesprächskreise; TMO läuft über das Netz, DMO direkt zwischen den Geräten. Die Endgeräte heißen HRT, MRT und FRT und senden ihre OPTA mit.",
        related: ["funkrufnamen", "verkehrsarten", "funkmeldesystem"],
        label: "BOS-Funk Grundlagen",
        hubCategory: "grundlagen",
        schemaType: "Article", datePublished: "2026-07-30",
        about: ["BOS-Funk", "Digitalfunk", "TETRA", "Rufgruppe"],
        faq: [
            {
                q: "Wofür steht die Abkürzung BOS?",
                a: "Für Behörden und Organisationen mit Sicherheitsaufgaben: Polizei, Feuerwehr, THW, Rettungsdienst, Zoll und die Einheiten des Katastrophenschutzes."
            },
            {
                q: "Was ist der Unterschied zwischen TMO und DMO?",
                a: "Es sind die zwei Betriebsmodi des Digitalfunks: TMO läuft über das Netz, DMO als Direktbetrieb zwischen den Endgeräten ohne Netzinfrastruktur."
            },
            {
                q: "Was sind Rufgruppen?",
                a: "Im Digitalfunk ersetzen Rufgruppen die Kanäle des Analogfunks. Sie bestimmen, welche Funkstellen einander hören."
            },
            {
                q: "Was ist die OPTA?",
                a: "Die operativ-taktische Adresse eines Endgeräts. Sie kennzeichnet das Gerät im Digitalfunk – neben den Gerätearten HRT, MRT und FRT."
            }
        ]
    },
    {
        slug: "funkreichweite", source: "pages/funkreichweite.html", sources: ["src/pages/funkreichweite.html"],
        kurzGesagt: "Meterwellen laufen im Wesentlichen geradeaus, deshalb endet der Funk meist dort, wo die Sicht endet. Hindernisse zwischen den Funkstellen kosten unmittelbar Reichweite, Reflexion und Beugung helfen nur begrenzt. Wirksam ist die Wahl des Standorts, nicht lauteres Sprechen. Die Grundlagen stammen aus dem THW-Handbuch Sprechfunk im THW.",
        related: ["antennen", "verkehrsarten", "bos-funk"],
        label: "Reichweite von Funkwellen",
        hubCategory: "technik",
        schemaType: "Article", datePublished: "2026-08-01",
        about: ["Funkreichweite", "Wellenausbreitung", "Funktechnik"],
        faq: [
            {
                q: "Warum endet der Funk dort, wo die Sicht endet?",
                a: "Meterwellen laufen im Wesentlichen geradeaus. Hindernisse zwischen den Funkstellen kosten deshalb unmittelbar Reichweite – „kein Netz“ ist selten eine Frage des Geräts, sondern der Physik."
            },
            {
                q: "Was verbessert eine schlechte Verbindung?",
                a: "Ein besserer Standort. Lauter zu sprechen oder das Funkgerät zu schütteln hilft nicht; die Wahl des Aufbauplatzes ist der wirksame Hebel."
            },
            {
                q: "Was bedeuten die „Meter“ im Bandnamen?",
                a: "Sie bezeichnen die Wellenlänge, die mit der Frequenz zusammenhängt – daher etwa die Bezeichnung 2-Meter-Band."
            },
            {
                q: "Woher stammen die Angaben auf dieser Seite?",
                a: "Sie fassen die physikalischen und technischen Grundlagen aus dem THW-Handbuch „Sprechfunk im THW“ (Kapitel 2) zusammen."
            }
        ]
    },
    {
        slug: "verkehrsarten", source: "pages/verkehrsarten.html", sources: ["src/pages/verkehrsarten.html"],
        kurzGesagt: "Die Verkehrsarten beschreiben laut DV 810.3 die von der Technik abhängigen Verfahren des Nachrichtenaustauschs: Richtungs-, Wechsel-, Gegen- und Relaisverkehr. Nicht zu verwechseln mit den Verkehrsformen, die das organisatorische Zusammenwirken der Funkstellen bezeichnen. Im Relaisverkehr regeln die Schaltungen RS-1 bis RS-4 die Betriebsart.",
        related: ["betriebsworte", "funkreichweite", "bos-funk"],
        label: "Verkehrsarten",
        hubCategory: "grundlagen",
        schemaType: "Article", datePublished: "2026-08-01",
        about: ["Verkehrsarten", "Relaisverkehr", "DV 810.3"],
        definedTerms: { name: "Relaisschaltungen RS-1 bis RS-4", tableIndex: 0 },
        faq: [
            {
                q: "Was sind Verkehrsarten im Sprechfunk?",
                a: "Die DV 810.3 definiert sie als die von den technischen Möglichkeiten der Geräte abhängigen Verfahren des Nachrichtenaustauschs: Richtungs-, Wechsel-, Gegen- und Relaisverkehr."
            },
            {
                q: "Was ist der Unterschied zwischen Verkehrsarten und Verkehrsformen?",
                a: "Verkehrsarten hängen von der Technik ab. Verkehrsformen beschreiben dagegen das organisatorische Zusammenwirken der Funkstellen."
            },
            {
                q: "Was ist Wechselverkehr?",
                a: "Eine Verkehrsart, bei der die Funkstellen abwechselnd senden und empfangen – nicht gleichzeitig wie beim Gegenverkehr."
            },
            {
                q: "Wozu dient der Relaisverkehr?",
                a: "Er vergrößert die Reichweite oder verbindet Sprechfunkverkehrskreise. Dafür sind die Relaisschaltungen RS-1 bis RS-4 vorgesehen."
            }
        ]
    },
    {
        slug: "antennen", source: "pages/antennen.html", sources: ["src/pages/antennen.html"],
        kurzGesagt: "Ein Funkgerät ist nur so gut wie das, was hinten dranhängt: Fehler in Antenne oder Kabel kosten unmittelbar Reichweite. Die Antennenlänge muss zur Frequenz passen, Leitungen haben Impedanz, Dämpfung und einen zulässigen Biegeradius. Auf Fahrzeugen werden Antennen senkrecht montiert. Beim Aufbau gelten Schutzabstände zu Freileitungen.",
        related: ["funkreichweite", "bos-funk", "verkehrsarten"],
        label: "Antennen",
        hubCategory: "technik",
        schemaType: "Article", datePublished: "2026-08-01",
        about: ["Antennen", "Antennenleitungen", "Funktechnik"],
        faq: [
            {
                q: "Warum ist die Antenne das schwächste Glied der Funkstrecke?",
                a: "Ein Funkgerät ist nur so gut wie das, was hinten dranhängt. Fehler in Antenne oder Kabel kosten unmittelbar Reichweite und können im schlimmsten Fall das Gerät zerstören."
            },
            {
                q: "Wie müssen Antennen auf Fahrzeugen montiert sein?",
                a: "Senkrecht – immer."
            },
            {
                q: "Was ist bei Antennenleitungen zu beachten?",
                a: "Impedanz, Dämpfung und der Biegeradius der Leitung."
            },
            {
                q: "Woher stammen die Schutzabstände beim Aufbau von Funkanlagen?",
                a: "Sie sind dem THW-Handbuch „Sprechfunk im THW“ (Kapitel 2.5 und 3.2) entnommen, das auch die Abstände zu Freileitungen und das Verhalten bei Gewitter behandelt."
            }
        ]
    },
    {
        slug: "funkrufnamen", source: "pages/funkrufnamen.html", sources: ["src/pages/funkrufnamen.html"],
        kurzGesagt: "Im BOS-Funk werden keine Personen angesprochen, sondern Funkstellen. Der Funkrufname ist die taktische Adresse eines Fahrzeugs, einer Führungsstelle oder eines Trupps und bleibt gleich, auch wenn die Besatzung wechselt. Er besteht aus Kennwort, Ort und Kennzahlen. Am Kennwort erkennt man die Organisation, etwa Florian für die Feuerwehr.",
        related: ["funkrufnamen-thw", "bos-funk", "funkmeldesystem"],
        label: "Funkrufnamen",
        hubCategory: "rufnamen",
        schemaType: "Article", datePublished: "2026-07-30",
        about: ["Funkrufnamen", "Organisationskennwort", "BOS-Sprechfunk"],
        faq: [
            {
                q: "Was ist ein Funkrufname?",
                a: "Die taktische Adresse einer Funkstelle – eines Fahrzeugs, einer Führungsstelle oder eines Trupps – unabhängig davon, wer gerade das Mikrofon hält."
            },
            {
                q: "Wie ist ein Funkrufname aufgebaut?",
                a: "Aus Kennwort, Ort und Kennzahlen. Nach diesem Muster lässt sich am Rufnamen Organisation, Herkunft und Funktion der Gegenstelle erkennen."
            },
            {
                q: "Warum werden keine Personen angesprochen?",
                a: "Im BOS-Funk spricht niemand Personen an, sondern Funkstellen. Der Rufname bleibt gleich, auch wenn die Besatzung wechselt."
            },
            {
                q: "Soll man mit erfundenen Rufnamen üben?",
                a: "Nein. Geübt wird mit den eigenen Rufnamen, damit die Systematik im Einsatz sitzt."
            }
        ]
    },
    {
        slug: "funkrufnamen-thw", source: "pages/funkrufnamen-thw.html", sources: ["src/pages/funkrufnamen-thw.html"],
        kurzGesagt: "Das THW hat eine bundesweit einheitliche Funkrufnamenregelung. Das Kennwort ist immer HEROS, dahinter steht eine vierstellige Ziffernfolge. An ihr sind Einheit, Teileinheit, Feststation, Fahrzeug oder Führungskraft taktisch erkennbar. Die Ziffern 91 bis 99 kennzeichnen Personenrufnamen.",
        related: ["funkrufnamen", "funkuebung-thw", "bos-funk"],
        label: "Funkrufnamen im THW",
        hubCategory: "rufnamen",
        schemaType: "Article", datePublished: "2026-08-01",
        about: ["Funkrufnamen", "THW", "HEROS"],
        faq: [
            {
                q: "Welches Kennwort nutzt das THW im Sprechfunk?",
                a: "Immer HEROS. Die Funkrufnamenregelung (FuRnR) des THW ist bundesweit einheitlich und für das gesamte THW verbindlich."
            },
            {
                q: "Wie ist ein THW-Funkrufname aufgebaut?",
                a: "Aus dem Kennwort HEROS und vier Ziffern. Die Ziffernfolge macht Einheit, Teileinheit, Feststation, Fahrzeug oder Führungskraft taktisch erkennbar."
            },
            {
                q: "Welche Ziffern kennzeichnen Personenrufnamen?",
                a: "Die Ziffern 91 bis 99."
            },
            {
                q: "Wie werden mehrere Ortsverbände in einer Stadt unterschieden?",
                a: "Dafür ist in der Regelung ein Sonderfall vorgesehen, damit die Rufnamen eindeutig bleiben."
            }
        ]
    },
    {
        slug: "funkmeldesystem", source: "pages/funkmeldesystem.html", sources: ["src/pages/funkmeldesystem.html"],
        kurzGesagt: "Das Funkmeldesystem ist die stille Hälfte des BOS-Funks: Statt eine Lageänderung zu sprechen, drückt die Besatzung eine Zifferntaste, und die Leitstelle sieht den neuen Status im Einsatzleitsystem. Das hält den Kanal frei und dokumentiert den Verlauf mit Zeitstempel. Die Statusmeldungen 0 bis 9 gehen vom Fahrzeug zur Leitstelle.",
        related: ["funkrufnamen", "bos-funk", "sprechfunk-regeln"],
        label: "Funkmeldesystem (FMS)",
        hubCategory: "rufnamen",
        schemaType: "Article", datePublished: "2026-08-01",
        about: ["Funkmeldesystem", "FMS", "Statusmeldungen"],
        definedTerms: { name: "FMS-Statusmeldungen 0 bis 9", tableIndex: 0 },
        faq: [
            {
                q: "Was ist das Funkmeldesystem?",
                a: "Kurz FMS: Statt jede Lageänderung zu sprechen, drückt die Besatzung eine Zifferntaste am Funkgerät – die Leitstelle sieht den neuen Status sofort im Einsatzleitsystem."
            },
            {
                q: "Welchen Vorteil bringen Statusmeldungen?",
                a: "Sie halten den Funkkanal frei für das, was wirklich gesprochen werden muss, und dokumentieren den Einsatzverlauf nebenbei mit Zeitstempel."
            },
            {
                q: "Was bedeutet Status 1?",
                a: "Einsatzbereit über Funk. Die Statusmeldungen 0 bis 9 sind auf dieser Seite vollständig aufgeführt."
            },
            {
                q: "Gehören Statusmeldungen in eine Funkübung?",
                a: "Ja. Wer Sprechfunk ausbildet, kommt am Status nicht vorbei – er gehört genauso in die Übung wie das Anrufverfahren und das Buchstabieren."
            }
        ]
    },
    {
        slug: "open-source", source: "pages/open-source.html", sources: ["src/pages/open-source.html"],
        kurzGesagt: "Der Sprechfunk Übungsgenerator ist kostenlos und quelloffen unter der EUPL-1.2. Es gibt keine Preisstufen, keine Teilnehmergrenzen, kein Benutzerkonto und keine Werbe-Cookies. Der Quellcode liegt öffentlich auf GitHub und ist damit nachprüfbar statt nur versprochen. Entstanden ist das Projekt aus dem Ehrenamt.",
        related: ["faq", "funktionen", "anleitung"],
        label: "Kostenlos und Open Source",
        hubCategory: "anwendung",
        schemaType: "Article", datePublished: "2026-07-29",
        about: ["Open Source", "EUPL-1.2", "Datenschutz"],
        faq: [
            {
                q: "Gibt es Preisstufen oder Premium-Funktionen?",
                a: "Nein. Es gibt keine Preisstufen, keine Premium-Funktionen, keine Limits und keine Testphase."
            },
            {
                q: "Unter welcher Lizenz steht das Projekt?",
                a: "Unter der EUPL-1.2. Der Quellcode liegt öffentlich auf GitHub und ist damit nachprüfbar statt nur versprochen."
            },
            {
                q: "Werden Werbe-Cookies gesetzt?",
                a: "Nein. Das Projekt ist datensparsam angelegt: kein Konto und keine Werbe-Cookies."
            },
            {
                q: "Wie kann ich mitwirken?",
                a: "Über das öffentliche Repository auf GitHub – etwa mit Fehlermeldungen, Verbesserungsvorschlägen oder eigenen Funkspruch-Vorlagen."
            }
        ]
    },
    {
        slug: "digitale-funkuebung", source: "pages/digitale-funkuebung.html", sources: ["src/pages/digitale-funkuebung.html"],
        kurzGesagt: "Gefunkt wird weiter über echte Funkgeräte, nur die Übungsunterlagen wandern vom Papier in den Browser. Jede Funkstelle bekommt einen persönlichen Link, aufrufbar am Smartphone, Tablet oder Laptop, ohne App und ohne Anmeldung. Dort stehen die eigenen Funksprüche und werden abgehakt. Die Übungsleitung sieht den Fortschritt live.",
        related: ["regiebuch-funkuebung", "funkuebung-dienstabend", "funktionen"],
        label: "Digitale Funkübung",
        hubCategory: "uebungen",
        schemaType: "Article", datePublished: "2026-07-28",
        about: ["Digitale Funkübung", "Teilnehmer-Link", "Online-Dienstabend"],
        // Kein HowTo: die Seite enthält keine sichtbare, nummerierte Schrittfolge.
        faq: [
            {
                q: "Wird bei der digitalen Funkübung über das Internet gefunkt?",
                a: "Nein. Gefunkt wird weiter über echte Funkgeräte – nur die Übungsunterlagen werden nicht mehr auf Papier verteilt."
            },
            {
                q: "Was brauchen die Teilnehmer?",
                a: "Einen persönlichen Link, aufrufbar in jedem Browser am Smartphone, Tablet oder Laptop – ohne App, ohne Anmeldung, ohne Installation."
            },
            {
                q: "Kann man auch verteilt üben?",
                a: "Ja. Der Link eignet sich für den Online-Dienstabend und für das Üben aus der Heimarbeit."
            },
            {
                q: "Was sieht der Teilnehmer in der Ansicht?",
                a: "Die eigenen Funksprüche. Dort wird auch abgehakt, was abgesetzt ist."
            }
        ]
    },
    {
        slug: "regiebuch-funkuebung", source: "pages/regiebuch-funkuebung.html", sources: ["src/pages/regiebuch-funkuebung.html"],
        kurzGesagt: "Das Regiebuch ist die vollständige Übersicht, welche Funkstelle wann welche Nachricht an wen absetzt. Der Generator erzeugt es als Nachrichtenplan automatisch aus Teilnehmerliste und Funkspruch-Vorlage. Während der Übung wird daraus ein Live-Cockpit mit Status, Fortschritt und Funklast. Für die Nachbesprechung bleibt der Verlauf als Debrief-PDF erhalten.",
        related: ["funkuebung-planen", "digitale-funkuebung", "meldevordruck"],
        label: "Regiebuch Funkübung",
        hubCategory: "uebungen",
        schemaType: "Article", datePublished: "2026-07-28",
        about: ["Regiebuch", "Nachrichtenplan", "Übungsleitung"],
        // Kein HowTo: die Seite enthält keine sichtbare, nummerierte Schrittfolge.
        faq: [
            {
                q: "Was ist das Regiebuch einer Funkübung?",
                a: "Die vollständige Übersicht, welche Funkstelle wann welche Nachricht an wen absetzt. Klassisch entsteht es in mühsamer Handarbeit."
            },
            {
                q: "Muss ich den Nachrichtenplan selbst schreiben?",
                a: "Nein. Der Generator erzeugt ihn automatisch aus Teilnehmerliste und Funkspruch-Vorlage."
            },
            {
                q: "Was zeigt die Live-Übungsleitung?",
                a: "Fortschritt, Tempo und Funklast während der Übung – aus dem Nachrichtenplan wird ein Live-Cockpit."
            },
            {
                q: "Hilft das bei der Nachbesprechung?",
                a: "Ja. Die aufgezeichneten Daten liefern die Grundlage für eine Nachbesprechung mit Substanz statt aus dem Gedächtnis."
            }
        ]
    },
    {
        slug: "x-zeit", source: "pages/x-zeit.html", sources: ["src/pages/x-zeit.html"],
        kurzGesagt: "X-Zeit ist eine relative Zeitangabe ab Übungsbeginn: X+15 heißt fünfzehn Minuten nach dem Start. Der Übungsgenerator legt im X-Zeit-Modus jede Nachricht auf einen solchen Slot, berechnet aus Start-Offset und Intervall. Die Funkstellen sehen einen Countdown bis zur nächsten fälligen Nachricht, die Übungsleitung den Vergleich von Soll und Ist. Das Intervall gilt für die ganze Übung, nicht für die einzelne Funkstelle.",
        related: ["regiebuch-funkuebung", "funkuebung-planen", "digitale-funkuebung"],
        label: "X-Zeit",
        hubCategory: "uebungen",
        schemaType: "Article", datePublished: "2026-08-04",
        about: ["X-Zeit", "Übungszeitplan", "Funkübung"],
        faq: [
            {
                q: "Was bedeutet X-Zeit im Sprechfunk?",
                a: "Eine relative Zeitangabe ab einem Bezugszeitpunkt, der beim Planen noch offen ist. X+15 bedeutet fünfzehn Minuten nach dem festgelegten Beginn. Verschiebt sich der Start, verschiebt sich der ganze Plan mit."
            },
            {
                q: "Wie berechnet der Generator die X-Zeiten?",
                a: "Nach der Formel Start-Offset plus Position mal Intervall. Die Position zählt über die ganze Übung, nicht je Funkstelle; die Anmeldungs-Funksprüche liegen alle auf X+0."
            },
            {
                q: "Welches Intervall ist für einen Dienstabend sinnvoll?",
                a: "Es ergibt sich aus dem Zeitrahmen geteilt durch die Zahl der Nachrichten. Bei acht Funkstellen mit je sechs Sprüchen und 90 Minuten Rahmen sind das etwa 2 Minuten. Unter einer Minute entstehen Wartezeiten, weil ein Verkehr 45 bis 90 Sekunden braucht."
            },
            {
                q: "Sehen die Teilnehmer alle Nachrichten im Voraus?",
                a: "Im Fokus-Modus nicht. Er zeigt allein die aktuell fällige Nachricht und hält künftige Texte bis zu ihrer Fälligkeit verborgen. Ohne Fokus-Modus bleibt die vollständige Tabelle sichtbar."
            }
        ]
    },
    {
        slug: "kostenlos-ohne-anmeldung", source: "pages/kostenlos-ohne-anmeldung.html", sources: ["src/pages/kostenlos-ohne-anmeldung.html"],
        kurzGesagt: "Die Nutzung ist kostenlos und verlangt kein Konto, keine Zahlungsdaten und keine Installation. Es gibt keine Testphase, die abläuft, und keine Funktion hinter einer Bezahlschranke. Gespeichert werden nur die Angaben, die für die Übung eingetragen werden, und die sind für jeden lesbar, der den Link kennt. Der Quellcode steht unter der EUPL-1.2 auf GitHub.",
        related: ["open-source","faq","funktionen"],
        label: "Kostenlos und ohne Anmeldung",
        hubCategory: "anwendung",
        schemaType: "Article", datePublished: "2026-08-04",
        about: ["Funkübung", "Kostenlos und ohne Anmeldung"],
        faq: [
            {
                q: "Gibt es eine Bezahlversion?",
                a: "Nein. Es gibt keine Preisstufen, keine Premium-Funktionen und keine Obergrenzen für Teilnehmer, Übungen oder Exporte. Alle Funktionen sind vollständig verfügbar."
            },
            {
                q: "Muss ich mich registrieren?",
                a: "Nein. Es gibt kein Benutzerkonto und keine Anmeldung. Die Anwendung kennt keinen Begriff von Identität – Übungsleitung, Teilnehmer und Verwaltung sind reine Ansichten im Browser."
            },
            {
                q: "Werden meine Übungsdaten gespeichert?",
                a: "Ja. Übungsname, Funkrufnamen und die erzeugten Funksprüche liegen bei Firebase, dazu der Fortschritt je Funkstelle. Weil es keine Anmeldung gibt, gibt es auch keinen Zugriffsschutz: wer den Link hat, kann die Übung öffnen."
            },
            {
                q: "Kann ich die Anwendung offline nutzen?",
                a: "Nur eingeschränkt. Zum Erzeugen einer Übung und für den Teilnehmerzugang wird eine Verbindung gebraucht. Die Druckunterlagen lassen sich vorher als PDF oder ZIP herunterladen und offline verwenden."
            },
            {
                q: "Darf ich sie in meiner Dienststelle einsetzen?",
                a: "Die EUPL-1.2 erlaubt das, auch dienstlich. Ob die eigene Organisation den Einsatz eines externen Webdienstes zulässt, ist davon unabhängig zu klären – die Übungsdaten liegen bei Firebase."
            }
        ]
    },
    {
        slug: "alternative", source: "pages/alternative.html", sources: ["src/pages/alternative.html"],
        kurzGesagt: "Eine Sprechfunkübung lässt sich auf vier Wegen vorbereiten: von Hand, mit einer Tabellenvorlage, mit einem freien Generator oder mit einer kommerziellen Web-Anwendung. Die Wege unterscheiden sich in Vorbereitungszeit, Kosten, Registrierung und Funktionsumfang. Diese Seite stellt die Merkmale gegenüber, statt einen Sieger zu benennen. Für zwei Bedarfe ist die kommerzielle Lösung die passendere Wahl.",
        related: ["funkuebung-planen","funkuebung-vorlage","kostenlos-ohne-anmeldung"],
        label: "Alternativen im Vergleich",
        hubCategory: "uebungen",
        schemaType: "Article", datePublished: "2026-08-04",
        about: ["Funkübung", "Alternativen im Vergleich"],
        faq: [
            {
                q: "Was ist die Alternative zu einem Funkübungs-Generator mit Konto?",
                a: "Drei Wege ohne Konto: von Hand mit Vordrucken, eine Excel- oder Word-Vorlage aus der eigenen Einheit, oder ein freier Generator im Browser. Welcher passt, hängt von Teilnehmerzahl, Zeit und den Vorgaben der Organisation ab."
            },
            {
                q: "Wodurch unterscheiden sich die Angebote am deutlichsten?",
                a: "An der Registrierung, an Mengengrenzen und an der Quelloffenheit. Bei den Kernfunktionen – Verteilung, PDF, Teilnehmerzugang, Live-Übungsleitung – liegen die Web-Anwendungen näher beieinander, als es zunächst wirkt."
            },
            {
                q: "Wann ist eine kostenpflichtige Lösung die richtige?",
                a: "Wenn über Rechnung beschafft werden muss, wenn ein Vertragspartner mit Zuständigkeit gebraucht wird oder wenn mehrere Personen mit eigenen Zugängen an Übungen arbeiten sollen. Ohne Benutzerkonten gibt es keine Rechteverwaltung."
            },
            {
                q: "Sind die Angaben über andere Anbieter aktuell?",
                a: "Sie stammen von der öffentlichen Website des jeweiligen Anbieters und tragen im Quelltext dieser Seite Fundstelle und Abrufdatum. Die Angaben werden halbjährlich geprüft; maßgeblich bleibt immer die Website des Anbieters."
            }
        ]
    },
    {
        slug: "wissen", source: "pages/wissen.html", sources: ["src/pages/wissen.html"],
        kurzGesagt: "Sprechfunk lernt man im Lehrgang und behält es durch regelmäßiges Üben. Diese Übersicht bündelt beides: die fachlichen Grundlagen des BOS-Sprechfunks und die praktische Arbeit mit Funkübungen. Die Betriebsabwicklung folgt organisationsübergreifend der PDV/DV 810.3. Für die Praxis erzeugt der Generator vollständige Übungen.",
        related: ["funkuebung-planen", "sprechfunk-regeln", "funksprueche"],
        label: "Wissen",
        schemaType: "CollectionPage", datePublished: "2026-08-03",
        about: ["Sprechfunk", "BOS-Funk", "Funkübung", "Wissensübersicht"],
        // Die ItemList entsteht beim Build aus HUB_CATEGORIES und den Seiten der
        // Kategorien – eine zweite Liste hier würde auseinanderlaufen.
        faq: [
            {
                q: "Wo fange ich an, wenn ich zum ersten Mal eine Funkübung leite?",
                a: "Mit der Seite „Funkübung planen“: sie führt in sieben Schritten von der Zielsetzung bis zur Nachbesprechung. Für den konkreten Abend liefert „Funkübung für den Dienstabend“ einen erprobten Zeitplan."
            },
            {
                q: "Welche Seiten brauche ich für die Sprechfunkausbildung?",
                a: "Die Grundlagen stehen in „Sprechfunk-Regeln“, „Betriebsworte“ und „Buchstabiertafel“. Diese drei deckt jede Grundausbildung ab und sie eignen sich als Handout."
            },
            {
                q: "Sind die Inhalte an eine Organisation gebunden?",
                a: "Nein. Die Regeln der PDV/DV 810.3 gelten organisationsübergreifend. Für THW und Feuerwehr gibt es zusätzlich eigene Seiten zu Funkrufnamen und Übungsformaten."
            },
            {
                q: "Kostet die Nutzung etwas?",
                a: "Nein. Alle Inhalte und der Übungsgenerator sind kostenlos, ohne Anmeldung und ohne Installation nutzbar; der Quellcode steht unter der EUPL-1.2."
            }
        ]
    },
    {
        slug: "faq", source: "pages/faq.html", sources: ["src/pages/faq.html"],
        kurzGesagt: "Der Sprechfunk Übungsgenerator erstellt vollständige BOS-Sprechfunkübungen: er verteilt Funksprüche, erzeugt Druckunterlagen als PDF und begleitet die Übung live. Die Nutzung ist kostenlos, ohne Konto und ohne Installation. Unten stehen die häufigsten Fragen zu Ablauf, Daten, Vorlagen und Lizenz.",
        related: ["anleitung", "funkuebung-planen", "open-source"],
        label: "FAQ",
        hubCategory: "anwendung",
        schemaType: "FAQPage", datePublished: "2026-07-26",
        about: ["Sprechfunkübung", "Häufige Fragen"],
        // Die Fragen stehen bereits sichtbar auf der Seite und werden von dort
        // gelesen – kein zweiter Datensatz, kein zusätzlich injizierter Block.
        faqFromPage: true
    },
    {
        slug: "autor", source: "pages/autor.html", sources: ["src/pages/autor.html"],
        kurzGesagt: "Der Übungsgenerator ist aus der eigenen Ausbildungspraxis entstanden, nicht am Reißbrett. Der Autor ist seit 2007 beim Technischen Hilfswerk aktiv, Gruppenführer der Fachgruppe Kommunikation und Bereichsausbilder für Sprechfunk. Die mitgelieferten Übungstexte stammen aus tatsächlich gefunkten Übungen mehrerer Ortsverbände. Das Projekt ist Ehrenamt, quelloffen und ohne kommerzielles Interesse.",
        related: ["ueber-das-projekt", "open-source", "funkuebung-thw"],
        label: "Über den Autor",
        hubCategory: "anwendung",
        schemaType: "ProfilePage", datePublished: "2026-08-04",
        about: ["Sprechfunk Übungsgenerator", "Über den Autor"],
        faq: [
            {
                q: "Welche Qualifikation steht hinter den Inhalten?",
                a: "Der Autor ist seit 2007 beim Technischen Hilfswerk aktiv, Gruppenführer der Fachgruppe Kommunikation und Bereichsausbilder für Sprechfunk. Die Inhalte stammen aus dieser Ausbildungspraxis."
            },
            {
                q: "Ist die Seite ein offizielles Angebot des THW?",
                a: "Nein. Es ist ein privates, ehrenamtliches Projekt ohne amtlichen Charakter. Maßgeblich sind die geltenden Dienstvorschriften und die Festlegungen der eigenen Organisation."
            },
            {
                q: "Woher kommen die Übungsfunksprüche?",
                a: "Aus tatsächlich gefunkten Übungen mehrerer THW-Ortsverbände sowie einem Bestand kurzer Meldungen für die Grundausbildung. Der vollständige Bestand ist im Funkspruch-Archiv einsehbar."
            }
        ]
    },
    {
        slug: "ueber-das-projekt", source: "pages/ueber-das-projekt.html", sources: ["src/pages/ueber-das-projekt.html"],
        kurzGesagt: "Der Sprechfunk Übungsgenerator ist ein privates, ehrenamtliches Projekt ohne Firma, Finanzierung und Werbung. Er ist kein offizielles Angebot einer Behörde. Die fachlichen Seiten nennen ihre Quellen und sagen, wo keine geprüfte Quelle vorliegt. Fehler lassen sich über GitHub oder per E-Mail melden und werden nachvollziehbar korrigiert.",
        related: ["autor", "open-source", "kostenlos-ohne-anmeldung"],
        label: "Über das Projekt",
        hubCategory: "anwendung",
        schemaType: "Article", datePublished: "2026-08-04",
        about: ["Sprechfunk Übungsgenerator", "Über das Projekt"],
        faq: [
            {
                q: "Ist das ein offizielles Angebot des THW oder einer Behörde?",
                a: "Nein. Es ist ein privates, ehrenamtliches Projekt ohne amtlichen Charakter. Maßgeblich sind die geltenden Dienstvorschriften und die Festlegungen der eigenen Organisation."
            },
            {
                q: "Wie werden die fachlichen Inhalte geprüft?",
                a: "Jede Regelseite trägt den Abschnitt „Grundlagen und Quellen“ mit dem zugrunde liegenden Dokument, den am Original geprüften Abschnitten und dem Prüfdatum. Wo keine geprüfte Quelle vorliegt, steht das dort ausdrücklich."
            },
            {
                q: "Wie melde ich einen fachlichen Fehler?",
                a: "Bevorzugt über ein Issue auf GitHub, weil die Meldung dort nachvollziehbar bleibt, sonst per E-Mail. Korrekturen werden über die öffentliche Versionsverwaltung nachvollziehbar gemacht und das Änderungsdatum der Seite wird angepasst."
            },
            {
                q: "Wie finanziert sich das Projekt?",
                a: "Gar nicht. Es gibt keine Firma, keine Werbung, kein Sponsoring und keine Preisstufen. Die Arbeit passiert im Ehrenamt."
            }
        ]
    },
    {
        slug: "impressum", source: "pages/impressum.html", sources: ["src/pages/impressum.html"],
        label: "Impressum",
        // Rechtstext: bleibt indexierbar und im Footer verlinkt, gehört aber
        // nicht in die Crawl-Priorisierung.
        inSitemap: false,
        schemaType: "WebPage", datePublished: "2026-07-26",
        about: ["Impressum"]
    },
    {
        slug: "datenschutz", source: "pages/datenschutz.html", sources: ["src/pages/datenschutz.html"],
        label: "Datenschutz",
        // Rechtstext: bleibt indexierbar und im Footer verlinkt, gehört aber
        // nicht in die Crawl-Priorisierung.
        inSitemap: false,
        schemaType: "WebPage", datePublished: "2026-07-26",
        about: ["Datenschutz"]
    }
];

/** Slug der Hub-Seite, die alle Inhaltsseiten bündelt (AP-04). */
export const HUB_SLUG = "wissen";

/**
 * Kategorien des Content-Hubs. Reihenfolge = Reihenfolge auf /wissen/ und in
 * der Brotkrumenleiste. `hubCategory` je Seite verweist auf `key`.
 *
 * Die fünfte Kategorie geht über die vier des Arbeitspakets hinaus: dessen
 * Zuordnung deckt nur 20 der 26 Inhaltsseiten ab, das Abnahmekriterium verlangt
 * aber jede Seite mit einem Klick vom Hub aus. Ohne sie wären Anleitung, FAQ,
 * Funksprüche, Funktionen, Meldevordruck und Open Source vom Hub nicht erreichbar.
 */
export const HUB_CATEGORIES = [
    { key: "uebungen", label: "Funkübungen planen und durchführen", anchor: "uebungen" },
    { key: "grundlagen", label: "Sprechfunk-Grundlagen", anchor: "grundlagen" },
    { key: "rufnamen", label: "Funkrufnamen und Kennungen", anchor: "rufnamen" },
    { key: "technik", label: "Technik der Funkstrecke", anchor: "technik" },
    { key: "anwendung", label: "Anwendung, Vorlagen und Nachschlagewerke", anchor: "anwendung" }
];

/** Seiten einer Hub-Kategorie, in Registry-Reihenfolge. */
export function hubSeiten(key) {
    return SITE_PAGES.filter(page => page.hubCategory === key);
}

/**
 * Hauptnavigation, auf jeder Seite identisch und statisch ausgeliefert.
 * Absichtlich sechs Einträge: die Tiefe kommt über den Hub, nicht über ein Menü.
 */
export const MAIN_NAV = [
    { slug: "", label: "Übung erstellen" },
    { slug: HUB_SLUG, label: "Wissen" },
    { slug: "funksprueche", label: "Funksprüche" },
    { slug: "anleitung", label: "Anleitung" },
    { slug: "faq", label: "FAQ" },
    { slug: "open-source", label: "Über das Projekt" }
];

/**
 * Seiten, die in die sitemap.xml gehören. Rechtstexte sind bewusst nicht dabei:
 * sie bleiben erreichbar und verlinkt, sind aber kein Crawl-Ziel.
 */
export const SITEMAP_PAGES = SITE_PAGES.filter(page => page.inSitemap !== false);

/** Seiten, die als eigenes Verzeichnis (=> /slug/index.html) ausgeliefert werden. */
export const STATIC_SUBPAGES = SITE_PAGES.filter(page => page.slug !== "");

export function canonicalUrl(slug) {
    return slug ? `${SITE_URL}/${slug}/` : `${SITE_URL}/`;
}

/**
 * Baut die sitemap.xml. `lastmod` wird je Seite als ISO-Datum (YYYY-MM-DD) erwartet;
 * Seiten ohne Datum werden ohne <lastmod> ausgegeben.
 */
export function buildSitemap(lastmodBySlug = {}) {
    const entries = SITEMAP_PAGES.map(page => {
        const lastmod = lastmodBySlug[page.slug];
        return [
            "  <url>",
            `    <loc>${canonicalUrl(page.slug)}</loc>`,
            lastmod ? `    <lastmod>${lastmod}</lastmod>` : null,
            "  </url>"
        ].filter(Boolean).join("\n");
    });

    return [
        "<?xml version=\"1.0\" encoding=\"UTF-8\"?>",
        "<urlset xmlns=\"http://www.sitemaps.org/schemas/sitemap/0.9\">",
        ...entries,
        "</urlset>",
        ""
    ].join("\n");
}
