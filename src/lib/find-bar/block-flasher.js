const myFlash = {
    blocks: [],
    timerID: null
};

class BlockFlasher {
    /**
     * Flash a block (and its prototype if custom block) 3 times with a bright highlight color.
     * @param {object} block - Blockly block SVG instance
     */
    static flash (block) {
        if (!block) return;

        const getSvgPaths = b => {
            if (!b) return [];
            const paths = [];
            if (b.svgPath_) paths.push(b.svgPath_);
            if (b.pathObject && b.pathObject.svgPath) paths.push(b.pathObject.svgPath);
            if (b.getChildren) {
                const children = b.getChildren();
                for (const child of children) {
                    if (child.svgPath_) paths.push(child.svgPath_);
                }
            }
            return paths;
        };

        if (myFlash.timerID > 0) {
            clearTimeout(myFlash.timerID);
            for (const p of myFlash.blocks) {
                p.style.fill = '';
            }
            myFlash.blocks = [];
        }

        const targetPaths = getSvgPaths(block);
        if (targetPaths.length === 0) return;

        let count = 6;
        let flashOn = true;
        myFlash.blocks = targetPaths;

        const _flash = () => {
            for (const svgPath of myFlash.blocks) {
                svgPath.style.fill = flashOn ? '#ffff80' : '';
            }
            flashOn = !flashOn;
            count--;
            if (count > 0) {
                myFlash.timerID = setTimeout(_flash, 150);
            } else {
                myFlash.timerID = 0;
                myFlash.blocks = [];
            }
        };

        _flash();
    }
}

export default BlockFlasher;
