# Third-Party Notices

## Cannon.js 0.6.2 — test-only vendored runtime

The automated real-backend parity harness and the browser runtime harness use a vendored copy of `cannon@0.6.2` at:

- `tests/vendor/cannon-0.6.2/cannon.min.js`
- `tests/vendor/cannon-0.6.2/LICENSE`

Cannon.js is distributed under the MIT License. The upstream copyright and full license text are preserved in the adjacent `LICENSE` file.

This vendored file is used only by validation harnesses. The application entry point and generated single-file release continue to load their normal production dependencies as defined by `index.html`.
