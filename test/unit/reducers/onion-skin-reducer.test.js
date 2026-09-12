import onionSkinReducer, {
    onionSkinInitialState,
    setOnionSkinEnabled,
    setOnionSkinSettings
} from '../../../src/reducers/onion-skin';
import {MAX_ONION_FRAMES} from '../../../src/lib/onion-skin-frames';

test('initialState', () => {
    expect(onionSkinReducer(undefined, {type: 'anything'})).toEqual(onionSkinInitialState);
    expect(onionSkinInitialState.enabled).toBe(false);
});

test('setOnionSkinEnabled toggles only enabled', () => {
    const state = onionSkinReducer(undefined, setOnionSkinEnabled(true));
    expect(state.enabled).toBe(true);
    expect(state.previous).toBe(onionSkinInitialState.previous);
    expect(onionSkinReducer(state, setOnionSkinEnabled(false)).enabled).toBe(false);
});

test('setOnionSkinSettings updates only the keys it is given', () => {
    const state = onionSkinReducer(undefined, setOnionSkinSettings({next: 2}));
    expect(state.next).toBe(2);
    expect(state.previous).toBe(onionSkinInitialState.previous);
    expect(state.tinted).toBe(onionSkinInitialState.tinted);
});

test('setOnionSkinSettings clamps frame counts', () => {
    const state = onionSkinReducer(undefined, setOnionSkinSettings({previous: 99, next: -4}));
    expect(state.previous).toBe(MAX_ONION_FRAMES);
    expect(state.next).toBe(0);
});

test('setOnionSkinSettings coerces the checkbox settings', () => {
    const state = onionSkinReducer(undefined, setOnionSkinSettings({loop: 1, tinted: 0}));
    expect(state.loop).toBe(true);
    expect(state.tinted).toBe(false);
});

test('an unrelated action leaves state untouched', () => {
    const state = onionSkinReducer(undefined, setOnionSkinEnabled(true));
    expect(onionSkinReducer(state, {type: 'something/else'})).toBe(state);
});
