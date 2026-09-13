import {
    buildShadowDom,
    getInputDom,
    transformBlockDom
} from '../../../src/lib/block-switching-dom';

/**
 * Builds the shape Blockly's blockToDom produces, so these tests exercise the same input
 * the real code sees.
 * @param {string} type The block type
 * @param {Array<object>} inputs [{tag, name, childType, shadow}]
 * @returns {Element} a serialised block
 */
const makeBlockDom = (type, inputs = []) => {
    const block = document.createElement('block');
    block.setAttribute('type', type);
    block.setAttribute('id', `${type}-id`);
    for (const input of inputs) {
        const el = document.createElement(input.tag || 'value');
        el.setAttribute('name', input.name);
        if (input.childType) {
            const child = document.createElement(input.shadow ? 'shadow' : 'block');
            child.setAttribute('type', input.childType);
            el.appendChild(child);
        }
        block.appendChild(el);
    }
    return block;
};

const inputNames = blockDom => Array.from(blockDom.childNodes)
    .filter(n => ['value', 'statement'].includes(n.nodeName.toLowerCase()))
    .map(n => n.getAttribute('name'));

describe('getInputDom', () => {
    test('finds a value and a statement input by name', () => {
        const dom = makeBlockDom('control_if', [
            {tag: 'value', name: 'CONDITION'},
            {tag: 'statement', name: 'SUBSTACK'}
        ]);
        expect(getInputDom(dom, 'CONDITION').nodeName.toLowerCase()).toBe('value');
        expect(getInputDom(dom, 'SUBSTACK').nodeName.toLowerCase()).toBe('statement');
    });

    test('returns null for an input the block does not have', () => {
        expect(getInputDom(makeBlockDom('control_if'), 'SUBSTACK2')).toBeNull();
    });
});

describe('buildShadowDom', () => {
    test('builds the value/shadow/field nesting Blockly expects', () => {
        const dom = buildShadowDom(document, 'SECS', {
            type: 'math_number', field: 'NUM', value: '2'
        });
        expect(dom.nodeName.toLowerCase()).toBe('value');
        expect(dom.getAttribute('name')).toBe('SECS');
        const shadow = dom.firstChild;
        expect(shadow.nodeName.toLowerCase()).toBe('shadow');
        expect(shadow.getAttribute('type')).toBe('math_number');
        const field = shadow.firstChild;
        expect(field.getAttribute('name')).toBe('NUM');
        expect(field.textContent).toBe('2');
    });
});

describe('transformBlockDom', () => {
    test('rewrites the type', () => {
        const dom = makeBlockDom('operator_add', [
            {tag: 'value', name: 'NUM1'}, {tag: 'value', name: 'NUM2'}
        ]);
        transformBlockDom(dom, 'operator_add', 'operator_multiply');
        expect(dom.getAttribute('type')).toBe('operator_multiply');
        expect(inputNames(dom)).toEqual(['NUM1', 'NUM2']);
    });

    /*
     * The case that decides whether a student loses work: switching if/else back to if.
     * Whatever was in the else branch must come back to the caller so it can be rebuilt,
     * not silently deleted along with the input.
     */
    test('if/else to if returns the else branch contents as orphans', () => {
        const dom = makeBlockDom('control_if_else', [
            {tag: 'value', name: 'CONDITION'},
            {tag: 'statement', name: 'SUBSTACK', childType: 'motion_movesteps'},
            {tag: 'statement', name: 'SUBSTACK2', childType: 'looks_say'}
        ]);
        const orphans = transformBlockDom(dom, 'control_if_else', 'control_if');

        expect(dom.getAttribute('type')).toBe('control_if');
        expect(inputNames(dom)).toEqual(['CONDITION', 'SUBSTACK']);
        expect(orphans).toHaveLength(1);
        expect(orphans[0].getAttribute('type')).toBe('looks_say');
    });

    test('the kept branch is untouched', () => {
        const dom = makeBlockDom('control_if_else', [
            {tag: 'statement', name: 'SUBSTACK', childType: 'motion_movesteps'},
            {tag: 'statement', name: 'SUBSTACK2', childType: 'looks_say'}
        ]);
        transformBlockDom(dom, 'control_if_else', 'control_if');
        expect(getInputDom(dom, 'SUBSTACK').firstChild.getAttribute('type'))
            .toBe('motion_movesteps');
    });

    // A shadow is the grey default; rescuing those would scatter literals on the workspace.
    test('shadows in a dropped input are discarded, not orphaned', () => {
        const dom = makeBlockDom('control_repeat', [
            {tag: 'value', name: 'TIMES', childType: 'math_whole_number', shadow: true},
            {tag: 'statement', name: 'SUBSTACK'}
        ]);
        const orphans = transformBlockDom(dom, 'control_repeat', 'control_forever');
        expect(inputNames(dom)).toEqual(['SUBSTACK']);
        expect(orphans).toEqual([]);
    });

    test('a real block in a dropped input is orphaned even when a shadow sits beside it', () => {
        const dom = makeBlockDom('looks_sayforsecs', [{tag: 'value', name: 'MESSAGE'}]);
        const secs = document.createElement('value');
        secs.setAttribute('name', 'SECS');
        const shadow = document.createElement('shadow');
        shadow.setAttribute('type', 'math_number');
        const real = document.createElement('block');
        real.setAttribute('type', 'operator_random');
        secs.appendChild(shadow);
        secs.appendChild(real);
        dom.appendChild(secs);

        const orphans = transformBlockDom(dom, 'looks_sayforsecs', 'looks_say');
        expect(orphans).toHaveLength(1);
        expect(orphans[0].getAttribute('type')).toBe('operator_random');
    });

    /*
     * Without this a say switched to "say for seconds" renders with an empty hole where
     * the duration belongs, because shadows come from the toolbox XML rather than the
     * block definition.
     */
    test('say to say for seconds gains the toolbox default duration', () => {
        const dom = makeBlockDom('looks_say', [{tag: 'value', name: 'MESSAGE'}]);
        transformBlockDom(dom, 'looks_say', 'looks_sayforsecs');
        expect(inputNames(dom)).toEqual(['MESSAGE', 'SECS']);
        const secs = getInputDom(dom, 'SECS');
        expect(secs.firstChild.getAttribute('type')).toBe('math_number');
        expect(secs.firstChild.firstChild.textContent).toBe('2');
    });

    test('forever to repeat gains a loop count of ten', () => {
        const dom = makeBlockDom('control_forever', [{tag: 'statement', name: 'SUBSTACK'}]);
        transformBlockDom(dom, 'control_forever', 'control_repeat');
        expect(getInputDom(dom, 'TIMES').firstChild.firstChild.textContent).toBe('10');
    });

    test('if to if/else adds no empty else input, since a statement has no shadow', () => {
        const dom = makeBlockDom('control_if', [
            {tag: 'value', name: 'CONDITION'},
            {tag: 'statement', name: 'SUBSTACK'}
        ]);
        const orphans = transformBlockDom(dom, 'control_if', 'control_if_else');
        expect(dom.getAttribute('type')).toBe('control_if_else');
        expect(inputNames(dom)).toEqual(['CONDITION', 'SUBSTACK']);
        expect(orphans).toEqual([]);
    });

    test('never duplicates an input the block already has', () => {
        const dom = makeBlockDom('control_forever', [
            {tag: 'statement', name: 'SUBSTACK'},
            {tag: 'value', name: 'TIMES', childType: 'math_whole_number', shadow: true}
        ]);
        transformBlockDom(dom, 'control_forever', 'control_repeat');
        expect(inputNames(dom).filter(n => n === 'TIMES')).toHaveLength(1);
    });

    test('a swap with matching inputs changes nothing but the type', () => {
        const dom = makeBlockDom('control_if', [
            {tag: 'value', name: 'CONDITION', childType: 'operator_equals'},
            {tag: 'statement', name: 'SUBSTACK', childType: 'motion_movesteps'}
        ]);
        const orphans = transformBlockDom(dom, 'control_if', 'control_repeat_until');
        expect(dom.getAttribute('type')).toBe('control_repeat_until');
        expect(inputNames(dom)).toEqual(['CONDITION', 'SUBSTACK']);
        expect(orphans).toEqual([]);
    });
});

describe('input renaming in the serialised block', () => {
    test('change x by becomes set x to, carrying the value across', () => {
        const dom = makeBlockDom('motion_changexby', [
            {tag: 'value', name: 'DX', childType: 'operator_random'}
        ]);
        const orphans = transformBlockDom(dom, 'motion_changexby', 'motion_setx');

        expect(dom.getAttribute('type')).toBe('motion_setx');
        expect(inputNames(dom)).toEqual(['X']);
        expect(getInputDom(dom, 'X').firstChild.getAttribute('type')).toBe('operator_random');
        expect(orphans).toEqual([]);
    });

    test('change effect by becomes set effect to, leaving EFFECT untouched', () => {
        const dom = makeBlockDom('looks_changeeffectby', [
            {tag: 'value', name: 'EFFECT'},
            {tag: 'value', name: 'CHANGE', childType: 'math_number', shadow: true}
        ]);
        transformBlockDom(dom, 'looks_changeeffectby', 'looks_seteffectto');
        expect(inputNames(dom)).toEqual(['EFFECT', 'VALUE']);
    });

    test('a rename in the other direction works too', () => {
        const dom = makeBlockDom('looks_setsizeto', [{tag: 'value', name: 'SIZE'}]);
        transformBlockDom(dom, 'looks_setsizeto', 'looks_changesizeby');
        expect(inputNames(dom)).toEqual(['CHANGE']);
    });
});
