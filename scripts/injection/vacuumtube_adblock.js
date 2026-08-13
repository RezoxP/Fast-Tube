// Fast-Tube Injection Script
// Derived from the principles of VacuumTube
// Implements ad-blocking and SponsorBlock integration for YouTube TV on Cobalt

console.log("Fast-Tube: Initializing VacuumTube patches...");

(function() {
    if (window.__fast_tube_injected__) return;
    window.__fast_tube_injected__ = true;

    // --- Network Request Interception ---
    const originalFetch = window.fetch;
    window.fetch = async function(...args) {
        let url = typeof args[0] === 'string' ? args[0] : (args[0] && args[0].url ? args[0].url : '');
        
        // Block typical YouTube ad domains and stats endpoints
        if (url.includes('/api/stats/ads') || 
            url.includes('/ptracking') || 
            url.includes('/pagead/') ||
            url.includes('googleads.g.doubleclick.net') ||
            url.includes('/youtubei/v1/att/get')) {
            console.log("Fast-Tube: Blocked Ad Request -> " + url);
            return new Response(JSON.stringify({}), { status: 200, statusText: "OK", headers: { 'Content-Type': 'application/json' } });
        }
        
        // Intercept player requests to strip ads & get video ID
        if (url.includes('/youtubei/v1/player')) {
            try {
                if (args[1] && args[1].body) {
                    try {
                        const reqData = JSON.parse(args[1].body);
                        if (reqData && reqData.videoId) {
                            checkSponsorBlock(reqData.videoId);
                        }
                    } catch(e) {}
                }

                const response = await originalFetch.apply(this, args);
                const clone = response.clone();
                const data = await clone.json();
                
                if (data && data.videoDetails && data.videoDetails.videoId) {
                    checkSponsorBlock(data.videoDetails.videoId);
                }

                if (data) {
                    delete data.adPlacements;
                    delete data.playerAds;
                    delete data.adSlots;
                    delete data.adBreakParams;
                    if (data.playbackTracking) {
                        delete data.playbackTracking.atrUrl;
                        delete data.playbackTracking.cpnUrl;
                    }
                    console.log("Fast-Tube: Removed ads from player response");
                }
                
                return new Response(JSON.stringify(data), {
                    status: response.status,
                    statusText: response.statusText,
                    headers: response.headers
                });
            } catch (e) {
                return originalFetch.apply(this, args);
            }
        }

        return originalFetch.apply(this, args);
    };

    // Override XMLHttpRequest for legacy or background network requests
    const origOpen = XMLHttpRequest.prototype.open;
    const origSend = XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.open = function(method, url, ...rest) {
        this._url = url;
        return origOpen.call(this, method, url, ...rest);
    };
    XMLHttpRequest.prototype.send = function(body) {
        if (this._url && (this._url.includes('/api/stats/ads') || this._url.includes('/ptracking') || this._url.includes('/pagead/'))) {
            console.log("Fast-Tube: Blocked XHR Ad Request -> " + this._url);
            return;
        }
        return origSend.call(this, body);
    };

    // --- SponsorBlock Integration ---
    let currentVideoId = null;
    let sponsorSegments = [];

    function checkSponsorBlock(videoId) {
        if (!videoId || videoId === currentVideoId) return;
        currentVideoId = videoId;
        
        console.log("Fast-Tube: Fetching SponsorBlock segments for " + videoId);
        originalFetch(`https://sponsor.ajay.app/api/skipSegments?videoID=${videoId}&categories=["sponsor","interaction","intro","outro","selfpromo","music_offtopic"]`)
            .then(res => res.ok ? res.json() : [])
            .then(data => {
                if (Array.isArray(data)) {
                    sponsorSegments = data.map(s => ({ start: s.segment[0], end: s.segment[1] }));
                    console.log("Fast-Tube: Loaded segments", sponsorSegments);
                } else {
                    sponsorSegments = [];
                }
            })
            .catch(err => {
                sponsorSegments = [];
            });
    }

    // Monitor HTML5 video element for SponsorBlock skipping & Ad fast-forwarding
    setInterval(() => {
        const video = document.querySelector('video');
        if (!video) return;
        
        const hash = window.location.hash;
        if (hash && hash.includes('v=')) {
            const vMatch = hash.match(/v=([a-zA-Z0-9_-]{11})/);
            if (vMatch && vMatch[1]) {
                checkSponsorBlock(vMatch[1]);
            }
        }

        const adContainer = document.querySelector('.ad-interrupting, .ytp-ad-self-ad-badge, .ytp-ad-text');
        if (adContainer && video.duration && !isNaN(video.duration)) {
            console.log("Fast-Tube: Fast-forwarding ad video");
            video.currentTime = video.duration;
        }

        if (sponsorSegments.length > 0 && !video.paused && video.currentTime) {
            for (const segment of sponsorSegments) {
                if (video.currentTime >= segment.start && video.currentTime < (segment.end - 0.2)) {
                    console.log(`Fast-Tube: Skipping sponsor segment ${segment.start} - ${segment.end}`);
                    video.currentTime = segment.end;
                }
            }
        }
    }, 400);

    // Inject CSS to hide ad banners & YouTube Premium promo elements
    const injectStyles = () => {
        if (document.getElementById('fast-tube-styles')) return;
        const style = document.createElement('style');
        style.id = 'fast-tube-styles';
        style.innerHTML = `
            ytd-ad-slot-renderer,
            ytd-promoted-sparkles-web-renderer,
            .ytd-display-ad-renderer,
            .ytp-ad-overlay-container,
            .ytp-ad-message-container,
            .ytp-ad-skip-button-container,
            yt-mealbar-promo-renderer,
            ytd-statement-banner-renderer,
            .badge-style-type-ad {
                display: none !important;
            }
        `;
        (document.head || document.documentElement).appendChild(style);
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', injectStyles);
    } else {
        injectStyles();
    }

    console.log("Fast-Tube: VacuumTube patches active.");
})();
