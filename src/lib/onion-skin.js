import paper from '@scratch/paper';

import {
    installOnionExportGuards,
    onOnionInvalidated,
    removeOnionLayers,
    ONION_LAYER_KEY
} from './onion-skin-layers';
import {BASE_OPACITY} from './onion-skin-frames';

/**
 * Install the export guards on the shared paper scope. Idempotent.
 * @returns {boolean} true if this call installed them
 */
const patchPaperExports = () => installOnionExportGuards(paper);

/**
 * Remove every onion layer from the current project.
 * @returns {number} how many were removed
 */
const clearOnionLayers = () => removeOnionLayers(paper.project);

// Mirrors scratch-paint's math helpers. Reimplemented rather than deep-imported because
// scratch-paint ships a prebuilt dist, so its `src/helper` modules are only reachable
// through a bundler-specific path.
const doRecursively = (item, fn) => {
    if (item instanceof paper.Group) {
        for (const child of item.children) {
            doRecursively(child, fn);
        }
    } else {
        fn(item);
    }
};

const ensureClockwise = root => {
    doRecursively(root, item => {
        // paper reports `className` as 'Path' or 'CompoundPath'; 'PathItem' is the abstract
        // base and never appears on an instance, so this has to be an instanceof check.
        if (item instanceof paper.PathItem) {
            item.clockwise = true;
        }
    });
};

const scaleWithStrokes = (root, factor, pivot) => {
    doRecursively(root, item => {
        // Text outline size is controlled by the text transform matrix, so it is already scaled.
        if (item instanceof paper.PointText) return;
        if (item.strokeWidth) {
            item.strokeWidth = item.strokeWidth * factor;
        }
    });
    root.scale(factor, pivot);
};

const markAsGuide = item => {
    item.locked = true;
    item.guide = true;
    if (item.children) {
        for (const child of item.children) {
            markAsGuide(child);
        }
    }
};

// Flatten the artwork to a single colour so past and future frames can be told apart at a
// glance. Recoloring the items directly keeps this predictable; paper's blend modes render
// the whole group through an offscreen canvas, which is more machinery than this needs.
const tintItem = (root, color) => {
    doRecursively(root, item => {
        if (item.fillColor) item.fillColor = color;
        if (item.strokeColor) item.strokeColor = color;
    });
};

const tintImage = (image, color) => {
    if (!image.width || !image.height) return image;
    const canvas = document.createElement('canvas');
    canvas.width = image.width;
    canvas.height = image.height;
    const context = canvas.getContext('2d');
    if (!context) return image;
    context.drawImage(image, 0, 0);
    // Paint the colour only where the costume already has pixels, keeping its silhouette.
    context.globalCompositeOperation = 'source-in';
    context.fillStyle = color;
    context.fillRect(0, 0, canvas.width, canvas.height);
    return canvas;
};

// Same pre-processing scratch-paint applies before importing a costume. Without it paper
// fails to parse a class of costumes and returns null, which used to show up as the onion
// skin silently never appearing.
const preprocessSvg = svgString => {
    let svg = svgString;
    // 1. Remove svg: namespace on elements.
    svg = svg.split(/<\s*svg:/).join('<');
    svg = svg.split(/<\/\s*svg:/).join('</');
    // 2. Add root svg namespace if it does not exist.
    const svgAttrs = svg.match(/<svg [^>]*>/);
    if (svgAttrs && svgAttrs[0].indexOf('xmlns=') === -1) {
        svg = svg.replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" ');
    }
    return svg;
};

const parseViewBox = svgString => {
    const svgDom = new DOMParser().parseFromString(svgString, 'text/xml');
    const attr = svgDom.documentElement && svgDom.documentElement.attributes.viewBox;
    if (!attr) return null;
    const parts = attr.value.match(/\S+/g);
    return parts ? parts.map(parseFloat) : null;
};

const collectUnloadedRasters = (item, out) => {
    if (item instanceof paper.Raster && !item.loaded) {
        out.push(item);
    }
    if (item.children) {
        for (const child of item.children) {
            collectUnloadedRasters(child, out);
        }
    }
    return out;
};

// Builds a detached paper item for a vector costume, transformed into art board space the
// same way scratch-paint transforms the costume being edited.
const prepareVectorOnion = (svgString, costume, paperCenter, tint, onReady) => {
    if (!paper.project) {
        onReady(null);
        return;
    }
    const svg = preprocessSvg(svgString);
    const viewBox = parseViewBox(svg);
    const {rotationCenterX, rotationCenterY} = costume;

    const place = root => {
        // Captured before scaling: scratch-paint's fallback centering uses the unscaled size.
        const itemWidth = root.bounds.width;
        const itemHeight = root.bounds.height;

        markAsGuide(root);
        ensureClockwise(root);
        scaleWithStrokes(root, 2, new paper.Point()); // Costumes are imported at 2x
        if (tint) tintItem(root, tint);

        if (typeof rotationCenterX === 'undefined' || typeof rotationCenterY === 'undefined') {
            root.translate(paperCenter.subtract(itemWidth, itemHeight));
        } else {
            let rotationPoint = new paper.Point(rotationCenterX, rotationCenterY);
            if (viewBox && viewBox.length >= 2 && !isNaN(viewBox[0]) && !isNaN(viewBox[1])) {
                rotationPoint = rotationPoint.subtract(viewBox[0], viewBox[1]);
            }
            root.translate(paperCenter.subtract(rotationPoint.multiply(2)));
        }
        onReady(root);
    };

    paper.project.importSVG(svg, {
        expandShapes: true,
        insert: false,
        onError: () => onReady(null),
        onLoad: root => {
            if (!root) {
                onReady(null);
                return;
            }
            // A costume that wraps a bitmap imports rasters that are still loading. Their
            // bounds are wrong until they finish, so positioning has to wait for them.
            const pending = collectUnloadedRasters(root, []);
            if (pending.length === 0) {
                place(root);
                return;
            }
            let remaining = pending.length;
            const onRasterSettled = () => {
                remaining--;
                if (remaining === 0) place(root);
            };
            for (const raster of pending) {
                raster.onLoad = onRasterSettled;
                raster.onError = onRasterSettled;
            }
        }
    });
};

// Builds a detached paper raster for a bitmap costume, positioned in art board space.
const prepareRasterOnion = (dataURI, costume, paperCenter, tint, onReady) => {
    const image = new Image();
    image.onerror = () => onReady(null);
    image.onload = () => {
        if (!paper.project) {
            onReady(null);
            return;
        }
        let {rotationCenterX, rotationCenterY} = costume;
        if (typeof rotationCenterX === 'undefined') {
            rotationCenterX = image.width / 2;
        }
        if (typeof rotationCenterY === 'undefined') {
            rotationCenterY = image.height / 2;
        }

        const raster = new paper.Raster(tint ? tintImage(image, tint) : image);
        raster.remove(); // Constructed into the active layer; the caller decides where it goes
        raster.guide = true;
        raster.locked = true;
        // paper positions a raster by its center, where scratch-paint draws from the top left.
        raster.position = new paper.Point(
            (image.width / 2) + (paperCenter.x - rotationCenterX),
            (image.height / 2) + (paperCenter.y - rotationCenterY)
        );
        onReady(raster);
    };
    image.src = dataURI;
};

/**
 * Build the paper item for one onion frame.
 * @param {object} frame {asset, costume, paperCenter, tint}
 * @param {Function} onReady Called with the item, or null if it could not be built
 */
const prepareOnionItem = (frame, onReady) => {
    const {asset, costume, paperCenter, tint} = frame;
    if (costume.dataFormat === 'svg') {
        prepareVectorOnion(asset, costume, paperCenter, tint, onReady);
    } else {
        prepareRasterOnion(asset, costume, paperCenter, tint, onReady);
    }
};

/**
 * Put a prepared item into a fresh onion layer behind the artwork.
 * @param {object} item The item from prepareOnionItem
 * @param {object} paperCenter Center of the art board, as a paper.Point
 * @param {number} [opacity] Layer opacity
 * @returns {object} the new layer, or null
 */
const insertOnionLayer = (item, paperCenter, opacity = BASE_OPACITY) => {
    const project = paper.project;
    if (!project || !item) return null;

    // Creating a layer activates it, so remember where drawing should go back to.
    const originalActiveLayer = project.activeLayer;

    const layer = new paper.Layer();
    layer.locked = true;
    layer.guide = true;
    layer.opacity = opacity;
    layer.data[ONION_LAYER_KEY] = true;

    // Clip to the same bounds scratch-paint clips the artwork to, so an oversized costume
    // does not bleed past the workspace.
    const clip = new paper.Shape.Rectangle(new paper.Rectangle(
        -paperCenter.x / 2,
        -paperCenter.y / 2,
        paperCenter.x * 3,
        paperCenter.y * 3
    ));
    clip.remove();
    clip.guide = true;
    clip.locked = true;
    layer.addChild(clip);
    layer.addChild(item);
    clip.clipMask = true;

    const backgroundGuideLayer = project.layers.find(l => l.data && l.data.isBackgroundGuideLayer);
    if (backgroundGuideLayer) {
        layer.insertAbove(backgroundGuideLayer);
    } else {
        layer.sendToBack();
    }

    if (originalActiveLayer) originalActiveLayer.activate();
    return layer;
};

/**
 * The center of the art board, read off the background guide layer.
 * @returns {object} a paper.Point, or null if the paint editor is not set up yet
 */
const getPaperCenter = () => {
    if (!paper.project) return null;
    const backgroundGuideLayer = paper.project.layers.find(l => l.data && l.data.isBackgroundGuideLayer);
    if (!backgroundGuideLayer || !backgroundGuideLayer.children.length) return null;
    // Cloned because paper returns a point linked to the item, and this value is held
    // across async work that a format conversion could invalidate.
    return backgroundGuideLayer.children[0].position.clone();
};

export {
    clearOnionLayers,
    getPaperCenter,
    insertOnionLayer,
    onOnionInvalidated,
    patchPaperExports,
    prepareOnionItem
};
