/**
 * When the paint editor should redraw its onion skin, and how long it should wait first.
 *
 * Kept pure and separate from the container so the two things that are easy to get wrong
 * here can be tested: that a settings change repaints the controls even when it does not
 * change which costumes are drawn, and that only a costume switch waits.
 */

// A costume switch leaves a scratch-paint import in flight; give it a moment to land.
const COSTUME_IMPORT_DELAY = 200;

// Undo/redo reimports the whole project, dropping the onion layers with it.
const PROJECT_RESTORE_DELAY = 100;

// Settings that the onion controls themselves display. A change to any of these has to
// repaint the controls, whether or not it changes what is drawn on the canvas.
const CONTROL_PROPS = [
    'onionEnabled',
    'onionPrevious',
    'onionNext',
    'onionTinted',
    'onionLoop'
];

/**
 * Whether the onion controls need to re-render.
 * @param {object} prev Previous props
 * @param {object} next Next props
 * @returns {boolean} true if any displayed setting changed
 */
const onionControlsChanged = (prev, next) =>
    CONTROL_PROPS.some(key => prev[key] !== next[key]);

/**
 * How long to wait before rebuilding the onion layers.
 *
 * A settings change has nothing in flight to wait for, so it rebuilds straight away -
 * waiting there just reads as lag on the checkbox.
 * @param {object} prev Previous props
 * @param {object} next Next props
 * @returns {?number} delay in ms, or null if nothing needs rebuilding
 */
const getOnionRebuildDelay = (prev, next) => {
    const costumeChanged = prev.imageId !== next.imageId;
    if (!costumeChanged && prev.onionSignature === next.onionSignature) return null;
    const hasFrames = Boolean(next.onionFrames && next.onionFrames.length);
    return costumeChanged && hasFrames ? COSTUME_IMPORT_DELAY : 0;
};

export {
    COSTUME_IMPORT_DELAY,
    CONTROL_PROPS,
    PROJECT_RESTORE_DELAY,
    getOnionRebuildDelay,
    onionControlsChanged
};
