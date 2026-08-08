# Fast-Tube

Fast-Tube is a feature-rich, ad-free YouTube client designed specifically to run smoothly on low-end Android TVs. 

It leverages the **Cobalt** engine (the official YouTube TV web runtime used in `TizenTubeCobalt`), combined with JavaScript patches derived from **VacuumTube** to provide a seamless, ad-free experience with SponsorBlock integration, all while keeping the output APK size under 15MB.

## Features

- **Ad-Free Experience:** Blocks video ads, overlay ads, and tracking scripts by hooking into the Cobalt `fetch` requests.
- **SponsorBlock Integration:** Automatically skips sponsorships and intros using the SponsorBlock API.
- **Optimized for Low-End TVs:** Built as an optimized release build (`is_debug = false`, `symbol_level = 0`), stripping unnecessary bloat from the Cobalt engine to prevent lag.
- **Small Footprint:** The final APK is designed to be `< 15MB` (compared to official YouTube for Android TV which is ~20MB+).

## Architecture

This project does not reinvent the wheel but instead uses the official `Cobalt` source code. We apply custom C++ patches at build time to inject our JavaScript (`vacuumtube_adblock.js`) into the WebModule whenever YouTube Leanback (`https://www.youtube.com/tv`) loads.

- **`patches/01-inject-vacuumtube-scripts.patch`**: A C++ patch for the Cobalt engine (`cobalt/browser/web_module.cc`) to automatically load our JavaScript on page initialization.
- **`scripts/injection/vacuumtube_adblock.js`**: The core JavaScript logic that intercepts network requests to block ads and interacts with the HTML5 video player to skip sponsor segments.
- **`.github/workflows/build.yml`**: A custom, memory-efficient GitHub action workflow that uses `ccache` and limits ninja parallelism (`-j 2`) so that Cobalt (a massive C++ project) can compile successfully without OOM'ing on standard 7GB GitHub Actions runners.

## Building via GitHub Actions

Because Cobalt requires significant CPU and memory to compile, this repository includes a **GitHub Actions Workflow** optimized for resource-limited environments.

1. Go to the **Actions** tab in this repository.
2. Select **Build Fast-Tube (Cobalt TV)**.
3. Click **Run workflow**.
4. Once completed, download the `Fast-Tube-APK` artifact from the run summary. The APK will be ready to install on your Android TV!

## Credits
- Implementation inspired by [TizenTubeCobalt](https://github.com/reisxd/TizenTubeCobalt) (Cobalt build strategies)
- Adblocking & SponsorBlock logic inspired by [VacuumTube](https://github.com/shy1132/VacuumTube) (Electron/JS injection strategies)