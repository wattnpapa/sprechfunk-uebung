import { initializeApp, getApps, type FirebaseOptions, type FirebaseApp } from "firebase/app";
import { connectFirestoreEmulator, getFirestore, type Firestore } from "firebase/firestore";

interface FirebaseClientState {
    app: FirebaseApp | null;
    db: Firestore | null;
    emulatorConnected: boolean;
}

const state: FirebaseClientState = {
    app: null,
    db: null,
    emulatorConnected: false
};

function shouldUseEmulator(): boolean {
    if (typeof window === "undefined") {
        return false;
    }
    const search = window.location?.search ?? "";
    const byQuery = new URLSearchParams(search).get("emulator") === "1";
    let byStorage = false;
    try {
        byStorage = window.localStorage.getItem("useFirestoreEmulator") === "1";
    } catch {
        byStorage = false;
    }
    return byQuery || byStorage;
}

export function initFirebaseClient(config: FirebaseOptions): Firestore {
    if (!state.app) {
        state.app = getApps()[0] ?? initializeApp(config);
    }
    if (!state.db) {
        state.db = getFirestore(state.app);
    }
    if (!state.emulatorConnected && shouldUseEmulator()) {
        connectFirestoreEmulator(state.db, "127.0.0.1", 8080);
        state.emulatorConnected = true;
    }
    return state.db;
}

