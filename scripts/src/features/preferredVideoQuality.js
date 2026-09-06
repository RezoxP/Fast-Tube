import { configRead, configChangeEmitter } from "../config.js";

const SELECTORS = {
    PLAYER: '.html5-video-player',
};

const EVENTS = {
    YT_STATE_CHANGE: 'onStateChange',
    CONFIG_CHANGE: 'configChange',
};

const CONFIG_KEYS = {
    QUALITY: 'preferredVideoQuality',
};

class PreferredQualityHandler {
    #player = null;
    #attachTimeout = null;
    #lastVideoId = null;
    #hasAppliedQuality = false;
    #pollAttempts = 0;
    #maxPollAttempts = 20;

    constructor() {
        this.init();
    }

    init() {
        this.#setupConfigListener();
        this.#setupRouteListener();
        this.#pollForPlayer();
    }

    #setupRouteListener() {
        window.addEventListener('hashchange', () => {
            if (location.hash.includes('watch')) {
                this.#pollAttempts = 0;
                this.#pollForPlayer();
            }
        });
    }

    #pollForPlayer() {
        clearTimeout(this.#attachTimeout);

        const preferredQuality = configRead(CONFIG_KEYS.QUALITY);
        if (!preferredQuality || preferredQuality === 'auto') {
            this.#pollAttempts = 0;
            return;
        }

        const playerElement = document.querySelector(SELECTORS.PLAYER);

        if (!playerElement) {
            if (++this.#pollAttempts < this.#maxPollAttempts) {
                this.#attachTimeout = setTimeout(() => this.#pollForPlayer(), 500);
            }
            return;
        }

        this.#pollAttempts = 0;
        if (this.#player === playerElement) return;
        this.#player = playerElement;

        this.#player.addEventListener(EVENTS.YT_STATE_CHANGE, this.#handleStateChange);

        this.#handleStateChange();
    }

    #setupConfigListener() {
        configChangeEmitter.addEventListener(EVENTS.CONFIG_CHANGE, (ev) => {
            if (ev.detail?.key === CONFIG_KEYS.QUALITY) {
                if (ev.detail?.value !== 'auto') {
                    this.#pollAttempts = 0;
                    this.#pollForPlayer();
                }
                this.#applyQuality();
            }
        });
    }

    #handleStateChange = () => {
        const preferredQuality = configRead(CONFIG_KEYS.QUALITY);
        if (!preferredQuality || preferredQuality === 'auto' || !this.#player) return;

        const state = this.#player?.getPlayerStateObject?.();
        const videoData = this.#player?.getVideoData?.();
        const videoId = videoData?.video_id;

        if (videoId !== this.#lastVideoId) {
            this.#lastVideoId = videoId;
            this.#hasAppliedQuality = false;
        }

        const stats = this.#player?.getVideoStats ? this.#player.getVideoStats() : {};
        const isShorts = Object.values(stats).some(a => a === 'shortspage');
        if (state?.isPlaying && !this.#hasAppliedQuality && !isShorts) {
            this.#applyQuality();
            this.#hasAppliedQuality = true;
        }
    };

    #applyQuality() {
        const preferredQuality = configRead(CONFIG_KEYS.QUALITY);
        if (!preferredQuality || preferredQuality === 'auto' || !this.#player) return;

        try {
            const quality = this.#determineQuality(preferredQuality);

            if (quality) {
              this.#player.setPlaybackQualityRange(quality, quality)
            }
        } catch (e) {
            console.warn('[PreferredQuality] Failed to apply quality:', e);
        }
    }

    #determineQuality(preference) {
        const availableQualities = this.#player.getAvailableQualityData();
        if (!availableQualities?.length) return 'highres';

        const getQualityValue = (label) => parseInt(label, 10) || 0;
        const targetValue = getQualityValue(preference);

        const match = availableQualities.find(q => getQualityValue(q.qualityLabel) === targetValue);

        return match ? match.quality : 'highres';
    }
}

window.preferredVideoQualityHandler = new PreferredQualityHandler();
