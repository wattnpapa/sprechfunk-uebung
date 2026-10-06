# Verlauf der THW-Reviewer-Läufe

Summe der Befunde über alle elf THW-Reviewer je Lauf. Ein Befund, den mehrere
Reviewer unabhängig finden, zählt mehrfach – in jedem Lauf gleich, damit die
Zeilen vergleichbar bleiben. Berichte: `docs/reviews/<datum>-thw/`.

## Gesamt

| Lauf | Datum | Stand | P0 | P1 | P2 | P3 | Summe |
|---|---|---|---|---|---|---|---|
| R1 | 2026-10-04 | 7c2adb1 | 4 | 30 | 52 | 24 | 110 |
| R2 | 2026-10-05 | de8309c | 0 | 8 | 29 | 48 | 85 |
| R3 | 2026-10-06 | b6f025d | 0 | 4 | 19 | 50 | 73 |

## Je Kategorie (P0 / P1 / P2 / P3)

| Reviewer | R1 | R2 | R3 |
|---|---|---|---|
| analog-first | 0 / 1 / 4 / 2 | 0 / 0 / 2 / 5 | 0 / 0 / 1 / 2 |
| command | 0 / 3 / 6 / 3 | 0 / 0 / 3 / 4 | 0 / 0 / 1 / 5 |
| destructive-action | 2 / 2 / 2 / 1 | 0 / 1 / 2 / 3 | 0 / 2 / 2 / 3 |
| error-recovery | 0 / 3 / 6 / 2 | 0 / 0 / 2 / 4 | 0 / 0 / 1 / 3 |
| field-user | 0 / 4 / 5 / 2 | 0 / 0 / 4 / 5 | 0 / 0 / 1 / 7 |
| glove-touch | 0 / 3 / 4 / 2 | 0 / 1 / 4 / 4 | 0 / 0 / 4 / 5 |
| new-user | 0 / 3 / 7 / 3 | 0 / 0 / 2 / 7 | 0 / 0 / 1 / 7 |
| night-visibility | 0 / 0 / 5 / 4 | 0 / 1 / 1 / 5 | 0 / 0 / 2 / 4 |
| offline-resilience | 2 / 3 / 4 / 1 | 0 / 4 / 2 / 4 | 0 / 1 / 2 / 5 |
| stress-test | 0 / 4 / 5 / 2 | 0 / 1 / 3 / 2 | 0 / 1 / 2 / 2 |
| workflow | 0 / 4 / 4 / 2 | 0 / 0 / 4 / 5 | 0 / 0 / 2 / 7 |

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

## Abgleich R3 gegen R2

| Reviewer | behoben | teilweise | offen | nicht prüfbar |
|---|---|---|---|---|
| analog-first | 7 | 0 | 0 | 0 |
| command | 6 | 1 | 0 | 0 |
| destructive-action | 3 | 3 | 0 | 0 |
| error-recovery | 6 | 0 | 0 | 0 |
| field-user | 5 | 3 | 1 | 0 |
| glove-touch | 4 | 5 | 0 | 0 |
| new-user | 5 | 4 | 0 | 0 |
| night-visibility | 6 | 1 | 0 | 0 |
| offline-resilience | 8 | 2 | 0 | 0 |
| stress-test | 5 | 1 | 0 | 0 |
| workflow | 6 | 2 | 1 | 0 |
| **Summe** | **61** | **22** | **2** | **0** |
