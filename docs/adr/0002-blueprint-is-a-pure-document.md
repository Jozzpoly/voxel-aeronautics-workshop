# ADR 0002: Blueprint jest czystym dokumentem domenowym

## Status

Przyjęte.

## Kontekst

Format zapisu, walidacja, migracje i stan edytora były splecione z globalnym runtime oraz sceną.

## Decyzja

Blueprint jest zwykłym dokumentem danych, który można tworzyć, walidować, klonować i migrować bez DOM, renderera i świata fizyki.

## Inwarianty

- maksymalnie jeden Core;
- Core znajduje się w `0,0,0`;
- wszystkie bloki są połączone ścianami z Core;
- brak powtarzających się pozycji;
- współrzędne są całkowite i mieszczą się w siatce;
- typ bloku istnieje w katalogu;
- przyszłe nieznane wersje są odrzucane;
- wynik posiada znormalizowane sterowanie i orientację.

## Konsekwencje

Kompilator konstrukcji i przyszły serwer multiplayer będą mogły przyjmować ten sam dokument bez zależności od edytora.
