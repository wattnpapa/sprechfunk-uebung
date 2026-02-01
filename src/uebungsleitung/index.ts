
// src/uebungsleitung/index.ts

import { doc, getDoc } from "firebase/firestore";
import type { Firestore } from "firebase/firestore";

import { loadUebungsleitungStorage } from "../storage";
import { renderTeilnehmerListe } from "./teilnehmer/teilnehmer.render";
import { buildNachrichtenliste, renderNachrichtenliste } from "../nachrichten/nachrichten.render";
import { formatNatoDate } from "../utils/date";

/**
 * Erwarteter Hash:
 *   #/uebungsleitung/<uebungsId>
 */
function getUebungIdFromHash(): string | null {
  const hash = window.location.hash.replace(/^#\/?/, "");
  const parts = hash.split("/");

  if (parts[0] !== "uebungsleitung") return null;
  return parts[1] ?? null;
}

export async function initUebungsleitung(db: Firestore): Promise<void> {
  const area = document.getElementById("uebungsleitungArea");
  const metaEl = document.getElementById("uebungsleitungMeta");

  if (!area || !metaEl) return;

  const uebungId = getUebungIdFromHash();

  if (!uebungId) {
    metaEl.innerHTML = `<div class="alert alert-danger">Keine Übungs-ID angegeben.</div>`;
    return;
  }

  try {
    // Übung laden
    const ref = doc(db, "uebungen", uebungId);
    const snap = await getDoc(ref);

    if (!snap.exists()) {
      metaEl.innerHTML = `<div class="alert alert-warning">Übung nicht gefunden.</div>`;
      return;
    }

    const u: any = snap.data();

    (window as any).__AKTUELLE_UEBUNG__ = u;
    (window as any).__AKTUELLE_UEBUNG_ID__ = uebungId;

    // Storage initialisieren
    loadUebungsleitungStorage(uebungId);

    // Bereich sichtbar
    area.style.display = "block";



    // Kopfdaten
    metaEl.innerHTML = `
      <div class="row">
        <div class="col-md-6 mb-2">
          <strong>Name der Übung:</strong><br>${u.name || "–"}
        </div>
        <div class="col-md-6 mb-2">
          <strong>Datum:</strong><br>${formatNatoDate(u.datum)}
        </div>
        <div class="col-md-6 mb-2">
          <strong>Rufgruppe:</strong><br>${u.rufgruppe || "–"}
        </div>
        <div class="col-md-6 mb-2">
          <strong>Übungsleitung:</strong><br>${u.leitung || "–"}
        </div>
        <div class="col-md-6 mb-2">
          <strong>Anzahl Teilnehmer:</strong><br>${u.teilnehmerListe?.length ?? 0}
        </div>
        <div class="col-md-6 mb-2">
          <strong>Übungs-ID:</strong><br><code>${uebungId}</code>
        </div>
        <div class="col-12 mt-3 d-flex justify-content-end">
        <button
          class="btn btn-outline-secondary"
          id="exportUebungsleitungPdf">
          📄 Übungsleitung als PDF
        </button>

          <button
            class="btn btn-outline-danger"
            id="resetUebungsleitungLocalData">
            ⟲ Lokale Übungsdaten zurücksetzen
          </button>
        </div>
        
      </div>
    `;

    const pdfBtn = document.getElementById(
        "exportUebungsleitungPdf"
    ) as HTMLButtonElement | null;

    if (pdfBtn) {
      pdfBtn.addEventListener("click", async () => {
        try {
          const uebung = (window as any).__AKTUELLE_UEBUNG__;

          if (!uebung) {
            alert("Keine Übung geladen.");
            return;
          }

          // @ts-ignore
          const { jsPDF } = await import("jspdf");
          const { Uebungsleitung } = await import("../pdf/Uebungsleitung");

          const pdf = new jsPDF({
            orientation: "landscape",
            unit: "mm",
            format: "a4"
          });

          const pdfDoc = new Uebungsleitung(uebung, pdf);
          pdfDoc.draw();

          const filename =
              `Uebungsleitung_${uebung.name}_${uebung.id}.pdf`
                  .replace(/\s+/g, "_");

          pdf.save(filename);

        } catch (err) {
          console.error("❌ Fehler beim PDF-Export:", err);
          alert("Fehler beim Erstellen der PDF.");
        }
      });
    }

    const resetBtn = document.getElementById(
        "resetUebungsleitungLocalData"
    ) as HTMLButtonElement | null;

    if (resetBtn) {
      resetBtn.addEventListener("click", () => {
        const ok = confirm(
            "Willst du wirklich ALLE lokalen Übungsdaten zurücksetzen?\n\n" +
            "Teilnehmer-Status, Nachrichten und Notizen gehen verloren."
        );

        if (!ok) return;

        localStorage.removeItem(`sprechfunk:uebungsleitung:${uebungId}`);

        console.warn("[RESET] Lokale Übungsdaten gelöscht", uebungId);

        // Seite neu initialisieren (sauberster Zustand)
        window.location.reload();
      });
    }

    // Teilnehmer
    renderTeilnehmerListe(
      uebungId,
      u.teilnehmerListe || [],
      u.loesungswoerter || {},
      u.loesungsStaerken || {}
    );

    // Nachrichten
    const nachrichten = buildNachrichtenliste(u);
    renderNachrichtenliste(nachrichten);

  } catch (err) {
    console.error("❌ Fehler beim Laden der Übung:", err);
    metaEl.innerHTML = `<div class="alert alert-danger">Fehler beim Laden der Übung.</div>`;
  }
}