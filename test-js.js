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
    open(method, url) { this._url = url; }
    send(body) { this._body = body; return "original_xhr_response"; }
};

global.document = {
    readyState: 'complete',
    head: { appendChild: (elem) => {} },
    documentElement: { appendChild: (elem) => {} },
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

    // Test 2: Player response must strip all adPlacements, playerAds, and playbackTracking
    const playerRes = await window.fetch('https://www.youtube.com/youtubei/v1/player', {
        method: 'POST',
        body: JSON.stringify({ videoId: 'dQw4w9WgXcQ' })
    });
    const playerData = await playerRes.json();
    assert.strictEqual(playerData.adPlacements, undefined, "adPlacements must be deleted");
    assert.strictEqual(playerData.playerAds, undefined, "playerAds must be deleted");
    assert.strictEqual(playerData.playbackTracking.atrUrl, undefined, "atrUrl must be deleted");
    assert.strictEqual(playerData.videoDetails.videoId, 'dQw4w9WgXcQ', "videoId preserved");
    console.log(" ✓ Stripped adPlacements and playerAds from /youtubei/v1/player");

    // Test 3: Test XHR ad filtering
    const xhr = new XMLHttpRequest();
    xhr.open('GET', 'https://googleads.g.doubleclick.net/pagead/ads');
    const xhrRes = xhr.send('test');
    assert.strictEqual(xhrRes, undefined, "XHR ad request must be swallowed");
    console.log(" ✓ Filtered XHR ad requests");

    // Test 4: Verify timeupdate listener and SponsorBlock skipping
    console.log("=== 4. Testing SponsorBlock Timeupdate Event Skipping ===");
    // Wait for the 1000ms interval to hook the video element and fetch sponsor segments
    await new Promise(r => setTimeout(r, 1100));

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

    console.log("=== ALL AD-BLOCK & SPONSORBLOCK TESTS PASSED! ===");
    process.exit(0);
})();
