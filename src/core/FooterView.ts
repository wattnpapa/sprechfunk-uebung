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

    public bindAnalyticsConsent(getState: () => boolean, setState: (enabled: boolean) => void): void {
        const btn = document.getElementById("analyticsConsentToggle") as HTMLButtonElement | null;
        if (!btn) {
            return;
        }

        const render = () => {
            const enabled = getState();
            btn.textContent = enabled ? "Analytics: an" : "Analytics: aus";
            btn.setAttribute("aria-pressed", enabled ? "true" : "false");
        };

        btn.addEventListener("click", () => {
            setState(!getState());
            render();
        });
        render();
    }
}

