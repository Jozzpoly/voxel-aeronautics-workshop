# ADR 0008 — Wejście pilota używa semantycznych osi

- Status: Accepted
- Milestone: Foundation Phase 1C

## Kontekst

Rozproszone warunki klawiatury mieszały kierunki obrotu z translacją. Utrudniało to poprawę A/D, dodanie góra/dół oraz późniejszy gamepad lub programowalny kontroler.

## Decyzja

Runtime operuje na akcjach `pitch`, `yaw`, `roll`, `surge` i `lift`. Mapowanie klawiatury i przycisków mobilnych znajduje się w `foundation.flight-control`.

W trybie FLIGHT wejścia sterowania mają pierwszeństwo nad skrótami edytora.

## Konsekwencje

- Wiele osi może działać jednocześnie.
- Left Ctrl + S oznacza dół + tył.
- Przyszły gamepad, autopilot i graf sygnałów mogą zasilać ten sam kontrakt.
- Znaki osi muszą być zabezpieczone testami zachowania, nie tylko opisem UI.
