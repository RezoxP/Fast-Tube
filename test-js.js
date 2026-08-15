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

const xhrEvents = {};
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
    if (url.includes('/youtubei/v1/guide') || url.includes('/youtubei/v1/browse')) {
        return new global.Response(JSON.stringify({
            items: [
                { title: 'Home', browseId: 'FEwhat_to_watch' },
                { title: 'Get YouTube Premium', browseId: 'SPunlimited' },
                { statementBannerRenderer: { title: 'Subscribe to Premium' } }
            ]
        }));
    }
    return new global.Response(JSON.stringify({ success: true }));
};

console.log("=== 2. Loading and Executing vacuumtube_adblock.js ===");
const code = fs.readFileSync('scripts/injection/vacuumtube_adblock.js', 'utf8');
eval(code);

(async () => {
    console.log("=== 3. Testing Ad Blocking on Fetch Requests ===");
    
    // Test 1: Ad endpoints should return empty 200 OK immediately
    const adRes = await window.fetch('https://www.youtube.com/api/stats/ads?ad_type=1');
    const adData = await adRes.json();
    assert.deepStrictEqual(adData, {}, "Ad endpoint must be blocked with empty object");
    console.log(" ✓ Blocked /api/stats/ads");

    const ptrackRes = await window.fetch('https://www.youtube.com/ptracking?test=1');
    const ptrackData = await ptrackRes.json();
    assert.deepStrictEqual(ptrackData, {}, "Tracking endpoint must be blocked");
    console.log(" ✓ Blocked /ptracking");

    // Test 2: Player response must strip all adPlacements, playerAds, adSlots, and playbackTracking
    const playerRes = await window.fetch('https://www.youtube.com/youtubei/v1/player', {
        method: 'POST',
        body: JSON.stringify({ videoId: 'dQw4w9WgXcQ' })
    });
    const playerData = await playerRes.json();
    assert.strictEqual(playerData.adPlacements, undefined, "adPlacements must be deleted");
    assert.strictEqual(playerData.playerAds, undefined, "playerAds must be deleted");
    assert.strictEqual(playerData.adSlots, undefined, "adSlots must be deleted");
    assert.strictEqual(playerData.playbackTracking.atrUrl, undefined, "atrUrl must be deleted");
    assert.strictEqual(playerData.videoDetails.videoId, 'dQw4w9WgXcQ', "videoId preserved");
    console.log(" ✓ Stripped adPlacements and playerAds from /youtubei/v1/player");

    // Test 3: Browse & Guide response must remove 'Get YouTube Premium' and statementBannerRenderer
    const guideRes = await window.fetch('https://www.youtube.com/youtubei/v1/guide');
    const guideData = await guideRes.json();
    assert.strictEqual(guideData.items.length, 1, "Guide items must have Premium and banner promos removed");
    assert.strictEqual(guideData.items[0].title, 'Home', "Only legitimate non-promo items retained");
    console.log(" ✓ Cleaned 'Get YouTube Premium' and banners from guide/browse responses");

    // Test 4: Test XHR ad filtering
    const xhr = new XMLHttpRequest();
    xhr.open('GET', 'https://googleads.g.doubleclick.net/pagead/ads');
    xhr.send('test');
    assert.strictEqual(xhr.status, 0, "XHR ad request swallowed synchronously");
    console.log(" ✓ Filtered XHR ad requests");

    // Test 5: Test XHR player ad stripping
    const playerXhr = new XMLHttpRequest();
    playerXhr.open('POST', 'https://www.youtube.com/youtubei/v1/player');
    playerXhr.send(JSON.stringify({ videoId: 'dQw4w9WgXcQ' }));
    const parsedXHR = JSON.parse(playerXhr.responseText);
    assert.strictEqual(parsedXHR.adPlacements, undefined, "XHR player response must strip adPlacements");
    assert.strictEqual(parsedXHR.playerAds, undefined, "XHR player response must strip playerAds");
    console.log(" ✓ Stripped ads from XMLHttpRequest player responses");

    // Test 6: Verify timeupdate listener and SponsorBlock skipping
    console.log("=== 4. Testing SponsorBlock Timeupdate Event Skipping ===");
    await new Promise(r => setTimeout(r, 600));

    assert(listeners['timeupdate'] !== undefined, "timeupdate listener must be attached to video");
    
    // Position inside sponsor segment (15.0 - 30.0)
    mockVideo.currentTime = 16.0;
    listeners['timeupdate']();
    assert.strictEqual(mockVideo.currentTime, 30.0, "Video must jump to the end of sponsor segment (30.0)");
    console.log(" ✓ Video successfully skipped from 16.0s to 30.0s via timeupdate");

    // Position outside sponsor segment
    mockVideo.currentTime = 35.0;
    listeners['timeupdate']();
    assert.strictEqual(mockVideo.currentTime, 35.0, "Video should not jump when outside sponsor segment");
    console.log(" ✓ Video maintained playback timestamp outside sponsor segments");

    // Test 7: Verify styles contain Leanback ad and premium hiding rules
    assert(appendedStyles.includes('ytlr-ad-renderer'), "CSS must include ytlr-ad-renderer");
    assert(appendedStyles.includes('Get YouTube Premium'), "CSS must include Get YouTube Premium");
    console.log(" ✓ Verified Leanback & YouTube Premium CSS styling rules");

    console.log("=== ALL AD-BLOCK, SPONSORBLOCK, AND PREMIUM REMOVAL TESTS PASSED! ===");
    process.exit(0);
})();
