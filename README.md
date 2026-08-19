# Fast-Tube

Fast-Tube is a high-performance, ultra-lightweight YouTube TV client for Android TV built on the official **Cobalt** engine. It is specifically optimized for smooth 60fps playback, minimal memory footprint, and low-latency navigation across both 64-bit and 32-bit Android TVs and TV boxes running **Android 7.0 (API 24) to Android 15 (latest)**.

By leveraging aggressive native toolchain stripping, Identical Code Folding, Android 7+ dynamic relocation packing, Clang size/speed optimizations, and DEFLATE native library compression, Fast-Tube reduces the compiled APK size down to **under 15–17MB**.

---

## Target Architectures & Separate APKs

To maximize compatibility and maintain a minimal footprint, Fast-Tube builds separate, single-architecture APKs:

| Architecture | Android ABI | Target Devices | APK Name |
| :--- | :--- | :--- | :--- |
| **64-bit** | `arm64-v8a` | Modern Android TVs, Nvidia Shield, Fire TV Cube, Chromecast 4K, Google TV (Android 7–15) | `Fast-Tube-arm64-v8a-release.apk` |
| **32-bit** | `armeabi-v7a` | Budget TV sticks, older TV boxes, Xiaomi Mi Box, Fire TV Stick, Allwinner/Amlogic SoCs | `Fast-Tube-armeabi-v7a-release.apk` |

---

## Performance & Size Optimizations

- **Native Toolchain Stripping (`llvm-strip`):**
  - Strips unneeded debug symbols, comments, and internal metadata tables from `libcobalt.so` during the toolchain link stage.
- **Linker Optimizations:**
  - **Identical Code Folding (`-Wl,--icf=all`):** Merges identical functions and code blocks in LLD.
  - **Aggressive Linker Optimization (`-Wl,-O3`):** Resolves relocations and merges GOT/PLT entries efficiently.
  - **Android 7+ Packed Relocations (`-Wl,--pack-dyn-relocs=android`):** Compresses ELF dynamic relocation sections (`.rel.dyn` / `.rela.dyn`), saving up to 1.5MB native size while guaranteeing 100% compatibility with Android 7.0+ linkers.
  - **Dead Code Stripping (`-Wl,--gc-sections`):** Eliminates unreferenced code sections.
- **Compiler Optimizations:**
  - **Clang Size Mode (`-Os`):** Generates tight, cache-friendly machine instructions.
  - **Frame Pointer Elimination (`-fomit-frame-pointer`):** Frees up general-purpose registers (`r7`/`r11` on ARM, `x29` on ARM64) to boost rendering and JavaScript loop throughput.
  - **Hidden Symbol Visibility (`-fvisibility=hidden` / `-fvisibility-inlines-hidden`):** Drops internal symbols from the dynamic export table, allowing deeper inlining and smaller binary footprint.
  - **FPU Direct SIMD (`-fno-math-errno`):** Generates single-instruction hardware math without library call branching.
  - **Exception & Unwind Stripping (`-fno-asynchronous-unwind-tables` / `-fno-unwind-tables`):** Strips unused DWARF unwind tables.
- **Android APK & Runtime Tuning:**
  - **DEFLATE Native Library Compression (`useLegacyPackaging true` / `android:extractNativeLibs="true"`):** Compresses native binaries inside the APK from ~25MB+ down to ~10MB.
  - **Large Heap & Hardware Acceleration (`android:largeHeap="true"` / `android:hardwareAccelerated="true"`):** Ensures sufficient memory headroom on 1GB/2GB RAM TV sticks, preventing OS low-memory kills during 4K/60fps streaming.
  - **ProGuard / R8 Minification:** Minifies Android Java bytecode while preserving Cobalt Starboard JNI and Leanback TV interfaces.
  - **Zero Startup Splash Logo:** Instant black screen launch (`cobalt.SPLASH_URL="none"` and `#000000` theme).
- **High-Speed GitHub Actions CI:**
  - Optimized Ccache with `CCACHE_DIRECT=1` and `CCACHE_NOHASHDIR=1` for 90%+ cache hit rate.
  - Single-pass `autoninja` APK build pipeline.

---

## Project Structure

- **`patches/01-optimize-apk-size-and-strip.patch`**: Comprehensive patch configuring toolchain stripping (`llvm-strip`), Linker ICF (`-Wl,--icf=all`), Android 7+ packed relocations, Clang `-Os` compiler flags, legacy zip packaging, ProGuard rules, and startup splash removal.
- **`scripts/verify-patches.js`**: Validates that all APK size, performance, stripping, and Android 7+ compatibility markers are present and well-formed.
- **`test-build.sh`**: Local test runner for patch verification and ActionLint workflow validation.
- **`.github/workflows/build.yml`**: High-speed matrix workflow building separate 64-bit and 32-bit release APKs.

---

## Building via GitHub Actions

1. Go to the **Actions** tab in this repository.
2. Select **Build Fast-Tube (Cobalt TV)**.
3. Click **Run workflow** on `main`.
4. Once completed, download the corresponding artifact for your TV:
   - `Fast-Tube-arm64-v8a-APK` (for 64-bit TV)
   - `Fast-Tube-armeabi-v7a-APK` (for 32-bit TV)

---

## Credits
- Built with [Cobalt](https://github.com/youtube/cobalt)