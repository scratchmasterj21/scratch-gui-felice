import {
    GUARD_FLAG,
    ONION_LAYER_KEY,
    getOnionLayers,
    installOnionExportGuards,
    onOnionInvalidated,
    removeOnionLayers,
    withoutOnionLayers
} from '../../../src/lib/onion-skin-layers';

/**
 * A stand-in for paper's layer/project pair. paper itself cannot be loaded under jsdom
 * (it builds a canvas at import time), and these are the semantics that matter:
 * a removed layer reports an undefined index, and insertLayer places at an index.
 */
class FakeLayer {
    constructor (data) {
        this.data = data || {};
        this.project = null;
        this.children = ['content'];
    }
    get index () {
        return this.project ? this.project.layers.indexOf(this) : undefined;
    }
    remove () {
        if (!this.project) return;
        this.project.layers.splice(this.index, 1);
        this.project = null;
    }
    removeChildren () {
        this.children = [];
    }
}

class FakeProject {
    constructor (layers) {
        this.layers = [];
        for (const layer of layers || []) {
            this.insertLayer(this.layers.length, layer);
        }
    }
    insertLayer (index, layer) {
        layer.remove();
        this.layers.splice(index, 0, layer);
        layer.project = this;
        return layer;
    }
}

const onion = () => new FakeLayer({[ONION_LAYER_KEY]: true});
const background = () => new FakeLayer({isBackgroundGuideLayer: true});
const painting = () => new FakeLayer({isPaintingLayer: true});
const stackOf = project => project.layers.map(layer => Object.keys(layer.data)[0]);

describe('getOnionLayers', () => {
    test('finds only layers flagged as onion layers', () => {
        const onionLayer = onion();
        const project = new FakeProject([background(), onionLayer, painting()]);
        expect(getOnionLayers(project)).toEqual([onionLayer]);
    });

    test('tolerates a missing project', () => {
        expect(getOnionLayers(null)).toEqual([]);
        expect(getOnionLayers({})).toEqual([]);
    });
});

describe('withoutOnionLayers', () => {
    test('hides onion layers from the callback and puts them back', () => {
        const project = new FakeProject([background(), onion(), painting()]);

        const seen = withoutOnionLayers(project, () => stackOf(project));

        expect(seen).toEqual(['isBackgroundGuideLayer', 'isPaintingLayer']);
        expect(stackOf(project)).toEqual([
            'isBackgroundGuideLayer',
            ONION_LAYER_KEY,
            'isPaintingLayer'
        ]);
    });

    // Regression: scratch-paint calls hideGuideLayers before exporting, so the background
    // guide layer an onion layer would anchor itself above is gone at export time. Anchoring
    // to it used to leave the onion on top of the artwork after every edit.
    test('restores z-order when the background guide layer is absent during export', () => {
        const project = new FakeProject([onion(), painting()]);

        withoutOnionLayers(project, () => {
            expect(stackOf(project)).toEqual(['isPaintingLayer']);
        });

        expect(stackOf(project)).toEqual([ONION_LAYER_KEY, 'isPaintingLayer']);
    });

    // Regression: only the single tracked layer used to be hidden, so a layer orphaned by
    // a race got baked into the exported costume.
    test('hides every onion layer, including untracked ones, and restores each index', () => {
        const project = new FakeProject([onion(), painting(), onion()]);

        const seen = withoutOnionLayers(project, () => stackOf(project));

        expect(seen).toEqual(['isPaintingLayer']);
        expect(stackOf(project)).toEqual([ONION_LAYER_KEY, 'isPaintingLayer', ONION_LAYER_KEY]);
    });

    // Regression: the old detached check was `index !== null`, but paper reports undefined
    // for a removed layer, so an emptied layer left behind by undo got reinserted.
    test('does not reinsert an onion layer that is no longer in the project', () => {
        const detached = onion();
        const project = new FakeProject([background(), detached, painting()]);
        detached.remove();

        withoutOnionLayers(project, () => null);

        expect(stackOf(project)).toEqual(['isBackgroundGuideLayer', 'isPaintingLayer']);
        expect(detached.project).toBeNull();
    });

    test('passes the callback result through', () => {
        const project = new FakeProject([onion(), painting()]);
        expect(withoutOnionLayers(project, () => 'exported')).toBe('exported');
    });

    test('restores the onion layers even if the callback throws', () => {
        const project = new FakeProject([onion(), painting()]);

        expect(() => withoutOnionLayers(project, () => {
            throw new Error('export failed');
        })).toThrow('export failed');

        expect(stackOf(project)).toEqual([ONION_LAYER_KEY, 'isPaintingLayer']);
    });
});

describe('removeOnionLayers', () => {
    test('sweeps every onion layer and leaves the rest alone', () => {
        const project = new FakeProject([background(), onion(), painting(), onion()]);

        expect(removeOnionLayers(project)).toBe(2);
        expect(stackOf(project)).toEqual(['isBackgroundGuideLayer', 'isPaintingLayer']);
    });

    test('tolerates a missing project', () => {
        expect(removeOnionLayers(null)).toBe(0);
    });
});

describe('installOnionExportGuards', () => {
    const makeScope = () => {
        const calls = {exportSVG: [], exportJSON: 0, importJSON: 0};
        class GuardedProject extends FakeProject {}
        GuardedProject.prototype.exportSVG = function () {
            calls.exportSVG.push(stackOf(this));
            return 'svg';
        };
        GuardedProject.prototype.exportJSON = function () {
            calls.exportJSON++;
            return 'json';
        };
        GuardedProject.prototype.importJSON = function () {
            calls.importJSON++;
            return 'imported';
        };
        return {scope: {Project: GuardedProject}, calls, GuardedProject};
    };

    // Regression: the guard used to be installed per component instance with no teardown,
    // so every visit to the costume tab wrapped paper's prototype again.
    test('installs once no matter how many times it is called', () => {
        const {scope, calls, GuardedProject} = makeScope();

        expect(installOnionExportGuards(scope)).toBe(true);
        const wrapped = GuardedProject.prototype.exportSVG;

        for (let i = 0; i < 5; i++) {
            expect(installOnionExportGuards(scope)).toBe(false);
        }

        expect(GuardedProject.prototype.exportSVG).toBe(wrapped);
        expect(GuardedProject.prototype[GUARD_FLAG]).toBe(true);

        const project = new GuardedProject([onion(), painting()]);
        project.exportSVG();

        // One wrapper, so the original ran once and saw the project without the onion.
        expect(calls.exportSVG).toEqual([['isPaintingLayer']]);
    });

    test('an export with onion skin on matches an export with it off', () => {
        const {scope, calls, GuardedProject} = makeScope();
        installOnionExportGuards(scope);

        new GuardedProject([background(), painting()]).exportSVG();
        new GuardedProject([background(), onion(), painting()]).exportSVG();

        expect(calls.exportSVG[1]).toEqual(calls.exportSVG[0]);
    });

    test('hides onion layers from exportJSON and restores them', () => {
        const {scope, calls, GuardedProject} = makeScope();
        installOnionExportGuards(scope);
        const project = new GuardedProject([background(), onion(), painting()]);

        expect(project.exportJSON()).toBe('json');
        expect(calls.exportJSON).toBe(1);
        expect(stackOf(project)).toEqual([
            'isBackgroundGuideLayer',
            ONION_LAYER_KEY,
            'isPaintingLayer'
        ]);
    });

    test('notifies subscribers when importJSON replaces the project', () => {
        const {scope, GuardedProject} = makeScope();
        installOnionExportGuards(scope);
        const listener = jest.fn();
        const unsubscribe = onOnionInvalidated(listener);

        expect(new GuardedProject([]).importJSON('{}')).toBe('imported');
        expect(listener).toHaveBeenCalledTimes(1);

        unsubscribe();
        new GuardedProject([]).importJSON('{}');
        expect(listener).toHaveBeenCalledTimes(1);
    });

    test('ignores a scope without a Project constructor', () => {
        expect(installOnionExportGuards(null)).toBe(false);
        expect(installOnionExportGuards({})).toBe(false);
    });
});
