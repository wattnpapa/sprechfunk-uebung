# Firestore Backup / Restore Playbook

## Ziel
Regelmaessige Sicherung und getestete Wiederherstellung der Collection `uebungen`.

## Voraussetzungen
- `firebase-tools` installiert und eingeloggt (`firebase login`)
- Zugriff auf Projekt `sprechfunk-uebung`
- Service Account in CI (optional, empfohlen fuer automatisierte Backups)

## Backup (manuell)
1. Export-Verzeichnis erstellen:
   - `mkdir -p backups/firestore`
2. Export ausfuehren:
   - `firebase firestore:export gs://<BUCKET_NAME>/firestore-backups/$(date +%Y%m%d-%H%M%S) --project sprechfunk-uebung`
3. Export-Pfad im Admin-Log dokumentieren.

## Restore (manuell)
1. Wartungsfenster ankundigen (Schreibzugriffe stoppen).
2. Import starten:
   - `firebase firestore:import gs://<BUCKET_NAME>/firestore-backups/<EXPORT_FOLDER> --project sprechfunk-uebung`
3. App smoke-testen:
   - Generator laden
   - Admin-Statistik pruefen
   - Eine Uebung in Uebungsleitung/Teilnehmer oeffnen

## Restore-Test (Quartalsweise)
1. In separates Testprojekt importieren.
2. Integritaet pruefen:
   - Dokumentanzahl in `uebungen`
   - Stichprobe: `teilnehmerListe`, `nachrichten`, `buildVersion`
3. Ergebnis im Repo dokumentieren (`docs/ops-log.md` oder Issue).

## RPO / RTO (Vorschlag)
- RPO: 24h (taeglicher Backup-Job)
- RTO: 60 Minuten

