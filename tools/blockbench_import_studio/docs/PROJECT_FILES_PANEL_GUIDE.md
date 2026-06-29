# Project Files Panel Guide

## Purpose

`Project Files` answers: "What exactly did I load into the studio, and how is each file being used?"

It is different from `glTF Dependencies`:

- `Project Files` shows all user-loaded files;
- `glTF Dependencies` shows only files referenced by the current glTF JSON.

## Columns / facts shown per file

Each row shows:

- file name;
- relative path;
- extension;
- size;
- category;
- status;
- whether it is included in Debug Export;
- whether it is included in VAW Export;
- material slot usage for textures;
- sidecar recognition for `.vaw.json` files.

## Categories

- `model`: `.gltf`, `.glb`
- `buffer`: `.bin`
- `texture`: `.png`, `.jpg`, `.jpeg`, `.webp`, `.gif`, `.bmp`, `.ktx2`, `.basis`
- `sidecar`: `.vaw.json`
- `unknown`: anything else

## Statuses

- `main model`: selected glTF/GLB entry point.
- `dependency used`: referenced by glTF and resolved to a loaded file.
- `unused`: loaded by the user but not referenced by the current glTF.
- `missing`: referenced by glTF but not loaded.
- `ambiguous`: more than one candidate could match the glTF reference.
- `embedded`: dependency is embedded in the glTF/GLB instead of being a separate file.
- `external`: dependency points to an external absolute URL.

## Important behavior

`unused` is not an import failure. It is a neutral warning. It often means the user loaded extra textures, backups, or source files that the current glTF does not reference.

## Debug export behavior

Debug export includes all loaded files, including unused and unknown files. This is intentional: debug packages should preserve user context for reproducing import problems.

VAW export remains stricter and should only include the VAW-ready asset payload.
