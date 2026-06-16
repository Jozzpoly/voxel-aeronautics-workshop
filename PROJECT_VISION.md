# Wizja projektu — Voxel Aeronautics Workshop

## Jednozdaniowa obietnica

**Zbuduj maszynę blok po bloku, nadaj jej zachowanie, uruchom ją w uczciwej fizyce i zrozum, dlaczego działa albo się rozpada.**

## Dusza projektu

Voxel Aeronautics Workshop nie ma być wyłącznie grą o przechodzeniu kontraktów ani demonstracją fizyki. Ma być cyfrowym warsztatem, w którym sama konstrukcja, eksperyment i ręczne latanie są nagrodą.

Podstawowa pętla:

```text
pomysł
-> swobodne budowanie
-> proste sterowanie ręczne
-> test w świecie
-> obserwacja zachowania i awarii
-> analiza
-> przebudowa
-> stopniowa automatyzacja
```

Programowanie nie zastępuje budowania ani pilotażu. Pozwala graczowi przechodzić od prostego przypisania przycisku do urządzenia, przez grupy i regulatory, aż do rozbudowanych zachowań maszyny.

## Nienaruszalne filary doświadczenia

### 1. Sandbox przed checklistą

Kontrakty, gwiazdki i progresja mogą uczyć, inspirować i stawiać wyzwania. Nie mogą być warunkiem sensownego korzystania z warsztatu. Gracz ma móc budować i testować własne pomysły bez pytania gry o zgodę.

### 2. Dowolny pierwszy blok

Warsztat nie narzuca startowego klocka ani gotowej bryły. Możliwa jest konstrukcja jednego bloku szerokości, wysoka rakieta, asymetryczny prototyp albo mechanizm, który nie ma jeszcze Core. Wymagania dotyczą uruchomienia, nie samego procesu twórczego.

### 3. Trwała tożsamość części

`blockId` oznacza konkretny blok lub urządzenie. Przesunięcie nie zmienia jego tożsamości; kopiowanie tworzy nową. Konfiguracja, porty, połączenia i diagnostyka odnoszą się do trwałych identyfikatorów, nigdy do samych współrzędnych.

### 4. Manualne sterowanie pozostaje pełnoprawne

Gracz nie musi programować maszyny, aby dobrze się bawić. Domyślny mikser i sensowne sterowanie sześcioma osiami mają zapewniać szybki test. Zaawansowane programowanie ma być możliwością przejęcia kontroli, nie obowiązkową barierą wejścia.

### 5. Programowanie rośnie warstwami

Docelowa drabina złożoności:

1. domyślne zachowanie;
2. bezpośrednie przypisanie akcji/przycisku;
3. grupy urządzeń, gain, invert, trim i clamp;
4. wizualny graf sygnałów;
5. sensory, pamięć, PID i reusable behavior modules;
6. zaawansowane skrypty dopiero po bezpiecznym, deterministycznym API.

Każdy poziom musi być użyteczny samodzielnie.

### 6. Fizyka jest czytelna, nie arbitralna

Maszyna może być niestabilna, za ciężka, źle wyważona albo uszkodzona, ale gracz powinien móc zrozumieć przyczynę. Analiza, telemetry, scope i diagnostyka są częścią rdzenia rozgrywki, a nie późniejszym dodatkiem kosmetycznym.

### 7. Mechanika, sygnały i konstrukcja są osobnymi grafami

- structural graph określa sztywne wyspy;
- mechanical graph łączy wyspy jointami;
- signal graph łączy porty urządzeń;
- control bindings wprowadzają akcje gracza lub kontrolerów;
- cable/bus/wireless określa transport i dostępność.

Żadna z tych warstw nie może potajemnie zastąpić pozostałych.

### 8. Maszyna może żyć w wielu lokalnych przestrzeniach

Sublevel/assembly space jest stabilną lokalną przestrzenią poruszającej się konstrukcji. Nie jest drugim blueprintem. Split, detach, docking i jointy zmieniają ownership runtime, ale nie mogą losowo niszczyć tożsamości bloków i urządzeń.

### 9. Awaria jest stanem systemu, nie skryptowaną karą

Oderwany silnik przestaje wykonywać komendy, zerwany kabel przestaje przenosić sygnał, a brak endpointu tworzy diagnostykę. Gra nie powinna po cichu przepinać urządzeń ani udawać, że uszkodzony mechanizm nadal istnieje.

### 10. Projekt ma rosnąć bez kolejnych restartów

Nowe funkcje mają przechodzić przez stabilne granice: domenę, kompilację, runtime, port fizyki i prezentację. Refaktor jest uzasadniony wtedy, gdy usuwa błędne ownership lub umożliwia przyszły kierunek, a nie tylko zmienia nazwy plików.

## Docelowe typy maszyn

Architektura nie może być zakodowana wyłącznie pod jeden statek. Powinna wspierać:

- rakiety i lądowniki;
- sterowce i balony;
- samoloty, drony i helikoptery;
- samochody i pojazdy wielokołowe;
- obrotowe gondole, wirniki, składane skrzydła i manipulatory;
- maszyny hybrydowe oraz eksperymentalne konstrukcje gracza.

## Czego projekt nie powinien robić

- wymagać skryptowania do prostego włączenia silnika;
- wiązać konfiguracji maszyny z fizycznym układem klawiatury użytkownika;
- przechowywać natywnych obiektów Three/Cannon w blueprintach;
- utożsamiać kabla z semantyką sygnału;
- utrwalać założenia `craft = jedno body`;
- ukrywać błędów połączeń przez automatyczne zgadywanie;
- podnosić limitów bez benchmarku realnego solvera;
- podporządkowywać całego sandboxu kontraktom i progresji;
- dodawać szerokiego API „na przyszłość” bez capability spike i testów.

## Kryterium sukcesu

Projekt osiąga swoją właściwą tożsamość wtedy, gdy gracz może:

1. zbudować nietypową wielobryłową maszynę;
2. uruchomić ją domyślnym sterowaniem;
3. wskazać konkretne urządzenie i zobaczyć jego porty;
4. przypisać prostą akcję bez tworzenia grafu;
5. później zastąpić to połączeniem, sensorem lub regulatorem;
6. zobaczyć live values oraz przyczynę niesprawnego linku;
7. uszkodzić lub rozdzielić maszynę bez utraty logicznej tożsamości ocalałych części;
8. zapisać, wczytać i dalej rozwijać projekt bez migracyjnych niespodzianek.
