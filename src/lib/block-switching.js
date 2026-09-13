/**
 * Which blocks can be swapped for which, and what that costs.
 *
 * Right-clicking a block in the workspace offers to turn it into a related one - an `if`
 * into an `if/else`, a `+` into a `-` - keeping whatever is already plugged into it.
 *
 * This module is deliberately free of Blockly: it is a lookup table plus three questions
 * (what can this become, what does the target lose, what does it gain). The Blockly
 * manipulation lives in block-switching-menu.js, which cannot be tested under jsdom.
 *
 * Input names and shadow defaults below were read out of
 * node_modules/scratch-blocks/blocks_vertical/ and src/lib/make-toolbox-xml.js. If a
 * scratch-blocks upgrade renames an input, the tests that assert group symmetry will not
 * catch it - only a click will.
 */

// Inputs each block actually has, in definition order.
const BLOCK_INPUTS = {
    operator_add: ['NUM1', 'NUM2'],
    operator_mod: ['NUM1', 'NUM2'],
    operator_subtract: ['NUM1', 'NUM2'],
    operator_multiply: ['NUM1', 'NUM2'],
    operator_divide: ['NUM1', 'NUM2'],

    operator_gt: ['OPERAND1', 'OPERAND2'],
    operator_lt: ['OPERAND1', 'OPERAND2'],
    operator_equals: ['OPERAND1', 'OPERAND2'],

    operator_and: ['OPERAND1', 'OPERAND2'],
    operator_or: ['OPERAND1', 'OPERAND2'],

    data_setvariableto: ['VARIABLE', 'VALUE'],
    data_changevariableby: ['VARIABLE', 'VALUE'],
    data_showvariable: ['VARIABLE'],
    data_hidevariable: ['VARIABLE'],
    data_showlist: ['LIST'],
    data_hidelist: ['LIST'],

    looks_say: ['MESSAGE'],
    looks_think: ['MESSAGE'],
    looks_sayforsecs: ['MESSAGE', 'SECS'],
    looks_thinkforsecs: ['MESSAGE', 'SECS'],
    looks_show: [],
    looks_hide: [],
    looks_switchbackdropto: ['BACKDROP'],
    looks_switchbackdroptoandwait: ['BACKDROP'],
    looks_changesizeby: ['CHANGE'],
    looks_setsizeto: ['SIZE'],
    looks_changeeffectby: ['EFFECT', 'CHANGE'],
    looks_seteffectto: ['EFFECT', 'VALUE'],

    control_if: ['CONDITION', 'SUBSTACK'],
    control_if_else: ['CONDITION', 'SUBSTACK', 'SUBSTACK2'],
    control_repeat_until: ['CONDITION', 'SUBSTACK'],
    control_repeat: ['TIMES', 'SUBSTACK'],
    control_forever: ['SUBSTACK'],

    motion_gotoxy: ['X', 'Y'],
    motion_glidesecstoxy: ['SECS', 'X', 'Y'],
    motion_turnright: ['DEGREES'],
    motion_turnleft: ['DEGREES'],
    motion_changexby: ['DX'],
    motion_setx: ['X'],
    motion_changeyby: ['DY'],
    motion_sety: ['Y'],

    sound_play: ['SOUND_MENU'],
    sound_playuntildone: ['SOUND_MENU'],
    sound_setvolumeto: ['VOLUME'],
    sound_changevolumeby: ['VOLUME'],
    sound_seteffectto: ['EFFECT', 'VALUE'],
    sound_changeeffectby: ['EFFECT', 'VALUE'],

    event_broadcast: ['BROADCAST_INPUT'],
    event_broadcastandwait: ['BROADCAST_INPUT']
};

/*
 * The shape of each block, read from the "extensions" field in
 * node_modules/scratch-blocks/blocks_vertical/ (or from previousStatement/nextStatement
 * for the few blocks that declare it the older way).
 *
 * Two blocks can only be swapped if they fit the same hole. A test enforces that every
 * group below is shape-compatible, so a future addition cannot quietly put a reporter
 * where a stack block belongs.
 */
const BLOCK_SHAPES = {
    operator_add: 'number',
    operator_subtract: 'number',
    operator_multiply: 'number',
    operator_divide: 'number',
    operator_mod: 'number',

    operator_gt: 'boolean',
    operator_lt: 'boolean',
    operator_equals: 'boolean',
    operator_and: 'boolean',
    operator_or: 'boolean',

    data_setvariableto: 'statement',
    data_changevariableby: 'statement',
    data_showvariable: 'statement',
    data_hidevariable: 'statement',
    data_showlist: 'statement',
    data_hidelist: 'statement',

    looks_say: 'statement',
    looks_think: 'statement',
    looks_sayforsecs: 'statement',
    looks_thinkforsecs: 'statement',
    looks_show: 'statement',
    looks_hide: 'statement',
    looks_switchbackdropto: 'statement',
    looks_switchbackdroptoandwait: 'statement',
    looks_changesizeby: 'statement',
    looks_setsizeto: 'statement',
    looks_changeeffectby: 'statement',
    looks_seteffectto: 'statement',

    control_if: 'statement',
    control_if_else: 'statement',
    control_repeat_until: 'statement',
    control_repeat: 'statement',
    // "forever" is shape_end: nothing can follow it, which is why switching a repeat that
    // has blocks after it leaves those blocks loose on the workspace.
    control_forever: 'end',

    motion_gotoxy: 'statement',
    motion_glidesecstoxy: 'statement',
    motion_turnright: 'statement',
    motion_turnleft: 'statement',
    motion_changexby: 'statement',
    motion_setx: 'statement',
    motion_changeyby: 'statement',
    motion_sety: 'statement',

    sound_play: 'statement',
    sound_playuntildone: 'statement',
    sound_setvolumeto: 'statement',
    sound_changevolumeby: 'statement',
    sound_seteffectto: 'statement',
    sound_changeeffectby: 'statement',

    event_broadcast: 'statement',
    event_broadcastandwait: 'statement'
};

/*
 * Shapes that fit the same hole. Statement and end blocks both stack; number and string
 * reporters are both round and Scratch treats their values loosely, so they are
 * interchangeable. Booleans are hexagonal and fit nowhere else.
 */
const SHAPE_FAMILIES = {
    statement: 'stack',
    end: 'stack',
    number: 'round',
    string: 'round',
    boolean: 'boolean'
};

/*
 * Inputs that hold the same thing under a different name. Without these the set/change
 * pairs that pupils use constantly could not be switched, because nothing would carry the
 * value across.
 */
const INPUT_RENAMES = {
    'motion_changexby>motion_setx': {DX: 'X'},
    'motion_setx>motion_changexby': {X: 'DX'},
    'motion_changeyby>motion_sety': {DY: 'Y'},
    'motion_sety>motion_changeyby': {Y: 'DY'},
    'looks_changesizeby>looks_setsizeto': {CHANGE: 'SIZE'},
    'looks_setsizeto>looks_changesizeby': {SIZE: 'CHANGE'},
    'looks_changeeffectby>looks_seteffectto': {CHANGE: 'VALUE'},
    'looks_seteffectto>looks_changeeffectby': {VALUE: 'CHANGE'}
};

/*
 * Groups of interchangeable blocks. A block may appear in several groups - `looks_say`
 * swaps with `looks_think` and with `looks_sayforsecs` - and the options offered are the
 * union of every group it belongs to.
 *
 * Comparison and boolean operators are kept apart on purpose even though both use
 * OPERAND1/OPERAND2: comparison operands hold text, boolean operands hold booleans, so
 * switching `=` to `and` would leave text blocks jammed in boolean sockets.
 */
const SWITCH_GROUPS = [
    ['operator_add', 'operator_subtract', 'operator_multiply', 'operator_divide', 'operator_mod'],
    ['operator_gt', 'operator_lt', 'operator_equals'],
    ['operator_and', 'operator_or'],
    ['data_setvariableto', 'data_changevariableby'],
    ['looks_say', 'looks_think'],
    ['looks_sayforsecs', 'looks_thinkforsecs'],
    ['looks_say', 'looks_sayforsecs'],
    ['looks_think', 'looks_thinkforsecs'],
    ['control_if', 'control_if_else'],
    ['control_if', 'control_repeat_until'],
    ['control_repeat', 'control_forever'],
    ['motion_gotoxy', 'motion_glidesecstoxy'],
    ['motion_turnright', 'motion_turnleft'],
    ['motion_changexby', 'motion_setx'],
    ['motion_changeyby', 'motion_sety'],
    ['looks_show', 'looks_hide'],
    ['looks_switchbackdropto', 'looks_switchbackdroptoandwait'],
    ['looks_changesizeby', 'looks_setsizeto'],
    ['looks_changeeffectby', 'looks_seteffectto'],
    ['sound_play', 'sound_playuntildone'],
    ['sound_setvolumeto', 'sound_changevolumeby'],
    ['sound_seteffectto', 'sound_changeeffectby'],
    ['data_showvariable', 'data_hidevariable'],
    ['data_showlist', 'data_hidelist'],
    ['event_broadcast', 'event_broadcastandwait']
];

/*
 * Menu labels. Plain text rather than a rendered miniature of the block, and English only
 * for now - the context menu is built by Blockly, not React, so react-intl is not
 * available here. Localising these would mean going through ScratchBlocks.Msg.
 */
const BLOCK_LABELS = {
    operator_add: '+',
    operator_subtract: '-',
    operator_multiply: '*',
    operator_divide: '/',
    operator_gt: 'greater than',
    operator_lt: 'less than',
    operator_equals: 'equals',
    operator_and: 'and',
    operator_or: 'or',
    data_setvariableto: 'set variable to',
    data_changevariableby: 'change variable by',
    looks_say: 'say',
    looks_think: 'think',
    looks_sayforsecs: 'say for seconds',
    looks_thinkforsecs: 'think for seconds',
    control_if: 'if then',
    control_if_else: 'if then else',
    control_repeat_until: 'repeat until',
    control_repeat: 'repeat',
    control_forever: 'forever',
    motion_gotoxy: 'go to x y',
    motion_glidesecstoxy: 'glide to x y',
    operator_mod: 'mod',
    motion_turnright: 'turn right',
    motion_turnleft: 'turn left',
    motion_changexby: 'change x by',
    motion_setx: 'set x to',
    motion_changeyby: 'change y by',
    motion_sety: 'set y to',
    looks_show: 'show',
    looks_hide: 'hide',
    looks_switchbackdropto: 'switch backdrop to',
    looks_switchbackdroptoandwait: 'switch backdrop and wait',
    looks_changesizeby: 'change size by',
    looks_setsizeto: 'set size to',
    looks_changeeffectby: 'change effect by',
    looks_seteffectto: 'set effect to',
    sound_play: 'start sound',
    sound_playuntildone: 'play sound until done',
    sound_setvolumeto: 'set volume to',
    sound_changevolumeby: 'change volume by',
    sound_seteffectto: 'set sound effect to',
    sound_changeeffectby: 'change sound effect by',
    data_showvariable: 'show variable',
    data_hidevariable: 'hide variable',
    data_showlist: 'show list',
    data_hidelist: 'hide list',
    event_broadcast: 'broadcast',
    event_broadcastandwait: 'broadcast and wait'
};

/*
 * What to put in an input the target block has but the source did not. Without these a
 * `say` switched to `say for seconds` would show an empty hole where the duration belongs,
 * because shadow blocks come from the toolbox XML rather than the block definition.
 * Values match src/lib/make-toolbox-xml.js so a switched block looks like a dragged one.
 */
const DEFAULT_SHADOWS = {
    looks_sayforsecs: {SECS: {type: 'math_number', field: 'NUM', value: '2'}},
    looks_thinkforsecs: {SECS: {type: 'math_number', field: 'NUM', value: '2'}},
    motion_glidesecstoxy: {SECS: {type: 'math_number', field: 'NUM', value: '1'}},
    control_repeat: {TIMES: {type: 'math_whole_number', field: 'NUM', value: '10'}}
};

const getInputs = opcode => BLOCK_INPUTS[opcode] || [];

/**
 * The hole a block fits into: 'stack', 'round' or 'boolean'.
 * @param {string} opcode The block's type
 * @returns {?string} the shape family, or null if the block is unknown
 */
const getShapeFamily = opcode => SHAPE_FAMILIES[BLOCK_SHAPES[opcode]] || null;

/**
 * Whether two blocks fit the same hole, and so could stand in for each other.
 * @param {string} a One block type
 * @param {string} b Another block type
 * @returns {boolean} true if both are known and share a shape family
 */
const areShapesCompatible = (a, b) => {
    const familyA = getShapeFamily(a);
    return Boolean(familyA) && familyA === getShapeFamily(b);
};

/**
 * Inputs that change name between two blocks, so their contents can be carried across.
 * @param {string} fromOpcode The block being switched
 * @param {string} toOpcode The block it is becoming
 * @returns {object} a map of old input name to new input name, possibly empty
 */
const getInputRenames = (fromOpcode, toOpcode) =>
    INPUT_RENAMES[`${fromOpcode}>${toOpcode}`] || {};

/**
 * Every opcode that appears in some switch group.
 * @returns {Array<string>} switchable opcodes, deduplicated
 */
const getSwitchableOpcodes = () => {
    const seen = new Set();
    for (const group of SWITCH_GROUPS) {
        for (const opcode of group) seen.add(opcode);
    }
    return Array.from(seen);
};

/**
 * Blocks this one can be switched to, in a stable order.
 * @param {string} opcode The block's type
 * @returns {Array<object>} [{opcode, label}], empty if nothing can be switched
 */
const getSwitchOptions = opcode => {
    const seen = new Set();
    const options = [];
    for (const group of SWITCH_GROUPS) {
        if (!group.includes(opcode)) continue;
        for (const candidate of group) {
            if (candidate === opcode || seen.has(candidate)) continue;
            seen.add(candidate);
            options.push({
                opcode: candidate,
                label: BLOCK_LABELS[candidate] || candidate
            });
        }
    }
    return options;
};

/**
 * Inputs that exist on the source but not the target. Whatever is plugged into these has
 * nowhere to go, and is left loose on the workspace rather than deleted.
 * @param {string} fromOpcode The block being switched
 * @param {string} toOpcode The block it is becoming
 * @returns {Array<string>} input names that will be dropped
 */
const getDroppedInputs = (fromOpcode, toOpcode) => {
    const target = getInputs(toOpcode);
    const renames = getInputRenames(fromOpcode, toOpcode);
    // A renamed input is carried across, not dropped.
    return getInputs(fromOpcode)
        .filter(name => !renames[name] && !target.includes(name));
};

/**
 * Inputs the target has that the source did not, paired with the shadow to fill them.
 * @param {string} fromOpcode The block being switched
 * @param {string} toOpcode The block it is becoming
 * @returns {Array<object>} [{name, shadow}], shadow null where there is no sensible default
 */
const getGainedInputs = (fromOpcode, toOpcode) => {
    const source = getInputs(fromOpcode);
    const renames = getInputRenames(fromOpcode, toOpcode);
    const arriving = new Set(Object.values(renames));
    const shadows = DEFAULT_SHADOWS[toOpcode] || {};
    return getInputs(toOpcode)
        // An input that something is being renamed into is already filled.
        .filter(name => !source.includes(name) && !arriving.has(name))
        .map(name => ({name, shadow: shadows[name] || null}));
};

export {
    BLOCK_INPUTS,
    BLOCK_LABELS,
    BLOCK_SHAPES,
    INPUT_RENAMES,
    SHAPE_FAMILIES,
    areShapesCompatible,
    getInputRenames,
    getShapeFamily,
    DEFAULT_SHADOWS,
    SWITCH_GROUPS,
    getDroppedInputs,
    getGainedInputs,
    getInputs,
    getSwitchOptions,
    getSwitchableOpcodes
};
