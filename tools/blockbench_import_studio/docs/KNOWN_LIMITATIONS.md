# Known limitations

- This is still an Import Studio / Import Lab, not a production VAW asset pipeline.
- The Visual Asset Pack V1 contract is a draft for M4A synchronization with the engine-side agent.
- Automatic tests cover structure, validation, resolver behavior, reports, and export entries. They do not replace manual WebGL/browser testing.
- GLB remains an optional/regression path. The main workflow is still `.gltf + .bin + textures` or embedded `.gltf` exports.
- ZIP import as direct `.zip` drag/drop is not implemented. Folder/multi-file upload is supported.
- The manifest editor is still raw JSON. There is no polished socket/node picker yet.
- Duplicate node names are not automatically repaired. The contract warns, and export blocks ambiguous bare-name bindings.
- Texture diagnostic is not a full material graph inspector.
- Animation preview is not a full timeline/event editor.
- Visual packs do not and must not edit gameplay authority.
- The reimported thruster/checker fixture lost its original in-game look after extraction/reimport. It remains a loader/fallback regression asset, not a visual fidelity proof.
- M4E validates real Blockbench fixtures and explicit block type selection, but runtime animation playback is still a later milestone.
