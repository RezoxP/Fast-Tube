---
description: Constraints and guidelines for developing Fast-Tube, TizenTube, and Cobalt TV components.
globs:
  - "**/*.js"
  - "**/*.cc"
  - "**/*.patch"
  - ".github/workflows/*.yml"
---
# Fast-Tube Development Guidelines

When modifying this repository, strictly adhere to the following architectural and platform constraints:

1. **WebAssembly is Mandatory for YouTube**: Never set `v8_enable_webassembly = false` in Cobalt GN arguments (`args.gn` or `build.yml`). Modern YouTube TV players require WASM for DRM and standard video playback. Disabling it will cause "Playback ID" errors on normal videos.
2. **Explicitly Unset Native Toggles**: Cobalt persists native `h5vcc.tizentube` settings (e.g., `SetUserAgent`, `SetFrameRate`) across reloads and reinstalls. When implementing a UI toggle for a feature, you MUST explicitly send a reset/null value (like `0` or `""`) when the feature is turned off.
3. **Dynamic Userscript Injection (CDN)**: The `userScript.min.js` file is loaded dynamically over-the-air via JSDelivr (injected directly in `document.cc`). Do NOT attempt to embed or copy JS files into Cobalt's `embedded_resources` or C++ headers. 
4. **Decoupled CI Workflows**: The CI pipeline is separated. JavaScript modifications should only trigger the auto-build script (`scripts.yml`), not the heavy C++ APK build (`build.yml`). Do not modify `build.yml` to trigger on JS changes.

5. **NEVER Hand-Edit `.patch` Files**: Git patch files (`.patch`) have extremely strict formatting (hunk headers, line counts, context lines). If an AI uses text-replacement tools on a `.patch` file, it will almost always corrupt the hunk headers and cause `git apply` to fail in CI. 
   - **Reliable Solution**: To modify C++ code, you must:
     1. Run `./scripts/regenerate-patches.sh` to apply the current patches to the `cobalt-src/src` directory.
     2. Make your edits directly to the actual C++ source files inside `cobalt-src/src/`.
     3. Press Enter in the script prompt to automatically generate a clean, perfectly-formatted patch file via `git diff`.
