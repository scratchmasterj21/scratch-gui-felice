/**
 * Adds "switch this block to..." entries to the workspace right-click menu.
 *
 * scratch-blocks ships as a Closure-compiled bundle, but block context menus have a real
 * extension point that survives compilation: BlockSvg.showContextMenu_ builds the standard
 * Duplicate/Comment/Delete options and then hands the array to `this.customContextMenu`
 * if one exists (see node_modules/scratch-blocks/core/block_svg.js). scratch-blocks uses
 * it for procedure and variable blocks, so it is supported API rather than a crack to slip
 * through - and it means none of this needs the 2.3MB bundle to be forked or patched.
 *
 * The XML rewriting lives in block-switching-dom.js, where it can be tested. What is left
 * here is connection juggling against a live workspace, which cannot run under jsdom.
 */

import log from './log';
import {getSwitchOptions, getSwitchableOpcodes} from './block-switching';
import {transformBlockDom} from './block-switching-dom';

// blocks.jsx builds ScratchBlocks more than once, so installation has to be idempotent.
// Held here rather than as a flag on ScratchBlocks itself to avoid putting a non-block key
// into the Blockly.Blocks map.
const installedScopes = new WeakSet();

// How far from the original block to drop contents that no longer have a home.
const ORPHAN_OFFSET = 24;

/**
 * Replace a block with a different type, keeping its inputs and its place in the script.
 *
 * Blockly cannot retype a block in place, so the block is serialised, the type rewritten,
 * and a replacement built from the result. Two things matter beyond that:
 *
 * The whole thing runs in one event group, so undo puts the original block back in a
 * single step rather than unwinding the rebuild piece by piece.
 *
 * And it is atomic. The block has to be detached from its parent and its next block before
 * being serialised, or blockToDom would drag the rest of the script along with it - which
 * means a failure half way through would otherwise leave the script in pieces on the
 * workspace. If anything throws, the original block is put back exactly where it was.
 * @param {object} ScratchBlocks The ScratchBlocks module
 * @param {object} block The block to switch
 * @param {string} toOpcode The type it should become
 * @returns {boolean} true if the block was switched
 */
const switchBlock = (ScratchBlocks, block, toOpcode) => {
    const workspace = block.workspace;
    const fromOpcode = block.type;

    // Captured before anything is disconnected: disconnecting can bump a block away from
    // where it was sitting.
    const position = block.getRelativeToSurfaceXY();
    const ownConnection = block.outputConnection || block.previousConnection;
    const parentConnection = ownConnection && ownConnection.targetConnection;
    const nextBlock = block.nextConnection && block.nextConnection.targetBlock();

    const reattachOriginal = () => {
        try {
            if (parentConnection && ownConnection && !ownConnection.targetConnection) {
                parentConnection.connect(ownConnection);
            }
            if (nextBlock && block.nextConnection && !block.nextConnection.targetConnection) {
                block.nextConnection.connect(nextBlock.previousConnection);
            }
        } catch (reattachError) {
            log.error('Could not put the original block back after a failed switch',
                reattachError);
        }
    };

    let newBlock = null;
    ScratchBlocks.Events.setGroup(true);
    try {
        if (nextBlock) block.nextConnection.disconnect();
        if (parentConnection) ownConnection.disconnect();

        const blockDom = ScratchBlocks.Xml.blockToDom(block);
        const orphanDoms = transformBlockDom(blockDom, fromOpcode, toOpcode);

        newBlock = ScratchBlocks.Xml.domToBlock(blockDom, workspace);

        const newConnection = newBlock.outputConnection || newBlock.previousConnection;
        if (parentConnection && newConnection) {
            parentConnection.connect(newConnection);
        } else {
            newBlock.moveBy(position.x, position.y);
        }
        if (nextBlock && newBlock.nextConnection) {
            newBlock.nextConnection.connect(nextBlock.previousConnection);
        }

        block.dispose(false /* healStack */);

        let offset = ORPHAN_OFFSET;
        for (const orphanDom of orphanDoms) {
            const orphan = ScratchBlocks.Xml.domToBlock(orphanDom, workspace);
            orphan.moveBy(position.x + offset, position.y + offset);
            offset += ORPHAN_OFFSET;
        }
        return true;
    } catch (error) {
        log.error(`Could not switch ${fromOpcode} to ${toOpcode}`, error);
        if (newBlock) {
            // A half-built replacement is worse than none.
            try {
                newBlock.dispose(false);
            } catch (disposeError) {
                log.error('Could not clean up after a failed switch', disposeError);
            }
        }
        reattachOriginal();
        return false;
    } finally {
        ScratchBlocks.Events.setGroup(false);
    }
};

/**
 * Install the switch options on the context menu of switchable blocks. Idempotent.
 *
 * The menu handler is attached to each block *definition* rather than to
 * BlockSvg.prototype. That distinction is the whole reason this works: a block picks up its
 * definition through goog.mixin (core/block.js), which copies without checking, but
 * Blockly.Block.prototype.mixin - used by variable, list and procedure blocks to install
 * their own context menus - throws if a member it wants is already defined anywhere on the
 * block, prototype chain included. Putting customContextMenu on the shared prototype
 * therefore made every one of those blocks fail to construct, which broke the palette on
 * load rather than on right click.
 * @param {object} ScratchBlocks The ScratchBlocks module to extend
 * @returns {number} how many block definitions were given a switch menu
 */
const installBlockSwitching = ScratchBlocks => {
    const blockDefinitions = ScratchBlocks && ScratchBlocks.Blocks;
    if (!blockDefinitions || installedScopes.has(blockDefinitions)) return 0;
    installedScopes.add(blockDefinitions);

    let installed = 0;
    for (const opcode of getSwitchableOpcodes()) {
        const definition = blockDefinitions[opcode];
        // Not every build defines every block, and a definition that already has its own
        // context menu is left alone rather than fought over.
        if (!definition || definition.customContextMenu) continue;

        definition.customContextMenu = function (menuOptions) {
            if (this.isInFlyout || this.workspace.options.readOnly) return;
            const block = this;
            for (const option of getSwitchOptions(this.type)) {
                menuOptions.push({
                    enabled: true,
                    text: `Switch to ${option.label}`,
                    callback: () => switchBlock(ScratchBlocks, block, option.opcode)
                });
            }
        };
        installed++;
    }
    return installed;
};

export {
    installBlockSwitching,
    switchBlock
};
