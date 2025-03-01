export class DateFormatter {
    /**
     * Formatiert ein Datum im NATO-Format (z.B. "250830MAR24" oder "25MAR24").
     * @param {Date} date - Das zu formatierende Datum.
     * @param {boolean} withTime - Falls `true`, wird die Zeit (HHMM) mit ausgegeben.
     * @returns {string} - Das formatierte NATO-Datum.
     */
    static formatNATODate(date, withTime = true) {
        const monate = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

        let tag = String(date.getDate()).padStart(2, "0");  // Tag zweistellig
        let stunde = String(date.getHours()).padStart(2, "0"); // Stunden zweistellig
        let minute = String(date.getMinutes()).padStart(2, "0"); // Minuten zweistellig
        let monat = monate[date.getMonth()]; // Monat in Großbuchstaben
        let jahr = String(date.getFullYear()).slice(-2); // Zweistellige Jahreszahl

        if (withTime) {
            return `${tag}${stunde}${minute}${monat}${jahr}`;
        }
        return `${tag}${monat}${jahr}`;
    }
}

const dateFormatter = new DateFormatter();
export default dateFormatter;