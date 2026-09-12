import bindAll from 'lodash.bindall';
import PropTypes from 'prop-types';
import React from 'react';
import {injectIntl, intlShape, defineMessages} from 'react-intl';

import decksLibraryContent from '../lib/libraries/decks/index.jsx';
import tutorialTags from '../lib/libraries/tutorial-tags';

import analytics from '../lib/analytics';
import {notScratchDesktop} from '../lib/isScratchDesktop';
import log from '../lib/log';
import {
    SELECT_ACTIONS,
    getStarterLoadTransition,
    getTutorialSelectAction,
    loadTutorialStarter
} from '../lib/tutorial-starters';

import LibraryComponent from '../components/library/library.jsx';

import {connect} from 'react-redux';

import {
    closeLoadingProject,
    closeTipsLibrary,
    openLoadingProject
} from '../reducers/modals';

import {
    activateDeck,
    viewCards
} from '../reducers/cards';

import {
    LoadingStates,
    onLoadedProject
} from '../reducers/project-state';


const messages = defineMessages({
    tipsLibraryTitle: {
        defaultMessage: 'Choose a Tutorial',
        description: 'Heading for the help/tutorials library',
        id: 'gui.tipsLibrary.tutorials'
    },
    starterReplaceConfirm: {
        defaultMessage: 'Start this tutorial with a fresh starter project? This replaces what you have open. ' +
            'Choose Cancel to keep your project and just show the tutorial steps.',
        description: 'Asked when opening a tutorial that comes with a starter project, while work is already open',
        id: 'gui.tipsLibrary.starterReplaceConfirm'
    },
    starterLoadError: {
        defaultMessage: 'This tutorial\'s starter project could not be loaded. Please try again.',
        description: 'Error shown when a tutorial that needs a starter project cannot fetch it',
        id: 'gui.tipsLibrary.starterLoadError'
    }
});

class TipsLibrary extends React.PureComponent {
    constructor (props) {
        super(props);
        bindAll(this, [
            'handleItemSelect'
        ]);
    }
    /*
        A few tutorials only make sense on top of a specific half-built project, declared as
        `requiredProjectId` on the deck. Upstream opens scratch.mit.edu in a new tab for
        these, which is a dead link anywhere else, so the starter is fetched from our own
        storage and loaded in place instead.
    */
    loadStarterAndActivate (item) {
        // Loading a starter is a file upload as far as project state is concerned, and the
        // machine only accepts that from a settled state. If the editor is already mid-load,
        // do nothing rather than dispatch an undefined action.
        const transition = getStarterLoadTransition(this.props.loadingState);
        if (!transition) return;

        this.props.onRequestClose();
        this.props.onLoadingStarted(transition.startAction);

        let loadingSuccess = false;
        return loadTutorialStarter(item.requiredProjectId)
            .then(projectData => this.props.vm.loadProject(projectData))
            .then(() => {
                loadingSuccess = true;
            })
            .catch(error => {
                log.warn(error);
                alert(this.props.intl.formatMessage(messages.starterLoadError)); // eslint-disable-line no-alert
            })
            .then(() => {
                // Always finish from the state the load was started in, never from the
                // current props: the machine has to be walked back out either way, or the
                // editor stays stuck behind the loading screen.
                this.props.onLoadingFinished(transition.finishState, loadingSuccess);
                if (loadingSuccess) {
                    this.props.onActivateDeck(item.id);
                }
            });
    }
    handleItemSelect (item) {
        analytics.event({
            category: 'library',
            action: 'Select How-to',
            label: item.id
        });

        let selectAction = getTutorialSelectAction(item, {
            activeDeckId: this.props.activeDeckId,
            projectChanged: this.props.projectChanged,
            projectId: this.props.projectId,
            projectTitle: this.props.projectTitle
        });

        if (selectAction === SELECT_ACTIONS.ASK) {
            // Cancel is the safe answer, so a student who just wants their card back keeps
            // the project they are working on.
            const replaceAllowed = confirm( // eslint-disable-line no-alert
                this.props.intl.formatMessage(messages.starterReplaceConfirm)
            );
            selectAction = replaceAllowed ? SELECT_ACTIONS.LOAD_STARTER : SELECT_ACTIONS.ACTIVATE;
        }

        if (selectAction === SELECT_ACTIONS.LOAD_STARTER) {
            return this.loadStarterAndActivate(item);
        }

        if (selectAction === SELECT_ACTIONS.VIEW) {
            this.props.onRequestClose();
            return this.props.onViewCards();
        }

        this.props.onActivateDeck(item.id);
    }
    render () {
        const decksLibraryThumbnailData = Object.keys(decksLibraryContent)
            .filter(id => {
                const deck = decksLibraryContent[id];
                /*
                    Tutorials with a `requiredProjectId` need their starter project, which
                    lives in our storage behind a signed-in session. Showing them to a
                    signed-out student would only ever produce a load error, so hide them
                    until they log in.
                */
                if (deck.requiredProjectId && !this.props.isLoggedIn) return false;
                if (notScratchDesktop()) return true; // Do not filter anything else in the online editor
                // Scratch Desktop doesn't want tutorials with `requiredProjectId`
                if (Object.prototype.hasOwnProperty.call(deck, 'requiredProjectId')) return false;
                // Scratch Desktop should not load tutorials that are _only_ videos
                if (deck.steps.filter(s => s.title).length === 0) return false;
                // Allow any other tutorials
                return true;
            })
            .map(id => ({
                rawURL: decksLibraryContent[id].img,
                id: id,
                name: decksLibraryContent[id].name,
                featured: true,
                tags: decksLibraryContent[id].tags,
                urlId: decksLibraryContent[id].urlId,
                requiredProjectId: decksLibraryContent[id].requiredProjectId,
                hidden: decksLibraryContent[id].hidden || false
            }));

        if (!this.props.visible) return null;
        return (
            <LibraryComponent
                filterable
                data={decksLibraryThumbnailData}
                id="tipsLibrary"
                tags={tutorialTags}
                title={this.props.intl.formatMessage(messages.tipsLibraryTitle)}
                visible={this.props.visible}
                onItemSelected={this.handleItemSelect}
                onRequestClose={this.props.onRequestClose}
            />
        );
    }
}

TipsLibrary.propTypes = {
    activeDeckId: PropTypes.string,
    intl: intlShape.isRequired,
    isLoggedIn: PropTypes.bool,
    loadingState: PropTypes.oneOf(LoadingStates),
    onActivateDeck: PropTypes.func.isRequired,
    onLoadingFinished: PropTypes.func.isRequired,
    onLoadingStarted: PropTypes.func.isRequired,
    onRequestClose: PropTypes.func.isRequired,
    onViewCards: PropTypes.func.isRequired,
    projectChanged: PropTypes.bool,
    projectId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    projectTitle: PropTypes.string,
    visible: PropTypes.bool,
    vm: PropTypes.shape({loadProject: PropTypes.func})
};

const mapStateToProps = state => ({
    activeDeckId: state.scratchGui.cards.activeDeckId,
    isLoggedIn: Boolean(state.scratchGui.auth && state.scratchGui.auth.user),
    loadingState: state.scratchGui.projectState.loadingState,
    projectChanged: state.scratchGui.projectChanged,
    visible: state.scratchGui.modals.tipsLibrary,
    projectId: state.scratchGui.projectState.projectId,
    projectTitle: state.scratchGui.projectTitle,
    vm: state.scratchGui.vm
});

const mapDispatchToProps = dispatch => ({
    onActivateDeck: id => dispatch(activateDeck(id)),
    onLoadingFinished: (loadingState, success) => {
        const action = onLoadedProject(loadingState, false, success);
        if (action) dispatch(action);
        dispatch(closeLoadingProject());
    },
    onLoadingStarted: startAction => {
        dispatch(startAction);
        dispatch(openLoadingProject());
    },
    onRequestClose: () => dispatch(closeTipsLibrary()),
    onViewCards: () => dispatch(viewCards())
});

export default injectIntl(connect(
    mapStateToProps,
    mapDispatchToProps
)(TipsLibrary));
