# Foundation Convergence Review — Phase 1D.3E

## Mapa ryzyka przed implementacją

| Ryzyko | Baseline 1D.3D | Wynik 1D.3E |
|---|---|---|
| `STATE.flight.body` jako source of truth | aktywnie wspierany przez gameplay paths | tylko deprecated alias; brak aktywnych odczytów |
| `rootBody` jako cały craft | mission/camera/HUD single-body assumptions | primary-body policy i neutral sample |
| native position/quaternion/velocity leakage | game/mission czytały body | neutral RuntimeAssembly/FlightSession API |
| assembly allocation w game shellu | `game.js` wywoływał builder | jedyny produkcyjny callsite w FlightSession |
| global visual root | jedna grupa dla craftu | `visualRootByBodyId` |
| destructive body fallback | missing ownership trafiał do primary | exact error/diagnostic |
| cleanup state-before-backend | ryzyko utraty retry handles | backend-first, maps retained |
| constraint/body ordering | niepełny kontrakt | constraint → listener/collider → body → visual |
| listener/page lifecycle | część app-owned, pagehide bez stop | collision owned by assembly, pagehide normal stop |
| payload/debris ownership | game.js domain logic | FlightIntegrity lifecycle + DebrisRuntime adapter |
| narrow stub-only proof | assembly seam tests | headless + real Cannon + startup/lifecycle tests |
| stale documentation | current header 1D.3C | canonical docs rewritten for 1D.3E |

## Drugi niezależny review

Przejrzano cały diff względem czystego Phase 1D.3D, nowe moduły, dependency direction, lifecycle, integrity, visuals, RuntimeAssembly, AssemblyBuilder, oba backendy, tests, source inventory, build tools i dokumentację.

### Znalezione i naprawione

1. Multi-body integrity używało początkowo health całego assembly jako mianownika primary body.
2. Cleanup usuwał listeners przed constraints i nie usuwał colliderów jawnie.
3. Debris sync czytał native body fields.
4. Debris allocation/disposal pozostawało za duże w composition root.
5. Presentation hook mógł przerwać transakcję po collider removal.
6. Visual root był dodawany do sceny przed zarejestrowaniem ownership.
7. Build presentation error mógł zostawić runtime bez rollbacku.
8. `pagehide` testował się dopiero po wyjściu z lotu.
9. Dwa testy tekstowe zależały od usuniętej lokalnej zmiennej.
10. Dokumenty kanoniczne i branding pozostawały na 1D.3C.

### Sprawdzone anti-patterny

- brak active `STATE.flight.body` consumers;
- brak `AssemblyBuilder.build` w `game.js`;
- brak przypadkowej primary selection przez array index;
- brak destructive fallbacku;
- brak visual root zależnego od ostatniego body;
- brak map clear przed pełnym cleanupem;
- brak body removal przy aktywnym constraint;
- brak native solver handles w mission/control APIs;
- brak nowego globalnego `window.*`;
- brak Gate B test hacku w production game shellu.

## Ostateczny werdykt

Gate A może zostać oznaczony jako zamknięty. Gate B pozostaje otwarty i wymaga schema-first ADR. Nie znaleziono uzasadnienia do rozpoczęcia Gate B w tym samym wydaniu bez ryzyka niedokończonej migracji blueprint/compilation.
