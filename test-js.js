// Deep test suite for vacuumtube_adblock.js

const assert = require('assert');
const fs = require('fs');

console.log("=== 1. Setting up Mock Browser Environment ===");

global.window = global;
global.localStorage = {
    _data: {},
    getItem(k) { return this._data[k] || null; },
    setItem(k, v) { this._data[k] = String(v); },
    removeItem(k) { delete this._data[k]; }
};

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
    return new global.Response(JSON.stringify({ success: true }));
};

// Mock _yttv resolveCommand
let resolveCommandCalledWith = null;
global._yttv = {
    testModule: {
        instance: {
            resolveCommand: function(cmd) {
                resolveCommandCalledWith = cmd;
                return true;
            }
        }
    }
};

console.log("=== 2. Loading and Executing vacuumtube_adblock.js ===");
const code = fs.readFileSync('scripts/injection/vacuumtube_adblock.js', 'utf8');
eval(code);

(async () => {
    console.log("=== 3. Testing Home Screen & Search Feed Ad Filtering ===");

    // Test JSON.parse on home feed payload
    const rawHomeFeedPayload = JSON.stringify({
        contents: {
            tvBrowseRenderer: {
                content: {
                    tvSurfaceContentRenderer: {
                        content: {
                            sectionListRenderer: {
                                contents: [
                                    { adSlotRenderer: { id: 'ad1' } },
                                    { promoShelfRenderer: { id: 'promo1' } },
                                    { shelfRenderer: { tvhtml5Metadata: { hideLogo: true }, title: 'Promo' } },
                                    {
                                        shelfRenderer: {
                                            title: 'Recommended Videos',
                                            content: {
                                                horizontalListRenderer: {
                                                    items: [
                                                        { adSlotRenderer: { id: 'ad2' } },
                                                        { compactPromotedItemRenderer: { id: 'promo2' } },
                                                        { tileRenderer: { title: 'Great Video 1' } },
                                                        { tileRenderer: { title: 'Great Video 2' } }
                                                    ]
                                                }
                                            }
                                        }
                                    }
                                ]
                            }
                        }
                    }
                }
            }
        }
    });

    const parsedHome = JSON.parse(rawHomeFeedPayload);
    const homeContents = parsedHome.contents.tvBrowseRenderer.content.tvSurfaceContentRenderer.content.sectionListRenderer.contents;
    assert.strictEqual(homeContents.length, 1, "Only legitimate video shelf must be retained in home feed");
    assert.strictEqual(homeContents[0].shelfRenderer.title, 'Recommended Videos', "Recommended Videos shelf preserved");
    const shelfItems = homeContents[0].shelfRenderer.content.horizontalListRenderer.items;
    assert.strictEqual(shelfItems.length, 2, "Ad items stripped, 2 real video tiles preserved");
    console.log(" ✓ Cleaned home feed ads without blanking video shelves");

    console.log("=== 4. Testing Video Player Ad Stripping ===");
    const rawPlayerPayload = JSON.stringify({
        videoDetails: { videoId: 'dQw4w9WgXcQ' },
        adPlacements: [{ ad: 1 }],
        playerAds: [{ ad: 2 }],
        adSlots: [{ ad: 3 }],
        playbackTracking: { atrUrl: 'http://tracking', qoeUrl: 'http://qoe' }
    });
    const parsedPlayer = JSON.parse(rawPlayerPayload);
    assert.deepStrictEqual(parsedPlayer.adPlacements, [], "adPlacements must be empty array");
    assert.strictEqual(parsedPlayer.playerAds, false, "playerAds must be false");
    assert.deepStrictEqual(parsedPlayer.adSlots, [], "adSlots must be empty array");
    assert.strictEqual(parsedPlayer.playbackTracking.atrUrl, 'http://tracking', "playbackTracking safely preserved for Cobalt video engine");
    console.log(" ✓ Video player ads cleanly stripped");

    console.log("=== 5. Testing Configurable Fast-Tube Settings UI & Interactive Toggles ===");
    const rawSettingsPayload = JSON.stringify({
        title: { runs: [{ text: "Settings" }] },
        items: [
            {
                settingCategoryCollectionRenderer: {
                    categoryId: "SETTINGS_CATEGORY_AUTOPLAY",
                    title: { runs: [{ text: "Autoplay" }] },
                    items: []
                }
            },
            {
                settingCategoryCollectionRenderer: {
                    categoryId: "SPunlimited",
                    title: { runs: [{ text: "Get YouTube Premium" }] },
                    items: []
                }
            }
        ]
    });
    const parsedSettings = JSON.parse(rawSettingsPayload);
    assert.strictEqual(parsedSettings.items.length, 4, "3 Fast-Tube categories added, Premium promo stripped");
    
    // Category 1: General
    const ftGenCategory = parsedSettings.items[0].settingCategoryCollectionRenderer;
    assert.strictEqual(ftGenCategory.categoryId, 'fast_tube_general_category');
    assert.strictEqual(ftGenCategory.title.runs[0].text, 'Fast-Tube: General');
    assert.strictEqual(ftGenCategory.items.length, 4, "General category must have 4 toggles");
    assert.strictEqual(ftGenCategory.items[0].settingBooleanRenderer.itemId, 'adblock');
    assert.strictEqual(ftGenCategory.items[1].settingBooleanRenderer.itemId, 'hideShorts');
    assert.strictEqual(ftGenCategory.items[2].settingBooleanRenderer.itemId, 'hidePaidPromotion');
    assert.strictEqual(ftGenCategory.items[3].settingBooleanRenderer.itemId, 'sb_show_toast');

    // Category 2: SponsorBlock (Auto-Skip)
    const ftSBAutoCategory = parsedSettings.items[1].settingCategoryCollectionRenderer;
    assert.strictEqual(ftSBAutoCategory.categoryId, 'fast_tube_sb_auto_category');
    assert.strictEqual(ftSBAutoCategory.title.runs[0].text, 'Fast-Tube: SponsorBlock (Auto-Skip)');
    assert.strictEqual(ftSBAutoCategory.items.length, 7, "Auto-Skip category must have 7 toggles");
    assert.strictEqual(ftSBAutoCategory.items[0].settingBooleanRenderer.itemId, 'sponsorblock');
    assert.strictEqual(ftSBAutoCategory.items[1].settingBooleanRenderer.itemId, 'sb_auto_sponsor');
    assert.strictEqual(ftSBAutoCategory.items[2].settingBooleanRenderer.itemId, 'sb_auto_intro');
    assert.strictEqual(ftSBAutoCategory.items[3].settingBooleanRenderer.itemId, 'sb_auto_outro');
    assert.strictEqual(ftSBAutoCategory.items[4].settingBooleanRenderer.itemId, 'sb_auto_selfpromo');
    assert.strictEqual(ftSBAutoCategory.items[5].settingBooleanRenderer.itemId, 'sb_auto_preview');
    assert.strictEqual(ftSBAutoCategory.items[6].settingBooleanRenderer.itemId, 'sb_auto_music_offtopic');

    // Category 3: SponsorBlock (Skip Button)
    const ftSBBtnCategory = parsedSettings.items[2].settingCategoryCollectionRenderer;
    assert.strictEqual(ftSBBtnCategory.categoryId, 'fast_tube_sb_btn_category');
    assert.strictEqual(ftSBBtnCategory.title.runs[0].text, 'Fast-Tube: SponsorBlock (Skip Button)');
    assert.strictEqual(ftSBBtnCategory.items.length, 6, "Skip Button category must have 6 toggles");
    assert.strictEqual(ftSBBtnCategory.items[0].settingBooleanRenderer.itemId, 'sb_btn_sponsor');
    assert.strictEqual(ftSBBtnCategory.items[1].settingBooleanRenderer.itemId, 'sb_btn_intro');
    assert.strictEqual(ftSBBtnCategory.items[2].settingBooleanRenderer.itemId, 'sb_btn_outro');
    assert.strictEqual(ftSBBtnCategory.items[3].settingBooleanRenderer.itemId, 'sb_btn_selfpromo');
    assert.strictEqual(ftSBBtnCategory.items[4].settingBooleanRenderer.itemId, 'sb_btn_preview');
    assert.strictEqual(ftSBBtnCategory.items[5].settingBooleanRenderer.itemId, 'sb_btn_music_offtopic');
    console.log(" ✓ Injected interactive Fast-Tube General, SB Auto-Skip & SB Skip Button categories with 17 total granular toggles");

    // Test toggle via resolveCommand
    // Simulate user toggling "Auto-Skip: Previews & Recaps" to ON
    const toggleCommand = {
        fastTubeOption: 'sb_auto_preview',
        fastTubeValue: true
    };
    global._yttv.testModule.instance.resolveCommand(toggleCommand);
    assert.strictEqual(ftSBAutoCategory.items[5].settingBooleanRenderer.enabled, true, "sb_auto_preview enabled state updated");
    assert(localStorage.getItem('fast_tube_config').includes('"sb_auto_preview":true'), "Settings persisted to localStorage");
    console.log(" ✓ resolveCommand successfully handled per-category toggle & persisted to localStorage");

    console.log("=== 6. Testing Network-Level Ad Blocking ===");
    const adRes = await window.fetch('https://www.youtube.com/api/stats/ads?ad_type=1');
    const adData = await adRes.json();
    assert.deepStrictEqual(adData, {}, "Ad endpoint blocked with empty object");
    console.log(" ✓ Blocked /api/stats/ads");

    console.log("=== 7. Testing SponsorBlock Segment Skipping ===");
    await new Promise(r => setTimeout(r, 600));
    assert(listeners['timeupdate'] !== undefined, "timeupdate listener attached");
    mockVideo.currentTime = 16.0;
    listeners['timeupdate']();
    assert.strictEqual(mockVideo.currentTime, 30.0, "Video skipped to 30.0s end of sponsor segment");
    console.log(" ✓ Video successfully skipped from 16.0s to 30.0s via SponsorBlock");

    assert(appendedStyles.includes('ytlr-ad-renderer'), "CSS includes ytlr-ad-renderer");
    console.log(" ✓ Verified Leanback CSS rules");

    console.log("=== ALL HOME SCREEN, VIDEO PLAYBACK, AND CONFIGURABLE SETTINGS TESTS PASSED! ===");
    process.exit(0);
})();
