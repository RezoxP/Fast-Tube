import sha256 from '../tiny-sha256.js';
import { configRead } from '../config.js';
import { showToast } from '../ui/ytUI.js';
import { t } from 'i18next';

// Copied from https://github.com/ajayyy/SponsorBlock/blob/da1a535de784540ee10166a75a3eb8537073838c/src/config.ts#L113-L134
const barTypes = {
  sponsor: {
    color: '#00d400',
    opacity: '0.7',
    name: t('sponsorblock.segments.sponsor') || 'sponsored segment'
  },
  intro: {
    color: '#00ffff',
    opacity: '0.7',
    name: t('sponsorblock.segments.intro') || 'intro'
  },
  outro: {
    color: '#0202ed',
    opacity: '0.7',
    name: t('sponsorblock.segments.outro') || 'outro'
  },
  interaction: {
    color: '#cc00ff',
    opacity: '0.7',
    name: t('sponsorblock.segments.interaction') || 'interaction reminder'
  },
  selfpromo: {
    color: '#ffff00',
    opacity: '0.7',
    name: t('sponsorblock.segments.selfpromo') || 'self-promotion'
  },
  preview: {
    color: '#008fd6',
    opacity: '0.7',
    name: t('sponsorblock.segments.preview') || 'recap or preview'
  },
  filler: {
    color: "#7300FF",
    opacity: "0.9",
    name: t('sponsorblock.segments.filler') || 'tangents'
  },
  music_offtopic: {
    color: '#ff9900',
    opacity: '0.7',
    name: t('sponsorblock.segments.music_offtopic') || 'non-music part'
  },
  poi_highlight: {
    color: '#9b044c',
    opacity: '0.7',
    name: t('sponsorblock.segments.poi_highlight') || 'highlight'
  }
};

const sponsorblockAPI = 'https://sponsor.ajay.app/api';

class SponsorBlockHandler {
  video = null;
  active = true;

  attachVideoTimeout = null;
  buildOverlayTimeout = null;
  nextSkipTimeout = null;
  sliderInterval = null;
  nudgeTimeout = null;
  nudgeSecondTimeout = null;

  observer = null;
  scheduleSkipHandler = () => {
    this.scheduleSkip();
  };
  durationChangeHandler = () => {
    this.buildOverlay();
  };
  segments = null;
  skippableCategories = [];
  manualSkippableCategories = [];
  skippedCategories = new Map();

  constructor(videoID) {
    this.videoID = videoID;
  }

  async init() {
    const videoHash = sha256(this.videoID).substring(0, 4);
    const categories = [
      'sponsor',
      'intro',
      'outro',
      'interaction',
      'selfpromo',
      'preview',
      'filler',
      'music_offtopic',
      'poi_highlight'
    ];
    let resp;
    try {
      resp = await fetch(
        `${sponsorblockAPI}/skipSegments/${videoHash}?categories=${encodeURIComponent(
          JSON.stringify(categories)
        )}`
      );
    } catch (e) {
      return;
    }
    if (!this.active) return;

    let results;
    try {
      results = await resp.json();
    } catch (e) {
      return;
    }
    if (!this.active) return;

    const result = results.find((v) => v.videoID === this.videoID);

    if (!result || !result.segments || !result.segments.length) {
      return;
    }

    this.segments = result.segments.slice();
    this.segments.sort((s1, s2) => s1.segment[0] - s2.segment[0]);
    this.manualSkippableCategories = configRead('sponsorBlockManualSkips');
    this.skippableCategories = this.getSkippableCategories();

    // The promoted actions row (Description / Subscribe / ...) builds its item
    // list when the player bar mounts, which usually happens BEFORE this fetch
    // resolves. If the row is already on screen without the highlight button,
    // give it a one-shot focus nudge (ArrowDown + ArrowUp, exactly like a
    // remote user moving through the row) so zylon rebuilds it with the
    // "Skip to highlight" button in place.
    this.nudgeTimeout = setTimeout(() => {
      if (!this.active) return;
      try {
        const hasBtn = [...document.querySelectorAll('[aria-label]')]
          .some((el) => /skip to highlight/i.test(el.getAttribute('aria-label') || ''));
        if (hasBtn) return;
        const press = (key, keyCode) => {
          const e = new KeyboardEvent('keydown', {
            key, code: key, bubbles: true, cancelable: true, composed: true
          });
          Object.defineProperty(e, 'keyCode', { get: () => keyCode });
          document.dispatchEvent(e);
        };
        press('ArrowDown', 40);
        this.nudgeSecondTimeout = setTimeout(() => {
          if (!this.active) return;
          press('ArrowUp', 38);
        }, 150);
      } catch (e) { }
    }, 1500);

    // PERF: never run getBoundingClientRect or DOM queries inside scheduleSkipHandler.
    // That handler runs on every single 'timeupdate' (4-60x per sec); running reflows
    // causes dropped frames and severe stuttering on low-end devices.

    this.attachVideo();
    this.buildOverlay();
  }

  getSkippableCategories() {
    const skippableCategories = [];
    if (configRead('enableSponsorBlockSponsor')) {
      skippableCategories.push('sponsor');
    }
    if (configRead('enableSponsorBlockIntro')) {
      skippableCategories.push('intro');
    }
    if (configRead('enableSponsorBlockOutro')) {
      skippableCategories.push('outro');
    }
    if (configRead('enableSponsorBlockInteraction')) {
      skippableCategories.push('interaction');
    }
    if (configRead('enableSponsorBlockSelfPromo')) {
      skippableCategories.push('selfpromo');
    }
    if (configRead('enableSponsorBlockPreview')) {
      skippableCategories.push('preview');
    }
    if (configRead('enableSponsorBlockFiller')) {
      skippableCategories.push('filler');
    }
    if (configRead('enableSponsorBlockMusicOfftopic')) {
      skippableCategories.push('music_offtopic');
    }
    return skippableCategories;
  }

  attachVideo() {
    clearTimeout(this.attachVideoTimeout);
    this.attachVideoTimeout = null;

    this.video = document.querySelector('video');
    if (!this.video) {
      // PERF: no logging here - this retries every 100ms until the player mounts.
      this.attachVideoTimeout = setTimeout(() => this.attachVideo(), 100);
      return;
    }

    this.video.addEventListener('play', this.scheduleSkipHandler);
    this.video.addEventListener('pause', this.scheduleSkipHandler);
    this.video.addEventListener('timeupdate', this.scheduleSkipHandler);
    this.video.addEventListener('durationchange', this.durationChangeHandler);
  }

  buildOverlay() {
    if (!this.active) return;
    if (this.segmentsoverlay) return;

    if (!this.video || !this.video.duration) {
      return;
    }

    const videoDuration = this.video.duration;
    const slider = document.querySelector('div[idomkey="slider"]');
    if (!slider) {
      clearTimeout(this.buildOverlayTimeout);
      this.buildOverlayTimeout = setTimeout(() => this.buildOverlay(), 100);
      return;
    }

    this.segmentsoverlay = document.createElement('div');

    this.segmentsoverlay.classList.add('ytLrProgressBarSlider', 'ytLrProgressBarSliderRectangularProgressBar');
    this.segmentsoverlay.style.setProperty('z-index', '10', 'important');
    this.segmentsoverlay.style.setProperty('background-color', 'rgba(0, 0, 0, 0)', 'important');
    this.segmentsoverlay.style.setProperty('width', '72rem', 'important');
    this.segmentsoverlay.style.setProperty('left', '4rem', 'important');
    const sliderRect = slider.getBoundingClientRect();
    const isOldUI = !document.querySelector('div[idomkey="Metadata-Section"]');
    if (isOldUI && sliderRect) {
      this.segmentsoverlay.style.setProperty('top', `${sliderRect.top}px`, 'important');
    }
    if (!slider.classList.contains('ytLrProgressBarSlider')) {
      for (let i = 0; i < slider.classList.length; i++) {
        this.segmentsoverlay.classList.add(slider.classList[i]);
      }
      this.segmentsoverlay.style.setProperty('height', `${sliderRect.height}px`, 'important');
      this.segmentsoverlay.style.setProperty('bottom', `${sliderRect.bottom - sliderRect.top}px`, 'important');      
    }
    this.segments.forEach((segment) => {
      const [start, end] = segment.segment;
      const barType = barTypes[segment.category] || {
        color: 'blue',
        opacity: 0.7
      };

      const leftPercent = videoDuration ? (100.0 * start) / videoDuration : 0;
      const widthPercent = videoDuration ? (100.0 * (end - start)) / videoDuration : 0;

      const elm = document.createElement('div');
      elm.style.setProperty('background-color', barType.color, 'important');
      elm.style.setProperty('opacity', barType.opacity, 'important');
      elm.style.setProperty('height', '100%', 'important');
      elm.style.setProperty('width', `${segment.category === 'poi_highlight' ? 1 : widthPercent}%`, 'important');
      elm.style.setProperty('left', `${leftPercent}%`, 'important');
      elm.style.setProperty('position', 'absolute', 'important');
      this.segmentsoverlay.appendChild(elm);
    });

    // PERF: this observer lives on the progress-bar subtree, which mutates
    // constantly during playback. The old callback ran a document-wide
    // querySelector and two style.setProperty calls for EVERY mutation batch
    // (forced style recalcs). Cache the progress-bar node, early-exit the
    // removedNodes scan, and only touch the style when visibility actually
    // flips.
    this.overlayHidden = false;
    this.progressBar = null;

    this.observer = new MutationObserver((mutations) => {
      if (!this.active || !this.segmentsoverlay) return;

      if (this.slider) {
        for (let i = 0; i < mutations.length; i++) {
          const removed = mutations[i].removedNodes;
          if (!removed || !removed.length) continue;
          for (let j = 0; j < removed.length; j++) {
            if (removed[j] === this.segmentsoverlay) {
              if (this.active && this.slider) {
                this.slider.appendChild(this.segmentsoverlay);
              }
              break;
            }
          }
        }
      }

      let progressBar = this.progressBar;
      if (!progressBar || !progressBar.isConnected) {
        progressBar = this.progressBar = document.querySelector('ytlr-progress-bar');
      }
      const hidden = progressBar ? progressBar.getAttribute('hybridnavfocusable') === 'false' : false;
      if (hidden !== this.overlayHidden) {
        this.overlayHidden = hidden;
        this.segmentsoverlay.style.setProperty('display', hidden ? 'none' : 'block', 'important');
      }
    });

    this.sliderInterval = setInterval(() => {
      if (!this.active) {
        if (this.sliderInterval) {
          clearInterval(this.sliderInterval);
          this.sliderInterval = null;
        }
        return;
      }
      this.slider = document.querySelector('ytlr-redux-connect-ytlr-progress-bar');
      if (this.slider) {
        clearInterval(this.sliderInterval);
        this.sliderInterval = null;
        if (!this.active || !this.segmentsoverlay) return;
        this.observer.observe(this.slider, {
          childList: true,
          subtree: true
        });
        this.slider.appendChild(this.segmentsoverlay);
      }
    }, 500);
  }

  scheduleSkip() {
    clearTimeout(this.nextSkipTimeout);
    this.nextSkipTimeout = null;

    // PERF: scheduleSkip runs on every single 'timeupdate' (4-60x per second
    // while playing). No console logging may ever happen on this path - on
    // Cobalt each log line is a synchronous IPC round-trip.
    if (!this.active) return;
    if (!this.video || this.video.paused) return;
    if (!this.segments || !this.segments.length) return;

    // Sometimes timeupdate event (that calls scheduleSkip) gets fired right before
    // already scheduled skip routine below. Let's just look back a little bit
    // and, in worst case, perform a skip at negative interval (immediately)...
    // PERF: segments are already sorted in init(); find next segment without
    // allocating/sorting temporary arrays on every frame.
    const currentTime = this.video.currentTime;
    let segment = null;
    for (let i = 0; i < this.segments.length; i++) {
      const seg = this.segments[i];
      // Match if playback is currently inside the segment OR approaching it (0.3s tolerance)
      if (seg.segment[1] > currentTime && (seg.segment[0] <= currentTime || seg.segment[0] > currentTime - 0.3)) {
        segment = seg;
        break;
      }
    }

    if (!segment) return;

    const [start, end] = segment.segment;
    const delay = Math.max(0, (start - currentTime) * 1000);

    this.nextSkipTimeout = setTimeout(() => {
      if (!this.active) return;
      if (!this.video || this.video.paused) return;
      if (!this.skippableCategories.includes(segment.category)) return;

      const skipName = barTypes[segment.category]?.name || segment.category;
      if (!this.manualSkippableCategories.includes(segment.category)) {
        const wasSkippedBefore = this.skippedCategories.get(segment.UUID);
        if (wasSkippedBefore) {
          wasSkippedBefore.count++;
          wasSkippedBefore.lastSkipped = Date.now();
          this.skippedCategories.set(segment.UUID, wasSkippedBefore);

          if (wasSkippedBefore.lastSkipped - wasSkippedBefore.firstSkipped < 1000) {
            if (!wasSkippedBefore.hasShownToast) {
              if (configRead('enableSponsorBlockToasts')) {
                showToast('SponsorBlock', t('sponsorblock.toasts.notSkipping', { segment: skipName, count: wasSkippedBefore.count }));
              }
              wasSkippedBefore.hasShownToast = true;
              this.skippedCategories.set(segment.UUID, wasSkippedBefore);
            }
            return;
          }
        } else {
          this.skippedCategories.set(segment.UUID, {
            count: 1,
            firstSkipped: Date.now(),
            lastSkipped: Date.now(),
            hasShownToast: false
          });
        }
        if (configRead('enableSponsorBlockToasts')) {
          showToast('SponsorBlock', t('sponsorblock.toasts.skipping', { segment: skipName }));
        }
        if (this.video.duration - end < 1) {
          this.video.currentTime = end - 1;
        } else this.video.currentTime = end;
        this.scheduleSkip();
      }
    }, delay);
  }

  destroy() {
    this.active = false;

    if (this.nextSkipTimeout) {
      clearTimeout(this.nextSkipTimeout);
      this.nextSkipTimeout = null;
    }

    if (this.attachVideoTimeout) {
      clearTimeout(this.attachVideoTimeout);
      this.attachVideoTimeout = null;
    }

    if (this.buildOverlayTimeout) {
      clearTimeout(this.buildOverlayTimeout);
      this.buildOverlayTimeout = null;
    }

    if (this.nudgeTimeout) {
      clearTimeout(this.nudgeTimeout);
      this.nudgeTimeout = null;
    }

    if (this.nudgeSecondTimeout) {
      clearTimeout(this.nudgeSecondTimeout);
      this.nudgeSecondTimeout = null;
    }

    if (this.sliderInterval) {
      clearInterval(this.sliderInterval);
      this.sliderInterval = null;
    }

    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }

    if (this.segmentsoverlay) {
      this.segmentsoverlay.remove();
      this.segmentsoverlay = null;
    }
    this.progressBar = null;
    this.slider = null;
    this.overlayHidden = false;

    if (this.video) {
      this.video.removeEventListener('play', this.scheduleSkipHandler);
      this.video.removeEventListener('pause', this.scheduleSkipHandler);
      this.video.removeEventListener('timeupdate', this.scheduleSkipHandler);
      this.video.removeEventListener(
        'durationchange',
        this.durationChangeHandler
      );
      this.video = null;
    }

    this.skippedCategories.clear();
  }
}

// When this global variable was declared using let and two consecutive hashchange
// events were fired (due to bubbling? not sure...) the second call handled below
// would not see the value change from first call, and that would cause multiple
// SponsorBlockHandler initializations... This has been noticed on Chromium 38.
// This either reveals some bug in chromium/webpack/babel scope handling, or
// shows my lack of understanding of javascript. (or both)
window.sponsorblock = null;

// The video ID used to be reliably present as ?v=<id> in the location hash.
// The current leanback app canonicalizes watch URLs (often via history
// .replaceState, which fires no hashchange) and may drop the ?v= parameter
// entirely, so discovery falls back to the live player state and, as a last
// resort, the watch metadata thumbnails.
function sbExtractVideoID() {
  const fromHash = location.hash.match(/[?&]v=([A-Za-z0-9_-]{11})/);
  if (fromHash) return fromHash[1];
  try {
    const id = document.querySelector('.html5-video-player')?.getVideoData?.()?.video_id;
    if (id && /^[A-Za-z0-9_-]{11}$/.test(id)) return id;
  } catch (e) { }
  const img = document.querySelector('ytlr-watch-page img[src*="/vi/"]');
  if (img) {
    const m = (img.getAttribute('src') || '').match(/\/vi\/([A-Za-z0-9_-]{11})\//);
    if (m) return m[1];
  }
  return null;
}

// Because the app can switch routes without firing hashchange (replaceState)
// and the player state appears slightly after the route, a lightweight
// watchdog keeps the handler in sync with the actually-playing video.
//
function sbEnsureHandler() {
  const hash = location.hash;
  const onWatchRoute = hash.indexOf('#/watch') === 0;
  const videoID = onWatchRoute ? sbExtractVideoID() : null;

  if (!videoID) {
    // Left the watch route (or the route is still settling): drop the handler
    // so segments from a previous video are never reused.
    if (window.sponsorblock) {
      try {
        window.sponsorblock.destroy();
      } catch (err) {
        console.warn('window.sponsorblock.destroy() failed!', err);
      }
      window.sponsorblock = null;
    }
    return;
  }

  // Fast path: already bound to the currently playing video.
  if (window.sponsorblock && window.sponsorblock.videoID === videoID) return;

  if (window.sponsorblock) {
    try {
      window.sponsorblock.destroy();
    } catch (err) {
      console.warn('window.sponsorblock.destroy() failed!', err);
    }
    window.sponsorblock = null;
  }

  if (configRead('enableSponsorBlock')) {
    window.sponsorblock = new SponsorBlockHandler(videoID);
    window.sponsorblock.init();
  }
}

window.addEventListener('hashchange', sbEnsureHandler, false);
sbEnsureHandler();
let sbWatchdogInterval = setInterval(sbEnsureHandler, 1000);
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    if (sbWatchdogInterval) {
      clearInterval(sbWatchdogInterval);
      sbWatchdogInterval = null;
    }
  } else if (!sbWatchdogInterval) {
    sbWatchdogInterval = setInterval(sbEnsureHandler, 1000);
    sbEnsureHandler();
  }
});
