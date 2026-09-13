import {installBlockSwitching} from '../../../src/lib/block-switching-menu';
import {getSwitchableOpcodes} from '../../../src/lib/block-switching';

/**
 * A stand-in for the ScratchBlocks module. Only the pieces installation touches.
 * @returns {object} a fake ScratchBlocks scope
 */
const makeScope = () => {
    const Blocks = {};
    for (const opcode of getSwitchableOpcodes()) {
        Blocks[opcode] = {init: () => {}};
    }
    // Blocks that install their own context menu through Blockly.Block.prototype.mixin.
    Blocks.data_variable = {init: () => {}, customContextMenu: function () {}};
    Blocks.procedures_definition = {init: () => {}, customContextMenu: function () {}};

    function BlockSvg () {}
    return {Blocks, BlockSvg};
};

/**
 * Blockly's own overwrite guard, from core/block.js. A mixin is refused if any member it
 * wants is already defined on the block - including anything inherited from the prototype.
 * @param {object} block The block the mixin is applied to
 * @param {object} mixinObj The mixin being applied
 * @returns {Array<string>} members that would be overwritten
 */
const wouldOverwrite = (block, mixinObj) => {
    const overwrites = [];
    for (const key in mixinObj) {
        if (block[key] !== undefined) overwrites.push(key);
    }
    return overwrites;
};

describe('installBlockSwitching', () => {
    /*
     * Regression, and the reason this test file exists.
     *
     * The first version attached customContextMenu to BlockSvg.prototype. Blockly's
     * mixin() refuses to install a member that is already defined anywhere on the block,
     * prototype chain included - so every variable, list and procedure block threw while
     * being constructed, and the block palette broke on page load. Nothing to do with
     * right-clicking, which is what made it so confusing to diagnose.
     */
    test('never touches the shared block prototype', () => {
        const scope = makeScope();
        installBlockSwitching(scope);
        expect(scope.BlockSvg.prototype.customContextMenu).toBeUndefined();
    });

    test('a variable block can still install its own context menu afterwards', () => {
        const scope = makeScope();
        installBlockSwitching(scope);

        // A real variable block: inherits from the prototype, then applies its mixin.
        const block = Object.create(scope.BlockSvg.prototype);
        const variableMixin = {customContextMenu: function () {}};
        expect(wouldOverwrite(block, variableMixin)).toEqual([]);
    });

    test('installs a menu on switchable blocks', () => {
        const scope = makeScope();
        const count = installBlockSwitching(scope);
        expect(count).toBeGreaterThan(0);
        expect(typeof scope.Blocks.control_if.customContextMenu).toBe('function');
        expect(typeof scope.Blocks.operator_add.customContextMenu).toBe('function');
    });

    test('leaves a definition that already has a context menu alone', () => {
        const scope = makeScope();
        const before = scope.Blocks.data_variable.customContextMenu;
        installBlockSwitching(scope);
        expect(scope.Blocks.data_variable.customContextMenu).toBe(before);
        expect(scope.Blocks.procedures_definition.customContextMenu).not.toBeUndefined();
    });

    test('is idempotent, because blocks.jsx builds ScratchBlocks more than once', () => {
        const scope = makeScope();
        const first = installBlockSwitching(scope);
        const menu = scope.Blocks.control_if.customContextMenu;
        const second = installBlockSwitching(scope);
        expect(first).toBeGreaterThan(0);
        expect(second).toBe(0);
        expect(scope.Blocks.control_if.customContextMenu).toBe(menu);
    });

    test('tolerates a build that does not define a block', () => {
        const scope = makeScope();
        delete scope.Blocks.motion_glidesecstoxy;
        expect(() => installBlockSwitching(scope)).not.toThrow();
    });

    test('tolerates a scope with no Blocks map', () => {
        expect(installBlockSwitching(null)).toBe(0);
        expect(installBlockSwitching({})).toBe(0);
    });

    test('the menu adds one entry per alternative and none in the flyout', () => {
        const scope = makeScope();
        installBlockSwitching(scope);

        const options = [];
        const workspaceBlock = {
            type: 'control_if',
            isInFlyout: false,
            workspace: {options: {readOnly: false}},
            customContextMenu: scope.Blocks.control_if.customContextMenu
        };
        workspaceBlock.customContextMenu(options);
        expect(options.map(o => o.text).sort())
            .toEqual(['Switch to if then else', 'Switch to repeat until']);

        const flyoutOptions = [];
        const flyoutBlock = Object.assign({}, workspaceBlock, {isInFlyout: true});
        flyoutBlock.customContextMenu(flyoutOptions);
        expect(flyoutOptions).toEqual([]);
    });
});
