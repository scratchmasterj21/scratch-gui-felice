/**
 * Chooses which costumes are drawn as onion skins behind the one being edited, and how
 * each one is shaded.
 *
 * Pure: no paper, no redux, no DOM. The paint editor's onion rendering is hard to test
 * end to end, so the part that decides *what* to draw is kept separate from the part that
 * draws it.
 */

// More than three frames in either direction stops being readable at these opacities.
const MAX_ONION_FRAMES = 3;

const BASE_OPACITY = 0.3;

// Each further frame is dimmer, so the nearest costume reads as the strongest reference.
const OPACITY_FALLOFF = 0.6;

// Past behind, future ahead: the convention animators already know from other tools.
const PAST_TINT = '#FF4D4D';
const FUTURE_TINT = '#4D8CFF';

const PAST = 'past';
const FUTURE = 'future';

const clampFrameCount = value => {
    const number = Math.round(Number(value));
    if (!isFinite(number) || number < 0) return 0;
    return Math.min(number, MAX_ONION_FRAMES);
};

/**
 * The costumes to draw behind the selected one, nearest first.
 *
 * Nearest first is also the order they should be inserted in: each onion layer goes
 * directly above the background guide layer, so the last one inserted ends up furthest
 * back.
 * @param {number} selectedIndex Index of the costume being edited
 * @param {number} costumeCount How many costumes the sprite has
 * @param {object} [options] previous, next, loop, tinted
 * @returns {Array<object>} {index, distance, direction, opacity, tint} per frame
 */
const getOnionFrames = (selectedIndex, costumeCount, options) => {
    const {
        previous = 1,
        next = 0,
        loop = false,
        tinted = true
    } = options || {};

    const frames = [];
    if (!isFinite(selectedIndex) || selectedIndex < 0) return frames;
    if (!isFinite(costumeCount) || costumeCount < 2) return frames;

    const taken = new Set([selectedIndex]);

    const addFrame = (offset, direction) => {
        let index = selectedIndex + offset;
        if (loop) {
            index = ((index % costumeCount) + costumeCount) % costumeCount;
        } else if (index < 0 || index >= costumeCount) {
            return;
        }
        // Looping a short sprite can wrap back onto a costume that is already drawn.
        if (taken.has(index)) return;
        taken.add(index);

        const distance = Math.abs(offset);
        frames.push({
            index,
            distance,
            direction,
            opacity: BASE_OPACITY * Math.pow(OPACITY_FALLOFF, distance - 1),
            tint: tinted ? (direction === PAST ? PAST_TINT : FUTURE_TINT) : null
        });
    };

    const previousCount = clampFrameCount(previous);
    const nextCount = clampFrameCount(next);

    // Interleaved by distance so the nearest frames on both sides are drawn on top.
    for (let distance = 1; distance <= Math.max(previousCount, nextCount); distance++) {
        if (distance <= previousCount) addFrame(-distance, PAST);
        if (distance <= nextCount) addFrame(distance, FUTURE);
    }

    return frames;
};

export {
    BASE_OPACITY,
    FUTURE,
    FUTURE_TINT,
    MAX_ONION_FRAMES,
    OPACITY_FALLOFF,
    PAST,
    PAST_TINT,
    clampFrameCount,
    getOnionFrames
};
