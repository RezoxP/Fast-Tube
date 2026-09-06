import { configChangeEmitter, configRead } from '../config.js';

configChangeEmitter.addEventListener('configChange', (event) => {
    const { key, value } = event.detail;
    if (key === 'enableWhoIsWatchingMenu') {
        disableWhosWatching(value);
    }
});

let interval;

function disableWhosWatching(value) {
    // NOTE: this module runs at userscript evaluation time. On a fresh
    // install (or the userscript-manager injection path) the app has not
    // written 'yt.leanback.default::recurring_actions' yet - an unguarded
    // JSON.parse here used to throw and abort the ENTIRE userscript bundle.
    let LeanbackRecurringActions = null;
    try {
        LeanbackRecurringActions = JSON.parse(localStorage['yt.leanback.default::recurring_actions'] || 'null');
    } catch (e) {
        return;
    }
    const recurringData = LeanbackRecurringActions && LeanbackRecurringActions.data && LeanbackRecurringActions.data.data;
    if (!recurringData || !recurringData.whos_watching_fullscreen_zero_accounts) return;

    const shouldPermanentlyEnable = configRead('permanentlyEnableWhoIsWatchingMenu');
    const date = new Date();
    if (!value) {
        // Setting it after 7 days should be enough, as it'll get executed every time the app launches.
        date.setDate(date.getDate() + 7);
        recurringData["startup-screen-account-selector-with-guest"] &&
            (recurringData["startup-screen-account-selector-with-guest"].lastFired = date.getTime());
        recurringData.whos_watching_fullscreen_zero_accounts.lastFired = date.getTime();
        recurringData["startup-screen-signed-out-welcome-back"] &&
            (recurringData["startup-screen-signed-out-welcome-back"].lastFired = date.getTime());
        localStorage['yt.leanback.default::recurring_actions'] = JSON.stringify(LeanbackRecurringActions);
    } else {
        // Do nothing if the last fired action is less than 2 hours ago.
        if (date.getTime() - recurringData["startup-screen-account-selector-with-guest"]?.lastFired > 0 && date.getTime() - recurringData["startup-screen-account-selector-with-guest"]?.lastFired < 2 * 60 * 60 * 1000
        && !shouldPermanentlyEnable) {
            return;
        }
        function setActions() {
            recurringData["startup-screen-account-selector-with-guest"] &&
                (recurringData["startup-screen-account-selector-with-guest"].lastFired = date.getTime());
            recurringData.whos_watching_fullscreen_zero_accounts.lastFired = date.getTime();
            recurringData["startup-screen-signed-out-welcome-back"] &&
                (recurringData["startup-screen-signed-out-welcome-back"].lastFired = date.getTime());
            localStorage['yt.leanback.default::recurring_actions'] = JSON.stringify(LeanbackRecurringActions);
        }
        setActions();
        if (shouldPermanentlyEnable) {
            date.setDate(date.getDate() - 7);
            setActions();
            if (interval) clearInterval(interval);
            interval = setInterval(setActions, 60 * 1000);
        } else if (interval) {
            clearInterval(interval);
            interval = null;
        }
    }
}

disableWhosWatching(configRead('enableWhoIsWatchingMenu'));