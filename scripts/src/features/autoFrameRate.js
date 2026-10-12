import { configRead, configChangeEmitter } from "../config.js";
import { onRoute } from "../utils/routeObserver.js";

let attachedPlayer = null;
let attachedVideo = null;
let frameRatePollAttempts = 0;
const FRAME_RATE_MAX_ATTEMPTS = 20;
let frameRatePollTimeout = null;
let pauseResumeTimeout = null;
let lastAppliedFps = null;

function attachToVideoPlayer() {
    if (!configRead('autoFrameRate')) return;

    const player = document.querySelector('.html5-video-player');
    const video = document.querySelector('video');
    if (!player || !video) {
        if (++frameRatePollAttempts < FRAME_RATE_MAX_ATTEMPTS) {
            clearTimeout(frameRatePollTimeout);
            frameRatePollTimeout = setTimeout(attachToVideoPlayer, 1000);
        }
        return;
    }
    clearTimeout(frameRatePollTimeout);
    frameRatePollTimeout = null;

    if (attachedPlayer === player && attachedPlayer.isConnected) return;
    attachedPlayer = player;
    attachedVideo = video;

    const handlePlaybackStart = () => {
        try {
            if (window.location.href.indexOf('watch') === -1) return;
            const statsForNerds = player.getStatsForNerds ? player.getStatsForNerds() : null;
            if (!statsForNerds || !statsForNerds.resolution) {
                // If stats are not yet populated on initial play event, retry once after short delay
                setTimeout(handlePlaybackStart, 500);
                return;
            }

            const resolutionMatch = statsForNerds.resolution.match(/(\d+)x(\d+)@([\d.]+)/);
            const pauseFor = configRead('autoFrameRatePauseVideoFor');

            if (resolutionMatch) {
                const fps = parseFloat(resolutionMatch[3]);
                if (fps === lastAppliedFps) return;
                lastAppliedFps = fps;

                if (window.h5vcc && window.h5vcc.fasttube && window.h5vcc.fasttube.SetFrameRate) {
                    if (!configRead('autoFrameRate')) {
                        window.h5vcc.fasttube.SetFrameRate(0);
                        return;
                    }
                    if (pauseFor > 0) {
                        video.pause();
                        clearTimeout(pauseResumeTimeout);
                        pauseResumeTimeout = setTimeout(() => {
                            video.play();
                        }, pauseFor);
                    }
                    window.h5vcc.fasttube.SetFrameRate(fps);
                }
            }
        } catch (e) {
            console.error('Error in auto frame rate handling:', e);
        }
    };

    player.addEventListener('onPlaybackStartExternal', handlePlaybackStart);
    video.addEventListener('playing', handlePlaybackStart);
}

const resetFrameRate = () => {
    clearTimeout(frameRatePollTimeout);
    frameRatePollTimeout = null;
    clearTimeout(pauseResumeTimeout);
    pauseResumeTimeout = null;
    lastAppliedFps = null;
    if (window.h5vcc && window.h5vcc.fasttube && window.h5vcc.fasttube.SetFrameRate) {
        window.h5vcc.fasttube.SetFrameRate(0);
    }
};

onRoute((url) => {
    if (url.indexOf('watch') === -1) {
        resetFrameRate();
    } else if (configRead('autoFrameRate')) {
        frameRatePollAttempts = 0;
        attachToVideoPlayer();
    }
});

configChangeEmitter.addEventListener('configChange', (event) => {
    if (event.detail.key === 'autoFrameRate') {
        if (event.detail.value) {
            frameRatePollAttempts = 0;
            attachToVideoPlayer();
        } else {
            resetFrameRate();
        }
    }
});

attachToVideoPlayer();
