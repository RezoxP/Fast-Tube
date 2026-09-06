import { configRead, configChangeEmitter } from "../config.js";

let attachedPlayer = null;
let frameRatePollAttempts = 0;
const FRAME_RATE_MAX_ATTEMPTS = 20;

function attachToVideoPlayer() {
    if (!configRead('autoFrameRate')) return;

    const player = document.querySelector('.html5-video-player');
    const video = document.querySelector('video');
    if (!player || !video) {
        if (++frameRatePollAttempts < FRAME_RATE_MAX_ATTEMPTS) {
            setTimeout(attachToVideoPlayer, 1000);
        }
        return;
    }

    if (attachedPlayer === player && attachedPlayer.isConnected) return;
    attachedPlayer = player;
    player.addEventListener('onPlaybackStartExternal', () => {
        try {
            if (window.location.href.indexOf('watch') === -1) return;
            const statsForNerds = player.getStatsForNerds ? player.getStatsForNerds() : null;
            if (!statsForNerds || !statsForNerds.resolution) return;

            const resolutionMatch = statsForNerds.resolution.match(/(\d+)x(\d+)@([\d.]+)/);
            const pauseFor = configRead('autoFrameRatePauseVideoFor');

            if (resolutionMatch) {
                const fps = resolutionMatch[3];
                if (window.h5vcc && window.h5vcc.fasttube && window.h5vcc.fasttube.SetFrameRate) {
                    if (!configRead('autoFrameRate')) {
                        window.h5vcc.fasttube.SetFrameRate(0);
                        return;
                    }
                    if (pauseFor > 0) {
                        video.pause();
                        setTimeout(() => {
                            video.play();
                        }, pauseFor);
                    }
                    window.h5vcc.fasttube.SetFrameRate(parseFloat(fps));
                }
            }
        } catch (e) {
            console.error('Error in auto frame rate handling:', e);
        }
    });
}

const resetFrameRate = () => {
    if (window.h5vcc && window.h5vcc.fasttube && window.h5vcc.fasttube.SetFrameRate) {
        window.h5vcc.fasttube.SetFrameRate(0);
    }
};

window.addEventListener('hashchange', () => {
    if (window.location.href.indexOf('watch') === -1) {
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
