# Fast-Tube Development Guidelines

## Performance (Low-End TV / Cobalt)
This codebase runs on low-end embedded devices (e.g., older Tizen TVs running Cobalt). Strict performance guidelines apply:
1. **No Hot-Path Logging**: Never use `console.log` or `console.info` in high-frequency event listeners (like `keydown` or `mousemove`). Embedded environments often block synchronously on IPC logging, causing severe micro-stutters and frame drops.
2. **Avoid Heavy JSON Clones in Loops**: Do not use `JSON.parse(JSON.stringify(obj))` inside tight loops for deep cloning large objects (like YouTube video tiles). Use shallow cloning (e.g., `{ ...item }`) and manually omit circular references (e.g., `{ ...item, tileRenderer: { ...item.tileRenderer, onLongPressCommand: undefined } }`) to preserve the JS thread execution time.
3. **No Blocking Fetch Storms**: Never fire bulk, unbatched `fetch` requests (like `deArrow` API checks for every video tile) directly inside synchronous parsing hooks like `JSON.parse`. Stagger network calls using `setTimeout` with randomized delays, or keep heavy network features disabled by default.

## Deployment & Cache Invalidation
1. **jsDelivr Purging**: When making changes to `scripts/userScript.min.js` or `scripts/userScript.js` and pushing to GitHub, you **must** manually purge the jsDelivr origin cache so users see the changes immediately.
Run:
`curl -s "https://purge.jsdelivr.net/gh/RezoxP/Fast-Tube@main/scripts/userScript.min.js"`
`curl -s "https://purge.jsdelivr.net/gh/RezoxP/Fast-Tube@main/scripts/userScript.js"`

## Logic Best Practices
1. **Timer & Event Cleanup**: When toggling off features that use `setInterval` or `setTimeout` (like screen dimming), ensure the event handler has an explicit `else` block to clear active timers and forcefully reset the DOM state (e.g., CSS `opacity: 1`). Do not just skip execution, or the UI may get stuck in an active state.
