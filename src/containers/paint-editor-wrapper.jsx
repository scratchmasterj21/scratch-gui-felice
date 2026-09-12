import PropTypes from 'prop-types';
import React from 'react';
import bindAll from 'lodash.bindall';
import VM from 'scratch-vm';
import PaintEditor from 'scratch-paint';
import {inlineSvgFonts} from 'scratch-svg-renderer';

import {connect} from 'react-redux';

import OnionSkinToggle from '../components/onion-skin-toggle/onion-skin-toggle.jsx';
import {getOnionFrames} from '../lib/onion-skin-frames';
import {
    COSTUME_IMPORT_DELAY,
    PROJECT_RESTORE_DELAY,
    getOnionRebuildDelay,
    onionControlsChanged
} from '../lib/onion-skin-update';
import {setOnionSkinEnabled, setOnionSkinSettings} from '../reducers/onion-skin';
import {
    clearOnionLayers,
    getPaperCenter,
    insertOnionLayer,
    onOnionInvalidated,
    patchPaperExports,
    prepareOnionItem
} from '../lib/onion-skin';

import styles from './paint-editor-wrapper.css';

class PaintEditorWrapper extends React.Component {
    constructor (props) {
        super(props);
        // Bumped whenever pending onion work becomes irrelevant. Async callbacks compare
        // against it and drop out, so a costume switch or an unmount cannot leave a
        // stale layer behind.
        this._onionGeneration = 0;
        this._onionTimeout = null;
        this._unsubscribeInvalidated = null;
        this._mounted = false;
        bindAll(this, [
            'handleUpdateImage',
            'handleUpdateName',
            'handleOnionInvalidated',
            'handleToggleOnionSkin',
            'handleChangePreviousFrames',
            'handleChangeNextFrames',
            'handleChangeTinted',
            'handleChangeLoop',
            'updateOnionLayers'
        ]);
    }
    componentDidMount () {
        this._mounted = true;
        // Idempotent, and flagged on paper's prototype rather than on this component, so
        // reopening the costume tab cannot stack wrappers.
        patchPaperExports();
        this._unsubscribeInvalidated = onOnionInvalidated(this.handleOnionInvalidated);
        if (this.props.onionFrames.length) {
            this.scheduleOnionUpdate(COSTUME_IMPORT_DELAY);
        }
    }
    shouldComponentUpdate (nextProps) {
        return this.props.imageId !== nextProps.imageId ||
            this.props.rtl !== nextProps.rtl ||
            this.props.name !== nextProps.name ||
            this.props.onionSignature !== nextProps.onionSignature ||
            // Toggling Loop in the middle of the costume list, or changing Before/After at
            // either end, leaves the drawn frames identical. Without this the control
            // itself never repaints and the click looks like it did nothing.
            onionControlsChanged(this.props, nextProps);
    }
    componentDidUpdate (prevProps) {
        const delay = getOnionRebuildDelay(prevProps, this.props);
        if (delay !== null) this.scheduleOnionUpdate(delay);
    }
    componentWillUnmount () {
        this._mounted = false;
        this.cancelPendingOnionWork();
        if (this._unsubscribeInvalidated) {
            this._unsubscribeInvalidated();
            this._unsubscribeInvalidated = null;
        }
        // Sweeps by data flag, so anything orphaned by a race goes too.
        clearOnionLayers();
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
    handleOnionInvalidated () {
        if (this.props.onionFrames.length) {
            this.scheduleOnionUpdate(PROJECT_RESTORE_DELAY);
        }
    }
    handleToggleOnionSkin () {
        this.props.onSetOnionSkinEnabled(!this.props.onionEnabled);
    }
    handleChangePreviousFrames (event) {
        this.props.onSetOnionSkinSettings({previous: Number(event.target.value)});
    }
    handleChangeNextFrames (event) {
        this.props.onSetOnionSkinSettings({next: Number(event.target.value)});
    }
    handleChangeTinted (event) {
        this.props.onSetOnionSkinSettings({tinted: event.target.checked});
    }
    handleChangeLoop (event) {
        this.props.onSetOnionSkinSettings({loop: event.target.checked});
    }
    cancelPendingOnionWork () {
        this._onionGeneration++;
        if (this._onionTimeout) {
            clearTimeout(this._onionTimeout);
            this._onionTimeout = null;
        }
    }
    scheduleOnionUpdate (delay) {
        this.cancelPendingOnionWork();
        // Drop the old frames now rather than after the delay, so a toggle responds at once
        // instead of holding a stale ghost until the rebuild lands.
        clearOnionLayers();
        this._onionTimeout = setTimeout(this.updateOnionLayers, delay);
    }
    updateOnionLayers () {
        this._onionTimeout = null;
        clearOnionLayers();

        if (!this._mounted || !this.props.onionFrames.length) return;

        const paperCenter = getPaperCenter();
        if (!paperCenter) return;

        const sprite = this.props.vm.editingTarget && this.props.vm.editingTarget.sprite;
        if (!sprite) return;

        const generation = this._onionGeneration;

        for (const frame of this.props.onionFrames) {
            const costume = sprite.costumes[frame.index];
            if (!costume) continue;
            const asset = this.props.vm.getCostume(frame.index);
            if (!asset) continue;

            prepareOnionItem({asset, costume, paperCenter, tint: frame.tint}, item => {
                if (!item) return;
                if (!this._mounted || generation !== this._onionGeneration) {
                    // The costume changed, or the editor closed, while this was loading.
                    item.remove();
                    return;
                }
                insertOnionLayer(item, paperCenter, frame.opacity);
            });
        }
    }
    render () {
        if (!this.props.imageId) return null;
        const {
            onionEnabled,
            onionFrames, // eslint-disable-line no-unused-vars
            onionLoop,
            onionNext,
            onionPrevious,
            onionSignature, // eslint-disable-line no-unused-vars
            onionTinted,
            onSetOnionSkinEnabled, // eslint-disable-line no-unused-vars
            onSetOnionSkinSettings, // eslint-disable-line no-unused-vars
            selectedCostumeIndex,
            vm,
            ...componentProps
        } = this.props;

        return (
            <div className={styles.paintEditorWrapper}>
                <OnionSkinToggle
                    enabled={onionEnabled}
                    loop={onionLoop}
                    next={onionNext}
                    previous={onionPrevious}
                    tinted={onionTinted}
                    onChangeLoop={this.handleChangeLoop}
                    onChangeNext={this.handleChangeNextFrames}
                    onChangePrevious={this.handleChangePreviousFrames}
                    onChangeTinted={this.handleChangeTinted}
                    onToggle={this.handleToggleOnionSkin}
                />
                <div className={styles.paintEditorCanvas}>
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
    onSetOnionSkinEnabled: PropTypes.func.isRequired,
    onSetOnionSkinSettings: PropTypes.func.isRequired,
    onionEnabled: PropTypes.bool,
    onionFrames: PropTypes.arrayOf(PropTypes.object).isRequired,
    onionLoop: PropTypes.bool,
    onionNext: PropTypes.number.isRequired,
    onionPrevious: PropTypes.number.isRequired,
    onionSignature: PropTypes.string,
    onionTinted: PropTypes.bool,
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

    const onionSkin = state.scratchGui.onionSkin;
    const onionFrames = onionSkin.enabled ?
        getOnionFrames(index, sprite.costumes.length, onionSkin) : [];
    // A complete description of what should be on screen. assetId is in there so editing a
    // neighbouring costume redraws its onion frame.
    const onionSignature = onionFrames.map(frame => {
        const frameCostume = sprite.costumes[frame.index];
        return [
            frame.index,
            frameCostume && frameCostume.assetId,
            frame.opacity.toFixed(3),
            frame.tint
        ].join(':');
    }).join(',');

    return {
        name: costume && costume.name,
        onionEnabled: onionSkin.enabled,
        onionFrames: onionFrames,
        onionLoop: onionSkin.loop,
        onionNext: onionSkin.next,
        onionPrevious: onionSkin.previous,
        onionSignature: onionSignature,
        onionTinted: onionSkin.tinted,
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

const mapDispatchToProps = dispatch => ({
    onSetOnionSkinEnabled: enabled => dispatch(setOnionSkinEnabled(enabled)),
    onSetOnionSkinSettings: settings => dispatch(setOnionSkinSettings(settings))
});

export default connect(
    mapStateToProps,
    mapDispatchToProps
)(PaintEditorWrapper);
