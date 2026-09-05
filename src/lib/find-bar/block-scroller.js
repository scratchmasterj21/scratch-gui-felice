import BlockFlasher from './block-flasher';

/**
 * Helper to find the top of a stack of blocks
 * @param {object} block - Blockly block
 * @returns {object} The top of the stack
 */
const getTopOfStackFor = function (block) {
    let base = block;
    while (
        base &&
        base.getOutputShape &&
        base.getOutputShape() &&
        base.getSurroundParent &&
        base.getSurroundParent()
    ) {
        base = base.getSurroundParent();
    }
    return base;
};

/**
 * Scroll the workspace to bring the specified block into view, and flash it.
 * @param {object} workspace - The Blockly workspace
 * @param {object|string} blockOrId - Blockly Block, object with {id, targetId}, or block ID string
 * @param {object} [vm] - Scratch Virtual Machine instance
 * @param {number} [offsetX=32] - Horizontal offset padding
 * @param {number} [offsetY=32] - Vertical offset padding
 */
const scrollBlockIntoView = function (workspace, blockOrId, vm, offsetX = 32, offsetY = 32) {
    if (!workspace) return;

    if (blockOrId && blockOrId.targetId && vm) {
        const currentTarget = vm.runtime.getEditingTarget();
        if (currentTarget && currentTarget.id !== blockOrId.targetId) {
            vm.setEditingTarget(blockOrId.targetId);
        }
    }

    const blockId = (typeof blockOrId === 'string') ? blockOrId : (blockOrId && blockOrId.id);
    if (!blockId) return;

    const block = workspace.getBlockById(blockId);
    if (!block) return;

    const root = block.getRootBlock ? block.getRootBlock() : block;
    const base = getTopOfStackFor(block);
    const ePos = (base.getRelativeToSurfaceXY ? base.getRelativeToSurfaceXY() : {x: 0, y: 0});
    const rPos = (root.getRelativeToSurfaceXY ? root.getRelativeToSurfaceXY() : {x: 0, y: 0});
    const scale = workspace.scale || 1;
    const x = rPos.x * scale;
    const y = ePos.y * scale;
    const xx = (block.width || 0) + x;
    const yy = (block.height || 0) + y;
    const s = workspace.getMetrics ? workspace.getMetrics() : null;

    if (s && workspace.scrollbar) {
        if (
            x < s.viewLeft + offsetX - 4 ||
            xx > s.viewLeft + s.viewWidth ||
            y < s.viewTop + offsetY - 4 ||
            yy > s.viewTop + s.viewHeight
        ) {
            const scrollLeft = typeof s.scrollLeft === 'undefined' ? s.contentLeft : s.scrollLeft;
            const scrollTop = typeof s.scrollTop === 'undefined' ? s.contentTop : s.scrollTop;
            const sx = (x - offsetX) - scrollLeft;
            const sy = (y - offsetY) - scrollTop;
            workspace.scrollbar.set(sx, sy);
        }
    }

    if (workspace.hideChaff) {
        workspace.hideChaff();
    }

    BlockFlasher.flash(block);
};

export {scrollBlockIntoView};
export default scrollBlockIntoView;
