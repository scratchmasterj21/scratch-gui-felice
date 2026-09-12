import {
    FUTURE,
    FUTURE_TINT,
    MAX_ONION_FRAMES,
    PAST,
    PAST_TINT,
    clampFrameCount,
    getOnionFrames
} from '../../../src/lib/onion-skin-frames';

const indicesOf = frames => frames.map(frame => frame.index);

describe('clampFrameCount', () => {
    test('keeps counts inside the supported range', () => {
        expect(clampFrameCount(0)).toBe(0);
        expect(clampFrameCount(2)).toBe(2);
        expect(clampFrameCount(MAX_ONION_FRAMES)).toBe(MAX_ONION_FRAMES);
    });

    test('clamps out of range and nonsense values', () => {
        expect(clampFrameCount(-1)).toBe(0);
        expect(clampFrameCount(99)).toBe(MAX_ONION_FRAMES);
        expect(clampFrameCount('2')).toBe(2);
        expect(clampFrameCount(NaN)).toBe(0);
        expect(clampFrameCount(undefined)).toBe(0);
    });
});

describe('getOnionFrames', () => {
    test('defaults to the single previous costume', () => {
        const frames = getOnionFrames(2, 5);
        expect(indicesOf(frames)).toEqual([1]);
        expect(frames[0].direction).toBe(PAST);
        expect(frames[0].distance).toBe(1);
    });

    test('returns nothing on the first costume without looping', () => {
        expect(getOnionFrames(0, 5)).toEqual([]);
    });

    test('returns nothing for a sprite with a single costume', () => {
        expect(getOnionFrames(0, 1, {previous: 3, next: 3, loop: true})).toEqual([]);
    });

    test('stops at the ends of the costume list', () => {
        expect(indicesOf(getOnionFrames(1, 5, {previous: 3}))).toEqual([0]);
        expect(indicesOf(getOnionFrames(3, 5, {previous: 0, next: 3}))).toEqual([4]);
    });

    test('interleaves past and future nearest first', () => {
        const frames = getOnionFrames(3, 8, {previous: 2, next: 2});
        expect(indicesOf(frames)).toEqual([2, 4, 1, 5]);
        expect(frames.map(frame => frame.direction)).toEqual([PAST, FUTURE, PAST, FUTURE]);
    });

    test('dims each frame further from the selected costume', () => {
        const frames = getOnionFrames(3, 8, {previous: 3});
        expect(frames[0].opacity).toBeGreaterThan(frames[1].opacity);
        expect(frames[1].opacity).toBeGreaterThan(frames[2].opacity);
        expect(frames[2].opacity).toBeGreaterThan(0);
    });

    test('tints past red and future blue, and not at all when tinting is off', () => {
        const tinted = getOnionFrames(3, 8, {previous: 1, next: 1});
        expect(tinted[0].tint).toBe(PAST_TINT);
        expect(tinted[1].tint).toBe(FUTURE_TINT);

        const plain = getOnionFrames(3, 8, {previous: 1, next: 1, tinted: false});
        expect(plain.map(frame => frame.tint)).toEqual([null, null]);
    });

    test('wraps around the costume list when looping', () => {
        expect(indicesOf(getOnionFrames(0, 5, {previous: 1, loop: true}))).toEqual([4]);
        expect(indicesOf(getOnionFrames(4, 5, {previous: 0, next: 1, loop: true}))).toEqual([0]);
    });

    test('never draws the selected costume as its own onion skin', () => {
        const frames = getOnionFrames(0, 3, {previous: 3, next: 3, loop: true});
        expect(indicesOf(frames)).not.toContain(0);
    });

    test('does not draw the same costume twice when looping a short sprite', () => {
        const frames = getOnionFrames(0, 3, {previous: 3, next: 3, loop: true});
        expect(indicesOf(frames).sort()).toEqual([1, 2]);
    });

    test('clamps requested frame counts', () => {
        const frames = getOnionFrames(10, 30, {previous: 99, next: 99});
        expect(frames).toHaveLength(MAX_ONION_FRAMES * 2);
    });

    test('returns nothing when both directions are zero', () => {
        expect(getOnionFrames(3, 8, {previous: 0, next: 0})).toEqual([]);
    });
});
