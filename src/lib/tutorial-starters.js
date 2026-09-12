/**
 * Starter projects for the tutorials that cannot run from an empty project.
 *
 * Two decks in src/lib/libraries/decks/index.jsx declare a `requiredProjectId`:
 * "Code a Cartoon" and "Animate an Adventure Game". Their steps refer to sprites that
 * live inside a specific half-built project rather than in the sprite library, so the
 * tutorial is meaningless without it.
 *
 * Upstream handles this by opening scratch.mit.edu/projects/<id>/editor in a new tab,
 * which only works on the Scratch website. Here the starters are hosted in Supabase
 * Storage instead, packaged by scripts/fetch-tutorial-starters.js.
 */

import {loadProject} from './cloud-project-service';
import {LoadingState, requestProjectUpload} from '../reducers/project-state';

// Storage path prefix inside the existing project bucket.
const TUTORIAL_STARTER_PREFIX = 'tutorials';

/**
 * Storage path for a tutorial's starter project.
 * @param {string} projectId The deck's requiredProjectId
 * @returns {string} path within the project bucket
 */
const getTutorialStarterPath = projectId => `${TUTORIAL_STARTER_PREFIX}/${projectId}.sb3`;

/**
 * Fetch a tutorial's starter project.
 * @param {string} projectId The deck's requiredProjectId
 * @returns {Promise<ArrayBuffer>} the .sb3 contents
 */
const loadTutorialStarter = projectId => loadProject(getTutorialStarterPath(projectId));

/**
 * Work out how to walk the project state machine while loading a starter.
 *
 * Loading a starter is a file upload as far as project state is concerned, and the machine
 * only accepts that transition from a settled state. It also refuses to finish a load
 * unless it was started: `onLoadedProject` returns undefined for any non-loading state, and
 * dispatching that throws. So the start action and the state to finish from are resolved
 * together, and a null result means "do not start".
 * @param {string} loadingState The current projectState.loadingState
 * @returns {?object} {startAction, finishState}, or null if a starter cannot be loaded now
 */
const getStarterLoadTransition = loadingState => {
    const startAction = requestProjectUpload(loadingState);
    if (!startAction) return null;
    return {
        startAction: startAction,
        finishState: LoadingState.LOADING_VM_FILE_UPLOAD
    };
};

// What picking a tutorial in the library should do.
const SELECT_ACTIONS = {
    ACTIVATE: 'activate', // open the deck normally, from step 1
    ASK: 'ask', // loading the starter would replace real work; let the student choose
    LOAD_STARTER: 'loadStarter', // fetch the starter project first
    VIEW: 'view' // bring back a card that is only hidden
};

/**
 * Decide what to do when a tutorial is picked in the library.
 *
 * Two cases matter, and both used to destroy work:
 *
 * Closing a tutorial card only hides it - the deck and the student's step are still in
 * state - so reloading the starter there would throw away their work to show a card they
 * already had.
 *
 * And opening a saved project in this fork goes straight to `vm.loadProject`, so it leaves
 * `projectState.projectId` unset and `projectChanged` false. A starter load then looks
 * perfectly safe when it is about to replace the project the student just opened, which is
 * why the title is consulted as well: it is always set when a saved project is opened.
 * @param {object} item The library item, with id and optional requiredProjectId
 * @param {object} state {activeDeckId, projectId, projectChanged, projectTitle}
 * @returns {string} one of SELECT_ACTIONS
 */
const getTutorialSelectAction = (item, state) => {
    const {activeDeckId, projectId, projectChanged, projectTitle} = state || {};
    if (!item.requiredProjectId) return SELECT_ACTIONS.ACTIVATE;
    // Already working through this one: just show the card again, at the step they reached.
    if (item.id === activeDeckId) return SELECT_ACTIONS.VIEW;
    // On scratch.mit.edu the starter is the open project already.
    if (item.requiredProjectId === projectId) return SELECT_ACTIONS.ACTIVATE;
    // Something is open that the student would not want silently replaced.
    if (projectChanged || projectTitle) return SELECT_ACTIONS.ASK;
    return SELECT_ACTIONS.LOAD_STARTER;
};

export {
    SELECT_ACTIONS,
    TUTORIAL_STARTER_PREFIX,
    getTutorialSelectAction,
    getStarterLoadTransition,
    getTutorialStarterPath,
    loadTutorialStarter
};
