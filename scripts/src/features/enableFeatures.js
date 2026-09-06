// Enable features that aren't enabled by default due to YT seeing the TV as a low-end device
import { configRead, configChangeEmitter } from '../config.js';

configChangeEmitter.addEventListener('configChange', (event) => {
    if (event.detail?.key === 'enablePreviews') {
        enableFeatures();
    }
});

// PERF: cap the boot polling so a missing window._yttv (e.g. on non-YouTube
// error pages) can never leave a 250ms retry loop running forever.
const ENABLE_FEATURES_MAX_ATTEMPTS = 120; // ~30s at 250ms
let enableFeaturesAttempts = 0;
let cachedPreviewMap = null;

function enableFeatures() {
    if (cachedPreviewMap) {
        cachedPreviewMap.set("ENABLE_PREVIEWS_WITH_SOUND", configRead('enablePreviews'));
        return;
    }
    if (!window._yttv) {
        if (++enableFeaturesAttempts > ENABLE_FEATURES_MAX_ATTEMPTS) return;
        return setTimeout(enableFeatures, 250);
    }
    const yttvValues = Object.values(window._yttv);

    // Enable preview mode
    const previewMap = yttvValues.find(a => a instanceof Map && a.has("ENABLE_PREVIEWS_WITH_SOUND"));
    if (!previewMap) {
        if (++enableFeaturesAttempts > ENABLE_FEATURES_MAX_ATTEMPTS) return;
        return setTimeout(enableFeatures, 250);
    }
    cachedPreviewMap = previewMap;
    previewMap.set("ENABLE_PREVIEWS_WITH_SOUND", configRead('enablePreviews'));
}

if (document.readyState === 'complete') {
    enableFeatures();
} else window.addEventListener('load', enableFeatures);
