# ADR 0018 — Desktop input and aerostatic settling

## Status

Superseded in its fixed-key decision by ADR 0019; desktop scope and aerostatic settling remain accepted.

## Context

`Left Ctrl` jako zejście pozwalał tworzyć skróty z innymi klawiszami lotu. `Ctrl+W` zamyka kartę, a `Ctrl+Page Up/Page Down` przełącza karty. Próba przechwytywania tych skrótów nie jest wiarygodna ani właściwa.

Równocześnie mobilne przyciski i gesty nie dawały kontroli wystarczającej dla sześciu osi statku. Ich utrzymywanie zwiększało złożoność i tworzyło fałszywą obietnicę wsparcia telefonu.

Balony miały poprawny spadek siły z wysokością, ale przy małym oporze pionowym statek długo oscylował wokół wysokości równowagi.

## Decision

1. Platformą bazową jest desktop z klawiaturą i myszą.
2. `Shift` steruje zejściem, `Space` wznoszeniem.
3. `Comma/Period` regulują Balloon power.
4. [Superseded by ADR 0019] This phase temporarily excluded Ctrl, Meta, Page Up and Page Down from fixed bindings.
5. Telefon i touch-only są poza zakresem głównego runtime.
6. Balony dodają ograniczone tłumienie pionowe zależne od aktywnej siły, ale nie od błędu wysokości.

## Consequences

- znikają konflikty ze skrótami przeglądarki;
- równoczesne osie nadal działają;
- kod wejścia i UI jest prostszy;
- użytkownik telefonu dostaje jasny komunikat zamiast półdziałającej kontroli;
- balony szybciej wygaszają oscylację, lecz nie utrzymują automatycznie wysokości;
- przyszłe wsparcie handheldów wymaga osobnego profilu kontrolera i decyzji UX.


## Supersession

ADR 0019 restores Left Ctrl as the default through a versioned rebinding system and adds optional Flight Focus. The earlier prohibition on Ctrl/Shift choice is no longer active.
