/**
 * The XML half of switching a block: rewriting the serialised block from one type to
 * another, lifting out contents that no longer have a home, and filling inputs the new
 * type gains.
 *
 * Split out from block-switching-menu.js on purpose. That file has to juggle live Blockly
 * connections and cannot run under jsdom, but this is plain DOM manipulation on the element
 * blockToDom returns - so it can be tested, and the first version of this feature shipped
 * with it untested.
 */

import {getDroppedInputs, getGainedInputs} from './block-switching';

/**
 * The <value> or <statement> element for a named input, if the block has one.
 * @param {Element} blockDom A serialised block
 * @param {string} inputName The input to look for
 * @returns {?Element} the input element, or null
 */
const getInputDom = (blockDom, inputName) => {
    for (const child of Array.from(blockDom.childNodes)) {
        const tag = child.nodeName && child.nodeName.toLowerCase();
        if ((tag === 'value' || tag === 'statement') &&
            child.getAttribute('name') === inputName) {
            return child;
        }
    }
    return null;
};

/**
 * A <value> holding a default shadow, matching what the toolbox would have supplied.
 * @param {Document} ownerDocument The document to create elements in
 * @param {string} inputName Name of the input
 * @param {object} shadow {type, field, value}
 * @returns {Element} the new <value> element
 */
const buildShadowDom = (ownerDocument, inputName, shadow) => {
    const valueDom = ownerDocument.createElement('value');
    valueDom.setAttribute('name', inputName);
    const shadowDom = ownerDocument.createElement('shadow');
    shadowDom.setAttribute('type', shadow.type);
    const fieldDom = ownerDocument.createElement('field');
    fieldDom.setAttribute('name', shadow.field);
    fieldDom.textContent = shadow.value;
    shadowDom.appendChild(fieldDom);
    valueDom.appendChild(shadowDom);
    return valueDom;
};

/**
 * Rewrite a serialised block into a different type, in place.
 *
 * Contents of inputs the new type does not have are returned rather than discarded, so the
 * caller can rebuild them as free-standing blocks. Only real blocks are returned: a shadow
 * is the grey default value, and leaving those scattered on the workspace would be litter
 * rather than rescue.
 * @param {Element} blockDom A serialised block, modified in place
 * @param {string} fromOpcode The type it currently is
 * @param {string} toOpcode The type it should become
 * @returns {Array<Element>} serialised blocks that no longer have a home
 */
const transformBlockDom = (blockDom, fromOpcode, toOpcode) => {
    blockDom.setAttribute('type', toOpcode);

    const orphanDoms = [];
    for (const inputName of getDroppedInputs(fromOpcode, toOpcode)) {
        const inputDom = getInputDom(blockDom, inputName);
        if (!inputDom) continue;
        for (const child of Array.from(inputDom.childNodes)) {
            if (child.nodeName && child.nodeName.toLowerCase() === 'block') {
                orphanDoms.push(child);
            }
        }
        blockDom.removeChild(inputDom);
    }

    for (const gained of getGainedInputs(fromOpcode, toOpcode)) {
        // A statement input, such as the else branch, has no shadow and simply starts empty.
        if (!gained.shadow) continue;
        // Defensive: never end up with the same input twice.
        if (getInputDom(blockDom, gained.name)) continue;
        blockDom.appendChild(
            buildShadowDom(blockDom.ownerDocument, gained.name, gained.shadow));
    }

    return orphanDoms;
};

export {
    buildShadowDom,
    getInputDom,
    transformBlockDom
};
