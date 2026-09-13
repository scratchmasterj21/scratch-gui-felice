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

    looks_say: ['MESSAGE'],
    looks_think: ['MESSAGE'],
    looks_sayforsecs: ['MESSAGE', 'SECS'],
    looks_thinkforsecs: ['MESSAGE', 'SECS'],

    control_if: ['CONDITION', 'SUBSTACK'],
    control_if_else: ['CONDITION', 'SUBSTACK', 'SUBSTACK2'],
    control_repeat_until: ['CONDITION', 'SUBSTACK'],
    control_repeat: ['TIMES', 'SUBSTACK'],
    control_forever: ['SUBSTACK'],

    motion_gotoxy: ['X', 'Y'],
    motion_glidesecstoxy: ['SECS', 'X', 'Y']
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
    ['operator_add', 'operator_subtract', 'operator_multiply', 'operator_divide'],
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
    ['motion_gotoxy', 'motion_glidesecstoxy']
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
    motion_glidesecstoxy: 'glide to x y'
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
    return getInputs(fromOpcode).filter(name => !target.includes(name));
};

/**
 * Inputs the target has that the source did not, paired with the shadow to fill them.
 * @param {string} fromOpcode The block being switched
 * @param {string} toOpcode The block it is becoming
 * @returns {Array<object>} [{name, shadow}], shadow null where there is no sensible default
 */
const getGainedInputs = (fromOpcode, toOpcode) => {
    const source = getInputs(fromOpcode);
    const shadows = DEFAULT_SHADOWS[toOpcode] || {};
    return getInputs(toOpcode)
        .filter(name => !source.includes(name))
        .map(name => ({name, shadow: shadows[name] || null}));
};

export {
    BLOCK_INPUTS,
    BLOCK_LABELS,
    DEFAULT_SHADOWS,
    SWITCH_GROUPS,
    getDroppedInputs,
    getGainedInputs,
    getInputs,
    getSwitchOptions,
    getSwitchableOpcodes
};
