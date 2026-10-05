# Verlauf der THW-Reviewer-Läufe

Summe der Befunde über alle elf THW-Reviewer je Lauf. Ein Befund, den mehrere
Reviewer unabhängig finden, zählt mehrfach – in jedem Lauf gleich, damit die
Zeilen vergleichbar bleiben. Berichte: `docs/reviews/<datum>-thw/`.

## Gesamt

| Lauf | Datum | Stand | P0 | P1 | P2 | P3 | Summe |
|---|---|---|---|---|---|---|---|
| R1 | 2026-10-04 | 7c2adb1 | 4 | 30 | 52 | 24 | 110 |
| R2 | 2026-10-05 | de8309c | 0 | 8 | 29 | 48 | 85 |

## Je Kategorie (P0 / P1 / P2 / P3)

| Reviewer | R1 | R2 |
|---|---|---|
| analog-first | 0 / 1 / 4 / 2 | 0 / 0 / 2 / 5 |
| command | 0 / 3 / 6 / 3 | 0 / 0 / 3 / 4 |
| destructive-action | 2 / 2 / 2 / 1 | 0 / 1 / 2 / 3 |
| error-recovery | 0 / 3 / 6 / 2 | 0 / 0 / 2 / 4 |
| field-user | 0 / 4 / 5 / 2 | 0 / 0 / 4 / 5 |
| glove-touch | 0 / 3 / 4 / 2 | 0 / 1 / 4 / 4 |
| new-user | 0 / 3 / 7 / 3 | 0 / 0 / 2 / 7 |
| night-visibility | 0 / 0 / 5 / 4 | 0 / 1 / 1 / 5 |
| offline-resilience | 2 / 3 / 4 / 1 | 0 / 4 / 2 / 4 |
| stress-test | 0 / 4 / 5 / 2 | 0 / 1 / 3 / 2 |
| workflow | 0 / 4 / 4 / 2 | 0 / 0 / 4 / 5 |

## Abgleich R2 gegen R1 (Status der Befunde aus R1, selbst nachgeprüft)

| Reviewer | behoben | teilweise | offen | nicht prüfbar |
|---|---|---|---|---|
| analog-first | 5 | 2 | 0 | 0 |
| command | 7 | 4 | 1 | 0 |
| destructive-action | 5 | 2 | 0 | 0 |
| error-recovery | 9 | 2 | 0 | 0 |
| field-user | 7 | 3 | 1 | 0 |
| glove-touch | 4 | 5 | 0 | 0 |
| new-user | 9 | 3 | 1 | 0 |
| night-visibility | 7 | 2 | 0 | 0 |
| offline-resilience | 5 | 4 | 0 | 1 |
| stress-test | 12 | 0 | 0 | 0 |
| workflow | 6 | 4 | 0 | 0 |
| **Summe** | **76** | **31** | **3** | **1** |
