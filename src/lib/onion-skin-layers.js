/**
 * Bookkeeping for the paint editor's onion skin layers.
 *
 * Onion layers live in the same paper project as the artwork, so they have to be pulled
 * out of the project before scratch-paint exports a costume. Otherwise they are baked
 * into the saved SVG, and because scratch-paint exports with `bounds: 'content'` they
 * also shift the costume's computed rotation center.
 *
 * scratch-paint's own `hideGuideLayers` cannot do this for us: it removes a fixed list of
 * layers looked up by their `data` flags, so a layer it has never heard of sails straight
 * through into the export.
 *
 * This module deliberately does not import paper. The paper scope is passed in, which
 * keeps the logic testable without a canvas (paper touches `document.createElement` at
 * import time and cannot be loaded under jsdom).
 */

const ONION_LAYER_KEY = 'isOnionLayer';

// Marked on paper.Project.prototype itself rather than held in a module variable, so that
// repeated mounts - or a second copy of this module - cannot stack wrappers.
const GUARD_FLAG = '__scratchOnionSkinGuarded';

const invalidationListeners = new Set();

const isOnionLayer = layer => Boolean(layer && layer.data && layer.data[ONION_LAYER_KEY]);

/**
 * Every onion layer currently in the project.
 * @param {object} project A paper project
 * @returns {Array} the onion layers, in project order
 */
const getOnionLayers = project => {
    if (!project || !project.layers) return [];
    return project.layers.filter(isOnionLayer);
};

/**
 * Run fn with every onion layer removed from the project, then put each layer back at the
 * index it came from.
 *
 * Layers are found by their data flag rather than by a tracked reference, so a layer
 * orphaned by a race is hidden from the export too.
 *
 * The index is restored rather than re-derived from a neighbouring layer, because callers
 * such as scratch-paint's `handleUpdateVector` call `hideGuideLayers` first: the background
 * guide layer an onion layer would otherwise anchor itself above is not in the project at
 * export time.
 * @param {object} project A paper project
 * @param {Function} fn The work to run with the onion layers hidden
 * @returns {*} whatever fn returns
 */
const withoutOnionLayers = (project, fn) => {
    const removed = getOnionLayers(project).map(layer => ({layer, index: layer.index}));
    for (const entry of removed) {
        entry.layer.remove();
    }
    try {
        return fn();
    } finally {
        // Restore lowest index first so each layer lands back where it started.
        removed.sort((a, b) => a.index - b.index);
        for (const entry of removed) {
            const index = Math.max(0, Math.min(entry.index, project.layers.length));
            project.insertLayer(index, entry.layer);
        }
    }
};

/**
 * Remove every onion layer from the project, including any that are no longer tracked.
 * @param {object} project A paper project
 * @returns {number} how many layers were removed
 */
const removeOnionLayers = project => {
    const layers = getOnionLayers(project);
    for (const layer of layers) {
        layer.removeChildren();
        layer.remove();
    }
    return layers.length;
};

/**
 * Subscribe to "the project was replaced underneath you" (undo/redo), which drops the
 * onion layers along with everything else.
 * @param {Function} listener Called after the project is reimported
 * @returns {Function} unsubscribe
 */
const onOnionInvalidated = listener => {
    invalidationListeners.add(listener);
    return () => invalidationListeners.delete(listener);
};

const notifyOnionInvalidated = () => {
    for (const listener of Array.from(invalidationListeners)) {
        listener();
    }
};

/**
 * Wrap paper's project export functions so onion layers are never visible to them, and
 * fire invalidation when importJSON replaces the project. Safe to call any number of times.
 * @param {object} paperScope The paper scope to patch
 * @returns {boolean} true if this call installed the guards, false if they were already there
 */
const installOnionExportGuards = paperScope => {
    const proto = paperScope && paperScope.Project && paperScope.Project.prototype;
    if (!proto || proto[GUARD_FLAG]) return false;

    for (const name of ['exportSVG', 'exportJSON']) {
        const original = proto[name];
        if (typeof original === 'function') {
            proto[name] = function (...args) {
                return withoutOnionLayers(this, () => original.apply(this, args));
            };
        }
    }

    const originalImportJSON = proto.importJSON;
    if (typeof originalImportJSON === 'function') {
        proto.importJSON = function (...args) {
            const result = originalImportJSON.apply(this, args);
            notifyOnionInvalidated();
            return result;
        };
    }

    proto[GUARD_FLAG] = true;
    return true;
};

export {
    GUARD_FLAG,
    ONION_LAYER_KEY,
    getOnionLayers,
    installOnionExportGuards,
    notifyOnionInvalidated,
    onOnionInvalidated,
    removeOnionLayers,
    withoutOnionLayers
};
