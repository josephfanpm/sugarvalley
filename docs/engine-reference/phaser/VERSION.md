# Phaser — pinned version

- **Version:** 3.90.0 (vendored at `src/vendor/phaser.min.js`)
- **Renderer:** WebGL with Canvas fallback; `pixelArt: true`, `roundPixels: true`
- **Docs:** https://docs.phaser.io/api-documentation/api-documentation

Notes:
- Avoid `preFX`/`postFX`: WebGL-only and heavy on phones. Fades use overlays instead.
- Do not upgrade to Phaser 4 without an ADR.
