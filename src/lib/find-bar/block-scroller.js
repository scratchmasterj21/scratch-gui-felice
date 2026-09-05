import BlockFlasher from './block-flasher';

/**
 * Scroll the workspace to bring the specified block into view, centered and safely clamped.
 * @param {object} workspace - The Blockly workspace
 * @param {object|string} blockOrId - Blockly Block, object with {id, targetId}, or block ID string
 * @param {object} [vm] - Scratch Virtual Machine instance
 */
const scrollBlockIntoView = function (workspace, blockOrId, vm) {
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

    // Critical check: ensure the block is on the main workspace and NOT in the flyout palette!
    if (block.workspace !== workspace) {
        return;
    }

    // Coordinates in workspace units
    const xy = block.getRelativeToSurfaceXY ? block.getRelativeToSurfaceXY() : {x: 0, y: 0};
    const hw = block.getHeightWidth ? block.getHeightWidth() : {width: 0, height: 0};
    const scale = workspace.scale || 1;

    // In RTL, horizontal position is top-right, otherwise top-left
    const multiplier = workspace.RTL ? -1 : 1;
    const blockCenterX = xy.x + (multiplier * (hw.width / 2));
    const blockCenterY = xy.y + (hw.height / 2);

    const pixelX = blockCenterX * scale;
    const pixelY = blockCenterY * scale;

    const metrics = workspace.getMetrics ? workspace.getMetrics() : null;

    if (metrics && workspace.scrollbar) {
        const scrollToBlockX = pixelX - metrics.contentLeft;
        const scrollToBlockY = pixelY - metrics.contentTop;

        const halfViewWidth = metrics.viewWidth / 2;
        const halfViewHeight = metrics.viewHeight / 2;

        const targetX = scrollToBlockX - halfViewWidth;
        const targetY = scrollToBlockY - halfViewHeight;

        // Clamp strictly within valid scrollbar range so workspace cannot scroll off-screen!
        const maxScrollX = Math.max(0, metrics.contentWidth - metrics.viewWidth);
        const maxScrollY = Math.max(0, metrics.contentHeight - metrics.viewHeight);

        const clampedX = Math.max(0, Math.min(targetX, maxScrollX));
        const clampedY = Math.max(0, Math.min(targetY, maxScrollY));

        if (workspace.hideChaff) {
            workspace.hideChaff();
        }

        workspace.scrollbar.set(clampedX, clampedY);
    }

    BlockFlasher.flash(block);
};

export {scrollBlockIntoView};
export default scrollBlockIntoView;
