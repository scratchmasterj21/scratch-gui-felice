const myFlash = {
    block: null,
    timerID: null
};

class BlockFlasher {
    /**
     * Flash a block 3 times with a bright highlight color.
     * @param {object} block - Blockly block SVG instance
     */
    static flash (block) {
        const getSvgPath = b => {
            if (!b) return null;
            if (b.pathObject && b.pathObject.svgPath) return b.pathObject.svgPath;
            return b.svgPath_;
        };

        if (myFlash.timerID > 0) {
            clearTimeout(myFlash.timerID);
            if (getSvgPath(myFlash.block)) {
                getSvgPath(myFlash.block).style.fill = '';
            }
        }

        let count = 6;
        let flashOn = true;
        myFlash.block = block;

        const _flash = () => {
            const svgPath = getSvgPath(myFlash.block);
            if (svgPath) {
                svgPath.style.fill = flashOn ? '#ffff80' : '';
            }
            flashOn = !flashOn;
            count--;
            if (count > 0) {
                myFlash.timerID = setTimeout(_flash, 150);
            } else {
                myFlash.timerID = 0;
                myFlash.block = null;
            }
        };

        _flash();
    }
}

export default BlockFlasher;
