/*
 * cloud-project-service is mocked because it pulls in supabase.js, which builds a client
 * at import time and throws without configured credentials.
 */
jest.mock('../../../src/lib/cloud-project-service', () => ({
    loadProject: jest.fn(() => Promise.resolve(new ArrayBuffer(8)))
}));

import {loadProject} from '../../../src/lib/cloud-project-service';
import {
    SELECT_ACTIONS,
    TUTORIAL_STARTER_PREFIX,
    getStarterLoadTransition,
    getTutorialSelectAction,
    getTutorialStarterPath,
    loadTutorialStarter
} from '../../../src/lib/tutorial-starters';
import {LoadingState, onLoadedProject} from '../../../src/reducers/project-state';
import decks from '../../../src/lib/libraries/decks/index.jsx';

// These ids come from `requiredProjectId` in src/lib/libraries/decks/index.jsx and are the
// filenames scripts/fetch-tutorial-starters.js writes. If this changes, the files already
// uploaded to storage stop being found.
const CODE_A_CARTOON = '331474033';
const ANIMATE_AN_ADVENTURE_GAME = '249143200';

beforeEach(() => {
    loadProject.mockClear();
});

test('starter paths match what the packaging script uploads', () => {
    expect(TUTORIAL_STARTER_PREFIX).toBe('tutorials');
    expect(getTutorialStarterPath(CODE_A_CARTOON)).toBe('tutorials/331474033.sb3');
    expect(getTutorialStarterPath(ANIMATE_AN_ADVENTURE_GAME)).toBe('tutorials/249143200.sb3');
});

test('loadTutorialStarter fetches the starter from the project bucket', () => {
    loadTutorialStarter(CODE_A_CARTOON);
    expect(loadProject).toHaveBeenCalledWith('tutorials/331474033.sb3');
});

test('loadTutorialStarter resolves with the project data', () =>
    loadTutorialStarter(ANIMATE_AN_ADVENTURE_GAME).then(data => {
        expect(data).toBeInstanceOf(ArrayBuffer);
    })
);

describe('getStarterLoadTransition', () => {
    // Regression: the starter load used to dispatch openLoadingProject() only, which opens
    // the loading screen without moving the project state machine. onLoadedProject then
    // returned undefined, dispatch(undefined) threw "Cannot read properties of undefined
    // (reading 'type')", and the editor was left stuck on "Loading Project" forever.
    test('finishes from a state that onLoadedProject actually accepts', () => {
        const transition = getStarterLoadTransition(LoadingState.SHOWING_WITH_ID);
        expect(transition).not.toBeNull();
        expect(onLoadedProject(transition.finishState, false, true)).toBeDefined();
        expect(onLoadedProject(transition.finishState, false, false)).toBeDefined();
    });

    test('the state the editor is already in would NOT be accepted', () => {
        // This is the trap: SHOWING_WITH_ID is a perfectly normal loadingState, and handing
        // it to onLoadedProject silently yields undefined rather than erroring.
        expect(onLoadedProject(LoadingState.SHOWING_WITH_ID, false, true)).toBeUndefined();
    });

    test('starts from any settled state', () => {
        for (const state of [
            LoadingState.NOT_LOADED,
            LoadingState.SHOWING_WITH_ID,
            LoadingState.SHOWING_WITHOUT_ID
        ]) {
            const transition = getStarterLoadTransition(state);
            expect(transition).not.toBeNull();
            expect(transition.startAction).toHaveProperty('type');
        }
    });

    test('refuses to start while the editor is already loading something', () => {
        for (const state of [
            LoadingState.LOADING_VM_FILE_UPLOAD,
            LoadingState.FETCHING_WITH_ID,
            LoadingState.LOADING_VM_WITH_ID,
            LoadingState.ERROR
        ]) {
            expect(getStarterLoadTransition(state)).toBeNull();
        }
    });
});

describe('getTutorialSelectAction', () => {
    const starterItem = {id: 'code-cartoon', requiredProjectId: '331474033'};
    const plainItem = {id: 'animate-a-name'};

    // Regression: closing a tutorial card only hides it, but re-picking the tutorial tried
    // to reload the starter. That prompted "replace contents of the current project?", and
    // declining returned without opening anything - so the card could never be got back.
    test('re-picking the open starter tutorial just shows the card again', () => {
        expect(getTutorialSelectAction(starterItem, {
            activeDeckId: 'code-cartoon',
            projectId: null
        })).toBe(SELECT_ACTIONS.VIEW);
    });

    test('picking a different starter tutorial still loads its starter', () => {
        expect(getTutorialSelectAction(starterItem, {
            activeDeckId: 'cartoon-network',
            projectId: null,
            projectChanged: false,
            projectTitle: ''
        })).toBe(SELECT_ACTIONS.LOAD_STARTER);
    });

    test('picking a starter tutorial in a clean editor loads the starter without asking', () => {
        expect(getTutorialSelectAction(starterItem, {
            activeDeckId: null,
            projectId: null,
            projectChanged: false,
            projectTitle: ''
        })).toBe(SELECT_ACTIONS.LOAD_STARTER);
    });

    /*
     * Regression: opening a saved project in this fork calls vm.loadProject directly, so it
     * leaves projectId unset and projectChanged false. Re-picking the tutorial therefore
     * looked like a safe load and silently replaced the project the student had just
     * opened. The saved title is the signal that something real is open.
     */
    test('asks before replacing a saved project that was just opened', () => {
        expect(getTutorialSelectAction(starterItem, {
            activeDeckId: null,
            projectId: null,
            projectChanged: false,
            projectTitle: 'My Cartoon'
        })).toBe(SELECT_ACTIONS.ASK);
    });

    test('asks before replacing unsaved work', () => {
        expect(getTutorialSelectAction(starterItem, {
            activeDeckId: null,
            projectId: null,
            projectChanged: true,
            projectTitle: ''
        })).toBe(SELECT_ACTIONS.ASK);
    });

    test('skips the load when the starter is already the open project', () => {
        expect(getTutorialSelectAction(starterItem, {
            activeDeckId: null,
            projectId: '331474033'
        })).toBe(SELECT_ACTIONS.ACTIVATE);
    });

    test('ordinary tutorials always just activate, even when already open', () => {
        expect(getTutorialSelectAction(plainItem, {activeDeckId: null, projectId: null}))
            .toBe(SELECT_ACTIONS.ACTIVATE);
        // Re-picking a normal tutorial restarts it at step 1, as it always has.
        expect(getTutorialSelectAction(plainItem, {activeDeckId: 'animate-a-name', projectId: null}))
            .toBe(SELECT_ACTIONS.ACTIVATE);
    });

    test('a reopened tutorial card wins over the replace prompt', () => {
        // The student closed the card and wants it back; nothing should be replaced.
        expect(getTutorialSelectAction(starterItem, {
            activeDeckId: 'code-cartoon',
            projectId: null,
            projectChanged: true,
            projectTitle: 'My Cartoon'
        })).toBe(SELECT_ACTIONS.VIEW);
    });

    test('tolerates missing state', () => {
        expect(getTutorialSelectAction(plainItem)).toBe(SELECT_ACTIONS.ACTIVATE);
        expect(getTutorialSelectAction(starterItem)).toBe(SELECT_ACTIONS.LOAD_STARTER);
    });
});

test('the deck library declares exactly the starters we package and gate on login', () => {
    // scripts/fetch-tutorial-starters.js packages this list, and tips-library hides these
    // decks from signed-out students. A third one appearing here needs both updated.
    const withStarters = Object.keys(decks)
        .filter(id => decks[id].requiredProjectId)
        .map(id => [id, decks[id].requiredProjectId])
        .sort();
    expect(withStarters).toEqual([
        ['cartoon-network', ANIMATE_AN_ADVENTURE_GAME],
        ['code-cartoon', CODE_A_CARTOON]
    ]);
});
