# Root cause analysis — czarny/pusty viewer w V3/V3.1/V3.2

## Najbardziej prawdopodobna techniczna przyczyna

W V3, V3.1 i V3.2 funkcja resetująca import (`resetAll()` → `clearPreview()`) kasowała aktywne `requestAnimationFrame`:

```js
if (state.animationFrame) {
  cancelAnimationFrame(state.animationFrame);
  state.animationFrame = null;
}
```

Następnie `loadFiles()` wołało `resetAll(); initThree();`, ale `initThree()` miało guard:

```js
if (state.scene) return;
```

Scena już istniała, więc `initThree()` nie uruchamiało ponownie `animate()`. Efekt: GLTFLoader mógł poprawnie załadować model i dodać go do sceny, ale renderer nie renderował już kolejnych klatek po imporcie. Użytkownik widział pusty/czarny viewer albo stan wyglądający jak zepsuta aplikacja.

## Dlaczego V2 tego nie miało w tej samej formie

V2 uruchamiało viewer raz przez `setupViewer()` i nie kasowało głównej pętli renderowania podczas resetu samego assetu. Reset usuwał model, markery i helpery, ale render loop nadal działał. Dlatego prosty import Blockbench mógł wcześniej działać.

## Dlaczego V3.1/V3.2 nie naprawiły problemu

V3.1 i V3.2 łagodziły walidację i próbowały rozdzielić status importu od VAW readiness, ale nie naprawiły głównego lifecycle viewera. Jeśli render loop był martwy po resecie, zmiana severity `duplicate node names`, `noEmissive` albo `missing visualRoot` nie mogła sprawić, że model zacznie być widoczny.

## Druga klasa problemów

V3 rozrosło się funkcjonalnie, zanim viewer został ustabilizowany. Jednocześnie pojawiły się debug toggles, walidator, sidecar repair, texture overrides i package export. To utrudniło rozpoznanie, czy problem jest w:

- rendererze;
- GLTFLoaderze;
- resolverze plików;
- kamerze/fit;
- materiałach;
- debug override;
- VAW validatorze.

Recovery build wraca do zasady: viewer/import działa pierwszy, VAW semantics drugi.
