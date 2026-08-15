# Fast-Tube

Fast-Tube is a feature-rich, ultra-lightweight, and ad-free YouTube TV client designed specifically to run smoothly on both 64-bit and 32-bit Android TVs and TV boxes.

It leverages the **Cobalt** engine (the official YouTube TV web runtime), combined with early JavaScript hooks and native C++ network filtering to provide a seamless, ad-free experience with SponsorBlock integration and zero Cobalt branding, while keeping the output APK size **under 15–17MB**.

---

## Target Architectures & Separate APKs

To maximize compatibility and maintain a small footprint, Fast-Tube builds separate, single-architecture APKs:

| Architecture | Android ABI | Target Devices | APK Name |
| :--- | :--- | :--- | :--- |
| **64-bit** | `arm64-v8a` | Modern Android TVs, Nvidia Shield, Fire TV Cube, Chromecast 4K | `Fast-Tube-arm64-v8a-release.apk` |
| **32-bit** | `armeabi-v7a` | Budget TV sticks, older Android TV boxes, Xiaomi Mi Box, Fire TV Stick | `Fast-Tube-armeabi-v7a-release.apk` |

---

## Features

- **Dual-Layer Ad-Free Experience:**
  - **Native C++ Interception:** Blocks ad requests directly in Cobalt's native network stack (`NetFetcher` & `XMLHttpRequest`).
  - **Early JavaScript Hooking:** Pre-injects into Cobalt's `WebModule` before document scripts run to filter `/youtubei/v1/player` and `/youtubei/v1/reel/` responses (stripping `adPlacements`, `playerAds`, `adSlots`, and tracking URLs).
  - **Premium Promo Cleanup:** Prunes "Get YouTube Premium" upsell cards and banner promos from guide and browse feeds.
  - **Video Watchdog:** Auto-skips any residual ads instantly and suppresses ad audio.
- **SponsorBlock Integration:** Automatically detects and skips sponsorships, intros, outros, previews, and self-promotion segments via the SponsorBlock API.
- **Zero Cobalt Startup Logo:** Clean, pure black startup theme with splash logo disabled (`cobalt.SPLASH_URL="none"` and `#000000` background theme).
- **Ultra-Lightweight (< 17MB):**
  - **Compressed Native Packaging:** Uses legacy zip DEFLATE packaging (`useLegacyPackaging true` / `android:extractNativeLibs="true"`), reducing uncompressed 25MB+ libraries down to ~10MB.
  - **Toolchain Stripping:** Integrated `llvm-strip` strips unneeded symbol tables and debug info before packaging.
  - **Compiler Size Optimizations:** Built with Clang `-Os` and LLD Identical Code Folding (`-Wl,--icf=all`).
  - **ProGuard / R8 Minification:** Strips unused Java classes, methods, and metadata resources.
- **Optimized for Low-End TVs:** Hardware-accelerated video decoding with minimal memory footprint and zero background bloat.

---

## Project Structure

- **`patches/01-inject-vacuumtube-scripts.patch`**: Injects JavaScript (`vacuumtube_adblock.js`) into Cobalt's `WebModule` before page scripts execute and adds native C++ ad interception to `NetFetcher` and `XMLHttpRequest`.
- **`patches/02-optimize-apk-size-and-strip.patch`**: Configures toolchain stripping (`llvm-strip`), compressed APK packaging, LLD ICF, `-Os` compiler optimizations, pure black theme, and disabled Cobalt startup splash logo.
- **`scripts/injection/vacuumtube_adblock.js`**: Intercepts YouTube player, browse, and network requests to remove ads, strip Premium upsells, and skip sponsor segments.
- **`.github/workflows/build.yml`**: Automated matrix workflow building separate 64-bit and 32-bit APKs with `ccache` and parallel Gradle compilation.

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
- Implementation inspired by [TizenTubeCobalt](https://github.com/reisxd/TizenTubeCobalt)
- Adblocking & SponsorBlock logic inspired by [VacuumTube](https://github.com/shy1132/VacuumTube)