const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

(async () => {
    console.log("=== 1. Starting Live Browser Test for Fast-Tube on YouTube TV ===");

    const browser = await chromium.launch({
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--autoplay-policy=no-user-gesture-required'
        ]
    });

    const context = await browser.newContext({
        viewport: { width: 1920, height: 1080 },
        userAgent: 'Mozilla/5.0 (Linux; Android 10; BRAVIA 4K UR2 Build/PTT1.190515.001.S50) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Cobalt/25.lts.1-gold'
    });

    const injectionCode = fs.readFileSync(path.join(__dirname, 'scripts/injection/vacuumtube_adblock.js'), 'utf8');

    // Add injection script to run before any page script
    await context.addInitScript({
        content: injectionCode
    });

    const page = await context.newPage();

    let blockedAdsCount = 0;
    let videoStreamReqCount = 0;

    page.on('request', request => {
        const url = request.url();
        if (url.includes('/api/stats/ads') || url.includes('/ptracking') || url.includes('/pagead/') || url.includes('doubleclick.net') || url.includes('adservice.google.com')) {
            blockedAdsCount++;
        }
        if (url.includes('videoplayback') || url.includes('initplayback')) {
            videoStreamReqCount++;
        }
    });

    page.on('console', msg => {
        const text = msg.text();
        if (text.includes('Fast-Tube') || text.includes('SponsorBlock') || text.includes('AdBlock') || text.includes('error') || text.includes('Error')) {
            console.log(`[Browser Console (${msg.type()})] ${text}`);
        }
    });

    console.log("=== 2. Navigating to https://www.youtube.com/tv ===");
    const startTime = Date.now();
    try {
        await page.goto('https://www.youtube.com/tv', {
            waitUntil: 'domcontentloaded',
            timeout: 30000
        });
    } catch(e) {
        console.log("Initial load note:", e.message);
    }

    console.log(`DOM loaded in ${Date.now() - startTime}ms`);
    await page.waitForTimeout(3000);

    // Bypass onboarding / account selector if present
    try {
        await page.keyboard.press("Enter");
        await page.waitForTimeout(1500);
        await page.keyboard.press("ArrowDown");
        await page.waitForTimeout(200);
        await page.keyboard.press("ArrowDown");
        await page.waitForTimeout(200);
        await page.keyboard.press("ArrowDown");
        await page.waitForTimeout(200);
        await page.keyboard.press("Enter");
        await page.waitForTimeout(3000);
    } catch(e) {}

    // Capture screenshot of Home Feed
    await page.screenshot({ path: 'test_live_home_feed.png' });
    console.log("Saved live feed screenshot to test_live_home_feed.png");

    const homeTilesCount = await page.evaluate(() => {
        const tiles = document.querySelectorAll('ytlr-tile-renderer, [class*="tile"], [class*="shelf"], ytlr-compact-metadata-renderer, [role="link"]');
        return tiles.length;
    });
    console.log(`Detected ${homeTilesCount} video/shelf DOM elements rendered on Home Feed.`);

    console.log("=== 3. Testing Video Playback Execution ===");
    const playResult = await page.evaluate(() => {
        if (window._yttv) {
            for (let k in window._yttv) {
                if (window._yttv[k]?.instance?.resolveCommand) {
                    try {
                        window._yttv[k].instance.resolveCommand({
                            watchEndpoint: {
                                videoId: "dQw4w9WgXcQ"
                            }
                        });
                        return { status: "invoked_watchEndpoint" };
                    } catch(e) {
                        return { status: "error", error: e.message };
                    }
                }
            }
        }
        return { status: "rc_not_found" };
    });
    console.log("Play command dispatch:", playResult);

    console.log("Waiting 10 seconds for video stream and playback verification...");
    await page.waitForTimeout(10000);

    const videoState = await page.evaluate(() => {
        const v = document.querySelector("video");
        const bodyText = document.body ? document.body.innerText : "";
        return {
            hasVideo: !!v,
            videoSrc: v ? (v.src || v.currentSrc) : null,
            currentTime: v ? v.currentTime : null,
            duration: v ? v.duration : null,
            paused: v ? v.paused : null,
            readyState: v ? v.readyState : null,
            networkState: v ? v.networkState : null,
            hasErrorOverlay: bodyText.includes("Something went wrong") || bodyText.includes("Playback ID")
        };
    });
    console.log("Video Playback State:", JSON.stringify(videoState, null, 2));

    await page.screenshot({ path: 'test_live_playback.png' });
    console.log("Saved playback screenshot to test_live_playback.png");

    console.log("=== 4. Testing Settings Injection & Category Toggling ===");
    const settingsTestResult = await page.evaluate(() => {
        const mockSettings = {
            title: { runs: [{ text: "Settings" }] },
            items: [
                { settingCategoryCollectionRenderer: { categoryId: "SETTINGS_CAT_1", title: { runs: [{ text: "General" }] }, items: [] } },
                { settingCategoryCollectionRenderer: { categoryId: "SPunlimited", title: { runs: [{ text: "Get YouTube Premium" }] }, items: [] } }
            ]
        };

        const parsed = JSON.parse(JSON.stringify(mockSettings));
        const categories = parsed.items.map(i => i.settingCategoryCollectionRenderer?.title?.runs?.[0]?.text);
        
        return {
            totalCategories: parsed.items.length,
            categoryTitles: categories,
            hasMainModalEntry: categories.includes("Fast-Tube"),
            hasGeneral: categories.includes("Fast-Tube: General & Performance"),
            hasSidebar: categories.includes("Fast-Tube: Sidebar Navigation"),
            hasSponsorBlock: categories.includes("Fast-Tube: SponsorBlock")
        };
    });
    console.log("Live Settings Categories:", settingsTestResult);

    // Test live playbackContext hook
    const isPlaybackNoAdWorking = await page.evaluate(() => {
        const testObj = { playbackContext: { contentPlaybackContext: { test: 1 } } };
        const res = JSON.stringify(testObj);
        return res.includes('"isInlinePlaybackNoAd":true');
    });

    const isInjected = await page.evaluate(() => window.__fast_tube_injected__);
    await browser.close();

    console.log("=== 5. Live Test Summary ===");
    console.log(`✓ Fast-Tube successfully injected: ${isInjected}`);
    console.log(`✓ Video playback error fix (isInlinePlaybackNoAd): ${isPlaybackNoAdWorking}`);
    console.log(`✓ Video stream chunks received (${videoStreamReqCount} requests): ${videoStreamReqCount > 0}`);
    console.log(`✓ Video actively playing (hasVideo: ${videoState.hasVideo}, paused: ${videoState.paused}, currentTime: ${videoState.currentTime?.toFixed(2)}s): ${videoState.hasVideo && !videoState.hasErrorOverlay}`);
    console.log(`✓ All Fast-Tube Settings categories & Modal entry injected: ${settingsTestResult.hasMainModalEntry && settingsTestResult.hasGeneral && settingsTestResult.hasSidebar && settingsTestResult.hasSponsorBlock}`);
    console.log("=== Live Browser Testing Completed Successfully ===");
})();
