// Fast-Tube Injection Script
// Derived from the principles of VacuumTube
// Implements basic ad-blocking and SponsorBlock integration for YouTube on Cobalt

console.log("Fast-Tube: Initializing VacuumTube patches...");

// --- Ad Blocking ---
// We intercept network requests by overriding fetch and XMLHttpRequest
const originalFetch = window.fetch;
window.fetch = async function(...args) {
    const url = typeof args[0] === 'string' ? args[0] : args[0].url;
    
    // Block typical YouTube ad domains and endpoints
    if (url.includes('/api/stats/ads') || 
        url.includes('/ptracking') || 
        url.includes('/pagead/')) {
        console.log("Fast-Tube: Blocked Ad Request -> " + url);
        return new Response(null, { status: 200, statusText: "OK" });
    }
    
    // For video playback requests, we might strip out ad slots from the JSON
    if (url.includes('/youtubei/v1/player')) {
        const response = await originalFetch.apply(this, args);
        try {
            const clone = response.clone();
            const data = await clone.json();
            
            // Remove ad placements
            if (data.adPlacements) {
                delete data.adPlacements;
                delete data.playerAds;
                console.log("Fast-Tube: Removed ads from player response");
            }
            
            return new Response(JSON.stringify(data), {
                status: response.status,
                statusText: response.statusText,
                headers: response.headers
            });
        } catch (e) {
            return response;
        }
    }

    return originalFetch.apply(this, args);
};

// --- SponsorBlock Integration ---
// Simplified example of checking a video against SponsorBlock API
let currentVideoId = null;
let sponsorSegments = [];

function checkSponsorBlock(videoId) {
    if (!videoId || videoId === currentVideoId) return;
    currentVideoId = videoId;
    
    console.log("Fast-Tube: Fetching SponsorBlock segments for " + videoId);
    originalFetch(`https://sponsor.ajay.app/api/skipSegments?videoID=${videoId}&categories=["sponsor","interaction","intro","outro"]`)
        .then(res => res.json())
        .then(data => {
            sponsorSegments = data.map(s => ({ start: s.segment[0], end: s.segment[1] }));
            console.log("Fast-Tube: Loaded segments", sponsorSegments);
        })
        .catch(err => {
            console.log("Fast-Tube: No sponsor segments found.");
            sponsorSegments = [];
        });
}

// Monitor video element for time updates
setInterval(() => {
    const video = document.querySelector('video');
    if (!video) return;
    
    // Extract Video ID from URL or page context
    const urlParams = new URLSearchParams(window.location.search);
    const videoId = urlParams.get('v');
    if (videoId) checkSponsorBlock(videoId);

    // Skip sponsored segments
    if (sponsorSegments.length > 0 && !video.paused) {
        for (const segment of sponsorSegments) {
            if (video.currentTime >= segment.start && video.currentTime < segment.end) {
                console.log(`Fast-Tube: Skipping segment ${segment.start} - ${segment.end}`);
                video.currentTime = segment.end;
            }
        }
    }
}, 500);

// Hide ad banners via CSS
const style = document.createElement('style');
style.innerHTML = `
    ytd-ad-slot-renderer,
    ytd-promoted-sparkles-web-renderer,
    .ytd-display-ad-renderer,
    .ytp-ad-overlay-container,
    .ytp-ad-message-container {
        display: none !important;
    }
`;
document.head.appendChild(style);

console.log("Fast-Tube: Patches applied successfully.");
