/*
 * The menu bar looks for a signed-in user when it mounts. Building a real Supabase client
 * needs browser globals jsdom does not provide (Headers), and this suite is about the
 * About button rather than authentication, so the client is stubbed out.
 */
jest.mock('../../../src/lib/supabase', () => ({
    getSupabase: () => ({
        auth: {
            getSession: () => Promise.resolve({data: {session: null}}),
            signOut: () => Promise.resolve({error: null})
        }
    }),
    emailToUsername: email => (email ? email.split('@')[0] : ''),
    usernameToEmail: username => `${username}@felice.local`,
    getSavedAvatar: () => 'cat',
    updateUserAvatar: () => Promise.resolve(),
    EMAIL_DOMAIN: 'felice.local'
}));

import React from 'react';
import {mountWithIntl} from '../../helpers/intl-helpers';
import MenuBar from '../../../src/components/menu-bar/menu-bar';
import {authInitialState} from '../../../src/reducers/auth';
import {menuInitialState} from '../../../src/reducers/menus';
import {LoadingState} from '../../../src/reducers/project-state';
import {DEFAULT_THEME} from '../../../src/lib/themes';

import configureStore from 'redux-mock-store';
import {Provider} from 'react-redux';
import VM from 'scratch-vm';

describe('MenuBar Component', () => {
    const store = configureStore()({
        locales: {
            isRtl: false,
            locale: 'en-US'
        },
        scratchGui: {
            auth: authInitialState,
            menus: menuInitialState,
            projectState: {
                loadingState: LoadingState.NOT_LOADED
            },
            theme: {
                theme: DEFAULT_THEME
            },
            timeTravel: {
                year: 'NOW'
            },
            vm: new VM()
        }
    });

    const getComponent = function (props = {}) {
        return <Provider store={store}><MenuBar {...props} /></Provider>;
    };

    test('menu bar with no About handler has no About button', () => {
        const menuBar = mountWithIntl(getComponent());
        const button = menuBar.find('AboutButton');
        expect(button.exists()).toBe(false);
    });

    test('menu bar with an About handler has an About button', () => {
        const onClickAbout = jest.fn();
        const menuBar = mountWithIntl(getComponent({onClickAbout}));
        const button = menuBar.find('AboutButton');
        expect(button.exists()).toBe(true);
    });

    test('clicking on About button calls the handler', () => {
        const onClickAbout = jest.fn();
        const menuBar = mountWithIntl(getComponent({onClickAbout}));
        const button = menuBar.find('AboutButton');
        expect(onClickAbout).toHaveBeenCalledTimes(0);
        button.simulate('click');
        expect(onClickAbout).toHaveBeenCalledTimes(1);
    });
});
