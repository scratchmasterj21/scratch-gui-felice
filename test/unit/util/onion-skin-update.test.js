import {
    COSTUME_IMPORT_DELAY,
    getOnionRebuildDelay,
    onionControlsChanged
} from '../../../src/lib/onion-skin-update';

const props = overrides => Object.assign({
    imageId: 'target1skin1',
    onionSignature: '1:asset1:0.300:#FF4D4D',
    onionFrames: [{index: 1}],
    onionEnabled: true,
    onionPrevious: 1,
    onionNext: 0,
    onionTinted: true,
    onionLoop: false
}, overrides);

describe('onionControlsChanged', () => {
    // Regression: these settings were missing from shouldComponentUpdate, so toggling Loop
    // in the middle of the costume list never repainted the checkbox - the click looked
    // like it did nothing at all.
    test('reports a Loop toggle that does not change which costumes are drawn', () => {
        const before = props();
        const after = props({onionLoop: true});
        expect(after.onionSignature).toBe(before.onionSignature);
        expect(onionControlsChanged(before, after)).toBe(true);
    });

    test('reports a Before/After change that is clamped away at the end of the list', () => {
        const before = props({onionSignature: '', onionFrames: [], onionPrevious: 1});
        const after = props({onionSignature: '', onionFrames: [], onionPrevious: 3});
        expect(onionControlsChanged(before, after)).toBe(true);
    });

    test('reports tint and enabled changes', () => {
        expect(onionControlsChanged(props(), props({onionTinted: false}))).toBe(true);
        expect(onionControlsChanged(props(), props({onionEnabled: false}))).toBe(true);
        expect(onionControlsChanged(props(), props({onionNext: 2}))).toBe(true);
    });

    test('ignores changes that the controls do not display', () => {
        expect(onionControlsChanged(props(), props())).toBe(false);
        expect(onionControlsChanged(props(), props({imageId: 'target1skin9'}))).toBe(false);
    });
});

describe('getOnionRebuildDelay', () => {
    // Regression: every settings change used to wait out COSTUME_IMPORT_DELAY, which only
    // exists to let a costume import finish. On a checkbox it just read as lag.
    test('rebuilds immediately for a settings change', () => {
        const before = props();
        const after = props({onionTinted: false, onionSignature: '1:asset1:0.300:null'});
        expect(getOnionRebuildDelay(before, after)).toBe(0);
    });

    test('waits for the import when the costume changes', () => {
        const before = props();
        const after = props({imageId: 'target1skin9', onionSignature: '2:asset2:0.300:#FF4D4D'});
        expect(getOnionRebuildDelay(before, after)).toBe(COSTUME_IMPORT_DELAY);
    });

    test('does not wait on a costume change that draws no onion frames', () => {
        const before = props({onionSignature: '', onionFrames: []});
        const after = props({imageId: 'target1skin9', onionSignature: '', onionFrames: []});
        expect(getOnionRebuildDelay(before, after)).toBe(0);
    });

    test('clears immediately when the onion is turned off', () => {
        const before = props();
        const after = props({onionEnabled: false, onionSignature: '', onionFrames: []});
        expect(getOnionRebuildDelay(before, after)).toBe(0);
    });

    test('does not rebuild when nothing that is drawn changed', () => {
        expect(getOnionRebuildDelay(props(), props())).toBeNull();
        // A Loop toggle that changes no frames repaints the controls but needs no rebuild.
        expect(getOnionRebuildDelay(props(), props({onionLoop: true}))).toBeNull();
    });

    test('tolerates a missing frame list', () => {
        const before = props();
        const after = props({imageId: 'other', onionFrames: undefined, onionSignature: ''});
        expect(getOnionRebuildDelay(before, after)).toBe(0);
    });
});
