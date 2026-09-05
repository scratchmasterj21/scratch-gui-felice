/**
 * Helper to extract descriptive text from block fields
 * @param {object} root - Block root
 * @returns {string} Description text
 */
const getDescFromField = function (root) {
    if (!root || !root.inputList || !root.inputList[0]) {
        return root ? root.type : '';
    }
    let desc = '';
    const fieldRow = root.inputList[0].fieldRow || [];
    for (const field of fieldRow) {
        if (field.getValue && typeof field.getValue() === 'string' && field.getValue().endsWith('green-flag.svg')) {
            desc += `${desc ? ' ' : ''}green flag`;
        } else if (field.getText) {
            const txt = field.getText();
            if (txt) {
                desc += `${desc ? ' ' : ''}${txt}`;
            }
        }
    }
    return desc || root.type;
};

/**
 * Scan workspace for all broadcast senders
 * @param {object} workspace - Blockly workspace
 * @returns {Array<object>} Broadcast sender blocks
 */
const getBroadcastSenders = function (workspace) {
    const uses = [];
    const found = new Set();
    if (!workspace || !workspace.getAllBlocks) return uses;

    const allBlocks = workspace.getAllBlocks();
    for (const block of allBlocks) {
        if (block.type !== 'event_broadcast' && block.type !== 'event_broadcastandwait') {
            continue;
        }
        const children = block.getChildren ? block.getChildren() : [];
        const broadcastInput = children[0];
        if (!broadcastInput) continue;

        let eventName = '';
        if (broadcastInput.type === 'event_broadcast_menu' &&
            broadcastInput.inputList &&
            broadcastInput.inputList[0]) {
            const field = broadcastInput.inputList[0].fieldRow && broadcastInput.inputList[0].fieldRow[0];
            if (field && field.getText) {
                eventName = field.getText();
            }
        }
        if (eventName && !found.has(eventName)) {
            found.add(eventName);
            uses.push({eventName, block});
        }
    }
    return uses;
};

/**
 * Extracts and categorizes blocks, variables, and events for search indexing.
 * @param {object} workspace - Blockly workspace
 * @returns {Array<object>} Array of indexed items
 */
const getIndexedItems = function (workspace) {
    if (!workspace) return [];

    const items = [];
    const itemsByLabel = {};

    /**
     * Add an item to index
     * @param {string} cls - Item class/category
     * @param {string} label - Human-readable label
     * @param {object|string} blockOrId - Block or block id
     * @param {object} [extra] - Extra metadata
     * @returns {object} Indexed item
     */
    const addItem = function (cls, label, blockOrId, extra = {}) {
        const id = (typeof blockOrId === 'string') ?
            blockOrId :
            (blockOrId && (blockOrId.id || (blockOrId.getId && blockOrId.getId())));
        const existing = itemsByLabel[label];
        if (existing) {
            if (!existing.clones) {
                existing.clones = [existing.id];
            }
            if (id && !existing.clones.includes(id)) {
                existing.clones.push(id);
            }
            return existing;
        }

        const yPos = blockOrId && blockOrId.getRelativeToSurfaceXY ? blockOrId.getRelativeToSurfaceXY().y : 0;
        const item = {
            id,
            cls,
            label,
            lower: label.toLowerCase(),
            y: yPos,
            clones: null,
            ...extra
        };

        items.push(item);
        itemsByLabel[label] = item;
        return item;
    };

    // 1. Scan Top Blocks
    const topBlocks = workspace.getTopBlocks ? workspace.getTopBlocks() : [];
    for (const root of topBlocks) {
        if (!root.type) continue;

        if (root.type === 'procedures_definition') {
            const labelChild = root.getChildren && root.getChildren()[0];
            const procCode = labelChild && labelChild.getProcCode ? labelChild.getProcCode() : null;
            if (procCode) {
                let defLabel = 'define';
                if (root.inputList && root.inputList[0] &&
                    root.inputList[0].fieldRow && root.inputList[0].fieldRow[0]) {
                    defLabel = root.inputList[0].fieldRow[0].getText() || 'define';
                }
                addItem('define', `${defLabel} ${procCode}`, root);
            }
            continue;
        }

        if (root.type === 'event_whenflagclicked') {
            addItem('flag', getDescFromField(root), root);
            continue;
        }

        if (root.type === 'event_whenbroadcastreceived') {
            let eventName = '';
            if (root.inputList && root.inputList[0] && root.inputList[0].fieldRow) {
                const opt = root.inputList[0].fieldRow.find(f => f.name === 'BROADCAST_OPTION');
                if (opt && opt.getText) {
                    eventName = opt.getText();
                }
            }
            const label = eventName ? `when I receive ${eventName}` : getDescFromField(root);
            const item = addItem('receive', label, root);
            item.eventName = eventName;
            continue;
        }

        if (root.type.startsWith('event_when') || root.type === 'control_start_as_clone') {
            addItem('event', getDescFromField(root), root);
            continue;
        }
    }

    // 2. Scan Variables & Lists
    const varMap = workspace.getVariableMap ? workspace.getVariableMap() : null;
    if (varMap) {
        const vars = varMap.getVariablesOfType ? varMap.getVariablesOfType('') : [];
        for (const row of vars) {
            const isLocal = row.isLocal;
            const prefix = isLocal ? 'var' : 'VAR';
            const vId = row.getId ? row.getId() : row.id;
            addItem(isLocal ? 'var' : 'VAR', `${prefix} ${row.name}`, vId, {varId: vId});
        }

        const lists = varMap.getVariablesOfType ? varMap.getVariablesOfType('list') : [];
        for (const row of lists) {
            const isLocal = row.isLocal;
            const prefix = isLocal ? 'list' : 'LIST';
            const lId = row.getId ? row.getId() : row.id;
            addItem(isLocal ? 'list' : 'LIST', `${prefix} ${row.name}`, lId, {varId: lId});
        }
    }

    // 3. Scan Broadcast Senders
    const broadcastUses = getBroadcastSenders(workspace);
    for (const event of broadcastUses) {
        const label = `when I receive ${event.eventName}`;
        if (!itemsByLabel[label]) {
            const item = addItem('receive', label, event.block);
            item.eventName = event.eventName;
        }
    }

    const clsPriority = {
        flag: 0,
        receive: 1,
        event: 2,
        define: 3,
        var: 4,
        VAR: 5,
        list: 6,
        LIST: 7
    };

    items.sort((a, b) => {
        const diff = (clsPriority[a.cls] || 99) - (clsPriority[b.cls] || 99);
        if (diff !== 0) return diff;
        if (a.lower < b.lower) return -1;
        if (a.lower > b.lower) return 1;
        return (a.y || 0) - (b.y || 0);
    });

    return items;
};

/**
 * Get blocks that use a given variable
 * @param {object} workspace - Blockly workspace
 * @param {string} varId - Variable ID
 * @returns {Array<object>} Blocks using the variable
 */
const getVariableUses = function (workspace, varId) {
    const uses = [];
    if (!workspace || !varId) return uses;
    const topBlocks = workspace.getTopBlocks ? workspace.getTopBlocks() : [];
    for (const topBlock of topBlocks) {
        const descendants = topBlock.getDescendants ? topBlock.getDescendants() : [];
        for (const block of descendants) {
            const vars = block.getVarModels ? block.getVarModels() : [];
            for (const v of vars) {
                if ((v.getId && v.getId() === varId) || v.id === varId) {
                    uses.push(block);
                    break;
                }
            }
        }
    }
    return uses;
};

/**
 * Get calls to a procedure definition
 * @param {object} workspace - Blockly workspace
 * @param {string} defBlockId - Procedure definition block ID
 * @returns {Array<object>} Definition and call blocks
 */
const getProcedureUses = function (workspace, defBlockId) {
    if (!workspace || !defBlockId) return [];
    const defBlock = workspace.getBlockById(defBlockId);
    if (!defBlock) return [];
    const labelChild = defBlock.getChildren && defBlock.getChildren()[0];
    const procCode = labelChild && labelChild.getProcCode ? labelChild.getProcCode() : null;
    const uses = [defBlock];
    if (!procCode) return uses;

    const topBlocks = workspace.getTopBlocks ? workspace.getTopBlocks() : [];
    for (const topBlock of topBlocks) {
        const descendants = topBlock.getDescendants ? topBlock.getDescendants() : [];
        for (const block of descendants) {
            if (block.type === 'procedures_call' && block.getProcCode && block.getProcCode() === procCode) {
                uses.push(block);
            }
        }
    }
    return uses;
};

/**
 * Get broadcast blocks by event name across all VM targets
 * @param {object} vm - Scratch VM
 * @param {string} eventName - Event name
 * @returns {Array<object>} Objects containing targetId and id
 */
const getBroadcastUses = function (vm, eventName) {
    const uses = [];
    if (!vm || !vm.runtime || !vm.runtime.targets || !eventName) return uses;
    const nameLower = eventName.toLowerCase();

    for (const target of vm.runtime.targets) {
        if (!target.isOriginal) continue;
        const blocks = target.blocks;
        if (!blocks || !blocks._blocks) continue;

        for (const id of Object.keys(blocks._blocks)) {
            const b = blocks._blocks[id];
            if (b.opcode === 'event_whenbroadcastreceived') {
                const opt = b.fields && b.fields.BROADCAST_OPTION;
                if (opt && (opt.value || '').toLowerCase() === nameLower) {
                    uses.push({id, targetId: target.id});
                }
            } else if (b.opcode === 'event_broadcast' || b.opcode === 'event_broadcastandwait') {
                const inputId = b.inputs && b.inputs.BROADCAST_INPUT && b.inputs.BROADCAST_INPUT.block;
                const menu = blocks._blocks[inputId];
                if (menu && menu.fields && menu.fields.BROADCAST_OPTION) {
                    if ((menu.fields.BROADCAST_OPTION.value || '').toLowerCase() === nameLower) {
                        uses.push({id, targetId: target.id});
                    }
                }
            }
        }
    }
    return uses;
};

/**
 * Get costumes for current editing target
 * @param {object} vm - Scratch VM
 * @returns {Array<object>} Costumes list
 */
const getCostumes = function (vm) {
    const target = vm && vm.runtime && vm.runtime.getEditingTarget();
    if (!target) return [];
    return (target.getCostumes() || []).map((c, idx) => ({
        cls: 'costume',
        label: c.name,
        lower: c.name.toLowerCase(),
        index: idx,
        assetId: c.assetId
    }));
};

/**
 * Get sounds for current editing target
 * @param {object} vm - Scratch VM
 * @returns {Array<object>} Sounds list
 */
const getSounds = function (vm) {
    const target = vm && vm.runtime && vm.runtime.getEditingTarget();
    if (!target) return [];
    return (target.getSounds() || []).map((s, idx) => ({
        cls: 'sound',
        label: s.name,
        lower: s.name.toLowerCase(),
        index: idx,
        assetId: s.assetId
    }));
};

export {
    getIndexedItems,
    getBroadcastSenders,
    getVariableUses,
    getProcedureUses,
    getBroadcastUses,
    getCostumes,
    getSounds
};
