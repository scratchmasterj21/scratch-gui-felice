import {
    BLOCK_INPUTS,
    BLOCK_LABELS,
    DEFAULT_SHADOWS,
    SWITCH_GROUPS,
    getDroppedInputs,
    getGainedInputs,
    getInputs,
    getSwitchOptions
} from '../../../src/lib/block-switching';

const opcodesOf = options => options.map(o => o.opcode);

describe('the switch table itself', () => {
    test('every block in a group has its inputs declared', () => {
        for (const group of SWITCH_GROUPS) {
            for (const opcode of group) {
                expect(BLOCK_INPUTS[opcode]).toBeDefined();
            }
        }
    });

    test('every switchable block has a menu label', () => {
        for (const group of SWITCH_GROUPS) {
            for (const opcode of group) {
                expect(typeof BLOCK_LABELS[opcode]).toBe('string');
                expect(BLOCK_LABELS[opcode].length).toBeGreaterThan(0);
            }
        }
    });

    test('switching is symmetric: if A offers B, B offers A', () => {
        const allOpcodes = new Set(SWITCH_GROUPS.reduce((acc, g) => acc.concat(g), []));
        for (const opcode of allOpcodes) {
            for (const option of getSwitchOptions(opcode)) {
                expect(opcodesOf(getSwitchOptions(option.opcode))).toContain(opcode);
            }
        }
    });

    test('a block is never offered as a switch for itself', () => {
        const allOpcodes = new Set(SWITCH_GROUPS.reduce((acc, g) => acc.concat(g), []));
        for (const opcode of allOpcodes) {
            expect(opcodesOf(getSwitchOptions(opcode))).not.toContain(opcode);
        }
    });

    test('every default shadow names an input the block actually has', () => {
        for (const [opcode, shadows] of Object.entries(DEFAULT_SHADOWS)) {
            for (const inputName of Object.keys(shadows)) {
                expect(getInputs(opcode)).toContain(inputName);
            }
        }
    });
});

describe('getSwitchOptions', () => {
    test('offers the whole operator family', () => {
        expect(opcodesOf(getSwitchOptions('operator_add')).sort()).toEqual([
            'operator_divide', 'operator_multiply', 'operator_subtract'
        ]);
    });

    /*
     * Comparison and boolean operators share OPERAND1/OPERAND2, which makes them look
     * interchangeable. They are not: comparison operands hold text and boolean operands
     * hold booleans, so switching = to and would leave text blocks in boolean sockets.
     */
    test('never offers a boolean operator as a swap for a comparison', () => {
        expect(opcodesOf(getSwitchOptions('operator_equals'))).not.toContain('operator_and');
        expect(opcodesOf(getSwitchOptions('operator_equals'))).not.toContain('operator_or');
        expect(opcodesOf(getSwitchOptions('operator_and'))).not.toContain('operator_equals');
    });

    test('unions the groups a block belongs to', () => {
        // looks_say is in [say, think] and in [say, sayforsecs]
        expect(opcodesOf(getSwitchOptions('looks_say')).sort())
            .toEqual(['looks_sayforsecs', 'looks_think']);
    });

    test('offers if/else and repeat until for an if block', () => {
        expect(opcodesOf(getSwitchOptions('control_if')).sort())
            .toEqual(['control_if_else', 'control_repeat_until']);
    });

    test('returns nothing for a block that cannot be switched', () => {
        expect(getSwitchOptions('event_whenflagclicked')).toEqual([]);
        expect(getSwitchOptions('not_a_real_opcode')).toEqual([]);
    });
});

describe('getDroppedInputs', () => {
    // The orphan case: blocks in the else branch have nowhere to go, and are left loose
    // on the workspace rather than deleted.
    test('if/else to if drops the else branch', () => {
        expect(getDroppedInputs('control_if_else', 'control_if')).toEqual(['SUBSTACK2']);
    });

    test('repeat to forever drops the loop count', () => {
        expect(getDroppedInputs('control_repeat', 'control_forever')).toEqual(['TIMES']);
    });

    test('say for seconds to say drops the duration', () => {
        expect(getDroppedInputs('looks_sayforsecs', 'looks_say')).toEqual(['SECS']);
    });

    test('drops nothing when the inputs match', () => {
        expect(getDroppedInputs('operator_add', 'operator_multiply')).toEqual([]);
        expect(getDroppedInputs('control_if', 'control_repeat_until')).toEqual([]);
    });
});

describe('getGainedInputs', () => {
    test('say to say for seconds gains a duration with the toolbox default', () => {
        expect(getGainedInputs('looks_say', 'looks_sayforsecs')).toEqual([
            {name: 'SECS', shadow: {type: 'math_number', field: 'NUM', value: '2'}}
        ]);
    });

    test('go to x y to glide gains a duration of one second', () => {
        expect(getGainedInputs('motion_gotoxy', 'motion_glidesecstoxy')).toEqual([
            {name: 'SECS', shadow: {type: 'math_number', field: 'NUM', value: '1'}}
        ]);
    });

    test('forever to repeat gains a loop count of ten', () => {
        expect(getGainedInputs('control_forever', 'control_repeat')).toEqual([
            {name: 'TIMES', shadow: {type: 'math_whole_number', field: 'NUM', value: '10'}}
        ]);
    });

    // A statement input has no shadow to fill it; the else branch just starts empty.
    test('if to if/else gains an empty else branch', () => {
        expect(getGainedInputs('control_if', 'control_if_else')).toEqual([
            {name: 'SUBSTACK2', shadow: null}
        ]);
    });

    test('gains nothing when the inputs match', () => {
        expect(getGainedInputs('operator_gt', 'operator_lt')).toEqual([]);
    });
});
