# ADR 0005: Versionierte Firestore-Regeln ohne Authentifizierung

## Status
Accepted

## Context

Die Firestore-Regeln lagen bisher ausschließlich in der Firebase-Console. Im Repository war damit
nicht nachvollziehbar, wer Übungen lesen, ändern oder löschen darf — und Änderungen daran liefen an
Review und CI vorbei.

Die Anwendung besitzt keine Authentifizierung. Generator, Teilnehmeransicht, Übungsleitung und Admin
sind reine Client-Routen. Regeln können deshalb keinen Aufrufer unterscheiden: Für Firestore sind
alle Zugriffe anonym und gleichberechtigt.

Zusätzlich lud das Admin-Dashboard die komplette Collection `uebungen`, um Kennzahlen zu summieren.
Jede unbegrenzte `list`-Abfrage kostet einen Read pro Dokument und wächst linear mit dem Bestand.

## Decision

- `firestore.rules`, `firestore.indexes.json` und `firebase.json` werden versioniert; Deploy über
  `firebase deploy --only firestore`.
- Die Regeln beschränken sich auf das, was ohne Identitätsbegriff möglich ist:
  - Nur `/uebungen/{uebungId}` ist überhaupt erreichbar, Unterkollektionen sind gesperrt.
  - Schreibzugriffe werden gegen eine Feld-Allowlist (`hasOnly`), Pflichtfelder, Typen,
    Stringlängen und Listengrößen geprüft.
  - Die Dokument-ID muss zum Feld `id` passen und darf bei Updates nicht wechseln.
- Lesen und Löschen bleiben offen. Das ist ein bewusst getragenes Restrisiko, kein Versehen.
- Das Admin-Dashboard rechnet über Aggregations-Queries (`count()`, `sum()`) auf denormalisierten
  `stat*`-Feldern, die beim Speichern mitgeschrieben werden, statt Dokumente zu laden.

## Consequences

- Änderungen am Zugriffsmodell sind reviewbar und nachvollziehbar.
- Die Feld-Allowlist ist eine Bruchstelle: Ein neu persistiertes Feld ohne Eintrag in
  `erlaubteFelder()` lässt Firestore jedes Speichern ablehnen.
  `tests/services/FirestoreRules.contract.test.ts` vergleicht die Liste deshalb gegen das, was
  `FirebaseService` tatsächlich schreibt.
- Wer den öffentlichen API-Key besitzt, kann weiterhin sämtliche Übungen abziehen und löschen. Der
  Übungscode (z. B. `K7M4Q2`) schützt nicht den Zugriff, er macht eine Übung nur auffindbar.
  In Übungen gehören daher keine personenbezogenen oder sonst schützenswerten Daten.
- Übungen aus der Zeit vor den `stat*`-Feldern fehlen in den Kennzahlen, bis
  `scripts/backfill-stat-felder.mjs --apply` gelaufen ist. Weil die Regeln beim Update das
  ganze Dokument prüfen, trägt das Skript bei Altübungen ohne `uebungCode`/`teilnehmerIds`
  auch diese Pflichtfelder nach – sonst würde Firestore jede Änderung an ihnen ablehnen.

## Nicht gewählt

- **Anonyme Firebase-Auth plus Custom Claim für die Admin-Rolle.** Das wäre die einzige Variante, in
  der `delete` nicht weltoffen ist, verlangt aber einen Login-Pfad im Client und ein Verfahren zum
  Setzen des Claims. Bleibt der nächste sinnvolle Schritt, zusammen mit App Check.
- **Zähler-Dokument per Cloud Function.** Günstigste Reads, erfordert aber ein `functions/`-Deployment,
  den Blaze-Plan und eigene Konsistenzlogik. Die Aggregations-Queries lösen dasselbe Problem
  clientseitig ohne neue Infrastruktur.
