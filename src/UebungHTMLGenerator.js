import { DateFormatter } from "./DateFormatter.js";
export class UebungHTMLGenerator {
    /**
     * Erstellt eine HTML-Seite für einen einzelnen Teilnehmer der Übung.
     * @param {Object} teilnehmerDaten - Die Daten des Teilnehmers (inkl. Kopfdaten, Nachrichten und Lösungswort).
     * @returns {string} HTML-Code als String.
     */
    static generateHTMLPage(teilnehmer, funkUebung) {
        const teilnehmerListeHTML = funkUebung.teilnehmerListe
            .map(name => `<tr><td>${name}</td></tr>`)
            .join("");
        
        const nachrichtenHTML = funkUebung.nachrichten[teilnehmer]
            .map(n => 
                `<tr>
                    <td>${n.id}</td>
                    <td>${n.empfaenger.join("<br/>").replace(/ /g, "&nbsp;")}</td>
                    <td>${n.nachricht}</td>
                </tr>`)
            .join("");

        return `<!DOCTYPE html>
<html lang="de">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Sprechfunkübung - ${teilnehmer}</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .container { max-width: 100%; margin: auto; }
        h1, h2 { text-align: center; }
        h1 { font-size: 22px; font-weight: bold; }
        h2 { font-size: 18px; font-weight: bold; }
        table { width: 100%; border-collapse: collapse; margin-top: 20px; }
        th, td { border: 1px solid black; padding: 8px; text-align: left; }
        th { background-color: #f2f2f2; }
        .row { display: flex; justify-content: space-between; margin-top: 20px; }
        .col { width: 48%; }
        @media (max-width: 768px) {
            .row { flex-direction: column; }
            .col { width: 100%; margin-bottom: 15px; }
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>Sprechfunkübung ${funkUebung.name}</h1>
        <h2>Eigener Funkrufname: ${teilnehmer}</h2>

        <div class="row">
            <div class="col">
                <h3>Kopfdaten</h3>
                <table>
                    <tr><th>Datum</th><td>${DateFormatter.formatNATODate(funkUebung.datum,false)}</td></tr>
                    <tr><th>Rufgruppe</th><td>${funkUebung.rufgruppe}</td></tr>
                    <tr><th>Betriebsleitung</th><td>${funkUebung.leitung}</td></tr>
                    ${funkUebung.loesungswoerter[teilnehmer] ? `<tr><th>Lösungswort</th><td>${funkUebung.loesungswoerter[teilnehmer]}</td></tr>` : ''}
                </table>
            </div>

            <div class="col">
                <h3>Teilnehmer</h3>
                <table>${teilnehmerListeHTML}</table>
            </div>
        </div>

        <h3>Folgende Nachrichten sind zu übermitteln:</h3>
        <table>
            <thead>
                <tr>
                    <th style="width: 10%;">Nr.</th>
                    <th style="width: 20%;">Empfänger</th>
                    <th style="width: 70%;">Nachrichtentext</th>
                </tr>
            </thead>
            <tbody>${nachrichtenHTML}</tbody>
        </table>
    </div>
</body>
</html>`;
    }
}