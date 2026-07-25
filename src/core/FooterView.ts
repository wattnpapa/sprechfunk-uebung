export class FooterView {
    public setVersion(version: string): void {
        const versionEl = document.getElementById("version");
        if (versionEl) {
            versionEl.textContent = version;
        }
    }

    public setUebungId(uebungId: string): void {
        const idEl = document.getElementById("uebungsId");
        if (idEl) {
            idEl.textContent = uebungId;
        }
    }
}

