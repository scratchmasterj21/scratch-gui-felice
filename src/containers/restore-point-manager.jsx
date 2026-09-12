import bindAll from 'lodash.bindall';
import PropTypes from 'prop-types';
import React from 'react';
import {connect} from 'react-redux';
import {injectIntl, intlShape, defineMessages} from 'react-intl';
import VM from 'scratch-vm';

import RestorePointModal from '../components/restore-point-modal/restore-point-modal.jsx';
import {confirmDestructiveAction} from '../lib/confirm-dialog';
import log from '../lib/log';
import {
    TYPE_AUTOMATIC,
    TYPE_MANUAL,
    createRestorePoint,
    deleteAllRestorePoints,
    deleteRestorePoint,
    getRestorePoints,
    isSupported,
    loadRestorePoint,
    pruneRestorePoints
} from '../lib/restore-points';
import {closeRestorePoints} from '../reducers/modals';
import {setProjectTitle} from '../reducers/project-title';

// Matches TurboWarp's default. Long enough that saving is not intrusive, short enough that
// a crash costs a few minutes rather than a lesson.
const SAVE_INTERVAL = 1000 * 60 * 5;

const messages = defineMessages({
    saveError: {
        defaultMessage: 'Could not save a restore point.',
        description: 'Error shown when a project snapshot fails to save',
        id: 'gui.restorePoints.saveError'
    },
    loadError: {
        defaultMessage: 'Could not open that restore point.',
        description: 'Error shown when a project snapshot fails to load',
        id: 'gui.restorePoints.loadError'
    },
    listError: {
        defaultMessage: 'Could not read restore points on this computer.',
        description: 'Error shown when restore point storage cannot be read',
        id: 'gui.restorePoints.listError'
    },
    confirmRestoreTitle: {
        defaultMessage: 'Open this restore point?',
        description: 'Title asked before replacing the current project with a restore point',
        id: 'gui.restorePoints.confirmRestoreTitle'
    },
    confirmRestoreText: {
        defaultMessage: 'What you have open now will be replaced.',
        description: 'Body asked before replacing the current project with a restore point',
        id: 'gui.restorePoints.confirmRestoreText'
    },
    confirmRestoreButton: {
        defaultMessage: 'Yes, open it!',
        description: 'Confirm button for opening a restore point',
        id: 'gui.restorePoints.confirmRestoreButton'
    },
    confirmDeleteAllTitle: {
        defaultMessage: 'Delete all restore points?',
        description: 'Title asked before deleting every restore point',
        id: 'gui.restorePoints.confirmDeleteAllTitle'
    },
    confirmDeleteAllText: {
        defaultMessage: 'This cannot be undone.',
        description: 'Body asked before deleting every restore point',
        id: 'gui.restorePoints.confirmDeleteAllText'
    },
    confirmDeleteAllButton: {
        defaultMessage: 'Yes, delete them!',
        description: 'Confirm button for deleting every restore point',
        id: 'gui.restorePoints.confirmDeleteAllButton'
    }
});

class RestorePointManager extends React.Component {
    constructor (props) {
        super(props);
        this.state = {
            restorePoints: [],
            busy: false,
            error: null
        };
        this.timeout = null;
        this.mounted = false;
        bindAll(this, [
            'handleProjectChanged',
            'handleClose',
            'handleCreate',
            'handleDelete',
            'handleDeleteAll',
            'handleRestore',
            'saveAutomaticRestorePoint'
        ]);
    }
    componentDidMount () {
        this.mounted = true;
        if (isSupported()) {
            this.props.vm.on('PROJECT_CHANGED', this.handleProjectChanged);
        }
    }
    componentDidUpdate (prevProps) {
        if (this.props.visible && !prevProps.visible) {
            this.refresh();
        }
    }
    componentWillUnmount () {
        this.mounted = false;
        this.cancelQueuedSave();
        this.props.vm.off('PROJECT_CHANGED', this.handleProjectChanged);
    }
    /*
        Saves are driven by edits, not by a bare timer. The first change after a quiet spell
        starts the countdown; while one is pending, further changes are ignored. A project
        nobody is touching therefore writes nothing, instead of filling the student's disk
        with identical snapshots.
    */
    handleProjectChanged () {
        if (this.timeout) return;
        this.timeout = setTimeout(this.saveAutomaticRestorePoint, SAVE_INTERVAL);
    }
    cancelQueuedSave () {
        if (this.timeout) {
            clearTimeout(this.timeout);
            this.timeout = null;
        }
    }
    saveAutomaticRestorePoint () {
        this.timeout = null;
        return this.save(TYPE_AUTOMATIC).catch(error => {
            // An automatic save is best effort; never interrupt a student mid-thought.
            log.warn('Could not save automatic restore point', error);
        });
    }
    save (type) {
        return createRestorePoint(this.props.vm, {
            userId: this.props.userId,
            title: this.props.projectTitle,
            type: type
        }).then(() => pruneRestorePoints(this.props.userId));
    }
    refresh () {
        return getRestorePoints(this.props.userId)
            .then(restorePoints => {
                if (this.mounted) this.setState({restorePoints, error: null});
            })
            .catch(error => {
                log.warn(error);
                if (this.mounted) {
                    this.setState({error: this.props.intl.formatMessage(messages.listError)});
                }
            });
    }
    runTask (task, errorMessage) {
        this.setState({busy: true, error: null});
        return task()
            .then(() => this.refresh())
            .catch(error => {
                log.warn(error);
                if (this.mounted) {
                    this.setState({error: this.props.intl.formatMessage(errorMessage)});
                }
            })
            .then(() => {
                if (this.mounted) this.setState({busy: false});
            });
    }
    handleClose () {
        this.props.onClose();
    }
    handleCreate () {
        // A manual save also resets the countdown: an automatic one moments later would
        // only duplicate what the student just asked for.
        this.cancelQueuedSave();
        return this.runTask(() => this.save(TYPE_MANUAL), messages.saveError);
    }
    handleDelete (id) {
        return this.runTask(() => deleteRestorePoint(id), messages.listError);
    }
    handleDeleteAll () {
        return confirmDestructiveAction({
            title: this.props.intl.formatMessage(messages.confirmDeleteAllTitle),
            text: this.props.intl.formatMessage(messages.confirmDeleteAllText),
            confirmButtonText: this.props.intl.formatMessage(messages.confirmDeleteAllButton)
        }).then(confirmed => {
            if (!confirmed) return null;
            return this.runTask(() => deleteAllRestorePoints(this.props.userId), messages.listError);
        });
    }
    handleRestore (id) {
        return confirmDestructiveAction({
            title: this.props.intl.formatMessage(messages.confirmRestoreTitle),
            text: this.props.intl.formatMessage(messages.confirmRestoreText),
            confirmButtonText: this.props.intl.formatMessage(messages.confirmRestoreButton)
        }).then(confirmed => {
            if (confirmed) return this.doRestore(id);
            return null;
        });
    }
    doRestore (id) {
        const point = this.state.restorePoints.find(candidate => candidate.id === id);
        this.setState({busy: true, error: null});
        return loadRestorePoint(this.props.vm, id)
            .then(() => {
                if (point && point.title) this.props.onSetProjectTitle(point.title);
                // Restoring counts as opening a project, so nothing should be queued from
                // the edits that led up to it.
                this.cancelQueuedSave();
                this.props.onClose();
            })
            .catch(error => {
                log.warn(error);
                if (this.mounted) {
                    this.setState({error: this.props.intl.formatMessage(messages.loadError)});
                }
            })
            .then(() => {
                if (this.mounted) this.setState({busy: false});
            });
    }
    render () {
        if (!this.props.visible) return null;
        return (
            <RestorePointModal
                busy={this.state.busy}
                error={this.state.error}
                restorePoints={this.state.restorePoints}
                onClose={this.handleClose}
                onCreate={this.handleCreate}
                onDelete={this.handleDelete}
                onDeleteAll={this.handleDeleteAll}
                onRestore={this.handleRestore}
            />
        );
    }
}

RestorePointManager.propTypes = {
    intl: intlShape.isRequired,
    onClose: PropTypes.func.isRequired,
    onSetProjectTitle: PropTypes.func.isRequired,
    projectTitle: PropTypes.string,
    userId: PropTypes.string,
    visible: PropTypes.bool,
    vm: PropTypes.instanceOf(VM).isRequired
};

const mapStateToProps = state => ({
    projectTitle: state.scratchGui.projectTitle,
    // Classroom machines are shared, so restore points are scoped to whoever is signed in.
    userId: (state.scratchGui.auth && state.scratchGui.auth.user) ?
        state.scratchGui.auth.user.id : null,
    visible: state.scratchGui.modals.restorePoints,
    vm: state.scratchGui.vm
});

const mapDispatchToProps = dispatch => ({
    onClose: () => dispatch(closeRestorePoints()),
    onSetProjectTitle: title => dispatch(setProjectTitle(title))
});

export default injectIntl(connect(
    mapStateToProps,
    mapDispatchToProps
)(RestorePointManager));
