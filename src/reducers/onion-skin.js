import {clampFrameCount} from '../lib/onion-skin-frames';

const SET_ENABLED = 'scratch-gui/onion-skin/SET_ENABLED';
const SET_SETTINGS = 'scratch-gui/onion-skin/SET_SETTINGS';

const initialState = {
    enabled: false,
    previous: 1,
    next: 0,
    loop: false,
    tinted: true
};

const reducer = function (state, action) {
    if (typeof state === 'undefined') state = initialState;
    switch (action.type) {
    case SET_ENABLED:
        return Object.assign({}, state, {enabled: Boolean(action.enabled)});
    case SET_SETTINGS: {
        const settings = action.settings || {};
        const next = Object.assign({}, state);
        if ('previous' in settings) next.previous = clampFrameCount(settings.previous);
        if ('next' in settings) next.next = clampFrameCount(settings.next);
        if ('loop' in settings) next.loop = Boolean(settings.loop);
        if ('tinted' in settings) next.tinted = Boolean(settings.tinted);
        return next;
    }
    default:
        return state;
    }
};

const setOnionSkinEnabled = function (enabled) {
    return {
        type: SET_ENABLED,
        enabled: enabled
    };
};

const setOnionSkinSettings = function (settings) {
    return {
        type: SET_SETTINGS,
        settings: settings
    };
};

export {
    reducer as default,
    initialState as onionSkinInitialState,
    setOnionSkinEnabled,
    setOnionSkinSettings
};
