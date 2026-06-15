# ADR 0001: Przejściowy kernel modułów klasycznych

## Status

Przyjęte.

## Kontekst

Projekt był jednym klasycznym skryptem. Jednoczesne przejście na bundler, moduły ES, nowe biblioteki i podział domeny zwiększałoby obszar ryzyka do poziomu trudnego do zweryfikowania.

## Decyzja

Wprowadzić mały kernel `VAW.define/VAW.require`, działający zarówno z plików klasycznych, jak i w buildzie jednoplikowym.

## Konsekwencje

Korzyści:

- jawne zależności;
- wykrywanie cykli i duplikatów;
- stopniowe wycinanie monolitu;
- brak zmiany sposobu dystrybucji.

Koszty:

- rozwiązanie nie jest docelowym standardem modułów;
- globalny most nadal istnieje;
- kolejność skryptów nadal ma znaczenie.

## Warunek usunięcia

Kernel może zostać zastąpiony modułami ES po wyodrębnieniu modelu konstrukcji, kompilatora i adaptera fizyki oraz po wprowadzeniu powtarzalnego bundla zależności.
