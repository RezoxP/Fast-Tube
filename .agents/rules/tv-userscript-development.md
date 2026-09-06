---
name: tv-userscript-development
description: Guardrails for developing, optimizing, and testing userscripts on YouTube TV (Cobalt) and low-end embedded devices.
---

# YouTube TV (Cobalt) & Low-End Device Development Guidelines

## 1. Low-End Device Performance & Leak Prevention
- **Track All Timers & Observers**: Any retry `setTimeout` or `setInterval` must be tracked in state and cleared on `destroy()` or route transition. Always guard asynchronous callbacks with `if (!this.active) return;` to prevent zombie execution.
- **Cache Object / Prototype Inspections**: Never inspect `window._yttv` keys or call `.toString()` repeatedly inside polling intervals. Use an incremental cache (`Set`) and cancel polling immediately once target properties are resolved.
- **Zero Style Thrashing on Keypresses**: Avoid modifying DOM styles or attributes during remote key events (`keydown`, `keypress`, `keyup`) unless an explicit state change (e.g., dimming timeout trigger) occurred.
- **Dynamic Player Re-attachment**: Do not rely on one-shot boolean flags to bind event listeners to `<video>` or `.html5-video-player`. YouTube TV replaces player elements across route transitions; validate `.isConnected` or listen to route changes.
- **Menu Array Deduplication**: Check for existing items before appending or splicing custom buttons into Leanback menus.

## 2. YouTube TV (Cobalt) Platform Compatibility
- **Comply with Trusted Types (TrustedHTML)**: Never inject raw HTML via `innerHTML`. Always construct dynamic UI elements (modals, QR codes, badges) using DOM APIs (`document.createElement`, `textContent`, `appendChild`).
- **Remote Key Event Hygiene**:
  - Global modal shortcuts (e.g. Settings: 404 & 172; Speed: 406 & 191) must bind on module load, not deferred until video playback.
  - Video seek shortcuts (e.g. number keys) must guard against active inputs (`input`, `textarea`, `ytlr-search-box`, `[role="textbox"]`), verify active `#/watch` routes, and call `evt.preventDefault()` / `evt.stopPropagation()`.
- **Preserve Monkey-Patch Flags**: When wrapping runtime methods (e.g. `resolveCommand`), preserve existing wrapper flags (e.g. `__ftPatched`) to prevent circular re-wrapping or stripping.

## 3. Testing & Workspace Cleanliness
- **Temporary Screenshots**: Always write temporary visual verification screenshots to `/tmp/` rather than the workspace root.
- **Repository Hygiene**: Ensure build artifacts, temporary patches, and transient directories are excluded from version control.
