# ADR 0002: Blueprint jest czystym dokumentem domenowym

## Status

Częściowo zastąpione przez ADR 0006 dla blueprintów v8. Zasady Core w początku i stałej spójności obowiązują wyłącznie migracje v3–v7.

## Kontekst

Format zapisu, walidacja, migracje i stan edytora były splecione z globalnym runtime oraz sceną.

## Decyzja

Blueprint jest zwykłym dokumentem danych, który można tworzyć, walidować, klonować i migrować bez DOM, renderera i świata fizyki.

## Inwarianty

- maksymalnie jeden Core;
- dla dokumentów v3–v7 Core znajduje się w `0,0,0`;
- dla dokumentów v3–v7 wszystkie bloki są połączone ścianami z Core;
- dokument v8 może być pusty, bez Core lub chwilowo rozłączony;
- v8 dopuszcza maksymalnie jeden Core w dowolnej pozycji;
- brak powtarzających się pozycji;
- współrzędne są całkowite i mieszczą się w siatce;
- typ bloku istnieje w katalogu;
- przyszłe nieznane wersje są odrzucane;
- wynik posiada znormalizowane sterowanie i orientację.

## Konsekwencje

Kompilator konstrukcji i przyszły serwer multiplayer będą mogły przyjmować ten sam dokument bez zależności od edytora.
