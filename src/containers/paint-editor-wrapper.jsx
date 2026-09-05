import PropTypes from 'prop-types';
import React from 'react';
import bindAll from 'lodash.bindall';
import VM from 'scratch-vm';
import PaintEditor from 'scratch-paint';
import {inlineSvgFonts} from 'scratch-svg-renderer';
import paper from '@scratch/paper';

import {connect} from 'react-redux';

class PaintEditorWrapper extends React.Component {
    constructor (props) {
        super(props);
        this.state = {
            onionSkinOn: false
        };
        this._onionLayer = null;
        bindAll(this, [
            'handleUpdateImage',
            'handleUpdateName',
            'toggleOnionSkin'
        ]);
    }
    shouldComponentUpdate (nextProps, nextState) {
        return this.props.imageId !== nextProps.imageId ||
            this.props.rtl !== nextProps.rtl ||
            this.props.name !== nextProps.name ||
            this.state.onionSkinOn !== nextState.onionSkinOn;
    }
    componentDidMount () {
        // Monkey-patch Paper.js export functions to exclude our onion layer.
        // This prevents the onion skin from being baked into saved costume data.
        this._patchedExport = false;
        this._patchExportFunctions();
    }
    _patchExportFunctions () {
        if (this._patchedExport) return;
        this._patchedExport = true;
        const self = this;

        // Patch exportSVG (used when saving vector costumes)
        const originalExportSVG = paper.Project.prototype.exportSVG;
        paper.Project.prototype.exportSVG = function (...args) {
            let onionLayer = null;
            if (self._onionLayer && self._onionLayer.index !== null) {
                onionLayer = self._onionLayer;
                onionLayer.remove();
            }
            const result = originalExportSVG.call(this, ...args);
            if (onionLayer) {
                self._reinsertOnionLayer(onionLayer);
            }
            return result;
        };

        // Patch exportJSON (used for undo snapshots)
        const originalExportJSON = paper.Project.prototype.exportJSON;
        paper.Project.prototype.exportJSON = function (...args) {
            let onionLayer = null;
            if (self._onionLayer && self._onionLayer.index !== null) {
                onionLayer = self._onionLayer;
                onionLayer.remove();
            }
            const result = originalExportJSON.call(this, ...args);
            if (onionLayer) {
                self._reinsertOnionLayer(onionLayer);
            }
            return result;
        };

        // Patch importJSON (used during undo/redo) to re-add onion layers
        const originalImportJSON = paper.Project.prototype.importJSON;
        paper.Project.prototype.importJSON = function (...args) {
            const result = originalImportJSON.call(this, ...args);
            if (self.state.onionSkinOn) {
                setTimeout(() => self.updateOnionLayer(), 100);
            }
            return result;
        };
    }
    _reinsertOnionLayer (layer) {
        if (!paper.project) return;
        paper.project.addLayer(layer);
        const bgLayer = paper.project.layers.find(l => l.data && l.data.isBackgroundGuideLayer);
        if (bgLayer) {
            layer.insertAbove(bgLayer);
        }
    }
    componentDidUpdate (prevProps, prevState) {
        // Update onion layer when costume changes or toggle changes
        if (prevProps.imageId !== this.props.imageId ||
            prevState.onionSkinOn !== this.state.onionSkinOn) {
            // Small delay to let scratch-paint finish importing the current costume
            setTimeout(() => this.updateOnionLayer(), 200);
        }
    }
    componentWillUnmount () {
        this.removeOnionLayer();
    }
    handleUpdateName (name) {
        this.props.vm.renameCostume(this.props.selectedCostumeIndex, name);
    }
    handleUpdateImage (isVector, image, rotationCenterX, rotationCenterY) {
        if (isVector) {
            this.props.vm.updateSvg(
                this.props.selectedCostumeIndex,
                image,
                rotationCenterX,
                rotationCenterY);
        } else {
            this.props.vm.updateBitmap(
                this.props.selectedCostumeIndex,
                image,
                rotationCenterX,
                rotationCenterY,
                2 /* bitmapResolution */);
        }
    }
    toggleOnionSkin () {
        this.setState(state => ({onionSkinOn: !state.onionSkinOn}));
    }
    removeOnionLayer () {
        if (this._onionLayer) {
            this._onionLayer.remove();
            this._onionLayer = null;
        }
    }
    updateOnionLayer () {
        this.removeOnionLayer();

        if (!this.state.onionSkinOn) return;
        if (!paper.project) return;

        const prevIndex = this.props.selectedCostumeIndex - 1;
        if (prevIndex < 0) return;

        const sprite = this.props.vm.editingTarget && this.props.vm.editingTarget.sprite;
        if (!sprite) return;
        const prevCostume = sprite.costumes[prevIndex];
        if (!prevCostume) return;

        const asset = this.props.vm.getCostume(prevIndex);
        if (!asset) return;

        // Find paper center from the background guide layer (same as Scratch Addons)
        const bgLayer = paper.project.layers.find(l => l.data && l.data.isBackgroundGuideLayer);
        if (!bgLayer || !bgLayer.children || !bgLayer.children.length) return;
        const paperCenter = bgLayer.children[0].position;

        // Save the currently active layer so we can restore it after
        const originalActiveLayer = paper.project.activeLayer;

        if (prevCostume.dataFormat === 'svg') {
            this._makeVectorOnion(asset, prevCostume, paperCenter);
        } else {
            this._makeRasterOnion(asset, prevCostume, paperCenter);
        }

        // Restore original active layer
        if (originalActiveLayer) originalActiveLayer.activate();
    }
    _makeVectorOnion (svgString, costume, paperCenter) {
        const {rotationCenterX, rotationCenterY} = costume;

        // Parse viewBox
        const parser = new DOMParser();
        const svgDom = parser.parseFromString(svgString, 'text/xml');
        const viewBoxAttr = svgDom.documentElement.getAttribute('viewBox');
        let viewBox = null;
        if (viewBoxAttr) {
            viewBox = viewBoxAttr.split(/\s+/).map(Number);
        }

        paper.project.importSVG(svgString, {
            expandShapes: true,
            insert: false,
            onLoad: (root) => {
                if (!root || !paper.project) return;

                // Create onion layer
                const layer = new paper.Layer();
                layer.locked = true;
                layer.guide = true;
                layer.opacity = 0.3;
                layer.data.isOnionLayer = true;
                this._onionLayer = layer;

                // Apply the same transforms as scratch-paint's initializeSvg:
                // 1. Scale by 2
                const recursePaperItem = (item, cb) => {
                    if (item.children) {
                        for (const child of item.children) {
                            recursePaperItem(child, cb);
                        }
                    }
                    cb(item);
                };
                recursePaperItem(root, (i) => {
                    if (i.className === 'PathItem') {
                        i.clockwise = true;
                    }
                    if (i.className !== 'PointText' && !i.children) {
                        if (i.strokeWidth) {
                            i.strokeWidth = i.strokeWidth * 2;
                        }
                    }
                    i.locked = true;
                    i.guide = true;
                });
                root.scale(2, new paper.Point(0, 0));

                // 2. Translate using rotation center (same logic as scratch-paint)
                if (typeof rotationCenterX !== 'undefined' && typeof rotationCenterY !== 'undefined') {
                    let rotationPoint = new paper.Point(rotationCenterX, rotationCenterY);
                    if (viewBox && viewBox.length >= 2 && !isNaN(viewBox[0]) && !isNaN(viewBox[1])) {
                        rotationPoint = rotationPoint.subtract(viewBox[0], viewBox[1]);
                    }
                    root.translate(paperCenter.subtract(rotationPoint.multiply(2)));
                } else {
                    root.translate(paperCenter.subtract(root.bounds.width, root.bounds.height));
                }

                layer.addChild(root);

                // Position onion layer behind the drawing layer but above background
                const bgLayer2 = paper.project.layers.find(l => l.data && l.data.isBackgroundGuideLayer);
                if (bgLayer2) {
                    layer.insertAbove(bgLayer2);
                }
            }
        });
    }
    _makeRasterOnion (dataURI, costume, paperCenter) {
        let {rotationCenterX, rotationCenterY} = costume;

        const image = new Image();
        image.onload = () => {
            if (!paper.project) return;

            const width = Math.min(paperCenter.x * 2, image.width);
            const height = Math.min(paperCenter.y * 2, image.height);

            if (typeof rotationCenterX === 'undefined') {
                rotationCenterX = width / 2;
            }
            if (typeof rotationCenterY === 'undefined') {
                rotationCenterY = height / 2;
            }

            // Save active layer
            const originalActiveLayer = paper.project.activeLayer;

            // Create onion layer
            const layer = new paper.Layer();
            layer.locked = true;
            layer.guide = true;
            layer.opacity = 0.3;
            layer.data.isOnionLayer = true;
            this._onionLayer = layer;

            const raster = new paper.Raster(image);
            raster.guide = true;
            raster.locked = true;
            const x = width / 2 + (paperCenter.x - rotationCenterX);
            const y = height / 2 + (paperCenter.y - rotationCenterY);
            raster.position = new paper.Point(x, y);

            layer.addChild(raster);

            // Position onion layer behind drawing layer
            const bgLayer = paper.project.layers.find(l => l.data && l.data.isBackgroundGuideLayer);
            if (bgLayer) {
                layer.insertAbove(bgLayer);
            }

            // Restore active layer
            if (originalActiveLayer) originalActiveLayer.activate();
        };
        image.src = dataURI;
    }
    render () {
        if (!this.props.imageId) return null;
        const {
            selectedCostumeIndex,
            vm,
            ...componentProps
        } = this.props;

        return (
            <div style={{position: 'relative', width: '100%', height: '100%', display: 'flex', flexDirection: 'column'}}>
                <div style={{padding: '0.5rem', background: '#f9f9f9', display: 'flex', gap: '10px', alignItems: 'center'}}>
                    <label style={{display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.8rem', fontWeight: 'bold'}}>
                        <input 
                            type="checkbox" 
                            checked={this.state.onionSkinOn} 
                            onChange={this.toggleOnionSkin} 
                        />
                        Onion Skin (Previous Frame)
                    </label>
                </div>
                <div style={{position: 'relative', flexGrow: 1}}>
                    <PaintEditor
                        {...componentProps}
                        image={vm.getCostume(selectedCostumeIndex)}
                        onUpdateImage={this.handleUpdateImage}
                        onUpdateName={this.handleUpdateName}
                        fontInlineFn={inlineSvgFonts}
                    />
                </div>
            </div>
        );
    }
}

PaintEditorWrapper.propTypes = {
    imageFormat: PropTypes.string.isRequired,
    imageId: PropTypes.string.isRequired,
    name: PropTypes.string,
    rotationCenterX: PropTypes.number,
    rotationCenterY: PropTypes.number,
    rtl: PropTypes.bool,
    selectedCostumeIndex: PropTypes.number.isRequired,
    vm: PropTypes.instanceOf(VM)
};

const mapStateToProps = (state, {selectedCostumeIndex}) => {
    const targetId = state.scratchGui.vm.editingTarget.id;
    const sprite = state.scratchGui.vm.editingTarget.sprite;
    // Make sure the costume index doesn't go out of range.
    const index = selectedCostumeIndex < sprite.costumes.length ?
        selectedCostumeIndex : sprite.costumes.length - 1;
    const costume = state.scratchGui.vm.editingTarget.sprite.costumes[index];
    return {
        name: costume && costume.name,
        rotationCenterX: costume && costume.rotationCenterX,
        rotationCenterY: costume && costume.rotationCenterY,
        imageFormat: costume && costume.dataFormat,
        imageId: targetId && `${targetId}${costume.skinId}`,
        rtl: state.locales.isRtl,
        selectedCostumeIndex: index,
        vm: state.scratchGui.vm,
        zoomLevelId: targetId
    };
};

export default connect(
    mapStateToProps
)(PaintEditorWrapper);
