> **Dokument historyczny:** ten review opisuje stan sprzed Foundation Phase 1B. Aktualną ocenę fundamentów zawiera `FOUNDATION_REVIEW.md`, a przebieg walidacji `VALIDATION_REPORT.md`.

# Krytyczny code review — Contract Vertical Slice + Structural Control Update

## Zakres

Audyt objął ostatnie dwa etapy jako jeden produkt:

1. system kontraktów, kariery, bramek, stref lądowania i raportu;
2. system lokalnych uszkodzeń, odrywania części, sterów, wektorowania ciągu i przeciążeń.

Sprawdzono nie tylko składnię, ale również zgodność projektu źródłowego z jednoplikowym buildem, zachowanie przy uszkodzeniu dużej konstrukcji, odporność zapisów i koszty obliczeniowe w pętli 120 Hz.

## Najpoważniejsze problemy znalezione podczas audytu

### 1. Rozjazd między ZIP a jednoplikowym buildem — krytyczny

Projekt źródłowy i jednoplikowy HTML nie reprezentowały tej samej wersji interfejsu. ZIP nie zawierał części elementów diagnostycznych obecnych w późniejszym buildzie, a własny test misji projektu źródłowego nie przechodził.

Nie każda brakująca etykieta powodowała natychmiastowy crash, ponieważ część setterów była null-safe, ale wydanie było niespójne i niemożliwe do wiarygodnego reprodukowania.

**Naprawa:** HTML źródłowy został zsynchronizowany, a nowy skrypt wydania zawsze generuje jednoplikowy HTML i ZIP z tych samych plików.

### 2. Oderwanie gałęzi wykonywało wielokrotne przebudowy bryły — krytyczny

Przy utracie kilku połączonych modułów każda część mogła osobno powodować:

- usunięcie collidera;
- przeliczenie masy;
- przesunięcie środka ciężkości;
- aktualizację momentów;
- przebudowę danych runtime.

Koszt pojawiał się dokładnie podczas katastrofy, kiedy wiele modułów odpada jednocześnie.

**Naprawa:** oderwanie jest transakcją. Najpierw wyznaczany jest pełny zestaw części, potem następuje jedno przeliczenie bryły.

### 3. Kontrola przeciążeń miała złożoność O(n²) w 120 Hz — krytyczny

Dla każdej części skanowano całą listę części w celu policzenia sąsiadów. Dla dużej konstrukcji koszt rósł kwadratowo i był ponoszony w każdym podkroku fizyki.

**Naprawa:** mapa `runtimePartByKey`, sześć lookupów na część i osobna częstotliwość kontroli konstrukcji 30 Hz.

### 4. Core mógł zostać zniszczony, a integralność ponownie wzrosnąć — krytyczny

Kod ustawiał integralność na zero przy awarii Core, po czym wspólna funkcja ponownie liczyła procent zdrowia ze wszystkich nadal przyłączonych części. Duży pojazd mógł więc zachować dodatnią integralność mimo zniszczonego modułu dowodzenia.

**Naprawa:** sprawność Core jest warunkiem koniecznym dodatniej integralności.

### 5. Odłamki mogły tworzyć lawinę fizyki — wysoki

Liczba debris nie miała praktycznego limitu, a odłamki mogły zderzać się ze sobą. Duża awaria zwiększała liczbę brył i kontaktów w sposób niekontrolowany.

**Naprawa:** limit 48 fizycznych odłamków, czas życia i wyłączone kolizje debris–debris.

### 6. Bramki można było zaliczać przez bliskość — wysoki

Sfera odległości nie rozróżniała przejścia przez otwór, lotu obok, cofania ani znalezienia się po właściwej stronie bez przekroczenia płaszczyzny.

**Naprawa:** test segment–płaszczyzna z promieniem bramki i kierunkiem przejścia.

### 7. „Zawis” nie wymagał faktycznego zawisu — wysoki

Czas był naliczany po przekroczeniu wysokości nawet podczas szybkiego wznoszenia, opadania lub znacznego przechyłu.

**Naprawa:** zakres wysokości, limity prędkości pionowej i poziomej oraz limit przechyłu.

### 8. Ładunek był masą kontraktową, ale jego stan nie decydował o dostawie — wysoki

Po wprowadzeniu lokalnych uszkodzeń możliwe było dostarczenie prawie zniszczonej skrzyni i otrzymanie pełnego sukcesu.

**Naprawa:** próg integralności ładunku, wpływ na gwiazdki, HUD i debrief.

### 9. Zerowe przesunięcie środka masy omijało część aktualizacji — wysoki

Jeżeli nowy COM po utracie symetrycznych części pozostawał prawie w tym samym miejscu, funkcja mogła pominąć aktualizację niektórych parametrów runtime.

**Naprawa:** masa, najniższy punkt, obwiednia momentu i stan metryk są aktualizowane niezależnie od wielkości przesunięcia COM.

### 10. Dane kariery i blueprintów były zbyt ufne — średni/wysoki

Problemy obejmowały:

- akceptowanie nieznanych przyszłych wersji blueprintu;
- ciche zaokrąglanie współrzędnych;
- arbitralne identyfikatory kontraktów;
- gwiazdki poza zakresem;
- niefinitywne lub ujemne wyniki.

**Naprawa:** normalizacja i whitelisty, odrzucanie nieobsługiwanych wersji oraz ścisłe współrzędne całkowite.

### 11. Historia edytora mogła zużywać ogromną pamięć — średni

80 pełnych kopii blueprintu po 2500 części mogło przechowywać setki tysięcy obiektów.

**Naprawa:** historia zachowuje limit snapshotów i osobny budżet 12 000 zapisanych części na stos.

### 12. Limit konstrukcji nie odpowiadał kosztowi compound body — średni/wysoki

Edytor dopuszcza 2500 modułów, ale Cannon.js tworzy osobny shape na każdy moduł. Bez scalania colliderów taki lot jest niebezpieczny dla stabilności przeglądarki.

**Naprawa:** jawny limit lotu 480 części i diagnostyka. Edycja i zapis większych blueprintów pozostają możliwe. Docelowo należy zastąpić limit scalaniem colliderów.

## Zweryfikowane zachowania, które zachowano

- uszkodzenia kolizyjne są kolejkowane i wykonywane dopiero po `world.step()`;
- warsztat oraz runtime korzystają ze wspólnych danych modułów;
- załadowany snapshot przesuwa COM i momenty silników tak samo jak właściwy lot;
- stery wymagają przepływu powietrza;
- wektorowany silnik generuje moment przez rzeczywiste `r × F`;
- symetria odbija pełną orientację 24-kierunkową;
- import blueprintu jest atomowy i sprawdza spójność z Core.

## Świadomie pozostawione ograniczenia

- Brak automatycznego scalenia sąsiadujących colliderów.
- Brak oddzielnych fizycznych brył połączeń i naprężeń belkowych.
- Brak trwałych kosztów napraw i ekonomii warsztatu.
- Brak lokalnego bundla bibliotek — gra nadal wymaga CDN.
- Brak automatycznego, prawdziwego playtestu WebGL w tym środowisku.
- Model aerodynamiczny pozostaje celowo uproszczony i nie jest CFD.

## Wniosek

Dwa ostatnie etapy miały wartościową zawartość, ale nie były jeszcze bezpieczną podstawą dalszej kampanii. Największe zagrożenia nie dotyczyły pojedynczych błędów wizualnych, lecz reprodukowalności wydania, kwadratowych kosztów fizyki i niespójnej semantyki sukcesu misji.

Po audycie projekt ma jedno źródło prawdy dla artefaktów, kontrolowane koszty katastrof, odporniejsze dane oraz bardziej uczciwe warunki misji.
