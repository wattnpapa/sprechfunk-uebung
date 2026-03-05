import type { Firestore } from "firebase/firestore";
import { TeilnehmerController } from "./index";

export async function initTeilnehmer(db: Firestore): Promise<void> {
    const controller = new TeilnehmerController(db);
    await controller.init();

    const area = document.getElementById("teilnehmerArea");
    if (area) {
        area.style.display = "block";
    }
}
