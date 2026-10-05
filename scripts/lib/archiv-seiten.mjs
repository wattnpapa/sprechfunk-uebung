// Archivseiten der Funkspruch-Vorlagen (AP-08) als Teil von SITE_PAGES.
//
// Nur ausgelagert, damit scripts/site-pages.mjs überschaubar bleibt: die
// Einträge werden dort an fester Stelle in SITE_PAGES eingefügt, die Registry
// bleibt die einzige Quelle der Wahrheit. Feldbedeutungen siehe dort.

export const ARCHIV_SEITEN = [
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
        slug: "funksprueche/vorlage/feuerwehr-unwetter",
        source: "pages/funksprueche-vorlage-feuerwehr-unwetter.html",
        sources: ["src/pages/funksprueche-vorlage-feuerwehr-unwetter.html", "assets/funksprueche/nachrichten_feuerwehr_unwetter.txt"],
        archivVorlage: "feuerwehr-unwetter",
        breadcrumbEltern: [{ name: "Funksprüche", slug: "funksprueche" }],
        kurzGesagt: "Diese Vorlage enthält 224 Übungsnachrichten aus einer Sturmlage für die Feuerwehr: Bäume auf Straßen, Keller unter Wasser, ein Dachstuhlbrand nach Blitzschlag, ein steigender Bach im Ortskern. Die Sprache folgt FwDV 3 und FwDV 100, mit Stärkemeldungen, Atemschutzüberwachung und Wasserförderung. Sie wurde für den Generator geschrieben, nicht aus einer gefunkten Übung übernommen. Der Download lässt sich unverändert hochladen.",
        related: ["funksprueche", "funkuebung-feuerwehr", "funkuebung-szenarien"],
        label: "Vorlage Feuerwehr Unwetter",
        hubCategory: "anwendung",
        archiv: true,
        schemaType: "CollectionPage", datePublished: "2026-09-27",
        about: ["Funksprüche", "Übungstexte", "Feuerwehr"],
        faq: [
            {
                q: "Für welche Feuerwehren ist die Vorlage gedacht?",
                a: "Für Freiwillige Feuerwehren mit mehreren Ortsfeuerwehren in einem Landkreis. Die Lage ist ländlich angelegt, die Fahrzeuge reichen vom TSF-W bis zur Drehleiter, die Führungsstruktur folgt der FwDV 100."
            },
            {
                q: "Was übt die Vorlage anders als die THW-Vorlagen?",
                a: "Stärkemeldungen nach FwDV 3, Atemschutzüberwachung, Wasserförderung über lange Wegstrecke, Freischaltung durch den Netzbetreiber und die Priorisierung vieler gleichzeitiger Einsatzstellen durch die Einsatzleitung."
            },
            {
                q: "Stammen die Nachrichten aus einem echten Einsatz?",
                a: "Nein. Die Vorlage wurde für den Generator geschrieben, mit dem Fachprofil der Organisation und den Regeln des BOS-Sprechfunks. Orts- und Straßennamen sind erfunden. Korrekturen aus der Praxis nimmt das Projekt gern an."
            }
        ]
    },
    {
        slug: "funksprueche/vorlage/sanitaet-betreuung-evakuierung",
        source: "pages/funksprueche-vorlage-sanitaet-betreuung-evakuierung.html",
        sources: ["src/pages/funksprueche-vorlage-sanitaet-betreuung-evakuierung.html", "assets/funksprueche/nachrichten_sanitaet_betreuung_evakuierung.txt"],
        archivVorlage: "sanitaet-betreuung-evakuierung",
        breadcrumbEltern: [{ name: "Funksprüche", slug: "funksprueche" }],
        kurzGesagt: "Diese Vorlage enthält 139 Übungsnachrichten aus einer Evakuierung nach einem Kampfmittelfund für Einsatzeinheiten und Schnelleinsatzgruppen von DRK, ASB, Johannitern und Maltesern. Betreuungsstellen, Registrierung, Verpflegung mit Sonderkost, Sanitätsstation und Krankentransport bettlägeriger Bewohner bilden die Lage. Sie wurde für den Generator geschrieben, nicht aus einer gefunkten Übung übernommen. Der Download lässt sich unverändert hochladen.",
        related: ["funksprueche", "funkuebung-katastrophenschutz", "funkuebung-dienstabend"],
        label: "Vorlage Sanitäts- und Betreuungsdienst",
        hubCategory: "anwendung",
        archiv: true,
        schemaType: "CollectionPage", datePublished: "2026-09-27",
        about: ["Funksprüche", "Übungstexte", "Betreuungsdienst"],
        faq: [
            {
                q: "Für welche Einheiten ist die Vorlage gedacht?",
                a: "Für Einsatzeinheiten und Schnelleinsatzgruppen Betreuung, Verpflegung und Sanität der Hilfsorganisationen. Die Nachrichten bleiben in der Innensicht des Betreuungs- und Sanitätsdienstes, ohne Löschangriff und ohne Leitstellendisposition."
            },
            {
                q: "Warum stehen so viele Zahlen in den Nachrichten?",
                a: "Weil der Betreuungsdienst von Zahlen lebt: Belegung nach Personengruppen, Portionen mit Sonderkost, Feldbetten und Decken in Stück, Kapazitäten je Betreuungsstelle. Diese Zahlen fehlerfrei zu übermitteln ist der Kern der Übung."
            },
            {
                q: "Stammen die Nachrichten aus einem echten Einsatz?",
                a: "Nein. Die Vorlage wurde für den Generator geschrieben, mit dem Fachprofil der Organisation und den Regeln des BOS-Sprechfunks. Orts- und Straßennamen sind erfunden. Korrekturen aus der Praxis nimmt das Projekt gern an."
            }
        ]
    },
    {
        slug: "funksprueche/vorlage/wasserrettung-hochwasser",
        source: "pages/funksprueche-vorlage-wasserrettung-hochwasser.html",
        sources: ["src/pages/funksprueche-vorlage-wasserrettung-hochwasser.html", "assets/funksprueche/nachrichten_wasserrettung_hochwasser.txt"],
        archivVorlage: "wasserrettung-hochwasser",
        breadcrumbEltern: [{ name: "Funksprüche", slug: "funksprueche" }],
        kurzGesagt: "Diese Vorlage enthält 131 Übungsnachrichten aus einer Hochwasserlage für Wasserrettungszüge von DLRG und Wasserwacht. Boote holen Bewohner aus überfluteten Straßen, dazu Pegelmeldungen, Treibgutwarnungen, Strömungsretter, Taucher am Wehr und eine Personensuche in der Dämmerung. Sie wurde für den Generator geschrieben, nicht aus einer gefunkten Übung übernommen. Der Download lässt sich unverändert hochladen.",
        related: ["funksprueche", "funkuebung-katastrophenschutz", "funkuebung-szenarien"],
        label: "Vorlage Wasserrettung",
        hubCategory: "anwendung",
        archiv: true,
        schemaType: "CollectionPage", datePublished: "2026-09-27",
        about: ["Funksprüche", "Übungstexte", "Wasserrettung"],
        faq: [
            {
                q: "Wie werden die Boote in den Nachrichten benannt?",
                a: "Als Boot 1 bis Boot 3, weil die Rufnamen aus der Teilnehmerliste der Übung kommen. Wer die Boote als eigene Funkstellen einträgt, bekommt eine Übung, in der Bootsführer und Zugtrupp direkt miteinander funken."
            },
            {
                q: "Passt die Vorlage zu einer Übung mit dem THW?",
                a: "Ja. Die Hochwasserlage aus Essen im Archiv funkt dieselbe Art Lage von der Landseite. Beide Vorlagen zusammen ergeben eine organisationsübergreifende Übung mit Deich, Booten und Pumpen."
            },
            {
                q: "Stammen die Nachrichten aus einem echten Einsatz?",
                a: "Nein. Die Vorlage wurde für den Generator geschrieben, mit dem Fachprofil der Organisation und den Regeln des BOS-Sprechfunks. Orts- und Straßennamen sind erfunden. Korrekturen aus der Praxis nimmt das Projekt gern an."
            }
        ]
    },
    {
        slug: "funksprueche/vorlage/rettungsdienst-manv",
        source: "pages/funksprueche-vorlage-rettungsdienst-manv.html",
        sources: ["src/pages/funksprueche-vorlage-rettungsdienst-manv.html", "assets/funksprueche/nachrichten_rettungsdienst_manv.txt"],
        archivVorlage: "rettungsdienst-manv",
        breadcrumbEltern: [{ name: "Funksprüche", slug: "funksprueche" }],
        kurzGesagt: "Diese Vorlage enthält 136 Übungsnachrichten aus einem Massenanfall von Verletzten nach einem Busunfall auf einer Landesstraße. Sichtung in vier Kategorien, Patientenablage, Behandlungsplatz, Transportorganisation mit Klinikkapazitäten, Rettungshubschrauber und Status-Meldungen nach dem Funkmeldesystem bilden die Lage. Sie wurde für den Generator geschrieben, nicht aus einer gefunkten Übung übernommen. Der Download lässt sich unverändert hochladen.",
        related: ["funksprueche", "funkuebung-katastrophenschutz", "funkuebung-szenarien"],
        label: "Vorlage Rettungsdienst MANV",
        hubCategory: "anwendung",
        archiv: true,
        schemaType: "CollectionPage", datePublished: "2026-09-27",
        about: ["Funksprüche", "Übungstexte", "Rettungsdienst"],
        faq: [
            {
                q: "Was bedeuten SK I bis SK IV in den Nachrichten?",
                a: "Die Sichtungskategorien: SK I rot für sofortige Behandlung, SK II gelb für dringende, SK III grün für spätere Behandlung, SK IV blau für abwartende Behandlung. Tote werden getrennt gemeldet."
            },
            {
                q: "Warum stehen Status-Meldungen als eigene Zeilen in der Vorlage?",
                a: "Im Einsatz laufen sie über die Statustaste des Funkmeldesystems. In der Übung gesprochen üben sie die Kürze: Status 4 am Einsatzort, Status 7 Patient aufgenommen, Status 8 am Transportziel, Status 1 wieder einsatzbereit."
            },
            {
                q: "Stammen die Nachrichten aus einem echten Einsatz?",
                a: "Nein. Die Vorlage wurde für den Generator geschrieben, mit dem Fachprofil der Organisation und den Regeln des BOS-Sprechfunks. Orts- und Straßennamen sind erfunden. Korrekturen aus der Praxis nimmt das Projekt gern an."
            }
        ]
    }
];
