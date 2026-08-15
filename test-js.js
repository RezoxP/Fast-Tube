// Deep test suite for vacuumtube_adblock.js

const assert = require('assert');
const fs = require('fs');

console.log("=== 1. Setting up Mock Browser Environment ===");

global.window = global;
global.Response = class {
    constructor(body, init = {}) {
        this._body = body;
        this.status = init.status || 200;
        this.statusText = init.statusText || "OK";
        this.headers = init.headers || {};
    }
    get ok() {
        return this.status >= 200 && this.status < 300;
    }
    async json() {
        return JSON.parse(this._body);
    }
    clone() {
        return new global.Response(this._body, { status: this.status, statusText: this.statusText, headers: this.headers });
    }
};

global.XMLHttpRequest = class {
    constructor() {
        this.readyState = 0;
        this.status = 0;
        this.statusText = '';
        this.responseText = '';
        this.response = '';
        this._listeners = {};
    }
    open(method, url) {
        this._method = method;
        this._url = url;
        this.readyState = 1;
    }
    addEventListener(event, handler) {
        if (!this._listeners[event]) this._listeners[event] = [];
        this._listeners[event].push(handler);
    }
    dispatchEvent(event) {
        if (this._listeners[event.type]) {
            this._listeners[event.type].forEach(cb => cb.call(this));
        }
    }
    send(body) {
        this._body = body;
        if (this._url.includes('/youtubei/v1/player')) {
            this.readyState = 4;
            this.status = 200;
            this.responseText = JSON.stringify({
                videoDetails: { videoId: 'dQw4w9WgXcQ' },
                adPlacements: [{ ad: 1 }],
                playerAds: [{ ad: 2 }],
                adSlots: [{ slot: 3 }]
            });
            this.response = this.responseText;
            if (this._listeners['readystatechange']) {
                this._listeners['readystatechange'].forEach(cb => cb.call(this));
            }
            if (this._listeners['load']) {
                this._listeners['load'].forEach(cb => cb.call(this));
            }
        }
        return "original_xhr_response";
    }
};

let appendedStyles = '';
global.document = {
    readyState: 'complete',
    head: {
        appendChild: (elem) => { appendedStyles = elem.textContent; }
    },
    documentElement: { appendChild: (elem) => {} },
    body: { appendChild: (elem) => {} },
    getElementById: (id) => null,
    createElement: (tag) => ({ id: '', textContent: '', innerHTML: '' }),
    querySelector: (selector) => {
        if (selector === 'video') return mockVideo;
        if (selector.includes('ad-interrupting')) return null;
        return null;
    }
};

const listeners = {};
const mockVideo = {
    paused: false,
    currentTime: 10.0,
    duration: 120.0,
    addEventListener: (event, handler) => {
        listeners[event] = handler;
    },
    removeEventListener: (event, handler) => {
        delete listeners[event];
    }
};

global.fetch = async function(url, options) {
    if (url.includes('sponsor.ajay.app')) {
        return new global.Response(JSON.stringify([
            { segment: [15.0, 30.0], category: 'sponsor' }
        ]));
    }
    if (url.includes('/youtubei/v1/player')) {
        return new global.Response(JSON.stringify({
            videoDetails: { videoId: 'dQw4w9WgXcQ' },
            adPlacements: [{ dummy: 1 }],
            playerAds: [{ dummy: 2 }],
            adSlots: [{ dummy: 3 }],
            playbackTracking: { atrUrl: 'http://tracking', cpnUrl: 'http://tracking' },
            streamingData: { formats: [] }
        }));
    }
    return new global.Response(JSON.stringify({ success: true }));
};

console.log("=== 2. Loading and Executing vacuumtube_adblock.js ===");
const code = fs.readFileSync('scripts/injection/vacuumtube_adblock.js', 'utf8');
eval(code);

(async () => {
    console.log("=== 3. Testing Core JSON.parse and JSON.stringify Hooks ===");

    // Test JSON.parse on player payload
    const rawPlayerPayload = JSON.stringify({
        videoDetails: { videoId: 'dQw4w9WgXcQ' },
        adPlacements: [{ ad: 1 }],
        playerAds: [{ ad: 2 }],
        adSlots: [{ ad: 3 }],
        adBreakParams: 'params',
        playbackTracking: { atrUrl: 'http://tracking', qoeUrl: 'http://qoe' }
    });
    const parsedPlayer = JSON.parse(rawPlayerPayload);
    assert.deepStrictEqual(parsedPlayer.adPlacements, [], "adPlacements must be empty array");
    assert.strictEqual(parsedPlayer.playerAds, false, "playerAds must be false");
    assert.deepStrictEqual(parsedPlayer.adSlots, [], "adSlots must be empty array");
    assert.strictEqual(parsedPlayer.adBreakParams, undefined, "adBreakParams must be removed");
    assert.strictEqual(parsedPlayer.playbackTracking.atrUrl, undefined, "tracking atrUrl removed");
    console.log(" ✓ JSON.parse correctly sanitized player payload");

    // Test JSON.parse on Settings payload (Fast-Tube Settings injection)
    const rawSettingsPayload = JSON.stringify({
        title: { runs: [{ text: "Settings" }] },
        items: [
            {
                settingCategoryCollectionRenderer: {
                    categoryId: "SETTINGS_CATEGORY_AUTOPLAY",
                    title: { runs: [{ text: "Autoplay" }] }
                }
            },
            {
                settingCategoryCollectionRenderer: {
                    categoryId: "SPunlimited",
                    title: { runs: [{ text: "Get YouTube Premium" }] }
                }
            }
        ]
    });
    const parsedSettings = JSON.parse(rawSettingsPayload);
    assert.strictEqual(parsedSettings.items.length, 2, "Must keep Fast-Tube and Autoplay, stripping Premium");
    const firstCat = parsedSettings.items[0].settingCategoryCollectionRenderer;
    assert.strictEqual(firstCat.categoryId, 'fast_tube_category', "First category must be Fast-Tube");
    assert.strictEqual(firstCat.title.runs[0].text, 'Fast-Tube', "Category title must be Fast-Tube");
    assert.strictEqual(firstCat.items[0].settingActionRenderer.title.runs[0].text, 'Fast-Tube Settings');
    assert.strictEqual(firstCat.items[0].settingActionRenderer.actionLabel.runs[0].text, 'Patches Active');
    console.log(" ✓ JSON.parse injected Fast-Tube Settings and stripped Premium promo");

    // Test JSON.stringify on playbackContext (isInlinePlaybackNoAd flag)
    const playbackReq = {
        videoId: 'test1234',
        playbackContext: {
            contentPlaybackContext: {
                html5Preference: 'HTML5_PREF_WANTS'
            }
        }
    };
    const stringifiedReq = JSON.stringify(playbackReq);
    assert(stringifiedReq.includes('"isInlinePlaybackNoAd":true'), "JSON.stringify must set isInlinePlaybackNoAd to true");
    console.log(" ✓ JSON.stringify injected isInlinePlaybackNoAd = true");

    console.log("=== 4. Testing Network-Level Ad Blocking ===");
    
    // Ad endpoints blocked
    const adRes = await window.fetch('https://www.youtube.com/api/stats/ads?ad_type=1');
    const adData = await adRes.json();
    assert.deepStrictEqual(adData, {}, "Ad endpoint must be blocked with empty object");
    console.log(" ✓ Blocked /api/stats/ads");

    // XHR ad filtering
    const xhr = new XMLHttpRequest();
    xhr.open('GET', 'https://googleads.g.doubleclick.net/pagead/ads');
    xhr.send('test');
    assert.strictEqual(xhr.status, 0, "XHR ad request swallowed synchronously");
    console.log(" ✓ Filtered XHR ad requests");

    // SponsorBlock skipping test
    console.log("=== 5. Testing SponsorBlock Timeupdate Event Skipping ===");
    await new Promise(r => setTimeout(r, 600));

    assert(listeners['timeupdate'] !== undefined, "timeupdate listener must be attached to video");
    
    // Position inside sponsor segment (15.0 - 30.0)
    mockVideo.currentTime = 16.0;
    listeners['timeupdate']();
    assert.strictEqual(mockVideo.currentTime, 30.0, "Video must jump to the end of sponsor segment (30.0)");
    console.log(" ✓ Video successfully skipped from 16.0s to 30.0s via timeupdate");

    // Verify CSS injection
    assert(appendedStyles.includes('ytlr-ad-renderer'), "CSS must include ytlr-ad-renderer");
    assert(appendedStyles.includes('Get YouTube Premium'), "CSS must include Get YouTube Premium");
    console.log(" ✓ Verified Leanback & YouTube Premium CSS styling rules");

    console.log("=== ALL AD-BLOCK, SPONSORBLOCK, SETTINGS UI, AND PREMIUM REMOVAL TESTS PASSED! ===");
    process.exit(0);
})();
