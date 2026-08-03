// Zentrale Registrierung aller statisch ausgelieferten, indexierbaren Seiten.
// Quelle der Wahrheit für Build (postbuild-copy.mjs), Sitemap, strukturierte
// Daten (lib/schema-graph.mjs) und SEO-Tests.

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
                a: "Über 1.800 fertige Funksprüche in mehreren Vorlagen. Eigene Texte aus dem Ortsverband oder der eigenen Wache lassen sich zusätzlich hochladen."
            }
        ]
    },
    {
        slug: "anleitung", source: "pages/anleitung.html", sources: ["src/pages/anleitung.html"],
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
        schemaType: "CollectionPage", datePublished: "2026-07-26",
        about: ["Funksprüche", "Übungstexte", "Sprechfunkübung"],
        collection: [
            { name: "Einsatzlagen aus dem Katastrophenschutz", url: `${SITE_URL}/funksprueche/#vorlagen` },
            { name: "Humorvolle Lagen für Jugendgruppen", url: `${SITE_URL}/funksprueche/#vorlagen` }
        ],
        faq: [
            {
                q: "Wie viele Funksprüche sind enthalten?",
                a: "Über 1.800 fertige Funksprüche in mehreren Vorlagen. Sie werden automatisch auf die Teilnehmer verteilt."
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
        slug: "funkuebung-feuerwehr", source: "pages/funkuebung-feuerwehr.html", sources: ["src/pages/funkuebung-feuerwehr.html"],
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
                a: "Eine Übung, in der nicht nur das Sprechen, sondern auch Meldewege und Dokumentation trainiert werden – also das vollständige Aufnehmen und Weiterleiten von Nachrichten."
            },
            {
                q: "Was kostet die Nutzung für unsere Organisation?",
                a: "Nichts. Die Anwendung ist kostenlos und ohne Anmeldung nutzbar, für jede Organisation."
            }
        ]
    },
    {
        slug: "funkuebung-dienstabend", source: "pages/funkuebung-dienstabend.html", sources: ["src/pages/funkuebung-dienstabend.html"],
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
        schemaType: "Article", datePublished: "2026-07-26",
        about: ["Funkübung", "Vorlage", "Übungsunterlagen"],
        faq: [
            {
                q: "Warum kein starres PDF als Vorlage?",
                a: "Eine feste Vorlage ist nach wenigen Einsätzen verbraucht, weil alle in der Einheit die Funksprüche kennen. Der Generator erzeugt aus über 1.800 Übungstexten jedes Mal eine neue Übung."
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
        slug: "faq", source: "pages/faq.html", sources: ["src/pages/faq.html"],
        schemaType: "FAQPage", datePublished: "2026-07-26",
        about: ["Sprechfunkübung", "Häufige Fragen"],
        // Die Fragen stehen bereits sichtbar auf der Seite und werden von dort
        // gelesen – kein zweiter Datensatz, kein zusätzlich injizierter Block.
        faqFromPage: true
    },
    {
        slug: "impressum", source: "pages/impressum.html", sources: ["src/pages/impressum.html"],
        // Rechtstext: bleibt indexierbar und im Footer verlinkt, gehört aber
        // nicht in die Crawl-Priorisierung.
        inSitemap: false,
        schemaType: "WebPage", datePublished: "2026-07-26",
        about: ["Impressum"]
    },
    {
        slug: "datenschutz", source: "pages/datenschutz.html", sources: ["src/pages/datenschutz.html"],
        // Rechtstext: bleibt indexierbar und im Footer verlinkt, gehört aber
        // nicht in die Crawl-Priorisierung.
        inSitemap: false,
        schemaType: "WebPage", datePublished: "2026-07-26",
        about: ["Datenschutz"]
    }
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
