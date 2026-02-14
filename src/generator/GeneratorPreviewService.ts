import { FunkUebung } from "../models/FunkUebung";
import { UebungHTMLGenerator } from "../services/UebungHTMLGenerator";

export interface PreviewPage {
    html: string;
    index: number;
    total: number;
}

export class GeneratorPreviewService {
    private pages: string[] = [];
    private currentIndex = 0;

    generate(uebung: FunkUebung): void {
        this.pages = uebung.teilnehmerListe.map(t =>
            UebungHTMLGenerator.generateHTMLPage(t, uebung)
        );
        this.currentIndex = 0;
    }

    getCurrent(): PreviewPage | null {
        return this.getAt(this.currentIndex);
    }

    getAt(index: number): PreviewPage | null {
        if (index < 0 || index >= this.pages.length) {
            return null;
        }
        const html = this.pages[index];
        if (!html) {
            return null;
        }
        this.currentIndex = index;
        return { html, index, total: this.pages.length };
    }

    change(step: number): PreviewPage | null {
        return this.getAt(this.currentIndex + step);
    }
}
