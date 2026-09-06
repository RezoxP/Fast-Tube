import { configChangeEmitter, configRead } from '../config.js';

let actualClock;
let clockInterval;

// PERF: cache the watch-page node instead of running a querySelector on every
// 1s tick. The node is only re-queried when it gets disconnected from the DOM
// (i.e. after navigating away from the player).
let watchDefaultNode = null;
let clockHidden = false;

configChangeEmitter.addEventListener('configChange', (e) => {
    if (e.detail.key === 'enableClock') {
        toggleClock(e.detail.value);
    } else if (e.detail.key === 'isClock12HourFormat' || e.detail.key === 'clockShowSeconds') {
        if (configRead('enableClock')) {
            // Force a quick update so changes are visible instantly
            updateClock();
        }
    } else if (e.detail.key === 'clockHideWhenVideoPlaying') {
        if (configRead('enableClock') && actualClock) {
            // Reset visibility so the new policy applies on the next tick
            clockHidden = false;
            actualClock.style.display = 'block';
            updateClock();
        }
    }
});

function updateClock() {
    if (!actualClock) return;
    const now = new Date();
    const is12HourFormat = configRead('isClock12HourFormat');
    const secondsEnabled = configRead('clockShowSeconds');

    if (configRead('clockHideWhenVideoPlaying')) {
        if (!watchDefaultNode || !watchDefaultNode.isConnected) {
            watchDefaultNode = document.querySelector('ytlr-watch-default');
        }
        const shouldHide = !!(watchDefaultNode && watchDefaultNode.getAttribute('hybridnavfocusable') === 'true');
        if (shouldHide !== clockHidden) {
            clockHidden = shouldHide;
            actualClock.style.display = shouldHide ? 'none' : 'block';
        }
    } else if (clockHidden) {
        clockHidden = false;
        actualClock.style.display = 'block';
    }

    let hours = now.getHours();
    if (is12HourFormat) {
        hours = hours % 12 || 12;
    }

    hours = hours.toString().padStart(2, '0');
    const minutes = now.getMinutes().toString().padStart(2, '0');
    const seconds = now.getSeconds().toString().padStart(2, '0');
    actualClock.textContent = `${hours}:${minutes}${secondsEnabled ? `:${seconds}` : ''}${is12HourFormat ? (now.getHours() >= 12 ? ' PM' : ' AM') : ''}`;
}

function startClockTimer() {
    if (clockInterval) clearInterval(clockInterval);
    clockInterval = null;
    if (!document.hidden && actualClock && configRead('enableClock')) {
        clockInterval = setInterval(updateClock, 1000);
    }
}

function stopClockTimer() {
    if (clockInterval) {
        clearInterval(clockInterval);
        clockInterval = null;
    }
}

function toggleClock(value) {
    const existingClock = document.getElementById('fasttube-clock');
    if (value && existingClock) return;
    if (!value && existingClock) {
        existingClock.parentNode.removeChild(existingClock);
        stopClockTimer();
        actualClock = null;
        watchDefaultNode = null;
        clockHidden = false;
        return;
    }
    if (!value && !existingClock) {
        return;
    } else {
        const clock = document.createElement('div');

        clock.id = 'fasttube-clock';
        clock.style.height = '45rem';
        clock.style.width = '80rem';
        clock.style.position = 'absolute';
        clock.style.top = '50%';
        clock.style.left = '50%';
        clock.style.marginTop = '-22.5rem';
        clock.style.marginLeft = '-40rem';

        actualClock = document.createElement('div');

        actualClock.style.position = 'absolute';
        actualClock.style.zIndex = '9999';
        actualClock.style.right = '5%';
        actualClock.style.top = '2%';
        actualClock.style.fontSize = '1.5em';
        clock.appendChild(actualClock);
        document.body.appendChild(clock);

        updateClock();
        startClockTimer();
    }
}

document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        stopClockTimer();
    } else if (actualClock && configRead('enableClock')) {
        updateClock();
        startClockTimer();
    }
});

if (document.body) {
    toggleClock(configRead('enableClock'));
} else {
    document.addEventListener('DOMContentLoaded', () => toggleClock(configRead('enableClock')), { once: true });
}
